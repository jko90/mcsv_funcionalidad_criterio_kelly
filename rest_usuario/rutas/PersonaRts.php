<?php

declare(strict_types=1);

require_once __DIR__ . '/../controladores/PersonaCtrl.php';
require_once __DIR__ . '/../controladores/VerificacionCtrl.php';

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$personaControlador = new PersonaCtrl();
$verificacionControlador = new VerificacionCtrl();

switch ($metodo) {
    case 'POST':
        if (!in_array($accion, ['agregar', 'activar', 'reenviarCodigo'], true)) {
            responderRecursoPersonaNoEncontrado();
        }
        $datos = LectorSolicitud::obtenerCuerpoJson();
        if ($datos === null || $datos === []) {
            responderSolicitudPersonaInvalida();
        }
        match ($accion) {
            'agregar' => $personaControlador->agregarPersona($datos),
            'activar' => $verificacionControlador->activarCuenta($datos),
            'reenviarCodigo' => $verificacionControlador->reenviarCodigo($datos),
        };
        break;
    case 'PUT':
        if ($accion !== 'actualizarDeApp') {
            responderRecursoPersonaNoEncontrado();
        }
        $datos = LectorSolicitud::obtenerCuerpoJson();
        if ($datos === null || $datos === []) {
            responderSolicitudPersonaInvalida();
        }
        $personaControlador->actualizarPersonaNombresTelf($datos);
        break;
    case 'GET':
        if ($accion === 'obtener') {
            http_response_code(501);
            echo json_encode(['error' => 'Método no implementado'], JSON_UNESCAPED_UNICODE);
            break;
        }
        responderRecursoPersonaNoEncontrado();
        break;
    case 'DELETE':
        http_response_code(501);
        echo json_encode(['error' => 'Método no implementado'], JSON_UNESCAPED_UNICODE);
        break;
    default:
        header('Allow: GET, POST, PUT, DELETE');
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
        break;
}

function responderRecursoPersonaNoEncontrado(): void
{
    http_response_code(404);
    echo json_encode(['error' => 'Recurso no encontrado'], JSON_UNESCAPED_UNICODE);
    exit;
}

function responderSolicitudPersonaInvalida(): void
{
    http_response_code(400);
    echo json_encode(['error' => 'Solicitud inválida'], JSON_UNESCAPED_UNICODE);
    exit;
}
