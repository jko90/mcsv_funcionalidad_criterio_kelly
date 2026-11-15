<?php

declare(strict_types=1);

final class EmisorTokens
{
    public function generarToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public function generarFamilia(): string
    {
        return bin2hex(random_bytes(16));
    }

    public function calcularVencimientos(int $ahora, ?int $familiaExpira): array
    {
        $expiraFamilia = $familiaExpira ?? $ahora + 86400 * Configuracion::obtenerEntero('TOKEN_REFRESH_MAXIMO_DIAS');
        return [
            'accesoExpira' => $ahora + 60 * Configuracion::obtenerEntero('TOKEN_ACCESO_MINUTOS'),
            'familiaExpira' => $expiraFamilia,
            'refreshExpira' => min(
                $ahora + 86400 * Configuracion::obtenerEntero('TOKEN_REFRESH_INACTIVIDAD_DIAS'),
                $expiraFamilia
            ),
        ];
    }

    public function formatearIso(int $marca): string
    {
        return gmdate(DATE_ATOM, $marca);
    }
}
