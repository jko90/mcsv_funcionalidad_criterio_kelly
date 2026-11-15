<?php

declare(strict_types=1);

require_once __DIR__ . '/../controladores/ValidacionCtrl.php';
require_once __DIR__ . '/../controladores/ClaveCtrl.php';

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$validacionController = new ValidacionCtrl();
$claveController = new ClaveCtrl();

switch ($metodo) {
    case 'GET':
        manejarGetValidacion($validacionController, $accion);
        break;
    case 'POST':
        manejarPostValidacion($validacionController, $claveController, $accion);
        break;
    case 'PUT':
        manejarPutValidacion($validacionController, $claveController, $accion);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
        break;
}

function manejarGetValidacion(ValidacionCtrl $controlador, string $accion): void
{
    if ($accion === 'usRol') {
        $controlador->obtenerRolesUsuario(isset($_GET['id']) ? (string) $_GET['id'] : null);
        return;
    }
    http_response_code(400);
    echo json_encode(['error' => 'Acción no válida para método GET'], JSON_UNESCAPED_UNICODE);
}

function manejarPostValidacion(ValidacionCtrl $controlador, ClaveCtrl $claveControlador, string $accion): void
{
    $accionesSinCuerpo = ['renovar', 'cerrarSesion', 'cerrarTodas'];
    $datos = LectorSolicitud::obtenerCuerpoJson() ?? [];
    if ($datos === [] && !in_array($accion, $accionesSinCuerpo, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos requeridos'], JSON_UNESCAPED_UNICODE);
        return;
    }

    switch ($accion) {
        case 'autenticar':
            $controlador->autenticarUsuario($datos);
            break;
        case 'renovar':
            $controlador->renovarSesion($datos);
            break;
        case 'cerrarSesion':
            $controlador->cerrarSesion();
            break;
        case 'cerrarTodas':
            $controlador->cerrarTodasLasSesiones();
            break;
        case 'solicitarRecuperacion':
            $claveControlador->solicitarRecuperacion($datos);
            break;
        case 'restablecerClave':
            $claveControlador->restablecerClave($datos);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Recurso no encontrado'], JSON_UNESCAPED_UNICODE);
            break;
    }
}

function manejarPutValidacion(ValidacionCtrl $controlador, ClaveCtrl $claveControlador, string $accion): void
{
    $datos = LectorSolicitud::obtenerCuerpoJson();
    if ($datos === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos requeridos'], JSON_UNESCAPED_UNICODE);
        return;
    }
    if ($accion === 'actualizarClave') {
        $claveControlador->actualizarClave($datos);
        return;
    }
    http_response_code(404);
    echo json_encode(['error' => 'Recurso no encontrado'], JSON_UNESCAPED_UNICODE);
}
