# HLT-18 — Cancelación del plan de pago por el usuario y comprobación del corte (HU-004 rev. 5: C4, X-01…X-05)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-11 (casos añadidos el 2026-11-13 por DT-15, DT-16 y DT-17: cancelar evita la renovación y respeta el periodo ya pagado) |
| Historia | `docs/Historia_usuario/HU-004-plan-de-prueba-24-horas.md` (rev. 5), sección «Cancelación por el usuario» y criterios **X-01…X-05**; DT-12 y DT-13 |
| Numeración | HLT-15 esquema · HLT-16 concesión y plan vigente (implementa el corte `E` y el evento `PLAN_CORTADO`) · HLT-17 pagos · **HLT-18 este** · HLT-19 y HLT-20 app · HLT-21 cierre |
| Proyecto y git | `rest_suscripcion` (git propio) y `docs/Planificacion/evidencias/` (raíz sin git) |
| Agente | `desarrollador-php` en todas las tareas |
| Depende de | **HLT-16 y HLT-17 COMPLETADOS** (`PlanVigenteSrv`, mutex, `HistorialSuscripcionMdl`, evento `PLAN_CANCELADO` ya presente en los 4 `RegistroAuditoria.php`, planes de pago `A` creados por `MejoraPlanSrv`). Se comprueba en T-01 |
| Lo consume | HLT-20 (botón «Cancelar plan» y fecha de fin), HLT-21 |
| Entorno | PHP 8.2.35 (código 8.0), MariaDB 10.4.32, `date.timezone = Europe/Berlin` (todo en UTC con el reloj de PHP) |
| Veredicto senior (H6) | **APROBADO** (ronda 6) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) MySQL/Apache intocables: sin iniciar, detener, reiniciar ni reparar; sin `mysqlcheck`/`REPAIR`/`reparar-mysql-db.bat`; sin escribir en `mysql.*`; si falla, el agente se detiene (`BLOQUEADA`). (2) Commits del usuario: sin `git add/commit/push/checkout/reset/stash/clean`; entrega de archivos y mensajes sugeridos; hash = `➖`. (3) Sin reportes `.md` en `evidencias/`. (4) Fixtures `ck_prueba_hu4_*`; ningún dato real se toca. (5) E-05: sin `date(`, `strtotime(`, `NOW()` en código nuevo. (6) Sintaxis PHP 8.0.

---

## H1 · Propósito

**Requerimiento literal (HU-004 rev. 5).** «La persona puede cancelar su plan de pago. La cancelación **no corta el plan en ese momento**: sigue vigente hasta el final del **periodo ya pagado** y después queda sin plan vigente (DT-13). No hay devolución de dinero. Se marca con `sus_renovAutomatica = 0` y la suscripción sigue en `A` hasta su fecha de corte.» · «**X-01** Existe un endpoint protegido, `suscripcion/cancelar`, que toma el usuario de la sesión (sin id en la petición) y marca `sus_renovAutomatica = 0` en su plan de pago activo. Responde 409 si no tiene plan de pago activo o ya está cancelado. **X-02** Cancelar no cambia la situación ni la fecha de corte […] **X-03** Llegada la fecha de corte, la siguiente consulta del plan vigente marca la suscripción `E` (con o sin cancelación) […] **X-04** Auditoría de `PLAN_CANCELADO` y `PLAN_CORTADO`, y registro en `spsu_historialsuscri`. **X-05** Una cuenta no puede cancelar el plan de otra (403 uniforme) ni cancelar un plan que no es de pago.»

**Propósito.** Permitir que la persona deje de renovar su plan de pago sin perder el periodo ya pagado, y demostrar que el corte posterior funciona con y sin cancelación.

**Resultado esperado (observable).**
1. `POST suscripcion/cancelar` marca `sus_renovAutomatica = 0` en el plan de pago vigente del usuario de la sesión y responde el *PlanVigente* (`estado:"PAGO"`, `cancelado:true`, misma `fechaCorte`); la suscripción sigue `A`.
2. Segundo intento, cuenta sin plan de pago vigente o con prueba/Libre: 409 con mensaje propio; id ajeno: 403 idéntico al de un id inexistente; cuerpo con otras claves: 400.
3. Cinco peticiones simultáneas: un 200 y cuatro 409.
4. Con la fecha de corte pasada (fixture), la siguiente consulta de `planVigente` deja la suscripción `E` (cancelada o no), `SIN_PLAN`/`PLAN_PAGO_VENCIDO`, sin Libre ni prueba, con `PLAN_CORTADO` e historial `CORTADA`; si no estaba cancelada (`sus_renovAutomatica = 1`) se crea además la renovación `P` pendiente de pago de DT-15 (la crea HLT-16-v4) y, si estaba cancelada, no se crea ninguna.
5. Auditoría `PLAN_CANCELADO` e historial `CANCELACION`; ningún pago ni importe se modifica (sin devolución).
6. Con un periodo siguiente ya pagado y programado (pago anticipado, DT-16), cancelar **no** lo cancela ni pierde dinero: el periodo programado se activa en el corte y termina sin renovación (`sus_renovAutomatica = 0` también en él); con la renovación pendiente de pago (DT-15), `cancelar` responde 409 (no hay plan de pago activo): esa renovación vence sola a los 30 días (DT-17).

**Fuera de alcance.** Reactivar una cancelación; devolución de dinero; cobro y recordatorios de la renovación automática (la renovación pendiente de pago la crea HLT-16-v4, DT-15); cambiar la lógica del corte (ya está en HLT-16-v4); la interfaz de cancelación (HLT-20); correos de aviso; aplicar límites en los backends (riesgo Alta R-01).

**Feature(s) afectada(s).** `rest_suscripcion` → `/suscripcion/cancelar`: `rutas/SuscripcionRts.php`, `controladores/SuscripcionCtrl.php`, `modelos/SuscripcionMdl.php`, `servicios/CancelacionPlanSrv.php`, `README.md`, `anexos/pruebas/`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | El usuario sale de la sesión | `iniciar` toma `ContextoSesion::idUsuario()`; `sus_usuarioId`/`id` de otro usuario en el cuerpo, la consulta o el segmento → 403 `Acceso denegado` (`BaseCtrl.php:49-58`) | X-01, X-05 |
| RN-02 | Qué se cancela | La suscripción de plan de pago `A` y no vencida que `PlanVigenteSrv` elegiría (mayor nivel); con `sis_idSuscrip` opcional en el cuerpo debe ser **una suscripción propia de plan de pago `A` vigente**; si es ajena o no existe → `denegarAcceso` 403 con el mismo cuerpo; si es propia pero de prueba/Libre/vencida/`P`/`E` → 409 | X-01, X-05 |
| RN-03 | Efecto | `UPDATE … SET sus_renovAutomatica = 0, sus_fechaCambio = <UTC>` solo donde `sus_renovAutomatica = 1`, sobre la `A` de pago vigente **y**, si existe, sobre el periodo programado (`P` con pago `C`, `marcarSinRenovacionProgramada`) para que el periodo ya pagado se cumpla y no se renueve; `sus_situacion`, `sus_fechainicio`, `sus_fechaFin` y `sus_proximoPago` no cambian en ninguna | X-02, DT-16 |
| RN-04 | 409 | Sin plan de pago vigente → `409 {"error":"No tiene un plan de pago activo para cancelar"}`; ya cancelado → `409 {"error":"El plan ya está cancelado"}` | X-01 |
| RN-05 | Cuerpo | Vacío o `{}` o `{"sis_idSuscrip":N}`; cualquier otra clave → `400 {"error":"La solicitud contiene campos no permitidos"}` | E-01 |
| RN-06 | Atómico y serializado | Transacción con el mutex de HLT-16 (usuario → suscripciones); 5 simultáneas → un 200 y cuatro 409; sin 500 ni `1213` | M-03 |
| RN-07 | Sin devolución | Ninguna fila de `spsu_pagos` cambia (suma de verificación de los pagos del fixture igual antes/después) | DT-13 |
| RN-08 | Corte con y sin cancelación | Fixture con `sus_fechaFin` = ayer UTC: `planVigente` → `E`, `SIN_PLAN`, `motivoSinPlan:"PLAN_PAGO_VENCIDO"`, sin fila nueva de prueba ni Libre; **con `sus_renovAutomatica = 0` (cancelado) no se crea ninguna renovación y `planPendiente` es `null`; con `sus_renovAutomatica = 1` se crea una sola renovación `P` (DT-15, RN-26 de HLT-16-v4) y `planPendiente` no es nulo**; con `sus_fechaFin` = hoy UTC sigue `PAGO` en ambos casos | X-03, DT-15 |
| RN-09 | Auditoría e historial | `PLAN_CANCELADO` (usuario = dueño; detalle `suscripcion=<id>`) fuera de la transacción; historial `CANCELACION` con IP; `PLAN_CORTADO` ya lo emite HLT-16 | X-04 |
| RN-10 | Respuesta | 200 con el *PlanVigente* de HLT-16 (D-10 de HLT-16 aplica a este endpoint igual); 401 sin token; 429 por el límite por sesión existente; ningún 422 | D-04 |
| RN-11 | Cancelar evita la renovación; la renovación pendiente y la programada | Dejar `sus_renovAutomatica = 0` (único efecto de este endpoint) es lo que impide crear la `P` al cortar el plan (RN-08). Una vez creada la renovación `P` (dentro de sus 30 días), `suscripcion/cancelar` responde 409 `No tiene un plan de pago activo para cancelar` y la `P` no cambia: vence sola (anulación + Libre, DT-17, HLT-16-v4). Con una programada, cancelar deja ambas sin renovación (RN-03); `cancelado` del *PlanVigente* sigue siendo el `sus_renovAutomatica = 0` de la `A` vigente y la app muestra el fin del periodo programado (`planProgramado.fechaFin`) en «Tu plan termina el …». Cancelar tras un pago anticipado **en revisión** (aún sin programar) solo cambia la `A` vigente; al confirmarse, la programada hereda el 0 (HLT-17-v4 RN-25) | DT-15, DT-13, DT-16, DT-17 |

---

## H3 · Flujo principal de ejecución

| Método y ruta | Cuerpo | Respuestas |
|---------------|--------|-----------|
| `POST /suscripcion/cancelar` | vacío, `{}` o `{"sis_idSuscrip":N}` | **200** *PlanVigente* (`estado:"PAGO"`, `cancelado:true`) · 400 · 401 · 403 `Acceso denegado` · 409 (RN-04 / RN-02) · 500 `Error interno del servidor` |

```
index.php:67-70 (sesión) → SuscripcionRts POST 'cancelar' (acepta cuerpo vacío, como iniciarPrueba)
 → SuscripcionCtrl::cancelarPlan(array $datos): campos permitidos (RN-05) → verificarUsuarioEnviado → leerEntero(sis_idSuscrip) si llega
 → CancelacionPlanSrv::cancelar(idUsuario, ?idSuscripcion)  [reloj UTC inyectable]
      iniciarTransaccion → bloquearUsuarioActivo → suscripciones FOR UPDATE
      → PlanVigenteSrv elige/valida la suscripción de pago vigente (RN-02) → 409 / denegar
      → marcarSinRenovacion → historial CANCELACION → commit → auditoría PLAN_CANCELADO
 → PlanVigenteSrv::resolver(idUsuario) → 200
 excepción → revertir → error_log("[SuscripcionCtrl::cancelarPlan] …") → 500
```
Ramas HTTP: 400, 401, 403, 409, 429, 500; el 422 no interviene.

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Prueba |
|--------------------|--------|--------|
| X-01 / RN-01, RN-02, RN-04, RN-05 | T-02, T-03, T-04, T-05, T-08 | C01…C08 |
| X-02 / RN-03 | T-02, T-08 | C02, C09 |
| X-03 / RN-08 | T-07, T-08 | C10, C11, script CLI `cancelacion_reloj.php` (X01…X06) |
| X-04 / RN-09 | T-03, T-08 | C02 (auditoría e historial), C10 |
| X-05 / RN-01, RN-02 | T-04, T-08 | C05, C06, C07 |
| M-03 / RN-06 | T-08 | C12 |
| DT-15 / RN-08, RN-11 | T-07, T-08 | C10, C11, C15, X02…X05 |
| DT-16, DT-17 / RN-03, RN-11 | T-02, T-03, T-07, T-08 | C16, C17, X06 |
| DT-13 sin devolución / RN-07 | T-08 | C13 |
| Documentación | T-09 | AC-T-09 |

### Discrepancias HU ↔ código
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | `sus_renovAutomatica = 0` marca la cancelación | La columna tiene `DEFAULT 1` y `crearSinPago` no la fija (`SuscripcionMdl.php:99-110`): las suscripciones nuevas nacen en 1 y las de prueba/Libre de HLT-16 en 0 | «Cancelado» = `0` **solo** se interpreta en suscripciones de plan de pago; el *PlanVigente* de otros planes siempre dice `cancelado:false` (HLT-16) |
| C-2 | «Sin id en la petición» y «403 uniforme ante un plan de otra cuenta» | Sin id, no existe forma de apuntar al plan de otra cuenta | Se admite `sis_idSuscrip` opcional solo para poder probar el 403 uniforme; sin él el comportamiento es el de X-01 |
| C-3 | Vigencia de planes de pago con fecha de corte | Tipo `date` | HLT-16 D-07: vigente hasta el final del día de `sus_fechaFin` (UTC) |

### Checklist de calidad del HLT
- [x] 11 secciones completas · [x] sin marcadores · [x] cobertura 100 % · [x] criterios verificables · [x] respeta `CLAUDE.md` y `desarrollador-php.md` · [x] referencias leídas el 2026-11-11 · [x] decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Qué suscripción se cancela sin id | A) la de mayor nivel vigente; B) todas | **A** | Coincide con `planVigente` | No |
| D-02 | Id opcional | A) prohibido; B) opcional y propio | **B** | C-2; X-05 verificable | No |
| D-03 | Respuesta | *PlanVigente* | cerrada | Un solo contrato para la app (HLT-16 D-10) | No |
| D-04 | Reactivar | Fuera de alcance | cerrada | La HU no lo pide | No |
| D-05 | Auditoría del corte | La emite `PlanVigenteSrv` (HLT-16) | cerrada | El corte ocurre al consultar, no al cancelar | No |
| D-06 | Servicio | `CancelacionPlanSrv` con reloj inyectable | cerrada | Mismo patrón que HLT-16/17 | No |
| D-07 | Mensajes de 409 | Dos mensajes distintos (RN-04) | cerrada | Los ve solo el dueño; no revelan datos ajenos | No |

**Preguntas del usuario (CERRADAS el 2026-11-11).** (1) «Sí» a reconstruir los scripts de pruebas: `docs/Planificacion/evidencias/` **ya no existe** y no hay copia; las líneas base antiguas de HU-001/HU-003 dejan de ser referencia comparativa y la nueva línea base se toma sobre el código actual (reconstrucción en HLT-15 T-02 y línea base en T-02b). (2) «Sí»: plan de pago cortado = Libre terminado sin plan (estado 6 = estado 4). (3) «No puede»: un administrador **no** confirma ni rechaza su propio pago, sin excepciones aunque sea el único administrador; las pruebas usan pagos fixture de otro usuario. (4) «Sí»: se acepta como riesgo que las cuentas registradas entre la aplicación del esquema y el despliegue de HLT-16 reciban la prueba. (5) «Sí»: la suscripción 28 puede pasar a `E` por la regla de corte. (6) «Sí, pero será después»: la pantalla para subir el comprobante de pago **no se planifica ahora**; es una historia futura explícita (el usuario la pedirá), sin tareas en estos HLT.

**Aplicación en este HLT:** ninguna pregunta nueva; la regresión usa las baterías reconstruidas.

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 literal de C4 |
| 2 | Reglas | ✅ | RN-01…RN-10 |
| 3 | Impacto | ✅ | solo `/suscripcion` |
| 4 | Arquitectura | ✅ | |
| 5 | Riesgos | ✅ | tabla |
| 6 | Simplicidad | ✅ | un `UPDATE` y un servicio |
| 7 | Seguridad | ✅ | |
| 8 | Cobertura | ✅ | |
| 9 | Determinismo | ✅ | |
| 10 | Ejecutabilidad | ✅ | |

**Ataques considerados.** *Cancelar el plan de otro:* 403 idéntico a id inexistente (C05/C06, `cmp`). *Cancelar prueba o Libre para «perderlos»:* 409 (C04). *Doble cancelación y carrera:* RN-06, C12. *Cancelar para forzar el corte inmediato:* no cambia `sus_fechaFin` (RN-03). *Cancelar y recuperar dinero:* sin devolución (RN-07). *Desfase horario del corte:* HLT-16 y X-script con tres zonas. *Cancelar con un plan ya cortado pero sin consultar:* el servicio no usa `A` vencidas: se resuelve el corte primero y responde 409.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | **El control de planes está solo en la app; los backends no limitan funciones** | **Alta** | Explícito en la HU; fuera de alcance |
| R-02 | Cancelación en carrera con la confirmación de pago | Media | Mismo mutex (usuario → suscripciones → pagos) |
| R-03 | Interpretar `sus_renovAutomatica` en planes antiguos | Baja | C-1 |

**Rondas.** *Ronda 1 — CON CAMBIOS:* el 403 uniforme necesitaba un id (D-02); la vigencia de corte debía resolverse antes de cancelar (ataque «plan cortado sin consultar»). *Ronda 2 — APROBADO;* la rev. 5 (menú) no cambia este HLT. **Veredicto: APROBADO.**
*Ronda 4 (respuestas del usuario) — APROBADO.* Solo cambia la referencia de la regresión (baterías de HLT-15).
*Ronda 5 (DT-15 del 2026-11-13) — APROBADO.* El comportamiento del endpoint no cambia; se añaden los casos de que cancelar evita la renovación pendiente y de que la renovación ya creada no se puede «cancelar» (RN-08, RN-11, C10, C11, C15, X02…X05). Ataque: *cancelar después del corte para borrar la renovación* → 409 y la `P` queda sin efecto (no es vigente, HLT-16-v4 RN-28).
*Ronda 6 (DT-16 y DT-17, 2026-11-13) — APROBADO.* Se define qué pasa con la renovación pendiente (409, vence sola a los 30 días) y con el periodo programado por un pago anticipado (cancelar lo deja sin renovación pero no lo pierde, sin devolución: RN-03, RN-11, C16, C17, X06). Ataque: *cancelar para anular un pago anticipado ya hecho* → el periodo pagado se cumple (DT-13: sin devolución); *cancelar entre la subida y la confirmación del anticipado* → la programada hereda el 0 al confirmarse (HLT-17-v4 RN-25).

---

## H7 · Plan de tareas

Todas `desarrollador-php`. `S` = `rest_suscripcion`, `EV` = `docs/Planificacion/evidencias`.

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | `EV/HLT-18/antes/*.txt` | — | HLT-16 y HLT-17 `COMPLETADOS` (`php -l` de `PlanVigenteSrv.php` y `MejoraPlanSrv.php`; `grep -c PLAN_CANCELADO S/configuracion/RegistroAuditoria.php` ≥ 1; `sha256sum` idéntico en los 4); `planVigente` de un fixture con plan de pago devuelve `PAGO` y `cancelado:false` | — |
| T-02 | `SuscripcionMdl`: marcar sin renovación | `S/modelos/SuscripcionMdl.php` | T-01 | `marcarSinRenovacion(int $idSuscripcion, int $idUsuario, string $fechaCambioUtc): int` con `UPDATE … WHERE sis_idSuscrip = ? AND sus_usuarioId = ? AND sus_renovAutomatica = 1` y filas afectadas, y `marcarSinRenovacionProgramada(int $idUsuario, string $fechaCambioUtc): int` (`UPDATE` de la `P` del usuario con pago `C` y `sus_renovAutomatica = 1`); `php -l` OK; sin `NOW(`/`date(` nuevos | RN-03 |
| T-03 | Crear `CancelacionPlanSrv` | `S/servicios/CancelacionPlanSrv.php` (nuevo) | T-02 | `cancelar(int $idUsuario, ?int $idSuscripcion): array` según H3, RN-02…RN-04, RN-06, RN-09 (marca también la programada, RN-03); reloj `Closure` inyectable; auditoría fuera de la transacción; sin código prohibido ni sintaxis 8.1+; `php -l` OK | RN-02…RN-09 |
| T-04 | Controlador | `S/controladores/SuscripcionCtrl.php` | T-03 | Método `cancelarPlan(array $datos)` con campos permitidos, `verificarUsuarioEnviado`, `leerEntero` opcional, `denegarAcceso` para id ajeno o inexistente (mismo mensaje), mensajes de H3, `try/catch (Throwable)`; `php -l` OK | RN-01, RN-05 |
| T-05 | Ruta | `S/rutas/SuscripcionRts.php` | T-04 | `manejarPost` trata `cancelar` antes de exigir cuerpo (acepta vacío/`{}`) y despacha a `cancelarPlan`; `php -l` OK; `curl -X POST …/suscripcion/cancelar` sin token → 401 | X-01 |
| T-06 | Humo | `EV/HLT-18/humo.txt` | T-05 | `php -l` de los 5 PHP del HLT; `grep -nE "\benum\b|readonly|\bnever\b|date\(|strtotime\(|NOW\("` sobre los archivos nuevos vacío | G-03 |
| T-07 | Escribir la prueba CLI del corte | `S/anexos/pruebas/cancelacion_reloj.php` (nuevo) | T-06 | Solo CLI; con reloj inyectado: **X01** plan de pago con corte hoy a las 23:59:59 vigente; **X02** a las 00:00:00 del día siguiente, con `sus_renovAutomatica = 1`: `E` + `PLAN_CORTADO` + `CORTADA` + renovación `P` (`renovacion` y `PLAN_RENOVACION`); **X03** igual con `sus_renovAutomatica = 0` (cancelado): `E` sin renovación; **X04** tras el corte no se crea prueba ni Libre y `iniciarPrueba` sigue 409; **X05** con la renovación `P` ya creada, `CancelacionPlanSrv::cancelar` → 409 y la `P` no cambia; **X06** presente + programada (pago `C`): `cancelar` deja ambas en `sus_renovAutomatica = 0`; en el corte la programada se activa y, al llegar a su propio corte, termina sin renovación; zonas Berlín, Guayaquil y Kiritimati; `PASS Xnn`; `php -l` OK | X-03, G-04 |
| T-08 | Escribir y ejecutar la batería HTTP | `EV/hu004_cancelacion.sh` (nuevo), `EV/HLT-18/despues/*.txt` | T-07 | `bash -n` OK; `bash EV/hu004_cancelacion.sh completo` con código 0 y todas `PASS Cnn` de H8 §RI-1; `C:\xampp\php\php.exe S/anexos/pruebas/cancelacion_reloj.php` con `PASS X01…X06`; `grep -c "1213\|Deadlock" S/logs/php_errores.log` sin aumento; sin 422/500; limpieza final (0 filas `ck_prueba_hu4_%`) | X-01…X-05 |
| T-09 | Documentar | `S/README.md` | T-08 | Fila de `POST /suscripcion/cancelar` con contrato de H3, `curl` de ejemplo, efecto «sigue vigente hasta la fecha de corte», sin devolución; `grep -c "suscripcion/cancelar" S/README.md` ≥ 2 | DT-13 |
| T-10 | Regresión y entrega | `EV/HLT-18/despues/regresion.txt`, `EV/HLT-18/entrega.txt` | T-09 | `hlt05v2_bateria.sh` y `hu003_flujos_cuenta.sh` (reconstruidas en HLT-15) dan líneas `NORM\|` iguales a `HLT-15/linea_base/` (diff vacío); lista de archivos y mensajes sugeridos (no se ejecutan): «HU-004: cancelación del plan de pago con efecto al fin del periodo» y «Docs: README con suscripcion/cancelar»; hash `➖` | G-01, G-02 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10.

---

## H8 · Reglas de implementación deterministas

Reglas de `desarrollador-php.md` («Arquitectura», «Seguridad», «Contrato de respuesta»).

- **RI-1 · Casos `Cnn`.** **C01** sin token → 401; **C02** feliz (fixture con plan de pago `A`, corte en el futuro): 200 con `cancelado:true` y misma `fechaCorte`; BD: `sus_renovAutomatica=0`, `sus_situacion='A'`, `sus_fechaFin` igual; `PLAN_CANCELADO` e historial `CANCELACION`; **C03** repetir → 409 `El plan ya está cancelado`; **C04** usuario en prueba o Libre → 409 `No tiene un plan de pago activo para cancelar`; **C05** `sis_idSuscrip` de otra cuenta → 403 `Acceso denegado`; **C06** `sis_idSuscrip` inexistente → mismo 403 (`cmp` byte a byte con C05); **C07** cuerpo con clave extra → 400; **C08** `?id=<otro>` → 403; **C09** `sus_proximoPago` y fechas sin cambio; **C10** corte con cancelación previa (fixture con `sus_fechaFin` = ayer UTC y `sus_renovAutomatica = 0`): `planVigente` `SIN_PLAN`/`PLAN_PAGO_VENCIDO` con `planPendiente: null`, suscripción `E`, `PLAN_CORTADO` y **ninguna** `P` nueva; **C11** igual sin cancelación previa: además una `P` de renovación (misma combinación, `sus_renovAutomatica = 1`, historial `renovacion`, `PLAN_RENOVACION`) y `planPendiente` no nulo, sin pagos nuevos; **C12** 5 simultáneas → un 200 y cuatro 409; **C13** los pagos del fixture no cambian (suma de verificación); **C14** ningún 422 ni 500; **C15** con la renovación `P` creada en C11, `POST suscripcion/cancelar` → 409 `No tiene un plan de pago activo para cancelar` y la `P` queda igual; **C16** (DT-16) plan de pago vigente con una programada: 200 con `cancelado:true`; BD: la `A` y la programada con `sus_renovAutomatica = 0`, el pago `C` y las fechas sin cambio; `planVigente` conserva `planProgramado`; al pasar el corte la programada pasa a `A` y no se crea renovación; **C17** (DT-17) con la renovación `P` dentro de sus 30 días, `POST suscripcion/cancelar` → 409 y la `P` queda igual; tras el día 31 la siguiente consulta de `planVigente` la anula y concede el Libre (HLT-16-v4).
- **RI-2.** Sin tocar MySQL/Apache, sin git de escritura, sin reportes `.md`; solo fixtures `ck_prueba_hu4_`.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9. Ficha: `Estado`; **C1** archivos declarados; **C2** criterio de H7 con salida literal; **C3** H8 y entorno; **C4** `php -l`; **C5** curl/CLI real; **C6** sin efectos fuera de alcance; `Evidencia`; `Notas`.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-02…T-05, T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-09, T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

Estructura fija: 1 Resumen · 2 Estado global · 3 Tablero · 4 Cobertura (X-01…X-05, RN-01…RN-10) · 5 Cambios `ruta:línea` · 6 Verificaciones (salida real de C01…C17 y X01…X06) · 7 Desviaciones · 8 Pendientes · 9 Próximos pasos (HLT-19). RR-1…RR-5; el coordinador guarda el `.md`.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

`CancelacionPlanSrv`, método `cancelarPlan` en el controlador (verbo + objeto en español); constantes con nombre (`MENSAJE_SIN_PLAN_DE_PAGO`, `MENSAJE_YA_CANCELADO`); el controlador no escribe SQL ni decide vigencia; el servicio no responde HTTP; consultas preparadas con tipos; comentarios y mensajes en español; commits por el usuario.
