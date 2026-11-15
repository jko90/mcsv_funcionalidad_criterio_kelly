<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class ReglasKellyMdl
{
    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }


    /**
     * Resultados de las operativas de la cuenta, calculados en SQL (consulta original de
     * anexos/procedimientos.sql). Cuenta solo las operaciones activas (bit_estado = '1');
     * una operación sin resultado (NULL o '') cuenta como abierta.
     */
    public function insertarResultadoOperativas($idCuenta, $usuarioId, $identificadorUnico)
    {
        $sql = "INSERT INTO sckr_resultado(res_cueIdCuentas, res_opeGanador, res_x100Ganador, res_opePerdedor, res_x100Perdedor, res_opeBreakEven, res_x100BreakEven, res_operAbierta, res_x100Abierta, res_totalOperac, res_x100Total, res_identifica)
                SELECT bta.bit_cueIdCuentas AS cuenta_id,
                SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) AS operaciones_ganadoras,
                ROUND((SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_ganador,
                SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) AS operaciones_perdedoras,
                ROUND((SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_perdedor,
                SUM(CASE WHEN bta.bit_resultado = 'BREAK EVEN' THEN 1 ELSE 0 END) AS operaciones_break_even,
                ROUND((SUM(CASE WHEN bta.bit_resultado = 'BREAK EVEN' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_break_even,
                SUM(CASE WHEN bta.bit_resultado IS NULL OR bta.bit_resultado = '' THEN 1 ELSE 0 END) AS en_operacion,
                ROUND((SUM(CASE WHEN bta.bit_resultado IS NULL OR bta.bit_resultado = '' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_en_operacion,
                COUNT(*) AS total_operaciones, 100 AS x100total, ?
            FROM sckb_bitacora bta WHERE bta.bit_cueIdCuentas = ? AND bta.bit_usuarioId = ? AND bta.bit_estado = '1' GROUP BY bta.bit_cueIdCuentas";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "sii", $identificadorUnico, $idCuenta, $usuarioId);
    }

    public function obtenerResultadoPorId($idResultado)
    {
        $sql = "SELECT res_opeGanador, res_x100Ganador, res_opePerdedor, res_x100Perdedor, res_totalOperac FROM sckr_resultado  WHERE res_idResultado = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idResultado);
    }

    /**
     * Riesgo/beneficio de la cuenta, calculado en SQL (consulta original de
     * anexos/procedimientos.sql): monto promedio ganado y perdido, su relación y la
     * esperanza matemática con los porcentajes como fracción (0 a 1).
     * Solo cuenta las operaciones activas (bit_estado = '1').
     */
    public function insertarRiesgoBeneficio($idCuenta, $usuarioId, $identificadorUnico)
    {
        $sql = "INSERT INTO sckr_riesgobeneficio(rib_cueIdCuentas, rib_montoGanan, rib_relacionGanan, rib_montoRiesgo, rib_relacionRiesgo, rib_mtoEspeMatem, rib_relaEspeMate, rib_identifica)
                WITH estadisticas_base AS (
                    SELECT  bta.bit_cueIdCuentas AS idCuenta, bta.bit_usuarioId,
                        SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) AS ops_ganadoras,
                        SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN bta.bit_montoResult ELSE 0 END) AS monto_ganado_total,
                        SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) AS ops_perdedoras,
                        SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN bta.bit_montoResult ELSE 0 END) AS monto_perdido_total,
                        COUNT(*) AS total_operaciones
                    FROM sckb_bitacora bta WHERE bta.bit_cueIdCuentas = ? AND bta.bit_usuarioId = ? AND bta.bit_estado = '1'
                    GROUP BY bta.bit_cueIdCuentas, bta.bit_usuarioId
                ),
                metricas_calculadas AS (
                    SELECT *,
                        CASE WHEN ops_ganadoras > 0 THEN monto_ganado_total / ops_ganadoras ELSE 1 END AS monto_ganador,
                        CASE WHEN ops_perdedoras > 0 THEN monto_perdido_total / ops_perdedoras ELSE 1 END AS monto_perdedor,
                        CASE WHEN total_operaciones > 0 THEN ROUND((ops_ganadoras) / total_operaciones, 3) ELSE 0 END AS porcentaje_ganador,
                        CASE WHEN total_operaciones > 0 THEN ROUND((ops_perdedoras) / total_operaciones, 3) ELSE 0 END AS porcentaje_perdedor
                    FROM estadisticas_base
                )
                SELECT idCuenta, monto_ganador AS monto_promedio_ganador,
                    CASE WHEN monto_perdedor > 0 THEN monto_ganador / monto_perdedor ELSE 0 END AS ratio_ganador_perdedor,
                    monto_perdedor AS monto_promedio_perdedor, 1,
                    (monto_ganador * porcentaje_ganador) - (monto_perdedor * porcentaje_perdedor) AS monto_espe_matematica,
                    CASE WHEN monto_perdedor > 0 THEN ((monto_ganador / monto_perdedor) * porcentaje_ganador) - (1 * (porcentaje_perdedor)) ELSE 0 END AS relacion_espe_matematica,
                    ?
                FROM metricas_calculadas";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "iis", $idCuenta, $usuarioId, $identificadorUnico);
    }


    public function obtenerRiesgoBeneficioPorId($idRiesgoBeneficio)
    {
        $sql = "SELECT rib_relacionGanan FROM sckr_riesgobeneficio WHERE rib_idRiesBenef = ?";
        return $this->conexion->ejecutarConsultaSimpleFila($sql, "i", $idRiesgoBeneficio);
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
