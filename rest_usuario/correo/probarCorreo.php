<?php

declare(strict_types=1);

// Prueba el envío real con la configuración del .env.
// Uso: C:\xampp\php\php.exe correo/probarCorreo.php destino@correo.com
if (PHP_SAPI !== 'cli') {
    exit(1);
}

$destinatario = $argv[1] ?? '';
if ($destinatario === '') {
    fwrite(STDERR, "Uso: php correo/probarCorreo.php destino@correo.com\n");
    exit(1);
}

$rutaAplicacion = dirname(__DIR__);
try {
    require $rutaAplicacion . '/vendor/autoload.php';
    require $rutaAplicacion . '/configuracion/Configuracion.php';
    require $rutaAplicacion . '/correo/cargarCorreo.php';
    Configuracion::cargar($rutaAplicacion, 'rest_usuario');

    $modo = Configuracion::obtener('CORREO_MODO');
    (new EnviadorCorreo())->enviar($destinatario, PlantillasCorreo::codigoVerificacion('Prueba', '123456'));
    echo $modo === 'log'
        ? "Modo log: el correo se escribió en logs/correos/correos.log, no se envió.\n"
        : "Correo enviado a {$destinatario} por " . Configuracion::obtener('SMTP_HOST') . ".\n";
} catch (Throwable $error) {
    $previo = $error->getPrevious();
    fwrite(STDERR, 'Error: ' . $error->getMessage() . ($previo !== null ? ' (' . $previo->getMessage() . ')' : '') . "\n");
    exit(1);
}
