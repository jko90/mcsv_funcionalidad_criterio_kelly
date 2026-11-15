<?php

declare(strict_types=1);

require_once __DIR__ . '/../modelos/PlanesMdl.php';
require_once __DIR__ . '/../modelos/SuscripcionMdl.php';
require_once __DIR__ . '/../modelos/PagosMdl.php';
require_once __DIR__ . '/../configuracion/enlace.php';
require_once __DIR__ . '/../configuracion/LectorPlanVigente.php';
require_once __DIR__ . '/../servicios/PlanVigenteSrv.php';
require_once __DIR__ . '/../servicios/PruebaGratuitaSrv.php';
require_once __DIR__ . '/../servicios/CancelacionPlanSrv.php';
require_once __DIR__ . '/BaseCtrl.php';

class SuscripcionCtrl extends BaseCtrl
{
    private const METODOS_PAGO_PERMITIDOS = ['CRIPTOMONEDA', 'PAYPAL', 'BANCO'];
    private const METODO_PAGO_POR_DEFECTO = 'CRIPTOMONEDA';
    private const LONGITUD_MAXIMA_TRANSACCION = 254;
    private const LONGITUD_MAXIMA_CORREO = 64;
    private const PATRON_TRANSACCION = '/^[A-Za-z0-9._:-]+$/';
    private const PATRON_CRIPTOMONEDA = '/^[A-Z0-9]{2,16}$/';
    private const MESES_SUSCRIPCION_SIN_PAGO = 1;
    private const MENSAJE_SIN_PLAN_DE_PAGO = 'No tiene un plan de pago activo para cancelar';
    private const MENSAJE_YA_CANCELADO = 'El plan ya está cancelado';

    private Enlace $enlace;
    private PlanesMdl $planesServicio;
    private SuscripcionMdl $suscripcionServicio;
    private PagosMdl $pagosServicio;
    private PlanVigenteSrv $planVigenteServicio;
    private PruebaGratuitaSrv $pruebaGratuitaServicio;
    private CancelacionPlanSrv $cancelacionPlanServicio;

    public function __construct()
    {
        $this->enlace = new Enlace();
        $this->planesServicio = new PlanesMdl($this->enlace);
        $this->suscripcionServicio = new SuscripcionMdl($this->enlace);
        $this->pagosServicio = new PagosMdl($this->enlace);
        $this->planVigenteServicio = new PlanVigenteSrv($this->enlace);
        $this->pruebaGratuitaServicio = new PruebaGratuitaSrv($this->enlace);
        $this->cancelacionPlanServicio = new CancelacionPlanSrv($this->enlace);
    }

    public function obtenerPlanVigente(mixed $idQuery, mixed $idSegmento): void
    {
        try {
            $this->verificarUsuarioEnviado($idQuery, 'suscripcion/planVigente');
            $this->verificarUsuarioEnviado($idSegmento, 'suscripcion/planVigente');
            $this->respuestaExitosaSimple($this->planVigenteServicio->resolver($this->idUsuarioSesion()));
        } catch (Throwable $error) {
            error_log('[SuscripcionCtrl::obtenerPlanVigente] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /** La concesión la decide solo el servidor: el cuerpo no admite ningún dato. */
    public function iniciarPrueba(array $datos): void
    {
        try {
            if ($datos !== []) {
                $this->respuestaErrorSimple('La solicitud no admite datos', 400);
            }
            $idUsuario = $this->idUsuarioSesion();
            $resultadoConcesion = $this->pruebaGratuitaServicio->conceder($idUsuario)['resultado'];
            if ($resultadoConcesion === PruebaGratuitaSrv::RESULTADO_LIMITE) {
                header('Retry-After: ' . PruebaGratuitaSrv::SEGUNDOS_REINTENTO_LIMITE);
                $this->respuestaErrorSimple('Demasiados intentos, intente nuevamente más tarde', 429);
            }
            if ($resultadoConcesion !== PruebaGratuitaSrv::RESULTADO_CONCEDIDA) {
                $this->respuestaErrorSimple('La prueba gratuita no está disponible para esta cuenta', 409);
            }
            $this->respuestaExitosaSimple($this->planVigenteServicio->resolver($idUsuario));
        } catch (Throwable $error) {
            error_log('[SuscripcionCtrl::iniciarPrueba] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /**
     * HLT-18: cancela el plan de pago del usuario de la sesión (solo apaga la renovación; sigue vigente hasta
     * su corte). El cuerpo admite únicamente un sis_idSuscrip opcional propio.
     */
    public function cancelarPlan(array $datos, mixed $idQuery = null, mixed $idSegmento = null): void
    {
        try {
            $this->verificarUsuarioEnviado($idQuery, 'suscripcion/cancelar');
            $this->verificarUsuarioEnviado($idSegmento, 'suscripcion/cancelar');
            $this->verificarUsuarioEnviado($datos['sus_usuarioId'] ?? null, 'suscripcion/cancelar');
            unset($datos['sus_usuarioId']);
            if (array_diff(array_keys($datos), ['sis_idSuscrip']) !== []) {
                $this->respuestaErrorSimple('La solicitud contiene campos no permitidos', 400);
            }
            $idSuscripcion = array_key_exists('sis_idSuscrip', $datos)
                ? $this->leerEntero($datos['sis_idSuscrip'], 'sis_idSuscrip')
                : null;
            $idUsuario = $this->idUsuarioSesion();

            $resultadoCancelacion = $this->cancelacionPlanServicio->cancelar($idUsuario, $idSuscripcion)['resultado'];
            if ($resultadoCancelacion === CancelacionPlanSrv::RESULTADO_NO_EXISTE) {
                $this->denegarAcceso("suscripcion=$idSuscripcion suscripcion/cancelar");
            }
            if ($resultadoCancelacion === CancelacionPlanSrv::RESULTADO_CUENTA_INACTIVA) {
                $this->respuestaErrorSimple('Sesión no válida o expirada', 401);
            }
            if ($resultadoCancelacion === CancelacionPlanSrv::RESULTADO_SIN_PLAN_DE_PAGO) {
                $this->respuestaErrorSimple(self::MENSAJE_SIN_PLAN_DE_PAGO, 409);
            }
            if ($resultadoCancelacion === CancelacionPlanSrv::RESULTADO_YA_CANCELADO) {
                $this->respuestaErrorSimple(self::MENSAJE_YA_CANCELADO, 409);
            }
            $this->respuestaExitosaSimple($this->planVigenteServicio->resolver($idUsuario));
        } catch (Throwable $error) {
            error_log('[SuscripcionCtrl::cancelarPlan] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerSuscripcionesPorUsuario(mixed $idQuery, mixed $idSegmento): void
    {
        try {
            $this->verificarUsuarioEnviado($idQuery, 'suscripcion/porUsuario');
            $this->verificarUsuarioEnviado($idSegmento, 'suscripcion/porUsuario');
            $resultado = $this->suscripcionServicio->obtenerSuscripcionesPorUsuario($this->idUsuarioSesion());
            if (!$resultado || $resultado->num_rows === 0) {
                $this->respuestaErrorSimple('No se encontraron suscripciones para el usuario especificado', 404);
            }

            $datosSuscripciones = [];
            foreach ($resultado as $suscripcion) {
                $datosSuscripciones[] = $this->formatearSuscripcion($suscripcion);
            }
            $this->respuestaExitosaSimple($datosSuscripciones);
        } catch (Throwable $error) {
            error_log('[SuscripcionCtrl::obtenerSuscripcionesPorUsuario] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function insertarSuscripcionSinPago(array $datos): void
    {
        $transaccionIniciada = false;
        try {
            $this->verificarUsuarioEnviado($datos['sus_usuarioId'] ?? null, 'suscripcion/crearSinPago');
            $idPlan = $this->leerEntero($datos['sus_pinIdPlanin'] ?? null, 'sus_pinIdPlanin');
            $idUsuario = $this->idUsuarioSesion();
            $plan = $this->planesServicio->obtenerPlanIntervaloActivo($idPlan);
            if ($plan === null || $this->esPlanDePrueba($plan)) {
                $this->respuestaErrorSimple('El plan seleccionado no es válido', 400);
            }

            $ahora = date('Y-m-d H:i:s');
            $fechaFin = date(
                'Y-m-d H:i:s',
                strtotime($ahora . ' +' . self::MESES_SUSCRIPCION_SIN_PAGO . ' month')
            );

            $this->enlace->iniciarTransaccion();
            $transaccionIniciada = true;
            $this->bloquearUsuarioOResponder($idUsuario);
            // Prueba y Libre no bloquean. Con un plan de pago pendiente o activo solo se puede elegir
            // uno de mayor precio; para uno igual o menor, primero hay que cancelar el plan actual.
            $precioActual = $this->suscripcionServicio->precioMaximoPlanPagoVigente(
                $idUsuario,
                $this->fechaHoyUtc(),
                true
            );
            if ($precioActual !== null && (float) $plan['pin_precioFinal'] <= $precioActual) {
                $this->enlace->revertirTransaccion();
                $transaccionIniciada = false;
                $this->respuestaErrorSimple(
                    'Ya tienes un plan de pago. Solo puedes elegir uno de mayor costo; '
                    . 'para uno igual o menor, cancela primero tu plan actual',
                    409
                );
            }
            $idSuscripcion = $this->suscripcionServicio->insertarSuscripcionSinPago(
                $idUsuario,
                $idPlan,
                $ahora,
                $fechaFin
            );
            $this->enlace->confirmarTransaccion();
            $transaccionIniciada = false;

            $suscripcion = $this->suscripcionServicio->obtenerSuscripcionDeUsuario($idSuscripcion, $idUsuario);
            if ($suscripcion === null) {
                $this->respuestaErrorSimple('No se encontraron detalles de la suscripción', 404);
            }
            $this->respuestaExitosaSimple($this->formatearSuscripcion($suscripcion));
        } catch (Throwable $error) {
            if ($transaccionIniciada) {
                $this->enlace->revertirTransaccion();
            }
            error_log('[SuscripcionCtrl::insertarSuscripcionSinPago] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function insertarSuscripcionConPago(array $datos): void
    {
        $transaccionIniciada = false;
        try {
            $this->verificarUsuarioEnviado($datos['iUsuario'] ?? null, 'suscripcion/crearConPago');
            $idPlan = $this->leerEntero($datos['pin_idPlanInterv'] ?? null, 'pin_idPlanInterv');
            $idUsuario = $this->idUsuarioSesion();
            $idTransaccion = $this->leerTexto(
                $datos['idTransaccion'] ?? null,
                'idTransaccion',
                self::LONGITUD_MAXIMA_TRANSACCION,
                true,
                self::PATRON_TRANSACCION
            );
            $metodoPago = array_key_exists('metodoPago', $datos)
                ? $this->leerOpcion($datos['metodoPago'], 'metodoPago', self::METODOS_PAGO_PERMITIDOS)
                : self::METODO_PAGO_POR_DEFECTO;
            $comprobante = $this->leerImagen($datos['comprobante'] ?? null, 'comprobante');
            $correoTransaccion = $this->leerCorreo($datos['correoTransaccion'] ?? null);
            $criptomoneda = $this->leerTexto(
                $datos['criptomoneda'] ?? null,
                'criptomoneda',
                16,
                false,
                self::PATRON_CRIPTOMONEDA
            );
            $idSuscripcionEnviada = $this->leerIdentificadorOpcional(
                $datos['sis_idSuscrip'] ?? null,
                'sis_idSuscrip'
            );

            $plan = $this->planesServicio->obtenerPlanIntervaloActivo($idPlan);
            if ($plan === null || $this->esPlanDePrueba($plan)) {
                $this->respuestaErrorSimple('El plan seleccionado no es válido', 400);
            }
            $montoPago = (float) $plan['pin_precioFinal'];
            if ($montoPago <= 0) {
                $this->respuestaErrorSimple('El plan seleccionado no requiere pago', 400);
            }
            $numeroMeses = (int) $plan['ins_numMeses'];
            $fechaInicio = date('Y-m-d H:i:s');
            $fechaFin = date('Y-m-d H:i:s', strtotime($fechaInicio . ' +' . $numeroMeses . ' month'));
            $proximoPago = date('Y-m-d H:i:s', strtotime($fechaFin . ' -1 day'));

            $this->enlace->iniciarTransaccion();
            $transaccionIniciada = true;
            $this->bloquearUsuarioOResponder($idUsuario);
            $suscripcion = null;
            if ($idSuscripcionEnviada !== null) {
                $suscripcion = $this->suscripcionServicio
                    ->obtenerSuscripcionDeUsuario($idSuscripcionEnviada, $idUsuario, true);
                if ($suscripcion === null) {
                    $this->enlace->revertirTransaccion();
                    $transaccionIniciada = false;
                    $this->denegarAcceso("suscripcion=$idSuscripcionEnviada suscripcion/crearConPago");
                }
                if ((int) $suscripcion['sus_pinIdPlanin'] !== $idPlan) {
                    $this->enlace->revertirTransaccion();
                    $transaccionIniciada = false;
                    $this->respuestaErrorSimple('La suscripción no corresponde al plan', 400);
                }
                // RN-16: solo una pendiente sin periodo ya pagado admite el comprobante; una activa, vencida,
                // cancelada o programada (pendiente con pago confirmado) no se reutiliza ni cambia de fechas.
                $idSuscripcionReutilizada = (int) $suscripcion['sis_idSuscrip'];
                if ($suscripcion['sus_situacion'] !== 'P'
                    || $this->pagosServicio->existePagoConfirmado($idSuscripcionReutilizada)) {
                    $this->responderConflictoRevirtiendo('La suscripción no admite pagos', $transaccionIniciada);
                }
            } else {
                $suscripcion = $this->suscripcionServicio
                    ->obtenerSuscripcionPendientePorPlan($idUsuario, $idPlan, true);
            }

            $hoyUtc = $this->fechaHoyUtc();
            if ($suscripcion !== null) {
                $idSuscripcionReutilizada = (int) $suscripcion['sis_idSuscrip'];
                // RN-22: un solo pago en revisión por suscripción.
                if ($this->pagosServicio->existePagoEnRevision($idSuscripcionReutilizada)) {
                    $this->responderConflictoRevirtiendo(
                        'Ya hay un comprobante en revisión para esta suscripción',
                        $transaccionIniciada
                    );
                }
                // RN-27 (DT-17): una renovación solo admite el comprobante dentro de su plazo de 30 días.
                if ($this->suscripcionServicio->esRenovacion($idSuscripcionReutilizada)) {
                    $fechaLimiteRenovacion = $this->suscripcionServicio
                        ->obtenerFechaLimiteRenovacion($idSuscripcionReutilizada);
                    if ($fechaLimiteRenovacion !== null && $fechaLimiteRenovacion < $hoyUtc) {
                        $this->responderConflictoRevirtiendo(
                            'El plazo para pagar la renovación terminó',
                            $transaccionIniciada
                        );
                    }
                }
            } else {
                $this->exigirPagoNuevoPermitido($idUsuario, $idPlan, $hoyUtc, $transaccionIniciada);
            }

            if ($this->pagosServicio->existeTransaccion($idTransaccion)) {
                $this->enlace->revertirTransaccion();
                $transaccionIniciada = false;
                $this->respuestaErrorSimple('La transacción ya fue registrada', 409);
            }

            if ($suscripcion !== null) {
                $idSuscripcion = (int) $suscripcion['sis_idSuscrip'];
                $this->suscripcionServicio->actualizarRangoFechaConPago(
                    $idSuscripcion,
                    $idUsuario,
                    $fechaInicio,
                    $fechaFin,
                    $idTransaccion,
                    $proximoPago
                );
            } else {
                $idSuscripcion = $this->suscripcionServicio->insertarSuscripcionConPago(
                    $idUsuario,
                    $idPlan,
                    $fechaInicio,
                    $fechaFin,
                    $idTransaccion,
                    $proximoPago
                );
            }

            $idPago = $this->pagosServicio->insertarPagoSuscripcion(
                $idSuscripcion,
                $montoPago,
                $fechaInicio,
                $metodoPago,
                $idTransaccion,
                $fechaInicio,
                $fechaFin,
                $comprobante,
                $correoTransaccion,
                $criptomoneda === '' ? null : $criptomoneda
            );
            if ($idPago <= 0) {
                throw new RuntimeException('No se pudo registrar el pago');
            }

            $this->enlace->confirmarTransaccion();
            $transaccionIniciada = false;
            $suscripcionFinal = $this->suscripcionServicio
                ->obtenerSuscripcionDeUsuario($idSuscripcion, $idUsuario);
            if ($suscripcionFinal === null) {
                $this->respuestaErrorSimple('No se encontraron detalles de la suscripción', 404);
            }
            $this->respuestaExitosaSimple($this->formatearSuscripcion($suscripcionFinal));
        } catch (Throwable $error) {
            if ($transaccionIniciada) {
                $this->enlace->revertirTransaccion();
            }
            error_log('[SuscripcionCtrl::insertarSuscripcionConPago] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /** El plan de prueba se reconoce por datos: tiene duración en horas y un plan siguiente. */
    private function esPlanDePrueba(array $plan): bool
    {
        return $plan['pla_horasDuracion'] !== null && $plan['pla_planSiguienteId'] !== null;
    }

    /**
     * RN-26: con un plan de pago presente solo se admite crear la pendiente del periodo siguiente de la misma
     * combinación y una sola vez; con otro plan presente se rechaza.
     */
    private function exigirPagoNuevoPermitido(int $idUsuario, int $idPlan, string $hoyUtc, bool &$transaccionIniciada): void
    {
        $periodoPresente = $this->suscripcionServicio->obtenerPeriodoPresente($idUsuario, $hoyUtc);
        if ($periodoPresente === null) {
            return;
        }
        if ((int) $periodoPresente['sus_pinIdPlanin'] !== $idPlan) {
            $this->responderConflictoRevirtiendo('Ya tiene un plan de pago activo', $transaccionIniciada);
        }
        if ($this->suscripcionServicio->existePagoSiguienteDelUsuario($idUsuario, $idPlan)) {
            $this->responderConflictoRevirtiendo(
                'Ya tiene un pago pendiente o programado para el siguiente periodo',
                $transaccionIniciada
            );
        }
    }

    /** Revierte la transacción abierta y responde 409 (la respuesta termina la ejecución). */
    private function responderConflictoRevirtiendo(string $mensaje, bool &$transaccionIniciada): void
    {
        $this->enlace->revertirTransaccion();
        $transaccionIniciada = false;
        $this->respuestaErrorSimple($mensaje, 409);
    }

    private function fechaHoyUtc(): string
    {
        return (new DateTimeImmutable('now', LectorPlanVigente::zonaUtc()))->format('Y-m-d');
    }

    /** Primer bloqueo de toda operación sobre las suscripciones: la fila del usuario activo. */
    private function bloquearUsuarioOResponder(int $idUsuario): void
    {
        if (!$this->suscripcionServicio->bloquearUsuarioActivo($idUsuario)) {
            $this->enlace->revertirTransaccion();
            $this->respuestaErrorSimple('Sesión no válida o expirada', 401);
        }
    }

    private function leerIdentificadorOpcional(mixed $valor, string $campo): ?int
    {
        if ($valor === null || $valor === '' || $valor === 0 || $valor === '0') {
            return null;
        }
        return $this->leerEntero($valor, $campo);
    }

    private function leerCorreo(mixed $valor): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        if (!is_string($valor) || filter_var($valor, FILTER_VALIDATE_EMAIL) === false) {
            $this->respuestaErrorSimple("El campo 'correoTransaccion' es inválido", 400);
        }
        $correo = htmlspecialchars(trim($valor), ENT_QUOTES, 'UTF-8');
        if (mb_strlen($correo) > self::LONGITUD_MAXIMA_CORREO) {
            $this->respuestaErrorSimple("El campo 'correoTransaccion' excede la longitud permitida", 400);
        }
        return $correo;
    }

    private function formatearSuscripcion(array $suscripcion): array
    {
        return [
            'sis_idSuscrip' => (int) ($suscripcion['sis_idSuscrip'] ?? 0),
            'sus_usuarioId' => (int) ($suscripcion['sus_usuarioId'] ?? 0),
            'sus_pinIdPlanin' => (int) ($suscripcion['sus_pinIdPlanin'] ?? 0),
            'sus_fechainicio' => $suscripcion['sus_fechainicio'] ?? '',
            'sus_fechaFin' => $suscripcion['sus_fechaFin'] ?? '',
            'sus_situacion' => $suscripcion['sus_situacion'] ?? '',
            'sus_referenPago' => $suscripcion['sus_referenPago'] ?? '',
            'sus_renovAutomatica' => (bool) ($suscripcion['sus_renovAutomatica'] ?? false),
            'sus_proximoPago' => $suscripcion['sus_proximoPago'] ?? '',
            'sus_fechaCrea' => $suscripcion['sus_fechaCrea'] ?? '',
        ];
    }
}
