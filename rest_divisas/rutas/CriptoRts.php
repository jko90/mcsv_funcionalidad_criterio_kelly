<?php

require_once(__DIR__ . '/../controladores/CriptoCtrl.php');

$criptoController = new CriptoCtrl();
$criptoController->despachar('cripto', 'CriptoRTS', ['disponible' => 'getCryptos']);
