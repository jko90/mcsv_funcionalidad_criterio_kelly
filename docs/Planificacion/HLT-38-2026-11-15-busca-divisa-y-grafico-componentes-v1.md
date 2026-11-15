# HLT-38-v1 — App: `BuscaDivisaPage` → `ModalBuscaDivisaComponent` y `GraficoStadisticoPage` → `GraficoEstadisticoComponent` (HU-007)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-007-componentes-reutilizables-fuera-de-paginas.md` (piezas 4 y 5) |
| Numeración | HLT-36 → HLT-37 → **HLT-38-v1 (este)** → HLT-39 → HLT-40 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | Nada obligatorio |
| Entorno | Igual que HLT-36 |
| Estado | Pendiente de ejecución. Decisiones por defecto: DN-01 (rutas heredadas redirigen a `/inicio`) y DN-02 (nombre «Estadístico») |

> **Reglas de entorno.** Igual que HLT-36; respetar CRLF.

---

## H1 · Propósito

1. `BuscaDivisaPage` se usa como **contenido de un modal** (`ion-modal` en `bitacora`): pasa a `ModalBuscaDivisaComponent` y **sigue siendo modal** (el `ion-modal` con `trigger="seleccionarDivisa"` se queda en `bitacora.page.html`).
2. `GraficoStadisticoPage` se usa como **gráfico** dentro de `operativas`: pasa a `GraficoEstadisticoComponent`.
3. Las rutas `busca-divisa` y `grafico-stadistico` (nadie navega a ellas) dejan de apuntar a una página: pasan a **redirección a `/inicio`** (DN-01), para conservar las URLs sin pantalla en blanco.

**Fuera de alcance.** Cambiar el filtrado de divisas, la configuración del gráfico, o el resto de rutas.

---

## H2 · Reglas de negocio

### Modal de búsqueda de divisa

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Ubicación y nombre | `paginas/planTrading/componentes/modal-busca-divisa/modal-busca-divisa.component.*`; selector `app-modal-busca-divisa`; `standalone`, `OnPush`, sin `inject`, sin `@Input`/`@Output`/`EventEmitter` |
| RN-02 | Entradas | `listaObjeto: DivisasModelo[]` (por defecto `[]`), `objSeleccionado: DivisasModelo \| null` (por defecto `null`), `titulo: string` (por defecto «Seleccionar Divisa») |
| RN-03 | Salidas | `divisaElegida: DivisasModelo` (antes `enviaCambioDivisa`) y `cerrar: void` (antes `cerrarModal`) |
| RN-04 | Estado local | `busqueda`, `divisaProvisional` y la lista filtrada son `signal`/`computed`; sin store |
| RN-05 | Misma semántica | Filtro por texto sin distinguir mayúsculas y sin filtro si el texto está en blanco; «confirmar» emite y cierra **solo si hay selección**; «cancelar» solo cierra; la selección inicial se resuelve contra la lista recibida (`value` igual) **en el mismo momento de lectura que hoy (al abrirse el modal)** |
| RN-06 | Sigue siendo modal | El `ion-modal` anfitrión conserva `trigger`, `#modal` y `<ng-template>`; el cierre es `modal.dismiss()` desde el anfitrión |

Mapa de uso (ruta sin cambios):

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `BitacoraPage` (`/bitacora`) | `titulo="Buscar divisa"`, `[listaObjeto]="listaObjDivisas"` (la entrada `objSeleccionado` hoy no se pasa y se conserva) | `(divisaElegida)` → `cambiarSeleccionDivisa(divisa)`; `(cerrar)` → `modal.dismiss()` |

### Gráfico del balance

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-07 | Ubicación y nombre | `paginas/reportes/componentes/grafico-estadistico/grafico-estadistico.component.*`; selector `app-grafico-estadistico`; `standalone`, `OnPush`, sin `inject` |
| RN-08 | Entradas | `datos: OperacionCuentaModelo[]` (antes `listoDatos`, por defecto `[]`) y `cuentaSeleccionada: CuentasModelo \| null` (sin `any`), ambas con `input()` |
| RN-09 | Redibujado | `effect()` que redibuja cuando cambia `datos` (los mismos casos que hoy redibuja el *setter*); el lienzo se obtiene con `viewChild.required<ElementRef<HTMLCanvasElement>>('balanceChart')`; se destruye el gráfico en `ngOnDestroy`/`DestroyRef` |
| RN-10 | Mismo gráfico | Mismo cálculo de etiquetas (`YYYY-MM-DD HH:mm`, o «Op N» si la fecha falta o es inválida), mismas series, colores y configuración |
| RN-11 | Sin store | Los datos vienen por `input()` |

Mapa de uso (ruta sin cambios):

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `OperativasPage` (`/operativas`) | `[datos]="listaDOPorCuentas()"`, `[cuentaSeleccionada]="cuentaSeleccionada"` | Ninguna |

### Rutas

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-12 | Redirección | En `app.routes.ts`, `busca-divisa` y `grafico-stadistico` pasan a `{ path, redirectTo: 'inicio', pathMatch: 'full' }`; ningún `routerLink` ni `navigate` existente se toca |
| RN-13 | Permisos | Las dos rutas siguen clasificadas en `permisos-plan.config.ts` (o se ajusta la spec R-04 si una ruta de redirección no se evalúa); la spec R-04 pasa |

---

## H3 · Qué se crea, modifica y borra

- **Crea** los dos componentes con sus specs (`ModalBuscaDivisaComponent` y `GraficoEstadisticoComponent`), moviendo `html` y `scss` actuales sin cambiar su contenido visual.
- **Modifica** `bitacora.page.{ts,html}`, `operativas.page.{ts,html}`, `app.routes.ts` y, si procede, `permisos-plan.config.ts` y su spec.
- **Borra** `paginas/planTrading/busca-divisa/busca-divisa.page.*` y `paginas/reportes/grafico-stadistico/grafico-stadistico.page.*` tras migrar los anfitriones.

**Verificación con grep.**
```
grep -rn "BuscaDivisaPage\|GraficoStadisticoPage\|app-busca-divisa\|app-grafico-stadistico" criterioKellyApp/src  -> sin resultados
grep -nE "@Input|@Output|EventEmitter|@ViewChild|inject\(|\*ngIf|\*ngFor| any" <los dos componentes nuevos>  -> sin resultados
```

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Línea base | solo lectura | — | Fallos conocidos, bundle anotado; specs existentes de las dos piezas inventariadas | — |
| T-02 | `ModalBuscaDivisaComponent` + spec | carpeta nueva | T-01 | RN-01…RN-05; spec: filtra sin distinguir mayúsculas, confirmar sin selección no emite, con selección emite y cierra, cancelar solo cierra, selección inicial resuelta contra la lista | RN-01…RN-05 |
| T-03 | Migrar `BitacoraPage` | `.ts`, `.html`, spec | T-02 | RN-06; el modal sigue abriéndose por `trigger`; elegir una divisa llama `cambiarSeleccionDivisa` | RN-06 |
| T-04 | `GraficoEstadisticoComponent` + spec | carpeta nueva | T-01 | RN-07…RN-11; spec: sin datos no falla, con datos crea el gráfico, al cambiar `datos` redibuja, etiquetas «Op N» con fecha inválida | RN-07…RN-11 |
| T-05 | Migrar `OperativasPage` | `.ts`, `.html`, spec | T-04 | El gráfico recibe los mismos valores | RN-08 |
| T-06 | Rutas y permisos | `app.routes.ts`, `permisos-plan.config.ts` (+spec) | T-03, T-05 | RN-12, RN-13 | RN-12, RN-13 |
| T-07 | Borrar lo antiguo | las dos páginas | T-06 | Greps de H3 sin resultados; sin imports rotos | — |
| T-08 | Verificación | `tsc`, `ng lint`, `ng build --configuration development`, `ng test` | T-07 | Sin fallos nuevos frente a T-01; bundle inicial no mayor | HU-007 CA-8, CA-9, CA-12, CA-13 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08.

**Compuerta manual del usuario.** M-01: en `/bitacora`, abrir el selector de divisa, buscar («eur», «EUR»), elegir y confirmar, y cancelar; en `/operativas`, ver el gráfico, cambiar de cuenta y comprobar que se redibuja; abrir `/busca-divisa` y `/grafico-stadistico` en la barra de direcciones: llevan a `/inicio`. Respuesta esperada: «PRUEBA MANUAL HLT-38 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | `input()` cambia cuándo se lee la lista y la selección (hoy en `ngOnInit`) | Media | RN-05 y spec que abre el modal con lista y selección previas |
| R-02 | El gráfico no se redibuja o se duplica (fuga de instancias) | Alta | RN-09, destrucción en `DestroyRef` y spec |
| R-03 | La spec R-04 de rutas falla con las redirecciones | Media | RN-13 |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-36.
