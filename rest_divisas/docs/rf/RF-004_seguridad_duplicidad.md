# RF-004 — Corrección de seguridad y eliminación de duplicidad en `rest_divisas`

> **Tipo:** Refactor / Seguridad / Deuda técnica.
> **Servicio afectado:** `rest_divisas`.
> **Archivos objetivo:** `configuracion/global.php`, `.htaccess`, `controladores/*Ctrl.php`,
> `configuracion/CorsConfig.php`, `rutas/*Rts.php`, `README.md`, `vistas/landing.php`,
> `configuracion/ClienteHttp.php`.
> **Prioridad:** Alta (incluye corrección de vulnerabilidad crítica: API key hardcodeada).
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `RF-002_refactor_codigo_backend.md`, `RF-003_refactor_index.md`.

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

Se realizó una auditoría completa del código de `rest_divisas` tras los refactores RF-002 (capas
`Rts→Ctrl→Mdl`) y RF-003 (Front Controller). Se encontraron los siguientes defectos:

### Defectos de seguridad

| # | Defecto detectado | Evidencia | Riesgo |
|---|-------------------|-----------|--------|
| S1 | **API key de FMP hardcodeada en texto plano versionada.** La clave `mlS7wcZXGdqMNU9DZ8VSoxOU5eX8hePW` está en `configuracion/global.php` como constante literal, sujeta a control de versiones. | `configuracion/global.php:3` | CRÍTICO — cualquier persona con acceso al repo puede usarla |
| S2 | **`ErrorDocument` apunta a directorio inexistente.** Apache no encuentra `errors/*.html` y expone la ruta real del servidor en el fallback. | `.htaccess:148-152` | ALTO — fuga de información de path del servidor |
| S3 | **`logs/` no existe.** PHP no puede escribir el log de errores, los errores se pierden. | `.htaccess:167` | ALTO — imposibilidad de diagnóstico y monitoreo |
| S4 | **Origen CORS hardcodeado a `localhost:8100`.** En producción, cualquier SPA desde otro origen será bloqueado. | `.htaccess:12` | ALTO — bloquea el frontend en producción |
| S5 | **CSP permite `unsafe-inline` y CDN que ya no se usa.** La landing page ya no carga Font Awesome desde cdnjs, pero CSP sigue permitiéndolo. | `.htaccess:30` | ALTO — debilita la protección XSS |
| S6 | **Sin autenticación ni rate limiting.** Todos los endpoints son públicos, la API key de FMP puede ser consumida sin control. | Todos los endpoints | ALTO — riesgo de abuso y costos no controlados |
| S7 | **Directivas `php_value` sin protección.** En servidores con PHP-FPM/FastCGI, estas directivas causan 500. | `.htaccess:157-167` | MEDIO — incompatible con configuraciones modernas de PHP |
| S8 | **Redirección HTTPS comentada.** El tráfico viaja en texto plano, incluyendo la API key de FMP (en URL de request). | `.htaccess:134-136` | MEDIO — tráfico sin cifrar |
| S9 | **Mensajes de excepción con URLs completas.** `ClienteHttp` registra URLs enteras en logs. | `configuracion/ClienteHttp.php:23-34` | MEDIO — fuga de arquitectura interna en logs |
| S10 | **Error 404 sin `JSON_UNESCAPED_UNICODE`.** Inconsistente con el resto del servicio. | `index.php:52-68` | BAJO |
| S11 | **Cabecera `X-XSS-Protection` deprecada.** Puede introducir vulnerabilidades mXSS en navegadores modernos. | `.htaccess:18` | BAJO |
| S12 | **Hotlinking protection para recursos que no existen.** El servicio no sirve imágenes, CSS ni JS. | `.htaccess:172-177` | BAJO — código muerto |
| S13 | **Bloqueo de directorios inconsistente.** `RedirectMatch` (403) y `RewriteRule` (301) conviven para el mismo propósito. | `.htaccess:86,110-123` | BAJO |
| S14 | **Directorio `vistas/` no bloqueado.** Acceso directo posible a archivos en `vistas/`. | `.htaccess:86,110-123` | BAJO |

### Defectos de duplicación

| # | Defecto detectado | Evidencia |
|---|-------------------|-----------|
| D1 | **Tres archivos `*Rts.php` estructuralmente idénticos.** Cada uno repite require + instanciación + despacho. | `rutas/CriptoRts.php`, `rutas/ForexRts.php`, `rutas/IndiceRts.php` (6 líneas c/u, único cambio: nombre) |
| D2 | **URLs base duplicadas entre constantes y propiedades muertas.** `global.php` define `BINANCE_BASE_URL`, etc., pero los controladores además tienen `$baseUrl` sin uso. | `global.php:5-9` vs `CriptoCtrl.php:8`, `ForexCtrl.php:8`, `IndiceCtrl.php:8` |
| D3 | **`Content-Type` seteado en 3 lugares.** `CorsConfig::configurar()`, `index.php:24` y `BaseCtrl::respuestaJsonSimple()` hacen lo mismo. | `CorsConfig.php:13`, `index.php:24`, `BaseCtrl.php:44` |
| D4 | **Versión `"1.0.0"` hardcodeada en 2 lugares.** `index.php` y `BaseCtrl::despachar()`. | `index.php:28`, `BaseCtrl.php:75` |
| D5 | **Formato de precio inconsistente.** Cripto usa precio crudo, forex e índice usan `number_format` con 6 decimales. | `CriptoCtrl.php:29`, `ForexCtrl.php:64`, `IndiceCtrl.php:31` |
| D6 | **Formato de timestamp inconsistente.** `index.php` usa `date('c')` (ISO 8601), `BaseCtrl` usa `date('Y-m-d H:i:s')`. | `index.php:27,54,67`, `BaseCtrl.php:74` |
| D7 | **`require_once` de `ProveedorNoDisponibleException` en 2 archivos.** `BaseCtrl.php` y `ClienteHttp.php` lo requieren. | `BaseCtrl.php:3`, `ClienteHttp.php:3` |
| D8 | **`usleep` con números mágicos repetidos.** 50000 y 150000 aparecen sin constante ni comentario. | `ForexCtrl.php:46,51,69,72` |
| D9 | **`array_slice` con límite `100000` en CriptoCtrl.** Sin efecto real, valor placeholder. | `CriptoCtrl.php:35` |
| D10 | **`strpos` para filtro USDT/BUSD.** Debería ser `str_ends_with` para matching preciso. | `CriptoCtrl.php:22-25` |

### Defectos de documentación y configuración

| # | Defecto detectado | Evidencia |
|---|-------------------|-----------|
| M1 | **`README.md` desactualizado.** Referencia `enlace.php`, `DB_*`, `PlanesRTS`, `"detalle"` en errores — nada de eso existe post-RF-002. | `README.md` líneas 83-84, 135-141, 208 |
| M2 | **Sin capa de caché.** Cada request hace llamadas frescas a APIs externas; forex hace ~30 requests anidados. | `modelos/*Mdl.php` |

---

## 3. Objetivo del refactor

1. Externalizar el secreto de FMP a variable de entorno / `.env` (eliminar del código versionado).
2. Crear directorios faltantes (`logs/`, `errors/`) y corregir configuración de `.htaccess`.
3. Parametrizar CORS y CSP leyendo desde configuración, eliminar CDN no usado y `unsafe-inline`.
4. Unificar mecanismos de bloqueo de directorios, agregar `vistas/` a la lista.
5. Eliminar propiedades muertas, headers redundantes, y normalizar formatos (timestamp, precio, versión).
6. Centralizar `require_once` de dependencias compartidas.
7. Actualizar `README.md` al estado actual del código.
8. Recomendar (sin implementar) capa de caché y autenticación/rate limiting como deuda futura.

---

## 4. Alcance (in-scope)

- **A1. Externalizar API key a variable de entorno.** Reemplazar `define("FMP_API_KEY", "mlS7...")` por `define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "")` en `global.php`. Crear `configuracion/.env.example` con las variables documentadas. Añadir `configuracion/.env` al `.gitignore` de la raíz (o instruir al desarrollador).
- **A2. Crear directorios `logs/` y `errors/`.** Crear `logs/` con `.htaccess` de denegación, crear `errors/` con páginas HTML mínimas (400, 401, 403, 404, 500).
- **A3. Parametrizar CORS.** Mover el origen permitido de `.htaccess` a `configuracion/global.php` como constante `CORS_ORIGIN`, leerla en `CorsConfig.php`.
- **A4. Ajustar CSP.** Eliminar `cdnjs.cloudflare.com` del CSP (ya no se usa), eliminar `'unsafe-inline'` de `script-src`, mover la definición a `CorsConfig.php` para control programático.
- **A5. Forzar HTTPS.** Descomentar y activar la redirección HTTPS en `.htaccess`, añadir `Strict-Transport-Security`.
- **A6. Unificar bloqueo de directorios.** Reemplazar `RedirectMatch` + `RewriteRule` por un solo bloque `RewriteRule` con `[F,L]` (403). Agregar `vistas/` a la lista.
- **A7. Eliminar `php_value` sin protección.** Envolver en `<IfModule mod_php.c>` o mover a `.user.ini`.
- **A8. Sanitizar mensajes de excepción en `ClienteHttp`.** No incluir URL completa ni mensaje crudo de cURL en la excepción; solo el contexto necesario para identificar el fallo.
- **A9. Normalizar errores en `index.php`.** Añadir `JSON_UNESCAPED_UNICODE` a todos los `json_encode`. Unificar formato de timestamp a ISO 8601 (`date('c')`) en todo el servicio. Eliminar `X-XSS-Protection`.
- **A10. Eliminar código duplicado y propiedades muertas.** Eliminar `$baseUrl` de `CriptoCtrl`, `ForexCtrl`, `IndiceCtrl`. Centralizar versión como constante `APP_VERSION` en `global.php`. Eliminar `array_slice` en `CriptoCtrl`. Reemplazar `strpos` por `str_ends_with` en filtro USDT/BUSD.
- **A11. Centralizar `require_once` de `ProveedorNoDisponibleException`.** Cargarla solo en `ClienteHttp.php`; `BaseCtrl.php` no la requiere directamente.
- **A12. Eliminar código muerto en `.htaccess`.** Quitar hotlinking protection y `X-XSS-Protection`. Revisar y limpiar directivas redundantes.
- **A13. Actualizar `README.md`.** Reflejar la arquitectura post-RF-002, eliminar referencias a `enlace.php`, `DB_*`, `PlanesRTS` y `"detalle"`.
- **A14. Normalizar formato de precio.** Aplicar `number_format` con 6 decimales también en `CriptoCtrl` para consistencia entre los tres dominios.
- **A15. Definir constantes para `usleep` en `ForexCtrl`.** Nombrar `CHUNK_DELAY_US` y `BASE_DELAY_US` con comentario explicativo.

---

## 5. Fuera de alcance (out-of-scope)

- **No** se implementa caché para APIs externas (se documenta como deuda técnica).
- **No** se implementa autenticación JWT, rate limiting ni API key por consumidor.
- **No** se implementa un autoloader PSR-4 (requiere Composer, fuera del alcance).
- **No** se refactoriza la lógica de negocio de los controladores (solo se eliminan propiedades muertas).
- **No** se cambia el contrato de datos de éxito de los endpoints.
- **No** se modifica `RF-002` ni `RF-003`; este RF es posterior y acumulativo.

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
  Y existe configuracion/.env.example con las variables documentadas

Dado el código refactorizado
Cuando reviso el sistema de archivos
Entonces existen los directorios logs/ y errors/
  Y logs/ tiene .htaccess con "Require all denied"
  Y errors/ contiene 400.html, 401.html, 403.html, 404.html, 500.html

Dado el código refactorizado
Cuando reviso configuracion/global.php
Entonces existe la constante CORS_ORIGIN
  Y configuracion/CorsConfig.php la usa en lugar del valor hardcodeado

Dado el código refactorizado
Cuando reviso configuracion/CorsConfig.php
Entonces define el CSP sin cdnjs.cloudflare.com
  Y script-src no incluye 'unsafe-inline'

Dado el código refactorizado
Cuando reviso .htaccess
Entonces la redirección HTTPS está activa (no comentada)
  Y existe Strict-Transport-Security
  Y no existe X-XSS-Protection
  Y no existe hotlinking protection
  Y php_value está envuelto en <IfModule mod_php.c>
  Y el bloqueo de directorios incluye vistas/
  Y RedirectMatch ha sido reemplazado por un único bloque RewriteRule

Dado el código refactorizado
Cuando reviso controladores/*Ctrl.php
Entonces ningún controlador tiene propiedad $baseUrl
  Y CriptoCtrl no tiene array_slice
  Y CriptoCtrl usa str_ends_with en lugar de strpos
  Y el formato de precio es consistente (number_format 6 decimales)

Dado el código refactorizado
Cuando reviso index.php y BaseCtrl.php
Entonces version usa APP_VERSION (constante en global.php)
  Y todos los timestamps usan date('c') (ISO 8601)
  Y todos los json_encode tienen JSON_UNESCAPED_UNICODE
  Y index.php no define header Content-Type (ya lo hace CorsConfig o BaseCtrl)

Dado el código refactorizado
Cuando reviso configuracion/ClienteHttp.php
Entonces los mensajes de excepción no incluyen URLs completas ni mensajes crudos de cURL

Dado el código refactorizado
Cuando reviso README.md
Entonces no menciona enlace.php, DB_*, PlanesRTS ni "detalle"
  Y refleja la arquitectura con Mdl, ClienteHttp y global.php actual

Dado el código refactorizado
Cuando reviso controladores/ForexCtrl.php
Entonces los valores de usleep están definidos como constantes con nombre descriptivo
```

---

## 8. Tareas técnicas derivadas (alto nivel)

- [ ] Externalizar `FMP_API_KEY` a variable de entorno, crear `.env.example` (A1).
- [ ] Crear directorios `logs/` y `errors/` con páginas HTML mínimas y protección (A2).
- [ ] Parametrizar CORS: constante `CORS_ORIGIN` en `global.php`, leer en `CorsConfig.php` (A3).
- [ ] Ajustar CSP: eliminar CDN y `unsafe-inline`, mover a `CorsConfig.php` (A4).
- [ ] Activar redirección HTTPS y `Strict-Transport-Security` (A5).
- [ ] Unificar bloqueo de directorios, agregar `vistas/` (A6).
- [ ] Proteger directivas `php_value` con `<IfModule mod_php.c>` (A7).
- [ ] Sanitizar excepciones en `ClienteHttp` (A8).
- [ ] Normalizar errores en `index.php`: `JSON_UNESCAPED_UNICODE`, ISO 8601, eliminar `X-XSS-Protection` (A9).
- [ ] Eliminar propiedades muertas, centralizar versión, unificar precio y timestamp (A10).
- [ ] Centralizar `require_once` de `ProveedorNoDisponibleException` (A11).
- [ ] Limpiar código muerto en `.htaccess` (A12).
- [ ] Actualizar `README.md` (A13).
- [ ] Normalizar formato de precio en `CriptoCtrl` (A14).
- [ ] Definir constantes para `usleep` en `ForexCtrl` (A15).
- [ ] Verificar todos los criterios de aceptación con inspección de código y `curl`.

---

## 9. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. No existe ningún secreto hardcodeado en archivos versionados del servicio.
2. Los directorios `logs/` y `errors/` existen y están funcionales.
3. CORS y CSP son configurables desde `global.php`.
4. HTTPS está activo, las cabeceras de seguridad están actualizadas y no hay cabeceras deprecadas.
5. El bloqueo de directorios es consistente e incluye `vistas/`.
6. No hay propiedades sin uso, headers redundantes, ni código muerto en `.htaccess`.
7. Los formatos de timestamp, precio y versión son consistentes en todo el servicio.
8. Los mensajes de excepción no exponen detalles internos en logs.
9. `README.md` refleja el estado actual del código.
10. Los criterios de aceptación de §7 se cumplieron y verificaron.
11. Los endpoints existentes funcionan idéntico a antes del refactor.
12. Se respetan las restricciones R1–R6 y las convenciones del repo (`CLAUDE.md`).
