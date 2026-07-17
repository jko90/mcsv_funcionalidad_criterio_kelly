<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class ReglasKellyMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }


    public function insertarResultadoOperativas($idCuenta, $usuarioId, $operacionesGanadoras, $operacionesPerdedoras, $operacionesBreakEven, $enOperacion, $totalOperaciones, $identificadorUnico)
    {
        $divisorOperaciones = (!empty($totalOperaciones) || $totalOperaciones > 0) ? $totalOperaciones : 1;
        $porcentajeGanador = ($operacionesGanadoras / $divisorOperaciones) * 100;
        $porcentajePerdedor   = ($operacionesPerdedoras / $divisorOperaciones) * 100 ;
        $porcentajeBreakEven  = ($operacionesBreakEven / $divisorOperaciones) * 100 ;
        $porcentajeAbierta    =  ($enOperacion / $divisorOperaciones) * 100 ;

        $sql = "INSERT INTO sckr_resultado(res_cueIdCuentas, res_opeGanador, res_x100Ganador, res_opePerdedor, res_x100Perdedor, res_opeBreakEven, res_x100BreakEven, res_operAbierta, res_x100Abierta, res_totalOperac, res_x100Total, res_identifica) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "iididididids", $idCuenta, $operacionesGanadoras, $porcentajeGanador, $operacionesPerdedoras, $porcentajePerdedor, $operacionesBreakEven, $porcentajeBreakEven, $enOperacion, $porcentajeAbierta, $totalOperaciones, 100, $identificadorUnico);
    }

    public function obtenerResultadoPorId($idResultado)
    {
        $sql = "SELECT res_opeGanador, res_x100Ganador, res_opePerdedor, res_x100Perdedor, res_totalOperac FROM sckr_resultado  WHERE res_idResultado = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idResultado);
    }

    public function eliminarResultadoOperativas($idResultadoOperativo)
    {
        $sql = "DELETE FROM sckr_resultado WHERE res_idResultado = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idResultadoOperativo);
    }



    public function insertarRiesgoBeneficio($idCuenta, $usuarioId,  $res_opeGanador, $res_opePerdedor, $res_x100Ganador, $res_x100Perdedor, $identificadorUnico)
    {
        $sql = "SELECT SUM(CASE WHEN bit_resultado = 'GANADOR' THEN bit_montoResult ELSE 0 END) AS total_ganador,
                SUM(CASE WHEN bit_resultado = 'PERDEDOR' THEN bit_montoResult ELSE 0 END) AS total_perdedor FROM sckb_bitacora WHERE bit_usuarioId = ? AND bit_cueIdCuentas = ?";
        $resultado = $this->conexion->ejecutarConsultaSimpleFila($sql, "ii", $usuarioId, $idCuenta);
        $suma_total_ganador = isset($resultado['total_ganador']) ? (float)$resultado['total_ganador'] : 0;
        $suma_total_perdedor = isset($resultado['total_perdedor']) ? (float)$resultado['total_perdedor'] : 0;

        $res_opeGanadorSeguro = (!empty($res_opeGanador) || $res_opeGanador > 0) ? $res_opeGanador : 1;
        $res_opePerdedorSeguro = (!empty($res_opePerdedor) || $res_opePerdedor > 0) ? $res_opePerdedor : 1;
        $montoGanan = $suma_total_ganador / $res_opeGanadorSeguro;
        $montoPierde =  $suma_total_perdedor / $res_opePerdedorSeguro;

        $montoPierdeSeguro = ($montoPierde <= 0) ? $montoPierde : 1;
        $ratioGananPerdedor = $montoGanan / $montoPierdeSeguro;

        $montoEspeMate = ($suma_total_ganador * $res_x100Ganador) - ($suma_total_perdedor * $res_x100Perdedor);
        $relacionEspeMate = ($ratioGananPerdedor * $res_x100Ganador) - (1 * $res_x100Perdedor);

        $sql = "INSERT INTO sckr_riesgobeneficio(rib_cueIdCuentas, rib_montoGanan, rib_relacionGanan, rib_montoRiesgo, rib_relacionRiesgo, rib_mtoEspeMatem, rib_relaEspeMate, rib_identifica) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        return $this->conexion->ejecutarInsercionRetornaID($sql, "idddidds", $idCuenta, $montoGanan, $ratioGananPerdedor, $montoPierde, 1, $montoEspeMate, $relacionEspeMate, $identificadorUnico);
    }


    public function obtenerRiesgoBeneficioPorId($idRiesgoBeneficio)
    {
        $sql = "SELECT rib_relacionGanan FROM sckr_riesgobeneficio WHERE rib_idRiesBenef = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idRiesgoBeneficio);
    }



    public function eliminarRiesgoBeneficio($idRiesBeneficio)
    {
        $sql = "DELETE FROM sckr_riesgobeneficio WHERE rib_idRiesBenef = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idRiesBeneficio);
    }



    public function insertarFactorTotal($idCuenta, $usuarioId, $identificadorUnico)
    {
        $sql = "INSERT INTO sckt_factortotal(fat_cueIdCuentas, fat_montoGanan, fat_montoPierde, fat_profitFactor, fat_identifica) 
                SELECT bta.bit_cueIdCuentas AS cuenta_id,
                    ROUND(SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN bta.bit_montoResult ELSE 0 END), 3) AS operaciones_ganadoras,
                    ROUND(SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN bta.bit_montoResult ELSE 0 END), 3) AS operaciones_perdedoras,
                    ROUND(SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN bta.bit_montoResult ELSE 0 END) / NULLIF(SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN bta.bit_montoResult ELSE 0 END), 0),  3 ) AS factor_total, ?
                FROM sckb_bitacora bta WHERE bta.bit_cueIdCuentas = ? AND bta.bit_usuarioId = ? GROUP BY bta.bit_cueIdCuentas";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "sii", $identificadorUnico, $idCuenta, $usuarioId);
    }

    public function obtenerFactorTotalPorId($idFactorTotal)
    {
        $sql = "SELECT fat_montoGanan, fat_montoPierde FROM sckt_factortotal WHERE fat_idFactotal = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idFactorTotal);
    }

    public function eliminarFactorTotal($idFactorTotal)
    {
        $sql = "DELETE FROM sckt_factortotal WHERE fat_idFactotal = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idFactorTotal);
    }


    public function insertarRentabilidad($idCuenta, $montoGanan, $montoPierde, $montoCapital, $montoBalanceInicial, $identificadorUnico)
    {
        $montoNeto = $montoGanan - $montoPierde;
        $montoCapitalSeguro = (!empty($montoCapital) || $montoCapital > 0) ? $montoCapital : 1;
        $porcentaje = ($montoNeto / $montoCapitalSeguro) * 100;
        $sql = "INSERT INTO sckr_rentabilidad( ren_cueIdCuentas, ren_porcentaje, ren_montoNeto, ren_montoTotal, ren_identifica) VALUES (?, ?, ?, ?, ?)";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "iddds", $idCuenta, $porcentaje,  $montoNeto, $montoBalanceInicial, $identificadorUnico);
    }

    public function obtenerRentabilidadPorId($idRentabilidad)
    {
        $sql = "SELECT ren_montoTotal FROM sckr_rentabilidad WHERE ren_idRentabili = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idRentabilidad);
    }

    public function eliminarRentabilidad($idRentabilidad)
    {
        $sql = "DELETE FROM sckr_rentabilidad WHERE ren_idRentabili = ?";
        return $this->conexion->ejecutarActualizacion($sql, "i", $idRentabilidad);
    }


    public function insertarCriterioKelly($idCuenta, $usuarioId, $res_x100Ganador, $divisor, $relGananciamedia, $capitalFinal, $identificadorUnico)
    {
        $relGananciamediaSeguro = (!empty($relGananciamedia) || $relGananciamedia > 0) ? $relGananciamedia : 1;

        $kelly = ($relGananciamediaSeguro * ($res_x100Ganador / 100) - (1 - ($res_x100Ganador / 100))) / $relGananciamediaSeguro;
        $kelly = (float)round($kelly*100, 3);
        if($kelly < 0) $kelly = 0;

        $divisorSeguro = (!empty($divisor)) ? $divisor : 1;
        $operativa = (float)round(($kelly / $divisorSeguro), 3);

        $montoOperar = ($operativa * $capitalFinal) / 100;
        $montoOperar = (float)round($montoOperar, 3);

        $sql = "INSERT INTO sckp_criteriokelly(cke_cueIdCuentas, cke_usuarioId, cke_x100Kelly, cke_numDivisor, cke_x100Operativo, cke_montoOperar, cke_identifica) VALUES (?, ?, ?, ?, ?, ?, ?)";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "iididds", $idCuenta, $usuarioId, $kelly, $divisor, $operativa, $montoOperar, $identificadorUnico);
    }

    public function obtenerCriterioKellyPorId($idCriterioKelly)
    {
        $sql = "SELECT * FROM sckp_criteriokelly WHERE cke_idCritKelly = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idCriterioKelly);
    }
}
