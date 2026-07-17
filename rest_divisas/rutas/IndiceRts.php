<?php

require_once(__DIR__ . '/../controladores/IndiceCtrl.php');

$indiceController = new IndiceCtrl();
$indiceController->despachar('indice', 'IndiceRTS', ['disponible' => 'getAllIndices']);
