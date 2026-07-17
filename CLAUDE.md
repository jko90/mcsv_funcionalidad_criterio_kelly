# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este repositorio

Backend de la plataforma **Criterio Kelly** (CRIP-Tecnología): cuatro microservicios REST en **PHP
nativo, sin framework y sin Composer**. Cada carpeta `rest_*` es un servicio autónomo, desplegable
por separado, con su propia base de datos (o proveedores externos) y su propio repositorio Git
(`rest_criteriokelly`, `rest_suscripcion` y `rest_usuario` son repos Git independientes;
`rest_divisas` no está versionado). No existe raíz Git ni tooling compartido — trabaja siempre dentro
del servicio afectado.

| Servicio | Dominio | Persistencia |
|----------|---------|--------------|
| `rest_usuario` | Usuarios, personas, roles, autenticación (contraseñas con `password_hash`/BCRYPT) | MySQL |
| `rest_suscripcion` | Suscripciones, planes, pagos | MySQL |
| `rest_criteriokelly` | Cuentas/capital, bitácora, comentarios, cálculo del Criterio de Kelly | MySQL (+ procedimientos almacenados) |
| `rest_divisas` | Catálogo de activos (cripto/forex/índices) | **Sin BD**: cURL a APIs externas (Binance, Frankfurter, Financial Modeling Prep) |

## Ejecutar y probar

**Estado actual:** el proyecto **no** trae `composer.json`, gestor de paquetes ni suite de pruebas.
"Ejecutar" = servir la carpeta con Apache; la comprobación rápida se hace con peticiones HTTP reales.

- **Desplegar/ejecutar:** colocar la carpeta del servicio dentro del `DocumentRoot` de Apache
  (p. ej. `htdocs/rest_criteriokelly/`). Queda disponible en `http://localhost/rest_criteriokelly/`.
- **Health check** (verifica que un servicio responde) — GET al prefijo de ruta **sin acción**:
  ```bash
  curl http://localhost/rest_criteriokelly/cuentas
  # {"status":"ok","version":"1.0.0","service":"CuentasRTs", ...}
  ```
- **Smoke test manual de un endpoint** con curl (recuerda enviar el token, ver más abajo):
  ```bash
  curl -X POST http://localhost/rest_criteriokelly/cuentas/nueva \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <jwt>" \
    -d '{"cue_nombre":"X","cue_usuarioId":1,"fecha_valor":"2026-01-01","valor_cuenta":1000}'
  ```
- **Logs de PHP:** `logs/php_errors.log` dentro de cada servicio (`display_errors` está apagado vía
  `.htaccess`; los errores se registran con `error_log()`).
- **Requisitos:** PHP 8.x (`mysqli`, `mbstring`, `curl`), MySQL/MariaDB, Apache 2.4 con
  `mod_rewrite`, `mod_headers`, `mod_deflate`.

### Estándar de pruebas: PHPUnit (objetivo a adoptar)

Las pruebas automatizadas se estandarizan en **PHPUnit** (aún no configurado — instaurarlo es parte
del trabajo pendiente). Al crear la infraestructura de tests, respeta estas pautas **por servicio**
(cada `rest_*` mantiene su propio Composer y su propia suite, igual que hoy son independientes):

- Añadir `composer.json` con `phpunit/phpunit` en `require-dev` y **autoload PSR-4** (empezar a
  migrar los `require_once` manuales a autoloading conforme se toquen archivos).
- Estructura sugerida: `tests/Unit/` (modelos/controladores con la BD y `Enlace` mockeados o con
  base de datos de prueba) y `tests/Integration/` (endpoints extremo a extremo contra un servidor
  local). Nombrar cada test según su tripleta: `CuentasMdlTest`, `CuentasCtrlTest`.
- Comandos (una vez exista `composer.json` en el servicio):
  ```bash
  cd rest_criteriokelly
  composer install
  vendor/bin/phpunit                              # toda la suite
  vendor/bin/phpunit --testsuite Unit             # solo unitarias
  vendor/bin/phpunit tests/Unit/CuentasMdlTest.php # un archivo
  vendor/bin/phpunit --filter agregarCuenta        # un solo test
  ```
- **Qué cubrir con prioridad:** validaciones de `BaseCtrl` y de cada controlador (campos requeridos,
  rangos, formatos), el mapeo de acciones en los `*Rts`, los códigos HTTP devueltos, y la validación
  de JWT (token válido/expirado/ausente → 200/401).
- Para probar los `*Mdl` sin BD real, inyectar un doble de `Enlace`; considera refactorizar los
  modelos para recibir `Enlace` por constructor (hoy hacen `new Enlace()` internamente, lo que
  dificulta el mock).

## Arquitectura por capas (idéntica en los 4 servicios)

El flujo de una petición atraviesa capas con nombres fijos por sufijo de archivo:

```
index.php (Front Controller)  → configura CORS, maneja OPTIONS, matchea prefijo de URI
  └─ rutas/XxxRts.php         → despacha por método HTTP, parsea la acción, valida/decodifica JSON
       └─ controladores/XxxCtrl.php  → valida negocio, sanea, arma la respuesta (extiende BaseCtrl)
            └─ modelos/XxxMdl.php     → SQL con sentencias preparadas (instancia `new Enlace()`)
                 └─ configuracion/enlace.php  → clase Enlace (mysqli)
```

**Convención de nombres — respétala siempre** (un dominio = una tripleta):
`rutas/XxxRts.php` · `controladores/XxxCtrl.php` · `modelos/XxxMdl.php`. Clases en `PascalCase`,
métodos/variables en `camelCase`, todo el dominio y los comentarios en **español**.

### Enrutamiento (dos niveles)

1. **`index.php`** define `$rutas = ['/prefijo' => 'rutas/XxxRts.php', ...]` y hace `require_once`
   del archivo cuyo **prefijo aparece como substring** de la URI (`strpos`, no match exacto).
2. **`rutas/XxxRts.php`** hace `switch ($_SERVER['REQUEST_METHOD'])` y extrae la **acción** como el
   segmento de URI inmediatamente posterior al prefijo (`/cuentas/obtener` → acción `obtener`). En
   POST/PUT/DELETE lee `php://input`, decodifica JSON y valida antes de llamar al controlador.

Añadir un endpoint = añadir un `case` en el `Rts`, un método público en el `Ctrl`, y un método en el
`Mdl`. Añadir un dominio nuevo = crear la tripleta + registrar el prefijo en `index.php`.

### Acceso a datos: clase `Enlace` (`configuracion/enlace.php`)

Los modelos **nunca** escriben mysqli directamente; usan estos métodos, todos con
`bind_param` (primer arg SQL, segundo la cadena de tipos `"sii"`, resto los valores):

- `ejecutarConsulta` → `mysqli_result` (SELECT múltiple)
- `ejecutarConsultaSimpleFila` → array asociativo de una fila
- `ejecutarConsultaRetornarID` / `ejecutarInsercionRetornaID` → `insert_id`
- `ejecutarActualizacion` → filas afectadas (UPDATE/DELETE)

Toda consulta va parametrizada (previene inyección SQL). Parte de la lógica de `rest_criteriokelly`
vive en **procedimientos almacenados** (`anexos/procedimientos.sql`). Las eliminaciones suelen ser
**lógicas** (`estado = '0'`), no físicas. Cada servicio prefija sus tablas (p. ej. `sckc_` en
criteriokelly).

### Respuestas: `BaseCtrl` (`controladores/BaseCtrl.php`)

Todos los controladores extienden `BaseCtrl` y responden con sus helpers (que hacen `exit`):
`respuestaExitosaSimple($dato)` (200), `respuestaErrorSimple($msg, $httpCode)` (default 400),
`respuestaJsonSimple(...)`. Toda salida es JSON con `JSON_UNESCAPED_UNICODE`. Validación con
`validarDatos($data, [campos])` y saneamiento con `limpiarDatos()`
(`htmlspecialchars(..., ENT_QUOTES, 'UTF-8')`). Los controladores envuelven todo en `try/catch`:
registran el detalle con `error_log()` y devuelven **mensaje genérico + 500** al cliente. Códigos
usados: 200 / 400 / 404 / 405 / 500.

## Configuración y seguridad (por servicio)

- **Credenciales de BD:** hardcodeadas en `configuracion/global.php` (`DB_HOST`, `DB_NAME`,
  `DB_USERNAME`, `DB_PASSWORD`, `DB_ENCODE`). Están versionadas — no es lo ideal, pero es el patrón
  actual; al añadir un servicio, replica este archivo. **Objetivo:** externalizar a variables de
  entorno / `.env` ignorado por Git (incluye ahí también el secreto JWT, ver abajo).
- **CORS:** origen permitido `http://localhost:8100` (cliente Ionic/Angular), definido en el
  `.htaccess`. `CorsConfig::configurar()` / `manejarPreflight()` en `index.php` complementan headers y
  responden `OPTIONS` con 200. `Access-Control-Allow-Headers` ya incluye `Authorization`, necesario
  para el token del frontend. En producción, sustituir `localhost:8100` por el dominio real del SPA.
- **`.htaccess` — ojo al copiar entre servicios:** contiene el **prefijo del servicio hardcodeado**
  (p. ej. `/rest_criteriokelly/` en reglas de rewrite, bloqueo de carpetas internas, ErrorDocument).
  Al clonar un servicio como base de otro, **actualiza todas esas rutas** o el ruteo se rompe.
- **Protección:** el `.htaccess` bloquea acceso directo a `configuracion/`, `rutas/`, `modelos/`,
  `controladores/`, oculta `Server`/`X-Powered-By` y fija headers de seguridad (CSP, X-Frame-Options,
  nosniff, etc.).

## Autenticación para el frontend: JWT (Bearer token) — estándar objetivo

El SPA (Ionic/Angular) se autentica con **JSON Web Tokens**. Hoy solo existe login con contraseña
(`password_hash`/BCRYPT en `rest_usuario`); la emisión y validación de JWT es el estándar a adoptar.
Al implementarlo, sigue este contrato para que sea **homogéneo entre todos los microservicios**:

- **Emisión (solo `rest_usuario`):** el endpoint de login verifica credenciales con
  `password_verify` y devuelve un JWT firmado (**HS256**) con claims mínimos:
  `sub` (id de usuario), `rol`, `iat`, `exp` (expiración corta, p. ej. 1 h). Usar la librería
  `firebase/php-jwt` vía Composer — no implementar la firma a mano.
- **Secreto compartido:** el mismo `JWT_SECRET` en todos los servicios, leído desde variable de
  entorno / `.env` (**nunca** hardcodeado ni versionado). Es lo que permite que cualquier servicio
  valide un token emitido por `rest_usuario`.
- **Transporte:** el frontend envía `Authorization: Bearer <jwt>` en cada petición.
- **Validación (todos los servicios):** añadir un **middleware previo al ruteo en `index.php`**
  —antes del `foreach` de `$rutas`— que:
  1. Deje pasar sin token el preflight `OPTIONS` y, si aplica, el health check y el propio login.
  2. Extraiga y verifique el Bearer token (firma + `exp`). Token ausente/ inválido/ expirado →
     responder **401** con JSON `{"error": "..."}` y `exit`, sin llegar a las rutas.
  3. Deje el payload decodificado disponible para controladores (p. ej. en una constante/variable
     global) para autorización por `rol` y para **derivar el `usuarioId` del token** en vez de
     confiar en el que venga en el body.
- **Autorización:** validar `rol` en el controlador cuando el endpoint lo requiera. No exponer
  acciones de escritura a roles sin permiso.
- **Endurecimiento pendiente asociado:** forzar **HTTPS** (regla comentada en el `.htaccess`),
  rate-limiting en login, y no revelar en los mensajes de error si falló el usuario o la contraseña.

> Al escribir pruebas (sección PHPUnit), cubrir explícitamente los casos de JWT: válido → 200,
> ausente → 401, expirado → 401, firma inválida → 401, rol insuficiente → 403.

## Dependencias entre archivos

No hay autoloading: cada archivo enlaza sus dependencias con rutas relativas explícitas
(`require_once(__DIR__ . '/../modelos/XxxMdl.php')`, `include_once` a `enlace.php`). Al mover o crear
archivos, mantén esas rutas relativas correctas — es el mecanismo que sustituye a PSR-4/Composer.
