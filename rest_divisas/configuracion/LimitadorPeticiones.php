<?php

declare(strict_types=1);

final class LimitadorPeticiones
{
    private const LOGIN_MAX_FALLOS_USUARIO = 5;
    private const LOGIN_MAX_FALLOS_IP = 20;
    private const LOGIN_VENTANA_SEGUNDOS = 900;
    private const API_MAX_POR_SESION = 300;
    private const API_MAX_PUBLICO_POR_IP = 60;
    private const API_VENTANA_SEGUNDOS = 60;
    public const MENSAJE_LIMITE = 'Demasiados intentos, intente nuevamente más tarde';

    public function __construct(private Enlace $enlace, private RegistroAuditoria $auditoria)
    {
    }

    public function controlar(): void
    {
        $esAutenticado = ContextoSesion::estaAutenticado();
        $clave = $esAutenticado ? 'S:' . ContextoSesion::familia() : 'I:' . ClienteIp::obtener();
        $limite = $esAutenticado ? self::API_MAX_POR_SESION : self::API_MAX_PUBLICO_POR_IP;
        $ventana = gmdate('Y-m-d H:i:00');
        $hashClave = hash('sha256', $clave);
        $sqlIncrementar = 'INSERT INTO sgen_limitepeticion (lip_clave, lip_ventana, lip_contador)
            VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE lip_contador = lip_contador + 1';
        $this->enlace->ejecutarActualizacion($sqlIncrementar, 'ss', $hashClave, $ventana);
        $sqlContar = 'SELECT lip_contador FROM sgen_limitepeticion WHERE lip_clave = ? AND lip_ventana = ?';
        $fila = $this->enlace->ejecutarConsultaSimpleFila($sqlContar, 'ss', $hashClave, $ventana);
        $contador = (int) ($fila['lip_contador'] ?? 0);
        if ($contador > $limite) {
            if ($contador === $limite + 1) {
                $this->auditoria->registrar('LIMITE_PETICIONES', $esAutenticado ? ContextoSesion::idUsuario() : null, $esAutenticado ? ContextoSesion::familia() : null, 'limite=' . $contador);
            }
            $this->responderError(429, self::MENSAJE_LIMITE, max(1, self::API_VENTANA_SEGUNDOS - (time() % self::API_VENTANA_SEGUNDOS)));
        }
    }

    public function verificarIntentoLogin(string $usuarioNormalizado): void
    {
        $ahora = time();
        $desde = gmdate('Y-m-d H:i:s', $ahora - self::LOGIN_VENTANA_SEGUNDOS);
        $hashUsuario = $this->hashUsuario($usuarioNormalizado);
        $conteoUsuario = $this->contarIntentos('ina_usuarioHash', $hashUsuario, $desde);
        $conteoIp = $this->contarIntentos('ina_ip', ClienteIp::obtener(), $desde);
        if ($conteoUsuario['total'] >= self::LOGIN_MAX_FALLOS_USUARIO || $conteoIp['total'] >= self::LOGIN_MAX_FALLOS_IP) {
            $this->responderError(429, self::MENSAJE_LIMITE, $this->calcularReintento($conteoUsuario['primera'], $conteoIp['primera'], $ahora));
        }
        $sqlRegistrarIntento = 'INSERT INTO sgen_intentoacceso (ina_usuarioHash, ina_ip, ina_fecha) VALUES (?, ?, ?)';
        $this->enlace->ejecutarInsercionRetornaID($sqlRegistrarIntento, 'sss', $hashUsuario, ClienteIp::obtener(), gmdate('Y-m-d H:i:s'));
        $conteoUsuario = $this->contarIntentos('ina_usuarioHash', $hashUsuario, $desde);
        $conteoIp = $this->contarIntentos('ina_ip', ClienteIp::obtener(), $desde);
        if ($conteoUsuario['total'] > self::LOGIN_MAX_FALLOS_USUARIO || $conteoIp['total'] > self::LOGIN_MAX_FALLOS_IP) {
            $this->responderError(429, self::MENSAJE_LIMITE, $this->calcularReintento($conteoUsuario['primera'], $conteoIp['primera'], $ahora));
        }
    }

    public function registrarFalloLogin(string $usuarioNormalizado, ?int $idUsuario): void
    {
        $hashUsuario = $this->hashUsuario($usuarioNormalizado);
        $this->auditoria->registrar('LOGIN_FALLIDO', $idUsuario);
        $desde = gmdate('Y-m-d H:i:s', time() - self::LOGIN_VENTANA_SEGUNDOS);
        $conteoUsuario = $this->contarIntentos('ina_usuarioHash', $hashUsuario, $desde)['total'];
        $conteoIp = $this->contarIntentos('ina_ip', ClienteIp::obtener(), $desde)['total'];
        if ($conteoUsuario === self::LOGIN_MAX_FALLOS_USUARIO) {
            $this->auditoria->registrar('BLOQUEO_USUARIO', $idUsuario);
        }
        if ($conteoIp === self::LOGIN_MAX_FALLOS_IP) {
            $this->auditoria->registrar('BLOQUEO_IP', $idUsuario);
        }
    }

    public function registrarExitoLogin(string $usuarioNormalizado): void
    {
        $sqlLimpiarIntentos = 'DELETE FROM sgen_intentoacceso WHERE ina_usuarioHash = ?';
        $this->enlace->ejecutarActualizacion($sqlLimpiarIntentos, 's', $this->hashUsuario($usuarioNormalizado));
    }

    private function contarIntentos(string $columna, string $valor, string $desde): array
    {
        $columnasPermitidas = ['ina_usuarioHash' => 'ina_usuarioHash', 'ina_ip' => 'ina_ip'];
        $columnaSegura = $columnasPermitidas[$columna];
        $sqlContarIntentos = "SELECT COUNT(*) AS total, MIN(ina_fecha) AS primera FROM sgen_intentoacceso WHERE {$columnaSegura} = ? AND ina_fecha > ?";
        $fila = $this->enlace->ejecutarConsultaSimpleFila($sqlContarIntentos, 'ss', $valor, $desde);
        return ['total' => (int) ($fila['total'] ?? 0), 'primera' => $fila['primera'] ?? null];
    }

    private function calcularReintento(?string $primeraUsuario, ?string $primeraIp, int $ahora): int
    {
        $marcas = [];
        foreach ([$primeraUsuario, $primeraIp] as $primera) {
            if ($primera !== null) {
                $marca = strtotime($primera . ' UTC');
                if ($marca !== false) {
                    $marcas[] = $marca + self::LOGIN_VENTANA_SEGUNDOS - $ahora;
                }
            }
        }
        return max(1, $marcas === [] ? self::LOGIN_VENTANA_SEGUNDOS : max($marcas));
    }

    private function hashUsuario(string $usuarioNormalizado): string
    {
        return hash('sha256', $usuarioNormalizado);
    }

    private function responderError(int $codigo, string $mensaje, int $reintento): void
    {
        http_response_code($codigo);
        header('Content-Type: application/json; charset=utf-8');
        header('Retry-After: ' . $reintento);
        echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
