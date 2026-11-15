<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';
require_once __DIR__ . '/../configuracion/ClienteIp.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../configuracion/LectorPlanVigente.php';
require_once __DIR__ . '/../modelos/SuscripcionMdl.php';
require_once __DIR__ . '/../modelos/PagosMdl.php';
require_once __DIR__ . '/../modelos/HistorialSuscripcionMdl.php';

/**
 * Validación de pagos por el administrador (HLT-17): confirma o rechaza un pago en revisión.
 * No responde HTTP: devuelve ['resultado' => <constante RESULTADO_*>, 'datos' => ...] y el controlador lo traduce.
 * Orden de bloqueo único: usuario dueño, suscripciones del dueño por id, pago.
 */
class MejoraPlanSrv
{
    public const RESULTADO_OK = 'OK';
    public const RESULTADO_NO_EXISTE = 'NO_EXISTE';
    public const RESULTADO_PAGO_PROPIO = 'PAGO_PROPIO';
    public const RESULTADO_CUENTA_INACTIVA = 'CUENTA_INACTIVA';
    public const RESULTADO_PAGO_NO_PENDIENTE = 'PAGO_NO_PENDIENTE';
    public const RESULTADO_SUSCRIPCION_NO_ADMITE = 'SUSCRIPCION_NO_ADMITE';
    public const RESULTADO_SIN_COMPROBANTE = 'SIN_COMPROBANTE';
    public const RESULTADO_MONTO_NO_COINCIDE = 'MONTO_NO_COINCIDE';
    public const RESULTADO_OTRA_COMBINACION = 'OTRA_COMBINACION';
    public const RESULTADO_YA_PROGRAMADA = 'YA_PROGRAMADA';
    public const RESULTADO_COMPROBANTE_ANTIGUO = 'COMPROBANTE_ANTIGUO';

    public const TIPO_PRIMER_CORTE = 'PRIMER_CORTE';
    public const TIPO_ANTICIPADO = 'ANTICIPADO';
    public const TIPO_OTRA_COMBINACION = 'OTRA_COMBINACION';

    private const NOMBRE_SERVICIO_AUDITORIA = 'rest_suscripcion';
    private const FORMATO_FECHA = 'Y-m-d';
    private const FORMATO_FECHA_HORA = 'Y-m-d H:i:s';
    private const SITUACION_PAGO_EN_REVISION = 'R';
    private const SITUACION_SUSCRIPCION_PENDIENTE = 'P';
    private const SITUACION_SUSCRIPCION_ACTIVA = 'A';

    private Enlace $enlace;
    private ?Closure $reloj;
    private SuscripcionMdl $suscripcionModelo;
    private PagosMdl $pagosModelo;
    private HistorialSuscripcionMdl $historialModelo;

    public function __construct(Enlace $enlace, ?Closure $reloj = null)
    {
        $this->enlace = $enlace;
        $this->reloj = $reloj;
        $this->suscripcionModelo = new SuscripcionMdl($enlace);
        $this->pagosModelo = new PagosMdl($enlace);
        $this->historialModelo = new HistorialSuscripcionMdl($enlace);
    }

    public function ahora(): DateTimeImmutable
    {
        $instante = $this->reloj !== null ? ($this->reloj)() : new DateTimeImmutable('now', LectorPlanVigente::zonaUtc());
        return $instante->setTimezone(LectorPlanVigente::zonaUtc());
    }

    /**
     * Único lugar que calcula fechas de periodo (RN-09); lo usan confirmar y el listado.
     * $presente es la activa de plan de pago con corte vigente (SuscripcionMdl::obtenerPeriodoPresente).
     *
     * PRIMER_CORTE: conserva las fechas que fijó crearConPago al subir el comprobante.
     * ANTICIPADO: inicio = corte presente + 1 día; fin = inicio + meses del intervalo; próximo pago = fin - 1 día.
     * Con un presente de otra combinación el tipo es OTRA_COMBINACION y las fechas son null.
     *
     * @return array{tipo:string, inicio:?string, fin:?string, proximoPago:?string, esAntiguo:bool}
     */
    public function calcularPeriodo(array $pago, ?array $presente, DateTimeImmutable $ahora): array
    {
        $hoy = $ahora->setTimezone(LectorPlanVigente::zonaUtc())->format(self::FORMATO_FECHA);
        if ($presente === null) {
            $fechaCorte = (string) $pago['sus_fechaFin'];
            return [
                'tipo' => self::TIPO_PRIMER_CORTE,
                'inicio' => (string) $pago['sus_fechainicio'],
                'fin' => $fechaCorte,
                'proximoPago' => $pago['sus_proximoPago'] === null ? null : (string) $pago['sus_proximoPago'],
                'esAntiguo' => $fechaCorte < $hoy,
            ];
        }
        if ((int) $presente['sus_pinIdPlanin'] !== (int) $pago['sus_pinIdPlanin']) {
            return [
                'tipo' => self::TIPO_OTRA_COMBINACION,
                'inicio' => null,
                'fin' => null,
                'proximoPago' => null,
                'esAntiguo' => false,
            ];
        }
        $inicio = $this->fechaDeTexto((string) $presente['sus_fechaFin'])->modify('+1 day');
        $fin = $inicio->modify('+' . (int) $pago['ins_numMeses'] . ' month');
        return [
            'tipo' => self::TIPO_ANTICIPADO,
            'inicio' => $inicio->format(self::FORMATO_FECHA),
            'fin' => $fin->format(self::FORMATO_FECHA),
            'proximoPago' => $fin->modify('-1 day')->format(self::FORMATO_FECHA),
            'esAntiguo' => false,
        ];
    }

    /** @return array{resultado:string, datos:?array} */
    public function confirmar(int $idPago, int $idAdministrador): array
    {
        $pagoPrevio = $this->pagosModelo->obtenerPagoParaValidar($idPago, false);
        if ($pagoPrevio === null) {
            return $this->resultado(self::RESULTADO_NO_EXISTE);
        }
        $idDueno = (int) $pagoPrevio['sus_usuarioId'];
        if ($idDueno === $idAdministrador) {
            return $this->resultado(self::RESULTADO_PAGO_PROPIO);
        }

        $transaccionIniciada = false;
        try {
            $this->enlace->iniciarTransaccion();
            $transaccionIniciada = true;
            $respuesta = $this->confirmarBloqueado($idPago, $idDueno, $idAdministrador);
            if ($respuesta['resultado'] === self::RESULTADO_OK) {
                $this->enlace->confirmarTransaccion();
            } else {
                $this->enlace->revertirTransaccion();
            }
            $transaccionIniciada = false;
        } catch (Throwable $error) {
            if ($transaccionIniciada) {
                $this->enlace->revertirTransaccion();
            }
            error_log('[MejoraPlanSrv::confirmar] ' . $error->getMessage());
            throw $error;
        }

        if ($respuesta['resultado'] === self::RESULTADO_OK) {
            $this->registrarAuditoria($respuesta['eventos']);
        }
        return ['resultado' => $respuesta['resultado'], 'datos' => $respuesta['datos'] ?? null];
    }

    /**
     * Rechaza un pago en revisión (R a F). La suscripción sigue pendiente y el motivo, ya saneado por el
     * controlador, queda en el historial (his_detalle = 'pago=<id>; motivo=<texto>').
     *
     * @return array{resultado:string, datos:?array}
     */
    public function rechazar(int $idPago, string $motivo, int $idAdministrador): array
    {
        $pagoPrevio = $this->pagosModelo->obtenerPagoParaValidar($idPago, false);
        if ($pagoPrevio === null) {
            return $this->resultado(self::RESULTADO_NO_EXISTE);
        }
        $idDueno = (int) $pagoPrevio['sus_usuarioId'];
        if ($idDueno === $idAdministrador) {
            return $this->resultado(self::RESULTADO_PAGO_PROPIO);
        }

        $transaccionIniciada = false;
        try {
            $this->enlace->iniciarTransaccion();
            $transaccionIniciada = true;
            $respuesta = $this->rechazarBloqueado($idPago, $idDueno, $idAdministrador, $motivo);
            if ($respuesta['resultado'] === self::RESULTADO_OK) {
                $this->enlace->confirmarTransaccion();
            } else {
                $this->enlace->revertirTransaccion();
            }
            $transaccionIniciada = false;
        } catch (Throwable $error) {
            if ($transaccionIniciada) {
                $this->enlace->revertirTransaccion();
            }
            error_log('[MejoraPlanSrv::rechazar] ' . $error->getMessage());
            throw $error;
        }

        if ($respuesta['resultado'] === self::RESULTADO_OK) {
            $this->registrarAuditoria($respuesta['eventos']);
        }
        return ['resultado' => $respuesta['resultado'], 'datos' => $respuesta['datos'] ?? null];
    }

    /** Dentro de la transacción: bloquea en el orden único y decide. El llamador confirma o revierte. */
    private function confirmarBloqueado(int $idPago, int $idDueno, int $idAdministrador): array
    {
        if (!$this->suscripcionModelo->bloquearUsuarioActivo($idDueno)) {
            return $this->resultado(self::RESULTADO_CUENTA_INACTIVA);
        }
        $suscripcionesDueno = $this->suscripcionModelo->obtenerSuscripcionesConPlan($idDueno, true);
        $pago = $this->pagosModelo->obtenerPagoParaValidar($idPago, true);
        if ($pago === null) {
            return $this->resultado(self::RESULTADO_NO_EXISTE);
        }
        $resultadoValidacion = $this->validarPagoConfirmable($pago);
        if ($resultadoValidacion !== null) {
            return $this->resultado($resultadoValidacion);
        }

        $ahora = $this->ahora();
        $momento = $ahora->format(self::FORMATO_FECHA_HORA);
        $presente = $this->suscripcionModelo->obtenerPeriodoPresente($idDueno, $ahora->format(self::FORMATO_FECHA));
        $periodo = $this->calcularPeriodo($pago, $presente, $ahora);

        if ($periodo['tipo'] === self::TIPO_OTRA_COMBINACION) {
            return $this->resultado(self::RESULTADO_OTRA_COMBINACION);
        }
        if ($periodo['tipo'] === self::TIPO_ANTICIPADO) {
            return $this->programarPeriodoSiguiente(
                $pago,
                $presente,
                $periodo,
                $idDueno,
                $idAdministrador,
                $momento
            );
        }
        if ($periodo['esAntiguo']) {
            return $this->resultado(self::RESULTADO_COMPROBANTE_ANTIGUO);
        }
        return $this->activarPrimerCorte(
            $pago,
            $periodo,
            $suscripcionesDueno,
            $idDueno,
            $idAdministrador,
            $ahora
        );
    }

    /** RN-05, RN-06, RN-21 y RN-07 en ese orden; null si el pago se puede confirmar. */
    private function validarPagoConfirmable(array $pago): ?string
    {
        if ($pago['pag_situacion'] !== self::SITUACION_PAGO_EN_REVISION) {
            return self::RESULTADO_PAGO_NO_PENDIENTE;
        }
        if ($pago['sus_situacion'] !== self::SITUACION_SUSCRIPCION_PENDIENTE) {
            return self::RESULTADO_SUSCRIPCION_NO_ADMITE;
        }
        if ((int) $pago['tieneComprobante'] !== 1) {
            return self::RESULTADO_SIN_COMPROBANTE;
        }
        $precioCatalogo = (float) $pago['pin_precioFinal'];
        $esMontoCoincidente = (int) round((float) $pago['pag_monto'] * 100) === (int) round($precioCatalogo * 100);
        if (!$esMontoCoincidente || $precioCatalogo <= 0.0 || (int) $pago['ins_numMeses'] <= 0
            || $pago['pla_horasDuracion'] !== null) {
            return self::RESULTADO_MONTO_NO_COINCIDE;
        }
        return null;
    }

    private function programarPeriodoSiguiente(
        array $pago,
        array $presente,
        array $periodo,
        int $idDueno,
        int $idAdministrador,
        string $momento
    ): array {
        if ($this->suscripcionModelo->existeProgramadaDelUsuario($idDueno)) {
            return $this->resultado(self::RESULTADO_YA_PROGRAMADA);
        }
        $idSuscripcion = (int) $pago['pag_susIdSuscri'];
        $idPago = (int) $pago['pag_idPago'];
        $renovacionHeredada = (int) $presente['sus_renovAutomatica'];
        $filasProgramadas = $this->suscripcionModelo->programarSuscripcion(
            $idSuscripcion,
            $periodo['inicio'],
            $periodo['fin'],
            (string) $periodo['proximoPago'],
            $renovacionHeredada,
            $momento
        );
        $filasPago = $this->pagosModelo->marcarPagoConfirmado($idPago, $periodo['inicio'], $periodo['fin']);
        if ($filasProgramadas !== 1 || $filasPago !== 1) {
            throw new RuntimeException('No se pudo programar el periodo siguiente');
        }
        $this->historialModelo->registrar(
            $idDueno,
            $idSuscripcion,
            'PROGRAMADA',
            'Periodo siguiente pagado: del ' . $periodo['inicio'] . ' al ' . $periodo['fin'],
            $momento
        );
        return [
            'resultado' => self::RESULTADO_OK,
            'datos' => $this->armarDatosConfirmacion($pago, $periodo, self::SITUACION_SUSCRIPCION_PENDIENTE, []),
            'eventos' => [
                ['PAGO_CONFIRMADO', $idAdministrador, $this->detallePagoConfirmado($pago, $idDueno)],
                [
                    'PLAN_PROGRAMADO',
                    $idDueno,
                    'presente=' . (int) $presente['sis_idSuscrip'] . ' programada=' . $idSuscripcion
                        . ' inicio=' . $periodo['inicio'],
                ],
            ],
        ];
    }

    private function activarPrimerCorte(
        array $pago,
        array $periodo,
        array $suscripcionesDueno,
        int $idDueno,
        int $idAdministrador,
        DateTimeImmutable $ahora
    ): array {
        $momento = $ahora->format(self::FORMATO_FECHA_HORA);
        $idSuscripcion = (int) $pago['pag_susIdSuscri'];
        $idPago = (int) $pago['pag_idPago'];
        $filasActivadas = $this->suscripcionModelo->activarSuscripcion($idSuscripcion, $momento);
        if ($filasActivadas !== 1) {
            throw new RuntimeException('No se pudo activar la suscripción');
        }
        $idsCanceladas = $this->cancelarPlanesConDuracion($suscripcionesDueno, $idDueno, $ahora);
        $filasPago = $this->pagosModelo->marcarPagoConfirmado($idPago);
        if ($filasPago !== 1) {
            throw new RuntimeException('No se pudo confirmar el pago');
        }
        $this->historialModelo->registrar(
            $idDueno,
            $idSuscripcion,
            'ACTIVACION',
            'Plan de pago activado por el pago ' . $idPago . ' validado por el administrador ' . $idAdministrador,
            $momento
        );
        return [
            'resultado' => self::RESULTADO_OK,
            'datos' => $this->armarDatosConfirmacion(
                $pago,
                $periodo,
                self::SITUACION_SUSCRIPCION_ACTIVA,
                $idsCanceladas
            ),
            'eventos' => [
                ['PAGO_CONFIRMADO', $idAdministrador, $this->detallePagoConfirmado($pago, $idDueno)],
                [
                    'PLAN_MEJORADO',
                    $idDueno,
                    'origen=' . ($idsCanceladas === [] ? 'ninguno' : (string) $idsCanceladas[0])
                        . ' destino=' . $idSuscripcion,
                ],
            ],
        ];
    }

    /**
     * RN-10: las activas con duración (prueba y Libre) pasan a C si seguían vigentes o a E si ya habían vencido.
     * La vigencia sigue la regla del lector: con hora de fin vale hasta ese instante; sin ella, hasta el fin del día.
     *
     * @return array<int, int> ids cancelados
     */
    private function cancelarPlanesConDuracion(array $suscripcionesDueno, int $idDueno, DateTimeImmutable $ahora): array
    {
        $momento = $ahora->format(self::FORMATO_FECHA_HORA);
        $idsCanceladas = [];
        foreach ($suscripcionesDueno as $fila) {
            if ($fila['sus_situacion'] !== self::SITUACION_SUSCRIPCION_ACTIVA || $fila['pla_horasDuracion'] === null) {
                continue;
            }
            $idCancelada = (int) $fila['sis_idSuscrip'];
            $situacionFinal = $this->estaVigente($fila, $ahora) ? 'C' : 'E';
            $this->suscripcionModelo->cancelarPorMejora($idCancelada, $situacionFinal, $momento);
            $this->historialModelo->registrar(
                $idDueno,
                $idCancelada,
                'CANCELADA_MEJORA',
                'Plan con duración cancelado por mejora a un plan de pago; situacion=' . $situacionFinal,
                $momento
            );
            $idsCanceladas[] = $idCancelada;
        }
        return $idsCanceladas;
    }

    private function estaVigente(array $fila, DateTimeImmutable $ahora): bool
    {
        if ($fila['sus_fechaHoraFin'] !== null) {
            return $ahora < new DateTimeImmutable((string) $fila['sus_fechaHoraFin'], LectorPlanVigente::zonaUtc());
        }
        return $ahora->format(self::FORMATO_FECHA) <= (string) $fila['sus_fechaFin'];
    }

    private function rechazarBloqueado(int $idPago, int $idDueno, int $idAdministrador, string $motivo): array
    {
        // Un dueño inactivo no se puede bloquear; aun así se permite rechazar su comprobante.
        $this->suscripcionModelo->bloquearUsuarioActivo($idDueno);
        $this->suscripcionModelo->obtenerSuscripcionesConPlan($idDueno, true);
        $pago = $this->pagosModelo->obtenerPagoParaValidar($idPago, true);
        if ($pago === null) {
            return $this->resultado(self::RESULTADO_NO_EXISTE);
        }
        if ($pago['pag_situacion'] !== self::SITUACION_PAGO_EN_REVISION) {
            return $this->resultado(self::RESULTADO_PAGO_NO_PENDIENTE);
        }
        $filasPago = $this->pagosModelo->marcarPagoRechazado($idPago);
        if ($filasPago !== 1) {
            return $this->resultado(self::RESULTADO_PAGO_NO_PENDIENTE);
        }
        $idSuscripcion = (int) $pago['pag_susIdSuscri'];
        $this->historialModelo->registrar(
            $idDueno,
            $idSuscripcion,
            'PAGO_RECHAZADO',
            'pago=' . $idPago . '; motivo=' . $motivo,
            $this->ahora()->format(self::FORMATO_FECHA_HORA)
        );
        return [
            'resultado' => self::RESULTADO_OK,
            'datos' => ['pag_idPago' => $idPago, 'pag_situacion' => 'F'],
            'eventos' => [
                [
                    'PAGO_RECHAZADO',
                    $idAdministrador,
                    'pago=' . $idPago . ' suscripcion=' . $idSuscripcion . ' dueno=' . $idDueno,
                ],
            ],
        ];
    }

    private function armarDatosConfirmacion(array $pago, array $periodo, string $situacionSuscripcion, array $idsCanceladas): array
    {
        return [
            'pag_idPago' => (int) $pago['pag_idPago'],
            'pag_situacion' => 'C',
            'tipo' => $periodo['tipo'],
            'sis_idSuscrip' => (int) $pago['pag_susIdSuscri'],
            'sus_usuarioId' => (int) $pago['sus_usuarioId'],
            'sus_situacion' => $situacionSuscripcion,
            'sus_fechainicio' => $periodo['inicio'],
            'sus_fechaFin' => $periodo['fin'],
            'sus_proximoPago' => $periodo['proximoPago'],
            'suscripcionesCanceladas' => $idsCanceladas,
        ];
    }

    private function detallePagoConfirmado(array $pago, int $idDueno): string
    {
        return 'pago=' . (int) $pago['pag_idPago'] . ' suscripcion=' . (int) $pago['pag_susIdSuscri']
            . ' dueno=' . $idDueno;
    }

    /** @return array{resultado:string, datos:?array} */
    private function resultado(string $resultado): array
    {
        return ['resultado' => $resultado, 'datos' => null];
    }

    private function fechaDeTexto(string $fecha): DateTimeImmutable
    {
        $fechaConvertida = DateTimeImmutable::createFromFormat(
            '!' . self::FORMATO_FECHA,
            substr($fecha, 0, 10),
            LectorPlanVigente::zonaUtc()
        );
        if ($fechaConvertida === false) {
            throw new UnexpectedValueException('Fecha de periodo inválida');
        }
        return $fechaConvertida;
    }

    /**
     * La auditoría va fuera de la transacción: si falla, solo se registra y la respuesta no cambia.
     *
     * @param array<int, array{0:string, 1:int, 2:string}> $eventos
     */
    private function registrarAuditoria(array $eventos): void
    {
        foreach ($eventos as [$evento, $idUsuario, $detalle]) {
            try {
                (new RegistroAuditoria($this->enlace, self::NOMBRE_SERVICIO_AUDITORIA))
                    ->registrar($evento, $idUsuario, null, $detalle);
            } catch (Throwable $error) {
                error_log('[MejoraPlanSrv::registrarAuditoria] ' . $error->getMessage());
            }
        }
    }
}
