# HLT-13 — Eliminación del código de correo innecesario (HU-003 rev. 2, criterio F)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-11 |
| Historia | `docs/Historia_usuario/HU-003-microservicio-correo.md`, sección F y decisiones DC-07, DC-08, DC-09 |
| Cubre | Criterio **F** (F-01…F-05) |
| **Depende de** | `docs/Planificacion/HLT-12-2026-11-11-modulo-correo.md` (HLT-12) **COMPLETADO**: la HU exige commits de eliminación separados de los movimientos de archivos, y F-03 repite las comprobaciones B, C y E sobre la estructura nueva `correo/` |
| Proyectos y git | `rest_usuario` (git), `rest_criteriokelly` (git), raíz del workspace (sin git: `.claude/agents/`, `docs/`). `criterioKellyApp`, `rest_suscripcion` y `rest_divisas` solo se inspeccionan |
| Entorno verificado al planificar | PHP 8.2.35; MariaDB 10.4.32 (`C:\xampp\mysql\bin\mysql.exe`); Apache y MySQL **detenidos** al planificar (`curl` → `000`; `mysql` → error 10061), por lo que **la columna `usu_codiorecupe` y su contenido no pudieron consultarse en la base viva**: T-03 y T-07 lo verifican antes de borrar nada |
| Decisión pendiente del usuario | **DC-08 (RD-6)**: eliminar la columna `sgen_usuario.usu_codiorecupe`. Está planificada completa, con la **tarea puerta T-06 en estado `BLOQUEADA`** hasta que el usuario confirme por escrito. El resto del HLT se ejecuta sin ella |

---

## H1 · Propósito

**Requerimiento literal (HU-003 rev. 2, criterio F):** «En cualquier proyecto del workspace, todo código, configuración, documentación o dato creado para el correo que ya no se use **se elimina**, siempre que su eliminación no cambie la funcionalidad, la lógica ni la seguridad actuales. Lo que no cumpla esa condición se conserva y se justifica.»

**Propósito.** Retirar los restos del flujo antiguo de recuperación por código (documentación de `generarCodigo`/`obtenerCodigo` y la columna `usu_codiorecupe`) para que el desarrollador que mantiene el sistema no encuentre rastros de funciones que ya no existen, sin tocar el comportamiento, los endpoints, los tiempos ni la seguridad.

**Resultado esperado (observable).**
1. `rest_usuario/rutas.txt` y `rest_criteriokelly/rutas.txt` ya no mencionan `generarCodigo` ni `obtenerCodigo` (`grep` = 0) y no pierden nada más.
2. **Solo si el usuario confirma DC-08:** la columna `sgen_usuario.usu_codiorecupe` no existe en `sist_criteriokelly` local; existe un respaldo de sus valores en archivo, un script idempotente que la elimina (`seguridad_04_eliminar_codiorecupe.sql`) y un script de reversión probado con los datos reales.
3. Lo marcado «Conservar» (F-3, F-4 por DC-09, `AlertasSeguridad`, el aviso `registro-omitido` de local, los modos `log` y `smtp`) sigue exactamente como estaba, con su justificación escrita.
4. Las comprobaciones B, C y E de HLT-12 dan el mismo resultado que justo antes de eliminar.
5. Cada eliminación tiene su `grep` previo guardado en `docs/Planificacion/evidencias/correo-B/` y su commit propio.

**Fuera de alcance.**
- Reescribir o borrar `rutas.txt` completo (DC-07): solo las entradas de los dos endpoints.
- Editar los volcados `sist_generico.sql`, `sist_genericoDatos.sql` y sus copias de `criterioKellyApp/src/assets/anexos/` (decisión D-B05).
- Eliminar el modo `mail` (DC-09: se conserva hasta HLT-11) o las validaciones de claves de correo de `Configuracion.php` (F-3).
- Aplicar el `DROP COLUMN` en cualquier base de producción: lo hace el usuario con el procedimiento documentado, cuando haya hosting (DH-10/DH-11 de HU-001 siguen pendientes).
- **F-5** (restos de pruebas fuera del workspace: `C:\xampp\mailpit\descarga\` y `C:\xampp\mailtodisk\support\gen_py\`, verificados como existentes el 2026-11-11): **nota para el usuario**; ningún agente los borra.
- Documentos históricos (`docs/Planificacion/HLT-0*`, `PLAN-MAESTRO-HU-001*.md`, `docs/Planificacion/evidencias/HLT-0*`) que nombran los endpoints o la columna como hechos del pasado.

**Feature(s) afectada(s).** `rest_usuario` → `rutas.txt`, `anexos/` (scripts nuevos), `README.md`; `rest_criteriokelly` → `rutas.txt`; base `sist_criteriokelly` → tabla `sgen_usuario`; `.claude/agents/desarrollador-php.md`.

---

## H2 · Reglas de negocio

Reglas existentes que la eliminación **no puede romper** y reglas propias del criterio F.

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Nada se elimina sin demostrar que no se usa (F-02) | Para cada elemento existe en `evidencias/correo-B/inventario_F02.txt` la salida del `grep -rnI` en los 5 proyectos (`--exclude-dir=vendor --exclude-dir=node_modules`) y todas sus coincidencias están en la lista de referencias esperadas de H3; una coincidencia fuera de la lista detiene la eliminación de ese elemento | F-02 |
| RN-02 | Los endpoints `generarCodigo` y `obtenerCodigo` siguen inexistentes | Con token: `404 {"error":"Recurso no encontrado"}`; sin token: `401` (igual que HLT-06 P-14, `hlt06_bateria.sh:134-137`); antes y después de eliminar su documentación | HLT-06 · F-03 |
| RN-03 | F-1 elimina solo esas entradas | `git diff --numstat rutas.txt` = `0	32` en cada archivo (líneas 12-13 y 48-77 del estado verificado) y `diff <(git show HEAD:rutas.txt \| sed '12,13d;48,77d') rutas.txt` vacío | F-1 · DC-07 |
| RN-04 | El `DROP COLUMN` solo tras confirmación escrita | Existe `correo-B/confirmacion-DC-08.txt` con la respuesta literal del usuario antes de cualquier `ALTER`; T-06 es `HECHA` antes de que T-07…T-14 salgan de `PENDIENTE` | DC-08 · RD-6 |
| RN-05 | Respaldo previo verificado | `wc -l` del archivo de respaldo = `SELECT COUNT(*) FROM sgen_usuario`; también se guardan `SHOW CREATE TABLE` y el `md5` de las tuplas `(usu_idUsuario, usu_codiorecupe)` | F-04 |
| RN-06 | El script de eliminación es idempotente | Dos ejecuciones seguidas terminan con código 0 y sin error; la segunda informa que la columna ya no existe | F-04 |
| RN-07 | La eliminación es reversible con los datos reales | Tras reversión + restauración, `SHOW CREATE TABLE sgen_usuario` y el `md5` de las tuplas son idénticos a los capturados antes | F-04 |
| RN-08 | Ningún código usa la columna | `grep -rnI "codiorecupe"` en `*.php`, `*.ts`, `*.html`, `*.js`, `*.sh` = 0; todos los `INSERT INTO sgen_usuario` de código nombran sus columnas (`PersonaMdl.php:93`, `UsuarioMdl.php:37`, `hlt06v2_bateria.sh:173`); no hay `SELECT *` sobre `sgen_usuario`; sin rutinas, vistas ni disparadores que la nombren | F-2 |
| RN-09 | Lo marcado «Conservar» no se toca | Los 5 elementos de H5/D-B08 siguen con el mismo contenido (hashes de `Configuracion.php`, líneas de `EnviadorCorreo.php`, `AlertasSeguridad.php`, `PersonaCtrl.php`) | F-05 |
| RN-10 | Un commit por eliminación | `git log` muestra un commit para `rest_usuario/rutas.txt`, uno para `rest_criteriokelly/rutas.txt`, uno para los scripts SQL y uno para la documentación, ninguno mezclado con movimientos de archivos | F-01 |
| RN-11 | Nada cambia en funcionalidad, tiempos, límites ni seguridad | Conjuntos `(caso, estado)` de `hlt06_bateria.sh`, `hlt06v2_bateria.sh`, `hlt03_matriz.sh` y `flujo_correo.sh` iguales a los de la línea base; plantillas byte a byte; `curl` C-01 con los mismos códigos; P-02 y P-23 en rango | F-03 |
| RN-12 | Sin servicios, endpoints, secretos, tablas ni dependencias nuevas | El respaldo es un **archivo**, no una tabla (C-06); `composer.*`, `index.php`, `rutas/` sin diff; `md5sum .env` igual | C-06 |
| RN-13 | Los volcados y las copias de la app no se editan | `git diff --quiet` en `rest_usuario/anexos/sist_generico*.sql` y en `criterioKellyApp/src/assets/anexos/` | D-B05 |
| RN-14 | Solo base local | Ningún comando se ejecuta contra otra base que `sist_criteriokelly` local y la temporal `ck_prueba_instalacion` (esta se elimina al terminar) | RD-6 · producción pendiente |

---

## H3 · Flujo principal de ejecución

Este HLT no cambia ningún flujo HTTP; el flujo es el del propio trabajo.

```
[HLT-12 COMPLETADO] → T-01 precondiciones → T-02 línea base B
   → T-03 inventario F-02 (grep en 5 proyectos + base viva)
        ├─ coincidencia no esperada → el elemento NO se elimina; hallazgo en el reporte
        └─ todo esperado ↓
   F-1 ── T-04 rutas.txt (rest_usuario) ─ commit ── T-05 rutas.txt (rest_criteriokelly) ─ commit
   F-2 ── T-06 PUERTA (BLOQUEADA hasta confirmación escrita)
            ├─ "CONFIRMO DC-08" → T-07 respaldo → T-08 scripts → T-09 prueba en base temporal
            │       → T-10 eliminar (1ª y 2ª vez) → T-11 reversión + restauración con datos reales
            │       → T-12 eliminar definitivo + commit scripts → T-13 README + commit → T-14 agente
            └─ "NO ELIMINAR LA COLUMNA" → T-07…T-14 OMITIDA (motivo registrado); estado global PARCIAL
   F-05 ─ T-15 conservación (F-3, F-4, AlertasSeguridad, registro-omitido, modos)
   F-03 ─ T-16 repetir B, C, E contra T-02
   F-01/F-02 ─ T-17 auditoría final de commits e inventario
```

**Referencias esperadas por elemento (las que T-03 debe encontrar; verificadas el 2026-11-11 con `grep -rnI … --exclude-dir=vendor --exclude-dir=node_modules`).**

| Elemento | Referencias de **definición o documentación** (se tratan) | Referencias de **prueba o historial** (se conservan) |
|----------|-----------------------------------------------------------|------------------------------------------------------|
| F-1 `generarCodigo`/`obtenerCodigo` | `rest_usuario/rutas.txt:12,13,48,63` y `rest_criteriokelly/rutas.txt:12,13,48,63` (8 líneas). **Corrección de la HU:** el bloque ocupa 48-77 (no 48-74) | `docs/Planificacion/evidencias/hlt06_bateria.sh:134-137` (comprueba el 404), `regresion_endpoints.sh:59-60` (R-12/R-13, cuerpos de prueba), reportes e historiales en `docs/` |
| F-2 `usu_codiorecupe` | `rest_usuario/anexos/sist_generico.sql:82`, `rest_usuario/anexos/sist_genericoDatos.sql:48`, `criterioKellyApp/src/assets/anexos/Generico.sql:82`, `…/GenericoDatos.sql:48` (4 volcados, **no se editan**), `.claude/agents/desarrollador-php.md:61` (ejemplo de columna sensible: se actualiza en T-14) | `docs/Historia_usuario/HU-001*.md:158`, `docs/Planificacion/PLAN-MAESTRO-HU-001.md:179`, `HLT-03`, `HLT-06*`, `evidencias/HLT-06/REPORTE.md:120` |
| Código PHP/TS/SQL ejecutable | **Ninguna** (RN-08) | — |

---

## H4 · Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN | Tareas | Prueba / verificación |
|--------------------|--------|-----------------------|
| F-01 commits dedicados / RN-10 | T-04, T-05, T-12, T-13, T-17 | `git log` (AC-T-17) |
| F-02 `grep` previo / RN-01, RN-08 | T-03, T-17 | AC-T-03 |
| F-03 repetir B, C, E / RN-02, RN-11 | T-02, T-16 | AC-T-16 |
| F-04 respaldo, idempotencia, reversión / RN-05, RN-06, RN-07 | T-07, T-08, T-09, T-10, T-11, T-12, T-13 | AC-T-07…AC-T-13 |
| F-05 conservar / RN-09 | T-15 | AC-T-15 |
| F-1 (RN-03) | T-04, T-05 | AC-T-04, AC-T-05 |
| F-2 (RN-04, RN-13, RN-14) | T-06…T-14 | AC-T-06…AC-T-14 |
| F-3, F-4 (conservar) | T-15 | AC-T-15 |
| F-5 (nota) | T-15, H10 | AC-T-15 (existencia, solo lectura) |
| RN-12 | T-16, T-17 | AC-T-17 |

### Checklist de calidad

- [x] Las 11 secciones completas; sin marcadores pendientes.
- [x] Cada RN mapea a ≥1 tarea (100 %).
- [x] Cada tarea tiene criterio de aceptación (H7.2) y ficha (H9).
- [x] Referencias `ruta:línea` leídas contra el repositorio el 2026-11-11.
- [x] La única decisión irreversible (DC-08) está detrás de una puerta (T-06) y no bloquea el resto.

### Discrepancias HU ↔ código real (registradas)

| # | HU dice | Código real | Impacto | Recomendación adoptada |
|---|---------|-------------|---------|------------------------|
| X-1 | F-1: `rutas.txt:48-74` | El bloque de los dos endpoints ocupa **48-77** (`generarCodigo` 48-61, blanco 62, `obtenerCodigo` 63-76, blanco 77; la línea 78 es `PUT:`). Idéntico en `rest_criteriokelly/rutas.txt` | Borrar 48-74 dejaría un fragmento de la respuesta de `obtenerCodigo` | Borrar 12-13 y 48-77, con guardas de contenido antes de borrar (AC-T-04) |
| X-2 | F-2: «respaldo de la tabla» | Una tabla de respaldo sería una **tabla nueva**, prohibida por C-06 | Contradicción interna de la HU | Respaldo **en archivo** con los valores y la estructura (D-B04) |
| X-3 | F-2 nombra solo `sist_generico.sql` | También `sist_genericoDatos.sql:48` lista la columna en su `INSERT`, y ambos tienen copia en `criterioKellyApp/src/assets/anexos/` (`Generico.sql:82`, `GenericoDatos.sql:48`, idénticas byte a byte); además `.claude/agents/desarrollador-php.md:61` | Editar `sist_generico.sql` rompería la carga de `sist_genericoDatos.sql` y desincronizaría las copias | No editar los volcados (D-B05); el orden de instalación los deja consistentes; se actualiza solo el agente (T-14) |
| X-4 | F-3: la copia de `Configuracion.php` es idéntica en los backends | `rest_divisas/configuracion/Configuracion.php` **difiere** en `:263-264` (acepta solo `smtp` y `log`, no `mail`) y usa LF; los otros tres tienen el mismo sha256 | La justificación de conservar F-3 («copia idéntica») es exacta para 3 de 4 backends; en `rest_divisas` la comprobación es código inactivo (no valida claves de correo) | F-3 se conserva igual (no se toca ninguna copia) y la nota va al README del módulo; se informa al usuario |
| X-5 | Entorno | MySQL no estaba en ejecución al planificar | No se pudo leer el contenido de la columna | T-03 y T-07 lo leen antes de decidir |
| X-6 | DC-08 / F-04 | Los scripts existentes de `anexos/` se aplican «como root, idempotentes» (`seguridad_03_verificacion.sql:1-2`); el usuario descartó copiar `seguridad_03` a la app (`README.md:234`) | Define el patrón del script nuevo y de **no** copiarlo a `criterioKellyApp/src/assets/anexos/` | `seguridad_04` sigue ese patrón y no se copia a la app |

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-B01 | `rutas.txt` (DC-07) | Borrar/rehacer el archivo · borrar solo las entradas | **Solo las entradas** de `generarCodigo` y `obtenerCodigo` (líneas 12-13 y 48-77) | DC-07; el resto del archivo, desactualizado, queda fuera | No (git) |
| D-B02 | Columna `usu_codiorecupe` (DC-08) | Conservar · eliminar | **Eliminar, detrás de la puerta T-06 (RD-6)** | Es cambio de esquema; ningún código la usa (RN-08); recomendación de la HU | **Sí**: por eso respaldo, reversión probada y confirmación escrita |
| D-B03 | Qué hace T-06 si el usuario responde que no | Seguir igual · omitir F-2 | **T-07…T-14 pasan a `OMITIDA`** con el motivo (RS-5) y el estado global es `PARCIAL` | F-1, F-05 y F-03 no dependen de la columna | No |
| D-B04 | Dónde se guarda el respaldo | Tabla `sgen_usuario_respaldo` · archivo | **Archivo** `rest_usuario/logs/respaldos/usu_codiorecupe-AAAAMMDD-HHMMSS.sql` (sentencias `UPDATE` por usuario) + `sgen_usuario-estructura-AAAAMMDD-HHMMSS.txt` (`SHOW CREATE TABLE`) | C-06 prohíbe tablas nuevas; `logs/*` está en `.gitignore:3` y la lista blanca de `.htaccess` impide servirlo; no contiene `usu_clave` | No |
| D-B05 | Volcados `sist_generico.sql` / `sist_genericoDatos.sql` y copias de la app | Editarlos · no editarlos | **No editarlos**; orden de instalación: `sist_generico.sql` → `sist_genericoDatos.sql` → `seguridad_01…03` → `seguridad_04` | `desarrollador-php.md` («Estándares de código»: cambios de esquema como script en `anexos/` «sin modificar los volcados existentes, e indicando el orden de aplicación»); X-3 | No |
| D-B06 | Ubicación del script de reversión | `anexos/` junto a los demás · `anexos/reversion/` | **`anexos/reversion/seguridad_04_revertir_codiorecupe.sql`** | Evita que una instalación nueva lo aplique por error junto a `seguridad_0*` | No |
| D-B07 | Nombre de la base en los scripts | Fija `sist_criteriokelly` · `COALESCE(DATABASE(), 'sist_criteriokelly')` | **`COALESCE(DATABASE(), 'sist_criteriokelly')`** | Funciona con y sin base seleccionada (nunca «no hace nada» en silencio) y permite probarlos en una base temporal | No |
| D-B08 | Elementos que se conservan (F-05) | — | **F-3** (validaciones de claves de correo de `Configuracion.php`, copia compartida); **F-4** (modo `mail`, DC-09); `AlertasSeguridad.php`; el aviso `registro-omitido` de local (`PersonaCtrl.php:167-176`); los modos `log` y `smtp` | HU, sección F («Conservar») y DC-09 | — |
| D-B09 | Referencias de prueba a los endpoints eliminados | Borrarlas · conservarlas | **Conservarlas** (`hlt06_bateria.sh:134-137`, `regresion_endpoints.sh:59-60`) | Son las pruebas de que responden 404/401 (RN-02) | No |
| D-B10 | Documentos históricos | Editarlos · no editarlos | **No editarlos** (HLT-03, HLT-06, PLAN-MAESTRO, reportes) | Describen el pasado; reescribirlos falsearía el historial | No |
| D-B11 | Prueba de los scripts | Directamente en la base viva · primero en base temporal | **Primero en `ck_prueba_instalacion`** (instalación nueva con los volcados), que se elimina al terminar; luego en la base viva | Reduce el riesgo de un `DROP COLUMN` mal escrito | No |
| D-B12 | Línea base de F-03 | Reusar la evidencia de HLT-12 · repetirla | **Repetirla (T-02)** | El estado puede haber cambiado desde HLT-12; la comparación debe ser contra el estado inmediatamente anterior | No |
| D-B13 | Copias de la app | Copiar `seguridad_04` a `criterioKellyApp/src/assets/anexos/` · no copiar | **No copiar** | Precedente `rest_usuario/README.md:234` (el usuario descartó copiar `seguridad_03`); este HLT no toca la app | No |
| D-B14 | Commits | Uno global · uno por eliminación | **Uno por eliminación** (H7.3); locales, nunca `push`; autorización del usuario recogida en T-01 (RI-11) | F-01 | No |

---

## H6 · Revisión del requerimiento por parte de un senior

### Checklist (ronda 2)

| # | Ítem | Veredicto | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 reproduce el criterio F y lo acota a lo verificable |
| 2 | Reglas de negocio | ✅ | RN-01…RN-14 booleanas; RN-04 y RN-14 separan el riesgo irreversible |
| 3 | Impacto | ✅ | Se hallaron referencias ocultas que la HU no listaba: `sist_genericoDatos.sql:48`, dos copias en `criterioKellyApp/src/assets/anexos/`, `desarrollador-php.md:61`, y los `INSERT`/`JOIN` sobre `sgen_usuario` de `PersonaMdl.php:93`, `UsuarioMdl.php:37`, `ValidadorSesion.php:23` (`rest_criteriokelly` y `rest_suscripcion`) que no usan la columna |
| 4 | Consistencia arquitectónica | ✅ | Script en `anexos/`, idempotente y compatible con MariaDB 10.4 y MySQL 8 como los existentes |
| 5 | Riesgos | ✅ | Tabla siguiente |
| 6 | Simplicidad | ✅ | Sin tablas, sin código nuevo, sin editar volcados |
| 7 | Seguridad | ✅ | El respaldo no contiene hashes de clave; vive en `logs/` (no versionado, no servido); lista blanca verificada con `curl` |
| 8 | Cobertura | ✅ | 100 % |
| 9 | Determinismo | ✅ | La puerta T-06 fija la pregunta exacta y qué ocurre con cada respuesta |
| 10 | Ejecutabilidad | ✅ | Cada tarea con comandos de aceptación en H7.2 |

### Hallazgos adversariales (ronda 1) y resolución

| # | Hallazgo | Severidad | Resolución incorporada |
|---|----------|-----------|------------------------|
| H-1 | **DROP COLUMN irreversible**: un `ALTER … DROP COLUMN` mal aplicado destruye datos | Alta | Puerta T-06; respaldo de valores y estructura (T-07); reversión probada **con los datos reales** y verificada por `md5` y `SHOW CREATE TABLE` (T-11); prueba previa en instalación temporal (T-09); solo base local (RN-14) |
| H-2 | **Eliminar algo con referencias ocultas**: la HU solo nombraba `sist_generico.sql`; `sist_genericoDatos.sql` y las copias de la app lo mencionan y un `INSERT` posicional se rompería | Alta | Inventario ampliado (H3); RN-08; D-B05 (volcados intactos y orden de instalación probado en T-09); verificación de que todo `INSERT` de código nombra columnas |
| H-3 | El respaldo «de la tabla» crea una tabla nueva (C-06) | Alta | D-B04: respaldo en archivo |
| H-4 | **Borrar 48-74 de `rutas.txt` deja un resto del JSON de `obtenerCodigo`** | Media | X-1: 12-13 y 48-77, con guardas de contenido línea a línea antes de borrar y validación de que el JSON del encabezado sigue siendo válido |
| H-5 | El script «idempotente» con `DATABASE()` sin base seleccionada diría «ya no existe» sin haber hecho nada | Media | D-B07: `COALESCE(DATABASE(), 'sist_criteriokelly')` y esquema explícito en `ALTER` e `information_schema` |
| H-6 | La puerta bloquea todo el HLT | Media | El único camino bloqueado es T-07…T-14; T-04, T-05, T-15, T-16 y T-17 no dependen de ella (T-16 acepta dependencias `OMITIDA`) |
| H-7 | El respaldo puede contener códigos de recuperación antiguos en claro | Media | Vive en `logs/respaldos/` (ignorado por git y no servido por web, `curl` 404 comprobado en T-07); la evidencia registra solo conteos, nunca valores |
| H-8 | Una batería corriendo durante el `ALTER` bloquea la tabla o produce fallos | Media | T-10…T-12 no se solapan con baterías; T-16 se ejecuta después |
| H-9 | El script de reversión aplicado a una instalación nueva | Media | D-B06: carpeta `anexos/reversion/` |
| H-10 | Los scripts de evidencia que mencionan `generarCodigo` parecerían «referencias vivas» | Baja | D-B09: son pruebas de 404 y se conservan |
| H-11 | Reaplicar el procedimiento en producción por error desde la sesión | Alta | RN-14 y H1 (fuera de alcance): solo el usuario, con el procedimiento del README (T-13) |
| H-12 | Perder el historial por borrar el archivo | Baja | No se borra ningún archivo; solo líneas de `rutas.txt` (git conserva el historial) |
| H-13 | El respaldo podría quedar incompleto si hay usuarios nuevos durante la prueba | Baja | T-07 compara `wc -l` con `COUNT(*)` en el mismo instante; T-11 compara `md5` de tuplas antes/después con los servicios sin tráfico de pruebas |
| H-14 | Documentación que siga recomendando la columna | Baja | T-14 retira la columna del ejemplo de `desarrollador-php.md:61` |

### Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-01 | Pérdida de datos por `DROP COLUMN` | **Alta** | H-1 |
| R-02 | Referencia oculta que rompe un flujo | **Alta** | H-2; T-16 repite todo |
| R-03 | Aplicación accidental en producción | **Alta** | H-11 |
| R-04 | Resto de JSON inválido en `rutas.txt` | Media | H-4 |
| R-05 | Respaldo con datos sensibles | Media | H-7 |
| R-06 | Duración de las baterías de T-16 | Baja | Segundo plano, 10 min por script |

### Veredicto

**APROBADO.** Ronda 1: `APROBADO CON CAMBIOS` por H-1, H-2, H-3, H-11 (severidad Alta) y los demás hallazgos; todos incorporados (puerta T-06, T-07, T-09, T-11, D-B04…D-B07, RN-04, RN-07, RN-08, RN-14). Ronda 2: sin cambios pendientes. El único elemento irreversible está aislado detrás de una confirmación escrita del usuario, con respaldo y reversión demostrados, y el resto del HLT es ejecutable por sí solo.

---

## H7 · Plan de tareas

Evidencias en `docs/Planificacion/evidencias/correo-B/` (la crea T-01). `M="/c/xampp/mysql/bin/mysql.exe -u root"`; `MS="$M sist_criteriokelly -N -B"`. Comandos desde `C:\xampp\htdocs\criterio_kelly` en Git Bash. `B=docs/Planificacion/evidencias/correo-B`, `A=docs/Planificacion/evidencias/correo-A`.

### H7.1 Tabla de tareas

| ID | Agente | Tarea | Archivos | Depende de | Criterio de aceptación (comando en H7.2) | Cubre |
|----|--------|-------|----------|------------|------------------------------------------|-------|
| T-01 | desarrollador-php | Verificar precondiciones (HLT-12 completado, servicios arriba, repos limpios) y crear la carpeta de evidencias | `docs/Planificacion/evidencias/correo-B/` (nueva) | — | AC-T-01 | F-01, RN-14 |
| T-02 | desarrollador-php | Capturar la línea base B (plantillas, curl C-01, baterías, flujo) con los scripts de HLT-12 | `…/correo-B/linea_base/` | T-01 | AC-T-02 | F-03, RN-11 |
| T-03 | desarrollador-php | Repetir y guardar el inventario `grep` de F-02 en los 5 proyectos y en la base viva | `…/correo-B/inventario_F02.txt` | T-01 | AC-T-03 | F-02, RN-01, RN-08 |
| T-04 | desarrollador-php | Eliminar de `rest_usuario/rutas.txt` las entradas `generarCodigo` y `obtenerCodigo` y commit | `rest_usuario/rutas.txt:12-13,48-77` | T-03 | AC-T-04 | F-1, F-01, RN-03 |
| T-05 | desarrollador-php | Eliminar de `rest_criteriokelly/rutas.txt` las mismas entradas y commit | `rest_criteriokelly/rutas.txt:12-13,48-77` | T-03 | AC-T-05 | F-1, F-01, RN-03 |
| T-06 | desarrollador-php | **PUERTA DC-08:** pedir al usuario la confirmación escrita para eliminar `usu_codiorecupe` y registrar su respuesta literal | `…/correo-B/confirmacion-DC-08.txt` (nuevo) | T-03 | AC-T-06 | F-2, RN-04 |
| T-07 | desarrollador-php | Respaldar los valores y la estructura de `usu_codiorecupe` y capturar su definición | `rest_usuario/logs/respaldos/` (nueva, ignorada), `…/correo-B/linea_base/columna_definicion.txt` | T-03, T-06 | AC-T-07 | F-04, RN-05 |
| T-08 | desarrollador-php | Crear los scripts de eliminación idempotente y de reversión | `rest_usuario/anexos/seguridad_04_eliminar_codiorecupe.sql` (nuevo), `rest_usuario/anexos/reversion/seguridad_04_revertir_codiorecupe.sql` (nuevo) | T-07 | AC-T-08 | F-2, F-04, RN-06 |
| T-09 | desarrollador-php | Probar los scripts en una instalación nueva temporal (`ck_prueba_instalacion`), incluidos orden de volcados e idempotencia, y eliminar la base temporal | `rest_usuario/anexos/*.sql` (solo lectura), base temporal | T-08 | AC-T-09 | F-04, RN-06, RN-13, D-B11 |
| T-10 | desarrollador-php | Ejecutar la eliminación en `sist_criteriokelly` local dos veces | base `sist_criteriokelly` | T-09 | AC-T-10 | F-2, RN-06 |
| T-11 | desarrollador-php | Probar la reversión con los datos reales: revertir, restaurar el respaldo y comparar estructura y valores | base `sist_criteriokelly` | T-10 | AC-T-11 | F-04, RN-07 |
| T-12 | desarrollador-php | Eliminar la columna de forma definitiva y hacer el commit de los scripts | base `sist_criteriokelly`; `rest_usuario/anexos/seguridad_04_*.sql`, `anexos/reversion/*.sql` | T-11 | AC-T-12 | F-2, F-01, RN-10 |
| T-13 | desarrollador-php | Documentar en `rest_usuario/README.md` el orden de aplicación, el respaldo y la reversión, y commit | `rest_usuario/README.md` (sección «Instalación», lista de scripts `:53-59`, y sección nueva) | T-12 | AC-T-13 | F-04, F-01 |
| T-14 | desarrollador-php | Retirar `usu_codiorecupe` del ejemplo de columnas sensibles | `.claude/agents/desarrollador-php.md:61` | T-12 | AC-T-14 | F-2 |
| T-15 | desarrollador-php | Verificar y justificar lo que se conserva (F-3, F-4, `AlertasSeguridad`, `registro-omitido`, modos `log` y `smtp`) y comprobar la existencia de lo de F-5 | solo lectura | T-03 | AC-T-15 | F-05, RN-09 |
| T-16 | desarrollador-php | Repetir las comprobaciones B, C y E y compararlas con la línea base | `…/correo-B/despues/` | T-02, T-04, T-05, T-12, T-13, T-14, T-15 (las de F-2 pueden estar `OMITIDA`) | AC-T-16 | F-03, RN-02, RN-11 |
| T-17 | desarrollador-php | Auditar commits e inventario final | solo lectura | T-16 | AC-T-17 | F-01, F-02, RN-10, RN-12, RN-13 |

**Resumen:** 17 tareas, todas `desarrollador-php` (ninguna toca `criterioKellyApp/`). Camino crítico: T-01 → T-03 → T-06 (puerta) → T-07 → T-08 → T-09 → T-10 → T-11 → T-12 → T-13 → T-16 → T-17. Independientes de la puerta: T-04, T-05, T-15. Paralelizables (RS-3): T-04 con T-05; T-13 con T-14; T-02 con T-03.

### H7.2 Comandos de aceptación

**AC-T-01**
```bash
test -d rest_usuario/correo && ls rest_usuario/correo | wc -l                      # 5 archivos (HLT-12 hecho)
git -C rest_usuario log --oneline | head -8                                         # se ven los commits C1…C6 de HLT-12
grep -rn "\[CORREO\]" rest_usuario --include=*.php --exclude-dir=vendor | wc -l    # 5
test "$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://localhost/criterio_kelly/rest_usuario/)" != 000 && echo apache_ok
/c/xampp/mysql/bin/mysql.exe -u root -N -e "SELECT 1" && echo mysql_ok             # si no responden, iniciar Apache y MySQL desde el panel de XAMPP
for r in rest_usuario rest_criteriokelly criterioKellyApp; do echo "$r $(git -C $r status --short | wc -l)"; done   # 0 en cada uno
mkdir -p $B/linea_base $B/despues && md5sum rest_usuario/.env > $B/linea_base/env.md5
```
Más el texto literal con el que el usuario autoriza los commits locales de este HLT (nunca `push`) en `$B/linea_base/autorizacion.txt`. Sin HLT-12 completo o sin esa autorización, la tarea queda `BLOQUEADA`.

**AC-T-02** (mismos scripts de HLT-12; `bash docs/Planificacion/evidencias/lib/limpiar_datos_prueba.sh` antes de cada batería; segundo plano, 10 min por script)
```bash
mkdir -p $B/linea_base/plantillas
/c/xampp/php/php.exe $A/capturar_plantillas.php rest_usuario/correo/PlantillasCorreo.php $B/linea_base/plantillas
U=http://localhost/criterio_kelly/rest_usuario
for r in servicios/EnviadorCorreo.php correo/ correo/README.md correo/EnviadorCorreo.php logs/correos/correos.log logs/respaldos/ configuracion/Configuracion.php .env; do echo "$r $(curl -s -m 5 -o /dev/null -w '%{http_code}' "$U/$r")"; done > $B/linea_base/curl_c01.txt
cd docs/Planificacion/evidencias
bash lib/limpiar_datos_prueba.sh; bash hlt06_bateria.sh   > correo-B/linea_base/hlt06.txt   2>&1
bash lib/limpiar_datos_prueba.sh; bash hlt06v2_bateria.sh > correo-B/linea_base/hlt06v2.txt 2>&1
bash lib/limpiar_datos_prueba.sh; bash hlt03_matriz.sh    > correo-B/linea_base/hlt03.txt   2>&1
bash lib/limpiar_datos_prueba.sh; bash correo-A/flujo_correo.sh > correo-B/linea_base/flujo.txt 2>&1
for f in hlt06 hlt06v2 hlt03 flujo; do echo "$f OK=$(grep -c '^OK ' correo-B/linea_base/$f.txt) FALLO=$(grep -c '^FALLO ' correo-B/linea_base/$f.txt)"; done | tee correo-B/linea_base/resumen.txt
```
Cualquier `FALLO` ya presente se registra como preexistente.

**AC-T-03** (resultado completo a `$B/inventario_F02.txt`, con encabezado por elemento)
```bash
X='--exclude-dir=vendor --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=www --exclude-dir=.angular --exclude-dir=android --exclude-dir=ios --exclude-dir=logs'
P="rest_usuario rest_criteriokelly rest_suscripcion rest_divisas criterioKellyApp"
{ echo "## F-1"; grep -rnI "generarCodigo\|obtenerCodigo" $P CLAUDE.md .claude $X
  echo "## F-1 pruebas (se conservan)"; grep -rnI "generarCodigo\|obtenerCodigo" docs/Planificacion/evidencias/*.sh
  echo "## F-2 vivas"; grep -rnI "codiorecupe" $P CLAUDE.md .claude $X
  echo "## F-2 en código ejecutable"; grep -rnI "codiorecupe" $P $X --include=*.php --include=*.ts --include=*.html --include=*.js --include=*.sh
  echo "## INSERT/SELECT * sobre sgen_usuario"; grep -rnI "INSERT INTO .\?sgen_usuario" $P docs/Planificacion/evidencias/*.sh $X; grep -rnIE "SELECT \*.*sgen_usuario|sgen_usuario.*SELECT \*" $P $X
  echo "## F-3, F-4"; grep -n "CLAVES_USUARIO\|CORREO_MODO" rest_*/configuracion/Configuracion.php; grep -n "'mail'" rest_usuario/correo/EnviadorCorreo.php
} > $B/inventario_F02.txt
grep -c "" $B/inventario_F02.txt
```
Criterios, en este orden: (a) sección «F-1»: exactamente **8** líneas, las de `rutas.txt:12,13,48,63` de los dos proyectos; (b) «F-2 vivas»: exactamente **5** líneas (`rest_usuario/anexos/sist_generico.sql:82`, `…/sist_genericoDatos.sql:48`, `criterioKellyApp/src/assets/anexos/Generico.sql:82`, `…/GenericoDatos.sql:48`, `.claude/agents/desarrollador-php.md:61`); (c) «F-2 en código ejecutable»: **0** líneas; (d) los `INSERT INTO sgen_usuario` de código nombran columnas y ninguno incluye `usu_codiorecupe`. Base viva:
```bash
$M -N -e "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, ORDINAL_POSITION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='sist_criteriokelly' AND TABLE_NAME='sgen_usuario' ORDER BY ORDINAL_POSITION" >> $B/inventario_F02.txt
$M -N -e "SELECT 'rutinas', COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='sist_criteriokelly' AND ROUTINE_DEFINITION LIKE '%codiorecupe%'; SELECT 'vistas', COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA='sist_criteriokelly' AND VIEW_DEFINITION LIKE '%codiorecupe%'; SELECT 'disparadores', COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='sist_criteriokelly' AND ACTION_STATEMENT LIKE '%codiorecupe%'; SELECT 'indices', COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='sist_criteriokelly' AND COLUMN_NAME='usu_codiorecupe'; SELECT 'claves_foraneas', COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='sist_criteriokelly' AND COLUMN_NAME='usu_codiorecupe'; SELECT 'filas', COUNT(*), IFNULL(SUM(usu_codiorecupe<>0),0) FROM sist_criteriokelly.sgen_usuario" >> $B/inventario_F02.txt
```
Esperado: rutinas, vistas, disparadores, índices y claves foráneas = 0; `filas` informa el total y cuántas tienen valor distinto de cero (solo conteos). Si algo no coincide, **no se elimina ese elemento**: se registra el hallazgo y la tarea pasa a `BLOQUEADA` para ese elemento (F-02).

**AC-T-04**
```bash
cd rest_usuario
# Guardas: las líneas a borrar son las esperadas
sed -n 12p rutas.txt | grep -q obtenerCodigo && sed -n 13p rutas.txt | grep -q generarCodigo \
 && sed -n 48p rutas.txt | grep -q 'autenticacion/generarCodigo' && sed -n 63p rutas.txt | grep -q 'autenticacion/obtenerCodigo' \
 && [ -z "$(sed -n 77p rutas.txt | tr -d '\r')" ] && sed -n 78p rutas.txt | grep -q '^PUT:' && echo guardas_ok
sed -i '12,13d;48,77d' rutas.txt
grep -c "generarCodigo\|obtenerCodigo" rutas.txt                                      # 0
git diff --numstat rutas.txt                                                           # 0	32	rutas.txt
diff <(git show HEAD:rutas.txt | sed '12,13d;48,77d') rutas.txt && echo solo_las_entradas
sed -n '5,14p' rutas.txt | /c/xampp/php/php.exe -r 'echo json_decode(stream_get_contents(STDIN)) !== null ? "json_ok\n" : "JSON_ROTO\n";'
git add rutas.txt && git commit -m "Docs: HU-003 quitar de rutas.txt los endpoints eliminados generarCodigo y obtenerCodigo"
```
El `sed -i` conserva las terminaciones CRLF de las demás líneas (`rutas.txt` es CRLF). Si alguna guarda falla, no se borra nada.

**AC-T-05** — igual que AC-T-04 con `cd rest_criteriokelly` (las posiciones son idénticas: `diff` previo de ambos archivos solo difiere en la URL) y mensaje `Docs: HU-003 quitar de rutas.txt los endpoints eliminados generarCodigo y obtenerCodigo` en ese repositorio. Además `git -C rest_criteriokelly status --short` queda vacío tras el commit y el `rutas.txt` conserva su descripción desactualizada del resto (fuera de alcance, DC-07).

**AC-T-06 — PUERTA (estado inicial `BLOQUEADA`, por RD-6).** El agente de implementación **pregunta literalmente** al usuario:

> «¿Confirma que se elimine definitivamente la columna `sgen_usuario.usu_codiorecupe` de la base local `sist_criteriokelly` (con respaldo previo en archivo y un script de reversión probado), sin ejecutarla en ninguna base de producción hasta que usted lo indique? Responda por escrito exactamente "CONFIRMO DC-08" o "NO ELIMINAR LA COLUMNA".»

```bash
printf 'Fecha: %s\nRespuesta literal del usuario: %s\n' "$(date -Iseconds)" "<texto literal pegado>" > $B/confirmacion-DC-08.txt
grep -c "^Respuesta literal del usuario: CONFIRMO DC-08$" $B/confirmacion-DC-08.txt    # 1 → T-06 HECHA; si dice NO ELIMINAR LA COLUMNA: T-07…T-14 OMITIDA
```
Mientras no exista una respuesta escrita del usuario, la tarea sigue `BLOQUEADA` y no se ejecuta T-07…T-14. Ninguna otra respuesta (silencio, «adelante», «ok») cuenta como confirmación.

**AC-T-07**
```bash
R=rest_usuario/logs/respaldos; mkdir -p $R; TS=$(date +%Y%m%d-%H%M%S)
$MS -e "SELECT CONCAT('UPDATE sgen_usuario SET usu_codiorecupe=', IFNULL(usu_codiorecupe,'NULL'), ' WHERE usu_idUsuario=', usu_idUsuario, ';') FROM sgen_usuario ORDER BY usu_idUsuario" > $R/usu_codiorecupe-$TS.sql
$M sist_criteriokelly -e "SHOW CREATE TABLE sgen_usuario\G" > $R/sgen_usuario-estructura-$TS.txt
$MS -e "SELECT usu_idUsuario,usu_codiorecupe FROM sgen_usuario ORDER BY usu_idUsuario" | md5sum > $B/linea_base/codiorecupe_tuplas.md5
$MS -e "SELECT COLUMN_TYPE, IS_NULLABLE, IFNULL(COLUMN_DEFAULT,'NULL'), ORDINAL_POSITION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='sist_criteriokelly' AND TABLE_NAME='sgen_usuario' AND COLUMN_NAME='usu_codiorecupe'" > $B/linea_base/columna_definicion.txt
test "$(wc -l < $R/usu_codiorecupe-$TS.sql)" = "$($MS -e 'SELECT COUNT(*) FROM sgen_usuario')" && echo respaldo_completo
grep -c '^UPDATE sgen_usuario SET usu_codiorecupe=' $R/usu_codiorecupe-$TS.sql        # = nº de filas
grep -c 'usu_clave' $R/usu_codiorecupe-$TS.sql                                          # 0 (el respaldo no contiene hashes de clave)
git -C rest_usuario check-ignore -v $R/usu_codiorecupe-$TS.sql                          # atribuido a .gitignore:3
curl -s -m 5 -o /dev/null -w '%{http_code}\n' http://localhost/criterio_kelly/rest_usuario/logs/respaldos/usu_codiorecupe-$TS.sql   # 403 o 404
echo "$TS" > $B/linea_base/ts_respaldo.txt
```
`columna_definicion.txt` guarda la definición **viva**; T-08 la usa tal cual para la reversión. En la evidencia solo se escriben conteos (`SELECT COUNT(*), SUM(usu_codiorecupe<>0)`), nunca los valores (H-7).

**AC-T-08** — contenido exacto de `rest_usuario/anexos/seguridad_04_eliminar_codiorecupe.sql` (LF):
```sql
-- HU-003 F-2 (DC-08). Aplicar como root sobre sist_criteriokelly, después de seguridad_03_verificacion.sql.
-- ANTES de aplicarlo: guardar el respaldo de la columna (ver rest_usuario/README.md, "Eliminar usu_codiorecupe").
-- Idempotente: si la columna ya no existe no hace nada. Compatible con MariaDB 10.4 y MySQL 8.
-- Usa la base seleccionada o, si no hay ninguna, sist_criteriokelly.
SET @bd = COALESCE(DATABASE(), 'sist_criteriokelly');
SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = @bd AND TABLE_NAME = 'sgen_usuario' AND COLUMN_NAME = 'usu_codiorecupe');
SET @sentencia = IF(@existe > 0,
    CONCAT('ALTER TABLE `', @bd, '`.`sgen_usuario` DROP COLUMN `usu_codiorecupe`'),
    'SELECT ''usu_codiorecupe ya no existe: no se hace nada'' AS resultado');
PREPARE paso FROM @sentencia; EXECUTE paso; DEALLOCATE PREPARE paso;
```
y de `rest_usuario/anexos/reversion/seguridad_04_revertir_codiorecupe.sql`:
```sql
-- HU-003 F-2 (DC-08) · REVERSIÓN de seguridad_04_eliminar_codiorecupe.sql. NO es parte de una instalación nueva.
-- Vuelve a crear la columna con su definición original; luego restaurar los valores con el respaldo:
--   mysql -u root sist_criteriokelly < rest_usuario/logs/respaldos/usu_codiorecupe-AAAAMMDD-HHMMSS.sql
-- Idempotente: si la columna ya existe no hace nada. Compatible con MariaDB 10.4 y MySQL 8.
SET @bd = COALESCE(DATABASE(), 'sist_criteriokelly');
SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = @bd AND TABLE_NAME = 'sgen_usuario' AND COLUMN_NAME = 'usu_codiorecupe');
SET @sentencia = IF(@existe = 0,
    CONCAT('ALTER TABLE `', @bd, '`.`sgen_usuario` ADD COLUMN `usu_codiorecupe` int(11) DEFAULT 0 AFTER `usu_clave`'),
    'SELECT ''usu_codiorecupe ya existe: no se hace nada'' AS resultado');
PREPARE paso FROM @sentencia; EXECUTE paso; DEALLOCATE PREPARE paso;
```
**Regla cerrada:** la definición `int(11) DEFAULT 0 AFTER usu_clave` es la del volcado (`sist_generico.sql:82`). Si `columna_definicion.txt` (T-07) muestra otra distinta (tipo, nulabilidad, valor por defecto o posición), el script de reversión usa **literalmente la definición capturada** y se registra la diferencia como desviación.
```bash
cd rest_usuario && for f in anexos/seguridad_04_eliminar_codiorecupe.sql anexos/reversion/seguridad_04_revertir_codiorecupe.sql; do test -f $f && grep -c "PREPARE paso" $f; done   # 1 y 1
grep -c "sist_criteriokelly" anexos/seguridad_04_eliminar_codiorecupe.sql                                   # ≥ 1
```
(No hay `php -l` aplicable: C4 ➖; la sintaxis SQL se prueba en T-09.)

**AC-T-09** (base temporal; `T=ck_prueba_instalacion`)
```bash
$M -e "DROP DATABASE IF EXISTS $T; CREATE DATABASE $T CHARACTER SET utf8mb4"
for f in sist_generico.sql sist_genericoDatos.sql; do $M $T < rest_usuario/anexos/$f; done
$M -N $T -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$T' AND TABLE_NAME='sgen_usuario' AND COLUMN_NAME='usu_codiorecupe'"   # 1 (la instalación nueva sí la crea: los volcados no se editan)
$M $T < rest_usuario/anexos/seguridad_04_eliminar_codiorecupe.sql; echo "exit=$?"                              # exit=0
$M -N $T -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$T' AND TABLE_NAME='sgen_usuario' AND COLUMN_NAME='usu_codiorecupe'"   # 0
$M -N $T < rest_usuario/anexos/seguridad_04_eliminar_codiorecupe.sql; echo "exit=$?"                          # 2.ª ejecución: exit=0 y "ya no existe"
$M $T < rest_usuario/anexos/reversion/seguridad_04_revertir_codiorecupe.sql; echo "exit=$?"                    # exit=0
$M -N $T -e "SELECT COLUMN_TYPE, IS_NULLABLE, IFNULL(COLUMN_DEFAULT,'NULL'), ORDINAL_POSITION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$T' AND TABLE_NAME='sgen_usuario' AND COLUMN_NAME='usu_codiorecupe'" | diff - $B/linea_base/columna_definicion.txt && echo definicion_igual_a_la_viva
$M $T < rest_usuario/anexos/reversion/seguridad_04_revertir_codiorecupe.sql; echo "exit=$?"                    # 2.ª reversión: exit=0
$M -e "DROP DATABASE $T"; $M -N -e "SHOW DATABASES LIKE 'ck_prueba_instalacion'" | wc -l                      # 0
git -C rest_usuario status --short anexos/sist_generico.sql anexos/sist_genericoDatos.sql                       # vacío
```
La base temporal prueba además el **orden de instalación** de D-B05 (los volcados cargan sin error porque aún no se eliminó la columna).

**AC-T-10**
```bash
$M < rest_usuario/anexos/seguridad_04_eliminar_codiorecupe.sql; echo "1a exit=$?"            # 0
$MS -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='sist_criteriokelly' AND TABLE_NAME='sgen_usuario' AND COLUMN_NAME='usu_codiorecupe'"   # 0
$M < rest_usuario/anexos/seguridad_04_eliminar_codiorecupe.sql; echo "2a exit=$?"            # 0 y "ya no existe: no se hace nada"
$MS -e "SELECT COUNT(*) FROM sgen_usuario"                                                    # igual al conteo de T-07 (no se perdieron filas)
```
Sin baterías ni peticiones de prueba corriendo durante esta tarea (H-8).

**AC-T-11**
```bash
TS=$(cat $B/linea_base/ts_respaldo.txt)
$M < rest_usuario/anexos/reversion/seguridad_04_revertir_codiorecupe.sql; echo "exit=$?"     # 0
$MS -e "SELECT COLUMN_TYPE, IS_NULLABLE, IFNULL(COLUMN_DEFAULT,'NULL'), ORDINAL_POSITION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='sist_criteriokelly' AND TABLE_NAME='sgen_usuario' AND COLUMN_NAME='usu_codiorecupe'" | diff - $B/linea_base/columna_definicion.txt && echo definicion_restaurada
$M sist_criteriokelly < rest_usuario/logs/respaldos/usu_codiorecupe-$TS.sql                    # restaura los valores
$MS -e "SELECT usu_idUsuario,usu_codiorecupe FROM sgen_usuario ORDER BY usu_idUsuario" | md5sum | diff - $B/linea_base/codiorecupe_tuplas.md5 && echo valores_identicos
$M sist_criteriokelly -e "SHOW CREATE TABLE sgen_usuario\G" | diff <(sed 's/ AUTO_INCREMENT=[0-9]*//' rest_usuario/logs/respaldos/sgen_usuario-estructura-$TS.txt) <(sed 's/ AUTO_INCREMENT=[0-9]*//') && echo estructura_identica
```
Los tres `diff` sin salida. Si alguno falla, la tarea queda `BLOQUEADA`, T-12 no se ejecuta y se informa al usuario con la salida real.

**AC-T-12**
```bash
$M < rest_usuario/anexos/seguridad_04_eliminar_codiorecupe.sql; echo "exit=$?"                # 0
$MS -e "SHOW COLUMNS FROM sgen_usuario LIKE 'usu_codiorecupe'" | wc -l                          # 0
# Humo de la app sin la columna (caminos que escriben/leen sgen_usuario)
U=http://localhost/criterio_kelly/rest_usuario
curl -s -w ' %{http_code}\n' -H 'Content-Type: application/json' -H 'X-Requested-With: CriterioKelly' -H 'Origin: http://localhost:8100' -X POST $U/autenticacion/autenticar -d '{"usuario":"no_existe_hu003","clave":"x"}'   # 401 genérico, no 500
cd rest_usuario && git add anexos/seguridad_04_eliminar_codiorecupe.sql anexos/reversion/seguridad_04_revertir_codiorecupe.sql \
 && git commit -m "DB: HU-003 script idempotente para eliminar usu_codiorecupe, con reversión"
git status --short | wc -l                                                                       # 0
```

**AC-T-13** — en `rest_usuario/README.md` (CRLF): añadir a la lista de importación de «Pasos» (`:53-59`) la línea `   - anexos/seguridad_04_eliminar_codiorecupe.sql (elimina la columna sgen_usuario.usu_codiorecupe, que ya no se usa; aplicar como root, es idempotente; no se copia a la app)` tras la de `seguridad_03`, y una sección nueva `## Eliminar usu_codiorecupe (HU-003 F-2)` con: qué es y por qué se elimina (nada la usa desde HLT-06); **orden** (`sist_generico.sql` → `sist_genericoDatos.sql` → `seguridad_01…03` → `seguridad_04`; los volcados no se editan y siguen nombrando la columna); **respaldo previo obligatorio** (comando de T-07 con `mysql … SELECT CONCAT('UPDATE …')`); **aplicación** (`mysql -u root sist_criteriokelly < rest_usuario/anexos/seguridad_04_eliminar_codiorecupe.sql`, idempotente); **reversión** (script de `anexos/reversion/` y restauración con el respaldo); aviso: «en producción lo aplica el usuario, nunca el agente».
```bash
cd rest_usuario && grep -c "seguridad_04_eliminar_codiorecupe" README.md                          # ≥ 2
grep -c "^## Eliminar usu_codiorecupe" README.md                                                  # 1
git diff --numstat README.md                                                                       # solo líneas añadidas
git add README.md && git commit -m "Docs: HU-003 documentar la eliminación de usu_codiorecupe y su reversión"
```

**AC-T-14** — `.claude/agents/desarrollador-php.md:61`: cambiar `(`usu_clave`, `usu_codiorecupe`)` por `(`usu_clave`)`. Copiar antes el original a `$B/originales/desarrollador-php.antes.md`.
```bash
diff $B/originales/desarrollador-php.antes.md .claude/agents/desarrollador-php.md | grep -c '^[<>]'    # 2 (una línea cambiada)
grep -c "codiorecupe" .claude/agents/desarrollador-php.md                                                # 0
```

**AC-T-15**
```bash
sha256sum rest_criteriokelly/configuracion/Configuracion.php rest_suscripcion/configuracion/Configuracion.php rest_usuario/configuracion/Configuracion.php rest_divisas/configuracion/Configuracion.php | cut -c1-16     # 3 iguales y rest_divisas distinto (X-4)
grep -n "CLAVES_USUARIO\|'CORREO_MODO'\|CORREO_ALERTAS" rest_usuario/configuracion/Configuracion.php | head                 # F-3 intacto
grep -n "'mail'" rest_usuario/correo/EnviadorCorreo.php rest_usuario/configuracion/Configuracion.php                        # F-4 (DC-09) intacto
test -f rest_usuario/servicios/AlertasSeguridad.php && grep -c "\[CORREO\] alertaSeguridad" rest_usuario/servicios/AlertasSeguridad.php   # 1
grep -n "avisarRegistroOmitidoEnLocal" rest_usuario/controladores/PersonaCtrl.php | wc -l                                  # 2 (llamada y definición)
grep -n "if (\$modo === 'log')\|\$cifrado === 'tls'" rest_usuario/correo/EnviadorCorreo.php                                  # modos log y smtp intactos
ls -d /c/xampp/mailpit/descarga /c/xampp/mailtodisk/support/gen_py                                                          # F-5: existen (solo lectura; el usuario decide)
git -C rest_usuario diff --stat HEAD~0 -- configuracion correo/EnviadorCorreo.php | wc -l                                    # 0 (sin cambios sin commitear)
```
Se entrega en la evidencia la justificación escrita de cada elemento conservado: **F-3** porque quitar las validaciones rompe la copia compartida de `Configuracion.php` en 3 backends (`rest_divisas` ya difiere solo en `mail`, X-4); **F-4** por DC-09 (única opción con un hosting sin SMTP); `AlertasSeguridad` por ser lógica de seguridad; `registro-omitido` porque es la ayuda de local que explica por qué no llegó el correo; `log` y `smtp` porque son los modos en uso.

**AC-T-16** (segundo plano; limpiar datos de prueba antes de cada batería; sin tareas de F-2 en curso)
```bash
mkdir -p $B/despues/plantillas
/c/xampp/php/php.exe $A/capturar_plantillas.php rest_usuario/correo/PlantillasCorreo.php $B/despues/plantillas
diff $B/linea_base/plantillas/SHA256SUMS $B/despues/plantillas/SHA256SUMS && echo plantillas_identicas
U=http://localhost/criterio_kelly/rest_usuario
for r in servicios/EnviadorCorreo.php correo/ correo/README.md correo/EnviadorCorreo.php logs/correos/correos.log logs/respaldos/ configuracion/Configuracion.php .env; do echo "$r $(curl -s -m 5 -o /dev/null -w '%{http_code}' "$U/$r")"; done > $B/despues/curl_c01.txt
diff $B/linea_base/curl_c01.txt $B/despues/curl_c01.txt && echo mismos_codigos
# RN-02: los endpoints eliminados siguen eliminados
H='-H Content-Type:application/json -H X-Requested-With:CriterioKelly -H Origin:http://localhost:8100'
curl -s -w ' %{http_code}\n' $H -X POST $U/autenticacion/generarCodigo -d '{"id":1}'                    # 401 sin token
curl -s -w ' %{http_code}\n' $H -X POST $U/autenticacion/obtenerCodigo -d '{"usuario":"x"}'             # 401 sin token
cd docs/Planificacion/evidencias
bash lib/limpiar_datos_prueba.sh; bash hlt06_bateria.sh   > correo-B/despues/hlt06.txt   2>&1
bash lib/limpiar_datos_prueba.sh; bash hlt06v2_bateria.sh > correo-B/despues/hlt06v2.txt 2>&1
bash lib/limpiar_datos_prueba.sh; bash hlt03_matriz.sh    > correo-B/despues/hlt03.txt   2>&1
bash lib/limpiar_datos_prueba.sh; bash correo-A/flujo_correo.sh > correo-B/despues/flujo.txt 2>&1
for f in hlt06 hlt06v2 hlt03 flujo; do diff <(grep -E '^(OK|FALLO) ' correo-B/linea_base/$f.txt | awk '{print $1,$2}') <(grep -E '^(OK|FALLO) ' correo-B/despues/$f.txt | awk '{print $1,$2}') && echo "$f igual"; done   # 4 líneas "igual"
grep -E 'P-02 |P23-tiempos-ge2|P23-medianas|P02v1' correo-B/despues/hlt06.txt correo-B/despues/hlt06v2.txt         # OK; mínimo ≥ 2.0 y |dif| < 0.3
md5sum -c correo-B/linea_base/env.md5                                                                                # OK
```
Además, con la columna eliminada (si T-12 está `HECHA`): `P-14` de `hlt06_bateria.sh` (404/401 de los endpoints eliminados) y el registro del flujo (INSERT sin la columna) están incluidos en esas ejecuciones.

**AC-T-17**
```bash
git -C rest_usuario log --oneline | head -12; git -C rest_criteriokelly log --oneline | head -3
git -C rest_usuario log --format='%h %s' --stat -- rutas.txt | head -5                         # 1 commit propio de F-1
git -C rest_usuario show --stat --format=%s HEAD~1 2>/dev/null | head -5
git -C rest_usuario log --format='%h %s' -- anexos/seguridad_04_eliminar_codiorecupe.sql anexos/reversion/seguridad_04_revertir_codiorecupe.sql   # 1 commit propio de los scripts
for r in rest_usuario rest_criteriokelly criterioKellyApp rest_suscripcion; do echo "$r $(git -C $r status --short | wc -l)"; done   # 0 en cada uno
git -C criterioKellyApp diff --quiet -- src/assets/anexos && echo copias_app_intactas
git -C rest_usuario diff --quiet HEAD -- anexos/sist_generico.sql anexos/sist_genericoDatos.sql composer.json composer.lock index.php rutas && echo volcados_y_plumbing_intactos
# Inventario final (F-02): sin referencias nuevas
grep -rnI "generarCodigo\|obtenerCodigo" rest_usuario rest_criteriokelly rest_suscripcion rest_divisas criterioKellyApp --exclude-dir=vendor --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=www --exclude-dir=.angular --exclude-dir=logs | wc -l    # 0
grep -rnI "codiorecupe" rest_usuario rest_criteriokelly rest_suscripcion rest_divisas criterioKellyApp .claude CLAUDE.md --exclude-dir=vendor --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=www --exclude-dir=.angular --exclude-dir=logs | wc -l   # 4 (los 4 volcados, que no se editan) si F-2 se ejecutó; 5 si se omitió (más desarrollador-php.md:61)
```

### H7.3 Commits previstos (locales, nunca `push`)

| Repo | Tarea | Mensaje (español) |
|------|-------|-------------------|
| `rest_usuario` | T-04 | `Docs: HU-003 quitar de rutas.txt los endpoints eliminados generarCodigo y obtenerCodigo` |
| `rest_criteriokelly` | T-05 | `Docs: HU-003 quitar de rutas.txt los endpoints eliminados generarCodigo y obtenerCodigo` |
| `rest_usuario` | T-12 | `DB: HU-003 script idempotente para eliminar usu_codiorecupe, con reversión` |
| `rest_usuario` | T-13 | `Docs: HU-003 documentar la eliminación de usu_codiorecupe y su reversión` |

Sin commit (sin git): `.claude/agents/desarrollador-php.md`, `docs/**`. Cada mensaje termina con la línea de atribución vigente en la sesión del agente de implementación.

---

## H8 · Reglas de implementación deterministas

Reglas de `.claude/agents/desarrollador-php.md` (por sección) más las propias:

- **RI-B1 · Cambios de esquema** («Estándares de código», último ítem): script en `anexos/`, sin modificar los volcados existentes, con su orden de aplicación documentado.
- **RI-B2 · Base de datos** («Seguridad» → «Base de datos»): ningún SQL con valores interpolados; los scripts nuevos no reciben entrada externa.
- **RI-B3 · Secretos** («Secretos y configuración»): no abrir `.env` (solo `md5sum`); el respaldo no contiene `usu_clave`.
- **RI-B4 · Contrato HTTP** («Contrato de respuesta»): ningún endpoint, respuesta ni código cambia.
- **RI-B5 · Datos**: solo `sist_criteriokelly` local y `ck_prueba_instalacion` temporal; nunca producción; ningún `DROP` ni `ALTER` fuera de T-09…T-12.
- **RI-B6 · Puerta**: T-07…T-14 no se inician sin T-06 `HECHA` (RS-6); sin respuesta escrita del usuario, T-06 sigue `BLOQUEADA`.
- **RI-B7 · F-02**: una coincidencia no prevista detiene la eliminación de ese elemento, se registra como hallazgo y no se «arregla» ampliando el alcance (RS-7).
- **RI-B8 · Sin efectos fuera de alcance** (RI-10 de `doc_modo_planificacion.md`): `git diff --name-only` por tarea.
- **RI-B9 · Commits** (RI-11): solo los de H7.3, locales, uno por eliminación, con autorización de T-01, **nunca `push`**; sin mezclar con movimientos de archivos.
- **RI-B10 · Evidencia honesta** (RS-1, RS-8): salida real pegada; si una comparación difiere se reporta y no se ajusta la línea base.
- **RI-B11 · Terminaciones de línea**: `rutas.txt` y `README.md` de `rest_usuario` son CRLF y se conservan; los scripts SQL nuevos, LF.
- **RI-B12 · Sin servicios, endpoints, secretos, tablas ni dependencias nuevas** (C-06).

---

## H9 · Reglas de seguimiento de ejecución

Método, símbolos y RS-1…RS-9 de `criterioKellyApp/docs/doc_modo_planificacion.md` §11. Para backend, **C4** = `C:\xampp\php\php.exe -l` sobre cada `.php` tocado (en este HLT no se toca ningún `.php`: ➖ en todas) y **C5** = prueba con la respuesta real (`curl`, `mysql` o batería, según la tarea).

**Excepciones de este HLT (decididas por el usuario/RD-6):**
- **T-06 nace `BLOQUEADA`** (RS-4): causa «requiere confirmación escrita del usuario (DC-08)»; acción requerida: formular la pregunta literal de AC-T-06. Es la única ficha que no parte en `PENDIENTE`.
- **Dependencias `OMITIDA`:** si T-06 recibe «NO ELIMINAR LA COLUMNA», T-07…T-14 pasan a `OMITIDA` con motivo y checks en `➖` (RS-5), y T-16 puede iniciarse con esas dependencias `OMITIDA`. El estado global resultante es `PARCIAL`.

```
T-01 — Precondiciones y evidencias
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-01)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-02 — Línea base B
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-02)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-03 — Inventario F-02
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-03)  [⬜] C3  [➖] C4  [⬜] C5 (consulta a la base viva)  [⬜] C6
  Evidencia: —   Notas: —
T-04 — rutas.txt de rest_usuario
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-04)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-05 — rutas.txt de rest_criteriokelly
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-05)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-06 — PUERTA DC-08: confirmación escrita del usuario
  Estado: BLOQUEADA
  Causa: eliminar una columna es un cambio de esquema irreversible (RD-6); requiere la respuesta escrita del usuario.
  Acción requerida: formular la pregunta literal de AC-T-06 y pegar la respuesta literal en confirmacion-DC-08.txt.
  [⬜] C1  [⬜] C2 (AC-T-06)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-07 — Respaldo previo de la columna
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-07)  [⬜] C3  [➖] C4  [⬜] C5 (mysql + curl 403/404)  [⬜] C6
  Evidencia: —   Notas: —
T-08 — Scripts de eliminación y reversión
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-08)  [⬜] C3  [➖] C4  [➖] C5 (se prueban en T-09)  [⬜] C6
  Evidencia: —   Notas: —
T-09 — Prueba en base temporal
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-09)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-10 — Eliminación en local (1.ª y 2.ª ejecución)
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-10)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-11 — Reversión probada con datos reales
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-11)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-12 — Eliminación definitiva y commit de scripts
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-12)  [⬜] C3  [➖] C4  [⬜] C5 (curl de login: 401, no 500)  [⬜] C6
  Evidencia: —   Notas: —
T-13 — README de rest_usuario
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-13)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-14 — desarrollador-php.md
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-14)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-15 — Conservación F-05 y nota F-5
  Estado: PENDIENTE
  [➖] C1 sin cambios  [⬜] C2 (AC-T-15)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-16 — Repetir B, C y E
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-16)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-17 — Auditoría final
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-17)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
```

### Tablero de avance global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-06 | **BLOQUEADA** | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-09 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-10 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-13 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-14 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-15 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-16 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-17 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

---

## H10 · Diseño del reporte de ejecución

Estructura fija (RR-1…RR-5 de `doc_modo_planificacion.md` §12):

```
REPORTE DE EJECUCIÓN — Eliminación del código de correo innecesario (HU-003 F)
  1. Resumen ejecutivo
  2. Estado global              (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas          (copia de H9, T-01…T-17)
  4. Cobertura vs. HLT          (F-01…F-05 y RN-01…RN-14 → resultado; ¿100 %?)
  5. Cambios realizados         (archivos ruta:línea; commits con hash)
  6. Verificaciones ejecutadas  (comando → salida real; inventario F-02; comparaciones antes/después)
  7. Desviaciones y decisiones  (incluida la definición viva de la columna si difirió del volcado)
  8. Pendientes / bloqueos      (T-06 si sigue BLOQUEADA)
  9. Próximos pasos             (aplicar seguridad_04 en producción cuando exista el hosting; F-5)
```

Reglas específicas: `COMPLETADO` solo con las 17 tareas `HECHA`; si el usuario no confirma DC-08, el estado es `PARCIAL` con T-06 `BLOQUEADA` (o T-07…T-14 `OMITIDA` si respondió que no) y se indica la acción pendiente. La sección 9 incluye siempre la **nota F-5** para el usuario: `C:\xampp\mailpit\descarga\` y `C:\xampp\mailtodisk\support\gen_py\` no forman parte del workspace ni los usa nada; puede borrarlos si quiere (el agente no lo hace). Incluye también la discrepancia X-4 (`rest_divisas/configuracion/Configuracion.php` difiere en `mail`).

---

## H11 · Convenciones de desarrollo y arquitectura de código limpio

| Elemento | Convención en este HLT |
|----------|------------------------|
| Scripts SQL de esquema | `rest_usuario/anexos/seguridad_NN_<verbo>_<objeto>.sql`, español, `NN` correlativo tras `seguridad_03`; el de reversión en `anexos/reversion/` con el mismo nombre y `revertir` en lugar del verbo; cabecera con la HU, el orden de aplicación, el usuario que lo aplica (`root`), la idempotencia y la compatibilidad (MariaDB 10.4 y MySQL 8), como `seguridad_03_verificacion.sql:1-2` |
| Idempotencia | `information_schema` + `PREPARE/EXECUTE`, como `seguridad_00_usuario_mysql.sql:9`, con esquema `COALESCE(DATABASE(), 'sist_criteriokelly')` |
| Respaldo | Archivo `usu_codiorecupe-AAAAMMDD-HHMMSS.sql` en `rest_usuario/logs/respaldos/` (sin versionar) |
| Evidencias | `docs/Planificacion/evidencias/correo-B/` |
| Base temporal de prueba | Nombre con prefijo `ck_prueba_` (`ck_prueba_instalacion`), eliminada al terminar |
| Mensajes de commit | Español; prefijos `Docs:` y `DB:` |
| Documentación | Español, sin marcadores pendientes ni emojis; las referencias históricas no se reescriben |

Responsabilidad única: cada commit elimina un elemento; cada tarea cambia un archivo o ejecuta una acción de base de datos con su comprobación.
