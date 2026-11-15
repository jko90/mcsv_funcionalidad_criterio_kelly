<?php

declare(strict_types=1);

require_once __DIR__ . '/../modelos/CriterioKellyMdl.php';
require_once __DIR__ . '/BaseCtrl.php';

class CriterioKellyCtrl extends BaseCtrl
{
    private const HORA_INICIO_DIA = ' 00:00:00';
    private const HORA_FIN_DIA = ' 23:59:59';

    private CriterioKellyMdl $criterioKellyModelo;

    public function __construct()
    {
        $this->criterioKellyModelo = new CriterioKellyMdl();
    }

    public function obtenerPorcentajeKellyIdCuenta(array $datos): void
    {
        try {
            $this->verificarUsuarioEnviado($datos['cke_usuarioId'] ?? null, 'criterioKelly/obtenerPorcentaje');
            $idUsuario = $this->idUsuarioSesion();
            $resultado = $this->criterioKellyModelo->obtenerPorcentajeKellyIdCuenta($idUsuario);
            $respuesta = [];
            foreach ($resultado as $cuenta) {
                $respuesta[] = [
                    'cke_idCritKelly' => (int) $cuenta['cke_idCritKelly'],
                    'cke_cueIdCuentas' => (int) $cuenta['cke_cueIdCuentas'],
                    'cke_usuarioId' => (int) $cuenta['cke_usuarioId'],
                    'cke_x100Kelly' => (float) $cuenta['cke_x100Kelly'],
                    'cke_numDivisor' => (int) $cuenta['cke_numDivisor'],
                    'cke_x100Operativo' => (float) $cuenta['cke_x100Operativo'],
                    'cke_montoOperar' => (float) $cuenta['cke_montoOperar'],
                    'cke_identifica' => $cuenta['cke_identifica'],
                ];
            }
            $this->respuestaExitosaSimple($respuesta);
        } catch (Throwable $error) {
            error_log('[CriterioKellyCtrl::obtenerPorcentajeKellyIdCuenta] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerResultadoPorIdentificador(array $datos): void
    {
        try {
            $this->verificarUsuarioEnviado($datos['cke_usuarioId'] ?? null, 'criterioKelly/obtenerResultados');
            $resultado = $this->criterioKellyModelo->obtenerResultadoPorIdentificador($this->idUsuarioSesion());
            $respuesta = [];
            foreach ($resultado as $cuenta) {
                $respuesta[] = [
                    'res_opeGanador' => (int) $cuenta['res_opeGanador'],
                    'res_x100Ganador' => (float) $cuenta['res_x100Ganador'],
                    'res_opePerdedor' => (int) $cuenta['res_opePerdedor'],
                    'res_x100Perdedor' => (float) $cuenta['res_x100Perdedor'],
                    'res_opeBreakEven' => (int) $cuenta['res_opeBreakEven'],
                    'res_x100BreakEven' => (float) $cuenta['res_x100BreakEven'],
                    'res_operAbierta' => (int) $cuenta['res_operAbierta'],
                    'res_x100Abierta' => (float) $cuenta['res_x100Abierta'],
                    'res_totalOperac' => (int) $cuenta['res_totalOperac'],
                    'res_x100Total' => (float) $cuenta['res_x100Total'],
                    'ren_montoTotal' => (float) $cuenta['ren_montoTotal'],
                    'res_identifica' => $cuenta['res_identifica'],
                ];
            }
            $this->respuestaExitosaSimple($respuesta);
        } catch (Throwable $error) {
            error_log('[CriterioKellyCtrl::obtenerResultadoPorIdentificador] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerDetalleOperaciones(array $datos): void
    {
        try {
            $this->verificarUsuarioEnviado($datos['cke_usuarioId'] ?? null, 'criterioKelly/detalleOperacion');
            $resultado = $this->criterioKellyModelo->obtenerDetalleOperaciones(
                $this->idUsuarioSesion(),
                $this->calcularFechaMinimaReporte(ControlPlan::limites())
            );
            $respuesta = [];
            foreach ($resultado as $operacion) {
                $respuesta[] = [
                    'cue_idCuentas' => (int) $operacion['bit_cueIdCuentas'],
                    'divisa' => $operacion['bit_divisa'],
                    'tipo_operacion' => $operacion['bit_tipoOperaci'],
                    'monto_resultado' => (float) $operacion['bit_montoResult'],
                    'resultado' => $operacion['bit_resultado'],
                    'balance' => (float) $operacion['bit_balance'],
                    'situacion' => $operacion['bit_situacion'],
                    'fecha_fin' => $operacion['bit_fechaFin'],
                ];
            }
            $this->respuestaExitosaSimple($respuesta);
        } catch (Throwable $error) {
            error_log('[CriterioKellyCtrl::obtenerDetalleOperaciones] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerOperacionesParaAnalisis(array $datos): void
    {
        try {
            $this->verificarUsuarioEnviado($datos['cke_usuarioId'] ?? null, 'criterioKelly/operacionAnalisis');
            $rango = $this->calcularRangoAnalisis($datos, ControlPlan::limites());
            $resultado = $this->criterioKellyModelo->obtenerOperacionesParaAnalisis(
                $this->idUsuarioSesion(),
                $rango['desde'],
                $rango['hasta'],
                $rango['maxPorCuenta']
            );
            $respuesta = [];
            foreach ($resultado as $operacion) {
                $respuesta[] = [
                    'id_bitacora' => (int) $operacion['bit_idbitacora'],
                    'cue_idCuentas' => (int) $operacion['bit_cueIdCuentas'],
                    'divisa' => $operacion['bit_divisa'],
                    'tipo_operacion' => $operacion['bit_tipoOperaci'],
                    'monto_resultado' => (float) $operacion['bit_montoResult'],
                    'resultado' => $operacion['bit_resultado'],
                    'precio_entrada' => (float) $operacion['bit_precioEntra'],
                    'precio_sl' => (float) $operacion['bit_precioSL'],
                    'precio_tp' => (float) $operacion['bit_precioTP'],
                    'balance' => (float) $operacion['bit_balance'],
                    'situacion' => $operacion['bit_situacion'],
                    'fecha_creacion' => $operacion['bit_fechaCrea'],
                    'fecha_fin' => $operacion['bit_fechaFin'],
                    'respeta_reglas' => $operacion['bit_respeReglas'],
                ];
            }
            $this->respuestaExitosaSimple($respuesta);
        } catch (Throwable $error) {
            error_log('[CriterioKellyCtrl::obtenerOperacionesParaAnalisis] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerObservacionesParaAnalisis(array $datos): void
    {
        try {
            $this->verificarUsuarioEnviado($datos['cke_usuarioId'] ?? null, 'criterioKelly/observacionAnalisis');
            $rango = $this->calcularRangoAnalisis($datos, ControlPlan::limites());
            $resultado = $this->criterioKellyModelo->obtenerObservacionesParaAnalisis(
                $this->idUsuarioSesion(),
                $rango['desde'],
                $rango['hasta'],
                $rango['maxPorCuenta']
            );
            $respuesta = [];
            foreach ($resultado as $observacion) {
                $respuesta[] = [
                    'bitacora_id' => (int) $observacion['obs_bitIdbitaco'],
                    'comentario' => $observacion['obs_comentario'],
                    'tipo_observa' => $observacion['obs_tipoObserva'],
                    'imagen' => $observacion['obs_imagen'],
                    'fecha' => $observacion['obs_fecha'],
                ];
            }
            $this->respuestaExitosaSimple($respuesta);
        } catch (Throwable $error) {
            error_log('[CriterioKellyCtrl::obtenerObservacionesParaAnalisis] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /** "Últimos N días" incluye hoy: desde (hoy UTC - (N - 1)) a las 00:00:00. Nulo si el plan no limita. */
    private function calcularFechaMinimaReporte(array $limites): ?string
    {
        $diasReporte = $limites['diasReporte'] ?? null;
        if ($diasReporte === null) {
            return null;
        }
        return $this->inicioDeVentana(ControlPlan::hoyUtc(), (int) $diasReporte)->format('Y-m-d') . self::HORA_INICIO_DIA;
    }

    /**
     * Rango del análisis según el plan. `fechaDesde` y `fechaHasta` (YYYY-MM-DD) son opcionales; el rango se recorta
     * a diasAnalisis y nunca empieza antes de la ventana total diasTotalesAnalisis. La cota superior solo se aplica
     * cuando el cliente envía fechaHasta (bit_fechaFin se guarda en hora local del servidor, no en UTC).
     *
     * @return array{desde:?string, hasta:?string, maxPorCuenta:?int}
     */
    private function calcularRangoAnalisis(array $datos, array $limites): array
    {
        $fechaDesde = $this->leerFechaOpcional($datos['fechaDesde'] ?? null, 'fechaDesde');
        $fechaHasta = $this->leerFechaOpcional($datos['fechaHasta'] ?? null, 'fechaHasta');
        if ($fechaDesde !== null && $fechaHasta !== null && $fechaDesde > $fechaHasta) {
            $this->respuestaErrorSimple('El rango de fechas es inválido', 400);
        }

        $hoy = ControlPlan::hoyUtc();
        $referencia = $fechaHasta !== null ? new DateTimeImmutable($fechaHasta, LectorPlanVigente::zonaUtc()) : $hoy;
        $desde = $fechaDesde;
        $diasAnalisis = $limites['diasAnalisis'] ?? null;
        if ($diasAnalisis !== null) {
            $inicioPermitido = $this->inicioDeVentana($referencia, (int) $diasAnalisis)->format('Y-m-d');
            if ($desde === null || $desde < $inicioPermitido) {
                $desde = $inicioPermitido;
            }
        }
        $diasTotales = $limites['diasTotalesAnalisis'] ?? null;
        if ($diasTotales !== null) {
            $inicioVentanaTotal = $this->inicioDeVentana($hoy, (int) $diasTotales)->format('Y-m-d');
            if ($desde === null || $desde < $inicioVentanaTotal) {
                $desde = $inicioVentanaTotal;
            }
        }

        return [
            'desde' => $desde !== null ? $desde . self::HORA_INICIO_DIA : null,
            'hasta' => $fechaHasta !== null ? $fechaHasta . self::HORA_FIN_DIA : null,
            'maxPorCuenta' => $limites['maxOperacionesAnalisis'] ?? null,
        ];
    }

    private function inicioDeVentana(DateTimeImmutable $referencia, int $dias): DateTimeImmutable
    {
        return $referencia->modify('-' . max($dias - 1, 0) . ' day');
    }

    private function leerFechaOpcional(mixed $valor, string $campo): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        return $this->leerFecha($valor, $campo);
    }
}