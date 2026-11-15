<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class ValidacionMdl
{
    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function buscarUsuarioParaAutenticar(string $usuario): ?array
    {
        $sqlBuscarUsuario = "SELECT u.usu_idUsuario, u.usu_clave, u.usu_situacion,
            p.per_nombres, p.per_apellidos
            FROM sgen_usuario u INNER JOIN sgen_persona p ON u.usu_perIdPerso = p.per_idPersona
            WHERE u.usu_usuario = ? AND u.usu_estado = '1' LIMIT 1";
        return $this->conexion->ejecutarConsultaSimpleFila($sqlBuscarUsuario, 's', $usuario);
    }

    public function actualizarHashClave(int $idUsuario, string $hash): void
    {
        $sqlActualizarClave = 'UPDATE sgen_usuario SET usu_clave = ? WHERE usu_idUsuario = ?';
        $this->conexion->ejecutarActualizacion($sqlActualizarClave, 'si', $hash, $idUsuario);
    }

    public function obtenerUsuarioActivoPorId(int $idUsuario): ?array
    {
        $sqlBuscarUsuario = "SELECT u.usu_idUsuario, p.per_nombres, p.per_apellidos
            FROM sgen_usuario u INNER JOIN sgen_persona p ON u.usu_perIdPerso = p.per_idPersona
            WHERE u.usu_idUsuario = ? AND u.usu_estado = '1' AND u.usu_situacion = 'A' LIMIT 1";
        return $this->conexion->ejecutarConsultaSimpleFila($sqlBuscarUsuario, 'i', $idUsuario);
    }

    public function obtenerRolesUsuarios(int $idUsuario): mysqli_result
    {
        $sqlObtenerRoles = "SELECT r.rol_id, r.rol_descripcion
            FROM sgen_rolusuario ru INNER JOIN sgen_rol r ON ru.rus_rolId = r.rol_id
            WHERE ru.rus_usuId = ? AND ru.rus_estado = '1' ORDER BY r.rol_id";
        return $this->conexion->ejecutarConsulta($sqlObtenerRoles, 'i', $idUsuario);
    }

}
