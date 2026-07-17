

    /*
    public function insertarResultadoOperativas($idCuenta, $usuarioId)
    {
        $sql = "INSERT INTO sckr_resultado(res_bitIdbitacor, res_opeGanador, res_x100Ganador, res_opePerdedor, res_x100Perdedor, res_opeBreakEven, res_x100BreakEven, res_operAbierta, res_x100Abierta, res_totalOperac, res_x100Total) 
                SELECT bta.bit_cueIdCuentas AS cuenta_id,
                SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) AS operaciones_ganadoras,
                ROUND((SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_ganador,
                SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) AS operaciones_perdedoras,
                ROUND((SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_perdedor,
                SUM(CASE WHEN bta.bit_resultado = 'BREAK EVEN' THEN 1 ELSE 0 END) AS operaciones_break_even,
                ROUND((SUM(CASE WHEN bta.bit_resultado = 'BREAK EVEN' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_break_even,
                SUM(CASE WHEN bta.bit_resultado = '' THEN 1 ELSE 0 END) AS en_operacion,
                ROUND((SUM(CASE WHEN bta.bit_resultado = '' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_en_operacion,
                COUNT(*) AS total_operaciones, 100 x100total
            FROM sckb_bitacora bta WHERE bta.bit_cueIdCuentas = ?  AND bta.bit_usuarioId = ? GROUP BY bta.bit_cueIdCuentas";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "ii", $idCuenta, $usuarioId);
    }*/


    
    /*
    public function insertarRiesgoBeneficio($idCuenta, $usuarioId)
    {
        $sql = "INSERT INTO sckr_riesgobeneficio(rib_cueIdCuentas, rib_montoGanan, rib_relacionGanan, rib_montoRiesgo, rib_relacionRiesgo, rib_mtoEspeMatem, rib_relaEspeMate)
                WITH estadisticas_base AS (
                    SELECT  bta.bit_cueIdCuentas AS idCuenta, bta.bit_usuarioId,
                        SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) AS ops_ganadoras,
                        SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN bta.bit_montoResult ELSE 0 END) AS monto_ganado_total,
                        SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) AS ops_perdedoras,
                        SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN bta.bit_montoResult ELSE 0 END) AS monto_perdido_total,
                        COUNT(*) AS total_operaciones
                    FROM sckb_bitacora bta WHERE bta.bit_cueIdCuentas = ? AND bta.bit_usuarioId = ?
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
                    CASE WHEN monto_perdedor > 0 THEN ((monto_ganador / monto_perdedor) * porcentaje_ganador) - (1 * (porcentaje_perdedor)) ELSE 0 END AS relacion_espe_matematica
                FROM metricas_calculadas ";
        return $this->conexion->ejecutarInsercionRetornaID($sql, "ii", $idCuenta, $usuarioId);
    }
*/