# HLT-RF-002 — Contrato Técnico de Alto Nivel: Refactor del código backend de `rest_suscripcion`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-002_refactor_codigo_backend.md`](../rf/RF-002_refactor_codigo_backend.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Servicio afectado:** `rest_suscripcion` (autónomo; no se replica en otros `rest_*`).
> **Versión HLT:** 1.0.0
> **Fecha:** 2026-07-17

---

## Estado del HLT

| Campo | Valor |
|-------|-------|
| **Estado** | `PROPUESTO` |
| Aprobación senior | `PENDIENTE` |
| Fecha de aprobación | — |
| Fecha de cierre | — |

### Reglas de estado (mandatorias)

- El HLT nace en `PROPUESTO`. El agente planificador entrega **todos los checkboxes en `[ ]`**.
- Un senior debe aprobar el HLT (§6 de `doc_modo_planificacion.md`) antes de que el agente implementador ejecute tarea alguna. Al aprobar, cambiar `Aprobación senior` a `APROBADO` y el `Estado` a `EN EJECUCIÓN`.
- El agente implementador **solo** puede cambiar el `Estado` del HLT a **`COMPLETADO`** cuando se cumplan **todas** estas condiciones simultáneamente:
  1. **Todas** las tareas `T1`–`T31` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T18`–`T31`) se ejecutaron y su resultado observado **coincide** con el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`**.
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`** o **`PARCIAL`**.

---

## 1. Objetivo

Corregir 17 defectos de calidad en el código PHP de `rest_suscripcion` (D1–D17 del RF-002): eliminar duplicación entre archivos de rutas, migrar respuestas a `BaseCtrl`, sustituir validación manual repetida, extraer mapeos de fila duplicados, eliminar código de depuración en producción, completar el dominio `Pagos` sin punto de entrada HTTP, corregir bugs de precedencia SQL y reasignación descartada, añadir idempotencia a pagos, y homogeneizar nomenclatura y comentarios.

---

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en el servicio `rest_suscripcion`:

- `configuracion/*` — sin cambios (no se toca `global.php`, `enlace.php`, `CorsConfig.php`)
- `controladores/BaseCtrl.php` — MODIFY: eliminar código comentado muerto, añadir `responderJsonEstandar` estático público, añadir `validarIDPositivo`
- `controladores/PlanesCtrl.php` — MODIFY: sustituir validación manual, extraer mapeo de plan, eliminar debug comentado
- `controladores/SuscripcionCtrl.php` — MODIFY: eliminar líneas de depuración, sustituir validación, extraer mapeo de suscripción, corregir reasignación, unificar `sus_usuarioId`, corregir docblock, añadir idempotencia
- `controladores/PagosCtrl.php` — MODIFY: sustituir validación manual
- `modelos/PlanesMdl.php` — MODIFY: extraer SQL base común, unificar alias `PLIN` → `plin`
- `modelos/SuscripcionMdl.php` — MODIFY: corregir precedencia SQL
- `modelos/PagosMdl.php` — MODIFY: añadir `existePagoPorTransaccion`
- `rutas/RtsHelper.php` — CREATE: funciones compartidas de parseo de URI y respuesta 405
- `rutas/PlanesRts.php` — MODIFY: refactor para usar `RtsHelper` y health check vía controlador
- `rutas/SuscripcionRts.php` — MODIFY: refactor para usar `RtsHelper` y health check vía controlador; eliminar `echo` de depuración
- `rutas/PagosRts.php` — CREATE: nuevo enrutamiento para dominio pagos
- `index.php` — MODIFY: registrar `/pagos` en mapa `$rutas`
- `README.md` — MODIFY: actualizar ejemplo de `crearConPago` cambiando `iUsuario` a `sus_usuarioId` (cambio BREAKING)

---

## 3. Out-of-scope (qué NO entra)

- **No** implementar JWT ni middleware de autenticación (D13 — corresponde a RF separado cross-servicio).
- **No** externalizar credenciales de BD a variables de entorno.
- **No** tocar `.htaccess` (cubierto por RF-001/HLT-RF-001).
- **No** invocar ni conectar procedimientos almacenados de `anexos/`.
- **No** modificar `anexos/` en absoluto.
- **No** modificar `docs/` (salvo la creación de este HLT).
- **No** migrar a Composer/PSR-4 ni introducir framework.
- **No** modificar `configuracion/enlace.php`, `configuracion/global.php` ni `configuracion/CorsConfig.php`.
- **No** añadir nuevos endpoints de negocio no declarados (el único endpoint nuevo es el health check de `/pagos`, que es aditivo y no rompe clientes existentes).

---

## 4. Impacto en contratos públicos

### 4.1. Endpoints existentes (comportamiento preservado)

| Método | Ruta | Contrato de éxito | Contrato de error | Cambio |
|--------|------|-------------------|-------------------|--------|
| `GET` | `/planes` | 200 + `{"status":"ok","timestamp","version","service":"PlanesRTS"}` | — | **NO-BREAKING**: misma forma, pierde pretty-print |
| `GET` | `/planes/disponible` | 200 + array de objetos plan (10 campos) | 404 si vacío; 400 si parámetro inválido; 500 genérico | **NO-BREAKING**: misma estructura, validación vía `BaseCtrl` |
| `GET` | `/planes/suscritos/{id}` | 200 + array de objetos plan (16 campos) | 404 si vacío; 400 si ID inválido; 500 genérico | **NO-BREAKING**: misma estructura, validación vía `BaseCtrl` |
| `GET` | `/suscripcion` | 200 + `{"status":"ok","timestamp","version","service":"Suscripciones"}` | — | **NO-BREAKING**: misma forma, pierde pretty-print |
| `GET` | `/suscripcion/porUsuario?id={id}` | 200 + array de objetos suscripción (10 campos) | 404 si vacío; 400 si ID inválido; 500 genérico | **BREAKING**: antes siempre respondía 500 por bug D6; ahora responde según lógica real (200/404) |
| `POST` | `/suscripcion/crearSinPago` | 200 + objeto suscripción (10 campos) | 400 si falta campo requerido; 404 si no se crea; 500 genérico | **NO-BREAKING**: misma estructura, validación vía `BaseCtrl` |
| `POST` | `/suscripcion/crearConPago` | 200 + objeto suscripción (10 campos) | 400 si falta campo requerido; 404 si no se crea; 409 si `idTransaccion` duplicado (nuevo); 500 genérico | **BREAKING**: campo `iUsuario` renombrado a `sus_usuarioId`; JSON puro sin prefijo de texto de depuración; responde 409 ante duplicado |

### 4.2. Endpoints nuevos

| Método | Ruta | Contrato de éxito | Contrato de error |
|--------|------|-------------------|-------------------|
| `GET` | `/pagos` | 200 + `{"status":"ok","timestamp","version","service":"PagosRTS"}` | — |
| `GET` | `/pagos/pendientes/{id}` | 200 + array de objetos pago (6 campos) | 404 si vacío; 400 si ID inválido; 500 genérico |

### 4.3. Resumen de códigos HTTP

| Código | Uso |
|--------|-----|
| 200 | Éxito |
| 400 | Validación de entrada (campo requerido faltante, ID inválido, JSON malformado) |
| 404 | Recurso no encontrado (sin resultados) |
| 405 | Método HTTP no permitido |
| 409 | Conflicto: `idTransaccion` ya registrado (nuevo, R6) |
| 500 | Error interno del servidor (mensaje genérico, detalle a `error_log`) |

---

## 5. Compatibilidad

**BREAKING** (cambios declarados que afectan al SPA):

1. `GET /suscripcion/porUsuario` — deja de responder siempre 500; ahora responde 200/404 según la lógica real. Cualquier cliente que dependía del estado "siempre 500" como señal rompe.
2. `POST /suscripcion/crearConPago` — el campo `iUsuario` se renombra a `sus_usuarioId`; el SPA debe enviar `sus_usuarioId` en el body. La respuesta deja de tener texto de depuración antepuesto (JSON puro).
3. `POST /suscripcion/crearConPago` — ahora puede responder 409 si `idTransaccion` ya fue registrado.

Los health checks y endpoints de solo GET sin cambios de comportamiento son NO-BREAKING.

---

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Front Controller | `rest_suscripcion/index.php` | MODIFY (registrar `/pagos`) |
| Enrutamiento | `rest_suscripcion/rutas/RtsHelper.php` | CREATE |
| Enrutamiento | `rest_suscripcion/rutas/PlanesRts.php` | MODIFY |
| Enrutamiento | `rest_suscripcion/rutas/SuscripcionRts.php` | MODIFY |
| Enrutamiento | `rest_suscripcion/rutas/PagosRts.php` | CREATE |
| Controlador base | `rest_suscripcion/controladores/BaseCtrl.php` | MODIFY |
| Controladores | `rest_suscripcion/controladores/PlanesCtrl.php` | MODIFY |
| Controladores | `rest_suscripcion/controladores/SuscripcionCtrl.php` | MODIFY |
| Controladores | `rest_suscripcion/controladores/PagosCtrl.php` | MODIFY |
| Modelos | `rest_suscripcion/modelos/PlanesMdl.php` | MODIFY |
| Modelos | `rest_suscripcion/modelos/SuscripcionMdl.php` | MODIFY |
| Modelos | `rest_suscripcion/modelos/PagosMdl.php` | MODIFY |
| Documentación | `rest_suscripcion/README.md` | MODIFY |

No se toca `configuracion/`, `anexos/`, `.htaccess` ni `docs/`. Servicio único: `rest_suscripcion`.

---

## 7. Delta arquitectónico

### 7.1. Tabla de Delta

| Capa | Artefacto | Acción | Detalle cerrado |
|------|-----------|--------|-----------------|
| Controlador | `BaseCtrl.php` | MODIFY | **A2/A3/A13.** (a) Añadir `public static function responderJsonEstandar(array $datos, int $httpCode = 200): void` que emite `http_response_code`, `Content-Type: application/json; charset=utf-8`, `echo json_encode($datos, JSON_UNESCAPED_UNICODE)`, `exit`. (b) Añadir `protected function validarIDPositivo($id, string $nombreCampo = 'id'): int` que usa `validarDatos` + `limpiarDatos` + cast a `(int)` + `<= 0`; retorna el ID limpio o hace `exit` con 400. (c) Eliminar el bloque comentado (líneas 30–56) que contenía `respuestaJson`, `respuestaExitosa`, `respuestaError` antiguas. |
| Modelo | `PlanesMdl.php` | MODIFY | **A5/A15.** (a) Extraer el `SELECT` base de 10 campos compartido entre `obtenerPlanesDisponibles` y `obtenerPlanesSuscriptosSinPagar` a un `private` o a una constante/propiedad. (b) Reemplazar `PLIN.pins_idInterSuscrip` por `plin.pins_idInterSuscrip` en ambas consultas (unificar alias en minúsculas). |
| Modelo | `SuscripcionMdl.php` | MODIFY | **A10.** Envolver la condición completa de `WHERE` entre paréntesis en `obtenerSuscripcionPorIDUsuario` para que `CURRENT_DATE BETWEEN sus_fechainicio AND sus_fechaFin` aplique a ambas ramas del `OR`. |
| Modelo | `PagosMdl.php` | MODIFY | **A12.** Añadir método `public function existePagoPorTransaccion(string $idTransaccion): bool` que ejecuta `SELECT pag_id FROM spsu_pagos WHERE pag_idTransac = ?` y retorna `true` si existe al menos una fila. |
| Controlador | `PlanesCtrl.php` | MODIFY | **A3/A4/A7.** (a) En `obtenerPlanesSuscritosSinPagar`: reemplazar el bloque manual (líneas 60–69) por `$id = $this->validarIDPositivo($idUsuario, 'idUsuario')`. (b) Extraer un método privado `private function mapearPlan(array $fila): array` que contenga el mapeo de 10 campos. (c) Eliminar la línea comentada (línea 70). |
| Controlador | `SuscripcionCtrl.php` | MODIFY | **A3/A4/A6/A11/A12/A14/A16.** (a) En `obtenerSuscripcionesPorUsuario`: eliminar las dos líneas que llaman a `respuestaErrorSimple(..., 500)` (líneas 22 y 34). (b) En ese mismo método, reemplazar la validación manual (líneas 24–33) por `$id = $this->validarIDPositivo($idUsuario, 'id')`. (c) Extraer un método privado `private function mapearSuscripcion(array $fila): array` con el mapeo de 10 campos; reemplazar los 3 bloques idénticos. (d) En `insertarSuscripcionConPago`: reemplazar `'iUsuario'` por `'sus_usuarioId'` en el array de campos requeridos (línea 130) y en el acceso (línea 137). (e) En `insertarSuscripcionConPago`: corregir la reasignación muerta (líneas 156–161) eliminando la línea `$idSuscripcionDB = $sis_idSuscrip;` que siempre sobrescribe el valor calculado. (f) En `insertarSuscripcionConPago`, antes de llamar a `$this->pagosServicio->insertarPagoSuscripcion(...)`, verificar idempotencia: si `$this->pagosServicio->existePagoPorTransaccion($idTransaccion)` responde `true`, ejecutar `$this->respuestaErrorSimple('El idTransaccion ya fue registrado', 409)`. (g) En `insertarSuscripcionSinPago`: corregir el docblock (líneas 65–68) que incorrectamente dice "Obtiene los planes disponibles", reemplazar por la descripción correcta del método. |
| Controlador | `PagosCtrl.php` | MODIFY | **A3.** En `obtenerPagosPendientesVerificacion`: reemplazar el bloque manual de validación de ID (líneas 19–28) por `$id = $this->validarIDPositivo($idUsuario, 'idUsuario')`. |
| Ruta | `RtsHelper.php` | CREATE | **A1/A2.** Crear el archivo con dos funciones globales: (a) `function parsearAccionYParametro(string $uriCompleta, string $palabraClave): array` que extrae `['accion' => string|null, 'parametro' => string|null]` desde la URI. (b) `function responderMetodoNoPermitido(array $metodosPermitidos): void` que llama a `BaseCtrl::responderJsonEstandar(...)` con código 405 y el formato `{"error":"Método no permitido","metodos_permitidos":[...]}`. |
| Ruta | `PlanesRts.php` | MODIFY | **A1/A2.** (a) Reemplazar el parseo manual de URI por `parsearAccionYParametro($requestUri, 'planes')`. (b) Reemplazar el bloque de health check por una llamada a `$planesCtrl->healthCheck()`. (c) Reemplazar el `default` del switch de método (líneas 33–39) por `responderMetodoNoPermitido(['GET', 'POST'])`. (d) Reemplazar el bloque de respuesta 400 manual (líneas 65–73) por la respuesta estándar vía `BaseCtrl::responderJsonEstandar`. |
| Ruta | `SuscripcionRts.php` | MODIFY | **A1/A2/A8.** (a) Reemplazar el parseo manual de URI por `parsearAccionYParametro($requestUri, 'suscripcion')`. (b) Reemplazar el bloque de health check por una llamada a `$suscripcionCtrl->healthCheck()`. (c) Reemplazar el `default` del switch de método (líneas 32–38) por `responderMetodoNoPermitido(['GET', 'POST'])`. (d) Reemplazar todos los `echo json_encode(...)` manuales por `BaseCtrl::responderJsonEstandar(...)`. (e) Eliminar la línea 117 (`echo "Datos recibidos..."`). |
| Ruta | `PagosRts.php` | CREATE | **A9.** Crear archivo siguiendo el patrón refactorizado: incluye `require_once` de `PagosCtrl.php` y `RtsHelper.php`, instancia `PagosCtrl`, parsea URI con `parsearAccionYParametro($requestUri, 'pagos')`, dispatching GET con health check (`$pagosCtrl->healthCheck()`) y acción `pendientes/{id}` (`$pagosCtrl->obtenerPagosPendientesVerificacion($id)`). Incluye `responderMetodoNoPermitido(['GET'])` como default. |
| Front Controller | `index.php` | MODIFY | **A9.** Añadir `'/pagos' => 'rutas/PagosRts.php'` al mapa `$rutas`. |
| Documentación | `README.md` | MODIFY | **A14.** En el ejemplo de `crearConPago` (líneas 223–235), cambiar `"iUsuario"` a `"sus_usuarioId"`. |

### 7.2. Métodos públicos nuevos en controladores (health check)

Cada controlador (`PlanesCtrl`, `SuscripcionCtrl`, `PagosCtrl`) recibe un método público:

```
public function healthCheck(): void {
    $this->respuestaExitosaSimple([
        'status' => 'ok',
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '1.0.0',
        'service' => '<NombreServicio>'  // 'PlanesRTS', 'Suscripciones', 'PagosRTS'
    ]);
}
```

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción | Motivo |
|---------------|--------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/BaseCtrl.php` | MODIFY | A2/A3/A13: añadir `responderJsonEstandar`, `validarIDPositivo`, eliminar código muerto comentado |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/PlanesCtrl.php` | MODIFY | A3/A4/A7: validación por `BaseCtrl`, extraer mapeo, eliminar debug comentado |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/SuscripcionCtrl.php` | MODIFY | A3/A4/A6/A11/A12/A14/A16: múltiples correcciones |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/PagosCtrl.php` | MODIFY | A3: validación por `BaseCtrl` |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/PlanesMdl.php` | MODIFY | A5/A15: extraer SQL base, unificar alias |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/SuscripcionMdl.php` | MODIFY | A10: corregir precedencia SQL |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/PagosMdl.php` | MODIFY | A12: añadir `existePagoPorTransaccion` |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/RtsHelper.php` | CREATE | A1/A2: funciones compartidas de Rts |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/PlanesRts.php` | MODIFY | A1/A2: refactor a helpers + health check vía controlador |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/SuscripcionRts.php` | MODIFY | A1/A2/A8: refactor + eliminar echo debug |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/PagosRts.php` | CREATE | A9: nuevo enrutamiento pagos |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/index.php` | MODIFY | A9: registrar `/pagos` |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/README.md` | MODIFY | A14: ejemplo `iUsuario` → `sus_usuarioId` |

---

## 9. Estrategia de validación

Cada comprobación es una tarea con checkbox (T18–T31) en §12. Las verificaciones HTTP asumen Apache sirviendo el servicio en `http://localhost/rest_suscripcion/`.

- **Health checks (R1):** verificar que los tres dominios (`/planes`, `/suscripcion`, `/pagos`) responden 200 con JSON de estado `ok`.
- **Corrección bug D6 (R2):** `GET /suscripcion/porUsuario?id=<id_valido>` ya no responde 500; responde 200 o 404 según existencia.
- **JSON puro sin debug (R3):** `POST /suscripcion/crearConPago` responde JSON sin texto plano antepuesto.
- **Idempotencia (R6):** reintentar `POST /suscripcion/crearConPago` con mismo `idTransaccion` → 409.
- **BREAKING A14:** enviar `iUsuario` en vez de `sus_usuarioId` → 400.
- **Inspección de archivos:** verificar que `BaseCtrl.php` no tenga código comentado muerto, que `SuscripcionRts.php` no tenga `echo` de depuración, que `PlanesMdl.php` no tenga alias `PLIN` en mayúsculas, que `insertarSuscripcionConPago` use `sus_usuarioId`.

---

## 10. Riesgos

- **Regresión en endpoints existentes.** Al reemplazar validación manual por `validarIDPositivo`, algún borde (ID como string vacío, null, negativo) podría cambiar el mensaje o código HTTP. *Mitigación:* T18–T25 prueban cada endpoint con casos de éxito y error, comparando salida contra el comportamiento esperado (no contra el mensaje textual anterior, salvo para los cambios declarados).
- **Precedencia SQL corregida.** `obtenerSuscripcionPorIDUsuario` puede ahora excluir registros que antes devolvía (porque el filtro de vigencia aplica a ambas ramas del `OR`). *Mitigación:* cambio declarado en R5 del RF-002; T24 verifica el comportamiento esperado.
- **Idempotencia bloquea creación legítima.** La comprobación por `idTransaccion` asume que `idTransaccion` es único; si el frontend genera IDs no únicos, el endpoint rechazará la segunda petición. *Mitigación:* comportamiento declarado en R6 y esperado por la regla de negocio; T26 verifica.
- **PagosRts recién creado puede tener errores de ruteo.** *Mitigación:* T17 (health check /pagos) y T21 (GET /pagos/pendientes) verifican.

---

## 11. Rollback

- **Global:** restaurar los 13 archivos modificados/creados desde el control de versiones (Git). Eliminar `rutas/PagosRts.php` y `rutas/RtsHelper.php` si fueron creados. No hay cambios en BD (el único cambio es de código PHP y documentación). No hay cambios en `anexos/` ni `configuracion/`.
- **Por artefacto:** revertir cada archivo a su estado anterior. Para `index.php`, eliminar la entrada `'/pagos'` del mapa `$rutas`.
- **Para cambios de contrato (BREAKING):** si se necesita revertir el renombrado `iUsuario` → `sus_usuarioId`, restaurar `SuscripcionCtrl.php` y `README.md` a su versión anterior.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` = realizado y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado, con razón. Un checkbox = una acción verificable. Todos se entregan en `[ ]`.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_suscripcion` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/` |
| Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) |
| Capa de datos | `configuracion/enlace.php` (clase `Enlace`, `bind_param`) |
| Capa de respuesta | `controladores/BaseCtrl.php` (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`) |
| BD | MySQL/MariaDB — `DB_NAME=sist_criteriokelly` |
| Prefijo de tablas | `spsu_` |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `curl http://localhost/rest_suscripcion/planes` |
| Logs | `logs/php_errors.log` del servicio |
| Dominios registrados en index.php | `planes`, `suscripcion` (más `pagos` tras T16) |

### Grupo A — Base y utilidades compartidas

- `[ ]` **T1** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/BaseCtrl.php` | MODIFY
  - Delta: (a) Añadir `public static function responderJsonEstandar(array $datos, int $httpCode = 200): void` usando `http_response_code`, `header('Content-Type: application/json; charset=utf-8')`, `echo json_encode($datos, JSON_UNESCAPED_UNICODE)`, `exit`. (b) Añadir `protected function validarIDPositivo($id, string $nombreCampo = 'id'): int` que valida requerido con `validarDatos`, limpia con `limpiarDatos`, castea a `(int)`, verifica `<= 0`, retorna el ID limpio o hace `exit` con 400. (c) Eliminar el bloque comentado de las líneas 30–56 (métodos `respuestaJson`, `respuestaExitosa`, `respuestaError` antiguos).
  - Insert after: línea 29 (justo después de `return $datosLimpios;}` de `limpiarDatos`).

- `[ ]` **T2** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/RtsHelper.php` | CREATE
  - Delta: Crear archivo con dos funciones globales. (1) `function parsearAccionYParametro(string $uriCompleta, string $palabraClave): array` — toma `$_SERVER['REQUEST_URI']`, parsea el path, busca la palabra clave, extrae el siguiente segmento como `accion` y el siguiente a ese como `parametro`. Retorna `['accion' => ?string, 'parametro' => ?string]`. (2) `function responderMetodoNoPermitido(array $metodosPermitidos): void` — llama a `BaseCtrl::responderJsonEstandar(['error' => 'Método no permitido', 'metodos_permitidos' => $metodosPermitidos], 405)`.
  - Note: No requiere `require_once` de BaseCtrl aquí; quien incluya este archivo ya debe haber incluido BaseCtrl.

### Grupo B — Modelos

- `[ ]` **T3** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/PlanesMdl.php` | MODIFY
  - Delta: (a) Extraer los 10 campos del `SELECT` base (`plin.pin_idPlanInterv` … `pla.pla_numCuentas`) a una constante privada o variable reutilizable. (b) En ambas consultas (`obtenerPlanesDisponibles` y `obtenerPlanesSuscriptosSinPagar`), reemplazar `PLIN.pins_idInterSuscrip` por `plin.pins_idInterSuscrip`.
  - Insert after: línea 12 (después del constructor, antes del primer método).

- `[ ]` **T4** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/SuscripcionMdl.php` | MODIFY
  - Delta: En `obtenerSuscripcionPorIDUsuario` (línea 27–32), envolver la condición completa del `WHERE` entre paréntesis: `WHERE (sis_idSuscrip = ? OR (sus_usuarioId = ? AND ...)) AND CURRENT_DATE BETWEEN sus_fechainicio AND sus_fechaFin`.
  - Insert after: línea 30 (dentro de la cadena SQL, reemplazando la condición existente).

- `[ ]` **T5** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/modelos/PagosMdl.php` | MODIFY
  - Delta: Añadir método `public function existePagoPorTransaccion(string $idTransaccion): bool` que ejecuta `SELECT pag_id FROM spsu_pagos WHERE pag_idTransac = ?` con `ejecutarConsultaSimpleFila` y retorna `true` si la fila existe.
  - Insert after: línea 12 (después del constructor, antes de `insertarPagoSuscripcion`).

### Grupo C — Controladores

- `[ ]` **T6** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/PlanesCtrl.php` | MODIFY
  - Delta: (a) Añadir `public function healthCheck(): void` que responde con `respuestaExitosaSimple(['status'=>'ok','timestamp'=>date('Y-m-d H:i:s'),'version'=>'1.0.0','service'=>'PlanesRTS'])`. (b) En `obtenerPlanesSuscritosSinPagar` (líneas 60–69): reemplazar el bloque de validación manual (4 líneas) por `$id = $this->validarIDPositivo($idUsuario, 'idUsuario')`. (c) Extraer método privado `private function mapearPlan(array $fila): array` con los 10 campos `pin_idPlanInterv`…`pla_numCuentas` y usarlo en `obtenerPlanesDisponibles` (líneas 33–47) y `obtenerPlanesSuscritosSinPagar` (líneas 78–98). (d) Eliminar la línea 70 (comentario de debug).
  - Insert after: línea 14 (después del constructor).

- `[ ]` **T7** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/SuscripcionCtrl.php` | MODIFY
  - Delta: **(a)** Añadir `public function healthCheck(): void` (similar a PlanesCtrl, con `'service'=>'Suscripciones'`). **(b)** En `obtenerSuscripcionesPorUsuario`: eliminar línea 22 (`$this->respuestaErrorSimple('Error interno del servidor'.$idUsuario, 500);`) y línea 34 (ídem). Reemplazar la validación manual (líneas 24–33) por `$id = $this->validarIDPositivo($idUsuario, 'id')`. **(c)** Extraer método privado `private function mapearSuscripcion(array $fila): array` con los 10 campos `sis_idSuscrip`…`sus_fechaCrea`; reemplazar los 3 bloques de mapeo (líneas 44–56, 106–117, 187–198). **(d)** En `insertarSuscripcionConPago`: reemplazar en línea 130 `'iUsuario'` por `'sus_usuarioId'`; reemplazar en línea 137 `$datosLimpios['iUsuario']` por `$datosLimpios['sus_usuarioId']`. **(e)** En `insertarSuscripcionConPago`: eliminar la línea 161 (`$idSuscripcionDB = $sis_idSuscrip;`) que sobrescribe el valor calculado. **(f)** En `insertarSuscripcionConPago`, antes de línea 175 (antes de `$this->pagosServicio->insertarPagoSuscripcion(...)`), insertar: `if ($this->pagosServicio->existePagoPorTransaccion($idTransaccion)) { $this->respuestaErrorSimple('El idTransaccion ya fue registrado', 409); }`. **(g)** En `insertarSuscripcionSinPago`: corregir el docblock (líneas 65–68) reemplazando "Obtiene los planes disponibles" por la descripción real del método.
  - Insert after: línea 16 (después del constructor).

- `[ ]` **T8** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/controladores/PagosCtrl.php` | MODIFY
  - Delta: (a) Añadir `public function healthCheck(): void` (similar a PlanesCtrl, con `'service'=>'PagosRTS'`). (b) En `obtenerPagosPendientesVerificacion`: reemplazar el bloque manual de validación (líneas 19–28) por `$id = $this->validarIDPositivo($idUsuario, 'idUsuario')`.
  - Insert after: línea 13 (después del constructor).

### Grupo D — Rutas

- `[ ]` **T9** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/PlanesRts.php` | MODIFY
  - Delta: (a) Sustituir el bucle de parseo URI (líneas 13–27) por `$parsed = parsearAccionYParametro($requestUri, 'planes'); list($action, $actionParam) = [$parsed['accion'], $parsed['parametro']];`. (b) Reemplazar el bloque `if (!$action) { ... }` del health check por `$planesCtrl->healthCheck(); return;`. (c) Reemplazar el `default` del switch de método (líneas 33–39) por `responderMetodoNoPermitido(['GET', 'POST']);`. (d) Reemplazar los `echo json_encode(...)` de respuesta manual (líneas 65–73) por `BaseCtrl::responderJsonEstandar(...)`.
  - Insert after: línea 1 (después del `<?php`).

- `[ ]` **T10** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/SuscripcionRts.php` | MODIFY
  - Delta: (a) Sustituir el bucle de parseo URI (líneas 13–23) por `$parsed = parsearAccionYParametro($requestUri, 'suscripcion'); $action = $parsed['accion'];`. (b) Reemplazar el bloque `if (!$action) { ... }` del health check por `$suscripcionCtrl->healthCheck(); return;`. (c) Reemplazar el `default` del switch de método (líneas 32–38) por `responderMetodoNoPermitido(['GET', 'POST']);`. (d) Reemplazar todos los `echo json_encode(...)` manuales del resto del archivo por `BaseCtrl::responderJsonEstandar(...)`. (e) Eliminar la línea 117 (`echo "Datos recibidos..."`).
  - Insert after: línea 1 (después del `<?php`).

- `[ ]` **T11** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/rutas/PagosRts.php` | CREATE
  - Delta: Crear archivo siguiendo el patrón refactorizado de PlanesRts/SuscripcionRts. Debe incluir: `require_once` de `PagosCtrl.php` y `RtsHelper.php` (ruta relativa `__DIR__ . '/../controladores/PagosCtrl.php'` y `__DIR__ . '/RtsHelper.php'`), instanciar `PagosCtrl`, parsear URI con `parsearAccionYParametro($requestUri, 'pagos')`, switch por método (GET principalmente), health check vía `$pagosCtrl->healthCheck()`, y acción `pendientes/{id}` llamando a `$pagosCtrl->obtenerPagosPendientesVerificacion($id)`. Incluir `responderMetodoNoPermitido(['GET'])` como default del switch de método.
  - Note: Seguir la estructura de PlanesRts.php después del refactor (T9), adaptando el nombre del dominio a `pagos`.

### Grupo E — Front Controller y documentación

- `[ ]` **T12** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/index.php` | MODIFY
  - Delta: Añadir `'/pagos' => 'rutas/PagosRts.php',` al mapa `$rutas` (después de la línea 31).
  - Insert after: línea 31 (`'/suscripcion' => 'rutas/SuscripcionRts.php',`).

- `[ ]` **T13** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_suscripcion/README.md` | MODIFY
  - Delta: En el ejemplo de `crearConPago` (aproximadamente línea 227), cambiar `"iUsuario": 12` por `"sus_usuarioId": 12`.
  - Insert after: localizar la línea que contiene `"iUsuario"` en el ejemplo JSON y reemplazar.

### Grupo F — Validaciones funcionales

- `[ ]` **T14** | Validación — health check `/planes` — Ejecutar `curl -i http://localhost/rest_suscripcion/planes`. **Esperado:** HTTP 200, cuerpo JSON con `"status":"ok"` y `"service":"PlanesRTS"`.

- `[ ]` **T15** | Validación — health check `/suscripcion` — Ejecutar `curl -i http://localhost/rest_suscripcion/suscripcion`. **Esperado:** HTTP 200, cuerpo JSON con `"status":"ok"` y `"service":"Suscripciones"`.

- `[ ]` **T16** | Validación — health check `/pagos` (nuevo) — Ejecutar `curl -i http://localhost/rest_suscripcion/pagos`. **Esperado:** HTTP 200, cuerpo JSON con `"status":"ok"` y `"service":"PagosRTS"`.

- `[ ]` **T17** | Validación — `GET /planes/disponible` — Ejecutar `curl -i http://localhost/rest_suscripcion/planes/disponible`. **Esperado:** HTTP 200, cuerpo JSON con array de objetos plan (10 campos cada uno), o 404 si no hay datos.

- `[ ]` **T18** | Validación — `GET /planes/suscritos/{id}` — Ejecutar `curl -i "http://localhost/rest_suscripcion/planes/suscritos/1"`. **Esperado:** HTTP 200 con array, o 404 si no hay suscripciones. Reemplazar `1` por un ID real de usuario si es necesario.

- `[ ]` **T19** | Validación — `GET /suscripcion/porUsuario` (corrección D6) — Ejecutar `curl -i "http://localhost/rest_suscripcion/suscripcion/porUsuario?id=1"`. **Esperado:** HTTP 200 o 404 según exista el usuario. **No debe responder 500.** El cuerpo NO debe contener "Error interno del servidor".

- `[ ]` **T20** | Validación — `POST /suscripcion/crearSinPago` — Ejecutar `curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearSinPago -H "Content-Type: application/json" -d '{"sus_usuarioId":1,"sus_pinIdPlanin":1}'`. **Esperado:** HTTP 200 con JSON de objeto suscripción.

- `[ ]` **T21** | Validación — `POST /suscripcion/crearConPago` sin debug (A8/R3) — Ejecutar `curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearConPago -H "Content-Type: application/json" -d '{"sus_usuarioId":1,"pin_idPlanInterv":1,"ins_numMeses":1,"pin_precioFinal":10,"idTransaccion":"TX-TEST-001","metodoPago":"test"}'`. **Esperado:** HTTP 200, la respuesta debe comenzar con `{` (JSON puro, sin texto plano antepuesto).

- `[ ]` **T22** | Validación — BREAKING: `iUsuario` rechazado (R9/A14) — Ejecutar `curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearConPago -H "Content-Type: application/json" -d '{"iUsuario":1,"pin_idPlanInterv":1,"ins_numMeses":1,"pin_precioFinal":10,"idTransaccion":"TX-TEST-002","metodoPago":"test"}'`. **Esperado:** HTTP 400, body con `{"error":"El campo 'sus_usuarioId' es requerido"}`.

- `[ ]` **T23** | Validación — idempotencia 409 (R6/A12) — Ejecutar dos veces seguidas: `curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearConPago -H "Content-Type: application/json" -d '{"sus_usuarioId":1,"pin_idPlanInterv":1,"ins_numMeses":1,"pin_precioFinal":10,"idTransaccion":"TX-IDEMPOTENCIA","metodoPago":"test"}'`. La primera debe responder 200 (si el usuario/plan existen), la segunda **409** con `{"error":"El idTransaccion ya fue registrado"}`.

- `[ ]` **T24** | Validación — `GET /pagos/pendientes/{id}` (nuevo) — Ejecutar `curl -i "http://localhost/rest_suscripcion/pagos/pendientes/1"`. **Esperado:** HTTP 200 con array, o 404 si no hay pagos pendientes.

### Grupo G — Validaciones de inspección de código

- `[ ]` **T25** | Validación — sin código muerto en `BaseCtrl` (D14/A13) — Inspeccionar `controladores/BaseCtrl.php`. **Esperado:** No existe el bloque comentado de las líneas 30–56 (los métodos `respuestaJson`, `respuestaExitosa`, `respuestaError` antiguos).

- `[ ]` **T26** | Validación — sin `echo` de depuración en `SuscripcionRts` (D8/A8) — Inspeccionar `rutas/SuscripcionRts.php`. **Esperado:** No existe la línea `echo "Datos recibidos..."`.

- `[ ]` **T27** | Validación — sin duplicación SQL en `PlanesMdl` (D5/A5) — Inspeccionar `modelos/PlanesMdl.php`. **Esperado:** Los 10 campos base del SELECT están extraídos a un lugar común (constante, variable o método privado) y no hay dos cadenas SQL con los mismos 10 campos repetidos.

- [ ] **T28** | Validación — alias `plin` en minúsculas (D16/A15) — Inspeccionar `modelos/PlanesMdl.php`. **Esperado:** No aparece `PLIN.` en mayúsculas dentro de las consultas SQL; todas las referencias al alias usan `plin.` en minúsculas.

- [ ] **T29** | Validación — parámetro `sus_usuarioId` unificado (D15/A14) — Inspeccionar `controladores/SuscripcionCtrl.php`. **Esperado:** Los métodos `insertarSuscripcionSinPago` e `insertarSuscripcionConPago` usan `'sus_usuarioId'` como nombre de campo. No debe aparecer `'iUsuario'` en el array de campos requeridos ni en el acceso a `$datosLimpios`.

- [ ] **T30** | Validación — docblock corregido (D17/A16) — Inspeccionar `controladores/SuscripcionCtrl.php`. **Esperado:** El docblock de `insertarSuscripcionSinPago` describe la creación de suscripción sin pago, no "Obtiene los planes disponibles".

- [ ] **T31** | Validación — `anexos/` intacto — Inspeccionar `rest_suscripcion/anexos/`. **Esperado:** Los 6 archivos existentes (`Modelo.PNG`, `Procedimientos NuevaSuscripcion.sql`, `Procedimientos RenovacionAutomatica.sql`, `sist_suscripcion.sql`, `sist_suscripcionDatos.sql`, `sist_suscripcion_CRM.sql`) no fueron creados, modificados ni eliminados.

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

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
- _(path absoluto — CREATE|MODIFY — resumen de una línea)_

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas se ejecutaron y su resultado quedó registrado.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según las reglas de estado (COMPLETADO solo si T1–T31 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
