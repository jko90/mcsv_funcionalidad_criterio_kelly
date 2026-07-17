<?php

require_once(__DIR__ . '/BaseCtrl.php');
require_once(__DIR__ . '/../modelos/ForexMdl.php');

class ForexCtrl extends BaseCtrl
{
    private $baseUrl = "https://api.frankfurter.app";
    private $forexMdl;

    public function __construct()
    {
        $this->forexMdl = new ForexMdl();
    }

    public function getAllMajorForex()
    {
        $currencies = $this->forexMdl->obtenerDivisas();
        if (!is_array($currencies) || empty($currencies)) {
            return [];
        }

        $currency_codes = array_keys($currencies);
        $forex_data = [];

        $chunk_size = 20;

        foreach ($currency_codes as $base) {
            $targets = array_values(array_filter($currency_codes, function ($c) use ($base) {
                return $c !== $base;
            }));

            if (empty($targets)) {
                continue;
            }

            $chunks = array_chunk($targets, $chunk_size);

            foreach ($chunks as $chunk) {
                $targets_string = implode(',', $chunk);

                try {
                    $data = $this->forexMdl->obtenerTasas($base, $targets_string);
                } catch (ProveedorNoDisponibleException $e) {
                    error_log("Forex chunk fallido ($base -> $targets_string): " . $e->getMessage());
                    usleep(50000);
                    continue;
                }

                if (!isset($data['rates']) || !is_array($data['rates'])) {
                    usleep(50000);
                    continue;
                }

                foreach ($data['rates'] as $currency => $rate) {
                    if ($currency === $base || !is_numeric($rate)) {
                        continue;
                    }

                    $pair_symbol = $base . $currency;
                    $forex_data[] = [
                        'symbol' => $pair_symbol,
                        'name' => $base . '/' . $currency,
                        'price' => (string) number_format($rate, 6, '.', ''),
                        'type' => 'forex'
                    ];
                }

                usleep(50000);
            }

            usleep(150000);
        }

        return $forex_data;
    }

    public function getAllCurrencies()
    {
        return $this->forexMdl->obtenerDivisas();
    }
}
