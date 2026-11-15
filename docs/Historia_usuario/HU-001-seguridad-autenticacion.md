# HU-001 · Seguridad para producción: autenticación, datos, servidores y clientes (web, PWA, Android, iOS)

| Campo | Valor |
|-------|-------|
| ID | HU-001 |
| Fecha | 2026-11-02 (rev. 4) |
| Estado | Por planificar |
| Prioridad | **Crítica**: bloquea el paso a producción. Hoy hay datos de usuarios expuestos. |
| Objetivo | Paso a producción con seguridad verificable en los 4 backends y en los 3 clientes, **sin dejar de funcionar en local** |
| Proyectos | `criterioKellyApp` (web + PWA + Android + iOS), `rest_usuario`, `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas` |
| Topología | **Dos servidores**: (1) servidor PHP alquilado con los 4 servicios REST y MySQL; (2) servidor del frontend web/PWA. Las apps nativas consumen el servidor (1). |
| Composer | Según el proveedor, **viene instalado** en el servidor PHP. Se confirma en DH-11; si no está, aplica el plan B de R-02. |
| Siguiente paso | Pasar esta historia al agente `planificador` (`docs/planificador.md`) para producir el HLT |
| Agentes de implementación | `desarrollador-php` (backends) y `desarrollador-ionic` (app) |

## Nivel de seguridad exigido

Ningún sistema es "inhackeable". Lo que esta historia exige es un nivel **verificable** con defensa en capas: si una capa falla, la siguiente contiene el daño.

| Ámbito | Estándar objetivo | Cómo se verifica |
|--------|-------------------|------------------|
| API PHP y app web/PWA | **OWASP ASVS 4.0 nivel 2** en autenticación (V2), sesión (V3), control de acceso (V4), validación (V5), criptografía (V6), errores y logs (V7), protección de datos (V8), comunicaciones (V9), dependencias y configuración (V14) | Checklist ASVS en el reporte, con evidencia por requisito, y escaneo OWASP ZAP sin alertas altas ni medias |
| Apps Android e iOS | **OWASP MASVS** L1 completo + `MASVS-STORAGE` y `MASVS-NETWORK` de L2 | Checklist MASVS en el reporte, con revisión del AAB/APK e IPA |
| Proceso | Cero secretos en el repositorio, dependencias sin vulnerabilidades conocidas (`composer audit`, `npm audit`) y paquetes de despliegue sin archivos internos | Salida de los comandos y lista de cada paquete |

Capas de defensa:

```
Internet ─▶ [1] WAF/CDN delante de cada servidor (Cloudflare u otro; recomendado, no requiere instalar nada)
         ─▶ [2] HTTPS + HSTS + cabeceras (.htaccess)
         ─▶ [3] Lista blanca de archivos y rutas (.htaccess + index.php)
         ─▶ [4] CORS con lista blanca + verificación de Origin
         ─▶ [5] Límite de peticiones y de intentos (en BD)
         ─▶ [6] Autenticación por token opaco (en BD)
         ─▶ [7] Autorización por dueño del recurso
         ─▶ [8] Validación de entrada + consultas preparadas
         ─▶ [9] Usuario MySQL con privilegios mínimos
         ─▶ [10] Auditoría y alertas
```

## Historia

**Como** trader que usa Criterio Kelly desde la web, la PWA o la app de Android o iOS,
**quiero** que solo yo, con una sesión válida, pueda leer y modificar mis cuentas, bitácora, observaciones, perfil y suscripciones,
**para** que nadie pueda ver ni alterar mi información financiera, aunque llame directamente a las APIs o robe un token.

**Como** responsable del sistema,
**quiero** que cada servidor solo exponga lo estrictamente necesario, rechace ataques conocidos y registre los eventos de seguridad, y que el mismo código funcione en local para probar,
**para** publicar la aplicación en producción con un nivel de seguridad verificable sin perder la capacidad de desarrollar y probar.

## Situación actual (verificada el 2026-11-02)

Hallazgos comprobados en el código y con `curl` contra `http://localhost/criterio_kelly/`:

| # | Hallazgo | Evidencia |
|---|----------|-----------|
| S-01 | **Las APIs no autentican.** Cualquiera puede leer los datos de otro usuario cambiando el `id`. | `GET rest_criteriokelly/cuentas/obtener?id=1` responde **200** con las cuentas y saldos del usuario 1, sin credenciales. |
| S-02 | **El usuario lo decide el cliente** (IDOR). | `cuentas.service.ts:30`, `comentarios.service.ts:26`, `planes.service.ts:20`, `suscripcion.service.ts:24`, `login.servicio.ts:24`. |
| S-03 | **La sesión de la app se puede falsificar.** Es solo un indicador en localStorage (`usuario`, `roles`, `autenticado = 'true'`). | `ServicioAutenticacion.ts:25-34`, `:109-124`. |
| S-04 | **Se descargan los scripts de base de datos.** | `rest_usuario/anexos/sist_generico.sql` → **200**. |
| S-05 | **Se descarga el repositorio git** (código e historial completo). | `rest_usuario/.git/config` → **200**. Lo mismo aplica a `rest_criteriokelly` y `rest_suscripcion`. |
| S-06 | **Los bloqueos de carpetas internas del `.htaccess` no funcionan**: dependen del prefijo `/rest_<nombre>/` y redirigen con 301 en vez de negar. | `rest_usuario/modelos/ValidacionMdl.php` → **200**. |
| S-07 | **`README.md` y `rutas.txt` son públicos.** | Ambos → **200**. |
| S-08 | **La recuperación de clave permite tomar cualquier cuenta.** | `ValidacionCtrl.php:78-140`: el código se devuelve en la respuesta, se entrega por nombre de usuario y sale de `rand()`. |
| S-09 | **El login no limita intentos en el servidor.** | `ValidacionCtrl.php:15`. |
| S-10 | **El `.htaccess` apunta a recursos que no existen** (`errors/*.html`, `logs/`). | Esas carpetas no existen. |
| S-11 | **CORS es fijo a `http://localhost:8100`**: la web de producción, la PWA y las apps nativas quedan bloqueadas. Además, `Authorization` no se reenvía a PHP. | `.htaccess` de los 4 backends. |
| S-12 | **Hay secretos en el código**: la API key de FMP está escrita en `rest_divisas`, MySQL usa `root` sin contraseña y `rest_divisas` desactiva la verificación SSL. | `IndiceCtrl.php`, los 4 `configuracion/global.php`. |
| S-13 | **Configuración PHP permisiva**: subidas de 10 MB y `max_execution_time 300`. | `.htaccess`. |
| S-14 | **PHP 8.0.30 local está fuera de soporte** desde noviembre de 2023. Composer no está instalado en el equipo local. | `C:\xampp\php\php.exe -v`; `composer` no está en el PATH. |
| S-15 | **Las claves se guardan con BCRYPT** y solo se exigen 6 caracteres. Argon2id está disponible. | `ValidacionMdl.php:58`. |
| S-16 | **La app no está preparada para producción**: `appId` de plantilla (`io.ionic.starter`), sin PWA, sin proyectos `android/` ni `ios/`, y `environment.prod.ts` apuntando a `localhost`. | `capacitor.config.ts`, `environment.prod.ts`. |
| S-17 | **El PIN de bloqueo se guarda en claro** en la base local (SQLite/IndexedDB). | `data-base.service.ts:159`, `data-base-web.service.ts:188` (`pin_codigo`). |

## Restricciones del entorno

- **R-01 · Dos servidores separados.** La API (PHP + MySQL) y el frontend web/PWA están en servidores distintos. Toda comunicación entre ambos es **cross-origin** y debe cumplir CORS (E-06). Para que la cookie de renovación de la web funcione, **ambos deben compartir dominio registrable**, por ejemplo `app.dominio.com` en el servidor web y `api.dominio.com` en el servidor PHP (H-07).
- **R-02 · Composer.**
  - **Plan A**, si el hosting trae Composer: cada backend tiene `composer.json` y `composer.lock` versionados, y en el servidor se ejecuta `composer install --no-dev --optimize-autoloader --classmap-authoritative`.
  - **Plan B**, si no lo trae o no se permite ejecutarlo: `vendor/` se genera en el equipo local con **el mismo `composer.lock`** y la misma versión de PHP, y se sube con el paquete de despliegue.

  En ambos casos `vendor/` queda **fuera de la raíz pública** y `composer audit` no muestra vulnerabilidades.
- **R-03 · Dependencias PHP permitidas.** Solo las imprescindibles, fijadas en `composer.lock`: `phpmailer/phpmailer` (correo SMTP) y `vlucas/phpdotenv` (configuración). La **autenticación no depende de librerías externas** (DH-01), para reducir la superficie de ataque y la cadena de suministro. Cualquier otra dependencia requiere justificación en H5 del HLT.
- **R-04 · Versión de PHP.** El servidor alquilado y el XAMPP local usan **la misma versión, PHP 8.2 o superior**. El código debe funcionar en 8.2 y 8.3. Si el hosting solo ofrece PHP 8.1 o anterior, no sirve para esta historia.
- **R-05 · Lo que el servidor PHP debe ofrecer** (se confirma en DH-11):
  - SSL (AutoSSL o Let's Encrypt);
  - una carpeta **fuera de `public_html`**;
  - MySQL con usuarios y privilegios por base de datos;
  - cron;
  - `.htaccess` con `mod_rewrite` y `mod_headers`;
  - SMTP;
  - Composer (o plan B);
  - idealmente, ModSecurity.
- **R-06 · El mismo código en todos los ambientes.** Las diferencias entre local, staging y producción viven **solo en configuración**: `.env` en los backends y `environment*.ts` en la app. **Nunca** en código comentado o descomentado ni en condiciones escritas a mano (J-01).
- **R-07 · Herramientas de desarrollo y verificación** (Composer, OWASP ZAP, Mailpit, Node, Android Studio, Xcode) **solo en equipos de desarrollo**.

## Arquitectura de autenticación (decidida)

Tokens **opacos** validados contra la base de datos `sist_criteriokelly`, que los 4 backends comparten en el servidor PHP. Aunque ahora hay Composer, se mantiene la decisión de no usar JWT, por tres motivos:

- la revocación es **inmediata**, sin listas negras;
- no hay llaves de firma que custodiar en un hosting alquilado;
- elimina toda una clase de ataques: confusión de algoritmo, `alg: none` y llaves débiles.

```
 Servidor web (app.dominio.com)          Servidor PHP (api.dominio.com)
 ┌──────────────────────────┐            ┌──────────────────────────────────────┐
 │ Web/PWA                  │──HTTPS────▶│ rest_usuario /autenticacion          │ emite y rota
 │  access: memoria         │  Bearer    │ rest_criteriokelly · rest_suscripcion│ validan el access
 │  refresh: cookie HttpOnly│            │ rest_divisas                         │
 └──────────────────────────┘            └──────────────┬───────────────────────┘
 Android / iOS                                          │ hash SHA-256
  access: memoria          ──HTTPS──────────▶           ▼
  refresh: Keystore/Keychain  Bearer            ┌────────────────┐
                                                │ MySQL          │ sgen_sesion
 Local: http://localhost:8100 ─▶ http://localhost/…/rest_*   (mismo flujo, J-*)
```

- **Access token**: 256 bits (`random_bytes(32)`, en base64url) y **15 minutos** de vida. En la base de datos se guarda solo el hash SHA-256, indexado. Las comparaciones se hacen con `hash_equals`.
- **Refresh token**: 256 bits, también guardado solo como hash. Expira a los **7 días por inactividad** y a los **30 días como máximo**. **Rota en cada uso.** Si se reutiliza uno ya rotado, se revoca toda la familia de sesión y se audita.
- **Revocación inmediata**: cerrar sesión, cambiar la clave, suspender al usuario o cambiar sus roles invalida las sesiones afectadas, con efecto en la siguiente petición en los 4 backends.
- **Validación compartida**: una clase `ValidadorSesion` idéntica en `configuracion/` de cada backend. Si una de las copias difiere de las demás, la verificación del HLT falla.

## Criterios de aceptación

Cada criterio debe poder verificarse con un comando (`curl`, `php -l`, `composer audit`, ZAP, `ng test`, `ng lint`) o con una observación concreta, **tanto en local como en staging**, salvo que el criterio diga lo contrario.

### A. Autenticación y sesión (backend)

- **A-01** `POST /autenticacion/autenticar` con credenciales válidas devuelve `id`, `nombres`, `apellidos`, `roles`, `accessToken` y `accessExpira`. El refresh token se entrega según el cliente:
  - **Web/PWA**: como cookie `HttpOnly; Secure; SameSite=Strict` emitida por el dominio de la API, con `Path` limitado a la ruta de `autenticacion/` (leída de la configuración), nunca en el cuerpo.
  - **Android/iOS**: en el cuerpo (`refreshToken`), solo si la petición declara `X-Cliente: nativo` **y** su `Origin` es uno de los orígenes nativos de la lista blanca.
- **A-02** Las credenciales inválidas, el usuario inexistente y el usuario suspendido responden **401** con el **mismo mensaje** y un **tiempo de respuesta similar**: si el usuario no existe, se ejecuta `password_verify` contra un hash ficticio.
- **A-03** El access token vencido, revocado, inexistente o con formato inválido responde **401**. Solo se acepta en `Authorization: Bearer`, nunca en la query, el cuerpo ni cookies.
- **A-04** `POST /autenticacion/renovar` rota el refresh token y emite un access token nuevo. Si el refresh se reutiliza, se revoca toda la familia, se responde **401** y se audita `REFRESH_REUTILIZADO`.
- **A-05** `POST /autenticacion/cerrarSesion` revoca la sesión actual y `POST /autenticacion/cerrarTodas` revoca todas las del usuario. Después de cualquiera de los dos, los tokens afectados responden **401** en los 4 backends.
- **A-06** **Límite de intentos y de peticiones**, guardado en base de datos:
  - login: 5 fallos por usuario en 15 minutos o 20 fallos por IP en 15 minutos → **429** con `Retry-After`;
  - API general: 300 peticiones por minuto por sesión y 60 por minuto por IP en los endpoints públicos → **429**.
  - Si hay un WAF/CDN delante, la IP real se toma **solo** de su cabecera (por ejemplo `CF-Connecting-IP`) y solo si la petición viene de sus rangos de IP. Nunca se confía en `X-Forwarded-For` arbitrario.
- **A-07** Solo son públicos los endpoints de esta lista blanca:
  - `autenticacion/autenticar`, `autenticacion/renovar`, `autenticacion/solicitarRecuperacion` y `autenticacion/restablecerClave`;
  - `persona/agregar` y `planes/disponible`.

  Todo lo demás, en **los 4 backends incluido `rest_divisas`**, responde **401** sin token válido.
- **A-08** El access token se invalida tras 30 minutos sin uso, aunque no haya vencido.
- **A-09** Se registran la IP y el user agent de cada sesión. Si cambian bruscamente, por ejemplo de familia de navegador, se audita `SESION_ANOMALA`. **No** se cierra la sesión por cambio de IP, porque en móvil la IP cambia todo el tiempo.

### B. Claves y recuperación

- **B-01** Las claves se guardan con `password_hash(PASSWORD_ARGON2ID)`. Los hashes BCRYPT existentes se migran de forma transparente en el login con `password_needs_rehash`.
- **B-02** **Política de claves** al registrar, cambiar o restablecer:
  - entre 10 y 128 caracteres;
  - distinta del usuario y del correo;
  - se rechaza si está en una lista de 10 000 claves comunes, guardada fuera de `public_html`.

  La app repite la validación para dar retroalimentación inmediata, pero la que cuenta es la del servidor.
- **B-03** Se **eliminan** `generarCodigo` y `obtenerCodigo`, y se deja de usar `usu_codiorecupe`.
- **B-04** `POST /autenticacion/solicitarRecuperacion { correo }`:
  - **siempre** responde 200 con el mismo mensaje, para no permitir enumerar usuarios;
  - si el correo existe, envía con PHPMailer por SMTP con TLS un código de 6 dígitos generado con `random_int`, que dura 15 minutos, es de un solo uso y se guarda como hash;
  - permite como máximo 3 solicitudes por correo por hora.
- **B-05** `POST /autenticacion/restablecerClave { correo, codigo, claveNueva }`:
  - permite como máximo 5 intentos por código;
  - aplica B-02;
  - invalida el código y **todas** las sesiones del usuario;
  - envía un correo de aviso del cambio.
- **B-06** `PUT /autenticacion/actualizarClave` exige token válido **y la clave actual**, aplica B-02, revoca las demás sesiones y conserva la actual.
- **B-07** El registro (`persona/agregar`) aplica B-02 y el límite de A-06. Su mensaje para usuario o correo duplicado no permite confirmar qué correos existen: responde lo mismo en ambos casos.

### C. Autorización y protección de datos

- **C-01** Todo endpoint protegido toma el usuario **de la sesión**. Si el cliente manda un `id`/`usuarioId` distinto, responde **403** y se audita `ACCESO_DENEGADO`.
- **C-02** Toda consulta sobre recursos con dueño filtra por el usuario de la sesión: cuentas, capital, bitácora, comentarios, resultados Kelly, suscripciones, pagos y persona. Con el token del usuario 2, ningún endpoint lee ni modifica datos del usuario 1.
- **C-03** Los roles para autorizar se leen de la sesión en la base de datos, nunca del cliente.
- **C-04** Ninguna respuesta incluye hashes, tokens ajenos, códigos de recuperación ni campos internos.
- **C-05** Todas las consultas usan consultas preparadas mediante `Enlace`. Las escrituras que afectan varias tablas van dentro de una transacción.
- **C-06** Validación de entrada en el servidor para todo endpoint: tipo, rango, longitud y valores permitidos. El cuerpo se rechaza con **400** si no es JSON válido, supera 1 MB o no tiene `Content-Type: application/json`.
- **C-07** Se mantiene el formato de respuesta actual: el dato directo, o `{ "error": "..." }`. El **422** sigue reservado para "límite de pérdida".
- **C-08** Los errores internos responden **500** con un mensaje genérico y se registran con detalle **solo en el log**. Nunca se muestran trazas, rutas, SQL ni versiones, **ni siquiera en local** (en local el detalle se lee en el log).

### D. Auditoría y monitoreo

- **D-01** Tabla `sgen_auditoria` con fecha, IP, user agent, id de usuario (si existe) y tipo de evento. Eventos:
  - `LOGIN_OK`, `LOGIN_FALLIDO`, `BLOQUEO_USUARIO`, `BLOQUEO_IP`, `LIMITE_PETICIONES`;
  - `RENOVAR`, `REFRESH_REUTILIZADO`, `SESION_ANOMALA`, `CIERRE_SESION`, `CIERRE_TODAS`;
  - `RECUPERACION_SOLICITADA`, `CLAVE_RESTABLECIDA`, `CLAVE_CAMBIADA`;
  - `ACCESO_DENEGADO`.
- **D-02** La auditoría **nunca** guarda claves, tokens ni códigos en claro.
- **D-03** Un script de mantenimiento fuera de `public_html`, ejecutado por **cron** en el servidor y a mano en local:
  - elimina las sesiones vencidas y los intentos caducados;
  - conserva la auditoría 180 días;
  - envía un correo de alerta si en la última hora hubo más de 10 `REFRESH_REUTILIZADO`, `BLOQUEO_IP` o `ACCESO_DENEGADO`.

### E. Servidor PHP: `.htaccess`, estructura y despliegue (4 backends)

- **E-01** **Estructura en el servidor**: dentro de `public_html` solo quedan `index.php` y `.htaccess` de cada backend. Las carpetas `rutas/`, `controladores/`, `modelos/`, `configuracion/` y `vendor/`, los logs, el `.env` y la lista de claves comunes van **fuera de `public_html`**, y `index.php` las incluye con una ruta leída de una constante o de la configuración.
  - En local se mantiene la estructura actual dentro de `htdocs`, protegida por E-02.
  - El mismo `index.php` funciona en ambos casos.
- **E-02** Lista blanca en `.htaccess`, **sin depender del prefijo de instalación**: solo se sirve `index.php`. Cualquier otro archivo o carpeta responde **403 o 404**, nunca 200 ni 301. Esto incluye `.git/`, dotfiles, `.env*`, `vendor/`, `composer.*`, `*.sql`, `*.md`, `*.txt`, `*.log`, `*.bak`, `*.ini`, cualquier `.php` distinto de `index.php` y las carpetas internas. Se verifica con `curl` **en local y en staging** sobre cada ruta de S-04 a S-07.
- **E-03** **Paquete de despliegue**: un script o una lista documentada que produce exactamente los archivos a subir por backend. Incluye `composer.json` y `composer.lock`, y `vendor/` solo en el plan B. **Nunca** incluye `.git/`, `anexos/`, `README.md`, `rutas.txt`, `.env.ejemplo` ni archivos de prueba. Los scripts SQL se ejecutan desde el panel del hosting y no se suben.
- **E-04** **HTTPS obligatorio** en staging y producción: las peticiones HTTP se redirigen o se rechazan, y se envía `Strict-Transport-Security: max-age=31536000; includeSubDomains`. En local se desactiva con `APP_ENTORNO=local` en el `.env`.
- **E-05** La cabecera `Authorization` llega a PHP en XAMPP y en el hosting, mediante `SetEnvIf` o una regla de reescritura con `E=`.
- **E-06** **CORS con lista blanca exacta**, leída del `.env` (`CORS_ORIGENES`), porque el frontend está en otro servidor:

  | Ambiente | Orígenes permitidos |
  |----------|---------------------|
  | Producción | `https://app.<dominio>` (web/PWA), `capacitor://localhost` (iOS), `https://localhost` (Android) |
  | Staging | `https://staging-app.<dominio>` + los orígenes nativos |
  | Local | `http://localhost:8100` (`ionic serve`), `http://localhost:4200` (`ng serve`, opcional) + los orígenes nativos |

  - Se responde con el origen exacto y `Vary: Origin`, nunca con `*`.
  - `Access-Control-Allow-Credentials: true` se envía **solo** en `autenticacion/*` y solo para orígenes web.
  - `Allow-Headers`: `Authorization`, `Content-Type`, `X-Cliente`, `X-Requested-With`. `Allow-Methods`: los de E-10.
- **E-07** **CSRF**: los endpoints que leen la cookie (`renovar`, `cerrarSesion`) validan `Origin` contra la lista blanca y exigen la cabecera `X-Requested-With: CriterioKelly`. Las demás rutas no usan cookies.
- **E-08** El preflight `OPTIONS` responde **204** sin ejecutar ninguna ruta.
- **E-09** Cabeceras de la API:
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`;
  - `Cache-Control: no-store` en respuestas autenticadas;
  - `Permissions-Policy` restrictiva y `Cross-Origin-Resource-Policy: same-site`;
  - `X-XSS-Protection: 0`;
  - sin `Server` detallado ni `X-Powered-By`.
- **E-10** Solo se aceptan los métodos `GET`, `POST`, `PUT`, `DELETE` y `OPTIONS`. Los demás responden **405**.
- **E-11** Configuración de PHP mediante `.htaccess` o `.user.ini`, según lo que permita el hosting:
  - `display_errors Off`, `log_errors On`, `expose_php Off`;
  - `file_uploads Off`, `post_max_size 1M`, `max_execution_time 30`.
- **E-12** Se eliminan las reglas obsoletas o rotas: la redirección de barra final con recursos inexistentes, el antihotlinking de un dominio ajeno, los `ErrorDocument` a archivos inexistentes y la página HTML de anuncio. La página de anuncio solo se permite con `APP_ENTORNO=local`.
- **E-13** El enrutador de `index.php` reconoce los recursos por **prefijo exacto del segmento**, no con `strpos`, y funciona tanto en `/criterio_kelly/rest_<nombre>/` (local) como en la raíz de un subdominio o subcarpeta (servidor).
- **E-14** Si el hosting permite **ModSecurity** (OWASP CRS), se activa y se verifica que no bloquee peticiones legítimas. Si hay un WAF/CDN delante (DH-12), el `.htaccess` solo acepta tráfico desde sus rangos de IP publicados.

### F. Datos, secretos y dependencias

- **F-01** Los secretos (MySQL, API key de FMP, SMTP, CORS, entorno y rutas) viven en un **`.env` por backend fuera de `public_html`**, leído con `vlucas/phpdotenv`, que no se versiona. Cada repositorio incluye un `.env.ejemplo` sin valores reales, y su `.gitignore` excluye `.env`, `vendor/` y los logs.
  - Se validan las variables obligatorias al arrancar; si falta alguna, responde **500** genérico y lo registra.
- **F-02** **Usuario MySQL dedicado**, creado desde el panel del hosting, con privilegios mínimos sobre la base de datos (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `EXECUTE`) y una contraseña de 24 caracteres o más. **Nunca `root`**, ni privilegios `DROP`, `ALTER` o `GRANT` en ejecución. En local se documenta crear el mismo usuario, para probar con los mismos privilegios.
- **F-03** La API key de FMP que estuvo expuesta se **rota** antes de salir a producción. `rest_divisas` verifica SSL en todas las llamadas externas.
- **F-04** Se entrega el esquema nuevo como scripts en `rest_usuario/anexos/`, replicados en `criterioKellyApp/src/assets/anexos/`:
  - `sgen_sesion` (familia, hash del access, hash del refresh, expiraciones, último uso, IP, user agent, estado);
  - `sgen_intentoacceso`, `sgen_limitepeticion`, `sgen_recuperacion` y `sgen_auditoria`;
  - todos con índices sobre los hashes y las fechas, ejecutables igual en local y en el servidor.
- **F-05** Se documenta un procedimiento de **respaldo** diario de la base de datos y su restauración probada al menos una vez.
- **F-06** `composer audit` y `npm audit --omit=dev` sin vulnerabilidades altas ni críticas. Los archivos `composer.lock` y `package-lock.json` están versionados.

### G. Frontend común (web, PWA, Android, iOS)

- **G-01** El **access token vive solo en memoria**, en el store de sesión. Nunca se escribe en `localStorage`, `sessionStorage`, IndexedDB, SQLite ni en la caché del service worker.
- **G-02** `localStorage` deja de guardar `autenticado`, `roles` y `usuario`. La sesión se reconstruye al abrir la app con `renovar`.
- **G-03** Un **interceptor de autenticación**:
  - agrega `Authorization: Bearer` **solo** a las URLs de `environment.apiUrl*`;
  - ante un **401**, hace **una** renovación, con una sola en curso para todas las peticiones concurrentes, y reintenta la petición original;
  - si la renovación falla, limpia la sesión, redirige a `/login` y avisa con un toast.

  Va registrado antes de `errorInterceptor`.
- **G-04** `GuardAutenticacion` espera el intento de renovación inicial antes de decidir.
- **G-05** Ante un **429**, se muestra el tiempo de espera a partir de `Retry-After`. Ante un **403**, un mensaje de acceso denegado. Los textos van en español.
- **G-06** "Cerrar sesión" llama a `cerrarSesion` y limpia el estado y el almacenamiento seguro aunque la llamada falle. En el perfil se agrega "Cerrar sesión en todos los dispositivos".
- **G-07** Se agregan las pantallas de **recuperación de clave** y se actualiza el **cambio de clave**, que pide la clave actual. Ambas aplican la política B-02.
- **G-08** Los servicios dejan de enviar el id del usuario.
- **G-09** Se mantienen el bloqueo por inactividad de 5 minutos con PIN y el cierre de la app tras 3 intentos fallidos de login. El **PIN se guarda como hash con sal** (PBKDF2 con Web Crypto, 100 000 iteraciones o más), no en claro, y los PIN existentes se migran (S-17). Los roles en la app son solo para la interfaz.
- **G-10** Un archivo de entorno por ambiente: `environment.ts` (local), `environment.staging.ts` y `environment.prod.ts`. Cada uno tiene las URLs de la API y el indicador de entorno, y se agrega la configuración `staging` en `angular.json`. Staging y producción usan **HTTPS**. La build de producción no contiene `console.log` con datos de sesión ni **source maps** públicos.
- **G-11** Se respeta la arquitectura del agente `desarrollador-ionic`: la lógica va en el store, las inyecciones en la página orquestadora y el servicio solo hace HTTP.

### H. Web y PWA (servidor del frontend)

- **H-01** La PWA se habilita con `@angular/service-worker` (`ng add @angular/pwa`), con `manifest.webmanifest`, íconos y nombre de la app.
- **H-02** El service worker **solo cachea recursos estáticos** de la build. Las URLs de las APIs (otro servidor) quedan **excluidas** de `ngsw-config.json`: ninguna respuesta con datos del usuario se guarda en caché.
- **H-03** Al cerrar sesión, se limpian las cachés de datos que hubiera y el estado en memoria.
- **H-04** El refresh token web viaja **solo** en la cookie HttpOnly (`withCredentials: true` únicamente hacia `autenticacion/renovar` y `cerrarSesion`). JavaScript nunca lo lee.
- **H-05** **Configuración del servidor web**, con `.htaccess` si es Apache o el equivalente documentado si es Nginx o un hosting estático:
  - HTTPS y HSTS;
  - fallback de la SPA a `index.html`;
  - `index.html` y `ngsw.json` sin caché; los archivos con hash, con caché larga;
  - bloqueo de source maps, dotfiles y listado de directorios.
- **H-06** **CSP estricta en la web**:
  - `default-src 'self'`; `script-src 'self'` sin `unsafe-inline` ni `unsafe-eval` (con `autoCsp` de Angular o hashes si hace falta);
  - `connect-src 'self' https://api.<dominio>`, solo el dominio de la API;
  - `img-src 'self' data:`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`;
  - además, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy`.

  Se verifica con securityheaders.com o ZAP: nota **A o superior**.
- **H-07** **Mismo sitio entre servidores**: la web (`app.<dominio>`) y la API (`api.<dominio>`) comparten dominio registrable aunque estén en servidores distintos. Así la cookie `SameSite=Strict` viaja en las peticiones de la web a la API. Si DH-07 indica dominios distintos, la cookie no sirve (los navegadores bloquean las cookies de terceros) y se aplica el **plan B**: el refresh token web vive solo en memoria y la sesión web se pierde al recargar. Esta degradación se registra como riesgo aceptado.
- **H-08** La PWA funciona sin conexión solo para mostrar la interfaz estática y un aviso de "sin conexión". No funciona sin conexión con datos del usuario.

### I. Apps nativas (Android e iOS)

- **I-01** Se crean los proyectos `android/` e `ios/` con Capacitor 7 y un `appId` definitivo, por ejemplo `com.<empresa>.criteriokelly` (DH-13), en lugar de `io.ionic.starter`.
- **I-02** El refresh token se guarda con un **plugin de almacenamiento seguro compatible con Capacitor 7** (Keychain en iOS, Keystore en Android), por ejemplo `@aparajita/capacitor-secure-storage`. El HLT verifica la compatibilidad antes de instalarlo con `--legacy-peer-deps`.
- **I-03** `capacitor.config.ts` mantiene `androidScheme: 'https'`, desactiva `server.cleartext`, no define `server.url` en release y limita `allowNavigation` a los dominios de la API.
- **I-04** **Android**:
  - `network_security_config.xml` sin tráfico en texto plano en release; en debug solo se permite hacia el host de desarrollo (J-05);
  - `android:allowBackup="false"`, o con reglas que excluyan los datos sensibles;
  - `debuggable=false` y depuración de WebView desactivada en release;
  - R8/minificación activos;
  - firma con una keystore de release guardada **fuera del repositorio**.
  - Se entrega el **AAB** firmado para Play Store y el **APK** firmado para distribución directa.
- **I-05** **iOS**:
  - App Transport Security sin excepciones en release;
  - inspección de WebView desactivada en release;
  - firma con el certificado de distribución.
  - Se entrega la **IPA** para App Store o TestFlight.
- **I-06** Al pasar la app a segundo plano, el contenido de las pantallas con datos financieros queda oculto (privacy screen), con un plugin compatible verificado por el HLT.
- **I-07** La base local (SQLite/IndexedDB) **no guarda tokens ni claves**. El PIN se guarda como hash (G-09).
- **I-08** Se evalúa **certificate pinning**, y su resultado queda como decisión en el HLT con el riesgo de rotación de certificados. No es obligatorio si hay un WAF/CDN que rota certificados.

### J. Ambiente local (pruebas)

- **J-01** **El mismo código** funciona en local, staging y producción. Solo cambian el `.env` de cada backend (`APP_ENTORNO=local|staging|produccion`) y el `environment*.ts` de la app. La búsqueda de `localhost` o de rutas `/criterio_kelly/` escritas a mano en el código PHP y TS da **cero resultados**, salvo en los archivos de entorno y en `.env.ejemplo`.
- **J-02** **Backends en local**:
  - XAMPP actualizado a la misma versión de PHP que el servidor (R-04);
  - Composer instalado en el equipo de desarrollo, con `composer install` en cada backend;
  - `.env` local creado desde `.env.ejemplo`;
  - usuario MySQL local con los privilegios de F-02;
  - scripts de `anexos/` aplicados.

  Los servicios responden en `http://localhost/criterio_kelly/rest_<nombre>/`.
- **J-03** **Frontend en local**: `ionic serve --port=8100` contra los backends locales usando `environment.ts`. El login, la renovación con cookie, el cierre de sesión y la recuperación funcionan. `localhost:8100` y `localhost` son el mismo sitio, y los navegadores tratan `localhost` como contexto seguro, así que la cookie `Secure; SameSite=Strict` funciona sin HTTPS. Si algún navegador no la acepta, el flag `Secure` se controla con el `.env` **solo** cuando `APP_ENTORNO=local`.
- **J-04** **Correo en local**: con `APP_ENTORNO=local` los correos se envían a **Mailpit** (SMTP local, `localhost:1025`, con buzón web) o, si no está instalado, se escriben en un archivo de log fuera de la raíz pública. Nunca se envían correos reales desde local.
- **J-05** **Apps nativas en local**:
  - en el emulador o dispositivo de desarrollo, la build **debug** apunta a la IP del equipo (por ejemplo `http://10.0.2.2/...` en el emulador de Android), configurada en `environment.ts`;
  - el texto plano se permite **solo en debug** y **solo hacia ese host**, con `network_security_config` de debug y la excepción ATS de desarrollo;
  - las builds **release** no tienen ninguna excepción. Se verifica revisando los manifiestos del AAB/IPA de release.
- **J-06** En local se mantienen activas todas las protecciones salvo HTTPS/HSTS: autenticación, autorización, límites, CORS con lista blanca, `.htaccess` y validación. Las pruebas de ataque de la definición de terminado **se ejecutan primero en local**.
- **J-07** **Staging**: un subdominio en cada servidor (`staging-api.<dominio>`, `staging-app.<dominio>`) con su propia base de datos de prueba, donde se repiten las pruebas antes de producción.
- **J-08** El README de cada proyecto incluye la sección **"Ambiente local"** con los pasos J-02 a J-05 y la tabla de variables del `.env`.

## Decisiones

**Cerradas por esta revisión** (el planificador las toma como dadas):

| ID | Decisión |
|----|----------|
| DH-01 | Tokens opacos (access de 15 minutos + refresh rotativo) validados en la base de datos compartida. Sin JWT, aunque haya Composer. |
| DH-02 | Refresh: 7 días por inactividad y 30 días como máximo. Access: 15 minutos y 30 minutos sin uso. |
| DH-03 | Access en memoria. Refresh en cookie HttpOnly (web/PWA) o en Keychain/Keystore (nativo). |
| DH-04 | El usuario sale de la sesión. La app deja de enviar ids, y un id distinto al de la sesión responde 403. |
| DH-05 | `rest_divisas` también exige token. |
| DH-06 | Recuperación de clave por correo con PHPMailer vía Composer. Se eliminan los endpoints actuales. |
| DH-08 | Una clase `ValidadorSesion` idéntica en los 4 backends, solo con PHP nativo. |
| DH-09 | PHP 8.2 o superior en el servidor y en el XAMPP local (misma versión). Composer: plan A en el servidor, plan B con `vendor/` subido (R-02). |
| DH-14 | Tres ambientes: local, staging y producción. Las diferencias van solo en configuración. |
| DH-15 | El PIN local se guarda como hash PBKDF2 con sal. |

**Pendientes del usuario** (el planificador debe pedirlas antes de cerrar el HLT, por RD-6):

| ID | Dato necesario |
|----|----------------|
| DH-07 | Dominio de la web/PWA y de la API. Deben compartir dominio registrable aunque estén en servidores distintos (H-07); si no es posible, se acepta el plan B. |
| DH-10 | Cuenta SMTP para los correos de recuperación (la del hosting o un servicio externo). |
| DH-11 | Proveedor y plan del **servidor PHP**: confirmar Composer, versión de PHP, carpeta fuera de `public_html`, cron, ModSecurity, SSL y acceso SSH. |
| DH-12 | ¿Habrá un WAF/CDN (por ejemplo Cloudflare, plan gratuito) delante de los dos servidores? Recomendado. |
| DH-13 | `appId` definitivo, nombre de la app, y cuentas de Google Play y Apple Developer. |
| DH-16 | Tipo de **servidor del frontend** (Apache, Nginx o hosting estático como Netlify o Vercel): define cómo se aplica H-05 y H-06. |

## Fuera de alcance

Se registran como historias aparte:

- Autenticación con dos factores (TOTP).
- Pantallas de administración por rol.
- Bugs funcionales de los README que no estén relacionados con la seguridad. La excepción son los que estén en un endpoint que esta historia ya modifica.
- Publicación en las tiendas: fichas, capturas y políticas de privacidad de la tienda. Esta historia deja el AAB, APK e IPA firmados y listos.
- Notificaciones push y funcionamiento sin conexión con datos.
- CI/CD automatizado. Esta historia deja scripts o listas de despliegue manual reproducibles.

## Definición de terminado

- [ ] HLT **APROBADO** por el `planificador`, con DH-07, DH-10 a DH-13 y DH-16 respondidas.
- [ ] **Ambiente local completo** (J-02 a J-05) funcionando y documentado: un desarrollador nuevo lo levanta siguiendo solo los README.
- [ ] Todos los criterios A–J verificados con evidencia real **en local y en staging**: salida de `curl`, `php -l`, `composer audit`, `ng lint`, `ng test` y `ng build --configuration production`.
- [ ] **Pruebas de ataque** con `curl` o ZAP, con su resultado en el reporte:
  - IDOR sobre cada recurso con dueño;
  - token inventado, vencido o revocado;
  - refresh reutilizado;
  - fuerza bruta en el login y en el código de recuperación;
  - enumeración de usuarios (login, registro, recuperación);
  - inyección SQL en cada parámetro;
  - CORS desde un origen no permitido;
  - CSRF contra `renovar`;
  - descarga de `.git`, `.env`, `vendor/`, `composer.*`, `.sql`, `.md` y PHP internos;
  - métodos no permitidos;
  - cuerpo mayor a 1 MB;
  - IP falsificada con `X-Forwarded-For`.
- [ ] **OWASP ZAP**: escaneo base y activo contra staging (API y web), sin alertas altas ni medias abiertas.
- [ ] **Checklists ASVS nivel 2 y MASVS** completas en el reporte, con evidencia por requisito y los "no aplica" justificados.
- [ ] Rutas de S-01 a S-08 vueltas a probar en local y en staging: ya **no** responden 200 sin autorización.
- [ ] `composer audit` y `npm audit --omit=dev` sin vulnerabilidades altas ni críticas. **Búsqueda de secretos** en el historial git de los 4 repositorios, con las credenciales encontradas rotadas.
- [ ] Flujo completo probado en **web, PWA instalada, Android (dispositivo o emulador) e iOS (simulador o dispositivo)**, contra local y contra staging: login → uso → expiración del access → renovación transparente → cerrar sesión → recuperación de clave.
- [ ] AAB y APK de Android e IPA de iOS **firmados para release**, sin depuración ni excepciones de texto plano.
- [ ] README de los 4 backends y de la app actualizados con "Ambiente local", variables del `.env` y un **checklist de despliegue a producción** para cada servidor.
- [ ] Actualizados el `CLAUDE.md` de la raíz, el de la app y `.claude/agents/desarrollador-php.md` (Composer, versión de PHP, autenticación, estructura fuera de `public_html`, ambientes).

## Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| El historial git ya expuso código y la API key. | Alta | Rotar todas las credenciales que estuvieron en el repositorio antes de salir a producción. El paquete de despliegue nunca incluye `.git/`. |
| El servidor PHP no cumple R-04 o R-05 (PHP antiguo, sin carpeta fuera de `public_html`, sin Composer). | Alta | DH-11 se valida antes de planificar. Composer tiene plan B. Lo demás requiere cambiar de plan o de proveedor. |
| La web y la API quedan en dominios distintos y la cookie de renovación no viaja. | Alta | DH-07 / H-07: usar subdominios del mismo dominio. Si no es posible, plan B con la degradación documentada. |
| Cambio de contrato simultáneo en la app (3 plataformas) y los backends. | Alta | Desplegar en staging primero los backends y después la app. Publicar las apps nativas solo con la API ya en producción. |
| Una configuración pensada para local llega a producción (CORS a `localhost`, HTTPS desactivado, texto plano). | Alta | `APP_ENTORNO` obligatorio en el `.env` y validado al arrancar. En `produccion` se rechaza cualquier origen `http://` o `localhost` en CORS. Revisión de los manifiestos de release (J-05). |
| Dependencia de Composer comprometida (cadena de suministro). | Media | Solo dos dependencias, versiones fijadas en `composer.lock`, `composer audit` antes de cada despliegue y la autenticación sin librerías. |
| Si la API valida cada petición en la base de datos, aumenta la carga en un hosting alquilado. | Media | Índice único sobre el hash del token y consulta por clave. Se mide el tiempo de respuesta en staging. |
| Un WAF o ModSecurity bloquea peticiones legítimas. | Media | Probar el flujo completo en staging con el WAF activo, y documentar las excepciones de reglas. |
| Pasar de PHP 8.0 a 8.2 o superior rompe código existente. | Media | Primera tarea del plan: migrar la versión y probar todos los endpoints actuales en local con `curl` antes de agregar la autenticación. |
| Plugins de Capacitor (almacenamiento seguro, privacy screen) incompatibles con Capacitor 7. | Media | Verificar la compatibilidad en el HLT antes de instalar, y dejar una alternativa documentada. |
| Las sesiones actuales, los hashes BCRYPT y los PIN en claro quedan antiguos. | Baja | La app manda al login una vez; el rehash a Argon2id es transparente (B-01) y el PIN se migra en el primer desbloqueo (G-09). |
