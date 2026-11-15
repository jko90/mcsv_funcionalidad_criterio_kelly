<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class CuentasMdl
{
    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function agregarCuenta(string $nombreCuenta, int $idUsuario, string $fechaCrea, float $valorCuenta): int
    {
        $sqlInsertarCuenta = 'INSERT INTO sckc_cuentas
            (cue_nombre, cue_usuarioId, cue_fechaCrea) VALUES (?, ?, ?)';
        $idCuenta = $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarCuenta,
            'sis',
            $nombreCuenta,
            $idUsuario,
            $fechaCrea
        );
        if ($idCuenta <= 0) {
            throw new RuntimeException('No se pudo crear la cuenta');
        }

        $sqlInsertarCapitalInicial = 'INSERT INTO sckc_capital
            (cap_usuarioId, cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie)
            VALUES (?, ?, ?, ?, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarCapitalInicial,
            'iidds',
            $idUsuario,
            $idCuenta,
            $valorCuenta,
            $valorCuenta,
            'D'
        );
    }

    /** Mutex por usuario (primer bloqueo del orden usuario, suscripciones, pagos). Exige transacción abierta. */
    public function bloquearUsuario(int $idUsuario): bool
    {
        $sqlBloquearUsuario = 'SELECT usu_idUsuario FROM sgen_usuario WHERE usu_idUsuario = ? FOR UPDATE';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlBloquearUsuario, 'i', $idUsuario) !== null;
    }

    public function contarCuentasActivas(int $idUsuario): int
    {
        $sqlContarCuentasActivas = 'SELECT COUNT(*) AS total FROM sckc_cuentas
            WHERE cue_usuarioId = ? AND cue_estado = "1"';
        $fila = $this->conexion->ejecutarConsultaSimpleFila($sqlContarCuentasActivas, 'i', $idUsuario);
        return (int) ($fila['total'] ?? 0);
    }

    public function obtenerCuentasPorUsuario(int $idUsuario)
    {
        $sqlCuentasActivasDeUsuario = 'SELECT cap.cap_idCapital, cue.cue_idCuentas,
                cue.cue_nombre, cap.cap_capital, cue.cue_usuarioId, cap.cap_fecha
            FROM sckc_cuentas cue
            INNER JOIN sckc_capital cap
                ON cue.cue_idCuentas = cap.cap_cueIdCuentas
                AND cue.cue_usuarioId = cap.cap_usuarioId
            WHERE cap.cap_fecha = (
                SELECT MAX(sc.cap_fecha)
                FROM sckc_capital sc
                WHERE sc.cap_cueIdCuentas = cap.cap_cueIdCuentas
            )
            AND cue.cue_usuarioId = ? AND cue.cue_estado = "1"
            ORDER BY cap.cap_idCapital';
        return $this->conexion->ejecutarConsulta($sqlCuentasActivasDeUsuario, 'i', $idUsuario);
    }

    public function obtenerCuentaActivaDeUsuario(int $idCuenta, int $idUsuario, bool $bloquear = false): ?array
    {
        $sqlCuentaActivaDeUsuario = 'SELECT cue_idCuentas, cue_usuarioId
            FROM sckc_cuentas
            WHERE cue_idCuentas = ? AND cue_usuarioId = ? AND cue_estado = "1"';
        $sqlCuentaActivaDeUsuarioBloqueo = $sqlCuentaActivaDeUsuario . ' FOR UPDATE';
        return $this->conexion->ejecutarConsultaSimpleFila(
            $bloquear ? $sqlCuentaActivaDeUsuarioBloqueo : $sqlCuentaActivaDeUsuario,
            'ii',
            $idCuenta,
            $idUsuario
        );
    }

    public function registroMovimientoCapital(
        int $idCuenta,
        float $monto,
        float $capital,
        string $tipoMovimiento,
        int $idUsuario
    ): int {
        $sqlInsertarMovimientoDeCuentaPropia = 'INSERT INTO sckc_capital
            (cap_usuarioId, cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie)
            SELECT ?, cue_idCuentas, ?, ?, ?
            FROM sckc_cuentas
            WHERE cue_idCuentas = ? AND cue_usuarioId = ? AND cue_estado = "1"';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarMovimientoDeCuentaPropia,
            'iddsii',
            $idUsuario,
            $monto,
            $capital,
            $tipoMovimiento,
            $idCuenta,
            $idUsuario
        );
    }

    public function actualizarNombreCuenta(string $nombreCuenta, int $idCuenta, int $idUsuario): int
    {
        $sqlActualizarNombreCuenta = 'UPDATE sckc_cuentas
            SET cue_nombre = ? WHERE cue_idCuentas = ? AND cue_usuarioId = ? AND cue_estado = "1"';
        return $this->conexion->ejecutarActualizacion(
            $sqlActualizarNombreCuenta,
            'sii',
            $nombreCuenta,
            $idCuenta,
            $idUsuario
        );
    }

    public function eliminarCuenta(int $idCuenta, int $idUsuario): int
    {
        $sqlEliminarCuenta = 'UPDATE sckc_cuentas SET cue_estado = "0"
            WHERE cue_idCuentas = ? AND cue_usuarioId = ? AND cue_estado = "1"';
        return $this->conexion->ejecutarActualizacion($sqlEliminarCuenta, 'ii', $idCuenta, $idUsuario);
    }

    public function obtenerCapitalPorIdUsuario(int $idCuenta, int $idUsuario): ?array
    {
        $sqlCapitalActualDeCuenta = 'SELECT cap_capital
            FROM sckc_capital
            WHERE cap_usuarioId = ? AND cap_cueIdCuentas = ?
            AND cap_fecha = (
                SELECT MAX(cap_fecha) FROM sckc_capital
                WHERE cap_usuarioId = ? AND cap_cueIdCuentas = ?
            )';
        return $this->conexion->ejecutarConsultaSimpleFila(
            $sqlCapitalActualDeCuenta,
            'iiii',
            $idUsuario,
            $idCuenta,
            $idUsuario,
            $idCuenta
        );
    }

    public function quemarCapitalCuenta(int $idCuenta, int $idUsuario, float $capital): int
    {
        $sqlQuemarCapitalDeCuenta = 'INSERT INTO sckc_capital
            (cap_usuarioId, cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie)
            VALUES (?, ?, ?, 0.0, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlQuemarCapitalDeCuenta,
            'iids',
            $idUsuario,
            $idCuenta,
            $capital,
            'Q'
        );
    }
}
