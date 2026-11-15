<?php

declare(strict_types=1);

final class ClienteIp
{
    private static ?string $ipResuelta = null;

    public static function obtener(): string
    {
        if (self::$ipResuelta !== null) {
            return self::$ipResuelta;
        }

        $ipRemota = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $nombreCabecera = Configuracion::obtener('IP_CABECERA_CONFIABLE');
        if ($nombreCabecera !== ''
            && self::estaEnAlgunRango($ipRemota, Configuracion::obtenerLista('IP_PROXIES_CONFIABLES'))) {
            $claveCabecera = 'HTTP_' . strtoupper(str_replace('-', '_', $nombreCabecera));
            $ipCabecera = trim((string) ($_SERVER[$claveCabecera] ?? ''));
            if (filter_var($ipCabecera, FILTER_VALIDATE_IP) !== false) {
                $ipRemota = $ipCabecera;
            }
        }

        self::$ipResuelta = self::normalizar($ipRemota);
        return self::$ipResuelta;
    }

    private static function normalizar(string $ip): string
    {
        $binario = @inet_pton($ip);
        return $binario === false ? '0.0.0.0' : (string) inet_ntop($binario);
    }

    private static function estaEnAlgunRango(string $ip, array $rangosCidr): bool
    {
        foreach ($rangosCidr as $rangoCidr) {
            if (self::estaEnRango($ip, $rangoCidr)) {
                return true;
            }
        }
        return false;
    }

    private static function estaEnRango(string $ip, string $cidr): bool
    {
        $partes = explode('/', $cidr, 2);
        if (count($partes) !== 2 || !is_numeric($partes[1])) {
            return false;
        }
        $ipBinario = @inet_pton($ip);
        $redBinaria = @inet_pton($partes[0]);
        if ($ipBinario === false || $redBinaria === false || strlen($ipBinario) !== strlen($redBinaria)) {
            return false;
        }
        $bits = strlen($ipBinario) * 8;
        $prefijo = (int) $partes[1];
        if ($prefijo < 0 || $prefijo > $bits) {
            return false;
        }
        $bytesCompletos = intdiv($prefijo, 8);
        $bitsRestantes = $prefijo % 8;
        if ($bytesCompletos > 0 && substr($ipBinario, 0, $bytesCompletos) !== substr($redBinaria, 0, $bytesCompletos)) {
            return false;
        }
        if ($bitsRestantes === 0) {
            return true;
        }
        $mascara = (0xFF << (8 - $bitsRestantes)) & 0xFF;
        return (ord($ipBinario[$bytesCompletos]) & $mascara) === (ord($redBinaria[$bytesCompletos]) & $mascara);
    }
}
