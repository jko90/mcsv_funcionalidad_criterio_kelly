# HLT-41-v1 — App: inventario real, línea base y herramienta de reubicación (HU-002)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-002-estructura-por-dominios-app.md` (rev. 2) |
| Numeración | **HLT-41-v1 (este)** → HLT-42 (compartidos) → HLT-43 (configuracion) → HLT-44 (administracion y reportes) → HLT-45 (negocio) → HLT-46 (general) → HLT-47 (cierre) |
| Proyecto y git | `criterioKellyApp` (git propio). Sin backend ni BD. Sin carpeta de evidencias |
| Agente | `desarrollador-ionic` en todas las tareas |
| Depende de | HU-006 y HU-007 implementadas; **árbol de trabajo limpio** (lo anterior ya confirmado por el usuario) |
| Entorno | Ionic 8 / Angular 20; tests con Edge: `CHROME_BIN="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`, `--browsers=ChromeHeadless --reporters=dots` |
| Estado | Pendiente de ejecución. Decisiones por defecto: DN-01, DN-02, DN-03 (aviso), DN-04 de HU-002 |

> **Reglas de entorno (valen para HLT-41…47).** MySQL/Apache intocables; **ningún comando git que modifique el índice o el árbol** (nada de `add`, `rm`, `reset`, `checkout`, `stash`, `commit`, `mv`; solo lectura: `status`, `diff`, `log`); sin evidencias ni informes `.md`; no abrir `.env`; español; **respetar los finales de línea (CRLF/LF) de cada archivo**; los movimientos son del sistema de archivos y git detecta los renombres cuando el usuario confirma.

---

## H1 · Propósito

1. Fijar la **línea base** (`ng test`, `ng build` desarrollo y producción, tamaño del bundle, URLs de `app.routes.ts`).
2. Producir el **inventario real**: cada archivo de `src/app` con su destino definitivo según la regla «dónde va cada cosa» de HU-002, midiendo con `grep` qué subdominios y dominios usa cada pieza.
3. Crear la **herramienta de reubicación** que mueve archivos y reescribe importaciones de forma comprobable, para que HLT-42…46 no dependan de ediciones a mano.
4. Añadir la regla ESLint `no-restricted-imports` en **modo aviso** (DN-03).

**Fuera de alcance.** Mover código de la app (eso empieza en HLT-42).

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | La regla manda sobre la tabla | Si el uso real (grep) contradice la tabla de HU-002, **gana la regla**: una pieza que usan varios **dominios** va a `compartidos/`; varios **subdominios** del mismo dominio, a `<dominio>/compartido/`; un solo subdominio, a ese subdominio |
| RN-02 | Casos a decidir con grep | `dbPIN-*`, `pin-bloqueo.feature`, `hash-pin`, `pin-bloqueo.modelo` (los usa `general/autenticacion` y `configuracion`), `dbkelly-*` (los usan `cuentas`, `operativa-kelly` y `bitacora-fin`), `reportesStore`, `CuentaStore`, `ServicioAutenticacion` |
| RN-03 | Herramienta | `herramientas/reubicar.mjs` (Node, sin dependencias): lee un JSON `origen → destino`, mueve (con `fs.rename`), y reescribe **todas** las referencias a los archivos movidos |
| RN-04 | Referencias que reescribe | `import … from` y `import()` (relativos y absolutos `src/app/…`), `export … from`, `templateUrl`, `styleUrls`, `loadComponent`, y referencias en `angular.json`/`tsconfig*.json`/`ngsw-config.json` si las hubiera; también `@use`/`@import` de `scss` relativos |
| RN-05 | No altera contenido | Solo cambia las cadenas de ruta; conserva finales de línea, espacios y orden. Modo `--simular` imprime el plan y el número de archivos y líneas afectados sin escribir |
| RN-06 | Comprobable | Tras mover, el recuento de archivos es el mismo y `tsc` compila; `--verificar` busca rutas colgantes (imports a archivos que no existen) |
| RN-07 | Specs | Los `*.spec.ts` se mueven junto a su archivo (mismo prefijo) |
| RN-08 | Regla ESLint en aviso | `no-restricted-imports` (o `no-restricted-paths` si ya está disponible) con las dependencias de HU-002; nivel `warn`; `ng lint` sigue pasando |

---

## H3 · Qué se crea

- `criterioKellyApp/herramientas/reubicar.mjs` (+ README breve dentro del propio archivo en comentarios, no archivo aparte) y un ejemplo de mapa `herramientas/ejemplo-mapa.json` mínimo para probarlo en una carpeta temporal.
- Cambio de configuración en `eslint.config.js` (o el que use el proyecto) con la regla en aviso.
- **Sin cambios** en `src/app`.

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Línea base (en primer plano, sin editar nada) | solo lectura | — | `ng test --watch=false`: nº de pruebas y los 4 fallos conocidos (AppComponent, «primer pago», «plan pendiente normal», PV-19; más el intermitente de `CoordinadorPestanasService`); `ng build` desarrollo y producción con tamaño del bundle inicial; copia de la lista de rutas de `app.routes.ts` | HU-002 CA-6, CA-7 |
| T-02 | Inventario | solo lectura | T-01 | Lista de todos los `.ts`, `.html`, `.scss` y specs de `src/app` con su destino (RN-01); para cada pieza de RN-02, el resultado del grep (quién la importa, de qué subdominio y dominio) y el destino que resulta | HU-002 CA-1 |
| T-03 | Dependencias cruzadas | solo lectura | T-02 | Tabla de las importaciones entre subdominios y dominios que existen hoy; las que no están en la lista permitida de HU-002 se listan para decisión | HU-002 CA-8 |
| T-04 | Herramienta | `herramientas/reubicar.mjs` | T-02 | RN-03…RN-07. Probada en una **copia temporal** (carpeta bajo el scratchpad, nunca en el repo): mueve 3 archivos de ejemplo, reescribe sus importaciones y `tsc` compila | RN-03…RN-07 |
| T-05 | Mapa definitivo | informe en la respuesta final (no en archivo) | T-03 | Tabla origen → destino por oleada (HLT-42…46) con las decisiones de RN-02 resueltas | HU-002 CA-1, CA-2 |
| T-06 | Regla ESLint en aviso | `eslint.config.js` | T-03 | RN-08; `ng lint` termina sin errores (los avisos se cuentan y se informan) | HU-002 CA-8 |
| T-07 | Verificación | `tsc`, `ng lint`, `ng build` | T-06 | Sin cambios de comportamiento; `git diff --stat` muestra solo `herramientas/` y la configuración de ESLint | — |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07.

**Compuerta del usuario.** Revisar y aprobar el mapa definitivo (T-05) y los casos de RN-02 antes de ejecutar HLT-42. Respuesta esperada: «MAPA HU-002 APROBADO».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | La herramienta reescribe mal una ruta | Alta | Modo `--simular`, prueba en copia temporal, `--verificar` y el compilador como segunda barrera |
| R-02 | Árbol sucio al empezar | Media | Precondición: `git status` limpio; si no, detener y avisar |
| R-03 | Decisiones de ubicación contradictorias | Media | RN-01 y compuerta del usuario |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1 archivos, C2 criterio, C3 reglas de entorno, C4 `ng lint`, C5 `ng test`.
