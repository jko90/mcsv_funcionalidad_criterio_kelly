# HLT — HLT-02 · Endurecimiento HTTP de los 4 backends (`.htaccess`, enrutador, CORS, cabeceras, métodos, JSON, errores globales)

| Campo | Valor |
|-------|-------|
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Plan maestro | [PLAN-MAESTRO-HU-001.md](PLAN-MAESTRO-HU-001.md) (contratos §4 y reglas §5, cerrados) |
| Fecha | 2026-11-02 |
| Proyectos | `rest_usuario`, `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas` |
| Agentes | `desarrollador-php` (29 tareas) · `desarrollador-ionic` (0) |
| Depende de | [HLT-01](HLT-01-2026-11-02-base-plataforma-backend.md) cerrado (todas sus tareas `HECHA`) |
| Lo consume | [HLT-03](HLT-03-2026-11-02-nucleo-sesion.md) (su tarea puerta T-01 verifica IR-01…IR-10 sobre lo que deja este HLT); HLT-04, HLT-05, HLT-06 |
| Veredicto senior | **APROBADO** (H6, revisión 2) |

Convenciones: `$RAIZ` = `/c/xampp/htdocs/criterio_kelly`; `$PHP` = `/c/xampp/php/php.exe`; `$B` = `http://localhost/criterio_kelly`; `RS` = `docs/Planificacion/evidencias`. Las referencias `ruta:línea` describen el repositorio leído el 2026-11-02, **antes** de HLT-01. HLT-01 modifica `index.php:3,38-41` y `.htaccess:76,86`; donde HLT-01 desplace líneas, el implementador localiza el punto por su contenido (citado en cada tarea) y anota la línea real en la ficha. Eso no le deja decisiones de diseño.

---

## H1. Propósito

| Campo | Contenido |
|-------|-----------|
| Requerimiento literal | "**HLT-02 · Endurecimiento HTTP** (4 backends). Cubre: E-02, E-04, E-05, E-06, E-08, E-09, E-10, E-11, E-12, E-13, C-06 (LectorSolicitud), C-08 (ManejadorErrores), O-04. Incluye: reescritura de los 4 `.htaccess` (lista blanca: solo index.php; sin prefijo /rest_<nombre>/ hardcodeado; Authorization a PHP; eliminar reglas rotas/obsoletas; php_value/.user.ini según E-11); clases CorsConfig (reescrita), CabecerasSeguridad, ManejadorErrores, LectorSolicitud, Enrutador (segmento exacto) — copias idénticas con chequeo sha256 del plan maestro; index.php con el orden de arranque §4.3 (pasos 1–7; deja el punto de inserción de los pasos 8–9 para HLT-03, explícito); GET de estado reducido; página HTML de anuncio solo con APP_ENTORNO=local. Pruebas curl en local: cada ruta de S-04..S-07 de la HU → 403/404; preflight 204; origen no permitido sin ACAO; método TRACE/PATCH → 405; cuerpo >1MB → 400; JSON inválido → 400; los endpoints existentes siguen funcionando." |
| Propósito | Que cada servidor REST exponga solo lo estrictamente necesario y rechace en la puerta las peticiones mal formadas, los orígenes no autorizados y los métodos no permitidos, sin revelar detalles internos, para que el responsable del sistema pueda publicar la API con una capa HTTP verificable y el trader siga usando la app igual que hoy. |
| Resultado esperado | (1) Solo `index.php` se ejecuta; cualquier otro archivo o carpeta (`.git/`, `anexos/`, `*.sql`, `*.md`, `rutas.txt`, `vendor/`, `.env*`, PHP internos) responde 403 o 404, en cualquier prefijo de instalación. (2) CORS con lista blanca exacta desde el `.env`, `Vary: Origin`, preflight 204 y credenciales solo en `rest_usuario/autenticacion/*` para orígenes web. (3) Cabeceras de seguridad de E-09 en toda respuesta y HSTS cuando hay HTTPS obligatorio. (4) Métodos fuera de `GET/POST/PUT/DELETE/OPTIONS` → 405; cuerpo no JSON, sin `Content-Type` JSON o mayor de 1 MB → 400. (5) Cualquier error interno → 500 `{"error":"Error interno del servidor"}` con el detalle solo en `logs/`. (6) Enrutamiento por segmento exacto que deja `$metodo`, `$recurso` y `$accion` listos para la guardia de HLT-03. (7) El `GET` sin acción responde solo `{"servicio","estado"}`. (8) Los endpoints existentes responden igual que tras HLT-01, salvo los cambios esperados de H3. |
| Fuera de alcance | Autenticación, `RUTAS_PUBLICAS`, `ValidadorSesion`, `LimitadorPeticiones`, IP real y validación de `Origin` + `X-Requested-With` en `renovar` (HLT-03). Validación por campo de cada endpoint (HLT-03/04/05/06). Paquete de despliegue, WAF/ModSecurity (E-03, E-14), `ServerTokens`/`TraceEnable` del servidor real y verificación en staging (HLT-11). Caché o asincronía de `forex/disponible`. Bugs funcionales de los README (`porUsuario`, `echo` de `crearConPago`, acciones `GET` vacías de `BitacoraRts`, `default` 400 de acción desconocida), salvo las fugas de C-08 en líneas que este HLT modifica. Borrar los archivos vacíos `rutas/UsuarioRts.php`, `rutas/RolRts.php` o el trío `Categoria*` (solo se desregistran o se limpian). Actualizar `CLAUDE.md` y `.claude/agents/*.md` (HLT-03 y HLT-07, regla 6 del plan). |
| Feature(s) afectada(s) | Los 4 backends: `.htaccess`, `.user.ini` (nuevo), `index.php`, `configuracion/{CorsConfig,CabecerasSeguridad,ManejadorErrores,LectorSolicitud,Enrutador}.php`, `rutas/*Rts.php` (bloques de estado), `README.md`. Además `rest_criteriokelly/controladores/{CriterioKellyCtrl,BitacoraCtrl}.php` y `rest_usuario/controladores/PersonaCtrl.php` (solo las líneas de C-08). |

---

## H2. Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Solo se ejecuta `index.php`; todo otro archivo o carpeta responde 403 o 404, nunca 200 ni 301, sin depender del prefijo. | T-20: cada URL de la lista L-E02 (H3) ∈ {403, 404} en los 4 backends; `grep -c "rest_" rest_*/.htaccess` = 0. | HU E-02, S-04…S-07, E-12; hoy `rest_*/.htaccess:110-123` (301 con prefijo fijo) |
| RN-02 | Los 4 `.htaccess` son idénticos; los 4 `.user.ini` son idénticos. | `sha256sum rest_*/.htaccess \| awk '{print $1}' \| sort -u \| wc -l` = 1; ídem `.user.ini`. | E-02, E-13 |
| RN-03 | La cabecera `Authorization` llega a PHP. | `grep -n "HTTP_AUTHORIZATION" rest_*/.htaccess` = 1 línea por backend (IR-07 de HLT-03); T-24 confirma `presente`. | HU E-05, S-11 |
| RN-04 | CORS: `Access-Control-Allow-Origin` solo con un origen de `CORS_ORIGENES_WEB ∪ CORS_ORIGENES_NATIVOS`, devuelto exacto, nunca `*`; siempre `Vary: Origin`. Un `Origin` no permitido no recibe ACAO; en métodos distintos de `OPTIONS` responde 403 `Acceso denegado`. | T-22 casos C-01…C-06. | HU E-06; plan §4.2 |
| RN-05 | `Access-Control-Allow-Credentials: true` solo si el primer segmento es un recurso de `RECURSOS_CON_CREDENCIALES` (`['autenticacion']` en `rest_usuario`, `[]` en los demás) **y** el origen está en `CORS_ORIGENES_WEB`; también en el preflight. | T-22 C-03, C-04, C-05 (IR-05 de HLT-03). | HU E-06; plan §4.2; HLT-03 D-38 |
| RN-06 | El preflight `OPTIONS` responde 204 sin ejecutar ninguna ruta, con `Allow-Methods: GET, POST, PUT, DELETE, OPTIONS` y `Allow-Headers: Authorization, Content-Type, X-Cliente, X-Requested-With` para orígenes permitidos. | T-22 C-01, C-02. | HU E-08, E-06 |
| RN-07 | Toda respuesta lleva las cabeceras de E-09 y ninguna lleva `X-Powered-By`. | T-23: las 10 cabeceras de H8 §8.3 presentes y `X-Powered-By` ausente en una respuesta 200, una 404 y una 500. | HU E-09 |
| RN-08 | Con `FORZAR_HTTPS=true`, una petición sin HTTPS responde 403 y una con HTTPS lleva `Strict-Transport-Security: max-age=31536000; includeSubDomains`; con `false` no hay HSTS. | T-23 H-01…H-03. | HU E-04 |
| RN-09 | Solo se aceptan `GET, POST, PUT, DELETE, OPTIONS`; el resto → 405 `Método no permitido`. | T-21: `PATCH`, `HEAD`, `TRACE` → 405. | HU E-10 |
| RN-10 | Un cuerpo no vacío debe tener `Content-Type: application/json`, pesar ≤ 1 048 576 bytes y ser JSON objeto o arreglo; si no → 400 `Solicitud inválida`. Un cuerpo vacío se acepta (lo valida cada endpoint). `POST` con `{}` y `Content-Type` JSON pasa (IR-06 de HLT-03). | T-21 M-04…M-09. | HU C-06; plan §4.5 |
| RN-11 | Cualquier excepción o error fatal no controlado → 500 `{"error":"Error interno del servidor"}`; el detalle (clase, mensaje, archivo:línea, traza sin argumentos) va solo a `RUTA_LOGS/php_errores.log`. Ninguna respuesta contiene `getMessage()`, rutas, SQL ni versiones. | T-26; `grep -rn "getMessage()" rest_*/rutas rest_*/controladores \| grep -v error_log` = 0 líneas. | HU C-08; hoy `rest_criteriokelly/controladores/CriterioKellyCtrl.php:55,101,143,189,225`, `BitacoraCtrl.php:109`, `rest_divisas/rutas/CriptoRts.php:67`, `ForexRts.php:66`, `IndiceRts.php:67` |
| RN-12 | El recurso se resuelve por **segmento exacto** relativo a la carpeta de `index.php`; ≤ 3 segmentos, cada uno `^[A-Za-z0-9_-]+$`; si no → 404 `Recurso no encontrado`. Funciona con cualquier prefijo. | T-25 (prefijo distinto) y T-20 (`..`, `%2e`, segmentos de más) → 404; `grep -c "strpos(\$requestUri" rest_*/index.php` = 0. | HU E-13; plan §4.2; hoy `rest_*/index.php:38-53` |
| RN-13 | Tras el paso 7, `index.php` deja `$metodo`, `$recurso` y `$accion` como `string` (`''` si faltan), y el punto de inserción de los pasos 8–9 queda entre el paso 7 y el paso 10, marcado con un comentario. | Lectura de `index.php` + T-27 (IR-03, IR-04 de HLT-03). | Plan §4.3; HLT-03 IR-03/IR-04 |
| RN-14 | Las 5 clases son idénticas en los 4 backends. | Chequeo SHA-256 del plan §4.2: `CorsConfig`, `CabecerasSeguridad`, `ManejadorErrores`, `LectorSolicitud`, `Enrutador` = 1 (y `Configuracion`, `enlace` siguen en 1). | Plan §4.2 |
| RN-15 | El `GET` sin acción (raíz o `/<recurso>`) responde solo `{"servicio":"<rest_x>","estado":"activo"}`. La página HTML de anuncio solo sale con `APP_ENTORNO=local`, en la raíz y con `Accept` que contiene `text/html`. | T-28 (R-01, R-17, R-40, R-47, R-55…R-58); `curl -H "Accept: text/html" $B/rest_usuario/` con `APP_ENTORNO=staging` temporal → JSON de estado. | O-04, E-12; plan §4.5 |
| RN-16 | El contrato JSON de los endpoints existentes no cambia salvo los "Cambios esperados" de H3; el 422 sigue reservado. | T-28. | HU C-07 |
| RN-17 | Para los recursos registrados, el recurso y la acción que deriva el `Enrutador` coinciden con los que deriva el `Rts` (que busca la primera aparición del nombre del recurso en la ruta completa), siempre que el prefijo de instalación no contenga un segmento con el nombre de un recurso. | Revisión de los `Rts` (`rest_*/rutas/*Rts.php`, bucle `for` de búsqueda); T-25 con un prefijo cualquiera. | HLT-03 R-01 |

---

## H3. Flujo principal de ejecución

### Flujo A · Petición normal

```
[Petición HTTP a <prefijo>/<recurso>/<acción>[/<parámetro>]]
  → .htaccess: TRACE/TRACK → 405 (Apache) | Authorization → HTTP_AUTHORIZATION | todo → index.php ([END])
  → index.php
     1. RUTA_APLICACION + vendor/autoload.php                         (HLT-01)
     2. Configuracion::cargar(...) — si falla: 500 genérico            (HLT-01, try/catch propio)
     3. ManejadorErrores::registrar()                                  → desde aquí todo error no controlado = 500 genérico
     4. CabecerasSeguridad::aplicar()                                  → E-09; FORZAR_HTTPS y sin HTTPS → 403
     5. CorsConfig::aplicar(credenciales)                              → Origin no permitido y método ≠ OPTIONS → 403; OPTIONS → 204 y exit
     6. LectorSolicitud::validarMetodoYCuerpo()                        → 405 / 400
     7. Enrutador::resolver(RUTAS) → $metodo, $recurso, $accion, $archivoRuta   → 404 si el recurso no existe o la ruta es inválida
        raíz ($recurso === '') con método ≠ GET → 404
     ── Pasos 8 y 9 (HLT-03): ValidadorSesion y LimitadorPeticiones se insertan aquí ──
    10. GET sin acción → estado (o página de anuncio en local) | si no → require RUTA_APLICACION/<archivoRuta>
  → Rts → Ctrl → Mdl → Enlace → MySQL → BaseCtrl::respuesta* (sin cambios)
   ├─ Éxito: dato directo (200)
   ├─ Error 400: "Solicitud inválida" (LectorSolicitud) o mensaje de campo (Ctrl)
   ├─ Error 403: "Acceso denegado" (Origin no permitido / HTTP con FORZAR_HTTPS)
   ├─ Error 404: "Recurso no encontrado" (Enrutador)
   ├─ Error 405: "Método no permitido" (LectorSolicitud o Apache para TRACE/TRACK)
   ├─ Error 422: sin cambios (límite de pérdida, ReglasKellyCtrl)
   └─ Error 500: "Error interno del servidor" (ManejadorErrores o Ctrl)
```

### Flujo B · Preflight

```
[OPTIONS + Origin + Access-Control-Request-Method] → index.php pasos 1–4 → CorsConfig::aplicar
   ├─ Origin permitido: ACAO=<origin>, Vary: Origin, Allow-Methods, Allow-Headers, Max-Age: 600,
   │                    Allow-Credentials: true solo si (recurso ∈ RECURSOS_CON_CREDENCIALES y origen web) → 204
   └─ Origin ausente o no permitido: Vary: Origin, sin ACAO → 204
```

### Flujo C · Error no controlado

```
[Excepción en Rts/Ctrl/Mdl, o fatal (p. ej. tiempo máximo excedido)]
  → ManejadorErrores::manejarExcepcion / manejarCierre
  → error_log('[<Clase>] <mensaje> en <archivo>:<línea>' + traza) en RUTA_LOGS/php_errores.log
  → descarta la salida parcial (ob) → 500 {"error":"Error interno del servidor"} (las cabeceras CORS ya enviadas se conservan)
```

### Lista L-E02 (rutas que deben responder 403/404, T-20)

Para cada `<x>` ∈ {`rest_usuario`, `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas`}: `/<x>/.git/config`, `/<x>/.git/HEAD`, `/<x>/.env`, `/<x>/.env.ejemplo`, `/<x>/.htaccess`, `/<x>/.user.ini`, `/<x>/.gitignore`, `/<x>/composer.json`, `/<x>/composer.lock`, `/<x>/vendor/autoload.php`, `/<x>/vendor/`, `/<x>/logs/`, `/<x>/logs/php_errores.log`, `/<x>/README.md`, `/<x>/rutas.txt`, `/<x>/anexos/`, `/<x>/configuracion/Configuracion.php`, `/<x>/configuracion/enlace.php`, `/<x>/controladores/BaseCtrl.php`, `/<x>/rutas/`, `/<x>/modelos/`, `/<x>/index.php`, `/<x>/archivo.bak`, `/<x>/php.ini`, `/<x>/index.php/configuracion/enlace.php`, `/<x>/%2e%2e/`, `/<x>/cuentas/../anexos/` (con `--path-as-is`). Más las de la HU: `/rest_usuario/anexos/sist_generico.sql` (S-04), `/rest_usuario/modelos/ValidacionMdl.php` (S-06), `/rest_criteriokelly/anexos/sist_criteriokelly.sql`, `/rest_suscripcion/anexos/sist_suscripcion.sql`, `/rest_criteriokelly/rutas.txt` (S-07).

### Cambios esperados en la regresión (catálogo R-01…R-58 de HLT-01 H3; columnas código y forma)

| ID | Antes (tras HLT-01) | Después | Motivo |
|----|---------------------|---------|--------|
| R-01, R-02, R-17, R-22, R-25, R-30, R-40, R-43, R-47, R-49, R-51 | 200 con la forma de estado antigua | `200` `objeto:estado,servicio` | O-04 (D-11) |
| R-55, R-56, R-57, R-58 | `404` | `200` `objeto:estado,servicio` | Estado público en la raíz (plan §4.5) |
| R-03, R-04 | `200` `vacio` | `404` `objeto:error` | Recursos sin código desregistrados (D-12) |
| R-53, R-54 | `500` | `404` `objeto:error` | Ídem |
| R-50 | `200` | `200` o `500` `objeto:error` | `max_execution_time 30` (E-11) contra ~38 s medidos en local Windows (D-16) |
| Filas con `500` | `500` `objeto:error` | `500` `objeto:error` (mensaje ahora genérico) | C-08; la forma no cambia |

---

## H4. Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| E-02 / RN-01, RN-02 | T-08, T-20 | L-E02 en 4 backends; SHA-256 de `.htaccess` |
| E-04 / RN-08 | T-03, T-23 | H-01…H-03 |
| E-05 / RN-03 | T-08, T-05, T-24 | `grep` IR-07; carpeta temporal |
| E-06 / RN-04, RN-05 | T-04, T-10…T-13, T-22 | C-01…C-06 |
| E-08 / RN-06 | T-04, T-22 | C-01, C-02 |
| E-09 / RN-07 | T-03, T-08, T-23 | Cabeceras en 200/404/500 |
| E-10 / RN-09 | T-05, T-08, T-21 | M-01…M-03 |
| E-11 | T-08, T-09, T-21, T-29 | M-06 (`post_max_size`); `.user.ini`; README (directivas de sistema, D-04) |
| E-12 | T-08, T-10…T-13 | `.htaccess` sin `ErrorDocument`, hotlinking ni redirección de barra; RN-15 |
| E-13 / RN-12, RN-17 | T-06, T-10…T-13, T-25 | Prefijo distinto; rutas inválidas → 404 |
| C-06 / RN-10 | T-05, T-21 | M-04…M-09 |
| C-08 / RN-11 | T-02, T-17, T-18, T-19, T-26 | 500 genérico + log |
| O-04 / RN-15 | T-10…T-17 | R-01 etc. |
| RN-13 (interfaz HLT-03) | T-10…T-13, T-27 | IR-01…IR-10 |
| RN-14 | T-02…T-07 | Chequeo SHA-256 |
| RN-16 (sin regresión) | T-01, T-28 | Diff contra línea base |
| J-06 (pruebas en local) | T-20…T-28 | Evidencias en `RS/HLT-02/` |
| Regla 5 del plan (README) | T-29 | `grep` de secciones |

### Checklist de calidad del HLT

- [x] ✅ Las 11 secciones existen y están completas.
- [x] ✅ Sin marcadores pendientes.
- [x] ✅ Cada RN mapea a ≥1 tarea (100 %).
- [x] ✅ Cada tarea tiene criterio verificable y ficha (H9).
- [x] ✅ No contradice §0.5 ni los contratos del plan maestro §4/§5.
- [x] ✅ Referencias `ruta:línea` verificadas el 2026-11-02.
- [x] ✅ Decisiones cerradas en H5.
- [x] ✅ Interfaz IR-01…IR-10 de HLT-03 comprobada punto por punto (T-27).

---

## H5. Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Mecanismo de lista blanca | A) Denegar carpetas por nombre · B) `FilesMatch` deniega todo salvo `index.php` · C) Reescribir **toda** petición a `index.php` con `[END]` y dejar que el `Enrutador` responda 404 | C | Independiente del prefijo y de qué archivos existan; B tiene comportamiento incierto con rutas inexistentes (la acción no es un archivo). Sin `<IfModule mod_rewrite.c>`: si falta el módulo, Apache da 500 (falla cerrado). `.htaccess` idéntico en los 4. | No |
| D-02 | `TRACE`/`TRACK` | A) Solo PHP · B) Regla `R=405` en `.htaccess` | B | Apache puede atender `TRACE` sin pasar por PHP. Los demás métodos los rechaza `LectorSolicitud` con JSON. Si en T-21 `TRACE` no da 405, la tarea queda `BLOQUEADA` con la acción de entorno `TraceEnable Off` en `httpd.conf` (registrada para HLT-11). | No |
| D-03 | `Authorization` hacia PHP | A) `SetEnvIf` + regla `E=` · B) Solo `RewriteCond %{HTTP:Authorization} .` + `RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]` | B | Una sola línea con `HTTP_AUTHORIZATION` (IR-07 de HLT-03 espera exactamente 1). Tras la reescritura interna PHP recibe `HTTP_AUTHORIZATION` y `REDIRECT_HTTP_AUTHORIZATION`; `LectorSolicitud::obtenerCabecera()` lee ambos. | No |
| D-04 | E-11 | A) Solo `php_value` · B) `php_flag/php_value` dentro de `<IfModule php_module>` + `.user.ini` idéntico | B | `php_value` fuera de `IfModule` rompe con PHP-FPM/CGI (500). **`expose_php` y `file_uploads` son `PHP_INI_SYSTEM`**: no se pueden fijar desde `.htaccess` ni `.user.ini`. Mitigación: `X-Powered-By` se elimina (D-17); `LectorSolicitud` rechaza todo cuerpo no JSON (incluido `multipart/form-data`) y `post_max_size`/`upload_max_filesize` = 1M. El README documenta fijar ambas en `php.ini` (local) y en el panel (HLT-11). | No |
| D-05 | Política CORS | A) Solo omitir ACAO a orígenes no permitidos · B) A + 403 en métodos ≠ `OPTIONS` con `Origin` no permitido | B | Defensa adicional: un navegador en un origen ajeno no ejecuta efectos aunque la petición sea "simple". Peticiones sin `Origin` (curl, servidor) pasan. Preflight siempre 204. `Max-Age: 600`. Para orígenes permitidos se agrega `Access-Control-Expose-Headers: Retry-After` (G-05; OBS-01 de HLT-07). | No |
| D-06 | Cómo sabe `CorsConfig` (paso 5) el recurso antes del paso 7 | A) Mover CORS después del Enrutador · B) `Enrutador::segmentos()` es puro (sin respuesta); `index.php` calcula el booleano y lo pasa a `CorsConfig::aplicar(bool)` | B | Respeta el orden §4.3 y mantiene `CorsConfig` idéntica (el mapa `RECURSOS_CON_CREDENCIALES` vive en `index.php`). | No |
| D-07 | HTTP con `FORZAR_HTTPS=true` | A) Redirigir 301 · B) Rechazar 403 `Acceso denegado` | B | Un 301 en `POST`/`PUT` cambia de método en algunos clientes y la petición ya viajó en claro; rechazar es determinista. HTTPS = `$_SERVER['HTTPS']` no vacío y ≠ `off`, o `SERVER_PORT` = 443. Cabeceras de proxy (`X-Forwarded-Proto`) quedan para HLT-11 con DH-12. | No |
| D-08 | `Cache-Control` | A) Solo en autenticadas · B) `no-store` en todas | B | Superconjunto de E-09; la API no tiene respuestas cacheables. | No |
| D-09 | `ManejadorErrores` | A) Todo aviso = 500 · B) `E_WARNING`/`E_NOTICE`/`E_DEPRECATED` (y sus `E_USER_*`) se registran y la ejecución sigue; `E_USER_ERROR`/`E_RECOVERABLE_ERROR` → `ErrorException`; fatales por `register_shutdown_function` → 500 | B | A rompería endpoints existentes que hoy emiten avisos en PHP 8 sin efecto en la respuesta. Respeta `@` (si `error_reporting() & $nivel` = 0, devuelve `false`). `ob_start()` para descartar salida parcial; `zend.exception_ignore_args=1` (sin argumentos en trazas); `error_log` = `RUTA_LOGS/php_errores.log`. Expone `responderError(int, string): never`, que usan las otras 4 clases. | No |
| D-10 | Base de la ruta en el `Enrutador` | A) Prefijo en `.env` · B) `dirname($_SERVER['SCRIPT_NAME'])` | B | Sin configuración extra y funciona en subcarpeta o raíz (E-13). Comparación sensible a mayúsculas (`criterioKelly`). Máximo 3 segmentos (`planes/suscritos/{id}` usa 3); segmento `^[A-Za-z0-9_-]+$` (rechaza `..`, `.`, `%`). | No |
| D-11 | Dónde se responde el `GET` sin acción | A) En cada `Rts` · B) En `index.php` paso 10, después del punto de inserción de HLT-03, y se borran los bloques de estado de los `Rts` | B | Un solo lugar (O-04); queda detrás del limitador de HLT-03 (A-06 aplica a públicos). Los bloques de los `Rts` quedan inalcanzables y se eliminan. HLT-03 trata `GET` con `$accion === ''` como público. | No |
| D-12 | Recursos sin código | A) Mantener `/usuario`, `/rol` (archivos vacíos, hoy 200 vacío) y `/sinteticos`, `/otros` (archivo inexistente, hoy 500) · B) Quitarlos del mapa → 404 | B | Menor superficie; la app no los usa (búsqueda en `criterioKellyApp/src/app`). Los archivos vacíos no se borran (fuera de alcance). | No |
| D-13 | Página de anuncio | A) Eliminarla · B) Mantenerla en `index.php` y llamarla solo con `APP_ENTORNO=local`, raíz y `Accept: text/html` | B | El requerimiento la permite en local. Con la CSP `default-src 'none'` se muestra sin estilos: se acepta (solo local). | No |
| D-14 | Reglas de `LectorSolicitud` | — | Cuerpo vacío permitido; no vacío → `Content-Type` `^application/json(\s*;.*)?$` (insensible a mayúsculas), `CONTENT_LENGTH` y longitud real ≤ 1 048 576, `json_decode(…, true, 64, JSON_THROW_ON_ERROR)` que dé `array`. `HEAD` → 405 (no está en E-10). Cuerpo decodificado disponible en `obtenerCuerpoJson(): ?array`. | Compatible con HLT-03 D-25 y HLT-07 D-22 (`{}` con `Content-Type` JSON). Los `Rts` siguen leyendo `php://input` (PHP permite releerlo). | No |
| D-15 | Fugas de C-08 en código existente | A) Fuera de alcance · B) Corregir solo las líneas que responden el mensaje interno | B | C-08 es de HLT-02 (plan §3). Líneas: `CriterioKellyCtrl.php:55,101,143,189,225`, `BitacoraCtrl.php:108-110` (devuelve el texto del modelo con `getMessage`), `PersonaCtrl.php:143` (un texto de error del modelo se devolvía como `idUsuario` con 200), `CriptoRts.php:67`, `ForexRts.php:66`, `IndiceRts.php:67`. Los modelos que arman esos textos (`CuentasMdl.php:52`, `BitacoraMdl.php:42`, `PersonaMdl.php:102`) los reescriben HLT-04/HLT-06 con transacciones. | No |
| D-16 | `forex/disponible` (~38 s medidos el 2026-11-02) contra `max_execution_time 30` | A) Excepción de tiempo para ese endpoint · B) Mantener 30 s y aceptar 500 genérico en local Windows | B | E-11 es explícito; `rest_divisas` no está conectado a la app. En Linux el límite cuenta CPU y no esperas de red. Caché/asincronía: historia aparte. | No |
| D-17 | `X-Powered-By` y `Server` | — | `header_remove('X-Powered-By')` en `CabecerasSeguridad` + `Header always unset` y `Header unset` en `.htaccess`. `Server` detallado no se controla desde `.htaccess` (`ServerTokens` es de servidor): README local + HLT-11. | Comprobado: hoy `Header always unset X-Powered-By` no lo quita (PHP lo pone en la otra tabla de cabeceras). | No |
| D-18 | `ErrorDocument` | A) Páginas de error · B) Ninguno | B | Todo llega a `index.php`, que responde JSON; los `ErrorDocument` actuales apuntan a archivos inexistentes (S-10). | No |
| D-19 | Barra final de carpetas | — | `DirectorySlash Off` | E-02 prohíbe 301; con la reescritura total, ninguna carpeta se sirve. | No |
| D-20 | Punto de inserción para HLT-03 | — | Comentario exacto entre el paso 7 y el paso 10: `// Pasos 8 y 9 (HLT-03): ValidadorSesion::exigir() si la ruta no es pública y LimitadorPeticiones::controlar() se insertan aquí.` | Explícito y con contexto. | No |
| D-21 | Lectura de la acción en los `Rts` | A) Que todos usen `$accion` del `Enrutador` · B) Mantener su bucle (RD-7) | B | RN-17 garantiza coincidencia; HLT-03 (T-18) cambia `ValidacionRts` y HLT-04/05/06 los demás al reescribirlos. | No |
| D-22 | Constante del nombre del servicio | — | Se reutiliza `NOMBRE_SERVICIO` de HLT-01 para la respuesta de estado | HLT-03 (D-31) declara además `SERVICIO_ACTUAL` para auditoría; ambas conviven sin conflicto (ver hallazgo en H6). | No |
| D-23 | `CorsConfig` actual (`configurar()`, `manejarPreflight()`) | — | Se reescribe con la API `aplicar(bool $permitirCredenciales): void`; desaparecen los métodos viejos y su `Cache-Control`/`Expires` (`rest_*/configuracion/CorsConfig.php:5-29`) | Plan §4.2 ("reescribe"). | No |
| D-24 | CORS hardcodeado en `rest_usuario/rutas/CategoriaRts.php:4-24` (no registrado) | A) Ignorar · B) Eliminar la función y su preflight | B | J-01 (cero `localhost` en PHP) y CORS en un solo lugar. El archivo sigue sin registrarse. | No |

---

## H6. Revisión del requerimiento por parte de un senior

### Revisión 1 (borrador)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | — |
| 2 | Reglas | ✅ | — |
| 3 | Impacto | ❌ | El borrador respondía el estado del servicio en el paso 7, **antes** del punto de inserción: el limitador de HLT-03 (paso 9) no cubriría ese endpoint público (A-06). |
| 4 | Consistencia | ❌ | `.htaccess` con `SetEnvIf` **y** regla `E=`: 2 líneas `HTTP_AUTHORIZATION`, y la tarea puerta de HLT-03 (IR-07) exige 1. El `Enrutador` devolvía `null` para recurso/acción ausentes; IR-03 exige `''`. |
| 5 | Riesgos | ✅ | — |
| 6 | Simplicidad | ✅ | — |
| 7 | Seguridad | ❌ | Preflight sin `Allow-Credentials` en `autenticacion/*` (IR-05 lo exige también en el preflight). Sin `Expose-Headers: Retry-After`, la app no puede leer el 429 (OBS-01 de HLT-07). |
| 8 | Cobertura | ✅ | — |
| 9 | Determinismo | ❌ | Las pruebas usaban `curl -I` (envía `HEAD`, que ahora da 405): las cabeceras de E-09 parecerían ausentes. |
| 10 | Ejecutabilidad | ✅ | — |

**Veredicto revisión 1: APROBADO CON CAMBIOS.** Cambios aplicados: D-11 (estado en el paso 10), D-03 (una línea), `Enrutador` con `''` (H8 §8.6), credenciales en el preflight y `Expose-Headers` (D-05, H8 §8.4), y todas las pruebas usan `curl -s -D - -o /dev/null` con `GET`.

### Revisión 2 (versión final)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | Los 13 criterios del requerimiento están en H4. |
| 2 | Reglas | ✅ | RN-01…RN-17, booleanas y sin contradicciones. |
| 3 | Impacto | ✅ | Archivos afectados listados por tarea; los `Rts` solo pierden bloques inalcanzables; las 7 líneas de C-08 están identificadas. Uso de la app revisado: `DELETE cuentas/eliminar` envía cuerpo JSON (`cuentas.service.ts:53-56`), compatible con D-14. |
| 4 | Consistencia | ✅ | Orden §4.3 pasos 1–7 + inserción 8–9 + paso 10; IR-01…IR-10 de HLT-03 verificados en T-27. |
| 5 | Riesgos | ✅ | Tabla abajo. |
| 6 | Simplicidad | ✅ | Solo las 5 clases de §4.2; sin clases extra (la respuesta de error compartida vive en `ManejadorErrores`). |
| 7 | Seguridad | ✅ | Falla cerrado (sin `IfModule mod_rewrite`), CORS estricto, sin fugas en 500. |
| 8 | Cobertura | ✅ | 100 %. |
| 9 | Determinismo | ✅ | Contenido exacto de `.htaccess`, `.user.ini`, `index.php` y contratos de clases en H8. |
| 10 | Ejecutabilidad | ✅ | Cada tarea con comando de aceptación. |

**Riesgos**

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| El `.htaccess` (`[END]`, `DirectorySlash`, `php_flag`) no es compatible con el servidor real (LiteSpeed, FPM, `AllowOverride` limitado) y da 500. | Alta | `php_flag` dentro de `<IfModule php_module>` + `.user.ini`; HLT-11 repite L-E02 en staging antes de producción (E-02 exige verificación en staging). |
| Un `CORS_ORIGENES_*` mal configurado bloquea a la app con 403. | Media | Valores locales de HLT-01 (`8100`, `4200`, nativos); el 403 se ve en la red del navegador; README documenta la clave. |
| Apache atiende `TRACE` antes de `mod_rewrite`. | Media | D-02: T-21 lo comprueba; si falla, acción de entorno `TraceEnable Off` y registro para HLT-11. |
| Detrás de un proxy TLS (Cloudflare "Flexible") toda petición llega como HTTP y `FORZAR_HTTPS` la rechaza. | Media | D-07; HLT-11 exige TLS completo hasta el origen o confía en `X-Forwarded-Proto` solo desde los rangos del WAF (DH-12). |
| `forex/disponible` supera 30 s. | Baja | D-16; no lo usa la app. |
| La página de anuncio sin estilos en local. | Baja | D-13. |

**Hallazgos que contradicen o completan la HU / plan (para el responsable):**

1. E-11: `expose_php` y `file_uploads` no se pueden fijar por `.htaccess` ni `.user.ini` (D-04).
2. E-09: el `Server` detallado no se puede quitar desde `.htaccess` (D-17).
3. E-06 (HU) nombra una clave `CORS_ORIGENES`; rige el plan §4.1 (`CORS_ORIGENES_WEB` + `CORS_ORIGENES_NATIVOS`).
4. `Access-Control-Expose-Headers: Retry-After` no está en E-06 ni §4.2; se agrega por G-05 (D-05).
5. HLT-03 declara `SERVICIO_ACTUAL` y HLT-01 `NOMBRE_SERVICIO` con el mismo valor: redundancia sin efecto funcional (D-22).
6. E-11 (30 s) choca con `forex/disponible` en local (D-16).

**Veredicto revisión 2: APROBADO.** El HLT cumple el contrato H1…H11, cubre al 100 % los criterios asignados y deja exactamente la interfaz que HLT-03 verifica en su tarea puerta.

---

## H7. Plan de tareas

Todas las tareas son de `desarrollador-php`. Orden topológico; T-02…T-06 son paralelizables entre sí.

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|--------|
| T-01 | desarrollador-php | Confirmar el cierre de HLT-01 y capturar la línea base | `RS/HLT-02/linea_base.txt` (nuevo) | HLT-01 | `RS/HLT-01/REPORTE.md` con estado `COMPLETADO`; `bash RS/regresion_endpoints.sh 03 RS/HLT-02/linea_base.txt` → 58 líneas. | RN-16 |
| T-02 | desarrollador-php | Crear `ManejadorErrores` | `rest_usuario/configuracion/ManejadorErrores.php` (nuevo) | T-01 | `$PHP -l` OK; contrato H8 §8.2. | C-08, RN-11 |
| T-03 | desarrollador-php | Crear `CabecerasSeguridad` | `rest_usuario/configuracion/CabecerasSeguridad.php` (nuevo) | T-01 | `$PHP -l` OK; contrato H8 §8.3. | E-04, E-09 |
| T-04 | desarrollador-php | Reescribir `CorsConfig` | `rest_usuario/configuracion/CorsConfig.php:1-30` | T-01 | `$PHP -l` OK; contrato H8 §8.4; `grep -c "localhost\|\*" ` sobre el archivo = 0. | E-06, E-08 |
| T-05 | desarrollador-php | Crear `LectorSolicitud` | `rest_usuario/configuracion/LectorSolicitud.php` (nuevo) | T-01 | `$PHP -l` OK; contrato H8 §8.5. | C-06, E-10, E-05 |
| T-06 | desarrollador-php | Crear `Enrutador` | `rest_usuario/configuracion/Enrutador.php` (nuevo) | T-01 | `$PHP -l` OK; contrato H8 §8.6. | E-13 |
| T-07 | desarrollador-php | Copiar las 5 clases a los otros 3 backends | `rest_{criteriokelly,suscripcion,divisas}/configuracion/{ManejadorErrores,CabecerasSeguridad,CorsConfig,LectorSolicitud,Enrutador}.php` | T-02…T-06 | Chequeo SHA-256 del plan §4.2: las 7 primeras líneas (`Configuracion` … `Enrutador`) muestran `1`. | RN-14 |
| T-08 | desarrollador-php | Reescribir los 4 `.htaccess` | `rest_usuario/.htaccess:1-186`, `rest_criteriokelly/.htaccess:1-186`, `rest_suscripcion/.htaccess:1-186`, `rest_divisas/.htaccess:1-186` | T-07 | Contenido exacto de H8 §8.7; RN-02 (`.htaccess` = 1); `grep -c "rest_\|ErrorDocument\|HTTP_REFERER\|Access-Control" rest_*/.htaccess` = 0; `grep -n HTTP_AUTHORIZATION` = 1 por archivo. | E-02, E-05, E-10, E-11, E-12 |
| T-09 | desarrollador-php | Crear los 4 `.user.ini` | `rest_{usuario,criteriokelly,suscripcion,divisas}/.user.ini` (nuevos) | T-08 | Contenido de H8 §8.7; RN-02 (`.user.ini` = 1). | E-11 |
| T-10 | desarrollador-php | Reescribir el arranque de `rest_usuario/index.php` (pasos 3–10) | `rest_usuario/index.php:5-62` (bloque `CorsConfig::configurar()` … `if (!$rutaEncontrada) {…}`; HLT-01 desplazó estas líneas) | T-08 | `$PHP -l` OK; contenido de H8 §8.8 con `RUTAS = ['persona' => 'rutas/PersonaRts.php', 'autenticacion' => 'rutas/ValidacionRts.php']` y `RECURSOS_CON_CREDENCIALES = ['autenticacion']`; `curl -s $B/rest_usuario/autenticacion` = `{"servicio":"rest_usuario","estado":"activo"}`; `grep -c "strpos(\$requestUri" rest_usuario/index.php` = 0. | E-13, RN-13, RN-15, D-12 |
| T-11 | desarrollador-php | Reescribir el arranque de `rest_criteriokelly/index.php` | `rest_criteriokelly/index.php:5-62` | T-08 | Ídem con `RUTAS` = `cuentas`, `bitacora`, `comentarios`, `criterioKelly` y `RECURSOS_CON_CREDENCIALES = []`; R-19 = 200. | Ídem |
| T-12 | desarrollador-php | Reescribir el arranque de `rest_suscripcion/index.php` | `rest_suscripcion/index.php:5-60` | T-08 | Ídem con `planes`, `suscripcion` y `[]`; R-41 = 200; `curl -s -o /dev/null -w "%{http_code}" $B/rest_suscripcion/planes/suscritos/1` ≠ 404 de enrutador (3 segmentos). | Ídem |
| T-13 | desarrollador-php | Reescribir el arranque de `rest_divisas/index.php` | `rest_divisas/index.php:5-63` | T-08 | Ídem con `cripto`, `forex`, `indice` y `[]`; R-48 = 200; R-53 = 404. | Ídem, D-12 |
| T-14 | desarrollador-php | Eliminar bloques de estado y CORS propios de las rutas de `rest_usuario` | `rest_usuario/rutas/PersonaRts.php:50-73`, `rest_usuario/rutas/ValidacionRts.php:44-62`, `rest_usuario/rutas/CategoriaRts.php:4-24,63-81` | T-10 | `$PHP -l` OK en los 3; `grep -c "healthData\|Access-Control\|localhost" rest_usuario/rutas/*.php` = 0; R-06 y R-09 igual que la línea base. | O-04, D-24 |
| T-15 | desarrollador-php | Eliminar bloques de estado de las rutas de `rest_criteriokelly` | `rest_criteriokelly/rutas/BitacoraRts.php:53-65`, `ComentariosRts.php:48-60`, `CriterioKellyRts.php:43-55`, `CuentasRts.php:51-63` | T-11 | `$PHP -l` OK; `grep -c healthData rest_criteriokelly/rutas/*.php` = 0; R-19, R-24, R-26, R-31 igual que la línea base. | O-04 |
| T-16 | desarrollador-php | Eliminar bloques de estado de las rutas de `rest_suscripcion` | `rest_suscripcion/rutas/PlanesRts.php:44-55`, `SuscripcionRts.php:44-56` | T-12 | `$PHP -l` OK; `grep -c healthData` = 0; R-41, R-45 igual que la línea base. | O-04 |
| T-17 | desarrollador-php | Eliminar bloques de estado y el campo `detalle` de las rutas de `rest_divisas` | `rest_divisas/rutas/CriptoRts.php:44-55,63-69`, `ForexRts.php:43-54,62-68`, `IndiceRts.php:44-55,63-69` | T-13 | `$PHP -l` OK; `grep -c "healthData\|detalle" rest_divisas/rutas/*.php` = 0; cada `catch` hace `error_log('[<Archivo>::disponible] ' . $e->getMessage())` y responde 500 `{"error":"Error interno del servidor"}`. | O-04, C-08 |
| T-18 | desarrollador-php | Quitar las fugas de mensajes internos en `rest_criteriokelly` | `rest_criteriokelly/controladores/CriterioKellyCtrl.php:55,101,143,189,225`, `rest_criteriokelly/controladores/BitacoraCtrl.php:108-110` | T-15 | `$PHP -l` OK; en cada línea: `error_log('[CriterioKellyCtrl::<método>] ' . $e->getMessage());` + `respuestaErrorSimple('Error interno del servidor', 500)`; en `BitacoraCtrl`, si el resultado es texto se registra con `error_log` y se responde `'No se pudo crear el registro de bitácora'` 500; RN-11 (`grep`) = 0 en esos archivos. | C-08, D-15 |
| T-19 | desarrollador-php | Quitar la fuga de `persona/agregar` | `rest_usuario/controladores/PersonaCtrl.php:143` | T-14 | `$PHP -l` OK; la condición pasa a `if (!is_int($resultado) \|\| $resultado <= 0)` (el modelo devuelve el id entero o un texto/`false`); R-05 = 200 `objeto:idUsuario` y R-16 = 409 igual que la línea base. | C-08, D-15 |
| T-20 | desarrollador-php | Probar la lista blanca (L-E02) en los 4 backends | `RS/HLT-02/prueba_e02.txt` (nuevo) | T-13, T-09 | Para cada URL de L-E02: `curl -s --path-as-is -o /dev/null -w "%{http_code}"` ∈ {403, 404}; 0 casos en 200 o 3xx. | E-02, RN-01, RN-12 |
| T-21 | desarrollador-php | Probar métodos y cuerpos | `RS/HLT-02/prueba_metodos_cuerpo.txt` (nuevo) | T-13 | Contra `$B/rest_criteriokelly/cuentas/nueva`: M-01 `-X PATCH` → 405 `{"error":"Método no permitido"}` con cabecera `Allow`; M-02 `-X HEAD` (vía `-X HEAD -o /dev/null -w`) → 405; M-03 `-X TRACE` → 405; M-04 `POST` JSON inválido `{"a":` → 400 `{"error":"Solicitud inválida"}`; M-05 `POST` con `Content-Type: text/plain` y cuerpo `{}` → 400; M-06 `POST` de 1 100 000 bytes JSON válido → 400; M-07 `POST` `"texto"` (JSON escalar) → 400; M-08 `POST` `{}` con JSON a `$B/rest_usuario/autenticacion/autenticar` → código ≠ 400 con `Solicitud inválida` (IR-06); M-09 `DELETE` sin cuerpo a `$B/rest_criteriokelly/bitacora/eliminarBitacora?id=abc` → 400 del `Rts` (no de `LectorSolicitud`). | E-10, C-06, RN-09, RN-10 |
| T-22 | desarrollador-php | Probar CORS y preflight | `RS/HLT-02/prueba_cors.txt` (nuevo) | T-13 | Con `curl -s -D - -o /dev/null`: C-01 `OPTIONS` a `$B/rest_criteriokelly/cuentas/obtener` con `Origin: http://localhost:8100` y `Access-Control-Request-Method: GET` → 204, `Access-Control-Allow-Origin: http://localhost:8100`, `Vary: Origin`, `Allow-Headers` con `Authorization, Content-Type, X-Cliente, X-Requested-With`, sin `Allow-Credentials`; C-02 igual con `Origin: https://malicioso.example` → 204 sin ACAO; C-03 `OPTIONS` a `$B/rest_usuario/autenticacion/renovar` con `Origin: http://localhost:8100` → `Access-Control-Allow-Credentials: true`; C-04 igual con `Origin: capacitor://localhost` → ACAO presente y sin `Allow-Credentials`; C-05 `GET $B/rest_usuario/persona` con origen web → sin `Allow-Credentials`; C-06 `GET $B/rest_criteriokelly/cuentas/obtener?id=1` con `Origin: https://malicioso.example` → 403 `{"error":"Acceso denegado"}` sin ACAO; además las respuestas con origen permitido llevan `Access-Control-Expose-Headers: Retry-After`. | E-06, E-08, RN-04…RN-06 |
| T-23 | desarrollador-php | Probar cabeceras de seguridad y HTTPS | `RS/HLT-02/prueba_cabeceras.txt` (nuevo); temporal: `rest_criteriokelly/.env` (`FORZAR_HTTPS`, se restaura) | T-13 | `curl -s -D - -o /dev/null` (GET) a una ruta 200, una 404 y una 500 (la de T-26) muestra las 10 cabeceras de H8 §8.3 y no `X-Powered-By`; H-01 con `FORZAR_HTTPS=false` no hay `Strict-Transport-Security`; H-02 con `FORZAR_HTTPS=true`, `http://localhost/...` → 403; H-03 `curl -k https://localhost/criterio_kelly/rest_criteriokelly/` → 200 con `Strict-Transport-Security: max-age=31536000; includeSubDomains`; al final el `sha256sum` del `.env` es el del inicio. | E-04, E-09, RN-07, RN-08 |
| T-24 | desarrollador-php | Probar que `Authorization` llega a PHP | Temporal fuera de los repos: `C:\xampp\htdocs\prueba_hlt02_e05\.htaccess` (copia de `rest_usuario/.htaccess`) e `index.php` (imprime `presente` si `HTTP_AUTHORIZATION` o `REDIRECT_HTTP_AUTHORIZATION` existen, `ausente` si no; nunca el valor) | T-08 | `curl -s -H "Authorization: Bearer prueba" http://localhost/prueba_hlt02_e05/x/y` = `presente`; sin la cabecera = `ausente`; la carpeta se borra al terminar. | E-05, RN-03 |
| T-25 | desarrollador-php | Probar el enrutador con otro prefijo | Temporal: `C:\xampp\htdocs\prueba_hlt02_e13\` con copia de `rest_suscripcion/index.php` y de `rest_suscripcion/.htaccess` + línea `SetEnv RUTA_APLICACION "C:/xampp/htdocs/criterio_kelly/rest_suscripcion"` | T-12 | `http://localhost/prueba_hlt02_e13/planes/disponible` responde el mismo código y forma que R-41; `.../prueba_hlt02_e13/` → estado; `.../prueba_hlt02_e13/planes/disponible/x/y` → 404; la carpeta se borra. | E-13, RN-12, RN-17 |
| T-26 | desarrollador-php | Probar el 500 genérico y su registro | Temporal: `rest_criteriokelly/.env` (`DB_CLAVE` incorrecta, se restaura) | T-18 | `curl -s -w " %{http_code}" "$B/rest_criteriokelly/cuentas/obtener?id=1"` = `{"error":"Error interno del servidor"} 500` o el mensaje genérico del controlador con 500; `rest_criteriokelly/logs/php_errores.log` contiene `Error de conexión` y `Access denied`; la respuesta no contiene `Access denied`, `mysqli` ni rutas; `.env` restaurado (mismo `sha256sum`). | C-08, RN-11 |
| T-27 | desarrollador-php | Verificar la interfaz que consume HLT-03 (IR-01…IR-10) | `RS/HLT-02/prueba_interfaz_hlt03.txt` (nuevo) | T-13…T-19 | Los 10 comandos de HLT-03 H7.2 dan el resultado esperado, en particular: IR-03 (`$metodo`, `$recurso`, `$accion` strings antes del `require` del paso 10), IR-05 (C-03/C-05 de T-22), IR-07 (1 línea), IR-08 (`ManejadorErrores::registrar` = 1), IR-10. | RN-13 |
| T-28 | desarrollador-php | Ejecutar la regresión y compararla con la línea base | `RS/HLT-02/regresion.txt`, `RS/HLT-02/diferencias.txt` (nuevos) | T-20…T-27 | `bash RS/regresion_endpoints.sh 04 RS/HLT-02/regresion.txt`; `diff` de columnas 1,2,4,5 contra `linea_base.txt`; cada diferencia figura en "Cambios esperados" (H3). | RN-15, RN-16 |
| T-29 | desarrollador-php | Actualizar los README | `rest_usuario/README.md`, `rest_criteriokelly/README.md`, `rest_suscripcion/README.md`, `rest_divisas/README.md` (secciones "Estructura", "CORS", "Endpoints", "Formato de respuestas", "Ambiente local", "Estado actual") | T-28 | En cada README: sección `### Seguridad HTTP` con la lista blanca, CORS desde `.env`, códigos 400/403/404/405/500 de §4.5, el estado `{servicio, estado}`; en "Ambiente local", `ServerTokens Prod`, `TraceEnable Off`, `expose_php=Off` y `file_uploads=Off` en la configuración de XAMPP como pasos opcionales recomendados; `grep -c "localhost:8100\` solo\|status, timestamp, version" rest_*/README.md` = 0; `rest_divisas` sin las viñetas `/sinteticos`, "Mensajes del estado de servicio copiados" ni `detalle`. | Regla 5 del plan, E-11, O-04 |

---

## H8. Reglas de implementación deterministas

### 8.1 Reglas generales

Rigen las de HLT-01 H8 §8.1 (PHP 8.2, Composer restringido, capas, consultas preparadas, secretos, errores, nombres, `declare(strict_types=1)` en clases nuevas, copias idénticas escritas una vez en `rest_usuario` y copiadas con `cp`, alcance por tarea, sin commits). Además:

- Las 5 clases son `final`, con métodos `public static` y estado `private static`; no leen `$_GET` ni escriben fuera de cabeceras/respuesta.
- Mensajes HTTP exactamente los de plan §4.5: `Solicitud inválida`, `Acceso denegado`, `Recurso no encontrado`, `Método no permitido`, `Error interno del servidor`.
- Toda respuesta de error de estas clases pasa por `ManejadorErrores::responderError()`.
- Las pruebas de cabeceras usan `GET` (`curl -s -D - -o /dev/null`), nunca `curl -I`.

### 8.2 `ManejadorErrores` (T-02)

| Método | Contrato |
|--------|----------|
| `registrar(): void` | `ini_set('display_errors','0')`, `ini_set('log_errors','1')`, `ini_set('error_log', Configuracion::obtener('RUTA_LOGS') . '/php_errores.log')`, `ini_set('zend.exception_ignore_args','1')`; `ob_start()`; `set_exception_handler([self::class,'manejarExcepcion'])`; `set_error_handler([self::class,'manejarError'])`; `register_shutdown_function([self::class,'manejarCierre'])`. |
| `manejarExcepcion(Throwable $error): void` | `error_log(sprintf("[%s] %s en %s:%d\n%s", $error::class, $error->getMessage(), $error->getFile(), $error->getLine(), $error->getTraceAsString()))`; si `!headers_sent()` → `responderError(500, 'Error interno del servidor')`; si no, `exit`. |
| `manejarError(int $nivel, string $mensaje, string $archivo, int $linea): bool` | Si `!(error_reporting() & $nivel)` → `false`. Si `$nivel` ∈ {`E_USER_ERROR`, `E_RECOVERABLE_ERROR`} → `throw new ErrorException($mensaje, 0, $nivel, $archivo, $linea)`. Si no → `error_log("[aviso $nivel] $mensaje en $archivo:$linea")` y `true`. |
| `manejarCierre(): void` | `$ultimo = error_get_last()`; si su `type` ∈ {`E_ERROR`, `E_PARSE`, `E_CORE_ERROR`, `E_COMPILE_ERROR`} → `error_log` con mensaje/archivo/línea y, si `!headers_sent()`, `responderError(500, 'Error interno del servidor')`. |
| `responderError(int $codigoHttp, string $mensaje): never` | `while (ob_get_level() > 0) { ob_end_clean(); }` `http_response_code($codigoHttp)`; `header('Content-Type: application/json; charset=utf-8')`; `echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE)`; `exit`. |

### 8.3 `CabecerasSeguridad` (T-03)

`aplicar(): void`, en este orden:

1. `header_remove('X-Powered-By')`.
2. Las 10 cabeceras: `Content-Type: application/json; charset=utf-8` · `Cache-Control: no-store` · `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · `Referrer-Policy: no-referrer` · `Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` · `Cross-Origin-Resource-Policy: same-site` · `X-XSS-Protection: 0` · `Vary: Origin` (se envía aquí en toda respuesta; `CorsConfig` no la vuelve a enviar).
3. Si `Configuracion::obtenerBooleano('FORZAR_HTTPS')`: si la petición no es HTTPS (D-07) → `ManejadorErrores::responderError(403, 'Acceso denegado')`; si lo es → `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

### 8.4 `CorsConfig` (T-04)

Constantes: `METODOS_PERMITIDOS = 'GET, POST, PUT, DELETE, OPTIONS'`, `CABECERAS_PERMITIDAS = 'Authorization, Content-Type, X-Cliente, X-Requested-With'`, `CABECERAS_EXPUESTAS = 'Retry-After'`, `SEGUNDOS_CACHE_PREFLIGHT = 600`.

`aplicar(bool $permitirCredenciales): void`:

1. `$origen = $_SERVER['HTTP_ORIGIN'] ?? null`; `$web = Configuracion::obtenerLista('CORS_ORIGENES_WEB')`; `$nativos = Configuracion::obtenerLista('CORS_ORIGENES_NATIVOS')`; `$esPreflight = $_SERVER['REQUEST_METHOD'] === 'OPTIONS'`.
2. `$esPermitido = $origen !== null && in_array($origen, array_merge($web, $nativos), true)`.
3. Si `$esPermitido`: `Access-Control-Allow-Origin: $origen`; `Access-Control-Expose-Headers: Retry-After`; si `$permitirCredenciales && in_array($origen, $web, true)` → `Access-Control-Allow-Credentials: true`.
4. Si `$origen !== null && !$esPermitido && !$esPreflight` → `ManejadorErrores::responderError(403, 'Acceso denegado')`.
5. Si `$esPreflight`: si `$esPermitido` → `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Max-Age: 600`; `while (ob_get_level() > 0) ob_end_clean();` `http_response_code(204)`; `exit`.

### 8.5 `LectorSolicitud` (T-05)

Constantes: `METODOS_PERMITIDOS = ['GET','POST','PUT','DELETE','OPTIONS']`, `TAMANO_MAXIMO_CUERPO = 1048576`, `PROFUNDIDAD_MAXIMA_JSON = 64`. Estado: `private static ?array $cuerpoJson = null`.

| Método | Contrato |
|--------|----------|
| `validarMetodoYCuerpo(): void` | Método ∉ lista → `header('Allow: GET, POST, PUT, DELETE, OPTIONS')` + `responderError(405, 'Método no permitido')`. `(int)($_SERVER['CONTENT_LENGTH'] ?? 0) > TAMANO_MAXIMO_CUERPO` → 400. `$cuerpo = file_get_contents('php://input', false, null, 0, TAMANO_MAXIMO_CUERPO + 1)`; `strlen > TAMANO_MAXIMO_CUERPO` → 400. `$cuerpo === ''` → retorna. `Content-Type` (`$_SERVER['CONTENT_TYPE']`) no cumple `#^application/json(\s*;.*)?$#i` → 400. `json_decode($cuerpo, true, 64, JSON_THROW_ON_ERROR)` lanza o no da `array` → 400. Guarda el arreglo. Todos los 400 con `Solicitud inválida`. |
| `obtenerCuerpoJson(): ?array` | Arreglo decodificado o `null` si el cuerpo estaba vacío. |
| `obtenerCabecera(string $nombre): ?string` | Clave `HTTP_` + mayúsculas con `-`→`_`; si no existe, la misma con prefijo `REDIRECT_`; para `Content-Type` usa `CONTENT_TYPE`. `null` si no hay. |

### 8.6 `Enrutador` (T-06)

Constantes: `PATRON_SEGMENTO = '/^[A-Za-z0-9_-]+$/'`, `MAXIMO_SEGMENTOS = 3`. Estado: `private static ?array $segmentosCalculados = null; private static bool $calculado = false`.

| Método | Contrato |
|--------|----------|
| `segmentos(): ?array` | Puro (sin salida). `$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/')`; `$ruta = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'`; si `$base !== ''` y (`$ruta === $base` o `str_starts_with($ruta, $base . '/')`) → `$ruta = substr($ruta, strlen($base))`; `array_values(array_filter(explode('/', $ruta), fn ($s) => $s !== ''))`; si algún segmento no cumple el patrón o hay más de 3 → `null`. Cachea el resultado. |
| `resolver(array $rutas): array` | Devuelve `['recurso' => string, 'accion' => string, 'archivo' => string]`. `segmentos()` = `null` → `responderError(404, 'Recurso no encontrado')`. Lista vacía → `['', '', '']`. `!array_key_exists($s[0], $rutas)` → 404. Si no → `['recurso' => $s[0], 'accion' => $s[1] ?? '', 'archivo' => $rutas[$s[0]]]`. |

### 8.7 `.htaccess` y `.user.ini` (T-08, T-09) — contenido exacto, idéntico en los 4

```apache
# Criterio Kelly · API REST · lista blanca: solo se ejecuta index.php (HU-001 E-02, E-05, E-10, E-11, E-12)
Options -Indexes -MultiViews
ServerSignature Off
DirectoryIndex index.php
DirectorySlash Off

RewriteEngine On

# E-05: la cabecera Authorization llega a PHP
RewriteCond %{HTTP:Authorization} .
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

# E-10: TRACE y TRACK no llegan a PHP
RewriteCond %{REQUEST_METHOD} ^(TRACE|TRACK)$ [NC]
RewriteRule ^ - [R=405,L]

# E-02: index.php se ejecuta tal cual; cualquier otra ruta, exista o no, la resuelve index.php
RewriteRule ^index\.php$ - [END]
RewriteRule ^ index.php [END]

<IfModule mod_headers.c>
    Header always unset X-Powered-By
    Header unset X-Powered-By
</IfModule>

# E-11 con mod_php (en PHP-FPM/CGI aplica .user.ini)
<IfModule php_module>
    php_flag display_errors Off
    php_flag log_errors On
    php_value post_max_size 1M
    php_value upload_max_filesize 1M
    php_value max_execution_time 30
</IfModule>
```

```ini
; Criterio Kelly · configuración PHP para hosting con PHP-FPM/CGI (HU-001 E-11)
display_errors = Off
log_errors = On
post_max_size = 1M
upload_max_filesize = 1M
max_execution_time = 30
```

### 8.8 `index.php` (T-10…T-13)

Se conserva el bloque de pasos 1–2 de HLT-01 (H8 §8.6) y la función `mostrarPaginaAnuncio()` al final del archivo sin cambios. Se reemplaza todo lo que hay entre ese bloque y la función (el `require_once` de `CorsConfig`, `CorsConfig::configurar()`, `manejarPreflight()`, `$esRaiz`, `$rutas`, el bucle `strpos` y el 404 antiguo) por:

```php
const RUTAS = [
    'persona' => 'rutas/PersonaRts.php',
    'autenticacion' => 'rutas/ValidacionRts.php',
];
const RECURSOS_CON_CREDENCIALES = ['autenticacion'];

require_once RUTA_APLICACION . '/configuracion/ManejadorErrores.php';
require_once RUTA_APLICACION . '/configuracion/CabecerasSeguridad.php';
require_once RUTA_APLICACION . '/configuracion/CorsConfig.php';
require_once RUTA_APLICACION . '/configuracion/LectorSolicitud.php';
require_once RUTA_APLICACION . '/configuracion/Enrutador.php';

// Paso 3: errores no controlados → 500 genérico
ManejadorErrores::registrar();

// Paso 4: cabeceras de seguridad y HTTPS
CabecerasSeguridad::aplicar();

// Paso 5: CORS y preflight
$primerSegmento = Enrutador::segmentos()[0] ?? '';
CorsConfig::aplicar(in_array($primerSegmento, RECURSOS_CON_CREDENCIALES, true));

// Paso 6: método y cuerpo
LectorSolicitud::validarMetodoYCuerpo();

// Paso 7: recurso y acción por segmento exacto
$metodo = $_SERVER['REQUEST_METHOD'];
['recurso' => $recurso, 'accion' => $accion, 'archivo' => $archivoRuta] = Enrutador::resolver(RUTAS);
if ($recurso === '' && $metodo !== 'GET') {
    ManejadorErrores::responderError(404, 'Recurso no encontrado');
}

// Pasos 8 y 9 (HLT-03): ValidadorSesion::exigir() si la ruta no es pública y LimitadorPeticiones::controlar() se insertan aquí.

// Paso 10: estado del servicio o archivo de ruta
if ($metodo === 'GET' && $accion === '') {
    $esPaginaAnuncio = $recurso === ''
        && Configuracion::obtener('APP_ENTORNO') === 'local'
        && str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'text/html');
    if ($esPaginaAnuncio) {
        mostrarPaginaAnuncio();
        exit;
    }
    echo json_encode(['servicio' => NOMBRE_SERVICIO, 'estado' => 'activo'], JSON_UNESCAPED_UNICODE);
    exit;
}

$rutaArchivo = RUTA_APLICACION . '/' . $archivoRuta;
if (!is_file($rutaArchivo)) {
    throw new RuntimeException('Archivo de ruta inexistente: ' . $archivoRuta);
}
require $rutaArchivo;
```

`RUTAS` y `RECURSOS_CON_CREDENCIALES` por backend: ver T-10…T-13. El cierre `?>` final de los `index.php` actuales se elimina (evita salida accidental).

### 8.9 Ediciones en `rutas/` y `controladores/` (T-14…T-19)

- Bloques de estado: se borra completo el `if (!$action) { … return; }` que contiene `$healthData` (líneas de T-14…T-17). Si la función queda vacía (`BitacoraRts::manejarGet`), se mantiene con cuerpo vacío.
- `CategoriaRts.php`: se borran la función `configurarCORS()`, su llamada y el `if` de `OPTIONS` (líneas 4–24).
- `catch` de `rest_divisas/rutas/*Rts.php`: se reemplaza el arreglo con `detalle` por `error_log(...)` + `http_response_code(500)` + `echo json_encode(['error' => 'Error interno del servidor'], JSON_UNESCAPED_UNICODE)`.
- Controladores: solo las líneas citadas en T-18 y T-19; nada más en esos archivos.

---

## H9. Reglas de seguimiento de ejecución

Símbolos: `⬜` no realizado · `✅` realizado y verificado · `❌` fallido · `➖` no aplica (con justificación). **C4** = `$PHP -l` sin errores sobre cada PHP tocado; **C5** = prueba `curl` del endpoint afectado (caso feliz + al menos un error) con la respuesta real. Rigen RS-1…RS-9.

### Ficha (formato completo; se expande así cada tarea al empezarla)

```
T-01 — Confirmar el cierre de HLT-01 y capturar la línea base
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8, H11)
    [⬜] C4. php -l sobre lo tocado
    [⬜] C5. Prueba curl del endpoint afectado
    [⬜] C6. Sin efectos fuera de alcance
  Evidencia:
  Notas / desviaciones:
```

```
T-02 — Crear ManejadorErrores                                   Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-03 — Crear CabecerasSeguridad                                 Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-04 — Reescribir CorsConfig                                    Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-05 — Crear LectorSolicitud                                    Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-06 — Crear Enrutador                                          Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-07 — Copiar las 5 clases a los otros 3 backends               Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-08 — Reescribir los 4 .htaccess                               Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-09 — Crear los 4 .user.ini                                    Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-10 — Reescribir el arranque de rest_usuario/index.php         Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-11 — Reescribir el arranque de rest_criteriokelly/index.php   Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-12 — Reescribir el arranque de rest_suscripcion/index.php     Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-13 — Reescribir el arranque de rest_divisas/index.php         Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-14 — Limpiar rutas de rest_usuario                            Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-15 — Limpiar rutas de rest_criteriokelly                      Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-16 — Limpiar rutas de rest_suscripcion                        Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-17 — Limpiar rutas de rest_divisas                            Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-18 — Quitar fugas en rest_criteriokelly                       Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-19 — Quitar la fuga de persona/agregar                        Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-20 — Probar la lista blanca                                   Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-21 — Probar métodos y cuerpos                                 Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-22 — Probar CORS y preflight                                  Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-23 — Probar cabeceras y HTTPS                                 Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-24 — Probar Authorization                                     Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-25 — Probar el enrutador con otro prefijo                     Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-26 — Probar el 500 genérico                                   Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-27 — Verificar la interfaz de HLT-03                          Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-28 — Ejecutar la regresión                                    Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
T-29 — Actualizar los README                                    Estado: PENDIENTE  C1⬜ C2⬜ C3⬜ C4⬜ C5⬜ C6⬜
```

C4 y C5 se marcan `➖` con justificación solo si la tarea no toca PHP (T-08, T-09, T-29) o no afecta endpoints (T-02…T-07 hasta que T-10…T-13 los conecten: su C5 se cierra con la evidencia de T-20…T-23).

### Tablero global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-02 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-03 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-04 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-05 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-06 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-07 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-08 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-09 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-10 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-11 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-12 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-13 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-14 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-15 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-16 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-17 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-18 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-19 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-20 | PARCIAL | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | No |
| T-21 | PARCIAL | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | No |
| T-22 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-23 | PARCIAL | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | No |
| T-24 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-25 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-26 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-27 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-28 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-29 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |

---

## H10. Diseño del reporte de ejecución

El agente entrega `docs/Planificacion/evidencias/HLT-02/REPORTE.md` con esta estructura fija (RR-1…RR-5):

```
REPORTE DE EJECUCIÓN — HLT-02 · Endurecimiento HTTP de los 4 backends
  1. Resumen ejecutivo
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas          (copia del tablero H9)
  4. Cobertura vs. HLT         (E-02, E-04, E-05, E-06, E-08, E-09, E-10, E-11, E-12, E-13, C-06, C-08, O-04, RN-01…RN-17; ¿100 %?)
  5. Cambios realizados        (archivo ruta:línea, tipo)
  6. Verificaciones ejecutadas (php -l, SHA-256, L-E02, M-01…M-09, C-01…C-06, H-01…H-03, E-05, E-13, C-08,
                                IR-01…IR-10, diff de regresión — con salida real)
  7. Desviaciones y decisiones
  8. Pendientes / bloqueos
  9. Próximos pasos             (si COMPLETADO: "Ejecutar HLT-03, tarea puerta T-01")
```

Las cabeceras se copian completas; los cuerpos con datos personales se recortan a código y forma; nunca se copian valores del `.env`.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

| Regla | Aplicación en HLT-02 |
|-------|----------------------|
| AR-1 Límite de dominio | Las 5 clases son infraestructura transversal en `configuracion/`, copia idéntica (plan §4.2). |
| AR-2 Capas | `index.php` orquesta la tubería; las clases no conocen controladores ni modelos; los `Rts` no repiten CORS ni estado. |
| AR-3 Contratos | Formato `{error}` y mensajes de plan §4.5; datos directos sin cambios. |
| AR-5 Responsabilidad única | Una clase por paso de §4.3 (errores, cabeceras, CORS, solicitud, enrutamiento). |
| AR-6 Reutilización | `ManejadorErrores::responderError()` es la única forma de emitir errores desde la tubería. |
| CC-1/CC-3 | Español, `camelCase` (`$primerSegmento`, `obtenerCuerpoJson`), `PascalCase` en clases, `UPPER_SNAKE_CASE` en constantes (`RUTAS`, `RECURSOS_CON_CREDENCIALES`, `TAMANO_MAXIMO_CUERPO`). |
| CC-4 | Sin números mágicos: `1048576`, `600`, `3`, `64`, `31536000` como constantes con nombre. |
| CC-5 | Comentarios de paso (`// Paso N: …`) como en H8 §8.8. |
| AF-1…AF-3 | Clases en `configuracion/<Clase>.php`; `.htaccess` y `.user.ini` en la raíz de cada backend. |
| AF-4 | `enlace.php`, `rutas/<X>Rts.php` y `controladores/<X>Ctrl.php` conservan nombre y bucle de acción (D-21). |
| IO-1…IO-9 | No aplican: HLT solo de backend. |
| Nombres de backend | `desarrollador-php.md` "Nombres". |
