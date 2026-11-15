# HLT-28-v2 — No regresión, prueba manual y cierre de HU-005 (F-01…F-04 y definición de terminado)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; revisado el 2026-11-13 por DT-15, DT-16 y DT-17) |
| Historia | `docs/Historia_usuario/HU-005-control-por-plan-comprobante-y-administracion.md` (rev. 3), criterios **F-01…F-04** y «Definición de terminado» |
| Numeración | Vigentes: HLT-15-v2 · HLT-16-v4 · HLT-17-v4 · HLT-18 · HLT-19-v2 · HLT-20-v2 · HLT-21-v2 · HLT-24-v2 · HLT-25-v2 · HLT-26-v2 · HLT-27-v2 · **HLT-28-v2 (este)** |
| Proyecto y git | `rest_suscripcion`, `rest_criteriokelly`, `rest_usuario`, `criterioKellyApp` (git propios), raíz (`CLAUDE.md`, `.claude/agents/`) y `docs/Planificacion/evidencias/` |
| Agente | `desarrollador-php` (T-01…T-04, T-07, T-09) y `desarrollador-ionic` (T-05, T-06, T-08) |
| Depende de | **HU-004 completa (HLT-15-v2…HLT-21-v2) y HLT-24-v2…HLT-27-v2 COMPLETADOS**. Se comprueba en T-01 |
| Lo consume | — (cierra HU-005 y el riesgo R-01 de HU-004) |
| Entorno | Igual que HLT-21-v2 |
| Veredicto senior (H6) | **APROBADO** (ronda 1) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) MySQL/Apache intocables; si falla, `BLOQUEADA`. (2) Commits del usuario; hash = `➖`. (3) Sin reportes `.md` en `evidencias/`. (4) Fixtures `ck_prueba_hu5_*` y `ck_prueba_hu4_*`, limpiados al final. (5) Nunca abrir ni imprimir `.env`. (6) Un administrador nunca valida su propio pago. (7) Cédulas y correos enmascarados en cualquier salida.

---

## H1 · Propósito

**Requerimiento literal (HU-005 rev. 2).** «**F-01** Los criterios de HU-004 siguen cumpliéndose; se repiten sus baterías. **F-02** Un usuario Enterprise o en Prueba ve exactamente lo mismo que hoy en todas las pantallas. **F-03** Los datos existentes no se borran ni se modifican al aplicar topes (cuentas de más, operaciones antiguas). **F-04** `ng lint`, `ng test`, `ng build` y `php -l` sin errores.» · Definición de terminado: «Prueba manual: elegir un plan → subir el comprobante → aprobarlo con otra cuenta administradora → el plan aparece vigente; rechazo y nueva subida; un recorrido por las cinco pantallas con cada plan. READMEs de `rest_suscripcion`, `rest_criteriokelly` y la app, `CLAUDE.md` y los agentes actualizados.»

**Propósito.** Demostrar que HU-005 está completa y que nada de HU-001, HU-003 y HU-004 se rompió.

**Resultado esperado (observable).** Todas las baterías en verde en una sola corrida; `sha256` de las copias compartidas iguales; app compilando y con pruebas en verde; prueba manual confirmada por el usuario con la frase «PRUEBA MANUAL HU-005 OK»; documentación actualizada; entrega con la lista de archivos y mensajes de commit sugeridos.

**Fuera de alcance.** Cambios funcionales nuevos (cualquier fallo vuelve al HLT que lo introdujo); commits; despliegue.

**Feature(s) afectada(s).** Solo documentación (`CLAUDE.md`, `.claude/agents/desarrollador-php.md`, `.claude/agents/desarrollador-ionic.md`, READMEs) y evidencias.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Estado previo | Las fichas H9 de HLT-21-v2 y HLT-24-v2…HLT-27-v2 están en `COMPLETADO`; `suscripcion_01_plan_prueba_verificar.sql` da `PASS RN-14` | — |
| RN-02 | Baterías completas | Una corrida de `hu003_flujos_cuenta.sh`, `hlt05v2_bateria.sh`, `hu004_*.sh`, `hu004_pagos.sh` (incluye los casos A27…A56 de HU-005, DT-16 y DT-17), `hu005_limites_servidor.sh` y los CLI `lector_plan_vigente.php`, `cancelacion_reloj.php` y los de HU-004 con código 0; sin 422 ni 500; `1213`/`Deadlock` sin aumento | F-01 |
| RN-03 | Copias idénticas | `sha256sum` igual en los 4 `RegistroAuditoria.php` y en los 2 `LectorPlanVigente.php` | E-06 |
| RN-04 | Datos intactos | Suma de verificación de `sckc_cuentas`, `sckb_bitacora`, `scko_observacion` de usuarios no fixture igual antes y después de la corrida | F-03 |
| RN-05 | Sin cambios para Enterprise/Prueba | K20 de HLT-24-v2 y LP-03 de HLT-27-v2 en verde | F-02 |
| RN-06 | Estática | `php -l` de cada PHP listado por `git status --short` en los 4 backends; `ng lint`, `ng test --watch=false`, `ng build` con código 0 | F-04 |
| RN-07 | Puerta humana | T-06 no se marca `HECHA` sin la frase literal «PRUEBA MANUAL HU-005 OK» | Definición de terminado |
| RN-08 | Limpieza | 0 filas de `ck_prueba_hu5_%` y `ck_prueba_hu4_%` al final | entorno 4 |

---

## H3 · Flujo principal de ejecución

```
T-01 estado previo → T-02 estática PHP → T-03 baterías y CLI → T-04 no regresión y datos
T-05 app (lint/test/build) → T-06 PUERTA manual «PRUEBA MANUAL HU-005 OK»
T-07 docs raíz y agentes → T-08 docs app → T-09 limpieza y entrega consolidada
```

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Prueba |
|--------------------|--------|--------|
| F-01 / RN-02 | T-03, T-04 | baterías |
| F-02 / RN-05 | T-03, T-05 | K20, LP-03, LP-04 |
| F-03 / RN-04 | T-04 | sumas de verificación |
| F-04 / RN-06 | T-02, T-05 | lint, test, build, `php -l` |
| E-06 / RN-03 | T-02 | `sha256sum` |
| Prueba manual / RN-07 | T-06 | guion H8 §RI-1 |
| Documentación | T-07, T-08 | AC-T-07, AC-T-08 |

### Discrepancias HU ↔ código
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | «aprobarlo con otra cuenta administradora» | Un administrador no valida su propio pago (RN-03 de HLT-17) | El guion usa un suscriptor fixture y un administrador fixture distintos |
| C-2 | Batería de HU-001 sobre `rest_criteriokelly` | Con la puerta de HLT-24, un usuario sin plan recibiría 403 | Se ejecuta con fixtures Enterprise (como en HLT-24-v2 T-14) |

### Checklist de calidad del HLT
- [x] 11 secciones · [x] sin marcadores · [x] cobertura 100 % · [x] criterios verificables · [x] referencias leídas el 2026-11-12 · [x] decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Qué hacer con un fallo | Volver al HLT que lo introdujo; aquí no se corrige | cerrada | Este HLT solo verifica y documenta | No |
| D-02 | Cierre del riesgo R-01 de HU-004 | Se marca cerrado en HU-004 y HU-005 solo si T-03 y T-06 pasan | cerrada | Evidencia real | No |

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1…10 | Entendimiento, reglas, impacto, arquitectura, riesgos, simplicidad, seguridad, cobertura, determinismo, ejecutabilidad | ✅ | |

**Ataques considerados.** *Marcar la prueba manual sin hacerla:* frase literal (RN-07). *Copias que se desincronizan después:* `sha256` en este cierre y regla escrita en `CLAUDE.md` (T-07). *Fixtures olvidados:* RN-08.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | El lector y `PlanVigenteSrv` divergen en el futuro | Alta | `CLAUDE.md` y agentes documentan que la regla vive en dos lugares y que el CLI `lector_plan_vigente.php` debe pasar en cada cambio |
| R-02 | La prueba manual depende del tiempo del usuario | Baja | Guion corto con fixtures preparados |

**Rondas.** *Ronda 1 — APROBADO.* *Ronda 2 (v2) — APROBADO:* dependencias y baterías actualizadas a los HLT vigentes (HLT-22 y HLT-23 ANULADOS) y caso manual 10 para las cuentas antiguas sin plan. **Veredicto: APROBADO.**
*Ronda 3 (DT-15 y DT-16, 2026-11-13) — APROBADO:* guion con los casos 11 (renovación pendiente) y 12 (fechas de la subida y comprobante antiguo); baterías con A27…A56. **Veredicto: APROBADO.**
*Ronda 4 (DT-16 con su alcance y DT-17, 2026-11-13) — APROBADO:* guion con los casos 13 (pago anticipado) y 14 (plazo, anulación y Libre nuevo).

---

## H7 · Plan de tareas

`EV` = `docs/Planificacion/evidencias`.

| ID | Agente | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|--------|-------|----------|---------|------------------------|-------|
| T-01 | desarrollador-php | Estado previo | `EV/HLT-28/estado_previo.txt` | — | RN-01 | — |
| T-02 | desarrollador-php | Estática PHP y copias | `EV/HLT-28/php_estatico.txt` | T-01 | RN-06 (parte PHP) y RN-03 | F-04, E-06 |
| T-03 | desarrollador-php | Corrida única de baterías y CLI | `EV/HLT-28/baterias/*.txt` | T-02 | RN-02 con salida literal | F-01, F-02 |
| T-04 | desarrollador-php | No regresión de datos | `EV/HLT-28/regresion/*.txt` | T-03 | RN-04 (sumas antes/después iguales) | F-03 |
| T-05 | desarrollador-ionic | Verificación de la app | `EV/HLT-28/app/{lint,test,build}.txt` | T-01 | RN-06 (parte app) | F-04 |
| T-06 | desarrollador-ionic | **PUERTA humana:** prueba manual | `EV/HLT-28/puerta_manual.txt` | T-04, T-05 | El agente prepara los fixtures, muestra el guion de H8 §RI-1 y se detiene; `HECHA` solo con «PRUEBA MANUAL HU-005 OK»; otra respuesta → `BLOQUEADA` con lo que reporte el usuario | RN-07 |
| T-07 | desarrollador-php | Documentación raíz y agentes | `CLAUDE.md`, `.claude/agents/desarrollador-php.md`, `.claude/agents/desarrollador-ionic.md`, `rest_suscripcion/README.md`, `rest_criteriokelly/README.md` (revisión final) | T-06 | `CLAUDE.md`: los límites de plan se aplican en el servidor (`ControlPlan`, lista blanca sin plan, `LectorPlanVigente` copia idéntica con `sha256` y CLI de equivalencia), 403 con mensaje propio para límites, objeto `limites`; agentes: mismas reglas; README revisados | Definición de terminado |
| T-08 | desarrollador-ionic | Documentación de la app | `criterioKellyApp/CLAUDE.md`, `criterioKellyApp/README.md` (revisión final) | T-06 | Comprobante, validación de pagos por rol y límites por pantalla documentados; dónde vive la configuración | Definición de terminado |
| T-09 | desarrollador-php | Limpieza, cierre y entrega consolidada | `EV/HLT-28/entrega.txt`, `docs/Historia_usuario/HU-005-…md`, `docs/Historia_usuario/HU-004-…md` | T-07, T-08 | RN-08; HU-005 «Estado: Cerrada» con la fecha; HU-004 riesgo R-01 marcado «Cerrado por HU-005» (D-02); `git status --short` por proyecto y mensajes sugeridos consolidados; hash `➖` | RN-08 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09.

---

## H8 · Reglas de implementación deterministas

- **RI-1 · Guion de la prueba manual** (`ionic serve --port=8100`; el agente entrega usuario y clave de cada fixture sin cédula ni correo completos):
  1. Suscriptor `ck_prueba_hu5_m1` en Libre con un plan Básico pendiente: Planes → «Subir comprobante» → método BANCO, transacción `HU5-M1`, imagen → ver «En revisión».
  2. Administrador `ck_prueba_hu5_adm`: menú «Validar pagos» visible → abrir el pago → ver la imagen → Rechazar con motivo «Imagen ilegible».
  3. Suscriptor: ver «Rechazado: Imagen ilegible» → subir otro con `HU5-M2`.
  4. Administrador: Aprobar → el pago sale de la lista.
  5. Suscriptor: el plan Básico aparece vigente con su fecha de corte.
  6. Con el suscriptor en Básico: `/operativas` (aviso 15 días, «Graficar operaciones» → «Actualiza su plan para poder visualizar», PDF sí); `/analisis` (rango máx. 5 días, máx. 5 operaciones, Excel sí); `/cuentas` (segunda cuenta → «Tu plan permite 1 cuenta(s)…»); `/operativa-kelly` (divisor 10 no editable); `/mostrar-criterio-kelly` (operaciones diarias máx. 1).
  7. Repetir el paso 6 rápido con `ck_prueba_hu5_ent` (Enterprise): sin avisos ni bloqueos.
  8. Con `ck_prueba_hu5_adm`, abrir el pago fixture que es suyo: no aparecen Aprobar ni Rechazar.
  9. Con un suscriptor sin rol de administrador, escribir `/validar-pagos` → vuelve a `/inicio`.
  10. Con una cuenta fixture antigua sin ningún plan (`ck_prueba_hu5_old`): aviso «Debes activar un plan», el menú pide activar un plan y solo Mostrar criterio Kelly abre.
  11. (DT-15) Con `ck_prueba_hu5_ren` (plan de pago activo con renovación automática): con `UPDATE` de su fixture adelantar `sus_fechaFin`; al abrir la app aparece «Tu plan … terminó. La renovación está pendiente de pago…», el menú queda mínimo y «Subir comprobante» abre; subir el comprobante; el administrador ve la fecha de subida y la de corte resultante y aprueba; el plan vuelve a estar vigente con corte = día de la subida + meses. Repetir con `sus_renovAutomatica = 0`: solo «Debes activar un plan», sin renovación.
  12. (DT-16) Con un comprobante fixture subido hace 3 días (`UPDATE` de pago y fechas): la ventana muestra la fecha de corte resultante = subida + meses y, al aprobar, la persona ve ese corte. Con un comprobante de plan mensual subido hace más de un mes: la ventana marca «demasiado antiguo», Aprobar está deshabilitado, Rechazar parte con el motivo precargado y la persona puede subir otro.
  13. (DT-16 anticipado) Con `ck_prueba_hu5_adv` (plan de pago activo con el corte en 10 días): en Planes, «Pagar mi renovación por anticipado» → subir el comprobante («Tu renovación empezará el …»); el administrador ve «Pago anticipado: el nuevo periodo empezará el <día siguiente al corte>…» y aprueba; la persona ve «Tu renovación ya está pagada, empieza el …» y su plan actual sigue vigente; con `UPDATE` de su fixture adelantar el corte del presente: el plan sigue sin interrupción con el periodo pagado y no aparece ninguna renovación pendiente.
  14. (DT-17) Con `ck_prueba_hu5_ren` sin pagar: corte hace 30 días → «Hoy es el último día para pagarlo…» y el menú mínimo; corte hace 31 días → una sola vez «Tu renovación se anuló por falta de pago; estás en el plan Libre…» con menú completo y límites del Libre; al terminar ese Libre «Debes activar un plan». Con un comprobante `R` en revisión de una renovación fuera de plazo, no se anula hasta que el administrador lo rechace.
  Responder «PRUEBA MANUAL HU-005 OK» o describir lo que falló.
- **RI-2.** Sin tocar MySQL/Apache, sin git de escritura, sin reportes `.md`.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-03, T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-07…T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

1 Resumen · 2 Estado global de HU-005 · 3 Tablero HLT-24-v2…HLT-28-v2 · 4 Cobertura (A…F de la HU) · 5 Cambios por proyecto · 6 Verificaciones (salida real) · 7 Desviaciones · 8 Pendientes · 9 Mensajes de commit sugeridos. RR-1…RR-5.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

Solo documentación: en español, con rutas `ruta:línea` verificadas, sin duplicar lo que ya está en los README (el `CLAUDE.md` enlaza en lugar de copiar).
