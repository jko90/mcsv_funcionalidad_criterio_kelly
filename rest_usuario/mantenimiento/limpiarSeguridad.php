<?php

declare(strict_types=1);

// Referencia de cron para HLT-11: */15 * * * * php /ruta/privada/rest_usuario/mantenimiento/limpiarSeguridad.php
if (PHP_SAPI !== 'cli') {
    exit(1);
}

$rutaAplicacion = dirname(__DIR__);
try {
    require $rutaAplicacion . '/vendor/autoload.php';
    require $rutaAplicacion . '/configuracion/Configuracion.php';
    require $rutaAplicacion . '/configuracion/enlace.php';
    require $rutaAplicacion . '/configuracion/RegistroAuditoria.php';
    require $rutaAplicacion . '/configuracion/ClienteIp.php';
    require $rutaAplicacion . '/modelos/AlertasSeguridadMdl.php';
    require $rutaAplicacion . '/modelos/VerificacionMdl.php';
    require $rutaAplicacion . '/correo/cargarCorreo.php';
    require $rutaAplicacion . '/servicios/AlertasSeguridad.php';
    Configuracion::cargar($rutaAplicacion, 'rest_usuario');
    $enlace = new Enlace();
    $ahora = time();
    $sesiones = 0;
    do {
        $sqlLimpiarSesiones = 'DELETE FROM sgen_sesion WHERE ses_familia IN
            (SELECT familia FROM (SELECT ses_familia AS familia FROM sgen_sesion
             GROUP BY ses_familia HAVING MAX(ses_refreshExpira) <= ? OR MAX(ses_familiaExpira) <= ?
             LIMIT 5000) familias)';
        $afectadas = $enlace->ejecutarActualizacion(
            $sqlLimpiarSesiones,
            'ss',
            gmdate('Y-m-d H:i:s', $ahora),
            gmdate('Y-m-d H:i:s', $ahora)
        );
        $sesiones += $afectadas;
    } while ($afectadas > 0);

    $intentos = limpiarPorFecha($enlace, 'sgen_intentoacceso', 'ina_fecha', $ahora - 900);
    $contadores = limpiarPorFecha($enlace, 'sgen_limitepeticion', 'lip_ventana', $ahora - 120);
    $auditoria = limpiarPorFecha($enlace, 'sgen_auditoria', 'aud_fecha', $ahora - 180 * 86400);
    $modeloAlertas = new AlertasSeguridadMdl($enlace);
    $recuperaciones = $modeloAlertas->eliminarRecuperacionesAntiguas();
    $modeloVerificacion = new VerificacionMdl($enlace);
    $pendientes = $modeloVerificacion->depurarCuentasSinVerificar();
    $verificaciones = $modeloVerificacion->depurarVerificacionesAntiguas();
    $resultadoAlerta = (new AlertasSeguridad($modeloAlertas, new EnviadorCorreo()))->evaluarYNotificar();
    fwrite(STDOUT, "sesiones={$sesiones} intentos={$intentos} contadores={$contadores} "
        . "auditoria={$auditoria} recuperaciones={$recuperaciones} {$resultadoAlerta} "
        . "pendientes={$pendientes} verificaciones={$verificaciones}\n");
    exit(0);
} catch (Throwable $error) {
    error_log('[limpiarSeguridad] ' . $error->getMessage());
    fwrite(STDERR, "Error en el mantenimiento\n");
    exit(1);
}

function limpiarPorFecha(Enlace $enlace, string $tabla, string $columna, int $marca): int
{
    $tablasPermitidas = [
        'sgen_intentoacceso' => 'ina_fecha',
        'sgen_limitepeticion' => 'lip_ventana',
        'sgen_auditoria' => 'aud_fecha',
    ];
    if (!isset($tablasPermitidas[$tabla]) || $tablasPermitidas[$tabla] !== $columna) {
        throw new InvalidArgumentException('Tabla de mantenimiento inválida');
    }
    $total = 0;
    do {
        $sqlEliminar = "DELETE FROM {$tabla} WHERE {$columna} <= ? LIMIT 5000";
        $afectadas = $enlace->ejecutarActualizacion($sqlEliminar, 's', gmdate('Y-m-d H:i:s', $marca));
        $total += $afectadas;
    } while ($afectadas > 0);
    return $total;
}
