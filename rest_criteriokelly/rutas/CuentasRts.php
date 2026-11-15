<?php

require_once(__DIR__ . '/../controladores/CuentasCtrl.php');

// Los headers CORS ya están configurados centralmente
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$cuentasController = new CuentasCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'persona' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'cuentas' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

// Rutear según método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($cuentasController, $action);
        break;
    case 'PUT':
        manejarPut($cuentasController, $action);
        break;
    case 'POST':
        manejarPost($cuentasController, $action);
        break;
    case 'DELETE':
        manejarDelete($cuentasController, $action);
        break;
    default:
        http_response_code(405);
        echo json_encode([
            'error' => 'Método no permitido',
            'metodos_permitidos' => ['GET', 'PUT', 'POST', 'DELETE']
        ]);
        break;
}


function manejarGet($controller, $action)
{
    switch ($action) {
        case 'obtener':
            $id = $_GET['id'] ?? null;
            $controller->obtenerCuentasPorUsuario($id);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método GET'], JSON_UNESCAPED_UNICODE);
            break;
    }
}


function manejarPost($controller, $action)
{
    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'Acción requerida']);
        return;
    }

    $rawInput = file_get_contents("php://input");

    if (empty($rawInput)) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos requeridos']);
        return;
    }

    $data = json_decode($rawInput, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON inválido']);
        return;
    }

    if (empty($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Los datos no pueden estar vacíos']);
        return;
    }

    switch ($action) {
        case 'nueva':
            $controller->agregarCuenta($data);
            break;
        case 'movCapital':
            $controller->registroMovimientoCapital($data);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'error' => 'Acción no válida para método POST'
            ]);
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
        case 'nombre':
            $controller->actualizarNombreCuenta($data);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método PUT'], JSON_UNESCAPED_UNICODE);
            break;
    }
}


function manejarDelete($controller, $action)
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
        case 'eliminar':
            $controller->eliminarCuenta($data);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método DELETE'], JSON_UNESCAPED_UNICODE);
            break;
    }
}