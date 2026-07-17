# Backend Criterio Kelly

Plataforma **backend de microservicios** de **CRIP‑Tecnología** para la aplicación **Criterio Kelly**:
gestión del capital de trading y cálculo del criterio de Kelly, catálogos de activos financieros,
usuarios/autenticación y suscripciones.

Cada microservicio es **autónomo, sin estado (*stateless*)** y está construido en **PHP nativo
(sin framework)** bajo una arquitectura por capas (**Rutas → Controladores → Modelos**), con acceso
a datos mediante **MySQLi + sentencias preparadas** y comunicación **JSON sobre HTTP**.

---

## Tabla de contenidos

- [Visión general](#visión-general)
- [Microservicios](#microservicios)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Ejecución](#ejecución)
- [Formato de respuestas](#formato-de-respuestas)
- [Estándares y convenciones de desarrollo](#estándares-y-convenciones-de-desarrollo)
- [Seguridad](#seguridad)
- [Cómo agregar un nuevo microservicio](#cómo-agregar-un-nuevo-microservicio)
- [Autor](#autor)

---

## Visión general

El backend se organiza como un conjunto de microservicios **independientes y desplegables por
separado**. Cada servicio posee su propio punto de entrada (`index.php`), su propia base de datos y
su propio ciclo de vida, comunicándose con el frontend (cliente Ionic/Angular) exclusivamente
mediante **APIs REST/JSON**.

Todos los servicios comparten el **mismo patrón arquitectónico y las mismas convenciones**, lo que
hace que el conocimiento de uno sea transferible al resto y facilita el mantenimiento del ecosistema.

```
                         ┌──────────────────────────┐
                         │   Frontend (Ionic/Angular)│
                         └────────────┬─────────────┘
                                      │  HTTP / JSON
        ┌──────────────┬─────────────┼─────────────┬──────────────┐
        ▼              ▼             ▼             ▼               ▼
┌──────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐
│ rest_usuario │ │rest_susc. │ │rest_divisas│ │rest_criterio │
│  usuarios /  │ │ planes /  │ │  activos   │ │    Kelly     │
│ autenticación│ │  pagos    │ │financieros │ │ trading/Kelly│
└──────┬───────┘ └─────┬─────┘ └─────┬──────┘ └──────┬───────┘
       ▼               ▼             ▼               ▼
   MySQL DB        MySQL DB    APIs externas      MySQL DB
                              (Binance, Forex…)
```

---

## Microservicios

| Servicio | Dominio | Prefijos de ruta | Persistencia |
|----------|---------|------------------|--------------|
| [`rest_usuario`](rest_usuario/) | Usuarios, personas, roles y autenticación | `/usuario`, `/persona`, `/rol`, `/autenticacion` | MySQL / MariaDB |
| [`rest_suscripcion`](rest_suscripcion/) | Suscripciones, planes y pagos | `/suscripcion`, `/planes` | MySQL / MariaDB |
| [`rest_divisas`](rest_divisas/) | Catálogo de activos financieros (cripto, forex, índices) | `/cripto`, `/forex`, `/indice`, `/sinteticos`, `/otros` | APIs externas (Binance, Frankfurter, FMP) |
| [`rest_criteriokelly`](rest_criteriokelly/) | Cuentas de capital, bitácora, comentarios y cálculo del Criterio de Kelly | `/cuentas`, `/bitacora`, `/comentarios`, `/criterioKelly` | MySQL / MariaDB |

> Cada microservicio dispone de su propio `README.md` con el detalle completo de endpoints, payloads
> y esquema de base de datos. Consulte el README del servicio correspondiente.

---

## Stack tecnológico

| Componente       | Tecnología                                  |
|------------------|---------------------------------------------|
| Lenguaje         | PHP 8.x (nativo, sin framework)             |
| Base de datos    | MySQL 5.7+ / MariaDB 10.x                   |
| Acceso a datos   | `mysqli` con sentencias preparadas          |
| Servidor web     | Apache 2.4+ (`mod_rewrite`, `mod_headers`, `mod_deflate`) |
| Formato de datos | JSON (UTF‑8)                                |
| Estilo de API    | REST                                        |

---

## Arquitectura

Todos los microservicios siguen el mismo patrón **por capas (layered / MVC de servicio)** con un
**Front Controller** como único punto de entrada:

```
Cliente HTTP
    │
    ▼
index.php ──────────► Front Controller
    │                 (CORS, preflight OPTIONS, ruteo por prefijo de URI)
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
MySQL / MariaDB   ·   APIs externas (según servicio)
```

### Responsabilidades por capa

- **Front Controller (`index.php`)**: punto único de entrada. Configura CORS/headers, maneja las
  peticiones `OPTIONS` (preflight) y despacha la petición al archivo de ruta según el prefijo de la URI.
- **Rutas (`rutas/`)**: reciben la petición, identifican la **acción** y el **método HTTP**, validan
  que el payload sea JSON válido y delegan al controlador correspondiente.
- **Controladores (`controladores/`)**: contienen la lógica de aplicación. Validan datos requeridos,
  sanean la entrada, orquestan la llamada al modelo y construyen la respuesta HTTP. Todos extienden
  de `BaseCtrl`.
- **Modelos (`modelos/`)**: encapsulan el acceso a datos mediante la clase `Enlace`. No contienen
  lógica de presentación.
- **Configuración (`configuracion/`)**: credenciales, conexión a base de datos y políticas CORS.

---

## Estructura del monorepo

```
back criterio kelly/
├── README.md                     # Este documento (visión global del backend)
│
├── rest_usuario/                 # Microservicio de usuarios y autenticación
├── rest_suscripcion/             # Microservicio de suscripciones, planes y pagos
├── rest_divisas/                 # Microservicio de activos financieros
└── rest_criteriokelly/           # Microservicio de trading / Criterio de Kelly
```

Cada microservicio comparte la misma estructura interna:

```
rest_<servicio>/
├── index.php                     # Front Controller / punto de entrada
├── .htaccess                     # Rewrite, CORS, headers de seguridad, gzip
├── configuracion/
│   ├── global.php                # Constantes de conexión (DB_HOST, DB_NAME, ...)
│   ├── enlace.php                # Clase Enlace: conexión y ejecución de consultas
│   └── CorsConfig.php            # Configuración centralizada de CORS/headers
├── controladores/
│   ├── BaseCtrl.php              # Clase base: validación, saneamiento, respuestas JSON
│   └── *Ctrl.php                 # Un controlador por dominio
├── modelos/
│   └── *Mdl.php                  # Un modelo por dominio
├── rutas/
│   └── *Rts.php                  # Una ruta por dominio
└── anexos/                       # Esquemas SQL y procedimientos almacenados
```

---

## Requisitos previos

- **PHP 8.0+** con las extensiones `mysqli`, `mbstring` y `curl` habilitadas.
- **MySQL 5.7+ / MariaDB 10.x**.
- **Apache 2.4+** con los módulos `mod_rewrite`, `mod_headers` y `mod_deflate` activos.
- Servidor local de desarrollo (XAMPP, WAMP, Laragon o Apache + PHP nativos).

---

## Instalación y configuración

1. **Clonar los microservicios** dentro del `DocumentRoot` del servidor (por ejemplo, `htdocs/`).
   Cada servicio se despliega en su propia carpeta:

   ```bash
   cd /var/www/html      # o htdocs/ en XAMPP
   git clone <url> rest_usuario
   git clone <url> rest_suscripcion
   git clone <url> rest_divisas
   git clone <url> rest_criteriokelly
   ```

2. **Crear e importar las bases de datos** de cada servicio que use persistencia local, desde su
   carpeta `anexos/`:

   ```bash
   mysql -u root -p sist_<servicio> < rest_<servicio>/anexos/<esquema>.sql
   ```

3. **Configurar las credenciales** en `configuracion/global.php` de cada servicio:

   ```php
   define("DB_HOST", "localhost");
   define("DB_NAME", "sist_<servicio>");
   define("DB_USERNAME", "root");
   define("DB_PASSWORD", "");        // establecer contraseña en producción
   define("DB_ENCODE", "utf8");
   ```

   > **Recomendación (producción):** no versionar credenciales reales. Externalícelas a variables de
   > entorno o a un archivo `.env` ignorado por Git.

4. **Verificar el origen CORS permitido** en el `.htaccess` de cada servicio. Por defecto se
   configura para el frontend en `http://localhost:8100` (cliente Ionic/Angular). Ajústelo según el
   consumidor real.

Para el detalle específico de cada servicio, consulte su propio `README.md`.

---

## Ejecución

Con Apache apuntando a los proyectos, cada microservicio queda disponible en su propia URI base:

```
http://localhost/rest_usuario/
http://localhost/rest_suscripcion/
http://localhost/rest_divisas/
http://localhost/rest_criteriokelly/
```

**Health check** de cualquier servicio (GET al prefijo sin acción):

```bash
curl http://localhost/rest_criteriokelly/cuentas
# { "status": "ok", "version": "1.0.0", "service": "CuentasRTs", ... }
```

---

## Formato de respuestas

Todas las respuestas son **JSON con UTF‑8** (`JSON_UNESCAPED_UNICODE`) y usan códigos de estado HTTP
semánticos, de forma homogénea en todos los microservicios.

**Error:**

```json
{ "error": "El campo 'cue_nombre' es requerido" }
```

**Códigos HTTP utilizados:**

| Código | Significado                                    |
|--------|------------------------------------------------|
| 200    | Operación exitosa                              |
| 400    | Petición inválida (validación / JSON inválido) |
| 404    | Recurso o endpoint no encontrado               |
| 405    | Método HTTP no permitido                       |
| 500    | Error interno del servidor                     |

---

## Estándares y convenciones de desarrollo

El backend adopta buenas prácticas de desarrollo backend orientado a **microservicios** en PHP,
aplicadas de forma **consistente entre todos los servicios**.

### Principios de microservicios

- **Un dominio, un servicio:** cada microservicio tiene una única responsabilidad de negocio y es
  desplegable de forma independiente.
- **Autonomía / *stateless*:** los servicios no comparten estado en memoria; cada uno gestiona su
  propia base de datos (patrón *database per service*).
- **Contrato explícito:** la comunicación entre frontend y servicios se realiza solo vía API
  REST/JSON, sin acoplamiento a estructuras internas.
- **Bajo acoplamiento, alta cohesión:** cada entidad tiene su tripleta ruta + controlador + modelo.

### Convenciones de código

- **Idioma:** dominio de negocio, nombres de clases, métodos y comentarios en **español**, de forma
  consistente en todo el proyecto.
- **Nomenclatura por capa (sufijos):**
  - Rutas → `*Rts.php` (ej. `UsuarioRts.php`)
  - Controladores → `*Ctrl.php` (ej. `UsuarioCtrl.php`)
  - Modelos → `*Mdl.php` (ej. `UsuarioMdl.php`)
- **Clases:** `PascalCase`. **Métodos y variables:** `camelCase`.
- **Estándar de estilo:** se recomienda **PSR‑12** (formato de código), **PSR‑4** (autoloading) y
  **PSR‑1** (convenciones básicas) para nuevas incorporaciones.

### Principios de diseño

- **Separación de responsabilidades (SoC):** presentación (ruta), aplicación (controlador) y
  persistencia (modelo) claramente separadas.
- **DRY:** la lógica transversal vive en clases base (`BaseCtrl`) y utilitarias (`Enlace`, `CorsConfig`).
- **Front Controller:** un único punto de entrada por servicio centraliza el ruteo y las políticas
  transversales.
- **Fail fast:** validación temprana de entrada (JSON, campos requeridos, tipos) antes de tocar la
  base de datos.

### Manejo de errores y logging

- Toda operación de acceso a datos y de negocio se envuelve en bloques `try/catch`.
- Los errores internos se registran con `error_log()` y **nunca** se exponen detalles sensibles al
  cliente (mensaje genérico con código `500`).

### Validación y saneamiento

- Validación de campos requeridos y de tipos mediante `BaseCtrl::validarDatos()`.
- Saneamiento de entradas con `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')` y `Enlace::limpiarCadena()`.
- Validaciones específicas de negocio (rangos, formatos, longitudes) en el controlador.

### Recomendaciones para evolución (deuda técnica sugerida)

- Externalizar credenciales a variables de entorno / `.env` (no versionar secretos).
- Incorporar **Composer** con autoloading **PSR‑4** para eliminar los `require_once` manuales.
- Añadir autenticación por **token/JWT** en un middleware previo al ruteo (centralizado en
  `rest_usuario`).
- Agregar pruebas automatizadas (**PHPUnit**) y análisis estático (**PHPStan** / **Psalm**).
- Estandarizar el *envelope* de respuesta (`estado`, `mensaje`, `fecha`, `dato`) en todos los servicios.
- Considerar un **API Gateway** que unifique el enrutamiento y las políticas transversales.

---

## Seguridad

Configurada de forma centralizada en el `.htaccess` y `CorsConfig.php` de cada servicio:

- **CORS** restringido a un origen específico (`http://localhost:8100` por defecto).
- **Sentencias preparadas** (`mysqli` con `bind_param`) en todo el acceso a datos → previene
  inyección SQL.
- **Headers de seguridad:** `X-XSS-Protection`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy` y `Content-Security-Policy`.
- **Ocultamiento de metadatos** del servidor (`Server`, `X-Powered-By`) y `Options -Indexes`.
- **Manejo de preflight** `OPTIONS` centralizado.

---

## Cómo agregar un nuevo microservicio

Para incorporar un nuevo servicio (por ejemplo, `rest_reportes`):

1. **Crear la carpeta** `rest_reportes/` replicando la estructura estándar (`configuracion/`,
   `controladores/`, `modelos/`, `rutas/`, `index.php`, `.htaccess`).
2. **Configuración** — copiar y ajustar `global.php`, `enlace.php` y `CorsConfig.php`.
3. **Definir dominios** — por cada entidad, crear su tripleta: `modelos/XxxMdl.php`,
   `controladores/XxxCtrl.php` (extiende `BaseCtrl`) y `rutas/XxxRts.php`.
4. **Registrar los prefijos** en el mapa de rutas de `index.php`.
5. **Documentar** — añadir el `README.md` del servicio y su fila en la tabla
   [Microservicios](#microservicios) de este documento.

Respete los sufijos (`*Rts`, `*Ctrl`, `*Mdl`) y el patrón de capas existente para mantener la
consistencia del ecosistema.

---

## Autor

**CRIP‑Tecnología** — [criptecnologia.com](https://criptecnologia.com/)
