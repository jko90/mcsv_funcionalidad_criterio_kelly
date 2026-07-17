<?php

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
/*
    protected function respuestaJson($estado, $mensaje, $dato = null, $httpCode = 200)
    {
        http_response_code($httpCode);

        $response = [
            'estado' => $estado,
            'mensaje' => $mensaje,
            'fecha' => date('c'),
            'dato' => $dato
        ];

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
        exit;
    }

    protected function respuestaExitosa($dato, $mensaje = 'Operación exitosa')
    {
        $this->respuestaJson('Exito', $mensaje, $dato, 200);
    }

    protected function respuestaError($mensaje, $httpCode = 400)
    {
        $this->respuestaJson('Error', $mensaje, null, $httpCode);
    }

*/
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
}
