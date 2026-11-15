# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace overview

This folder is **not a single repo** — it is a workspace holding the Criterio Kelly trading app and its PHP backends. `criterioKellyApp`, `rest_criteriokelly`, `rest_suscripcion` and `rest_usuario` are each their **own git repository**; `rest_divisas` and the root folder are not under version control. Run git commands from inside the relevant sub-project.

| Folder | What it is |
|--------|-----------|
| `criterioKellyApp/` | Ionic 8 / Angular 20 / Capacitor 7 mobile app (frontend). **Has its own detailed [CLAUDE.md](criterioKellyApp/CLAUDE.md) — read it before touching the app.** |
| `rest_usuario/` | Users, people, roles, categories, login (`/persona`, `/usuario`, `/rol`, `/autenticacion`) → app's `apiUrlLoge` |
| `rest_criteriokelly/` | Kelly business rules: accounts, trading journal, comments, Kelly % (`/cuentas`, `/bitacora`, `/comentarios`, `/criterioKelly`) → app's `apiUrlCritKell` |
| `rest_suscripcion/` | Plans, subscriptions, payments (`/planes`, `/suscripcion` incl. `/suscripcion/planVigente`, `iniciarPrueba` and `cancelar`, and `/pagos`) → app's `apiUrlSuscripcion` |
| `rest_divisas/` | Live asset lists with prices proxied from external APIs: Binance (`/cripto`), Frankfurter (`/forex`), Financial Modeling Prep (`/indice`). Uses no database. **Not wired into the app**, which uses the static `listaDivisas.ts`. Still WIP: `/indice` fatals because `IndiceCtrl` calls a nonexistent `parent::__construct()`, and `/sinteticos` and `/otros` point to a missing `rutas/MarketsRts.php`. |

**Project language is Spanish** everywhere (files, classes, comments, commits, API error messages) — in the backends too.

## Commands

Frontend (run inside `criterioKellyApp/`; see its CLAUDE.md for the full list):

```bash
npm install --legacy-peer-deps      # flag is always required
ionic serve --port=8100              # backends only allow CORS from http://localhost:8100
ng build
ng lint
ng test --watch=false --include='**/nombre.spec.ts'   # single spec
```

Backends: plain PHP (no Composer, no framework, no tests, no build). They run under XAMPP Apache + MySQL with `mod_rewrite`/`mod_headers` enabled. Check syntax with `php -l <file>`; exercise endpoints with curl. `rest_criteriokelly/rutas.txt` and `rest_usuario/rutas.txt` contain example requests/responses.

## Running locally — path gotcha

The app's `src/environments/environment*.ts` point to `http://localhost/rest_usuario/`, `http://localhost/rest_criteriokelly/`, etc., and each backend's `.htaccess` hard-codes its own `/rest_<name>/` prefix in rewrite and error-document rules. With the backends living under `htdocs/criterio_kelly/`, they're actually served at `http://localhost/criterio_kelly/rest_<name>/`. Either serve/copy them at the `htdocs` root, or update both the environment URLs and the `.htaccess` prefixes together.

## Database

`rest_usuario`, `rest_criteriokelly` and `rest_suscripcion` connect to **the same MySQL database, `sist_criteriokelly`** (`root`, empty password, set in each `configuracion/global.php`). Each backend's `anexos/` folder holds **exactly two SQL files, mirroring the live database**: `<proyecto>_estructura.sql` (its tables, `CREATE TABLE IF NOT EXISTS`) and `<proyecto>_datos.sql` (catalogue data only: roles, plans and intervals; never users, passwords, sessions or payments). They are `rest_usuario/anexos/sist_usuario_*.sql` (`sgen_*`), `rest_suscripcion/anexos/sist_suscripcion_*.sql` (`spsu_*`) and `rest_criteriokelly/anexos/sist_criteriokelly_*.sql` (`sck*`). **Any later change to the database is delivered to the user as a ready-to-run update script (to run from the database manager), and afterwards the two files of the affected project are regenerated from the live database** (`mysqldump --no-data` / catalogue tables only) so they never drift. Do not keep older or partial scripts in `anexos/`.

The app also keeps a small **local** DB (SQLite on device / IndexedDB on web) for the Kelly divisor and the lock PIN — see the app's CLAUDE.md.

## Backend architecture (shared by all `rest_*` projects)

Every backend is a copy of the same hand-rolled MVC skeleton; when changing shared plumbing, the change usually needs to be repeated in each project.

Request flow: `.htaccess` (CORS headers for `http://localhost:8100`, security headers, rewrite everything to `index.php`, blocks direct access to `rutas/`, `modelos/`, `configuracion/`, `controladores/`) → `index.php` (`CorsConfig`, OPTIONS preflight, maps a URI prefix to a route file via `strpos`; a browser hit on the root shows a static HTML landing page) → `rutas/<X>Rts.php` (extracts the action segment after the prefix, e.g. `/criterioKelly/obtenerPorcentaje`, decodes the JSON body, `switch` on HTTP method + action) → `controladores/<X>Ctrl.php` (extends `BaseCtrl`: validate required fields, sanitize with `htmlspecialchars`, cast, call the model, emit JSON and `exit`) → `modelos/<X>Mdl.php` (SQL via the `Enlace` mysqli wrapper in `configuracion/enlace.php`).

To add an endpoint: add a `case` for the action in the route file, a controller method, and a model method; to add a resource, also register its prefix in the `$rutas` map in `index.php`.

Conventions:
- **Always use prepared statements** through `Enlace` (`ejecutarConsulta`, `ejecutarConsultaSimpleFila`, `ejecutarInsercionRetornaID`, `ejecutarActualizacion`) with a `bind_param` type string — e.g. `ejecutarConsulta($sql, "ii", $a, $b)`.
- Respond through `BaseCtrl::respuestaExitosaSimple` / `respuestaErrorSimple`: bare data on success (`{success: 'ok'}` when null) and `{error: '<mensaje>'}` on failure. The older `{estado, mensaje, fecha, dato}` envelope (`respuestaJson`) is commented out and still appears in the outdated `rutas.txt` examples; don't reintroduce it, because the app's services and `errorInterceptor` depend on the bare shape.
- The app's `errorInterceptor` maps HTTP status codes to Spanish toasts, preferring a server-provided message; **HTTP 422 is reserved** for "loss limit reached, recharge account", so don't reuse it for generic validation errors.
- DB columns use a short table prefix (`cke_`, `cue_`, …) and the app's TypeScript models use those same field names as-is.
- HLT-03 adds opaque access tokens and rotating refresh tokens. Protected requests must send
  `Authorization: Bearer <accessToken>`; the Angular client is adapted in HLT-07. The four
  backends share the session tables (in `rest_usuario/anexos/sist_usuario_estructura.sql`) and the five security classes in `configuracion/`.
- Kelly math lives server-side (in `rest_criteriokelly` models / SQL), not in the app.
- **Correo (HU-003):** en cada proyecto que envíe correo (hoy solo `rest_usuario`) todo vive en la carpeta `correo/` de la raíz del proyecto (`README.md` con el mapa de puntos de llamada, `EnviadorCorreo.php`, `PlantillasCorreo.php`, `cargarCorreo.php`, `probarCorreo.php`). Cada línea que envía correo lleva el comentario `// [CORREO] <plantilla>` (`grep -rn "\[CORREO\]"` los lista), los registros de local (modo `log`) van en `logs/correos/` y las claves de correo en el bloque `# ===== Correo =====` de `.env`/`.env.ejemplo`. Un proyecto nuevo que envíe correo sigue la misma estructura. Los demás backends y la app no envían correo.
- **Plan vigente y prueba (HU-004):** `rest_suscripcion/configuracion/LectorPlanVigente.php` es la **regla única** (solo lectura, reloj UTC inyectable) de qué plan tiene una cuenta; `servicios/` (`PlanVigenteSrv`, `PruebaGratuitaSrv`, `MejoraPlanSrv`, `CancelacionPlanSrv`) ejecutan las transiciones que expone `GET /suscripcion/planVigente`. Está prevista una copia idéntica del lector en `rest_criteriokelly` (HU-005). El primer inicio de sesión concede la prueba de 24 horas (ya no crea el plan Libre); una cuenta nueva se identifica por `pla_fechacambio`. Orden de bloqueo: usuario → suscripciones → pagos.
- **Zona horaria:** PHP corre en `Europe/Berlin` y la base en hora local; el código nuevo usa solo UTC (`DateTimeImmutable`), sin `date()`, `strtotime()` ni `NOW()`. Los administradores se reconocen con `ContextoSesion::roles()`.
- **Auditoría (HU-004/HU-005):** `RegistroAuditoria.php` es idéntico en los 4 backends (`sha256sum` único) y su lista `EVENTOS` incluye los eventos de plan (`PLAN_CANCELADO`, `PLAN_RENOVACION`, `PLAN_RENOV_ANULADA`, `PLAN_ACTIV_PROGRAM`, `PLAN_PROGRAMADO`, `LIMITE_PLAN_RECHAZADO`, entre otros).
- **Datos de pago administrables (HU-005, HLT-29):** los datos de pago (redes USDT con dirección y QR, PayPal, número del banco) viven en `rest_suscripcion` (`/datosPago/*`; tablas `spsu_metodopago`, `spsu_redusdt`, `spsu_qrpago`) y los administran los roles 1 y 2. El QR se guarda como `MEDIUMBLOB` y se sirve solo por `datosPago/qr` con sesión. Los scripts de actualización se entregan al usuario; `anexos/` se regenera después.
- **Esquema de planes:** `spsu_*` incluye las columnas de duración en horas (`sus_fechaHoraFin`), el plan Prueba, el Libre de 240 horas y las columnas de límite de HU-005.
- **Límites de plan en el servidor (HU-005):** `rest_criteriokelly/configuracion/ControlPlan.php` aplica los límites de cada plan (cuentas, historial, graficar, divisor editable, operaciones diarias); sin plan vigente solo pasa una lista blanca (Mostrar criterio Kelly). Usa una copia **idéntica** de `LectorPlanVigente.php` (mismo `sha256sum` en `rest_suscripcion` y `rest_criteriokelly`; tras cambiar uno, copiarlo al otro y pasar `php rest_suscripcion/anexos/pruebas/lector_plan_vigente.php`). La regla vive en dos lugares (`LectorPlanVigente` y `PlanVigenteSrv`) y ese CLI de equivalencia debe pasar en cada cambio. Un límite superado responde **403** con mensaje propio (`{error}`), nunca 422, y `planVigente` expone el objeto `limites`. La app (`permisos-plan.config.ts`, `planGuard`) solo refleja esos límites. El cierre formal del riesgo R-01 de HU-004 depende de la prueba manual de HU-005.
