<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class BitacoraMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function crearBitacora($usuarioId, $cuentaId, $numeroBitac, $divisa, $tipoOperacion, $precioEntra, $precioSL, $precioTP, $obsComentario, $obsTipoObserva, $obsImagen, $fechCrea)
    {
        try {
            $sqlBitacora = "INSERT INTO sckb_bitacora (bit_usuarioId, bit_cueIdCuentas, bit_divisa, bit_numeroBitac, bit_fechaCrea, bit_precioEntra, bit_precioSL, bit_precioTP, bit_tipoOperaci) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $idBitacora = $this->conexion->ejecutarConsultaRetornarID($sqlBitacora, "iisisddds", $usuarioId, $cuentaId, $divisa, $numeroBitac, $fechCrea, $precioEntra, $precioSL, $precioTP, $tipoOperacion);
            if (!$idBitacora) {
                return false;
            }

            $comentarioValido = !empty(trim($obsComentario));
            $tipoObservaValido = !empty(trim($obsTipoObserva));
            $imagenValida = !empty(trim($obsImagen));

            $tieneObservacion = $comentarioValido || $tipoObservaValido || $imagenValida;

            if ($tieneObservacion) {
                $idObservacion = $this->crearComentariosPorBitacora($idBitacora, $obsComentario, $obsTipoObserva, $obsImagen);
                if (!$idObservacion  || !is_numeric($idObservacion) || $idObservacion <= 0) {
                    $this->eliminarBitacoraError($idBitacora);
                    return false;
                }
            }

            return $this->obtenerBitacoraId($idBitacora);
        } catch (Exception $e) {
            if (isset($idBitacora)) {
                $this->eliminarBitacoraError($idBitacora);
            }
            return "Error al generar el registro: " . $e->getMessage();
        }
    }

    public function eliminarBitacoraError($idBitacora)
    {
        $sql = "DELETE FROM sckb_bitacora WHERE bit_idBitacora = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idBitacora);
    }

    public function obtenerBitacoraPorCuenta($idUsuario, $idCuenta)
    {
        $sql = "SELECT * FROM sckb_bitacora WHERE bit_usuarioId = ? AND bit_cueIdCuentas = ? AND bit_estado = '1' ORDER BY bit_fechaCrea DESC";
        return $this->conexion->ejecutarConsulta($sql, "ii", $idUsuario, $idCuenta);
    }

    public function obtenerBitacoraId($idBitacora)
    {
        $sql = "SELECT * FROM sckb_bitacora WHERE bit_idbitacora = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idBitacora);
    }
    /*
    public function actualizarBitacoraTPBESL($idBitacora, $precioEntra, $precioSL, $precioTP)
    {
        $sql = "UPDATE sckb_bitacora SET bit_precioEntra = ?, bit_precioSL = ?, bit_precioTP = ? WHERE bit_idbitacora = ?";
        return $this->conexion->ejecutarActualizacion($sql, "dddi", $precioEntra, $precioSL, $precioTP, $idBitacora);
    }
*/
    public function finalizarOperacionBitacora($idBitacora, $resultado, $reglas, $situacion, $montoResultado, $fechaFin, $idCuenta, $montoBalanceInicial)
    {
        $montoResultado = is_numeric($montoResultado) ? (float)($montoResultado) : 0.0;

        switch ($resultado) {
            case 'GANADOR':
                $balance = $montoBalanceInicial + $montoResultado;
                break;
            default:
                $balance = $montoBalanceInicial - $montoResultado;
                break;
        }

        $sql = "UPDATE sckb_bitacora SET bit_resultado = ?, bit_montoResult = ?, bit_respeReglas = ?, bit_situacion = ?, bit_fechaFin = ?, bit_balance = ? WHERE bit_idbitacora = ?";
        return $this->conexion->ejecutarActualizacion($sql, "sdsssdi", $resultado, $montoResultado, $reglas, $situacion, $fechaFin, $balance, $idBitacora);
    }

    public function anularFinalizarOperacionBitacora($idBitacora, $montoBalanceInicial)
    {
        $sql = "UPDATE sckb_bitacora SET bit_resultado = ?, bit_montoResult = ?, bit_respeReglas = ?, bit_situacion = ?, bit_fechaFin = ?, bit_balance = ? WHERE bit_idbitacora = ?";
        return $this->conexion->ejecutarActualizacion($sql, "sdsssdi", '', 0.0, '', 'O', null, $montoBalanceInicial, $idBitacora);
    }

    public function obtenerBalancePorIdCuenta($idCuenta)
    {
        $sql = "SELECT COALESCE(bit_balance, 0) AS bit_balance FROM sckb_bitacora WHERE bit_cueIdCuentas = ? AND bit_resultado <> '' AND bit_fechaFin IS NOT NULL ORDER BY bit_fechaFin DESC LIMIT 1";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idCuenta);
    }

    public function obtenerCantidadOperacionesPorCuentaUsuario($idCuenta, $idUsuario)
    {
        $sql = "SELECT bit_cueIdCuentas AS cuenta_id, SUM(bit_resultado = 'GANADOR') AS operaciones_ganadoras,
                SUM(bit_resultado = 'PERDEDOR') AS operaciones_perdedoras, SUM(bit_resultado = 'BREAK EVEN') AS operaciones_break_even,
                SUM(bit_resultado = '') AS en_operacion, COUNT(*) AS total_operaciones 
                FROM sckb_bitacora WHERE bit_cueIdCuentas = ? AND bit_usuarioId = ? GROUP BY bit_cueIdCuentas";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "ii", $idCuenta, $idUsuario);
    }

    private function crearComentariosPorBitacora($idBitacora, $obsComentario, $obsTipoObserva, $obsImagen)
    {
        $sqlObservacion = "INSERT INTO scko_observacion (obs_bitIdbitaco, obs_comentario, obs_tipoObserva, obs_imagen) VALUES (?, ?, ?, ?)";
        return $this->conexion->ejecutarInsercionRetornaID($sqlObservacion, "isss", $idBitacora, $obsComentario, $obsTipoObserva, $obsImagen);
    }

    public function eliminarObservacion($idBitacora)
    {
        $sql = "DELETE FROM scko_observacion WHERE obs_bitIdbitaco = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idBitacora);
    }
}
