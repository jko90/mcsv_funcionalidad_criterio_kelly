<?php

require_once(__DIR__ . '/../configuracion/ClienteHttp.php');
require_once(__DIR__ . '/../configuracion/global.php');
require_once(__DIR__ . '/../configuracion/CacheProveedor.php');

class ForexMdl
{
    private CacheProveedor $cache;

    public function __construct()
    {
        $this->cache = new CacheProveedor();
    }

    public function obtenerDivisas(): array
    {
        $clave = "obtenerDivisas";

        $cached = $this->cache->obtener($clave);
        if ($cached !== null) {
            return $cached;
        }

        try {
            $url = FRANKFURTER_BASE_URL . "/currencies";
            $data = ClienteHttp::obtenerJson($url);
            $this->cache->guardar($clave, $data, CACHE_TTL_FOREX);
            return $data;
        } catch (ProveedorNoDisponibleException $e) {
            $stale = $this->cache->obtenerStale($clave);
            if ($stale !== null) {
                error_log("Sirviendo caché stale para $clave por fallo de proveedor");
                return $stale;
            }
            throw $e;
        }
    }

    public function obtenerTasas(string $base, string $destinosCsv): array
    {
        $clave = "obtenerTasas_" . md5($base . "_" . $destinosCsv);

        $cached = $this->cache->obtener($clave);
        if ($cached !== null) {
            return $cached;
        }

        try {
            $url = FRANKFURTER_BASE_URL . "/latest?from=" . urlencode($base) . "&to=" . urlencode($destinosCsv);
            $data = ClienteHttp::obtenerJson($url);
            $this->cache->guardar($clave, $data, CACHE_TTL_FOREX);
            return $data;
        } catch (ProveedorNoDisponibleException $e) {
            $stale = $this->cache->obtenerStale($clave);
            if ($stale !== null) {
                error_log("Sirviendo caché stale para $clave por fallo de proveedor");
                return $stale;
            }
            throw $e;
        }
    }
}
