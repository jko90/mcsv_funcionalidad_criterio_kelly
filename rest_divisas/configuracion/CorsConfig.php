<?php

declare(strict_types=1);

/**
 * Aplica la política CORS de lista blanca y responde el preflight.
 */
final class CorsConfig
{
    public const METODOS_PERMITIDOS = 'GET, POST, PUT, DELETE, OPTIONS';
    public const CABECERAS_PERMITIDAS = 'Authorization, Content-Type, X-Cliente, X-Requested-With';
    public const CABECERAS_EXPUESTAS = 'Retry-After';
    public const SEGUNDOS_CACHE_PREFLIGHT = 600;

    public static function aplicar(bool $permitirCredenciales): void
    {
        $origen = $_SERVER['HTTP_ORIGIN'] ?? null;
        $origenesWeb = Configuracion::obtenerLista('CORS_ORIGENES_WEB');
        $origenesNativos = Configuracion::obtenerLista('CORS_ORIGENES_NATIVOS');
        $esPreflight = ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS';

        $esPermitido = $origen !== null
            && in_array($origen, array_merge($origenesWeb, $origenesNativos), true);

        if ($esPermitido) {
            header('Access-Control-Allow-Origin: ' . $origen);
            header('Access-Control-Expose-Headers: ' . self::CABECERAS_EXPUESTAS);

            if ($permitirCredenciales && in_array($origen, $origenesWeb, true)) {
                header('Access-Control-Allow-Credentials: true');
            }
        }

        if ($origen !== null && !$esPermitido && !$esPreflight) {
            ManejadorErrores::responderError(403, 'Acceso denegado');
        }

        if (!$esPreflight) {
            return;
        }

        if ($esPermitido) {
            header('Access-Control-Allow-Methods: ' . self::METODOS_PERMITIDOS);
            header('Access-Control-Allow-Headers: ' . self::CABECERAS_PERMITIDAS);
            header('Access-Control-Max-Age: ' . self::SEGUNDOS_CACHE_PREFLIGHT);
        }

        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        http_response_code(204);
        exit;
    }
}
