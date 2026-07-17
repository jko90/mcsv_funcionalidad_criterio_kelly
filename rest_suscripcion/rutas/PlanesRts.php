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
    if (!$action) {
        $healthData = [
            'status' => 'ok',
            'timestamp' => date('Y-m-d H:i:s'),
            'version' => '1.0.0',
            'service' => 'PlanesRTS'
        ];

        http_response_code(200);
        echo json_encode($healthData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return;
    }

    switch ($action) {
        case 'disponible':
            $controller->obtenerPlanesDisponibles();
            break;

        case 'suscritos':

            $id = $actionParam;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Parámetro ID requerido'], JSON_UNESCAPED_UNICODE);
                return;
            }
            if (!is_numeric($id) || (int)$id <= 0) {
                http_response_code(400);
                echo json_encode(['error' => 'ID debe ser un número entero positivo'], JSON_UNESCAPED_UNICODE);
                return;
            }
            $controller->obtenerPlanesSuscritosSinPagar($id);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método GET'], JSON_UNESCAPED_UNICODE);
            break;
    }
}
