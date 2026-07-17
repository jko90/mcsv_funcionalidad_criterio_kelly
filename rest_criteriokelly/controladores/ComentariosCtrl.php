<?php

require_once(__DIR__ . '/../modelos/ComentariosMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class ComentariosCtrl extends BaseCtrl
{
    private $comentariosServicio;

    public function __construct()
    {
        $this->comentariosServicio = new ComentariosMdl();
    }


        /**
     * Crea un comentario asociado a una bitácora.
     *
     * @param array $data Datos del comentario que deben contener 'obs_bitIdbitaco', 'obs_comentario' y 'obs_tipoObserva'.
     */
    public function crearComentarioPorBitacora($data)
    {
        try {
            $resultados = [];
            $errores = [];

            // Si el input es un solo comentario, lo convertimos en array
            if (!is_array($data) || (is_array($data) && isset($data['obs_bitIdbitaco']))) {
                $data = [$data];
            }

            foreach ($data as $index => $comentario) {
                // Validar campos requeridos
                $camposRequeridos = ['obs_bitIdbitaco', 'obs_comentario', 'obs_tipoObserva'];
                $erroresValidacion = $this->validarDatos($comentario, $camposRequeridos);
                if (!empty($erroresValidacion)) {
                    $errores[] = "Comentario #$index: " . implode(', ', $erroresValidacion);
                    continue;
                }

                // Limpiar datos de entrada
                $datosLimpios = $this->limpiarDatos($comentario);

                // Validar longitud de comentario
                $obsComentario = trim($datosLimpios['obs_comentario']);
                if (strlen($obsComentario) > 4096) {
                    $errores[] = "Comentario #$index: El comentario no puede exceder 4096 caracteres";
                    continue;
                }

                // Validar tipo de observación (ahora acepta cualquier valor, pero debe existir)
                $obsTipoObserva = strtoupper(trim($datosLimpios['obs_tipoObserva']));
                if (empty($obsTipoObserva)) {
                    $errores[] = "Comentario #$index: El tipo de observación es requerido";
                    continue;
                }

                $obsImagen = isset($datosLimpios['obs_imagen']) ? $datosLimpios['obs_imagen'] : null;

                // Ejecutar inserción o actualización
                $validarObservacion = $this->comentariosServicio->validarObservacion($obsTipoObserva, $datosLimpios['obs_bitIdbitaco']);
                if ($validarObservacion) {
                    $this->comentariosServicio->sobreEscribirObservacion(
                        $datosLimpios['obs_bitIdbitaco'],
                        $obsTipoObserva,
                        $obsComentario,
                        $obsImagen
                    );
                } else {
                    $this->comentariosServicio->crearComentariosPorBitacora(
                        $datosLimpios['obs_bitIdbitaco'],
                        $obsComentario,
                        $obsTipoObserva,
                        $obsImagen
                    );
                }

                // Consultar el registro (si existe, es éxito)
                $comentarioObj = $this->comentariosServicio->validarObservacion($obsTipoObserva, $datosLimpios['obs_bitIdbitaco']);
                if (!$comentarioObj) {
                    $mensaje = 'No se pudo crear el registro de bitácora';
                    $errores[] = "Comentario #$index: $mensaje";
                    continue;
                }

                $resultados[] = [
                    'obs_idObserva'    => isset($comentarioObj['obs_idObserva']) ? (int)$comentarioObj['obs_idObserva'] : null,
                    'obs_bitIdbitaco'  => isset($comentarioObj['obs_bitIdbitaco']) ? (int)$comentarioObj['obs_bitIdbitaco'] : (int)$datosLimpios['obs_bitIdbitaco'],
                    'obs_comentario'   => $comentarioObj['obs_comentario'] ?? $obsComentario,
                    'obs_tipoObserva'  => $comentarioObj['obs_tipoObserva'] ?? $obsTipoObserva,
                    'obs_imagen'       => $comentarioObj['obs_imagen'] ?? $obsImagen,
                    'obs_fecha'        => $comentarioObj['obs_fecha'] ?? null
                ];
            }

            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode('; ', $errores), 400);
                return;
            }

            $this->respuestaExitosaSimple($resultados);
        } catch (Exception $e) {
            error_log("Error en crearComentarioPorBitacora: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    /**
     * Actualiza un comentario de una bitácora.
     *
     * @param array $data Datos de entrada que deben contener 'bit_idbitacora', 'obs_idObserva', 'obs_comentario', 'obs_imagen', 'bit_precioEntra', 'bit_precioSL', 'bit_precioTP'.
     */
    public function actualizarBitacoraComentario($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['bit_idbitacora', 'obs_idObserva']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validar que bit_idbitacora sea un entero válido
            $idBitacora = (int)$datosLimpios['bit_idbitacora'];
            if ($idBitacora <= 0) {
                $this->respuestaErrorSimple('ID de bitácora inválido', 400);
            }

            // Validar que obs_idObserva sea un entero válido
            $idObservacion = (int)$datosLimpios['obs_idObserva'];
            if ($idObservacion <= 0) {
                $this->respuestaErrorSimple('ID de observación inválido', 400);
            }

            // Validar precios si están presentes
            $precioEntra = null;
            if (isset($datosLimpios['bit_precioEntra'])) {
                if (!is_numeric($datosLimpios['bit_precioEntra'])) {
                    $this->respuestaErrorSimple('El precio de entrada debe ser un valor numérico', 400);
                }
                $precioEntra = (float)$datosLimpios['bit_precioEntra'];
                if ($precioEntra <= 0) {
                    $this->respuestaErrorSimple('El precio de entrada debe ser mayor a 0', 400);
                }
            }

            $precioSL = null;
            if (isset($datosLimpios['bit_precioSL'])) {
                if (!is_numeric($datosLimpios['bit_precioSL'])) {
                    $this->respuestaErrorSimple('El precio SL debe ser un valor numérico', 400);
                }
                $precioSL = (float)$datosLimpios['bit_precioSL'];
            }

            $precioTP = null;
            if (isset($datosLimpios['bit_precioTP'])) {
                if (!is_numeric($datosLimpios['bit_precioTP'])) {
                    $this->respuestaErrorSimple('El precio TP debe ser un valor numérico', 400);
                }
                $precioTP = (float)$datosLimpios['bit_precioTP'];
            }

            // Validar campos de observación
            $obsComentario = null;
            if (isset($datosLimpios['obs_comentario'])) {
                $obsComentario = trim($datosLimpios['obs_comentario']);
                if (strlen($obsComentario) > 4096) {
                    $this->respuestaErrorSimple('El comentario no puede exceder 4096 caracteres', 400);
                }
            }

            $obsImagen = isset($datosLimpios['obs_imagen']) ? trim($datosLimpios['obs_imagen']) : null;

            // Ejecutar actualización
            $resultado = $this->comentariosServicio->actualizarBitacoraTPBESL(
                $idBitacora,
                $precioEntra,
                $precioSL,
                $precioTP,
            );

            $resultadoObservacion = $this->comentariosServicio->actualizarObservacion(
                $idObservacion,
                $obsComentario,
                $obsImagen
            );

            // Corregir la lógica: usar OR en lugar de AND
            if ((!$resultado || is_string($resultado)) || (!$resultadoObservacion || is_string($resultadoObservacion))) {
                $mensaje = 'No se pudo actualizar el registro';
                if (is_string($resultado)) {
                    $mensaje = $resultado;
                } elseif (is_string($resultadoObservacion)) {
                    $mensaje = $resultadoObservacion;
                }
                $this->respuestaErrorSimple($mensaje, 500);
                return;
            }

            $respuesta = [
                'bit_idbitacora' => $idBitacora,
                'bit_precioEntra' => $precioEntra,
                'bit_precioSL' => $precioSL,
                'bit_precioTP' => $precioTP,
                'obs_comentario' => $obsComentario,
                'obs_idObserva' => $idObservacion,
                'obs_imagen' => $obsImagen
            ];

            $this->respuestaExitosaSimple($respuesta);
        } catch (Exception $e) {
            error_log("Error en actualizarBitacoraComentario: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }




    /**
     * Obtiene las observaciones asociadas a una bitácora específica.
     *
     * @param int $id ID de la bitácora.
     */
    public function ObtenerObservacionesPorBitacora($id)
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

            $observaciones = $this->comentariosServicio->obtenerComentariosPorBitacora($idBitacora);

            if (!$observaciones || empty($observaciones)) {
                $this->respuestaErrorSimple('No se encontraron observaciones para la bitácora especificada', 404);
            }

            $datosObservaciones = [];
            foreach ($observaciones as $registro) {
                $datosObservaciones[] = [
                    'obs_idObserva' => (int)$registro['obs_idObserva'],
                    'obs_bitIdbitaco' => (int)$registro['obs_bitIdbitaco'],
                    'obs_comentario' => $registro['obs_comentario'] ?? '',
                    'obs_tipoObserva' => $registro['obs_tipoObserva'] ?? '',
                    'obs_imagen' => $registro['obs_imagen'] ?? '',
                    'obs_fecha' => $registro['obs_fecha'] ?? null
                ];
            }

            $this->respuestaExitosaSimple($datosObservaciones);
        } catch (Exception $e) {
            error_log("Error en ObtenerObservacionesPorBitacora: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
