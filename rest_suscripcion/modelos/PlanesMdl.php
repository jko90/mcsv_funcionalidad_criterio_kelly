<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class PlanesMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function obtenerPlanesDisponibles()
    {
        $sql = "SELECT plin.pin_idPlanInterv, plin.pin_precioFinal, inp.ins_nombre, inp.ins_numMeses, inp.ins_x100descuen, pla.pla_nombre, pla.pla_descripcion, pla.pla_precioBase, pla.pla_moneda, pla.pla_numCuentas
                FROM spsu_planintervalo plin INNER JOIN spsu_planes pla ON plin.pin_plaIdPlan = pla.pla_idPlan INNER JOIN spsu_intervalosuscr inp ON PLIN.pins_idInterSuscrip = inp.ins_idInterSuscrip
                WHERE plin.pin_estado = '1'";
        return $this->conexion->ejecutarConsulta($sql);
    }

    /** Obtener suscripcion ya registrada pero sin pagar */
    public function obtenerPlanesSuscriptosSinPagar($idUsuario)
    {
        $sql = "SELECT  plin.pin_idPlanInterv, plin.pin_precioFinal, inp.ins_nombre, inp.ins_numMeses, inp.ins_x100descuen, pla.pla_nombre, pla.pla_descripcion, pla.pla_precioBase, pla.pla_moneda, pla.pla_numCuentas, 
                susc.sis_idSuscrip, susc.sus_fechaCrea, susc.sus_usuarioId, (pago.pag_monto - pago.pag_montoConfirmado) pag_saldo, pago.pag_situacion, pago.pag_montoConfirmado
                FROM spsu_suscripcion susc 
                LEFT JOIN (SELECT * FROM spsu_pagos WHERE pag_situacion IN ('R', 'C', 'D')) pago ON susc.sis_idSuscrip = pago.pag_susIdSuscri
                INNER JOIN spsu_planintervalo plin  ON susc.sus_pinIdPlanin = plin.pin_idPlanInterv
                INNER JOIN spsu_planes pla ON plin.pin_plaIdPlan = pla.pla_idPlan 
                INNER JOIN spsu_intervalosuscr inp ON PLIN.pins_idInterSuscrip = inp.ins_idInterSuscrip
                WHERE plin.pin_estado = '1' AND susc.sus_usuarioId = ? AND susc.sus_situacion = 'P' AND (susc.sus_referenPago IS NULL OR susc.sus_referenPago = '')";
        return $this->conexion->ejecutarConsulta($sql, 'i', $idUsuario);
    }
}
