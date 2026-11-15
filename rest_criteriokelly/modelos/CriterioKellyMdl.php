<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class CriterioKellyMdl
{
    /** Valor máximo de INT: equivale a "sin tope" en el filtro de posición por cuenta. */
    private const SIN_TOPE_POR_CUENTA = 2147483647;

    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function obtenerPorcentajeKellyIdCuenta(int $idUsuario)
    {
        $sqlUltimoKellyDeCuentaPropia = 'SELECT t1.cke_idCritKelly, t1.cke_cueIdCuentas,
                t1.cke_usuarioId, t1.cke_x100Kelly, t1.cke_numDivisor,
                t1.cke_x100Operativo, t1.cke_montoOperar, t1.cke_identifica
            FROM sckp_criteriokelly t1
            INNER JOIN sckc_cuentas cue
                ON cue.cue_idCuentas = t1.cke_cueIdCuentas
                AND cue.cue_usuarioId = ?
            WHERE t1.cke_usuarioId = ?
            AND t1.cke_fecha = (
                SELECT MAX(t2.cke_fecha) FROM sckp_criteriokelly t2
                WHERE t2.cke_cueIdCuentas = t1.cke_cueIdCuentas
                AND t2.cke_usuarioId = ?
            )';
        return $this->conexion->ejecutarConsulta(
            $sqlUltimoKellyDeCuentaPropia,
            'iii',
            $idUsuario,
            $idUsuario,
            $idUsuario
        );
    }

    public function obtenerResultadoPorIdentificador(int $idUsuario)
    {
        $sqlUltimoResultadoDeCuentaPropia = 'SELECT resu.res_opeGanador,
                resu.res_x100Ganador, resu.res_opePerdedor, resu.res_x100Perdedor,
                resu.res_opeBreakEven, resu.res_x100BreakEven, resu.res_operAbierta,
                resu.res_x100Abierta, resu.res_totalOperac, resu.res_x100Total,
                rent.ren_montoTotal, resu.res_identifica
            FROM sckr_resultado resu
            INNER JOIN sckr_rentabilidad rent ON resu.res_identifica = rent.ren_identifica
            INNER JOIN sckp_criteriokelly kell ON resu.res_identifica = kell.cke_identifica
            INNER JOIN sckc_cuentas cue
                ON cue.cue_idCuentas = resu.res_cueIdCuentas
                AND cue.cue_usuarioId = ?
            WHERE kell.cke_usuarioId = ?
            AND kell.cke_fecha = (
                SELECT MAX(t2.cke_fecha) FROM sckp_criteriokelly t2
                WHERE t2.cke_cueIdCuentas = resu.res_cueIdCuentas
                AND t2.cke_usuarioId = ?
            )';
        return $this->conexion->ejecutarConsulta(
            $sqlUltimoResultadoDeCuentaPropia,
            'iii',
            $idUsuario,
            $idUsuario,
            $idUsuario
        );
    }

    /** Con $fechaMinima nula devuelve todo el historial; si no, solo bit_fechaFin >= $fechaMinima. */
    public function obtenerDetalleOperaciones(int $idUsuario, ?string $fechaMinima = null)
    {
        $filtroFechaMinima = $fechaMinima !== null ? ' AND b.bit_fechaFin >= ?' : '';
        $sqlDetalleOperacionesPropias = 'SELECT b.bit_cueIdCuentas, b.bit_divisa,
                b.bit_tipoOperaci, b.bit_montoResult, b.bit_resultado,
                b.bit_balance, b.bit_situacion, b.bit_fechaFin
            FROM sckb_bitacora b
            INNER JOIN sckc_cuentas cue
                ON cue.cue_idCuentas = b.bit_cueIdCuentas
                AND cue.cue_usuarioId = ?
            WHERE b.bit_usuarioId = ? AND b.bit_situacion = "F" AND b.bit_estado = "1"'
            . $filtroFechaMinima . '
            ORDER BY b.bit_cueIdCuentas, b.bit_fechaFin';
        $parametros = $fechaMinima !== null ? [$idUsuario, $idUsuario, $fechaMinima] : [$idUsuario, $idUsuario];
        return $this->conexion->ejecutarConsulta(
            $sqlDetalleOperacionesPropias,
            $fechaMinima !== null ? 'iis' : 'ii',
            ...$parametros
        );
    }

    /**
     * Operaciones finalizadas del rango, como máximo $maxPorCuenta por cuenta (las más recientes),
     * en orden de cuenta y fecha. Los límites nulos no filtran.
     */
    public function obtenerOperacionesParaAnalisis(
        int $idUsuario,
        ?string $desde = null,
        ?string $hasta = null,
        ?int $maxPorCuenta = null
    ) {
        $sqlOperacionesParaAnalisisPropias = 'SELECT p.bit_idbitacora,
                p.bit_cueIdCuentas, p.bit_divisa, p.bit_tipoOperaci,
                p.bit_montoResult, p.bit_resultado, p.bit_precioEntra,
                p.bit_precioSL, p.bit_precioTP, p.bit_balance, p.bit_situacion,
                p.bit_fechaCrea, p.bit_fechaFin, p.bit_respeReglas
            FROM (' . $this->sqlBitacorasDeAnalisis($desde, $hasta) . ') p
            WHERE p.posicionReciente <= ?
            ORDER BY p.bit_cueIdCuentas, p.bit_fechaFin, p.bit_idbitacora';
        return $this->conexion->ejecutarConsulta(
            $sqlOperacionesParaAnalisisPropias,
            $this->tiposAnalisis($desde, $hasta),
            ...$this->parametrosAnalisis($idUsuario, $desde, $hasta, $maxPorCuenta)
        );
    }

    /** Observaciones solo de las bitácoras que devolvería obtenerOperacionesParaAnalisis con los mismos límites. */
    public function obtenerObservacionesParaAnalisis(
        int $idUsuario,
        ?string $desde = null,
        ?string $hasta = null,
        ?int $maxPorCuenta = null
    ) {
        $sqlObservacionesParaAnalisisPropias = 'SELECT p.bit_cueIdCuentas,
                o.obs_bitIdbitaco, o.obs_comentario, o.obs_tipoObserva,
                o.obs_imagen, o.obs_fecha
            FROM (' . $this->sqlBitacorasDeAnalisis($desde, $hasta) . ') p
            INNER JOIN scko_observacion o ON p.bit_idbitacora = o.obs_bitIdbitaco
            WHERE p.posicionReciente <= ?
            ORDER BY o.obs_fecha';
        return $this->conexion->ejecutarConsulta(
            $sqlObservacionesParaAnalisisPropias,
            $this->tiposAnalisis($desde, $hasta),
            ...$this->parametrosAnalisis($idUsuario, $desde, $hasta, $maxPorCuenta)
        );
    }

    /** Bitácoras propias finalizadas del rango, numeradas por cuenta de la más reciente a la más antigua. */
    private function sqlBitacorasDeAnalisis(?string $desde, ?string $hasta): string
    {
        $filtroDesde = $desde !== null ? ' AND b.bit_fechaFin >= ?' : '';
        $filtroHasta = $hasta !== null ? ' AND b.bit_fechaFin <= ?' : '';
        return 'SELECT b.bit_idbitacora, b.bit_cueIdCuentas, b.bit_divisa, b.bit_tipoOperaci,
                b.bit_montoResult, b.bit_resultado, b.bit_precioEntra, b.bit_precioSL,
                b.bit_precioTP, b.bit_balance, b.bit_situacion, b.bit_fechaCrea,
                b.bit_fechaFin, b.bit_respeReglas,
                ROW_NUMBER() OVER (PARTITION BY b.bit_cueIdCuentas
                    ORDER BY b.bit_fechaFin DESC, b.bit_idbitacora DESC) AS posicionReciente
            FROM sckb_bitacora b
            INNER JOIN sckc_cuentas cue
                ON cue.cue_idCuentas = b.bit_cueIdCuentas
                AND cue.cue_usuarioId = ?
            WHERE b.bit_usuarioId = ? AND b.bit_situacion = "F" AND b.bit_estado = "1"'
            . $filtroDesde . $filtroHasta;
    }

    private function tiposAnalisis(?string $desde, ?string $hasta): string
    {
        return 'ii' . ($desde !== null ? 's' : '') . ($hasta !== null ? 's' : '') . 'i';
    }

    private function parametrosAnalisis(int $idUsuario, ?string $desde, ?string $hasta, ?int $maxPorCuenta): array
    {
        $parametros = [$idUsuario, $idUsuario];
        if ($desde !== null) {
            $parametros[] = $desde;
        }
        if ($hasta !== null) {
            $parametros[] = $hasta;
        }
        $parametros[] = $maxPorCuenta ?? self::SIN_TOPE_POR_CUENTA;
        return $parametros;
    }
}
