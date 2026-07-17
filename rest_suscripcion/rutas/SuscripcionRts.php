<?php

require_once(__DIR__ . '/../controladores/SuscripcionCtrl.php');

// Los headers CORS ya están configurados centralmente
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$suscripcionCtrl = new SuscripcionCtrl();

// Parsear URI para obtener acción
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'suscripcion' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'suscripcion' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($suscripcionCtrl, $action);
        break;
    case 'POST':
        manejarPost($suscripcionCtrl, $action);
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
            'service' => 'Suscripciones'
        ];

        http_response_code(200);
        echo json_encode($healthData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return;
    }

    switch ($action) {
        case 'porUsuario':
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
            $controller->obtenerSuscripcionesPorUsuario($id);

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
        case 'crearSinPago':
            $controller->insertarSuscripcionSinPago($data);
            break;
        case 'crearConPago':
            echo "Datos recibidos para crear suscripción con pago: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n";
            $controller->insertarSuscripcionConPago($data);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'error' => 'Acción no válida para método POST'
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
}