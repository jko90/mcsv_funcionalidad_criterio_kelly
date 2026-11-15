<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class PagosMdl
{
    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function existeTransaccion(string $idTransaccion): bool
    {
        $sqlBuscarTransaccion = 'SELECT 1 FROM spsu_pagos
            WHERE pag_idTransac = ? LIMIT 1 FOR UPDATE';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlBuscarTransaccion, 's', $idTransaccion) !== null;
    }

    public function insertarPagoSuscripcion(
        int $idSuscripcion,
        float $montoPago,
        string $fechaPago,
        string $metodoPago,
        string $idTransaccion,
        string $fechaDesde,
        string $fechaHasta,
        ?string $comprobante,
        ?string $correoTransaccion,
        ?string $criptomoneda
    ): int {
        $sqlInsertarPago = 'INSERT INTO spsu_pagos
            (pag_susIdSuscri, pag_monto, pag_fechaPago, pag_metodoPago, pag_idTransac,
            pag_pagoDesde, pag_pagoHasta, pag_imagen, pag_correo, pag_tipocripto)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarPago,
            'idssssssss',
            $idSuscripcion,
            $montoPago,
            $fechaPago,
            $metodoPago,
            $idTransaccion,
            $fechaDesde,
            $fechaHasta,
            $comprobante,
            $correoTransaccion,
            $criptomoneda
        );
    }

    private const SQL_TIENE_COMPROBANTE = "(pag.pag_imagen IS NOT NULL AND pag.pag_imagen NOT IN ('', '--'))";

    /**
     * Pagos en revisión (R) con su suscripción, plan y dueño, sin la imagen (solo si existe).
     *
     * @return array<int, array<string, mixed>>
     */
    public function listarPagosEnRevision(int $limite, int $desde): array
    {
        $sqlListarPagosEnRevision = 'SELECT pag.pag_idPago, pag.pag_susIdSuscri, sus.sus_usuarioId,
            usu.usu_usuario AS usuario, sus.sus_pinIdPlanin, pla.pla_nombre, ins.ins_nombre, ins.ins_numMeses,
            pag.pag_monto, pag.pag_moneda, pag.pag_metodoPago, pag.pag_idTransac, pag.pag_fechaPago,
            pag.pag_tipocripto, ' . self::SQL_TIENE_COMPROBANTE . ' AS tieneComprobante,
            sus.sus_fechainicio, sus.sus_fechaFin, sus.sus_proximoPago
            FROM spsu_pagos pag
            INNER JOIN spsu_suscripcion sus ON sus.sis_idSuscrip = pag.pag_susIdSuscri
            INNER JOIN spsu_planintervalo plin ON plin.pin_idPlanInterv = sus.sus_pinIdPlanin
            INNER JOIN spsu_intervalosuscr ins ON ins.ins_idInterSuscrip = plin.pins_idInterSuscrip
            INNER JOIN spsu_planes pla ON pla.pla_idPlan = plin.pin_plaIdPlan
            INNER JOIN sgen_usuario usu ON usu.usu_idUsuario = sus.sus_usuarioId
            WHERE pag.pag_situacion = \'R\' AND pag.pag_idPago < ?
            ORDER BY pag.pag_idPago DESC
            LIMIT ?';
        $resultado = $this->conexion->ejecutarConsulta($sqlListarPagosEnRevision, 'ii', $desde, $limite);
        return $resultado ? $resultado->fetch_all(MYSQLI_ASSOC) : [];
    }

    /** Devuelve la cadena data:image/... del comprobante o null si no hay pago o no tiene imagen. */
    public function obtenerComprobante(int $idPago): ?string
    {
        $sqlObtenerComprobante = 'SELECT pag_imagen FROM spsu_pagos WHERE pag_idPago = ?';
        $fila = $this->conexion->ejecutarConsultaSimpleFila($sqlObtenerComprobante, 'i', $idPago);
        $imagen = $fila['pag_imagen'] ?? null;
        if (!is_string($imagen) || in_array($imagen, ['', '--'], true)) {
            return null;
        }
        return $imagen;
    }

    /**
     * Une pago, suscripción, combinación, intervalo, plan y dueño. Con $bloquear toma primero el bloqueo
     * de la fila del pago y lee después el resto sin bloqueo, para no bloquear filas del catálogo compartido.
     */
    public function obtenerPagoParaValidar(int $idPago, bool $bloquear): ?array
    {
        if ($bloquear) {
            $sqlBloquearPago = 'SELECT pag_idPago FROM spsu_pagos WHERE pag_idPago = ? FOR UPDATE';
            if ($this->conexion->ejecutarConsultaSimpleFila($sqlBloquearPago, 'i', $idPago) === null) {
                return null;
            }
        }
        $sqlPagoParaValidar = 'SELECT pag.pag_idPago, pag.pag_susIdSuscri, pag.pag_monto, pag.pag_situacion,
            pag.pag_fechaPago, ' . self::SQL_TIENE_COMPROBANTE . ' AS tieneComprobante,
            sus.sus_usuarioId, sus.sus_pinIdPlanin, sus.sus_situacion, sus.sus_fechainicio, sus.sus_fechaFin,
            sus.sus_proximoPago, sus.sus_renovAutomatica, plin.pin_precioFinal, ins.ins_numMeses,
            pla.pla_horasDuracion, pla.pla_nombre, usu.usu_estado, usu.usu_situacion
            FROM spsu_pagos pag
            INNER JOIN spsu_suscripcion sus ON sus.sis_idSuscrip = pag.pag_susIdSuscri
            INNER JOIN spsu_planintervalo plin ON plin.pin_idPlanInterv = sus.sus_pinIdPlanin
            INNER JOIN spsu_intervalosuscr ins ON ins.ins_idInterSuscrip = plin.pins_idInterSuscrip
            INNER JOIN spsu_planes pla ON pla.pla_idPlan = plin.pin_plaIdPlan
            INNER JOIN sgen_usuario usu ON usu.usu_idUsuario = sus.sus_usuarioId
            WHERE pag.pag_idPago = ?';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlPagoParaValidar, 'i', $idPago);
    }

    /**
     * Pasa el pago de R a C. Solo con $desde y $hasta (pago anticipado) reescribe el periodo pagado, a las 00:00:00.
     * Devuelve las filas afectadas: 0 si el pago ya no estaba en revisión.
     */
    public function marcarPagoConfirmado(int $idPago, ?string $desde = null, ?string $hasta = null): int
    {
        if ($desde === null || $hasta === null) {
            $sqlConfirmarPago = 'UPDATE spsu_pagos SET pag_situacion = \'C\', pag_montoConfirmado = pag_monto
                WHERE pag_idPago = ? AND pag_situacion = \'R\'';
            return $this->conexion->ejecutarActualizacion($sqlConfirmarPago, 'i', $idPago);
        }
        $sqlConfirmarPagoAnticipado = 'UPDATE spsu_pagos
            SET pag_situacion = \'C\', pag_montoConfirmado = pag_monto, pag_pagoDesde = ?, pag_pagoHasta = ?
            WHERE pag_idPago = ? AND pag_situacion = \'R\'';
        return $this->conexion->ejecutarActualizacion(
            $sqlConfirmarPagoAnticipado,
            'ssi',
            $desde . ' 00:00:00',
            $hasta . ' 00:00:00',
            $idPago
        );
    }

    public function marcarPagoRechazado(int $idPago): int
    {
        $sqlRechazarPago = 'UPDATE spsu_pagos SET pag_situacion = \'F\'
            WHERE pag_idPago = ? AND pag_situacion = \'R\'';
        return $this->conexion->ejecutarActualizacion($sqlRechazarPago, 'i', $idPago);
    }

    public function existePagoEnRevision(int $idSuscripcion): bool
    {
        $sqlExistePagoEnRevision = 'SELECT 1 FROM spsu_pagos
            WHERE pag_susIdSuscri = ? AND pag_situacion = \'R\' LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlExistePagoEnRevision, 'i', $idSuscripcion) !== null;
    }

    public function existePagoConfirmado(int $idSuscripcion): bool
    {
        $sqlExistePagoConfirmado = 'SELECT 1 FROM spsu_pagos
            WHERE pag_susIdSuscri = ? AND pag_situacion = \'C\' LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlExistePagoConfirmado, 'i', $idSuscripcion) !== null;
    }

    /** Último pago de la suscripción del usuario, sin la imagen ni datos sensibles. */
    public function obtenerUltimoPagoDeSuscripcion(int $idSuscripcion, int $idUsuario): ?array
    {
        $sqlUltimoPago = 'SELECT pag.pag_idPago, pag.pag_susIdSuscri AS sis_idSuscrip, pag.pag_situacion,
            pag.pag_fechaPago, pag.pag_monto, pag.pag_moneda, pag.pag_metodoPago, pla.pla_nombre, ins.ins_nombre,
            ' . self::SQL_TIENE_COMPROBANTE . ' AS tieneComprobante
            FROM spsu_pagos pag
            INNER JOIN spsu_suscripcion sus ON sus.sis_idSuscrip = pag.pag_susIdSuscri
            INNER JOIN spsu_planintervalo plin ON plin.pin_idPlanInterv = sus.sus_pinIdPlanin
            INNER JOIN spsu_intervalosuscr ins ON ins.ins_idInterSuscrip = plin.pins_idInterSuscrip
            INNER JOIN spsu_planes pla ON pla.pla_idPlan = plin.pin_plaIdPlan
            WHERE pag.pag_susIdSuscri = ? AND sus.sus_usuarioId = ?
            ORDER BY pag.pag_idPago DESC LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlUltimoPago, 'ii', $idSuscripcion, $idUsuario);
    }

    public function obtenerPagosPendientesVerificacion(int $idUsuario)
    {
        $sqlObtenerPagos = "SELECT pago.*
            FROM spsu_suscripcion susc
            INNER JOIN spsu_pagos pago ON susc.sis_idSuscrip = pago.pag_susIdSuscri
            WHERE susc.sus_usuarioId = ? AND susc.sus_situacion = 'P'
            AND pago.pag_situacion IN ('R', 'C')
            ORDER BY pago.pag_fechaPago DESC";
        return $this->conexion->ejecutarConsulta($sqlObtenerPagos, 'i', $idUsuario);
    }
}
