# rest_usuario

Servicio REST en PHP para el manejo de **usuarios, personas, roles y autenticación** de la aplicación **Criterio Kelly** (`criterioKellyApp`). La app lo consume a través de `environment.apiUrlLoge`.

## Stack

- PHP **8.2** con Composer (MVC propio: `rutas/` → `controladores/` → `modelos/`)
- Dependencias: `vlucas/phpdotenv` (lectura del `.env`) y `phpmailer/phpmailer` (correo, se usa dentro del módulo `correo/`)
- MySQL vía `mysqli` con sentencias preparadas (clase `Enlace`, con transacciones)
- Apache (XAMPP) con `mod_rewrite` y `mod_headers`

## Estructura

```
rest_usuario/
├── .env                 # Configuración y secretos locales (no se versiona)
├── .env.ejemplo         # Plantilla del .env (sí se versiona)
├── .htaccess            # CORS, cabeceras de seguridad, reescritura a index.php
├── index.php            # Arranque (RUTA_APLICACION, .env) y enrutador por prefijo de URI
├── composer.json        # Dependencias directas
├── composer.lock        # Versiones fijadas
├── correo/              # Módulo de correo (EnviadorCorreo, PlantillasCorreo, cargarCorreo, probarCorreo y su README)
├── vendor/              # Dependencias instaladas por Composer (no se versiona)
├── configuracion/
│   ├── Configuracion.php     # Carga y valida el .env al arrancar
│   ├── enlace.php            # Clase Enlace (conexión, consultas preparadas, transacciones)
│   ├── CorsConfig.php        # Content-Type JSON y manejo del preflight OPTIONS
│   ├── claves_comunes.txt    # Lista versionada de 10 000 claves comunes
│   └── claves_comunes.LEEME.txt
├── logs/                # Registro de errores del servicio (no se versiona el contenido)
│   └── correos/  # Registros de correo de local (modo log): correos.log, correo-*.txt, registro-omitido-*.txt
├── rutas/               # Lee la acción de la URI y el cuerpo JSON
├── controladores/       # Validación, limpieza de datos y respuesta (extienden BaseCtrl)
├── modelos/             # Consultas SQL
├── anexos/              # Scripts SQL (estructura, datos iniciales y usuario MySQL)
└── rutas.txt            # Ejemplos de peticiones (desactualizado, ver nota abajo)
```

## Ambiente local

Pasos J-02 a J-05 de la HU-001 para levantar el servicio en un equipo de desarrollo.

### Requisitos

1. XAMPP con **PHP 8.2 o superior** y las extensiones `mysqli`, `curl`, `openssl` y `mbstring` activas (la misma versión de PHP que el servidor).
2. **Composer 2** instalado (`composer --version` debe responder 2.x).
3. Apache y MySQL de XAMPP en ejecución.

### Pasos

1. Ubica el proyecto en `C:\xampp\htdocs\criterio_kelly\rest_usuario`; el servicio responde en `http://localhost/criterio_kelly/rest_usuario/`.
2. Instala las dependencias:

   ```bash
   cd C:\xampp\htdocs\criterio_kelly\rest_usuario
   composer install
   ```

   Sin `vendor/autoload.php` el servicio responde **500** (el arranque falla al no poder cargar Composer).
3. Importa desde el gestor de base de datos, en este orden (crean la base `sist_criteriokelly` si no existe):
   - `anexos/sist_usuario_estructura.sql` (tablas `sgen_*`, incluidas sesiones, recuperación y verificación)
   - `anexos/sist_usuario_datos.sql` (roles; no incluye usuarios ni contraseñas: el primer administrador se crea a mano)

   Los cambios futuros de la base se entregan como un script de actualización listo para ejecutar desde el gestor de base de datos; después se regeneran estos dos archivos desde la base viva.
4. Crea el usuario MySQL de aplicación con privilegios mínimos. Genera una clave local de 24 caracteres o más (solo queda en los `.env`) y ejecútalo como `root` en el gestor de base de datos (si ya existe, solo se cambia la clave):

   ```sql
   CREATE USER IF NOT EXISTS 'ck_aplicacion'@'localhost' IDENTIFIED BY '<clave-generada>';
   CREATE USER IF NOT EXISTS 'ck_aplicacion'@'127.0.0.1' IDENTIFIED BY '<clave-generada>';
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON `sist_criteriokelly`.* TO 'ck_aplicacion'@'localhost';
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON `sist_criteriokelly`.* TO 'ck_aplicacion'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```

   La clave se genera con `C:\xampp\php\php.exe -r "echo bin2hex(random_bytes(16));"`. En el hosting el usuario se crea desde el panel con los mismos privilegios.
5. Copia `.env.ejemplo` como `.env` y completa los valores (ver tabla siguiente). `.env` nunca se versiona.
6. Verifica que el servicio responde:

   ```bash
   curl http://localhost/criterio_kelly/rest_usuario/autenticacion
   ```

7. Pruebas de la app en local (J-03 a J-05): `ionic serve --port=8100` apunta a este backend; con `CORREO_MODO=log` los correos se escriben en `logs/correos/` (o se envían a Mailpit en `localhost:1025` si está instalado) y nunca salen correos reales desde local.

> La base de datos `sist_criteriokelly` es compartida con `rest_criteriokelly`, `rest_suscripcion` y `rest_divisas`.

### Variables del `.env`

Si falta una clave o su valor no cumple la regla, el servicio responde **500** `{"error":"Error interno del servidor"}` y registra `Configuración inválida` con el nombre de la clave (nunca su valor).

| Clave | Ejemplo | Regla |
|-------|---------|-------|
| `APP_ENTORNO` | `local` | `local`, `staging` o `produccion` |
| `DB_HOST` | `localhost` | Obligatoria, no vacía |
| `DB_PUERTO` | `3306` | Entero de 1 a 65535 |
| `DB_NOMBRE` | `sist_criteriokelly` | Obligatoria, no vacía |
| `DB_USUARIO` | `ck_aplicacion` | Obligatoria, no vacía; con `produccion`, distinta de `root` |
| `DB_CLAVE` | *(vacía en el ejemplo)* | Puede ser vacía solo si `APP_ENTORNO` no es `produccion` |
| `DB_CHARSET` | `utf8mb4` | Exactamente `utf8mb4` |
| `CORS_ORIGENES_WEB` | `http://localhost:8100,http://localhost:4200` | Uno o más orígenes (`esquema://host[:puerto]`, sin ruta ni barra final); con `produccion`, ninguno con `http://` ni `localhost` |
| `CORS_ORIGENES_NATIVOS` | `capacitor://localhost,https://localhost` | Lista (puede ser vacía) con el mismo formato de origen |
| `IP_CABECERA_CONFIABLE` | *(vacía)* | Vacía o un nombre de cabecera (`A-Z`, `a-z`, `0-9`, `-`) |
| `IP_PROXIES_CONFIABLES` | *(vacía)* | Lista de CIDR IPv4/IPv6; obligatoria si `IP_CABECERA_CONFIABLE` no está vacía |
| `RUTA_LOGS` | `logs` | Carpeta existente y escribible (relativa a la raíz del backend) |
| `FORZAR_HTTPS` | `false` | `true` o `false`; `true` obligatorio con `staging` o `produccion` |
| `TOKEN_ACCESO_MINUTOS` | `15` | Entero de 5 a 60 |
| `TOKEN_REFRESH_INACTIVIDAD_DIAS` | `7` | Entero de 1 a 30 |
| `TOKEN_REFRESH_MAXIMO_DIAS` | `30` | Entero mayor o igual que `TOKEN_REFRESH_INACTIVIDAD_DIAS` |
| `COOKIE_REFRESH_NOMBRE` | `ck_refresh` | Letras, números, `_` y `-` |
| `COOKIE_REFRESH_RUTA` | `/criterio_kelly/rest_usuario/autenticacion/` | Empieza y termina en `/` |
| `COOKIE_REFRESH_SEGURA` | `true` | `true` o `false`; `false` solo con `APP_ENTORNO=local` |
| `CORREO_MODO` | `log` | `smtp` (cuenta SMTP real, local o producción), `mail` (función `mail()` de PHP, solo con servicio de correo del hosting; el remitente debe ser de su dominio) o `log` (solo `APP_ENTORNO=local`). Prueba el envío con `php correo/probarCorreo.php destino@correo.com` |
| `SMTP_HOST` | `localhost` | Obligatoria, no vacía |
| `SMTP_PUERTO` | `1025` | Entero de 1 a 65535 |
| `SMTP_USUARIO` | *(vacía)* | Puede ser vacía |
| `SMTP_CLAVE` | *(vacía)* | Puede ser vacía |
| `SMTP_CIFRADO` | `ninguno` | `tls`, `ssl` o `ninguno`; `ninguno` solo con `APP_ENTORNO=local` |
| `CORREO_REMITENTE` | `no-responder@localhost` | Correo válido; `@localhost` solo con `APP_ENTORNO=local` |
| `CORREO_REMITENTE_NOMBRE` | `"Criterio Kelly"` | Obligatoria, no vacía |
| `CORREO_ALERTAS` | `admin@localhost` | Correo válido; `@localhost` solo con `APP_ENTORNO=local` |
| `RUTA_CLAVES_COMUNES` | `configuracion/claves_comunes.txt` | Archivo existente (relativo a la raíz del backend) |

### CORS

El `.htaccess` actual solo permite el origen `http://localhost:8100` (puerto de `ionic serve`). La lista blanca configurable desde `CORS_ORIGENES_WEB` y `CORS_ORIGENES_NATIVOS` se aplica en HLT-02.

## Endpoints

URL base: `http://localhost/rest_usuario/`. Los cuerpos se envían como JSON (`Content-Type: application/json`).

### Autenticación — `/autenticacion`

| Método | Ruta | Cuerpo / parámetros | Respuesta exitosa |
|--------|------|---------------------|-------------------|
| GET | `/autenticacion` | — | Estado del servicio y lista de endpoints |
| POST | `/autenticacion/autenticar` | `{ "usuario", "clave" }` | `{ "id", "nombres", "apellidos" }` |
| GET | `/autenticacion/usRol?id={idUsuario}` | `id` en la query | `[ { "rol_id", "rol_descripcion" } ]` |
| POST | `/autenticacion/solicitarRecuperacion` | `{ "correo" }` | `{ "mensaje": "..." }` |
| POST | `/autenticacion/restablecerClave` | `{ "correo", "codigo", "claveNueva" }` | `{ "success": "ok" }` |
| PUT | `/autenticacion/actualizarClave` | `{ "claveActual", "claveNueva" }` | `{ "success": "ok" }` |

- `autenticar` responde **401** con credenciales inválidas. Las claves se verifican con `password_verify`.
- `actualizarClave` requiere el token de sesión, la clave actual y una clave nueva que cumpla la política.
- La política exige entre 10 y 128 caracteres, diferencia respecto al usuario/correo y ausencia en la lista de 10 000 claves comunes. Toda clave nueva se guarda con Argon2id.
- `solicitarRecuperacion` siempre devuelve el mismo mensaje y tarda al menos dos segundos. El código dura 15 minutos, admite cinco intentos y solo se usa una vez.

### Persona — `/persona`

| Método | Ruta | Cuerpo / parámetros | Respuesta exitosa |
|--------|------|---------------------|-------------------|
| GET | `/persona` | — | Estado del servicio |
| POST | `/persona/agregar` | `{ "cedula"?, "nombres", "apellidos", "correo", "telefono", "usuario", "clave" }` | `{ "mensaje": "..." }` (público) |
| POST | `/persona/activar` | `{ "correo", "codigo" }` | `{ "success": "ok" }` (público) |
| POST | `/persona/reenviarCodigo` | `{ "correo" }` | `{ "mensaje": "..." }` (público) |
| PUT | `/persona/actualizarDeApp` | `{ "id"?, "nombres", "apellidos", "telefono" }` | `{ "id_usuario", "nombres", "apellidos", "telefono" }` |
| GET | `/persona/obtener?id=` | — | **501**, pendiente de implementación |

`agregar` registra en una sola operación atómica la persona, su usuario en situación **`P`** (clave con Argon2id), el rol **4 (Visitante)** y un código de verificación (tabla `sgen_verificacion`). **No crea suscripción**: la crea la app tras el primer inicio de sesión. Después del commit envía el código por correo; un fallo de envío no cambia la respuesta. Si el correo ya existe responde el mismo 200 (`Registro recibido. Si los datos son válidos, recibirás un código en tu correo para activar tu cuenta.`) sin crear filas ni enviar correo; usuario, teléfono o cédula duplicados responden 409 con el mismo mensaje (`El nombre de usuario, el teléfono o la cédula ya están registrados`: no indica cuál campo se repite); tarda al menos 2 s en ambos casos 200. Con 10 o más códigos creados desde la misma IP en la última hora responde **429** con `Retry-After: 3600`. La comprobación de la cédula usa la misma transacción con `FOR UPDATE` que usuario y teléfono y no hay índice único sobre `per_cedula` (HU-003, DC-11): requiere el aislamiento REPEATABLE READ, el predeterminado de MySQL y MariaDB; confírmalo antes de publicar en un hosting. Validaciones:

| Campo | Regla |
|-------|-------|
| `cedula` | Opcional; 10 a 13 dígitos. Si se envía, no puede pertenecer a otra persona activa (409); el 409 se comprueba después del correo, que conserva su respuesta uniforme |
| `nombres`, `apellidos` | Máx. 32 caracteres |
| `correo` | Email válido, máx. 64 |
| `telefono` | Dígitos, `+ - ( )` y espacios; máx. 16 |
| `usuario` | 3 a 32 caracteres: letras, números y `_` |
| `clave` | Entre 10 y 128 caracteres; no puede ser usuario, correo ni una clave común |

El usuario de `actualizarDeApp` se toma siempre de la sesión. Un `id` diferente responde 403.

`actualizarDeApp` recibe el **id del usuario** (no de la persona) y solo actualiza usuarios activos.

### Roles

Datos iniciales de `sgen_rol`:

| `rol_id` | Descripción |
|----------|-------------|
| 1 | Super Administrador |
| 2 | Administrador |
| 3 | Suscriptor |
| 4 | Visitante |

## Formato de respuestas

Las respuestas devuelven el dato directamente, sin envoltorio:

```json
// Éxito (200)
{ "id": 1, "nombres": "Wills", "apellidos": "WillsAp" }

// Éxito sin dato (200)
{ "success": "ok" }

// Error (400, 401, 404, 409, 500...)
{ "error": "Credenciales inválidas" }
```

La app (`errorInterceptor`) muestra el valor de `error` como mensaje al usuario, por lo que los mensajes se escriben en español.

> `rutas.txt` usa el formato antiguo (`estado`, `mensaje`, `fecha`, `dato`) y la ruta `/autenticacion/roles`; ambos fueron reemplazados por lo descrito aquí.

### Núcleo de sesión HLT-03

Las tablas de sesiones, intentos, límites y auditoría están en
`anexos/sist_usuario_estructura.sql`, que debe importarse una vez en
`sist_criteriokelly` antes de usar la guardia. `POST /autenticacion/autenticar`
devuelve un access token opaco de corta duración; el refresh se entrega en cookie
HttpOnly para web o en el cuerpo cuando `X-Cliente: nativo` usa un origen nativo
permitido. `renovar`, `cerrarSesion` y `cerrarTodas` gestionan la rotación y
revocación.

Las rutas protegidas requieren `Authorization: Bearer <token>`. El mantenimiento
se ejecuta fuera de HTTP:

```text
C:\xampp\php\php.exe mantenimiento\limpiarSeguridad.php
```

El mantenimiento también elimina recuperaciones con más de siete días y envía una alerta a
`CORREO_ALERTAS` cuando la suma de eventos `REFRESH_REUTILIZADO`, `BLOQUEO_IP` y
`ACCESO_DENEGADO` supera 10 en una hora. La marca evita más de una alerta por hora.


## Verificación de correo (HLT-06 v2)

Un usuario nuevo queda en `P` y no puede iniciar sesión hasta activar su cuenta con el código de un solo uso enviado a su correo.

| Endpoint | Cuerpo | Respuestas |
|----------|--------|------------|
| `POST /persona/activar` | `{ "correo", "codigo" }` (strings; código de 6 dígitos) | 200 `{"success":"ok"}` (no emite tokens: la app lleva al login); 400 `Código inválido o vencido` (mismo cuerpo para correo inexistente, usuario no pendiente, código incorrecto, vencido, usado o agotado), `El código debe tener 6 dígitos`, `El correo no es válido`, `Solicitud inválida`; 429 general |
| `POST /persona/reenviarCodigo` | `{ "correo" }` | 200 `Si el correo está pendiente de verificación, recibirás un código en unos minutos.` siempre (≈ 2 s); 400 `El correo no es válido`; 429 con `Retry-After: 3600` (tope por IP) |

- Ambas rutas son públicas (`RUTAS_PUBLICAS`) y siguen sujetas al límite público de 60 peticiones por minuto por IP; el resto de `/persona` exige token.
- **Tabla `sgen_verificacion`** (en `anexos/sist_usuario_estructura.sql`). Es independiente de `sgen_recuperacion`: un código de verificación no restablece claves ni uno de recuperación activa cuentas. La copia del script a `criterioKellyApp/src/assets/anexos/` fue descartada por el usuario.
- **Límites:** código de 6 dígitos con `random_int`, guardado solo como hash Argon2id; vigencia 15 minutos; un solo uso; 5 intentos por código (consumidos con un `UPDATE` condicional antes de comparar); reenvío con máximo 3 códigos por hora, 10 por día y 60 s entre envíos (en silencio, siempre la misma respuesta); tope de 10 códigos por hora por IP (429).
- **Auditoría:** `ACTIVACION_SOLICITADA`, `CUENTA_ACTIVADA` y `ACTIVACION_FALLIDA` (sin códigos ni hashes). Los tres eventos están en las 4 copias idénticas de `RegistroAuditoria.php`.
- **Depuración:** `mantenimiento/limpiarSeguridad.php` marca como `E` (baja lógica, libera correo y teléfono) a los usuarios `P` con filas de verificación y sin actividad en 7 días, y borra a los 7 días las filas de verificación de usuarios que ya no son `P`. Los usuarios `P` anteriores a este flujo (sin filas) no se tocan. El nombre de usuario de una cuenta depurada queda ocupado.
- **Login de una cuenta `P`:** sigue respondiendo el 401 genérico `Usuario o clave incorrectos`.
- **Riesgo R-02:** sin SMTP real en producción (DH-10) nadie puede activar su cuenta; HLT-11 no puede cerrarse sin configurarlo. En local `CORREO_MODO=log` escribe los correos en `logs/correos/correos.log`.
- **AJ-02 (verificado):** `PUT /autenticacion/actualizarClave` con la clave actual incorrecta responde 400 `La clave actual no es correcta`, nunca 401.
- **AJ-03 (verificado):** registro, restablecimiento y cambio hashean la clave cruda y el login la verifica cruda; `htmlspecialchars(trim())` solo se usa como respaldo para hashes anteriores.
- **F-01 (corregido):** `aud_fecha` se escribe en UTC; la ventana de 15 minutos de `actualizarClave` y la de 60 minutos de la alerta usan `UTC_TIMESTAMP()`.

## Agregar un endpoint

1. Agrega el `case` de la acción en el archivo de `rutas/` correspondiente.
2. Crea el método en el controlador (extiende `BaseCtrl`): `validarDatos`, `limpiarDatos` y responde con `respuestaExitosaSimple` / `respuestaErrorSimple`.
3. Crea el método en el modelo usando `Enlace` con consultas preparadas, por ejemplo `ejecutarConsulta($sql, "is", $id, $usuario)`.
4. Si es un recurso nuevo, registra su prefijo en el arreglo `$rutas` de `index.php`.

## Estado actual

- `/usuario` y `/rol` están registrados en `index.php`, pero `rutas/UsuarioRts.php`, `rutas/RolRts.php` y `controladores/UsuarioCtrl.php` están vacíos.
- `rutas/CategoriaRts.php` y su controlador/modelo existen, pero no están registrados en `index.php` y la tabla `categoria` no forma parte del esquema.
- `DELETE /persona` responde **501**.
- Sin SMTP real en producción las cuentas nuevas no pueden activarse (riesgo R-02, ver *Verificación de correo*).
- `depurarCuentasSinVerificar` deja ocupado el nombre de usuario de las cuentas depuradas (índice único `sgen_usuario_idx`).
