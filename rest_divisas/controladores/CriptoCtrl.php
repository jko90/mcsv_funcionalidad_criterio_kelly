<?php

require_once(__DIR__ . '/BaseCtrl.php');
require_once(__DIR__ . '/../modelos/CriptoMdl.php');

class CriptoCtrl extends BaseCtrl
{
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
                str_ends_with($crypto['symbol'], 'USDT') ||
                str_ends_with($crypto['symbol'], 'BUSD')
            ) {
                $cryptos[] = [
                    'symbol' => $crypto['symbol'],
                    'name' => $crypto['symbol'],
                    'price' => (string) number_format((float) $crypto['lastPrice'], 6, '.', ''),
                    'type' => 'crypto'
                ];
            }
        }

        return $cryptos;
    }
}
