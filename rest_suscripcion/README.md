# rest_suscripcion

Microservicio REST para la gestión de **suscripciones, planes y pagos** de la plataforma Criterio Kelly. Forma parte de la arquitectura de microservicios de **CRIP-Tecnología** y expone una API JSON construida con **PHP nativo** sobre **MySQL/MariaDB**.

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Instalación y configuración](#instalación-y-configuración)
- [Base de datos](#base-de-datos)
- [Endpoints de la API](#endpoints-de-la-api)
- [Formato de respuestas](#formato-de-respuestas)
- [Seguridad](#seguridad)
- [Estándares y convenciones de desarrollo](#estándares-y-convenciones-de-desarrollo)
- [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)

---

## Descripción

`rest_suscripcion` es un microservicio autónomo cuya única responsabilidad de negocio es administrar el ciclo de vida de las suscripciones:

- Consulta de **planes disponibles** y **planes suscritos sin pagar**.
- Creación de **suscripciones sin pago** (periodo de prueba / cortesía).
- Creación de **suscripciones con pago** y registro del pago asociado.
- Consulta de **suscripciones activas por usuario**.

El servicio sigue el principio de **responsabilidad única** propio de una arquitectura de microservicios: no gestiona usuarios, autenticación central ni catálogo; consume esos dominios desde sus propios servicios y solo persiste lo relacionado con suscripciones y pagos.

---

## Stack tecnológico

| Componente        | Tecnología                          |
|-------------------|-------------------------------------|
| Lenguaje          | PHP 7.4+ / 8.x (nativo, sin framework) |
| Base de datos     | MySQL / MariaDB (extensión `mysqli`) |
| Servidor web      | Apache 2.4+ con `mod_rewrite` y `mod_headers` |
| Formato de datos  | JSON (UTF-8)                         |
| Estilo de API     | REST                                |

---

## Arquitectura

El servicio implementa un patrón por capas inspirado en **MVC / Front Controller**, adaptado a PHP nativo:

```
Cliente (HTTP/JSON)
       │
       ▼
  .htaccess  ──►  index.php  (Front Controller / Router principal)
       │
       ▼
  rutas/*Rts.php   (Enrutamiento por recurso: parseo de URI, método y acción)
       │
       ▼
  controladores/*Ctrl.php   (Validación, saneamiento, orquestación y respuesta)
       │
       ▼
  modelos/*Mdl.php   (Acceso a datos, consultas SQL parametrizadas)
       │
       ▼
  configuracion/enlace.php   (Capa de conexión / abstracción de mysqli)
       │
       ▼
  Base de datos MySQL
```

**Responsabilidades por capa**

- **Front Controller (`index.php`)**: punto único de entrada. Aplica CORS y cabeceras de seguridad, resuelve la ruta base (`/planes`, `/suscripcion`) y delega al archivo de rutas correspondiente.
- **Rutas (`rutas/`)**: interpretan la URI, el método HTTP (`GET`, `POST`) y la acción; validan parámetros de entrada y el cuerpo JSON antes de invocar al controlador.
- **Controladores (`controladores/`)**: contienen la lógica de aplicación. Validan datos requeridos, sanean entradas, orquestan uno o varios modelos y formatean la respuesta. Todos heredan de `BaseCtrl`.
- **Modelos (`modelos/`)**: encapsulan el acceso a datos con consultas **preparadas y parametrizadas**. No contienen lógica de negocio ni de presentación.
- **Configuración (`configuracion/`)**: conexión a base de datos (`Enlace`), constantes globales (`global.php`) y política CORS (`CorsConfig`).

---

## Estructura del proyecto

```
rest_suscripcion/
├── index.php                  # Front Controller: router principal + página de bienvenida
├── .htaccess                  # Reescritura de URL, CORS, cabeceras de seguridad, cache
├── README.md
│
├── configuracion/
│   ├── enlace.php             # Clase Enlace: abstracción de mysqli (consultas preparadas)
│   ├── global.php             # Constantes de conexión y del proyecto
│   └── CorsConfig.php         # Configuración centralizada de CORS y cabeceras
│
├── rutas/
│   ├── PlanesRts.php          # Enrutamiento del recurso /planes
│   └── SuscripcionRts.php     # Enrutamiento del recurso /suscripcion
│
├── controladores/
│   ├── BaseCtrl.php           # Controlador base: validación, saneamiento y respuestas
│   ├── PlanesCtrl.php
│   ├── SuscripcionCtrl.php
│   └── PagosCtrl.php
│
├── modelos/
│   ├── PlanesMdl.php
│   ├── SuscripcionMdl.php
│   └── PagosMdl.php
│
└── anexos/                    # Recursos de apoyo (no se despliegan en producción)
    ├── Modelo.PNG             # Diagrama entidad-relación
    ├── sist_suscripcion.sql   # Estructura de tablas
    ├── sist_suscripcionDatos.sql
    ├── sist_suscripcion_CRM.sql
    ├── Procedimientos NuevaSuscripcion.sql
    └── Procedimientos RenovacionAutomatica.sql
```

---

## Requisitos

- PHP **7.4** o superior (recomendado 8.1+) con la extensión **`mysqli`** habilitada.
- MySQL **5.7+** o MariaDB **10.4+**.
- Apache **2.4+** con los módulos `mod_rewrite`, `mod_headers`, `mod_deflate` y `mod_expires`.
- `AllowOverride All` habilitado en el _virtual host_ para que se apliquen las reglas del `.htaccess`.

---

## Instalación y configuración

1. **Clonar el repositorio** en el directorio del servidor web (p. ej. `htdocs/` o `www/`):

   ```bash
   git clone <url-del-repositorio> rest_suscripcion
   ```

2. **Crear la base de datos** e importar los scripts de la carpeta `anexos/`:

   ```bash
   mysql -u root -p sist_criteriokelly < anexos/sist_suscripcion.sql
   mysql -u root -p sist_criteriokelly < anexos/sist_suscripcionDatos.sql
   mysql -u root -p sist_criteriokelly < "anexos/Procedimientos NuevaSuscripcion.sql"
   mysql -u root -p sist_criteriokelly < "anexos/Procedimientos RenovacionAutomatica.sql"
   ```

3. **Configurar la conexión** editando `configuracion/global.php`:

   ```php
   define("DB_HOST", "localhost");
   define("DB_NAME", "sist_criteriokelly");
   define("DB_USERNAME", "root");
   define("DB_PASSWORD", "");        // usar una contraseña segura en producción
   define("DB_ENCODE", "utf8");
   define("PRO_NOMBRE", "Crip-Tecnología");
   ```

   > **Importante:** `global.php` y `enlace.php` están bloqueados vía `.htaccess`. No versionar credenciales reales de producción; se recomienda migrarlas a variables de entorno (ver [Estándares](#estándares-y-convenciones-de-desarrollo)).

4. **Ajustar el origen CORS permitido** en `.htaccess` (por defecto `http://localhost:8100`, el _origin_ del frontend Ionic/Angular):

   ```apache
   Header always set Access-Control-Allow-Origin "http://localhost:8100"
   ```

5. **Verificar el servicio** accediendo al _health check_:

   ```bash
   curl http://localhost/rest_suscripcion/suscripcion
   curl http://localhost/rest_suscripcion/planes
   ```

---

## Base de datos

Prefijo de tablas del dominio: **`spsu_`** (Suscripción / Pagos SUscripción).

| Tabla               | Descripción                                        |
|---------------------|----------------------------------------------------|
| `spsu_suscripcion`  | Suscripciones de los usuarios (estado, fechas, plan). |
| `spsu_pagos`        | Pagos asociados a cada suscripción.                |
| _(planes/intervalos)_ | Catálogo de planes e intervalos de precios.      |

El diagrama entidad-relación completo está en [`anexos/Modelo.PNG`](anexos/Modelo.PNG).

---

## Endpoints de la API

Base URL (desarrollo): `http://localhost/rest_suscripcion`

### Planes — `GET /planes`

| Método | Ruta                       | Descripción                                   |
|--------|----------------------------|-----------------------------------------------|
| `GET`  | `/planes`                  | Health check del servicio de planes.          |
| `GET`  | `/planes/disponible`       | Lista los planes disponibles para contratar.  |
| `GET`  | `/planes/suscritos/{idUsuario}` | Planes suscritos sin pagar de un usuario. |

### Suscripción — `GET` / `POST /suscripcion`

| Método | Ruta                              | Descripción                                       |
|--------|-----------------------------------|---------------------------------------------------|
| `GET`  | `/suscripcion`                    | Health check del servicio de suscripciones.       |
| `GET`  | `/suscripcion/porUsuario?id={id}` | Suscripciones activas de un usuario.              |
| `POST` | `/suscripcion/crearSinPago`       | Crea una suscripción sin pago (prueba/cortesía).  |
| `POST` | `/suscripcion/crearConPago`       | Crea una suscripción y registra su pago.          |

**Ejemplo — crear suscripción sin pago**

```bash
curl -X POST http://localhost/rest_suscripcion/suscripcion/crearSinPago \
  -H "Content-Type: application/json" \
  -d '{ "sus_usuarioId": 12, "sus_pinIdPlanin": 3 }'
```

**Ejemplo — crear suscripción con pago**

```bash
curl -X POST http://localhost/rest_suscripcion/suscripcion/crearConPago \
  -H "Content-Type: application/json" \
  -d '{
        "iUsuario": 12,
        "pin_idPlanInterv": 3,
        "ins_numMeses": 12,
        "pin_precioFinal": 99.90,
        "idTransaccion": "TX-2026-000123",
        "metodoPago": "tarjeta",
        "correoTransaccion": "cliente@correo.com"
      }'
```

---

## Formato de respuestas

Todas las respuestas son **JSON con codificación UTF-8** (`JSON_UNESCAPED_UNICODE`).

**Éxito** — devuelve directamente el dato o colección solicitada:

```json
{
  "sis_idSuscrip": 45,
  "sus_usuarioId": 12,
  "sus_pinIdPlanin": 3,
  "sus_fechainicio": "2026-07-17 10:00:00",
  "sus_fechaFin": "2026-08-17 10:00:00",
  "sus_situacion": "P",
  "sus_renovAutomatica": false
}
```

**Error** — objeto con la clave `error`:

```json
{ "error": "El campo 'sus_usuarioId' es requerido" }
```

**Códigos HTTP utilizados**

| Código | Significado                                    |
|--------|------------------------------------------------|
| `200`  | Operación exitosa.                             |
| `400`  | Petición inválida (validación / JSON malformado). |
| `404`  | Recurso o endpoint no encontrado.             |
| `405`  | Método HTTP no permitido.                     |
| `500`  | Error interno del servidor.                    |

---

## Seguridad

Medidas ya implementadas en el servicio:

- **Consultas preparadas y parametrizadas** (`mysqli::prepare` + `bind_param`) en toda la capa de modelos → previene inyección SQL.
- **Saneamiento de entradas** con `htmlspecialchars(trim(...), ENT_QUOTES, 'UTF-8')` en `BaseCtrl` y `Enlace`.
- **Cabeceras de seguridad** vía `.htaccess`: `X-XSS-Protection`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy`.
- **CORS restringido** a un _origin_ explícito (no `*`).
- **Protección de archivos sensibles**: `global.php`, `enlace.php` y las carpetas internas (`configuracion/`, `modelos/`, `controladores/`, `rutas/`) están bloqueadas contra acceso directo.
- **Ocultamiento de información del servidor** (`ServerSignature Off`, `unset X-Powered-By`).
- **Registro de errores** en `logs/php_errors.log` con `display_errors Off` en producción.

Recomendaciones pendientes: mover credenciales a variables de entorno, añadir autenticación por token (JWT) e implementar _rate limiting_.

---

## Estándares y convenciones de desarrollo

Estas convenciones son de **cumplimiento obligatorio** para mantener la coherencia del microservicio y de la plataforma.

### 1. Principios de arquitectura de microservicios

- **Responsabilidad única (SRP):** cada servicio administra un solo dominio de negocio. Este servicio se limita a suscripciones, planes y pagos.
- **Separación por capas:** respetar estrictamente el flujo `ruta → controlador → modelo`. Una ruta **nunca** accede a la base de datos; un modelo **nunca** emite respuestas HTTP.
- **Sin lógica de negocio en los modelos:** los modelos solo ejecutan consultas. Las validaciones y reglas viven en los controladores.
- **Contrato estable:** los cambios que rompan el formato de respuesta o los endpoints deben versionarse.
- **Stateless:** cada petición es independiente; no se guarda estado de sesión en el servicio.
- **Fallos aislados:** todo acceso a datos se envuelve en `try/catch` y responde con un código HTTP apropiado, sin exponer detalles internos al cliente.

### 2. Estándares de código PHP (PSR)

- Seguir **PSR-12** (estilo de código) y **PSR-1** (estructura básica).
- **PSR-4** para autocarga cuando se introduzca Composer (recomendado a futuro).
- Indentación de **4 espacios**, sin tabuladores.
- Una clase por archivo; el nombre del archivo coincide con el de la clase.
- Usar **`declare(strict_types=1);`** y _type hints_ en parámetros y retornos (como ya se hace en `Enlace`).
- No dejar código de depuración (`echo`, `var_dump`, respuestas de prueba) en el flujo productivo.

### 3. Convenciones de nomenclatura

| Elemento              | Convención            | Ejemplo                          |
|-----------------------|-----------------------|----------------------------------|
| Clases                | `PascalCase` + sufijo | `SuscripcionCtrl`, `PagosMdl`    |
| Archivos de rutas     | `PascalCase` + `Rts`  | `SuscripcionRts.php`             |
| Archivos de controlador | `PascalCase` + `Ctrl` | `PlanesCtrl.php`               |
| Archivos de modelo    | `PascalCase` + `Mdl`  | `PlanesMdl.php`                  |
| Métodos y variables   | `camelCase`           | `obtenerSuscripcionesPorUsuario()` |
| Constantes            | `UPPER_SNAKE_CASE`    | `DB_HOST`, `PRO_NOMBRE`          |
| Tablas de BD          | prefijo `spsu_`       | `spsu_suscripcion`               |
| Columnas de BD        | prefijo por entidad   | `sus_usuarioId`, `pag_monto`     |
| Idioma                | **español** en dominio y comentarios | —                 |

### 4. Reglas de la capa de datos

- **Toda** consulta debe usar sentencias preparadas de `Enlace` (`ejecutarConsulta`, `ejecutarConsultaSimpleFila`, `ejecutarInsercionRetornaID`, `ejecutarActualizacion`).
- **Prohibido** concatenar variables directamente en cadenas SQL.
- Definir siempre la cadena de tipos de `bind_param` (`'i'`, `'s'`, `'d'`, …) acorde a los parámetros.
- Cerrar recursos: el `finally` de `Enlace` ya libera los _statements_; no dejar conexiones abiertas.

### 5. Reglas de controladores y respuestas

- Validar campos requeridos con `validarDatos()` y sanear con `limpiarDatos()` **antes** de cualquier operación.
- Usar exclusivamente los métodos de respuesta de `BaseCtrl` (`respuestaExitosaSimple`, `respuestaErrorSimple`) para uniformar la salida.
- Emplear el **código HTTP correcto** en cada caso (no responder `200` ante un error).
- No filtrar mensajes de excepción crudos al cliente; registrar el detalle con `error_log`.

### 6. Manejo de errores y logging

- Envolver la lógica en `try/catch`; capturar `Exception` y responder `500` con un mensaje genérico.
- Registrar el detalle técnico con `error_log()` (destino `logs/php_errors.log`).
- Mantener `display_errors Off` en producción.

### 7. Documentación

- Documentar cada método público con **PHPDoc** (`@param`, `@return`, descripción).
- Mantener este README y la referencia de endpoints actualizados ante cualquier cambio de contrato.

---

## Flujo de trabajo con Git

- Rama principal: **`main`** (estable, desplegable).
- Ramas de trabajo con el patrón: `suscripcion/<tipo>/<iniciales>/<código>`
  (ej.: `suscripcion/funcionalidad/wc/f001`).
- **Commits atómicos** y descriptivos, preferentemente en formato _Conventional Commits_:
  `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Toda funcionalidad se integra a `main` mediante _Pull Request_ revisado.

---

## Autoría

Desarrollado por **CRIP-Tecnología** — [criptecnologia.com](https://criptecnologia.com)
Innovación digital · Soluciones empresariales · Desarrollo de software.
