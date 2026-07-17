<?php

require_once(__DIR__ . '/BaseCtrl.php');

class IndiceCtrl extends BaseCtrl
{
    private $base_url = "https://financialmodelingprep.com/api/v3";
    private $api_key;  // pon tu clave aquí
// Posible: https://financialmodelingprep.com/stable/index-list?apikey=mlS7wcZXGdqMNU9DZ8VSoxOU5eX8hePW
    public function __construct()
    {
        parent::__construct();
        $this->api_key = 'mlS7wcZXGdqMNU9DZ8VSoxOU5eX8hePW';
    }

    public function getAllIndices()
    {
        $url = $this->base_url . "/quotes/index?apikey=" . urlencode($this->api_key);

        $response = @file_get_contents($url);
        if ($response === false) {
            // manejo de error
            return [];
        }

        $data = json_decode($response, true);
        if (!is_array($data)) {
            return [];
        }

        $indices = [];
        foreach ($data as $item) {
            // Fíjate cómo vienen los datos: “symbol”, “name”, “price”
            if (!isset($item['symbol']) || !isset($item['price'])) {
                continue;
            }
            $symbol = $item['symbol'];
            $name = isset($item['name']) ? $item['name'] : $symbol;
            $price = $item['price'];

            // Formatear precio como string con decimales
            $price_str = number_format((float)$price, 6, '.', '');

            $indices[] = [
                'symbol' => $symbol,
                'name'   => $name,
                'price'  => (string)$price_str,
                'type'   => 'indice'
            ];
        }

        return $indices;
    }
}
