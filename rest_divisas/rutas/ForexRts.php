<?php


require_once(__DIR__ . '/../controladores/ForexCtrl.php');


$forexController = new ForexCtrl();

$requestUri = $_SERVER['REQUEST_URI'];
$uriParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$action = null;

// Buscar posición de 'forex' y obtener siguiente parte
for ($i = 0; $i < count($uriParts); $i++) {
    if ($uriParts[$i] === 'forex' && isset($uriParts[$i + 1])) {
        $action = $uriParts[$i + 1];
        break;
    }
}

// Rutear según método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        // Fix: pass the correct controller instance
        manejarGet($forexController, $action);
        break;

    default:
        http_response_code(405);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'Método no permitido',
            'metodos_permitidos' => ['GET', 'POST']
        ], JSON_UNESCAPED_UNICODE);
        break;
}


function manejarGet($controller, $action, $actionParam = null)
{
    header('Content-Type: application/json; charset=utf-8');

    if (!$action) {
        $healthData = [
            'status' => 'ok',
            'timestamp' => date('Y-m-d H:i:s'),
            'version' => '1.0.0',
            'service' => 'PlanesRTS'
        ];

        http_response_code(200);
        echo json_encode($healthData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return;
    }

    switch ($action) {
        case 'disponible':
            try {
                $result = $controller->getAllMajorForex();
                http_response_code(200);
                echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            } catch (Throwable $e) {
                http_response_code(500);
                echo json_encode([
                    'error' => 'Error interno del servidor',
                    'detalle' => $e->getMessage()
                ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            }
            break;

        default:
            http_response_code(404);
            echo json_encode([
                'error' => 'Acción no encontrada',
                'accion' => $action
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            break;
    }
}
