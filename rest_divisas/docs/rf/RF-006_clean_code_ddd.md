# RF-006 — Código limpio y DDD: responsabilidad única y eliminación de redundancia en `rest_divisas`

> **Tipo:** Refactor / Deuda técnica / Arquitectura.
> **Servicio afectado:** `rest_divisas`.
> **Archivos objetivo:** `modelos/BaseMdl.php` (CREATE), `modelos/CriptoMdl.php`,
> `modelos/ForexMdl.php`, `modelos/IndiceMdl.php`, `controladores/BaseCtrl.php`,
> `controladores/ForexCtrl.php`, `controladores/CriptoCtrl.php`, `controladores/IndiceCtrl.php`,
> `rutas/CriptoRts.php`, `rutas/ForexRts.php`, `rutas/IndiceRts.php`, `rutas/RuteoCentralizado.php`,
> `index.php`, `servicios/ForexMatrixService.php` (CREATE), `dto/ActivoDTO.php` (CREATE).
> **Prioridad:** Alta (35-40% del código es duplicado, 2 violaciones SRP críticas).
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `RF-002_refactor_codigo_backend.md`, `RF-003_refactor_index.md`,
> `RF-005_cache_y_eficiencia_proveedores.md` (HLT-RF-005 implementado).
> **HLT asociado:** `docs/hlt/HLT-RF-006_clean_code_ddd.md` (a crear).

---

## 1. Historia de usuario

> **Como** desarrollador backend del servicio `rest_divisas`,
> **quiero** eliminar la duplicidad estructural entre los tres dominios (cripto, forex, índices)
> aplicando principios de Código Limpio y Diseño Guiado por Dominio (DDD): responsabilidad única
> en cada clase, separación de la lógica de dominio de la de infraestructura, y unificación de
> patrones repetidos en una jerarquía base,
> **para** que el código sea mantenible, testeable y extensible sin riesgo de romper la
> funcionalidad existente, reduciendo el código duplicado estimado del ~35-40% actual a menos del 10%.

---

## 2. Contexto y problema actual

Tras la implementación de RF-001 a RF-005, `rest_divisas` es funcionalmente correcto pero
presenta alta redundancia estructural y violaciones del Principio de Responsabilidad Única (SRP).
Un análisis exhaustivo del código detectó los siguientes defectos:

| # | Defecto | Evidencia | Impacto |
|---|---------|-----------|---------|
| D1 | **Patrón de modelo duplicado al 80%** en los 3 `*Mdl`. Cada modelo tiene el mismo `try/catch` con stale-if-error, misma estructura de constructor con `CacheProveedor`, mismo flujo caché → API → stale. Solo varían URL, clave de caché y TTL. | `CriptoMdl.php:7-38`, `ForexMdl.php:7-62`, `IndiceMdl.php:7-38` | ALTO — ~75 líneas duplicadas que deben mantenerse en sincronía; cualquier cambio en la política de caché requiere modificar 3 archivos |
| D2 | **`BaseCtrl::despachar()` como "God Method".** Un solo método mezcla: validación de método HTTP, parseo de URI, health-check, mapeo acción→método, ejecución y manejo de excepciones (502/500). Tres responsabilidades claramente separables. | `BaseCtrl.php:52-95` | ALTO — cualquier cambio en ruteo, health-check o manejo de errores modifica la misma clase; difícil de testear |
| D3 | **`ForexCtrl::getAllMajorForex()` con responsabilidad excesiva.** El método maneja caché (instancia `CacheProveedor`), lógica de dominio (matriz de pares), llamadas API en bucle, rate-limiting (usleep), transformación DTO. Un servicio de dominio debe extraerse. | `ForexCtrl.php:19-89` | ALTO — 70 líneas con 4 responsabilidades distintas; viola SRP y Open/Closed |
| D4 | **Tres `*Rts.php` estructuralmente idénticos.** Cada archivo (5 líneas) solo pasa 4 argumentos distintos a `ejecutarRuteo()`. Son middleware que no añade valor. | `CriptoRts.php`, `ForexRts.php`, `IndiceRts.php` | MEDIO — 3 archivos redundantes que aumentan la superficie de archivos a modificar al añadir un dominio |
| D5 | **Transformación a DTO repetida en los 3 controladores.** Cada controlador transforma datos crudos al mismo formato `{symbol, name, price, type}` con `number_format(..., 6, '.', '')`. No hay un DTO compartido. | `CriptoCtrl.php:20-32`, `ForexCtrl.php:66-78`, `IndiceCtrl.php:19-36` | MEDIO — cambio en el formato de respuesta requiere modificar 3 archivos |
| D6 | **`CacheProveedor` mezcla persistencia de archivos con lógica de expiración.** Crear directorio, leer/escribir archivos, serializar JSON y decidir expiración están en la misma clase. SRP sugiere separar la capa de almacenamiento de la política de caché. | `CacheProveedor.php:5-75` | BAJO — funcional pero con dos responsabilidades mezcladas |
| D7 | **`ForexCtrl` tiene doble capa de caché inconsistente.** `ForexMdl` ya cachea cada llamada individual, y `ForexCtrl` además cachea la matriz completa. Esto es correcto por diseño (RF-005) pero la responsabilidad de la caché de matriz debería estar en un servicio de dominio, no en el controlador. | `ForexCtrl.php:21-27,86` vs `ForexMdl.php:16-37` | BAJO — lógica correcta pero mal ubicada arquitectónicamente |

### 2.1. Métrica de duplicación

| Componente | Líneas totales | Líneas duplicadas | % duplicación |
|------------|----------------|-------------------|---------------|
| 3 modelos (`*Mdl`) | ~141 | ~110 | ~78% |
| 3 RTS (`*Rts`) | ~15 | ~12 | ~80% |
| 3 controladores (transformación DTO) | ~45 | ~30 | ~67% |
| **Total servicio** | ~967 | ~340 | ~35% |

---

## 3. Objetivo del refactor

1. **Eliminar ~200 líneas de código duplicado** mediante herencia y componentes compartidos.
2. **Separar responsabilidades** según SRP: cada clase hace una cosa y la hace bien.
3. **Aplicar DDD** táctico: separar `Infraestructura` (clientes HTTP, caché, routing) de `Dominio` (servicios de matriz forex, DTOs) y `Aplicación` (controladores).
4. **Preservar la funcionalidad exacta**: ni un solo endpoint cambia su ruta, método, entrada, código de éxito, formato de respuesta ni comportamiento observable (salvo latencia reducida por eliminación de overhead).
5. **Mantener la estructura de archivos plana** (sin namespaces) que el proyecto usa, para no introducir autoloading PSR-4 en este RF. La migración a Composer queda como mejora futura.

---

## 4. Arquitectura objetivo

### 4.1. Nuevo mapa de capas DDD

| Capa DDD | Rol | Archivos |
|----------|-----|----------|
| **Infraestructura** | Persistencia, comunicación externa, caché, routing | `configuracion/` (sin cambios), `rutas/RuteoCentralizado.php` (simplificado), `modelos/BaseMdl.php` (nuevo), `modelos/*Mdl.php` (simplificados) |
| **Dominio** | Lógica de negocio pura, DTOs, servicios de dominio | `dto/ActivoDTO.php` (nuevo), `servicios/ForexMatrixService.php` (nuevo) |
| **Aplicación** | Orquestación, controladores, respuesta HTTP | `controladores/BaseCtrl.php` (simplificado), `controladores/*Ctrl.php` (simplificados) |

### 4.2. Herencia de modelos

```
BaseMdl (abstracto)
  ├── CriptoMdl  — solo define clave, URL, TTL
  ├── ForexMdl   — define clave, URL, TTL + método extra obtenerTasas()
  └── IndiceMdl  — solo define clave, URL, TTL
```

### 4.3. Flujo de `despachar()` refactorizado

```
index.php:
  1. Validar método HTTP
  2. Extraer acción de la URI
  3. Invocar health-check si aplica → responder
  4. Mapear acción → método del controlador
  5. Llamar al método y capturar excepciones

BaseCtrl:
  Solo helpers: respuestaExitosaSimple, respuestaErrorSimple, validarDatos, limpiarDatos
```

---

## 5. Descripción detallada de cambios

### 5.1. CREATE `modelos/BaseMdl.php`

Clase abstracta que encapsula el patrón **caché → API → stale-if-error** que hoy está duplicado en los 3 modelos.

```php
abstract class BaseMdl
{
    private CacheProveedor $cache;

    public function __construct()
    {
        $this->cache = new CacheProveedor();
    }

    abstract protected function obtenerClaveCache(): string;
    abstract protected function obtenerUrl(): string;
    abstract protected function obtenerTtlCache(): int;

    protected function ejecutarConsulta(): array
    {
        $clave = $this->obtenerClaveCache();
        $cached = $this->cache->obtener($clave);
        if ($cached !== null) {
            return $cached;
        }
        try {
            $url = $this->obtenerUrl();
            $data = ClienteHttp::obtenerJson($url);
            $this->cache->guardar($clave, $data, $this->obtenerTtlCache());
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
```

**Reglas:**
- `ejecutarConsulta()` es `protected` (no público) porque los métodos públicos de cada subclase deben nombrarse según el dominio (`obtenerTicker24h`, `obtenerDivisas`, etc.).
- No se expone la URL ni la clave de caché como públicas.
- El constructor crea `CacheProveedor` automáticamente (no se inyecta para no cambiar el patrón de creación del servicio).

### 5.2. MODIFY `modelos/CriptoMdl.php`

Se reduce a declarar las 3 abstracciones y un método público que delega en `ejecutarConsulta()`.

```php
class CriptoMdl extends BaseMdl
{
    protected function obtenerClaveCache(): string { return "obtenerTicker24h"; }
    protected function obtenerUrl(): string { return BINANCE_BASE_URL . "/ticker/24hr"; }
    protected function obtenerTtlCache(): int { return CACHE_TTL_CRIPTO; }

    public function obtenerTicker24h(): array { return $this->ejecutarConsulta(); }
}
```

### 5.3. MODIFY `modelos/IndiceMdl.php`

Mismo patrón que CriptoMdl.

```php
class IndiceMdl extends BaseMdl
{
    protected function obtenerClaveCache(): string { return "obtenerIndices"; }
    protected function obtenerUrl(): string { return FMP_BASE_URL . "/quotes/index?apikey=" . urlencode(FMP_API_KEY); }
    protected function obtenerTtlCache(): int { return CACHE_TTL_INDICE; }

    public function obtenerIndices(): array { return $this->ejecutarConsulta(); }
}
```

### 5.4. MODIFY `modelos/ForexMdl.php`

`obtenerDivisas()` usa `ejecutarConsulta()`. `obtenerTasas()` no puede usar `ejecutarConsulta()` directamente porque necesita parámetros dinámicos (`base`, `destinosCsv`) y una clave compuesta. En lugar de duplicar la lógica, se refactoriza para que `obtenerTasas()` construya su propia clave y URL, pero reutilice el mismo `CacheProveedor` y el mismo patrón try/catch.

```php
class ForexMdl extends BaseMdl
{
    protected function obtenerClaveCache(): string { return "obtenerDivisas"; }
    protected function obtenerUrl(): string { return FRANKFURTER_BASE_URL . "/currencies"; }
    protected function obtenerTtlCache(): int { return CACHE_TTL_FOREX; }

    public function obtenerDivisas(): array { return $this->ejecutarConsulta(); }

    public function obtenerTasas(string $base, string $destinosCsv): array
    {
        $clave = "obtenerTasas_" . md5($base . "_" . $destinosCsv);
        $cache = $this->getCache();
        $cached = $cache->obtener($clave);
        if ($cached !== null) {
            return $cached;
        }
        try {
            $url = FRANKFURTER_BASE_URL . "/latest?from=" . urlencode($base) . "&to=" . urlencode($destinosCsv);
            $data = ClienteHttp::obtenerJson($url);
            $cache->guardar($clave, $data, CACHE_TTL_FOREX);
            return $data;
        } catch (ProveedorNoDisponibleException $e) {
            $stale = $cache->obtenerStale($clave);
            if ($stale !== null) {
                error_log("Sirviendo caché stale para $clave por fallo de proveedor");
                return $stale;
            }
            throw $e;
        }
    }
}
```

Nota: `BaseMdl` debe exponer un `protected function getCache(): CacheProveedor` para que las subclases puedan acceder a la instancia de caché cuando necesiten claves dinámicas.

### 5.6. CREATE `servicios/ForexMatrixService.php`

Extrae la lógica de construcción de la matriz completa de pares forex desde `ForexCtrl::getAllMajorForex()` a un servicio de dominio dedicado.

**Responsabilidades:**
- Instanciar `CacheProveedor` para la clave `forex_matrix`.
- Obtener lista de divisas desde `ForexMdl`.
- Iterar, chunquear, llamar a `ForexMdl::obtenerTasas()` con `usleep`.
- Construir arreglo de pares.
- Cachear resultado completo.
- Retornar arreglo de pares (mismo formato que hoy devuelve `ForexCtrl`).

**Contrato público:**
```php
class ForexMatrixService
{
    public function obtenerMatrizCompleta(): array
    {
        // Cache de matriz completa (igual que hoy en ForexCtrl)
        $clave = "forex_matrix";
        $cache = new CacheProveedor();
        $cached = $cache->obtener($clave);
        if ($cached !== null) {
            return $cached;
        }

        // Lógica de matriz (extraída de ForexCtrl)
        $forexMdl = new ForexMdl();
        $currencies = $forexMdl->obtenerDivisas();
        // ... chunking, usleep, llamadas a obtenerTasas, construcción de pares ...

        $cache->guardar($clave, $forex_data, CACHE_TTL_FOREX);
        return $forex_data;
    }
}
```

### 5.7. MODIFY `controladores/ForexCtrl.php`

Se simplifica para que solo orqueste: instancia `ForexMatrixService`, llama a `obtenerMatrizCompleta()`, devuelve resultado.

```php
class ForexCtrl extends BaseCtrl
{
    public function getAllMajorForex()
    {
        $service = new ForexMatrixService();
        return $service->obtenerMatrizCompleta();
    }

    public function getAllCurrencies()
    {
        return (new ForexMdl())->obtenerDivisas();
    }
}
```

Ya no necesita `require_once` de `CacheProveedor.php`, ni propiedad `$forexMdl`, ni las constantes `CHUNK_DELAY_US`/`BASE_DELAY_US` (se mudan al servicio).

### 5.8. CREATE `dto/ActivoDTO.php`

Value Object inmutable que unifica la transformación a `{symbol, name, price, type}` para los tres dominios.

```php
class ActivoDTO
{
    public readonly string $symbol;
    public readonly string $name;
    public readonly string $price;
    public readonly string $type;

    private function __construct(string $symbol, string $name, string $price, string $type)
    {
        $this->symbol = $symbol;
        $this->name = $name;
        $this->price = $price;
        $this->type = $type;
    }

    public static function desdeCripto(array $data): self
    {
        return new self(
            str_replace(['USDT', 'BUSD'], '', $data['symbol']),
            $data['symbol'],
            number_format((float) $data['lastPrice'], 6, '.', ''),
            'crypto'
        );
    }

    public static function desdeForex(string $base, string $currency, float $rate): self
    {
        return new self(
            $base . $currency,
            $base . '/' . $currency,
            number_format($rate, 6, '.', ''),
            'forex'
        );
    }

    public static function desdeIndice(array $data): self
    {
        $price = $data['price'] ?? $data['previousClose'] ?? 0;
        return new self(
            $data['symbol'] ?? '',
            $data['name'] ?? ($data['symbol'] ?? ''),
            number_format((float) $price, 6, '.', ''),
            'indice'
        );
    }

    public function toArray(): array
    {
        return [
            'symbol' => $this->symbol,
            'name'   => $this->name,
            'price'  => $this->price,
            'type'   => $this->type,
        ];
    }
}
```

### 5.9. MODIFY `controladores/CriptoCtrl.php`

Usa `ActivoDTO::desdeCripto()` en lugar de construir el arreglo inline.

```php
class CriptoCtrl extends BaseCtrl
{
    public function getCryptos(): array
    {
        $modelo = new CriptoMdl();
        $ticker = $modelo->obtenerTicker24h();
        $activos = [];
        foreach ($ticker as $crypto) {
            if (str_ends_with($crypto['symbol'], 'USDT') || str_ends_with($crypto['symbol'], 'BUSD')) {
                $activos[] = ActivoDTO::desdeCripto($crypto)->toArray();
            }
        }
        return $activos;
    }
}
```

### 5.10. MODIFY `controladores/IndiceCtrl.php`

Usa `ActivoDTO::desdeIndice()`.

### 5.11. MODIFY `rutas/RuteoCentralizado.php` + `index.php`

Se simplifica el proceso de ruteo:

1. **Los 3 `*Rts.php` se eliminan.** Su lógica se traslada a `index.php` como un mapa de configuración.
2. **`RuteoCentralizado.php`** se actualiza para recibir la acción y el mapa desde `index.php` directamente.
3. **`BaseCtrl::despachar()`** se simplifica: la validación de método HTTP y el parseo de URI suben a `index.php`; `despachar()` solo ejecuta la acción y captura excepciones.

---

## 6. Artefactos afectados (inventario cerrado)

| Path | Acción | Detalle |
|------|--------|---------|
| `modelos/BaseMdl.php` | CREATE | Clase abstracta con patrón caché→API→stale |
| `servicios/ForexMatrixService.php` | CREATE | Servicio de dominio para matriz forex |
| `dto/ActivoDTO.php` | CREATE | Value Object para respuesta unificada |
| `modelos/CriptoMdl.php` | MODIFY | Extiende BaseMdl, solo 5 líneas efectivas |
| `modelos/ForexMdl.php` | MODIFY | Extiende BaseMdl, obtenerTasas usa getCache() |
| `modelos/IndiceMdl.php` | MODIFY | Extiende BaseMdl, solo 5 líneas efectivas |
| `controladores/CriptoCtrl.php` | MODIFY | Usa ActivoDTO::desdeCripto() |
| `controladores/ForexCtrl.php` | MODIFY | Delega en ForexMatrixService |
| `controladores/IndiceCtrl.php` | MODIFY | Usa ActivoDTO::desdeIndice() |
| `controladores/BaseCtrl.php` | MODIFY | `despachar()` simplificado, validación HTTP y parseo URI suben a index.php |
| `rutas/RuteoCentralizado.php` | MODIFY | Acepta acción directamente desde index.php |
| `rutas/CriptoRts.php` | DELETE | Reemplazado por mapa en index.php |
| `rutas/ForexRts.php` | DELETE | Reemplazado por mapa en index.php |
| `rutas/IndiceRts.php` | DELETE | Reemplazado por mapa en index.php |
| `index.php` | MODIFY | Mapa de rutas + validación HTTP + parseo URI |

---

## 7. Contratos públicos preservados

**NO-BREAKING.** Ningún endpoint cambia su ruta, método, entrada, código de éxito ni formato de respuesta.

| Método | Ruta | Código éxito | Formato respuesta |
|--------|------|--------------|-------------------|
| GET | `/rest_divisas/cripto` | 200 | `{"status":"ok","service":"CriptoRTS",...}` |
| GET | `/rest_divisas/cripto/disponible` | 200 | `[{"symbol":"BTC","name":"BTCUSDT","price":"...","type":"crypto"}]` |
| GET | `/rest_divisas/forex` | 200 | `{"status":"ok","service":"ForexRTS",...}` |
| GET | `/rest_divisas/forex/disponible` | 200 | `[{"symbol":"EURUSD","name":"EUR/USD","price":"...","type":"forex"}]` |
| GET | `/rest_divisas/indice` | 200 | `{"status":"ok","service":"IndiceRTS",...}` |
| GET | `/rest_divisas/indice/disponible` | 200 | `[{"symbol":"SPX","name":"S&P 500","price":"...","type":"indice"}]` |

---

## 8. Criterios de aceptación

| ID | Criterio | Verificación |
|----|----------|--------------|
| CA1 | `CriptoCtrl::getCryptos()` retorna exactamente el mismo arreglo que antes del refactor | Comparar JSON de respuesta antes/después |
| CA2 | `ForexCtrl::getAllMajorForex()` retorna exactamente el mismo arreglo | Comparar JSON de respuesta |
| CA3 | `IndiceCtrl::getAllIndices()` retorna exactamente el mismo arreglo | Comparar JSON de respuesta |
| CA4 | Los health-checks de los 3 dominios retornan 200 con `service:"XxxRTS"` | curl GET a cada prefijo |
| CA5 | `BaseMdl::ejecutarConsulta()` retorna datos frescos cuando no hay caché | Inspeccionar flujo con logs |
| CA6 | `BaseMdl::ejecutarConsulta()` retorna datos cacheados cuando existen | Segunda llamada no ejecuta ClienteHttp |
| CA7 | `BaseMdl::ejecutarConsulta()` retorna stale si el proveedor falla y hay caché expirada | Simular fallo de proveedor |
| CA8 | `ForexMatrixService::obtenerMatrizCompleta()` cachea resultado completo con clave `forex_matrix` | Inspeccionar archivo en cache/ |
| CA9 | `BaseCtrl::despachar()` ya no contiene validación HTTP ni parseo de URI | Inspeccionar código |
| CA10 | Ningún `require_once` apunta a archivo eliminado (`*Rts.php`) | grep require_once en todos los .php |
| CA11 | El endpoint `GET /rest_divisas/forex/disponible` sigue tardando los mismos `usleep` por chunk que antes | Medir latencia (misma que pre-refactor) |

---

## 9. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Regresión en formato de respuesta por cambio en `number_format` o nombres de campo | Baja | `ActivoDTO` unifica el formateo; verificar CA1-CA3 con snapshot de respuesta |
| `BaseMdl::getCache()` expone `CacheProveedor` a subclases que podrían abusar de él | Baja | Es `protected`; solo `ForexMdl::obtenerTasas()` lo usa para claves dinámicas |
| Eliminación de `*Rts.php` rompe `require_once` en algún lado | Media | Buscar `require` de `CriptoRts.php`, `ForexRts.php`, `IndiceRts.php` en todo el código; solo existe en `index.php` |
| `ForexMatrixService` no respeta los mismos `usleep` y `chunk_size` | Media | El HLT debe especificar que las constantes se copian textualmente del controlador al servicio |
| Mezcla de `ForexMdl::obtenerTasas()` (caché individual) con `ForexMatrixService` (caché de matriz) produce datos inconsistentes entre sí por diferencia de TTL | Baja | Es el mismo comportamiento actual (RF-005); la caché individual tiene TTL 60s y la de matriz también 60s, así que siempre están sincronizadas dentro de la misma ventana |

---

## 10. Estrategia de implementación

1. **Paso 1** — Crear `modelos/BaseMdl.php` con `ejecutarConsulta()` y `getCache()`.
2. **Paso 2** — Refactorizar `CriptoMdl`, `ForexMdl`, `IndiceMdl` para extender `BaseMdl`.
3. **Paso 3** — Crear `dto/ActivoDTO.php` con factories estáticas.
4. **Paso 4** — Refactorizar `CriptoCtrl` e `IndiceCtrl` para usar `ActivoDTO`.
5. **Paso 5** — Crear `servicios/ForexMatrixService.php` extrayendo lógica de `ForexCtrl`.
6. **Paso 6** — Refactorizar `ForexCtrl` para delegar en `ForexMatrixService`.
7. **Paso 7** — Simplificar `BaseCtrl::despachar()` moviendo validación HTTP y parseo URI a `index.php`.
8. **Paso 8** — Actualizar `RuteoCentralizado.php` y `index.php`, eliminar `*Rts.php`.
9. **Paso 9** — Verificar contratos (CA1-CA11) con peticiones HTTP reales.
10. **Paso 10** — Actualizar `README.md` si la estructura de archivos cambia significativamente.

---

## 11. Rollback

- **Global:** restaurar los 15 archivos modificados/eliminados desde control de versiones.
- **Parcial:** cada paso es reversible individualmente. Los pasos 1-2 (BaseMdl) no rompen nada porque las subclases mantienen sus métodos públicos. Los pasos 5-6 (ForexMatrixService) pueden revertirse volviendo al `ForexCtrl` anterior.
- **Archivos eliminados** (`*Rts.php`): restaurar desde Git.
