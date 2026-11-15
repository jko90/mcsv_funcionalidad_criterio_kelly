# HLT-47-v1 — App: no regresión y cierre de HU-002 (dependencias, documentación y prueba manual)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-002-estructura-por-dominios-app.md` (rev. 2) |
| Numeración | HLT-41 → HLT-42 → HLT-43 → HLT-44 → HLT-45 → HLT-46 → **HLT-47-v1 (este, cierre)** |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | HLT-41…46 `COMPLETADOS` |
| Entorno | Igual que HLT-41 |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Las de HLT-41. En este HLT solo se actualizan `CLAUDE.md`, `README.md`, el agente `.claude/agents/desarrollador-ionic.md`, la configuración de ESLint y el estado de HU-002; no se crean informes `.md`.

---

## H1 · Propósito

Verificar que HU-002 se cumple entera (estructura, dependencias, URLs, resultados idénticos), activar la regla de dependencias en **error**, y dejar la documentación y los agentes al día.

**Fuera de alcance.** Renombrar archivos o clases, alias de importación, dividir páginas grandes (listados como fuera de alcance en HU-002).

---

## H2 · Verificaciones

| ID | Verificación | Resultado esperado |
|----|--------------|--------------------|
| V-01 | `find src/app -maxdepth 1` | Solo `app.component.*`, `app.routes.ts`, `compartidos/`, `configuracion/`, `administracion/`, `reportes/`, `negocio/` y `general/`; no existe `paginas/` |
| V-02 | Carpetas por subdominio: `find src/app/<dominio>/<subdominio> -maxdepth 1 -type d` | Solo `componentes`, `modelos`, `paginas`, `servicios`, `store` (y `configuracion` auxiliar donde ya existía); sin carpetas vacías (`find src/app -type d -empty`) |
| V-03 | `<dominio>/compartido/` | Solo existe donde hay piezas usadas por varios subdominios de ese dominio |
| V-04 | Dependencias (grep de importaciones) | Cumple las reglas de HU-002: `compartidos/` no importa de dominios (salvo las excepciones DN-04 documentadas); un subdominio no importa archivos internos de otro salvo las dependencias permitidas |
| V-05 | Sin rutas viejas | `grep -rn "paginas/" src angular.json tsconfig*.json` sin coincidencias de rutas de archivo |
| V-06 | URLs | La lista de paths de `app.routes.ts` es idéntica a la de HLT-41 T-01 |
| V-07 | Resultados | `ng test`: mismas pruebas y mismos fallos que la línea base; `ng lint`, `tsc` (app y spec) y `ng build` (desarrollo y producción) en verde; bundle inicial sin cambio |
| V-08 | Contenido intacto | Por oleada, el diff de los archivos movidos solo tiene importaciones y rutas (muestreo de 10 archivos por oleada, informado) |

---

## H3 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base de cierre | solo lectura | — | HLT-41…46 `COMPLETADOS`; `ng test` y `ng build` ejecutados antes de editar | — |
| T-02 | Verificaciones V-01, V-02, V-03, V-05, V-06 | solo lectura | T-01 | Salida real de cada comando | HU-002 CA-1, CA-2, CA-3, CA-5 |
| T-03 | Dependencias (V-04) | grep | T-02 | Informe de importaciones entre dominios y subdominios; las que no estén permitidas se listan | HU-002 CA-8 |
| T-04 | Regla ESLint en error | `eslint.config.js` | T-03 | `no-restricted-imports` pasa de `warn` a `error` **solo si** T-03 no encontró violaciones; si hay violaciones documentadas como excepción, se registran en la regla | HU-002 CA-8 |
| T-05 | Verificación general (V-07, V-08) | `tsc`, `ng lint`, `ng build`, `ng test` | T-04 | Sin fallos nuevos | HU-002 CA-4, CA-6, CA-7 |
| T-06 | Documentar | `criterioKellyApp/CLAUDE.md`, `README.md`, `.claude/agents/desarrollador-ionic.md`, estado de HU-002 | T-05 | Estructura de dominios y subdominios, regla «dónde va cada cosa», tabla de dominios, plantilla «nuevo subdominio» (carpetas a crear), rutas de ejemplos actualizadas a las nuevas; estado de HU-002: «Implementada (HLT-41…HLT-47); pendiente la prueba manual M-01» | HU-002 CA-9, CA-10 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario (cierre de HU-002).** M-01: `ionic serve --port=8100` y recorrido completo en navegador y dispositivo: registro, verificación de correo, login (primer inicio), recuperación de clave, inicio, bitácora (abrir, seguimiento, cierre), criterio Kelly, reportes y exportaciones, cuentas, perfil, PIN, planes, comprobante, validar pagos, datos de pago, ayuda y acerca de; sin errores en la consola. Respuesta esperada: «PRUEBA MANUAL HU-002 OK».

## H4 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Regla ESLint en error rompe `ng lint` por excepciones olvidadas | Media | T-03 antes de T-04; si hay dudas, se deja en aviso y se informa |
| R-02 | Documentación con rutas viejas | Baja | V-05 y revisión de `CLAUDE.md` y del agente |
| R-03 | Regresión no cubierta por specs | Media | M-01 completa |

## H5 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-41.
