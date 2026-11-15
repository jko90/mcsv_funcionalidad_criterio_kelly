# HLT-36-v1 — App: `ModalActualizaPlanPage` pasa a `AlertaLimitePlanComponent` (HU-007)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-007-componentes-reutilizables-fuera-de-paginas.md` (pieza 1) |
| Numeración | **HLT-36-v1 (este)** → HLT-37 → HLT-38 → HLT-39 → HLT-40 (cierre) |
| Proyecto y git | `criterioKellyApp` (git propio). Sin backend ni BD. Sin carpeta de evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | HU-006 implementada (`app-alerta-ck`, `textos-alertas.ts`) |
| Entorno | Ionic 8 / Angular 20 / NgRx Signals; tests con Edge: `CHROME_BIN="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`, `--browsers=ChromeHeadless --reporters=dots` |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** MySQL/Apache intocables; sin git de escritura; sin evidencias; no abrir `.env`; español; **respetar los finales de línea CRLF** de los archivos al editarlos.

---

## H1 · Propósito

La pieza `ModalActualizaPlanPage` (`compartidos/modal-actualiza-plan/`) **ya es un alert** (desde HLT-32) pero conserva nombre y sufijo de página y usa `inject(Router)`. Se convierte en el componente presentacional `AlertaLimitePlanComponent` **sin cambiar lo que ve ni hace la persona**.

**Fuera de alcance.** Cambiar mensajes, límites del plan o la navegación; tocar las otras piezas de HU-007.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Estándar | `standalone`, `OnPush`, `input()`/`output()`, **sin `inject`**, control de flujo nativo. Selector `app-alerta-limite-plan`, carpeta `compartidos/alerta-limite-plan/` |
| RN-02 | Entradas | `abierta: boolean` (antes `mostrarModal`), `mensaje: string \| null` (si es `null`, el de `ALERTA_LIMITE_PLAN`) y `titulo` opcional (por defecto `ALERTA_LIMITE_PLAN.titulo`) |
| RN-03 | Salidas | `verPlanes` (botón «Ver planes») y `cerrado` (botón «Ahora no» o cierre del alert) |
| RN-04 | Sigue siendo alert | Se apoya en `app-alerta-ck` tipo `confirmacion` con «Ver planes» / «Ahora no» exactamente como hoy |
| RN-05 | Navegación | Cada página anfitriona, al recibir `verPlanes`: **primero cierra su señal y después** navega a `RUTA_PLANES` (`/planes`), el mismo orden de hoy (`cerrarModal()` y luego `router.navigate`). `cerrado` solo cierra su señal |
| RN-06 | Sin pérdida | Mismo mensaje por pantalla y mismos disparadores |

### Mapa de uso (no cambia el anfitrión, solo los nombres de entrada y salida)

| Anfitrión (ruta) | Ida | Vuelta |
|------------------|-----|--------|
| `CuentasPage` (`/cuentas`) | `[abierta]="mostrarModalPlan()"`, `[mensaje]="mensajeTopeCuentas()"` | `(cerrado)` → `cerrarModalPlan()`; `(verPlanes)` → cierra y navega a `/planes` |
| `OperativaKellyPage` (`/operativa-kelly`) | `[abierta]="mostrarModalPlan()"`, `[mensaje]="textoDivisorFijo"` | ídem |
| `AnalisisPage` (`/analisis`) | `[abierta]="mostrarModal()"`, `[mensaje]="textoFuncionNoIncluida"` | `(cerrado)` → `cerrarModal()`; `(verPlanes)` ídem |
| `OperativasPage` (`/operativas`) | `[abierta]="mostrarModalPlan()"`, `[mensaje]="textoFuncionNoIncluida"` | `(cerrado)` → `cerrarModalPlan()`; `(verPlanes)` ídem |

---

## H3 · Qué se crea, modifica y borra

- **Crea** `compartidos/alerta-limite-plan/alerta-limite-plan.component.{ts,html,spec.ts}` (sin `scss`: hoy el de la pieza está vacío).
- **Modifica** `paginas/configuracion/cuentas`, `paginas/configuracion/operativa-kelly`, `paginas/reportes/analisis`, `paginas/reportes/operativas` (`.ts`, `.html` y specs afectados): nuevo selector, entradas y salidas, y el manejador de `verPlanes`. Si la página no tiene `Router` inyectado, se inyecta en la **página** (no en el componente).
- **Borra** `compartidos/modal-actualiza-plan/` completa **después** de migrar los 4 anfitriones.

**Verificación con grep.**
```
grep -rn "app-modal-actualiza-plan\|ModalActualizaPlanPage\|modal-actualiza-plan" criterioKellyApp/src  -> sin resultados
grep -n "inject" criterioKellyApp/src/app/compartidos/alerta-limite-plan/alerta-limite-plan.component.ts  -> sin resultados
```

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Línea base | solo lectura | — | `ng test --watch=false` registrado: 4 fallos conocidos (AppComponent, «primer pago», «plan pendiente normal», PV-19) y el intermitente de `CoordinadorPestanasService`; `ng build` anotado (tamaño del bundle inicial) | — |
| T-02 | Componente nuevo + spec | `alerta-limite-plan.component.*` | T-01 | RN-01…RN-04; spec: abierta+mensaje muestra el mensaje; null usa el de respaldo; «Ver planes» emite `verPlanes`; «Ahora no» emite `cerrado`; no emite los dos | RN-01…RN-04 |
| T-03 | Migrar `CuentasPage` y `OperativaKellyPage` | `.ts`, `.html`, specs | T-02 | RN-05; el tope de cuentas y el divisor fijo siguen mostrando el mismo mensaje | RN-05, RN-06 |
| T-04 | Migrar `AnalisisPage` y `OperativasPage` | `.ts`, `.html`, specs | T-02 | RN-05; las funciones del plan bloqueadas siguen abriendo el aviso | RN-05, RN-06 |
| T-05 | Borrar la pieza antigua | `compartidos/modal-actualiza-plan/` | T-03, T-04 | Greps de H3 sin resultados; sin imports rotos | — |
| T-06 | Verificación | `npx tsc --noEmit -p tsconfig.app.json`, `ng lint`, `ng build --configuration development`, `ng test` | T-05 | Sin fallos nuevos frente a T-01; bundle inicial no mayor | HU-007 CA-7, CA-12, CA-13 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario.** M-01: superar el tope de cuentas (`/cuentas`), tocar el divisor fijo (`/operativa-kelly`), una función no incluida en `/analisis` y en `/operativas`: el aviso sale con el mismo mensaje; «Ahora no» solo cierra y «Ver planes» lleva a `/planes`. Respuesta esperada: «PRUEBA MANUAL HLT-36 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Cambiar el orden cierre → navegación | Baja | RN-05 y un spec por página con el orden verificado |
| R-02 | Olvidar un anfitrión | Media | Grep de H3 |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1 archivos, C2 criterio, C3 reglas de entorno, C4 `ng lint`, C5 `ng test` del archivo.
