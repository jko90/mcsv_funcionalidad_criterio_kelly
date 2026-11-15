# HLT-12 v2 — Módulo de correo identificable en `rest_usuario` (HU-003 rev. 2, criterios A–E y G-01, G-02)

| Campo | Valor |
|-------|-------|
| Versión | **v2. Reemplaza** a `docs/Planificacion/HLT-12-2026-11-11-modulo-correo.md` (v1, que queda como historial y no debe ejecutarse). Mismo alcance A–E; incorpora los criterios **G-01** y **G-02** de la sección G nueva de la HU (ver «Cambios respecto a v1») |
| Fecha | 2026-11-11 |
| Historia | `docs/Historia_usuario/HU-003-microservicio-correo.md` (rev. 2: módulo `correo/` dentro del proyecto, **sin microservicio**; `rest_correo` está anulado y no se planifica) |
| Cubre | Criterios **A, B, C, D, E** y de la sección G los criterios **G-01** (flujos G-1…G-5 probados antes y después, con evidencia real) y **G-02** (G-5 de punta a punta en la app, prueba manual). El criterio **F** (eliminación de código innecesario) es el HLT hermano `HLT-13-2026-11-11-eliminacion-codigo-correo.md`, que **depende de este**. **G-6, G-03 y G-04** (cédula única) son el HLT `HLT-14-2026-11-11-cedula-unica.md`, que también depende de este |
| Numeración de HLT | Los HLT de HU-003 siguen la secuencia global: HLT-12 (este), HLT-13 (F) y HLT-14 (G-6). HLT-10 y HLT-11 están reservados para HU-001 |
| Proyectos y git | `rest_usuario` (git propio), `rest_criteriokelly` (git propio), `rest_suscripcion` (git propio), `criterioKellyApp` (git propio, solo su `README.md`), `rest_divisas` (**sin git**), raíz del workspace (**sin git**: `CLAUDE.md`, `.claude/agents/`, `docs/`) |
| Entorno verificado al planificar | PHP 8.2.35 en `C:\xampp\php\php.exe`; Composer no instalado ni necesario (la HU no añade dependencias); `rest_usuario/.env` con `CORREO_MODO=log`; **Apache y MySQL estaban detenidos** (`curl` devolvió `000` y `mysql` el error 10061), por eso la tarea T-01 los exige arriba |
| Estado | Pendiente de ejecución (veredicto H6: ver H6, ronda 3 sobre la v2) |

---

## Cambios respecto a v1

La v1 (APROBADA, tareas T-01…T-32) se conserva íntegra: mismas tareas, decisiones, comandos de aceptación, riesgos y fichas. La v2 **solo añade** lo siguiente; no se renumera ninguna tarea de la v1 (los IDs T-01…T-32 y todas sus referencias cruzadas siguen valiendo), las tareas nuevas son T-33…T-41.

| # | Qué se añadió | Dónde | Por qué |
|---|----------------|-------|---------|
| V2-1 | Batería reproducible nueva `docs/Planificacion/evidencias/hu003_flujos_cuenta.sh` (más sus ayudas `lib/hu003_comun.sh`) que prueba con `curl` los flujos G-1 a G-5 y registra códigos HTTP, mensajes, correos archivados y conteos de `sgen_usuario`, `sgen_verificacion`, `sgen_recuperacion` y `spsu_suscripcion`, con limpieza de los usuarios de prueba | T-33 (AC-T-33), fase 0 | G-01 |
| V2-2 | Línea base de la batería, corrida dos veces para demostrar que su salida normalizada es determinista | T-34 (AC-T-34), fase 0 | G-01 |
| V2-3 | La batería se repite al final de cada fase que toca `rest_usuario` y en la no regresión, exigiendo resultado idéntico a la línea base: fase 1 (movimiento y carga única, tras T-11), fase 2 (marcas, tras T-12), fase 3 (registros en `logs/correos/`, tras T-16 y T-17), fase 4 (configuración y documentación de `rest_usuario`, tras T-21) y final | T-35, T-36, T-37, T-38 y T-41 | G-01 |
| V2-4 | Paso de prueba manual G-02: registro en la app con un plan de pago, activación, primer inicio de sesión y `suscripcion/crearSinPago` con ese plan. Documento nuevo `PRUEBAS-MANUALES-HU-003.md` y verificación en base de datos de lo que ocurrió | T-39 (redactar) y T-40 (verificar tras la ejecución del usuario) | G-02 |
| V2-5 | Precondiciones de T-01 ampliadas (plan de pago existente, `rest_suscripcion` arriba, fixtures del límite por IP) | AC-T-01 | La batería nueva las necesita |
| V2-6 | `T-07` pasa a depender también de `T-34`: no se mueve ningún archivo sin la línea base G | H7.1 | Sin línea base no hay comparación |
| V2-7 | Resumen, camino crítico, tablero, fichas, reporte (H10) y decisiones D-21…D-27; riesgos R-10…R-13; hallazgos H-17…H-26; RN-16…RN-22; discrepancias X-8…X-11 | H2, H4, H5, H6, H7, H9, H10 | Coherencia con lo anterior |
| V2-8 | Marca: **G-4 se conserva con el mensaje actual** (`El nombre de usuario o el teléfono ya están registrados`). HLT-14 lo cambia después por decisión DC-10; la batería lo recibe por la variable `MENSAJE_409` | RN-22, AC-T-33 | Evitar un falso fallo cuando HLT-14 se ejecute |

Lo que **no** cambia: alcance A–E, tareas T-01…T-32 (salvo la dependencia de T-07 y las ampliaciones explícitas de AC-T-01, AC-T-17, AC-T-28, AC-T-31 y AC-T-32 indicadas en H7.2), decisiones D-01…D-20, el criterio F (HLT-13) y G-6/G-03/G-04 (HLT-14).

---

## H1 · Propósito

**Requerimiento literal (HU-003 rev. 2):** «Como desarrollador que mantiene Criterio Kelly, quiero que en cada proyecto todo el código, la configuración, los registros y las pruebas del correo estén en un lugar con nombre propio y fácil de reconocer, para encontrar, revisar y cambiar el envío de correo sin recorrer controladores, servicios y scripts sueltos, y sin poner en riesgo la seguridad que ya está implementada. **Restricción principal:** la funcionalidad, la lógica y la seguridad actuales no cambian.»

**Propósito.** Reunir en `rest_usuario` (el único proyecto que envía correo) todo lo del correo bajo una carpeta `correo/` con nombre propio, con una sola carga, un mapa de los puntos de llamada, registros de local separados de los logs de errores y configuración agrupada; documentar la convención en el resto del workspace. Es una reorganización sin cambio de comportamiento, pensada para el desarrollador que mantiene el sistema.

**Resultado esperado (observable).**
1. Existe `rest_usuario/correo/` con `README.md`, `EnviadorCorreo.php`, `PlantillasCorreo.php`, `cargarCorreo.php` y `probarCorreo.php`; los tres archivos movidos conservan su historial git (`git log --follow`).
2. Los 5 archivos que cargaban las clases de correo cargan un solo `correo/cargarCorreo.php`.
3. `grep -rn "\[CORREO\]" rest_usuario --include=*.php --exclude-dir=vendor` lista exactamente 5 líneas, las mismas que la tabla de `correo/README.md`.
4. En modo `log` los correos de local quedan en `rest_usuario/logs/correos/` (mismos nombres de archivo).
5. `.env.ejemplo` tiene el bloque `# ===== Correo =====`.
6. Los README de los 4 backends y de la app, el `CLAUDE.md` de la raíz y `desarrollador-php.md` describen la convención.
7. Las 4 plantillas generan exactamente los mismos bytes, los tiempos P-02/P-23 siguen cumpliéndose y las baterías de HU-001 que tocan correo dan el mismo resultado que antes.
8. **(v2, G-01)** Existe `docs/Planificacion/evidencias/hu003_flujos_cuenta.sh`, que prueba con `curl` los flujos G-1 (recuperar clave), G-2 (habilitar la cuenta por correo y reenvío), G-3 (correo repetido), G-4 (usuario y teléfono repetidos) y G-5 en backend (`crearSinPago` con el plan reservado: 200, y repetido: 409). Su salida normalizada de la línea base es idéntica a la de la fase 1, la fase 2, la fase 3, la fase 4 y la no regresión final.
9. **(v2, G-02)** Existe `docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md` con el paso de prueba manual G-02 (registro en la app con un plan de pago, activación, primer inicio de sesión y `crearSinPago` con ese plan), y su verificación en base de datos queda registrada tras la ejecución del usuario.

**Fuera de alcance.**
- Crear `rest_correo` o cualquier servicio, endpoint, tabla, secreto o dependencia (C-06).
- Cambiar textos de correos, añadir plantillas, pasar a correos HTML.
- Mover `AlertasSeguridad.php` o `AlertasSeguridadMdl.php` (DC-03) y los tres controladores.
- Autoload de Composer para clases propias (DC-06).
- Elegir el proveedor SMTP de producción (DH-10 de HU-001).
- Reorganizar el código de la app (HU-002); la app solo recibe una línea de documentación en su `README.md`.
- **Todo el criterio F** (HLT-13): `rutas.txt`, columna `usu_codiorecupe`, validaciones de `Configuracion.php`, modo `mail`.
- **G-6, G-03 y G-04** (cédula única, DC-10, DC-11): son el HLT-14. Este HLT **conserva** G-4 con el mensaje actual y no comprueba la cédula.
- Cambiar cualquier comportamiento de los flujos G-1…G-5: la batería nueva solo los **observa**.
- Editar el `.env` real (contiene secretos): solo se documenta cómo reagrupar sus claves.

**Feature(s) afectada(s).** Servicio `rest_usuario`: módulo nuevo `correo/` (transversal a `/persona` y `/autenticacion`), `controladores/PersonaCtrl.php`, `ClaveCtrl.php`, `VerificacionCtrl.php`, `servicios/AlertasSeguridad.php`, `mantenimiento/limpiarSeguridad.php`, `.env.ejemplo`, `README.md`. Documentación en `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas`, `criterioKellyApp`, raíz del workspace y `docs/Planificacion/evidencias/`. **(v2)** La batería G toca, solo para observar, `/persona/agregar`, `/persona/activar`, `/persona/reenviarCodigo`, `/autenticacion/*` de `rest_usuario` y `rest_suscripcion/suscripcion/crearSinPago`; no modifica ninguno.

---

## H2 · Reglas de negocio

Reglas existentes que el cambio **no puede romper** (no se introducen reglas de negocio nuevas; sí reglas de organización).

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Las 4 plantillas no cambian de texto | `sha256sum` de asunto y cuerpo de las 4 plantillas con datos fijos es idéntico antes y después (8 archivos) | `PlantillasCorreo.php:7,21,36,51` · B-01 |
| RN-02 | Modos y validaciones del envío intactos | `log` solo con `esProduccion() === false` (`EnviadorCorreo.php:42-57`); cifrado `ninguno` solo local y `log` solo local en `Configuracion.php:266-267,278-279`; destinatario sin `\r`/`\n` y válido (`EnviadorCorreo.php:36-39`). `git diff` de `EnviadorCorreo.php` solo toca las líneas de la ruta de registros | B-02 |
| RN-03 | Semántica de fallo por punto de llamada | Tabla de H3 (5 filas): el código de verificación se envía tras el `commit` y su fallo no revierte (`PersonaCtrl.php:143,158-165`); fallos de recuperación, reenvío y aviso se registran y no cambian la respuesta HTTP (`ClaveCtrl.php:48-69,188-195`, `VerificacionCtrl.php:96-114`); el fallo de la alerta termina el mantenimiento con error (`AlertasSeguridad.php:35`, `limpiarSeguridad.php:53-56`). El diff de los 5 archivos solo contiene `require`, marcas `// [CORREO]` y, en `PersonaCtrl`, la ruta de `registro-omitido` | B-04 |
| RN-04 | Tiempos uniformes | `BaseCtrl::TIEMPO_MINIMO_RESPUESTA_MS = 2000` (`BaseCtrl.php:11`) sin tocar; P-02 y P-23: mínimo ≥ 2,0 s y diferencia de medianas < 0,3 s | `BaseCtrl.php:11,63-65` · C-02 |
| RN-05 | Respuestas HTTP sin cambio | Las baterías dan el mismo conjunto `OK`/`FALLO` por caso que la línea base; `rutas/`, `index.php`, `BaseCtrl.php`, `.htaccess` sin diff | B-05 · C-03 |
| RN-06 | El módulo no es accesible por web | `curl` a `correo/`, `correo/EnviadorCorreo.php`, `correo/README.md`, `correo/cargarCorreo.php`, `logs/correos/correos.log` responde 403 o 404 (lista blanca `.htaccess:17-19`) | C-01 |
| RN-07 | Ningún código en respuestas HTTP ni en logs de error | Ninguna línea nueva de `logs/php_errores.log` ni `logs/php_errors.log` contiene `es: [0-9]{6}`; el código solo existe en `logs/correos/` (modo `log`, solo local) | C-04 · `ManejadorErrores.php:20` |
| RN-08 | `logs/correos/` no se versiona | `git check-ignore -v logs/correos/correos.log` lo atribuye a `.gitignore:3` (`/logs/*`) | C-05 · `.gitignore:3` |
| RN-09 | Exactamente 5 puntos de llamada marcados | `grep -rn "\[CORREO\]"` devuelve 5 líneas y coinciden con la tabla del README del módulo (archivo, línea, plantilla) | A-05 |
| RN-10 | Una sola carga del módulo | Ningún `.php` fuera de `correo/` contiene `servicios/EnviadorCorreo` ni `servicios/PlantillasCorreo`; los 5 archivos tienen un `require` de `cargarCorreo.php` | A-04 |
| RN-11 | Historial git conservado | Commit de movimiento con 3 renombres `R100`; `git log --follow --oneline` de cada archivo movido tiene ≥ las entradas de la línea base (3, 2 y 1) | A-07 |
| RN-12 | Sin servicios, endpoints, secretos, tablas ni dependencias nuevas | `git diff --stat` sin cambios en `composer.json`, `composer.lock`, `index.php`, `rutas/`, `anexos/`; sin llaves nuevas en `.env.ejemplo`; `md5sum .env` igual al inicial | C-06 |
| RN-13 | `AlertasSeguridad` y los controladores no se mueven | Siguen en `servicios/` y `controladores/`; solo cambian `require` y marca | DC-03 |
| RN-14 | Los scripts de prueba no pueden dar falsos positivos con la ruta vieja | Los `*.sh` fallan en voz alta si falta `logs/correos/correos.log` o si existe el antiguo `logs/correos.log`; `grep -rn "logs/correos\.log" docs/Planificacion/evidencias/*.sh` = 0 | E-01 |
| RN-15 | La convención queda escrita | `CLAUDE.md`, `desarrollador-php.md`, 4 READMEs de backend y README de la app contienen la convención o la declaración «no envía correo» | D-01…D-03 |
| RN-16 **(v2)** | Los flujos G-1…G-5 no cambian | Para cada fase, `diff <(grep '^NORM' linea_base) <(grep '^NORM' fase)` vacío y `grep -c '^FALLO '` = 0: mismos códigos HTTP, mismos mensajes, mismos asuntos de correo archivados por dirección y mismos conteos en `sgen_usuario`, `sgen_verificacion`, `sgen_recuperacion` y `spsu_suscripcion` | G-01 |
| RN-17 **(v2)** | La línea base es determinista | Dos corridas consecutivas de la batería sobre el código sin tocar dan `NORM` idénticas (AC-T-34); si no, la batería se corrige antes de continuar | G-01 · H-19 |
| RN-18 **(v2)** | La batería solo toca datos de prueba | Todo usuario creado empieza por `ck_prueba_hu3_`; los `UPDATE` de fixtures se acotan a usuarios `ck_prueba_` y el borrado es `lib/limpiar_datos_prueba.sh`; al terminar `restantes = 0`; `md5` de la lista de usuarios reales (`usu_usuario` sin prefijo `ck_prueba_`) igual al inicio y al final | G-01 · D-20 · H-20 |
| RN-19 **(v2)** | La batería no puede dar falsos positivos por leer el log equivocado | `LOG_CORREOS` es obligatoria; el script falla con `exit 2` si el archivo no existe, si existe el log antiguo junto al nuevo (solo cuando `LOG_CORREOS` apunta a `logs/correos/`) o si el correo de control (activación de G-2) no aparece en el log indicado; el script no contiene la cadena de la ruta antigua (`grep -c "logs/correos\.log"` = 0, RN-14) | RN-14 · H-17 |
| RN-20 **(v2)** | G-5 en backend | Tras activar la cuenta y hacer login, `POST suscripcion/crearSinPago {"sus_pinIdPlanin":6}` con `Authorization: Bearer` responde 200 con `sus_pinIdPlanin` 6 y crea 1 fila en `spsu_suscripcion`; repetirlo responde `409 {"error":"El usuario ya tiene una suscripción pendiente o activa"}` sin crear otra fila; el plan Libre (`1`) crea 1 fila | G-5 · `SuscripcionCtrl.php:55-101` |
| RN-21 **(v2)** | G-02 se prueba en la app real | `PRUEBAS-MANUALES-HU-003.md` contiene el paso G-02 con pasos y consultas de verificación; el resultado lo registra el usuario y T-40 lo confirma con la base | G-02 |
| RN-22 **(v2)** | G-4 conserva el mensaje actual | La batería espera `409 {"error":"El nombre de usuario o el teléfono ya están registrados"}` (`PersonaCtrl.php:140`) mediante la variable `MENSAJE_409`; HLT-14 la cambia después | G-4 · DC-10 |

---

## H3 · Flujo principal de ejecución

**Disparadores.** Cinco puntos de llamada (HU, sección «Dónde está hoy el correo»), más la prueba por consola.

```
.htaccess (lista blanca: solo index.php, :17-19)
  → index.php → rutas/PersonaRts.php | rutas/ValidacionRts.php
       (cargan PersonaCtrl + VerificacionCtrl, o ValidacionCtrl + ClaveCtrl: PersonaRts.php:5-6, ValidacionRts.php:5-6)
  → controlador:   require_once __DIR__ . '/../correo/cargarCorreo.php'   ← NUEVO (antes 2 require_once a servicios/)
       → correo/cargarCorreo.php → require_once PlantillasCorreo.php + EnviadorCorreo.php
  → $this->enviador->enviar($correo, PlantillasCorreo::<plantilla>(...))      // [CORREO] <plantilla>
       → EnviadorCorreo::enviar
            ├─ destinatario inválido → InvalidArgumentException
            ├─ CORREO_MODO=log y no producción → carpetaRegistros() [NUEVO: logs/correos/, la crea si falta]
            │      → escribe correos.log (FILE_APPEND) + correo-AAAAMMDD-HHMMSS-xxxxxx.txt
            ├─ CORREO_MODO=log en producción → RuntimeException
            └─ smtp | mail → PHPMailer (sin cambios)
```

| # | Punto de llamada (estado inicial) | Plantilla | Si el envío falla (se conserva) |
|---|-----------------------------------|-----------|---------------------------------|
| 1 | `PersonaCtrl.php:161` (dentro de `enviarCodigoSinRevertir`, `:158-165`; llamado en `:143` tras `registrarPersona`, que ya hizo `commit`) | `codigoVerificacion` | `catch` → `error_log('[PersonaCtrl::agregarPersona] Fallo al enviar el código de verificación')`; el registro no se revierte; respuesta 200 uniforme |
| 2 | `ClaveCtrl.php:58-61` (dentro del `try` de `solicitarRecuperacion`) | `codigoRecuperacion` | `catch` `:63-65` → `error_log('[ClaveCtrl::solicitarRecuperacion] ' . getMessage())`; respuesta 200 uniforme y misma auditoría `RECUPERACION_SOLICITADA` |
| 3 | `ClaveCtrl.php:191` (helper `enviarAvisoSinRevertir`, `:188-195`, invocado desde `restablecerClave` `:132-135` **y** desde `actualizarClave` `:180`) | `avisoCambioClave` | `catch` → `error_log('[ClaveCtrl] Fallo al enviar aviso de cambio de clave')`; respuesta de éxito sin cambio |
| 4 | `VerificacionCtrl.php:105-108` (dentro del `try` de `reenviarCodigo`) | `codigoVerificacion` | `catch` → `error_log('[VerificacionCtrl::reenviarCodigo] ' . getMessage())`; respuesta 200 uniforme |
| 5 | `AlertasSeguridad.php:35` (`evaluarYNotificar`, invocado en `limpiarSeguridad.php:48`) | `alertaSeguridad` | Sin `catch` local: la excepción sube a `limpiarSeguridad.php:53-56` → `error_log('[limpiarSeguridad] …')` y `exit(1)`; no se escribe `alerta_seguridad.marca` (`AlertasSeguridad.php:36-38`) |
| — | `probarCorreo.php` (prueba manual por consola, **no** es punto de producción y **no lleva marca**) | `codigoVerificacion('Prueba','123456')` | Error por `STDERR` y `exit(1)` |

**Ramas HTTP.** Ninguna rama HTTP cambia: 200 uniforme con espera mínima de 2 s en `agregar`, `reenviarCodigo` y `solicitarRecuperacion`; 400/409/429/401 según la tabla de endpoints de `rest_usuario/README.md:127-150,224-232`. El 422 no interviene.

**Orden de ejecución del plan (ver H7).** Línea base (T-01…T-06) → movimiento con historial (T-07) → carga única (T-08…T-11) → marcas (T-12) → registros en `logs/correos/` y scripts (T-13…T-18) → configuración (T-19) → README del módulo (T-20) → documentación (T-21…T-27) → no regresión (T-28…T-32). El plan se ejecuta **sin pausas deploy** entre T-07 y T-11: entre el commit de T-07 y el de T-11 el `HEAD` no es ejecutable (ver R-02).

---

## H4 · Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN | Tareas | Prueba / verificación |
|--------------------|--------|-----------------------|
| A-01 módulo con 5 archivos | T-07, T-08, T-20 | `ls rest_usuario/correo` (AC-T-32) |
| A-02 nada de correo fuera del módulo | T-07 | `test ! -e` de los 3 archivos viejos (AC-T-07, AC-T-32) |
| A-03 `PHPMailer` solo en `correo/EnviadorCorreo.php` | T-07 | `grep` de AC-T-32 |
| A-04 un solo `require` / RN-10 | T-08, T-09, T-10, T-11 | AC-T-11, AC-T-32 |
| A-05 5 marcas / RN-09 | T-12, T-20 | AC-T-12, AC-T-20 |
| A-06 `probarCorreo.php` funciona | T-10, T-13, T-29 | AC-T-29 |
| A-07 `git mv` / RN-11 | T-07 | AC-T-07 |
| B-01 / RN-01 | T-02, T-29 | `cmp` y `sha256sum` (AC-T-29) |
| B-02 / RN-02 | T-13, T-29, T-28 | `git diff` acotado (AC-T-13); baterías |
| B-03 | T-13, T-14, T-29 | archivos en `logs/correos/` (AC-T-29) |
| B-04 / RN-03 | T-09…T-14, T-28 | diff acotado (AC-T-11/12/13/14); batería hlt06 P-19 (alerta) |
| B-05 / RN-05 | T-28 | comparación de baterías (AC-T-28) |
| C-01 / RN-06 | T-04, T-30 | AC-T-30 |
| C-02 / RN-04 | T-05, T-28 | P-02 y P-23 (AC-T-28) |
| C-03 | T-05, T-28 | auditoría y respuestas de las baterías |
| C-04 / RN-07 | T-13, T-31 | AC-T-31 |
| C-05 / RN-08 | T-15, T-31 | AC-T-15, AC-T-31 |
| C-06 / RN-12 | T-32 | AC-T-32 |
| D-01 | T-22, T-23, T-24 | AC-T-22…24 |
| D-02 | T-25 | AC-T-25 |
| D-03 | T-26, T-27 | AC-T-26, AC-T-27 |
| E-01 / RN-14 | T-16, T-17, T-18, T-28 | AC-T-17, AC-T-28 |
| E-02, E-03 | T-06, T-31 | `flujo_correo.sh` (AC-T-31) |
| E-04 | T-11, T-25, T-32 | `php -l`; `git diff --name-only` de la app = `README.md` |
| RN-13, RN-15 | T-12, T-21…T-27 | AC de cada tarea |
| **G-01 (v2)** línea base y repetición de G-1…G-5 / RN-16, RN-17, RN-18, RN-19, RN-22 | T-01, T-33, T-34, T-35, T-36, T-37, T-38, T-41 | AC-T-33 (script y controles), AC-T-34 (línea base determinista), AC-T-35…T-38 y AC-T-41 (`g_identico` por fase) |
| **G-01** G-5 en backend / RN-20 | T-33, T-34, T-41 | casos `G5-*` de la batería |
| **G-02 (v2)** prueba manual en la app / RN-21 | T-39, T-40 | AC-T-39 (documento), AC-T-40 (consultas en base tras la ejecución del usuario) |

### Checklist de calidad del HLT

- [x] Las 11 secciones existen y están completas.
- [x] Sin marcadores pendientes.
- [x] Cada RN mapea a ≥1 tarea (cobertura 100 %).
- [x] Cada tarea tiene criterio de aceptación verificable (H7.2) y ficha de checks (H9).
- [x] No contradice las reglas del proyecto (`CLAUDE.md` raíz, `desarrollador-php.md`).
- [x] Referencias `ruta:línea` leídas contra el repositorio actual (2026-11-11).
- [x] Decisiones cerradas en H5; la única que requeriría confirmación (DC-08) pertenece al HLT-13 y este HLT no depende de ella.

### Discrepancias entre la HU y el código real (registradas, ninguna bloquea)

| # | HU dice | Código real | Impacto | Recomendación adoptada |
|---|---------|-------------|---------|------------------------|
| X-1 | `.gitignore` debe ajustarse (petición de planificación) / C-05 | `rest_usuario/.gitignore:3` ya ignora `/logs/*`; `logs/correos/` queda cubierta | Ninguno; editar sería ruido | No tocar `.gitignore`; T-15 lo demuestra con `git check-ignore` (D-08) |
| X-2 | El aviso de cambio de clave es 1 punto (`ClaveCtrl.php:191`) | La línea 191 es el helper; se invoca desde **dos** endpoints: `restablecerClave` (`:132`) y `actualizarClave` (`:180`) | Las pruebas de E-03 deben cubrir ambos disparadores | Una sola marca en `:191`; README y `flujo_correo.sh` listan los dos disparadores |
| X-3 | D-02: la app dispara 3 flujos (verificación, reenvío, recuperación) | Hay un cuarto: `perfil.page.ts:160` → `autenticacion/actualizarClave` dispara `avisoCambioClave`; y el **registro** (`registro.page.ts:169` → `persona/agregar`) también envía el código | README de la app incompleto si sigue la HU al pie de la letra | T-25 lista los cinco disparadores |
| X-4 | `desarrollador-php.md:12-13` y `CLAUDE.md` raíz dicen «PHP 8.0, sin Composer» | `rest_usuario/composer.json` exige PHP ≥ 8.2 y usa `phpmailer` y `phpdotenv`; el entorno es PHP 8.2.35 | Documentación desactualizada; no afecta a esta HU | No se corrige aquí (RD-7). Todo el código especificado usa solo sintaxis PHP 8.0, válida en ambos |
| X-5 | F-3: la copia de `Configuracion.php` es idéntica en los backends | `rest_divisas/configuracion/Configuracion.php` difiere en `:263-264` (no admite `mail`); los otros tres tienen el mismo sha256 (`50db0cd3…`); `rest_divisas` además usa fines de línea LF | Solo afecta al HLT-13 (F-3/F-4) | Informado a HLT-13; no se toca en este HLT |
| X-6 | HU C-05: «fuera de la raíz pública en producción, como el resto de `logs/`» | Ya se cumple por configuración (`RUTA_LOGS`) y por la lista blanca de `.htaccess` | Ninguno | Se verifica con curl (T-30) |
| X-8 **(v2)** | La batería `hlt06_bateria.sh` sirve de línea base | `hlt06_bateria.sh:167` espera `Registro recibido. Podrás iniciar sesión cuando tu cuenta esté activa.` pero el servicio responde `Registro recibido. Si los datos son válidos, recibirás un código en tu correo para activar tu cuenta.` (`PersonaCtrl.php:18`): P-12 ya falla antes de este HLT | `hlt06_bateria.sh` (v1) tiene al menos un `FALLO` previo; `hlt06v2_bateria.sh` usa el texto real (`:11`) | No se corrige aquí. Se registra como preexistente (H-9/T-05). La batería nueva usa el texto real |
| X-9 **(v2)** | G-4: la HU cita el mensaje `El nombre de usuario o el teléfono ya están registrados` | Es el texto actual (`PersonaCtrl.php:140`) y lo afirma `hlt06_bateria.sh:172` (P-11a); HLT-14 lo cambiará por decisión DC-10 | Si HLT-14 se ejecuta, P-11a y la batería nueva deben esperar el texto nuevo | Este HLT conserva el actual; la batería lo recibe por `MENSAJE_409`; HLT-14 actualiza P-11a |
| X-10 **(v2)** | G-5: «el plan elegido se reserva» | La app reserva el **id de plan-intervalo** (`pin_idPlanInterv`, `plan-reservado.service.ts:7-10,19-27`) y llama `crearSinPago` con `sus_pinIdPlanin` (`SuscripcionStore.ts:98-101`); el plan Libre es el intervalo `1` (`Suscripcion.modelo.ts:18`); un plan de pago es, por ejemplo, el intervalo `6` (Básico, 1 mes, 1,25 USD, `sist_suscripcionDatos.sql:55`) | La batería debe enviar un **intervalo**, no un id de plan | `sus_pinIdPlanin` = 6 (pago) y 1 (Libre) |
| X-11 **(v2)** | Los flujos de la batería chocan con los límites vigentes | `MAXIMO_CODIGOS_POR_IP_HORA = 10` y `SEGUNDOS_ENTRE_ENVIOS = 60` (`VerificacionMdl.php:13-14`), `MAXIMO_SOLICITUDES_HORA = 3` (`ClaveMdl.php:9`), `API_MAX_PUBLICO_POR_IP = 60` por 60 s (`LimitadorPeticiones.php:11-12`) | Una batería repetida seis veces agotaría el límite por IP y daría 429 | Fixtures acotados (D-24) y espera de 61 s entre registro y reenvío |
| X-7 | Archivos de `rest_usuario` con terminaciones de línea mezcladas | CRLF en `EnviadorCorreo.php`, `PlantillasCorreo.php`, `PersonaCtrl.php`, `ClaveCtrl.php`, `limpiarSeguridad.php`, `AlertasSeguridad.php`, `README.md`; LF en `probarCorreo.php`, `VerificacionCtrl.php`, `.env.ejemplo`; `core.autocrlf=true` | Un editor que normalice reescribiría todo el archivo y ocultaría el cambio real, y rompería la comparación byte a byte | RI-A5: conservar la terminación de cada archivo; verificar con `git diff --numstat` (D-12) |

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Microservicio o módulo (DC-01) | A microservicio · B módulo `correo/` | **B** | Cerrada por el usuario; evita superficie de ataque y la llamada de red que pondría en juego los tiempos uniformes | No |
| D-02 | Ubicación y nombre (DC-02) | `servicios/correo/` · `correo/` en la raíz | **`rest_usuario/correo/`** | Visible junto a `controladores/`, `modelos/`, `servicios/`; la `.htaccess` lo protege igual que a las demás (lista blanca) | No |
| D-03 | Mover `AlertasSeguridad` (DC-03) | Sí · No | **No** | Es lógica de seguridad; solo marca y mapa | No |
| D-04 | Ubicación de los registros (DC-04) | `logs/` · `logs/correos/` | **`logs/correos/`** | Separa los registros de correo de los logs de errores | No |
| D-05 | Carga (DC-05) | `require` sueltos · `cargarCorreo.php` | **`cargarCorreo.php`** con `require_once` de las dos clases | Un solo lugar; `require_once` evita redeclarar clases si un archivo ya las cargó | No |
| D-06 | Autoload de Composer para clases propias (DC-06) | Sí · No | **No** | Cambiaría la carga de todo el proyecto | No |
| D-07 | `cargarCorreo.php` y `vendor/autoload.php` | A cargar el autoload dentro del módulo · B no cargarlo y documentar la dependencia | **B** | `index.php:12` y los scripts CLI ya lo cargan con `RUTA_APLICACION`, que puede apuntar a otra copia; un segundo `require_once` con otra ruta podría cargar Composer dos veces (RD-7: menor superficie) | No |
| D-08 | `.gitignore` | A añadir `/logs/correos/` · B no modificarlo | **B** | `.gitignore:3` (`/logs/*`) ya cubre toda subcarpeta; se prueba con `git check-ignore` (X-1) | No |
| D-09 | Creación de `logs/correos/` | A pre-crearla con `.gitkeep` · B crearla bajo demanda | **B**: `EnviadorCorreo::carpetaRegistros()` hace `mkdir` solo en modo `log` (local) | `Configuracion.php:213-215` solo valida `RUTA_LOGS`; con smtp/mail (producción) no se crea nada | No |
| D-10 | Fallo al crear `logs/correos/` | A propagar siempre · B conservar el contrato de cada llamador | **B**: en `enviar` lanza `RuntimeException` (igual que antes ante un fallo de escritura, `EnviadorCorreo.php:49-51`); en `avisarRegistroOmitidoEnLocal` se atrapa y retorna en silencio (hoy es `@file_put_contents`, `PersonaCtrl.php:176`) | Si el aviso de local lanzara, el registro respondería 500: cambio de comportamiento prohibido | No |
| D-11 | Marca en cada punto de llamada | Línea previa · comentario final en la misma línea del `->enviar(` | **Comentario final en la misma línea** (`// [CORREO] <plantilla>`); en llamadas multilínea, tras el `(` de apertura | La marca debe estar en la línea que envía para que `grep -n` dé la línea correcta | No |
| D-12 | Terminaciones de línea | Normalizar · conservar | **Conservar** la de cada archivo; archivos nuevos en LF | Diff mínimo y comparación byte a byte fiable (X-7) | No |
| D-13 | `probarCorreo.php` y la marca | Marcar · no marcar | **No marcar** | A-05 exige exactamente 5 y esa es una prueba manual; el README lo documenta | No |
| D-14 | Commits | Un commit global · commits por fase | **Commits por fase en `rest_usuario`** (C1…C6 en H7.3); movimiento aislado (A-07). Commits solo locales; **nunca `push`**. T-01 recoge la autorización del usuario para los commits (RI-11 de `doc_modo_planificacion.md`) | A-07 exige el movimiento en commit dedicado | No |
| D-15 | Commit transitorio roto | A mover y editar en el mismo commit · B commit de movimiento puro y, enseguida, el de carga única | **B**, ejecutados seguidos y verificados solo sobre el `HEAD` final de la fase | A-07 exige movimiento sin cambios de contenido; el costo es un `HEAD` intermedio no ejecutable (R-02), que no llega a ningún despliegue | No |
| D-16 | `.env` real | Editarlo · no tocarlo | **No tocarlo**; el README del módulo explica cómo reagrupar las 9 claves; `Configuracion` lee por nombre, el orden no importa | RD-5, no manipular secretos | No |
| D-17 | Archivos de documentación fuera de `rest_*` y de la app (`CLAUDE.md`, `.claude/agents/desarrollador-php.md`) | Dejar sin agente · asignar `desarrollador-php` | **`desarrollador-php`** (la HU lo fija en «Agente de implementación»); no están bajo git, por lo que antes de editar se copia el original a `evidencias/correo-A/originales/` para poder mostrar el `diff` | La regla «una tarea no mezcla archivos de ambos lados» se cumple | No |
| D-18 | Archivos migrados de `logs/` a `logs/correos/` | Dejarlos · moverlos | **Moverlos** (T-16): son locales, sin versionar | Evita que el script antiguo lea un log obsoleto y dé falsos positivos (RN-14) | No |
| D-19 | Historial de logs en la línea base | Capturar solo salida de scripts · además instantánea de logs | Además `wc -l` de `php_errores.log`/`php_errors.log` y `md5sum .env` en T-01 | Permite probar RN-07 y RN-12 por diferencia | No |
| D-20 | Pruebas con datos de prueba | Usuarios propios · prefijo `ck_prueba_` | Prefijo `ck_prueba_` y `lib/limpiar_datos_prueba.sh` | Es el mecanismo ya aceptado por HLT-01…09; acota los borrados | No |
| D-21 **(v2)** | Nombre y ubicación de la batería G | Ampliar `flujo_correo.sh` · script nuevo en `evidencias/` | **`docs/Planificacion/evidencias/hu003_flujos_cuenta.sh`** más `lib/hu003_comun.sh` con las ayudas (registrar, activar, reenviar, leer códigos, contar correos, normalizar). `correo-A/flujo_correo.sh` (T-06) se conserva: prueba E-02/E-03 con el correo; la batería G prueba los seis flujos de cuenta y la usará también HLT-14 | La HU fija el nombre; separar las ayudas permite reutilizarlas sin copiar | No |
| D-22 **(v2)** | Cómo recibe la ruta del log de correos | Ruta fija · variable obligatoria | **Variable de entorno `LOG_CORREOS` obligatoria** (ruta del archivo `correos.log`, relativa a `docs/Planificacion/evidencias/`). La carpeta de los `correo-*.txt` y de los `registro-omitido-*.txt` es `dirname "$LOG_CORREOS"`. Antes de T-13 se invoca con la ruta de `logs/` y desde T-13 con la de `logs/correos/`; ninguna de las dos aparece como texto dentro del script (RN-14, RN-19) | Una sola batería válida antes y después del movimiento, sin cadenas obsoletas | No |
| D-23 **(v2)** | Cómo se compara «idéntico» | Comparar texto crudo · registro normalizado | El script imprime, además de `OK`/`FALLO`, líneas `NORM<barra><caso><barra><valor>`. Normalización: códigos de 6 dígitos → `<codigo6>`, tokens → `<token>`, ids numéricos de usuario/suscripción → `<id>`, fechas → `<fecha>`; los códigos HTTP, los mensajes, los asuntos y los conteos se registran tal cual. Comparación: `diff` de las líneas `NORM` | El texto crudo cambia en cada corrida (códigos aleatorios, ids, fechas) | No |
| D-24 **(v2)** | Datos y fixtures de la batería | Reutilizar `ck_prueba_a…` · prefijo propio | Prefijo **`ck_prueba_hu3_`** para usuarios (`rec`, `reg`, `pl`, `li`, `c3`, `d1`, `d2`), correos `ck.prueba.hu3.<x>@example.com`, teléfonos `09900030NN`; limpieza con `lib/limpiar_datos_prueba.sh` (patrón por defecto `^ck_prueba_`) al inicio y al final; fixtures acotados: `UPDATE sgen_verificacion … SET ver_ipSolicitud='10.0.0.1'` solo para filas de usuarios `^ck_prueba_` y `DELETE FROM sgen_limitepeticion` / `sgen_intentoacceso` de `127.0.0.1` y `::1` (contadores transitorios, igual que `hlt06v2_bateria.sh:11`) | Cumple D-20 y evita tocar filas reales (H-20) | No |
| D-25 **(v2)** | Cuándo se repite la batería | Solo al final · al final de cada fase | **Al final de cada fase que toca `rest_usuario`** y en la no regresión: fase 1 (T-35, tras T-11 y no antes: el `HEAD` entre T-07 y T-10 no es ejecutable, R-02), fase 2 (T-36, tras T-12), fase 3 (T-37, tras T-16 y T-17), fase 4 (T-38, tras T-21) y final (T-41, tras T-31). Cada una se compara con la línea base; una diferencia deja la tarea `BLOQUEADA` con el `diff` real (RS-8) y no se ajusta la línea base | G-01 lo exige tras cada fase | No |
| D-26 **(v2)** | Plan usado en G-5 | Plan Libre · plan de pago | Los dos: usuario `pl` con el intervalo **6** (Básico, plan de pago) y usuario `li` con el intervalo **1** (Libre, el valor por defecto de la app). Cuerpo `{"sus_pinIdPlanin":N}` sin `sus_usuarioId`, como hace la app (`SuscripcionStore.ts:98-101`) | G-5 distingue «plan reservado» de «Libre por defecto» | No |
| D-27 **(v2)** | G-02 (prueba manual en la app) | Automatizarla con un emulador · documentarla para que la ejecute el usuario | **Documentarla y que la ejecute el usuario** (`PRUEBAS-MANUALES-HU-003.md`); T-40 solo verifica en la base lo que el usuario hizo. Si el usuario no la ejecuta, el estado global es `PARCIAL` y se dice. No se sustituye por `curl` (el `curl` ya cubre G-01) | Requiere la app, `localStorage` y el flujo de pantallas reales | No |

Ninguna decisión cambia el contrato JSON, el esquema ni la seguridad: no aplica RD-6 a este HLT.

---

## H6 · Revisión del requerimiento por parte de un senior

### Checklist (ronda 2, sobre el HLT ya corregido)

| # | Ítem | Veredicto | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 reproduce la HU rev. 2; `rest_correo` no se planifica |
| 2 | Reglas de negocio | ✅ | RN-01…RN-15 son booleanas y no se contradicen |
| 3 | Impacto | ✅ | 5 archivos con `require`; el grep del inventario (`PHPMailer`, `EnviadorCorreo`, `PlantillasCorreo`, `correos.log`) en los 5 proyectos no halló más usos; faltaban 3 documentos vivos con la ruta vieja (`.env.ejemplo:22`, `README.md:79,239`, `PRUEBAS-MANUALES-HU-001.md:10,19`) y ya están en T-19, T-21, T-18 |
| 4 | Consistencia arquitectónica | ✅ | Capas intactas (`Rts`→`Ctrl`→`Mdl`); el módulo es servicio transversal como `servicios/`; sin enum/readonly (compatible 8.0) |
| 5 | Riesgos | ✅ | Ver tabla de riesgos |
| 6 | Simplicidad | ✅ | Sin cambios a `.gitignore`, `.htaccess`, `Configuracion.php`, autoload; sin helper nuevo más allá de `carpetaRegistros()` |
| 7 | Seguridad | ✅ | Lista blanca probada por curl antes y después; `mkdir` solo en `log`/local; sin códigos en logs de error; `.env` intacto |
| 8 | Cobertura | ✅ | 100 % |
| 9 | Determinismo | ✅ | Código, textos y comandos exactos en H7.2 |
| 10 | Ejecutabilidad | ✅ | Cada tarea tiene archivos, dependencia y comando de aceptación |

### Hallazgos adversariales (ronda 1) y cómo se resolvieron

| # | Hallazgo | Severidad | Resolución incorporada |
|---|----------|-----------|------------------------|
| H-1 | **Un `require` roto da 500 solo en un camino poco usado**: `php -l` no resuelve rutas; la alerta de `AlertasSeguridad` solo corre si hay > 10 eventos, y `PersonaCtrl`, `ClaveCtrl` y `VerificacionCtrl` solo cargan al pedir su ruta | Alta | T-11 resuelve cada ruta de los `require` con un bucle `test -f`, ejecuta `limpiarSeguridad.php` y hace `curl` real a los 4 endpoints que envían; T-28 repite la batería hlt06 (P-19 fuerza la alerta) |
| H-2 | El commit de movimiento deja un `HEAD` roto | Media | D-15 y R-02: T-07…T-11 sin pausa; verificación solo sobre el `HEAD` de T-11 |
| H-3 | `avisarRegistroOmitidoEnLocal` pasaría a lanzar excepción si `mkdir` falla → el registro respondería 500 | Alta | D-10: `try/catch` que retorna en silencio; AC-T-14 inspecciona el diff |
| H-4 | **Carpeta nueva expuesta por web**: se asumía cubierta | Alta | Línea base de `curl` antes (T-04) y después (T-30), también `README.md`, `cargarCorreo.php`, directorio con barra final y `//`; criterio: mismo código que `servicios/EnviadorCorreo.php` en la línea base y 403/404 |
| H-5 | **Códigos que acaban en logs de error**: `ClaveCtrl`/`VerificacionCtrl` registran `getMessage()` | Alta | El mensaje nuevo de `carpetaRegistros()` no contiene datos; T-31 compara el delta de `php_errores.log`/`php_errors.log` contra `es: [0-9]{6}` |
| H-6 | **Scripts de prueba que leen la ruta vieja y dan falsos positivos**: tras mover el log, `logs/correos.log` obsoleto sigue existiendo y comprobaciones del tipo «0 correos nuevos» (`P-16`, `P35`, `P23-a`) pasan en vacío | Alta | D-18/T-16 mueve los archivos viejos; T-17 añade guarda que aborta si falta el log nuevo o existe el viejo, y un control positivo (P-03 exige 3 correos); AC-T-17 con `grep` = 0 de la ruta vieja |
| H-7 | **Pérdida de historial de git** | Media | `git mv` + commit de renombres puros; AC-T-07 exige `R100` y conteo `--follow` |
| H-8 | La batería depende de MySQL/Apache, detenidos al planificar | Media | T-01 los exige y registra la versión |
| H-9 | Las baterías de línea base podrían ya tener `FALLO`; comparar «todo OK» sería falso | Media | La comparación es por conjunto `(caso, estado)`: lo que fallaba debe seguir igual y se anota (AC-T-05) |
| H-10 | La marca `[CORREO]` aparecería en `probarCorreo.php` o en comentarios → 6 resultados | Media | D-13; AC-T-12 exige 5 líneas exactas y que `correo/` solo contenga la marca en `README.md` |
| H-11 | `cargarCorreo.php` cargando el autoload duplicaría Composer | Media | D-07 |
| H-12 | Edición con normalización de CRLF reescribiría archivos completos y enmascararía diffs | Media | D-12; AC por tarea con `git diff --numstat` |
| H-13 | La comparación de plantillas podría pasar siempre (script mal enlazado a la ruta) | Media | Control negativo en T-02 (una copia alterada debe dar diferencia) |
| H-14 | El README del módulo se desfasa de las líneas reales | Baja | T-20 genera la tabla desde `grep -n` y AC-T-20 valida línea por línea |
| H-15 | Uso de `.env`: el agente podría abrirlo y exponer secretos | Alta | D-16: solo `grep '^CORREO_MODO='` y `md5sum` |
| H-16 | `rest_divisas` no tiene git y `CLAUDE.md`/agente están fuera de git | Baja | Copia previa a `evidencias/correo-A/originales/` y `diff` (D-17) |

### Hallazgos adversariales de la ronda 3 (adición de G-01 y G-02) y cómo se resolvieron

| # | Hallazgo | Severidad | Resolución incorporada |
|---|----------|-----------|------------------------|
| H-17 | **Falso positivo por leer el log equivocado** durante la transición (entre T-13 y T-16 coexisten `logs/correos.log` y `logs/correos/correos.log`): la batería «encontraría» correos viejos o no encontraría los nuevos y marcaría OK en vacío | Alta | D-22/RN-19: `LOG_CORREOS` obligatoria; guarda de existencia; caso de control `G2-correo-activacion` que exige exactamente 1 correo de activación nuevo **en ese log**; la fase 3 se ejecuta solo tras T-16/T-17 (sin log antiguo) |
| H-18 | **Flakiness por límites**: 10 códigos por IP y hora, 3 por usuario y hora, 60 s entre envíos, 60 peticiones por minuto: seis repeticiones darían 429 | Alta | X-11, D-24: fixtures acotados antes de cada registro, usuarios nuevos tras cada limpieza, espera de 61 s antes del reenvío y precomprobación que aborta con `exit 2` si hay ≥ 5 códigos de la IP local en la última hora |
| H-19 | **Comparación enmascarada** por datos variables (códigos, ids, tokens, fechas): o bien nunca coincide, o se «normaliza» tanto que no detecta nada | Alta | D-23 normaliza solo lo variable; AC-T-34 corre dos veces (determinismo) y AC-T-33 incluye un control negativo (con `MENSAJE_409` distinto la comparación **debe** diferir) |
| H-20 | `liberarIp` de `hlt06v2_bateria.sh:15` actualiza **todas** las filas de `sgen_verificacion` (incluso de usuarios reales) | Media | D-24: el `UPDATE` se acota a usuarios `^ck_prueba_`; RN-18 compara `md5` de la lista de usuarios reales al inicio y al final |
| H-21 | G-3 «aviso `registro-omitido` en local» pasa en vacío si `APP_ENTORNO` no es `local` (el aviso no se escribe) | Media | AC-T-33: `grep -c '^APP_ENTORNO=local$' rest_usuario/.env` = 1 (solo esa clave, sin abrir el resto, RI-A4) y control de que el archivo nuevo aparece en `dirname "$LOG_CORREOS"` |
| H-22 | `registro-omitido-*.txt` cambia de carpeta en T-14 | Media | D-22: la batería busca en `dirname "$LOG_CORREOS"`; se cuenta con `find -newer` sobre una marca temporal, sin depender de la ruta |
| H-23 | Ejecutar la fase 1 sobre el `HEAD` roto de T-07…T-10 | Media | D-25: la fase 1 depende de T-11; R-02 |
| H-24 | Se interpreta mal una respuesta inesperada de login/`crearSinPago` | Media | La batería no asume mensajes que la línea base no haya visto: registra `código cuerpo` y la comparación es contra la línea base, además de `chk` para lo que la HU fija (200, 409, situación `P`/`A`) |
| H-25 | La batería deja `correo-*.txt` y `registro-omitido-*.txt` en `logs/` | Baja | Son locales y no versionados (RN-08); no se borran (el contenido de la línea base queda en la evidencia) |
| H-26 | G-02 no es automatizable y puede quedar sin ejecutar | Media | D-27: `PARCIAL` explícito; la batería G-5 por `curl` cubre G-01; T-40 es la puerta de G-02 |

### Riesgos (severidad y mitigación)

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-01 | `require` roto en un camino poco usado → 500 | **Alta** | H-1 |
| R-02 | `HEAD` intermedio no ejecutable entre T-07 y T-11 | Media | D-15; nada se despliega entre ambos commits |
| R-03 | Carpeta/archivo expuestos por web | **Alta** | H-4 |
| R-04 | Código de verificación en logs de error | **Alta** | H-5; el código solo en `logs/correos/` (modo `log`, prohibido fuera de local, `Configuracion.php:266-267`) |
| R-05 | Scripts con ruta vieja dan falsos positivos | **Alta** | H-6 |
| R-06 | Pérdida de historial git | Media | H-7 |
| R-07 | Regresión de tiempos P-02/P-23 | Media | No se toca `BaseCtrl`; `mkdir`/`is_dir` solo en modo `log`; se mide en T-28 |
| R-08 | Conflicto con pruebas manuales de HU-001 pendientes | Baja | Precondición de la HU; T-01 pide confirmación del usuario de que se cerraron o de que se ejecuta igual |
| R-09 | Baterías largas (esperas de 60 s, 5+5 peticiones de 2 s) | Baja | Ejecutar en segundo plano con timeout de 10 min por script |
| R-10 **(v2)** | La batería G modifica filas reales por un fixture demasiado amplio | Media | H-20, RN-18 |
| R-11 **(v2)** | La batería G da OK en vacío (log equivocado, flujo no ejecutado) y deja pasar una regresión | **Alta** | H-17, H-19, H-21; casos de control con conteo exacto; control negativo |
| R-12 **(v2)** | Límites por IP/usuario/minuto hacen intermitente la batería | Media | H-18, X-11 |
| R-13 **(v2)** | Seis corridas de la batería (≈ 3 min cada una por la espera de 61 s y las esperas de 2 s) alargan la ejecución | Baja | Segundo plano, timeout de 10 min por corrida; no se omite ninguna fase (D-25) |

### Veredicto

**APROBADO (v2).** Ronda 1 de la v1: `APROBADO CON CAMBIOS` con los hallazgos H-1…H-16 (de ellos 6 de severidad Alta: H-1, H-3, H-4, H-5, H-6, H-15); todos se incorporaron al plan (T-11, T-14, T-17, T-30, T-31 y las decisiones D-07, D-10, D-12, D-13, D-15, D-16, D-18). Ronda 2: sin cambios pendientes; el HLT es ejecutable sin decisiones de diseño y la restricción «sin cambio de comportamiento» queda protegida por comprobaciones antes/después (plantillas byte a byte, baterías, curl, tiempos).

**Ronda 3 (adición de G-01 y G-02 en esta v2):** `APROBADO CON CAMBIOS` con los hallazgos H-17…H-26 (3 de severidad Alta: H-17 falso positivo por log equivocado, H-18 límites por IP/usuario/minuto, H-19 comparación enmascarada o inestable). Todos se incorporaron: RN-16…RN-22, D-21…D-27, T-33…T-41, la ampliación de AC-T-01 y la normalización con control negativo de AC-T-33/AC-T-34. **Ronda 4** (sobre el texto corregido): sin cambios pendientes. Comprobado en la ronda: (a) las tareas nuevas no alteran las dependencias de las 32 anteriores salvo T-07 (ahora espera a T-34) y T-32 (espera a T-41); (b) no hay dos corridas de la batería G simultáneas ni solapadas con las de HU-001; (c) la batería G se ejecuta en cada fase que toca `rest_usuario` (fases 1 a 4) y en la no regresión final; (d) la fase 1 no se ejecuta sobre el `HEAD` roto de T-07…T-10; (e) G-4 se conserva con el mensaje actual y HLT-14 lo cambia con su propia actualización; (f) el único punto que no se puede automatizar, G-02, queda como puerta explícita (T-40) con estado global `PARCIAL` si el usuario no la ejecuta. Sin marcadores pendientes. La v1 queda como historial.

---

## H7 · Plan de tareas

Evidencias de este HLT: `docs/Planificacion/evidencias/correo-A/` (la crea T-01). `PHP=/c/xampp/php/php.exe`, `MYSQL=/c/xampp/mysql/bin/mysql.exe -u root`. Todas las rutas son relativas a `C:\xampp\htdocs\criterio_kelly` y los comandos son Bash (Git Bash). Los números de línea citados son los del **estado inicial**; tras T-09 los controladores bajan 1 línea (dos `require_once` pasan a uno) y T-12 usa el texto de la línea, no el número.

### H7.1 Tabla de tareas

| ID | Agente | Tarea | Archivos | Depende de | Criterio de aceptación (comando en H7.2) | Cubre |
|----|--------|-------|----------|------------|------------------------------------------|-------|
| T-01 | desarrollador-php | Verificar precondiciones y crear la carpeta de evidencias | `docs/Planificacion/evidencias/correo-A/` (nueva) | — | AC-T-01 | R-08, D-14, D-16, D-19, X-11 |
| T-02 | desarrollador-php | Crear `capturar_plantillas.php` y capturar las 4 plantillas (asunto y cuerpo) con datos fijos, con control negativo | `docs/Planificacion/evidencias/correo-A/capturar_plantillas.php` (nuevo), `…/linea_base/plantillas/` | T-01 | AC-T-02 | B-01, RN-01 |
| T-03 | desarrollador-php | Capturar la línea base del formato de envío en modo `log` con `probarCorreo.php` | `…/linea_base/envio/` | T-01 | AC-T-03 | B-02, B-03 |
| T-04 | desarrollador-php | Capturar la línea base de `curl` (C-01) a rutas internas | `…/linea_base/curl_c01.txt` | T-01 | AC-T-04 | C-01, RN-06 |
| T-05 | desarrollador-php | Ejecutar y guardar las baterías de línea base `hlt06_bateria.sh`, `hlt06v2_bateria.sh` y `hlt03_matriz.sh` (incluyen P-02 y P-23) | `docs/Planificacion/evidencias/correo-A/linea_base/hlt06.txt`, `hlt06v2.txt`, `hlt03.txt` | T-01 | AC-T-05 | C-02, C-03, B-05, E-01 |
| T-06 | desarrollador-php | Crear `flujo_correo.sh` (registro → código → activar → login; recuperación → restablecer; cambio de clave) y capturar su línea base | `…/correo-A/flujo_correo.sh` (nuevo), `…/linea_base/flujo.txt` | T-01 | AC-T-06 | E-02, E-03 |
| T-07 | desarrollador-php | Crear `rest_usuario/correo/` y mover con `git mv` los 3 archivos en un commit sin cambios de contenido (C1) | `rest_usuario/servicios/EnviadorCorreo.php`, `rest_usuario/servicios/PlantillasCorreo.php`, `rest_usuario/mantenimiento/probarCorreo.php` → `rest_usuario/correo/` | T-02…T-06, T-34 | AC-T-07 | A-02, A-03, A-07, RN-11 |
| T-08 | desarrollador-php | Crear `correo/cargarCorreo.php` | `rest_usuario/correo/cargarCorreo.php` (nuevo) | T-07 | AC-T-08 | A-01, A-04, D-05, D-07 |
| T-09 | desarrollador-php | Sustituir los dos `require_once` por uno en los 3 controladores | `rest_usuario/controladores/PersonaCtrl.php:9-10`, `ClaveCtrl.php:11-12`, `VerificacionCtrl.php:9-10` | T-08 | AC-T-09 | A-04, RN-10 |
| T-10 | desarrollador-php | Sustituir los `require` en `limpiarSeguridad.php` y en `correo/probarCorreo.php` y corregir su texto de uso | `rest_usuario/mantenimiento/limpiarSeguridad.php:19-20`, `rest_usuario/correo/probarCorreo.php:6,13,21-22` | T-08 | AC-T-10 | A-04, A-06, RN-10 |
| T-11 | desarrollador-php | Verificar la carga en los 5 archivos (rutas, `php -l`, `curl`, mantenimiento) y hacer el commit C2 | los 5 archivos de T-09/T-10 y `correo/cargarCorreo.php` | T-09, T-10 | AC-T-11 | A-04, B-04, B-05, E-04 |
| T-12 | desarrollador-php | Añadir `// [CORREO] <plantilla>` en los 5 puntos de llamada y hacer el commit C3 | `rest_usuario/controladores/PersonaCtrl.php:161`, `ClaveCtrl.php:58`, `ClaveCtrl.php:191`, `VerificacionCtrl.php:105`, `rest_usuario/servicios/AlertasSeguridad.php:35` | T-11 | AC-T-12 | A-05, RN-09 |
| T-13 | desarrollador-php | Añadir `EnviadorCorreo::carpetaRegistros()` y usarla en `guardarComoArchivo` y en `enviar` (modo `log`); ajustar el texto de `probarCorreo.php` | `rest_usuario/correo/EnviadorCorreo.php:19,44`, `rest_usuario/correo/probarCorreo.php:28` | T-12 | AC-T-13 | B-02, B-03, C-04 |
| T-14 | desarrollador-php | Ajustar `PersonaCtrl::avisarRegistroOmitidoEnLocal` para escribir en `logs/correos/` sin cambiar su silencio ante fallos; commit C4 (junto con T-13) | `rest_usuario/controladores/PersonaCtrl.php:167-176` | T-13 | AC-T-14 | B-03, B-04 |
| T-15 | desarrollador-php | Demostrar que `.gitignore` ya excluye `logs/correos/` (sin modificarlo) | `rest_usuario/.gitignore:3` (solo lectura) | T-14 | AC-T-15 | C-05, RN-08 |
| T-16 | desarrollador-php | Mover a `logs/correos/` los registros locales antiguos (`correos.log`, `correo-*.txt`, `registro-omitido-*.txt`) | `rest_usuario/logs/` (archivos sin versionar) | T-14 | AC-T-16 | B-03, RN-14 |
| T-17 | desarrollador-php | Actualizar `hlt06_bateria.sh` y `hlt06v2_bateria.sh` a `logs/correos/correos.log` con guardas anti falso positivo | `docs/Planificacion/evidencias/hlt06_bateria.sh:2,6`, `docs/Planificacion/evidencias/hlt06v2_bateria.sh:2,5` | T-16 | AC-T-17 | E-01, RN-14 |
| T-18 | desarrollador-php | Actualizar la ruta del log en las pruebas manuales de HU-001 | `docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-001.md:10,19` | T-16 | AC-T-18 | E-01 |
| T-19 | desarrollador-php | Reagrupar las claves de correo en `.env.ejemplo` bajo `# ===== Correo =====` y hacer el commit C5 | `rest_usuario/.env.ejemplo:22-34` | T-14 | AC-T-19 | A (config), C-06, D-16 |
| T-20 | desarrollador-php | Crear `correo/README.md` con el mapa de los 5 puntos de llamada | `rest_usuario/correo/README.md` (nuevo) | T-12, T-13, T-14, T-19 | AC-T-20 | A-01, A-05, RN-09 |
| T-21 | desarrollador-php | Actualizar `rest_usuario/README.md` (estructura, ruta de logs, prueba de correo) y hacer el commit C6 con T-20 | `rest_usuario/README.md:8,12-35,79,108,239` | T-20 | AC-T-21 | D-03, RN-15 |
| T-22 | desarrollador-php | Declarar «no envía correo» en `rest_criteriokelly/README.md` y commit | `rest_criteriokelly/README.md:5` | T-20 | AC-T-22 | D-01 |
| T-23 | desarrollador-php | Declarar «no envía correo» en `rest_suscripcion/README.md` y commit | `rest_suscripcion/README.md:3` | T-20 | AC-T-23 | D-01 |
| T-24 | desarrollador-php | Declarar «no envía correo» en `rest_divisas/README.md` (sin git) | `rest_divisas/README.md:5` | T-20 | AC-T-24 | D-01 |
| T-25 | desarrollador-ionic | Listar en `criterioKellyApp/README.md` las pantallas, stores y servicios que disparan correos del backend y commit | `criterioKellyApp/README.md` (nueva sección tras «Servicios backend», `:34-46`) | T-20 | AC-T-25 | D-02, E-04 |
| T-26 | desarrollador-php | Describir la convención en el `CLAUDE.md` de la raíz | `CLAUDE.md` (lista «Conventions») | T-20 | AC-T-26 | D-03 |
| T-27 | desarrollador-php | Describir la convención en `.claude/agents/desarrollador-php.md` | `.claude/agents/desarrollador-php.md` (sección nueva antes de «## Nombres», `:94`) | T-20 | AC-T-27 | D-03 |
| T-28 | desarrollador-php | Repetir las baterías (hlt06, hlt06v2, hlt03) y comparar con la línea base, incluidos P-02 y P-23 | `…/correo-A/despues/hlt06.txt`, `hlt06v2.txt`, `hlt03.txt` | T-17, T-21…T-27 | AC-T-28 | B-04, B-05, C-02, C-03, E-01 |
| T-29 | desarrollador-php | Comparar byte a byte las plantillas y el formato de envío, y probar `correo/probarCorreo.php` | `…/correo-A/despues/plantillas/`, `…/despues/envio/` | T-28 | AC-T-29 | A-06, B-01, B-02, B-03 |
| T-30 | desarrollador-php | Repetir `curl` de C-01 contra `correo/` y `logs/correos/` | `…/correo-A/despues/curl_c01.txt` | T-28 | AC-T-30 | C-01, RN-06 |
| T-31 | desarrollador-php | Repetir `flujo_correo.sh`, comprobar logs de error y exclusión de git | `…/correo-A/despues/flujo.txt` | T-28 | AC-T-31 | E-02, E-03, C-04, C-05 |
| T-32 | desarrollador-php | Verificación global estática: A-01…A-05, `php -l`, referencias a rutas viejas, C-06, historial git | `rest_usuario/**/*.php` (solo lectura) | T-29, T-30, T-31, T-25, T-41 | AC-T-32 | A, C-06, E-04 |
| T-33 **(v2)** | desarrollador-php | Crear la batería `hu003_flujos_cuenta.sh` y sus ayudas `lib/hu003_comun.sh` (flujos G-1…G-5 con salida `NORM`, limpieza y guardas) y validarla con controles | `docs/Planificacion/evidencias/hu003_flujos_cuenta.sh` (nuevo), `docs/Planificacion/evidencias/lib/hu003_comun.sh` (nuevo) | T-01, T-06 | AC-T-33 | G-01, RN-16, RN-18, RN-19, RN-20, RN-22 |
| T-34 **(v2)** | desarrollador-php | Capturar la **línea base G** con el código sin tocar, corriendo la batería dos veces y comprobando que su salida normalizada es idéntica | `docs/Planificacion/evidencias/correo-A/linea_base/g_flujos_1.txt`, `g_flujos_2.txt` | T-33 | AC-T-34 | G-01, RN-16, RN-17 |
| T-35 **(v2)** | desarrollador-php | **Fase 1 (movimiento y carga única):** repetir la batería G y exigir resultado idéntico | `…/correo-A/despues/fase1_g.txt` | T-11, T-34 | AC-T-35 | G-01, RN-16 |
| T-36 **(v2)** | desarrollador-php | **Fase 2 (marcas `[CORREO]`):** repetir la batería G y exigir resultado idéntico | `…/correo-A/despues/fase2_g.txt` | T-12, T-35 | AC-T-36 | G-01, RN-16 |
| T-37 **(v2)** | desarrollador-php | **Fase 3 (registros en `logs/correos/`):** repetir la batería G con `LOG_CORREOS` de la ruta nueva y exigir resultado idéntico | `…/correo-A/despues/fase3_g.txt` | T-14, T-16, T-17, T-36 | AC-T-37 | G-01, RN-16, RN-19 |
| T-38 **(v2)** | desarrollador-php | **Fase 4 (configuración y documentación de `rest_usuario`):** repetir la batería G y exigir resultado idéntico | `…/correo-A/despues/fase4_g.txt` | T-21, T-37 | AC-T-38 | G-01, RN-16 |
| T-39 **(v2)** | desarrollador-php | Redactar `PRUEBAS-MANUALES-HU-003.md` con el paso de prueba manual **G-02** (registro en la app con un plan de pago → activación → primer login → `crearSinPago` con ese plan) y sus consultas de verificación | `docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md` (nuevo) | T-34 | AC-T-39 | G-02, RN-21 |
| T-40 **(v2)** | desarrollador-php | **Puerta G-02:** el usuario ejecuta la prueba manual; el agente verifica en la base de datos el resultado y lo anota. Queda `BLOQUEADA` hasta que el usuario confirme que la ejecutó | `docs/Planificacion/evidencias/correo-A/despues/g02_verificacion.txt` | T-38, T-39 | AC-T-40 | G-02, RN-21 |
| T-41 **(v2)** | desarrollador-php | **No regresión final G:** repetir la batería G tras T-31 y comparar con la línea base; repetir además la batería con la variable `MENSAJE_409` alterada como control negativo | `…/correo-A/despues/final_g.txt` | T-31, T-38 | AC-T-41 | G-01, RN-16 |

**Resumen (v2):** 41 tareas: **40 `desarrollador-php`** y **1 `desarrollador-ionic`** (T-25). Las 9 tareas nuevas (T-33…T-41) son todas `desarrollador-php`. Camino crítico: T-01 → T-06 → T-33 → T-34 → T-07 → T-08 → T-09/T-10 → T-11 → T-35 → T-12 → T-36 → T-13 → T-14 → T-16 → T-17 → T-37 → T-21 → T-38 → T-28 → T-29…T-31 → T-41 → T-32. Paralelizables sin riesgo (marcadas, RS-3): T-02…T-06 entre sí (T-33 espera a T-06 porque su comprobación usa la misma base, el mismo log y los mismos límites); T-22, T-23, T-24, T-25, T-26, T-27 entre sí; T-29, T-30, T-31 entre sí; T-39 con T-07…T-38. **No** se ejecutan en paralelo dos corridas de la batería G (comparten usuarios, límites y el log) ni una corrida G con una batería de HU-001. T-40 no bloquea T-32; si queda `BLOQUEADA`, el estado global es `PARCIAL` (D-27).

**Orden de ejecución con la batería G (v2).**

```
T-01 → T-02…T-06 → T-33 → T-34 ┐
                              └→ T-07 → T-08 → T-09/T-10 → T-11 → T-35 (fase 1) → T-12 → T-36 (fase 2)
   → T-13 → T-14 → T-16 → T-17 → T-37 (fase 3, ruta nueva) → T-19 → T-20 → T-21 → T-38 (fase 4)
   → T-22…T-27 → T-28 → T-29, T-30, T-31 → T-41 (final) → T-32
T-34 → T-39 → (el usuario ejecuta G-02) → T-40
```

### H7.2 Comandos de aceptación

Todos desde `C:\xampp\htdocs\criterio_kelly` salvo indicación. `E=docs/Planificacion/evidencias/correo-A`.

**AC-T-01**
```bash
test "$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://localhost/criterio_kelly/rest_usuario/)" != 000 && echo apache_ok   # cualquier código HTTP distinto de 000
/c/xampp/mysql/bin/mysql.exe -u root -N -e "SELECT 1" && echo mysql_ok            # si no responden, iniciar Apache y MySQL desde el panel de XAMPP
git -C rest_usuario status --short                                                 # vacío (si no, parar y avisar)
grep -c '^CORREO_MODO=log$' rest_usuario/.env                                       # 1 (solo esa clave; no abrir el resto del .env)
mkdir -p $E/linea_base $E/despues $E/originales
md5sum rest_usuario/.env > $E/linea_base/env.md5
wc -l rest_usuario/logs/php_errores.log rest_usuario/logs/php_errors.log > $E/linea_base/logs_error_wc.txt
for f in servicios/EnviadorCorreo.php servicios/PlantillasCorreo.php mantenimiento/probarCorreo.php; do echo "$f $(git -C rest_usuario log --follow --oneline $f | wc -l)"; done > $E/linea_base/historial.txt   # esperado 3, 2 y 1
git -C rest_usuario log --oneline | head -1 > $E/linea_base/commit_inicial.txt
```
Además, el agente deja en `$E/linea_base/autorizacion.txt` el texto literal con que el usuario autoriza (a) los commits locales de este HLT (nunca `push`) y (b) la ejecución tras o antes del cierre de las pruebas manuales de HU-001. Sin esa autorización la tarea queda `BLOQUEADA` (RS-4).

**Ampliación v2 de AC-T-01** (precondiciones de la batería G; mismas reglas: si algo falla, la tarea pasa a `BLOQUEADA` y se informa):
```bash
test "$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://localhost/criterio_kelly/rest_suscripcion/)" != 000 && echo suscripcion_ok   # rest_suscripcion responde (G-5)
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT pin_idPlanInterv FROM spsu_planintervalo WHERE pin_idPlanInterv IN (1,6) AND pin_estado='A' ORDER BY 1"   # 1 y 6
grep -c '^APP_ENTORNO=local$' rest_usuario/.env                                      # 1 (el aviso registro-omitido solo se escribe en local; no abrir el resto del .env)
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT COUNT(*) FROM sgen_verificacion WHERE ver_ipSolicitud IN ('127.0.0.1','::1') AND ver_fechaCrea >= NOW() - INTERVAL 1 HOUR"   # < 5 (límite de 10 códigos por IP y hora, VerificacionMdl.php:14)
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT COUNT(*) FROM sgen_usuario WHERE usu_usuario REGEXP '^ck_prueba_'"   # 0 (sin restos; si hay, ejecutar lib/limpiar_datos_prueba.sh)
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT MD5(GROUP_CONCAT(usu_usuario ORDER BY usu_idUsuario)) FROM sgen_usuario WHERE usu_usuario NOT REGEXP '^ck_prueba_'" > $E/linea_base/usuarios_reales.md5   # RN-18: se compara al final de T-34 y de T-41
```

**AC-T-02**
```bash
mkdir -p $E/linea_base/plantillas
/c/xampp/php/php.exe $E/capturar_plantillas.php rest_usuario/servicios/PlantillasCorreo.php $E/linea_base/plantillas
ls $E/linea_base/plantillas | wc -l                                  # 9: 4 .asunto.txt + 4 .cuerpo.txt + SHA256SUMS
cat $E/linea_base/plantillas/SHA256SUMS | wc -l                      # 8
# Control negativo: una plantilla alterada DEBE diferir
T=$(mktemp -d); sed 's/Hola /Hola! /' rest_usuario/servicios/PlantillasCorreo.php > $T/PlantillasCorreo.php
mkdir $T/o && /c/xampp/php/php.exe $E/capturar_plantillas.php $T/PlantillasCorreo.php $T/o
! diff -q $E/linea_base/plantillas/SHA256SUMS $T/o/SHA256SUMS >/dev/null && echo control_negativo_ok
```
Contenido de `capturar_plantillas.php` (CLI, `declare(strict_types=1)`, sale con código 1 si `PHP_SAPI !== 'cli'` o faltan argumentos): hace `require` de `$argv[1]`, y con **datos fijos** escribe, con `file_put_contents` sin añadir saltos de línea, `<plantilla>.asunto.txt` y `<plantilla>.cuerpo.txt` para:
`PlantillasCorreo::codigoRecuperacion('Mar&iacute;a O&#039;Brien &amp; C&iacute;a', '123456')`, `codigoVerificacion('Mar&iacute;a O&#039;Brien &amp; C&iacute;a', '654321')`, `avisoCambioClave('Mar&iacute;a O&#039;Brien &amp; C&iacute;a', '2026-11-11 10:30')`, `alertaSeguridad(['REFRESH_REUTILIZADO' => 4, 'BLOQUEO_IP' => 5, 'ACCESO_DENEGADO' => 3], 'local')`; y por último `SHA256SUMS` con `hash_file('sha256', …)` de los 8 archivos en orden alfabético, formato `<hash>  <archivo>`.

**AC-T-03**
```bash
mkdir -p $E/linea_base/envio && cd rest_usuario && /c/xampp/php/php.exe mantenimiento/probarCorreo.php linea.base@ejemplo.test; echo "salida=$?" ; cd ..
# esperado: "Modo log: el correo se escribió en logs/correos.log, no se envió." y salida=0
N=$(ls -t rest_usuario/logs/correo-*.txt | head -1); cp "$N" $E/linea_base/envio/correo.txt
tail -n 5 rest_usuario/logs/correos.log > $E/linea_base/envio/correos_log_ultimo.txt
# Normalización de fechas para comparar luego:
sed -E 's/^Date: .*/Date: <fecha>/' $E/linea_base/envio/correo.txt > $E/linea_base/envio/correo.norm.txt
grep -c '^To: linea.base@ejemplo.test$' $E/linea_base/envio/correo.norm.txt      # 1
```

**AC-T-04**
```bash
U=http://localhost/criterio_kelly/rest_usuario
for r in servicios/EnviadorCorreo.php servicios/PlantillasCorreo.php mantenimiento/probarCorreo.php logs/correos.log logs/ configuracion/Configuracion.php .env correo/ correo/README.md correo/EnviadorCorreo.php correo/cargarCorreo.php logs/correos/correos.log logs/correos/ ; do
  echo "$r $(curl -s -m 5 -o /dev/null -w '%{http_code}' "$U/$r")"; done > $E/linea_base/curl_c01.txt
echo "doble-barra $(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://localhost/criterio_kelly//rest_usuario/servicios/EnviadorCorreo.php")" >> $E/linea_base/curl_c01.txt
awk '{ if ($2!=403 && $2!=404) bad=1 } END { exit bad }' $E/linea_base/curl_c01.txt && echo todos_403_404
```
Si alguna ruta devolviera otro código, la tarea pasa a `BLOQUEADA` y se informa (sería una exposición previa, fuera de este HLT).

**AC-T-05** (cada script en segundo plano, `timeout` 600000 ms; ejecutar `docs/Planificacion/evidencias/lib/limpiar_datos_prueba.sh` antes de cada uno)
```bash
cd docs/Planificacion/evidencias
bash lib/limpiar_datos_prueba.sh
bash hlt06_bateria.sh   > correo-A/linea_base/hlt06.txt   2>&1
bash lib/limpiar_datos_prueba.sh
bash hlt06v2_bateria.sh > correo-A/linea_base/hlt06v2.txt 2>&1
bash lib/limpiar_datos_prueba.sh
bash hlt03_matriz.sh    > correo-A/linea_base/hlt03.txt   2>&1
bash lib/limpiar_datos_prueba.sh
for f in hlt06 hlt06v2 hlt03; do echo "$f OK=$(grep -c '^OK ' correo-A/linea_base/$f.txt) FALLO=$(grep -c '^FALLO ' correo-A/linea_base/$f.txt)"; done | tee correo-A/linea_base/resumen_baterias.txt
grep -E '^(OK|FALLO) ' correo-A/linea_base/hlt06.txt | grep -E 'P-02|P-03|P-19' ; grep -E 'P23|P02v1' correo-A/linea_base/hlt06v2.txt
```
Esperado: están presentes `P-02` (hlt06) y `P23-tiempos-ge2`, `P23-medianas-dif-lt-0.3`, `P02v1-*` (hlt06v2). Cualquier `FALLO` previo se anota en `resumen_baterias.txt` como preexistente (H-9); no se corrige aquí.

**AC-T-06**: `flujo_correo.sh` (Bash, `cd "$(dirname "$0")/.."; source lib/comun.sh`; usa `$LOG` de la variable de entorno `LOG_CORREOS`, por defecto `../../../rest_usuario/logs/correos.log`, y falla con `exit 2` si el archivo no existe). Usa el usuario `ck_prueba_corr`, correo `ck_prueba_corr@ejemplo.test`, teléfono `0990009001`, clave `Cielo-Rojo-Montana-77`, y los helpers `pet`/`sesion` de `lib/comun.sh`. Pasos y comprobaciones (cada una con `chk`):
1. `POST persona/agregar` → `200` con `Registro recibido`; el último `Asunto: Código para activar tu cuenta - Criterio Kelly` del log y un código de 6 dígitos (`es: [0-9]{6}`).
2. `POST persona/reenviarCodigo` → `200` y un correo `Código para activar tu cuenta` nuevo (el reenvío espera ≥ 60 s desde el anterior: el script espera con `sleep` lo necesario).
3. `POST persona/activar {correo, codigo}` con el último código → `200 {"success":"ok"}`.
4. `sesion ck_prueba_corr <clave>` → contiene `accessToken`.
5. `POST autenticacion/solicitarRecuperacion` → `200`; correo `Código para restablecer tu clave - Criterio Kelly`.
6. `POST autenticacion/restablecerClave {correo, codigo, claveNueva:'Selva-Azul-Torrente-88'}` → `200`; correo `Tu clave fue cambiada - Criterio Kelly` (disparador 1 del aviso).
7. Login con la clave nueva y `PUT autenticacion/actualizarClave {claveActual, claveNueva:'Luna-Gris-Cascada-55'}` con `Authorization: Bearer` → `200`; segundo correo `Tu clave fue cambiada` (disparador 2).
8. Conteo final de asuntos distintos en el log para `ck_prueba_corr@ejemplo.test` (`grep -A6`), esperado: 2 de activación, 1 de recuperación, 2 de aviso.
9. Imprime también cuántos `correo-*.txt` hay en la carpeta de registros (informativo).
Termina llamando a `lib/limpiar_datos_prueba.sh`. Línea base: `bash $E/flujo_correo.sh > $E/linea_base/flujo.txt` con `FALLO=0` (`grep -c '^FALLO ' = 0`).

**AC-T-07**
```bash
cd rest_usuario && mkdir correo
git mv servicios/EnviadorCorreo.php correo/EnviadorCorreo.php
git mv servicios/PlantillasCorreo.php correo/PlantillasCorreo.php
git mv mantenimiento/probarCorreo.php correo/probarCorreo.php
git commit -m "Refactor: HU-003 mover el correo a correo/ (solo movimiento, sin cambios de contenido)"   # C1
git show --stat -M --format=%s HEAD | grep -c 'rename'                 # 3; y: git show -M --name-status HEAD  →  3 líneas "R100"
for f in correo/EnviadorCorreo.php correo/PlantillasCorreo.php correo/probarCorreo.php; do echo "$f $(git log --follow --oneline $f | wc -l)"; done   # ≥ 3, 2 y 1 (+1 del commit nuevo: 4, 3, 2)
test ! -e servicios/EnviadorCorreo.php && test ! -e servicios/PlantillasCorreo.php && test ! -e mantenimiento/probarCorreo.php && echo viejos_eliminados
```
`git mv` exige que `correo/` exista; las carpetas vacías no se versionan, no hace falta `.gitkeep`.

**AC-T-08** — contenido exacto de `rest_usuario/correo/cargarCorreo.php` (LF):
```php
<?php

declare(strict_types=1);

// Punto único de carga del módulo de correo (HU-003). Los archivos que envían correo hacen un solo
// require_once de este archivo. Depende de que el arranque (index.php o el script CLI) ya haya cargado
// vendor/autoload.php (PHPMailer) y configuracion/Configuracion.php: no los carga aquí para no
// duplicar Composer cuando RUTA_APLICACION apunta a otra ruta.
require_once __DIR__ . '/PlantillasCorreo.php';
require_once __DIR__ . '/EnviadorCorreo.php';
```
```bash
/c/xampp/php/php.exe -l rest_usuario/correo/cargarCorreo.php
/c/xampp/php/php.exe -r 'require "rest_usuario/vendor/autoload.php"; require "rest_usuario/correo/cargarCorreo.php"; echo class_exists("EnviadorCorreo") && class_exists("PlantillasCorreo") ? "carga_ok\n" : "FALLO\n";'
grep -c '\[CORREO\]' rest_usuario/correo/cargarCorreo.php        # 0
```

**AC-T-09** — en cada uno de los 3 controladores, sustituir exactamente las dos líneas (cada una con la terminación de línea del archivo)
```php
require_once __DIR__ . '/../servicios/PlantillasCorreo.php';
require_once __DIR__ . '/../servicios/EnviadorCorreo.php';
```
por la única línea
```php
require_once __DIR__ . '/../correo/cargarCorreo.php';
```
```bash
cd rest_usuario
for f in PersonaCtrl ClaveCtrl VerificacionCtrl; do /c/xampp/php/php.exe -l controladores/$f.php; git diff --numstat controladores/$f.php; done   # cada uno: 1 añadida, 2 eliminadas
grep -c "correo/cargarCorreo.php" controladores/PersonaCtrl.php controladores/ClaveCtrl.php controladores/VerificacionCtrl.php   # 1 cada uno
```

**AC-T-10** — `limpiarSeguridad.php:19-20` pasan a la línea `    require $rutaAplicacion . '/correo/cargarCorreo.php';` (misma sangría). `correo/probarCorreo.php`: línea 6 `// Uso: C:\xampp\php\php.exe correo/probarCorreo.php destino@correo.com`; línea 13 `"Uso: php correo/probarCorreo.php destino@correo.com\n"`; líneas 21-22 pasan a `    require $rutaAplicacion . '/correo/cargarCorreo.php';`. `$rutaAplicacion = dirname(__DIR__)` (línea 17) **no cambia**: desde `correo/` sigue siendo la raíz del proyecto.
```bash
cd rest_usuario
/c/xampp/php/php.exe -l mantenimiento/limpiarSeguridad.php && /c/xampp/php/php.exe -l correo/probarCorreo.php
git diff --numstat mantenimiento/limpiarSeguridad.php correo/probarCorreo.php   # 1+/2- y 3+/4-  (probarCorreo: 3 líneas cambiadas en 6, 13 y 21-22)
grep -rn "servicios/EnviadorCorreo\|servicios/PlantillasCorreo\|mantenimiento/probarCorreo" . --include=*.php --exclude-dir=vendor   # sin resultados
```

**AC-T-11**
```bash
cd rest_usuario
# 1) Cada require resuelve a un archivo existente, en los 5 archivos
for f in controladores/PersonaCtrl.php controladores/ClaveCtrl.php controladores/VerificacionCtrl.php mantenimiento/limpiarSeguridad.php correo/probarCorreo.php; do
  d=$(dirname $f)
  grep -oE "(__DIR__|\\\$rutaAplicacion) \. '[^']+'" $f | while read -r m; do
    r=$(echo "$m" | sed -E "s/.*'([^']+)'/\1/"); case "$m" in __DIR__*) p="$d$r";; *) p=".$r";; esac
    test -f "$p" && echo "ok $f $p" || echo "FALLO $f $p"; done; done | grep -c FALLO     # 0
# 2) Sintaxis
for f in controladores/PersonaCtrl.php controladores/ClaveCtrl.php controladores/VerificacionCtrl.php mantenimiento/limpiarSeguridad.php correo/*.php servicios/AlertasSeguridad.php; do /c/xampp/php/php.exe -l $f; done | grep -vc 'No syntax errors'   # 0
# 3) curl real a los 4 caminos que envían (rutas y cuerpos de lib/comun.sh y README.md:134,148-150; cabeceras de lib/comun.sh)
U=http://localhost/criterio_kelly/rest_usuario; H='-H Content-Type:application/json -H X-Requested-With:CriterioKelly -H Origin:http://localhost:8100'
curl -s -w ' %{http_code}\n' $H -X POST $U/autenticacion/solicitarRecuperacion -d '{"correo":"no.existe.hu003@ejemplo.test"}'   # {"mensaje":"..."} 200
curl -s -w ' %{http_code}\n' $H -X POST $U/persona/reenviarCodigo -d '{"correo":"no.existe.hu003@ejemplo.test"}'                 # {"mensaje":"..."} 200
curl -s -w ' %{http_code}\n' $H -X POST $U/persona/agregar -d '{"x":1}'                                                          # 400 (carga PersonaCtrl sin error 500)
curl -s -w ' %{http_code}\n' $H -X POST $U/autenticacion/restablecerClave -d '{"correo":"no.existe.hu003@ejemplo.test","codigo":"000000","claveNueva":"Cielo-Rojo-Montana-77"}'   # 400 (carga ClaveCtrl)
# 4) Mantenimiento real (exit 0, sin Fatal)
/c/xampp/php/php.exe mantenimiento/limpiarSeguridad.php; echo "exit=$?"     # una línea "sesiones=… Alerta: …" y exit=0
# 5) Prueba de envío (aún escribe en logs/, ver T-13)
/c/xampp/php/php.exe correo/probarCorreo.php a.b@ejemplo.test; echo "exit=$?"   # exit=0
git add -A . && git commit -m "Refactor: HU-003 cargar el módulo de correo con un solo require"   # C2
```
Los 3 primeros `curl` no deben devolver 500 ni contener `Fatal`/`Failed opening`. Tras la prueba, revisar `tail -n 5 logs/php_errores.log` sin `require`/`Failed opening`.

**AC-T-12** — añadir al final de la línea (separado por un espacio), sin tocar nada más:
- `PersonaCtrl.php:161` → `            $this->enviador->enviar($correo, PlantillasCorreo::codigoVerificacion($nombres, $codigo)); // [CORREO] codigoVerificacion`
- `ClaveCtrl.php:58` → `                        $this->enviador->enviar( // [CORREO] codigoRecuperacion`
- `ClaveCtrl.php:191` → `            $this->enviador->enviar($correo, PlantillasCorreo::avisoCambioClave($nombres, date('Y-m-d H:i'))); // [CORREO] avisoCambioClave`
- `VerificacionCtrl.php:105` → `                        $this->enviador->enviar( // [CORREO] codigoVerificacion`
- `AlertasSeguridad.php:35` → `        $this->enviador->enviar(Configuracion::obtener('CORREO_ALERTAS'), $plantilla); // [CORREO] alertaSeguridad`
```bash
cd rest_usuario
grep -rn "\[CORREO\]" . --include=*.php --exclude-dir=vendor | wc -l          # 5
grep -rn "\[CORREO\]" . --include=*.php --exclude-dir=vendor | grep -v "enviador->enviar" | wc -l   # 0
for f in controladores/PersonaCtrl.php controladores/ClaveCtrl.php controladores/VerificacionCtrl.php servicios/AlertasSeguridad.php; do /c/xampp/php/php.exe -l $f; git diff --numstat $f; done   # cada archivo: 1 línea cambiada por marca (ClaveCtrl: 2)
grep -c "enviar" correo/probarCorreo.php; grep -c '\[CORREO\]' correo/probarCorreo.php           # >0 ; 0
git add -A . && git commit -m "Refactor: HU-003 marcar con [CORREO] los puntos de envío"   # C3
```

**AC-T-13** — cambios exactos en `correo/EnviadorCorreo.php` (terminación CRLF):
1. Añadir tras la constante `TIEMPO_ESPERA_SMTP_SEGUNDOS` (línea 10) la constante `public const SUBCARPETA_REGISTROS = 'correos';` y, antes de `guardarComoArchivo`, el método:
```php
    /**
     * Carpeta de los registros de correo de local (logs/correos/). Se crea bajo demanda: solo se
     * invoca en modo log, que está prohibido fuera de local.
     */
    public static function carpetaRegistros(): string
    {
        $carpeta = Configuracion::obtener('RUTA_LOGS') . DIRECTORY_SEPARATOR . self::SUBCARPETA_REGISTROS;
        if (!is_dir($carpeta) && !@mkdir($carpeta, 0750, true) && !is_dir($carpeta)) {
            throw new RuntimeException('No se pudo crear la carpeta de registros de correo');
        }

        return $carpeta;
    }
```
2. Línea 19: `$ruta = self::carpetaRegistros() . DIRECTORY_SEPARATOR . $nombreArchivo;` (antes `Configuracion::obtener('RUTA_LOGS') . …`).
3. Línea 44 (dentro de `if (!Configuracion::esProduccion())`): `$ruta = self::carpetaRegistros() . DIRECTORY_SEPARATOR . 'correos.log';`.
4. `correo/probarCorreo.php:28`: texto `"Modo log: el correo se escribió en logs/correos/correos.log, no se envió.\n"`.
Ningún otro cambio (modos, validación, PHPMailer intactos).
```bash
cd rest_usuario
/c/xampp/php/php.exe -l correo/EnviadorCorreo.php && /c/xampp/php/php.exe -l correo/probarCorreo.php
git diff -U0 correo/EnviadorCorreo.php | grep '^[+-]' | grep -v '^+++\|^---' | grep -c 'PHPMailer\|SMTP\|CORREO_MODO\|esProduccion'   # 0 (el diff no toca esas líneas)
git diff --numstat correo/EnviadorCorreo.php     # ≈ 19 añadidas / 2 eliminadas (solo carpetaRegistros y 2 líneas)
/c/xampp/php/php.exe correo/probarCorreo.php b.c@ejemplo.test
ls logs/correos/ && grep -c '^To: b.c@ejemplo.test' logs/correos/correo-*.txt | grep -v ':0' | wc -l   # ≥ 1
tail -n 4 logs/correos/correos.log | grep -c 'Para: b.c@ejemplo.test'                                 # 1
```
(No se hace commit aquí: lo hace T-14 con ambos cambios, C4.)

**AC-T-14** — `PersonaCtrl.php:167-176` queda con el cuerpo:
```php
    private function avisarRegistroOmitidoEnLocal(string $correo): void
    {
        try {
            $carpeta = EnviadorCorreo::carpetaRegistros();
        } catch (Throwable $error) {
            return;
        }
        $ruta = $carpeta . DIRECTORY_SEPARATOR
            . 'registro-omitido-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.txt';
        // … el $contenido y el @file_put_contents(...) NO cambian
```
```bash
cd rest_usuario
/c/xampp/php/php.exe -l controladores/PersonaCtrl.php
git diff -U0 controladores/PersonaCtrl.php | grep '^[+-]' | grep -v '^+++\|^---'   # solo: líneas del try/catch, la variable $carpeta y la línea de $ruta
# Prueba: registro con correo ya existente (camino registro-omitido, requiere un correo existente de prueba)
#   Usar el usuario ck_prueba_corr del flujo (T-06) o crear uno con persona/agregar; luego repetir persona/agregar con el mismo correo y usuario/teléfono nuevos:
#   esperado 200 con el mismo mensaje y un archivo logs/correos/registro-omitido-*.txt nuevo
ls logs/correos/registro-omitido-*.txt | wc -l      # aumenta en 1
git add -A . && git commit -m "Refactor: HU-003 registros de correo de local en logs/correos"   # C4
```
Prueba de silencio ante fallo: `mv logs/correos logs/correos.bak && touch logs/correos` (un archivo con ese nombre impide el `mkdir`), repetir la petición duplicada → **200** (no 500) y `error_log` sin cambios; restaurar (`rm logs/correos && mv logs/correos.bak logs/correos`).

**AC-T-15**
```bash
cd rest_usuario
git check-ignore -v logs/correos/correos.log logs/correos/correo-20260101-000000-aaaaaa.txt logs/correos/registro-omitido-x.txt    # las 3 con ".gitignore:3:/logs/*"
git status --short logs/                                                  # vacío
git diff --quiet .gitignore && echo gitignore_sin_cambios
```

**AC-T-16**
```bash
cd rest_usuario/logs && mkdir -p correos
for f in correos.log correo-*.txt registro-omitido-*.txt; do [ -e "$f" ] && mv "$f" correos/; done
ls correos.log correo-*.txt registro-omitido-*.txt 2>&1 | grep -c 'No such file'     # 3 (no queda ninguno con la ruta vieja)
test -f correos/correos.log && echo log_migrado
```
Si no existiera `correos.log` previo, crear el vacío: `: > correos/correos.log` (lo necesitan las guardas de T-17).

**AC-T-17** — en `hlt06_bateria.sh`: línea 2 (comentario) y línea 6 `LOG="../../../rest_usuario/logs/correos/correos.log"`; en `hlt06v2_bateria.sh`: línea 2 y línea 5 `LOG="../../../rest_usuario/logs/correos/correos.log"`. Insertar inmediatamente después de la definición de `LOG` (y de `source lib/comun.sh`, que va antes) en ambos:
```bash
[ -f "$LOG" ] || { echo "FALLO: no existe $LOG (¿se movió el log de correos?)"; exit 2; }
[ ! -e "$(dirname "$LOG")/../correos.log" ] || { echo "FALLO: existe el log antiguo logs/correos.log; muévelo a logs/correos/"; exit 2; }
```
```bash
cd docs/Planificacion/evidencias
grep -n "logs/correos\.log" *.sh lib/*.sh | wc -l                          # 0
grep -c 'logs/correos/correos.log' hlt06_bateria.sh hlt06v2_bateria.sh      # 1+ cada uno
bash -n hlt06_bateria.sh && bash -n hlt06v2_bateria.sh
# Falso positivo prohibido: con el log movido a otro nombre, el script aborta
mv ../../../rest_usuario/logs/correos/correos.log ../../../rest_usuario/logs/correos/correos.log.tmp
bash hlt06_bateria.sh 2>&1 | head -1; echo "exit=${PIPESTATUS[0]}"          # FALLO: no existe … / exit=2
mv ../../../rest_usuario/logs/correos/correos.log.tmp ../../../rest_usuario/logs/correos/correos.log
```
`hlt03_matriz.sh:224` (`grep -rl -F "$t" ../../../rest_*/logs`) es recursivo y no se modifica; `regresion_endpoints.sh` y `lib/` no leen el log de correos (verificado con `grep -rn "correos" lib *.sh`). **(v2)** `hu003_flujos_cuenta.sh` y `lib/hu003_comun.sh` (T-33) ya existen cuando se ejecuta esta tarea: el `grep` de arriba los incluye y debe seguir dando 0, porque reciben la ruta por `LOG_CORREOS` (D-22); T-17 no los edita.

**AC-T-18**: `PRUEBAS-MANUALES-HU-001.md:10` (`rest_usuario/logs/correos/correos.log`) y `:19` (`correos.log` → `logs/correos/correos.log`).
```bash
grep -n "correos\.log" docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-001.md       # solo apariciones con "logs/correos/correos.log"
grep -c "logs/correos\.log" docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-001.md   # 0
```

**AC-T-19** — reemplazar las líneas 22-34 de `.env.ejemplo` (comentarios y las 9 claves; LF, texto ASCII como el resto del archivo) por:
```
# ===== Correo =====
# CORREO_MODO elige como sale el correo: log, smtp o mail. Mapa del modulo y de quien envia: correo/README.md
#   log:  solo con APP_ENTORNO=local. No envia nada: escribe en logs/correos/ (correos.log y un correo-*.txt por correo).
#   smtp: cuenta SMTP real, local o produccion. Usa SMTP_HOST, SMTP_PUERTO, SMTP_USUARIO, SMTP_CLAVE y SMTP_CIFRADO
#         (Gmail: smtp.gmail.com, 587, tls, contrasena de aplicacion).
#   mail: funcion mail() de PHP; solo en un hosting con servicio de correo propio, y CORREO_REMITENTE debe ser de su dominio.
#         Se ignoran los SMTP_*, pero SMTP_HOST y SMTP_PUERTO deben tener un valor valido.
CORREO_MODO=log
SMTP_HOST=localhost
SMTP_PUERTO=1025
SMTP_USUARIO=
SMTP_CLAVE=
SMTP_CIFRADO=ninguno
CORREO_REMITENTE=no-responder@localhost
CORREO_REMITENTE_NOMBRE="Criterio Kelly"
CORREO_ALERTAS=alertas@ejemplo.test
# ===== Fin de Correo =====
```
`RUTA_CLAVES_COMUNES` (línea 35) queda después, fuera del bloque.
```bash
cd rest_usuario
diff <(git show HEAD:.env.ejemplo | grep -E '^[A-Z_]+=' | sort) <(grep -E '^[A-Z_]+=' .env.ejemplo | sort) && echo claves_y_valores_identicos
grep -c '^# ===== Correo =====$' .env.ejemplo                                   # 1
awk '/^# ===== Correo =====$/{d=1} d&&/^[A-Z_]+=/{n++} /^# ===== Fin de Correo =====$/{d=0} END{print n}' .env.ejemplo   # 9
grep -c "logs/correos.log" .env.ejemplo                                           # 0
md5sum -c ../docs/Planificacion/evidencias/correo-A/linea_base/env.md5            # .env sin cambios: OK
git add .env.ejemplo && git commit -m "Docs: HU-003 bloque Correo en .env.ejemplo"   # C5
```

**AC-T-20** — `rest_usuario/correo/README.md` (LF) con las secciones, en este orden: (1) **Qué es** (módulo de correo de `rest_usuario`; convención para cualquier proyecto que envíe correo: carpeta `correo/` en la raíz con `README.md`, `EnviadorCorreo.php`, `PlantillasCorreo.php`, `cargarCorreo.php`, `probarCorreo.php`; marca `// [CORREO] <plantilla>`; registros en `logs/correos/`; claves bajo `# ===== Correo =====`); (2) **Archivos**; (3) **Modos** (`log`, `smtp`, `mail` y sus reglas de `Configuracion.php`); (4) **Plantillas** (4, con quién las usa); (5) **Mapa de puntos de llamada** (tabla `Archivo | Línea | Plantilla | Si el envío falla`, 5 filas, con los números de línea **reales** obtenidos con `grep -rn "\[CORREO\]"`; el aviso de cambio de clave indica sus dos disparadores `ClaveCtrl::restablecerClave` y `ClaveCtrl::actualizarClave`; fila aparte «no es punto de producción»: `correo/probarCorreo.php`); (6) **Registros de local** (`logs/correos/correos.log`, `correo-AAAAMMDD-HHMMSS-xxxxxx.txt`, `registro-omitido-AAAAMMDD-HHMMSS-xxxxxx.txt`; se crea bajo demanda; no versionada; no accesible por web; nunca códigos en `php_errores.log`); (7) **Configuración** (las 9 claves, y la **instrucción para el `.env` local**: «si quieres, mueve a mano tus 9 claves de correo juntas bajo un encabezado `# ===== Correo =====`; el orden no afecta porque `Configuracion` las lee por nombre; nadie debe pegar valores de `.env` en este archivo ni en el repositorio»); (8) **Cómo probar** (`C:\xampp\php\php.exe correo/probarCorreo.php destino@correo`, desde la raíz de `rest_usuario`); (9) **Seguridad** (la lista blanca de `.htaccess` impide acceder por web; `AlertasSeguridad.php` y `AlertasSeguridadMdl.php` no se mueven por ser lógica de seguridad; tiempos uniformes; el módulo no carga `vendor/autoload.php`); (10) **Lo que se conserva y por qué** (las validaciones de claves de correo en la copia compartida de `Configuracion.php` de los backends que no envían correo se conservan para mantener la copia compartida; el modo `mail` se conserva hasta HLT-11); (11) **Alternativa aplazada** (microservicio `rest_correo`, con las condiciones de la HU).
```bash
cd rest_usuario
# La tabla coincide línea por línea con las marcas reales
grep -rn "\[CORREO\]" . --include=*.php --exclude-dir=vendor | sed -E 's#^\./([^:]+):([0-9]+):.*\[CORREO\] ([A-Za-z]+)$#\1 \2 \3#' | sort > /tmp/marcas.txt
wc -l < /tmp/marcas.txt                                                           # 5
while read -r a n p; do grep -q "$a" correo/README.md && grep -q "| *$n *|" correo/README.md && grep -q "$p" correo/README.md && echo "ok $a:$n" || echo "FALLO $a:$n"; done < /tmp/marcas.txt | grep -c FALLO   # 0
grep -n "^## " correo/README.md | wc -l                                           # 11
grep -c "logs/correos\.log" correo/README.md                                       # 0 (solo logs/correos/correos.log)
grep -c '\[CORREO\]' correo/*.php                                                  # todos 0 (la marca solo vive en el .md y en los 5 puntos)
```

**AC-T-21** — en `rest_usuario/README.md` (CRLF): `:8` añadir que `phpmailer` se usa dentro del módulo `correo/`; `:12-35` añadir al árbol `├── correo/  # Módulo de correo (EnviadorCorreo, PlantillasCorreo, cargarCorreo, probarCorreo y su README)` y bajo `logs/` la línea `│   └── correos/  # Registros de correo de local (modo log): correos.log, correo-*.txt, registro-omitido-*.txt`; `:79` (`se escriben en logs/` → `se escriben en logs/correos/`); `:108` (comando de prueba `php correo/probarCorreo.php destino@correo`); `:239` (`logs/correos.log` → `logs/correos/correos.log`). Tras T-20, el commit C6 incluye `correo/README.md` y este archivo.
```bash
cd rest_usuario
grep -c "logs/correos\.log" README.md                      # 0
grep -c "correo/probarCorreo.php" README.md                # ≥ 1 ; y grep -c "mantenimiento/probarCorreo" README.md → 0
git diff --numstat README.md                                # pocas líneas cambiadas (≈ 7+/5-): sin reescritura completa por CRLF
git add -A . && git commit -m "Docs: HU-003 README del módulo de correo y del servicio"   # C6
```

**AC-T-22/23/24** — insertar, justo después del primer párrafo de descripción, la línea
`> **Correo:** este servicio no envía correo. Si algún día lo necesita, debe seguir la convención del módulo `correo/` descrita en `rest_usuario/correo/README.md` (carpeta `correo/` en la raíz del proyecto, marca `// [CORREO]`, registros en `logs/correos/`).`
(en `rest_criteriokelly/README.md` tras `:5`; en `rest_suscripcion/README.md` tras `:3`; en `rest_divisas/README.md` tras la línea `> **Estado:** …` `:5`).
```bash
for p in rest_criteriokelly rest_suscripcion rest_divisas; do echo "$p $(grep -c 'no envía correo' $p/README.md)"; git -C $p diff --numstat README.md 2>/dev/null; done   # 1 cada uno; 1+/0- (git solo en los dos primeros)
git -C rest_criteriokelly add README.md && git -C rest_criteriokelly commit -m "Docs: HU-003 declarar que el servicio no envía correo"
git -C rest_suscripcion add README.md && git -C rest_suscripcion commit -m "Docs: HU-003 declarar que el servicio no envía correo"
cp rest_divisas/README.md docs/Planificacion/evidencias/correo-A/originales/rest_divisas_README.antes.md   # ANTES de editar (rest_divisas no tiene git)
```
`rest_divisas` no tiene repositorio: se guarda la copia previa y se muestra `diff` en la evidencia. Para `rest_suscripcion` (terminaciones mezcladas CRLF/LF), `git diff --numstat` debe mostrar exactamente 1 línea añadida.

**AC-T-25** (`desarrollador-ionic`; solo `criterioKellyApp/README.md`, CRLF) — nueva sección `## Correos que dispara la app` tras la sección `Servicios backend`, con la tabla:

| Pantalla / acción | Página | Store | Servicio | Endpoint | Plantilla que envía el backend |
|-------------------|--------|-------|----------|----------|--------------------------------|
| Registro | `paginas/suscripcion/registro/registro.page.ts:169` | `PersonaStore.registrarPersona` (`util/store/personaStore.ts:39`) | `PersonaService.registrarPersona` (`util/servicios/persona.service.ts:16`) | `POST persona/agregar` | `codigoVerificacion` |
| Reenvío del código de verificación | `util/verificar-correo/verificar-correo.page.ts:77` | `VerificacionCorreoStore.reenviarCodigo` (`util/store/verificacion-correo.store.ts:88`) | `VerificacionCorreoService.reenviarCodigo` (`util/servicios/verificacion-correo.service.ts:28`) | `POST persona/reenviarCodigo` | `codigoVerificacion` |
| Recuperación de clave | `util/recuperar-clave/recuperar-clave.page.ts:47` | `RecuperacionClaveStore.solicitarCodigo` (`util/store/recuperacion-clave.store.ts:35`) | `RecuperacionClaveService.solicitarRecuperacion` (`util/servicios/recuperacion-clave.service.ts:21`) | `POST autenticacion/solicitarRecuperacion` | `codigoRecuperacion` |
| Restablecer clave con el código | `util/recuperar-clave/recuperar-clave.page.ts:51` | `RecuperacionClaveStore.restablecerClave` (`recuperacion-clave.store.ts:61`) | `RecuperacionClaveService.restablecerClave` (`recuperacion-clave.service.ts:30`) | `POST autenticacion/restablecerClave` | `avisoCambioClave` |
| Cambio de clave en el perfil | `configuracion/perfil/perfil.page.ts:160` | `PerfilStore.cambiarClave` (`configuracion/store/perfilStore.ts:74`) | `PerfilService.cambiarClave` (`configuracion/servicios/perfil.service.ts:30`) | `PUT autenticacion/actualizarClave` | `avisoCambioClave` |

(Las rutas de página/store/servicio van relativas a `src/app/paginas/`.) Más el texto: «La app no envía correo: lo hace el backend. El módulo está en `rest_usuario/correo/`. `persona/activar` (`verificacion-correo.service.ts:19`) no envía correo. La reorganización del código de la app es parte de HU-002.»
```bash
cd criterioKellyApp
git diff --name-only                                  # solo README.md
git diff --numstat README.md                           # solo líneas añadidas (la sección), sin reescritura
grep -c "rest_usuario/correo" README.md                # ≥ 1
# Cada ruta citada existe:
for f in paginas/suscripcion/registro/registro.page.ts paginas/util/store/personaStore.ts paginas/util/servicios/persona.service.ts paginas/util/verificar-correo/verificar-correo.page.ts paginas/util/store/verificacion-correo.store.ts paginas/util/servicios/verificacion-correo.service.ts paginas/util/recuperar-clave/recuperar-clave.page.ts paginas/util/store/recuperacion-clave.store.ts paginas/util/servicios/recuperacion-clave.service.ts paginas/configuracion/perfil/perfil.page.ts paginas/configuracion/store/perfilStore.ts paginas/configuracion/servicios/perfil.service.ts; do test -f src/app/$f || echo FALTA $f; done   # sin salida
git add README.md && git commit -m "Docs: HU-003 correos que dispara la app"
```
`ng lint` y `ng build` ➖ (C4/C5): no se toca ningún `.ts`, `.html` ni `.scss` (`git diff --name-only` = `README.md`); E-04 se cumple por construcción y se deja constancia.

**AC-T-26** — `CLAUDE.md` raíz: copiar antes el original a `$E/originales/CLAUDE.antes.md`; añadir **una viñeta** al final de la lista «Conventions» (sección «Backend architecture»):
`- **Correo (HU-003):** en cada proyecto que envíe correo (hoy solo `rest_usuario`) todo vive en la carpeta `correo/` de la raíz del proyecto (`README.md` con el mapa de puntos de llamada, `EnviadorCorreo.php`, `PlantillasCorreo.php`, `cargarCorreo.php`, `probarCorreo.php`). Cada línea que envía correo lleva el comentario `// [CORREO] <plantilla>` (`grep -rn "\[CORREO\]"` los lista), los registros de local (modo `log`) van en `logs/correos/` y las claves de correo en el bloque `# ===== Correo =====` de `.env`/`.env.ejemplo`. Un proyecto nuevo que envíe correo sigue la misma estructura. Los demás backends y la app no envían correo.`
```bash
diff $E/originales/CLAUDE.antes.md CLAUDE.md | grep -c '^>'      # 1 línea añadida, 0 eliminadas: grep -c '^<' = 0
grep -c "\[CORREO\]" CLAUDE.md                                    # ≥ 1
```

**AC-T-27** — `desarrollador-php.md`: copiar antes el original; insertar antes de `## Nombres` (`:94`) la sección `## Correo (HU-003)` con 5 viñetas: ubicación `correo/` en la raíz del proyecto con sus 5 archivos; un solo `require_once` de `correo/cargarCorreo.php`; marca `// [CORREO] <plantilla>` en cada línea que envía (no en `probarCorreo.php`) y mapa en `correo/README.md`; registros de local en `logs/correos/` (nunca códigos en `error_log`, que sigue el principio de «No registres… datos sensibles»); un proyecto nuevo que envíe correo replica la estructura y no crea un servicio aparte sin una historia nueva (condiciones de la alternativa aplazada). No se tocan las líneas 12-13 (X-4) ni la 61 (HLT-13).
```bash
diff $E/originales/desarrollador-php.antes.md .claude/agents/desarrollador-php.md | grep -c '^<'    # 0
grep -c "^## Correo (HU-003)" .claude/agents/desarrollador-php.md                                      # 1
```

**AC-T-28** (en segundo plano; `bash lib/limpiar_datos_prueba.sh` antes de cada batería)
```bash
cd docs/Planificacion/evidencias
# mismas tres ejecuciones que AC-T-05, salida a correo-A/despues/{hlt06,hlt06v2,hlt03}.txt
for f in hlt06 hlt06v2 hlt03; do
  diff <(grep -E '^(OK|FALLO) ' correo-A/linea_base/$f.txt | awk '{print $1, $2}') <(grep -E '^(OK|FALLO) ' correo-A/despues/$f.txt | awk '{print $1, $2}') && echo "$f igual";
done                                                                          # las 3 líneas "igual"
grep -E 'P-02 |P23-tiempos-ge2|P23-medianas|P02v1' correo-A/despues/hlt06.txt correo-A/despues/hlt06v2.txt   # todo OK, con mínimo ≥ 2.0 y |dif| < 0.3
grep -E 'P-19|P-15' correo-A/despues/hlt06.txt | grep -c '^FALLO'               # igual al de la línea base (normalmente 0): alerta y correos de aviso OK
```
Si la comparación difiere, la tarea pasa a `BLOQUEADA` con el diff real (RS-8); no se ajusta la línea base.

**AC-T-29**
```bash
E=docs/Planificacion/evidencias/correo-A; mkdir -p $E/despues/plantillas $E/despues/envio
/c/xampp/php/php.exe $E/capturar_plantillas.php rest_usuario/correo/PlantillasCorreo.php $E/despues/plantillas
for f in $E/linea_base/plantillas/*.txt; do cmp -s "$f" "$E/despues/plantillas/$(basename $f)" || echo "DIFIERE $f"; done    # sin salida
diff $E/linea_base/plantillas/SHA256SUMS $E/despues/plantillas/SHA256SUMS && echo plantillas_identicas
cd rest_usuario && /c/xampp/php/php.exe correo/probarCorreo.php linea.base@ejemplo.test; echo "exit=$?"   # "…logs/correos/correos.log…" y exit=0
N=$(ls -t logs/correos/correo-*.txt | head -1); sed -E 's/^Date: .*/Date: <fecha>/' "$N" > ../$E/despues/envio/correo.norm.txt
diff ../$E/linea_base/envio/correo.norm.txt ../$E/despues/envio/correo.norm.txt && echo formato_txt_identico
tail -n 5 logs/correos/correos.log | sed -E 's/^=== .* ===$/=== <fecha> ===/' | diff <(sed -E 's/^=== .* ===$/=== <fecha> ===/' ../$E/linea_base/envio/correos_log_ultimo.txt) - && echo formato_log_identico
```
Además se prueban los otros modos sin enviar: `cd rest_usuario && /c/xampp/php/php.exe -r 'require "vendor/autoload.php"; require "configuracion/Configuracion.php"; require "correo/cargarCorreo.php"; Configuracion::cargar(".", "rest_usuario"); try { (new EnviadorCorreo())->enviar("a@b.c\n", PlantillasCorreo::codigoVerificacion("X","1")); } catch (Throwable $e) { echo get_class($e), "\n"; }'` → `InvalidArgumentException` (validación del destinatario intacta, B-02). No se prueban `smtp`/`mail` contra servidores reales: su código no cambia (el diff de AC-T-13 lo demuestra).

**AC-T-30**
```bash
E=docs/Planificacion/evidencias/correo-A; U=http://localhost/criterio_kelly/rest_usuario
for r in servicios/EnviadorCorreo.php servicios/PlantillasCorreo.php mantenimiento/probarCorreo.php logs/correos.log logs/ configuracion/Configuracion.php .env correo/ correo/README.md correo/EnviadorCorreo.php correo/cargarCorreo.php logs/correos/correos.log logs/correos/ ; do
  echo "$r $(curl -s -m 5 -o /dev/null -w '%{http_code}' "$U/$r")"; done > $E/despues/curl_c01.txt
echo "doble-barra $(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://localhost/criterio_kelly//rest_usuario/correo/EnviadorCorreo.php")" >> $E/despues/curl_c01.txt
diff <(grep -v doble-barra $E/linea_base/curl_c01.txt) <(grep -v doble-barra $E/despues/curl_c01.txt) && echo mismos_codigos
awk '{ if ($2!=403 && $2!=404) bad=1 } END { exit bad }' $E/despues/curl_c01.txt && echo todos_403_404
curl -s -m 5 "$U/logs/correos/correos.log" | grep -c "Para:"        # 0: el contenido del log no se sirve
```

**AC-T-31**
```bash
E=docs/Planificacion/evidencias/correo-A
bash $E/flujo_correo.sh > $E/despues/flujo.txt 2>&1; grep -c '^FALLO ' $E/despues/flujo.txt     # 0
diff <(grep -E '^(OK|FALLO) ' $E/linea_base/flujo.txt | awk '{print $1,$2}') <(grep -E '^(OK|FALLO) ' $E/despues/flujo.txt | awk '{print $1,$2}') && echo flujo_igual
# E-02 y E-03: el .txt generado está en la ruta nueva
ls rest_usuario/logs/correos/correo-*.txt | wc -l           # ≥ 1 con fecha de hoy
# C-04: ninguna línea NUEVA de los logs de error contiene un código
for f in php_errores.log php_errors.log; do n0=$(awk -v f=rest_usuario/logs/$f '$2==f{print $1}' $E/linea_base/logs_error_wc.txt); tail -n +$((n0+1)) rest_usuario/logs/$f | grep -Ec 'es: [0-9]{6}|código.*[0-9]{6}'; done      # 0 y 0
# C-05
git -C rest_usuario status --short | grep -c 'logs/'         # 0
# RN-12
md5sum -c $E/linea_base/env.md5                                # OK
```

**AC-T-32**
```bash
cd rest_usuario
ls correo/                                          # README.md  EnviadorCorreo.php  PlantillasCorreo.php  cargarCorreo.php  probarCorreo.php  (A-01)
ls servicios/EnviadorCorreo.php servicios/PlantillasCorreo.php mantenimiento/probarCorreo.php 2>&1 | grep -c 'No such file'   # 3 (A-02)
grep -rn "PHPMailer" . --include=*.php --exclude-dir=vendor | grep -vc '^./correo/EnviadorCorreo.php'   # 0 (A-03)
grep -rln "correo/cargarCorreo.php" controladores mantenimiento correo | sort    # 5 archivos: 3 controladores, limpiarSeguridad.php y probarCorreo.php (A-04)
grep -rn "\[CORREO\]" . --include=*.php --exclude-dir=vendor | wc -l             # 5 (A-05)
for f in $(git ls-files '*.php') $(ls correo/*.php); do /c/xampp/php/php.exe -l $f; done | grep -vc 'No syntax errors'   # 0 (E-04)
# Referencias vivas a las rutas viejas (excluye historial de HLT y reportes en docs/Planificacion/HLT-* y evidencias/HLT-*)
cd ..; grep -rnI "servicios/EnviadorCorreo\|servicios/PlantillasCorreo\|mantenimiento/probarCorreo\|logs/correos\.log" rest_usuario rest_criteriokelly rest_suscripcion rest_divisas criterioKellyApp/README.md CLAUDE.md .claude docs/Planificacion/evidencias/*.sh docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-001.md --exclude-dir=vendor --exclude-dir=node_modules --exclude-dir=logs | wc -l   # 0 (los README/PRUEBAS ya actualizados; las referencias históricas quedan en HLT-06*.md y evidencias/HLT-0*, que no se editan)
# C-06
git -C rest_usuario diff --stat $(cat docs/Planificacion/evidencias/correo-A/linea_base/commit_inicial.txt | cut -d' ' -f1) HEAD -- composer.json composer.lock index.php rutas anexos .htaccess configuracion | wc -l   # 0
git -C rest_usuario log --oneline $(cut -d' ' -f1 docs/Planificacion/evidencias/correo-A/linea_base/commit_inicial.txt)..HEAD    # C1…C6, 6 commits en español, sin push
git -C rest_usuario log --follow --oneline correo/EnviadorCorreo.php | wc -l       # ≥ 3 + commits nuevos (historial conservado)
```
(Atención: el `grep` de referencias vivas excluye `logs/` porque los registros de `php_errores.log` guardan rutas.)

**Ampliaciones v2 a los AC de la v1.** **AC-T-28** no cambia: la batería G no forma parte de T-28, se ejecuta en T-35…T-38 y T-41. **AC-T-31** añade: `ls rest_usuario/logs/correos/registro-omitido-*.txt | wc -l` ≥ 1 gracias al caso G-3 de la batería G (T-37 y T-41). **AC-T-32** añade: `grep -c "logs/correos\.log" docs/Planificacion/evidencias/hu003_flujos_cuenta.sh docs/Planificacion/evidencias/lib/hu003_comun.sh` da 0 y 0, y `bash -n` de ambos sin errores.

### Comandos de aceptación de las tareas nuevas de la v2 (T-33…T-41)

Variables comunes: `E=docs/Planificacion/evidencias/correo-A`, desde `C:\xampp\htdocs\criterio_kelly`. **Ruta del log según la fase** (D-22), relativa a `docs/Planificacion/evidencias/`: antes de T-13 (línea base y fases 1 y 2) `LOG_ANTES=../../../rest_usuario/logs/correos.log`; desde T-16 (fases 3 y 4 y final) `LOG_DESPUES=../../../rest_usuario/logs/correos/correos.log`. Esas dos cadenas viven **solo en estos comandos de la HLT**, nunca dentro de un `.sh` (RN-19). Cada corrida: en segundo plano, `timeout` de 600000 ms, precedida de `bash lib/limpiar_datos_prueba.sh` (la batería también limpia al empezar y al terminar). Nunca dos corridas a la vez (H7.1, Resumen).

**AC-T-33 · contenido exacto que debe tener la batería.**

`docs/Planificacion/evidencias/lib/hu003_comun.sh` (LF, se carga con `source` después de `lib/comun.sh`) define, con estos nombres y comportamientos:

| Función | Comportamiento |
|---------|----------------|
| `exigir_entorno` | `LOG_CORREOS` sin definir o archivo inexistente → imprime `FALLO: defina LOG_CORREOS (ruta de correos.log relativa a evidencias/)` y `exit 2`. Si `basename "$(dirname "$LOG_CORREOS")"` es `correos` y existe `"$(dirname "$LOG_CORREOS")/../correos.log"` → `FALLO: existe el log antiguo junto al nuevo` y `exit 2`. Si hay ≥ 5 filas de `sgen_verificacion` de `127.0.0.1`/`::1` en la última hora → `exit 2` (X-11). Define `CARPETA="$(dirname "$LOG_CORREOS")"`, `MARCA=$(mktemp)` y `L0=$(wc -l < "$LOG_CORREOS")` |
| `liberar_ip` | `UPDATE sgen_verificacion v JOIN sgen_usuario u ON u.usu_idUsuario=v.ver_usuId SET v.ver_ipSolicitud='10.0.0.1' WHERE u.usu_usuario REGEXP '^ck_prueba_' AND v.ver_ipSolicitud<>'10.0.0.1'` (acotado, D-24) |
| `limpiar_contadores` | `DELETE FROM sgen_intentoacceso WHERE ina_ip IN ('127.0.0.1','::1'); DELETE FROM sgen_limitepeticion;` (transitorios) |
| `usr_de x`, `mail_de x`, `tel_de n` | `ck_prueba_hu3_x`, `ck.prueba.hu3.x@example.com`, `09900030` + `n` con 2 dígitos |
| `registrar x tel [correo] [usuario]` | `liberar_ip; limpiar_contadores;` `pet - POST "$US/persona/agregar"` con `nombres` `Prueba`, `apellidos` `Hu3`, correo `${3:-$(mail_de x)}` (si `$3` está vacío, el de `x`), teléfono `tel`, usuario `${4:-$(usr_de x)}`, clave `Cielo-Rojo-Montana-77`; devuelve `código cuerpo` |
| `activar x` | `pet - POST persona/activar` con el último código de `codigo_de` |
| `reenviar x` | `pet - POST persona/reenviarCodigo {"correo":…}` tras `liberar_ip; limpiar_contadores` |
| `codigo_de correo frase` | `tail -n +$((L0+1)) "$LOG_CORREOS" \| grep -A6 "^Para: $1\$" \| grep -o "$2 es: [0-9]\{6\}" \| tail -1 \| grep -o '[0-9]\{6\}$'` con `frase` = `activar tu cuenta` o `restablecer la clave` |
| `correos_nuevos correo asunto` | cuenta los bloques de `tail -n +$((L0+1)) "$LOG_CORREOS"` con `Para: correo` y `Asunto: asunto` (con `awk`) |
| `archivos_nuevos correo` | `find "$CARPETA" -maxdepth 1 -name 'correo-*.txt' -newer "$MARCA"` filtrado con `grep -l "^To: $correo\$"`, contado |
| `omitidos_nuevos` | `find "$CARPETA" -maxdepth 1 -name 'registro-omitido-*.txt' -newer "$MARCA" \| wc -l` |
| `conteos usuario` | imprime `usu=N;per=N;ver=N;rec=N;sus=N` con `COUNT(*)` en `sgen_usuario` (por `usu_usuario`), `sgen_persona` (unida por `usu_perIdPerso`), `sgen_verificacion` (`ver_usuId`), `sgen_recuperacion` (`rec_usuId`) y `spsu_suscripcion` (`sus_usuarioId`) |
| `norm caso valor` | `printf 'NORM\|%s\|%s\n' "$1" "$2"` |
| `sin_variables texto` | `sed -E` que sustituye `"accessToken":"…"` y `"refreshToken":"…"` por `<token>`, `[0-9]{6}` solo si va tras `es: ` por `<codigo6>`, y `"id":N`/`"sus_usuarioId":N`/`"sis_idSuscrip":N` por `<id>`; fechas (`AAAA-MM-DD`, con hora separada por espacio o `T` y zona opcional) por `<fecha>` |

`docs/Planificacion/evidencias/hu003_flujos_cuenta.sh` (LF; `cd "$(dirname "$0")"; source lib/comun.sh; source lib/hu003_comun.sh; exigir_entorno`; `MENSAJE_409="${MENSAJE_409:-El nombre de usuario o el teléfono ya están registrados}"`; limpia con `bash lib/limpiar_datos_prueba.sh` al empezar y al terminar; al final imprime `NORM\|LIMPIEZA\|restantes=N`, `NORM\|USUARIOS-REALES\|iguales` (compara con `$USUARIOS_REALES_MD5` si se define, si no con la primera lectura del propio script) y `RESUMEN OK=… FALLO=…`, y sale con `exit 1` si hubo algún `FALLO`). Cada caso usa `chk` (de `lib/comun.sh`) para lo que la HU fija y `norm` para registrar el valor que se compara entre fases. Los casos, en este orden:

| Caso | Acción | `chk` esperado | `NORM\|` que registra |
|------|--------|----------------|-----------------------|
| `G2-registro` | `registrar reg 01` | `^200 \{"mensaje":"Registro recibido. Si los datos son válidos, recibirás un código en tu correo para activar tu cuenta."\}$` | `G2-registro-respuesta` = código y cuerpo |
| `G2-situacion-P` | `SELECT usu_situacion` del usuario `reg` | `^P$` | `G2-situacion` |
| `G2-verificacion` | `SELECT COUNT(*), MIN(LEFT(ver_codigoHash,9)), MIN(ver_situacion)` de `sgen_verificacion` de `reg` | `^1\t\$argon2id\tA$` | `G2-verificacion` |
| `G2-correo-activacion` (control positivo, H-17) | `correos_nuevos` de `reg` con asunto `Código para activar tu cuenta - Criterio Kelly` y `archivos_nuevos` de `reg` | `^1$` y `^1$` | `G2-correos-registro` = `bloques=1;archivos=1` |
| `G2-login-pendiente` | `sesion` del usuario `reg` | no contiene `accessToken` | `G2-login-pendiente` = respuesta normalizada |
| `G2-conteos-registro` | `conteos` de `reg` | `^usu=1;per=1;ver=1;rec=0;sus=0$` | `G2-conteos-registro` |
| `G1-preparar` | `registrar rec 02`, `activar rec`, login (guarda `TOKEN_REC` para `G1-token-previo`) | `^200 \{"success":"ok"\}$` y token no vacío | `G1-preparar` |
| `G1-solicitar-existente` | `POST autenticacion/solicitarRecuperacion` con el correo de `rec` | `^200 \{"mensaje":"Si el correo está registrado, recibirás un código en unos minutos."\}$` | `G1-solicitar-existente` |
| `G1-solicitar-inexistente` | igual con `ck.prueba.hu3.noexiste@example.com` | el mismo regex | `G1-solicitar-inexistente` y `G1-uniforme` = `iguales` si los dos cuerpos son idénticos |
| `G1-correo-recuperacion` | `correos_nuevos` de `rec` con asunto `Código para restablecer tu clave - Criterio Kelly`; de `noexiste` | `^1$` y `^0$` | `G1-correos-recuperacion` |
| `G1-codigo-malo` | `restablecerClave` con código `000000` | `^400 \{"error":"Código inválido o vencido"\}$` | `G1-codigo-malo` |
| `G1-restablecer` | `restablecerClave` con el código leído con `codigo_de … 'restablecer la clave'` y `claveNueva` `Selva-Azul-Torrente-88` | `^200 \{"success":"ok"\}$` | `G1-restablecer` |
| `G1-aviso` | `correos_nuevos` de `rec` con asunto `Tu clave fue cambiada - Criterio Kelly` | `^1$` | `G1-aviso` |
| `G1-token-previo` | `GET autenticacion/usRol` con `TOKEN_REC` (sesión anterior al restablecimiento) | `^401 \{"error":"Sesión no válida o expirada"\}$` | `G1-token-previo` |
| `G1-login` | login con la clave vieja y con la nueva | clave vieja sin `accessToken`; clave nueva con `accessToken` | `G1-login-vieja`, `G1-login-nueva` |
| `G1-auditoria-conteos` | `SELECT GROUP_CONCAT(aud_evento ORDER BY aud_id)` de `rec`; `conteos` de `rec` | contiene `RECUPERACION_SOLICITADA` y `CLAVE_RESTABLECIDA` | `G1-auditoria`, `G1-conteos` |
| `G2-esperar` | espera hasta que pasen 61 s desde el registro de `reg` (`SEGUNDOS_ENTRE_ENVIOS`, `VerificacionMdl.php:13`) | — | — |
| `G2-reenvio` | `reenviar reg` | `^200 \{"mensaje":"Si el correo está pendiente de verificación, recibirás un código en unos minutos."\}$` | `G2-reenvio-respuesta` |
| `G2-correo-reenvio` | `correos_nuevos` de `reg` con el asunto de activación | `^2$` | `G2-correos-total` |
| `G2-activar` | `activar reg` con el último código | `^200 \{"success":"ok"\}$` | `G2-activar` |
| `G2-situacion-A` y `G2-login-activo` | `SELECT usu_situacion`; login | `^A$`; contiene `accessToken` | `G2-situacion-final`, `G2-login-activo` |
| `G2-reenvio-activa` | `reenviar reg` ya activa | mismo cuerpo 200; `correos_nuevos` sigue en 2 | `G2-reenvio-activa` |
| `G2-conteos-final` | `conteos` de `reg` | — | `G2-conteos-final` |
| `G3-repetido` | `omit0=$(omitidos_nuevos); n0=$(SELECT COUNT(*) FROM sgen_persona); l0=$(grep -c '^=== ' log)`; `registrar c3 03` con el **correo de `reg`**; la **única** petición se hace con `curl -w '%{http_code} %{time_total}'` y no se repite (así el aviso `registro-omitido` es exactamente 1) | `200` y cuerpo **igual** al de `G2-registro`; `usu` de `c3` = 0; delta de `sgen_persona` = 0; bloques de correo nuevos = 0; `omitidos_nuevos − omit0` = 1; tiempo ≥ 2,0 s | `G3-respuesta`, `G3-igual-a-registro-nuevo` = `iguales`, `G3-conteos`, `G3-correos`, `G3-omitido` = `1`, `G3-tiempo-ge2` = `si` |
| `G4-usuario` | `registrar d1 04 "" "$(usr_de reg)"` (el correo vacío usa el de `d1`) y correo nuevo | `^409 \{"error":"<MENSAJE_409>"\}$`; delta de `sgen_persona` = 0; `conteos` de `d1` = 0 | `G4-usuario`, `G4-conteos-usuario` |
| `G4-telefono` | `registrar d2` con el **teléfono** de `reg` (`0990003001`) y usuario y correo nuevos | el mismo 409; delta 0 | `G4-telefono`, `G4-conteos-telefono` |
| `G5-pl-preparar` | `registrar pl 05`, `activar pl`, login (`TOKEN_PL`, `ID_PL`) | `accessToken` presente | `G5-pl-preparar` |
| `G5-pl-crear` | `pet "$TOKEN_PL" POST "$SU/suscripcion/crearSinPago" '{"sus_pinIdPlanin":6}'` | `^200 .*"sus_pinIdPlanin":6` | `G5-pl-crear` (normalizado), `G5-pl-fila` = `SELECT sus_situacion, sus_pinIdPlanin` |
| `G5-pl-repetido` | el mismo `POST` y otro con `{"sus_pinIdPlanin":1}` | `^409 \{"error":"El usuario ya tiene una suscripción pendiente o activa"\}$` las dos veces | `G5-pl-repetido`, `G5-pl-conteos` (`sus=1`) |
| `G5-li` | `registrar li 06`, `activar li`, login, `crearSinPago` con `{"sus_pinIdPlanin":1}` | `^200 .*"sus_pinIdPlanin":1` y `sus=1` | `G5-li-crear`, `G5-li-conteos` |

Mientras corre, no se escribe nada en `rest_usuario`, `rest_suscripcion` ni en `.env`; solo las filas de usuarios `ck_prueba_hu3_*` y los contadores transitorios. La batería **observa**: no cambia ningún comportamiento (RN-16).

```bash
cd docs/Planificacion/evidencias
bash -n hu003_flujos_cuenta.sh && bash -n lib/hu003_comun.sh && echo sintaxis_ok
grep -c "logs/correos\.log" hu003_flujos_cuenta.sh lib/hu003_comun.sh                       # 0 y 0 (RN-19, RN-14)
env -u LOG_CORREOS bash hu003_flujos_cuenta.sh; echo "exit=$?"                              # FALLO: defina LOG_CORREOS … / exit=2
LOG_CORREOS=../../../rest_usuario/logs/no_existe.log bash hu003_flujos_cuenta.sh; echo "exit=$?"   # exit=2
bash lib/limpiar_datos_prueba.sh
LOG_CORREOS=$LOG_ANTES bash hu003_flujos_cuenta.sh > correo-A/linea_base/g_prueba_t33.txt 2>&1; echo "exit=$?"   # exit=0
grep -c '^FALLO ' correo-A/linea_base/g_prueba_t33.txt                                    # 0
grep -c '^NORM|' correo-A/linea_base/g_prueba_t33.txt                                     # ≥ 40
grep '^NORM|LIMPIEZA' correo-A/linea_base/g_prueba_t33.txt                                # NORM|LIMPIEZA|restantes=0
# Control negativo (H-19): un mensaje 409 distinto DEBE producir FALLO y exit != 0
LOG_CORREOS=$LOG_ANTES MENSAJE_409='otro texto' bash hu003_flujos_cuenta.sh > correo-A/linea_base/g_control_negativo.txt 2>&1; echo "exit=$?"   # exit=1
grep -c '^FALLO G4-' correo-A/linea_base/g_control_negativo.txt                           # 2
# RN-18: los usuarios reales no cambiaron
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT MD5(GROUP_CONCAT(usu_usuario ORDER BY usu_idUsuario)) FROM sgen_usuario WHERE usu_usuario NOT REGEXP '^ck_prueba_'" | diff - correo-A/linea_base/usuarios_reales.md5 && echo reales_intactos
```

**AC-T-34**
```bash
cd docs/Planificacion/evidencias
bash lib/limpiar_datos_prueba.sh; LOG_CORREOS=$LOG_ANTES bash hu003_flujos_cuenta.sh > correo-A/linea_base/g_flujos_1.txt 2>&1; echo "exit=$?"
bash lib/limpiar_datos_prueba.sh; LOG_CORREOS=$LOG_ANTES bash hu003_flujos_cuenta.sh > correo-A/linea_base/g_flujos_2.txt 2>&1; echo "exit=$?"
grep -c '^FALLO ' correo-A/linea_base/g_flujos_1.txt correo-A/linea_base/g_flujos_2.txt     # 0 y 0
diff <(grep '^NORM|' correo-A/linea_base/g_flujos_1.txt) <(grep '^NORM|' correo-A/linea_base/g_flujos_2.txt) && echo g_determinista   # RN-17
grep '^NORM|' correo-A/linea_base/g_flujos_1.txt > correo-A/linea_base/g_norm.txt            # la línea base contra la que comparan T-35…T-38 y T-41
grep -E '^NORM\|(G2-registro-respuesta|G3-igual|G4-usuario|G5-pl-repetido)' correo-A/linea_base/g_norm.txt   # códigos y mensajes reales a la vista
```
Si dos corridas difieren, se corrige la normalización de la batería (nunca la comparación) y se repite; si persiste, la tarea queda `BLOQUEADA` con el `diff`. La línea base `g_norm.txt` se escribe **una sola vez**.

**AC-T-35 / AC-T-36 / AC-T-38 (fases 1, 2 y 4; ruta del log antigua en 1 y 2 y nueva en 4)** y **AC-T-37 (fase 3, ruta nueva)** y **AC-T-41 (final, ruta nueva)** usan la misma plantilla. Con `F` = `fase1`, `fase2`, `fase3`, `fase4` o `final` y `LOG_FASE` = `$LOG_ANTES` (fases 1 y 2) o `$LOG_DESPUES` (fases 3, 4 y final):
```bash
cd docs/Planificacion/evidencias
bash lib/limpiar_datos_prueba.sh
LOG_CORREOS=$LOG_FASE bash hu003_flujos_cuenta.sh > correo-A/despues/${F}_g.txt 2>&1; echo "exit=$?"     # exit=0
grep -c '^FALLO ' correo-A/despues/${F}_g.txt                                                          # 0
diff correo-A/linea_base/g_norm.txt <(grep '^NORM|' correo-A/despues/${F}_g.txt) && echo g_identico    # RN-16: vacío
grep '^NORM|LIMPIEZA' correo-A/despues/${F}_g.txt                                                      # restantes=0
```
Condiciones propias de cada fase:
- **T-35 (fase 1)**: se ejecuta solo sobre el `HEAD` de T-11 (commit C2 hecho); antes, `git -C rest_usuario log --oneline -1` debe mostrar el mensaje de C2. `curl` y `php -l` de T-11 ya pasaron.
- **T-36 (fase 2)**: `git -C rest_usuario log --oneline -1` muestra el mensaje de C3. Las marcas `[CORREO]` no cambian comportamiento: la salida debe ser idéntica.
- **T-37 (fase 3)**: antes de correr, `test ! -e rest_usuario/logs/correos.log && test -f rest_usuario/logs/correos/correos.log` (T-16 y T-17 hechos). Además el caso `G3-omitido` (`registro-omitido-*.txt` nuevo en `logs/correos/`) y `G2-correos-registro` (`bloques=1;archivos=1`) comprueban que los registros se escriben en la carpeta nueva; `ls rest_usuario/logs/*.txt 2>/dev/null | grep -c 'correo-\|registro-omitido'` = 0 tras la corrida (nada nuevo en `logs/`).
- **T-38 (fase 4)**: tras el commit C6; `md5sum -c correo-A/linea_base/env.md5` sigue en OK (RN-12).
- **T-41 (final)**: tras T-31. Además repite el control negativo corto: `LOG_CORREOS=$LOG_DESPUES MENSAJE_409='otro texto' bash hu003_flujos_cuenta.sh > correo-A/despues/final_g_control_negativo.txt; echo "exit=$?"` → `exit=1` y `grep -c '^FALLO G4-'` = 2 (la comparación sigue siendo capaz de fallar). Y `diff <(cat correo-A/linea_base/usuarios_reales.md5) <(…mismo SELECT de T-01…)` vacío (RN-18).

Si `g_identico` no se imprime, la tarea pasa a `BLOQUEADA` con el `diff` real (RS-8, D-25); no se edita `g_norm.txt`.

**AC-T-39** — `docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md` (LF, español) con la sección **«G-02 · Plan seleccionado → suscripción tras el primer login»**, cuyos pasos son exactamente:
1. Precondiciones: Apache y MySQL en marcha, `ionic serve --port=8100`, `localStorage` del navegador vacío (`Application → Clear site data`), usuario de prueba nuevo `ck_prueba_g02`, correo `ck.prueba.g02@example.com`, teléfono `0990003099`, `rest_usuario` en `CORREO_MODO=log`; lista base de la carpeta de correos.
2. En la app: abrir `/planes`, elegir un **plan de pago** (por ejemplo Básico, 1 mes, intervalo `6`), pulsar continuar y completar el registro con los datos del paso 1 (cédula opcional: dejar vacía).
3. Verificar en las herramientas del navegador que `localStorage.plan_reservado` es `{"usuario":"ck_prueba_g02","pin_idPlanInterv":6}` (`plan-reservado.service.ts:3,19-27`) y que la app navega a `/verificar-correo`.
4. Verificar en la base: `SELECT usu_situacion FROM sgen_usuario WHERE usu_usuario='ck_prueba_g02'` = `P` y `SELECT COUNT(*) FROM spsu_suscripcion s JOIN sgen_usuario u ON u.usu_idUsuario=s.sus_usuarioId WHERE u.usu_usuario='ck_prueba_g02'` = `0` (no se crea suscripción antes de activar).
5. Leer el código del último `correo-*.txt` de la carpeta de correos de `rest_usuario/logs/` (o `logs/correos/` si T-13 ya está hecha) y activarla en la pantalla `/verificar-correo`.
6. Iniciar sesión en `/login` con `ck_prueba_g02`.
7. Verificar en la base: `SELECT sus_pinIdPlanin, sus_situacion FROM spsu_suscripcion s JOIN sgen_usuario u ON u.usu_idUsuario=s.sus_usuarioId WHERE u.usu_usuario='ck_prueba_g02'` devuelve una fila con `sus_pinIdPlanin` = `6`, y `localStorage.plan_reservado` ya no existe (`SuscripcionStore.ts:108-109`).
8. Cerrar sesión, volver a iniciar sesión y verificar que **no** se crea otra fila (`COUNT(*)` sigue en 1; el 409 se toma como «ya tiene suscripción», `SuscripcionStore.ts:112-115`).
9. Repetir los pasos 1 a 8 sin elegir plan (entrar directo al registro): la fila creada debe tener `sus_pinIdPlanin` = `1` (Libre).
10. Limpieza: `bash docs/Planificacion/evidencias/lib/limpiar_datos_prueba.sh` con `PATRON='^ck_prueba_g02'`.

El documento incluye una tabla de resultados `Paso | Esperado | Real | OK` en blanco para que el usuario la rellene, y la nota «HLT-14 añadirá aquí el paso G-6 (cédula repetida)». Comandos:
```bash
test -f docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md && grep -c "^[0-9]*\. " docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md   # ≥ 10
grep -c "plan_reservado" docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md                                                                     # ≥ 2
grep -c "XXX" docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md                                                                  # 0 (sin marcas de texto pendiente)
```

**AC-T-40** — **puerta**: la tarea pasa a `BLOQUEADA` con la pregunta literal «¿Ya ejecutaste el paso G-02 de `PRUEBAS-MANUALES-HU-003.md`? Responde con la tabla de resultados o con "OMITIR G-02"». Con la respuesta del usuario el agente solo **lee** la base (sin escribir) y guarda en `$E/despues/g02_verificacion.txt`: la respuesta literal, y la salida de `SELECT u.usu_situacion, s.sus_pinIdPlanin, s.sus_situacion FROM sgen_usuario u LEFT JOIN spsu_suscripcion s ON s.sus_usuarioId=u.usu_idUsuario WHERE u.usu_usuario IN ('ck_prueba_g02')` (si el usuario ya ejecutó la limpieza, la salida vacía se acepta y se anota que la evidencia es la tabla del usuario). Si el usuario responde «OMITIR G-02», T-40 pasa a `OMITIDA` con ese motivo (RS-5) y el estado global es `PARCIAL`. T-40 no escribe en `rest_*` ni en la app.

**AC-T-41** — ver plantilla de arriba con `F=final` (`LOG_FASE=$LOG_DESPUES`) y sus condiciones propias.

### H7.3 Commits previstos (locales, nunca `push`)

| Repo | Commit | Tarea | Mensaje (español) |
|------|--------|-------|-------------------|
| `rest_usuario` | C1 | T-07 | `Refactor: HU-003 mover el correo a correo/ (solo movimiento, sin cambios de contenido)` |
| `rest_usuario` | C2 | T-11 | `Refactor: HU-003 cargar el módulo de correo con un solo require` |
| `rest_usuario` | C3 | T-12 | `Refactor: HU-003 marcar con [CORREO] los puntos de envío` |
| `rest_usuario` | C4 | T-14 | `Refactor: HU-003 registros de correo de local en logs/correos` |
| `rest_usuario` | C5 | T-19 | `Docs: HU-003 bloque Correo en .env.ejemplo` |
| `rest_usuario` | C6 | T-21 | `Docs: HU-003 README del módulo de correo y del servicio` |
| `rest_criteriokelly` | — | T-22 | `Docs: HU-003 declarar que el servicio no envía correo` |
| `rest_suscripcion` | — | T-23 | `Docs: HU-003 declarar que el servicio no envía correo` |
| `criterioKellyApp` | — | T-25 | `Docs: HU-003 correos que dispara la app` |

Sin commit (no hay git): `rest_divisas/README.md`, `CLAUDE.md`, `.claude/agents/desarrollador-php.md`, `docs/**`. **(v2)** T-33…T-41 no generan ningún commit: sus archivos (`hu003_flujos_cuenta.sh`, `lib/hu003_comun.sh`, `PRUEBAS-MANUALES-HU-003.md`, evidencias de `correo-A/`) viven en `docs/`, que no está bajo git, y las baterías solo escriben en la base local de pruebas. Cada mensaje termina con la línea de atribución vigente en la sesión del agente de implementación.

---

## H8 · Reglas de implementación deterministas

Reglas de `.claude/agents/desarrollador-php.md` aplicables, citadas por sección, más las propias de este HLT.

- **RI-A1 · Arquitectura obligatoria** (sección «Arquitectura obligatoria»): no se alteran capas, `rutas/`, `index.php` ni `BaseCtrl`; el módulo `correo/` no es una capa nueva sino un conjunto de clases de servicio.
- **RI-A2 · Contrato de respuesta** («Contrato de respuesta»): ninguna respuesta HTTP cambia; el 422 sigue reservado; ninguna salida (`echo`) antes de las respuestas de `BaseCtrl`.
- **RI-A3 · Seguridad de errores** («Errores y cabeceras»): no registrar datos sensibles; `carpetaRegistros()` solo lanza mensajes fijos; no tocar `.htaccess`, cabeceras ni bloqueos de carpetas.
- **RI-A4 · Secretos** («Secretos y configuración»): no abrir ni editar `.env`; solo `grep '^CORREO_MODO='` y `md5sum`.
- **RI-A5 · Nombres y estilo** («Nombres», «Estándares de código»): español, `camelCase`, constantes `UPPER_SNAKE_CASE` (`SUBCARPETA_REGISTROS`), tipos de retorno declarados (`carpetaRegistros(): string`), comparaciones estrictas, sin código comentado ni depuración. Código compatible con PHP 8.0 (X-4). **Conservar la terminación de línea de cada archivo editado** (X-7, D-12); archivos nuevos en LF.
- **RI-A6 · Cambios de esquema**: ninguno en este HLT.
- **RI-A7 · Verificación antes de terminar** («Verificación antes de terminar»): `php -l` de cada `.php` tocado y `curl` de cada endpoint afectado (caso feliz y de error); el informe indica `php -l` y `curl` reales.
- **RI-A8 · Sin efectos fuera de alcance** (RI-10 de `doc_modo_planificacion.md`): una tarea solo toca los archivos de su fila; `git diff --name-only` por tarea lo demuestra.
- **RI-A9 · Commits** (RI-11): solo los de H7.3, locales, en español, con autorización del usuario recogida en T-01; **nunca `push`**; un commit no mezcla fases.
- **RI-A10 · Datos de prueba**: solo prefijo `ck_prueba_` y `lib/limpiar_datos_prueba.sh`; nunca se borran datos reales; el `.env` real y la base real no se modifican.
- **RI-A11 · Evidencia honesta** (RS-1, RS-8): la salida real de cada comando se pega en la ficha; una comparación que difiere se reporta, no se ajusta la línea base.
- **RI-A12 · Servicios**: nada de servicios, endpoints, tablas, secretos ni dependencias nuevas (C-06); `composer.json` y `composer.lock` sin diff.
- **RI-A13 (v2) · La batería G observa, no modifica**: `hu003_flujos_cuenta.sh` y `lib/hu003_comun.sh` solo hacen peticiones HTTP, consultas `SELECT` y los fixtures de D-24; no editan archivos de `rest_*`, `.env` ni la app; no contienen la cadena de la ruta antigua del log (RN-19); todo usuario que crean empieza por `ck_prueba_hu3_`. Su contenido se ajusta a los nombres de H7.2 (AC-T-33); `lib/hu003_comun.sh` es reutilizable por HLT-14.
- **RI-A14 (v2) · Línea base inmutable**: `correo-A/linea_base/g_norm.txt` se escribe una sola vez (T-34) y no se edita; una diferencia en una fase deja la tarea `BLOQUEADA` con el `diff` real (RS-8, D-25). Una corrida de la batería G nunca se solapa con otra batería ni con otra corrida G.

---

## H9 · Reglas de seguimiento de ejecución

Método, símbolos y reglas RS-1…RS-9 de `criterioKellyApp/docs/doc_modo_planificacion.md` §11 (obligatorios). Para backend, **C4** = `C:\xampp\php\php.exe -l` sin errores sobre cada `.php` tocado (➖ en tareas sin `.php`); **C5** = `curl` de cada endpoint afectado, caso feliz y al menos uno de error, con la respuesta real (➖ en tareas de documentación o sin endpoint, con justificación). Todas las fichas parten en `PENDIENTE` y con `⬜`; solo el agente de implementación las marca.

Ficha tipo (cada tarea la reproduce, sustituyendo el nombre):
```
T-NN — <nombre>
  Estado: PENDIENTE
  Checks: [⬜] C1 cambios en los archivos declarados · [⬜] C2 criterio de aceptación AC-T-NN (evidencia) · [⬜] C3 reglas H8 y H11
          [⬜] C4 php -l OK · [⬜] C5 curl OK · [⬜] C6 sin efectos fuera de alcance (git diff --name-only)
  Evidencia: —   Notas / desviaciones: —
```

### Fichas

```
T-01 — Verificar precondiciones y crear evidencias
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-01)  [⬜] C3  [➖] C4 sin .php  [➖] C5 sin endpoint  [⬜] C6
  Evidencia: —   Notas: —
T-02 — capturar_plantillas.php y línea base de plantillas
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-02, incl. control negativo)  [⬜] C3  [⬜] C4 php -l del script  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-03 — Línea base del formato de envío
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-03)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-04 — Línea base curl C-01
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-04)  [⬜] C3  [➖] C4  [⬜] C5 curl con respuesta real  [⬜] C6
  Evidencia: —   Notas: —
T-05 — Línea base de baterías (P-02/P-23)
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-05)  [⬜] C3  [➖] C4  [⬜] C5 (las baterías son curl reales)  [⬜] C6
  Evidencia: —   Notas: —
T-06 — flujo_correo.sh y su línea base
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-06)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-07 — git mv de los 3 archivos (C1)
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-07: 3 × R100, historial)  [⬜] C3  [➖] C4 sin contenido nuevo  [➖] C5 el HEAD no es ejecutable (R-02)  [⬜] C6
  Evidencia: —   Notas: —
T-08 — cargarCorreo.php
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-08)  [⬜] C3  [⬜] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-09 — require único en 3 controladores
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-09)  [⬜] C3  [⬜] C4  [➖] C5 (se prueba en T-11)  [⬜] C6
  Evidencia: —   Notas: —
T-10 — require en limpiarSeguridad.php y probarCorreo.php
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-10)  [⬜] C3  [⬜] C4  [➖] C5 (se prueba en T-11)  [⬜] C6
  Evidencia: —   Notas: —
T-11 — Verificar carga de los 5 archivos y commit C2
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-11)  [⬜] C3  [⬜] C4  [⬜] C5 (4 curl + mantenimiento)  [⬜] C6
  Evidencia: —   Notas: —
T-12 — Marcas [CORREO] y commit C3
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-12: 5 líneas)  [⬜] C3  [⬜] C4  [➖] C5 (se prueba en T-28)  [⬜] C6
  Evidencia: —   Notas: —
T-13 — carpetaRegistros() en EnviadorCorreo
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-13)  [⬜] C3  [⬜] C4  [⬜] C5 (probarCorreo escribe en logs/correos/)  [⬜] C6
  Evidencia: —   Notas: —
T-14 — avisarRegistroOmitidoEnLocal y commit C4
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-14, incl. prueba de silencio)  [⬜] C3  [⬜] C4  [⬜] C5 (persona/agregar duplicado → 200)  [⬜] C6
  Evidencia: —   Notas: —
T-15 — Demostrar exclusión de git
  Estado: PENDIENTE
  [➖] C1 sin cambios (D-08)  [⬜] C2 (AC-T-15)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-16 — Mover registros locales antiguos
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-16)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-17 — Scripts de evidencia a la ruta nueva con guardas
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-17, incl. aborto por log ausente)  [⬜] C3  [➖] C4 (bash -n)  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-18 — PRUEBAS-MANUALES-HU-001.md
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-18)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-19 — .env.ejemplo y commit C5
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-19, md5 de .env)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-20 — correo/README.md
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-20: tabla = marcas reales)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-21 — rest_usuario/README.md y commit C6
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-21)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-22 — README rest_criteriokelly
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-22)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-23 — README rest_suscripcion
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-23)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-24 — README rest_divisas
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-24)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-25 — README de la app (desarrollador-ionic)
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-25)  [⬜] C3  [➖] C4 ng lint (no se toca código)  [➖] C5 ng test  [⬜] C6 (git diff --name-only = README.md)
  Evidencia: —   Notas: —
T-26 — CLAUDE.md raíz
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-26)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-27 — desarrollador-php.md
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-27)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-28 — Repetir baterías y comparar
  Estado: PENDIENTE
  [➖] C1 sin cambios de código  [⬜] C2 (AC-T-28)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-29 — Plantillas byte a byte y formato de envío
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-29)  [⬜] C3  [⬜] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-30 — curl C-01 después
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-30)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-31 — Flujo E-02/E-03, logs de error, git
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-31)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-32 — Verificación global estática
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-32)  [⬜] C3  [⬜] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-33 — hu003_flujos_cuenta.sh y lib/hu003_comun.sh (v2)
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-33: sintaxis, guardas, corrida OK, control negativo, usuarios reales intactos)  [⬜] C3  [➖] C4 son .sh (bash -n)  [⬜] C5 curl reales de la corrida  [⬜] C6
  Evidencia: —   Notas: —
T-34 — Línea base G determinista (v2)
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-34: g_determinista, g_norm.txt)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-35 — Fase 1 G: movimiento y carga única (v2)
  Estado: PENDIENTE
  [➖] C1 sin cambios de código  [⬜] C2 (AC-T-35: g_identico)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-36 — Fase 2 G: marcas [CORREO] (v2)
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-36: g_identico)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-37 — Fase 3 G: registros en logs/correos/ (v2)
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-37: g_identico con la ruta nueva, nada nuevo en logs/)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-38 — Fase 4 G: configuración y documentación (v2)
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-38: g_identico, md5 de .env)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-39 — PRUEBAS-MANUALES-HU-003.md con el paso G-02 (v2)
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-39)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-40 — Puerta G-02: verificación tras la ejecución del usuario (v2)
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-40: respuesta literal del usuario y consulta de solo lectura)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-41 — No regresión final G y control negativo (v2)
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-41: g_identico, exit=1 del control)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
```

### Tablero de avance global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-13 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-14 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-15 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-16 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-17 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-18 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-19 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-20 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-21 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-22 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-23 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-24 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-25 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-26 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-27 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-28 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-29 | PENDIENTE | ➖ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-30 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-31 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-32 | PENDIENTE | ➖ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-33 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-34 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-35 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-36 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-37 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-38 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-39 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-40 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-41 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |

---

## H10 · Diseño del reporte de ejecución

Estructura fija (RR-1…RR-5 de `doc_modo_planificacion.md` §12):

```
REPORTE DE EJECUCIÓN — Módulo de correo identificable en rest_usuario (HU-003 A–E y G-01, G-02) — HLT-12 v2
  1. Resumen ejecutivo
  2. Estado global              (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas          (copia de H9, T-01…T-41, con checks C1…C6)
  4. Cobertura vs. HLT          (matriz H4: criterio A-01…E-04, G-01 y G-02 → resultado; ¿100 %?)
  5. Cambios realizados         (archivos ruta:línea, tipo de cambio, commits C1…C6 con hash)
  6. Verificaciones ejecutadas  (comando → salida real de cada AC-T-NN; tablas antes/después de baterías, P-02, P-23, curl C-01, plantillas y la comparación `g_identico` de la batería G en cada fase)
  7. Desviaciones y decisiones  (respecto al HLT; con causa)
  8. Pendientes / bloqueos      (checks en ⬜/❌; acción requerida)
  9. Próximos pasos             (HLT-13 y HLT-14 si el estado es COMPLETADO; la batería G de este HLT es la que ambos reutilizan)
```

Reglas específicas: el estado es `COMPLETADO` solo si las 41 tareas están `HECHA` (T-40 puede quedar `OMITIDA` por decisión escrita del usuario: entonces el estado es `PARCIAL`, D-27), T-28 reporta igualdad de conjuntos `(caso, estado)` con la línea base, T-29 `plantillas_identicas`, T-30 `mismos_codigos` y T-32 sin hallazgos y T-35…T-38 y T-41 `g_identico`. La sección 6 incluye la tabla de tiempos P-02/P-23 antes y después con mínimo y diferencia de medianas. La sección 7 declara cualquier `FALLO` preexistente de la línea base.

---

## H11 · Convenciones de desarrollo y arquitectura de código limpio

Nombres de `desarrollador-php.md` («Nombres»): español, `camelCase`, constantes `UPPER_SNAKE_CASE`, sufijos `Rts`/`Ctrl`/`Mdl` para las capas HTTP. Las clases de `correo/` conservan los nombres existentes (`EnviadorCorreo`, `PlantillasCorreo`), que son clases de servicio y no pertenecen a una capa HTTP.

| Elemento | Convención en este HLT |
|----------|------------------------|
| Carpeta del módulo | `correo/` en la raíz del proyecto, en minúscula, singular |
| Archivos nuevos PHP | `cargarCorreo.php` (verbo + objeto, `camelCase` como `limpiarSeguridad.php` y `probarCorreo.php`) |
| Constante nueva | `SUBCARPETA_REGISTROS` |
| Método nuevo | `carpetaRegistros(): string` (público estático: lo usan `EnviadorCorreo` y `PersonaCtrl`) |
| Marca de llamada | `// [CORREO] <nombreDeLaPlantilla>` con el nombre exacto del método estático de `PlantillasCorreo` |
| Registros de local | `logs/correos/correos.log`, `correo-AAAAMMDD-HHMMSS-xxxxxx.txt`, `registro-omitido-AAAAMMDD-HHMMSS-xxxxxx.txt` (mismos nombres de hoy) |
| Bloque de configuración | `# ===== Correo =====` … `# ===== Fin de Correo =====` |
| Scripts de evidencia | `docs/Planificacion/evidencias/correo-A/` (carpeta en kebab-case con sufijo de HLT); scripts `snake`/`camel` coherentes con `hlt06_bateria.sh` |
| Documentos | Español, comillas simples en el código, sin marcadores pendientes, sin emojis |
| **(v2)** Batería G | `docs/Planificacion/evidencias/hu003_flujos_cuenta.sh` y `lib/hu003_comun.sh`: funciones en `snake_case` como `lib/comun.sh` (`liberar_ip`, `registrar`, `codigo_de`); variables de entorno en `MAYÚSCULAS` (`LOG_CORREOS`, `MENSAJE_409`); salida `OK`/`FALLO`/`NORM` (caso y valor separados por barra vertical) |
| **(v2)** Usuarios y datos de prueba | Prefijo `ck_prueba_hu3_`, correos `ck.prueba.hu3.<x>@example.com`, teléfonos `09900030NN` |
| **(v2)** Evidencias G | `correo-A/linea_base/g_flujos_1.txt`, `g_flujos_2.txt`, `g_norm.txt`; `correo-A/despues/fase1_g.txt` … `fase4_g.txt`, `final_g.txt` |

Responsabilidad única: `EnviadorCorreo` envía (y ahora conoce su carpeta de registros); `PlantillasCorreo` solo produce texto; `cargarCorreo.php` solo carga; `AlertasSeguridad` solo decide cuándo alertar. No hay lógica de correo fuera de `correo/` salvo las llamadas marcadas.
