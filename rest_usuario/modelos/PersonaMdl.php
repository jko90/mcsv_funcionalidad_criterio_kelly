<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';
require_once __DIR__ . '/VerificacionMdl.php';

class PersonaMdl
{
    public const ROL_VISITANTE = 4;
    public const REGISTRO_CREADO = 'CREADO';
    public const REGISTRO_CORREO_EXISTENTE = 'CORREO_EXISTENTE';
    public const REGISTRO_DATOS_DUPLICADOS = 'DATOS_DUPLICADOS';

    private VerificacionMdl $verificacionModelo;

    public function __construct(private Enlace $conexion)
    {
        $this->verificacionModelo = new VerificacionMdl($conexion);
    }

    public function actualizarPersonaNombresTelf(
        int $idUsuario,
        string $nombres,
        string $apellidos,
        string $telefono
    ): int {
        $sqlActualizarPersona = "UPDATE sgen_persona p
            INNER JOIN sgen_usuario u ON u.usu_perIdPerso = p.per_idPersona
            SET p.per_nombres = ?, p.per_apellidos = ?, p.per_telefono = ?
            WHERE u.usu_idUsuario = ? AND u.usu_estado = '1' AND u.usu_situacion = 'A'
                AND p.per_estado = '1' AND p.per_situacion = 'A'";
        return $this->conexion->ejecutarActualizacion(
            $sqlActualizarPersona,
            'sssi',
            $nombres,
            $apellidos,
            $telefono,
            $idUsuario
        );
    }

    public function registrarPersona(
        ?string $cedula,
        string $nombres,
        string $apellidos,
        string $correo,
        string $telefono,
        string $usuario,
        string $hashClave,
        string $hashCodigo,
        string $ip,
        ?string $agente
    ): array {
        try {
            $this->conexion->iniciarTransaccion();
            $sqlDuplicadoUsuarioTelefono = "SELECT u.usu_idUsuario
                FROM sgen_usuario u
                INNER JOIN sgen_persona p ON p.per_idPersona = u.usu_perIdPerso
                WHERE (u.usu_usuario = ? OR p.per_telefono = ?)
                    AND u.usu_estado = '1' AND p.per_estado = '1'
                LIMIT 1 FOR UPDATE";
            if ($this->conexion->ejecutarConsultaSimpleFila(
                $sqlDuplicadoUsuarioTelefono,
                'ss',
                $usuario,
                $telefono
            ) !== null) {
                $this->conexion->revertirTransaccion();
                return ['resultado' => self::REGISTRO_DATOS_DUPLICADOS, 'idUsuario' => null];
            }

            $sqlCorreoExistente = "SELECT p.per_idPersona
                FROM sgen_persona p
                WHERE p.per_correo = ? AND p.per_estado = '1' LIMIT 1 FOR UPDATE";
            if ($this->conexion->ejecutarConsultaSimpleFila($sqlCorreoExistente, 's', $correo) !== null) {
                $this->conexion->revertirTransaccion();
                return ['resultado' => self::REGISTRO_CORREO_EXISTENTE, 'idUsuario' => null];
            }

            if ($cedula !== null) {
                $cedulaNormalizada = preg_replace('/[ .\-]/', '', trim($cedula));
                $sqlCedulaExistente = "SELECT p.per_idPersona
                    FROM sgen_persona p
                    WHERE REPLACE(REPLACE(REPLACE(TRIM(p.per_cedula), ' ', ''), '-', ''), '.', '') = ?
                        AND p.per_estado = '1' LIMIT 1 FOR UPDATE";
                if ($cedulaNormalizada !== '' && $this->conexion->ejecutarConsultaSimpleFila(
                    $sqlCedulaExistente,
                    's',
                    $cedulaNormalizada
                ) !== null) {
                    $this->conexion->revertirTransaccion();
                    return ['resultado' => self::REGISTRO_DATOS_DUPLICADOS, 'idUsuario' => null];
                }
            }

            $sqlInsertarPersona = 'INSERT INTO sgen_persona
                (per_cedula, per_nombres, per_apellidos, per_correo, per_telefono)
                VALUES (?, ?, ?, ?, ?)';
            $idPersona = $this->conexion->ejecutarInsercionRetornaID(
                $sqlInsertarPersona,
                'sssss',
                $cedula,
                $nombres,
                $apellidos,
                $correo,
                $telefono
            );
            $sqlInsertarUsuario = 'INSERT INTO sgen_usuario (usu_perIdPerso, usu_usuario, usu_clave)
                VALUES (?, ?, ?)';
            $idUsuario = $this->conexion->ejecutarInsercionRetornaID(
                $sqlInsertarUsuario,
                'iss',
                $idPersona,
                $usuario,
                $hashClave
            );
            $sqlInsertarRol = 'INSERT INTO sgen_rolusuario (rus_usuId, rus_rolId) VALUES (?, ?)';
            $this->conexion->ejecutarInsercionRetornaID(
                $sqlInsertarRol,
                'ii',
                $idUsuario,
                self::ROL_VISITANTE
            );
            $this->verificacionModelo->insertarCodigoEnTransaccion($idUsuario, $hashCodigo, $ip, $agente);
            $this->conexion->confirmarTransaccion();
            return ['resultado' => self::REGISTRO_CREADO, 'idUsuario' => $idUsuario];
        } catch (Throwable $error) {
            $this->conexion->revertirTransaccion();
            if ($error instanceof mysqli_sql_exception && $error->getCode() === 1062) {
                return ['resultado' => self::REGISTRO_DATOS_DUPLICADOS, 'idUsuario' => null];
            }
            throw $error;
        }
    }
}
