<?php

declare(strict_types=1);

/**
 * Resuelve el recurso y la acción por segmento exacto, sin depender del
 * prefijo de instalación de la aplicación.
 */
final class Enrutador
{
    private const PATRON_SEGMENTO = '/^[A-Za-z0-9_-]+$/';
    private const MAXIMO_SEGMENTOS = 3;

    private static ?array $segmentosCalculados = null;
    private static bool $calculado = false;

    public static function segmentos(): ?array
    {
        if (self::$calculado) {
            return self::$segmentosCalculados;
        }
        self::$calculado = true;

        $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/');
        $ruta = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        if ($base !== '' && ($ruta === $base || str_starts_with($ruta, $base . '/'))) {
            $ruta = substr($ruta, strlen($base));
        }

        $segmentos = array_values(array_filter(
            explode('/', $ruta),
            static fn(string $segmento): bool => $segmento !== ''
        ));

        if (count($segmentos) > self::MAXIMO_SEGMENTOS) {
            self::$segmentosCalculados = null;
            return null;
        }

        foreach ($segmentos as $segmento) {
            if (preg_match(self::PATRON_SEGMENTO, $segmento) !== 1) {
                self::$segmentosCalculados = null;
                return null;
            }
        }

        self::$segmentosCalculados = $segmentos;

        return self::$segmentosCalculados;
    }

    public static function resolver(array $rutas): array
    {
        $segmentos = self::segmentos();

        if ($segmentos === null) {
            ManejadorErrores::responderError(404, 'Recurso no encontrado');
        }

        if ($segmentos === []) {
            return ['recurso' => '', 'accion' => '', 'archivo' => ''];
        }

        $recurso = $segmentos[0];
        if (!array_key_exists($recurso, $rutas)) {
            ManejadorErrores::responderError(404, 'Recurso no encontrado');
        }

        return [
            'recurso' => $recurso,
            'accion' => $segmentos[1] ?? '',
            'archivo' => $rutas[$recurso],
        ];
    }
}
