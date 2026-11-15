<?php

require_once(__DIR__ . '/../controladores/ComentariosCtrl.php');

// Los headers CORS ya están configurados centralmente
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$comentarioController = new ComentariosCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'comentarios' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'comentarios' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

// Rutear según método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($comentarioController, $action);
        break;
    case 'POST':
        manejarPost($comentarioController, $action);
        break;
    case 'PUT':
        manejarPut($comentarioController, $action);
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
    switch ($action) {
        case 'observaciones':
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

            $controller->ObtenerObservacionesPorBitacora($id);

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
        case 'crearComentario':
            $controller->crearComentarioPorBitacora($data);
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
        case 'comentarioBitacora':
            $controller->actualizarBitacoraComentario($data);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método PUT'], JSON_UNESCAPED_UNICODE);
            break;
    }
}
