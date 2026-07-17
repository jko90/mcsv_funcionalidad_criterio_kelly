<?php

require_once(__DIR__ . '/BaseCtrl.php');
require_once(__DIR__ . '/../modelos/CriptoMdl.php');

class CriptoCtrl extends BaseCtrl
{
    private $baseUrl = "https://api.binance.com/api/v3";
    private $criptoMdl;

    public function __construct()
    {
        $this->criptoMdl = new CriptoMdl();
    }

    public function getCryptos()
    {
        $data = $this->criptoMdl->obtenerTicker24h();
        $cryptos = [];

        foreach ($data as $crypto) {
            if (
                strpos($crypto['symbol'], 'USDT') !== false ||
                strpos($crypto['symbol'], 'BUSD') !== false
            ) {
                $cryptos[] = [
                    'symbol' => $crypto['symbol'],
                    'name' => $crypto['symbol'],
                    'price' => $crypto['lastPrice'],
                    'type' => 'crypto'
                ];
            }
        }

        return array_slice($cryptos, 0, 100000);
    }
}
