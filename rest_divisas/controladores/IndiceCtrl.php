<?php

require_once(__DIR__ . '/BaseCtrl.php');
require_once(__DIR__ . '/../modelos/IndiceMdl.php');

class IndiceCtrl extends BaseCtrl
{
    private $indiceMdl;

    public function __construct()
    {
        $this->indiceMdl = new IndiceMdl();
    }

    public function getAllIndices()
    {
        $data = $this->indiceMdl->obtenerIndices();

        $indices = [];
        foreach ($data as $item) {
            if (!isset($item['symbol']) || !isset($item['price'])) {
                continue;
            }
            $symbol = $item['symbol'];
            $name = isset($item['name']) ? $item['name'] : $symbol;
            $price = $item['price'];

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
