<?php

require_once(__DIR__ . '/configuracion/CorsConfig.php');

CorsConfig::configurar();

CorsConfig::manejarPreflight();

$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$esRaiz = ($requestUri === '/' || $requestUri === '/rest_divisas/' || $requestUri === '/rest_divisas');

if ($esRaiz) {
    $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
    $esPeticionNavegador = strpos($acceptHeader, 'text/html') !== false;

    if ($esPeticionNavegador) {
        require_once(__DIR__ . '/vistas/landing.php');
        mostrarPaginaAnuncio();
        exit;
    }

    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'ok',
        'timestamp' => date('c'),
        'version' => '1.0.0',
        'service' => 'rest_divisas'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$rutas = [
    '/cripto' => 'rutas/CriptoRts.php',
    '/forex' => 'rutas/ForexRts.php',
    '/indice' => 'rutas/IndiceRts.php',
];

$rutaEncontrada = false;

foreach ($rutas as $patron => $archivo) {
    if (str_starts_with($requestUri, $patron)) {
        $resto = substr($requestUri, strlen($patron));
        if ($resto === '' || str_starts_with($resto, '/')) {
            if (file_exists($archivo)) {
                require_once $archivo;
                $rutaEncontrada = true;
                break;
            } else {
                http_response_code(500);
                echo json_encode([
                    "error" => "Archivo de ruta no encontrado",
                    "timestamp" => date('c')
                ]);
                exit;
            }
        }
    }
}

if (!$rutaEncontrada) {
    http_response_code(404);
    echo json_encode([
        "error" => "Endpoint no encontrado",
        "mensaje" => "La ruta solicitada no existe",
        "timestamp" => date('c')
    ]);
}
