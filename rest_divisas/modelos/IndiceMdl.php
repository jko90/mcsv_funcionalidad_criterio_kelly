<?php

require_once(__DIR__ . '/../configuracion/ClienteHttp.php');
require_once(__DIR__ . '/../configuracion/global.php');

class IndiceMdl
{
    public function obtenerIndices(): array
    {
        $url = FMP_BASE_URL . "/quotes/index?apikey=" . urlencode(FMP_API_KEY);
        return ClienteHttp::obtenerJson($url);
    }
}
