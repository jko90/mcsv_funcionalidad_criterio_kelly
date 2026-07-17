# rest_usuario

Microservicio REST para la gestión de **usuarios, personas, roles y autenticación** dentro del ecosistema **Criterio Kelly** de CRIP‑Tecnología.

Construido en **PHP nativo (sin framework)** siguiendo una arquitectura por capas (Rutas → Controladores → Modelos), con acceso a datos mediante **MySQLi y consultas preparadas** y comunicación **JSON sobre HTTP**.

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Base de datos](#base-de-datos)
- [Ejecución](#ejecución)
- [Endpoints de la API](#endpoints-de-la-api)
- [Formato de respuestas y códigos HTTP](#formato-de-respuestas-y-códigos-http)
- [Estándares de desarrollo (microservicios PHP)](#estándares-de-desarrollo-microservicios-php)
- [Convenciones de código](#convenciones-de-código)
- [Seguridad](#seguridad)
- [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)
- [Cómo añadir un nuevo recurso](#cómo-añadir-un-nuevo-recurso)

---

## Descripción

`rest_usuario` es uno de los microservicios del backend de **Criterio Kelly**. Su responsabilidad única es el **dominio de identidad**: personas, usuarios, roles y autenticación. Expone una API REST que consumen las aplicaciones cliente (por ejemplo, un frontend Ionic/Angular en `http://localhost:8100`).

Cada microservicio del ecosistema es autónomo, se despliega por separado y comparte únicamente el contrato de la API (no código ni conexiones directas a la base de datos de otros servicios).

---

## Stack tecnológico

| Componente        | Tecnología                                   |
| ----------------- | -------------------------------------------- |
| Lenguaje          | PHP 8.0+ (nativo, sin framework)             |
| Servidor web      | Apache 2.4+ con `mod_rewrite` y `mod_headers`|
| Base de datos     | MariaDB 10.4+ / MySQL 8.0+                    |
| Acceso a datos    | MySQLi (extensión nativa) + consultas preparadas |
| Formato de datos  | JSON (`application/json; charset=utf-8`)     |
| Hashing de claves | `password_hash()` / `password_verify()` (BCRYPT) |

---

## Arquitectura

El servicio aplica una **arquitectura por capas** con separación clara de responsabilidades:

```
Cliente HTTP
    │
    ▼
index.php ............... Front controller (enrutador principal)
    │                      Aplica CORS, seguridad y despacha por prefijo de ruta
    ▼
rutas/*Rts.php .......... Capa de enrutamiento
    │                      Parsea la URI y el método HTTP, valida el payload JSON,
    │                      delega en el controlador
    ▼
controladores/*Ctrl.php . Capa de aplicación / lógica de negocio
    │                      Valida y sanea datos, orquesta reglas, formatea la respuesta
    ▼
modelos/*Mdl.php ........ Capa de acceso a datos
    │                      Consultas SQL preparadas mediante la clase Enlace
    ▼
configuracion/enlace.php  Wrapper de conexión MySQLi (prepared statements)
    │
    ▼
Base de datos (sist_criteriokelly)
```

Principios que se respetan:

- **Responsabilidad única por capa.** Las rutas no consultan la BD; los modelos no formatean respuestas HTTP.
- **Front controller único.** Todo el tráfico entra por `index.php`; Apache reescribe cualquier URI hacia él.
- **Sin acceso directo a capas internas.** `.htaccess` bloquea el acceso web a `rutas/`, `modelos/`, `controladores/` y `configuracion/`.

---

## Estructura del proyecto

```
rest_usuario/
├── index.php                  # Front controller: enrutamiento por recurso
├── .htaccess                  # Reescritura de URLs, CORS, cabeceras de seguridad
├── README.md
├── rutas.txt                  # Documentación de endpoints con ejemplos
│
├── configuracion/             # ⚠ Protegido por .htaccess (no accesible vía web)
│   ├── global.php             # Constantes de conexión y del proyecto
│   ├── enlace.php             # Clase Enlace: wrapper MySQLi con prepared statements
│   └── CorsConfig.php         # Cabeceras CORS y de seguridad centralizadas
│
├── rutas/                     # Capa de enrutamiento (un archivo por recurso)
│   ├── PersonaRts.php
│   ├── UsuarioRts.php
│   ├── RolRts.php
│   └── ValidacionRts.php      # Autenticación y recuperación de clave
│
├── controladores/             # Capa de lógica de negocio
│   ├── BaseCtrl.php           # Clase base abstracta (validación, respuestas JSON)
│   ├── PersonaCtrl.php
│   ├── UsuarioCtrl.php
│   └── ValidacionCtrl.php
│
├── modelos/                   # Capa de acceso a datos
│   ├── PersonaMdl.php
│   ├── UsuarioMdl.php
│   └── ValidacionMdl.php
│
└── anexos/                    # Scripts SQL
    ├── sist_generico.sql      # Estructura de tablas
    └── sist_genericoDatos.sql # Datos de ejemplo
```

---

## Requisitos previos

- PHP **8.0 o superior** con las extensiones `mysqli` y `mbstring` habilitadas.
- **Apache 2.4+** con `mod_rewrite`, `mod_headers` y `AllowOverride All`.
- **MariaDB 10.4+** o **MySQL 8.0+**.
- Cliente HTTP para pruebas (Postman, Insomnia, `curl`).

---

## Instalación y configuración

1. **Clonar** el repositorio dentro del `DocumentRoot` de Apache (el proyecto asume la ruta base `/rest_usuario`):

   ```bash
   git clone <url-del-repositorio> rest_usuario
   ```

2. **Configurar la conexión** editando `configuracion/global.php`:

   ```php
   define("DB_HOST", "localhost");
   define("DB_NAME", "sist_criteriokelly");
   define("DB_USERNAME", "root");
   define("DB_PASSWORD", "");
   define("DB_ENCODE", "utf8");
   define("PRO_NOMBRE", "Crip-Tecnología");
   ```

   > **Importante:** `global.php` y `enlace.php` están protegidos por `.htaccess` y no son accesibles desde la web. Aun así, **nunca** subas credenciales productivas al repositorio. Se recomienda migrar estas constantes a variables de entorno (`getenv()`) o a un archivo `.env` ignorado por Git (ver [Estándares de desarrollo](#estándares-de-desarrollo-microservicios-php)).

3. **Configurar CORS.** El origen permitido está definido en `.htaccess` (`Access-Control-Allow-Origin`) y debe coincidir con el dominio del cliente (por defecto `http://localhost:8100`).

---

## Base de datos

Importar los scripts de `anexos/` en el orden indicado:

```bash
mysql -u root -p sist_criteriokelly < anexos/sist_generico.sql
mysql -u root -p sist_criteriokelly < anexos/sist_genericoDatos.sql
```

Tablas principales del dominio:

| Tabla             | Descripción                                  |
| ----------------- | -------------------------------------------- |
| `sgen_persona`    | Datos personales (cédula, nombres, correo…)  |
| `sgen_usuario`    | Credenciales y estado del usuario            |
| `sgen_rol`        | Catálogo de roles                            |
| `sgen_rolusuario` | Relación N:M entre usuarios y roles          |

Convenciones del esquema:

- Prefijo por tabla en las columnas: `per_`, `usu_`, `rol_`, `rus_`.
- **Borrado lógico:** columna `*_estado` (`1` activo / `0` eliminado).
- **Situación:** columna `*_situacion` (`A` activo, `E` anulado, `P` pendiente, `S` suspendido).

---

## Ejecución

Con Apache configurado, el servicio queda disponible en:

```
http://localhost/rest_usuario/
```

Al acceder desde un navegador se muestra una página informativa; las peticiones con `Accept: application/json` obtienen la respuesta de la API.

Prueba rápida (health check):

```bash
curl http://localhost/rest_usuario/autenticacion
```

---

## Endpoints de la API

Base URL: `http://localhost/rest_usuario`

### Autenticación (`/autenticacion`)

| Método | Endpoint                          | Descripción                          |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/autenticacion`                  | Información del servicio (health)    |
| POST   | `/autenticacion/autenticar`       | Autenticar usuario                   |
| GET    | `/autenticacion/usRol?id={id}`    | Obtener roles por ID de usuario      |
| POST   | `/autenticacion/generarCodigo`    | Generar código de recuperación       |
| POST   | `/autenticacion/obtenerCodigo`    | Obtener código de recuperación       |
| PUT    | `/autenticacion/actualizarClave`  | Actualizar contraseña                |

**Ejemplo — Autenticar:**

```bash
curl -X POST http://localhost/rest_usuario/autenticacion/autenticar \
  -H "Content-Type: application/json" \
  -d '{"usuario":"admin","clave":"123456"}'
```

```json
{ "id": 1, "nombres": "Wills", "apellidos": "WillsAp" }
```

### Persona (`/persona`)

| Método | Endpoint                        | Descripción                                     |
| ------ | ------------------------------- | ----------------------------------------------- |
| GET    | `/persona`                      | Información del servicio (health)               |
| POST   | `/persona/agregar`              | Registrar persona + usuario + rol               |
| PUT    | `/persona/actualizarDeApp`      | Actualizar nombres, apellidos y teléfono        |

**Ejemplo — Registrar:**

```bash
curl -X POST http://localhost/rest_usuario/persona/agregar \
  -H "Content-Type: application/json" \
  -d '{
    "cedula":"0102030405",
    "nombres":"Ana",
    "apellidos":"Pérez",
    "correo":"ana@correo.com",
    "telefono":"0991234567",
    "usuario":"anaperez",
    "clave":"secreta123"
  }'
```

> Consulta `rutas.txt` para ejemplos completos de peticiones y respuestas.

---

## Formato de respuestas y códigos HTTP

Todas las respuestas son JSON con `Content-Type: application/json; charset=utf-8`.

**Éxito** — el cuerpo contiene directamente los datos solicitados:

```json
{ "id": 1, "nombres": "Wills", "apellidos": "WillsAp" }
```

**Error** — objeto con la clave `error`:

```json
{ "error": "Credenciales inválidas" }
```

Códigos HTTP utilizados:

| Código | Uso                                                    |
| ------ | ------------------------------------------------------ |
| 200    | Operación exitosa                                      |
| 400    | Petición inválida (datos faltantes o mal formados)     |
| 401    | Credenciales inválidas                                 |
| 404    | Recurso o endpoint no encontrado                       |
| 405    | Método HTTP no permitido                               |
| 409    | Conflicto (usuario, correo o teléfono duplicado)       |
| 500    | Error interno del servidor                             |
| 501    | Método aún no implementado                             |

---

## Estándares de desarrollo (microservicios PHP)

Estos son los principios que rigen este servicio y todos los del ecosistema Criterio Kelly.

### 1. Un servicio, una responsabilidad
Cada microservicio cubre **un único dominio de negocio** (aquí: identidad). No debe asumir responsabilidades de otro servicio ni acceder a sus tablas privadas.

### 2. Autonomía y contrato explícito
Los servicios se comunican **solo por su API HTTP/JSON**, nunca compartiendo código de dominio ni la misma conexión de base de datos entre dominios distintos. El contrato (endpoints, formatos) es la única dependencia pública.

### 3. Arquitectura por capas obligatoria
Toda funcionalidad recorre **Ruta → Controlador → Modelo**:
- **Ruta:** parsea URI/método, valida el JSON de entrada, delega. No contiene lógica de negocio ni SQL.
- **Controlador:** valida reglas de negocio, sanea datos, orquesta y formatea la respuesta. No escribe SQL.
- **Modelo:** encapsula el acceso a datos con consultas preparadas. No emite respuestas HTTP.

### 4. Acceso a datos siempre parametrizado
Todas las consultas se ejecutan mediante la clase `Enlace` con **prepared statements** y `bind_param`. **Prohibida** la concatenación de variables en SQL.

### 5. Seguridad por defecto
- Contraseñas con `password_hash()` (BCRYPT); verificación con `password_verify()`. Nunca en texto plano.
- Saneamiento de entradas con `htmlspecialchars(trim(...), ENT_QUOTES, 'UTF-8')`.
- Validación de longitud y formato (cédula, correo, teléfono, usuario) en el controlador antes de tocar la BD.
- Cabeceras de seguridad y CORS centralizadas (`.htaccess` + `CorsConfig`).
- Archivos de configuración inaccesibles desde la web.

### 6. Gestión de errores y trazabilidad
- Toda operación de negocio se envuelve en `try/catch`.
- Los errores internos se registran con `error_log()` y **no** se exponen al cliente (se responde con un mensaje genérico y código 500).
- El `display_errors` está desactivado en producción (`.htaccess`).

### 7. Idempotencia semántica de los métodos HTTP
`GET` no muta estado; `POST` crea; `PUT` actualiza; `DELETE` elimina (borrado lógico). El health check vive en `GET /{recurso}`.

### 8. Configuración externalizada (recomendado)
Migrar credenciales y parámetros de entorno de `global.php` a variables de entorno / `.env` ignorado por Git, para no versionar secretos y facilitar despliegues por entorno (dev / staging / prod).

### 9. Documentación viva
Cada recurso expone un **health check** en su `GET` raíz que lista sus endpoints; `rutas.txt` documenta peticiones y respuestas de ejemplo. Mantenerlos actualizados al cambiar la API.

---

## Convenciones de código

- **Idioma:** dominio y mensajes en **español**; identificadores de dominio en español.
- **Clases:** `PascalCase` con sufijo por capa — `PersonaCtrl`, `PersonaMdl`, `PersonaRts` (archivo).
- **Métodos y variables:** `camelCase` — `autenticarUsuario`, `datosLimpios`.
- **Constantes:** `UPPER_SNAKE_CASE` — `DB_HOST`, `PRO_NOMBRE`.
- **Archivos:** un archivo por clase/recurso, con sufijo — `*Rts.php`, `*Ctrl.php`, `*Mdl.php`.
- **Columnas SQL:** prefijo de tabla + `camelCase` — `usu_idUsuario`, `per_nombres`.
- **Estilo:** PSR‑12 como referencia (indentación de 4 espacios, llaves en línea propia para clases/métodos).
- **Controladores** heredan de `BaseCtrl` y usan sus helpers de validación/respuesta (`validarDatos`, `limpiarDatos`, `respuestaExitosaSimple`, `respuestaErrorSimple`).
- **Modelos** reciben una instancia de `Enlace` y devuelven datos crudos (arrays / IDs / booleanos), nunca respuestas HTTP.

---

## Seguridad

Configurado en `.htaccess` y `CorsConfig.php`:

- **CORS** restringido al origen del cliente (`http://localhost:8100` por defecto).
- Cabeceras: `X-XSS-Protection`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy`.
- Ocultamiento de `Server` y `X-Powered-By`.
- Bloqueo de acceso directo a `configuracion/`, `rutas/`, `modelos/`, `controladores/` y a archivos sensibles (`.env`, `enlace.php`, `global.php`).
- Protección anti‑hotlinking y límites de subida.

> **Pendiente / recomendado:** proteger los endpoints con **JWT** (la cabecera `Authorization` ya está permitida en CORS) y forzar **HTTPS** en producción (regla comentada en `.htaccess`).

---

## Flujo de trabajo con Git

Nomenclatura de ramas usada en el proyecto:

```
<área>/<tipo>/<iniciales>/<código-tarea>
# ej.: usuario/funcionalidad/wc/f001
```

- Rama principal: `main`.
- Ramas de trabajo por funcionalidad; integración vía Pull Request.
- Mensajes de commit descriptivos y en presente.

---

## Cómo añadir un nuevo recurso

Para exponer un recurso nuevo (por ejemplo `producto`) manteniendo la arquitectura:

1. **Modelo** — `modelos/ProductoMdl.php`: consultas preparadas vía `Enlace`.
2. **Controlador** — `controladores/ProductoCtrl.php`: extiende `BaseCtrl`, valida y sanea, formatea respuestas.
3. **Ruta** — `rutas/ProductoRts.php`: parsea URI/método, valida JSON, delega en el controlador. Incluye un health check en `GET /producto`.
4. **Registrar la ruta** en el mapa `$rutas` de `index.php`:

   ```php
   $rutas = [
       '/persona'       => 'rutas/PersonaRts.php',
       '/usuario'       => 'rutas/UsuarioRts.php',
       '/rol'           => 'rutas/RolRts.php',
       '/autenticacion' => 'rutas/ValidacionRts.php',
       '/producto'      => 'rutas/ProductoRts.php', // nuevo
   ];
   ```

5. **Documentar** los endpoints en `rutas.txt` y en este README.
6. Añadir el prefijo del recurso a las reglas de reescritura de `.htaccess` si aplica.

---

**CRIP‑Tecnología** — Soluciones de Software Empresarial · Proyecto *Criterio Kelly*
