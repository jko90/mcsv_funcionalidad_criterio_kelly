<?php

declare(strict_types=1);

require_once __DIR__ . '/../controladores/SuscripcionCtrl.php';

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$suscripcionCtrl = new SuscripcionCtrl();
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;
$actionParam = null;

for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'suscripcion' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        $actionParam = $uriParts[$i + 2] ?? null;
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGet($suscripcionCtrl, $action, $actionParam);
        break;
    case 'POST':
        manejarPost($suscripcionCtrl, $action, $actionParam);
        break;
    default:
        http_response_code(405);
        echo json_encode([
            'error' => 'Método no permitido',
            'metodos_permitidos' => ['GET', 'POST'],
        ], JSON_UNESCAPED_UNICODE);
        break;
}

function manejarGet(SuscripcionCtrl $controller, ?string $action, ?string $actionParam): void
{
    switch ($action) {
        case 'porUsuario':
            $controller->obtenerSuscripcionesPorUsuario($_GET['id'] ?? null, $actionParam);
            break;
        case 'planVigente':
            $controller->obtenerPlanVigente($_GET['id'] ?? null, $actionParam);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método GET'], JSON_UNESCAPED_UNICODE);
            break;
    }
}

function manejarPost(SuscripcionCtrl $controller, ?string $action, ?string $actionParam = null): void
{
    if ($action === null || $action === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Acción requerida'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $rawInput = file_get_contents('php://input');
    if ($action === 'iniciarPrueba') {
        manejarIniciarPrueba($controller, $rawInput);
        return;
    }
    if ($action === 'cancelar') {
        manejarCancelar($controller, $rawInput, $actionParam);
        return;
    }
    if ($rawInput === false || trim($rawInput) === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Datos requeridos'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $datos = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($datos)) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
        return;
    }
    if ($datos === []) {
        http_response_code(400);
        echo json_encode(['error' => 'Los datos no pueden estar vacíos'], JSON_UNESCAPED_UNICODE);
        return;
    }

    switch ($action) {
        case 'crearSinPago':
            $controller->insertarSuscripcionSinPago($datos);
            break;
        case 'crearConPago':
            $controller->insertarSuscripcionConPago($datos);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método POST'], JSON_UNESCAPED_UNICODE);
            break;
    }
}

/** La concesión de la prueba acepta cuerpo vacío o {}; cualquier otra clave se rechaza en el controlador. */
function manejarIniciarPrueba(SuscripcionCtrl $controller, string|false $rawInput): void
{
    $datos = [];
    if ($rawInput !== false && trim($rawInput) !== '') {
        $datos = json_decode($rawInput, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($datos)) {
            http_response_code(400);
            echo json_encode(['error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
            return;
        }
    }
    $controller->iniciarPrueba($datos);
}

/** La cancelación acepta cuerpo vacío o {}; el controlador rechaza cualquier clave no permitida. */
function manejarCancelar(SuscripcionCtrl $controller, string|false $rawInput, ?string $actionParam): void
{
    $datos = [];
    if ($rawInput !== false && trim($rawInput) !== '') {
        $datos = json_decode($rawInput, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($datos)) {
            http_response_code(400);
            echo json_encode(['error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
            return;
        }
    }
    $controller->cancelarPlan($datos, $_GET['id'] ?? null, $actionParam);
}
