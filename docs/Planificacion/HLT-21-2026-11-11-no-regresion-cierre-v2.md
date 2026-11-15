# HLT-21-v2 — No regresión, verificación global y cierre de HU-004 rev. 5 con la parte fusionada de HU-005 (criterios G-01…G-04 y definición de terminado)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; revisado el 2026-11-13 por DT-15, DT-16 y DT-17) |
| Historia | `docs/Historia_usuario/HU-004-plan-de-prueba-24-horas.md` (rev. 5), sección **G** y «Definición de terminado» |
| Numeración | Vigentes: HLT-15-v2 · HLT-16-v4 · HLT-17-v4 · HLT-18 · HLT-19-v2 · HLT-20-v2 · **HLT-21-v2 (este, cierre de HU-004)** · HLT-24-v2 · HLT-25-v2 · HLT-26-v2 · HLT-27-v2 · HLT-28-v2 |
| Proyectos y git | `rest_suscripcion`, `rest_usuario`, `rest_criteriokelly`, `criterioKellyApp` (git propios, **solo lectura** de `git status/diff/log`); `rest_divisas` y la raíz sin git (documentación) |
| Agentes | `desarrollador-php` (verificación de backends y documentación de la raíz) y `desarrollador-ionic` (verificación de la app y documentación de la app); T-06 es una puerta humana |
| Depende de | **HLT-15-v2, HLT-16-v4, HLT-17-v4, HLT-18, HLT-19-v2 y HLT-20-v2 COMPLETADOS** (T-01) |
| Entorno | PHP 8.2.35 (`C:\xampp\php\php.exe`); MariaDB 10.4.32; servicios en `http://localhost/criterio_kelly/rest_<nombre>/`; Karma con Edge (`CHROME_BIN`) |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 6) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) **MySQL y Apache intocables:** prohibido iniciar, detener, reiniciar o reparar; sin `mysqlcheck`/`REPAIR`/`reparar-mysql-db.bat`; sin escribir en `mysql.*`; si falla, el agente se detiene (`BLOQUEADA`). (2) **Commits del usuario:** ninguna tarea ejecuta `git add/commit/push/checkout/reset/stash/clean`; T-09 entrega todos los archivos y mensajes sugeridos; hash = `➖`. (3) Sin reportes `.md` en `docs/Planificacion/evidencias/` (el coordinador los guarda). (4) Fixtures `ck_prueba_hu4_*`; al final no queda ninguno. (5) Este HLT **no cambia código de negocio**: solo verifica y documenta; si una verificación falla, la tarea queda `BLOQUEADA` y se abre un HLT de corrección, no se arregla aquí.

---

## H1 · Propósito

**Requerimiento literal (HU-004 rev. 5).** «**G-01** Los flujos de cuenta de HU-003 (recuperación, activación, correo, usuario y teléfono repetidos, cédula única y plan reservado) dan el mismo resultado que antes; la batería `hu003_flujos_cuenta.sh` se repite con el cambio de concesión. **G-02** Las suscripciones y pagos existentes, y los flujos de `crearConPago`, no cambian. **G-03** `ng lint`, `ng test` y `ng build` de la app, y `php -l` en todo archivo PHP tocado, sin errores. **G-04** Se prueba con el reloj simulado: fixtures con `sus_fechaHoraFin` y `sus_fechaFin` en el pasado, en el futuro y en el límite exacto, sin esperar 24 horas, 10 días ni meses.» Definición de terminado: criterios A a G con evidencia real, pruebas con reloj simulado, prueba manual «registro → activación → primer inicio de sesión → aviso de prueba → (con la fecha adelantada) paso al plan siguiente», README de `rest_suscripcion` y de la app, `CLAUDE.md` y los agentes actualizados.

**Propósito.** Demostrar con evidencia real que HU-004 cumple todos sus criterios, que nada de lo anterior se rompió (salvo el cambio previsto: el primer inicio de sesión concede la prueba en lugar de crear el Libre) y dejar la documentación del proyecto al día.

**Resultado esperado (observable).**
1. Todas las baterías de HU-004 (`hu004_esquema.sh`, `hu004_prueba.sh`, `hu004_pagos.sh`, `hu004_cancelacion.sh`) y las tres pruebas CLI con reloj simulado pasan en una sola corrida, sin 500 ni 422 ni interbloqueos en el log.
2. Las baterías de HU-001/HU-003 dan lo mismo que su línea base, salvo lo que la HU cambia explícitamente.
3. Las suscripciones y pagos reales de la base no cambiaron, salvo la transición prevista de la suscripción 28 (`A` con corte pasado → `E`) si su dueño consultó su plan.
4. `php -l` sin errores en todo PHP tocado por HU-004 (11 + …), `sha256sum` de `RegistroAuditoria.php` idéntico en los 4 backends, y `ng lint`, `ng test --watch=false`, `ng build` sin errores.
5. Prueba manual completa confirmada por el usuario.
6. `rest_suscripcion/README.md`, `criterioKellyApp/CLAUDE.md` y `README.md`, `CLAUDE.md` raíz y los agentes `desarrollador-php` y `desarrollador-ionic` reflejan HU-004; el riesgo «el control es solo de la app» queda escrito.
7. La lista consolidada de archivos y mensajes de commit sugeridos por repositorio está entregada.

**Fuera de alcance.** Corregir fallos (HLT nuevo); aplicar límites de plan en `rest_criteriokelly` y en las pantallas (HU-005: HLT-24-v2 y HLT-27-v2; riesgo Alta R-01 hasta entonces); ventana de administración; pantalla de comprobante (historia futura explícita, respuesta 6); el cron opcional (DT-06); cambiar baterías de HU-001/HU-003.

**Feature(s) afectada(s).** Solo documentación y evidencias: `rest_suscripcion/README.md`, `criterioKellyApp/CLAUDE.md`, `criterioKellyApp/README.md`, `CLAUDE.md` (raíz), `.claude/agents/desarrollador-php.md`, `.claude/agents/desarrollador-ionic.md`, `docs/Planificacion/evidencias/HLT-21/`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Los flujos de cuenta de HU-003 no cambian | `hu003_flujos_cuenta.sh` y `hlt05v2_bateria.sh` (reconstruidos en HLT-15 T-02) dan las mismas líneas `NORM\|` que `HLT-15/linea_base/*_antes.txt` (línea base tomada sobre el código actual en T-02b; las líneas base antiguas ya no existen); `diff` vacío | G-01 |
| RN-02 | `crearConPago` no cambia en sus flujos válidos | La comparación de `HLT-17/antes/` con una corrida nueva da el mismo código, cuerpo (campos de `formatearSuscripcion`) y pago `R`; el único cambio permitido es 409 `La suscripción no admite pagos` para suscripciones que no están en `P` | G-02 |
| RN-03 | Datos existentes intactos | Suma de verificación de `spsu_pagos`, `spsu_historialsuscri` (sin filas de personas reales) y de `spsu_suscripcion` **excluyendo** las filas de fixtures y la suscripción 28 coincide con `HLT-15/linea_base_esquema.txt`; la 28 puede estar `E` | A-02, G-02 |
| RN-04 | PHP sin errores | `C:\xampp\php\php.exe -l` sobre cada PHP de `git status` de los 4 repos más `rest_divisas/configuracion/RegistroAuditoria.php`; `grep -rnE "\benum\b|readonly|\bnever\b" ` sobre los PHP nuevos vacío (compatibilidad 8.0) | G-03 |
| RN-05 | Fechas en UTC | `grep -rnE "date\(|strtotime\(|NOW\(|CURDATE|CURRENT_(DATE|TIMESTAMP)" rest_suscripcion/servicios rest_suscripcion/anexos/pruebas` vacío; en `modelos/` y `controladores/` solo las líneas legadas de `SuscripcionCtrl.php` (`:67`, `:143`) | E-05 |
| RN-06 | Auditoría idéntica | `sha256sum rest_*/configuracion/RegistroAuditoria.php` muestra un único valor y `EVENTOS` contiene los 13 eventos nuevos (los 8 de HU-004, `PLAN_RENOVACION`, `PLAN_RENOV_ANULADA`, `PLAN_ACTIV_PROGRAM` y `PLAN_PROGRAMADO` de DT-15, DT-16 y DT-17, y `LIMITE_PLAN_RECHAZADO` de HU-005) | E-03 |
| RN-07 | Reloj simulado en los tres puntos | `plan_vigente_reloj.php` (R01…R32), `mejora_plan_reloj.php` (M01…M07) y `cancelacion_reloj.php` (X01…X06) con `PASS` en todas y en tres zonas horarias | G-04 |
| RN-08 | Sin cron | `schtasks /query /fo LIST` no muestra tareas de Criterio Kelly y `crontab` no existe en el entorno; las transiciones se prueban igual | C-04 |
| RN-09 | App | `ng lint`, `ng test --watch=false --browsers=ChromeHeadless`, `ng build` con código 0; el recuento de pruebas es ≥ la línea base + las nuevas de HLT-19 y HLT-20 | G-03 |
| RN-10 | Sin restos de prueba | `SELECT COUNT(*) FROM sgen_usuario WHERE usu_usuario LIKE 'ck\_prueba\_hu4\_%'` = 0 y sin filas `fixture_hu4%` en `sgen_auditoria` al terminar | RN-17 de HLT-12 |
| RN-11 | Prueba manual | El usuario confirma por escrito «PRUEBA MANUAL HU-004 OK» tras el guion de H8 §RI-2 | Definición de terminado |
| RN-12 | Documentación completa | Cada documento de T-07/T-08 contiene las secciones de H8 §RI-3 y menciona que el control de planes en el servidor llega con HU-005 (HLT-24-v2), que `LectorPlanVigente` es la regla única y que el esquema incluye los límites de HU-005 | Definición de terminado |
| RN-13 | Cobertura total de la HU | La matriz de H4 enlaza **todos** los criterios A-01…G-04 con el HLT y la evidencia que los cubre | Cobertura 100 % |

---

## H3 · Flujo principal de ejecución

```
[Disparador: HLT-15…HLT-20 COMPLETADOS]
 → T-01 comprobar el estado de los HLT anteriores (reportes del coordinador, verificar.sql, sha256, archivos)   ── falta algo → BLOQUEADA
 → T-02 backends: PHP -l global, grep 8.0 y UTC, sha256 de auditoría                       (desarrollador-php)
 → T-03 backends: corrida única de baterías HU-004 y pruebas CLI con reloj simulado        (desarrollador-php)
 → T-04 backends: no regresión HU-001/HU-003 y comparación de datos existentes             (desarrollador-php)
 → T-05 app: ng lint + ng test --watch=false + ng build                                   (desarrollador-ionic)
 → T-06 PUERTA humana: prueba manual completa («PRUEBA MANUAL HU-004 OK»)
 → T-07 documentación de la raíz y de los agentes                                         (desarrollador-php)
 → T-08 documentación de la app                                                           (desarrollador-ionic)
 → T-09 limpieza de fixtures, verificación final y entrega consolidada de commits sugeridos (desarrollador-php)
```
Ramas de error: cualquier `FAIL`/`❌` → la tarea queda `BLOQUEADA` con la salida literal; error de servidor MySQL/Apache → **detener sin reparar**. No hay HTTP propio; las verificaciones usan los endpoints ya definidos (códigos 200/400/401/403/404/409/429/500; 422 solo para el límite de pérdida).

---

## H4 · Calidad del HLT y cobertura (HU completa)

| Criterio de la HU | Cubierto en | Tareas de este HLT | Evidencia |
|-------------------|-------------|--------------------|-----------|
| A-01…A-04 | HLT-15 | T-01, T-03, T-04 | `hu004_esquema.sh verificar`, suma de verificación (RN-03) |
| B-01…B-06 | HLT-16-v4 | T-03 | `hu004_prueba.sh` P01…P28 |
| C-01…C-07 | HLT-16-v4 | T-03 | `plan_vigente_reloj.php` R01…R32 |
| DT-15 y DT-17 (X-03 con renovación pendiente, plazo de 30 días, anulación y Libre nuevo; M-05) | HLT-16-v4 y HLT-18 | T-03 | R15…R26 y R29, P21…P25, P27, P28, `hu004_cancelacion.sh` C10, C11, C15, C17 y `cancelacion_reloj.php` X02…X05 |
| DT-16 pago anticipado (periodo programado y su activación sin renovación) | HLT-16-v4, HLT-17-v4 y HLT-18 | T-03 | R27…R32, P26, A44…A56, M06, M07, `hu004_cancelacion.sh` C16 y `cancelacion_reloj.php` X06 |
| DT-16 primer corte (P-03, M-01: fechas de la subida, 409 comprobante antiguo) | HLT-17-v4 | T-03 | `hu004_pagos.sh` A38…A43, A55 y `mejora_plan_reloj.php` M01…M07 |
| C2 M-01…M-07 | HLT-17 | T-03 | `hu004_pagos.sh` A07…A11, A25, `mejora_plan_reloj.php` |
| C3 P-01…P-09 (y B-03…B-05, C-03, C-05 de HU-005) | HLT-17-v4 | T-03 | `hu004_pagos.sh` A01…A56 |
| C4 X-01…X-05 | HLT-16 (corte) y HLT-18 | T-03 | `hu004_cancelacion.sh` C01…C17, `cancelacion_reloj.php` |
| D-01…D-04 | HLT-16 | T-03 | P14…P16 |
| E-01…E-05 | HLT-16, HLT-17, HLT-18 | T-02, T-03 | `grep` de RN-04/RN-05, sha256 (RN-06), P03/P15/P17 |
| F-01…F-05, F-08 | HLT-19 | T-05, T-06 | `ng test`, puerta manual |
| F-06, F-07, F-09, F-10 | HLT-20 | T-05, T-06 | `ng test`, puerta manual |
| G-01 | este | T-04 | RN-01 |
| G-02 | este | T-04 | RN-02, RN-03 |
| G-03 | este | T-02, T-05 | RN-04, RN-09 |
| G-04 | HLT-16, HLT-17, HLT-18 y este | T-03 | RN-07 |
| Definición de terminado: README, `CLAUDE.md` y agentes | este | T-07, T-08 | RN-12 |
| Prueba manual | este | T-06 | RN-11 |
| Pantalla de subida del comprobante de pago | — | — | **Historia futura explícita, sin tareas** |

### Checklist de calidad del HLT
- [x] 11 secciones completas · [x] sin marcadores · [x] cobertura 100 % de la HU · [x] criterios verificables · [x] respeta `CLAUDE.md` y los agentes · [x] referencias leídas el 2026-11-11 · [x] decisiones cerradas.

### Discrepancias HU ↔ realidad
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | «Repetir `hu003_flujos_cuenta.sh`» | No existía en disco; **decisión del usuario:** reconstruido en HLT-15 T-02 y línea base nueva en HLT-15 T-02b sobre el código actual | T-04 ya no se bloquea por scripts ausentes: ejecuta las baterías reconstruidas y compara con la nueva línea base |
| C-2 | «Las suscripciones existentes no cambian» | La `A` 28 (corte 2026-03-04) pasa a `E` al consultar su dueño (HLT-16 RN-11) | RN-03 la excluye y exige que la salida lo documente |
| C-3 | «Primer inicio de sesión sigue igual» | Ahora concede la prueba y ya no crea el Libre | Cambio previsto; se verifica que no falla el login (HLT-19 RN-03) |

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Qué hacer ante un fallo | A) arreglar aquí; B) `BLOQUEADA` y HLT nuevo | **B** | Este HLT no cambia código de negocio | No |
| D-02 | Baterías ausentes | A) bloquear y preguntar; B) reconstruirlas en HLT-15 | **B — CERRADA por el usuario** | Respuesta 1; la comparación usa la nueva línea base, no las antiguas | No |
| D-03 | Prueba manual | Puerta humana con frase literal | cerrada | La prueba en la app exige navegador/dispositivo | No |
| D-04 | Reparto de documentación | Raíz y agentes → `desarrollador-php`; app → `desarrollador-ionic` | cerrada | Una tarea no mezcla carpetas (`planificador.md`) | No |
| D-05 | Limpieza de fixtures | `limpiar_prueba_hu4` al final, también ante un fallo | cerrada | RN-10 | No |
| D-06 | Cron opcional (DT-06) | No se implementa; el README lo deja descrito como complemento | cerrada | Fuera de alcance | No |

**Preguntas no bloqueantes.** Ninguna abierta.

**Preguntas del usuario (CERRADAS el 2026-11-11).** (1) «Sí» a reconstruir los scripts de pruebas: `docs/Planificacion/evidencias/` **ya no existe** y no hay copia; las líneas base antiguas de HU-001/HU-003 dejan de ser referencia comparativa y la nueva línea base se toma sobre el código actual (reconstrucción en HLT-15 T-02 y línea base en T-02b). (2) «Sí»: plan de pago cortado = Libre terminado sin plan (estado 6 = estado 4). (3) «No puede»: un administrador **no** confirma ni rechaza su propio pago, sin excepciones aunque sea el único administrador; las pruebas usan pagos fixture de otro usuario. (4) «Sí»: se acepta como riesgo que las cuentas registradas entre la aplicación del esquema y el despliegue de HLT-16 reciban la prueba. (5) «Sí»: la suscripción 28 puede pasar a `E` por la regla de corte. (6) «Sí, pero será después»: la pantalla para subir el comprobante de pago **no se planifica ahora**; es una historia futura explícita (el usuario la pedirá), sin tareas en estos HLT.

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | G-01…G-04 y la definición de terminado |
| 2 | Reglas | ✅ | RN-01…RN-13 |
| 3 | Impacto | ✅ | solo lectura + documentación |
| 4 | Arquitectura | ✅ | |
| 5 | Riesgos | ✅ | tabla |
| 6 | Simplicidad | ✅ | |
| 7 | Seguridad | ✅ | no se abren accesos nuevos; se verifica 401/403 en las baterías |
| 8 | Cobertura | ✅ | H4 enlaza toda la HU |
| 9 | Determinismo | ✅ | |
| 10 | Ejecutabilidad | ✅ | |

**Ataques considerados.** *Que «todo pasa» por fixtures que ocultan un fallo real:* se comparan datos reales antes/después (RN-03) y se corre con el reloj real y el simulado. *Que una regresión de HU-001 pase desapercibida:* `hlt05v2` y la sha de auditoría. *Interbloqueos intermitentes:* se cuenta `1213`/`Deadlock` en el log antes y después. *Carreras repetidas:* las pruebas de 5 simultáneas se repiten 3 veces. *Dejar fixtures en la base:* RN-10. *Documentar una regla antigua del menú:* RN-12 exige la tabla de la rev. 5. *Marcar COMPLETADO sin la puerta manual:* RR-1 lo prohíbe.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | **Hasta HLT-24-v2 el control de planes es solo de la app** | **Alta** | Documentado (RN-12); HU-005 lo cierra a continuación con el lector y `limites` que ya deja HU-004 |
| R-02 | La línea base nueva se tomó sobre el código actual y no sobre el histórico de HU-001/HU-003 | Baja | Respuesta 1 del usuario; HLT-15 T-02b la fija antes de cambiar comportamiento |
| R-03 | Fallo de MySQL durante las corridas | Alta | Regla 1: detener sin reparar |
| R-04 | Documentación desactualizada respecto a la regla vigente del menú | Media | RN-12 |

**Rondas.** *Ronda 1 — CON CAMBIOS:* faltaba la comparación de datos reales (RN-03) y la excepción de la suscripción 28. *Ronda 2 — APROBADO:* la rev. 5 no cambia este HLT salvo exigir en la documentación la tabla de seis estados del menú (RN-12). **Veredicto: APROBADO.**
*Ronda 3 (respuestas del usuario) — APROBADO.* Se elimina el bloqueo por scripts ausentes (D-02, C-1, R-02, T-04): la reconstrucción y la línea base están en HLT-15 T-02/T-02b, y se comparan con la nueva línea base. El orden de tareas de este HLT no cambia.
*Ronda 4 (v2, decisiones del usuario del 2026-11-12) — APROBADO.* Solo cambian las versiones de las dependencias, los rangos de casos (P01…P28, R01…R32, A01…A56, M01…M07, X01…X06) y la documentación (lector único, límites en el esquema, eventos ampliados); sin tareas nuevas.
*Ronda 5 (DT-15 y DT-16, 2026-11-13) — APROBADO.* La regresión incluye los casos nuevos de renovación pendiente y de fechas conservadas (matriz de H4, RN-07, T-03) y el guion manual gana los pasos de renovación y de comprobante antiguo; sin tareas nuevas.
*Ronda 6 (DT-12 ajustada, DT-16 con su alcance y DT-17, 2026-11-13) — APROBADO.* La regresión añade los casos de plazo, anulación con Libre nuevo y pago anticipado (matriz de H4, RN-06, RN-07, T-03: R01…R32, P01…P28, A01…A56, M01…M07, X01…X06, C01…C17) y el guion manual gana los pasos 10 y 11; sin tareas nuevas.

---

## H7 · Plan de tareas

`EV` = `docs/Planificacion/evidencias`. Agentes: **php** = `desarrollador-php`, **ionic** = `desarrollador-ionic`.

| ID | Agente | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|--------|-------|----------|---------|------------------------|-------|
| T-01 | php | Verificar que HLT-15…HLT-20 están completos | `EV/HLT-21/estado_previo.txt` (nuevo) | — | `mysql -u root sist_criteriokelly < rest_suscripcion/anexos/suscripcion_01_plan_prueba_verificar.sql` todo `PASS`; existen `servicios/PlanVigenteSrv.php`, `PruebaGratuitaSrv.php`, `MejoraPlanSrv.php`, `CancelacionPlanSrv.php`, `rutas/PagosRts.php`; existen en la app `plan-vigente.store.ts`, `aviso-plan.component.ts`, `aviso-bloqueo.component.ts`, `plan.guard.ts`, `permisos-plan.config.ts`; los reportes de ejecución de los 6 HLT dicen `COMPLETADO` (los aporta el coordinador); si algo falta → `BLOQUEADA` | RN-13 |
| T-02 | php | Comprobación estática global de los backends | `EV/HLT-21/php_estatico.txt` (nuevo) | T-01 | `php -l` sobre cada PHP listado por `git status --short` en `rest_suscripcion`, `rest_usuario`, `rest_criteriokelly` y sobre `rest_divisas/configuracion/RegistroAuditoria.php`: 0 errores; `grep` de RN-04 y RN-05 vacíos; `sha256sum` de las 4 copias idénticas (RN-06) | RN-04, RN-05, RN-06 |
| T-03 | php | Corrida única de las baterías HU-004 y de las pruebas CLI | `EV/HLT-21/baterias/*.txt` (nuevos) | T-02 | Contar `grep -c "1213\|Deadlock" rest_suscripcion/logs/php_errores.log` antes y después (sin aumento); `bash EV/hu004_esquema.sh verificar`, `hu004_prueba.sh completo`, `hu004_pagos.sh completo`, `hu004_cancelacion.sh completo` (código 0, todo `PASS`) **tres veces seguidas**; `C:\xampp\php\php.exe rest_suscripcion/anexos/pruebas/plan_vigente_reloj.php`, `mejora_plan_reloj.php` y `cancelacion_reloj.php` con todos `PASS` (R01…R32, M01…M07, X01…X06); `schtasks /query /fo LIST` sin tareas de Criterio Kelly (RN-08); 0 respuestas 422 y 0 respuestas 500 en las salidas | RN-07, RN-08, G-04 |
| T-04 | php | No regresión de HU-001/HU-003 y de los datos existentes | `EV/HLT-21/regresion/*.txt` (nuevos) | T-03 | `hu003_flujos_cuenta.sh` y `hlt05v2_bateria.sh` (reconstruidos en HLT-15) → `NORM\|` idéntico a `HLT-15/linea_base/` según RN-01 (diff vacío); repetición de `HLT-17/antes/` de `crearConPago` (RN-02); suma de verificación de RN-03 (con la 28 documentada); cualquier diferencia → `BLOQUEADA` con la salida literal (no por scripts ausentes) | RN-01, RN-02, RN-03, G-01, G-02 |
| T-05 | ionic | Verificación global de la app | `EV/HLT-21/app/lint.txt`, `test.txt`, `build.txt` (nuevos) | T-01 | `npx ng lint` y `npx ng build` código 0; `CHROME_BIN="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless` en verde con el recuento de pruebas (RN-09); `grep -rn "localStorage" src/app/compartidos/seguridades/plan.guard.ts src/app/paginas/suscripcion/configuracion` vacío; las claves de `localStorage` de la app son solo las documentadas (`grep -rn "localStorage.setItem\|CLAVE_" src/app --include=*.ts \| grep -v spec`) | RN-09, G-03 |
| T-06 | ionic | **PUERTA humana:** prueba manual completa | `EV/HLT-21/puerta_manual.txt` (nuevo) | T-04, T-05 | El agente muestra el guion de H8 §RI-2 y se detiene; `HECHA` solo con la respuesta escrita «PRUEBA MANUAL HU-004 OK»; cualquier fallo descrito → `BLOQUEADA`. El agente no toca MySQL/Apache | RN-11 |
| T-07 | php | Documentar en la raíz y en los agentes | `CLAUDE.md`, `.claude/agents/desarrollador-php.md`, `.claude/agents/desarrollador-ionic.md`, `rest_suscripcion/README.md` (revisión final) | T-06 | Contienen lo de H8 §RI-3 (tabla «Backends» de `CLAUDE.md`: `/suscripcion/planVigente`, `iniciarPrueba`, `cancelar` y `/pagos`; nota de zona horaria; auditoría de 9 eventos; `LectorPlanVigente` como regla única y copia idéntica prevista en `rest_criteriokelly`; columnas de límite de HU-005; control de planes en el servidor pendiente de HLT-24-v2); `grep -c "planVigente" CLAUDE.md` ≥ 2; `grep -c "HU-004" .claude/agents/desarrollador-php.md` ≥ 1 | RN-12 |
| T-08 | ionic | Documentar en la app | `criterioKellyApp/CLAUDE.md`, `criterioKellyApp/README.md` (revisión final) | T-06 | Contienen la tabla de seis estados del menú (rev. 5), el archivo único de permisos, el guarda, `plan_vigente_avisado`, el orden del primer inicio de sesión y el riesgo de R-01; `grep -c "MINIMO_PENDIENTE" criterioKellyApp/CLAUDE.md` ≥ 1; **no** aparece la regla «Libre = solo inicio y criterio Kelly» (`grep -c "solo el inicio"` = 0 en ambos) | RN-12 |
| T-09 | php | Limpieza final, verificación y entrega consolidada | `EV/HLT-21/entrega.txt` (nuevo) | T-07, T-08 | `limpiar_prueba_hu4` y `SELECT COUNT(*)` de RN-10 = 0; `git status --short` por repositorio (solo lectura); `entrega.txt` con la lista de archivos por repositorio y los mensajes sugeridos de H8 §RI-4 (el agente **no** los ejecuta); hash de commit = `➖` | RN-10, entrega |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → (T-07, T-08) → T-09.

---

## H8 · Reglas de implementación deterministas

- **RI-1 · Reglas heredadas.** `desarrollador-php.md` («Entorno», «Seguridad») y `desarrollador-ionic.md`; sin tocar archivos de código; solo lecturas, ejecución de verificaciones y edición de los documentos declarados.
- **RI-2 · Guion de la puerta T-06.** (1) Registrar una cuenta nueva eligiendo un plan de pago; verificar que dice «pendiente de pago». (2) Activar el correo (en local `CORREO_MODO=log`, código en `rest_usuario/logs/correos/`). (3) Primer inicio de sesión: aviso «Tu prueba termina en 23 h 59 min» y menú completo. (4) Con `UPDATE` de la fixture, poner la prueba en el pasado: al volver a la app aparece una sola vez «Tu prueba terminó; estás en el plan Libre y te quedan 10 días» y el menú sigue completo. (5) Poner el Libre en el pasado: aparece el menú mínimo (con plan pendiente) o «Debes activar un plan» con la lista (sin plan pendiente); `Mostrar criterio Kelly` abre siempre. (6) Con otra cuenta administradora fixture, validar el pago con `curl` del README: la cuenta pasa a plan de pago con menú completo y «Cancelar plan». (7) Cancelar con confirmación: «Tu plan termina el …». (8) Adelantar la fecha de corte: la cuenta queda sin plan y no vuelve al Libre; con la renovación automática activa queda con la renovación pendiente de pago («Tu plan … terminó. La renovación está pendiente de pago…», menú mínimo) y, si antes canceló, con «Debes activar un plan». (9) DT-16: con `UPDATE` de la fixture dejar un pago `R` subido hace 3 días (pago y fechas de la suscripción coherentes) y validarlo hoy con el `curl` del README: la fecha de corte que muestra la app es la del día de la subida más los meses, no la de la validación; con un comprobante de plan mensual subido hace más de un mes la validación responde «El comprobante es demasiado antiguo; suba uno nuevo» y no cambia nada. (10) DT-17: en una cuenta con renovación pendiente (corte hace 10 días) la app dice «Tu plan … terminó. Tienes 20 días para pagarlo; si no, pasarás al plan Libre» y el menú es el mínimo; con el corte hace 31 días (`UPDATE` de la fixture) la cuenta pasa una sola vez al plan Libre de 10 días con el aviso de anulación y, al vencer, a «Debes activar un plan». (11) DT-16 anticipado: con un plan de pago activo, subir un comprobante antes del corte y validarlo con el `curl` del README: la respuesta trae `tipo:"ANTICIPADO"`, el plan actual sigue y el inicio dice «Tu renovación ya está pagada, empieza el <día siguiente al corte>»; al adelantar el corte del plan presente, la cuenta pasa al periodo pagado sin interrupción y sin renovación pendiente. El agente no toca MySQL/Apache.
- **RI-3 · Contenido de la documentación.** `CLAUDE.md` raíz: tabla de proyectos y endpoints nuevos, regla de UTC (PHP corre en Berlín), `ContextoSesion::roles()` para administradores, 8 eventos de auditoría y copia idéntica de `RegistroAuditoria`, plan 5 y columnas nuevas, `servicios/` de `rest_suscripcion`, cuenta nueva = corte por `pla_fechacambio`, riesgo R-01. Agentes: una sección «HU-004» breve en cada uno (backend: no usar `date()`/`NOW()`, mutex usuario → suscripciones → pagos; app: permisos solo en `permisos-plan.config.ts`, guarda, componentes presentacionales). README app: lo de T-08.
- **RI-4 · Mensajes de commit sugeridos consolidados (el usuario los ejecuta).** `rest_suscripcion`: (a) «Esquema HU-004: columnas de duración, plan Prueba y Libre de 240 horas», (b) «HU-004: concesión de la prueba, plan vigente y corte de planes», (c) «HU-004: listado, validación y rechazo de pagos con fecha de corte», (d) «HU-004: cancelación del plan de pago», (e) «Docs: README de HU-004»; `rest_usuario` y `rest_criteriokelly`: «Auditoría: eventos de HU-004»; `rest_divisas` (sin git): copia manual del `RegistroAuditoria.php`; `criterioKellyApp`: (a) «HU-004: concesión de la prueba y aviso del plan», (b) «HU-004: menú y guarda según el plan, elegir y cancelar plan», (c) «Docs: CLAUDE.md y README con el plan vigente»; raíz (sin git): `CLAUDE.md`, agentes y `docs/`. Cada mensaje de commit de los repositorios termina con la línea de atribución indicada por el entorno.
- **RI-5.** Sin tocar MySQL/Apache, sin git de escritura, sin reportes `.md` en `evidencias/`.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9. Ficha por tarea: `Estado`; **C1** archivos declarados; **C2** criterio de H7 con salida literal; **C3** H8; **C4** `php -l` o `ng lint` según el agente (➖ en documentación); **C5** prueba/batería real; **C6** sin efectos fuera de alcance; `Evidencia`; `Notas`.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-07, T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

Estructura fija: 1 Resumen · 2 Estado global (COMPLETADO | PARCIAL | BLOQUEADO) · 3 Tablero · 4 Cobertura (A-01…G-04 y RN-01…RN-13 → resultado; ¿100 %?) · 5 Cambios `ruta:línea` · 6 Verificaciones (comando → salida real) · 7 Desviaciones (incluida la suscripción 28) · 8 Pendientes (PU abiertas) · 9 Próximos pasos (historia de control de planes en los backends y pantalla de comprobante). RR-1…RR-5; **`COMPLETADO` solo con T-06 confirmada y T-04 sin bloqueo**. El coordinador guarda el `.md`.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

Solo documentación y evidencias: español, títulos y tablas como los de los README existentes, rutas con `ruta:línea` verificadas contra el estado final del código, nombres de archivos de evidencia `HLT-21/<área>/<nombre>.txt` en kebab-case o snake_case como los de HLT-15…HLT-20, scripts `.sh` con `set -u` y funciones en español; commits por el usuario.
