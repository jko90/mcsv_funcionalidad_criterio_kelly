<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class VerificacionMdl
{
    public const MAXIMO_SOLICITUDES_HORA = 3;
    public const MAXIMO_SOLICITUDES_DIA = 10;
    public const MAXIMO_INTENTOS = 5;
    public const MINUTOS_VIGENCIA = 15;
    public const SEGUNDOS_ENTRE_ENVIOS = 60;
    public const MAXIMO_CODIGOS_POR_IP_HORA = 10;
    public const DIAS_RETENCION_PENDIENTES = 7;

    public function __construct(private Enlace $conexion)
    {
    }

    /**
     * @return array<int, array{usu_idUsuario:int, usu_usuario:string, per_nombres:string, per_correo:string}>
     */
    public function buscarUsuarioPendientePorCorreo(string $correo): array
    {
        $sqlBuscarPendiente = "SELECT u.usu_idUsuario, u.usu_usuario, p.per_nombres, p.per_correo
            FROM sgen_usuario u
            INNER JOIN sgen_persona p ON p.per_idPersona = u.usu_perIdPerso
            WHERE p.per_correo = ? AND p.per_estado = '1' AND p.per_situacion = 'A'
                AND u.usu_estado = '1' AND u.usu_situacion = 'P'
            LIMIT 2";
        $resultado = $this->conexion->ejecutarConsulta($sqlBuscarPendiente, 's', $correo);
        $usuariosPendientes = [];
        while ($fila = $resultado->fetch_assoc()) {
            $usuariosPendientes[] = $fila;
        }

        return $usuariosPendientes;
    }

    public function contarCodigosPorIp(string $ip): int
    {
        $sqlContarPorIp = 'SELECT COUNT(*) AS total
            FROM sgen_verificacion
            WHERE ver_ipSolicitud = ? AND ver_fechaCrea >= NOW() - INTERVAL 1 HOUR';
        $fila = $this->conexion->ejecutarConsultaSimpleFila($sqlContarPorIp, 's', $ip);
        return (int) ($fila['total'] ?? 0);
    }

    /**
     * No abre transacción: la abre el llamador (PersonaMdl::registrarPersona) para que el código
     * nazca en la misma transacción que la cuenta.
     */
    public function insertarCodigoEnTransaccion(
        int $idUsuario,
        string $hashCodigo,
        string $ip,
        ?string $agente
    ): void {
        $sqlInsertarCodigo = 'INSERT INTO sgen_verificacion
            (ver_usuId, ver_codigoHash, ver_fechaExpira, ver_ipSolicitud, ver_agenteSolicitud)
            VALUES (?, ?, NOW() + INTERVAL ' . self::MINUTOS_VIGENCIA . ' MINUTE, ?, ?)';
        $this->conexion->ejecutarInsercionRetornaID($sqlInsertarCodigo, 'isss', $idUsuario, $hashCodigo, $ip, $agente);
    }

    /**
     * Emite un código nuevo si el usuario sigue pendiente y no supera los límites (3/hora, 10/día,
     * 60 s entre envíos). Devuelve false, sin escribir nada, cuando no corresponde emitir.
     */
    public function emitirCodigoReenvio(int $idUsuario, string $hashCodigo, string $ip, ?string $agente): bool
    {
        try {
            $this->conexion->iniciarTransaccion();
            $sqlBloquearUsuario = "SELECT usu_idUsuario FROM sgen_usuario
                WHERE usu_idUsuario = ? AND usu_situacion = 'P' AND usu_estado = '1' FOR UPDATE";
            if ($this->conexion->ejecutarConsultaSimpleFila($sqlBloquearUsuario, 'i', $idUsuario) === null) {
                $this->conexion->confirmarTransaccion();
                return false;
            }

            $sqlContarSolicitudes = 'SELECT
                    SUM(ver_fechaCrea >= NOW() - INTERVAL 1 HOUR) AS solicitudesHora,
                    SUM(ver_fechaCrea >= NOW() - INTERVAL 1 DAY) AS solicitudesDia,
                    MAX(ver_fechaCrea >= NOW() - INTERVAL ' . self::SEGUNDOS_ENTRE_ENVIOS . ' SECOND) AS reciente
                FROM sgen_verificacion WHERE ver_usuId = ?';
            $conteo = $this->conexion->ejecutarConsultaSimpleFila($sqlContarSolicitudes, 'i', $idUsuario);
            if ((int) ($conteo['solicitudesHora'] ?? 0) >= self::MAXIMO_SOLICITUDES_HORA
                || (int) ($conteo['solicitudesDia'] ?? 0) >= self::MAXIMO_SOLICITUDES_DIA
                || (int) ($conteo['reciente'] ?? 0) === 1) {
                $this->conexion->confirmarTransaccion();
                return false;
            }

            $sqlReemplazarCodigos = "UPDATE sgen_verificacion SET ver_situacion = 'R'
                WHERE ver_usuId = ? AND ver_situacion = 'A'";
            $this->conexion->ejecutarActualizacion($sqlReemplazarCodigos, 'i', $idUsuario);
            $this->insertarCodigoEnTransaccion($idUsuario, $hashCodigo, $ip, $agente);
            $this->conexion->confirmarTransaccion();
            return true;
        } catch (Throwable $error) {
            $this->conexion->revertirTransaccion();
            throw $error;
        }
    }

    public function buscarCodigoActivo(int $idUsuario): ?array
    {
        $sqlCodigoActivo = "SELECT ver_idVerificacion, ver_codigoHash, ver_intentos
            FROM sgen_verificacion
            WHERE ver_usuId = ? AND ver_situacion = 'A'
                AND ver_fechaExpira > NOW() AND ver_intentos < 5
            ORDER BY ver_idVerificacion DESC LIMIT 1";
        return $this->conexion->ejecutarConsultaSimpleFila($sqlCodigoActivo, 'i', $idUsuario);
    }

    /**
     * El intento se consume con un UPDATE condicional antes de comparar el código: así 10 intentos
     * simultáneos no pueden superar el máximo de 5.
     */
    public function consumirIntento(int $idVerificacion): bool
    {
        $sqlConsumirIntento = "UPDATE sgen_verificacion
            SET ver_intentos = ver_intentos + 1
            WHERE ver_idVerificacion = ? AND ver_situacion = 'A'
                AND ver_fechaExpira > NOW() AND ver_intentos < 5";
        return $this->conexion->ejecutarActualizacion($sqlConsumirIntento, 'i', $idVerificacion) === 1;
    }

    public function activarCuenta(int $idUsuario, int $idVerificacion, string $ip): bool
    {
        try {
            $this->conexion->iniciarTransaccion();
            $sqlUsarCodigo = "UPDATE sgen_verificacion SET ver_situacion = 'U',
                    ver_fechaUso = NOW(), ver_ipUso = ?
                WHERE ver_idVerificacion = ? AND ver_usuId = ?
                    AND ver_situacion = 'A' AND ver_fechaExpira > NOW()
                    AND ver_intentos <= 5";
            if ($this->conexion->ejecutarActualizacion($sqlUsarCodigo, 'sii', $ip, $idVerificacion, $idUsuario) !== 1) {
                $this->conexion->revertirTransaccion();
                return false;
            }

            $sqlActivarUsuario = "UPDATE sgen_usuario SET usu_situacion = 'A'
                WHERE usu_idUsuario = ? AND usu_situacion = 'P' AND usu_estado = '1'";
            if ($this->conexion->ejecutarActualizacion($sqlActivarUsuario, 'i', $idUsuario) !== 1) {
                $this->conexion->revertirTransaccion();
                return false;
            }

            $sqlReemplazarCodigos = "UPDATE sgen_verificacion SET ver_situacion = 'R'
                WHERE ver_usuId = ? AND ver_situacion = 'A'";
            $this->conexion->ejecutarActualizacion($sqlReemplazarCodigos, 'i', $idUsuario);
            $this->conexion->confirmarTransaccion();
            return true;
        } catch (Throwable $error) {
            $this->conexion->revertirTransaccion();
            throw $error;
        }
    }

    /**
     * Baja lógica de las cuentas pendientes que pidieron verificación y no la completaron en 7 días.
     * Los usuarios pendientes sin filas de verificación (anteriores a este flujo) no se tocan.
     * El UPDATE modifica dos tablas y mysqli suma las filas de ambas, así que los usuarios afectados
     * se cuentan antes con la misma condición.
     */
    public function depurarCuentasSinVerificar(): int
    {
        $condicionPendienteSinVerificar = "u.usu_situacion = 'P' AND u.usu_estado = '1'
                AND p.per_fechaRegis < NOW() - INTERVAL " . self::DIAS_RETENCION_PENDIENTES . " DAY
                AND EXISTS (SELECT 1 FROM sgen_verificacion v WHERE v.ver_usuId = u.usu_idUsuario)
                AND NOT EXISTS (SELECT 1 FROM sgen_verificacion w WHERE w.ver_usuId = u.usu_idUsuario
                    AND w.ver_fechaCrea >= NOW() - INTERVAL " . self::DIAS_RETENCION_PENDIENTES . " DAY)";
        $sqlContarCuentas = 'SELECT COUNT(*) AS total
            FROM sgen_usuario u
            INNER JOIN sgen_persona p ON p.per_idPersona = u.usu_perIdPerso
            WHERE ' . $condicionPendienteSinVerificar;
        $fila = $this->conexion->ejecutarConsultaSimpleFila($sqlContarCuentas);
        $sqlDepurarCuentas = "UPDATE sgen_usuario u
            INNER JOIN sgen_persona p ON p.per_idPersona = u.usu_perIdPerso
            SET u.usu_situacion = 'E', u.usu_estado = '0', p.per_estado = '0'
            WHERE " . $condicionPendienteSinVerificar;
        $this->conexion->ejecutarActualizacion($sqlDepurarCuentas);

        return (int) ($fila['total'] ?? 0);
    }
    public function depurarVerificacionesAntiguas(): int
    {
        $sqlDepurarVerificaciones = "DELETE v FROM sgen_verificacion v
            INNER JOIN sgen_usuario u ON u.usu_idUsuario = v.ver_usuId
            WHERE v.ver_fechaCrea < NOW() - INTERVAL " . self::DIAS_RETENCION_PENDIENTES . " DAY
                AND u.usu_situacion <> 'P'";
        return $this->conexion->ejecutarActualizacion($sqlDepurarVerificaciones);
    }
}
