# HLT-RF-004 — Contrato Técnico de Alto Nivel: Corrección de seguridad y eliminación de duplicidad en `rest_divisas`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-004_seguridad_duplicidad.md`](../rf/RF-004_seguridad_duplicidad.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `docs/hlt/HLT-RF-002_refactor_codigo_backend.md`, `docs/hlt/HLT-RF-003_refactor_index.md`.
> **Servicio afectado:** `rest_divisas`.
> **Versión HLT:** 2.0.0
> **Fecha:** 2026-07-17
>
> **Nota de formato:** este documento contiene **solo indicaciones** (descripciones y tablas). No
> incluye código PHP, cuerpos de método ni comandos de consola literales. El agente implementador
> traduce cada indicación a la sintaxis correspondiente respetando las convenciones del repo. Los
> nombres de clases, métodos, propiedades y constantes se citan como **valores cerrados** de decisión.
>
> **Ejecutado previamente por RF-001:** directorio `errors/` con 5 páginas HTML, bloques
> `mod_rewrite` unificados, anti-hotlinking eliminado, `php_value` protegido con
> `<IfModule mod_php.c>`, placeholder muerto eliminado. Estas tareas se reflejan como `[X]`
> (realizadas por RF-001) en la checklist.

---

## Estado del HLT

| Campo | Valor |
|-------|-------|
| **Estado** | `PROPUESTO` |
| Aprobación senior | `PENDIENTE` |
| Fecha de aprobación | — |
| Fecha de cierre | — |

### Reglas de estado (mandatorias)

- El HLT nace en `PROPUESTO`. Todas las tareas RF-001 aparecen en `[X]`; las tareas RF-004 pendientes en `[ ]`.
- Un senior debe aprobar el HLT (§6 de `doc_modo_planificacion.md`) antes de que el agente
  implementador ejecute tarea alguna. Al aprobar, cambiar `Aprobación senior` a `APROBADO` y el
  `Estado` a `EN EJECUCIÓN`.
- El agente implementador **solo** puede cambiar el `Estado` del HLT a **`COMPLETADO`** cuando se
  cumplan **todas** estas condiciones simultáneamente:
  1. **Todas** las tareas `T1`–`T25` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T17`–`T25`) se ejecutaron y su resultado observado **coincide** con
     el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`** (no `COMPLETADO`).
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`** o
  **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Corregir las 10 vulnerabilidades de seguridad detectadas en `rest_divisas` (API key hardcodeada en
texto plano, directorio `logs/` faltante, CORS fijo a localhost, CSP desalineado, cabeceras
deprecadas, `vistas/` sin bloqueo y ausencia de HTTPS) y eliminar los 11 focos de duplicación de
código identificados (propiedades muertas, headers redundantes, archivos estructuralmente idénticos,
formatos inconsistentes, números mágicos, documentación desactualizada, landing con endpoints
incorrectos y ausencia de `.gitignore`/`.env.example`) — sin alterar el contrato público de los
endpoints existentes.

---

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en `rest_divisas`:

- **MODIFY** `configuracion/global.php` — externalizar API key a variable de entorno, añadir `CORS_ORIGIN`, `APP_VERSION`.
- **CREATE** `configuracion/.env.example` — plantilla de variables de entorno.
- **CREATE** `.gitignore` — ignorar `.env`, `logs/`, `anexos/`.
- **MODIFY** `configuracion/ClienteHttp.php` — sanitizar mensajes de excepción (sin URLs ni mensajes crudos de cURL).
- **MODIFY** `configuracion/CorsConfig.php` — leer CORS desde constante, definir CSP sin CDN/`unsafe-inline`.
- **CREATE** `logs/` — directorio con `.htaccess` de protección.
- **MODIFY** `.htaccess` — HTTPS activo, HSTS, eliminar `X-XSS-Protection`, eliminar cabeceras CORS/CSP (pasan a CorsConfig), agregar `vistas/` al bloqueo.
- **MODIFY** `controladores/CriptoCtrl.php` — eliminar `$baseUrl`, `array_slice`, `strpos`→`str_ends_with`, normalizar precio.
- **MODIFY** `controladores/ForexCtrl.php` — eliminar `$baseUrl`, constantes para `usleep`.
- **MODIFY** `controladores/IndiceCtrl.php` — eliminar `$baseUrl`.
- **MODIFY** `controladores/BaseCtrl.php` — versión desde `APP_VERSION`, timestamp ISO 8601, eliminar `require_once` de `ProveedorNoDisponibleException`.
- **MODIFY** `index.php` — añadir `JSON_UNESCAPED_UNICODE`, `APP_VERSION`, timestamp ISO 8601, eliminar `Content-Type` redundante.
- **MODIFY** `rutas/*Rts.php` — centralizar lógica en un solo archivo parametrizado.
- **MODIFY** `vistas/landing.php` — reemplazar endpoints incorrectos por los reales del servicio.
- **MODIFY** `README.md` — actualizar al estado post-RF-002/RF-003/RF-004.

---

## 3. Out-of-scope (qué NO entra)

- No se implementa caché para APIs externas (queda como deuda técnica documentada).
- No se implementa autenticación JWT, rate limiting ni API key por consumidor.
- No se implementa autoloader PSR-4 / Composer.
- No se refactoriza la lógica de negocio de los controladores (solo limpieza de código muerto y normalización de formatos).
- No se cambia el contrato de datos de éxito de los endpoints.
- No se modifican `modelos/*Mdl.php` (no presentan defectos de seguridad/duplicación).
- No se modifican `configuracion/global.php` más allá de lo descrito (las constantes `BINANCE_BASE_URL`, `FRANKFURTER_BASE_URL`, `FMP_BASE_URL`, `PRO_NOMBRE` se mantienen).

---

## 4. Impacto en contratos públicos

**NO-BREAKING.** Ningún endpoint cambia su ruta, método, entrada, código de éxito ni contrato de datos.
El único cambio observable podría ser la adición de `Strict-Transport-Security` y la redirección
HTTPS, que son transparentes para clientes HTTP correctos. Los formatos de timestamp y precio se
normalizan pero dentro del mismo tipo (`string`), por lo que no hay cambio de contrato.

| Método | Ruta | Entrada | Éxito | Error |
|--------|------|---------|-------|-------|
| GET | `/rest_divisas/cripto` | ninguna | 200 health-check (sin cambios) | 405/502/500 (sin cambios) |
| GET | `/rest_divisas/cripto/disponible` | ninguna | 200 arreglo `{symbol,name,price,type}` (price formateado a 6 decimales, antes crudo) | 502/500 (sin cambios) |
| GET | `/rest_divisas/forex` | ninguna | 200 health-check (sin cambios) | 405/502/500 (sin cambios) |
| GET | `/rest_divisas/forex/disponible` | ninguna | 200 arreglo (sin cambios) | 502/500 (sin cambios) |
| GET | `/rest_divisas/indice` | ninguna | 200 health-check (sin cambios) | 405/502/500 (sin cambios) |
| GET | `/rest_divisas/indice/disponible` | ninguna | 200 arreglo (sin cambios) | 502/500 (sin cambios) |

> **Nota sobre `price` en cripto:** antes del refactor, `CriptoCtrl` devolvía el precio crudo de
> Binance (ej. `"0.12345678"`). Con la normalización, se aplicará `number_format` con 6 decimales
> (ej. `"0.123457"`), consistente con forex e índice. El tipo sigue siendo `string`.

---

## 5. Compatibilidad

**NO-BREAKING.** Los endpoints y contratos de éxito se preservan. El formato de `price` en cripto
cambia ligeramente (aplicación de `number_format`), pero sigue siendo `string` y el README ya
documenta el tipo sin especificar formato. Las cabeceras de seguridad adicionales (HSTS, HTTPS) son
mejoras no rompientes. La eliminación de `X-XSS-Protection` no afecta a navegadores modernos
(usan CSP). La centralización de `*Rts.php` es transparente (misma salida).

---

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Configuración | `configuracion/global.php`, `configuracion/.env.example`, `.gitignore` | MODIFY / CREATE |
| Configuración | `configuracion/ClienteHttp.php`, `configuracion/CorsConfig.php` | MODIFY |
| Infraestructura | `logs/` | CREATE |
| Infraestructura | `.htaccess` | MODIFY |
| Controlador | `controladores/CriptoCtrl.php`, `ForexCtrl.php`, `IndiceCtrl.php`, `BaseCtrl.php` | MODIFY |
| Front Controller | `index.php` | MODIFY |
| Ruteo | `rutas/` (centralizar lógica) | MODIFY |
| Vista | `vistas/landing.php` | MODIFY |
| Documentación | `README.md` | MODIFY |

Servicio único: `rest_divisas`. No hay cambios en `modelos/`.

---

## 7. Delta arquitectónico

### 7.0. Decisiones cerradas de diseño (trazables al RF)

1. **Externalización de API key (A1/S1).** En `configuracion/global.php`, se reemplaza
   `define("FMP_API_KEY", "mlS7...")` por `define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "")`.
   Se crea `configuracion/.env.example` con las variables `FMP_API_KEY`, `CORS_ORIGIN`,
   `APP_VERSION`. Se añaden las constantes `CORS_ORIGIN` (con valor por defecto
   `http://localhost:8100`) y `APP_VERSION` (con valor `1.0.0`).
2. **Creación de `.gitignore` (A16/M3).** En la raíz del servicio, se crea `.gitignore` que ignora
   `configuracion/.env`, `logs/`, `anexos/`.
3. **Sanitización de excepciones en `ClienteHttp` (A8/S7).** Los mensajes de las excepciones
   `ProveedorNoDisponibleException` ya no incluyen la URL completa ni el mensaje crudo de cURL.
   Se registra solo el contexto mínimo: código HTTP, dominio del host (sin path) y tipo de error.
4. **CORS y CSP configurables (A3/A4/S3/S4).** `CorsConfig::configurar()` lee `CORS_ORIGIN` de
   `global.php` en lugar del valor hardcodeado en `.htaccess`. La política CSP se define en
   `CorsConfig.php` sin `cdnjs.cloudflare.com` (ya no se usa) y sin `'unsafe-inline'` en
   `script-src`. Se eliminan las cabeceras CORS y CSP del `.htaccess`.
5. **HTTPS y HSTS (A5/S6).** Se descomenta y activa la redirección HTTP→HTTPS en `.htaccess`.
   Se añade `Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"`.
6. **Bloqueo de `vistas/` (A6/S10).** Se añade `vistas` a la regla `RewriteRule` de bloqueo de
   directorios (que ya existe como bloque único desde RF-001).
7. **Limpieza de cabeceras deprecadas (A7/S9).** Se elimina `X-XSS-Protection` del `.htaccess`.
   Se eliminan cabeceras CORS y CSP del `.htaccess` (pasan a `CorsConfig.php`).
8. **Eliminación de propiedades muertas en controladores (A10/D2).** Se eliminan las propiedades
   `$baseUrl` de los tres controladores (las URLs se leen de las constantes en `global.php` vía
   `Mdl`). Se elimina `array_slice` de `CriptoCtrl`.
9. **Normalización de formato en controladores (A10/A12/D5/D6/D9/D10).** `CriptoCtrl` aplica
   `number_format` con 6 decimales al precio (consistente con forex e índice). Usa `str_ends_with`
   en lugar de `strpos` para filtrar USDT/BUSD. `BaseCtrl::despachar()` usa `APP_VERSION` y
   `date('c')` para timestamp. `index.php` usa `APP_VERSION`, `date('c')` y
   `JSON_UNESCAPED_UNICODE` en todos los `json_encode`.
10. **Constantes para `usleep` (A12/D8).** En `ForexCtrl` se definen constantes de clase
    `CHUNK_DELAY_US = 50000` y `BASE_DELAY_US = 150000` reemplazando los números mágicos.
11. **Eliminación de `Content-Type` redundante (A10/D3).** `index.php` ya no setea
    `Content-Type: application/json` (lo hace `CorsConfig::configurar()` al inicio y
    `BaseCtrl::respuestaJsonSimple` para respuestas).
12. **Centralización de `require_once` (A11/D7).** `BaseCtrl.php` ya no requiere
    `ProveedorNoDisponibleException.php` (solo `ClienteHttp.php` lo necesita directamente;
    el `catch` funciona porque la clase ya está cargada por `ClienteHttp.php` antes de llegar
    a `BaseCtrl` en el flujo de ejecución).
13. **Centralización de `*Rts.php` (A13/D1).** Los tres archivos `CriptoRts.php`, `ForexRts.php`,
    `IndiceRts.php` de 6 líneas cada uno se reemplazan por un solo archivo centralizado o
    parametrizado que recibe dominio, controlador y mapa de acciones.
14. **Actualización de `landing.php` (A15/M2).** Reemplazar endpoints incorrectos en la lista
    (`/empresa`, `/persona`, etc.) por los reales del servicio.
15. **Actualización de `README.md` (A14/M1).** Reflejar arquitectura actual sin `enlace.php`,
    `DB_*`, `PlanesRTS` ni `"detalle"`.

### 7.1. Tabla de Delta

| Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
|------|---------------------------|--------|-----------------|
| Config | `configuracion/global.php` | MODIFY | Reemplazar `define("FMP_API_KEY", "mlS7...")` por `getenv()`. Añadir `CORS_ORIGIN` y `APP_VERSION`. |
| Config | `configuracion/.env.example` | CREATE | Plantilla con `FMP_API_KEY`, `CORS_ORIGIN`, `APP_VERSION`. |
| Config | `.gitignore` | CREATE | Ignorar `configuracion/.env`, `logs/`, `anexos/`. |
| Config | `configuracion/ClienteHttp.php` | MODIFY | Sanitizar mensajes de excepción: no incluir URL completa ni mensaje crudo de cURL. |
| Config | `configuracion/CorsConfig.php` | MODIFY | Añadir `require_once(__DIR__ . '/global.php')`. Leer `CORS_ORIGIN` de constante. Definir CSP sin CDN ni `unsafe-inline`. Eliminar comentario muerto. |
| Infra | `logs/` | CREATE | Crear directorio con `.htaccess` de denegación (`Require all denied`). |
| Infra | `.htaccess` | MODIFY | HTTPS activo, HSTS, eliminar `X-XSS-Protection`, eliminar cabeceras CORS/CSP (pasan a `CorsConfig`), agregar `vistas/` al bloqueo. |
| Controlador | `controladores/CriptoCtrl.php` | MODIFY | Eliminar `$baseUrl`, `array_slice`; `strpos`→`str_ends_with`; `number_format` en precio. |
| Controlador | `controladores/ForexCtrl.php` | MODIFY | Eliminar `$baseUrl`; constantes `CHUNK_DELAY_US` y `BASE_DELAY_US`. |
| Controlador | `controladores/IndiceCtrl.php` | MODIFY | Eliminar `$baseUrl` (lee `FMP_API_KEY` de constante global). |
| Controlador | `controladores/BaseCtrl.php` | MODIFY | `APP_VERSION` para versión, `date('c')` para timestamp, eliminar `require ProveedorNoDisponibleException`. |
| Front | `index.php` | MODIFY | `JSON_UNESCAPED_UNICODE` en todos los `json_encode`; `APP_VERSION`; `date('c')`; eliminar `Content-Type` redundante. |
| Ruteo | `rutas/CriptoRts.php` | MODIFY | Centralizar: contenido mínimo que delega en archivo compartido. |
| Ruteo | `rutas/ForexRts.php` | MODIFY | Centralizar: contenido mínimo que delega en archivo compartido. |
| Ruteo | `rutas/IndiceRts.php` | MODIFY | Centralizar: contenido mínimo que delega en archivo compartido. |
| Ruteo | `rutas/RuteoCentralizado.php` | CREATE | Nuevo archivo con la lógica de despacho parametrizada. |
| Vista | `vistas/landing.php` | MODIFY | Reemplazar endpoints ficticios por los reales del servicio. |
| Docs | `README.md` | MODIFY | Eliminar referencias a `enlace.php`, `DB_*`, `PlanesRTS`, `"detalle"`. Reflejar arquitectura actual. |

### 7.2. Cadena de dependencias `require_once`

- `ClienteHttp.php` requiere `ProveedorNoDisponibleException.php` (sin cambios).
- `BaseCtrl.php` ya no requiere `ProveedorNoDisponibleException.php` (se carga vía `ClienteHttp` antes en el flujo).
- `CorsConfig.php` requiere `global.php` (nuevo, para leer `CORS_ORIGIN`).
- `index.php` ya requiere `CorsConfig.php` (sin cambios).
- `rutas/CriptoRts.php`, `ForexRts.php`, `IndiceRts.php` requieren archivo centralizado (nuevo).

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción |
|---------------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/global.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/.env.example` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/.gitignore` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/ClienteHttp.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/CorsConfig.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/logs/` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/logs/.htaccess` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/.htaccess` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/CriptoCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/ForexCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/IndiceCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/BaseCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/index.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/CriptoRts.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/ForexRts.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/IndiceRts.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/rutas/RuteoCentralizado.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/vistas/landing.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/README.md` | MODIFY |

---

## 9. Estrategia de validación

Cada comprobación es una tarea con checkbox (T17–T25) en §12. Las verificaciones sobre HTTP asumen
Apache sirviendo el servicio en `http://localhost/rest_divisas/`; las verificaciones sobre el código
inspeccionan los archivos del servicio.

- **Sin secretos en código (A1):** inspeccionar `global.php`; confirmar que `FMP_API_KEY` usa
  `getenv()` y no contiene el valor literal. Confirmar que existe `.env.example`.
- **Directorios creados (A2):** verificar que `logs/` existe y que `logs/` tiene `.htaccess` de protección.
  (Nota: `errors/` ya fue creado por RF-001.)
- **CORS/CSP (A3/A4):** inspeccionar `CorsConfig.php`; confirmar que lee `CORS_ORIGIN` de
  `global.php` y que CSP no contiene `cdnjs.cloudflare.com` ni `unsafe-inline` en `script-src`.
- **.htaccess (A5/A6/A7):** inspeccionar `.htaccess`; confirmar HTTPS activo, HSTS presente,
  sin `X-XSS-Protection`, sin cabeceras CORS/CSP, bloqueo incluye `vistas/`.
- **Controladores (A10/A12/A14):** inspeccionar los tres `Ctrl`; confirmar sin `$baseUrl`,
  `CriptoCtrl` sin `array_slice` y con `str_ends_with`; `ForexCtrl` con constantes `*_DELAY_US`;
  `BaseCtrl` con `APP_VERSION` y `date('c')`.
- **index.php (A9/A10):** inspeccionar; confirmar `JSON_UNESCAPED_UNICODE`, `APP_VERSION`,
  `date('c')`, sin `Content-Type` redundante.
- **Centralización Rts (A13):** inspeccionar `rutas/`; confirmar que existe `RuteoCentralizado.php`
  y que los tres `*Rts.php` delegan en él.
- **landing.php (A15):** inspeccionar; confirmar endpoints reales del servicio.
- **README (A14):** inspeccionar; confirmar sin referencias a `enlace.php`, `DB_*`, `PlanesRTS`.
- **Sin regresión HTTP:** solicitar health-check y datos de los tres dominios; confirmar 200.

---

## 10. Riesgos

- **Externalización de API key rompe el servicio si no hay variable de entorno.** Si `FMP_API_KEY`
  no está definida como variable de entorno, el servicio de índices dejará de funcionar (enviará
  clave vacía → 401/403 de FMP). *Mitigación:* el valor por defecto es cadena vacía, no un crash;
  el error se captura como 502. Se documenta en `.env.example` la necesidad de configurar la variable.
- **Regresión de formato de precio en cripto.** El cambio de precio crudo a `number_format` con
  6 decimales podría afectar a consumidores que parsean el precio con precisión variable.
  *Mitigación:* el README documenta `price` como `string` sin especificar formato; el cambio es
  hacia la consistencia con forex e índice.
- **Cambios en `.htaccess` pueden romper el servidor.** Una directiva malformada en `.htaccess`
  puede causar 500 Internal Server Error en todo el servicio. *Mitigación:* verificar con
  `apachectl configtest` después de cada cambio.
- **Centralización de `*Rts.php` puede romper el ruteo.** Si la lógica centralizada no replica
  exactamente el despacho actual, los endpoints pueden dejar de responder. *Mitigación:* verificar
  health checks de los tres dominios después del cambio.

---

## 11. Rollback

- **Global:** restaurar desde el control de versiones todos los archivos MODIFY (`global.php`,
  `ClienteHttp.php`, `CorsConfig.php`, `.htaccess`, los cuatro `Ctrl`, `index.php`, `CriptoRts.php`,
  `ForexRts.php`, `IndiceRts.php`, `landing.php`, `README.md`), y eliminar directorios/archivos
  CREATE (`logs/`, `RuteoCentralizado.php`, `.env.example`, `.gitignore`).
- **Por artefacto:** revertir cada archivo a su versión previa o eliminar el directorio/archivo
  creado correspondiente.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` =
> realizado y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado, con razón. Un
> checkbox = una acción verificable. El agente implementador **actualiza cada checkbox al completar y
> verificar** la tarea, y solo entonces. Todos se entregan en `[ ]`. Orden por capa:
> Config → Infraestructura → Controlador → Front Controller → Ruteo → Vistas → Documentación → validaciones.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_divisas` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/` |
| Front controller | `index.php` (mapa `$rutas` + `str_starts_with` de prefijo) |
| Capa de datos | APIs externas (Binance, Frankfurter, Financial Modeling Prep) vía `ClienteHttp` |
| Capa de respuesta | `controladores/BaseCtrl.php` (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`) |
| Configuración | `configuracion/global.php` (constantes: `FMP_API_KEY`, `BINANCE_BASE_URL`, `FRANKFURTER_BASE_URL`, `FMP_BASE_URL`, `CORS_ORIGIN`, `APP_VERSION`) |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `GET http://localhost/rest_divisas/cripto` (200, `service:"CriptoRTS"`) |
| Logs | `logs/php_errors.log` del servicio |
| Nota importante | Las variables de entorno deben configurarse en el servidor (Apache `SetEnv` o `.env`). Ver `.env.example`. Tareas RF-001 ya ejecutadas aparecen en `[X]`. |

### Grupo A — Configuración / infraestructura compartida

- `[ ]` **T1** | `configuracion/global.php` | MODIFY — Reemplazar `define("FMP_API_KEY", "mlS7...")`
  por `define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "")`. Añadir constantes `CORS_ORIGIN`
  (`http://localhost:8100`) y `APP_VERSION` (`1.0.0`) (A1/A3/A10).

- `[ ]` **T2** | `configuracion/.env.example` | CREATE — Crear archivo con las variables
  `FMP_API_KEY`, `CORS_ORIGIN`, `APP_VERSION` y comentarios explicativos (A1).

- `[ ]` **T3** | `.gitignore` | CREATE — Crear archivo en la raíz del servicio que ignore
  `configuracion/.env`, `logs/`, `anexos/` (A16/M3).

- `[ ]` **T4** | `configuracion/ClienteHttp.php` | MODIFY — Sanitizar los mensajes de las
  excepciones `ProveedorNoDisponibleException`: no incluir la URL completa ni el mensaje crudo
  de `curl_error()`. Usar solo dominio del host y tipo de error (A8/S7).

- `[ ]` **T5** | `configuracion/CorsConfig.php` | MODIFY — Añadir `require_once(__DIR__ . '/global.php')`.
  En `configurar()`, leer `CORS_ORIGIN` de la constante en lugar del valor fijo. Definir la política
  CSP localmente sin `cdnjs.cloudflare.com` y sin `'unsafe-inline'` en `script-src`. Eliminar
  el comentario muerto "CORS ya está configurados en .htaccess". Las cabeceras CORS y CSP se
  eliminan del `.htaccess` (A3/A4/D11).

### Grupo B — Infraestructura (directorios y `.htaccess`)

- `[ ]` **T6** | `logs/` + `logs/.htaccess` | CREATE — Crear directorio `logs/` y dentro un
  `.htaccess` con `Require all denied` (A2).

- `[X]` **T7** | `errors/` + páginas HTML | CREATE *(ejecutado por RF-001)* — El directorio
  `errors/` ya existe con las 5 páginas HTML (`400.html`, `401.html`, `403.html`, `404.html`,
  `500.html`). Verificar su existencia (A2).

- `[ ]` **T8** | `.htaccess` | MODIFY — (a) Descomentar y activar redirección HTTPS;
  (b) añadir `Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"`;
  (c) eliminar `Header always set X-XSS-Protection "1; mode=block"`;
  (d) eliminar la cabecera CSP (se define ahora en `CorsConfig.php`);
  (e) eliminar `Header always set Access-Control-Allow-Origin "http://localhost:8100"` (se
  define ahora en `CorsConfig.php`);
  (f) en el bloque `RewriteRule` de bloqueo, añadir `vistas` a la lista de directorios
  (A3/A4/A5/A6/A7/S6/S9/S10).

### Grupo C — Controladores

- `[ ]` **T9** | `controladores/CriptoCtrl.php` | MODIFY — Eliminar propiedad `$baseUrl`. Eliminar
  `array_slice`. Reemplazar `strpos($crypto['symbol'], 'USDT')` por
  `str_ends_with($crypto['symbol'], 'USDT')` (y lo mismo para BUSD). Aplicar `number_format` a
  `$crypto['lastPrice']` con 6 decimales para consistencia (A10/A14/D2/D5/D9/D10).

- `[ ]` **T10** | `controladores/ForexCtrl.php` | MODIFY — Eliminar propiedad `$baseUrl`. Definir
  constantes de clase `CHUNK_DELAY_US = 50000` y `BASE_DELAY_US = 150000`. Reemplazar los valores
  literales `50000`, `150000` por las constantes (A10/A12/D2/D8).

- `[ ]` **T11** | `controladores/IndiceCtrl.php` | MODIFY — Eliminar propiedad `$baseUrl`
  (A10/D2).

- `[ ]` **T12** | `controladores/BaseCtrl.php` | MODIFY — Eliminar la línea
  `require_once(__DIR__ . '/../configuracion/ProveedorNoDisponibleException.php')`. En
  `despachar()`, usar `APP_VERSION` para la versión (no el string literal `"1.0.0"`) y
  `date('c')` para timestamp (en lugar de `date('Y-m-d H:i:s')`) (A10/A11/D4/D6/D7).

### Grupo D — Front Controller

- `[ ]` **T13** | `index.php` | MODIFY — (a) Añadir `JSON_UNESCAPED_UNICODE` a todos los
  `json_encode()` que carecen de él; (b) usar `APP_VERSION` en lugar del literal `"1.0.0"`;
  (c) usar `date('c')` en lugar de formatos no ISO 8601; (d) eliminar la línea
  `header('Content-Type: application/json; charset=utf-8')` (redundante con `CorsConfig` y
  `BaseCtrl`) (A9/A10/D3/D4/D6).

### Grupo E — Ruteo

- `[ ]` **T14** | `rutas/RuteoCentralizado.php` | CREATE — Crear archivo con función/clase
  estática que reciba `$dominio`, `$nombreServicio`, `$controlador`, `$mapaAcciones` y ejecute
  el despacho. La lógica replica la que hoy está duplicada en los tres `*Rts.php`.
  Cada `*Rts.php` requiere este archivo y llama a la función centralizada (A13/D1).

- `[ ]` **T15** | `rutas/CriptoRts.php` | MODIFY — Reemplazar contenido actual por:
  `require_once(__DIR__ . '/RuteoCentralizado.php');` + llamada a función centralizada.
  Ídem para `ForexRts.php` e `IndiceRts.php` (A13/D1).

### Grupo F — Vistas

- `[ ]` **T16** | `vistas/landing.php` | MODIFY — Reemplazar los endpoints incorrectos
  (`/empresa`, `/persona`, `/usuario`, `/categoria`, `/producto`) por los reales del servicio:
  `/cripto/disponible`, `/forex/disponible`, `/indice/disponible` (A15/M2).

### Grupo G — Documentación

- `[ ]` **T17** | `README.md` | MODIFY — Eliminar o actualizar secciones que referencian:
  `configuracion/enlace.php`, constantes `DB_*`, `PlanesRTS` en health-check, campo `"detalle"`
  en errores. Reflejar la arquitectura actual con capa `Mdl`, `ClienteHttp`, `BaseCtrl::despachar`,
  y constantes reales en `global.php` (A14/M1).

### Grupo H — Validaciones

- `[ ]` **T18** | Validación — sin secretos en código (A1) — Inspeccionar `configuracion/global.php`.
  **Esperado:** `define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "")` (sin valor literal).
  Existe `configuracion/.env.example`.

- `[ ]` **T19** | Validación — directorios (A2) — Verificar existencia de `logs/` con `.htaccess` de
  protección y `errors/` con 5 páginas HTML (creado por RF-001). **Esperado:** `logs/` y `errors/`
  existen, contienen los archivos esperados.

- `[ ]` **T20** | Validación — CORS/CSP (A3/A4) — Inspeccionar `configuracion/CorsConfig.php`.
  **Esperado:** lee `CORS_ORIGIN` de `global.php`. CSP sin `cdnjs.cloudflare.com` y sin
  `'unsafe-inline'` en `script-src`. `.htaccess` no tiene cabeceras CORS ni CSP.

- `[ ]` **T21** | Validación — `.htaccess` (A5/A6/A7) — Inspeccionar `.htaccess`.
  **Esperado:** HTTPS activo, HSTS presente, sin `X-XSS-Protection`, sin cabeceras CORS/CSP,
  bloqueo incluye `vistas/`.

- `[ ]` **T22** | Validación — controladores (A10/A12/A14) — Inspeccionar los tres `*Ctrl.php` y
  `BaseCtrl.php`. **Esperado:** ningún controlador tiene `$baseUrl`; `CriptoCtrl` usa
  `str_ends_with` y `number_format` y no tiene `array_slice`; `ForexCtrl` tiene constantes
  `*_DELAY_US`; `BaseCtrl` usa `APP_VERSION` y `date('c')`.

- `[ ]` **T23** | Validación — `index.php` y ruteo (A9/A10/A13) — Inspeccionar `index.php` y
  `rutas/`. **Esperado:** `index.php` — todos los `json_encode` tienen `JSON_UNESCAPED_UNICODE`;
  usa `APP_VERSION`; usa `date('c')`; no define `Content-Type` redundante. `rutas/` — existe
  `RuteoCentralizado.php`; los tres `*Rts.php` delegan en él.

- `[ ]` **T24** | Validación — `landing.php` y `README.md` (A14/A15) — Inspeccionar ambos archivos.
  **Esperado:** `landing.php` lista endpoints reales (`/cripto/disponible`, etc.). `README.md`
  sin menciones a `enlace.php`, `DB_*`, `PlanesRTS`, `"detalle"`.

- `[ ]` **T25** | Validación — sin regresión HTTP — Solicitar health-check y datos de los tres
  dominios. **Esperado:** 200 en todos los endpoints: `GET /rest_divisas/cripto`,
  `GET /rest_divisas/forex`, `GET /rest_divisas/indice`,
  `GET /rest_divisas/cripto/disponible`, `GET /rest_divisas/forex/disponible`,
  `GET /rest_divisas/indice/disponible`.

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 25
- Completadas [X]: _(1 — T7 ejecutada por RF-001)_
- Bloqueadas [BLOCKED]: _(pendiente)_
- Omitidas: _(pendiente)_

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | configuracion/global.php |  |
| T2 |  | configuracion/.env.example |  |
| T3 |  | .gitignore |  |
| T4 |  | configuracion/ClienteHttp.php |  |
| T5 |  | configuracion/CorsConfig.php |  |
| T6 |  | logs/ + logs/.htaccess |  |
| T7 | X | errors/ + páginas HTML | Ejecutado por RF-001 |
| T8 |  | .htaccess |  |
| T9 |  | controladores/CriptoCtrl.php |  |
| T10 |  | controladores/ForexCtrl.php |  |
| T11 |  | controladores/IndiceCtrl.php |  |
| T12 |  | controladores/BaseCtrl.php |  |
| T13 |  | index.php |  |
| T14 |  | rutas/RuteoCentralizado.php |  |
| T15 |  | rutas/*Rts.php (3 archivos) |  |
| T16 |  | vistas/landing.php |  |
| T17 |  | README.md |  |
| T18 |  | (validación) |  |
| T19 |  | (validación) |  |
| T20 |  | (validación) |  |
| T21 |  | (validación) |  |
| T22 |  | (validación) |  |
| T23 |  | (validación) |  |
| T24 |  | (validación) |  |
| T25 |  | (validación) |  |

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
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T25 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
