# rest_suscripcion

Servicio REST en PHP para el manejo de **planes, suscripciones y pagos** de la aplicación **Criterio Kelly** (`criterioKellyApp`). La app lo consume a través de `environment.apiUrlSuscripcion`.
> **Correo:** este servicio no envía correo. Si algún día lo necesita, debe seguir la convención del módulo `correo/` descrita en `rest_usuario/correo/README.md` (carpeta `correo/` en la raíz del proyecto, marca `// [CORREO]`, registros en `logs/correos/`).

## Stack

- PHP **8.2** con Composer (MVC propio: `rutas/` → `controladores/` → `modelos/`)
- Dependencia: `vlucas/phpdotenv` (lectura del `.env`)
- MySQL vía `mysqli` con sentencias preparadas (clase `Enlace`, con transacciones)
- Apache (XAMPP) con `mod_rewrite` y `mod_headers`

## Estructura

```
rest_suscripcion/
├── .env                 # Configuración y secretos locales (no se versiona)
├── .env.ejemplo         # Plantilla del .env (sí se versiona)
├── .htaccess            # CORS, cabeceras de seguridad, reescritura a index.php
├── index.php            # Arranque (RUTA_APLICACION, .env) y enrutador por prefijo de URI
├── composer.json        # Dependencias directas
├── composer.lock        # Versiones fijadas
├── vendor/              # Dependencias instaladas por Composer (no se versiona)
├── configuracion/
│   ├── LectorPlanVigente.php # Regla única del plan vigente (solo lectura; se copia a rest_criteriokelly)
│   ├── Configuracion.php     # Carga y valida el .env al arrancar
│   ├── enlace.php            # Clase Enlace (conexión, consultas preparadas, transacciones)
│   └── CorsConfig.php        # Content-Type JSON y manejo del preflight OPTIONS
├── logs/                # Registro de errores del servicio (no se versiona el contenido)
├── rutas/               # PlanesRts.php, SuscripcionRts.php, PagosRts.php, DatosPagoRts.php
├── controladores/       # PlanesCtrl, SuscripcionCtrl, PagosCtrl, DatosPagoCtrl (extienden BaseCtrl)
├── servicios/           # PlanVigenteSrv, PruebaGratuitaSrv, MejoraPlanSrv, ValidadorDatosPago, ProcesadorQrPago
├── modelos/             # PlanesMdl, SuscripcionMdl, PagosMdl, HistorialSuscripcionMdl, DatosPagoMdl
└── anexos/              # Scripts SQL, procedimientos, diagrama del modelo y pruebas/plan_vigente_reloj.php y pruebas/mejora_plan_reloj.php
```

## Ambiente local

Pasos J-02 a J-05 de la HU-001 para levantar el servicio en un equipo de desarrollo.

### Requisitos

1. XAMPP con **PHP 8.2 o superior** y las extensiones `mysqli`, `curl`, `openssl` y `mbstring` activas (la misma versión de PHP que el servidor).
2. **Composer 2** instalado (`composer --version` debe responder 2.x).
3. Apache y MySQL de XAMPP en ejecución.

### Pasos

1. Ubica el proyecto en `C:\xampp\htdocs\criterio_kelly\rest_suscripcion`; el servicio responde en `http://localhost/criterio_kelly/rest_suscripcion/`.
2. Instala las dependencias:

   ```bash
   cd C:\xampp\htdocs\criterio_kelly\rest_suscripcion
   composer install
   ```

   Sin `vendor/autoload.php` el servicio responde **500** (el arranque falla al no poder cargar Composer).
3. Importa desde el gestor de base de datos, en este orden:
   - `anexos/sist_suscripcion_estructura.sql`: tablas `spsu_*` (con las columnas de HU-004 y HU-005 ya incluidas)
   - `anexos/sist_suscripcion_datos.sql`: planes (incluida la Prueba), intervalos y precios por intervalo

   Los cambios futuros de la base se entregan como un script de actualización listo para ejecutar desde el gestor de base de datos; después se regeneran estos dos archivos desde la base viva.
4. Crea el usuario MySQL de aplicación con privilegios mínimos (las sentencias son las del README de `rest_usuario`, paso 4).
5. Copia `.env.ejemplo` como `.env` y completa los valores (ver tabla siguiente). `.env` nunca se versiona.
6. Verifica que el servicio responde:

   ```bash
   curl http://localhost/criterio_kelly/rest_suscripcion/planes
   ```

7. Pruebas de la app en local (J-03 a J-05): `ionic serve --port=8100` apunta a este backend; aquí no hay envío de correo ni base local.

> La base de datos `sist_criteriokelly` es compartida con `rest_usuario`, `rest_criteriokelly` y `rest_divisas`. `sus_usuarioId` corresponde a `usu_idUsuario` de `rest_usuario`.

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

`anexos/` contiene `sist_suscripcion_estructura.sql` y `sist_suscripcion_datos.sql` (la base real), el diagrama `Modelo.PNG`, `sist_suscripcion_CRM.sql` (tablas `crm_*` que ningún endpoint usa) y los procedimientos opcionales `Procedimientos NuevaSuscripcion.sql` (`crear_suscripcion` y `crear_suscripcion_con_pago`, equivalentes a `crearSinPago` y `crearConPago`) y `Procedimientos RenovacionAutomatica.sql` (`procesar_renovaciones`: corte y renovación pendiente de pago, HU-004 DT-15). Están adaptados al esquema `spsu_*` y **no creados en la base**; su manual está en `anexos/procedimientos.md`.

### CORS

El `.htaccess` actual solo permite el origen `http://localhost:8100` (puerto de `ionic serve`). La lista blanca configurable desde `CORS_ORIGENES_WEB` y `CORS_ORIGENES_NATIVOS` se aplica en HLT-02.

HLT-03 protege las rutas de suscripción con `Authorization: Bearer <accessToken>`.
La única ruta pública de negocio es `GET /planes/disponible`; la guardia usa las
tablas compartidas de sesión (`sist_usuario_estructura.sql`) y registra límites y auditoría.

## Modelo de datos

| Tabla | Contenido |
|-------|-----------|
| `spsu_planes` | Planes (Libre, Básico, Premium, Enterprise): precio base, moneda, número de cuentas, días de historial, permisos de descarga |
| `spsu_intervalosuscr` | Intervalos de cobro y su descuento: Mensual (1 mes, 0 %), Trimestral (3, 10 %), Semestral (6, 15 %), Anual (12, 20 %), Bianual (24, 25 %) |
| `spsu_planintervalo` | Combinación plan × intervalo con su `pin_precioFinal`. **Es el "plan" que se suscribe** (`sus_pinIdPlanin`). |
| `spsu_suscripcion` | Suscripción de un usuario: fechas de inicio y fin, referencia de pago, próximo pago |
| `spsu_pagos` | Pagos de una suscripción: monto, método, id de transacción, periodo cubierto, comprobante, correo, criptomoneda |
| `spsu_historialsuscri` | Historial de suscripciones |

En `pla_numCuentas` y `pla_diasTotales`, el valor `-1` significa ilimitado.

### Esquema ampliado (HU-004 y HU-005)

Ya aplicado en la base y reflejado en `anexos/sist_suscripcion_estructura.sql` y `anexos/sist_suscripcion_datos.sql` (no hay scripts de actualización pendientes).

| Objeto | Para qué sirve |
|--------|----------------|
| `spsu_planes.pla_horasDuracion` | Horas que dura el plan. `NULL` en los planes de pago; 24 en la Prueba; 240 en el Libre |
| `spsu_planes.pla_planSiguienteId` | Plan al que pasa la cuenta al terminar. 1 (Libre) en la Prueba; `NULL` en los demás |
| `spsu_suscripcion.sus_fechaHoraFin` | Fin exacto en UTC de los planes con duración en horas |
| `spsu_planes.pla_puedeGraficar` | 1 = puede usar «Graficar operaciones» |
| `spsu_planes.pla_divisorEditable` | 1 = puede cambiar el divisor de Kelly; 0 = fijo en 10 |
| `spsu_planes.pla_maxOperacionesDiarias` | Máximo de operaciones diarias del criterio de Kelly; `NULL` = sin límite |
| Plan 5 «Prueba», intervalo 6 «Prueba (24 horas)», combinación 17 | Acceso completo 24 h, con los límites del Enterprise; no se puede elegir ni comprar |
| Índice `spsu_suscripcion_usuario_idx (sus_usuarioId, sus_situacion)` | Evita que los bloqueos `FOR UPDATE` por usuario recorran toda la tabla |

Límites por plan (cuentas / días de reporte / rango de análisis / gráficas / divisor editable / operaciones diarias):

| Plan | `pla_numCuentas` | `pla_diasHistorial` | `pla_bloqueoDias` | `pla_puedeGraficar` | `pla_divisorEditable` | `pla_maxOperacionesDiarias` |
|------|------------------|---------------------|-------------------|---------------------|-----------------------|-----------------------------|
| 1 Libre | 1 | 8 | 5 | 0 | 0 | 1 |
| 2 Básico | 1 | 15 | 5 | 0 | 0 | 1 |
| 3 Premium | 5 | 30 | 30 | 1 | 1 | 5 |
| 4 Enterprise | 10 | 365 | 30 | 1 | 1 | `NULL` |
| 5 Prueba | 10 | 365 | 30 | 1 | 1 | `NULL` |

`pla_diasTotales`, `pla_puedeDescargar`, `pla_descargaTodos` y `pla_rangoLibre` no cambian. Si la base se cambia en el futuro, se entrega un script listo para ejecutar desde el gestor y después se regeneran los dos archivos de `anexos/`.

Códigos de situación:

| Campo | Valores |
|-------|---------|
| `sus_situacion` | `P` Pendiente (por defecto), `A` Activa, `C` Cancelada, `S` Pausada, `E` Expirada |
| `pag_situacion` | `R` En revisión (por defecto), `C` Completado, `F` Fallido. El comentario de la columna también usa `R` para Reembolsado. |

## Endpoints

URL base: `http://localhost/rest_suscripcion/`. Los cuerpos se envían como JSON (`Content-Type: application/json`).

### Planes — `/planes` (solo GET)

| Ruta | Descripción | Respuesta exitosa |
|------|-------------|-------------------|
| `/planes` | Estado del servicio | `{ status, timestamp, version, service }` |
| `/planes/disponible` | Combinaciones plan × intervalo activas | `[ { pin_idPlanInterv, pin_precioFinal, ins_nombre, ins_numMeses, ins_x100descuen, pla_nombre, pla_descripcion, pla_precioBase, pla_moneda, pla_numCuentas, pla_diasHistorial, pla_diasTotales, pla_bloqueoDias, pla_puedeDescargar, pla_rangoLibre, pla_puedeGraficar, pla_divisorEditable, pla_maxOperacionesDiarias } ]` (sin el plan de prueba) |
| `/planes/suscritos` | Suscripciones pendientes (`P`) del usuario autenticado que aún no tienen referencia de pago | Los campos anteriores más `sis_idSuscrip, sus_fechaCrea, sus_usuarioId, pag_saldo, pag_situacion, pag_montoConfirmado` |

Durante la transición también se acepta `/planes/suscritos/{idUsuario}` si el id coincide
con la sesión; un id diferente responde `403 Acceso denegado`. Si no hay resultados responde
`404`.

### Suscripción — `/suscripcion`

| Método | Ruta | Cuerpo / parámetros |
|--------|------|---------------------|
| GET | `/suscripcion` | Estado del servicio |
| GET | `/suscripcion/planVigente` | Plan vigente y transiciones pendientes del usuario autenticado (ver abajo) |
| POST | `/suscripcion/iniciarPrueba` | Concede la prueba de 24 horas (cuerpo vacío o `{}`) |
| GET | `/suscripcion/porUsuario` | Suscripciones del usuario autenticado; `?id=` y segmento son transitorios y deben coincidir con la sesión |
| POST | `/suscripcion/crearSinPago` | `{ "sus_pinIdPlanin" }` (`sus_usuarioId` solo se acepta durante la transición si coincide) |
| POST | `/suscripcion/crearConPago` | `{ "pin_idPlanInterv", "idTransaccion", "metodoPago"?, "comprobante"?, "correoTransaccion"?, "criptomoneda"?, "sis_idSuscrip"? }` |

Las dos operaciones `crear*` responden con la suscripción resultante:

```json
{
  "sis_idSuscrip": 1, "sus_usuarioId": 5, "sus_pinIdPlanin": 6,
  "sus_fechainicio": "...", "sus_fechaFin": "...", "sus_situacion": "P",
  "sus_referenPago": "...", "sus_renovAutomatica": false,
  "sus_proximoPago": "...", "sus_fechaCrea": "..."
}
```

**`crearSinPago`**: crea una suscripción pendiente de **1 mes** a partir de la fecha actual, sin referencia de pago, para el usuario de la sesión. Es **idempotente por usuario**.

- Cuerpo: `{ "sus_pinIdPlanin": <entero> }` (`sus_usuarioId` es opcional y, si llega distinto al de la sesión, responde 403).
- Respuestas: `200` suscripción creada; `400` plan inexistente o inactivo (`El plan seleccionado no es válido`) o entero inválido; `401` sin sesión válida; `403` `Acceso denegado`; `409` `El usuario ya tiene una suscripción pendiente o activa` (sin datos de la suscripción existente y sin auditoría); `500` error interno.
- Vigencia: bloquea (409) las `P` y las `A` de planes de pago del usuario con (`sus_fechaFin IS NULL` o `sus_fechaFin >=` la fecha UTC de hoy). Las `A` de la prueba y del Libre no bloquean (se puede elegir un plan de pago durante la prueba). Las canceladas (`C`), pausadas (`S`), expiradas (`E`) y las `P`/`A` ya vencidas no bloquean. El 409 aplica cualquiera que sea el plan pedido y no modifica nada.
- Serialización: la comprobación (`SELECT ... FOR UPDATE`) y el `INSERT` se ejecutan en una transacción; con peticiones simultáneas del mismo usuario resulta un `200` y el resto `409`.
- Primer inicio de sesión (D-17): `persona/agregar` no crea suscripción. La app reserva el plan elegido solo en el dispositivo y, en el primer inicio de sesión de un usuario activo, llama a `crearSinPago` con Bearer usando el plan reservado o el plan Libre (`pin_idPlanInterv = 1`); la app trata el `409` como "ya tiene suscripción" y borra la reserva. El servidor acepta cualquier plan activo. `crearSinPago` sigue protegida por token (solo `planes/disponible` es pública).

**`crearConPago`**:

- Obtiene precio y meses del catálogo activo; ignora `ins_numMeses` y `pin_precioFinal` enviados por el cliente.
- Calcula el periodo provisional como `ahora + meses del catálogo` (día de la subida del comprobante), y `sus_proximoPago` como un día antes del fin. Esas fechas se conservan al confirmar el pago (ver «Pagos»).
- Si recibe `sis_idSuscrip`, actualiza el periodo de esa suscripción; si no, crea una nueva.
- Registra el pago en `spsu_pagos`, que queda en situación `R` (en revisión), dentro de una
  transacción junto con la suscripción. `idTransaccion` no puede repetirse y un duplicado
  responde `409`.

### Plan vigente, prueba de 24 horas y renovación (HU-004 / HU-005, HLT-16)

| Método | Ruta | Cuerpo | Respuestas |
|--------|------|--------|------------|
| GET | `/suscripcion/planVigente` | ninguno (`?id=` o segmento solo si coincide con la sesión) | `200` objeto *PlanVigente*; `401`; `403 Acceso denegado`; `500` |
| POST | `/suscripcion/iniciarPrueba` | vacío o `{}` (cualquier otra clave responde `400 La solicitud no admite datos`) | `200` *PlanVigente* con `estado: "PRUEBA"`; `401`; `409 La prueba gratuita no está disponible para esta cuenta`; `429` con `Retry-After: 3600`; `500` |
| POST | `/suscripcion/cancelar` | vacío, `{}` o `{ "sis_idSuscrip": N }` (propia); cualquier otra clave responde `400 La solicitud contiene campos no permitidos` | `200` *PlanVigente* con `estado: "PAGO"` y `cancelado: true`; `400`; `401`; `403 Acceso denegado` (id ajeno o inexistente, idéntico; `?id=`/segmento/`sus_usuarioId` de otra cuenta); `409 No tiene un plan de pago activo para cancelar` (prueba, Libre, vencido, renovación pendiente) o `409 El plan ya está cancelado`; `429`; `500` |

**`cancelar` (HLT-18).** Toma el usuario de la sesión y apaga la renovación automática (`sus_renovAutomatica = 0`) del plan de pago activo y vigente de mayor nivel (o del `sis_idSuscrip` indicado, que debe ser propio). **El plan sigue vigente hasta su fecha de corte**: no cambian `sus_situacion`, `sus_fechainicio`, `sus_fechaFin` ni `sus_proximoPago`, y **no hay devolución de dinero** (no se toca `spsu_pagos`). Si existe un periodo ya pagado y programado, también queda sin renovación y se cumple. Antes de cancelar se aplica el corte pendiente: un plan ya vencido responde `409`. Dejar de renovar es lo que impide que, al cortarse el plan, se cree la renovación pendiente de pago (DT-15); una renovación ya creada no se cancela (vence sola, DT-17). Registra historial `CANCELACION` y auditoría `PLAN_CANCELADO` (fuera de la transacción), con el mismo orden de bloqueo usuario, suscripciones. Con cinco peticiones simultáneas resulta un `200` y cuatro `409`.

```bash
curl -s -X POST http://localhost:8080/criterio_kelly/rest_suscripcion/suscripcion/cancelar \
  -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" -d '{}'
```

La prueba con reloj simulado del corte con y sin cancelación es `anexos/pruebas/cancelacion_reloj.php` (`C:\xampp\php\php.exe anexos\pruebas\cancelacion_reloj.php`, casos X01 a X06).

`iniciarPrueba` concede la prueba **una sola vez** y solo a cuentas nuevas (registradas después de crearse el plan de prueba). Decide el servidor: el cliente no envía plan ni duración. El `409` es idéntico para todos los motivos (ya tuvo la prueba, tiene historial, cuenta anterior); el motivo real queda solo en la auditoría `PRUEBA_RECHAZADA`. Límite por IP: 20 concesiones en 24 horas (UTC), medidas con los eventos `PRUEBA_INICIADA`.

*PlanVigente* (`LectorPlanVigente` lo calcula; `PlanVigenteSrv` lo arma):

```json
{ "estado": "PRUEBA | LIBRE | PAGO | SIN_PLAN", "vigente": true, "esPrueba": true, "motivoSinPlan": null,
  "idSuscripcion": 104, "pin_idPlanInterv": 17, "plan": { "pla_idPlan": 5, "pla_nombre": "Prueba", "...": "..." },
  "fechaFinUtc": "2026-11-12T19:44:28Z", "fechaCorte": null, "segundosRestantes": 86400, "cancelado": false,
  "planSiguiente": { "pla_idPlan": 1, "pla_nombre": "Libre", "pla_horasDuracion": 240 },
  "planPendiente": null, "planProgramado": null,
  "limites": { "numCuentas": 10, "diasReporte": 365, "diasAnalisis": null, "maxOperacionesAnalisis": null,
               "diasTotalesAnalisis": 365, "puedeGraficar": true, "puedeDescargar": true,
               "divisorEditable": true, "maxOperacionesDiarias": null } }
```

- `planSiguiente` solo con la prueba; `fechaCorte` solo con `PAGO` (entonces `fechaFinUtc` es esa fecha a las `23:59:59Z`); con `SIN_PLAN`, `vigente` es `false` y `plan`, `idSuscripcion`, `pin_idPlanInterv`, `fechaFinUtc` y `segundosRestantes` son `null`.
- `motivoSinPlan` (solo con `SIN_PLAN`), según la suscripción expirada más reciente: `PLAN_PAGO_VENCIDO`, `LIBRE_TERMINADO` (prueba o Libre, incluido el Libre por anulación) o `NUNCA_TUVO_PLAN` (cuentas anteriores sin ninguna suscripción activa o expirada). En todos los casos los `limites` son los del plan Libre.
- `limites`: salen de las columnas del plan vigente (`pla_numCuentas`, `pla_diasHistorial`, `pla_bloqueoDias` o ilimitado si `pla_rangoLibre = 1`, `pla_diasTotales`, `pla_puedeGraficar`, `pla_puedeDescargar`, `pla_divisorEditable`, `pla_maxOperacionesDiarias`). No hay límites escritos en el código.
- `planes/disponible` ya no lista el plan de prueba y añade a cada elemento las columnas de límite (`pla_diasHistorial`, `pla_diasTotales`, `pla_bloqueoDias`, `pla_puedeDescargar`, `pla_rangoLibre`, `pla_puedeGraficar`, `pla_divisorEditable`, `pla_maxOperacionesDiarias`). `crearSinPago` y `crearConPago` rechazan el plan de prueba con el mismo `400 El plan seleccionado no es válido` que un plan inexistente.

**Regla del plan vigente (`configuracion/LectorPlanVigente.php`).** Es la regla única, de solo lectura, con reloj UTC inyectable y sin más dependencias que `Enlace`: `rest_criteriokelly` lleva una **copia idéntica** (HLT-24): cambiar ambos y comprobar `sha256sum` de los dos archivos; `anexos/pruebas/lector_plan_vigente.php` (L01 a L18) lo verifica. `evaluar` simula en memoria la cadena completa de transiciones y devuelve los `pasos`; `PlanVigenteSrv` solo los ejecuta, en orden y dentro de una transacción. Orden de prioridad: plan de pago activo (el de mayor nivel) > prueba > Libre; las suscripciones `P` nunca son vigentes. Vigencia: con `sus_fechaHoraFin`, hasta el instante exacto; sin ella, hasta el final del día de `sus_fechaFin` (UTC).

- Prueba vencida: pasa a `E` y, si la cuenta no tiene plan de pago activo ni expirado, recibe un Libre de `pla_horasDuracion` horas desde ese instante.
- Libre vencido: pasa a `E`; la cuenta queda sin plan.
- Plan de pago al llegar su fecha de corte: pasa a `E` (no vuelve a la prueba ni al Libre).

**Bloqueos.** `crearSinPago`, `crearConPago`, `iniciarPrueba` y `planVigente` (cuando hay transiciones) bloquean primero la fila del usuario en `sgen_usuario` y después sus suscripciones por id. Orden único: usuario, suscripciones, pagos. Con cinco peticiones simultáneas se concede la prueba una vez y se crea una sola transición. La auditoría se registra fuera de la transacción.

**Renovación pendiente de pago (DT-15) y anulación (DT-17).** Al cortar un plan de pago con `sus_renovAutomatica = 1`, sin otro plan de pago vigente, sin periodo programado y sin otra `P` de la misma combinación, se crea una suscripción `P` del mismo plan e intervalo (`sus_fechainicio` = corte + 1 día, `sus_fechaFin` = corte + 30 días, que es el **plazo de pago**), con historial `renovacion` y auditoría `PLAN_RENOVACION`. `planPendiente` la devuelve con `esRenovacion`, `fechaLimitePago` (corte + 30, calculada desde la suscripción origen, no desde las fechas de la `P`) y `diasRestantesPago`. El último día del plazo vale hasta las 23:59:59 UTC. Pasado el plazo y sin pago en revisión (`R`) ni confirmado (`C`), la siguiente evaluación la anula (`C`, historial `ANULADA`, auditoría `PLAN_RENOV_ANULADA`) y concede un **Libre nuevo** de 240 horas; al terminar ese Libre la cuenta queda sin plan (estado 4). Con `sus_renovAutomatica = 0` no se crea nada. **Nunca se cobra**: el corte, la renovación y la anulación no crean pagos, no fijan `sus_referenPago` ni cambian las fechas de la suscripción cortada. Un plan solo pasa a vigente por un pago validado (HLT-17) o porque un periodo ya pagado llega a su inicio.

**Periodo pagado por anticipado (DT-16).** Una `P` de plan de pago con un pago confirmado (`C`) y sin historial `renovacion` es un periodo **programado** (lo marca HLT-17 al confirmar un pago anticipado): aparece en `planProgramado`, no es vigente ni `planPendiente` y no se anula nunca. Al cortarse el periodo presente pasa a `A` sin interrupción (historial `ACTIVACION`, auditoría `PLAN_ACTIV_PROGRAM`) y **no** se crea renovación pendiente. Si la cuenta no consulta durante varios periodos, los pasos se encadenan en una sola evaluación (cortar, activar, cortar, renovar, anular).

**Procedimiento SQL opcional.** `anexos/Procedimientos RenovacionAutomatica.sql` hace lo mismo que el PHP para hostings que prefieran programarlo; el manual (`anexos/procedimientos.md`) explica cómo cambiar al «modo procedimiento» y la regla de que nunca están activos los dos a la vez.

**Zona horaria.** PHP corre en `Europe/Berlin` y la base en hora local; el código nuevo usa solo el reloj UTC (`DateTimeImmutable`). Las fechas que ya escriben `crearSinPago` y `crearConPago` con `date()` (hora de Berlín) son código anterior que no se tocó.

**Efecto en datos existentes.** La suscripción 28 (`A`, corte 2026-03-04, renovación automática 1) pasará a `E` en la primera consulta de su dueño. Como el mismo usuario tiene la `P` 30 con un pago confirmado (se interpreta como periodo programado), esa `P` se activará con sus fechas (hasta 2027-09-04) y no se creará renovación.

**Prueba con reloj simulado.** `C:\xampp\php\php.exe anexos\pruebas\plan_vigente_reloj.php` (solo CLI) ejecuta los casos R01 a R32 con fixtures `ck_prueba_hu4_*` y los borra al terminar.

### Pagos — `/pagos` (HU-004 / HU-005, HLT-17)

Todas las rutas exigen sesión. `pendientes`, `comprobante`, `confirmar` y `rechazar` solo las atiende un **Super Administrador (1) o Administrador (2)**; el rol sale de la base en cada petición (nunca de cabeceras ni del cuerpo). `miUltimoPago` es de cualquier sesión.

| Método | Ruta | Cuerpo / parámetros | Respuestas |
|--------|------|---------------------|------------|
| GET | `/pagos/pendientes` | `?limite=` (1 a 50, por defecto 20) y `?desde=<id>` (pagos con id menor) | `200` arreglo (puede ser `[]`); `400 El campo 'limite' es inválido`; `401`; `403`; `500` |
| GET | `/pagos/comprobante` | `?pag_idPago=N` | `200 {pag_idPago, comprobante}` (cadena `data:image/...;base64,...`); `400`; `401`; `403`; `404 Comprobante no encontrado` |
| POST | `/pagos/confirmar` | `{"pag_idPago": N}` | `200` ver abajo; `400`; `401`; `403`; `404 Pago no encontrado`; `409`; `500` |
| POST | `/pagos/rechazar` | `{"pag_idPago": N, "motivo": "..."}` | `200 {pag_idPago, pag_situacion:"F"}`; `400`; `401`; `403`; `404`; `409 El pago no está pendiente de revisión`; `500` |
| GET | `/pagos/miUltimoPago` | ninguno (`?id=` o segmento solo si coincide con la sesión) | `200 {"pago": null}` o `{"pago": {...}}`; `401`; `403`; `500` |

Cualquier clave del cuerpo distinta de `pag_idPago` (y de `motivo` en `rechazar`) responde `400 La solicitud contiene campos no permitidos`.

```bash
# Listado con tieneComprobante, el periodo resultante y las banderas esAnticipado/esAntiguo
curl -s "http://localhost:8080/criterio_kelly/rest_suscripcion/pagos/pendientes?limite=20" \
  -H "Authorization: Bearer <accessToken de un administrador>"

# Imagen del comprobante de un pago (se pide por pago: puede pesar cientos de KB)
curl -s "http://localhost:8080/criterio_kelly/rest_suscripcion/pagos/comprobante?pag_idPago=123" \
  -H "Authorization: Bearer <accessToken de un administrador>"

# Confirmar (R a C) y activar el plan
curl -s -X POST http://localhost:8080/criterio_kelly/rest_suscripcion/pagos/confirmar \
  -H "Authorization: Bearer <accessToken de un administrador>" -H "Content-Type: application/json" \
  -d '{"pag_idPago":123}'

# Rechazar (R a F) con motivo de 5 a 256 caracteres
curl -s -X POST http://localhost:8080/criterio_kelly/rest_suscripcion/pagos/rechazar \
  -H "Authorization: Bearer <accessToken de un administrador>" -H "Content-Type: application/json" \
  -d '{"pag_idPago":123,"motivo":"Comprobante ilegible"}'
```

(Ajuste el prefijo de la URL a su instalación; en el XAMPP de este repositorio Apache escucha en el puerto 8080.)

**Listado.** Cada elemento trae `pag_idPago, pag_susIdSuscri, sus_usuarioId, usuario, pla_nombre, ins_nombre, pag_monto, pag_moneda, pag_metodoPago, pag_idTransac, pag_fechaPago` (día y hora de la subida), `pag_tipocripto, tieneComprobante, esPropio, esAnticipado, fechaInicioResultante, fechaCorteResultante, esAntiguo`. No incluye `pag_imagen` ni `pag_correo`. Las cuatro últimas banderas salen de `MejoraPlanSrv::calcularPeriodo`, la misma función que usa `confirmar`: lo que ve el administrador es lo que se aplica. Con un plan presente de **otra** combinación, `esAnticipado` y `esAntiguo` son `false` y las fechas `null` (confirmar respondería 409). El campo de la suscripción lleva el nombre de la columna real, `pag_susIdSuscri`.

**Confirmar** (`MejoraPlanSrv::confirmar`, una transacción). Orden de bloqueo único: usuario dueño, sus suscripciones por id, pago. Respuesta `200`:

```json
{ "pag_idPago": 123, "pag_situacion": "C", "tipo": "PRIMER_CORTE", "sis_idSuscrip": 40, "sus_usuarioId": 15,
  "sus_situacion": "A", "sus_fechainicio": "2026-11-11", "sus_fechaFin": "2026-12-11", "sus_proximoPago": "2026-12-10",
  "suscripcionesCanceladas": [38] }
```

- **Primer corte** (la cuenta no tiene un plan de pago activo con corte vigente): el plan entra en vigencia al validar, pero conserva las **fechas de la subida del comprobante** (`sus_fechainicio` = día de la subida, `sus_fechaFin` = ese día + meses del intervalo, `sus_proximoPago` = corte − 1 día, `pag_pagoDesde/Hasta` sin cambio). Si el administrador tarda, esos días cuentan contra el periodo. Las activas de prueba o Libre pasan a `C` (vigentes) o `E` (vencidas) con historial `CANCELADA_MEJORA`; la suscripción pasa a `A` (historial `ACTIVACION`); el pago pasa a `C` con `pag_montoConfirmado = pag_monto`. Auditoría `PAGO_CONFIRMADO` y `PLAN_MEJORADO` (fuera de la transacción).
- **Pago anticipado** (hay un periodo presente `A` de plan de pago con corte vigente de la **misma** combinación): la `A` presente no se toca; la suscripción del pago queda `P` **programada** con `sus_fechainicio` = corte presente + 1 día, `sus_fechaFin` = inicio + meses, `sus_proximoPago` = fin − 1 día y `sus_renovAutomatica` heredado del presente (si estaba cancelado, el periodo pagado termina sin renovar); `pag_pagoDesde/Hasta` pasan a esas fechas; historial `PROGRAMADA`; auditoría `PAGO_CONFIRMADO` y `PLAN_PROGRAMADO`. Una `P` con un pago `C` es la marca de «pagada y programada»: `planVigente` la devuelve en `planProgramado` y, al cortarse el periodo presente, `PlanVigenteSrv` la activa sin interrupción y sin crear renovación.
- **Cómo se paga por anticipado:** la persona llama a `suscripcion/crearConPago` sin `sis_idSuscrip` (o con el de su `P`) mientras tiene un plan de pago activo de esa combinación; se crea la `P` con su pago `R` (fechas provisionales de la subida) y el administrador la confirma.
- **409 posibles:** `El pago no está pendiente de revisión` (solo `R` es confirmable), `La suscripción ya no admite la confirmación` (debe estar en `P`), `El pago no tiene comprobante`, `El monto del pago no coincide con el plan` (monto del catálogo; plan de pago con precio mayor que 0), `La cuenta del pago no está activa`, `Ya tiene un plan de pago activo; solo puede pagar por anticipado la misma combinación`, `Ya tiene un periodo siguiente pagado y programado` y, solo en primer corte, **`El comprobante es demasiado antiguo; suba uno nuevo`** (la fecha de corte resultante ya pasó; el plan vale hasta el final del día de `sus_fechaFin`). En todos nada cambia.
- **Comprobante demasiado antiguo, cómo resolverlo:** el administrador **rechaza** ese pago con motivo (por ejemplo «El comprobante es demasiado antiguo; suba uno nuevo»); la suscripción sigue `P` y la persona sube otro comprobante con `crearConPago` (otro `idTransaccion`).
- Un administrador **no confirma ni rechaza su propio pago** (`403 Acceso denegado`, auditoría `ACCESO_DENEGADO`), aunque sea el único administrador.

**Rechazar.** `motivo` obligatorio (se recorta con `trim`; de 5 a 256 caracteres, si no `400 El campo 'motivo' es obligatorio y debe tener entre 5 y 256 caracteres`) y se guarda saneado (HTML escapado) en `spsu_historialsuscri` (`his_accion = 'PAGO_RECHAZADO'`, `his_detalle = 'pago=<id>; motivo=<texto>'`), en la misma transacción que el paso `R` a `F`. La suscripción sigue `P`. La auditoría `PAGO_RECHAZADO` registra solo el id, no el texto. No se añadió ninguna columna a `spsu_pagos`.

**`miUltimoPago`.** Toma la suscripción pendiente de la sesión (`planPendiente`) y devuelve su último pago: `{pag_idPago, sis_idSuscrip, pag_situacion, pag_fechaPago, pag_monto, pag_moneda, pag_metodoPago, pla_nombre, ins_nombre, tieneComprobante, motivoRechazo}`. `motivoRechazo` solo viene con `F` (texto del historial). No devuelve la imagen, el correo ni el id de transacción. Sin suscripción pendiente o sin pagos responde `{"pago": null}`.

**`crearConPago` (cambios de HLT-17).** Sus validaciones y la subida del comprobante no cambian; se añadieron cierres: solo reutiliza una suscripción en `P` y sin pago confirmado (`409 La suscripción no admite pagos`, sin tocar fechas); un solo pago `R` por suscripción (`409 Ya hay un comprobante en revisión para esta suscripción`); una renovación solo admite el comprobante hasta corte + 30 días, también el día 30 (`409 El plazo para pagar la renovación terminó`); sin `sis_idSuscrip` y sin `P` reutilizable, con un plan de pago presente de otra combinación `409 Ya tiene un plan de pago activo`, y de la misma combinación con un pago pendiente o programado `409 Ya tiene un pago pendiente o programado para el siguiente periodo`. `crearSinPago` no cambia. El día de la subida lo calcula `crearConPago` con `date()` (hora de Berlín) y la comparación del 409 antiguo usa la fecha UTC: pueden diferir hasta un día durante 1 o 2 horas al día (decisión D-16).

**Corrección manual de un pago ya resuelto.** La API no devuelve un pago `C` o `F` a `R` (no hay endpoint de reversión). Si un administrador se equivocó, el procedimiento es manual, con un usuario del gestor, **en una sola transacción** y con respaldo previo (pasos descritos; la aplicación no los ejecuta):

1. Bloquear y leer: `SELECT ... FROM spsu_pagos WHERE pag_idPago = <id> FOR UPDATE;`, la suscripción del pago y sus hermanas del mismo `sus_usuarioId`.
2. Pago confirmado por error (primer corte): `UPDATE spsu_pagos SET pag_situacion = 'R', pag_montoConfirmado = 0 WHERE pag_idPago = <id>;` y `UPDATE spsu_suscripcion SET sus_situacion = 'P' WHERE sis_idSuscrip = <id>;`; devolver a `A` las suscripciones de prueba o Libre que el historial `CANCELADA_MEJORA` muestre canceladas, si seguían vigentes.
3. Pago anticipado confirmado por error: además restaurar en la `P` las fechas provisionales de la subida (inicio = día de `pag_fechaPago`, fin = inicio + meses, `sus_proximoPago` = fin − 1 día) y en el pago `pag_pagoDesde/Hasta`.
4. Pago rechazado por error: `UPDATE spsu_pagos SET pag_situacion = 'R' WHERE pag_idPago = <id> AND pag_situacion = 'F';`
5. Insertar una fila de historial que explique la corrección y hacer `COMMIT`. Conviene que el usuario afectado no consulte su plan mientras se corrige.

**Prueba con reloj simulado.** `C:\xampp\php\php.exe anexos\pruebas\mejora_plan_reloj.php` (solo CLI) ejecuta los casos M01 a M07 (fechas conservadas, comprobante antiguo, mejora de prueba, pago anticipado y su límite con el corte) con fixtures `ck_prueba_hu4_*` y los borra al terminar.

### Datos de pago — `/datosPago` (HU-005, HLT-29)

Los datos para pagar (redes USDT con dirección y código QR, PayPal, número de WhatsApp del banco) viven en la base y los administra el rol 1 o 2. **Requiere aplicar antes el script de actualización** (tablas `spsu_metodopago`, `spsu_redusdt` y `spsu_qrpago`; la semilla trae los 3 métodos inactivos y sin datos, sin redes). Todas las rutas exigen sesión; la semilla vacía deja el pago «no disponible» hasta que un administrador cargue los datos.

| Método | Ruta | Quién | Cuerpo / parámetros | Respuestas |
|--------|------|-------|---------------------|------------|
| GET | `/datosPago/disponibles` | cualquier sesión | — | `200 {cripto:{nombre,redes:[{clave,nombre,etiqueta,direccion,tieneQr,qrHash}]}\|null, paypal:{nombre,correo,enlace}\|null, banco:{nombre,numero,plantilla}\|null}` solo con lo activo y completo |
| GET | `/datosPago/qr?clave=TRON` | cualquier sesión | `clave` | imagen binaria, `304` con `If-None-Match`, `400` clave inválida, `404` (para quien no es administrador, solo si la red y el método están activos) |
| GET | `/datosPago/administracion` | 1, 2 | — | `200 {metodos:[…], redes:[…con activo, orden, tieneQr, qrTamano, qrTipoMime, qrHash y auditoría]}` |
| POST | `/datosPago/guardarRed` | 1, 2 | `{red_idRed?, red_clave, red_nombre, red_etiqueta, red_direccion, red_activo?, red_orden?}` | `200 {success, red_idRed}`; sin id crea (`409` si la clave existe); con id edita (la clave no se edita) |
| POST | `/datosPago/cambiarEstadoRed` | 1, 2 | `{red_idRed, red_activo}` | `200 {success:'ok'}` |
| POST | `/datosPago/eliminarRed` | 1, 2 | `{red_idRed}` | `200`; borra también su QR; `400` si es la última red activa con `CRIPTOMONEDA` activo |
| POST | `/datosPago/guardarPaypal` | 1, 2 | `{mep_paypalCorreo?, mep_paypalEnlace?}` | `200` |
| POST | `/datosPago/guardarBanco` | 1, 2 | `{mep_bancoNumero, mep_bancoPlantilla?}` | `200` |
| POST | `/datosPago/cambiarEstadoMetodo` | 1, 2 | `{mep_codigo, mep_activo, mep_orden?}` | `200`; activar sin datos completos `400 Completa los datos antes de activarlo` |
| POST | `/datosPago/subirQr` | 1, 2 | `{red_idRed, imagen}` (`data:image/…;base64,…`) | `200 {success, qrHash}`; reemplaza el existente |
| POST | `/datosPago/quitarQr` | 1, 2 | `{red_idRed}` | `200` |

Los usuarios sin rol de administración reciben `403 {"error":"Acceso denegado"}` en toda escritura y en `administracion` (auditoría `ACCESO_DENEGADO`). Un campo no listado responde `400 La solicitud contiene campos no permitidos`. El 422 no se usa.

**Reglas de formato.** Clave de red `^[A-Z0-9_]{2,16}$` (se pasa a mayúsculas). Dirección sin espacios: `TRON` `^T[1-9A-HJ-NP-Za-km-z]{33}$`; `ETH` y `BSC` `^0x[0-9a-fA-F]{40}$`; otra clave `^[A-Za-z0-9]{16,128}$` (solo formato, sin checksum). PayPal: correo (≤ 64) y/o enlace `https://paypal.me/…` o `https://www.paypal.com/…` (≤ 255). Banco: `mep_bancoNumero` es el **WhatsApp** (8 a 15 dígitos; se quitan `+`, espacios y guiones) y `mep_bancoPlantilla` es opcional (hasta 500 caracteres, con `{plan}` y `{monto}`). Además `guardarBanco` registra los datos de la cuenta del propietario, todos opcionales: `mep_bancoTitular` (≤ 128), `mep_bancoDocumento` (3 a 20, letras, dígitos, `.` y `-`), `mep_bancoEntidad` (≤ 64), `mep_bancoTipoCuenta` (`AHORROS`, `CORRIENTE`, `VIRTUAL`, `OTRO`), `mep_bancoCuenta` (4 a 34, alfanumérico y `-`), `mep_bancoPaisMoneda` (≤ 32) y `mep_bancoObservaciones` (≤ 255); si se envía la cuenta, también titular y entidad. Guardar reemplaza todos los campos del banco. **Los datos de la cuenta solo los devuelve `administracion` (roles 1 y 2); `disponibles` entrega del banco solo `nombre`, `numero` y `plantilla`** y se expondrán al cliente en un cambio aparte. La auditoría guarda solo los últimos 4 dígitos del WhatsApp y de la cuenta, nunca el documento ni el titular. Los textos se guardan con el escape HTML del proyecto.

**Política del QR.** Se guarda en la base (`spsu_qrpago.qr_contenido`, `MEDIUMBLOB`, una fila por red) y solo se sirve por `datosPago/qr`, nunca por URL directa. Máximo 256 KB decodificados; `image/png`, `image/jpeg` o `image/webp` (sin GIF ni SVG); el tipo sale del contenido real (`finfo`) y debe coincidir con el declarado; de 100 a 2000 px por lado. Con la extensión GD cargada la imagen se **re-codifica** (se descartan metadatos y cargas ocultas); **sin GD** (hoy `extension=gd` está comentada en el `php.ini` de XAMPP) se descartan los bytes posteriores al final lógico del archivo (IEND, EOI o tamaño RIFF) y se guarda esa versión; conviene activar GD en producción. Cabeceras de respuesta: `Content-Type` guardado, `nosniff`, `Content-Security-Policy: default-src 'none'`, `Content-Disposition: inline; filename="qr.<ext>"`, `Cache-Control: private, no-cache` y `ETag` con el SHA-256. Como una `<img>` no envía `Authorization`, la app la pide como blob con el token.

**Límites y auditoría.** Además del límite general, cada administrador puede hacer 20 escrituras por minuto (`429` con `Retry-After` y evento `LIMITE_PETICIONES`). Eventos: `DATOPAGO_CREADO`, `DATOPAGO_EDITADO`, `DATOPAGO_ESTADO`, `DATOPAGO_ELIMINA`, `QRPAGO_SUBIDO`, `QRPAGO_QUITADO`; el detalle lleva la clave de la red y, como mucho, los últimos 6 caracteres de la dirección.

**Código.** `rutas/DatosPagoRts.php`, `controladores/DatosPagoCtrl.php`, `modelos/DatosPagoMdl.php`, `servicios/ValidadorDatosPago.php` (formatos) y `servicios/ProcesadorQrPago.php` (imagen del QR). `BaseCtrl::leerImagen` ganó los parámetros opcionales `$maximoBytes` y `$tiposPermitidos`; sus valores por defecto son los de siempre (comprobante sin cambios).

### Autorización

Todas las rutas salvo `/planes/disponible` requieren sesión. El dueño siempre se toma de
`ContextoSesion`; un id enviado diferente genera `403 {"error":"Acceso denegado"}` y auditoría
`ACCESO_DENEGADO`. Las consultas y actualizaciones de suscripciones incluyen el dueño en el
`WHERE`, por lo que una suscripción ajena o inexistente produce la misma respuesta `403`.
Los pagos solo se registran para suscripciones del usuario autenticado y solo un administrador los valida (`pagos/confirmar`, `pagos/rechazar`).

## Formato de respuestas

El dato se devuelve directamente, sin envoltorio:

```json
// Éxito (200)
[ { "pin_idPlanInterv": 6, "pla_nombre": "Básico", "pin_precioFinal": 1.25 } ]

// Error (400, 404, 500...)
{ "error": "No se encontraron suscripciones para el usuario especificado" }
```

La app (`errorInterceptor`) muestra el valor de `error` como mensaje al usuario, por eso los mensajes se escriben en español.

## Agregar un endpoint

1. Agrega el `case` de la acción en el archivo de `rutas/` correspondiente. `PlanesRts.php` solo atiende GET.
2. Crea el método en el controlador (extiende `BaseCtrl`): `validarDatos`, `limpiarDatos` y responde con `respuestaExitosaSimple` / `respuestaErrorSimple`.
3. Crea el método en el modelo usando `Enlace` con consultas preparadas, por ejemplo `ejecutarConsulta($sql, "ii", $idUsuario, $idPlan)`.
4. Si es un recurso nuevo, registra su prefijo en el arreglo `$rutas` de `index.php`.

## Estado actual

Pendientes y problemas conocidos fuera de este HLT:

- **Desfase de esquema:** la base viva contiene `pag_montoConfirmado`, `pag_correo` y
  `pag_tipocripto`, pero el anexo SQL no los declara. Requiere una historia de esquema.
- **Concurrencia de `crearSinPago`:** la idempotencia se logra con una transacción y `SELECT ... FOR UPDATE` sobre las suscripciones del usuario. No hay índice por `sus_usuarioId`, así que el bloqueo recorre la tabla y serializa los primeros inicios de sesión (riesgo R-S1; el índice se propone en HLT-11). Con aislamiento `READ COMMITTED` (hosting) el bloqueo de huecos podría no impedir un `INSERT` concurrente (R-S3): el daño se limita a una pendiente duplicada del propio usuario. `crearSinPago` y `crearConPago` pueden bloquearse mutuamente; MySQL aborta una y se responde 500 genérico (R-S6).
- **`/planes/disponible` y `/planes/suscritos` filtran `pin_estado = '1'`**, pero los datos de instalaciones antiguas usaban `'A'`. Con esos datos iniciales no devuelven planes.
- **El alias `PLIN` en `PlanesMdl`** se escribe en mayúsculas en un lugar y en minúsculas en otro. Funciona en Windows, pero puede fallar en MySQL sobre Linux.
- **La app usa `suscripcion/suscripcionPorID/{id}`**, que no existe en el servicio.
- **`PagosCtrl::obtenerPagosPendientesVerificacion`** (heredado) existe sin ruta y consulta columnas inexistentes (`pag_id`, `pag_usuarioId`...); se dejó intacto. El listado de administración es `GET /pagos/pendientes`.
