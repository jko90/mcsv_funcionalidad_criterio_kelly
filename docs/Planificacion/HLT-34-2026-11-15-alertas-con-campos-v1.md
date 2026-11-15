# HLT-34-v1 — App: alertas con campos (rechazar pago, cuentas, operativa-kelly, bloqueo) (HU-006)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-006-alertas-y-modales-unificados.md` |
| Numeración | HLT-31 → HLT-32 → HLT-33 → **HLT-34-v1 (este)** → HLT-35 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | **HLT-31-v1 COMPLETADO** (RN-04 del componente: campos y `valido`) |
| Estado | Pendiente de ejecución. Decisión DD-01 con recomendación |

> **Reglas de entorno.** Igual que HLT-31. Seguridad: los valores digitados no se registran en consola ni se guardan; el campo de contraseña es `type: 'password'`.

---

## H1 · Propósito

Migrar a `<app-alerta-ck [campos]>` los diálogos que piden pocos datos:

| Archivo | Diálogo | Campos | Validación actual a conservar |
|---------|---------|--------|-------------------------------|
| `validar-pagos.page.ts` | Rechazar pago | `textarea` (motivo) | Motivo obligatorio y su largo máximo actual |
| `cuentas.page.ts` | Crear cuenta | nombre, monto/capital | Las reglas actuales de `alertInputs`/`alertButtons` |
| `cuentas.page.ts` | Editar cuenta | nombre (y lo que tenga hoy) | Reglas actuales |
| `cuentas.page.ts` | Eliminar cuenta | sin campos | Confirmación destructiva con nombre de la cuenta |
| `cuentas.page.ts` | Aumentar / Reducir capital | monto | Monto numérico positivo; reducir no deja saldo negativo |
| `operativa-kelly.page.ts` | Editar divisor | valor | Rango y tipo actuales |
| `operativa-kelly.page.ts` | Confirmar cambio | sin campos | Mensaje actual («… Lo recomendable es 10.») |
| `bloqueo.page.ts` | Contraseña sin PIN | `password` | 3 intentos y salida de sesión; `backdropDismiss=false` |

**Fuera de alcance.** Cambiar las reglas de validación o los límites del plan; el flujo de bloqueo con PIN.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Declarativo | Cada diálogo es `app-alerta-ck` con `campos`; el padre guarda en un signal los valores y calcula `valido` con las **mismas** validaciones de hoy |
| RN-02 | No cerrar con datos inválidos | Con `valido=false` el botón confirmar devuelve `false` en el `handler` y el alert queda abierto; el padre muestra el motivo con un toast (como hoy) |
| RN-03 | Una alerta por página | En `cuentas` (4 diálogos) y `operativa-kelly` (2) se usa **un solo** `app-alerta-ck` con `alertaActiva` (RN-05 de HLT-33) |
| RN-04 | Contraseña de bloqueo | Se mantiene `claveCorrecta()` y el conteo de 3 intentos; tras el tercero cierra sesión; la contraseña no se guarda ni se loguea |
| RN-05 | Backdrop | `backdropDismiss=false` en rechazar pago, eliminar cuenta, reducir capital y bloqueo |
| RN-06 | Misma acción | Lo que corría en el `handler`/`role` actual pasa a `(confirmada)` con los valores; cancelar no hace nada |
| RN-07 | Límites de plan | Crear cuenta sigue respetando el tope del plan (`PlanVigenteStore.limites`) exactamente como hoy; no se mueve esa lógica |

---

## H3 · Decisión abierta

| ID | Decisión | Recomendación |
|----|----------|---------------|
| DD-01 | Si una validación es compleja o necesita varios campos con mensajes por campo, ¿alert o modal? | Alert para 1 a 3 campos con validación simple (todos los de H1). Si en la ejecución se descubre un diálogo que no cabe, se deja en `ion-modal` declarativo y se documenta en el informe de la tarea |

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | solo lectura | — | HLT-31 `COMPLETADO`; `ng test` base | — |
| T-02 | Textos y campos | `compartidos/textos-alertas.ts` | T-01 | Constantes de título, mensaje y definición de campos por diálogo | RN-01 |
| T-03 | Rechazar pago | `validar-pagos.page.*` | T-02 | RN-01, RN-02, RN-05, RN-06; admin no rechaza su propio pago (sin cambios); specs | RN-01, RN-02 |
| T-04 | Cuentas | `cuentas.page.*` | T-02 | Un `app-alerta-ck` para crear, editar, eliminar y capital; RN-03, RN-05, RN-07; specs de validaciones | RN-03, RN-07 |
| T-05 | Operativa Kelly | `operativa-kelly.page.*` | T-02 | Editar divisor y confirmación con una sola alerta; el divisor sigue guardándose en la BD local (web/nativo) como hoy | RN-03 |
| T-06 | Bloqueo | `bloqueo.page.*` | T-02 | RN-04; spec: 3 intentos fallidos → salir; correcta → `/inicio` | RN-04 |
| T-07 | Verificación | `ng lint`, `ng build`, `ng test`; `grep -rn "alertController\.create\|alertCtrl\.create" src/app` (sin specs) | T-03…T-06 | Sin resultados; sin fallos nuevos | HU-006 CA-2 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07.

**Compuerta manual del usuario.** M-01: rechazar pago (sin motivo no cierra), crear/editar/eliminar cuenta, aumentar/reducir capital (valores inválidos), editar divisor, bloqueo sin PIN (contraseña mala ×3 y buena). Respuesta esperada: «PRUEBA MANUAL HLT-34 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Validación que antes impedía cerrar ahora cierra | Alta | RN-02 y specs por diálogo |
| R-02 | Teclado móvil tapa el alert | Media | Revisión manual en dispositivo (CA-8 de HU-006) |
| R-03 | Perder el tope de cuentas del plan | Alta | RN-07 y spec existente de límites en `/cuentas` |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-31.
