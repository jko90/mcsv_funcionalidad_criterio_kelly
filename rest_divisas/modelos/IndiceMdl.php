<?php

require_once(__DIR__ . '/../configuracion/ClienteHttp.php');
require_once(__DIR__ . '/../configuracion/global.php');
require_once(__DIR__ . '/../configuracion/CacheProveedor.php');

class IndiceMdl
{
    private CacheProveedor $cache;

    public function __construct()
    {
        $this->cache = new CacheProveedor();
    }

    public function obtenerIndices(): array
    {
        $clave = "obtenerIndices";

        $cached = $this->cache->obtener($clave);
        if ($cached !== null) {
            return $cached;
        }

        try {
            $url = FMP_BASE_URL . "/quotes/index?apikey=" . urlencode(FMP_API_KEY);
            $data = ClienteHttp::obtenerJson($url);
            $this->cache->guardar($clave, $data, CACHE_TTL_INDICE);
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
