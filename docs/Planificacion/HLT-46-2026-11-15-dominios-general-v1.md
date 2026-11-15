# HLT-46-v1 — App: oleada 5, dominio `general` (`autenticacion`, `inicio`, `informacion`) y eliminación de `paginas/` (HU-002)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-002-estructura-por-dominios-app.md` (rev. 2) |
| Numeración | HLT-41 → HLT-42 → HLT-43 → HLT-44 → HLT-45 → **HLT-46-v1 (este)** → HLT-47 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | **HLT-45 COMPLETADO**; árbol limpio |
| Entorno | Igual que HLT-41 |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Las de HLT-41. **Seguridad:** esta oleada toca el login y la sesión: ningún cambio de lógica, ningún log nuevo, ningún token o PIN en pruebas.

---

## H1 · Propósito

Crear `src/app/general/` con los subdominios `autenticacion`, `inicio` e `informacion`, **moviendo** lo que queda en `paginas/util/`, `paginas/inicio/` y la página `registro` (`paginas/suscripcion/registro/`), y **eliminar la carpeta `src/app/paginas/`** (debe quedar vacía), **sin tocar código**.

---

## H2 · Asignación (se ajusta al mapa aprobado en HLT-41)

| Origen | Destino |
|--------|---------|
| `paginas/util/{login,recuperar-clave,verificar-correo}/` | `general/autenticacion/paginas/<nombre>/` |
| `paginas/suscripcion/registro/` | `general/autenticacion/paginas/registro/` |
| `paginas/util/componentes/{formulario-restablecer-clave,formulario-solicitar-codigo,formulario-verificar-correo}/` | `general/autenticacion/componentes/<nombre>/` |
| `paginas/util/{modelos,servicios,store}/*` | `general/autenticacion/{modelos,servicios,store}/` (`login.store`, `personaStore`, `recuperacion-clave.store`, `verificacion-correo.store`; modelos `Login`, `Persona`, `RecuperacionClave`, `Rol`, `VerificacionCorreo`; servicios `persona`, `recuperacion-clave`, `verificacion-correo`). `Rol.modelo.ts` y `Login.modelo.ts` ya se movieron a `compartidos/modelos/` en HLT-42 (los usa la sesión); aquí no se mueven |
| `paginas/util/{ayuda,acerca-d}/` | `general/informacion/paginas/<nombre>/` (el nombre `acerca-d` no cambia) |
| `paginas/inicio/*` | `general/inicio/paginas/inicio/` |

Al terminar, `src/app/paginas/` no existe.

---

## H3 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Solo reubicar | `git diff` por archivo movido: solo importaciones y rutas |
| RN-02 | Sin pérdida | Mismo nº de archivos; specs movidos con su archivo |
| RN-03 | URLs y guardas | `/login`, `/registro`, `/recuperar-clave`, `/verificar-correo`, `/inicio`, `/ayuda`, `/acerca-d` y sus guardas sin cambio; la ruta por defecto sigue redirigiendo a `/login`; las 3 rutas heredadas (`modal-pin`, `busca-divisa`, `grafico-stadistico`) siguen redirigiendo a `/inicio` |
| RN-04 | Sesión intacta | Sin cambios en `SesionStore`, interceptores ni guardas; el primer inicio de sesión (prueba de 24 h) y el PIN siguen igual |
| RN-05 | Resultados idénticos | `ng test` igual a la línea base; bundle sin cambio |
| RN-06 | Dependencias | `general/autenticacion` (registro) → `negocio/suscripcion` (plan reservado) y `compartidos/`; `general/inicio` → `negocio/suscripcion` y `compartidos/`; `general/informacion` solo `compartidos/` |
| RN-07 | `paginas/` eliminada | `find src/app/paginas` no devuelve nada (la carpeta ya no existe) |

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones | solo lectura | — | HLT-45 `COMPLETADO`; `git status` limpio | — |
| T-02 | `autenticacion`: simulación y movimiento (incluye `registro`) | `reubicar.mjs` | T-01 | `--verificar` sin colgantes; `tsc` código 0 | RN-01, RN-02 |
| T-03 | `informacion` e `inicio`: simulación y movimiento | `reubicar.mjs` | T-02 | Igual | RN-01, RN-02 |
| T-04 | Eliminar `paginas/` | carpeta vacía | T-03 | RN-07; si quedó algún archivo, se asigna con la regla de HU-002 y se informa | RN-07 |
| T-05 | Verificación | `ng lint`, `ng build` (desarrollo y producción), `ng test` | T-04 | RN-03, RN-05 | RN-03, RN-05 |
| T-06 | Dependencias y carpetas | grep, `find` | T-05 | RN-06; sin carpetas vacías | RN-06 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario.** M-01: registro (con plan), verificación de correo, login (con y sin PIN, primer inicio), recuperación de clave, inicio (avisos de plan), ayuda y acerca de. Respuesta esperada: «PRUEBA MANUAL HLT-46 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Romper el login o el primer inicio de sesión | Alta | Solo se mueve; specs de login, stores de sesión y plan sin cambio; M-01 |
| R-02 | Dependencia invertida de `compartidos/` hacia `Rol`/`Login` modelos | Media | El mapa de HLT-41 lo resuelve (RN-01) o queda documentada como excepción |
| R-03 | `main.ts`/`app.routes.ts` referencian páginas movidas | Media | La herramienta los reescribe; revisar la simulación |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-41.
