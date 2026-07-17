<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class SuscripcionMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function obtenerSuscripcionPorID($idSuscripcion)
    {
        $sql = "SELECT * FROM spsu_suscripcion WHERE sis_idSuscrip = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, 'i', $idSuscripcion);
    }

    public function obtenerSuscripcionPorUsuario($idUsuario)
    {
        $sql = "SELECT * FROM spsu_suscripcion
                WHERE sus_usuarioId = ? AND sus_situacion = 'P' AND sus_referenPago IS NULL AND sus_fechainicio IS NOT NULL AND sus_fechaFin IS NOT NULL AND CURRENT_DATE BETWEEN sus_fechainicio AND sus_fechaFin";
        return $this->conexion->ejecutarConsulta($sql, 'i', $idUsuario);
    }

    public function obtenerSuscripcionPorIDUsuario($idPlan, $idUsuario, $idSuscripcion)
    {
        $sql = "SELECT * FROM spsu_suscripcion
                WHERE sis_idSuscrip = ? OR (sus_usuarioId = ? AND sus_pinIdPlanin = ? AND sus_situacion = 'P' AND sus_referenPago IS NULL AND sus_proximoPago IS NULL) AND CURRENT_DATE BETWEEN sus_fechainicio AND sus_fechaFin";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, 'iii', $idSuscripcion, $idUsuario, $idPlan);
    }

    public function insertarSuscripcionSinPago($usuarioId, $planId, $fechaActual, $fechaFinPago)
    {
        $sql = "INSERT INTO spsu_suscripcion(sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaCrea) VALUES (?,?,?,?,?)";
        return $this->conexion->ejecutarInsercionRetornaID($sql, 'iisss', $usuarioId, $planId, $fechaActual, $fechaFinPago, $fechaActual);
    }

    public function actualizarSuscripcionSinPago($idSuscripcion, $fechaActual, $fechaFinPago){
            $sql = "UPDATE spsu_suscripcion SET sus_fechainicio = ?, sus_fechaFin = ? WHERE sis_idSuscrip = ?";
            return $this->conexion->ejecutarActualizacion($sql, 'ssi', $fechaActual, $fechaFinPago, $idSuscripcion);
    }



    public function actualizarRangoFechaConPago($idSuscripcion, $fechaActual, $fechaFinPago, $refPago, $proximoPago){
        $sql = "UPDATE spsu_suscripcion SET sus_fechainicio = ?, sus_fechaFin = ?, sus_referenPago = ?, sus_proximoPago = ? WHERE sis_idSuscrip = ?";
        return $this->conexion->ejecutarActualizacion($sql, 'ssssi', $fechaActual, $fechaFinPago, $refPago, $proximoPago, $idSuscripcion);
    }

    public function insertarSuscripcionConPago($usuarioId, $planId, $fechaActual, $fechaFinPago, $referenciaPago, $proximoPago)
    {
        $sql = "INSERT INTO spsu_suscripcion(sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaCrea, sus_referenPago, sus_proximoPago) VALUES (?,?,?,?,?,?,?)";
        return $this->conexion->ejecutarInsercionRetornaID($sql, 'iisssss', $usuarioId, $planId, $fechaActual, $fechaFinPago, $fechaActual, $referenciaPago, $proximoPago);
    }

}
