<?php

declare(strict_types=1);

/**
 * Aplica las cabeceras de seguridad comunes a toda respuesta HTTP.
 */
final class CabecerasSeguridad
{
    private const HSTS = 'max-age=31536000; includeSubDomains';
    private const PUERTO_HTTPS = 443;
    private const PERMISSIONS_POLICY = 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

    public static function aplicar(): void
    {
        header_remove('X-Powered-By');

        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('Permissions-Policy: ' . self::PERMISSIONS_POLICY);
        header('Cross-Origin-Resource-Policy: same-site');
        header('X-XSS-Protection: 0');
        header('Vary: Origin');

        if (!Configuracion::obtenerBooleano('FORZAR_HTTPS')) {
            return;
        }

        if (!self::esHttps()) {
            ManejadorErrores::responderError(403, 'Acceso denegado');
        }

        header('Strict-Transport-Security: ' . self::HSTS);
    }

    private static function esHttps(): bool
    {
        $https = $_SERVER['HTTPS'] ?? '';
        if ($https !== '' && strtolower($https) !== 'off') {
            return true;
        }

        return (int) ($_SERVER['SERVER_PORT'] ?? 0) === self::PUERTO_HTTPS;
    }
}
