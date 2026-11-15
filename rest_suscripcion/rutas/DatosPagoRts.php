<?php

declare(strict_types=1);

require_once __DIR__ . '/../controladores/DatosPagoCtrl.php';

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

const ACCIONES_POST_DATOS_PAGO = [
    'guardarRed' => 'guardarRed',
    'cambiarEstadoRed' => 'cambiarEstadoRed',
    'eliminarRed' => 'eliminarRed',
    'guardarPaypal' => 'guardarPaypal',
    'guardarBanco' => 'guardarBanco',
    'cambiarEstadoMetodo' => 'cambiarEstadoMetodo',
    'subirQr' => 'subirQr',
    'quitarQr' => 'quitarQr',
];

$datosPagoCtrl = new DatosPagoCtrl();
$accionDatosPago = Enrutador::segmentos()[1] ?? null;

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        manejarGetDatosPago($datosPagoCtrl, $accionDatosPago);
        break;
    case 'POST':
        manejarPostDatosPago($datosPagoCtrl, $accionDatosPago);
        break;
    default:
        http_response_code(405);
        echo json_encode([
            'error' => 'Método no permitido',
            'metodos_permitidos' => ['GET', 'POST'],
        ], JSON_UNESCAPED_UNICODE);
        break;
}

function manejarGetDatosPago(DatosPagoCtrl $controlador, ?string $accion): void
{
    switch ($accion) {
        case 'disponibles':
            $controlador->obtenerDisponibles();
            break;
        case 'administracion':
            $controlador->obtenerAdministracion();
            break;
        case 'qr':
            $controlador->servirQr($_GET['clave'] ?? null);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida para método GET'], JSON_UNESCAPED_UNICODE);
            break;
    }
}

function manejarPostDatosPago(DatosPagoCtrl $controlador, ?string $accion): void
{
    if ($accion === null || !array_key_exists($accion, ACCIONES_POST_DATOS_PAGO)) {
        http_response_code(400);
        echo json_encode(['error' => 'Acción no válida para método POST'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $cuerpoCrudo = file_get_contents('php://input');
    if ($cuerpoCrudo === false || trim($cuerpoCrudo) === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Datos requeridos'], JSON_UNESCAPED_UNICODE);
        return;
    }

    $datos = json_decode($cuerpoCrudo, true);
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

    $metodoControlador = ACCIONES_POST_DATOS_PAGO[$accion];
    $controlador->$metodoControlador($datos);
}
