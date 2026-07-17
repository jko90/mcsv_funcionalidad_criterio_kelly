<?php

require_once(__DIR__ . '/global.php');

class CorsConfig
{
    public static function configurar()
    {
        if (headers_sent()) {
            return;
        }

        header('Content-Type: application/json; charset=utf-8');

        header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Max-Age: 3600');

        header('Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; font-src \'self\'; img-src \'self\' data:; connect-src \'self\' ' . CORS_ORIGIN);

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
