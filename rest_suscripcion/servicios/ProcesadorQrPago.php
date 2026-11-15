<?php

declare(strict_types=1);

/**
 * Valida y prepara la imagen del código QR de una red (HLT-29, RN-10).
 * No emite respuestas: devuelve el resultado o lanza InvalidArgumentException con un mensaje apto para el usuario.
 */
final class ProcesadorQrPago
{
    public const TAMANO_MAXIMO_BYTES = 262144;
    public const LADO_MINIMO_PX = 100;
    public const LADO_MAXIMO_PX = 2000;
    public const TIPOS_PERMITIDOS = [
        'image/png' => 'png',
        'image/jpeg' => 'jpeg',
        'image/webp' => 'webp',
    ];
    private const MENSAJE_INVALIDO = 'La imagen del código QR no es válida';
    private const MENSAJE_DIMENSIONES = 'La imagen del código QR debe medir entre 100 y 2000 píxeles por lado';
    private const CALIDAD_JPEG = 90;
    private const LONGITUD_CABECERA_RIFF = 8;
    private const LONGITUD_TIPO_Y_CRC_PNG = 8;

    /**
     * @return array{tipoMime:string, contenido:string, tamano:int, hash:string}
     */
    public static function procesar(string $imagenDataUri): array
    {
        if (preg_match('/^data:([^;]+);base64,(.+)$/s', $imagenDataUri, $partes) !== 1) {
            throw new InvalidArgumentException(self::MENSAJE_INVALIDO);
        }
        $contenido = base64_decode($partes[2], true);
        if ($contenido === false || $contenido === '' || strlen($contenido) > self::TAMANO_MAXIMO_BYTES) {
            throw new InvalidArgumentException(self::MENSAJE_INVALIDO);
        }
        $tipoMime = self::detectarTipoMime($contenido);
        if ($tipoMime === null || strtolower($partes[1]) !== $tipoMime) {
            throw new InvalidArgumentException(self::MENSAJE_INVALIDO);
        }
        $dimensiones = @getimagesizefromstring($contenido);
        if ($dimensiones === false || $dimensiones['mime'] !== $tipoMime) {
            throw new InvalidArgumentException(self::MENSAJE_INVALIDO);
        }
        foreach ([$dimensiones[0], $dimensiones[1]] as $lado) {
            if ($lado < self::LADO_MINIMO_PX || $lado > self::LADO_MAXIMO_PX) {
                throw new InvalidArgumentException(self::MENSAJE_DIMENSIONES);
            }
        }
        $contenidoLimpio = self::recodificarConGd($contenido, $tipoMime)
            ?? self::recortarCargaFinal($contenido, $tipoMime);
        return [
            'tipoMime' => $tipoMime,
            'contenido' => $contenidoLimpio,
            'tamano' => strlen($contenidoLimpio),
            'hash' => hash('sha256', $contenidoLimpio),
        ];
    }

    public static function extensionDeTipo(string $tipoMime): string
    {
        return self::TIPOS_PERMITIDOS[$tipoMime] ?? 'bin';
    }

    private static function detectarTipoMime(string $contenido): ?string
    {
        if (!function_exists('finfo_open')) {
            return null;
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo === false) {
            return null;
        }
        $tipoMime = finfo_buffer($finfo, $contenido);
        finfo_close($finfo);
        return is_string($tipoMime) && array_key_exists($tipoMime, self::TIPOS_PERMITIDOS) ? $tipoMime : null;
    }

    /** Re-codifica con GD (elimina metadatos y cargas ocultas). Devuelve null si GD no está disponible. */
    private static function recodificarConGd(string $contenido, string $tipoMime): ?string
    {
        if (!extension_loaded('gd')) {
            return null;
        }
        $funcionSalida = match ($tipoMime) {
            'image/png' => 'imagepng',
            'image/jpeg' => 'imagejpeg',
            default => 'imagewebp',
        };
        if (!function_exists($funcionSalida) || !function_exists('imagecreatefromstring')) {
            return null;
        }
        $imagen = @imagecreatefromstring($contenido);
        if ($imagen === false) {
            throw new InvalidArgumentException(self::MENSAJE_INVALIDO);
        }
        if ($tipoMime === 'image/png') {
            imagealphablending($imagen, false);
            imagesavealpha($imagen, true);
        }
        ob_start();
        $esCodificada = $tipoMime === 'image/jpeg'
            ? imagejpeg($imagen, null, self::CALIDAD_JPEG)
            : $funcionSalida($imagen);
        $recodificada = (string) ob_get_clean();
        imagedestroy($imagen);
        if (!$esCodificada || $recodificada === '') {
            throw new InvalidArgumentException(self::MENSAJE_INVALIDO);
        }
        return $recodificada;
    }

    /** Sin GD: descarta los bytes posteriores al final lógico del archivo (cargas añadidas al final). */
    private static function recortarCargaFinal(string $contenido, string $tipoMime): string
    {
        if ($tipoMime === 'image/png') {
            $posicionFin = strrpos($contenido, 'IEND');
            return $posicionFin === false
                ? $contenido
                : substr($contenido, 0, $posicionFin + self::LONGITUD_TIPO_Y_CRC_PNG);
        }
        if ($tipoMime === 'image/jpeg') {
            $posicionFin = strrpos($contenido, "\xFF\xD9");
            return $posicionFin === false ? $contenido : substr($contenido, 0, $posicionFin + 2);
        }
        $tamanoDeclarado = unpack('V', substr($contenido, 4, 4))[1] ?? 0;
        $longitudTotal = $tamanoDeclarado + self::LONGITUD_CABECERA_RIFF;
        return $longitudTotal > self::LONGITUD_CABECERA_RIFF && $longitudTotal <= strlen($contenido)
            ? substr($contenido, 0, $longitudTotal)
            : $contenido;
    }
}
