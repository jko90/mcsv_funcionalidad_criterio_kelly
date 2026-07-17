# HLT-RF-001 — Contrato Técnico de Alto Nivel: Refactor del `.htaccess` de `rest_criteriokelly`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-001_refactor_htaccess.md`](../rf/RF-001_refactor_htaccess.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Servicio afectado:** `rest_criteriokelly` (autónomo; no se replica en otros `rest_*`).
> **Versión HLT:** 1.0.0
> **Fecha:** 2026-07-17

---

## Estado del HLT

| Campo | Valor |
|-------|-------|
| **Estado** | `PROPUESTO` |
| Aprobación senior | `PENDIENTE` |
| Fecha de aprobación | — |
| Fecha de cierre | — |

### Reglas de estado (mandatorias)

- El HLT nace en `PROPUESTO`. El agente planificador **entrega todos los checkboxes en `[ ]`**.
- Un senior debe aprobar el HLT (§6 de `doc_modo_planificacion.md`) antes de que el agente
  implementador ejecute tarea alguna. Al aprobar, cambiar `Aprobación senior` a `APROBADO` y el
  `Estado` a `EN EJECUCIÓN`.
- El agente implementador **solo** puede cambiar el estado del HLT a **`COMPLETADO`** cuando se
  cumplan **todas** estas condiciones simultáneamente:
  1. **Todas** las tareas `T1`–`T20` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las tareas de validación (`T12`–`T20`) se ejecutaron con su comando exacto y su salida
     observada **coincide** con la esperada, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`** (no `COMPLETADO`).
- Si algunas tareas quedan `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es
  **`EN EJECUCIÓN`** o **`PARCIAL`** según corresponda; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Refactorizar el archivo `rest_criteriokelly/.htaccess` para **eliminar redundancia, código muerto y
directivas heredadas por copia de otros servicios** (defectos D1–D7 del RF-001), y **crear las 5
páginas de error** que sus directivas `ErrorDocument` ya referencian, **sin alterar el comportamiento
observable de la API** (mismos endpoints, mismos códigos HTTP, mismas restricciones de acceso).

---

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en el servicio `rest_criteriokelly`:

- **Archivo `.htaccess`** (MODIFY): consolidación de bloques `mod_rewrite`, unificación del bloqueo de
  carpetas internas, eliminación de reglas de estáticos, corrección del redirect trailing-slash,
  eliminación del comentario placeholder y preservación sincronizada de los headers CORS.
- **`errors/400.html`** (CREATE).
- **`errors/401.html`** (CREATE).
- **`errors/403.html`** (CREATE).
- **`errors/404.html`** (CREATE).
- **`errors/500.html`** (CREATE).

No hay cambios en la tripleta PHP (`rutas/`, `controladores/`, `modelos/`) ni en `index.php` ni en SQL.

---

## 3. Out-of-scope (qué NO entra)

- No se modifica el ruteo funcional de la API ni el mapa `$rutas` de `index.php`.
- No se elimina el manejo de CORS del `.htaccess` (headers y rewrite de preflight `OPTIONS` se
  **conservan**; ver §7 D1/A7).
- No se activa el forzado de HTTPS (la regla HTTPS comentada **permanece comentada**).
- No se mueve la lógica de CORS ni de errores fuera de PHP; `CorsConfig` y `BaseCtrl` siguen siendo la
  fuente primaria en PHP.
- No se externalizan credenciales ni el secreto JWT.
- No se toca `configuracion/global.php`, `configuracion/CorsConfig.php` ni ningún `*.php`.
- No se replican cambios en otros servicios `rest_*`.
- No se modifican los bloques `mod_deflate` (gzip), los headers de seguridad (`X-Frame-Options`,
  CSP, etc.), `Options -Indexes`, `ServerSignature Off`, los `php_value`/`php_flag`, ni la protección
  de archivos sensibles por `<Files>`/`<FilesMatch>` (no son parte de los defectos D1–D7).

---

## 4. Impacto en contratos públicos

**Sin cambios en contratos públicos de la API.** No se crea, modifica ni elimina ningún endpoint,
parámetro de entrada, forma de JSON de salida ni código HTTP de negocio. El único cambio observable a
nivel HTTP es que las respuestas de error de Apache (400/401/403/404/500) ahora sirven un cuerpo HTML
existente en lugar de un error interno de "documento de error no encontrado".

| Superficie | Antes | Después |
|-----------|-------|---------|
| `GET /rest_criteriokelly/cuentas` (health check) | `200` + JSON `{"status":"ok",...}` | **Idéntico** |
| Acceso directo a `configuracion/`, `rutas/`, `modelos/`, `controladores/`, `logs/` | Denegado (301/403 inconsistente) | Denegado **`403`** (unificado) |
| Error 400/401/403/404/500 de Apache | `ErrorDocument` apunta a archivo inexistente | Sirve `errors/<código>.html` existente |
| Preflight `OPTIONS` | `200` (rewrite + `CorsConfig::manejarPreflight`) | **Idéntico** |
| Headers CORS `Access-Control-*` | Emitidos por `.htaccess` (origen `http://localhost:8100`) | **Idénticos** (preservados) |

---

## 5. Compatibilidad

**NO-BREAKING.** El SPA Ionic/Angular en `http://localhost:8100` no percibe ningún cambio de contrato:
mismos endpoints, mismos códigos HTTP de negocio, mismos headers CORS (mismo origen, métodos y headers
permitidos). El cambio en el código de denegación de carpetas internas (301 → 403) no afecta al SPA
porque el SPA nunca solicita esas rutas internas.

---

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Configuración Apache (borde de infraestructura) | `rest_criteriokelly/.htaccess` | MODIFY |
| Recursos estáticos de error (servidos por Apache vía `ErrorDocument`) | `rest_criteriokelly/errors/*.html` | CREATE |

No se toca ninguna capa PHP (`index.php` / `rutas` / `controladores` / `modelos` / `configuracion`)
ni `anexos/*.sql`. Servicio único: `rest_criteriokelly`.

---

## 7. Delta arquitectónico

> `CorsConfig.php` verificado: **no emite headers `Access-Control-*`** (solo `Content-Type`,
> `Cache-Control`, `Expires`); su comentario declara que "los headers CORS están en `.htaccess`". Por
> tanto el `.htaccess` es el **único emisor** de CORS y "sincronizar" (A7/R3) significa **preservar sin
> cambios** los valores actuales; no existe divergencia que reconciliar.

### 7.1. Tabla de Delta (una fila por cambio)

| Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
|------|---------------------------|--------|-----------------|
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/400.html` | CREATE | Página HTML estática autocontenida, `lang="es"`, título `Error 400 — Criterio Kelly`, mensaje `Solicitud incorrecta`. |
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/401.html` | CREATE | HTML estático, mensaje `No autorizado`. |
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/403.html` | CREATE | HTML estático, mensaje `Acceso denegado`. |
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/404.html` | CREATE | HTML estático, mensaje `Recurso no encontrado`. |
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/500.html` | CREATE | HTML estático, mensaje `Error interno del servidor`. |
| Config | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/.htaccess` | MODIFY | Consolidar los 2 bloques `<IfModule mod_rewrite.c>` en uno; eliminar bloque anti-hotlinking (D5/A1). |
| Config | `.../rest_criteriokelly/.htaccess` | MODIFY | Reemplazar los 4 `RewriteRule` de bloqueo `[R=301]` y el `RedirectMatch 403 ^/?(configuracion\|logs\|backups\|temp)/?$` por **un** único `RewriteRule ... [F,L]` (403) que cubre `configuracion`, `rutas`, `modelos`, `controladores`, `logs` con prefijo `/rest_criteriokelly/` (D6/A2/R4). |
| Config | `.../rest_criteriokelly/.htaccess` | MODIFY | Eliminar reglas de estáticos: bloque anti-hotlinking, `AddType .js`/`.css`, entradas de `mod_expires` de imágenes/pdf/css/js/ico, y la `RewriteCond` de `assets/`; conservar `AddType application/json .json` y `ExpiresByType application/json "access plus 0 seconds"` (D3/A3). |
| Config | `.../rest_criteriokelly/.htaccess` | MODIFY | En el redirect trailing-slash, reemplazar `(empresa\|persona\|usuario\|categoria\|producto\|autenticacion)` por `(cuentas\|bitacora\|comentarios\|criterioKelly)` (D4/A4). |
| Config | `.../rest_criteriokelly/.htaccess` | MODIFY | Eliminar la sección `# PREVENCIÓN DE ATAQUES` con el comentario placeholder muerto `# ...resto del código de prevención de ataques existente...` (D7/A5). |
| Config | `.../rest_criteriokelly/.htaccess` | MODIFY | Conservar **sin cambios** el bloque `<IfModule mod_headers.c>` con los headers CORS (origen `http://localhost:8100`; métodos `GET, POST, PUT, DELETE, OPTIONS`; headers `Content-Type, Authorization, X-Requested-With`; `Max-Age 3600`) y el rewrite de preflight `OPTIONS`, reubicando este último dentro del bloque `mod_rewrite` único (D1/A7). |

### 7.2. Estado objetivo del `.htaccess` (bloques y orden, cerrado)

Tras el refactor, el `.htaccess` contiene **exactamente** estos bloques, en este orden:

1. `Options -Indexes` + `ServerSignature Off` — **sin cambios**.
2. `<IfModule mod_headers.c>` — headers de seguridad y CORS — **sin cambios** (D1/A7).
3. `<IfModule mod_deflate.c>` — gzip — **sin cambios**.
4. `<IfModule mod_expires.c>` — **reducido**: única entrada `ExpiresByType application/json "access plus 0 seconds"` (A3).
5. Protección de archivos sensibles `<Files>` + `<FilesMatch>` — **sin cambios**.
6. `<IfModule mod_rewrite.c>` — **bloque único** que contiene, en orden:
   - `RewriteEngine On`
   - Preflight `OPTIONS`: `RewriteCond %{REQUEST_METHOD} OPTIONS` + `RewriteRule ^(.*)$ index.php [L,R=200]` (conservado, D1/A7).
   - Bloqueo unificado de carpetas internas: `RewriteCond %{REQUEST_URI} ^/rest_criteriokelly/(configuracion|rutas|modelos|controladores|logs)/ [NC]` + `RewriteRule ^ - [F,L]` (403) (A2/D6/R4).
   - API REST: `RewriteCond %{REQUEST_FILENAME} !-f` + `!-d` + `RewriteRule ^(.*)$ index.php [QSA,L]` (**sin** la `RewriteCond` de `assets/`, A3).
   - Regla HTTPS **comentada** (permanece comentada).
   - Trailing-slash con dominios reales `(cuentas|bitacora|comentarios|criterioKelly)` (A4).
7. `ErrorDocument 400/401/403/404/500` con prefijo `/rest_criteriokelly/errors/<código>.html` — **sin cambios** (los archivos referenciados ahora existen).
8. `php_value`/`php_flag` (límites de subida, `display_errors Off`, `log_errors`, `error_log`) — **sin cambios**.
9. `<IfModule mod_mime.c>` — **reducido**: única entrada `AddType application/json .json` (A3).
10. **Eliminados**: sección `# PREVENCIÓN DE ATAQUES` con placeholder (A5); segundo bloque `mod_rewrite` de hotlinking (A1/A3); `RedirectMatch 403 ^/?(configuracion|logs|backups|temp)/?$` (A2).

### 7.3. Contenido cerrado de las páginas de error (plantilla determinista)

Cada `errors/<código>.html` usa **exactamente** esta plantilla, sustituyendo `<CODIGO>` y `<MENSAJE>`
por los valores de la tabla. HTML autocontenido (CSS inline, sin recursos externos, `lang="es"`):

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error <CODIGO> — Criterio Kelly</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#1e3a8a;color:#fff;
         display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}
    .caja{background:rgba(255,255,255,.08);padding:2.5rem 3rem;border-radius:16px}
    h1{font-size:4rem;margin:0}
    p{font-size:1.2rem;margin:.5rem 0 0}
  </style>
</head>
<body>
  <div class="caja">
    <h1><CODIGO></h1>
    <p><MENSAJE></p>
  </div>
</body>
</html>
```

| Archivo | `<CODIGO>` | `<MENSAJE>` |
|---------|-----------|-------------|
| `errors/400.html` | `400` | `Solicitud incorrecta` |
| `errors/401.html` | `401` | `No autorizado` |
| `errors/403.html` | `403` | `Acceso denegado` |
| `errors/404.html` | `404` | `Recurso no encontrado` |
| `errors/500.html` | `500` | `Error interno del servidor` |

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción | Motivo |
|---------------|--------|--------|
| `.../rest_criteriokelly/errors/400.html` | CREATE | Existencia para `ErrorDocument 400` (D2/A6). |
| `.../rest_criteriokelly/errors/401.html` | CREATE | Existencia para `ErrorDocument 401` (D2/A6). |
| `.../rest_criteriokelly/errors/403.html` | CREATE | Existencia para `ErrorDocument 403` (D2/A6). |
| `.../rest_criteriokelly/errors/404.html` | CREATE | Existencia para `ErrorDocument 404` (D2/A6). |
| `.../rest_criteriokelly/errors/500.html` | CREATE | Existencia para `ErrorDocument 500` (D2/A6). |
| `.../rest_criteriokelly/.htaccess` | MODIFY | Refactor D1–D7 conforme a §7.2. |

---

## 9. Estrategia de validación

Cada comprobación es una tarea con checkbox (T12–T20) en §12, con comando exacto y salida esperada.
Comandos ejecutados desde el host con Apache sirviendo el servicio en `http://localhost/rest_criteriokelly/`.
Ruta base del archivo para greps: `rest_criteriokelly/.htaccess`.

- **Health check** (R1): `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_criteriokelly/cuentas` → `200`.
- **Bloque único** `mod_rewrite` (D5): `grep -c "<IfModule mod_rewrite.c>" rest_criteriokelly/.htaccess` → `1`.
- **Dominios ajenos ausentes** (D4): `grep -E "empresa|persona|categoria|producto|autenticacion" rest_criteriokelly/.htaccess` → sin coincidencias (exit 1).
- **Placeholder ausente** (D7): `grep -F "resto del código de prevención de ataques" rest_criteriokelly/.htaccess` → sin coincidencias (exit 1).
- **Carpetas internas denegadas** (R4): `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_criteriokelly/configuracion/global.php` → `403` (idéntico para `rutas/`, `modelos/`, `controladores/`, `logs/`).
- **Páginas de error existen y se sirven** (D2): `curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_criteriokelly/errors/404.html` → `200` (idéntico para 400/401/403/500).
- **Sin reglas de estáticos** (D3): `grep -E "HTTP_REFERER|AddType .*(\.js|\.css)|ExpiresByType image" rest_criteriokelly/.htaccess` → sin coincidencias (exit 1).
- **CORS preservado** (D1/A7/R3): `curl -s -I -H "Origin: http://localhost:8100" http://localhost/rest_criteriokelly/cuentas | grep -i "Access-Control-Allow-Origin"` → `Access-Control-Allow-Origin: http://localhost:8100`.
- **Prefijo preservado** (R2): `grep -E "ErrorDocument|RewriteRule|RewriteCond %\{REQUEST_URI\}" rest_criteriokelly/.htaccess` → todas las rutas usan `/rest_criteriokelly/`.

---

## 10. Riesgos

- **Riesgo de regresión en denegación de carpetas.** Cambiar 301→403 y unificar el mecanismo podría
  dejar alguna carpeta accesible si el patrón es incorrecto. *Mitigación:* T16 verifica las 5 carpetas
  explícitamente con `curl` esperando `403`.
- **Riesgo de romper el ruteo por eliminar la `RewriteCond` de `assets/`.** *Mitigación:* `assets/` no
  existe (verificado); T12 (health check) confirma que el ruteo sigue intacto.
- **Riesgo de divergencia CORS.** *Mitigación:* los valores CORS se preservan verbatim; `CorsConfig`
  no emite CORS, por lo que no hay fuente divergente; T19 confirma el header.

---

## 11. Rollback

- **Global:** `git checkout -- rest_criteriokelly/.htaccess` restaura el `.htaccess` previo;
  `rm -rf rest_criteriokelly/errors/` elimina las páginas creadas. El servicio vuelve al estado
  anterior sin efectos en BD ni en la tripleta PHP (cambios exclusivamente de configuración/estáticos).
- **Por artefacto:** revertir cada `RewriteRule`/bloque al estado documentado en §7.2 columna "antes",
  o eliminar el archivo `errors/*.html` correspondiente.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` = realizado
> y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado + razón. Un checkbox = una
> acción verificable. El agente implementador **actualiza cada checkbox al completar y verificar** la
> tarea, y solo entonces. Todos se entregan en `[ ]`.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_criteriokelly` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/` |
| Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) |
| Capa de datos | `configuracion/enlace.php` (clase `Enlace`, `bind_param`) — **no tocada** |
| Capa de respuesta | `controladores/BaseCtrl.php` — **no tocada** |
| CORS (PHP) | `configuracion/CorsConfig.php` — **no emite `Access-Control-*`**; el `.htaccess` es el emisor |
| BD | MySQL/MariaDB — `DB_NAME=sist_criteriokelly` (`configuracion/global.php`) — **no tocada** |
| Prefijo de tablas | `sckc_` (no aplica a este refactor) |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `curl http://localhost/rest_criteriokelly/cuentas` |
| Dominios reales del servicio | `cuentas`, `bitacora`, `comentarios`, `criterioKelly` |
| Logs | `logs/php_errors.log` del servicio |

### Grupo A — Crear páginas de error (prerrequisito de `ErrorDocument`)

```
[ ] T1 | /run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/400.html | CREATE
    - Delta: crear la carpeta errors/ y el archivo con la plantilla de §7.3, CODIGO=400, MENSAJE="Solicitud incorrecta".
    - Note: HTML autocontenido, sin recursos externos.

[ ] T2 | /run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/401.html | CREATE
    - Delta: plantilla de §7.3, CODIGO=401, MENSAJE="No autorizado".

[ ] T3 | /run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/403.html | CREATE
    - Delta: plantilla de §7.3, CODIGO=403, MENSAJE="Acceso denegado".

[ ] T4 | /run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/404.html | CREATE
    - Delta: plantilla de §7.3, CODIGO=404, MENSAJE="Recurso no encontrado".

[ ] T5 | /run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/errors/500.html | CREATE
    - Delta: plantilla de §7.3, CODIGO=500, MENSAJE="Error interno del servidor".
```

### Grupo B — Refactor del `.htaccess` (cada tarea es un cambio atómico sobre el mismo archivo)

```
[ ] T6 | /run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/.htaccess | MODIFY
    - Delta: consolidar los dos bloques <IfModule mod_rewrite.c> en uno; eliminar por completo el
      segundo bloque (anti-hotlinking) (A1/D5).
    - Insert after: ancla "# URL REWRITING PARA API REST" / "<IfModule mod_rewrite.c>" (primer bloque);
      eliminar el bloque bajo "# PREVENIR HOTLINKING".
    - Note: el resultado final del bloque único debe seguir el orden de §7.2 punto 6.

[ ] T7 | .../rest_criteriokelly/.htaccess | MODIFY
    - Delta: reemplazar los 4 RewriteRule de bloqueo con [R=301] y el RedirectMatch 403 por UN único
      RewriteCond %{REQUEST_URI} ^/rest_criteriokelly/(configuracion|rutas|modelos|controladores|logs)/ [NC]
      + RewriteRule ^ - [F,L] (A2/D6/R4).
    - Insert after: ancla "# BLOQUEAR ACCESO DIRECTO A CARPETAS INTERNAS".
    - Note: eliminar también "RedirectMatch 403 ^/?(configuracion|logs|backups|temp)/?$". Conservar
      intactos los bloques <Files>/<FilesMatch> de archivos sensibles.

[ ] T8 | .../rest_criteriokelly/.htaccess | MODIFY
    - Delta: eliminar reglas de estáticos: bloque anti-hotlinking (ya en T6), AddType .js y .css,
      entradas mod_expires de image/*, application/pdf, text/css, application/javascript, *icon*,
      y la RewriteCond de assets/. Conservar AddType application/json .json y
      ExpiresByType application/json "access plus 0 seconds" (A3/D3).
    - Insert after: anclas "# CACHE CONTROL" (mod_expires), "# CONFIGURACIÓN DE TIPOS MIME" (mod_mime),
      "RewriteCond %{REQUEST_URI} !^/rest_criteriokelly/assets/".

[ ] T9 | .../rest_criteriokelly/.htaccess | MODIFY
    - Delta: en el redirect trailing-slash, sustituir (empresa|persona|usuario|categoria|producto|autenticacion)
      por (cuentas|bitacora|comentarios|criterioKelly) (A4/D4).
    - Insert after: ancla "# Trailing slash redirect".

[ ] T10 | .../rest_criteriokelly/.htaccess | MODIFY
    - Delta: eliminar la sección "# PREVENCIÓN DE ATAQUES" y su comentario placeholder muerto
      "# ...resto del código de prevención de ataques existente..." (A5/D7).
    - Insert after: ancla "# PREVENCIÓN DE ATAQUES".

[ ] T11 | .../rest_criteriokelly/.htaccess | MODIFY
    - Delta: verificar que el bloque <IfModule mod_headers.c> con los headers CORS queda intacto
      (origen http://localhost:8100; métodos GET,POST,PUT,DELETE,OPTIONS; headers Content-Type,
      Authorization,X-Requested-With; Max-Age 3600) y que el rewrite de preflight OPTIONS quedó
      reubicado dentro del bloque mod_rewrite único (A7/D1).
    - Insert after: ancla "# HEADERS DE SEGURIDAD Y CORS CENTRALIZADOS".
    - Note: NO modificar valores CORS; CorsConfig no emite CORS, no hay divergencia que reconciliar.
```

### Grupo C — Validaciones (cada una con su comando exacto y salida esperada)

```
[ ] T12 | Validación — health check | RUN
    - Comando: curl -s -o /dev/null -w "%{http_code}" http://localhost/rest_criteriokelly/cuentas
    - Esperado: 200 (y cuerpo JSON {"status":"ok",...} idéntico al previo).

[ ] T13 | Validación — bloque mod_rewrite único (D5) | RUN
    - Comando: grep -c "<IfModule mod_rewrite.c>" rest_criteriokelly/.htaccess
    - Esperado: 1

[ ] T14 | Validación — dominios ajenos ausentes (D4) | RUN
    - Comando: grep -E "empresa|persona|categoria|producto|autenticacion" rest_criteriokelly/.htaccess
    - Esperado: sin coincidencias (exit code 1)

[ ] T15 | Validación — placeholder ausente (D7) | RUN
    - Comando: grep -F "resto del código de prevención de ataques" rest_criteriokelly/.htaccess
    - Esperado: sin coincidencias (exit code 1)

[ ] T16 | Validación — carpetas internas denegadas 403 (R4) | RUN
    - Comando: for d in configuracion rutas modelos controladores logs; do curl -s -o /dev/null -w "%{http_code}\n" "http://localhost/rest_criteriokelly/$d/"; done
    - Esperado: 403 en las 5 líneas (para configuracion probar además /configuracion/global.php → 403).

[ ] T17 | Validación — páginas de error existen y se sirven (D2) | RUN
    - Comando: for c in 400 401 403 404 500; do curl -s -o /dev/null -w "%{http_code}\n" "http://localhost/rest_criteriokelly/errors/$c.html"; done
    - Esperado: 200 en las 5 líneas.

[ ] T18 | Validación — sin reglas de estáticos (D3) | RUN
    - Comando: grep -E "HTTP_REFERER|AddType [^ ]*\.(js|css)|ExpiresByType image" rest_criteriokelly/.htaccess
    - Esperado: sin coincidencias (exit code 1)

[ ] T19 | Validación — CORS preservado (D1/A7/R3) | RUN
    - Comando: curl -s -I -H "Origin: http://localhost:8100" http://localhost/rest_criteriokelly/cuentas | grep -i "Access-Control-Allow-Origin"
    - Esperado: Access-Control-Allow-Origin: http://localhost:8100

[ ] T20 | Validación — prefijo /rest_criteriokelly/ preservado (R2) | RUN
    - Comando: grep -n "ErrorDocument\|/rest_criteriokelly/" rest_criteriokelly/.htaccess
    - Esperado: todas las reglas de rewrite, bloqueos y ErrorDocument usan el prefijo /rest_criteriokelly/.
```

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 20
- Completadas [X]: <n>
- Bloqueadas [BLOCKED]: <n>
- Omitidas: <n>

### Estado por tarea
| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | errors/400.html |  |
| T2 |  | errors/401.html |  |
| T3 |  | errors/403.html |  |
| T4 |  | errors/404.html |  |
| T5 |  | errors/500.html |  |
| T6 |  | .htaccess |  |
| T7 |  | .htaccess |  |
| T8 |  | .htaccess |  |
| T9 |  | .htaccess |  |
| T10 |  | .htaccess |  |
| T11 |  | .htaccess |  |
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
- <descripción del bloqueo, tarea afectada y qué se necesita para desbloquear>

### Archivos cambiados
- <path absoluto> — CREATE|MODIFY — <resumen de una línea>

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas corrieron con su comando exacto y su salida quedó registrada.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T20 en [X]).
- Declaración: <RESUELTO | PARCIAL | BLOQUEADO> — <una frase de cierre>
```
