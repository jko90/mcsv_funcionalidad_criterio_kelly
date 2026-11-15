# HU-007 · Componentes reutilizables que hoy se llaman «página»: pasar al estándar sin perder funcionalidad

| Campo | Valor |
|-------|-------|
| ID | HU-007 |
| Fecha | 2026-11-15 (rev. 2: mapa de uso con valores de ida y vuelta; lo que se usa como modal sigue siendo modal) |
| Estado | Implementada (HLT-36…HLT-40); pendiente la prueba manual M-01 |
| Prioridad | Media (mantenibilidad y consistencia; no cambia reglas de negocio ni navegación) |
| Proyectos | `criterioKellyApp` únicamente. Sin cambios en backend ni en la base de datos. |
| Origen | Petición del usuario del 2026-11-15: mostrar qué páginas se usan como modal o componente sin seguir el estándar; actualizarlas a los estándares sin perder funcionalidad, lógica ni validaciones, con la app en óptimas condiciones (funcionalidad y rapidez); si hace falta renombrar rutas, mantener la navegación actual; documentar desde dónde se llama cada pieza y hacia dónde van los valores (ida y vuelta); lo que se usa como modal debe seguir siendo modal. |
| Relacionada con | HU-006 (alertas y modales unificados) |
| Agente de implementación | `desarrollador-ionic` |

## Historia

**Como** desarrollador,
**quiero** que las piezas que se reutilizan dentro de otras pantallas sean componentes presentacionales (`*Component`, `input()`/`output()`, sin `inject`) y que solo las pantallas con ruta sean páginas (`*Page`),
**para** entender de un vistazo qué es una pantalla y qué es una pieza, y mantener la lógica en los stores.

**Como** persona que usa la app,
**quiero** que nada de lo que ya funciona cambie (mismos datos, mismos recorridos, mismas validaciones) y que la app no se vuelva más lenta,
**para** no notar la reorganización.

## Principios de esta historia

1. **El anfitrión no cambia.** Cada pantalla que hoy llama a una pieza sigue llamándola desde el mismo lugar y con los mismos valores (mapa de abajo). Las URLs de esas pantallas no se tocan.
2. **Lo que se usa como modal sigue siendo modal.** `ion-modal` se queda en la pantalla anfitriona (con su `isOpen`, `trigger`, puntos de ruptura y eventos `willDismiss`/`dismiss` actuales). Solo cambia el contenido: de `*Page` con `inject` a `*Component` presentacional. Lo que hoy se usa como alert sigue siendo alert (HU-006).
3. **Se mueven, no se reescriben**: lógica, cálculos, validaciones, textos y orden de llamadas a stores.
4. **Lo que los componentes hoy piden a los stores lo pide la página orquestadora**, en el mismo orden y con las mismas condiciones, para que las peticiones al servidor sean las mismas.

## El estándar (de `criterioKellyApp/CLAUDE.md` y las reglas de lint)

| Pieza | Sufijo | Reglas |
|-------|--------|--------|
| Pantalla con ruta | `Page` | Orquesta stores; carga datos en el constructor o `ionViewWillEnter`; registra su ruta en `app.routes.ts` con sus guardas |
| Pieza reutilizable | `Component` | Presentacional: `input()` / `output()`, `OnPush`, **sin `inject`**; no conoce stores ni servicios |
| Estado y datos | `Store` (`signalStore`) | `rxMethod` para lo asíncrono; la página lo consume y pasa los datos a los componentes |

## Estándares de desarrollo para Ionic 8 / Angular 20 que se aplican

| Tema | Estándar | Aplicación en esta historia |
|------|----------|-----------------------------|
| Componentes | `standalone`, `ChangeDetectionStrategy.OnPush`, plantillas con control de flujo nativo (`@if`, `@for` con `track`, `@switch`), sin `*ngIf`/`*ngFor`/`CommonModule` en lo nuevo | Los 5 componentes nuevos |
| Entradas y salidas | `input()` / `input.required()` / `output()`; `model()` solo si hay enlace bidireccional real; **sin `@Input`/`@Output`/`EventEmitter` ni *setters*** | Reemplaza `@Input`/`@Output` de selector de cuentas, búsqueda de divisa y gráfico |
| Consultas de vista | `viewChild()` / `viewChild.required()` (señales) en lugar de `@ViewChild` | Lienzo (`canvas`) del gráfico |
| Estado local de UI | `signal` + `computed` dentro del componente (texto de búsqueda, selección provisional, PIN digitado) | `ModalBuscaDivisaComponent`, formulario del PIN |
| Estado compartido o asíncrono | **`signalStore`** de NgRx Signals (`withState`, `withComputed`, `withMethods`, `rxMethod`) con `loading`/`error` y `patchState`; `providedIn: 'root'` o provisto en la página si es solo suyo | `PinFormularioStore` (nuevo); se reutilizan `CuentaStore`, `ReportesStore` y `PlanVigenteStore` desde las páginas |
| Efectos | `effect()` solo para sincronizar con lo que no es Angular (redibujar el gráfico); nada de lógica de negocio dentro | Gráfico |
| Inyección | `inject()` solo en páginas y stores; **cero** en componentes presentacionales | Todos los componentes |
| Formularios | Formularios reactivos tipados (`FormControl<string>` con `nonNullable`) y `toSignal` donde se lean como señal | Formulario del PIN |
| Modales Ionic 8 | `ion-modal` declarativo con `[isOpen]`/`trigger`, `(willDismiss)`/`(didDismiss)`, `[breakpoints]`/`[initialBreakpoint]`; `canDismiss` si hay que impedir el cierre; contenido en `<ng-template>` para que se cree al abrir; sin `ModalController.create` ni `providers: [ModalController]` | El anfitrión conserva el `ion-modal`; el contenido es un componente |
| Alerts | `app-alerta-ck` (HU-006) | Límite de plan, omitir PIN |
| Tipado | Sin `any` (`event: any` del selector de cuentas pasa a `CustomEvent<{ value: CuentasModelo }>`); `strictTemplates` | Selector de cuentas, gráfico (`_cuentaSeleccionada: any`) |
| Esperas | Sin bucles `while … setTimeout` para esperar un store; se usa `esperarCargaDeStore` o se reacciona con `computed`/`effect` | `SeleccionarCuentasPage` hoy espera con `while`; la página lo hará con la utilidad existente, con la misma condición de fin |
| Nombres | Español, `kebab-case` en archivos, sufijo `Component`/`Page`/`Store`, selector con prefijo `app-` | Todos |

**Dónde sí se crea store y dónde no (para no sobre-diseñar):**
- **Store nuevo**: solo `PinFormularioStore` (guardar el PIN es asíncrono, tiene hash, mensajes y error; hoy vive en un componente que inyecta dos stores web/nativo).
- **Sin store nuevo**: `AlertaLimitePlanComponent` (solo entradas/salidas), `ModalBuscaDivisaComponent` (estado local con signals), `GraficoEstadisticoComponent` (datos por `input()`), `SeleccionarCuentasComponent` (la lista viene por `input()` desde `CuentaStore` en la página).
- La elección web/nativo del PIN (`DbPINWebStore`/`DbPINAppStore`) **no cambia**: la sigue resolviendo quien llama, como hoy.

## Inventario y destino (verificado el 2026-11-15)

| # | Clase actual | Se usa como | Destino |
|---|--------------|-------------|---------|
| 1 | `ModalActualizaPlanPage` (`compartidos/modal-actualiza-plan/`) | **Alert** informativo/confirmación (desde HLT-32; el nombre «modal» ya no es verdad) | `AlertaLimitePlanComponent` (`compartidos/alerta-limite-plan/`); sigue siendo alert (`app-alerta-ck`) |
| 2 | `SeleccionarCuentasPage` (`compartidos/seleccionar-cuentas/`) | **Selector** dentro de la pantalla (no es modal) | `SeleccionarCuentasComponent` |
| 3 | `ModalPinPage` (`configuracion/modal-pin/`) | **Modal** (contenido de `ion-modal` en `login` y `cambiar-pin`) | `ModalPinComponent` (estado asíncrono en `PinFormularioStore`): **sigue siendo contenido de modal** |
| 4 | `BuscaDivisaPage` (`planTrading/busca-divisa/`) | **Modal** (contenido de `ion-modal` en `bitacora`) | `ModalBuscaDivisaComponent`: **sigue siendo contenido de modal** |
| 5 | `GraficoStadisticoPage` (`reportes/grafico-stadistico/`) | **Gráfico** dentro de `operativas` (no es modal) | `GraficoEstadisticoComponent` |

## Mapa de uso: desde dónde se llama y qué valores viajan (ida y vuelta)

Ruta de cada pantalla anfitriona (de `app.routes.ts`, sin cambios): `/cuentas`, `/operativa-kelly`, `/analisis`, `/operativas`, `/bitacora`, `/login`, `/cambiar-pin`.

### 1. Alerta de límite de plan (antes `app-modal-actualiza-plan`)

| Anfitrión (ruta) | Ida (anfitrión → pieza) | Vuelta (pieza → anfitrión) |
|------------------|-------------------------|----------------------------|
| `CuentasPage` (`/cuentas`) | `[mostrarModal]="mostrarModalPlan()"`, `[mensaje]="mensajeTopeCuentas()"` | `(modalCerrado)` → `cerrarModalPlan()` |
| `OperativaKellyPage` (`/operativa-kelly`) | `[mostrarModal]="mostrarModalPlan()"`, `[mensaje]="textoDivisorFijo"` | `(modalCerrado)` → `cerrarModalPlan()` |
| `AnalisisPage` (`/analisis`) | `[mostrarModal]="mostrarModal()"`, `[mensaje]="textoFuncionNoIncluida"` | `(modalCerrado)` → `cerrarModal()` |
| `OperativasPage` (`/operativas`) | `[mostrarModal]="mostrarModalPlan()"`, `[mensaje]="textoFuncionNoIncluida"` | `(modalCerrado)` → `cerrarModalPlan()` |

Hoy la pieza, además, navega a `/planes` (`RUTA_PLANES`) con «Ver planes» (lo hace con `inject(Router)`). **Tras el cambio**: entradas `abierta` y `mensaje`; salidas `verPlanes` y `cerrado`. Cada una de las 4 páginas reacciona a `verPlanes` cerrando su señal y navegando a `/planes` (mismo efecto: cerrar y luego navegar). Mismo mensaje, mismos botones («Ver planes» / «Ahora no»).

### 2. Selector de cuentas (antes `app-seleccionar-cuentas`)

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `AnalisisPage` (`/analisis`) | Hoy ninguna (la pieza lee `CuentaStore` y el usuario por su cuenta) | `(cambioCuentaSeleccionada)` → `recibeCuentaSeleccionada(cuenta)`: guarda la cuenta y llama `reportesStore.obtenerListaOperacionesPorCuentas(cue_idCuentas)` |
| `OperativasPage` (`/operativas`) | Hoy ninguna | `(cambioCuentaSeleccionada)` → `recibeCuentaSeleccionada(cuenta)`: guarda la cuenta y llama `reportesStore.obtenerDetallePorCuentas(cue_idCuentas)` |

Qué hace hoy la pieza por dentro (y debe conservarse **tal cual**, repartido así):

| Comportamiento actual | Quién lo hace después |
|-----------------------|-----------------------|
| Lee el usuario (`ServicioAutenticacion`) y, si es 0, no carga nada | La página anfitriona (misma condición) |
| `cuentaStore.cargarCuentas()` y espera a que termine | La página anfitriona, en el mismo punto del ciclo de vida que hoy corre `ngOnInit` del selector |
| Con cuentas cargadas, llama `reportesStore.obtenerDetallePorCuentas(primeraCuenta.cue_idCuentas)` **sin avisar a la página** | La página anfitriona, igual (sin emitir la cuenta inicial) |
| Al elegir una cuenta: emite `cambioCuentaSeleccionada` y luego llama `reportesStore.obtenerDetallePorCuentas(id)` | El componente emite `cuentaElegida` con la cuenta; la página hace sus llamadas actuales **y** la llamada de detalle que hoy hacía el selector, en el mismo orden |
| Lista de cuentas mostrada: `cuentaStore.listaCuentas` | Entrada `[cuentas]` del componente |

**Importante:** hoy, en `/operativas`, al elegir una cuenta se llama dos veces a `obtenerDetallePorCuentas` (una desde el selector y otra desde la página). Esta historia **no cambia** ese número de peticiones: reducirlo es una mejora aparte (DN-03) que solo se hace si se comprueba que el resultado es idéntico.

### 3. Modal del PIN (antes `app-modal-pin`, ruta propia `modal-pin`)

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `LoginPage` (`/login`) | `ion-modal [isOpen]="estaModalPinAbierto()" [breakpoints]="puntosRupturaModalPin" [initialBreakpoint]="puntoInicialModalPin"`; el contenido es `<app-modal-pin />` sin entradas | `(willDismiss)="alCerrarModalPin($event)"` recibe `{ omitido?: true, pinCreado?: boolean }`; con `omitido` o `pinCreado` navega a `/inicio` |
| `CambiarPinPage` (`/cambiar-pin`) | Igual | `(willDismiss)="alCerrarModalPin($event)"`: navega a `/inicio` con cualquier resultado |

Hoy la pieza se cierra sola con `ModalController.dismiss({ omitido: true })` (tras la alerta de confirmar «omitir», HU-006) o `dismiss({ pinCreado: !error })`. **Tras el cambio**: sigue siendo contenido del `ion-modal` anfitrión; el componente emite `omitido` y `pinCreado(boolean)` y el anfitrión cierra el modal con `modal.dismiss(datos)`, de modo que `willDismiss` recibe **exactamente el mismo `detail.data`**. La creación del PIN (hash, `guardarPin`, mensajes y toast) pasa a un store (`PinFormularioStore`) que usa la página anfitriona o el propio componente a través de entradas/salidas, sin cambiar el algoritmo.

### 4. Modal de búsqueda de divisa (antes `app-busca-divisa`, ruta propia `busca-divisa`)

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `BitacoraPage` (`/bitacora`) | `<ion-modal trigger="seleccionarDivisa" #modal>` con `title="Buscar divisa"`, `[listaObjeto]="listaObjDivisas"` (lista de divisas de la categoría). La entrada `objSeleccionado` existe pero hoy no se pasa | `(enviaCambioDivisa)` → `cambiarSeleccionDivisa(divisa)`; `(cerrarModal)` → `modal.dismiss()` |

Se queda como modal: el `ion-modal` con `trigger` y la plantilla `#modal` siguen en `bitacora.page.html`. El componente conserva: filtrado por texto (`busqueda`, sin distinguir mayúsculas), selección provisional (`validaObjSeleccionado`), «confirmar» (emite la divisa y cierra solo si hay selección) y «cancelar» (solo cierra). Entradas con `input()`: `listaObjeto`, `objSeleccionado`, `titulo`; salidas con `output()`: `divisaElegida` y `cerrar`.

### 5. Gráfico del balance (antes `app-grafico-stadistico`, ruta propia `grafico-stadistico`)

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `OperativasPage` (`/operativas`) | `[listoDatos]="listaDOPorCuentas()"` (operaciones de la cuenta), `[cuentaSeleccionada]="cuentaSeleccionada"` | Ninguna |

Hoy los datos entran por *setters* de `@Input` (el de `listoDatos` redibuja el gráfico en cada cambio). **Tras el cambio**: `input()` + `effect`/`computed` que redibujan en los mismos casos; mismo cálculo de etiquetas (`YYYY-MM-DD HH:mm` o «Op N»), mismas series y configuración; el gráfico se destruye en `ngOnDestroy` como hoy. La entrada `cuentaSeleccionada` se conserva.

## Enrutamiento (sin perder la navegación actual)

- **Pantallas con ruta**: ninguna cambia de URL ni de guardas: `/cuentas`, `/operativa-kelly`, `/analisis`, `/operativas`, `/bitacora`, `/login`, `/cambiar-pin`, `/planes`, `/inicio`.
- **Rutas heredadas** `modal-pin`, `busca-divisa`, `grafico-stadistico`: ninguna se navega desde el código ni desde `menu.json`; solo existen en `app.routes.ts` y en `permisos-plan.config.ts`. Como esas piezas dejan de ser páginas, la ruta no puede seguir apuntando a ellas. **Recomendación (DN-01)**: conservar las tres URLs como **redirección a `/inicio`** (nadie que tenga un marcador ve una pantalla en blanco ni un error) y mantenerlas clasificadas en `permisos-plan.config.ts` para que la spec R-04 siga cumpliéndose. Alternativa: eliminarlas del todo.
- Si se renombra una carpeta o un selector, **solo cambian nombres internos** (clase, selector, carpeta); los `routerLink` y `router.navigate` existentes no se tocan.

## Qué no cambia (sin pérdida de funcionalidad)

- Lógica, cálculos, validaciones, textos, orden de datos y llamadas a stores y servicios: se **mueven**, no se reescriben.
- El hash del PIN, el bloqueo, la suscripción inicial y el resultado `{ omitido, pinCreado }`.
- El filtro de divisas, el tope de cuentas del plan y los límites por plan (`planVigente.limites`).
- Los guardas de las pantallas (`GuardAutenticacion`, `planGuard`, `GuardRoles`).
- El número y el orden de peticiones al servidor de cada pantalla.
- 422 reservado y mensajes del `errorInterceptor`.

## Rendimiento (la app debe quedar igual o mejor)

- Componentes con `OnPush` y `computed`; sin suscripciones nuevas ni cargas duplicadas **nuevas**.
- Menos inyecciones por componente; un solo punto de carga por pantalla.
- Las redirecciones de las 3 rutas heredadas ya no cargan esos *chunks* con `PreloadAllModules`.
- Criterio: bundle inicial no mayor que el actual y mismas peticiones de red en las pantallas afectadas (comparación con `ng build` y con la pestaña de red antes y después).

## Criterios de aceptación

| # | Criterio |
|---|----------|
| CA-1 | Ninguna clase `*Page` sin ruta se usa dentro de otra plantilla como pieza. Verificación con grep de selectores |
| CA-2 | Los 5 elementos del inventario son `*Component` presentacionales: `input()`/`output()`, `OnPush`, **sin `inject`** |
| CA-3 | Cada anfitrión del mapa de uso conserva sus entradas y salidas: mismos valores de ida y de vuelta, mismos manejadores en la página |
| CA-4 | El PIN y la búsqueda de divisa siguen abriéndose en `ion-modal` en `login`, `cambiar-pin` y `bitacora`, con los mismos puntos de ruptura, `trigger` y eventos; el límite de plan sigue siendo alert |
| CA-5 | El PIN se crea, se omite y se cambia igual que hoy; `willDismiss` recibe el mismo `{ omitido, pinCreado }`; el login y `cambiar-pin` navegan a `/inicio` como hoy |
| CA-6 | En `/analisis` y `/operativas` la selección de cuenta dispara las mismas peticiones, en el mismo orden y número que hoy (incluida la carga inicial de la primera cuenta y la doble llamada de `/operativas`) |
| CA-7 | «Ver planes» lleva a `/planes` desde `/cuentas`, `/operativa-kelly`, `/analisis` y `/operativas` con el mismo mensaje |
| CA-8 | La búsqueda de divisa filtra igual; confirmar solo emite con selección; cancelar solo cierra |
| CA-9 | El gráfico se dibuja y se redibuja en los mismos casos y con los mismos datos que hoy |
| CA-10 | Las URLs de las pantallas no cambian; las 3 rutas heredadas redirigen a `/inicio` (DN-01); `app.routes.ts` y `permisos-plan.config.ts` coherentes y la spec R-04 pasa |
| CA-11 | Los specs existentes se mueven con su pieza y cubren las mismas reglas; no se pierde ninguna prueba |
| CA-12 | `ng lint`, `ng build` y `ng test` sin fallos nuevos frente a la línea base (4 fallos conocidos: AppComponent, «primer pago», «plan pendiente normal», PV-19) |
| CA-13 | Bundle inicial no mayor que el de antes y mismas peticiones de red en las pantallas afectadas |
| CA-14 | Documentación (`CLAUDE.md`, `README.md`) con el estándar y la tabla de piezas |
| CA-15 | En los 5 componentes: sin `@Input`/`@Output`/`EventEmitter`/`@ViewChild`, sin `*ngIf`/`*ngFor`, sin `any` y sin bucles `while`+`setTimeout`; verificado con grep |
| CA-16 | El estado asíncrono del PIN vive en `PinFormularioStore` (`signalStore` con `loading`/`error`, `rxMethod` y `patchState`); el resto del estado de UI es `signal`/`computed` |
| CA-17 | Ningún componente nuevo usa `ModalController`; el cierre del modal lo hace el anfitrión con el `ion-modal` |

## Riesgos y decisiones por confirmar

| # | Tema | Recomendación |
|---|------|---------------|
| DN-01 | Rutas `modal-pin`, `busca-divisa`, `grafico-stadistico` | Redirigir a `/inicio` (mantiene las URLs). Alternativa: eliminarlas |
| DN-02 | Nombre del gráfico («Stadistico» es errata) | `GraficoEstadisticoComponent` |
| DN-03 | Doble llamada a `obtenerDetallePorCuentas` en `/operativas` al elegir cuenta | **Dejarla igual** en esta historia; reducirla es una mejora posterior |
| R-1 | `ModalPinPage` mezcla modal, formulario y stores; es lo más delicado (hash, bloqueo, login) | Tarea propia, con spec del login y del cambio de PIN y prueba manual |
| R-2 | El selector de cuentas hoy carga y consulta por su cuenta; si se mueve mal se duplican o se pierden peticiones | Tabla de «comportamiento actual → quién lo hace», con spec que cuente llamadas a los stores |
| R-3 | El gráfico usa *setters* con efectos | `input()` + `effect`; spec con los mismos datos de entrada |
| R-4 | Archivos con CRLF al editar | Mantener los finales de línea |
| R-5 | Cambiar `@Input` por `input()` altera cuándo se leen los valores (hoy `BuscaDivisaPage` copia la lista y la selección en `ngOnInit`) | Mantener el mismo momento de lectura (`computed`/`effect` sobre la entrada) y un spec que abra el modal con lista y selección previas |
| R-6 | El `PinFormularioStore` es nuevo: no debe cambiar el hash ni los mensajes | Reutilizar `generarHashPin` y `DbPIN*Store` tal cual; spec con los mismos casos del flujo actual (guardar, error, omitir) |

## Planificación sugerida (HLT a crear al aprobar)

1. HLT-36 · `AlertaLimitePlanComponent` (sin `Router`; las 4 páginas navegan a `/planes`).
2. HLT-37 · `SeleccionarCuentasComponent` (la carga de cuentas y las llamadas a `reportesStore` pasan a `AnalisisPage` y `OperativasPage`, conservando el orden).
3. HLT-38 · `ModalBuscaDivisaComponent` y `GraficoEstadisticoComponent`.
4. HLT-39 · `ModalPinComponent` + `PinFormularioStore` (modal anfitrión intacto en `login` y `cambiar-pin`).
5. HLT-40 · Rutas heredadas (DN-01), permisos, greps de cierre, comparación de rendimiento (`ng build` y red antes/después), documentación y prueba manual.
