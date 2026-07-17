# HLT-RF-004 — Contrato Técnico de Alto Nivel: Corrección de seguridad y eliminación de duplicidad en `rest_divisas`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-004_seguridad_duplicidad.md`](../rf/RF-004_seguridad_duplicidad.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `docs/hlt/HLT-RF-002_refactor_codigo_backend.md`, `docs/hlt/HLT-RF-003_refactor_index.md`.
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
- Un senior debe aprobar el HLT (§6 de `doc_modo_planificacion.md`) antes de que el agente
  implementador ejecute tarea alguna. Al aprobar, cambiar `Aprobación senior` a `APROBADO` y el
  `Estado` a `EN EJECUCIÓN`.
- El agente implementador **solo** puede cambiar el `Estado` del HLT a **`COMPLETADO`** cuando se
  cumplan **todas** estas condiciones simultáneamente:
  1. **Todas** las tareas `T1`–`T22` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T14`–`T22`) se ejecutaron y su resultado observado **coincide** con
     el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`** (no `COMPLETADO`).
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`** o
  **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Corregir las 14 vulnerabilidades de seguridad detectadas en `rest_divisas` (incluyendo API key
hardcodeada en texto plano, directorios faltantes que exponen paths del servidor, CORS fijo a
localhost, CSP desalineado, cabeceras deprecadas, bloqueo inconsistente de directorios y ausencia
de HTTPS) y eliminar los 10 focos de duplicación de código identificados (propiedades muertas,
headers redundantes, archivos estructuralmente idénticos, formatos inconsistentes, números mágicos
y documentación desactualizada) — sin alterar el contrato público de los endpoints existentes.

---

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en `rest_divisas`:

- **MODIFY** `configuracion/global.php` — externalizar API key a variable de entorno, añadir `CORS_ORIGIN`, `APP_VERSION`.
- **CREATE** `configuracion/.env.example` — plantilla de variables de entorno.
- **MODIFY** `configuracion/ClienteHttp.php` — sanitizar mensajes de excepción (sin URLs ni mensajes crudos de cURL).
- **MODIFY** `configuracion/CorsConfig.php` — leer CORS desde constante, definir CSP sin CDN/`unsafe-inline`.
- **CREATE** `logs/` — directorio con `.htaccess` de protección.
- **CREATE** `errors/` — directorio con páginas HTML para 400/401/403/404/500.
- **MODIFY** `.htaccess` — HTTPS activo, HSTS, eliminar `X-XSS-Protection`, hotlinking, unificar bloqueo, `php_value` protegido, agregar `vistas/`.
- **MODIFY** `controladores/CriptoCtrl.php` — eliminar `$baseUrl`, `array_slice`, `strpos`→`str_ends_with`, normalizar precio.
- **MODIFY** `controladores/ForexCtrl.php` — eliminar `$baseUrl`, constantes para `usleep`.
- **MODIFY** `controladores/IndiceCtrl.php` — eliminar `$baseUrl`, `$apiKey` (leer de `FMP_API_KEY`).
- **MODIFY** `controladores/BaseCtrl.php` — versión desde `APP_VERSION`, timestamp ISO 8601, eliminar `require_once` de `ProveedorNoDisponibleException`.
- **MODIFY** `index.php` — añadir `JSON_UNESCAPED_UNICODE`, timestamp ISO 8601, eliminar `Content-Type` redundante.
- **MODIFY** `README.md` — actualizar al estado post-RF-002/RF-003.

---

## 3. Out-of-scope (qué NO entra)

- No se implementa caché para APIs externas (queda como deuda técnica documentada).
- No se implementa autenticación JWT, rate limiting ni API key por consumidor.
- No se implementa autoloader PSR-4 / Composer.
- No se refactoriza la lógica de negocio de los controladores (solo limpieza de código muerto).
- No se cambia el contrato de datos de éxito de los endpoints.
- No se modifican los `rutas/*Rts.php` (ya refactorizados en RF-002) ni `vistas/landing.php` (RF-003).
- No se modifica `modelos/*Mdl.php` (no presentan defectos de seguridad/duplicación).

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
(usan CSP).

---

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Configuración | `configuracion/global.php`, `configuracion/.env.example` | MODIFY / CREATE |
| Configuración | `configuracion/ClienteHttp.php`, `configuracion/CorsConfig.php` | MODIFY |
| Infraestructura | `logs/`, `errors/` | CREATE |
| Infraestructura | `.htaccess` | MODIFY |
| Controlador | `controladores/CriptoCtrl.php`, `ForexCtrl.php`, `IndiceCtrl.php`, `BaseCtrl.php` | MODIFY |
| Front Controller | `index.php` | MODIFY |
| Documentación | `README.md` | MODIFY |

Servicio único: `rest_divisas`. No hay cambios en `modelos/`, `rutas/` ni `vistas/`.

---

## 7. Delta arquitectónico

### 7.0. Decisiones cerradas de diseño (trazables al RF)

1. **Externalización de API key (A1/S1).** En `configuracion/global.php`, se reemplaza
   `define("FMP_API_KEY", "mlS7...")` por `define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "")`.
   Se crea `configuracion/.env.example` con las variables `FMP_API_KEY`, `CORS_ORIGIN`,
   `DB_HOST`/`DB_*` (solo como referencia, este servicio no usa BD). Se añaden las constantes
   `CORS_ORIGIN` (con valor por defecto `http://localhost:8100`) y `APP_VERSION` (con valor `1.0.0`).
2. **Sanitización de excepciones en `ClienteHttp` (A8/S9).** Los mensajes de las excepciones
   `ProveedorNoDisponibleException` ya no incluyen la URL completa ni el mensaje crudo de cURL.
   Se registra solo el contexto mínimo: código HTTP, dominio del host (sin path) y tipo de error.
3. **CORS y CSP configurables (A3/A4/S4/S5).** `CorsConfig::configurar()` lee `CORS_ORIGIN` de
   `global.php` en lugar del valor hardcodeado en `.htaccess`. La política CSP se define en
   `CorsConfig.php` sin `cdnjs.cloudflare.com` (ya no se usa) y sin `'unsafe-inline'` en
   `script-src`. Se elimina la cabecera CSP del `.htaccess`.
4. **HTTPS y HSTS (A5/S8).** Se descomenta y activa la redirección HTTP→HTTPS en `.htaccess`.
   Se añade `Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"`.
5. **Bloqueo de directorios unificado (A6/S13).** Se elimina `RedirectMatch 403` (línea 86) y se
   unifica todo el bloqueo en un único bloque `RewriteRule` con `[F,L]` (403). Se agrega `vistas/`
   a la lista de directorios bloqueados.
6. **Protección de directivas PHP (A7/S7).** Las directivas `php_value`/`php_flag` se envuelven en
   `<IfModule mod_php.c>` para evitar errores 500 en servidores con PHP-FPM/FastCGI.
7. **Limpieza de código muerto en `.htaccess` (A12/S11/S12).** Se eliminan: cabecera
   `X-XSS-Protection`, bloque de hotlinking protection, directivas redundantes.
8. **Eliminación de propiedades muertas en controladores (A10/D2).** Se eliminan las propiedades
   `$baseUrl` de los tres controladores (las URLs se leen de las constantes en `global.php` vía
   `Mdl`). Se elimina `$apiKey` de `IndiceCtrl` (lee de `FMP_API_KEY`). Se elimina
   `array_slice` de `CriptoCtrl`.
9. **Normalización de formato en controladores (A10/A14/D5/D6/D9/D10).** `CriptoCtrl` aplica
   `number_format` con 6 decimales al precio (consistente con forex e índice). Usa `str_ends_with`
   en lugar de `strpos` para filtrar USDT/BUSD. `BaseCtrl::despachar()` usa `APP_VERSION` y
   `date('c')` para timestamp. `index.php` usa `APP_VERSION`, `date('c')` y
   `JSON_UNESCAPED_UNICODE` en todos los `json_encode`.
10. **Constantes para `usleep` (A15/D8).** En `ForexCtrl` se definen constantes de clase
    `CHUNK_DELAY_US = 50000` y `BASE_DELAY_US = 150000` reemplazando los números mágicos.
11. **Eliminación de `Content-Type` redundante (A10/D3).** `index.php` ya no setea
    `Content-Type: application/json` (lo hace `CorsConfig::configurar()` al inicio y
    `BaseCtrl::respuestaJsonSimple` para respuestas).
12. **Centralización de `require_once` (A11/D7).** `BaseCtrl.php` ya no requiere
    `ProveedorNoDisponibleException.php` (solo `ClienteHttp.php` lo necesita directamente;
    el `catch` funciona porque la clase ya está cargada por `ClienteHttp.php` antes de llegar
    a `BaseCtrl` en el flujo de ejecución).

### 7.1. Tabla de Delta

| Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
|------|---------------------------|--------|-----------------|
| Config | `configuracion/global.php` | MODIFY | Reemplazar `define("FMP_API_KEY", "mlS7...")` por `getenv()`. Añadir `CORS_ORIGIN` y `APP_VERSION`. |
| Config | `configuracion/.env.example` | CREATE | Plantilla con `FMP_API_KEY`, `CORS_ORIGIN`, `APP_VERSION`. |
| Config | `configuracion/ClienteHttp.php` | MODIFY | Sanitizar mensajes de excepción: no incluir URL completa ni mensaje crudo de cURL. |
| Config | `configuracion/CorsConfig.php` | MODIFY | Leer `CORS_ORIGIN` de constante. Definir CSP sin CDN ni `unsafe-inline`. |
| Infra | `logs/` | CREATE | Crear directorio con `.htaccess` de denegación (`Require all denied`). |
| Infra | `errors/` | CREATE | Crear directorio con páginas HTML mínimas: `400.html`, `401.html`, `403.html`, `404.html`, `500.html`. |
| Infra | `.htaccess` | MODIFY | HTTPS activo, HSTS, eliminar `X-XSS-Protection`, hotlinking, unificar bloqueo a RewriteRule [F,L], agregar `vistas/`, proteger `php_value` con `<IfModule mod_php.c>`. |
| Controlador | `controladores/CriptoCtrl.php` | MODIFY | Eliminar `$baseUrl`, `array_slice`; `strpos`→`str_ends_with`; `number_format` en precio. |
| Controlador | `controladores/ForexCtrl.php` | MODIFY | Eliminar `$baseUrl`; constantes `CHUNK_DELAY_US` y `BASE_DELAY_US`. |
| Controlador | `controladores/IndiceCtrl.php` | MODIFY | Eliminar `$baseUrl`, `$apiKey` (lee de `FMP_API_KEY`). |
| Controlador | `controladores/BaseCtrl.php` | MODIFY | `APP_VERSION` para versión, `date('c')` para timestamp, eliminar `require ProveedorNoDisponibleException`. |
| Front | `index.php` | MODIFY | `JSON_UNESCAPED_UNICODE` en todos los `json_encode`; `APP_VERSION`; `date('c')`; eliminar `Content-Type` redundante. |
| Docs | `README.md` | MODIFY | Eliminar referencias a `enlace.php`, `DB_*`, `PlanesRTS`, `"detalle"`. Reflejar arquitectura con Mdl/ClienteHttp. |

### 7.2. Cadena de dependencias `require_once`

- `ClienteHttp.php` requiere `ProveedorNoDisponibleException.php` (sin cambios).
- `BaseCtrl.php` ya no requiere `ProveedorNoDisponibleException.php` (se carga vía `ClienteHttp` antes en el flujo).
- `CorsConfig.php` requiere `global.php` (nuevo, para leer `CORS_ORIGIN`).
- `index.php` ya requiere `CorsConfig.php` (sin cambios).

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción |
|---------------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/global.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/.env.example` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/ClienteHttp.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/configuracion/CorsConfig.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/logs/` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/logs/.htaccess` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/errors/` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/errors/{400,401,403,404,500}.html` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/.htaccess` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/CriptoCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/ForexCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/IndiceCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/controladores/BaseCtrl.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/index.php` | MODIFY |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/README.md` | MODIFY |

---

## 9. Estrategia de validación

Cada comprobación es una tarea con checkbox (T14–T22) en §12. Las verificaciones sobre HTTP asumen
Apache sirviendo el servicio en `http://localhost/rest_divisas/`; las verificaciones sobre el código
inspeccionan los archivos del servicio.

- **Sin secretos en código (A1):** inspeccionar `global.php`; confirmar que `FMP_API_KEY` usa
  `getenv()` y no contiene el valor literal. Confirmar que existe `.env.example`.
- **Directorios creados (A2):** verificar que `logs/` y `errors/` existen y que `logs/` tiene
  `.htaccess` de protección. Verificar que `errors/` contiene las 5 páginas HTML.
- **CORS/CSP (A3/A4):** inspeccionar `CorsConfig.php`; confirmar que lee `CORS_ORIGIN` de
  `global.php` y que CSP no contiene `cdnjs.cloudflare.com` ni `unsafe-inline` en `script-src`.
- **.htaccess (A5/A6/A7/A12):** inspeccionar `.htaccess`; confirmar HTTPS activo, HSTS presente,
  sin `X-XSS-Protection`, sin hotlinking, bloqueo unificado con `vistas/` incluido,
  `php_value` dentro de `<IfModule mod_php.c>`.
- **Controladores (A10/A14/A15):** inspeccionar los tres `Ctrl`; confirmar sin `$baseUrl`,
  `CriptoCtrl` sin `array_slice` y con `str_ends_with`; `ForexCtrl` con constantes `*_DELAY_US`;
  `BaseCtrl` con `APP_VERSION` y `date('c')`.
- **index.php (A9/A10):** inspeccionar; confirmar `JSON_UNESCAPED_UNICODE`, `APP_VERSION`,
  `date('c')`, sin `Content-Type` redundante.
- **README (A13):** inspeccionar; confirmar sin referencias a `enlace.php`, `DB_*`, `PlanesRTS`.
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

---

## 11. Rollback

- **Global:** restaurar desde el control de versiones todos los archivos MODIFY (`global.php`,
  `ClienteHttp.php`, `CorsConfig.php`, `.htaccess`, los cuatro `Ctrl`, `index.php`, `README.md`),
  y eliminar directorios/archivos CREATE (`logs/`, `errors/`, `.env.example`).
- **Por artefacto:** revertir cada archivo a su versión previa o eliminar el directorio/archivo
  creado correspondiente.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` =
> realizado y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado, con razón. Un
> checkbox = una acción verificable. El agente implementador **actualiza cada checkbox al completar y
> verificar** la tarea, y solo entonces. Todos se entregan en `[ ]`. Orden por capa:
> Config → Infraestructura → Controlador → Front Controller → Documentación → validaciones.

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
| Nota importante | Las variables de entorno deben configurarse en el servidor (Apache `SetEnv` o `.env`). Ver `.env.example`. |

### Grupo A — Configuración / infraestructura compartida

- `[ ]` **T1** | `configuracion/global.php` | MODIFY — Reemplazar `define("FMP_API_KEY", "mlS7...")`
  por `define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "")`. Añadir constantes `CORS_ORIGIN`
  (`http://localhost:8100`) y `APP_VERSION` (`1.0.0`) (A1/A3/A10).

- `[ ]` **T2** | `configuracion/.env.example` | CREATE — Crear archivo con las variables
  `FMP_API_KEY`, `CORS_ORIGIN`, `APP_VERSION` y comentarios explicativos (A1).

- `[ ]` **T3** | `configuracion/ClienteHttp.php` | MODIFY — Sanitizar los mensajes de las
  excepciones `ProveedorNoDisponibleException`: no incluir la URL completa ni el mensaje crudo
  de `curl_error()`. Usar solo dominio del host y tipo de error (A8/S9).

- `[ ]` **T4** | `configuracion/CorsConfig.php` | MODIFY — Añadir `require_once(__DIR__ . '/global.php')`.
  En `configurar()`, leer `CORS_ORIGIN` de la constante en lugar del valor fijo. Definir la política
  CSP localmente sin `cdnjs.cloudflare.com` y sin `'unsafe-inline'` en `script-src`. Eliminar
  la cabecera CSP del `.htaccess` (A3/A4).

### Grupo B — Infraestructura (directorios y `.htaccess`)

- `[ ]` **T5** | `logs/` + `logs/.htaccess` | CREATE — Crear directorio `logs/` y dentro un
  `.htaccess` con `Require all denied` (A2).

- `[ ]` **T6** | `errors/` + páginas HTML | CREATE — Crear directorio `errors/` con cinco archivos:
  `400.html`, `401.html`, `403.html`, `404.html`, `500.html`. Cada uno con HTML mínimo autónomo
  (título y mensaje descriptivo, sin CSS/JS externos) (A2).

- `[ ]` **T7** | `.htaccess` | MODIFY — (a) Descomentar y activar redirección HTTPS (líneas 134-136);
  (b) añadir `Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"`;
  (c) eliminar `Header always set X-XSS-Protection "1; mode=block"` (línea 18);
  (d) eliminar bloque de hotlinking protection (líneas 172-177);
  (e) eliminar `RedirectMatch 403` (línea 86);
  (f) en el bloque `RewriteRule` de bloqueo (líneas 110-123), añadir `vistas/` a la lista y
  cambiar a `[F,L]` (403);
  (g) envolver las directivas `php_value`/`php_flag` (líneas 157-167) en `<IfModule mod_php.c>`;
  (h) eliminar la cabecera CSP (se define ahora en `CorsConfig.php`);
  (i) eliminar el `Header always set Access-Control-Allow-Origin "http://localhost:8100"` (se
  define ahora en `CorsConfig.php`) (A3/A4/A5/A6/A7/A12).

### Grupo C — Controladores

- `[ ]` **T8** | `controladores/CriptoCtrl.php` | MODIFY — Eliminar propiedad `$baseUrl`. Eliminar
  `array_slice`. Reemplazar `strpos($crypto['symbol'], 'USDT')` por
  `str_ends_with($crypto['symbol'], 'USDT')` (y lo mismo para BUSD). Aplicar `number_format` a
  `$crypto['lastPrice']` con 6 decimales para consistencia (A10/A14/D2/D5/D9/D10).

- `[ ]` **T9** | `controladores/ForexCtrl.php` | MODIFY — Eliminar propiedad `$baseUrl`. Definir
  constantes de clase `CHUNK_DELAY_US = 50000` y `BASE_DELAY_US = 150000`. Reemplazar los valores
  literales `50000`, `150000` por las constantes (A10/A15/D2/D8).

- `[ ]` **T10** | `controladores/IndiceCtrl.php` | MODIFY — Eliminar propiedades `$baseUrl` y
  `$apiKey`. En el constructor, leer `$this->apiKey = FMP_API_KEY` (la constante de `global.php`)
  (A10/D2).

- `[ ]` **T11** | `controladores/BaseCtrl.php` | MODIFY — Eliminar la línea
  `require_once(__DIR__ . '/../configuracion/ProveedorNoDisponibleException.php')`. En
  `despachar()`, usar `APP_VERSION` para la versión (no el string literal `"1.0.0"`) y
  `date('c')` para timestamp (en lugar de `date('Y-m-d H:i:s')`) (A10/A11/D4/D6/D7).

### Grupo D — Front Controller

- `[ ]` **T12** | `index.php` | MODIFY — (a) Añadir `JSON_UNESCAPED_UNICODE` a todos los
  `json_encode()` que carecen de él; (b) usar `APP_VERSION` en lugar del literal `"1.0.0"`;
  (c) usar `date('c')` en lugar de formatos no ISO 8601; (d) eliminar la línea
  `header('Content-Type: application/json; charset=utf-8')` (redundante con `CorsConfig` y
  `BaseCtrl`) (A9/A10/D3/D4/D6).

### Grupo E — Documentación

- `[ ]` **T13** | `README.md` | MODIFY — Eliminar o actualizar secciones que referencian:
  `configuracion/enlace.php`, constantes `DB_*`, `PlanesRTS` en health-check, campo `"detalle"`
  en errores. Reflejar la arquitectura actual con capa `Mdl`, `ClienteHttp`, `BaseCtrl::despachar`,
  y constantes reales en `global.php` (A13/M1).

### Grupo F — Validaciones

- `[ ]` **T14** | Validación — sin secretos en código (A1) — Inspeccionar `configuracion/global.php`.
  **Esperado:** `define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "")` (sin valor literal).
  Existe `configuracion/.env.example`.

- `[ ]` **T15** | Validación — directorios (A2) — Verificar existencia de `logs/` con `.htaccess` de
  protección y `errors/` con 5 páginas HTML. **Esperado:** directorios existen y contienen los
  archivos esperados.

- `[ ]` **T16** | Validación — CORS/CSP (A3/A4) — Inspeccionar `configuracion/CorsConfig.php`.
  **Esperado:** lee `CORS_ORIGIN` de `global.php`. CSP sin `cdnjs.cloudflare.com` y sin
  `'unsafe-inline'` en `script-src`. `.htaccess` no tiene cabeceras CORS ni CSP.

- `[ ]` **T17** | Validación — `.htaccess` (A5/A6/A7/A12) — Inspeccionar `.htaccess`.
  **Esperado:** HTTPS activo, HSTS presente, sin `X-XSS-Protection`, sin hotlinking,
  bloqueo unificado con `vistas/`, `php_value` en `<IfModule mod_php.c>`.

- `[ ]` **T18** | Validación — controladores (A10/A14/A15) — Inspeccionar los tres `*Ctrl.php` y
  `BaseCtrl.php`. **Esperado:** ningún controlador tiene `$baseUrl`; `CriptoCtrl` usa
  `str_ends_with` y `number_format` y no tiene `array_slice`; `ForexCtrl` tiene constantes
  `*_DELAY_US`; `BaseCtrl` usa `APP_VERSION` y `date('c')`.

- `[ ]` **T19** | Validación — `index.php` (A9/A10) — Inspeccionar `index.php`.
  **Esperado:** todos los `json_encode` tienen `JSON_UNESCAPED_UNICODE`; usa `APP_VERSION`;
  usa `date('c')`; no define `Content-Type` redundante.

- `[ ]` **T20** | Validación — `README.md` (A13) — Inspeccionar `README.md`.
  **Esperado:** sin menciones a `enlace.php`, `DB_*`, `PlanesRTS`, `"detalle"`.

- `[ ]` **T21** | Validación — sin regresión health-check — Solicitar `GET /rest_divisas/cripto`,
  `GET /rest_divisas/forex`, `GET /rest_divisas/indice`. **Esperado:** 200 con
  `service:"CriptoRTS"`/`"ForexRTS"`/`"IndiceRTS"`.

- `[ ]` **T22** | Validación — sin regresión datos — Solicitar
  `GET /rest_divisas/cripto/disponible`, `GET /rest_divisas/forex/disponible`,
  `GET /rest_divisas/indice/disponible`. **Esperado:** 200 con arreglo de
  `{symbol,name,price,type}`.

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 22
- Completadas [X]: _(pendiente)_
- Bloqueadas [BLOCKED]: _(pendiente)_
- Omitidas: _(pendiente)_

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | configuracion/global.php |  |
| T2 |  | configuracion/.env.example |  |
| T3 |  | configuracion/ClienteHttp.php |  |
| T4 |  | configuracion/CorsConfig.php |  |
| T5 |  | logs/ + logs/.htaccess |  |
| T6 |  | errors/ + páginas HTML |  |
| T7 |  | .htaccess |  |
| T8 |  | controladores/CriptoCtrl.php |  |
| T9 |  | controladores/ForexCtrl.php |  |
| T10 |  | controladores/IndiceCtrl.php |  |
| T11 |  | controladores/BaseCtrl.php |  |
| T12 |  | index.php |  |
| T13 |  | README.md |  |
| T14 |  | (validación) |  |
| T15 |  | (validación) |  |
| T16 |  | (validación) |  |
| T17 |  | (validación) |  |
| T18 |  | (validación) |  |
| T19 |  | (validación) |  |
| T20 |  | (validación) |  |
| T21 |  | (validación) |  |
| T22 |  | (validación) |  |

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
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T22 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
