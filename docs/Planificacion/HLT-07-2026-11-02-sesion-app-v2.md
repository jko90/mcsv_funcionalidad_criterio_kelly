# HLT-07 — Sesión en la app (criterioKellyApp) · v2

| Campo | Valor |
|-------|-------|
| Versión | **v2** (reemplaza a [HLT-07-2026-11-02-sesion-app.md](HLT-07-2026-11-02-sesion-app.md), que no se ejecuta) |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Plan maestro | [PLAN-MAESTRO-HU-001](PLAN-MAESTRO-HU-001.md) (contratos cerrados §4 y §5) |
| Fecha | 2026-11-02 |
| Proyecto | `criterioKellyApp` (git propio) |
| Agente de implementación | `desarrollador-ionic` (todas las tareas) |
| Depende de | HLT-03, HLT-04 y HLT-05 **ejecutados** (estado `COMPLETADO` en sus reportes) |
| Habilita | HLT-08, HLT-09, HLT-10 |
| Veredicto senior (H6) | **APROBADO** (v2, tercera iteración) |
| Contrato del documento | `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11) + `docs/planificador.md` |

Estado de los HLT precedentes al redactar la v2: existen [HLT-03](HLT-03-2026-11-02-nucleo-sesion.md) (contrato de `/autenticacion`) y [HLT-04](HLT-04-2026-11-02-autorizacion-criteriokelly.md) (contrato resultante para la app en su H5.1); **HLT-05 todavía no existe**. Para `rest_suscripcion` este HLT se apoya en el plan maestro (§4.5) y en DH-04. La tarea T-01 verifica, antes de tocar código, que los contratos entregados coinciden con los supuestos de este HLT (D-24); si alguno difiere, la ejecución se detiene (RS-4).

## Cambios respecto a v1

| # | Cambio | Origen | Secciones afectadas |
|---|--------|--------|---------------------|
| V2-01 | `cerrarSesion` exige un access válido (HLT-03 Flujo C, D-26): ya **no** se limpia el estado antes de enviar con un token explícito. Ahora la petición sale por el flujo normal del interceptor (renueva y reintenta si el access venció); mientras dura, el nuevo estado `cerrandoSesion` hace que `estaAutenticado()` sea `false` (la UI ya se comporta como sesión cerrada); en `finalize` se limpia todo aunque la renovación o la petición fallen | HLT-03 D-26, Flujo C; restricción 3 del coordinador | RN-10, H3 Flujo D, D-09, D-10, D-14 (modificadas), D-39 (nueva), T-11, T-12, T-13, T-16, T-17 |
| V2-02 | Renovación serializada **entre pestañas** en web con Web Locks API (`navigator.locks.request('ck-renovar-sesion', { mode: 'exclusive' }, …)`), alternativa sin bloqueo entre pestañas si la API no existe, y difusión por `BroadcastChannel('ck-sesion')` de la sesión renovada y del cierre para que las otras pestañas no vuelvan a rotar el refresh | HLT-03 R-05 (dos pestañas con la misma cookie revocan la familia, A-04 estricto); restricción 2 | RN-19 (nueva), H3 Flujos B, C y G (nuevo), D-38 (nueva), T-37 y T-38 (nuevas), T-12, T-13, T-21, T-36 |
| V2-03 | Prohibido activar `CapacitorHttp`: las peticiones nativas deben salir del WebView con `Origin` | HLT-03 R-11, RN-19; restricción 4 | RN-20 (nueva), RS-SES-11 (nueva), T-32 |
| V2-04 | Canal fijo web/nativo: en nativo **nunca** `withCredentials` (ni cookie), `renovar` siempre con `{ refreshToken }` y sin llamada si no hay refresh; en web `renovar` siempre `{}` y jamás un `refreshToken` en el cuerpo | HLT-03 RN-21, D-12; restricción 5 | RN-03, RN-21 (nueva), D-08 (modificada), T-13, T-16, T-17 |
| V2-05 | Cuerpo `{}` en `renovar` (web), `cerrarSesion` y `cerrarTodas` confirmado contra HLT-03 D-25; `cerrarTodas` sin credenciales (HLT-03 D-27) | HLT-03 D-25, D-27; restricción 1 | D-22 |
| V2-06 | `accessExpira` llega en ISO 8601 UTC (`+00:00`): se guarda como cadena sin convertir y, si se compara, solo con `Date.parse` | HLT-03 Flujo A paso 11; restricción 6 | T-09, D-29 |
| V2-07 | Contrato de `rest_criteriokelly` confirmado con HLT-04 H5.1 (sin ids, `{}` en `criterioKelly/*`, `{ bit_cueIdCuentas }`, recurso ajeno o inexistente → 403). HLT-05 sigue pendiente: T-01 lo verifica | HLT-04 H5.1, D-01, D-02, D-10 | D-24, T-01 |
| V2-08 | Cierre remoto: si otra pestaña cierra la sesión, esta pestaña limpia su estado y vuelve a `/login` | Consecuencia de V2-02 (sin sesión fantasma entre pestañas) | RN-16, D-38, T-12, T-21 |
| V2-09 | Coordinación con HLT-08: HLT-08 D-14 también cambia `bloqueo.page.ts:113` a `ServicioInactividad.salir()`; HLT-07 lo hace primero (D-13) y para HLT-08 queda verificado | HLT-08 D-14 | H6 (observaciones) |
| V2-10 | Registro → `crearSinPago`: se **retira** el login automático de v1 (D-25 v1, Flujo F, T-31 v1). El flujo de registro queda sin cambios y se registra como dependencia abierta **DE-01**, que no bloquea el resto del HLT. `crearSuscripcion` y su modelo tampoco cambian | Coordinador (hallazgo O-08-2 de HLT-08: lo decide HLT-05/plan maestro) | RN-11 (excepción), H3 Flujo F, D-25 (reemplazada por DE-01), T-30, T-31 (redefinida como verificación), T-36 paso 11 |
| V2-11 | Se explicita que el interceptor solo renueva ante 401 de endpoints protegidos que salieron con `Authorization`, nunca ante 401 de `autenticar` ni `renovar`; un 400 (por ejemplo, clave actual incorrecta en `actualizarClave`, HLT-08 C-1) nunca renueva | Coordinador (hallazgo C-1 de HLT-08) | D-10, T-17 |

---

## H1. Propósito

### Requerimiento literal

> **HLT-07 · Sesión en la app (criterioKellyApp)**
>
> - SesionStore (signalStore con loading/error, rxMethod estándar): login (guardar accessToken solo en memoria; refresh nativo en AlmacenSeguroService; en web lo maneja la cookie HttpOnly), renovación (una sola en curso, cola de peticiones concurrentes, reintento), restaurar sesión al abrir la app (renovar antes de entrar a rutas privadas: GuardAutenticacion espera ese resultado), cerrarSesion y cerrarTodas (limpia aunque falle la llamada).
> - autenticacionInterceptor: Authorization solo a URLs de environment.apiUrl*; X-Requested-With a las APIs; X-Cliente: nativo si Capacitor.isNativePlatform(); withCredentials: true solo hacia autenticacion/renovar, autenticacion/cerrarSesion y autenticacion/autenticar (para recibir la cookie); en 401 → una renovación + reintento; si falla → limpiar, /login, toast "Tu sesión expiró, vuelve a iniciar sesión"; sin bucles en /login y registro. Registrado en main.ts antes de errorInterceptor.
> - errorInterceptor: 429 con tiempo desde Retry-After; 403 "Acceso denegado"; no duplicar el toast del 401 manejado por renovación.
> - ServicioAutenticacion como fachada (mismos métodos públicos de roles) sin localStorage; eliminar las claves usuario/roles/autenticado del localStorage (incluida limpieza de valores heredados al arrancar). Revisa también `planSeleccionado` en PlanesStore (no es sesión; decide y justifica).
> - LoginStore / login.page: adaptar al nuevo flujo (roles vienen en la respuesta de autenticar; respetar los 3 intentos y el PIN). Revisa app.component.ts (menú, estado de sesión, inactividad, cierre de sesión).
> - Todos los servicios dejan de enviar ids de usuario (inventaría cada uno con ruta:línea: cuentas, comentarios, planes, suscripcion, login, perfil, bitacora, reportes, criterio-kelly…) y los stores/páginas que los pasaban.
> - environment.ts / environment.staging.ts / environment.prod.ts con las claves de §4.6 (prod y staging con https y dominio: como DH-07 está pendiente, define cómo se representa sin marcador pendiente — p. ej. el HLT deja prod/staging apuntando a valores que HLT-11 reemplaza, documentado como decisión; NO uses TODO/TBD) + configuración `staging` en angular.json (fileReplacements).
> - Instalación del plugin de almacenamiento seguro (verifica en el HLT, sin instalar, qué paquete y versión es compatible con Capacitor 7.4 — revisa package.json — y deja la decisión cerrada con alternativa) con npm install --legacy-peer-deps; npm audit --omit=dev.
> - Actualizar criterioKellyApp/CLAUDE.md, .claude/agents/desarrollador-ionic.md (excepción del plan maestro §5.6) y README de la app.
> - Pruebas: ng lint, ng test (specs nuevas para SesionStore e interceptor: cola de renovación, reintento, no-bucle, cabeceras solo a apiUrl*), ng build, y flujo manual en local con ionic serve --port=8100 contra los backends locales: login → uso → access vencido (forzar con TOKEN_ACCESO_MINUTOS=5 o revocando en BD) → renovación transparente → recargar la página (sesión restaurada vía cookie) → cerrar sesión → localStorage sin datos de sesión.

Requerimiento complementario literal (restricciones de HLT-03 enviadas por el coordinador para la v2):

> 1. `renovar`, `cerrarSesion` y `cerrarTodas` se llaman con cuerpo `{}` (JSON, Content-Type application/json) en web; en nativo `renovar` lleva `{ refreshToken }`.
> 2. Serializar `renovar` también ENTRE PESTAÑAS en web (p. ej. BroadcastChannel o Web Locks API `navigator.locks`): si dos pestañas renuevan con el mismo refresh, la segunda se detecta como reutilización y se revoca toda la familia.
> 3. `cerrarSesion` exige access válido: si el access venció, el interceptor debe renovar y reintentar; si la renovación falla, limpiar igual en local.
> 4. NO activar CapacitorHttp (plugin HTTP nativo): las peticiones nativas deben seguir saliendo del WebView con cabecera Origin (capacitor://localhost / https://localhost), porque el backend entrega el refresh en el cuerpo solo si Origin ∈ CORS_ORIGENES_NATIVOS y X-Cliente: nativo.
> 5. Canal fijo: un refresh emitido para web no se renueva desde nativo ni al revés.
> 6. Las fechas (accessExpira) vienen en ISO 8601 UTC.

### Propósito

Que el trader, en la web, la PWA y las apps nativas, use la app con una sesión real emitida por el servidor, que no se puede falsificar desde el navegador ni filtrar a terceros, que se renueva sin que lo note y que termina de verdad cuando cierra sesión. Que la app deje de decidir de qué usuario son los datos que pide.

### Resultado esperado

- La app inicia sesión contra `autenticacion/autenticar`, guarda el access token **solo en memoria** y el refresh **solo** en la cookie HttpOnly (web) o en Keychain/Keystore (nativo).
- Toda petición a los tres backends lleva `Authorization: Bearer` (salvo `autenticar` y `renovar`), `X-Requested-With: CriterioKelly` y, en nativo, `X-Cliente: nativo`. Ninguna URL ajena a `environment.apiUrl*` recibe esas cabeceras.
- Un access vencido se renueva de forma transparente (una sola renovación para todas las peticiones concurrentes) y la petición se reintenta una vez. Si la renovación falla, la app limpia la sesión, vuelve a `/login` y muestra un único toast.
- Al recargar la página o reabrir la app, la sesión se restaura con `renovar` antes de entrar a cualquier ruta privada.
- `localStorage` no contiene `usuario`, `roles`, `autenticado` ni `planSeleccionado`.
- Ningún servicio envía el id del usuario.
- Existen `environment.ts`, `environment.staging.ts` y `environment.prod.ts`, y la configuración `staging` en `angular.json`.
- `npm audit --omit=dev` no reporta vulnerabilidades altas ni críticas.

### Fuera de alcance

- Pantallas de recuperación de clave, cambio de clave con clave actual, política de claves y PIN con PBKDF2 (G-07, G-09, B-02 en la app): **HLT-08**. El formulario actual de cambio de clave (`perfil.service.ts:28-33`, `Perfil.modelo.ts:16-20`) **no se toca** en este HLT.
- Service worker, manifest, CSP (`autoCsp`), source maps y `console.log` de la build de producción (H-01, H-02, H-03, H-06, H-08 y la parte de G-10 sobre source maps y logs): **HLT-09**.
- Proyectos `android/` e `ios/`, `appId`, `capacitor.config.ts`, privacy screen, firma y pruebas en dispositivo del almacenamiento seguro: **HLT-10** (bloqueado por DH-13).
- Dominios reales de staging y producción (DH-07) y despliegue: **HLT-11**.
- Cambios en cualquier carpeta `rest_*`, en los `.env` de los backends o en la base de datos.
- Bugs conocidos fuera de las líneas que este HLT modifica: `suscripcion/suscripcionPorID/{id}` no existe en el backend (`suscripcion.service.ts:12-18`), el `echo` de `crearConPago` (`rest_suscripcion/rutas/SuscripcionRts.php:117`), `crearSuscripcionConPago(any)` sin llamadores, el `app.component.spec.ts` que declara un componente standalone en `declarations`, y el mensaje `'Timeout esperando carga de PIN'` de `utilitarios.service.ts:68`.
- Modificar `criterioKellyApp/docs/doc_modo_planificacion.md` (ver la observación OBS-02 en H6).
- El flujo de registro y la llamada a `suscripcion/crearSinPago` (`registro.page.ts`, `SuscripcionStore.crearSuscripcion`, `suscripcion.service.ts:28-35`): dependencia abierta DE-01 (v2).
- Activar o configurar `CapacitorHttp` (prohibido, RN-20).

### Feature(s) afectada(s)

- `src/app/compartidos/` (`store/`, `servicios/`, `interceptors/`, `seguridades/`, `modelos/`)
- `src/app/paginas/util/` (login, `LoginStore`, `LoginServicio`)
- `src/app/paginas/configuracion/` (cuentas, operativa-kelly, perfil, bloqueo)
- `src/app/paginas/criterioKelly/`, `src/app/paginas/planTrading/`, `src/app/paginas/reportes/`, `src/app/paginas/suscripcion/`
- `src/environments/`, `src/main.ts`, `src/app/app.component.ts`, `angular.json`, `package.json`, `package-lock.json`
- Documentación: `criterioKellyApp/CLAUDE.md`, `criterioKellyApp/README.md`, `criterioKellyApp/docs/doc_arquitectura.md`, `.claude/agents/desarrollador-ionic.md`

---

## H2. Reglas de negocio

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-01 | El access token vive solo en memoria, en `SesionStore`. | `grep -rnE "localStorage\|sessionStorage\|indexedDB" src/app` no muestra ninguna escritura del access token ni del refresh; el spec de `SesionStore` verifica que tras `iniciarSesion` y `renovarSesion` no se llamó `Storage.prototype.setItem`. | G-01, DH-03 |
| RN-02 | `localStorage` no guarda `usuario`, `roles`, `autenticado` ni `planSeleccionado`; los valores heredados se eliminan al arrancar. | `grep -rn "localStorage" src/app` solo muestra `removeItem` de esas 4 claves en `ServicioAutenticacion` y las 3 llamadas a la marca `ck_cierre_pendiente` de `AlmacenSeguroService` (D-15). Tras el flujo manual, `Object.keys(localStorage)` en la consola no contiene esas 4 claves. | G-02, D-18, D-19 |
| RN-03 | En web el refresh viaja solo en la cookie HttpOnly. JavaScript nunca lo lee ni lo guarda, aunque el servidor lo enviara en el cuerpo. `withCredentials: true` se usa solo en web y solo hacia `autenticacion/autenticar`, `autenticacion/renovar` y `autenticacion/cerrarSesion`. | Spec del interceptor: con plataforma web, `withCredentials` es `true` exactamente para esas 3 URLs y `false` para cualquier otra; con plataforma nativa es `false` en todas. Spec del store: con plataforma web, un `refreshToken` en la respuesta no llega a `AlmacenSeguroService.guardarRefresh`. | H-04, DH-03, A-01 |
| RN-04 | En nativo el refresh se guarda solo con el plugin de almacenamiento seguro. En web el plugin nunca se invoca. | Spec de `AlmacenSeguroService`: con `ES_PLATAFORMA_NATIVA = false`, `guardarRefresh`/`leerRefresh`/`eliminarRefresh` no llaman a `SecureStorage`. | I-02, DH-03, §4.6 |
| RN-05 | `Authorization: Bearer` solo se agrega a URLs que empiezan por `environment.apiUrlLoge`, `apiUrlCritKell` o `apiUrlSuscripcion`, y nunca a `autenticar` ni a `renovar`. `X-Requested-With: CriterioKelly` va a toda URL de esas bases. `X-Cliente: nativo` solo si `Capacitor.isNativePlatform()`. | Spec del interceptor: una URL `https://tercero.example/x` sale sin `Authorization`, sin `X-Requested-With` y sin `X-Cliente`; `autenticar` y `renovar` salen sin `Authorization`; con plataforma web no hay `X-Cliente`. | G-03, §4.5 |
| RN-06 | A lo sumo una renovación en curso. Las peticiones concurrentes que reciben 401, o que salen mientras hay una renovación en curso, esperan esa misma renovación. Cada petición se reintenta como máximo una vez. | Spec: 3 peticiones concurrentes con 401 producen exactamente 1 `POST autenticacion/renovar` y 3 reintentos; un 401 en el reintento no produce una segunda renovación. | G-03 |
| RN-07 | Si la renovación falla: se limpia la sesión, se navega a `/login` (salvo que la ruta actual ya sea `/login` o `/registro`) y se muestra **un único** toast `Tu sesión expiró, vuelve a iniciar sesión`. La petición original termina sin error visible adicional. | Spec: con 3 peticiones concurrentes y renovación fallida, `UtilitariosService.mostrarToast` se llama 1 vez y `Router.navigateByUrl('/login', …)` 1 vez; con `router.url === '/login'` no hay navegación. | G-03 |
| RN-08 | `GuardAutenticacion` (y `GuardRoles`) esperan el resultado del intento inicial de restauración antes de decidir. | Spec del guard: mientras `estadoRestauracion` es `en_curso` el observable no emite; al pasar a `finalizada` emite `true` (autenticado) o un `UrlTree` a `/login`. | G-04 |
| RN-09 | 429 muestra el tiempo de espera de `Retry-After`; 403 muestra `Acceso denegado`; un 401 de una petición con `Authorization` no muestra toast en `errorInterceptor` (lo maneja la renovación). | Spec de `errorInterceptor`: `Retry-After: 120` → `Demasiados intentos. Intente nuevamente en 2 minutos.`; 403 → `Acceso denegado`; 401 con `Authorization` → 0 toasts y el error se relanza como `HttpErrorResponse`. | G-05 |
| RN-10 | "Cerrar sesión" llama a `cerrarSesion` con un access válido (si venció, renueva y reintenta una vez) y limpia el estado y el almacenamiento seguro aunque la llamada o la renovación fallen. Desde que empieza el cierre, la app se comporta como sin sesión. El perfil ofrece "Cerrar sesión en todos los dispositivos" (`cerrarTodas`), que también limpia aunque falle. | Spec del store: con `cerrarSesion` respondiendo 500, al terminar `estaAutenticado()` es `false` y se llamó `eliminarRefresh` (nativo); durante la petición `estaAutenticado()` ya es `false`. Spec del interceptor: `cerrarSesion` con 401 → 1 `renovar` → reintento con el token nuevo; si `renovar` falla → 0 toasts, 0 navegaciones y la sesión queda limpia. Observación: el botón existe en `/perfil`. | G-06, A-05, HLT-03 D-26 |
| RN-11 | Ningún servicio HTTP envía el id del usuario (en query, ruta o cuerpo). | `grep -rnE "usuarioId\|_usuarioId\|idUsuario\|usRol\?id" src/app/paginas/*/servicios src/app/compartidos/servicios` devuelve 0 líneas; `grep -rnE "cue_usuarioId\|cap_usuarioId\|bit_usuarioId\|sus_usuarioId\|cke_usuarioId" src/app` solo aparece en interfaces de **respuesta** (`CuentaResponse`, `CuentasModelo`, `BitacoraModelo`, `CriterioKellyModelo`, `PlanesModelo`, `SuscripcionModelo`). Excepciones declaradas: `CambiarClaveRequest.id`, que reemplaza HLT-08 (D-30), y `sus_usuarioId` en `suscripcion/crearSinPago` desde el registro (sin sesión), pendiente del contrato de HLT-05 (DE-01). | G-08, DH-04, C-01 |
| RN-12 | Un archivo de entorno por ambiente con las claves `production`, `entorno`, `apiUrlLoge`, `apiUrlCritKell`, `apiUrlSuscripcion`; staging y producción usan `https://`. No hay URLs escritas a mano fuera de los entornos. | `ng build --configuration staging` y `--configuration production` terminan con código 0; `grep -rnE "localhost\|/criterio_kelly/" src --include=*.ts \| grep -v src/environments` devuelve 0 líneas; `grep -c "http://" src/environments/environment.staging.ts src/environments/environment.prod.ts` da 0 en ambos. | G-10, J-01, §4.6, RD-5 |
| RN-13 | Arquitectura: la lógica de sesión vive en `SesionStore`; `SesionService` y `AlmacenSeguroService` solo acceden a datos; las páginas son las únicas capas de UI que inyectan. | Revisión C3 de cada ficha contra H8 y H11; `grep -rn "inject(" src/app/compartidos/servicios/sesion.service.ts` solo muestra `HttpClient`. | G-11 |
| RN-14 | Reglas existentes que no se rompen: máximo **3** intentos fallidos de login y cierre de la app (`loginStore.ts:31`, `login.page.ts:119-127`); modal de creación de PIN tras el login (`login.page.ts:145-170`); bloqueo por inactividad de **5 minutos** hacia `/bloqueo` (`ServicioInactividad.ts:11`, `:46-50`); **422** reservado para "límite de pérdida" (`error.interceptor.ts:38-40`); el cálculo Kelly es del backend y el divisor local por defecto es **10** (sin cambios). | Specs de `LoginStore` (3 intentos, solo los 401 cuentan); `grep -n "5 \* 60 \* 1000" src/app/compartidos/seguridades/ServicioInactividad.ts` da 1 línea; `grep -n "case 422" src/app/compartidos/interceptors/error.interceptor.ts` da 1 línea con el mismo texto. | `doc_modo_planificacion.md` §4.2, G-09 |
| RN-15 | Dependencias de producción sin vulnerabilidades altas ni críticas. | `npm audit --omit=dev` termina sin `high` ni `critical`. | F-06 |
| RN-16 | Una sesión cerrada no se vuelve a restaurar sola (sin sesión fantasma), aunque `cerrarSesion` haya fallado en web, ni sigue viva en otra pestaña del mismo navegador. | Spec del store: si `cerrarSesion` falla en web se marca el cierre pendiente; en la siguiente `restaurarSesion` se completa el cierre (`renovar` + `cerrarSesion`) y el resultado es "no autenticado". Spec: al recibir `{ tipo: 'sesion-cerrada' }` por el canal, el store limpia la sesión y `cierreRemoto()` es `true`. | G-06, H6, D-38 |
| RN-17 | Una sesión restaurada al abrir la app en `/login` exige el PIN: la app navega a `/bloqueo`. Agotar los intentos de PIN cierra la sesión. | Observación manual (T-36, paso 6); `grep -n "salir()" src/app/paginas/configuracion/bloqueo/bloqueo.page.ts` muestra la llamada en la rama de demasiados intentos. | G-09 (se mantiene), D-12, D-13 |
| RN-18 | La documentación de la app y del agente refleja la nueva sesión. | `grep -n "localStorage" criterioKellyApp/CLAUDE.md` no describe la sesión en `localStorage`; `grep -n "SesionStore" criterioKellyApp/CLAUDE.md .claude/agents/desarrollador-ionic.md criterioKellyApp/README.md` da al menos 1 línea en cada archivo. | Plan maestro §5.5, §5.6, J-08 |
| RN-19 | En web, a lo sumo **una** renovación en curso entre **todas** las pestañas del mismo navegador. Una pestaña que espera el bloqueo y recibe mientras tanto una sesión renovada por otra pestaña la adopta y **no** llama a `renovar`. Si el navegador no tiene `navigator.locks`, la serialización queda solo dentro de la pestaña (RN-06). En nativo no se usa bloqueo. | Spec de `CoordinadorPestanasService`: dos `ejecutarExclusivo('ck-renovar-sesion', …)` se ejecutan en serie con un `navigator.locks` simulado; sin `navigator.locks`, ejecuta la función directamente. Spec del store: si llega `{ tipo: 'sesion-renovada' }` mientras espera el bloqueo, termina con el token recibido y hay 0 `POST renovar`. T-36 paso 13 (dos pestañas). | HLT-03 R-05, A-04 |
| RN-20 | Las peticiones nativas salen del WebView con `Origin`: `CapacitorHttp` no se activa ni se importa. | `grep -rn "CapacitorHttp" src capacitor.config.ts capacitor.config.json` → 0 líneas. | HLT-03 R-11, RN-19 |
| RN-21 | Canal fijo: en nativo el refresh solo viaja en el cuerpo (`{ refreshToken }`) y nunca hay `withCredentials`; sin refresh guardado no se llama a `renovar`. En web `renovar` lleva exactamente `{}` y la cookie. | Spec del store: nativo sin refresh → 0 peticiones; nativo con refresh → cuerpo `{ refreshToken }`; web → cuerpo `{}`. Spec del interceptor: nativo → `withCredentials === false` en las 3 URL de sesión. | HLT-03 RN-21, D-12, D-25 |

Reglas del dominio Kelly: este HLT no toca el cálculo Kelly (`criterioKelly/obtenerPorcentaje` sigue en el backend) ni el divisor local (tabla `dividendoKelly`, valor por defecto 10). Solo cambia **qué** se envía en el cuerpo (sin `cke_usuarioId`).

---

## H3. Flujo principal de ejecución

Convención: `SS` = `SesionStore`, `SSv` = `SesionService`, `AS` = `AlmacenSeguroService`, `AI` = `autenticacionInterceptor`, `EI` = `errorInterceptor`, `CP` = `CoordinadorPestanasService` (D-38, solo actúa en web). Orden de interceptores: `AI` (exterior) → `EI` (interior) → backend. Las respuestas recorren el orden inverso: `EI` las ve primero.

### Flujo A · Inicio de sesión (condición: usuario en `/login` sin sesión)

```
[Clic "Ingresar"] → LoginPage.iniciarValidacion()
  → SS.iniciarSesion({usuario, clave})            (rxMethod: loading=true, error=null, estadoUltimoError=null)
  → SSv.autenticar() → AI: X-Requested-With (+X-Cliente en nativo), withCredentials=true, sin Authorization
  → POST rest_usuario autenticacion/autenticar
  → patchState(usuario{id,nombres,apellidos}, roles, accessToken, accessExpira)
      ├─ nativo y hay refreshToken → AS.guardarRefresh(refreshToken)
      └─ web → la cookie HttpOnly la guarda el navegador; AS.limpiarCierrePendiente()
  → finalize(loading=false)
  → LoginPage: await utilServicio.esperarCargaDeStore(() => SS.isLoading())
  → LoginStore.registrarResultado(SS.estadoUltimoError())
  → éxito: LoginStore.reiniciarIntentos() → validarPIN() (modal de PIN si no existe) → /inicio
   ├─ Éxito: AppComponent muestra el menú (SS.estaAutenticado() = true) y MenuStore.cargarMenu()
   ├─ Error 401 "Usuario o clave incorrectos": toast de EI con el mensaje del servidor; LoginStore suma 1 intento;
   │     con 3 intentos → toast "Máximo número de intentos alcanzado…" y App.exitApp()
   ├─ Error 429: toast de EI "Demasiados intentos. Intente nuevamente en N segundos|minutos."; no suma intento
   └─ Error 0 / 5xx: toast de EI; no suma intento
```

### Flujo B · Restauración al abrir o recargar (condición: arranque de la app)

```
[bootstrapApplication] → provideAppInitializer → SS.restaurarSesion()   (idempotente: solo si estadoRestauracion = 'pendiente')
  → patchState(estadoRestauracion='en_curso', loading=true)
  → [web y AS.hayCierrePendiente()] → SS.renovarSesion() → SSv.cerrarSesion(token) → AS.limpiarCierrePendiente()
        → sin sesión (RN-16)
  → [nativo] AS.leerRefresh() → null → sin sesión (no hay petición)
  → SS.renovarSesion() → [web] CP.ejecutarExclusivo('ck-renovar-sesion') (espera a otras pestañas; si mientras espera
        llega 'sesion-renovada' por el canal, adopta esa sesión y no llama a renovar)
     → SSv.renovar(web: {} + cookie | nativo: {refreshToken}, sin cookie), contexto OMITIR_MANEJO_ERROR
  → patchState(sesión) (+ AS.guardarRefresh(nuevo refresh) en nativo; + CP.publicar('sesion-renovada') en web)
  → finalize(estadoRestauracion='finalizada', loading=false)
[Router: navegación inicial] → GuardAutenticacion espera estadoRestauracion='finalizada'
   ├─ Éxito y ruta privada → entra a la ruta
   ├─ Éxito y ruta /login → LoginPage.ionViewWillEnter navega a /bloqueo (pide PIN, RN-17)
   ├─ Error 401/403 de renovar → sin toast; nativo: AS.eliminarRefresh(); guard → UrlTree /login
   └─ Error 0/429/5xx de renovar → sin toast; el refresh nativo se conserva; guard → UrlTree /login
```

### Flujo C · Petición protegida con access vencido (condición: sesión activa)

```
[Página → Store.rxMethod → Servicio HTTP] → AI
  → ¿URL de apiUrl*? no → la petición sale sin cambios
  → si hay una renovación en curso → espera su resultado y envía con el token nuevo
  → envía con Authorization: Bearer <tokenEnviado> → backend responde 401
  → EI: 401 con Authorization → relanza el HttpErrorResponse sin toast
  → AI: ¿es reintento? no
        ├─ SS.accessToken() ≠ tokenEnviado y no es null → reintenta con SS.accessToken() (sin renovar)
        └─ SS.renovarSesion() (una sola en curso en la pestaña y, en web, una sola entre pestañas con Web Locks)
              → reintento con el token nuevo (contexto ES_REINTENTO_AUTENTICACION)
   ├─ Éxito: el store recibe la respuesta del reintento; patchState; finalize(loading=false); sin toast
   ├─ Error en renovar o 401 en el reintento → estabaAutenticado = SS.estaAutenticado(); SS.limpiarSesionLocal();
   │     si estabaAutenticado: toast "Tu sesión expiró, vuelve a iniciar sesión" (warning) y,
   │     si router.url no empieza por /login ni /registro, navigateByUrl('/login', {replaceUrl: true});
   │     la petición original termina vacía (EMPTY): el store solo ejecuta finalize (loading=false), sin error
   ├─ Error 403: EI toast "Acceso denegado" (o el mensaje del servidor); el store guarda ErrorApi(mensaje, 403)
   ├─ Error 429: EI toast con Retry-After
   ├─ Error 422: EI toast "Has llegado al límite de pérdida, recargue la cuenta para seguir intentando." (sin cambios)
   └─ Error 0/400/404/409/5xx: EI toast como hoy; el store guarda ErrorApi(mensaje, estado)
```

### Flujo D · Cerrar sesión (condición: botón SALIR del menú o del encabezado, o 4.º PIN fallido en `/bloqueo`)

```
[Clic SALIR] → ServicioInactividad.salir()
  → SS.cerrarSesion(): patchState(cerrandoSesion=true, loading=true)   → estaAutenticado() = false desde ya (LoginPage no redirige)
  → SSv.cerrarSesion() → AI: Authorization con SS.accessToken(), withCredentials=true (solo web), contexto OMITIR_MANEJO_ERROR
      └─ 401 (access vencido) → SS.renovarSesion() → reintento de cerrarSesion con el token nuevo (HLT-03 D-26)
            └─ renovación fallida → sin toast ni navegación (estaAutenticado() ya es false) → EMPTY
   ├─ Éxito: el servidor revoca la familia y borra la cookie (web)
   └─ Error (cualquiera, incluida la renovación): sin toast; en web AS.marcarCierrePendiente() (RN-16)
  → finalize: SS.limpiarSesionLocal() (estado en memoria + AS.eliminarRefresh() en nativo), cerrandoSesion=false,
              [web] CP.publicar('sesion-cerrada'), loading=false
  → ServicioInactividad: try { await esperarCargaDeStore(() => SS.isLoading()) } catch { sigue }
  → finalizarSalida(): sessionStorage.clear(); menú cerrado y deshabilitado;
     window.location.replace(Location.prepareExternalUrl('/login'))   (recarga: borra todo el estado en memoria)
```

### Flujo E · Cerrar sesión en todos los dispositivos (condición: botón en `/perfil`)

```
[Clic] → PerfilPage: AlertController (confirmar) → SS.cerrarTodasLasSesiones()
  → SSv.cerrarTodas() con el flujo normal de AI (admite renovación si el access venció)
   ├─ Éxito: {success:'ok'}
   └─ Error: toast de EI; SS.error = mensaje; en web AS.marcarCierrePendiente()
  → finalize: SS.limpiarSesionLocal(); [web] CP.publicar('sesion-cerrada'); loading=false
  → PerfilPage: await esperarCargaDeStore(() => SS.isLoading()) → ServicioInactividad.finalizarSalida()
```

### Flujo F · Registro con suscripción (condición: usuario en `/registro`) — **sin cambios en v2 (DE-01)**

```
[Clic "Registrar"] → RegistroPage.registrarUsuario() (código actual, registro.page.ts:127-154 y effects :73-101)
  → PersonaStore.registrarPersona(datos) → POST persona/agregar (pública) → AI agrega X-Requested-With (sin Authorization: no hay sesión)
  → effect (registro.page.ts:80-89) → SuscripcionStore.crearSuscripcion(SuscripcionModelo con sus_usuarioId) → POST suscripcion/crearSinPago
   ├─ Si el contrato final de HLT-05 la deja accesible sin token: éxito como hoy → toast "Usuario registrado exitosamente" → /login
   └─ Si responde 401 (sin sesión): AI no renueva (la petición no llevaba Authorization, D-10); EI muestra el mensaje del servidor;
        la persona queda registrada y sin suscripción → resultado registrado en T-36 paso 11 y en DE-01
```

La v1 encadenaba un inicio de sesión automático tras el registro (D-25 v1). En la v2 ese cambio **se retira** por indicación del coordinador: el contrato final de `suscripcion/crearSinPago` lo deciden HLT-05 y el plan maestro, y se registra como dependencia abierta DE-01 (H5).

### Flujo G · Varias pestañas en web (condición: dos o más pestañas de la app abiertas en el mismo navegador)

```
[Pestaña A y pestaña B con la misma cookie; el access de ambas vence]
  → A: 401 → SS.renovarSesion() → CP.ejecutarExclusivo('ck-renovar-sesion') obtiene el bloqueo → POST renovar 200
       → patchState(sesión nueva) → CP.publicar({tipo:'sesion-renovada', sesion sin refreshToken}) → libera el bloqueo
  → B: 401 → SS.renovarSesion() → espera el bloqueo → recibe 'sesion-renovada' (mismo usuario.id) → patchState(sesión de A)
       → al obtener el bloqueo, SS.accessToken() ≠ token con el que pidió renovar → devuelve ese token SIN llamar a renovar
       → reintento con el token compartido
   ├─ Éxito: 1 solo POST renovar entre las dos pestañas; la familia no se revoca (HLT-03 R-05)
   ├─ Sin navigator.locks: cada pestaña serializa solo dentro de sí (RN-06); riesgo residual Baja (navegadores sin la API)
   └─ Cierre en A (Flujo D o E) → CP.publicar('sesion-cerrada') → B: SS.limpiarSesionLocal(), cierreRemoto=true
        → AppComponent: ServicioInactividad.finalizarSalida() → B recarga en /login
```

Las pestañas solo adoptan un mensaje `sesion-renovada` si están autenticadas con el mismo `usuario.id` o si su restauración aún no terminó (`estadoRestauracion !== 'finalizada'`). Un login nuevo en otra pestaña no se difunde (D-38).

Persistencia local: este HLT no agrega tablas ni accesos nuevos a SQLite/IndexedDB. Las llamadas existentes a `dbkelly-*` y `dbPIN-*` mantienen la selección web/nativo donde ya está; solo cambia de dónde sale el id de usuario de la clave local (de la sesión, D-23).

---

## H4. Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN / criterio HU | Tarea(s) | Prueba / verificación |
|----------------------------------|----------|-----------------------|
| RN-01 · G-01 (access solo en memoria) | T-09, T-12, T-13 | `sesion.store.spec.ts` (sin `setItem`); `grep` de T-32 |
| RN-02 · G-02 (sin claves de sesión en `localStorage`, limpieza heredada) | T-24, T-30, T-32, T-36 | `servicio-autenticacion.spec.ts`; `grep` de T-32; `Object.keys(localStorage)` en T-36 |
| RN-03 · H-04 · DH-03 web | T-09, T-11, T-12, T-16, T-17 | `autenticacion.interceptor.spec.ts` (withCredentials); `sesion.store.spec.ts` (web ignora `refreshToken`) |
| RN-04 · I-02 · DH-03 nativo | T-02, T-10, T-12, T-13 | `almacen-seguro.service.spec.ts`; `npm ls` de T-02 |
| RN-05 · G-03 cabeceras · §4.5 | T-09, T-16, T-17, T-18 | `autenticacion.interceptor.spec.ts` |
| RN-06 · G-03 cola y reintento | T-12, T-13, T-16, T-17 | specs de store e interceptor (1 renovación, 3 reintentos) |
| RN-07 · G-03 fallo y no-bucle | T-16, T-17, T-36 | spec (1 toast, 1 navegación, sin navegación en `/login`); T-36 paso 9 |
| RN-08 · G-04 | T-12, T-18, T-19 | `guard-autenticacion.spec.ts`; T-36 paso 5 |
| RN-09 · G-05 | T-09, T-14, T-15, T-36 | `error.interceptor.spec.ts`; T-36 paso 10 |
| RN-10 · G-06 · A-05 | T-12, T-13, T-20, T-22, T-36 | `sesion.store.spec.ts`; T-36 pasos 7 y 9 |
| RN-11 · G-08 · DH-04 · S-02 | T-22, T-23, T-25, T-26, T-27, T-28, T-29, T-30, T-32 (excepciones D-30 y DE-01; T-31 verifica DE-01) | `grep` de T-32; `ng build` de cada tarea; T-36 paso 3 |
| RN-12 · G-10 · J-01 · RD-5 | T-08, T-32, T-35 | `ng build --configuration staging|production`; `grep` |
| RN-13 · G-11 | T-10 a T-30, T-37 (C3 de cada ficha) | revisión C3 contra H8/H11 |
| RN-14 · reglas existentes (3 intentos, PIN, inactividad, 422) | T-14, T-20, T-23, T-36 | `login.store.spec.ts`; `grep` de T-35; T-36 pasos 1, 2 y 6 |
| RN-15 · F-06 | T-03, T-04, T-05, T-06, T-07 | `npm audit --omit=dev` |
| RN-16 · sin sesión fantasma | T-10, T-12, T-13 | `sesion.store.spec.ts` (cierre pendiente) |
| RN-17 · PIN al restaurar · bloqueo | T-20, T-23, T-36 | T-36 paso 6 |
| RN-18 · §5.5, §5.6, J-08 | T-33, T-34 | `grep` de T-33 y T-34 |
| RN-19 · renovación entre pestañas | T-37, T-38, T-12, T-13, T-36 | `coordinador-pestanas.service.spec.ts`; `sesion.store.spec.ts`; T-36 paso 13 |
| RN-20 · sin `CapacitorHttp` | T-32 | `grep` de T-32 |
| RN-21 · canal fijo | T-12, T-13, T-16, T-17 | specs de store e interceptor (cuerpos y `withCredentials` por plataforma) |
| J-03 (flujo local completo) | T-36 | Observación manual paso a paso |
| E-07 (cabecera CSRF en `renovar` y `cerrarSesion`) | T-16, T-17 | spec: `X-Requested-With: CriterioKelly` en `renovar` y `cerrarSesion` |
| A-01/A-04 consumidos (forma de la respuesta, rotación en nativo) | T-09, T-12, T-13 | spec: el nuevo `refreshToken` de `renovar` reemplaza al anterior en nativo |
| Registro con suscripción (dependencia abierta DE-01) | T-31, T-36 | T-31 (sin cambios en el registro); T-36 paso 11 registra el resultado real |
| `planSeleccionado` (revisión pedida) | T-30 | `grep -rn "planSeleccionado'" src/app` solo en la limpieza heredada |
| Precondición: contratos de HLT-03/04/05 | T-01 | Lectura de los HLT y reportes; `curl` GET de estado |

### Contrato consumido: campo por campo (app ↔ `rest_*`)

| Endpoint (plan maestro §4.5 / supuesto D-24) | Lo que envía la app tras este HLT | Lo que lee la app |
|----------------------------------------------|-----------------------------------|-------------------|
| `POST autenticacion/autenticar` | `{ usuario, clave }` | `id`, `nombres`, `apellidos`, `roles[{rol_id, rol_descripcion}]`, `accessToken`, `accessExpira`, `refreshToken` (solo nativo) |
| `POST autenticacion/renovar` | web: `{}` + cookie; nativo: `{ refreshToken }` sin cookie (canal fijo, HLT-03 RN-21) | igual que `autenticar` (`accessExpira` en ISO 8601 UTC) |
| `POST autenticacion/cerrarSesion` | `{}` + `Authorization` (renovado si venció) + cookie (solo web) | `{ success }` (no se usa) |
| `POST autenticacion/cerrarTodas` | `{}` + `Authorization`, sin credenciales (HLT-03 D-27) | `{ success }` |
| `GET cuentas/obtener` | sin `?id` | `CuentaResponse[]` (`cue_usuarioId` pasa a opcional) |
| `POST cuentas/nueva` | `{ cue_nombre, valor_cuenta, fecha_valor }` | eco de la cuenta |
| `POST cuentas/movCapital` | `{ cap_idCapital, cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie }` | `CapitalModelo` |
| `PUT cuentas/nombre` | `{ cue_idCuenta, cue_nombre }` | eco |
| `DELETE cuentas/eliminar` | `{ cue_idCuenta }` | `{ success }` |
| `POST bitacora/listBitacora` | `{ bit_cueIdCuentas }` | `BitacoraModelo[]` |
| `POST bitacora/crear` | `RegistroBitacoraModelo` sin `bit_usuarioId` | `BitacoraModelo` |
| `PUT bitacora/finalizaBitacora` | `ActualizarBitacoraFinalModelo` sin `bit_usuarioId` | eco |
| `DELETE bitacora/eliminarBitacora?id=<idBitacora>` | sin cambios (id de bitácora, no de usuario) | `{ success }` |
| `GET comentarios/observaciones?id=<idBitacora>` | sin cambios de contrato; el parámetro se renombra a `idBitacora` en el código | `ComentarioModelo[]` |
| `POST criterioKelly/obtenerPorcentaje`, `obtenerResultados`, `detalleOperacion`, `operacionAnalisis`, `observacionAnalisis` | `{}` | sin cambios |
| `GET planes/suscritos` | sin segmento de id | `PlanesModelo[]` |
| `GET suscripcion/porUsuario` | sin `?id` ni segmento | `SuscripcionModelo[]` |
| `POST suscripcion/crearSinPago` | **sin cambios** (`SuscripcionModelo` con `sus_usuarioId`, desde el registro sin sesión) — DE-01 | `SuscripcionModelo` |
| `PUT persona/actualizarDeApp` | `{ nombres, apellidos, telefono }` | `ActualizarPerfilResponse` |
| `GET autenticacion/usRol?id=` | **ya no se llama** (los roles llegan en `autenticar`) | — |

### Checklist de calidad del HLT

- [x] ✅ Las 11 secciones existen y están completas.
- [x] ✅ Sin marcadores pendientes.
- [x] ✅ Cada RN mapea a ≥1 tarea (cobertura 100 %).
- [x] ✅ Cada tarea tiene criterio de aceptación verificable y ficha de seguimiento (H9).
- [x] ✅ No contradice las reglas del proyecto (§0.5); la única regla del contrato que cambia (sesión en `localStorage`, `doc_modo_planificacion.md:134`) la reemplaza HU-001 G-02 y queda registrada en OBS-02.
- [x] ✅ Referencias `ruta:línea` verificadas contra el repositorio al 2026-11-02 (rama actual de `criterioKellyApp`, último commit `741e72f`).
- [x] ✅ Decisiones cerradas (H5) sin ambigüedad.

---

## H5. Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Plugin de almacenamiento seguro | A) `@aparajita/capacitor-secure-storage@7.1.6` (última 7.x); B) `@aparajita/capacitor-secure-storage@7.1.0`; C) `@aparajita/capacitor-secure-storage@8.0.1`; D) `capacitor-secure-storage-plugin@0.12.0` | **B: `@aparajita/capacitor-secure-storage@7.1.0`, versión exacta (`--save-exact`)**. Alternativa cerrada si B falla: **D: `capacitor-secure-storage-plugin@0.12.0`** (peer `@capacitor/core >=7.0.0`), con la misma interfaz de `AlmacenSeguroService` | Verificado con `npm view` el 2026-11-02: 7.1.0 declara como dependencias `@capacitor/core ^7.0.0`, `@capacitor/app ^7.0.0`, `@capacitor/android ^7.0.0` y `@capacitor/ios ^7.0.0`, todas satisfechas por el `@capacitor/core 7.4.0` y `@capacitor/app 7.0.1` fijados en `package.json`, sin duplicar el núcleo. 7.1.3 a 7.1.6 exigen `@capacitor/core ^7.4.2`/`^7.4.4`, lo que instalaría un segundo `@capacitor/core` anidado (el plugin se registraría contra otro núcleo) o forzaría a subir el núcleo fijado, fuera de alcance. 8.x exige Capacitor 8. Es el paquete que sugiere HU I-02 (Keychain/Keystore). Se usa la API de cadenas `setItem/getItem/removeItem` y `setSynchronize(false)` para no sincronizar el refresh con iCloud. Su implementación web escribe en `localStorage`, por eso en web **nunca** se invoca (D-21) | No (se cambia de plugin sin tocar el store) |
| D-02 | Ubicación y nombres de los artefactos de sesión | Crear en una feature / en `compartidos/` | `compartidos/` con los nombres exactos de §4.6: `store/sesion.store.ts` (`SesionStore`), `servicios/sesion.service.ts` (`SesionService`), `servicios/almacen-seguro.service.ts` (`AlmacenSeguroService`), `interceptors/autenticacion.interceptor.ts` (`autenticacionInterceptor`) | Contrato cerrado del plan maestro; la sesión es transversal (AR-1, AR-6) | No |
| D-03 | Mecanismo de "una sola renovación en curso" | A) Bandera booleana en el estado + reintentos por sondeo; B) Observable compartido (`shareReplay`) en el cierre de `withMethods`; C) `BehaviorSubject` en el interceptor | **B**. `SesionStore` expone `renovarSesion(): Observable<string>` (devuelve el access nuevo) y `renovacionEnCurso(): Observable<string> \| null`. Internamente guarda `let renovacion$: Observable<string> \| null` en el cierre de `withMethods`: si es `null` crea `defer(() => solicitudRenovacion$).pipe(switchMap(SSv.renovar), tap(aplicarRespuestaSesion), map(r => r.accessToken), catchError(manejarFalloRenovacion), finalize(() => { renovacion$ = null; patchState({renovando:false}) }), shareReplay({ bufferSize: 1, refCount: false }))`. El estado expone `renovando: boolean` | El interceptor necesita **encadenar** el reintento al resultado; un `rxMethod` no devuelve valor. Excepción registrada a RI-4/AR-4: `renovarSesion` es un método que devuelve `Observable`, no un `rxMethod`; todo lo demás del store sigue el patrón estándar. El estado de la renovación vive en el store, no en el interceptor (el interceptor no tiene estado) | No |
| D-04 | 401 de una petición enviada con un token que ya fue reemplazado | Renovar siempre / comparar tokens | Si `SS.accessToken()` es distinto del token enviado y no es `null`, se reintenta con el token actual **sin** renovar | Evita una segunda renovación cuando la petición salió antes de que terminara la primera (condición de carrera) | No |
| D-05 | Qué recibe el llamador cuando la sesión expira sin remedio | Relanzar error / `EMPTY` | `EMPTY`: el observable completa sin valor. Los `rxMethod` ejecutan solo `finalize` (`loading=false`) y no guardan error | Evita toasts duplicados en las páginas que muestran `errorMessage` con `effect` (por ejemplo `cuentas.page.ts:69-74`): el único aviso es el de RN-07 | No |
| D-06 | Cómo `errorInterceptor` deja pasar los errores que maneja la sesión | Lista de URLs / cabecera / contexto | (1) Si `req.context.get(OMITIR_MANEJO_ERROR)` es `true` → relanza el `HttpErrorResponse` original, sin toast (lo usan `renovar` y `cerrarSesion`). (2) Si el estado es 401 y la petición tiene `Authorization` → relanza el original, sin toast. (3) En los demás casos, como hoy, pero el error relanzado es `new ErrorApi(mensaje, error.status)` (clase en `compartidos/modelos/error-api.ts`, `extends Error`, con `readonly estado: number`) | Hoy `error.interceptor.ts:53` relanza `new Error(mensaje)` y pierde el código: el interceptor de autenticación (exterior) no podría ver el 401 y `LoginStore` no podría distinguir 401 de 429. `ErrorApi` sigue siendo `Error`, así que los `catchError` que leen `err.message` (por ejemplo `cuentaStore.ts:60`) no cambian | No |
| D-07 | Orden de interceptores | `[errorInterceptor, autenticacionInterceptor]` / `[autenticacionInterceptor, errorInterceptor]` | `withInterceptors([autenticacionInterceptor, errorInterceptor])` en `main.ts:22` | §4.6 ("registrado antes de `errorInterceptor`"); `autenticacionInterceptor` es el exterior y ve el resultado final del reintento | No |
| D-08 | Peticiones con `withCredentials: true` (**modificada en v2**) | Solo `renovar` y `cerrarSesion` (HU H-04 literal) / también `autenticar` / también en nativo | Solo con `ES_PLATAFORMA_NATIVA === false` y exactamente `URL_AUTENTICAR`, `URL_RENOVAR` y `URL_CERRAR_SESION`, comparando la URL sin query con igualdad estricta. En nativo, `withCredentials` es siempre `false` | Sin `withCredentials` en `autenticar`, el navegador **ignora** el `Set-Cookie` de una respuesta cross-origin y la cookie nunca se crea (OBS-03). En nativo el refresh viaja en el cuerpo; enviar cookies mezclaría canales (HLT-03 RN-21, D-12) | No |
| D-09 | `Authorization` en las rutas de sesión (**modificada en v2**) | Siempre / según ruta / explícito en `cerrarSesion` (v1) | No se agrega a `autenticar` ni `renovar`. `cerrarSesion` y `cerrarTodas` lo reciben del interceptor como cualquier petición protegida (`SS.accessToken()`), sin cabecera explícita en `SesionService` | `autenticar` y `renovar` son públicas (§4.5). `cerrarSesion` exige un access válido y debe poder renovarse (HLT-03 Flujo C, D-26), así que pasa por el flujo normal | No |
| D-10 | Peticiones que **no** disparan renovación ante 401 (**modificada en v2**) | — | `autenticar`, `renovar`, toda petición que salió sin `Authorization` y toda petición marcada con `ES_REINTENTO_AUTENTICACION` (un 401 en el reintento expira la sesión). `cerrarSesion` y `cerrarTodas` **sí** renuevan. Solo un **401** dispara la renovación: un 400, 403, 422 o 429 nunca renueva (por ejemplo, la clave actual incorrecta en `actualizarClave` debe responder 400, HLT-08 C-1/D-16) | Sin bucles: cada petición se renueva como máximo una vez; la propia renovación nunca se renueva. `cerrarSesion` con un access vencido debe revocar de verdad la familia | No |
| D-11 | Cómo se dispara la restauración y cómo esperan las guardas | `APP_INITIALIZER` bloqueante / no bloqueante + espera en la guarda | `provideAppInitializer(() => { inject(SesionStore).restaurarSesion(); })` en `main.ts` (no bloquea el arranque). `restaurarSesion` es idempotente (`filter(() => estadoRestauracion() === 'pendiente')`). `GuardAutenticacion` y `GuardRoles` llaman a `restaurarSesion()` y devuelven `toObservable(SS.estadoRestauracion)` filtrado por `'finalizada'`, `take(1)` y mapeado a `true` o `router.createUrlTree(['/login'])` (`GuardRoles` además evalúa roles como hoy) | La pantalla de login aparece de inmediato; solo las rutas privadas esperan (G-04). `toObservable` se crea en un campo de la clase (contexto de inyección) | No |
| D-12 | Sesión restaurada cuando la app abre en `/login` (ruta por defecto, `app.routes.ts:11-15`) | Quedarse en login / ir a `/inicio` / ir a `/bloqueo` | `LoginPage.ionViewWillEnter`: espera la restauración (`esperarCargaDeStore(() => !SS.restauracionFinalizada())` dentro de `try/catch`; si vence el tiempo, se queda en login) y, si `SS.estaAutenticado()`, `navCtrl.navigateRoot('/bloqueo')` | Reabrir la app con una sesión viva pide el PIN, igual que tras 5 minutos de inactividad; ir directo a `/inicio` sería más débil que hoy (hoy se pide la clave). El usuario sin PIN usa SALIR del encabezado y entra con su clave | No |
| D-13 | `/bloqueo` tras demasiados PIN fallidos (`bloqueo.page.ts:108-114`) | Dejar `navigateForward('/login')` / cerrar sesión | Reemplazar `this.navCtrl.navigateForward('/login')` de `bloqueo.page.ts:113` por `await this.servicioInactividad.salir()` | Con D-12, volver a `/login` con sesión viva redirigiría a `/bloqueo` y dejaría intentos ilimitados de PIN. Bug corregido en una línea que el HLT ya debe modificar (plan maestro §5.7) | No |
| D-14 | Orden del cierre de sesión (**modificada en v2**) | Limpiar primero con token explícito (v1) / limpiar al final con estado `cerrandoSesion` | `cerrarSesion`: `patchState({ cerrandoSesion: true })` → petición por el flujo normal (renueva si hace falta) → en `finalize` `limpiarSesionLocal()`, `cerrandoSesion: false` y, en web, `CP.publicar('sesion-cerrada')`. `ServicioInactividad.salir()` espera la petición (máximo el tiempo de `esperarCargaDeStore`; si vence, sigue) y llama a `finalizarSalida()`, que recarga con `window.location.replace(location.prepareExternalUrl('/login'))` | `cerrarSesion` necesita el access (y el refresh para renovarlo), así que no se puede borrar antes (HLT-03 D-26). `cerrandoSesion` hace `estaAutenticado()` falso desde el primer instante, con lo que `LoginPage` no redirige a `/bloqueo` (D-12) y el interceptor no muestra el toast de expiración. La recarga borra el estado en memoria de los 16 stores con la menor superficie de cambio (RD-7) | No |
| D-15 | Sesión fantasma si `cerrarSesion` o `cerrarTodas` fallan en web (la cookie HttpOnly sigue viva y JavaScript no puede borrarla) | Aceptar el riesgo / marca local de cierre pendiente | Marca `localStorage['ck_cierre_pendiente'] = '1'` gestionada **solo** por `AlmacenSeguroService` (`marcarCierrePendiente`, `hayCierrePendiente`, `limpiarCierrePendiente`). `restaurarSesion` en web, si hay marca: `renovarSesion()` → `cerrarSesion(token)` → si responde 200 borra la marca; en cualquier caso termina **sin** sesión. Un login exitoso en web borra la marca | En un equipo compartido, reabrir el navegador no debe devolver la sesión de quien la cerró. La marca no contiene datos de sesión (no es token, usuario ni rol), así que no contradice G-01/G-02. En nativo no hace falta: el refresh se borra del Keychain/Keystore localmente | No |
| D-16 | Cuándo se borra el refresh nativo | — | Solo en: (a) 401 o 403 de `renovar`; (b) `cerrarSesion` / `cerrarTodasLasSesiones` (siempre); (c) un login exitoso lo **reemplaza** | Un fallo de red (0), 429 o 5xx no debe obligar a volver a iniciar sesión al reabrir la app | No |
| D-17 | API pública de `ServicioAutenticacion` (fachada) | Mantener todo / reducir | Se mantienen y delegan en `SesionStore`: `estaAutenticado()`, `obtenerUsuarioActual()`, `obtenerRolesUsuario()`, `rolEspecifico()`, `otrosRoles()`, `todosLosRoles()`, `isSuperAdmin()`, `esAdministrador()`. Se eliminan `setUsuarioAutenticado()`, `logout()`, `autenticado$`, `usuarioActual$`, `rolUsuario$` y `cargarDatosAlmacenados()` | Las mutaciones de sesión pasan solo por `SesionStore`. Los observables quedan sin uso tras T-21 (verificado: su único consumidor es `app.component.ts:46`); dejarlos sería código muerto. Menor superficie para guardas y páginas (RD-7 del plan maestro) | No |
| D-18 | `planSeleccionado` en `PlanesStore.guardarPlanEnLocalStorage` (`PlanesStore.ts:96-100`) | Mantener / eliminar | **Eliminar** el método y sus 3 llamadas (`planes.page.ts:80`, `:90`, `:109`), y borrar la clave heredada al arrancar (D-19) | No es dato de sesión (el catálogo de planes es público), pero es **código muerto**: `grep -rn "getItem" src/app` no tiene ningún lector de `planSeleccionado`; el plan elegido ya viaja en memoria por `PlanesStore.objPlanSeleccionado` (`registro.page.ts:37`). Eliminarlo deja `localStorage` vacío de datos de la app, lo que simplifica la verificación de RN-02 | No |
| D-19 | Limpieza de valores heredados | En `main.ts` / en `SesionStore` / en la fachada | En el constructor de `ServicioAutenticacion`: método privado `limpiarDatosHeredados()` que ejecuta `localStorage.removeItem` de `usuario`, `roles`, `autenticado` y `planSeleccionado` (constante `CLAVES_HEREDADAS`) | La fachada es la que escribía esas claves; se construye en el arranque (la inyecta `AppComponent` a través de las guardas y páginas). Es el único lugar del código con `localStorage` además de la marca de D-15 | No |
| D-20 | Flujo de login y conteo de intentos | Mantener `LoginServicio` / mover el HTTP a `SesionService` | `LoginServicio` (`login.servicio.ts`) **se elimina**: `autenticar` pasa a `SesionService` y `usRol` deja de llamarse (los roles llegan en `autenticar`, §4.5). `LoginStore` queda con `loading`, `error`, `intentos` y los métodos `registrarResultado(estado: number \| null)` (suma 1 solo si `estado === 401`) y `reiniciarIntentos()`; conserva `MAX_INTENTOS = 3` e `intentosAgotados`. `LoginPage` deja de mostrar su toast `'Usuario o contraseña incorrectos'` (`login.page.ts:113-116`) porque `errorInterceptor` ya muestra el mensaje del servidor | Un 429 o un error de red no deben consumir los 3 intentos ni cerrar la app. Se elimina el toast duplicado (RI-8) | No |
| D-21 | Detección de plataforma | `Capacitor.isNativePlatform()` directo / token inyectable | `InjectionToken<boolean>` `ES_PLATAFORMA_NATIVA` en `compartidos/servicios/plataforma.ts`, `providedIn: 'root'`, `factory: () => Capacitor.isNativePlatform()`. Lo usan `SesionStore`, `AlmacenSeguroService` y `autenticacionInterceptor`. La decisión web/nativo se toma en `SesionStore` (el llamador, RI-6); además `AlmacenSeguroService` no llama al plugin si el token es `false` (defensa en profundidad) | Permite probar ambas plataformas en Karma. La guarda en el servicio es una excepción registrada a RI-6: evita que un error futuro en un llamador escriba el refresh en `localStorage` mediante la implementación web del plugin | No |
| D-22 | Cuerpo de los `POST` sin datos | `null` / `{}` | `{}` con `Content-Type: application/json` en `renovar` (web), `cerrarSesion`, `cerrarTodas` y `criterioKelly/*`. `renovar` nativo: `{ refreshToken }` | Contrato de HLT-03 D-25 y HLT-04 D-10; `LectorSolicitud` (HLT-02, C-06) rechaza cuerpos sin `Content-Type` JSON | No |
| D-23 | Modelos de petición y de respuesta | Quitar ids de todos / solo de peticiones | Se quita el id de usuario de las **peticiones**: `CrearCuenta.cue_usuarioId` (`Cuentas.modelo.ts:22`), `ActualizarNombreCuenta.cue_usuarioId` (`:28`), `EliminarCuenta.cue_usuarioId` (`:34`), `CapitalModelo.cap_usuarioId` (`Capital.modelo.ts:3`), `RegistroBitacoraModelo.bit_usuarioId` (`Bitacora.modelo.ts:25`), `ActualizarBitacoraFinalModelo.bit_usuarioId` (`:56`), `ActualizarPerfilRequest.id` (`Perfil.modelo.ts:2`); se crea `FiltroBitacora { bit_cueIdCuentas: number }`. `SuscripcionModelo` y `crearSuscripcion` **no** cambian en v2 (DE-01). En **respuestas** solo cambia `CuentaResponse.cue_usuarioId` a opcional (`Cuentas.modelo.ts:14`). Las claves locales (`dividendoKelly`, `pinBloqueo`) usan el id de la sesión (`ServicioAutenticacion.obtenerUsuarioActual()?.id`), nunca un campo de la respuesta | Así la app funciona tanto si HLT-04 sigue devolviendo `cue_usuarioId` como si lo quita (C-04). Las demás respuestas no se tocan (RD-7) | No |
| D-24 | Contrato de los endpoints de listado propios | Seguir mandando el id / sin id | `GET cuentas/obtener`, `GET planes/suscritos`, `GET suscripcion/porUsuario` sin id; `POST` de `criterioKelly/*` con `{}`; `bitacora/listBitacora` con `{ bit_cueIdCuentas }`. La parte de `rest_criteriokelly` está **confirmada** por HLT-04 H5.1 (el id, si llega, se acepta solo si coincide, D-01 de HLT-04; recurso ajeno o inexistente → 403). La parte de `rest_suscripcion` depende de HLT-05, que aún no existe. T-01 verifica que HLT-04 y HLT-05 entregaron exactamente esto; si no, T-01 queda `BLOQUEADA` y el plan maestro se revisa en `-v2` (§1) | DH-04 y C-01: el usuario sale de la sesión. Hoy `suscripcion.service.ts:24` manda el id como segmento y el backend lo lee de `?id` (`SuscripcionRts.php:60`): el contrato sin id elimina esa discrepancia | Sí (contrato con el backend) |
| D-25 | Registro → `crearSinPago` (**reemplazada en v2 por DE-01**) | v1: iniciar sesión tras registrar / v2: no tocar el registro | **No se modifica** el flujo de registro (`registro.page.ts`, `SuscripcionStore.crearSuscripcion`, `suscripcion.service.ts:28-35`, `Suscripcion.modelo.ts`). Ver DE-01 | El coordinador fija que el contrato de `crearSinPago` lo decide HLT-05/plan maestro (hallazgo O-08-2 de HLT-08); cambiarlo aquí sería adivinar un contrato abierto | No |
| D-26 | Entornos sin DH-07 | Dejar `localhost` / dominio de ejemplo público / dominio reservado | `environment.prod.ts`: `https://api.criteriokelly.invalid/rest_usuario/`, `…/rest_criteriokelly/`, `…/rest_suscripcion/`, `production: true`, `entorno: 'produccion'`. `environment.staging.ts`: `https://staging-api.criteriokelly.invalid/…`, `production: true`, `entorno: 'staging'`. `environment.ts`: las URLs locales actuales, `production: false`, `entorno: 'local'`. Configuración `staging` en `angular.json` copiada de `production` con su `fileReplacements`, y `serve.configurations.staging` | `.invalid` es un TLD reservado (RFC 6761) que nunca resuelve: una build de producción compilada antes de HLT-11 falla cerrada en lugar de enviar credenciales a un tercero. HLT-11 reemplaza `criteriokelly.invalid` por el dominio de DH-07 (`grep -rn "criteriokelly.invalid" src/environments` es el punto de reemplazo). Las URLs terminan en `/` (requisito de D-27b) | No |
| D-27 | Mensaje de 429 y lectura de `Retry-After` | — | (a) Si `Retry-After` es un entero `n > 0`: `n < 60` → `Demasiados intentos. Intente nuevamente en ${n} segundos.`; `n ≥ 60` → `Demasiados intentos. Intente nuevamente en ${Math.ceil(n / 60)} minutos.` Si no hay cabecera o no es entera: el mensaje del servidor o `Demasiados intentos, intente nuevamente más tarde`. El caso 429 se evalúa **antes** de preferir el mensaje del servidor. (b) `esUrlApi(url)` = `URLS_API.some(base => url.startsWith(base))` con bases terminadas en `/` | El mensaje del servidor (§4.5) no trae el tiempo. Comparar con la base terminada en `/` impide que `https://api.x.com.evil/…` se confunda con `https://api.x.com/…`. Ver OBS-01 sobre `Access-Control-Expose-Headers` | No |
| D-28 | Remediación de `npm audit --omit=dev` (línea base del 2026-11-02: 1 crítica, 13 altas, 1 moderada) | `npm audit fix --force` / actualizaciones dirigidas | (1) `@angular/*` de producción y `@angular/compiler-cli`, `@angular/language-service` a **20.3.35** exacta (misma mayor); (2) `jspdf@4.2.1` y `jspdf-autotable@5.0.9` (peer `jspdf ^2 \|\| ^3 \|\| ^4`); (3) `xlsx` desde el tarball oficial de SheetJS `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (el paquete de npm 0.18.5 no tiene corrección); (4) `glob` y `rimraf` pasan a `devDependencies` (no se importan en `src`, verificado con `grep`); (5) `npm audit fix --legacy-peer-deps` **sin** `--force` para las transitivas (`dompurify`, `fflate`, `minimatch`, `@isaacs/brace-expansion`) | F-06 es de este HLT. `--force` podría saltar mayores sin control. Cada cambio va en su propia tarea para aislar fallos. Si tras T-07 queda una alta o crítica, T-07 queda `BLOQUEADA` con la salida y una pregunta al usuario (RD-6) | No |
| D-29 | Renovación proactiva con `accessExpira` | Temporizador / solo reactiva | Solo reactiva (ante 401). `accessExpira` (ISO 8601 UTC, `+00:00`, HLT-03) se guarda en el estado como cadena, sin convertir, y no programa nada; si en el futuro se compara, solo con `Date.parse` | El reloj del dispositivo no es confiable; menos código y menos casos de carrera | No |
| D-30 | Cambio de clave (`perfil.service.ts:28-33` con `CambiarClaveRequest.id`) | Cambiarlo aquí / en HLT-08 | **HLT-08** lo reescribe completo (`{ claveActual, claveNueva }`, G-07). Este HLT no lo toca | G-07 es de HLT-08 y el cuerpo cambia por completo. Ventana de transición: si HLT-06 ya se ejecutó, ese formulario falla hasta HLT-08 (OBS-04) | No |
| D-31 | Ejecución de Karma | `Chrome` con ventana (`karma.conf.js:40`) / `ChromeHeadless` | `ng test --watch=false --browsers=ChromeHeadless …` | Resultado reproducible sin abrir ventanas; `karma-chrome-launcher` ya está en `devDependencies` | No |
| D-32 | `cerrarTodas` | Limpiar primero / limpiar al terminar | La petición sale por el flujo normal del interceptor (puede renovar si el access venció) y `limpiarSesionLocal()` corre en `finalize`; la página espera y llama a `finalizarSalida()` | Si se limpiara antes, un access vencido impediría revocar las demás sesiones | No |
| D-33 | Actualizar nombres tras editar el perfil | `setUsuarioAutenticado(usuario, loginStore.userRoles())` (`perfil.page.ts:75-78`) / método del store | `SesionStore.actualizarDatosUsuario({ nombres, apellidos })` | Hoy, tras una sesión restaurada, `loginStore.userRoles()` es `null` y se borrarían los roles. Se elimina la dependencia de `perfil.page.ts` con `LoginStore` (`:22`, `:43`) | No |
| D-34 | Tiempo de prueba del access vencido en T-36 | Editar `TOKEN_ACCESO_MINUTOS` en `rest_usuario/.env` / revocar en BD / esperar | Esperar el valor de `TOKEN_ACCESO_MINUTOS` leído (solo lectura) de `rest_usuario/.env` + 30 s | El agente `desarrollador-ionic` no modifica archivos de `rest_*` (planificador: una tarea no mezcla lados) ni escribe en la base de datos; esperar no requiere cambiar nada | No |
| D-35 | Documentación | Solo `CLAUDE.md` y agente / también README y arquitectura | `criterioKellyApp/CLAUDE.md`, `.claude/agents/desarrollador-ionic.md` (§5.6), `criterioKellyApp/README.md` (§5.5, con sección "Ambiente local", J-08) y `criterioKellyApp/docs/doc_arquitectura.md` (describe la sesión y quedaría falsa). `doc_modo_planificacion.md` **no** se modifica (OBS-02) | Evita documentación contradictoria con el código | No |
| D-36 | Parámetro de `comentarios/observaciones` | Tratarlo como id de usuario / renombrar | Es el **id de la bitácora** (llamadores: `bitacora.page.ts:267`, `bitacora-seguimiento.page.ts:211`). Se renombra `usuarioId` → `idBitacora` en `comentarios.service.ts:22-27` y `comentariosStore.ts:40-44`, sin cambiar la URL | El nombre actual induce a error en el inventario de S-02; el backend valida el dueño de la bitácora (HLT-04) | No |
| D-37 | Ficheros de constantes HTTP de sesión | Repetir URLs en servicio e interceptor / un solo archivo | `compartidos/interceptors/sesion-http.ts` exporta `OMITIR_MANEJO_ERROR`, `ES_REINTENTO_AUTENTICACION` (`HttpContextToken<boolean>`, por defecto `false`), `URL_AUTENTICAR`, `URL_RENOVAR`, `URL_CERRAR_SESION`, `URL_CERRAR_TODAS`, `URLS_API`, `VALOR_X_REQUESTED_WITH = 'CriterioKelly'`, `VALOR_X_CLIENTE_NATIVO = 'nativo'` y la función `esUrlApi(url)` | Una sola fuente para servicio, interceptores y specs (AR-6, CC-4) | No |
| D-38 | Serialización de `renovar` entre pestañas (web) y difusión de la sesión (**nueva en v2**) | A) `BroadcastChannel` como elección de líder; B) **Web Locks API** (`navigator.locks.request`) + `BroadcastChannel` para difundir; C) marca en `localStorage` con evento `storage`; D) no serializar | **B**. Nuevo `CoordinadorPestanasService` (`compartidos/servicios/coordinador-pestanas.service.ts`) con: `ejecutarExclusivo<T>(nombre: string, tarea: () => Promise<T>): Promise<T>` → si `ES_PLATAFORMA_NATIVA` es `true` o `typeof navigator.locks?.request !== 'function'`, ejecuta `tarea()` directamente; si no, `navigator.locks.request(nombre, { mode: 'exclusive' }, tarea)`. Nombre fijo `NOMBRE_BLOQUEO_RENOVACION = 'ck-renovar-sesion'`. `publicar(mensaje: MensajeSesion)` y `mensajes$: Observable<MensajeSesion>` sobre `new BroadcastChannel('ck-sesion')` (solo web y solo si `typeof BroadcastChannel === 'function'`; si no, `publicar` no hace nada y `mensajes$` no emite). `MensajeSesion = { tipo: 'sesion-renovada'; sesion: Omit<RespuestaSesion, 'refreshToken'> } \| { tipo: 'sesion-cerrada' }`. En `SesionStore.renovarSesion` (web): `tokenAlPedir = accessToken()` → `ejecutarExclusivo(NOMBRE_BLOQUEO_RENOVACION, () => firstValueFrom(accessToken() !== tokenAlPedir && accessToken() !== null ? of(accessToken()) : peticionRenovar$))`; al terminar con éxito publica `sesion-renovada`. El store se suscribe a `mensajes$` (en `withHooks.onInit`, con `takeUntilDestroyed`) y: `sesion-renovada` → `aplicarRespuestaSesion` solo si (`estaAutenticado()` y mismo `usuario.id`) o `estadoRestauracion() !== 'finalizada'`; `sesion-cerrada` → `limpiarSesionLocal()` + `cierreRemoto: true` (si estaba autenticado) | Con la cookie compartida, dos `renovar` simultáneos del mismo navegador revocan la familia (HLT-03 R-05, A-04 estricto). Web Locks es la primitiva diseñada para exclusión mutua entre pestañas del mismo origen (Chrome 69+, Firefox 96+, Safari 15.4+), sin sondeo ni carreras de líder, y libera el bloqueo si la pestaña se cierra. `BroadcastChannel` evita que la pestaña que esperaba vuelva a rotar el refresh y propaga el cierre. C deja datos en `localStorage` y tiene carreras. Alternativa cerrada sin `navigator.locks`: serialización solo dentro de la pestaña (RN-06), riesgo residual Baja. El access viaja por `BroadcastChannel` solo en memoria, entre pestañas del mismo origen (no es almacenamiento persistente, G-01). Excepción registrada: `SesionStore` usa `withHooks` (ningún store lo usaba) porque la suscripción al canal debe vivir lo mismo que el store | No |
| DE-01 | **Dependencia abierta (no bloqueante):** contrato de `POST suscripcion/crearSinPago` llamado desde el registro, cuando el usuario aún no tiene sesión | Público con `sus_usuarioId` / protegido con login automático en la app / creación de la suscripción dentro de `persona/agregar` | **Sin decisión en este HLT.** La app conserva el comportamiento actual (envía `sus_usuarioId`, sin `Authorization`). Dueño: HLT-05 + plan maestro (`-v2` si cambia §4.5). Cuando se cierre, la adaptación de la app se hace en un HLT o una versión posterior de este | El coordinador la registra como pendiente (O-08-2 de HLT-08). No bloquea: ninguna otra tarea depende de ella. Efecto conocido: si HLT-05 protege la ruta, el registro crea la persona y la suscripción falla con el toast del servidor (T-36 paso 11 registra el resultado real) | — |
| D-39 | Estado de cierre en curso (**nueva en v2**) | Borrar el token antes (v1) / bandera | Campo de estado `cerrandoSesion: boolean`; `estaAutenticado = computed(() => accessToken() !== null && usuario() !== null && !cerrandoSesion())`; nuevo campo `cierreRemoto: boolean` (lo consume `AppComponent`, T-21) | Permite renovar durante el cierre (D-14) sin que la UI vea una sesión viva y sin el toast de expiración (el interceptor solo avisa si `estaAutenticado()` era `true`) | No |

---

## H6. Revisión del requerimiento por parte de un senior

> v2: la primera y la segunda iteración se conservan tal como se hicieron sobre la v1; la **tercera iteración** (al final de esta sección) revisa los cambios V2-01 a V2-09 y emite el veredicto vigente.

### Primera iteración (sobre el borrador)

Veredicto: **APROBADO CON CAMBIOS**. Hallazgos adversariales y cambio obligatorio aplicado:

| # | Ataque o fallo revisado | Hallazgo en el borrador | Cambio aplicado |
|---|-------------------------|-------------------------|-----------------|
| 1 | Token en almacenamiento persistente por descuido | La implementación web de `@aparajita/capacitor-secure-storage` escribe en `localStorage`; una llamada desde web guardaría el refresh en claro | D-21 (decisión en el store + guarda en el servicio), RN-04 y su spec |
| 2 | Fuga de `Authorization` a terceros | Comparar con `includes('rest_')` o con un prefijo sin `/` final dejaba pasar dominios parecidos | D-27b (`startsWith` con bases terminadas en `/`), spec con `https://tercero.example/` |
| 3 | Condición de carrera en renovaciones | Una petición que salió con el token viejo y recibe 401 después de la renovación disparaba una segunda renovación (rotación del refresh dos veces; con detección de reutilización, A-04 revoca **toda la familia**) | D-03 (single-flight), D-04 (comparar tokens), espera de la renovación en curso antes de enviar |
| 4 | Bucles de redirección | (a) `errorInterceptor` convertía el 401 en `Error` y el interceptor exterior no veía el estado; (b) con D-12, `/bloqueo` → `/login` → `/bloqueo` sin límite de PIN; (c) navegar a `/login` estando en `/login` o `/registro` | D-06 (`ErrorApi` y relanzar el original), D-13 (`salir()` en `bloqueo.page.ts:113`), RN-07 (sin navegación en `/login` y `/registro`), D-10 (un reintento máximo) |
| 5 | XSS que lea el access en memoria | El access está en una señal del store; un XSS puede leerlo y también llamar a `renovar` con la cookie | Riesgo residual **Media**: access de 15 min, cero sumideros `innerHTML`/`bypassSecurityTrust` (`grep` sin resultados el 2026-11-02), CSP estricta en HLT-09 (H-06). No se agrega cifrado en memoria (no protege contra código que corre en el mismo origen) |
| 6 | Sesión fantasma tras logout | (a) Si `cerrarSesion` falla en web la cookie sigue viva y la siguiente apertura restauraba la sesión; (b) los stores conservaban datos del usuario anterior; (c) navegar a `/login` antes de limpiar hacía que `LoginPage` redirigiera a `/bloqueo` | D-15 (cierre pendiente), D-14 (limpieza inmediata + recarga completa) |
| 7 | Roles borrados | `perfil.page.ts:75-78` reescribía la sesión con `loginStore.userRoles()`, que es `null` tras una restauración | D-33 |
| 8 | Registro roto por DH-04 | `registro.page.ts:236` enviaba `sus_usuarioId` a `crearSinPago`, que desde HLT-05 podría exigir token | v1: D-25 y Flujo F. **v2:** retirado; dependencia abierta DE-01 |
| 9 | Núcleo de Capacitor duplicado | La última 7.x del plugin (7.1.6) exige `@capacitor/core ^7.4.4` contra el `7.4.0` fijado | D-01 (7.1.0 exacta) y verificación `npm ls @capacitor/core` en T-02 |
| 10 | 429 sin tiempo | Cross-origin, `Retry-After` no es legible desde JavaScript si el backend no lo expone | D-27 con texto de respaldo; OBS-01 al plan maestro; T-36 paso 10 registra el resultado real |
| 11 | Intentos de login consumidos por 429 o falta de red | El conteo sumaba ante cualquier error | D-20 (solo 401) |
| 12 | Auditoría de dependencias | `npm audit --omit=dev` tenía 1 crítica (`jspdf`) y 13 altas (Angular 20.3.25, `xlsx`, `glob`, transitivas) | D-28 y tareas T-03 a T-07 |

### Segunda iteración (sobre el HLT con los cambios aplicados)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 cubre los 10 puntos del requerimiento literal; cada uno aparece en la matriz H4. |
| 2 | Reglas de negocio | ✅ | RN-01 a RN-18 son invariantes con comando u observación; RN-14 protege 3 intentos, PIN, inactividad y 422. No se contradicen: RN-02 admite solo la marca de D-15, que RN-16 exige. |
| 3 | Impacto | ✅ | Inventario completo de envíos de id (abajo), de usos de `ServicioAutenticacion` (`grep` de 22 referencias revisadas) y de `localStorage` (8 líneas). Efectos colaterales identificados: registro (D-25), perfil (D-33), bloqueo (D-13), operativa-kelly (D-23). |
| 4 | Consistencia arquitectónica | ✅ | Standalone, `inject()`, `signalStore` con `loading`/`error`, `rxMethod` estándar. Excepciones registradas: `renovarSesion()` devuelve `Observable` (D-03) y guarda de plataforma en `AlmacenSeguroService` (D-21). |
| 5 | Riesgos | ✅ | Tabla de riesgos abajo. |
| 6 | Simplicidad | ✅ | Sin temporizador proactivo (D-29), sin cifrado en memoria, recarga en lugar de reiniciar 16 stores (D-14), fachada en lugar de reescribir guardas y páginas (D-17). |
| 7 | Seguridad | ✅ | Revisados los 6 vectores pedidos (tabla de la primera iteración). Riesgo residual de XSS asignado a HLT-09. |
| 8 | Cobertura | ✅ | Matriz H4 al 100 %, incluida la comparación campo a campo del contrato. |
| 9 | Determinismo | ✅ | 37 decisiones cerradas; la única dependencia externa (contratos de HLT-04/05) tiene una regla de bloqueo explícita en T-01, no una decisión abierta. |
| 10 | Ejecutabilidad por agente | ✅ | 36 tareas con archivos y líneas, dependencias acíclicas y criterio de aceptación con comando u observación. |

Veredicto de la segunda iteración (sobre la v1): APROBADO. Queda sustituido por la tercera iteración.

### Tercera iteración (v2, tras las restricciones de HLT-03)

**Ronda 3a — veredicto: APROBADO CON CAMBIOS.** Al cruzar la v1 con HLT-03 se encontraron estos defectos:

| # | Vector | Defecto en v1 | Cambio aplicado en v2 |
|---|--------|---------------|-----------------------|
| 13 | Sesión fantasma tras logout | v1 limpiaba el estado antes de `cerrarSesion` y enviaba el token capturado: con el access vencido, HLT-03 responde 401 y la familia **no** se revoca; el refresh seguía vivo en el servidor | V2-01: `cerrarSesion` por el flujo normal con renovación y reintento (D-09, D-10, D-14, D-39) |
| 14 | Condición de carrera en renovaciones (entre pestañas) | El single-flight de v1 era por pestaña; dos pestañas con la misma cookie renuevan a la vez y HLT-03 revoca **toda** la familia (R-05) | V2-02: Web Locks + adopción por `BroadcastChannel` (D-38, RN-19, T-37, T-38) |
| 15 | Bucle de redirección / toast espurio al salir | Con la renovación dentro del cierre, un fallo de `renovar` mostraría "Tu sesión expiró" y navegaría mientras el usuario está saliendo | `cerrandoSesion` hace `estaAutenticado()` falso: el interceptor no avisa ni navega (D-39) |
| 16 | Canal mezclado | v1 ponía `withCredentials` también en nativo | V2-04: `withCredentials` solo en web (D-08, RN-21) |
| 17 | Origen nativo perdido | Nada impedía activar `CapacitorHttp` (sin `Origin`, HLT-03 no entrega el refresh en el cuerpo) | V2-03: RN-20, RS-SES-11 y `grep` en T-32 |
| 18 | Sesión viva en otra pestaña tras cerrar | Cerrar en una pestaña dejaba el access en memoria de las otras hasta su expiración | V2-08: mensaje `sesion-cerrada` y `cierreRemoto` (D-38, T-21) |
| 20 | Contrato abierto adivinado | v1 resolvía el registro con un login automático sobre un contrato que aún decide HLT-05 | V2-10: registro sin cambios y dependencia abierta DE-01 (no bloqueante, con dueño) |
| 21 | Renovación ante errores que no son de sesión | Un 400 de `actualizarClave` (clave actual incorrecta) o un 401 de `autenticar` podría disparar una renovación | V2-11: solo 401 de peticiones con `Authorization` y nunca en `autenticar`/`renovar` (D-10, specs de T-17) |
| 19 | Token por `BroadcastChannel` | Difundir el access a otras pestañas podría parecer una fuga | Aceptado: mismo origen, solo memoria, se excluye `refreshToken` del mensaje (`Omit<RespuestaSesion,'refreshToken'>`); una pestaña XSS ya podría leerlo de su propia memoria |

**Ronda 3b — revisión de la v2 con los cambios aplicados:**

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | El requerimiento complementario (6 restricciones) está en H1 y cada una mapea a V2-01…V2-06 y a RN/D/T. |
| 2 | Reglas de negocio | ✅ | RN-19 a RN-21 son verificables por spec o `grep`; RN-10 y RN-16 ampliadas sin contradecir RN-02 (el canal no persiste nada). |
| 3 | Impacto | ✅ | Nuevo servicio `CoordinadorPestanasService`; cambios en `SesionStore`, `SesionService`, interceptor, `AppComponent`. HLT-04 confirmado; HLT-05 sigue con la verificación de T-01. Coordinación con HLT-08 D-14 registrada. |
| 4 | Consistencia arquitectónica | ✅ | Excepciones registradas: D-03 (`renovarSesion` devuelve `Observable`), D-21 (guarda en `AlmacenSeguroService`), D-38 (`withHooks` para la suscripción al canal). |
| 5 | Riesgos | ✅ | Agregados: navegadores sin Web Locks (Baja) y ping-pong de renovaciones si el canal no existe (Baja). |
| 6 | Simplicidad | ✅ | No se implementa elección de líder ni temporizadores; un bloqueo con nombre fijo y un canal de dos mensajes. |
| 7 | Seguridad | ✅ | Revisados de nuevo los 6 vectores pedidos: almacenamiento persistente (sin cambios, RN-01), fuga de `Authorization` (sin cambios, RN-05), carrera de renovaciones (RN-06 + RN-19), bucles (D-10, D-39), XSS (riesgo residual Media, HLT-09), sesión fantasma (RN-16 ampliada + V2-01). |
| 8 | Cobertura | ✅ | Matriz H4 con RN-19, RN-20 y RN-21. |
| 9 | Determinismo | ✅ | D-38 y D-39 cerradas con nombres, firmas y alternativa. |
| 10 | Ejecutabilidad por agente | ✅ | 38 tareas; T-37 y T-38 con archivos y criterios; orden topológico actualizado. |

**Veredicto final (vigente): APROBADO.** El HLT v2 es ejecutable sin decisiones propias del agente. Las observaciones OBS-01 a OBS-04 no bloquean la ejecución y su efecto está acotado y registrado.

### Inventario de envíos de id de usuario (estado actual, verificado)

| Servicio `ruta:línea` | Envío actual | Store `ruta:línea` | Llamadores `ruta:línea` | Tarea |
|-----------------------|--------------|--------------------|-------------------------|-------|
| `paginas/configuracion/servicios/cuentas.service.ts:28-31` | `GET cuentas/obtener?id=${usuarioId}` | `cuentaStore.ts:50-54` | `cuentas.page.ts:105`, `operativa-kelly.page.ts:49`, `seleccionar-cuentas.page.ts:56`, `mostrar-criterio-kelly.page.ts:130`, `bitacora.page.ts:129`, `bitacora-fin.page.ts:84`, `bitacora-seguimiento.page.ts:75` | T-25 |
| `cuentas.service.ts:21-26` (cuerpo `CrearCuenta`) | `cue_usuarioId` (`Cuentas.modelo.ts:22`) | `cuentaStore.ts:70-87` | `cuentas.page.ts:149` | T-25 |
| `cuentas.service.ts:34-39` (cuerpo `CapitalModelo`) | `cap_usuarioId` (`Capital.modelo.ts:3`) | `cuentaStore.ts:165-175` | `cuentas.page.ts:281` | T-25 |
| `cuentas.service.ts:41-48` (cuerpo `ActualizarNombreCuenta`) | `cue_usuarioId` (`Cuentas.modelo.ts:28`) | `cuentaStore.ts:107-111` | `cuentas.page.ts:188` | T-25 |
| `cuentas.service.ts:50-57` (cuerpo `EliminarCuenta`) | `cue_usuarioId` (`Cuentas.modelo.ts:34`) | `cuentaStore.ts:133-143` | `cuentas.page.ts:215`, `:222`, `:227` | T-25 |
| `paginas/criterioKelly/servicios/criterio-kelly.service.ts:12-19` | `{ cke_usuarioId }` | `criterioKellyStore.ts:42-46` | `mostrar-criterio-kelly.page.ts:131` | T-26 |
| `paginas/criterioKelly/servicios/resultados.service.ts:12-17` | `{ cke_usuarioId }` | `resultadosStore.ts:37-41` | `mostrar-criterio-kelly.page.ts:132` | T-26 |
| `paginas/planTrading/servicios/bitacora.service.ts:17-22` | cuerpo `any` con `bit_usuarioId` | `bitacoraStore.ts:49-53` | `bitacora.page.ts:137-140`, `:149-152`; `bitacora-fin.page.ts:93-96`, `:105-108`; `bitacora-seguimiento.page.ts:83-86`, `:95-98` | T-27 |
| `bitacora.service.ts:24-31` (cuerpo `RegistroBitacoraModelo`) | `bit_usuarioId` (`Bitacora.modelo.ts:25`) | `bitacoraStore.ts:69-79` | `bitacora.page.ts:169` | T-27 |
| `bitacora.service.ts:39-46` (cuerpo `ActualizarBitacoraFinalModelo`) | `bit_usuarioId` (`Bitacora.modelo.ts:56`) | `bitacoraStore.ts:130-134` | `bitacora-fin.page.ts:174` | T-27 |
| `paginas/planTrading/servicios/comentarios.service.ts:22-27` | `?id=` (id de **bitácora**, D-36) | `comentariosStore.ts:40-44` | `bitacora.page.ts:267`, `bitacora-seguimiento.page.ts:211` | T-28 |
| `paginas/reportes/servicios/reportes.service.ts:18-25`, `:27-34`, `:36-43` | `{ cke_usuarioId }` | `reportesStore.ts:36-40`, `:55-59`, `:72-76` | `operativas.page.ts:45`, `analisis.page.ts:49`, `:50` | T-29 |
| `paginas/suscripcion/servicios/planes.service.ts:18-22` | `planes/suscritos/${idUsuario}` | `PlanesStore.ts:72-76` | sin llamadores | T-30 |
| `paginas/suscripcion/servicios/suscripcion.service.ts:20-26` | `suscripcion/porUsuario/${idUsuario}` | `SuscripcionStore.ts:26-30` | sin llamadores | T-30 |
| `suscripcion.service.ts:28-35` (cuerpo `SuscripcionModelo`) | `sus_usuarioId` (`Suscripcion.modelo.ts:3`) | `SuscripcionStore.ts:69-73` | `registro.page.ts:234-250` | sin cambios (DE-01); T-31 lo verifica |
| `paginas/util/servicios/login.servicio.ts:22-26` | `autenticacion/usRol?id=${usuarioId}` | `loginStore.ts:49` | `login.page.ts:106` | T-23 (se elimina) |
| `paginas/configuracion/servicios/perfil.service.ts:19-26` (cuerpo `ActualizarPerfilRequest`) | `id` (`Perfil.modelo.ts:2`) | `perfilStore.ts:47-57` | `perfil.page.ts:196` | T-22 |
| `perfil.service.ts:28-33` (cuerpo `CambiarClaveRequest`) | `id` (`Perfil.modelo.ts:17`) | `perfilStore.ts:74-84` | `perfil.page.ts:208` | **HLT-08** (D-30) |
| `paginas/util/servicios/persona.service.ts:14-19` | ninguno | `personaStore.ts:36-42` | `registro.page.ts:153` | sin cambios |

### Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Los contratos que entreguen HLT-04 y HLT-05 difieren de D-24 (cuerpos y rutas sin id), porque se redactan en paralelo | **Alta** | T-01 compara los HLT/reportes y hace `curl` de estado antes de tocar código; si difieren, `BLOQUEADA` y revisión del plan maestro en `-v2`. |
| Las actualizaciones de dependencias (Angular 20.3.35, `jspdf` 3→4, `xlsx` desde el CDN de SheetJS) rompen la build o las exportaciones PDF/Excel | **Alta** | Una tarea por dependencia (T-03 a T-06) con `ng build`; prueba manual de exportación PDF (`/operativas`, `/grafico-stadistico`) y Excel (`/analisis`) en T-36. |
| Cambio coordinado app + backends: entre HLT-03 y el final de HLT-07 la app local no puede usar los endpoints protegidos (ventana de transición del plan maestro §2) | **Alta** | No se despliega nada (plan maestro §5.8); HLT-07 se ejecuta inmediatamente después de HLT-04/05; T-36 prueba el flujo completo en local. |
| `Retry-After` no legible cross-origin (OBS-01) | Media | Texto de respaldo (D-27); el resultado real se registra en T-36. |
| XSS lee el access en memoria o usa la cookie para renovar | Media | Access de 15 min; sin sumideros HTML; CSP en HLT-09. |
| El almacenamiento seguro nativo no se puede probar hasta HLT-10 (sin proyectos `android/` ni `ios/`) | Media | Specs con `ES_PLATAFORMA_NATIVA = true` y el plugin simulado; prueba en dispositivo en HLT-10. |
| (v2) Navegador sin `navigator.locks`: dos pestañas pueden renovar a la vez y HLT-03 revoca la familia (A-04) | Baja | Web Locks existe en Chrome 69+, Firefox 96+ y Safari 15.4+; la consecuencia es volver a iniciar sesión, no una fuga (D-38). |
| (v2) Registro sin suscripción si HLT-05 protege `crearSinPago` (DE-01) | Media | Dependencia abierta con dueño (HLT-05/plan maestro); T-31 y T-36 paso 11 registran el estado real. |
| La recarga tras cerrar sesión (D-14) se nota visualmente | Baja | Solo ocurre al salir; es el mismo destino (`/login`). |
| Cierre de sesión por expiración con la red caída obliga a volver a iniciar sesión | Baja | El refresh nativo se conserva (D-16); en web la cookie sigue válida y la siguiente apertura restaura. |

### Observaciones (no bloqueantes) y contradicciones detectadas

- **OBS-01 · Plan maestro §4.2/E-06 (CorsConfig, HLT-02):** para que la app lea `Retry-After` en una petición cross-origin, el backend debe responder `Access-Control-Expose-Headers: Retry-After`. Ni E-06 ni §4.2 lo piden. Recomendación: agregarlo al contrato de `CorsConfig` en una versión `-v2` del plan maestro. Mientras tanto G-05 funciona con el texto de respaldo y el spec verifica el cálculo con la cabecera presente.
- **OBS-02 · `doc_modo_planificacion.md:134`** exige mantener "sesión en 3 claves de `localStorage` (`usuario`, `roles`, `autenticado`), sin JWT", lo que contradice HU-001 G-02 y DH-03. Prevalecen la HU y el plan maestro. Recomendación al usuario: actualizar esa regla del contrato de planificación (este HLT no lo modifica porque es el documento que rige la planificación).
- **OBS-03 · HU-001 H-04** dice `withCredentials` "únicamente hacia `renovar` y `cerrarSesion`"; el requerimiento de este HLT agrega `autenticar`. Se sigue el requerimiento (D-08): sin credenciales el navegador descarta el `Set-Cookie` de `autenticar`. El espíritu de H-04 (el refresh solo viaja en la cookie y JavaScript no lo lee) se cumple.
- **OBS-04 · Orden HLT-06 → HLT-08:** si HLT-06 se ejecuta antes que HLT-08, el formulario actual de cambio de clave (`perfil.page.ts:205-214`) deja de funcionar hasta HLT-08 (D-30). Es una ventana de transición en local, como la del plan maestro §2.
- **Contradicción menor:** `.claude/agents/desarrollador-ionic.md:42` pone la elección web/nativo "dentro del store" y `doc_modo_planificacion.md` RI-6 "en el llamador". En este HLT el store **es** el llamador de `AlmacenSeguroService`, así que ambas se cumplen.
- **Bugs que el plan atraviesa:** `porUsuario` con id en el segmento frente a `?id` del backend (se resuelve al quitar el id, D-24); `PlanesStore` escribía `planSeleccionado` sin lector (D-18); roles borrados en perfil (D-33); límite de PIN evadible (D-13); toast duplicado en login (D-20). Quedan **fuera**: `suscripcionPorID` inexistente, `echo` de `crearConPago`, `app.component.spec.ts` con `declarations` de un standalone.

- **Coordinación con HLT-08 (v2):** HLT-08 D-14 también reemplaza la navegación de `bloqueo.page.ts:113` por `ServicioInactividad.salir()`. HLT-07 lo hace antes (D-13); en HLT-08 esa tarea queda como verificación. La observación O-08-2 de HLT-08 (registro → `crearSinPago` sin token) queda resuelta por D-25. La observación O-08-1 (recargar una ruta privada entra sin PIN) no cambia con este HLT: D-12 solo pide PIN al abrir en `/login`.
- **Coordinación con HLT-03 (v2):** las restricciones R-05 (pestañas), R-11 (`CapacitorHttp`), RN-21 (canal), D-25 (cuerpo `{}`), D-26 (`cerrarSesion` con access), D-27 (`cerrarTodas` sin cookie) están incorporadas.

Preguntas bloqueantes al usuario: **ninguna**.

---

## H7. Plan de tareas

Todas las tareas se ejecutan desde `criterioKellyApp/` (salvo T-33, que también toca `.claude/agents/`). Comandos de verificación comunes:

- `BUILD` = `npx ng build --configuration development` (código de salida 0).
- `LINT` = `npx ng lint` (sin errores nuevos respecto de la línea base de T-01).
- `TEST(x)` = `npx ng test --watch=false --browsers=ChromeHeadless --include='**/x.spec.ts'` (todos los casos en verde).

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|--------|
| T-01 | `desarrollador-ionic` | Verificar precondiciones y registrar la línea base | Ninguno (solo lectura). Lee `docs/Planificacion/HLT-03-*.md`, `HLT-04-*.md`, `HLT-05-*.md` y sus reportes | — | (1) Los reportes de HLT-03, HLT-04 y HLT-05 dicen `COMPLETADO`. (2) Los HLT/reportes confirman: respuesta de `autenticar`/`renovar` como §4.5 con `accessExpira` ISO 8601 UTC; HLT-03 D-25 (cuerpo `{}`), D-26 (`cerrarSesion` revoca por el access), D-27 (`cerrarTodas` sin cookie) y RN-21 (canal fijo) sin cambios; HLT-04 H5.1 (`GET cuentas/obtener` sin id, `criterioKelly/*` con `{}`, `bitacora/listBitacora` con `{ bit_cueIdCuentas }`); HLT-05: `GET planes/suscritos` y `GET suscripcion/porUsuario` sin id; ninguna petición de D-23 exige `*_usuarioId`. El contrato de `crearSinPago` **no** se exige (DE-01): solo se anota lo que diga HLT-05. (3) `curl -s http://localhost/criterio_kelly/rest_usuario/` responde `{"servicio":…,"estado":"activo"}`. (4) Se guardan las salidas de `LINT`, `npx ng test --watch=false --browsers=ChromeHeadless` y `BUILD` como línea base. Si (1) o (2) falla → `BLOQUEADA` con la diferencia exacta | D-24, J-06 |
| T-02 | `desarrollador-ionic` | Instalar el plugin de almacenamiento seguro | `package.json:15-44`, `package-lock.json` | T-01 | `npm install --legacy-peer-deps --save-exact @aparajita/capacitor-secure-storage@7.1.0` termina en 0; `package.json` muestra `"@aparajita/capacitor-secure-storage": "7.1.0"`; `npm ls @capacitor/core` muestra una sola versión `7.4.0` (las demás `deduped`); `grep -cE "setItem\|getItem\|removeItem\|setSynchronize" node_modules/@aparajita/capacitor-secure-storage/dist/esm/definitions.d.ts` ≥ 4. Si `npm ls` muestra dos versiones de `@capacitor/core`: desinstalar y aplicar la alternativa D-01 (`capacitor-secure-storage-plugin@0.12.0`), registrando la desviación | RN-04, I-02, D-01 |
| T-03 | `desarrollador-ionic` | Actualizar Angular a 20.3.35 | `package.json:16-23`, `package.json:58`, `package.json:59`, `package-lock.json` | T-02 | `npm install --legacy-peer-deps --save-exact @angular/animations@20.3.35 @angular/common@20.3.35 @angular/compiler@20.3.35 @angular/core@20.3.35 @angular/forms@20.3.35 @angular/platform-browser@20.3.35 @angular/platform-browser-dynamic@20.3.35 @angular/router@20.3.35` y `npm install --legacy-peer-deps --save-dev --save-exact @angular/compiler-cli@20.3.35 @angular/language-service@20.3.35` terminan en 0; `npm ls @angular/core` → `20.3.35`; `BUILD` OK | RN-15, D-28 |
| T-04 | `desarrollador-ionic` | Actualizar `jspdf` y `jspdf-autotable` | `package.json:34-35`, `package-lock.json` | T-03 | `npm install --legacy-peer-deps jspdf@4.2.1 jspdf-autotable@5.0.9` termina en 0; `BUILD` OK (sin errores en `operativas.page.ts:10-11`, `:123` ni `grafico-stadistico.page.ts:7`) | RN-15, D-28 |
| T-05 | `desarrollador-ionic` | Reemplazar `xlsx` por el paquete oficial de SheetJS | `package.json:41`, `package-lock.json` | T-04 | `npm install --legacy-peer-deps https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` termina en 0; `package.json` muestra `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`; `BUILD` OK (sin errores en `exportarExcel.service.ts:2`) | RN-15, D-28 |
| T-06 | `desarrollador-ionic` | Mover `glob` y `rimraf` a `devDependencies` | `package.json:32`, `package.json:38`, `package-lock.json` | T-05 | `grep -rnE "from 'glob'\|from 'rimraf'\|require\('(glob\|rimraf)'\)" src` da 0 líneas; `npm uninstall --legacy-peer-deps glob rimraf` y `npm install --legacy-peer-deps --save-dev glob@^11.1.0 rimraf@^6.0.1` terminan en 0; `BUILD` OK | RN-15, D-28 |
| T-07 | `desarrollador-ionic` | Corregir transitivas y verificar la auditoría | `package-lock.json` | T-06 | `npm audit fix --legacy-peer-deps` (sin `--force`) termina; `npm audit --omit=dev` no lista `high` ni `critical`; `BUILD` OK. Si queda alguna alta o crítica → `BLOQUEADA` con la salida completa (RD-6) | RN-15, F-06 |
| T-08 | `desarrollador-ionic` | Crear los tres entornos y la configuración `staging` | `src/environments/environment.ts:1-19` (reemplazo completo), `src/environments/environment.prod.ts:1-6` (reemplazo completo), `src/environments/environment.staging.ts` (nuevo), `angular.json:51-72`, `angular.json:89-99` | T-07 | Los 3 archivos exportan `environment` con exactamente `production`, `entorno`, `apiUrlLoge`, `apiUrlCritKell`, `apiUrlSuscripcion` y los valores de D-26; las 9 URLs terminan en `/`; `angular.json` tiene `build.configurations.staging` (budgets y `outputHashing` iguales a `production`, `fileReplacements` → `environment.staging.ts`) y `serve.configurations.staging` → `app:build:staging`; `npx ng build --configuration staging` y `npx ng build --configuration production` terminan en 0; `grep -c "http://" src/environments/environment.staging.ts src/environments/environment.prod.ts` → `0` y `0` | RN-12, G-10, D-26 |
| T-09 | `desarrollador-ionic` | Crear los contratos compartidos de sesión | `src/app/compartidos/modelos/sesion.modelo.ts` (nuevo: `RespuestaSesion`, `SolicitudRenovacion`, `RespuestaExitosa`, `EstadoRestauracion = 'pendiente' \| 'en_curso' \| 'finalizada'`), `src/app/compartidos/modelos/error-api.ts` (nuevo: `ErrorApi`), `src/app/compartidos/interceptors/sesion-http.ts` (nuevo, D-37), `src/app/compartidos/servicios/plataforma.ts` (nuevo: `ES_PLATAFORMA_NATIVA`, D-21) | T-08 | `BUILD` OK; `LINT` OK; `RespuestaSesion` tiene `id: number`, `nombres: string`, `apellidos: string`, `roles: Rol[]` (de `paginas/util/modelos/Rol.modelo.ts`), `accessToken: string`, `accessExpira: string`, `refreshToken?: string` | RN-01, RN-03, RN-05, D-06, D-21, D-37 |
| T-10 | `desarrollador-ionic` | Crear `AlmacenSeguroService` | `src/app/compartidos/servicios/almacen-seguro.service.ts` (nuevo) | T-09 | Métodos `guardarRefresh(valor): Promise<void>`, `leerRefresh(): Promise<string \| null>`, `eliminarRefresh(): Promise<void>` (con `SecureStorage.setItem/getItem/removeItem` y `setSynchronize(false)` una sola vez antes del primer uso, clave constante `CLAVE_REFRESH = 'ck_refresh'`; si `ES_PLATAFORMA_NATIVA` es `false` resuelven sin llamar al plugin) y `marcarCierrePendiente()`, `hayCierrePendiente(): boolean`, `limpiarCierrePendiente()` sobre `localStorage` con `CLAVE_CIERRE_PENDIENTE = 'ck_cierre_pendiente'`; sin estado de dominio; `BUILD` OK | RN-04, RN-16, D-15, D-21 |
| T-11 | `desarrollador-ionic` | Crear `SesionService` | `src/app/compartidos/servicios/sesion.service.ts` (nuevo) | T-09 | Solo inyecta `HttpClient`; métodos `autenticar(credenciales: LoginRequest)`, `renovar(solicitud: SolicitudRenovacion)` (contexto `OMITIR_MANEJO_ERROR = true`), `cerrarSesion()` (cuerpo `{}`, sin cabecera `Authorization` propia, contexto `OMITIR_MANEJO_ERROR = true`), `cerrarTodas()` (cuerpo `{}`), todos `POST` a las URL de `sesion-http.ts`; `grep -n "inject(" src/app/compartidos/servicios/sesion.service.ts` → 1 línea (`HttpClient`); `grep -n "Authorization" src/app/compartidos/servicios/sesion.service.ts` → 0; `BUILD` OK | RN-03, RN-13, D-09, D-22 |
| T-12 | `desarrollador-ionic` | Crear `SesionStore` | `src/app/compartidos/store/sesion.store.ts` (nuevo) | T-10, T-11, T-37 | Estado `{ usuario: UsuarioApp \| null, roles: Rol[], accessToken: string \| null, accessExpira: string \| null, estadoRestauracion: EstadoRestauracion, renovando: boolean, cerrandoSesion: boolean, cierreRemoto: boolean, estadoUltimoError: number \| null, loading: boolean, error: string \| null }`; computeds `isLoading`, `errorMessage`, `estaAutenticado` (D-39), `restauracionFinalizada`, `estaRestaurando` (ninguno repite un nombre del estado); `rxMethod`: `iniciarSesion`, `restaurarSesion`, `cerrarSesion`, `cerrarTodasLasSesiones`; métodos síncronos: `limpiarSesionLocal`, `actualizarDatosUsuario`, `confirmarCierreRemoto` (pone `cierreRemoto: false`); métodos que devuelven `Observable`: `renovarSesion`, `renovacionEnCurso` (D-03); `withHooks.onInit` con la suscripción a `CoordinadorPestanasService.mensajes$` (D-38); en web `renovarSesion` usa `ejecutarExclusivo(NOMBRE_BLOQUEO_RENOVACION, …)` y publica `sesion-renovada`; `cerrarSesion` y `cerrarTodasLasSesiones` publican `sesion-cerrada` en `finalize`; en nativo, `renovar` solo con refresh guardado y cuerpo `{ refreshToken }` (RN-21); reglas D-04 a D-16, D-38 y D-39 implementadas como en H3; `BUILD` OK | RN-01, RN-03, RN-04, RN-06, RN-10, RN-16, RN-19, RN-21, D-03, D-11, D-14, D-15, D-16, D-32, D-38, D-39 |
| T-13 | `desarrollador-ionic` | Escribir las pruebas de la capa de sesión | `src/app/compartidos/store/sesion.store.spec.ts` (nuevo), `src/app/compartidos/servicios/almacen-seguro.service.spec.ts` (nuevo) | T-12 | `TEST(sesion.store)` y `TEST(almacen-seguro.service)` en verde con, como mínimo, estos casos: login web guarda el token en el estado y no llama `Storage.prototype.setItem` ni `guardarRefresh`; login nativo llama `guardarRefresh`; dos `renovarSesion()` simultáneas producen 1 `POST renovar` (`HttpTestingController`) y ambas reciben el mismo token; `renovar` nativo envía `{ refreshToken }` y guarda el refresh rotado; 401 de `renovar` en nativo llama `eliminarRefresh` y un 0 no; `cerrarSesion` con 500 deja `estaAutenticado() === false` y en web marca el cierre pendiente; `restaurarSesion()` llamada 2 veces produce 1 petición; con cierre pendiente, `restaurarSesion` hace `renovar` + `cerrarSesion` y termina sin sesión; con `ES_PLATAFORMA_NATIVA = false` el plugin simulado no recibe llamadas. Casos v2: durante `cerrarSesion` `estaAutenticado()` es `false` y al terminar (éxito, 500 o `EMPTY`) la sesión queda limpia y se publicó `sesion-cerrada`; en web `renovarSesion` llama a `ejecutarExclusivo('ck-renovar-sesion', …)` (doble de `CoordinadorPestanasService`); si mientras espera llega `sesion-renovada` del mismo usuario, termina con ese token y hay 0 `POST renovar`; un `sesion-renovada` de otro `usuario.id` se ignora; `sesion-cerrada` limpia la sesión y deja `cierreRemoto() === true`; nativo sin refresh → 0 peticiones; nativo → cuerpo `{ refreshToken }`; web → cuerpo `{}`; `accessExpira` se guarda igual a la cadena recibida (`'2026-11-02T15:00:00+00:00'`) | RN-01, RN-03, RN-04, RN-06, RN-10, RN-16, RN-19, RN-21 |
| T-14 | `desarrollador-ionic` | Adaptar `errorInterceptor` | `src/app/compartidos/interceptors/error.interceptor.ts:6-56` | T-09 | Implementa D-06 y D-27: contexto `OMITIR_MANEJO_ERROR` y 401 con `Authorization` relanzan el `HttpErrorResponse` sin toast; 429 se calcula con `Retry-After` antes del mensaje del servidor; el texto por defecto de 403 pasa a `Acceso denegado` (`:26-28`); el `case 422` (`:38-40`) no cambia; el error relanzado es `ErrorApi(mensaje, error.status)` (`:53`); `BUILD` OK | RN-09, RN-14, D-06, D-27 |
| T-15 | `desarrollador-ionic` | Escribir las pruebas de `errorInterceptor` | `src/app/compartidos/interceptors/error.interceptor.spec.ts` (nuevo) | T-14 | `TEST(error.interceptor)` en verde con: 429 + `Retry-After: 45` → `…en 45 segundos.`; 429 + `Retry-After: 120` → `…en 2 minutos.`; 429 sin cabecera → mensaje del servidor; 403 sin cuerpo → `Acceso denegado`; 401 con `Authorization` → 0 toasts y `HttpErrorResponse` con `status 401`; contexto `OMITIR_MANEJO_ERROR` → 0 toasts; 422 → texto actual; 500 → `ErrorApi` con `estado 500` | RN-09, RN-14 |
| T-16 | `desarrollador-ionic` | Crear `autenticacionInterceptor` | `src/app/compartidos/interceptors/autenticacion.interceptor.ts` (nuevo) | T-12, T-14 | Funcional (`HttpInterceptorFn`); implementa RN-05 a RN-07, D-04, D-05, D-08, D-09, D-10: URL fuera de `URLS_API` → `next(req)` sin cambios; cabeceras `X-Requested-With`/`X-Cliente`; `withCredentials` solo en web y solo en las 3 URL (D-08); `cerrarSesion` y `cerrarTodas` renuevan ante 401 (D-10); el toast y la navegación de expiración solo si `estaAutenticado()` era `true` (D-39); espera `renovacionEnCurso()` antes de enviar; ante 401 elegible renueva una vez o reintenta con el token actual; reintento marcado con `ES_REINTENTO_AUTENTICACION`; fallo → `limpiarSesionLocal`, 1 toast `Tu sesión expiró, vuelve a iniciar sesión` (`warning`), `navigateByUrl('/login', { replaceUrl: true })` salvo en `/login` o `/registro`, devuelve `EMPTY`; `BUILD` OK | RN-05, RN-06, RN-07, E-07 |
| T-17 | `desarrollador-ionic` | Escribir las pruebas de `autenticacionInterceptor` | `src/app/compartidos/interceptors/autenticacion.interceptor.spec.ts` (nuevo) | T-16 | `TEST(autenticacion.interceptor)` en verde con: URL `https://tercero.example/x` sin `Authorization`, `X-Requested-With` ni `X-Cliente`; cada `apiUrl*` con `X-Requested-With: CriterioKelly`; `Authorization` presente en `cuentas/obtener` y ausente en `autenticar` y `renovar`; `X-Cliente: nativo` solo con `ES_PLATAFORMA_NATIVA = true`; `withCredentials` `true` solo en las 3 URL; 3 peticiones concurrentes con 401 → 1 `renovar` y 3 reintentos con el token nuevo; 401 en el reintento → sin segunda renovación, 1 toast y 1 navegación; renovación fallida con `router.url = '/login'` → 0 navegaciones; 401 de `autenticar` → sin renovación; 401 de `renovar` → sin renovación; 400 y 403 de una petición con `Authorization` → sin renovación; 401 con token ya reemplazado → reintento sin renovar. Casos v2: con `ES_PLATAFORMA_NATIVA = true`, `withCredentials === false` en `autenticar`, `renovar` y `cerrarSesion`; `cerrarSesion` con 401 → 1 `renovar` → reintento con el token nuevo; `cerrarSesion` con renovación fallida mientras `cerrandoSesion` es `true` → 0 toasts y 0 navegaciones | RN-03, RN-05, RN-06, RN-07, RN-10, RN-21 |
| T-18 | `desarrollador-ionic` | Registrar el interceptor y la restauración en el arranque | `src/main.ts:4-5`, `src/main.ts:17-24` | T-16 | `main.ts:22` queda `provideHttpClient(withInterceptorsFromDi(), withInterceptors([autenticacionInterceptor, errorInterceptor]))`; se agrega `provideAppInitializer(() => { inject(SesionStore).restaurarSesion(); })`; `grep -n "autenticacionInterceptor, errorInterceptor" src/main.ts` → 1 línea; `BUILD` OK | RN-05, RN-08, D-07, D-11 |
| T-19 | `desarrollador-ionic` | Hacer que las guardas esperen la restauración | `src/app/compartidos/seguridades/GuardAutenticacion.ts:1-20`, `src/app/compartidos/seguridades/GuardRoles.ts:1-39`, `src/app/compartidos/seguridades/guard-autenticacion.spec.ts` (nuevo) | T-18 | Ambas inyectan `SesionStore`, llaman `restaurarSesion()` y devuelven `Observable<boolean \| UrlTree>` según D-11 (`GuardRoles` mantiene la lógica de `:20-37` y su redirección a `/acceso-denegado`); `TEST(guard-autenticacion)` en verde: no emite con `en_curso`, emite `true` con sesión y `UrlTree('/login')` sin sesión; `BUILD` OK | RN-08, G-04 |
| T-20 | `desarrollador-ionic` | Adaptar el cierre de sesión por menú, encabezado, inactividad y bloqueo | `src/app/compartidos/seguridades/ServicioInactividad.ts:1-60`, `src/app/paginas/configuracion/bloqueo/bloqueo.page.ts:31-38`, `bloqueo.page.ts:113` | T-18 | `ServicioInactividad` inyecta `SesionStore`, `UtilitariosService` y `Location`; `salir()` sigue el Flujo D; nuevo método público `finalizarSalida()`; deja de usar `ServicioAutenticacion.logout`; el temporizador (`:11`, `:42-51`) no cambia; `bloqueo.page.ts:113` llama a `await this.servicioInactividad.salir()` (D-13); `BUILD` OK | RN-10, RN-14, RN-17, D-13, D-14 |
| T-21 | `desarrollador-ionic` | Adaptar `AppComponent` al estado de `SesionStore` | `src/app/app.component.ts:6`, `:22`, `:31`, `:46-53`, `:66-68` | T-18, T-20 | `autenticado` pasa a ser `this.sesionStore.estaAutenticado`; un `effect` llama `menuStore.cargarMenu()` cuando pasa a `true`; otro `effect`, cuando `sesionStore.cierreRemoto()` es `true`, llama `sesionStore.confirmarCierreRemoto()` y `servicioInactividad.finalizarSalida()` (V2-08); se elimina la suscripción a `autenticado$` y la inyección de `ServicioAutenticacion`; `mostrarMenu` (`:36-39`), `inicializarDB` (`:93-100`) y `salir` (`:102-104`) sin cambios de comportamiento; `BUILD` OK | RN-13, G-02 |
| T-22 | `desarrollador-ionic` | Adaptar el perfil (sin id y con cierre en todos los dispositivos) | `src/app/paginas/configuracion/modelos/Perfil.modelo.ts:1-6`, `src/app/paginas/configuracion/perfil/perfil.page.ts:1-23`, `:36-44`, `:64-92`, `:193-203`, `src/app/paginas/configuracion/perfil/perfil.page.html:137-144` | T-20 | `ActualizarPerfilRequest` sin `id`; `actualizarPerfil()` no envía id; el `effect` de `:64-92` usa `sesionStore.actualizarDatosUsuario(...)` (D-33); se eliminan las referencias a `LoginStore` (`:22`, `:43`); nueva sección "Sesiones" en el HTML tras `:143` con un `ion-button` "Cerrar sesión en todos los dispositivos" que dispara el Flujo E (confirmación con `AlertController`); `cambiarContrasena()` (`:205-214`) sin cambios (D-30); `grep -n "LoginStore" src/app/paginas/configuracion/perfil/perfil.page.ts` → 0; `BUILD` OK | RN-10, RN-11, G-06, D-30, D-33 |
| T-23 | `desarrollador-ionic` | Adaptar el flujo de login | `src/app/paginas/util/store/loginStore.ts:1-79` (reescritura según D-20), `src/app/paginas/util/servicios/login.servicio.ts` (se elimina), `src/app/paginas/util/login/login.page.ts:19`, `:43`, `:47`, `:49`, `:59-61`, `:102-143`, `src/app/paginas/util/login/login.page.html:82`, `src/app/paginas/util/store/login.store.spec.ts` (nuevo) | T-19, T-22 | `LoginPage` usa `SesionStore.iniciarSesion` y `LoginStore.registrarResultado(SS.estadoUltimoError())`; elimina el toast de `:113-116` y la llamada a `setUsuarioAutenticado` (`:132-136`); conserva el toast de intentos agotados y `App.exitApp()` (`:119-127`), `validarPIN()` y `mostrarModalPIN()` (`:145-170`); `ionViewWillEnter` aplica D-12; el botón de `login.page.html:82` también se deshabilita con `estaRestaurandoSesion()`; `test -f src/app/paginas/util/servicios/login.servicio.ts` falla; `grep -rn "LoginServicio\|usRol" src/app` → 0; `TEST(login.store)` en verde (3 × 401 → `intentosAgotados() === true`; 429 y 0 no suman); `BUILD` OK | RN-11, RN-14, RN-17, D-12, D-20 |
| T-24 | `desarrollador-ionic` | Convertir `ServicioAutenticacion` en fachada sin `localStorage` | `src/app/compartidos/seguridades/ServicioAutenticacion.ts:1-128` (reescritura), `src/app/compartidos/seguridades/servicio-autenticacion.spec.ts` (nuevo) | T-20, T-21, T-22, T-23 | API pública según D-17, delegando en `SesionStore`; constructor con `limpiarDatosHeredados()` (D-19); `grep -n "localStorage" src/app/compartidos/seguridades/ServicioAutenticacion.ts` solo muestra `removeItem`; `grep -rnE "setUsuarioAutenticado\|autenticado\\$\|usuarioActual\\$\|rolUsuario\\$\|\.logout\(" src/app` → 0; `TEST(servicio-autenticacion)` en verde (borra las 4 claves heredadas; `rolEspecifico`, `otrosRoles`, `todosLosRoles`, `isSuperAdmin`, `esAdministrador` leen los roles de `SesionStore`); `BUILD` OK | RN-02, RN-13, D-17, D-19 |
| T-25 | `desarrollador-ionic` | Dejar de enviar el id de usuario en cuentas y capital | `src/app/paginas/configuracion/modelos/Cuentas.modelo.ts:14`, `:22`, `:28`, `:34`; `src/app/paginas/configuracion/modelos/Capital.modelo.ts:3`; `src/app/paginas/configuracion/servicios/cuentas.service.ts:28-32`; `src/app/paginas/configuracion/store/cuentaStore.ts:50-54`, `:87`; `src/app/paginas/configuracion/cuentas/cuentas.page.ts:105`, `:149`, `:188`, `:215`, `:222`, `:227`, `:281`; `src/app/paginas/configuracion/operativa-kelly/operativa-kelly.page.ts:49`, `:58`, `:100`, `:175`, `:190`, `:194`, `:202`, `:217`, `:221`, `:229`; `src/app/compartidos/seleccionar-cuentas/seleccionar-cuentas.page.ts:56`; `src/app/paginas/criterioKelly/mostrar-criterio-kelly/mostrar-criterio-kelly.page.ts:130`; `src/app/paginas/planTrading/bitacora/bitacora.page.ts:129`; `src/app/paginas/planTrading/bitacora-fin/bitacora-fin.page.ts:84`; `src/app/paginas/planTrading/bitacora-seguimiento/bitacora-seguimiento.page.ts:75` | T-24 | `obtenerCuentas()` sin parámetro y URL `cuentas/obtener`; `cargarCuentas: rxMethod<void>` y llamadores `cargarCuentas()`; modelos según D-23; `cuentaStore.ts:87` deja de copiar `cue_usuarioId`; en `cuentas.page.ts:222`, `:227` y en `operativa-kelly.page.ts` las claves locales usan `this.usuarioActual()`; `grep -rnE "cue_usuarioId\|cap_usuarioId" src/app/paginas/configuracion/servicios src/app/paginas/configuracion/store src/app/paginas/configuracion/cuentas src/app/paginas/configuracion/operativa-kelly` → 0; `BUILD` OK | RN-11, D-23 |
| T-26 | `desarrollador-ionic` | Dejar de enviar el id de usuario en Criterio Kelly y resultados | `src/app/paginas/criterioKelly/servicios/criterio-kelly.service.ts:12-19`; `src/app/paginas/criterioKelly/servicios/resultados.service.ts:12-17`; `src/app/paginas/criterioKelly/store/criterioKellyStore.ts:42-46`; `src/app/paginas/criterioKelly/store/resultadosStore.ts:37-41`; `src/app/paginas/criterioKelly/mostrar-criterio-kelly/mostrar-criterio-kelly.page.ts:131-132` | T-25 | Servicios sin parámetro y cuerpo `{}`; `rxMethod<void>`; llamadores sin argumento; `grep -n "cke_usuarioId" src/app/paginas/criterioKelly/servicios/*.ts src/app/paginas/criterioKelly/store/*.ts` → 0; `BUILD` OK | RN-11 |
| T-27 | `desarrollador-ionic` | Dejar de enviar el id de usuario en la bitácora | `src/app/paginas/planTrading/modelos/Bitacora.modelo.ts:25`, `:56` (+ nueva interfaz `FiltroBitacora`); `src/app/paginas/planTrading/servicios/bitacora.service.ts:17-22`; `src/app/paginas/planTrading/store/bitacoraStore.ts:49-53`; `src/app/paginas/planTrading/bitacora/bitacora.page.ts:137-140`, `:149-152`, `:169`; `src/app/paginas/planTrading/bitacora-fin/bitacora-fin.page.ts:93-96`, `:105-108`, `:174`; `src/app/paginas/planTrading/bitacora-seguimiento/bitacora-seguimiento.page.ts:83-86`, `:95-98` | T-26 | `obtenerListaBitacora(filtro: FiltroBitacora)` y `cargarBitacoras: rxMethod<FiltroBitacora>` (sin `any`); llamadores envían `{ bit_cueIdCuentas }`; `RegistroBitacoraModelo` y `ActualizarBitacoraFinalModelo` sin `bit_usuarioId`; `grep -n "bit_usuarioId" src/app/paginas/planTrading/servicios/*.ts src/app/paginas/planTrading/store/*.ts src/app/paginas/planTrading/bitacora*/*.ts` → 0; `BUILD` OK | RN-11, D-23 |
| T-28 | `desarrollador-ionic` | Renombrar el parámetro de observaciones a id de bitácora | `src/app/paginas/planTrading/servicios/comentarios.service.ts:22-27`; `src/app/paginas/planTrading/store/comentariosStore.ts:40-44` | T-27 | Parámetro `idBitacora` en servicio y store; URL `comentarios/observaciones?id=${idBitacora}` sin cambios; `grep -n "usuarioId" src/app/paginas/planTrading/servicios/comentarios.service.ts src/app/paginas/planTrading/store/comentariosStore.ts` → 0; `BUILD` OK | RN-11, D-36 |
| T-29 | `desarrollador-ionic` | Dejar de enviar el id de usuario en reportes | `src/app/paginas/reportes/servicios/reportes.service.ts:18-43`; `src/app/paginas/reportes/store/reportesStore.ts:36-40`, `:55-59`, `:72-76`; `src/app/paginas/reportes/analisis/analisis.page.ts:49-50`; `src/app/paginas/reportes/operativas/operativas.page.ts:45` | T-28 | 3 métodos sin parámetro y cuerpo `{}`; `rxMethod<void>`; llamadores sin argumento; `grep -n "cke_usuarioId" src/app/paginas/reportes/servicios/reportes.service.ts` → 0; `BUILD` OK | RN-11 |
| T-30 | `desarrollador-ionic` | Dejar de enviar el id de usuario en los listados de planes y suscripciones, y eliminar `planSeleccionado` (**modificada en v2**) | `src/app/paginas/suscripcion/servicios/planes.service.ts:18-22`; `src/app/paginas/suscripcion/servicios/suscripcion.service.ts:20-26`; `src/app/paginas/suscripcion/store/PlanesStore.ts:72-76`, `:96-100`; `src/app/paginas/suscripcion/store/SuscripcionStore.ts:26-30`; `src/app/paginas/suscripcion/planes/planes.page.ts:80`, `:90`, `:109` | T-29 | `obtenerPlanesSuscritos()` → `planes/suscritos`; `obtenerSuscripcionPorUsuario()` → `suscripcion/porUsuario`; `rxMethod<void>` en los dos listados; `guardarPlanEnLocalStorage` y sus 3 llamadas eliminados; `crearSuscripcion` (`suscripcion.service.ts:28-35`, `SuscripcionStore.ts:69-73`) y `Suscripcion.modelo.ts` **sin cambios** (DE-01); `grep -rn "localStorage" src/app/paginas` → 0; `grep -nE "idUsuario" src/app/paginas/suscripcion/servicios/planes.service.ts` → 0; `BUILD` OK | RN-02, RN-11, D-18, D-24 |
| T-31 | `desarrollador-ionic` | Verificar que el flujo de registro quedó sin cambios (DE-01) (**redefinida en v2**) | Ninguno (solo lectura) | T-30 | `git -C criterioKellyApp diff --stat -- src/app/paginas/suscripcion/registro src/app/paginas/suscripcion/modelos/Suscripcion.modelo.ts` → sin cambios; `grep -n "sus_usuarioId: idUsuario" src/app/paginas/suscripcion/registro/registro.page.ts` → 1 línea; se anota en la evidencia el contrato de `crearSinPago` que indique HLT-05 (o "HLT-05 sin publicar") | DE-01 |
| T-32 | `desarrollador-ionic` | Verificar globalmente RN-01, RN-02, RN-11 y RN-12 | Ninguno (solo lectura) | T-31 | Salidas registradas: (1) `grep -rn "localStorage" src/app` → solo `ServicioAutenticacion.ts` (`removeItem`) y `almacen-seguro.service.ts` (marca); (2) `grep -rnE "sessionStorage" src/app` → solo `sessionStorage.clear()` en `ServicioInactividad.ts`; (3) `grep -rnE "usuarioId\|idUsuario\|usRol" src/app/paginas/*/servicios src/app/compartidos/servicios` → solo `perfil.service.ts` no aparece (el `id` de `CambiarClaveRequest` es de HLT-08) y 0 líneas en total; (4) `grep -rnE "localhost\|/criterio_kelly/" src --include=*.ts \| grep -v src/environments` → 0; (5) `grep -rn "accessToken" src/app \| grep -vE "sesion\.(store\|modelo)\|autenticacion\.interceptor\|sesion\.service\|coordinador-pestanas\|\.spec\.ts"` → 0; (6) `grep -rn "CapacitorHttp" src capacitor.config.ts capacitor.config.json` → 0; (7) `grep -rn "refreshToken" src/app/compartidos/servicios/coordinador-pestanas.service.ts` → solo dentro del `Omit<…, 'refreshToken'>` del tipo de mensaje | RN-01, RN-02, RN-11, RN-12, RN-20, J-01 |
| T-33 | `desarrollador-ionic` | Actualizar `CLAUDE.md` de la app y el agente `desarrollador-ionic` | `criterioKellyApp/CLAUDE.md:40-49`, `:71-81`, `:116-124`, `:126-134`; `.claude/agents/desarrollador-ionic.md:48`, `:55`, `:72`, `:79-82` | T-32 | `CLAUDE.md` describe: `SesionStore`/`SesionService`/`AlmacenSeguroService`, el access solo en memoria, el refresh en cookie o Keychain/Keystore, `autenticacionInterceptor` antes de `errorInterceptor`, la restauración y las guardas, la fachada `ServicioAutenticacion`, los 3 entornos y `entorno`, la regla "los servicios no envían el id del usuario" y el plugin D-01; el agente cambia el ejemplo de `:79-82` a `this.cuentaStore.cargarCuentas()` sin id y agrega en "Estándares de código" la regla de no enviar ids de usuario, no usar `localStorage` para sesión y obtener la sesión de `SesionStore`; `grep -n "localStorage" criterioKellyApp/CLAUDE.md` no afirma que la sesión viva allí; `grep -c "SesionStore" criterioKellyApp/CLAUDE.md .claude/agents/desarrollador-ionic.md` ≥ 1 en cada uno | RN-18, §5.6 |
| T-34 | `desarrollador-ionic` | Actualizar el README y la guía de arquitectura de la app | `criterioKellyApp/README.md:26`, `:36`, `:190-195` (+ nueva sección "Ambiente local"); `criterioKellyApp/docs/doc_arquitectura.md:41-44`, `:95-98`, `:100-102`, `:136-150`, `:185-190`, `:266` | T-33 | README: sección "Sesión y seguridad" reescrita; sección "Ambiente local" con J-03 (`ionic serve --port=8100`, backends en `http://localhost/criterio_kelly/rest_<nombre>/`, cookie `ck_refresh` y verificación de `localStorage`), los 3 entornos y `npx ng build --configuration staging`; `doc_arquitectura.md` sin afirmaciones de sesión en `localStorage` ni de `usRol?id=`/`obtener?id=`/`{idUsuario}`; `grep -n "SesionStore" criterioKellyApp/README.md criterioKellyApp/docs/doc_arquitectura.md` ≥ 1 en cada uno | RN-18, §5.5, J-08 |
| T-35 | `desarrollador-ionic` | Ejecutar la verificación automatizada final | Ninguno (solo lectura) | T-34 | `LINT` sin errores nuevos frente a T-01; `npx ng test --watch=false --browsers=ChromeHeadless` sin fallos nuevos frente a T-01 y con los 8 specs nuevos en verde (incluido `coordinador-pestanas.service.spec.ts`); `BUILD`, `npx ng build --configuration staging` y `npx ng build --configuration production` en 0; `npm audit --omit=dev` sin `high`/`critical`; `grep -n "5 \* 60 \* 1000" src/app/compartidos/seguridades/ServicioInactividad.ts` → 1 línea; `grep -n "case 422" src/app/compartidos/interceptors/error.interceptor.ts` → 1 línea | RN-12, RN-14, RN-15, G-10 |
| T-36 | `desarrollador-ionic` | Probar el flujo completo en local (J-03) | Ninguno (solo lectura y observación) | T-35 | Con XAMPP activo y `ionic serve --port=8100`, en Chrome con DevTools, se registra el resultado de cada paso: (1) login con clave errónea 1 vez → 1 solo toast `Usuario o clave incorrectos`; (2) login correcto → modal de PIN si no existe → `/inicio`; respuesta de `autenticar` con `Set-Cookie: ck_refresh` (HttpOnly) y sin `refreshToken` en el cuerpo; (3) abrir Cuentas, Bitácora, Criterio Kelly, Reportes: en Network ninguna petición lleva id de usuario en query, ruta o cuerpo; todas llevan `Authorization` y `X-Requested-With`; (4) esperar `TOKEN_ACCESO_MINUTOS` (leído de `rest_usuario/.env`) + 30 s (si salta `/bloqueo`, ingresar el PIN) y abrir Cuentas → `401` → 1 `renovar` 200 → reintento 200, sin toast; (5) recargar `http://localhost:8100/cuentas` → `renovar` 200 antes de cargar la página, sin pasar por `/login`; (6) abrir `http://localhost:8100/` con la sesión viva → `/bloqueo`; 4 PIN erróneos → sesión cerrada y `/login`; (7) iniciar sesión y pulsar SALIR → `cerrarSesion` 200 y recarga en `/login`; recargar → `renovar` 401 sin toast; repetir dejando vencer el access antes de pulsar SALIR → `cerrarSesion` 401 → `renovar` 200 → `cerrarSesion` 200, sin toast; (8) en la consola `Object.keys(localStorage)` no contiene `usuario`, `roles`, `autenticado`, `planSeleccionado` ni `ck_cierre_pendiente`; (9) con dos perfiles de Chrome (A y B) con sesión, "Cerrar sesión en todos los dispositivos" en A → en B, abrir Cuentas → 1 toast `Tu sesión expiró, vuelve a iniciar sesión` y `/login`; (10) 6 logins fallidos seguidos → toast de 429; se registra si muestra el tiempo (OBS-01) o el texto de respaldo; (11) registro de un usuario nuevo desde `/planes` → se registra el resultado real de `persona/agregar` y de `suscripcion/crearSinPago` (código y toast) para DE-01, sin exigir éxito; (12) exportar PDF en `/operativas` y `/grafico-stadistico`, y Excel en `/analisis` → archivos descargados y abiertos sin error; (13) con dos **pestañas** del mismo perfil de Chrome y sesión activa, dejar vencer el access y abrir Cuentas en ambas casi a la vez → en total 1 `POST renovar` 200 entre las dos pestañas (la otra adopta la sesión), ninguna vuelve a `/login` y `SELECT COUNT(*) FROM sgen_auditoria WHERE aud_evento='REFRESH_REUTILIZADO'` (solo lectura) no aumenta; (14) pulsar SALIR en una pestaña → la otra recarga en `/login` sin interacción. Pasos 1 a 9, 12, 13 y 14 deben cumplirse; los pasos 10 y 11 registran el resultado real | J-03, RN-02 a RN-11, RN-14, RN-16, RN-17, RN-19, G-05, DE-01 |
| T-37 | `desarrollador-ionic` | Crear `CoordinadorPestanasService` (**nueva en v2**) | `src/app/compartidos/servicios/coordinador-pestanas.service.ts` (nuevo); `src/app/compartidos/modelos/sesion.modelo.ts` (agrega `MensajeSesion`) | T-09 | Implementa D-38: `ejecutarExclusivo<T>(nombre, tarea)`, `publicar(mensaje)`, `mensajes$`; constantes `NOMBRE_BLOQUEO_RENOVACION = 'ck-renovar-sesion'` y `NOMBRE_CANAL_SESION = 'ck-sesion'`; con `ES_PLATAFORMA_NATIVA = true` no crea el canal ni usa bloqueos; si `navigator.locks?.request` o `BroadcastChannel` no existen, degrada como D-38; sin estado de dominio; `grep -n "localStorage\|sessionStorage" src/app/compartidos/servicios/coordinador-pestanas.service.ts` → 0; `BUILD` OK | RN-19, D-38 |
| T-38 | `desarrollador-ionic` | Escribir las pruebas de `CoordinadorPestanasService` (**nueva en v2**) | `src/app/compartidos/servicios/coordinador-pestanas.service.spec.ts` (nuevo) | T-37 | `TEST(coordinador-pestanas.service)` en verde con: con un `navigator.locks` simulado (cola FIFO por nombre), dos `ejecutarExclusivo('ck-renovar-sesion', …)` lanzadas a la vez se ejecutan en serie (la segunda empieza después de que la primera resuelve); se llama `request` con `{ mode: 'exclusive' }`; sin `navigator.locks` la tarea se ejecuta directamente; con `ES_PLATAFORMA_NATIVA = true` no se llama `navigator.locks.request` ni se crea `BroadcastChannel`; `publicar` en una instancia llega a `mensajes$` de otra instancia (dos `BroadcastChannel` reales con el mismo nombre); un mensaje `sesion-renovada` publicado no contiene `refreshToken` | RN-19, D-38 |

No se requiere tarea de `IonicComponentes`: el único componente nuevo de la UI es un `ion-button` en `perfil.page.html`, ya re-exportado (`IonicComponentes.ts:6`, `:77`), y la confirmación usa `AlertController`, que no se importa por el barril. Tampoco se agrega una ruta lazy nueva ni una dependencia CommonJS (el plugin D-01 es ESM; si `BUILD` de T-02 emite la advertencia `CommonJS or AMD dependencies` para él, se agrega `@aparajita/capacitor-secure-storage` a `angular.json:19-29` dentro de T-02 y se registra).

Orden topológico de ejecución (v2): T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11 → T-37 → T-38 → T-12 → T-13 → T-14 → T-15 → T-16 → T-17 → T-18 → T-19 → T-20 → T-21 → T-22 → T-23 → T-24 → T-25 → T-26 → T-27 → T-28 → T-29 → T-30 → T-31 → T-32 → T-33 → T-34 → T-35 → T-36. Paralelizables (RS-3): T-10, T-11 y T-37; T-13 y T-14 (archivos distintos). Los IDs T-37 y T-38 se agregaron en v2 sin renumerar para conservar la trazabilidad con v1.

---

## H8. Reglas de implementación deterministas

Rigen **RI-1 a RI-11** de `doc_modo_planificacion.md` §10.1 y la arquitectura de `.claude/agents/desarrollador-ionic.md` (página orquestadora con las únicas inyecciones de UI, lógica en el store, servicios solo HTTP, componentes presentacionales con `input()`/`output()`). Además, para este HLT:

- **RS-SES-1 · Token solo en memoria:** el access y el refresh nunca se pasan a `localStorage`, `sessionStorage`, IndexedDB, SQLite, `console.*`, URLs, query strings ni mensajes de error. El único almacenamiento del refresh es `AlmacenSeguroService` en nativo.
- **RS-SES-2 · Un solo dueño del estado:** solo `SesionStore` hace `patchState` de la sesión. La fachada, las guardas, el interceptor y las páginas leen o llaman métodos del store.
- **RS-SES-3 · Plataforma:** se lee siempre de `ES_PLATAFORMA_NATIVA` (D-21). Prohibido `Capacitor.isNativePlatform()` o `getPlatform()` en el código nuevo de sesión.
- **RS-SES-4 · URLs:** solo las constantes de `sesion-http.ts` y `environment.apiUrl*`; ninguna URL escrita a mano (J-01).
- **RS-SES-5 · Comparación de URL:** `startsWith` contra las bases de `URLS_API` (terminadas en `/`) e igualdad estricta, sin query, para las URL de sesión. Prohibido `includes`, expresiones regulares o comparar solo el host.
- **RS-SES-6 · Mensajes fijos (español):** `Tu sesión expiró, vuelve a iniciar sesión`; `Acceso denegado`; `Demasiados intentos. Intente nuevamente en N segundos.` / `… en N minutos.`; `Demasiados intentos, intente nuevamente más tarde` (respaldo). Se declaran como constantes con nombre (CC-4).
- **RS-SES-7 · Toasts:** el interceptor de autenticación solo muestra el toast de RN-07, a través de `UtilitariosService.mostrarToast(mensaje, 'warning')`; todo lo demás va por `errorInterceptor` (RI-8).
- **RS-SES-8 · Pruebas:** se usan `provideHttpClient(withInterceptors([...]))` + `provideHttpClientTesting()` y `HttpTestingController`; el plugin se sustituye con un doble de `AlmacenSeguroService`; `ES_PLATAFORMA_NATIVA` se provee con `true` o `false` según el caso. Los specs nuevos usan `TestBed.configureTestingModule({ providers: [...] })`, no `declarations`.
- **RS-SES-9 · Dependencias:** `npm install` siempre con `--legacy-peer-deps`; versiones exactas de D-01 y D-28; nunca `npm audit fix --force`.
- **RS-SES-10 · Alcance:** prohibido tocar archivos de `rest_*`, `capacitor.config.ts`, `capacitor.config.json` o `doc_modo_planificacion.md` (RI-10).
- **RS-SES-11 · Sin `CapacitorHttp` (v2):** prohibido importar `CapacitorHttp` o activar `plugins.CapacitorHttp` en cualquier archivo; las peticiones nativas salen del WebView con `Origin` (HLT-03 R-11).
- **RS-SES-12 · Canal fijo (v2):** en nativo no hay `withCredentials` ni cookies; en web nunca se envía `refreshToken` en un cuerpo (HLT-03 RN-21).
- **RS-SES-13 · Entre pestañas (v2):** la única exclusión mutua entre pestañas es `navigator.locks` con `NOMBRE_BLOQUEO_RENOVACION`; la única difusión es `BroadcastChannel(NOMBRE_CANAL_SESION)`; los mensajes nunca incluyen `refreshToken`. Prohibido usar el evento `storage` o `localStorage` para coordinar pestañas.

Las excepciones registradas a RI-4/AR-4 (D-03) y a RI-6 (D-21) son las únicas permitidas.

---

## H9. Reglas de seguimiento de ejecución

Rigen §11 de `doc_modo_planificacion.md` (símbolos `⬜ ✅ ❌ ➖`, estados `PENDIENTE → EN_CURSO → HECHA | BLOQUEADA | OMITIDA`, reglas RS-1 a RS-9). En las tareas sin archivos de código (T-01, T-31, T-32, T-35, T-36), C4 y C5 se marcan `➖` con la justificación "tarea de verificación" salvo que el criterio de aceptación ejecute `ng lint` o `ng test`.

### Tablero de avance global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-13 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-14 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-15 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-16 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-17 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-18 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-19 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-20 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-21 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-22 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-23 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-24 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-25 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-26 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-27 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-28 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-29 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-30 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-31 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-32 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-33 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-34 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-35 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-36 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-37 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-38 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

### Fichas por tarea

Cada ficha usa el formato de §11.2. Todas empiezan así; el agente de implementación completa evidencia y notas.

```
T-01 — Verificar precondiciones y registrar la línea base
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-02 — Instalar el plugin de almacenamiento seguro
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-03 — Actualizar Angular a 20.3.35
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-04 — Actualizar jspdf y jspdf-autotable
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-05 — Reemplazar xlsx por el paquete oficial de SheetJS
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-06 — Mover glob y rimraf a devDependencies
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-07 — Corregir transitivas y verificar la auditoría
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-08 — Crear los tres entornos y la configuración staging
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-09 — Crear los contratos compartidos de sesión
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-10 — Crear AlmacenSeguroService
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-11 — Crear SesionService
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-12 — Crear SesionStore
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-13 — Escribir las pruebas de la capa de sesión
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-14 — Adaptar errorInterceptor
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-15 — Escribir las pruebas de errorInterceptor
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-16 — Crear autenticacionInterceptor
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-17 — Escribir las pruebas de autenticacionInterceptor
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-18 — Registrar el interceptor y la restauración en el arranque
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-19 — Hacer que las guardas esperen la restauración
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-20 — Adaptar el cierre de sesión por menú, encabezado, inactividad y bloqueo
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-21 — Adaptar AppComponent al estado de SesionStore
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-22 — Adaptar el perfil (sin id y con cierre en todos los dispositivos)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-23 — Adaptar el flujo de login
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-24 — Convertir ServicioAutenticacion en fachada sin localStorage
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-25 — Dejar de enviar el id de usuario en cuentas y capital
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-26 — Dejar de enviar el id de usuario en Criterio Kelly y resultados
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-27 — Dejar de enviar el id de usuario en la bitácora
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-28 — Renombrar el parámetro de observaciones a id de bitácora
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-29 — Dejar de enviar el id de usuario en reportes
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-30 — Dejar de enviar el id de usuario en los listados de planes y suscripciones, y eliminar planSeleccionado
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-31 — Verificar que el flujo de registro quedó sin cambios (DE-01)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-32 — Verificar globalmente RN-01, RN-02, RN-11 y RN-12
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-33 — Actualizar CLAUDE.md de la app y el agente desarrollador-ionic
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-34 — Actualizar el README y la guía de arquitectura de la app
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-35 — Ejecutar la verificación automatizada final
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-36 — Probar el flujo completo en local (J-03)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-37 — Crear CoordinadorPestanasService
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE

T-38 — Escribir las pruebas de CoordinadorPestanasService
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: PENDIENTE
  Notas / desviaciones: PENDIENTE
```

---

## H10. Diseño del reporte de ejecución

El agente de implementación entrega `docs/Planificacion/REPORTE-HLT-07-<AAAA-MM-DD>.md` con la estructura fija de §12.1 (RR-1 a RR-5):

```
REPORTE DE EJECUCIÓN — HLT-07 · Sesión en la app (criterioKellyApp)
  1. Resumen ejecutivo        (1–3 frases: qué se logró)
  2. Estado global            (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas        (copia del tablero de H9: estado + C1…C6 de T-01 a T-38)
  4. Cobertura vs. HLT        (RN-01…RN-21, DE-01 y criterios G-01…G-06, G-08, G-10, G-11, H-04, J-01, J-03, DH-03, DH-04, F-06, I-02 → resultado; ¿100 %?)
  5. Cambios realizados       (archivos ruta:línea, tipo de cambio: nuevo | modificado | eliminado)
  6. Verificaciones ejecutadas(comando → OK/FALLO + salida real: npm ls, npm audit, ng lint, ng test, ng build x3, greps de T-32, pasos 1–14 de T-36)
  7. Desviaciones y decisiones (respecto al HLT; incluye si se aplicó la alternativa D-01 y el resultado de los pasos 10 (OBS-01) y 11 (DE-01) de T-36)
  8. Pendientes / bloqueos     (checks en ⬜/❌ con acción requerida)
  9. Próximos pasos            (si estado ≠ COMPLETADO)
```

Reglas específicas de este HLT para el reporte:

- La sección 6 incluye la salida literal de `npm audit --omit=dev` (antes en T-01 y después en T-07) y de `npm ls @capacitor/core`.
- Los pasos de T-36 se reportan uno por uno con la petición observada en DevTools (método, URL, código) y el toast mostrado.
- El estado global es `COMPLETADO` solo si T-36 cumple los pasos 1 a 9, 12, 13 y 14; los pasos 10 y 11 se reportan con su resultado real y, si el 10 muestra el texto de respaldo o el 11 falla en la suscripción, se citan OBS-01 o DE-01 en la sección 7 sin bajar el estado.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

Rige §13 de `doc_modo_planificacion.md` completo (AR-1 a AR-6, CC-1 a CC-5, AF-1 a AF-4, IO-1 a IO-9) y la sección "Arquitectura obligatoria" y "Nombres" de `.claude/agents/desarrollador-ionic.md`. Aplicación concreta a este HLT:

| Artefacto | Archivo | Nombre | Capa |
|-----------|---------|--------|------|
| Store de sesión | `compartidos/store/sesion.store.ts` | `SesionStore` | Estado + lógica |
| Servicio HTTP de sesión | `compartidos/servicios/sesion.service.ts` | `SesionService` | Acceso a datos |
| Almacenamiento seguro | `compartidos/servicios/almacen-seguro.service.ts` | `AlmacenSeguroService` | Acceso a datos |
| Token de plataforma | `compartidos/servicios/plataforma.ts` | `ES_PLATAFORMA_NATIVA` | Infraestructura |
| Coordinador de pestañas (v2) | `compartidos/servicios/coordinador-pestanas.service.ts` | `CoordinadorPestanasService`, `NOMBRE_BLOQUEO_RENOVACION`, `NOMBRE_CANAL_SESION`, `MensajeSesion` | Infraestructura (web) |
| Interceptor | `compartidos/interceptors/autenticacion.interceptor.ts` | `autenticacionInterceptor` | Infraestructura HTTP |
| Constantes HTTP | `compartidos/interceptors/sesion-http.ts` | `URL_*`, `OMITIR_MANEJO_ERROR`, `ES_REINTENTO_AUTENTICACION`, `esUrlApi` | Infraestructura HTTP |
| Modelos | `compartidos/modelos/sesion.modelo.ts`, `compartidos/modelos/error-api.ts` | `RespuestaSesion`, `SolicitudRenovacion`, `RespuestaExitosa`, `EstadoRestauracion`, `ErrorApi` | Contratos |
| Entorno de staging | `src/environments/environment.staging.ts` | `environment` | Configuración |
| Specs | `*.spec.ts` junto a cada artefacto | `describe('SesionStore', …)` etc. | Pruebas |

Convenciones adicionales:

- **Legado (AF-4):** `ServicioAutenticacion.ts`, `GuardAutenticacion.ts`, `GuardRoles.ts`, `ServicioInactividad.ts`, `loginStore.ts`, `cuentaStore.ts`, `PlanesStore.ts`, `SuscripcionStore.ts` y los modelos `*.modelo.ts` en PascalCase **conservan su nombre**. Los specs nuevos de archivos legado usan kebab-case (`servicio-autenticacion.spec.ts`, `guard-autenticacion.spec.ts`, `login.store.spec.ts`), registrado aquí como excepción de coherencia.
- **Nombres de métodos del store (verbo + objeto):** `iniciarSesion`, `restaurarSesion`, `renovarSesion`, `cerrarSesion`, `cerrarTodasLasSesiones`, `limpiarSesionLocal`, `actualizarDatosUsuario`, `renovacionEnCurso`; en `LoginStore`: `registrarResultado`, `reiniciarIntentos`.
- **Booleanos:** `estaAutenticado`, `estaRestaurando`, `restauracionFinalizada`, `renovando`, `hayCierrePendiente`, `ES_PLATAFORMA_NATIVA`.
- **Constantes:** `MAX_INTENTOS`, `CLAVE_REFRESH`, `CLAVE_CIERRE_PENDIENTE`, `CLAVES_HEREDADAS`, `MENSAJE_SESION_EXPIRADA`, `MENSAJE_ACCESO_DENEGADO`, `SEGUNDOS_POR_MINUTO` (UPPER_SNAKE_CASE).
- **Plantillas nuevas:** control flow moderno (`@if`) en el bloque nuevo de `perfil.page.html`; sin llamadas a métodos que calculen en la plantilla.
- **Sin** `any`, `subscribe` manual en páginas, `console.log`, números mágicos ni código muerto en lo que se escribe o modifica.
