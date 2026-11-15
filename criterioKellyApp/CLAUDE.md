# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Criterio Kelly App** — a trading-management mobile app built on the **Kelly Criterion**. It lets a trader keep an operations journal ("bitácora"), compute the optimal position size per account (Kelly %), manage accounts/capital and profiles, produce statistical reports and charts, and manage subscription plans.

- Originally **Ionic 5**, migrated to **Ionic 8 / Angular 20 / Capacitor 7**.
- **Standalone components only** — no `AppModule`.
- State via **NgRx Signals** (`@ngrx/signals` `signalStore`).
- **Spanish is the project language** — file/folder names, class names, comments, and commit messages are all Spanish. Follow this when adding code.

> A complementary, verified `AGENTS.md` exists at the repo root; `README.md` is up to date. This file is the authoritative deep reference.

## Commands

`npm install` **must always** use `--legacy-peer-deps` (unavoidable peer-dependency conflicts).

| Action | Command |
|--------|---------|
| Install deps | `npm install --legacy-peer-deps` |
| Dev server | `ionic serve` (or `ng serve`) |
| Dev server on a port | `ionic serve --port=8100` |
| Build | `ng build` (output dir: `www/`) |
| Production build | `ng build --configuration=production` (this is also the **default** config) |
| Test (watch) | `ng test` |
| Test (single run, CI) | `ng test --watch=false` |
| Run one test file | `ng test --watch=false --include='**/nombre.spec.ts'` |
| Lint | `ng lint` |
| Sync native platforms | `ionic build && npx cap sync` |
| Open native IDE | `npx cap open android` / `npx cap open ios` |

Notes:
- The build uses **`@angular-builders/custom-webpack`** (see `angular.json` + `webpack.config.js`, which only sets a `crypto: false` fallback). CommonJS deps must be whitelisted in `angular.json` under `allowedCommonJsDependencies` (jspdf, pdfmake, file-saver, jszip, canvg, html2canvas, core-js, …) — add there when introducing a new CommonJS library.
- Global styles: `src/theme/variables.scss` + `src/global.scss`. Component styles are SCSS; production caps `anyComponentStyle` at 14 KB and the initial bundle at 5 MB.
- **TypeScript is strict** (`strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `strictTemplates`). Expect the compiler to reject implicit `any`, index-signature dot access, and non-exhaustive returns.
- The web build is a PWA (`@angular/service-worker`, `ngsw-config.json` with assetGroups only, no dataGroups; disabled on native and in dev mode). Serve a build locally with the production headers via `node herramientas/servidor-local-www.mjs` (contract in `herramientas/cabeceras-web.json`); details in the README section "PWA y build web".
- What is **not** set up: no CI/CD, no pre-commit hooks (`.husky`), no e2e, no `.env` files, no monorepo tooling.

## Bootstrap & Providers

No `AppModule` and no `app.config.ts`. Everything is wired in `src/main.ts`:
- Bootstraps `AppComponent` via `bootstrapApplication` with an inline providers array.
- Registers `IonicRouteStrategy`, `provideIonicAngular()`, and the router with `PreloadAllModules` preloading.
- Configures the HTTP client with both DI-based interceptors and the functional `errorInterceptor`.
- Registers all ionicons globally.
- Loads the `jeep-sqlite` custom elements to enable the SQLite/IndexedDB web fallback.

`AppComponent` (`src/app/app.component.ts`) is the shell: it renders the side menu (`MenuStore.listaMenu`, grouped into 4 sections via `gruposMenu`), tracks auth state as signals, hides the menu on `/login` and `/registro`, starts the inactivity timer, and initializes the local database.

## Routing

`src/app/app.routes.ts` — a flat route table, all lazy via `loadComponent`. The default route redirects to `/login`. Most routes are guarded by `GuardAutenticacion`. A block of role-guarded routes (`administracion`, `super-admin`, `acceso-denegado` using `GuardRoles`) is present but **commented out / not active**.

## Feature Layout (`src/app/paginas/`)

Each feature folder typically contains its own `modelos/`, `servicios/`, and `store/` subfolders.

| Feature | What it does | Key pages |
|---------|--------------|-----------|
| `inicio` | Home/dashboard landing | `inicio` |
| `criterioKelly` | Shows computed Kelly % and operational trade amounts per account | `mostrar-criterio-kelly` |
| `planTrading` | Trading-journal lifecycle: open, follow-up, finalize; currency search | `bitacora`, `bitacora-seguimiento`, `bitacora-fin` (el selector de divisa es `ModalBuscaDivisaComponent`, no una página) |
| `reportes` | Statistics, charts, Excel/PDF export | `analisis`, `operativas` (el gráfico es `GraficoEstadisticoComponent`, no una página) |
| `suscripcion` | Subscription plans + user registration (registration no longer creates the subscription: it stores the chosen plan as `plan_reservado`) | `planes`, `registro` |
| `configuracion` | Accounts CRUD & capital, Kelly divisor config, profile, PIN lock/change | `cuentas`, `operativa-kelly`, `perfil`, `cambiar-pin`, `bloqueo` (el PIN es `ModalPinComponent`, no una página) |
| `util` | Auth + info | `login`, `ayuda`, `acerca-d` |

Shared code lives in `src/app/compartidos/`: `servicios/`, `store/`, `seguridades/`, `interceptors/`, `modelos/`, `encabezado/` (header component), and `IonicComponentes.ts`.

## Standalone Component & Page Pattern

Every component is `standalone: true` and imports what it needs directly — **never** add NgModules to pages. Conventions observed throughout:

- Pages declare their own `imports` array, typically including `CommonModule`, `IonicComponentes`, `EncabezadoComponent`, and `ReactiveFormsModule` when forms are used.
- **`inject()`** is used for all DI (both services and stores), not constructor injection.
- Template state is exposed as `signal` / `computed`; store computeds are frequently re-exposed directly on the page.
- Reactive forms use `FormControl` bridged to signals via `toSignal(control.valueChanges, { initialValue })`.
- Data loading happens in the constructor and/or Ionic's `ionViewWillEnter` lifecycle hook.
- The current user id comes from `ServicioAutenticacion.obtenerUsuarioActual()?.id`.
- **`IonicComponentes`** (`src/app/compartidos/IonicComponentes.ts`) is an `@NgModule` barrel that imports and re-exports ~70 Ionic standalone components (from `@ionic/angular/standalone`). Import it once per page instead of listing individual `Ion*` components. It contains no logic — if you use an `Ion*` component not yet re-exported, add it there.

## State: NgRx signalStore Pattern

All 16 stores follow the **same shape**; match it when adding one. None currently use `withHooks`.

- Stores are declared with `signalStore({ providedIn: 'root' }, withState, withComputed, withMethods)`.
- State **always** carries `loading: boolean` and `error: string | null`, plus domain data. `withComputed` exposes `isLoading` and `errorMessage`, and any domain-derived computeds (e.g. filtered lists).
- `withMethods` receives the store plus injected services. Async work is an `rxMethod` (from `@ngrx/signals/rxjs-interop`) following a consistent pipeline: set loading → `switchMap` into the service call → on success `patchState` the data → `catchError` sets the error message → `finalize` clears loading. All mutations go through `patchState`. Plain synchronous helper methods live alongside the rxMethods.
- List mutations are optimistic, done by spreading the current signal value.
- Pages await an rxMethod's completion with the helper `utilServicio.esperarCargaDeStore(() => store.isLoading())`, which polls the loading signal.
- **Known `@ngrx/signals` quirk:** `withComputed` must **not** re-export a state signal under the same name it already has in `withState` — it throws `SignalStore members cannot be overridden`. This previously affected `loginStore`, `perfilStore`, `cuentaStore`, `comentariosStore`, and `bitacoraStore`.

## Dual Persistence (SQLite native / IndexedDB web)

There are two parallel local-DB services with **identical public APIs**; the choice is made by the **caller** by checking whether the Capacitor platform is `web` — not inside the services.

- Native: `DataBaseService` (`src/app/compartidos/servicios/data-base.service.ts`) uses `@capacitor-community/sqlite`. DB name `critKelly`, version 1, no encryption. Opened by `crearBaseDatos()`, which then creates the tables.
- Web: `DataBaseWebService` (`data-base-web.service.ts`) uses raw IndexedDB. DB `CriterioKellyDB`, version 1, opened by `openDB()`.
- The database is initialized centrally in `AppComponent`: on web it opens IndexedDB; on device it waits for the platform to be ready and creates the SQLite database.

Two local tables (mirrored in both backends):
- `dividendoKelly` — the per-account Kelly divisor. The default value auto-inserted when none exists is **10**.
- `pinBloqueo` — the app-lock PIN per user. `pin_codigo` stores a PBKDF2-SHA256 hash (`pbkdf2-sha256$310000$<salt>$<hash>`), never the plain PIN; legacy plaintext values are migrated on the first successful unlock.

Pages don't call these services directly — they go through paired stores and pick web-vs-native the same way: `dbkelly-app.store.ts` / `dbkelly-web.store.ts` and `dbPIN-app.store.ts` / `dbPIN-web.store.ts` (in `src/app/compartidos/store/`). Pages using this split: `cambiar-pin`, `cuentas`, `bloqueo`, `operativa-kelly`, `bitacora-fin`, `login`.

## Kelly Criterion Logic

**The core Kelly math runs on the backend**, not the frontend. `criterio-kelly.service.ts` posts to the `criterioKelly/obtenerPorcentaje` endpoint and returns records with pre-computed fields: the raw Kelly % (`cke_x100Kelly`), the divisor (`cke_numDivisor`), the operational % (`cke_x100Operativo`, i.e. Kelly divided by the divisor), and the amount to trade (`cke_montoOperar`).

The **divisor** (recommended value **10**) is the local per-account setting stored in the `dividendoKelly` table and edited in `configuracion/operativa-kelly`. The backend uses it to turn the raw Kelly % into the operational %.

The only **frontend** Kelly arithmetic is display-level, in `criterioKelly/mostrar-criterio-kelly`: it splits the operational % across N operations and derives the capital to risk per operation from the account's total amount. There is no classic Kelly formula (`f* = (bp - q)/b`) in the frontend.

## Auth, Session & Security

- **`ServicioAutenticacion`** (`src/app/compartidos/seguridades/ServicioAutenticacion.ts`) is a session/state holder, **not** the HTTP login. It exposes observables for the authenticated flag, current user, and roles, and rehydrates from localStorage on construction.
  - Session is stored as **three localStorage keys**: `usuario`, `roles`, and `autenticado`. **There is no JWT/bearer token** anywhere in this layer.
  - Role helpers include specific-role, some-of (OR), all-of (AND), super-admin (role 1), and administrator (roles 1 or 2) checks.
- **Login flow:** the login page calls `LoginStore.autenticarCredenciales` (an rxMethod that authenticates and then loads roles; it caps attempts at 3 and exits the app when exhausted), which in turn calls `LoginServicio` against the auth REST base. On success the page persists the session via `ServicioAutenticacion`, validates the PIN, and navigates.
- **`ServicioInactividad`**: a 5-minute idle timer (mousemove/keydown/touchstart) that navigates to `/bloqueo`. Its `salir()` logs out, clears sessionStorage, disables the Ionic menu, and returns to `/login`.
- **Guards** (`src/app/compartidos/seguridades/`): `GuardAutenticacion` allows only if authenticated, else redirects to `/login`. `GuardRoles` reads required roles and a `requireAll` flag from the route data, applies AND/OR semantics, and redirects to `/acceso-denegado` when access is denied.
- **`errorInterceptor`** (`src/app/compartidos/interceptors/error.interceptor.ts`): a functional interceptor that maps HTTP status codes to Spanish toast messages (via `UtilitariosService`), then rethrows. It prefers a server-provided message when present. Special case: status `422` maps to the "loss limit reached, recharge account" message.

## Backend / Environment Config

`src/environments/environment.ts` (dev) and `environment.prod.ts` (prod, swapped in at build time via `angular.json` file replacements). Both currently point to `http://localhost/...` PHP REST backends. Keys:
- `production` (boolean)
- `apiUrlLoge` — user/auth REST base (used by `LoginServicio`)
- `apiUrlCritKell` — Criterio Kelly REST base
- `apiUrlSuscripcion` — subscription REST base

No secrets/tokens live in these files.

## Conventions & Lint Rules

- **Spanish everywhere** (files, folders, classes, comments, commits).
- ESLint (`@angular-eslint`) enforces: selector prefix `app-`, components `kebab-case`, directives `camelCase`, page suffix `Page`, component suffix `Component`.
- TypeScript: **single quotes** (`.editorconfig`).
- Adding a page: create it under the right feature folder with its `modelos/`/`servicios/`/`store/`, register a lazy `loadComponent` route in `app.routes.ts` (guarding it with `GuardAutenticacion` if private), and import `IonicComponentes` and `EncabezadoComponent` as needed.

## Testing Quirks

- Karma + Jasmine. Specs use the older `TestBed.configureTestingModule({ declarations })` pattern (still works).
- The `AppComponent` spec uses `CUSTOM_ELEMENTS_SCHEMA` to bypass Ionic web-component validation.

## Sesión HLT-07

`SesionStore` es la fuente de verdad de la sesión. El access token vive únicamente en memoria; en web el refresh se entrega por cookie HttpOnly y en nativo se guarda mediante `AlmacenSeguroService` y `@aparajita/capacitor-secure-storage@7.1.0`. `autenticacionInterceptor` limita sus cabeceras a las tres bases de `environment`, renueva una sola vez y coordina pestañas mediante Web Locks/BroadcastChannel. CapacitorHttp no está habilitado.

`ServicioAutenticacion` es una fachada de lectura compatible con el código legado y elimina las claves heredadas de `localStorage`; no persiste usuario, roles, access ni refresh. Los roles llegan con `autenticar` y `LoginStore` conserva únicamente el contador de tres intentos 401.

**Verificación de correo (HLT-08 v2):** la página pública `/verificar-correo` (`VerificarCorreoPage` → `VerificacionCorreoStore` → `VerificacionCorreoService`, en `paginas/util/`) activa la cuenta con `persona/activar` y reenvía el código con `persona/reenviarCodigo` (enfriamiento de 60 s en la UI). Flujo: registro → verificar → login → primer inicio de sesión. El correo solo vive en memoria. AJ-02 (400 con clave actual incorrecta, sin renovar sesión) está cubierto por specs. Sin SMTP real no llega el código (en local `CORREO_MODO=log`).

**Primer inicio de sesión (HLT-19 v2):** el registro guarda `localStorage['plan_reservado']` (`{usuario, pin_idPlanInterv}`) vía `PlanReservadoService`; tras el login del formulario `LoginPage` llama a `SuscripcionStore.asegurarSuscripcionInicial`. Con reserva de **pago** hace primero `POST suscripcion/crearSinPago { sus_pinIdPlanin }` (409 = ya existe) y después `POST suscripcion/iniciarPrueba` (cuerpo `{}`; 200 = prueba concedida, 409 = no disponible); con reserva Libre o ausente solo pide la prueba (ya no se crea el plan Libre). Con 200/409 en todo lo que corresponde se guarda la marca `suscripcion_inicial_verificada` y se borra la reserva; con 0, 401, 429 o 5xx no se marca y el login continúa sin toasts (`OMITIR_MANEJO_ERROR`). Claves de `localStorage` de la app: `plan_reservado`, `suscripcion_inicial_verificada`, `plan_vigente_avisado` y `ck_cierre_pendiente`. Karma se ejecuta con Edge (`CHROME_BIN`, ver README).

**Plan vigente (HLT-19 v2):** `PlanVigenteStore` (`paginas/suscripcion/store/plan-vigente.store.ts`) guarda en memoria la respuesta de `GET suscripcion/planVigente`; el servidor decide y la app no usa el reloj del dispositivo: el tiempo restante sale de `segundosRestantes` menos lo transcurrido en `performance.now()` (token `RELOJ_MONOTONICO`). `vigilar(true)` recalcula cada 30 s, al volver a la app (`visibilitychange`) y pide el plan cuando llega a 0. `AvisoPlanComponent` (presentacional, sin `inject`) pinta el tiempo de la prueba, el aviso de transición, el plan pendiente de pago y el periodo ya pagado; `InicioPage` lo muestra. Los avisos de transición se informan una sola vez con la marca `localStorage['plan_vigente_avisado']` (`PlanAvisadoService`: usuario, estado e id de suscripción; sin tokens ni fechas).

## HLT-08 — Claves y PIN

La política compartida de claves vive en `compartidos/validadores/politica-clave.validator.ts`
(10–128 puntos de código y diferencia respecto al usuario/correo). El PIN local se guarda
como `pbkdf2-sha256$310000$...` usando Web Crypto; los registros heredados en claro se
migran durante el primer desbloqueo correcto y se falla cerrado si no existe `crypto.subtle`.
`DataBaseService` e `DataBaseWebService` implementan el mismo contrato
`AccesoPinBloqueo`, y la selección web/nativa queda en las páginas llamadoras.

## Menú según el plan (HLT-20 v2)

Toda la tabla de permisos vive en un solo archivo: `paginas/suscripcion/configuracion/permisos-plan.config.ts` (`RUTAS_SIEMPRE_HABILITADAS`, `RUTAS_CONTROLADAS`, `estadoMenuDesdePlan`, `estaRutaPermitida`, `textoBloqueo`). Ningún componente ni página decide permisos. `menu.json` no cambia: el menú se ve igual y el bloqueo ocurre al navegar, con `planGuard` (`compartidos/seguridades/plan.guard.ts`) aplicado a las 13 rutas controladas de `app.routes.ts`.

| Estado del plan (`planVigente`) | Menú | Qué ocurre |
|---|---|---|
| `PRUEBA`, `LIBRE`, `PAGO` (con o sin periodo programado) | `COMPLETO` | Todo abre |
| `SIN_PLAN` con `planPendiente` (cualquier motivo, también `NUNCA_TUVO_PLAN`) | `MINIMO_PENDIENTE` | Solo `/inicio` y `/mostrar-criterio-kelly`; lo demás lleva al inicio con «Tu plan … está pendiente de pago…» (o «terminó… tienes N días para pagarlo» si es renovación) |
| `SIN_PLAN` sin `planPendiente` | `SIN_PLAN` | Igual, con «Debes activar un plan» y la lista de planes de pago; elegir uno crea la suscripción pendiente (`crearSinPago`) |

La decisión sale siempre de `PlanVigenteStore.plan()` (servidor), nunca de almacenamiento del dispositivo. **Fail-open (D-03):** si el plan no carga o tarda más de 3 s, el guarda permite. **Límites en el servidor (HU-005):** `rest_criteriokelly` (`ControlPlan`) también rechaza con 403 las llamadas fuera del plan; la app solo los refleja. Un plan de pago vigente puede cancelarse desde el inicio (`POST suscripcion/cancelar`, con confirmación); después se muestra «Tu plan termina el …». Toda ruta privada nueva debe añadirse a una lista de `permisos-plan.config.ts` (la spec R-04 lo verifica).

## Comprobante de pago: elegir método

Antes del formulario de `/comprobante`, `MetodoPagoStore` (en memoria, sin `localStorage`) guía tres pasos: elegir método (cripto USDT, PayPal, transferencia bancaria), ver los datos (copiar dirección/correo; en banco, WhatsApp con mensaje de plan, intervalo y monto y confirmación «Ya envié la solicitud») y «Ahora necesito subir el comprobante». Cambiar de plan reinicia el recorrido. Los datos de pago **no están en el front**: `MetodoPagoStore.cargarDatos()` los lee de `GET suscripcion/datosPago/disponibles` al abrir `/comprobante` (solo en memoria; sin datos o con error, «Este método aún no está disponible, elige otro» y un botón «Reintentar»), y el QR de cada red se pide como blob (`datosPago/qr`, URL de objeto revocada al salir). `textos-pago.ts` arma el mensaje de WhatsApp (con la `plantilla` del servidor si existe, reemplazando `{plan}` y `{monto}`). El método es informativo: sin campos nuevos en el backend. La página usa `AccionesExternasService` (copiar y abrir enlace externo).

## Límites por plan en las pantallas (HLT-27 v2)

Los límites viven en `planVigente.limites` y se leen con el computed `PlanVigenteStore.limites`; las funciones puras (textos de aviso, tope de cuentas, rango de fechas del análisis, filas de comparación de `/planes`) están en `permisos-plan.config.ts`. `/operativas`, `/analisis`, `/cuentas`, `/operativa-kelly`, `/mostrar-criterio-kelly` y `/planes` solo consumen esos computed; los componentes presentacionales no deciden permisos. `AlertaLimitePlanComponent` (`compartidos/alerta-limite-plan`, HLT-36) recibe `mensaje` y lleva a `/planes`; `FiltroFechasComponent` (`paginas/reportes/componentes/filtro-fechas/`) es el selector Desde/Hasta del análisis. El servidor ya recorta datos y rechaza excesos (HLT-24): la app solo muestra y avisa.

## Datos de pago administrables (HLT-30)

Pantalla `/datos-pago` (`paginas/administracion/datos-pago/`, menú «Datos de pago», `GuardAutenticacion` + `GuardRoles` [1, 2], incluida en `RUTAS_POR_ROL` de `permisos-plan.config.ts`): `DatosPagoAdminPage` orquesta `DatosPagoAdminStore` y los componentes `lista-redes`, `formulario-red`, `subida-qr`, `formulario-paypal` y `formulario-banco`. Administra redes USDT (alta, edición, orden, activa, eliminar), el QR de cada red, PayPal, el WhatsApp con su plantilla y los datos de la cuenta del propietario (que el usuario aún no ve). Cada cambio de dónde se paga pide confirmación mostrando el valor; `validadores-pago.ts` repite los patrones del servidor y el archivo del QR se valida (png/jpeg/webp, 256 KB, constante `LIMITE_QR`) antes de leerlo, para que `ManejoImagenesService` nunca comprima un QR. Un 403 hace que la página vuelva a `/inicio`. El servidor guarda los textos con `htmlspecialchars`: la app los desescapa (`desescaparEntidades`) para mostrarlos y no escaparlos dos veces al editar.

## Alertas y modales (HU-006, HLT-31)

Todo aviso o confirmación corto usa el componente presentacional `app-alerta-ck` (`compartidos/alerta-ck/`), que envuelve **un único `<ion-alert>` declarativo** (`[isOpen]`, `cssClass="alerta-ck"`, sin `keepContentsMounted`). Sin `inject`: la página orquestadora guarda una señal con `{ abierta, ...textos }`, decide cuándo abrir y traduce `(confirmada)` / `(cancelada)` a llamadas del store. Los textos salen de `compartidos/textos-alertas.ts` (`TextoAlerta`; título de hasta 5 palabras; el mensaje dice qué pasó y qué hacer). El estilo vive solo en `ion-alert.alerta-ck` de `src/global.scss`.

| Tipo de mensaje | Componente |
|---|---|
| Aviso informativo corto | `app-alerta-ck` con `tipo="informativa"` (botón «Entendido») |
| Confirmación | `app-alerta-ck` con `tipo="confirmacion"` («No» / «Sí») |
| Acción destructiva | `tipo="destructiva"` («Sí, <acción>»), no se cierra tocando fuera |
| 1 a 3 campos | `app-alerta-ck` con `[campos]`; `[valido]=false` impide cerrar al confirmar; `confirmada` emite los valores |
| Contenido largo o interactivo (planes, formularios, detalle, selectores, imagen) | `<ion-modal>` |
| Resultado rápido de una acción | toast (`UtilitariosService.mostrarToast`) |

**Prohibido `AlertController.create` en `src/app` fuera de specs** (crea y destruye el elemento en cada llamada y obliga a `await`). Los textos nuevos se añaden a `textos-alertas.ts`, no en la página.

**Modales que se quedan (HLT-35).** Son de contenido largo o interactivo: `aviso-bloqueo` (lista de planes), `detalle-pago` (imagen ampliada), `datos-pago-admin` (red y QR), `validar-pagos` (detalle), `bitacora` (selector de divisa y editar precios) y `filtro-fechas` (2 selectores). El PIN también es un modal (formulario de 2 campos de 6 dígitos con «Omitir»): `login.page` y `cambiar-pin.page` lo declaran con `<ion-modal [isOpen]="estaModalPinAbierto()" (willDismiss)>` y `<ng-template><app-modal-pin [guardando] (pinConfirmado) (pinDistinto) (omitido) /></ng-template>`; el anfitrión cierra con `modal.dismiss(datos)` (HLT-39); el resultado `{ omitido, pinCreado }` llega en `evento.detail.data` y el login navega a `/inicio` solo con `omitido` o `pinCreado`. `ModalPinComponent` es presentacional (sin `inject`) y el guardado vive en `PinFormularioStore`; la ruta `/modal-pin` solo redirige a `/inicio`. Ya no hay `modalCtrl.create` en `src/app`. Un aviso corto nunca va en `ion-modal`.

## Piezas reutilizables fuera de las páginas (HU-007, HLT-36…HLT-40)

Una *página* tiene ruta; una *pieza* se usa dentro de otra pantalla y es un componente presentacional. Las rutas `/modal-pin`, `/busca-divisa` y `/grafico-stadistico` solo redirigen a `/inicio`.

| Pieza | Tipo | Carpeta | Anfitriones | Estado/lógica |
|-------|------|---------|-------------|---------------|
| `AlertaLimitePlanComponent` | componente | `compartidos/alerta-limite-plan` | `cuentas`, `operativa-kelly`, `analisis`, `operativas` | texto en `permisos-plan.config.ts` |
| `SeleccionarCuentasComponent` | componente | `compartidos/seleccionar-cuentas` | `analisis`, `operativas` | cuentas vienen de la página |
| `ModalBuscaDivisaComponent` | contenido de `ion-modal` | `paginas/planTrading/componentes/modal-busca-divisa` | `bitacora` | señales locales de búsqueda |
| `GraficoEstadisticoComponent` | componente | `paginas/reportes/componentes/grafico-estadistico` | `operativas` | datos por `input()` |
| `ModalPinComponent` | contenido de `ion-modal` | `paginas/configuracion/componentes/modal-pin` | `login`, `cambiar-pin` | `PinFormularioStore` (`paginas/configuracion/store`) |

**Estándar.** Las piezas usan solo `input()`/`input.required()` y `output()`, sin `inject`, `@Input`, `@Output`, `ModalController` ni `*ngIf`/`*ngFor`, con `OnPush`. La página anfitriona inyecta stores y servicios, y traduce los `output()` en llamadas al store.

**Regla.** Lo que se usa como modal es contenido de un `<ion-modal>` declarado en la plantilla del anfitrión; el anfitrión cierra con `modal.dismiss(datos)` y lee `evento.detail.data` en `willDismiss`.
