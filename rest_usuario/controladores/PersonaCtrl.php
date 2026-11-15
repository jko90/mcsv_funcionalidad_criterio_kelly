<?php

declare(strict_types=1);

require_once __DIR__ . '/../modelos/PersonaMdl.php';
require_once __DIR__ . '/../modelos/VerificacionMdl.php';
require_once __DIR__ . '/../configuracion/ClienteIp.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../correo/cargarCorreo.php';
require_once __DIR__ . '/../servicios/HashClaves.php';
require_once __DIR__ . '/../servicios/PoliticaClaves.php';
require_once __DIR__ . '/../configuracion/ContextoSesion.php';
require_once __DIR__ . '/BaseCtrl.php';

class PersonaCtrl extends BaseCtrl
{
    private const MENSAJE_REGISTRO = 'Registro recibido. Si los datos son válidos, recibirás un código en tu correo para activar tu cuenta.';

    private PersonaMdl $personaModelo;
    private VerificacionMdl $verificacionModelo;
    private EnviadorCorreo $enviador;
    private RegistroAuditoria $auditoria;

    public function __construct()
    {
        $enlace = new Enlace();
        $this->personaModelo = new PersonaMdl($enlace);
        $this->verificacionModelo = new VerificacionMdl($enlace);
        $this->enviador = new EnviadorCorreo();
        $this->auditoria = new RegistroAuditoria($enlace, SERVICIO_ACTUAL);
    }

    public function actualizarPersonaNombresTelf(array $datos): void
    {
        try {
            $this->exigirCamposPermitidos($datos, ['id', 'nombres', 'apellidos', 'telefono']);
            $this->exigirIdDeSesion($datos);
            foreach (['nombres', 'apellidos', 'telefono'] as $campo) {
                if (!array_key_exists($campo, $datos) || !is_string($datos[$campo])) {
                    $this->respuestaErrorSimple('Solicitud inválida', 400);
                }
            }
            $datosLimpios = $this->limpiarDatos($datos);
            $this->validarTexto($datosLimpios['nombres'], 32, 'Los nombres no pueden exceder 32 caracteres');
            $this->validarTexto($datosLimpios['apellidos'], 32, 'Los apellidos no pueden exceder 32 caracteres');
            $this->validarTexto($datosLimpios['telefono'], 16, 'El teléfono no puede exceder 16 caracteres');
            if (preg_match('/^[0-9+\-()\s]+$/', $datosLimpios['telefono']) !== 1) {
                $this->respuestaErrorSimple('Formato de teléfono inválido', 400);
            }
            $idUsuario = ContextoSesion::idUsuario();
            $filasAfectadas = $this->personaModelo->actualizarPersonaNombresTelf(
                $idUsuario,
                $datosLimpios['nombres'],
                $datosLimpios['apellidos'],
                $datosLimpios['telefono']
            );
            if ($filasAfectadas === 0) {
                $this->respuestaErrorSimple('No se encontró el usuario o no está activo', 404);
            }
            $this->respuestaExitosaSimple([
                'id_usuario' => $idUsuario,
                'nombres' => $datosLimpios['nombres'],
                'apellidos' => $datosLimpios['apellidos'],
                'telefono' => $datosLimpios['telefono'],
            ]);
        } catch (Throwable $error) {
            error_log('[PersonaCtrl::actualizarPersonaNombresTelf] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function agregarPersona(array $datos): void
    {
        $inicio = hrtime(true);
        try {
            $this->exigirCamposPermitidos($datos, [
                'cedula', 'nombres', 'apellidos', 'correo', 'telefono', 'usuario', 'clave',
            ]);
            foreach (['nombres', 'apellidos', 'correo', 'telefono', 'usuario', 'clave'] as $campo) {
                if (!array_key_exists($campo, $datos) || !is_string($datos[$campo]) || trim($datos[$campo]) === '') {
                    $this->respuestaErrorSimple("El campo '{$campo}' es requerido", 400);
                }
            }
            if (array_key_exists('cedula', $datos) && !is_string($datos['cedula'])) {
                $this->respuestaErrorSimple('Solicitud inválida', 400);
            }
            $clave = $datos['clave'];
            $datosLimpios = $this->limpiarDatos($datos);
            $cedula = $datosLimpios['cedula'] ?? '';
            $this->validarLongitud($cedula, 13, 'La cédula no puede exceder 13 caracteres');
            $this->validarLongitud($datosLimpios['nombres'], 32, 'Los nombres no pueden exceder 32 caracteres');
            $this->validarLongitud($datosLimpios['apellidos'], 32, 'Los apellidos no pueden exceder 32 caracteres');
            $this->validarLongitud($datosLimpios['correo'], 64, 'El correo no puede exceder 64 caracteres');
            $this->validarLongitud($datosLimpios['telefono'], 16, 'El teléfono no puede exceder 16 caracteres');
            $this->validarLongitud($datosLimpios['usuario'], 32, 'El usuario no puede exceder 32 caracteres');
            if (mb_strlen($clave, 'UTF-8') > 128) {
                $this->respuestaErrorSimple('La clave debe tener entre 10 y 128 caracteres', 400);
            }
            if ($cedula !== '' && preg_match('/^[0-9]{10,13}$/', $cedula) !== 1) {
                $this->respuestaErrorSimple('Formato de cédula inválido. Debe contener entre 10 y 13 dígitos', 400);
            }
            if (filter_var($datosLimpios['correo'], FILTER_VALIDATE_EMAIL) === false) {
                $this->respuestaErrorSimple('Formato de correo electrónico inválido', 400);
            }
            if (preg_match('/^[0-9+\-()\s]+$/', $datosLimpios['telefono']) !== 1) {
                $this->respuestaErrorSimple('Formato de teléfono inválido', 400);
            }
            if (preg_match('/^[a-zA-Z0-9_]{3,32}$/', $datosLimpios['usuario']) !== 1) {
                $this->respuestaErrorSimple('El usuario debe tener entre 3 y 32 caracteres y solo puede contener letras, números y guiones bajos', 400);
            }
            $mensajePolitica = PoliticaClaves::validar($clave, $datosLimpios['usuario'], $datosLimpios['correo']);
            if ($mensajePolitica !== null) {
                $this->respuestaErrorSimple($mensajePolitica, 400);
            }
            if ($this->verificacionModelo->contarCodigosPorIp(ClienteIp::obtener())
                >= VerificacionMdl::MAXIMO_CODIGOS_POR_IP_HORA) {
                header('Retry-After: 3600');
                $this->respuestaErrorSimple('Demasiados intentos, intente nuevamente más tarde', 429);
            }

            // Se calculan siempre los dos hashes Argon2id, también si el correo ya existe, para que el
            // tiempo de respuesta no delate qué correos están registrados.
            $hashClave = HashClaves::hashear($clave);
            $codigo = sprintf('%06d', random_int(0, 999999));
            $hashCodigo = HashClaves::hashear($codigo);
            $registro = $this->personaModelo->registrarPersona(
                $cedula !== '' ? $cedula : null,
                $datosLimpios['nombres'],
                $datosLimpios['apellidos'],
                $datosLimpios['correo'],
                $datosLimpios['telefono'],
                $datosLimpios['usuario'],
                $hashClave,
                $hashCodigo,
                ClienteIp::obtener(),
                $this->obtenerAgente()
            );
            if ($registro['resultado'] === PersonaMdl::REGISTRO_DATOS_DUPLICADOS) {
                $this->respuestaErrorSimple('El nombre de usuario, el teléfono o la cédula ya están registrados', 409);
            }
            if ($registro['resultado'] === PersonaMdl::REGISTRO_CREADO) {
                $this->enviarCodigoSinRevertir($datosLimpios['correo'], $datosLimpios['nombres'], $codigo);
            } elseif (Configuracion::obtener('APP_ENTORNO') === 'local') {
                // Solo local: el cliente recibe la misma respuesta de siempre (anti-enumeración),
                // pero quien prueba necesita saber por qué no llegó ningún correo.
                $this->avisarRegistroOmitidoEnLocal($datosLimpios['correo']);
            }
            $this->auditoria->registrar('ACTIVACION_SOLICITADA', $registro['idUsuario']);
            $this->esperarTiempoMinimo($inicio);
            $this->respuestaExitosaSimple(['mensaje' => self::MENSAJE_REGISTRO]);
        } catch (Throwable $error) {
            error_log('[PersonaCtrl::agregarPersona] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    private function enviarCodigoSinRevertir(string $correo, string $nombres, string $codigo): void
    {
        try {
            $this->enviador->enviar($correo, PlantillasCorreo::codigoVerificacion($nombres, $codigo)); // [CORREO] codigoVerificacion
        } catch (Throwable $error) {
            error_log('[PersonaCtrl::agregarPersona] Fallo al enviar el código de verificación');
        }
    }

    private function avisarRegistroOmitidoEnLocal(string $correo): void
    {
        try {
            $carpeta = EnviadorCorreo::carpetaRegistros();
        } catch (Throwable $error) {
            return;
        }
        $ruta = $carpeta . DIRECTORY_SEPARATOR
            . 'registro-omitido-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.txt';
        $contenido = 'Fecha: ' . date(DATE_ATOM) . "\n"
            . "Correo: {$correo}\n\n"
            . "No se creó ninguna cuenta ni se envió ningún correo: ese correo ya está registrado.\n"
            . "El cliente recibe la misma respuesta que un registro nuevo (así no se pueden descubrir\n"
            . "los correos existentes). Este aviso solo se escribe con APP_ENTORNO=local.\n"
            . "Prueba con un correo, un usuario y un teléfono que no existan.\n";
        @file_put_contents($ruta, $contenido, LOCK_EX);
    }

    private function validarTexto(string $valor, int $maximo, string $mensaje): void
    {
        if (mb_strlen($valor, 'UTF-8') > $maximo || $valor === '') {
            $this->respuestaErrorSimple($mensaje, 400);
        }
    }

    private function validarLongitud(string $valor, int $maximo, string $mensaje): void
    {
        if (mb_strlen($valor, 'UTF-8') > $maximo) {
            $this->respuestaErrorSimple($mensaje, 400);
        }
    }
}
