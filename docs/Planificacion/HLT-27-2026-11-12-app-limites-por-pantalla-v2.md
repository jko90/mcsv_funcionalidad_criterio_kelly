# HLT-27-v2 — App: límites de cada plan en `/operativas`, `/analisis`, `/cuentas`, `/operativa-kelly` y `/mostrar-criterio-kelly` (HU-005 rev. 3: matriz definitiva con columnas reutilizadas, D-01…D-05; DN-02, DN-03, DN-04, DN-08)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; reemplaza a la versión anterior de HLT-27, eliminada el 2026-11-12) |
| Historia | `docs/Historia_usuario/HU-005-control-por-plan-comprobante-y-administracion.md` (rev. 3), propuesta §3 (matriz definitiva y «Comportamiento común») y criterios **D-01…D-05**, A-03 (pantalla de planes) |
| Numeración | Vigentes: HLT-15-v2 · HLT-16-v4 · HLT-17-v4 · HLT-18 · HLT-19-v2 · HLT-20-v2 · HLT-21-v2 · HLT-24-v2 · HLT-25-v2 · HLT-26-v2 · **HLT-27-v2 (este)** · HLT-28-v2 |
| Proyecto y git | `criterioKellyApp` (git propio) y `docs/Planificacion/evidencias/` |
| Agente | `desarrollador-ionic` en todas las tareas |
| Depende de | **HLT-16-v4 y HLT-24-v2 COMPLETADOS** (`limites` en `planVigente`, columnas de límite en `planes/disponible`; recortes y `fechaDesde`/`fechaHasta` en el servidor; 403 de límite) y **HLT-19-v2/HLT-20-v2 COMPLETADOS** (`LimitesPlan` en `PlanVigente.modelo.ts`, `permisos-plan.config.ts`, `PlanVigenteStore`). Se comprueba en T-01 |
| Lo consume | HLT-28-v2 |
| Entorno | Ionic 8 / Angular 20 / NgRx Signals |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 3) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) MySQL/Apache intocables. (2) Commits del usuario; hash = `➖`. (3) Sin reportes `.md` en `evidencias/`. (4) Cuentas `ck_prueba_hu5_*`. (5) Los límites salen **siempre** de `PlanVigenteStore` (servidor); ningún número de límite escrito en el código de la app. (6) Los componentes presentacionales no deciden permisos (F-10 de HU-004).

---

## H1 · Propósito

**Requerimiento literal (HU-005 rev. 2).** Matriz definitiva: «`/operativas` · días de reporte hacia atrás 8/15/30/sin límite · «Graficar operaciones» no/no («Actualiza su plan para poder visualizar»)/sí/sí · «Exportar a PDF» no/sí/sí/sí · `/analisis` · rango máximo del filtro de fechas 5/5/30 días/libre · operaciones del listado 5/5/30/sin límite · «Exportar a Excel» no/sí/sí/sí · `/cuentas` · cuentas 1/1/5/10 · `/operativa-kelly` · cambiar el divisor no (fijo en 10)/no/sí/sí · `/mostrar-criterio-kelly` · operaciones diarias 1/1/5/sin límite». «Una función **no incluida** sigue visible; al tocarla muestra «Actualiza su plan para poder visualizar» con un botón a la pantalla de planes […]. Un límite **por cantidad o por días** recorta lo que se muestra y lo dice: «Tu plan muestra los últimos 8 días. Actualiza tu plan para ver más». Al alcanzar el **tope de cuentas**, «Crear cuenta» muestra «Tu plan permite N cuentas». […] Con el **divisor fijo**, el modal del divisor muestra 10 sin poder editarlo.» · **D-01…D-05**, **A-03**.

**Propósito.** Mostrar en cada pantalla lo que el plan permite, con avisos claros, sin decidir nada que el servidor no respalde.

**Resultado esperado (observable).**
1. `permisos-plan.config.ts` exporta `limitesPantalla(plan)` a partir de `plan.limites` y todas las páginas lo consumen desde `PlanVigenteStore`.
2. `/operativas`: aviso de días; «Graficar operaciones» y «Exportar a PDF» abren el modal «Actualiza su plan para poder visualizar» cuando el plan no los incluye.
3. `/analisis`: filtro de fechas nuevo (desde/hasta) que limita el rango a `diasAnalisis`; aviso de máximo de operaciones; «Descargar Bitácora en Excel» bloqueado sin `puedeDescargar`; desaparece el arreglo fijo `plan` (`analisis.page.ts:44`).
4. `/cuentas`: «Crear cuenta» muestra «Tu plan permite N cuenta(s). Actualiza tu plan para crear más» al llegar al tope; las cuentas existentes se listan todas.
5. `/operativa-kelly`: sin `divisorEditable`, el divisor se muestra como 10 y el modal informa «Tu plan usa el divisor 10. Actualiza tu plan para cambiarlo».
6. `/mostrar-criterio-kelly`: «Operaciones diarias» admite como máximo `maxOperacionesDiarias` (1 en Libre y Básico).
7. La pantalla de planes muestra los límites de cada plan al compararlos (A-03); el modal de mejora navega a `/planes`.

**Fuera de alcance.** Cambiar el backend; límites del servidor (HLT-24); otras pantallas (bitácora, perfil); límites de observaciones en análisis (no los pide la HU).

**Feature(s) afectada(s).** `src/app/paginas/suscripcion/` (`configuracion/permisos-plan.config.ts`, `modelos/PlanVigente.modelo.ts`, `modelos/Planes.modelo.ts`, `planes/`), `src/app/paginas/reportes/` (`operativas/`, `analisis/`, `servicios/reportes.service.ts`, `store/reportesStore.ts`), `src/app/paginas/configuracion/` (`cuentas/`, `operativa-kelly/`), `src/app/paginas/criterioKelly/mostrar-criterio-kelly/`, `src/app/compartidos/modal-actualiza-plan/`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Modelo | `LimitesPlan` ya existe en `PlanVigente.modelo.ts` (HLT-19-v2) con las claves de RN-25 de HLT-16-v4 (incluida `diasTotalesAnalisis`); aquí solo se comprueba que coincide campo por campo | contrato HLT-16-v4 |
| RN-02 | Configuración única | `permisos-plan.config.ts` exporta `LIMITES_SIN_RESTRICCION` (todo `null`/`true`) y `limitesPantalla(plan: PlanVigente | null): LimitesPlan` = `plan?.limites ?? LIMITES_SIN_RESTRICCION`; `PlanVigenteStore` expone el computed `limites`; ninguna página compara nombres de plan (`grep -rn "'libre'\|'basico'\|'avanzado'" src/app --include=*.ts` vacío fuera de specs) | D-04, F-10 |
| RN-03 | Modal de mejora | `ModalActualizaPlanPage` gana `input` `mensaje` (por defecto el texto actual) y `irAActualizarPlan` navega a `/planes` (hoy `'/configuracion/planes'`, `modal-actualiza-plan.page.ts:27`, ruta inexistente; la real es `app.routes.ts:166`) | D-02 |
| RN-04 | Operativas · días | Con `diasReporte` menor que `diasTotalesAnalisis` (todos salvo Enterprise y Prueba, que tienen 365/365), aviso fijo «Tu plan muestra los últimos <N> días. Actualiza tu plan para ver más» con botón a `/planes`; los datos ya llegan recortados (HLT-24 RN-07) | Matriz, D-03 |
| RN-05 | Operativas · graficar | `graficarOperacion()` (`operativas.page.ts:58`): con `puedeGraficar=false` abre el modal con «Actualiza su plan para poder visualizar» y no cambia `habilitarGrafica` | DN-02 |
| RN-06 | Operativas · PDF | `exportarAPDF()` (`operativas.page.ts:62`): con `puedeDescargar=false` abre el mismo modal y no genera el PDF | Matriz |
| RN-07 | Análisis · fechas | Selector «Desde» y «Hasta» (`ion-datetime` en `ion-modal`) en un componente presentacional `FiltroFechasComponent`; por defecto hasta = hoy y desde = hoy − (`diasAnalisis` − 1) (o sin fechas si `null`); el selector no permite fechas anteriores a hoy − (`diasTotalesAnalisis` − 1); si el rango elegido supera `diasAnalisis`, aviso «Tu plan permite consultar hasta <N> días» y se ajusta `desde`; el store envía `{fechaDesde, fechaHasta}` a `operacionAnalisis` y `observacionAnalisis` (`reportes.service.ts:27` y el de observaciones) | DN-04 |
| RN-08 | Análisis · cantidad | Con `maxOperacionesAnalisis` no nulo, aviso «Tu plan muestra hasta <N> operaciones por cuenta» | DN-04 |
| RN-09 | Análisis · Excel | `exportarAExcel()` usa `puedeDescargar` en lugar de `this.plan[0]` (`analisis.page.ts:83`); se elimina `plan` (`:44`) y la rama de `bitacoraOperacionCapturada` que dependía de él (`:65`), mostrando todas las observaciones recibidas | Matriz |
| RN-10 | Cuentas · tope | El botón `crearCuentaBtn` (`cuentas.page.html:9`) deja de abrir el modal por `trigger` (`:17`) y llama a un método que, con `numCuentas` no nulo y `listaCuentas().length >= numCuentas`, muestra el modal con «Tu plan permite <N> cuenta(s). Actualiza tu plan para crear más»; si no, abre el modal de creación; un 403 del servidor muestra su mensaje (interceptor) | E-01, DN-08 |
| RN-11 | Divisor | `abrirModalCuenta` (`operativa-kelly.page.ts:89`): con `divisorEditable=false` muestra «Tu plan usa el divisor 10. Actualiza tu plan para cambiarlo» con botón a `/planes` y no abre la edición; la lista muestra 10 para todas las cuentas (el valor guardado en el dispositivo no se borra); el «10» no se escribe como literal nuevo: se reutiliza la constante de divisor recomendado ya existente en la página (alerta «Lo recomendable es 10») o se declara una `DIVISOR_KELLY_RECOMENDADO` única | DN-01, matriz |
| RN-12 | Operaciones diarias | `numOperativasControl` (`mostrar-criterio-kelly.page.ts:55`) con `Validators.max(maxOperacionesDiarias)` cuando no es `null`; un valor mayor se ajusta al máximo y se muestra «Tu plan permite <N> operación(es) diaria(s)»; el atributo `max` del `ion-input` (`mostrar-criterio-kelly.page.html:71-76`) refleja el límite | DN-03 |
| RN-13 | Planes · comparación | `PlanesPage` muestra por plan: cuentas, días de reporte, rango de análisis, operaciones de análisis, graficar, descargas, divisor editable, operaciones diarias («Sin límite» para `null`); `Planes.modelo.ts` gana los 8 campos que añade `planes/disponible` (RN-16 de HLT-16-v4: `pla_diasHistorial`, `pla_diasTotales`, `pla_bloqueoDias`, `pla_puedeDescargar`, `pla_rangoLibre`, `pla_puedeGraficar`, `pla_divisorEditable`, `pla_maxOperacionesDiarias`); en la comparación, «Sin límite» cuando `pla_rangoLibre = 1` (análisis) o `pla_maxOperacionesDiarias` es `null` | A-03 |
| RN-14 | Cambio de plan en caliente | Todas las páginas leen los computed de `PlanVigenteStore`; al recargarse el plan (HLT-19) los avisos y bloqueos cambian sin cerrar sesión | D-05 |
| RN-15 | Sin cambios para planes sin límite | Con los límites de Enterprise y Prueba (10 cuentas, 365 días, análisis libre, todo permitido) ninguna pantalla muestra avisos ni bloqueos; `NUNCA_TUVO_PLAN` recibe del servidor los límites del Libre (decisión 4) y el comportamiento es el de la línea base | F-02 |

---

## H3 · Flujo principal de ejecución

```
PlanVigenteStore (HLT-19) ─computed limites─▶ limitesPantalla() (permisos-plan.config.ts)
 ├ OperativasPage: aviso días │ graficarOperacion/exportarAPDF → ¿permitido? → acción : ModalActualizaPlan(mensaje)
 ├ AnalisisPage: FiltroFechasComponent(rango, limiteDias) → ReportesStore.cargarOperacionesParaAnalisis({fechaDesde, fechaHasta})
 │               → POST criterioKelly/operacionAnalisis y observacionAnalisis (servidor recorta) │ Excel → ¿puedeDescargar?
 ├ CuentasPage: crearCuenta() → ¿tope? → ModalActualizaPlan : modal de creación → POST cuentas/nueva (403 → interceptor)
 ├ OperativaKellyPage: abrirModalCuenta → ¿divisorEditable? → edición : aviso
 └ MostrarCriterioKellyPage: numOperativasControl con máximo
```

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Prueba |
|--------------------|--------|--------|
| D-04 / RN-01, RN-02 | T-02, T-03 | `permisos-plan.config.spec.ts` (LP-01…LP-04) |
| D-02 / RN-03, RN-05, RN-06, RN-09 | T-04, T-05, T-06 | `operativas.page.spec.ts`, `analisis.page.spec.ts` |
| D-03 / RN-04, RN-07, RN-08 | T-05, T-06 | specs de páginas, `filtro-fechas.component.spec.ts` |
| Matriz cuentas / RN-10 | T-07 | `cuentas.page.spec.ts` |
| Matriz divisor / RN-11 | T-08 | `operativa-kelly.page.spec.ts` |
| DN-03 / RN-12 | T-09 | `mostrar-criterio-kelly.page.spec.ts` |
| A-03 / RN-13 | T-10 | `planes.page.spec.ts` |
| D-05, F-02 / RN-14, RN-15 | T-03…T-10 | specs con plan cambiado y con sin restricción |
| D-01 | T-12 | recorrido manual en HLT-28 |

### Discrepancias HU ↔ código
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | `/analisis` «filtro de fechas (`abrirModal`)» (S-9 de la HU) | `abrirModal()` es «Ver más» del modal de mejora (`analisis.page.html:86-97`); **no existe** filtro de fechas | Filtro nuevo (RN-07) |
| C-2 | «Graficar operaciones» | No navega: alterna `habilitarGrafica` (`operativas.page.ts:58-60`) | Bloqueo en el método (RN-05) |
| C-3 | Mensaje con botón a planes | Ya existe `ModalActualizaPlanPage` pero navega a una ruta inexistente | RN-03 |
| C-4 | Límites por plan en la app | `analisis.page.ts:44` tiene un arreglo fijo `['avanzado', 'basico']` que nunca vale `'libre'` | Se elimina (RN-09) |
| C-6 | Matriz «sin límite» de Enterprise en reportes | Columnas reutilizadas: 365 días y `pla_rangoLibre = 1` (decisión 1) | RN-04 sin aviso para 365/365; análisis sin tope con `diasAnalisis = null` |
| C-5 | «Crear cuenta» con tope | El modal se abre por `trigger="crearCuentaBtn"` (`cuentas.page.html:17`), sin punto donde interceptar | Método de clic (RN-10) |

### Checklist de calidad del HLT
- [x] 11 secciones · [x] sin marcadores · [x] cobertura 100 % · [x] criterios verificables · [x] respeta `criterioKellyApp/CLAUDE.md` y `desarrollador-ionic.md` · [x] referencias leídas el 2026-11-12 · [x] decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Límites sin plan cargado o `null` | A) bloquear; B) sin restricción | **B** | Coherente con D-03 de HLT-20 (si el plan no carga, el guarda permite) y con el servidor, que sí aplica los límites (HLT-24) | No |
| D-02 | Aviso de función no incluida | Reutilizar `ModalActualizaPlanPage` con `input` `mensaje` | cerrada | Componente existente | No |
| D-03 | Fechas por defecto en análisis | Últimos `diasAnalisis` días | cerrada | Igual que el servidor (RN-08 de HLT-24) | No |
| D-04 | Valor mostrado del divisor fijo | 10 (constante única) | cerrada | Igual que `DIVISOR_KELLY_POR_DEFECTO` del servidor | No |
| D-05 | Componente del filtro | `FiltroFechasComponent` presentacional en `paginas/reportes/componentes/` | cerrada | Lógica en la página/store | No |

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1…10 | Entendimiento, reglas, impacto, arquitectura, riesgos, simplicidad, seguridad, cobertura, determinismo, ejecutabilidad | ✅ | |

**Ataques considerados.** *Quitar el bloqueo en el navegador:* los datos ya vienen recortados y el servidor rechaza cuentas de más y fuerza el divisor (HLT-24); lo único que se gana es graficar o exportar los datos permitidos. *Editar la base local del divisor:* el servidor usa 10. *Escribir 99 en operaciones diarias:* se ajusta al máximo; es aritmética local sobre un dato ya visible. *Plan cambiado durante la sesión:* RN-14.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Graficar o exportar es solo control de la app | Baja | Operan sobre datos que el plan ya permite ver (HLT-24) |
| R-02 | Avisos que no coinciden con el recorte del servidor | Media | Mismos datos (`limites`) y misma regla de fechas (D-03); prueba manual de HLT-28 por plan |

**Rondas.** *Ronda 1 — CON CAMBIOS:* el filtro de fechas no existía (C-1); el modal navegaba a una ruta inexistente (C-3). *Ronda 2 — APROBADO.* *Ronda 3 (v2, decisiones del usuario del 2026-11-12) — APROBADO.* Columnas reutilizadas (RN-13, C-6), ventana del análisis con `diasTotalesAnalisis` (RN-07), aviso de días solo si recorta respecto a la ventana (RN-04: Enterprise ve lo mismo que hoy, F-02), `NUNCA_TUVO_PLAN` con límites del Libre (RN-15, LP-04) y modelo `LimitesPlan` creado en HLT-19-v2 (T-02 ya no toca `PlanVigente.modelo.ts`). **Veredicto: APROBADO.**

---

## H7 · Plan de tareas

Todas `desarrollador-ionic`. `A` = `criterioKellyApp/src/app`, `P` = `A/paginas/suscripcion`, `R` = `A/paginas/reportes`, `C` = `A/paginas/configuracion`, `EV` = `docs/Planificacion/evidencias`.

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | `EV/HLT-27/antes/*.txt` | — | HLT-16-v4, HLT-19-v2, HLT-20-v2 y HLT-24-v2 `COMPLETADOS` (`curl` de `planVigente` con un fixture Libre trae `limites` con `diasTotalesAnalisis`; `planes/disponible` trae las 8 columnas; `operacionAnalisis` acepta `fechaDesde`); línea base de lint, test y build | — |
| T-02 | Modelos | `P/modelos/Planes.modelo.ts` | T-01 | Los 8 campos de RN-13; `LimitesPlan` de HLT-19-v2 coincide con RN-25 de HLT-16-v4 (si no, `BLOQUEADA`); `ng lint` OK | RN-01, RN-13 |
| T-03 | Configuración y store | `P/configuracion/permisos-plan.config.ts`, `…spec.ts`, `P/store/plan-vigente.store.ts`, `…spec.ts` | T-02 | RN-02; computed `limites`; specs LP-01 Libre, LP-02 Básico, LP-03 sin plan cargado → sin restricción, LP-04 `NUNCA_TUVO_PLAN` → los límites del Libre que manda el servidor; `grep` de RN-02 vacío | RN-02, RN-14 |
| T-04 | Modal de mejora | `A/compartidos/modal-actualiza-plan/modal-actualiza-plan.page.{ts,html}`, `…spec.ts` (nuevo) | T-01 | RN-03; spec: navega a `/planes` y muestra `mensaje` | RN-03 |
| T-05 | Operativas | `R/operativas/operativas.page.{ts,html}`, `…spec.ts` (nuevo) | T-03, T-04 | RN-04…RN-06; spec: Básico no grafica y sí exporta; Libre no exporta; Enterprise sin avisos | RN-04…RN-06, RN-15 |
| T-06 | Análisis | `R/componentes/filtro-fechas/filtro-fechas.component.{ts,html,scss,spec.ts}` (nuevos), `R/analisis/analisis.page.{ts,html}`, `…spec.ts` (nuevo), `R/servicios/reportes.service.ts`, `R/store/reportesStore.ts` | T-03, T-04 | RN-07…RN-09; servicio y store aceptan `{fechaDesde?, fechaHasta?}`; spec del store verifica el cuerpo; sin `plan` fijo | RN-07…RN-09 |
| T-07 | Cuentas | `C/cuentas/cuentas.page.{ts,html}`, `…spec.ts` (nuevo) | T-03, T-04 | RN-10; spec: con 1 cuenta en Libre no abre el modal de creación; en Premium con 4 sí | RN-10 |
| T-08 | Divisor | `C/operativa-kelly/operativa-kelly.page.{ts,html}`, `…spec.ts` (nuevo) | T-03 | RN-11; spec: Básico muestra 10 y no edita; Premium edita | RN-11 |
| T-09 | Operaciones diarias | `A/paginas/criterioKelly/mostrar-criterio-kelly/mostrar-criterio-kelly.page.{ts,html}`, `…spec.ts` (nuevo) | T-03 | RN-12; spec: Libre con 3 → ajusta a 1 y avisa; Enterprise sin máximo | RN-12 |
| T-10 | Planes | `P/planes/planes.page.{ts,html}` | T-02 | RN-13; «Sin límite» para `null` | RN-13 |
| T-11 | Verificación | `EV/HLT-27/despues/{lint,test,build}.txt` | T-05…T-10 | `ng lint`, `ng test --watch=false`, `ng build` con código 0 | G-03 |
| T-12 | Documentar y entregar | `criterioKellyApp/README.md`, `criterioKellyApp/CLAUDE.md`, `EV/HLT-27/entrega.txt` | T-11 | README: «Límites por plan en la app» con la matriz y la regla «los límites salen de `planVigente.limites`»; `CLAUDE.md`: dónde viven los límites; `git status --short`; mensaje sugerido «HU-005: límites de cada plan en operativas, análisis, cuentas, divisor y criterio de Kelly»; hash `➖` | D-01 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11 → T-12.

---

## H8 · Reglas de implementación deterministas

Reglas de `desarrollador-ionic.md`.

- **RI-1.** Textos exactos: «Actualiza su plan para poder visualizar» (funciones no incluidas), «Tu plan muestra los últimos <N> días. Actualiza tu plan para ver más», «Tu plan permite consultar hasta <N> días», «Tu plan muestra hasta <N> operaciones por cuenta», «Tu plan permite <N> cuenta(s). Actualiza tu plan para crear más», «Tu plan usa el divisor 10. Actualiza tu plan para cambiarlo», «Tu plan permite <N> operación(es) diaria(s)».
- **RI-2.** Fechas del filtro en formato `YYYY-MM-DD`; el cálculo de los días usa una función pura en el archivo de configuración con la fecha de hoy inyectada (testeable sin el reloj real).
- **RI-3.** Sin tocar MySQL/Apache, sin git de escritura, sin reportes `.md`.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9; checks como HLT-25.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-02, T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-03…T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

1 Resumen · 2 Estado global · 3 Tablero · 4 Cobertura (matriz, D-01…D-05, A-03, RN-01…RN-15) · 5 Cambios `ruta:línea` · 6 Verificaciones · 7 Desviaciones · 8 Pendientes · 9 Próximos pasos (HLT-28). RR-1…RR-5.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

`limitesPantalla`, `LIMITES_SIN_RESTRICCION`, `LimitesPlan`, `FiltroFechasComponent` (`filtro-fechas.component.ts`), `DIVISOR_KELLY_RECOMENDADO`; métodos con verbo en español (`crearCuenta`, `graficarOperacion`, `exportarAPDF`); las páginas orquestan y los componentes presentacionales reciben los límites por `input()`.
