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
