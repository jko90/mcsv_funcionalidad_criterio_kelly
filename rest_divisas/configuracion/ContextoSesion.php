<?php

declare(strict_types=1);

final class ContextoSesion
{
    private static ?int $idUsuario = null;
    private static array $roles = [];
    private static ?int $idSesion = null;
    private static ?string $familia = null;

    public static function establecer(int $idUsuario, array $roles, int $idSesion, string $familia): void
    {
        self::$idUsuario = $idUsuario;
        self::$roles = $roles;
        self::$idSesion = $idSesion;
        self::$familia = $familia;
    }

    public static function estaAutenticado(): bool
    {
        return self::$idUsuario !== null;
    }

    public static function idUsuario(): int
    {
        if (self::$idUsuario === null) {
            throw new LogicException('Sesión no establecida');
        }
        return self::$idUsuario;
    }

    public static function roles(): array
    {
        return self::$roles;
    }

    public static function idSesion(): int
    {
        if (self::$idSesion === null) {
            throw new LogicException('Sesión no establecida');
        }
        return self::$idSesion;
    }

    public static function familia(): string
    {
        if (self::$familia === null) {
            throw new LogicException('Sesión no establecida');
        }
        return self::$familia;
    }

    public static function limpiar(): void
    {
        self::$idUsuario = null;
        self::$roles = [];
        self::$idSesion = null;
        self::$familia = null;
    }
}
