<?php

require_once(__DIR__ . '/../controladores/PlanesCtrl.php');

// Los headers CORS ya están configurados centralmente
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$planesCtrl = new PlanesCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;
$actionParam = null;

// Buscar posición de 'planes' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'planes' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        if (isset($uriParts[$i + 2])) {
            $actionParam = $uriParts[$i + 2];
        }
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($planesCtrl, $action, $actionParam);
        break;
    default:
        http_response_code(405);
        echo json_encode([
            'error' => 'Método no permitido',
            'metodos_permitidos' => ['GET', 'POST']
        ], JSON_UNESCAPED_UNICODE);
        break;
}

function manejarGet($controller, $action, $actionParam = null)
{
    switch ($action) {
        case 'disponible':
            $controller->obtenerPlanesDisponibles();
            break;

        case 'suscritos':
            $controller->obtenerPlanesSuscritosSinPagar($actionParam);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método GET'], JSON_UNESCAPED_UNICODE);
            break;
    }
}
