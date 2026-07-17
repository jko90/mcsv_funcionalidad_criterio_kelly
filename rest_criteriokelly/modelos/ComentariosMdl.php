<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class ComentariosMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function validarObservacion($obsTipoObserva, $idBitacora)
    {
        $sql = "SELECT * FROM scko_observacion WHERE obs_bitIdbitaco = ? AND obs_tipoObserva = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "is", $idBitacora, $obsTipoObserva);
    }

    public function sobreEscribirObservacion($idBitacora, $obsTipoObserva, $obsComentario, $obsImagen)
    {
        $sql = "UPDATE scko_observacion SET obs_comentario = ?, obs_imagen = ? WHERE obs_bitIdbitaco = ? AND obs_tipoObserva = ?";
        return $this->conexion->ejecutarActualizacion($sql, "ssis", $obsComentario, $obsImagen, $idBitacora, $obsTipoObserva);
    }

        public function crearComentariosPorBitacora($idBitacora, $obsComentario, $obsTipoObserva, $obsImagen)
    {
        $sqlObservacion = "INSERT INTO scko_observacion (obs_bitIdbitaco, obs_comentario, obs_tipoObserva, obs_imagen) VALUES (?, ?, ?, ?)";
        return $this->conexion->ejecutarInsercionRetornaID($sqlObservacion, "isss", $idBitacora, $obsComentario, $obsTipoObserva, $obsImagen);
    }


    public function actualizarBitacoraTPBESL($idBitacora, $precioEntra, $precioSL, $precioTP)
    {
        $sql = "UPDATE sckb_bitacora SET bit_precioEntra = ?, bit_precioSL = ?, bit_precioTP = ? WHERE bit_idbitacora = ?";
        return $this->conexion->ejecutarActualizacion($sql, "dddi", $precioEntra, $precioSL, $precioTP, $idBitacora);
    }

    public function actualizarObservacion($idObservacion, $obsComentario, $obsImagen)
    {
        $sql = "UPDATE scko_observacion SET obs_comentario = ?, obs_imagen = ? WHERE obs_idObserva = ?";
        return $this->conexion->ejecutarActualizacion($sql, "ssi", $obsComentario, $obsImagen, $idObservacion);
    }


    public function obtenerComentariosPorBitacora($idBitacora)
    {
        $sql = " SELECT * FROM scko_observacion WHERE obs_bitIdbitaco = ? ORDER BY obs_fecha DESC";
        return $this->conexion->ejecutarConsulta($sql, "i", $idBitacora);
    }
}
