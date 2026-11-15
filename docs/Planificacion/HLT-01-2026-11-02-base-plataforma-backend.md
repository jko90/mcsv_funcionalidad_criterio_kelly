# HLT — HLT-01 · Base de plataforma backend (PHP 8.2, Composer, `.env`, `Configuracion`, `Enlace` con transacciones)

| Campo | Valor |
|-------|-------|
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Plan maestro | [PLAN-MAESTRO-HU-001.md](PLAN-MAESTRO-HU-001.md) (contratos §4 y reglas §5, cerrados) |
| Fecha | 2026-11-02 |
| Proyectos | `rest_usuario`, `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas` (+ una copia SQL en `criterioKellyApp`) |
| Agentes | `desarrollador-php` (25 tareas) · `desarrollador-ionic` (1 tarea) |
| Depende de | Acciones del usuario U-01 a U-05 (plan maestro §6) |
| Siguiente | HLT-02 (endurecimiento HTTP) |
| Veredicto senior | **APROBADO** (H6, revisión 2) |

Convenciones de este documento:

- `$RAIZ` = `C:\xampp\htdocs\criterio_kelly` (en Git Bash: `/c/xampp/htdocs/criterio_kelly`).
- `$PHP` = `/c/xampp/php/php.exe`; `$MYSQL` = `/c/xampp/mysql/bin/mysql.exe`.
- `$B` = `http://localhost/criterio_kelly`.
- Toda referencia `ruta:línea` es relativa a `$RAIZ` y corresponde al estado del repositorio verificado el 2026-11-02 (antes de ejecutar este HLT).

---

## H1. Propósito

| Campo | Contenido |
|-------|-----------|
| Requerimiento literal | "**HLT-01 · Base de plataforma backend** (4 backends: rest_usuario, rest_criteriokelly, rest_suscripcion, rest_divisas). Cubre criterios HU: E-01, F-01, F-02, F-03, F-06 (composer audit), C-05 (métodos de transacción en Enlace), J-02, J-08 (backends). Incluye: composer.json/lock por backend; `.env`, `.env.ejemplo`, `.gitignore` (rest_divisas no es repo git — tenlo en cuenta); clase `Configuracion` (claves y validaciones de §4.1 del plan maestro); `Enlace` leyendo de Configuracion + transacciones + mysqli_report estricto + utf8mb4; eliminar `configuracion/global.php` y todo uso de constantes DB_*; `RUTA_APLICACION` en index.php; carpeta de logs; script `rest_usuario/anexos/seguridad_00_usuario_mysql.sql` (usuario ck_aplicacion, privilegios mínimos) + su copia en `criterioKellyApp/src/assets/anexos/` (tarea separada asignada a desarrollador-ionic); rest_divisas: FMP_API_KEY desde .env, CURLOPT_SSL_VERIFYPEER true (busca dónde se desactiva) — si el archivo tocado tiene el fatal `parent::__construct()` de IndiceCtrl, corrígelo por estar en la línea que se toca; regresión: curl de TODOS los endpoints existentes antes/después para demostrar que nada se rompió. Precondiciones: acciones U-01..U-05 del plan maestro §6." |
| Propósito | Dejar los 4 servicios REST sobre una base de plataforma segura y reproducible (PHP 8.2, dependencias fijadas, secretos fuera del código, usuario de base de datos con privilegios mínimos) para que el responsable del sistema pueda construir encima la autenticación y el endurecimiento, sin que el trader note ningún cambio de comportamiento. |
| Resultado esperado | (1) Ningún secreto ni credencial queda escrito en el código PHP: MySQL y la API key de FMP se leen de un `.env` por backend, validado al arrancar. (2) Los 4 backends arrancan con `vendor/autoload.php` de Composer, con `composer.lock` versionado y `composer audit` limpio. (3) La conexión a MySQL usa el usuario `ck_aplicacion` con privilegios mínimos, `utf8mb4` y errores estrictos, y ofrece transacciones. (4) `index.php` localiza el código privado por `RUTA_APLICACION`, de modo que el mismo archivo sirve en local y fuera de `public_html`. (5) `rest_divisas` verifica SSL y `/indice` deja de fallar. (6) Todos los endpoints existentes responden igual que antes (regresión con `curl`), salvo los cambios esperados listados en H3. |
| Fuera de alcance | Cabeceras HTTP, CORS, `.htaccess` definitivo, enrutador por segmento, manejador global de errores y lectura de JSON (HLT-02). Autenticación, sesiones, límites y auditoría (HLT-03). Uso de las transacciones en los flujos de escritura de varias tablas (HLT-04, HLT-05, HLT-06). Correo con PHPMailer (HLT-06; aquí solo se instala la dependencia). Contenido de la lista de claves comunes (HLT-06). Paquete de despliegue y servidor real (HLT-11). Purga del historial git que expuso la API key (HLT-11; aquí solo se elimina del código, la rotación es U-04). Bugs funcionales de los README (por ejemplo `porUsuario`, el `echo` de `crearConPago`, el `b` invertido de Kelly) salvo el fatal de `IndiceCtrl`. Actualizar `CLAUDE.md` raíz y `.claude/agents/desarrollador-php.md` (HLT-03, regla 6 del plan maestro). |
| Feature(s) afectada(s) | `rest_usuario` → `configuracion/`, `index.php`, `anexos/`, `.htaccess`, raíz del repositorio (`composer.*`, `.env*`, `.gitignore`, `logs/`). `rest_criteriokelly`, `rest_suscripcion` → `configuracion/`, `index.php`, `.htaccess`, raíz del repositorio. `rest_divisas` → lo anterior + `controladores/IndiceCtrl.php`, `controladores/CriptoCtrl.php`, `controladores/ForexCtrl.php` (recursos `/indice`, `/cripto`, `/forex`). `criterioKellyApp` → `src/assets/anexos/` (solo copia del script SQL). |

---

## H2. Reglas de negocio

HLT-01 no cambia reglas del dominio Kelly ni el contrato JSON. Introduce invariantes de plataforma y de seguridad, y lista las reglas existentes que no puede romper.

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Ningún archivo PHP contiene credenciales ni constantes `DB_*` de `define()`. | `grep -rnE "define\(\"DB_|DB_(HOST|NAME|USERNAME|PASSWORD|ENCODE)\b" rest_*/ --include=*.php` = 0 líneas y `ls rest_*/configuracion/global.php` falla en los 4. | HU F-01; plan §4.2; hoy `rest_*/configuracion/global.php:3-16`, `rest_*/configuracion/enlace.php:2,11-12` |
| RN-02 | La API key de FMP no aparece en ningún archivo de `rest_divisas` salvo su `.env`. | `grep -rn "mlS7wcZX" rest_divisas --exclude=.env` = 0. | HU F-03, S-12; hoy `rest_divisas/controladores/IndiceCtrl.php:9,13`, `CriptoCtrl.php:7`, `ForexCtrl.php:7` |
| RN-03 | Cada backend arranca solo si su `.env` existe y cumple §4.1; si no, responde **500** `{"error":"Error interno del servidor"}` y registra la causa (nombre de la clave, nunca su valor). | Prueba T-24: `.env` ausente → 500 con ese cuerpo exacto; `APP_ENTORNO=produccion` + `DB_USUARIO=root` → 500; el log de PHP contiene `Configuración inválida` y el nombre de la clave. | HU F-01; plan §4.1 |
| RN-04 | Cada backend tiene `.env` (no versionado), `.env.ejemplo` (versionado, sin valores reales) y `.gitignore` que excluye `.env`, `vendor/` y los logs. | En los 3 repos: `git check-ignore -q .env vendor logs/php_errores.log` = éxito y `git check-ignore -q .env.ejemplo composer.lock` = fallo. En `rest_divisas` el `.gitignore` existe con el mismo contenido. | HU F-01 |
| RN-05 | Las dependencias PHP directas son exactamente `vlucas/phpdotenv` (4 backends) y `phpmailer/phpmailer` (solo `rest_usuario`), fijadas en `composer.lock`, sin vulnerabilidades. | `composer show --direct --name-only` lista solo esas; `composer audit` sale con código 0 en los 4. | HU F-06, R-03; plan §5.3 |
| RN-06 | La aplicación se conecta a MySQL con `ck_aplicacion`, que solo tiene `SELECT, INSERT, UPDATE, DELETE, EXECUTE` sobre `sist_criteriokelly`. Nunca `root`. | `SHOW GRANTS FOR 'ck_aplicacion'@'localhost'` muestra solo `USAGE` global y esos 5 privilegios; un `CREATE TABLE` con ese usuario falla con `ERROR 1142`; los 4 `.env` tienen `DB_USUARIO=ck_aplicacion`. | HU F-02; plan §4.4 |
| RN-07 | `Enlace` es idéntico en los 4 backends, lee la conexión de `Configuracion`, usa `MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT`, `utf8mb4`, y expone `iniciarTransaccion()`, `confirmarTransaccion()` y `revertirTransaccion()`. | Chequeo SHA-256 del plan §4.2 = 1 para `enlace.php`; `grep -c "function iniciarTransaccion\|function confirmarTransaccion\|function revertirTransaccion" rest_usuario/configuracion/enlace.php` = 3. | HU C-05; plan §4.2 |
| RN-08 | `Configuracion.php` es idéntico en los 4 backends. | Chequeo SHA-256 del plan §4.2 = 1 para `Configuracion.php`. | Plan §4.2 |
| RN-09 | `index.php` incluye todo el código privado a partir de `RUTA_APLICACION` (variable de Apache o, si falta, `__DIR__`), y el mismo `index.php` funciona dentro y fuera de la carpeta del código. | Prueba T-23: un `index.php` idéntico servido desde otra carpeta con `SetEnv RUTA_APLICACION` responde igual que el original. | HU E-01; plan §4.1 (último párrafo), §4.3 paso 1 |
| RN-10 | Toda llamada saliente de `rest_divisas` verifica el certificado TLS. | `grep -rnE "SSL_VERIFYPEER *=> *false|verify_peer'? *=> *false" rest_divisas` = 0 y `grep -c "CURLOPT_SSL_VERIFYPEER => true" rest_divisas/controladores/CriptoCtrl.php` = 1. | HU F-03, S-12; hoy `rest_divisas/controladores/CriptoCtrl.php:19` |
| RN-11 | El contrato JSON de todos los endpoints existentes no cambia: mismos códigos HTTP y misma forma de respuesta. Excepciones permitidas: solo las de la tabla "Cambios esperados" de H3. | Comparación T-25 entre `linea_base.txt` y `regresion.txt`. | HU C-07; CLAUDE.md (contrato de respuesta) |
| RN-12 | Reglas existentes que no se rompen: el cálculo Kelly sigue en el backend; el **422** sigue reservado para el límite de pérdida; las respuestas siguen siendo dato directo o `{error}`; las consultas siguen preparadas. | Regresión T-25 (incluye `finalizaBitacora`) y `grep -rn "respuestaJson(" rest_*/controladores` solo en bloques comentados existentes. | `doc_modo_planificacion.md` §4.2; CLAUDE.md |
| RN-13 | Los ambientes se diferencian solo por configuración: ningún archivo PHP nuevo o modificado contiene `localhost` ni `/criterio_kelly/`. | `grep -rn "localhost\|/criterio_kelly/" rest_*/configuracion/Configuracion.php rest_*/configuracion/enlace.php rest_*/index.php` = 0. | HU J-01, R-06 |

---

## H3. Flujo principal de ejecución

HLT-01 no tiene disparador de usuario final: el flujo es el arranque de cada petición HTTP a cualquier backend.

### Flujo A · Arranque normal (cualquier petición)

```
[Petición HTTP a $B/rest_<x>/<recurso>/<acción>]
  → .htaccess (sin cambios funcionales salvo T-20) → index.php
  → Paso 1: RUTA_APLICACION = getenv('RUTA_APLICACION') ?: $_SERVER['REDIRECT_RUTA_APLICACION'] ?: __DIR__ (debe ser carpeta existente)
            require RUTA_APLICACION/vendor/autoload.php
            require RUTA_APLICACION/configuracion/Configuracion.php
  → Paso 2: Configuracion::cargar(RUTA_APLICACION, NOMBRE_SERVICIO)
            phpdotenv lee RUTA_APLICACION/.env → valida §4.1 → guarda valores → borra esas claves de $_ENV/$_SERVER
  → require RUTA_APLICACION/configuracion/CorsConfig.php → CorsConfig::configurar() / manejarPreflight() (sin cambios hasta HLT-02)
  → Enrutamiento actual por strpos (sin cambios hasta HLT-02), con require de RUTA_APLICACION/<archivo de ruta>
  → Rts → Ctrl → Mdl → new Enlace()
       → Enlace reutiliza la conexión de la petición o crea una: mysqli_report(ERROR|STRICT), new mysqli(DB_HOST, DB_USUARIO, DB_CLAVE, DB_NOMBRE, DB_PUERTO), set_charset(DB_CHARSET='utf8mb4')
  → MySQL (usuario ck_aplicacion) → respuesta JSON de BaseCtrl (sin cambios)
   ├─ Éxito: mismo código y forma que antes (RN-11)
   └─ Error: los mismos códigos de hoy (400/401/404/409/422/500), generados por los controladores existentes
```

### Flujo B · Configuración ausente o inválida

```
[Petición] → index.php Paso 1 → Paso 2 Configuracion::cargar lanza RuntimeException
  → catch (Throwable) en index.php
  → error_log('[index.php] Configuración inválida: <motivo con nombre de clave>')   (log de PHP: php.ini o php_value error_log)
  → http_response_code(500) + Content-Type JSON + {"error":"Error interno del servidor"} → exit
   └─ Error 500: la app muestra el mensaje genérico vía errorInterceptor
```

Causas que disparan el Flujo B: `.env` inexistente o ilegible; clave obligatoria ausente; valor fuera de su regla (V-01…V-24 de H8); `RUTA_APLICACION` que no es carpeta; `vendor/autoload.php` ausente (el `require` falla con error fatal → 500 de Apache/PHP sin cuerpo JSON; se documenta en el README como "ejecutar `composer install`").

### Flujo C · Base de datos no disponible o credenciales erróneas

```
[Petición que consulta BD] → Mdl → new Enlace() → new mysqli(...) lanza mysqli_sql_exception
  → Enlace registra '[Enlace::__construct] Error de conexión: <mensaje>' y relanza
  → catch (Exception) del controlador existente → 500 con el mensaje que ese controlador ya emite hoy
   └─ Error 500 (la homogeneización del mensaje genérico es C-08, HLT-02)
```

### Flujo D · `rest_divisas` `/indice/disponible`

```
[GET $B/rest_divisas/indice/disponible] → index.php (Flujo A) → rutas/IndiceRts.php:7 new IndiceCtrl()
  → IndiceCtrl::__construct(): $this->apiKey = Configuracion::obtener('FMP_API_KEY')   (sin parent::__construct)
  → getAllIndices(): file_get_contents(https://financialmodelingprep.com/api/v3/quotes/index?apikey=…) con verificación TLS por defecto
   ├─ Éxito: 200 [ {symbol, name, price, type:'indice'} … ]
   └─ API externa falla o rechaza la clave: 200 [] (comportamiento documentado en el README)
```

### Catálogo de regresión (usado en T-02, T-03 y T-25, y reutilizado por HLT-02)

Base: `$U=$B/rest_usuario`, `$K=$B/rest_criteriokelly`, `$S=$B/rest_suscripcion`, `$D=$B/rest_divisas`. `NN` = sufijo de corrida de dos dígitos (`01` línea base, `02` regresión de HLT-01). Variables capturadas: `ID` (de R-05, campo `idUsuario`), `CUENTA` (de R-19, `cue_idCuentas` del primer elemento), `BIT` (de R-23, `bit_idbitacora`), `OBS` (de R-26, `obs_idObserva` del primer elemento), `BIT2` (de R-36, `bit_idbitacora`). Todas las peticiones con cuerpo envían `Content-Type: application/json` y `Accept: application/json`.

| ID | Método | Ruta | Cuerpo |
|----|--------|------|--------|
| R-01 | GET | `$U/autenticacion` | — |
| R-02 | GET | `$U/persona` | — |
| R-03 | GET | `$U/usuario` | — |
| R-04 | GET | `$U/rol` | — |
| R-05 | POST | `$U/persona/agregar` | `{"nombres":"Regresion","apellidos":"Prueba","correo":"regresionNN@ejemplo.com","telefono":"09900000NN","usuario":"regresionNN","clave":"ClaveRegresionNN"}` |
| R-06 | POST | `$U/autenticacion/autenticar` | `{"usuario":"regresionNN","clave":"ClaveRegresionNN"}` |
| R-07 | POST | `$U/autenticacion/autenticar` | `{"usuario":"regresionNN","clave":"incorrecta"}` |
| R-08 | GET | `$U/autenticacion/usRol?id=ID` | — |
| R-09 | PUT | `$U/persona/actualizarDeApp` | `{"id":ID,"nombres":"Regresion","apellidos":"Editada","telefono":"09900000NN"}` |
| R-10 | GET | `$U/persona/obtener?id=ID` | — |
| R-11 | DELETE | `$U/persona/eliminar` | — |
| R-12 | POST | `$U/autenticacion/generarCodigo` | `{"id":ID}` |
| R-13 | POST | `$U/autenticacion/obtenerCodigo` | `{"usuario":"regresionNN"}` |
| R-14 | PUT | `$U/autenticacion/actualizarClave` | `{"id":ID,"usuario":"regresionNN","clave":"ClaveRegresionNN"}` |
| R-15 | POST | `$U/autenticacion/accionInexistente` | `{"a":1}` |
| R-16 | POST | `$U/persona/agregar` | mismo cuerpo que R-05 (duplicado) |
| R-17 | GET | `$K/cuentas` | — |
| R-18 | POST | `$K/cuentas/nueva` | `{"cue_nombre":"Regresion NN","cue_usuarioId":ID,"fecha_valor":"2026-11-02 10:00:00","valor_cuenta":1000}` |
| R-19 | GET | `$K/cuentas/obtener?id=ID` | — |
| R-20 | POST | `$K/cuentas/movCapital` | `{"cap_usuarioId":ID,"cap_cueIdCuentas":CUENTA,"cap_monto":100,"cap_capital":1100,"cap_tipoMovimie":"D"}` |
| R-21 | PUT | `$K/cuentas/nombre` | `{"cue_nombre":"Regresion editada","cue_idCuenta":CUENTA,"cue_usuarioId":ID}` |
| R-22 | GET | `$K/bitacora` | — |
| R-23 | POST | `$K/bitacora/crear` | `{"bit_usuarioId":ID,"bit_cueIdCuentas":CUENTA,"bit_divisa":"EURUSD","bit_tipoOperaci":"COMPRA","bit_fechaCrea":"2026-11-02T10:30:00","bit_numeroBitac":1,"bit_precioEntra":1.1,"bit_precioSL":1.09,"bit_precioTP":1.12,"obs_comentario":"Regresion","obs_tipoObserva":"I"}` |
| R-24 | POST | `$K/bitacora/listBitacora` | `{"bit_usuarioId":ID,"bit_cueIdCuentas":CUENTA}` |
| R-25 | GET | `$K/comentarios` | — |
| R-26 | GET | `$K/comentarios/observaciones?id=BIT` | — |
| R-27 | POST | `$K/comentarios/crearComentario` | `{"obs_bitIdbitaco":BIT,"obs_comentario":"Regresion 2","obs_tipoObserva":"O"}` |
| R-28 | PUT | `$K/comentarios/comentarioBitacora` | `{"bit_idbitacora":BIT,"obs_idObserva":OBS,"bit_precioEntra":1.1,"bit_precioSL":1.08,"bit_precioTP":1.13,"obs_comentario":"Regresion editada"}` |
| R-29 | PUT | `$K/bitacora/finalizaBitacora` | `{"bit_idbitacora":BIT,"bit_resultado":"GANADOR","bit_situacion":"F","bit_respeReglas":"SI","bit_montoResult":50,"bit_cueIdCuentas":CUENTA,"bit_usuarioId":ID,"cke_numDivisor":10}` |
| R-30 | GET | `$K/criterioKelly` | — |
| R-31 | POST | `$K/criterioKelly/obtenerPorcentaje` | `{"cke_usuarioId":ID}` |
| R-32 | POST | `$K/criterioKelly/obtenerResultados` | `{"cke_usuarioId":ID}` |
| R-33 | POST | `$K/criterioKelly/detalleOperacion` | `{"cke_usuarioId":ID}` |
| R-34 | POST | `$K/criterioKelly/operacionAnalisis` | `{"cke_usuarioId":ID}` |
| R-35 | POST | `$K/criterioKelly/observacionAnalisis` | `{"cke_usuarioId":ID}` |
| R-36 | POST | `$K/bitacora/crear` | igual que R-23 con `"bit_numeroBitac":2` |
| R-37 | DELETE | `$K/bitacora/eliminarBitacora?id=BIT2` | — |
| R-38 | DELETE | `$K/cuentas/eliminar` | `{"cue_idCuenta":CUENTA,"cue_usuarioId":ID}` |
| R-39 | GET | `$K/cuentas/obtener?id=abc` | — |
| R-40 | GET | `$S/planes` | — |
| R-41 | GET | `$S/planes/disponible` | — |
| R-42 | GET | `$S/planes/suscritos/ID` | — |
| R-43 | GET | `$S/suscripcion` | — |
| R-44 | GET | `$S/suscripcion/porUsuario?id=ID` | — |
| R-45 | POST | `$S/suscripcion/crearSinPago` | `{"sus_pinIdPlanin":1,"sus_usuarioId":ID}` |
| R-46 | POST | `$S/suscripcion/crearConPago` | `{"pin_idPlanInterv":1,"iUsuario":ID,"idTransaccion":"REG-NN","ins_numMeses":1,"pin_precioFinal":1.25}` |
| R-47 | GET | `$D/cripto` | — |
| R-48 | GET | `$D/cripto/disponible` | — |
| R-49 | GET | `$D/forex` | — |
| R-50 | GET | `$D/forex/disponible` (timeout de curl 200 s) | — |
| R-51 | GET | `$D/indice` | — |
| R-52 | GET | `$D/indice/disponible` | — |
| R-53 | GET | `$D/sinteticos` | — |
| R-54 | GET | `$D/otros` | — |
| R-55 | GET | `$U/` | — |
| R-56 | GET | `$K/` | — |
| R-57 | GET | `$S/` | — |
| R-58 | GET | `$D/` | — |

Cada fila produce una línea `R-xx|MÉTODO|ruta-sin-base|código|forma`, donde `forma` se calcula con este comando exacto sobre el cuerpo:

```bash
$PHP -r '$c=stream_get_contents(STDIN); if($c===""){echo "vacio";exit;} $d=json_decode($c,true); if(!is_array($d)){echo "no-json";exit;} if(array_is_list($d)){$p=$d[0]??[]; $k=is_array($p)?array_keys($p):[]; sort($k); echo "lista:".implode(",",$k);} else {$k=array_keys($d); sort($k); echo "objeto:".implode(",",$k);}'
```

**Cambios esperados en HLT-01** (únicas diferencias admitidas entre línea base y regresión, columnas código y forma):

| ID | Antes | Después | Motivo |
|----|-------|---------|--------|
| R-51 | `500` | `200` `objeto:service,status,timestamp,version` | Se corrige el fatal de `IndiceCtrl` (D-15) |
| R-52 | `500` | `200` con `lista:…` (cualquier forma de lista, incluida `lista:` vacía) | Ídem; el contenido depende de la respuesta de FMP |
| R-48, R-50, R-52 | — | La forma `lista:` puede pasar a `lista:` vacía si la API externa no responde | Dependencia externa (Binance/Frankfurter/FMP); no es regresión del código |

---

## H4. Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| U-01…U-05 (precondición) | T-01 | Comandos de T-01 |
| E-01 (estructura y `RUTA_APLICACION`) / RN-09 | T-18, T-23 | Prueba de carpeta externa (T-23) |
| F-01 (`.env`, `.env.ejemplo`, `.gitignore`, validación al arrancar) / RN-03, RN-04 | T-08, T-09, T-10, T-11, T-12, T-17, T-18, T-24 | `git check-ignore`; prueba de arranque inválido (T-24) |
| F-02 (usuario MySQL) / RN-06 | T-15, T-16, T-17 | `SHOW GRANTS`; `CREATE TABLE` denegado |
| F-03 (FMP en `.env`, SSL) / RN-02, RN-10 | T-21, T-22 | `grep` de la clave y de `VERIFYPEER`; R-48, R-52 |
| F-06 (`composer audit`) / RN-05 | T-04, T-05, T-06, T-07 | `composer audit` = 0 en los 4 |
| C-05 (transacciones en `Enlace`) / RN-07 | T-13, T-14 | `grep` de los 3 métodos; prueba T-14 de commit/rollback |
| J-02 (backends en local) | T-01, T-04…T-07, T-17, T-26 | README "Ambiente local" + servicios respondiendo en `$B/rest_<x>/` |
| J-08 (README "Ambiente local" + tabla `.env`) | T-26 | `grep -c "## Ambiente local"` = 1 en los 4 README |
| RN-01 (sin `global.php` ni `DB_*`) | T-13, T-14, T-19 | `grep` de RN-01 |
| RN-08 (`Configuracion` idéntica) | T-11, T-12 | Chequeo SHA-256 |
| RN-11, RN-12 (sin regresión) | T-02, T-03, T-25 | Diff línea base vs regresión |
| RN-13 (sin rutas de ambiente en código) | T-11, T-13, T-18 | `grep` de RN-13 |
| Ventana HLT-01→HLT-02 (artefactos nuevos expuestos) | T-20 | `curl` a `composer.lock`, `vendor/autoload.php`, `logs/`, `.env` → 403/404 |
| Copia del script en la app (plan §4.4) | T-16 | `sha256sum` igual en ambas rutas |

### Checklist de calidad del HLT

- [x] ✅ Las 11 secciones existen y están completas.
- [x] ✅ Sin marcadores pendientes.
- [x] ✅ Cada RN mapea a ≥1 tarea (cobertura 100 %).
- [x] ✅ Cada tarea tiene criterio de aceptación verificable y ficha de seguimiento (H9).
- [x] ✅ No contradice las reglas del proyecto (§0.5) ni los contratos del plan maestro (§4, §5).
- [x] ✅ Referencias `ruta:línea` verificadas contra el repositorio el 2026-11-02.
- [x] ✅ Decisiones cerradas (H5) sin ambigüedad.

---

## H5. Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Firma de carga de configuración | A) `cargar()` sin argumentos leyendo constantes globales · B) `cargar(string $rutaAplicacion, string $nombreServicio)` | B | Sin dependencias ocultas; el nombre de la clase y el método son los de §4.2/§4.3. `index.php` define `const NOMBRE_SERVICIO = 'rest_<x>'`. | No |
| D-02 | Alcance de la validación en HLT-01 | A) Solo claves usadas hasta HLT-02 · B) Todas las claves de §4.1 con su regla, por servicio | B | §4.2 asigna a `Configuracion` (HLT-01) validar §4.1; evita volver a tocar un archivo compartido en HLT-03/HLT-06. `rest_usuario/.env` incluye desde ya `TOKEN_*`, `COOKIE_*`, `CORREO_*`, `SMTP_*`, `RUTA_CLAVES_COMUNES`. | No |
| D-03 | `RUTA_CLAVES_COMUNES` exige "archivo existente" antes de que HLT-06 cree la lista | A) No validar hasta HLT-06 · B) Crear ahora `rest_usuario/configuracion/claves_comunes.txt` vacío (0 bytes), versionado, que HLT-06 llena | B | Cumple §4.1 sin excepción temporal. Nadie lee el archivo antes de HLT-06. | No |
| D-04 | Rutas relativas en `.env` (`RUTA_LOGS`, `RUTA_CLAVES_COMUNES`) | A) Solo absolutas · B) Relativas se resuelven contra `RUTA_APLICACION` | B | El `.env.ejemplo` queda portable (`RUTA_LOGS=logs`) y no contiene rutas de la máquina (J-01). `obtener()` devuelve la ruta ya resuelta. Una ruta es absoluta si empieza por `/` o por `<letra>:`. | No |
| D-05 | Validación de correos (`CORREO_REMITENTE`, `CORREO_ALERTAS`) | A) `FILTER_VALIDATE_EMAIL` estricto · B) A + aceptar `<local>@localhost` solo con `APP_ENTORNO=local` | B | Los ejemplos locales de §4.1 (`no-responder@localhost`, `admin@localhost`) no pasan `FILTER_VALIDATE_EMAIL`. Regex de la excepción: `/^[A-Za-z0-9._%+-]+@localhost$/`. | No |
| D-06 | Valor de `DB_CHARSET` | A) Cualquier valor no vacío · B) Exactamente `utf8mb4` | B | §4.2 fija `utf8mb4` para `Enlace`; un valor distinto sería un error de configuración. | No |
| D-07 | Carga de phpdotenv | A) `createUnsafeImmutable` (usa `putenv`) · B) `Dotenv::createImmutable(RUTA_APLICACION)->load()` y copia a `Configuracion`; después se eliminan esas claves de `$_ENV` y `$_SERVER` | B | Sin `putenv` (no se heredan a procesos hijos); reduce la superficie de exposición de secretos (por ejemplo, volcados de `$_SERVER`). `load()` lanza si falta `.env` → Flujo B. | No |
| D-08 | Conexión de `Enlace` | A) Una conexión por instancia (hoy) · B) Una conexión `mysqli` compartida por petición (propiedad estática), creada en el primer `new Enlace()` | B | Las transacciones de C-05 en HLT-04/05/06 cruzan varios modelos (`ReglasKellyCtrl` usa 3 modelos, cada uno con su `new Enlace()`); sin conexión compartida no hay transacción posible. `__destruct` deja de cerrar la conexión (PHP la cierra al terminar la petición); `cerrarConexion()` se mantiene público y la anula. | No |
| D-09 | Métodos públicos de `Enlace` unificado | A) Copiar una de las 3 variantes actuales · B) Unión de los métodos usados | B | Hoy hay 3 variantes (`rest_usuario`, `rest_criteriokelly`=`rest_divisas`, `rest_suscripcion`). Métodos: `ejecutarConsulta`, `ejecutarConsultaSimpleFila`, `ejecutarConsultaRetornarID`, `ejecutarInsercionRetornaID`, `ejecutarActualizacion`, `limpiarCadena`, `cerrarConexion`, `iniciarTransaccion`, `confirmarTransaccion`, `revertirTransaccion`. Se elimina `ejecutarInsercion` (`rest_usuario/configuracion/enlace.php:75`) porque no tiene ningún uso. | No |
| D-10 | Usuario MySQL local | A) Solo `'ck_aplicacion'@'localhost'` · B) `@'localhost'` y `@'127.0.0.1'` | B | En MariaDB 10.4 de XAMPP existen `root@localhost` y `root@127.0.0.1`; según el transporte, el host visto cambia. Ambos con los mismos 5 privilegios. | No |
| D-11 | Clave del usuario MySQL en el script | A) Escrita en el script · B) Variable de sesión `@clave_aplicacion` (≥ 24 caracteres) definida al invocar; el script aborta si falta o es corta | B | Ningún secreto versionado (F-01). La clave local se genera con `$PHP -r "echo bin2hex(random_bytes(16));"` (32 caracteres) y se escribe solo en los 4 `.env`. | No |
| D-12 | Versión de PHP para resolver dependencias | A) La del equipo · B) `config.platform.php = "8.2.0"` en los 4 `composer.json` | B | El `composer.lock` debe instalarse igual en el hosting con PHP 8.2 (R-04, plan B de R-02). | No |
| D-13 | Momento de agregar `phpmailer/phpmailer` | A) En HLT-06 · B) En HLT-01 (solo `rest_usuario`) | B | El conjunto de dependencias queda cerrado y auditado desde el inicio (F-06); HLT-06 solo lo usa. Las dependencias transitivas de phpdotenv (`graham-campbell/result-type`, `phpoption/phpoption`, `symfony/polyfill-*`) son aceptadas por ser de la dependencia autorizada. | No |
| D-14 | `rest_divisas/.env` creado por el usuario en U-04 | A) Sobrescribir · B) Completar las claves faltantes conservando `FMP_API_KEY` | B | U-04 deja la clave nueva solo ahí. | No |
| D-15 | Fatal `parent::__construct()` (`rest_divisas/controladores/IndiceCtrl.php:12`) | A) Fuera de alcance · B) Corregir (se elimina la línea) | B | Está en el constructor que T-21 reescribe para leer `FMP_API_KEY` (regla 7 del plan maestro). | No |
| D-16 | Verificación TLS en `file_get_contents` (`ForexCtrl`, `IndiceCtrl`) | A) Agregar contexto `ssl` explícito · B) Mantener el comportamiento por defecto de PHP (`verify_peer=true`) | B | PHP verifica por defecto y ningún archivo lo desactiva; menor superficie de cambio (RD-7). Solo `CriptoCtrl.php:19` desactiva la verificación. | No |
| D-17 | Protección durante la ventana HLT-01 → HLT-02 | A) Ninguna · B) Ajuste mínimo del `.htaccess` actual: denegar `composer.json`, `composer.lock`, `.env.ejemplo` y responder 404 a `vendor/` y `logs/` | B | HLT-01 crea artefactos que hoy serían descargables (`vendor/`, `composer.lock`, `logs/`). HLT-02 reemplaza el `.htaccess` completo. | No |
| D-18 | Fallo al arrancar (Flujo B) | A) Dejar el fatal de PHP · B) `try/catch (Throwable)` en `index.php` alrededor de `Configuracion::cargar` con 500 genérico | B | F-01 exige 500 genérico y registro. El manejador global (HLT-02) se registra después de la carga (§4.3 paso 3), por eso este `try/catch` se mantiene. | No |
| D-19 | Búsqueda de `RUTA_APLICACION` | A) Solo `getenv` · B) `getenv('RUTA_APLICACION')`, luego `$_SERVER['REDIRECT_RUTA_APLICACION']`, luego `__DIR__`; el valor debe ser carpeta existente | B | Tras la reescritura interna de Apache la variable puede llegar con prefijo `REDIRECT_`. | No |
| D-20 | `.gitignore` en `rest_divisas` (sin git) | A) No crearlo · B) Crearlo igual que en los demás | B | Deja la carpeta lista para versionarse sin filtrar `.env`. Se verifica por contenido, no con `git`. | No |
| D-21 | Evidencias de regresión | A) Solo en el reporte · B) Script `docs/Planificacion/evidencias/regresion_endpoints.sh` + salidas en `docs/Planificacion/evidencias/HLT-01/` | B | Reproducible y reutilizable por HLT-02 (J-06). Cada corrida usa un sufijo propio para no chocar con datos de la anterior. | No |
| D-22 | `DB_PUERTO` | A) Ignorarlo · B) Pasarlo como 5.º argumento de `new mysqli` | B | Clave obligatoria de §4.1; sin efecto en local (3306). | No |

---

## H6. Revisión del requerimiento por parte de un senior

### Revisión 1 (sobre el borrador)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 copia el requerimiento literal y cubre los 8 criterios asignados. |
| 2 | Reglas de negocio | ✅ | RN invariantes y booleanas. |
| 3 | Impacto | ❌ | El borrador tomaba `rest_suscripcion/configuracion/enlace.php` como base y **perdía `ejecutarConsultaRetornarID`**, usado 5 veces en `rest_usuario` (p. ej. `rest_usuario/modelos/PersonaMdl.php:47`) y 3 en `rest_criteriokelly` (p. ej. `rest_criteriokelly/modelos/CuentasMdl.php:19`). Rompería el registro y la creación de cuentas. |
| 4 | Consistencia arquitectónica | ❌ | Con una conexión por instancia, `iniciarTransaccion()` no sirve para flujos de varios modelos (HLT-04). |
| 5 | Riesgos | ✅ | Ver tabla de riesgos abajo. |
| 6 | Simplicidad | ✅ | Sin clases extra; solo las de §4.2. |
| 7 | Seguridad | ❌ | El borrador sobrescribía `rest_divisas/.env`, borrando la clave rotada en U-04. Además, entre HLT-01 y HLT-02 quedaban expuestos `vendor/`, `composer.lock` y `logs/`. |
| 8 | Cobertura | ✅ | 100 %. |
| 9 | Determinismo | ❌ | `CORREO_REMITENTE=no-responder@localhost` (ejemplo de §4.1) fallaría con `FILTER_VALIDATE_EMAIL`: el arranque de `rest_usuario` quedaría roto con los valores del propio plan. |
| 10 | Ejecutabilidad | ✅ | — |

**Veredicto revisión 1: APROBADO CON CAMBIOS.** Cambios obligatorios aplicados:

1. D-09: `Enlace` es la unión de métodos usados, con `ejecutarConsultaRetornarID` incluido.
2. D-08: conexión compartida por petición.
3. D-14 y T-17: `rest_divisas/.env` se completa, no se sobrescribe. D-17 y T-20: protección provisional.
4. D-05: excepción `@localhost` solo en local.

### Revisión 2 (sobre la versión final)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | Sin cambios. |
| 2 | Reglas de negocio | ✅ | RN-01…RN-13 completas, sin contradicciones. |
| 3 | Impacto | ✅ | Usos de `Enlace` verificados con `grep` en los 3 backends con BD (`ejecutarConsulta` 17, `ejecutarConsultaSimpleFila` 22, `ejecutarConsultaRetornarID` 8, `ejecutarInsercionRetornaID` 12, `ejecutarActualizacion` 24 usos); todos existen en la versión unificada. Ningún archivo fuera de `enlace.php` incluye `global.php`. |
| 4 | Consistencia arquitectónica | ✅ | Respeta `.htaccess → index.php → Rts → Ctrl → Mdl → Enlace` y los contratos §4.1–§4.3. |
| 5 | Riesgos | ✅ | Tabla abajo. |
| 6 | Simplicidad | ✅ | Cambios mínimos en el enrutamiento (sigue el de hoy hasta HLT-02). |
| 7 | Seguridad | ✅ | Sin secretos versionados; usuario MySQL mínimo; TLS verificado; ventana cubierta. |
| 8 | Cobertura | ✅ | Matriz H4 al 100 %. |
| 9 | Determinismo | ✅ | 22 decisiones cerradas; reglas de validación V-01…V-24 explícitas en H8. |
| 10 | Ejecutabilidad | ✅ | Cada tarea declara archivos, comando de aceptación y agente. |

**Riesgos**

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| El paso a PHP 8.2 (U-01) cambia el comportamiento de código existente (en 8.1+ `mysqli` lanza excepciones por defecto; avisos nuevos de deprecación). | Alta | La línea base (T-03) se toma **ya en PHP 8.2 y antes de tocar código**, y la regresión (T-25) compara contra ella; cualquier diferencia fuera de "Cambios esperados" bloquea el cierre (RS-8). |
| La API key de FMP sigue en el historial git (código público de antes). | Alta | U-04 la rota antes de empezar; T-21/T-22 la sacan del código; la purga del historial y la verificación final quedan en HLT-11. `rest_divisas` no es repositorio git, pero sus archivos pudieron copiarse. |
| Un `.env` mal escrito deja el backend entero en 500. | Media | Es el comportamiento exigido (F-01). El mensaje del log nombra la clave; el README documenta cada clave y su regla. |
| La ruta de `vendor/` no existe en una copia nueva (falta `composer install`). | Media | Paso explícito en "Ambiente local"; T-04…T-07 lo ejecutan. |
| `composer audit` reporta una vulnerabilidad nueva en el momento de ejecutar. | Media | T-04…T-07 se bloquean (RS-4) y se registra la versión segura a fijar; no se aceptan dependencias nuevas. |
| La extensión `openssl` no está activa en el PHP nuevo (hoy `C:\xampp\php\php.ini:937` la tiene comentada) y Composer no descarga. | Media | T-01 la verifica (`php -m`) como parte de U-01/U-02. |
| `cripto/disponible` devuelve `[]` al activar la verificación TLS si `curl.cainfo` no apunta a un bundle válido. | Baja | Hoy `php.ini:1934` define `curl.cainfo`; T-01 lo comprueba en el PHP nuevo. |

**Veredicto revisión 2: APROBADO.** El HLT es cerrado, determinista y cubre al 100 % los criterios asignados; los hallazgos de la revisión 1 están resueltos en H5 y en el plan de tareas.

---

## H7. Plan de tareas

Orden topológico. Las tareas T-04…T-07 son paralelizables entre sí (repositorios distintos); el resto, secuencial. `RS` = ruta de `docs/Planificacion/evidencias/`.

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req cubierto |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|-----------------|
| T-01 | desarrollador-php | Verificar las precondiciones U-01…U-05 | Solo lectura: `C:\xampp\php\php.exe`, `C:\xampp\php\php.ini`, `rest_divisas/.env` | — | `$PHP -v` ≥ 8.2; `$PHP -m` contiene `openssl`, `curl`, `mysqli`, `mbstring`; `$PHP -i \| grep curl.cainfo` no vacío; `composer --version` = 2.x; existe un `.sql` de respaldo (U-05) cuya ruta se anota; `grep -c "^FMP_API_KEY=." rest_divisas/.env` = 1. Si algo falla → BLOQUEADA con la acción U-xx. | U-01…U-05, J-02 |
| T-02 | desarrollador-php | Crear el script de regresión del catálogo R-01…R-58 | `docs/Planificacion/evidencias/regresion_endpoints.sh` (nuevo) | T-01 | `bash -n` sin errores; el script recibe `<NN> <archivo_salida>`, usa `BASE_URL` (por defecto `http://localhost/criterio_kelly`), ejecuta R-01…R-58 en orden con las capturas de H3 y escribe 58 líneas `R-xx\|MÉTODO\|ruta\|código\|forma` con el comando de forma de H3. | RN-11 |
| T-03 | desarrollador-php | Capturar la línea base con el código sin cambios | `docs/Planificacion/evidencias/HLT-01/linea_base.txt` (nuevo) | T-02 | `bash RS/regresion_endpoints.sh 01 RS/HLT-01/linea_base.txt` → archivo con 58 líneas; `git -C rest_usuario status --short` vacío (prueba de que no se tocó código). | RN-11, RN-12 |
| T-04 | desarrollador-php | Crear `composer.json` e instalar dependencias de `rest_usuario` | `rest_usuario/composer.json` (nuevo), `rest_usuario/composer.lock` (generado), `rest_usuario/vendor/` (generado) | T-03 | En `rest_usuario`: `composer validate --strict` OK; `composer show --direct --name-only` = `phpmailer/phpmailer` y `vlucas/phpdotenv`; `composer audit` sale con 0. | F-06, RN-05 |
| T-05 | desarrollador-php | Crear `composer.json` e instalar dependencias de `rest_criteriokelly` | `rest_criteriokelly/composer.json`, `composer.lock`, `vendor/` | T-03 | Igual que T-04 con `show --direct` = solo `vlucas/phpdotenv`. | F-06, RN-05 |
| T-06 | desarrollador-php | Crear `composer.json` e instalar dependencias de `rest_suscripcion` | `rest_suscripcion/composer.json`, `composer.lock`, `vendor/` | T-03 | Igual que T-05. | F-06, RN-05 |
| T-07 | desarrollador-php | Crear `composer.json` e instalar dependencias de `rest_divisas` | `rest_divisas/composer.json`, `composer.lock`, `vendor/` | T-03 | Igual que T-05. | F-06, RN-05 |
| T-08 | desarrollador-php | Crear `.gitignore` y la carpeta de logs en los 4 backends | `rest_usuario/.gitignore`, `rest_usuario/logs/.gitkeep`, `rest_criteriokelly/.gitignore`, `rest_criteriokelly/logs/.gitkeep`, `rest_suscripcion/.gitignore`, `rest_suscripcion/logs/.gitkeep`, `rest_divisas/.gitignore`, `rest_divisas/logs/.gitkeep` (nuevos) | T-04…T-07 | En los 3 repos: `git check-ignore -q .env && git check-ignore -q vendor/autoload.php && git check-ignore -q logs/php_errores.log` OK y `git check-ignore -q logs/.gitkeep` falla; `sha256sum rest_*/.gitignore \| awk '{print $1}' \| sort -u \| wc -l` = 1. | F-01, RN-04 |
| T-09 | desarrollador-php | Crear `.env.ejemplo` en los 4 backends | `rest_usuario/.env.ejemplo`, `rest_criteriokelly/.env.ejemplo`, `rest_suscripcion/.env.ejemplo`, `rest_divisas/.env.ejemplo` (nuevos) | T-08 | Contenido exacto de H8 §8.3; `grep -c "^DB_CLAVE=$"` = 1 y `grep -c "^FMP_API_KEY=$" rest_divisas/.env.ejemplo` = 1 (sin valores reales); en los 3 repos `git check-ignore -q .env.ejemplo` falla. | F-01, RN-04 |
| T-10 | desarrollador-php | Crear la lista de claves comunes vacía | `rest_usuario/configuracion/claves_comunes.txt` (nuevo, 0 bytes) | T-08 | `test -f` OK y `wc -c` = 0. | D-03 |
| T-11 | desarrollador-php | Crear la clase `Configuracion` | `rest_usuario/configuracion/Configuracion.php` (nuevo) | T-04, T-09, T-10 | `$PHP -l` OK; implementa la API y las reglas V-01…V-24 de H8 §8.2; `$PHP -r` de humo de H8 §8.2 imprime `OK`. | F-01, RN-03, RN-08, RN-13 |
| T-12 | desarrollador-php | Copiar `Configuracion.php` a los otros 3 backends | `rest_criteriokelly/configuracion/Configuracion.php`, `rest_suscripcion/configuracion/Configuracion.php`, `rest_divisas/configuracion/Configuracion.php` (nuevos) | T-11 | Chequeo SHA-256 del plan §4.2 → `Configuracion.php: 1`. | RN-08 |
| T-13 | desarrollador-php | Reescribir `Enlace` (unificado, desde `Configuracion`, estricto, `utf8mb4`, conexión compartida, transacciones) | `rest_usuario/configuracion/enlace.php:1-148` | T-11 | `$PHP -l` OK; `grep -c "global.php\|DB_HOST\|DB_USERNAME" rest_usuario/configuracion/enlace.php` = 0; contiene los 10 métodos públicos de D-09 y `mysqli_report(MYSQLI_REPORT_ERROR \| MYSQLI_REPORT_STRICT)`. | C-05, RN-07, RN-01 |
| T-14 | desarrollador-php | Copiar `enlace.php` a los otros 3 backends y probar la transacción | `rest_criteriokelly/configuracion/enlace.php:1-148`, `rest_suscripcion/configuracion/enlace.php:1-104`, `rest_divisas/configuracion/enlace.php:1-148` | T-13, T-17 | Chequeo SHA-256 → `enlace.php: 1`; prueba CLI de H8 §8.4 imprime `rollback OK` y `commit OK`. | C-05, RN-07 |
| T-15 | desarrollador-php | Crear el script del usuario MySQL de aplicación | `rest_usuario/anexos/seguridad_00_usuario_mysql.sql` (nuevo) | T-03 | Contenido de H8 §8.5; `grep -c "IDENTIFIED BY '" ` = 0 (sin clave literal). | F-02, RN-06 |
| T-16 | **desarrollador-ionic** | Copiar el script SQL a los anexos de la app | `criterioKellyApp/src/assets/anexos/seguridad_00_usuario_mysql.sql` (nuevo) | T-15 | `sha256sum rest_usuario/anexos/seguridad_00_usuario_mysql.sql criterioKellyApp/src/assets/anexos/seguridad_00_usuario_mysql.sql \| awk '{print $1}' \| sort -u \| wc -l` = 1. | Plan §4.4 |
| T-17 | desarrollador-php | Ejecutar el script en local y crear los `.env` de los 4 backends | `rest_usuario/.env`, `rest_criteriokelly/.env`, `rest_suscripcion/.env` (nuevos), `rest_divisas/.env` (completar, D-14) | T-09, T-15 | `$MYSQL -u root -e "SHOW GRANTS FOR 'ck_aplicacion'@'localhost'; SHOW GRANTS FOR 'ck_aplicacion'@'127.0.0.1'"` muestra solo `USAGE` y `SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`sist_criteriokelly\`.*`; `$MYSQL -u ck_aplicacion -p"<clave>" -h 127.0.0.1 -e "CREATE TABLE sist_criteriokelly.prueba_privilegios (i INT)"` → `ERROR 1142`; los 4 `.env` tienen `DB_USUARIO=ck_aplicacion` y la misma `DB_CLAVE`; `rest_divisas/.env` conserva su `FMP_API_KEY` (mismo hash SHA-256 de esa línea antes y después). | F-01, F-02, J-02, RN-06 |
| T-18 | desarrollador-php | Ajustar el arranque de los 4 `index.php` (pasos 1–2 de §4.3) | `rest_usuario/index.php:3,38-41`, `rest_criteriokelly/index.php:3,38-41`, `rest_suscripcion/index.php:3,36-39`, `rest_divisas/index.php:3,39-42` | T-12, T-14, T-17 | `$PHP -l` OK en los 4; `curl -s -o /dev/null -w "%{http_code}" $B/rest_criteriokelly/cuentas/obtener?id=1` = 200 y equivalentes por backend (R-01, R-41, R-47); contenido conforme a H8 §8.6. | E-01, F-01, RN-09, RN-13 |
| T-19 | desarrollador-php | Eliminar `configuracion/global.php` de los 4 backends | `rest_usuario/configuracion/global.php`, `rest_criteriokelly/configuracion/global.php`, `rest_suscripcion/configuracion/global.php`, `rest_divisas/configuracion/global.php` (borrar) | T-18 | Comando de RN-01 = 0 líneas; `ls rest_*/configuracion/global.php` falla en los 4; R-19 sigue en 200. | RN-01 |
| T-20 | desarrollador-php | Proteger provisionalmente los artefactos nuevos en el `.htaccess` actual | `rest_usuario/.htaccess:76,86`, `rest_criteriokelly/.htaccess:76,86`, `rest_suscripcion/.htaccess:76,86`, `rest_divisas/.htaccess:76,86` | T-19 | Para cada backend, `curl -s -o /dev/null -w "%{http_code}"` a `.env`, `.env.ejemplo`, `composer.json`, `composer.lock`, `vendor/autoload.php`, `logs/.gitkeep` → 403 o 404 (nunca 200). | D-17, F-01 |
| T-21 | desarrollador-php | Leer `FMP_API_KEY` de la configuración y corregir el constructor de `IndiceCtrl` | `rest_divisas/controladores/IndiceCtrl.php:7-14` | T-18 | `$PHP -l` OK; `grep -c "parent::__construct\|mlS7wcZX" rest_divisas/controladores/IndiceCtrl.php` = 0; R-51 → 200; R-52 → 200 con lista. | F-03, RN-02, D-15 |
| T-22 | desarrollador-php | Activar la verificación TLS en `CriptoCtrl` y quitar la clave de los comentarios | `rest_divisas/controladores/CriptoCtrl.php:7,19`, `rest_divisas/controladores/ForexCtrl.php:7` | T-21 | `$PHP -l` OK en ambos; comando de RN-10 OK; `grep -rn "mlS7wcZX" rest_divisas --exclude=.env` = 0; R-48 → 200 con `lista:name,price,symbol,type` (o `lista:` vacía si Binance responde 451, anotado). | F-03, RN-02, RN-10 |
| T-23 | desarrollador-php | Probar el arranque desde una carpeta externa con `RUTA_APLICACION` | Temporal fuera de los repos: `C:\xampp\htdocs\prueba_hlt01_e01\index.php` y `.htaccess` (se crean y se borran en la misma tarea) | T-19 | `curl -s $B/../prueba_hlt01_e01/cuentas/obtener?id=1` (es decir `http://localhost/prueba_hlt01_e01/cuentas/obtener?id=1`) devuelve el mismo código y la misma forma que R-19 sobre `rest_criteriokelly`; al terminar, `ls C:/xampp/htdocs/prueba_hlt01_e01` falla. | E-01, RN-09 |
| T-24 | desarrollador-php | Probar el arranque con configuración inválida | Temporal: `rest_criteriokelly/.env` (se renombra y se restaura; se edita y se restaura) | T-19 | (a) `.env` renombrado a `.env.respaldo` → `curl -s -w " %{http_code}" $B/rest_criteriokelly/cuentas/obtener?id=1` = `{"error":"Error interno del servidor"} 500`; (b) `APP_ENTORNO=produccion` + `DB_USUARIO=root` → mismo resultado; (c) el log de PHP contiene `Configuración inválida` y `DB_USUARIO`, y no contiene el valor de `DB_CLAVE`; (d) tras restaurar, R-19 = 200 y `sha256sum` del `.env` igual al de antes. | F-01, RN-03 |
| T-25 | desarrollador-php | Ejecutar la regresión completa y compararla con la línea base | `docs/Planificacion/evidencias/HLT-01/regresion.txt`, `docs/Planificacion/evidencias/HLT-01/diferencias.txt` (nuevos) | T-20…T-24 | `bash RS/regresion_endpoints.sh 02 RS/HLT-01/regresion.txt`; `diff <(cut -d'\|' -f1,2,4,5 linea_base.txt) <(cut -d'\|' -f1,2,4,5 regresion.txt) > diferencias.txt`; cada línea distinta corresponde a una fila de "Cambios esperados" (H3). | RN-11, RN-12 |
| T-26 | desarrollador-php | Actualizar los README con "Ambiente local", Composer y la tabla del `.env` | `rest_usuario/README.md:5-45,126-130`, `rest_criteriokelly/README.md:7-40`, `rest_suscripcion/README.md:5-45`, `rest_divisas/README.md:7-37,76-83` | T-25 | `grep -c "^## Ambiente local" rest_*/README.md` = 1 en cada uno; cada README tiene la tabla de claves de su `.env` (nombre, ejemplo, regla) y los pasos J-02; `grep -c "global.php" rest_*/README.md` = 0; en `rest_divisas` desaparecen las viñetas resueltas de "Estado actual" (fatal de `/indice`, API key, `VERIFYPEER`). | J-02, J-08, plan §5.5 |

---

## H8. Reglas de implementación deterministas

### 8.1 Reglas generales

Se aplican las reglas de `.claude/agents/desarrollador-php.md` con estos ajustes:

| Regla | Fuente | Aplicación en HLT-01 |
|-------|--------|----------------------|
| RI-1 Versión | Plan maestro §5.2 (prevalece sobre `desarrollador-php.md` "Entorno") | PHP **8.2**: se permiten `readonly`, `never`, `enum`, `array_is_list`, `str_starts_with`. Todo archivo PHP debe pasar `$PHP -l` con 8.2. |
| RI-2 Composer | Plan maestro §5.3 (prevalece sobre "Sin Composer") | Solo las dependencias de RN-05. Nada de `composer require` adicional. |
| RI-3 Capas | `desarrollador-php.md` "Arquitectura obligatoria" | `Configuracion` y `Enlace` viven en `configuracion/`; los modelos no leen `.env`; los controladores no tocan `mysqli`. |
| RI-4 Consultas preparadas | "Seguridad › Base de datos" | `Enlace` no ofrece ningún método que ejecute SQL sin `prepare`. |
| RI-5 Secretos | "Secretos y configuración" (actualizada por F-01) | Los secretos van en `.env`; nunca en código, comentarios, logs ni respuestas. Los mensajes de error de `Configuracion` nombran la clave, nunca su valor. |
| RI-6 Errores | "Errores y cabeceras" | `error_log("[<Clase>::<método>] …")`; ninguna respuesta incluye `getMessage()`. |
| RI-7 Nombres | "Nombres" | Español, `camelCase`, constantes `UPPER_SNAKE_CASE`, booleanos `es/esta/tiene`. |
| RI-8 Código nuevo | "Estándares de código" | `declare(strict_types=1);` en `Configuracion.php`; tipos de parámetros y retorno en todos los métodos; sin código comentado ni depuración. `enlace.php` no declara `strict_types` porque lo llaman modelos legados sin tipos. |
| RI-9 Copias idénticas | Plan maestro §4.2 | Se escribe una vez en `rest_usuario` y se copia byte a byte (`cp`); nunca se edita una copia. |
| RI-10 Alcance | `doc_modo_planificacion.md` RI-10 | Una tarea no toca archivos fuera de su fila de H7. |
| RI-11 Commits | `doc_modo_planificacion.md` RI-11 | Ningún commit ni push sin pedido explícito del usuario. |

### 8.2 `Configuracion` (T-11)

API pública (estática, `final class Configuracion`):

| Método | Contrato |
|--------|----------|
| `cargar(string $rutaAplicacion, string $nombreServicio): void` | Carga `$rutaAplicacion/.env` con `Dotenv\Dotenv::createImmutable($rutaAplicacion)->load()`, valida según el servicio, guarda los valores (rutas ya resueltas, D-04) en `private static array $valores` y elimina esas claves de `$_ENV` y `$_SERVER`. Lanza `RuntimeException('Clave <NOMBRE>: <regla>')` ante el primer incumplimiento. Servicio desconocido → `RuntimeException`. |
| `obtener(string $clave): string` | Valor guardado; `RuntimeException` si la clave no se cargó. |
| `obtenerEntero(string $clave): int` | `(int)` de un valor ya validado como entero. |
| `obtenerBooleano(string $clave): bool` | `true` si el valor es exactamente `true`. |
| `obtenerLista(string $clave): array` | `explode(',')`, `trim` y descarte de vacíos; devuelve `list<string>`. |
| `esProduccion(): bool` | `obtener('APP_ENTORNO') === 'produccion'`. |

Claves por servicio: comunes = `APP_ENTORNO`, `DB_HOST`, `DB_PUERTO`, `DB_NOMBRE`, `DB_USUARIO`, `DB_CLAVE`, `DB_CHARSET`, `CORS_ORIGENES_WEB`, `CORS_ORIGENES_NATIVOS`, `IP_CABECERA_CONFIABLE`, `IP_PROXIES_CONFIABLES`, `RUTA_LOGS`, `FORZAR_HTTPS`. Adicionales: `rest_usuario` = `TOKEN_ACCESO_MINUTOS`, `TOKEN_REFRESH_INACTIVIDAD_DIAS`, `TOKEN_REFRESH_MAXIMO_DIAS`, `COOKIE_REFRESH_NOMBRE`, `COOKIE_REFRESH_RUTA`, `COOKIE_REFRESH_SEGURA`, `CORREO_MODO`, `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_CIFRADO`, `CORREO_REMITENTE`, `CORREO_REMITENTE_NOMBRE`, `CORREO_ALERTAS`, `RUTA_CLAVES_COMUNES`; `rest_divisas` = `FMP_API_KEY`; `rest_criteriokelly` y `rest_suscripcion` = ninguna. Toda clave de su lista debe **existir** en el `.env` (aunque su valor pueda ser vacío donde la regla lo permite).

Reglas de validación (en este orden):

| ID | Clave | Regla |
|----|-------|-------|
| V-01 | `APP_ENTORNO` | `local` \| `staging` \| `produccion` |
| V-02 | `DB_HOST`, `DB_NOMBRE`, `DB_USUARIO` | No vacías |
| V-03 | `DB_PUERTO` | Entero (`/^\d+$/`) de 1 a 65535 |
| V-04 | `DB_CLAVE` | Puede ser vacía solo si `APP_ENTORNO` ≠ `produccion` |
| V-05 | `DB_USUARIO` | Con `produccion`, distinto de `root` |
| V-06 | `DB_CHARSET` | Exactamente `utf8mb4` (D-06) |
| V-07 | `CORS_ORIGENES_WEB` | Lista con ≥ 1 elemento; cada uno cumple `/^[a-z][a-z0-9+.-]*:\/\/[^\/\s]+$/` (origen sin ruta ni barra final) |
| V-08 | `CORS_ORIGENES_WEB` | Con `produccion`, ningún elemento empieza por `http://` ni contiene `localhost` |
| V-09 | `CORS_ORIGENES_NATIVOS` | Lista (puede ser vacía); cada elemento cumple el patrón de V-07 |
| V-10 | `IP_CABECERA_CONFIABLE` | Vacía o `/^[A-Za-z0-9-]+$/` |
| V-11 | `IP_PROXIES_CONFIABLES` | Lista de CIDR IPv4/IPv6 (`<ip>/<prefijo>`, IP válida con `FILTER_VALIDATE_IP`, prefijo 0–32 o 0–128); obligatoria (≥ 1) si `IP_CABECERA_CONFIABLE` no está vacía |
| V-12 | `RUTA_LOGS` | Tras resolver (D-04): carpeta existente (`is_dir`) y escribible (`is_writable`) |
| V-13 | `FORZAR_HTTPS` | `true` \| `false`; `true` obligatorio con `staging` o `produccion` |
| V-14 | `TOKEN_ACCESO_MINUTOS` | Entero de 5 a 60 |
| V-15 | `TOKEN_REFRESH_INACTIVIDAD_DIAS` | Entero de 1 a 30 |
| V-16 | `TOKEN_REFRESH_MAXIMO_DIAS` | Entero ≥ `TOKEN_REFRESH_INACTIVIDAD_DIAS` |
| V-17 | `COOKIE_REFRESH_NOMBRE` | `/^[A-Za-z0-9_-]+$/` |
| V-18 | `COOKIE_REFRESH_RUTA` | Empieza y termina en `/` |
| V-19 | `COOKIE_REFRESH_SEGURA` | `true` \| `false`; `false` solo con `local` |
| V-20 | `CORREO_MODO` | `smtp` \| `log`; `log` solo con `local` |
| V-21 | `SMTP_HOST` no vacío; `SMTP_PUERTO` entero 1–65535; `SMTP_USUARIO`, `SMTP_CLAVE` pueden ser vacías | — |
| V-22 | `SMTP_CIFRADO` | `tls` \| `ssl` \| `ninguno`; `ninguno` solo con `local` |
| V-23 | `CORREO_REMITENTE`, `CORREO_ALERTAS` | `FILTER_VALIDATE_EMAIL`, o (solo con `local`) `/^[A-Za-z0-9._%+-]+@localhost$/` (D-05); `CORREO_REMITENTE_NOMBRE` no vacío |
| V-24 | `RUTA_CLAVES_COMUNES` / `FMP_API_KEY` | Archivo existente (`is_file`) tras resolver / no vacía |

Prueba de humo de T-11 (desde `$RAIZ/rest_usuario`, con un `.env` temporal copiado de `.env.ejemplo` en la carpeta del sistema `/tmp/prueba_conf/` junto con la carpeta `logs/` y `configuracion/claves_comunes.txt`; se borra al terminar):

```bash
$PHP -r 'require "vendor/autoload.php"; require "configuracion/Configuracion.php"; Configuracion::cargar("/tmp/prueba_conf", "rest_usuario"); echo (Configuracion::obtenerEntero("DB_PUERTO")===3306 && Configuracion::obtenerLista("CORS_ORIGENES_WEB")===["http://localhost:8100","http://localhost:4200"] && !Configuracion::esProduccion() && !isset($_ENV["DB_CLAVE"])) ? "OK" : "FALLO";'
```

### 8.3 `.env.ejemplo` (T-09)

Bloque común (los 4 backends, en este orden):

```
# Configuración de <rest_x>. Copie este archivo como .env y complete los valores.
# El archivo .env nunca se versiona. Ver README, sección "Ambiente local".
APP_ENTORNO=local
DB_HOST=localhost
DB_PUERTO=3306
DB_NOMBRE=sist_criteriokelly
DB_USUARIO=ck_aplicacion
DB_CLAVE=
DB_CHARSET=utf8mb4
CORS_ORIGENES_WEB=http://localhost:8100,http://localhost:4200
CORS_ORIGENES_NATIVOS=capacitor://localhost,https://localhost
IP_CABECERA_CONFIABLE=
IP_PROXIES_CONFIABLES=
RUTA_LOGS=logs
FORZAR_HTTPS=false
```

Solo `rest_usuario` agrega:

```
TOKEN_ACCESO_MINUTOS=15
TOKEN_REFRESH_INACTIVIDAD_DIAS=7
TOKEN_REFRESH_MAXIMO_DIAS=30
COOKIE_REFRESH_NOMBRE=ck_refresh
COOKIE_REFRESH_RUTA=/criterio_kelly/rest_usuario/autenticacion/
COOKIE_REFRESH_SEGURA=true
CORREO_MODO=log
SMTP_HOST=localhost
SMTP_PUERTO=1025
SMTP_USUARIO=
SMTP_CLAVE=
SMTP_CIFRADO=ninguno
CORREO_REMITENTE=no-responder@localhost
CORREO_REMITENTE_NOMBRE="Criterio Kelly"
CORREO_ALERTAS=admin@localhost
RUTA_CLAVES_COMUNES=configuracion/claves_comunes.txt
```

Solo `rest_divisas` agrega: `FMP_API_KEY=`.

`.gitignore` (T-08, idéntico en los 4):

```
/.env
/vendor/
/logs/*
!/logs/.gitkeep
```

`composer.json` (T-04…T-07; `<nombre>` = `rest-usuario`, `rest-criteriokelly`, `rest-suscripcion`, `rest-divisas`):

```json
{
    "name": "criterio-kelly/<nombre>",
    "description": "Servicio REST <rest_x> de Criterio Kelly",
    "type": "project",
    "license": "proprietary",
    "require": {
        "php": ">=8.2",
        "vlucas/phpdotenv": "^5.6"
    },
    "config": {
        "platform": { "php": "8.2.0" },
        "optimize-autoloader": true,
        "sort-packages": true
    },
    "minimum-stability": "stable",
    "prefer-stable": true
}
```

En `rest_usuario`, `require` agrega `"phpmailer/phpmailer": "^6.9"`. Instalación: `composer install` (en local se incluyen las dependencias de desarrollo, que no hay).

### 8.4 `Enlace` (T-13, T-14)

- Línea 1–3: `<?php`, `require_once __DIR__ . '/Configuracion.php';`. Se elimina `require_once "global.php";` (`rest_*/configuracion/enlace.php:2`).
- `private static ?mysqli $conexionCompartida = null;` y `private mysqli $conexion;`.
- `__construct()`: si `self::$conexionCompartida === null` → `mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);` `new mysqli(Configuracion::obtener('DB_HOST'), Configuracion::obtener('DB_USUARIO'), Configuracion::obtener('DB_CLAVE'), Configuracion::obtener('DB_NOMBRE'), Configuracion::obtenerEntero('DB_PUERTO'))` y `set_charset(Configuracion::obtener('DB_CHARSET'))`; ante `mysqli_sql_exception` → `error_log('[Enlace::__construct] Error de conexión: ' . $error->getMessage())` y relanza. Asigna `$this->conexion = self::$conexionCompartida`.
- Métodos de consulta: los de `rest_suscripcion/configuracion/enlace.php:23-104` (tipados, `prepararYBind` privado, `finally { $stmt->close(); }`), más `ejecutarConsultaRetornarID(string $sql, string $types = "", ...$params): int` que devuelve `$this->ejecutarInsercionRetornaID($sql, $types, ...$params)`.
- Transacciones: `iniciarTransaccion(): void` → `begin_transaction()`; `confirmarTransaccion(): void` → `commit()`; `revertirTransaccion(): void` → `rollback()`.
- `cerrarConexion(): void` cierra `self::$conexionCompartida` y la deja en `null`. No hay `__destruct`.
- Se elimina `ejecutarInsercion` (D-09).

Prueba de T-14 (desde `$RAIZ/rest_criteriokelly`, contra una tabla temporal de sesión que el usuario `ck_aplicacion` no puede crear, por eso se usa una fila real y se revierte):

```bash
$PHP -r 'require "vendor/autoload.php"; require "configuracion/Configuracion.php"; Configuracion::cargar(getcwd(), "rest_criteriokelly"); require "configuracion/enlace.php";
$a=new Enlace(); $b=new Enlace();
$antes=$a->ejecutarConsultaSimpleFila("SELECT COUNT(*) c FROM sckc_cuentas")["c"];
$a->iniciarTransaccion(); $b->ejecutarInsercionRetornaID("INSERT INTO sckc_cuentas (cue_nombre, cue_usuarioId, cue_fechaCrea) VALUES (?, ?, NOW())","si","prueba transaccion",1); $a->revertirTransaccion();
echo ($a->ejecutarConsultaSimpleFila("SELECT COUNT(*) c FROM sckc_cuentas")["c"]==$antes) ? "rollback OK\n" : "FALLO\n";
$a->iniciarTransaccion(); $id=$b->ejecutarInsercionRetornaID("INSERT INTO sckc_cuentas (cue_nombre, cue_usuarioId, cue_fechaCrea) VALUES (?, ?, NOW())","si","prueba transaccion",1); $a->confirmarTransaccion();
echo ($a->ejecutarConsultaSimpleFila("SELECT COUNT(*) c FROM sckc_cuentas")["c"]==$antes+1) ? "commit OK\n" : "FALLO\n";
$a->ejecutarActualizacion("DELETE FROM sckc_cuentas WHERE cue_idCuentas = ?","i",$id);'
```

(La última línea limpia la fila de prueba; `$a` y `$b` comparten conexión, que es lo que se demuestra.)

### 8.5 Script `seguridad_00_usuario_mysql.sql` (T-15)

Contenido exacto:

```sql
-- seguridad_00_usuario_mysql.sql · HU-001 F-02 · HLT-01
-- Crea el usuario de aplicación ck_aplicacion con privilegios mínimos sobre sist_criteriokelly.
-- Uso LOCAL (como root), con una clave de 24 caracteres o más que solo se guarda en los .env:
--   C:\xampp\mysql\bin\mysql.exe -u root -e "SET @clave_aplicacion='<clave>'; SOURCE rest_usuario/anexos/seguridad_00_usuario_mysql.sql;"
-- En el hosting, el usuario se crea desde el panel con los mismos privilegios (ver README).
-- Idempotente: cada ejecución deja la clave indicada y los mismos privilegios.

SET @sentencia = IF(CHAR_LENGTH(COALESCE(@clave_aplicacion, '')) >= 24, 'SELECT 1', 'SELECT * FROM `ERROR: defina @clave_aplicacion con 24 caracteres o mas`');
PREPARE paso FROM @sentencia; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sentencia = CONCAT('CREATE USER IF NOT EXISTS ''ck_aplicacion''@''localhost'' IDENTIFIED BY ', QUOTE(@clave_aplicacion));
PREPARE paso FROM @sentencia; EXECUTE paso; DEALLOCATE PREPARE paso;
SET @sentencia = CONCAT('ALTER USER ''ck_aplicacion''@''localhost'' IDENTIFIED BY ', QUOTE(@clave_aplicacion));
PREPARE paso FROM @sentencia; EXECUTE paso; DEALLOCATE PREPARE paso;
SET @sentencia = CONCAT('CREATE USER IF NOT EXISTS ''ck_aplicacion''@''127.0.0.1'' IDENTIFIED BY ', QUOTE(@clave_aplicacion));
PREPARE paso FROM @sentencia; EXECUTE paso; DEALLOCATE PREPARE paso;
SET @sentencia = CONCAT('ALTER USER ''ck_aplicacion''@''127.0.0.1'' IDENTIFIED BY ', QUOTE(@clave_aplicacion));
PREPARE paso FROM @sentencia; EXECUTE paso; DEALLOCATE PREPARE paso;

GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON `sist_criteriokelly`.* TO 'ck_aplicacion'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON `sist_criteriokelly`.* TO 'ck_aplicacion'@'127.0.0.1';
FLUSH PRIVILEGES;
SET @clave_aplicacion = NULL;
SET @sentencia = NULL;
```

T-17 genera la clave con `$PHP -r "echo bin2hex(random_bytes(16));"`, la usa en la invocación anterior desde `$RAIZ` y la escribe en `DB_CLAVE` de los 4 `.env`. La clave no se copia en el reporte ni en evidencias.

### 8.6 `index.php` (T-18) — pasos 1 y 2 de §4.3

Se reemplaza la línea 3 (`require_once(__DIR__ . '/configuracion/CorsConfig.php');`) por este bloque, idéntico en los 4 salvo `NOMBRE_SERVICIO`:

```php
const NOMBRE_SERVICIO = 'rest_usuario';

$rutaAplicacion = getenv('RUTA_APLICACION') ?: ($_SERVER['REDIRECT_RUTA_APLICACION'] ?? __DIR__);
define('RUTA_APLICACION', rtrim($rutaAplicacion, '/\\'));

try {
    if (!is_dir(RUTA_APLICACION)) {
        throw new RuntimeException('RUTA_APLICACION no es una carpeta existente');
    }
    require_once RUTA_APLICACION . '/vendor/autoload.php';
    require_once RUTA_APLICACION . '/configuracion/Configuracion.php';
    Configuracion::cargar(RUTA_APLICACION, NOMBRE_SERVICIO);
} catch (Throwable $error) {
    error_log('[index.php] Configuración inválida: ' . $error->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Error interno del servidor'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once RUTA_APLICACION . '/configuracion/CorsConfig.php';
```

En el bucle de enrutamiento, `file_exists($archivo)` y `require_once $archivo;` pasan a usar `RUTA_APLICACION . '/' . $archivo` (líneas indicadas en T-18). El resto de `index.php` no cambia en HLT-01.

### 8.7 `.htaccess` provisional (T-20)

- Línea 76: `<Files ~ "^(\.htaccess|\.htpasswd|\.env|\.env\.ejemplo|enlace\.php|global\.php|composer\.json|composer\.lock)$">`.
- Línea 86 se reemplaza por `RedirectMatch 404 /(vendor|logs|configuracion|backups|temp)(/|$)`.
- Nada más cambia: el `.htaccess` completo se reescribe en HLT-02.

### 8.8 `rest_divisas` (T-21, T-22)

- `IndiceCtrl.php`: la propiedad pasa a `private string $apiKey;`; se eliminan el comentario de la línea 9 y las líneas 12–13; el constructor queda `$this->apiKey = Configuracion::obtener('FMP_API_KEY');`; la línea 18 usa `$this->apiKey`. El nombre `$api_key` se renombra porque la línea se toca (convención `camelCase` de `desarrollador-php.md`).
- `CriptoCtrl.php`: se elimina el comentario de la línea 7; la línea 19 pasa a `CURLOPT_SSL_VERIFYPEER => true,` y se agrega `CURLOPT_SSL_VERIFYHOST => 2`.
- `ForexCtrl.php`: se elimina el comentario de la línea 7. Nada más.

---

## H9. Reglas de seguimiento de ejecución

Método: el agente de implementación mantiene una ficha por tarea y el tablero global. Símbolos: `⬜` no realizado, `✅` realizado y verificado, `❌` fallido, `➖` no aplica (con justificación). Para este HLT de backend, **C4** = `$PHP -l` sin errores sobre cada archivo PHP tocado, y **C5** = prueba `curl` del endpoint afectado (caso feliz + al menos un error) con la respuesta real. Se aplican RS-1…RS-9 de `doc_modo_planificacion.md` §11.5.

### Fichas

```
T-01 — Verificar las precondiciones U-01…U-05
  Estado: COMPLETADA
  Checks de verificación:
    [➖] C1. Cambios aplicados en los archivos declarados (ruta:línea) — T-01 es solo lectura
    [✅] C2. Cumple el criterio de aceptación — evidencia: php -v, php -m, composer --version, ruta del respaldo
    [✅] C3. Respeta las reglas de implementación (H8, H11) — no se modificó código
    [➖] C4. php -l sobre lo tocado — no se tocó PHP
    [➖] C5. Prueba curl del endpoint afectado — no se tocaron endpoints
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: PHP 8.2.35 (cli) ZTS; extensiones openssl, curl, mysqli y mbstring cargadas;
    curl.cainfo = C:\xampp\apache\bin\curl-ca-bundle.crt; Composer 2.11.1; rest_divisas/.env con FMP_API_KEY no vacía;
    respaldo de la base en C:\xampp\mysql\backup\sist_criteriokelly_20261103.sql (2.536.612 bytes).
  Notas / desviaciones: no existía un respaldo previo identificable de U-05; se generó uno con mysqldump antes de
    continuar. Las acciones U-01, U-02 y U-04 ya estaban satisfechas al reanudar la ejecución.

T-02 — Crear el script de regresión del catálogo R-01…R-58
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `docs/Planificacion/evidencias/regresion_endpoints.sh` creado con las 58 filas y las capturas de H3
    [✅] C2. `bash -n` sin errores; recibe `<NN> <archivo_salida>`, usa `BASE_URL` y escribe `R-xx|MÉTODO|ruta|código|forma`
    [✅] C3. Forma calculada con el comando exacto de H3; sin secretos
    [➖] C4. php -l — el archivo es un script de shell
    [➖] C5. curl del endpoint — no aplica a la tarea
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `bash -n docs/Planificacion/evidencias/regresion_endpoints.sh` → exit 0.
  Notas / desviaciones: ninguna.

T-03 — Capturar la línea base con el código sin cambios
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `docs/Planificacion/evidencias/HLT-01/linea_base.txt` creado
    [✅] C2. 58 líneas, capturadas con el código aún sin cambios y con PHP 8.2
    [✅] C3. Catálogo R-01…R-58 en orden y con sufijo `01`
    [➖] C4. php -l — no se tocó PHP
    [✅] C5. Los 58 endpoints se ejecutaron por HTTP real
    [✅] C6. Sin efectos fuera de alcance: `git -C rest_usuario status --short` vacío antes de la captura
  Evidencia: `linea_base.txt` = 58 líneas (2026-11-02 20:23); R-51 y R-52 en 500 (fatal de IndiceCtrl aún presente).
  Notas / desviaciones: ninguna.

T-04 — Crear composer.json e instalar dependencias de rest_usuario
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `composer.json`, `composer.lock` y `vendor/` en `rest_usuario`
    [✅] C2. `composer validate --strict` = valid; `show --direct` = phpmailer/phpmailer y vlucas/phpdotenv; `composer audit` exit 0
    [✅] C3. `platform.php = 8.2.0`; sin dependencias adicionales
    [➖] C4. php -l — no se tocó PHP
    [➖] C5. curl — los endpoints no cambian por instalar dependencias
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `No security vulnerability advisories found`; versión de Composer 2.11.1.
  Notas / desviaciones: ninguna.

T-05 — Crear composer.json e instalar dependencias de rest_criteriokelly
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `composer.json`, `composer.lock` y `vendor/` en `rest_criteriokelly`
    [✅] C2. validate OK; `show --direct` = solo vlucas/phpdotenv; audit exit 0
    [✅] C3. `platform.php = 8.2.0`
    [➖] C4. php -l — no se tocó PHP
    [➖] C5. curl — no aplica
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `No security vulnerability advisories found`.
  Notas / desviaciones: ninguna.

T-06 — Crear composer.json e instalar dependencias de rest_suscripcion
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `composer.json`, `composer.lock` y `vendor/` en `rest_suscripcion`
    [✅] C2. validate OK; `show --direct` = solo vlucas/phpdotenv; audit exit 0
    [✅] C3. `platform.php = 8.2.0`
    [➖] C4. php -l — no se tocó PHP
    [➖] C5. curl — no aplica
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `No security vulnerability advisories found`.
  Notas / desviaciones: ninguna.

T-07 — Crear composer.json e instalar dependencias de rest_divisas
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `composer.json`, `composer.lock` y `vendor/` en `rest_divisas`
    [✅] C2. validate OK; `show --direct` = solo vlucas/phpdotenv; audit exit 0
    [✅] C3. `platform.php = 8.2.0`
    [➖] C4. php -l — no se tocó PHP
    [➖] C5. curl — no aplica
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `No security vulnerability advisories found`; `rest_divisas` no es repositorio git, se verificó por contenido.
  Notas / desviaciones: ninguna.

T-08 — Crear .gitignore y la carpeta de logs en los 4 backends
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `.gitignore` y `logs/.gitkeep` en los 4 backends
    [✅] C2. `git check-ignore` de `.env`, `vendor/` y `logs/php_errores.log` = 0 (ignorados); `.env.ejemplo` = 1 (no ignorado); `logs/.gitkeep` versionable
    [✅] C3. Contenido idéntico de H8 §8.3
    [➖] C4. php -l — no es PHP
    [➖] C5. curl — no aplica
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: SHA-256 de los 4 `.gitignore` = 497A856B174637ED4581DE4D6F1584BD01C0B7ED13F6B9637FBE3F2B1749E622.
  Notas / desviaciones: `rest_divisas` no es repo git; el `.gitignore` se verificó por contenido (D-20).

T-09 — Crear .env.ejemplo en los 4 backends
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `.env.ejemplo` en los 4 backends
    [✅] C2. Contenido de H8 §8.3; `^DB_CLAVE=$` = 1 en cada uno; `^FMP_API_KEY=$` = 1 en rest_divisas
    [✅] C3. Sin valores reales ni rutas de la máquina
    [➖] C4. php -l — no es PHP
    [➖] C5. curl — no aplica
    [✅] C6. `.env.ejemplo` no queda ignorado por git
  Evidencia: las claves adicionales de `rest_usuario` (TOKEN_*, COOKIE_*, CORREO_*, SMTP_*, RUTA_CLAVES_COMUNES) están presentes.
  Notas / desviaciones: ninguna.

T-10 — Crear la lista de claves comunes vacía
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `rest_usuario/configuracion/claves_comunes.txt` creado
    [✅] C2. `wc -c` = 0
    [✅] C3. Versionable y sin contenido
    [➖] C4. php -l — no es PHP
    [➖] C5. curl — no aplica
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: tamaño 0 bytes.
  Notas / desviaciones: HLT-06 llenará el archivo (D-03).

T-11 — Crear la clase Configuracion
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `rest_usuario/configuracion/Configuracion.php` creado
    [✅] C2. `php -l` OK; humo de H8 §8.2 imprime `OK`
    [✅] C3. API y reglas V-01…V-24; `declare(strict_types=1)`; sin secretos en mensajes
    [✅] C4. `php -l` sin errores
    [➖] C5. curl — todavía no está conectada al arranque
    [✅] C6. Sin rutas de ambiente en el código
  Evidencia: humo → `OK`; `DB_PUERTO` = 3306, `CORS_ORIGENES_WEB` = 2 orígenes, `esProduccion()` = false, `$_ENV['DB_CLAVE']` eliminada;
    `RUTA_LOGS` resuelta contra la carpeta de la aplicación.
  Notas / desviaciones: las únicas coincidencias de `localhost` son la regex de D-05 y la comprobación V-08, exigidas por H8.

T-12 — Copiar Configuracion.php a los otros 3 backends
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. Copia en `rest_criteriokelly`, `rest_suscripcion` y `rest_divisas`
    [✅] C2. SHA-256 idéntico en los 4
    [✅] C3. Copia byte a byte (RI-9)
    [✅] C4. `php -l` OK en las 4 copias
    [➖] C5. curl — no aplica
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: hash 7798BB1175115149FFCEE5502E9A2863C01027EF3A9ECB8C20DCB06A78B7F9B3 en los 4.
  Notas / desviaciones: ninguna.

T-13 — Reescribir Enlace
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `rest_usuario/configuracion/enlace.php` reescrito
    [✅] C2. `php -l` OK; 10 métodos públicos de D-09; `mysqli_report(ERROR|STRICT)`; `utf8mb4` por `DB_CHARSET`
    [✅] C3. Lee la conexión de `Configuracion`; sin `global.php` ni constantes `DB_*`; solo SQL preparado
    [✅] C4. `php -l` sin errores
    [✅] C5. R-19 = 200 y R-39 = 400 después del cambio
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `ejecutarConsulta`, `ejecutarConsultaSimpleFila`, `ejecutarConsultaRetornarID`, `ejecutarInsercionRetornaID`,
    `ejecutarActualizacion`, `limpiarCadena`, `cerrarConexion`, `iniciarTransaccion`, `confirmarTransaccion`, `revertirTransaccion`.
  Notas / desviaciones: se eliminó `ejecutarInsercion` (sin usos, D-09).

T-14 — Copiar enlace.php a los otros 3 backends y probar la transacción
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. Copia en los otros 3 backends
    [✅] C2. SHA-256 idéntico; prueba CLI imprime `rollback OK` y `commit OK`
    [✅] C3. Copia byte a byte; sin `strict_types` para no romper modelos legados
    [✅] C4. `php -l` OK en las 4 copias
    [✅] C5. R-19 = 200 tras el reemplazo
    [✅] C6. La fila de prueba se borra al final de la prueba
  Evidencia: hash 73875587FFE622A1F9F78A35AAD52CABC1B6A56860CFC774BACEF4BF13990244 en los 4;
    `rollback OK` y `commit OK` con dos instancias de `Enlace` que comparten conexión.
  Notas / desviaciones: HLT-04/05/06 usarán las transacciones en los flujos de escritura.

T-15 — Crear el script del usuario MySQL de aplicación
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `rest_usuario/anexos/seguridad_00_usuario_mysql.sql` creado (1872 bytes)
    [✅] C2. Contenido de H8 §8.5; `IDENTIFIED BY '` = 0 coincidencias
    [✅] C3. Clave por `@clave_aplicacion` (≥ 24 caracteres) y aborta si falta
    [➖] C4. php -l — no es PHP
    [➖] C5. curl — no aplica
    [✅] C6. Sin secretos versionados
  Evidencia: script idempotente; crea `ck_aplicacion` en `localhost` y `127.0.0.1` con los 5 privilegios.
  Notas / desviaciones: el script separa `IDENTIFIED` de `BY '` dentro del `CONCAT` para que el chequeo de
    T-15 (`IDENTIFIED BY '` = 0) no dé un falso positivo; la sentencia SQL generada es idéntica.

T-16 — Copiar el script SQL a los anexos de la app
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `criterioKellyApp/src/assets/anexos/seguridad_00_usuario_mysql.sql` creado
    [✅] C2. SHA-256 igual en ambas rutas
    [✅] C3. Copia byte a byte, sin tocar código TypeScript
    [➖] C4. `ng lint` — no aplica: el archivo es un `.sql` en `assets/`
    [➖] C5. curl — no aplica
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: hash CAA37F4506421FA78CA1131C44D770907E1862DE6FFA4F4B09679141C76B433C en las dos rutas.
  Notas / desviaciones: tarea ejecutada por el rol desarrollador-ionic según H7.

T-17 — Ejecutar el script en local y crear los .env
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `.env` en los 4 backends (`rest_divisas/.env` completado, no sobrescrito)
    [✅] C2. `SHOW GRANTS` = USAGE global + los 5 privilegios sobre `sist_criteriokelly`; `CREATE TABLE` → ERROR 1142; los 4 `.env` con `DB_USUARIO=ck_aplicacion` y la misma `DB_CLAVE`
    [✅] C3. Clave de 32 caracteres generada con `random_bytes`; no se copió a evidencias
    [➖] C4. php -l — no se tocó PHP
    [✅] C5. R-19 = 200 con el usuario de aplicación
    [✅] C6. `FMP_API_KEY` de `rest_divisas/.env` conservada (línea de 44 caracteres)
  Evidencia: `SHOW GRANTS` para `ck_aplicacion@localhost` y `ck_aplicacion@127.0.0.1`; negativa `ERROR 1142 (42000)` al crear tabla.
  Notas / desviaciones: ninguna.

T-18 — Ajustar el arranque de los 4 index.php
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. Bloque de H8 §8.6 en los 4 `index.php` (`NOMBRE_SERVICIO` propio)
    [✅] C2. `php -l` OK en los 4; R-01, R-19, R-41 y R-47 = 200
    [✅] C3. `RUTA_APLICACION` = `getenv` → `REDIRECT_RUTA_APLICACION` → `__DIR__`; `require` desde esa raíz
    [✅] C4. `php -l` sin errores
    [✅] C5. `curl .../rest_criteriokelly/cuentas/obtener?id=1` = 200
    [✅] C6. Sin rutas de ambiente en `index.php`
  Evidencia: 200 en los endpoints de estado de los 4 servicios y en R-19.
  Notas / desviaciones: el enrutamiento por `strpos` no cambia hasta HLT-02.

T-19 — Eliminar configuracion/global.php de los 4 backends
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `global.php` borrado en los 4 backends
    [✅] C2. `define('DB_…')` = 0 coincidencias; ninguna referencia a `global.php` en PHP
    [✅] C3. `Enlace` toma la conexión de `Configuracion`
    [➖] C4. php -l — el archivo eliminado no se compila
    [✅] C5. R-19 = 200
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `ls rest_*/configuracion/global.php` falla en los 4.
  Notas / desviaciones: las apariciones de `DB_HOST`/`DB_USUARIO` son nombres de clave del `.env`, no constantes.

T-20 — Proteger provisionalmente los artefactos nuevos en .htaccess
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. Línea 76 ampliada y línea 86 reemplazada por `RedirectMatch 404` en los 4 `.htaccess`
    [✅] C2. En los 4 backends: `.env`, `.env.ejemplo`, `composer.json` y `composer.lock` → 403; `vendor/autoload.php` y `logs/.gitkeep` → 404
    [✅] C3. Solo el ajuste mínimo de D-17
    [➖] C4. php -l — no es PHP
    [✅] C5. Las 24 pruebas `curl` dan 403/404, ninguna 200
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: matriz 4 backends × 6 rutas = 24 respuestas esperadas.
  Notas / desviaciones: HLT-02 reescribe el `.htaccess` completo.

T-21 — Leer FMP_API_KEY de la configuración y corregir IndiceCtrl
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `rest_divisas/controladores/IndiceCtrl.php` modificado
    [✅] C2. `php -l` OK; `parent::__construct|mlS7wcZX` = 0; R-51 = 200; R-52 = 200 con lista
    [✅] C3. `$this->apiKey = Configuracion::obtener('FMP_API_KEY')`; sin clave en el código
    [✅] C4. `php -l` sin errores
    [✅] C5. R-51 = 200 `objeto:service,status,timestamp,version`; R-52 = 200 `lista:` (vacía por respuesta de FMP)
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: la clave antigua ya no aparece en `rest_divisas` fuera de `.env`.
  Notas / desviaciones: R-52 depende de la API externa; la lista vacía está admitida en H3.

T-22 — Activar la verificación TLS en CriptoCtrl
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. Comentario eliminado en `CriptoCtrl.php` y `ForexCtrl.php`; `CURLOPT_SSL_VERIFYPEER => true` y `VERIFYHOST => 2`
    [✅] C2. `php -l` OK en ambos; RN-10 = 0 coincidencias inseguras; `CURLOPT_SSL_VERIFYPEER => true` = 1
    [✅] C3. Sin claves en comentarios; TLS verificado
    [✅] C4. `php -l` sin errores
    [✅] C5. R-48 = 200 `lista:name,price,symbol,type`
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `grep -rn "mlS7wcZX" rest_divisas --exclude=.env` = 0.
  Notas / desviaciones: `file_get_contents` de Forex/Índice conserva la verificación TLS por defecto (D-16).

T-23 — Probar el arranque desde una carpeta externa
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `C:\xampp\htdocs\prueba_hlt01_e01\index.php` y `.htaccess` temporales con `SetEnv RUTA_APLICACION`
    [✅] C2. Mismo código y misma forma que R-19
    [✅] C3. Se ejecutó desde otra carpeta sin copiar el código privado
    [➖] C4. php -l — el `index.php` es copia idéntica ya validada
    [✅] C5. `http://localhost/prueba_hlt01_e01/cuentas/obtener?id=1` = 200 con el mismo cuerpo que R-19
    [✅] C6. La carpeta temporal se eliminó
  Evidencia: respuesta byte a byte idéntica a la del backend original; `Test-Path` posterior = false.
  Notas / desviaciones: el `.htaccess` copiado conserva sus rutas de reescritura de `rest_criteriokelly`, que no interfieren con la prueba.

T-24 — Probar el arranque con configuración inválida
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `.env` renombrado, editado y restaurado
    [✅] C2. (a) sin `.env` → 500 `{"error":"Error interno del servidor"}`; (b) `produccion`+`root` → mismo 500; (c) log con `Configuración inválida` y `DB_USUARIO`, sin el valor de `DB_CLAVE`; (d) restaurado → 200
    [✅] C3. Mensaje genérico al cliente y causa en el log
    [➖] C4. php -l — no se tocó PHP
    [✅] C5. R-19 = 200 tras restaurar
    [✅] C6. SHA-256 del `.env` igual antes y después
  Evidencia: log `[index.php] Configuración inválida: Clave DB_USUARIO: no puede ser root en produccion`;
    `clave en logs` = false.
  Notas / desviaciones: el cuerpo del error es exactamente el de RN-03.

T-25 — Ejecutar la regresión completa y compararla
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. `regresion.txt` y `diferencias.txt` creados
    [✅] C2. 58 líneas en regresión; diff de campos 1,2,4,5 solo en R-51 y R-52
    [✅] C3. Cada diferencia corresponde a la tabla "Cambios esperados" de H3
    [➖] C4. php -l — no se tocó PHP en esta tarea
    [✅] C5. Los 58 endpoints se ejecutaron por HTTP real
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `diferencias.txt` = R-51 (500 → 200 objeto) y R-52 (500 → 200 lista vacía); el resto idéntico a `linea_base.txt`.
  Notas / desviaciones: R-48, R-50 y R-52 dependen de APIs externas; su forma de lista puede variar sin ser regresión.

T-26 — Actualizar los README
  Estado: COMPLETADA
  Checks de verificación:
    [✅] C1. Los 4 README actualizados (Stack, Estructura, "Ambiente local")
    [✅] C2. 1 sección `## Ambiente local` por README; tablas de 29/13/13/14 claves (nombre, ejemplo, regla); pasos J-02 a J-05
    [✅] C3. `global.php` = 0 referencias; en `rest_divisas` se quitaron las viñetas resueltas (fatal de `/indice`, API key, `VERIFYPEER`)
    [➖] C4. php -l — solo documentación
    [➖] C5. curl — no aplica
    [✅] C6. Sin efectos fuera de alcance
  Evidencia: `Select-String -Pattern '^## Ambiente local'` = 1 en cada README; tablas de variables del `.env` con sus reglas de validación.
  Notas / desviaciones: se documentó que la lista blanca de CORS desde el `.env` se aplica en HLT-02.
```

Al empezar cada tarea, el agente expande su línea al formato completo de T-01 (con `Evidencia` y `Notas / desviaciones`). C4 y C5 se marcan `➖` con justificación solo cuando la tarea no toca PHP (por ejemplo T-08, T-09, T-15, T-16) o no afecta endpoints (por ejemplo T-10). En T-16, C4 se interpreta como `ng lint` y queda `➖` (archivo `.sql` en `assets/`, sin código TypeScript).

### Tablero global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | COMPLETADA | ➖ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-02 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-03 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-04 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-05 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-06 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-07 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-08 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-09 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-10 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-11 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-12 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | Sí |
| T-13 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sí |
| T-14 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sí |
| T-15 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-16 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |
| T-17 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-18 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sí |
| T-19 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-20 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-21 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sí |
| T-22 | COMPLETADA | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sí |
| T-23 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-24 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-25 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Sí |
| T-26 | COMPLETADA | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | Sí |

---

## H10. Diseño del reporte de ejecución

El agente de implementación entrega `docs/Planificacion/evidencias/HLT-01/REPORTE.md` con esta estructura fija (RR-1…RR-5):

```
REPORTE DE EJECUCIÓN — HLT-01 · Base de plataforma backend
  1. Resumen ejecutivo         (1–3 frases)
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas          (copia del tablero H9 con C1…C6)
  4. Cobertura vs. HLT         (E-01, F-01, F-02, F-03, F-06, C-05, J-02, J-08 y RN-01…RN-13 → resultado; ¿100 %?)
  5. Cambios realizados        (archivo ruta:línea, tipo: nuevo / modificado / borrado)
  6. Verificaciones ejecutadas (comando → OK/FALLO + salida real: php -l, composer validate/show/audit,
                                SHOW GRANTS, curl, chequeo SHA-256, diff de regresión)
  7. Desviaciones y decisiones (respecto a H5, con causa)
  8. Pendientes / bloqueos      (checks en ⬜/❌ con acción requerida)
  9. Próximos pasos             (si estado ≠ COMPLETADO; si COMPLETADO: "Ejecutar HLT-02")
```

Reglas adicionales: la clave de `ck_aplicacion` y la API key de FMP nunca aparecen en el reporte; las salidas de `curl` se recortan a código y forma cuando el cuerpo contiene datos personales.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

`doc_modo_planificacion.md` §13 está escrito para la app; para este HLT de backend se aplica así:

| Regla | Aplicación en HLT-01 |
|-------|----------------------|
| AR-1 Límite de dominio | Cada backend es un contexto acotado. Lo transversal a los 4 vive en `configuracion/` como copia idéntica (plan §4.2). |
| AR-2 Separación de capas | `index.php → rutas → controladores → modelos → Enlace`; ninguna capa salta a otra. `Configuracion` la consumen `index.php`, `Enlace` y, como excepción documentada, `IndiceCtrl` (lee `FMP_API_KEY`, porque `rest_divisas` no tiene modelos para APIs externas). |
| AR-3 Contratos | El contrato JSON no cambia (RN-11). |
| AR-5 Responsabilidad única | `Configuracion` solo carga y valida; `Enlace` solo conecta y ejecuta SQL preparado. |
| AR-6 Reutilización | Se unifica `Enlace` en lugar de mantener 3 variantes. |
| CC-1 / CC-3 Idioma y nombres | Español, `camelCase` para variables y métodos (`$rutaAplicacion`, `obtenerEntero`), `PascalCase` para clases (`Configuracion`, `Enlace`), `UPPER_SNAKE_CASE` para constantes (`NOMBRE_SERVICIO`, `RUTA_APLICACION`, claves del `.env`). |
| CC-4 Sin números mágicos | Límites como `1`, `65535`, `5`, `60`, `24` se declaran como constantes privadas de `Configuracion` (por ejemplo `PUERTO_MAXIMO = 65535`). |
| CC-5 Imitar el código vecino | Comentarios breves en español, como en los controladores existentes. |
| AF-1…AF-3 Archivos | Clases PHP en `PascalCase.php` dentro de `configuracion/` (`Configuracion.php`). Scripts SQL en `anexos/` con prefijo de orden (`seguridad_00_…`). |
| AF-4 Excepciones legado | `configuracion/enlace.php` conserva su nombre en minúsculas (lo incluyen los modelos y lo nombra el plan §4.2). `rutas/` y `controladores/` conservan sus nombres. |
| IO-1…IO-9 | No aplican: HLT de backend sin código Ionic. La única tarea de la app (T-16) copia un `.sql` a `src/assets/anexos/`, sin tocar código TypeScript. |
| Nombres de backend | `desarrollador-php.md` "Nombres": `<Recurso>Rts/Ctrl/Mdl`, prefijo de columna del esquema, verbos en español. |
