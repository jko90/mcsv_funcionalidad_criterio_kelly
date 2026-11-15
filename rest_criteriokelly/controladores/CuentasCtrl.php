<?php

declare(strict_types=1);

require_once __DIR__ . '/../modelos/CuentasMdl.php';
require_once __DIR__ . '/BaseCtrl.php';

class CuentasCtrl extends BaseCtrl
{
    private CuentasMdl $cuentasModelo;
    private Enlace $enlace;

    private const PATRON_NOMBRE_CUENTA = '/^[\p{L}\p{N} ._-]+$/u';
    private const MONTO_MAXIMO_CAPITAL = 99999999.9999;
    private const TIPOS_MOVIMIENTO_PERMITIDOS = ['D', 'R', 'C'];
    private const MENSAJE_TOPE_CUENTAS = 'Tu plan permite %d cuenta(s). Actualiza tu plan para crear más';

    public function __construct()
    {
        $this->enlace = new Enlace();
        $this->cuentasModelo = new CuentasMdl($this->enlace);
    }

    public function agregarCuenta(array $datos): void
    {
        try {
            $nombreCuenta = $this->leerTexto($datos['cue_nombre'] ?? null, 'cue_nombre', 64, true, self::PATRON_NOMBRE_CUENTA);
            $fechaValor = $this->leerFecha($datos['fecha_valor'] ?? null, 'fecha_valor');
            $valorCuenta = $this->leerDecimal($datos['valor_cuenta'] ?? null, 'valor_cuenta', 0, self::MONTO_MAXIMO_CAPITAL);
            $this->verificarUsuarioEnviado($datos['cue_usuarioId'] ?? null, 'cuentas/nueva');
            $idUsuario = $this->idUsuarioSesion();

            $topeCuentas = ControlPlan::limites()['numCuentas'] ?? null;
            $esTopeAlcanzado = false;
            $idCapital = 0;
            $this->enlace->iniciarTransaccion();
            try {
                // Mutex por usuario: dos creaciones simultáneas no pueden pasar el tope a la vez
                $this->cuentasModelo->bloquearUsuario($idUsuario);
                $cuentasActivas = $this->cuentasModelo->contarCuentasActivas($idUsuario);
                if ($topeCuentas !== null && $cuentasActivas >= $topeCuentas) {
                    $esTopeAlcanzado = true;
                    $this->enlace->revertirTransaccion();
                } else {
                    $idCapital = $this->cuentasModelo->agregarCuenta($nombreCuenta, $idUsuario, $fechaValor, $valorCuenta);
                    $this->enlace->confirmarTransaccion();
                }
            } catch (Throwable $error) {
                $this->enlace->revertirTransaccion();
                throw $error;
            }

            if ($esTopeAlcanzado) {
                ControlPlan::auditarRechazo('cuentas/nueva');
                ControlPlan::responder(sprintf(self::MENSAJE_TOPE_CUENTAS, $topeCuentas));
            }

            $this->respuestaExitosaSimple([
                'cue_nombre' => $nombreCuenta,
                'cue_usuarioId' => $idUsuario,
                'fecha_valor' => $fechaValor,
                'valor_cuenta' => $valorCuenta,
                'cap_idCapital' => $idCapital,
            ]);
        } catch (Throwable $error) {
            error_log('[CuentasCtrl::agregarCuenta] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerCuentasPorUsuario(mixed $idEnviado): void
    {
        try {
            $this->verificarUsuarioEnviado($idEnviado, 'cuentas/obtener');
            $cuentas = $this->cuentasModelo->obtenerCuentasPorUsuario($this->idUsuarioSesion());
            $datosCuentas = [];
            foreach ($cuentas as $cuenta) {
                $datosCuentas[] = [
                    'cap_idCapital' => (int) $cuenta['cap_idCapital'],
                    'cue_idCuentas' => (int) $cuenta['cue_idCuentas'],
                    'cue_nombre' => $cuenta['cue_nombre'],
                    'valor_cuenta' => (float) $cuenta['cap_capital'],
                    'cue_usuarioId' => (int) $cuenta['cue_usuarioId'],
                    'fecha_valor' => $cuenta['cap_fecha'],
                ];
            }
            $this->respuestaExitosaSimple($datosCuentas);
        } catch (Throwable $error) {
            error_log('[CuentasCtrl::obtenerCuentasPorUsuario] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function registroMovimientoCapital(array $datos): void
    {
        try {
            $idCuenta = $this->leerEntero($datos['cap_cueIdCuentas'] ?? null, 'cap_cueIdCuentas');
            $monto = $this->leerDecimal($datos['cap_monto'] ?? null, 'cap_monto', 0, self::MONTO_MAXIMO_CAPITAL);
            $capital = $this->leerDecimal($datos['cap_capital'] ?? null, 'cap_capital', 0, self::MONTO_MAXIMO_CAPITAL);
            $tipoMovimiento = $this->leerOpcion($datos['cap_tipoMovimie'] ?? null, 'cap_tipoMovimie', self::TIPOS_MOVIMIENTO_PERMITIDOS);
            $this->verificarUsuarioEnviado($datos['cap_usuarioId'] ?? null, 'cuentas/movCapital');
            $idUsuario = $this->idUsuarioSesion();
            $idMovimiento = $this->cuentasModelo->registroMovimientoCapital(
                $idCuenta,
                $monto,
                $capital,
                $tipoMovimiento,
                $idUsuario
            );
            if ($idMovimiento <= 0) {
                $this->denegarAcceso("cuenta=$idCuenta cuentas/movCapital");
            }
            $this->respuestaExitosaSimple([
                'cap_idCapital' => $idMovimiento,
                'cap_cueIdCuentas' => $idCuenta,
                'cap_usuarioId' => $idUsuario,
                'cap_monto' => $monto,
                'cap_capital' => $capital,
                'cap_tipoMovimie' => $tipoMovimiento,
            ]);
        } catch (Throwable $error) {
            error_log('[CuentasCtrl::registroMovimientoCapital] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function actualizarNombreCuenta(array $datos): void
    {
        try {
            $idCuenta = $this->leerEntero($datos['cue_idCuenta'] ?? null, 'cue_idCuenta');
            $nombreCuenta = $this->leerTexto($datos['cue_nombre'] ?? null, 'cue_nombre', 64, true, self::PATRON_NOMBRE_CUENTA);
            $this->verificarUsuarioEnviado($datos['cue_usuarioId'] ?? null, 'cuentas/nombre');
            $idUsuario = $this->idUsuarioSesion();
            if ($this->cuentasModelo->obtenerCuentaActivaDeUsuario($idCuenta, $idUsuario) === null) {
                $this->denegarAcceso("cuenta=$idCuenta cuentas/nombre");
            }
            $this->cuentasModelo->actualizarNombreCuenta($nombreCuenta, $idCuenta, $idUsuario);
            $this->respuestaExitosaSimple([
                'cue_idCuenta' => $idCuenta,
                'cue_usuarioId' => $idUsuario,
                'cue_nombre' => $nombreCuenta,
            ]);
        } catch (Throwable $error) {
            error_log('[CuentasCtrl::actualizarNombreCuenta] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function eliminarCuenta(array $datos): void
    {
        try {
            $idCuenta = $this->leerEntero($datos['cue_idCuenta'] ?? null, 'cue_idCuenta');
            $this->verificarUsuarioEnviado($datos['cue_usuarioId'] ?? null, 'cuentas/eliminar');
            $idUsuario = $this->idUsuarioSesion();
            if ($this->cuentasModelo->obtenerCuentaActivaDeUsuario($idCuenta, $idUsuario) === null) {
                $this->denegarAcceso("cuenta=$idCuenta cuentas/eliminar");
            }
            $this->cuentasModelo->eliminarCuenta($idCuenta, $idUsuario);
            $this->respuestaExitosaSimple(['success' => 'Cuenta eliminada exitosamente']);
        } catch (Throwable $error) {
            error_log('[CuentasCtrl::eliminarCuenta] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
