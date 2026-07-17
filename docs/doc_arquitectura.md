# Guía de Arquitectura — Backend Criterio Kelly

> Documento canónico de arquitectura para agentes y personas que trabajen en este repositorio.
> Fuente base: `CLAUDE.md` (raíz) + estructura real del código. Este documento no inventa nada:
> todo lo aquí descrito está verificado contra los archivos del repositorio a la fecha de escritura.

---

## 1. Propósito

Este documento es la **guía de decisión** para cualquier agente que modifique este backend. Resuelve,
sin tener que releer todo el código, preguntas como:

- **¿Dónde va un archivo nuevo?** → ver §2 (Estructura del Proyecto) y §5 (Reglas de Ubicación).
- **¿Cómo se estructura un módulo/endpoint nuevo?** → ver §3 (Flujos) y §4 (Responsabilidades por Capa).
- **¿Qué contratos no puedo romper?** → ver §7 (Contratos de API) y §8 (Manejo de Errores).
- **¿Qué está prohibido introducir?** → ver §10 (Anti-patrones).

Ámbito: los **cuatro microservicios** REST en PHP nativo (`rest_usuario`, `rest_suscripcion`,
`rest_criteriokelly`, `rest_divisas`). Cada carpeta `rest_*` es un servicio autónomo, desplegable por
separado y con su propio repositorio Git; **no hay raíz Git ni tooling compartido**. Trabaja siempre
dentro del servicio afectado.

**Documentos relacionados a los que remite esta guía:**

- `CLAUDE.md` (raíz) — instrucciones operativas y de estilo para agentes; **tiene precedencia** sobre
  este documento si hay conflicto.
- `README.md` (raíz) y `rest_*/README.md` — descripción funcional por servicio.
- `rest_criteriokelly/anexos/procedimientos.sql`, `rest_criteriokelly/anexos/sist_criteriokelly.sql` —
  esquema y procedimientos almacenados de Criterio Kelly.
- `rest_suscripcion/anexos/Procedimientos NuevaSuscripcion.sql`,
  `rest_suscripcion/anexos/Procedimientos RenovacionAutomatica.sql`,
  `rest_suscripcion/anexos/sist_suscripcion.sql` — esquema y lógica de suscripción.
- `rest_usuario/anexos/sist_generico.sql` — esquema de usuarios/personas/roles.
- `rest_*/rutas.txt` (donde exista) — inventario de rutas del servicio.

---

## 2. Estructura del Proyecto

### 2.1 Layout de la raíz

```
back criterio kelly/
├── CLAUDE.md                # Instrucciones para agentes (precedencia máxima)
├── README.md                # Descripción general del backend
├── docs/
│   └── doc_arquitectura.md  # ESTE documento
├── rest_usuario/            # Microservicio: usuarios, personas, roles, autenticación
├── rest_suscripcion/        # Microservicio: suscripciones, planes, pagos
├── rest_criteriokelly/      # Microservicio: cuentas/capital, bitácora, comentarios, cálculo Kelly
└── rest_divisas/            # Microservicio: catálogo de activos (SIN BD, cURL a APIs externas)
```

### 2.2 Layout interno de un servicio (idéntico en los 4)

```
rest_<servicio>/
├── index.php                # Front Controller: CORS, OPTIONS, match de prefijo → require del Rts
├── .htaccess                # Rewrite, CORS, headers de seguridad, bloqueo de carpetas internas
├── README.md                # Doc funcional del servicio
├── rutas.txt                # (algunos servicios) inventario de rutas
├── configuracion/
│   ├── global.php           # Constantes de BD y proyecto (DB_HOST, DB_NAME, ...) — HARDCODEADAS
│   ├── enlace.php           # Clase Enlace (wrapper mysqli con sentencias preparadas)
│   └── CorsConfig.php       # CorsConfig::configurar() y ::manejarPreflight()
├── rutas/
│   └── XxxRts.php           # Despacho por método HTTP + parseo de acción + validación de JSON
├── controladores/
│   ├── BaseCtrl.php         # Clase base abstracta: validación, saneamiento, respuestas JSON
│   └── XxxCtrl.php          # Validación de negocio, saneamiento, armado de respuesta
├── modelos/
│   └── XxxMdl.php           # SQL con sentencias preparadas vía Enlace (NO en rest_divisas)
└── anexos/
    └── *.sql / *.PNG        # Esquemas, procedimientos almacenados, diagramas
```

### 2.3 Responsabilidad de cada carpeta (fuente de verdad para ubicar archivos)

| Carpeta | Responsabilidad | Contiene |
|---------|-----------------|----------|
| `configuracion/` | Configuración e infraestructura de acceso a datos | `global.php`, `enlace.php`, `CorsConfig.php` |
| `rutas/` | Capa de **transporte**: mapea HTTP → acción → método del controlador | `XxxRts.php` |
| `controladores/` | Capa de **aplicación/negocio**: valida, sanea, orquesta, arma respuesta | `BaseCtrl.php`, `XxxCtrl.php` |
| `modelos/` | Capa de **datos**: SQL parametrizado vía `Enlace` | `XxxMdl.php` |
| `anexos/` | Artefactos de BD (no se cargan en runtime): esquema, procedimientos, diagramas | `*.sql`, `*.PNG` |
| `logs/` | Log de errores PHP (`logs/php_errors.log`), creado por Apache/PHP en runtime | (no versionado) |

> **Nota `rest_divisas`:** no tiene modelos con BD. Sus controladores (`CriptoCtrl`, `ForexCtrl`,
> `IndiceCtrl`) hacen `cURL` directo a APIs externas (Binance, Frankfurter, Financial Modeling Prep).
> La carpeta `modelos/` existe pero está vacía de lógica de BD. Ver §4.6.

### 2.4 Dominios registrados por servicio (prefijo → tripleta)

| Servicio | Prefijos en `index.php` | Tripletas presentes |
|----------|-------------------------|---------------------|
| `rest_usuario` | `/persona`, `/usuario`, `/rol`, `/autenticacion` | `PersonaRts/Ctrl/Mdl`, `UsuarioRts`, `RolRts`, `ValidacionRts/Ctrl/Mdl` (autenticación), `CategoriaRts/Ctrl/Mdl` |
| `rest_suscripcion` | `/planes`, `/suscripcion` | `PlanesRts/Ctrl/Mdl`, `SuscripcionRts/Ctrl/Mdl`, `PagosCtrl/Mdl` |
| `rest_criteriokelly` | `/cuentas`, `/bitacora`, `/comentarios`, `/criterioKelly` | `CuentasRts/Ctrl/Mdl`, `BitacoraRts/Ctrl/Mdl`, `ComentariosRts/Ctrl/Mdl`, `CriterioKellyRts/Ctrl/Mdl`, `ReglasKellyCtrl/Mdl` |
| `rest_divisas` | `/cripto`, `/forex`, `/indice`, `/sinteticos`, `/otros` | `CriptoRts/Ctrl`, `ForexRts/Ctrl`, `IndiceRts/Ctrl` (sin `Mdl`) |

> `/autenticacion` se mapea a `ValidacionRts.php`. Los prefijos `/sinteticos` y `/otros` de divisas
> apuntan a `rutas/MarketsRts.php`, archivo que puede no existir aún (el `index.php` los declara).

---

## 3. Flujos Principales

Todos los servicios comparten el mismo recorrido de una petición (dos niveles de enrutamiento). El
punto de entrada exacto siempre es `rest_<servicio>/index.php`.

### 3.0 Flujo genérico de una petición

```
Cliente (SPA Ionic/Angular)
  → Apache + .htaccess (rewrite a index.php, CORS, headers de seguridad)
    → index.php                       [Front Controller]
        · CorsConfig::configurar()
        · CorsConfig::manejarPreflight()   (OPTIONS → 200 y exit)
        · match del prefijo como substring de la URI (strpos) → require rutas/XxxRts.php
      → rutas/XxxRts.php              [Transporte]
          · switch ($_SERVER['REQUEST_METHOD'])
          · extrae la ACCIÓN = segmento de URI tras el prefijo (/cuentas/nueva → 'nueva')
          · en POST/PUT/DELETE: lee php://input, json_decode, valida JSON
          · instancia XxxCtrl y llama al método público mapeado
        → controladores/XxxCtrl.php   [Aplicación/Negocio, extends BaseCtrl]
            · validarDatos() campos requeridos
            · limpiarDatos() saneamiento
            · validaciones de rango/formato
            · llama al modelo
          → modelos/XxxMdl.php        [Datos]
              · SQL con sentencias preparadas vía Enlace
            → configuracion/enlace.php [Enlace = mysqli]
        ← respuesta JSON via BaseCtrl (respuestaExitosaSimple / respuestaErrorSimple), con exit
```

**Añadir un endpoint** = añadir un `case` en el `Rts` + un método público en el `Ctrl` + un método en
el `Mdl`. **Añadir un dominio** = crear la tripleta `Rts/Ctrl/Mdl` + registrar el prefijo en
`index.php`.

### 3.1 Autenticación de usuario (login) — `rest_usuario`

- **Entrada:** `POST /autenticacion/autenticar` (prefijo `/autenticacion` → `rutas/ValidacionRts.php`).
- **Controlador:** `ValidacionCtrl::autenticarUsuario($data)`
  ([rest_usuario/controladores/ValidacionCtrl.php:15](../rest_usuario/controladores/ValidacionCtrl.php#L15)).
- **Flujo:** valida `usuario` y `clave` → `ValidacionMdl::autenticarUsuario()` verifica con
  `password_verify(...)` contra el hash BCRYPT almacenado
  ([rest_usuario/modelos/ValidacionMdl.php:23](../rest_usuario/modelos/ValidacionMdl.php#L23)).
- **Salida (éxito):** `{ "id", "nombres", "apellidos" }` con HTTP 200.
- **Salida (fallo):** `{ "error": "Credenciales inválidas" }` con HTTP 401.

> **Pendiente de estándar (ver `CLAUDE.md`):** hoy el login NO emite JWT. El estándar objetivo es que
> `rest_usuario` emita un JWT HS256 y todos los servicios lo validen en un middleware previo al ruteo
> en `index.php`. No romper este flujo sin coordinar con esa migración.

### 3.2 Alta de cuenta con capital inicial — `rest_criteriokelly`

- **Entrada:** `POST /cuentas/nueva` → `rutas/CuentasRts.php` (case `'nueva'`).
- **Controlador:** `CuentasCtrl::agregarCuenta($data)`
  ([rest_criteriokelly/controladores/CuentasCtrl.php:15](../rest_criteriokelly/controladores/CuentasCtrl.php#L15)).
- **Flujo:** valida `cue_nombre`, `cue_usuarioId`, `fecha_valor`, `valor_cuenta` → `CuentasMdl::agregarCuenta()`
  inserta en `sckc_cuentas` y luego en `sckc_capital` (movimiento inicial tipo `'D'`); si falla el
  segundo INSERT, revierte el primero con `eliminarCuentaError()`
  ([rest_criteriokelly/modelos/CuentasMdl.php:14](../rest_criteriokelly/modelos/CuentasMdl.php#L14)).
- **Salida:** eco de los datos de la cuenta creada (HTTP 200).

### 3.3 Consulta de cuentas de un usuario — `rest_criteriokelly`

- **Entrada:** `GET /cuentas/obtener?id=<idUsuario>` → `rutas/CuentasRts.php` (case `'obtener'`).
- **Flujo:** el `Rts` valida que `id` sea entero positivo → `CuentasCtrl::obtenerCuentasPorUsuario()`
  → `CuentasMdl::obtenerCuentasPorUsuario()` devuelve el capital vigente (última fecha) por cuenta
  activa (`cue_estado = '1'`).
- **Salida:** arreglo de cuentas con `cap_idCapital`, `cue_idCuentas`, `cue_nombre`, `valor_cuenta`,
  `cue_usuarioId`, `fecha_valor`.

### 3.4 Cálculo / lectura del Criterio de Kelly — `rest_criteriokelly`

- **Entrada:** prefijo `/criterioKelly` → `rutas/CriterioKellyRts.php`.
- **Controlador:** `CriterioKellyCtrl`
  ([rest_criteriokelly/controladores/CriterioKellyCtrl.php](../rest_criteriokelly/controladores/CriterioKellyCtrl.php)).
- **Flujo:** métodos como `obtenerPorcentajeKellyIdCuenta`, `obtenerResultadoPorIdentificador`,
  `obtenerOperacionesParaAnalisis`, `obtenerObservacionesParaAnalisis` consultan las tablas
  `sckp_criteriokelly`, `sckr_resultado`, `sckr_rentabilidad`, `sckb_bitacora`, `scko_observacion`.
  Parte de la lógica de Kelly vive en **procedimientos almacenados** (`anexos/procedimientos.sql`).
- **Salida:** arreglos de resultados con claves normalizadas (ver §7).

### 3.5 Catálogo de activos externos — `rest_divisas`

- **Entrada:** `GET /cripto` (o `/forex`, `/indice`) → `rutas/CriptoRts.php` etc.
- **Controlador:** `CriptoCtrl::getCryptos()` hace `cURL` a `https://api.binance.com/api/v3/ticker/24hr`
  ([rest_divisas/controladores/CriptoCtrl.php:10](../rest_divisas/controladores/CriptoCtrl.php#L10)),
  filtra pares USDT/BUSD y normaliza a `{ symbol, name, price, type }`.
- **Sin capa de modelo ni BD.** La "persistencia" es la API remota.

---

## 4. Responsabilidades por Capa

Regla general: **cada capa solo habla con la inmediata inferior**. La lógica de negocio no baja al
transporte; el SQL no sube al controlador.

### 4.1 Front Controller — `index.php`

| Puede | NO puede |
|-------|----------|
| Configurar CORS/headers (`CorsConfig`) | Contener validación de negocio |
| Responder preflight `OPTIONS` | Ejecutar SQL o instanciar modelos |
| Matchear prefijo de URI y `require` del `Rts` | Armar respuestas de dominio (delega en el `Rts`/`Ctrl`) |
| Devolver 404 si ningún prefijo coincide | Conocer campos de negocio |

### 4.2 Capa de Transporte — `rutas/XxxRts.php`

| Puede | NO puede |
|-------|----------|
| `switch` por método HTTP; devolver 405 si no aplica | Ejecutar SQL o instanciar modelos |
| Extraer la acción de la URI | Contener reglas de negocio (rangos, cálculos, permisos) |
| Leer `php://input`, `json_decode` y validar que el JSON sea válido/no vacío (400) | Sanear/persistir datos de dominio |
| Validaciones sintácticas mínimas del transporte (p. ej. `id` numérico en query) | Armar la respuesta final de negocio (la arma el `Ctrl` vía `BaseCtrl`) |
| Instanciar el `Ctrl` y llamar al método mapeado | Acceder a `Enlace` directamente |

### 4.3 Capa de Aplicación/Negocio — `controladores/XxxCtrl.php` (extends `BaseCtrl`)

| Puede | NO puede |
|-------|----------|
| Validar campos requeridos (`validarDatos`) | Escribir SQL o usar `mysqli`/`Enlace` directamente |
| Sanear entrada (`limpiarDatos`, `htmlspecialchars`) | Enviar `echo`/`header` fuera de los helpers de `BaseCtrl` |
| Validar rangos, formatos, tipos, reglas de negocio | Parsear la URI o el método HTTP (eso es del `Rts`) |
| Convertir tipos (`(int)`, `(float)`) y normalizar la salida | Filtrar mensajes crudos de excepción al cliente (ver §8) |
| Orquestar uno o varios métodos del `Mdl` | Depender de detalles de esquema más allá de lo que expone el `Mdl` |
| Responder con `respuestaExitosaSimple` / `respuestaErrorSimple` | |

### 4.4 Capa de Datos — `modelos/XxxMdl.php`

| Puede | NO puede |
|-------|----------|
| Definir y ejecutar SQL con **sentencias preparadas** vía `Enlace` | Validar reglas de negocio o formatos de entrada |
| Instanciar `new Enlace()` y usar sus métodos | Armar respuestas HTTP / hacer `echo` / setear `http_response_code` |
| Invocar procedimientos almacenados | Sanear con `htmlspecialchars` (eso es del `Ctrl`) |
| Hacer eliminaciones lógicas (`estado = '0'`) | Escribir mysqli crudo sin `Enlace` |
| Devolver `mysqli_result`, array asociativo, `insert_id` o filas afectadas | Devolver HTML o texto para el cliente |

### 4.5 Infraestructura — `configuracion/`

- `enlace.php` (`Enlace`): **única** puerta a la BD. Métodos: `ejecutarConsulta`,
  `ejecutarConsultaSimpleFila`, `ejecutarConsultaRetornarID`, `ejecutarInsercionRetornaID`,
  `ejecutarActualizacion`, más `limpiarCadena`, `cerrarConexion`. Toda consulta usa `bind_param`.
- `global.php`: constantes `DB_HOST`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `DB_ENCODE`,
  `PRO_NOMBRE`.
- `CorsConfig.php`: `configurar()` (headers) y `manejarPreflight()` (OPTIONS → 200).

### 4.6 Excepción: `rest_divisas`

En divisas, el **controlador** hace `cURL` a la API externa y normaliza el resultado (no hay `Mdl`
ni `Enlace` en el flujo). Sigue extendiendo `BaseCtrl` para las respuestas. Si en el futuro se añade
BD/caché, la lógica de acceso debe bajar a un `Mdl`, no quedarse en el `Ctrl`.

---

## 5. Reglas de Ubicación de Archivos

Guía de decisión: **tipo de código → carpeta destino (con justificación)**. Todo dentro del
`rest_<servicio>` correspondiente.

| Tipo de código nuevo | Va en | Justificación |
|----------------------|-------|---------------|
| Nuevo endpoint de un dominio existente | `case` en `rutas/XxxRts.php` + método en `controladores/XxxCtrl.php` + método en `modelos/XxxMdl.php` | Un endpoint atraviesa las tres capas; cada pieza en su capa |
| Nuevo dominio completo | Tripleta `rutas/XxxRts.php` + `controladores/XxxCtrl.php` + `modelos/XxxMdl.php` + prefijo en `index.php` | Convención de tripleta por dominio + registro de ruta |
| Despacho HTTP / parseo de acción / validación de JSON de entrada | `rutas/XxxRts.php` | Es transporte (§4.2) |
| Validación de negocio, rangos, formatos, saneamiento | `controladores/XxxCtrl.php` | Es aplicación/negocio (§4.3) |
| Validación/saneamiento reutilizable entre controladores | Método `protected` en `controladores/BaseCtrl.php` | Ya centraliza `validarDatos`/`limpiarDatos` |
| SQL nuevo / consulta / inserción / actualización | `modelos/XxxMdl.php` | Es la única capa que toca datos (§4.4) |
| Lógica de datos compleja/transaccional en BD | Procedimiento almacenado en `anexos/*.sql`, invocado desde el `Mdl` | Patrón existente en criteriokelly/suscripcion |
| Método de acceso genérico a BD (nuevo tipo de consulta) | `configuracion/enlace.php` (clase `Enlace`) | Único wrapper de mysqli |
| Constante de configuración/credencial | `configuracion/global.php` | Configuración centralizada (objetivo: mover a `.env`, ver §9) |
| Ajuste de CORS/headers en código | `configuracion/CorsConfig.php` (+ `.htaccess` para lo declarativo) | CORS se define en ambos niveles |
| Consumo de API externa (divisas) | `controladores/XxxCtrl.php` con `cURL` | Patrón de `rest_divisas` (§4.6) |
| Esquema/DDL, seeds, diagramas | `anexos/*.sql`, `anexos/*.PNG` | Artefactos de BD, no runtime |

**Regla de rutas relativas:** no hay autoloading. Cada archivo enlaza dependencias con rutas
relativas explícitas (`require_once(__DIR__ . '/../modelos/XxxMdl.php')`,
`include_once(__DIR__ . '/../configuracion/enlace.php')`). Al mover o crear archivos, mantén esas
rutas correctas — es el mecanismo que sustituye a PSR-4/Composer.

---

## 6. Convenciones de Nombres

Dominio y comentarios en **español**. Un dominio = una tripleta con sufijo fijo.

### 6.1 Archivos y clases (ejemplos reales)

| Elemento | Convención | Ejemplo real |
|----------|------------|--------------|
| Ruta | `rutas/XxxRts.php` | `rutas/CuentasRts.php`, `rutas/ValidacionRts.php` |
| Controlador | `controladores/XxxCtrl.php` | `controladores/CuentasCtrl.php`, `controladores/CriterioKellyCtrl.php` |
| Modelo | `modelos/XxxMdl.php` | `modelos/CuentasMdl.php`, `modelos/ValidacionMdl.php` |
| Clase | `PascalCase` (igual al archivo) | `class CuentasCtrl`, `class Enlace`, `class CorsConfig` |
| Métodos y variables | `camelCase` | `agregarCuenta()`, `obtenerCuentasPorUsuario()`, `$datosLimpios` |
| Base abstracta | `BaseCtrl` (todos los `Ctrl` la extienden) | `class CuentasCtrl extends BaseCtrl` |

### 6.2 Acciones de URI (segmento tras el prefijo)

`camelCase`/palabra simple en español: `/cuentas/nueva`, `/cuentas/obtener`, `/cuentas/movCapital`,
`/cuentas/nombre`, `/cuentas/eliminar`, `/autenticacion/autenticar`.

### 6.3 Tablas y columnas

- Prefijo de tabla por servicio/dominio en criteriokelly: `sckc_` (cuentas/capital), `sckp_`
  (criteriokelly), `sckr_` (resultado/rentabilidad), `sckb_` (bitácora), `scko_` (observación).
  Ej.: `sckc_cuentas`, `sckc_capital`, `sckp_criteriokelly`, `sckb_bitacora`.
- Columnas con prefijo del dominio: `cue_nombre`, `cue_idCuentas`, `cap_capital`, `cap_tipoMovimie`,
  `cke_x100Kelly`, `bit_situacion`.
- Estado lógico: columna `*_estado` con `'1'` (activo) / `'0'` (eliminado).

### 6.4 Códigos y "códigos de error"

No existen códigos de error internos tipo string; el "código" es el **HTTP status** más un mensaje en
español. Códigos usados en el repo: **200, 400, 401, 404, 405, 500** (ver §8). Los mensajes de error
se devuelven bajo la clave `error` (`{"error": "..."}`).

---

## 7. Contratos de API y Salida

Estos contratos **no se rompen sin scope explícito** (los consume el SPA Ionic/Angular).

### 7.1 Forma general de la respuesta

- Toda salida es **JSON** con `JSON_UNESCAPED_UNICODE`, `Content-Type: application/json; charset=utf-8`.
- Éxito: el cuerpo es el dato (objeto o arreglo) que arma el controlador; HTTP 200.
  Si el dato es `null`, `respuestaExitosaSimple` devuelve `{"success":"ok"}`.
- Error: `{"error": "<mensaje en español>"}` con el HTTP status correspondiente.
- Health check (GET al prefijo sin acción): `{"status":"ok","timestamp":...,"version":"1.0.0","service":"..."}`.

### 7.2 Campos clave por flujo (preservar nombres y tipos)

**Login** — `POST /autenticacion/autenticar` (`rest_usuario`):
- Éxito 200: `id` (int), `nombres` (string), `apellidos` (string).
- Fallo: 401 `{"error":"Credenciales inválidas"}`.

**Cuentas por usuario** — `GET /cuentas/obtener?id=` (`rest_criteriokelly`), arreglo de:
- `cap_idCapital` (int), `cue_idCuentas` (int), `cue_nombre` (string), `valor_cuenta` (float),
  `cue_usuarioId` (int), `fecha_valor` (string|null).

**Alta de cuenta** — `POST /cuentas/nueva`: requiere `cue_nombre`, `cue_usuarioId`, `fecha_valor`,
`valor_cuenta`; eco de esos campos en la respuesta 200.

**Movimiento de capital** — `POST /cuentas/movCapital`: requiere `cap_usuarioId`, `cap_cueIdCuentas`,
`cap_monto`, `cap_capital`, `cap_tipoMovimie` (`D`=Depósito, `R`=Retiro, `C`=Crédito). Respuesta con
`cap_idCapital` y eco de campos.

**Criterio Kelly** — `POST /criterioKelly/...` (requiere `cke_usuarioId`), arreglos con claves como:
- Porcentaje: `cke_idCritKelly`, `cke_cueIdCuentas`, `cke_usuarioId`, `cke_x100Kelly`,
  `cke_numDivisor`, `cke_x100Operativo`, `cke_montoOperar`, `cke_identifica`.
- Resultado: `res_opeGanador`, `res_x100Ganador`, `res_opePerdedor`, ..., `res_x100Total`,
  `ren_montoTotal`, `res_identifica`.

**Divisas** — `GET /cripto` (`rest_divisas`), arreglo de: `symbol`, `name`, `price`, `type`.

> Al modificar un endpoint, **preserva las claves y los tipos** ya expuestos; añadir campos es
> retrocompatible, renombrar/eliminar/cambiar tipo NO lo es y requiere scope explícito.

---

## 8. Manejo de Errores

### 8.1 Mapa de errores por capa → HTTP

| Origen | Situación | HTTP | Cuerpo |
|--------|-----------|------|--------|
| `index.php` | Prefijo no encontrado | 404 | `{"error":"Endpoint no encontrado", ...}` |
| `index.php` | Archivo de ruta ausente | 500 | `{"error":"Archivo de ruta no encontrado", ...}` |
| `Rts` | Método HTTP no soportado | 405 | `{"error":"Método no permitido", "metodos_permitidos":[...]}` |
| `Rts` | JSON inválido / vacío / acción ausente | 400 | `{"error":"JSON inválido"}` etc. |
| `Ctrl` | Falta campo requerido / rango/formato inválido | 400 | `{"error":"<detalle>"}` |
| `Ctrl` | Autenticación fallida | 401 | `{"error":"Credenciales inválidas"}` |
| `Ctrl` | Recurso inexistente / no pertenece al usuario | 404 | `{"error":"<detalle>"}` |
| `Ctrl` | Excepción interna capturada | 500 | `{"error":"Error interno del servidor"}` (mensaje genérico) |
| `Mdl`/`Enlace` | Error de SQL/conexión | (lanza `Exception`) | La captura el `Ctrl` → 500 |

### 8.2 Reglas

- Los controladores envuelven la lógica en `try/catch`. En el `catch`: **registrar el detalle con
  `error_log()`** y devolver al cliente un **mensaje genérico + 500**. Nunca exponer el mensaje crudo
  de la excepción, el SQL ni datos de conexión.
- `Enlace` registra el error con `error_log()` y **relanza** la excepción hacia arriba; no responde
  HTTP. La respuesta HTTP la produce siempre el controlador vía `BaseCtrl`.
- `display_errors` está **apagado** (`.htaccess`); los errores van a `logs/php_errors.log`.
- **Prohibido filtrar excepciones crudas entre capas hacia el cliente.** Si encuentras código que
  hace `respuestaErrorSimple($e->getMessage(), 500)` (existe hoy, p. ej. en algunos métodos de
  `CriterioKellyCtrl`), es una **desviación del estándar**: al tocarlo, reemplázalo por mensaje
  genérico + `error_log($e->getMessage())`.

---

## 9. Configuración y Entorno

- **Lenguaje:** PHP 8.x nativo, **sin framework**.
- **Gestor de dependencias:** ninguno actualmente (no hay `composer.json`). Sin autoloading: se usan
  `require_once`/`include_once` con rutas relativas. **Objetivo** (ver `CLAUDE.md`): adoptar Composer
  por servicio con autoload PSR-4 y PHPUnit en `require-dev`, migrando `require_once` a autoloading
  conforme se toquen archivos.
- **Extensiones requeridas:** `mysqli`, `mbstring`, `curl`. **Servidor:** Apache 2.4 con `mod_rewrite`,
  `mod_headers`, `mod_deflate`. **BD:** MySQL/MariaDB (excepto `rest_divisas`, que no usa BD).
- **Ejecutar:** colocar la carpeta del servicio en el `DocumentRoot` de Apache (p. ej.
  `htdocs/rest_criteriokelly/`) → disponible en `http://localhost/rest_criteriokelly/`.
- **Health check:** `GET` al prefijo sin acción, p. ej.
  `curl http://localhost/rest_criteriokelly/cuentas`.
- **Configuración centralizada:** `configuracion/global.php` por servicio (credenciales de BD
  **hardcodeadas y versionadas** — patrón actual, no ideal). Constantes: `DB_HOST`, `DB_NAME`,
  `DB_USERNAME`, `DB_PASSWORD`, `DB_ENCODE`, `PRO_NOMBRE`.
- **Cómo agregar una variable de configuración:** definirla como constante `define(...)` en
  `configuracion/global.php` del servicio y consumirla donde corresponda. **Objetivo:** externalizar
  credenciales y el futuro `JWT_SECRET` a variables de entorno / `.env` ignorado por Git, con el
  **mismo `JWT_SECRET` compartido** entre servicios.
- **CORS:** origen permitido `http://localhost:8100` (SPA Ionic/Angular), definido en `.htaccess`
  (declarativo) y complementado por `CorsConfig` (código). En producción, sustituir por el dominio
  real del SPA.
- **`.htaccess` — cuidado al copiar entre servicios:** contiene el **prefijo del servicio
  hardcodeado** (reglas de rewrite, bloqueo de `rutas/`/`modelos/`/`configuracion/`/`controladores/`,
  `ErrorDocument`). Al clonar un servicio como base de otro, actualiza **todas** esas rutas o el ruteo
  se rompe.

---

## 10. Anti-patrones (prohibido introducir)

| # | Prohibido | Capa/Contexto |
|---|-----------|---------------|
| 1 | SQL o `mysqli` directo fuera de `Enlace` | Cualquier capa; el SQL solo va en `modelos/` vía `Enlace` |
| 2 | Consultas concatenando variables (sin `bind_param`) | `modelos/` — riesgo de inyección SQL |
| 3 | Lógica de negocio (rangos, cálculos, permisos, saneamiento) en `rutas/` o `index.php` | Transporte / Front Controller |
| 4 | `echo`, `header()` o `http_response_code()` en `modelos/` | Capa de datos (la respuesta la arma el `Ctrl`/`BaseCtrl`) |
| 5 | Parsear la URI o el método HTTP dentro de un `Ctrl` | Aplicación (eso es del `Rts`) |
| 6 | Devolver mensajes crudos de excepción / SQL / datos de conexión al cliente (`$e->getMessage()` en la respuesta) | `Ctrl` — usar mensaje genérico + `error_log()` (§8) |
| 7 | Eliminaciones físicas donde el patrón es lógico (`estado='0'`) | `modelos/` — salvo rollback interno explícito |
| 8 | Nuevas dependencias con `require`/`include` de rutas relativas incorrectas | Todo el repo (no hay autoloading que las resuelva) |
| 9 | Copiar un `.htaccess` sin actualizar el prefijo hardcodeado del servicio | Configuración Apache |
| 10 | Credenciales o secretos nuevos hardcodeados fuera de `configuracion/global.php` (y, a futuro, versionar el `JWT_SECRET`) | Configuración |
| 11 | Romper claves/tipos de respuesta ya expuestos al SPA sin scope explícito | Contratos de API (§7) |
| 12 | Saltarse `BaseCtrl` para responder (armar JSON/exit a mano en el `Ctrl`) | Aplicación — usar `respuestaExitosaSimple`/`respuestaErrorSimple` |
| 13 | Romper la convención de tripleta / sufijos (`Rts`/`Ctrl`/`Mdl`) o cambiar idioma del dominio a inglés | Nombres (§6) |
| 14 | Introducir un framework, ORM o Composer "a medias" en un solo servicio sin seguir el objetivo común | Todo el servicio |
| 15 | En `rest_divisas`, dejar acceso a datos/caché en el `Ctrl` cuando debería bajar a un `Mdl` | Divisas (§4.6) |

---

_Última actualización basada en la estructura real del repositorio y en `CLAUDE.md`. Si el código y
este documento divergen, corrige el que esté desactualizado y, ante conflicto de instrucciones,
`CLAUDE.md` tiene precedencia._
