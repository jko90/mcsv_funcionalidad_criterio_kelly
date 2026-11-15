<?php

declare(strict_types=1);

require_once __DIR__ . '/../controladores/PagosCtrl.php';

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$pagosCtrl = new PagosCtrl();
$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;
$actionParam = null;

for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'pagos' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        $actionParam = $uriParts[$i + 2] ?? null;
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGetPagos($pagosCtrl, $action, $actionParam);
        break;
    case 'POST':
        manejarPostPagos($pagosCtrl, $action);
        break;
    default:
        http_response_code(405);
        echo json_encode([
            'error' => 'Método no permitido',
            'metodos_permitidos' => ['GET', 'POST'],
        ], JSON_UNESCAPED_UNICODE);
        break;
}

function manejarGetPagos(PagosCtrl $controller, ?string $action, ?string $actionParam): void
{
    switch ($action) {
        case 'pendientes':
            $controller->listarPagosPendientes($_GET['limite'] ?? null, $_GET['desde'] ?? null);
            break;
        case 'comprobante':
            $controller->obtenerComprobante($_GET['pag_idPago'] ?? null);
            break;
        case 'miUltimoPago':
            $controller->obtenerMiUltimoPago($_GET['id'] ?? null, $actionParam);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método GET'], JSON_UNESCAPED_UNICODE);
            break;
    }
}

function manejarPostPagos(PagosCtrl $controller, ?string $action): void
{
    if ($action !== 'confirmar' && $action !== 'rechazar') {
        http_response_code(400);
        echo json_encode(['error' => 'Acción no válida para método POST'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $rawInput = file_get_contents('php://input');
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

    if ($action === 'confirmar') {
        $controller->confirmarPago($datos);
        return;
    }
    $controller->rechazarPago($datos);
}
