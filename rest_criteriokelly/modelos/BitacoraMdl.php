<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class BitacoraMdl
{
    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function crearBitacora(
        int $idUsuario,
        int $idCuenta,
        int $numeroBitacora,
        string $divisa,
        string $tipoOperacion,
        float $precioEntrada,
        float $precioStopLoss,
        float $precioTakeProfit,
        string $comentario,
        string $tipoObservacion,
        ?string $imagen,
        string $fechaCreacion
    ): ?array {
        $sqlInsertarBitacora = 'INSERT INTO sckb_bitacora
            (bit_usuarioId, bit_cueIdCuentas, bit_divisa, bit_numeroBitac,
             bit_fechaCrea, bit_precioEntra, bit_precioSL, bit_precioTP, bit_tipoOperaci)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        $idBitacora = $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarBitacora,
            'iisisddds',
            $idUsuario,
            $idCuenta,
            $divisa,
            $numeroBitacora,
            $fechaCreacion,
            $precioEntrada,
            $precioStopLoss,
            $precioTakeProfit,
            $tipoOperacion
        );
        if ($idBitacora <= 0) {
            throw new RuntimeException('No se pudo crear la bitácora');
        }

        if ($comentario !== '' || $tipoObservacion !== '' || $imagen !== null) {
            $sqlInsertarObservacion = 'INSERT INTO scko_observacion
                (obs_bitIdbitaco, obs_comentario, obs_tipoObserva, obs_imagen)
                VALUES (?, ?, ?, ?)';
            $this->conexion->ejecutarInsercionRetornaID(
                $sqlInsertarObservacion,
                'isss',
                $idBitacora,
                $comentario,
                $tipoObservacion,
                $imagen
            );
        }
        return $this->obtenerBitacoraId($idBitacora);
    }

    public function obtenerBitacoraDeUsuario(int $idBitacora, int $idUsuario, bool $bloquear = false): ?array
    {
        $sqlBitacoraDeUsuario = 'SELECT b.bit_idbitacora, b.bit_cueIdCuentas, b.bit_situacion
            FROM sckb_bitacora b
            WHERE b.bit_idbitacora = ? AND b.bit_usuarioId = ? AND b.bit_estado = "1"
            AND EXISTS (
                SELECT 1 FROM sckc_cuentas c
                WHERE c.cue_idCuentas = b.bit_cueIdCuentas
                AND c.cue_usuarioId = ? AND c.cue_estado = "1"
            )';
        $sqlBitacoraDeUsuarioBloqueo = $sqlBitacoraDeUsuario . ' FOR UPDATE';
        return $this->conexion->ejecutarConsultaSimpleFila(
            $bloquear ? $sqlBitacoraDeUsuarioBloqueo : $sqlBitacoraDeUsuario,
            'iii',
            $idBitacora,
            $idUsuario,
            $idUsuario
        );
    }

    public function obtenerBitacoraPorCuenta(int $idUsuario, int $idCuenta)
    {
        $sqlBitacoraDeCuentaPropia = 'SELECT bit_idbitacora, bit_usuarioId, bit_cueIdCuentas,
                bit_numeroBitac, bit_divisa, bit_tipoOperaci, bit_precioEntra,
                bit_precioSL, bit_precioTP, bit_pipTotal, bit_montoOpera,
                bit_montoResult, bit_resultado, bit_balance, bit_situacion,
                bit_fechaCrea, bit_fechaFin, bit_respeReglas, bit_estado
            FROM sckb_bitacora
            WHERE bit_usuarioId = ? AND bit_cueIdCuentas = ? AND bit_estado = "1"
            AND EXISTS (
                SELECT 1 FROM sckc_cuentas c
                WHERE c.cue_idCuentas = bit_cueIdCuentas
                AND c.cue_usuarioId = ? AND c.cue_estado = "1"
            )
            ORDER BY bit_fechaCrea DESC';
        return $this->conexion->ejecutarConsulta($sqlBitacoraDeCuentaPropia, 'iii', $idUsuario, $idCuenta, $idUsuario);
    }

    public function obtenerBitacoraId(int $idBitacora): ?array
    {
        $sqlBitacoraPorId = 'SELECT bit_idbitacora, bit_usuarioId, bit_cueIdCuentas,
                bit_numeroBitac, bit_divisa, bit_tipoOperaci, bit_precioEntra,
                bit_precioSL, bit_precioTP, bit_pipTotal, bit_montoOpera,
                bit_montoResult, bit_resultado, bit_balance, bit_situacion,
                bit_fechaCrea, bit_fechaFin, bit_respeReglas, bit_estado
            FROM sckb_bitacora WHERE bit_idbitacora = ?';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlBitacoraPorId, 'i', $idBitacora);
    }

    public function finalizarOperacionBitacora(
        int $idBitacora,
        string $resultado,
        string $reglas,
        string $situacion,
        float $montoResultado,
        string $fechaFin,
        float $balanceInicial
    ): int {
        $balanceFinal = $resultado === 'GANADOR'
            ? $balanceInicial + $montoResultado
            : $balanceInicial - $montoResultado;
        $sqlFinalizarBitacoraAbierta = 'UPDATE sckb_bitacora
            SET bit_resultado = ?, bit_montoResult = ?, bit_respeReglas = ?,
                bit_situacion = ?, bit_fechaFin = ?, bit_balance = ?
            WHERE bit_idbitacora = ? AND bit_situacion = "O"';
        return $this->conexion->ejecutarActualizacion(
            $sqlFinalizarBitacoraAbierta,
            'sdsssdi',
            $resultado,
            $montoResultado,
            $reglas,
            $situacion,
            $fechaFin,
            $balanceFinal,
            $idBitacora
        );
    }

    public function obtenerBalancePorIdCuenta(int $idCuenta): ?array
    {
        $sqlUltimoBalanceCerrado = 'SELECT COALESCE(bit_balance, 0) AS bit_balance
            FROM sckb_bitacora
            WHERE bit_cueIdCuentas = ? AND bit_resultado <> "" AND bit_fechaFin IS NOT NULL
            ORDER BY bit_fechaFin DESC LIMIT 1';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlUltimoBalanceCerrado, 'i', $idCuenta);
    }

    public function obtenerCantidadOperacionesPorCuentaUsuario(int $idCuenta, int $idUsuario): ?array
    {
        $sqlConteoOperaciones = 'SELECT bit_cueIdCuentas AS cuenta_id,
                SUM(bit_resultado = "GANADOR") AS operaciones_ganadoras,
                SUM(bit_resultado = "PERDEDOR") AS operaciones_perdedoras,
                SUM(bit_resultado = "BREAK EVEN") AS operaciones_break_even,
                SUM(bit_resultado IS NULL OR bit_resultado = "") AS en_operacion,
                COUNT(*) AS total_operaciones
            FROM sckb_bitacora
            WHERE bit_cueIdCuentas = ? AND bit_usuarioId = ? AND bit_estado = "1"
            GROUP BY bit_cueIdCuentas';
        return $this->conexion->ejecutarConsultaSimpleFila($sqlConteoOperaciones, 'ii', $idCuenta, $idUsuario);
    }

    public function eliminarObservacion(int $idBitacora): int
    {
        $sqlEliminarObservaciones = 'DELETE FROM scko_observacion WHERE obs_bitIdbitaco = ?';
        return $this->conexion->ejecutarActualizacion($sqlEliminarObservaciones, 'i', $idBitacora);
    }

    public function eliminarBitacoraPorId(int $idBitacora): int
    {
        $sqlEliminarBitacora = 'DELETE FROM sckb_bitacora WHERE bit_idbitacora = ?';
        return $this->conexion->ejecutarActualizacion($sqlEliminarBitacora, 'i', $idBitacora);
    }
}
