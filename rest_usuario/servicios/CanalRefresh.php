<?php

declare(strict_types=1);

final class CanalRefresh
{
    public const CLIENTE_WEB = 'W';
    public const CLIENTE_NATIVO = 'N';
    private const VALOR_REQUESTED_WITH = 'CriterioKelly';

    public function esClienteNativo(): bool
    {
        return ($_SERVER['HTTP_X_CLIENTE'] ?? '') === 'nativo'
            && in_array($_SERVER['HTTP_ORIGIN'] ?? '', Configuracion::obtenerLista('CORS_ORIGENES_NATIVOS'), true);
    }

    public function codigoCliente(): string
    {
        return $this->esClienteNativo() ? self::CLIENTE_NATIVO : self::CLIENTE_WEB;
    }

    public function exigirOrigenConfiable(RegistroAuditoria $auditoria, ?int $idUsuario): void
    {
        $origen = $_SERVER['HTTP_ORIGIN'] ?? '';
        $origenes = array_merge(
            Configuracion::obtenerLista('CORS_ORIGENES_WEB'),
            Configuracion::obtenerLista('CORS_ORIGENES_NATIVOS')
        );
        if (!in_array($origen, $origenes, true)
            || ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== self::VALOR_REQUESTED_WITH) {
            $auditoria->registrar('ACCESO_DENEGADO', $idUsuario, null, 'origen no permitido');
            $this->responderError(403, 'Acceso denegado');
        }
    }

    public function leerRefresh(array $cuerpo): ?string
    {
        $refresh = $this->esClienteNativo()
            ? ($cuerpo['refreshToken'] ?? null)
            : ($_COOKIE[Configuracion::obtener('COOKIE_REFRESH_NOMBRE')] ?? null);
        return is_string($refresh) && ValidadorSesion::esFormatoValido($refresh) ? $refresh : null;
    }

    public function entregar(array $respuesta, string $refresh, int $refreshExpira): array
    {
        if ($this->esClienteNativo()) {
            $respuesta['refreshToken'] = $refresh;
            return $respuesta;
        }
        setcookie(Configuracion::obtener('COOKIE_REFRESH_NOMBRE'), $refresh, [
            'expires' => $refreshExpira,
            'path' => Configuracion::obtener('COOKIE_REFRESH_RUTA'),
            'secure' => Configuracion::obtenerBooleano('COOKIE_REFRESH_SEGURA'),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        return $respuesta;
    }

    public function borrarCookie(): void
    {
        if (!$this->esClienteNativo()) {
            setcookie(Configuracion::obtener('COOKIE_REFRESH_NOMBRE'), '', [
                'expires' => 1,
                'path' => Configuracion::obtener('COOKIE_REFRESH_RUTA'),
                'secure' => Configuracion::obtenerBooleano('COOKIE_REFRESH_SEGURA'),
                'httponly' => true,
                'samesite' => 'Strict',
            ]);
        }
    }

    private function responderError(int $codigo, string $mensaje): void
    {
        http_response_code($codigo);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
