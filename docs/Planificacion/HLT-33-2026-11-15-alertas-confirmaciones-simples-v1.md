# HLT-33-v1 — App: confirmaciones simples con `app-alerta-ck` (HU-006)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-006-alertas-y-modales-unificados.md` |
| Numeración | HLT-31 → HLT-32 → **HLT-33-v1 (este)** → HLT-34 → HLT-35 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | **HLT-31-v1 COMPLETADO** (HLT-32 recomendado antes, no obligatorio) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Igual que HLT-31. Cada diálogo conserva textos de negocio, llamadas a stores y navegación.

---

## H1 · Propósito

Migrar de `AlertController.create` a `<app-alerta-ck>` (declarativo) las **confirmaciones e informativas sin campos**:

| Archivo | Diálogo | Tipo | Acción al confirmar |
|---------|---------|------|---------------------|
| `app.component.ts` | Nueva versión disponible | `confirmacion` («Actualizar» / «Más tarde») | Recarga/actualiza como hoy |
| `inicio.page.ts` | Cancelar plan | `destructiva` («Sí, cancelar») | `suscripcionStore.cancelarPlan()` |
| `validar-pagos.page.ts` | Aprobar pago | `confirmacion` | La acción actual del store de validación |
| `datos-pago-admin.page.ts` | Confirmaciones de cambios de datos de pago (encabezado y mensaje dinámicos) | `confirmacion` | La acción pendiente guardada en la página |
| `perfil.page.ts` | Cerrar sesiones en todos los dispositivos | `destructiva` | La acción actual |
| `modal-pin.page.ts` | Omitir PIN | `confirmacion` | `modalCtrl.dismiss({ omitido: true })` |
| `cambiar-pin.page.ts` | Olvidé mi PIN | `destructiva` | La acción actual |

(Confirmar plan se migra en HLT-32.)

**Fuera de alcance.** Alertas con campos (HLT-34); lógica de negocio; textos de negocio.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Declarativo | Cada diálogo es un `<app-alerta-ck [abierta]="…" (confirmada)="…" (cancelada)="…">` con un signal que guarda la acción pendiente; sin `AlertController` en esos archivos |
| RN-02 | Misma acción | El cuerpo de lo que corría tras `role === 'confirm'` pasa íntegro al manejador de `(confirmada)`; al cancelar no se invoca nada |
| RN-03 | Textos | Los textos salen de `textos-alertas.ts` (se amplían con los de esta tabla). Mensajes dinámicos (nombre de cuenta, plan, valor a cambiar) se pasan como `mensaje` calculado |
| RN-04 | Destructivas | `backdropDismiss=false` y botón «Sí, <acción>» |
| RN-05 | Un alert por página | Si la página tiene varios diálogos, usa un solo `app-alerta-ck` con el signal `alertaActiva` (titulo, mensaje, tipo, acción); evita varios elementos en el DOM |
| RN-06 | Estados de carga | Mientras la acción confirmada corre, el botón de origen sigue deshabilitado como hoy |

---

## H3 · Verificación con grep

```
grep -rn "alertController\.\|alertCtrl\." criterioKellyApp/src/app --include=*.ts (sin specs)
   -> solo los archivos que HLT-34 migrará (cuentas, operativa-kelly, validar-pagos rechazar, bloqueo)
```

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | solo lectura | — | HLT-31 `COMPLETADO`; `ng test` base | — |
| T-02 | Textos | `compartidos/textos-alertas.ts` | T-01 | Una constante por diálogo de H1, tono amigable | RN-03 |
| T-03 | `app.component` y `perfil` | `app.component.{ts,html}`, `perfil.page.{ts,html}` + specs | T-02 | RN-01, RN-02, RN-04; specs mockeaban `AlertController`: se reescriben contra el componente | RN-01, RN-02 |
| T-04 | `inicio` (cancelar plan) | `inicio.page.{ts,html}` | T-02 | `cancelarPlan` solo al confirmar | RN-02, RN-04 |
| T-05 | Administración | `validar-pagos.page.*`, `datos-pago-admin.page.*` | T-02 | Aprobar pago y confirmaciones de datos de pago con una sola alerta por página (RN-05); admin no confirma su propio pago (sin cambios) | RN-01, RN-05 |
| T-06 | PIN | `modal-pin.page.*`, `cambiar-pin.page.*` | T-02 | Omitir PIN cierra el modal con `{ omitido: true }`; olvidé mi PIN conserva eliminar PIN + cerrar sesión | RN-02 |
| T-07 | Verificación | `ng lint`, `ng build`, `ng test` + grep de H3 | T-03…T-06 | Sin fallos nuevos; grep cumplido | — |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07.

**Compuerta manual del usuario.** M-01: probar cada diálogo (actualizar versión si es posible, cancelar plan, aprobar pago, cambiar datos de pago, cerrar sesiones, omitir PIN, olvidé mi PIN): «No» no hace nada, «Sí» ejecuta lo de siempre. Respuesta esperada: «PRUEBA MANUAL HLT-33 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Perder el efecto del `handler` original | Alta | RN-02 y specs por diálogo con la acción espiada |
| R-02 | `modal-pin` es un modal por código: el alert vive dentro de otro overlay | Media | Probar que el alert se muestra encima y que `dismiss` del modal sigue funcionando; si falla, mantener `AlertController` ahí y documentarlo |
| R-03 | Actualización de la PWA (`app.component`) difícil de probar | Baja | Spec con `SwUpdate` simulado |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-31.
