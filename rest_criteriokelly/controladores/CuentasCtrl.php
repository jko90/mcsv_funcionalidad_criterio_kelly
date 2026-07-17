<?php

require_once(__DIR__ . '/../modelos/CuentasMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class CuentasCtrl extends BaseCtrl
{
    private $cuentasService;

    public function __construct()
    {
        $this->cuentasService = new CuentasMdl();
    }

    public function agregarCuenta($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['cue_nombre', 'cue_usuarioId', 'fecha_valor', 'valor_cuenta']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Ejecutar servicio para agregar cuenta
            $resultado = $this->cuentasService->agregarCuenta(
                $datosLimpios['cue_nombre'],
                (int)$datosLimpios['cue_usuarioId'],
                $datosLimpios['fecha_valor'],
                (float)$datosLimpios['valor_cuenta']
            );

            if (!$resultado) {
                $this->respuestaErrorSimple('No se pudo agregar la cuenta. Verifique los datos ingresados.', 500);
            }

            $this->respuestaExitosaSimple([
                'cue_nombre' => $datosLimpios['cue_nombre'],
                'cue_usuarioId' => $datosLimpios['cue_usuarioId'],
                'fecha_valor' => $datosLimpios['fecha_valor'],
                'valor_cuenta' => (float)$datosLimpios['valor_cuenta'],

            ]);
        } catch (Exception $e) {
            error_log("Error en agregarCuenta: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    public function obtenerCuentasPorUsuario($idUsuario)
    {
        try {
            if (empty(trim($idUsuario))) {
                $this->respuestaErrorSimple('El ID de usuario es requerido', 400);
            }

            $idUsuarioLimpio = htmlspecialchars(trim($idUsuario), ENT_QUOTES, 'UTF-8');

            $id = (int)$idUsuarioLimpio;
            if ($id <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            $cuentas = $this->cuentasService->obtenerCuentasPorUsuario($id);

            if (!$cuentas || empty($cuentas)) {
                $this->respuestaErrorSimple('No se encontraron cuentas para el usuario especificado', 404);
            }

            $datosCuentas = [];
            foreach ($cuentas as $cuenta) {
                $datosCuentas[] = [
                    'cap_idCapital' => (int)($cuenta['cap_idCapital'] ?? 0),
                    'cue_idCuentas' => (int)$cuenta['cue_idCuentas'],
                    'cue_nombre' => $cuenta['cue_nombre'] ?? '',
                    'valor_cuenta' => (float)($cuenta['cap_capital'] ?? 0),
                    'cue_usuarioId' => (int)($cuenta['cue_usuarioId'] ?? 0),
                    'fecha_valor' => $cuenta['cap_fecha'] ?? null
                ];
            }

            $this->respuestaExitosaSimple($datosCuentas);
        } catch (Exception $e) {
            error_log("Error en obtenerCuentasPorUsuario: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    public function registroMovimientoCapital($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['cap_usuarioId', 'cap_cueIdCuentas', 'cap_monto', 'cap_capital', 'cap_tipoMovimie']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validar que cueIdCuentas sea un entero válido
            $cueIdCuentas = (int)$datosLimpios['cap_cueIdCuentas'];
            if ($cueIdCuentas <= 0) {
                $this->respuestaErrorSimple('ID de cuenta inválido', 400);
            }

            // Validar que usuarioId sea un entero válido
            $usuarioId = (int)$datosLimpios['cap_usuarioId'];
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            // Validar monto
            if (!is_numeric($datosLimpios['cap_monto'])) {
                $this->respuestaErrorSimple('El monto debe ser un valor numérico', 400);
            }
            $monto = (float)$datosLimpios['cap_monto'];
            if ($monto < 0) {
                $this->respuestaErrorSimple('El monto no puede ser negativo', 400);
            }
            if ($monto > 999999999.9999) {
                $this->respuestaErrorSimple('El monto excede el límite permitido', 400);
            }

            // Validar capital
            if (!is_numeric($datosLimpios['cap_capital'])) {
                $this->respuestaErrorSimple('El capital debe ser un valor numérico', 400);
            }
            $capital = (float)$datosLimpios['cap_capital'];
            if ($capital < 0) {
                $this->respuestaErrorSimple('El capital no puede ser negativo', 400);
            }
            if ($capital > 999999999.9999) {
                $this->respuestaErrorSimple('El capital excede el límite permitido', 400);
            }

            // Validar tipo de movimiento
            $tipoMovimiento = strtoupper(trim($datosLimpios['cap_tipoMovimie']));
            if (!in_array($tipoMovimiento, ['D', 'R', 'C'])) {
                $this->respuestaErrorSimple('Tipo de movimiento inválido. Debe ser D (Depósito), R (Retiro) o C (Crédito)', 400);
            }

            // Ejecutar registro de movimiento
            $resultado = $this->cuentasService->registroMovimientoCapital(
                $cueIdCuentas,
                $usuarioId,
                $monto,
                $capital,
                $tipoMovimiento
            );

            if (!$resultado || !is_numeric($resultado) || $resultado <= 0) {
                $this->respuestaErrorSimple('No se pudo registrar el movimiento. Verifique que la cuenta y usuario existan.', 500);
                return;
            }

            $this->respuestaExitosaSimple([
                'cap_idCapital' => $resultado,
                'cap_cueIdCuentas' => $cueIdCuentas,
                'cap_usuarioId' => $usuarioId,
                'cap_monto' => $monto,
                'cap_capital' => $capital,
                'cap_tipoMovimie' => $tipoMovimiento,
            ]);
        } catch (Exception $e) {
            error_log("Error en registroMovimiento: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    public function actualizarNombreCuenta($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['cue_nombre', 'cue_idCuenta', 'cue_usuarioId']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validar que cue_idCuenta sea un entero válido
            $idCuenta = (int)$datosLimpios['cue_idCuenta'];
            if ($idCuenta <= 0) {
                $this->respuestaErrorSimple('ID de cuenta inválido', 400);
            }

            // Validar que cue_usuarioId sea un entero válido
            $usuarioId = (int)$datosLimpios['cue_usuarioId'];
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            // Validar nombre de cuenta
            $nombreCuenta = trim($datosLimpios['cue_nombre']);
            if (empty($nombreCuenta)) {
                $this->respuestaErrorSimple('El nombre de la cuenta no puede estar vacío', 400);
            }

            if (strlen($nombreCuenta) > 64) {
                $this->respuestaErrorSimple('El nombre de la cuenta no puede exceder 64 caracteres', 400);
            }

            // Validar formato del nombre (solo letras, números, espacios y algunos caracteres especiales)
            if (!preg_match('/^[a-zA-Z0-9\s\-_\.]+$/', $nombreCuenta)) {
                $this->respuestaErrorSimple('El nombre de la cuenta contiene caracteres no válidos', 400);
            }

            // Ejecutar actualización
            $resultado = $this->cuentasService->actualizarNombreCuenta(
                $nombreCuenta,
                $idCuenta,
                $usuarioId
            );

            if ($resultado === false || $resultado === 0) {
                $this->respuestaErrorSimple('No se pudo actualizar la cuenta. Verifique que la cuenta exista y pertenezca al usuario.', 404);
            }

            $this->respuestaExitosaSimple([
                'cue_idCuenta' => $idCuenta,
                'cue_usuarioId' => $usuarioId,
                'cue_nombre' => $nombreCuenta
            ]);
        } catch (Exception $e) {
            error_log("Error en actualizarNombreCuenta: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function eliminarCuenta($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['cue_idCuenta', 'cue_usuarioId']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validar que cue_idCuenta sea un entero válido
            $idCuenta = (int)$datosLimpios['cue_idCuenta'];
            if ($idCuenta <= 0) {
                $this->respuestaErrorSimple('ID de cuenta inválido', 400);
            }

            // Validar que cue_usuarioId sea un entero válido
            $usuarioId = (int)$datosLimpios['cue_usuarioId'];
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            // Ejecutar eliminación lógica (cambio de estado)
            $resultado = $this->cuentasService->eliminarCuenta($idCuenta, $usuarioId);

            if ($resultado === false || $resultado === 0) {
                $this->respuestaErrorSimple('No se pudo eliminar la cuenta. Verifique que la cuenta exista y pertenezca al usuario.', 404);
            }

            $this->respuestaExitosaSimple([
                'success' => 'Cuenta eliminada exitosamente'
            ]);
        } catch (Exception $e) {
            error_log("Error en eliminarCuenta: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
