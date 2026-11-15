# HLT-05 · Suscripción inicial idempotente en `rest_suscripcion` (cierre de D-17) · v2 (delta)

| Campo | Valor |
|-------|-------|
| HLT | HLT-05 · versión **v2 (delta)** |
| Fecha | 2026-11-07 |
| Complementa a | [HLT-05-2026-11-02-autorizacion-suscripcion-divisas.md](HLT-05-2026-11-02-autorizacion-suscripcion-divisas.md) (v1, ejecutado; el [REPORTE](evidencias/HLT-05/REPORTE.md) no declara estado global y deja sin evidencia la duplicidad concurrente y el 409 por transacción repetida: se trata como **PARCIAL**). **Todo lo de la v1 sigue vigente**, salvo lo que esta versión cambia de forma explícita (RN-08 de la v1 queda reemplazada, ver RN-21). La v1 no se sobrescribe ni se vuelve a ejecutar. |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4): C-01, C-02, C-05, A-07 |
| Plan maestro | [PLAN-MAESTRO-HU-001-v2](PLAN-MAESTRO-HU-001-v2.md): **D-17 (cerrada)**, D-18, AJ-01 |
| Contrato de planificación | `docs/planificador.md` + `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11, extensiones backend) |
| Proyecto | `rest_suscripcion` (git propio). `rest_divisas` no cambia. |
| Agente de implementación | `desarrollador-php` (todas las tareas) |
| Depende de | HLT-05 v1 ejecutado (código presente; se verifica en T-18). **No depende de HLT-06 v2**: las pruebas activan a sus usuarios por SQL, así que puede ejecutarse en paralelo (plan maestro §6). |
| Lo consume | HLT-07 v3 (primer inicio de sesión) |
| PHP | **8.2.35** |
| Veredicto senior (H6) | **APROBADO** (ronda 3, ver H6) |

> **Referencias `ruta:línea`.** Leídas el 2026-11-07 sobre el código ya modificado por la v1 (rutas relativas a `rest_suscripcion/`). Si una tarea de este HLT desplaza líneas, se localiza el punto por el nombre del método y se anota la línea real en la ficha.

---

## H1 · Propósito

### Requerimiento literal

> `HLT-05-2026-11-02-autorizacion-suscripcion-divisas-v2.md` (rest_suscripcion): cierra D-17 en H5 (el plan se reserva en el dispositivo; primer login crea la suscripción con `crearSinPago { sus_pinIdPlanin }`), e idempotencia: 409 si el usuario ya tiene suscripción pendiente o activa. Si HLT-05 ya fue ejecutado (hay `docs/Planificacion/evidencias/HLT-05/REPORTE.md`), la v2 debe ser un **delta**: solo tareas nuevas sobre el código ya existente, verificando primero el estado real.
>
> D-17 (plan maestro v2): *"En el primer inicio de sesión de un usuario activo sin suscripción, la app llama a `crearSinPago { sus_pinIdPlanin }` con Bearer, usando el plan reservado o el plan Libre si no hay ninguno, y después borra la reserva. `crearSinPago` sigue protegido por token (HLT-05) y no entra en la lista pública."* — AJ-01: *"confirmar que `crearSinPago` responde 409 si el usuario ya tiene una suscripción pendiente o activa (idempotencia del primer inicio de sesión)."*

### Propósito

Permitir que la app cree la suscripción inicial del trader justo después de su primer inicio de sesión (el único momento con token válido) sin duplicar suscripciones si la llamada se repite, se hace desde dos dispositivos o el usuario ya tenía un plan.

### Resultado esperado

- `POST suscripcion/crearSinPago { sus_pinIdPlanin }` crea la suscripción pendiente del usuario de la sesión **solo si no tiene otra pendiente o activa vigente**; si la tiene, responde 409 `El usuario ya tiene una suscripción pendiente o activa` sin modificar nada.
- La comprobación y la inserción ocurren en una transacción serializada: dos peticiones simultáneas producen un 200 y un 409.
- `crearSinPago` sigue exigiendo token (no está en `RUTAS_PUBLICAS`); `planes/disponible` sigue siendo la única ruta pública.
- D-17 queda cerrada con el contrato que consumirá HLT-07 v3 (H5.1).

### Fuera de alcance

1. Cambios en `rest_usuario` o en la app (HLT-06 v2, HLT-07 v3, HLT-08 v2).
2. Un endpoint nuevo para consultar si el usuario tiene suscripción (D-21: la app usa el 409).
3. Índice único o columnas nuevas (D-12 de la v1: sin cambios de esquema).
4. Cambiar `crearConPago`, `porUsuario`, `planes/suscritos` o `rest_divisas`.
5. Expirar o limpiar suscripciones vencidas (procedimientos de `anexos/`).
6. Validar que el plan reservado sea de pago o gratuito: el servidor acepta cualquier plan activo, como hoy (D-24).
7. Bugs de `rest_divisas` y del esquema vivo desfasado (AJ-05, HLT-11).

### Feature(s) afectada(s)

| Servicio | Recurso / artefacto |
|----------|---------------------|
| `rest_suscripcion` | `POST /suscripcion/crearSinPago`: `controladores/SuscripcionCtrl.php` (`insertarSuscripcionSinPago`), `modelos/SuscripcionMdl.php` |
| `rest_suscripcion` | `README.md` |

---

## H2 · Reglas de negocio

Las RN-01…RN-14 de la v1 siguen vigentes, salvo **RN-08 (reemplazada por RN-21)**. Se agregan:

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-15 | `crearSinPago` es idempotente por usuario | Con una suscripción vigente (RN-19) del usuario de la sesión, `POST crearSinPago` → 409 `{"error":"El usuario ya tiene una suscripción pendiente o activa"}`, **cualquiera que sea el plan pedido**, y `spsu_suscripcion` no cambia (mismo `COUNT(*)` y mismas fechas). | AJ-01, D-17 |
| RN-16 | `crearSinPago` sigue protegido | `grep -n "RUTAS_PUBLICAS" rest_suscripcion/index.php` → `['planes/disponible']`; `POST crearSinPago` sin token → 401. | D-17, A-07, RN-10 v1 |
| RN-17 | Contrato de la llamada inicial | Cuerpo `{ "sus_pinIdPlanin": <entero> }`; plan inexistente o inactivo → 400 `El plan seleccionado no es válido`; entero inválido → 400 (`leerEntero`); `sus_usuarioId` opcional y, si llega distinto al de la sesión → 403 `Acceso denegado` (D-01/D-06 de la v1). El usuario sale siempre de `ContextoSesion::idUsuario()`. | D-17, RN-01, RN-02 v1 |
| RN-18 | Comprobación e inserción serializadas | Dentro de una transacción: `existeSuscripcionVigente(..., bloquear: true)` y luego el `INSERT`; con 5 peticiones simultáneas del mismo usuario → exactamente un 200 y cuatro 409 y 1 fila nueva. | C-05, D-20 |
| RN-19 | Qué es "pendiente o activa" | Fila con `sus_usuarioId = <usuario>`, `sus_situacion IN ('P','A')` y (`sus_fechaFin IS NULL` o `sus_fechaFin >= <ahora de PHP, 'Y-m-d H:i:s'>`). Las `C` (cancelada), `S` (pausada), `E` (expirada) y las `P`/`A` ya vencidas **no** bloquean. | D-19, `sist_suscripcion.sql:127` |
| RN-20 | Respuesta de éxito sin cambios | 200 con el objeto de `formatearSuscripcion` (`SuscripcionCtrl.php:250-264`): `sis_idSuscrip`, `sus_usuarioId` (el de la sesión), `sus_pinIdPlanin`, fechas, `sus_situacion = 'P'`, `sus_referenPago = ''`. Fechas: inicio = ahora, fin = +1 mes (`MESES_SUSCRIPCION_SIN_PAGO`). | RN-12 v1, D-23 |
| RN-21 | RN-08 de la v1 reemplazada | `crearSinPago` ya **no** actualiza las fechas de una pendiente existente del mismo plan: la existencia de cualquier vigente produce 409. `actualizarSuscripcionSinPago` deja de existir. | D-22 |
| RN-22 | `crearConPago` no cambia | `crearConPago` conserva su comportamiento (suscripción propia, pendiente por plan, transacción, 409 por `idTransaccion`); `grep -n "obtenerSuscripcionPendientePorPlan" controladores/SuscripcionCtrl.php` → solo en `insertarSuscripcionConPago`. | RN-04, RN-07, RN-09 v1 |
| RN-23 | El 409 no se audita ni expone datos | El 409 no escribe en `sgen_auditoria` (no es acceso denegado) y su cuerpo no incluye id ni datos de la suscripción existente. | C-04, D-26 |

---

## H3 · Flujo principal de ejecución

Secuencia común: `.htaccess` → `index.php` (`Enrutador`, `ValidadorSesion::exigir()` porque la ruta no es pública, `LimitadorPeticiones::controlar()`, `index.php:66-70`) → `rutas/SuscripcionRts.php:54-92` (`manejarPost`: acción, cuerpo JSON, `case 'crearSinPago'`) → `SuscripcionCtrl` → `SuscripcionMdl` → `Enlace` → MySQL.

### Flujo A · `POST suscripcion/crearSinPago` (primer inicio de sesión de la app)

```
[App: login correcto, sin marca local de "suscripción inicial verificada" → { sus_pinIdPlanin } con Bearer]
 → ValidadorSesion (401 si falta o es inválido) → SuscripcionRts manejarPost 'crearSinPago' (400 si el cuerpo falta, no es JSON o está vacío)
 → SuscripcionCtrl::insertarSuscripcionSinPago($datos)
   1. verificarUsuarioEnviado($datos['sus_usuarioId'] ?? null) → 403 + ACCESO_DENEGADO si es otro
   2. $idPlan = leerEntero(sus_pinIdPlanin) → 400 con el mensaje del campo
   3. PlanesMdl::obtenerPlanIntervaloActivo($idPlan) → null → 400 "El plan seleccionado no es válido"
   4. $ahora = date('Y-m-d H:i:s'); $fechaFin = $ahora + 1 mes
   5. Enlace::iniciarTransaccion()
   6. SuscripcionMdl::existeSuscripcionVigente($idUsuario, $ahora, true)   ← FOR UPDATE
        ├─ true  → revertirTransaccion → 409 {"error":"El usuario ya tiene una suscripción pendiente o activa"}
        └─ false → SuscripcionMdl::insertarSuscripcionSinPago($idUsuario, $idPlan, $ahora, $fechaFin)
   7. confirmarTransaccion; SuscripcionMdl::obtenerSuscripcionDeUsuario($idSuscripcion, $idUsuario)
        └─ null → 404 "No se encontraron detalles de la suscripción" (como hoy, SuscripcionCtrl.php:92-94)
   8. 200 formatearSuscripcion(...)
   └─ Throwable → revertir si hay transacción abierta; error_log("[SuscripcionCtrl::insertarSuscripcionSinPago] …"); 500 "Error interno del servidor"
```

### Ramas de error en la app

`errorInterceptor` mostraría un toast por el 409 (`error.interceptor.ts:26-27`); HLT-07 v3 hace la llamada con `OMITIR_MANEJO_ERROR` para tratar el 409 como "ya tiene suscripción" sin toast. El 422 no se usa.

---

## H4 · Calidad del HLT y cobertura

### H4.1 Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| D-17 cerrada en H5 (plan reservado en el dispositivo, primer login) · H5.2, H5.1 | T-18, T-24 | Revisión del documento y del README |
| 409 si ya tiene pendiente o activa · RN-15, RN-19 | T-19, T-20, T-21 | P-10, P-11 |
| Idempotencia bajo concurrencia · RN-18 | T-19, T-20, T-21 | P-12 |
| `crearSinPago` protegido · RN-16 | T-18, T-23 | P-14; `grep` de T-23 |
| Contrato de la llamada inicial · RN-17 | T-20, T-21 | P-13, P-14 |
| Respuesta sin cambios · RN-20, RN-23 | T-20, T-21 | P-10, P-15 |
| RN-08 reemplazada · RN-21 | T-19, T-20, T-23 | `grep` de T-23 |
| `crearConPago` intacto · RN-22 | T-21, T-22 | P-16, P-5 y P-7 adaptadas |
| Estado real y delta | T-18 | Fichas de T-18 |
| Evidencia pendiente de la v1 (duplicidad concurrente, 409 por transacción, IDOR entre A y B) | T-22 | P-4, P-5, P-7, P-9 adaptadas |
| Documentación | T-24 | Revisión del README |

### H4.2 Checklist

- ✅ Las 11 secciones existen y están completas.
- ✅ Sin marcadores pendientes.
- ✅ Cada RN mapea a ≥ 1 tarea (cobertura 100 %).
- ✅ Cada tarea tiene criterio verificable y ficha de checks (H9).
- ✅ No contradice §0.5 (solo `rest_suscripcion`) ni el plan maestro v2 (D-17, D-18, AJ-01).
- ✅ Referencias `ruta:línea` leídas el 2026-11-07.
- ✅ Decisiones cerradas (H5) sin ambigüedad; D-17 deja de estar pendiente.

---

## H5 · Reglas cerradas de decisión del HLT

### H5.1 Decisiones (continúan la numeración de la v1: D-01…D-17)

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-17 (**cerrada**) | Suscripción inicial tras el registro | A crearla dentro de `persona/agregar` · B reservar el plan en el dispositivo y crearla en el primer inicio de sesión · C activar al registrarse | **B**, decidida por el usuario el 2026-11-02 (plan maestro v2 D-17). `persona/agregar` no crea suscripción; la app guarda el plan solo en el dispositivo (sin datos de sesión) y, en el primer inicio de sesión de un usuario activo (cuenta activada por D-18), llama a `crearSinPago { sus_pinIdPlanin }` con Bearer usando el plan reservado o el Libre, y borra la reserva. `crearSinPago` sigue protegido. **Riesgo aceptado por el usuario:** la reserva se pierde si se reinstala la app, se limpian los datos o se inicia sesión en otro dispositivo; entonces se aplica el plan Libre. | Es la única opción que no abre `crearSinPago` ni cambia la regla de activación; el trabajo de este HLT es hacer esa llamada segura de repetir (D-19, D-20). | No |
| D-18 | Cómo evitar duplicados si la llamada se repite | A sin control (v1 D-16) · B 409 si ya hay pendiente o activa vigente · C reutilizar la existente (RN-08 v1) | **B** | Lo pide AJ-01. C devolvería 200 para una suscripción de otro plan y ocultaría que el plan pedido no se aplicó; el 409 permite a la app distinguirlo y borrar la reserva. | No (contrato) |
| D-19 | Qué cuenta como vigente | A cualquier fila `P`/`A` · B `P`/`A` con `sus_fechaFin` nula o `>= ahora` | **B** (RN-19) | Con A, una pendiente vencida de hace meses (nada la expira: hay 21 filas `P` en la base local) bloquearía para siempre la suscripción inicial y el usuario quedaría sin plan. La comparación usa el `date()` de PHP, el mismo reloj con el que se escriben las fechas (`SuscripcionCtrl.php:66-70`). | No |
| D-20 | Serialización | A sin bloqueo · B transacción con `SELECT … FOR UPDATE` sobre las suscripciones del usuario | **B** | Dos dispositivos o un doble clic no deben crear dos pendientes. No hay índice por `sus_usuarioId` (`SHOW INDEX`: solo la clave primaria y la del plan), así que el bloqueo recorre la tabla y serializa los primeros inicios de sesión: mismo costo aceptado en la v1 D-08 para `spsu_pagos` (22 filas hoy). Cambiar el esquema está fuera de alcance (D-12). Riesgo Media en R-S1. | No |
| D-21 | ¿Un endpoint para saber si hay suscripción? | A `GET suscripcion/estado` nuevo · B ninguno: la app llama a `crearSinPago` y toma el 409 como "ya tiene" | **B** (RD-7) | Ni `porUsuario` ni `planes/suscritos` sirven (solo devuelven pendientes sin pago y en fecha, `SuscripcionMdl.php:39-47`): un 404 no distingue "sin suscripción" de "tiene una activa o pagada". Un endpoint nuevo añade ruta, controlador, modelo y contrato; el 409 ya lo da AJ-01. La app limita el costo con una marca local (HLT-07 v3, D-41). | No |
| D-22 | RN-08 de la v1 y código muerto | A conservar la actualización de fechas · B eliminarla | **B**: se reescribe `insertarSuscripcionSinPago` y se elimina `SuscripcionMdl::actualizarSuscripcionSinPago` (`:90-107`), que solo usaba esa rama. `obtenerSuscripcionPendientePorPlan` se conserva (la usa `crearConPago`). | Dos caminos para el mismo endpoint contradicen la idempotencia; sin uso, el método sobra. | No |
| D-23 | Código y texto de éxito y de conflicto | 201 / 200 | **200** con la suscripción (como hoy) y **409** `El usuario ya tiene una suscripción pendiente o activa` | `respuestaExitosaSimple` solo emite 200 (`BaseCtrl.php:173-179`); menor superficie de cambio para la app. | No |
| D-24 | Plan Libre y precio | A el servidor impone el plan Libre · B acepta cualquier plan activo | **B** | El plan reservado puede ser de pago (queda pendiente sin pago, como hoy con `crearSinPago`); el plan Libre es `pin_idPlanInterv = 1` (`spsu_planintervalo`, precio 0.00) y lo aplica la app. | No |
| D-25 | Esquema | Índice único `(sus_usuarioId, …)` · sin cambios | **Sin cambios** (D-12 de la v1) | Un índice único no expresa "vigente"; la serialización la da la transacción. | No |
| D-26 | Auditoría del 409 | Auditar · no | **No** | No es un acceso denegado; auditarlo llenaría `sgen_auditoria` con reintentos legítimos. | No |
| D-27 | Campos extra del cuerpo | Rechazar · ignorar | **Ignorar** (D-06 de la v1), salvo `sus_usuarioId`, que si llega distinto da 403 | Compatibilidad con la app anterior a HLT-07 v3. | No |

### H5.2 Contrato resultante para HLT-07 v3 (app)

| Endpoint | Cuándo | La app envía | Respuestas que la app debe manejar |
|----------|--------|--------------|------------------------------------|
| `POST suscripcion/crearSinPago` | Tras un inicio de sesión correcto, si la app no tiene la marca local de "suscripción inicial verificada" para ese usuario | `{ "sus_pinIdPlanin": <plan reservado o 1> }` con `Authorization: Bearer`, sin `sus_usuarioId`, con `OMITIR_MANEJO_ERROR` | **200** suscripción creada → marca local + borrar reserva; **409** ya tiene → marca local + borrar reserva; **400** plan inválido o **403/401/429/5xx/red** → no marcar, no borrar (se reintenta en el siguiente inicio de sesión), sin toast ni bloqueo del login |

---

## H6 · Revisión senior

### H6.1 Ronda 1 (adversarial) — veredicto: APROBADO CON CAMBIOS

| # | Ataque / hallazgo | Cambio obligatorio | Aplicado en |
|---|-------------------|--------------------|-------------|
| R1-1 | **Duplicados por carrera** (dos dispositivos, doble clic, reintento del interceptor tras un 401). | Transacción con `FOR UPDATE` antes del `INSERT` (la v1 lo había aceptado: D-16). | D-20, RN-18, P-12 |
| R1-2 | **Usuario bloqueado para siempre** por una pendiente vencida (nada las expira). | Solo cuentan pendientes y activas con fecha de fin vigente. | D-19, RN-19, P-11 |
| R1-3 | **La reserva del dispositivo permite pedir un plan que no existe** (valor manipulado en `localStorage`). | El servidor valida el plan activo contra el catálogo (400); nunca confía en el cliente. | RN-17, P-14 |
| R1-4 | **Crear suscripciones para otro usuario** con `sus_usuarioId`. | Se conserva la verificación de la sesión (403 + auditoría). | RN-17, P-13 |
| R1-5 | **El 409 filtra datos de la suscripción existente** (id, plan). | Cuerpo fijo sin datos; sin auditoría. | RN-23, D-26 |
| R1-6 | **La rama antigua (actualizar fechas) permite extender una pendiente** repitiendo la llamada. | Se elimina (RN-21); toda repetición es 409 sin escritura. | D-22, P-15 |
| R1-7 | **Contradicción con pruebas de la v1** que llaman dos veces a `crearSinPago` y esperan el mismo id (P-3 #3) o crean pendientes de planes 2 y 3 con `crearSinPago`. | T-22 adapta esas pruebas con pendientes insertadas por SQL como fixture. | T-22, P-5 y P-7 adaptadas |
| R1-8 | **Cambio de contrato silencioso para la app**. | H5.2 cierra lo que la app debe manejar; HLT-07 v3 depende de este HLT. | H5.2 |
| R1-9 | **Reloj distinto** entre PHP y MySQL para "vigente". | La fecha de corte la pasa PHP (`date()`), igual que las fechas escritas. | D-19 |

### H6.2 Ronda 2 — checklist senior

| # | Ítem | Estado | Nota |
|---|------|--------|------|
| 1 | Entendimiento | ✅ | H1 cubre D-17 cerrada, el 409 y el delta sobre el código ejecutado. |
| 2 | Reglas de negocio | ✅ | RN-15…RN-23 son comprobables; RN-21 declara explícitamente qué reemplaza de la v1. |
| 3 | Impacto | ✅ | Archivos: `SuscripcionCtrl.php`, `SuscripcionMdl.php`, `README.md`. La app queda alineada en HLT-07 v3. Efecto: las pruebas de la v1 que dependen de RN-08 se adaptan (T-22). |
| 4 | Consistencia arquitectónica | ✅ | Rts → Ctrl → Mdl → `Enlace`; consultas preparadas; transacción con `try/catch`; respuestas por `BaseCtrl`. |
| 5 | Riesgos | ✅ | Tabla H6.3. |
| 6 | Simplicidad | ✅ | Sin endpoint nuevo, sin esquema nuevo, una consulta y una transacción. |
| 7 | Seguridad | ✅ | Usuario siempre de la sesión; plan validado; 409 sin datos; ruta protegida. |
| 8 | Cobertura | ✅ | H4.1 al 100 %. |
| 9 | Determinismo | ✅ | SQL, mensajes y códigos HTTP cerrados. |
| 10 | Ejecutabilidad por agente | ✅ | Cada tarea declara archivos y criterio con comando. |

### H6.3 Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-S1 | El `FOR UPDATE` sin índice por `sus_usuarioId` serializa toda la tabla en cada primer inicio de sesión; con muchos usuarios nuevos a la vez habría espera. | Media | Transacción corta (una lectura y un `INSERT`); 22 filas hoy; un índice por `sus_usuarioId` se propone en HLT-11 junto con AJ-05 (script `ALTER`). |
| R-S2 | La reserva del plan se pierde (reinstalación, otro dispositivo): el usuario recibe el plan Libre. | Media | Aceptado por el usuario (D-17). |
| R-S3 | Con aislamiento `READ COMMITTED` en el hosting el bloqueo de huecos puede no impedir el `INSERT` concurrente. | Baja | El daño es una pendiente duplicada del propio usuario, sin efecto sobre terceros; documentado en el README. |
| R-S4 | Un usuario con suscripción vencida que inicia sesión por primera vez en un dispositivo recibe un plan Libre nuevo. | Baja | Es el comportamiento deseado (queda con plan); la marca local evita repetirlo. |
| R-S5 | Hasta que se ejecute HLT-07 v3, el registro de la app sigue llamando a `crearSinPago` sin token (401 desde la v1). | Media | Ya ocurre desde HLT-05 v1; HLT-07 v3 lo retira. No es regresión de este HLT. |
| R-S6 | `crearSinPago` bloquea toda la tabla y `crearConPago` bloquea filas concretas: dos transacciones simultáneas pueden provocar un bloqueo mutuo; MySQL aborta una (500 genérico). | Baja | La app reintenta `crearSinPago` en el siguiente inicio de sesión (HLT-07 v3, RN-29); el 500 no filtra datos. |

No hay riesgos de severidad Alta.

### H6.4 Preguntas al usuario

Ninguna bloqueante. El plan Libre se identifica con `pin_idPlanInterv = 1` (precio 0.00 en la base local); si en producción cambia el catálogo, HLT-11 revisa la constante de la app.

### H6.5 Observaciones

1. El REPORTE de la v1 no incluye el estado global ni el tablero de checks; la v2 no asume que T-14 de la v1 se completó.
2. `README.md:212` ya documenta el riesgo de concurrencia de `crearSinPago` de la v1 (D-16); T-24 lo reemplaza.

### H6.6 Veredicto final

**APROBADO.** Los 9 cambios de la ronda 1 están aplicados. D-17 queda cerrada sin preguntas abiertas.

---

## H7 · Plan de tareas

Rutas relativas a `rest_suscripcion/` salvo indicación. Agente único `desarrollador-php`; sin paralelismo. `SU=http://localhost/criterio_kelly/rest_suscripcion`.

### H7.1 Tareas

| ID | Tarea | Agente | Archivos `ruta:línea` | Depende de | Criterio de aceptación | RN / HU |
|----|-------|--------|-----------------------|------------|------------------------|---------|
| T-18 | Verificar el estado real tras la v1 y registrar la línea base (solo lectura) | `desarrollador-php` | Lectura: `index.php:29`, `controladores/SuscripcionCtrl.php:55-100`, `modelos/SuscripcionMdl.php:49-107`, `rutas/SuscripcionRts.php:54-92`, `README.md:152-166,212` | — | (1) `C:\xampp\php\php.exe -l` sin errores en esos 4 archivos PHP; (2) `grep -n "RUTAS_PUBLICAS" rest_suscripcion/index.php` → `const RUTAS_PUBLICAS = ['planes/disponible'];`; (3) `grep -n "obtenerSuscripcionPendientePorPlan\|actualizarSuscripcionSinPago" controladores/SuscripcionCtrl.php` anota las líneas (hoy `:71-72` y `:76`); (4) `curl -s -o /dev/null -w "%{http_code}" -X POST $SU/suscripcion/crearSinPago -H "Content-Type: application/json" -H "X-Requested-With: CriterioKelly" -d '{"sus_pinIdPlanin":1}'` → 401; (5) `SELECT sus_situacion, COUNT(*) FROM spsu_suscripcion GROUP BY 1` anotado (hoy `A 1`, `P 21`); (6) estado real de la v1 anotado: qué pruebas P-x de su REPORTE quedaron sin evidencia. | RN-16 |
| T-19 | Agregar `SuscripcionMdl::existeSuscripcionVigente` y eliminar `actualizarSuscripcionSinPago` | `desarrollador-php` | `modelos/SuscripcionMdl.php:49-68` (método nuevo tras `obtenerSuscripcionPendientePorPlan`), `:90-107` (eliminar) | T-18 | `php -l`; firma `existeSuscripcionVigente(int $idUsuario, string $ahora, bool $bloquear = false): bool` con `SELECT sis_idSuscrip FROM spsu_suscripcion WHERE sus_usuarioId = ? AND sus_situacion IN ('P', 'A') AND (sus_fechaFin IS NULL OR sus_fechaFin >= ?) LIMIT 1` (+ ` FOR UPDATE` si `$bloquear`), tipos `'is'`; devuelve `true` si hay fila; `grep -rn "actualizarSuscripcionSinPago" rest_suscripcion --include=*.php` → 0 (tras T-20); sin `SELECT *`. | RN-18, RN-19, RN-21 |
| T-20 | Reescribir `SuscripcionCtrl::insertarSuscripcionSinPago` (Flujo A) | `desarrollador-php` | `controladores/SuscripcionCtrl.php:55-100` | T-19 | `php -l`; orden de pasos de H3 (usuario → plan → `iniciarTransaccion` → `existeSuscripcionVigente(..., true)` → 409 con `revertirTransaccion` o `INSERT` → `confirmarTransaccion` → lectura con dueño → 200); bandera `$transaccionIniciada` y `catch (Throwable)` que revierte como `insertarSuscripcionConPago` (`:218-224`); mensaje 409 exacto de RN-15; sin `obtenerSuscripcionPendientePorPlan` en el método; `grep -n "echo\|var_dump\|print_r" controladores/SuscripcionCtrl.php` → 0. | RN-15, RN-17, RN-18, RN-20, RN-21, RN-23 |
| T-21 | Ejecutar las pruebas de idempotencia de `crearSinPago` (P-10 a P-16) y pegar la salida real | `desarrollador-php` | Sin cambios de código; solo usuarios de prueba `prueba_hlt05s*` y filas de `spsu_suscripcion` de ellos | T-20 | Cada prueba da exactamente el resultado esperado de H7.2. | RN-15…RN-23 |
| T-22 | Ejecutar la evidencia pendiente de la v1 con fixtures SQL (P-4, P-5, P-7, P-9 adaptadas) y pegar la salida real | `desarrollador-php` | Sin cambios de código | T-21 | Cada prueba da exactamente el resultado esperado de H7.3. | RN-02…RN-07, RN-09 de la v1 |
| T-23 | Verificación global | `desarrollador-php` | Solo lectura | T-22 | `php -l` sin errores en todo `.php` tocado; `grep -rn "actualizarSuscripcionSinPago" rest_suscripcion --include=*.php` → 0; `grep -n "RUTAS_PUBLICAS" rest_suscripcion/index.php` → solo `planes/disponible`; `grep -rn "getMessage()" rest_suscripcion/controladores` solo dentro de `error_log(`; `git -C rest_suscripcion diff --stat` solo `SuscripcionCtrl.php`, `SuscripcionMdl.php` y `README.md`; `git -C rest_usuario status --short` y `git -C criterioKellyApp status --short` sin cambios de este HLT. | RN-16, RN-21, RN-22 |
| T-24 | Actualizar el README de `rest_suscripcion` | `desarrollador-php` | `README.md:152-166` (tabla y descripción de `crearSinPago`), `README.md:212` (concurrencia) | T-23 | `crearSinPago` documentado con: cuerpo `{ sus_pinIdPlanin }`, 200, 400, 401, 403, **409** y el texto exacto; regla de vigencia (RN-19); flujo de primer inicio de sesión de D-17 (reserva en el dispositivo, plan Libre = `pin_idPlanInterv` 1, la app trata el 409 como "ya tiene"); la nota de concurrencia reemplazada por la serialización (D-20) y el riesgo R-S1/R-S3; `grep -n "409" rest_suscripcion/README.md` ≥ 2 líneas (incluida `crearConPago`). | RN-15, RN-19 |

### H7.2 Batería de pruebas `curl` (P-10 a P-16)

Requisitos: Apache y MySQL activos; `PET`, `sesion` y `MYSQL` como en HLT-04 H7.2 (P-1) y en HLT-05 v1 H7.2. Usuarios nuevos creados con `persona/agregar` y **activados por SQL** (fixture local; independiente de HLT-06 v2):

```bash
SU=http://localhost/criterio_kelly/rest_suscripcion
US=http://localhost/criterio_kelly/rest_usuario
MYSQL="/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e"
for n in 1 2 3; do
  pet - POST "$US/persona/agregar" "{\"nombres\":\"Prueba\",\"apellidos\":\"HLT05 S$n\",\"correo\":\"prueba.hlt05s$n@example.com\",\"telefono\":\"09900005$n$n\",\"usuario\":\"prueba_hlt05s$n\",\"clave\":\"Cielo-Rojo-Montaña-77\"}"
done
$MYSQL "UPDATE sgen_usuario SET usu_situacion='A' WHERE usu_usuario IN ('prueba_hlt05s1','prueba_hlt05s2','prueba_hlt05s3')"
S1=$(sesion prueba_hlt05s1 'Cielo-Rojo-Montaña-77'); T1=$(echo "$S1" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/'); ID1=$(echo "$S1" | sed -E 's/.*"id":"?([0-9]+).*/\1/')
# igual para T2/ID2 (prueba_hlt05s2) y T3/ID3 (prueba_hlt05s3); los tokens duran 15 min
cuenta() { $MYSQL "SELECT COUNT(*) FROM spsu_suscripcion WHERE sus_usuarioId=$1"; }
```

| ID | Prueba | Comando (resumen exacto) | Resultado esperado |
|----|--------|--------------------------|--------------------|
| P-10 | Primera llamada y repetición | `cuenta $ID1` (0); `pet "$T1" POST "$SU/suscripcion/crearSinPago" '{"sus_pinIdPlanin":1}'`; repetir igual; `pet "$T1" POST … '{"sus_pinIdPlanin":2}'`; `cuenta $ID1`; `$MYSQL "SELECT sus_situacion, sus_pinIdPlanin FROM spsu_suscripcion WHERE sus_usuarioId=$ID1"` | `0`; 1.ª: 200 con `sis_idSuscrip`, `sus_pinIdPlanin:1`, `sus_situacion:"P"`, `sus_usuarioId` = `ID1`; 2.ª y 3.ª: 409 `{"error":"El usuario ya tiene una suscripción pendiente o activa"}`; `cuenta` = 1; fila `P 1`. |
| P-11 | Vigencia (RN-19) | Con la fila de P-10: (a) `$MYSQL "UPDATE spsu_suscripcion SET sus_fechaFin = NOW() - INTERVAL 1 DAY WHERE sus_usuarioId=$ID1"` y `crearSinPago` plan 1 → 200 (fila nueva); (b) `UPDATE … SET sus_situacion='E'` a todas y `crearSinPago` plan 1 → 200; (c) `UPDATE … SET sus_situacion='C'` a todas y repetir → 200; (d) `UPDATE … SET sus_situacion='A', sus_fechaFin = NOW() + INTERVAL 30 DAY WHERE sis_idSuscrip=<la última>` y repetir → 409; (e) `UPDATE … SET sus_fechaFin = NULL` y repetir → 409 | (a)(b)(c): 200 y `cuenta` aumenta en 1 cada vez; (d)(e): 409 y `cuenta` sin cambio. |
| P-12 | Carrera: 5 llamadas simultáneas | `cuenta $ID2` (0); `for i in 1 2 3 4 5; do (pet "$T2" POST "$SU/suscripcion/crearSinPago" '{"sus_pinIdPlanin":1}' > "$TMPDIR/hlt05v2_$i.txt") & done; wait`; `cat "$TMPDIR"/hlt05v2_*.txt \| cut -c1-3 \| sort \| uniq -c`; `cuenta $ID2` | `1 200` y `4 409`; `cuenta` = 1. |
| P-13 | Usuario ajeno | `pet "$T3" POST … "{\"sus_pinIdPlanin\":1,\"sus_usuarioId\":$ID2}"`; `cuenta $ID2`, `cuenta $ID3`; `pet "$T3" POST … "{\"sus_pinIdPlanin\":1,\"sus_usuarioId\":$ID3}"`; `SELECT COUNT(*) FROM sgen_auditoria WHERE aud_evento='ACCESO_DENEGADO' AND aud_servicio='rest_suscripcion' AND aud_usuId=$ID3` | 1.ª: 403 `{"error":"Acceso denegado"}`; `cuenta $ID2` sin cambio (1) y `cuenta $ID3` = 0; 2.ª (id propio): 200; auditoría ≥ 1. |
| P-14 | Entrada inválida, plan y token | `pet - POST … '{"sus_pinIdPlanin":1}'` y con token inventado; `pet "$T1" POST … '{"sus_pinIdPlanin":9999}'`; `… '{"sus_pinIdPlanin":"2 OR 1=1"}'`; `… '{}'`; `curl -s -o /dev/null -w "%{http_code}" "$SU/planes/disponible"`; `grep -n "RUTAS_PUBLICAS" rest_suscripcion/index.php` | 401 y 401; 400 `El plan seleccionado no es válido`; 400; 400 `Los datos no pueden estar vacíos` (rutas `:75-79`); 200; solo `planes/disponible`. Ninguna crea filas. |
| P-15 | El 409 no modifica nada | Con una pendiente vigente de `ID1` (como en P-10): `ANTES=$($MYSQL "SELECT CONCAT(sis_idSuscrip,'|',sus_fechainicio,'|',sus_fechaFin,'|',sus_situacion) FROM spsu_suscripcion WHERE sus_usuarioId=$ID1 ORDER BY 1")`; 3 × `crearSinPago` (plan 1, plan 2, plan 16); comparar | Las 3 respuestas son 409 con el mismo cuerpo (sin id ni plan); `ANTES` igual a `DESPUÉS`; `SELECT COUNT(*) FROM sgen_auditoria WHERE aud_evento='ACCESO_DENEGADO' AND aud_usuId=$ID1` no aumenta. |
| P-16 | `crearConPago` sigue igual | Con `T1` (pendiente de plan 1 vigente): `pet "$T1" POST "$SU/suscripcion/crearConPago" '{"pin_idPlanInterv":2,"idTransaccion":"HLT05V2-TX-1","metodoPago":"PAYPAL"}'`; repetir con el mismo `idTransaccion`; `$MYSQL "SELECT pag_monto FROM spsu_pagos WHERE pag_idTransac='HLT05V2-TX-1'"` | 1.ª: 200 JSON válido; 2.ª: 409 `La transacción ya fue registrada`; `1.25` (precio del catálogo). |

### H7.3 Evidencia pendiente de la v1, adaptada (T-22)

Cambio respecto a la v1: donde ésta crea pendientes de los planes 2 y 3 con `crearSinPago` (P-3 #3 a #6, P-5), la fila se inserta por SQL como fixture, porque `crearSinPago` ahora da 409:

```bash
fixture() { $MYSQL "INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaCrea) VALUES ($1, $2, NOW(), NOW() + INTERVAL 1 MONTH, NOW()); SELECT LAST_INSERT_ID();"; }
```

| ID | Prueba | Cambio frente a la v1 | Resultado esperado |
|----|--------|-----------------------|--------------------|
| P-4 | Id de usuario distinto → 403 (7 casos) | Igual que la v1 H7.2 P-4 con `T2`/`T3` y los ids de esta batería; el caso de `crearSinPago` ya lo cubre P-13 | 403 en los casos de id ajeno o mal formado; 200/404 propio con id propio; `cuenta` de la víctima sin cambio. |
| P-5 | Suscripción ajena (o inexistente) en `crearConPago` | `SUS_A3=$(fixture $ID2 3)` en lugar de `crearSinPago`; igual que la v1 para el resto (incluido `#6` con la transacción de otro usuario y los 400 de plan y de plan Libre) | 2 × 403 con el mismo cuerpo; la fila de A intacta; `SELECT COUNT(*) FROM spsu_pagos WHERE pag_idTransac LIKE 'HLT05-B-%'` → 0; 409 con la transacción ajena; 400 `La suscripción no corresponde al plan`; 400 `El plan seleccionado no requiere pago`. |
| P-7 | Misma transacción en paralelo | Igual que la v1: dos usuarios (`T2`, `T3`) envían el mismo `idTransaccion` a la vez con `pin_idPlanInterv` 4 | Un 200 y un 409; `SELECT COUNT(*) FROM spsu_pagos WHERE pag_idTransac='<TX>'` → 1. |
| P-9 | Auditoría | Igual que la v1 | `ACCESO_DENEGADO` de `rest_suscripcion` por los 403 de P-4, P-5 y P-13; `SELECT COUNT(*) FROM sgen_auditoria WHERE aud_detalle REGEXP '[A-Za-z0-9_-]{32,}'` → 0. |

Al terminar, limpiar: `$MYSQL "DELETE p FROM spsu_pagos p JOIN spsu_suscripcion s ON s.sis_idSuscrip=p.pag_susIdSuscri WHERE s.sus_usuarioId IN ($ID1,$ID2,$ID3)"`, luego `DELETE FROM spsu_suscripcion WHERE sus_usuarioId IN (…)`, `DELETE FROM sgen_rolusuario WHERE rus_usuId IN (…)` y `DELETE u, p FROM sgen_usuario u JOIN sgen_persona p ON p.per_idPersona=u.usu_perIdPerso WHERE u.usu_usuario LIKE 'prueba\\_hlt05s%'`.

---

## H8 · Reglas de implementación deterministas

Rigen **RI-P1…RI-P11 de HLT-04 H8** y **RI-S1…RI-S5 de la v1** sin cambios, con estas precisiones:

| ID | Regla |
|----|-------|
| RI-S6 | **Transacción:** `iniciarTransaccion` / `confirmarTransaccion` / `revertirTransaccion` del `Enlace` compartido (`$this->enlace`), con bandera `$transaccionIniciada` y `catch (Throwable)` que revierte solo si la bandera está activa (patrón de `SuscripcionCtrl.php:146-147,218-224`). Toda respuesta de error dentro de la transacción revierte **antes** de responder (las respuestas hacen `exit`). |
| RI-S7 | **SQL:** solo consultas preparadas con tipos correctos (`'is'`, `'iisss'`); columnas explícitas; el corte de vigencia se pasa como parámetro, nunca con `NOW()`. |
| RI-S8 | **Orden de bloqueo:** en `crearSinPago` un solo bloqueo (suscripciones del usuario); `crearConPago` conserva su orden suscripción → pagos (RI-S2). |
| RI-S9 | **Mensajes:** los de RN-15, `El plan seleccionado no es válido` y `Error interno del servidor`; nada de `getMessage()` en respuestas. |
| RI-S10 | **Sin efectos fuera de alcance:** solo `SuscripcionCtrl.php`, `SuscripcionMdl.php` y `README.md`; no se toca `rest_usuario`, `rest_divisas`, la app ni el esquema. |
| RI-S11 | **Commits** solo si el usuario los pide, en español, desde `rest_suscripcion/`. |

---

## H9 · Reglas de seguimiento de ejecución

Responsable: `desarrollador-php`. Símbolos: `⬜` no realizado, `✅` realizado y verificado, `❌` fallido, `➖` no aplica (justificar). Rigen RS-1 a RS-9 del contrato. **C4** = `C:\xampp\php\php.exe -l` sin errores sobre cada archivo tocado; **C5** = prueba `curl` (caso feliz + al menos un error) con la respuesta real. Para tareas sin código (T-18, T-21, T-22, T-23) C4 y/o C5 se marcan `➖` con justificación.

### Fichas

```
T-18 — Verificar el estado real tras la v1 y registrar la línea base
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-19 — Agregar SuscripcionMdl::existeSuscripcionVigente y eliminar actualizarSuscripcionSinPago
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-20 — Reescribir SuscripcionCtrl::insertarSuscripcionSinPago (Flujo A)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-21 — Ejecutar las pruebas de idempotencia de crearSinPago (P-10 a P-16)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-22 — Ejecutar la evidencia pendiente de la v1 con fixtures SQL (P-4, P-5, P-7, P-9 adaptadas)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-23 — Verificación global
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-24 — Actualizar el README de rest_suscripcion
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

### Tablero de avance global

| Tarea | Agente | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|--------|----|----|----|----|----|----|-----------|
| T-18 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-19 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-20 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-21 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-22 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-23 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-24 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

---

## H10 · Diseño del reporte de ejecución

```
REPORTE DE EJECUCIÓN — HLT-05 v2 · Suscripción inicial idempotente (rest_suscripcion)
  1. Resumen ejecutivo         (1–3 frases)
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas         (copia del tablero con estado y C1…C6 de T-18…T-24)
  4. Cobertura vs. HLT         (RN-15…RN-23 y D-17 cerrada → resultado; ¿100 %?)
  5. Cambios realizados        (archivo ruta:línea y tipo; repositorio rest_suscripcion)
  6. Verificaciones ejecutadas (cada comando de H7 y cada P-10…P-16, P-4, P-5, P-7, P-9 → OK/FALLO + salida real)
  7. Desviaciones y decisiones (estado real encontrado en T-18; cualquier desviación, con causa)
  8. Pendientes / bloqueos     (checks en ⬜/❌ con acción requerida)
  9. Próximos pasos            (si el estado no es COMPLETADO; recordatorio: HLT-07 v3 aplica H5.2)
```

`COMPLETADO` solo si T-18…T-24 están `HECHA` con todos sus checks aplicables en `✅` y la sección 6 muestra la salida real de todas las pruebas.

---

## H11 · Convenciones de desarrollo y arquitectura de código limpio

Convenciones de `.claude/agents/desarrollador-php.md` y de la v1, con PHP 8.2.35.

| Elemento | Convención | Ejemplos de este HLT |
|----------|-----------|----------------------|
| Controlador / modelo | `<Recurso>Ctrl` (extiende `BaseCtrl`), `<Recurso>Mdl` | `SuscripcionCtrl`, `SuscripcionMdl` |
| Métodos | verbo + objeto, camelCase, en español | `existeSuscripcionVigente`, `insertarSuscripcionSinPago` |
| Variables | sustantivo descriptivo, camelCase | `$ahora`, `$fechaFin`, `$idSuscripcion`, `$transaccionIniciada` |
| Booleanos | prefijo `es`, `esta`, `tiene`, `existe` | `existeSuscripcionVigente` |
| Constantes | UPPER_SNAKE_CASE | `MESES_SUSCRIPCION_SIN_PAGO` |
| SQL | `$sql` + propósito | `$sqlExisteVigente`, `$sqlInsertarSuscripcion` |
| Tablas y columnas | prefijo del esquema | `spsu_suscripcion.sus_*` |
| Mensajes al usuario | español, sin detalles internos | RN-15 |

Reglas de código limpio: una responsabilidad por método; retornos tempranos; sin código comentado ni métodos sin uso (se elimina `actualizarSuscripcionSinPago`); sin `echo`, `var_dump` ni depuración; sin números mágicos (el `1 month` sale de `MESES_SUSCRIPCION_SIN_PAGO`). Prohibidos `$res`, `$obj`, `$aux`, `$tmp`, `$d`.
