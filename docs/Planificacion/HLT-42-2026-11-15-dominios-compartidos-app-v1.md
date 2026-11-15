# HLT-42-v1 — App: oleada 1, `compartidos/` a nivel app (HU-002)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-002-estructura-por-dominios-app.md` (rev. 2) |
| Numeración | HLT-41 → **HLT-42-v1 (este)** → HLT-43 → HLT-44 → HLT-45 → HLT-46 → HLT-47 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | **HLT-41 COMPLETADO** y mapa aprobado («MAPA HU-002 APROBADO»); árbol limpio |
| Entorno | Igual que HLT-41 |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Las de HLT-41 (sin git de escritura, respetar finales de línea, sin evidencias).

---

## H1 · Propósito

Reorganizar `src/app/compartidos/` en carpetas por tipo —`componentes`, `modelos`, `servicios`, `store`, `seguridad`, `validadores`— **sin tocar código**, usando `herramientas/reubicar.mjs`. Lo que pertenece a un solo dominio se queda para su oleada (PIN → HLT-43, etc.) según el mapa aprobado.

**Fuera de alcance.** Mover cualquier cosa de `paginas/`; cambiar lógica, nombres de clases o de archivos.

---

## H2 · Asignación (se ajusta al mapa aprobado en HLT-41)

| Origen | Destino |
|--------|---------|
| `compartidos/{encabezado,aviso-sin-conexion,alerta-ck,alerta-limite-plan,seleccionar-cuentas}/` | `compartidos/componentes/<nombre>/` (el nombre de la carpeta no cambia) |
| `compartidos/interceptors/*` | `compartidos/seguridad/interceptores/` |
| `compartidos/seguridades/{GuardAutenticacion,GuardRoles,plan.guard}.*` | `compartidos/seguridad/guardas/` |
| `compartidos/seguridades/{ServicioAutenticacion,ServicioInactividad,NombreUsuarioSesion}.ts` | `compartidos/seguridad/` |
| `compartidos/modelos/*` (salvo `pin-bloqueo.modelo.ts` si el mapa lo manda a un subdominio) | `compartidos/modelos/` (sin cambio) |
| `compartidos/servicios/*` | `compartidos/servicios/` (sin cambio de carpeta) |
| `compartidos/store/{sesion,menu,estado-aplicacion}.store.*` | `compartidos/store/` (sin cambio) |
| `compartidos/validadores/*`, `IonicComponentes.ts`, `textos-alertas.*` | sin cambio |
| `compartidos/seguridades/hash-pin.*`, `store/dbPIN-*`, `pin-bloqueo.feature.*`, `store/dbkelly-*`, `modelos/pin-bloqueo.modelo.ts` | **No se mueven aquí**: el mapa de HLT-41 decide su destino y se mueven en HLT-43 (o se quedan en `compartidos/` si los usan varios dominios) |

---

## H3 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Solo reubicar | `git diff` de cada archivo movido muestra únicamente líneas de importación o de ruta (`templateUrl`, `styleUrls`, `loadComponent`) |
| RN-02 | Sin pérdida | Mismo nº de archivos `.ts`/`.html`/`.scss` antes y después; los specs se movieron con su archivo |
| RN-03 | URLs y guardas | `app.routes.ts` conserva la misma lista de paths y guardas; solo cambian las rutas de los `import()` |
| RN-04 | Resultados idénticos | `ng test`: mismas pruebas y mismos fallos que HLT-41 T-01; bundle inicial sin cambio |
| RN-05 | Regla de dependencia | `compartidos/` no importa de ningún dominio (`paginas/`), salvo las excepciones documentadas (DN-04: `seleccionar-cuentas`, `alerta-limite-plan`) |

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones | solo lectura | — | HLT-41 `COMPLETADO`; `git status` limpio; línea base de HLT-41 vigente | — |
| T-02 | Mapa de la oleada | JSON temporal (scratchpad) | T-01 | Mapa `origen → destino` derivado de H2 y del mapa aprobado | RN-01 |
| T-03 | Simulación | `reubicar.mjs --simular` | T-02 | Informe: archivos a mover, importaciones afectadas; ninguna ruta ambigua | RN-01 |
| T-04 | Movimiento | `reubicar.mjs` | T-03 | Archivos movidos; `--verificar` sin rutas colgantes | RN-02 |
| T-05 | Compilación | `npx tsc --noEmit -p tsconfig.app.json` y `-p tsconfig.spec.json` | T-04 | Código 0; si falla, corregir solo rutas | RN-01 |
| T-06 | Verificación | `ng lint`, `ng build` (desarrollo y producción), `ng test` | T-05 | RN-03, RN-04; los avisos de la regla ESLint se informan | RN-03, RN-04 |
| T-07 | Dependencias | grep | T-06 | RN-05 verificada con salida real | RN-05 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07.

**Compuerta manual del usuario.** M-01: `ionic serve --port=8100`, recorrer login, inicio, una página de cada dominio, un alert y un modal; sin errores en la consola. Respuesta esperada: «PRUEBA MANUAL HLT-42 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Muchas importaciones (compartidos lo usan todos) | Alta | Herramienta con simulación y `--verificar`; compilar antes de seguir |
| R-02 | Interceptores o guardas referenciados en `main.ts`/`app.routes.ts` | Media | La herramienta reescribe esos archivos; revisar `main.ts` a mano en la simulación |
| R-03 | Specs que mockean rutas por cadena | Baja | `ng test` con la misma línea base |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-41.
