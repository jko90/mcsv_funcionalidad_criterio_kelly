<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';
require_once __DIR__ . '/../configuracion/ClienteIp.php';
require_once __DIR__ . '/../configuracion/ContextoSesion.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../configuracion/ValidadorSesion.php';
require_once __DIR__ . '/../configuracion/LimitadorPeticiones.php';
require_once __DIR__ . '/../modelos/ValidacionMdl.php';
require_once __DIR__ . '/../modelos/SesionMdl.php';
require_once __DIR__ . '/../servicios/EmisorTokens.php';
require_once __DIR__ . '/../servicios/CanalRefresh.php';
require_once __DIR__ . '/../servicios/HashClaves.php';
require_once __DIR__ . '/BaseCtrl.php';

class ValidacionCtrl extends BaseCtrl
{
    private const HASH_FICTICIO = '$argon2id$v=19$m=65536,t=4,p=1$RjVxY3JPY2lyWVYzZEhyYg$h5zurQXWocwn3KsZGbrrSpn0jcbbQE8P7cIyBdTc7ws';
    private const MENSAJE_CREDENCIALES = 'Usuario o clave incorrectos';

    private ValidacionMdl $validacionModelo;
    private SesionMdl $sesionModelo;
    private LimitadorPeticiones $limitador;
    private RegistroAuditoria $auditoria;
    private EmisorTokens $emisor;
    private CanalRefresh $canal;
    private bool $transaccionActiva = false;

    public function __construct()
    {
        $enlace = new Enlace();
        $this->validacionModelo = new ValidacionMdl($enlace);
        $this->sesionModelo = new SesionMdl($enlace);
        $this->auditoria = new RegistroAuditoria($enlace, SERVICIO_ACTUAL);
        $this->limitador = new LimitadorPeticiones($enlace, $this->auditoria);
        $this->emisor = new EmisorTokens();
        $this->canal = new CanalRefresh();
    }

    public function autenticarUsuario(array $datos): void
    {
        try {
            if (!isset($datos['usuario'], $datos['clave'])
                || !is_string($datos['usuario']) || !is_string($datos['clave'])
                || trim($datos['usuario']) === '' || trim($datos['clave']) === ''
                || mb_strlen($datos['usuario']) > 64 || mb_strlen($datos['clave']) > 1024) {
                $this->respuestaErrorSimple('Solicitud inválida', 400);
            }
            $usuarioNormalizado = mb_strtolower(trim($datos['usuario']));
            $claveNormalizada = $datos['clave'];
            $this->limitador->verificarIntentoLogin($usuarioNormalizado);
            $usuario = $this->validacionModelo->buscarUsuarioParaAutenticar(
                htmlspecialchars(trim($datos['usuario']), ENT_QUOTES, 'UTF-8')
            );
            $hashComparar = $usuario['usu_clave'] ?? self::HASH_FICTICIO;
            $coincide = HashClaves::verificar($claveNormalizada, (string) $hashComparar);
            if ($usuario === null || !$coincide || $usuario['usu_situacion'] !== 'A') {
                $this->limitador->registrarFalloLogin($usuarioNormalizado, $usuario === null ? null : (int) $usuario['usu_idUsuario']);
                $this->respuestaErrorSimple(self::MENSAJE_CREDENCIALES, 401);
            }

            $ahora = time();
            $this->sesionModelo->iniciarTransaccion();
            $this->transaccionActiva = true;
            if (password_needs_rehash((string) $usuario['usu_clave'], PASSWORD_ARGON2ID)) {
                $hashNuevo = HashClaves::hashear($claveNormalizada);
                $this->validacionModelo->actualizarHashClave((int) $usuario['usu_idUsuario'], $hashNuevo);
            }
            $tokens = $this->emitirSesion((int) $usuario['usu_idUsuario'], null, null, $ahora);
            $this->limitador->registrarExitoLogin($usuarioNormalizado);
            $this->sesionModelo->confirmarTransaccion();
            $this->transaccionActiva = false;
            $this->auditoria->registrar('LOGIN_OK', (int) $usuario['usu_idUsuario'], $tokens['familia']);
            $roles = $this->obtenerRolesComoArreglo((int) $usuario['usu_idUsuario']);
            $respuesta = $this->construirRespuestaSesion($usuario, $roles, $tokens['accessToken'], $tokens['vencimientos']['accesoExpira']);
            header('Cache-Control: no-store');
            header('Pragma: no-cache');
            $this->respuestaExitosaSimple($this->canal->entregar($respuesta, $tokens['refreshToken'], $tokens['vencimientos']['refreshExpira']));
        } catch (Throwable $error) {
            $this->revertirTransaccionSiEsNecesario();
            error_log('[ValidacionCtrl::autenticarUsuario] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function renovarSesion(array $datos): void
    {
        try {
            $this->canal->exigirOrigenConfiable($this->auditoria, ContextoSesion::estaAutenticado() ? ContextoSesion::idUsuario() : null);
            $refresh = $this->canal->leerRefresh($datos);
            if ($refresh === null) {
                $this->canal->borrarCookie();
                $this->respuestaErrorSimple(ValidadorSesion::MENSAJE_NO_VALIDA, 401);
            }
            $ahora = time();
            $this->sesionModelo->iniciarTransaccion();
            $this->transaccionActiva = true;
            $sesion = $this->sesionModelo->buscarPorRefreshParaActualizar(ValidadorSesion::calcularHash($refresh));
            if ($sesion === null) {
                $this->sesionModelo->revertirTransaccion();
                $this->transaccionActiva = false;
                $this->canal->borrarCookie();
                $this->respuestaErrorSimple(ValidadorSesion::MENSAJE_NO_VALIDA, 401);
            }
            if ($sesion['ses_estado'] === 'R') {
                $this->sesionModelo->revocarFamilia((string) $sesion['ses_familia'], 'REFRESH_REUTILIZADO', gmdate('Y-m-d H:i:s', $ahora));
                $this->sesionModelo->confirmarTransaccion();
                $this->transaccionActiva = false;
                $this->auditoria->registrar('REFRESH_REUTILIZADO', (int) $sesion['ses_usuId'], (string) $sesion['ses_familia']);
                $this->canal->borrarCookie();
                $this->respuestaErrorSimple(ValidadorSesion::MENSAJE_NO_VALIDA, 401);
            }
            $refreshExpira = strtotime((string) $sesion['ses_refreshExpira'] . ' UTC');
            $familiaExpira = strtotime((string) $sesion['ses_familiaExpira'] . ' UTC');
            if ($sesion['ses_estado'] !== 'A' || $refreshExpira === false || $familiaExpira === false
                || $refreshExpira <= $ahora || $familiaExpira <= $ahora
                || $sesion['ses_cliente'] !== $this->canal->codigoCliente()) {
                $this->sesionModelo->revertirTransaccion();
                $this->transaccionActiva = false;
                $this->canal->borrarCookie();
                $this->respuestaErrorSimple(ValidadorSesion::MENSAJE_NO_VALIDA, 401);
            }
            $usuario = $this->validacionModelo->obtenerUsuarioActivoPorId((int) $sesion['ses_usuId']);
            if ($usuario === null || $this->sesionModelo->marcarRotada((int) $sesion['ses_id'], gmdate('Y-m-d H:i:s', $ahora)) !== 1) {
                $this->sesionModelo->revertirTransaccion();
                $this->transaccionActiva = false;
                $this->canal->borrarCookie();
                $this->respuestaErrorSimple(ValidadorSesion::MENSAJE_NO_VALIDA, 401);
            }
            $tokens = $this->emitirSesion((int) $sesion['ses_usuId'], (string) $sesion['ses_familia'], $familiaExpira, $ahora);
            $this->sesionModelo->confirmarTransaccion();
            $this->transaccionActiva = false;
            $navegadorActual = SesionMdl::clasificarNavegador((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
            if ($navegadorActual !== $sesion['ses_navegador']) {
                $this->auditoria->registrar('SESION_ANOMALA', (int) $sesion['ses_usuId'], (string) $sesion['ses_familia'], 'navegador ' . $sesion['ses_navegador'] . '->' . $navegadorActual);
            }
            $this->auditoria->registrar('RENOVAR', (int) $sesion['ses_usuId'], (string) $sesion['ses_familia']);
            $roles = $this->obtenerRolesComoArreglo((int) $sesion['ses_usuId']);
            $respuesta = $this->construirRespuestaSesion($usuario, $roles, $tokens['accessToken'], $tokens['vencimientos']['accesoExpira']);
            header('Cache-Control: no-store');
            header('Pragma: no-cache');
            $this->respuestaExitosaSimple($this->canal->entregar($respuesta, $tokens['refreshToken'], $tokens['vencimientos']['refreshExpira']));
        } catch (Throwable $error) {
            $this->revertirTransaccionSiEsNecesario();
            error_log('[ValidacionCtrl::renovarSesion] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function cerrarSesion(): void
    {
        try {
            $idUsuario = ContextoSesion::idUsuario();
            $familia = ContextoSesion::familia();
            $this->canal->exigirOrigenConfiable($this->auditoria, $idUsuario);
            $this->sesionModelo->revocarFamilia($familia, 'CIERRE_SESION', gmdate('Y-m-d H:i:s'));
            $this->auditoria->registrar('CIERRE_SESION', $idUsuario, $familia);
            $this->canal->borrarCookie();
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[ValidacionCtrl::cerrarSesion] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function cerrarTodasLasSesiones(): void
    {
        try {
            $idUsuario = ContextoSesion::idUsuario();
            $this->sesionModelo->revocarTodasDeUsuario($idUsuario, 'CIERRE_TODAS', gmdate('Y-m-d H:i:s'));
            $this->auditoria->registrar('CIERRE_TODAS', $idUsuario);
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[ValidacionCtrl::cerrarTodasLasSesiones] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerRolesUsuario(?string $idQuery): void
    {
        try {
            if ($idQuery !== null && $idQuery !== (string) ContextoSesion::idUsuario()) {
                $this->auditoria->registrar('ACCESO_DENEGADO', ContextoSesion::idUsuario(), ContextoSesion::familia(), 'usuario distinto');
                $this->respuestaErrorSimple('Acceso denegado', 403);
            }
            $this->respuestaJsonSimple(ContextoSesion::roles(), 200);
        } catch (Throwable $error) {
            error_log('[ValidacionCtrl::obtenerRolesUsuario] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    private function emitirSesion(int $idUsuario, ?string $familia, ?int $familiaExpira, int $ahora): array
    {
        $familia = $familia ?? $this->emisor->generarFamilia();
        $accessToken = $this->emisor->generarToken();
        $refreshToken = $this->emisor->generarToken();
        $vencimientos = $this->emisor->calcularVencimientos($ahora, $familiaExpira);
        $agente = mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
        $this->sesionModelo->crearSesion(
            $idUsuario,
            $familia,
            ValidadorSesion::calcularHash($accessToken),
            ValidadorSesion::calcularHash($refreshToken),
            gmdate('Y-m-d H:i:s', $vencimientos['accesoExpira']),
            gmdate('Y-m-d H:i:s', $vencimientos['refreshExpira']),
            gmdate('Y-m-d H:i:s', $vencimientos['familiaExpira']),
            gmdate('Y-m-d H:i:s', $ahora),
            ClienteIp::obtener(),
            $agente,
            SesionMdl::clasificarNavegador($agente),
            $this->canal->codigoCliente()
        );
        return ['familia' => $familia, 'accessToken' => $accessToken, 'refreshToken' => $refreshToken, 'vencimientos' => $vencimientos];
    }

    private function obtenerRolesComoArreglo(int $idUsuario): array
    {
        $roles = [];
        $filas = $this->validacionModelo->obtenerRolesUsuarios($idUsuario);
        while ($fila = $filas->fetch_assoc()) {
            $roles[] = ['rol_id' => (int) $fila['rol_id'], 'rol_descripcion' => (string) $fila['rol_descripcion']];
        }
        return $roles;
    }

    private function construirRespuestaSesion(array $usuario, array $roles, string $accessToken, int $accesoExpira): array
    {
        return [
            'id' => (int) $usuario['usu_idUsuario'],
            'nombres' => (string) ($usuario['per_nombres'] ?? ''),
            'apellidos' => (string) ($usuario['per_apellidos'] ?? ''),
            'roles' => $roles,
            'accessToken' => $accessToken,
            'accessExpira' => $this->emisor->formatearIso($accesoExpira),
        ];
    }

    private function revertirTransaccionSiEsNecesario(): void
    {
        if ($this->transaccionActiva) {
            try {
                $this->sesionModelo->revertirTransaccion();
            } catch (Throwable $error) {
                error_log('[ValidacionCtrl] Error al revertir transacción: ' . $error->getMessage());
            }
            $this->transaccionActiva = false;
        }
    }
}
