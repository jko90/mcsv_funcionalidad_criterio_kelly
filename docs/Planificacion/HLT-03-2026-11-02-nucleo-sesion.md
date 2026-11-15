# HLT-03 — Núcleo de sesión: esquema, tokens opacos, autenticar/renovar/cerrar, límites, auditoría y guardia de rutas

| Campo | Valor |
|-------|-------|
| HLT | HLT-03 del [plan maestro HU-001](PLAN-MAESTRO-HU-001.md) |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Fecha | 2026-11-02 |
| Contrato | `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11) + extensiones backend de `docs/planificador.md` |
| Overrides vigentes | PHP **8.2+** (DH-09, plan maestro §5.2); Composer autorizado (§5.3), en este HLT solo se usa `vlucas/phpdotenv` ya instalado por HLT-01; los HLT viven en `docs/Planificacion/` |
| Depende de | HLT-01 (Configuracion, Enlace con transacciones, `.env`, sin `global.php`) y HLT-02 (CorsConfig, CabecerasSeguridad, ManejadorErrores, LectorSolicitud, Enrutador, `index.php` pasos 1–7). Su interfaz se verifica en la tarea puerta T-01. |
| Agentes | `desarrollador-php` (29 tareas) · `desarrollador-ionic` (1 tarea) |
| Veredicto senior | **APROBADO** (segunda iteración, ver H6) |

---

## H1. Propósito

| Campo | Contenido |
|-------|-----------|
| Requerimiento literal | "HLT-03 · Núcleo de sesión del plan maestro. Cubre HU: A-01, A-02, A-03, A-04, A-05, A-06, A-07, A-08 (ver observación O-01 del plan maestro: cumplido con TTL 15 min), A-09, B-01 (Argon2id + password_needs_rehash en el login), C-03, D-01, D-02, D-03 (solo limpieza; las alertas por correo van en HLT-06), E-07, F-04 (seguridad_01_sesion.sql). Incluye: script `rest_usuario/anexos/seguridad_01_sesion.sql` (idempotente) con sgen_sesion, sgen_intentoacceso, sgen_limitepeticion, sgen_auditoria; clases compartidas idénticas en los 4 backends: ClienteIp, ContextoSesion, ValidadorSesion, LimitadorPeticiones, RegistroAuditoria; clases propias de rest_usuario para emitir/rotar tokens y cookie de refresh; endpoints autenticar, renovar, cerrarSesion, cerrarTodas, usRol; guardia en index.php de los 4 backends (pasos 8–9 de §4.3) con RUTAS_PUBLICAS; script de mantenimiento; actualizar CLAUDE.md raíz, `.claude/agents/desarrollador-php.md` y README de rest_usuario; pruebas curl en local (caso feliz + ataques) y medición de latencia (O-03)." |
| Propósito | Que solo un trader con una sesión válida emitida por el servidor pueda usar las APIs, que la sesión se pueda revocar al instante en los 4 backends y que los intentos de fuerza bruta, el robo de tokens y los eventos de seguridad queden contenidos y registrados. |
| Resultado esperado | (1) Existen las 4 tablas de seguridad en `sist_criteriokelly`. (2) `rest_usuario /autenticacion` emite un access token opaco de 15 min y un refresh token rotativo (cookie HttpOnly en web, cuerpo en nativo), los renueva, detecta reutilización y cierra sesiones. (3) En los 4 backends, todo endpoint fuera de `RUTAS_PUBLICAS` responde 401 sin un Bearer válido, y todo endpoint responde 429 al superar los límites. (4) La auditoría registra los eventos de D-01 de este HLT sin secretos. (5) Un script CLI limpia los datos vencidos. (6) La documentación del workspace describe el nuevo modelo. |
| Fuera de alcance | Recuperación y cambio de clave, política B-02, eliminación de `generarCodigo`/`obtenerCodigo`, Argon2id en el **registro** y alertas por correo de D-03 (HLT-06). Autorización por dueño C-01/C-02 en `rest_criteriokelly` (HLT-04), `rest_suscripcion`/`rest_divisas` (HLT-05) y en `persona/*` y `actualizarClave` de `rest_usuario` (HLT-06). Cambios en la app Angular (HLT-07); la app local **deja de poder usar endpoints protegidos** hasta HLT-07 (ventana de transición aceptada, plan maestro §2). CORS, cabeceras, `.htaccess`, `LectorSolicitud` y `Enrutador` (HLT-02). Despliegue y cron real del servidor (HLT-11). Límite de sesiones simultáneas por usuario y 2FA (HU, fuera de alcance). Usuarios con `usu_situacion = 'P'` no pueden iniciar sesión hoy (`ValidacionMdl.php:20`) y siguen sin poder: no se cambia. |
| Feature(s) afectada(s) | `rest_usuario` → `/autenticacion` (`rutas/ValidacionRts.php`, `controladores/ValidacionCtrl.php`, `modelos/ValidacionMdl.php`, nuevo `modelos/SesionMdl.php`, nuevos `servicios/EmisorTokens.php` y `servicios/CanalRefresh.php`, nuevo `mantenimiento/limpiarSeguridad.php`, `anexos/seguridad_01_sesion.sql`); `configuracion/` de los 4 backends (5 clases compartidas nuevas); `index.php` de `rest_usuario`, `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas`; `criterioKellyApp/src/assets/anexos/` (copia SQL); `CLAUDE.md`, `.claude/agents/desarrollador-php.md` y README de los 4 backends. |

---

## H2. Reglas de negocio

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-01 | Los tokens son opacos y aleatorios | Access y refresh = `random_bytes(32)` en base64url sin relleno: `preg_match('/^[A-Za-z0-9_-]{43}$/')` es verdadero; no existe código que derive un token de datos del usuario | HU "Arquitectura" |
| RN-02 | En la base solo se guardan hashes | `ses_hashAcceso` y `ses_hashRefresh` = `hash('sha256', token)` (64 hex). `SELECT COUNT(*) FROM sgen_sesion WHERE ses_hashAcceso = '<token en claro>'` = 0 | HU A-01, F-04 |
| RN-03 | El access token dura `TOKEN_ACCESO_MINUTOS` (15) | `ses_accesoExpira = emisión + 15 min` y un token con `ses_accesoExpira <= ahora` responde 401 | DH-02; A-03; A-08 por O-01 |
| RN-04 | El refresh vence a los 7 días sin uso y a los 30 días como máximo | `ses_refreshExpira = min(emisión + TOKEN_REFRESH_INACTIVIDAD_DIAS, ses_familiaExpira)`; `ses_familiaExpira = inicio de familia + TOKEN_REFRESH_MAXIMO_DIAS` y no cambia al rotar | DH-02; A-04 |
| RN-05 | El refresh rota en cada uso | Tras `renovar` exitoso, la fila usada queda `ses_estado = 'R'` y existe una fila nueva `'A'` con la misma `ses_familia` y hashes distintos | A-04 |
| RN-06 | Reutilizar un refresh rotado revoca la familia | Presentar un refresh cuya fila está en `'R'` deja **todas** las filas `'A'` de la familia en `'V'` con `ses_motivoRevocacion = 'REFRESH_REUTILIZADO'`, responde 401 y audita `REFRESH_REUTILIZADO` | A-04 |
| RN-07 | Login con mensaje y tiempo uniformes | Usuario inexistente, clave incorrecta, usuario suspendido/pendiente o eliminado lógicamente → 401 `Usuario o clave incorrectos`; siempre se ejecuta exactamente un `password_verify` (contra `HASH_FICTICIO` si no hay usuario) | A-02; plan §4.5 |
| RN-08 | Solo `usu_estado = '1'` y `usu_situacion = 'A'` inician sesión o validan tokens | La consulta de validación y la de renovación exigen ambas condiciones | `ValidacionMdl.php:20` |
| RN-09 | La clave se verifica sobre la misma normalización con que se guardó | `password_verify(htmlspecialchars(trim($clave), ENT_QUOTES, 'UTF-8'), $hash)`, igual que `BaseCtrl.php:23` aplicado en `ValidacionCtrl.php:23-25` y `PersonaCtrl.php:86,133-141` | Código actual |
| RN-10 | Migración transparente a Argon2id | Tras un login exitoso con hash BCRYPT, `LEFT(usu_clave, 9) = '$argon2id'` | B-01 |
| RN-11 | Bearer solo por cabecera | Un token válido enviado por query, cuerpo o cookie, sin `Authorization: Bearer`, responde 401 en ruta protegida | A-03 |
| RN-12 | Lista blanca pública única por backend | Público ⇔ (`GET` y acción vacía) o `"recurso/acción"` ∈ `RUTAS_PUBLICAS` del `index.php` de ese backend; todo lo demás sin token → 401 | A-07; plan §4.5 |
| RN-13 | Roles siempre desde la base | `ContextoSesion::roles()` y `usRol` se leen de `sgen_rolusuario` en la petición; ningún endpoint lee roles del cliente | C-03 |
| RN-14 | `usRol` no acepta otro usuario | Si llega `id` en la query y `(string)$id !== (string)ContextoSesion::idUsuario()` → 403 `Acceso denegado` + auditoría `ACCESO_DENEGADO` | Plan §4.5; DH-04 |
| RN-15 | Límite de login por usuario | 5 fallos para el mismo usuario normalizado en 900 s → el 6.º intento responde 429 con `Retry-After` > 0, aunque la clave sea correcta | A-06 |
| RN-16 | Límite de login por IP | 20 fallos desde la misma IP en 900 s → 429 con `Retry-After` | A-06 |
| RN-17 | Límite de API | 300 peticiones/min por familia de sesión en rutas autenticadas; 60/min por IP en rutas públicas → 429 + `Retry-After` | A-06 |
| RN-18 | IP real solo de proxies confiables | `ClienteIp::obtener()` = `REMOTE_ADDR` salvo que `IP_CABECERA_CONFIABLE` tenga valor **y** `REMOTE_ADDR` ∈ `IP_PROXIES_CONFIABLES`; `X-Forwarded-For` arbitrario nunca cambia la IP registrada | A-06 |
| RN-19 | Refresh por canal | Cuerpo `refreshToken` solo si `X-Cliente: nativo` **y** `Origin` ∈ `CORS_ORIGENES_NATIVOS`; en cualquier otro caso, cookie `COOKIE_REFRESH_NOMBRE` con `HttpOnly; SameSite=Strict; Path=COOKIE_REFRESH_RUTA; Secure` según `COOKIE_REFRESH_SEGURA`, y nunca en el cuerpo | A-01 |
| RN-20 | CSRF en endpoints que leen la cookie | `renovar` y `cerrarSesion` responden 403 `Acceso denegado` si `Origin` falta o ∉ (`CORS_ORIGENES_WEB` ∪ `CORS_ORIGENES_NATIVOS`) o si `X-Requested-With` ≠ `CriterioKelly` | E-07 |
| RN-21 | El canal de una familia no cambia | Una familia creada como web (`ses_cliente = 'W'`) no se renueva desde un canal nativo ni al revés → 401 | Decisión D-12 |
| RN-22 | Cierre de sesión inmediato | Tras `cerrarSesion` (familia actual) o `cerrarTodas` (todas las del usuario), los access afectados responden 401 en los 4 backends en la siguiente petición | A-05 |
| RN-23 | IP y user agent por sesión; anomalía auditada sin cerrar | Cada fila de `sgen_sesion` guarda `ses_ip`, `ses_agenteUsuario`, `ses_navegador`; si al renovar cambia `ses_navegador` se audita `SESION_ANOMALA` y la renovación continúa | A-09 |
| RN-24 | Auditoría sin secretos | `aud_detalle` nunca contiene una secuencia `[A-Za-z0-9_-]{32,}`; `RegistroAuditoria` rechaza (excepción) eventos fuera de la lista D-01 | D-01, D-02 |
| RN-25 | Limpieza | El script CLI elimina familias vencidas, intentos > 900 s, contadores > 120 s y auditoría > 180 días; no responde por HTTP | D-03 |
| RN-26 | Escrituras multi-tabla atómicas | Login (rehash + sesión + limpieza de intentos) y renovación (rotar + insertar) ocurren dentro de una transacción de `Enlace` | C-05 |
| RN-27 | Formato de respuesta intacto | Éxito = dato directo; error = `{ "error": "…" }`; 422 no se usa | C-07; CLAUDE.md |
| RN-28 | Clases compartidas idénticas | El chequeo SHA-256 del plan maestro §4.2 imprime `1` para `ClienteIp.php`, `ContextoSesion.php`, `ValidadorSesion.php`, `LimitadorPeticiones.php`, `RegistroAuditoria.php` | Plan §4.2 |

Reglas existentes que este HLT **no puede romper**: el cálculo Kelly sigue en `rest_criteriokelly` (no se toca); el contrato JSON de los demás endpoints no cambia (solo pasan a exigir token); el 422 sigue reservado.

---

## H3. Flujo principal de ejecución

Todas las horas se calculan en PHP en UTC (`time()`, `gmdate('Y-m-d H:i:s', …)`) y se pasan como parámetro a SQL (D-09). Los mensajes son los de plan maestro §4.5.

### Flujo F · Guardia común (todas las peticiones, 4 backends)

```
[Petición HTTP] → .htaccess (HLT-02) → index.php pasos 1–7 (HLT-02)
  → Paso 8: $esPublica = ($metodo === 'GET' && $accion === '') || in_array("$recurso/$accion", RUTAS_PUBLICAS, true)
      ├─ pública → sigue sin token (ContextoSesion vacío)
      └─ protegida → ValidadorSesion::exigir()
            → lee HTTP_AUTHORIZATION (o REDIRECT_HTTP_AUTHORIZATION)
            ├─ Error 401 "Sesión no válida o expirada": falta cabecera, esquema ≠ Bearer, token ∉ /^[A-Za-z0-9_-]{43}$/
            → hash = sha256(token) → SELECT sesión+usuario por ses_hashAcceso (índice único) con ses_estado='A',
              ses_accesoExpira > ahora, ses_familiaExpira > ahora, usu_estado='1', usu_situacion='A'
            ├─ Error 401: sin fila o hash_equals(fila.hash, hash) falso
            → SELECT roles (sgen_rolusuario ⨝ sgen_rol)
            → si ahora − ses_ultimoUso ≥ 60 s: UPDATE ses_ultimoUso
            → ContextoSesion::establecer(idUsuario, roles, idSesion, familia)
  → Paso 9: LimitadorPeticiones::controlar()
            clave = sha256('S:'.familia) si autenticado (límite 300) | sha256('I:'.ip) si público (límite 60)
            → INSERT … ON DUPLICATE KEY UPDATE lip_contador+1 → SELECT lip_contador
            ├─ contador > límite: si contador = límite+1 audita LIMITE_PETICIONES;
            │    Error 429 "Demasiados intentos, intente nuevamente más tarde" + Retry-After = 60 − (ahora mod 60)
            └─ sigue
  → Paso 10: require rutas/<X>Rts.php → Ctrl → Mdl → [Respuesta]
   └─ Excepción no controlada (BD caída, SQL) → ManejadorErrores (HLT-02) → Error 500 "Error interno del servidor"
```

### Flujo A · `POST autenticacion/autenticar` (pública)

```
[App: botón Ingresar] → Guardia (pública, límite IP 60/min) → ValidacionRts → ValidacionCtrl::autenticarUsuario($cuerpo)
  1. Valida: usuario y clave presentes y string (400 con mensaje de campo), mb_strlen(usuario) ≤ 64, mb_strlen(clave) ≤ 1024 (400 "Solicitud inválida")
  2. usuarioNormalizado = mb_strtolower(trim(usuario))
  3. LimitadorPeticiones::verificarIntentoLogin(usuarioNormalizado)
       ├─ fallos usuario (900 s) ≥ 5 o fallos IP (900 s) ≥ 20 → Error 429 + Retry-After (sin insertar)
       → INSERT intento provisional (ina_usuarioHash, ina_ip, ina_fecha) → recuenta
       └─ fallos usuario > 5 o IP > 20 (carrera) → Error 429 + Retry-After
  4. fila = ValidacionMdl::buscarUsuarioParaAutenticar(htmlspecialchars(trim(usuario)))   (usu_estado='1', sin filtrar situación)
  5. hashComparar = fila ? fila.usu_clave : HASH_FICTICIO ; coincide = password_verify(claveNormalizada, hashComparar)
  6. ├─ !fila || !coincide || fila.usu_situacion !== 'A'
     │     → LimitadorPeticiones::registrarFalloLogin(usuarioNormalizado, fila?.id)  (audita LOGIN_FALLIDO;
     │        BLOQUEO_USUARIO si fallos usuario = 5; BLOQUEO_IP si fallos IP = 20)
     │     → Error 401 "Usuario o clave incorrectos"
  7. Transacción: [rehash Argon2id si password_needs_rehash] → SesionMdl::crearSesion(familia nueva) →
     LimitadorPeticiones::registrarExitoLogin(usuarioNormalizado) (borra intentos del usuario) → commit
     └─ excepción → rollback → relanza → 500
  8. RegistroAuditoria: LOGIN_OK (usuId, familia)
  9. roles = ValidacionMdl::obtenerRolesUsuarios(id)
 10. Cache-Control: no-store → CanalRefresh::entregar(respuesta, refresh, refreshExpira)
       ├─ nativo: respuesta + refreshToken
       └─ web: Set-Cookie ck_refresh=…; Expires; Max-Age; Path; HttpOnly; SameSite=Strict; [Secure]
 11. 200 { id, nombres, apellidos, roles:[{rol_id, rol_descripcion}], accessToken, accessExpira (ISO 8601 +00:00) [, refreshToken] }
```

### Flujo B · `POST autenticacion/renovar` (pública)

```
[App: arranque o 401 del interceptor] → Guardia (pública, límite IP) → ValidacionCtrl::renovarSesion($cuerpo)
  1. CanalRefresh::exigirOrigenConfiable() ── Error 403 "Acceso denegado" + ACCESO_DENEGADO (Origin ausente/no permitido o X-Requested-With ≠ CriterioKelly)
  2. refresh = CanalRefresh::leerRefresh($cuerpo)  (nativo: cuerpo.refreshToken; web: $_COOKIE)
     └─ null o formato inválido → borrar cookie (web) → Error 401 "Sesión no válida o expirada"
  3. Transacción: SesionMdl::buscarPorRefreshParaActualizar(sha256(refresh))  … FOR UPDATE
     ├─ sin fila → rollback → Error 401
     ├─ ses_estado = 'R' → SesionMdl::revocarFamilia(familia, 'REFRESH_REUTILIZADO') → commit →
     │     audita REFRESH_REUTILIZADO → borrar cookie → Error 401
     ├─ ses_estado = 'V' → rollback → borrar cookie → Error 401
     ├─ ses_refreshExpira ≤ ahora o ses_familiaExpira ≤ ahora → rollback → borrar cookie → Error 401
     ├─ ses_cliente ≠ canal actual (W/N) → rollback → Error 401
     ├─ usuario no activo (ValidacionMdl::obtenerUsuarioActivoPorId = null) → rollback → borrar cookie → Error 401
     → SesionMdl::marcarRotada(ses_id) (afectadas = 1; si 0 → rollback → 401)
     → SesionMdl::crearSesion(misma familia, mismo ses_familiaExpira, tokens nuevos) → commit
  4. Si navegador anterior ≠ navegador actual → audita SESION_ANOMALA (detalle "navegador X->Y")
  5. Audita RENOVAR → roles → Cache-Control: no-store → CanalRefresh::entregar → 200 (mismo cuerpo que autenticar)
```

Concurrencia: dos `renovar` simultáneos con el mismo refresh se serializan por el `FOR UPDATE`; el segundo encuentra `'R'` y revoca la familia (comportamiento estricto de A-04; ver riesgo R-05).

### Flujo C · `POST autenticacion/cerrarSesion` (protegida)

```
Guardia (Bearer válido) → ValidacionCtrl::cerrarSesion()
  1. CanalRefresh::exigirOrigenConfiable() ── Error 403 + ACCESO_DENEGADO
  2. SesionMdl::revocarFamilia(ContextoSesion::familia(), 'CIERRE_SESION')
  3. Audita CIERRE_SESION → CanalRefresh::borrarCookie() (si canal web) → 200 { "success": "ok" }
  └─ Sin Bearer válido → Error 401 en la guardia (la app renueva y reintenta, HLT-07)
```

### Flujo D · `POST autenticacion/cerrarTodas` (protegida)

```
Guardia → ValidacionCtrl::cerrarTodasLasSesiones() → SesionMdl::revocarTodasDeUsuario(idUsuario, 'CIERRE_TODAS')
  → audita CIERRE_TODAS → 200 { "success": "ok" }
```

### Flujo E · `GET autenticacion/usRol` (protegida)

```
Guardia → ValidacionCtrl::obtenerRolesUsuario($idQuery)
  ├─ $idQuery !== null y (string)$idQuery !== (string)ContextoSesion::idUsuario() → audita ACCESO_DENEGADO → Error 403 "Acceso denegado"
  └─ 200 ContextoSesion::roles()   (arreglo, puede ser [])
```

### Flujo G · Mantenimiento (CLI)

```
[cron en servidor | a mano en local] C:\xampp\php\php.exe rest_usuario\mantenimiento\limpiarSeguridad.php
  → PHP_SAPI ≠ 'cli' → exit(1)
  → arranque (autoload + Configuracion::cargar) → Enlace
  → borra por lotes de 5000: familias vencidas, intentos > 900 s, contadores > 120 s, auditoría > 180 días
  → imprime "sesiones=N intentos=N contadores=N auditoria=N" → exit(0)
  └─ excepción → mensaje genérico en STDERR + error_log con detalle → exit(1)
```

`loading`/`error` de la app no aplican a este HLT (backend); su manejo en el cliente es de HLT-07.

---

## H4. Calidad del HLT y cobertura

### 4.1 Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba/verificación |
|--------------------|----------|---------------------|
| A-01 (respuesta + refresh por canal) · RN-01, RN-02, RN-19 | T-10, T-11, T-12, T-14, T-18 | T-25 casos `A01-web`, `A01-nativo`, `A01-nativo-origen-web` |
| A-02 (mismo mensaje y tiempo) · RN-07 | T-13, T-14 | T-25 casos `A02-mensaje` y `A02-tiempo` |
| A-03 (401 por token inválido; solo Bearer) · RN-03, RN-11 | T-07, T-19…T-22 | T-25 casos `A03-*` |
| A-04 (rotación + reutilización) · RN-04, RN-05, RN-06 | T-12, T-15 | T-25 casos `A04-rota`, `A04-reuso` |
| A-05 (cerrar sesión / todas) · RN-22 | T-16, T-19…T-22 | T-25 casos `A05-*` en los 4 backends |
| A-06 (límites, IP real) · RN-15…RN-18 | T-04, T-08, T-14, T-19…T-22 | T-26 casos `A06-*`, `IP-xff` |
| A-07 (lista blanca) · RN-12 | T-19…T-22 | T-26 casos `A07-*` y `BYPASS-*` |
| A-08 (O-01: TTL 15 min) · RN-03 | T-07, T-10 | T-25 caso `A03-vencido` + columna `ses_accesoExpira` |
| A-09 (IP/UA, SESION_ANOMALA) · RN-23 | T-02, T-12, T-15 | T-25 caso `A09-anomala` |
| B-01 (Argon2id + rehash) · RN-10 | T-13, T-14 | T-25 caso `B01-rehash` |
| C-03 (roles de la sesión) · RN-13, RN-14 | T-07, T-17 | T-25 casos `C03-*` |
| C-05 (transacciones) · RN-26 | T-12, T-14, T-15 | Revisión de código en C3 + T-25 `A04-*` |
| D-01 (eventos) | T-06, T-08, T-14…T-17 | T-27 caso `D01-eventos` |
| D-02 (sin secretos) · RN-24 | T-06 | T-27 caso `D02-sin-tokens` |
| D-03 (limpieza) · RN-25 | T-23 | T-27 caso `D03-limpieza` |
| E-07 (CSRF) · RN-20 | T-11, T-15, T-16 | T-25 casos `E07-*` |
| F-04 (esquema) | T-02, T-03 | T-02 criterio (doble ejecución) + T-03 sha256 |
| RN-08 | T-07, T-13 | T-25 `A02-mensaje` (usuario pendiente) |
| RN-09 | T-14 | T-24 login con clave que contiene `#` y `&` |
| RN-21 | T-15 | T-25 `RN21-canal` |
| RN-27 | T-14…T-18 | Todas las respuestas de T-25 |
| RN-28 | T-09 | Comando sha256 del plan §4.2 |
| O-03 (latencia e índices) | T-02, T-27 | T-27 caso `O03-latencia` + `EXPLAIN` |
| Doc. workspace (plan §5.6) y README (§5.5) | T-28, T-29, T-30 | `grep` de T-28…T-30 |
| Precondición HLT-01/02 | T-01 | Comandos de T-01 |

### 4.2 Checklist de calidad del HLT

- ✅ Las 11 secciones existen y están completas.
- ✅ Sin marcadores pendientes.
- ✅ Cada RN mapea a ≥1 tarea (cobertura 100 %).
- ✅ Cada tarea tiene criterio de aceptación verificable y ficha de checks (H9).
- ✅ No contradice las reglas del proyecto (§0.5 aplica a la app; para backend rige `desarrollador-php.md` con los overrides del plan §5).
- ✅ Referencias `ruta:línea` verificadas contra el repositorio el 2026-11-02 (las de `index.php` describen el estado **previo** a HLT-02).
- ✅ Decisiones cerradas en H5 sin ambigüedad.

---

## H5. Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Modelo de filas de `sgen_sesion` | A) una fila por familia que se actualiza al rotar; B) una fila por par emitido, unidas por `ses_familia` | **B** | Con A solo se detecta la reutilización del refresh inmediatamente anterior; con B cualquier refresh rotado de la familia se encuentra en estado `'R'` y dispara la revocación (A-04). El volumen extra (≤ 96 filas/día por familia activa) se limpia en T-23. | No (tabla nueva) |
| D-02 | Columnas de `sgen_sesion` | — | `ses_id` BIGINT UNSIGNED AI PK · `ses_familia` CHAR(32) ascii_bin · `ses_usuId` INT(11) FK · `ses_hashAcceso`/`ses_hashRefresh` CHAR(64) ascii_bin **UNIQUE** · `ses_accesoExpira`, `ses_refreshExpira`, `ses_familiaExpira`, `ses_fechaCreacion`, `ses_ultimoUso` DATETIME (UTC) · `ses_ip` VARCHAR(45) · `ses_agenteUsuario` VARCHAR(255) · `ses_navegador` VARCHAR(16) · `ses_cliente` CHAR(1) `W`/`N` · `ses_estado` CHAR(1) `A`/`R`/`V` · `ses_motivoRevocacion` VARCHAR(24) NULL · `ses_fechaRevocacion` DATETIME NULL | Cubre F-04 (familia, hashes, expiraciones, último uso, IP, UA, estado) más canal y motivo. `ascii_bin` = comparación exacta y índice compacto. | No |
| D-03 | Columnas de `sgen_intentoacceso` | A) usuario en claro + FK a usuario; B) hash del usuario normalizado sin FK | **B**: `ina_id` BIGINT AI PK · `ina_usuarioHash` CHAR(64) ascii_bin · `ina_ip` VARCHAR(45) · `ina_fecha` DATETIME; índices (`ina_usuarioHash`,`ina_fecha`), (`ina_ip`,`ina_fecha`), (`ina_fecha`) | El contador debe funcionar **igual** para usuarios inexistentes (anti-enumeración, A-02), así que no puede depender de una FK a `sgen_usuario`. Se aparta del pedido "FK a sgen_usuario" del encargo, con esta justificación. | No |
| D-04 | Columnas de `sgen_limitepeticion` | A) una fila por petición; B) contador por ventana fija de 1 min | **B**: `lip_clave` CHAR(64) ascii_bin + `lip_ventana` DATETIME = **PK compuesta (única)** · `lip_contador` INT UNSIGNED; índice (`lip_ventana`). Sin FK (la clave es de familia o de IP). | Una escritura por petición (O-03). La ráfaga de hasta 2× en el borde de la ventana se acepta (riesgo R-08). | No |
| D-05 | Columnas de `sgen_auditoria` | — | `aud_id` BIGINT AI PK · `aud_fecha` DATETIME · `aud_evento` VARCHAR(24) · `aud_servicio` VARCHAR(24) · `aud_usuId` INT(11) NULL FK `ON DELETE SET NULL` · `aud_sesFamilia` CHAR(32) ascii_bin NULL · `aud_ip` VARCHAR(45) · `aud_agenteUsuario` VARCHAR(255) · `aud_detalle` VARCHAR(255); índices (`aud_fecha`), (`aud_evento`,`aud_fecha`), (`aud_usuId`,`aud_fecha`) | D-01 + servicio emisor (4 backends escriben) + índice para las alertas de HLT-06. | No |
| D-06 | Acciones de FK | NO ACTION (estilo del volcado) / CASCADE-SET NULL | `sgen_sesion` → `ON DELETE CASCADE`; `sgen_auditoria` → `ON DELETE SET NULL` | Las bajas son lógicas (`usu_estado`), así que no se dispara en la práctica; si alguna vez se borra un usuario, sus sesiones no deben bloquearlo y la auditoría se conserva. | No |
| D-07 | Script idempotente | `CREATE TABLE IF NOT EXISTS` con índices y FK en línea / `ALTER` posteriores | **En línea** | Repetible en MariaDB 10.4 (local) y MySQL 8 (hosting) sin sintaxis `IF NOT EXISTS` en `ALTER`. | No |
| D-08 | Formato de token | hex / base64url | base64url sin relleno de 32 bytes (43 caracteres), validado con `/^[A-Za-z0-9_-]{43}$/` antes de calcular el hash | 256 bits (HU); cabe en cookie y cabecera; el filtro descarta basura sin consultar la BD. | No |
| D-09 | Reloj | `NOW()` de MySQL / PHP en UTC | **PHP en UTC** (`time()`, `gmdate`) pasado como parámetro; ningún SQL de estas tablas usa `NOW()` ni `CURRENT_TIMESTAMP` | La BD local tiene `time_zone = SYSTEM` (America/Bogota); una sola fuente de reloj evita desfases. `accessExpira` = `gmdate(DATE_ATOM, ts)` → `…+00:00`. | No |
| D-10 | Comparación en tiempo constante | Solo `WHERE hash = ?` / además `hash_equals` | Búsqueda por índice único del **hash** + `hash_equals(fila, calculado)` | Se busca por SHA-256 del token, no por el token: la temporización del índice no revela nada útil; `hash_equals` cumple lo pedido por la HU como defensa adicional. | No |
| D-11 | Hash ficticio | Generar en cada login / constante | Constante `HASH_FICTICIO` en `ValidacionCtrl`, un Argon2id con parámetros por defecto generado una vez por el implementador con `C:\xampp\php\php.exe -r "echo password_hash(bin2hex(random_bytes(16)), PASSWORD_ARGON2ID);"` | Generarlo por petición duplica el costo; el valor no es secreto (su clave original se descarta). | No |
| D-12 | Coherencia de canal | Permitir renovar desde otro canal / rechazar | **Rechazar** con 401 si `ses_cliente` ≠ canal actual | Un refresh nativo robado no se puede canjear como cookie web ni al revés. | No |
| D-13 | Normalización de la clave en login | Clave cruda / `htmlspecialchars(trim())` | **`htmlspecialchars(trim($clave), ENT_QUOTES, 'UTF-8')`**, igual que hoy | Los hashes existentes se calcularon sobre la clave limpiada (`PersonaCtrl.php:86,133-141`, `ValidacionCtrl.php:23-25`). Cambiarlo dejaría fuera a usuarios con `& < > " '` o espacios. **Vincula a HLT-06**: registro, cambio y restablecimiento deben aplicar la misma normalización o migrarla. | Sí (compatibilidad de credenciales) |
| D-14 | Normalización del usuario para límites | Tal cual / minúsculas + trim | `mb_strtolower(trim($usuario))`, hash SHA-256 | `usu_usuario` usa `utf8mb4_general_ci` (insensible a mayúsculas): `Wills` y `wills` son la misma cuenta y deben compartir contador. | No |
| D-15 | Carrera en fuerza bruta paralela | Contar después de fallar / insertar intento provisional antes de verificar | **Provisional antes**: contar → si bloqueado 429 sin insertar → insertar → recontar → si excede 429 → verificar clave; en éxito se borran los intentos del usuario | Cada inserción precede a su conteo, así que N peticiones paralelas no logran más de 5 verificaciones por usuario. | No |
| D-16 | `Retry-After` | Fijo / calculado | Login: `max(1, fechaMásAntiguaEnVentana + 900 − ahora)` tomando el mayor entre usuario e IP. API: `max(1, 60 − ahora mod 60)` | Momento exacto en que se libera un intento o la ventana. | No |
| D-17 | Auditoría de bloqueos | Cada intento bloqueado / al alcanzar el umbral | `BLOQUEO_USUARIO` cuando el conteo llega a 5; `BLOQUEO_IP` cuando llega a 20; `LIMITE_PETICIONES` solo cuando `contador = límite + 1` | Un evento por bloqueo; evita inundar la tabla. | No |
| D-18 | Fallo al auditar | Ignorar y registrar en log / propagar | **Propagar** (500 por `ManejadorErrores`) | Falla cerrado: un evento de seguridad no se pierde en silencio. | No |
| D-19 | Detección de `SESION_ANOMALA` | En cada petición / al renovar | **Al renovar**, comparando `ses_navegador` de la fila anterior con el actual | Mantiene la validación por petición en 1 lectura de sesión (O-03); el access dura 15 min, así que la comprobación ocurre al menos cada 15 min de uso. Clasificación: `EDGE` (`Edg/`), `OPERA` (`OPR/`), `CHROME` (`Chrome/`, `CriOS/`), `FIREFOX` (`Firefox/`, `FxiOS/`), `SAFARI` (`Safari/` sin los anteriores), `OTRO`. | No |
| D-20 | `ses_ultimoUso` | Cada petición / como máximo cada 60 s | **Cada ≥ 60 s** (UPDATE condicionado al valor leído) | Cumple F-04 sin una escritura extra por petición (O-03). A-08 queda cubierto por el TTL (O-01). | No |
| D-21 | `ContextoSesion` | Instancia pasada por capas / clase estática | **Estática** con `establecer()`, `estaAutenticado()`, `idUsuario()`, `roles()`, `idSesion()` y el método adicional `familia()`; `idUsuario()`/`familia()` sin sesión lanzan `LogicException` (→ 500) | Accesible desde los `Ctrl` de HLT-04/05/06 sin tocar las firmas de `Rts`. `familia()` es aditivo al contrato §4.2 (no lo contradice). | No |
| D-22 | Conexiones | Cada clase con su `new Enlace()` / inyección | Las 5 clases compartidas reciben `Enlace` por constructor; `index.php` crea **una** `$enlaceSeguridad` para pasos 8–9. `ValidacionCtrl` crea **una** `Enlace` y la inyecta en `ValidacionMdl`, `SesionMdl`, `LimitadorPeticiones` y `RegistroAuditoria` | La transacción del login abarca usuario, sesión e intentos sólo si comparten conexión (C-05). | No |
| D-23 | Ubicación de clases propias de `rest_usuario` | `configuracion/` / `servicios/` | `servicios/EmisorTokens.php`, `servicios/CanalRefresh.php`; SQL en `modelos/SesionMdl.php` | `configuracion/` queda solo para clases compartidas (regla sha256); el SQL vive en `modelos/` (`desarrollador-php.md` "Arquitectura obligatoria"). | No |
| D-24 | Respuesta 401/403/429 desde clases compartidas | Clase compartida nueva de respuesta / método privado | Método privado `responderError(int $codigo, string $mensaje, array $cabeceras = []): void` en cada clase que corta la petición (`http_response_code`, `Content-Type: application/json; charset=utf-8`, `echo json_encode(['error'=>…], JSON_UNESCAPED_UNICODE)`, `exit`) | No se agrega una sexta clase compartida al contrato §4.2. | No |
| D-25 | Cuerpo de `renovar`/`cerrarSesion`/`cerrarTodas` en web | Sin cuerpo / `{}` | El servidor acepta cuerpo ausente **o** `{}`; la app (HLT-07) envía `{}` con `Content-Type: application/json` | Compatible con cualquier regla de `LectorSolicitud` sobre POST. `ValidacionRts` deja de rechazar el cuerpo vacío solo para esas 3 acciones. | No |
| D-26 | `cerrarSesion` sin cookie | Exigir cookie / revocar por el access | Revoca la familia del **access** (`ContextoSesion::familia()`) y borra la cookie si el canal es web | El plan §4.5 lo deja protegido (no está en la lista pública); el access identifica la familia sin depender de la cookie. | No |
| D-27 | `cerrarTodas` y la cookie | Borrarla / no tocarla | No la toca | El cliente web no envía credenciales a `cerrarTodas` (H-04); el refresh ya quedó revocado y el siguiente `renovar` responde 401 y la borra. | No |
| D-28 | Revocación de familia | Marcar `A` y `R` / solo `A` | Solo filas `'A'` → `'V'` | Las filas `'R'` siguen detectando y auditando reutilizaciones posteriores (útil para las alertas de HLT-06). | No |
| D-29 | `usRol` sin roles | 404 (hoy, `ValidacionCtrl.php:65-67`) / 200 `[]` | **200 `[]`** | El contrato del plan §4.5 es un arreglo; con roles desde la sesión no hay caso "no encontrado". | No |
| D-30 | Lista pública | Por recurso / por `recurso/acción` | `const RUTAS_PUBLICAS` en cada `index.php` exactamente como plan §4.5; además `GET` con acción vacía | Plan §4.5. Coincidencia exacta y sensible a mayúsculas (`in_array(…, true)`). | No |
| D-31 | Nombre del servicio en auditoría | Configuración `.env` / constante | `const SERVICIO_ACTUAL = '<rest_nombre>'` en cada `index.php`, pasada a `RegistroAuditoria` | No amplía la lista cerrada de claves `.env` (plan §4.1). | No |
| D-32 | Límites y ventanas | `.env` / constantes | Constantes de `LimitadorPeticiones`: `LOGIN_MAX_FALLOS_USUARIO = 5`, `LOGIN_MAX_FALLOS_IP = 20`, `LOGIN_VENTANA_SEGUNDOS = 900`, `API_MAX_POR_SESION = 300`, `API_MAX_PUBLICO_POR_IP = 60`, `API_VENTANA_SEGUNDOS = 60` | Valores fijados por la HU; la lista de claves `.env` está cerrada. | No |
| D-33 | Cookie | Con `Domain` / host-only; prefijo `__Host-` | Host-only (sin `Domain`), sin prefijo; nombre = `COOKIE_REFRESH_NOMBRE` | `__Host-` exige `Path=/`, incompatible con limitar la ruta a `autenticacion/` (A-01). Host-only reduce el alcance a la API. | No |
| D-34 | Mantenimiento | Endpoint HTTP / CLI | `rest_usuario/mantenimiento/limpiarSeguridad.php`, sale con código 1 si `PHP_SAPI !== 'cli'`; queda bloqueado por la lista blanca de E-02 (HLT-02) y en el servidor vive fuera de `public_html` (E-01) | D-03: fuera de la parte pública. Lotes de 5000 filas para no bloquear tablas. Expiración de familias: se borra la familia completa si `MAX(ses_refreshExpira) ≤ ahora` o `MAX(ses_familiaExpira) ≤ ahora`. | No |
| D-35 | Pruebas reproducibles | Comandos sueltos en el reporte / script versionado | `rest_usuario/anexos/pruebas/seguridad_01_pruebas.sh` (Git Bash), un caso por función, imprime `OK <caso>` o `FALLO <caso>: <detalle>` | J-06; `anexos/` no se despliega (E-03) y no se sirve (E-02). | No |
| D-36 | Tipado de archivos nuevos | Sin / con `declare(strict_types=1)` | Todo archivo PHP **nuevo** empieza con `declare(strict_types=1);`; los existentes no se cambian | Evita conversiones silenciosas en código de seguridad. | No |
| D-37 | Interfaz de HLT-01/02 | Suponer / verificar | Tarea puerta **T-01** con la lista IR-01…IR-10 (H7.2). Si un punto no se cumple, T-01 queda `BLOQUEADA` y se emite `HLT-03-…-v2`; el implementador **no adapta** nombres por su cuenta | HLT-01 y HLT-02 se redactan en paralelo; esto mantiene el determinismo. | No |
| D-38 | `Allow-Credentials` en `autenticacion/*` | Implementarlo aquí / verificarlo | Lo implementa HLT-02 (E-06 es suyo en plan §3); HLT-03 lo **verifica** en T-01 (IR-05) y en T-25 | Evita dos dueños para `CorsConfig`. | No |

No quedan decisiones de impacto alto abiertas: el esquema y el contrato HTTP están delegados a este HLT por el plan maestro (§4.4 "Cada HLT define las columnas", §4.5 contrato cerrado), por lo que RD-6 no se activa.

---

## H6. Revisión del requerimiento por parte de un senior

### Iteración 1 — veredicto: APROBADO CON CAMBIOS

Hallazgos adversariales y cambios exigidos (todos aplicados en el texto actual):

| # | Ataque/defecto | Cambio aplicado |
|---|----------------|-----------------|
| 1 | Fuerza bruta en paralelo: "contar y luego registrar el fallo" deja pasar decenas de intentos simultáneos | D-15 (intento provisional antes de verificar) |
| 2 | Enumeración por bloqueo: si solo se contaran fallos de usuarios existentes, el 429 revelaría qué cuentas existen | D-03/D-14: contador por hash del nombre enviado, exista o no |
| 3 | Enumeración por tiempo: BCRYPT heredado vs Argon2id ficticio | D-11 + rehash en login (B-01); el residuo se registra como R-09 |
| 4 | Usuarios con caracteres especiales quedarían fuera al pasar a clave cruda | D-13 |
| 5 | Carrera en rotación: dos `renovar` emiten dos pares válidos | `SELECT … FOR UPDATE` + `UPDATE … WHERE ses_estado='A'` con afectadas = 1 (Flujo B) |
| 6 | Reutilización solo detectable un paso atrás | D-01 (fila por par) |
| 7 | Canje cruzado de refresh nativo como cookie | D-12 / RN-21 |
| 8 | Bypass de la guardia por discrepancia entre `Enrutador` y el parseo propio de cada `Rts` (p. ej. `/persona/agregar/../autenticacion/usRol`, segmentos repetidos) | IR-03 en T-01, `ValidacionRts` toma la acción del `Enrutador` (T-18) y casos `BYPASS-*` en T-26 en los 4 backends |
| 9 | Fuga de tokens a la auditoría o al log | RN-24 (regex de rechazo en `RegistroAuditoria`) + T-27 `D02-sin-tokens` sobre BD y `RUTA_LOGS` |
| 10 | Respuestas con tokens cacheables | `Cache-Control: no-store` explícito en `autenticar` y `renovar` |
| 11 | Inundación de auditoría por 429 repetidos | D-17 |
| 12 | Interfaz de HLT-01/02 desconocida al redactar | D-37 (tarea puerta) |

### Iteración 2 — checklist senior

| # | Ítem | Estado | Nota |
|---|------|--------|------|
| 1 | Entendimiento | ✅ | H1 copia el requerimiento literal; alcance coincide con plan §2 y §3 (fila HLT-03). |
| 2 | Reglas de negocio | ✅ | RN-01…RN-28 son booleanas y no se contradicen; RN-07 y RN-15 son compatibles (429 se evalúa antes del 401). |
| 3 | Impacto | ✅ | 4 `index.php`, 5 clases × 4 backends, 3 archivos existentes de `/autenticacion`, 5 archivos nuevos en `rest_usuario`, 1 SQL + copia, 6 documentos. Efecto colateral conocido: app local sin endpoints protegidos hasta HLT-07; `actualizarClave`, `generarCodigo`, `obtenerCodigo`, `persona/actualizarDeApp` pasan a exigir token pero siguen aceptando un `id` ajeno hasta HLT-06 (R-07). |
| 4 | Consistencia arquitectónica | ✅ | Capas `Rts → Ctrl → Mdl → Enlace`; SQL solo en `modelos/` y en las clases compartidas de seguridad (definidas así por el plan §4.2); respuestas `{error}`; 422 sin usar. Reglas Angular (standalone, signalStore…) N/A: no se toca la app salvo copiar un `.sql`. |
| 5 | Riesgos | ✅ | Tabla siguiente. |
| 6 | Simplicidad | ✅ | Sin librerías (DH-01/DH-08); sin JWT; una fila por par en vez de tablas de historial; contador por ventana fija; clases estáticas mínimas. |
| 7 | Seguridad | ✅ | Ver revisión adversarial: entropía 256 bits; solo hashes SHA-256 en BD (un token de 256 bits no necesita sal ni KDF); `hash_equals`; fijación de sesión imposible (el login siempre crea familia y tokens nuevos e ignora cualquier cookie entrante); CSRF por `Origin` + `X-Requested-With` + `SameSite=Strict`; IP falsificada ignorada; tokens fuera de URL. |
| 8 | Cobertura | ✅ | H4 al 100 %. |
| 9 | Determinismo | ✅ | 38 decisiones cerradas; firmas, SQL y constantes fijados en H7.2. |
| 10 | Ejecutabilidad | ✅ | Cada tarea declara archivos y un comando de aceptación; la única incertidumbre externa (interfaz HLT-01/02) se resuelve con la tarea puerta. |

### Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-01 | Bypass de la guardia si `Enrutador` (HLT-02) y los `Rts` que no toca este HLT derivan recurso/acción distintos | **Alta** | IR-03 en T-01; casos `BYPASS-*` en los 4 backends (T-26); HLT-04/05/06 deben leer la acción del `Enrutador` al reescribir sus `Rts` |
| R-02 | Ventana de transición: la app local no puede usar endpoints protegidos hasta HLT-07 | **Alta** (aceptada) | Plan §2; no se despliega nada antes de HLT-11; HLT-07 se ejecuta tras HLT-04/05 |
| R-03 | HLT-06 cambia la normalización de la clave sin migrar y deja usuarios fuera | **Alta** | D-13 vinculante; documentado en README (T-28) y en `desarrollador-php.md` (T-30) |
| R-04 | Interfaz real de HLT-01/02 distinta a IR-01…IR-10 | Media | T-01 bloquea y obliga a versión `-v2` |
| R-05 | Dos pestañas web renuevan a la vez con la misma cookie → revocación de la familia (A-04 estricto) | Media | HLT-07 debe serializar `renovar` entre pestañas (Web Locks API o `BroadcastChannel`); registrado para HLT-07 |
| R-06 | Bloqueo deliberado de la cuenta de una víctima (5 fallos / 15 min) | Media (aceptado por la HU) | Ventana corta; auditoría `BLOQUEO_USUARIO` alimenta las alertas de HLT-06 |
| R-07 | Endpoints con `id` del cliente (`actualizarClave`, `persona/actualizarDeApp`) siguen sin verificar dueño hasta HLT-06 | Media | Solo afecta a local (nada se despliega antes de HLT-11); C-01 de `rest_usuario` es de HLT-06 |
| R-08 | Ventana fija permite hasta 2× el límite en el cambio de minuto | Baja | Aceptado; el WAF de HLT-11 añade otra capa |
| R-09 | Diferencia de tiempo BCRYPT (heredado) vs Argon2id ficticio permite inferir cuentas antiguas que nunca iniciaron sesión | Baja | Se reduce con cada login (rehash); HLT-06 hashea con Argon2id al registrar |
| R-10 | Argon2id usa 64 MB por verificación en un hosting compartido | Media | Límite de 60 peticiones/min por IP en rutas públicas y 20 fallos/IP; medir en staging (HLT-11) |
| R-11 | `Origin` ausente en peticiones nativas si en el futuro se activa `CapacitorHttp` | Media | Hoy `capacitor.config.ts:7-9` no lo activa (las peticiones salen del WebView y llevan `Origin`); HLT-07/HLT-10 no deben activarlo sin revisar E-07 |

### Veredicto final: **APROBADO**

El HLT cubre el 100 % del alcance asignado por el plan maestro, cierra todas las decisiones de esquema y de sesión dentro de la delegación del plan, mitiga los vectores de ataque principales (fuerza bruta paralela, enumeración, carrera en la rotación, reutilización, CSRF, IP falsificada, bypass de rutas) y condiciona la ejecución a una verificación explícita de la interfaz de HLT-01/02.

---

## H7. Plan de tareas

Orden topológico; ninguna tarea es paralelizable salvo T-03 (puede ejecutarse en cualquier momento después de T-02). Rutas relativas a `C:\xampp\htdocs\criterio_kelly`. Abreviatura: `PHP=/c/xampp/php/php.exe`, `MYSQL=/c/xampp/mysql/bin/mysql.exe -uroot sist_criteriokelly`, `URL=http://localhost/criterio_kelly`.

### H7.1 Tabla de tareas

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req cubierto |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|-----------------|
| T-01 | desarrollador-php | Verificar la interfaz de HLT-01/02 (puerta, solo lectura) | Lectura: `rest_*/configuracion/{Configuracion,enlace,CorsConfig,LectorSolicitud,Enrutador,ManejadorErrores}.php`, `rest_*/index.php`, `rest_*/.env`, `rest_*/.htaccess` | — | Los 10 comandos IR-01…IR-10 de H7.2 dan el resultado esperado; si alguno falla, estado `BLOQUEADA` | D-37, D-38 |
| T-02 | desarrollador-php | Crear el script de esquema de seguridad | `rest_usuario/anexos/seguridad_01_sesion.sql` (nuevo) | T-01 | `$MYSQL < rest_usuario/anexos/seguridad_01_sesion.sql` dos veces seguidas: código de salida 0 ambas; `$MYSQL -e "SHOW CREATE TABLE sgen_sesion\G"` muestra `sgen_sesion_hashacceso_uq`, `sgen_sesion_hashrefresh_uq` y `sgen_usuario_sgen_sesion_fk`; las 4 tablas existen | F-04, D-02…D-07 |
| T-03 | desarrollador-ionic | Copiar el script de esquema a los anexos de la app | `criterioKellyApp/src/assets/anexos/seguridad_01_sesion.sql` (nuevo) | T-02 | `sha256sum rest_usuario/anexos/seguridad_01_sesion.sql criterioKellyApp/src/assets/anexos/seguridad_01_sesion.sql` muestra el mismo hash | F-04; plan §4.4 |
| T-04 | desarrollador-php | Crear `ClienteIp` | `rest_usuario/configuracion/ClienteIp.php` (nuevo) | T-01 | `$PHP -l` sin errores; `$PHP -r` de H7.2 (T-04) imprime `127.0.0.1` con `HTTP_X_FORWARDED_FOR=203.0.113.9` y `IP_CABECERA_CONFIABLE` vacío | RN-18, A-06 |
| T-05 | desarrollador-php | Crear `ContextoSesion` | `rest_usuario/configuracion/ContextoSesion.php` (nuevo) | T-01 | `$PHP -l` sin errores; `grep -c "public static function" ` = 7 | D-21, C-03 |
| T-06 | desarrollador-php | Crear `RegistroAuditoria` | `rest_usuario/configuracion/RegistroAuditoria.php` (nuevo) | T-02, T-04 | `$PHP -l` sin errores; `grep -c "'LOGIN_OK'\|'ACCESO_DENEGADO'\|'CIERRE_TODAS'"` ≥ 3; `grep -n "{32,}"` encuentra la regex de RN-24 | D-01, D-02, RN-24 |
| T-07 | desarrollador-php | Crear `ValidadorSesion` | `rest_usuario/configuracion/ValidadorSesion.php` (nuevo) | T-02, T-05 | `$PHP -l` sin errores; `grep -n "hash_equals\|REDIRECT_HTTP_AUTHORIZATION\|{43}"` encuentra las 3 | A-03, RN-03, RN-11, RN-13, D-10, D-20 |
| T-08 | desarrollador-php | Crear `LimitadorPeticiones` | `rest_usuario/configuracion/LimitadorPeticiones.php` (nuevo) | T-04, T-05, T-06 | `$PHP -l` sin errores; `grep -n "ON DUPLICATE KEY UPDATE\|Retry-After"` encuentra ambas; las 6 constantes de D-32 existen | A-06, RN-15…RN-17, D-15…D-17 |
| T-09 | desarrollador-php | Copiar las 5 clases compartidas a los otros 3 backends | `rest_criteriokelly/configuracion/`, `rest_suscripcion/configuracion/`, `rest_divisas/configuracion/` × `{ClienteIp,ContextoSesion,RegistroAuditoria,ValidadorSesion,LimitadorPeticiones}.php` (15 archivos nuevos) | T-04…T-08 | Comando sha256 del plan §4.2 imprime `1` en las 12 líneas | RN-28 |
| T-10 | desarrollador-php | Crear `EmisorTokens` | `rest_usuario/servicios/EmisorTokens.php` (nuevo) | T-07 | `$PHP -l`; `$PHP -r` de H7.2 (T-10) imprime `43 32` | RN-01, RN-03, RN-04, D-08, D-09 |
| T-11 | desarrollador-php | Crear `CanalRefresh` | `rest_usuario/servicios/CanalRefresh.php` (nuevo) | T-06, T-07 | `$PHP -l`; `grep -n "'httponly' => true\|'samesite' => 'Strict'\|CriterioKelly"` encuentra las 3 | A-01, E-07, RN-19, RN-20, D-33 |
| T-12 | desarrollador-php | Crear `SesionMdl` | `rest_usuario/modelos/SesionMdl.php` (nuevo) | T-02 | `$PHP -l`; `grep -c "FOR UPDATE"` = 1; `grep -c "NOW()"` = 0 | A-04, A-05, A-09, RN-05, RN-06, RN-26, D-01, D-28 |
| T-13 | desarrollador-php | Adaptar `ValidacionMdl` (inyección, búsqueda para login, rehash, usuario activo) | `rest_usuario/modelos/ValidacionMdl.php:8-27` (constructor y `autenticarUsuario` reemplazado) | T-01 | `$PHP -l`; `grep -n "function buscarUsuarioParaAutenticar\|function actualizarHashClave\|function obtenerUsuarioActivoPorId"` encuentra las 3; `autenticarUsuario` ya no existe | A-02, B-01, RN-08 |
| T-14 | desarrollador-php | Reescribir `ValidacionCtrl::autenticarUsuario` y el constructor | `rest_usuario/controladores/ValidacionCtrl.php:1-42` | T-06, T-08, T-10, T-11, T-12, T-13 | `$PHP -l`; `grep -n "HASH_FICTICIO\|password_needs_rehash\|PASSWORD_ARGON2ID\|no-store"` encuentra las 4 | A-01, A-02, B-01, RN-07, RN-09, RN-10, D-11, D-13, D-15 |
| T-15 | desarrollador-php | Agregar `ValidacionCtrl::renovarSesion` | `rest_usuario/controladores/ValidacionCtrl.php` (método nuevo tras `autenticarUsuario`) | T-14 | `$PHP -l`; `grep -n "REFRESH_REUTILIZADO\|SESION_ANOMALA\|RENOVAR"` encuentra las 3 | A-04, A-09, E-07, RN-05, RN-06, RN-21, RN-23 |
| T-16 | desarrollador-php | Agregar `cerrarSesion` y `cerrarTodasLasSesiones` | `rest_usuario/controladores/ValidacionCtrl.php` (métodos nuevos) | T-15 | `$PHP -l`; `grep -n "CIERRE_SESION\|CIERRE_TODAS"` encuentra ambas | A-05, E-07, RN-22, D-26, D-27 |
| T-17 | desarrollador-php | Reescribir `obtenerRolesUsuario` para leer de la sesión | `rest_usuario/controladores/ValidacionCtrl.php:44-75` | T-16 | `$PHP -l`; el método ya no llama a `obtenerRolesUsuarios` del modelo; `grep -n "ContextoSesion::roles()"` lo encuentra | C-03, RN-13, RN-14, D-29 |
| T-18 | desarrollador-php | Registrar las acciones nuevas en `ValidacionRts` | `rest_usuario/rutas/ValidacionRts.php:13-23` (acción), `:64-72` (usRol), `:89-126` (POST) | T-17 | `$PHP -l`; `grep -n "'renovar'\|'cerrarSesion'\|'cerrarTodas'"` encuentra las 3 | A-01, A-04, A-05, D-25 |
| T-19 | desarrollador-php | Agregar la guardia (pasos 8–9) en `rest_usuario/index.php` | `rest_usuario/index.php` (bloque entre el paso 7 y el `require` del paso 10 que deja HLT-02; hoy `index.php:36-53`) | T-09, T-18 | `$PHP -l`; `curl -s -o /dev/null -w "%{http_code}" $URL/rest_usuario/autenticacion/usRol` = `401`; `curl … $URL/rest_usuario/autenticacion` = `200` | A-07, RN-12, D-30, D-31 |
| T-20 | desarrollador-php | Agregar la guardia en `rest_criteriokelly/index.php` | `rest_criteriokelly/index.php` (hoy `:36-53` antes de HLT-02) | T-09 | `$PHP -l`; `curl … $URL/rest_criteriokelly/cuentas/obtener?id=1` = `401` | A-07, DH-05 |
| T-21 | desarrollador-php | Agregar la guardia en `rest_suscripcion/index.php` | `rest_suscripcion/index.php` (hoy `:34-51` antes de HLT-02) | T-09 | `$PHP -l`; `curl … $URL/rest_suscripcion/planes/disponible` ≠ `401`; `curl … $URL/rest_suscripcion/suscripcion/porUsuario?id=1` = `401` | A-07 |
| T-22 | desarrollador-php | Agregar la guardia en `rest_divisas/index.php` | `rest_divisas/index.php` (hoy `:37-54` antes de HLT-02) | T-09 | `$PHP -l`; `curl … $URL/rest_divisas/cripto/disponible` = `401` | A-07, DH-05 |
| T-23 | desarrollador-php | Crear el script de mantenimiento | `rest_usuario/mantenimiento/limpiarSeguridad.php` (nuevo) | T-02 | `$PHP -l`; `$PHP rest_usuario/mantenimiento/limpiarSeguridad.php` sale con 0 e imprime `sesiones=… intentos=… contadores=… auditoria=…`; `curl … $URL/rest_usuario/mantenimiento/limpiarSeguridad.php` ∈ {403, 404} | D-03, RN-25, D-34 |
| T-24 | desarrollador-php | Crear el script de pruebas con la preparación de datos | `rest_usuario/anexos/pruebas/seguridad_01_pruebas.sh` (nuevo, sección `preparar`) | T-19…T-23 | `bash rest_usuario/anexos/pruebas/seguridad_01_pruebas.sh preparar` imprime `OK preparar` (2 usuarios activos de prueba, login exitoso de ambos) | RN-09; J-06 |
| T-25 | desarrollador-php | Agregar y ejecutar las pruebas de sesión | mismo archivo, sección `sesion` | T-24 | `bash … sesion` imprime solo líneas `OK` para los casos de H7.2 (T-25) | A-01…A-05, A-08, A-09, B-01, C-03, E-07, RN-21 |
| T-26 | desarrollador-php | Agregar y ejecutar las pruebas de límites y guardia | mismo archivo, sección `limites` | T-25 | `bash … limites` imprime solo líneas `OK` para los casos de H7.2 (T-26) | A-06, A-07, RN-12, RN-15…RN-18, R-01 |
| T-27 | desarrollador-php | Agregar y ejecutar las pruebas de auditoría, latencia y limpieza | mismo archivo, sección `auditoria` | T-26 | `bash … auditoria` imprime solo líneas `OK`, la latencia media y el `EXPLAIN` | D-01, D-02, D-03, O-03 |
| T-28 | desarrollador-php | Actualizar el README de `rest_usuario` | `rest_usuario/README.md:5-9` (Stack), `:28-41` (Instalación), `:47-63` (Autenticación), nueva sección "Seguridad de sesión", `:126-130` (Estado actual) | T-27 | `grep -n "seguridad_01_sesion.sql\|limpiarSeguridad.php\|Authorization: Bearer\|RUTAS_PUBLICAS\|htmlspecialchars"` encuentra las 5 | Plan §5.5 |
| T-29 | desarrollador-php | Documentar la guardia en los README de los otros 3 backends | `rest_criteriokelly/README.md`, `rest_suscripcion/README.md`, `rest_divisas/README.md` (sección nueva "Autenticación") | T-27 | `grep -l "Authorization: Bearer" rest_criteriokelly/README.md rest_suscripcion/README.md rest_divisas/README.md` lista los 3 | Plan §5.5 |
| T-30 | desarrollador-php | Actualizar `CLAUDE.md` raíz y `desarrollador-php.md` | `CLAUDE.md:31`, `:39`, `:52`, `:56`; `.claude/agents/desarrollador-php.md:12-13`, `:74`, `:78`, `:82`, `:154` | T-28, T-29 | `grep -n "PHP 8.2" CLAUDE.md .claude/agents/desarrollador-php.md` encuentra ambas; `grep -c "no token-based auth\|PHP 8.0\|Sin Composer\|PASSWORD_DEFAULT\|ejecutarInsercionRetornaID" CLAUDE.md .claude/agents/desarrollador-php.md` = 0 en ambos | Plan §5.6 |

Tareas por agente: `desarrollador-php` 29 (T-01, T-02, T-04…T-30); `desarrollador-ionic` 1 (T-03).

### H7.2 Especificación por tarea

#### T-01 · Interfaz requerida de HLT-01/02

| IR | Requisito | Comando (debe cumplirse en los 4 backends salvo indicación) |
|----|-----------|----------------------------------------------------------|
| IR-01 | `Configuracion` con métodos estáticos `obtener`, `obtenerEntero`, `obtenerBooleano`, `obtenerLista` | `grep -n "public static function obtener\(Entero\|Booleano\|Lista\)\?(" rest_*/configuracion/Configuracion.php` → 4 por backend |
| IR-02 | `Enlace` sin argumentos obligatorios, con `ejecutarConsulta`, `ejecutarConsultaSimpleFila`, `ejecutarActualizacion`, `ejecutarConsultaRetornarID`, `iniciarTransaccion`, `confirmarTransaccion`, `revertirTransaccion` y `mysqli_report(MYSQLI_REPORT_ERROR \| MYSQLI_REPORT_STRICT)` | `grep -c "function \(ejecutarConsulta\|ejecutarConsultaSimpleFila\|ejecutarActualizacion\|ejecutarConsultaRetornarID\|iniciarTransaccion\|confirmarTransaccion\|revertirTransaccion\)(" rest_*/configuracion/enlace.php` → 7 por backend |
| IR-03 | `index.php` deja, tras el paso 7, el método HTTP, el recurso y la acción como strings (`''` si falta) obtenidos del `Enrutador` por segmento exacto | Leer `rest_*/index.php`: existen las tres variables antes del `require` del paso 10; `grep -c "strpos(\$requestUri" rest_*/index.php` → 0 |
| IR-04 | Pasos 1–7 en el orden de plan §4.3 y `require` del archivo de ruta al final | Lectura de `rest_*/index.php` |
| IR-05 | `CorsConfig` envía `Access-Control-Allow-Credentials: true` solo para `autenticacion/*` con origen web, también en el preflight; `Allow-Headers` incluye `Authorization, Content-Type, X-Cliente, X-Requested-With` | `curl -s -i -X OPTIONS $URL/rest_usuario/autenticacion/renovar -H "Origin: http://localhost:8100" -H "Access-Control-Request-Method: POST"` contiene `Access-Control-Allow-Credentials: true` y `X-Cliente`; el mismo contra `$URL/rest_criteriokelly/cuentas/obtener` no contiene `Allow-Credentials` |
| IR-06 | `LectorSolicitud` acepta `POST` con cuerpo `{}` y `Content-Type: application/json` | `curl -s -o /dev/null -w "%{http_code}" -X POST $URL/rest_usuario/autenticacion/autenticar -H "Content-Type: application/json" -d "{}"` ≠ `400 Solicitud inválida` por cuerpo (hoy responde el mensaje de campo requerido) |
| IR-07 | La cabecera `Authorization` llega a PHP (E-05) | `grep -n "HTTP_AUTHORIZATION" rest_*/.htaccess` → 1 por backend |
| IR-08 | `ManejadorErrores::registrar()` en el paso 3 | `grep -c "ManejadorErrores::registrar" rest_*/index.php` → 1 por backend |
| IR-09 | Los 4 `.env` tienen `DB_*`, `CORS_ORIGENES_WEB`, `CORS_ORIGENES_NATIVOS`, `IP_CABECERA_CONFIABLE`, `IP_PROXIES_CONFIABLES`, `RUTA_LOGS`; `rest_usuario/.env` además `TOKEN_*` y `COOKIE_REFRESH_*` | `grep -c "^\(DB_HOST\|CORS_ORIGENES_WEB\|CORS_ORIGENES_NATIVOS\|IP_CABECERA_CONFIABLE\|IP_PROXIES_CONFIABLES\|RUTA_LOGS\)=" rest_*/.env` → 6; `grep -c "^\(TOKEN_ACCESO_MINUTOS\|TOKEN_REFRESH_INACTIVIDAD_DIAS\|TOKEN_REFRESH_MAXIMO_DIAS\|COOKIE_REFRESH_NOMBRE\|COOKIE_REFRESH_RUTA\|COOKIE_REFRESH_SEGURA\)=" rest_usuario/.env` → 6 |
| IR-10 | Solo se sirve `index.php` (E-02) | `curl -s -o /dev/null -w "%{http_code}" $URL/rest_usuario/anexos/sist_generico.sql` ∈ {403, 404} y `$URL/rest_usuario/modelos/ValidacionMdl.php` ∈ {403, 404} |

#### T-02 · `seguridad_01_sesion.sql` (contenido exacto)

```sql
-- seguridad_01_sesion.sql · HU-001 / HLT-03 · idempotente
-- Aplicar después de sist_generico.sql. Ejecutar con un usuario con privilegio CREATE/REFERENCES (no con ck_aplicacion).
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `sgen_sesion` (
  `ses_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `ses_familia` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Familia de sesión: hex de 16 bytes aleatorios',
  `ses_usuId` int(11) NOT NULL,
  `ses_hashAcceso` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 hex del access token',
  `ses_hashRefresh` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 hex del refresh token',
  `ses_accesoExpira` datetime NOT NULL COMMENT 'UTC',
  `ses_refreshExpira` datetime NOT NULL COMMENT 'UTC: emisión + inactividad, tope ses_familiaExpira',
  `ses_familiaExpira` datetime NOT NULL COMMENT 'UTC: inicio de la familia + máximo',
  `ses_fechaCreacion` datetime NOT NULL COMMENT 'UTC',
  `ses_ultimoUso` datetime NOT NULL COMMENT 'UTC, se actualiza como máximo cada 60 s',
  `ses_ip` varchar(45) NOT NULL,
  `ses_agenteUsuario` varchar(255) NOT NULL DEFAULT '',
  `ses_navegador` varchar(16) NOT NULL DEFAULT 'OTRO',
  `ses_cliente` char(1) NOT NULL COMMENT 'W Web/PWA\r\nN Nativo',
  `ses_estado` char(1) NOT NULL DEFAULT 'A' COMMENT 'A Activa\r\nR Rotada\r\nV Revocada',
  `ses_motivoRevocacion` varchar(24) DEFAULT NULL COMMENT 'CIERRE_SESION, CIERRE_TODAS, REFRESH_REUTILIZADO, CLAVE_CAMBIADA, CLAVE_RESTABLECIDA',
  `ses_fechaRevocacion` datetime DEFAULT NULL COMMENT 'UTC: rotación o revocación',
  PRIMARY KEY (`ses_id`),
  UNIQUE KEY `sgen_sesion_hashacceso_uq` (`ses_hashAcceso`),
  UNIQUE KEY `sgen_sesion_hashrefresh_uq` (`ses_hashRefresh`),
  KEY `sgen_sesion_familia_idx` (`ses_familia`, `ses_estado`),
  KEY `sgen_usuario_sgen_sesion_fk` (`ses_usuId`, `ses_estado`),
  KEY `sgen_sesion_refreshexpira_idx` (`ses_refreshExpira`),
  KEY `sgen_sesion_familiaexpira_idx` (`ses_familiaExpira`),
  CONSTRAINT `sgen_usuario_sgen_sesion_fk` FOREIGN KEY (`ses_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sgen_intentoacceso` (
  `ina_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `ina_usuarioHash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 hex del usuario en minúsculas y sin espacios',
  `ina_ip` varchar(45) NOT NULL,
  `ina_fecha` datetime NOT NULL COMMENT 'UTC',
  PRIMARY KEY (`ina_id`),
  KEY `sgen_intentoacceso_usuario_idx` (`ina_usuarioHash`, `ina_fecha`),
  KEY `sgen_intentoacceso_ip_idx` (`ina_ip`, `ina_fecha`),
  KEY `sgen_intentoacceso_fecha_idx` (`ina_fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sgen_limitepeticion` (
  `lip_clave` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 hex de S:<familia> o I:<ip>',
  `lip_ventana` datetime NOT NULL COMMENT 'UTC: inicio del minuto',
  `lip_contador` int(10) UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`lip_clave`, `lip_ventana`),
  KEY `sgen_limitepeticion_ventana_idx` (`lip_ventana`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sgen_auditoria` (
  `aud_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `aud_fecha` datetime NOT NULL COMMENT 'UTC',
  `aud_evento` varchar(24) NOT NULL COMMENT 'Eventos de HU-001 D-01',
  `aud_servicio` varchar(24) NOT NULL COMMENT 'rest_usuario, rest_criteriokelly, rest_suscripcion, rest_divisas',
  `aud_usuId` int(11) DEFAULT NULL,
  `aud_sesFamilia` char(32) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `aud_ip` varchar(45) NOT NULL,
  `aud_agenteUsuario` varchar(255) NOT NULL DEFAULT '',
  `aud_detalle` varchar(255) NOT NULL DEFAULT '' COMMENT 'Nunca claves, tokens ni códigos',
  PRIMARY KEY (`aud_id`),
  KEY `sgen_auditoria_fecha_idx` (`aud_fecha`),
  KEY `sgen_auditoria_evento_idx` (`aud_evento`, `aud_fecha`),
  KEY `sgen_usuario_sgen_auditoria_fk` (`aud_usuId`, `aud_fecha`),
  CONSTRAINT `sgen_usuario_sgen_auditoria_fk` FOREIGN KEY (`aud_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

Tipos y motor siguen `sist_generico.sql:42,77-85` (`InnoDB`, `utf8mb4_general_ci`, `int(11)` para la FK a `usu_idUsuario`).

#### T-04 · `ClienteIp`

- `final class ClienteIp` · `public static function obtener(): string` (memoriza en `private static ?string $ipResuelta`).
- Algoritmo: `$remota = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'`; `$cabecera = Configuracion::obtener('IP_CABECERA_CONFIABLE')`; si `$cabecera === ''` → `$remota`. Si no, y `self::estaEnAlgunRango($remota, Configuracion::obtenerLista('IP_PROXIES_CONFIABLES'))`, lee `$_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $cabecera))]`, aplica `trim` y lo acepta solo si `filter_var($valor, FILTER_VALIDATE_IP)` (un único valor; listas con coma se rechazan). En cualquier otro caso → `$remota`. Resultado normalizado con `inet_ntop(inet_pton($ip))`.
- `private static function estaEnAlgunRango(string $ip, array $rangosCidr): bool` y `private static function estaEnRango(string $ip, string $cidr): bool` con soporte IPv4 e IPv6 comparando bytes de `inet_pton` y máscara de bits; un CIDR mal formado devuelve `false`.
- Comando de aceptación: `cd rest_usuario && $PHP -r "require 'vendor/autoload.php'; require 'configuracion/Configuracion.php'; require 'configuracion/ClienteIp.php'; Configuracion::cargar(); \$_SERVER['REMOTE_ADDR']='127.0.0.1'; \$_SERVER['HTTP_X_FORWARDED_FOR']='203.0.113.9'; echo ClienteIp::obtener();"` → `127.0.0.1` (si `Configuracion::cargar` requiere argumento, se usa el que documenta HLT-01 para `__DIR__`).

#### T-05 · `ContextoSesion`

`final class ContextoSesion` con estado privado estático `?int $idUsuario`, `array $roles = []`, `?int $idSesion`, `?string $familia`, y exactamente 7 métodos públicos estáticos: `establecer(int $idUsuario, array $roles, int $idSesion, string $familia): void`, `estaAutenticado(): bool`, `idUsuario(): int`, `roles(): array` (`list<array{rol_id:int, rol_descripcion:string}>`), `idSesion(): int`, `familia(): string`, `limpiar(): void`. `idUsuario()`, `idSesion()` y `familia()` lanzan `LogicException('Sesión no establecida')` si no hay sesión.

#### T-06 · `RegistroAuditoria`

- `final class RegistroAuditoria` · `public const EVENTOS = ['LOGIN_OK','LOGIN_FALLIDO','BLOQUEO_USUARIO','BLOQUEO_IP','LIMITE_PETICIONES','RENOVAR','REFRESH_REUTILIZADO','SESION_ANOMALA','CIERRE_SESION','CIERRE_TODAS','RECUPERACION_SOLICITADA','CLAVE_RESTABLECIDA','CLAVE_CAMBIADA','ACCESO_DENEGADO'];`
- `public function __construct(private Enlace $enlace, private string $servicio)`.
- `public function registrar(string $evento, ?int $idUsuario = null, ?string $familia = null, string $detalle = ''): void`: lanza `InvalidArgumentException` si `!in_array($evento, self::EVENTOS, true)` o si `preg_match('/[A-Za-z0-9_-]{32,}/', $detalle) === 1`; trunca `$detalle` a 255 con `mb_substr`; UA = `$_SERVER['HTTP_USER_AGENT'] ?? ''` sin caracteres de control (`preg_replace('/[\x00-\x1F\x7F]/', '', …)`) truncado a 255; IP = `ClienteIp::obtener()`; fecha `gmdate('Y-m-d H:i:s')`.
- SQL: `INSERT INTO sgen_auditoria (aud_fecha, aud_evento, aud_servicio, aud_usuId, aud_sesFamilia, aud_ip, aud_agenteUsuario, aud_detalle) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` con tipos `"sssissss"`.

#### T-07 · `ValidadorSesion`

- `final class ValidadorSesion` · `public const MENSAJE_NO_VALIDA = 'Sesión no válida o expirada';` · `private const SEGUNDOS_ACTUALIZAR_USO = 60;`
- `public function __construct(private Enlace $enlace)` · `public function exigir(): void` · `public static function calcularHash(string $token): string` (`hash('sha256', $token)`) · `public static function esFormatoValido(string $token): bool` (`preg_match('/^[A-Za-z0-9_-]{43}$/', $token) === 1`) · `private function leerTokenBearer(): ?string` (de `$_SERVER['HTTP_AUTHORIZATION']` o `$_SERVER['REDIRECT_HTTP_AUTHORIZATION']`, regex `/^Bearer ([^\s]+)$/i`; nunca lee `$_GET`, cuerpo ni `$_COOKIE`) · `private function responderError(…)` (D-24).
- SQL de sesión (tipos `"sss"`: hash, ahora, ahora):
  ```sql
  SELECT s.ses_id, s.ses_familia, s.ses_usuId, s.ses_hashAcceso, s.ses_ultimoUso
  FROM sgen_sesion s
  INNER JOIN sgen_usuario u ON u.usu_idUsuario = s.ses_usuId
  WHERE s.ses_hashAcceso = ? AND s.ses_estado = 'A' AND s.ses_accesoExpira > ? AND s.ses_familiaExpira > ?
    AND u.usu_estado = '1' AND u.usu_situacion = 'A'
  LIMIT 1
  ```
- SQL de roles (tipo `"i"`), igual al de `ValidacionMdl.php:31-34`: `SELECT r.rol_id, r.rol_descripcion FROM sgen_rolusuario ru INNER JOIN sgen_rol r ON ru.rus_rolId = r.rol_id WHERE ru.rus_usuId = ? AND ru.rus_estado = '1' ORDER BY r.rol_id`; cada rol se castea a `['rol_id' => (int), 'rol_descripcion' => (string)]`.
- Uso: si `time() - strtotime($fila['ses_ultimoUso'] . ' UTC') >= 60` → `UPDATE sgen_sesion SET ses_ultimoUso = ? WHERE ses_id = ?` (`"si"`).
- Cualquier fallo de formato, ausencia de fila o `!hash_equals($fila['ses_hashAcceso'], $hash)` → `responderError(401, self::MENSAJE_NO_VALIDA)`.

#### T-08 · `LimitadorPeticiones`

- Constantes de D-32 + `public const MENSAJE_LIMITE = 'Demasiados intentos, intente nuevamente más tarde';`
- `public function __construct(private Enlace $enlace, private RegistroAuditoria $auditoria)`.
- `public function controlar(): void` — Flujo F paso 9. SQL: `INSERT INTO sgen_limitepeticion (lip_clave, lip_ventana, lip_contador) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE lip_contador = lip_contador + 1` (`"ss"`) y `SELECT lip_contador FROM sgen_limitepeticion WHERE lip_clave = ? AND lip_ventana = ?` (`"ss"`); ventana `gmdate('Y-m-d H:i:00')`. Auditoría `LIMITE_PETICIONES` con `idUsuario`/`familia` si hay sesión y detalle `'limite=<n>'`.
- `public function verificarIntentoLogin(string $usuarioNormalizado): void` — D-15. Conteos: `SELECT COUNT(*) AS total, MIN(ina_fecha) AS primera FROM sgen_intentoacceso WHERE ina_usuarioHash = ? AND ina_fecha > ?` y lo mismo por `ina_ip`. Inserción: `INSERT INTO sgen_intentoacceso (ina_usuarioHash, ina_ip, ina_fecha) VALUES (?, ?, ?)`. `Retry-After` según D-16.
- `public function registrarFalloLogin(string $usuarioNormalizado, ?int $idUsuario): void` — audita `LOGIN_FALLIDO` (detalle vacío); recuenta; si conteo usuario `=== 5` audita `BLOQUEO_USUARIO`; si conteo IP `=== 20` audita `BLOQUEO_IP`.
- `public function registrarExitoLogin(string $usuarioNormalizado): void` — `DELETE FROM sgen_intentoacceso WHERE ina_usuarioHash = ?`.
- `private function hashUsuario(string $usuarioNormalizado): string` = `hash('sha256', $usuarioNormalizado)`.

#### T-09 · Copia

`cp rest_usuario/configuracion/{ClienteIp,ContextoSesion,RegistroAuditoria,ValidadorSesion,LimitadorPeticiones}.php rest_<x>/configuracion/` para `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas`; aceptación con el comando de plan §4.2.

#### T-10 · `EmisorTokens`

`final class EmisorTokens`:
- `public function generarToken(): string` → `rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=')`.
- `public function generarFamilia(): string` → `bin2hex(random_bytes(16))`.
- `public function calcularVencimientos(int $ahora, ?int $familiaExpira): array` → `['accesoExpira' => $ahora + 60 * TOKEN_ACCESO_MINUTOS, 'familiaExpira' => $familiaExpira ?? $ahora + 86400 * TOKEN_REFRESH_MAXIMO_DIAS, 'refreshExpira' => min($ahora + 86400 * TOKEN_REFRESH_INACTIVIDAD_DIAS, familiaExpira)]` (valores con `Configuracion::obtenerEntero`).
- `public function formatearIso(int $marca): string` → `gmdate(DATE_ATOM, $marca)`.
- Aceptación: `cd rest_usuario && $PHP -r "require 'servicios/EmisorTokens.php'; \$e=new EmisorTokens(); echo strlen(\$e->generarToken()),' ',strlen(\$e->generarFamilia());"` → `43 32`.

#### T-11 · `CanalRefresh`

`final class CanalRefresh`:
- `public const CLIENTE_WEB = 'W'; public const CLIENTE_NATIVO = 'N'; private const VALOR_REQUESTED_WITH = 'CriterioKelly';`
- `public function esClienteNativo(): bool` → `($_SERVER['HTTP_X_CLIENTE'] ?? '') === 'nativo' && in_array($_SERVER['HTTP_ORIGIN'] ?? '', Configuracion::obtenerLista('CORS_ORIGENES_NATIVOS'), true)`.
- `public function codigoCliente(): string` → `N` o `W`.
- `public function exigirOrigenConfiable(RegistroAuditoria $auditoria, ?int $idUsuario): void` → si `Origin` ∉ web ∪ nativos o `HTTP_X_REQUESTED_WITH` ≠ `CriterioKelly`: audita `ACCESO_DENEGADO` (detalle `'origen no permitido'`) y responde 403 `Acceso denegado` (D-24).
- `public function leerRefresh(array $cuerpo): ?string` → nativo: `$cuerpo['refreshToken']` si es string; web: `$_COOKIE[COOKIE_REFRESH_NOMBRE]` si es string; devuelve `null` si no pasa `ValidadorSesion::esFormatoValido`.
- `public function entregar(array $respuesta, string $refresh, int $refreshExpira): array` → nativo: agrega `'refreshToken'`; web: `setcookie(nombre, $refresh, ['expires' => $refreshExpira, 'path' => COOKIE_REFRESH_RUTA, 'secure' => COOKIE_REFRESH_SEGURA, 'httponly' => true, 'samesite' => 'Strict'])`, sin `domain`.
- `public function borrarCookie(): void` → solo si el canal es web: mismo `setcookie` con valor `''` y `'expires' => 1`.

#### T-12 · `SesionMdl`

`class SesionMdl` · `public function __construct(private Enlace $enlace)`; métodos (todas las fechas como string UTC `Y-m-d H:i:s`):
- `iniciarTransaccion()`, `confirmarTransaccion()`, `revertirTransaccion()` → delegan en `Enlace`.
- `crearSesion(int $idUsuario, string $familia, string $hashAcceso, string $hashRefresh, string $accesoExpira, string $refreshExpira, string $familiaExpira, string $ahora, string $ip, string $agente, string $navegador, string $cliente): int` → `INSERT INTO sgen_sesion (ses_familia, ses_usuId, ses_hashAcceso, ses_hashRefresh, ses_accesoExpira, ses_refreshExpira, ses_familiaExpira, ses_fechaCreacion, ses_ultimoUso, ses_ip, ses_agenteUsuario, ses_navegador, ses_cliente, ses_estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'A')` con `"sisssssssssss"` (ahora se pasa a `ses_fechaCreacion` y `ses_ultimoUso`) y devuelve el id.
- `buscarPorRefreshParaActualizar(string $hashRefresh): ?array` → `SELECT ses_id, ses_familia, ses_usuId, ses_hashRefresh, ses_estado, ses_refreshExpira, ses_familiaExpira, ses_cliente, ses_navegador FROM sgen_sesion WHERE ses_hashRefresh = ? FOR UPDATE`.
- `marcarRotada(int $idSesion, string $ahora): int` → `UPDATE sgen_sesion SET ses_estado = 'R', ses_fechaRevocacion = ? WHERE ses_id = ? AND ses_estado = 'A'`; devuelve filas afectadas.
- `revocarFamilia(string $familia, string $motivo, string $ahora): int` → `UPDATE sgen_sesion SET ses_estado = 'V', ses_motivoRevocacion = ?, ses_fechaRevocacion = ? WHERE ses_familia = ? AND ses_estado = 'A'`.
- `revocarTodasDeUsuario(int $idUsuario, string $motivo, string $ahora): int` → igual con `WHERE ses_usuId = ? AND ses_estado = 'A'`.
- `public static function clasificarNavegador(string $agente): string` con las reglas de D-19 en ese orden.

#### T-13 · `ValidacionMdl`

- Constructor: `public function __construct(?Enlace $enlace = null) { $this->conexion = $enlace ?? new Enlace(); }` (reemplaza `ValidacionMdl.php:10-13`).
- Reemplaza `autenticarUsuario` (`:15-27`) por `buscarUsuarioParaAutenticar(string $usuario): ?array` → `SELECT u.usu_idUsuario, u.usu_clave, u.usu_situacion, p.per_nombres, p.per_apellidos FROM sgen_usuario u INNER JOIN sgen_persona p ON u.usu_perIdPerso = p.per_idPersona WHERE u.usu_usuario = ? AND u.usu_estado = '1' LIMIT 1`.
- Nuevo `actualizarHashClave(int $idUsuario, string $hash): void` → `UPDATE sgen_usuario SET usu_clave = ? WHERE usu_idUsuario = ?`.
- Nuevo `obtenerUsuarioActivoPorId(int $idUsuario): ?array` → `SELECT u.usu_idUsuario, p.per_nombres, p.per_apellidos FROM sgen_usuario u INNER JOIN sgen_persona p ON u.usu_perIdPerso = p.per_idPersona WHERE u.usu_idUsuario = ? AND u.usu_estado = '1' AND u.usu_situacion = 'A' LIMIT 1`.
- `obtenerRolesUsuarios`, `actualizarCodigoRecuperacionUsuario`, `obtenerCodigoRecuperacionUsuario` y `actualizarClaveUsuario` (`:29-68`) **no se tocan** (HLT-06).

#### T-14 · `ValidacionCtrl::autenticarUsuario`

- Propiedades tipadas: `ValidacionMdl $validacionModelo`, `SesionMdl $sesionModelo`, `LimitadorPeticiones $limitador`, `RegistroAuditoria $auditoria`, `EmisorTokens $emisor`, `CanalRefresh $canal`. El constructor crea **una** `Enlace` y la inyecta (D-22); `RegistroAuditoria` recibe `SERVICIO_ACTUAL`.
- `private const HASH_FICTICIO = '<valor generado según D-11>';` `private const MENSAJE_CREDENCIALES = 'Usuario o clave incorrectos';`
- Pasos del Flujo A en ese orden. La normalización de la clave usa `htmlspecialchars(trim($clave), ENT_QUOTES, 'UTF-8')` (D-13) y la del usuario para la consulta `htmlspecialchars(trim($usuario), ENT_QUOTES, 'UTF-8')`.
- `private function construirRespuestaSesion(array $usuario, array $roles, string $accessToken, int $accesoExpira): array` → `['id' => (int), 'nombres' => (string), 'apellidos' => (string), 'roles' => $roles, 'accessToken' => $accessToken, 'accessExpira' => $this->emisor->formatearIso($accesoExpira)]` (compartido con T-15).
- `private function emitirSesion(int $idUsuario, ?string $familia, ?int $familiaExpira, int $ahora): array` → genera tokens/vencimientos y llama `SesionMdl::crearSesion` (compartido con T-15); devuelve tokens y vencimientos.
- Antes de responder: `header('Cache-Control: no-store'); header('Pragma: no-cache');`.
- El `catch` de cada método público pasa a `Throwable`, registra `error_log('[ValidacionCtrl::<metodo>] ' . $error->getMessage())`, revierte si hay transacción abierta y responde 500 `Error interno del servidor`.

#### T-15 · `ValidacionCtrl::renovarSesion(array $cuerpo)`

Flujo B completo. Las fechas de la fila se convierten con `strtotime($valor . ' UTC')`. `SESION_ANOMALA` lleva detalle `'navegador <ANTERIOR>-><ACTUAL>'`. Todo 401 llama antes a `$this->canal->borrarCookie()`.

#### T-16 · `cerrarSesion()` y `cerrarTodasLasSesiones()`

Flujos C y D. Ambos devuelven `respuestaExitosaSimple(null)` → `{"success":"ok"}`.

#### T-17 · `obtenerRolesUsuario(?string $idQuery)`

Flujo E. Responde `respuestaExitosaSimple(ContextoSesion::roles())`; si el arreglo está vacío responde `[]` (no `null`, porque `respuestaExitosaSimple(null)` produciría `{"success":"ok"}`): usar `respuestaJsonSimple([], 200)`.

#### T-18 · `ValidacionRts`

- La acción se toma de la variable de acción que deja el `Enrutador` en `index.php` (IR-03) y se elimina el bucle propio `ValidacionRts.php:13-23`.
- `GET usRol` (`:65-72`): deja de exigir `id`; pasa `$_GET['id'] ?? null` (string o null) al controlador.
- `POST` (`:81-127`): para `renovar`, `cerrarSesion` y `cerrarTodas` se acepta cuerpo ausente o `{}` (D-25); para el resto se mantiene la validación del cuerpo que haya dejado HLT-02. Nuevos `case`: `renovar` → `renovarSesion($datos ?? [])`, `cerrarSesion` → `cerrarSesion()`, `cerrarTodas` → `cerrarTodasLasSesiones()`. `generarCodigo`, `obtenerCodigo` y `PUT actualizarClave` se mantienen (HLT-06).
- El `GET` sin acción conserva la respuesta que dejó HLT-02 (plan O-04).

#### T-19 … T-22 · Guardia en `index.php`

Bloque idéntico en los 4 archivos, salvo las dos constantes:

```php
const SERVICIO_ACTUAL = 'rest_usuario';                 // rest_criteriokelly | rest_suscripcion | rest_divisas
const RUTAS_PUBLICAS = [                                 // plan maestro §4.5
    'autenticacion/autenticar',
    'autenticacion/renovar',
    'autenticacion/solicitarRecuperacion',
    'autenticacion/restablecerClave',
    'persona/agregar',
];                                                       // rest_suscripcion: ['planes/disponible']; rest_criteriokelly y rest_divisas: []

// Paso 8 y 9 (HLT-03), entre el paso 7 y el require del paso 10
$enlaceSeguridad = new Enlace();
$auditoriaSeguridad = new RegistroAuditoria($enlaceSeguridad, SERVICIO_ACTUAL);
$esRutaPublica = ($metodo === 'GET' && $accion === '')
    || in_array($recurso . '/' . $accion, RUTAS_PUBLICAS, true);
if (!$esRutaPublica) {
    (new ValidadorSesion($enlaceSeguridad))->exigir();
}
(new LimitadorPeticiones($enlaceSeguridad, $auditoriaSeguridad))->controlar();
```

`$metodo`, `$recurso` y `$accion` son los nombres que IR-03 confirmó; si HLT-02 usa otros nombres, se usan los de HLT-02 **solo si** T-01 los registró en su evidencia (sustitución 1:1 de nombres de variable, sin cambiar la lógica). Los `require_once` de las 5 clases van junto a los de HLT-01/02.

#### T-23 · `limpiarSeguridad.php`

- Primera instrucción ejecutable tras `declare`: `if (PHP_SAPI !== 'cli') { exit(1); }`.
- Arranque: `$rutaAplicacion = dirname(__DIR__)`; `require $rutaAplicacion . '/vendor/autoload.php'`; requiere `Configuracion.php` y `enlace.php`; `Configuracion::cargar(...)` igual que el paso 2 de `index.php`.
- Borrados (cada uno en bucle `DELETE … LIMIT 5000` hasta afectar 0):
  - Sesiones: `DELETE FROM sgen_sesion WHERE ses_familia IN (SELECT f FROM (SELECT ses_familia AS f FROM sgen_sesion GROUP BY ses_familia HAVING MAX(ses_refreshExpira) <= ? OR MAX(ses_familiaExpira) <= ? LIMIT 5000) t)`.
  - Intentos: `DELETE FROM sgen_intentoacceso WHERE ina_fecha <= ? LIMIT 5000` con `ahora − 900 s`.
  - Contadores: `DELETE FROM sgen_limitepeticion WHERE lip_ventana <= ? LIMIT 5000` con `ahora − 120 s`.
  - Auditoría: `DELETE FROM sgen_auditoria WHERE aud_fecha <= ? LIMIT 5000` con `ahora − 180 días`.
- Salida: `fwrite(STDOUT, "sesiones=$a intentos=$b contadores=$c auditoria=$d\n")`; `exit(0)`. En excepción: `error_log('[limpiarSeguridad] ' . $e->getMessage())`, `fwrite(STDERR, "Error en el mantenimiento\n")`, `exit(1)`.
- Cabecera de comentario con el cron de referencia para HLT-11: `*/15 * * * * php /ruta/privada/rest_usuario/mantenimiento/limpiarSeguridad.php`.

#### T-24 … T-27 · `seguridad_01_pruebas.sh`

Script Git Bash con `set -u`, variables `URL`, `PHP`, `MYSQL`, `ORIGEN_WEB=http://localhost:8100`, `ORIGEN_NATIVO=capacitor://localhost`, funciones `ok`/`fallo` y un argumento de sección (`preparar | sesion | limites | auditoria`). Extrae la cookie con `grep -i '^set-cookie: ck_refresh=' | sed` y la reenvía con `-H "Cookie: ck_refresh=<valor>"` (no usa cookie jar, porque `Secure` sobre `http://localhost` depende de la versión de curl).

**Sección `preparar` (T-24)**
- Borra datos previos de prueba: `DELETE FROM sgen_intentoacceso; DELETE FROM sgen_limitepeticion;` (solo base local).
- Crea `prueba_hlt03a` y `prueba_hlt03b` con `POST persona/agregar` (claves `Clave#Prueba&2026a` y `Clave#Prueba&2026b`, correos `prueba_hlt03a@localhost`/`…b@localhost`, teléfonos `0990000301`/`0990000302`); si ya existen (409) continúa.
- Los activa: `UPDATE sgen_usuario SET usu_situacion = 'A' WHERE usu_usuario IN ('prueba_hlt03a','prueba_hlt03b')`.
- `OK preparar` si ambos `autenticar` devuelven 200.

**Sección `sesion` (T-25)** — cada caso imprime `OK <id>`:

| Caso | Petición | Esperado |
|------|----------|----------|
| `A01-web` | `autenticar` con `Origin: ORIGEN_WEB`, `X-Requested-With` | 200; cuerpo con `id,nombres,apellidos,roles,accessToken,accessExpira` y **sin** `refreshToken`; `Set-Cookie` con `HttpOnly`, `SameSite=Strict`, `path=/criterio_kelly/rest_usuario/autenticacion/` y `secure` si `COOKIE_REFRESH_SEGURA=true`; `Cache-Control: no-store`; `accessExpira` termina en `+00:00` |
| `A01-nativo` | `autenticar` con `X-Cliente: nativo`, `Origin: ORIGEN_NATIVO` | 200 con `refreshToken` (43 caracteres) y sin `Set-Cookie` |
| `A01-nativo-origen-web` | `X-Cliente: nativo` + `Origin: ORIGEN_WEB` | 200 sin `refreshToken` y con `Set-Cookie` |
| `A02-mensaje` | clave errónea; usuario inexistente; usuario `unos` (situación `P`) | 401 y cuerpo idéntico `{"error":"Usuario o clave incorrectos"}` en los 3 |
| `A02-tiempo` | 4 logins con clave errónea de `prueba_hlt03b` y 4 con usuarios inexistentes distintos; luego limpia intentos | |mediana inexistente − mediana existente| ≤ 25 % de la mediana existente |
| `B01-rehash` | `SELECT LEFT(usu_clave,9) … WHERE usu_usuario='prueba_hlt03a'` tras el login | `$argon2id` |
| `A03-sin-token`, `A03-inventado`, `A03-formato`, `A03-query` | `usRol` sin cabecera; Bearer de 43 caracteres aleatorios; Bearer `abc`; token válido solo en `?access_token=` | 401 `Sesión no válida o expirada` en los 4 |
| `A03-vencido` | `UPDATE sgen_sesion SET ses_accesoExpira = '2000-01-01 00:00:00' WHERE ses_hashAcceso = '<sha256>'` y `usRol` | 401 |
| `C03-roles` | `usRol` con Bearer válido | 200 arreglo igual a `roles` del login |
| `C03-id-ajeno` | `usRol?id=<id de prueba_hlt03b>` con token de `a` | 403 `Acceso denegado` |
| `E07-sin-origen`, `E07-origen-malo`, `E07-sin-xrw` | `renovar` con cookie válida sin `Origin`; con `Origin: https://evil.example`; sin `X-Requested-With` | 403 `Acceso denegado` |
| `A04-rota` | `renovar` web válido | 200; nueva cookie distinta; el access anterior → 401; el nuevo → 200 |
| `A04-reuso` | `renovar` con la cookie **anterior** | 401; luego la cookie **nueva** → 401; `SELECT COUNT(*) FROM sgen_auditoria WHERE aud_evento='REFRESH_REUTILIZADO'` aumentó en 1 |
| `RN21-canal` | refresh nativo enviado como cookie web | 401 |
| `A09-anomala` | `renovar` nativo con `User-Agent` de Chrome tras login con `User-Agent` de Firefox | 200 y +1 `SESION_ANOMALA` |
| `A05-cerrar` | token válido de `a` contra `rest_usuario/autenticacion/usRol`, `rest_criteriokelly/cuentas/obtener?id=<id>`, `rest_suscripcion/suscripcion/porUsuario?id=<id>`, `rest_divisas/cripto/disponible` → ≠ 401; `cerrarSesion` (con `Origin` y `X-Requested-With`) → 200 + cookie borrada; repetir las 4 | 4 × 401 después del cierre |
| `A05-todas` | 2 logins de `b`; `cerrarTodas` con uno | ambos access → 401 |

**Sección `limites` (T-26)**

| Caso | Petición | Esperado |
|------|----------|----------|
| `A06-usuario` | 5 logins fallidos de `prueba_hlt03a`; 6.º con la clave **correcta** | 6.º → 429 con `Retry-After` entre 1 y 900; +1 `BLOQUEO_USUARIO`; limpia `sgen_intentoacceso` |
| `A06-ip` | 20 logins fallidos con usuarios inexistentes distintos; 21.º | 429 con `Retry-After`; +1 `BLOQUEO_IP`; limpia |
| `IP-xff` | login fallido con `X-Forwarded-For: 203.0.113.9` | `SELECT ina_ip … ORDER BY ina_id DESC LIMIT 1` ∈ {`127.0.0.1`, `::1`} |
| `A06-publico` | espera a que `date +%S` ≤ 5; 61 `GET` a `rest_usuario/autenticacion` | 61.º → 429 con `Retry-After` ≤ 60; +1 `LIMITE_PETICIONES` |
| `A06-sesion` | espera al minuto siguiente; 301 `GET usRol` con un mismo Bearer | 301.º → 429 |
| `A07-publicas` | `GET` sin acción en los 4 backends; `GET rest_suscripcion/planes/disponible`; `POST rest_usuario/persona/agregar` con cuerpo inválido | ≠ 401 en todos; el `GET` sin acción solo contiene las claves `servicio` y `estado` |
| `A07-protegidas` | sin token: `rest_criteriokelly/cuentas/obtener?id=1`, `rest_suscripcion/suscripcion/porUsuario?id=1`, `rest_divisas/cripto/disponible`, `rest_divisas/forex/disponible`, `rest_usuario/autenticacion/cerrarSesion`, `rest_usuario/autenticacion/actualizarClave` (PUT) | 401 en todos |
| `BYPASS-*` | sin token y con `--path-as-is`: `rest_usuario/persona/agregar/../autenticacion/usRol`, `rest_usuario/autenticacion/usRol/persona/agregar`, `rest_usuario//autenticacion/usRol`, `rest_usuario/autenticacion/usRol/`, `rest_suscripcion/planes/disponible/../../suscripcion/porUsuario?id=1`, `rest_suscripcion/suscripcion/planes/disponible`, `rest_criteriokelly/cuentas/obtener%2F..%2F`, `rest_usuario/Autenticacion/autenticar` | ninguno responde 200; códigos ∈ {400, 401, 403, 404, 405} |

**Sección `auditoria` (T-27)**

| Caso | Verificación | Esperado |
|------|--------------|----------|
| `D01-eventos` | `SELECT DISTINCT aud_evento FROM sgen_auditoria` | contiene `LOGIN_OK, LOGIN_FALLIDO, BLOQUEO_USUARIO, BLOQUEO_IP, LIMITE_PETICIONES, RENOVAR, REFRESH_REUTILIZADO, SESION_ANOMALA, CIERRE_SESION, CIERRE_TODAS, ACCESO_DENEGADO` |
| `D02-sin-tokens` | para cada access/refresh emitido en la corrida: `SELECT COUNT(*) FROM sgen_auditoria WHERE aud_detalle LIKE '%<token>%' OR aud_agenteUsuario LIKE '%<token>%'`; `SELECT COUNT(*) FROM sgen_sesion WHERE ses_hashAcceso='<token>' OR ses_hashRefresh='<token>'`; `grep -rl "<token>" <RUTA_LOGS>` | 0, 0 y sin archivos |
| `D02-hash` | `SELECT COUNT(*) FROM sgen_sesion WHERE ses_hashAcceso = '<sha256 del access vigente>'` | 1 |
| `O03-latencia` | 50 `GET usRol` autenticados secuenciales con `-w "%{time_total}"` (tras esperar al minuto siguiente) | Imprime media y máximo; media < 0,200 s en local |
| `O03-explain` | `EXPLAIN` de la consulta de T-07 con un hash cualquiera | `key = sgen_sesion_hashacceso_uq` y `type` ∈ {`const`, `eq_ref`} |
| `D03-limpieza` | `UPDATE sgen_sesion SET ses_refreshExpira='2000-01-01 00:00:00', ses_familiaExpira='2000-01-01 00:00:00' WHERE ses_usuId = <id de b>`; insertar 1 `sgen_auditoria` con `aud_fecha='2000-01-01 00:00:00'`; ejecutar `limpiarSeguridad.php` | salida 0; `sesiones` ≥ 1, `auditoria` ≥ 1; las filas ya no existen |
| `D03-http` | `curl $URL/rest_usuario/mantenimiento/limpiarSeguridad.php` | 403 o 404 |

#### T-28 … T-30 · Documentación

- **T-28 `rest_usuario/README.md`**: Stack (PHP 8.2, Composer, tokens opacos); Instalación (aplicar `seguridad_01_sesion.sql` después de `sist_generico*.sql`); tabla de `/autenticacion` con `autenticar`, `renovar`, `cerrarSesion`, `cerrarTodas`, `usRol` según plan §4.5 y cabeceras (`Authorization: Bearer`, `X-Requested-With`, `X-Cliente`); sección "Seguridad de sesión" (TTL, rotación, reutilización, cookie, límites, `RUTAS_PUBLICAS`, auditoría, `limpiarSeguridad.php` y su cron, normalización `htmlspecialchars(trim())` de la clave y su vínculo con HLT-06, cómo ejecutar `anexos/pruebas/seguridad_01_pruebas.sh`); "Estado actual": `actualizarClave`, `generarCodigo`, `obtenerCodigo` y `persona/actualizarDeApp` exigen token pero aún aceptan un `id` ajeno hasta HLT-06; usuarios en situación `P` no inician sesión.
- **T-29**: sección "Autenticación" en los README de `rest_criteriokelly`, `rest_suscripcion` y `rest_divisas`: todo endpoint exige `Authorization: Bearer` emitido por `rest_usuario` salvo las rutas públicas de ese backend; 401/429 y su mensaje; las 5 clases compartidas y la regla sha256.
- **T-30**: `CLAUDE.md` raíz — `:31` (PHP 8.2+, Composer con `vlucas/phpdotenv`/`phpmailer`, `.env`), `:39` (credenciales en `.env`, no en `global.php`; `seguridad_01_sesion.sql`), `:52` (nombre real `ejecutarConsultaRetornarID` y métodos de transacción), `:56` (reemplazar por el modelo de tokens opacos, `ValidadorSesion`, `ContextoSesion`, `RUTAS_PUBLICAS`, 401/429). `.claude/agents/desarrollador-php.md` — `:12-13` (PHP 8.2+, Composer autorizado solo con las dos dependencias), `:74` (`PASSWORD_ARGON2ID` y la normalización de D-13), `:78` (tomar el usuario de `ContextoSesion`, nunca del cliente; 403 + `ACCESO_DENEGADO` si difiere), `:82` (secretos en `.env` vía `Configuracion`), `:154` (PHP 8.2).

---

## H8. Reglas de implementación deterministas

Rigen `.claude/agents/desarrollador-php.md` con los overrides del plan maestro §5. Reglas cerradas:

- **RI-P1 · Consultas preparadas** (`desarrollador-php.md` "Seguridad › Base de datos"): todo SQL de este HLT usa `Enlace` con cadena de tipos; cero interpolación de valores; columnas explícitas.
- **RI-P2 · Contrato de respuesta** ("Contrato de respuesta"): éxito con `respuestaExitosaSimple`/`respuestaJsonSimple`; error con `respuestaErrorSimple` o el `responderError` privado de D-24; mensajes exactos de plan §4.5; 422 prohibido.
- **RI-P3 · Capas** ("Arquitectura obligatoria"): SQL solo en `modelos/` y en las 5 clases compartidas; los `Ctrl` no contienen SQL; los `Rts` no contienen reglas.
- **RI-P4 · PHP 8.2** (plan §5.2): archivos nuevos con `declare(strict_types=1)` (D-36), tipos de parámetro, retorno y propiedad en todo método nuevo; promoción de propiedades en constructor permitida; no se usan `enum` ni `readonly` para mantener una sola forma en el código del proyecto.
- **RI-P5 · Aleatoriedad**: solo `random_bytes`; prohibidos `rand`, `mt_rand`, `uniqid`, `lcg_value` en código nuevo.
- **RI-P6 · Reloj**: solo `time()`/`gmdate()`; prohibido `date()` y `NOW()` en el código de este HLT (D-09).
- **RI-P7 · Comparaciones**: estrictas (`===`, `in_array(…, true)`); hashes con `hash_equals`.
- **RI-P8 · Errores** ("Errores y cabeceras"): `try/catch (Throwable)` en cada método público de `ValidacionCtrl`; `error_log('[Clase::metodo] ' . mensaje)` sin tokens, claves ni cuerpos; transacción abierta → `revertirTransaccion()` antes de responder.
- **RI-P9 · Nada de salida previa**: ningún `echo`, `var_dump` ni `print_r`; `setcookie`/`header` antes de la respuesta.
- **RI-P10 · Copia idéntica**: las 5 clases compartidas se editan **solo** en `rest_usuario/configuracion/` y se copian con T-09; si una tarea posterior las cambia, repite T-09 y el chequeo sha256.
- **RI-P11 · Sin efectos fuera de alcance**: una tarea toca solo los archivos de su fila; los bugs de líneas no modificadas se listan en el reporte (plan §5.7).
- **RI-P12 · Commits**: solo si el usuario los pide, en español, desde la carpeta del sub-proyecto (cada `rest_*` excepto `rest_divisas` es su propio repositorio).
- **RI-P13 · Datos de prueba**: los `UPDATE`/`DELETE` de las secciones de prueba solo se ejecutan contra la base local `sist_criteriokelly` y solo sobre los usuarios `prueba_hlt03*` o las tablas de seguridad.

Situaciones no cubiertas: se imita el archivo vecino del mismo backend; si contradice una RI, prevalece la RI y se registra en el reporte.

---

## H9. Reglas de seguimiento de ejecución

Lo mantiene el agente de implementación. Símbolos: `⬜` no realizado · `✅` realizado y verificado · `❌` fallido · `➖` no aplica. Reglas RS-1…RS-9 de `doc_modo_planificacion.md` §11.5. Checks sustituidos para backend: **C4** = `C:\xampp\php\php.exe -l` sin errores sobre cada archivo PHP tocado; **C5** = prueba `curl` del endpoint afectado (caso feliz + al menos un error) con la respuesta real. Para la tarea Ionic (T-03), C4 y C5 son `➖` (no hay TypeScript).

### 9.1 Fichas

```
T-01 — Verificar la interfaz de HLT-01/02
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: salida de IR-01…IR-10
    [⬜] C3. Respeta las reglas de implementación (H8, H11)
    [⬜] C4. php -l sobre lo tocado
    [⬜] C5. curl del endpoint afectado (feliz + error)
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

Las fichas T-02 a T-30 tienen **exactamente** el mismo formato, estado `PENDIENTE` y los seis checks en `⬜`; se diferencian solo en el título y en la evidencia esperada de C2:

```
T-02 — Crear el script de esquema de seguridad · C2: doble ejecución con salida 0 + SHOW CREATE TABLE
T-03 — Copiar el script de esquema a los anexos de la app · C2: sha256sum idéntico
T-04 — Crear ClienteIp · C2: php -r imprime 127.0.0.1
T-05 — Crear ContextoSesion · C2: grep de 7 métodos públicos estáticos
T-06 — Crear RegistroAuditoria · C2: grep de eventos y regex RN-24
T-07 — Crear ValidadorSesion · C2: grep de hash_equals, REDIRECT_HTTP_AUTHORIZATION y {43}
T-08 — Crear LimitadorPeticiones · C2: grep de ON DUPLICATE KEY UPDATE, Retry-After y constantes D-32
T-09 — Copiar las 5 clases compartidas a los otros 3 backends · C2: chequeo sha256 del plan §4.2 con 12 líneas en 1
T-10 — Crear EmisorTokens · C2: php -r imprime "43 32"
T-11 — Crear CanalRefresh · C2: grep de httponly, samesite Strict y CriterioKelly
T-12 — Crear SesionMdl · C2: grep FOR UPDATE = 1 y NOW() = 0
T-13 — Adaptar ValidacionMdl · C2: grep de los 3 métodos nuevos y ausencia de autenticarUsuario
T-14 — Reescribir ValidacionCtrl::autenticarUsuario y el constructor · C2: grep de HASH_FICTICIO, password_needs_rehash, PASSWORD_ARGON2ID, no-store
T-15 — Agregar ValidacionCtrl::renovarSesion · C2: grep de REFRESH_REUTILIZADO, SESION_ANOMALA, RENOVAR
T-16 — Agregar cerrarSesion y cerrarTodasLasSesiones · C2: grep de CIERRE_SESION y CIERRE_TODAS
T-17 — Reescribir obtenerRolesUsuario para leer de la sesión · C2: grep de ContextoSesion::roles()
T-18 — Registrar las acciones nuevas en ValidacionRts · C2: grep de los 3 case
T-19 — Agregar la guardia en rest_usuario/index.php · C2: usRol sin token 401, estado 200
T-20 — Agregar la guardia en rest_criteriokelly/index.php · C2: cuentas/obtener sin token 401
T-21 — Agregar la guardia en rest_suscripcion/index.php · C2: planes/disponible ≠ 401, porUsuario 401
T-22 — Agregar la guardia en rest_divisas/index.php · C2: cripto/disponible sin token 401
T-23 — Crear el script de mantenimiento · C2: salida 0 con contadores; HTTP 403/404
T-24 — Crear el script de pruebas con la preparación de datos · C2: "OK preparar"
T-25 — Agregar y ejecutar las pruebas de sesión · C2: solo líneas OK
T-26 — Agregar y ejecutar las pruebas de límites y guardia · C2: solo líneas OK
T-27 — Agregar y ejecutar las pruebas de auditoría, latencia y limpieza · C2: solo líneas OK + latencia + EXPLAIN
T-28 — Actualizar el README de rest_usuario · C2: grep de las 5 cadenas
T-29 — Documentar la guardia en los README de los otros 3 backends · C2: grep -l lista 3 archivos
T-30 — Actualizar CLAUDE.md raíz y desarrollador-php.md · C2: grep PHP 8.2 presente y cadenas obsoletas = 0
```

### 9.2 Tablero de avance global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-13 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-14 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-15 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-16 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-17 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-18 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-19 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-20 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-21 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-22 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-23 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-24 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-25 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-26 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-27 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-28 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-29 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-30 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

Si T-01 queda `BLOQUEADA`, ninguna otra tarea pasa a `EN_CURSO` (RS-6).

---

## H10. Diseño del reporte de ejecución

```
REPORTE DE EJECUCIÓN — HLT-03 Núcleo de sesión
  1. Resumen ejecutivo         (1–3 frases)
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas         (copia de H9 §9.2 con C1…C6)
  4. Cobertura vs. HLT         (cada fila de H4 §4.1 → resultado; ¿100 %?)
  5. Cambios realizados        (archivo ruta:línea, tipo: nuevo | modificado)
  6. Verificaciones ejecutadas (comando → OK/FALLO + salida real: IR-01…IR-10, php -l de cada archivo,
                                sha256 de §4.2, salida completa de las 4 secciones de seguridad_01_pruebas.sh,
                                latencia media/máxima y EXPLAIN de O-03)
  7. Desviaciones y decisiones (respecto a H5, con causa; incluye nombres de variables de index.php registrados en T-01)
  8. Pendientes / bloqueos     (checks en ⬜/❌ con acción requerida)
  9. Próximos pasos            (si el estado ≠ COMPLETADO; siempre listar los avisos para HLT-06 (D-13)
                                y HLT-07 (D-25, R-05, cerrarSesion con renovación previa))
```

Reglas RR-1…RR-5 de `doc_modo_planificacion.md` §12.2: `COMPLETADO` solo con las 30 tareas `HECHA`, todos los checks aplicables en `✅` y cobertura 100 % verificada; la sección 6 copia la salida real; nada no verificado se declara hecho.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

Las secciones 13.1–13.4 de `doc_modo_planificacion.md` son de Angular y aplican solo a T-03 (que no crea código). Para backend rigen `desarrollador-php.md` ("Nombres", "Estándares de código") y estas reglas:

| Elemento | Convención | En este HLT |
|----------|-----------|-------------|
| Rutas / controladores / modelos | `<Recurso>Rts`, `<Recurso>Ctrl extends BaseCtrl`, `<Recurso>Mdl` | `ValidacionRts`, `ValidacionCtrl`, `ValidacionMdl`, `SesionMdl` |
| Clases de servicio y compartidas | PascalCase, sustantivo de su responsabilidad, una clase por archivo con el mismo nombre | `EmisorTokens`, `CanalRefresh`, `ClienteIp`, `ContextoSesion`, `ValidadorSesion`, `LimitadorPeticiones`, `RegistroAuditoria` |
| Métodos | camelCase, verbo + objeto | `renovarSesion`, `revocarFamilia`, `verificarIntentoLogin`, `calcularHash` |
| Variables | camelCase descriptivo; booleanos `es/esta/tiene/existe` | `$hashRefresh`, `$esRutaPublica`, `$esClienteNativo` |
| Constantes | `UPPER_SNAKE_CASE` | `RUTAS_PUBLICAS`, `SERVICIO_ACTUAL`, `HASH_FICTICIO`, `API_MAX_POR_SESION` |
| SQL en variables | `$sql` + propósito | `$sqlBuscarSesionPorAcceso`, `$sqlRevocarFamilia` |
| Tablas y columnas | prefijo `sgen_` y prefijo de columna de 3 letras + camelCase, como `sist_generico.sql` | `sgen_sesion.ses_hashAcceso`, `sgen_auditoria.aud_sesFamilia` |
| Índices y FK | `<tabla>_<columna>_uq` / `_idx`; FK `<tablaPadre>_<tablaHija>_fk` (estilo `sist_generico.sql:108,155-156`) | `sgen_sesion_hashacceso_uq`, `sgen_usuario_sgen_sesion_fk` |
| Carpetas nuevas | minúsculas en español | `servicios/`, `mantenimiento/`, `anexos/pruebas/` |
| Archivos de esquema | `seguridad_<NN>_<tema>.sql` (plan §4.4) | `seguridad_01_sesion.sql` |
| Comentarios | español, solo el porqué (reglas de seguridad, fórmula de vencimientos); sin código comentado | — |

Arquitectura limpia (equivalente backend de AR-1…AR-6): responsabilidad única por clase (`EmisorTokens` crea, `CanalRefresh` transporta, `SesionMdl` persiste, `ValidadorSesion` valida, `LimitadorPeticiones` limita, `RegistroAuditoria` registra); dependencias por constructor; `ValidacionCtrl` orquesta sin SQL; reutilizar `BaseCtrl::validarDatos` y `respuesta*Simple`; ninguna lógica de sesión duplicada entre backends (solo las copias idénticas verificadas por sha256). El check C3 de cada ficha incluye esta sección; una tarea que la incumpla no se marca `HECHA`.
