# Criterio Kelly App

## Sesión y autenticación

La sesión está centralizada en `SesionStore`. El access token solo vive en memoria; el refresh usa cookie HttpOnly en web y `@aparajita/capacitor-secure-storage@7.1.0` en nativo. La renovación se serializa dentro de la aplicación y entre pestañas web con Web Locks/BroadcastChannel.

**Primer inicio de sesión y plan reservado (HLT-19 v2).** El registro ya no crea la suscripción: solo envía `persona/agregar` y guarda en `localStorage['plan_reservado']` el plan elegido y el nombre de usuario (sin tokens ni ids). Tras un login correcto, `SuscripcionStore.asegurarSuscripcionInicial` crea primero la suscripción pendiente si la reserva es de pago (`suscripcion/crearSinPago`) y después pide la prueba de 24 horas (`suscripcion/iniciarPrueba`); una reserva Libre o ausente solo pide la prueba. Con 200 o 409 guarda la marca `localStorage['suscripcion_inicial_verificada']` (ids de usuario, máximo 20) y borra la reserva; ante otro error no marca, no muestra toast y no bloquea el login. La pantalla de inicio muestra el plan vigente (`PlanVigenteStore`): tiempo restante de la prueba, avisos de transición (una sola vez, marca `localStorage['plan_vigente_avisado']`) y plan pendiente de pago. Claves de `localStorage`: `plan_reservado`, `suscripcion_inicial_verificada`, `plan_vigente_avisado` y `ck_cierre_pendiente`.

Las pruebas de Karma se ejecutan con Edge si no hay Chrome: `CHROME_BIN="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless --include='**/archivo.spec.ts'`.

Las cabeceras de autenticación solo se agregan a las tres bases definidas en `src/environments`. CapacitorHttp no está habilitado. `staging` y `production` usan dominios HTTPS `.invalid` reservados hasta HLT-11.

Aplicación móvil de **gestión de trading basada en el Criterio de Kelly**. Permite llevar una bitácora de operaciones (abrir, dar seguimiento y cerrar), ver el porcentaje Kelly y el monto a operar por cuenta, administrar cuentas, capital y perfil, generar reportes y gráficos con exportación a Excel/PDF, y gestionar planes de suscripción. El acceso se protege con PIN y bloqueo por inactividad.

Fue desarrollada en **Ionic 5** y migrada a **Ionic 8 / Angular 20 / Capacitor 7**, con **standalone components** y estado en **NgRx Signals** (`signalStore`).

## Stack

| Tecnología | Versión |
|------------|---------|
| Ionic Framework (`@ionic/angular`) | 8.x |
| Angular | 20.x |
| Capacitor | 7.x |
| `@ngrx/signals` | 20.x |
| TypeScript | 5.8.x (modo `strict`, `strictTemplates`) |
| Node.js | 20.x |

Librerías destacadas:

- **Base de datos local:** `@capacitor-community/sqlite` (dispositivo) e IndexedDB (navegador, con `jeep-sqlite`)
- **Gráficos:** `chart.js` + `chartjs-plugin-datalabels`
- **Exportación:** `jspdf` / `jspdf-autotable` / `pdfmake` (PDF), `xlsx` (Excel), `jszip` + `file-saver`

## Servicios backend

La app no funciona sola: consume tres APIs REST en PHP que viven en carpetas hermanas de este proyecto y comparten la base de datos MySQL `sist_criteriokelly`. Sus URLs se configuran en `src/environments/environment.ts` (desarrollo) y `environment.prod.ts` (producción).

| Clave | URL por defecto | Servicio | Uso |
|-------|-----------------|----------|-----|
| `apiUrlLoge` | `http://localhost/rest_usuario/` | `rest_usuario` | Login, roles, registro de persona, perfil, cambio de clave |
| `apiUrlCritKell` | `http://localhost/rest_criteriokelly/` | `rest_criteriokelly` | Cuentas y capital, bitácora, observaciones, cálculo de Kelly, reportes |
| `apiUrlSuscripcion` | `http://localhost/rest_suscripcion/` | `rest_suscripcion` | Planes y suscripciones |

Para desarrollo local, levanta Apache + MySQL (XAMPP) con esos servicios publicados en esas rutas e importa sus scripts SQL; cada servicio tiene su propio README. Los backends solo permiten CORS desde `http://localhost:8100`, por eso conviene servir la app en ese puerto.

> Ambos archivos de entorno apuntan hoy a `localhost`. Antes de compilar para un dispositivo, cambia `environment.prod.ts` a la URL real del servidor.

## Correos que dispara la app

La app **no envía correo**: lo hace el backend. El módulo está en `rest_usuario/correo/` (ver su `README.md`). Estas son las acciones de la app que provocan un correo. Las rutas de página, store y servicio van relativas a `src/app/paginas/`.

| Pantalla / acción | Página | Store | Servicio | Endpoint | Plantilla que envía el backend |
|-------------------|--------|-------|----------|----------|--------------------------------|
| Registro | `suscripcion/registro/registro.page.ts:169` | `PersonaStore.registrarPersona` (`util/store/personaStore.ts:39`) | `PersonaService.registrarPersona` (`util/servicios/persona.service.ts:16`) | `POST persona/agregar` | `codigoVerificacion` |
| Reenvío del código de verificación | `util/verificar-correo/verificar-correo.page.ts:77` | `VerificacionCorreoStore.reenviarCodigo` (`util/store/verificacion-correo.store.ts:88`) | `VerificacionCorreoService.reenviarCodigo` (`util/servicios/verificacion-correo.service.ts:28`) | `POST persona/reenviarCodigo` | `codigoVerificacion` |
| Recuperación de clave | `util/recuperar-clave/recuperar-clave.page.ts:47` | `RecuperacionClaveStore.solicitarCodigo` (`util/store/recuperacion-clave.store.ts:35`) | `RecuperacionClaveService.solicitarRecuperacion` (`util/servicios/recuperacion-clave.service.ts:21`) | `POST autenticacion/solicitarRecuperacion` | `codigoRecuperacion` |
| Restablecer clave con el código | `util/recuperar-clave/recuperar-clave.page.ts:51` | `RecuperacionClaveStore.restablecerClave` (`recuperacion-clave.store.ts:61`) | `RecuperacionClaveService.restablecerClave` (`recuperacion-clave.service.ts:30`) | `POST autenticacion/restablecerClave` | `avisoCambioClave` |
| Cambio de clave en el perfil | `configuracion/perfil/perfil.page.ts:160` | `PerfilStore.cambiarClave` (`configuracion/store/perfilStore.ts:74`) | `PerfilService.cambiarClave` (`configuracion/servicios/perfil.service.ts:30`) | `PUT autenticacion/actualizarClave` | `avisoCambioClave` |

`persona/activar` (`verificacion-correo.service.ts:19`) no envía correo: valida el código recibido. La reorganización del código de la app es parte de HU-002.

## Requisitos previos

- [Node.js 20.x](https://nodejs.org/) (recomendado con NVM)
- [Ionic CLI](https://ionicframework.com/docs/cli): `npm install -g @ionic/cli@latest`
- XAMPP (Apache + MySQL) con los servicios backend
- Android Studio / Xcode, solo para builds nativos

## Instalación

```bash
nvm install 20
nvm use 20

npm install --legacy-peer-deps
```

> **Siempre** usa `--legacy-peer-deps`: hay conflictos de peer dependencies que no se pueden evitar.

## Comandos

| Acción | Comando |
|--------|---------|
| Servidor de desarrollo | `ionic serve --port=8100` (o `ng serve --port 8100`) |
| Build (salida en `www/`) | `ng build`. La configuración por defecto es `production`. |
| Build de desarrollo | `ng build --configuration development` |
| Tests (una vez) | `ng test --watch=false` |
| Un solo archivo de test | `ng test --watch=false --include='**/nombre.spec.ts'` |
| Lint | `ng lint` |

### Builds nativos (Capacitor)

Las carpetas `android/` e `ios/` todavía no existen en el proyecto. La primera vez hay que crearlas:

```bash
ionic build
npx cap add android        # o: npx cap add ios
```

Después, en cada cambio:

```bash
ionic build
npx cap sync
npx cap open android       # o: npx cap open ios
```

> `capacitor.config.ts` mantiene el `appId` de plantilla (`io.ionic.starter`). Cámbialo antes de publicar en las tiendas.

## Estructura del proyecto

```
src/
├── main.ts                    # bootstrapApplication: router, interceptores, ionicons, jeep-sqlite
├── app/
│   ├── app.component.ts       # Shell: menú lateral, estado de sesión, inactividad, init de BD local
│   ├── app.routes.ts          # Rutas planas con lazy loading (loadComponent)
│   ├── compartidos/           # Código compartido
│   │   ├── IonicComponentes.ts      # Reexporta los componentes Ion* para importarlos de una vez
│   │   ├── encabezado/              # Cabecera común de las páginas
│   │   ├── interceptors/            # errorInterceptor (HTTP → toast en español)
│   │   ├── seguridades/             # ServicioAutenticacion, ServicioInactividad, guards
│   │   ├── servicios/               # BD local (SQLite / IndexedDB), menú, utilitarios
│   │   ├── store/                   # Stores de BD local y menú
│   │   ├── modal-actualiza-plan/    # Invitación a mejorar el plan
│   │   └── seleccionar-cuentas/     # Selector de cuenta reutilizable
│   └── paginas/               # Features; cada una con modelos/, servicios/ y store/
│       ├── inicio/            # Dashboard
│       ├── criterioKelly/     # % Kelly y monto a operar por cuenta
│       ├── planTrading/       # Bitácora: abrir, seguimiento, cerrar; búsqueda de divisa
│       ├── reportes/          # Análisis, gráficos, operativas, exportación Excel/PDF
│       ├── suscripcion/       # Planes y registro de usuario
│       ├── configuracion/     # Cuentas y capital, divisor Kelly, perfil, PIN, bloqueo
│       └── util/              # Login, ayuda, acerca de
├── assets/
│   ├── datos/menu.json        # Opciones del menú lateral
│   └── anexos/                # Copia de los scripts SQL de los backends
├── environments/              # URLs de los servicios backend
└── theme/                     # Variables de tema
docs/                          # Documentación de arquitectura y del proceso de planificación
```

## Arquitectura

### Standalone components

No existe `AppModule` ni `app.config.ts`: todo se configura en [src/main.ts](src/main.ts). Cada página es `standalone: true`, declara sus propias `imports` (normalmente `CommonModule`, `IonicComponentes`, `EncabezadoComponent` y `ReactiveFormsModule`) y usa `inject()` para la inyección de dependencias.

```typescript
@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicComponentes, RouterModule, EncabezadoComponent],
})
export class InicioPage {
  private readonly store = inject(InicioStore);
}
```

Si usas un componente `Ion*` que aún no está en [IonicComponentes.ts](src/app/compartidos/IonicComponentes.ts), agrégalo ahí.

### Rutas

[app.routes.ts](src/app/app.routes.ts) define una tabla plana con `loadComponent`. La ruta por defecto redirige a `/login` y las rutas privadas usan `GuardAutenticacion`. Hay rutas por rol (`administracion`, `super-admin`) preparadas con `GuardRoles`, pero están comentadas.

### Estado con NgRx Signals

Todos los stores siguen la misma forma (ejemplo simplificado):

```typescript
export const CuentaStore = signalStore(
  { providedIn: 'root' },
  withState({ cuentas: [], loading: false, error: null }),
  withComputed((store) => ({
    isLoading: computed(() => store.loading()),
    errorMessage: computed(() => store.error()),
  })),
  withMethods((store, servicio = inject(CuentasService)) => ({
    cargarCuentas: rxMethod<number>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((id) => servicio.obtenerCuentas(id).pipe(
          tap((cuentas) => patchState(store, { cuentas })),
          catchError((e) => { patchState(store, { error: e.message }); return EMPTY; }),
          finalize(() => patchState(store, { loading: false })),
        )),
      ),
    ),
  })),
);
```

- El estado siempre incluye `loading` y `error`.
- Las páginas esperan a que termine un `rxMethod` con `utilServicio.esperarCargaDeStore(() => store.isLoading())`.
- **`withComputed` no debe volver a exponer una señal con el mismo nombre que ya tiene en `withState`**: lanza `SignalStore members cannot be overridden`.

### Lógica de Kelly

El cálculo del Criterio de Kelly (% Kelly, % operativo y monto a operar) **se hace en el backend** (`rest_criteriokelly`) cada vez que se cierra una operación. La app lo consulta con `criterioKelly/obtenerPorcentaje` y, en `mostrar-criterio-kelly`, solo reparte el % operativo entre N operaciones.

El **divisor** del Kelly (recomendado y por defecto: **10**) se guarda localmente por cuenta en `configuracion/operativa-kelly` y se envía al backend al cerrar cada operación.

### Persistencia local (SQLite / IndexedDB)

Dos servicios con la misma API:

- `DataBaseService`: SQLite en dispositivo, base `critKelly`
- `DataBaseWebService`: IndexedDB en navegador, base `CriterioKellyDB`

Guardan dos tablas: `dividendoKelly` (divisor por cuenta) y `pinBloqueo` (PIN de la app por usuario). El que llama elige el servicio según `Capacitor.getPlatform() === 'web'`, a través de los stores pareados `dbkelly-app/web.store.ts` y `dbPIN-app/web.store.ts`. La base se inicializa en `AppComponent`.

`pinBloqueo.pin_codigo` **nunca** guarda el PIN en claro: contiene `pbkdf2-sha256$<iteraciones>$<sal Base64>$<hash Base64>` (310 000 iteraciones, sal aleatoria de 16 bytes). Los valores heredados en claro se migran a ese formato en el primer desbloqueo correcto.

### Sesión y seguridad

- **Login:** `LoginStore` autentica contra `rest_usuario`, carga los roles, valida el PIN y navega a la app. Tras 3 intentos fallidos la app se cierra.
- **Recuperación:** `/recuperar-clave` es pública (sin `GuardAutenticacion`). El usuario solicita un código por correo en `autenticacion/solicitarRecuperacion` y luego lo canjea con la clave nueva en `autenticacion/restablecerClave`; la UI muestra siempre el mismo mensaje, exista o no el correo.
- **Verificación de correo (HLT-08 v2):** `/verificar-correo` es pública (sin `GuardAutenticacion`, sin menú). Flujo: registro → `/verificar-correo` (correo precargado) → `persona/activar { correo, codigo }` → `/login` → primer inicio de sesión (crea la suscripción inicial). `persona/reenviarCodigo { correo }` reenvía el código y el botón se bloquea 60 s (`SEGUNDOS_ENTRE_REENVIOS`). El correo vive solo en memoria (`VerificacionCorreoStore`). El login y el error de registro enlazan a esta pantalla. **Riesgo:** sin SMTP real en producción nadie recibe el código (en local usa `CORREO_MODO=log` y `rest_usuario/logs/correos/` (un `.txt` por correo), o Mailpit).
- **Cambio de clave:** en `/perfil`, el formulario pide la **clave actual** y la nueva y envía `{ claveActual, claveNueva }` a `autenticacion/actualizarClave`. Con la clave actual incorrecta el servidor responde 400 (nunca 401, que dispararía la renovación); AJ-02 está cubierto por `perfilStore.spec.ts` y `autenticacion.interceptor.spec.ts`.
- **Política B-02:** registro, cambio y restablecimiento comparten `politica-clave.validator.ts` (10–128 caracteres y distinta del usuario/correo cuando la app los conoce). La validación que cuenta es la del servidor.
- **Sesión:** `ServicioAutenticacion` la guarda en `localStorage` (`usuario`, `roles`, `autenticado`). No hay JWT ni token; las APIs no autentican las peticiones.
- **Inactividad:** `ServicioInactividad` envía a `/bloqueo` tras **5 minutos** sin actividad, y ahí se pide el PIN.
- **Errores HTTP:** `errorInterceptor` muestra un toast en español con el mensaje `error` del servidor o uno genérico por código. El **422** se reserva para "límite de pérdida alcanzado, recargue la cuenta".

## Menú según el plan (HLT-20 v2)

Toda la tabla de permisos vive en un solo archivo: `paginas/suscripcion/configuracion/permisos-plan.config.ts` (`RUTAS_SIEMPRE_HABILITADAS`, `RUTAS_CONTROLADAS`, `estadoMenuDesdePlan`, `estaRutaPermitida`, `textoBloqueo`). Ningún componente ni página decide permisos. `menu.json` no cambia: el menú se ve igual y el bloqueo ocurre al navegar, con `planGuard` (`compartidos/seguridades/plan.guard.ts`) aplicado a las 13 rutas controladas de `app.routes.ts`.

| Estado del plan (`planVigente`) | Menú | Qué ocurre |
|---|---|---|
| `PRUEBA`, `LIBRE`, `PAGO` (con o sin periodo programado) | `COMPLETO` | Todo abre |
| `SIN_PLAN` con `planPendiente` (cualquier motivo, también `NUNCA_TUVO_PLAN`) | `MINIMO_PENDIENTE` | Solo `/inicio` y `/mostrar-criterio-kelly`; lo demás lleva al inicio con «Tu plan … está pendiente de pago…» (o «terminó… tienes N días para pagarlo» si es renovación) |
| `SIN_PLAN` sin `planPendiente` | `SIN_PLAN` | Igual, con «Debes activar un plan» y la lista de planes de pago; elegir uno crea la suscripción pendiente (`crearSinPago`) |

La decisión sale siempre de `PlanVigenteStore.plan()` (servidor), nunca de almacenamiento del dispositivo. **Fail-open (D-03):** si el plan no carga o tarda más de 3 s, el guarda permite. **Riesgo R-01 (Alta):** el control es solo de la app; los backends no rechazan llamadas directas. Un plan de pago vigente puede cancelarse desde el inicio (`POST suscripcion/cancelar`, con confirmación); después se muestra «Tu plan termina el …». Toda ruta privada nueva debe añadirse a una lista de `permisos-plan.config.ts` (la spec R-04 lo verifica).

## Comprobante de pago (HLT-25 v2)

Ruta privada `/comprobante` (`ComprobantePage` → `ComprobanteStore` → `PagosService` + `SuscripcionService.crearSuscripcionConPago`). Siempre habilitada: está en `RUTAS_SIEMPRE_HABILITADAS`, así que ni el plan pendiente ni la ausencia de plan la bloquean.

- **Quién ve qué:** el servidor decide con `planVigente` y `pagos/miUltimoPago`. Con un plan pendiente sin comprobante el aviso del inicio y `/planes` ofrecen «Subir comprobante»; con el comprobante ya en revisión, «Ver estado del pago»; con un plan de pago sin pago ni periodo programado, «Pagar mi renovación por anticipado».
- **Formulario:** método (`BANCO`, `PAYPAL`, `CRIPTOMONEDA`), número de transacción (≤ 254, `[A-Za-z0-9._:-]`), correo si es PayPal, criptomoneda si corresponde e imagen (cámara o galería). La validación de negocio es del servidor.
- **Imagen:** `ManejoImagenesService` la reduce; la app rechaza lo que no sea jpeg/png/gif/webp o pase de 524 288 bytes decodificados («La imagen no puede superar 512 KB»). Vive solo en memoria hasta enviarla; no se guarda en `localStorage`.
- **Envío:** `POST suscripcion/crearConPago` con `pin_idPlanInterv` y `sis_idSuscrip` del plan pendiente (el pago anticipado omite `sis_idSuscrip`), sin monto. Con éxito se recarga `PlanVigenteStore` y el último pago; 400/403/409 muestran el mensaje del servidor (`errorInterceptor`).
- **Estados:** sin comprobante, en revisión, rechazado (con motivo, vuelve a mostrar el formulario), plan activo y renovación ya pagada. Los textos de fechas salen de la cadena del servidor (el «día siguiente» es una suma sobre `YYYY-MM-DD`), nunca del reloj del dispositivo.
- **Elige cómo pagar (antes del formulario):** cuando hay algo por pagar, `/comprobante` guía en tres pasos (`MetodoPagoStore`, solo en memoria): 1) tarjetas Criptomoneda (USDT), PayPal o Transferencia bancaria; 2) datos del método (redes USDT con dirección y botón copiar, advertencia de enviar solo USDT por la red indicada; datos de PayPal; o, en banco, WhatsApp `https://wa.me/<número>?text=…` con un mensaje que menciona plan, intervalo y monto, luego «Ya envié la solicitud»); 3) «Ahora necesito subir el comprobante» abre el formulario de siempre. «Cambiar método» vuelve al paso 1. Si la persona cambia de plan, el recorrido se reinicia. El método elegido es informativo: el contrato con el backend no cambia.
- **Datos de pago:** se administran en la base de datos desde la pantalla «Datos de pago» (menú, solo roles 1 y 2, ruta `/datos-pago`); el front no contiene ninguna dirección, correo ni número. El usuario los lee de `GET datosPago/disponibles` y el QR de cada red de `datosPago/qr` (imagen en memoria). Un método sin datos cargados y activos aparece como «Este método aún no está disponible, elige otro». Los datos de la cuenta bancaria del propietario se registran en la pantalla, pero el usuario todavía no los ve: la transferencia solo envía el mensaje de WhatsApp.

## Validación de pagos (administradores)

La opción de menú «Validar pagos» (`menu.json`, con `roles: [1, 2]`) la filtra `MenuStore.listaMenu` según los roles de `SesionStore`; las opciones sin `roles` se ven siempre. La ruta `/validar-pagos` usa `GuardAutenticacion` y `GuardRoles` (sin permiso redirige a `/inicio`) y está en `RUTAS_POR_ROL` de `permisos-plan.config.ts`, fuera del control de plan. La pantalla (`paginas/administracion/`) lista `pagos/pendientes` (20 por página, «Cargar más» con `desde`), abre el detalle en un modal y pide el comprobante solo al abrirlo (`pagos/comprobante`). Aprobar (`pagos/confirmar`) y Rechazar con motivo de 5 a 256 caracteres (`pagos/rechazar`) piden confirmación; en pagos propios (`esPropio`) no hay botones. Las fechas del periodo y `esAntiguo` las decide el servidor. Un 409 muestra el mensaje del servidor y recarga la lista. La autorización real es la de los backends.

## Límites por plan en la app (HLT-27 v2)

Los límites salen **siempre** de `planVigente.limites` (servidor) a través de `PlanVigenteStore.limites`; ningún número de límite está escrito en la app y ninguna página compara nombres de plan. Sin plan cargado no se restringe (el servidor sí aplica los límites).

| Pantalla | Límite (clave de `limites`) | Qué ve el usuario |
|---|---|---|
| `/operativas` | `diasReporte` | Aviso «Tu plan muestra los últimos N días…» con botón a `/planes` (solo si recorta respecto a `diasTotalesAnalisis`) |
| `/operativas` | `puedeGraficar`, `puedeDescargar` | «Graficar operaciones» y «Exportar a PDF» abren el modal «Actualiza su plan para poder visualizar» |
| `/analisis` | `diasAnalisis`, `diasTotalesAnalisis` | Filtro Desde/Hasta; rango máximo `diasAnalisis` («Tu plan permite consultar hasta N días») y fecha mínima de la ventana total |
| `/analisis` | `maxOperacionesAnalisis`, `puedeDescargar` | Aviso «Tu plan muestra hasta N operaciones por cuenta»; Excel bloqueado sin descarga |
| `/cuentas` | `numCuentas` | Al llegar al tope, «Crear cuenta» muestra «Tu plan permite N cuenta(s)…» |
| `/operativa-kelly` | `divisorEditable` | Sin edición, el divisor se muestra como 10 y el aviso lleva a `/planes` |
| `/mostrar-criterio-kelly` | `maxOperacionesDiarias` | «Operaciones diarias» se ajusta al máximo y avisa |
| `/planes` | columnas `pla_*` de `planes/disponible` | Cada plan lista sus límites («Sin límite» para `null` o rango libre) |

Toda la lógica pura (textos, tope de cuentas, rangos de fechas en UTC, filas de comparación) está en `paginas/suscripcion/configuracion/permisos-plan.config.ts` (`limitesPantalla`, `LIMITES_SIN_RESTRICCION`, `DIVISOR_KELLY_RECOMENDADO`). `perfil`, `ayuda`, `acerca-d` y `cambiar-pin` son libres siempre.

## PWA y build web

La web es una PWA instalable (`@angular/service-worker`, `ngsw-config.json`, `src/manifest.webmanifest`, íconos en `src/assets/icons/`). El service worker solo cachea recursos estáticos de la build (sin `dataGroups`: ninguna respuesta de las APIs entra en caché), se desactiva en nativo y en modo desarrollo, y avisa de versiones nuevas. Sin conexión muestra el aviso "Sin conexión". Al cerrar sesión, `ServicioInactividad.finalizarSalida()` borra las cachés que no empiezan por `ngsw:` antes de recargar.

- **Build:** `ng build --configuration production` (o `staging`) genera `www/` sin source maps, sin `assets/anexos/` (scripts SQL con esquema y usuarios semilla) y sin manejadores inline en `index.html`. El código de la app no usa `console.*` (regla ESLint `no-console`).
- **Servidor local con las cabeceras de producción:** tras la build, `node herramientas/servidor-local-www.mjs` sirve `www/` en `http://localhost:4200` (variables opcionales `PUERTO` y `ORIGEN_API`), con fallback SPA y las cabeceras de `herramientas/cabeceras-web.json`. Para probar la PWA usa Chrome en ese puerto; `ionic serve` (8100) no registra el service worker.
- **Contrato de cabeceras:** `herramientas/cabeceras-web.json` es la fuente única de la CSP y demás cabeceras (`__ORIGEN_API__` se sustituye por `https://api.<dominio>` en producción y se agrega `upgrade-insecure-requests`). `script-src 'self'` sin `unsafe-inline` ni `unsafe-eval`; `style-src` conserva `'unsafe-inline'` (estilos de Angular/Ionic).
- **Requisitos para HLT-11 (servidor):** aplicar esas cabeceras; servir `index.html` y `ngsw.json` con `Cache-Control: no-cache`; fallback SPA a `index.html`; desplegar primero en staging con `Content-Security-Policy-Report-Only` y pasar a modo estricto tras un recorrido sin reportes; rotar o eliminar los usuarios semilla publicados en builds anteriores.
- **Interruptor de emergencia (`safety-worker.js`):** si una versión del service worker queda defectuosa, publicar el archivo `node_modules/@angular/service-worker/safety-worker.js` con el nombre `ngsw-worker.js`; desregistra el service worker en todos los clientes y borra sus cachés. Después se restaura el `ngsw-worker.js` normal.

## Convenciones

- **Español** en archivos, carpetas, clases, comentarios y commits.
- Selectores con prefijo `app-`, componentes en `kebab-case`, directivas en `camelCase` (validado por ESLint).
- Sufijo `Page` para páginas y `Component` para componentes.
- Comillas simples en TypeScript (`.editorconfig`).
- **Nueva página:** créala en su feature (con `modelos/`, `servicios/` y `store/`), registra un `loadComponent` en `app.routes.ts` con `GuardAutenticacion` si es privada y, si va en el menú, agrégala a `assets/datos/menu.json`.
- **Nueva librería CommonJS:** agrégala a `allowedCommonJsDependencies` en `angular.json`.
- El build de producción limita los estilos por componente a 14 KB y el bundle inicial a 5 MB.

Más detalle en [docs/doc_arquitectura.md](docs/doc_arquitectura.md). El proceso de planificación de cambios (HLT) está en [docs/doc_modo_planificacion.md](docs/doc_modo_planificacion.md).

## Solución de problemas

**Errores de dependencias**

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Error de validación de esquema o caché corrupta de Angular**

```bash
npx ng cache clean
```

**Errores de CORS o `status 0` en las peticiones**
Verifica que la app corre en `http://localhost:8100` y que Apache sirve los backends en las URLs de `environment.ts`.

**`SignalStore members cannot be overridden`**
Un `withComputed` está exponiendo una señal con el mismo nombre que un campo de `withState`. Renómbrala o elimínala.

**Un componente `Ion*` no se reconoce en la plantilla**
Agrégalo a `IonicComponentes.ts`.

## Alertas y modales

Avisos y confirmaciones cortos: `app-alerta-ck` (un `ion-alert` declarativo, textos en `compartidos/textos-alertas.ts`, estilo `alerta-ck` en `src/global.scss`). Contenido largo o interactivo: `<ion-modal>` declarativo (incluido el PIN). Resultados rápidos: toast. No se usa `AlertController.create` ni `ModalController.create`. Detalle en `CLAUDE.md`, sección «Alertas y modales».

## Piezas reutilizables (HU-007)

Los componentes que antes eran páginas (aviso de límite de plan, selector de cuentas, selector de divisa, gráfico y PIN) son componentes presentacionales con `input()`/`output()`; los modales son contenido de un `<ion-modal>` declarado en la pantalla anfitriona. Las rutas heredadas `/modal-pin`, `/busca-divisa` y `/grafico-stadistico` redirigen a `/inicio`. Tabla completa en `CLAUDE.md`, sección «Piezas reutilizables fuera de las páginas».
