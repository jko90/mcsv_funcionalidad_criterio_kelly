<?php

require_once(__DIR__ . '/../controladores/CriterioKellyCtrl.php');

// Los headers CORS ya están configurados centralmente
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$criterioKellyCtrl = new CriterioKellyCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'criterioKelly' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'criterioKelly' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($criterioKellyCtrl, $action);
        break;
    case 'POST':
        manejarPost($criterioKellyCtrl, $action);
        break;
    default:
        http_response_code(405);
        echo json_encode([
            'error' => 'Método no permitido',
            'metodos_permitidos' => ['GET', 'POST']
        ], JSON_UNESCAPED_UNICODE);
        break;
}

function manejarGet($controller, $action)
{
    // Aquí puedes agregar más acciones GET según sea necesario
    http_response_code(404);
    echo json_encode(['error' => 'Acción no encontrada'], JSON_UNESCAPED_UNICODE);
}


function manejarPost($controller, $action)
{
    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'Acción requerida'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $rawInput = file_get_contents("php://input");

    $data = $rawInput === '' ? [] : json_decode($rawInput, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($data === null && $rawInput !== '') {
        http_response_code(400);
        echo json_encode(['error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
        return;
    }
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Los datos deben ser un objeto JSON'], JSON_UNESCAPED_UNICODE);
        return;
    }

    switch ($action) {
        case 'obtenerPorcentaje':
            $controller->obtenerPorcentajeKellyIdCuenta($data);
            break;

        case 'obtenerResultados':
            $controller->obtenerResultadoPorIdentificador($data);
            break;
        case 'detalleOperacion':
            $controller->obtenerDetalleOperaciones($data);
            break;
        case 'operacionAnalisis':
            $controller->obtenerOperacionesParaAnalisis($data);
            break;
        case 'observacionAnalisis':
            $controller->obtenerObservacionesParaAnalisis($data);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método POST'], JSON_UNESCAPED_UNICODE);
            break;
    }
}
