# HLT-05 · Autorización por dueño en `rest_suscripcion` y protección de `rest_divisas`

| Campo | Valor |
|-------|-------|
| HLT | HLT-05 |
| Fecha | 2026-11-02 |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Plan maestro | [PLAN-MAESTRO-HU-001](PLAN-MAESTRO-HU-001.md): contratos cerrados §4 y reglas §5 |
| Contrato de planificación | `docs/planificador.md` + `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11, extensiones backend) |
| Proyectos | `rest_suscripcion` (repositorio git propio) y `rest_divisas` (sin git) |
| Agente de implementación | `desarrollador-php` (todas las tareas) |
| Depende de | HLT-01 (`Enlace` con transacciones), HLT-02 (`LectorSolicitud`, `ManejadorErrores`, `Enrutador`), HLT-03 ([HLT-03-2026-11-02-nucleo-sesion.md](HLT-03-2026-11-02-nucleo-sesion.md): `ContextoSesion` estática con `idUsuario()` y `familia()`, `RegistroAuditoria::registrar`, guardia con `RUTAS_PUBLICAS` y `SERVICIO_ACTUAL` en `index.php`) **ejecutados y cerrados** |
| Hermano | HLT-04 (misma decisión 403 para recurso ajeno o inexistente, mismos helpers de `BaseCtrl`) |
| Lo consume | HLT-07 ([HLT-07-2026-11-02-sesion-app.md](HLT-07-2026-11-02-sesion-app.md), D-24 y D-25 ya asumen este contrato) |
| PHP | **8.2 o superior** (override del plan maestro §5.2) |
| Veredicto senior | **APROBADO** (ronda 2, ver H6) |

> **Referencias `ruta:línea`.** Corresponden al estado leído el 2026-11-02, **antes** de HLT-01/02/03, que pueden desplazar líneas (por ejemplo, el `$rutas` de `index.php` pasa al formato `recurso => archivo` del `Enrutador`). El agente localiza cada punto por nombre de método, `case` o clave del mapa y registra la línea real en su ficha (H9), sin decidir nada de diseño.

---

## H1 · Propósito

| Campo | Contenido |
|-------|-----------|
| Requerimiento literal | "HLT-05 (rest_suscripcion + rest_divisas): igual para /planes y /suscripcion (planes/disponible es público; planes/suscritos/{id}, suscripcion/porUsuario, crearSinPago, crearConPago usan el usuario de la sesión; corrige la línea de depuración de porUsuario y el `echo` de crearConPago porque se tocan; la app hoy llama porUsuario/{id} en ruta y suscripcionPorID que no existe — decide el contrato final de porUsuario (sin id, desde la sesión) y deja constancia para HLT-07); pagos: un usuario solo crea/consulta pagos de sus suscripciones. rest_divisas: todos sus endpoints exigen token (DH-05) vía la guardia de HLT-03 (verifica que no quede ruta sin proteger, incluido /indice, /sinteticos, /otros que apuntan a archivos inexistentes — decide si se eliminan del mapa de rutas); no tiene datos con dueño. Cada HLT: pruebas curl en local con dos usuarios (token A y token B): B no puede leer/modificar/eliminar nada de A en ningún endpoint; id de usuario distinto → 403; recurso ajeno → 404/403 según la decisión; inyección SQL en cada parámetro (comillas, UNION) sin efecto; sin token → 401. Última tarea: README del servicio actualizado." (Con las reglas generales de HLT-04: usuario solo desde `ContextoSesion`, id distinto → 403 + auditoría, verificación de dueño en SQL, transacciones multi-tabla, validación por endpoint según `anexos/*.sql`, formato de respuesta intacto.) Criterios HU: C-01, C-02, C-04, C-05, C-06, C-07, A-07 (apoyo), D-01/D-02, DH-04, DH-05. |
| Propósito | Que solo el dueño de una suscripción pueda verla, reservarla o pagarla, que nadie pueda registrar pagos sobre suscripciones ajenas ni reutilizar el id de transacción de otro, y que los precios de mercado de `rest_divisas` solo los consuma un usuario con sesión. |
| Resultado esperado | `planes/disponible` sigue público; `planes/suscritos`, `suscripcion/porUsuario`, `suscripcion/crearSinPago` y `suscripcion/crearConPago` toman el usuario de la sesión, responden 403 + auditoría si llega un id de usuario distinto y 403 idéntico ante una suscripción ajena o inexistente; `crearConPago` es atómico, toma precio y meses del catálogo y rechaza un id de transacción repetido; desaparecen la depuración de `porUsuario` y el `echo` de `crearConPago`. En `rest_divisas`, `cripto`, `forex` e `indice` exigen token y `sinteticos`/`otros` ya no existen (404). Verificado con `curl` y dos usuarios. |
| Fuera de alcance | (1) Guardia, tokens, 401 y `RUTAS_PUBLICAS` (HLT-03; aquí solo se verifican). (2) `LectorSolicitud`, `Enrutador`, `ManejadorErrores`, estados de servicio por recurso (HLT-02). (3) La app (HLT-07). (4) Endpoint `suscripcion/suscripcionPorID`: **no se crea** (D-09). (5) Ruta para `PagosCtrl::obtenerPagosPendientesVerificacion`: no se crea (D-10). (6) Cambios de esquema, incluido el desfase entre `anexos/sist_suscripcion.sql` y la base viva (`pag_montoConfirmado`, `pag_correo`, `pag_tipocripto`) y un índice único sobre `pag_idTransac` (D-12). (7) Bugs del README fuera de líneas modificadas (D-14). (8) `rest_divisas`: el fatal de `IndiceCtrl` (`parent::__construct()`), la API key y `CURLOPT_SSL_VERIFYPEER` (HLT-01, F-03), el campo `detalle` con `getMessage()` de las rutas (HLT-02, C-08), caché y límites de llamadas externas. (9) Aprobación de pagos y cambio de `sus_situacion` a `A` (proceso administrativo). |
| Feature(s) afectada(s) | `rest_suscripcion` → `/planes`, `/suscripcion`: `controladores/BaseCtrl.php`, `PlanesCtrl.php`, `SuscripcionCtrl.php`; `modelos/PlanesMdl.php`, `SuscripcionMdl.php`, `PagosMdl.php`; `rutas/PlanesRts.php`, `rutas/SuscripcionRts.php`; `README.md`. `rest_divisas` → mapa de rutas de `index.php`; `README.md`. |

---

## H2 · Reglas de negocio

### H2.1 Reglas

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-01 | El usuario de toda operación protegida de `rest_suscripcion` sale **solo** de `ContextoSesion::idUsuario()`. | `grep -nE "iUsuario'\]\|sus_usuarioId'\]\|\\\$_GET\['id'\]" controladores/*.php` solo aparece como argumento de `verificarUsuarioEnviado(`. | C-01, DH-04 |
| RN-02 | Si llega un id de usuario (`planes/suscritos/{id}`, `porUsuario?id=` o `porUsuario/{id}`, `sus_usuarioId`, `iUsuario`) distinto al de la sesión (incluido un formato inválido) → **403 `{"error":"Acceso denegado"}`** + `ACCESO_DENEGADO`; si coincide o no llega, continúa. | P-4: 7 casos → 403; los mismos con el id propio → 200. | C-01, D-01, plan §4.5, HLT-04 D-01 |
| RN-03 | Una suscripción (`sis_idSuscrip`) se verifica contra el usuario **en el SQL** (`WHERE sis_idSuscrip = ? AND sus_usuarioId = ?`). Ajena **o inexistente** → **403 `Acceso denegado`** idéntico + `ACCESO_DENEGADO`. | P-5: suscripción de A y id inexistente → mismo código y mismo cuerpo. | C-02, plan §4.5, HLT-04 D-02 |
| RN-04 | Un pago solo se crea sobre una suscripción del usuario de la sesión: la suscripción enviada se bloquea con su dueño, la reutilizada se busca con su dueño y la nueva se crea con su dueño. Las únicas lecturas de pagos expuestas (`planes/suscritos`) filtran `susc.sus_usuarioId = ?`. | P-5 #4; `PlanesMdl.php:32` conserva el filtro. | C-02, requerimiento "pagos" |
| RN-05 | El precio (`pag_monto`) y la duración (`ins_numMeses`) de `crearConPago` salen del catálogo (`spsu_planintervalo` ⋈ `spsu_intervalosuscr`, `pin_estado = '1'`), nunca del cliente; los valores enviados se ignoran. Plan inexistente o inactivo → 400 `El plan seleccionado no es válido`; precio ≤ 0 → 400 `El plan seleccionado no requiere pago`. | P-3 #5: se envía `pin_precioFinal: 0.01` y la fila de `spsu_pagos` guarda el precio del catálogo. | C-02/C-06 (asignación masiva) |
| RN-06 | Un `idTransaccion` solo puede registrarse una vez en `spsu_pagos` (de cualquier usuario): repetido → **409** `{"error":"La transacción ya fue registrada"}`. | P-5 #6 y P-7. | C-02 (un usuario no reclama el pago de otro) |
| RN-07 | Si `crearConPago` recibe `sis_idSuscrip`, esa suscripción debe ser del usuario (si no, 403) y de ese mismo plan (si no, 400 `La suscripción no corresponde al plan`). Si no lo recibe, reutiliza la suscripción pendiente del usuario para ese plan (`sus_situacion = 'P'`, sin referencia de pago) y, si no hay, crea una. | P-3 #5/#6. | `SuscripcionCtrl.php:156-173` |
| RN-08 | `crearSinPago` no duplica: si el usuario ya tiene una pendiente sin referencia de pago para el plan, actualiza sus fechas y la devuelve; si no, la crea. | P-3 #3: dos llamadas → mismo `sis_idSuscrip`. | `SuscripcionCtrl.php:87-93` |
| RN-09 | `crearConPago` escribe suscripción + pago en **una transacción**; orden de bloqueo fijo **suscripción → pagos**; antes de responder se confirma o se revierte. | Revisión de código T-12; P-7. | C-05 |
| RN-10 | `planes/disponible` es público y no lee `ContextoSesion`. | P-2: sin token → 200. | A-07, plan §4.5 |
| RN-11 | Validación de entrada por endpoint según H2.3; inválido → 400 con el mensaje del campo, **antes** de verificar propiedad. | P-6. | C-06 |
| RN-12 | Formato de respuesta sin cambios (dato directo o `{error}`, mismas claves de éxito; `sus_usuarioId` siempre es el de la sesión). Sin `echo` previo a la respuesta. Errores internos → `500 {"error":"Error interno del servidor"}` sin `getMessage()`. | P-3 (JSON válido en `crearConPago`); `grep -n "echo \"Datos recibidos" rutas/SuscripcionRts.php` = 0. | C-04, C-07, C-08 |
| RN-13 | En `rest_divisas` toda ruta del mapa exige token (`RUTAS_PUBLICAS = []`); el mapa solo contiene recursos con archivo existente (`cripto`, `forex`, `indice`). | P-8: sin token → 401 en las 6 rutas de esos 3 recursos; `sinteticos`/`otros` → 404. | A-07, DH-05 |
| RN-14 | Bugs del README: solo se corrigen los de líneas modificadas (tabla D-14). | Revisión del diff contra D-14. | Plan §5.7 |

### H2.2 Matriz endpoint × autorización (contrato cerrado)

| # | Método y ruta | Usuario hoy (`ruta:línea`) | Id de recurso hoy | Fuente nueva | Verificación de dueño en SQL | Transacción | Prueba IDOR (B→A) |
|---|---------------|-----------------------------|-------------------|--------------|------------------------------|-------------|-------------------|
| 1 | `GET planes/disponible` | — (público) | — | No aplica | No aplica (catálogo) | No | Sin token → 200 |
| 2 | `GET planes/suscritos[/{id}]` | Segmento de ruta (`PlanesRts.php:22-23,64`) | — | Sesión; segmento opcional ≠ → 403 | `WHERE ... susc.sus_usuarioId = ?` (ya existe, `PlanesMdl.php:32`) | No | `B /suscritos/ID_A` → 403; `B` sin id → sin `SUS_A` |
| 3 | `GET suscripcion/porUsuario[?id=][/{id}]` | Query `id` (`SuscripcionRts.php:60`); la app manda segmento (`suscripcion.service.ts:24`) | — | Sesión; query y segmento opcionales, cualquiera ≠ → 403 | `WHERE sus_usuarioId = ?` (ya existe, `SuscripcionMdl.php:22-23`) | No | `B ?id=ID_A` y `B /porUsuario/ID_A` → 403; `B` sin id → sin `SUS_A` |
| 4 | `POST suscripcion/crearSinPago` | Cuerpo `sus_usuarioId` (`SuscripcionCtrl.php:73,81`) | `sus_pinIdPlanin` (catálogo) | Sesión; `sus_usuarioId` opcional ≠ → 403 | Búsqueda de pendiente con `sus_usuarioId = ?`; `UPDATE ... WHERE sis_idSuscrip = ? AND sus_usuarioId = ?`; `INSERT` con id de sesión | No (una escritura en una tabla) | `B {sus_usuarioId:ID_A}` → 403 y 0 filas nuevas para A |
| 5 | `POST suscripcion/crearConPago` | Cuerpo `iUsuario` (`SuscripcionCtrl.php:130,137`) | `sis_idSuscrip` (`:146`), `pin_idPlanInterv` (`:138`) | Sesión; `iUsuario` opcional ≠ → 403 | `SELECT ... FROM spsu_suscripcion WHERE sis_idSuscrip = ? AND sus_usuarioId = ? FOR UPDATE`; pendiente con `sus_usuarioId = ?`; `UPDATE ... AND sus_usuarioId = ?` | **Sí** (`spsu_suscripcion` + `spsu_pagos`) | `B {sis_idSuscrip:SUS_A}` → 403, suscripción de A intacta y 0 pagos nuevos; `B` con el `idTransaccion` de A → 409 |
| 6 | `GET cripto[/disponible]` (`rest_divisas`) | — | — | Token obligatorio | No aplica (sin datos con dueño) | No | Sin token → 401 |
| 7 | `GET forex[/disponible]` | — | — | Token obligatorio | No aplica | No | Sin token → 401 |
| 8 | `GET indice[/disponible]` | — | — | Token obligatorio | No aplica | No | Sin token → 401 (con token, 500 genérico por el bug fuera de alcance) |
| 9 | `sinteticos`, `otros` | — | — | Se eliminan del mapa | — | — | 404 `Recurso no encontrado` con y sin token |

Todo endpoint protegido: sin token o con token inválido → **401** (`ValidadorSesion`, HLT-03).

### H2.3 Validación de entrada (contrato cerrado)

Helpers `leer*` idénticos en comportamiento a HLT-04 T-02 (H8 RI-P3), creados en el `BaseCtrl` de `rest_suscripcion` (T-02).

| Endpoint | Campo | Regla | Fuente del límite |
|----------|-------|-------|-------------------|
| `planes/suscritos` | segmento `{id}` | Opcional; solo se compara con la sesión | — |
| `suscripcion/porUsuario` | `id` (query) y segmento | Opcionales; solo se comparan con la sesión | — |
| `suscripcion/crearSinPago` | `sus_pinIdPlanin` | Entero 1 – 2 147 483 647; debe existir activo | `int(11)`, `pin_estado` |
| | `sus_usuarioId` | Opcional (RN-02) | — |
| | resto (`sus_fechainicio`, `sus_fechaFin`, `sus_situacion`, `sus_referenPago`, `sus_renovAutomatica`, `sus_proximoPago`, `sus_fechaCrea`, `sis_idSuscrip`) | **Ignorados** (los calcula el servidor; la app los envía, `registro.page.ts:234-247`) | D-06 |
| `suscripcion/crearConPago` | `pin_idPlanInterv` | Entero; debe existir activo con precio > 0 | `spsu_planintervalo` |
| | `idTransaccion` | Texto requerido, 1–254, patrón `/^[A-Za-z0-9._:-]+$/` | `sus_referenPago varchar(254)` (`sist_suscripcion.sql:128`) y `pag_idTransac varchar(256)` |
| | `metodoPago` | Opción opcional `CRIPTOMONEDA`, `PAYPAL`, `BANCO`; ausente → `CRIPTOMONEDA` | Comentario de `pag_metodoPago` (`sist_suscripcion.sql:67`) |
| | `comprobante` | Imagen opcional (regla de imagen de HLT-04 H2.3); ausente → `NULL` | `pag_imagen longtext` |
| | `correoTransaccion` | Opcional; `FILTER_VALIDATE_EMAIL` y ≤ 64; ausente → `NULL` | `pag_correo varchar(64)` (base viva, `DESCRIBE`) |
| | `criptomoneda` | Opcional; patrón `/^[A-Z0-9]{2,16}$/`; ausente → `NULL` | `pag_tipocripto varchar(16)` (base viva) |
| | `sis_idSuscrip` | Opcional; ausente, `null` o `0` → sin suscripción indicada; si no, entero 1 – 2 147 483 647 | `int(11)` |
| | `iUsuario` | Opcional (RN-02) | — |
| | `ins_numMeses`, `pin_precioFinal` | **Ignorados** (RN-05) | — |

---

## H3 · Flujo principal de ejecución

```
[Petición] → .htaccess → index.php → Configuracion → ManejadorErrores → CabecerasSeguridad → CorsConfig → LectorSolicitud → Enrutador (404)
   → ¿GET sin acción o "recurso/acción" ∈ RUTAS_PUBLICAS? (rest_suscripcion: ['planes/disponible']; rest_divisas: [])
        ├─ sí → sigue sin token
        └─ no → ValidadorSesion::exigir() (401) → ContextoSesion::establecer(...)
   → LimitadorPeticiones (429) → rutas/<X>Rts.php → <X>Ctrl::<método>
        1. leer* de cada campo (H2.3)                         ── 400
        2. verificarUsuarioEnviado(id de usuario si llega)    ── 403 + ACCESO_DENEGADO
        3. $idUsuario = idUsuarioSesion()
        4. [crearConPago] iniciarTransaccion
        5. verificación de dueño / catálogo en SQL            ── 403 (dueño) o 400 (catálogo) [revertir]
        6. operación                                          ── 409 (transacción repetida) [revertir]
        7. [crearConPago] confirmarTransaccion
        8. respuestaExitosaSimple(dato con la forma de hoy)
   └─ excepción → [revertir] → error_log → 500 genérico
```

**Flujo A · Listados por sesión** (`planes/suscritos`, `suscripcion/porUsuario`): pasos 1–3 → consulta con `sus_usuarioId = ?` → 200 (lista vacía si no hay: `ejecutarConsulta` devuelve `mysqli_result`; se mantiene la comprobación actual de `num_rows === 0` → 404 con su mensaje actual, que solo describe el estado del propio usuario).

**Flujo B · `crearSinPago`**: 1–3 → `PlanesMdl::obtenerPlanIntervaloActivo(plan)` (null → 400) → `SuscripcionMdl::obtenerSuscripcionPendientePorPlan(usuario, plan)` → existe: `actualizarSuscripcionSinPago(id, usuario, hoy, hoy + 1 mes)`; no existe: `insertarSuscripcionSinPago(usuario, plan, hoy, hoy + 1 mes)` → `obtenerSuscripcionDeUsuario(id, usuario)` → 200.

**Flujo C · `crearConPago`**:

```
1-3 → plan = obtenerPlanIntervaloActivo(pin)            ── null → 400 "El plan seleccionado no es válido"; precio ≤ 0 → 400 "El plan seleccionado no requiere pago"
 → iniciarTransaccion
 → si sis_idSuscrip > 0: s = obtenerSuscripcionDeUsuario(sis, usuario, bloquear: true)   ── null → revertir → 403
                         s.sus_pinIdPlanin ≠ pin → revertir → 400 "La suscripción no corresponde al plan"
   si no:               s = obtenerSuscripcionPendientePorPlan(usuario, pin, bloquear: true) (puede ser null)
 → PagosMdl::existeTransaccion(idTransaccion, bloquear: true)                              ── true → revertir → 409
 → s ≠ null: actualizarRangoFechaConPago(s.id, usuario, hoy, hoy + meses, idTransaccion, fin − 1 día)
   s = null: id = insertarSuscripcionConPago(usuario, pin, hoy, hoy + meses, idTransaccion, fin − 1 día)
 → insertarPagoSuscripcion(id, plan.pin_precioFinal, hoy, metodo, idTransaccion, hoy, fin, comprobante, correo, cripto)
 → confirmarTransaccion → obtenerSuscripcionDeUsuario(id, usuario) → 200 (10 claves de hoy)
```

**Flujo D · `rest_divisas`**: guardia de HLT-03 → 401 sin token; con token, la ruta responde como hoy. `sinteticos`/`otros` → `Enrutador` → 404.

Ramas de la app (`errorInterceptor`, sin cambios aquí): 400, 401 (HLT-07 renueva), 403, 404, 409, 500. El 422 no se usa en estos servicios.

---

## H4 · Calidad del HLT y cobertura

### H4.1 Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Verificación |
|--------------------|----------|--------------|
| Precondiciones HLT-01/02/03 | T-01 | `grep` + `curl` de T-01 |
| RN-01, RN-02 | T-02, T-04, T-05, T-06, T-10, T-11, T-12 | P-3, P-4, P-9 |
| RN-03, RN-04 | T-07, T-12 | P-5 |
| RN-05 | T-08, T-12 | P-3 #5 + consulta a `spsu_pagos` |
| RN-06 | T-09, T-12 | P-5 #6, P-7 |
| RN-07 | T-07, T-12 | P-3 #5/#6 |
| RN-08 | T-07, T-11 | P-3 #3 |
| RN-09 | T-03, T-12 | P-7 y revisión de código |
| RN-10 | T-14 (verificación) | P-2 |
| RN-11 | T-02 + controladores | P-6 |
| RN-12 (depuración de `porUsuario`, `echo` de `crearConPago`, sin fugas) | T-06, T-10, T-12 | P-3, `grep` de T-14 |
| RN-13 (`rest_divisas`) | T-13, T-15 | P-8 |
| RN-14 | T-07, T-10, T-11, T-12 | Revisión contra D-14 |
| Contrato `porUsuario` para HLT-07 | T-06, T-10, T-16 | P-3 #2 (`porUsuario` sin id) |
| README de ambos servicios | T-16, T-17 | Revisión |

Cobertura **100 %**.

### H4.2 Checklist

- ✅ 11 secciones completas. ✅ Sin marcadores pendientes. ✅ Cada RN con tarea. ✅ Cada tarea con criterio verificable y ficha. ✅ Sin contradicción con reglas del proyecto ni con el plan maestro. ✅ Referencias verificadas al 2026-11-02. ✅ Decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Id de usuario enviado durante la transición | Rechazar / ignorar / aceptar si coincide | **Aceptar si coincide; 403 + auditoría si no** | Igual que HLT-04 D-01 y plan §4.5; HLT-07 (D-24) deja de enviarlo. | No |
| D-02 | Suscripción ajena | 404 / 403 solo si existe / **403 si ajena o inexistente** | **403 `Acceso denegado` idéntico** | Misma decisión que HLT-04 D-02: plan §4.5 asigna 403 a "dueño distinto" y 404 al `Enrutador`; una sola consulta con dueño, sin canal de enumeración. | No |
| D-03 | Auditoría | — | `(new RegistroAuditoria(new Enlace(), SERVICIO_ACTUAL))->registrar('ACCESO_DENEGADO', $idUsuario, ContextoSesion::familia(), $motivo)` + `error_log`; `$motivo` = `suscripcion=<id> suscripcion/crearConPago` o `usuario enviado en <endpoint>` | API de HLT-03 (T-06, D-05, D-21); `Enlace` propio para que persista tras un rollback; sin tokens (HLT-03 RN-24). | No |
| D-04 | Contrato final de `porUsuario` | Mantener `?id` / segmento / **sin id** | **`GET suscripcion/porUsuario` sin id** (usuario de la sesión). Durante la transición acepta `?id=` y `/porUsuario/{id}` solo si coinciden | DH-04; elimina la discrepancia actual (la ruta lee `?id`, `SuscripcionRts.php:60`; la app manda segmento, `suscripcion.service.ts:24`). Coincide con HLT-07 D-24. | No |
| D-05 | Contrato final de `planes/suscritos` | Mantener segmento / **sin id** | **`GET planes/suscritos`** sin id; segmento aceptado solo si coincide | DH-04; HLT-07 D-24. | No |
| D-06 | Campos extra del cuerpo | Rechazar / **ignorar** | Ignorar | La app envía campos calculados por el servidor (`registro.page.ts:234-247`); ninguno llega al SQL. | No |
| D-07 | Precio y meses de `crearConPago` | Cliente / **catálogo** | Catálogo (RN-05) | Evita pagar 1 mes y obtener 24, o declarar un monto arbitrario. La app no llama a `crearConPago` hoy (solo lo define `SuscripcionStore.ts:91-95`), así que no se rompe nada. | No |
| D-08 | Unicidad de `idTransaccion` | Sin control / índice único / **comprobación con `FOR UPDATE` dentro de la transacción** | Comprobación con `SELECT 1 FROM spsu_pagos WHERE pag_idTransac = ? LIMIT 1 FOR UPDATE` | Sin cambio de esquema (D-12). Sin índice, el `FOR UPDATE` recorre y bloquea la tabla con sus huecos y serializa los pagos: coste aceptado por el volumen mínimo de pagos (10 filas hoy) y garantiza la unicidad bajo concurrencia (P-7). | No |
| D-09 | `suscripcion/suscripcionPorID` (la app lo define, `suscripcion.service.ts:16`) | Crearlo con filtro de dueño / **no crearlo** | No crearlo | Ninguna página lo invoca (solo `SuscripcionStore.ts:54`); RD-7. Queda constancia para HLT-07: eliminar `obtenerSuscripcionPorId` del servicio y del store, o dejarlo sin uso. Si se llama, el `Enrutador` responde 400 `Acción no válida para método GET` como hoy. | No |
| D-10 | Consulta de pagos (`PagosCtrl::obtenerPagosPendientesVerificacion`, sin ruta) | Exponerla / **dejarla sin ruta** | Sin ruta y sin cambios | No hay consumidor; su modelo ya filtra por `sus_usuarioId` (`PagosMdl.php:23-26`). El README indica que, si se expone, debe usar `ContextoSesion`. | No |
| D-11 | `/sinteticos` y `/otros` en `rest_divisas` | Mantener (500) / crear `MarketsRts.php` / **eliminar del mapa** | Eliminar | Apuntan a un archivo inexistente (`index.php:33-34`); quitarlos deja solo rutas reales detrás de la guardia (404 `Recurso no encontrado`). | No |
| D-12 | Esquema | Agregar índice único o columnas al anexo / **sin cambios** | Sin cambios | Las columnas `pag_montoConfirmado`, `pag_correo`, `pag_tipocripto` existen en la base viva pero no en `anexos/sist_suscripcion.sql`: se documenta en el README como desfase (riesgo) para una historia aparte. | No |
| D-13 | Conexión compartida | Singleton / **inyección** | `__construct(?Enlace $enlace = null)` en `PlanesMdl`, `SuscripcionMdl`, `PagosMdl`; `SuscripcionCtrl` comparte un `Enlace` | Igual que HLT-04 D-06; no toca `enlace.php` (copia idéntica §4.2). | No |
| D-14 | Bugs conocidos | Dentro / fuera | Tabla D-14 | Regla 7 del plan. | No |
| D-15 | Valores `'null'` como texto en `crearConPago` (`SuscripcionCtrl.php:143-145`) | Mantener / **`NULL` real** | `NULL` | Las líneas se reescriben; guardar la cadena `'null'` es un dato corrupto. | No |
| D-16 | `crearSinPago` concurrente (doble clic) | Bloquear / **aceptar** | Aceptar | Sin índice por `(sus_usuarioId, sus_pinIdPlanin)` no hay fila que bloquear sin serializar todo; el efecto es una pendiente duplicada del **propio** usuario, sin daño a terceros. Riesgo Bajo registrado. | No |
| D-17 | **PENDIENTE (RD-6) · Suscripción inicial en el registro** | Ver H5.2 | **Sin cerrar en este HLT** | Cruza a `rest_usuario` (HLT-06) y a la app (HLT-07), y cambia un flujo de alta. Este HLT **no** hace pública `crearSinPago` y deja `crearSinPago` protegido tal como lo define; ninguna tarea de H7 depende de la respuesta. | — |

### H5.2 Decisión pendiente D-17 (RD-6): suscripción inicial tras el registro

**Hallazgo (verificado en el código).** El registro de la app (`registro.page.ts:80-85` → `_registrarPlanSuscrito`, `:233-250`) llama a `persona/agregar` (público) y enseguida a `suscripcion/crearSinPago` con `sus_usuarioId`. Desde HLT-03, `crearSinPago` exige token (no está en la lista pública de plan §4.5). HLT-07 D-25 propone "iniciar sesión tras registrar y luego llamar a `crearSinPago`", pero eso **tampoco funciona**: `PersonaMdl.php:64` inserta en `sgen_usuario` sin `usu_situacion`, que toma el valor por defecto `'P'` (`rest_usuario/anexos/sist_generico.sql:83`), y el login exige `usu_situacion = 'A'` (`ValidacionMdl.php:20`; HLT-03 lo mantiene: "usuarios en situación `P` no inician sesión"). Resultado: el registro quedaría con usuario creado y sin suscripción. Hacer pública `crearSinPago` queda **descartado** (permitiría crear suscripciones a nombre de cualquier usuario).

| Opción | Descripción | Impacto | HLT afectados |
|--------|-------------|---------|---------------|
| **A (recomendada)** | `persona/agregar` recibe el `sus_pinIdPlanin` elegido (o usa el plan Libre, `pin_idPlanInterv = 1`, si no llega) y crea la suscripción pendiente **del lado servidor, en la misma transacción** que persona + usuario, con el id recién insertado. La app deja de llamar a `crearSinPago` en el registro. | Atómico (C-05): no hay usuario sin suscripción. Sin superficie nueva: el id de usuario lo genera el servidor. `rest_usuario` escribe en `spsu_suscripcion` (misma base `sist_criteriokelly`), cruzando la frontera de servicio; se valida el plan contra `spsu_planintervalo` activo. Contrato de `persona/agregar` cambia (campo opcional nuevo). | HLT-06 (registro en `rest_usuario`), HLT-07 (registro sin `crearSinPago`); HLT-05 sin cambios de tareas. |
| B | `crearSinPago` sigue protegido; la app guarda el plan elegido solo en memoria del flujo y lo reserva **tras el primer login** del usuario ya activado (`usu_situacion = 'A'`, activación administrativa o por un proceso que hoy no existe). | Sin cambios en `rest_usuario`; pero el plan elegido se pierde si el usuario cierra la app antes de su primer login, y depende de un proceso de activación inexistente. | HLT-07 (y una definición de activación fuera de HU-001). |
| C | Cambiar el alta para que el usuario nazca `'A'`, y aplicar HLT-07 D-25 (login → `crearSinPago` → cierre). | Cambia una regla de negocio de alta (aprobación de usuarios) y abre la cuenta sin verificación; tres llamadas no atómicas desde el cliente. | HLT-06, HLT-07. |

**Recomendación: A**, porque es la única atómica y no requiere estado del cliente ni cambiar la regla de activación. Pregunta al usuario: ¿se acepta que `rest_usuario` cree la suscripción pendiente del plan elegido dentro de la transacción de `persona/agregar` (opción A), o se prefiere B o C? Hasta la respuesta, HLT-07 D-25 no debe ejecutarse tal cual.

**Tabla D-14 · Bugs conocidos**

| Bug | Archivo:línea | ¿Línea modificada? | Decisión |
|-----|---------------|--------------------|----------|
| Línea de depuración en `porUsuario` (dos `respuestaErrorSimple(...500)`) | `SuscripcionCtrl.php:22,34` | Sí | **Dentro** (se eliminan). |
| `porUsuario` lee `?id` y la app manda segmento | `SuscripcionRts.php:60` | Sí | **Dentro** (D-04). |
| `echo "Datos recibidos..."` en `crearConPago` | `SuscripcionRts.php:117` | Sí | **Dentro** (se elimina). |
| `crearSinPago` actualiza y después inserta igual (duplica) | `SuscripcionCtrl.php:87-93` | Sí (cambia la búsqueda por dueño) | **Dentro** (RN-08). |
| `crearConPago` sin `sis_idSuscrip` sobrescribe lo encontrado | `SuscripcionCtrl.php:157-161` | Sí | **Dentro** (RN-07). |
| **Nuevo:** `obtenerSuscripcionPorIDUsuario` con `sis_idSuscrip = ? OR (...)` sin dueño (IDOR) | `SuscripcionMdl.php:27-32` | Sí | **Dentro**: se reemplaza por `obtenerSuscripcionDeUsuario` y `obtenerSuscripcionPendientePorPlan`. |
| **Nuevo:** `actualizarRangoFechaConPago` y `actualizarSuscripcionSinPago` sin dueño en el `WHERE` | `SuscripcionMdl.php:40-43,47-50` | Sí | **Dentro** (`AND sus_usuarioId = ?`). |
| `pin_estado = '1'` frente a `'A'` en los datos iniciales | `PlanesMdl.php:18,32` | No (la base viva usa `'1'`) | **Fuera de alcance**. |
| Alias `PLIN`/`plin` | `PlanesMdl.php:17,31` | No | **Fuera de alcance**. |
| `suscripcionPorID` no existe | — | — | **Fuera** (D-09). |
| `obtenerPagosPendientesVerificacion` sin ruta | `PagosCtrl.php:16` | No | **Fuera** (D-10). |
| Mensaje 404 de `disponible` habla de "operaciones del usuario" | `PlanesCtrl.php:29` | No | **Fuera de alcance**. |
| `rest_divisas`: fatal de `IndiceCtrl`, API key, `SSL_VERIFYPEER=false`, `detalle` con `getMessage()` (`CriptoRts.php:67`, `ForexRts.php:66`, `IndiceRts.php:67`), `service: PlanesRTS` | varios | No | **Fuera** (HLT-01 F-03 y HLT-02 C-08). |

### H5.1 Contrato resultante para HLT-07 (app)

| Endpoint | Hoy la app envía (`ruta:línea`) | Desde HLT-07 envía | Notas |
|----------|----------------------------------|--------------------|-------|
| `GET planes/disponible` | Igual (`planes.service.ts:14`) | Igual, sin token obligatorio | Público |
| `GET planes/suscritos/{id}` | Segmento `idUsuario` (`planes.service.ts:20`) | `GET planes/suscritos` | Coincide con HLT-07 D-24 |
| `GET suscripcion/porUsuario/{id}` | Segmento `idUsuario` (`suscripcion.service.ts:24`) | `GET suscripcion/porUsuario` | Coincide con HLT-07 D-24 |
| `GET suscripcion/suscripcionPorID/{id}` | `suscripcion.service.ts:16` | Eliminar del servicio y del store (no existe en el backend) | D-09 |
| `POST suscripcion/crearSinPago` | `sus_usuarioId` y campos calculados (`registro.page.ts:234-247`) | `{ sus_pinIdPlanin }` con Bearer, solo con sesión | Exige token. El uso desde el **registro** depende de D-17 (pendiente RD-6): HLT-07 D-25 no funciona porque el usuario nuevo queda en `'P'` y no puede iniciar sesión |
| `POST suscripcion/crearConPago` | `iUsuario`, `ins_numMeses`, `pin_precioFinal`, … (`SuscripcionStore.ts:91-95`, sin llamadores) | `{ pin_idPlanInterv, idTransaccion, metodoPago?, comprobante?, correoTransaccion?, criptomoneda?, sis_idSuscrip? }` | Precio y meses del catálogo; 409 si la transacción se repite |
| `rest_divisas/*` | No se usa | Si se integra, con Bearer | — |

---

## H6 · Revisión senior

### H6.1 Ronda 1 (borrador)

**APROBADO CON CAMBIOS**:

1. `obtenerSuscripcionPorIDUsuario` mantenía `sis_idSuscrip = ? OR (...)`: devolvía la suscripción de otro usuario por id. → Se reemplaza (D-14).
2. `crearConPago` aceptaba `pin_precioFinal` e `ins_numMeses` del cliente (asignación masiva de negocio). → RN-05/D-07.
3. Un usuario podía registrar el `idTransaccion` (visible en una blockchain) pagado por otro. → RN-06/D-08 y prueba de concurrencia P-7.
4. `actualizarRangoFechaConPago` sin dueño en el `WHERE`. → Defensa en profundidad (D-14).
5. `sinteticos`/`otros` respondían 500 detrás de la guardia, con mensaje interno. → D-11.

### H6.2 Ronda 2

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | Alcance literal de los dos servicios. |
| 2 | Reglas | ✅ | RN-01…RN-14 verificables. |
| 3 | Impacto | ✅ | 11 archivos; la app solo cambia en lo que HLT-07 ya planificó (D-24, D-25). |
| 4 | Arquitectura | ✅ | Capas respetadas; `configuracion/` sin tocar. |
| 5 | Riesgos | ✅ | H6.3. |
| 6 | Simplicidad | ✅ | Sin endpoints nuevos, sin esquema, sin clases nuevas. |
| 7 | Seguridad | ✅ | **IDOR horizontal:** `sis_idSuscrip` verificado con dueño en lectura y escritura; listados con `sus_usuarioId = ?`. **Asignación masiva:** usuario, precio, meses, situación y fechas nunca del cliente. **Enumeración:** 403 idéntico ajena/inexistente; el 400 de catálogo solo revela planes públicos; el 409 de transacción revela que un id de transacción ya se usó, dato que el atacante ya conoce por ser público en la red de pago (aceptado). **Carreras:** suscripción y pagos bloqueados en orden fijo; unicidad de transacción serializada (D-08). **`rest_divisas`:** sin rutas públicas; mapa sin entradas muertas; prueba de prefijo falso (`cripto-falso`) para confirmar que el `Enrutador` de HLT-02 no deja pasar coincidencias parciales. |
| 8 | Cobertura | ✅ | 100 %. |
| 9 | Determinismo | ✅ | Firmas, SQL, mensajes y códigos fijados; API de HLT-03 fijada en su T-05/T-06. |
| 10 | Ejecutabilidad | ✅ | 17 tareas atómicas. |

### H6.3 Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| El registro de la app llama a `crearSinPago` sin sesión y el usuario nuevo (`'P'`) no puede iniciar sesión: el alta queda sin suscripción. | Alta | Decisión pendiente D-17 (RD-6, H5.2) con recomendación A; no se hace pública `crearSinPago`. No se despliega antes de HLT-11. |
| Desfase entre `anexos/sist_suscripcion.sql` y la base viva (`pag_correo`, `pag_tipocripto`, `pag_montoConfirmado`): una instalación nueva desde los anexos falla en `crearConPago` y `planes/suscritos`. | Alta | Fuera de alcance (D-12); queda en "Estado actual" del README y en el reporte para una historia aparte antes de HLT-11. |
| `FOR UPDATE` sin índice sobre `spsu_pagos` serializa todos los pagos. | Baja | Volumen mínimo; transacción corta. |
| `/forex/disponible` hace decenas de llamadas externas por petición (amplificación). | Media | Ahora exige token y pasa por `LimitadorPeticiones` (300/min por sesión); caché fuera de alcance. |
| `/indice/disponible` con token responde 500. | Baja | Bug fuera de alcance (HLT-01); `ManejadorErrores` responde genérico. |
| Pendiente duplicada por doble clic en `crearSinPago`. | Baja | D-16. |

### H6.4 Veredicto

**APROBADO.** Cambios de la ronda 1 aplicados; coherente con HLT-04 (D-01/D-02) y HLT-03. La única decisión abierta (D-17, RD-6) cruza a `rest_usuario` y a la app y **no bloquea** ninguna tarea de este HLT: `crearSinPago` queda protegido con el contrato de H5.1 sea cual sea la opción elegida (A lo deja sin uso en el registro; B y C lo usan con sesión). Lo bloqueado es el flujo de registro de HLT-06/HLT-07, no este HLT.

---

## H7 · Plan de tareas

Rutas relativas a `rest_suscripcion/` salvo indicación. Agente único `desarrollador-php`; sin paralelismo.

### H7.1 Tareas

| ID | Tarea | Agente | Archivos `ruta:línea` | Depende de | Criterio de aceptación | RN / HU |
|----|-------|--------|-----------------------|------------|------------------------|---------|
| T-01 | Verificar precondiciones HLT-01/02/03 en ambos servicios (solo lectura) | `desarrollador-php` | Lectura: `rest_suscripcion/configuracion/{ContextoSesion,RegistroAuditoria,enlace}.php`, `rest_suscripcion/index.php`, `rest_divisas/index.php` | — | `grep` encuentra `public static function idUsuario`, `public static function familia`, `public function registrar(string $evento`, los 3 métodos de transacción de `Enlace`; `rest_suscripcion/index.php` tiene `SERVICIO_ACTUAL = 'rest_suscripcion'` y `RUTAS_PUBLICAS = ['planes/disponible']`; `rest_divisas/index.php` tiene `RUTAS_PUBLICAS = []`; `curl` sin token a `suscripcion/porUsuario` → 401 y a `planes/disponible` → 200; `php -v` ≥ 8.2 y `php -m` con `fileinfo`. Si algo falla → BLOQUEADA. | Precondición |
| T-02 | Agregar a `BaseCtrl` los helpers de sesión, denegación y validación | `desarrollador-php` | `controladores/BaseCtrl.php:1-78` | T-01 | `php -l`; mismas firmas, constantes y comportamiento que HLT-04 T-02/H8 RI-P3 (`idUsuarioSesion`, `verificarUsuarioEnviado`, `denegarAcceso`, `leerEntero`, `leerDecimal`, `leerTexto`, `leerOpcion`, `leerImagen`); `denegarAcceso` según D-03; se elimina el bloque comentado `BaseCtrl.php:30-57`. | RN-01, RN-02, RN-11 |
| T-03 | Inyectar `Enlace` compartido en los 3 modelos | `desarrollador-php` | `modelos/PlanesMdl.php:7-12`, `modelos/SuscripcionMdl.php:7-12`, `modelos/PagosMdl.php:7-12` | T-01 | `php -l`; `private Enlace $conexion;` y `__construct(?Enlace $enlace = null) { $this->conexion = $enlace ?? new Enlace(); }`. | RN-09, D-13 |
| T-04 | Hacer opcional el id de `planes/suscritos` en la ruta | `desarrollador-php` | `rutas/PlanesRts.php:62-76` | T-01 | `php -l`; el `case 'suscritos'` llama a `$controller->obtenerPlanesSuscritosSinPagar($actionParam)` sin validar presencia ni formato (lo hace el controlador). | D-05 |
| T-05 | Reescribir `PlanesCtrl::obtenerPlanesSuscritosSinPagar` con la sesión | `desarrollador-php` | `controladores/PlanesCtrl.php:56-104` | T-02, T-04 | `php -l`; firma `(mixed $idEnviado): void`; `verificarUsuarioEnviado($idEnviado, 'planes/suscritos')`; consulta con `idUsuarioSesion()`; se elimina la línea comentada `:70`; `catch (Throwable)` con `error_log`; 16 claves de respuesta sin cambio; P-3 #1 → 200, P-4 #1 → 403. `obtenerPlanesDisponibles` no se toca. | RN-01, RN-02, RN-10 |
| T-06 | Ajustar `SuscripcionRts`: `porUsuario` con id opcional y sin `echo` | `desarrollador-php` | `rutas/SuscripcionRts.php:17-23,58-73,116-119` | T-01 | `php -l`; el bucle de `:18-23` guarda también `$actionParam = $uriParts[$i + 2] ?? null`; `case 'porUsuario'` llama a `$controller->obtenerSuscripcionesPorUsuario($_GET['id'] ?? null, $actionParam)`; se elimina la línea `:117`; `grep -c "Datos recibidos" rutas/SuscripcionRts.php` = 0. | D-04, RN-12 |
| T-07 | Reescribir las consultas de `SuscripcionMdl` con dueño | `desarrollador-php` | `modelos/SuscripcionMdl.php:14-56` | T-03 | `php -l`; (1) `obtenerSuscripcionDeUsuario(int $idSuscripcion, int $idUsuario, bool $bloquear = false): ?array` → `SELECT sis_idSuscrip, sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion, sus_referenPago, sus_renovAutomatica, sus_proximoPago, sus_fechaCrea FROM spsu_suscripcion WHERE sis_idSuscrip = ? AND sus_usuarioId = ?` (+ ` FOR UPDATE`, dos constantes fijas); (2) `obtenerSuscripcionPendientePorPlan(int $idUsuario, int $idPlan, bool $bloquear = false): ?array` → mismas columnas `WHERE sus_usuarioId = ? AND sus_pinIdPlanin = ? AND sus_situacion = 'P' AND (sus_referenPago IS NULL OR sus_referenPago = '') ORDER BY sis_idSuscrip DESC LIMIT 1` (+ ` FOR UPDATE`); (3) se eliminan `obtenerSuscripcionPorID` y `obtenerSuscripcionPorIDUsuario`; (4) `actualizarSuscripcionSinPago(int, int $idUsuario, string, string): int` y `actualizarRangoFechaConPago(int, int $idUsuario, string, string, string, string): int` con `AND sus_usuarioId = ?`; (5) los demás métodos con tipos. | RN-03, RN-04, RN-07, RN-08, D-14 |
| T-08 | Agregar `PlanesMdl::obtenerPlanIntervaloActivo` | `desarrollador-php` | `modelos/PlanesMdl.php:14-35` | T-03 | `php -l`; `obtenerPlanIntervaloActivo(int $idPlanIntervalo): ?array` → `SELECT plin.pin_idPlanInterv, plin.pin_precioFinal, inp.ins_numMeses FROM spsu_planintervalo plin INNER JOIN spsu_intervalosuscr inp ON plin.pins_idInterSuscrip = inp.ins_idInterSuscrip WHERE plin.pin_idPlanInterv = ? AND plin.pin_estado = '1'`; las consultas existentes no cambian. | RN-05 |
| T-09 | Agregar `PagosMdl::existeTransaccion` y tipar la inserción | `desarrollador-php` | `modelos/PagosMdl.php:14-18` | T-03 | `php -l`; `existeTransaccion(string $idTransaccion): bool` con `SELECT 1 FROM spsu_pagos WHERE pag_idTransac = ? LIMIT 1 FOR UPDATE`; `insertarPagoSuscripcion` con tipos (`?string` para comprobante, correo y cripto); `obtenerPagosPendientesVerificacion` sin cambios. | RN-06, D-08 |
| T-10 | Reescribir `SuscripcionCtrl::obtenerSuscripcionesPorUsuario` | `desarrollador-php` | `controladores/SuscripcionCtrl.php:19-62` | T-02, T-06, T-07 | `php -l`; firma `(mixed $idQuery, mixed $idSegmento): void`; se eliminan `:22` y `:34`; `verificarUsuarioEnviado` para ambos; consulta con la sesión; 10 claves sin cambio; P-3 #2 → 200 sin id, P-4 #2/#3 → 403. | RN-01, RN-02, RN-12, D-04 |
| T-11 | Reescribir `SuscripcionCtrl::insertarSuscripcionSinPago` | `desarrollador-php` | `controladores/SuscripcionCtrl.php:1-17,69-123` | T-02, T-07, T-08 | `php -l`; el constructor crea un `Enlace` y lo pasa a `SuscripcionMdl`, `PagosMdl` y un `PlanesMdl` nuevo; Flujo B de H3; `verificarUsuarioEnviado($data['sus_usuarioId'] ?? null, 'suscripcion/crearSinPago')`; dos llamadas seguidas → mismo `sis_idSuscrip` (P-3 #3); P-4 #4 → 403. | RN-01, RN-02, RN-08 |
| T-12 | Reescribir `SuscripcionCtrl::insertarSuscripcionConPago` (transacción) | `desarrollador-php` | `controladores/SuscripcionCtrl.php:126-205` | T-02, T-07, T-08, T-09, T-11 | `php -l`; validación H2.3; `verificarUsuarioEnviado($data['iUsuario'] ?? null, 'suscripcion/crearConPago')`; Flujo C exacto, con `revertirTransaccion()` antes de 403/400/409 y `confirmarTransaccion()` antes del 200; `catch (Throwable)` → revertir + 500 `Error interno del servidor`; P-3 #5/#6 → 200 y `pag_monto` del catálogo; P-5 → 403; P-5 #6 y P-7 → 409. | RN-01–RN-07, RN-09, RN-12, D-07, D-08, D-15 |
| T-13 | Quitar `sinteticos` y `otros` del mapa de `rest_divisas` | `desarrollador-php` | `rest_divisas/index.php:29-35` (mapa `$rutas` del `Enrutador` tras HLT-02) | T-01 | `C:\xampp\php\php.exe -l rest_divisas/index.php`; el mapa contiene exactamente `cripto`, `forex`, `indice`; `grep -c "MarketsRts" rest_divisas/index.php` = 0; `RUTAS_PUBLICAS` sigue vacía. | RN-13, D-11 |
| T-14 | Ejecutar la batería `curl` de `rest_suscripcion` (P-1…P-7, P-9) | `desarrollador-php` | Sin cambios de código | T-04–T-12 | Todos los códigos esperados de H7.2; `grep -rn "getMessage()" controladores` solo dentro de `error_log(`. | Todas las de suscripción |
| T-15 | Ejecutar la batería `curl` de `rest_divisas` (P-8) | `desarrollador-php` | Sin cambios de código | T-13 | Códigos esperados de P-8. | RN-13, DH-05 |
| T-16 | Actualizar `rest_suscripcion/README.md` | `desarrollador-php` | `README.md:71-146` | T-14 | Endpoints con el contrato de H5.1 (`planes/suscritos` y `porUsuario` sin id; cuerpos sin id de usuario; precio y meses del catálogo; 403/409); sección "Autorización" (dueño por suscripción, 403 idéntico, auditoría, transacción de `crearConPago`, unicidad de `idTransaccion`); "Estado actual" sin los bugs corregidos de D-14 y con el desfase de esquema (D-12), `suscripcionPorID` (D-09) y `obtenerPagosPendientesVerificacion` (D-10). | Plan §5.5 |
| T-17 | Actualizar `rest_divisas/README.md` | `desarrollador-php` | `rest_divisas/README.md:39-83` | T-15 | Tabla de endpoints sin `/sinteticos` ni `/otros`; nota "todos exigen `Authorization: Bearer`; no hay rutas públicas"; "Estado actual" sin el bug de `MarketsRts.php` y con los demás. | Plan §5.5 |

### H7.2 Batería de pruebas `curl`

Requisitos y helpers `pet`/`sesion`, usuarios `prueba_hlt_a`/`prueba_hlt_b` (incluida su **activación** `usu_situacion = 'A'` en la base local, porque `persona/agregar` los crea en `'P'`), `TOKEN_A`, `TOKEN_B`, `ID_A`, `ID_B` y `NO_EXISTE` **idénticos a HLT-04 H7.2 (P-1)**; si HLT-04 ya creó y activó los usuarios, solo se repite el login.

```bash
SU=http://localhost/criterio_kelly/rest_suscripcion
DV=http://localhost/criterio_kelly/rest_divisas
MYSQL="/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e"
TX_A="HLT05-TX-A-$(date +%s)"

# P-3 · Caso feliz (200)
pet "$TOKEN_A" GET "$SU/planes/suscritos"                                                     # 1: 200 (lista o 404 del propio estado)
pet "$TOKEN_A" GET "$SU/suscripcion/porUsuario"                                               # 2: 200 o 404 propio, nunca 500
SUS_A=$(pet "$TOKEN_A" POST "$SU/suscripcion/crearSinPago" '{"sus_pinIdPlanin":2,"sus_situacion":"A","sus_fechaFin":"2099-01-01"}' | sed -E 's/.*"sis_idSuscrip":([0-9]+).*/\1/')
pet "$TOKEN_A" POST "$SU/suscripcion/crearSinPago" '{"sus_pinIdPlanin":2}' | grep -c "\"sis_idSuscrip\":$SUS_A"   # 3: 1 (sin duplicar)
$MYSQL "SELECT sus_situacion, sus_fechaFin < '2099-01-01' FROM spsu_suscripcion WHERE sis_idSuscrip=$SUS_A"          # 4: P 1 (campos del cliente ignorados)
pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" "{\"pin_idPlanInterv\":2,\"idTransaccion\":\"$TX_A\",\"metodoPago\":\"PAYPAL\",\"pin_precioFinal\":0.01,\"ins_numMeses\":24}"   # 5: 200 JSON válido
$MYSQL "SELECT pag_monto, pag_susIdSuscri FROM spsu_pagos WHERE pag_idTransac='$TX_A'"        # 1.25  SUS_A (catálogo y pendiente reutilizada)
SUS_A3=$(pet "$TOKEN_A" POST "$SU/suscripcion/crearSinPago" '{"sus_pinIdPlanin":3}' | sed -E 's/.*"sis_idSuscrip":([0-9]+).*/\1/')
pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" "{\"pin_idPlanInterv\":3,\"idTransaccion\":\"$TX_A-2\",\"sis_idSuscrip\":$SUS_A3}"   # 6: 200
pet "$TOKEN_A" GET "$SU/suscripcion/porUsuario?id=$ID_A"                                       # 200 (id coincidente)
pet "$TOKEN_A" GET "$SU/planes/suscritos/$ID_A"                                               # 200 o 404 propio (id coincidente)

# P-2 · Público y 401
pet - GET "$SU/planes/disponible"                                                              # 200
for r in "GET planes/suscritos" "GET suscripcion/porUsuario" "POST suscripcion/crearSinPago" "POST suscripcion/crearConPago"; do
  set -- $r
  if [ "$1" = GET ]; then pet - GET "$SU/$2"; pet token-inventado GET "$SU/$2"; else pet - POST "$SU/$2" '{}'; pet token-inventado POST "$SU/$2" '{}'; fi
done                                                                                            # 8 × 401

# P-4 · Id de usuario distinto → 403
pet "$TOKEN_B" GET "$SU/planes/suscritos/$ID_A"
pet "$TOKEN_B" GET "$SU/suscripcion/porUsuario?id=$ID_A"
pet "$TOKEN_B" GET "$SU/suscripcion/porUsuario/$ID_A"
pet "$TOKEN_B" POST "$SU/suscripcion/crearSinPago" "{\"sus_pinIdPlanin\":2,\"sus_usuarioId\":$ID_A}"
pet "$TOKEN_B" POST "$SU/suscripcion/crearConPago" "{\"iUsuario\":$ID_A,\"pin_idPlanInterv\":2,\"idTransaccion\":\"HLT05-B-1\"}"
pet "$TOKEN_B" GET "$SU/suscripcion/porUsuario?id=$ID_B&x=1" ; pet "$TOKEN_B" GET "$SU/suscripcion/porUsuario/abc"   # 200/404 propio y 403
pet "$TOKEN_B" GET "$SU/planes/suscritos/$ID_A%20OR%201=1"                                     # 403
$MYSQL "SELECT COUNT(*) FROM spsu_suscripcion WHERE sus_usuarioId=$ID_A AND sus_pinIdPlanin=2"  # no aumentó por las peticiones de B

# P-5 · Suscripción de A con token de B (y la inexistente) → 403 idéntico, A intacta
ANTES=$($MYSQL "SELECT CONCAT(sus_fechaFin,'|',IFNULL(sus_referenPago,'')) FROM spsu_suscripcion WHERE sis_idSuscrip=$SUS_A3")
for S in "$SUS_A3" "$NO_EXISTE"; do pet "$TOKEN_B" POST "$SU/suscripcion/crearConPago" "{\"pin_idPlanInterv\":3,\"idTransaccion\":\"HLT05-B-$S\",\"sis_idSuscrip\":$S}"; done   # 2 × 403, mismo cuerpo
[ "$ANTES" = "$($MYSQL "SELECT CONCAT(sus_fechaFin,'|',IFNULL(sus_referenPago,'')) FROM spsu_suscripcion WHERE sis_idSuscrip=$SUS_A3")" ] && echo "A intacta"
$MYSQL "SELECT COUNT(*) FROM spsu_pagos WHERE pag_idTransac LIKE 'HLT05-B-%'"                 # 0
pet "$TOKEN_B" GET "$SU/suscripcion/porUsuario" | grep -c "\"sis_idSuscrip\":$SUS_A\b"         # 0
pet "$TOKEN_B" POST "$SU/suscripcion/crearConPago" "{\"pin_idPlanInterv\":2,\"idTransaccion\":\"$TX_A\"}"   # #6: 409 (transacción de A)
pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" "{\"pin_idPlanInterv\":2,\"idTransaccion\":\"HLT05-PLAN\",\"sis_idSuscrip\":$SUS_A3}"   # 400 (no corresponde al plan)
pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" '{"pin_idPlanInterv":1,"idTransaccion":"HLT05-LIBRE"}'   # 400 (no requiere pago)

# P-6 · Inyección SQL y entrada inválida
pet "$TOKEN_A" GET "$SU/suscripcion/porUsuario?id=1%27%20OR%20%271%27%3D%271"                 # 403
pet "$TOKEN_A" GET "$SU/suscripcion/porUsuario?id=1%20UNION%20SELECT%201"                      # 403
pet "$TOKEN_A" POST "$SU/suscripcion/crearSinPago" '{"sus_pinIdPlanin":"2 OR 1=1"}'            # 400
pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" '{"pin_idPlanInterv":2,"idTransaccion":"x'"'"' OR '"'"'1'"'"'='"'"'1"}'   # 400
pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" '{"pin_idPlanInterv":2,"idTransaccion":"T1","sis_idSuscrip":"1 UNION SELECT 1"}'   # 400
pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" '{"pin_idPlanInterv":2,"idTransaccion":"T2","metodoPago":"EFECTIVO"}'   # 400
pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" '{"pin_idPlanInterv":2,"idTransaccion":"T3","correoTransaccion":"no-es-correo"}'   # 400
$MYSQL "SELECT COUNT(*) FROM spsu_suscripcion"                                                  # tabla intacta

# P-7 · Misma transacción en paralelo → un 200 y un 409
TX_P="HLT05-PAR-$(date +%s)"; C="{\"pin_idPlanInterv\":4,\"idTransaccion\":\"$TX_P\"}"
(pet "$TOKEN_A" POST "$SU/suscripcion/crearConPago" "$C" > /tmp/hlt05_c1.txt) & (RESP=/tmp/hlt05_r2.json pet "$TOKEN_B" POST "$SU/suscripcion/crearConPago" "$C" > /tmp/hlt05_c2.txt) & wait
cat /tmp/hlt05_c1.txt /tmp/hlt05_c2.txt                                                        # un 200 y un 409
$MYSQL "SELECT COUNT(*) FROM spsu_pagos WHERE pag_idTransac='$TX_P'"                           # 1

# P-9 · Auditoría (columnas HLT-03 D-05)
$MYSQL "SELECT COUNT(*) FROM sgen_auditoria WHERE aud_evento='ACCESO_DENEGADO' AND aud_servicio='rest_suscripcion' AND aud_usuId=$ID_B"   # ≥ 403 de B en P-4 y P-5
$MYSQL "SELECT COUNT(*) FROM sgen_auditoria WHERE aud_detalle REGEXP '[A-Za-z0-9_-]{32,}'"     # 0

# P-8 · rest_divisas
for r in cripto cripto/disponible forex forex/disponible indice indice/disponible; do pet - GET "$DV/$r"; pet token-inventado GET "$DV/$r"; done   # 12 × 401 (el GET sin acción del backend, $DV/, sí es público)
pet "$TOKEN_A" GET "$DV/cripto/disponible"                                                     # 200 (lista, o [] si Binance bloquea)
curl -s -m 120 -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN_A" -H 'X-Requested-With: CriterioKelly' "$DV/forex/disponible"   # 200
pet "$TOKEN_A" GET "$DV/indice/disponible"                                                     # 500 {"error":"Error interno del servidor"} (bug fuera de alcance)
for r in sinteticos sinteticos/disponible otros otros/disponible; do pet - GET "$DV/$r"; pet "$TOKEN_A" GET "$DV/$r"; done   # 8 × 404 "Recurso no encontrado"
pet - GET "$DV/cripto-falso/disponible"                                                        # 404 (sin coincidencia parcial)
```

Nota: la activación `usu_situacion = 'A'` de los usuarios de prueba es un dato de fixture solo en la base local; no sustituye a la decisión pendiente D-17.

---

## H8 · Reglas de implementación deterministas

Rigen **RI-P1…RI-P11 de HLT-04 H8** sin cambios, aplicadas a `rest_suscripcion` y `rest_divisas`, con estas precisiones:

| ID | Regla |
|----|-------|
| RI-S1 | `SERVICIO_ACTUAL` vale `rest_suscripcion` en la auditoría de este backend; `rest_divisas` no audita (no tiene recursos con dueño). |
| RI-S2 | Orden de bloqueo en `crearConPago`: suscripción (`FOR UPDATE` por clave primaria con dueño, o pendiente del usuario) → `spsu_pagos` (`existeTransaccion`). Ningún otro método bloquea. |
| RI-S3 | Fechas: `date('Y-m-d H:i:s')` y `strtotime` como hoy (`SuscripcionCtrl.php:84-85,152-154`); los meses salen de `ins_numMeses` del catálogo. |
| RI-S4 | En `rest_divisas` solo se toca la definición del mapa de rutas de `index.php`; ninguna clase de `configuracion/` ni ruta o controlador. |
| RI-S5 | Commits solo si el usuario los pide; `rest_suscripcion` desde su carpeta (repositorio propio); `rest_divisas` no tiene git. |

---

## H9 · Reglas de seguimiento de ejecución

Igual que HLT-04 H9: símbolos `⬜ ✅ ❌ ➖`, estados `PENDIENTE → EN_CURSO → HECHA | BLOQUEADA | OMITIDA`, RS-1…RS-9; **C4** = `C:\xampp\php\php.exe -l` de cada archivo tocado; **C5** = `curl` del endpoint afectado (feliz + error) con respuesta real de H7.2. Plantilla de ficha idéntica a HLT-04 H9.

```
T-01 — Precondiciones                                  Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-02 — Helpers de BaseCtrl                             Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-03 — Enlace compartido en 3 modelos                  Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-04 — PlanesRts suscritos                             Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-05 — PlanesCtrl::obtenerPlanesSuscritosSinPagar      Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-06 — SuscripcionRts porUsuario y echo                Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-07 — SuscripcionMdl con dueño                        Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-08 — PlanesMdl::obtenerPlanIntervaloActivo           Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-09 — PagosMdl::existeTransaccion                     Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-10 — SuscripcionCtrl::obtenerSuscripcionesPorUsuario Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-11 — SuscripcionCtrl::insertarSuscripcionSinPago     Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-12 — SuscripcionCtrl::insertarSuscripcionConPago     Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-13 — rest_divisas: mapa sin sinteticos/otros         Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-14 — Batería curl rest_suscripcion                   Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-15 — Batería curl rest_divisas                       Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-16 — README rest_suscripcion                         Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
T-17 — README rest_divisas                             Estado: PENDIENTE   C1 ⬜ C2 ⬜ C3 ⬜ C4 ⬜ C5 ⬜ C6 ⬜
```

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 … T-17 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

En T-01, T-14, T-15, T-16 y T-17, C4 = `➖`; en T-03, T-07, T-08 y T-09, C5 se verifica con el endpoint que los usa.

---

## H10 · Diseño del reporte de ejecución

```
REPORTE DE EJECUCIÓN — HLT-05 · Autorización en rest_suscripcion y protección de rest_divisas
  1. Resumen ejecutivo
  2. Estado global (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas (T-01…T-17, C1…C6)
  4. Cobertura vs. HLT (RN-01…RN-14)
  5. Cambios realizados (archivo:línea)
  6. Verificaciones ejecutadas (php -l; salida real de P-2…P-9)
  7. Desviaciones y decisiones
  8. Pendientes / bloqueos
  9. Próximos pasos (aviso a HLT-07 con H5.1; desfase de esquema D-12)
```

RR-1…RR-5 de `doc_modo_planificacion.md` §12.2.

---

## H11 · Convenciones de desarrollo y arquitectura de código limpio

Rigen **CV-1…CV-8 de HLT-04 H11**, con estos nombres y constantes propios: métodos `obtenerSuscripcionDeUsuario`, `obtenerSuscripcionPendientePorPlan`, `obtenerPlanIntervaloActivo`, `existeTransaccion`; constantes `METODOS_PAGO_PERMITIDOS = ['CRIPTOMONEDA','PAYPAL','BANCO']`, `METODO_PAGO_POR_DEFECTO = 'CRIPTOMONEDA'`, `LONGITUD_MAXIMA_TRANSACCION = 254`, `LONGITUD_MAXIMA_CORREO = 64`, `PATRON_TRANSACCION = '/^[A-Za-z0-9._:-]+$/'`, `PATRON_CRIPTOMONEDA = '/^[A-Z0-9]{2,16}$/'`, `MESES_SUSCRIPCION_SIN_PAGO = 1`. No se renombran métodos legado invocados por las rutas (`obtenerPlanesSuscritosSinPagar`, `insertarSuscripcionSinPago`, `insertarSuscripcionConPago`). Variables con SQL `$sql<Proposito>`, columnas explícitas en consultas nuevas.
