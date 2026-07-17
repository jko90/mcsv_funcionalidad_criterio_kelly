<?php

require_once(__DIR__ . '/BaseCtrl.php');

class CriptoCtrl extends BaseCtrl
{
    //nueva URI: https://financialmodelingprep.com/stable/cryptocurrency-list?apikey=mlS7wcZXGdqMNU9DZ8VSoxOU5eX8hePW
    private $base_url = "https://api.binance.com/api/v3";

    public function getCryptos()
    {
        $url = $this->base_url . "/ticker/24hr";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false
        ]);

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code === 200 && $response) {
            $data = json_decode($response, true);
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

        return [];
    }
}
