# HLT-15-v2 — Esquema de datos: plan de prueba de 24 horas y límites de cada plan (HU-004 rev. 5: A-01…A-04 · HU-005 rev. 3: A-01, A-02)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; reemplaza a la versión anterior de HLT-15, eliminada el 2026-11-12) |
| Historia | `docs/Historia_usuario/HU-004-plan-de-prueba-24-horas.md` (rev. 5), sección «Datos» y criterios **A-01, A-02, A-03, A-04** · `docs/Historia_usuario/HU-005-control-por-plan-comprobante-y-administracion.md` (rev. 3), «Fuente única de los límites», criterios **A-01, A-02** · decisiones del usuario del 2026-11-12: (1) reutilizar columnas existentes y añadir solo 3; (3) un único script y una única puerta para HU-004 y HU-005 |
| Numeración | Vigentes (orden de ejecución): **HLT-15-v2 (este)** · HLT-16-v4 · HLT-17-v4 · HLT-18 · HLT-19-v2 · HLT-20-v2 · HLT-21-v2 · HLT-24-v2 · HLT-25-v2 · HLT-26-v2 · HLT-27-v2 · HLT-28-v2. **HLT-22 y HLT-23 ANULADOS** (absorbidos por este HLT, HLT-16-v4 y HLT-17-v4). HLT-10 y HLT-11 reservados para HU-001 |
| Proyectos y git | `rest_suscripcion` (git propio: scripts SQL y README). Raíz del workspace sin git: `docs/Planificacion/evidencias/` (scripts `.sh` y salidas `.txt`). No se toca ningún otro proyecto |
| Agente de implementación | `desarrollador-php` en todas las tareas (T-06 es una puerta humana) |
| Depende de | HU-001 y HU-003 cerradas (HLT-12, HLT-13 y HLT-14 **COMPLETADOS**). Se verifica en T-01/T-02 |
| Lo consume | HLT-16-v4 (código que lee las columnas, el plan 5 y los límites), HLT-17-v4, HLT-18, HLT-19-v2, HLT-24-v2 |
| Entorno verificado al planificar (2026-11-11) | PHP 8.2.35 (`C:\xampp\php\php.exe`, no está en PATH); MariaDB **10.4.32** local, `@@tx_isolation = REPEATABLE-READ`, `@@time_zone = SYSTEM` (hora local del equipo = UTC−5 en esta máquina); `date.timezone = Europe/Berlin` en `C:\xampp\php\php.ini:977`; Apache y MySQL en marcha; base viva `sist_criteriokelly` con 4 planes, 5 intervalos, **16** combinaciones, 23 suscripciones (1 `A`, 22 `P`) y 13 pagos |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 5; ver H6) |
| Estado | **COMPLETADO con cambio de alcance (2026-11-12).** El usuario aplicó el esquema él mismo (vía A) y verificó `PASS` RN-01, 02, 03, 04, 06, 13 y 14. Después ordenó **un solo SQL de estructura y uno de datos por proyecto**, generados desde la base viva: los scripts `suscripcion_01_plan_prueba*.sql` y el ciclo de reversión de T-07 **ya no existen** (el esquema ya está en `sist_suscripcion_estructura.sql` y `sist_suscripcion_datos.sql`). T-03, T-04 y T-07 quedan sustituidas por esa regeneración; T-02/T-02b (baterías y línea base) y T-08/T-09 (README y entrega) se mantienen. Las baterías que referencian `hu004_esquema.sh` ya no deben usarlo. Desde ahora, todo cambio de esquema se entrega al usuario como script listo para ejecutar desde su gestor, y luego se regeneran los dos SQL del proyecto (regla escrita en `CLAUDE.md`). |

> **Referencias `ruta:línea`.** Todas leídas el 2026-11-11 (rutas relativas a `rest_suscripcion/` salvo indicación). Si una tarea desplaza líneas, se localiza por el nombre del objeto y se anota la línea real en la ficha.

> **Reglas de entorno que este HLT impone (obligatorias en cada tarea).**
> 1. **MySQL y Apache no se tocan.** Prohibido iniciar, detener, reiniciar o «reparar» MySQL/Apache, ejecutar `reparar-mysql-db.bat`, `mysqlcheck`, `REPAIR`/`OPTIMIZE`, o escribir en las tablas `mysql.*` (el MySQL local se corrompió dos veces). Si una consulta falla por el servidor (error 2002/2013/1034/1194/145 o similar), el agente **se detiene**, deja la tarea `BLOQUEADA` con la salida literal y avisa. No reintenta ni repara.
> 2. **Los commits los hace el usuario.** Ninguna tarea ejecuta `git add`, `git commit`, `push`, `checkout`, `reset`, `stash` ni `clean`. Solo `git status`/`git diff`/`git log` (lectura). La última tarea entrega la lista de archivos y los mensajes de commit sugeridos; todo criterio que hable de «hash de commit» queda `➖`.
> 3. Los subagentes **no escriben reportes `.md`** en `docs/Planificacion/evidencias/`; escriben scripts `.sh`/`.php` y salidas `.txt`. El coordinador guarda los reportes.
> 4. Todo dato de prueba lleva el prefijo `ck_prueba_hu4_` (usuarios), `ck.prueba.hu4.<x>@example.com` (correos) y teléfonos `0990004xxx`.
> 5. **E-05 / lección F-01 de HLT-06 v2.** En este HLT los scripts SQL no comparan nada con `NOW()`; el único reloj que decide vigencias en HLT-16 en adelante es el de PHP en UTC.

---

## H1 · Propósito

**Requerimiento literal (HU-004, «Datos: un plan nuevo y dos columnas»):** «Se añaden, mediante un script idempotente en `rest_suscripcion/anexos/` (y no editando los volcados de instalación existentes): **1.** Dos columnas en `spsu_planes` […] `pla_horasDuracion int(11) NULL` […] `pla_planSiguienteId int(11) NULL` […] El script también actualiza el plan Libre existente (`UPDATE spsu_planes SET pla_horasDuracion = 240 WHERE pla_idPlan = 1`). **2.** Una columna en `spsu_suscripcion`: `sus_fechaHoraFin DATETIME NULL` (en UTC) […] **3.** El plan nuevo, con los mismos permisos que el Enterprise […] **4.** Un intervalo y una combinación plan × intervalo […] (`ins_numMeses = 0`; combinación 17).» Criterios: «**A-01** Existe un script idempotente […] con su reversión […] Se puede ejecutar dos veces sin error y los volcados de instalación existentes no se editan. **A-02** Los planes 1 a 4 y sus 16 combinaciones quedan idénticos; las suscripciones existentes no cambian. **A-03** El plan `Prueba` tiene los mismos límites que el Enterprise, `pla_horasDuracion = 24` y `pla_planSiguienteId = 1`. El plan Libre queda con `pla_horasDuracion = 240` y los mismos límites que hoy. **A-04** Las claves foráneas y los índices existentes se conservan; una instalación nueva desde los scripts deja el mismo esquema que la base actualizada.»

**Requerimiento literal (HU-005 rev. 3, «Fuente única de los límites»).** «**La base de datos ya está diseñada: se reutilizan sus columnas** […] y solo se añaden las tres que no tienen equivalente: […] `pla_numCuentas` 1/1/5/10 · `pla_diasHistorial` 8/15/30/365 · `pla_bloqueoDias` 5/5/30/30, sin tope por `pla_rangoLibre = 1` · `pla_diasTotales` y `pla_puedeDescargar` sin cambios · `pla_puedeGraficar` (nueva) 0/0/1/1 · `pla_divisorEditable` (nueva) 0/0/1/1 · `pla_maxOperacionesDiarias` (nueva, `NULL` = sin límite) 1/1/5/`NULL` […] Los nuevos valores y las tres columnas van en el **mismo script de esquema de HU-004** (una sola confirmación).» · «**A-01** El script de esquema de HU-004 (uno solo, idempotente y con reversión) añade a `spsu_planes` **solo** `pla_puedeGraficar`, `pla_divisorEditable` y `pla_maxOperacionesDiarias` […] No añade columnas a `spsu_pagos`. **A-02** La Prueba (id 5) tiene los mismos límites que Enterprise.»

**Propósito.** Dejar en la base de datos los datos que hacen que la duración y el plan siguiente sean información y no reglas escritas en el código, de forma que el servidor pueda más adelante conceder la prueba de 24 horas y resolver su caducidad, sin alterar ningún plan, precio ni suscripción existente.

**Resultado esperado (observable).**
1. Existen `spsu_planes.pla_horasDuracion`, `spsu_planes.pla_planSiguienteId` (`int(11) NULL`) y `spsu_suscripcion.sus_fechaHoraFin` (`datetime NULL`).
2. Existen el plan 5 «Prueba» (límites idénticos al Enterprise con los valores de HU-005: 10 cuentas, 365 días de historial, 365 totales, bloque 30, descarga 1/1/1, graficar 1, divisor editable 1, operaciones diarias `NULL`; `pla_horasDuracion = 24`, `pla_planSiguienteId = 1`, `pla_precioBase = 0.00`), el intervalo 6 «Prueba (24 horas)» (`ins_numMeses = 0`) y la combinación 17 (plan 5 × intervalo 6, precio 0.00).
3. El plan Libre (1) tiene `pla_horasDuracion = 240` y `pla_planSiguienteId IS NULL`; los planes 2, 3 y 4 tienen ambas columnas en `NULL`. Existen las 3 columnas nuevas de HU-005 y los planes 1–5 tienen los límites de RN-14.
4. Una **suma de verificación** de las columnas originales de planes 1–4 (salvo `pla_numCuentas`, `pla_diasHistorial` y `pla_bloqueoDias`, que fija RN-14), intervalos 1–5, combinaciones 1–16, suscripciones y pagos da exactamente el mismo valor antes y después (A-02).
5. El script se ejecuta dos veces seguidas sin error y sin cambios en la segunda; la reversión deja la base como estaba antes (misma suma de verificación y mismo `SHOW CREATE TABLE`) y vuelve a poder aplicarse.
6. `spsu_suscripcion` gana un índice `spsu_suscripcion_usuario_idx (sus_usuarioId, sus_situacion)` (decisión D-03) para que los bloqueos `FOR UPDATE` de HLT-16/17 no recorran toda la tabla; las claves foráneas e índices previos siguen idénticos.
7. Los volcados `anexos/sist_suscripcion*.sql` no cambian (`git diff` vacío sobre ellos); el `README.md` documenta el modelo ampliado y cómo aplicar o revertir el script.

**Fuera de alcance.**
- Cualquier código PHP o de la app (lo hacen HLT-16, HLT-17, HLT-18). Tras este HLT, `planes/disponible` **listará** el plan 5 y `crearSinPago` lo aceptará hasta que termine HLT-16 (ver riesgo R-01): HLT-15 y HLT-16 se despliegan juntos.
- Editar los volcados de instalación (`sist_suscripcion.sql`, `sist_suscripcionDatos.sql`, `sist_suscripcion_CRM.sql`), corregir su desfase con la base viva (README «Estado actual») o añadir las columnas `pag_montoConfirmado`, `pag_correo`, `pag_tipocripto` al anexo.
- Claves foráneas nuevas (p. ej. `pla_planSiguienteId → spsu_planes`) o cambiar el tipo de `sus_fechainicio`/`sus_fechaFin` (DT-04).
- Ningún cambio de precios ni de las 16 combinaciones; en los planes solo cambian `pla_horasDuracion` del Libre y los límites de RN-14.
- Exponer y aplicar los límites (HLT-16-v4 los expone; HLT-24-v2 y HLT-27-v2 los aplican). Ninguna columna nueva en `spsu_pagos` (el motivo de rechazo va al historial, HLT-17-v4).

**Feature(s) afectada(s).** `rest_suscripcion` → `anexos/` (3 scripts nuevos) y `README.md`. Base `sist_criteriokelly` → tablas `spsu_planes`, `spsu_planintervalo`, `spsu_intervalosuscr`, `spsu_suscripcion`. `docs/Planificacion/evidencias/` → `lib/hu004_comun.sh`, `hu004_esquema.sh` y salidas `HLT-15/*.txt`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Las columnas nuevas son nulas y no alteran datos | `pla_horasDuracion`, `pla_planSiguienteId` y `sus_fechaHoraFin` aceptan `NULL` (`IS_NULLABLE='YES'` en `information_schema.columns`); tras aplicar, `SELECT COUNT(*) FROM spsu_suscripcion WHERE sus_fechaHoraFin IS NOT NULL` = 0 y los planes 2, 3 y 4 tienen ambas columnas `NULL` | A-01 · DT-04 · DT-08 |
| RN-02 | El plan 5 es «acceso total» con 24 h y siguiente = Libre | Fila 5: `pla_nombre='Prueba'`, `pla_precioBase=0.00`, `pla_moneda='USD'`, `pla_numCuentas=10`, `pla_diasHistorial=365`, `pla_diasTotales=365`, `pla_bloqueoDias=30`, `pla_puedeDescargar=1`, `pla_descargaTodos=1`, `pla_rangoLibre=1`, `pla_puedeGraficar=1`, `pla_divisorEditable=1`, `pla_maxOperacionesDiarias=NULL`, `pla_horasDuracion=24`, `pla_planSiguienteId=1`, `pla_estado='1'`; sus 10 columnas de límite son iguales a las del plan 4 tras aplicar RN-14 (comparación por SQL) | A-03 · HU «El plan nuevo» |
| RN-03 | Un intervalo propio y una combinación | `spsu_intervalosuscr` id 6 = (`'Prueba (24 horas)'`, 0, 0.00, `'1'`); `spsu_planintervalo` id 17 = (plan 5, intervalo 6, 0.00, `'1'`) en la base viva (id explícito 17 si está libre; si no, el siguiente automático, ver D-02) | A-01 · DT-05 |
| RN-04 | El plan Libre pasa a 240 h | Fila 1: `pla_horasDuracion=240`, `pla_planSiguienteId IS NULL`; precio y columnas que RN-14 no toca coinciden con la línea base | A-03 · DT-01 (HU-004 rev. 5: los límites los fija HU-005) |
| RN-05 | Nada de lo existente cambia | Suma de verificación de planes 1–4 (columnas originales salvo `pla_numCuentas`, `pla_diasHistorial` y `pla_bloqueoDias`), intervalos 1–5, combinaciones 1–16, suscripciones (todas las columnas originales), pagos e historial idéntica antes y después | A-02 |
| RN-06 | Claves foráneas e índices previos se conservan | `information_schema.referential_constraints` y `statistics` de las 4 tablas: el conjunto previo es subconjunto del posterior; el único objeto nuevo es `spsu_suscripcion_usuario_idx` (y solo si no existía ya un índice con `sus_usuarioId` como primera columna) | A-04 |
| RN-07 | Idempotente | Segunda ejecución consecutiva: sin error (código de salida 0), `ROW_COUNT`/`affected rows` sin cambios reales y misma suma de verificación y mismo `SHOW CREATE TABLE` que tras la primera | A-01 |
| RN-08 | Reversible y segura | La reversión deja suma de verificación y `SHOW CREATE TABLE` iguales a la línea base y puede reaplicarse; **aborta** (mysql sale con error `ABORTA_HU004_…`) si existen suscripciones del plan 5 o filas con `sus_fechaHoraFin` no nulo, para no perder datos; devuelve las columnas de límite a la columna «antes» de RN-14 y quita las 3 columnas de HU-005 | A-01 |
| RN-09 | Los volcados de instalación no se editan | `git diff --stat -- anexos/sist_suscripcion.sql anexos/sist_suscripcionDatos.sql anexos/sist_suscripcion_CRM.sql` vacío | A-01 |
| RN-10 | Nada toca una base real sin confirmación escrita | T-07 no empieza sin la frase exacta «CONFIRMO ESQUEMA HU-004» del usuario (T-06); la base se modifica solo con los scripts de este HLT y los fixtures de la tarea | RD-6 · restricción del entorno |
| RN-11 | Los scripts funcionan en MariaDB 10.4 y en MySQL 8 | No usan `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` ni `SIGNAL` fuera de rutinas: cada cambio va guardado por una consulta a `information_schema` ejecutada con `PREPARE`/`EXECUTE` | D-01 |
| RN-12 | El usuario de la aplicación no cambia esquema | Los scripts se ejecutan con `C:\xampp\mysql\bin\mysql.exe -u root`; `ck_aplicacion` conserva `SELECT, INSERT, UPDATE, DELETE, EXECUTE` (verificado en `information_schema.schema_privileges`) | `README.md` paso 4 |
| RN-13 | El plan Prueba queda identificable por datos, no por id | «Es plan de prueba» ≡ `pla_horasDuracion IS NOT NULL AND pla_planSiguienteId IS NOT NULL`; el script no asume que el id de la combinación sea 17 en otras bases | DT-08 · D-02 |
| RN-14 | Límites de HU-005 (columnas reutilizadas + 3 nuevas) | Columnas nuevas: `pla_puedeGraficar tinyint(1) NOT NULL DEFAULT 1`, `pla_divisorEditable tinyint(1) NOT NULL DEFAULT 1`, `pla_maxOperacionesDiarias int(11) NULL` (`NULL` = sin límite). Valores (numCuentas / diasHistorial / bloqueoDias / puedeGraficar / divisorEditable / maxOperacionesDiarias): **1 Libre** 1/8/5/0/0/1 · **2 Básico** 1/15/5/0/0/1 · **3 Premium** 5/30/30/1/1/5 · **4 Enterprise** 10/365/30/1/1/`NULL` · **5 Prueba** = fila 4. `pla_diasTotales`, `pla_puedeDescargar`, `pla_descargaTodos` y `pla_rangoLibre` no cambian. Columna «antes» (la restaura la reversión): numCuentas 1/3/6/100, diasHistorial 10/15/30/30, bloqueoDias 10/15/30/30 | HU-005 A-01, A-02; decisión 1 del usuario |

---

## H3 · Flujo principal de ejecución

```
[Disparador: el usuario pide ejecutar HLT-15]
 → T-01 precondiciones (servicios arriba, esquema actual, línea base A-02)         ── falla de servidor → DETENER (BLOQUEADA)
 → T-02 RECONSTRUIR ayudantes y baterías mínimas (lib/comun.sh, lib/hu003_comun.sh, lib/limpiar_datos_prueba.sh, hu003_flujos_cuenta.sh, hlt05v2_bateria.sh)   (los originales ya no existen)
 → T-02b línea base «antes» con esas baterías sobre el código actual (ANTES de la puerta y de cualquier cambio)   ── servidor caído → DETENER
 → T-03 escribir suscripcion_01_plan_prueba.sql
 → T-04 escribir …_reversion.sql y …_verificar.sql
 → T-05 escribir lib/hu004_comun.sh y hu004_esquema.sh
 → T-06 PUERTA «CONFIRMO ESQUEMA HU-004»  (el usuario responde por escrito; vía A: él aplica el ALTER; vía B: lo aplica el agente)
        ├─ sin frase exacta → tarea BLOQUEADA, nadie toca la base
        └─ con frase → T-07
 → T-07 aplicar (vía B) o comprobar lo aplicado (vía A) → verificar → aplicar 2.ª vez → reversión → verificar línea base → reaplicar → verificar
        ├─ éxito: suma A-02 idéntica; A-01, A-03, A-04 comprobados
        └─ error de SQL: parar; NO reparar MySQL; reversión solo con el script del HLT; informar
 → T-08 README → T-09 entrega de archivos y mensajes de commit sugeridos
```

Secuencia del script de aplicación (cada paso con su guarda, todo en una sola pasada del cliente `mysql`):

```
G0  guardas de conflicto (aborta con "ABORTA_HU004_<motivo>")
      plan id 5 existe y pla_nombre <> 'Prueba'            → ABORTA_HU004_PLAN5_OCUPADO
      intervalo id 6 existe y ins_nombre <> 'Prueba (24 horas)' → ABORTA_HU004_INTERVALO6_OCUPADO
G1  ALTER spsu_planes ADD pla_horasDuracion   (si la columna no existe)
G2  ALTER spsu_planes ADD pla_planSiguienteId (si no existe)
G3  ALTER spsu_suscripcion ADD sus_fechaHoraFin (si no existe)
G4  CREATE INDEX spsu_suscripcion_usuario_idx (si ningún índice de la tabla tiene sus_usuarioId como 1.ª columna)
G5  INSERT plan 5 (si no existe el id 5)
G6  INSERT intervalo 6 (si no existe el id 6)
G7  INSERT combinación (plan 5 × intervalo 6): id 17 si está libre; si no, id automático; solo si la pareja no existe
G8  UPDATE Libre SET pla_horasDuracion = 240 WHERE pla_idPlan = 1 AND pla_horasDuracion IS NULL
G9  ALTER spsu_planes ADD pla_puedeGraficar, pla_divisorEditable, pla_maxOperacionesDiarias (cada una solo si no existe)
G10 UPDATE de los límites de los planes 1–4 (RN-14) y copia de las 10 columnas de límite de la fila 4 a la fila 5 (idempotente: mismos valores)
```

**Ramas de error.** No hay HTTP en este HLT. Errores de `mysql` → código de salida ≠ 0 → la tarea queda `BLOQUEADA` con la salida literal. Errores de servidor MySQL (conexión rechazada, tabla corrupta) → **detener sin reparar**.

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Prueba / verificación |
|--------------------|--------|-----------------------|
| A-01 script idempotente + reversión / RN-07, RN-08, RN-11 | T-03, T-04, T-05, T-07 | AC-T-03, AC-T-04, AC-T-07 (aplicar ×2, revertir, reaplicar) |
| A-01 volcados sin editar / RN-09 | T-09 | `git diff --stat` vacío sobre los 3 volcados (AC-T-09) |
| A-01 columnas nulas, plan 5, intervalo 6, combinación 17 / RN-01, RN-02, RN-03 | T-03, T-07 | `suscripcion_01_plan_prueba_verificar.sql` (AC-T-07) |
| HU-005 A-01, A-02 límites / RN-14 | T-01, T-03, T-04, T-07 | `PASS RN-14` del script de verificación; columna «antes» comprobada en T-01 |
| A-02 nada cambia / RN-05 | T-01, T-07 | suma de verificación antes/después (`linea_base_esquema.txt` vs `esquema_despues.txt`) |
| A-03 límites del plan 5 = Enterprise; Libre 240 / RN-02, RN-04 | T-07 | comparación SQL fila 5 vs fila 4 y fila 1 vs línea base |
| A-04 FK e índices conservados / RN-06 | T-01, T-07 | `fk_indices_antes.txt` ⊆ `fk_indices_despues.txt` (AC-T-07) |
| Reglas de entorno (RD-6, MySQL intocable) / RN-10, RN-12 | T-06, T-07, T-09 | frase exacta registrada; ningún comando prohibido en `HLT-15/comandos.txt` |
| Baterías de no regresión reconstruidas y línea base (G-01) / C-5, D-08, D-11, D-12 | T-02, T-02b, T-07 | AC-T-02 (controles a-d), AC-T-02b, AC-T-07 (8) |
| Documentación del esquema / RN-09 | T-08 | AC-T-08 |
| Entrega de commits sin `git add`/`commit` | T-09 | AC-T-09 |

### Checklist de calidad del HLT

- [x] Las 11 secciones existen y están completas.
- [x] Sin marcadores pendientes.
- [x] Cada RN mapea a ≥ 1 tarea (cobertura 100 %).
- [x] Cada tarea tiene criterio de aceptación verificable (H7) y ficha de checks (H9).
- [x] No contradice `CLAUDE.md` raíz ni `desarrollador-php.md` (scripts en `anexos/`, volcados intactos, sin tocar MySQL).
- [x] Referencias `ruta:línea` leídas el 2026-11-11.
- [x] Decisiones cerradas en H5; preguntas del usuario cerradas (6) y PU-2 no bloqueante.

### Discrepancias entre la HU, el código y la base real (registradas)

| # | La HU / documentación dice | Realidad verificada | Impacto | Resolución adoptada |
|---|----------------------------|---------------------|---------|---------------------|
| C-1 | «Existe una combinación 17» y A-04 «una instalación nueva deja el mismo esquema» | La base viva tiene 16 combinaciones y `AUTO_INCREMENT = 21` en `spsu_planintervalo`; el volcado `sist_suscripcionDatos.sql:51-70` trae **20** combinaciones (ids 1–20, con `pin_estado='A'`), así que en una instalación desde el volcado el id 17 ya está ocupado por Enterprise trimestral | Un `INSERT` con id 17 fijo fallaría en instalaciones nuevas | D-02: id 17 si está libre; si no, id automático por clave natural (plan 5, intervalo 6). El código nunca depende del número (RN-13) |
| C-2 | Volcado: Libre con `pla_numCuentas = 2` (`sist_suscripcionDatos.sql:36`) | Base viva: Libre con 1 cuenta; Enterprise con 100 cuentas y 365 días totales (el volcado dice `-1` y `-1`) | El plan 5 «igual que el Enterprise» debe copiar la **base viva** | D-04: los valores del plan 5 son los de la base viva (100/30/365/30/1/1/1), tal como el borrador de la HU |
| C-3 | Planes y combinaciones activos | Volcado usa `pin_estado='A'`; el código filtra `'1'` (`modelos/PlanesMdl.php:24`, `:34`) | Con el volcado, `planes/disponible` queda vacío (ya documentado en el README) | El script inserta `'1'`, como la base viva y la HU. El desfase del volcado no es de esta historia |
| C-4 | HU: `sus_situacion` ∈ P, A, C, S, E | Base viva añade `F: Finalizada` al comentario de la columna | Ninguno | Se respeta tal cual; no se redefine el comentario |
| C-5 | Prompt de planificación: existen `evidencias/lib/comun.sh`, `lib/hu003_comun.sh`, `lib/limpiar_datos_prueba.sh`, `hlt05v2_bateria.sh`, `hu003_flujos_cuenta.sh` y `PLAN-MAESTRO-HU-001-v2.md` | **Ya no existen** y no hay copia: `docs/Planificacion/evidencias/` no existe (solo hay `PLAN-MAESTRO-HU-001.md` y, de scripts, `rest_usuario/anexos/pruebas/seguridad_01_pruebas.sh`). El código de HLT-12, HLT-13 y HLT-14 sí está aplicado (p. ej. `PersonaCtrl.php:139` ya dice «…el teléfono o la cédula ya están registrados» y existe `rest_usuario/correo/`) | Sin referencia comparativa antigua | **Decisión cerrada del usuario (pregunta 1):** T-02 reconstruye ayudantes y baterías mínimas a partir de los casos de HLT-12 v2 (AC-T-33), HLT-14 y HLT-05 v2 (H7.2) y del **código actual**; T-02b toma la nueva línea base sobre el código actual, antes de cambiar comportamiento |
| C-6 | `.claude/agents/desarrollador-php.md`: PHP 8.0 | Runtime local PHP 8.2.35 | El código de HLT-16/17 debe ser compatible con 8.0 (hosting) aunque `php -l` en 8.2 no lo detecte | HLT-16/17 incluyen un `grep` de sintaxis 8.1+ (`enum`, `readonly`, `never`, `new` en inicializadores) |

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Cómo hacer idempotentes los cambios | A) `ADD COLUMN IF NOT EXISTS` / `INSERT IGNORE` (solo MariaDB); B) guardas con `information_schema` + `PREPARE`/`EXECUTE` (portable) | **B** | El hosting puede ser MySQL 8, que no admite `ADD COLUMN IF NOT EXISTS`; una guarda explícita funciona en ambos | No |
| D-02 | Id de la combinación del plan de prueba | A) fijo 17; B) automático; C) 17 si está libre, si no automático y siempre con clave natural única (plan, intervalo) | **C** | Cumple la HU en la base viva (17 libre: `AUTO_INCREMENT=21` y no hay fila 17) y no falla en instalaciones desde el volcado; el código localiza el plan por datos (RN-13) | No |
| D-03 | Índice por usuario | A) no crear (HU no lo pide); B) `spsu_suscripcion_usuario_idx (sus_usuarioId, sus_situacion)` guardado | **B** | Sin índice por `sus_usuarioId`, `SELECT … FOR UPDATE` bajo `REPEATABLE-READ` recorre y bloquea toda la tabla (riesgo R-S1 del README «Estado actual»). HLT-16 llama a `planVigente` en cada apertura de la app, por lo que bloquearía a todos los usuarios entre sí. Es aditivo y reversible; la guarda evita duplicar un índice equivalente (p. ej. el que proponga HLT-11 de HU-001) | No |
| D-04 | Valores del plan 5 | A) copiar del volcado (Enterprise `-1`); B) los del borrador de la HU (= Enterprise de la base viva) | **B** | A-03: «mismos límites que el Enterprise»; el Enterprise vivo es 100/30/365/30/1/1/1 (C-2) | No |
| D-05 | Marca de «corte de cuentas nuevas» (usada en HLT-16, DT-02) | A) constante en código; B) clave nueva en `.env`; C) la columna `pla_fechacambio` de la fila 5, que toma `DEFAULT current_timestamp()` al insertarse | **C** | Sin columnas ni claves nuevas; queda fija en la fila 5 (la columna no tiene `ON UPDATE`); se compara como época con `UNIX_TIMESTAMP()` contra `per_fechaRegis` (ambos en hora local de la base, sin suponer UTC). El `INSERT` **no** debe indicar `pla_fechacambio` | No (la fecha queda registrada al aplicar) |
| D-06 | Reversión | A) borrar todo siempre; B) abortar si hay datos que se perderían | **B** | Evita perder suscripciones de prueba o `sus_fechaHoraFin` por accidente (RN-08) | No |
| D-07 | Cómo se aborta un script SQL sin rutinas | A) `SIGNAL`; B) sentencia dinámica que referencia una tabla inexistente cuyo nombre contiene el motivo | **B** | `SIGNAL` solo existe dentro de rutinas; B detiene el cliente `mysql` con código ≠ 0 y deja el motivo `ABORTA_HU004_<motivo>` en el mensaje | No |
| D-08 | Dónde viven los ayudantes de prueba | A) reutilizar los antiguos (ya no existen); B) reconstruir `lib/comun.sh`, `lib/hu003_comun.sh`, `lib/limpiar_datos_prueba.sh` y crear además `lib/hu004_comun.sh` | **B** | Decisión del usuario (pregunta 1); se mantiene el prefijo `ck_prueba_` y el patrón de `rest_usuario/anexos/pruebas/seguridad_01_pruebas.sh:14-18` | No |
| D-09 | `pla_planSiguienteId` con clave foránea | A) FK a `spsu_planes`; B) sin FK | **B** | La HU lo define `int(11) NULL`; RD-7 (menor superficie). La integridad la verifica `…_verificar.sql` | No |
| D-10 | Vía de aplicación a la base local | A) solo el usuario; B) solo el agente; C) ambas, a elección del usuario en la puerta | **C** | Decisión del usuario en HU-003 (él aplicó los ALTER); la puerta T-06 ofrece las dos | No |
| D-11 | Alcance de la batería reconstruida | A) copia fiel de HLT-12/HLT-05; B) mínima necesaria para G-01, adaptada al código actual | **B** | Los originales no existen; el código actual manda (cédula en el 409, correos como archivos `logs/correos/correo-*.txt`) | No |
| D-13 | Límites de HU-005 en este script | A) script y puerta aparte (HLT-22 v1); B) mismo script y misma puerta | **B — CERRADA por el usuario el 2026-11-12** | Una sola confirmación y ningún script duplicado; HLT-22 queda ANULADO | No |
| D-14 | Valores de la reversión | Literales de la columna «antes» de RN-14, verificados en T-01 contra la base viva | cerrada | Script estático y determinista; si la base no coincide, T-01 se bloquea | No |
| D-12 | Cuándo se toma la línea base | A) en HLT-16; B) en HLT-15 T-02b, antes de la puerta | **B** | Debe ser anterior a cualquier cambio de comportamiento; HLT-15 solo añade datos | No |

**Preguntas abiertas (no bloquean el inicio de HLT-15).**
- **PU-1 (CERRADA por el usuario).** Los scripts de HU-003 no existen y no hay copia: se **reconstruyen** (T-02) y la línea base se toma de nuevo (T-02b).
- **PU-2.** Tras HLT-15 y antes de HLT-16, el plan 5 queda visible en `planes/disponible` en la base local. ¿Se acepta (es solo desarrollo local) o se prefiere aplicar el esquema justo al empezar HLT-16? *Recomendación:* aceptarlo y ejecutar HLT-15 y HLT-16 el mismo día.
**Preguntas del usuario (CERRADAS el 2026-11-11).** (1) «Sí» a reconstruir los scripts de pruebas: `docs/Planificacion/evidencias/` **ya no existe** y no hay copia; las líneas base antiguas de HU-001/HU-003 dejan de ser referencia comparativa y la nueva línea base se toma sobre el código actual (reconstrucción en HLT-15 T-02 y línea base en T-02b). (2) «Sí»: plan de pago cortado = Libre terminado sin plan (estado 6 = estado 4). (3) «No puede»: un administrador **no** confirma ni rechaza su propio pago, sin excepciones aunque sea el único administrador; las pruebas usan pagos fixture de otro usuario. (4) «Sí»: se acepta como riesgo que las cuentas registradas entre la aplicación del esquema y el despliegue de HLT-16 reciban la prueba. (5) «Sí»: la suscripción 28 puede pasar a `E` por la regla de corte. (6) «Sí, pero será después»: la pantalla para subir el comprobante de pago **no se planifica ahora**; es una historia futura explícita (el usuario la pedirá), sin tareas en estos HLT.

---

## H6 · Revisión del requerimiento por parte de un senior

### Checklist senior

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 cita los criterios A-01…A-04 y el borrador SQL de la HU; las discrepancias C-1…C-6 están registradas |
| 2 | Reglas de negocio | ✅ | RN-01…RN-13 son invariantes con consulta o comando |
| 3 | Impacto | ✅ | Solo `anexos/`, README y evidencias; se declara el efecto lateral temporal (R-01) |
| 4 | Consistencia arquitectónica | ✅ | Scripts en `anexos/` como `seguridad_01_sesion.sql` de `rest_usuario/anexos/`; nombres en español |
| 5 | Riesgos | ✅ | R-01…R-06 con severidad |
| 6 | Simplicidad | ✅ | Un script, una reversión, una verificación; sin FK ni tablas nuevas |
| 7 | Seguridad | ✅ | `ck_aplicacion` no obtiene `ALTER`; el esquema solo lo toca root bajo puerta |
| 8 | Cobertura | ✅ | Matriz H4 al 100 % |
| 9 | Determinismo | ✅ | D-01…D-10 cerradas; PU-1/PU-2 no bloquean |
| 10 | Ejecutabilidad por agente | ✅ | Cada tarea nombra archivos y comandos |

### Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Entre HLT-15 y HLT-16 el plan 5 es visible en `planes/disponible` y aceptado por `crearSinPago` (A-7 y A-6 de la HU) | Media | Solo local; HLT-15 y HLT-16 se ejecutan consecutivamente; no se despliega HLT-15 solo. Una fila `P` del plan 5 creada así no es vigente (solo `A` cuenta) |
| R-02 | Un `ALTER` mal aplicado en una base con datos | Media | Columnas nulas, guardas, reversión probada, suma de verificación antes/después, puerta con confirmación escrita |
| R-03 | El índice nuevo duplica uno futuro de HLT-11 (HU-001) | Baja | La guarda busca cualquier índice con `sus_usuarioId` como primera columna; la reversión borra solo el índice con nombre exacto `spsu_suscripcion_usuario_idx` |
| R-04 | Corrupción de MySQL durante el ALTER | Alta | Prohibido reparar; el agente se detiene; el usuario restaura con su procedimiento. El script no usa operaciones masivas |
| R-05 | El volcado y la base viva siguen desfasados | Baja | Documentado (C-1…C-4); no se edita el volcado |
| R-07 | Los suscriptores actuales ven menos límites (Básico de 3 a 1 cuenta, Libre de 10 a 8 días) | Media | Decisión del usuario; las cuentas existentes se conservan (DN-08, HLT-24-v2) |
| R-06 | Fecha de corte `pla_fechacambio` depende de la hora local de la base | Baja | Se compara por época con `UNIX_TIMESTAMP()` en ambos lados (D-05); HLT-16 lo prueba con fixtures antes y después |

### Rondas

- **Ronda 1 — APROBADO CON CAMBIOS.** (a) `ADD COLUMN IF NOT EXISTS` no es portable a MySQL 8 → D-01. (b) El `INSERT … id 17` fallaría con el volcado de 20 combinaciones → D-02. (c) La reversión podía borrar datos reales → D-06 y RN-08. (d) `FOR UPDATE` sin índice por usuario bloquearía toda la tabla → D-03. (e) La corte de «cuentas nuevas» de DT-02 necesitaba un dato estable sin columnas nuevas → D-05. (f) Los scripts de evidencias referenciados no existen → C-5, T-02 y PU-1.
- **Ronda 2 — APROBADO.** Cambios aplicados; no quedan decisiones abiertas con impacto sobre la ejecución.
- **Ronda 3 (revisiones 4 y 5 de la HU) — APROBADO sin cambios de contenido.** Se releyó la HU: las revisiones 4 y 5 añaden vigencia por periodo con corte (DT-12), validación del comprobante (P-03, P-08), cancelación (C4), menú por estado (F-06, F-07) y los eventos `PLAN_CANCELADO` y `PLAN_CORTADO`. Ninguna exige columnas, tablas o índices distintos de A-01…A-04: la cancelación usa `sus_renovAutomatica` (ya existe) y el corte de un plan de pago usa `sus_fechaFin` (tipo `date`, sin tocar). La numeración de HU-004 pasa a HLT-15…HLT-21 (ver HLT-16).
- **Ronda 4 (respuestas del usuario) — APROBADO.** La falta de scripts pasa de bloqueo a trabajo planificado: T-02 reconstruye y T-02b toma la línea base antes de la puerta; sin cambios en el esquema. Se registran las respuestas 2 a 6 como contexto para HLT-16 a HLT-21.
- **Ronda 5 (v2, decisiones del usuario del 2026-11-12) — CON CAMBIOS → APROBADO.** Se fusiona el esquema de HLT-22: mismas guardas y misma puerta para las 3 columnas y los límites (RN-14, D-13). Ataques: *reversión que pierde los límites originales* → T-01 comprueba la columna «antes» y la reversión la restaura (D-14); *plan 5 desfasado de Enterprise* → G10 copia la fila 4 ya actualizada; *`UPDATE` que mueva la marca `pla_fechacambio` del plan 5 (D-05)* → la columna no tiene `ON UPDATE` y el script no la nombra; *columna en `spsu_pagos`* → ninguna (decisión 2).

**Veredicto: APROBADO.** El HLT es autónomamente ejecutable, no toca MySQL fuera de los scripts bajo puerta, y todas las discrepancias con la HU y con la base real están registradas y resueltas.

---

## H7 · Plan de tareas

Columnas: ID · Tarea · Agente · Archivos · Depende de · Criterio de aceptación (verificable) · RN/Req.

| ID | Tarea | Agente | Archivos | Depende de | Criterio de aceptación | RN/Req |
|----|-------|--------|----------|-----------|------------------------|--------|
| T-01 | Verificar precondiciones y capturar la línea base del esquema (solo lectura) | desarrollador-php | `docs/Planificacion/evidencias/HLT-15/linea_base_esquema.txt`, `fk_indices_antes.txt`, `show_create_antes.txt`, `entorno.txt`, `comandos.txt` (nuevos; la carpeta se crea) | — | `C:\xampp\php\php.exe -v` = 8.2.x; `curl -s -o /dev/null -w "%{http_code}" http://localhost/criterio_kelly/rest_suscripcion/planes/disponible` = `200`; `entorno.txt` contiene `@@tx_isolation`, `@@time_zone`, `date.timezone` y `SELECT version()`; `linea_base_esquema.txt` contiene el conteo y la suma `MD5(GROUP_CONCAT(...))` de planes 1–4, intervalos 1–5, combinaciones 1–16, suscripciones, pagos e historial (columnas originales); `grep -c "pla_horasDuracion" show_create_antes.txt` = 0; `pla_numCuentas`, `pla_diasHistorial` y `pla_bloqueoDias` de los planes 1–4 son los de la columna «antes» de RN-14 (si no, `BLOQUEADA`); `entorno.txt` registra cuántos usuarios no tienen ninguna suscripción `A`/`E` (afectados por la decisión 4: `SIN_PLAN` con límites del Libre); `rest_suscripcion/anexos/` aún sin `suscripcion_01_*` | A-02, RN-05 |
| T-02 | Reconstruir los ayudantes y las baterías mínimas de no regresión (los originales ya no existen; decisión del usuario) | desarrollador-php | `docs/Planificacion/evidencias/lib/comun.sh`, `lib/hu003_comun.sh`, `lib/limpiar_datos_prueba.sh`, `hu003_flujos_cuenta.sh`, `hlt05v2_bateria.sh` (nuevos) | T-01 | Implementados según H8 `RI-A5 (casos de HLT-12 v2 AC-T-33 G1…G5, G4 con cédula de HLT-14 y P-10…P-16 de HLT-05 v2, sobre el código actual); `bash -n` de los 5 archivos sin error; sin comandos prohibidos (`grep -nEi "mysqlcheck\|REPAIR\|OPTIMIZE\|mysql\\.\|reparar-mysql\|net stop\|net start"` vacío); **controles:** (a) `bash hu003_flujos_cuenta.sh` y `bash hlt05v2_bateria.sh` terminan con código 0 y `grep -c "^FALLO "` = 0; (b) dos corridas seguidas producen las mismas líneas `NORM\|` (`diff` vacío); (c) control negativo con `MENSAJE_409='otro'` → código 1; (d) tras cada corrida `SELECT COUNT(*) FROM sgen_usuario WHERE usu_usuario REGEXP '^ck_prueba_'` = 0 | G-01, C-5 |
| T-02b | Tomar la línea base «antes» de las baterías sobre el código actual | desarrollador-php | `docs/Planificacion/evidencias/HLT-15/linea_base/hu003_flujos_cuenta_antes.txt`, `hlt05v2_antes.txt` (nuevos) | T-02 | Las salidas literales de una corrida limpia de cada batería (con su código de salida 0) quedan guardadas **antes** de T-06; el archivo declara «línea base tomada el 2026-11-11 sobre el código actual (HLT-12/13/14 aplicados); las líneas base antiguas ya no existen» | G-01 |
| T-03 | Escribir el script de aplicación idempotente | desarrollador-php | `rest_suscripcion/anexos/suscripcion_01_plan_prueba.sql` (nuevo) | T-01 | El archivo implementa G0…G8 de H3 con las definiciones exactas de H8 §RI-A1; `grep -nE "ADD COLUMN IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|SIGNAL|NOW\(\)|CURDATE|CURRENT_" suscripcion_01_plan_prueba.sql` sin resultados salvo comentarios; no contiene `pla_fechacambio` en el `INSERT` del plan; `git status --short anexos/` muestra solo archivos nuevos (`??`) | A-01, A-03, RN-01…RN-04, RN-11, RN-13 |
| T-04 | Escribir la reversión y la verificación | desarrollador-php | `rest_suscripcion/anexos/suscripcion_01_plan_prueba_reversion.sql`, `rest_suscripcion/anexos/suscripcion_01_plan_prueba_verificar.sql` (nuevos) | T-03 | La reversión implementa el orden y las guardas de H8 §RI-A2; la verificación contiene solo `SELECT` (`grep -ciE "insert|update|delete|alter|drop|create" …_verificar.sql` = 0) y emite líneas `PASS <id>`/`FAIL <id>` para RN-01, RN-02, RN-03, RN-04, RN-06, RN-13 y RN-14 | A-01, A-03, A-04, RN-08 |
| T-05 | Escribir los ayudantes y el arnés de pruebas del esquema | desarrollador-php | `docs/Planificacion/evidencias/lib/hu004_comun.sh`, `docs/Planificacion/evidencias/hu004_esquema.sh` (nuevos) | T-03, T-04 | `bash -n` sobre ambos sin error; `hu004_comun.sh` define las funciones de H8 §RI-A3 (`mysql_hu4`, `snapshot_a02`, `fk_indices`, `limpiar_prueba_hu4`, `registrar_comando`); `hu004_esquema.sh` admite `antes`, `aplicar`, `idempotencia`, `reversion`, `verificar`, `completo`; ninguna función contiene los comandos prohibidos de la regla 1 (`grep -nEi "mysqlcheck|REPAIR|OPTIMIZE|mysql\.|reparar-mysql|net stop|net start|xampp-control" lib/hu004_comun.sh hu004_esquema.sh` sin resultados) | RN-07, RN-08, RN-10 |
| T-06 | **PUERTA.** Pedir al usuario la confirmación escrita para aplicar el esquema a la base local | desarrollador-php (solo formula la pregunta y registra la respuesta; no modifica nada) | `docs/Planificacion/evidencias/HLT-15/puerta_esquema.txt` (nuevo) | T-03, T-04, T-05 | El agente muestra el texto de la puerta (H8 §RI-A4) y se detiene. `puerta_esquema.txt` registra fecha, vía elegida (A o B) y la frase **literal** «CONFIRMO ESQUEMA HU-004». Cualquier otra respuesta → tarea `BLOQUEADA`, T-07 no se ejecuta | RN-10 |
| T-07 | Aplicar (vía B) o reconocer lo aplicado (vía A) y verificar A-01…A-04 con el ciclo completo | desarrollador-php | `docs/Planificacion/evidencias/HLT-15/esquema_despues.txt`, `fk_indices_despues.txt`, `show_create_despues.txt`, `ciclo_reversion.txt` (nuevos) | T-06 | `bash docs/Planificacion/evidencias/hu004_esquema.sh completo` termina con código 0 y deja: (1) verificación `PASS` en todas las líneas; (2) segunda ejecución sin error y suma idéntica; (3) `suma_a02` después = `suma_a02` antes; (4) tras la reversión, `SHOW CREATE TABLE` de `spsu_planes` y `spsu_suscripcion` iguales a `show_create_antes.txt` y suma de verificación igual a la línea base; (5) tras reaplicar, verificación `PASS` otra vez; (6) `fk_indices_antes.txt` ⊆ `fk_indices_despues.txt` (`comm -23` vacío); (7) `SELECT pin_idPlanInterv FROM spsu_planintervalo WHERE pin_plaIdPlan=5` = 17; (8) las dos baterías de T-02 dan la misma salida normalizada que la línea base de T-02b; (9) `PASS RN-14` en las dos verificaciones | A-01…A-04, RN-01…RN-08 |
| T-08 | Documentar el modelo ampliado y el uso de los scripts | desarrollador-php | `rest_suscripcion/README.md` | T-07 | La tabla «Modelo de datos» describe `pla_horasDuracion`, `pla_planSiguienteId`, `sus_fechaHoraFin`, el plan 5, el intervalo 6, la combinación 17, el índice, las 3 columnas de HU-005 y la tabla de límites de RN-14; una sección «Scripts de esquema (HU-004)» documenta aplicar, verificar y revertir con `C:\xampp\mysql\bin\mysql.exe -u root sist_criteriokelly < anexos/…`; `grep -c "suscripcion_01_plan_prueba" README.md` ≥ 3 | RN-09, A-01 |
| T-09 | Verificar que los volcados no cambiaron y entregar la lista de archivos y los mensajes de commit sugeridos | desarrollador-php | `docs/Planificacion/evidencias/HLT-15/entrega.txt` (nuevo) | T-08 | `git -C C:\xampp\htdocs\criterio_kelly\rest_suscripcion diff --stat -- anexos/sist_suscripcion.sql anexos/sist_suscripcionDatos.sql anexos/sist_suscripcion_CRM.sql` vacío; `git status --short` lista solo `README.md` (M) y los 3 `anexos/suscripcion_01_*` (??); `entrega.txt` contiene la lista y estos mensajes sugeridos (el agente **no** los ejecuta): `rest_suscripcion`: «Esquema HU-004/HU-005: columnas de duración, plan Prueba, plan Libre de 240 horas y límites de cada plan (script idempotente con reversión)» y «Docs: README de rest_suscripcion con el esquema de HU-004»; criterios de hash de commit = `➖` | RN-09 |

**Orden topológico:** T-01 → T-02 → T-02b (paralelizable con T-03 solo si T-02b ya terminó antes de T-06) → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09. Una sola tarea `EN_CURSO` a la vez (RS-3).

---

## H8 · Reglas de implementación deterministas

Reglas heredadas de `.claude/agents/desarrollador-php.md`: «Entorno» (`C:\xampp\php\php.exe`), «Arquitectura obligatoria» (los scripts SQL van en `anexos/`) y «Seguridad → Base de datos» (nada de concatenar valores; en este HLT no hay PHP).

- **RI-1 · Sin tocar MySQL/Apache** (regla de entorno 1). Cada comando ejecutado se anexa a `HLT-15/comandos.txt` con su código de salida.
- **RI-2 · Sin git de escritura** (regla de entorno 2).
- **RI-3 · Nombres en español y prefijo `ck_prueba_hu4_`** para todo fixture.
- **RI-4 · Archivos fuera de alcance.** Una tarea no toca archivos que su fila no declare (RI-10 del contrato).

**§RI-A1 · Definiciones exactas del script de aplicación** (`suscripcion_01_plan_prueba.sql`; cabecera en español con propósito, fecha 2026-11-11, uso y la advertencia «ejecutar con root, nunca con ck_aplicacion»):

| Objeto | Definición |
|--------|-----------|
| Columna 1 | `ALTER TABLE spsu_planes ADD COLUMN pla_horasDuracion int(11) NULL DEFAULT NULL COMMENT 'Horas de duración del plan; NULL en los planes de pago' AFTER pla_rangoLibre` |
| Columna 2 | `ALTER TABLE spsu_planes ADD COLUMN pla_planSiguienteId int(11) NULL DEFAULT NULL COMMENT 'Plan al que pasa la cuenta al terminar; NULL en los planes de pago' AFTER pla_horasDuracion` |
| Columna 3 | `ALTER TABLE spsu_suscripcion ADD COLUMN sus_fechaHoraFin datetime NULL DEFAULT NULL COMMENT 'Fin exacto en UTC (planes con duración en horas y activaciones de HU-004)' AFTER sus_fechaFin` |
| Índice | `CREATE INDEX spsu_suscripcion_usuario_idx ON spsu_suscripcion (sus_usuarioId, sus_situacion)` solo si `information_schema.statistics` no muestra ningún índice de `spsu_suscripcion` con `seq_in_index = 1` y `column_name = 'sus_usuarioId'` |
| Plan 5 | `INSERT INTO spsu_planes (pla_idPlan, pla_nombre, pla_descripcion, pla_precioBase, pla_moneda, pla_caracteris, pla_numCuentas, pla_diasHistorial, pla_diasTotales, pla_bloqueoDias, pla_puedeDescargar, pla_descargaTodos, pla_rangoLibre, pla_horasDuracion, pla_planSiguienteId, pla_estado) VALUES (5, 'Prueba', 'Acceso completo durante 24 horas', 0.00, 'USD', 'Acceso completo con filtros libres y descarga total durante 24 horas. Después pasa al plan Libre.', 10, 365, 365, 30, 1, 1, 1, 24, 1, '1')` (**sin** `pla_fechacambio`; D-05) |
| Intervalo 6 | `INSERT INTO spsu_intervalosuscr (ins_idInterSuscrip, ins_nombre, ins_numMeses, ins_x100descuen, ins_estado) VALUES (6, 'Prueba (24 horas)', 0, 0.00, '1')` |
| Combinación | `INSERT INTO spsu_planintervalo (pin_idPlanInterv, pin_plaIdPlan, pins_idInterSuscrip, pin_precioFinal, pin_estado) VALUES (17, 5, 6, 0.00, '1')` si el id 17 está libre; si no, sin `pin_idPlanInterv`; en ambos casos solo si no existe ya la pareja (5, 6) |
| Libre | `UPDATE spsu_planes SET pla_horasDuracion = 240 WHERE pla_idPlan = 1 AND pla_horasDuracion IS NULL` |
| Columnas HU-005 | `ALTER TABLE spsu_planes ADD COLUMN pla_puedeGraficar tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Puede graficar operaciones, 0=No' AFTER pla_planSiguienteId`; `… ADD COLUMN pla_divisorEditable tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Puede cambiar el divisor de Kelly, 0=Fijo en 10' AFTER pla_puedeGraficar`; `… ADD COLUMN pla_maxOperacionesDiarias int(11) NULL DEFAULT NULL COMMENT 'Máximo de operaciones diarias del criterio de Kelly; NULL = sin límite' AFTER pla_divisorEditable` (cada una con su guarda) |
| Límites | Cuatro `UPDATE spsu_planes SET pla_numCuentas = …, pla_diasHistorial = …, pla_bloqueoDias = …, pla_puedeGraficar = …, pla_divisorEditable = …, pla_maxOperacionesDiarias = … WHERE pla_idPlan = <1…4>` con los literales de RN-14, y `UPDATE spsu_planes p5 JOIN spsu_planes p4 ON p4.pla_idPlan = 4 SET p5.pla_numCuentas = p4.pla_numCuentas, … (las 10 columnas de límite) WHERE p5.pla_idPlan = 5`; ninguna sentencia nombra `pla_fechacambio` |
| Guardas | Cada sentencia se ejecuta como `SET @s = IF(<condición en information_schema o en la tabla>, '<sentencia>', 'DO 0'); PREPARE p FROM @s; EXECUTE p; DEALLOCATE PREPARE p;`. Los motivos de aborto usan `IF(<conflicto>, 'SELECT * FROM abortar_hu004_<motivo>', 'DO 0')` (D-07) |
| Mensaje final | `SELECT 'HU004_ESQUEMA_OK' AS resultado` |

**§RI-A2 · Reversión** (orden obligatorio, todo guardado e idempotente): (1) abortar con `ABORTA_HU004_HAY_SUSCRIPCIONES_DE_PRUEBA` si existe una `spsu_suscripcion` cuya combinación pertenece al plan 5, y con `ABORTA_HU004_HAY_FECHAHORAFIN` si hay filas con `sus_fechaHoraFin IS NOT NULL`; (2) `DELETE` de la combinación (plan 5, intervalo 6); (3) `DELETE` del intervalo 6 si su nombre es `Prueba (24 horas)`; (4) `DELETE` del plan 5 si su nombre es `Prueba`; (5) `UPDATE spsu_planes SET pla_horasDuracion = NULL WHERE pla_idPlan = 1 AND pla_horasDuracion = 240`; (5b) devolver `pla_numCuentas`, `pla_diasHistorial` y `pla_bloqueoDias` de los planes 1–4 a la columna «antes» de RN-14; (5c) `DROP COLUMN` de `pla_maxOperacionesDiarias`, `pla_divisorEditable` y `pla_puedeGraficar` si existen; (6) borrar el índice `spsu_suscripcion_usuario_idx` si existe con ese nombre exacto; (7) `DROP COLUMN` de `sus_fechaHoraFin`, `pla_planSiguienteId`, `pla_horasDuracion` si existen. Mensaje final `HU004_REVERSION_OK`.

**§RI-A3 · Ayudantes (`hu004_comun.sh`).** Variables `URL`, `PHP`, `MYSQL`, `BD=sist_criteriokelly`, `SALIDA` (carpeta `HLT-NN`). Funciones: `mysql_hu4 "<sql>"` (`"$MYSQL" -u root -N -B "$BD" -e`), `snapshot_a02` (devuelve una línea `tabla|conteo|md5` por tabla, solo columnas originales, ordenadas por clave primaria), `fk_indices` (consulta `information_schema.referential_constraints` y `statistics` para las 4 tablas, ordenada), `limpiar_prueba_hu4` (borra en este orden: `spsu_pagos`, `spsu_historialsuscri`, `spsu_suscripcion` de usuarios `ck_prueba_hu4_%`, luego `sgen_auditoria` con `aud_usuId` de esos usuarios, `sgen_verificacion`, `sgen_recuperacion`, `sgen_rolusuario`, `sgen_sesion`, `sgen_usuario` y `sgen_persona`), `registrar_comando` (anexa a `comandos.txt`), `crear_usuario_activo <sufijo>` (registro por `persona/agregar`, `UPDATE sgen_usuario SET usu_situacion='A'`, login y devuelve el `accessToken`, según `rest_usuario/anexos/pruebas/seguridad_01_pruebas.sh:25-39`), `llamar <método> <ruta> <token> [cuerpo]` (curl con `Origin: http://localhost:8100` y `X-Requested-With: CriterioKelly`, imprime cuerpo y ` HTTP <código>`). `hu004_esquema.sh completo` ejecuta: antes → (según vía) aplicar → verificar → idempotencia → reversión → comparar con la línea base → reaplicar → verificar.

**§RI-A4 · Texto de la puerta (T-06).**
> «**PUERTA HU-004 — cambio de esquema en la base local `sist_criteriokelly`.** Se van a añadir 3 columnas nulas (`spsu_planes.pla_horasDuracion`, `spsu_planes.pla_planSiguienteId`, `spsu_suscripcion.sus_fechaHoraFin`), 1 índice (`spsu_suscripcion_usuario_idx`), el plan 5 «Prueba», el intervalo 6 y la combinación 17, se pondrá `pla_horasDuracion = 240` al plan Libre y, para HU-005, se añadirán 3 columnas (`pla_puedeGraficar`, `pla_divisorEditable`, `pla_maxOperacionesDiarias`) y se fijarán los límites de los planes (el Libre pasa a 8 días de reporte y 5 de análisis; el Básico de 3 a 1 cuenta; el Premium de 6 a 5; el Enterprise y la Prueba de 100 a 10 cuentas y de 30 a 365 días de reporte). Los scripts están en `rest_suscripcion/anexos/suscripcion_01_plan_prueba*.sql` y tienen reversión probada. **Vía A:** aplíquelos usted con `C:\xampp\mysql\bin\mysql.exe -u root sist_criteriokelly < rest_suscripcion\anexos\suscripcion_01_plan_prueba.sql`. **Vía B:** los aplica el agente. En ambas vías el agente ejecutará después la verificación, la segunda aplicación (sin efecto), la reversión y la reaplicación para probar A-01. No se tocará MySQL de ninguna otra forma. Para continuar responda exactamente: **CONFIRMO ESQUEMA HU-004** e indique la vía (A o B).»

**Qué prohíbe T-06/T-07:** aplicar el esquema, revertirlo o ejecutar el ciclo sin la frase exacta; ejecutar cualquier script contra otra base; usar `ck_aplicacion` para el ALTER.

**`RI-A5 · Reconstrucción de ayudantes y baterías (T-02).** Referencia: HLT-12 v2 H8 AC-T-33 (funciones y tabla de casos), HLT-14 (caso de cédula repetida) y HLT-05 v2 H7.2 (P-10…P-16); **manda el código actual**.
- `lib/comun.sh`: variables `URL`, `US`, `SU`, `MYSQL` (`/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly`); `pet <token|-> <MÉTODO> <url> [cuerpo]` (curl con `Origin: http://localhost:8100` y `X-Requested-With: CriterioKelly`; imprime `<código> <cuerpo>`); `sesion <usuario> <clave>` (login por `autenticacion/autenticar`); `chk <caso> <regex> <valor>` (imprime `OK`/`FALLO` y cuenta); `exigir_entorno_base` (200 de los dos servicios y `SELECT 1`; si no, `exit 2`); `esperar_ventana <segundos>` y `limpiar_contadores` (borra solo `sgen_intentoacceso` de 127.0.0.1/::1 y `sgen_limitepeticion`) para respetar los límites: público 60 por minuto y por IP (`index.php`), login 5 fallos por usuario y 20 por IP en 900 s (`LimitadorPeticiones.php`), 60 s entre códigos (`VerificacionMdl.php:13`) y 2 s mínimos del registro (`BaseCtrl.php:11` de `rest_usuario`).
- `lib/hu003_comun.sh`: las funciones de la tabla de HLT-12 v2 (`registrar`, `activar`, `reenviar`, `conteos`, `norm`, `sin_variables`, `usr_de`, `mail_de`, `tel_de`, `liberar_ip`) **adaptadas** a que, en modo local, los correos se guardan como archivos `rest_usuario/logs/correos/correo-*.txt` (con líneas `To:` y `Asunto:`) y los omitidos como `registro-omitido-*.txt` (comprobar con `ls rest_usuario/logs/correos` y `rest_usuario/correo/README.md`): `codigo_de`, `correos_nuevos`, `archivos_nuevos` y `omitidos_nuevos` leen esos archivos más nuevos que una marca `MARCA=$(mktemp)`; no existe variable `LOG_CORREOS`.
- `lib/limpiar_datos_prueba.sh [patrón]` (patrón por defecto `^ck_prueba_`): borra, por usuario, en este orden `spsu_pagos`, `spsu_historialsuscri`, `spsu_suscripcion`, `sgen_auditoria`, `sgen_verificacion`, `sgen_recuperacion`, `sgen_rolusuario`, `sgen_sesion`, `sgen_usuario` y `sgen_persona`; imprime el número de usuarios restantes.
- `hu003_flujos_cuenta.sh`: casos `G2-registro`…`G2-conteos-final`, `G1-preparar`…`G1-auditoria-conteos`, `G2-esperar` (61 s), `G2-reenvio`…`G2-reenvio-activa`, `G3-repetido`, `G4-usuario`, `G4-telefono`, **`G4-cedula`** (cédula repetida) y `G5-pl-*`/`G5-li` con exactamente las acciones, expectativas `chk` y registros `NORM` de la tabla de HLT-12 v2, salvo: `MENSAJE_409="${MENSAJE_409:-El nombre de usuario, el teléfono o la cédula ya están registrados}"` (texto actual, `PersonaCtrl.php:139`) y usuarios `ck_prueba_hu3_*`. Salida `OK`/`FALLO`/`NORM|caso|valor` y `RESUMEN OK=n FALLO=n`; `exit 1` si hay `FALLO` y `exit 2` si el entorno es inválido.
- `hlt05v2_bateria.sh`: las pruebas P-10…P-16 de HLT-05 v2 H7.2 con usuarios `ck_prueba_hlt05_s1..s3` activados por `UPDATE sgen_usuario SET usu_situacion='A'` acotado a ese prefijo, mismas expectativas (200/409/403/400/401, 5 simultáneas = un 200 y cuatro 409, `crearConPago` 200 y 409 con `pag_monto` 1.25) y registros `NORM`.
- Reglas: solo se tocan filas de usuarios `ck_prueba_*` y contadores transitorios; sin `exit 0` ante un `FALLO`; sin tocar MySQL/Apache; las salidas `.txt` van en `HLT-15/linea_base/`.

---

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜` pendiente · `✅` verificado con evidencia real · `❌` fallido · `➖` no aplica (justificado). Se aplican RS-1…RS-9. Ficha por tarea (plantilla; el agente la copia por tarea):

```
T-0N — <nombre>
  Estado: PENDIENTE | EN_CURSO | HECHA | BLOQUEADA | OMITIDA
  Checks de verificación:
    [⬜] C1. Cambios aplicados solo en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación de H7 — evidencia: <comando y salida literal>
    [⬜] C3. Respeta H8 (sin tocar MySQL/Apache, sin git de escritura, prefijo ck_prueba_hu4_)
    [⬜] C4. `bash -n` sobre cada .sh tocado y salida de `mysql` con código 0 en los .sql (➖ en T-01, T-02, T-06, T-08, T-09)
    [⬜] C5. Prueba/verificación específica (suma A-02, verificar.sql, ciclo de reversión) (➖ donde no aplique)
    [⬜] C6. Sin efectos fuera de alcance (git status --short solo muestra lo declarado)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

Tablero global (RS-9: debe coincidir con las fichas):

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-02b | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

---

## H10 · Diseño del reporte de ejecución

Estructura fija (el **coordinador** guarda el `.md`; el agente entrega el contenido y los `.txt`):

```
REPORTE DE EJECUCIÓN — HLT-15 Esquema de datos y plan de prueba de 24 horas
  1. Resumen ejecutivo
  2. Estado global (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas (copia del tablero H9)
  4. Cobertura vs. HLT (A-01…A-04, RN-01…RN-13 → resultado; ¿100 %?)
  5. Cambios realizados (archivos ruta:línea, tipo)
  6. Verificaciones ejecutadas (comando → salida real; vía A o B; sumas antes/después)
  7. Desviaciones y decisiones (incluida la respuesta a PU-1 y PU-2)
  8. Pendientes / bloqueos
  9. Próximos pasos (HLT-16-v4)
```

Reglas RR-1…RR-5 del contrato. `COMPLETADO` solo con todas las tareas `HECHA`.

---

## H11 · Convenciones de desarrollo y arquitectura de código limpio

- Archivos SQL en `anexos/`, en minúsculas con prefijo del servicio y número: `suscripcion_01_plan_prueba.sql`, `…_reversion.sql`, `…_verificar.sql` (como `seguridad_01_sesion.sql` en `rest_usuario/anexos/`).
- Nombres de objetos nuevos: columnas con prefijo de tabla (`pla_`, `sus_`) en camelCase como las vecinas (`pla_horasDuracion`, `sus_fechaHoraFin`); índice `<tabla>_<campo>_idx`.
- Comentarios y mensajes en español; cabecera con propósito, fecha y modo de uso.
- Scripts `.sh`: `#!/usr/bin/env bash`, `set -u`, funciones cortas con nombre en español, sin credenciales (MySQL local con `root` sin clave, como el resto del proyecto).
- Commits: mensajes en español; los hace el usuario.
