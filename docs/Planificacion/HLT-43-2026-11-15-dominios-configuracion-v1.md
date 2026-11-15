# HLT-43-v1 — App: oleada 2, dominio `configuracion` (HU-002)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-002-estructura-por-dominios-app.md` (rev. 2) |
| Numeración | HLT-41 → HLT-42 → **HLT-43-v1 (este)** → HLT-44 → HLT-45 → HLT-46 → HLT-47 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | **HLT-42 COMPLETADO**; árbol limpio |
| Entorno | Igual que HLT-41 |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Las de HLT-41.

---

## H1 · Propósito

Crear el dominio `src/app/configuracion/` con sus subdominios `cuentas`, `perfil`, `bloqueo-pin`, `operativa-kelly` y `compartido`, **moviendo** lo que hoy está en `paginas/configuracion/` (y la persistencia local del PIN y del divisor según el mapa aprobado), **sin tocar código**.

**Fuera de alcance.** Cambiar lógica; los otros dominios.

---

## H2 · Asignación (se ajusta al mapa aprobado en HLT-41)

| Origen | Destino |
|--------|---------|
| `paginas/configuracion/cuentas/`, `modelos/{Cuentas,Capital}.modelo.ts`, `servicios/cuentas.service.ts`, `store/cuentaStore.ts` | `configuracion/cuentas/{paginas/cuentas,modelos,servicios,store}/` |
| `paginas/configuracion/perfil/`, `componentes/formulario-cambio-clave/`, `modelos/Perfil.modelo.ts`, `servicios/perfil.service.ts`, `store/perfilStore.*` | `configuracion/perfil/{paginas/perfil,componentes,modelos,servicios,store}/` |
| `paginas/configuracion/{bloqueo,cambiar-pin}/`, `componentes/modal-pin/`, `store/pin-formulario.store.*` | `configuracion/bloqueo-pin/{paginas,componentes,store}/` |
| `compartidos/store/{dbPIN-*,dbkelly-*}`, `pin-bloqueo.feature.*`, `modelos/pin-bloqueo.modelo.ts`, `seguridad/hash-pin.ts` | **No se mueven**: los usan varios dominios (`dbPIN-*`: `configuracion` y login; `dbkelly-*`: `configuracion` y `bitacora-fin`); siguen en `compartidos/` |
| `paginas/configuracion/operativa-kelly/` | `configuracion/operativa-kelly/paginas/operativa-kelly/` |
| `compartidos/seleccionar-cuentas/` | `configuracion/cuentas/componentes/seleccionar-cuentas/` (componente de cuentas; lo usan `analisis` y `operativas`: dependencia permitida) |

---

## H3 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Solo reubicar | `git diff` por archivo movido: solo importaciones y rutas |
| RN-02 | Sin pérdida | Mismo nº de archivos; specs movidos con su archivo |
| RN-03 | URLs y guardas | `/cuentas`, `/operativa-kelly`, `/perfil`, `/cambiar-pin`, `/bloqueo` y sus guardas (`GuardAutenticacion`, `planGuard`) sin cambio |
| RN-04 | Persistencia dual intacta | La elección web/nativa sigue en el llamador; los pares `dbPIN-*` y `dbkelly-*` mantienen contenido y nombres |
| RN-05 | Resultados idénticos | `ng test` igual a la línea base; bundle sin cambio |
| RN-06 | Dependencias | Solo las permitidas de HU-002: otros dominios importan `configuracion/cuentas` (cuentas y su store); nadie importa archivos internos de `bloqueo-pin`, `perfil` ni `operativa-kelly` |

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones | solo lectura | — | HLT-42 `COMPLETADO`; `git status` limpio | — |
| T-02 | Mapa y simulación | JSON temporal, `reubicar.mjs --simular` | T-01 | Mapa según H2 y el mapa aprobado; informe sin ambigüedades | RN-01 |
| T-03 | Movimiento | `reubicar.mjs` | T-02 | `--verificar` sin rutas colgantes | RN-02 |
| T-04 | Compilación | `tsc` app y spec | T-03 | Código 0 | RN-01 |
| T-05 | Verificación | `ng lint`, `ng build` (desarrollo y producción), `ng test` | T-04 | RN-03, RN-05 | RN-03, RN-05 |
| T-06 | Dependencias y carpetas | grep, `find` | T-05 | RN-06; sin carpetas vacías | RN-06 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario.** M-01: cuentas (crear, editar, eliminar, capital), perfil (cambio de clave), PIN (crear, omitir, cambiar, bloqueo con y sin PIN) y divisor de Kelly. Respuesta esperada: «PRUEBA MANUAL HLT-43 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | `cuentas` es la pieza más usada por otros dominios | Alta | La herramienta reescribe todos los anfitriones; compilar y probar |
| R-02 | Romper el PIN/bloqueo | Alta | Solo se mueve; specs de PIN y login deben seguir igual; M-01 |
| R-03 | Mover `dbkelly-*` a un lugar que otros dominios no deberían importar | Media | RN-01 de HLT-41 y RN-06 |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-41.
