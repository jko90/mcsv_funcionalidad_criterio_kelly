<?php

require_once(__DIR__ . '/../modelos/BitacoraMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class BitacoraCtrl extends BaseCtrl
{
    private $bitacoraService;

    public function __construct()
    {
        $this->bitacoraService = new BitacoraMdl();
    }


    public function crearBitacora($data)
    {
        try {
            // Validar campos requeridos (incluyendo observación)
            $errores = $this->validarDatos($data, [
                'bit_usuarioId',
                'bit_cueIdCuentas',
                'bit_divisa',
                'bit_tipoOperaci',
                'bit_fechaCrea'
            ]);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validar que bit_usuarioId sea un entero válido
            $usuarioId = (int)$datosLimpios['bit_usuarioId'];
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            // Validar que bit_cueIdCuentas sea un entero válido
            $cuentaId = (int)$datosLimpios['bit_cueIdCuentas'];
            if ($cuentaId <= 0) {
                $this->respuestaErrorSimple('ID de cuenta inválido', 400);
            }

            // Validar número de bitácora
            $numeroBitac = isset($datosLimpios['bit_numeroBitac']) ? (int)$datosLimpios['bit_numeroBitac'] : 1;
            if ($numeroBitac < 0) {
                $this->respuestaErrorSimple('Número de bitácora inválido', 400);
            }

            // Validar divisa
            $divisa = trim($datosLimpios['bit_divisa']);
            if (strlen($divisa) > 32) {
                $this->respuestaErrorSimple('La divisa no puede exceder 32 caracteres', 400);
            }

            // Validar tipo de operación
            $tipoOperacion = strtoupper(trim($datosLimpios['bit_tipoOperaci']));
            if (!in_array($tipoOperacion, ['COMPRA', 'VENTA'])) {
                $this->respuestaErrorSimple('Tipo de operación inválido. Debe ser COMPRA o VENTA', 400);
            }

            $fechCrea = isset($datosLimpios['bit_fechaCrea']) ? $datosLimpios['bit_fechaCrea'] : null;
            if ($fechCrea && !empty(trim($fechCrea))) {
                $fechCrea = trim($fechCrea);
                if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $fechCrea)) {
                    $this->respuestaErrorSimple('Formato de fecha fin inválido. Use formato ISO 8601', 400);
                }
            } else {
                $fechCrea = date('Y-m-d\TH:i:s');
            }


            $precioEntra = isset($datosLimpios['bit_precioEntra']) ? (float)$datosLimpios['bit_precioEntra'] : 0;
            $precioSL = isset($datosLimpios['bit_precioSL']) ? (float)$datosLimpios['bit_precioSL'] : 0;
            $precioTP = isset($datosLimpios['bit_precioTP']) ? (float)$datosLimpios['bit_precioTP'] : 0;

            // Validar campos de observación
            $obsComentario = trim($datosLimpios['obs_comentario']);
            if (strlen($obsComentario) > 4096) {
                $this->respuestaErrorSimple('El comentario no puede exceder 4096 caracteres', 400);
            }

            $obsTipoObserva = strtoupper(trim($datosLimpios['obs_tipoObserva']));
            if (!in_array($obsTipoObserva, ['I', 'O', 'R'])) {
                $this->respuestaErrorSimple('Tipo de observación inválido. Debe ser I (inicio), O (operación) o R (respuesta)', 400);
            }

            $obsImagen = isset($datosLimpios['obs_imagen']) ? $datosLimpios['obs_imagen'] : null;

            // Ejecutar inserción (bitácora + observación)
            $resultadoInsercion = $this->bitacoraService->crearBitacora(
                $usuarioId,
                $cuentaId,
                $numeroBitac,
                $divisa,
                $tipoOperacion,
                $precioEntra,
                $precioSL,
                $precioTP,
                $obsComentario,
                $obsTipoObserva,
                $obsImagen,
                $fechCrea
            );

            if (!$resultadoInsercion || is_string($resultadoInsercion)) {
                $mensaje = is_string($resultadoInsercion) ? $resultadoInsercion : 'No se pudo crear el registro de bitácora';
                $this->respuestaErrorSimple($mensaje, 500);
            }

            $this->respuestaExitosaSimple($resultadoInsercion);
        } catch (Exception $e) {
            error_log("Error en crearBitacora: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    /**
     * Obtiene la bitácora de operaciones para un usuario y una cuenta específica.
     *
     * @param array $data Datos de entrada que deben contener 'bit_usuarioId' y 'bit_cueIdCuentas'.
     */
    public function obtenerBitacoraPorCuenta($data)
    {
        try {
            // Validar que el idUsuario no esté vacío
            $errores = $this->validarDatos($data, ['bit_usuarioId', 'bit_cueIdCuentas']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $datosLimpios = $this->limpiarDatos($data);
            $bitacora = $this->bitacoraService->obtenerBitacoraPorCuenta($datosLimpios['bit_usuarioId'], $datosLimpios['bit_cueIdCuentas']);

            if (!$bitacora || empty($bitacora)) {
                $this->respuestaErrorSimple('No se encontraron registros de bitácora para la cuenta especificada', 404);
            }

            $datosBitacora = [];
            foreach ($bitacora as $registro) {
                $datosBitacora[] = [
                    'bit_idbitacora' => (int)$registro['bit_idbitacora'],
                    'bit_usuarioId' => (int)$registro['bit_usuarioId'],
                    'bit_cueIdCuentas' => (int)$registro['bit_cueIdCuentas'],
                    'bit_numeroBitac' => (int)($registro['bit_numeroBitac'] ?? 1),
                    'bit_divisa' => $registro['bit_divisa'] ?? 'EURUSD',
                    'bit_tipoOperaci' => $registro['bit_tipoOperaci'] ?? 'COMPRA',
                    'bit_precioEntra' => (float)($registro['bit_precioEntra'] ?? 0),
                    'bit_precioSL' => (float)($registro['bit_precioSL'] ?? 0),
                    'bit_precioTP' => (float)($registro['bit_precioTP'] ?? 0),
                    'bit_pipTotal' => (float)($registro['bit_pipTotal'] ?? 0),
                    'bit_montoOpera' => (float)($registro['bit_montoOpera'] ?? 0),
                    'bit_montoResult' => (float)($registro['bit_montoResult'] ?? 0),
                    'bit_resultado' => $registro['bit_resultado'] ?? 'GANADOR',
                    'bit_balance' => (float)($registro['bit_balance'] ?? 0),
                    'bit_situacion' => $registro['bit_situacion'] ?? 'A',
                    'bit_fechaCrea' => $registro['bit_fechaCrea'] ?? null,
                    'bit_fechaFin' => $registro['bit_fechaFin'] ?? null,
                    'bit_respeReglas' => $registro['bit_respeReglas'] ?? 'SI',
                    'bit_estado' => $registro['bit_estado'] ?? '1'
                ];
            }

            $this->respuestaExitosaSimple($datosBitacora);
        } catch (Exception $e) {
            error_log("Error en obtenerBitacoraPorCuenta: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /**
     * Elimina una bitácora y sus observaciones asociadas.
     *
     * @param int $id ID de la bitácora a eliminar.
     */
    public function eliminarBitacoraBitacora($id)
    {
        try {
            // Validar que el idBitacora no esté vacío
            if (empty(trim($id))) {
                $this->respuestaErrorSimple('El ID de bitácora es requerido', 400);
            }

            $idBitacoraLimpio = htmlspecialchars(trim($id), ENT_QUOTES, 'UTF-8');
            $idBitacora = (int)$idBitacoraLimpio;
            if ($idBitacora <= 0) {
                $this->respuestaErrorSimple('ID de bitácora inválido', 400);
            }

            $this->bitacoraService->eliminarObservacion($idBitacora);
            $eliminacionBitacora = $this->bitacoraService->eliminarBitacoraError($idBitacora);

            if ($eliminacionBitacora === false || $eliminacionBitacora === 0) {
                $this->respuestaErrorSimple('Error al eliminar la bitácora', 404);
                return;
            }

            $this->respuestaExitosaSimple(["success" => $idBitacora]);
        } catch (Exception $e) {
            error_log("Error en eliminarBitacoraBitacora: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
