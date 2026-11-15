<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class ClaveMdl
{
    public const MAXIMO_SOLICITUDES_HORA = 3;
    public const MAXIMO_SOLICITUDES_DIA = 10;
    public const MAXIMO_INTENTOS = 5;
    public const MINUTOS_VIGENCIA = 15;

    public function __construct(private Enlace $conexion)
    {
    }

    public function buscarUsuarioPorCorreo(string $correo): array
    {
        $sqlBuscarUsuario = 'SELECT u.usu_idUsuario, u.usu_usuario, u.usu_clave,
                p.per_nombres, p.per_correo
            FROM sgen_usuario u
            INNER JOIN sgen_persona p ON p.per_idPersona = u.usu_perIdPerso
            WHERE p.per_correo = ? AND p.per_estado = "1" AND p.per_situacion = "A"
                AND u.usu_estado = "1" AND u.usu_situacion = "A"
            LIMIT 2';
        $resultado = $this->conexion->ejecutarConsulta($sqlBuscarUsuario, 's', $correo);
        $usuarios = [];
        while ($fila = $resultado->fetch_assoc()) {
            $usuarios[] = $fila;
        }

        return $usuarios;
    }

    public function registrarSolicitud(int $idUsuario, string $hashCodigo, string $ip, ?string $agente): bool
    {
        try {
            $this->conexion->iniciarTransaccion();
            $sqlBloquearUsuario = 'SELECT usu_idUsuario FROM sgen_usuario WHERE usu_idUsuario = ? FOR UPDATE';
            $this->conexion->ejecutarConsultaSimpleFila($sqlBloquearUsuario, 'i', $idUsuario);
            $sqlContarSolicitudes = 'SELECT
                    SUM(rec_fechaCrea >= NOW() - INTERVAL 1 HOUR) AS solicitudesHora,
                    SUM(rec_fechaCrea >= NOW() - INTERVAL 1 DAY) AS solicitudesDia
                FROM sgen_recuperacion WHERE rec_usuId = ?';
            $conteo = $this->conexion->ejecutarConsultaSimpleFila($sqlContarSolicitudes, 'i', $idUsuario);
            if ((int) ($conteo['solicitudesHora'] ?? 0) >= self::MAXIMO_SOLICITUDES_HORA
                || (int) ($conteo['solicitudesDia'] ?? 0) >= self::MAXIMO_SOLICITUDES_DIA) {
                $this->conexion->confirmarTransaccion();
                return false;
            }

            $sqlReemplazarCodigos = "UPDATE sgen_recuperacion SET rec_situacion = 'R'
                WHERE rec_usuId = ? AND rec_situacion = 'A'";
            $this->conexion->ejecutarActualizacion($sqlReemplazarCodigos, 'i', $idUsuario);
            $sqlRegistrarSolicitud = 'INSERT INTO sgen_recuperacion
                (rec_usuId, rec_codigoHash, rec_fechaExpira, rec_ipSolicitud, rec_agenteSolicitud)
                VALUES (?, ?, NOW() + INTERVAL 15 MINUTE, ?, ?)';
            $this->conexion->ejecutarInsercionRetornaID(
                $sqlRegistrarSolicitud,
                'isss',
                $idUsuario,
                $hashCodigo,
                $ip,
                $agente
            );
            $this->conexion->confirmarTransaccion();
            return true;
        } catch (Throwable $error) {
            $this->conexion->revertirTransaccion();
            throw $error;
        }
    }

    public function buscarCodigoActivo(int $idUsuario): ?array
    {
        $sqlCodigoActivo = "SELECT rec_idRecuperacion, rec_codigoHash, rec_intentos
            FROM sgen_recuperacion
            WHERE rec_usuId = ? AND rec_situacion = 'A'
                AND rec_fechaExpira > NOW() AND rec_intentos < 5
            ORDER BY rec_idRecuperacion DESC LIMIT 1";
        return $this->conexion->ejecutarConsultaSimpleFila($sqlCodigoActivo, 'i', $idUsuario);
    }

    public function consumirIntento(int $idRecuperacion): bool
    {
        $sqlConsumirIntento = "UPDATE sgen_recuperacion
            SET rec_intentos = rec_intentos + 1
            WHERE rec_idRecuperacion = ? AND rec_situacion = 'A'
                AND rec_fechaExpira > NOW() AND rec_intentos < 5";
        return $this->conexion->ejecutarActualizacion($sqlConsumirIntento, 'i', $idRecuperacion) === 1;
    }

    public function restablecerClave(int $idUsuario, int $idRecuperacion, string $hashClave, string $ip): bool
    {
        try {
            $this->conexion->iniciarTransaccion();
            $sqlUsarCodigo = "UPDATE sgen_recuperacion SET rec_situacion = 'U',
                    rec_fechaUso = NOW(), rec_ipUso = ?
                WHERE rec_idRecuperacion = ? AND rec_usuId = ?
                    AND rec_situacion = 'A' AND rec_fechaExpira > NOW()
                    AND rec_intentos <= 5";
            if ($this->conexion->ejecutarActualizacion($sqlUsarCodigo, 'sii', $ip, $idRecuperacion, $idUsuario) !== 1) {
                $this->conexion->revertirTransaccion();
                return false;
            }
            $sqlActualizarClave = "UPDATE sgen_usuario SET usu_clave = ?
                WHERE usu_idUsuario = ? AND usu_estado = '1' AND usu_situacion = 'A'";
            if ($this->conexion->ejecutarActualizacion($sqlActualizarClave, 'si', $hashClave, $idUsuario) !== 1) {
                throw new RuntimeException('No se pudo actualizar la clave');
            }
            $this->invalidarCodigosActivos($idUsuario);
            $this->revocarSesiones($idUsuario, null);
            $this->conexion->confirmarTransaccion();
            return true;
        } catch (Throwable $error) {
            $this->conexion->revertirTransaccion();
            throw $error;
        }
    }

    public function obtenerUsuarioParaCambio(int $idUsuario): ?array
    {
        $sqlUsuario = 'SELECT u.usu_idUsuario, u.usu_usuario, u.usu_clave,
                p.per_correo, p.per_nombres
            FROM sgen_usuario u
            INNER JOIN sgen_persona p ON p.per_idPersona = u.usu_perIdPerso
            WHERE u.usu_idUsuario = ? AND u.usu_estado = "1" AND u.usu_situacion = "A"
                AND p.per_estado = "1" AND p.per_situacion = "A" LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlUsuario, 'i', $idUsuario);
    }

    public function cambiarClave(int $idUsuario, int $idSesionActual, string $hashClave): void
    {
        try {
            $this->conexion->iniciarTransaccion();
            $sqlActualizarClave = "UPDATE sgen_usuario SET usu_clave = ?
                WHERE usu_idUsuario = ? AND usu_estado = '1' AND usu_situacion = 'A'";
            if ($this->conexion->ejecutarActualizacion($sqlActualizarClave, 'si', $hashClave, $idUsuario) !== 1) {
                throw new RuntimeException('No se pudo actualizar la clave');
            }
            $this->invalidarCodigosActivos($idUsuario);
            $this->revocarSesiones($idUsuario, $idSesionActual);
            $this->conexion->confirmarTransaccion();
        } catch (Throwable $error) {
            $this->conexion->revertirTransaccion();
            throw $error;
        }
    }

    public function contarFallosRecientes(int $idUsuario, int $minutos): int
    {
        $sqlContarFallos = "SELECT COUNT(*) AS total
            FROM sgen_auditoria
            WHERE aud_usuId = ? AND aud_evento = 'LOGIN_FALLIDO'
                AND aud_fecha >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)";
        $fila = $this->conexion->ejecutarConsultaSimpleFila($sqlContarFallos, 'ii', $idUsuario, $minutos);
        return (int) ($fila['total'] ?? 0);
    }

    private function invalidarCodigosActivos(int $idUsuario): void
    {
        $sqlInvalidarCodigos = "UPDATE sgen_recuperacion SET rec_situacion = 'R'
            WHERE rec_usuId = ? AND rec_situacion = 'A'";
        $this->conexion->ejecutarActualizacion($sqlInvalidarCodigos, 'i', $idUsuario);
    }

    private function revocarSesiones(int $idUsuario, ?int $idSesionActual): void
    {
        $sqlRevocarSesiones = "UPDATE sgen_sesion SET ses_estado = 'V',
                ses_motivoRevocacion = 'CLAVE_CAMBIADA', ses_fechaRevocacion = NOW()
            WHERE ses_usuId = ? AND ses_estado = 'A'";
        if ($idSesionActual === null) {
            $this->conexion->ejecutarActualizacion($sqlRevocarSesiones, 'i', $idUsuario);
            return;
        }

        $sqlRevocarOtrasSesiones = $sqlRevocarSesiones . ' AND ses_id <> ?';
        $this->conexion->ejecutarActualizacion($sqlRevocarOtrasSesiones, 'ii', $idUsuario, $idSesionActual);
    }
}
