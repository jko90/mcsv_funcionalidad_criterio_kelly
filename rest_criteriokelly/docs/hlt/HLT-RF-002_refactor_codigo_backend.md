# HLT-RF-002 — Contrato Técnico de Alto Nivel: Refactor del código backend de `rest_criteriokelly`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-002_refactor_codigo_backend.md`](../rf/RF-002_refactor_codigo_backend.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Servicio afectado:** `rest_criteriokelly` (autónomo; no se replica en otros `rest_*`).
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
- Un senior debe aprobar el HLT (§6 de `doc_modo_planificacion.md`) antes de que el agente
  implementador ejecute tarea alguna. Al aprobar, cambiar `Aprobación senior` a `APROBADO` y el
  `Estado` a `EN EJECUCIÓN`.
- El agente implementador **solo** puede cambiar el `Estado` del HLT a **`COMPLETADO`** cuando se
  cumplan **todas** estas condiciones simultáneamente:
  1. **Todas** las tareas `T1`–`T42` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T26`–`T42`) se ejecutaron y su resultado observado **coincide** con
     el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`** (no `COMPLETADO`).
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`** o
  **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Dar a `ReglasKelly` su propia tripleta arquitectónica (Rts), eliminar la duplicación entre los 5
archivos `*Rts.php`, unificar el manejo de errores para que ningún mensaje de excepción llegue al
cliente, retirar código muerto comentado y la documentación incorrecta (`rutas.txt`), eliminar
duplicación entre modelos, extraer validación de ID común, corregir nomenclatura inconsistente,
consolidar el patrón de compensación repetido en `ReglasKellyMdl`, y documentar el código 422 en el
contrato de error — **manteniendo el contrato de datos de éxito vigente** para todos los endpoints
existentes, salvo el cambio declarado como BREAKING (R2).

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en el servicio `rest_criteriokelly`:

| Path (relativo a `rest_criteriokelly/`) | Acción | AC |
|----------------------------------------|--------|-----|
| `rutas/RtsHelper.php` | CREATE | A2 |
| `rutas/ReglasKellyRts.php` | CREATE | A1 |
| `rutas/CuentasRts.php` | MODIFY | A2+A4+A5 |
| `rutas/BitacoraRts.php` | MODIFY | A1 (quitar PUT) + A2+A5 |
| `rutas/ComentariosRts.php` | MODIFY | A2+A3+A5 |
| `rutas/CriterioKellyRts.php` | MODIFY | A2+A5 |
| `index.php` | MODIFY | A1 (registrar /reglasKelly) |
| `controladores/CriterioKellyCtrl.php` | MODIFY | A6 |
| `controladores/BitacoraCtrl.php` | MODIFY | A7 |
| `controladores/ComentariosCtrl.php` | MODIFY | A7+A12 |
| `controladores/ReglasKellyCtrl.php` | MODIFY | A12+A13 |
| `controladores/BaseCtrl.php` | MODIFY | A11 |
| `modelos/CuentasMdl.php` | MODIFY | A7 |
| `modelos/BitacoraMdl.php` | MODIFY | A7+A8+A10+A12 |
| `modelos/CriterioKellyMdl.php` | MODIFY | A8 |
| `modelos/ReglasKellyMdl.php` | MODIFY | A14 |
| `rutas.txt` | DELETE | A9 |
| `README.md` | MODIFY | A9+A15 |

## 3. Out-of-scope (qué NO entra)

- No se implementa JWT ni middleware de autenticación global (D8).
- No se convierte el DELETE físico de `BitacoraCtrl::eliminarBitacoraBitacora` a eliminación lógica (D9).
- No se externalizan credenciales de BD a variables de entorno.
- No se introducen transacciones SQL para el patrón de compensación de `ReglasKellyMdl` (A14 solo
  elimina duplicación de código, no cambia la estrategia).
- No se invoca ni modifica ningún procedimiento almacenado ni archivo de `anexos/`.
- No se migra a Composer/PSR-4 ni se introduce framework.
- No se toca `.htaccess` (cubierto por RF-001).
- No se lee ni modifica nada dentro de `rest_criteriokelly/docs/` (salvo este HLT).
- No se realiza ninguna acción dentro de `rest_criteriokelly/anexos/`.
- No se modifica el error 200 con `return` innecesario en los métodos de `CriterioKellyCtrl` (no
  listado como defecto en el RF).
- No se modifican los `echo json_encode` en `index.php` (D5 lo menciona pero el alcance A5 es solo
  para `*Rts.php`).

## 4. Impacto en contratos públicos

### 4.1. Endpoints preservados (sin cambios en contrato de datos de éxito)

| Método | Ruta | Éxito | Errores |
|--------|------|-------|---------|
| GET | `/cuentas` | 200 + health-check (mismos campos) | 404/500 |
| GET | `/cuentas/obtener?id={id}` | 200 + arreglo cuentas | 400/404/500 |
| POST | `/cuentas/nueva` | 200 + eco datos cuenta | 400/500 |
| POST | `/cuentas/movCapital` | 200 + eco movimiento | 400/500 |
| PUT | `/cuentas/nombre` | 200 + confirmación | 400/500 |
| DELETE | `/cuentas/eliminar` | 200 + confirmación | 400/500 |
| GET | `/bitacora` | 200 + health-check (mismos campos) | 404/500 |
| POST | `/bitacora/crear` | 200 + datos bitácora | 400/500 |
| POST | `/bitacora/listBitacora` | 200 + arreglo bitácoras | 400/404/500 |
| DELETE | `/bitacora/eliminarBitacora?id={id}` | 200 + confirmación | 400/500 |
| GET | `/comentarios` | 200 + health-check; **cambia** `service` a `ComentariosRTs` | 404/500 |
| GET | `/comentarios/observaciones?id={id}` | 200 + arreglo observaciones | 400/404/500 |
| POST | `/comentarios/crearComentario` | 200 + eco comentario | 400/500 |
| PUT | `/comentarios/comentarioBitacora` | 200 + eco actualización | 400/500 |
| GET | `/criterioKelly` | 200 + health-check (mismos campos) | 404/500 |
| POST | `/criterioKelly/obtenerPorcentaje` | 200 + porcentaje Kelly | 400/404/500 |
| POST | `/criterioKelly/obtenerResultados` | 200 + resultados | 400/404/500 |
| POST | `/criterioKelly/detalleOperacion` | 200 + detalle | 400/404/500 |
| POST | `/criterioKelly/operacionAnalisis` | 200 + operaciones | 400/404/500 |
| POST | `/criterioKelly/observacionAnalisis` | 200 + observaciones | 400/404/500 |

### 4.2. Endpoints modificados (cambio de contrato declarado)

| Método | Ruta | Cambio | Éxito después | Errores |
|--------|------|--------|---------------|---------|
| PUT | `/bitacora/finalizaBitacora` | R2 — **BREAKING**: deja de existir, responde 405 | — | 405 |
| PUT | `/reglasKelly/finalizaBitacora` | R2 — **BREAKING**: nueva ubicación, mismo body y respuesta | 200 + eco operación | 400/404/422/500 |

### 4.3. Endpoints nuevos

| Método | Ruta | Éxito | Errores |
|--------|------|-------|---------|
| GET | `/reglasKelly` | 200 + health-check del nuevo dominio | 404/500 |

## 5. Compatibilidad

| Cambio | Tipo | Impacto |
|--------|------|---------|
| R2 — `PUT /bitacora/finalizaBitacora` → `PUT /reglasKelly/finalizaBitacora` | **BREAKING** | El frontend debe actualizar la URL que invoca para finalizar operaciones. El contrato de body y respuesta es idéntico. `PUT /bitacora/*` responde 405 tras el cambio. |
| A3 — Health-check de `/comentarios` reporta `ComentariosRTs` | NO-BREAKING | Corrección de bug de copy-paste (antes reportaba `BitacoraRTs`). El campo no es consumido programáticamente por el SPA. |

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Transporte (helper) | `rutas/RtsHelper.php` | CREATE |
| Transporte | `rutas/ReglasKellyRts.php` | CREATE |
| Transporte | `rutas/CuentasRts.php` | MODIFY |
| Transporte | `rutas/BitacoraRts.php` | MODIFY |
| Transporte | `rutas/ComentariosRts.php` | MODIFY |
| Transporte | `rutas/CriterioKellyRts.php` | MODIFY |
| Front Controller | `index.php` | MODIFY |
| Aplicación/Negocio | `controladores/BaseCtrl.php` | MODIFY |
| Aplicación/Negocio | `controladores/CriterioKellyCtrl.php` | MODIFY |
| Aplicación/Negocio | `controladores/BitacoraCtrl.php` | MODIFY |
| Aplicación/Negocio | `controladores/ComentariosCtrl.php` | MODIFY |
| Aplicación/Negocio | `controladores/ReglasKellyCtrl.php` | MODIFY |
| Datos | `modelos/CuentasMdl.php` | MODIFY |
| Datos | `modelos/BitacoraMdl.php` | MODIFY |
| Datos | `modelos/CriterioKellyMdl.php` | MODIFY |
| Datos | `modelos/ReglasKellyMdl.php` | MODIFY |
| Documentación | `rutas.txt` | DELETE |
| Documentación | `README.md` | MODIFY |

## 7. Delta arquitectónico

### 7.1. Tabla de Delta

| Capa | Artefacto | Acción | Detalle cerrado |
|------|-----------|--------|-----------------|
| Rts | `rutas/RtsHelper.php` | CREATE | Clase con métodos estáticos: `parsearAccion(string $domainName): ?string` (extrae el segmento de URI tras el dominio), `leerBodyJson(): array` (lee `php://input`, decodifica, valida — 400 si vacío/inválido/ausente), `responderExito(mixed $data): never` (200 + JSON_UNESCAPED_UNICODE + Content-Type + exit), `responderError(string $msg, int $httpCode): never`, `responderNoPermitido(array $metodos): never` (405), `responderHealthCheck(array $data): never`, `validarIdEntero(mixed $id): void` (responde error 400 si no es entero positivo). |
| Rts | `rutas/ReglasKellyRts.php` | CREATE | Implementar siguiendo el patrón refactorizado: `require_once` de `ReglasKellyCtrl.php` y `RtsHelper.php`; switch por método HTTP (`PUT` únicamente), `RtsHelper::parsearAccion('reglasKelly')`, `RtsHelper::leerBodyJson()` para PUT. Acción: `finalizaBitacora` → `$reglasKellyController->finalizarOperacionBitacora($data)`. GET sin acción → health-check del dominio. Default → 405. |
| Front Controller | `index.php` | MODIFY | Añadir `'/reglasKelly' => 'rutas/ReglasKellyRts.php'` en el mapa `$rutas`. |
| Rts | `rutas/BitacoraRts.php` | MODIFY | (A1) Eliminar: `require_once(__DIR__ . '/../controladores/ReglasKellyCtrl.php')`, la instancia `$reglasKellyController`, y el bloque `case 'PUT'` completo (caso `'finalizaBitacora'`). (A2+A5) Refactor de GET/POST/DELETE: reemplazar parseo manual por `RtsHelper::parsearAccion('bitacora')`, reemplazar cada respuesta directa (`http_response_code() + echo json_encode()`) por `RtsHelper::responderExito/responderError/responderNoPermitido`, reemplazar bloques de lectura/validación de body por `RtsHelper::leerBodyJson()`. En el DELETE, reemplazar `is_numeric($id) || (int)$id <= 0` por `RtsHelper::validarIdEntero($id)`. Health-check conserva los mismos datos. |
| Rts | `rutas/CuentasRts.php` | MODIFY | (A2+A5) Refactor equivalente: `RtsHelper::parsearAccion('cuentas')`, respuestas vía `RtsHelper`, body vía `RtsHelper::leerBodyJson()`. (A4) Corregir comentario de línea 17: cambiar `// Buscar posición de 'persona'...` a `// Buscar posición de 'cuentas'...`. En GET `obtener`, reemplazar `is_numeric($id) || (int)$id <= 0` por `RtsHelper::validarIdEntero($id)`. |
| Rts | `rutas/ComentariosRts.php` | MODIFY | (A2+A3+A5) Refactor equivalente. (A3) En health-check, cambiar `'service' => 'BitacoraRTs'` por `'service' => 'ComentariosRTs'`. Reemplazar respuestas directas por helpers. En GET `observaciones`, reemplazar `is_numeric($id) || (int)$id <= 0` por `RtsHelper::validarIdEntero($id)`. |
| Rts | `rutas/CriterioKellyRts.php` | MODIFY | (A2+A5) Refactor equivalente: `RtsHelper::parsearAccion('criterioKelly')`, respuestas vía `RtsHelper`, body vía `RtsHelper::leerBodyJson()`. |
| Controlador | `controladores/CriterioKellyCtrl.php` | MODIFY | (A6) En los 5 bloques `catch` (líneas 55, 101, 143, 189, 225), reemplazar `$this->respuestaErrorSimple($e->getMessage(), 500)` por: `error_log("Error en <nombreMetodo>: " . $e->getMessage()); $this->respuestaErrorSimple('Error interno del servidor', 500);`. |
| Modelo | `modelos/CuentasMdl.php` | MODIFY | (A7) En el bloque `catch` (línea 52), reemplazar `return "Error al generar el registro: " . $e->getMessage();` por `return ['error' => 'Error interno en la inserción'];`. |
| Modelo | `modelos/BitacoraMdl.php` | MODIFY | (A7) En el bloque `catch` (línea 42), reemplazar `return "Error al generar el registro: " . $e->getMessage();` por `return ['error' => 'Error interno en la inserción'];`. (A8) Eliminar el método comentado `actualizarBitacoraTPBESL` (líneas 63–69). (A10) Eliminar el método privado `crearComentariosPorBitacora` (líneas 108–112) y en `crearBitacora` (línea 30) instanciar `new ComentariosMdl()` para llamar a su versión pública. (A12) En línea 48, cambiar `bit_idBitacora` a `bit_idbitacora` en la SQL de DELETE, unificando con el resto del archivo. |
| Controlador | `controladores/BitacoraCtrl.php` | MODIFY | (A7) En `crearBitacora` (líneas 108–111), cambiar la condición de error: `if (!$resultadoInsercion || is_array($resultadoInsercion) && isset($resultadoInsercion['error'])) { $this->respuestaErrorSimple('Error interno del servidor', 500); }`. El detalle queda solo en `error_log()`. |
| Controlador | `controladores/ComentariosCtrl.php` | MODIFY | (A7) En `actualizarBitacoraComentario` (líneas 192–201), reemplazar la lógica que reenvía mensajes crudos por un mensaje genérico: `if (!$resultado || is_array($resultado) && isset($resultado['error']) || !$resultadoObservacion) { $this->respuestaErrorSimple('Error interno del servidor', 500); }`. (A12) Renombrar método `ObtenerObservacionesPorBitacora` a `obtenerObservacionesPorBitacora` (camelCase), incluyendo la llamada en `ComentariosRts.php` línea 76. |
| Modelo | `modelos/CriterioKellyMdl.php` | MODIFY | (A8) Eliminar el bloque SQL comentado (líneas 37–114: versión antigua de `obtenerOperacionesParaAnalisis` con `ROW_NUMBER() OVER`). |
| Controlador | `controladores/ReglasKellyCtrl.php` | MODIFY | (A12) En las líneas 170, 183, 199, 221, cambiar `EliminarResultadoOperativas` (PascalCase) por `eliminarResultadoOperativas` (camelCase), coincidiendo con la definición real en `ReglasKellyMdl.php:33`. (A13) En el bloque `catch` (líneas 248–256), proteger las referencias a variables que pueden no estar definidas si la excepción ocurre temprano (`$datosLimpios`, `$montoBalanceInicial`, `$idResultadoOperativo`, `$idRiesBeneficio`, `$idFactorTotal`, `$idRentabilidad`): verificar con `isset()` antes de usarlas en las llamadas de anulación, o solo llamar a las que estén definidas. Reemplazar el mensaje `'Error interno del servidor: '` (con dos puntos) por `'Error interno del servidor'`. Descomentar y corregir la línea `//error_log(...)`. |
| Controlador | `controladores/BaseCtrl.php` | MODIFY | (A11) Añadir método protegido `validarIdEntero(mixed $id, string $nombreCampo = 'ID'): void`. Implementación: si `!filter_var($id, FILTER_VALIDATE_INT) || $id <= 0` → `$this->respuestaErrorSimple("{$nombreCampo} inválido", 400)`. |
| Modelo | `modelos/ReglasKellyMdl.php` | MODIFY | (A14) Consolidar los 4 bloques de compensación repetidos (`DELETE FROM sckr_resultado WHERE res_idResultado = ?`, `DELETE FROM sckr_riesgobeneficio WHERE rib_idRiesBenef = ?`, `DELETE FROM sckt_factortotal WHERE fat_idFactotal = ?`, `DELETE FROM sckr_rentabilidad WHERE ren_idRentabili = ?`) en un único método privado `eliminarDatosOperacion(int $idResultado, int $idRiesgo, int $idFactor, int $idRentabilidad): void` que ejecute los 4 deletes. Los métodos `eliminarResultadoOperativas`, `eliminarRiesgoBeneficio`, `eliminarFactorTotal` y `eliminarRentabilidad` se conservan (pueden seguir siendo usados individualmente por el catch de ReglasKellyCtrl), pero el nuevo método los reutiliza. |
| Documentación | `rutas.txt` | DELETE | (A9) Eliminar el archivo. No hay `require`/`include` que lo referencie. |
| Documentación | `README.md` | MODIFY | (A9) Eliminar la línea `rutas.txt` en la estructura del proyecto (línea 90) y eliminar la línea que referencia `rutas.txt` en la sección de Criterio de Kelly (línea 232). (A15) En la tabla de códigos HTTP utilizados (líneas 274–280), añadir fila `\| 422 \| Error de negocio (riesgo excedido) \|`. |

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción | Motivo |
|---------------|--------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/RtsHelper.php` | CREATE | Lógica común de rutas (A2). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/ReglasKellyRts.php` | CREATE | Tripleta ReglasKelly (A1). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/index.php` | MODIFY | Registrar /reglasKelly (A1). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/BitacoraRts.php` | MODIFY | Quitar PUT (A1) + refactor (A2+A5). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/CuentasRts.php` | MODIFY | Refactor + comentario (A2+A4+A5). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/ComentariosRts.php` | MODIFY | Refactor + health-check (A2+A3+A5). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/CriterioKellyRts.php` | MODIFY | Refactor (A2+A5). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/CriterioKellyCtrl.php` | MODIFY | Arreglar 5 catch (A6). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/BitacoraCtrl.php` | MODIFY | Error genérico (A7). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/ComentariosCtrl.php` | MODIFY | Error genérico (A7) + rename (A12). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/ReglasKellyCtrl.php` | MODIFY | Fix calls (A12) + catch (A13). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/BaseCtrl.php` | MODIFY | validarIdEntero (A11). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/CuentasMdl.php` | MODIFY | Error array (A7). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/BitacoraMdl.php` | MODIFY | Error array (A7) + dead code (A8) + dedup (A10) + column name (A12). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/CriterioKellyMdl.php` | MODIFY | Quitar SQL comentado (A8). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/ReglasKellyMdl.php` | MODIFY | Consolidar compensación (A14). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas.txt` | DELETE | Documentación incorrecta (A9). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/README.md` | MODIFY | Quitar rutas.txt (A9) + documentar 422 (A15). |

## 9. Estrategia de validación

Cada validación se detalla en el checklist (Grupo N). Se verifican:
- **Health checks**: todos los dominios responden 200.
- **ComentariosRTs**: el health-check de `/comentarios` reporta el nombre correcto.
- **ReglasKelly**: nuevo endpoint responde health-check 200.
- **R2**: `PUT /bitacora/finalizaBitacora` → 405; `PUT /reglasKelly/finalizaBitacora` → 200.
- **Excepción no expuesta**: `CriterioKellyCtrl` responde 500 genérico, sin mensaje crudo.
- **Errores de inserción**: `crearBitacora` responde 500 genérico.
- **Limpieza**: `rutas.txt` eliminado; README sin referencia; código comentado eliminado.
- **Nomenclatura**: métodos en camelCase.
- **Regresión P1–P12** de RF-002 §8.
- **anexos/** intacto.

## 10. Riesgos

- **Regresión en contratos preservados.** Al refactorizar las rutas, algún mensaje de error o formato
  de health-check podría alterarse. *Mitigación:* T27–T30 verifican health-checks y T40 ejecuta P1–P12.
- **Ruptura de SPA por R2 (BREAKING).** El frontend debe actualizar la URL de `finalizaBitacora`.
  *Mitigación:* cambio declarado explícitamente como BREAKING.
- **Catch de ReglasKellyCtrl.** Si la protección de variables indefinidas se hace incorrectamente, el
  catch podría saltar excepciones o fallar. *Mitigación:* T23 verifica con `isset()`.
- **Error en RtsHelper por dependencia cíclica.** *Mitigación:* T26 (php -l) verifica sintaxis.
- **Compensación incorrecta en A14.** Si se consolida mal, la anulación de inserción en `finalizarOperacionBitacora` podría omitir deletes. *Mitigación:* T24 conserva los métodos existentes y el nuevo solo los orquesta.

## 11. Rollback

- **Global:** restaurar todos los archivos modificados desde Git y recuperar `rutas.txt`. Revertir
  `index.php`. Sin efectos en BD (no hay cambios de esquema).
- **Por artefacto:** deshacer cada MODIFY revirtiendo el archivo; recuperar cada DELETE.
- **Si RtsHelper falla:** revertir los 5 `*Rts.php` a sus versiones previas y eliminar `RtsHelper.php`.
- **Si ReglasKellyRts falla:** revertir `index.php` (quitar del mapa), revertir `BitacoraRts.php`
  (restaurar PUT case) y eliminar `ReglasKellyRts.php`.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` =
> realizado y verificado; `[BLOCKED]` = bloqueado, con razón. Todos se entregan en `[ ]`.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_criteriokelly` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/` |
| Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) |
| Capa de datos | `configuracion/enlace.php` (clase `Enlace`, `bind_param`) |
| Capa de respuesta | `controladores/BaseCtrl.php` (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`) |
| BD | MySQL/MariaDB — `DB_NAME=sist_criteriokelly` (ver `configuracion/global.php`) |
| Prefijo de tablas | `sckc_` (cuentas), `sckb_` (bitácora), `scko_` (observaciones), `sckp_` (criterioKelly), `sckr_` (resultado/rentabilidad) |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `curl http://localhost/rest_criteriokelly/cuentas` |
| Estrategia de migraciones | No hay cambios de esquema en este RF |
| Logs | `logs/php_errors.log` del servicio |

### Grupo A — Infraestructura compartida de rutas (A2)

- `[ ]` **T1** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/RtsHelper.php` | CREATE
    - Delta: Clase con métodos estáticos: `parsearAccion(string $domainName): ?string`, `leerBodyJson(): array`, `responderExito(mixed $data): never`, `responderError(string $msg, int $httpCode): never`, `responderNoPermitido(array $metodos): never`, `responderHealthCheck(array $data): never`, `validarIdEntero(mixed $id): void`. Ver §7.1 Delta Rts.
    - Note: Los 5 Rts refactorizados dependen de este archivo. Tiene prioridad máxima.

### Grupo B — Tripleta ReglasKelly (A1)

- `[ ]` **T2** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/ReglasKellyRts.php` | CREATE
    - Delta: Implementar según §7.1. GET sin acción → health-check. PUT `/reglasKelly/finalizaBitacora` → `ReglasKellyCtrl::finalizarOperacionBitacora`. Usa `RtsHelper`.
    - Note: Requiere T1 (RtsHelper).

- `[ ]` **T3** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/index.php` | MODIFY
    - Delta: Añadir `'/reglasKelly' => 'rutas/ReglasKellyRts.php',` al mapa `$rutas`.
    - Insert after: La entrada `/criterioKelly` existente.

- `[ ]` **T4** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/BitacoraRts.php` | MODIFY
    - Delta: (1) Eliminar `require_once(__DIR__ . '/../controladores/ReglasKellyCtrl.php')` (línea 4). (2) Eliminar `$reglasKellyController = new ReglasKellyCtrl();` (línea 12). (3) Eliminar el bloque `case 'PUT':` completo (líneas 35–37) y la función `manejarPut` asociada (líneas 116–155). El switch de método HTTP ya no incluye PUT. Ajustar la respuesta 405 para reflejar `['GET', 'POST', 'DELETE']`.
    - Insert after: Se modifican las líneas 4, 12, 28–48.
    - Note: Debe ejecutarse antes de T6 (refactor posterior) o fusionarse con él.

### Grupo C — Refactor de rutas existentes (A2+A3+A4+A5)

- `[ ]` **T5** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/CuentasRts.php` | MODIFY
    - Delta: Refactor completo: usar `RtsHelper::parsearAccion('cuentas')`, `RtsHelper::leerBodyJson()`, `RtsHelper::validarIdEntero()` en GET `obtener`, y `RtsHelper::responderExito/responderError/responderNoPermitido` en lugar de `http_response_code() + echo json_encode()`. Corregir comentario línea 17 de `'persona'` a `'cuentas'`. Health-check conserva los mismos datos.
    - Note: Requiere T1.

- `[ ]` **T6** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/BitacoraRts.php` | MODIFY
    - Delta: Refactor de GET/POST/DELETE restantes (tras T4): usar `RtsHelper::parsearAccion('bitacora')`, `RtsHelper::leerBodyJson()`, `RtsHelper::validarIdEntero()` en DELETE, y helpers de respuesta en vez de `http_response_code() + echo json_encode()`. Health-check conserva los mismos datos.
    - Note: Requiere T1 y T4 (o fusionar con T4 para modificar el archivo una sola vez).

- `[ ]` **T7** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/ComentariosRts.php` | MODIFY
    - Delta: Refactor completo + corrección A3. Usar `RtsHelper::parsearAccion('comentarios')`, helpers de body y respuesta. En health-check, cambiar `'service' => 'BitacoraRTs'` por `'service' => 'ComentariosRTs'`. En GET `observaciones`, usar `RtsHelper::validarIdEntero($id)`. Renombrar llamada a `$controller->ObtenerObservacionesPorBitacora($id)` por `$controller->obtenerObservacionesPorBitacora($id)`.
    - Note: Requiere T1.

- `[ ]` **T8** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas/CriterioKellyRts.php` | MODIFY
    - Delta: Refactor completo: `RtsHelper::parsearAccion('criterioKelly')`, helpers de body y respuesta. Health-check conserva los mismos datos.
    - Note: Requiere T1.

### Grupo D — Error handling CriterioKellyCtrl (A6)

- `[ ]` **T9** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/CriterioKellyCtrl.php` | MODIFY
    - Delta: En los 5 catch (líneas 55, 101, 143, 189, 225), reemplazar `$this->respuestaErrorSimple($e->getMessage(), 500)` por `error_log("Error en <nombreMetodo>: " . $e->getMessage()); $this->respuestaErrorSimple('Error interno del servidor', 500);`.
    - Insert after: Cada bloque `catch (Exception $e) {`.
    - Note: El mensaje crudo de la excepción queda solo en `logs/php_errors.log`.

### Grupo E — Error handling en modelos y controladores (A7)

- `[ ]` **T10** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/CuentasMdl.php` | MODIFY
    - Delta: En catch de `agregarCuenta` (línea 52), cambiar `return "Error al generar el registro: " . $e->getMessage();` por `return ['error' => 'Error interno en la inserción'];`.
    - Insert after: Línea `} catch (Exception $e) {`.

- `[ ]` **T11** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/BitacoraMdl.php` | MODIFY
    - Delta: En catch de `crearBitacora` (línea 42), cambiar `return "Error al generar el registro: " . $e->getMessage();` por `return ['error' => 'Error interno en la inserción'];`.
    - Insert after: Línea `} catch (Exception $e) {`.

- `[ ]` **T12** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/BitacoraCtrl.php` | MODIFY
    - Delta: En `crearBitacora`, reemplazar las líneas 108–111 por: `if (!$resultadoInsercion || (is_array($resultadoInsercion) && isset($resultadoInsercion['error']))) { $this->respuestaErrorSimple('Error interno del servidor', 500); }`.
    - Insert after: Línea `$resultadoInsercion = $this->bitacoraService->crearBitacora(...)`.
    - Note: Requiere T11 (el modelo debe retornar array con 'error').

- `[ ]` **T13** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/ComentariosCtrl.php` | MODIFY
    - Delta: En `actualizarBitacoraComentario`, reemplazar líneas 192–201 por: `if (!$resultado || (is_array($resultado) && isset($resultado['error'])) || !$resultadoObservacion) { $this->respuestaErrorSimple('Error interno del servidor', 500); }`.
    - Insert after: Las líneas de llamada a modelo (alrededor de línea 191).
    - Note: Elimina la exposición de mensajes crudos al cliente.

### Grupo F — Dead code removal (A8)

- `[ ]` **T14** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/BitacoraMdl.php` | MODIFY
    - Delta: Eliminar el método comentado `actualizarBitacoraTPBESL` completo (líneas 63–69).
    - Insert after: Remover las líneas 63 a 69 inclusive.

- `[ ]` **T15** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/CriterioKellyMdl.php` | MODIFY
    - Delta: Eliminar el bloque SQL comentado completo (líneas 37–114) que contiene la versión antigua de `obtenerOperacionesParaAnalisis` con `ROW_NUMBER() OVER`.
    - Insert after: Remover las líneas 37 a 114 inclusive. El método `obtenerOperacionesParaAnalisis` activo comienza en línea 117.

### Grupo G — Eliminar rutas.txt y actualizar README (A9)

- `[ ]` **T16** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/rutas.txt` | DELETE
    - Delta: Eliminar el archivo (104 líneas, contenido de autenticación ajeno al servicio).

- `[ ]` **T17** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/README.md` | MODIFY
    - Delta: (1) En la estructura del proyecto (línea 90), eliminar la línea `│   ├── rutas.txt                    # Documentación de referencia de endpoints`. (2) En la sección Criterio de Kelly (línea 232), eliminar la línea `> Consulte [rutas.txt](rutas.txt) para ejemplos de payloads y respuestas de referencia.`
    - Insert after: Las líneas existentes.

### Grupo H — Eliminar duplicación en modelos (A10)

- `[ ]` **T18** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/BitacoraMdl.php` | MODIFY
    - Delta: (1) Eliminar el método privado `crearComentariosPorBitacora` (líneas 108–112). (2) En `crearBitacora`, donde se invoca `$this->crearComentariosPorBitacora(...)` (línea 30), reemplazar por: `$comentariosMdl = new \ComentariosMdl(); $idObservacion = $comentariosMdl->crearComentariosPorBitacora(...);`. Añadir `require_once(__DIR__ . '/ComentariosMdl.php')` al inicio del archivo si no está ya (confirmar antes de editar).
    - Insert after: Método `crearBitacora`, donde se usa `crearComentariosPorBitacora`.
    - Note: Requiere que `ComentariosMdl::crearComentariosPorBitacora` sea público (ya lo es).

### Grupo I — ID validation utility (A11)

- `[ ]` **T19** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/BaseCtrl.php` | MODIFY
    - Delta: Añadir método protegido `validarIdEntero(mixed $id, string $nombreCampo = 'ID'): void`. Si `!filter_var($id, FILTER_VALIDATE_INT) || $id <= 0` → `$this->respuestaErrorSimple("{$nombreCampo} inválido", 400)`.
    - Insert after: Método `limpiarDatos` (después de línea 29).
    - Note: Complementado por `RtsHelper::validarIdEntero` (T1) para uso desde rutas.

### Grupo J — Naming fixes (A12)

- `[ ]` **T20** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/ComentariosCtrl.php` | MODIFY
    - Delta: Renombrar método `ObtenerObservacionesPorBitacora` a `obtenerObservacionesPorBitacora`.
    - Insert after: Firma del método (línea 228).
    - Note: La llamada desde `ComentariosRts.php` se corrige en T7.

- `[ ]` **T21** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/ReglasKellyCtrl.php` | MODIFY
    - Delta: Cambiar las 4 llamadas a `$this->reglasKellyService->EliminarResultadoOperativas(...)` (líneas 170, 183, 199, 221) por `$this->reglasKellyService->eliminarResultadoOperativas(...)`.
    - Insert after: Las líneas específicas.

- `[ ]` **T22** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/BitacoraMdl.php` | MODIFY
    - Delta: En línea 48, cambiar `bit_idBitacora` por `bit_idbitacora` en la SQL de `eliminarBitacoraError`, unificando la grafía con el resto del archivo (líneas 60, 61, 70, 84).
    - Insert after: El string SQL en `eliminarBitacoraError`.

### Grupo K — Fix catch block ReglasKellyCtrl (A13)

- `[ ]` **T23** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/controladores/ReglasKellyCtrl.php` | MODIFY
    - Delta: En el catch (líneas 248–256): (1) Proteger cada variable con `isset()` antes de usarla en las llamadas de anulación, o llamar solo a métodos cuyas variables estén definidas. (2) Reemplazar mensaje `'Error interno del servidor: '` por `'Error interno del servidor'`. (3) Descomentar la línea `//error_log(...)` y corregir el mensaje a `"Error en finalizarOperacionBitacora: " . $e->getMessage()`.
    - Insert after: Bloque `catch (Exception $e) {`.
    - Note: Las variables a proteger son: `$datosLimpios['bit_idbitacora']`, `$montoBalanceInicial`, `$idResultadoOperativo`, `$idRiesBeneficio`, `$idFactorTotal`, `$idRentabilidad`.

### Grupo L — Consolidar compensación ReglasKellyMdl (A14)

- `[ ]` **T24** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/modelos/ReglasKellyMdl.php` | MODIFY
    - Delta: Añadir método privado `eliminarDatosOperacion(int $idResultado, int $idRiesgo, int $idFactor, int $idRentabilidad): void` que ejecute en orden: `$this->eliminarResultadoOperativas($idResultado)`, `$this->eliminarRiesgoBeneficio($idRiesgo)`, `$this->eliminarFactorTotal($idFactor)`, `$this->eliminarRentabilidad($idRentabilidad)`. Cada método individual (ya existente) se conserva para uso desde el catch de `ReglasKellyCtrl`.
    - Insert after: Método `eliminarRentabilidad` (después de línea 125). No modificar la lógica de compensación existente, solo añadir el nuevo método orquestador.

### Grupo M — Documentar 422 en README (A15)

- `[ ]` **T25** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_criteriokelly/README.md` | MODIFY
    - Delta: En la tabla de códigos HTTP (después de 405, antes de 500), añadir fila: `| 422 | Error de negocio (riesgo excedido) |`.
    - Insert after: La fila de 405 en la tabla de códigos HTTP (línea 279).

### Grupo N — Validaciones

#### Integridad del código

- `[ ]` **T26** | Validación — sintaxis PHP de todos los archivos modificados
    - Comando: `php -l rest_criteriokelly/rutas/RtsHelper.php && php -l rest_criteriokelly/rutas/ReglasKellyRts.php && php -l rest_criteriokelly/rutas/CuentasRts.php && php -l rest_criteriokelly/rutas/BitacoraRts.php && php -l rest_criteriokelly/rutas/ComentariosRts.php && php -l rest_criteriokelly/rutas/CriterioKellyRts.php && php -l rest_criteriokelly/index.php && php -l rest_criteriokelly/controladores/CriterioKellyCtrl.php && php -l rest_criteriokelly/controladores/BitacoraCtrl.php && php -l rest_criteriokelly/controladores/ComentariosCtrl.php && php -l rest_criteriokelly/controladores/ReglasKellyCtrl.php && php -l rest_criteriokelly/controladores/BaseCtrl.php && php -l rest_criteriokelly/modelos/CuentasMdl.php && php -l rest_criteriokelly/modelos/BitacoraMdl.php && php -l rest_criteriokelly/modelos/CriterioKellyMdl.php && php -l rest_criteriokelly/modelos/ReglasKellyMdl.php`
    - Esperado: Todos los archivos reportan `No syntax errors detected`.

#### Health checks

- `[ ]` **T27** | Health check — `/cuentas`
    - Comando: `curl -i http://localhost/rest_criteriokelly/cuentas`
    - Esperado: HTTP 200, body JSON con `"status":"ok"`, `"service":"CuentasRTs"`.

- `[ ]` **T28** | Health check — `/bitacora`
    - Comando: `curl -i http://localhost/rest_criteriokelly/bitacora`
    - Esperado: HTTP 200, body JSON con `"status":"ok"`, `"service":"BitacoraRTs"`.

- `[ ]` **T29** | Health check — `/comentarios` (corrección A3)
    - Comando: `curl -i http://localhost/rest_criteriokelly/comentarios`
    - Esperado: HTTP 200, body JSON con `"service":"ComentariosRTs"` (antes `"BitacoraRTs"`).

- `[ ]` **T30** | Health check — `/criterioKelly`
    - Comando: `curl -i http://localhost/rest_criteriokelly/criterioKelly`
    - Esperado: HTTP 200, body JSON con `"status":"ok"`, `"service":"CriterioKellyRTs"`.

- `[ ]` **T31** | Health check — `/reglasKelly` (nuevo dominio)
    - Comando: `curl -i http://localhost/rest_criteriokelly/reglasKelly`
    - Esperado: HTTP 200, body JSON con estado del nuevo dominio.

#### Comportamiento R2 (BREAKING)

- `[ ]` **T32** | `PUT /bitacora/finalizaBitacora` → 405
    - Comando: `curl -i -X PUT http://localhost/rest_criteriokelly/bitacora/finalizaBitacora -H "Content-Type: application/json" -d '{"bit_idbitacora":1}'`
    - Esperado: HTTP 405, body error "Método no permitido".

- `[ ]` **T33** | `PUT /reglasKelly/finalizaBitacora` → 200 (nueva ubicación)
    - Comando: `curl -i -X PUT http://localhost/rest_criteriokelly/reglasKelly/finalizaBitacora -H "Content-Type: application/json" -d '{"bit_idbitacora":1,"bit_resultado":"GANADOR","bit_situacion":"F","bit_respeReglas":"SI","bit_montoResult":100,"bit_cueIdCuentas":1,"bit_usuarioId":1}'`
    - Esperado: HTTP 200, mismo contrato de éxito que antes producía `PUT /bitacora/finalizaBitacora`.

#### Manejo de errores

- `[ ]` **T34** | CriterioKellyCtrl con fallo → 500 genérico
    - Comando: Enviar una petición a cualquier endpoint de `criterioKelly` que provoque una excepción en el controlador (p. ej. datos que causen error en el modelo).
    - Esperado: HTTP 500, body `{"error":"Error interno del servidor"}`. NO contiene texto de excepción PHP.

- `[ ]` **T35** | crearBitacora con fallo → 500 genérico
    - Comando: Enviar POST a `/bitacora/crear` con datos que provoquen fallo de inserción.
    - Esperado: HTTP 500, body `{"error":"Error interno del servidor"}`. NO contiene mensaje crudo.

#### Limpieza de código

- `[ ]` **T36** | `rutas.txt` eliminado
    - Comando: `test -f rest_criteriokelly/rutas.txt && echo "existe" || echo "no existe"`
    - Esperado: `no existe`.

- `[ ]` **T37** | README sin referencias a `rutas.txt`
    - Comando: `grep -n "rutas.txt" rest_criteriokelly/README.md`
    - Esperado: Sin coincidencias.

- `[ ]` **T38** | Sin código comentado muerto en modelos
    - Comando: Inspeccionar `modelos/BitacoraMdl.php` y `modelos/CriterioKellyMdl.php`.
    - Esperado: No existe el método comentado `actualizarBitacoraTPBESL` en `BitacoraMdl`. No existe el bloque SQL comentado de ~78 líneas en `CriterioKellyMdl`.

- `[ ]` **T39** | Nomenclatura camelCase consistente
    - Comando: Inspeccionar `controladores/ComentariosCtrl.php` y `controladores/ReglasKellyCtrl.php`.
    - Esperado: `obtenerObservacionesPorBitacora` (camelCase, no PascalCase). Llamadas a `eliminarResultadoOperativas` (minúscula inicial).

#### Regresión funcional

- `[ ]` **T40** | Plan de regresión P1–P12 (RF-002 §8)
    - Ejecutar los comandos P1 a P12 de RF-002 §8 contra el código refactorizado y documentar cada resultado.
    - Esperado: Cada fila coincide con su resultado esperado. Diferencias no declaradas como "cambia" son regresión y bloquean el cierre. Ver tabla en RF-002 §8.

#### Out-of-scope preservado

- `[ ]` **T41** | `anexos/` intacto
    - Comando: `ls -la rest_criteriokelly/anexos/`
    - Esperado: `procedimientos.sql` y `sist_criteriokelly.sql` existen sin modificar.

#### Ruta registrada

- `[ ]` **T42** | `/reglasKelly` registrado en `index.php`
    - Comando: `grep -n "'/reglasKelly'" rest_criteriokelly/index.php`
    - Esperado: Una coincidencia en el mapa `$rutas`.

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 42
- Completadas [X]: _(pendiente)_
- Bloqueadas [BLOCKED]: _(pendiente)_
- Omitidas: _(pendiente)_

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | rutas/RtsHelper.php |  |
| T2 |  | rutas/ReglasKellyRts.php |  |
| T3 |  | index.php |  |
| T4 |  | rutas/BitacoraRts.php |  |
| T5 |  | rutas/CuentasRts.php |  |
| T6 |  | rutas/BitacoraRts.php |  |
| T7 |  | rutas/ComentariosRts.php |  |
| T8 |  | rutas/CriterioKellyRts.php |  |
| T9 |  | controladores/CriterioKellyCtrl.php |  |
| T10 |  | modelos/CuentasMdl.php |  |
| T11 |  | modelos/BitacoraMdl.php |  |
| T12 |  | controladores/BitacoraCtrl.php |  |
| T13 |  | controladores/ComentariosCtrl.php |  |
| T14 |  | modelos/BitacoraMdl.php |  |
| T15 |  | modelos/CriterioKellyMdl.php |  |
| T16 |  | rutas.txt |  |
| T17 |  | README.md |  |
| T18 |  | modelos/BitacoraMdl.php |  |
| T19 |  | controladores/BaseCtrl.php |  |
| T20 |  | controladores/ComentariosCtrl.php |  |
| T21 |  | controladores/ReglasKellyCtrl.php |  |
| T22 |  | modelos/BitacoraMdl.php |  |
| T23 |  | controladores/ReglasKellyCtrl.php |  |
| T24 |  | modelos/ReglasKellyMdl.php |  |
| T25 |  | README.md |  |
| T26 |  | (validación) |  |
| T27 |  | (validación) |  |
| T28 |  | (validación) |  |
| T29 |  | (validación) |  |
| T30 |  | (validación) |  |
| T31 |  | (validación) |  |
| T32 |  | (validación) |  |
| T33 |  | (validación) |  |
| T34 |  | (validación) |  |
| T35 |  | (validación) |  |
| T36 |  | (validación) |  |
| T37 |  | (validación) |  |
| T38 |  | (validación) |  |
| T39 |  | (validación) |  |
| T40 |  | (validación) |  |
| T41 |  | (validación) |  |
| T42 |  | (validación) |  |

### Validaciones ejecutadas

| ID | Comando exacto ejecutado | Salida / HTTP observado | Esperado | ¿Coincide? |
|----|--------------------------|-------------------------|----------|------------|
| T26 |  |  |  |  |
| T27 |  |  |  |  |
| T28 |  |  |  |  |
| T29 |  |  |  |  |
| T30 |  |  |  |  |
| T31 |  |  |  |  |
| T32 |  |  |  |  |
| T33 |  |  |  |  |
| T34 |  |  |  |  |
| T35 |  |  |  |  |
| T36 |  |  |  |  |
| T37 |  |  |  |  |
| T38 |  |  |  |  |
| T39 |  |  |  |  |
| T40 |  |  |  |  |
| T41 |  |  |  |  |
| T42 |  |  |  |  |

### Blockers
- _(descripción del bloqueo, tarea afectada y qué se necesita para desbloquear)_

### Archivos cambiados
- _(path absoluto — CREATE|MODIFY|DELETE — resumen de una línea)_

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas se ejecutaron y su resultado quedó registrado.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T42 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
