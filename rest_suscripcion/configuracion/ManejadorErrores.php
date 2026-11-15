<?php

declare(strict_types=1);

/**
 * Registra y centraliza el tratamiento de los errores de la petición.
 *
 * Los avisos se registran sin interrumpir la ejecución; las excepciones y los
 * errores fatales responden un 500 genérico y dejan el detalle solo en el log.
 */
final class ManejadorErrores
{
    private const CODIGO_ERROR_INTERNO = 500;
    private const MENSAJE_ERROR_INTERNO = 'Error interno del servidor';

    public static function registrar(): void
    {
        ini_set('display_errors', '0');
        ini_set('log_errors', '1');
        ini_set('error_log', Configuracion::obtener('RUTA_LOGS') . '/php_errores.log');
        ini_set('zend.exception_ignore_args', '1');

        ob_start();

        set_exception_handler([self::class, 'manejarExcepcion']);
        set_error_handler([self::class, 'manejarError']);
        register_shutdown_function([self::class, 'manejarCierre']);
    }

    public static function manejarExcepcion(Throwable $error): void
    {
        error_log(sprintf(
            "[%s] %s en %s:%d\n%s",
            $error::class,
            $error->getMessage(),
            $error->getFile(),
            $error->getLine(),
            $error->getTraceAsString()
        ));

        if (!headers_sent()) {
            self::responderError(self::CODIGO_ERROR_INTERNO, self::MENSAJE_ERROR_INTERNO);
        }

        exit;
    }

    public static function manejarError(int $nivel, string $mensaje, string $archivo, int $linea): bool
    {
        if (!(error_reporting() & $nivel)) {
            return false;
        }

        if (in_array($nivel, [E_USER_ERROR, E_RECOVERABLE_ERROR], true)) {
            throw new ErrorException($mensaje, 0, $nivel, $archivo, $linea);
        }

        error_log(sprintf('[aviso %d] %s en %s:%d', $nivel, $mensaje, $archivo, $linea));

        return true;
    }

    public static function manejarCierre(): void
    {
        $ultimoError = error_get_last();

        if ($ultimoError === null
            || !in_array($ultimoError['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            return;
        }

        error_log(sprintf(
            '[fatal %d] %s en %s:%d',
            $ultimoError['type'],
            $ultimoError['message'],
            $ultimoError['file'],
            $ultimoError['line']
        ));

        if (!headers_sent()) {
            self::responderError(self::CODIGO_ERROR_INTERNO, self::MENSAJE_ERROR_INTERNO);
        }
    }

    public static function responderError(int $codigoHttp, string $mensaje): never
    {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        http_response_code($codigoHttp);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);

        exit;
    }
}
