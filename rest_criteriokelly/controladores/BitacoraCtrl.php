<?php

declare(strict_types=1);

require_once __DIR__ . '/../modelos/BitacoraMdl.php';
require_once __DIR__ . '/../modelos/CuentasMdl.php';
require_once __DIR__ . '/BaseCtrl.php';

class BitacoraCtrl extends BaseCtrl
{
    private BitacoraMdl $bitacoraModelo;
    private CuentasMdl $cuentasModelo;
    private Enlace $enlace;

    private const TIPOS_OPERACION_PERMITIDOS = ['COMPRA', 'VENTA'];
    private const TIPOS_OBSERVACION_PERMITIDOS = ['I', 'E', 'P', 'L', 'F'];
    private const PRECIO_MAXIMO = 999999.999999;

    public function __construct()
    {
        $this->enlace = new Enlace();
        $this->bitacoraModelo = new BitacoraMdl($this->enlace);
        $this->cuentasModelo = new CuentasMdl($this->enlace);
    }

    public function crearBitacora(array $datos): void
    {
        try {
            $idCuenta = $this->leerEntero($datos['bit_cueIdCuentas'] ?? null, 'bit_cueIdCuentas');
            $divisa = $this->leerTexto($datos['bit_divisa'] ?? null, 'bit_divisa', 32, true, '/^[A-Za-z0-9 .\/_^-]+$/');
            $tipoOperacion = $this->leerOpcion($datos['bit_tipoOperaci'] ?? null, 'bit_tipoOperaci', self::TIPOS_OPERACION_PERMITIDOS);
            $fechaCreacion = array_key_exists('bit_fechaCrea', $datos) && $datos['bit_fechaCrea'] !== null
                ? $this->leerFechaHora($datos['bit_fechaCrea'], 'bit_fechaCrea')
                : date('Y-m-d H:i:s');
            $numeroBitacora = array_key_exists('bit_numeroBitac', $datos)
                ? $this->leerEntero($datos['bit_numeroBitac'], 'bit_numeroBitac', 0)
                : 1;
            $precioEntrada = array_key_exists('bit_precioEntra', $datos)
                ? $this->leerDecimal($datos['bit_precioEntra'], 'bit_precioEntra', 0, self::PRECIO_MAXIMO)
                : 0.0;
            $precioStopLoss = array_key_exists('bit_precioSL', $datos)
                ? $this->leerDecimal($datos['bit_precioSL'], 'bit_precioSL', 0, self::PRECIO_MAXIMO)
                : 0.0;
            $precioTakeProfit = array_key_exists('bit_precioTP', $datos)
                ? $this->leerDecimal($datos['bit_precioTP'], 'bit_precioTP', 0, self::PRECIO_MAXIMO)
                : 0.0;
            $comentario = $this->leerTexto($datos['obs_comentario'] ?? '', 'obs_comentario', 4096, false);
            $tipoObservacion = $this->leerOpcion(
                $datos['obs_tipoObserva'] ?? '',
                'obs_tipoObserva',
                self::TIPOS_OBSERVACION_PERMITIDOS
            );
            $imagen = $this->leerImagen($datos['obs_imagen'] ?? null, 'obs_imagen');
            $this->verificarUsuarioEnviado($datos['bit_usuarioId'] ?? null, 'bitacora/crear');
            $idUsuario = $this->idUsuarioSesion();

            $this->enlace->iniciarTransaccion();
            try {
                if ($this->cuentasModelo->obtenerCuentaActivaDeUsuario($idCuenta, $idUsuario, true) === null) {
                    $this->enlace->revertirTransaccion();
                    $this->denegarAcceso("cuenta=$idCuenta bitacora/crear");
                }
                $bitacora = $this->bitacoraModelo->crearBitacora(
                    $idUsuario,
                    $idCuenta,
                    $numeroBitacora,
                    $divisa,
                    $tipoOperacion,
                    $precioEntrada,
                    $precioStopLoss,
                    $precioTakeProfit,
                    $comentario,
                    $tipoObservacion,
                    $imagen,
                    $fechaCreacion
                );
                $this->enlace->confirmarTransaccion();
            } catch (Throwable $error) {
                $this->enlace->revertirTransaccion();
                throw $error;
            }
            $this->respuestaExitosaSimple($bitacora);
        } catch (Throwable $error) {
            error_log('[BitacoraCtrl::crearBitacora] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerBitacoraPorCuenta(array $datos): void
    {
        try {
            $idCuenta = $this->leerEntero($datos['bit_cueIdCuentas'] ?? null, 'bit_cueIdCuentas');
            $this->verificarUsuarioEnviado($datos['bit_usuarioId'] ?? null, 'bitacora/listBitacora');
            $idUsuario = $this->idUsuarioSesion();
            if ($this->cuentasModelo->obtenerCuentaActivaDeUsuario($idCuenta, $idUsuario) === null) {
                $this->denegarAcceso("cuenta=$idCuenta bitacora/listBitacora");
            }
            $bitacora = $this->bitacoraModelo->obtenerBitacoraPorCuenta($idUsuario, $idCuenta);
            $datosBitacora = [];
            foreach ($bitacora as $registro) {
                $datosBitacora[] = [
                    'bit_idbitacora' => (int) $registro['bit_idbitacora'],
                    'bit_usuarioId' => (int) $registro['bit_usuarioId'],
                    'bit_cueIdCuentas' => (int) $registro['bit_cueIdCuentas'],
                    'bit_numeroBitac' => (int) $registro['bit_numeroBitac'],
                    'bit_divisa' => $registro['bit_divisa'],
                    'bit_tipoOperaci' => $registro['bit_tipoOperaci'],
                    'bit_precioEntra' => (float) $registro['bit_precioEntra'],
                    'bit_precioSL' => (float) $registro['bit_precioSL'],
                    'bit_precioTP' => (float) $registro['bit_precioTP'],
                    'bit_pipTotal' => (float) $registro['bit_pipTotal'],
                    'bit_montoOpera' => (float) $registro['bit_montoOpera'],
                    'bit_montoResult' => (float) $registro['bit_montoResult'],
                    'bit_resultado' => $registro['bit_resultado'],
                    'bit_balance' => (float) $registro['bit_balance'],
                    'bit_situacion' => $registro['bit_situacion'],
                    'bit_fechaCrea' => $registro['bit_fechaCrea'],
                    'bit_fechaFin' => $registro['bit_fechaFin'],
                    'bit_respeReglas' => $registro['bit_respeReglas'],
                    'bit_estado' => $registro['bit_estado'],
                ];
            }
            $this->respuestaExitosaSimple($datosBitacora);
        } catch (Throwable $error) {
            error_log('[BitacoraCtrl::obtenerBitacoraPorCuenta] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function eliminarBitacoraBitacora(mixed $id): void
    {
        try {
            $idBitacora = $this->leerEntero($id, 'id');
            $idUsuario = $this->idUsuarioSesion();
            $this->enlace->iniciarTransaccion();
            try {
                if ($this->bitacoraModelo->obtenerBitacoraDeUsuario($idBitacora, $idUsuario, true) === null) {
                    $this->enlace->revertirTransaccion();
                    $this->denegarAcceso("bitacora=$idBitacora bitacora/eliminarBitacora");
                }
                $this->bitacoraModelo->eliminarObservacion($idBitacora);
                $this->bitacoraModelo->eliminarBitacoraPorId($idBitacora);
                $this->enlace->confirmarTransaccion();
            } catch (Throwable $error) {
                $this->enlace->revertirTransaccion();
                throw $error;
            }
            $this->respuestaExitosaSimple(['success' => $idBitacora]);
        } catch (Throwable $error) {
            error_log('[BitacoraCtrl::eliminarBitacoraBitacora] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
