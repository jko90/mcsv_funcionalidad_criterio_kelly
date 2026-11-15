<?php

declare(strict_types=1);

final class HashClaves
{
    public const OPCIONES = [
        'memory_cost' => 65536,
        'time_cost' => 4,
        'threads' => 1,
    ];

    public const HASH_FICTICIO = '$argon2id$v=19$m=65536,t=4,p=1$RjVxY3JPY2lyWVYzZEhyYg$h5zurQXWocwn3KsZGbrrSpn0jcbbQE8P7cIyBdTc7ws';

    public static function hashear(string $valor): string
    {
        $hash = password_hash($valor, PASSWORD_ARGON2ID, self::OPCIONES);
        if ($hash === false) {
            throw new RuntimeException('No se pudo generar el hash de la clave');
        }

        return $hash;
    }

    public static function verificar(string $clave, string $hash): bool
    {
        if (password_verify($clave, $hash)) {
            return true;
        }

        $claveLegada = htmlspecialchars(trim($clave), ENT_QUOTES, 'UTF-8');
        return $claveLegada !== $clave && password_verify($claveLegada, $hash);
    }
}
