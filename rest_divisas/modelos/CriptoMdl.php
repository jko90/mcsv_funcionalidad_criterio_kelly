<?php

require_once(__DIR__ . '/../configuracion/ClienteHttp.php');
require_once(__DIR__ . '/../configuracion/global.php');

class CriptoMdl
{
    public function obtenerTicker24h(): array
    {
        $url = BINANCE_BASE_URL . "/ticker/24hr";
        return ClienteHttp::obtenerJson($url);
    }
}
