<?php


include_once(__DIR__ . '/../configuracion/enlace.php');

class ValidacionMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function autenticarUsuario($usuario, $clave)
    {
        $sql = "SELECT u.usu_idUsuario, u.usu_clave, p.per_nombres,  p.per_apellidos 
                FROM sgen_usuario u
                INNER JOIN sgen_persona p ON u.usu_perIdPerso = p.per_idPersona  
                WHERE u.usu_usuario = ? AND u.usu_estado = '1' AND u.usu_situacion = 'A' ";
        $usuarioData = $this->conexion->ejecutarConsultaSimpleFila($sql, "s", $usuario);

        if ($usuarioData && password_verify($clave, $usuarioData['usu_clave'])) {
            return $usuarioData;
        }
        return null;
    }

    public function obtenerRolesUsuarios($idUsua)
    {
        $sql = "SELECT r.rol_id,  r.rol_descripcion 
                FROM sgen_rolusuario ru 
                INNER JOIN sgen_rol r ON ru.rus_rolId = r.rol_id 
                WHERE ru.rus_usuId = ? AND ru.rus_estado = '1'";
        return  $this->conexion->ejecutarConsulta($sql, "i", $idUsua);
    }

    public function actualizarCodigoRecuperacionUsuario($id, $codiorecupe)
    {
        $sql = "UPDATE sgen_usuario SET usu_codiorecupe = ? WHERE usu_idUsuario = ?";
        $result = $this->conexion->ejecutarActualizacion(
            $sql,
            "ii",
            $codiorecupe,
            $id
        );
        return $result !== false;
    }

    public function obtenerCodigoRecuperacionUsuario($usuario)
    {
        $sql = "SELECT usu_codiorecupe FROM sgen_usuario WHERE usu_usuario = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "s", $usuario);
    }

    public function actualizarClaveUsuario($id, $clave, $usuario)
    {
        $contraseniaEncriptada = password_hash($clave, PASSWORD_BCRYPT);
        $sql = "UPDATE sgen_usuario SET usu_clave = ? WHERE usu_idUsuario = ? AND usu_usuario = ?";
        $result = $this->conexion->ejecutarActualizacion(
            $sql,
            "sis",
            $contraseniaEncriptada,
            $id,
            $usuario
        );
        return $result !== false;
    }
}
