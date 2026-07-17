<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class CuentasMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function agregarCuenta($nombreCuenta, $idUsuario, $fechaCrea, $valorCuenta)
    {
        try {

            $sqlCuenta = "INSERT INTO sckc_cuentas (cue_nombre, cue_usuarioId, cue_fechaCrea) VALUES (?, ?, ?)";
            $idCuenta = $this->conexion->ejecutarConsultaRetornarID(
                $sqlCuenta,
                "sis",
                $nombreCuenta,
                $idUsuario,
                $fechaCrea
            );

            if (!$idCuenta) {
                return false;
            }

            $sqlCapital = "INSERT INTO sckc_capital (cap_usuarioId, cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie)  VALUES (?, ?, ?, ?, 'D')";
            $idCapital = $this->conexion->ejecutarConsultaRetornarID(
                $sqlCapital,
                "iidd",
                $idUsuario,
                $idCuenta,
                $valorCuenta,
                $valorCuenta
            );


            if (!$idCapital) {
                $this->eliminarCuentaError($idCuenta);
                return false;
            }

            return $idCapital;
        } catch (Exception $e) {
            if (isset($idUsuario) && $idCapital) {
                $this->eliminarCuentaError($idCuenta);
            }
            return "Error al generar el registro: " . $e->getMessage();
        }
    }

    public function eliminarCuentaError($idCuenta)
    {
        $sql = "DELETE FROM sckc_cuentas WHERE cue_idCuentas = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idCuenta);
    }


    public function obtenerCuentasPorUsuario($idUsuario)
    {
        $sql = "SELECT cap.cap_idCapital,cue.cue_idCuentas, cue.cue_nombre, cap.cap_capital, cue.cue_usuarioId, cap.cap_fecha 
                FROM sckc_cuentas cue 
                INNER JOIN sckc_capital cap ON cue.cue_idCuentas = cap.cap_cueIdCuentas AND cue.cue_usuarioId = cap.cap_usuarioId
                WHERE cap.cap_fecha = (
                    SELECT MAX(sc.cap_fecha) FROM sckc_capital sc WHERE sc.cap_cueIdCuentas = cap.cap_cueIdCuentas  GROUP BY sc.cap_cueIdCuentas 
                ) AND cue.cue_usuarioId = ? AND cue.cue_estado = '1' ORDER BY cap.cap_idCapital";
        return $this->conexion->ejecutarConsulta($sql, "i", $idUsuario);
    }


    public function registroMovimientoCapital($cueIdCuentas, $usuarioId, $monto, $capital, $cap_tipoMovimie)
    {
        $sql = "INSERT INTO sckc_capital( cap_usuarioId, cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie) VALUES (?, ?, ?, ?, ?) ";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "iidds", $usuarioId, $cueIdCuentas, $monto, $capital, $cap_tipoMovimie);
    }


    public function actualizarNombreCuenta($cue_nombre, $cue_idCuenta, $cue_usuarioId)
    {
        $sql = "UPDATE sckc_cuentas SET cue_nombre = ? WHERE cue_idCuentas = ? AND cue_usuarioId = ?";
        return $this->conexion->ejecutarActualizacion($sql, "sii", $cue_nombre, $cue_idCuenta, $cue_usuarioId);
    }

    public function eliminarCuenta($cue_idCuenta, $cue_usuarioId)
    {
        $sql = "UPDATE sckc_cuentas SET cue_estado = '0' WHERE cue_idCuentas = ? AND cue_usuarioId = ?";
        return $this->conexion->ejecutarActualizacion($sql, "ii", $cue_idCuenta, $cue_usuarioId);
    }

    public function obtenerCapitalPorIdUsuario($cue_idCuenta, $cue_usuarioId)
    {
        $sql = "SELECT cap_capital FROM sckc_capital WHERE cap_usuarioId = ? AND cap_cueIdCuentas = ? AND cap_fecha = (
        SELECT MAX(cap_fecha) FROM sckc_capital WHERE cap_usuarioId = ? AND cap_cueIdCuentas = ?)";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "iiii", $cue_usuarioId, $cue_idCuenta, $cue_usuarioId, $cue_idCuenta);
    }

    public function quemarCapitalCuenta($cue_idCuenta, $cue_usuarioId, $capital){
        $sql = "INSERT INTO sckc_capital (cap_usuarioId, cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie) VALUES (?, ?, ?, 0.0, 'Q')";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "iid", $cue_idCuenta, $cue_usuarioId, $capital);
    }
}
