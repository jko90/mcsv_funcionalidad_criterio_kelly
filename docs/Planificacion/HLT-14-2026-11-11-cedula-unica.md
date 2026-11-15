# HLT-14 — Cédula única en el registro (HU-003 rev. 2, G-6, G-03 y G-04; DC-10 y DC-11)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-11 |
| Historia | `docs/Historia_usuario/HU-003-microservicio-correo.md`, sección G (flujo G-6, criterios G-03 y G-04) y decisiones DC-10 y DC-11 |
| Cubre | **G-6** (regla nueva: no crear otra cuenta con la misma cédula), **G-03** (409 con cédula repetida sin cambiar `sgen_persona`; cédula nueva o ausente sigue funcionando; dos registros simultáneos con la misma cédula: un 200 y un 409) y **G-04** (los tiempos P-02/P-23 de HU-001 siguen pasando). Es la **única excepción** a «sin cambio de comportamiento» de HU-003 |
| **Depende de** | `docs/Planificacion/HLT-12-2026-11-11-modulo-correo-v2.md` (HLT-12 v2) **COMPLETADO**. Ver «Orden de ejecución respecto a HLT-12 y HLT-13» |
| Proyectos y git | `rest_usuario` (git propio; único proyecto que cambia código), `criterioKellyApp` (git propio; **solo verificación**, con cambio mínimo condicionado), raíz del workspace (sin git: `docs/`). `rest_criteriokelly`, `rest_suscripcion` y `rest_divisas` no se tocan |
| Numeración | HLT de HU-003 en secuencia global: HLT-12, HLT-13 y este HLT-14 (HLT-10 y HLT-11 están reservados para HU-001) |
| Entorno verificado al planificar | PHP 8.2.35; MariaDB local con motor InnoDB y aislamiento por defecto (no hay `transaction-isolation` en `C:\xampp\mysql\bin\my.ini`); Apache y MySQL **detenidos** (`curl` → `000`; `mysql` → error 10061), por lo que ninguna consulta a la base viva pudo hacerse al planificar: todas las comprobaciones de datos van en las tareas (T-01, T-02) |
| Decisión pendiente del usuario | Ninguna bloquea el inicio. Dos puertas condicionales: **T-03** (solo si la base ya tiene cédulas repetidas) y **T-17** (prueba manual en la app). Preguntas abiertas no bloqueantes en H5 (PU-1…PU-4) |
| Estado | Pendiente de ejecución (veredicto H6 al final de la sección) |

### Orden de ejecución respecto a HLT-12 y HLT-13

- **Después de HLT-12 (obligatorio).** Se justifica por cuatro razones verificables: (1) HLT-12 mueve los `require` de `PersonaCtrl.php` y reescribe `avisarRegistroOmitidoEnLocal`, por lo que los números de línea de este HLT cambian y T-06 y T-07 localizan el código por su **texto** y no por el número; (2) la batería `hu003_flujos_cuenta.sh`, sus ayudas `lib/hu003_comun.sh` y la línea base `correo-A/linea_base/g_norm.txt` nacen en HLT-12 (T-33, T-34) y son la protección de no regresión de G-1…G-5 de este HLT; (3) la HU manda que la reorganización no mezcle cambios de comportamiento con movimientos de archivos (commits separados); (4) HLT-12 conserva el mensaje 409 actual y este HLT lo cambia por DC-10: ejecutarlos al revés invalidaría la comparación «idéntico» de HLT-12. **Si se ejecutara antes de HLT-12**, T-01 queda `BLOQUEADA` porque `hu003_flujos_cuenta.sh` no existe; no se admite saltarla.
- **Respecto a HLT-13** (eliminación de código de correo): son independientes (HLT-13 toca `rutas.txt`, `anexos/` y la columna `usu_codiorecupe`; este toca `PersonaMdl.php`, `PersonaCtrl.php` y documentación). **Orden recomendado: HLT-12 → HLT-13 → HLT-14**, para que las comparaciones «mismo resultado» de HLT-13 se hagan con el 409 antiguo. Si se ejecuta HLT-14 antes que HLT-13, no hay conflicto: la línea base de HLT-13 (su T-02) se captura al empezar, con el mensaje nuevo, y `hlt06_bateria.sh:172` ya estará actualizado por T-09 de este HLT. Nunca se ejecutan a la vez.

---

## H1 · Propósito

**Requerimiento literal (HU-003 rev. 2, G-6):** «**No crear otra cuenta con la misma cédula** (regla nueva): si se envía una cédula que ya pertenece a una persona activa, el registro responde 409 y no crea nada.» Reglas de la HU: «La cédula es opcional: solo se comprueba cuando el registro la envía. La comprobación va en la misma transacción y con el mismo bloqueo (`FOR UPDATE`) que la de usuario y teléfono, para que dos registros simultáneos con la misma cédula no pasen ambos. El correo sigue con su respuesta uniforme (G-3). Antes de cualquier índice único se comprueba con una consulta si la base ya tiene cédulas repetidas; si las hay, se listan y se pide al usuario qué hacer, sin borrar nada (DC-11). La app muestra el mensaje del servidor como ya hace con el 409 de usuario o teléfono; se verifica que el texto se vea bien.» **DC-10:** un solo mensaje para los tres casos, `El nombre de usuario, el teléfono o la cédula ya están registrados`. **DC-11:** no se crea índice único sobre `per_cedula`.

**Propósito.** Impedir que se creen dos personas activas con la misma cédula en el registro público, usando la misma técnica que ya protege usuario, teléfono y correo (consulta con `FOR UPDATE` dentro de la transacción de registro), con un único mensaje 409 que no revele qué campo está repetido, sin cambiar el esquema y sin degradar ni los tiempos uniformes de HU-001 ni los flujos de cuenta G-1…G-5.

**Resultado esperado (observable).**
1. `POST persona/agregar` con una cédula que ya pertenece a una persona activa responde `409 {"error":"El nombre de usuario, el teléfono o la cédula ya están registrados"}` y no crea filas (conteo de `sgen_persona`, `sgen_usuario`, `sgen_verificacion` sin cambio, ningún correo).
2. Con una cédula nueva, o sin cédula, el registro responde el mismo 200 de siempre y tarda como siempre (≥ 2,0 s).
3. El mismo texto 409 sale para usuario repetido, teléfono repetido y cédula repetida (cuerpo y cabeceras idénticos).
4. Dos registros simultáneos con la misma cédula producen un 200 y un 409, y una sola fila nueva en `sgen_persona`; dos simultáneos con cédulas distintas producen dos 200 (sin 500).
5. Un correo repetido sigue recibiendo la respuesta uniforme (200 igual al de un registro nuevo, sin filas ni correo, con el aviso `registro-omitido` en local), también si además trae una cédula repetida.
6. Si la base local ya tenía cédulas repetidas, quedan listadas (enmascaradas) y el usuario decidió qué hacer; no se borró ni modificó ninguna fila.
7. La batería `hu003_flujos_cuenta.sh` da el mismo resultado que la línea base de HLT-12 **salvo** el texto del 409 de G-4 (que cambia por DC-10, y solo ese texto); P-02 y P-23 de HU-001 siguen cumpliéndose.
8. El `README.md` de `rest_usuario` documenta la regla y el nuevo mensaje; la app muestra el texto del servidor sin cambios de código (o con el cambio mínimo si no se viera).

**Fuera de alcance.**
- Crear un índice único o cualquier cambio de esquema sobre `per_cedula` (DC-11). Tampoco se normaliza ni se corrige ninguna cédula ya guardada.
- Borrar, fusionar o editar cédulas repetidas históricas: solo se listan y se pregunta (T-03).
- Cambiar la validación de formato de cédula (10 a 13 dígitos, `PersonaCtrl.php:100-102`), la longitud máxima (`:91`) o la regla de la app de 10 dígitos exactos (`registro.page.ts:146-155`).
- Verificar que la cédula sea real o pertenezca a quien se registra (no hay servicio de validación; ver riesgo R-03).
- Añadir espera de 2 s al 409 (hoy el 409 de usuario/teléfono responde sin espera; D-06).
- Cambiar `actualizarDeApp` o cualquier otro endpoint: la cédula solo se escribe en el registro (`PersonaMdl.php:81-92`); nadie la modifica después (`grep per_cedula` en `rest_*/modelos` y `controladores` solo encuentra `PersonaMdl.php:82`).
- `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas`, y cualquier cambio de la app salvo el mínimo condicionado de T-16.

**Feature(s) afectada(s).** `rest_usuario` → recurso `/persona` (`persona/agregar`): `modelos/PersonaMdl.php`, `controladores/PersonaCtrl.php`, `README.md`. `criterioKellyApp` → solo lectura de `paginas/suscripcion/registro/`, `paginas/util/store/personaStore.ts` y `compartidos/interceptors/error.interceptor.ts`. `docs/Planificacion/evidencias/` → scripts y evidencias.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | La cédula es opcional: solo se comprueba si el registro la envía | Sin campo `cedula` o con `""` (el controlador la convierte en `null`, `PersonaCtrl.php:128`) no se ejecuta la consulta de cédula y el resultado es el actual (200); la fila queda con `per_cedula IS NULL`; dos registros sin cédula conviven | G-6 · G-03 |
| RN-02 | «Persona activa» = `per_estado = '1'`; la comparación usa la cédula **normalizada** | La consulta compara `REPLACE(REPLACE(REPLACE(TRIM(p.per_cedula), ' ', ''), '-', ''), '.', '')` con la cédula normalizada del registro. Una persona con `per_estado = '0'` (incluidas las cuentas pendientes depuradas a los 7 días, `VerificacionMdl.php:181`) no bloquea. Una cuenta pendiente `P` sí bloquea (igual que usuario y teléfono, `PersonaMdl.php:57-62`) | G-6 · D-03 · D-04 |
| RN-03 | Misma transacción y mismo bloqueo | La comprobación está entre `iniciarTransaccion` (`PersonaMdl.php:56`) y `confirmarTransaccion` (`:110`), usa `LIMIT 1 FOR UPDATE`, va **después** de la consulta de correo (`:73-79`) y **antes** del `INSERT` de persona (`:81-92`); si encuentra fila hace `revertirTransaccion()` y retorna | G-6 · D-05 |
| RN-04 | Un solo mensaje 409 para usuario, teléfono y cédula | Cuerpo exacto `{"error":"El nombre de usuario, el teléfono o la cédula ya están registrados"}` con HTTP 409 en los tres casos; `cmp` byte a byte entre los tres cuerpos y mismas cabeceras (sin `Retry-After`); el mensaje no incluye el valor de la cédula ni indica el campo | DC-10 |
| RN-05 | Sin índice único ni cambio de esquema | `git diff` de `rest_usuario/anexos/` vacío; `SHOW INDEX FROM sgen_persona` no gana ningún índice; `EXPLAIN` de la consulta muestra `type=ALL` | DC-11 |
| RN-06 | El correo repetido conserva la respuesta uniforme **antes** que la cédula | Correo existente + cédula nueva **o repetida**: `200` con el mismo cuerpo que un registro nuevo, sin filas, sin correo, con `registro-omitido-*.txt` en local y ≥ 2,0 s (la consulta de correo `:73-79` precede a la de cédula) | G-3 · D-05 |
| RN-07 | La validación de formato no cambia | Cédula con guion o letras: `400 Formato de cédula inválido. Debe contener entre 10 y 13 dígitos` (`PersonaCtrl.php:100-102`); más de 13: `400 La cédula no puede exceder 13 caracteres` (`:91`) | `PersonaCtrl.php` |
| RN-08 | Carrera: dos registros simultáneos con la misma cédula | En 10 rondas de 2 peticiones simultáneas con la misma cédula (y usuario, teléfono y correo distintos) sale exactamente un 200 y un 409 por ronda y `sgen_persona` gana una fila por ronda; en una ronda de 5, un 200 y cuatro 409 | G-03 |
| RN-09 | La comprobación no introduce 500 ni bloqueos | 10 rondas de 2 simultáneos con cédulas **distintas** dan 20 respuestas 200 y ningún 500; `php_errores.log`/`php_errors.log` no ganan líneas con `Deadlock`, `1213`, `1205` ni `Lock wait` | RN-03 · R-05 |
| RN-10 | Cédulas históricas repetidas: no se toca nada | T-02 solo ejecuta `SELECT`; si hay repetidas, T-03 queda `BLOQUEADA` con la lista enmascarada y la pregunta; ninguna tarea hace `UPDATE`/`DELETE` sobre `sgen_persona` fuera de los fixtures de prueba con usuarios `ck_prueba_` | DC-11 |
| RN-11 | Tiempo mínimo uniforme intacto | `BaseCtrl::TIEMPO_MINIMO_RESPUESTA_MS = 2000` y `esperarTiempoMinimo` sin diff (`BaseCtrl.php:11,63-70`); registro 200 con y sin cédula ≥ 2,0 s con diferencia de medianas < 0,3 s; P-02 y P-23 con mínimo ≥ 2,0 s y diferencia de medianas < 0,3 s, y medianas a menos de 0,3 s de la línea base | G-04 · C-02 de HU-001 |
| RN-12 | Sin datos personales en logs ni en respuestas de error | Ninguna línea nueva de `php_errores.log`/`php_errors.log` contiene una cédula de prueba (`9990`); el cuerpo del 409 no contiene dígitos | RI-A3 |
| RN-13 | El nombre de la constante dice lo que hace | `REGISTRO_USUARIO_O_TELEFONO_DUPLICADO` pasa a `REGISTRO_DATOS_DUPLICADOS` (valor `'DATOS_DUPLICADOS'`) y no queda ninguna referencia a la vieja en código vivo (`rest_*/` salvo `docs/`); los 1062 por el índice único de usuario (`sist_generico.sql:116`) siguen mapeando al mismo resultado | D-07 |
| RN-14 | Los flujos G-1…G-5 no cambian | Batería `hu003_flujos_cuenta.sh` con `MENSAJE_409` nuevo: `diff` de la línea base de HLT-12 (`g_norm.txt`) con la corrida nueva vacío **tras sustituir el texto antiguo del 409 por el nuevo en la línea base**, y ninguna otra línea distinta | G-01 de HU-003 |
| RN-15 | La regla queda documentada | `rest_usuario/README.md` menciona cédula repetida en el 409 y en la tabla de campos; `PRUEBAS-MANUALES-HU-003.md` gana el paso G-6 | D-11 |
| RN-16 | La app muestra el texto del servidor tal cual | En el registro, el 409 se ve en el toast del interceptor y en el recuadro rojo con el mismo texto (`error.interceptor.ts:26-27,59`; `registro.page.html:361-364`); ningún `.ts`/`.html` de la app contiene el texto antiguo | G-6 |
| RN-17 | Datos de prueba acotados | Usuarios `ck_prueba_hu3c_*`, correos `ck.prueba.hu3c.<x>@example.com`, cédulas ficticias `99900xxxxx`; se verifica antes que ninguna cédula `999%` exista; borrado con `lib/limpiar_datos_prueba.sh` (patrón por defecto `^ck_prueba_`) | D-20 de HLT-12 |

---

## H3 · Flujo principal de ejecución

```
.htaccess (lista blanca) → index.php (RUTAS_PUBLICAS incluye persona/agregar, index.php:28-37;
    límite público 60 por minuto por IP, LimitadorPeticiones.php:11-12)
  → rutas/PersonaRts.php:17-26 (POST agregar) → PersonaCtrl::agregarPersona (:73-156)
       ├─ campos permitidos: cedula, nombres, apellidos, correo, telefono, usuario, clave (:77-79)
       ├─ tipo de cedula (:85-87) → limpiarDatos: trim + htmlspecialchars (BaseCtrl.php:27-38)
       ├─ longitud ≤ 13 (:91) y formato ^[0-9]{10,13}$ (:100-102)            → 400
       ├─ demás validaciones (:92-115) y límite de 10 códigos por IP/hora (:116-120) → 400 / 429
       ├─ hashes Argon2id de clave y código (:124-126)  (siempre, para igualar tiempos)
       └─ PersonaMdl::registrarPersona (PersonaMdl.php:43-119), todo dentro de UNA transacción:
            1. usuario o teléfono repetido (FOR UPDATE, :57-71)               → 'DATOS_DUPLICADOS' (antes: USUARIO_O_TELEFONO_DUPLICADO)
            2. correo repetido (FOR UPDATE, :73-79)                           → REGISTRO_CORREO_EXISTENTE (200 uniforme)
            3. NUEVO · si $cedula !== null: cédula repetida (FOR UPDATE)      → 'DATOS_DUPLICADOS'
            4. INSERT persona, usuario, rol, código (:81-109) → commit (:110) → REGISTRO_CREADO
       ├─ 'DATOS_DUPLICADOS'  → 409 con el mensaje único (PersonaCtrl.php:139-141), sin esperar
       ├─ REGISTRO_CREADO     → envía el código (:143) → auditoría (:149) → esperarTiempoMinimo (:150) → 200
       └─ CORREO_EXISTENTE    → (solo local) registro-omitido (:144-148) → auditoría → esperarTiempoMinimo → 200 igual
```

**Orden de las comprobaciones (decisión D-05).** La cédula se comprueba **después** del correo. Razón: así un correo ya registrado recibe siempre el 200 uniforme (G-3) aunque traiga una cédula repetida, y el camino «correo existente» no cambia en nada; la cédula repetida solo produce 409 cuando el correo es nuevo. Costo: ninguno, porque ambos caminos calculan los hashes Argon2id antes de entrar en la transacción (`PersonaCtrl.php:124-126`) y terminan con `esperarTiempoMinimo`.

**Ramas HTTP.** 400 (formato, sin cambio), 409 (usuario, teléfono o cédula; mensaje único), 429 (sin cambio), 500 (sin cambio), 200 (uniforme, sin cambio). El **422** no interviene.

**Orden del plan (ver H7).** Precondiciones y evidencias (T-01) → consulta de cédulas repetidas y puerta (T-02, T-03) → script de pruebas (T-04) → línea base «antes» (T-05) → cambio de `PersonaMdl` y `PersonaCtrl` (T-06, T-07) → `php -l`, humo y commit C1 (T-08) → scripts de evidencia (T-09) → pruebas funcionales, de carrera, de G-1…G-5, de tiempos y de seguridad (T-10…T-14) → documentación y commit C2 (T-15) → verificación en la app (T-16) → puerta manual (T-17) → verificación global (T-18).

---

## H4 · Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN | Tareas | Prueba / verificación |
|--------------------|--------|-----------------------|
| G-6 / RN-01, RN-02, RN-03 | T-06, T-08 | AC-T-06, AC-T-08, casos C01…C09 de `hu003_cedula_unica.sh` (AC-T-10) |
| G-03 cédula repetida → 409 sin cambios / RN-04 | T-07, T-10 | casos C02, C03, C08, C13 |
| G-03 cédula nueva y sin cédula siguen igual / RN-01 | T-10 | casos C01, C05, C06, C07 |
| G-03 dos simultáneos: un 200 y un 409 / RN-08 | T-11 | casos C14 (10 rondas × 2, y una de × 5) |
| RN-09 sin 500 ni bloqueos | T-11, T-14 | casos C15, C16, C18 |
| DC-10 mensaje único / RN-04 | T-07, T-10, T-14 | casos C12, C13 (`cmp`), AC-T-14 |
| DC-11 sin índice / RN-05 | T-06, T-14 | `git diff` de `anexos/`, `SHOW INDEX`, caso C19 |
| DC-11 cédulas históricas repetidas / RN-10 | T-02, T-03 | AC-T-02, AC-T-03 |
| RN-06 correo repetido uniforme | T-10 | caso C11 (a y b) |
| RN-07 formato sin cambio | T-10 | caso C04 |
| G-04 y RN-11 tiempos | T-05, T-13 | AC-T-13 (P-02, P-23, `P02v1`; caso C17) |
| RN-12 sin datos personales en logs | T-14 | AC-T-14 |
| RN-13 renombre de constante | T-06, T-07, T-14 | `grep` de AC-T-14 |
| RN-14 flujos G-1…G-5 | T-05, T-12 | AC-T-12 (`g_identico` con la sustitución del 409) |
| RN-15 documentación | T-15 | AC-T-15 |
| RN-16 la app muestra el texto | T-16, T-17 | AC-T-16, AC-T-17 |
| RN-17 datos de prueba acotados | T-01, T-04, T-18 | AC-T-01, AC-T-18 |

### Checklist de calidad del HLT

- [x] Las 11 secciones existen y están completas.
- [x] Sin marcadores pendientes.
- [x] Cada RN mapea a ≥ 1 tarea (cobertura 100 %).
- [x] Cada tarea tiene criterio de aceptación verificable (H7.2) y ficha de checks (H9).
- [x] No contradice `CLAUDE.md` raíz ni `desarrollador-php.md` (consultas preparadas, `respuestaErrorSimple`, sin 422).
- [x] Referencias `ruta:línea` leídas contra el repositorio el 2026-11-11 (estado **anterior** a HLT-12; T-06 y T-07 localizan por texto, ver «Orden de ejecución»).
- [x] Decisiones cerradas en H5; las preguntas no bloqueantes están numeradas PU-1…PU-4.

### Discrepancias entre la HU y el código real (registradas)

| # | HU dice | Código real | Impacto | Recomendación adoptada |
|---|---------|-------------|---------|------------------------|
| X-1 | G-6: «el registro no comprueba la cédula (`PersonaMdl.php:57-62`) y `per_cedula` no tiene índice único (`sist_generico.sql:32`)» | Cierto: la consulta de `:57-62` solo compara `usu_usuario` y `per_telefono`; `sgen_persona` solo tiene la clave primaria (`sist_generico.sql:95`) y `idx_per_correo` (`seguridad_02_recuperacion.sql:28-30`); `per_telefono` tampoco tiene índice | La consulta de cédula recorrerá la tabla igual que la de teléfono (`type=ALL`); con aislamiento REPEATABLE READ esa lectura con bloqueo cubre también los huecos y por eso impide la carrera sin índice | Documentado; se prueba (T-11) y se registra el nivel de aislamiento (T-01); ver R-01 y PU-2 |
| X-2 | G-6: «La app muestra el mensaje del servidor … (`registro.page.ts`)» | El texto no lo muestra `registro.page.ts`: lo toma el `errorInterceptor` (`error.interceptor.ts:26-27`, toast en `:59`) y lo guarda `PersonaStore` (`personaStore.ts:49-56`), y la página lo pinta en el recuadro (`registro.page.html:361-364`) | Ninguno funcional: el texto del servidor se ve dos veces (toast y recuadro) | T-16 lo verifica sin cambios de código |
| X-3 | G-6: «409 con un mensaje que **incluya la cédula**» y DC-10: «un solo mensaje … que no revele cuál de los tres está repetido» | Contradicción interna de la HU: el mensaje de DC-10 contiene la palabra «cédula» (no su valor) | Una lectura literal de G-6 («incluya la cédula») sugeriría devolver el número, lo que filtraría el dato | Gana DC-10: mensaje único con la palabra, nunca el valor (RN-04, RN-12) |
| X-4 | G-4 (HU): el 409 de usuario o teléfono dice `El nombre de usuario o el teléfono ya están registrados` | Es el texto actual (`PersonaCtrl.php:140`) y lo afirma `hlt06_bateria.sh:172` (P-11a); DC-10 lo reemplaza por el mensaje único | P-11a fallaría tras el cambio | T-09 actualiza `hlt06_bateria.sh:172`; la HU no se edita en este HLT (pendiente del usuario) |
| X-5 | G-6: «persona activa» | `per_estado = '1'` es el criterio que ya usan las consultas de duplicados (`PersonaMdl.php:61,75`); las cuentas pendientes sin verificar durante 7 días pasan a `per_estado = '0'` (`VerificacionMdl.php:166-183`) | Una cédula de un registro abandonado se libera a los 7 días | RN-02 |
| X-6 | La app exige 10 dígitos exactos de cédula | `registro.page.ts:146-155` rechaza otras longitudes y `:201` solo limita a 13; el backend acepta 10 a 13 (`PersonaCtrl.php:100`) | Una cédula de 11 a 13 dígitos (por ejemplo un RUC) solo entra por API | Sin cambio; un RUC de 13 dígitos y la cédula de 10 de la misma persona **no** se consideran iguales (PU-3) |
| X-7 | — (la planificación pide normalizar la cédula para comparar: espacios, etc.) | Hoy cualquier cédula llega solo con dígitos: `limpiarDatos` hace `trim` (`BaseCtrl.php:32`) y el controlador exige `^[0-9]{10,13}$` (`PersonaCtrl.php:100`); lo que sí puede traer espacios, guiones o puntos son filas históricas insertadas fuera del registro | La normalización solo importa en el lado de la **base** | RN-02: se normaliza la columna con `REPLACE`/`TRIM` y se compara; se listan los formatos históricos en T-02 |
| X-8 | — | `hlt06_bateria.sh:167` (P-12) espera un mensaje de registro obsoleto y ya falla antes de este HLT (documentado en HLT-12 v2, X-8) | Falso fallo preexistente | Se registra como preexistente en T-05 y no se corrige aquí |
| X-9 | — | HLT-12 conserva el 409 antiguo en `hu003_flujos_cuenta.sh` (variable `MENSAJE_409`) | Tras este HLT el valor por defecto debe ser el nuevo | T-09 |

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Mensaje del 409 (DC-10) | Mensajes distintos por campo · uno solo | **Uno solo:** `El nombre de usuario, el teléfono o la cédula ya están registrados`, con HTTP 409 | Cerrada por la HU. Importante: no impide que alguien deduzca la existencia de una cédula (ver R-02); solo evita decir cuál campo falló | No |
| D-02 | Índice único sobre `per_cedula` (DC-11) | Crearlo · no crearlo | **No** | Cerrada por la HU. Existen datos históricos sin revisar y un índice único no admitiría cédulas con distinto formato; la comprobación con `FOR UPDATE` basta si el aislamiento es REPEATABLE READ (R-01) | No |
| D-03 | Qué es «persona activa» | `per_estado='1'` · además `per_situacion='A'` | **`per_estado = '1'`** | Es el criterio de las otras tres comprobaciones (`PersonaMdl.php:61,75`); una cuenta pendiente `P` bloquea su cédula igual que su usuario, su teléfono y su correo | No |
| D-04 | Normalización de la cédula para comparar | Comparar crudo · normalizar en PHP · normalizar la columna en SQL · ambas | **Ambas, en un solo punto:** el modelo normaliza la entrada con `preg_replace('/[ .\-]/', '', trim($cedula))` y la consulta normaliza la columna con `REPLACE(REPLACE(REPLACE(TRIM(p.per_cedula), ' ', ''), '-', ''), '.', '')`. Se guarda en `INSERT` el valor **tal como llegó** (sin cambiar lo que se almacena) | `REPLACE` es portátil (MySQL 5.7, 8 y MariaDB; `REGEXP_REPLACE` no existe en 5.7 y el hosting aún no está definido, DH-10/DH-11). La entrada ya llega solo con dígitos, pero el modelo no debe depender de ello | No |
| D-05 | Posición de la comprobación | Dentro de la misma consulta que usuario/teléfono · consulta aparte antes del correo · consulta aparte después del correo | **Consulta aparte, después de la de correo y antes del `INSERT`**, en la misma transacción y con `FOR UPDATE` | Preserva G-3 (correo repetido siempre uniforme, RN-06) y no altera la consulta con `JOIN` de usuario/teléfono (`:57-62`); mismo patrón que la consulta de correo (`:73-79`) | No |
| D-06 | Tiempo de respuesta del 409 | Añadir espera de 2 s · mantener sin espera | **Mantener sin espera**, igual que hoy | El 409 no pertenece a la familia de respuestas uniformes (se distingue por su código HTTP); esperar 2 s empeoraría la experiencia y no ocultaría nada (RD-7). Los dos caminos 200 siguen pasando por `esperarTiempoMinimo` | No |
| D-07 | Nombre de la constante | Conservar `REGISTRO_USUARIO_O_TELEFONO_DUPLICADO` · renombrar | **Renombrar a `REGISTRO_DATOS_DUPLICADOS`** (valor `'DATOS_DUPLICADOS'`) | El nombre dejaría de describir la condición (ahora cubre cédula); solo la usan `PersonaMdl.php` (`:13,70,115`) y `PersonaCtrl.php:139`; costo del cambio: 4 líneas y ninguna referencia externa (el `grep` previo de T-01 lo confirma) | No |
| D-08 | Qué hacer si ya hay cédulas repetidas (DC-11) | Bloquear todo · bloquear solo el cierre · seguir | **T-03 queda `BLOQUEADA` hasta que el usuario responda** una de tres opciones (A dejar como están: la comprobación solo afecta a registros nuevos; B las corrijo yo a mano en la base y se repite la consulta; C aplazar el HLT). Las tareas de código (T-06 en adelante) esperan a la respuesta A o B | No se toca ningún dato (RN-10); la regla nueva no depende de que no haya repetidas, pero el usuario debe saberlo antes | No |
| D-09 | Comportamiento ante cédulas históricas repetidas al registrar | Rechazar siempre (cualquier coincidencia) · rechazar solo si hay una | **Rechazar si hay al menos una coincidencia** (`LIMIT 1`) | Cualquier coincidencia significa que ya hay una persona activa con esa cédula | No |
| D-10 | Si la prueba de carrera falla (dos 200 con la misma cédula) | Añadir índice único · usar `GET_LOCK` · detenerse | **Detenerse (`BLOQUEADA`)** y consultar al usuario con las dos opciones; **no** se añade ninguna en este HLT | Ambas contradicen DC-11 o añaden mecanismo nuevo; es decisión del usuario (RD-6) | No |
| D-11 | Documentación | Solo README · README y prueba manual | README de `rest_usuario` (`:154`, `:158`) y paso G-6 en `PRUEBAS-MANUALES-HU-003.md` | La HU pide README; el paso manual completa G-02 de HLT-12 | No |
| D-12 | Scripts de prueba | Ampliar `hu003_flujos_cuenta.sh` · script nuevo | **Script nuevo `hu003_cedula_unica.sh`** con las ayudas de `lib/hu003_comun.sh` y un parámetro `MODO=antes\|despues`. `hu003_flujos_cuenta.sh` solo cambia el valor por defecto de `MENSAJE_409` (T-09) | La línea base de HLT-12 no se toca; `MODO=antes` documenta el comportamiento actual y demuestra que las pruebas detectan el cambio (control negativo natural) | No |
| D-13 | Cambios en la app | Ninguno si el texto se ve · cambio mínimo si no se ve | **Solo verificación** (T-16). El texto del servidor ya se muestra por dos vías (X-2). Si T-16 comprobara que **no** se muestra, el cambio mínimo se limita al recuadro de error de `registro.page.html` | La HU pide «verificar que el texto se vea bien» | No |
| D-14 | Commits | Uno · uno por fase | **C1** (T-08: `PersonaMdl.php` y `PersonaCtrl.php`) y **C2** (T-15: `README.md`) en `rest_usuario`; en `criterioKellyApp` solo si T-16 cambiara código. Locales, nunca `push`; autorización recogida en T-01 | Código y documentación separados | No |
| D-15 | Localización del código a editar | Por número de línea · por texto | **Por texto** (HLT-12 desplaza líneas) | Ver «Orden de ejecución» | No |
| D-16 | Terminaciones de línea | Normalizar · conservar | **Conservar** la de cada archivo (`PersonaCtrl.php` y `PersonaMdl.php`: verificar con `file` en T-06; `README.md`: CRLF en HLT-12 X-7) | `git diff --numstat` debe mostrar solo las líneas cambiadas | No |
| D-17 | Cédulas ficticias de prueba | Usar cédulas reales · usar un rango ficticio | **`9990000001`…`9990009999`** (10 dígitos que no corresponden a una cédula real); T-01 aborta si alguna `999%` ya existe | Evita colisionar con datos reales y aísla el borrado | No |
| D-18 | Privacidad en evidencias | Guardar cédulas completas · enmascarar | **Enmascarar** (`CONCAT(LEFT(c,2), '******', RIGHT(c,2))`) en toda evidencia con datos reales; la lista completa solo se muestra al usuario en la puerta T-03 si la pide | Las cédulas de personas reales son datos personales | No |

### Preguntas para el usuario (no bloquean el inicio; cada una trae su recomendación)

| ID | Pregunta | Opciones | Recomendación |
|----|----------|----------|---------------|
| PU-1 | **Enumeración y suplantación de cédulas.** El mensaje único no oculta que «algo ya existe»: quien controla los demás campos puede saber si una cédula está registrada (R-02), y quien registra una cédula ajena con un correo propio impide que su dueño real se registre con ella (R-03). ¿Se acepta, o se quiere validar la cédula con un servicio externo o con la verificación de correo antes de reservarla? | Aceptar (la HU ya lo decidió) · pedir otra historia | **Aceptar**: la cédula es opcional y el límite público (60 por minuto por IP) frena la consulta masiva |
| PU-2 | **Nivel de aislamiento en producción.** La protección contra la carrera depende de REPEATABLE READ (por defecto en MySQL y MariaDB). Si el hosting usa READ COMMITTED, `FOR UPDATE` sin índice no cubre huecos y dos registros simultáneos podrían pasar. ¿Se confirma el aislamiento del hosting cuando se elija (DH-10/DH-11)? | Confirmarlo al elegir hosting · añadir índice único o `GET_LOCK` (contra DC-11) | **Confirmarlo y dejarlo escrito en el README** |
| PU-3 | **Cédula (10 dígitos) y RUC (13 dígitos) de la misma persona** se tratan como cédulas distintas. ¿Basta? | Sí · comparar los 10 primeros dígitos | **Sí, basta**: compararlos exigiría una regla de negocio que la HU no pide |
| PU-4 | **La HU** conserva en G-4 el texto antiguo del 409. ¿Se actualiza el texto de la HU a DC-10? | Sí · no | **Sí** (lo hace quien mantiene la HU; este HLT no edita `docs/Historia_usuario/`) |

---

## H6 · Revisión del requerimiento por parte de un senior

### Hallazgos adversariales (ronda 1) y cómo se resolvieron

| # | Hallazgo | Severidad | Resolución incorporada |
|---|----------|-----------|------------------------|
| H-1 | **Enumeración por el 409 de cédula.** El mensaje único no impide el oráculo: enviando usuario, teléfono y correo nuevos con la cédula buscada, un 409 significa «esa cédula existe». Es idéntico al oráculo que ya existe para usuario y teléfono | **Alta** | No se puede eliminar sin cambiar la HU: D-01 lo declara, R-02 lo registra con su mitigación (límite público 60/min/IP, `LimitadorPeticiones.php:11-12`; cédula opcional; el 409 no devuelve el valor ni el campo) y PU-1 se lo pregunta al usuario. T-14 verifica por `cmp` que los tres 409 son idénticos y que el cuerpo no contiene dígitos |
| H-2 | **Carrera sin índice.** Sin índice único, dos registros simultáneos pueden pasar la consulta antes de que ninguno inserte | **Alta** | RN-03/RN-08: el `FOR UPDATE` sobre una columna sin índice recorre la tabla y bloquea registros y huecos en REPEATABLE READ, por lo que el segundo registro espera al commit del primero y luego ve la fila. T-11 lo **demuestra** (10 rondas × 2, una × 5) y T-05 con `MODO=antes` demuestra que **hoy** pasan los dos (control). T-01 registra el aislamiento; D-10 y PU-2 cubren el caso READ COMMITTED |
| H-3 | **Deadlock por la nueva consulta.** Dos registros distintos pueden tomar bloqueos en orden cruzado (huecos de `sgen_usuario` y recorrido de `sgen_persona`) y uno morir con el error 1213, que el `catch` (`PersonaMdl.php:112-118`) relanza como 500 | Media | La consulta de cédula sigue el mismo patrón que la de correo (`:73-79`), que ya recorre `sgen_persona` con bloqueo. T-05 corre las rondas de cédulas **distintas** antes del cambio (línea base) y T-11 las repite después (RN-09: 20 × 200, sin 500 ni `Deadlock` en los logs). Si apareciera un 500, T-11 queda `BLOQUEADA` con el hallazgo |
| H-4 | **Cédulas históricas repetidas.** Con el nuevo control, un registro con una cédula repetida en la base se rechaza aunque ninguna de las dos filas sea suya | Media | D-09 (basta una coincidencia); T-02 lista las repetidas (enmascaradas) y T-03 pregunta; RN-10 prohíbe borrar |
| H-5 | **Historiales con formato distinto** (espacios, guiones, puntos) harían pasar un duplicado | Media | RN-02/D-04: se normaliza la columna; T-02 lista los formatos distintos de 10–13 dígitos; el caso C08 lo prueba con un fixture |
| H-6 | **Registros sin cédula**: un `= NULL` o un valor vacío podría coincidir o bloquear a todos | Media | RN-01: con `null` no se ejecuta la consulta; `''` también es `null` (`PersonaCtrl.php:128`); los casos C06 y C07 registran dos sin cédula seguidos y exigen 200 |
| H-7 | **Impacto en el tiempo mínimo de 2 s** (anti-enumeración de correo) | Media | La consulta añade milisegundos frente a un piso de 2000 ms más 0-250 ms de variación (`BaseCtrl.php:11-12,65`); el camino «correo existente» no la ejecuta (D-05) y el camino «correo nuevo» sí, pero el tiempo lo dominan los dos hashes Argon2id. T-10 (caso C17) y T-13 miden: mínimo ≥ 2,0 s y diferencia de medianas < 0,3 s con y sin cédula; P-02/P-23 comparan con la línea base |
| H-8 | **Orden correo/cédula rompe G-3**: un registro con correo existente y cédula repetida respondería 409 en vez del 200 uniforme y filtraría datos | Alta | D-05/RN-06: la cédula se comprueba después del correo; el caso C11(b) lo prueba |
| H-9 | **El 409 y el 200 se distinguen por tiempo**: 409 responde sin espera | Baja | Ya ocurre hoy con usuario/teléfono (D-06); el código HTTP ya los distingue. No se cambia |
| H-10 | **Pruebas pasan en vacío**: si el servidor no ejecuta la comprobación (por ejemplo porque se editó otro archivo), los casos «esperado 409» fallarían, pero los de «200» pasarían | Media | `MODO=antes` (T-05) exige exactamente el comportamiento viejo (200 en C02, 200 en C14 doble); `MODO=despues` exige el nuevo; ambas corridas se guardan y el contraste entre ellas es la prueba |
| H-11 | **La batería de HLT-12 falla por el nuevo mensaje** (G-4) y se concluye que hay una regresión | Media | RN-14: la comparación sustituye el texto antiguo por el nuevo en la línea base y exige que no haya ninguna otra diferencia; T-09 cambia el valor por defecto de `MENSAJE_409` |
| H-12 | **Líneas desplazadas por HLT-12**: el agente edita la línea 139 equivocada | Media | D-15: localización por texto; AC-T-06 y AC-T-07 dan el fragmento exacto de «antes» y «después» y exigen que `git diff --numstat` coincida |
| H-13 | **Fuga de cédulas reales en la evidencia** | Media | D-18: enmascarado; T-14 comprueba que `cedula-unica/` no contiene ninguna cédula real (solo `999…`) |
| H-14 | **Renombrar la constante deja una referencia colgada** y el controlador cae en el camino por defecto (sin 409) | Alta | RN-13; AC-T-14: `grep` en los 5 proyectos y `php -l`; caso C12 prueba el 409 de usuario y teléfono tras el cambio |
| H-15 | **Registros simultáneos agotan el límite público (60/min) o el de 10 códigos por IP** y la prueba de carrera devuelve 429 | Media | D-17/AC-T-04: fixtures `liberar_ip` y `limpiar_contadores` antes de cada ronda; el script aborta con `exit 2` si encuentra 429 |

### Checklist (ronda 2, sobre el HLT ya corregido)

| # | Ítem | Veredicto | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 reproduce G-6, DC-10 y DC-11; el 409 único no incluye la cédula (X-3) |
| 2 | Reglas de negocio | ✅ | RN-01…RN-17 son booleanas; RN-06 y RN-14 acotan la única excepción |
| 3 | Impacto | ✅ | `grep` de `per_cedula` y de la constante: solo `PersonaMdl.php` y `PersonaCtrl.php`; la app solo muestra texto; `hlt06_bateria.sh:172` identificada |
| 4 | Consistencia arquitectónica | ✅ | `Ctrl` valida y delega; `Mdl` hace SQL con `Enlace::ejecutarConsultaSimpleFila`; respuestas por `respuestaErrorSimple`; sin 422 |
| 5 | Riesgos | ✅ | Ver tabla; Alta: R-01, R-02 |
| 6 | Simplicidad | ✅ | Una consulta, una constante renombrada, un mensaje; sin índice, sin tabla, sin función nueva fuera de la normalización |
| 7 | Seguridad | ✅ | Consulta preparada; sin valor de cédula en respuestas ni logs; enumeración declarada y mitigada; privacidad en evidencias |
| 8 | Cobertura | ✅ | 100 % |
| 9 | Determinismo | ✅ | Código «antes» y «después» y comandos exactos en H7.2 |
| 10 | Ejecutabilidad | ✅ | Dependencias explícitas; puertas T-03 y T-17 bien definidas |

### Riesgos (severidad y mitigación)

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-01 | La protección contra la carrera depende de REPEATABLE READ y de que no haya índice único; con READ COMMITTED en producción dos registros simultáneos podrían pasar | **Alta** | H-2; T-01 registra `@@tx_isolation`; T-11 lo prueba; PU-2; D-10 (si falla, se detiene y se consulta) |
| R-02 | El 409 permite deducir si una cédula está registrada (oráculo de enumeración), aunque el mensaje no diga el campo | **Alta** | H-1; D-01; PU-1; límite público 60/min/IP; la cédula es opcional; el 409 no revela el valor |
| R-03 | Suplantación: quien registre una cédula ajena con su propio correo impide que el dueño real la use (la cédula no se verifica); si la cuenta no se activa, se libera a los 7 días (`VerificacionMdl.php:166-183`) | Media | La cédula es opcional y el registro sigue siendo posible sin ella; PU-1 |
| R-04 | Cédulas históricas repetidas bloquean registros nuevos con esa cédula | Media | T-02, T-03, D-08, D-09 |
| R-05 | Lecturas con bloqueo sobre una tabla sin índice serializan los registros y pueden producir deadlocks | Media | H-3; T-11; mismo patrón que la consulta de correo, ya existente |
| R-06 | P-11a de `hlt06_bateria.sh` falla por el nuevo texto | Baja | T-09 |
| R-07 | Líneas desplazadas por HLT-12 | Media | D-15 |
| R-08 | Prueba sin sensibilidad (pasa en vacío) | Media | H-10: `MODO=antes` y `MODO=despues` |
| R-09 | Cédulas reales en la evidencia | Media | D-18, H-13 |
| R-10 | Las baterías agotan límites por IP y causan 429 | Baja | H-15 |

### Veredicto

**APROBADO.** Ronda 1: `APROBADO CON CAMBIOS` con los hallazgos H-1…H-15 (de ellos 4 de severidad Alta: H-1, H-2, H-8, H-14); todos se incorporaron al plan (D-04, D-05, D-07, D-08, D-10, D-12, D-15, D-17, D-18, T-05, T-11, T-14) o se declararon como riesgo aceptado con pregunta al usuario (H-1 → R-02/PU-1; H-2 → R-01/PU-2). Ronda 2: sin cambios pendientes; el HLT es ejecutable sin decisiones de diseño, la única excepción a «sin cambio de comportamiento» queda acotada (RN-06, RN-14) y protegida por la batería de HLT-12 y por una prueba con control negativo (`MODO=antes`).

---

## H7 · Plan de tareas

Evidencias de este HLT: `docs/Planificacion/evidencias/cedula-unica/` (la crea T-01) con `linea_base/` y `despues/`. `PHP=/c/xampp/php/php.exe`, `MYSQL=/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly`. Rutas relativas a `C:\xampp\htdocs\criterio_kelly`; comandos en Bash (Git Bash). `E=docs/Planificacion/evidencias/cedula-unica`, `EV=docs/Planificacion/evidencias`. En los bloques que hacen `cd docs/Planificacion/evidencias`, las rutas de evidencias son relativas a esa carpeta (`cedula-unica/…`, `correo-A/…`) y `LOG=../../../rest_usuario/logs/correos/correos.log` es la ruta de `LOG_CORREOS` (HLT-12 completado; esta cadena vive solo en estos comandos, nunca dentro de un `.sh`). **Los números de línea citados son los del estado anterior a HLT-12; el código se localiza por su texto (D-15).**

### H7.1 Tabla de tareas

| ID | Agente | Tarea | Archivos | Depende de | Criterio de aceptación (comando en H7.2) | Cubre |
|----|--------|-------|----------|------------|------------------------------------------|-------|
| T-01 | desarrollador-php | Verificar precondiciones (HLT-12 v2 completado, scripts y línea base de HLT-12, servicios arriba, repos limpios, aislamiento, ausencia de cédulas `999%`, referencias de la constante) y crear la carpeta de evidencias | `docs/Planificacion/evidencias/cedula-unica/` (nueva) | — | AC-T-01 | RN-05, RN-13, RN-17, R-01, D-14 |
| T-02 | desarrollador-php | Ejecutar la consulta de solo lectura que detecta cédulas ya repetidas (y los formatos históricos), con datos enmascarados | `…/cedula-unica/linea_base/duplicadas.txt`, `…/formatos.txt` | T-01 | AC-T-02 | RN-10, DC-11, D-18 |
| T-03 | desarrollador-php | **Puerta DC-11:** si hay cédulas repetidas, quedar `BLOQUEADA`, listar los casos y pedir la decisión al usuario sin borrar nada; si no hay, marcar `HECHA` | `…/cedula-unica/linea_base/confirmacion-cedulas.txt` (solo si hay repetidas) | T-02 | AC-T-03 | RN-10, D-08 |
| T-04 | desarrollador-php | Crear `hu003_cedula_unica.sh` (modos `antes` y `despues`, casos C01…C19) y validarlo | `docs/Planificacion/evidencias/hu003_cedula_unica.sh` (nuevo) | T-01, T-03 | AC-T-04 | RN-01…RN-12, H-10 |
| T-05 | desarrollador-php | Línea base «antes» con el código sin tocar: la batería G, `hu003_cedula_unica.sh MODO=antes` y las baterías de tiempos P-02/P-23 | `…/cedula-unica/linea_base/g_antes.txt`, `cedula_antes.txt`, `hlt06.txt`, `hlt06v2.txt`, `tiempos_antes.txt` | T-04 | AC-T-05 | G-04, RN-11, RN-14, H-2, H-3, H-10 |
| T-06 | desarrollador-php | Cambiar `PersonaMdl.php`: renombrar la constante y añadir la comprobación de cédula (normalizada, `FOR UPDATE`, después del correo) | `rest_usuario/modelos/PersonaMdl.php` (constante `:13`, bloque tras `:79`, `:70` y `:115`) | T-05 | AC-T-06 | G-6, RN-01, RN-02, RN-03, RN-13, D-04, D-05, D-07 |
| T-07 | desarrollador-php | Cambiar `PersonaCtrl.php`: usar la constante nueva y el mensaje único del 409 | `rest_usuario/controladores/PersonaCtrl.php` (bloque del 409, `:139-141`) | T-06 | AC-T-07 | DC-10, RN-04, RN-13, D-01 |
| T-08 | desarrollador-php | Verificar sintaxis y humo con `curl` (5 casos) y hacer el commit C1 | `rest_usuario/modelos/PersonaMdl.php`, `rest_usuario/controladores/PersonaCtrl.php` | T-07 | AC-T-08 | G-03, E-04 |
| T-09 | desarrollador-php | Actualizar los scripts de evidencia al mensaje nuevo: P-11a en `hlt06_bateria.sh` y el valor por defecto de `MENSAJE_409` en `hu003_flujos_cuenta.sh` | `docs/Planificacion/evidencias/hlt06_bateria.sh:172`, `docs/Planificacion/evidencias/hu003_flujos_cuenta.sh` | T-08 | AC-T-09 | RN-14, X-4, X-9, H-11 |
| T-10 | desarrollador-php | Pruebas funcionales con `curl`: `hu003_cedula_unica.sh MODO=despues` (casos C01…C13, C17, C18, C19) | `…/cedula-unica/despues/cedula_funcional.txt` | T-08, T-09 | AC-T-10 | G-03, RN-01…RN-07, RN-11, RN-12 |
| T-11 | desarrollador-php | Pruebas de carrera: dos simultáneos misma cédula (10 rondas y una de 5), cédulas distintas (10 rondas) y sin cédula; tres corridas completas | `…/cedula-unica/despues/carrera_1.txt`, `carrera_2.txt`, `carrera_3.txt` | T-10 | AC-T-11 | G-03, RN-08, RN-09, R-01, R-05 |
| T-12 | desarrollador-php | Batería G de HLT-12 con el mensaje nuevo y comparación con la línea base (única diferencia admitida: el texto del 409) | `…/cedula-unica/despues/g_despues.txt` | T-09, T-11 | AC-T-12 | RN-14, G-01 de HU-003 |
| T-13 | desarrollador-php | Tiempos: repetir P-02 y P-23 (y `P02v1`) y el caso de tiempos con y sin cédula; comparar con la línea base | `…/cedula-unica/despues/hlt06.txt`, `hlt06v2.txt`, `tiempos_despues.txt` | T-12 | AC-T-13 | G-04, RN-11 |
| T-14 | desarrollador-php | Verificación de seguridad y alcance: diff acotado, ausencia de índice, uniformidad de los tres 409 (`cmp`), logs de error, referencias a la constante vieja, privacidad de la evidencia | `rest_usuario/**/*.php` (solo lectura), `…/cedula-unica/despues/seguridad.txt` | T-13 | AC-T-14 | RN-04, RN-05, RN-12, RN-13, H-1, H-13, H-14 |
| T-15 | desarrollador-php | Documentar: `rest_usuario/README.md` (409 y campo `cedula`) y el paso G-6 en `PRUEBAS-MANUALES-HU-003.md`; commit C2 | `rest_usuario/README.md:154,158`, `docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md` | T-14 | AC-T-15 | RN-15, D-11 |
| T-16 | desarrollador-ionic | **Verificación de solo lectura** de cómo la app muestra el 409 del registro y de que ninguna parte de la app depende del texto antiguo; cambio mínimo solo si el texto no se mostrara | `criterioKellyApp/src/app/compartidos/interceptors/error.interceptor.ts`, `paginas/util/store/personaStore.ts`, `paginas/suscripcion/registro/registro.page.html` y `registro.page.ts` (lectura) | T-08 | AC-T-16 | RN-16, D-13, X-2 |
| T-17 | desarrollador-php | **Puerta G-6 manual:** el usuario registra en la app una cédula repetida y comprueba el mensaje; el agente verifica en la base que no se creó nada | `…/cedula-unica/despues/g6_verificacion.txt` | T-15, T-16 | AC-T-17 | G-6, RN-16 |
| T-18 | desarrollador-php | Verificación global: `php -l`, `git` de los commits, alcance del diff, limpieza de datos de prueba y estado final de la base | `rest_usuario/**/*.php` (solo lectura), base `sist_criteriokelly` | T-14, T-15, T-16 | AC-T-18 | G-03, G-04, RN-17 |

**Resumen:** 18 tareas: **17 `desarrollador-php`** y **1 `desarrollador-ionic`** (T-16). Camino crítico: T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11 → T-12 → T-13 → T-14 → T-15 → T-18. Paralelizables (RS-3): T-16 con T-09…T-15 (solo lectura sobre la app; depende únicamente de T-08). **Nunca** en paralelo dos corridas de baterías, ni una corrida con otro HLT. T-17 no bloquea T-18: si el usuario no la ejecuta, el estado global es `PARCIAL`.

### H7.2 Comandos de aceptación

**AC-T-01**
```bash
test "$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://localhost/criterio_kelly/rest_usuario/)" != 000 && echo apache_ok
/c/xampp/mysql/bin/mysql.exe -u root -N -e "SELECT 1" && echo mysql_ok       # si no responden, iniciar Apache y MySQL desde el panel de XAMPP
git -C rest_usuario status --short                                           # vacío (si no, parar y avisar)
# HLT-12 v2 completado (o PARCIAL solo por T-40) y sus piezas
test -f $EV/hu003_flujos_cuenta.sh && test -f $EV/lib/hu003_comun.sh && test -f $EV/correo-A/linea_base/g_norm.txt && echo hlt12_ok   # si falta alguno: BLOQUEADA (ver «Orden de ejecución»)
test -f rest_usuario/correo/cargarCorreo.php && echo modulo_correo_ok
test -f $EV/PRUEBAS-MANUALES-HU-003.md && echo manuales_ok
# Aislamiento y motor (R-01)
/c/xampp/mysql/bin/mysql.exe -u root -N -e "SELECT @@tx_isolation" | tee /dev/stderr   # REPEATABLE-READ esperado; si es otro, anotar y avisar (PU-2)
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA='sist_criteriokelly' AND TABLE_NAME='sgen_persona'"   # InnoDB
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SHOW INDEX FROM sgen_persona" | awk '{print $3}' | sort -u   # PRIMARY, idx_per_correo (sin índice de cédula)
# Datos de prueba (D-17)
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT COUNT(*) FROM sgen_persona WHERE per_cedula LIKE '999%'"   # 0
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT COUNT(*) FROM sgen_usuario WHERE usu_usuario REGEXP '^ck_prueba_'"   # 0 (si no, bash $EV/lib/limpiar_datos_prueba.sh)
# Referencias de la constante (D-07, RN-13)
grep -rn "USUARIO_O_TELEFONO_DUPLICADO" rest_usuario rest_criteriokelly rest_suscripcion rest_divisas criterioKellyApp/src --include=*.php --include=*.ts --exclude-dir=vendor --exclude-dir=node_modules   # solo PersonaMdl.php (3 líneas) y PersonaCtrl.php (1)
grep -rn "per_cedula" rest_usuario rest_criteriokelly rest_suscripcion --include=*.php --exclude-dir=vendor   # solo PersonaMdl.php (INSERT)
mkdir -p $E/linea_base $E/despues
git -C rest_usuario log --oneline | head -1 > $E/linea_base/commit_inicial.txt
md5sum rest_usuario/.env > $E/linea_base/env.md5
wc -l rest_usuario/logs/php_errores.log rest_usuario/logs/php_errors.log > $E/linea_base/logs_error_wc.txt
file rest_usuario/modelos/PersonaMdl.php rest_usuario/controladores/PersonaCtrl.php rest_usuario/README.md > $E/linea_base/terminaciones.txt
```
Además, el agente deja en `$E/linea_base/autorizacion.txt` el texto literal con que el usuario autoriza los commits locales C1 y C2 (nunca `push`). Sin esa autorización, `BLOQUEADA` (RS-4). El `.env` no se abre (solo `md5sum`).

**AC-T-02** — consulta de **solo lectura** (no se ejecuta ningún `UPDATE`, `DELETE` ni `ALTER`); cédulas **enmascaradas** (D-18).
```bash
M="/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly"
$M -t -e "
SELECT CONCAT(LEFT(cedula_normalizada,2),'******',RIGHT(cedula_normalizada,2)) AS cedula_enmascarada,
       COUNT(*) AS personas,
       GROUP_CONCAT(per_idPersona ORDER BY per_idPersona) AS ids_persona,
       GROUP_CONCAT(per_situacion ORDER BY per_idPersona) AS situaciones
FROM (SELECT per_idPersona, per_situacion, per_estado,
             REPLACE(REPLACE(REPLACE(TRIM(per_cedula), ' ', ''), '-', ''), '.', '') AS cedula_normalizada
      FROM sgen_persona WHERE per_cedula IS NOT NULL) t
WHERE cedula_normalizada <> '' AND per_estado = '1'
GROUP BY cedula_normalizada HAVING COUNT(*) > 1;" > $E/linea_base/duplicadas.txt
$M -t -e "
SELECT COUNT(*) AS personas_activas,
       SUM(per_cedula IS NOT NULL AND TRIM(per_cedula) <> '') AS con_cedula,
       SUM(per_cedula REGEXP '^[0-9]{10,13}$') AS formato_valido,
       SUM(per_cedula IS NOT NULL AND TRIM(per_cedula) <> '' AND per_cedula NOT REGEXP '^[0-9]{10,13}$') AS formato_historico
FROM sgen_persona WHERE per_estado='1';" > $E/linea_base/formatos.txt
cat $E/linea_base/duplicadas.txt | wc -l           # 0 si no hay repetidas (salida vacía); >0 = hay filas
cat $E/linea_base/formatos.txt
```
`formatos.txt` informa cuántas filas históricas tienen un formato distinto de 10 a 13 dígitos (candidatas a la normalización de D-04). No se imprime ninguna cédula completa.

**AC-T-03** — si `duplicadas.txt` está vacío: la tarea se marca `HECHA` con la nota «sin cédulas repetidas». Si **no** está vacío: estado `BLOQUEADA` y el agente muestra la tabla de `duplicadas.txt` y pregunta, literalmente:
«La base local tiene cédulas repetidas (lista arriba, enmascarada). La regla nueva no las modifica y solo impide registros nuevos con esa cédula. ¿Qué hago? **A)** Dejarlas como están y continuar. **B)** Las corrijo yo a mano en la base y me pides repetir la consulta. **C)** Aplazar el HLT-14. No borraré ni modificaré ninguna fila.»
Con A o B (B tras repetir AC-T-02 con salida vacía o con confirmación de A), el agente guarda la respuesta literal en `$E/linea_base/confirmacion-cedulas.txt` y continúa; con C el HLT queda `BLOQUEADO`. Si el usuario necesita ver las cédulas completas, el agente las consulta solo en ese momento y no las guarda en ningún archivo.
```bash
test -s $E/linea_base/duplicadas.txt && test -s $E/linea_base/confirmacion-cedulas.txt && echo decision_registrada || (test ! -s $E/linea_base/duplicadas.txt && echo sin_repetidas)
```

**AC-T-04** — `docs/Planificacion/evidencias/hu003_cedula_unica.sh` (LF; `cd "$(dirname "$0")"; source lib/comun.sh; source lib/hu003_comun.sh`). Parámetros: `LOG_CORREOS` (obligatoria, como en HLT-12), `MODO=antes|despues` (obligatorio; otro valor: `exit 2`), `MENSAJE_409` (por defecto `El nombre de usuario, el teléfono o la cédula ya están registrados`), `SECCION=funcional|carrera|todo` (por defecto `todo`). Usa sus propias ayudas con prefijo `hu3c` (usuarios `ck_prueba_hu3c_<x>`, correos `ck.prueba.hu3c.<x>@example.com`, teléfonos `09900031NN`) y la función `registrar_ced x tel cedula [correo] [usuario]` (cédula `-` = sin campo; cédula literal vacía `""` = campo vacío). Antes de empezar: `exigir_entorno` (de HLT-12), limpieza con `lib/limpiar_datos_prueba.sh`, comprobación `SELECT COUNT(*) FROM sgen_persona WHERE per_cedula LIKE '999%'` = 0 (si no, `exit 2`). La persona de un correo se cuenta con `SELECT COUNT(*) FROM sgen_persona WHERE per_correo LIKE 'ck.prueba.hu3c.%'` (así la prueba no depende de otros datos). Antes de cada ronda de peticiones: `liberar_ip; limpiar_contadores`. Si alguna respuesta es 429, `exit 2` (H-15). Al terminar: limpieza y `NORM|LIMPIEZA|restantes=0`. Salida `OK`/`FALLO` (con `chk`) y `RESUMEN`; `exit 1` si hay `FALLO`. Casos (en `MODO=antes` la columna «esperado antes» sustituye a «esperado después»):

| Caso | Acción | Esperado **después** | Esperado **antes** (documenta el comportamiento actual) |
|------|--------|----------------------|----------------------------------------------------------|
| C01 | `registrar_ced c01 11 9990000001` | `200` con el cuerpo de registro uniforme; `per_cedula` guardada = `9990000001`; persona +1; situación `P`; 1 correo de activación | igual |
| C02 | `registrar_ced c02 12 9990000001` (usuario, teléfono y correo nuevos) | `409 {"error":"<MENSAJE_409>"}`; persona +0; `conteos` de `c02` = 0; `sgen_verificacion` +0; correos nuevos 0; `registro-omitido` +0 | `200` y persona +1 |
| C03 | Cédula con espacios alrededor (`" 9990000001 "`) y datos nuevos | `409` igual a C02 (el `trim` de `limpiarDatos`, `BaseCtrl.php:32`) | `200` |
| C04 | Formato inválido: `999000000-1`; 9 dígitos; 14 dígitos | `400 {"error":"Formato de cédula inválido. Debe contener entre 10 y 13 dígitos"}` (los dos primeros) y `400 {"error":"La cédula no puede exceder 13 caracteres"}` (el tercero); persona +0 | igual |
| C05 | `registrar_ced c05 13 9990000002` | `200`; persona +1 | igual |
| C06 | Dos registros **sin** campo `cedula` (datos distintos) | `200` y `200`; `per_cedula IS NULL` en ambos; persona +2 | igual |
| C07 | Cédula `""` | `200`; `per_cedula IS NULL` | igual |
| C08 | (fixture) `UPDATE sgen_persona SET per_cedula='999 000 0003'` de la persona `c08` (creada con `9990000003`), luego `registrar_ced c09 … 9990000003` | `409` (comparación normalizada, RN-02) | `200` |
| C09 | (fixture) `UPDATE sgen_persona SET per_estado='0'` de la persona de `c05`, luego `registrar_ced c10 … 9990000002` | `200` (una persona dada de baja no bloquea) | `200` |
| C10 | Situación de la persona de `c01` | `usu_situacion = 'P'` (una cuenta pendiente bloquea, C02) | igual |
| C11 | (a) correo de `c01` con cédula **nueva** `9990000004`; (b) correo de `c01` con cédula **repetida** `9990000001`; en ambos usuario y teléfono nuevos, una sola petición con `curl -w '%{http_code} %{time_total}'` | `200` con **cuerpo idéntico** al de C01 en (a) y (b); persona +0; correos nuevos 0; `registro-omitido` +1 por petición; tiempo ≥ 2,0 s | igual |
| C12 | Usuario repetido y teléfono repetido (cada uno, con cédula nueva y sin cédula: 4 peticiones) | `409 {"error":"<MENSAJE_409>"}` en las 4; persona +0 | `409` con el **texto antiguo** (`El nombre de usuario o el teléfono ya están registrados`) |
| C13 | `cmp` entre los cuerpos de C02, C03 y C12 (usuario y teléfono) y comparación de cabeceras (`curl -D`): mismo `Content-Type`, ninguna `Retry-After` | `iguales` | no aplica (en `antes` C02 no es 409): se registra `omitido` |
| C14 | **Carrera, misma cédula:** 10 rondas; en cada una, 2 peticiones simultáneas (`&` y `wait`) con la misma cédula (`99900100NN`, distinta por ronda) y usuario, teléfono y correo distintos por petición; más una ronda de 5 | por ronda: un `200` y un `409`; persona +1; sin 500. Ronda de 5: un 200 y cuatro 409; persona +1 | por ronda: dos `200` y persona +2 (**la carrera existe hoy**) |
| C15 | **Control, cédulas distintas:** 10 rondas de 2 simultáneos con cédulas distintas y datos distintos | 20 × `200`, sin 500 ni 409 | igual (línea base de H-3) |
| C16 | **Sin cédula, simultáneos:** 5 rondas de 2 sin cédula | 10 × `200` | igual |
| C17 | **Tiempos:** 3 registros con cédula nueva y 3 sin cédula (cada uno con `curl -w '%{time_total}'`) | mínimo ≥ 2,0 s en las 6; diferencia de medianas < 0,3 s; se registra además el tiempo de un 409 (informativo, sin exigir ≥ 2,0 s: D-06) | mínimo ≥ 2,0 s y diferencia < 0,3 s |
| C18 | `php_errores.log` y `php_errors.log`: líneas nuevas desde el inicio | 0 líneas con `Deadlock`, `1213`, `1205` o `Lock wait`; 0 líneas con `9990` | igual |
| C19 | (informativo) `EXPLAIN SELECT p.per_idPersona FROM sgen_persona p WHERE REPLACE(REPLACE(REPLACE(TRIM(p.per_cedula),' ',''),'-',''),'.','') = '9990000001' AND p.per_estado='1' LIMIT 1` y `SHOW INDEX FROM sgen_persona` | se registra el `type` (esperado `ALL`) y que no hay índice de cédula; no es criterio de OK/FALLO | igual |

`NORM|` registra para C01…C13 los códigos, mensajes y conteos (formato de HLT-12). Los datos que genera quedan acotados a `ck_prueba_hu3c_*`.
```bash
bash -n $EV/hu003_cedula_unica.sh && echo sintaxis_ok
grep -c "logs/correos\.log" $EV/hu003_cedula_unica.sh          # 0
env -u LOG_CORREOS bash $EV/hu003_cedula_unica.sh; echo "exit=$?"      # exit=2
LOG_CORREOS=<ruta vigente> MODO=otro bash $EV/hu003_cedula_unica.sh; echo "exit=$?"   # exit=2
```
(`<ruta vigente>` es `../../../rest_usuario/logs/correos/correos.log` si HLT-12 está completado; la cadena vive solo aquí, no en el script.) La validación con corrida completa es AC-T-05.

**AC-T-05** (en segundo plano; `bash $EV/lib/limpiar_datos_prueba.sh` antes de cada corrida; `LOG` = `../../../rest_usuario/logs/correos/correos.log`, relativo a `docs/Planificacion/evidencias/`)
```bash
cd docs/Planificacion/evidencias
# (a) Deriva desde HLT-12: la batería G del código actual debe igualar la línea base de HLT-12
bash lib/limpiar_datos_prueba.sh
LOG_CORREOS=$LOG bash hu003_flujos_cuenta.sh > cedula-unica/linea_base/g_antes.txt 2>&1; echo "exit=$?"            # exit=0 (el valor por defecto de MENSAJE_409 sigue siendo el antiguo hasta T-09)
diff correo-A/linea_base/g_norm.txt <(grep '^NORM|' cedula-unica/linea_base/g_antes.txt) && echo sin_deriva_hlt12
# (b) Cédula única, modo antes (documenta el comportamiento actual y la carrera de hoy)
bash lib/limpiar_datos_prueba.sh
LOG_CORREOS=$LOG MODO=antes bash hu003_cedula_unica.sh > cedula-unica/linea_base/cedula_antes.txt 2>&1; echo "exit=$?"   # exit=0
grep -c '^FALLO ' cedula-unica/linea_base/cedula_antes.txt                                                          # 0
grep -E '^(OK|FALLO) +C(02|14)' cedula-unica/linea_base/cedula_antes.txt                                            # C02 con 200 y C14 con dos 200: hoy NO se comprueba la cédula
# (c) Tiempos de HU-001 (P-02, P-23, P02v1)
bash lib/limpiar_datos_prueba.sh; bash hlt06_bateria.sh   > cedula-unica/linea_base/hlt06.txt   2>&1
bash lib/limpiar_datos_prueba.sh; bash hlt06v2_bateria.sh > cedula-unica/linea_base/hlt06v2.txt 2>&1
bash lib/limpiar_datos_prueba.sh
{ grep -E 'P-02 ' cedula-unica/linea_base/hlt06.txt; grep -E 'P23|P02v1|# tiempos' cedula-unica/linea_base/hlt06v2.txt; } > cedula-unica/linea_base/tiempos_antes.txt
for f in hlt06 hlt06v2; do echo "$f OK=$(grep -c '^OK ' cedula-unica/linea_base/$f.txt) FALLO=$(grep -c '^FALLO ' cedula-unica/linea_base/$f.txt)"; done | tee cedula-unica/linea_base/resumen_baterias.txt
```
Cualquier `FALLO` previo (en especial P-12 de `hlt06_bateria.sh`, X-8) se anota en `resumen_baterias.txt` como preexistente y **no** se corrige aquí. Si `sin_deriva_hlt12` no se imprime, la tarea queda `BLOQUEADA` con el `diff`: algo cambió después de HLT-12. La línea base se guarda una sola vez.

**AC-T-06** — `rest_usuario/modelos/PersonaMdl.php`, terminación de línea la que indique `terminaciones.txt` (D-16). Localizar **por texto**.

1. Constante. Sustituir
```php
    public const REGISTRO_USUARIO_O_TELEFONO_DUPLICADO = 'USUARIO_O_TELEFONO_DUPLICADO';
```
por
```php
    public const REGISTRO_DATOS_DUPLICADOS = 'DATOS_DUPLICADOS';
```
2. Las dos referencias `self::REGISTRO_USUARIO_O_TELEFONO_DUPLICADO` (en el `return` tras la consulta de usuario/teléfono y en el `catch` del código 1062) pasan a `self::REGISTRO_DATOS_DUPLICADOS`.
3. Insertar, **inmediatamente después** del bloque que termina con `return ['resultado' => self::REGISTRO_CORREO_EXISTENTE, 'idUsuario' => null];` y su llave de cierre, y **antes** de `$sqlInsertarPersona`:
```php
            if ($cedula !== null) {
                $cedulaNormalizada = preg_replace('/[ .\-]/', '', trim($cedula));
                $sqlCedulaExistente = "SELECT p.per_idPersona
                    FROM sgen_persona p
                    WHERE REPLACE(REPLACE(REPLACE(TRIM(p.per_cedula), ' ', ''), '-', ''), '.', '') = ?
                        AND p.per_estado = '1' LIMIT 1 FOR UPDATE";
                if ($cedulaNormalizada !== '' && $this->conexion->ejecutarConsultaSimpleFila(
                    $sqlCedulaExistente,
                    's',
                    $cedulaNormalizada
                ) !== null) {
                    $this->conexion->revertirTransaccion();
                    return ['resultado' => self::REGISTRO_DATOS_DUPLICADOS, 'idUsuario' => null];
                }
            }
```
El `INSERT` conserva `$cedula` **sin normalizar** (lo que se almacena no cambia). No se toca la consulta de usuario/teléfono, la de correo, los `INSERT` ni las firmas.
```bash
cd rest_usuario
/c/xampp/php/php.exe -l modelos/PersonaMdl.php
git diff --numstat modelos/PersonaMdl.php                       # ≈ 18 añadidas / 3 eliminadas (bloque de cédula, constante y 2 referencias): solo lo descrito
git diff -U0 modelos/PersonaMdl.php | grep '^[+-]' | grep -v '^+++\|^---' | grep -c 'sqlInsert\|INSERT\|sqlDuplicadoUsuarioTelefono\|sqlCorreoExistente'   # 0
grep -n "REGISTRO_USUARIO_O_TELEFONO_DUPLICADO" modelos/PersonaMdl.php | wc -l   # 0
grep -n "REGISTRO_DATOS_DUPLICADOS" modelos/PersonaMdl.php | wc -l               # 4 (constante, usuario/teléfono, cédula, catch 1062)
```
(No se hace commit aquí: lo hace T-08.)

**AC-T-07** — `rest_usuario/controladores/PersonaCtrl.php`. Sustituir exactamente
```php
            if ($registro['resultado'] === PersonaMdl::REGISTRO_USUARIO_O_TELEFONO_DUPLICADO) {
                $this->respuestaErrorSimple('El nombre de usuario o el teléfono ya están registrados', 409);
            }
```
por
```php
            if ($registro['resultado'] === PersonaMdl::REGISTRO_DATOS_DUPLICADOS) {
                $this->respuestaErrorSimple('El nombre de usuario, el teléfono o la cédula ya están registrados', 409);
            }
```
(PersonaCtrl no cambia ninguna otra línea: validaciones, orden de operaciones, `esperarTiempoMinimo`, auditoría y envío de correo intactos.)
```bash
cd rest_usuario
/c/xampp/php/php.exe -l controladores/PersonaCtrl.php
git diff --numstat controladores/PersonaCtrl.php               # 2 añadidas / 2 eliminadas
git diff -U0 controladores/PersonaCtrl.php | grep '^[+-]' | grep -v '^+++\|^---'   # solo las 2 líneas anteriores
grep -rn "USUARIO_O_TELEFONO" . --include=*.php --exclude-dir=vendor | wc -l       # 0
grep -c "la cédula ya están registrados" controladores/PersonaCtrl.php            # 1
```

**AC-T-08** (se ejecuta con Apache y MySQL arriba; `U=http://localhost/criterio_kelly/rest_usuario`; cabeceras como `lib/comun.sh`; las cinco peticiones usan datos `ck_prueba_hu3c_*` y se limpian al final)
```bash
cd rest_usuario && for f in modelos/PersonaMdl.php controladores/PersonaCtrl.php; do /c/xampp/php/php.exe -l $f; done | grep -vc 'No syntax errors'   # 0
cd .. ; source $EV/lib/comun.sh; source $EV/lib/hu003_comun.sh
U=http://localhost/criterio_kelly/rest_usuario
H='-H Content-Type:application/json -H X-Requested-With:CriterioKelly -H Origin:http://localhost:8100'
J() { echo "{\"nombres\":\"Prueba\",\"apellidos\":\"Hu3c\",\"correo\":\"ck.prueba.hu3c.$1@example.com\",\"telefono\":\"$2\",\"usuario\":\"ck_prueba_hu3c_$1\",\"clave\":\"Cielo-Rojo-Montana-77\"$3}"; }
bash $EV/lib/limpiar_datos_prueba.sh; MYSQL "DELETE FROM sgen_limitepeticion"
curl -s -w ' %{http_code}\n' $H -X POST $U/persona/agregar -d "$(J s1 0990003101 ',"cedula":"9990000501"')"     # 200 {"mensaje":"Registro recibido. …"}
curl -s -w ' %{http_code}\n' $H -X POST $U/persona/agregar -d "$(J s2 0990003102 ',"cedula":"9990000501"')"     # 409 {"error":"El nombre de usuario, el teléfono o la cédula ya están registrados"}
curl -s -w ' %{http_code}\n' $H -X POST $U/persona/agregar -d "$(J s3 0990003103 ',"cedula":"9990000502"')"     # 200
curl -s -w ' %{http_code}\n' $H -X POST $U/persona/agregar -d "$(J s4 0990003104)"                              # 200 (sin cédula)
curl -s -w ' %{http_code}\n' $H -X POST $U/persona/agregar -d "$(J s5 0990003101 '')"                           # 409 (teléfono repetido: mismo mensaje)
MYSQL "SELECT COUNT(*) FROM sgen_persona WHERE per_correo LIKE 'ck.prueba.hu3c.s%'"                             # 3 (s1, s3, s4)
tail -n 5 rest_usuario/logs/php_errores.log | grep -ci 'Fatal\|Undefined constant\|Deadlock'                      # 0
bash $EV/lib/limpiar_datos_prueba.sh
cd rest_usuario && git add modelos/PersonaMdl.php controladores/PersonaCtrl.php && git commit -m "Feature: HU-003 cédula única en el registro (409 con mensaje único)"   # C1
git show --stat --format=%s HEAD | tail -3                       # solo los 2 archivos
```
(Cada petición de 200 tarda ≥ 2 s; hay 3 registros nuevos y 2 peticiones de 409 sin espera.) El mensaje de commit termina con la línea de atribución vigente en la sesión.

**AC-T-09**
```bash
# 1) hlt06_bateria.sh:172 (P-11a): el texto esperado pasa al mensaje único
sed -i "172s/El nombre de usuario o el teléfono ya están registrados/El nombre de usuario, el teléfono o la cédula ya están registrados/" docs/Planificacion/evidencias/hlt06_bateria.sh
sed -n 172p docs/Planificacion/evidencias/hlt06_bateria.sh | grep -c "la cédula ya están registrados"     # 1
grep -rn "usuario o el teléfono ya están" docs/Planificacion/evidencias/*.sh | wc -l                      # 0
bash -n docs/Planificacion/evidencias/hlt06_bateria.sh
# 2) hu003_flujos_cuenta.sh: valor por defecto de MENSAJE_409
grep -n 'MENSAJE_409="${MENSAJE_409:-' docs/Planificacion/evidencias/hu003_flujos_cuenta.sh               # línea única
```
En `hu003_flujos_cuenta.sh` se sustituye solo el texto por defecto de `MENSAJE_409` por `El nombre de usuario, el teléfono o la cédula ya están registrados` (y el comentario que lo acompañe si lo menciona); no se toca nada más. `bash -n hu003_flujos_cuenta.sh` sin errores. `hlt06_bateria.sh` se edita con `sed` sobre la línea `172` **solo si** `sed -n 172p` muestra el texto antiguo; si el número hubiera cambiado, se localiza con `grep -n "P-11a"`. Las evidencias históricas `evidencias/HLT-06/bateria_P00_P21.txt` y los HLT-06 no se editan.

**AC-T-10** (en segundo plano; `timeout` 600000 ms)
```bash
cd docs/Planificacion/evidencias; bash lib/limpiar_datos_prueba.sh
LOG_CORREOS=$LOG MODO=despues SECCION=funcional bash hu003_cedula_unica.sh > cedula-unica/despues/cedula_funcional.txt 2>&1; echo "exit=$?"   # exit=0
grep -c '^FALLO ' cedula-unica/despues/cedula_funcional.txt                                                   # 0
grep -E '^OK +C(01|02|03|05|06|08|11|12|13|17)' cedula-unica/despues/cedula_funcional.txt | cut -c1-160       # cada caso con su esperado «después»
grep -E 'C19|EXPLAIN|type' cedula-unica/despues/cedula_funcional.txt                                          # type=ALL y sin índice de cédula
grep '^NORM|LIMPIEZA' cedula-unica/despues/cedula_funcional.txt                                               # restantes=0
# Contraste con la línea base (H-10): los casos C02, C03 y C08 respondían 200 antes y ahora 409
diff <(grep -E '^(OK|FALLO) +C(02|03|08)' cedula-unica/linea_base/cedula_antes.txt | cut -c1-60) <(grep -E '^(OK|FALLO) +C(02|03|08)' cedula-unica/despues/cedula_funcional.txt | cut -c1-60) | head -6   # deben diferir
```

**AC-T-11** (en segundo plano; tres corridas completas de la sección de carrera, para detectar intermitencias; `limpiar_datos_prueba.sh` antes de cada una)
```bash
cd docs/Planificacion/evidencias
for n in 1 2 3; do
  bash lib/limpiar_datos_prueba.sh
  LOG_CORREOS=$LOG MODO=despues SECCION=carrera bash hu003_cedula_unica.sh > cedula-unica/despues/carrera_$n.txt 2>&1; echo "corrida $n exit=$?"   # exit=0
  grep -c '^FALLO ' cedula-unica/despues/carrera_$n.txt                                                                                              # 0
done
grep -E '^(OK|FALLO) +C1[456]' cedula-unica/despues/carrera_1.txt | cut -c1-170                              # C14 (11 rondas: 200+409), C15 (20 × 200), C16 (10 × 200)
grep -c ' 500' cedula-unica/despues/carrera_*.txt                                                            # 0 en las tres
for f in php_errores.log php_errors.log; do n0=$(awk -v f=rest_usuario/logs/$f '$2==f{print $1}' cedula-unica/linea_base/logs_error_wc.txt); tail -n +$((n0+1)) ../../../rest_usuario/logs/$f | grep -Eci 'deadlock|1213|1205|lock wait'; done   # 0 y 0
```
Si en cualquier ronda de C14 salen dos `200` con la misma cédula, la tarea pasa a `BLOQUEADA` con la ronda real (D-10): no se añade índice ni `GET_LOCK` sin decisión del usuario (PU-2). Si aparece algún 500 en C15/C16, `BLOQUEADA` con el mensaje de `php_errores.log` (H-3).

**AC-T-12** (en segundo plano)
```bash
cd docs/Planificacion/evidencias; bash lib/limpiar_datos_prueba.sh
LOG_CORREOS=$LOG bash hu003_flujos_cuenta.sh > cedula-unica/despues/g_despues.txt 2>&1; echo "exit=$?"           # exit=0 (MENSAJE_409 por defecto = mensaje nuevo, T-09)
grep -c '^FALLO ' cedula-unica/despues/g_despues.txt                                                              # 0
VIEJO='El nombre de usuario o el teléfono ya están registrados'; NUEVO='El nombre de usuario, el teléfono o la cédula ya están registrados'
diff <(sed "s/$VIEJO/$NUEVO/g" correo-A/linea_base/g_norm.txt) <(grep '^NORM|' cedula-unica/despues/g_despues.txt) && echo g_identico_salvo_409
grep -c "$VIEJO" correo-A/linea_base/g_norm.txt                                                                    # 2 (G4-usuario y G4-telefono): son las únicas líneas que cambian
diff correo-A/linea_base/g_norm.txt <(grep '^NORM|' cedula-unica/despues/g_despues.txt) | grep -c '^[<>]'          # 4 (2 líneas viejas y 2 nuevas) y ninguna más
```
Si aparece cualquier otra diferencia, `BLOQUEADA` con el `diff` real (RS-8); no se edita la línea base de HLT-12.

**AC-T-13** (en segundo plano; `limpiar_datos_prueba.sh` antes de cada batería)
```bash
cd docs/Planificacion/evidencias
bash lib/limpiar_datos_prueba.sh; bash hlt06_bateria.sh   > cedula-unica/despues/hlt06.txt   2>&1
bash lib/limpiar_datos_prueba.sh; bash hlt06v2_bateria.sh > cedula-unica/despues/hlt06v2.txt 2>&1
bash lib/limpiar_datos_prueba.sh
for f in hlt06 hlt06v2; do
  diff <(grep -E '^(OK|FALLO) ' cedula-unica/linea_base/$f.txt | awk '{print $1,$2}') <(grep -E '^(OK|FALLO) ' cedula-unica/despues/$f.txt | awk '{print $1,$2}') && echo "$f igual"; done   # 2 líneas «igual» (P-11a pasa con el texto nuevo: su estado OK es el mismo)
{ grep -E 'P-02 ' cedula-unica/despues/hlt06.txt; grep -E 'P23|P02v1|# tiempos' cedula-unica/despues/hlt06v2.txt; } > cedula-unica/despues/tiempos_despues.txt
grep -E 'P-02 |P23-tiempos-ge2|P23-medianas|P02v1' cedula-unica/despues/hlt06.txt cedula-unica/despues/hlt06v2.txt | grep -c '^FALLO'    # 0 (o igual al de la línea base si había FALLO preexistente)
diff <(grep -oE '[0-9]+\.[0-9]+' cedula-unica/linea_base/tiempos_antes.txt | head -20) <(grep -oE '[0-9]+\.[0-9]+' cedula-unica/despues/tiempos_despues.txt | head -20) | head   # informativo: los tiempos concretos varían; cada mediana debe quedar a menos de 0,3 s de su valor de la línea base
```
Criterio (RN-11): `P23-tiempos-ge2` y `P23-medianas-dif-lt-0.3` en `OK`; cada mediana de `despues` a menos de 0,3 s de la de `linea_base`; el caso C17 de AC-T-10 ya cubre «con y sin cédula». Si difiere, `BLOQUEADA` con las cifras reales.

**AC-T-14** (solo lectura; resultado en `$E/despues/seguridad.txt`)
```bash
cd rest_usuario
git diff --stat $(cut -d' ' -f1 ../$E/linea_base/commit_inicial.txt) HEAD -- . | tail -3          # solo modelos/PersonaMdl.php y controladores/PersonaCtrl.php (README.md tras T-15)
git diff --quiet $(cut -d' ' -f1 ../$E/linea_base/commit_inicial.txt) HEAD -- anexos configuracion index.php rutas .htaccess composer.json composer.lock && echo sin_esquema_ni_infra   # RN-05
git diff --quiet $(cut -d' ' -f1 ../$E/linea_base/commit_inicial.txt) HEAD -- controladores/BaseCtrl.php && echo basectrl_intacto                        # RN-11
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SHOW INDEX FROM sgen_persona" | awk '{print $3}' | sort -u   # PRIMARY, idx_per_correo (igual que T-01)
cd ..
grep -rn "USUARIO_O_TELEFONO" rest_usuario rest_criteriokelly rest_suscripcion rest_divisas criterioKellyApp/src --include=*.php --include=*.ts --exclude-dir=vendor --exclude-dir=node_modules | wc -l   # 0 (RN-13)
grep -rn "usuario o el teléfono ya están" rest_usuario criterioKellyApp/src --include=*.php --include=*.ts --include=*.html --exclude-dir=vendor --exclude-dir=node_modules | wc -l                       # 0
# Uniformidad de los tres 409 (la prueba real está en C13; aquí se confirma que el cuerpo no trae dígitos)
grep -E '^(OK|FALLO) +C13' $E/despues/cedula_funcional.txt | cut -c1-200                       # OK con «iguales»
grep -o "El nombre de usuario, el teléfono o la cédula ya están registrados" rest_usuario/controladores/PersonaCtrl.php | grep -c "[0-9]"   # 0: el mensaje del 409 no incluye números
# Logs de error: sin datos personales ni cédulas de prueba
for f in php_errores.log php_errors.log; do n0=$(awk -v f=rest_usuario/logs/$f '$2==f{print $1}' $E/linea_base/logs_error_wc.txt); tail -n +$((n0+1)) rest_usuario/logs/$f | grep -Ec '999[0-9]{7}|ck\.prueba\.hu3c'; done   # 0 y 0 (RN-12)
# Privacidad de la evidencia (H-13): solo cédulas ficticias 999… y enmascaradas
grep -rEoh '\b[0-9]{10,13}\b' $E | grep -Ev '^(999|09900)' | sort -u | wc -l      # 0 (ninguna cédula real completa; se excluyen cédulas ficticias 999 y teléfonos de prueba 09900)
md5sum -c $E/linea_base/env.md5                                           # .env sin cambios
```
Todo se vuelca con `tee` a `$E/despues/seguridad.txt`.

**AC-T-15** — `rest_usuario/README.md` (conservar CRLF del archivo, `git diff --numstat` pequeño):
1. En el párrafo de `agregar` (línea que hoy contiene `usuario o teléfono duplicado responde 409`), sustituir esa frase por `usuario, teléfono o cédula duplicados responden 409 con el mismo mensaje (`El nombre de usuario, el teléfono o la cédula ya están registrados`: no indica cuál campo se repite)`.
2. En la tabla de validaciones, la fila de `cedula` (hoy `Opcional; 10 a 13 dígitos`) pasa a `Opcional; 10 a 13 dígitos. Si se envía, no puede pertenecer a otra persona activa (409); el 409 se comprueba después del correo, que conserva su respuesta uniforme`.
3. Una frase nueva al final de ese párrafo: `La comprobación de la cédula usa la misma transacción con `FOR UPDATE` que usuario y teléfono y no hay índice único sobre `per_cedula` (HU-003, DC-11): requiere el aislamiento REPEATABLE READ, el predeterminado de MySQL y MariaDB; confírmalo antes de publicar en un hosting.`
4. `PRUEBAS-MANUALES-HU-003.md`: sección nueva **«G-6 · Cédula repetida en el registro»** con los pasos: (1) con el usuario de prueba `ck_prueba_g6a`, cédula `9990000601`, correo `ck.prueba.g6a@example.com`, teléfono `0990003601`, registrar en la app; (2) repetir el registro con otro usuario, teléfono y correo (`ck_prueba_g6b`, `0990003602`, `ck.prueba.g6b@example.com`) y la **misma** cédula `9990000601`; (3) esperado: toast rojo y recuadro rojo con `El nombre de usuario, el teléfono o la cédula ya están registrados`, la app **no** navega a `/verificar-correo`; (4) en la base: `SELECT COUNT(*) FROM sgen_persona WHERE per_correo='ck.prueba.g6b@example.com'` = 0; (5) repetir sin cédula: el registro avanza a `/verificar-correo`; (6) limpieza con `PATRON='^ck_prueba_g6'`. Con tabla `Paso | Esperado | Real | OK` en blanco.
```bash
cd rest_usuario
grep -c "o cédula duplicados responden 409" README.md                   # 1
grep -c "usuario o teléfono duplicado responde 409" README.md           # 0
git diff --numstat README.md                                             # ≈ 3 añadidas / 2 eliminadas: sin reescritura completa por CRLF
git add README.md && git commit -m "Docs: HU-003 cédula única en el README del servicio"   # C2
cd ..; grep -c "G-6 · Cédula repetida" docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md   # 1
grep -c "XXX" docs/Planificacion/evidencias/PRUEBAS-MANUALES-HU-003.md                            # 0
```

**AC-T-16** (`desarrollador-ionic`; solo lectura, ningún archivo se modifica salvo la excepción descrita)
```bash
cd criterioKellyApp
git status --short                                                                # vacío
# 1) El texto del servidor llega al usuario: interceptor (usa error.error.error), store y página
grep -n "error.error?.error\|error.error.error\|mostrarToast(mensaje" src/app/compartidos/interceptors/error.interceptor.ts    # 26, 27 y 59
grep -n "err.message\|errorMessage\|errorRegistro" src/app/paginas/util/store/personaStore.ts src/app/paginas/suscripcion/registro/registro.page.ts src/app/paginas/suscripcion/registro/registro.page.html   # personaStore.ts:30-31 y 49-56; registro.page.ts:53; registro.page.html:361-364
# 2) Ninguna parte de la app depende del texto antiguo ni del código 409 del registro
grep -rn "usuario o el tel\|ya están registrados" src --include=*.ts --include=*.html | wc -l          # 0
grep -rn "409" src/app --include=*.ts | grep -v "spec.ts"                                              # solo SuscripcionStore.ts (ESTADO_CONFLICTO) y error.interceptor.ts:45-47 (texto genérico si el cuerpo no trae error)
# 3) El texto cabe: la etiqueta usa ion-label y el toast no trunca (verificar en el código, sin ejecutar la app)
sed -n 360,366p src/app/paginas/suscripcion/registro/registro.page.html
```
Informe de T-16 (en la ficha, sin crear archivos): (a) trayecto del texto servidor → `error.error.error` → `mensaje` → `ErrorApi(mensaje)` → `err.message` → `errorRegistro()` → `ion-label`; (b) conclusión: el mensaje nuevo de 69 caracteres se muestra completo en el recuadro y en el toast; (c) el campo de cédula de la app valida 10 dígitos exactos (`registro.page.ts:146-155`) y la regla del servidor es 10 a 13 (X-6), sin cambio. **Excepción**: solo si el punto 1 demostrara que el 409 **no** se muestra (por ejemplo, si el interceptor lo omitiera con `OMITIR_MANEJO_ERROR` para `persona/agregar`, que hoy no ocurre: `persona.service.ts:14-19` no pasa contexto), el agente hace el cambio mínimo en `registro.page.html` para pintar `errorRegistro()`, corre `ng lint` y `ng test --watch=false --include='**/registro.page.spec.ts'`, y hace un commit en `criterioKellyApp`. En el caso normal: C1 y C6 `➖`/`✅`, sin commit.

**AC-T-17** — **puerta**: el agente pregunta literalmente «¿Ya ejecutaste el paso G-6 de `PRUEBAS-MANUALES-HU-003.md` en la app? Responde con la tabla de resultados o con "OMITIR G-6"». Con la respuesta, el agente **solo lee** la base y guarda en `$E/despues/g6_verificacion.txt`: la respuesta literal y la salida de `SELECT per_correo, per_cedula IS NOT NULL FROM sgen_persona WHERE per_correo LIKE 'ck.prueba.g6%'` (si el usuario ya limpió, una salida vacía se acepta y se anota que la evidencia es la tabla del usuario). Con «OMITIR G-6» pasa a `OMITIDA` con ese motivo (RS-5) y el estado global es `PARCIAL`. T-17 no escribe nada en `rest_*` ni en la app.

**AC-T-18**
```bash
cd rest_usuario
for f in $(git ls-files '*.php') $(ls correo/*.php 2>/dev/null); do /c/xampp/php/php.exe -l $f; done | grep -vc 'No syntax errors'   # 0
git log --oneline $(cut -d' ' -f1 ../$E/linea_base/commit_inicial.txt)..HEAD                  # C1 y C2 (2 commits, en español, sin push)
git diff --stat $(cut -d' ' -f1 ../$E/linea_base/commit_inicial.txt) HEAD | tail -4            # modelos/PersonaMdl.php, controladores/PersonaCtrl.php, README.md
git status --short                                                                              # vacío
cd ..
git -C criterioKellyApp status --short                                                          # vacío (o solo el cambio mínimo de T-16 ya comiteado)
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT COUNT(*) FROM sgen_usuario WHERE usu_usuario REGEXP '^ck_prueba_'"        # 0
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SELECT COUNT(*) FROM sgen_persona WHERE per_cedula LIKE '999%' OR per_correo LIKE 'ck.prueba.%'"   # 0
/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e "SHOW INDEX FROM sgen_persona" | awk '{print $3}' | sort -u                      # PRIMARY, idx_per_correo
```

### H7.3 Commits previstos (locales, nunca `push`)

| Repo | Commit | Tarea | Mensaje (español) |
|------|--------|-------|-------------------|
| `rest_usuario` | C1 | T-08 | `Feature: HU-003 cédula única en el registro (409 con mensaje único)` |
| `rest_usuario` | C2 | T-15 | `Docs: HU-003 cédula única en el README del servicio` |
| `criterioKellyApp` | — | T-16 | Solo si el cambio mínimo condicionado fuera necesario: `Fix: HU-003 mostrar el error del registro` |

Sin commit (no hay git): `docs/**` (scripts, evidencias, `PRUEBAS-MANUALES-HU-003.md`). Cada mensaje termina con la línea de atribución vigente en la sesión del agente de implementación.

---

## H8 · Reglas de implementación deterministas

Reglas de `.claude/agents/desarrollador-php.md` aplicables, citadas por sección, más las propias de este HLT.

- **RI-A1 · Arquitectura obligatoria** («Arquitectura obligatoria»): `Ctrl` valida y sanea y responde; `Mdl` hace el SQL por `Enlace`; no se tocan `rutas/`, `index.php` ni `BaseCtrl`.
- **RI-A2 · Consultas preparadas**: la consulta de cédula usa `ejecutarConsultaSimpleFila($sql, 's', $valor)` con `?` y nunca concatena la cédula; las funciones `REPLACE`/`TRIM` actúan sobre la **columna**, no sobre texto del cliente.
- **RI-A3 · Contrato de respuesta** («Contrato de respuesta»): solo `respuestaErrorSimple('<mensaje>', 409)` con el texto de DC-10; el 422 sigue reservado; ninguna salida (`echo`) antes de las respuestas de `BaseCtrl`; el cuerpo no incluye la cédula.
- **RI-A4 · Errores y cabeceras** («Errores y cabeceras»): no registrar datos sensibles; no se añade `error_log` con la cédula; no se tocan `.htaccess` ni cabeceras.
- **RI-A5 · Secretos**: no abrir ni editar `.env` (solo `md5sum`).
- **RI-A6 · Nombres y estilo** («Nombres», «Estándares de código»): español, `camelCase`, constantes `UPPER_SNAKE_CASE` (`REGISTRO_DATOS_DUPLICADOS`), variables `$cedulaNormalizada`, `$sqlCedulaExistente`, comparaciones estrictas, compatible con PHP 8.0; conservar la terminación de línea de cada archivo (D-16).
- **RI-A7 · Cambios de esquema**: ninguno (DC-11, RN-05).
- **RI-A8 · Verificación antes de terminar**: `php -l` de cada `.php` tocado y `curl` de `persona/agregar` con caso feliz y de error; el informe pega la salida real.
- **RI-A9 · Sin efectos fuera de alcance**: una tarea solo toca los archivos de su fila; `git diff --name-only` por tarea lo demuestra.
- **RI-A10 · Commits**: solo C1 y C2, locales, en español, con autorización de T-01; nunca `push`.
- **RI-A11 · Datos de prueba**: solo `ck_prueba_hu3c_*`, cédulas `999…` y `lib/limpiar_datos_prueba.sh`; los fixtures `UPDATE` de C08 y C09 se aplican únicamente a filas de esas personas de prueba; nunca se modifican ni borran cédulas reales (RN-10).
- **RI-A12 · Evidencia honesta** (RS-1, RS-8): salida real de cada comando; una diferencia se reporta, no se ajusta la línea base.
- **RI-A13 · Privacidad** (D-18): ninguna evidencia contiene cédulas reales completas.
- **RI-A14 · App** (`desarrollador-ionic`, solo T-16): arquitectura de página orquestadora + store; si hay que cambiar algo, el cambio es mínimo y con `ng lint` y la prueba del registro.

---

## H9 · Reglas de seguimiento de ejecución

Método, símbolos y reglas RS-1…RS-9 de `criterioKellyApp/docs/doc_modo_planificacion.md` §11 (obligatorios). Para backend, **C4** = `C:\xampp\php\php.exe -l` sin errores sobre cada `.php` tocado (➖ en tareas sin `.php`); **C5** = `curl` de cada endpoint afectado, caso feliz y al menos uno de error, con la respuesta real (➖ en tareas sin endpoint). Para T-16 (app), C4 = `ng lint` y C5 = `ng test` solo si se cambia código (➖ si no). Todas las fichas parten en `PENDIENTE` y con `⬜`; solo el agente de implementación las marca.

Ficha tipo:
```
T-NN — <nombre>
  Estado: PENDIENTE
  Checks: [⬜] C1 cambios en los archivos declarados · [⬜] C2 criterio de aceptación AC-T-NN (evidencia) · [⬜] C3 reglas H8 y H11
          [⬜] C4 php -l OK · [⬜] C5 curl OK · [⬜] C6 sin efectos fuera de alcance (git diff --name-only)
  Evidencia: —   Notas / desviaciones: —
```

### Fichas

```
T-01 — Precondiciones y carpeta de evidencias
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-01)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-02 — Consulta de solo lectura de cédulas repetidas
  Estado: PENDIENTE
  [➖] C1 solo lectura  [⬜] C2 (AC-T-02)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-03 — Puerta DC-11 (cédulas repetidas)
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-03: HECHA sin repetidas, o BLOQUEADA con la pregunta y la respuesta literal)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-04 — hu003_cedula_unica.sh
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-04)  [⬜] C3  [➖] C4 son .sh (bash -n)  [➖] C5 (se prueba en T-05)  [⬜] C6
  Evidencia: —   Notas: —
T-05 — Línea base «antes»
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-05: sin deriva de HLT-12, C02 y C14 con el comportamiento actual, tiempos)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-06 — PersonaMdl: constante y comprobación de cédula
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-06)  [⬜] C3  [⬜] C4  [➖] C5 (se prueba en T-08)  [⬜] C6
  Evidencia: —   Notas: —
T-07 — PersonaCtrl: mensaje único del 409
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-07)  [⬜] C3  [⬜] C4  [➖] C5 (se prueba en T-08)  [⬜] C6
  Evidencia: —   Notas: —
T-08 — Sintaxis, humo y commit C1
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-08: 5 peticiones)  [⬜] C3  [⬜] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-09 — Scripts de evidencia al mensaje nuevo
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-09)  [⬜] C3  [➖] C4 (bash -n)  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-10 — Pruebas funcionales (C01…C13, C17…C19)
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-10)  [⬜] C3  [➖] C4  [⬜] C5 (curl reales del script)  [⬜] C6
  Evidencia: —   Notas: —
T-11 — Pruebas de carrera
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-11: 3 corridas, 0 × 500, un 200 y un 409)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-12 — Batería G de HLT-12
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-12: g_identico_salvo_409)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-13 — Tiempos P-02 y P-23
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-13)  [⬜] C3  [➖] C4  [⬜] C5  [⬜] C6
  Evidencia: —   Notas: —
T-14 — Verificación de seguridad y alcance
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-14)  [⬜] C3  [⬜] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-15 — README, prueba manual G-6 y commit C2
  Estado: PENDIENTE
  [⬜] C1  [⬜] C2 (AC-T-15)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-16 — Verificación de la app (desarrollador-ionic)
  Estado: PENDIENTE
  [➖] C1 (solo lectura salvo la excepción)  [⬜] C2 (AC-T-16: trayecto del texto y 0 referencias al texto antiguo)  [⬜] C3  [➖] C4 ng lint (solo si hay cambio)  [➖] C5 ng test (solo si hay cambio)  [⬜] C6
  Evidencia: —   Notas: —
T-17 — Puerta G-6 manual
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-17: respuesta literal del usuario y consulta de solo lectura)  [⬜] C3  [➖] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
T-18 — Verificación global
  Estado: PENDIENTE
  [➖] C1  [⬜] C2 (AC-T-18)  [⬜] C3  [⬜] C4  [➖] C5  [⬜] C6
  Evidencia: —   Notas: —
```

### Tablero de avance global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-02 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-03 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-05 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-10 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-13 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ⬜ | ⬜ | No |
| T-14 | PENDIENTE | ➖ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-15 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-16 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-17 | PENDIENTE | ➖ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-18 | PENDIENTE | ➖ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |

---

## H10 · Diseño del reporte de ejecución

Estructura fija (RR-1…RR-5 de `doc_modo_planificacion.md` §12):

```
REPORTE DE EJECUCIÓN — Cédula única en el registro (HU-003 G-6, G-03, G-04)
  1. Resumen ejecutivo
  2. Estado global              (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas          (copia de H9, T-01…T-18, con checks C1…C6)
  4. Cobertura vs. HLT          (matriz H4: G-6, G-03, G-04, RN-01…RN-17 → resultado; ¿100 %?)
  5. Cambios realizados         (archivos ruta:línea, tipo de cambio, commits C1 y C2 con hash)
  6. Verificaciones ejecutadas  (comando → salida real de cada AC-T-NN; tabla antes/después de C02 y C14, de los tiempos P-02/P-23 y de la batería G)
  7. Desviaciones y decisiones  (respecto al HLT; con causa; respuesta del usuario en T-03 y T-17 si hubo)
  8. Pendientes / bloqueos      (checks en ⬜/❌; acción requerida; preguntas PU-1…PU-4 sin responder)
  9. Próximos pasos             (actualizar la HU a DC-10, PU-4; confirmar el aislamiento en el hosting, PU-2)
```

Reglas específicas: el estado es `COMPLETADO` solo si las 18 tareas están `HECHA` y T-11 reporta un 200 y un 409 en todas las rondas de C14, T-12 `g_identico_salvo_409` y T-13 tiempos dentro de los umbrales. T-17 `OMITIDA` o T-03 con respuesta A o B dejan el estado en `PARCIAL` o `COMPLETADO` según el caso: T-17 `OMITIDA` → `PARCIAL`; T-03 con A o B no impide `COMPLETADO`; T-03 con C → `BLOQUEADO`. La sección 6 incluye el contraste «antes/después» de C02, C03, C08 y C14 y la tabla de tiempos P-02/P-23 con mínimo y diferencia de medianas.

---

## H11 · Convenciones de desarrollo y arquitectura de código limpio

Nombres de `desarrollador-php.md` («Nombres»): español, `camelCase`, constantes `UPPER_SNAKE_CASE`, sufijos `Rts`/`Ctrl`/`Mdl`, prefijos de columna (`per_`, `usu_`).

| Elemento | Convención en este HLT |
|----------|------------------------|
| Constante renombrada | `REGISTRO_DATOS_DUPLICADOS = 'DATOS_DUPLICADOS'` junto a `REGISTRO_CREADO` y `REGISTRO_CORREO_EXISTENTE` en `PersonaMdl` |
| Variables nuevas del modelo | `$cedulaNormalizada`, `$sqlCedulaExistente` (prefijo `sql` como `$sqlCorreoExistente`) |
| Mensaje 409 | Texto de DC-10 en una única llamada a `respuestaErrorSimple(..., 409)`; sin constante nueva (se usa una sola vez, como el mensaje actual) |
| Script de pruebas | `docs/Planificacion/evidencias/hu003_cedula_unica.sh`; funciones y variables como `lib/hu003_comun.sh` (`snake_case`, entorno en `MAYÚSCULAS`: `LOG_CORREOS`, `MODO`, `MENSAJE_409`, `SECCION`) |
| Datos de prueba | Usuarios `ck_prueba_hu3c_<x>`, correos `ck.prueba.hu3c.<x>@example.com`, teléfonos `09900031NN`, cédulas `999xxxxxxx` |
| Evidencias | `docs/Planificacion/evidencias/cedula-unica/{linea_base,despues}/` (kebab-case, igual que `correo-A`) |
| Documentos | Español, comillas simples en el código, sin marcadores pendientes, sin emojis |

Responsabilidad única: `PersonaCtrl` valida el formato y traduce el resultado en HTTP; `PersonaMdl` decide si hay duplicado y es dueño de la transacción y del bloqueo; el mensaje único vive en el controlador, la normalización de la columna en el SQL del modelo. No se crea ninguna clase ni helper nuevo.
