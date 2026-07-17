# HLT-RF-006 — Código limpio y DDD: responsabilidad única y eliminación de redundancia en `rest_divisas`

> **Artefacto:** HLT (High-Level Technical Contract).
> **Requerimiento origen:** [`docs/rf/RF-006_clean_code_ddd.md`](../rf/RF-006_clean_code_ddd.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Servicio afectado:** `rest_divisas`.
> **Versión HLT:** 1.0.0
> **Fecha:** 2026-07-17.
>
> **Nota de formato:** este documento contiene **solo indicaciones** (descripciones y tablas). No
> incluye código PHP, cuerpos de método ni comandos de consola literales. El agente implementador
> traduce cada indicación a la sintaxis correspondiente respetando las convenciones del repo.

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
  cumplan **todas** las condiciones del §"Reglas de estado".
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`**.
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`**
  o **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Refactorizar el servicio `rest_divisas` para eliminar la alta redundancia estructural (~35-40% del
código duplicado) aplicando principios de Código Limpio y Diseño Guiado por Dominio (DDD):

1. **Unificar el patrón de modelo** — los tres `*Mdl` comparten ~80% de código idéntico (constructor,
   flujo caché→API→stale-if-error). Se extrae a una clase base abstracta `BaseMdl`.
2. **Extraer la lógica de matriz forex** — `ForexCtrl::getAllMajorForex()` concentra 4
   responsabilidades (caché, algoritmo combinatorio, rate-limiting, transformación DTO). Se extrae a
   un servicio de dominio `ForexMatrixService`.
3. **Unificar la transformación a DTO** — el formateo `{symbol, name, price, type}` se repite en los
   3 controladores. Se crea un Value Object `ActivoDTO`.
4. **Separar responsabilidades de `BaseCtrl::despachar()`** — actualmente mezcla validación de método
   HTTP, parseo de URI, health-check, mapeo de acciones, ejecución y manejo de excepciones. Se sube
   la validación HTTP y el parseo URI a `index.php`.
5. **Eliminar los 3 `*Rts.php` redundantes** — son archivos de 5 líneas estructuralmente idénticos que
   solo pasan 4 argumentos a `ejecutarRuteo()`. Su mapa se fusiona en `index.php`.

Ningún endpoint cambia su ruta, método, código de estado, entrada, salida JSON ni comportamiento
observable. El único cambio observable es la reducción de ~200 líneas de código duplicado y la
mejora en mantenibilidad.

---

## 2. Scope (alcance)

Lista cerrada de dominios y artefactos afectados dentro de `rest_divisas`:

**Dominios afectados:** cripto (`/cripto`), forex (`/forex`), índices (`/indice`).

**CREATE:**
- `modelos/BaseMdl.php` — clase abstracta con patrón caché→API→stale-if-error.
- `servicios/ForexMatrixService.php` — servicio de dominio con la lógica de matriz forex.
- `dto/ActivoDTO.php` — Value Object con factories estáticas para los 3 dominios.

**MODIFY:**
- `modelos/CriptoMdl.php` — refactorizar para extender `BaseMdl`.
- `modelos/ForexMdl.php` — refactorizar para extender `BaseMdl`; `obtenerTasas()` usa `getCache()`.
- `modelos/IndiceMdl.php` — refactorizar para extender `BaseMdl`.
- `controladores/CriptoCtrl.php` — usar `ActivoDTO` en lugar de arreglo inline.
- `controladores/ForexCtrl.php` — delegar en `ForexMatrixService`; eliminar caché y algoritmo propio.
- `controladores/IndiceCtrl.php` — usar `ActivoDTO` en lugar de arreglo inline.
- `controladores/BaseCtrl.php` — simplificar `despachar()`: eliminar validación HTTP y parseo URI.
- `rutas/RuteoCentralizado.php` — actualizar para recibir parámetros directos desde `index.php`.
- `index.php` — incorporar mapa de rutas, validación HTTP, parseo URI, health-check.

**DELETE:**
- `rutas/CriptoRts.php`
- `rutas/ForexRts.php`
- `rutas/IndiceRts.php`

---

## 3. Out-of-scope

Qué NO entra en este HLT:

- No se crea `composer.json` ni se implementa autoloading PSR-4. Los `require_once` con rutas
  relativas se mantienen como mecanismo de carga.
- No se introducen namespaces PHP. Todas las clases permanecen en el espacio global.
- No se renombran carpetas existentes (`configuracion/`, `rutas/`, `controladores/`, `modelos/`).
  Las nuevas carpetas `servicios/` y `dto/` se crean al mismo nivel que las existentes.
- No se modifica `configuracion/ClienteHttp.php`, `configuracion/global.php`,
  `configuracion/CacheProveedor.php`, `configuracion/CorsConfig.php`,
  `configuracion/ProveedorNoDisponibleException.php`.
- No se toca `.htaccess`, `vistas/`, `errors/`, `logs/`, `cache/`, `README.md`.
- No se modifican los endpoints de health-check existentes.
- No se cambian los valores de `usleep`, `chunk_size` ni constantes de delay.
- No se introducen pruebas PHPUnit (queda como trabajo futuro según `CLAUDE.md`).
- No se modifica el comportamiento observable de ningún endpoint (ver §4 y §5).

---

## 4. Impacto en contratos públicos

**NO-BREAKING.** Ningún endpoint cambia su ruta, método HTTP, entrada, código de éxito, cuerpo de
respuesta ni código de error. La tabla siguiente verifica que cada prefijo y acción se preserva
idéntica:

| Método | Ruta | Entrada | Código éxito | Formato respuesta | Código error |
|--------|------|---------|-------------|-------------------|-------------|
| GET | `/rest_divisas/cripto` | ninguna | 200 | `{"status":"ok","timestamp":"...","version":"...","service":"CriptoRTS"}` | 405/502/500 |
| GET | `/rest_divisas/cripto/disponible` | ninguna | 200 | `[{"symbol":"BTC","name":"BTCUSDT","price":"12345.678900","type":"crypto"}]` | 502/500 |
| GET | `/rest_divisas/forex` | ninguna | 200 | `{"status":"ok","timestamp":"...","version":"...","service":"ForexRTS"}` | 405/502/500 |
| GET | `/rest_divisas/forex/disponible` | ninguna | 200 | `[{"symbol":"EURUSD","name":"EUR/USD","price":"1.123456","type":"forex"}]` | 502/500 |
| GET | `/rest_divisas/indice` | ninguna | 200 | `{"status":"ok","timestamp":"...","version":"...","service":"IndiceRTS"}` | 405/502/500 |
| GET | `/rest_divisas/indice/disponible` | ninguna | 200 | `[{"symbol":"SPX","name":"S&P 500","price":"4500.123456","type":"indice"}]` | 502/500 |

**Preservación de claves en la respuesta de datos:** todo activo contiene exactamente 4 claves:
`symbol` (string), `name` (string), `price` (string con 6 decimales), `type` (string). El valor de
`type` se preserva: `"crypto"` para cripto, `"forex"` para forex, `"indice"` para índices.

**Preservación de claves en health-check:** `status` (string), `timestamp` (string ISO 8601),
`version` (string), `service` (string con sufijo `RTS`).

**Preservación de errores:**
- `ProveedorNoDisponibleException` → HTTP 502 con `{"error":"El proveedor de datos no está disponible"}`
- `Throwable` genérico → HTTP 500 con `{"error":"Error interno del servidor"}`
- Método no GET → HTTP 405 con `{"error":"Método no permitido"}`
- Acción no registrada → HTTP 404 con `{"error":"Acción no encontrada"}`

---

## 5. Compatibilidad

**NO-BREAKING.** Los endpoints y contratos de éxito se preservan exactamente. El refactor es
puramente estructural: se extraen clases, se unifican patrones, se eliminan archivos redundantes.
No hay cambio en:

- Rutas o prefijos de URI.
- Métodos HTTP aceptados.
- Validaciones de entrada.
- Formato, campos o tipos de la respuesta JSON.
- Códigos de estado HTTP.
- Mensajes de error.
- Política de caché (TTLs, stale-if-error).
- Delays y rate-limiting (mismos `usleep`, mismo `chunk_size`).

Cualquier cliente (SPA Ionic/Angular en `http://localhost:8100`) que consuma estos endpoints hoy
seguirá funcionando sin modificación tras el refactor.

---

## 6. Placement arquitectónico

| Capa DDD | Carpeta en repo | Cambio |
|----------|----------------|--------|
| Infraestructura (base) | `modelos/BaseMdl.php` | CREATE — clase abstracta con patrón caché→API→stale |
| Infraestructura (modelos) | `modelos/CriptoMdl.php` | MODIFY — extiende BaseMdl, delega en ejecutarConsulta() |
| Infraestructura (modelos) | `modelos/ForexMdl.php` | MODIFY — extiende BaseMdl, obtenerTasas() usa getCache() |
| Infraestructura (modelos) | `modelos/IndiceMdl.php` | MODIFY — extiende BaseMdl, delega en ejecutarConsulta() |
| Dominio (servicio) | `servicios/ForexMatrixService.php` | CREATE — lógica de matriz forex con caché y rate-limiting |
| Dominio (DTO) | `dto/ActivoDTO.php` | CREATE — Value Object con factories estáticas |
| Aplicación (controladores) | `controladores/CriptoCtrl.php` | MODIFY — usa ActivoDTO |
| Aplicación (controladores) | `controladores/ForexCtrl.php` | MODIFY — delega en ForexMatrixService |
| Aplicación (controladores) | `controladores/IndiceCtrl.php` | MODIFY — usa ActivoDTO |
| Aplicación (base) | `controladores/BaseCtrl.php` | MODIFY — despachar() simplificado |
| Infraestructura (transporte) | `rutas/RuteoCentralizado.php` | MODIFY — recibe parámetros desde index.php |
| Infraestructura (front controller) | `index.php` | MODIFY — incorpora mapa de rutas, validación HTTP, parseo URI |
| Infraestructura (transporte) | `rutas/CriptoRts.php` | DELETE |
| Infraestructura (transporte) | `rutas/ForexRts.php` | DELETE |
| Infraestructura (transporte) | `rutas/IndiceRts.php` | DELETE |

---

## 7. Delta arquitectónico

### 7.0. Decisiones cerradas de diseño

1. **BaseMdl (heredero de la capa de datos).** Clase abstracta en `modelos/BaseMdl.php`. Define:
   - Constructor que crea `CacheProveedor` internamente (mismo patrón que los modelos actuales).
   - `getCache()` protegido que retorna la instancia de `CacheProveedor` para que subclases con
     claves dinámicas (`ForexMdl::obtenerTasas()`) puedan usarla.
   - `ejecutarConsulta()` protegido que implementa el flujo: `obtener()` → si hay caché, retornar;
     si no, `ClienteHttp::obtenerJson(url)` → si éxito, `guardar()` y retornar; si
     `ProveedorNoDisponibleException`, intentar `obtenerStale()`, si hay stale registrarlo en
     `error_log()` y retornarlo, si no relanzar.
   - Tres métodos abstractos que cada subclase debe implementar:
     - `obtenerClaveCache(): string` — clave fija para la caché.
     - `obtenerUrl(): string` — URL completa del API externa.
     - `obtenerTtlCache(): int` — TTL desde constante de `global.php`.
   - `require_once` de `global.php` y `CacheProveedor.php`.

2. **CriptoMdl (simplificado).** Extiende `BaseMdl`. Solo implementa los 3 métodos abstractos y un
   método público `obtenerTicker24h(): array` que delega en `$this->ejecutarConsulta()`.
   - `obtenerClaveCache()` retorna `"obtenerTicker24h"`.
   - `obtenerUrl()` retorna `BINANCE_BASE_URL . "/ticker/24hr"`.
   - `obtenerTtlCache()` retorna `CACHE_TTL_CRIPTO`.
   - Se elimina el constructor manual.
   - Se elimina el `require_once` de `ClienteHttp.php` (lo resuelve `BaseMdl`).

3. **IndiceMdl (simplificado).** Extiende `BaseMdl`. Mismo patrón que CriptoMdl.
   - `obtenerClaveCache()` retorna `"obtenerIndices"`.
   - `obtenerUrl()` retorna `FMP_BASE_URL . "/quotes/index?apikey=" . urlencode(FMP_API_KEY)`.
   - `obtenerTtlCache()` retorna `CACHE_TTL_INDICE`.
   - Método público `obtenerIndices(): array` que delega en `$this->ejecutarConsulta()`.

4. **ForexMdl (simplificado parcial).** Extiende `BaseMdl`.
   - `obtenerDivisas()` usa `ejecutarConsulta()` como los otros modelos (clave `"obtenerDivisas"`,
     URL `FRANKFURTER_BASE_URL . "/currencies"`, TTL `CACHE_TTL_FOREX`).
   - `obtenerTasas(string $base, string $destinosCsv)` **no** puede usar `ejecutarConsulta()` porque
     necesita parámetros dinámicos. En su lugar:
     - Construye clave: `"obtenerTasas_" . md5($base . "_" . $destinosCsv)`.
     - Obtiene `$this->getCache()` para acceder al `CacheProveedor`.
     - Implementa localmente el mismo patrón (obtener→caché→guardar→stale) que `ejecutarConsulta()`.
     - URL: `FRANKFURTER_BASE_URL . "/latest?from=" . urlencode($base) . "&to=" . urlencode($destinosCsv)`.
     - TTL: `CACHE_TTL_FOREX`.

5. **ForexMatrixService (servicio de dominio).** Nueva clase en `servicios/ForexMatrixService.php`.
   - `require_once` de `modelos/ForexMdl.php` y `configuracion/CacheProveedor.php`.
   - Define dos constantes de clase: `CHUNK_DELAY_US = 50000` y `BASE_DELAY_US = 150000` (mismos
     valores que hoy en `ForexCtrl`).
   - Método público `obtenerMatrizCompleta(): array` que:
     a. Crea `CacheProveedor` y consulta clave `"forex_matrix"`. Si hay datos vigentes, los retorna.
     b. Crea `ForexMdl` y llama a `obtenerDivisas()`.
     c. Si no hay divisas, retorna arreglo vacío.
     d. Arma la matriz de pares con chunking (chunk_size=20), iterando cada base sobre los destinos.
     e. Por cada chunk, llama a `obtenerTasas(base, targets_string)` atrapando
        `ProveedorNoDisponibleException`, registrando en `error_log()` y continuando.
     f. Si el chunk retorna con `rates` válido, construye pares con `symbol`, `name`, `price` (6
        decimales), `type` = `"forex"`.
     g. Aplica `usleep(CHUNK_DELAY_US)` tras cada chunk y `usleep(BASE_DELAY_US)` tras cada base.
     h. Tras completar la matriz, guarda en caché con clave `"forex_matrix"` y TTL `CACHE_TTL_FOREX`.
     i. Retorna el arreglo de pares.

6. **ActivoDTO (Value Object).** Nueva clase en `dto/ActivoDTO.php`.
   - Cuatro propiedades públicas de solo lectura (`readonly`): `symbol` (string), `name` (string),
     `price` (string), `type` (string).
   - Constructor privado que asigna las 4 propiedades.
   - Factory estática `desdeCripto(array $data): self`:
     - Extrae `symbol` = mismo que el campo `symbol` del dato (sin sufijo).
     - `name` = `data['symbol']` completo (ej. "BTCUSDT").
     - `price` = `number_format((float) $data['lastPrice'], 6, '.', '')` convertido a string.
     - `type` = `"crypto"`.
   - Factory estática `desdeForex(string $base, string $currency, float $rate): self`:
     - `symbol` = `$base . $currency`.
     - `name` = `$base . '/' . $currency`.
     - `price` = `number_format($rate, 6, '.', '')` convertido a string.
     - `type` = `"forex"`.
   - Factory estática `desdeIndice(array $data): self`:
     - `price` = `$data['price']` si existe, si no `$data['previousClose']` si existe, si no 0.
     - `symbol` = `$data['symbol']` si existe, si no cadena vacía.
     - `name` = `$data['name']` si existe, si no el mismo `symbol`.
     - `price` = `number_format((float) $price, 6, '.', '')` convertido a string.
     - `type` = `"indice"`.
   - Método público `toArray(): array` que retorna `['symbol'=>..., 'name'=>..., 'price'=>..., 'type'=>...]`.

7. **ForexCtrl (simplificado).**
   - Eliminar propiedad `$forexMdl` y su constructor (ya no se necesita instanciar `ForexMdl`).
   - `getAllMajorForex()` crea `new ForexMatrixService()` y retorna `$service->obtenerMatrizCompleta()`.
   - `getAllCurrencies()` crea `new ForexMdl()` directamente y retorna `obtenerDivisas()`.
   - Eliminar constantes `CHUNK_DELAY_US` y `BASE_DELAY_US` (se mudan al servicio).
   - Eliminar `require_once` de `CacheProveedor.php`.

8. **CriptoCtrl (simplificado).**
   - En `getCryptos()`, reemplazar la construcción inline del arreglo por `ActivoDTO::desdeCripto($crypto)->toArray()`.
   - Eliminar propiedad `$criptoMdl` y su constructor; instanciar `new CriptoMdl()` dentro del método.
   - Misma lógica de filtrado: solo pares que terminan en `USDT` o `BUSD`.

9. **IndiceCtrl (simplificado).**
   - En `getAllIndices()`, reemplazar la construcción inline del arreglo por `ActivoDTO::desdeIndice($item)->toArray()`.
   - Misma lógica de filtrado: si no existen `symbol` y `price`, continuar.
   - Eliminar propiedad `$indiceMdl` y su constructor; instanciar `new IndiceMdl()` dentro del método.

10. **BaseCtrl::despachar() (simplificado).**
    - Eliminar la validación `if ($_SERVER['REQUEST_METHOD'] !== 'GET')` → sube a `index.php`.
    - Eliminar el parseo de URI y extracción de `$accion` → sube a `index.php`.
    - Eliminar el health-check (`if ($accion === null)`) → sube a `index.php`.
    - Eliminar el mapeo `if (!isset($mapaAcciones[$accion]))` → sube a `index.php`.
    - El método `despachar()` recibe solo `$metodo` (string con nombre del método a ejecutar) en
      lugar de `$dominio`, `$nombreServicio`, `$mapaAcciones`.
    - Conserva el `try/catch` con `ProveedorNoDisponibleException` (502) y `Throwable` (500).
    - Conserva `error_log()` y mensajes genéricos exactamente como hoy.

11. **RuteoCentralizado.php (simplificado).**
    - Elimina la función `ejecutarRuteo()` actual.
    - Nueva función que recibe `$claseControlador` y `$metodo` (string con nombre del método).
    - Hace `require_once` del controlador, lo instancia, y llama a `$controlador->despachar($metodo)`.

12. **index.php (expandido).**
    - El mapa `$rutas` cambia de `['/cripto' => 'rutas/CriptoRts.php']` a:
      ```php
      $rutas = [
          '/cripto' => ['controlador' => 'CriptoCtrl', 'servicio' => 'CriptoRTS', 'acciones' => ['disponible' => 'getCryptos']],
          '/forex'  => ['controlador' => 'ForexCtrl',  'servicio' => 'ForexRTS',  'acciones' => ['disponible' => 'getAllMajorForex']],
          '/indice' => ['controlador' => 'IndiceCtrl', 'servicio' => 'IndiceRTS', 'acciones' => ['disponible' => 'getAllIndices']],
      ];
      ```
    - Después del bucle `foreach` que matchea el prefijo:
      a. Validar que `$_SERVER['REQUEST_METHOD']` sea `GET`, si no → 405 y exit.
      b. Extraer la acción de la URI (segmento inmediatamente posterior al prefijo).
      c. Si no hay acción (health-check) → responder JSON con `status, timestamp, version, service` y exit.
      d. Validar que la acción exista en el mapa de `acciones` del dominio → si no, 404 y exit.
      e. Obtener el nombre del método desde el mapa de acciones.
      f. Hacer `require_once` de `rutas/RuteoCentralizado.php` y llamar a la función de ruteo con el
         nombre de la clase controladora y el método.

    - Conservar todo el resto de la lógica actual (CORS, preflight, landing page, health-check raíz,
      404 final) sin cambios.

### 7.1. Tabla de Delta

| Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
|------|---------------------------|--------|-----------------|
| Modelo | `modelos/BaseMdl.php` | CREATE | Clase abstracta con constructor (CacheProveedor), getCache(), ejecutarConsulta(), y 3 abstractos (obtenerClaveCache, obtenerUrl, obtenerTtlCache) |
| Modelo | `modelos/CriptoMdl.php` | MODIFY | Extiende BaseMdl; implementa 3 abstractos; método público obtenerTicker24h() delega en ejecutarConsulta() |
| Modelo | `modelos/ForexMdl.php` | MODIFY | Extiende BaseMdl; obtenerDivisas() usa ejecutarConsulta(); obtenerTasas() usa getCache() con patrón local idéntico |
| Modelo | `modelos/IndiceMdl.php` | MODIFY | Extiende BaseMdl; implementa 3 abstractos; método público obtenerIndices() delega en ejecutarConsulta() |
| Dominio | `servicios/ForexMatrixService.php` | CREATE | Clase con constantes CHUNK_DELAY_US, BASE_DELAY_US; método obtenerMatrizCompleta() con caché forex_matrix, chunking, usleep, construcción de pares |
| Dominio | `dto/ActivoDTO.php` | CREATE | Clase con 4 readonly properties; constructor privado; 3 factories estáticas (desdeCripto, desdeForex, desdeIndice); método toArray() |
| Controlador | `controladores/CriptoCtrl.php` | MODIFY | Usa ActivoDTO::desdeCripto(); elimina propiedad y constructor; instancia CriptoMdl inline |
| Controlador | `controladores/ForexCtrl.php` | MODIFY | getAllMajorForex() delega en ForexMatrixService; elimina caché, chunking, usleep, constantes, propiedad y constructor propios |
| Controlador | `controladores/IndiceCtrl.php` | MODIFY | Usa ActivoDTO::desdeIndice(); elimina propiedad y constructor; instancia IndiceMdl inline |
| Controlador | `controladores/BaseCtrl.php` | MODIFY | despachar() recibe solo $metodo; elimina validación HTTP, parseo URI, health-check, mapeo de acciones |
| Ruteo | `rutas/RuteoCentralizado.php` | MODIFY | Nueva función que recibe $claseControlador y $metodo; require + instancia + despachar($metodo) |
| Ruteo | `rutas/CriptoRts.php` | DELETE | Reemplazado por mapa en index.php |
| Ruteo | `rutas/ForexRts.php` | DELETE | Reemplazado por mapa en index.php |
| Ruteo | `rutas/IndiceRts.php` | DELETE | Reemplazado por mapa en index.php |
| Front Controller | `index.php` | MODIFY | Mapa de rutas con tripletas [controlador, servicio, acciones]; validación HTTP; parseo URI; health-check; llamado a RuteoCentralizado con clase y método |

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción |
|---------------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/BaseMdl.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/servicios/ForexMatrixService.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/dto/ActivoDTO.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/CriptoMdl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/ForexMdl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/IndiceMdl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/CriptoCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/ForexCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/IndiceCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/BaseCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/RuteoCentralizado.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/CriptoRts.php` | DELETE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/ForexRts.php` | DELETE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/IndiceRts.php` | DELETE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/index.php` | MODIFY |

---

## 9. Estrategia de validación

### 9.1. Validaciones de inspección de código (sin servidor)

| ID | Validación | Método | Esperado |
|----|-----------|--------|----------|
| V1 | `BaseMdl.php` — Inspeccionar archivo | Leer archivo | Clase abstracta con constructor, getCache(), ejecutarConsulta(), 3 abstractos. Sin métodos públicos propios. |
| V2 | `CriptoMdl.php` — Inspeccionar | Leer archivo | Extiende BaseMdl. Solo define 3 abstractos + método público obtenerTicker24h() que llama a ejecutarConsulta(). |
| V3 | `ForexMdl.php` — Inspeccionar | Leer archivo | Extiende BaseMdl. obtenerDivisas() usa ejecutarConsulta(). obtenerTasas() usa getCache() con patrón local. |
| V4 | `IndiceMdl.php` — Inspeccionar | Leer archivo | Extiende BaseMdl. Solo define 3 abstractos + método público obtenerIndices(). |
| V5 | `ForexMatrixService.php` — Inspeccionar | Leer archivo | Clase con constantes CHUNK_DELAY_US=50000, BASE_DELAY_US=150000. Método obtenerMatrizCompleta() con caché forex_matrix y chunking. |
| V6 | `ActivoDTO.php` — Inspeccionar | Leer archivo | 4 readonly properties. Constructor privado. 3 factories estáticas. toArray(). |
| V7 | `CriptoCtrl.php` — Inspeccionar | Leer archivo | Usa ActivoDTO::desdeCripto(). Eliminados propiedad $criptoMdl y constructor. |
| V8 | `ForexCtrl.php` — Inspeccionar | Leer archivo | getAllMajorForex() crea ForexMatrixService y delega. Sin caché, chunking ni usleep. |
| V9 | `IndiceCtrl.php` — Inspeccionar | Leer archivo | Usa ActivoDTO::desdeIndice(). Eliminados propiedad $indiceMdl y constructor. |
| V10 | `BaseCtrl.php` — Inspeccionar `despachar()` | Leer archivo | despachar(string $metodo). Sin validación HTTP, sin parseo URI, sin health-check. Solo try/catch con 502/500. |
| V11 | `RuteoCentralizado.php` — Inspeccionar | Leer archivo | Función recibe $claseControlador, $metodo. require + instancia + despachar($metodo). |
| V12 | `index.php` — Inspeccionar ruteo | Leer archivo | Mapa $rutas con tripletas. Validación GET (405). Parseo acción de URI. Health-check inline. Mapeo acción→método. Llama RuteoCentralizado. |
| V13 | `CriptoRts.php` — Verificar eliminación | Glob | Archivo no existe. |
| V14 | `ForexRts.php` — Verificar eliminación | Glob | Archivo no existe. |
| V15 | `IndiceRts.php` — Verificar eliminación | Glob | Archivo no existe. |
| V16 | Dependencias `require_once` — Sin archivos rotos | grep require_once | Ningún require_once apunta a `*Rts.php`. Todos los paths existen. |

### 9.2. Validaciones HTTP (requieren Apache sirviendo el servicio)

| ID | Validación | Comando curl | Esperado |
|----|-----------|-------------|----------|
| V17 | Health-check cripto | `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_divisas/cripto` | 200 |
| V18 | Health-check forex | `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_divisas/forex` | 200 |
| V19 | Health-check índice | `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_divisas/indice` | 200 |
| V20 | Health-check contenido cripto | `curl -s http://localhost/rest_divisas/cripto \| python3 -c "import sys,json; d=json.load(sys.stdin); print(d['service'])"` | `CriptoRTS` |
| V21 | Datos cripto OK | `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_divisas/cripto/disponible` | 200 |
| V22 | Datos forex OK | `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_divisas/forex/disponible` | 200 |
| V23 | Datos índice OK | `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_divisas/indice/disponible` | 200 |
| V24 | Formato cripto | `curl -s http://localhost/rest_divisas/cripto/disponible \| python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].keys())"` | `dict_keys(['symbol', 'name', 'price', 'type'])` |
| V25 | Formato forex | `curl -s http://localhost/rest_divisas/forex/disponible \| python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].keys())"` | `dict_keys(['symbol', 'name', 'price', 'type'])` |
| V26 | Formato índice | `curl -s http://localhost/rest_divisas/indice/disponible \| python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].keys())"` | `dict_keys(['symbol', 'name', 'price', 'type'])` |
| V27 | Método no GET | `curl -s -X POST -o /dev/null -w "%{http_code}" http://localhost/rest_divisas/cripto/disponible` | 405 |
| V28 | Acción inexistente | `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_divisas/cripto/noexiste` | 404 |
| V29 | Dato type=crypto | `curl -s http://localhost/rest_divisas/cripto/disponible \| python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['type'])"` | `crypto` |
| V30 | Dato type=forex | `curl -s http://localhost/rest_divisas/forex/disponible \| python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['type'])"` | `forex` |
| V31 | Dato type=indice | `curl -s http://localhost/rest_divisas/indice/disponible \| python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['type'])"` | `indice` |

---

## 10. Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Regresión en el formato de `price` por cambio en `number_format` o en la lógica de extracción | Baja | `ActivoDTO` unifica el formateo. V24-V26 verifican que las claves se preservan. V29-V31 verifican el campo `type`. |
| `BaseMdl::getCache()` expone `CacheProveedor` a subclases que podrían usarlo incorrectamente | Baja | Es `protected`. Solo `ForexMdl::obtenerTasas()` lo usa para claves dinámicas, que es el caso de uso previsto. |
| Eliminación de `*Rts.php` rompe `require_once` en algún archivo no considerado | Media | V16 verifica que ningún `require_once` apunte a esos archivos. Solo `index.php` los referenciaba. |
| `ForexMatrixService` no replica exactamente los mismos `usleep` y `chunk_size` que el `ForexCtrl` actual | Media | El HLT especifica que las constantes `CHUNK_DELAY_US` y `BASE_DELAY_US` se copian textualmente al servicio. V5 lo verifica. |
| Doble capa de caché (`ForexMdl::obtenerTasas()` individual + `ForexMatrixService` matriz) produce datos inconsistentes | Baja | Ambas capas usan el mismo TTL `CACHE_TTL_FOREX` (60s). La matriz completa se cachea al final del algoritmo, por lo que los chunks individuales se consultan desde la caché del modelo durante el recálculo periódico. No hay inconsistencia. |
| La simplificación de `BaseCtrl::despachar()` rompe el health-check actual | Baja | V17-V19 verifican health-check. El health-check se implementa directamente en `index.php` con el mismo formato JSON que hoy produce `despachar()`. |
| La raíz `/rest_divisas/` (sin prefijo de dominio) deja de funcionar | Baja | La lógica de landing page y health-check raíz en `index.php` no se modifica. |

---

## 11. Rollback

- **Global:** restaurar los 14 archivos modificados/creados y los 3 eliminados desde control de versiones (Git).
- **Paso a paso:**
  - Si falla `BaseMdl`: eliminar `modelos/BaseMdl.php` y revertir los 3 `*Mdl` a su versión anterior.
  - Si falla `ActivoDTO`: eliminar `dto/ActivoDTO.php` y revertir `CriptoCtrl`, `IndiceCtrl` a su versión anterior.
  - Si falla `ForexMatrixService`: eliminar `servicios/ForexMatrixService.php` y revertir `ForexCtrl`.
  - Si falla el ruteo: restaurar los 3 `*Rts.php` desde Git, revertir `index.php`, `BaseCtrl`, `RuteoCentralizado.php`.
- **Archivos eliminados** (`CriptoRts.php`, `ForexRts.php`, `IndiceRts.php`): restaurar desde Git. El `index.php` anterior sigue referenciándolos, así que al revertir `index.php` el sistema vuelve a funcionar inmediatamente.
