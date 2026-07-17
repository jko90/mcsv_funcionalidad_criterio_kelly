<?php

require_once(__DIR__ . '/../modelos/ValidacionMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class ValidacionCtrl extends BaseCtrl
{
    private $validacionService;

    public function __construct()
    {
        $this->validacionService = new ValidacionMdl();
    }

    public function autenticarUsuario($data)
    {
        try {
            $errores = $this->validarDatos($data, ['usuario', 'clave']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $datosLimpios = $this->limpiarDatos($data);

            $usuarioData = $this->validacionService->autenticarUsuario($datosLimpios['usuario'], $datosLimpios['clave']);

            if (!$usuarioData) {
                $this->respuestaErrorSimple('Credenciales inválidas', 401);
            }

            $respuesta = [
                'id' => (int)$usuarioData['usu_idUsuario'],
                'nombres' => $usuarioData['per_nombres'] ?? '',
                'apellidos' => $usuarioData['per_apellidos'] ?? ''
            ];

            $this->respuestaExitosaSimple($respuesta);
        } catch (Exception $e) {
            error_log("Error en autenticarUsuario: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerRolesUsuario($id)
    {
        try {
            if (!filter_var($id, FILTER_VALIDATE_INT) || $id <= 0) {
                $this->respuestaErrorSimple('ID inválido', 400);
            }

            $rolesData = $this->validacionService->obtenerRolesUsuarios($id);

            if (!$rolesData) {
                $this->respuestaExitosaSimple(null);
                return;
            }

            $respuesta = [];
            foreach ($rolesData as $rol) {
                $respuesta[] = [
                    'rol_id' => (int)$rol['rol_id'],
                    'rol_descripcion' => $rol['rol_descripcion'] ?? ''
                ];
            }
            if(empty($respuesta)) {
                $this->respuestaErrorSimple('No se encontraron roles para el usuario', 404);
                return;
            }

            $this->respuestaExitosaSimple($respuesta);
        } catch (Exception $e) {
            error_log("Error en obtenerRolesUsuario: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    public function generarCodigoRecuperacion($data)
    {
        try {
            $errores = $this->validarDatos($data, ['id']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $id = (int)$data['id'];
            if ($id <= 0) {
                $this->respuestaErrorSimple('ID inválido', 400);
            }

            // Generar código de recuperación aleatorio
            $codigoRecuperacion = rand(100000, 999999);

            $resultado = $this->validacionService->actualizarCodigoRecuperacionUsuario($id, $codigoRecuperacion);
            if ($resultado == false) {
                $this->respuestaErrorSimple('Error al generar código de recuperación', 500);
            }

            $this->respuestaExitosaSimple(
                ['codigo_recuperacion' => $codigoRecuperacion]
            );
        } catch (Exception $e) {
            error_log("Error en generarCodigoRecuperacion: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerCodigoRecuperacion($data)
    {
        try {
            $errores = $this->validarDatos($data, ['usuario']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            $datosLimpios = $this->limpiarDatos($data);

            $codigoData = $this->validacionService->obtenerCodigoRecuperacionUsuario($datosLimpios['usuario']);
            if (!$codigoData) {
                $this->respuestaErrorSimple('Usuario no encontrado', 404);
            }

            $this->respuestaExitosaSimple([
                'codigo_recuperacion' => (int)$codigoData['usu_codiorecupe']
            ], 'Código de recuperación obtenido exitosamente');
        } catch (Exception $e) {
            error_log("Error en obtenerCodigoRecuperacion: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function actualizarClave($data)
    {
        try {
            $errores = $this->validarDatos($data, ['clave']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            if (!isset($data['id']) && !isset($data['usuario'])) {
                $this->respuestaErrorSimple('Debe proporcionar ID o usuario', 400);
            }

            $datosLimpios = $this->limpiarDatos($data);

            $id = isset($data['id']) ? (int)$data['id'] : 0;
            $usuario = isset($data['usuario']) ? $datosLimpios['usuario'] : '';

            $resultado = $this->validacionService->actualizarClaveUsuario(
                $id,
                $datosLimpios['clave'],
                $usuario
            );

            if (!$resultado) {
                $this->respuestaErrorSimple('Error al actualizar la clave', 500);
            }

            $this->respuestaExitosaSimple(null, 'Clave actualizada exitosamente');
        } catch (Exception $e) {
            error_log("Error en actualizarClave: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
