# HLT-39-v1 — App: `ModalPinPage` → `ModalPinComponent` con `PinFormularioStore` (HU-007)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-007-componentes-reutilizables-fuera-de-paginas.md` (pieza 3) |
| Numeración | HLT-36 → HLT-37 → HLT-38 → **HLT-39-v1 (este)** → HLT-40 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | HU-006 implementada (alert de «omitir PIN» con `app-alerta-ck`) |
| Entorno | Igual que HLT-36 |
| Estado | Pendiente de ejecución. **La tarea más delicada de HU-007: toca el PIN y el login** |

> **Reglas de entorno.** Igual que HLT-36; respetar CRLF. Seguridad: el PIN digitado nunca se registra en consola ni se guarda en claro; el hash sigue siendo `generarHashPin` (PBKDF2).

---

## H1 · Propósito

`ModalPinPage` se usa como **contenido de un modal** (`ion-modal` en `login` y `cambiar-pin`), inyecta stores, `ModalController`, `FormBuilder` y servicios, y tiene además una ruta propia. Pasa a `ModalPinComponent` presentacional y **sigue siendo contenido de modal**; la creación asíncrona del PIN pasa a `PinFormularioStore` (`signalStore`).

**Fuera de alcance.** Cambiar el hash, la política del PIN, el bloqueo, `DbPIN*Store`, la persistencia web/nativa ni los puntos de ruptura del modal.

---

## H2 · Comportamiento actual que se conserva

| Hoy (`ModalPinPage`) | Después |
|----------------------|---------|
| Formulario con `ingPin` y `confPin`, ambos `^\d{6}$` y requeridos | Mismo formulario reactivo tipado (`FormControl<string>` `nonNullable`) en el componente |
| `contarIngresoPin()`: si los 6 dígitos de ambos coinciden → guarda; si no coinciden → limpia y toast «Digite el mismo valor en las dos opciones» (danger) | El componente emite `pinConfirmado(pin)` solo cuando coinciden; si no, limpia y emite `pinDistinto` (el anfitrión muestra el mismo toast) |
| `guardarPin`: muestra la imagen animada, elige el store web o nativo, `guardarPin({ pin, idUsuario })`, espera la carga, toma `mensajeOperacion`/`errorMessage`, muestra el toast (success o danger), limpia el formulario y cierra con `{ pinCreado: !error }` | `PinFormularioStore.guardar(pin)`: misma elección web/nativa, mismo orden, mismos mensajes y toast; expone `guardando` (para la imagen animada) y `resultado` (`'creado' \| 'error' \| null`) |
| «Omitir» → alert de confirmación (HU-006) → al confirmar cierra con `{ omitido: true }` | El componente muestra el mismo `app-alerta-ck` y, al confirmar, emite `omitido` |
| Cierra con `ModalController.dismiss(datos)` | El **anfitrión** cierra su `ion-modal` con `modal.dismiss(datos)` |

### Mapa de uso (rutas sin cambios)

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `LoginPage` (`/login`) | `ion-modal [isOpen]="estaModalPinAbierto()" [breakpoints]="puntosRupturaModalPin" [initialBreakpoint]="puntoInicialModalPin"` con `<app-modal-pin>` en el `<ng-template>`; ida: `[guardando]` y `[idUsuario]` si se necesitan | `(willDismiss)="alCerrarModalPin($event)"` con `detail.data`: `{ omitido: true }` o `{ pinCreado: boolean }`; navega a `/inicio` solo con `omitido` o `pinCreado` |
| `CambiarPinPage` (`/cambiar-pin`) | Igual | `(willDismiss)="alCerrarModalPin($event)"`: navega a `/inicio` con cualquier resultado |

El `detail.data` que recibe `willDismiss` **debe ser idéntico** al de hoy.

---

## H3 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Estándar del componente | `paginas/configuracion/componentes/modal-pin/modal-pin.component.*`; selector `app-modal-pin`; `standalone`, `OnPush`, `input()`/`output()`, **sin `inject`**, sin `ModalController` ni `providers: [ModalController]`, `@if`/`@for` |
| RN-02 | Store | `paginas/configuracion/store/pin-formulario.store.ts`: `signalStore` con `withState` (`guardando`, `error`, `mensaje`, `resultado`), `withComputed`, `withMethods` y `rxMethod`/`patchState`; reutiliza `DbPINWebStore`/`DbPINAppStore` y `generarHashPin` sin cambios |
| RN-03 | Web o nativo | La elección `Capacitor.getPlatform() === 'web'` se hace como hoy (en el store) y los stores `DbPIN*` quedan intactos |
| RN-04 | Usuario | El id sale de `ServicioAutenticacion.obtenerUsuarioActual()?.id \|\| 0` como hoy, leído en el store o en el anfitrión, nunca en el componente |
| RN-05 | Mensajes | Mismos textos de toast, mismos colores (success/danger) y mismo orden (guardar → toast → cerrar) |
| RN-06 | Cierre | Los anfitriones cierran con `modal.dismiss({ pinCreado: !error })` o `modal.dismiss({ omitido: true })` usando la referencia al `ion-modal`; no se pierde el cierre con arrastre ni con clic en el fondo (`willDismiss` sin datos: `login` no navega, como hoy) |
| RN-07 | Sin pérdida | Imagen animada de guardado, limpieza del formulario y bloqueo mientras guarda (no se puede pulsar dos veces) |

---

## H4 · Qué se crea, modifica y borra

- **Crea** `modal-pin.component.{ts,html,scss,spec.ts}` (moviendo `html`/`scss` actuales) y `pin-formulario.store.ts` con su spec.
- **Modifica** `login.page.{ts,html}`, `cambiar-pin.page.{ts,html}` y `app.routes.ts` (la ruta `modal-pin` pasa a `{ path: 'modal-pin', redirectTo: 'inicio', pathMatch: 'full' }`, DN-01) y, si procede, `permisos-plan.config.ts` y su spec.
- **Borra** `paginas/configuracion/modal-pin/modal-pin.page.*` al final.

**Verificación con grep.**
```
grep -rn "ModalPinPage\|modal-pin.page" criterioKellyApp/src  -> sin resultados
grep -nE "@Input|@Output|EventEmitter|inject\(|ModalController|\*ngIf|\*ngFor| any" modal-pin.component.ts  -> sin resultados
grep -rn "console\." <archivos nuevos>  -> sin resultados
```

---

## H5 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Línea base | solo lectura | — | Fallos conocidos y bundle anotados; leer `modal-pin.page.ts`, `login.page.ts` y `cambiar-pin.page.ts` y anotar los resultados que hoy produce cada camino (crear, no coinciden, omitir, error, arrastrar para cerrar) | — |
| T-02 | `PinFormularioStore` + spec | `store/pin-formulario.store.ts` | T-01 | RN-02…RN-05; spec: guarda por la rama web y por la nativa (stores simulados), éxito → `resultado='creado'` y toast success, error → `resultado='error'` y toast danger, `guardando` vuelve a `false` | RN-02…RN-05 |
| T-03 | `ModalPinComponent` + spec | carpeta nueva | T-01 | RN-01, RN-07; spec: valida 6 dígitos, no coinciden → `pinDistinto` y limpia, coinciden → `pinConfirmado`, «Omitir» abre el alert y al confirmar emite `omitido` | RN-01, RN-07 |
| T-04 | Migrar `LoginPage` | `.ts`, `.html`, spec | T-02, T-03 | RN-06; `willDismiss` conserva `{ omitido, pinCreado }` y la navegación a `/inicio` solo con uno de los dos | RN-06 |
| T-05 | Migrar `CambiarPinPage` | `.ts`, `.html`, spec | T-02, T-03 | RN-06; navega a `/inicio` con cualquier resultado | RN-06 |
| T-06 | Ruta heredada | `app.routes.ts`, `permisos-plan.config.ts` (+spec) | T-04, T-05 | `modal-pin` redirige a `/inicio`; spec R-04 en verde | HU-007 CA-10 |
| T-07 | Borrar lo antiguo | `modal-pin.page.*` | T-06 | Greps de H4 sin resultados; sin imports rotos | — |
| T-08 | Verificación | `tsc`, `ng lint`, `ng build --configuration development`, `ng test` | T-07 | Sin fallos nuevos frente a T-01; bundle inicial no mayor | HU-007 CA-5, CA-12, CA-13 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08.

**Compuerta manual del usuario (obligatoria).** M-01 en navegador y dispositivo: usuario nuevo sin PIN → inicia sesión → aparece el modal → (a) crear PIN con dos valores distintos (toast y limpia), (b) crear con valores iguales (toast de éxito y llega a `/inicio`), (c) omitir (alert → `/inicio`), (d) cerrar arrastrando (no navega); en `/cambiar-pin`: crear/cambiar el PIN; luego bloquear la app y comprobar que el PIN nuevo desbloquea y que «omitir» sigue pidiendo la contraseña. Respuesta esperada: «PRUEBA MANUAL HLT-39 OK».

## H6 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Romper el flujo del PIN en el login | Alta | Mapa de resultados de T-01, specs de login y cambiar-pin, M-01; ante duda se revierte ese anfitrión |
| R-02 | `willDismiss` deja de recibir los mismos datos | Alta | RN-06 y spec que compara `detail.data` |
| R-03 | El PIN llega a un log o a un spec en claro | Media | Grep de `console.` y specs con valores de prueba obvios |
| R-04 | Doble pulsación guarda dos veces | Media | RN-07 y spec |

## H7 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-36.
