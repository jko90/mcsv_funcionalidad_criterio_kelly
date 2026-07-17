<?php

include_once(__DIR__ . '/../configuracion/enlace.php');

class CriterioKellyMdl
{
    private $conexion;

    public function __construct()
    {
        $this->conexion = new Enlace();
    }

    public function obtenerPorcentajeKellyIdCuenta($usuarioId)
    {
        $sql = "SELECT cke_idCritKelly, cke_cueIdCuentas, cke_usuarioId, cke_x100Kelly, cke_numDivisor, cke_x100Operativo, cke_montoOperar, cke_identifica 
            FROM sckp_criteriokelly t1 WHERE cke_usuarioId = ? 
            AND cke_fecha = (
                SELECT MAX(cke_fecha) FROM sckp_criteriokelly t2 WHERE t2.cke_cueIdCuentas = t1.cke_cueIdCuentas AND t2.cke_usuarioId = ?
            )";
        return $this->conexion->ejecutarConsulta($sql, "ii", $usuarioId, $usuarioId);
    }

    public function obtenerResultadoPorIdentificador($usuarioId)
    {
        $sql = "SELECT resu.res_opeGanador, resu.res_x100Ganador, resu.res_opePerdedor, resu.res_x100Perdedor, resu.res_opeBreakEven, resu.res_x100BreakEven, resu.res_operAbierta, resu.res_x100Abierta, resu.res_totalOperac, resu.res_x100Total, rent.ren_montoTotal, resu.res_identifica FROM  sckr_resultado resu 
                INNER JOIN sckr_rentabilidad rent ON resu.res_identifica = rent.ren_identifica INNER JOIN sckp_criteriokelly kell ON resu.res_identifica = kell.cke_identifica 
                WHERE kell.cke_usuarioId = ? AND cke_fecha = (SELECT MAX(cke_fecha) FROM sckp_criteriokelly t2 WHERE t2.cke_cueIdCuentas = resu.res_cueIdCuentas AND t2.cke_usuarioId = ?)";
        return $this->conexion->ejecutarConsulta($sql, "ii", $usuarioId, $usuarioId);
    }

    public function obtenerDetalleOperaciones($usuarioId)
    {
        $sql = "SELECT bit_cueIdCuentas, bit_divisa, bit_tipoOperaci, bit_montoResult, bit_resultado, bit_balance, bit_situacion, bit_fechaFin FROM sckb_bitacora WHERE bit_usuarioId = ? AND bit_situacion = 'F' AND bit_estado = '1' ORDER BY bit_cueIdCuentas, bit_fechaFin";
        return $this->conexion->ejecutarConsulta($sql, "i", $usuarioId);
    }
    /*
        public function obtenerOperacionesParaAnalisis($usuarioId)
    {
        $sql = "SELECT 
    b.bit_idbitacora, 
    b.bit_cueIdCuentas, 
    b.bit_divisa, 
    b.bit_tipoOperaci, 
    b.bit_montoResult, 
    b.bit_resultado, 
    b.bit_precioEntra,
    b.bit_precioSL,
    b.bit_precioTP,
    b.bit_balance, 
    b.bit_situacion, 
    b.bit_fechaCrea,
    b.bit_fechaFin,
    b.bit_respeReglas,
    -- Usar agregaciones condicionales más eficientes
    MAX(CASE WHEN o.obs_num = 1 THEN o.obs_comentario END) AS inicio_comentario,
    MAX(CASE WHEN o.obs_num = 1 THEN o.obs_tipoObserva END) AS inicio_tipoObserva,
    MAX(CASE WHEN o.obs_num = 1 THEN o.obs_imagen END) AS inicio_imagen,
    MAX(CASE WHEN o.obs_num = 1 THEN o.obs_fecha END) AS inicio_fecha,
    MAX(CASE WHEN o.obs_num = 2 THEN o.obs_comentario END) AS proces_comentario,
    MAX(CASE WHEN o.obs_num = 2 THEN o.obs_tipoObserva END) AS proces_tipoObserva,
    MAX(CASE WHEN o.obs_num = 2 THEN o.obs_imagen END) AS proces_imagen,
    MAX(CASE WHEN o.obs_num = 2 THEN o.obs_fecha END) AS proces_fecha,
    MAX(CASE WHEN o.obs_num = 3 THEN o.obs_comentario END) AS leccio_comentario,
    MAX(CASE WHEN o.obs_num = 3 THEN o.obs_tipoObserva END) AS leccio_tipoObserva,
    MAX(CASE WHEN o.obs_num = 3 THEN o.obs_imagen END) AS leccio_imagen,
    MAX(CASE WHEN o.obs_num = 3 THEN o.obs_fecha END) AS leccio_fecha,
    MAX(CASE WHEN o.obs_num = 4 THEN o.obs_comentario END) AS fin_comentario,
    MAX(CASE WHEN o.obs_num = 4 THEN o.obs_tipoObserva END) AS fin_tipoObserva,
    MAX(CASE WHEN o.obs_num = 4 THEN o.obs_imagen END) AS fin_imagen,
    MAX(CASE WHEN o.obs_num = 4 THEN o.obs_fecha END) AS fin_fecha
FROM 
    sckb_bitacora b
INNER JOIN (
    SELECT 
        obs_bitIdbitaco,
        obs_comentario,
        obs_tipoObserva,
        obs_imagen,
        obs_fecha,
        ROW_NUMBER() OVER(PARTITION BY obs_bitIdbitaco ORDER BY obs_fecha) AS obs_num
    FROM scko_observacion 
    WHERE obs_bitIdbitaco IN (
        SELECT bit_idbitacora 
        FROM sckb_bitacora 
        WHERE bit_usuarioId = ? 
          AND bit_situacion = 'F' 
          AND bit_estado = '1'
    )
) o ON b.bit_idbitacora = o.obs_bitIdbitaco AND o.obs_num <= 4
WHERE 
    b.bit_usuarioId = 1 
    AND b.bit_situacion = 'F' 
    AND b.bit_estado = '1'
GROUP BY 
    b.bit_idbitacora, 
    b.bit_cueIdCuentas, 
    b.bit_divisa, 
    b.bit_tipoOperaci, 
    b.bit_montoResult, 
    b.bit_resultado, 
    b.bit_precioEntra,
    b.bit_precioSL,
    b.bit_precioTP,
    b.bit_balance, 
    b.bit_situacion, 
    b.bit_fechaCrea,
    b.bit_fechaFin,
    b.bit_respeReglas
ORDER BY 
    b.bit_cueIdCuentas, 
    b.bit_fechaFin";
        return $this->conexion->ejecutarConsulta($sql, "i", $usuarioId);
    }*/


    public function obtenerOperacionesParaAnalisis($usuarioId)
    {
        $sql = "SELECT bit_idbitacora, bit_cueIdCuentas, bit_divisa, bit_tipoOperaci, bit_montoResult, bit_resultado, bit_precioEntra, bit_precioSL, bit_precioTP, bit_balance, bit_situacion, bit_fechaCrea, bit_fechaFin, bit_respeReglas
                FROM sckb_bitacora WHERE bit_usuarioId = ? AND bit_situacion = 'F' AND bit_estado = '1' ORDER BY bit_cueIdCuentas, bit_fechaFin";
        return $this->conexion->ejecutarConsulta($sql, "i", $usuarioId);
    }

    public function obtenerObservacionesParaAnalisis($usuarioId)
    {
        $sql = "SELECT obs_bitIdbitaco, obs_comentario, obs_tipoObserva, obs_imagen,obs_fecha FROM sckb_bitacora INNER JOIN scko_observacion ON bit_idbitacora = obs_bitIdbitaco 
                WHERE bit_usuarioId = ? AND bit_situacion = 'F' AND bit_estado = '1' ORDER BY obs_fecha";
        return $this->conexion->ejecutarConsulta($sql, "i", $usuarioId);
    }
}
