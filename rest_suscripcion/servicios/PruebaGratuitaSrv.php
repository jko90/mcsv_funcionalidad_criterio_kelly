<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';
require_once __DIR__ . '/../configuracion/ClienteIp.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../configuracion/LectorPlanVigente.php';
require_once __DIR__ . '/../modelos/PlanesMdl.php';
require_once __DIR__ . '/../modelos/SuscripcionMdl.php';
require_once __DIR__ . '/../modelos/HistorialSuscripcionMdl.php';

/**
 * Concede la prueba gratuita una sola vez por cuenta nueva. Decide solo el servidor: el cliente no envía
 * plan ni duración. La concesión es atómica y se serializa con el bloqueo de la fila del usuario.
 */
class PruebaGratuitaSrv
{
    public const RESULTADO_CONCEDIDA = 'CONCEDIDA';
    public const RESULTADO_RECHAZADA = 'RECHAZADA';
    public const RESULTADO_LIMITE = 'LIMITE';

    public const HORAS_VENTANA_LIMITE_IP = 24;
    public const MAXIMO_PRUEBAS_POR_IP = 20;
    public const SEGUNDOS_REINTENTO_LIMITE = 3600;

    private const NOMBRE_SERVICIO_AUDITORIA = 'rest_suscripcion';
    private const FORMATO_FECHA = 'Y-m-d';
    private const FORMATO_FECHA_HORA = 'Y-m-d H:i:s';

    private Enlace $enlace;
    private ?Closure $reloj;
    private PlanesMdl $planesModelo;
    private SuscripcionMdl $suscripcionModelo;
    private HistorialSuscripcionMdl $historialModelo;

    public function __construct(Enlace $enlace, ?Closure $reloj = null)
    {
        $this->enlace = $enlace;
        $this->reloj = $reloj;
        $this->planesModelo = new PlanesMdl($enlace);
        $this->suscripcionModelo = new SuscripcionMdl($enlace);
        $this->historialModelo = new HistorialSuscripcionMdl($enlace);
    }

    /** @return array{resultado:string} CONCEDIDA, RECHAZADA o LIMITE */
    public function conceder(int $idUsuario): array
    {
        $ahora = $this->ahora();
        if ($this->superaLimitePorIp($ahora)) {
            $this->auditar('PRUEBA_RECHAZADA', $idUsuario, 'motivo=limite_ip');
            return ['resultado' => self::RESULTADO_LIMITE];
        }

        $combinacionPrueba = $this->planesModelo->obtenerCombinacionDePrueba();
        if ($combinacionPrueba === null) {
            $this->auditar('PRUEBA_RECHAZADA', $idUsuario, 'motivo=sin_plan_prueba');
            return ['resultado' => self::RESULTADO_RECHAZADA];
        }

        $motivoRechazo = $this->concederEnTransaccion($idUsuario, $combinacionPrueba, $ahora);
        if ($motivoRechazo !== null) {
            $this->auditar('PRUEBA_RECHAZADA', $idUsuario, 'motivo=' . $motivoRechazo);
            return ['resultado' => self::RESULTADO_RECHAZADA];
        }
        $this->auditar('PRUEBA_INICIADA', $idUsuario, '');
        return ['resultado' => self::RESULTADO_CONCEDIDA];
    }

    /** Devuelve null si la prueba se concedió, o el motivo interno del rechazo. */
    private function concederEnTransaccion(int $idUsuario, array $combinacionPrueba, DateTimeImmutable $ahora): ?string
    {
        $transaccionIniciada = false;
        try {
            $this->enlace->iniciarTransaccion();
            $transaccionIniciada = true;
            if (!$this->suscripcionModelo->bloquearUsuarioActivo($idUsuario)) {
                $this->enlace->revertirTransaccion();
                return 'usuario_inactivo';
            }
            $motivoRechazo = $this->suscripcionModelo->obtenerMotivoInelegibilidadPrueba($idUsuario);
            if ($motivoRechazo !== null) {
                $this->enlace->revertirTransaccion();
                return $motivoRechazo;
            }

            $instanteFin = $ahora->modify('+' . (int) $combinacionPrueba['pla_horasDuracion'] . ' hour');
            $momento = $ahora->format(self::FORMATO_FECHA_HORA);
            $idSuscripcion = $this->suscripcionModelo->insertarSuscripcionConHoraFin(
                $idUsuario,
                (int) $combinacionPrueba['pin_idPlanInterv'],
                $ahora->format(self::FORMATO_FECHA),
                $instanteFin->format(self::FORMATO_FECHA),
                $instanteFin->format(self::FORMATO_FECHA_HORA),
                $ahora->format(self::FORMATO_FECHA),
                $momento
            );
            $this->historialModelo->registrar(
                $idUsuario,
                $idSuscripcion,
                'PRUEBA_INICIADA',
                'Prueba gratuita concedida',
                $momento
            );
            $this->enlace->confirmarTransaccion();
            $transaccionIniciada = false;
            return null;
        } catch (Throwable $error) {
            if ($transaccionIniciada) {
                $this->enlace->revertirTransaccion();
            }
            error_log('[PruebaGratuitaSrv::conceder] ' . $error->getMessage());
            throw $error;
        }
    }

    private function superaLimitePorIp(DateTimeImmutable $ahora): bool
    {
        $desde = $ahora->modify('-' . self::HORAS_VENTANA_LIMITE_IP . ' hour')->format(self::FORMATO_FECHA_HORA);
        $total = $this->suscripcionModelo->contarPruebasIniciadasPorIp(ClienteIp::obtener(), $desde);
        return $total >= self::MAXIMO_PRUEBAS_POR_IP;
    }

    private function ahora(): DateTimeImmutable
    {
        $instante = $this->reloj !== null ? ($this->reloj)() : new DateTimeImmutable('now', LectorPlanVigente::zonaUtc());
        return $instante->setTimezone(LectorPlanVigente::zonaUtc());
    }

    /** La auditoría va fuera de la transacción: si falla, solo se registra y la respuesta no cambia. */
    private function auditar(string $evento, int $idUsuario, string $detalle): void
    {
        try {
            (new RegistroAuditoria($this->enlace, self::NOMBRE_SERVICIO_AUDITORIA))
                ->registrar($evento, $idUsuario, null, $detalle);
        } catch (Throwable $error) {
            error_log('[PruebaGratuitaSrv::auditar] ' . $error->getMessage());
        }
    }
}
