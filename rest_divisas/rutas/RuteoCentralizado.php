<?php

function ejecutarRuteo(string $claseControlador, string $dominio, string $nombreServicio, array $mapaAcciones): void
{
    $rutaControlador = __DIR__ . '/../controladores/' . $claseControlador . '.php';
    require_once($rutaControlador);

    $nombreClase = $claseControlador;
    $controlador = new $nombreClase();
    $controlador->despachar($dominio, $nombreServicio, $mapaAcciones);
}
