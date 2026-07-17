<?php

require_once(__DIR__ . '/../controladores/ValidacionCtrl.php');

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}


$validacionController = new ValidacionCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'autenticacion' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'autenticacion' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

// Rutear según método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($validacionController, $action);
        break;
    case 'POST':
        manejarPost($validacionController, $action);
        break;
    case 'PUT':
        manejarPut($validacionController, $action);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
        break;
}

function manejarGet($controller, $action)
{
    if (!$action) {
        // Health check del servicio
        $healthData = [
            "servicio" => "Autenticacion API",
            "estado_servicio" => "activo",
            "version" => "2.0",
            "endpoints" => [
                "POST /autenticacion/autenticar" => "Autenticar usuario",
                "GET /autenticacion/usRol?id={id}" => "Obtener roles por ID",
                "POST /autenticacion/obtenerCodigo" => "Obtener código de recuperación",
                "POST /autenticacion/generarCodigo" => "Generar código de recuperación",
                "PUT /autenticacion/actualizarClave" => "Actualizar contraseña"
            ]
        ];

        http_response_code(200);
        echo json_encode($healthData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return;
    }

    switch ($action) {
        case 'usRol':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Parámetro ID requerido']);
                return;
            }
            $controller->obtenerRolesUsuario($id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método GET']);
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
        case 'autenticar':
            $controller->autenticarUsuario($data);
            break;
        case 'generarCodigo':
            $controller->generarCodigoRecuperacion($data);
            break;
        case 'obtenerCodigo':
            $controller->obtenerCodigoRecuperacion($data);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método POST']);
            break;
    }
}

function manejarPut($controller, $action)
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

    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'Acción requerida']);
        return;
    }

    switch ($action) {
        case 'actualizarClave':
            $controller->actualizarClave($data);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método PUT']);
            break;
    }
}
