<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class CategoriaMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function listaCategorias()
    {
        $sql = "SELECT id, nombre, descripcion, estado FROM categoria ORDER BY nombre";
        return $this->conexion->ejecutarConsulta($sql);
    }

    public function obtenerCategoria($id)
    {
        $sql = "SELECT id, nombre, descripcion, estado FROM categoria WHERE id = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $id);
    }

    public function agregarCategoria($data)
    {
        $sql = "INSERT INTO categoria (nombre, descripcion, estado) VALUES (?, ?, ?)";
        return $this->conexion->ejecutarConsultaRetornarID(
            $sql,
            "ssi",
            $data['nombre'],
            $data['descripcion'],
            $data['estado']
        );
    }

    public function actualizarCategoria($id, $data)
    {
        $sql = "UPDATE categoria SET nombre = ?, descripcion = ?, estado = ? WHERE id = ?";
        $result = $this->conexion->ejecutarActualizacion(
            $sql,
            "ssii",
            $data['nombre'],
            $data['descripcion'],
            $data['estado'],
            $id
        );
        return $result !== false;
    }

    public function eliminarCategoria($id)
    {
        $sql = "DELETE FROM categoria WHERE id = ?";
        $result = $this->conexion->ejecutarConsulta($sql, "i", $id);
        return $result !== false;
    }

    public function existeCategoria($id)
    {
        $sql = "SELECT COUNT(*) as count FROM categoria WHERE id = ?";
        $result = $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $id);
        return $result && $result['count'] > 0;
    }
}
