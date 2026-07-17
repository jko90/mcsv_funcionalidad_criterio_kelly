# REST Divisas — Microservicio de Activos Financieros

Microservicio en **PHP** que expone una API REST para consultar catálogos de activos
financieros (criptomonedas, pares Forex e índices bursátiles) agregando datos de
proveedores externos (Binance, Frankfurter, Financial Modeling Prep).

Forma parte del ecosistema **Criterio Kelly** de CRIP-Tecnología y sigue una
arquitectura de microservicio autónomo y sin estado (*stateless*), con una única
responsabilidad: **normalizar y servir listados de activos operables**.

---

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Configuración](#configuración)
- [API — Endpoints](#api--endpoints)
- [Contrato de respuesta](#contrato-de-respuesta)
- [Estándares de desarrollo](#estándares-de-desarrollo)
- [Convenciones del proyecto](#convenciones-del-proyecto)
- [Seguridad](#seguridad)
- [Roadmap](#roadmap)

---

## Arquitectura

El servicio implementa un patrón por capas **Ruta → Controlador → Proveedor externo**,
con un enrutador frontal único (*front controller*).

```
Cliente HTTP
     │
     ▼
 index.php               ← Front Controller: CORS, seguridad y ruteo
     │
     ▼
 rutas/*Rts.php          ← Routing: método HTTP + acción, formateo de la respuesta
     │
     ▼
 controladores/*Ctrl.php ← Lógica de negocio (extienden BaseCtrl)
     │
     ▼
 APIs externas           ← Binance / Frankfurter / Financial Modeling Prep
```

**Principios aplicados**

- **Stateless**: cada petición es autónoma; no hay sesión de servidor.
- **Single Responsibility**: un controlador por dominio de activo.
- **Front Controller**: `index.php` centraliza CORS, cabeceras de seguridad y ruteo.
- **DTO uniforme**: todos los endpoints devuelven activos con el mismo esquema
  (`symbol`, `name`, `price`, `type`), desacoplando al cliente del proveedor.
- **Herencia de utilidades**: `BaseCtrl` concentra validación, saneamiento y
  serialización JSON reutilizable.

---

## Requisitos

| Componente        | Versión mínima                                       |
|-------------------|------------------------------------------------------|
| PHP               | 8.0+                                                 |
| Apache            | 2.4+ con `mod_rewrite`, `mod_headers`, `mod_deflate` |
| Extensiones PHP   | `mysqli`, `curl`, `json`                             |
| MySQL / MariaDB   | 5.7+ / 10.4+ (opcional; solo si se persisten datos)  |

> El proyecto no usa Composer actualmente. Las dependencias son extensiones nativas
> de PHP. Ver [Roadmap](#roadmap) para la incorporación de autoload PSR-4.

---

## Estructura del proyecto

```
rest_divisas/
├── index.php                    # Front controller: CORS, seguridad y ruteo
├── .htaccess                    # Reescritura de URL, cabeceras y hardening
├── configuracion/
│   ├── global.php               # Constantes de entorno (BD, nombre del proyecto)
│   ├── enlace.php               # Capa de acceso a datos (mysqli + prepared statements)
│   └── CorsConfig.php           # Cabeceras CORS y de seguridad
├── controladores/
│   ├── BaseCtrl.php             # Clase base: validación, saneamiento y respuestas JSON
│   ├── CriptoCtrl.php           # Criptomonedas (Binance)
│   ├── ForexCtrl.php            # Pares Forex (Frankfurter)
│   └── IndiceCtrl.php           # Índices bursátiles (Financial Modeling Prep)
├── rutas/
│   ├── CriptoRts.php            # Enrutado del dominio cripto
│   ├── ForexRts.php             # Enrutado del dominio forex
│   └── IndiceRts.php            # Enrutado del dominio índices
├── modelos/                     # (reservado para modelos de persistencia)
└── anexos/                      # Recursos auxiliares
```

---

## Instalación y ejecución

### Opción A — Servidor embebido de PHP (desarrollo)

```bash
# Desde la raíz del proyecto
php -S localhost:8080

# Probar
curl http://localhost:8080/cripto/disponible
```

### Opción B — Apache / XAMPP

1. Ubicar el proyecto bajo el `DocumentRoot` (p. ej. `htdocs/rest_divisas`).
2. Asegurar que `mod_rewrite`, `mod_headers` y `mod_deflate` estén activos.
3. Ajustar la configuración en `configuracion/global.php`.
4. Probar:

```bash
curl http://localhost/rest_divisas/cripto/disponible
```

> El `.htaccess` está preparado para la ruta base `/rest_divisas`. Si el servicio se
> despliega en la raíz del dominio, revisar las reglas `RewriteCond`/`RedirectMatch`.

---

## Configuración

Las constantes de entorno viven en [`configuracion/global.php`](configuracion/global.php):

| Constante     | Descripción                          |
|---------------|--------------------------------------|
| `DB_HOST`     | Host de la base de datos             |
| `DB_NAME`     | Nombre de la base de datos           |
| `DB_USERNAME` | Usuario de base de datos             |
| `DB_PASSWORD` | Contraseña del usuario               |
| `DB_ENCODE`   | Codificación de caracteres (`utf8`)  |
| `PRO_NOMBRE`  | Nombre del proyecto                  |

> **Importante:** no se deben versionar credenciales ni claves de API reales.
> Migrar a variables de entorno (`getenv()` / archivo `.env`) es una tarea del
> [Roadmap](#roadmap). El archivo `global.php` ya está protegido en `.htaccess`.

---

## API — Endpoints

Todos los endpoints responden a `GET` y devuelven `application/json; charset=utf-8`.

| Método | Ruta                 | Descripción                                           |
|--------|----------------------|-------------------------------------------------------|
| `GET`  | `/cripto`            | *Health check* del dominio cripto                     |
| `GET`  | `/cripto/disponible` | Lista de criptomonedas (pares USDT/BUSD de Binance)   |
| `GET`  | `/forex`             | *Health check* del dominio forex                      |
| `GET`  | `/forex/disponible`  | Lista de pares Forex (tasas de Frankfurter)           |
| `GET`  | `/indice`            | *Health check* del dominio índices                    |
| `GET`  | `/indice/disponible` | Lista de índices bursátiles (Financial Modeling Prep) |

### Ejemplos

```bash
# Health check
curl http://localhost:8080/cripto

# Listado de criptomonedas disponibles
curl http://localhost:8080/cripto/disponible

# Listado de pares forex
curl http://localhost:8080/forex/disponible

# Listado de índices
curl http://localhost:8080/indice/disponible
```

---

## Contrato de respuesta

### Activo (DTO uniforme)

Cada activo, sin importar el dominio, se normaliza al mismo esquema:

```json
{
  "symbol": "BTCUSDT",
  "name": "BTCUSDT",
  "price": "64250.10000000",
  "type": "crypto"
}
```

| Campo    | Tipo   | Descripción                            |
|----------|--------|----------------------------------------|
| `symbol` | string | Símbolo del activo                     |
| `name`   | string | Nombre legible del activo              |
| `price`  | string | Último precio (string para precisión)  |
| `type`   | string | `crypto` \| `forex` \| `indice`        |

### Health check

```json
{
  "status": "ok",
  "timestamp": "2026-07-17 12:00:00",
  "version": "1.0.0",
  "service": "PlanesRTS"
}
```

### Error

```json
{
  "error": "Error interno del servidor",
  "detalle": "mensaje técnico"
}
```

| Código HTTP | Significado                        |
|-------------|------------------------------------|
| `200`       | Éxito                              |
| `404`       | Endpoint o acción no encontrada    |
| `405`       | Método HTTP no permitido           |
| `500`       | Error interno / fallo de proveedor |

---

## Estándares de desarrollo

Este microservicio se alinea con las buenas prácticas de desarrollo backend en PHP:

- **PSR-1 / PSR-12** — Estilo de código: indentación de 4 espacios, una clase por
  archivo, `<?php` sin etiqueta de cierre `?>` en archivos solo-PHP.
- **PSR-4** *(objetivo)* — Autoload por espacios de nombres (ver Roadmap).
- **REST** — Uso semántico de verbos HTTP y códigos de estado; recursos en las URI.
- **12-Factor App**:
  - *Config en el entorno* (migrar `global.php` a variables de entorno).
  - *Procesos sin estado* (ya cumplido).
  - *Paridad dev/prod* mediante el servidor embebido de PHP.
- **Prepared statements** — Todo acceso a BD usa consultas parametrizadas
  (`mysqli::prepare` + `bind_param`) para prevenir inyección SQL, centralizado en
  [`configuracion/enlace.php`](configuracion/enlace.php).
- **Manejo de errores** — Excepciones capturadas y registradas con `error_log`;
  nunca se exponen trazas internas al cliente en producción (`display_errors Off`).
- **Separación de responsabilidades** — Ruteo, negocio y acceso a datos en capas
  distintas.

---

## Convenciones del proyecto

Para mantener la coherencia del código se respetan las siguientes convenciones:

**Nomenclatura de archivos**

| Tipo          | Sufijo  | Ejemplo          |
|---------------|---------|------------------|
| Controlador   | `*Ctrl` | `CriptoCtrl.php` |
| Ruta          | `*Rts`  | `CriptoRts.php`  |
| Configuración | —       | `CorsConfig.php` |

**Código**

- **Clases**: `PascalCase` (`CriptoCtrl`, `CorsConfig`).
- **Métodos y variables**: `camelCase` (`getCryptos`, `$requestUri`).
- **Constantes**: `UPPER_SNAKE_CASE` (`DB_HOST`, `PRO_NOMBRE`).
- **Idioma**: dominio e interfaz en **español**; los nombres técnicos aceptan inglés
  cuando es el estándar de facto (`getCryptos`, `symbol`, `price`).
- **Controladores** extienden `BaseCtrl` y, siempre que sea posible, delegan la
  serialización en los ayudantes de respuesta (`respuestaExitosaSimple`,
  `respuestaErrorSimple`).
- **Rutas** parsean la URI para obtener la *acción*, validan el método HTTP e invocan
  al controlador; son las responsables de serializar la respuesta final.

**Flujo de una petición**

1. `index.php` aplica CORS/seguridad y mapea el prefijo de la URI a un archivo de ruta.
2. El archivo `*Rts.php` extrae la acción, valida el método HTTP e invoca al controlador.
3. El `*Ctrl.php` ejecuta la lógica (consulta al proveedor externo, normaliza el DTO).
4. La ruta serializa y devuelve el JSON con el código HTTP correspondiente.

---

## Seguridad

Controles implementados a nivel de `.htaccess` y de aplicación:

- **CORS** restringido por origen (`Access-Control-Allow-Origin`).
- **Cabeceras de seguridad**: `X-Content-Type-Options`, `X-Frame-Options`,
  `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy`.
- **Ocultamiento** de `Server` y `X-Powered-By`.
- **Protección de archivos sensibles** (`global.php`, `enlace.php`, `.htaccess`).
- **Bloqueo de acceso directo** a `configuracion/`, `controladores/`, `rutas/`, `modelos/`.
- **Prepared statements** en toda la capa de datos.
- **Saneamiento** de entradas con `htmlspecialchars` (`BaseCtrl::limpiarDatos`).

> ⚠️ Las claves de API embebidas en el código (`IndiceCtrl`) deben moverse a variables
> de entorno antes de un despliegue en producción.

---

## Roadmap

Mejoras sugeridas para elevar la madurez del microservicio:

- [ ] Migrar configuración y secretos a variables de entorno / `.env`.
- [ ] Incorporar **Composer** con autoload **PSR-4** y espacios de nombres.
- [ ] Añadir **caché** (Redis / APCu) para respuestas de proveedores externos.
- [ ] Implementar **paginación** y filtros en los listados.
- [ ] Añadir **rate limiting** y autenticación por API key / JWT.
- [ ] Documentar la API con **OpenAPI / Swagger**.
- [ ] Pruebas automatizadas con **PHPUnit** e integración continua (CI).
- [ ] Contenerizar con **Docker** para paridad dev/prod.
- [ ] Estandarizar el envoltorio de respuesta (`{ data, meta, error }`).

---

© CRIP-Tecnología — Ecosistema Criterio Kelly.
