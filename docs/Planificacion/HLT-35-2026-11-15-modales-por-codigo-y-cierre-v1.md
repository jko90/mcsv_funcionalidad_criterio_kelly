# HLT-35-v1 — App: modales creados por código, no regresión y cierre de HU-006

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-006-alertas-y-modales-unificados.md` |
| Numeración | HLT-31 → HLT-32 → HLT-33 → HLT-34 → **HLT-35-v1 (este, cierre)** |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | HLT-31, HLT-32, HLT-33 y HLT-34 `COMPLETADOS` |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Igual que HLT-31.

---

## H1 · Propósito

1. Evaluar y decidir los **2 modales creados por código** (`login.page.ts`: crear PIN con `ModalPinPage`; `cambiar-pin.page.ts`).
2. Comprobar que **todos los modales que quedan** son de contenido largo o interactivo y que ninguno es un aviso corto.
3. Verificar el cumplimiento de HU-006 (CA-1…CA-8), actualizar la documentación y cerrar.

**Fuera de alcance.** Cambiar la lógica del PIN, el hash, el bloqueo o la suscripción.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Modal de crear PIN | `ModalPinPage` pide dos PIN de 6 dígitos y tiene «Omitir»: es un formulario con vista propia. Se conserva como modal; se migra de `modalCtrl.create` a `<ion-modal [isOpen]>` declarativo **solo si** no se pierde `onWillDismiss` con `{ omitido, pinCreado }` (el login depende de ese resultado); si se pierde, se deja por código y se documenta |
| RN-02 | Modal de cambiar PIN | Igual criterio que RN-01 |
| RN-03 | Modales que se quedan | `aviso-bloqueo` (lista de planes), `detalle-pago`, `datos-pago-admin` (red y QR), `validar-pagos` (detalle), `bitacora` (selector de divisa), `filtro-fechas` (2 selectores) |
| RN-04 | Sin aviso corto en modal | `grep` de `<ion-modal` revisado a mano: ninguno contiene solo un texto y botones de aviso |
| RN-05 | Consistencia visual | Todos los `ion-modal` mantienen un estilo coherente (esquinas, encabezado, botón cerrar) con las reglas ya existentes; sin estilos nuevos por pantalla |
| RN-06 | `AlertController` | Ya no se inyecta en ninguna página/componente (fuera de specs) |

---

## H3 · Verificación final con grep

```
grep -rn "alertController\|alertCtrl\|AlertController" criterioKellyApp/src/app --include=*.ts  (sin specs) -> sin resultados
grep -rn "<ion-alert" criterioKellyApp/src/app --include=*.html -> solo dentro de app-alerta-ck y bitacora (patrón original)
grep -rn "app-alerta-ck" criterioKellyApp/src/app --include=*.html -> una por página que lo usa
```

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones | solo lectura | — | HLT-31…34 `COMPLETADOS`; línea base de `ng test` | — |
| T-02 | Modales por código | `login.page.*`, `cambiar-pin.page.*`, `modal-pin.page.*` | T-01 | RN-01, RN-02; `login` sigue navegando a `/inicio` con `omitido` o `pinCreado`; specs | RN-01, RN-02 |
| T-03 | Revisión de modales restantes | solo lectura + ajustes mínimos | T-02 | Lista de RN-03 confirmada; RN-04 y RN-05 cumplidas | RN-03…RN-05 |
| T-04 | Greps de cierre | — | T-03 | Los de H3 cumplidos; RN-06 | RN-06 |
| T-05 | Verificación | `ng lint`, `ng build --configuration development`, `ng test --watch=false` | T-04 | Sin fallos nuevos frente a la línea base | HU-006 CA-7 |
| T-06 | Documentar | `criterioKellyApp/CLAUDE.md`, `README.md`, HU-006 (estado) | T-05 | Patrón alert/modal/toast documentado; estado de HU-006 actualizado | HU-006 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario (cierre de HU-006).** M-01 recorrido completo en navegador y dispositivo, modo claro y oscuro: aviso de plan pendiente, sin plan (modal), elegir plan, límites, cancelar plan, cerrar sesiones, PIN (crear, omitir, olvidé, cambiar), cuentas, divisor, rechazar y aprobar pago, datos de pago. Respuesta esperada: «PRUEBA MANUAL HU-006 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Romper el flujo del PIN en el login | Alta | RN-01 (conservar `onWillDismiss`) y specs; ante duda se deja por código |
| R-02 | Fallos preexistentes confundidos con nuevos | Baja | Línea base de T-01 (AppComponent, textos-comprobante, permisos-plan.config, CoordinadorPestanasService intermitente) |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-31.
