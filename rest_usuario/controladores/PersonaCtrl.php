<?php

require_once(__DIR__ . '/../modelos/PersonaMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class PersonaCtrl extends BaseCtrl
{
    private $personaService;

    public function __construct()
    {
        $this->personaService = new PersonaMdl();
    }

    public function actualizarPersonaNombresTelf($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['id', 'nombres', 'apellidos', 'telefono']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Validar que el ID sea un entero válido
            $id = (int)$data['id'];
            if ($id <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validaciones adicionales
            if (strlen($datosLimpios['nombres']) > 32) {
                $this->respuestaErrorSimple('Los nombres no pueden exceder 32 caracteres', 400);
            }

            if (strlen($datosLimpios['apellidos']) > 32) {
                $this->respuestaErrorSimple('Los apellidos no pueden exceder 32 caracteres', 400);
            }

            if (strlen($datosLimpios['telefono']) > 16) {
                $this->respuestaErrorSimple('El teléfono no puede exceder 16 caracteres', 400);
            }

            // Validar formato de teléfono (opcional)
            if (!preg_match('/^[0-9\+\-\(\)\s]+$/', $datosLimpios['telefono'])) {
                $this->respuestaErrorSimple('Formato de teléfono inválido', 400);
            }

            // Ejecutar actualización
            $resultado = $this->personaService->actualizarPersonaNombresTelf(
                $id,
                $datosLimpios['nombres'],
                $datosLimpios['apellidos'],
                $datosLimpios['telefono']
            );

            if ($resultado === false || $resultado === 0) {
                $this->respuestaErrorSimple('No se pudo actualizar la persona. Verifique que el usuario exista y esté activo.', 500);
            }

            $this->respuestaExitosaSimple([
                'id_usuario' => $id,
                'nombres' => $datosLimpios['nombres'],
                'apellidos' => $datosLimpios['apellidos'],
                'telefono' => $datosLimpios['telefono']
            ]);
        } catch (Exception $e) {
            error_log("Error en actualizarPersonaNombresTelf: " . $e->getMessage());
            $this->respuestaErrorSimple(500);
        }
    }


    public function agregarPersona($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['nombres', 'apellidos', 'correo', 'telefono', 'usuario', 'clave']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validaciones de longitud
            if (strlen($datosLimpios['cedula']) > 13) {
                $this->respuestaErrorSimple('La cédula no puede exceder 13 caracteres', 400);
            }
            if (strlen($datosLimpios['nombres']) > 32) {
                $this->respuestaErrorSimple('Los nombres no pueden exceder 32 caracteres', 400);
            }
            if (strlen($datosLimpios['apellidos']) > 32) {
                $this->respuestaErrorSimple('Los apellidos no pueden exceder 32 caracteres', 400);
            }
            if (strlen($datosLimpios['correo']) > 64) {
                $this->respuestaErrorSimple('El correo no puede exceder 64 caracteres', 400);
            }
            if (strlen($datosLimpios['telefono']) > 16) {
                $this->respuestaErrorSimple('El teléfono no puede exceder 16 caracteres', 400);
            }
            if (strlen($datosLimpios['usuario']) > 32) {
                $this->respuestaErrorSimple('El usuario no puede exceder 32 caracteres', 400);
            }
            if (strlen($datosLimpios['clave']) < 6) {
                $this->respuestaErrorSimple('La clave debe tener al menos 6 caracteres', 400);
            }

            // Validaciones de formato
            if ($datosLimpios['cedula']) {
                if (!preg_match('/^[0-9]{10,13}$/', $datosLimpios['cedula'])) {
                    $this->respuestaErrorSimple('Formato de cédula inválido. Debe contener entre 10 y 13 dígitos', 400);
                }
            }
            if (!filter_var($datosLimpios['correo'], FILTER_VALIDATE_EMAIL)) {
                $this->respuestaErrorSimple('Formato de correo electrónico inválido', 400);
            }
            if (!preg_match('/^[0-9\+\-\(\)\s]+$/', $datosLimpios['telefono'])) {
                $this->respuestaErrorSimple('Formato de teléfono inválido', 400);
            }
            if (!preg_match('/^[a-zA-Z0-9_]{3,32}$/', $datosLimpios['usuario'])) {
                $this->respuestaErrorSimple('El usuario debe tener entre 3 y 32 caracteres y solo puede contener letras, números y guiones bajos', 400);
            }

            // Verificar duplicados
            if ($this->personaService->verificarDuplicados($datosLimpios['usuario'], $datosLimpios['correo'], $datosLimpios['telefono'])) {
                $this->respuestaErrorSimple('El usuario, correo o teléfono ya están en uso.', 409);
            }

            // Ejecutar inserción completa
            $resultado = $this->personaService->agregarPersona(
                $datosLimpios['cedula'],
                $datosLimpios['nombres'],
                $datosLimpios['apellidos'],
                $datosLimpios['correo'],
                $datosLimpios['telefono'],
                $datosLimpios['usuario'],
                $datosLimpios['clave']
            );

            if (!$resultado || (is_array($resultado) && isset($resultado['Error']))) {
                $this->respuestaErrorSimple('Error al registrar la persona y usuario. Verifique que los datos sean únicos.', 500);
            }

            $this->respuestaExitosaSimple(['idUsuario' => $resultado]);
        } catch (Exception $e) {
            error_log("Error en agregarPersona: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    public function obtenerPersonaPorCorreo($correo)
    {
        try {
            // Validar que el correo no esté vacío
            if (empty(trim($correo))) {
                $this->respuestaErrorSimple('El correo electrónico es requerido', 400);
            }

            // Limpiar y validar formato del correo
            $correoLimpio = htmlspecialchars(trim($correo), ENT_QUOTES, 'UTF-8');

            if (!filter_var($correoLimpio, FILTER_VALIDATE_EMAIL)) {
                $this->respuestaErrorSimple('Formato de correo electrónico inválido', 400);
            }

            if (strlen($correoLimpio) > 64) {
                $this->respuestaErrorSimple('El correo no puede exceder 64 caracteres', 400);
            }

            // Buscar persona por correo
            $persona = $this->personaService->obtenerPersonaPorCorreo($correoLimpio);

            if (!$persona) {
                $this->respuestaErrorSimple('No se encontró ninguna persona con ese correo electrónico', 404);
            }

            // Preparar respuesta con datos relevantes
            $datosPersona = [
                'id_persona' => (int)$persona['per_idPersona'],
                'cedula' => $persona['per_cedula'] ?? '',
                'nombres' => $persona['per_nombres'] ?? '',
                'apellidos' => $persona['per_apellidos'] ?? '',
                'direccion' => $persona['per_direccion'] ?? '',
                'correo' => $persona['per_correo'] ?? '',
                'telefono' => $persona['per_telefono'] ?? '',
                'tipo_persona' => $persona['per_tipoPersona'] ?? '',
                'fecha_registro' => $persona['per_fechaRegis'] ?? '',
                'situacion' => $persona['per_situacion'] ?? ''
            ];

            $this->respuestaExitosaSimple($datosPersona);
        } catch (Exception $e) {
            error_log("Error en obtenerPersonaPorCorreo: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
