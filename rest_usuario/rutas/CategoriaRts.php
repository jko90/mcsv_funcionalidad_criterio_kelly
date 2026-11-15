<?php
require_once(__DIR__ . '/../controladores/CategoriaCtrl.php');

$categoriaController = new CategoriaCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'categoria' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'categoria' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

// Rutear según método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($categoriaController, $action);
        break;
    case 'POST':
        manejarPost($categoriaController);
        break;
    case 'PUT':
        manejarPut($categoriaController);
        break;
    case 'DELETE':
        manejarDelete($categoriaController);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
        break;
}

function manejarGet($controller, $action)
{
    switch ($action) {
        case 'listCategorias':
            $controller->listaCategorias();
            break;
        case 'categoriaById':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Parámetro ID requerido']);
                return;
            }
            $controller->obtenerCategoria($id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida']);
            break;
    }
}

function manejarPost($controller)
{
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

    $controller->agregarCategoria($data);
}

function manejarPut($controller)
{
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

    if (!isset($data['id']) || empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido']);
        return;
    }

    $controller->actualizarCategoria($data['id'], $data);
}

function manejarDelete($controller)
{
    $id = $_GET['id'] ?? null;

    // Si no hay ID en query params, intentar obtenerlo del body
    if (!$id) {
        $rawInput = file_get_contents("php://input");
        if (!empty($rawInput)) {
            $data = json_decode($rawInput, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($data['id'])) {
                $id = $data['id'];
            }
        }
    }

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido']);
        return;
    }

    $controller->eliminarCategoria($id);
}
