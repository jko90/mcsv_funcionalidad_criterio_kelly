<?php

require_once(__DIR__ . '/../configuracion/ClienteHttp.php');
require_once(__DIR__ . '/../configuracion/global.php');

class ForexMdl
{
    public function obtenerDivisas(): array
    {
        $url = FRANKFURTER_BASE_URL . "/currencies";
        return ClienteHttp::obtenerJson($url);
    }

    public function obtenerTasas(string $base, string $destinosCsv): array
    {
        $url = FRANKFURTER_BASE_URL . "/latest?from=" . urlencode($base) . "&to=" . urlencode($destinosCsv);
        return ClienteHttp::obtenerJson($url);
    }
}
