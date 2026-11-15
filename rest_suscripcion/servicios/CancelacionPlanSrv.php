<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';
require_once __DIR__ . '/../configuracion/ClienteIp.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../configuracion/LectorPlanVigente.php';
require_once __DIR__ . '/../modelos/SuscripcionMdl.php';
require_once __DIR__ . '/../modelos/HistorialSuscripcionMdl.php';
require_once __DIR__ . '/PlanVigenteSrv.php';

/**
 * Cancelación del plan de pago por el usuario (HLT-18). Cancelar solo apaga la renovación automática:
 * el plan sigue vigente hasta su fecha de corte y no hay devolución de dinero.
 * No responde HTTP: devuelve ['resultado' => <constante RESULTADO_*>] y el controlador lo traduce.
 * Orden de bloqueo único: usuario, suscripciones del usuario.
 */
class CancelacionPlanSrv
{
    public const RESULTADO_OK = 'OK';
    public const RESULTADO_NO_EXISTE = 'NO_EXISTE';
    public const RESULTADO_SIN_PLAN_DE_PAGO = 'SIN_PLAN_DE_PAGO';
    public const RESULTADO_YA_CANCELADO = 'YA_CANCELADO';
    public const RESULTADO_CUENTA_INACTIVA = 'CUENTA_INACTIVA';

    private const NOMBRE_SERVICIO_AUDITORIA = 'rest_suscripcion';
    private const FORMATO_FECHA = 'Y-m-d';
    private const FORMATO_FECHA_HORA = 'Y-m-d H:i:s';

    private Enlace $enlace;
    private LectorPlanVigente $lector;
    private PlanVigenteSrv $planVigenteServicio;
    private SuscripcionMdl $suscripcionModelo;
    private HistorialSuscripcionMdl $historialModelo;

    public function __construct(Enlace $enlace, ?Closure $reloj = null)
    {
        $this->enlace = $enlace;
        $this->lector = new LectorPlanVigente($enlace, $reloj);
        $this->planVigenteServicio = new PlanVigenteSrv($enlace, $reloj);
        $this->suscripcionModelo = new SuscripcionMdl($enlace);
        $this->historialModelo = new HistorialSuscripcionMdl($enlace);
    }

    /** @return array{resultado:string, idSuscripcion:?int} */
    public function cancelar(int $idUsuario, ?int $idSuscripcion): array
    {
        // Primero se aplica el corte pendiente: un plan ya vencido no es cancelable.
        $this->planVigenteServicio->resolver($idUsuario);

        $transaccionIniciada = false;
        try {
            $this->enlace->iniciarTransaccion();
            $transaccionIniciada = true;
            $respuesta = $this->cancelarBloqueado($idUsuario, $idSuscripcion);
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
            error_log('[CancelacionPlanSrv::cancelar] ' . $error->getMessage());
            throw $error;
        }

        if ($respuesta['resultado'] === self::RESULTADO_OK) {
            $this->registrarAuditoria($idUsuario, (int) $respuesta['idSuscripcion']);
        }
        return $respuesta;
    }

    /** @return array{resultado:string, idSuscripcion:?int} */
    private function cancelarBloqueado(int $idUsuario, ?int $idSuscripcion): array
    {
        if (!$this->suscripcionModelo->bloquearUsuarioActivo($idUsuario)) {
            return $this->resultado(self::RESULTADO_CUENTA_INACTIVA);
        }
        $filas = $this->suscripcionModelo->obtenerSuscripcionesConPlan($idUsuario, true);
        $ahora = $this->lector->ahora();

        $filaObjetivo = $idSuscripcion === null
            ? $this->buscarPlanDePagoVigente($filas, $ahora)
            : $this->buscarPorId($filas, $idSuscripcion);
        if ($idSuscripcion !== null && $filaObjetivo === null) {
            return $this->resultado(self::RESULTADO_NO_EXISTE);
        }
        if ($filaObjetivo === null || !$this->esPlanDePagoActivoVigente($filaObjetivo, $ahora)) {
            return $this->resultado(self::RESULTADO_SIN_PLAN_DE_PAGO);
        }
        if ((int) $filaObjetivo['sus_renovAutomatica'] === 0) {
            return $this->resultado(self::RESULTADO_YA_CANCELADO);
        }

        $momento = $ahora->format(self::FORMATO_FECHA_HORA);
        $idObjetivo = (int) $filaObjetivo['sis_idSuscrip'];
        if ($this->suscripcionModelo->marcarSinRenovacion($idObjetivo, $idUsuario, $momento) !== 1) {
            return $this->resultado(self::RESULTADO_YA_CANCELADO);
        }
        $this->suscripcionModelo->marcarSinRenovacionProgramada($idUsuario, $momento);
        $this->historialModelo->registrar(
            $idUsuario,
            $idObjetivo,
            'CANCELACION',
            'Plan de pago cancelado por el usuario; sigue vigente hasta ' . (string) $filaObjetivo['sus_fechaFin'],
            $momento
        );
        return ['resultado' => self::RESULTADO_OK, 'idSuscripcion' => $idObjetivo];
    }

    /** El plan de pago activo y vigente que elegiría el plan vigente: el de mayor nivel. */
    private function buscarPlanDePagoVigente(array $filas, DateTimeImmutable $ahora): ?array
    {
        $mejor = null;
        foreach ($filas as $fila) {
            if (!$this->esPlanDePagoActivoVigente($fila, $ahora)) {
                continue;
            }
            $claveFila = [(float) $fila['pla_precioBase'], (int) $fila['pla_idPlan'], (int) $fila['sis_idSuscrip']];
            if ($mejor === null || $claveFila > $mejor['clave']) {
                $mejor = ['clave' => $claveFila, 'fila' => $fila];
            }
        }
        return $mejor['fila'] ?? null;
    }

    private function buscarPorId(array $filas, int $idSuscripcion): ?array
    {
        foreach ($filas as $fila) {
            if ((int) $fila['sis_idSuscrip'] === $idSuscripcion) {
                return $fila;
            }
        }
        return null;
    }

    /** Plan de pago (sin duración en horas), activo y con el corte aún no vencido (hasta el fin del día UTC). */
    private function esPlanDePagoActivoVigente(array $fila, DateTimeImmutable $ahora): bool
    {
        return $fila['pla_horasDuracion'] === null
            && $fila['sus_situacion'] === 'A'
            && $ahora->format(self::FORMATO_FECHA) <= substr((string) $fila['sus_fechaFin'], 0, 10);
    }

    /** @return array{resultado:string, idSuscripcion:?int} */
    private function resultado(string $resultado): array
    {
        return ['resultado' => $resultado, 'idSuscripcion' => null];
    }

    /** La auditoría va fuera de la transacción: si falla, solo se registra y la respuesta no cambia. */
    private function registrarAuditoria(int $idUsuario, int $idSuscripcion): void
    {
        try {
            (new RegistroAuditoria($this->enlace, self::NOMBRE_SERVICIO_AUDITORIA))
                ->registrar('PLAN_CANCELADO', $idUsuario, null, 'suscripcion=' . $idSuscripcion);
        } catch (Throwable $error) {
            error_log('[CancelacionPlanSrv::registrarAuditoria] ' . $error->getMessage());
        }
    }
}
