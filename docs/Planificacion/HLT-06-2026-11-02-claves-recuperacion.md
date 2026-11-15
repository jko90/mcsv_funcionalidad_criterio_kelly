# HLT-06 · Claves y recuperación (`rest_usuario`)

| Campo | Valor |
|-------|-------|
| HLT | HLT-06 |
| Fecha | 2026-11-02 |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4): B-02 a B-07; C-01 y C-02 para `/persona` y `/autenticacion`; correo de alerta de D-03; J-04 |
| Plan maestro | [PLAN-MAESTRO-HU-001](PLAN-MAESTRO-HU-001.md): §4.1 (claves `.env` de correo), §4.2 (clases compartidas), §4.4 (`sgen_recuperacion`), §4.5 (contrato HTTP), §5 (reglas comunes) |
| Contrato de planificación | `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11) + extensiones para backend de `docs/planificador.md` |
| Overrides vigentes | PHP **8.2+** (rige sobre "PHP 8.0" de `desarrollador-php.md`); Composer autorizado con `phpmailer/phpmailer` en `rest_usuario`, versión fijada en `composer.lock`; HLT guardados en `docs/Planificacion/` |
| Proyectos | `rest_usuario` (`desarrollador-php`) + copia del SQL en `criterioKellyApp/src/assets/anexos/` (`desarrollador-ionic`) |
| Precondición | HLT-01, HLT-02 y HLT-03 ejecutados (`HECHA` en todas sus tareas). Al redactar este HLT **no existían** sus documentos en `docs/Planificacion/`: este HLT se apoya en el plan maestro y fija en la tabla **IR** (H5) la interfaz que necesita de ellos. T-01 la verifica antes de tocar código. |
| Veredicto | **APROBADO** (H6, ronda 2) |

---

## H1. Propósito

### Requerimiento literal

> Redactar un HLT: **HLT-06 · Claves y recuperación (rest_usuario)**.
>
> - `PoliticaClaves` (B-02): 10–128 caracteres, distinta de usuario y correo (comparación sin mayúsculas), rechazo por lista de 10 000 claves comunes en RUTA_CLAVES_COMUNES (define de qué fuente pública se obtiene la lista, su licencia y cómo se versiona; búsqueda eficiente). Hash Argon2id para toda clave nueva.
> - Registro `persona/agregar` (B-07): aplica política, límite de A-06, mensaje de duplicado que no permita confirmar correos existentes (revisa la respuesta 409 actual en PersonaCtrl/PersonaMdl y decide el nuevo comportamiento sin romper el flujo de la app — documenta el cambio de contrato para HLT-08). Persona `actualizarDeApp` y cualquier otro endpoint de /persona: usuario desde `ContextoSesion` (C-01/C-02).
> - Eliminar generarCodigo/obtenerCodigo (rutas, controlador, modelo); `usu_codiorecupe` deja de usarse (no se borra la columna).
> - `seguridad_02_recuperacion.sql` (idempotente, columnas de sgen_recuperacion: hash del código, expiración 15 min, intentos, usado, IP…) + copia en `criterioKellyApp/src/assets/anexos/` (tarea separada para desarrollador-ionic).
> - `solicitarRecuperacion` (B-04: respuesta siempre igual y en tiempo similar, código random_int 6 dígitos guardado como hash, 15 min, un solo uso, 3 por correo/hora), `restablecerClave` (B-05: 5 intentos por código, política, invalida código y TODAS las sesiones, correo de aviso), `actualizarClave` (B-06: token + clave actual, política, revoca las demás sesiones, conserva la actual).
> - `EnviadorCorreo` sobre PHPMailer con CORREO_MODO=smtp|log (J-04: Mailpit en local, log fuera de la raíz pública si no hay Mailpit; nunca correos reales desde local), plantillas de texto en español.
> - Alertas de D-03: el script de mantenimiento de HLT-03 envía correo a CORREO_ALERTAS si en la última hora hubo >10 REFRESH_REUTILIZADO, BLOQUEO_IP o ACCESO_DENEGADO.
> - Auditoría: RECUPERACION_SOLICITADA, CLAVE_RESTABLECIDA, CLAVE_CAMBIADA.
> - Pruebas curl en local: enumeración (correo existente vs inexistente: misma respuesta), fuerza bruta del código (6º intento falla aunque sea correcto), código vencido/reutilizado, política (clave corta, común, igual al usuario), actualizarClave sin clave actual → error, sesiones previas revocadas tras restablecer, correo recibido en Mailpit/log. Última tarea: README de rest_usuario.

### Propósito

Cerrar la toma de cuentas que hoy permite la recuperación de clave (S-08) y endurecer el ciclo de vida de las claves del trader: claves robustas guardadas con un algoritmo moderno, recuperación por correo sin filtrar qué correos existen, cambio de clave que exige la clave actual, y un aviso al administrador cuando la auditoría detecta ataques.

### Resultado esperado

- Toda clave nueva (registro, restablecimiento, cambio) cumple la política B-02 en el servidor y se guarda como hash Argon2id.
- La recuperación funciona solo por correo con un código de un solo uso, de vida corta y con intentos limitados; las respuestas no permiten saber si un correo está registrado.
- Los endpoints antiguos de código de recuperación ya no existen y `usu_codiorecupe` no se lee ni se escribe.
- El registro no permite confirmar correos existentes; `/persona` y `actualizarClave` operan solo sobre el usuario de la sesión.
- En local los correos llegan a Mailpit o a un log protegido; nunca salen a internet.
- El script de mantenimiento avisa por correo de picos de eventos de ataque.
- Pruebas `curl` reproducibles en local demuestran cada protección.

### Fuera de alcance

1. Borrar la columna `sgen_usuario.usu_codiorecupe` (`DROP COLUMN`), según plan maestro §4.4.
2. El rehash a Argon2id en el login (B-01) y todo `autenticar`, `renovar`, `cerrarSesion`, `cerrarTodas`, `usRol`: son de HLT-03.
3. Cualquier cambio en `criterioKellyApp` distinto de copiar el script SQL: las pantallas y modelos los adapta HLT-08 según la sección "Cambios de contrato para HLT-08" (H5).
4. La activación de usuarios en situación `P` (pendiente). Hoy un usuario registrado queda en `P` y el login exige `A` (`ValidacionMdl.php:20`); nada en el código lo activa. Se mantiene igual.
5. La creación de la suscripción durante el registro (pregunta Q-01, H6). Este HLT no toca `rest_suscripcion`.
6. Cambiar la regla de teléfono único del registro (pregunta Q-02, H6).
7. `GET persona/obtener` (responde 501 sin leer datos, `PersonaRts.php:76-92`) y `DELETE /persona` (501, `PersonaRts.php:185-193`): sin cambios.
8. Configurar el SMTP de producción (DH-10), el cron del servidor y el paquete de despliegue: HLT-11.
9. Instalar Mailpit (acción U-03 del usuario).
10. Actualizar `rutas.txt` (documento desactualizado y bloqueado por E-02).

### Feature(s) afectada(s)

| Servicio | Recurso / artefacto |
|----------|---------------------|
| `rest_usuario` | `/autenticacion` → `solicitarRecuperacion`, `restablecerClave`, `actualizarClave`; eliminación de `generarCodigo` y `obtenerCodigo` |
| `rest_usuario` | `/persona` → `agregar`, `actualizarDeApp` |
| `rest_usuario` | `servicios/` (nuevo): `HashClaves`, `PoliticaClaves`, `PlantillasCorreo`, `EnviadorCorreo`, `AlertasSeguridad` |
| `rest_usuario` | Script de mantenimiento de HLT-03 (alerta + limpieza de `sgen_recuperacion`) |
| `sist_criteriokelly` | Tabla nueva `sgen_recuperacion`; índice `idx_per_correo` en `sgen_persona` |
| `criterioKellyApp` | `src/assets/anexos/seguridad_02_recuperacion.sql` (copia) |

---

## H2. Reglas de negocio

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-01 | Longitud de clave | Toda clave nueva cumple `10 <= mb_strlen($clave, 'UTF-8') <= 128`; si no, 400 `La clave debe tener entre 10 y 128 caracteres`. | B-02 |
| RN-02 | Clave distinta de usuario y correo | `mb_strtolower($clave) !== mb_strtolower($usuario)` y `!== mb_strtolower($correo)`; si no, 400 `La clave no puede ser igual al usuario ni al correo`. | B-02 |
| RN-03 | Clave no común | `mb_strtolower($clave)` no está en el archivo de `RUTA_CLAVES_COMUNES` (10 000 entradas); si está, 400 `La clave es demasiado común; elige una diferente`. | B-02 |
| RN-04 | Hash Argon2id | Todo valor que este HLT escribe en `usu_clave` empieza por `$argon2id$` y se genera con `memory_cost=65536`, `time_cost=4`, `threads=1`. | B-01, requerimiento |
| RN-05 | La clave se procesa en crudo | La clave **no** pasa por `limpiarDatos`/`htmlspecialchars` ni `trim` antes de validarse o hashearse. La verificación de una clave actual acepta también el formato legado `htmlspecialchars(trim($clave), ENT_QUOTES, 'UTF-8')` (hashes creados por `PersonaMdl.php:62` y `ValidacionMdl.php:58`). | `PersonaCtrl.php:86`, `ValidacionCtrl.php:23`, D-14 |
| RN-06 | Endpoints antiguos eliminados | `grep -rn "generarCodigo\|obtenerCodigo\|usu_codiorecupe" rest_usuario --include=*.php` → 0 resultados; `POST autenticacion/generarCodigo` y `obtenerCodigo` con token válido → 404 `Recurso no encontrado`. | B-03, §4.5 |
| RN-07 | Solicitud de recuperación sin enumeración | Para cualquier correo con formato válido, `solicitarRecuperacion` responde 200 con el cuerpo exacto `{"mensaje":"Si el correo está registrado, recibirás un código en unos minutos."}` y tarda al menos 2000 ms. | B-04 |
| RN-08 | Código seguro | El código es `sprintf('%06d', random_int(0, 999999))`, se guarda solo como hash Argon2id en `rec_codigoHash` y nunca aparece en respuestas HTTP, auditoría ni `error_log`. | B-04, D-02, C-04 |
| RN-09 | Vigencia y uso único | Un código vale si `rec_situacion = 'A'`, `rec_fechaExpira > NOW()` y `rec_intentos < 5`. Al usarse pasa a `U`; al emitirse uno nuevo o cambiar la clave, los activos del usuario pasan a `R`. | B-04, B-05 |
| RN-10 | Límite de solicitudes por correo | Por usuario: como máximo 3 filas de `sgen_recuperacion` creadas en la última hora y 10 en las últimas 24 h. Superado el límite: misma respuesta 200, sin código nuevo ni correo. | B-04 (más estricto en 24 h, D-11) |
| RN-11 | 5 intentos por código | Cada intento sobre un código vigente incrementa `rec_intentos` de forma atómica **antes** de comparar. Con `rec_intentos = 5` cualquier intento, incluso con el código correcto, responde 400 `Código inválido o vencido`. | B-05 |
| RN-12 | Error único de código | Correo inexistente, sin código vigente, código incorrecto, vencido, usado o agotado → 400 `{"error":"Código inválido o vencido"}`. | B-05, B-04 |
| RN-13 | Restablecer invalida todo | Tras `restablecerClave` exitoso: el código queda `U`, los demás activos `R`, y **todas** las sesiones del usuario quedan revocadas (sus tokens → 401). Todo en una transacción. | B-05, C-05 |
| RN-14 | Cambio de clave con clave actual | `actualizarClave` exige token válido, `claveActual` correcta y la política; revoca las demás sesiones y conserva la actual; todo en una transacción. | B-06, C-05 |
| RN-15 | Límite de fallos de clave actual | Con 5 o más `LOGIN_FALLIDO` del usuario en los últimos 15 min, `actualizarClave` responde 429 `Demasiados intentos, intente nuevamente más tarde` con `Retry-After: 900` sin verificar la clave. Cada `claveActual` incorrecta audita `LOGIN_FALLIDO`. | A-06, D-15 |
| RN-16 | Correo de aviso | Tras `restablecerClave` y `actualizarClave` exitosos se envía el aviso de cambio al correo del usuario. Un fallo de envío no revierte el cambio y se registra en el log sin datos sensibles. | B-05 |
| RN-17 | Registro sin enumerar correos | `persona/agregar` responde el mismo 200 `{"mensaje":"Registro recibido. Podrás iniciar sesión cuando tu cuenta esté activa."}` tanto si crea la cuenta como si el correo ya existe (en ese caso no crea nada). Usuario o teléfono duplicado → 409 `El nombre de usuario o el teléfono ya están registrados`. | B-07, D-05 |
| RN-18 | Registro con política y límite | `persona/agregar` aplica RN-01 a RN-04 y queda sujeto al límite público de A-06 (60 peticiones/min por IP → 429). | B-07, A-06 |
| RN-19 | Registro atómico | Persona, usuario y rol 4 se insertan en una transacción; ante cualquier error no queda ninguna fila parcial. | C-05, `PersonaMdl.php:38-104` |
| RN-20 | Usuario de la sesión en `/persona` y `actualizarClave` | El usuario afectado es `ContextoSesion::idUsuario()`. Si el cuerpo trae `id` distinto → 403 `Acceso denegado` + auditoría `ACCESO_DENEGADO`. | C-01, C-02 |
| RN-21 | Campos permitidos | Cada endpoint acepta solo su lista blanca de campos (H5, D-13); cualquier otro → 400 `Solicitud inválida`. Los campos de texto deben ser `string`; si no → 400 `Solicitud inválida`. | C-06 |
| RN-22 | Auditoría de claves | `solicitarRecuperacion` audita `RECUPERACION_SOLICITADA` (con `idUsuario` o `null`); `restablecerClave` exitoso audita `CLAVE_RESTABLECIDA`; `actualizarClave` exitoso audita `CLAVE_CAMBIADA`. Ningún registro guarda clave, código ni token. | D-01, D-02 |
| RN-23 | Correo solo a Mailpit o log en local | Con `APP_ENTORNO=local`: `CORREO_MODO=log` escribe en `RUTA_LOGS/correos.log`; `CORREO_MODO=smtp` solo acepta `SMTP_HOST` en `localhost`, `127.0.0.1` o `::1`, o lanza excepción sin enviar. `CORREO_MODO=log` fuera de `local` lanza excepción. | J-04, §4.1 |
| RN-24 | Correo sin inyección ni enlaces | Asuntos fijos; destinatario validado con `PHPMailer::validateAddress` y sin `\r`/`\n`; solo texto plano; ningún cuerpo contiene URLs ni datos de `$_SERVER['HTTP_HOST']`; el nombre del usuario va solo en el cuerpo. | Seguridad (H6) |
| RN-25 | Alerta de ataques | El mantenimiento envía un correo a `CORREO_ALERTAS` si la suma de `REFRESH_REUTILIZADO` + `BLOQUEO_IP` + `ACCESO_DENEGADO` de los últimos 60 min es **> 10**, como máximo una vez cada 60 min. | D-03 |
| RN-26 | Respuestas sin datos internos | Ninguna respuesta incluye hashes, códigos, `usu_clave`, mensajes de excepción ni SQL. | C-04, C-08 |
| RN-27 | Formato de respuesta y 422 | Éxito: dato directo o `{"success":"ok"}`; error: `{"error":"..."}`. Ningún endpoint de este HLT usa 422. | C-07, CLAUDE.md |

---

## H3. Flujo principal de ejecución

Todas las peticiones siguen el arranque de §4.3: `.htaccess` → `index.php` (Configuracion, ManejadorErrores, CabecerasSeguridad, CORS, LectorSolicitud, Enrutador, `ValidadorSesion::exigir()` si la ruta no es pública, `LimitadorPeticiones::controlar()`) → `rutas/<X>Rts.php` → `Ctrl` → `Mdl` → `Enlace` → MySQL. Las ramas comunes de esas capas (400 de `LectorSolicitud`, 401 de `ValidadorSesion`, 404 de `Enrutador`, 405, 429 general, 500 de `ManejadorErrores`) aplican a todos los flujos y no se repiten.

### Flujo A · `POST autenticacion/solicitarRecuperacion` (público)

```
[App: "Olvidé mi clave" → { correo }]
 → index.php (pública; límite 60/min por IP) → ValidacionRts manejarPost 'solicitarRecuperacion'
 → ClaveCtrl::solicitarRecuperacion($datos)
   1. $inicio = hrtime(true)
   2. Campos permitidos = [correo]; correo string, FILTER_VALIDATE_EMAIL, ≤ 64
        └─ Error 400: {"error":"El correo no es válido"} (sin espera mínima: no depende de la existencia)
   3. $correo = limpiarDatos (mismo formato con que se guardó per_correo)
   4. ClaveMdl::buscarUsuarioPorCorreo($correo) → filas (persona activa, usuario estado '1' y situación 'A')
   5. $codigo = sprintf('%06d', random_int(0, 999999)); $hash = HashClaves::hashear($codigo)   ← en ambos caminos
   6. Si hay exactamente 1 fila:
        try {
          ClaveMdl::registrarSolicitud(idUsuario, $hash, ip, agente)      ← transacción, FOR UPDATE, RN-10
            ├─ true  → EnviadorCorreo::enviar(correo, PlantillasCorreo::codigoRecuperacion(nombres, $codigo))
            └─ false → (límite alcanzado) no envía nada
        } catch (Throwable) → error_log sin correo ni código; se continúa
      Si hay 0 filas → nada. Si hay > 1 → error_log('[ClaveCtrl::solicitarRecuperacion] correo con varias cuentas activas') y nada.
   7. RegistroAuditoria: RECUPERACION_SOLICITADA (idUsuario o null)
   8. esperarTiempoMinimo($inicio): usleep hasta 2000 ms + random_int(0, 250) ms
   9. 200 {"mensaje":"Si el correo está registrado, recibirás un código en unos minutos."}
```

### Flujo B · `POST autenticacion/restablecerClave` (público)

```
[App: { correo, codigo, claveNueva }]
 → index.php (pública) → ValidacionRts manejarPost 'restablecerClave' → ClaveCtrl::restablecerClave($datos)
   1. Campos permitidos = [correo, codigo, claveNueva]; strings
        ├─ correo inválido        → 400 "El correo no es válido"
        └─ codigo !~ ^[0-9]{6}$   → 400 "El código debe tener 6 dígitos"
   2. PoliticaClaves::validar(claveNueva, usuario: '', correo)   ← longitud, común, igual al correo
        └─ 400 con el mensaje de la regla (RN-01..RN-03)
   3. filas = ClaveMdl::buscarUsuarioPorCorreo(limpiarDatos(correo)); si ≠ 1 fila → rama "inválido"
   4. activo = ClaveMdl::obtenerCodigoActivo(idUsuario)  (A, no vencido, intentos < 5, el más reciente)
   5. Si no hay activo, o ClaveMdl::consumirIntento(idRec) afecta 0 filas:
        password_verify(codigo, HashClaves::HASH_FICTICIO) → 400 "Código inválido o vencido"
   6. Si !password_verify(codigo, rec_codigoHash) → 400 "Código inválido o vencido"
   7. PoliticaClaves::validar(claveNueva, usu_usuario, correo) → 400 si es igual al usuario (el intento ya se consumió)
   8. $hashClave = HashClaves::hashear(claveNueva)
   9. ClaveMdl::restablecerClave(idUsuario, idRec, $hashClave, ip)    ← transacción:
        UPDATE rec → 'U' WHERE situacion='A' (0 filas → rollback → 400 "Código inválido o vencido")
        UPDATE usu_clave; UPDATE otros códigos 'A' → 'R'; revocar TODAS las sesiones (IR-05)
        └─ excepción → rollback → se relanza → 500 genérico
  10. RegistroAuditoria: CLAVE_RESTABLECIDA (idUsuario)
  11. EnviadorCorreo aviso (PlantillasCorreo::avisoCambioClave) en try/catch → error_log si falla
  12. 200 {"success":"ok"}  → la app lleva al login (sus tokens anteriores ya dan 401)
```

### Flujo C · `PUT autenticacion/actualizarClave` (protegido)

```
[App con sesión: { claveActual, claveNueva }]
 → index.php → ValidadorSesion::exigir() (401 si no hay sesión) → ValidacionRts manejarPut 'actualizarClave'
 → ClaveCtrl::actualizarClave($datos)
   1. exigirIdDeSesion($datos) → si llega 'id' distinto a ContextoSesion::idUsuario(): auditoría ACCESO_DENEGADO + 403 "Acceso denegado"
   2. Campos permitidos = [id, claveActual, claveNueva]; claveActual y claveNueva strings no vacíos
        └─ falta claveActual → 400 "El campo 'claveActual' es requerido"
   3. ClaveMdl::contarFallosRecientes(idUsuario, 15) ≥ 5 → header Retry-After: 900 + 429 (RN-15)
   4. usuario = ClaveMdl::obtenerUsuarioParaCambio(idUsuario)  (usu_usuario, usu_clave, per_correo, per_nombres)
   5. !HashClaves::verificar(claveActual, usu_clave) → auditoría LOGIN_FALLIDO + 400 "La clave actual no es correcta"
   6. PoliticaClaves::validar(claveNueva, usu_usuario, per_correo) → 400 (RN-01..RN-03)
   7. ClaveMdl::cambiarClave(idUsuario, ContextoSesion::idSesion(), HashClaves::hashear(claveNueva))  ← transacción:
        UPDATE usu_clave; revocar sesiones del usuario excepto la actual (IR-05); códigos 'A' → 'R'
   8. RegistroAuditoria: CLAVE_CAMBIADA; aviso por correo (try/catch)
   9. 200 {"success":"ok"} → la sesión actual sigue válida
```

### Flujo D · `POST persona/agregar` (público)

```
[App: registro { cedula?, nombres, apellidos, correo, telefono, usuario, clave }]
 → index.php (pública; 60/min por IP → 429) → PersonaRts manejarPost 'agregar' → PersonaCtrl::agregarPersona($datos)
   1. Campos permitidos = [cedula, nombres, apellidos, correo, telefono, usuario, clave]; requeridos todos menos cedula; strings
   2. $clave = $datos['clave'] (cruda); limpiarDatos sobre el resto; validaciones actuales de longitud/formato (PersonaCtrl.php:88-125)
        └─ 400 con el mensaje actual de cada campo
   3. PoliticaClaves::validar($clave, usuario, correo) → 400
   4. $hash = HashClaves::hashear($clave)              ← siempre, antes de mirar duplicados
   5. PersonaMdl::registrarPersona(...)                 ← transacción:
        a. usuario o teléfono existentes → rollback → REGISTRO_USUARIO_O_TELEFONO_DUPLICADO
        b. SELECT per_idPersona ... WHERE per_correo = ? FOR UPDATE → existe → rollback → REGISTRO_CORREO_EXISTENTE
        c. INSERT persona, usuario (hash Argon2id), rolusuario (rol 4) → commit → REGISTRO_CREADO
        d. mysqli_sql_exception 1062 (carrera en usu_usuario) → rollback → REGISTRO_USUARIO_O_TELEFONO_DUPLICADO
   6. ├─ CREADO o CORREO_EXISTENTE → 200 {"mensaje":"Registro recibido. Podrás iniciar sesión cuando tu cuenta esté activa."}
      └─ USUARIO_O_TELEFONO_DUPLICADO → 409 {"error":"El nombre de usuario o el teléfono ya están registrados"}
```

### Flujo E · `PUT persona/actualizarDeApp` (protegido)

```
[App con sesión: { nombres, apellidos, telefono }]
 → index.php → ValidadorSesion → PersonaRts manejarPut 'actualizarDeApp' → PersonaCtrl::actualizarPersonaNombresTelf($datos)
   1. exigirIdDeSesion($datos) → 403 + ACCESO_DENEGADO si 'id' distinto
   2. Campos permitidos = [id, nombres, apellidos, telefono]; validaciones actuales (PersonaCtrl.php:33-49)
   3. PersonaMdl::actualizarPersonaNombresTelf(ContextoSesion::idUsuario(), …)   (SQL actual, PersonaMdl.php:16)
        └─ 0 filas → 404 "No se encontró el usuario o no está activo"
   4. 200 {"id_usuario": <id de sesión>, "nombres", "apellidos", "telefono"}   (forma actual)
```

### Flujo F · Alerta de seguridad (CLI, script de mantenimiento de HLT-03)

```
[cron en servidor / a mano en local: php <script de IR-08>]
 → (tareas de limpieza de HLT-03) → ClaveMdl-free: AlertasSeguridadMdl::eliminarRecuperacionesAntiguas() (rec_fechaCrea < NOW() - 7 días)
 → AlertasSeguridad::evaluarYNotificar():
     1. conteos = AlertasSeguridadMdl::contarEventosUltimaHora([REFRESH_REUTILIZADO, BLOQUEO_IP, ACCESO_DENEGADO])
     2. total = suma; si total <= 10 → "Alerta: sin novedades (total N)" y fin
     3. Si RUTA_LOGS/alerta_seguridad.marca tiene un timestamp de hace < 3600 s → "Alerta: ya enviada en la última hora" y fin
     4. EnviadorCorreo::enviar(CORREO_ALERTAS, PlantillasCorreo::alertaSeguridad(conteos, entorno)) → escribe la marca → "Alerta: enviada (total N)"
     └─ Error de envío → mensaje en STDERR + error_log; código de salida 1
```

### Ramas de error en la app (`errorInterceptor`, `compartidos/interceptors/error.interceptor.ts:13-14`)

El interceptor muestra `error.error.error` cuando el servidor lo envía, así que los mensajes de este HLT llegan tal cual al toast. 409 sin mensaje → `error.interceptor.ts:35-36`; 429 → `:41-42`. Ningún endpoint usa 422 (reservado a límite de pérdida, `:38-39`). La adaptación de `loading`/`error` en los stores de la app es de HLT-08.

---

## H4. Calidad del HLT y cobertura

### 4.1 Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| PoliticaClaves (B-02) · RN-01, RN-02, RN-03 | T-05, T-07, T-13, T-14, T-18 | P-08, P-09c; `php -r` de T-07 |
| Lista: fuente, licencia, versionado, búsqueda eficiente | T-05, T-07 | `sha256sum` = valor de D-08; `wc -l` = 10000 |
| Argon2id para toda clave nueva · RN-04 | T-06, T-13, T-14, T-18 | P-12b (`$argon2id$`), P-06c |
| Clave en crudo y compatibilidad legado · RN-05 | T-06, T-14, T-18 | P-09e (clave con `&<'`) |
| Registro `persona/agregar` (B-07) · RN-17, RN-18, RN-19 | T-17, T-18 | P-11, P-12, P-18 |
| Contrato de registro para HLT-08 | H5 (CC-HLT08), T-25 | Revisión del README |
| `/persona` desde `ContextoSesion` · RN-20 | T-10, T-19 | P-13 |
| Eliminar generarCodigo/obtenerCodigo · RN-06 | T-15, T-16 | P-14; grep de T-24 |
| `seguridad_02_recuperacion.sql` | T-03 | Ejecutarlo dos veces sin error; `SHOW CREATE TABLE` |
| Copia en `assets/anexos/` | T-04 | `sha256sum` igual |
| `solicitarRecuperacion` · RN-07, RN-08, RN-10 | T-11, T-12, T-15 | P-01, P-02, P-03, P-16 |
| `restablecerClave` · RN-09, RN-11, RN-12, RN-13, RN-16 | T-11, T-13, T-15 | P-04, P-05, P-06, P-07, P-20, P-21 |
| `actualizarClave` · RN-14, RN-15 | T-11, T-14, T-15 | P-09, P-10 |
| `EnviadorCorreo` + plantillas · RN-23, RN-24 | T-02, T-08, T-09 | P-15, P-16, P-17 |
| Alertas D-03 · RN-25 | T-20, T-21 | P-19 |
| Auditoría · RN-22 | T-12, T-13, T-14 | Consultas de auditoría en P-01, P-06, P-09 |
| Campos permitidos · RN-21 | T-12, T-13, T-14, T-18, T-19 | P-09f, P-13c |
| Sin datos internos · RN-26, RN-27 | T-12 a T-19 | P-15 (sin código en respuestas); grep de T-24 |
| Pruebas curl en local (J-06) | T-22, T-23 | Salida real en las fichas |
| README | T-25 | Revisión del README |
| Interfaz de HLT-01/02/03 (IR) | T-01 | Fichas de T-01 |

### 4.2 Checklist de calidad del HLT

- ✅ Las 11 secciones existen y están completas.
- ✅ Sin marcadores pendientes.
- ✅ Cada RN mapea a ≥ 1 tarea (cobertura 100 %).
- ✅ Cada tarea tiene criterio de aceptación verificable y ficha de checks (H9).
- ✅ No contradice §0.5 (no toca código Angular) ni el plan maestro (contrastado en H6, ítem 3).
- ✅ Referencias `ruta:línea` verificadas contra el repositorio al 2026-11-02 (código de antes de HLT-01/02/03; T-01 vuelve a ubicarlas tras esos HLT).
- ✅ Decisiones cerradas (H5) sin ambigüedad; las dependencias de HLT-03 se resuelven con la regla de mapeo IR.

---

## H5. Reglas cerradas de decisión del HLT

### 5.1 Decisiones

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | Irreversible? |
|----|----------|-----------------------|----------------|---------------|---------------|
| D-01 | Ubicación de las clases propias de `rest_usuario` | A `configuracion/` · B `servicios/` (nueva) | **B** | §4.2 permite ambas; `configuracion/` queda para clases compartidas e idénticas en los 4 backends. `servicios/` se bloquea por la lista blanca de E-02 y HLT-11 la incluye en el paquete fuera de `public_html`. | No |
| D-02 | Controlador de los endpoints de clave | A ampliar `ValidacionCtrl` · B nuevo `ClaveCtrl` + `ClaveMdl` | **B** | Responsabilidad única: `ValidacionCtrl` queda para la sesión (HLT-03). `ValidacionRts` despacha a ambos. | No |
| D-03 | Parámetros de Argon2id | A valores por defecto implícitos · B explícitos | **B**: `memory_cost=65536`, `time_cost=4`, `threads=1` | Deterministas y compatibles con la implementación libsodium de Windows (solo `threads=1`). Iguales a los valores por defecto de PHP 8.2. | No |
| D-04 | Hash del código de 6 dígitos | A SHA-256 · B HMAC con secreto · C Argon2id | **C** | SHA-256 de 10⁶ valores se invierte en milisegundos si se filtra la BD. HMAC exigiría un secreto nuevo fuera de §4.1. Argon2id cuesta ~0,1 s por verificación (5 por código) y hace inviable el ataque fuera de línea en 15 min. | No |
| D-05 | Respuesta de `persona/agregar` (B-07) | A mantener `{idUsuario}` + 409 genérico · B 409 igual para usuario y correo · C 200 `{mensaje}` igual para cuenta creada y correo existente; 409 solo para usuario/teléfono | **C** | A y B siguen permitiendo confirmar un correo (con usuario y teléfono nuevos, 409 = el correo existe). C es la única que cumple "no permite confirmar qué correos existen". El nombre de usuario debe poder informarse para que el usuario elija otro. Es cambio de contrato exigido por B-07 (la HU es la confirmación del usuario); su forma la cierra este HLT y la adopta HLT-08. | Sí (contrato) |
| D-06 | Teléfono duplicado | A quitar la unicidad · B tratarlo como el correo (silencio) · C mantener 409 junto al usuario | **C** | RD-7: mantiene la regla actual (`PersonaMdl.php:120`). B haría fallar en silencio a usuarios legítimos. Quitar la regla es decisión de negocio (Q-02). Riesgo de enumeración de teléfonos registrado en H6. | No |
| D-07 | Correo en el registro | A bienvenida + aviso de intento · B ninguno | **B** | Enviar un aviso al dueño del correo permitiría bombardear su buzón (60/min). B no exige tabla de límites nueva. La igualdad de tiempo la da el hash Argon2id, que se calcula en ambos caminos. | No |
| D-08 | Fuente de la lista de 10 000 claves comunes | A `10k-most-common.txt` de SecLists · B derivada de `xato-net-10-million-passwords-1000000.txt` | **B**: las primeras 10 000 entradas distintas, en minúsculas, de 10 a 128 caracteres, del archivo de SecLists en la etiqueta **`2026.2`** (commit `145f1f45ba7bc5fd6b3966d3a79bf95654deb20e`) | La lista A solo tiene 51 claves de ≥ 10 caracteres y no rechazaría casi nada bajo RN-01. B son las 10 000 claves de ≥ 10 caracteres más frecuentes. Licencia: SecLists es **MIT** (© 2018 Daniel Miessler); el corpus original es de Mark Burnett (xato.net), publicado con fines de investigación. Comando (Git Bash, `LC_ALL=C`): `curl -s https://raw.githubusercontent.com/danielmiessler/SecLists/2026.2/Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt \| tr -d '\r' \| LC_ALL=C awk '{l=tolower($0)} length(l)>=10 && length(l)<=128 && !seen[l]++ {print l; n++} n==10000{exit}' > rest_usuario/configuracion/claves_comunes.txt`. SHA-256 esperado: **`6a661b412bd7cfa821f3b9f127fb47792908ccdd55df68fff710346b26f4c6d0`** (verificado por el planificador el 2026-11-02, solo ASCII, sin líneas vacías). | No |
| D-09 | Versionado de la lista | A descargarla en cada despliegue · B versionarla en el repositorio | **B** | El archivo y `claves_comunes.LEEME.txt` (fuente, etiqueta, commit, comando, licencia, SHA-256, fecha) se versionan en el git de `rest_usuario`. Cambiar la lista exige nuevo HLT con nueva etiqueta y hash. En el servidor vive fuera de `public_html` (E-01) en la ruta de `RUTA_CLAVES_COMUNES`. | No |
| D-10 | Búsqueda en la lista | A `in_array` · B `array_flip` + `isset` · C consulta SQL | **B** | `file(..., FILE_IGNORE_NEW_LINES \| FILE_SKIP_EMPTY_LINES)` + `array_flip` una vez por petición (carga perezosa, solo en endpoints que fijan clave; ~150 KB); búsqueda O(1). Si el archivo no existe o tiene < 10 000 líneas → `RuntimeException` (500): nunca se acepta una clave sin lista. | No |
| D-11 | Límite de solicitudes de recuperación | A solo 3/hora · B 3/hora y 10/24 h | **B** | Con 3/hora × 5 intentos, un atacante persistente acierta ~12 %/año de un código. Con 10/24 h baja a ~1,8 %/año. Más estricto que B-04, que fija un máximo. | No |
| D-12 | Superar el límite de solicitudes | A 429 · B misma respuesta 200 sin enviar | **B** | Un 429 solo aparecería para correos existentes (enumeración). | No |
| D-13 | Campos permitidos por endpoint | A ignorar extras · B rechazar extras | **B** (400 `Solicitud inválida`) | C-06. Listas: `solicitarRecuperacion` [correo]; `restablecerClave` [correo, codigo, claveNueva]; `actualizarClave` [id, claveActual, claveNueva]; `persona/agregar` [cedula, nombres, apellidos, correo, telefono, usuario, clave]; `persona/actualizarDeApp` [id, nombres, apellidos, telefono]. `id` solo se admite para el chequeo de C-01. | No |
| D-14 | Clave cruda vs. escapada | A seguir escapando (`htmlspecialchars(trim())`) · B cruda, con verificación legado | **B** | Escapar o recortar una clave altera su valor y su longitud. `HashClaves::verificar` prueba la cruda y, si falla y la escapada es distinta, la escapada (hashes de `PersonaMdl.php:62` y `ValidacionMdl.php:58`). Requiere IR-11 (HLT-03 verifica la clave cruda en `autenticar`). | No |
| D-15 | Fuerza bruta de `claveActual` | A solo el límite general (300/min) · B contar `LOGIN_FALLIDO` del usuario en 15 min | **B** (≥ 5 → 429, `Retry-After: 900`) | Con un token robado, 300/min son 18 000 intentos/hora. Usa la auditoría de HLT-03 (IR-04) sin tablas nuevas y comparte cubo con el login (A-06: 5 fallos/15 min). | No |
| D-16 | Código de error de `claveActual` incorrecta | A 401 · B 403 · C 400 | **C** | Un 401 haría que el interceptor de HLT-07 trate la sesión como expirada. 403 tiene mensaje fijo `Acceso denegado` (§4.5). | No |
| D-17 | Igualar tiempos de `solicitarRecuperacion` | A tiempo mínimo · B responder antes y trabajar después (`flush`) · C cola de correos con cron | **A**: 2000 ms + `random_int(0, 250)` ms; un hash Argon2id en ambos caminos; `Timeout` SMTP = 5 s | B depende de `mod_php`/compresión del hosting (no determinista). C no está en el plan maestro y retrasa el código. Riesgo residual (SMTP > 2 s) en H6. | No |
| D-18 | Igualar tiempos de `restablecerClave` | A sin igualar · B `password_verify` contra `HASH_FICTICIO` en el camino sin código | **B** | Un Argon2id en todos los caminos de fallo. `HASH_FICTICIO` es una constante generada con `C:\xampp\php\php.exe -r "echo password_hash('000000', PASSWORD_ARGON2ID, ['memory_cost'=>65536,'time_cost'=>4,'threads'=>1]);"`. | No |
| D-19 | Orden de validaciones de `restablecerClave` | A política completa antes del código · B sin usuario antes, con usuario después | **B** | Decir "igual al usuario" antes de verificar el código revelaría que el correo existe y su usuario. | No |
| D-20 | Carrera en intentos y en el uso del código | A leer y luego escribir · B `UPDATE` condicional atómico | **B** | `consumirIntento`: `UPDATE ... SET rec_intentos = rec_intentos + 1 WHERE rec_idRecuperacion = ? AND rec_situacion = 'A' AND rec_fechaExpira > NOW() AND rec_intentos < 5`; 0 filas = sin intento. Uso: `UPDATE ... SET rec_situacion = 'U' WHERE ... AND rec_situacion = 'A'` dentro de la transacción; 0 filas = rollback. | No |
| D-21 | Serialización de solicitudes por usuario | A sin bloqueo · B `SELECT usu_idUsuario FROM sgen_usuario WHERE usu_idUsuario = ? FOR UPDATE` al inicio de la transacción | **B** | Evita que 4 peticiones simultáneas superen 3/hora. | No |
| D-22 | Unicidad de `per_correo` | A índice `UNIQUE` · B índice normal + `FOR UPDATE` en el registro + recuperación solo si hay 1 coincidencia | **B** | El esquema no es único (`sist_generico.sql:36`) y un `UNIQUE` fallaría con datos duplicados en otros ambientes. El índice permite el bloqueo de hueco en el registro. Si hay > 1 cuenta activa con el correo, la recuperación no envía nada (fallo cerrado) y lo registra en el log. | No |
| D-23 | Usuarios que pueden recuperar | A `A` y `P` · B solo `A` | **B** | Igual que el login (`ValidacionMdl.php:20`). Suspendidos y pendientes reciben la misma respuesta sin correo. | No |
| D-24 | Script SQL idempotente y portable | A `CREATE INDEX IF NOT EXISTS` · B consulta a `information_schema` + `PREPARE` | **B** | MariaDB 10.4 (local, verificado) admite A, pero MySQL 8 no; el hosting está por definir (DH-11). | No |
| D-25 | Plantillas de correo | A archivos `.txt` · B clase `PlantillasCorreo` | **B** | Texto plano en español, testeable con `php -r`, sin lectura de archivos ni motor de plantillas. Cada método devuelve `['asunto' => string, 'cuerpo' => string]`. | No |
| D-26 | Deduplicación de la alerta | A tabla nueva · B archivo marca en `RUTA_LOGS` | **B** | `RUTA_LOGS/alerta_seguridad.marca` con el timestamp Unix del último envío. Sin esquema nuevo. | No |
| D-27 | Interpretación de "> 10 eventos" | A cada tipo por separado · B suma de los tres | **B** | Más conservadora (alerta antes). El correo detalla el conteo por tipo. | No |
| D-28 | Chequeo de C-01 | A cada método lo escribe · B helper `BaseCtrl::exigirIdDeSesion(array $datos): void` | **B**, salvo que T-01 encuentre un helper de HLT-03 con la misma semántica: se reutiliza (RD-2) y T-10 queda `OMITIDA` | Un solo punto para el 403 + `ACCESO_DENEGADO`. | No |
| D-29 | Eliminación de código muerto de `/persona` | A dejarlo · B eliminar `PersonaCtrl::obtenerPersonaPorCorreo` (`PersonaCtrl.php:155-200`), `PersonaMdl::obtenerPersonaPorCorreo` (`PersonaMdl.php:160-164`, `SELECT *`), `eliminarPersona`, `eliminarUsuario` (`:136-151`) y `verificarDuplicados` (`:113-129`) | **B** | Sin uso; el primero expone datos personales con `SELECT *` (C-04). La transacción reemplaza la reversión manual. | No |
| D-30 | Código HTTP de éxito del registro | A 201 · B 200 | **B** | `respuestaExitosaSimple` solo emite 200 (`BaseCtrl.php:58-64`); menor superficie. | No |
| D-31 | Versión de PHPMailer | A `^6.x` · B `7.1.1` exacta | **B** | Última estable en Packagist (2026-05-18), fijada exacta con `composer require phpmailer/phpmailer:7.1.1`. | No |
| D-32 | Ocultar versión en el correo | A cabecera `X-Mailer` por defecto · B `$correo->XMailer = ' '` | **B** | No revela la versión de la librería (C-08). | No |
| D-33 | Usuario `id` 404 en `actualizarDeApp` | A 500 actual (`PersonaCtrl.php:59-61`) · B 404 | **B** `No se encontró el usuario o no está activo` | 0 filas no es un error interno. | No |
| D-34 | Default de acción desconocida en `ValidacionRts` (POST/PUT) | A 400 actual (`ValidacionRts.php:122-125`, `:157-160`) · B 404 | **B** `{"error":"Recurso no encontrado"}` si tras HLT-02 sigue en 400 | §4.5 exige 404 para `generarCodigo`/`obtenerCodigo`. | No |

### 5.2 Interfaz requerida de HLT-01, HLT-02 y HLT-03 (IR)

Los HLT-01 a HLT-03 no estaban redactados al cerrar este HLT. Lo que sigue es la interfaz que HLT-06 consume. Los nombres de §4.2 del plan maestro son obligatorios. **Regla de mapeo (cerrada):** en T-01, si HLT-03 implementó una capacidad con otro nombre pero **igual semántica** (mismos parámetros y efecto), el implementador usa ese nombre y anota el mapeo en la ficha de T-01 como desviación registrada. Si la capacidad no existe o su semántica difiere, T-01 pasa a `BLOQUEADA` y el planificador emite `HLT-06-...-v2`. El implementador no diseña sustitutos.

| ID | Capacidad requerida | Nombre esperado | Origen |
|----|---------------------|-----------------|--------|
| IR-01 | Lectura de configuración y claves de §4.1 presentes en `.env` y `.env.ejemplo`: `APP_ENTORNO`, `RUTA_LOGS`, `CORREO_MODO`, `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_CIFRADO`, `CORREO_REMITENTE`, `CORREO_REMITENTE_NOMBRE`, `CORREO_ALERTAS`, `RUTA_CLAVES_COMUNES` | `Configuracion::obtener(string): string`, `obtenerEntero`, `obtenerBooleano`, `esProduccion()` | HLT-01 (§4.2) |
| IR-02 | Transacciones y excepciones de mysqli; filas afectadas | `Enlace::iniciarTransaccion()`, `confirmarTransaccion()`, `revertirTransaccion()`; `mysqli_report(MYSQLI_REPORT_ERROR \| MYSQLI_REPORT_STRICT)`; `ejecutarActualizacion` devuelve filas afectadas (`enlace.php:103-129`) | HLT-01 (§4.2) |
| IR-03 | Usuario y sesión de la petición | `ContextoSesion::idUsuario(): int`, `ContextoSesion::idSesion(): int` | HLT-03 (§4.2) |
| IR-04 | Registrar evento de auditoría y columnas de `sgen_auditoria` para tipo de evento, id de usuario y fecha | `RegistroAuditoria::registrar(string $tipoEvento, ?int $idUsuario): void`; columnas `aud_tipoEvento`, `aud_usuId`, `aud_fecha` | HLT-03 |
| IR-05 | Revocar sesiones de un usuario dentro de la conexión de `ClaveMdl` | La sentencia `UPDATE sgen_sesion …` que usa `cerrarTodas` (columnas de usuario, id de sesión y marca de revocación con prefijo `ses_`). `ClaveMdl` la copia; "las demás" agrega `AND <id de sesión> <> ?`. | HLT-03 |
| IR-06 | IP real del cliente | `ClienteIp::obtener(): string` | HLT-03 (§4.2) |
| IR-07 | Arranque de `index.php` | `vendor/autoload.php` cargado; `RUTAS_PUBLICAS` contiene `autenticacion/solicitarRecuperacion`, `autenticacion/restablecerClave` y `persona/agregar`; `ValidadorSesion::exigir()` antes de la ruta para el resto | HLT-02, HLT-03 (§4.3, §4.5) |
| IR-08 | Script de mantenimiento de D-03 | Ruta del script (por ejemplo `rest_usuario/mantenimiento/mantenimiento.php`), que carga `vendor/autoload.php` y `Configuracion`, y su comando de ejecución local | HLT-03 |
| IR-09 | Composer en `rest_usuario` | `composer.json` y `composer.lock` con `vlucas/phpdotenv`; `vendor/` en `.gitignore` | HLT-01 |
| IR-10 | Límite general de endpoints públicos | `LimitadorPeticiones::controlar()` en el paso 9 de §4.3 (60/min por IP en públicos → 429 + `Retry-After`) | HLT-03 |
| IR-11 | Login con clave cruda | `autenticar` verifica la clave recibida **sin** `limpiarDatos` (hoy sí lo hace: `ValidacionCtrl.php:23-25`) y con fallback legado equivalente a D-14 | HLT-03 |

### 5.3 Esquema de `sgen_recuperacion` (cerrado)

```sql
CREATE TABLE IF NOT EXISTS `sgen_recuperacion` (
  `rec_idRecuperacion` int(11) NOT NULL AUTO_INCREMENT,
  `rec_usuId` int(11) NOT NULL COMMENT 'sgen_usuario.usu_idUsuario',
  `rec_codigoHash` varchar(255) NOT NULL COMMENT 'Argon2id del código de 6 dígitos; nunca el código',
  `rec_fechaCrea` datetime NOT NULL DEFAULT current_timestamp(),
  `rec_fechaExpira` datetime NOT NULL COMMENT 'rec_fechaCrea + 15 minutos',
  `rec_intentos` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Máximo 5',
  `rec_situacion` char(1) NOT NULL DEFAULT 'A' COMMENT 'A Activo\r\nU Usado\r\nR Reemplazado',
  `rec_fechaUso` datetime DEFAULT NULL,
  `rec_ipSolicitud` varchar(45) NOT NULL,
  `rec_agenteSolicitud` varchar(255) DEFAULT NULL,
  `rec_ipUso` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`rec_idRecuperacion`),
  KEY `idx_rec_usuario_fecha` (`rec_usuId`, `rec_fechaCrea`),
  KEY `idx_rec_expira` (`rec_fechaExpira`),
  CONSTRAINT `sgen_usuario_sgen_recuperacion_fk` FOREIGN KEY (`rec_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

Más el índice `idx_per_correo` sobre `sgen_persona(per_correo)` creado con el patrón de D-24. Todas las fechas se calculan en MySQL con `NOW()` (`rec_fechaExpira = NOW() + INTERVAL 15 MINUTE`), nunca en PHP, para no mezclar zonas horarias.

### 5.4 Firmas cerradas

| Archivo | Firma | Comportamiento |
|---------|-------|----------------|
| `servicios/HashClaves.php` | `final class HashClaves` · `const OPCIONES = ['memory_cost' => 65536, 'time_cost' => 4, 'threads' => 1]` · `const HASH_FICTICIO = '<D-18>'` · `public static function hashear(string $valor): string` · `public static function verificar(string $clave, string $hash): bool` | `hashear` = `password_hash($valor, PASSWORD_ARGON2ID, self::OPCIONES)`. `verificar` = D-14. |
| `servicios/PoliticaClaves.php` | `final class PoliticaClaves` · `const LONGITUD_MINIMA = 10` · `const LONGITUD_MAXIMA = 128` · `const ENTRADAS_MINIMAS_LISTA = 10000` · `public static function validar(string $clave, string $usuario, string $correo): ?string` | Devuelve `null` o el mensaje de RN-01, RN-02 o RN-03 en ese orden. Si `$usuario === ''` omite la comparación con el usuario. La lista se carga una vez por proceso en `private static ?array $clavesComunes`. |
| `servicios/PlantillasCorreo.php` | `final class PlantillasCorreo` · `codigoRecuperacion(string $nombres, string $codigo): array` · `avisoCambioClave(string $nombres, string $fechaHora): array` · `alertaSeguridad(array $conteos, string $entorno): array` | Textos de 5.5. `$nombres` pasa por `html_entity_decode(..., ENT_QUOTES, 'UTF-8')` (se guardó escapado). |
| `servicios/EnviadorCorreo.php` | `final class EnviadorCorreo` · `const TIEMPO_ESPERA_SMTP_SEGUNDOS = 5` · `const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1']` · `public function enviar(string $destinatario, array $plantilla): void` | Lanza excepción si falla. `$destinatario` pasa por `html_entity_decode` y debe pasar `PHPMailer::validateAddress` y no contener `\r`/`\n`. Modo `log`: agrega a `RUTA_LOGS/correos.log` con `FILE_APPEND \| LOCK_EX` un bloque `=== <fecha ISO> ===\nPara: …\nAsunto: …\n\n<cuerpo>\n`. Modo `smtp`: `isSMTP()`, `Host`, `Port`, `SMTPAuth = SMTP_USUARIO !== ''`, `SMTPSecure` según `SMTP_CIFRADO` (`tls` → `ENCRYPTION_STARTTLS`, `ssl` → `ENCRYPTION_SMTPS`, `ninguno` → `''` y `SMTPAutoTLS = false`), `Timeout = 5`, `CharSet = 'UTF-8'`, `isHTML(false)`, `XMailer = ' '`, `setFrom(CORREO_REMITENTE, CORREO_REMITENTE_NOMBRE)`, `addAddress($destinatario)` sin nombre. Guardas de RN-23. |
| `servicios/AlertasSeguridad.php` | `final class AlertasSeguridad` · `const EVENTOS_VIGILADOS = ['REFRESH_REUTILIZADO', 'BLOQUEO_IP', 'ACCESO_DENEGADO']` · `const UMBRAL = 10` · `const SEGUNDOS_ENTRE_ALERTAS = 3600` · `public function evaluarYNotificar(): string` | Flujo F. Devuelve la línea de estado. |
| `modelos/AlertasSeguridadMdl.php` | `contarEventosUltimaHora(array $tipos): array` · `eliminarRecuperacionesAntiguas(): int` | `SELECT aud_tipoEvento, COUNT(*) … WHERE aud_tipoEvento IN (?, ?, ?) AND aud_fecha >= NOW() - INTERVAL 60 MINUTE GROUP BY aud_tipoEvento` (3 placeholders fijos); `DELETE FROM sgen_recuperacion WHERE rec_fechaCrea < NOW() - INTERVAL 7 DAY`. |
| `modelos/ClaveMdl.php` | `const MAXIMO_SOLICITUDES_HORA = 3` · `const MAXIMO_SOLICITUDES_DIA = 10` · `const MAXIMO_INTENTOS = 5` · `const MINUTOS_VIGENCIA = 15` · `buscarUsuarioPorCorreo(string $correo): array` · `registrarSolicitud(int $idUsuario, string $hashCodigo, string $ip, ?string $agente): bool` · `obtenerCodigoActivo(int $idUsuario): ?array` · `consumirIntento(int $idRecuperacion): bool` · `restablecerClave(int $idUsuario, int $idRecuperacion, string $hashClave, string $ip): bool` · `obtenerUsuarioParaCambio(int $idUsuario): ?array` · `cambiarClave(int $idUsuario, int $idSesionActual, string $hashClave): void` · `contarFallosRecientes(int $idUsuario, int $minutos): int` | SQL de H3/D-20/D-21. Columnas explícitas; nunca `SELECT *`. Las transacciones usan `try { … confirmarTransaccion } catch (Throwable $error) { revertirTransaccion; throw $error; }`. |
| `modelos/PersonaMdl.php` | `const REGISTRO_CREADO = 'CREADO'` · `const REGISTRO_CORREO_EXISTENTE = 'CORREO_EXISTENTE'` · `const REGISTRO_USUARIO_O_TELEFONO_DUPLICADO = 'USUARIO_O_TELEFONO_DUPLICADO'` · `registrarPersona(?string $cedula, string $nombres, string $apellidos, string $correo, string $telefono, string $usuario, string $hashClave): string` · `actualizarPersonaNombresTelf(int $idUsuario, string $nombres, string $apellidos, string $telefono): int` | Flujo D, paso 5. Recibe el hash, no la clave. |
| `controladores/BaseCtrl.php` | `protected function exigirIdDeSesion(array $datos): void` | Si `array_key_exists('id', $datos)` y `filter_var($datos['id'], FILTER_VALIDATE_INT) !== ContextoSesion::idUsuario()` → `RegistroAuditoria` `ACCESO_DENEGADO` + `respuestaErrorSimple('Acceso denegado', 403)`. |
| `controladores/ClaveCtrl.php` | `const TIEMPO_MINIMO_SOLICITUD_MS = 2000` · `const VARIACION_MAXIMA_MS = 250` · `solicitarRecuperacion(array $datos): void` · `restablecerClave(array $datos): void` · `actualizarClave(array $datos): void` | Flujos A, B y C. |

### 5.5 Textos cerrados

| Uso | Texto |
|-----|-------|
| Asunto código | `Código para restablecer tu clave - Criterio Kelly` |
| Cuerpo código | `Hola {nombres}:\n\nTu código para restablecer la clave es: {codigo}\n\nVence en 15 minutos y solo se puede usar una vez. Si no lo solicitaste, ignora este correo: tu clave no ha cambiado.\n\nEste es un mensaje automático, no respondas a este correo.` |
| Asunto aviso | `Tu clave fue cambiada - Criterio Kelly` |
| Cuerpo aviso | `Hola {nombres}:\n\nLa clave de tu cuenta se cambió el {fechaHora} (hora del servidor) y se cerraron tus otras sesiones abiertas.\n\nSi no fuiste tú, solicita de inmediato un código de recuperación desde la app y avisa al administrador.\n\nEste es un mensaje automático, no respondas a este correo.` |
| Asunto alerta | `Alerta de seguridad ({entorno}) - Criterio Kelly` |
| Cuerpo alerta | `En los últimos 60 minutos se registraron {total} eventos de seguridad (umbral: más de 10):\n\n- REFRESH_REUTILIZADO: {n1}\n- BLOQUEO_IP: {n2}\n- ACCESO_DENEGADO: {n3}\n\nRevisa la tabla sgen_auditoria y los logs del servidor.` |
| `{fechaHora}` | `date('Y-m-d H:i')` |

### 5.6 Cambios de contrato para HLT-08 (app)

| # | Endpoint | Antes (verificado) | Después (este HLT) | Qué debe cambiar HLT-08 |
|---|----------|--------------------|--------------------|-------------------------|
| CC-HLT08-1 | `POST persona/agregar` | 200 `{ idUsuario }`; 409 `El usuario, correo o teléfono ya están en uso.` (`PersonaCtrl.php:128-130`, `:147`); clave ≥ 6 (`:107`) | 200 `{ mensaje }` (cuenta creada **o** correo existente); 409 `El nombre de usuario o el teléfono ya están registrados`; 400 de política; 429 | `RespuestaRegistro` (`Persona.modelo.ts:11-13`) pasa a `{ mensaje: string }`; `registroExitoso` (`personaStore.ts:33`) deja de depender de `idUsuario`; `registro.page.ts:81-89` deja de llamar `_registrarPlanSuscrito(idUsuario)` (`:227-251`) con el id del registro (ver Q-01); `minLength(6)` (`registro.page.ts:187`) → validador de política de 10 a 128. `personaStore.ts:46-51` puede conservar su mensaje fijo porque el interceptor ya muestra el del servidor. |
| CC-HLT08-2 | `PUT autenticacion/actualizarClave` | Cuerpo `{ id, usuario, clave }` (`Perfil.modelo.ts:16-20`, `perfil.page.ts:205-214`) | Cuerpo `{ claveActual, claveNueva }` con token. Enviar `usuario` → 400 `Solicitud inválida`; `id` distinto → 403. Errores 400 `La clave actual no es correcta`, política; 429 con `Retry-After`. La sesión actual sigue válida. | `CambiarClaveRequest` → `{ claveActual: string; claveNueva: string }`; el formulario pide la clave actual en lugar del usuario (G-07); `MIN_LENGTH_CLAVE: 6` (`Perfil.modelo.ts:32`) → política B-02. |
| CC-HLT08-3 | `PUT persona/actualizarDeApp` | Cuerpo `{ id, nombres, apellidos, telefono }` (`Perfil.modelo.ts:1-6`, `perfil.page.ts:196`) | Cuerpo `{ nombres, apellidos, telefono }`; `id` opcional y, si difiere de la sesión, 403. Respuesta igual: `{ id_usuario, nombres, apellidos, telefono }`. 0 filas → 404. | Quitar `id` de `ActualizarPerfilRequest` (HLT-07 "sin ids de usuario"). |
| CC-HLT08-4 | `POST autenticacion/solicitarRecuperacion` (nuevo) | — | `{ correo }` → 200 `{ mensaje }` siempre (≈ 2 s); 400 `El correo no es válido`; 429 | Pantalla de recuperación (G-07): muestra el `mensaje` y pasa al paso del código. |
| CC-HLT08-5 | `POST autenticacion/restablecerClave` (nuevo) | — | `{ correo, codigo, claveNueva }` → 200 `{ success: 'ok' }`; 400 `Código inválido o vencido`, `El código debe tener 6 dígitos` o de política | Tras 200, limpiar sesión local y navegar al login (todas las sesiones quedaron revocadas). |
| CC-HLT08-6 | `generarCodigo`, `obtenerCodigo` | Existían | 404 con token, 401 sin token | Ninguno: la app no los usa (búsqueda en `criterioKellyApp/src` sin resultados). |

---

## H6. Revisión del requerimiento por parte de un senior

### 6.1 Ronda 1 (adversarial) — veredicto: APROBADO CON CAMBIOS

| # | Ataque / hallazgo | Cambio obligatorio | Aplicado en |
|---|-------------------|--------------------|-------------|
| R1-1 | **Enumeración por tiempo** en `solicitarRecuperacion`: el camino del correo existente hace hash + inserción + SMTP; el inexistente no hace nada. | Hash Argon2id en ambos caminos + tiempo mínimo de 2000 ms con variación aleatoria + `Timeout` SMTP de 5 s. | D-17, Flujo A, P-02 |
| R1-2 | **Enumeración por código HTTP**: responder 429 al superar 3/hora solo pasa con correos existentes. | Límite silencioso (200 igual). | D-12, RN-10 |
| R1-3 | **Enumeración por mensaje** en `restablecerClave`: la política "igual al usuario" antes de validar el código revela la cuenta. | Validación en dos fases. | D-19, Flujo B |
| R1-4 | **Enumeración en el registro**: 409 con usuario y teléfono nuevos confirma el correo. | Respuesta 200 idéntica para correo existente, sin crear nada. | D-05, RN-17 |
| R1-5 | **Condición de carrera en intentos**: leer `rec_intentos` y luego escribir permite > 5 intentos en paralelo. | `UPDATE` condicional atómico antes de comparar. | D-20, P-21 |
| R1-6 | **Reutilización del código** con dos peticiones simultáneas. | Marca `U` condicional dentro de la transacción; 0 filas = rollback. | D-20, P-20 |
| R1-7 | **Fuerza bruta distribuida por IP**: el límite por IP no protege un código; un atacante rota IP. | Límites por código (5) y por usuario (3/h, 10/24 h), independientes de la IP. | RN-10, RN-11, D-11 |
| R1-8 | **Ataque fuera de línea** si se filtra la BD: SHA-256 de 6 dígitos es trivial. | Argon2id para el código. | D-04 |
| R1-9 | **Inyección de cabeceras de correo**: correo con `\r\n` o nombre en la cabecera `To`. | `FILTER_VALIDATE_EMAIL` en la entrada, `validateAddress` + rechazo de CR/LF al enviar, `addAddress` sin nombre, asuntos fijos. | RN-24, P-16 |
| R1-10 | **Envenenamiento de Host**: enlaces de recuperación construidos con `HTTP_HOST`. | Correos sin enlaces ni datos de la petición; solo código. | RN-24, P-17 |
| R1-11 | **Bombardeo de correo** usando el registro con el correo de la víctima. | El registro no envía correos. | D-07 |
| R1-12 | **Fuerza bruta de `claveActual`** con un token robado (300/min). | Contar `LOGIN_FALLIDO` del usuario en 15 min → 429. | D-15, P-09 |
| R1-13 | **Clave alterada por `htmlspecialchars`/`trim`** en el código actual: rompe longitudes y claves con `&<'`. | Clave cruda con verificación legado; IR-11 coordina el login. | D-14, P-09e |
| R1-14 | **Registro no atómico** con reversión manual y fuga de `getMessage()` en la respuesta (`PersonaMdl.php:92-102` devuelve `"Error al generar el registro: " . $e->getMessage()`, que `PersonaCtrl.php:143-147` responde como `idUsuario`). | Transacción y constantes de resultado; el controlador nunca recibe texto de excepción. | T-17, T-18, RN-19, RN-26 |
| R1-15 | **Correo en local** podía salir por un SMTP real si alguien configura `smtp` con un host externo. | Guarda de host loopback en `EnviadorCorreo`. | RN-23, T-09 |
| R1-16 | La lista `10k-most-common.txt` solo aporta 51 claves de ≥ 10 caracteres. | Lista derivada de ≥ 10 caracteres, fijada por etiqueta, commit y hash. | D-08 |

### 6.2 Ronda 2 — checklist senior

| # | Ítem | Estado | Nota |
|---|------|--------|------|
| 1 | Entendimiento | ✅ | H1 cubre los 9 puntos del requerimiento literal; la cobertura está en H4. |
| 2 | Reglas de negocio | ✅ | RN-01 a RN-27 son condiciones comprobables con `curl`, SQL o `grep`; no se contradicen (RN-07 y RN-12 separan formato de existencia). |
| 3 | Impacto | ✅ | Archivos: `ValidacionRts/Ctrl/Mdl`, `PersonaCtrl/Mdl`, `BaseCtrl`, script de mantenimiento, `composer.*`, 5 clases nuevas, 2 modelos nuevos, SQL, lista, README, copia SQL en la app. Efectos colaterales: la app queda incompatible en registro y cambio de clave hasta HLT-08 (dentro de la ventana de transición aceptada en §2 del plan maestro). Sin contradicción con §4: usa las claves de §4.1, la tabla y el script de §4.4 y el contrato de §4.5 tal cual. |
| 4 | Consistencia arquitectónica | ✅ | Capas Rts → Ctrl → Mdl → `Enlace`; SQL solo en modelos; respuestas por `BaseCtrl`; sin tocar clases compartidas de §4.2 (sus hashes no cambian). Las reglas Angular de §0.5 no aplican: la única tarea de la app copia un archivo. |
| 5 | Riesgos | ✅ | Tabla 6.3. |
| 6 | Simplicidad | ✅ | Sin tablas extra (límites sobre `sgen_recuperacion`, fallos sobre la auditoría, marca en archivo). Se descartaron cola de correos, HMAC con secreto y tabla de alertas. |
| 7 | Seguridad | ✅ | Ataques de la ronda 1 cerrados. No toca PIN, guardas ni inactividad de la app. |
| 8 | Cobertura | ✅ | Matriz H4 al 100 %. |
| 9 | Determinismo | ✅ | Firmas, SQL, textos, constantes, comandos y hash de la lista cerrados. Las dependencias de HLT-03 se resuelven con la regla de mapeo de IR (sustitución de nombre o bloqueo), sin decisiones del implementador. |
| 10 | Ejecutabilidad por agente | ✅ | Cada tarea declara archivos, dependencias y un criterio con comando. T-01 bloquea la ejecución si falta la interfaz. |

### 6.3 Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| HLT-03 se redacta en paralelo y puede exponer nombres o columnas distintos a IR-03 a IR-08, o seguir escapando la clave en el login (IR-11). | **Alta** | T-01 verifica cada IR con `grep` antes de tocar código. Nombre distinto con igual semántica → mapeo registrado; capacidad ausente → `BLOQUEADA` y v2 del HLT. Se pide al orquestador que HLT-03 adopte los nombres de IR. |
| El registro de la app deja de crear la suscripción (no recibe `idUsuario`) y además `suscripcion/crearSinPago` exigirá token desde HLT-05, con usuarios en `P` que no pueden iniciar sesión. | **Alta** | Pregunta Q-01 al usuario/plan maestro. No bloquea HLT-06: cualquier respuesta es compatible con D-05 (la opción recomendada solo **agrega** un campo opcional). Bloquea la parte de registro de HLT-08. |
| SMTP de producción lento (> 2 s) reabre la enumeración por tiempo. | Media | `Timeout` de 5 s; HLT-11 mide la latencia SMTP en staging y, si supera 1,5 s, sube `TIEMPO_MINIMO_SOLICITUD_MS` mediante un nuevo HLT. |
| Enumeración de teléfonos y nombres de usuario por el 409 del registro. | Media | Fuera de B-07 (que protege correos). Límite de 60/min por IP. Q-02 para decidir si se quita la unicidad del teléfono. |
| Argon2id con 64 MB por operación bajo concurrencia en un hosting compartido. | Media | 1 hash por petición en estos endpoints; límite público de 60/min por IP. HLT-11 valida `memory_limit` y RAM del plan (DH-11). |
| Un atacante persistente con 10 códigos/día y 5 intentos tiene ~1,8 %/año de acertar un código; cada intento envía un correo a la víctima. | Baja | Aviso implícito al dueño del correo; auditoría `RECUPERACION_SOLICITADA`; código de un solo uso. |
| Con `CORREO_MODO=log` el código queda en claro en `logs/correos.log`. | Baja | Solo válido con `APP_ENTORNO=local` (§4.1 y guarda de `EnviadorCorreo`); `logs/` bloqueado por E-02 y fuera del paquete (E-03). |
| Carrera por teléfono duplicado (sin índice ni bloqueo). | Baja | Aceptado: dos registros simultáneos con el mismo teléfono son improbables y no afectan la seguridad. |

### 6.4 Preguntas al usuario (no bloquean HLT-06)

| ID | Pregunta | Opciones e impacto | Recomendación |
|----|----------|--------------------|---------------|
| Q-01 | ¿Cómo se crea la suscripción del plan elegido en el registro, si `persona/agregar` ya no devuelve `idUsuario` (B-07) y `crearSinPago` exigirá token (A-07) para un usuario que nace en `P` y no puede iniciar sesión? | **A.** `persona/agregar` acepta `idPlanIntervalo` opcional y crea la suscripción pendiente en la misma transacción (HLT-06-v2 o HLT nuevo que toca el esquema de suscripción desde `rest_usuario`; HLT-05 y HLT-08 se ajustan). Mantiene el asistente actual. · **B.** La app guarda el plan elegido y la suscripción se crea con token tras la activación y el primer login (sin cambio de backend; HLT-08 rediseña el paso). · **C.** Activar la cuenta al registrarse (`A`) y crear la suscripción tras login automático (cambia la regla de activación). | **A**: conserva el flujo de negocio actual (el administrador ve el plan elegido al activar la cuenta) sin exponer ids. Requiere actualizar el plan maestro (v2) para asignar la tarea. |
| Q-02 | ¿Debe seguir siendo único el teléfono en el registro? | **Sí** (actual, D-06): se puede enumerar teléfonos. **No**: se elimina la comprobación y el 409 queda solo para el usuario. | Mantener por ahora (RD-7) y decidir en una revisión de la HU. |

### 6.5 Contradicciones y observaciones respecto al plan maestro y la HU

1. **Registro y suscripción** (Q-01): el plan maestro no asigna a ningún HLT el flujo registro → suscripción, que se rompe con A-07 (solo `planes/disponible` es público en `rest_suscripcion`) y con B-07.
2. **Usuarios en `P`**: el registro crea usuarios `P` (`sist_generico.sql:83`, default) y el login exige `A`. En la BD local hay 11 usuarios `P` y 3 `A` (consulta de solo lectura del 2026-11-02). Ningún endpoint activa cuentas. No es contradicción, pero condiciona Q-01 y las pruebas (T-22/T-23 activan el usuario de prueba por SQL).
3. **B-04 dice "siempre responde 200"**: este HLT responde 400 cuando el correo no tiene formato válido o el cuerpo es inválido (C-06). No revela existencia; se registra como interpretación.
4. **B-04 dice "SMTP con TLS"**: en local se usa Mailpit sin cifrado (`SMTP_CIFRADO=ninguno`, permitido por §4.1 solo en `local`).
5. **D-03 "> 10 eventos"**: se interpreta como suma de los tres tipos (D-27).
6. **IR-11**: hoy `autenticar` escapa la clave (`ValidacionCtrl.php:23-25`). HLT-03 debe verificar la clave cruda con el fallback legado de D-14; si no, las claves nuevas con `&`, `<`, `>`, `"` o `'` no podrían iniciar sesión.
7. **Script de mantenimiento**: §4.4 no lo nombra; su ruta la fija HLT-03 (IR-08).

### 6.6 Veredicto final

**APROBADO.** Los 16 cambios de la ronda 1 están aplicados. El HLT es determinista: las únicas dependencias externas (IR) se verifican en T-01 con una regla cerrada de mapeo o bloqueo. Las preguntas Q-01 y Q-02 no alteran el contrato que este HLT entrega.

---

## H7. Plan de tareas

Repositorio: `rest_usuario` (git propio) salvo T-04 (`criterioKellyApp`). Rutas relativas a `C:\xampp\htdocs\criterio_kelly\`. PHP: `C:\xampp\php\php.exe` (8.2+ tras U-01). Base: `B=http://localhost/criterio_kelly/rest_usuario`. Las líneas citadas son del código al 2026-11-02; si HLT-01/02/03 las desplazaron, T-01 registra las nuevas.

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|--------|
| T-01 | desarrollador-php | Verificar precondiciones (HLT-01/02/03 `HECHA`, U-01..U-03) y la interfaz IR-01..IR-11; registrar el mapeo de nombres | Solo lectura: `rest_usuario/index.php`, `configuracion/*.php`, `controladores/ValidacionCtrl.php`, `controladores/BaseCtrl.php`, `.env`, `.env.ejemplo`, `composer.json`, script de IR-08, `anexos/seguridad_01_sesion.sql` | — | Para cada IR, `grep -n` del nombre (o del mapeado) devuelve ≥ 1 línea y la ficha anota archivo:línea; `php -v` ≥ 8.2; `php -r "var_dump(defined('PASSWORD_ARGON2ID'));"` → `bool(true)`; `.env` con `CORREO_MODO=smtp` si `curl -s -o /dev/null -w "%{http_code}" http://localhost:8025/` = 200, si no `CORREO_MODO=log`. Si falta una IR → `BLOQUEADA`. | IR |
| T-02 | desarrollador-php | Agregar `phpmailer/phpmailer` 7.1.1 con Composer | `rest_usuario/composer.json`, `rest_usuario/composer.lock` | T-01 | `composer require phpmailer/phpmailer:7.1.1 --working-dir=rest_usuario` sin error; `composer.json` contiene `"phpmailer/phpmailer": "7.1.1"`; `composer audit --working-dir=rest_usuario` → sin avisos; `vendor/` no aparece en `git status`. | RN-23, R-03 |
| T-03 | desarrollador-php | Crear y aplicar `seguridad_02_recuperacion.sql` (tabla de 5.3 + índice `idx_per_correo` con el patrón de D-24, cabecera con orden de aplicación: después de `seguridad_01_sesion.sql`) | `rest_usuario/anexos/seguridad_02_recuperacion.sql` (nuevo) | T-01 | `mysql -u root sist_criteriokelly < rest_usuario/anexos/seguridad_02_recuperacion.sql` dos veces seguidas sin error; `SHOW CREATE TABLE sgen_recuperacion` coincide con 5.3; `SHOW INDEX FROM sgen_persona WHERE Key_name='idx_per_correo'` → 1 fila. | RN-08..RN-11, F-04 |
| T-04 | desarrollador-ionic | Copiar el script SQL a los anexos de la app | `criterioKellyApp/src/assets/anexos/seguridad_02_recuperacion.sql` (nuevo) | T-03 | `sha256sum rest_usuario/anexos/seguridad_02_recuperacion.sql criterioKellyApp/src/assets/anexos/seguridad_02_recuperacion.sql` → mismo hash. | §4.4 |
| T-05 | desarrollador-php | Generar la lista de claves comunes con el comando de D-08 y su ficha de origen | `rest_usuario/configuracion/claves_comunes.txt` (nuevo), `rest_usuario/configuracion/claves_comunes.LEEME.txt` (nuevo) | T-01 | `sha256sum` = `6a661b412bd7cfa821f3b9f127fb47792908ccdd55df68fff710346b26f4c6d0`; `wc -l` = 10000; el LEEME contiene fuente, etiqueta `2026.2`, commit `145f1f45…`, comando, licencia MIT y hash; `curl -s -o /dev/null -w "%{http_code}" $B/configuracion/claves_comunes.txt` ∈ {403, 404}; `RUTA_CLAVES_COMUNES` del `.env` apunta al archivo. | RN-03, D-08, D-09 |
| T-06 | desarrollador-php | Crear `HashClaves` (5.4, D-03, D-14, D-18) | `rest_usuario/servicios/HashClaves.php` (nuevo) | T-01 | `php -l` OK; `php -r "require 'rest_usuario/servicios/HashClaves.php'; \$h=HashClaves::hashear('ClaveDePrueba#2026'); var_dump(str_starts_with(\$h,'\$argon2id\$v=19\$m=65536,t=4,p=1\$'), HashClaves::verificar('ClaveDePrueba#2026',\$h), HashClaves::verificar('a&b<c>d\"e\'fghij', password_hash(htmlspecialchars(trim('a&b<c>d\"e\'fghij'),ENT_QUOTES,'UTF-8'),PASSWORD_BCRYPT)), HashClaves::verificar('x',HashClaves::HASH_FICTICIO));"` → `true true true false`. | RN-04, RN-05 |
| T-07 | desarrollador-php | Crear `PoliticaClaves` (5.4, D-10) | `rest_usuario/servicios/PoliticaClaves.php` (nuevo) | T-05 | `php -l` OK; con `Configuracion` cargada, `validar('corta123', 'u', 'c@x.com')` → mensaje de RN-01; `validar('qwertyuiop', 'u', 'c@x.com')` → RN-03; `validar('UsuarioLargo1', 'usuariolargo1', 'c@x.com')` → RN-02; `validar('Cielo-Rojo-Montaña-77', 'usuariolargo1', 'c@x.com')` → `null`; con `RUTA_CLAVES_COMUNES` apuntando a un archivo inexistente lanza `RuntimeException`. | RN-01..RN-03 |
| T-08 | desarrollador-php | Crear `PlantillasCorreo` con los textos de 5.5 | `rest_usuario/servicios/PlantillasCorreo.php` (nuevo) | T-01 | `php -l` OK; `php -r` que imprime las 3 plantillas muestra exactamente los textos de 5.5; ningún texto contiene `http`. | RN-24, J-04 |
| T-09 | desarrollador-php | Crear `EnviadorCorreo` sobre PHPMailer (5.4) | `rest_usuario/servicios/EnviadorCorreo.php` (nuevo) | T-02, T-08 | `php -l` OK; con `CORREO_MODO=log`, un envío de prueba agrega un bloque a `RUTA_LOGS/correos.log`; con `CORREO_MODO=smtp` y Mailpit, el mensaje aparece en `curl -s http://localhost:8025/api/v1/messages`; con `SMTP_HOST=smtp.example.com` y `APP_ENTORNO=local` lanza excepción sin conectar; destinatario `a@example.com\r\nBcc: b@example.com` lanza excepción. | RN-23, RN-24 |
| T-10 | desarrollador-php | Agregar `BaseCtrl::exigirIdDeSesion` (D-28); `OMITIDA` si T-01 registró un helper equivalente de HLT-03 | `rest_usuario/controladores/BaseCtrl.php` (método nuevo tras `respuestaErrorSimple`, hoy `:74-77`) | T-01 | `php -l` OK; verificado en P-10 y P-13 (403 + fila `ACCESO_DENEGADO`). | RN-20, C-01 |
| T-11 | desarrollador-php | Crear `ClaveMdl` con las 8 funciones de 5.4 y el SQL de H3, D-20, D-21, IR-05 | `rest_usuario/modelos/ClaveMdl.php` (nuevo) | T-03 | `php -l` OK; `grep -n "SELECT \*" rest_usuario/modelos/ClaveMdl.php` → 0; `grep -c "iniciarTransaccion" rest_usuario/modelos/ClaveMdl.php` → 3 (`registrarSolicitud`, `restablecerClave`, `cambiarClave`). | RN-09..RN-15, C-05 |
| T-12 | desarrollador-php | Crear `ClaveCtrl` con `solicitarRecuperacion` (Flujo A) | `rest_usuario/controladores/ClaveCtrl.php` (nuevo) | T-06, T-09, T-11 | `php -l` OK; comportamiento verificado en P-01, P-02, P-03, P-15, P-16 (tras T-15). | RN-07, RN-08, RN-10, RN-22 |
| T-13 | desarrollador-php | Agregar `ClaveCtrl::restablecerClave` (Flujo B) | `rest_usuario/controladores/ClaveCtrl.php` | T-07, T-12 | `php -l` OK; verificado en P-04 a P-07, P-20, P-21 (tras T-15). | RN-09, RN-11..RN-13, RN-16 |
| T-14 | desarrollador-php | Agregar `ClaveCtrl::actualizarClave` (Flujo C) | `rest_usuario/controladores/ClaveCtrl.php` | T-10, T-13 | `php -l` OK; verificado en P-09 y P-10 (tras T-15). | RN-14, RN-15, RN-20 |
| T-15 | desarrollador-php | Despachar los endpoints de clave a `ClaveCtrl` y quitar `generarCodigo`/`obtenerCodigo` de las rutas | `rest_usuario/rutas/ValidacionRts.php` (`require` en `:3`; lista de salud `:50-56`; casos POST `:112-121`; default POST `:122-125`; caso PUT `:154-156`; default PUT `:157-160`) | T-14 | `php -l` OK; `POST $B/autenticacion/solicitarRecuperacion` responde 200 con el mensaje de RN-07; `POST $B/autenticacion/generarCodigo` con token → 404 `{"error":"Recurso no encontrado"}` (D-34); `PUT actualizarClave` llega a `ClaveCtrl`. | RN-06, B-03, B-04..B-06 |
| T-16 | desarrollador-php | Eliminar `generarCodigoRecuperacion`, `obtenerCodigoRecuperacion` y `actualizarClave` antiguos | `rest_usuario/controladores/ValidacionCtrl.php:78-164`, `rest_usuario/modelos/ValidacionMdl.php:38-68` | T-15 | `php -l` de ambos OK; `grep -rn "generarCodigo\|obtenerCodigo\|usu_codiorecupe\|PASSWORD_BCRYPT\|rand(" rest_usuario --include=*.php` → 0 resultados. | RN-06, B-03 |
| T-17 | desarrollador-php | Reescribir el registro de `PersonaMdl` en transacción y eliminar código muerto (D-29) | `rest_usuario/modelos/PersonaMdl.php` (`agregarPersona` `:38-104` → `registrarPersona`; `verificarDuplicados` `:113-129`; `eliminarPersona`/`eliminarUsuario` `:136-151`; `obtenerPersonaPorCorreo` `:160-164`; tipos en `actualizarPersonaNombresTelf` `:14-25`) | T-01 | `php -l` OK; `grep -n "SELECT \*\|eliminarPersona\|eliminarUsuario\|password_hash" rest_usuario/modelos/PersonaMdl.php` → 0; `grep -c "iniciarTransaccion" …` → 1. | RN-17, RN-19, C-05 |
| T-18 | desarrollador-php | Reescribir `PersonaCtrl::agregarPersona` (Flujo D, D-05, D-13) | `rest_usuario/controladores/PersonaCtrl.php:76-152` | T-06, T-07, T-17 | `php -l` OK; verificado en P-08, P-11, P-12. `grep -n "limpiarDatos" ` en el método no incluye la clave (la clave se lee de `$datos['clave']` antes de limpiar). | RN-01..RN-05, RN-17, RN-18, RN-21 |
| T-19 | desarrollador-php | Reescribir `actualizarPersonaNombresTelf` con `ContextoSesion` (Flujo E, D-33) y eliminar `obtenerPersonaPorCorreo` | `rest_usuario/controladores/PersonaCtrl.php:15-73` (incluye el bug `:71` `respuestaErrorSimple(500)`), `:155-200` | T-10, T-17 | `php -l` OK; verificado en P-13. | RN-20, RN-21, C-01, C-02 |
| T-20 | desarrollador-php | Crear `AlertasSeguridad` y `AlertasSeguridadMdl` (5.4, D-26, D-27) | `rest_usuario/servicios/AlertasSeguridad.php` (nuevo), `rest_usuario/modelos/AlertasSeguridadMdl.php` (nuevo) | T-09 | `php -l` de ambos OK; `grep -n "SELECT \*" rest_usuario/modelos/AlertasSeguridadMdl.php` → 0. | RN-25 |
| T-21 | desarrollador-php | Integrar en el script de mantenimiento la limpieza de `sgen_recuperacion` y la alerta | Script de IR-08 (ruta registrada en T-01) | T-20 | `php -l` OK; ejecutarlo a mano imprime `Alerta: sin novedades (total N)` con N ≤ 10 y termina con código 0. | RN-25, D-03 |
| T-22 | desarrollador-php | Ejecutar las pruebas de recuperación y cambio de clave (P-00 a P-07, P-09, P-10, P-14 a P-17, P-20, P-21) y pegar la salida real | Sin archivos de código; solo BD local de prueba (P-00) | T-16 | Cada prueba da exactamente el resultado esperado de la tabla 7.1. | B-03..B-06, RN-06..RN-16, RN-22..RN-24 |
| T-23 | desarrollador-php | Ejecutar las pruebas de registro, persona, límites y alertas (P-08, P-11, P-12, P-13, P-19, P-18 al final) y pegar la salida real | Sin archivos de código | T-18, T-19, T-21, T-22 | Cada prueba da exactamente el resultado esperado de la tabla 7.1. | B-02, B-07, C-01, C-02, D-03, A-06 |
| T-24 | desarrollador-php | Verificación global | Solo lectura | T-23 | `php -l` sin errores en todo `.php` tocado o creado; grep de T-16 → 0; `grep -rn "localhost\|/criterio_kelly/" rest_usuario --include=*.php` → 0 salvo en `EnviadorCorreo::HOSTS_LOCALES` (J-01: es una guarda, no una URL); chequeo de copia idéntica de §4.2 → todas las líneas `1`; `composer audit` sin avisos. | J-01, §4.2, F-06 |
| T-25 | desarrollador-php | Actualizar el README de `rest_usuario` | `rest_usuario/README.md` (tabla de `/autenticacion` `:56-61`, `/persona` `:70-87`, sección "Estado actual" `:126-130`, más secciones nuevas) | T-24 | El README documenta: endpoints de 5.6 con cuerpos y errores; eliminación de `generarCodigo`/`obtenerCodigo`; política B-02; lista de claves (origen, licencia, hash, actualización); `sgen_recuperacion` y orden de scripts; `CORREO_MODO`, Mailpit (`http://localhost:8025`) y `logs/correos.log`; comando del mantenimiento y la alerta; carpeta `servicios/`; Q-01 como limitación conocida. `grep -n "generarCodigo" rest_usuario/README.md` solo aparece en la nota de eliminación. | §5.5 del plan maestro, J-08 |

Paralelizables (RS-3): T-04 con T-05..T-11; T-05, T-06 y T-08 entre sí; T-17 con T-11..T-14.

### 7.1 Batería de pruebas `curl` (J-06)

Variables comunes en Git Bash:

```bash
B=http://localhost/criterio_kelly/rest_usuario
H=(-H "Content-Type: application/json" -H "X-Requested-With: CriterioKelly" -H "Origin: http://localhost:8100")
M="/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e"
# Código: con Mailpit → último mensaje; con log → última línea con "código".
codigo() { if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8025/)" = 200 ]; then id=$(curl -s http://localhost:8025/api/v1/messages | /c/xampp/php/php.exe -r '$j=json_decode(stream_get_contents(STDIN),true); echo $j["messages"][0]["ID"];'); curl -s http://localhost:8025/api/v1/message/$id | grep -o 'es: [0-9]\{6\}' | tail -1 | cut -c5-; else grep -o 'es: [0-9]\{6\}' rest_usuario/logs/correos.log | tail -1 | cut -c5-; fi; }
token() { curl -s "${H[@]}" -X POST $B/autenticacion/autenticar -d "{\"usuario\":\"$1\",\"clave\":\"$2\"}" | /c/xampp/php/php.exe -r 'echo json_decode(stream_get_contents(STDIN),true)["accessToken"] ?? "";'; }
```

| ID | Prueba | Comando (resumen exacto) | Resultado esperado |
|----|--------|--------------------------|--------------------|
| P-00 | Preparar usuario de prueba | `POST $B/persona/agregar` con `{"nombres":"Prueba","apellidos":"Hlt06","correo":"prueba.hlt06@example.com","telefono":"0990000006","usuario":"prueba_hlt06","clave":"Cielo-Rojo-Montaña-77"}`; luego `$M "UPDATE sgen_usuario SET usu_situacion='A' WHERE usu_usuario='prueba_hlt06'"`. Antes de P-03, P-04, P-05, P-06: `$M "DELETE r FROM sgen_recuperacion r JOIN sgen_usuario u ON u.usu_idUsuario=r.rec_usuId WHERE u.usu_usuario='prueba_hlt06'"` | 200 `{"mensaje":…}`; 1 fila actualizada |
| P-01 | Enumeración por mensaje | `curl -s -w "\n%{http_code}"` a `solicitarRecuperacion` con `prueba.hlt06@example.com` y con `no.existe.hlt06@example.com`; `diff` de ambos cuerpos | `diff` vacío; ambos 200; 2 filas nuevas `RECUPERACION_SOLICITADA` en `sgen_auditoria` (una con `aud_usuId` nulo) |
| P-02 | Enumeración por tiempo | 5 veces cada correo con `-o /dev/null -w "%{time_total}\n"` | Todos ≥ 2,0 s; diferencia entre medianas < 0,3 s |
| P-03 | Límite por correo | 4 solicitudes seguidas del correo existente | 4 respuestas 200 idénticas; `$M "SELECT COUNT(*) FROM sgen_recuperacion r JOIN sgen_usuario u ON u.usu_idUsuario=r.rec_usuId WHERE u.usu_usuario='prueba_hlt06'"` → 3; solo 3 correos nuevos con código |
| P-04 | Fuerza bruta del código | Solicitar código; obtener `C=$(codigo)`; 5 `restablecerClave` con un código distinto de `C`; 6º con `C` | 6 respuestas 400 `{"error":"Código inválido o vencido"}`; `rec_intentos` = 5; la clave no cambió (`token prueba_hlt06 'Cielo-Rojo-Montaña-77'` no vacío) |
| P-05 | Código vencido | Solicitar; `C=$(codigo)`; `$M "UPDATE sgen_recuperacion SET rec_fechaExpira = NOW() - INTERVAL 1 MINUTE WHERE rec_situacion='A'"`; restablecer con `C` | 400 `Código inválido o vencido` |
| P-06 | Código reutilizado | Solicitar; `C=$(codigo)`; restablecer con `C` y `claveNueva`=`Selva-Azul-Torrente-88`; repetir igual | 1ª: 200 `{"success":"ok"}`; 2ª: 400 `Código inválido o vencido`; `usu_clave` empieza por `$argon2id$`; fila `CLAVE_RESTABLECIDA` |
| P-07 | Sesiones revocadas al restablecer | `T1=$(token …)`, `T2=$(token …)`; restablecer (P-06 con nueva clave); `curl -H "Authorization: Bearer $T1" $B/autenticacion/usRol` y lo mismo con `T2` | Ambos 401 `{"error":"Sesión no válida o expirada"}` |
| P-08 | Política en el registro | `persona/agregar` con usuario `usuariolargo1` y claves `Corta12`, `qwertyuiop`, `UsuarioLargo1`, `prueba.hlt08@example.com` (igual al correo) | 400 con los mensajes de RN-01, RN-03, RN-02, RN-02 |
| P-09 | `actualizarClave` | Con `T=$(token …)`: (a) sin `claveActual` → 400 `El campo 'claveActual' es requerido`; (b) `claveActual` errónea → 400 `La clave actual no es correcta`; (c) `claveNueva` = `qwertyuiop` → 400 RN-03; (d) con `T2` de otra sesión, cambio correcto con `T` → 200; `usRol` con `T` → 200, con `T2` → 401; fila `CLAVE_CAMBIADA`; (e) usuario con clave `a&b<c>"d'efgh-12` registrada y activada: `actualizarClave` con esa `claveActual` → 200; (f) cuerpo con `usuario` → 400 `Solicitud inválida`; (g) 5 `claveActual` erróneas más → la siguiente 429 con `Retry-After: 900` | Lo indicado en cada caso |
| P-10 | C-01 en `actualizarClave` | Con token de `prueba_hlt06`, cuerpo con `"id": <id de otro usuario>` | 403 `{"error":"Acceso denegado"}`; fila `ACCESO_DENEGADO` |
| P-14 | Endpoints eliminados | `POST generarCodigo` y `obtenerCodigo` con y sin token | Con token 404 `{"error":"Recurso no encontrado"}`; sin token 401 |
| P-15 | Correo recibido | Revisar Mailpit (`/api/v1/messages`) o `logs/correos.log` | Hay correo de código y de aviso de cambio; `grep -c "http" ` en sus cuerpos = 0; ninguna respuesta HTTP de P-01..P-09 contiene 6 dígitos del código |
| P-16 | Inyección de cabeceras | `solicitarRecuperacion` con `"correo":"prueba.hlt06@example.com\r\nBcc: x@example.com"` (JSON con `\r\n`) | 400 `El correo no es válido`; ningún correo nuevo |
| P-17 | Host header | `solicitarRecuperacion` con `-H "Host: atacante.example"` (si Apache responde) | El cuerpo del correo es idéntico al de P-15 y no contiene `atacante` |
| P-20 | Carrera en el uso | Solicitar; `C=$(codigo)`; dos `restablecerClave` simultáneos con `C` (`… & … & wait`) | Exactamente un 200 y un 400 |
| P-21 | Carrera en intentos | Solicitar; 10 `restablecerClave` simultáneos con códigos erróneos | `rec_intentos` = 5; 10 respuestas 400 |
| P-11 | Registro con duplicados | (a) usuario `prueba_hlt06` con correo y teléfono nuevos → 409; (b) correo `prueba.hlt06@example.com` con usuario `nuevo_hlt06b` y teléfono `0990000016` → contar `sgen_persona` antes y después | (a) 409 `{"error":"El nombre de usuario o el teléfono ya están registrados"}`; (b) 200 con cuerpo idéntico (`diff`) al de P-12; conteo sin cambios |
| P-12 | Registro correcto | Usuario `nuevo_hlt06c`, correo `nuevo.hlt06c@example.com`, teléfono `0990000026`, clave `Bosque-Gris-Halcón-31` | 200 `{"mensaje":"Registro recibido. Podrás iniciar sesión cuando tu cuenta esté activa."}`; `usu_clave` empieza por `$argon2id$`; 1 fila en `sgen_rolusuario` con rol 4 |
| P-13 | `/persona/actualizarDeApp` | Con token: (a) sin `id` → 200 con `id_usuario` = id de sesión; (b) con `id` de otro usuario → 403 + `ACCESO_DENEGADO`; (c) con campo `per_estado` → 400 `Solicitud inválida`; (d) sin token → 401 | Lo indicado |
| P-19 | Alerta de seguridad | 11 peticiones de P-13 (b) → 11 `ACCESO_DENEGADO`; ejecutar el mantenimiento dos veces | 1ª: `Alerta: enviada (total ≥ 11)` y correo a `CORREO_ALERTAS` con el conteo; 2ª: `Alerta: ya enviada en la última hora`, sin correo nuevo |
| P-18 | Límite A-06 del registro | 61 `persona/agregar` con cuerpo vacío `{}` en menos de 60 s | Al menos una respuesta 429 con cabecera `Retry-After` |

---

## H8. Reglas de implementación deterministas

Las reglas son las de `.claude/agents/desarrollador-php.md`, con los overrides de este HLT.

| ID | Regla | Fuente |
|----|-------|--------|
| RI-1 | **Capas:** Rts extrae la acción y despacha; Ctrl valida, aplica reglas y responde; Mdl ejecuta SQL y devuelve datos o constantes de resultado; `servicios/` no hace SQL ni responde HTTP. | `desarrollador-php.md` "Arquitectura obligatoria" |
| RI-2 | **SQL:** solo consultas preparadas mediante `Enlace` con la cadena de tipos correcta; sin concatenar ni interpolar entrada; columnas explícitas, nunca `SELECT *`. | "Seguridad · Base de datos" |
| RI-3 | **Transacciones:** toda escritura en más de una tabla usa `iniciarTransaccion` / `confirmarTransaccion` / `revertirTransaccion` con `try/catch (Throwable)` y relanza. Sin reversiones manuales. | "Seguridad · Base de datos", C-05 |
| RI-4 | **Entrada:** lista blanca de campos (D-13), tipo `string` comprobado, longitud con `mb_strlen`, formatos con regex anclada `^…$`. `limpiarDatos` se aplica a todo **excepto** a las claves y al código. | "Seguridad · Entrada", D-14 |
| RI-5 | **Respuestas:** `respuestaExitosaSimple` / `respuestaErrorSimple` con los mensajes y códigos exactos de H2, H3 y 5.6. Nada se escribe en la salida antes. El 422 no se usa. | "Contrato de respuesta" |
| RI-6 | **Errores:** cada método público del controlador termina en `catch (Throwable $error)` con `error_log("[<Clase>::<metodo>] " . $error->getMessage())` y 500 `Error interno del servidor`; excepción: el camino del correo existente de `solicitarRecuperacion` (Flujo A, paso 6) registra y continúa. Nunca se registran claves, códigos, hashes ni correos completos. | "Errores y cabeceras", D-02 |
| RI-7 | **Secretos y aleatoriedad:** `random_int` para el código; sin `rand`/`mt_rand`; credenciales SMTP solo desde `Configuracion`. | "Autenticación…", §4.1 |
| RI-8 | **PHP 8.2:** tipos en parámetros, retornos y propiedades; `final class` para servicios; `declare(strict_types=1)` **no** se agrega (el código circundante no lo usa). Se permiten `readonly`, `match`, `str_starts_with`. | Override PHP 8.2 |
| RI-9 | **Comparaciones** estrictas (`===`, `in_array(..., true)`); constantes con nombre para todo número de negocio (5, 3, 10, 15, 2000, 250, 3600, 65536). | "Estándares de código" |
| RI-10 | **Sin efectos fuera de alcance:** una tarea solo toca los archivos de su fila. Las clases compartidas de §4.2 **no** se modifican en este HLT. | §10 RI-10 del contrato |
| RI-11 | **Commits:** solo si el usuario los pide; en español; desde `rest_usuario/` (y `criterioKellyApp/` para T-04). | §10 RI-11 |
| RI-12 | **Includes:** `require_once(__DIR__ . '/../servicios/<Clase>.php')` como el código actual; PHPMailer por el autoload de Composer (`use PHPMailer\PHPMailer\PHPMailer;`, `use PHPMailer\PHPMailer\Exception as ExcepcionCorreo;`). | Código circundante |
| RI-13 | **Fechas** de expiración, ventanas y limpieza en SQL con `NOW()`; `date()` solo para el texto `{fechaHora}`. | 5.3 |

Situaciones no cubiertas: se imita el código circundante (§10.2 del contrato); si contradice una RI, prevalece la RI y se registra.

---

## H9. Reglas de seguimiento de ejecución

Responsable: el agente de implementación de cada tarea (`desarrollador-php` o `desarrollador-ionic`). Símbolos: `⬜` no realizado, `✅` realizado y verificado, `❌` fallido, `➖` no aplica (justificar). Rigen RS-1 a RS-9 del contrato. Para backend, **C4** = `C:\xampp\php\php.exe -l` sin errores sobre cada archivo tocado; **C5** = prueba `curl` (caso feliz + al menos un error) con la respuesta real. Para T-04 (copia de un `.sql`), C4 y C5 se marcan `➖` con la justificación "archivo SQL copiado, sin código".

### 9.1 Fichas

```
T-01 — Verificar precondiciones e interfaz IR
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <mapeo IR → archivo:línea>
```

```
T-02 — Agregar phpmailer/phpmailer 7.1.1
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-03 — Crear y aplicar seguridad_02_recuperacion.sql
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-04 — Copiar el script SQL a criterioKellyApp/src/assets/anexos/
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10) y H11
    [⬜] C4. Lint sobre lo tocado
    [⬜] C5. Pruebas sobre lo tocado
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-05 — Generar la lista de claves comunes y su LEEME
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-06 — Crear HashClaves
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-07 — Crear PoliticaClaves
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-08 — Crear PlantillasCorreo
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-09 — Crear EnviadorCorreo
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-10 — Agregar BaseCtrl::exigirIdDeSesion
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-11 — Crear ClaveMdl
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-12 — Crear ClaveCtrl::solicitarRecuperacion
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-13 — Agregar ClaveCtrl::restablecerClave
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-14 — Agregar ClaveCtrl::actualizarClave
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-15 — Despachar endpoints de clave en ValidacionRts y quitar los antiguos
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-16 — Eliminar métodos obsoletos de ValidacionCtrl y ValidacionMdl
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-17 — Reescribir el registro de PersonaMdl en transacción
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-18 — Reescribir PersonaCtrl::agregarPersona
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-19 — Reescribir actualizarPersonaNombresTelf con ContextoSesion
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-20 — Crear AlertasSeguridad y AlertasSeguridadMdl
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-21 — Integrar alerta y limpieza en el script de mantenimiento
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-22 — Pruebas de recuperación y cambio de clave
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real de P-00..P-07, P-09, P-10, P-14..P-17, P-20, P-21>
  Notas / desviaciones: <si las hubo>
```

```
T-23 — Pruebas de registro, persona, límites y alertas
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real de P-08, P-11, P-12, P-13, P-19, P-18>
  Notas / desviaciones: <si las hubo>
```

```
T-24 — Verificación global
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-25 — Actualizar el README de rest_usuario
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-13) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

### 9.2 Tablero de avance global

| Tarea | Agente | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|--------|----|----|----|----|----|----|-----------|
| T-01 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-02 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-03 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-04 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-05 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-06 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-07 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-08 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-09 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-10 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-12 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-13 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-14 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-15 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-16 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-17 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-18 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-19 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-20 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-21 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-22 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-23 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-24 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-25 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

---

## H10. Diseño del reporte de ejecución

El agente de implementación entrega, al terminar, este reporte con estructura fija (RR-1 a RR-5):

```
REPORTE DE EJECUCIÓN — HLT-06 · Claves y recuperación (rest_usuario)
  1. Resumen ejecutivo         (1–3 frases)
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas         (copia de 9.2 con estado y C1…C6 de T-01…T-25)
  4. Cobertura vs. HLT         (RN-01…RN-27 y criterios B-02…B-07, C-01, C-02, D-03, J-04 → resultado; ¿100 %?)
  5. Cambios realizados        (archivo ruta:línea y tipo: creado / modificado / eliminado; repositorio)
  6. Verificaciones ejecutadas (cada comando de H7 y cada P-xx → OK/FALLO + salida real)
  7. Desviaciones y decisiones (mapeo IR de T-01; cualquier otra, con causa)
  8. Pendientes / bloqueos     (checks en ⬜/❌ con acción requerida; estado de Q-01 y Q-02)
  9. Próximos pasos            (si el estado no es COMPLETADO; recordatorio: HLT-08 aplica 5.6)
```

`COMPLETADO` solo si T-01…T-25 están `HECHA` (o T-10 `OMITIDA` con motivo registrado) con todos sus checks aplicables en `✅` y la sección 6 muestra la salida real de P-00…P-21.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

Convenciones de `.claude/agents/desarrollador-php.md` ("Nombres", "Estándares de código"), con PHP 8.2.

| Elemento | Convención | Ejemplos de este HLT |
|----------|-----------|----------------------|
| Ruta / controlador / modelo | `<Recurso>Rts.php`, `<Recurso>Ctrl` (extiende `BaseCtrl`), `<Recurso>Mdl` | `ClaveCtrl`, `ClaveMdl`, `AlertasSeguridadMdl` |
| Servicios del backend | `servicios/<Sustantivo>.php`, `final class` en PascalCase | `HashClaves`, `PoliticaClaves`, `PlantillasCorreo`, `EnviadorCorreo`, `AlertasSeguridad` |
| Métodos | verbo + objeto, camelCase | `solicitarRecuperacion`, `consumirIntento`, `registrarSolicitud`, `evaluarYNotificar` |
| Variables | sustantivo descriptivo, camelCase | `$idUsuario`, `$hashCodigo`, `$codigoActivo`, `$filasAfectadas` |
| Booleanos | prefijo `es`, `esta`, `tiene`, `existe` | `$esCodigoValido`, `$existeCorreo` |
| Constantes | UPPER_SNAKE_CASE | `MAXIMO_INTENTOS`, `TIEMPO_MINIMO_SOLICITUD_MS`, `REGISTRO_CORREO_EXISTENTE` |
| SQL | `$sql` + propósito | `$sqlConsumirIntento`, `$sqlMarcarCodigoUsado` |
| Tablas y columnas | prefijo del esquema | `sgen_recuperacion.rec_*`, índice `idx_per_correo` |
| Scripts SQL | `anexos/seguridad_NN_<tema>.sql`, idempotentes, con orden de aplicación en la cabecera | `seguridad_02_recuperacion.sql` |
| Mensajes al usuario | español, sin detalles internos | H2, H3 y 5.6 |

Reglas de código limpio: una responsabilidad por clase y método; retornos tempranos; sin código comentado, depuración ni métodos sin uso; PHPDoc solo para formas de arreglo (`@return array<int, array{usu_idUsuario:int, usu_usuario:string, per_nombres:string, per_correo:string}>`) o para explicar una regla de seguridad (por ejemplo, por qué se incrementa el intento antes de comparar). Prohibidos `$res`, `$obj`, `$aux`, `$tmp`, `$d` y números mágicos.
