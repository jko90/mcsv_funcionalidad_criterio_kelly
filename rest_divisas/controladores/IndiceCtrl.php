<?php

require_once(__DIR__ . '/BaseCtrl.php');

class IndiceCtrl extends BaseCtrl
{
    private $base_url = "https://financialmodelingprep.com/api/v3";
    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = Configuracion::obtener('FMP_API_KEY');
    }

    public function getAllIndices()
    {
        $url = $this->base_url . "/quotes/index?apikey=" . urlencode($this->apiKey);

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
