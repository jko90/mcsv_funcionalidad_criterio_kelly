<?php

require_once(__DIR__ . '/../controladores/PersonaCtrl.php');

// Los headers CORS ya están configurados centralmente
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$personaController = new PersonaCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'persona' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'persona' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

// Rutear según método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($personaController, $action);
        break;
    case 'PUT':
        manejarPut($personaController, $action);
        break;
    case 'POST':
        manejarPost($personaController, $action);
        break;
    case 'DELETE':
        manejarDelete($personaController, $action);
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
    if (!$action) {
        // Health check del servicio
        $healthData = [
            "servicio" => "Persona API",
            "estado_servicio" => "activo",
            "version" => "2.0",
            "descripcion" => "Gestión de datos de personas asociadas a usuarios",
            "endpoints" => [
                "GET /persona" => "Información del servicio",
                "GET /persona/obtener?id={id}" => "Obtener datos de persona por ID de usuario",
                "PUT /persona/actualizar" => "Actualizar nombres, apellidos y teléfono",
                "GET /persona/validar?id={id}" => "Validar si usuario tiene persona asociada"
            ],
            "campos_actualizables" => [
                "nombres" => "string(32) - Nombres de la persona",
                "apellidos" => "string(32) - Apellidos de la persona",
                "telefono" => "string(16) - Número de teléfono"
            ]
        ];

        http_response_code(200);
        echo json_encode($healthData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return;
    }

    switch ($action) {
        case 'obtener':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Parámetro ID requerido']);
                return;
            }
            // Llamar método comentado cuando esté implementado
            // $controller->obtenerPersonaPorUsuario($id);

            // Respuesta temporal
            http_response_code(501);
            echo json_encode([
                'error' => 'Método no implementado',
                'mensaje' => 'obtenerPersonaPorUsuario está pendiente de implementación'
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método GET']);
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

    if (empty($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Los datos no pueden estar vacíos']);
        return;
    }

    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'Acción requerida']);
        return;
    }

    switch ($action) {
        case 'actualizarDeApp':
            $controller->actualizarPersonaNombresTelf($data);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método PUT']);
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
        case 'agregar':
            $controller->agregarPersona($data);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'error' => 'Acción no válida para método POST'
            ]);
            break;
    }
}

function manejarDelete($controller, $action)
{
    // Método DELETE para futuras implementaciones
    http_response_code(501);
    echo json_encode([
        'error' => 'Método no implementado',
        'mensaje' => 'DELETE no está disponible para personas'
    ]);
}
