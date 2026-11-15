<?php

declare(strict_types=1);

/**
 * Valida el método HTTP y el cuerpo JSON de la petición antes de enrutarla.
 */
final class LectorSolicitud
{
    private const METODOS_PERMITIDOS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    private const TAMANO_MAXIMO_CUERPO = 1048576;
    private const PROFUNDIDAD_MAXIMA_JSON = 64;
    private const PATRON_CONTENT_TYPE_JSON = '#^application/json(\s*;.*)?$#i';
    private const MENSAJE_METODO = 'Método no permitido';
    private const MENSAJE_SOLICITUD = 'Solicitud inválida';

    private static ?array $cuerpoJson = null;

    public static function validarMetodoYCuerpo(): void
    {
        $metodo = $_SERVER['REQUEST_METHOD'] ?? '';
        if (!in_array($metodo, self::METODOS_PERMITIDOS, true)) {
            header('Allow: ' . implode(', ', self::METODOS_PERMITIDOS));
            ManejadorErrores::responderError(405, self::MENSAJE_METODO);
        }

        $longitudDeclarada = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($longitudDeclarada > self::TAMANO_MAXIMO_CUERPO) {
            ManejadorErrores::responderError(400, self::MENSAJE_SOLICITUD);
        }

        $cuerpo = file_get_contents('php://input', false, null, 0, self::TAMANO_MAXIMO_CUERPO + 1);
        if ($cuerpo === false || strlen($cuerpo) > self::TAMANO_MAXIMO_CUERPO) {
            ManejadorErrores::responderError(400, self::MENSAJE_SOLICITUD);
        }

        if ($cuerpo === '') {
            return;
        }

        $tipoContenido = $_SERVER['CONTENT_TYPE'] ?? '';
        if (preg_match(self::PATRON_CONTENT_TYPE_JSON, $tipoContenido) !== 1) {
            ManejadorErrores::responderError(400, self::MENSAJE_SOLICITUD);
        }

        try {
            $decodificado = json_decode($cuerpo, true, self::PROFUNDIDAD_MAXIMA_JSON, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            ManejadorErrores::responderError(400, self::MENSAJE_SOLICITUD);
        }

        if (!is_array($decodificado)) {
            ManejadorErrores::responderError(400, self::MENSAJE_SOLICITUD);
        }

        self::$cuerpoJson = $decodificado;
    }

    public static function obtenerCuerpoJson(): ?array
    {
        return self::$cuerpoJson;
    }

    public static function obtenerCabecera(string $nombre): ?string
    {
        if (strcasecmp($nombre, 'Content-Type') === 0) {
            return $_SERVER['CONTENT_TYPE'] ?? null;
        }

        $clave = 'HTTP_' . strtoupper(str_replace('-', '_', $nombre));
        if (isset($_SERVER[$clave])) {
            return (string) $_SERVER[$clave];
        }

        $claveRedirigida = 'REDIRECT_' . $clave;
        if (isset($_SERVER[$claveRedirigida])) {
            return (string) $_SERVER[$claveRedirigida];
        }

        return null;
    }
}
