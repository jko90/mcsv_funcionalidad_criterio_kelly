<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/ClienteIp.php';
require_once __DIR__ . '/../configuracion/ContextoSesion.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../modelos/ClaveMdl.php';
require_once __DIR__ . '/../servicios/HashClaves.php';
require_once __DIR__ . '/../servicios/PoliticaClaves.php';
require_once __DIR__ . '/../correo/cargarCorreo.php';
require_once __DIR__ . '/BaseCtrl.php';

class ClaveCtrl extends BaseCtrl
{
    private const MENSAJE_SOLICITUD = 'Si el correo está registrado, recibirás un código en unos minutos.';
    private const MENSAJE_CODIGO = 'Código inválido o vencido';

    private ClaveMdl $claveModelo;
    private RegistroAuditoria $auditoria;
    private EnviadorCorreo $enviador;

    public function __construct()
    {
        $enlace = new Enlace();
        $this->claveModelo = new ClaveMdl($enlace);
        $this->auditoria = new RegistroAuditoria($enlace, SERVICIO_ACTUAL);
        $this->enviador = new EnviadorCorreo();
    }

    public function solicitarRecuperacion(array $datos): void
    {
        $inicio = hrtime(true);
        try {
            $this->exigirCamposPermitidos($datos, ['correo']);
            if (!isset($datos['correo']) || !is_string($datos['correo'])
                || mb_strlen($datos['correo'], 'UTF-8') > 64
                || filter_var($datos['correo'], FILTER_VALIDATE_EMAIL) === false) {
                $this->respuestaErrorSimple('El correo no es válido', 400);
            }

            $correo = $this->limpiarDatos(['correo' => $datos['correo']])['correo'];
            $usuarios = $this->claveModelo->buscarUsuarioPorCorreo($correo);
            $codigo = sprintf('%06d', random_int(0, 999999));
            $hashCodigo = HashClaves::hashear($codigo);
            $idUsuario = null;
            if (count($usuarios) === 1) {
                $usuario = $usuarios[0];
                $idUsuario = (int) $usuario['usu_idUsuario'];
                try {
                    if ($this->claveModelo->registrarSolicitud(
                        $idUsuario,
                        $hashCodigo,
                        ClienteIp::obtener(),
                        $this->obtenerAgente()
                    )) {
                        $this->enviador->enviar( // [CORREO] codigoRecuperacion
                            $correo,
                            PlantillasCorreo::codigoRecuperacion((string) $usuario['per_nombres'], $codigo)
                        );
                    }
                } catch (Throwable $error) {
                    error_log('[ClaveCtrl::solicitarRecuperacion] ' . $error->getMessage());
                }
            } elseif (count($usuarios) > 1) {
                error_log('[ClaveCtrl::solicitarRecuperacion] correo con varias cuentas activas');
            }
            $this->auditoria->registrar('RECUPERACION_SOLICITADA', $idUsuario);
            $this->esperarTiempoMinimo($inicio);
            $this->respuestaExitosaSimple(['mensaje' => self::MENSAJE_SOLICITUD]);
        } catch (Throwable $error) {
            error_log('[ClaveCtrl::solicitarRecuperacion] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function restablecerClave(array $datos): void
    {
        try {
            $this->exigirCamposPermitidos($datos, ['correo', 'codigo', 'claveNueva']);
            foreach (['correo', 'codigo', 'claveNueva'] as $campo) {
                if (!isset($datos[$campo]) || !is_string($datos[$campo])) {
                    $this->respuestaErrorSimple('Solicitud inválida', 400);
                }
            }
            if (mb_strlen($datos['correo'], 'UTF-8') > 64
                || filter_var($datos['correo'], FILTER_VALIDATE_EMAIL) === false) {
                $this->respuestaErrorSimple('El correo no es válido', 400);
            }
            if (preg_match('/^[0-9]{6}$/', $datos['codigo']) !== 1) {
                $this->respuestaErrorSimple('El código debe tener 6 dígitos', 400);
            }
            $correo = $this->limpiarDatos(['correo' => $datos['correo']])['correo'];
            $mensajePolitica = PoliticaClaves::validar($datos['claveNueva'], '', $correo);
            if ($mensajePolitica !== null) {
                $this->respuestaErrorSimple($mensajePolitica, 400);
            }

            $usuarios = $this->claveModelo->buscarUsuarioPorCorreo($correo);
            if (count($usuarios) !== 1) {
                password_verify($datos['codigo'], HashClaves::HASH_FICTICIO);
                $this->respuestaErrorSimple(self::MENSAJE_CODIGO, 400);
            }
            $usuario = $usuarios[0];
            $codigoActivo = $this->claveModelo->buscarCodigoActivo((int) $usuario['usu_idUsuario']);
            if ($codigoActivo === null || !$this->claveModelo->consumirIntento((int) $codigoActivo['rec_idRecuperacion'])) {
                password_verify($datos['codigo'], HashClaves::HASH_FICTICIO);
                $this->respuestaErrorSimple(self::MENSAJE_CODIGO, 400);
            }
            if (!HashClaves::verificar($datos['codigo'], (string) $codigoActivo['rec_codigoHash'])) {
                $this->respuestaErrorSimple(self::MENSAJE_CODIGO, 400);
            }
            $mensajePolitica = PoliticaClaves::validar(
                $datos['claveNueva'],
                (string) $usuario['usu_usuario'],
                $correo
            );
            if ($mensajePolitica !== null) {
                $this->respuestaErrorSimple($mensajePolitica, 400);
            }
            $esRestablecida = $this->claveModelo->restablecerClave(
                (int) $usuario['usu_idUsuario'],
                (int) $codigoActivo['rec_idRecuperacion'],
                HashClaves::hashear($datos['claveNueva']),
                ClienteIp::obtener()
            );
            if (!$esRestablecida) {
                $this->respuestaErrorSimple(self::MENSAJE_CODIGO, 400);
            }
            $this->auditoria->registrar('CLAVE_RESTABLECIDA', (int) $usuario['usu_idUsuario']);
            $this->enviarAvisoSinRevertir(
                (string) $usuario['per_correo'],
                (string) $usuario['per_nombres']
            );
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[ClaveCtrl::restablecerClave] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function actualizarClave(array $datos): void
    {
        try {
            $this->exigirCamposPermitidos($datos, ['id', 'claveActual', 'claveNueva']);
            $this->exigirIdDeSesion($datos);
            if (!array_key_exists('claveActual', $datos)) {
                $this->respuestaErrorSimple("El campo 'claveActual' es requerido", 400);
            }
            foreach (['claveActual', 'claveNueva'] as $campo) {
                if (!isset($datos[$campo]) || !is_string($datos[$campo]) || $datos[$campo] === '') {
                    $this->respuestaErrorSimple("El campo '{$campo}' es requerido", 400);
                }
            }
            $idUsuario = ContextoSesion::idUsuario();
            if ($this->claveModelo->contarFallosRecientes($idUsuario, 15) >= 5) {
                header('Retry-After: 900');
                $this->respuestaErrorSimple('Demasiados intentos, intente nuevamente más tarde', 429);
            }
            $usuario = $this->claveModelo->obtenerUsuarioParaCambio($idUsuario);
            if ($usuario === null || !HashClaves::verificar($datos['claveActual'], (string) $usuario['usu_clave'])) {
                $this->auditoria->registrar('LOGIN_FALLIDO', $idUsuario, ContextoSesion::familia(), 'cambio de clave');
                $this->respuestaErrorSimple('La clave actual no es correcta', 400);
            }
            $mensajePolitica = PoliticaClaves::validar(
                $datos['claveNueva'],
                (string) $usuario['usu_usuario'],
                (string) $usuario['per_correo']
            );
            if ($mensajePolitica !== null) {
                $this->respuestaErrorSimple($mensajePolitica, 400);
            }
            $this->claveModelo->cambiarClave(
                $idUsuario,
                ContextoSesion::idSesion(),
                HashClaves::hashear($datos['claveNueva'])
            );
            $this->auditoria->registrar('CLAVE_CAMBIADA', $idUsuario, ContextoSesion::familia());
            $this->enviarAvisoSinRevertir((string) $usuario['per_correo'], (string) $usuario['per_nombres']);
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[ClaveCtrl::actualizarClave] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    private function enviarAvisoSinRevertir(string $correo, string $nombres): void
    {
        try {
            $this->enviador->enviar($correo, PlantillasCorreo::avisoCambioClave($nombres, date('Y-m-d H:i'))); // [CORREO] avisoCambioClave
        } catch (Throwable $error) {
            error_log('[ClaveCtrl] Fallo al enviar aviso de cambio de clave');
        }
    }
}
