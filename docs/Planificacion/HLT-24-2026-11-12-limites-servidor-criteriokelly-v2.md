# HLT-24-v2 — Límites de cada plan aplicados en el servidor de `rest_criteriokelly` con el lector copiado de HLT-16-v4 y las columnas reutilizadas (HU-005 rev. 3: E-01…E-08, F-02, F-03; DN-03, DN-06, DN-07, DN-08)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; revisado el 2026-11-13: el lector copiado ya contiene DT-15, DT-16 y DT-17) |
| Historia | `docs/Historia_usuario/HU-005-control-por-plan-comprobante-y-administracion.md` (rev. 3), «Aplicación en el servidor», criterios **E-01…E-08**, F-02, F-03 |
| Numeración | Vigentes: HLT-15-v2 · HLT-16-v4 · HLT-17-v4 · HLT-18 · HLT-19-v2 · HLT-20-v2 · HLT-21-v2 · **HLT-24-v2 (este)** · HLT-25-v2 · HLT-26-v2 · HLT-27-v2 · HLT-28-v2. HLT-22 y HLT-23 ANULADOS |
| Proyecto y git | `rest_criteriokelly` (git propio), `rest_suscripcion` (solo la prueba CLI de equivalencia), `docs/Planificacion/evidencias/` |
| Agente | `desarrollador-php` en todas las tareas |
| Depende de | **HU-004 completa (HLT-15-v2…HLT-21-v2)**: columnas de límite (RN-14 de HLT-15-v2), `LectorPlanVigente`, objeto `limites` y evento `LIMITE_PLAN_RECHAZADO` en los 4 `RegistroAuditoria.php` (HLT-16-v4). Se comprueba en T-01 |
| Lo consume | HLT-27 (la app recibe datos ya recortados y los 403 de límite), HLT-28 |
| Entorno | PHP 8.2.35 (código 8.0), MariaDB 10.4.32 (funciones de ventana disponibles), usuario de BD `ck_aplicacion` en ambos backends |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 4) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) MySQL/Apache intocables; sin escribir en `mysql.*`; si falla, `BLOQUEADA`. (2) Commits del usuario; hash = `➖`. (3) Sin reportes `.md` en `evidencias/`. (4) Fixtures `ck_prueba_hu5_*`. (5) E-05: sin `date(`, `strtotime(`, `NOW()` en código nuevo; fechas con `DateTimeImmutable` UTC. (6) PHP 8.0. (7) `rest_criteriokelly` **solo lee** `spsu_*`: no escribe suscripciones ni transiciones. (8) Nunca abrir ni imprimir `.env` (las comprobaciones usan `grep -c` sin mostrar valores).

---

## H1 · Propósito

**Requerimiento literal (HU-005 rev. 2).** «`rest_criteriokelly` necesita conocer el plan vigente. El cálculo del plan vigente de HU-004 se escribe **desde el principio** como un lector de solo lectura (`LectorPlanVigente`) […]; `rest_criteriokelly` lleva una **copia idéntica** de ese lector (verificada con `sha256`, como `RegistroAuditoria`). […] No se llama por HTTP de un backend a otro.» · «**Cuentas antiguas sin ningún plan** […]: se tratan como **sin plan vigente**, con los límites del Libre y el aviso para activar un plan» · Puntos de control: `cuentas/nueva` con tope; `detalleOperacion` y `operacionAnalisis` recortados; `obtenerPorcentaje` (y donde se use el divisor) con divisor 10 si el plan no lo permite; «Sin plan vigente […] solo se aceptan las llamadas de **Mostrar criterio Kelly**, con los límites del Libre (DN-07); el resto responde con el código de DN-06». · **E-01…E-08** (ver H2). · DN-06: «403 con mensaje propio». · DN-08: «Se conservan y se pueden consultar, pero no se crean nuevas».

**Propósito.** Cerrar el riesgo Alta R-01 de HU-004: que nadie obtenga, llamando a las APIs, más de lo que su plan permite.

**Resultado esperado (observable).**
1. `rest_criteriokelly/configuracion/LectorPlanVigente.php` es copia byte a byte del lector de HLT-16-v4 y devuelve para cualquier usuario el mismo `estado`, plan y `limites` que `PlanVigenteSrv::resolver` en el mismo instante.
2. Sin plan vigente (`SIN_PLAN`, incluidas las cuentas `NUNCA_TUVO_PLAN`), `rest_criteriokelly` responde 403 `Tu plan no incluye esta función. Actualiza tu plan` a todo salvo `cuentas/obtener`, `criterioKelly/obtenerPorcentaje` y `criterioKelly/obtenerResultados`.
3. `cuentas/nueva` por encima del tope → 403 con «Tu plan permite N cuenta(s). Actualiza tu plan para crear más»; las cuentas existentes no se tocan.
4. `detalleOperacion` devuelve solo los últimos `diasReporte` días; `operacionAnalisis` y `observacionAnalisis` aceptan `fechaDesde`/`fechaHasta`, recortan el rango y la antigüedad y devuelven como máximo `maxOperacionesAnalisis` operaciones por cuenta.
5. `bitacora/finalizaBitacora` calcula con divisor 10 si `divisorEditable` es falso, aunque el cliente envíe otro.
6. Auditoría `LIMITE_PLAN_RECHAZADO` en cada 403 de límite.

**Fuera de alcance.** «Operaciones diarias» de `/mostrar-criterio-kelly` en el servidor (C-1: es un cálculo de la app sin llamada); bloqueos de graficar, PDF y Excel (se hacen en la app con datos ya recortados); cambiar `rest_usuario`, `rest_divisas` o `RegistroAuditoria` (el evento ya lo añadió HLT-16-v4); reescribir la regla del plan vigente (solo se copia); transiciones de plan desde `rest_criteriokelly`; el bug de Kelly de `ReglasKellyMdl.php:46-47`.

**Feature(s) afectada(s).** `rest_criteriokelly` → `index.php`, `configuracion/LectorPlanVigente.php` (copia), `configuracion/ControlPlan.php` (nuevo), `/cuentas/nueva` (`CuentasCtrl.php`, `CuentasMdl.php`), `/criterioKelly/detalleOperacion|operacionAnalisis|observacionAnalisis` (`CriterioKellyCtrl.php`, `CriterioKellyMdl.php`), `/bitacora/finalizaBitacora` (`ReglasKellyCtrl.php`), `README.md`. `rest_suscripcion` → solo `anexos/pruebas/lector_plan_vigente.php` (el lector existe desde HLT-16-v4).

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Lector de solo lectura (de HLT-16-v4) | `LectorPlanVigente::leer(int $idUsuario)` según RN-23 de HLT-16-v4 → `{estado, motivoSinPlan, …, limites}`; `grep -ciE "insert|update|delete|for update"` sobre la copia = 0 | E-05, RI entorno 7 |
| RN-02 | Una sola regla | La regla vive solo en el lector (D-14 de HLT-16-v4); `rest_criteriokelly` no la reimplementa: `grep -rn "pla_horasDuracion" K/controladores K/modelos K/configuracion/ControlPlan.php` vacío; `limites` según RN-25 de HLT-16-v4 | E-06 |
| RN-03 | Copia idéntica | `sha256sum rest_suscripcion/configuracion/LectorPlanVigente.php rest_criteriokelly/configuracion/LectorPlanVigente.php` da el mismo hash | E-06 |
| RN-04 | Equivalencia probada | Script CLI con reloj inyectado: para L01…L18 (H8 §RI-2), `LectorPlanVigente::leer` antes de `PlanVigenteSrv::resolver` y `resolver` después dan el mismo `estado`, `idPlan` y `limites` | E-06 |
| RN-05 | Puerta sin plan | En `index.php`, tras `LimitadorPeticiones` (`index.php:72`) y solo en rutas no públicas: `ControlPlan::exigirRutaPermitida($recurso, $accion)`; con `estado = SIN_PLAN` (cualquier `motivoSinPlan`, también `NUNCA_TUVO_PLAN`; decisión 4 del usuario), si `"$recurso/$accion"` no está en `RUTAS_SIN_PLAN = ['cuentas/obtener', 'criterioKelly/obtenerPorcentaje', 'criterioKelly/obtenerResultados']` → 403 RN-09 | E-04, DN-07 |
| RN-06 | Tope de cuentas | `cuentas/nueva`: en la transacción existente (`CuentasCtrl.php:32`), primero `SELECT … FROM sgen_usuario WHERE usu_idUsuario = ? FOR UPDATE` (mutex por usuario, mismo orden que HLT-16 RN-18), luego `COUNT(*)` de `sckc_cuentas` con `cue_usuarioId = ? AND cue_estado = '1'`; si `limites.numCuentas` no es `null` y el conteo ≥ tope → rollback, auditoría y 403 `Tu plan permite N cuenta(s). Actualiza tu plan para crear más`; 5 creaciones simultáneas con tope 1 y 0 cuentas → un 200 y cuatro 403 | E-01, DN-08 |
| RN-07 | Reporte de operativas | `detalleOperacion`: si `diasReporte` no es `null`, solo filas con `bit_fechaFin >= ?` donde `? = (hoy UTC − (diasReporte − 1) días) 00:00:00` calculado en PHP; mismo orden y forma de respuesta que hoy (`CriterioKellyCtrl.php:72-95`) | E-02, matriz |
| RN-08 | Análisis | `operacionAnalisis` y `observacionAnalisis` aceptan `fechaDesde` y `fechaHasta` opcionales (`YYYY-MM-DD`, `leerFecha`); `fechaDesde > fechaHasta` → 400 `El rango de fechas es inválido`. Sin fechas: `hasta = hoy UTC` y `desde = hasta − (diasAnalisis − 1)` (sin filtro si `diasAnalisis` es `null`). Con fechas: si el rango supera `diasAnalisis` se recorta `desde = hasta − (diasAnalisis − 1)`; `desde` no es anterior a `hoy − (diasTotalesAnalisis − 1)` (`pla_diasTotales`, «ventana total del análisis»). Filtro sobre `bit_fechaFin` (`desde 00:00:00` ≤ x ≤ `hasta 23:59:59`). Cantidad: como máximo `maxOperacionesAnalisis` por cuenta, las más recientes (`ROW_NUMBER() OVER (PARTITION BY bit_cueIdCuentas ORDER BY bit_fechaFin DESC, bit_idbitacora DESC)`), devueltas en el orden actual (cuenta, fecha). `observacionAnalisis` solo devuelve observaciones de las bitácoras que devolvería `operacionAnalisis` con el mismo cuerpo | E-02, DN-04 |
| RN-09 | Respuesta de límite | `403 {"error":"Tu plan no incluye esta función. Actualiza tu plan"}` (puerta) o el mensaje de RN-06 (cuentas); nunca 422; el interceptor de la app ya prefiere el mensaje del servidor | DN-06, E-07 |
| RN-10 | Divisor | En `ReglasKellyCtrl::finalizarOperacionBitacora` (`ReglasKellyCtrl.php:53-64`), si `limites.divisorEditable` es falso, `$divisor = self::DIVISOR_KELLY_POR_DEFECTO` después de leer y validar el campo (un valor inválido sigue siendo 400) | E-03 |
| RN-11 | Datos nunca del cliente | El plan y los límites salen del lector con `ContextoSesion::idUsuario()`; ningún campo del cuerpo los cambia | E-05 |
| RN-12 | Auditoría | Evento `LIMITE_PLAN_RECHAZADO` (ya en `EVENTOS` desde HLT-16-v4); se emite solo en los 403 de RN-05 y RN-06 con detalle `recurso=<r>/<a> plan=<id|ninguno>`; los recortes silenciosos (RN-07, RN-08, RN-10) no se auditan; el volumen lo acota el `LimitadorPeticiones` existente | E-08 |
| RN-13 | Datos existentes | Ningún `UPDATE`/`DELETE` nuevo sobre `sckc_*`, `sckb_*`, `scko_*`; las cuentas por encima del tope siguen en `cuentas/obtener` | F-03, DN-08 |
| RN-14 | Sin cambio para Enterprise y Prueba | Con `pla_rangoLibre = 1` y 365 días, las 5 respuestas afectadas de un fixture con menos de 365 días de datos son idénticas byte a byte a la línea base de T-01 | F-02 |
| RN-15 | Permisos de BD | `ck_aplicacion` tiene `SELECT, INSERT, UPDATE, DELETE, EXECUTE` sobre `sist_criteriokelly.*` (`rest_usuario/anexos/seguridad_00_usuario_mysql.sql:20-21`) y ambos `.env` usan `DB_USUARIO=ck_aplicacion` (comprobado con `grep -c`, sin imprimir): lectura de `spsu_*` y `FOR UPDATE` de `sgen_usuario` permitidos sin GRANT nuevo. T-01 lo confirma con `SHOW GRANTS`; si faltara, `BLOQUEADA` y acción manual del usuario (H8 §RI-4) | entorno |

---

## H3 · Flujo principal de ejecución

```
index.php:70 ValidadorSesion → :72 LimitadorPeticiones
 → ControlPlan::exigirRutaPermitida(recurso, accion)            [nuevo, RN-05]
      LectorPlanVigente::leer(idUsuario) (una vez por petición; se guarda en ControlPlan)
      SIN_PLAN (≠ NUNCA_TUVO_PLAN) y ruta fuera de RUTAS_SIN_PLAN → auditoría → 403
 → rutas/<X>Rts.php → controlador
      CuentasCtrl::agregarCuenta → transacción → bloquear usuario → contar → tope? 403 : INSERT → 200
      CriterioKellyCtrl::obtenerDetalleOperaciones → ControlPlan::limites() → Mdl con fechaMinima
      CriterioKellyCtrl::obtenerOperacionesParaAnalisis / Observaciones → calcularRangoAnalisis → Mdl con desde, hasta, maxPorCuenta
      ReglasKellyCtrl::finalizarOperacionBitacora → divisor = 10 si !divisorEditable
```

| Método y ruta | Cambio | Respuestas nuevas |
|---------------|--------|-------------------|
| todas salvo las 3 de `RUTAS_SIN_PLAN` | puerta sin plan | 403 RN-09 |
| `POST /cuentas/nueva` | tope | 403 RN-06 |
| `POST /criterioKelly/detalleOperacion` | recorte por días | — |
| `POST /criterioKelly/operacionAnalisis`, `observacionAnalisis` | `fechaDesde`, `fechaHasta` opcionales; recortes | 400 rango inválido |
| `PUT /bitacora/finalizaBitacora` | divisor forzado | — |

Ramas HTTP: 400, 401, 403, 429, 500; el 422 sigue reservado al límite de pérdida.

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Prueba |
|--------------------|--------|--------|
| E-06 / RN-01…RN-04 | T-02, T-03 | CLI L01…L18, `sha256sum` |
| E-04 / RN-05, RN-09 | T-05, T-06 | K01…K04 |
| E-01 / RN-06, RN-13 | T-07 | K05…K08 |
| E-02 / RN-07, RN-08 | T-08, T-09 | K09…K15 |
| E-03 / RN-10 | T-10 | K16, K17 |
| E-05 / RN-11 | T-05 | K18 |
| E-07 / RN-09 | todas | K19 |
| E-08 / RN-12 | T-05 | K02, K05 (auditoría) |
| F-02 / RN-14 | T-12 | K20 |
| RN-15 | T-01 | `SHOW GRANTS` |

### Discrepancias HU ↔ código
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | DN-03 «el servidor lo recorta» (operaciones diarias) | «Operaciones diarias» es un `FormControl` que divide `cke_x100Operativo` en la app (`mostrar-criterio-kelly.page.ts:55-66`); no hay llamada al servidor | Solo app (HLT-27); el dato que se obtiene es el mismo porcentaje que ya devuelve `obtenerPorcentaje`, así que no hay nada que proteger |
| C-2 | «`criterioKelly/obtenerPorcentaje` (y donde se use el divisor)» | `obtenerPorcentaje` solo lee el último cálculo (`CriterioKellyMdl.php:16-38`); el divisor entra al finalizar una operación (`ReglasKellyCtrl.php:53-64`, desde `bitacora-fin.page.ts:172`) | RN-10 en `finalizaBitacora` |
| C-3 | «Copia idéntica del lector de plan vigente» | Resuelto en HLT-16-v4: el lector es de solo lectura y solo depende de `Enlace` | Se copia tal cual (T-02) |
| C-4 | `/analisis` «filtro de fechas» | Hoy no hay filtro: `reportes.service.ts:27` envía `{}` y el SQL no filtra (`CriterioKellyMdl.php:82-96`) | Campos opcionales nuevos; sin ellos, ventana por defecto (RN-08) |
| C-5 | «máximo 5 operaciones» | El listado de la app es por cuenta (`ReportesStore.obtenerListaOperacionesPorCuentas`) | Máximo por cuenta (D-04) |
| C-7 | «Sin límite» en los reportes de Enterprise | Decisión 1 del usuario: 365 días (`pla_diasHistorial`) y `pla_rangoLibre = 1` sin tope en el análisis | `diasReporte = 365`; `diasAnalisis` y `maxOperacionesAnalisis` `null` |
| C-6 | `observacionAnalisis` no está en la HU | Devuelve observaciones de todas las bitácoras finalizadas (`CriterioKellyMdl.php:98-110`): saltaría el recorte | Se recorta igual (RN-08) |

### Checklist de calidad del HLT
- [x] 11 secciones · [x] sin marcadores · [x] cobertura 100 % · [x] criterios verificables · [x] respeta `CLAUDE.md` y `desarrollador-php.md` · [x] referencias leídas el 2026-11-12 · [x] decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Cómo conoce el plan `rest_criteriokelly` | Copia del `LectorPlanVigente` de HLT-16-v4 | **CERRADA por el usuario (decisión 3)** | Una sola regla escrita una vez; la HU prohíbe HTTP entre backends | No |
| D-02 | Dónde vive la puerta sin plan | A) en cada controlador; B) `index.php` con lista blanca | **B** | Un solo punto; una ruta nueva queda bloqueada por defecto | No |
| D-03 | Recortar o rechazar en reportes | A) 403; B) recortar en silencio | **B** | La HU: «recorta lo que se muestra»; la app avisa con `limites` | No |
| D-04 | Máximo de operaciones de análisis | A) total; B) por cuenta | **B** | C-5 | No |
| D-05 | Ventana del análisis | El rango no puede empezar antes de `pla_diasTotales` días (`diasTotalesAnalisis`) | cerrada | Decisión 1 del usuario («ventana total del análisis») | No |
| D-06 | `NUNCA_TUVO_PLAN` | Sin plan vigente: puerta y límites del Libre | **CERRADA por el usuario (decisión 4)** | HU-005 rev. 3, E-04 | No |
| D-07 | Días incluidos | «Últimos N días» incluye hoy: desde `hoy − (N−1)` | cerrada | Determinismo | No |
| D-08 | Auditar recortes | No | cerrada | Ocurren en cada consulta normal; inflarían la tabla | No |

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | |
| 2 | Reglas | ✅ | RN-01…RN-15 |
| 3 | Impacto | ✅ | 5 endpoints + puerta global |
| 4 | Arquitectura | ✅ | plomería en `configuracion/`, lógica en controladores existentes |
| 5 | Riesgos | ✅ | |
| 6 | Simplicidad | ✅ | |
| 7 | Seguridad | ✅ | |
| 8 | Cobertura | ✅ | |
| 9 | Determinismo | ✅ | |
| 10 | Ejecutabilidad | ✅ | |

**Ataques considerados.** *Pedir `fechaDesde` muy antigua:* RN-08 la sube a `hoy − (diasReporte−1)`. *Rango enorme:* se recorta. *Enviar `cke_numDivisor: 2` en el Básico:* RN-10. *Crear cuentas en paralelo para pasar el tope:* mutex por usuario (K07). *Borrar una cuenta y crear otra:* permitido (cuenta activas, DN-08). *Saltar la puerta con una acción nueva:* bloqueada por defecto (lista blanca). *Leer observaciones de operaciones fuera de rango:* C-6. *Plan vencido sin consultar `planVigente`:* el lector aplica la regla de vencimiento al leer (RN-02). *Divergencia entre lector y `resolver`:* RN-04 y RN-03. *Interbloqueo entre el mutex de cuentas y el de `rest_suscripcion`:* ambos empiezan por `sgen_usuario` y `rest_criteriokelly` no toma `spsu_*` con bloqueo.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | La copia de `rest_criteriokelly` queda desfasada si se cambia el lector de `rest_suscripcion` | Alta | RN-03 (`sha256`) y RN-04 en HLT-28-v2; regla en `CLAUDE.md`: cambiar el lector obliga a recopiarlo |
| R-02 | Una consulta más por petición en `rest_criteriokelly` | Baja | Índice `spsu_suscripcion_usuario_idx` (HLT-15); una sola lectura por petición |
| R-03 | `bit_fechaFin` guardada en hora local y no en UTC | Media | Desfase máximo de unas horas en el borde del día; documentado en el README; los fixtures usan fechas a días de distancia del borde |
| R-04 | Cuentas antiguas sin plan pierden acceso a casi todo `rest_criteriokelly` | Media | Decisión del usuario; cuantificado en HLT-15-v2 T-01; la app les muestra cómo activar un plan (HLT-19-v2, HLT-20-v2) |

**Rondas.** *Ronda 1 — CON CAMBIOS:* el divisor no pasa por `obtenerPorcentaje` (C-2); «operaciones diarias» no tiene llamada (C-1). *Ronda 2 — CON CAMBIOS:* `observacionAnalisis` saltaba el recorte (C-6); el tope de cuentas tenía carrera (mutex RN-06). *Ronda 3 — APROBADO.* *Ronda 4 (v2, decisiones del usuario del 2026-11-12) — APROBADO.* El lector ya existe (HLT-16-v4): T-02 solo lo copia; el evento de auditoría ya está en los 4 backends (desaparece la antigua T-04); columnas reutilizadas (`diasTotalesAnalisis` como ventana del análisis, D-05; C-7); `NUNCA_TUVO_PLAN` pasa por la puerta (RN-05, D-06). Ataque nuevo: *cuenta antigua sin plan que llama a la API* → 403 (K04). **Veredicto: APROBADO.**
*Ronda 5 (2026-11-13, DT-15, DT-16 y DT-17) — APROBADO sin cambios de código planificado.* La copia sigue siendo idéntica: la regla nueva (renovación con plazo, anulación con Libre, periodo programado y cadena de pasos) vive solo en `LectorPlanVigente` de HLT-16-v4, que `rest_criteriokelly` copia con `sha256`. Se amplían las pruebas de equivalencia (L13…L18) y las de la puerta (K21, K22). La puerta de `ControlPlan` no cambia: usa `estado`; una renovación dentro del plazo es `SIN_PLAN` (403) y una vencida es `LIBRE` (límites del Libre).

---

## H7 · Plan de tareas

Todas `desarrollador-php`. `K` = `rest_criteriokelly`, `S` = `rest_suscripcion`, `EV` = `docs/Planificacion/evidencias`.

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones, permisos y línea base | `EV/HLT-24/antes/*.txt` | — | HLT-15-v2 y HLT-16-v4 `COMPLETADOS` (`PASS RN-14`; `php -l S/configuracion/LectorPlanVigente.php`; `grep -c LIMITE_PLAN_RECHAZADO` ≥ 1 en los 4 `RegistroAuditoria.php` con `sha256` igual; R13 y R14 de HLT-16-v4 en verde); `mysql -u root -e "SHOW GRANTS FOR 'ck_aplicacion'@'localhost'"` contiene `SELECT, INSERT, UPDATE, DELETE` sobre `sist_criteriokelly`.* (RN-15); `grep -c '^DB_USUARIO=ck_aplicacion$' K/.env S/.env` = 1 y 1; respuestas actuales de los 5 endpoints con un fixture Enterprise guardadas (RN-14) | RN-14, RN-15 |
| T-02 | Copiar el lector | `K/configuracion/LectorPlanVigente.php` (copia de `S/configuracion/LectorPlanVigente.php`) | T-01 | `cp` sin cambios; `sha256sum` de ambos igual; `php -l` OK; la clase `Enlace` de `K/configuracion/enlace.php` ofrece los métodos que usa el lector (`grep` de cada método) | RN-01…RN-03 |
| T-03 | Prueba de equivalencia | `S/anexos/pruebas/lector_plan_vigente.php` (nuevo) | T-02 | Solo CLI; crea y limpia fixtures `ck_prueba_hu5_`; L01…L18 de H8 §RI-2 con `PASS Lnn` | RN-04 |
| T-05 | Control de plan | `K/configuracion/ControlPlan.php` (nuevo) | T-02 | Clase con `limites(): array`, `estado(): array` (una lectura por petición) y `exigirRutaPermitida(string $recurso, string $accion): void` según RN-05/RN-09; constantes `RUTAS_SIN_PLAN`, `MENSAJE_LIMITE_PLAN`; responde con `ManejadorErrores::responderError(403, …)`; `php -l` OK | RN-05, RN-09, RN-11, RN-12 |
| T-06 | Conectar la puerta | `K/index.php` | T-05 | `require_once` de `LectorPlanVigente.php` y `ControlPlan.php`; llamada tras `:72` solo si `!$esRutaPublica`; `php -l` OK; `curl` sin token sigue 401 | RN-05 |
| T-07 | Tope de cuentas | `K/controladores/CuentasCtrl.php`, `K/modelos/CuentasMdl.php` | T-05 | `CuentasMdl::bloquearUsuario(int)` y `contarCuentasActivas(int): int`; `agregarCuenta` aplica RN-06 dentro de la transacción y responde el 403 **fuera** del `catch (Throwable)` genérico; `php -l` OK | RN-06, RN-13 |
| T-08 | Recorte de operativas | `K/controladores/CriterioKellyCtrl.php`, `K/modelos/CriterioKellyMdl.php` | T-05 | `obtenerDetalleOperaciones(int $idUsuario, ?string $fechaMinimaUtc)`; con `null` la consulta es la actual; RN-07; `php -l` OK | RN-07 |
| T-09 | Recorte de análisis | `K/controladores/CriterioKellyCtrl.php`, `K/modelos/CriterioKellyMdl.php` | T-08 | Método privado `calcularRangoAnalisis(array $datos, array $limites): array`; modelos con `?string $desde, ?string $hasta, ?int $maxPorCuenta`; observaciones filtradas por los ids de las operaciones permitidas; RN-08; `php -l` OK | RN-08 |
| T-10 | Divisor | `K/controladores/ReglasKellyCtrl.php` | T-05 | RN-10 sin cambiar la validación; `php -l` OK | RN-10 |
| T-11 | Humo | `EV/HLT-24/humo.txt` | T-03, T-06, T-07, T-09, T-10 | `php -l` de los 8 PHP tocados en `K` y del CLI; `grep -nE "\benum\b|readonly|date\(|strtotime\(|NOW\("` sobre los nuevos vacío; `sha256sum` de RN-03 | G-03 |
| T-12 | Batería HTTP | `EV/hu005_limites_servidor.sh` (nuevo), `EV/HLT-24/despues/*.txt` | T-11 | `bash -n` OK; K01…K22 de H8 §RI-1 con `PASS`; `C:\xampp\php\php.exe S/anexos/pruebas/lector_plan_vigente.php` con `PASS L01…L12`; sin 422/500; `1213` sin aumento; limpieza 0 filas `ck_prueba_hu5_%` | E-01…E-08 |
| T-13 | Documentar | `K/README.md`, `S/README.md` | T-12 | `K/README.md`: sección «Límites por plan» (puerta, lista blanca, tope, recortes, divisor, `fechaDesde`/`fechaHasta`, nota de R-03); ambos README: «`LectorPlanVigente` es copia idéntica: cambiar ambos y comprobar `sha256`» | R-01 |
| T-14 | Regresión y entrega | `EV/HLT-24/entrega.txt` | T-13 | Baterías de HU-004 (incluidas las de HLT-16-v4 y HLT-17-v4) y `hlt05v2_bateria.sh` en verde (la batería de HU-001 sobre `rest_criteriokelly` se ejecuta con fixtures Enterprise para que la puerta no cambie su resultado); `git status --short` por proyecto; mensajes sugeridos: `rest_criteriokelly` «HU-005: límites de plan en el servidor (puerta sin plan, tope de cuentas, recortes de reportes y divisor)»; `rest_suscripcion` «HU-005: prueba de equivalencia del LectorPlanVigente»; hash `➖` | G-01 |

**Orden:** T-01 → T-02 → T-03 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11 → T-12 → T-13 → T-14.

---

## H8 · Reglas de implementación deterministas

Reglas de `desarrollador-php.md` («Arquitectura», «Seguridad», «Contrato de respuesta»).

- **RI-1 · Casos `Knn`.** **K01** SIN_PLAN (`LIBRE_TERMINADO`) → `cuentas/obtener`, `obtenerPorcentaje`, `obtenerResultados` 200; **K02** SIN_PLAN → `bitacora/crear`, `cuentas/nueva`, `detalleOperacion` 403 RN-09 y `LIMITE_PLAN_RECHAZADO`; **K03** SIN_PLAN con plan pendiente (estado 3 de HU-004) → igual que K02; **K04** `NUNCA_TUVO_PLAN` → igual que K02 (403 fuera de la lista blanca, auditoría); **K05** Libre con 1 cuenta → `cuentas/nueva` 403 «Tu plan permite 1 cuenta(s)…», sin fila nueva, auditoría; **K06** Premium con 4 cuentas → 200; con 5 → 403; **K07** Libre con 0 cuentas, 5 `cuentas/nueva` simultáneas → un 200 y cuatro 403; **K08** usuario con 3 cuentas que pasa a Libre → `cuentas/obtener` devuelve las 3; **K09** Libre con operaciones finalizadas hace 1, 7 y 9 días → `detalleOperacion` devuelve las de 1 y 7; **K10** Básico, operación de hace 14 días incluida y de 16 no; **K11** `operacionAnalisis` sin fechas en Libre → solo los últimos 5 días; **K12** Libre con 8 operaciones en el rango → 5 por cuenta, las más recientes, en orden ascendente por fecha; **K13** `fechaDesde` hace 60 días en Básico → `desde` recortado; **K14** `fechaDesde > fechaHasta` → 400; **K15** `observacionAnalisis` no devuelve observaciones de bitácoras fuera del rango; **K16** Básico finaliza con `cke_numDivisor: 2` → el `sckp_criteriokelly` insertado tiene `cke_numDivisor = 10`; **K17** Premium con 2 → 2; **K18** cuerpo con `limites`, `pla_numCuentas` u otro usuario → no cambia el resultado (403 de HU-001 si es otro usuario); **K19** ningún 422 ni 500 en toda la batería; **K20** Enterprise y Prueba → los 5 endpoints idénticos a `antes/` (RN-14); **K21** cuenta con una renovación fuera de plazo que aún nadie evaluó → las llamadas responden con los límites del Libre (el lector ve `LIBRE`) y no con la puerta de «sin plan»; **K22** cuenta con renovación dentro del plazo (estado 3) → la puerta (403) como K03.
- **RI-2 · Casos `Lnn` (CLI).** L01 prueba vigente; L02 prueba en el instante exacto de fin (vencida); L03 prueba vencida sin plan de pago → `LIBRE`; L04 prueba vencida con plan de pago `A` → `PAGO`; L05 Libre vigente; L06 Libre vencido → `SIN_PLAN`/`LIBRE_TERMINADO`; L07 plan de pago con corte hoy 23:59:59 → `PAGO`; L08 al día siguiente (con `sus_renovAutomatica = 0`, o con renovación 1 dentro de los 30 días) → `SIN_PLAN`/`PLAN_PAGO_VENCIDO`; L09 plan de pago cancelado vigente → `PAGO`; L10 sin suscripciones → `SIN_PLAN`/`NUNCA_TUVO_PLAN` con límites del Libre; L11 solo `P` → igual; L12 Libre vigente y plan de pago `P` → `LIBRE`; **L13** (DT-17) renovación pendiente: el día corte + 30 a las 23:59:59 → `SIN_PLAN`/`PLAN_PAGO_VENCIDO` (estado 3 de la app); **L14** corte + 31 sin pago → `LIBRE` con los `limites` del Libre (lo que el servidor concedería al anular), sin haber consultado `planVigente`; **L15** corte + 31 con un pago `R` de la renovación → `SIN_PLAN`; **L16** (DT-16) plan presente + `P` con pago `C` → `PAGO` del presente; con el presente vencido → `PAGO` del plan programado y sus `limites`; **L17** cuenta que no consulta durante 60 días tras el corte → `LIBRE`; **L18** Libre por anulación vencido → `SIN_PLAN`/`LIBRE_TERMINADO` sin otra renovación ni otro Libre. Zonas Berlín, Guayaquil y Kiritimati.
- **RI-3.** Sin tocar MySQL/Apache, sin git de escritura, sin reportes `.md`; solo fixtures `ck_prueba_hu5_`.
- **RI-4 · Acción manual si falta el permiso (solo si T-01 falla).** Pedir al usuario que ejecute él mismo, con root: `GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON sist_criteriokelly.* TO 'ck_aplicacion'@'localhost';` (y `@'127.0.0.1'`), como en `seguridad_00_usuario_mysql.sql:20-21`; el agente no lo ejecuta.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9. Ficha: `Estado`; **C1** archivos declarados; **C2** criterio de H7 con salida literal; **C3** H8 y entorno; **C4** `php -l`; **C5** curl/CLI real; **C6** sin efectos fuera de alcance; `Evidencia`; `Notas`.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-02, T-05…T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-13, T-14 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

1 Resumen · 2 Estado global · 3 Tablero · 4 Cobertura (E-01…E-08, F-02, F-03, RN-01…RN-15) · 5 Cambios `ruta:línea` · 6 Verificaciones (K01…K22, L01…L18, `sha256`) · 7 Desviaciones · 8 Pendientes · 9 Próximos pasos (HLT-25). RR-1…RR-5.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

`LectorPlanVigente` (copia) y `ControlPlan` en `configuracion/` (plomería compartida, como `ContextoSesion`); métodos `leer`, `limites`, `exigirRutaPermitida`, `contarCuentasActivas`, `bloquearUsuario`, `calcularRangoAnalisis`; constantes con nombre para mensajes y la lista blanca; el lector no responde HTTP; los modelos solo hacen SQL preparado; comentarios y mensajes en español.
