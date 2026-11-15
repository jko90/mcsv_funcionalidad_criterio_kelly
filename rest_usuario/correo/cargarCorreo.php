<?php

declare(strict_types=1);

// Punto único de carga del módulo de correo (HU-003). Los archivos que envían correo hacen un solo
// require_once de este archivo. Depende de que el arranque (index.php o el script CLI) ya haya cargado
// vendor/autoload.php (PHPMailer) y configuracion/Configuracion.php: no los carga aquí para no
// duplicar Composer cuando RUTA_APLICACION apunta a otra ruta.
require_once __DIR__ . '/PlantillasCorreo.php';
require_once __DIR__ . '/EnviadorCorreo.php';
