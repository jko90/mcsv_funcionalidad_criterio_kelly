<?php

require_once(__DIR__ . '/global.php');

class CacheProveedor
{
    private string $directorio;

    public function __construct()
    {
        $this->directorio = rtrim(CACHE_DIR, '/');
        if (!is_dir($this->directorio)) {
            mkdir($this->directorio, 0755, true);
        }
    }

    private function rutaArchivo(string $clave): string
    {
        return $this->directorio . '/' . md5($clave) . '.json';
    }

    public function obtener(string $clave): ?array
    {
        $ruta = $this->rutaArchivo($clave);
        if (!file_exists($ruta)) {
            return null;
        }

        $contenido = file_get_contents($ruta);
        if ($contenido === false) {
            return null;
        }

        $data = json_decode($contenido, true);
        if (!is_array($data) || !isset($data['data'], $data['expiresAt'])) {
            return null;
        }

        if ($data['expiresAt'] < time()) {
            return null;
        }

        return $data['data'];
    }

    public function guardar(string $clave, array $valor, int $ttlSegundos): void
    {
        $ruta = $this->rutaArchivo($clave);
        $contenido = json_encode([
            'data' => $valor,
            'expiresAt' => time() + $ttlSegundos,
        ], JSON_UNESCAPED_UNICODE);
        file_put_contents($ruta, $contenido, LOCK_EX);
    }

    public function obtenerStale(string $clave): ?array
    {
        $ruta = $this->rutaArchivo($clave);
        if (!file_exists($ruta)) {
            return null;
        }

        $contenido = file_get_contents($ruta);
        if ($contenido === false) {
            return null;
        }

        $data = json_decode($contenido, true);
        if (!is_array($data) || !isset($data['data'])) {
            return null;
        }

        return $data['data'];
    }
}
