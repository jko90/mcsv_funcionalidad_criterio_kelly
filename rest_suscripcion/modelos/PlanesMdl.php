<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class PlanesMdl
{
    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function obtenerPlanesDisponibles()
    {
        $sql = "SELECT plin.pin_idPlanInterv, plin.pin_precioFinal, inp.ins_nombre, inp.ins_numMeses,
                inp.ins_x100descuen, pla.pla_nombre, pla.pla_descripcion, pla.pla_precioBase,
                pla.pla_moneda, pla.pla_numCuentas, pla.pla_diasHistorial, pla.pla_diasTotales,
                pla.pla_bloqueoDias, pla.pla_puedeDescargar, pla.pla_rangoLibre, pla.pla_puedeGraficar,
                pla.pla_divisorEditable, pla.pla_maxOperacionesDiarias
                FROM spsu_planintervalo plin
                INNER JOIN spsu_planes pla ON plin.pin_plaIdPlan = pla.pla_idPlan
                INNER JOIN spsu_intervalosuscr inp ON plin.pins_idInterSuscrip = inp.ins_idInterSuscrip
                WHERE plin.pin_estado = '1'
                AND NOT (pla.pla_horasDuracion IS NOT NULL AND pla.pla_planSiguienteId IS NOT NULL)";
        return $this->conexion->ejecutarConsulta($sql);
    }

    public function obtenerPlanIntervaloActivo(int $idPlanIntervalo): ?array
    {
        $sqlObtenerPlan = "SELECT plin.pin_idPlanInterv, plin.pin_precioFinal, inp.ins_numMeses,
            pla.pla_idPlan, pla.pla_nombre, pla.pla_precioBase, pla.pla_horasDuracion, pla.pla_planSiguienteId
            FROM spsu_planintervalo plin
            INNER JOIN spsu_intervalosuscr inp ON plin.pins_idInterSuscrip = inp.ins_idInterSuscrip
            INNER JOIN spsu_planes pla ON plin.pin_plaIdPlan = pla.pla_idPlan
            WHERE plin.pin_idPlanInterv = ? AND plin.pin_estado = '1'";
        return $this->conexion->ejecutarConsultaSimpleFila($sqlObtenerPlan, 'i', $idPlanIntervalo);
    }

    /** Combinación activa del plan de prueba, hallado por datos (duración y plan siguiente no nulos). */
    public function obtenerCombinacionDePrueba(): ?array
    {
        $sqlCombinacionPrueba = "SELECT plin.pin_idPlanInterv, pla.pla_idPlan, pla.pla_horasDuracion, pla.pla_planSiguienteId
            FROM spsu_planintervalo plin
            INNER JOIN spsu_planes pla ON plin.pin_plaIdPlan = pla.pla_idPlan
            WHERE pla.pla_horasDuracion IS NOT NULL AND pla.pla_planSiguienteId IS NOT NULL
            AND pla.pla_estado = '1' AND plin.pin_estado = '1'
            ORDER BY plin.pin_idPlanInterv ASC LIMIT 1";
        return $this->conexion->ejecutarConsultaSimpleFila($sqlCombinacionPrueba);
    }

    /** Combinación activa de menor id del plan indicado (D-11). */
    public function obtenerCombinacionDelPlanSiguiente(int $idPlan): ?array
    {
        $sqlCombinacionSiguiente = "SELECT plin.pin_idPlanInterv, pla.pla_idPlan, pla.pla_horasDuracion
            FROM spsu_planintervalo plin
            INNER JOIN spsu_planes pla ON plin.pin_plaIdPlan = pla.pla_idPlan
            WHERE pla.pla_idPlan = ? AND plin.pin_estado = '1'
            ORDER BY plin.pin_idPlanInterv ASC LIMIT 1";
        return $this->conexion->ejecutarConsultaSimpleFila($sqlCombinacionSiguiente, 'i', $idPlan);
    }

    public function obtenerPlanPorId(int $idPlan): ?array
    {
        $sqlPlanPorId = "SELECT pla_idPlan, pla_nombre, pla_precioBase, pla_horasDuracion, pla_planSiguienteId,
            pla_numCuentas, pla_diasHistorial, pla_diasTotales, pla_bloqueoDias, pla_puedeDescargar,
            pla_rangoLibre, pla_puedeGraficar, pla_divisorEditable, pla_maxOperacionesDiarias
            FROM spsu_planes WHERE pla_idPlan = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sqlPlanPorId, 'i', $idPlan);
    }

    public function obtenerPlanesSuscriptosSinPagar(int $idUsuario)
    {
        $sqlObtenerPlanes = "SELECT plin.pin_idPlanInterv, plin.pin_precioFinal, inp.ins_nombre,
                inp.ins_numMeses, inp.ins_x100descuen, pla.pla_nombre, pla.pla_descripcion,
                pla.pla_precioBase, pla.pla_moneda, pla.pla_numCuentas, susc.sis_idSuscrip,
                susc.sus_fechaCrea, susc.sus_usuarioId, (pago.pag_monto - pago.pag_montoConfirmado) pag_saldo,
                pago.pag_situacion, pago.pag_montoConfirmado
                FROM spsu_suscripcion susc
                LEFT JOIN (
                    SELECT pag_susIdSuscri, pag_monto, pag_montoConfirmado, pag_situacion
                    FROM spsu_pagos
                    WHERE pag_situacion IN ('R', 'C', 'D')
                ) pago ON susc.sis_idSuscrip = pago.pag_susIdSuscri
                INNER JOIN spsu_planintervalo plin ON susc.sus_pinIdPlanin = plin.pin_idPlanInterv
                INNER JOIN spsu_planes pla ON plin.pin_plaIdPlan = pla.pla_idPlan
                INNER JOIN spsu_intervalosuscr inp ON plin.pins_idInterSuscrip = inp.ins_idInterSuscrip
                WHERE plin.pin_estado = '1' AND susc.sus_usuarioId = ?
                AND susc.sus_situacion = 'P'
                AND (susc.sus_referenPago IS NULL OR susc.sus_referenPago = '')";
        return $this->conexion->ejecutarConsulta($sqlObtenerPlanes, 'i', $idUsuario);
    }
}
