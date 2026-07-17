# rest_criteriokelly

Servicio **REST** para el manejo de las reglas de negocio del **Criterio de Kelly**: gestión de
cuentas y capital, bitácora de operaciones, comentarios/observaciones y el cálculo del porcentaje
de Kelly aplicado a la operativa financiera.

Desarrollado en **PHP nativo** bajo una arquitectura por capas orientada a microservicios, sin
dependencias de frameworks externos.

---

## Tabla de contenidos

- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Ejecución](#ejecución)
- [Endpoints de la API](#endpoints-de-la-api)
- [Formato de respuestas](#formato-de-respuestas)
- [Estándares y convenciones de desarrollo](#estándares-y-convenciones-de-desarrollo)
- [Seguridad](#seguridad)
- [Base de datos](#base-de-datos)
- [Cómo agregar un nuevo microservicio](#cómo-agregar-un-nuevo-microservicio)

---

## Stack tecnológico

| Componente          | Tecnología                          |
|---------------------|-------------------------------------|
| Lenguaje            | PHP 8.x (nativo, sin framework)     |
| Base de datos       | MySQL / MariaDB                     |
| Acceso a datos      | `mysqli` con sentencias preparadas  |
| Servidor web        | Apache (con `mod_rewrite` y `mod_headers`) |
| Formato de datos    | JSON (UTF-8)                        |
| Estilo de API       | REST                               |

---

## Arquitectura

El servicio sigue un patrón **por capas (layered / MVC de servicio)** donde cada dominio de negocio
es autocontenido, lo que facilita su extracción hacia microservicios independientes:

```
Cliente HTTP
    │
    ▼
index.php ──────────► Front Controller
    │                 (CORS, preflight, ruteo por prefijo de URI)
    ▼
rutas/*Rts.php ─────► Capa de enrutamiento
    │                 (parseo de acción, método HTTP, validación de payload)
    ▼
controladores/*Ctrl.php ─► Capa de control / aplicación
    │                       (validación de negocio, saneamiento, respuestas)
    ▼
modelos/*Mdl.php ──► Capa de acceso a datos
    │                (consultas SQL preparadas, procedimientos almacenados)
    ▼
configuracion/enlace.php ─► Capa de persistencia (mysqli)
    │
    ▼
MySQL / MariaDB
```

### Responsabilidades por capa

- **Front Controller (`index.php`)**: punto único de entrada. Configura CORS/headers, maneja
  peticiones `OPTIONS` (preflight) y despacha la petición al archivo de ruta según el prefijo de la URI.
- **Rutas (`rutas/`)**: reciben la petición, identifican la **acción** y el **método HTTP**,
  validan que el payload sea JSON válido y delegan al controlador correspondiente.
- **Controladores (`controladores/`)**: contienen la lógica de aplicación. Validan datos requeridos,
  sanean la entrada, orquestan la llamada al modelo y construyen la respuesta HTTP.
  Todos extienden de `BaseCtrl`.
- **Modelos (`modelos/`)**: encapsulan el acceso a datos. Ejecutan consultas preparadas mediante la
  clase `Enlace`. No contienen lógica de presentación.
- **Configuración (`configuracion/`)**: credenciales, conexión a base de datos y políticas CORS.

---

## Estructura del proyecto

```
rest_criteriokelly/
├── index.php                    # Front Controller / punto de entrada
├── .htaccess                    # Rewrite, CORS, headers de seguridad, gzip
├── rutas.txt                    # Documentación de referencia de endpoints
│
├── configuracion/
│   ├── global.php               # Constantes de conexión (DB_HOST, DB_NAME, ...)
│   ├── enlace.php               # Clase Enlace: conexión y ejecución de consultas
│   └── CorsConfig.php           # Configuración centralizada de CORS/headers
│
├── controladores/
│   ├── BaseCtrl.php             # Clase base: validación, saneamiento, respuestas JSON
│   ├── CuentasCtrl.php
│   ├── BitacoraCtrl.php
│   ├── ComentariosCtrl.php
│   ├── CriterioKellyCtrl.php
│   └── ReglasKellyCtrl.php
│
├── modelos/
│   ├── CuentasMdl.php
│   ├── BitacoraMdl.php
│   ├── ComentariosMdl.php
│   ├── CriterioKellyMdl.php
│   └── ReglasKellyMdl.php
│
├── rutas/
│   ├── CuentasRts.php
│   ├── BitacoraRts.php
│   ├── ComentariosRts.php
│   └── CriterioKellyRts.php
│
└── anexos/
    ├── sist_criteriokelly.sql   # Esquema de la base de datos
    └── procedimientos.sql       # Procedimientos almacenados
```

---

## Requisitos previos

- **PHP 8.0+** con las extensiones `mysqli` y `mbstring` habilitadas.
- **MySQL 5.7+ / MariaDB 10.x**.
- **Apache 2.4+** con los módulos `mod_rewrite`, `mod_headers` y `mod_deflate` activos.
- Servidor local de desarrollo (XAMPP, WAMP, Laragon o Apache + PHP nativos).

---

## Instalación y configuración

1. **Clonar el repositorio** dentro del `DocumentRoot` del servidor (por ejemplo, `htdocs/`):

   ```bash
   git clone <url-del-repositorio> rest_criteriokelly
   ```

2. **Crear la base de datos** e importar el esquema y los procedimientos almacenados:

   ```bash
   mysql -u root -p -e "CREATE DATABASE sist_criteriokelly CHARACTER SET utf8;"
   mysql -u root -p sist_criteriokelly < anexos/sist_criteriokelly.sql
   mysql -u root -p sist_criteriokelly < anexos/procedimientos.sql
   ```

3. **Configurar las credenciales** en [configuracion/global.php](configuracion/global.php):

   ```php
   define("DB_HOST", "localhost");
   define("DB_NAME", "sist_criteriokelly");
   define("DB_USERNAME", "root");
   define("DB_PASSWORD", "");        // establecer contraseña en producción
   define("DB_ENCODE", "utf8");
   ```

   > **Recomendación (producción):** no versionar credenciales reales. Externalícelas a variables
   > de entorno o a un archivo `.env` ignorado por Git (ver [Estándares](#estándares-y-convenciones-de-desarrollo)).

4. **Verificar el origen CORS permitido** en [.htaccess](.htaccess). Por defecto está configurado
   para `http://localhost:8100` (cliente Ionic/Angular). Ajústelo según el frontend consumidor.

---

## Ejecución

Con Apache apuntando al proyecto, el servicio queda disponible en:

```
http://localhost/rest_criteriokelly/
```

Al acceder desde un navegador se muestra una página de estado. Las peticiones con
`Accept: application/json` se enrutan a la API.

**Health check** de cualquier microservicio (GET al prefijo sin acción):

```bash
curl http://localhost/rest_criteriokelly/cuentas
# { "status": "ok", "version": "1.0.0", "service": "CuentasRTs", ... }
```

---

## Endpoints de la API

La URI base es `http://localhost/rest_criteriokelly`. El ruteo se resuelve por prefijo
(`/cuentas`, `/bitacora`, `/comentarios`, `/criterioKelly`) seguido de una **acción**.

### Cuentas — `/cuentas`

| Método | Ruta                      | Descripción                                   |
|--------|---------------------------|-----------------------------------------------|
| GET    | `/cuentas`                | Health check del servicio                     |
| GET    | `/cuentas/obtener?id={id}`| Obtiene las cuentas de un usuario             |
| POST   | `/cuentas/nueva`          | Crea una cuenta con su capital inicial        |
| POST   | `/cuentas/movCapital`     | Registra un movimiento de capital             |
| PUT    | `/cuentas/nombre`         | Actualiza el nombre de una cuenta             |
| DELETE | `/cuentas/eliminar`       | Eliminación lógica de una cuenta (`estado=0`) |

### Bitácora — `/bitacora`

| Método | Ruta                          | Descripción                             |
|--------|-------------------------------|-----------------------------------------|
| POST   | `/bitacora/crear`             | Crea un registro de bitácora            |
| POST   | `/bitacora/listBitacora`      | Lista la bitácora por cuenta            |
| PUT    | `/bitacora/finalizaBitacora`  | Finaliza una operación de bitácora      |
| DELETE | `/bitacora/eliminarBitacora`  | Elimina un registro de bitácora         |

### Comentarios — `/comentarios`

| Método | Ruta                                 | Descripción                              |
|--------|--------------------------------------|------------------------------------------|
| GET    | `/comentarios/observaciones?id={id}` | Obtiene observaciones por bitácora       |
| POST   | `/comentarios/crearComentario`       | Crea un comentario para una bitácora     |
| PUT    | `/comentarios/comentarioBitacora`    | Actualiza el comentario de una bitácora  |

### Criterio de Kelly — `/criterioKelly`

| Método | Ruta                                | Descripción                                    |
|--------|-------------------------------------|------------------------------------------------|
| GET    | `/criterioKelly`                    | Health check del servicio                      |
| POST   | `/criterioKelly/obtenerPorcentaje`  | Calcula el porcentaje de Kelly por cuenta      |
| POST   | `/criterioKelly/obtenerResultados`  | Obtiene resultados por identificador           |
| POST   | `/criterioKelly/detalleOperacion`   | Detalle de operaciones                         |
| POST   | `/criterioKelly/operacionAnalisis`  | Operaciones para análisis                      |
| POST   | `/criterioKelly/observacionAnalisis`| Observaciones para análisis                    |

> Consulte [rutas.txt](rutas.txt) para ejemplos de payloads y respuestas de referencia.

### Ejemplo de petición

```bash
curl -X POST http://localhost/rest_criteriokelly/cuentas/nueva \
  -H "Content-Type: application/json" \
  -d '{
        "cue_nombre": "Cuenta principal",
        "cue_usuarioId": 1,
        "fecha_valor": "2026-01-01",
        "valor_cuenta": 1000.00
      }'
```

---

## Formato de respuestas

Todas las respuestas son **JSON con UTF-8** (`JSON_UNESCAPED_UNICODE`) y usan códigos de estado
HTTP semánticos.

**Éxito:**

```json
{
  "cue_nombre": "Cuenta principal",
  "cue_usuarioId": 1,
  "valor_cuenta": 1000.00
}
```

**Error:**

```json
{
  "error": "El campo 'cue_nombre' es requerido"
}
```

**Códigos HTTP utilizados:**

| Código | Significado                                   |
|--------|-----------------------------------------------|
| 200    | Operación exitosa                             |
| 400    | Petición inválida (validación / JSON inválido)|
| 404    | Recurso o endpoint no encontrado              |
| 405    | Método HTTP no permitido                      |
| 500    | Error interno del servidor                    |

---

## Estándares y convenciones de desarrollo

Este proyecto adopta buenas prácticas de desarrollo backend orientado a microservicios en PHP.

### Convenciones de código

- **Idioma:** el dominio de negocio, nombres de clases, métodos y comentarios están en **español**,
  de forma consistente en todo el proyecto.
- **Nomenclatura de archivos por capa (sufijos):**
  - Rutas → `*Rts.php` (ej. `CuentasRts.php`)
  - Controladores → `*Ctrl.php` (ej. `CuentasCtrl.php`)
  - Modelos → `*Mdl.php` (ej. `CuentasMdl.php`)
- **Clases:** `PascalCase`. **Métodos y variables:** `camelCase`.
- **Un dominio por microservicio:** cada entidad tiene su tripleta ruta + controlador + modelo,
  manteniendo bajo acoplamiento y alta cohesión.
- **Prefijo de tablas:** el esquema usa el prefijo `sckc_` (p. ej. `sckc_cuentas`, `sckc_capital`).
- **Estándar de estilo:** se recomienda seguir **PSR-12** (formato de código) y **PSR-4**
  (autoloading) para nuevas incorporaciones, así como **PSR-1** en convenciones básicas.

### Principios de diseño

- **Separación de responsabilidades (SoC):** presentación (ruta), aplicación (controlador) y
  persistencia (modelo) están claramente separadas.
- **DRY:** la lógica transversal vive en clases base (`BaseCtrl`) y utilitarias (`Enlace`,
  `CorsConfig`).
- **Front Controller:** un único punto de entrada (`index.php`) centraliza el ruteo y las políticas
  transversales.
- **Fail fast:** validación temprana de entrada (JSON, campos requeridos, tipos) antes de tocar
  la base de datos.

### Manejo de errores y logging

- Toda operación de acceso a datos y de negocio se envuelve en bloques `try/catch`.
- Los errores internos se registran con `error_log()` y **nunca** se exponen detalles sensibles al
  cliente (se responde con un mensaje genérico y código `500`).

### Validación y saneamiento

- Validación de campos requeridos y de tipos mediante `BaseCtrl::validarDatos()`.
- Saneamiento de entradas con `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')` vía
  `BaseCtrl::limpiarDatos()` y `Enlace::limpiarCadena()`.
- Validaciones específicas de negocio (rangos, formatos, longitudes) en el controlador.

### Recomendaciones para evolución (deuda técnica sugerida)

- Externalizar credenciales a variables de entorno / `.env` (no versionar secretos).
- Incorporar **Composer** con autoloading **PSR-4** para eliminar los `require_once` manuales.
- Añadir autenticación por **token/JWT** en un middleware previo al ruteo.
- Agregar pruebas automatizadas (**PHPUnit**) y análisis estático (**PHPStan** / **Psalm**).
- Estandarizar el envelope de respuesta (`estado`, `mensaje`, `fecha`, `dato`) en todos los
  endpoints, como ya se documenta en `rutas.txt`.

---

## Seguridad

Configurada de forma centralizada en [.htaccess](.htaccess) y [CorsConfig.php](configuracion/CorsConfig.php):

- **CORS** restringido a un origen específico (`http://localhost:8100` por defecto).
- **Sentencias preparadas** (`mysqli` con `bind_param`) en todo el acceso a datos → previene
  inyección SQL.
- **Headers de seguridad:** `X-XSS-Protection`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy` y `Content-Security-Policy`.
- **Ocultamiento de metadatos** del servidor (`Server`, `X-Powered-By`) y `Options -Indexes`.
- **Manejo de preflight** `OPTIONS` centralizado.

---

## Base de datos

- **Motor:** MySQL / MariaDB, codificación `utf8`.
- **Esquema:** [anexos/sist_criteriokelly.sql](anexos/sist_criteriokelly.sql).
- **Procedimientos almacenados:** [anexos/procedimientos.sql](anexos/procedimientos.sql) — parte de
  la lógica de negocio (cálculos del criterio de Kelly) se apoya en procedimientos.
- **Acceso:** exclusivamente a través de la clase `Enlace`
  ([configuracion/enlace.php](configuracion/enlace.php)), que expone métodos para consultas,
  inserciones con retorno de ID y actualizaciones, siempre con parámetros vinculados.

---

## Cómo agregar un nuevo microservicio

Para incorporar un nuevo dominio (por ejemplo, `reportes`):

1. **Modelo** — `modelos/ReportesMdl.php`: métodos de acceso a datos usando `Enlace`.
2. **Controlador** — `controladores/ReportesCtrl.php`: extiende `BaseCtrl`, valida y orquesta.
3. **Ruta** — `rutas/ReportesRts.php`: parsea la acción, valida el método/payload y delega al
   controlador.
4. **Registro** — agregar el prefijo en el mapa de rutas de [index.php](index.php):

   ```php
   $rutas = [
       '/cuentas'       => 'rutas/CuentasRts.php',
       '/bitacora'      => 'rutas/BitacoraRts.php',
       '/comentarios'   => 'rutas/ComentariosRts.php',
       '/criterioKelly' => 'rutas/CriterioKellyRts.php',
       '/reportes'      => 'rutas/ReportesRts.php',   // ← nuevo
   ];
   ```

Respete los sufijos (`*Rts`, `*Ctrl`, `*Mdl`) y el patrón de las capas existentes para mantener la
consistencia del proyecto.

---

## Autor

**CRIP-Tecnología** — [criptecnologia.com](https://criptecnologia.com/)
