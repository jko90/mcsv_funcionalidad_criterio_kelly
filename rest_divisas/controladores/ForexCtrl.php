<?php

require_once(__DIR__ . '/BaseCtrl.php');

class ForexCtrl extends BaseCtrl
{
    private $base_url = "https://api.frankfurter.app";

    public function getAllMajorForex()
    {
        $currencies = $this->getAllCurrencies();
        if (!is_array($currencies) || empty($currencies)) {
            return [];
        }

        $currency_codes = array_keys($currencies);
        $forex_data = [];

        $chunk_size = 20;

        foreach ($currency_codes as $base) {
            // Targets: todas las demás divisas (excluir la misma)
            $targets = array_values(array_filter($currency_codes, function ($c) use ($base) {
                return $c !== $base;
            }));

            if (empty($targets)) {
                continue;
            }

            // Dividir targets en chunks
            $chunks = array_chunk($targets, $chunk_size);

            foreach ($chunks as $chunk) {
                $targets_string = implode(',', $chunk);
                $url = $this->base_url . "/latest?from=" . urlencode($base) . "&to=" . urlencode($targets_string);

                $response = @file_get_contents($url);
                if ($response === false) {
                    // Si falla este request, continuar con el siguiente chunk
                    usleep(50000);
                    continue;
                }

                $data = json_decode($response, true);
                if (!isset($data['rates']) || !is_array($data['rates'])) {
                    usleep(50000);
                    continue;
                }

                foreach ($data['rates'] as $currency => $rate) {
                    // Evitar pares no válidos o nulos
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

                // Pequeña pausa entre requests del mismo base
                usleep(50000); // 50ms
            }

            // Pausa más larga entre cambios de base para no saturar la API
            usleep(150000); // 150ms
        }

        return $forex_data;
    }

    /**
     * Obtener lista completa de divisas desde la API (codigo => nombre).
     */
    public function getAllCurrencies()
    {
        $url = $this->base_url . "/currencies";
        $response = @file_get_contents($url);
        if ($response === false) {
            return [];
        }
        $data = json_decode($response, true);
        return is_array($data) ? $data : [];
    }
}
