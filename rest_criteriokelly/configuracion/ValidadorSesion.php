<?php

declare(strict_types=1);

final class ValidadorSesion
{
    public const MENSAJE_NO_VALIDA = 'Sesión no válida o expirada';
    private const SEGUNDOS_ACTUALIZAR_USO = 60;

    public function __construct(private Enlace $enlace)
    {
    }

    public function exigir(): void
    {
        $token = $this->leerTokenBearer();
        if ($token === null) {
            $this->responderError(401, self::MENSAJE_NO_VALIDA);
        }
        $hashAcceso = self::calcularHash($token);
        $ahora = gmdate('Y-m-d H:i:s');
        $sqlBuscarSesion = "SELECT s.ses_id, s.ses_familia, s.ses_usuId, s.ses_hashAcceso, s.ses_ultimoUso
            FROM sgen_sesion s INNER JOIN sgen_usuario u ON u.usu_idUsuario = s.ses_usuId
            WHERE s.ses_hashAcceso = ? AND s.ses_estado = 'A'
              AND s.ses_accesoExpira > ? AND s.ses_familiaExpira > ?
              AND u.usu_estado = '1' AND u.usu_situacion = 'A' LIMIT 1";
        $sesion = $this->enlace->ejecutarConsultaSimpleFila($sqlBuscarSesion, 'sss', $hashAcceso, $ahora, $ahora);
        if ($sesion === null || !hash_equals((string) $sesion['ses_hashAcceso'], $hashAcceso)) {
            $this->responderError(401, self::MENSAJE_NO_VALIDA);
        }
        $sqlObtenerRoles = "SELECT r.rol_id, r.rol_descripcion FROM sgen_rolusuario ru
            INNER JOIN sgen_rol r ON ru.rus_rolId = r.rol_id
            WHERE ru.rus_usuId = ? AND ru.rus_estado = '1' ORDER BY r.rol_id";
        $roles = [];
        $filasRoles = $this->enlace->ejecutarConsulta($sqlObtenerRoles, 'i', (int) $sesion['ses_usuId']);
        while ($filaRol = $filasRoles->fetch_assoc()) {
            $roles[] = ['rol_id' => (int) $filaRol['rol_id'], 'rol_descripcion' => (string) $filaRol['rol_descripcion']];
        }
        $ultimoUso = strtotime((string) $sesion['ses_ultimoUso'] . ' UTC');
        if ($ultimoUso !== false && time() - $ultimoUso >= self::SEGUNDOS_ACTUALIZAR_USO) {
            $sqlActualizarUso = 'UPDATE sgen_sesion SET ses_ultimoUso = ? WHERE ses_id = ?';
            $this->enlace->ejecutarActualizacion($sqlActualizarUso, 'si', $ahora, (int) $sesion['ses_id']);
        }
        ContextoSesion::establecer((int) $sesion['ses_usuId'], $roles, (int) $sesion['ses_id'], (string) $sesion['ses_familia']);
    }

    public static function calcularHash(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function esFormatoValido(string $token): bool
    {
        return preg_match('/^[A-Za-z0-9_-]{43}$/', $token) === 1;
    }

    private function leerTokenBearer(): ?string
    {
        $cabecera = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer ([A-Za-z0-9_-]{43})$/', $cabecera, $coincidencias) !== 1) {
            return null;
        }
        return $coincidencias[1];
    }

    private function responderError(int $codigo, string $mensaje): void
    {
        http_response_code($codigo);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
