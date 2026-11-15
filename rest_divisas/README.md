# rest_divisas

Servicio REST en PHP que consulta APIs públicas de mercado y devuelve listas de **activos con su último precio**: criptomonedas, pares de forex e índices bursátiles. Está pensado para alimentar el selector de divisas de la aplicación **Criterio Kelly** (`criterioKellyApp`).

> **Estado:** en desarrollo y **todavía sin conectar a la app**. `criterioKellyApp` no tiene una URL para este servicio en `environment.ts` y usa una lista fija de pares (`paginas/planTrading/modelos/listaDivisas.ts`). Ver [Estado actual](#estado-actual).
> **Correo:** este servicio no envía correo. Si algún día lo necesita, debe seguir la convención del módulo `correo/` descrita en `rest_usuario/correo/README.md` (carpeta `correo/` en la raíz del proyecto, marca `// [CORREO]`, registros en `logs/correos/`).

## Stack

- PHP **8.2** con Composer (`rutas/` → `controladores/`)
- Dependencia: `vlucas/phpdotenv` (lectura del `.env`)
- Extensiones `curl` y `allow_url_fopen` habilitadas (llamadas HTTP a las APIs externas)
- Apache (XAMPP) con `mod_rewrite` y `mod_headers`
- **No usa base de datos**: `configuracion/` mantiene `Configuracion.php` y `enlace.php` como los demás servicios, pero ningún endpoint guarda ni lee datos. Las carpetas `modelos/` y `anexos/` están vacías.

## Estructura

```
rest_divisas/
├── .env                 # Configuración y secretos locales (no se versiona)
├── .env.ejemplo         # Plantilla del .env (sí se versiona)
├── .htaccess            # CORS, cabeceras de seguridad, reescritura a index.php
├── index.php            # Arranque (RUTA_APLICACION, .env) y enrutador por prefijo de URI
├── composer.json        # Dependencias directas
├── composer.lock        # Versiones fijadas
├── vendor/              # Dependencias instaladas por Composer (no se versiona)
├── configuracion/       # Configuracion.php (.env), enlace.php (sin uso), CorsConfig.php
├── logs/                # Registro de errores del servicio (no se versiona el contenido)
├── rutas/               # CriptoRts.php, ForexRts.php, IndiceRts.php
├── controladores/       # CriptoCtrl, ForexCtrl, IndiceCtrl (extienden BaseCtrl)
├── modelos/             # vacío
└── anexos/              # vacío
```

## Ambiente local

Pasos J-02 a J-05 de la HU-001 para levantar el servicio en un equipo de desarrollo.

### Requisitos

1. XAMPP con **PHP 8.2 o superior** y las extensiones `mysqli`, `curl`, `openssl` y `mbstring` activas (la misma versión de PHP que el servidor).
2. **Composer 2** instalado (`composer --version` debe responder 2.x).
3. Apache de XAMPP en ejecución. MySQL no es necesario para este servicio.
4. Verifica en `php.ini` que la extensión `curl` esté habilitada, que `allow_url_fopen = On` y que `curl.cainfo` apunte a un bundle de certificados válido (necesario para verificar el TLS de las APIs externas).

### Pasos

1. Ubica el proyecto en `C:\xampp\htdocs\criterio_kelly\rest_divisas`; el servicio responde en `http://localhost/criterio_kelly/rest_divisas/`.
2. Instala las dependencias:

   ```bash
   cd C:\xampp\htdocs\criterio_kelly\rest_divisas
   composer install
   ```

   Sin `vendor/autoload.php` el servicio responde **500** (el arranque falla al no poder cargar Composer).
3. Copia `.env.ejemplo` como `.env` y completa los valores (ver tabla siguiente). `.env` nunca se versiona. `FMP_API_KEY` se obtiene de la cuenta de Financial Modeling Prep y solo se escribe en este archivo.
4. Prueba un endpoint:

   ```bash
   curl http://localhost/criterio_kelly/rest_divisas/cripto/disponible
   ```

5. Pruebas de la app en local (J-03 a J-05): `ionic serve --port=8100` apunta a este backend; aquí no hay envío de correo ni base local.

### Variables del `.env`

Si falta una clave o su valor no cumple la regla, el servicio responde **500** `{"error":"Error interno del servidor"}` y registra `Configuración inválida` con el nombre de la clave (nunca su valor). Las claves `DB_*` se comparten con los demás backends aunque este servicio no use la base de datos.

| Clave | Ejemplo | Regla |
|-------|---------|-------|
| `APP_ENTORNO` | `local` | `local`, `staging` o `produccion` |
| `DB_HOST` | `localhost` | Obligatoria, no vacía |
| `DB_PUERTO` | `3306` | Entero de 1 a 65535 |
| `DB_NOMBRE` | `sist_criteriokelly` | Obligatoria, no vacía |
| `DB_USUARIO` | `ck_aplicacion` | Obligatoria, no vacía; con `produccion`, distinta de `root` |
| `DB_CLAVE` | *(vacía en el ejemplo)* | Puede ser vacía solo si `APP_ENTORNO` no es `produccion` |
| `DB_CHARSET` | `utf8mb4` | Exactamente `utf8mb4` |
| `CORS_ORIGENES_WEB` | `http://localhost:8100,http://localhost:4200` | Uno o más orígenes (`esquema://host[:puerto]`, sin ruta ni barra final); con `produccion`, ninguno con `http://` ni `localhost` |
| `CORS_ORIGENES_NATIVOS` | `capacitor://localhost,https://localhost` | Lista (puede ser vacía) con el mismo formato de origen |
| `IP_CABECERA_CONFIABLE` | *(vacía)* | Vacía o un nombre de cabecera (`A-Z`, `a-z`, `0-9`, `-`) |
| `IP_PROXIES_CONFIABLES` | *(vacía)* | Lista de CIDR IPv4/IPv6; obligatoria si `IP_CABECERA_CONFIABLE` no está vacía |
| `RUTA_LOGS` | `logs` | Carpeta existente y escribible (relativa a la raíz del backend) |
| `FORZAR_HTTPS` | `false` | `true` o `false`; `true` obligatorio con `staging` o `produccion` |
| `FMP_API_KEY` | *(sin valor en el ejemplo)* | Obligatoria, no vacía |

`.htaccess` solo permite CORS desde `http://localhost:8100` (puerto de `ionic serve`); la lista blanca configurable desde el `.env` se aplica en HLT-02.

HLT-03 protege las consultas de mercados con `Authorization: Bearer <accessToken>`.
Este servicio conserva su ausencia de lógica de negocio de base de datos, pero la
guardia comparte las tablas de seguridad de `sist_criteriokelly` con los demás
backends.

## Endpoints

URL base: `http://localhost/rest_divisas/`. Todos son **GET** y requieren sesión.
No hay rutas públicas de mercado. Cada recurso responde en su raíz con un estado de servicio
(`{ status, timestamp, version, service }`) y en `/disponible` con la lista de activos.

| Ruta | Fuente | Qué devuelve |
|------|--------|--------------|
| `/cripto/disponible` | Binance `GET /api/v3/ticker/24hr` | Símbolos que contienen `USDT` o `BUSD`, con su último precio (`lastPrice`) |
| `/forex/disponible` | [Frankfurter](https://www.frankfurter.app) (tasas del BCE) | Todos los pares entre las divisas que publica Frankfurter, con su tasa |
| `/indice/disponible` | Financial Modeling Prep `/api/v3/quotes/index` (requiere API key) | Índices bursátiles con su precio |
| `/sinteticos`, `/otros` | — | No existen; el enrutador responde 404 |

Todas las listas usan la misma forma:

```json
[
  { "symbol": "BTCUSDT", "name": "BTCUSDT", "price": "67890.12000000", "type": "crypto" },
  { "symbol": "EURUSD",  "name": "EUR/USD", "price": "1.084500",       "type": "forex" },
  { "symbol": "^GSPC",   "name": "S&P 500", "price": "5123.410000",    "type": "indice" }
]
```

- `price` siempre es una cadena. Forex e índices usan 6 decimales.
- Si la API externa falla, la respuesta es `200` con una lista vacía `[]`, no un error.
- Las excepciones se devuelven como `500` con `{ "error": "Error interno del servidor" }`.

### Consideraciones por fuente

- **Cripto:** Binance bloquea su API en algunas regiones (HTTP 451). En ese caso el endpoint devuelve `[]`. La conexión verifica el certificado TLS (`CURLOPT_SSL_VERIFYPEER => true`, `CURLOPT_SSL_VERIFYHOST => 2`).
- **Forex:** hace una petición a Frankfurter por cada divisa base, en grupos de 20 destinos, con pausas de 50–150 ms para no saturar la API. Son decenas de peticiones por llamada, así que tarda varios segundos; conviene guardar el resultado en caché antes de exponerlo a la app.
- **Índices:** requiere una API key de Financial Modeling Prep. El endpoint `/api/v3/...` es la versión anterior de su API; la nueva es `/stable/index-list`.

## Agregar una fuente

1. Crea `controladores/<Fuente>Ctrl.php` (extiende `BaseCtrl`) con un método que devuelva un arreglo de `{ symbol, name, price, type }`.
2. Crea `rutas/<Fuente>Rts.php` copiando una ruta existente: localiza la acción después del prefijo y atiende `disponible` en `manejarGet`.
3. Registra el prefijo en el arreglo `$rutas` de `index.php`.

## Estado actual

- **Sin caché ni base de datos:** cada petición consulta las APIs externas en vivo.
- **No se usa en la app:** falta añadir la URL en `environment.ts` y reemplazar la lista fija `listaDivisas.ts`.
- **Mensajes del estado de servicio copiados:** las tres rutas devuelven `"service": "PlanesRTS"`, y la respuesta 405 anuncia `POST` aunque solo se acepta `GET`.
