<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';
require_once __DIR__ . '/../configuracion/LectorPlanVigente.php';

class SuscripcionMdl
{
    private Enlace $conexion;

    private const COLUMNAS_SUSCRIPCION = 'sis_idSuscrip, sus_usuarioId, sus_pinIdPlanin,
        sus_fechainicio, sus_fechaFin, sus_situacion, sus_referenPago, sus_renovAutomatica,
        sus_proximoPago, sus_fechaCrea';

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function obtenerSuscripcionDeUsuario(
        int $idSuscripcion,
        int $idUsuario,
        bool $bloquear = false
    ): ?array {
        $sqlObtenerSuscripcion = 'SELECT ' . self::COLUMNAS_SUSCRIPCION . '
            FROM spsu_suscripcion
            WHERE sis_idSuscrip = ? AND sus_usuarioId = ?';
        if ($bloquear) {
            $sqlObtenerSuscripcion .= ' FOR UPDATE';
        }
        return $this->conexion->ejecutarConsultaSimpleFila(
            $sqlObtenerSuscripcion,
            'ii',
            $idSuscripcion,
            $idUsuario
        );
    }

    public function obtenerSuscripcionesPorUsuario(int $idUsuario)
    {
        $sqlObtenerSuscripciones = 'SELECT ' . self::COLUMNAS_SUSCRIPCION . '
            FROM spsu_suscripcion
            WHERE sus_usuarioId = ? AND sus_situacion = \'P\'
            AND sus_referenPago IS NULL AND sus_fechainicio IS NOT NULL
            AND sus_fechaFin IS NOT NULL AND CURRENT_DATE BETWEEN sus_fechainicio AND sus_fechaFin';
        return $this->conexion->ejecutarConsulta($sqlObtenerSuscripciones, 'i', $idUsuario);
    }

    public function obtenerSuscripcionPendientePorPlan(
        int $idUsuario,
        int $idPlan,
        bool $bloquear = false
    ): ?array {
        $sqlObtenerPendiente = 'SELECT ' . self::COLUMNAS_SUSCRIPCION . '
            FROM spsu_suscripcion
            WHERE sus_usuarioId = ? AND sus_pinIdPlanin = ? AND sus_situacion = \'P\'
            AND (sus_referenPago IS NULL OR sus_referenPago = \'\')
            ORDER BY sis_idSuscrip DESC LIMIT 1';
        if ($bloquear) {
            $sqlObtenerPendiente .= ' FOR UPDATE';
        }
        return $this->conexion->ejecutarConsultaSimpleFila(
            $sqlObtenerPendiente,
            'ii',
            $idUsuario,
            $idPlan
        );
    }

    /**
     * Indica si el usuario tiene una suscripción pendiente o un plan de pago activo no vencido.
     * Las filas de planes con duración en horas (prueba y Libre), activas o pendientes, no bloquean
     * (D-05): quien tiene una fila Libre en 'P' puede elegir un plan de pago.
     * $fechaHoyUtc es la fecha UTC de hoy (Y-m-d), porque la fecha de corte es de tipo date.
     * Con $bloquear se usa FOR UPDATE para serializar la comprobación y la inserción posterior.
     */
    public function existeSuscripcionVigente(int $idUsuario, string $fechaHoyUtc, bool $bloquear = false): bool
    {
        $sqlExisteVigente = 'SELECT sus.sis_idSuscrip
            FROM spsu_suscripcion sus
            WHERE sus.sus_usuarioId = ? AND sus.sus_situacion IN (\'P\', \'A\')
            AND (sus.sus_fechaFin IS NULL OR sus.sus_fechaFin >= ?)
            AND NOT (EXISTS (
                SELECT 1 FROM spsu_planintervalo plin
                INNER JOIN spsu_planes pla ON pla.pla_idPlan = plin.pin_plaIdPlan
                WHERE plin.pin_idPlanInterv = sus.sus_pinIdPlanin AND pla.pla_horasDuracion IS NOT NULL))
            LIMIT 1';
        if ($bloquear) {
            $sqlExisteVigente .= ' FOR UPDATE';
        }
        $suscripcionVigente = $this->conexion->ejecutarConsultaSimpleFila(
            $sqlExisteVigente,
            'is',
            $idUsuario,
            $fechaHoyUtc
        );
        return $suscripcionVigente !== null;
    }

    /**
     * Precio más alto entre los planes de pago pendientes o activos, no vencidos y sin cancelar
     * (con renovación automática). Null si no hay ninguno: sin plan de pago, o cancelado, se puede
     * elegir cualquier plan. Con $bloquear usa FOR UPDATE (misma transacción que la inserción).
     */
    public function precioMaximoPlanPagoVigente(int $idUsuario, string $fechaHoyUtc, bool $bloquear = false): ?float
    {
        $sql = 'SELECT plin.pin_precioFinal AS precio
            FROM spsu_suscripcion sus
            INNER JOIN spsu_planintervalo plin ON plin.pin_idPlanInterv = sus.sus_pinIdPlanin
            INNER JOIN spsu_planes pla ON pla.pla_idPlan = plin.pin_plaIdPlan
            WHERE sus.sus_usuarioId = ? AND sus.sus_situacion IN (\'P\', \'A\')
            AND sus.sus_renovAutomatica = 1
            AND (sus.sus_fechaFin IS NULL OR sus.sus_fechaFin >= ?)
            AND pla.pla_horasDuracion IS NULL
            ORDER BY plin.pin_precioFinal DESC LIMIT 1';
        if ($bloquear) {
            $sql .= ' FOR UPDATE';
        }
        $fila = $this->conexion->ejecutarConsultaSimpleFila($sql, 'is', $idUsuario, $fechaHoyUtc);
        return $fila === null ? null : (float) $fila['precio'];
    }

    public function insertarSuscripcionSinPago(
        int $idUsuario,
        int $idPlan,
        string $fechaInicio,
        string $fechaFin
    ): int {
        $sqlInsertarSuscripcion = 'INSERT INTO spsu_suscripcion
            (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaCrea)
            VALUES (?, ?, ?, ?, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarSuscripcion,
            'iisss',
            $idUsuario,
            $idPlan,
            $fechaInicio,
            $fechaFin,
            $fechaInicio
        );
    }

    public function actualizarRangoFechaConPago(
        int $idSuscripcion,
        int $idUsuario,
        string $fechaInicio,
        string $fechaFin,
        string $referenciaPago,
        string $proximoPago
    ): int {
        $sqlActualizarRango = 'UPDATE spsu_suscripcion
            SET sus_fechainicio = ?, sus_fechaFin = ?, sus_referenPago = ?, sus_proximoPago = ?
            WHERE sis_idSuscrip = ? AND sus_usuarioId = ?';
        return $this->conexion->ejecutarActualizacion(
            $sqlActualizarRango,
            'ssssii',
            $fechaInicio,
            $fechaFin,
            $referenciaPago,
            $proximoPago,
            $idSuscripcion,
            $idUsuario
        );
    }

    public function insertarSuscripcionConPago(
        int $idUsuario,
        int $idPlan,
        string $fechaInicio,
        string $fechaFin,
        string $referenciaPago,
        string $proximoPago
    ): int {
        $sqlInsertarSuscripcion = 'INSERT INTO spsu_suscripcion
            (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaCrea,
            sus_referenPago, sus_proximoPago)
            VALUES (?, ?, ?, ?, ?, ?, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarSuscripcion,
            'iisssss',
            $idUsuario,
            $idPlan,
            $fechaInicio,
            $fechaFin,
            $fechaInicio,
            $referenciaPago,
            $proximoPago
        );
    }

    /**
     * Mutex por usuario: bloquea la fila del usuario activo. Es el primer bloqueo de toda operación sobre
     * sus suscripciones (orden único: usuario, suscripciones, pagos).
     */
    public function bloquearUsuarioActivo(int $idUsuario): bool
    {
        $sqlBloquearUsuario = 'SELECT usu_idUsuario FROM sgen_usuario
            WHERE usu_idUsuario = ? AND usu_estado = \'1\' AND usu_situacion = \'A\' FOR UPDATE';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlBloquearUsuario, 'i', $idUsuario) !== null;
    }

    /** @return array<int, array<string, mixed>> filas con el plan, según la consulta del lector único */
    public function obtenerSuscripcionesConPlan(int $idUsuario, bool $bloquear): array
    {
        $sqlSuscripcionesConPlan = LectorPlanVigente::SQL_FILAS_USUARIO . ($bloquear ? ' FOR UPDATE' : '');
        $resultado = $this->conexion->ejecutarConsulta($sqlSuscripcionesConPlan, 'i', $idUsuario);
        return $resultado ? $resultado->fetch_all(MYSQLI_ASSOC) : [];
    }

    public function insertarSuscripcionConHoraFin(
        int $idUsuario,
        int $idPlanInterv,
        string $fechaInicio,
        string $fechaFin,
        string $fechaHoraFinUtc,
        string $fechaCreaUtc,
        string $fechaCambioUtc
    ): int {
        $sqlInsertarConHoraFin = 'INSERT INTO spsu_suscripcion
            (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaHoraFin,
            sus_situacion, sus_renovAutomatica, sus_fechaCrea, sus_fechaCambio)
            VALUES (?, ?, ?, ?, ?, \'A\', 0, ?, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarConHoraFin,
            'iisssss',
            $idUsuario,
            $idPlanInterv,
            $fechaInicio,
            $fechaFin,
            $fechaHoraFinUtc,
            $fechaCreaUtc,
            $fechaCambioUtc
        );
    }

    public function actualizarSituacion(int $idSuscripcion, string $situacion, string $fechaCambioUtc): int
    {
        $sqlActualizarSituacion = 'UPDATE spsu_suscripcion
            SET sus_situacion = ?, sus_fechaCambio = ? WHERE sis_idSuscrip = ?';
        return $this->conexion->ejecutarActualizacion(
            $sqlActualizarSituacion,
            'ssi',
            $situacion,
            $fechaCambioUtc,
            $idSuscripcion
        );
    }

    /** Renovación pendiente de pago (DT-15): nunca lleva referencia de pago ni próximo pago. */
    public function insertarRenovacionPendiente(
        int $idUsuario,
        int $idPlanInterv,
        string $inicioUtc,
        string $finUtc,
        string $fechaCreaUtc,
        string $fechaCambioUtc
    ): int {
        $sqlInsertarRenovacion = 'INSERT INTO spsu_suscripcion
            (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion,
            sus_renovAutomatica, sus_fechaCrea, sus_fechaCambio)
            VALUES (?, ?, ?, ?, \'P\', 1, ?, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarRenovacion,
            'iissss',
            $idUsuario,
            $idPlanInterv,
            $inicioUtc,
            $finUtc,
            $fechaCreaUtc,
            $fechaCambioUtc
        );
    }

    /**
     * Cancelación del plan de pago (HLT-18): solo apaga la renovación automática; no toca situación ni fechas.
     * Devuelve 0 si la suscripción no es del usuario o ya estaba cancelada.
     */
    public function marcarSinRenovacion(int $idSuscripcion, int $idUsuario, string $fechaCambioUtc): int
    {
        $sqlMarcarSinRenovacion = 'UPDATE spsu_suscripcion
            SET sus_renovAutomatica = 0, sus_fechaCambio = ?
            WHERE sis_idSuscrip = ? AND sus_usuarioId = ? AND sus_renovAutomatica = 1';
        return $this->conexion->ejecutarActualizacion(
            $sqlMarcarSinRenovacion,
            'sii',
            $fechaCambioUtc,
            $idSuscripcion,
            $idUsuario
        );
    }

    /** Periodo siguiente ya pagado (pendiente con pago confirmado): queda sin renovación al cancelar (DT-16). */
    public function marcarSinRenovacionProgramada(int $idUsuario, string $fechaCambioUtc): int
    {
        $sqlMarcarProgramadaSinRenovacion = 'UPDATE spsu_suscripcion sus
            SET sus.sus_renovAutomatica = 0, sus.sus_fechaCambio = ?
            WHERE sus.sus_usuarioId = ? AND sus.sus_situacion = \'P\' AND sus.sus_renovAutomatica = 1
            AND EXISTS (SELECT 1 FROM spsu_pagos pag WHERE pag.pag_susIdSuscri = sus.sis_idSuscrip
                AND pag.pag_situacion = \'C\')';
        return $this->conexion->ejecutarActualizacion($sqlMarcarProgramadaSinRenovacion, 'si', $fechaCambioUtc, $idUsuario);
    }

    /** Anula una renovación pendiente: pasa a cancelada y termina su renovación automática. */
    public function anularRenovacion(int $idSuscripcion, string $fechaCambioUtc): int
    {
        $sqlAnularRenovacion = 'UPDATE spsu_suscripcion
            SET sus_situacion = \'C\', sus_renovAutomatica = 0, sus_fechaCambio = ?
            WHERE sis_idSuscrip = ? AND sus_situacion = \'P\'';
        return $this->conexion->ejecutarActualizacion($sqlAnularRenovacion, 'si', $fechaCambioUtc, $idSuscripcion);
    }

    /** Plazo de pago de una renovación: fecha de corte de su suscripción origen más el plazo fijo (RN-32). */
    public function obtenerFechaLimiteRenovacion(int $idSuscripcion): ?string
    {
        $sqlFechaCorteOrigen = 'SELECT ori.sus_fechaFin AS fechaCorteOrigen
            FROM spsu_suscripcion sus
            INNER JOIN spsu_suscripcion ori ON ori.sus_usuarioId = sus.sus_usuarioId
                AND ori.sus_pinIdPlanin = sus.sus_pinIdPlanin AND ori.sus_situacion = \'E\'
                AND ori.sis_idSuscrip < sus.sis_idSuscrip
            WHERE sus.sis_idSuscrip = ?
            ORDER BY ori.sis_idSuscrip DESC LIMIT 1';
        $filaOrigen = $this->conexion->ejecutarConsultaSimpleFila($sqlFechaCorteOrigen, 'i', $idSuscripcion);
        if ($filaOrigen === null) {
            return null;
        }
        return LectorPlanVigente::fechaLimiteRenovacion($filaOrigen + ['sus_fechaFin' => $filaOrigen['fechaCorteOrigen']]);
    }

    /**
     * Activa la suscripción pendiente conservando sus fechas (DT-16): solo cambia la situación,
     * quita la hora de fin y marca el cambio. Devuelve 0 si ya no estaba pendiente.
     */
    public function activarSuscripcion(int $idSuscripcion, string $fechaCambioUtc): int
    {
        $sqlActivarSuscripcion = 'UPDATE spsu_suscripcion
            SET sus_situacion = \'A\', sus_fechaHoraFin = NULL, sus_fechaCambio = ?
            WHERE sis_idSuscrip = ? AND sus_situacion = \'P\'';
        return $this->conexion->ejecutarActualizacion($sqlActivarSuscripcion, 'si', $fechaCambioUtc, $idSuscripcion);
    }

    /** Fija el periodo siguiente ya pagado (pago anticipado): la situación sigue en P. */
    public function programarSuscripcion(
        int $idSuscripcion,
        string $inicio,
        string $fin,
        string $proximoPago,
        int $renovAutomatica,
        string $fechaCambioUtc
    ): int {
        $sqlProgramarSuscripcion = 'UPDATE spsu_suscripcion
            SET sus_fechainicio = ?, sus_fechaFin = ?, sus_proximoPago = ?, sus_renovAutomatica = ?,
            sus_fechaCambio = ?
            WHERE sis_idSuscrip = ? AND sus_situacion = \'P\'';
        return $this->conexion->ejecutarActualizacion(
            $sqlProgramarSuscripcion,
            'sssisi',
            $inicio,
            $fin,
            $proximoPago,
            $renovAutomatica,
            $fechaCambioUtc,
            $idSuscripcion
        );
    }

    /** Plan de pago activo del usuario cuyo corte aún no pasó (el de mayor fecha de corte), o null. */
    public function obtenerPeriodoPresente(int $idUsuario, string $hoyUtc): ?array
    {
        $sqlPeriodoPresente = 'SELECT sus.sis_idSuscrip, sus.sus_pinIdPlanin, sus.sus_fechainicio,
            sus.sus_fechaFin, sus.sus_renovAutomatica
            FROM spsu_suscripcion sus
            INNER JOIN spsu_planintervalo plin ON plin.pin_idPlanInterv = sus.sus_pinIdPlanin
            INNER JOIN spsu_planes pla ON pla.pla_idPlan = plin.pin_plaIdPlan
            WHERE sus.sus_usuarioId = ? AND sus.sus_situacion = \'A\' AND pla.pla_horasDuracion IS NULL
            AND sus.sus_fechaFin >= ?
            ORDER BY sus.sus_fechaFin DESC, sus.sis_idSuscrip DESC LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlPeriodoPresente, 'is', $idUsuario, $hoyUtc);
    }

    /** Hay una pendiente de esa combinación con pago ya enviado (referencia) o con pago en revisión/confirmado. */
    public function existePagoSiguienteDelUsuario(int $idUsuario, int $idPlanInterv): bool
    {
        $sqlExistePagoSiguiente = 'SELECT sus.sis_idSuscrip FROM spsu_suscripcion sus
            WHERE sus.sus_usuarioId = ? AND sus.sus_pinIdPlanin = ? AND sus.sus_situacion = \'P\'
            AND ((sus.sus_referenPago IS NOT NULL AND sus.sus_referenPago <> \'\')
                OR EXISTS (SELECT 1 FROM spsu_pagos pag WHERE pag.pag_susIdSuscri = sus.sis_idSuscrip
                    AND pag.pag_situacion IN (\'R\', \'C\')))
            LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlExistePagoSiguiente, 'ii', $idUsuario, $idPlanInterv) !== null;
    }

    /** Marca de «pagada y programada»: una pendiente con un pago confirmado. */
    public function existeProgramadaDelUsuario(int $idUsuario): bool
    {
        $sqlExisteProgramada = 'SELECT sus.sis_idSuscrip FROM spsu_suscripcion sus
            WHERE sus.sus_usuarioId = ? AND sus.sus_situacion = \'P\'
            AND EXISTS (SELECT 1 FROM spsu_pagos pag WHERE pag.pag_susIdSuscri = sus.sis_idSuscrip
                AND pag.pag_situacion = \'C\')
            LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlExisteProgramada, 'i', $idUsuario) !== null;
    }

    /** Cancela (C) o da por vencida (E) una activa de plan con duración al mejorar a un plan de pago. */
    public function cancelarPorMejora(int $idSuscripcion, string $situacion, string $fechaCambioUtc): int
    {
        if (!in_array($situacion, ['C', 'E'], true)) {
            throw new InvalidArgumentException('Situación de cancelación por mejora no permitida');
        }
        $sqlCancelarPorMejora = 'UPDATE spsu_suscripcion SET sus_situacion = ?, sus_fechaCambio = ?
            WHERE sis_idSuscrip = ? AND sus_situacion = \'A\'';
        return $this->conexion->ejecutarActualizacion(
            $sqlCancelarPorMejora,
            'ssi',
            $situacion,
            $fechaCambioUtc,
            $idSuscripcion
        );
    }

    public function esRenovacion(int $idSuscripcion): bool
    {
        $sqlEsRenovacion = 'SELECT 1 FROM spsu_historialsuscri
            WHERE his_sisIdSuscrip = ? AND his_accion = \'renovacion\' LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlEsRenovacion, 'i', $idSuscripcion) !== null;
    }

    /** Cuenta las concesiones de prueba auditadas desde esa IP a partir del instante UTC indicado. */
    public function contarPruebasIniciadasPorIp(string $ip, string $desdeUtc): int
    {
        $sqlContarPruebasPorIp = 'SELECT COUNT(*) AS total FROM sgen_auditoria
            WHERE aud_evento = \'PRUEBA_INICIADA\' AND aud_ip = ? AND aud_fecha >= ?';
        $filaConteo = $this->conexion->ejecutarConsultaSimpleFila($sqlContarPruebasPorIp, 'ss', $ip, $desdeUtc);
        return (int) ($filaConteo['total'] ?? 0);
    }

    /**
     * Elegibilidad de la prueba (RN-02). Devuelve null si la cuenta es elegible o el motivo interno del rechazo:
     * ya_tuvo (alguna suscripción del plan de prueba), historial (suscripciones A, E, C o F de cualquier plan)
     * o cuenta_anterior (registrada antes de crearse el plan de prueba, DT-02).
     */
    public function obtenerMotivoInelegibilidadPrueba(int $idUsuario): ?string
    {
        $sqlElegibilidad = 'SELECT
            (UNIX_TIMESTAMP(per.per_fechaRegis) >= UNIX_TIMESTAMP(pru.pla_fechacambio)) AS esCuentaNueva,
            (SELECT COUNT(*) FROM spsu_suscripcion sus
                INNER JOIN spsu_planintervalo plin ON plin.pin_idPlanInterv = sus.sus_pinIdPlanin
                INNER JOIN spsu_planes pla ON pla.pla_idPlan = plin.pin_plaIdPlan
                WHERE sus.sus_usuarioId = usu.usu_idUsuario
                AND pla.pla_horasDuracion IS NOT NULL AND pla.pla_planSiguienteId IS NOT NULL) AS totalPruebas,
            (SELECT COUNT(*) FROM spsu_suscripcion sus
                WHERE sus.sus_usuarioId = usu.usu_idUsuario
                AND sus.sus_situacion IN (\'A\', \'E\', \'C\', \'F\')) AS totalConHistorial
            FROM sgen_usuario usu
            INNER JOIN sgen_persona per ON per.per_idPersona = usu.usu_perIdPerso
            INNER JOIN (SELECT pla_fechacambio FROM spsu_planes
                WHERE pla_horasDuracion IS NOT NULL AND pla_planSiguienteId IS NOT NULL
                ORDER BY pla_idPlan ASC LIMIT 1) pru
            WHERE usu.usu_idUsuario = ?';
        $filaElegibilidad = $this->conexion->ejecutarConsultaSimpleFila($sqlElegibilidad, 'i', $idUsuario);
        if ($filaElegibilidad === null) {
            return 'usuario_inactivo';
        }
        if ((int) $filaElegibilidad['totalPruebas'] > 0) {
            return 'ya_tuvo';
        }
        if ((int) $filaElegibilidad['totalConHistorial'] > 0) {
            return 'historial';
        }
        return (int) $filaElegibilidad['esCuentaNueva'] === 1 ? null : 'cuenta_anterior';
    }
}
