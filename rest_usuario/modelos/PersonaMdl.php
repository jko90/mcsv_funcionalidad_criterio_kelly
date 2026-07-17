<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class PersonaMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function actualizarPersonaNombresTelf($idUsuario, $nombres, $apellidos, $telefono)
    {
        $sql = "UPDATE sgen_persona SET per_nombres = ?, per_apellidos = ?, per_telefono = ? WHERE per_idPersona = (SELECT usu_perIdPerso FROM sgen_usuario WHERE usu_idUsuario = ? AND usu_estado = '1' AND usu_situacion = 'A')";
        return $this->conexion->ejecutarActualizacion(
            $sql,
            "sssi",
            $nombres,
            $apellidos,
            $telefono,
            $idUsuario
        );
    }

    /**
     * Agregar persona completa con usuario y rol
     * @param string $cedula Cédula de la persona
     * @param string $nombres Nombres de la persona
     * @param string $apellidos Apellidos de la persona
     * @param string $correo Correo electrónico
     * @param string $telefono Teléfono de la persona
     * @param string $usuario Nombre de usuario
     * @param string $clave Contraseña del usuario
     * @return array|false Datos completos o false si falla
     */
    public function agregarPersona($cedula, $nombres, $apellidos, $correo, $telefono, $usuario, $clave)
    {
        try {

            if ($this->verificarDuplicados($usuario, $correo, $telefono)) {
                return "El usuario, correo o teléfono ya están en uso.";
            }

            $sqlPersona = "INSERT INTO sgen_persona (per_cedula, per_nombres, per_apellidos, per_correo, per_telefono) VALUES (?, ?, ?, ?, ?)";
            $idPersona = $this->conexion->ejecutarConsultaRetornarID(
                $sqlPersona,
                "sssss",
                $cedula,
                $nombres,
                $apellidos,
                $correo,
                $telefono
            );

            if (!$idPersona) {
                return false;
            }

            // 2. Hashear la contraseña
            $claveHasheada = password_hash($clave, PASSWORD_DEFAULT);

            $sqlUsuario = "INSERT INTO sgen_usuario (usu_perIdPerso, usu_usuario, usu_clave) VALUES (?, ?, ?)";
            $idUsuario = $this->conexion->ejecutarConsultaRetornarID(
                $sqlUsuario,
                "iss",
                $idPersona,
                $usuario,
                $claveHasheada
            );

            if (!$idUsuario) {
                $this->eliminarPersona($idPersona);
                return false;
            }

            // 4. Asignar rol (ID = 4)
            $sqlRol = "INSERT INTO sgen_rolusuario (rus_usuId, rus_rolId) VALUES (?, 4)";
            $idRolUsuario = $this->conexion->ejecutarConsultaRetornarID(
                $sqlRol,
                "i",
                $idUsuario
            );

            if (!$idRolUsuario) {
                $this->eliminarUsuario($idUsuario);
                $this->eliminarPersona($idPersona);
                return false;
            }
            return $idUsuario;
        } catch (Exception $e) {

            // Limpiar datos si se crearon parcialmente
            if (isset($idUsuario) && $idUsuario) {
                $this->eliminarUsuario($idUsuario);
            }
            if (isset($idPersona) && $idPersona) {
                $this->eliminarPersona($idPersona);
            }

            return "Error al generar el registro: " . $e->getMessage();
        }
    }


    /**
     * Verificar si ya existe usuario o correo
     * @param string $usuario Nombre de usuario
     * @param string $correo Correo electrónico
     * @return bool true si existe, false si no
     */
    public function verificarDuplicados($usuario, $correo, $telefono)
    {
        // Verificar si ya existe un usuario o correo
        $sql = "
            SELECT COUNT(*) as total 
            FROM sgen_persona p 
            LEFT JOIN sgen_usuario u ON p.per_idPersona = u.usu_perIdPerso 
            WHERE p.per_correo = ? OR u.usu_usuario = ? OR p.per_telefono = ? ";

        $result = $this->conexion->ejecutarConsultaSimpleFila($sql, "sss", $correo, $usuario, $telefono);

        if ($result && is_array($result)) {
            return (int)$result['total'] > 0;
        }

        return false;
    }

    /**
     * Eliminar persona (marcar como eliminada)
     * @param int $idPersona ID de la persona
     * @return bool
     */
    private function eliminarPersona($idPersona)
    {
        $sql = "UPDATE sgen_persona SET per_estado = '0' WHERE per_idPersona = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idPersona);
    }

    /**
     * Eliminar usuario (marcar como eliminado)
     * @param int $idUsuario ID del usuario
     * @return bool
     */
    private function eliminarUsuario($idUsuario)
    {
        $sql = "UPDATE sgen_usuario SET usu_estado = '0' WHERE usu_idUsuario = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idUsuario);
    }


    /**
     * Obtener persona por ID
     * @param int $idPersona ID de la persona
     * @return array|false Datos de la persona o false si no existe
     */

    public function obtenerPersonaPorCorreo($correo)
    {
        $sql = "SELECT * FROM sgen_persona WHERE per_correo = ? AND per_estado = '1'";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "s", $correo);
    }
}
