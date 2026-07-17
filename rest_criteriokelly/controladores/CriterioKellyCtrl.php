<?php

require_once(__DIR__ . '/../modelos/CriterioKellyMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class CriterioKellyCtrl extends BaseCtrl
{
    private $kellyService;

    public function __construct()
    {
        $this->kellyService = new CriterioKellyMdl();
    }

    /**
     * Obtiene las reglas Kelly para una cuenta específica.
     *
     * @param array $data Datos de entrada que deben contener 'cke_cueIdCuentas' y 'cke_usuarioId'.
     * @return void
     */
    public function obtenerPorcentajeKellyIdCuenta($data)
    {
        try {
            $errores = $this->validarDatos($data, ['cke_usuarioId']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $datosLimpios = $this->limpiarDatos($data);
            $usuarioId = (int)$datosLimpios['cke_usuarioId'];
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            $resultado = $this->kellyService->obtenerPorcentajeKellyIdCuenta($usuarioId);
            if (!$resultado || empty($resultado)) {
                $this->respuestaErrorSimple('No se encontró el porcentaje Kelly para la cuenta especificada', 404);
            }

            $datosCriterioKelly = [];
            foreach ($resultado as $cuenta) {
                $datosCriterioKelly[] = [
                    'cke_idCritKelly' => (int)($cuenta['cke_idCritKelly'] ?? 0),
                    'cke_cueIdCuentas' => (int)($cuenta['cke_cueIdCuentas'] ?? 0),
                    'cke_usuarioId' => (int)($cuenta['cke_usuarioId'] ?? 0),
                    'cke_x100Kelly' => (float)($cuenta['cke_x100Kelly'] ?? 0.0),
                    'cke_numDivisor' => (int)($cuenta['cke_numDivisor'] ?? 1),
                    'cke_x100Operativo' => (float)($cuenta['cke_x100Operativo'] ?? 0.0),
                    'cke_montoOperar' => (float)($cuenta['cke_montoOperar'] ?? 0.0),
                    'cke_identifica' => $cuenta['cke_identifica'] ?? null
                ];
            }
            return $this->respuestaExitosaSimple($datosCriterioKelly, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple($e->getMessage(), 500);
        }
    }


    public function obtenerResultadoPorIdentificador($data)
    {
        try {

            $errores = $this->validarDatos($data, ['cke_usuarioId']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $datosLimpios = $this->limpiarDatos($data);

            $usuarioId = $datosLimpios['cke_usuarioId'];
            if (empty($usuarioId)) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            $resultado = $this->kellyService->obtenerResultadoPorIdentificador($usuarioId);
            if (!$resultado || empty($resultado)) {
                $this->respuestaErrorSimple('No se encontró el resultado para el identificador especificado', 404);
            }

            $datosResultado = [];
            foreach ($resultado as $cuenta) {
                $datosResultado[] = [
                    'res_opeGanador' => (int)($cuenta['res_opeGanador'] ?? 0),
                    'res_x100Ganador' => (float)($cuenta['res_x100Ganador'] ?? 0.0),
                    'res_opePerdedor' => (int)($cuenta['res_opePerdedor'] ?? 0),
                    'res_x100Perdedor' => (float)($cuenta['res_x100Perdedor'] ?? 0.0),
                    'res_opeBreakEven' => (int)($cuenta['res_opeBreakEven'] ?? 0),
                    'res_x100BreakEven' => (float)($cuenta['res_x100BreakEven'] ?? 0.0),
                    'res_operAbierta' => (int)($cuenta['res_operAbierta'] ?? 0),
                    'res_x100Abierta' => (float)($cuenta['res_x100Abierta'] ?? 0.0),
                    'res_totalOperac' => (int)($cuenta['res_totalOperac'] ?? 0),
                    'res_x100Total' => (float)($cuenta['res_x100Total'] ?? 100.0),
                    'ren_montoTotal' => (float)($cuenta['ren_montoTotal'] ?? 0.0),
                    'res_identifica' => $cuenta['res_identifica'] ?? null
                ];
            }

            return $this->respuestaExitosaSimple($datosResultado, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple($e->getMessage(), 500);
        }
    }

    /**
     * Obtener detalles de las operaciones de un usuario específico.
     */
    public function obtenerDetalleOperaciones($data)
    {
        try {
            $errores = $this->validarDatos($data, ['cke_usuarioId']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $datosLimpios = $this->limpiarDatos($data);
            $usuarioId = (int)$datosLimpios['cke_usuarioId'];
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            $resultado = $this->kellyService->obtenerDetalleOperaciones($usuarioId);
            if (!$resultado || empty($resultado)) {
                $this->respuestaErrorSimple('No se encontraron detalles de operaciones para el usuario especificado', 404);
                return;
            }

            $datosOperaciones = [];
            foreach ($resultado as $operacion) {
                $datosOperaciones[] = [
                    'cue_idCuentas'   => (int)($operacion['bit_cueIdCuentas'] ?? 0),
                    'divisa'          => $operacion['bit_divisa'] ?? '',
                    'tipo_operacion'  => $operacion['bit_tipoOperaci'] ?? '',
                    'monto_resultado' => (float)($operacion['bit_montoResult'] ?? 0.0),
                    'resultado'       => $operacion['bit_resultado'] ?? '',
                    'balance'         => (float)($operacion['bit_balance'] ?? 0.0),
                    'situacion'       => $operacion['bit_situacion'] ?? '',
                    'fecha_fin'       => $operacion['bit_fechaFin'] ?? null
                ];
            }
            return $this->respuestaExitosaSimple($datosOperaciones, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple($e->getMessage(), 500);
        }
    }


    public function obtenerOperacionesParaAnalisis($data)
    {
        try {
            $errores = $this->validarDatos($data, ['cke_usuarioId']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $datosLimpios = $this->limpiarDatos($data);
            $usuarioId = (int)$datosLimpios['cke_usuarioId'];
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            $resultado = $this->kellyService->obtenerOperacionesParaAnalisis($usuarioId);
            if (!$resultado || empty($resultado)) {
                $this->respuestaErrorSimple('No se encontraron detalles de operaciones para el usuario especificado', 404);
                return;
            }

            $datosOperaciones = [];
            foreach ($resultado as $operacion) {
                $datosOperaciones[] = [
                    'id_bitacora'     => (int)($operacion['bit_idbitacora'] ?? 0),
                    'cue_idCuentas'   => (int)($operacion['bit_cueIdCuentas'] ?? 0),
                    'divisa'          => $operacion['bit_divisa'] ?? '',
                    'tipo_operacion'  => $operacion['bit_tipoOperaci'] ?? '',
                    'monto_resultado' => (float)($operacion['bit_montoResult'] ?? 0.0),
                    'resultado'       => $operacion['bit_resultado'] ?? '',
                    'precio_entrada'  => (float)($operacion['bit_precioEntra'] ?? 0.0),
                    'precio_sl'       => (float)($operacion['bit_precioSL'] ?? 0.0),
                    'precio_tp'       => (float)($operacion['bit_precioTP'] ?? 0.0),
                    'balance'         => (float)($operacion['bit_balance'] ?? 0.0),
                    'situacion'       => $operacion['bit_situacion'] ?? '',
                    'fecha_creacion'  => $operacion['bit_fechaCrea'] ?? null,
                    'fecha_fin'       => $operacion['bit_fechaFin'] ?? null,
                    'respeta_reglas'  => $operacion['bit_respeReglas'] ?? ''
                ];
            }
            return $this->respuestaExitosaSimple($datosOperaciones, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple($e->getMessage(), 500);
        }
    }

    public function obtenerObservacionesParaAnalisis($data)
    {
        try {
            $errores = $this->validarDatos($data, ['cke_usuarioId']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $datosLimpios = $this->limpiarDatos($data);
            $usuarioId = (int)$datosLimpios['cke_usuarioId'];
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            $resultado = $this->kellyService->obtenerObservacionesParaAnalisis($usuarioId);
            if (!$resultado || empty($resultado)) {
                $this->respuestaErrorSimple('No se encontraron detalles de operaciones para el usuario especificado', 404);
                return;
            }

            $datosOperaciones = [];
            foreach ($resultado as $operacion) {
                $datosOperaciones[] = [
                    'bitacora_id'     => (int)($operacion['obs_bitIdbitaco'] ?? 0),
                    'comentario'      => $operacion['obs_comentario'] ?? '',
                    'tipo_observa'    => $operacion['obs_tipoObserva'] ?? '',
                    'imagen'          => $operacion['obs_imagen'] ?? '',
                    'fecha'           => $operacion['obs_fecha'] ?? null
                ];
            }
            return $this->respuestaExitosaSimple($datosOperaciones, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple($e->getMessage(), 500);
        }
    }
}
