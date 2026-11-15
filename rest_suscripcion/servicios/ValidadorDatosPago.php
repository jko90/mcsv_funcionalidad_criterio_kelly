<?php

declare(strict_types=1);

/**
 * Reglas de formato de los datos de pago (HLT-29, RN-02 a RN-05).
 * Funciones puras: devuelven el valor normalizado o null cuando no es válido; no emiten respuestas.
 */
final class ValidadorDatosPago
{
    public const PATRON_CLAVE_RED = '/^[A-Z0-9_]{2,16}$/';
    private const PATRON_DIRECCION_TRON = '/^T[1-9A-HJ-NP-Za-km-z]{33}$/';
    private const PATRON_DIRECCION_EVM = '/^0x[0-9a-fA-F]{40}$/';
    private const PATRON_DIRECCION_GENERICA = '/^[A-Za-z0-9]{16,128}$/';
    private const PATRON_CORREO = '/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/';
    private const PATRON_ENLACE_PAYPAL = '#^https://(?:paypal\.me|www\.paypal\.com)/[A-Za-z0-9_./\-]*$#';
    private const PATRON_NUMERO_BANCO = '/^[0-9]{8,15}$/';
    public const PATRON_NOMBRE_PERSONA_O_ENTIDAD = "/^[\\p{L}\\p{N} .,&'\\-]{2,128}$/u";
    public const PATRON_PAIS_MONEDA = '/^[\p{L}\p{N} \/\-]{2,32}$/u';
    public const TIPOS_CUENTA_BANCO_PERMITIDOS = ['AHORROS', 'CORRIENTE', 'VIRTUAL', 'OTRO'];
    private const PATRON_DOCUMENTO_BANCO = '/^[A-Za-z0-9.\-]{3,20}$/';
    private const PATRON_CUENTA_BANCO = '/^[A-Za-z0-9\-]{4,34}$/';
    private const LONGITUD_MASCARA_NUMERO = 4;
    private const LONGITUD_MAXIMA_CORREO = 64;
    private const LONGITUD_MAXIMA_ENLACE = 255;
    private const LONGITUD_MASCARA_DIRECCION = 6;

    /** Devuelve la dirección recortada si su formato corresponde a la red (RN-03); no verifica checksum. */
    public static function normalizarDireccion(string $claveRed, string $direccion): ?string
    {
        $direccionRecortada = trim($direccion);
        $patron = match ($claveRed) {
            'TRON' => self::PATRON_DIRECCION_TRON,
            'ETH', 'BSC' => self::PATRON_DIRECCION_EVM,
            default => self::PATRON_DIRECCION_GENERICA,
        };
        return preg_match($patron, $direccionRecortada) === 1 ? $direccionRecortada : null;
    }

    public static function normalizarCorreoPaypal(string $correo): ?string
    {
        $correoRecortado = trim($correo);
        if (mb_strlen($correoRecortado) > self::LONGITUD_MAXIMA_CORREO
            || preg_match(self::PATRON_CORREO, $correoRecortado) !== 1
            || filter_var($correoRecortado, FILTER_VALIDATE_EMAIL) === false) {
            return null;
        }
        return $correoRecortado;
    }

    public static function normalizarEnlacePaypal(string $enlace): ?string
    {
        $enlaceRecortado = trim($enlace);
        if (mb_strlen($enlaceRecortado) > self::LONGITUD_MAXIMA_ENLACE
            || preg_match(self::PATRON_ENLACE_PAYPAL, $enlaceRecortado) !== 1) {
            return null;
        }
        return $enlaceRecortado;
    }

    /** Quita +, espacios y guiones y exige de 8 a 15 dígitos (RN-05). */
    public static function normalizarNumeroBanco(string $numero): ?string
    {
        $soloDigitos = str_replace(['+', ' ', '-'], '', trim($numero));
        return preg_match(self::PATRON_NUMERO_BANCO, $soloDigitos) === 1 ? $soloDigitos : null;
    }

    /** Documento del titular: letras, dígitos, puntos y guiones, de 3 a 20 caracteres. */
    public static function normalizarDocumentoBanco(string $documento): ?string
    {
        $documentoRecortado = trim($documento);
        return preg_match(self::PATRON_DOCUMENTO_BANCO, $documentoRecortado) === 1 ? $documentoRecortado : null;
    }

    /** Número de cuenta: alfanumérico y guiones (se quitan espacios), de 4 a 34 caracteres. */
    public static function normalizarCuentaBanco(string $cuenta): ?string
    {
        $cuentaSinEspacios = str_replace(' ', '', trim($cuenta));
        return preg_match(self::PATRON_CUENTA_BANCO, $cuentaSinEspacios) === 1 ? $cuentaSinEspacios : null;
    }

    /** Últimos 4 caracteres de un número para el detalle de auditoría (nunca el número completo). */
    public static function enmascararNumero(string $numero): string
    {
        return '****' . mb_substr($numero, -self::LONGITUD_MASCARA_NUMERO);
    }

    /** Últimos caracteres de la dirección para el detalle de auditoría (RN-15). */
    public static function enmascararDireccion(string $direccion): string
    {
        return mb_substr($direccion, -self::LONGITUD_MASCARA_DIRECCION);
    }
}
