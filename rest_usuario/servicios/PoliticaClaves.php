<?php

declare(strict_types=1);

final class PoliticaClaves
{
    public const LONGITUD_MINIMA = 10;
    public const LONGITUD_MAXIMA = 128;
    public const ENTRADAS_MINIMAS_LISTA = 10000;

    private static ?array $clavesComunes = null;

    public static function validar(string $clave, string $usuario, string $correo): ?string
    {
        $longitud = mb_strlen($clave, 'UTF-8');
        if ($longitud < self::LONGITUD_MINIMA || $longitud > self::LONGITUD_MAXIMA) {
            return 'La clave debe tener entre 10 y 128 caracteres';
        }

        $claveNormalizada = mb_strtolower($clave, 'UTF-8');
        if (($usuario !== '' && $claveNormalizada === mb_strtolower($usuario, 'UTF-8'))
            || $claveNormalizada === mb_strtolower($correo, 'UTF-8')) {
            return 'La clave no puede ser igual al usuario ni al correo';
        }

        if (self::esClaveComun($claveNormalizada)) {
            return 'La clave es demasiado común; elige una diferente';
        }

        return null;
    }

    private static function esClaveComun(string $clave): bool
    {
        if (self::$clavesComunes === null) {
            $ruta = Configuracion::obtener('RUTA_CLAVES_COMUNES');
            $lineas = file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lineas === false || count($lineas) < self::ENTRADAS_MINIMAS_LISTA) {
                throw new RuntimeException('La lista de claves comunes está incompleta');
            }

            self::$clavesComunes = array_flip(array_map(
                static fn(string $linea): string => mb_strtolower(trim($linea), 'UTF-8'),
                $lineas
            ));
        }

        return isset(self::$clavesComunes[$clave]);
    }
}
