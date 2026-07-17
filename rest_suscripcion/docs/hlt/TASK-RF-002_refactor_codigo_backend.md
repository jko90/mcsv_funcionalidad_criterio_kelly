# Task Brief — RF-002: Refactor del código backend de `rest_suscripcion`

> **Documento auto-contenido.** Todo lo necesario para implementar está aquí. No requiere acceso al historial de conversación ni al HLT.
> **HLT de referencia aprobado:** `docs/hlt/HLT-RF-002_refactor_codigo_backend.md`.
> **Versión:** 1.0.0
> **Fecha:** 2026-07-17
> **Total de tareas:** 31 (13 implementación + 18 validación)

---

## Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_suscripcion` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/` |
| Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) |
| Capa de datos | `configuracion/enlace.php` (clase `Enlace`, métodos: `ejecutarConsulta`, `ejecutarConsultaSimpleFila`, `ejecutarInsercionRetornaID`, `ejecutarActualizacion`) |
| Capa de respuesta | `controladores/BaseCtrl.php` (`respuestaExitosaSimple`, `respuestaErrorSimple`, `respuestaJsonSimple`) |
| BD | MySQL/MariaDB — `DB_NAME=sist_criteriokelly` |
| Prefijo de tablas | `spsu_` |
| Comando de build | N/A (sin Composer/build) |
| Health check | `curl http://localhost/rest_suscripcion/planes` |
| Logs | `logs/php_errors.log` del servicio |
| Dominios registrados en index.php (hoy) | `/planes`, `/suscripcion` (añadir `/pagos` en T12) |

### Orden de implementación (por capa, descendente: Modelo → Controlador → Ruta → index.php → README → Validaciones)

| Orden | Grupo | Tareas |
|-------|-------|--------|
| 1 | Base + Utilidades | T1 (BaseCtrl), T2 (RtsHelper) |
| 2 | Modelos | T3 (PlanesMdl), T4 (SuscripcionMdl), T5 (PagosMdl) |
| 3 | Controladores | T6 (PlanesCtrl), T7 (SuscripcionCtrl), T8 (PagosCtrl) |
| 4 | Rutas | T9 (PlanesRts), T10 (SuscripcionRts), T11 (PagosRts nuevo) |
| 5 | Front Controller | T12 (index.php) |
| 6 | Documentación | T13 (README.md) |
| 7 | Validaciones | T14–T31 |

---

## Reglas de implementación (mandatorias)

1. **Una tarea → un cambio atómico verificable.** No fusionar cambios de distintas capas en una misma tarea.
2. **Sentencias preparadas siempre.** Toda consulta usa `Enlace::ejecutarConsulta`/`ejecutarConsultaSimpleFila`/`ejecutarInsercionRetornaID`/`ejecutarActualizacion` con `bind_param`. Prohibido concatenar valores en SQL.
3. **Respuestas solo vía `BaseCtrl`.** Prohibido `echo`/`json_encode` directo en controladores como respuesta final. Usar `respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`. Toda salida con `JSON_UNESCAPED_UNICODE`.
4. **Validación y saneamiento.** Usar `validarDatos` + `limpiarDatos` de `BaseCtrl`. No repetir `htmlspecialchars(trim(...))` manualmente.
5. **Manejo de errores homogéneo.** Todo `try/catch` registra detalle con `error_log()` y responde mensaje genérico + 500. Prohibido exponer `$e->getMessage()` al cliente.
6. **Eliminaciones lógicas** (no aplica a este RF).
7. **Rutas relativas de `require_once` correctas.** Usar `__DIR__ . '/../modelos/XxxMdl.php'`.
8. **Sin secretos nuevos hardcodeados.**
9. **Archivos `anexos/` y `docs/` no se tocan.**
10. **Convenciones:** clases `PascalCase`, métodos/variables `camelCase`, español en dominio y comentarios, sufijos `*Rts`/`*Ctrl`/`*Mdl`.
11. **Código limpio:** responsabilidad única, guard clauses, números/códigos HTTP explícitos, sin cadenas mágicas.

---

## Tareas de implementación

### Grupo A — Base y utilidades compartidas

---

#### [ ] T1 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/BaseCtrl.php` | MODIFY

**Insert after:** línea 29 (justo después de la llave de cierre de `limpiarDatos()`)

**Delta:**

(A) Añadir `responderJsonEstandar` — método estático público para que las rutas (procedurales) puedan emitir respuestas JSON sin instanciar un controlador:

```php
public static function responderJsonEstandar(array $datos, int $httpCode = 200): void
{
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}
```

(B) Añadir `validarIDPositivo` — método protegido que encapsula el patrón repetido de validación de ID:

```php
protected function validarIDPositivo($id, string $nombreCampo = 'id'): int
{
    $data = [$nombreCampo => $id];
    $errores = $this->validarDatos($data, [$nombreCampo]);
    if (!empty($errores)) {
        $this->respuestaErrorSimple(implode(', ', $errores), 400);
    }
    $dataLimpio = $this->limpiarDatos($data);
    $idLimpio = (int)($dataLimpio[$nombreCampo] ?? 0);
    if ($idLimpio <= 0) {
        $this->respuestaErrorSimple("'$nombreCampo' debe ser un ID entero positivo", 400);
    }
    return $idLimpio;
}
```

(C) Eliminar el bloque comentado (líneas 30–56 inclusive) que contiene los métodos antiguos `respuestaJson`, `respuestaExitosa`, `respuestaError`.

---

#### [ ] T2 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/RtsHelper.php` | CREATE

**Delta:** Crear el archivo con dos funciones globales. No define clase; usa `require_once` de BaseCtrl incluido desde los Rts que lo llaman.

**Función `parsearAccionYParametro`:**

```php
function parsearAccionYParametro(string $uriCompleta, string $palabraClave): array
{
    $uriParts = explode('/', trim(parse_url($uriCompleta, PHP_URL_PATH), '/'));
    $accion = null;
    $parametro = null;
    for ($i = 0; $i < count($uriParts); $i++) {
        if ($uriParts[$i] === $palabraClave && isset($uriParts[$i + 1])) {
            $accion = $uriParts[$i + 1];
            if (isset($uriParts[$i + 2])) {
                $parametro = $uriParts[$i + 2];
            }
            break;
        }
    }
    return ['accion' => $accion, 'parametro' => $parametro];
}
```

**Función `responderMetodoNoPermitido`:**

```php
function responderMetodoNoPermitido(array $metodosPermitidos): void
{
    BaseCtrl::responderJsonEstandar([
        'error' => 'Método no permitido',
        'metodos_permitidos' => $metodosPermitidos
    ], 405);
}
```

---

### Grupo B — Modelos

---

#### [ ] T3 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/PlanesMdl.php` | MODIFY

**Insert after:** línea 12 (después del constructor, antes de `obtenerPlanesDisponibles`)

**Delta:**

(A) Extraer la parte común del `SELECT` (los 10 campos compartidos) como una constante privada o como una variable reutilizable en ambos métodos. Ejemplo:

```php
private const PLAN_BASE_FIELDS = 'plin.pin_idPlanInterv, plin.pin_precioFinal, inp.ins_nombre, inp.ins_numMeses, inp.ins_x100descuen, pla.pla_nombre, pla.pla_descripcion, pla.pla_precioBase, pla.pla_moneda, pla.pla_numCuentas';
```

(B) En ambas consultas (líneas 16–18 y 25–32), concatenar `self::PLAN_BASE_FIELDS` en lugar de repetir los 10 campos.

(C) En las líneas 17 y 31 (ambas consultas), reemplazar `PLIN.pins_idInterSuscrip` por `plin.pins_idInterSuscrip`.

---

#### [ ] T4 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/SuscripcionMdl.php` | MODIFY

**Insert after:** línea 30 — reemplazar la línea 30 completa

**Delta:** Corregir la precedencia SQL en `obtenerSuscripcionPorIDUsuario`. El `WHERE` actual es:

```
WHERE sis_idSuscrip = ? OR (sus_usuarioId = ? AND sus_pinIdPlanin = ? AND ...) AND CURRENT_DATE BETWEEN sus_fechainicio AND sus_fechaFin
```

Debe ser:

```
WHERE (sis_idSuscrip = ? OR (sus_usuarioId = ? AND sus_pinIdPlanin = ? AND sus_situacion = 'P' AND sus_referenPago IS NULL AND sus_proximoPago IS NULL)) AND CURRENT_DATE BETWEEN sus_fechainicio AND sus_fechaFin
```

Notar el paréntesis de cierre `)` después del `IS NULL` y antes de `AND CURRENT_DATE`.

---

#### [ ] T5 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/PagosMdl.php` | MODIFY

**Insert after:** línea 12 (después del constructor, antes de `insertarPagoSuscripcion`)

**Delta:** Añadir método:

```php
public function existePagoPorTransaccion(string $idTransaccion): bool
{
    $sql = "SELECT pag_id FROM spsu_pagos WHERE pag_idTransac = ?";
    $resultado = $this->conexion->ejecutarConsultaSimpleFila($sql, 's', $idTransaccion);
    return $resultado !== null;
}
```

**Note:** El nombre de la columna en BD es `pag_idTransac` (no `pag_idTransaccion`).

---

### Grupo C — Controladores

---

#### [ ] T6 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/PlanesCtrl.php` | MODIFY

**Insert after:** línea 14 (después del constructor)

**Delta:**

(A) Añadir `healthCheck()` público:

```php
public function healthCheck(): void
{
    $this->respuestaExitosaSimple([
        'status' => 'ok',
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '1.0.0',
        'service' => 'PlanesRTS'
    ]);
}
```

(B) Extraer método privado `mapearPlan` (insertar después de `healthCheck`):

```php
private function mapearPlan(array $plan): array
{
    return [
        'pin_idPlanInterv' => (int)($plan['pin_idPlanInterv'] ?? 0),
        'pin_precioFinal'  => (float)($plan['pin_precioFinal'] ?? 0),
        'ins_nombre'       => $plan['ins_nombre'] ?? '',
        'ins_numMeses'     => (int)($plan['ins_numMeses'] ?? 0),
        'ins_x100descuen'  => (float)($plan['ins_x100descuen'] ?? 0),
        'pla_nombre'       => $plan['pla_nombre'] ?? '',
        'pla_descripcion'  => $plan['pla_descripcion'] ?? '',
        'pla_precioBase'   => (float)($plan['pla_precioBase'] ?? 0),
        'pla_moneda'       => $plan['pla_moneda'] ?? '',
        'pla_numCuentas'   => (int)($plan['pla_numCuentas'] ?? 0)
    ];
}
```

(C) En `obtenerPlanesDisponibles`, reemplazar el `foreach` (líneas 34–47) por:

```php
foreach ($resultado as $plan) {
    $datosPlanes[] = $this->mapearPlan($plan);
}
```

(D) En `obtenerPlanesSuscritosSinPagar` (línea 56):
- Reemplazar el bloque de validación manual (líneas 60–69) por `$id = $this->validarIDPositivo($idUsuario, 'idUsuario');`
- Eliminar la línea 70 (comentario de debug `// $this->respuestaErrorSimple('Error interno del servidor GGGGGGGGG'.$id, 500);`)
- Reemplazar el `foreach` (líneas 79–98) usando `$this->mapearPlan($plan)` más los campos adicionales.

---

#### [ ] T7 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/SuscripcionCtrl.php` | MODIFY

**Insert after:** línea 16 (después del constructor)

**Delta — múltiples cambios en este archivo:**

**(A) Añadir `healthCheck()`:**

```php
public function healthCheck(): void
{
    $this->respuestaExitosaSimple([
        'status' => 'ok',
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '1.0.0',
        'service' => 'Suscripciones'
    ]);
}
```

**(B) Extraer `mapearSuscripcion()`:**

```php
private function mapearSuscripcion(array $fila): array
{
    return [
        'sis_idSuscrip'       => (int)($fila['sis_idSuscrip'] ?? 0),
        'sus_usuarioId'       => (int)($fila['sus_usuarioId'] ?? 0),
        'sus_pinIdPlanin'     => (int)($fila['sus_pinIdPlanin'] ?? 0),
        'sus_fechainicio'     => $fila['sus_fechainicio'] ?? '',
        'sus_fechaFin'        => $fila['sus_fechaFin'] ?? '',
        'sus_situacion'       => $fila['sus_situacion'] ?? '',
        'sus_referenPago'     => $fila['sus_referenPago'] ?? '',
        'sus_renovAutomatica' => (bool)($fila['sus_renovAutomatica'] ?? false),
        'sus_proximoPago'     => $fila['sus_proximoPago'] ?? '',
        'sus_fechaCrea'       => $fila['sus_fechaCrea'] ?? ''
    ];
}
```

**(C) En `obtenerSuscripcionesPorUsuario` (línea 19):**
- Eliminar línea 22: `$this->respuestaErrorSimple('Error interno del servidor'.$idUsuario, 500);`
- Reemplazar líneas 24–33 (validación manual) por: `$id = $this->validarIDPositivo($idUsuario, 'id');`
- Eliminar línea 34: `$this->respuestaErrorSimple('Error interno del servidor'.$id, 500);`
- Reemplazar el `while` de mapeo (líneas 43–56) usando `$this->mapearSuscripcion($objSuscripcion)`.

**(D) En `insertarSuscripcionSinPago` (línea 69):**
- Corregir el docblock (líneas 65–68). Reemplazar el texto actual:

```php
/**
 * Crea una suscripción sin pago (período de prueba/cortesía).
 * @param array $data Datos de la suscripción (sus_pinIdPlanin, sus_usuarioId)
 * @return void
 */
```

- Reemplazar el bloque de mapeo (líneas 106–117) por `$datosSuscripcion = $this->mapearSuscripcion($objSuscripcion);`.

**(E) En `insertarSuscripcionConPago` (línea 126):**
- Cambiar en línea 130: `'iUsuario'` → `'sus_usuarioId'`
- Cambiar en línea 137: `$datosLimpios['iUsuario']` → `$datosLimpios['sus_usuarioId']`
- Eliminar línea 161 (`$idSuscripcionDB = $sis_idSuscrip;`) — la reasignación que descarta el valor calculado en líneas 157–160.
- Insertar **antes de línea 175** (antes de la llamada a `insertarPagoSuscripcion`) la verificación de idempotencia:

```php
if ($this->pagosServicio->existePagoPorTransaccion($idTransaccion)) {
    $this->respuestaErrorSimple('El idTransaccion ya fue registrado', 409);
}
```

- Reemplazar el bloque de mapeo (líneas 187–198) por `$datosSuscripcion = $this->mapearSuscripcion($objSuscripcion);`.

**Nota:** el orden importa: todas las referencias a `iUsuario` deben cambiarse a `sus_usuarioId` en este método. Además, en `respuestaErrorSimple` de línea 203 (`catch`), no cambiar el mensaje "Error interno del servidor desde el controlador" (es el mensaje genérico existente del catch, no es la línea de depuración D6).

---

#### [ ] T8 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/PagosCtrl.php` | MODIFY

**Insert after:** línea 13 (después del constructor)

**Delta:**

(A) Añadir `healthCheck()`:

```php
public function healthCheck(): void
{
    $this->respuestaExitosaSimple([
        'status' => 'ok',
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '1.0.0',
        'service' => 'PagosRTS'
    ]);
}
```

(B) En `obtenerPagosPendientesVerificacion` (línea 16), reemplazar el bloque de validación manual (líneas 19–28) por:

```php
$id = $this->validarIDPositivo($idUsuario, 'idUsuario');
```

---

### Grupo D — Rutas

---

#### [ ] T9 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/PlanesRts.php` | MODIFY

**Insert after:** línea 1 (después de `<?php`)

**Delta:**

(A) Añadir `require_once(__DIR__ . '/RtsHelper.php');` después del `require_once` existente del controlador.

(B) Reemplazar el bloque de parseo URI (líneas 13–27) por:

```php
$requestUri = $_SERVER['REQUEST_URI'];
$parsed = parsearAccionYParametro($requestUri, 'planes');
$action = $parsed['accion'];
$actionParam = $parsed['parametro'];
```

(C) Reemplazar el `default` del switch de método (líneas 33–39) por:

```php
default:
    responderMetodoNoPermitido(['GET', 'POST']);
    break;
```

(D) En `manejarGet`: reemplazar el bloque `if (!$action) { ... }` (líneas 44–55) por:

```php
if (!$action) {
    $controller->healthCheck();
    return;
}
```

(E) Reemplazar los `echo json_encode` manuales en el manejo de acción `suscritos` (líneas 64–73) por `BaseCtrl::responderJsonEstandar(...)`.

(F) Reemplazar el `default` del switch de acción (líneas 78–81) por `BaseCtrl::responderJsonEstandar(['error' => 'Acción no válida para método GET'], 400);`.

---

#### [ ] T10 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/SuscripcionRts.php` | MODIFY

**Insert after:** línea 1 (después de `<?php`)

**Delta:**

(A) Añadir `require_once(__DIR__ . '/RtsHelper.php');` después del `require_once` existente.

(B) Reemplazar el bloque de parseo URI (líneas 13–23) por:

```php
$requestUri = $_SERVER['REQUEST_URI'];
$parsed = parsearAccionYParametro($requestUri, 'suscripcion');
$action = $parsed['accion'];
```

(C) Reemplazar el `default` del switch de método (líneas 32–38) por:

```php
default:
    responderMetodoNoPermitido(['GET', 'POST']);
    break;
```

(D) En `manejarGet`: reemplazar el bloque `if (!$action) { ... }` (líneas 44–56) por:

```php
if (!$action) {
    $controller->healthCheck();
    return;
}
```

(E) Reemplazar todos los `echo json_encode` manuales de `manejarGet` y `manejarPost` por `BaseCtrl::responderJsonEstandar(...)`. Esto incluye: validación de ID (líneas 62–70), acción no válida para GET (líneas 76–78), acción requerida (líneas 85–88), datos requeridos (líneas 93–96), JSON inválido (líneas 100–104), datos vacíos (líneas 106–110), acción no válida para POST (líneas 120–125).

(F) **Eliminar** la línea 117 (`echo "Datos recibidos..."`).

---

#### [ ] T11 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/PagosRts.php` | CREATE

**Delta:** Crear archivo siguiendo la estructura refactorizada de los otros Rts:

```php
<?php

require_once(__DIR__ . '/../controladores/PagosCtrl.php');
require_once(__DIR__ . '/RtsHelper.php');

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$pagosCtrl = new PagosCtrl();

$requestUri = $_SERVER['REQUEST_URI'];
$parsed = parsearAccionYParametro($requestUri, 'pagos');
$action = $parsed['accion'];
$actionParam = $parsed['parametro'];

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        if (!$action) {
            $pagosCtrl->healthCheck();
            break;
        }
        switch ($action) {
            case 'pendientes':
                if (!$actionParam) {
                    BaseCtrl::responderJsonEstandar(['error' => 'ID de usuario requerido'], 400);
                }
                $pagosCtrl->obtenerPagosPendientesVerificacion($actionParam);
                break;
            default:
                BaseCtrl::responderJsonEstandar(['error' => 'Acción no válida para método GET'], 400);
                break;
        }
        break;
    default:
        responderMetodoNoPermitido(['GET']);
        break;
}
```

**Note:** No hay registro de `Content-Type` si `headers_sent()` se cumple, igual que en los otros Rts.

---

### Grupo E — Front Controller y documentación

---

#### [ ] T12 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/index.php` | MODIFY

**Insert after:** línea 31 (`'/suscripcion' => 'rutas/SuscripcionRts.php',`)

**Delta:** Añadir una coma al final de la línea 31 y agregar la nueva entrada:

```php
$rutas = [
    '/planes' => 'rutas/PlanesRts.php',
    '/suscripcion' => 'rutas/SuscripcionRts.php',
    '/pagos' => 'rutas/PagosRts.php',
];
```

---

#### [ ] T13 | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/README.md` | MODIFY

**Insert after:** línea 227 (que contiene `"iUsuario": 12`)

**Delta:** Reemplazar `"iUsuario": 12` por `"sus_usuarioId": 12` en el ejemplo de `crearConPago`.

---

## Grupo F — Validaciones (ejecutar en orden tras implementar T1–T13)

Cada validación es una tarea con checkbox. Ejecutar el comando exacto indicado y registrar salida/HTTP observado en el Execution Report.

---

#### [ ] T14 | Health check `/planes`
```bash
curl -i http://localhost/rest_suscripcion/planes
```
**Esperado:** HTTP 200, body contiene `"status":"ok"` y `"service":"PlanesRTS"`

#### [ ] T15 | Health check `/suscripcion`
```bash
curl -i http://localhost/rest_suscripcion/suscripcion
```
**Esperado:** HTTP 200, body contiene `"status":"ok"` y `"service":"Suscripciones"`

#### [ ] T16 | Health check `/pagos` (nuevo — antes no existía)
```bash
curl -i http://localhost/rest_suscripcion/pagos
```
**Esperado:** HTTP 200, body contiene `"status":"ok"` y `"service":"PagosRTS"`

#### [ ] T17 | `GET /planes/disponible`
```bash
curl -i http://localhost/rest_suscripcion/planes/disponible
```
**Esperado:** HTTP 200 con array de objetos plan (campos `pin_idPlanInterv`, `pin_precioFinal`, etc.) o 404 si no hay datos.

#### [ ] T18 | `GET /planes/suscritos/{id}`
```bash
curl -i "http://localhost/rest_suscripcion/planes/suscritos/1"
```
**Esperado:** HTTP 200 con array de objetos (16 campos) o 404. Reemplazar `1` por un ID real si es necesario.

#### [ ] T19 | `GET /suscripcion/porUsuario` (antes siempre 500 — D6 corregido)
```bash
curl -i "http://localhost/rest_suscripcion/suscripcion/porUsuario?id=1"
```
**Esperado:** HTTP 200 o 404 (según exista el usuario). **No debe responder 500.** El body no debe contener "Error interno del servidor" concatenado con un ID.

#### [ ] T20 | `POST /suscripcion/crearSinPago`
```bash
curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearSinPago \
  -H "Content-Type: application/json" \
  -d '{"sus_usuarioId":1,"sus_pinIdPlanin":1}'
```
**Esperado:** HTTP 200 con JSON de objeto suscripción (10 campos).

#### [ ] T21 | `POST /suscripcion/crearConPago` (JSON puro — sin debug — A8/R3)
```bash
curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearConPago \
  -H "Content-Type: application/json" \
  -d '{"sus_usuarioId":1,"pin_idPlanInterv":1,"ins_numMeses":1,"pin_precioFinal":10,"idTransaccion":"TX-TEST-001","metodoPago":"test"}'
```
**Esperado:** HTTP 200, la respuesta debe comenzar con `{` (JSON puro, sin texto plano antepuesto como "Datos recibidos...").

#### [ ] T22 | BREAKING: `iUsuario` debe ser rechazado (R9/A14)
```bash
curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearConPago \
  -H "Content-Type: application/json" \
  -d '{"iUsuario":1,"pin_idPlanInterv":1,"ins_numMeses":1,"pin_precioFinal":10,"idTransaccion":"TX-TEST-002","metodoPago":"test"}'
```
**Esperado:** HTTP 400, body contiene `{"error":"El campo 'sus_usuarioId' es requerido"}`.

#### [ ] T23 | Idempotencia 409 (R6/A12)
Ejecutar dos veces seguidas el mismo comando:
```bash
curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearConPago \
  -H "Content-Type: application/json" \
  -d '{"sus_usuarioId":1,"pin_idPlanInterv":1,"ins_numMeses":1,"pin_precioFinal":10,"idTransaccion":"TX-IDEMPOTENCIA","metodoPago":"test"}'
```
**Esperado primera vez:** HTTP 200.
**Esperado segunda vez:** HTTP 409, body contiene `{"error":"El idTransaccion ya fue registrado"}`.

#### [ ] T24 | `GET /pagos/pendientes/{id}` (nuevo)
```bash
curl -i "http://localhost/rest_suscripcion/pagos/pendientes/1"
```
**Esperado:** HTTP 200 con array de objetos pago (6 campos) o 404.

---

## Grupo G — Validaciones de inspección de código

#### [ ] T25 | Sin código muerto comentado en BaseCtrl (D14/A13)
Inspeccionar `controladores/BaseCtrl.php`.
**Esperado:** No existe el bloque comentado de las líneas 30–56 (métodos `respuestaJson`, `respuestaExitosa`, `respuestaError`).

#### [ ] T26 | Sin `echo` de depuración en SuscripcionRts (D8/A8)
Inspeccionar `rutas/SuscripcionRts.php`.
**Esperado:** No existe `echo "Datos recibidos..."` (antes línea 117).

#### [ ] T27 | Sin duplicación SQL en PlanesMdl (D5/A5)
Inspeccionar `modelos/PlanesMdl.php`.
**Esperado:** Los 10 campos base del SELECT están extraídos a un lugar común (constante, variable, método privado). No hay dos cadenas SQL con los mismos 10 campos repetidos.

#### [ ] T28 | Alias `plin` en minúsculas (D16/A15)
Inspeccionar `modelos/PlanesMdl.php`.
**Esperado:** No aparece `PLIN.` en mayúsculas en ninguna consulta SQL.

#### [ ] T29 | Parámetro `sus_usuarioId` unificado (D15/A14)
Inspeccionar `controladores/SuscripcionCtrl.php`.
**Esperado:** `insertarSuscripcionSinPago` e `insertarSuscripcionConPago` usan `'sus_usuarioId'`. No debe aparecer `'iUsuario'` en campos requeridos ni en acceso a `$datosLimpios`.

#### [ ] T30 | Docblock corregido (D17/A16)
Inspeccionar `controladores/SuscripcionCtrl.php`.
**Esperado:** El docblock de `insertarSuscripcionSinPago` describe el método correctamente; no dice "Obtiene los planes disponibles".

#### [ ] T31 | `anexos/` intacto
Inspeccionar `rest_suscripcion/anexos/`.
**Esperado:** Los 6 archivos existentes no fueron creados, modificados ni eliminados.

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura. Marcar `[X]` solo cuando la acción está realmente completa y verificada.

### Resumen de tareas
- Total de tareas: 31
- Completadas [X]: _(pendiente)_
- Bloqueadas [BLOCKED]: _(pendiente)_
- Omitidas: _(pendiente)_

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | BaseCtrl.php |  |
| T2 |  | rutas/RtsHelper.php |  |
| T3 |  | PlanesMdl.php |  |
| T4 |  | SuscripcionMdl.php |  |
| T5 |  | PagosMdl.php |  |
| T6 |  | PlanesCtrl.php |  |
| T7 |  | SuscripcionCtrl.php |  |
| T8 |  | PagosCtrl.php |  |
| T9 |  | PlanesRts.php |  |
| T10 |  | SuscripcionRts.php |  |
| T11 |  | rutas/PagosRts.php |  |
| T12 |  | index.php |  |
| T13 |  | README.md |  |
| T14 |  | (validación) |  |
| T15 |  | (validación) |  |
| T16 |  | (validación) |  |
| T17 |  | (validación) |  |
| T18 |  | (validación) |  |
| T19 |  | (validación) |  |
| T20 |  | (validación) |  |
| T21 |  | (validación) |  |
| T22 |  | (validación) |  |
| T23 |  | (validación) |  |
| T24 |  | (validación) |  |
| T25 |  | (validación) |  |
| T26 |  | (validación) |  |
| T27 |  | (validación) |  |
| T28 |  | (validación) |  |
| T29 |  | (validación) |  |
| T30 |  | (validación) |  |
| T31 |  | (validación) |  |

### Validaciones ejecutadas

| ID | Comando exacto ejecutado | Salida / HTTP observado | Esperado | ¿Coincide? |
|----|--------------------------|-------------------------|----------|------------|
|    |                          |                         |          |            |

### Blockers
- _(descripción del bloqueo, tarea afectada y qué se necesita para desbloquear)_

### Archivos cambiados

| Path | Acción | Resumen |
|------|--------|---------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/BaseCtrl.php` | MODIFY | Añadir `responderJsonEstandar`, `validarIDPositivo`; eliminar código comentado |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/RtsHelper.php` | CREATE | Funciones compartidas `parsearAccionYParametro`, `responderMetodoNoPermitido` |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/PlanesMdl.php` | MODIFY | Extraer SQL base común; unificar alias `PLIN` → `plin` |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/SuscripcionMdl.php` | MODIFY | Corregir precedencia SQL con paréntesis |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/PagosMdl.php` | MODIFY | Añadir `existePagoPorTransaccion` |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/PlanesCtrl.php` | MODIFY | Añadir `healthCheck`, `mapearPlan`; reemplazar validación; eliminar debug |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/SuscripcionCtrl.php` | MODIFY | Añadir `healthCheck`, `mapearSuscripcion`; corregir D6/D11/D14/D15/D16/D17; añadir idempotencia |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/PagosCtrl.php` | MODIFY | Añadir `healthCheck`; reemplazar validación |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/PlanesRts.php` | MODIFY | Refactor a RtsHelper + healthCheck vía controlador |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/SuscripcionRts.php` | MODIFY | Refactor a RtsHelper + healthCheck vía controlador; eliminar echo debug |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/PagosRts.php` | CREATE | Nuevo enrutamiento dominio pagos |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/index.php` | MODIFY | Registrar `/pagos` en mapa `$rutas` |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/README.md` | MODIFY | Actualizar ejemplo `iUsuario` → `sus_usuarioId` |

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas se ejecutaron y su resultado quedó registrado.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según las reglas de estado (COMPLETADO solo si T1–T31 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
