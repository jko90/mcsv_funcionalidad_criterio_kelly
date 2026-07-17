<?php

require_once(__DIR__ . '/../configuracion/ProveedorNoDisponibleException.php');

abstract class BaseCtrl
{
    protected function validarDatos($data, $requeridos = [])
    {
        $errores = [];

        foreach ($requeridos as $campo) {
            if (!isset($data[$campo]) || empty(trim($data[$campo]))) {
                $errores[] = "El campo '$campo' es requerido";
            }
        }

        return $errores;
    }

    protected function limpiarDatos($data)
    {
        $datosLimpios = [];
        foreach ($data as $key => $value) {
            if (is_string($value)) {
                $datosLimpios[$key] = htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
            } else {
                $datosLimpios[$key] = $value;
            }
        }
        return $datosLimpios;
    }

    protected function respuestaExitosaSimple($dato)
    {
        if (is_null($dato)) {
            $dato = ['success' => 'ok'];
        }
        $this->respuestaJsonSimple($dato, 200);
    }

    protected function respuestaJsonSimple($dato = null, $httpCode = 200)
    {
        http_response_code($httpCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($dato, JSON_UNESCAPED_UNICODE);
        exit;
    }

    protected function respuestaErrorSimple($dato, $httpCode = 400)
    {
        $this->respuestaJsonSimple(['error' => $dato], $httpCode);
    }

    public function despachar(string $dominio, string $nombreServicio, array $mapaAcciones): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->respuestaErrorSimple('Método no permitido', 405);
        }

        $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $uriParts = explode('/', trim($requestUri, '/'));
        $accion = null;

        for ($i = 0; $i < count($uriParts); $i++) {
            if ($uriParts[$i] === $dominio && isset($uriParts[$i + 1])) {
                $accion = $uriParts[$i + 1];
                break;
            }
        }

        if ($accion === null) {
            $healthData = [
                'status' => 'ok',
                'timestamp' => date('Y-m-d H:i:s'),
                'version' => '1.0.0',
                'service' => $nombreServicio
            ];
            $this->respuestaJsonSimple($healthData, 200);
        }

        if (!isset($mapaAcciones[$accion])) {
            $this->respuestaErrorSimple('Acción no encontrada', 404);
        }

        $metodo = $mapaAcciones[$accion];

        try {
            $resultado = $this->$metodo();
            $this->respuestaExitosaSimple($resultado);
        } catch (ProveedorNoDisponibleException $e) {
            error_log("Proveedor no disponible ($dominio/$accion): " . $e->getMessage());
            $this->respuestaErrorSimple('El proveedor de datos no está disponible', 502);
        } catch (Throwable $e) {
            error_log("Error interno ($dominio/$accion): " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
