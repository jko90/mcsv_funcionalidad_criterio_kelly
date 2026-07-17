# RF-004 — Corrección de seguridad y eliminación de duplicidad en `rest_divisas`

> **Tipo:** Refactor / Seguridad / Deuda técnica.
> **Servicio afectado:** `rest_divisas`.
> **Archivos objetivo:** `configuracion/global.php`, `.htaccess`, `controladores/*Ctrl.php`,
> `configuracion/CorsConfig.php`, `rutas/*Rts.php`, `README.md`, `vistas/landing.php`,
> `configuracion/ClienteHttp.php`, `configuracion/.env.example`, `.gitignore`.
> **Prioridad:** Alta (incluye corrección de vulnerabilidad crítica: API key hardcodeada).
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `RF-001_refactor_htaccess.md` (parcialmente ejecutado),
> `RF-002_refactor_codigo_backend.md`, `RF-003_refactor_index.md`.
> **Ejecutado por RF-001:** `errors/` creado, bloques `mod_rewrite` unificados, hotlinking
> eliminado, `php_value` protegido con `<IfModule mod_php.c>`, placeholder muerto eliminado.

---

## 1. Historia de usuario

> **Como** desarrollador backend y administrador de seguridad del servicio `rest_divisas`,
> **quiero** eliminar las vulnerabilidades detectadas (API key en texto plano, exposiciones de
> información, CORS mal configurado, CSP desalineado, HTTPS ausente, directorios faltantes) y
> reducir la duplicación de código (propiedades muertas, headers redundantes, archivos
> estructuralmente idénticos, errores inline sin normalizar),
> **para** que el servicio sea desplegable en producción sin riesgo de fuga de secretos,
> manteniendo una base de código limpia, consistente y con documentación actualizada.

---

## 2. Contexto y problema actual

Se realizó una auditoría completa del código de `rest_divisas` tras los refactores RF-001
(.htaccess), RF-002 (capas `Rts→Ctrl→Mdl`) y RF-003 (Front Controller). Se encontraron los
siguientes defectos, considerando que RF-001 ya corrigió parte del `.htaccess`:

### Defectos de seguridad

| # | Defecto detectado | Evidencia | Riesgo |
|---|-------------------|-----------|--------|
| S1 | **API key de FMP hardcodeada en texto plano versionada.** La clave `mlS7wcZXGdqMNU9DZ8VSoxOU5eX8hePW` está en `configuracion/global.php` como constante literal, sujeta a control de versiones. Además viaja en la URL a FMP, quedando expuesta en logs del servidor y en `ClienteHttp` al lanzar excepciones. | `configuracion/global.php:3`, `configuracion/ClienteHttp.php:28`, `modelos/IndiceMdl.php:10` | CRÍTICO — cualquier persona con acceso al repo puede usar la clave; además se filtra en logs |
| S2 | **`logs/` no existe.** PHP no puede escribir el log de errores configurado en `.htaccess:121`. | Sistema de archivos — no existe directorio `logs/` | ALTO — imposibilidad de diagnóstico y monitoreo |
| S3 | **Origen CORS hardcodeado a `localhost:8100`.** No hay constante configurable; en producción, cualquier SPA desde otro origen será bloqueado. | `.htaccess:12` | ALTO — bloquea el frontend en producción |
| S4 | **CSP permite `unsafe-inline` y CDN que ya no se usa (`cdnjs.cloudflare.com`).** La landing page no carga Font Awesome desde cdnjs, pero CSP sigue permitiéndolo. Además el CSP está hardcodeado en `.htaccess` en vez de ser configurable programáticamente. | `.htaccess:30` | ALTO — debilita la protección XSS |
| S5 | **Sin autenticación ni rate limiting.** Todos los endpoints son públicos, la API key de FMP puede ser consumida sin control. | Todos los endpoints | ALTO — riesgo de abuso y costos no controlados |
| S6 | **Redirección HTTPS comentada.** El tráfico viaja en texto plano, incluyendo la API key de FMP (en URL de request a FMP). | `.htaccess:92-93` | MEDIO — tráfico sin cifrar |
| S7 | **Mensajes de excepción con URLs completas en `ClienteHttp`.** Expone la URL entera (incluyendo API key) en logs y en la excepción. | `configuracion/ClienteHttp.php:28` | MEDIO — fuga de API key y arquitectura interna en logs |
| S8 | **Error 404/500 sin `JSON_UNESCAPED_UNICODE` en `index.php`.** Inconsistente con el resto del servicio que sí lo usa. | `index.php:52,64` | BAJO |
| S9 | **Cabecera `X-XSS-Protection` deprecada** presente en `.htaccess`. Puede introducir vulnerabilidades mXSS en navegadores modernos. | `.htaccess:18` | BAJO |
| S10 | **Directorio `vistas/` no bloqueado** en la regla de denegación de acceso directo. | `.htaccess:84` — solo bloquea `configuracion|rutas|modelos|controladores|logs` | BAJO |

### Defectos de duplicación

| # | Defecto detectado | Evidencia |
|---|-------------------|-----------|
| D1 | **Tres archivos `*Rts.php` estructuralmente idénticos.** Cada uno repite require + instanciación + despacho. | `rutas/CriptoRts.php`, `rutas/ForexRts.php`, `rutas/IndiceRts.php` (6 líneas c/u, único cambio: nombre) |
| D2 | **URLs base duplicadas entre constantes y propiedades muertas.** `global.php` define `BINANCE_BASE_URL`, etc., pero los controladores además tienen `$baseUrl` sin uso. | `global.php:5-9` vs `CriptoCtrl.php:8`, `ForexCtrl.php:8`, `IndiceCtrl.php:8` |
| D3 | **`Content-Type` seteado en 3 lugares.** `CorsConfig::configurar()`, `index.php:24` y `BaseCtrl::respuestaJsonSimple()` hacen lo mismo. | `CorsConfig.php:13`, `index.php:24`, `BaseCtrl.php:44` |
| D4 | **Versión `"1.0.0"` hardcodeada en 2 lugares.** `index.php` y `BaseCtrl::despachar()`. | `index.php:28`, `BaseCtrl.php:75` |
| D5 | **Formato de precio inconsistente.** Cripto usa precio crudo (`$crypto['lastPrice']`), forex e índice usan `number_format` con 6 decimales. | `CriptoCtrl.php:29`, `ForexCtrl.php:64`, `IndiceCtrl.php:31` |
| D6 | **Formato de timestamp inconsistente.** `index.php` usa `date('c')` (ISO 8601), `BaseCtrl` usa `date('Y-m-d H:i:s')`. | `index.php:27,54,67`, `BaseCtrl.php:74` |
| D7 | **`require_once` de `ProveedorNoDisponibleException` en 2 archivos.** `BaseCtrl.php` y `ClienteHttp.php` lo requieren (ambos lo usan directamente). | `BaseCtrl.php:3`, `ClienteHttp.php:3` |
| D8 | **`usleep` con números mágicos repetidos.** 50000 y 150000 aparecen sin constante ni comentario explicativo. | `ForexCtrl.php:46,51,69,72` |
| D9 | **`array_slice` con límite `100000` en CriptoCtrl.** Sin efecto real, valor placeholder. | `CriptoCtrl.php:35` |
| D10 | **`strpos` para filtrar USDT/BUSD.** Debería ser `str_ends_with` para matching preciso de sufijo. | `CriptoCtrl.php:22-25` |
| D11 | **Comentario muerto en CorsConfig.** "CORS ya está configurados en .htaccess" — lógica sin efecto. | `CorsConfig.php:15-16` |

### Defectos de documentación, configuración y despliegue

| # | Defecto detectado | Evidencia |
|---|-------------------|-----------|
| M1 | **`README.md` desactualizado.** Referencia `enlace.php`, `DB_*`, `PlanesRTS`, `"detalle"` en errores — nada de eso existe post-RF-002/RF-003. | `README.md` líneas 83-84, 135-141, 208, 217 |
| M2 | **`vistas/landing.php` con endpoints incorrectos.** La landing page lista `/empresa`, `/persona`, `/usuario`, `/categoria`, `/producto` que no pertenecen a este microservicio. | `vistas/landing.php:344-349` |
| M3 | **No existe `.gitignore` en la raíz del servicio.** No hay forma de excluir archivos sensibles (`.env`, `logs/`) del control de versiones. | Sistema de archivos — no existe `.gitignore` |
| M4 | **No existe `configuracion/.env.example`.** No hay plantilla de variables de entorno para nuevos desarrolladores. | Sistema de archivos — no existe `.env.example` |
| M5 | **Sin capa de caché.** Cada request hace llamadas frescas a APIs externas; forex hace ~30 requests anidados. | `modelos/*Mdl.php` |

---

## 3. Objetivo del refactor

1. Externalizar el secreto de FMP a variable de entorno / `.env` (eliminar del código versionado).
2. Crear directorio `logs/` faltante y protegerlo.
3. Parametrizar CORS y CSP leyendo desde configuración (`global.php`), eliminar CDN no usado y `unsafe-inline`.
4. Agregar `vistas/` al bloqueo de directorios en `.htaccess`.
5. Eliminar propiedades muertas, headers redundantes, y normalizar formatos (timestamp, precio, versión).
6. Reducir duplicación en `*Rts.php`, `*Ctrl.php` y `require_once`.
7. Sanitizar mensajes de excepción en `ClienteHttp`.
8. Actualizar `README.md` y `landing.php` al estado actual del código.
9. Crear `.gitignore` y `.env.example` para higiene de despliegue.
10. Recomendar (sin implementar) capa de caché, autenticación y rate limiting como deuda futura.

---

## 4. Alcance (in-scope)

- **A1. Externalizar API key a variable de entorno.** Reemplazar `define("FMP_API_KEY", "mlS7...")` por `define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "")` en `global.php`. Crear `configuracion/.env.example` con las variables documentadas (`FMP_API_KEY`, `CORS_ORIGIN`). Añadir `configuracion/.env` y `logs/` al `.gitignore`.
- **A2. Crear directorio `logs/`.** Crear `logs/` con `.htaccess` de denegación ("Require all denied").
- **A3. Parametrizar CORS.** Mover el origen permitido de `.htaccess` a `configuracion/global.php` como constante `CORS_ORIGIN`, leerla en `CorsConfig.php`.
- **A4. Ajustar CSP.** Eliminar `cdnjs.cloudflare.com` del CSP (ya no se usa), eliminar `'unsafe-inline'` de `script-src`, mover la definición a `CorsConfig.php` para control programático desde `global.php`.
- **A5. Forzar HTTPS.** Descomentar y activar la redirección HTTPS en `.htaccess`, añadir cabecera `Strict-Transport-Security`.
- **A6. Agregar `vistas/` al bloqueo de directorios.** Añadir `vistas` a la regla `RewriteRule ^/?(configuracion|rutas|modelos|controladores|logs|vistas)(/.*)?$ - [F,L]`.
- **A7. Eliminar `X-XSS-Protection`.** Retirar la cabecera deprecada del `.htaccess`.
- **A8. Sanitizar mensajes de excepción en `ClienteHttp`.** No incluir URL completa ni mensaje crudo de cURL en la excepción ni en `error_log`; solo el contexto necesario (nombre del proveedor, código HTTP).
- **A9. Normalizar errores en `index.php`.** Añadir `JSON_UNESCAPED_UNICODE` a todos los `json_encode`. Eliminar el `header('Content-Type')` redundante en `index.php` (ya lo fija `CorsConfig`). Unificar timestamp a ISO 8601 en `BaseCtrl`.
- **A10. Eliminar código duplicado y propiedades muertas.** Eliminar `$baseUrl` de `CriptoCtrl`, `ForexCtrl`, `IndiceCtrl`. Centralizar versión como constante `APP_VERSION` en `global.php`. Eliminar `array_slice` en `CriptoCtrl`. Reemplazar `strpos` por `str_ends_with` en filtro USDT/BUSD. Normalizar formato de precio con `number_format` 6 decimales en `CriptoCtrl`.
- **A11. Centralizar `require_once` de `ProveedorNoDisponibleException`.** Cargarla solo en `ClienteHttp.php`; `BaseCtrl.php` no la requiere directamente.
- **A12. Definir constantes para `usleep` en `ForexCtrl`.** Nombrar `CHUNK_DELAY_US` y `BASE_DELAY_US` con comentario explicativo.
- **A13. Centralizar ruteo de `*Rts.php`.** Reducir los tres archivos a una sola lógica parametrizada o un archivo compartido que reciba el dominio, controlador y mapa de acciones.
- **A14. Actualizar `README.md`.** Reflejar la arquitectura post-RF-002/RF-003 sin `enlace.php`, `DB_*`, `PlanesRTS` ni `"detalle"`.
- **A15. Actualizar `landing.php`.** Reemplazar los endpoints incorrectos (`/empresa`, `/persona`, etc.) por los reales del servicio (`/cripto/disponible`, `/forex/disponible`, `/indice/disponible`).
- **A16. Crear `.gitignore`.** Ignorar `configuracion/.env`, `logs/`, `anexos/`.

---

## 5. Fuera de alcance (out-of-scope)

- **No** se implementa caché para APIs externas (se documenta como deuda técnica).
- **No** se implementa autenticación JWT, rate limiting ni API key por consumidor.
- **No** se implementa un autoloader PSR-4 (requiere Composer, fuera del alcance).
- **No** se refactoriza la lógica de negocio de los controladores (solo se eliminan propiedades muertas y se normalizan formatos).
- **No** se cambia el contrato de datos de éxito de los endpoints.
- **No** se modifica `RF-001`, `RF-002` ni `RF-003`; este RF es posterior y acumulativo.

---

## 6. Reglas de negocio y restricciones

- **R1 — Sin secretos en código versionado.** Ninguna clave de API, contraseña o token aparece en archivos trackeados por Git. Toda configuración sensible se lee de variables de entorno.
- **R2 — Consistencia de formato.** Todas las respuestas JSON usan `JSON_UNESCAPED_UNICODE`. Todos los timestamps usan ISO 8601 (`date('c')`). Todos los precios usan `number_format` con 6 decimales. La versión del servicio se lee de una constante única.
- **R3 — CORS y CSP configurables.** El origen CORS y la política CSP se definen en `configuracion/global.php`, no en `.htaccess`.
- **R4 — Sin código muerto.** No quedan propiedades sin uso, archivos de documentación obsoleta, ni directivas Apache que apunten a recursos inexistentes.
- **R5 — Compatibilidad hacia atrás.** Los endpoints públicos y sus contratos de datos no cambian.
- **R6 — Funcionalidad observable preservada.** El servicio responde igual que antes en todos los endpoints existentes.

---

## 7. Criterios de aceptación

```gherkin
Dado el código refactorizado
Cuando reviso configuracion/global.php
Entonces FMP_API_KEY se obtiene de getenv(), no está hardcodeada
  Y existe la constante CORS_ORIGIN
  Y existe la constante APP_VERSION
  Y existe configuracion/.env.example con las variables documentadas

Dado el código refactorizado
Cuando reviso el sistema de archivos
Entonces existe el directorio logs/
  Y logs/ tiene .htaccess con "Require all denied"
  Y existe .gitignore que ignora configuracion/.env y logs/

Dado el código refactorizado
Cuando reviso configuracion/CorsConfig.php
Entonces lee CORS_ORIGIN desde global.php
  Y define el CSP sin cdnjs.cloudflare.com
  Y script-src no incluye 'unsafe-inline'

Dado el código refactorizado
Cuando reviso .htaccess
Entonces la redirección HTTPS está activa (no comentada)
  Y existe Strict-Transport-Security
  Y no existe X-XSS-Protection
  Y el bloqueo de directorios incluye vistas/

Dado el código refactorizado
Cuando reviso controladores/*Ctrl.php
Entonces ningún controlador tiene propiedad $baseUrl
  Y CriptoCtrl no tiene array_slice
  Y CriptoCtrl usa str_ends_with en lugar de strpos
  Y el formato de precio es consistente (number_format 6 decimales)
  Y ForexCtrl tiene constantes para usleep

Dado el código refactorizado
Cuando reviso index.php y BaseCtrl.php
Entonces version usa APP_VERSION (constante en global.php)
  Y todos los timestamps usan date('c') (ISO 8601)
  Y todos los json_encode tienen JSON_UNESCAPED_UNICODE
  Y index.php no define header Content-Type (ya lo hace CorsConfig)

Dado el código refactorizado
Cuando reviso configuracion/ClienteHttp.php
Entonces los mensajes de excepción no incluyen URLs completas ni mensajes crudos de cURL

Dado el código refactorizado
Cuando reviso rutas/*Rts.php
Entonces no hay tres archivos idénticos; existe una lógica centralizada o parametrizada

Dado el código refactorizado
Cuando reviso README.md
Entonces no menciona enlace.php, DB_*, PlanesRTS ni "detalle"
  Y refleja la arquitectura con Mdl, ClienteHttp y global.php actual

Dado el código refactorizado
Cuando reviso vistas/landing.php
Entonces los endpoints listados son /cripto/disponible, /forex/disponible, /indice/disponible
  Y no aparecen /empresa, /persona, /usuario, /categoria, /producto
```

---

## 8. Tareas técnicas derivadas (alto nivel)

- [ ] Externalizar `FMP_API_KEY` a variable de entorno, crear `.env.example` (A1).
- [ ] Crear directorio `logs/` con protección (A2).
- [ ] Parametrizar CORS: constante `CORS_ORIGIN` en `global.php`, leer en `CorsConfig.php` (A3).
- [ ] Ajustar CSP: eliminar CDN y `unsafe-inline`, mover a `CorsConfig.php` (A4).
- [ ] Activar redirección HTTPS y `Strict-Transport-Security` (A5).
- [ ] Agregar `vistas/` al bloqueo de directorios (A6).
- [ ] Eliminar `X-XSS-Protection` del `.htaccess` (A7).
- [ ] Sanitizar excepciones en `ClienteHttp` (A8).
- [ ] Normalizar errores en `index.php`: `JSON_UNESCAPED_UNICODE`, eliminar `Content-Type` redundante (A9).
- [ ] Unificar timestamp a ISO 8601 en `BaseCtrl` (A9).
- [ ] Eliminar `$baseUrl` de los 3 controladores (A10).
- [ ] Centralizar `APP_VERSION` en `global.php` (A10).
- [ ] Eliminar `array_slice` en `CriptoCtrl` (A10).
- [ ] Reemplazar `strpos` por `str_ends_with` en `CriptoCtrl` (A10).
- [ ] Normalizar precio con `number_format` 6 decimales en `CriptoCtrl` (A10).
- [ ] Centralizar `require_once` de `ProveedorNoDisponibleException` (A11).
- [ ] Definir constantes para `usleep` en `ForexCtrl` (A12).
- [ ] Centralizar ruteo de `*Rts.php` (A13).
- [ ] Actualizar `README.md` (A14).
- [ ] Actualizar `landing.php` con endpoints reales (A15).
- [ ] Crear `.gitignore` (A16).
- [ ] Verificar todos los criterios de aceptación con inspección de código y `curl`.

---

## 9. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. No existe ningún secreto hardcodeado en archivos versionados del servicio.
2. El directorio `logs/` existe, está protegido e ignorado por Git.
3. CORS y CSP son configurables desde `global.php`; no hay valores hardcodeados en `.htaccess`.
4. HTTPS está activo, las cabeceras de seguridad están actualizadas y no hay cabeceras deprecadas.
5. El bloqueo de directorios es consistente e incluye `vistas/`.
6. No hay propiedades sin uso, headers redundantes, ni código muerto en `.htaccess`.
7. Los formatos de timestamp, precio y versión son consistentes en todo el servicio.
8. Los mensajes de excepción no exponen detalles internos ni API keys en logs.
9. Los tres `*Rts.php` no se duplican; existe una lógica centralizada.
10. `README.md` y `landing.php` reflejan el estado actual del código.
11. Existe `.gitignore` y `.env.example`.
12. Los criterios de aceptación de §7 se cumplieron y verificaron.
13. Los endpoints existentes funcionan idéntico a antes del refactor.
14. Se respetan las restricciones R1–R6 y las convenciones del repo (`CLAUDE.md`).
