# HLT-29-v1 — Backend y BD: datos de pago administrables y código QR de criptomonedas (HU-005, ampliación «Datos de pago»)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-14 (v1) |
| Historia | `docs/Historia_usuario/HU-005-control-por-plan-comprobante-y-administracion.md` (sección «Ampliación: datos de pago administrables», HLT-29 y HLT-30). Contexto de flujo: HU-004 (pago pendiente) y HLT-25-v2 (comprobante) |
| Pedido literal del usuario | «la información para los pagos debe persistir y en la base de datos y además debe ser administrable (para que se administre desde la interface); también se debe subir el código QR para criptomonedas; […] SIN PERDER LA FUNCIONALIDAD ACTUAL; si para el efecto se crearon archivos en el front se debe pasar al backend y del frontend se debe eliminar; crear una planificación» |
| Numeración | Vigentes previos: HLT-15-v2 … HLT-28-v2. **HLT-29-v1 (este: backend + BD)** · HLT-30-v1 (front; depende de este) |
| Proyecto y git | `rest_suscripcion` (git propio) y, solo por `RegistroAuditoria.php`, copia idéntica en `rest_usuario`, `rest_criteriokelly` y `rest_divisas` (ver RN-15). Sin carpeta de evidencias |
| Agente | `desarrollador-php` en todas las tareas (T-02 y T-12 las entrega/ejecuta el usuario donde se indica) |
| Depende de | HLT-17-v4 y HLT-26-v2 COMPLETADOS (`pagos/*` con roles 1 y 2, `ContextoSesion`, auditoría). Se comprueba en T-01 |
| Lo consume | HLT-30-v1 |
| Estado | Pendiente de ejecución. **Decisiones abiertas DA-01…DA-07 con recomendación por defecto (el usuario las acepta o cambia antes de ejecutar)** |

> **Reglas de entorno (obligatorias).** (1) MySQL/Apache intocables: el agente **no ejecuta** ningún SQL de cambio; **entrega** el script (T-02) y el usuario lo corre desde su gestor. (2) Sin `git add/commit/push/checkout/reset/stash/clean`. (3) **No se crean archivos de evidencias ni reportes `.md`**; las salidas de `php -l` y de las baterías se citan en el informe final. (4) No se abre ni imprime `.env`. (5) No tocar `pla_bloqueoDias` del Libre ni ningún otro valor de `spsu_planes`. (6) `RegistroAuditoria.php` idéntico en los 4 backends (`sha256`). (7) Patrón «un solo lado trabaja»: HLT-29 termina y se verifica antes de empezar HLT-30. (8) **No se inventan direcciones, correos ni números**: la semilla va vacía e inactiva. (9) Las cuentas de prueba son `ck_prueba_hu5_*` y las filas de prueba se borran al final.

---

## H1 · Propósito

**Hoy** los datos de pago (redes USDT con dirección, PayPal correo/enlace, número de WhatsApp para transferencia bancaria) están escritos en el front (`criterioKellyApp/src/app/paginas/suscripcion/configuracion/datos-pago.config.ts`, token `DATOS_PAGO_TOKEN`). Cambiarlos exige recompilar y publicar la app, y no existe el código QR.

**Resultado esperado (observable).**
1. Los datos de pago viven en la base `sist_criteriokelly` (tablas `spsu_*`) y los administra el rol 1 o 2 por API.
2. Cada red USDT puede tener un **código QR** (imagen) guardado de forma segura y servido por un endpoint autenticado.
3. Un usuario autenticado puede leer **solo lo activo y completo** (sin campos de administración) para pagar.
4. El front (HLT-30) deja de contener datos de pago.
5. Todo cambio queda auditado; ningún endpoint de pagos existente cambia de comportamiento.

**Fuera de alcance.** El front (HLT-30); pasarelas; QR de PayPal/banco (el modelo lo permite después, DA-06); histórico de versiones de las direcciones; cambiar `crearConPago`, `miUltimoPago` o la validación de comprobantes.

**Feature(s) afectada(s).** `rest_suscripcion/{index.php, rutas/DatosPagoRts.php, controladores/DatosPagoCtrl.php, controladores/BaseCtrl.php, modelos/DatosPagoMdl.php, configuracion/RegistroAuditoria.php, README.md, anexos/*.sql}` y las 3 copias de `RegistroAuditoria.php`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Métodos | Catálogo fijo de 3 códigos, iguales a `SuscripcionCtrl::METODOS_PAGO_PERMITIDOS`: `CRIPTOMONEDA`, `PAYPAL`, `BANCO`. No se crean métodos nuevos desde la API (cambiaría `crearConPago`) |
| RN-02 | Redes USDT | Tabla propia: `red_clave` única (`^[A-Z0-9_]{2,16}$`, p. ej. TRON, BSC, ETH), `red_nombre` ≤ 64, `red_etiqueta` ≤ 16 (TRC20…), `red_direccion` ≤ 128. Se pueden añadir, editar, ordenar, desactivar y eliminar redes desde la API |
| RN-03 | Dirección | Formato por clave: `TRON` → `^T[1-9A-HJ-NP-Za-km-z]{33}$`; `ETH` y `BSC` → `^0x[0-9a-fA-F]{40}$`; clave desconocida → `^[A-Za-z0-9]{16,128}$`. Sin espacios (se hace `trim`). Se valida en el servidor aunque la app también lo haga. No se verifica el checksum (DA-05) |
| RN-04 | PayPal | `correo` (validador de correo, ≤ 64) y/o `enlace` (`https://` y host `paypal.me` o `www.paypal.com`, ≤ 255). Basta uno de los dos para estar disponible |
| RN-05 | Banco | `numero` solo dígitos 8–15 (se normalizan quitando `+`, espacios y guiones); `plantilla` opcional ≤ 500 sin HTML (con marcadores `{plan}`, `{monto}` que el front reemplaza; si es `NULL` el front usa su texto actual) |
| RN-05b | Banco: datos de la cuenta (aclaración del usuario) | Además del WhatsApp (`numero` + `plantilla`, que son lo único que usa el flujo hoy), el administrador registra los datos de la cuenta del propietario: `titular` (≤ 128, letras/dígitos/espacios y `.,&'-`), `documento` opcional (≤ 20, `^[A-Za-z0-9.\-]{3,20}$`), `entidad` (banco, ≤ 64), `tipoCuenta` (lista blanca `AHORROS`, `CORRIENTE`, `VIRTUAL`, `OTRO`), `cuenta` (`^[A-Za-z0-9\-]{4,34}$`, se quitan espacios), `paisMoneda` opcional (≤ 32) y `observaciones` opcional (≤ 255). Todos opcionales salvo que, si se envía `cuenta`, se exigen también `titular` y `entidad`. Guardar reemplaza el conjunto completo |
| RN-05c | Banco: no se expone aún | **Por ahora la pantalla del cliente solo envía un mensaje de WhatsApp.** `datosPago/disponibles` devuelve del banco únicamente `nombre`, `numero` y `plantilla`; los datos de la cuenta solo los devuelve `datosPago/administracion` (roles 1 y 2) y se expondrán al cliente más adelante en un cambio aparte. Son datos personales y financieros: no van a logs, y la auditoría guarda solo los últimos 4 dígitos del WhatsApp y de la cuenta, nunca el documento ni el titular |
| RN-06 | Disponible | Un método está disponible para el usuario si `activo = 1` y tiene sus datos completos: cripto, al menos una red activa con dirección; PayPal, correo o enlace; banco, número. Lo no disponible **no se envía** |
| RN-07 | Lectura de usuario (sin datos de la cuenta bancaria, RN-05c) | `GET datosPago/disponibles` exige sesión válida (cualquier rol); devuelve solo lo disponible y solo los campos necesarios para pagar (sin `activo`, `orden`, usuarios ni fechas de auditoría) |
| RN-08 | Escritura | Solo roles 1 y 2 según `ContextoSesion::roles()`; cualquier otro rol o sin sesión → 403 uniforme (mismo mensaje y forma que `pagos/pendientes`); nunca se revela si el recurso existe |
| RN-09 | QR: almacenamiento | **Recomendación DA-01:** en la base, tabla `spsu_qrpago` (columna `MEDIUMBLOB`), una fila por red (`qr_redId` único). Separada de `spsu_redusdt` para que ningún listado cargue la imagen |
| RN-10 | QR: validación | Máximo **256 KB** decodificados (`leerImagen` con tope parametrizable; el cuerpo ya está limitado a 1 MB por `LectorSolicitud`); tipos `image/png`, `image/jpeg`, `image/webp` (sin GIF ni SVG); el tipo se toma del **contenido real** (`finfo_buffer`) y debe coincidir con el declarado; `getimagesizefromstring` debe devolver dimensiones, entre 100 y 2000 px por lado; si la extensión GD está, la imagen se **re-codifica** (elimina metadatos y cargas ocultas) y se guarda la versión re-codificada; si GD falta, se guarda la original ya validada y se anota en el README |
| RN-11 | QR: servicio | `GET datosPago/qr?clave=…` exige sesión; para rol no administrador solo si la red está activa y con método disponible (RN-06), si no 404; cabeceras: `Content-Type` del MIME guardado, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`, `Content-Disposition: inline; filename="qr.<ext>"`, `Cache-Control: private, no-cache` y `ETag` = `qr_hash` (SHA-256) con respuesta 304 si coincide. No se usan nombres de archivo del cliente ni rutas de disco |
| RN-12 | Estado y orden | `activo` (0/1) y `orden` (entero ≥ 0) en métodos y redes; el listado se ordena por `orden, id`. Desactivar una red conserva su dirección y su QR |
| RN-13 | Eliminar | Eliminar una red borra su QR (FK `ON DELETE CASCADE`). No se puede eliminar la última red activa si `CRIPTOMONEDA` está activo (400 con mensaje: desactiva el método primero) |
| RN-14 | Auditoría de datos | Cada fila lleva `*_creadoPor`, `*_fechacrea`, `*_actualizadoPor`, `*_fechaact` (id del usuario de `ContextoSesion::idUsuario()`, nunca del cuerpo) |
| RN-15 | Eventos de auditoría | Nuevos en `RegistroAuditoria::EVENTOS`: `DATOPAGO_CREADO`, `DATOPAGO_EDITADO`, `DATOPAGO_ESTADO`, `DATOPAGO_ELIMINA`, `QRPAGO_SUBIDO`, `QRPAGO_QUITADO` (≤ 16 caracteres; T-01 verifica el largo de la columna de eventos). El `detalle` no incluye la dirección completa: solo clave de red y los últimos 6 caracteres. Cambio **idéntico** en los 4 backends |
| RN-16 | Límites de uso | Escrituras: `LimitadorPeticiones::controlar()` general más tope propio de **20 escrituras por minuto por administrador** (DA-07); excedido → 429 con el formato del limitador existente y evento `LIMITE_PETICIONES` |
| RN-17 | Códigos HTTP | 200 éxito; 400 validación (mensaje en español); 401 sin sesión; 403 sin rol; 404 solo en `qr` de lectura; 409 clave de red repetida; 429 límite. **422 no se usa** (reservado) |
| RN-18 | Formato | Respuestas con `respuestaExitosaSimple` / `respuestaErrorSimple` (datos sin envoltorio; `{error}` en fallos); sentencias preparadas con `Enlace`; entrada saneada y con lista blanca de campos (`exigirCamposPermitidos`) |
| RN-19 | Sin pérdida de funcionalidad | Ningún endpoint, columna ni tabla existente cambia; HLT-29 es solo aditivo |

---

## H3 · Modelo de datos propuesto

Prefijo `spsu_`, `InnoDB`, `utf8mb4_general_ci` (como el resto del esquema).

**`spsu_metodopago`** (3 filas fijas)

| Columna | Tipo | Notas |
|---------|------|-------|
| `mep_idMetodo` | `int(11)` PK AI | |
| `mep_codigo` | `varchar(16)` NOT NULL | UNIQUE `uq_mep_codigo`; `CRIPTOMONEDA`, `PAYPAL`, `BANCO` |
| `mep_nombre` | `varchar(64)` NOT NULL | Texto para mostrar |
| `mep_activo` | `tinyint(1)` NOT NULL DEFAULT 0 | |
| `mep_orden` | `int(11)` NOT NULL DEFAULT 0 | |
| `mep_paypalCorreo` | `varchar(64)` NULL | solo PAYPAL |
| `mep_paypalEnlace` | `varchar(255)` NULL | solo PAYPAL |
| `mep_bancoNumero` | `varchar(15)` NULL | solo BANCO: **número de WhatsApp** (dígitos) |
| `mep_bancoPlantilla` | `varchar(500)` NULL | solo BANCO: plantilla del mensaje de WhatsApp |
| `mep_bancoTitular` | `varchar(128)` NULL | solo BANCO: titular de la cuenta |
| `mep_bancoDocumento` | `varchar(20)` NULL | solo BANCO: documento del titular (opcional) |
| `mep_bancoEntidad` | `varchar(64)` NULL | solo BANCO: banco o entidad |
| `mep_bancoTipoCuenta` | `varchar(32)` NULL | solo BANCO: `AHORROS`, `CORRIENTE`, `VIRTUAL`, `OTRO` |
| `mep_bancoCuenta` | `varchar(34)` NULL | solo BANCO: número de cuenta (alfanumérico y guiones) |
| `mep_bancoPaisMoneda` | `varchar(32)` NULL | solo BANCO: país o moneda (opcional) |
| `mep_bancoObservaciones` | `varchar(255)` NULL | solo BANCO: observaciones (opcional) |
| `mep_creadoPor` / `mep_actualizadoPor` | `int(11)` NULL | id de usuario (sin FK, como el historial) |
| `mep_fechacrea` | `datetime` NOT NULL DEFAULT current_timestamp() | |
| `mep_fechaact` | `datetime` NULL | |

**Por qué los datos de la cuenta van en `spsu_metodopago` y no en una tabla `spsu_cuentabanco`.** El método BANCO es una sola fila fija, igual que PayPal, que ya guarda sus datos en columnas de la misma tabla; una tabla propia con una única fila y una FK solo añadiría un JOIN y otra pieza que mantener. Si más adelante se admiten varias cuentas por entidad, se migra a una tabla propia en ese cambio.

**`spsu_redusdt`**

| Columna | Tipo | Notas |
|---------|------|-------|
| `red_idRed` | `int(11)` PK AI | |
| `red_clave` | `varchar(16)` NOT NULL | UNIQUE `uq_red_clave` |
| `red_nombre` | `varchar(64)` NOT NULL | «TRON», «BNB Smart Chain» |
| `red_etiqueta` | `varchar(16)` NOT NULL | «TRC20», «BEP20», «ERC20» |
| `red_direccion` | `varchar(128)` NOT NULL | |
| `red_activo` | `tinyint(1)` NOT NULL DEFAULT 1 | |
| `red_orden` | `int(11)` NOT NULL DEFAULT 0 | índice `ix_red_activo_orden (red_activo, red_orden)` |
| auditoría | igual que arriba con prefijo `red_` | |

**`spsu_qrpago`**

| Columna | Tipo | Notas |
|---------|------|-------|
| `qr_idQr` | `int(11)` PK AI | |
| `qr_redId` | `int(11)` NOT NULL | UNIQUE `uq_qr_red`; FK a `spsu_redusdt(red_idRed)` `ON DELETE CASCADE` |
| `qr_tipoMime` | `varchar(32)` NOT NULL | solo los 3 permitidos |
| `qr_tamano` | `int(11)` NOT NULL | bytes |
| `qr_hash` | `char(64)` NOT NULL | SHA-256 hex del contenido guardado (ETag) |
| `qr_contenido` | `mediumblob` NOT NULL | |
| `qr_creadoPor`, `qr_fechacrea`, `qr_actualizadoPor`, `qr_fechaact` | | auditoría |

**Decisión de almacenamiento del QR (DA-01).** Opciones: (A) `MEDIUMBLOB` en la base; (B) archivo en disco bajo `rest_suscripcion/almacen/qr/` con nombre aleatorio y la ruta en la base. **Recomendación A**: el proyecto ya guarda las imágenes de comprobante dentro de la base (`pag_imagen`); es atómico con los datos, entra en las copias de seguridad de la base, no depende de permisos de carpeta ni de despliegue, no hay riesgo de ejecución de archivos subidos ni de recorrido de rutas, y 256 KB × pocas redes es insignificante. Se sirve **solo** por el endpoint (nunca por URL directa). B se descarta salvo que el usuario exija archivos: exigiría carpeta fuera de `htdocs` o `.htaccess` con `Require all denied` y `php_flag engine off`, nombres `bin2hex(random_bytes(16))`, permisos y limpieza de huérfanos.

**Semilla neutra (en el script, T-02).** 3 filas en `spsu_metodopago` (`CRIPTOMONEDA` «Criptomoneda (USDT)», `PAYPAL` «PayPal», `BANCO` «Transferencia bancaria por WhatsApp»), todas `activo = 0`, datos `NULL` (incluidas las columnas de la cuenta bancaria), `orden` 1, 2, 3. **Sin filas en `spsu_redusdt` ni `spsu_qrpago`.** No se copian valores del archivo del front: los valores que hoy tiene `datos-pago.config.ts` pueden ser de prueba y los confirma el administrador al cargarlos en la ventana (compuerta M-01).

---

## H4 · Endpoints

Recurso nuevo `datosPago` → `rutas/DatosPagoRts.php` registrado en `RUTAS` de `index.php` (T-01 comprueba que `Enrutador::resolver` no confunde `datosPago` con `pagos`). Todos pasan por `ValidadorSesion` y `LimitadorPeticiones::controlar()`.

| Método y ruta | Quién | Cuerpo / query | Respuesta |
|---------------|-------|----------------|-----------|
| `GET datosPago/disponibles` | cualquier sesión | — | `{ cripto: {nombre, redes:[{clave,nombre,etiqueta,direccion,tieneQr,qrHash}]} \| null, paypal: {nombre,correo,enlace} \| null, banco: {nombre,numero,plantilla} \| null }` solo lo disponible (RN-06, RN-07) |
| `GET datosPago/qr?clave=TRON` | cualquier sesión (RN-11) | `clave` | imagen binaria con cabeceras de RN-11, 304 o 404 |
| `GET datosPago/administracion` | roles 1, 2 | — | `{ metodos:[…todos los campos…], redes:[…con activo, orden, tieneQr, qrTamano, qrTipoMime, qrHash, auditoría…] }` |
| `POST datosPago/guardarRed` | 1, 2 | `{red_idRed?, red_clave, red_nombre, red_etiqueta, red_direccion, red_activo, red_orden}` | `{success:'ok', red_idRed}`; sin id crea (409 si la clave existe) y con id edita (la clave no se edita) |
| `POST datosPago/cambiarEstadoRed` | 1, 2 | `{red_idRed, red_activo}` | `{success:'ok'}` |
| `POST datosPago/eliminarRed` | 1, 2 | `{red_idRed}` | `{success:'ok'}` (RN-13) |
| `POST datosPago/guardarPaypal` | 1, 2 | `{mep_paypalCorreo?, mep_paypalEnlace?}` | `{success:'ok'}` |
| `POST datosPago/guardarBanco` | 1, 2 | `{mep_bancoNumero, mep_bancoPlantilla?, mep_bancoTitular?, mep_bancoDocumento?, mep_bancoEntidad?, mep_bancoTipoCuenta?, mep_bancoCuenta?, mep_bancoPaisMoneda?, mep_bancoObservaciones?}` (RN-05b) | `{success:'ok'}`; `400` por formato, lista blanca o campo no permitido. `administracion` devuelve estos campos (solo roles 1 y 2); `disponibles` **no** (RN-05c) |
| `POST datosPago/cambiarEstadoMetodo` | 1, 2 | `{mep_codigo, mep_activo, mep_orden?}` | `{success:'ok'}`; activar un método sin datos completos → 400 «Completa los datos antes de activarlo» |
| `POST datosPago/subirQr` | 1, 2 | `{red_idRed, imagen}` (`data:image/…;base64,…`) | `{success:'ok', qrHash}`; reemplaza si ya existe |
| `POST datosPago/quitarQr` | 1, 2 | `{red_idRed}` | `{success:'ok'}` |

Método no permitido → 405 con la forma de `PagosRts`; acción desconocida → 400.

---

## H5 · Calidad del HLT y cobertura

| RN | Tareas | Prueba |
|----|--------|--------|
| RN-01…RN-06, RN-12, RN-13 | T-02, T-04, T-05 | batería B-01…B-12 de H8 |
| RN-05b, RN-05c | T-02, T-04, T-05 | B-18d…B-18p (validación de datos bancarios, `disponibles` sin cuenta, `administracion` solo para 1 y 2) |
| RN-07, RN-08 | T-05, T-06 | B-13…B-18 |
| RN-09…RN-11 | T-02, T-03, T-07 | B-19…B-28 |
| RN-14…RN-16 | T-03, T-08 | B-29…B-33 |
| RN-17, RN-18, RN-19 | todas | `php -l`, B-34, no regresión |

### Discrepancias código ↔ pedido
| # | Hecho | Resolución |
|---|-------|------------|
| C-1 | `leerImagen` tiene tope fijo de 512 KB (`TAMANO_MAXIMO_IMAGEN_BYTES`) | Parámetro opcional `$maximoBytes` (defecto igual al actual): el comprobante no cambia |
| C-2 | Una imagen `<img>` no puede mandar `Authorization` | El front la pide como blob con el token (HLT-30); el endpoint sigue autenticado, no público |
| C-3 | `pag_metodoPago` guarda texto libre del catálogo de 3 | Sin FK nueva: el catálogo nuevo solo gobierna qué se ofrece |

---

## H6 · Decisiones abiertas (el usuario acepta o cambia; recomendación marcada)

| ID | Decisión | Opciones | Recomendación por defecto |
|----|----------|----------|---------------------------|
| DA-01 | Dónde guardar el QR | A) BLOB en BD; B) disco | **A** (H3) |
| DA-02 | ¿Servir el QR y los datos a cualquier sesión o solo a quien tiene un plan pendiente? | A) cualquier sesión; B) solo con plan pendiente | **A**: el recorrido de pago ya está detrás de sesión y los datos son para recibir dinero (no secretos); B añadiría acoplamiento con `LectorPlanVigente` |
| DA-03 | Tamaño máximo y tipos del QR | 256 KB; png, jpeg, webp | **Aceptar**; 512 KB si el usuario sube capturas pesadas |
| DA-04 | Eliminar redes: borrado real o solo desactivar | | **Ambos** (RN-13): desactivar es lo habitual |
| DA-05 | Validar checksum de TRON/ETH (Base58Check, EIP-55) | A) solo formato; B) checksum | **A**: formato evita typos groseros sin dependencias; B exige librerías y no hay Composer en el flujo |
| DA-06 | QR también para PayPal/banco | | **No ahora** (el pedido es solo cripto); el modelo se amplía con otra FK después |
| DA-07 | Tope de escrituras por minuto | 20 por administrador | **Aceptar** |
| DA-08 | Semilla con los valores actuales del front | A) vacía; B) el usuario los pasa por la ventana | **A + B**: nada se inventa ni se copia de un archivo que puede traer valores de prueba |

---

## H7 · Plan de tareas

`RS` = `rest_suscripcion`, `AN` = `rest_suscripcion/anexos`.

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | solo lectura | — | HLT-17-v4 y HLT-26-v2 `COMPLETADOS`; `php -l` limpio en `RS`; `sha256` de `RegistroAuditoria.php` igual en los 4 backends (anotado en el informe); largo de la columna `aud_evento` (o equivalente) ≥ 16; `extension_loaded('gd')` y `finfo` conocidos; `Enrutador::resolver` con `datosPago` y `pagos` probado en seco (lectura del código); estructura actual de `spsu_*` sin las 3 tablas nuevas | — |
| T-02 | **Script SQL de actualización** (lo ENTREGA el agente; NO lo ejecuta) | Texto en la respuesta final, sin crear archivo en `AN` | T-01 | Script «listo para ejecutar desde el gestor», **idempotente**: `CREATE TABLE IF NOT EXISTS` de las 3 tablas de H3 (índices, UNIQUE y FK; `spsu_metodopago` incluye las columnas de la cuenta bancaria, RN-05b), `INSERT … SELECT … WHERE NOT EXISTS` de las 3 filas de método (todas `activo = 0`), bloque de **reversión** (`DROP TABLE IF EXISTS` en orden `spsu_qrpago`, `spsu_redusdt`, `spsu_metodopago`) comentado, y consultas de verificación (`SHOW TABLES LIKE 'spsu_%pago'`, `SELECT mep_codigo, mep_activo FROM spsu_metodopago`). No toca `spsu_planes` ni `spsu_pagos`; ningún dato inventado | RN-01, RN-09, RN-12 |
| T-03 | Auditoría (4 copias) | `RS/configuracion/RegistroAuditoria.php` y las copias en `rest_usuario`, `rest_criteriokelly`, `rest_divisas` (misma ruta `configuracion/`) | T-01 | Los 6 eventos de RN-15 añadidos al final de `EVENTOS`; `sha256` idéntico en los 4; `php -l` limpio en los 4 | RN-15 |
| T-04 | Modelo | `RS/modelos/DatosPagoMdl.php` (nuevo) | T-02 aplicado por el usuario (compuerta G-01) | Métodos con sentencias preparadas: `listarAdministracion`, `listarDisponibles`, `crearRed`, `actualizarRed`, `cambiarEstadoRed`, `eliminarRed`, `contarRedesActivas`, `guardarPaypal`, `guardarBanco`, `cambiarEstadoMetodo`, `guardarQr` (upsert por `qr_redId` en transacción), `quitarQr`, `leerQr` (con ETag). Auditoría con `ContextoSesion::idUsuario()` | RN-02, RN-06, RN-12…RN-14 |
| T-05 | Controlador de datos | `RS/controladores/DatosPagoCtrl.php` (nuevo, extiende `BaseCtrl`) | T-04 | Validaciones RN-02…RN-05, RN-05b y RN-13 con mensajes en español (`guardarBanco` con listas blancas y patrones; `disponibles` sin datos de cuenta, RN-05c; auditoría con últimos 4 dígitos); `exigirAdministrador()` común que responde el 403 uniforme y registra `ACCESO_DENEGADO`; `disponibles` arma el JSON de H4 omitiendo lo no disponible; lista blanca de campos; sin eco de entrada sin sanear | RN-02…RN-08, RN-13, RN-17, RN-18 |
| T-06 | Rutas y registro | `RS/rutas/DatosPagoRts.php` (nuevo), `RS/index.php` | T-05 | Switch por método + acción como `PagosRts`; entrada en `RUTAS`; 405/400 como los demás; `.htaccess` sin cambios | RN-08, RN-17 |
| T-07 | Subida y servicio del QR | `RS/controladores/BaseCtrl.php` (parámetro `$maximoBytes` opcional en `leerImagen`, defecto actual), `DatosPagoCtrl.php` (`subirQr`, `quitarQr`, `servirQr`) | T-06 | RN-10 y RN-11 completos: tope 256 KB, MIME real, dimensiones, GD si existe, hash; cabeceras de RN-11 y 304; `leerImagen` sigue dando lo mismo para `crearConPago` (batería de comprobante repetida) | RN-09…RN-11 |
| T-08 | Rate limit y auditoría de uso | `DatosPagoCtrl.php` / reutiliza `LimitadorPeticiones` | T-06 | Tope de RN-16; eventos de RN-15 en cada escritura con el detalle enmascarado | RN-15, RN-16 |
| T-09 | Batería HTTP temporal | script en el directorio temporal de la sesión (no en el repo) | T-08 | B-01…B-34 de H8 verdes; el script y las filas de prueba se borran al terminar; **sin evidencias en disco** | todas |
| T-10 | No regresión de pagos | misma batería | T-09 | `pagos/pendientes`, `confirmar`, `rechazar`, `miUltimoPago`, `suscripcion/crearConPago` con comprobante responden igual que antes (códigos y formas) | RN-19 |
| T-11 | Documentar | `RS/README.md`, `CLAUDE.md` raíz (una línea en «Database»/arquitectura si aplica) | T-10 | README: tablas nuevas, endpoints de H4, política del QR (BLOB, 256 KB, tipos, re-codificado), eventos de auditoría | — |
| T-12 | **Regenerar los dos SQL de anexos** (tras confirmar el usuario que aplicó T-02) | `AN/sist_suscripcion_estructura.sql`, `AN/sist_suscripcion_datos.sql` | G-01 | Regeneración desde la BD viva (`mysqldump --no-data` de las tablas `spsu_*`; datos solo de catálogos: añade `spsu_metodopago` con sus 3 filas **neutras**, nunca `spsu_redusdt` ni `spsu_qrpago` porque son datos operativos) según `CLAUDE.md` raíz; `anexos/` sigue con exactamente 2 archivos SQL | RN-19 |

**Orden:** T-01 → T-02 (entrega) → [G-01: el usuario aplica el script] → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11 → T-12.

**Compuertas manuales del usuario.** **G-01:** corre el script de T-02 en su gestor y responde «script aplicado» (hasta entonces el agente no avanza con T-04). **G-02:** acepta o cambia DA-01…DA-08 antes de T-02.

---

## H8 · Pruebas y seguridad

**Estáticas.** `php -l` de cada archivo tocado y nuevo; `sha256` de las 4 copias de `RegistroAuditoria.php`.

**Batería HTTP temporal (curl, sin evidencias).** Usuarios: administrador (rol 2), suscriptor (rol 3), sin token.
- B-01…B-12 crear/editar/listar redes (formato TRON, ETH y BSC válidos e inválidos, clave repetida 409, campos extra 400, XSS `<script>` en nombre/etiqueta guardado como texto y devuelto escapado/saneado, dirección con espacios, largo excedido).
- B-13…B-18 control de acceso: suscriptor y anónimo en cada ruta de escritura y en `administracion` → 403/401 uniforme; `disponibles` con suscriptor → 200 sin campos de administración; un método inactivo o incompleto no aparece.
- B-19…B-28 QR: PNG válido ok; JPEG y WebP ok; GIF, SVG, PDF, texto renombrado a `.png`, PNG con MIME declarado distinto, > 256 KB, base64 inválido, imagen de 10×10 y de 5000×5000, polyglot (imagen con `<?php` al final; si GD existe, la salida no lo contiene) → 400; reemplazo conserva una sola fila; `qr` activa → 200 con las cabeceras de RN-11 y 304 con `If-None-Match`; red inactiva con suscriptor → 404; `eliminarRed` borra el QR.
- B-29…B-33 auditoría: un registro por escritura con `detalle` enmascarado (sin dirección completa); 21.ª escritura en un minuto → 429.
- B-34 formato y códigos: ningún 422; todo error con `{error}`.

**Seguridad (OWASP).** A01 control de acceso con roles de `ContextoSesion` (nunca del cliente) y 403 uniforme; A03 sentencias preparadas y lista blanca de campos; A04 QR de contenido real, tope y re-codificado, sin escribir a disco ni ejecutar; A05 cabeceras de RN-11 (`nosniff`, CSP `default-src 'none'`); A08 `qr_hash` verifica integridad; A09 auditoría sin datos completos; XSS: el back guarda texto plano y el front interpola (HLT-30 prohíbe `innerHTML`); SSRF: ninguna URL se descarga (el enlace PayPal solo se almacena tras validar host).

---

## H9 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Un administrador cambia la dirección por una propia (desvío de pagos) | Alta | Solo roles 1 y 2; auditoría de cada cambio con usuario y fecha; confirmación en la app (HLT-30); riesgo residual de colusión como en HLT-26 |
| R-02 | Tras la migración no hay datos y el pago queda «no disponible» | Alta | Compuerta M-01 de HLT-30: el administrador carga los datos antes de publicar; el fallback es el mensaje existente |
| R-03 | QR malicioso (polyglot, SVG con scripts) | Media | RN-10 y RN-11 |
| R-04 | Script SQL aplicado a medias | Media | Idempotente y con verificación; reversión comentada |
| R-05 | `RegistroAuditoria` distinto entre backends | Media | T-03 con `sha256` |
| R-06 | Cambiar `leerImagen` altera el comprobante | Media | Parámetro opcional con el valor actual; T-10 |

## H10 · Seguimiento (semántica `⬜ ✅ ❌ ➖`)

Ficha por tarea: **C1** archivos, **C2** criterio de H7, **C3** reglas de entorno y de H2, **C4** `php -l`, **C5** batería de H8, **C6** sin efectos fuera de alcance. T-01…T-12 en `PENDIENTE`. Informe final: resumen, tablero, cobertura de RN, cambios `ruta:línea`, salidas de `php -l`/batería (en el informe, no en archivos), desviaciones, pendientes y el script de T-02.

## H11 · Convenciones

Español y nombres claros: `DatosPagoRts`, `DatosPagoCtrl`, `DatosPagoMdl`; métodos con verbo (`guardarRed`, `subirQr`); columnas con prefijos `mep_`, `red_`, `qr_`; el TypeScript de HLT-30 usa esos nombres tal cual.
