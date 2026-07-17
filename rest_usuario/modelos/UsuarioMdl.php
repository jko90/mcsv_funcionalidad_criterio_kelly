<?php


include_once(__DIR__ . '/../configuracion/enlace.php');

class UsuarioMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function listaUsuarios()
    {
        $sql = "SELECT usu.usu_idUsuario, CONCAT(per.per_nombres, ' ', per.per_apellidos) AS nombre_completo,
                per.per_telefono, per.per_correo, per.per_situacion, per.per_estado, 
                usu.usu_perIdPerso, usu.usu_usuario, usu.usu_situacion, usu.usu_estado 
                FROM sgen_usuario usu 
                INNER JOIN sgen_persona per ON usu.usu_perIdPerso = per.per_idPersona 
                ORDER BY usu.usu_usuario;";
        return $this->conexion->ejecutarConsulta($sql);
    }

    public function obtenerUsuario($id)
    {
        $sql = "SELECT per.per_nombres, per.per_apellidos, usu.usu_perIdPerso, usu.usu_usuario
                FROM sgen_usuario usu 
                INNER JOIN sgen_persona per ON usu.usu_perIdPerso = per.per_idPersona
                WHERE usu.usu_estado = '1' AND usu.usu_situacion = 'A' AND usu_idUsuario = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $id);
    }

    public function agregarUsuario($data)
    {
        $sql = "INSERT INTO sgen_usuario (usu_perIdPerso, usu_usuario, usu_clave) VALUES (?, ?, ?)";
        return $this->conexion->ejecutarConsultaRetornarID(
            $sql,
            "iss",
            $data['usu_perIdPerso'],
            $data['usu_usuario'],
            password_hash($data['usu_clave'], PASSWORD_BCRYPT)
        );
    }


    public function eliminarUsuario($id)
    {
        $sql = "UPDATE sgen_usuario SET usu_situacion = 'E' WHERE usu_idUsuario = ?";
        $result = $this->conexion->ejecutarActualizacion($sql, "i", $id);
        return $result !== false;
    }

    public function existeUsuario($id)
    {
        $sql = "SELECT COUNT(*) as count FROM sgen_usuario WHERE usu_idUsuario = ?";
        $result = $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $id);
        return $result && $result['count'] > 0;
    }

    public function existeUsuarioPorNombre($usuario)
    {
        $sql = "SELECT COUNT(*) as count FROM sgen_usuario WHERE usu_usuario = ?";
        $result = $this->conexion->ejecutarConsultaSimpleFila($sql, "s", $usuario);
        return $result && $result['count'] > 0;
    }
}
