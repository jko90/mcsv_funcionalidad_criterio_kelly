# Plan maestro · HU-001 Seguridad para producción

| Campo | Valor |
|-------|-------|
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Fecha | 2026-11-02 |
| Contrato de planificación | [docs/planificador.md](../planificador.md) + `criterioKellyApp/docs/doc_modo_planificacion.md` |
| Ubicación de los HLT | `docs/Planificacion/` (indicada por el usuario; reemplaza la ruta `criterioKellyApp/docs/hlt/` del planificador) |
| Estado | 9 HLT por redactar · 2 HLT bloqueados por datos del usuario |

## 1. Por qué varios HLT

HU-001 toca 5 proyectos, 4 servidores lógicos y más de 80 criterios. Un único HLT no sería ejecutable de forma atómica ni verificable por tarea. Se divide en **HLT por capa y por proyecto**, cada uno ejecutable por un solo tipo de agente y verificable de forma independiente.

Este plan maestro **fija los contratos compartidos** (sección 4). Ningún HLT puede contradecirlos: si un HLT necesita cambiar un contrato, primero se modifica este documento, en una versión nueva (`-v2`), y se revisan los HLT afectados.

## 2. Mapa de HLT

| HLT | Título | Proyectos | Agente | Depende de | Estado |
|-----|--------|-----------|--------|------------|--------|
| HLT-01 | Base de plataforma backend: PHP 8.2, Composer, `.env`, `Configuracion`, `Enlace` con transacciones, estructura fuera de `public_html` | 4 `rest_*` | `desarrollador-php` | Acciones previas del usuario (§6) | Por redactar |
| HLT-02 | Endurecimiento HTTP: `.htaccess`, enrutador, CORS, cabeceras, métodos, lectura de JSON, errores globales | 4 `rest_*` | `desarrollador-php` | HLT-01 | Por redactar |
| HLT-03 | Núcleo de sesión: esquema, tokens opacos, login, renovar, cerrar, límites, auditoría, guardia de rutas públicas | `rest_usuario` + copias compartidas en los 4 | `desarrollador-php` (+ `desarrollador-ionic` solo para copiar el SQL a `assets/anexos/`) | HLT-02 | Por redactar |
| HLT-04 | Autorización por dueño en `rest_criteriokelly` | `rest_criteriokelly` | `desarrollador-php` | HLT-03 | Por redactar |
| HLT-05 | Autorización por dueño en `rest_suscripcion` y protección de `rest_divisas` | `rest_suscripcion`, `rest_divisas` | `desarrollador-php` | HLT-03 | Por redactar |
| HLT-06 | Claves y recuperación: Argon2id, política, registro, recuperación por correo, cambio de clave, alertas | `rest_usuario` | `desarrollador-php` (+ `desarrollador-ionic` para la copia SQL) | HLT-03 | Por redactar |
| HLT-07 | Sesión en la app: `SesionStore`, interceptor, renovación, guardas, cierre de sesión, entornos, sin ids de usuario | `criterioKellyApp` | `desarrollador-ionic` | HLT-03, HLT-04, HLT-05 | Por redactar |
| HLT-08 | Claves y PIN en la app: recuperación, cambio de clave, política, PIN con PBKDF2 | `criterioKellyApp` | `desarrollador-ionic` | HLT-06, HLT-07 | Por redactar |
| HLT-09 | PWA y endurecimiento de la build web: service worker, manifest, CSP (`autoCsp`), build sin source maps ni logs | `criterioKellyApp` | `desarrollador-ionic` | HLT-07 | Por redactar |
| HLT-10 | Apps nativas Android/iOS: proyectos, `appId`, almacenamiento seguro nativo, configuración de red, privacy screen, firma | `criterioKellyApp` | `desarrollador-ionic` | HLT-07, **DH-13** | **BLOQUEADO** (§7) |
| HLT-11 | Despliegue, staging y verificación final: paquetes, servidores, WAF/ModSecurity, respaldo, ZAP, ASVS/MASVS, rotación de secretos | todos | ambos | HLT-01 a HLT-10, **DH-07, DH-10, DH-11, DH-12, DH-16** | **BLOQUEADO** (§7) |

### Orden de ejecución

```
HLT-01 ─▶ HLT-02 ─▶ HLT-03 ─┬─▶ HLT-04 ─┐
                            ├─▶ HLT-05 ─┼─▶ HLT-07 ─┬─▶ HLT-08
                            └─▶ HLT-06 ─┘           ├─▶ HLT-09
                                                    └─▶ HLT-10 (bloqueado)
                                         todos ───────▶ HLT-11 (bloqueado)
```

HLT-04, HLT-05 y HLT-06 se pueden ejecutar en paralelo porque tocan repositorios o archivos distintos. HLT-08 y HLT-09 también.

**Ventana de transición aceptada:** desde que termina HLT-03, los endpoints protegidos exigen token. Hasta que termina HLT-07, la app en local no puede usarlos. **No se despliega nada a un servidor real hasta cerrar HLT-11.** HLT-07 se ejecuta inmediatamente después de HLT-04 y HLT-05.

## 3. Cobertura HU-001 → HLT

Cada criterio de HU-001 tiene exactamente un HLT responsable (R). Otros HLT pueden apoyarse en él (A).

| Criterio HU | R | A |
|-------------|---|---|
| A-01, A-02, A-03, A-04, A-05, A-09 | HLT-03 | HLT-07 (consumo) |
| A-06 (límites login y API, IP real) | HLT-03 | HLT-11 (cabecera del WAF en producción) |
| A-07 (lista blanca pública + 401) | HLT-03 | HLT-04, HLT-05, HLT-06 |
| A-08 (30 min sin uso) | HLT-03 | Ver la observación O-01 (§8) |
| B-01 (Argon2id + rehash en login) | HLT-03 | HLT-06 |
| B-02, B-03, B-04, B-05, B-06, B-07 | HLT-06 | HLT-08 |
| C-01, C-02 | HLT-04 (`rest_criteriokelly`), HLT-05 (`rest_suscripcion`, `rest_divisas`), HLT-06 (`rest_usuario`: persona y autenticación) | — |
| C-03 (roles desde la sesión) | HLT-03 | — |
| C-04, C-07 | Cada HLT de backend en lo que toca | — |
| C-05 (transacciones) | HLT-01 (métodos de `Enlace`) | HLT-03, HLT-04, HLT-05, HLT-06 |
| C-06 (validación de entrada y JSON) | HLT-02 (`LectorSolicitud`) | HLT-03, HLT-04, HLT-05, HLT-06 (por endpoint) |
| C-08 (500 genérico) | HLT-02 (`ManejadorErrores`) | — |
| D-01, D-02 | HLT-03 | HLT-04, HLT-05, HLT-06 (`ACCESO_DENEGADO`) |
| D-03 (limpieza + alertas) | HLT-03 (limpieza) | HLT-06 (correo de alerta) |
| E-01 (estructura y `RUTA_APLICACION`) | HLT-01 | HLT-11 |
| E-02, E-04, E-05, E-06, E-08, E-09, E-10, E-11, E-12, E-13 | HLT-02 | HLT-11 |
| E-03 (paquete de despliegue), E-14 (ModSecurity/WAF) | HLT-11 | — |
| E-07 (CSRF de la cookie) | HLT-03 | HLT-07 |
| F-01 (`.env`, `.env.ejemplo`, `.gitignore`) | HLT-01 | — |
| F-02 (usuario MySQL) | HLT-01 | HLT-11 |
| F-03 (FMP: `.env` y SSL) | HLT-01 | HLT-11 (rotación) |
| F-04 (esquema) | HLT-03 (`seguridad_01`), HLT-06 (`seguridad_02`) | — |
| F-05 (respaldo) | HLT-11 | — |
| F-06 (`composer audit`, `npm audit`) | HLT-01 (`composer`), HLT-07 (`npm`) | HLT-11 |
| G-01 a G-06, G-08 | HLT-07 | — |
| G-07, G-09 | HLT-08 | — |
| G-10 (entornos) | HLT-07 (archivos de entorno y configuración `staging`) | HLT-09 (source maps y logs) |
| G-11 | HLT-07, HLT-08, HLT-09, HLT-10 | — |
| H-01, H-02, H-03, H-06 (CSP de la app), H-08 | HLT-09 | — |
| H-04 | HLT-07 | — |
| H-05, H-07, H-06 (cabeceras del servidor web) | HLT-11 | — |
| I-01 a I-06, I-08 | HLT-10 | — |
| I-07 | HLT-08 (PIN) | HLT-10 |
| J-01 | Cada HLT (cero URLs escritas a mano) | — |
| J-02, J-08 | HLT-01 (backends) | HLT-07 (app) |
| J-03 | HLT-07 | — |
| J-04 | HLT-06 | — |
| J-05 | HLT-10 | — |
| J-06 | Cada HLT (pruebas en local) | — |
| J-07 | HLT-11 | — |

## 4. Contratos compartidos (cerrados)

### 4.1 Configuración `.env`

Un `.env` por backend, leído con `vlucas/phpdotenv`. En local vive en la carpeta del backend y en el servidor fuera de `public_html`. Las claves se escriben en `UPPER_SNAKE_CASE` y en español.

| Clave | Backends | Ejemplo local | Validación al arrancar |
|-------|----------|---------------|------------------------|
| `APP_ENTORNO` | 4 | `local` | `local` \| `staging` \| `produccion` |
| `DB_HOST`, `DB_PUERTO`, `DB_NOMBRE`, `DB_USUARIO`, `DB_CLAVE` | 4 (`rest_divisas` solo la usa desde HLT-03) | `localhost`, `3306`, `sist_criteriokelly`, `ck_aplicacion`, `<clave>` | Obligatorias. Con `APP_ENTORNO=produccion`, `DB_USUARIO` no puede ser `root` y `DB_CLAVE` no puede estar vacía. |
| `DB_CHARSET` | 4 | `utf8mb4` | Obligatoria |
| `CORS_ORIGENES_WEB` | 4 | `http://localhost:8100,http://localhost:4200` | Lista separada por comas. Con `APP_ENTORNO=produccion`, se rechazan `http://` y `localhost`. |
| `CORS_ORIGENES_NATIVOS` | 4 | `capacitor://localhost,https://localhost` | Lista separada por comas |
| `IP_CABECERA_CONFIABLE` | 4 | *(vacío)* | Vacío o nombre de cabecera, por ejemplo `CF-Connecting-IP` |
| `IP_PROXIES_CONFIABLES` | 4 | *(vacío)* | Lista CIDR. Si `IP_CABECERA_CONFIABLE` tiene valor, es obligatoria. |
| `RUTA_LOGS` | 4 | `<backend>/logs` | Carpeta existente y escribible |
| `FORZAR_HTTPS` | 4 | `false` | `true` obligatorio con `APP_ENTORNO=produccion` o `staging` |
| `TOKEN_ACCESO_MINUTOS` | `rest_usuario` | `15` | Entero de 5 a 60 |
| `TOKEN_REFRESH_INACTIVIDAD_DIAS` | `rest_usuario` | `7` | Entero de 1 a 30 |
| `TOKEN_REFRESH_MAXIMO_DIAS` | `rest_usuario` | `30` | Entero ≥ `TOKEN_REFRESH_INACTIVIDAD_DIAS` |
| `COOKIE_REFRESH_NOMBRE` | `rest_usuario` | `ck_refresh` | Obligatoria |
| `COOKIE_REFRESH_RUTA` | `rest_usuario` | `/criterio_kelly/rest_usuario/autenticacion/` | Empieza y termina en `/` |
| `COOKIE_REFRESH_SEGURA` | `rest_usuario` | `true` | `false` solo si `APP_ENTORNO=local` |
| `CORREO_MODO` | `rest_usuario` | `smtp` (Mailpit) o `log` | `smtp` \| `log`. `log` solo si `APP_ENTORNO=local`. |
| `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_CIFRADO` | `rest_usuario` | `localhost`, `1025`, vacío, vacío, `ninguno` | `SMTP_CIFRADO`: `tls` \| `ssl` \| `ninguno`. `ninguno` solo si `APP_ENTORNO=local`. |
| `CORREO_REMITENTE`, `CORREO_REMITENTE_NOMBRE`, `CORREO_ALERTAS` | `rest_usuario` | `no-responder@localhost`, `Criterio Kelly`, `admin@localhost` | Email válido |
| `RUTA_CLAVES_COMUNES` | `rest_usuario` | `<backend>/configuracion/claves_comunes.txt` | Archivo existente |
| `FMP_API_KEY` | `rest_divisas` | *(valor local)* | Obligatoria |

`RUTA_APLICACION` **no** va en el `.env`. Es una variable de Apache (`SetEnv RUTA_APLICACION /ruta/privada/rest_<nombre>` en el `.htaccess` del servidor) que indica dónde están el código privado y el `.env`. Si no está definida, `index.php` usa `__DIR__`, que es el caso local.

### 4.2 Clases compartidas (copias idénticas en `configuracion/` de los 4 backends)

| Archivo | Clase | HLT que la crea | Responsabilidad |
|---------|-------|-----------------|-----------------|
| `Configuracion.php` | `Configuracion` | HLT-01 | Carga el `.env` con phpdotenv, valida las claves de §4.1 y expone `obtener(string): string`, `obtenerEntero`, `obtenerBooleano`, `obtenerLista` y `esProduccion()` |
| `enlace.php` | `Enlace` | HLT-01 (modifica) | Conexión desde `Configuracion`, `mysqli_report(MYSQLI_REPORT_ERROR \| MYSQLI_REPORT_STRICT)`, `utf8mb4`, y los métodos nuevos `iniciarTransaccion()`, `confirmarTransaccion()` y `revertirTransaccion()` |
| `CorsConfig.php` | `CorsConfig` | HLT-02 (reescribe) | Lista blanca de orígenes, `Vary: Origin`, preflight 204, `Allow-Credentials` solo cuando se indique |
| `CabecerasSeguridad.php` | `CabecerasSeguridad` | HLT-02 | Cabeceras de E-09 y HSTS según `FORZAR_HTTPS` |
| `ManejadorErrores.php` | `ManejadorErrores` | HLT-02 | `set_exception_handler` y `set_error_handler`: registra con detalle y responde `500 {"error":"Error interno del servidor"}` |
| `LectorSolicitud.php` | `LectorSolicitud` | HLT-02 | Métodos permitidos (405), JSON válido, `Content-Type`, máximo 1 MB (400) |
| `Enrutador.php` | `Enrutador` | HLT-02 | Resuelve el recurso por **segmento exacto** a partir de un mapa `recurso => archivo de ruta`, independiente del prefijo de instalación |
| `ClienteIp.php` | `ClienteIp` | HLT-03 | IP real según `IP_CABECERA_CONFIABLE` + `IP_PROXIES_CONFIABLES` |
| `ContextoSesion.php` | `ContextoSesion` | HLT-03 | Guarda la sesión validada de la petición: `idUsuario()`, `roles()`, `idSesion()`, `estaAutenticado()` |
| `ValidadorSesion.php` | `ValidadorSesion` | HLT-03 | Lee `Authorization: Bearer`, valida contra `sgen_sesion` y llena `ContextoSesion`; si falla, 401 |
| `LimitadorPeticiones.php` | `LimitadorPeticiones` | HLT-03 | Límites de A-06 sobre `sgen_limitepeticion` e `sgen_intentoacceso`; si se superan, 429 con `Retry-After` |
| `RegistroAuditoria.php` | `RegistroAuditoria` | HLT-03 | Inserta en `sgen_auditoria` los eventos de D-01 |

**Regla de copia idéntica:** el hash SHA-256 de cada uno de estos archivos debe ser igual en los 4 backends. Cada HLT que los crea o modifica incluye ese chequeo como criterio de aceptación:

```bash
cd /c/xampp/htdocs/criterio_kelly && for f in Configuracion.php enlace.php CorsConfig.php CabecerasSeguridad.php ManejadorErrores.php LectorSolicitud.php Enrutador.php ClienteIp.php ContextoSesion.php ValidadorSesion.php LimitadorPeticiones.php RegistroAuditoria.php; do sha256sum rest_*/configuracion/$f 2>/dev/null | awk '{print $1}' | sort -u | wc -l | xargs echo "$f:"; done   # cada línea debe mostrar 1
```

Las clases específicas de un solo backend (por ejemplo `EmisorTokens`, `PoliticaClaves` o `EnviadorCorreo` en `rest_usuario`) viven en `configuracion/` o en `servicios/` de ese backend, según lo decida su HLT.

`configuracion/global.php` **se elimina** en HLT-01. Ningún archivo vuelve a usar las constantes `DB_*` de `define()`.

### 4.3 Orden de arranque de `index.php` (los 4 backends)

```
1. RUTA_APLICACION (getenv o __DIR__) + require vendor/autoload.php
2. Configuracion::cargar()                     (HLT-01)
3. ManejadorErrores::registrar()               (HLT-02)
4. CabecerasSeguridad::aplicar()               (HLT-02)
5. CorsConfig::aplicar() + preflight 204       (HLT-02)
6. LectorSolicitud::validarMetodoYCuerpo()     (HLT-02)
7. Enrutador::resolver($rutas) → recurso       (HLT-02)
8. Si recurso/acción ∉ lista pública:
      ValidadorSesion::exigir()                (HLT-03)
9. LimitadorPeticiones::controlar()            (HLT-03)
10. require archivo de ruta → Ctrl → Mdl
```

### 4.4 Esquema de base de datos (`sist_criteriokelly`)

| Tabla | Prefijo | Script | HLT |
|-------|---------|--------|-----|
| `sgen_sesion` | `ses_` | `rest_usuario/anexos/seguridad_01_sesion.sql` | HLT-03 |
| `sgen_intentoacceso` | `ina_` | `seguridad_01_sesion.sql` | HLT-03 |
| `sgen_limitepeticion` | `lip_` | `seguridad_01_sesion.sql` | HLT-03 |
| `sgen_auditoria` | `aud_` | `seguridad_01_sesion.sql` | HLT-03 |
| `sgen_recuperacion` | `rec_` | `rest_usuario/anexos/seguridad_02_recuperacion.sql` | HLT-06 |
| Usuario MySQL `ck_aplicacion` | — | `rest_usuario/anexos/seguridad_00_usuario_mysql.sql` | HLT-01 |

- `sgen_usuario.usu_codiorecupe` **no se borra**: deja de usarse en HLT-06. Un `DROP COLUMN` queda fuera de alcance.
- Cada HLT define las columnas de sus tablas.
- Los scripts son idempotentes (`CREATE TABLE IF NOT EXISTS`) y se copian a `criterioKellyApp/src/assets/anexos/`. La copia es una tarea separada, asignada a `desarrollador-ionic`.

### 4.5 Contrato HTTP

**Cabeceras que envía la app:**

| Cabecera | Cuándo |
|----------|--------|
| `Authorization: Bearer <accessToken>` | Toda petición a un endpoint protegido |
| `X-Requested-With: CriterioKelly` | Toda petición a cualquier backend |
| `X-Cliente: nativo` | Solo desde Android/iOS (`Capacitor.isNativePlatform()`) |

**Endpoints de `rest_usuario /autenticacion`:**

| Método y acción | Cuerpo | Respuesta 200 | HLT |
|-----------------|--------|---------------|-----|
| `POST autenticar` | `{ usuario, clave }` | `{ id, nombres, apellidos, roles: [{ rol_id, rol_descripcion }], accessToken, accessExpira }` + `refreshToken` (solo nativo) o `Set-Cookie` (web) | HLT-03 |
| `POST renovar` | nativo: `{ refreshToken }`; web: cookie | Igual que `autenticar` | HLT-03 |
| `POST cerrarSesion` | — | `{ success: 'ok' }` y borra la cookie (web) | HLT-03 |
| `POST cerrarTodas` | — | `{ success: 'ok' }` | HLT-03 |
| `GET usRol` | — (el `id` de la query deja de ser necesario; si llega y no coincide con la sesión → 403) | `[{ rol_id, rol_descripcion }]` | HLT-03 |
| `POST solicitarRecuperacion` | `{ correo }` | `{ mensaje }`, siempre igual | HLT-06 |
| `POST restablecerClave` | `{ correo, codigo, claveNueva }` | `{ success: 'ok' }` | HLT-06 |
| `PUT actualizarClave` | `{ claveActual, claveNueva }` | `{ success: 'ok' }` (conserva la sesión actual y revoca las demás) | HLT-06 |
| `POST generarCodigo`, `POST obtenerCodigo` | — | Se **eliminan** (404) | HLT-06 |

`accessExpira` va en ISO 8601 con zona horaria.

**Lista blanca pública** (A-07), definida en un solo lugar por backend (la constante `RUTAS_PUBLICAS` en `index.php`):

| Backend | Rutas públicas |
|---------|----------------|
| `rest_usuario` | `autenticacion/autenticar`, `autenticacion/renovar`, `autenticacion/solicitarRecuperacion`, `autenticacion/restablecerClave`, `persona/agregar` |
| `rest_suscripcion` | `planes/disponible` |
| `rest_criteriokelly`, `rest_divisas` | ninguna |

Además, el `GET` sin acción (estado del servicio) es público en los 4 backends y responde **solo** `{ "servicio": "<nombre>", "estado": "activo" }`, sin listar endpoints ni versión.

**Mensajes y códigos fijos** (en español, formato `{ "error": "..." }`):

| Código | Mensaje | Dónde |
|--------|---------|-------|
| 400 | `Solicitud inválida` (genérico de `LectorSolicitud`) o el mensaje de validación del campo | HLT-02 y cada endpoint |
| 401 | `Sesión no válida o expirada` | `ValidadorSesion`, `renovar` |
| 401 | `Usuario o clave incorrectos` | `autenticar` |
| 403 | `Acceso denegado` | Dueño distinto, id distinto al de la sesión, `Origin` no permitido en `renovar` |
| 404 | `Recurso no encontrado` | `Enrutador` |
| 405 | `Método no permitido` | `LectorSolicitud` |
| 422 | *(reservado: límite de pérdida, sin cambios)* | — |
| 429 | `Demasiados intentos, intente nuevamente más tarde` + `Retry-After: <segundos>` | `LimitadorPeticiones` |
| 500 | `Error interno del servidor` | `ManejadorErrores` |

### 4.6 Artefactos de la app

| Archivo | Artefacto | HLT |
|---------|-----------|-----|
| `src/app/compartidos/store/sesion.store.ts` | `SesionStore` (signalStore: usuario, roles, accessToken, accessExpira, estado de renovación, `loading`, `error`) | HLT-07 |
| `src/app/compartidos/servicios/sesion.service.ts` | `SesionService` (HTTP de `autenticacion/*`) | HLT-07 |
| `src/app/compartidos/servicios/almacen-seguro.service.ts` | `AlmacenSeguroService` (refresh nativo con el plugin; en web no guarda nada) | HLT-07 |
| `src/app/compartidos/interceptors/autenticacion.interceptor.ts` | `autenticacionInterceptor` (registrado antes de `errorInterceptor`) | HLT-07 |
| `src/app/compartidos/seguridades/ServicioAutenticacion.ts` | Se **mantiene como fachada** con los mismos métodos públicos de roles, delegando en `SesionStore`, y **sin `localStorage`** (RD-7: menor superficie de cambio para guardas y páginas) | HLT-07 |
| `src/environments/environment.ts`, `environment.staging.ts`, `environment.prod.ts` | Claves `production`, `entorno`, `apiUrlLoge`, `apiUrlCritKell`, `apiUrlSuscripcion` | HLT-07 |
| `src/app/compartidos/validadores/politica-clave.validator.ts` | Validador de B-02 en la app | HLT-08 |

## 5. Reglas comunes a todos los HLT

1. Cada HLT cumple `doc_modo_planificacion.md` (H1…H11), con las extensiones para backend de `docs/planificador.md`.
2. **Versión de PHP:** donde `planificador.md` y `desarrollador-php.md` dicen "PHP 8.0", rige **PHP 8.2** (DH-09). El código debe pasar `php -l` con el PHP 8.2 o superior del XAMPP actualizado.
3. **Composer** está autorizado (DH-09). Solo se permiten `vlucas/phpdotenv` (4 backends) y `phpmailer/phpmailer` (`rest_usuario`), con las versiones fijadas en `composer.lock`.
4. Todo HLT de backend deja **pruebas `curl` reproducibles en local** (caso feliz + ataques que le correspondan) como criterio de aceptación (J-06).
5. Todo HLT termina con una tarea de **actualización del README** del proyecto que toca.
6. **Documentación del workspace:** `CLAUDE.md` de la raíz y `.claude/agents/desarrollador-php.md` (PHP 8.2, Composer, autenticación, `.env`) los actualiza `desarrollador-php`, en la última tarea de HLT-03. Es una excepción registrada a la regla de asignación por carpeta. `criterioKellyApp/CLAUDE.md` y `.claude/agents/desarrollador-ionic.md` los actualiza `desarrollador-ionic` en HLT-07.
7. **Bugs conocidos:** solo se corrigen si están en una línea que el HLT ya modifica, por ejemplo la línea de depuración de `suscripcion/porUsuario` o el `echo` de `crearConPago`. Los demás se listan como fuera de alcance.
8. Ningún HLT despliega a un servidor real.

## 6. Acciones previas del usuario (antes de ejecutar HLT-01)

Ningún agente puede hacerlas; son condición de entrada de HLT-01.

| # | Acción | Verificación |
|---|--------|--------------|
| U-01 | Instalar **XAMPP con PHP 8.2 o superior**, idealmente la misma versión que ofrezca el hosting, conservando `htdocs` y la base de datos `sist_criteriokelly` | `C:\xampp\php\php.exe -v` muestra 8.2 o superior |
| U-02 | Instalar **Composer 2** en el equipo | `composer --version` |
| U-03 | Instalar **Mailpit** (opcional; si no, `CORREO_MODO=log`) | `http://localhost:8025` abre el buzón |
| U-04 | **Rotar la API key de FMP** expuesta y guardar la nueva solo en el `.env` local de `rest_divisas` | La key anterior ya no responde en FMP |
| U-05 | Respaldar la base de datos local antes de empezar | Archivo `.sql` de respaldo |

## 7. HLT bloqueados (RD-6)

| HLT | Bloqueado por | Pregunta al usuario |
|-----|---------------|---------------------|
| HLT-10 | DH-13 | `appId` definitivo (por ejemplo `com.<empresa>.criteriokelly`), nombre visible de la app y si ya existen las cuentas de Google Play y Apple Developer. |
| HLT-11 | DH-07, DH-10, DH-11, DH-12, DH-16 | Dominios de la web y de la API, proveedor SMTP, proveedor y plan del servidor PHP (Composer, SSH, PHP 8.2+, carpeta fuera de `public_html`, cron, ModSecurity, SSL), si habrá Cloudflare u otro WAF, y tipo de servidor del frontend. |

Estos HLT se redactan cuando el usuario responda. Los HLT-01 a HLT-09 **no dependen** de esos datos: todo valor de producción vive en `.env` o en `environment.prod.ts` y se completa en HLT-11.

## 8. Observaciones sobre HU-001 para revisión

- **O-01 · A-08 es redundante.** El access token dura 15 minutos (DH-02), así que nunca puede llegar a 30 minutos sin uso. Se considera cumplido con la expiración de 15 minutos y no se agregan columnas ni lógica extra. Si la intención era una inactividad de 30 minutos **de la sesión completa** (refresh), se requiere una nueva revisión de la HU.
- **O-02 · La desconexión por inactividad del cliente** (5 minutos con PIN) es independiente de la sesión del servidor y se mantiene (G-09).
- **O-03 · Validar el access token** implica una consulta y una escritura (límite de peticiones) por cada petición. HLT-03 debe medir la latencia en local y dejar los índices definidos.
- **O-04 · El `GET` de estado de `rest_usuario`** lista hoy todos los endpoints (`ValidacionRts.php`). Desde HLT-02 responde solo el estado del servicio (§4.5).
