<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/ClienteIp.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../modelos/VerificacionMdl.php';
require_once __DIR__ . '/../servicios/HashClaves.php';
require_once __DIR__ . '/../correo/cargarCorreo.php';
require_once __DIR__ . '/BaseCtrl.php';

class VerificacionCtrl extends BaseCtrl
{
    private const MENSAJE_CODIGO = 'Código inválido o vencido';
    private const MENSAJE_REENVIO = 'Si el correo está pendiente de verificación, recibirás un código en unos minutos.';
    private const LONGITUD_MAXIMA_CORREO = 64;
    private const PATRON_CODIGO = '/^[0-9]{6}$/';

    private VerificacionMdl $verificacionModelo;
    private RegistroAuditoria $auditoria;
    private EnviadorCorreo $enviador;

    public function __construct()
    {
        $enlace = new Enlace();
        $this->verificacionModelo = new VerificacionMdl($enlace);
        $this->auditoria = new RegistroAuditoria($enlace, SERVICIO_ACTUAL);
        $this->enviador = new EnviadorCorreo();
    }

    public function activarCuenta(array $datos): void
    {
        try {
            $this->exigirCamposPermitidos($datos, ['correo', 'codigo']);
            $this->exigirTextos($datos, ['correo', 'codigo']);
            $this->exigirCorreoValido($datos['correo']);
            if (preg_match(self::PATRON_CODIGO, $datos['codigo']) !== 1) {
                $this->respuestaErrorSimple('El código debe tener 6 dígitos', 400);
            }

            $codigo = $datos['codigo'];
            $correo = $this->limpiarDatos(['correo' => $datos['correo']])['correo'];
            $usuariosPendientes = $this->verificacionModelo->buscarUsuarioPendientePorCorreo($correo);
            if (count($usuariosPendientes) !== 1) {
                $this->rechazarActivacion($codigo, null);
            }
            $idUsuario = (int) $usuariosPendientes[0]['usu_idUsuario'];

            $codigoActivo = $this->verificacionModelo->buscarCodigoActivo($idUsuario);
            if ($codigoActivo === null
                || !$this->verificacionModelo->consumirIntento((int) $codigoActivo['ver_idVerificacion'])) {
                $this->rechazarActivacion($codigo, $idUsuario);
            }
            if (!password_verify($codigo, (string) $codigoActivo['ver_codigoHash'])) {
                $this->registrarActivacionFallida($idUsuario);
                $this->respuestaErrorSimple(self::MENSAJE_CODIGO, 400);
            }

            $esActivada = $this->verificacionModelo->activarCuenta(
                $idUsuario,
                (int) $codigoActivo['ver_idVerificacion'],
                ClienteIp::obtener()
            );
            if (!$esActivada) {
                $this->registrarActivacionFallida($idUsuario);
                $this->respuestaErrorSimple(self::MENSAJE_CODIGO, 400);
            }
            $this->auditoria->registrar('CUENTA_ACTIVADA', $idUsuario);
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[VerificacionCtrl::activarCuenta] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function reenviarCodigo(array $datos): void
    {
        $inicio = hrtime(true);
        try {
            $this->exigirCamposPermitidos($datos, ['correo']);
            $this->exigirTextos($datos, ['correo']);
            $this->exigirCorreoValido($datos['correo']);
            if ($this->verificacionModelo->contarCodigosPorIp(ClienteIp::obtener())
                >= VerificacionMdl::MAXIMO_CODIGOS_POR_IP_HORA) {
                header('Retry-After: 3600');
                $this->respuestaErrorSimple('Demasiados intentos, intente nuevamente más tarde', 429);
            }

            $correo = $this->limpiarDatos(['correo' => $datos['correo']])['correo'];
            $usuariosPendientes = $this->verificacionModelo->buscarUsuarioPendientePorCorreo($correo);
            // El código y su hash se calculan siempre para igualar el tiempo con el camino de envío.
            $codigo = sprintf('%06d', random_int(0, 999999));
            $hashCodigo = HashClaves::hashear($codigo);
            $idUsuario = null;
            if (count($usuariosPendientes) === 1) {
                $idUsuario = (int) $usuariosPendientes[0]['usu_idUsuario'];
                try {
                    if ($this->verificacionModelo->emitirCodigoReenvio(
                        $idUsuario,
                        $hashCodigo,
                        ClienteIp::obtener(),
                        $this->obtenerAgente()
                    )) {
                        $this->enviador->enviar( // [CORREO] codigoVerificacion
                            $correo,
                            PlantillasCorreo::codigoVerificacion((string) $usuariosPendientes[0]['per_nombres'], $codigo)
                        );
                    }
                } catch (Throwable $error) {
                    error_log('[VerificacionCtrl::reenviarCodigo] ' . $error->getMessage());
                }
            } elseif (count($usuariosPendientes) > 1) {
                error_log('[VerificacionCtrl::reenviarCodigo] correo con varias cuentas pendientes');
            }
            $this->auditoria->registrar('ACTIVACION_SOLICITADA', $idUsuario);
            $this->esperarTiempoMinimo($inicio);
            $this->respuestaExitosaSimple(['mensaje' => self::MENSAJE_REENVIO]);
        } catch (Throwable $error) {
            error_log('[VerificacionCtrl::reenviarCodigo] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /**
     * Responde el error uniforme de activación. Se verifica el código contra un hash ficticio para
     * que los caminos sin código vigente tarden lo mismo que el camino con código real.
     */
    private function rechazarActivacion(string $codigo, ?int $idUsuario): void
    {
        password_verify($codigo, HashClaves::HASH_FICTICIO);
        $this->registrarActivacionFallida($idUsuario);
        $this->respuestaErrorSimple(self::MENSAJE_CODIGO, 400);
    }

    private function registrarActivacionFallida(?int $idUsuario): void
    {
        $this->auditoria->registrar('ACTIVACION_FALLIDA', $idUsuario);
    }

    private function exigirTextos(array $datos, array $campos): void
    {
        foreach ($campos as $campo) {
            if (!isset($datos[$campo]) || !is_string($datos[$campo])) {
                $this->respuestaErrorSimple('Solicitud inválida', 400);
            }
        }
    }

    private function exigirCorreoValido(string $correo): void
    {
        if (mb_strlen($correo, 'UTF-8') > self::LONGITUD_MAXIMA_CORREO
            || filter_var($correo, FILTER_VALIDATE_EMAIL) === false) {
            $this->respuestaErrorSimple('El correo no es válido', 400);
        }
    }
}
