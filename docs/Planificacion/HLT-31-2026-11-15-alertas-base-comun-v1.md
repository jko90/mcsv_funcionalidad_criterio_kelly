# HLT-31-v1 — App: base común de alertas amigables (componente `app-alerta-ck`, textos y estilo global) (HU-006)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-006-alertas-y-modales-unificados.md` |
| Numeración | **HLT-31-v1 (este)** → HLT-32 (avisos de plan) → HLT-33 (confirmaciones simples) → HLT-34 (alertas con campos) → HLT-35 (modales por código y cierre) |
| Proyecto y git | `criterioKellyApp` (git propio). Sin cambios en backend ni en la base de datos. Sin carpeta de evidencias |
| Agente | `desarrollador-ionic` en todas las tareas |
| Depende de | Nada. Es la base de HLT-32 a HLT-35 |
| Entorno | Ionic 8 / Angular 20 / NgRx Signals; `npm install --legacy-peer-deps`; tests con Edge: `CHROME_BIN="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`, `--browsers=ChromeHeadless --reporters=dots` |
| Estado | Pendiente de ejecución. Decisiones DD-01…DD-03 con recomendación por defecto |

> **Reglas de entorno.** MySQL/Apache intocables; sin git de escritura (el usuario hace los commits); sin archivos de evidencias; no abrir ni imprimir `.env`; todo en español.

---

## H1 · Propósito

1. Crear **una sola pieza reutilizable** para todo aviso o confirmación corto: el componente presentacional `app-alerta-ck`, que envuelve **un único `<ion-alert>` declarativo**.
2. Centralizar los textos en `compartidos/textos-alertas.ts` y el aspecto en una clase global `alerta-ck`.
3. Dejar documentado el patrón (cuándo alert, cuándo modal, cuándo toast) para que HLT-32…35 solo lo apliquen.

**Fuera de alcance.** Migrar pantallas (HLT-32…35); cambiar toasts; tocar lógica de negocio.

**Por qué un componente y no `ion-alert` suelto en cada página.** Evita repetir en 10 páginas la lógica de botones, `role`, `cssClass` y `backdropDismiss`; el componente es presentacional (`input()`/`output()`, sin `inject`), con `OnPush`, y el `ion-alert` interno solo se crea al abrirse (`[isOpen]`), sin `keepContentsMounted`. Menos código y menos nodos en el DOM que 16 `AlertController.create`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | API del componente | `inputs`: `abierta: boolean`, `titulo: string`, `mensaje: string \| null`, `tipo: 'informativa' \| 'confirmacion' \| 'destructiva'`, `textoConfirmar?`, `textoCancelar?`, `campos?: AlertInput[]`, `cerrarAlTocarFuera?: boolean`. `outputs`: `confirmada` (emite los valores de los campos o `void`), `cancelada` |
| RN-02 | Botones por tipo | `informativa`: un botón «Entendido» (`role: 'confirm'`). `confirmacion`: «No» (`role: 'cancel'`) y «Sí» (`role: 'confirm'`). `destructiva`: igual que confirmación con texto «Sí, <acción>» y `backdropDismiss=false` |
| RN-03 | Cierre | `(didDismiss)` emite `confirmada` solo si `role === 'confirm'`; en cualquier otro caso emite `cancelada`. Nunca emite las dos |
| RN-04 | Campos | Con `campos`, el `handler` del botón confirmar devuelve `false` si el padre marca `valido=false` (input `valido?: boolean`, por defecto `true`); así el alert no se cierra con datos inválidos |
| RN-05 | Estilo | `cssClass="alerta-ck"`; reglas en `src/global.scss`, con variables de `src/theme/variables.scss`; modo claro y oscuro |
| RN-06 | Textos | `compartidos/textos-alertas.ts` exporta constantes (`ALERTA_PLAN_PENDIENTE`, `ALERTA_CONFIRMAR_PLAN`, …) con `{ titulo, mensaje, textoConfirmar? }`; los de HLT-32…35 se añaden ahí. Títulos de hasta 5 palabras |
| RN-07 | Sin inyección | El componente no usa `inject`; la página orquestadora decide cuándo abrir y qué store llamar |
| RN-08 | Accesibilidad | `header` y `message` siempre presentes; botones con texto (no solo iconos) |

---

## H3 · Flujo

```
Página (orquestadora)                         app-alerta-ck (presentacional)
  signal alerta = { abierta, ...textos }  ─▶  <ion-alert [isOpen] [header] [message] [buttons] cssClass="alerta-ck">
  (confirmada)="accion()"             ◀──────  didDismiss con role 'confirm'
  (cancelada)="cerrar()"              ◀──────  didDismiss con otro role
```

---

## H4 · Qué se crea

- `src/app/compartidos/alerta-ck/alerta-ck.component.{ts,html,scss,spec.ts}` (selector `app-alerta-ck`).
- `src/app/compartidos/textos-alertas.ts` (+ spec mínima de forma).
- Clase `.alerta-ck` en `src/global.scss`.
- Sección «Alertas y modales» en `criterioKellyApp/CLAUDE.md` con la tabla alert / modal / toast de HU-006.

No se borra nada en esta tarea.

---

## H5 · Decisiones abiertas

| ID | Decisión | Recomendación |
|----|----------|---------------|
| DD-01 | Un componente envoltorio o `ion-alert` suelto en cada página | Componente envoltorio (`app-alerta-ck`) |
| DD-02 | Ubicación | `src/app/compartidos/alerta-ck/` |
| DD-03 | Iconos en el título | No; el `ion-alert` no los admite sin hacks y el peso extra no compensa |

---

## H6 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Línea base | solo lectura | — | `ng test --watch=false` registrado: 3 fallos preexistentes (AppComponent, textos-comprobante «primer pago», permisos-plan.config «plan pendiente normal») y el intermitente de `CoordinadorPestanasService` | — |
| T-02 | Tipos y textos | `compartidos/textos-alertas.ts` | T-01 | Constantes tipadas `TextoAlerta`; spec comprueba título ≤ 5 palabras y mensaje no vacío | RN-06 |
| T-03 | Componente | `compartidos/alerta-ck/alerta-ck.component.*` | T-02 | Cumple RN-01…RN-04, RN-07, RN-08; `computed` para botones; `OnPush`; import de `IonAlert` desde `IonicComponentes` | RN-01…RN-04 |
| T-04 | Estilo global | `src/global.scss` | T-03 | `.alerta-ck` aplicada; revisión en claro/oscuro; sin romper `anyComponentStyle` | RN-05 |
| T-05 | Specs del componente | `alerta-ck.component.spec.ts` | T-03 | Casos: informativa emite `confirmada`; confirmación «No» emite `cancelada`; «Sí» emite `confirmada`; destructiva no cierra al tocar fuera; con campos inválidos el handler devuelve `false`; no emite dos eventos | RN-02…RN-04 |
| T-06 | Documentar | `criterioKellyApp/CLAUDE.md` | T-05 | Sección con el patrón y la regla «prohibido `AlertController.create`» | HU-006 CA-2 |
| T-07 | Verificación | `ng lint`, `ng build --configuration development`, `ng test --watch=false` | T-06 | Sin fallos nuevos frente a T-01 | — |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07.

---

## H7 · Pruebas y riesgos

`ng lint`, `ng build`, `ng test` con Edge. Los `ion-alert` en Karma exigen `provideIonicAngular()` y esperar a que el contenido exista (patrón de `aviso-bloqueo.component.spec.ts`).

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | El `handler` que devuelve `false` no funciona igual con `isOpen` | Media | Spec T-05 lo cubre; si falla, validar en el `handler` con una función pasada por `input` |
| R-02 | Estilo global afecta otros alerts | Baja | Se aplica solo con `cssClass="alerta-ck"` |

## H8 · Seguimiento

Semántica `⬜ ✅ ❌ ➖` por tarea; ficha: C1 archivos, C2 criterio, C3 reglas de entorno, C4 `ng lint`, C5 `ng test` del archivo.
