<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class PagosMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function insertarPagoSuscripcion($idSuscripcionDB, $montoPago, $fechaActual, $metodoPago, $idTransaccion, $fechaDesde, $fechaFinPago, $comprobante, $correoTransaccion, $criptomoneda)
    {
        $sql = "INSERT INTO spsu_pagos(pag_susIdSuscri, pag_monto, pag_fechaPago, pag_metodoPago, pag_idTransac, pag_pagoDesde, pag_pagoHasta, pag_imagen,  pag_correo, pag_tipocripto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        return $this->conexion->ejecutarInsercionRetornaID($sql, 'idssssssss', $idSuscripcionDB, $montoPago, $fechaActual, $metodoPago, $idTransaccion, $fechaDesde, $fechaFinPago, $comprobante, $correoTransaccion, $criptomoneda);
    }

    /** Validacion del where para validar pagos */
    public function obtenerPagosPendientesVerificacion($idUsuario)
    {
        $sql = "SELECT pago.* FROM spsu_suscripcion susc
                INNER JOIN spsu_pagos pago ON susc.sis_idSuscrip = pago.pag_susIdSuscri
                WHERE susc.sus_usuarioId = ? AND susc.sus_situacion = 'P' AND pago.pag_situacion IN ('R', 'C') ORDER BY pago.pag_fechaPago DESC";
        return $this->conexion->ejecutarConsulta($sql, 'i', $idUsuario);
    }
}
