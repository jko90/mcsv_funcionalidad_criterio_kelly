# HLT-04 · Autorización por dueño en `rest_criteriokelly`

| Campo | Valor |
|-------|-------|
| HLT | HLT-04 |
| Fecha | 2026-11-02 |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Plan maestro | [PLAN-MAESTRO-HU-001](PLAN-MAESTRO-HU-001.md): contratos cerrados §4 y reglas §5 |
| Contrato de planificación | `docs/planificador.md` + `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11, extensiones backend) |
| Proyecto | `rest_criteriokelly` (repositorio git propio) |
| Agente de implementación | `desarrollador-php` (todas las tareas) |
| Depende de | HLT-01 (`Enlace` con transacciones, `.env`), HLT-02 (`LectorSolicitud`, `ManejadorErrores`, `Enrutador`), HLT-03 (`ContextoSesion`, `ValidadorSesion`, `RegistroAuditoria`, `sgen_auditoria`) **ejecutados y cerrados** |
| Lo consume | HLT-07 (la app deja de enviar ids de usuario; ver H5 · Contrato resultante) |
| PHP | **8.2 o superior** (override del plan maestro §5.2; donde `desarrollador-php.md` dice 8.0, rige 8.2) |
| Veredicto senior | **APROBADO** (ronda 2, ver H6) |

> **Referencias `ruta:línea`.** Todas corresponden al estado del repositorio leído el 2026-11-02, **antes** de ejecutar HLT-01, HLT-02 y HLT-03. Esos HLT pueden desplazar líneas (por ejemplo, la lectura del cuerpo JSON en `rutas/*Rts.php` o los `require` de `configuracion/`). El agente de implementación localiza cada punto por **nombre de método o de `case`**, que es estable, y registra la línea real en la evidencia de su ficha (H9). Esto no le deja ninguna decisión de diseño: solo cambia la línea donde aplica lo que este HLT ya fija.

---

## H1 · Propósito

| Campo | Contenido |
|-------|-----------|
| Requerimiento literal | "HLT-04 (rest_criteriokelly): recorre TODOS los endpoints de /cuentas, /bitacora, /comentarios, /criterioKelly. Para cada uno: de dónde sale hoy el usuario (query `id`, cuerpo `usuarioId`, ids de recurso como idCuenta/idBitacora), y cómo queda: usuario solo desde `ContextoSesion`; si el cliente envía un id de usuario distinto → 403 + auditoría (DH-04: el parámetro deja de ser necesario; si llega y coincide, se acepta durante la transición — confírmalo como decisión H5 coherente con HLT-07 que dejará de enviarlo); todo id de recurso (cuenta, capital, bitácora, comentario) se verifica contra el dueño en el SQL (JOIN/WHERE con usuario) → 404 si no le pertenece (no revelar existencia) o 403 — decide uno y justifícalo en H5 aplicándolo de forma uniforme; escrituras multi-tabla en transacción; validación de entrada por endpoint (tipo, rango, longitud, valores permitidos según el esquema en `rest_criteriokelly/anexos/*.sql`). Mantén el formato de respuesta y el 422 de límite de pérdida intacto. Bugs conocidos del README: solo dentro del alcance si están en líneas que se modifican (decláralo explícitamente por bug). Tabla de matriz endpoint × (origen actual del usuario → fuente nueva, verificación de dueño, prueba curl de IDOR)." Criterios HU: C-01, C-02, C-04, C-05, C-06, C-07, A-07 (apoyo), D-01/D-02 (`ACCESO_DENEGADO`), DH-04. |
| Propósito | Que un trader con sesión válida solo pueda leer y modificar **sus** cuentas, capital, bitácora, observaciones y resultados Kelly, aunque llame a la API directamente y manipule ids, y que cada intento de acceder a datos ajenos quede auditado. |
| Resultado esperado | Los 17 endpoints de `rest_criteriokelly` toman el usuario exclusivamente de la sesión; un id de usuario enviado distinto al de la sesión responde 403 y se audita; un id de recurso que no pertenece al usuario (o no existe) responde 403 idéntico y se audita; toda escritura en más de una tabla es atómica; cada campo de entrada se valida contra el esquema; el formato `dato` / `{error}` y el 422 de límite de pérdida no cambian. Con el token del usuario B, ningún endpoint lee ni modifica datos del usuario A (verificado con `curl`). |
| Fuera de alcance | (1) Autenticación, emisión y validación de tokens, lista blanca pública y 401 (HLT-03). (2) Lectura de cuerpo, 405, límite de 1 MB, errores 500 globales y enrutador por segmento exacto (HLT-02). (3) Cambios en la app (HLT-07). (4) Bugs funcionales del README que no están en líneas modificadas (ver RN-14 y H5 D-17). (5) Cambios de esquema (`ALTER TABLE`, índices, FK): ninguno. (6) Corrección de datos históricos inconsistentes (solo se diagnostican en T-24). (7) Límite de cuentas por plan de suscripción. (8) El cálculo del capital en `movCapital`, que sigue llegando del cliente (solo afecta a la propia cuenta del usuario). (9) `rutas.txt` y los estados de servicio por recurso (`GET /cuentas` sin acción): HLT-02/HLT-03. |
| Feature(s) afectada(s) | `rest_criteriokelly` → `/cuentas`, `/bitacora`, `/comentarios`, `/criterioKelly`. Archivos: `controladores/BaseCtrl.php`, `CuentasCtrl.php`, `BitacoraCtrl.php`, `ComentariosCtrl.php`, `CriterioKellyCtrl.php`, `ReglasKellyCtrl.php`; `modelos/CuentasMdl.php`, `BitacoraMdl.php`, `ComentariosMdl.php`, `CriterioKellyMdl.php`, `ReglasKellyMdl.php`; `rutas/CuentasRts.php`, `rutas/CriterioKellyRts.php`; `README.md`. |

---

## H2 · Reglas de negocio

### H2.1 Reglas

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-01 | El usuario de toda operación sale **solo** de `ContextoSesion::idUsuario()`. | `grep -nE "_usuarioId'\]\|\\\$_GET\['id'\]" controladores/*.php` no muestra ninguna lectura usada como usuario de una consulta; toda llamada a un modelo recibe `$this->idUsuarioSesion()`. | C-01, DH-04, plan §4.2 |
| RN-02 | Si el cliente envía un id de usuario (`id` en `cuentas/obtener`, `cue_usuarioId`, `cap_usuarioId`, `bit_usuarioId`, `cke_usuarioId`) y **no** coincide con la sesión (incluye formato inválido), responde **403 `{"error":"Acceso denegado"}`** y se audita `ACCESO_DENEGADO`. Si coincide o no llega, se continúa. | Prueba P-4: 13 casos → 403; los mismos con el id propio → 200. | C-01, D-01, plan §4.5 |
| RN-03 | Todo id de recurso (cuenta, bitácora, observación) se verifica contra el usuario de la sesión **en el SQL** (`WHERE ... cue_usuarioId = ?` o `EXISTS` sobre `sckc_cuentas`). Si no le pertenece **o no existe**, responde **403 `{"error":"Acceso denegado"}`**, con cuerpo idéntico en ambos casos, y se audita `ACCESO_DENEGADO`. | Prueba P-5: 11 casos con recurso de A y 11 con id inexistente → mismo código y mismo cuerpo byte a byte. | C-02, D-01, plan §4.5, H5 D-02 |
| RN-04 | La raíz de propiedad es la cuenta: un recurso pertenece al usuario si su cuenta tiene `cue_usuarioId` = sesión **y** (para bitácora) `bit_usuarioId` = sesión. Las cuentas con `cue_estado = '0'` no se pueden usar (403). | Consultas de propiedad de T-04, T-11, T-17 incluyen `cue_usuarioId = ?` y `cue_estado = '1'`. | C-02, `anexos/sist_criteriokelly.sql:74-82` |
| RN-05 | Las lecturas de resultados y reportes (`/criterioKelly/*`) devuelven solo filas de cuentas cuyo dueño es el usuario de la sesión (JOIN con `sckc_cuentas`), aunque existan filas históricas con un `*_usuarioId` falsificado. | P-5c: B no ve la cuenta de A en ninguno de los 5 reportes. | C-02 |
| RN-06 | Toda escritura que afecta más de una tabla, o más de una fila de forma dependiente, va en una transacción de `Enlace` (`iniciarTransaccion` / `confirmarTransaccion` / `revertirTransaccion`). Se eliminan las reversiones manuales que borran filas. | `cuentas/nueva`, `bitacora/crear`, `bitacora/finalizaBitacora`, `bitacora/eliminarBitacora`, `comentarios/crearComentario`, `comentarios/comentarioBitacora` llaman a `iniciarTransaccion()`; `grep -n "anularFinalizar\|eliminarResultadoOperativas\|eliminarCuentaError" -r controladores modelos` = 0 resultados. | C-05, plan §4.2 (`Enlace`) |
| RN-07 | Nunca se emite una respuesta con una transacción abierta: antes de responder se confirma o se revierte. El 422 de límite de pérdida **confirma** el movimiento `Q` antes de responder. | Revisión de código en T-16; P-8 muestra la fila `Q` persistida tras el 422. | C-05, C-07 |
| RN-08 | Orden fijo de bloqueos para evitar condiciones de carrera e interbloqueos: **cuenta → bitácora → observación**, siempre con `SELECT ... FOR UPDATE` de una sola tabla por clave primaria. Ninguna transacción los toma en orden inverso. | P-7: dos `finalizaBitacora` concurrentes sobre la misma bitácora → uno 200 y otro 409; una sola fila nueva en `sckr_resultado` para ese cierre. | C-05, H6 (carreras) |
| RN-09 | Una bitácora solo se finaliza si está en `bit_situacion = 'O'`; si ya está en `'F'` responde **409** `{"error":"La operación ya está finalizada"}` (solo alcanzable con una bitácora propia). | P-7. | `anexos/sist_criteriokelly.sql:45` |
| RN-10 | Validación de entrada por endpoint según H2.3: tipo, rango, longitud y valores permitidos del esquema. Entrada inválida → **400** con el mensaje del campo. La validación ocurre **antes** de la verificación de propiedad. | P-6 y P-3. | C-06 |
| RN-11 | Respuestas: dato directo o `{ "error": "..." }`; los nombres de campo de éxito no cambian (incluidos `cue_usuarioId`, `bit_usuarioId`, `cap_usuarioId`, `cke_usuarioId`, que ahora siempre valen el id de la sesión). **422** solo para límite de pérdida, con su mensaje actual. | Diff de las claves de respuesta = 0 cambios; `grep -n "422" -r controladores` = una sola aparición (`ReglasKellyCtrl`). | C-07, `ReglasKellyCtrl.php:95` |
| RN-12 | Ningún error devuelve `getMessage()`, SQL, rutas ni trazas: los `catch` registran con `error_log` y responden `500 {"error":"Error interno del servidor"}`. | `grep -n "getMessage()" controladores/*.php` solo aparece dentro de `error_log(`. | C-04, C-08 |
| RN-13 | Reglas Kelly que no se rompen: el cálculo sigue en el backend (`ReglasKellyMdl`), divisor por defecto **10** si llega ausente o ≤ 0, % operativo = % Kelly ÷ divisor, y el 422 cuando el balance de la última operación cerrada es ≤ 0. | P-3 (finalizar 200 con `cke_numDivisor`), P-8 (422). | README `rest_criteriokelly` §Cálculo |
| RN-14 | Bugs del README: solo se corrigen los que están en líneas modificadas por este HLT (tabla H5 D-17). | Revisión de diff contra D-17. | Plan §5.7 |

### H2.2 Matriz endpoint × autorización (contrato cerrado)

Leyenda de pruebas: `B→A` = petición con `TOKEN_B` sobre datos de A (batería H7.2).

| # | Método y ruta | Usuario hoy (origen, `ruta:línea`) | Id de recurso hoy | Fuente nueva del usuario | Verificación de dueño en SQL | Transacción | Prueba IDOR (esperado) |
|---|---------------|-------------------------------------|-------------------|--------------------------|------------------------------|-------------|------------------------|
| 1 | `GET cuentas/obtener` | Query `id` (`rutas/CuentasRts.php:67`, `CuentasCtrl.php:53-67`) | — | Sesión; `?id` opcional, si llega ≠ sesión → 403 | `WHERE cue.cue_usuarioId = ?` (ya existe, `CuentasMdl.php:63-72`) | No | `B ?id=ID_A` → 403; `B` sin id → lista sin `CUENTA_A` |
| 2 | `POST cuentas/nueva` | Cuerpo `cue_usuarioId` (`CuentasCtrl.php:19,30`) | — | Sesión; `cue_usuarioId` opcional ≠ → 403 | `INSERT` con id de sesión | **Sí** (`sckc_cuentas` + `sckc_capital`) | `B {cue_usuarioId:ID_A}` → 403 y 0 filas nuevas |
| 3 | `POST cuentas/movCapital` | Cuerpo `cap_usuarioId` (`CuentasCtrl.php:97,112`) | `cap_cueIdCuentas` (`:106`) | Sesión; `cap_usuarioId` opcional ≠ → 403 | `INSERT ... SELECT ... FROM sckc_cuentas WHERE cue_idCuentas = ? AND cue_usuarioId = ? AND cue_estado = '1'` (0 filas → 403) | No (1 sentencia atómica) | `B cuenta=CUENTA_A` → 403; capital de A intacto |
| 4 | `PUT cuentas/nombre` | Cuerpo `cue_usuarioId` (`:180,195`) | `cue_idCuenta` (`:189`) | Sesión; opcional ≠ → 403 | `obtenerCuentaActivaDeUsuario` + `UPDATE ... WHERE cue_idCuentas = ? AND cue_usuarioId = ? AND cue_estado = '1'` | No | `B cuenta=CUENTA_A` → 403; nombre intacto |
| 5 | `DELETE cuentas/eliminar` | Cuerpo `cue_usuarioId` (`:241,256`) | `cue_idCuenta` (`:250`) | Sesión; opcional ≠ → 403 | Igual que #4 | No | `B cuenta=CUENTA_A` → 403; cuenta de A sigue activa |
| 6 | `POST bitacora/crear` | Cuerpo `bit_usuarioId` (`BitacoraCtrl.php:21,35`) | `bit_cueIdCuentas` (`:41`) | Sesión; opcional ≠ → 403 | `obtenerCuentaActivaDeUsuario(..., bloquear: true)` | **Sí** (`sckb_bitacora` + `scko_observacion`) | `B cuenta=CUENTA_A` → 403 y 0 filas nuevas |
| 7 | `POST bitacora/listBitacora` | Cuerpo `bit_usuarioId` (`:130,136`) | `bit_cueIdCuentas` | Sesión; opcional ≠ → 403 | `obtenerCuentaActivaDeUsuario` + `WHERE bit_usuarioId = ? AND bit_cueIdCuentas = ?` | No | `B cuenta=CUENTA_A` → 403 |
| 8 | `PUT bitacora/finalizaBitacora` | Cuerpo `bit_usuarioId` (`ReglasKellyCtrl.php:38,61`) | `bit_idbitacora` (`:108`), `bit_cueIdCuentas` (`:65`) | Sesión; opcional ≠ → 403 | Bloquea cuenta del usuario; bloquea bitácora con `bit_usuarioId = ?`, `bit_cueIdCuentas` = cuenta y `EXISTS` sobre la cuenta | **Sí** (`sckb_bitacora`, `sckc_capital`, `sckr_resultado`, `sckr_riesgobeneficio`, `sckt_factortotal`, `sckr_rentabilidad`, `sckp_criteriokelly`) | `B bit=BIT_A` → 403; `B` con su cuenta y `BIT_A` → 403; BIT_A sigue `'O'` |
| 9 | `DELETE bitacora/eliminarBitacora?id=` | Ninguno | Query `id` de bitácora (`BitacoraRts.php:168`) | Sesión | `obtenerBitacoraDeUsuario(..., bloquear: true)` | **Sí** (`scko_observacion` + `sckb_bitacora`) | `B ?id=BIT_A` → 403; BIT_A existe |
| 10 | `GET comentarios/observaciones?id=` | Ninguno | Query `id` de bitácora (`ComentariosRts.php:64`) | Sesión | `obtenerBitacoraDeUsuario` | No | `B ?id=BIT_A` → 403 |
| 11 | `POST comentarios/crearComentario` | Ninguno | `obs_bitIdbitaco` de cada elemento (`ComentariosCtrl.php:61`) | Sesión | `obtenerBitacoraDeUsuario(..., bloquear: true)` para **cada** bitácora distinta del lote, antes de escribir | **Sí** (n filas de `scko_observacion`) | `B obs_bitIdbitaco=BIT_A` → 403 y 0 filas; lote mixto (propia + `BIT_A`) → 403 y 0 filas |
| 12 | `PUT comentarios/comentarioBitacora` | Ninguno | `bit_idbitacora` (`:127`), `obs_idObserva` (`:133`) | Sesión | Bitácora del usuario bloqueada + `obtenerObservacionDeBitacora(obs, bit, bloquear: true)` | **Sí** (`sckb_bitacora` + `scko_observacion`) | `B bit=BIT_A obs=OBS_A` → 403; `B` con su bitácora y `OBS_A` → 403 |
| 13 | `POST criterioKelly/obtenerPorcentaje` | Cuerpo `cke_usuarioId` (`CriterioKellyCtrl.php:24,30`) | — | Sesión; opcional ≠ → 403; cuerpo `{}` aceptado | `JOIN sckc_cuentas cue ON cue.cue_idCuentas = t1.cke_cueIdCuentas AND cue.cue_usuarioId = ?` | No | `B {cke_usuarioId:ID_A}` → 403; `B {}` → sin filas de `CUENTA_A` |
| 14 | `POST criterioKelly/obtenerResultados` | Cuerpo `cke_usuarioId` (`:64,71`) | — | Igual | `JOIN sckc_cuentas` por `resu.res_cueIdCuentas` y `cue_usuarioId = ?` | No | Igual que #13 |
| 15 | `POST criterioKelly/detalleOperacion` | Cuerpo `cke_usuarioId` (`:111,117`) | — | Igual | `JOIN sckc_cuentas` por `bit_cueIdCuentas` y `cue_usuarioId = ?` | No | Igual que #13 |
| 16 | `POST criterioKelly/operacionAnalisis` | Cuerpo `cke_usuarioId` (`:151,157`) | — | Igual | Igual que #15 | No | Igual que #13 |
| 17 | `POST criterioKelly/observacionAnalisis` | Cuerpo `cke_usuarioId` (`:196,202`) | — | Igual | Igual que #15 | No | Igual que #13 |

Todos los endpoints, además: sin token o con token inválido → **401** (`ValidadorSesion`, HLT-03; `rest_criteriokelly` no tiene rutas públicas, plan §4.5). Prueba P-2.

### H2.3 Validación de entrada por endpoint (contrato cerrado)

Los helpers `leer*` se definen en T-02. "Opcional" significa que el campo puede faltar o ser `null`. Los textos se validan sobre el valor crudo (sin escapar) y la longitud máxima se mide con `mb_strlen` **sobre el valor ya escapado** con `htmlspecialchars`, que es lo que se guarda.

| Endpoint | Campo | Tipo y regla | Fuente del límite |
|----------|-------|--------------|-------------------|
| `cuentas/obtener` | `id` (query) | Opcional; solo para comparar con la sesión (RN-02) | — |
| `cuentas/nueva` | `cue_nombre` | Texto requerido, 1–64, patrón `/^[\p{L}\p{N} ._-]+$/u` | `cue_nombre varchar(64)` (`sql:77`) |
| | `fecha_valor` | Fecha `Y-m-d` válida (`DateTimeImmutable::createFromFormat('!Y-m-d')` sin errores) | `cue_fechaCrea date` (`sql:79`); la app envía `toISOString().slice(0,10)` (`cuentas.page.ts:150`) |
| | `valor_cuenta` | Decimal 0 – 99 999 999.9999 | `cap_capital decimal(12,4)` (`sql:63`) |
| | `cue_usuarioId` | Opcional (RN-02) | — |
| `cuentas/movCapital` | `cap_cueIdCuentas` | Entero 1 – 2 147 483 647 | `int(11)` |
| | `cap_monto`, `cap_capital` | Decimal 0 – 99 999 999.9999 | `decimal(12,4)` (`sql:62-63`) |
| | `cap_tipoMovimie` | Opción `D`, `R`, `C` (`Q` lo genera solo el servidor) | README "Modelo de datos", `CuentasCtrl.php:143` |
| | `cap_usuarioId` | Opcional (RN-02) | — |
| `cuentas/nombre` | `cue_idCuenta` | Entero 1 – 2 147 483 647 | `int(11)` |
| | `cue_nombre` | Igual que en `nueva` | `sql:77` |
| | `cue_usuarioId` | Opcional (RN-02) | — |
| `cuentas/eliminar` | `cue_idCuenta` | Entero | `int(11)` |
| | `cue_usuarioId` | Opcional (RN-02) | — |
| `bitacora/crear` | `bit_cueIdCuentas` | Entero | `int(11)` |
| | `bit_divisa` | Texto requerido, 1–32, patrón `/^[A-Za-z0-9 .\/_^-]+$/` | `varchar(32)` (`sql:35`); valores de `listaDivisas.ts` |
| | `bit_tipoOperaci` | Opción `COMPRA`, `VENTA` | `varchar(8)` (`sql:36`) |
| | `bit_fechaCrea` | Opcional; fecha y hora ISO 8601 que empiece por `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}`, interpretada con `new DateTimeImmutable($valor)` y guardada como `Y-m-d H:i:s`; ausente → `date('Y-m-d H:i:s')` | `datetime` (`sql:46`); la app envía `toISOString()` (`bitacora.page.ts:177`) |
| | `bit_numeroBitac` | Opcional, entero 0 – 2 147 483 647, por defecto 1 | `int(11) DEFAULT 1` (`sql:34`) |
| | `bit_precioEntra`, `bit_precioSL`, `bit_precioTP` | Opcionales, decimal 0 – 999 999.999999, por defecto 0 | `decimal(12,6)` (`sql:37-39`) |
| | `obs_comentario` | Texto opcional, 0–4096 | `varchar(4096)` (`sql:108`) |
| | `obs_tipoObserva` | Opción `I`, `E`, `P`, `L`, `F` | Comentario de la columna (`sql:109`) |
| | `obs_imagen` | Imagen opcional (regla de imagen, abajo) | `longtext` (`sql:110`) |
| | `bit_usuarioId` | Opcional (RN-02) | — |
| `bitacora/listBitacora` | `bit_cueIdCuentas` | Entero | `int(11)` |
| | `bit_usuarioId` | Opcional (RN-02) | — |
| `bitacora/finalizaBitacora` | `bit_idbitacora`, `bit_cueIdCuentas` | Enteros | `int(11)` |
| | `bit_resultado` | Opción `GANADOR`, `PERDEDOR` | `ReglasKellyCtrl.php:50` (sin cambio funcional) |
| | `bit_situacion` | Opción `F` (finalizar solo cierra) | Comentario `O`/`F` (`sql:45`); la app envía `'F'` (`bitacora-fin.page.ts:172`) |
| | `bit_respeReglas` | Opción `SI`, `NO` | `char(2)` (`sql:48`) |
| | `bit_montoResult` | Decimal 0 – 9 999 999.999 | `decimal(10,3)` (`sql:42`) |
| | `cke_numDivisor` | Opcional; si falta, es `null` o es ≤ 0 → **10** (`DIVISOR_KELLY_POR_DEFECTO`); si no es numérico → 400; si es > 1000 → 400 | `cke_numDivisor int(11) DEFAULT 10` (`sql:125`), RN-13 |
| | `bit_usuarioId` | Opcional (RN-02) | — |
| `bitacora/eliminarBitacora` | `id` (query) | Entero | `int(11)` |
| `comentarios/observaciones` | `id` (query) | Entero (id de bitácora) | `int(11)` |
| `comentarios/crearComentario` | Cuerpo | Un objeto (si tiene la clave `obs_bitIdbitaco`) o una lista (`array_is_list`) de 1 a 10 objetos (`MAXIMO_COMENTARIOS_POR_SOLICITUD`) | — |
| | `obs_bitIdbitaco` | Entero | `int(11)` |
| | `obs_comentario` | Texto requerido, 1–4096 | `sql:108` |
| | `obs_tipoObserva` | Opción `I`, `E`, `P`, `L`, `F` | `sql:109`; la app envía `E`, `P`, `L`, `F` |
| | `obs_imagen` | Imagen opcional | `sql:110` |
| `comentarios/comentarioBitacora` | `bit_idbitacora`, `obs_idObserva` | Enteros | `int(11)` |
| | `bit_precioEntra` | Opcional, decimal 0.000001 – 999 999.999999 (hoy exige > 0, `ComentariosCtrl.php:145`) | `decimal(12,6)` |
| | `bit_precioSL`, `bit_precioTP` | Opcionales, decimal 0 – 999 999.999999 | `decimal(12,6)` |
| | `obs_comentario` | Texto opcional, 0–4096 | `sql:108` |
| | `obs_imagen` | Imagen opcional | `sql:110` |
| `criterioKelly/*` (5) | Cuerpo | `{}` o `{ "cke_usuarioId": n }` | — |
| | `cke_usuarioId` | Opcional (RN-02) | — |

**Regla de imagen** (`leerImagen`): `null` o ausente → `null`; `''` o `'--'` → se guarda tal cual (la app usa `'--'` como "sin imagen", `bitacora-fin.page.ts:193`); `https://...` de hasta 2048 caracteres que pase `FILTER_VALIDATE_URL` → se guarda escapado con `htmlspecialchars`; `data:image/(png|jpeg|webp|gif);base64,<datos>` → `base64_decode($datos, true)` válido, tamaño decodificado ≤ **524 288 bytes** (la app comprime a 0.48 MB, `manejo-imagenes.service.ts:3`) y `finfo_buffer` con `FILEINFO_MIME_TYPE` igual al tipo declarado → se guarda tal cual. Cualquier otro valor → 400 `La imagen de '<campo>' no es válida`.

Los campos no listados se **ignoran**: nunca llegan al SQL (no hay asignación dinámica de columnas).

---

## H3 · Flujo principal de ejecución

Disparador común: una petición HTTP de la app (o de cualquier cliente) a `http://localhost/criterio_kelly/rest_criteriokelly/<recurso>/<acción>`.

```
[Petición] → .htaccess → index.php
   → Configuracion → ManejadorErrores → CabecerasSeguridad → CorsConfig (preflight 204)   (HLT-01/02)
   → LectorSolicitud (405 método, 400 JSON/Content-Type/1 MB)                               (HLT-02)
   → Enrutador (404 "Recurso no encontrado")                                                 (HLT-02)
   → ValidadorSesion::exigir() (401 "Sesión no válida o expirada") → ContextoSesion lleno    (HLT-03)
   → LimitadorPeticiones (429)                                                               (HLT-03)
   → rutas/<X>Rts.php (acción + cuerpo) → <X>Ctrl::<método>                                  (este HLT)
        1. Lee cada campo con leer* (H2.3)                      ── inválido → 400 {error: mensaje del campo}
        2. verificarUsuarioEnviado(campo de usuario, si llega)  ── distinto → audita ACCESO_DENEGADO → 403 {error:"Acceso denegado"}
        3. $idUsuario = idUsuarioSesion()
        4. [si escribe en >1 tabla] enlace->iniciarTransaccion()
        5. Verificación de dueño en SQL (Mdl, con FOR UPDATE si hay transacción; orden cuenta → bitácora → observación)
              ── sin fila → [revertirTransaccion] → audita → 403 {error:"Acceso denegado"}
        6. Operación (Mdl → Enlace → MySQL, consultas preparadas, filtro por usuario)
        7. [transacción] confirmarTransaccion()
        8. respuestaExitosaSimple(dato)                          ── 200 con la misma forma de hoy
   ├─ Excepción (mysqli_sql_exception u otra) → [revertirTransaccion] → error_log("[Clase::metodo] ...") → 500 {error:"Error interno del servidor"}
   └─ Fatal no capturado → ManejadorErrores (HLT-02) → 500 genérico
```

**Flujo A · Lectura por usuario de la sesión** (`cuentas/obtener`, `criterioKelly/*`): pasos 1–3 → consulta con `cue_usuarioId = ?` → 200 con la lista (vacía si no hay datos, como hoy: `ejecutarConsulta` devuelve un `mysqli_result`, y la comprobación `!$cuentas || empty($cuentas)` nunca da verdadero; se mantiene).

**Flujo B · Lectura o escritura de un recurso por id sin transacción** (`movCapital`, `nombre`, `eliminar`, `listBitacora`, `observaciones`): pasos 1–3 → verificación de dueño (5) → operación con el usuario también en el `WHERE` → 200, o 403 si la verificación falla.

**Flujo C · Escritura multi-tabla** (`nueva`, `crear`, `eliminarBitacora`, `crearComentario`, `comentarioBitacora`): pasos 1–8 completos.

**Flujo D · Finalizar operación** (`PUT bitacora/finalizaBitacora`, `ReglasKellyCtrl::finalizarOperacionBitacora`):

```
1-3 → iniciarTransaccion
 → cuentasModelo.obtenerCuentaActivaDeUsuario(cuenta, usuario, bloquear: true)        ── null → revertir → 403
 → bitacoraModelo.obtenerBitacoraDeUsuario(bitácora, usuario, bloquear: true)         ── null o bit_cueIdCuentas ≠ cuenta → revertir → 403
 → bit_situacion ≠ 'O'                                                                ── revertir → 409 "La operación ya está finalizada"
 → capital (obtenerCapitalPorIdUsuario) y balance (obtenerBalancePorIdCuenta)
 → balance ≤ 0 → quemarCapitalCuenta(cuenta, usuario, capital) → confirmarTransaccion → 422 "Has llegado al límite de pérdida, recargue la cuenta para seguir intentando"
 → finalizarOperacionBitacora (UPDATE ... AND bit_situacion = 'O'; 0 filas → revertir → 409)
 → insertarResultadoOperativas → insertarRiesgoBeneficio → insertarFactorTotal → insertarRentabilidad → insertarCriterioKelly (+ lecturas por id)
 → confirmarTransaccion → 200 con la misma forma de hoy (`ReglasKellyCtrl.php:235-245`)
   └─ cualquier excepción → revertirTransaccion → 500 genérico (sin borrar filas a mano)
```

Ramas de error y su manejo en la app (`errorInterceptor`, sin cambios en este HLT): 400 (mensaje del servidor), 401 (HLT-07 renueva o lleva al login), 403 (`Acceso denegado`), 409, **422 = límite de pérdida**, 500. `loading`/`error` de los stores no se tocan en este HLT (backend puro).

---

## H4 · Calidad del HLT y cobertura

### H4.1 Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| Precondiciones HLT-01/02/03 | T-01 | Evidencia de `grep` y `curl` 401 de T-01 |
| Recorrer todos los endpoints (matriz H2.2) | T-05 a T-23 | P-2 a P-6 por endpoint |
| RN-01 usuario solo de sesión | T-02, T-06–T-10, T-12–T-14, T-16, T-18–T-20, T-23 | P-3, P-4, `grep` de T-24 |
| RN-02 id distinto → 403 + auditoría; igual → aceptado | T-02 + tareas de cada endpoint | P-4, P-10 |
| RN-03 recurso ajeno o inexistente → 403 idéntico + auditoría | T-04, T-11, T-17 (SQL) + controladores | P-5, P-10 |
| RN-04 propiedad por cuenta activa | T-04, T-11, T-17 | P-5 |
| RN-05 reportes por dueño de la cuenta | T-22, T-23 | P-5c |
| RN-06 transacciones | T-03, T-07, T-12, T-14, T-16, T-19, T-20 | Revisión de código + P-3 + P-7 |
| RN-07 sin respuesta con transacción abierta; 422 confirma | T-16 | P-8 |
| RN-08 orden de bloqueos / carreras | T-04, T-11, T-17, T-16 | P-7 |
| RN-09 409 si ya finalizada | T-11, T-16 | P-7 |
| RN-10 validación H2.3 | T-02 + tareas de cada endpoint | P-6 |
| RN-11 formato y 422 intactos | Todas las de controlador | P-3, P-8 |
| RN-12 sin fugas en errores | T-07, T-12, T-16, T-23 (y todas las de controlador) | `grep` de T-24 |
| RN-13 reglas Kelly | T-16 | P-3, P-8 |
| RN-14 bugs en líneas modificadas | T-04, T-12, T-16 | Revisión contra D-17 |
| Inyección SQL en cada parámetro | Todas (consultas preparadas + validación) | P-6 |
| Sin token → 401 | T-01 (verifica HLT-03) | P-2 |
| README actualizado | T-25 | Revisión del README |

Cobertura: **100 %** (todas las RN y requerimientos tienen tarea y prueba).

### H4.2 Checklist de calidad

- ✅ Las 11 secciones existen y están completas.
- ✅ Sin marcadores pendientes.
- ✅ Cada RN mapea a ≥ 1 tarea.
- ✅ Cada tarea tiene criterio de aceptación verificable y ficha de checks (H9).
- ✅ No contradice las reglas del proyecto (§0.5 no aplica a PHP; se respetan las de `desarrollador-php.md` con el override de PHP 8.2).
- ✅ Referencias `ruta:línea` verificadas contra el repositorio del 2026-11-02 (ver nota inicial).
- ✅ Decisiones cerradas (H5) sin ambigüedad.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Id de usuario enviado por el cliente durante la transición | A) Rechazar siempre que llegue (400/403). B) Ignorarlo. C) Aceptarlo si coincide con la sesión, 403 + auditoría si no. | **C** | DH-04 y plan §4.5 (`usRol`): "deja de ser necesario; si llega y no coincide → 403". Permite desplegar HLT-04 antes que HLT-07 sin romper la app; HLT-07 deja de enviarlo. Un valor con formato inválido cuenta como "no coincide" (403). | No |
| D-02 | Código para un recurso que no pertenece al usuario | A) 404 `Recurso no encontrado`. B) 403 solo si existe y es ajeno, 404 si no existe. C) **403 `Acceso denegado` tanto si es ajeno como si no existe**. | **C** | El plan maestro §4.5 (contrato cerrado) asigna 403 `Acceso denegado` a "Dueño distinto" y reserva 404 `Recurso no encontrado` al `Enrutador`; elegir 404 lo contradiría. B revela la existencia de ids ajenos. C responde **byte a byte igual** en ambos casos y se resuelve con **una sola consulta** con el usuario en el `WHERE` (sin consulta extra de existencia), así que no hay canal de tiempo ni de código para enumerar. Se aplica a cuenta, bitácora y observación en todos los endpoints. | No |
| D-03 | Qué se audita | A) Solo id de usuario distinto. B) Id distinto + recurso ajeno/inexistente. | **B** | C-01 y D-01 exigen `ACCESO_DENEGADO`; D-03 de la HU alerta con > 10 por hora, que es justo el patrón de un barrido IDOR. Al no distinguir ajeno de inexistente (D-02), se audita todo 403 de propiedad. | No |
| D-04 | Cómo se audita | A) Evento y usuario sin detalle + `error_log`. B) API de HLT-03: `(new RegistroAuditoria(new Enlace(), SERVICIO_ACTUAL))->registrar('ACCESO_DENEGADO', $idUsuario, ContextoSesion::familia(), $motivo)` + `error_log`. | **B** | HLT-03 (T-06, D-05, D-21) fija `registrar(string $evento, ?int $idUsuario = null, ?string $familia = null, string $detalle = '')` y la columna `aud_detalle`. `$motivo` tiene la forma `<recurso>=<id> <endpoint>` (por ejemplo `cuenta=12 cuentas/movCapital`) o `usuario enviado en <endpoint>`: nunca tokens, cuerpos ni secuencias de 32+ caracteres (HLT-03 RN-24 lanzaría excepción). Se usa un **`Enlace` propio** (otra conexión) para que el registro persista aunque se revierta la transacción del negocio. `SERVICIO_ACTUAL` es la constante del `index.php` creada por HLT-03 (`'rest_criteriokelly'`). Además `error_log('[ACCESO_DENEGADO] usuario=<id> <motivo>')`. | No |
| D-05 | Dónde vive la verificación de propiedad | A) Clase nueva `PropiedadMdl`. B) Métodos en el modelo de cada recurso. | **B** | RD-2: reutilizar `CuentasMdl`, `BitacoraMdl`, `ComentariosMdl`. El SQL queda junto al recurso; el controlador decide el 403. | No |
| D-06 | Conexión compartida para transacciones | A) `Enlace` singleton. B) Inyectar el mismo `Enlace` en los modelos desde el controlador. | **B** | Hoy cada modelo abre su propio `new Enlace()` (`CuentasMdl.php:11`, `BitacoraMdl.php:11`, `ReglasKellyMdl.php:11`, …), así que una transacción no abarca a varios modelos. B no toca `enlace.php`, que es copia idéntica en los 4 backends (plan §4.2): el constructor de cada modelo pasa a `__construct(?Enlace $enlace = null)` y usa `$enlace ?? new Enlace()`; cada controlador crea un `Enlace` y lo pasa a todos sus modelos. | No |
| D-07 | Bloqueos y carreras (saldo, capital, cierre) | A) Sin bloqueo. B) `SELECT ... FOR UPDATE` por clave primaria, de una sola tabla, en orden cuenta → bitácora → observación. C) Bloqueo de tabla. | **B** | Serializa por cuenta los cierres (lectura de balance → escritura), evita el doble cierre de una bitácora y los borrados concurrentes, sin bloquear a otros usuarios. Las consultas con `EXISTS` sobre `sckc_cuentas` no bloquean la fila del subquery (lectura consistente), así que no se invierte el orden. | No |
| D-08 | `movCapital` | A) Verificar y después insertar. B) `INSERT ... SELECT ... FROM sckc_cuentas WHERE <dueño y activa>`. | **B** | Una sola sentencia atómica: la propiedad y la escritura no pueden separarse por una carrera. `insert_id = 0` → 403. | No |
| D-09 | `nombre` y `eliminar` | A) Usar `affected_rows` del `UPDATE` como verificación. B) Verificación previa + `UPDATE` con el usuario en el `WHERE`. | **B** | MySQL devuelve `affected_rows = 0` cuando el nombre no cambia, lo que daría un 403 falso. | No |
| D-10 | Cuerpo de `criterioKelly/*` | A) Pasar a `GET`. B) Mantener `POST` y aceptar `{}`. | **B** | RD-7: menor cambio; la ruta deja de exigir un cuerpo no vacío para esas 5 acciones (`CriterioKellyRts.php:73-91`). HLT-07 envía `{}`. | No |
| D-11 | Campos desconocidos en el cuerpo | A) Rechazar con 400. B) Ignorar. | **B** | La app envía campos extra (por ejemplo, `bit_numeroBitac: 0`, `cke_numDivisor`); solo se leen campos conocidos, que nunca se asignan a columnas de forma dinámica (no hay asignación masiva). | No |
| D-12 | Escape de texto | A) Seguir con `limpiarDatos` sobre todo el cuerpo. B) `leerTexto` escapa cada campo de texto una sola vez. | **B** | Mantiene la práctica del proyecto (`htmlspecialchars`) sin escapar dos veces ni escapar números o imágenes. Los métodos migrados **no** llaman a `limpiarDatos`; el método queda en `BaseCtrl` por compatibilidad. | No |
| D-13 | `bit_situacion` al finalizar | A) Mantener `I/E/P/L/F`. B) Solo `F`. | **B** | La columna documenta `O`/`F` (`sql:45`) y la app envía `'F'`. El valor validado está en la línea que se modifica (`ReglasKellyCtrl.php:53-56`). | No |
| D-14 | `obs_tipoObserva` en `bitacora/crear` y `crearComentario` | A) Mantener `I/O/R` y "cualquier valor". B) `I/E/P/L/F` en ambos. | **B** | Coincide con el comentario de la columna (`sql:109`) y con lo que envía la app (`I`, `E`, `P`, `L`, `F`). Las líneas se modifican (`BitacoraCtrl.php:85-88`, `ComentariosCtrl.php:52-56`). | No |
| D-15 | Lote de `crearComentario` con errores | A) Escribir los válidos y devolver 400 por los demás (hoy). B) Validar todo y verificar la propiedad de todo antes de escribir; un error → nada se escribe. | **B** | Atomicidad (C-05) y no permitir escrituras parciales mezclando bitácoras ajenas. Máximo 10 elementos. | No |
| D-16 | Lock de transacción y respuestas | — | Antes de cualquier `respuesta*` dentro de una transacción se llama a `confirmarTransaccion()` (éxito y 422) o `revertirTransaccion()` (403, 409, 400 tardío). | Las respuestas hacen `exit`; no se confía en el rollback implícito al cerrar la conexión. | No |
| D-17 | Bugs conocidos del README (y uno nuevo) | Dentro / fuera | Ver tabla D-17 abajo | Regla 7 del plan maestro. | No |
| D-18 | Respuestas de error del modelo con `getMessage()` | — | Se eliminan: `BitacoraMdl::crearBitacora` y `CuentasMdl::agregarCuenta` dejan de capturar y devolver cadenas; las excepciones suben al controlador → 500 genérico. | C-04/C-08; las líneas se modifican por la transacción. | No |
| D-19 | Método `Enlace::ejecutarConsultaRetornarID` | Seguir usándolo / reemplazarlo | Las líneas que se tocan usan `ejecutarInsercionRetornaID`. | El método no existe en el `Enlace` de `rest_suscripcion`; HLT-01 unifica `enlace.php` y no se debe depender de él. | No |
| D-20 | Datos históricos con `*_usuarioId` distinto al dueño de la cuenta | Corregir / diagnosticar | Solo diagnosticar (T-24) y documentar en el README. | Corregir datos es irreversible y está fuera de alcance; RN-04/RN-05 ya impiden que esas filas se muestren a otro usuario. Diagnóstico del 2026-11-02: 1 fila en `sckp_criteriokelly`. | No |

**Tabla D-17 · Bugs conocidos**

| Bug | Archivo:línea | ¿Línea modificada? | Decisión |
|-----|---------------|--------------------|----------|
| `b` invertido (`$montoPierdeSeguro = ($montoPierde <= 0) ? ...`) | `modelos/ReglasKellyMdl.php:54` | No | **Fuera de alcance** (bug funcional). |
| Operaciones abiertas contadas como `''` en lugar de `NULL` | `modelos/BitacoraMdl.php:103` | No | **Fuera de alcance**. |
| `bit_situacion` validado contra `I/E/P/L/F` | `controladores/ReglasKellyCtrl.php:53-56` | Sí | **Dentro** (D-13). |
| `obs_tipoObserva` validado contra `I/O/R` | `controladores/BitacoraCtrl.php:85-88` | Sí | **Dentro** (D-14). |
| No existe `BREAK EVEN` al cerrar | `controladores/ReglasKellyCtrl.php:49-52` | Sí (se reemplaza por `leerOpcion`) | **Fuera de alcance**: se mantiene `GANADOR`/`PERDEDOR` (agregar un valor es un cambio funcional). |
| Sin transacciones, reversión manual | `ReglasKellyCtrl.php:145-253`, `CuentasMdl.php:43,50`, `BitacoraMdl.php:32,40` | Sí | **Dentro** (RN-06). |
| `rutas.txt` no corresponde a este servicio | `rutas.txt` | No | **Fuera de alcance** (su exposición pública es de HLT-02). |
| **Nuevo:** `quemarCapitalCuenta` enlaza `$cue_idCuenta` en `cap_usuarioId` y `$cue_usuarioId` en `cap_cueIdCuentas` (parámetros invertidos) | `modelos/CuentasMdl.php:103` | Sí | **Dentro**: escribe una fila de capital con un dueño equivocado (C-02) y está en el flujo del 422 que este HLT hace transaccional. |
| **Nuevo:** los `catch` devuelven `$e->getMessage()` | `CriterioKellyCtrl.php:55,101,143,189,225`; `BitacoraCtrl.php:109-110` vía `BitacoraMdl.php:42` | Sí | **Dentro** (RN-12). |

### H5.1 Contrato resultante para HLT-07 (app)

| Endpoint | Hoy la app envía (`ruta:línea`) | Desde HLT-07 envía | Cambio de respuesta |
|----------|----------------------------------|--------------------|---------------------|
| `GET cuentas/obtener` | `?id=${usuarioId}` (`cuentas.service.ts:30`) | Sin query | Ninguno |
| `POST cuentas/nueva` | `cue_usuarioId` (`Cuentas.modelo.ts:22`) | Sin `cue_usuarioId` | Ninguno |
| `POST cuentas/movCapital` | `cap_usuarioId` (`Capital.modelo.ts`) | Sin `cap_usuarioId` | Cuenta ajena → 403 |
| `PUT cuentas/nombre` | `cue_usuarioId` | Sin `cue_usuarioId` | Cuenta ajena o inexistente → 403 (hoy 404) |
| `DELETE cuentas/eliminar` | `cue_usuarioId` | Sin `cue_usuarioId` | Igual (hoy 404) |
| `POST bitacora/crear` | `bit_usuarioId` (`bitacora.page.ts:169`) | Sin `bit_usuarioId` | `obs_tipoObserva` ∈ `I/E/P/L/F` |
| `POST bitacora/listBitacora` | `bit_usuarioId` | Solo `{ bit_cueIdCuentas }` | Cuenta ajena → 403 |
| `PUT bitacora/finalizaBitacora` | `bit_usuarioId` (`bitacora-fin.page.ts:174`) | Sin `bit_usuarioId`; `bit_situacion: 'F'` | Ya finalizada → 409; 422 sin cambios |
| `DELETE bitacora/eliminarBitacora?id=` | `?id=${idBitacora}` | Igual | Ajena → 403 (hoy 404) |
| `GET comentarios/observaciones?id=` | `?id=${usuarioId}` (el parámetro se llama `usuarioId` pero es el id de bitácora, `comentarios.service.ts:23-26`) | Igual; HLT-07 renombra el parámetro a `idBitacora` | Ajena → 403 |
| `POST comentarios/crearComentario` | Lista de comentarios | Igual (máximo 10) | Lote con una bitácora ajena → 403 y nada escrito |
| `PUT comentarios/comentarioBitacora` | Igual | Igual | Ajena → 403 |
| `POST criterioKelly/obtenerPorcentaje`, `obtenerResultados`, `detalleOperacion`, `operacionAnalisis`, `observacionAnalisis` | `{ cke_usuarioId }` (`criterio-kelly.service.ts:15`, `resultados.service.ts:13`, `reportes.service.ts:23,32,41`) | `{}` | Ninguno |

---

## H6 · Revisión del requerimiento por parte de un senior

### H6.1 Ronda 1 (sobre el borrador)

Veredicto: **APROBADO CON CAMBIOS**. Cambios obligatorios detectados:

1. **Interbloqueo:** el borrador verificaba la bitácora con un `JOIN sckc_cuentas ... FOR UPDATE`, que bloquea filas de ambas tablas en el orden del plan de ejecución y puede cruzarse con `finalizaBitacora` (cuenta → bitácora). → Se fija D-07/RN-08: bloqueos de una sola tabla por clave primaria y `EXISTS` no bloqueante para la cuenta.
2. **Enumeración:** el borrador usaba 404 para inexistente y 403 para ajeno. → D-02: 403 idéntico con una sola consulta.
3. **Falso 403 en `cuentas/nombre`** por `affected_rows = 0` cuando el nombre no cambia. → D-09.
4. **El 422 se perdía** si la respuesta salía con la transacción abierta (rollback implícito al cerrar la conexión). → RN-07/D-16.
5. **`quemarCapitalCuenta` con parámetros invertidos** escribía capital con dueño equivocado. → D-17 dentro de alcance.
6. **`criterioKelly/*` con cuerpo `{}`** devolvía 400 por la validación de cuerpo vacío de la ruta. → D-10 y T-21.
7. **Fugas de `getMessage()`** en los `catch` de `CriterioKellyCtrl` y en `BitacoraMdl`. → RN-12/D-18.

### H6.2 Ronda 2 (sobre esta versión)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 recoge el requerimiento literal; el alcance es solo `rest_criteriokelly`. |
| 2 | Reglas de negocio | ✅ | RN-01…RN-14 son invariantes verificables por prueba o `grep`; no se contradicen (RN-02 precede a RN-03; RN-10 precede a ambas). |
| 3 | Impacto | ✅ | 14 archivos listados en H1; la app solo se afecta por los cambios de código de error de H5.1 (403 en lugar de 404 en tres casos) y no se rompe durante la transición (D-01). |
| 4 | Consistencia arquitectónica | ✅ | Capas Rts → Ctrl → Mdl → `Enlace`; SQL solo en modelos; decisiones de código HTTP solo en controladores; clases compartidas de `configuracion/` sin tocar (regla de copia idéntica §4.2). |
| 5 | Riesgos | ✅ | Ver H6.3. |
| 6 | Simplicidad | ✅ | Sin clases nuevas (D-05), sin cambios de esquema, sin tocar `enlace.php` (D-06). |
| 7 | Seguridad | ✅ | **IDOR horizontal:** cada id (cuenta, bitácora, observación) pasa por una consulta con el usuario en el `WHERE`, también en las escrituras (defensa en profundidad); los 11 casos tienen prueba P-5. **Asignación masiva de usuario:** ningún `*_usuarioId` del cuerpo llega al SQL (RN-01, D-11); `cap_tipoMovimie = 'Q'` no se acepta del cliente. **Enumeración:** 403 idéntico ajeno/inexistente; 400 solo por formato, sin información de existencia; 401 antes que cualquier otra verificación. **Carreras:** cierre serializado por cuenta (`FOR UPDATE`), doble cierre → 409, `movCapital` atómico, borrado y cierre de la misma bitácora serializados; prueba de concurrencia P-7. **Fugas:** sin `getMessage()` al cliente. **Auditoría:** todo 403 queda en `sgen_auditoria`, sin tokens ni cuerpos. |
| 8 | Cobertura | ✅ | H4.1 al 100 %. |
| 9 | Determinismo | ✅ | Firmas, SQL, códigos, mensajes, límites y orden de bloqueos fijados; las dependencias externas (`ContextoSesion::idUsuario()`/`familia()`, `RegistroAuditoria::registrar`, columnas `aud_*`, `SERVICIO_ACTUAL`) están fijadas por HLT-03 (D-05, D-21, T-05, T-06) y T-01 las verifica. |
| 10 | Ejecutabilidad | ✅ | 25 tareas atómicas, un objetivo y archivos concretos cada una, con dependencias sin ciclos. |

### H6.3 Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Ventana entre HLT-03/HLT-04 y HLT-07: la app sigue enviando ids y recibe 403 en lugar de 404 en tres casos. | Alta | D-01 acepta el id coincidente; plan §2 (ventana aceptada): no se despliega nada hasta HLT-11 y HLT-07 se ejecuta enseguida. |
| HLT-03 publica `ContextoSesion`/`RegistroAuditoria` con firmas distintas a las del plan §4.2. | Alta | T-01 lo verifica antes de tocar código; si `ContextoSesion::idUsuario()` no existe, T-01 queda BLOQUEADA (RS-4) y se pide una versión `-v2` de este HLT. |
| Interbloqueos o esperas largas por `FOR UPDATE`. | Media | Orden único cuenta → bitácora → observación; bloqueos por clave primaria; transacciones cortas. Un interbloqueo detectado por InnoDB revierte una de las dos peticiones (500) sin dejar datos parciales. |
| Datos históricos con `*_usuarioId` incoherente (1 fila en `sckp_criteriokelly`). | Media | RN-04/RN-05 no los muestran a otro usuario; T-24 los cuenta y el README los documenta (D-20). |
| `fileinfo` deshabilitado en el PHP 8.2 de producción. | Media | T-01 verifica `php -m`; HLT-11 lo incluye en su checklist de servidor. |
| Un lote de `crearComentario` con dos imágenes supera 1 MB (`LectorSolicitud`). | Baja | La app envía como máximo una imagen por lote (`bitacora-fin.page.ts:189-202`); el límite es de HLT-02. |
| Auditoría ruidosa si la app referencia una bitácora propia ya borrada. | Baja | Caso raro; D-03 de la HU alerta solo con > 10 por hora. |

### H6.4 Veredicto

**APROBADO.** Los siete cambios de la ronda 1 están aplicados; el plan es ejecutable sin decisiones de diseño, cubre el 100 % del requerimiento y no contradice los contratos cerrados del plan maestro (403 `Acceso denegado` para dueño distinto, 422 reservado, formato de respuesta, clases compartidas sin modificar).

---

## H7 · Plan de tareas

Todas las rutas son relativas a `rest_criteriokelly/`. Agente único: `desarrollador-php`. Ninguna tarea es paralelizable (RS-3).

### H7.1 Tareas

| ID | Tarea (verbo + objeto) | Agente | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN / HU |
|----|------------------------|--------|-----------------------|------------|--------------------------------------|---------|
| T-01 | Verificar las precondiciones de HLT-01/02/03 (solo lectura) | `desarrollador-php` | Lectura: `configuracion/ContextoSesion.php`, `configuracion/RegistroAuditoria.php`, `configuracion/enlace.php`, `index.php` | — | (a) `grep -n "function idUsuario" configuracion/ContextoSesion.php` encuentra el método; (b) `grep -n "public function registrar" configuracion/RegistroAuditoria.php` muestra la firma `registrar(string $evento, ?int $idUsuario = null, ?string $familia = null, string $detalle = '')`, `grep -n "function familia" configuracion/ContextoSesion.php` la encuentra e `index.php` define `SERVICIO_ACTUAL = 'rest_criteriokelly'`; (c) `grep -n "function iniciarTransaccion\|function confirmarTransaccion\|function revertirTransaccion" configuracion/enlace.php` = 3; (d) `RUTAS_PUBLICAS` de `index.php` sin entradas de este backend; (e) `curl` sin token a `cuentas/obtener` → 401; (f) `C:\xampp\php\php.exe -v` ≥ 8.2 y `php -m` incluye `fileinfo`, `mbstring`, `mysqli`. Si (a), (b) o (c) fallan → BLOQUEADA. | Precondición |
| T-02 | Agregar a `BaseCtrl` los helpers de sesión, denegación y validación | `desarrollador-php` | `controladores/BaseCtrl.php:1-51` | T-01 | `php -l` OK; existen con estas firmas: `idUsuarioSesion(): int`, `verificarUsuarioEnviado(mixed $idEnviado, string $origen): void`, `denegarAcceso(string $motivo): void`, `leerEntero(mixed $valor, string $campo, int $minimo = 1, int $maximo = self::ENTERO_MAXIMO): int`, `leerDecimal(mixed $valor, string $campo, float $minimo, float $maximo): float`, `leerTexto(mixed $valor, string $campo, int $longitudMaxima, bool $esRequerido, ?string $patron = null): string`, `leerOpcion(mixed $valor, string $campo, array $permitidos): string`, `leerFecha(mixed $valor, string $campo): string`, `leerFechaHora(mixed $valor, string $campo): string`, `leerImagen(mixed $valor, string $campo): ?string`, y las constantes `ENTERO_MAXIMO = 2147483647`, `MENSAJE_ACCESO_DENEGADO = 'Acceso denegado'`, `TAMANO_MAXIMO_IMAGEN_BYTES = 524288`, `TIPOS_IMAGEN_PERMITIDOS`, `VALORES_SIN_IMAGEN = ['', '--']`. Comportamiento según H8 RI-P3. | RN-01, RN-02, RN-10, C-01, C-06 |
| T-03 | Inyectar un `Enlace` compartido en los constructores de los 5 modelos | `desarrollador-php` | `modelos/CuentasMdl.php:7-12`, `modelos/BitacoraMdl.php:7-12`, `modelos/ComentariosMdl.php:7-12`, `modelos/CriterioKellyMdl.php:7-12`, `modelos/ReglasKellyMdl.php:7-12` | T-01 | `php -l` OK en los 5; cada uno declara `private Enlace $conexion;` y `public function __construct(?Enlace $enlace = null) { $this->conexion = $enlace ?? new Enlace(); }`. | RN-06, C-05, D-06 |
| T-04 | Ajustar `CuentasMdl`: propiedad, filtros por dueño, inserción transaccional y `quemarCapitalCuenta` | `desarrollador-php` | `modelos/CuentasMdl.php:14-104` | T-03 | `php -l` OK; (1) nuevo `obtenerCuentaActivaDeUsuario(int $idCuenta, int $idUsuario, bool $bloquear = false): ?array` con `SELECT cue_idCuentas FROM sckc_cuentas WHERE cue_idCuentas = ? AND cue_usuarioId = ? AND cue_estado = '1'` (+ ` FOR UPDATE` si `$bloquear`, eligiendo entre dos constantes SQL fijas); (2) `agregarCuenta(string, int, string, float): int` sin `try/catch` ni `eliminarCuentaError`, con `ejecutarInsercionRetornaID` en ambas inserciones, devuelve el id de capital; (3) se elimina `eliminarCuentaError`; (4) `registroMovimientoCapital` usa `INSERT INTO sckc_capital (cap_usuarioId, cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie) SELECT ?, cue_idCuentas, ?, ?, ? FROM sckc_cuentas WHERE cue_idCuentas = ? AND cue_usuarioId = ? AND cue_estado = '1'` con tipos `"iddsii"`; (5) `actualizarNombreCuenta` y `eliminarCuenta` agregan `AND cue_estado = '1'`; (6) `quemarCapitalCuenta(int $idCuenta, int $idUsuario, float $capital)` enlaza `"iid", $idUsuario, $idCuenta, $capital`; (7) todos los métodos tocados con tipos declarados. | RN-03, RN-04, RN-06, RN-08, C-02, D-08, D-17 |
| T-05 | Hacer opcional el `id` de `cuentas/obtener` en la ruta | `desarrollador-php` | `rutas/CuentasRts.php:66-81` | T-01 | `php -l` OK; el `case 'obtener'` ya no responde 400 si falta `id`; llama a `$controller->obtenerCuentasPorUsuario($_GET['id'] ?? null)`. | RN-01, D-01 |
| T-06 | Reescribir `CuentasCtrl::obtenerCuentasPorUsuario` con el usuario de la sesión | `desarrollador-php` | `controladores/CuentasCtrl.php:53-90` | T-02, T-04, T-05 | `php -l` OK; firma `obtenerCuentasPorUsuario(mixed $idEnviado): void`; llama a `verificarUsuarioEnviado($idEnviado, 'cuentas/obtener')` y consulta con `idUsuarioSesion()`; P-3 #1 → 200 con las cuentas de A; P-4 #1 → 403. | RN-01, RN-02, C-01 |
| T-07 | Reescribir `CuentasCtrl::agregarCuenta` con sesión, validación y transacción | `desarrollador-php` | `controladores/CuentasCtrl.php:15-50` | T-02, T-04 | `php -l` OK; valida según H2.3; `verificarUsuarioEnviado($data['cue_usuarioId'] ?? null, 'cuentas/nueva')`; `iniciarTransaccion` → `agregarCuenta` → `confirmarTransaccion`; en excepción `revertirTransaccion` y 500 genérico; respuesta con las mismas 4 claves (`cue_usuarioId` = sesión); P-3 #2 → 200 y P-4 #2 → 403 sin filas nuevas. | RN-01, RN-02, RN-06, RN-10, RN-11, C-05, C-06 |
| T-08 | Reescribir `CuentasCtrl::registroMovimientoCapital` | `desarrollador-php` | `controladores/CuentasCtrl.php:93-173` | T-02, T-04 | `php -l` OK; valida según H2.3 (sin `cap_usuarioId` requerido); `verificarUsuarioEnviado`; `insert_id` 0 → `denegarAcceso('cuenta=<id> cuentas/movCapital')`; respuesta con las mismas 6 claves; P-3 #3 → 200, P-5 #3 → 403. | RN-01–RN-03, RN-10, D-08 |
| T-09 | Reescribir `CuentasCtrl::actualizarNombreCuenta` | `desarrollador-php` | `controladores/CuentasCtrl.php:176-235` | T-02, T-04 | `php -l` OK; verificación previa con `obtenerCuentaActivaDeUsuario` (null → 403) y `UPDATE` con el usuario de la sesión; respuesta con las mismas 3 claves; renombrar con el mismo nombre → 200 (no 403); P-5 #4 → 403. | RN-01–RN-03, RN-10, D-09 |
| T-10 | Reescribir `CuentasCtrl::eliminarCuenta` | `desarrollador-php` | `controladores/CuentasCtrl.php:237-275` | T-02, T-04 | `php -l` OK; misma verificación que T-09; respuesta `{"success":"Cuenta eliminada exitosamente"}` sin cambios; P-5 #5 → 403 y la cuenta de A sigue activa. | RN-01–RN-03, D-09 |
| T-11 | Ajustar `BitacoraMdl`: propiedad, bloqueos, cierre condicionado y borrado | `desarrollador-php` | `modelos/BitacoraMdl.php:14-118` | T-03 | `php -l` OK; (1) nuevo `obtenerBitacoraDeUsuario(int $idBitacora, int $idUsuario, bool $bloquear = false): ?array` con `SELECT b.bit_idbitacora, b.bit_cueIdCuentas, b.bit_situacion FROM sckb_bitacora b WHERE b.bit_idbitacora = ? AND b.bit_usuarioId = ? AND b.bit_estado = '1' AND EXISTS (SELECT 1 FROM sckc_cuentas c WHERE c.cue_idCuentas = b.bit_cueIdCuentas AND c.cue_usuarioId = ? AND c.cue_estado = '1')` (+ ` FOR UPDATE`) con `"iii"`; (2) `crearBitacora(...)` sin `try/catch` ni borrado manual, con `ejecutarInsercionRetornaID`, devuelve la fila de `obtenerBitacoraId`; (3) `finalizarOperacionBitacora` agrega `AND bit_situacion = 'O'` al `WHERE`; (4) nuevo `eliminarBitacoraPorId(int $idBitacora): int` (`DELETE FROM sckb_bitacora WHERE bit_idbitacora = ?`) reemplaza a `eliminarBitacoraError`; (5) se eliminan `eliminarBitacoraError` y `anularFinalizarOperacionBitacora`; (6) métodos tocados con tipos. | RN-03, RN-04, RN-06, RN-08, RN-09, D-07, D-18 |
| T-12 | Reescribir `BitacoraCtrl::crearBitacora` | `desarrollador-php` | `controladores/BitacoraCtrl.php:1-118` | T-02, T-04, T-11 | `php -l` OK; el controlador crea un `Enlace` y lo pasa a `BitacoraMdl` y `CuentasMdl`; valida según H2.3 (`obs_tipoObserva` ∈ `I/E/P/L/F`); `verificarUsuarioEnviado($data['bit_usuarioId'] ?? null, 'bitacora/crear')`; transacción: `obtenerCuentaActivaDeUsuario(cuenta, usuario, true)` (null → revertir → 403) → `crearBitacora` → confirmar; respuesta = fila creada (igual que hoy); P-3 #6 → 200, P-5 #6 → 403 sin filas. | RN-01–RN-04, RN-06, RN-10, RN-12, D-14, D-18 |
| T-13 | Reescribir `BitacoraCtrl::obtenerBitacoraPorCuenta` | `desarrollador-php` | `controladores/BitacoraCtrl.php:126-172` | T-02, T-04, T-11 | `php -l` OK; valida `bit_cueIdCuentas`; `verificarUsuarioEnviado`; `obtenerCuentaActivaDeUsuario` (null → 403); consulta con el usuario de la sesión; respuesta con las mismas 19 claves; P-5 #7 → 403. | RN-01–RN-04 |
| T-14 | Reescribir `BitacoraCtrl::eliminarBitacoraBitacora` con propiedad y transacción | `desarrollador-php` | `controladores/BitacoraCtrl.php:179-206` | T-02, T-11 | `php -l` OK; `leerEntero($id, 'id')`; transacción: `obtenerBitacoraDeUsuario(id, usuario, true)` (null → revertir → 403) → `eliminarObservacion` → `eliminarBitacoraPorId` → confirmar; respuesta `{"success": <id>}` igual que hoy; P-5 #9 → 403 y BIT_A sigue existiendo; P-6 `?id=1%20UNION%20SELECT%201` → 400. | RN-03, RN-06, RN-08, C-05 |
| T-15 | Limpiar `ReglasKellyMdl` de reversiones manuales | `desarrollador-php` | `modelos/ReglasKellyMdl.php:33-37,74-78,99-103,121-125` | T-03 | `php -l` OK; se eliminan `eliminarResultadoOperativas`, `eliminarRiesgoBeneficio`, `eliminarFactorTotal`, `eliminarRentabilidad`; la línea 54 (`b` invertido) **no** cambia (`git diff` no la muestra). | RN-06, RN-14, D-17 |
| T-16 | Reescribir `ReglasKellyCtrl::finalizarOperacionBitacora` con propiedad, bloqueos y transacción | `desarrollador-php` | `controladores/ReglasKellyCtrl.php:1-258` | T-02, T-04, T-11, T-15 | `php -l` OK; un `Enlace` compartido por `BitacoraMdl`, `ReglasKellyMdl`, `CuentasMdl`; validación H2.3 (`bit_situacion` = `F`; divisor por defecto en la constante `DIVISOR_KELLY_POR_DEFECTO = 10`); `verificarUsuarioEnviado($data['bit_usuarioId'] ?? null, 'bitacora/finalizaBitacora')`; Flujo D de H3 exacto; sin llamadas a métodos borrados; P-3 #8 → 200 con las mismas 9 claves; P-5 #8 → 403; P-7 → 200 + 409; P-8 → 422 con la fila `Q` persistida (`cap_usuarioId` = A, `cap_cueIdCuentas` = cuenta). | RN-01–RN-09, RN-11–RN-13, C-05, D-13, D-16, D-17 |
| T-17 | Ajustar `ComentariosMdl`: propiedad de la observación y actualizaciones parciales | `desarrollador-php` | `modelos/ComentariosMdl.php:14-50` | T-03 | `php -l` OK; nuevo `obtenerObservacionDeBitacora(int $idObservacion, int $idBitacora, bool $bloquear = false): ?array` con `SELECT obs_idObserva FROM scko_observacion WHERE obs_idObserva = ? AND obs_bitIdbitaco = ?` (+ ` FOR UPDATE`); `actualizarBitacoraTPBESL(int $idBitacora, int $idUsuario, ?float, ?float, ?float): int` con `SET bit_precioEntra = COALESCE(?, bit_precioEntra), bit_precioSL = COALESCE(?, bit_precioSL), bit_precioTP = COALESCE(?, bit_precioTP) WHERE bit_idbitacora = ? AND bit_usuarioId = ?`; `actualizarObservacion(int $idObservacion, int $idBitacora, ?string, ?string): int` con `COALESCE` y `WHERE obs_idObserva = ? AND obs_bitIdbitaco = ?`; métodos tocados con tipos. | RN-03, RN-08 |
| T-18 | Reescribir `ComentariosCtrl::ObtenerObservacionesPorBitacora` | `desarrollador-php` | `controladores/ComentariosCtrl.php:228-266` | T-02, T-11, T-17 | `php -l` OK; el controlador crea un `Enlace` y lo pasa a `ComentariosMdl` y `BitacoraMdl`; `leerEntero($id, 'id')`; `obtenerBitacoraDeUsuario` (null → 403); respuesta con las mismas 6 claves; P-5 #10 → 403. | RN-03, RN-04 |
| T-19 | Reescribir `ComentariosCtrl::crearComentarioPorBitacora` (lote atómico) | `desarrollador-php` | `controladores/ComentariosCtrl.php:21-106` | T-02, T-11, T-17 | `php -l` OK; normaliza a lista (objeto con `obs_bitIdbitaco` → `[objeto]`; si no, `array_is_list` y 1–10 elementos, si no → 400); valida **todos** los elementos (H2.3) antes de escribir; transacción: para cada bitácora distinta en orden ascendente `obtenerBitacoraDeUsuario(id, usuario, true)` (null → revertir → 403) → por elemento: `validarObservacion` → `sobreEscribirObservacion` o `crearComentariosPorBitacora` → confirmar; respuesta con las mismas 6 claves por elemento; P-5 #11 (simple y mixto) → 403 con 0 filas nuevas. | RN-03, RN-06, RN-08, RN-10, D-14, D-15 |
| T-20 | Reescribir `ComentariosCtrl::actualizarBitacoraComentario` | `desarrollador-php` | `controladores/ComentariosCtrl.php:114-218` | T-02, T-11, T-17 | `php -l` OK; validación H2.3; transacción: `obtenerBitacoraDeUsuario(bit, usuario, true)` → `obtenerObservacionDeBitacora(obs, bit, true)` (cualquiera null → revertir → 403) → `actualizarBitacoraTPBESL` → `actualizarObservacion` → confirmar; el éxito **no** depende de `affected_rows`; respuesta con las mismas 7 claves; guardar sin cambios → 200; P-5 #12 → 403. | RN-03, RN-06, RN-08 |
| T-21 | Aceptar cuerpo vacío o `{}` en `criterioKelly/*` | `desarrollador-php` | `rutas/CriterioKellyRts.php:63-116` | T-01 | `php -l` OK; las 5 acciones reciben `$data = []` cuando el cuerpo es vacío o `{}`; las acciones desconocidas siguen respondiendo 400; P-3 #13–#17 con `{}` → 200. | D-10 |
| T-22 | Filtrar los 5 reportes de `CriterioKellyMdl` por dueño de la cuenta | `desarrollador-php` | `modelos/CriterioKellyMdl.php:14-36,117-129` | T-03 | `php -l` OK; cada consulta agrega `INNER JOIN sckc_cuentas cue ON cue.cue_idCuentas = <tabla>.<col_cuenta> AND cue.cue_usuarioId = ?` (sin filtrar `cue_estado`, para no cambiar los resultados actuales) y el tipo `i` adicional; se elimina el bloque comentado `CriterioKellyMdl.php:37-114`; firmas `(int $idUsuario)`. | RN-05, C-02 |
| T-23 | Reescribir los 5 métodos de `CriterioKellyCtrl` con el usuario de la sesión | `desarrollador-php` | `controladores/CriterioKellyCtrl.php:21-227` | T-02, T-21, T-22 | `php -l` OK; cada método: `verificarUsuarioEnviado($data['cke_usuarioId'] ?? null, 'criterioKelly/<accion>')`, consulta con `idUsuarioSesion()`, `catch (Throwable)` con `error_log` y 500 genérico; claves de respuesta sin cambios; P-4 #13–#17 → 403; P-5c → B no ve `CUENTA_A`. | RN-01, RN-02, RN-05, RN-12 |
| T-24 | Ejecutar la batería de pruebas H7.2 y el diagnóstico de integridad | `desarrollador-php` | Sin cambios de código (pruebas contra `http://localhost/criterio_kelly/rest_criteriokelly/`) | T-05–T-23 | Todas las líneas de P-1…P-10 con el código esperado; `grep -rn "getMessage()" controladores` solo dentro de `error_log(`; `grep -rnE "_usuarioId'\]" controladores` solo dentro de llamadas a `verificarUsuarioEnviado(`; diagnóstico D-20 ejecutado y su salida guardada en la evidencia. | Todas |
| T-25 | Actualizar `README.md` de `rest_criteriokelly` | `desarrollador-php` | `README.md:83-163` | T-24 | Tablas de endpoints sin `*_usuarioId` en los cuerpos y con la nota "el usuario sale de la sesión; si se envía y no coincide → 403"; nueva sección "Autorización" (dueño por cuenta, 403 idéntico, auditoría, transacciones, orden de bloqueos); "Validaciones principales" según H2.3; "Estado actual" sin los bugs corregidos (`bit_situacion`, `obs_tipoObserva`, transacciones) y con el bug nuevo corregido (`quemarCapitalCuenta`) y el diagnóstico D-20; los demás bugs se mantienen. | Plan §5.5 |

### H7.2 Batería de pruebas `curl` (usada por T-01 y T-24)

Requisitos: Apache y MySQL activos; HLT-01, HLT-02 y HLT-03 ejecutados; `rest_usuario` atendiendo `persona/agregar` y `autenticacion/autenticar`. Se ejecuta en Git Bash.

```bash
CK=http://localhost/criterio_kelly/rest_criteriokelly
US=http://localhost/criterio_kelly/rest_usuario
MYSQL="/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e"
RESP="${TMPDIR:-/tmp}/hlt04_respuesta.json"

# pet <token|-> <MÉTODO> <url> [json] → imprime "<código> <primeros 4000 bytes del cuerpo>"
pet() {
  local token="$1" metodo="$2" url="$3" cuerpo="${4:-}"
  local args=(-s -o "$RESP" -w '%{http_code}' -X "$metodo" -H 'X-Requested-With: CriterioKelly')
  [ "$token" != "-" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$cuerpo" ] && args+=(-H 'Content-Type: application/json' --data "$cuerpo")
  echo "$(curl "${args[@]}" "$url") $(head -c 4000 "$RESP")"
}
sesion() { curl -s -X POST "$US/autenticacion/autenticar" -H 'Content-Type: application/json' -H 'X-Requested-With: CriterioKelly' --data "{\"usuario\":\"$1\",\"clave\":\"$2\"}"; }

# P-1 · Usuarios de prueba A y B (si ya existen, persona/agregar responde error y se sigue con el login)
for u in a b; do
  pet - POST "$US/persona/agregar" "{\"nombres\":\"Prueba\",\"apellidos\":\"HLT $u\",\"correo\":\"prueba_hlt_$u@localhost.test\",\"telefono\":\"0999999999\",\"usuario\":\"prueba_hlt_$u\",\"clave\":\"Kelly-Prueba-$u-2026!\"}"
done
# persona/agregar crea usuarios en usu_situacion='P' (sist_generico.sql:83) y el login exige 'A' (ValidacionMdl.php:20): se activan solo en la base LOCAL de pruebas
$MYSQL "UPDATE sgen_usuario SET usu_situacion='A' WHERE usu_usuario IN ('prueba_hlt_a','prueba_hlt_b')"
SA=$(sesion prueba_hlt_a 'Kelly-Prueba-a-2026!'); TOKEN_A=$(echo "$SA" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/'); ID_A=$(echo "$SA" | sed -E 's/.*"id":"?([0-9]+).*/\1/')
SB=$(sesion prueba_hlt_b 'Kelly-Prueba-b-2026!'); TOKEN_B=$(echo "$SB" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/'); ID_B=$(echo "$SB" | sed -E 's/.*"id":"?([0-9]+).*/\1/')
echo "A=$ID_A B=$ID_B"            # dos ids distintos; los tokens duran 15 min: si una prueba da 401 inesperado, repetir estas 2 líneas
NO_EXISTE=2147483000              # id que no existe

# P-3 · Caso feliz de A (esperado 200) y datos de A
pet "$TOKEN_A" POST "$CK/cuentas/nueva" '{"cue_nombre":"HLT04-A","fecha_valor":"2026-11-02","valor_cuenta":1000}'          # 200
CUENTA_A=$(pet "$TOKEN_A" GET "$CK/cuentas/obtener" | sed -E 's/.*"cue_idCuentas":([0-9]+),"cue_nombre":"HLT04-A".*/\1/')
pet "$TOKEN_A" POST "$CK/cuentas/nueva" '{"cue_nombre":"HLT04-B","fecha_valor":"2026-11-02","valor_cuenta":500}'           # 200 (con token A: segunda cuenta de A)
pet "$TOKEN_B" POST "$CK/cuentas/nueva" '{"cue_nombre":"HLT04-PROPIA-B","fecha_valor":"2026-11-02","valor_cuenta":1000}'   # 200
CUENTA_B=$(pet "$TOKEN_B" GET "$CK/cuentas/obtener" | sed -E 's/.*"cue_idCuentas":([0-9]+),"cue_nombre":"HLT04-PROPIA-B".*/\1/')
pet "$TOKEN_A" POST "$CK/cuentas/movCapital" "{\"cap_cueIdCuentas\":$CUENTA_A,\"cap_monto\":100,\"cap_capital\":1100,\"cap_tipoMovimie\":\"D\"}"  # 200
pet "$TOKEN_A" PUT  "$CK/cuentas/nombre" "{\"cue_idCuenta\":$CUENTA_A,\"cue_nombre\":\"HLT04-A\"}"                         # 200 (mismo nombre: no da 403)
BIT_A=$(pet "$TOKEN_A" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":$CUENTA_A,\"bit_divisa\":\"EURUSD\",\"bit_tipoOperaci\":\"COMPRA\",\"bit_fechaCrea\":\"2026-11-02T10:00:00.000Z\",\"obs_comentario\":\"inicio\",\"obs_tipoObserva\":\"I\",\"obs_imagen\":null}" | sed -E 's/.*"bit_idbitacora":([0-9]+).*/\1/')
BIT_A2=$(pet "$TOKEN_A" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":$CUENTA_A,\"bit_divisa\":\"GBPUSD\",\"bit_tipoOperaci\":\"VENTA\",\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"I\"}" | sed -E 's/.*"bit_idbitacora":([0-9]+).*/\1/')
BIT_B=$(pet "$TOKEN_B" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":$CUENTA_B,\"bit_divisa\":\"EURUSD\",\"bit_tipoOperaci\":\"COMPRA\",\"obs_comentario\":\"b\",\"obs_tipoObserva\":\"I\"}" | sed -E 's/.*"bit_idbitacora":([0-9]+).*/\1/')
pet "$TOKEN_A" POST "$CK/bitacora/listBitacora" "{\"bit_cueIdCuentas\":$CUENTA_A}"                                          # 200 con BIT_A
pet "$TOKEN_A" POST "$CK/comentarios/crearComentario" "[{\"obs_bitIdbitaco\":$BIT_A,\"obs_comentario\":\"emocion\",\"obs_tipoObserva\":\"E\",\"obs_imagen\":\"--\"}]"  # 200
OBS_A=$(pet "$TOKEN_A" GET "$CK/comentarios/observaciones?id=$BIT_A" | sed -E 's/.*"obs_idObserva":([0-9]+).*/\1/')
OBS_B=$(pet "$TOKEN_B" GET "$CK/comentarios/observaciones?id=$BIT_B" | sed -E 's/.*"obs_idObserva":([0-9]+).*/\1/')
pet "$TOKEN_A" PUT "$CK/comentarios/comentarioBitacora" "{\"bit_idbitacora\":$BIT_A,\"obs_idObserva\":$OBS_A,\"bit_precioEntra\":1.1,\"bit_precioSL\":1.0,\"bit_precioTP\":1.2,\"obs_comentario\":\"editado\"}"  # 200
pet "$TOKEN_A" PUT "$CK/bitacora/finalizaBitacora" "{\"bit_idbitacora\":$BIT_A,\"bit_cueIdCuentas\":$CUENTA_A,\"bit_resultado\":\"GANADOR\",\"bit_situacion\":\"F\",\"bit_respeReglas\":\"SI\",\"bit_montoResult\":50,\"cke_numDivisor\":10}"  # 200
for a in obtenerPorcentaje obtenerResultados detalleOperacion operacionAnalisis observacionAnalisis; do pet "$TOKEN_A" POST "$CK/criterioKelly/$a" '{}'; done   # 5 × 200
pet "$TOKEN_A" GET "$CK/cuentas/obtener?id=$ID_A"                                                                             # 200 (id coincidente aceptado, D-01)

# P-2 · Sin token y con token inventado → 401 en todos
for r in "GET cuentas" "GET cuentas/obtener" "POST cuentas/nueva" "POST cuentas/movCapital" "PUT cuentas/nombre" "DELETE cuentas/eliminar" \
         "POST bitacora/crear" "POST bitacora/listBitacora" "PUT bitacora/finalizaBitacora" "DELETE bitacora/eliminarBitacora?id=$BIT_A" \
         "GET comentarios/observaciones?id=$BIT_A" "POST comentarios/crearComentario" "PUT comentarios/comentarioBitacora" \
         "POST criterioKelly/obtenerPorcentaje" "POST criterioKelly/obtenerResultados" "POST criterioKelly/detalleOperacion" \
         "POST criterioKelly/operacionAnalisis" "POST criterioKelly/observacionAnalisis"; do
  set -- $r
  if [ "$1" = GET ]; then pet - GET "$CK/$2"; pet "token-inventado-123" GET "$CK/$2"
  else pet - "$1" "$CK/$2" '{}'; pet "token-inventado-123" "$1" "$CK/$2" '{}'; fi
done                                                                                                                           # todas 401

# P-4 · Id de usuario distinto al de la sesión (B envía el id de A) → 403
pet "$TOKEN_B" GET  "$CK/cuentas/obtener?id=$ID_A"
pet "$TOKEN_B" POST "$CK/cuentas/nueva" "{\"cue_nombre\":\"X\",\"cue_usuarioId\":$ID_A,\"fecha_valor\":\"2026-11-02\",\"valor_cuenta\":1}"
pet "$TOKEN_B" POST "$CK/cuentas/movCapital" "{\"cap_usuarioId\":$ID_A,\"cap_cueIdCuentas\":$CUENTA_B,\"cap_monto\":1,\"cap_capital\":1,\"cap_tipoMovimie\":\"D\"}"
pet "$TOKEN_B" PUT  "$CK/cuentas/nombre" "{\"cue_usuarioId\":$ID_A,\"cue_idCuenta\":$CUENTA_B,\"cue_nombre\":\"X\"}"
pet "$TOKEN_B" DELETE "$CK/cuentas/eliminar" "{\"cue_usuarioId\":$ID_A,\"cue_idCuenta\":$CUENTA_B}"
pet "$TOKEN_B" POST "$CK/bitacora/crear" "{\"bit_usuarioId\":$ID_A,\"bit_cueIdCuentas\":$CUENTA_B,\"bit_divisa\":\"EURUSD\",\"bit_tipoOperaci\":\"COMPRA\",\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"I\"}"
pet "$TOKEN_B" POST "$CK/bitacora/listBitacora" "{\"bit_usuarioId\":$ID_A,\"bit_cueIdCuentas\":$CUENTA_B}"
pet "$TOKEN_B" PUT  "$CK/bitacora/finalizaBitacora" "{\"bit_usuarioId\":$ID_A,\"bit_idbitacora\":$BIT_B,\"bit_cueIdCuentas\":$CUENTA_B,\"bit_resultado\":\"GANADOR\",\"bit_situacion\":\"F\",\"bit_respeReglas\":\"SI\",\"bit_montoResult\":1}"
for a in obtenerPorcentaje obtenerResultados detalleOperacion operacionAnalisis observacionAnalisis; do pet "$TOKEN_B" POST "$CK/criterioKelly/$a" "{\"cke_usuarioId\":$ID_A}"; done
pet "$TOKEN_B" GET "$CK/cuentas/obtener?id=abc"                                                                               # formato inválido también → 403
# (13 casos + 1: todos 403 {"error":"Acceso denegado"}; se verifica que no se creó la cuenta "X" de B: $MYSQL "SELECT COUNT(*) FROM sckc_cuentas WHERE cue_nombre='X'" → 0)

# P-5 · Recurso de A con token de B, sin id de usuario → 403; y el mismo con id inexistente → 403 con cuerpo idéntico
for ID in "$CUENTA_A" "$NO_EXISTE"; do
  pet "$TOKEN_B" POST "$CK/cuentas/movCapital" "{\"cap_cueIdCuentas\":$ID,\"cap_monto\":1,\"cap_capital\":0,\"cap_tipoMovimie\":\"R\"}"
  pet "$TOKEN_B" PUT  "$CK/cuentas/nombre" "{\"cue_idCuenta\":$ID,\"cue_nombre\":\"Robada\"}"
  pet "$TOKEN_B" DELETE "$CK/cuentas/eliminar" "{\"cue_idCuenta\":$ID}"
  pet "$TOKEN_B" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":$ID,\"bit_divisa\":\"EURUSD\",\"bit_tipoOperaci\":\"COMPRA\",\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"I\"}"
  pet "$TOKEN_B" POST "$CK/bitacora/listBitacora" "{\"bit_cueIdCuentas\":$ID}"
done
for ID in "$BIT_A2" "$NO_EXISTE"; do
  pet "$TOKEN_B" PUT  "$CK/bitacora/finalizaBitacora" "{\"bit_idbitacora\":$ID,\"bit_cueIdCuentas\":$CUENTA_B,\"bit_resultado\":\"GANADOR\",\"bit_situacion\":\"F\",\"bit_respeReglas\":\"SI\",\"bit_montoResult\":1}"
  pet "$TOKEN_B" DELETE "$CK/bitacora/eliminarBitacora?id=$ID"
  pet "$TOKEN_B" GET  "$CK/comentarios/observaciones?id=$ID"
  pet "$TOKEN_B" POST "$CK/comentarios/crearComentario" "{\"obs_bitIdbitaco\":$ID,\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"P\"}"
  pet "$TOKEN_B" PUT  "$CK/comentarios/comentarioBitacora" "{\"bit_idbitacora\":$ID,\"obs_idObserva\":$OBS_A,\"obs_comentario\":\"x\"}"
done
pet "$TOKEN_B" PUT "$CK/bitacora/finalizaBitacora" "{\"bit_idbitacora\":$BIT_A2,\"bit_cueIdCuentas\":$CUENTA_A,\"bit_resultado\":\"GANADOR\",\"bit_situacion\":\"F\",\"bit_respeReglas\":\"SI\",\"bit_montoResult\":1}"
pet "$TOKEN_B" POST "$CK/comentarios/crearComentario" "[{\"obs_bitIdbitaco\":$BIT_B,\"obs_comentario\":\"ok\",\"obs_tipoObserva\":\"P\"},{\"obs_bitIdbitaco\":$BIT_A2,\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"P\"}]"  # lote mixto → 403
pet "$TOKEN_B" PUT "$CK/comentarios/comentarioBitacora" "{\"bit_idbitacora\":$BIT_B,\"obs_idObserva\":$OBS_A,\"obs_comentario\":\"x\"}"                                   # su bitácora + observación de A → 403
# Todas 403 {"error":"Acceso denegado"}; el cuerpo con CUENTA_A/BIT_A2 es idéntico al de NO_EXISTE.
# P-5b · Los datos de A no cambiaron:
pet "$TOKEN_A" GET "$CK/cuentas/obtener"                                   # HLT04-A sigue con su nombre y capital 1100
pet "$TOKEN_A" POST "$CK/bitacora/listBitacora" "{\"bit_cueIdCuentas\":$CUENTA_A}"   # BIT_A2 existe y sigue en situación O
$MYSQL "SELECT COUNT(*) FROM scko_observacion WHERE obs_bitIdbitaco=$BIT_B AND obs_tipoObserva='P'"   # 0 (el lote mixto no escribió nada)
# P-5c · Reportes: B no ve la cuenta de A
for a in obtenerPorcentaje obtenerResultados detalleOperacion operacionAnalisis observacionAnalisis; do pet "$TOKEN_B" POST "$CK/criterioKelly/$a" '{}' | grep -c "\"cue_idCuentas\":$CUENTA_A\|\"cke_cueIdCuentas\":$CUENTA_A"; done   # 5 × 0

# P-6 · Inyección SQL y entrada inválida (sin efecto)
pet "$TOKEN_B" GET "$CK/cuentas/obtener?id=1%27%20OR%20%271%27%3D%271"                       # 403 (id no coincide)
pet "$TOKEN_A" DELETE "$CK/bitacora/eliminarBitacora?id=1%20UNION%20SELECT%201"               # 400
pet "$TOKEN_A" GET "$CK/comentarios/observaciones?id=1%27--"                                  # 400
pet "$TOKEN_A" POST "$CK/cuentas/nueva" '{"cue_nombre":"x'"'"' OR '"'"'1'"'"'='"'"'1","fecha_valor":"2026-11-02","valor_cuenta":1}'   # 400
pet "$TOKEN_A" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":$CUENTA_A,\"bit_divisa\":\"EURUSD' UNION SELECT 1-- \",\"bit_tipoOperaci\":\"COMPRA\",\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"I\"}"  # 400
pet "$TOKEN_A" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":\"$CUENTA_A OR 1=1\",\"bit_divisa\":\"EURUSD\",\"bit_tipoOperaci\":\"COMPRA\",\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"I\"}"  # 400
pet "$TOKEN_A" POST "$CK/cuentas/movCapital" "{\"cap_cueIdCuentas\":$CUENTA_A,\"cap_monto\":1,\"cap_capital\":1,\"cap_tipoMovimie\":\"D' OR 1=1\"}"   # 400
pet "$TOKEN_A" POST "$CK/cuentas/movCapital" "{\"cap_cueIdCuentas\":$CUENTA_A,\"cap_monto\":1,\"cap_capital\":1,\"cap_tipoMovimie\":\"Q\"}"          # 400
pet "$TOKEN_A" POST "$CK/comentarios/crearComentario" "{\"obs_bitIdbitaco\":$BIT_A2,\"obs_comentario\":\"'); DROP TABLE sckb_bitacora; --\",\"obs_tipoObserva\":\"P\"}"  # 200: se guarda como texto
$MYSQL "SELECT COUNT(*) FROM sckb_bitacora"                                                    # la tabla sigue existiendo
pet "$TOKEN_B" POST "$CK/criterioKelly/obtenerPorcentaje" '{"cke_usuarioId":"1 OR 1=1"}'      # 403
pet "$TOKEN_A" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":$CUENTA_A,\"bit_divisa\":\"EURUSD\",\"bit_tipoOperaci\":\"COMPRA\",\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"I\",\"obs_imagen\":\"data:image/png;base64,PHNjcmlwdD4=\"}"  # 400 (no es PNG real)

# P-7 · Carrera: dos cierres concurrentes de la misma bitácora → uno 200 y otro 409
F="{\"bit_idbitacora\":$BIT_A2,\"bit_cueIdCuentas\":$CUENTA_A,\"bit_resultado\":\"PERDEDOR\",\"bit_situacion\":\"F\",\"bit_respeReglas\":\"NO\",\"bit_montoResult\":10}"
(pet "$TOKEN_A" PUT "$CK/bitacora/finalizaBitacora" "$F" > /tmp/hlt04_c1.txt) & (RESP=/tmp/hlt04_r2.json pet "$TOKEN_A" PUT "$CK/bitacora/finalizaBitacora" "$F" > /tmp/hlt04_c2.txt) & wait
cat /tmp/hlt04_c1.txt /tmp/hlt04_c2.txt                                                      # un 200 y un 409
$MYSQL "SELECT COUNT(*) FROM sckr_resultado WHERE res_cueIdCuentas=$CUENTA_A"                # 2 (cierre de BIT_A en P-3 + un solo cierre de BIT_A2)

# P-8 · 422 de límite de pérdida intacto y fila Q con el dueño correcto
pet "$TOKEN_A" POST "$CK/cuentas/nueva" '{"cue_nombre":"HLT04-LIMITE","fecha_valor":"2026-11-02","valor_cuenta":10}'
CL=$(pet "$TOKEN_A" GET "$CK/cuentas/obtener" | sed -E 's/.*"cue_idCuentas":([0-9]+),"cue_nombre":"HLT04-LIMITE".*/\1/')
B1=$(pet "$TOKEN_A" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":$CL,\"bit_divisa\":\"EURUSD\",\"bit_tipoOperaci\":\"COMPRA\",\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"I\"}" | sed -E 's/.*"bit_idbitacora":([0-9]+).*/\1/')
pet "$TOKEN_A" PUT "$CK/bitacora/finalizaBitacora" "{\"bit_idbitacora\":$B1,\"bit_cueIdCuentas\":$CL,\"bit_resultado\":\"PERDEDOR\",\"bit_situacion\":\"F\",\"bit_respeReglas\":\"SI\",\"bit_montoResult\":10}"   # 200 (balance 0)
B2=$(pet "$TOKEN_A" POST "$CK/bitacora/crear" "{\"bit_cueIdCuentas\":$CL,\"bit_divisa\":\"EURUSD\",\"bit_tipoOperaci\":\"COMPRA\",\"obs_comentario\":\"x\",\"obs_tipoObserva\":\"I\"}" | sed -E 's/.*"bit_idbitacora":([0-9]+).*/\1/')
pet "$TOKEN_A" PUT "$CK/bitacora/finalizaBitacora" "{\"bit_idbitacora\":$B2,\"bit_cueIdCuentas\":$CL,\"bit_resultado\":\"GANADOR\",\"bit_situacion\":\"F\",\"bit_respeReglas\":\"SI\",\"bit_montoResult\":5}"    # 422 + mensaje de límite de pérdida
$MYSQL "SELECT cap_usuarioId, cap_cueIdCuentas FROM sckc_capital WHERE cap_tipoMovimie='Q' AND cap_cueIdCuentas=$CL"   # una fila: ID_A  CL

# P-9 · Eliminar bitácora propia (al final, para no afectar P-5)
pet "$TOKEN_B" DELETE "$CK/bitacora/eliminarBitacora?id=$BIT_B"                               # 200 {"success":BIT_B}
pet "$TOKEN_B" DELETE "$CK/cuentas/eliminar" "{\"cue_idCuenta\":$CUENTA_B}"                    # 200

# P-10 · Auditoría: los 403 de B quedaron registrados (columnas de HLT-03 D-05) y sin secretos
$MYSQL "SELECT COUNT(*) FROM sgen_auditoria WHERE aud_detalle REGEXP '[A-Za-z0-9_-]{32,}'"   # 0
$MYSQL "SELECT COUNT(*) FROM sgen_auditoria WHERE aud_evento='ACCESO_DENEGADO' AND aud_servicio='rest_criteriokelly' AND aud_usuId=$ID_B"   # ≥ número de 403 de B en P-4, P-5 y P-6
```

Diagnóstico de integridad (T-24, solo lectura, D-20):

```bash
$MYSQL "SELECT 'bitacora', COUNT(*) FROM sckb_bitacora b JOIN sckc_cuentas c ON c.cue_idCuentas=b.bit_cueIdCuentas WHERE b.bit_usuarioId<>c.cue_usuarioId
UNION ALL SELECT 'capital', COUNT(*) FROM sckc_capital k JOIN sckc_cuentas c ON c.cue_idCuentas=k.cap_cueIdCuentas WHERE k.cap_usuarioId<>c.cue_usuarioId
UNION ALL SELECT 'kelly', COUNT(*) FROM sckp_criteriokelly p JOIN sckc_cuentas c ON c.cue_idCuentas=p.cke_cueIdCuentas WHERE p.cke_usuarioId<>c.cue_usuarioId"
```

---

## H8 · Reglas de implementación deterministas

Las reglas RI-1…RI-11 de `doc_modo_planificacion.md` son de Angular; para este HLT de backend rigen las de `.claude/agents/desarrollador-php.md`, citadas por sección, con los overrides del plan maestro §5.

| ID | Regla | Fuente |
|----|-------|--------|
| RI-P1 | **PHP 8.2+**: se permiten `mixed`, `never`, `readonly`, `array_is_list`, `str_starts_with`. Nada de PHP 8.3+ exclusivo. Cada archivo pasa `C:\xampp\php\php.exe -l`. | Plan §5.2 (override de "Entorno") |
| RI-P2 | Capas: SQL solo en `modelos/`; validación, códigos HTTP y transacciones en `controladores/`; `rutas/` solo extrae acción y cuerpo. | "Arquitectura obligatoria" |
| RI-P3 | Helpers de `BaseCtrl` (T-02): `leerEntero` acepta `int` o `string` y usa `filter_var(FILTER_VALIDATE_INT, ['options' => ['min_range' => $minimo, 'max_range' => $maximo]])`; `leerDecimal` acepta `int`, `float` o `string` numérica, usa `FILTER_VALIDATE_FLOAT`, exige `is_finite` y el rango; `leerTexto` exige `string`, aplica `trim`, el patrón con `preg_match` sobre el valor crudo, `htmlspecialchars(ENT_QUOTES, 'UTF-8')` y `mb_strlen` del valor escapado ≤ máximo; `leerOpcion` exige `string`, aplica `strtoupper(trim())` e `in_array(..., true)`; `leerFecha` y `leerFechaHora` según H2.3; `leerImagen` según la regla de imagen de H2.3. Errores → `respuestaErrorSimple("El campo '<campo>' es inválido", 400)`, `"El campo '<campo>' es requerido"`, `"El campo '<campo>' excede la longitud permitida"`, `"El campo '<campo>' debe ser uno de: <valores separados por coma>"` o `"La imagen de '<campo>' no es válida"`. `verificarUsuarioEnviado`: `null`, ausente o `''` → continúa; si no, `filter_var(FILTER_VALIDATE_INT)` ≠ `idUsuarioSesion()` → `denegarAcceso("usuario enviado en <origen>")`. `denegarAcceso`: `error_log('[ACCESO_DENEGADO] usuario=' . $this->idUsuarioSesion() . ' ' . $motivo)`, registra con `(new RegistroAuditoria(new Enlace(), SERVICIO_ACTUAL))->registrar('ACCESO_DENEGADO', $this->idUsuarioSesion(), ContextoSesion::familia(), $motivo)` (D-04) y responde `respuestaErrorSimple(self::MENSAJE_ACCESO_DENEGADO, 403)`. | "Entrada", H5 D-03/D-04 |
| RI-P4 | **Siempre** consultas preparadas con `Enlace` y la cadena de tipos correcta; ninguna interpolación. El `FOR UPDATE` opcional se elige entre **dos constantes SQL fijas** por un `bool`, nunca concatenando entrada. | "Base de datos" |
| RI-P5 | Transacciones: `$this->enlace->iniciarTransaccion(); try { ... $this->enlace->confirmarTransaccion(); } catch (Throwable $error) { $this->enlace->revertirTransaccion(); throw $error; }` dentro del `try/catch` externo del método. Antes de un 403/409/400 dentro de la transacción se llama a `revertirTransaccion()`; antes del 422 y del 200, a `confirmarTransaccion()` (D-16). | "Base de datos", C-05 |
| RI-P6 | Orden de bloqueos: cuenta → bitácora → observación; `FOR UPDATE` solo en consultas de una tabla por clave primaria (D-07). | H5 D-07 |
| RI-P7 | Cada método público del controlador: `try { ... } catch (Throwable $error) { error_log('[<Clase>::<metodo>] ' . $error->getMessage()); $this->respuestaErrorSimple('Error interno del servidor', 500); }`. Nunca `getMessage()` al cliente. | "Errores y cabeceras" |
| RI-P8 | Contrato de respuesta: `respuestaExitosaSimple` / `respuestaErrorSimple`; mismas claves de éxito que hoy; 422 solo para límite de pérdida; ningún `echo`/`var_dump` antes de la respuesta. | "Contrato de respuesta", C-07 |
| RI-P9 | Tipos declarados en todo método nuevo o modificado y en las propiedades (`private CuentasMdl $cuentasModelo;`); comparaciones estrictas. | "Estándares de código" |
| RI-P10 | Sin efectos fuera de alcance: una tarea solo toca los archivos de su fila (H7.1). No se modifican archivos de `configuracion/` (copias idénticas del plan §4.2). | doc §10 RI-10, plan §4.2 |
| RI-P11 | Commits solo si el usuario los pide, en español, desde `rest_criteriokelly/` (repositorio propio), con la línea de coautoría que indique el sistema. | doc §10 RI-11, `CLAUDE.md` |

Cualquier caso no cubierto se resuelve imitando el código vecino del mismo archivo; si contradice una regla anterior, prevalece la regla y se registra como desviación (RS-6).

---

## H9 · Reglas de seguimiento de ejecución

Semántica de los checks: `⬜` no realizado, `✅` realizado y verificado, `❌` fallido, `➖` no aplica (con motivo). Estados: `PENDIENTE` → `EN_CURSO` → `HECHA` | `BLOQUEADA` | `OMITIDA`. Rigen RS-1…RS-9 de `doc_modo_planificacion.md` §11.5.

Checks de backend (extensión de `planificador.md`): **C4** = `C:\xampp\php\php.exe -l` sin errores sobre cada archivo tocado; **C5** = prueba `curl` del endpoint afectado (caso feliz + al menos un caso de error) con la respuesta real, tomada de H7.2.

Plantilla común de ficha (se repite para cada tarea con su nombre):

```
T-0N — <nombre>
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea real)
    [⬜] C2. Cumple el criterio de aceptación (H7.1) — evidencia: <comando/salida>
    [⬜] C3. Respeta H8 (RI-P1…RI-P11) y H11
    [⬜] C4. php -l OK sobre cada archivo tocado
    [⬜] C5. curl del endpoint afectado (feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (git diff solo muestra los archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

Fichas:

```
T-01 — Verificar precondiciones HLT-01/02/03            Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-02 — Helpers de BaseCtrl                              Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-03 — Enlace compartido en 5 modelos                   Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-04 — CuentasMdl                                       Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-05 — CuentasRts obtener                               Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-06 — CuentasCtrl::obtenerCuentasPorUsuario            Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-07 — CuentasCtrl::agregarCuenta                       Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-08 — CuentasCtrl::registroMovimientoCapital           Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-09 — CuentasCtrl::actualizarNombreCuenta              Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-10 — CuentasCtrl::eliminarCuenta                      Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-11 — BitacoraMdl                                      Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-12 — BitacoraCtrl::crearBitacora                      Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-13 — BitacoraCtrl::obtenerBitacoraPorCuenta           Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-14 — BitacoraCtrl::eliminarBitacoraBitacora           Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-15 — ReglasKellyMdl sin reversiones manuales          Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-16 — ReglasKellyCtrl::finalizarOperacionBitacora      Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-17 — ComentariosMdl                                   Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-18 — ComentariosCtrl::ObtenerObservacionesPorBitacora Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-19 — ComentariosCtrl::crearComentarioPorBitacora      Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-20 — ComentariosCtrl::actualizarBitacoraComentario    Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-21 — CriterioKellyRts cuerpo {}                       Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-22 — CriterioKellyMdl JOIN por dueño                  Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-23 — CriterioKellyCtrl (5 métodos)                    Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-24 — Batería curl + diagnóstico                       Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-25 — README                                           Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
```

Tablero global (lo mantiene el agente de implementación, sincronizado con las fichas):

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 … T-25 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

En T-01, T-24 y T-25, C4 se marca `➖` (no se toca PHP); en T-03, T-04, T-11, T-15, T-17 y T-22 (modelos sin endpoint propio), C5 se verifica con el `curl` del endpoint que los usa, indicado en su criterio de aceptación.

---

## H10 · Diseño del reporte de ejecución

```
REPORTE DE EJECUCIÓN — HLT-04 · Autorización por dueño en rest_criteriokelly
  1. Resumen ejecutivo         (1–3 frases)
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas          (copia de H9: estado + C1…C6 de T-01…T-25)
  4. Cobertura vs. HLT         (RN-01…RN-14 → resultado; ¿100 %?)
  5. Cambios realizados        (archivo:línea y tipo de cambio)
  6. Verificaciones ejecutadas (php -l de cada archivo; salida real de P-1…P-10; greps de T-24; diagnóstico D-20)
  7. Desviaciones y decisiones (respecto a este HLT, con causa)
  8. Pendientes / bloqueos      (checks en ⬜/❌ con la acción requerida)
  9. Próximos pasos            (si el estado ≠ COMPLETADO; aviso a HLT-07 con H5.1)
```

Reglas RR-1…RR-5 de `doc_modo_planificacion.md` §12.2: `COMPLETADO` solo con todas las tareas `HECHA` y todos sus checks aplicables en `✅`; la sección 6 muestra salidas reales; cada cambio referencia `ruta:línea`; lo fallido se declara.

---

## H11 · Convenciones de desarrollo y arquitectura de código limpio

| ID | Convención | Aplicación en este HLT |
|----|-----------|------------------------|
| CV-1 | Nombres en español, verbo + objeto en `camelCase` para métodos (`obtenerCuentaActivaDeUsuario`, `obtenerBitacoraDeUsuario`, `obtenerObservacionDeBitacora`, `eliminarBitacoraPorId`, `verificarUsuarioEnviado`, `denegarAcceso`, `leerEntero`…). | Todos los métodos nuevos. |
| CV-2 | Sufijos del proyecto: `<Recurso>Rts`, `<Recurso>Ctrl` (extiende `BaseCtrl`), `<Recurso>Mdl`. Sin archivos nuevos. | AF-4: no se renombran métodos legado (`ObtenerObservacionesPorBitacora`, `eliminarBitacoraBitacora`, `registroMovimientoCapital`), porque la ruta los invoca. |
| CV-3 | Variables descriptivas (`$idUsuario`, `$idCuenta`, `$cuentaBloqueada`), booleanos con `es`/`esta`/`tiene`/`existe`, constantes en `UPPER_SNAKE_CASE` (`DIVISOR_KELLY_POR_DEFECTO`, `MAXIMO_COMENTARIOS_POR_SOLICITUD`, `TIPOS_OBSERVACION_PERMITIDOS = ['I','E','P','L','F']`, `TIPOS_OPERACION_PERMITIDOS = ['COMPRA','VENTA']`, `TIPOS_MOVIMIENTO_PERMITIDOS = ['D','R','C']`, `RESULTADOS_PERMITIDOS = ['GANADOR','PERDEDOR']`, `RESPETO_REGLAS_PERMITIDOS = ['SI','NO']`). Prohibidos `$res`, `$obj`, `$aux`, `$data` fuera del parámetro de entrada. | Controladores y modelos tocados. |
| CV-4 | Variables con SQL: `$sql` + propósito (`$sqlCuentaActivaDeUsuario`, `$sqlCuentaActivaDeUsuarioBloqueo`). Columnas explícitas en las consultas nuevas. | T-04, T-11, T-17, T-22. |
| CV-5 | Una responsabilidad por método; retornos tempranos; sin código comentado, sin depuración, sin métodos sin uso (se eliminan los de reversión manual y el bloque comentado de `CriterioKellyMdl`). | T-11, T-15, T-22. |
| CV-6 | Sin números mágicos: límites de H2.3 como constantes de clase (`MONTO_MAXIMO_CAPITAL = 99999999.9999`, `PRECIO_MAXIMO = 999999.999999`, `MONTO_MAXIMO_RESULTADO = 9999999.999`, `DIVISOR_KELLY_MAXIMO = 1000`, longitudes de columna). | Controladores. |
| CV-7 | PHPDoc solo cuando aporta (formato de arreglos devueltos, motivo del orden de bloqueos o del 403 uniforme). Comentarios en español. | Modelos y `BaseCtrl`. |
| CV-8 | Arquitectura en capas `Rts → Ctrl → Mdl → Enlace`: dependencias en un solo sentido; los modelos no leen `$_GET` ni deciden códigos HTTP; las rutas no validan negocio. | Todas las tareas. |
