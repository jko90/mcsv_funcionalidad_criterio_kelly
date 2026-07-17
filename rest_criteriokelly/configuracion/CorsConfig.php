<?php

class CorsConfig
{
    public static function configurar()
    {
        // No configurar headers si ya se enviaron
        if (headers_sent()) {
            return;
        }

        // Content-Type siempre JSON para API
        header('Content-Type: application/json; charset=utf-8');

        // Headers CORS ya están configurados en .htaccess
        // Solo manejamos aquí casos especiales si es necesario

        // Headers de seguridad adicionales (complemento a .htaccess)
        header('Cache-Control: no-cache, must-revalidate');
        header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
    }

    public static function manejarPreflight()
    {
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
}
