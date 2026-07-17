<?php

require_once(__DIR__ . '/ProveedorNoDisponibleException.php');

class ClienteHttp
{
    public static function obtenerJson(string $url, int $timeout = 30): array
    {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TIMEOUT => $timeout,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError !== '') {
            throw new ProveedorNoDisponibleException("Error de conexión con proveedor externo");
        }

        if ($httpCode !== 200) {
            $host = parse_url($url, PHP_URL_HOST);
            throw new ProveedorNoDisponibleException("HTTP $httpCode desde proveedor $host");
        }

        $data = json_decode($response, true);
        if (!is_array($data)) {
            throw new ProveedorNoDisponibleException("JSON inválido o no es arreglo");
        }

        return $data;
    }
}
