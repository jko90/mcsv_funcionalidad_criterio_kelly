<?php

require_once(__DIR__ . '/../configuracion/ClienteHttp.php');
require_once(__DIR__ . '/../configuracion/global.php');
require_once(__DIR__ . '/../configuracion/CacheProveedor.php');

class CriptoMdl
{
    private CacheProveedor $cache;

    public function __construct()
    {
        $this->cache = new CacheProveedor();
    }

    public function obtenerTicker24h(): array
    {
        $clave = "obtenerTicker24h";

        $cached = $this->cache->obtener($clave);
        if ($cached !== null) {
            return $cached;
        }

        try {
            $url = BINANCE_BASE_URL . "/ticker/24hr";
            $data = ClienteHttp::obtenerJson($url);
            $this->cache->guardar($clave, $data, CACHE_TTL_CRIPTO);
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
