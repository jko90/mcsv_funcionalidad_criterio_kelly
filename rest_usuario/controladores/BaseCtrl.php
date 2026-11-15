<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/ContextoSesion.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../configuracion/enlace.php';

abstract class BaseCtrl
{
    protected const TIEMPO_MINIMO_RESPUESTA_MS = 2000;
    protected const VARIACION_MAXIMA_MS = 250;

    protected function validarDatos(array $data, array $requeridos = []): array
    {
        $errores = [];

        foreach ($requeridos as $campo) {
            if (!array_key_exists($campo, $data) || !is_string($data[$campo]) || trim($data[$campo]) === '') {
                $errores[] = "El campo '$campo' es requerido";
            }
        }

        return $errores;
    }

    protected function limpiarDatos(array $data): array
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

    protected function exigirCamposPermitidos(array $datos, array $camposPermitidos): void
    {
        foreach (array_keys($datos) as $campo) {
            if (!in_array($campo, $camposPermitidos, true)) {
                $this->respuestaErrorSimple('Solicitud inválida', 400);
            }
        }
    }

    protected function exigirIdDeSesion(array $datos): void
    {
        if (!array_key_exists('id', $datos)) {
            return;
        }

        $idRecibido = filter_var($datos['id'], FILTER_VALIDATE_INT);
        if ($idRecibido === false || (int) $idRecibido !== ContextoSesion::idUsuario()) {
            $enlace = new Enlace();
            $auditoria = new RegistroAuditoria($enlace, defined('SERVICIO_ACTUAL') ? SERVICIO_ACTUAL : 'rest_usuario');
            $auditoria->registrar('ACCESO_DENEGADO', ContextoSesion::idUsuario(), ContextoSesion::familia(), 'usuario distinto');
            $this->respuestaErrorSimple('Acceso denegado', 403);
        }
    }
    protected function esperarTiempoMinimo(int $inicio): void
    {
        $milisegundosObjetivo = self::TIEMPO_MINIMO_RESPUESTA_MS + random_int(0, self::VARIACION_MAXIMA_MS);
        $transcurridos = intdiv(hrtime(true) - $inicio, 1000000);
        if ($transcurridos < $milisegundosObjetivo) {
            usleep(($milisegundosObjetivo - $transcurridos) * 1000);
        }
    }

    protected function obtenerAgente(): ?string
    {
        $agente = preg_replace('/[\x00-\x1F\x7F]/', '', (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        return mb_substr((string) $agente, 0, 255);
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
