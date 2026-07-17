<?php

require_once(__DIR__ . '/../controladores/BitacoraCtrl.php');
require_once(__DIR__ . '/../controladores/ReglasKellyCtrl.php');

// Los headers CORS ya están configurados centralmente
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$bitacoraController = new BitacoraCtrl();
$reglasKellyController = new ReglasKellyCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'bitacora' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'bitacora' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

// Rutear según método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($bitacoraController, $action);
        break;
    case 'POST':
        manejarPost($bitacoraController, $action);
        break;
    case 'PUT':
        manejarPut($reglasKellyController, $action);
        break;
    case 'DELETE':
        manejarEliminacion($bitacoraController, $action);
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
    if (!$action) {
        // Health check del servicio
        $healthData = [
            'status' => 'ok',
            'timestamp' => date('Y-m-d H:i:s'),
            'version' => '1.0.0',
            'service' => 'BitacoraRTs'
        ];

        http_response_code(200);
        echo json_encode($healthData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return;
    }

}


function manejarPost($controller, $action)
{
    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'Acción requerida'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $rawInput = file_get_contents("php://input");

    if (empty($rawInput)) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos requeridos'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $data = json_decode($rawInput, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
        return;
    }

    if (empty($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Los datos no pueden estar vacíos'], JSON_UNESCAPED_UNICODE);
        return;
    }

    switch ($action) {
        case 'crear':
            $controller->crearBitacora($data);
            break;
        case 'listBitacora':
            $controller->obtenerBitacoraPorCuenta($data);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'error' => 'Acción no válida para método POST'
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
}

function manejarPut($controller, $action)
{
    $rawInput = file_get_contents("php://input");

    if (empty($rawInput)) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos requeridos'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $data = json_decode($rawInput, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
        return;
    }

    if (empty($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Los datos no pueden estar vacíos'], JSON_UNESCAPED_UNICODE);
        return;
    }

    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'Acción requerida'], JSON_UNESCAPED_UNICODE);
        return;
    }

    switch ($action) {
        case 'finalizaBitacora':
            $controller->finalizarOperacionBitacora($data);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método PUT'], JSON_UNESCAPED_UNICODE);
            break;
    }
}


function manejarEliminacion($controller, $action)
{
    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'Acción requerida'], JSON_UNESCAPED_UNICODE);
        return;
    }

    switch ($action) {
        case 'eliminarBitacora':
            $id = $_GET['id'] ?? null;
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

            $controller->eliminarBitacoraBitacora($id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método DELETE'], JSON_UNESCAPED_UNICODE);
            break;
    }
}
