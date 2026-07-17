# HLT-RF-005 — Caché y eficiencia en llamadas a proveedores externos de `rest_divisas`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-005_cache_y_eficiencia_proveedores.md`](../rf/RF-005_cache_y_eficiencia_proveedores.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `docs/hlt/HLT-RF-004_seguridad_duplicidad.md`.
> **Servicio afectado:** `rest_divisas`.
> **Versión HLT:** 1.0.0
> **Fecha:** 2026-07-17
>
> **Nota de formato:** este documento contiene **solo indicaciones** (descripciones y tablas). No
> incluye código PHP, cuerpos de método ni comandos de consola literales. El agente implementador
> traduce cada indicación a la sintaxis correspondiente respetando las convenciones del repo. Los
> nombres de clases, métodos, propiedades y constantes se citan como **valores cerrados** de decisión.

---

## Estado del HLT

| Campo | Valor |
|-------|-------|
| **Estado** | `PROPUESTO` |
| Aprobación senior | `PENDIENTE` |
| Fecha de aprobación | — |
| Fecha de cierre | — |

### Reglas de estado (mandatorias)

- El HLT nace en `PROPUESTO`. El agente planificador entrega **todos los checkboxes en `[ ]`**.
- Un senior debe aprobar el HLT antes de que el agente implementador ejecute tarea alguna. Al
  aprobar, cambiar `Aprobación senior` a `APROBADO` y el `Estado` a `EN EJECUCIÓN`.
- El agente implementador **solo** puede cambiar el `Estado` del HLT a **`COMPLETADO`** cuando se
  cumplan **todas** estas condiciones simultáneamente:
  1. **Todas** las tareas `T1`–`T20` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T12`–`T20`) se ejecutaron y su resultado observado **coincide**
     con el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`**.
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`**
  o **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Introducir una capa de caché basada en archivos en `rest_divisas` para que los tres proveedores
externos (Binance, Frankfurter, Financial Modeling Prep) no sean consultados en cada request de
cliente. Rediseñar el endpoint `/forex/disponible` para que su patrón combinatorio de llamadas
(N bases × M destinos) solo ocurra una vez por ventana de TTL y no en cada petición. Implementar
degradación controlada ante fallo del proveedor sirviendo la última copia en caché aunque esté
expirada (`stale-if-error`). No alterar el contrato público de ningún endpoint existente.

---

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en `rest_divisas`:

- **CREATE** `configuracion/CacheProveedor.php` — clase de caché basada en archivos JSON.
- **CREATE** `cache/` + `cache/.htaccess` — directorio de almacenamiento de archivos de caché.
- **MODIFY** `configuracion/global.php` — añadir constantes `CACHE_TTL_CRIPTO`, `CACHE_TTL_FOREX`,
  `CACHE_TTL_INDICE`, `CACHE_DIR`, configurables por variable de entorno.
- **MODIFY** `modelos/CriptoMdl.php` — integrar caché en `obtenerTicker24h()`.
- **MODIFY** `modelos/ForexMdl.php` — integrar caché en `obtenerDivisas()` y `obtenerTasas()`.
- **MODIFY** `modelos/IndiceMdl.php` — integrar caché en `obtenerIndices()`.
- **MODIFY** `controladores/ForexCtrl.php` — cachear el resultado completo de
  `getAllMajorForex()` para que el costo combinatorio solo ocurra una vez por TTL.
- **MODIFY** `.htaccess` — añadir `cache/` a la lista de directorios bloqueados.
- **CREATE** `configuracion/.env.example` (si no existe, ACTUALIZAR; añadir variables de TTL).

---

## 3. Out-of-scope (qué NO entra)

- No se implementa autenticación JWT ni autorización por rol.
- No se implementa rate-limiting por IP/consumidor sobre los endpoints propios.
- No se cambia el contrato de datos de respuesta de ningún endpoint.
- No se introduce Redis, Memcached ni infraestructura externa de caché (solo archivos).
- No se implementa `usleep` nuevo; los existentes en `ForexCtrl` se mantienen porque siguen
  siendo necesarios para respetar el rate-limit de Frankfurter cuando se recalcula la matriz
  completa.
- No se modifican `index.php`, `rutas/`, `controladores/CriptoCtrl.php`,
  `controladores/IndiceCtrl.php` ni `controladores/BaseCtrl.php`.
- No se modifica `configuracion/ClienteHttp.php`.

---

## 4. Impacto en contratos públicos

**NO-BREAKING.** Ningún endpoint cambia su ruta, método, entrada, código de éxito ni contrato de datos.

| Método | Ruta | Entrada | Éxito | Error |
|--------|------|---------|-------|-------|
| GET | `/rest_divisas/cripto` | ninguna | 200 health-check (sin cambios) | 405/502/500 (sin cambios) |
| GET | `/rest_divisas/cripto/disponible` | ninguna | 200 arreglo `{symbol,name,price,type}` (sin cambios) | 502/500 (sin cambios) |
| GET | `/rest_divisas/forex` | ninguna | 200 health-check (sin cambios) | 405/502/500 (sin cambios) |
| GET | `/rest_divisas/forex/disponible` | ninguna | 200 arreglo (sin cambios) | 502/500 (sin cambios) |
| GET | `/rest_divisas/indice` | ninguna | 200 health-check (sin cambios) | 405/502/500 (sin cambios) |
| GET | `/rest_divisas/indice/disponible` | ninguna | 200 arreglo (sin cambios) | 502/500 (sin cambios) |

El único cambio observable es la **reducción de latencia** en endpoints de datos (ahora sirven
desde caché) y la **no regresión a 502** cuando un proveedor falla temporalmente y hay copia
en caché. No hay cambios de contrato.

---

## 5. Compatibilidad

**NO-BREAKING.** Los endpoints y contratos de éxito se preservan. La degradación `stale-if-error`
cambia el comportamiento observable solo cuando antes se respondía 502 y ahora se responde 200
con datos de caché expirada, lo cual es una mejora de disponibilidad, no un breaking change.

---

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Configuración | `configuracion/global.php` | MODIFY (constantes TTL y CACHE_DIR) |
| Configuración | `configuracion/CacheProveedor.php` | CREATE (clase de caché) |
| Infraestructura | `cache/` + `cache/.htaccess` | CREATE |
| Infraestructura | `.htaccess` | MODIFY (bloquear cache/) |
| Modelo | `modelos/CriptoMdl.php` | MODIFY (integrar caché) |
| Modelo | `modelos/ForexMdl.php` | MODIFY (integrar caché) |
| Modelo | `modelos/IndiceMdl.php` | MODIFY (integrar caché) |
| Controlador | `controladores/ForexCtrl.php` | MODIFY (cachear matriz completa) |

Servicio único: `rest_divisas`. No hay cambios en `index.php`, `rutas/`, `BaseCtrl`, `ClienteHttp`.

---

## 7. Delta arquitectónico

### 7.0. Decisiones cerradas de diseño

1. **Mecanismo de caché (A1).** Se crea `configuracion/CacheProveedor.php` con los siguientes
   métodos públicos:
   - `obtener(string $clave): ?array` — retorna los datos cacheados si existen y no han expirado;
     `null` si no existe o expiró.
   - `guardar(string $clave, array $valor, int $ttlSegundos): void` — escribe un archivo JSON en
     `CACHE_DIR` con el contenido `{data: ..., expiresAt: timestamp}`.
   - `obtenerStale(string $clave): ?array` — retorna los datos cacheados **aunque hayan expirado**;
     `null` solo si el archivo no existe. Para `stale-if-error`.
   - Internamente usa `md5($clave)` como nombre de archivo para evitar caracteres inválidos en el
     sistema de archivos. Directorio base: constante `CACHE_DIR` desde `global.php`.

2. **Constantes de TTL en global.php (R2).** Se añaden:
   - `CACHE_TTL_CRIPTO = getenv("CACHE_TTL_CRIPTO") ?: 30` — 30 segundos para cripto.
   - `CACHE_TTL_FOREX = getenv("CACHE_TTL_FOREX") ?: 60` — 60 segundos para forex.
   - `CACHE_TTL_INDICE = getenv("CACHE_TTL_INDICE") ?: 60` — 60 segundos para índices.
   - `CACHE_DIR = __DIR__ . '/../cache'` — directorio de almacenamiento (no variable de entorno
     porque es fijo por servicio; si se necesita cambiar, se añade después).

3. **Caché en modelos (A2).** Cada `*Mdl` crea una instancia de `CacheProveedor` en su constructor.
   Cada método público (`obtenerTicker24h`, `obtenerDivisas`, `obtenerTasas`, `obtenerIndices`)
   sigue este flujo:
   - Construye una clave de caché con el nombre del método y los parámetros relevantes.
   - Consulta `CacheProveedor::obtener($clave)`. Si hay datos vigentes, los retorna sin llamar a
     `ClienteHttp`.
   - Si no hay caché, llama a `ClienteHttp::obtenerJson($url)`.
   - Si la llamada externa tiene éxito, guarda en caché con `CacheProveedor::guardar()` y retorna.
   - Si la llamada externa lanza `ProveedorNoDisponibleException`, intenta
     `CacheProveedor::obtenerStale($clave)`.
     - Si hay datos stale, los retorna y registra en `error_log()`: `"Sirviendo caché stale para
       <clave> por fallo de proveedor"`.
     - Si no hay datos stale, relanza la excepción original (comportamiento actual → 502).

4. **Caché de matriz completa de Forex (A3).** `ForexCtrl::getAllMajorForex()` crea una instancia
   de `CacheProveedor` y consulta la clave fija `"forex_matrix"`. Si hay datos cacheados, los
   retorna directamente sin ejecutar el algoritmo combinatorio. Si no hay, ejecuta el algoritmo
   completo (con sus `usleep`), guarda el resultado en caché con `CACHE_TTL_FOREX` y lo retorna.
   Así, el costo N×M solo ocurre una vez por ventana de TTL, no por cada request de cliente.

5. **Claves de caché (R5).** Las claves no incluyen URLs completas ni API keys. Ejemplos:
   - Cripto: `"obtenerTicker24h"`
   - Forex divisas: `"obtenerDivisas"`
   - Forex tasas: `"obtenerTasas_" . md5($base . "_" . $destinosCsv)`
   - Índices: `"obtenerIndices"`
   - Matriz forex completa: `"forex_matrix"`

6. **usleep se conserva (A6).** Los `usleep` en `ForexCtrl` se mantienen porque la matriz completa
   se recalcula periódicamente (cada `CACHE_TTL_FOREX` segundos). Los `usleep` siguen siendo
   necesarios para no saturar a Frankfurter durante el recálculo.

7. **Bloqueo de `cache/`.** Se añade `cache` a la regla `RewriteRule` de bloqueo de directorios
   en `.htaccess`. El directorio `cache/` lleva su propio `.htaccess` con `Require all denied`.

### 7.1. Tabla de Delta

| Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
|------|---------------------------|--------|-----------------|
| Config | `configuracion/global.php` | MODIFY | Añadir `CACHE_TTL_CRIPTO`, `CACHE_TTL_FOREX`, `CACHE_TTL_INDICE`, `CACHE_DIR` con getenv+default. |
| Config | `configuracion/CacheProveedor.php` | CREATE | Clase con `obtener()`, `guardar()`, `obtenerStale()`. Caché en archivos JSON. |
| Infra | `cache/` + `cache/.htaccess` | CREATE | Directorio con `.htaccess` de denegación. |
| Infra | `.htaccess` | MODIFY | Añadir `cache` a la lista de directorios bloqueados. |
| Modelo | `modelos/CriptoMdl.php` | MODIFY | Integrar `CacheProveedor` en `obtenerTicker24h()` con TTL `CACHE_TTL_CRIPTO` y `stale-if-error`. |
| Modelo | `modelos/ForexMdl.php` | MODIFY | Integrar `CacheProveedor` en `obtenerDivisas()` y `obtenerTasas()` con TTL `CACHE_TTL_FOREX` y `stale-if-error`. |
| Modelo | `modelos/IndiceMdl.php` | MODIFY | Integrar `CacheProveedor` en `obtenerIndices()` con TTL `CACHE_TTL_INDICE` y `stale-if-error`. |
| Controlador | `controladores/ForexCtrl.php` | MODIFY | En `getAllMajorForex()`, cachear resultado completo con clave `forex_matrix` y TTL `CACHE_TTL_FOREX`. |

### 7.2. Cadena de dependencias `require_once`

- `CacheProveedor.php` requiere `global.php` (para `CACHE_DIR`).
- `CriptoMdl.php` requiere `CacheProveedor.php` (nuevo), además de `ClienteHttp.php` y `global.php`.
- `ForexMdl.php` requiere `CacheProveedor.php` (nuevo), además de `ClienteHttp.php` y `global.php`.
- `IndiceMdl.php` requiere `CacheProveedor.php` (nuevo), además de `ClienteHttp.php` y `global.php`.
- `ForexCtrl.php` requiere `CacheProveedor.php` (nuevo), además de `BaseCtrl.php` y `ForexMdl.php`.

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción |
|---------------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/global.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/CacheProveedor.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/cache/` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/cache/.htaccess` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/.htaccess` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/CriptoMdl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/ForexMdl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/IndiceMdl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/ForexCtrl.php` | MODIFY |

---

## 9. Estrategia de validación

Cada comprobación es una tarea con checkbox (T12–T20) en §12. Las verificaciones sobre HTTP asumen
Apache sirviendo el servicio en `http://localhost/rest_divisas/`; las verificaciones sobre el código
inspeccionan los archivos del servicio.

- **CacheProveedor (A1):** inspeccionar `CacheProveedor.php`; confirmar que tiene los tres métodos
  públicos (`obtener`, `guardar`, `obtenerStale`) y que usa archivos JSON en el directorio `CACHE_DIR`.
- **global.php (A1/A2):** inspeccionar; confirmar que existen `CACHE_TTL_CRIPTO`, `CACHE_TTL_FOREX`,
  `CACHE_TTL_INDICE`, `CACHE_DIR`.
- **Modelos (A2/A5):** inspeccionar cada `*Mdl`; confirmar que cada método consulta caché primero,
  que guarda tras éxito externo, y que hace `stale-if-error` ante excepción.
- **ForexCtrl (A3):** inspeccionar `ForexCtrl::getAllMajorForex()`; confirmar que cachea el resultado
  completo con clave `forex_matrix`.
- **cache/ (A1):** verificar que el directorio `cache/` existe con `.htaccess` de protección.
- **.htaccess:** verificar que `cache` está en la lista de directorios bloqueados.
- **Sin regresión HTTP:** solicitar health-check y datos de los tres dominios; confirmar 200.
- **Comprobación de caché:** solicitar dos veces seguidas el mismo endpoint de datos; verificar
  que la segunda responde sin llamada externa (medible por latencia o logs).

---

## 10. Riesgos

- **Archivos de caché ocupando espacio en disco.** Cada archivo es pequeño (< 1 MB) y se sobrescribe.
  *Mitigación:* TTLs cortos (30-60 s) mantienen pocos archivos; si crece, se puede implementar
  limpieza periódica como mejora futura.
- **Concurrencia en escritura de caché.** Dos requests simultáneos pueden escribir el mismo archivo.
  *Mitigación:* el sistema de archivos maneja escritura atómica en Linux para archivos < 4 KB;
  el riesgo es una escritura corrupta transitoria que el siguiente request sobrescribirá.
- **Stale-if-error puede ocultar fallos reales.** Si el proveedor falla permanentemente, el servicio
  sirve datos viejos indefinidamente. *Mitigación:* el error se registra con `error_log()` y el
  TTL acotado (30-60 s) limita la ventana de datos obsoletos; si el provider sigue caído más allá
  del TTL, el endpoint caerá a 502.
- **Archivos de caché en `cache/` expuestos si se deshabilita `.htaccess`.** *Mitigación:* el
  directorio tiene su propio `.htaccess` con `Require all denied`.

---

## 11. Rollback

- **Global:** restaurar `global.php`, los tres `*Mdl`, `ForexCtrl.php` y `.htaccess` desde control
  de versiones. Eliminar `configuracion/CacheProveedor.php`, `cache/` completo.
- **Por artefacto:** revertir cada archivo a su versión previa; eliminar directorios/archivos
  creados.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` =
> realizado y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado, con razón. Un
> checkbox = una acción verificable. El agente implementador **actualiza cada checkbox al completar y
> verificar** la tarea, y solo entonces. Todos se entregan en `[ ]`. Orden por capa:
> Config → Infraestructura → Modelo → Controlador → validaciones.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_divisas` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/` |
| Front controller | `index.php` (mapa `$rutas` + `str_starts_with` de prefijo) |
| Capa de datos | APIs externas (Binance, Frankfurter, Financial Modeling Prep) vía `ClienteHttp` |
| Capa de respuesta | `controladores/BaseCtrl.php` (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`) |
| Configuración | `configuracion/global.php` (constantes: URLs base, FMP_API_KEY, CORS_ORIGIN, APP_VERSION, CACHE_TTL_*) |
| Mecanismo de caché | Archivos JSON en `cache/` (creado en este RF) |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `GET http://localhost/rest_divisas/cripto` (200, `service:"CriptoRTS"`) |
| Logs | `logs/php_errors.log` del servicio |
| Nota importante | El directorio `cache/` debe tener permisos de escritura para el usuario de Apache. |

### Grupo A — Configuración

- `[ ]` **T1** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/global.php` | MODIFY
  - Delta: Añadir al final del archivo las constantes:
    - `define("CACHE_TTL_CRIPTO", getenv("CACHE_TTL_CRIPTO") ?: 30);`
    - `define("CACHE_TTL_FOREX", getenv("CACHE_TTL_FOREX") ?: 60);`
    - `define("CACHE_TTL_INDICE", getenv("CACHE_TTL_INDICE") ?: 60);`
    - `define("CACHE_DIR", __DIR__ . '/../cache');`
  - Insert after: última línea del archivo (`define("APP_VERSION", ...)`)
  - Note: El valor por defecto de CACHE_TTL_FOREX (60 s) debe ser > tiempo de recálculo completo de la matriz.

- `[ ]` **T2** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/CacheProveedor.php` | CREATE
  - Delta: Clase `CacheProveedor` con:
    - `require_once(__DIR__ . '/global.php')`
    - Constructor que usa `CACHE_DIR` como directorio base; si no existe, lo crea con `mkdir()`.
    - Método `obtener(string $clave): ?array`: Lee archivo `CACHE_DIR/md5($clave).json`. Si el archivo no existe, retorna `null`. Si `expiresAt` < `time()`, retorna `null`. Si es vigente, retorna `data`.
    - Método `guardar(string $clave, array $valor, int $ttlSegundos): void`: Escribe `{"data": <valor>, "expiresAt": <time()+ttl>}` en `CACHE_DIR/md5($clave).json` con `json_encode($contenido, JSON_UNESCAPED_UNICODE)`.
    - Método `obtenerStale(string $clave): ?array`: Igual que `obtener()` pero **sin** comprobar expiración. Retorna `null` solo si el archivo no existe.
  - Note: Los archivos JSON usan `JSON_UNESCAPED_UNICODE`. No exponer rutas en logs.

### Grupo B — Infraestructura

- `[ ]` **T3** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/cache/` + `cache/.htaccess` | CREATE
  - Delta: Crear directorio `cache/` y dentro un `.htaccess` con `Require all denied`.
  - Note: El directorio debe tener permisos de escritura para el usuario de Apache.

- `[ ]` **T4** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/.htaccess` | MODIFY
  - Delta: En la regla `RewriteRule` de bloqueo de directorios, añadir `cache` a la lista (`...|logs|vistas|cache)(/.*)?$ - [F,L]`).
  - Insert after: la línea existente del `RewriteRule` de bloqueo (buscar el patrón `configuracion|rutas|modelos|controladores|logs|vistas`).
  - Note: No modificar ninguna otra línea del `.htaccess`.

### Grupo C — Modelos

- `[ ]` **T5** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/CriptoMdl.php` | MODIFY
  - Delta:
    1. Añadir `require_once(__DIR__ . '/../configuracion/CacheProveedor.php')`.
    2. En el constructor, crear `$this->cache = new CacheProveedor()`.
    3. En `obtenerTicker24h()`:
       - Clave de caché: `"obtenerTicker24h"`.
       - Primero consultar `$this->cache->obtener($clave)`. Si hay datos, retornarlos.
       - Si no, llamar a `ClienteHttp::obtenerJson($url)`.
       - Si éxito, `$this->cache->guardar($clave, $data, CACHE_TTL_CRIPTO)` y retornar.
       - Si `ProveedorNoDisponibleException`, intentar `$this->cache->obtenerStale($clave)`.
         - Si hay stale, `error_log("Sirviendo caché stale para $clave por fallo de proveedor")` y retornarlo.
         - Si no, relanzar la excepción.
  - Insert after: después del `require_once` existente.
  - Note: La clave de caché no incluye URLs ni API keys.

- `[ ]` **T6** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/ForexMdl.php` | MODIFY
  - Delta:
    1. Añadir `require_once(__DIR__ . '/../configuracion/CacheProveedor.php')`.
    2. En el constructor, crear `$this->cache = new CacheProveedor()`.
    3. En `obtenerDivisas()`:
       - Clave: `"obtenerDivisas"`.
       - Misma lógica de caché + stale-if-error que T5, usando `CACHE_TTL_FOREX`.
    4. En `obtenerTasas(string $base, string $destinosCsv)`:
       - Clave: `"obtenerTasas_" . md5($base . "_" . $destinosCsv)`.
       - Misma lógica de caché + stale-if-error, usando `CACHE_TTL_FOREX`.
  - Insert after: después del `require_once` existente.

- `[ ]` **T7** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/IndiceMdl.php` | MODIFY
  - Delta:
    1. Añadir `require_once(__DIR__ . '/../configuracion/CacheProveedor.php')`.
    2. En el constructor, crear `$this->cache = new CacheProveedor()`.
    3. En `obtenerIndices()`:
       - Clave: `"obtenerIndices"`.
       - Misma lógica de caché + stale-if-error que T5, usando `CACHE_TTL_INDICE`.
  - Insert after: después del `require_once` existente.

### Grupo D — Controladores

- `[ ]` **T8** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/ForexCtrl.php` | MODIFY
  - Delta:
    1. Añadir `require_once(__DIR__ . '/../configuracion/CacheProveedor.php')`.
    2. En el método `getAllMajorForex()`, antes de ejecutar el algoritmo combinatorio:
       - Crear `$cache = new CacheProveedor()`.
       - Consultar `$cache->obtener("forex_matrix")`. Si hay datos, retornarlos directamente.
       - Si no, ejecutar el algoritmo completo (existente).
       - Después de obtener `$forex_data`, guardar: `$cache->guardar("forex_matrix", $forex_data, CACHE_TTL_FOREX)`.
       - Retornar `$forex_data`.
  - Insert after: línea del `require_once(__DIR__ . '/../modelos/ForexMdl.php')`.
  - Note: Los `usleep` existentes se conservan. No hay cambios en `getAllCurrencies()`.

### Grupo E — Validaciones

- `[ ]` **T9** | Validación — `CacheProveedor.php` — Inspeccionar el archivo.
  **Esperado:** Clase `CacheProveedor` con métodos `obtener()`, `guardar()`, `obtenerStale()`. Usa `CACHE_DIR` y archivos JSON con `md5` de clave.

- `[ ]` **T10** | Validación — `global.php` — Inspeccionar constantes de TTL.
  **Esperado:** Existen `CACHE_TTL_CRIPTO`, `CACHE_TTL_FOREX`, `CACHE_TTL_INDICE`, `CACHE_DIR`. Todas con `getenv()` + valor por defecto.

- `[ ]` **T11** | Validación — directorio `cache/` y `.htaccess` — Verificar existencia.
  **Esperado:** `cache/` existe, tiene `.htaccess` con `Require all denied`. `.htaccess` del servicio incluye `cache` en el bloqueo de directorios.

- `[ ]` **T12** | Validación — modelos con caché — Inspeccionar los tres `*Mdl.php`.
  **Esperado:** Cada método (`obtenerTicker24h`, `obtenerDivisas`, `obtenerTasas`, `obtenerIndices`) consulta caché primero, guarda tras éxito externo, y hace `stale-if-error` ante `ProveedorNoDisponibleException`.

- `[ ]` **T13** | Validación — `ForexCtrl` con caché de matriz — Inspeccionar `ForexCtrl.php`.
  **Esperado:** `getAllMajorForex()` consulta clave `"forex_matrix"` al inicio y cachea el resultado completo al final.

- `[ ]` **T14** | Validación — sin regresión health-check — Solicitar `GET /rest_divisas/cripto`, `GET /rest_divisas/forex`, `GET /rest_divisas/indice`.
  **Esperado:** 200 con `service:"CriptoRTS"`/`"ForexRTS"`/`"IndiceRTS"`.

- `[ ]` **T15** | Validación — sin regresión datos — Solicitar `GET /rest_divisas/cripto/disponible`, `GET /rest_divisas/forex/disponible`, `GET /rest_divisas/indice/disponible`.
  **Esperado:** 200 con arreglo de `{symbol,name,price,type}`.

- `[ ]` **T16** | Validación — comprobación de caché en cripto — Solicitar dos veces seguidas `GET /rest_divisas/cripto/disponible`.
  **Esperado:** Ambas responden 200. La segunda es sensiblemente más rápida (sirve desde caché, sin llamada externa). Verificar en logs que no hay error.

- `[ ]` **T17** | Validación — comprobación de caché en índices — Solicitar dos veces seguidas `GET /rest_divisas/indice/disponible`.
  **Esperado:** Ídem T16.

- `[ ]` **T18** | Validación — comprobación de caché en forex — Solicitar dos veces seguidas `GET /rest_divisas/forex/disponible`.
  **Esperado:** Ídem T16.

- `[ ]` **T19** | Validación — stale-if-error (simulado) — Verificar que `ForexMdl::obtenerTasas()` (o cualquier método) primero obtiene datos exitosamente (se guarda en caché), luego se simula fallo del proveedor y se vuelve a llamar.
  **Esperado:** La segunda llamada retorna los datos cacheados (stale) en lugar de lanzar excepción. Confirmar que `error_log` registra "Sirviendo caché stale para ... por fallo de proveedor".

- `[ ]` **T20** | Validación — stale-if-error sin datos previos (caso borde) — Verificar que si no existe caché y el proveedor falla, se lanza `ProveedorNoDisponibleException` (502). Comportamiento actual preservado.
  **Esperado:** 502 con `{"error":"El proveedor de datos no está disponible"}`.

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 20
- Completadas [X]: _(pendiente)_
- Bloqueadas [BLOCKED]: _(pendiente)_
- Omitidas: _(pendiente)_

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | configuracion/global.php |  |
| T2 |  | configuracion/CacheProveedor.php |  |
| T3 |  | cache/ + cache/.htaccess |  |
| T4 |  | .htaccess |  |
| T5 |  | modelos/CriptoMdl.php |  |
| T6 |  | modelos/ForexMdl.php |  |
| T7 |  | modelos/IndiceMdl.php |  |
| T8 |  | controladores/ForexCtrl.php |  |
| T9 |  | (validación) |  |
| T10 |  | (validación) |  |
| T11 |  | (validación) |  |
| T12 |  | (validación) |  |
| T13 |  | (validación) |  |
| T14 |  | (validación) |  |
| T15 |  | (validación) |  |
| T16 |  | (validación) |  |
| T17 |  | (validación) |  |
| T18 |  | (validación) |  |
| T19 |  | (validación) |  |
| T20 |  | (validación) |  |

### Validaciones ejecutadas

| ID | Comando exacto ejecutado | Salida / HTTP observado | Esperado | ¿Coincide? |
|----|--------------------------|-------------------------|----------|------------|
|    |                          |                         |          |            |

### Blockers
- _(descripción del bloqueo, tarea afectada y qué se necesita para desbloquear)_

### Archivos cambiados
- _(path absoluto — CREATE|MODIFY|DELETE — resumen de una línea)_

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas se ejecutaron y su resultado quedó registrado.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T20 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
