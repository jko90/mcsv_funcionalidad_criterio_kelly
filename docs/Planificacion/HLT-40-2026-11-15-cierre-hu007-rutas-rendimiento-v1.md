# HLT-40-v1 — App: no regresión y cierre de HU-007 (rutas heredadas, permisos, rendimiento y documentación)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-007-componentes-reutilizables-fuera-de-paginas.md` |
| Numeración | HLT-36 → HLT-37 → HLT-38 → HLT-39 → **HLT-40-v1 (este, cierre)** |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | HLT-36, HLT-37, HLT-38 y HLT-39 `COMPLETADOS` |
| Entorno | Igual que HLT-36 |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Igual que HLT-36. En este HLT no se crean evidencias ni informes `.md`; solo se actualizan `CLAUDE.md`, `README.md` y el estado de HU-007.

---

## H1 · Propósito

Verificar que HU-007 se cumple entera, que la app no perdió funcionalidad ni rapidez, y dejar la documentación al día.

**Fuera de alcance.** Reducir la doble llamada a `obtenerDetallePorCuentas` en `/operativas` (DN-03); cambios de negocio.

---

## H2 · Verificaciones

| ID | Verificación | Resultado esperado |
|----|--------------|--------------------|
| V-01 | Ninguna clase `*Page` sin ruta se usa como pieza: `grep -rn "app-modal-actualiza-plan\|app-seleccionar-cuentas\|app-busca-divisa\|app-grafico-stadistico\|app-modal-pin" src --include=*.html` | Solo aparecen los selectores nuevos (`app-alerta-limite-plan`, `app-seleccionar-cuentas`, `app-modal-busca-divisa`, `app-grafico-estadistico`, `app-modal-pin`) en las 7 pantallas anfitrionas |
| V-02 | Estándar en las 5 piezas: `grep -nE "@Input\|@Output\|EventEmitter\|@ViewChild\|inject\(\|ModalController\|\*ngIf\|\*ngFor\| any" <componentes>` | Sin resultados |
| V-03 | Rutas: las 3 heredadas redirigen a `/inicio`; las demás sin cambios | `app.routes.ts` coherente con HU-007 |
| V-04 | Permisos: toda ruta privada clasificada; spec R-04 en verde | Sin fallos |
| V-05 | Peticiones: en `/analisis` y `/operativas` la secuencia de llamadas es la de la línea base de HLT-37 | Igual número y orden |
| V-06 | Rendimiento: `ng build` antes y después | Bundle inicial no mayor; chunks de las 3 rutas heredadas ya no se cargan como páginas |
| V-07 | `AlertController` y `ModalController.create` ausentes de `src/app` fuera de specs | Sin resultados |

---

## H3 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones | solo lectura | — | HLT-36…39 `COMPLETADOS`; línea base de `ng test` (4 fallos conocidos: AppComponent, «primer pago», «plan pendiente normal», PV-19) y de `ng build` | — |
| T-02 | Greps V-01, V-02, V-03, V-07 | solo lectura | T-01 | Reportar la salida real de cada grep | HU-007 CA-1, CA-2, CA-10, CA-15, CA-17 |
| T-03 | Rutas y permisos | `app.routes.ts`, `permisos-plan.config.ts` y su spec | T-02 | V-03 y V-04 cumplidas; ajustes mínimos si algo quedó incoherente | HU-007 CA-10 |
| T-04 | Peticiones y rendimiento | `ng build --configuration production` y revisión de specs | T-03 | V-05 y V-06 cumplidas; reportar tamaños antes y después | HU-007 CA-6, CA-13 |
| T-05 | Verificación general | `npx tsc --noEmit -p tsconfig.app.json`, `ng lint`, `ng build --configuration development`, `ng test --watch=false --browsers=ChromeHeadless --reporters=dots` | T-04 | Sin fallos nuevos frente a T-01 | HU-007 CA-12 |
| T-06 | Documentar | `criterioKellyApp/CLAUDE.md`, `README.md`, estado de HU-007 | T-05 | `CLAUDE.md` con la tabla de piezas (pantalla vs componente vs store), el estándar de `input()`/`output()` y la regla «lo que se usa como modal es contenido de `ion-modal` en el anfitrión»; estado de HU-007: «Implementada (HLT-36…HLT-40); pendiente la prueba manual M-01» | HU-007 CA-14 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06.

**Compuerta manual del usuario (cierre de HU-007).** M-01 recorrido completo en navegador y dispositivo, modo claro y oscuro: aviso de límite de plan en `/cuentas`, `/operativa-kelly`, `/analisis` y `/operativas`; selector de cuentas y gráfico en `/analisis` y `/operativas`; selector de divisa en `/bitacora`; PIN en `/login` (crear, omitir, arrastrar) y `/cambiar-pin`; bloqueo con y sin PIN; las URLs heredadas (`/modal-pin`, `/busca-divisa`, `/grafico-stadistico`) llevan a `/inicio`. Respuesta esperada: «PRUEBA MANUAL HU-007 OK».

## H4 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Regresión no cubierta por specs | Media | M-01 completa; V-05 compara peticiones |
| R-02 | Fallos preexistentes confundidos con nuevos | Baja | Línea base de T-01 |
| R-03 | Bundle inicial crece por el nuevo store o componentes | Baja | V-06; ajustar importaciones si ocurre |

## H5 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-36.
