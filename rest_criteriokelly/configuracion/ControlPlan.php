<?php

declare(strict_types=1);

/**
 * Aplica en el servidor los límites del plan vigente del usuario autenticado (HU-005).
 * La regla del plan vive solo en LectorPlanVigente; esta clase únicamente la consulta (una vez por petición)
 * y decide qué rutas se permiten. Nunca escribe suscripciones.
 */
final class ControlPlan
{
    public const MENSAJE_LIMITE_PLAN = 'Tu plan no incluye esta función. Actualiza tu plan';
    public const CODIGO_LIMITE_PLAN = 403;

    /** Únicas rutas que responden sin plan vigente (Mostrar criterio Kelly, DN-07). */
    public const RUTAS_SIN_PLAN = [
        'cuentas/obtener',
        'criterioKelly/obtenerPorcentaje',
        'criterioKelly/obtenerResultados',
    ];

    private const DETALLE_SIN_PLAN = 'ninguno';

    private static ?Enlace $enlace = null;
    private static ?RegistroAuditoria $auditoria = null;
    private static ?array $evaluacion = null;

    public static function configurar(Enlace $enlace, RegistroAuditoria $auditoria): void
    {
        self::$enlace = $enlace;
        self::$auditoria = $auditoria;
        self::$evaluacion = null;
    }

    /** @return array{estado:string, motivoSinPlan:?string, filaVigente:?array, limites:array} */
    public static function estado(): array
    {
        if (self::$evaluacion === null) {
            if (self::$enlace === null) {
                throw new LogicException('ControlPlan no está configurado');
            }
            $lector = new LectorPlanVigente(self::$enlace);
            self::$evaluacion = $lector->leer(ContextoSesion::idUsuario());
        }
        return self::$evaluacion;
    }

    /** Límites del plan vigente (los del Libre cuando no hay plan vigente). */
    public static function limites(): array
    {
        return self::estado()['limites'];
    }

    public static function exigirRutaPermitida(string $recurso, string $accion): void
    {
        $esSinPlan = self::estado()['estado'] === LectorPlanVigente::ESTADO_SIN_PLAN;
        if (!$esSinPlan || in_array($recurso . '/' . $accion, self::RUTAS_SIN_PLAN, true)) {
            return;
        }
        self::auditarRechazo($recurso . '/' . $accion);
        self::responder(self::MENSAJE_LIMITE_PLAN);
    }

    /** Registra LIMITE_PLAN_RECHAZADO; un fallo de auditoría no cambia la respuesta de límite. */
    public static function auditarRechazo(string $recursoAccion): void
    {
        try {
            $filaVigente = self::estado()['filaVigente'];
            $idPlan = $filaVigente === null ? self::DETALLE_SIN_PLAN : (string) (int) $filaVigente['pla_idPlan'];
            self::$auditoria?->registrar(
                'LIMITE_PLAN_RECHAZADO',
                ContextoSesion::idUsuario(),
                ContextoSesion::familia(),
                'recurso=' . $recursoAccion . ' plan=' . $idPlan
            );
        } catch (Throwable $error) {
            error_log('[ControlPlan::auditarRechazo] ' . $error->getMessage());
        }
    }

    public static function responder(string $mensaje): void
    {
        ManejadorErrores::responderError(self::CODIGO_LIMITE_PLAN, $mensaje);
    }

    /** Fecha de hoy en UTC (los límites en días se cuentan en UTC). */
    public static function hoyUtc(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', LectorPlanVigente::zonaUtc());
    }
}
