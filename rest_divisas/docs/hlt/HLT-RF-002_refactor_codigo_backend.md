# HLT-RF-002 — Contrato Técnico de Alto Nivel: Refactor del código backend de `rest_divisas`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-002_refactor_codigo_backend.md`](../rf/RF-002_refactor_codigo_backend.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `docs/hlt/HLT-RF-001_refactor_htaccess.md` (infraestructura Apache; este RF-002 no lo duplica).
> **Servicio afectado:** `rest_divisas` (autónomo, **sin base de datos**; no se replica en otros `rest_*`).
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
- Un senior debe aprobar el HLT (§6 de `doc_modo_planificacion.md`) antes de que el agente
  implementador ejecute tarea alguna. Al aprobar, cambiar `Aprobación senior` a `APROBADO` y el
  `Estado` a `EN EJECUCIÓN`.
- El agente implementador **solo** puede cambiar el `Estado` del HLT a **`COMPLETADO`** cuando se
  cumplan **todas** estas condiciones simultáneamente:
  1. **Todas** las tareas `T1`–`T24` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T15`–`T24`) se ejecutaron y su resultado observado **coincide** con
     el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`** (no `COMPLETADO`).
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`** o
  **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Reestructurar el código PHP de `rest_divisas` para que siga la arquitectura por capas
`Rts → Ctrl → Mdl` del resto del backend: introducir la capa `Mdl` (hoy inexistente), centralizar el
acceso HTTP externo en un único cliente con TLS activo y timeout explícito, eliminar la duplicación
entre los tres dominios (cripto/forex/índice), retirar la API key hardcodeada y el código muerto de
base de datos, migrar toda respuesta a `BaseCtrl` y homogeneizar el manejo de errores con códigos HTTP
diferenciados (502/500/404/405) sin exponer detalles internos — **preservando el contrato de datos de
éxito documentado en el `README.md`** (`symbol`, `name`, `price`, `type`).

---

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en `rest_divisas`:

- **CREATE** `configuracion/ProveedorNoDisponibleException.php` — excepción de dominio para fallos del proveedor externo.
- **CREATE** `configuracion/ClienteHttp.php` — cliente HTTP común (TLS activo, timeout explícito).
- **CREATE** `modelos/CriptoMdl.php`, `modelos/ForexMdl.php`, `modelos/IndiceMdl.php` — capa de acceso a datos externos.
- **MODIFY** `configuracion/global.php` — reemplazar constantes `DB_*` por las constantes que el servicio realmente usa (API key y URLs base).
- **MODIFY** `controladores/BaseCtrl.php` — añadir despacho común (parseo de acción, método HTTP, health-check y manejo de errores homogéneo).
- **MODIFY** `controladores/CriptoCtrl.php`, `controladores/ForexCtrl.php`, `controladores/IndiceCtrl.php` — delegar en su `Mdl`, camelCase, limpieza.
- **MODIFY** `rutas/CriptoRts.php`, `rutas/ForexRts.php`, `rutas/IndiceRts.php` — reducir a despacho común, sin duplicación.
- **DELETE** `configuracion/enlace.php` — código muerto de acceso a base de datos.

---

## 3. Out-of-scope (qué NO entra)

- No se corrige el mapeo de `/sinteticos` y `/otros` a `rutas/MarketsRts.php` (archivo inexistente):
  es funcionalidad nueva, no refactor; se documenta como hallazgo.
- No se renombran los métodos públicos existentes de los `Ctrl` (`getCryptos`, `getAllMajorForex`,
  `getAllCurrencies`, `getAllIndices`): el RF (A1–A10) solo ordena renombrar **propiedades**
  (`$base_url`/`$api_key`); renombrar métodos no está en el alcance.
- No se migra a Composer, autoloading PSR-4 ni framework.
- No se implementa caché, rate limiting, autenticación, OpenAPI ni PHPUnit.
- No se externaliza la API key a variable de entorno / `.env`: se centraliza como **constante** en
  `configuracion/global.php` (decisión cerrada del RF §5).
- No se toca el `.htaccess` (cubierto por RF-001) ni `configuracion/CorsConfig.php`.
- No se modifica `index.php` (ningún defecto D1–D12 lo afecta; no referencia `enlace.php` ni
  `global.php`, por lo que su borrado/cambio no lo rompe).
- No se añaden endpoints nuevos ni se cambia el contrato de datos de éxito.

---

## 4. Impacto en contratos públicos

Endpoints existentes (URIs sin cambios, R9). Los contratos de éxito se preservan; el manejo de error
se homogeneíza e introduce **502** donde hoy se devolvía `200` con arreglo vacío ante fallo del
proveedor.

| Método | Ruta | Entrada | Éxito | Error |
|--------|------|---------|-------|-------|
| GET | `/rest_divisas/cripto` | ninguna | 200 health-check JSON `{status:"ok", timestamp, version:"1.0.0", service:"CriptoRTS"}` | 405 si método ≠ GET |
| GET | `/rest_divisas/cripto/disponible` | ninguna | 200 arreglo de `{symbol, name, price, type:"crypto"}` | 502 proveedor caído; 500 error interno |
| GET | `/rest_divisas/forex` | ninguna | 200 health-check JSON `service:"ForexRTS"` | 405 si método ≠ GET |
| GET | `/rest_divisas/forex/disponible` | ninguna | 200 arreglo de `{symbol, name, price, type:"forex"}` | 502 si falla la lista de divisas; 500 error interno |
| GET | `/rest_divisas/indice` | ninguna | 200 health-check JSON `service:"IndiceRTS"` | 405 si método ≠ GET |
| GET | `/rest_divisas/indice/disponible` | ninguna | 200 arreglo de `{symbol, name, price, type:"indice"}` | 502 proveedor caído; 500 error interno |
| GET | `/rest_divisas/<dominio>/<acción-inexistente>` | ninguna | — | 404 mensaje genérico vía `BaseCtrl` |

**Mensajes de error genéricos exactos (cerrados):** 502 → `"El proveedor de datos no está disponible"`;
500 → `"Error interno del servidor"`; 404 → `"Acción no encontrada"`; 405 → `"Método no permitido"`.
Todos emitidos vía `respuestaErrorSimple(mensaje, código)` (forma `{"error": "<mensaje>"}`).

> **Resolución de discrepancia (trazabilidad, §2.10).** El criterio §7 del RF incluye la línea
> "`GET /cripto → 200 arreglo {symbol,...}`", que contradice tanto el código real como otra línea del
> mismo §7 (que exige que `/cripto` reporte health-check con el nombre de servicio correcto) y el
> `README.md` (líneas 154–159), citado por el RF §3/§5 como fuente del contrato. **Decisión cerrada:**
> se preserva el mapeo documentado en el `README.md` — `/cripto` (sin acción) = health-check;
> `/cripto/disponible` = datos. Igual para `forex` e `indice`.

---

## 5. Compatibilidad

**NO-BREAKING en el caso de éxito** (200 y contrato `symbol/name/price/type` idénticos). En el caso de
**fallo del proveedor**, el comportamiento cambia de `200` con arreglo vacío a **`502`** con mensaje
genérico: es la mejora de manejo de errores explícitamente solicitada (RF R5). Un frontend que trata
cualquier código ≥ 400 como error no requiere cambios; puede opcionalmente distinguir 502 de 500. El
health-check deja de usar impresión con formato (`JSON_PRETTY_PRINT`) y corrige el nombre de servicio;
sus claves y valores de estado se mantienen.

---

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Configuración / infraestructura compartida | `configuracion/global.php`, `configuracion/ClienteHttp.php`, `configuracion/ProveedorNoDisponibleException.php` | MODIFY / CREATE / CREATE |
| Repositorio (acceso a datos externos) | `modelos/CriptoMdl.php`, `modelos/ForexMdl.php`, `modelos/IndiceMdl.php` | CREATE |
| Servicio de aplicación / caso de uso | `controladores/BaseCtrl.php`, `controladores/CriptoCtrl.php`, `controladores/ForexCtrl.php`, `controladores/IndiceCtrl.php` | MODIFY |
| Interfaz / entrada | `rutas/CriptoRts.php`, `rutas/ForexRts.php`, `rutas/IndiceRts.php` | MODIFY |
| Código muerto | `configuracion/enlace.php` | DELETE |

Servicio único: `rest_divisas`. No hay `anexos/*.sql` (servicio sin base de datos).

---

## 7. Delta arquitectónico

### 7.0. Decisiones cerradas de diseño (trazables al RF)

1. **Despacho común en `BaseCtrl` (A3/A4/A5).** Se añade a `BaseCtrl` un método público
   `despachar(string $dominio, string $nombreServicio, array $mapaAcciones): void` que: (a) responde
   **405** `"Método no permitido"` si el método HTTP no es `GET`; (b) parsea la acción como el segmento
   de URI posterior a `$dominio`; (c) sin acción → responde el health-check `{status,timestamp,version,
   service:$nombreServicio}` con **200** vía `respuestaJsonSimple`; (d) con acción presente en
   `$mapaAcciones` (mapa `acción → nombre de método del Ctrl`) → invoca `$this->{$metodo}()` dentro de
   `try/catch` y responde el resultado con `respuestaExitosaSimple`; (e) acción ausente del mapa →
   **404** `"Acción no encontrada"`. Cada `Rts` invoca este método sobre su Ctrl, eliminando la
   duplicación. Esta es la única incorporación de comportamiento a `BaseCtrl`.
2. **Manejo de errores en el `try/catch` de `despachar` (A5/R5).** `catch` de
   `ProveedorNoDisponibleException` → `error_log()` del detalle + **502**
   `"El proveedor de datos no está disponible"`; `catch` de cualquier otro `Throwable` → `error_log()`
   del detalle + **500** `"Error interno del servidor"`. Ningún mensaje de excepción llega al cliente.
3. **Cliente HTTP común `ClienteHttp` (A2/R3).** Clase `ClienteHttp` en `configuracion/ClienteHttp.php`
   con método estático `obtenerJson(string $url, int $timeout = 30): array`, implementado con cURL:
   `CURLOPT_RETURNTRANSFER` activo, `CURLOPT_SSL_VERIFYPEER` **activo** (verdadero) y
   `CURLOPT_SSL_VERIFYHOST` en 2, `CURLOPT_TIMEOUT` = 30 segundos (valor único para los tres dominios).
   Lanza `ProveedorNoDisponibleException` ante: error de cURL (incluye timeout), código HTTP distinto
   de 200, o cuerpo que no decodifica a arreglo. En caso normal devuelve el arreglo decodificado
   (incluido arreglo vacío legítimo).
4. **Excepción de dominio (A5).** Clase `ProveedorNoDisponibleException` (extiende `Exception`) en
   `configuracion/ProveedorNoDisponibleException.php`; distingue el fallo del proveedor externo del
   error interno para el mapeo 502 vs 500.
5. **Capa `Mdl` (A1).** Cada `Mdl` usa `ClienteHttp` y devuelve datos **decodificados** del proveedor;
   los `Ctrl` transforman esos datos al contrato `symbol/name/price/type`. Métodos cerrados:
   `CriptoMdl::obtenerTicker24h()`; `ForexMdl::obtenerDivisas()` y `ForexMdl::obtenerTasas(string $base,
   string $destinosCsv)`; `IndiceMdl::obtenerIndices()`.
6. **Tolerancia parcial de forex (R1 + R5).** `ForexCtrl::getAllMajorForex()` propaga la excepción si
   falla `obtenerDivisas()` (sin lista de divisas no hay datos → 502); los fallos por *chunk* dentro
   del bucle se registran con `error_log()` y se omiten (continúan), preservando la tolerancia parcial
   actual del servicio. Cripto e índice hacen una sola petición: cualquier fallo del proveedor → 502.
7. **API key centralizada (A6/R6).** La clave de Financial Modeling Prep hoy hardcodeada en
   `controladores/IndiceCtrl.php` se traslada a la constante `FMP_API_KEY` en `configuracion/global.php`
   nuevo. **El valor literal no se reproduce en este HLT**; el implementador lo toma de su ubicación
   actual y lo elimina del código fuente y de los comentarios. Se añaden también las constantes de URL
   base: `BINANCE_BASE_URL`, `FRANKFURTER_BASE_URL`, `FMP_BASE_URL`.
8. **Nombres de servicio del health-check (A3/D3):** `CriptoRTS`, `ForexRTS`, `IndiceRTS`.

### 7.1. Tabla de Delta (una indicación de cambio por fila)

| Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
|------|---------------------------|--------|-----------------|
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/ProveedorNoDisponibleException.php` | CREATE | Clase `ProveedorNoDisponibleException extends Exception`. |
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/ClienteHttp.php` | CREATE | Clase `ClienteHttp` con `obtenerJson($url,$timeout=30)`; TLS activo, timeout 30 s; lanza la excepción del proveedor ante cURL error / HTTP≠200 / JSON inválido. Requiere la excepción. |
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/global.php` | MODIFY | Reemplazar constantes `DB_*` por `FMP_API_KEY` (valor tomado de `IndiceCtrl.php` actual), `BINANCE_BASE_URL`, `FRANKFURTER_BASE_URL`, `FMP_BASE_URL`. |
| Modelo | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/CriptoMdl.php` | CREATE | Clase `CriptoMdl` con `obtenerTicker24h()` usando `ClienteHttp` sobre `BINANCE_BASE_URL . "/ticker/24hr"`. Requiere `ClienteHttp` y `global.php`. |
| Modelo | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/ForexMdl.php` | CREATE | Clase `ForexMdl` con `obtenerDivisas()` (sobre `FRANKFURTER_BASE_URL . "/currencies"`) y `obtenerTasas($base,$destinosCsv)` (sobre `FRANKFURTER_BASE_URL . "/latest?from=...&to=..."`), ambos vía `ClienteHttp`. |
| Modelo | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/IndiceMdl.php` | CREATE | Clase `IndiceMdl` con `obtenerIndices()` sobre `FMP_BASE_URL . "/quotes/index"` con `FMP_API_KEY`, vía `ClienteHttp`. |
| Controlador | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/BaseCtrl.php` | MODIFY | Añadir método público `despachar($dominio,$nombreServicio,$mapaAcciones)` con health-check y `try/catch` 502/500/404/405 según §7.0(1)(2). Requiere la excepción del proveedor. |
| Controlador | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/CriptoCtrl.php` | MODIFY | Delegar en `CriptoMdl`; renombrar `$base_url`→`$baseUrl`; eliminar cURL directo con `SSL_VERIFYPEER=false`; eliminar comentario de URL alternativa; mantener el mapeo a `{symbol,name,price,type:"crypto"}` (filtro USDT/BUSD). |
| Controlador | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/ForexCtrl.php` | MODIFY | Delegar en `ForexMdl` (`obtenerDivisas`/`obtenerTasas`); renombrar `$base_url`→`$baseUrl`; eliminar `file_get_contents` directo; eliminar comentario de URL alternativa; conservar tolerancia parcial (§7.0(6)) y el mapeo a `{...,type:"forex"}`. |
| Controlador | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/IndiceCtrl.php` | MODIFY | Delegar en `IndiceMdl`; eliminar `parent::__construct()`; obtener la clave desde `FMP_API_KEY` (no hardcodeada); renombrar `$base_url`/`$api_key`→`$baseUrl`/`$apiKey`; eliminar comentario de URL alternativa; mantener el mapeo a `{...,type:"indice"}`. |
| API/Rts | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/CriptoRts.php` | MODIFY | Reducir a: requerir `CriptoCtrl` e invocar `despachar('cripto','CriptoRTS',['disponible'=>'getCryptos'])`. Eliminar duplicación, `echo json_encode` y el comentario "Fix: pass the correct controller instance". |
| API/Rts | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/ForexRts.php` | MODIFY | Reducir a: requerir `ForexCtrl` e invocar `despachar('forex','ForexRTS',['disponible'=>'getAllMajorForex'])`. Igual limpieza. |
| API/Rts | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/IndiceRts.php` | MODIFY | Reducir a: requerir `IndiceCtrl` e invocar `despachar('indice','IndiceRTS',['disponible'=>'getAllIndices'])`. Igual limpieza. |
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/enlace.php` | DELETE | Código muerto de acceso a base de datos (sin referencias entrantes). |

### 7.2. Cadena de dependencias `require_once` (sin autoloading, §8.8)

- `ClienteHttp.php` requiere `ProveedorNoDisponibleException.php`.
- Cada `Mdl` requiere `ClienteHttp.php` y `global.php`.
- `BaseCtrl.php` requiere `ProveedorNoDisponibleException.php`.
- Cada `Ctrl` requiere `BaseCtrl.php` y su `Mdl` correspondiente.
- Cada `Rts` requiere su `Ctrl` correspondiente.
- `index.php` no cambia y no referencia `enlace.php` ni `global.php`.

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción |
|---------------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/ProveedorNoDisponibleException.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/ClienteHttp.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/global.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/CriptoMdl.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/ForexMdl.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/modelos/IndiceMdl.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/BaseCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/CriptoCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/ForexCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/IndiceCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/CriptoRts.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/ForexRts.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/IndiceRts.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/enlace.php` | DELETE |

---

## 9. Estrategia de validación

Cada comprobación es una tarea con checkbox (T15–T24) en §12. Las verificaciones sobre HTTP asumen
Apache sirviendo el servicio en `http://localhost/rest_divisas/`; las verificaciones sobre el código
inspeccionan los archivos del servicio; el detalle de errores se comprueba en `logs/php_errors.log`.

- **Health check (R1):** solicitar por GET `/cripto`; confirmar 200 con JSON de estado `ok` y
  `service` = `CriptoRTS`.
- **Datos de éxito (R1):** solicitar por GET `/cripto/disponible`; confirmar 200 con un arreglo de
  objetos con claves exactamente `symbol`, `name`, `price`, `type`.
- **Datos de éxito forex/índice (R1):** solicitar por GET `/forex/disponible` y `/indice/disponible`;
  confirmar 200 con el mismo contrato de datos.
- **Capa Mdl y sin acceso HTTP directo (A1/D1):** confirmar que existen `modelos/CriptoMdl.php`,
  `modelos/ForexMdl.php`, `modelos/IndiceMdl.php` y que ningún archivo de `controladores/` contiene
  `curl_init` ni `file_get_contents`.
- **Sin secreto ni BD (A6/A7/D7/D9):** confirmar que ningún `Ctrl`/`Mdl` contiene la cadena literal de
  la API key; que `configuracion/global.php` contiene la constante `FMP_API_KEY`; y que
  `configuracion/enlace.php` no existe.
- **Fallo del proveedor → 502 (R5):** provocar la indisponibilidad del proveedor de un dominio y
  solicitar `/cripto/disponible`; confirmar 502 con mensaje genérico, sin texto de excepción ni traza
  en el JSON, y con el detalle real registrado en `logs/php_errors.log`.
- **Acción inexistente → 404 (R5):** solicitar `/cripto/accionInexistente`; confirmar 404 con mensaje
  genérico vía `BaseCtrl`.
- **Método no soportado → 405 (R5):** solicitar `/cripto` con método `PATCH`; confirmar 405 con mensaje
  genérico vía `BaseCtrl`.
- **Health-check y comentarios (A3/A9/D3/D11):** confirmar que los tres `Rts` reportan su nombre de
  servicio propio (`CriptoRTS`/`ForexRTS`/`IndiceRTS`, no `PlanesRTS`) y que no existe el comentario
  duplicado "Fix: pass the correct controller instance".
- **Nomenclatura y TLS/timeout (A2/A8/D8/D10):** confirmar que los `Ctrl` usan `$baseUrl`/`$apiKey` en
  camelCase (no `snake_case`) y que el único cliente HTTP (`ClienteHttp`) usa verificación SSL activa y
  timeout explícito, sin `CURLOPT_SSL_VERIFYPEER` en falso en ningún archivo.

---

## 10. Riesgos

- **Cambio de la ruta de error del proveedor (200→502).** El caso de fallo cambia de arreglo vacío a
  502. *Mitigación:* declarado NO-BREAKING por RF R5 (frontend trata ≥400 como error); T20 verifica el
  contrato de error.
- **Regresión del contrato de datos al introducir la capa `Mdl`.** Mover el acceso HTTP a `Mdl` podría
  alterar el mapeo. *Mitigación:* la transformación a `{symbol,name,price,type}` permanece en el `Ctrl`;
  T16 y T17 verifican las claves exactas.
- **TLS activo rompe una petición que antes funcionaba con verificación desactivada.** *Mitigación:*
  el proveedor (Binance) presenta certificado válido; T16 confirma 200 con TLS activo.
- **Tolerancia parcial de forex.** El diseño preserva la omisión de *chunks* fallidos (§7.0(6)); solo
  el fallo de la lista de divisas produce 502. *Mitigación:* decisión cerrada declarada; T17 verifica
  el caso de éxito.
- **`/sinteticos` y `/otros` mapean a `MarketsRts.php` inexistente.** Defecto preexistente fuera de
  alcance (§3); este refactor no lo agrava.

---

## 11. Rollback

- **Global:** restaurar desde el control de versiones los archivos MODIFY (`global.php`, `BaseCtrl.php`,
  los tres `Ctrl`, los tres `Rts`), restaurar `configuracion/enlace.php`, y eliminar los archivos
  CREATE (`ProveedorNoDisponibleException.php`, `ClienteHttp.php`, los tres `Mdl`). El servicio no tiene
  base de datos, por lo que no hay datos que revertir.
- **Por artefacto:** revertir cada archivo a su versión previa o eliminar el archivo creado
  correspondiente.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` =
> realizado y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado, con razón. Un
> checkbox = una acción verificable. El agente implementador **actualiza cada checkbox al completar y
> verificar** la tarea, y solo entonces. Todos se entregan en `[ ]`. Orden por capa (§7.5):
> Config → Modelo → Controlador → Ruta → borrado → validaciones.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_divisas` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/` |
| Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) — **no se modifica** |
| Capa de datos | **Sin base de datos**: APIs externas (Binance, Frankfurter, Financial Modeling Prep) vía `ClienteHttp` (nuevo) |
| Capa de respuesta | `controladores/BaseCtrl.php` (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`) |
| Cliente HTTP común | `configuracion/ClienteHttp.php` (nuevo): TLS activo, timeout 30 s |
| Configuración | `configuracion/global.php` (constantes `FMP_API_KEY`, `BINANCE_BASE_URL`, `FRANKFURTER_BASE_URL`, `FMP_BASE_URL`) |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `GET http://localhost/rest_divisas/cripto` (200, `service:"CriptoRTS"`) |
| Dominios | `cripto` (Binance), `forex` (Frankfurter), `indice` (Financial Modeling Prep) |
| Observación (no se corrige aquí) | `sinteticos` y `otros` mapean a `rutas/MarketsRts.php`, inexistente |
| Logs | `logs/php_errors.log` del servicio |

### Grupo A — Configuración / infraestructura compartida

- `[ ]` **T1** | `configuracion/global.php` | MODIFY — Reemplazar las constantes `DB_*` por
  `FMP_API_KEY` (valor tomado de `controladores/IndiceCtrl.php` actual), `BINANCE_BASE_URL`,
  `FRANKFURTER_BASE_URL` y `FMP_BASE_URL` (A6/A7/D7).
- `[ ]` **T2** | `configuracion/ProveedorNoDisponibleException.php` | CREATE — Clase
  `ProveedorNoDisponibleException` que extiende `Exception` (A5).
- `[ ]` **T3** | `configuracion/ClienteHttp.php` | CREATE — Clase `ClienteHttp` con
  `obtenerJson($url, $timeout = 30)`: cURL con retorno de transferencia, SSL activo, timeout 30 s;
  lanza `ProveedorNoDisponibleException` ante error de cURL, HTTP ≠ 200 o JSON no-arreglo; requiere la
  excepción (A2/R3/D4/D8).

### Grupo B — Capa de modelos (`Mdl`)

- `[ ]` **T4** | `modelos/CriptoMdl.php` | CREATE — Clase `CriptoMdl` con `obtenerTicker24h()` vía
  `ClienteHttp` sobre `BINANCE_BASE_URL . "/ticker/24hr"`; requiere `ClienteHttp` y `global.php` (A1).
- `[ ]` **T5** | `modelos/ForexMdl.php` | CREATE — Clase `ForexMdl` con `obtenerDivisas()` y
  `obtenerTasas($base, $destinosCsv)` vía `ClienteHttp` sobre Frankfurter; requiere `ClienteHttp` y
  `global.php` (A1).
- `[ ]` **T6** | `modelos/IndiceMdl.php` | CREATE — Clase `IndiceMdl` con `obtenerIndices()` vía
  `ClienteHttp` sobre `FMP_BASE_URL . "/quotes/index"` usando `FMP_API_KEY`; requiere `ClienteHttp` y
  `global.php` (A1/A6).

### Grupo C — Controladores

- `[ ]` **T7** | `controladores/BaseCtrl.php` | MODIFY — Añadir el método público
  `despachar($dominio, $nombreServicio, $mapaAcciones)` con health-check y `try/catch` de errores
  502/500/404/405 según §7.0(1)(2); requiere `ProveedorNoDisponibleException` (A3/A4/A5/R5).
- `[ ]` **T8** | `controladores/CriptoCtrl.php` | MODIFY — Delegar en `CriptoMdl`; renombrar
  `$base_url`→`$baseUrl`; eliminar el cURL directo (con `SSL_VERIFYPEER=false`) y el comentario de URL
  alternativa; conservar el mapeo a `{symbol,name,price,type:"crypto"}` con filtro USDT/BUSD
  (A1/A2/A8/A9/D8/D10/D11).
- `[ ]` **T9** | `controladores/ForexCtrl.php` | MODIFY — Delegar en `ForexMdl`; renombrar
  `$base_url`→`$baseUrl`; eliminar `file_get_contents` directo y el comentario de URL alternativa;
  conservar la tolerancia parcial (§7.0(6)) y el mapeo a `{...,type:"forex"}` (A1/A8/A9/D10/D11).
- `[ ]` **T10** | `controladores/IndiceCtrl.php` | MODIFY — Delegar en `IndiceMdl`; eliminar
  `parent::__construct()`; leer la clave desde `FMP_API_KEY`; renombrar `$base_url`/`$api_key`→
  `$baseUrl`/`$apiKey`; eliminar el comentario de URL alternativa; conservar el mapeo a
  `{...,type:"indice"}` (A1/A6/A8/A9/A10/D7/D10/D11/D12).

### Grupo D — Rutas

- `[ ]` **T11** | `rutas/CriptoRts.php` | MODIFY — Reducir a requerir `CriptoCtrl` e invocar
  `despachar('cripto','CriptoRTS',['disponible'=>'getCryptos'])`; eliminar la duplicación, los
  `echo json_encode` y el comentario "Fix: pass the correct controller instance" (A3/A4/A9/D2/D3/D11).
- `[ ]` **T12** | `rutas/ForexRts.php` | MODIFY — Reducir a requerir `ForexCtrl` e invocar
  `despachar('forex','ForexRTS',['disponible'=>'getAllMajorForex'])`; misma limpieza (A3/A4/A9/D2/D3/D11).
- `[ ]` **T13** | `rutas/IndiceRts.php` | MODIFY — Reducir a requerir `IndiceCtrl` e invocar
  `despachar('indice','IndiceRTS',['disponible'=>'getAllIndices'])`; misma limpieza (A3/A4/A9/D2/D3/D11).

### Grupo E — Eliminación de código muerto

- `[ ]` **T14** | `configuracion/enlace.php` | DELETE — Eliminar el archivo de acceso a base de datos
  (sin referencias entrantes) (A7/D9).

### Grupo F — Validaciones (cada una es una tarea con su resultado esperado)

- `[ ]` **T15** | Validación — health check (R1/D3) — Solicitar por GET `/cripto`. **Esperado:** 200,
  JSON de estado `ok` con `service` = `CriptoRTS`.
- `[ ]` **T16** | Validación — datos cripto (R1) — Solicitar por GET `/cripto/disponible`. **Esperado:**
  200, arreglo de objetos con claves exactamente `symbol`, `name`, `price`, `type` (`type:"crypto"`).
- `[ ]` **T17** | Validación — datos forex e índice (R1) — Solicitar por GET `/forex/disponible` y
  `/indice/disponible`. **Esperado:** 200 con el mismo contrato de datos (`type` `forex`/`indice`).
- `[ ]` **T18** | Validación — capa Mdl y sin HTTP directo (A1/D1) — Inspeccionar `modelos/` y
  `controladores/`. **Esperado:** existen `CriptoMdl.php`, `ForexMdl.php`, `IndiceMdl.php`; ningún
  `Ctrl` contiene `curl_init` ni `file_get_contents`.
- `[ ]` **T19** | Validación — sin secreto ni BD (A6/A7/D7/D9) — Inspeccionar código y `configuracion/`.
  **Esperado:** ninguna cadena literal de la API key en `Ctrl`/`Mdl`; `global.php` contiene
  `FMP_API_KEY`; `configuracion/enlace.php` no existe.
- `[ ]` **T20** | Validación — fallo del proveedor → 502 (R5) — Con el proveedor de un dominio
  indisponible, solicitar `/cripto/disponible`. **Esperado:** 502 con mensaje genérico
  `"El proveedor de datos no está disponible"`, sin texto de excepción ni traza en el JSON; detalle
  registrado en `logs/php_errors.log`.
- `[ ]` **T21** | Validación — acción inexistente → 404 (R5) — Solicitar `/cripto/accionInexistente`.
  **Esperado:** 404 con mensaje genérico vía `BaseCtrl`.
- `[ ]` **T22** | Validación — método no soportado → 405 (R5) — Solicitar `/cripto` con método `PATCH`.
  **Esperado:** 405 con mensaje genérico vía `BaseCtrl`.
- `[ ]` **T23** | Validación — health-check y comentarios (A3/A9/D3/D11) — Inspeccionar los tres `Rts`.
  **Esperado:** nombres de servicio `CriptoRTS`/`ForexRTS`/`IndiceRTS` (no `PlanesRTS`); no existe el
  comentario "Fix: pass the correct controller instance".
- `[ ]` **T24** | Validación — nomenclatura y TLS/timeout (A2/A8/D8/D10) — Inspeccionar `Ctrl` y
  `ClienteHttp`. **Esperado:** propiedades `$baseUrl`/`$apiKey` en camelCase; `ClienteHttp` con SSL
  activo y timeout explícito; ningún archivo con `CURLOPT_SSL_VERIFYPEER` en falso.

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 24
- Completadas [X]: _(pendiente)_
- Bloqueadas [BLOCKED]: _(pendiente)_
- Omitidas: _(pendiente)_

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | configuracion/global.php |  |
| T2 |  | configuracion/ProveedorNoDisponibleException.php |  |
| T3 |  | configuracion/ClienteHttp.php |  |
| T4 |  | modelos/CriptoMdl.php |  |
| T5 |  | modelos/ForexMdl.php |  |
| T6 |  | modelos/IndiceMdl.php |  |
| T7 |  | controladores/BaseCtrl.php |  |
| T8 |  | controladores/CriptoCtrl.php |  |
| T9 |  | controladores/ForexCtrl.php |  |
| T10 |  | controladores/IndiceCtrl.php |  |
| T11 |  | rutas/CriptoRts.php |  |
| T12 |  | rutas/ForexRts.php |  |
| T13 |  | rutas/IndiceRts.php |  |
| T14 |  | configuracion/enlace.php |  |
| T15 |  | (validación) |  |
| T16 |  | (validación) |  |
| T17 |  | (validación) |  |
| T18 |  | (validación) |  |
| T19 |  | (validación) |  |
| T20 |  | (validación) |  |
| T21 |  | (validación) |  |
| T22 |  | (validación) |  |
| T23 |  | (validación) |  |
| T24 |  | (validación) |  |

### Validaciones ejecutadas

| ID | Qué se ejecutó | Resultado observado | Esperado | ¿Coincide? |
|----|----------------|---------------------|----------|------------|
|    |                |                     |          |            |

### Blockers
- _(descripción del bloqueo, tarea afectada y qué se necesita para desbloquear)_

### Archivos cambiados
- _(path absoluto — CREATE|MODIFY|DELETE — resumen de una línea)_

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas se ejecutaron y su resultado quedó registrado.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T24 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
