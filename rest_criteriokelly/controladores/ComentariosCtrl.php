<?php

declare(strict_types=1);

require_once __DIR__ . '/../modelos/ComentariosMdl.php';
require_once __DIR__ . '/../modelos/BitacoraMdl.php';
require_once __DIR__ . '/BaseCtrl.php';

class ComentariosCtrl extends BaseCtrl
{
    private ComentariosMdl $comentariosModelo;
    private BitacoraMdl $bitacoraModelo;
    private Enlace $enlace;

    private const TIPOS_OBSERVACION_PERMITIDOS = ['I', 'E', 'P', 'L', 'F'];
    private const MAXIMO_COMENTARIOS_POR_SOLICITUD = 10;
    private const PRECIO_MAXIMO = 999999.999999;

    public function __construct()
    {
        $this->enlace = new Enlace();
        $this->comentariosModelo = new ComentariosMdl($this->enlace);
        $this->bitacoraModelo = new BitacoraMdl($this->enlace);
    }

    public function crearComentarioPorBitacora(mixed $datos): void
    {
        try {
            $comentarios = $this->normalizarListaComentarios($datos);
            $comentariosValidados = [];
            $idsBitacora = [];
            foreach ($comentarios as $comentario) {
                if (!is_array($comentario)) {
                    $this->respuestaErrorSimple("El campo 'comentario' es inválido", 400);
                }
                $idBitacora = $this->leerEntero($comentario['obs_bitIdbitaco'] ?? null, 'obs_bitIdbitaco');
                $texto = $this->leerTexto($comentario['obs_comentario'] ?? null, 'obs_comentario', 4096, true);
                $tipo = $this->leerOpcion(
                    $comentario['obs_tipoObserva'] ?? null,
                    'obs_tipoObserva',
                    self::TIPOS_OBSERVACION_PERMITIDOS
                );
                $imagen = $this->leerImagen($comentario['obs_imagen'] ?? null, 'obs_imagen');
                $comentariosValidados[] = [$idBitacora, $texto, $tipo, $imagen];
                $idsBitacora[$idBitacora] = $idBitacora;
            }

            $idsBitacora = array_values($idsBitacora);
            sort($idsBitacora, SORT_NUMERIC);
            $idUsuario = $this->idUsuarioSesion();
            $this->enlace->iniciarTransaccion();
            try {
                foreach ($idsBitacora as $idBitacora) {
                    if ($this->bitacoraModelo->obtenerBitacoraDeUsuario($idBitacora, $idUsuario, true) === null) {
                        $this->enlace->revertirTransaccion();
                        $this->denegarAcceso("bitacora=$idBitacora comentarios/crearComentario");
                    }
                }
                $respuesta = [];
                foreach ($comentariosValidados as [$idBitacora, $texto, $tipo, $imagen]) {
                    $observacion = $this->comentariosModelo->validarObservacion($tipo, $idBitacora);
                    if ($observacion !== null) {
                        $this->comentariosModelo->sobreEscribirObservacion($idBitacora, $tipo, $texto, $imagen);
                    } else {
                        $this->comentariosModelo->crearComentariosPorBitacora($idBitacora, $texto, $tipo, $imagen);
                    }
                    $observacion = $this->comentariosModelo->validarObservacion($tipo, $idBitacora);
                    if ($observacion === null) {
                        throw new RuntimeException('No se pudo guardar la observación');
                    }
                    $respuesta[] = [
                        'obs_idObserva' => (int) $observacion['obs_idObserva'],
                        'obs_bitIdbitaco' => (int) $observacion['obs_bitIdbitaco'],
                        'obs_comentario' => $observacion['obs_comentario'],
                        'obs_tipoObserva' => $observacion['obs_tipoObserva'],
                        'obs_imagen' => $observacion['obs_imagen'],
                        'obs_fecha' => $observacion['obs_fecha'],
                    ];
                }
                $this->enlace->confirmarTransaccion();
            } catch (Throwable $error) {
                $this->enlace->revertirTransaccion();
                throw $error;
            }
            $this->respuestaExitosaSimple($respuesta);
        } catch (Throwable $error) {
            error_log('[ComentariosCtrl::crearComentarioPorBitacora] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function actualizarBitacoraComentario(array $datos): void
    {
        try {
            $idBitacora = $this->leerEntero($datos['bit_idbitacora'] ?? null, 'bit_idbitacora');
            $idObservacion = $this->leerEntero($datos['obs_idObserva'] ?? null, 'obs_idObserva');
            $precioEntrada = array_key_exists('bit_precioEntra', $datos)
                ? $this->leerDecimal($datos['bit_precioEntra'], 'bit_precioEntra', 0.000001, self::PRECIO_MAXIMO)
                : null;
            $precioStopLoss = array_key_exists('bit_precioSL', $datos)
                ? $this->leerDecimal($datos['bit_precioSL'], 'bit_precioSL', 0, self::PRECIO_MAXIMO)
                : null;
            $precioTakeProfit = array_key_exists('bit_precioTP', $datos)
                ? $this->leerDecimal($datos['bit_precioTP'], 'bit_precioTP', 0, self::PRECIO_MAXIMO)
                : null;
            $comentario = array_key_exists('obs_comentario', $datos)
                ? $this->leerTexto($datos['obs_comentario'], 'obs_comentario', 4096, false)
                : null;
            $imagen = array_key_exists('obs_imagen', $datos)
                ? $this->leerImagen($datos['obs_imagen'], 'obs_imagen')
                : null;
            $idUsuario = $this->idUsuarioSesion();

            $this->enlace->iniciarTransaccion();
            try {
                if ($this->bitacoraModelo->obtenerBitacoraDeUsuario($idBitacora, $idUsuario, true) === null
                    || $this->comentariosModelo->obtenerObservacionDeBitacora($idObservacion, $idBitacora, true) === null) {
                    $this->enlace->revertirTransaccion();
                    $this->denegarAcceso("bitacora=$idBitacora comentarios/comentarioBitacora");
                }
                $this->comentariosModelo->actualizarBitacoraTPBESL(
                    $idBitacora,
                    $idUsuario,
                    $precioEntrada,
                    $precioStopLoss,
                    $precioTakeProfit
                );
                $this->comentariosModelo->actualizarObservacion(
                    $idObservacion,
                    $idBitacora,
                    $comentario,
                    $imagen
                );
                $this->enlace->confirmarTransaccion();
            } catch (Throwable $error) {
                $this->enlace->revertirTransaccion();
                throw $error;
            }
            $this->respuestaExitosaSimple([
                'bit_idbitacora' => $idBitacora,
                'bit_precioEntra' => $precioEntrada,
                'bit_precioSL' => $precioStopLoss,
                'bit_precioTP' => $precioTakeProfit,
                'obs_comentario' => $comentario,
                'obs_idObserva' => $idObservacion,
                'obs_imagen' => $imagen,
            ]);
        } catch (Throwable $error) {
            error_log('[ComentariosCtrl::actualizarBitacoraComentario] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function ObtenerObservacionesPorBitacora(mixed $id): void
    {
        try {
            $idBitacora = $this->leerEntero($id, 'id');
            $idUsuario = $this->idUsuarioSesion();
            if ($this->bitacoraModelo->obtenerBitacoraDeUsuario($idBitacora, $idUsuario) === null) {
                $this->denegarAcceso("bitacora=$idBitacora comentarios/observaciones");
            }
            $observaciones = $this->comentariosModelo->obtenerComentariosPorBitacora($idBitacora);
            $respuesta = [];
            foreach ($observaciones as $observacion) {
                $respuesta[] = [
                    'obs_idObserva' => (int) $observacion['obs_idObserva'],
                    'obs_bitIdbitaco' => (int) $observacion['obs_bitIdbitaco'],
                    'obs_comentario' => $observacion['obs_comentario'],
                    'obs_tipoObserva' => $observacion['obs_tipoObserva'],
                    'obs_imagen' => $observacion['obs_imagen'],
                    'obs_fecha' => $observacion['obs_fecha'],
                ];
            }
            $this->respuestaExitosaSimple($respuesta);
        } catch (Throwable $error) {
            error_log('[ComentariosCtrl::ObtenerObservacionesPorBitacora] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    private function normalizarListaComentarios(mixed $datos): array
    {
        if (!is_array($datos)) {
            $this->respuestaErrorSimple("El campo 'comentarios' es inválido", 400);
        }
        if (array_key_exists('obs_bitIdbitaco', $datos)) {
            return [$datos];
        }
        if (!$this->esListaNumerica($datos) || count($datos) < 1 || count($datos) > self::MAXIMO_COMENTARIOS_POR_SOLICITUD) {
            $this->respuestaErrorSimple("El campo 'comentarios' es inválido", 400);
        }
        return $datos;
    }

    private function esListaNumerica(array $datos): bool
    {
        $indice = 0;
        foreach ($datos as $clave => $_valor) {
            if ($clave !== $indice++) {
                return false;
            }
        }
        return true;
    }
}
