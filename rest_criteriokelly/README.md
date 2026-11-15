# rest_criteriokelly

Servicio REST en PHP con las **reglas de negocio del Criterio de Kelly** para la aplicación **Criterio Kelly** (`criterioKellyApp`). Gestiona las cuentas de trading y su capital, la bitácora de operaciones, las observaciones de cada operación y el cálculo del porcentaje Kelly y del monto a operar. La app lo consume a través de `environment.apiUrlCritKell`.

**Todo el cálculo de Kelly se hace en este servicio**, no en la app.
> **Correo:** este servicio no envía correo. Si algún día lo necesita, debe seguir la convención del módulo `correo/` descrita en `rest_usuario/correo/README.md` (carpeta `correo/` en la raíz del proyecto, marca `// [CORREO]`, registros en `logs/correos/`).

## Stack

- PHP **8.2** con Composer (MVC propio: `rutas/` → `controladores/` → `modelos/`)
- Dependencia: `vlucas/phpdotenv` (lectura del `.env`)
- MySQL vía `mysqli` con sentencias preparadas (clase `Enlace`, con transacciones)
- Apache (XAMPP) con `mod_rewrite` y `mod_headers`

## Estructura

```
rest_criteriokelly/
├── .env                 # Configuración y secretos locales (no se versiona)
├── .env.ejemplo         # Plantilla del .env (sí se versiona)
├── .htaccess            # CORS, cabeceras de seguridad, reescritura a index.php
├── index.php            # Arranque (RUTA_APLICACION, .env) y enrutador por prefijo de URI
├── composer.json        # Dependencias directas
├── composer.lock        # Versiones fijadas
├── vendor/              # Dependencias instaladas por Composer (no se versiona)
├── configuracion/       # Configuracion.php (.env), enlace.php (Enlace), CorsConfig.php, LectorPlanVigente.php (copia), ControlPlan.php
├── logs/                # Registro de errores del servicio (no se versiona el contenido)
├── rutas/               # CuentasRts, BitacoraRts, ComentariosRts, CriterioKellyRts
├── controladores/       # Un controlador por recurso + ReglasKellyCtrl (cierre de operación y cálculo)
├── modelos/             # SQL; ReglasKellyMdl contiene las fórmulas
├── anexos/
│   ├── sist_criteriokelly_estructura.sql   # Estructura de las tablas (única fuente)
│   ├── sist_criteriokelly_datos.sql        # Sin datos de catálogo: los crea la aplicación
│   ├── procedimientos.sql                  # 2 procedimientos opcionales (no están en la base; ver procedimientos.md)
│   └── procedimientos.md                   # Manual: cómo ejecutar el script y qué dejar en PHP
└── rutas.txt            # Ejemplos de peticiones (desactualizado: son de rest_usuario)
```

## Ambiente local

Pasos J-02 a J-05 de la HU-001 para levantar el servicio en un equipo de desarrollo.

### Requisitos

1. XAMPP con **PHP 8.2 o superior** y las extensiones `mysqli`, `curl`, `openssl` y `mbstring` activas (la misma versión de PHP que el servidor).
2. **Composer 2** instalado (`composer --version` debe responder 2.x).
3. Apache y MySQL de XAMPP en ejecución.

### Pasos

1. Ubica el proyecto en `C:\xampp\htdocs\criterio_kelly\rest_criteriokelly`; el servicio responde en `http://localhost/criterio_kelly/rest_criteriokelly/`.
2. Instala las dependencias:

   ```bash
   cd C:\xampp\htdocs\criterio_kelly\rest_criteriokelly
   composer install
   ```

   Sin `vendor/autoload.php` el servicio responde **500** (el arranque falla al no poder cargar Composer).
3. Importa desde el gestor de base de datos `anexos/sist_criteriokelly_estructura.sql` (y `sist_criteriokelly_datos.sql`, que no inserta nada). Los cambios futuros de la base se entregan como un script de actualización listo para ejecutar desde el gestor de base de datos; después se regeneran estos dos archivos desde la base viva.
4. Crea el usuario MySQL de aplicación con privilegios mínimos (las sentencias son las del README de `rest_usuario`, paso 4).
5. Copia `.env.ejemplo` como `.env` y completa los valores (ver tabla siguiente). `.env` nunca se versiona.
6. Verifica que el servicio responde:

   ```bash
   curl http://localhost/criterio_kelly/rest_criteriokelly/criterioKelly
   ```

7. Pruebas de la app en local (J-03 a J-05): `ionic serve --port=8100` apunta a este backend; aquí no hay envío de correo ni base local.

> La base de datos `sist_criteriokelly` es compartida con `rest_usuario` y `rest_suscripcion`. Los campos `*_usuarioId` corresponden a `usu_idUsuario` de `rest_usuario`.

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

`.htaccess` solo permite CORS desde `http://localhost:8100` (puerto de `ionic serve`); la lista blanca configurable desde el `.env` se aplica en HLT-02.

Desde HLT-03, todas las rutas de negocio son protegidas por la guardia de
`index.php` y requieren `Authorization: Bearer <accessToken>` emitido por
`rest_usuario`. El esquema compartido se aplica con
`rest_usuario/anexos/sist_usuario_estructura.sql`; las clases de seguridad de
`configuracion/` son copias idénticas a las de los otros backends.

### Autorización HLT-04

El usuario de toda operación sale exclusivamente de
`ContextoSesion::idUsuario()`. Los campos `*_usuarioId` y el parámetro `id`
son opcionales durante la transición; si llegan y no coinciden con la sesión,
la respuesta es `403 {"error":"Acceso denegado"}` y se registra
`ACCESO_DENEGADO` en `sgen_auditoria`.

Las cuentas, bitácoras y observaciones se verifican contra el dueño mediante
SQL parametrizado. Un recurso ajeno o inexistente produce el mismo `403`, sin
revelar si el identificador existe. Las cuentas con `cue_estado = '0'` no se
pueden usar. Las escrituras multi-tabla usan una transacción compartida y los
bloqueos siguen el orden cuenta → bitácora → observación. El `422` continúa
reservado al límite de pérdida y confirma el movimiento `Q` antes de responder.

## Límites por plan (HU-005)

El plan vigente sale de `configuracion/LectorPlanVigente.php`, que es una **copia idéntica** del de `rest_suscripcion` (solo lectura; cambiar uno obliga a recopiar el otro y comprobar `sha256sum`). `configuracion/ControlPlan.php` lo consulta una vez por petición con el usuario de la sesión; ningún dato del cuerpo cambia el plan ni los límites.

- **Puerta sin plan** (`index.php`, tras el limitador): con `estado = SIN_PLAN` (incluida `NUNCA_TUVO_PLAN`) solo responden `cuentas/obtener`, `criterioKelly/obtenerPorcentaje` y `criterioKelly/obtenerResultados` (`ControlPlan::RUTAS_SIN_PLAN`). El resto responde `403 {"error":"Tu plan no incluye esta función. Actualiza tu plan"}` y audita `LIMITE_PLAN_RECHAZADO`. Una ruta nueva queda bloqueada por defecto.
- **Tope de cuentas** (`cuentas/nueva`): dentro de la transacción se bloquea `sgen_usuario` (mutex por usuario) y se cuentan las cuentas con `cue_estado = '1'`; si se alcanza `numCuentas`, `403 "Tu plan permite N cuenta(s). Actualiza tu plan para crear más"`. Las cuentas existentes no se tocan.
- **`detalleOperacion`**: solo `bit_fechaFin` de los últimos `diasReporte` días (incluye hoy, UTC).
- **`operacionAnalisis` y `observacionAnalisis`**: aceptan `fechaDesde` y `fechaHasta` (`YYYY-MM-DD`, opcionales; `desde > hasta` es 400 `El rango de fechas es inválido`). El rango se recorta a `diasAnalisis` (terminando en `fechaHasta` o en hoy) y nunca empieza antes de `diasTotalesAnalisis`; se devuelven como máximo `maxOperacionesAnalisis` operaciones por cuenta (las más recientes, en orden de cuenta y fecha). Las observaciones solo son las de esas operaciones. La cota superior solo se aplica si se envía `fechaHasta`.
- **`bitacora/finalizaBitacora`**: si el plan no tiene `divisorEditable`, el divisor es 10 aunque el cliente envíe otro.
- Los recortes no se auditan. El 422 sigue reservado al límite de pérdida.
- **Nota R-03:** `bit_fechaFin` se guarda con la hora local del servidor (Berlín) y los límites se cuentan en días UTC; en el borde del día puede haber un desfase de unas horas.

## Modelo de datos

Prefijos de tabla: `sckc_` cuentas/capital, `sckb_` bitácora, `scko_` observaciones, `sckr_`/`sckt_` estadísticas, `sckp_` Kelly. Cada columna lleva el prefijo corto de su tabla (`cue_`, `cap_`, `bit_`, `obs_`, `res_`, `rib_`, `fat_`, `ren_`, `cke_`), y la app usa esos mismos nombres en sus modelos.

| Tabla | Contenido |
|-------|-----------|
| `sckc_cuentas` | Cuentas de trading del usuario. `cue_estado = '0'` indica una cuenta eliminada. |
| `sckc_capital` | Movimientos de capital por cuenta: `D` depósito, `R` retiro, `C` crédito, `Q` capital quemado (límite de pérdida) |
| `sckb_bitacora` | Operaciones: divisa, `COMPRA`/`VENTA`, precios de entrada/SL/TP, resultado, monto, balance, `bit_situacion` (`O` en operación, `F` finalizada) |
| `scko_observacion` | Comentarios e imágenes de cada operación (`obs_tipoObserva`) |
| `sckr_resultado` | Conteo y % de operaciones ganadoras, perdedoras, break even y abiertas |
| `sckr_riesgobeneficio` | Ganancia y pérdida media, relación ganancia/pérdida, esperanza matemática |
| `sckt_factortotal` | Suma ganada, suma perdida y profit factor |
| `sckr_rentabilidad` | Rentabilidad sobre el capital y monto total resultante |
| `sckp_criteriokelly` | % Kelly, divisor, % operativo y monto a operar |
| `sckr_registrooperat`, `scko_cantoperacion` | Definidas en el esquema; no se usan en el código actual |

Cada vez que se cierra una operación se agrega una fila nueva en cada tabla de estadísticas, y todas comparten el mismo `*_identifica`. Así se guarda la historia del cálculo, y las consultas toman la fila más reciente.

## Cálculo del Criterio de Kelly

Se ejecuta al finalizar una operación (`PUT /bitacora/finalizaBitacora`, en `ReglasKellyCtrl::finalizarOperacionBitacora`):

1. **Límite de pérdida:** toma el balance de la última operación cerrada de la cuenta. Si es `≤ 0`, registra un movimiento `Q` que deja el capital en 0 y responde **422** ("Has llegado al límite de pérdida…"). La app muestra un mensaje específico para este código. Si el monto del resultado supera el balance, se recorta al balance.
2. **Cierre:** guarda el resultado (`GANADOR`/`PERDEDOR`), el monto, si se respetaron las reglas y el nuevo balance.
3. **Resultado** (`sckr_resultado`): `p` = % de operaciones ganadoras sobre el total de la cuenta.
4. **Riesgo/beneficio** (`sckr_riesgobeneficio`): ganancia media, pérdida media y su relación `b`.
5. **Factor total** (`sckt_factortotal`): suma ganada / suma perdida.
6. **Rentabilidad** (`sckr_rentabilidad`): `(ganado − perdido) / capital × 100`, y el monto total (balance ± resultado).
7. **Kelly** (`sckp_criteriokelly`):

```
% Kelly     = (b · p − (1 − p)) / b × 100      (0 si es negativo)
% operativo = % Kelly / divisor                (divisor por defecto 10)
monto       = % operativo × monto total / 100
```

El **divisor** (`cke_numDivisor`) lo envía la app; el usuario lo configura por cuenta en la propia app. Si falla alguno de los pasos 3 a 7, una transacción revierte el cierre y todos los registros de estadísticas de esa llamada. No se hacen reversiones manuales borrando filas.

## Endpoints

URL base: `http://localhost/rest_criteriokelly/`. Los cuerpos se envían como JSON (`Content-Type: application/json`). Cada recurso responde en su raíz (GET sin acción) con un estado de servicio.

### Cuentas — `/cuentas`

| Método | Ruta | Cuerpo / parámetros |
|--------|------|---------------------|
| GET | `/cuentas/obtener` (`id` opcional) | Cuentas activas con su capital actual |
| POST | `/cuentas/nueva` | `{ cue_nombre, fecha_valor, valor_cuenta }`. `cue_usuarioId` es opcional durante la transición. |
| POST | `/cuentas/movCapital` | `{ cap_cueIdCuentas, cap_monto, cap_capital, cap_tipoMovimie }`, con tipo `D`, `R` o `C` |
| PUT | `/cuentas/nombre` | `{ cue_nombre, cue_idCuenta }` |
| DELETE | `/cuentas/eliminar` | Cuerpo `{ cue_idCuenta }`. Baja lógica (`cue_estado = '0'`). |

### Bitácora — `/bitacora`

| Método | Ruta | Cuerpo / parámetros |
|--------|------|---------------------|
| POST | `/bitacora/crear` | `{ bit_cueIdCuentas, bit_divisa, bit_tipoOperaci, bit_fechaCrea?, bit_numeroBitac?, bit_precioEntra?, bit_precioSL?, bit_precioTP?, obs_comentario?, obs_tipoObserva, obs_imagen? }`. Abre la operación y su primera observación. |
| POST | `/bitacora/listBitacora` | `{ bit_cueIdCuentas }`. Operaciones de la cuenta. |
| PUT | `/bitacora/finalizaBitacora` | `{ bit_idbitacora, bit_resultado, bit_situacion, bit_respeReglas, bit_montoResult, bit_cueIdCuentas, cke_numDivisor? }`. Cierra la operación y recalcula Kelly. |
| DELETE | `/bitacora/eliminarBitacora?id={idBitacora}` | Borra **físicamente** la operación y sus observaciones |

Validaciones principales:

- `bit_tipoOperaci` debe ser `COMPRA` o `VENTA`.
- `bit_fechaCrea` usa formato ISO 8601 (`2025-08-01T10:30:00`).
- `bit_divisa` admite hasta 32 caracteres y `obs_comentario` hasta 4096.
- `bit_resultado` debe ser `GANADOR` o `PERDEDOR`, y `bit_respeReglas` debe ser `SI` o `NO`.

### Comentarios — `/comentarios`

| Método | Ruta | Cuerpo / parámetros |
|--------|------|---------------------|
| GET | `/comentarios/observaciones?id={idBitacora}` | Observaciones de una operación |
| POST | `/comentarios/crearComentario` | Un objeto o un arreglo de `{ obs_bitIdbitaco, obs_comentario, obs_tipoObserva, obs_imagen? }` |
| PUT | `/comentarios/comentarioBitacora` | `{ bit_idbitacora, obs_idObserva, bit_precioEntra?, bit_precioSL?, bit_precioTP?, obs_comentario?, obs_imagen? }`. Actualiza los precios de la operación y la observación. |

### Criterio Kelly y reportes — `/criterioKelly` (POST)

Todos aceptan `{}`. `cke_usuarioId` es opcional durante la transición y, si
se envía, debe coincidir con la sesión.

| Ruta | Devuelve |
|------|----------|
| `/criterioKelly/obtenerPorcentaje` | Último cálculo por cuenta: `cke_x100Kelly`, `cke_numDivisor`, `cke_x100Operativo`, `cke_montoOperar`, `cke_cueIdCuentas`… |
| `/criterioKelly/obtenerResultados` | Último resultado por cuenta: conteos y % (`res_*`) y `ren_montoTotal` |
| `/criterioKelly/detalleOperacion` | Detalle de operaciones del usuario (reportes), recortado a `diasReporte` |
| `/criterioKelly/operacionAnalisis` | Operaciones para la pantalla de análisis |
| `/criterioKelly/observacionAnalisis` | Observaciones para la pantalla de análisis |

## Formato de respuestas

El dato se devuelve directamente, sin envoltorio:

```json
// Éxito (200)
[ { "cke_cueIdCuentas": 3, "cke_x100Kelly": 18.5, "cke_numDivisor": 10, "cke_x100Operativo": 1.85, "cke_montoOperar": 18.5 } ]

// Error (400, 404, 422, 500...)
{ "error": "Has llegado al límite de pérdida, recargue la cuenta para seguir intentando" }
```

La app (`errorInterceptor`) muestra el valor de `error` como mensaje al usuario, por eso los mensajes se escriben en español. **No uses 422 para otros errores**: la app lo interpreta como límite de pérdida.

## Agregar un endpoint

1. Agrega el `case` de la acción en el `manejarGet/Post/Put/Delete` del archivo de `rutas/` correspondiente. En `BitacoraRts.php`, el PUT se atiende con `ReglasKellyCtrl` y el resto con `BitacoraCtrl`.
2. Crea el método en el controlador (extiende `BaseCtrl`): `validarDatos`, `limpiarDatos` y responde con `respuestaExitosaSimple` / `respuestaErrorSimple`.
3. Crea el método en el modelo usando `Enlace` con consultas preparadas, por ejemplo `ejecutarConsulta($sql, "ii", $idUsuario, $idCuenta)`.
4. Si es un recurso nuevo, registra su prefijo en el arreglo `$rutas` de `index.php`.

## Estado actual

Problemas conocidos en el código:

- **La relación ganancia/pérdida (`b`) se calcula mal.** En `ReglasKellyMdl::insertarRiesgoBeneficio`, `$montoPierdeSeguro = ($montoPierde <= 0) ? $montoPierde : 1;` tiene la condición invertida. Cuando hay pérdidas, `b` termina siendo la ganancia media en dinero en lugar de ganancia media / pérdida media, y eso altera el % Kelly. Debería ser `($montoPierde > 0) ? $montoPierde : 1`.
- **Las operaciones abiertas cuentan en el total.** Una operación abierta tiene `bit_resultado = NULL`, pero el conteo de abiertas busca `''`. Esas operaciones no se cuentan como abiertas y sí entran en el total, lo que baja el % ganador.
- **`bit_situacion` no se valida bien.** Al finalizar, el controlador acepta `I/E/P/L/F` (son tipos de observación) y el mensaje de error habla de `L/F`, mientras que la columna usa `O`/`F`. Del mismo modo, `obs_tipoObserva` se valida contra `I/O/R` en `crear`, pero la columna documenta `I/E/P/L/F`.
- **No existe `BREAK EVEN` al cerrar.** Las estadísticas cuentan resultados `BREAK EVEN`, pero `finalizaBitacora` solo acepta `GANADOR`/`PERDEDOR`.
- **No hay transacciones.** El cierre de una operación escribe en seis tablas y revierte a mano si algo falla.
- **`rutas.txt` no corresponde a este servicio.** Contiene ejemplos de `rest_usuario`.
