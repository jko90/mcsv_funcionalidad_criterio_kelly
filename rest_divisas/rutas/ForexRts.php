<?php

require_once(__DIR__ . '/../controladores/ForexCtrl.php');

$forexController = new ForexCtrl();
$forexController->despachar('forex', 'ForexRTS', ['disponible' => 'getAllMajorForex']);
