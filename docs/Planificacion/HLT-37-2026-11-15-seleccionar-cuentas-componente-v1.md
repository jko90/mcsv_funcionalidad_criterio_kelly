# HLT-37-v1 — App: `SeleccionarCuentasPage` pasa a `SeleccionarCuentasComponent` (HU-007)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-007-componentes-reutilizables-fuera-de-paginas.md` (pieza 2) |
| Numeración | HLT-36 → **HLT-37-v1 (este)** → HLT-38 → HLT-39 → HLT-40 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | Nada obligatorio (HLT-36 recomendado antes) |
| Entorno | Igual que HLT-36 |
| Estado | Pendiente de ejecución. **El número y el orden de peticiones al servidor no pueden cambiar** |

> **Reglas de entorno.** Igual que HLT-36; respetar CRLF.

---

## H1 · Propósito

`SeleccionarCuentasPage` (`compartidos/seleccionar-cuentas/`) inyecta `ReportesStore`, `CuentaStore` y `ServicioAutenticacion`, usa `@Output`, `any` y bucles `while … setTimeout`. Pasa a ser `SeleccionarCuentasComponent` presentacional; **la carga de datos pasa a las páginas** `AnalisisPage` y `OperativasPage`, en el mismo orden y con las mismas condiciones.

**Fuera de alcance.** Reducir la doble llamada a `obtenerDetallePorCuentas` de `/operativas` (DN-03: se deja igual); cambiar los stores.

---

## H2 · Comportamiento actual que se conserva (tabla de traspaso)

| Comportamiento actual del selector | Quién lo hace después |
|------------------------------------|-----------------------|
| `ngOnInit`: lee el id del usuario (`authService.obtenerUsuarioActual()?.id \|\| 0`); si es 0 no hace nada más | La página anfitriona, **al crearse** (constructor/`ngOnInit` de la página, el mismo momento que hoy corre el `ngOnInit` del selector; **no** en `ionViewWillEnter`, que se repite en cada entrada) |
| `cuentaStore.cargarCuentas()` y espera hasta que `isLoading()` sea falso | La página, con `utilServicio.esperarCargaDeStore(() => cuentaStore.isLoading())` |
| Con cuentas cargadas llama `reportesStore.obtenerDetallePorCuentas(cuentas[0].cue_idCuentas)` y espera, **sin emitir** esa primera cuenta a la página | La página, igual (sin pasar por el manejador de selección) |
| Lista mostrada: `cuentaStore.listaCuentas` | Entrada `cuentas` del componente |
| Al elegir: guarda `cuentaSeleccionada`, **emite `cambioCuentaSeleccionada`** y luego llama `reportesStore.obtenerDetallePorCuentas(cue_idCuentas \|\| 0)` y espera | El componente emite `cuentaElegida(CuentasModelo)`; la página ejecuta, **en este orden**: (1) su manejador actual `recibeCuentaSeleccionada`, (2) la llamada a `obtenerDetallePorCuentas` que hoy hacía el selector, con la misma espera |

### Mapa de uso (rutas sin cambios)

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `AnalisisPage` (`/analisis`) | `[cuentas]="listaCuentas()"` (señal de `CuentaStore`) | `(cuentaElegida)` → `recibeCuentaSeleccionada(cuenta)` (guarda la cuenta y llama `reportesStore.obtenerListaOperacionesPorCuentas(id)`), más la llamada de detalle del selector |
| `OperativasPage` (`/operativas`) | `[cuentas]="listaCuentas()"` | `(cuentaElegida)` → `recibeCuentaSeleccionada(cuenta)` (guarda y llama `obtenerDetallePorCuentas(id)`), más la llamada de detalle del selector (queda la doble llamada actual) |

---

## H3 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Estándar | `standalone`, `OnPush`, `input()`/`output()`, **sin `inject`**, sin `any` (el evento de `ion-select` se tipa `CustomEvent<{ value: CuentasModelo }>`), `@if`/`@for` con `track`, sin `while`+`setTimeout`. Selector `app-seleccionar-cuentas`, mismo nombre de carpeta |
| RN-02 | Entradas y salidas | Entrada `cuentas: CuentasModelo[]`; salida `cuentaElegida: CuentasModelo`. Se conserva el aspecto y el `ion-select` actual |
| RN-03 | Peticiones idénticas | Cada pantalla emite **las mismas peticiones, en el mismo orden y número** que hoy, incluida la carga inicial de la primera cuenta (verificable con un spec que cuente las llamadas a `cuentaStore` y `reportesStore`) |
| RN-04 | Sin carga duplicada nueva | `cargarCuentas()` se llama **una vez** por creación de la página, como hoy |
| RN-05 | Usuario 0 | Si no hay usuario, no se carga nada, como hoy |
| RN-06 | Sin store nuevo | Se reutilizan `CuentaStore` y `ReportesStore`; no se crea un store para esto |

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Línea base | solo lectura | — | Fallos conocidos, bundle anotado; **anotar la secuencia de llamadas a `cuentaStore`/`reportesStore` de cada pantalla** leyendo los specs y el código actual | — |
| T-02 | Componente nuevo + spec | `compartidos/seleccionar-cuentas/seleccionar-cuentas.component.{ts,html,scss,spec.ts}` | T-01 | RN-01, RN-02; spec: muestra las cuentas recibidas; al elegir emite la cuenta; sin cuentas no emite | RN-01, RN-02 |
| T-03 | Migrar `AnalisisPage` | `.ts`, `.html`, spec | T-02 | Tabla de traspaso (H2); spec que verifica la secuencia de llamadas (carga de cuentas, detalle de la primera, selección) | RN-03…RN-05 |
| T-04 | Migrar `OperativasPage` | `.ts`, `.html`, spec | T-02 | Igual, con la doble llamada de detalle conservada | RN-03…RN-05 |
| T-05 | Borrar la pieza antigua | `seleccionar-cuentas.page.*` | T-03, T-04 | Sin imports rotos; grep `SeleccionarCuentasPage\|seleccionar-cuentas.page` sin resultados | — |
| T-06 | Verificación | `tsc`, `ng lint`, `ng build --configuration development`, `ng test` | T-05 | Sin fallos nuevos; bundle inicial no mayor; mismas peticiones (revisar la pestaña de red al abrir `/analisis` y `/operativas` y al elegir otra cuenta) | HU-007 CA-6, CA-12, CA-13 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario.** M-01: abrir `/analisis` y `/operativas`: se ven las cuentas y datos de la primera; elegir otra cuenta cambia la lista de operaciones y el gráfico igual que antes; volver a la pantalla no repite cargas innecesarias. Respuesta esperada: «PRUEBA MANUAL HLT-37 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Cargar en `ionViewWillEnter` (se repite) en vez de al crear la página | Alta | H2 lo prohíbe y el spec cuenta las llamadas |
| R-02 | Perder la carga inicial de la primera cuenta (no se emitía a la página) | Alta | Fila explícita en la tabla de traspaso y spec |
| R-03 | Cambiar el orden de manejador y llamada de detalle | Media | Orden fijado en H2 y spec |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-36.
