<?php

declare(strict_types=1);

use Dotenv\Dotenv;

/**
 * Carga y valida la configuración de un backend a partir de su archivo .env.
 *
 * Los valores validados quedan en memoria y se eliminan de $_ENV/$_SERVER para
 * reducir su exposición. Los secretos nunca se incluyen en los mensajes.
 */
final class Configuracion
{
    private const PUERTO_MINIMO = 1;
    private const PUERTO_MAXIMO = 65535;
    private const TOKEN_ACCESO_MINIMO = 5;
    private const TOKEN_ACCESO_MAXIMO = 60;
    private const TOKEN_INACTIVIDAD_MINIMO = 1;
    private const TOKEN_INACTIVIDAD_MAXIMO = 30;

    private const CLAVES_COMUNES = [
        'APP_ENTORNO',
        'DB_HOST',
        'DB_PUERTO',
        'DB_NOMBRE',
        'DB_USUARIO',
        'DB_CLAVE',
        'DB_CHARSET',
        'CORS_ORIGENES_WEB',
        'CORS_ORIGENES_NATIVOS',
        'IP_CABECERA_CONFIABLE',
        'IP_PROXIES_CONFIABLES',
        'RUTA_LOGS',
        'FORZAR_HTTPS',
    ];

    private const CLAVES_USUARIO = [
        'TOKEN_ACCESO_MINUTOS',
        'TOKEN_REFRESH_INACTIVIDAD_DIAS',
        'TOKEN_REFRESH_MAXIMO_DIAS',
        'COOKIE_REFRESH_NOMBRE',
        'COOKIE_REFRESH_RUTA',
        'COOKIE_REFRESH_SEGURA',
        'CORREO_MODO',
        'SMTP_HOST',
        'SMTP_PUERTO',
        'SMTP_USUARIO',
        'SMTP_CLAVE',
        'SMTP_CIFRADO',
        'CORREO_REMITENTE',
        'CORREO_REMITENTE_NOMBRE',
        'CORREO_ALERTAS',
        'RUTA_CLAVES_COMUNES',
    ];

    private const CLAVES_DIVISAS = ['FMP_API_KEY'];

    /** @var array<string, string> */
    private static array $valores = [];

    public static function cargar(string $rutaAplicacion, string $nombreServicio): void
    {
        $claves = self::clavesDelServicio($nombreServicio);

        Dotenv::createImmutable($rutaAplicacion)->load();

        $valores = [];
        foreach ($claves as $clave) {
            if (!array_key_exists($clave, $_ENV)) {
                throw new RuntimeException('Clave ' . $clave . ': no definida');
            }
            $valores[$clave] = (string) $_ENV[$clave];
        }

        $valores['RUTA_LOGS'] = self::resolverRuta($rutaAplicacion, $valores['RUTA_LOGS']);
        if (isset($valores['RUTA_CLAVES_COMUNES'])) {
            $valores['RUTA_CLAVES_COMUNES'] = self::resolverRuta($rutaAplicacion, $valores['RUTA_CLAVES_COMUNES']);
        }

        self::validar($valores);

        self::$valores = $valores;

        foreach ($claves as $clave) {
            unset($_ENV[$clave], $_SERVER[$clave]);
        }
    }

    public static function obtener(string $clave): string
    {
        if (!array_key_exists($clave, self::$valores)) {
            throw new RuntimeException('Clave ' . $clave . ': no cargada');
        }

        return self::$valores[$clave];
    }

    public static function obtenerEntero(string $clave): int
    {
        return (int) self::obtener($clave);
    }

    public static function obtenerBooleano(string $clave): bool
    {
        return self::obtener($clave) === 'true';
    }

    /**
     * @return list<string>
     */
    public static function obtenerLista(string $clave): array
    {
        $elementos = array_map('trim', explode(',', self::obtener($clave)));

        return array_values(array_filter($elementos, static fn(string $elemento): bool => $elemento !== ''));
    }

    public static function esProduccion(): bool
    {
        return self::obtener('APP_ENTORNO') === 'produccion';
    }

    /**
     * @return list<string>
     */
    private static function clavesDelServicio(string $nombreServicio): array
    {
        $claves = self::CLAVES_COMUNES;

        if ($nombreServicio === 'rest_usuario') {
            $claves = array_merge($claves, self::CLAVES_USUARIO);
        } elseif ($nombreServicio === 'rest_divisas') {
            $claves = array_merge($claves, self::CLAVES_DIVISAS);
        } elseif ($nombreServicio !== 'rest_criteriokelly' && $nombreServicio !== 'rest_suscripcion') {
            throw new RuntimeException('Servicio desconocido: ' . $nombreServicio);
        }

        return $claves;
    }

    /**
     * @param array<string, string> $valores
     */
    private static function validar(array $valores): void
    {
        $entorno = $valores['APP_ENTORNO'];
        $esProduccion = $entorno === 'produccion';
        $esLocal = $entorno === 'local';

        if (!in_array($entorno, ['local', 'staging', 'produccion'], true)) {
            throw new RuntimeException('Clave APP_ENTORNO: debe ser local, staging o produccion');
        }

        foreach (['DB_HOST', 'DB_NOMBRE', 'DB_USUARIO'] as $clave) {
            if ($valores[$clave] === '') {
                throw new RuntimeException('Clave ' . $clave . ': no puede estar vacía');
            }
        }

        self::validarEnteroEnRango('DB_PUERTO', $valores['DB_PUERTO'], self::PUERTO_MINIMO, self::PUERTO_MAXIMO);

        if ($esProduccion && $valores['DB_CLAVE'] === '') {
            throw new RuntimeException('Clave DB_CLAVE: no puede estar vacía en produccion');
        }

        if ($esProduccion && $valores['DB_USUARIO'] === 'root') {
            throw new RuntimeException('Clave DB_USUARIO: no puede ser root en produccion');
        }

        if ($valores['DB_CHARSET'] !== 'utf8mb4') {
            throw new RuntimeException('Clave DB_CHARSET: debe ser utf8mb4');
        }

        $origenesWeb = self::separarLista($valores['CORS_ORIGENES_WEB']);
        if ($origenesWeb === []) {
            throw new RuntimeException('Clave CORS_ORIGENES_WEB: debe tener al menos un origen');
        }
        foreach ($origenesWeb as $origen) {
            if (!self::esOrigenValido($origen)) {
                throw new RuntimeException('Clave CORS_ORIGENES_WEB: origen inválido');
            }
        }
        if ($esProduccion) {
            foreach ($origenesWeb as $origen) {
                if (str_starts_with($origen, 'http://') || str_contains($origen, 'localhost')) {
                    throw new RuntimeException('Clave CORS_ORIGENES_WEB: origen no permitido en produccion');
                }
            }
        }

        foreach (self::separarLista($valores['CORS_ORIGENES_NATIVOS']) as $origen) {
            if (!self::esOrigenValido($origen)) {
                throw new RuntimeException('Clave CORS_ORIGENES_NATIVOS: origen inválido');
            }
        }

        if ($valores['IP_CABECERA_CONFIABLE'] !== ''
            && preg_match('/^[A-Za-z0-9-]+$/', $valores['IP_CABECERA_CONFIABLE']) !== 1) {
            throw new RuntimeException('Clave IP_CABECERA_CONFIABLE: formato inválido');
        }

        $proxies = self::separarLista($valores['IP_PROXIES_CONFIABLES']);
        if ($valores['IP_CABECERA_CONFIABLE'] !== '' && $proxies === []) {
            throw new RuntimeException('Clave IP_PROXIES_CONFIABLES: obligatoria si IP_CABECERA_CONFIABLE tiene valor');
        }
        foreach ($proxies as $proxy) {
            if (!self::esCidrValido($proxy)) {
                throw new RuntimeException('Clave IP_PROXIES_CONFIABLES: CIDR inválido');
            }
        }

        if (!is_dir($valores['RUTA_LOGS']) || !is_writable($valores['RUTA_LOGS'])) {
            throw new RuntimeException('Clave RUTA_LOGS: carpeta inexistente o no escribible');
        }

        if (!in_array($valores['FORZAR_HTTPS'], ['true', 'false'], true)) {
            throw new RuntimeException('Clave FORZAR_HTTPS: debe ser true o false');
        }
        if (!$esLocal && $valores['FORZAR_HTTPS'] !== 'true') {
            throw new RuntimeException('Clave FORZAR_HTTPS: debe ser true en staging y produccion');
        }

        if (!array_key_exists('TOKEN_ACCESO_MINUTOS', $valores)) {
            return;
        }

        self::validarEnteroEnRango(
            'TOKEN_ACCESO_MINUTOS',
            $valores['TOKEN_ACCESO_MINUTOS'],
            self::TOKEN_ACCESO_MINIMO,
            self::TOKEN_ACCESO_MAXIMO
        );
        self::validarEnteroEnRango(
            'TOKEN_REFRESH_INACTIVIDAD_DIAS',
            $valores['TOKEN_REFRESH_INACTIVIDAD_DIAS'],
            self::TOKEN_INACTIVIDAD_MINIMO,
            self::TOKEN_INACTIVIDAD_MAXIMO
        );

        $inactividad = (int) $valores['TOKEN_REFRESH_INACTIVIDAD_DIAS'];
        if (!preg_match('/^\d+$/', $valores['TOKEN_REFRESH_MAXIMO_DIAS'])
            || (int) $valores['TOKEN_REFRESH_MAXIMO_DIAS'] < $inactividad) {
            throw new RuntimeException('Clave TOKEN_REFRESH_MAXIMO_DIAS: debe ser un entero mayor o igual que TOKEN_REFRESH_INACTIVIDAD_DIAS');
        }

        if (preg_match('/^[A-Za-z0-9_-]+$/', $valores['COOKIE_REFRESH_NOMBRE']) !== 1) {
            throw new RuntimeException('Clave COOKIE_REFRESH_NOMBRE: formato inválido');
        }

        $rutaCookie = $valores['COOKIE_REFRESH_RUTA'];
        if (!str_starts_with($rutaCookie, '/') || !str_ends_with($rutaCookie, '/')) {
            throw new RuntimeException('Clave COOKIE_REFRESH_RUTA: debe empezar y terminar con /');
        }

        if (!in_array($valores['COOKIE_REFRESH_SEGURA'], ['true', 'false'], true)) {
            throw new RuntimeException('Clave COOKIE_REFRESH_SEGURA: debe ser true o false');
        }
        if (!$esLocal && $valores['COOKIE_REFRESH_SEGURA'] !== 'true') {
            throw new RuntimeException('Clave COOKIE_REFRESH_SEGURA: solo puede ser false en local');
        }

        if (!in_array($valores['CORREO_MODO'], ['smtp', 'mail', 'log'], true)) {
            throw new RuntimeException('Clave CORREO_MODO: debe ser smtp, mail o log');
        }
        if (!$esLocal && $valores['CORREO_MODO'] === 'log') {
            throw new RuntimeException('Clave CORREO_MODO: log solo está permitido en local');
        }

        if ($valores['SMTP_HOST'] === '') {
            throw new RuntimeException('Clave SMTP_HOST: no puede estar vacía');
        }
        self::validarEnteroEnRango('SMTP_PUERTO', $valores['SMTP_PUERTO'], self::PUERTO_MINIMO, self::PUERTO_MAXIMO);

        if (!in_array($valores['SMTP_CIFRADO'], ['tls', 'ssl', 'ninguno'], true)) {
            throw new RuntimeException('Clave SMTP_CIFRADO: debe ser tls, ssl o ninguno');
        }
        if (!$esLocal && $valores['SMTP_CIFRADO'] === 'ninguno') {
            throw new RuntimeException('Clave SMTP_CIFRADO: ninguno solo está permitido en local');
        }

        foreach (['CORREO_REMITENTE', 'CORREO_ALERTAS'] as $clave) {
            if (!self::esCorreoValido($valores[$clave], $esLocal)) {
                throw new RuntimeException('Clave ' . $clave . ': correo inválido');
            }
        }

        if ($valores['CORREO_REMITENTE_NOMBRE'] === '') {
            throw new RuntimeException('Clave CORREO_REMITENTE_NOMBRE: no puede estar vacía');
        }

        if (!is_file($valores['RUTA_CLAVES_COMUNES'])) {
            throw new RuntimeException('Clave RUTA_CLAVES_COMUNES: archivo inexistente');
        }
    }

    private static function validarEnteroEnRango(string $clave, string $valor, int $minimo, int $maximo): void
    {
        if (preg_match('/^\d+$/', $valor) !== 1) {
            throw new RuntimeException('Clave ' . $clave . ': debe ser un entero');
        }

        $numero = (int) $valor;
        if ($numero < $minimo || $numero > $maximo) {
            throw new RuntimeException('Clave ' . $clave . ': fuera de rango');
        }
    }

    /**
     * @return list<string>
     */
    private static function separarLista(string $valor): array
    {
        $elementos = array_map('trim', explode(',', $valor));

        return array_values(array_filter($elementos, static fn(string $elemento): bool => $elemento !== ''));
    }

    private static function esOrigenValido(string $origen): bool
    {
        return preg_match('/^[a-z][a-z0-9+.\-]*:\/\/[^\/\s]+$/', $origen) === 1;
    }

    private static function esCidrValido(string $cidr): bool
    {
        if (substr_count($cidr, '/') !== 1) {
            return false;
        }

        [$ip, $prefijo] = explode('/', $cidr, 2);

        if (filter_var($ip, FILTER_VALIDATE_IP) === false || preg_match('/^\d{1,3}$/', $prefijo) !== 1) {
            return false;
        }

        $maximo = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false ? 128 : 32;
        $numero = (int) $prefijo;

        return $numero >= 0 && $numero <= $maximo;
    }

    private static function esCorreoValido(string $correo, bool $esLocal): bool
    {
        if (filter_var($correo, FILTER_VALIDATE_EMAIL) !== false) {
            return true;
        }

        return $esLocal && preg_match('/^[A-Za-z0-9._%+-]+@localhost$/', $correo) === 1;
    }

    private static function resolverRuta(string $rutaAplicacion, string $ruta): string
    {
        if (str_starts_with($ruta, '/') || preg_match('/^[A-Za-z]:/', $ruta) === 1) {
            return $ruta;
        }

        return rtrim($rutaAplicacion, '/\\') . DIRECTORY_SEPARATOR . $ruta;
    }
}
