# HLT-45-v1 — App: oleada 4, dominio `negocio` (`criterio-kelly`, `bitacora`, `suscripcion`) (HU-002)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-002-estructura-por-dominios-app.md` (rev. 2) |
| Numeración | HLT-41 → HLT-42 → HLT-43 → HLT-44 → **HLT-45-v1 (este)** → HLT-46 → HLT-47 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | **HLT-44 COMPLETADO**; árbol limpio |
| Entorno | Igual que HLT-41 |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Las de HLT-41.

---

## H1 · Propósito

Crear `src/app/negocio/` con los subdominios `criterio-kelly`, `bitacora` y `suscripcion`, **moviendo** `paginas/criterioKelly/`, `paginas/planTrading/` y `paginas/suscripcion/` (excepto la página `registro`, que va a `general` en HLT-46), **sin tocar código**.

---

## H2 · Asignación (se ajusta al mapa aprobado en HLT-41)

| Origen | Destino |
|--------|---------|
| `paginas/criterioKelly/{mostrar-criterio-kelly,modelos,servicios,store}` | `negocio/criterio-kelly/{paginas/mostrar-criterio-kelly,modelos,servicios,store}/` |
| `paginas/planTrading/{bitacora,bitacora-seguimiento,bitacora-fin}`, `componentes/modal-busca-divisa`, `modelos/`, `servicios/`, `store/` | `negocio/bitacora/{paginas/<nombre>,componentes,modelos,servicios,store}/` |
| `paginas/suscripcion/{planes,comprobante}` | `negocio/suscripcion/paginas/<nombre>/` |
| `paginas/suscripcion/{aviso-bloqueo,aviso-plan,componentes/*}` | `negocio/suscripcion/componentes/<nombre>/` |
| `paginas/suscripcion/{modelos,servicios,store,configuracion}` | `negocio/suscripcion/{modelos,servicios,store,configuracion}/` |
| `paginas/suscripcion/registro/` | **Se queda para HLT-46** (va a `general/autenticacion`); en esta oleada no se mueve |
| `compartidos/servicios/acciones-externas.service.ts` | `negocio/suscripcion/servicios/` (solo lo usa `comprobante`) |

---

## H3 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Solo reubicar | `git diff` por archivo movido: solo importaciones y rutas |
| RN-02 | Sin pérdida | Mismo nº de archivos; specs movidos con su archivo |
| RN-03 | URLs y guardas | `/mostrar-criterio-kelly`, `/bitacora`, `/bitacora-seguimiento`, `/bitacora-fin`, `/planes`, `/comprobante` y sus guardas sin cambio; clasificación de `permisos-plan.config.ts` y spec R-04 iguales |
| RN-04 | `permisos-plan.config.ts` | Se mueve con el subdominio `suscripcion`; las demás partes del sistema lo importan por la ruta nueva (la herramienta lo reescribe); su contenido no cambia |
| RN-05 | Resultados idénticos | `ng test` igual a la línea base; bundle sin cambio |
| RN-06 | Dependencias | `bitacora` y `criterio-kelly` → `configuracion/cuentas` y `compartidos/`; `suscripcion` → `compartidos/`; nadie importa archivos internos de `bitacora` ni de `criterio-kelly`; `general/inicio` y `general/autenticacion` importan `suscripcion` (permitido y documentado) |

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones | solo lectura | — | HLT-44 `COMPLETADO`; `git status` limpio | — |
| T-02 | `criterio-kelly`: simulación y movimiento | `reubicar.mjs` | T-01 | `--verificar` sin colgantes; `tsc` código 0 | RN-01, RN-02 |
| T-03 | `bitacora`: simulación y movimiento | `reubicar.mjs` | T-02 | Igual | RN-01, RN-02 |
| T-04 | `suscripcion`: simulación y movimiento (sin `registro`) | `reubicar.mjs` | T-03 | Igual; `permisos-plan.config.ts` movido con sus specs | RN-02, RN-04 |
| T-05 | Verificación | `ng lint`, `ng build` (desarrollo y producción), `ng test` | T-04 | RN-03, RN-05 | RN-03, RN-05 |
| T-06 | Dependencias y carpetas | grep, `find` | T-05 | RN-06; sin carpetas vacías | RN-06 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario.** M-01: criterio Kelly (porcentaje y monto), bitácora (abrir, seguimiento, cierre, selector de divisa), planes, elegir plan, comprobante y todo su recorrido (método, datos, QR, WhatsApp), aviso de plan pendiente y cancelar plan. Respuesta esperada: «PRUEBA MANUAL HLT-45 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | `suscripcion` es la más conectada (guarda, inicio, login, registro) | Alta | La herramienta reescribe todos los anfitriones; compilar y probar; `registro` queda para HLT-46 para no mezclar |
| R-02 | Romper el recorrido de pago | Alta | Solo se mueve; specs de stores y componentes de pago sin cambio; M-01 |
| R-03 | Marcas de `localStorage` o textos que citen rutas | Baja | No cambian (no son rutas de archivo) |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-41.
