# HLT-32-v1 — App: avisos de plan como alert (pendiente de pago, límite superado, conflicto al elegir plan) (HU-006)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-006-alertas-y-modales-unificados.md` |
| Numeración | HLT-31 (base) → **HLT-32-v1 (este)** → HLT-33 → HLT-34 → HLT-35 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | **HLT-31-v1 COMPLETADO** (`app-alerta-ck`, `textos-alertas.ts`, estilo `alerta-ck`) |
| Entorno | Igual que HLT-31 (Edge con `CHROME_BIN`) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** MySQL/Apache intocables; sin git de escritura; sin evidencias; no abrir `.env`; español. La decisión de permisos sigue viniendo del servidor y de `permisos-plan.config.ts`.

---

## H1 · Propósito

1. El aviso «Tu plan Básico está pendiente de pago y se activará cuando valide tu comprobante.» (y el de renovación «terminó… tienes N días para pagarlo») pasa de **modal** a **alert** informativo.
2. El límite superado (`modal-actualiza-plan`) pasa a alert con «Ver planes» / «Ahora no».
3. La alerta de conflicto al elegir plan (409) en `inicio` adopta `app-alerta-ck` y los textos comunes.
4. **La lista de planes del estado `SIN_PLAN` sigue siendo modal** (contenido largo y seleccionable), sin cambios de comportamiento.

**Fuera de alcance.** Lógica de planes, reglas del servidor, `crearSinPago`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Pendiente de pago | Estados `MINIMO_PENDIENTE` de `bloqueoVisible()`: `app-alerta-ck` tipo `informativa`; mensaje = `PlanVigenteStore.textoBloqueo()` (sin cambiar su texto); botón «Entendido» llama `alCerrarBloqueo()`. Opcional (DD-01): segundo botón «Subir comprobante» que navega a `/comprobante` cuando `puedeSubirComprobante()` |
| RN-02 | No mostrar planes con pendiente | Con plan pendiente nunca aparece la lista de planes; spec lo verifica |
| RN-03 | Sin plan | `SIN_PLAN` mantiene el modal de planes (`aviso-bloqueo`) con agrupación, confirmación y emisión de `elegirPlan` exactamente como hoy |
| RN-04 | Límite superado | `modal-actualiza-plan` → alert `confirmacion` con textos «Ver planes» (navega a `/planes`) y «Ahora no»; recibe `mensaje` igual que hoy (HLT-27) |
| RN-05 | Conflicto al elegir plan | Alert informativa con el `avisoConflictoPlan` del store, título común; «Entendido» limpia el aviso y el bloqueo (comportamiento actual) |
| RN-06 | Confirmar plan | La confirmación «¿Seguro que quieres guardar el plan: …?» de `inicio.page.ts` pasa a `app-alerta-ck` tipo `confirmacion` (conserva la llamada a `suscripcionStore.elegirPlan`) — se hace aquí porque pertenece al mismo flujo |
| RN-07 | Sin pérdida | Mismos textos de negocio, mismas llamadas a stores y misma navegación |

---

## H3 · Qué se modifica

- `paginas/suscripcion/aviso-bloqueo/aviso-bloqueo.component.{ts,html,scss,spec.ts}`: separa la rama `MINIMO_PENDIENTE` (alert) de la rama `SIN_PLAN` (modal actual).
- `compartidos/modal-actualiza-plan/*` y quienes lo abren: alert con `app-alerta-ck`.
- `paginas/inicio/inicio.page.{ts,html}`: alerta de conflicto y confirmar plan con `app-alerta-ck`; se elimina `AlertController` de lo migrado.
- `compartidos/textos-alertas.ts`: constantes `ALERTA_PLAN_PENDIENTE`, `ALERTA_LIMITE_PLAN`, `ALERTA_CONFLICTO_PLAN`, `ALERTA_CONFIRMAR_PLAN`.
- Specs de los tres componentes/páginas.

**Verificación con grep.**
```
grep -n "ion-modal" criterioKellyApp/src/app/paginas/suscripcion/aviso-bloqueo/aviso-bloqueo.component.html  -> solo la rama de lista de planes
grep -rn "alertController.create" criterioKellyApp/src/app/paginas/inicio  -> solo lo que HLT-33 migrará (cancelar plan)
```

---

## H4 · Decisiones abiertas

| ID | Decisión | Recomendación |
|----|----------|---------------|
| DD-01 | Botón «Subir comprobante» dentro del alert de plan pendiente | Sí, solo cuando `puedeSubirComprobante()` sea verdadero; el aviso queda accionable |
| DD-02 | Mostrar el alert cada vez que se toca una opción bloqueada | Sí (como hoy con el modal); sin recordatorio persistente |

---

## H5 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones | solo lectura | — | HLT-31 `COMPLETADO`; línea base de `ng test` | — |
| T-02 | Textos | `compartidos/textos-alertas.ts` | T-01 | Constantes de H3 con tono amigable aprobado | RN-01, RN-04…RN-06 |
| T-03 | Aviso pendiente | `aviso-bloqueo.component.*` | T-02 | RN-01…RN-03; spec: pendiente muestra alert sin lista; sin plan muestra modal con planes; «Entendido» emite `cerrar` | RN-01…RN-03 |
| T-04 | Límite superado | `modal-actualiza-plan` y llamadores | T-02 | RN-04; specs actualizadas | RN-04 |
| T-05 | Inicio | `inicio.page.{ts,html}` | T-03 | RN-05 y RN-06; specs de `SuscripcionStore` intactas | RN-05, RN-06 |
| T-06 | Verificación | `ng lint`, `ng build`, `ng test` | T-05 | Sin fallos nuevos frente a la línea base | — |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario.** M-01: con usuario de plan pendiente, tocar una opción bloqueada → alert con el mensaje, sin lista de planes; con usuario sin plan → modal de planes → elegir → alert «¿Seguro…?» → alert de resultado. Respuesta esperada: «PRUEBA MANUAL HLT-32 OK».

## H6 · Pruebas y riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Regresión del flujo de elegir plan | Alta | Specs existentes de `aviso-bloqueo` y `SuscripcionStore`; M-01 |
| R-02 | Dos alerts a la vez (pendiente + conflicto) | Baja | Un solo `bloqueo` visible por vez; el conflicto cierra el bloqueo |

## H7 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-31.
