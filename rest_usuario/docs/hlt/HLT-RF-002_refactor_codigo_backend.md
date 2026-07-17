# HLT-RF-002 — Contrato Técnico de Alto Nivel: Refactor del código backend de `rest_usuario`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-002_refactor_codigo_backend.md`](../rf/RF-002_refactor_codigo_backend.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Servicio afectado:** `rest_usuario` (autónomo; no se replica en otros `rest_*`).
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
  1. **Todas** las tareas `T1`–`T37` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T20`–`T37`) se ejecutaron y su resultado observado **coincide** con
     el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`** (no `COMPLETADO`).
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`** o
  **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Eliminar la duplicación entre los archivos de rutas (`PersonaRts`, `ValidacionRts`), completar el
dominio `Usuario` (hoy inerte por archivo vacío) reutilizando su modelo ya existente, retirar `/rol`
del enrutamiento (archivo vacío, sin tripleta que lo respalde), corregir el bug de manejo de errores
en `agregarPersona` que devuelve 200 con mensaje de excepción crudo, eliminar código muerto y HTML
de marketing de `index.php`, homogeneizar el contrato de error HTTP, mitigar el acceso sin
verificación en `actualizarClave` (exigir `claveActual`), unificar el algoritmo de hash de
contraseñas en `PASSWORD_BCRYPT`, y extraer la validación repetida de ID a un método común —
**todo dentro del servicio `rest_usuario`, sin alterar el contrato de datos de éxito de `/persona`
y `/autenticacion` salvo los cambios explícitamente declarados como BREAKING**.

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en el servicio `rest_usuario`:

| Path (relativo a `rest_usuario/`) | Acción | Defecto/AC |
|-----------------------------------|--------|------------|
| `rutas/RtsHelper.php` | CREATE | A1 — Lógica común de rutas |
| `rutas/PersonaRts.php` | MODIFY | A1+A2+A11 — Refactor con helper + BaseCtrl + limpiar comentario |
| `rutas/ValidacionRts.php` | MODIFY | A1+A2 — Refactor con helper + BaseCtrl |
| `rutas/UsuarioRts.php` (hoy 0 bytes) | CREATE (reescribir) | A3 — Dominio Usuario funcional |
| `controladores/UsuarioCtrl.php` (hoy 0 bytes) | CREATE (reescribir) | A3 — Controlador Usuario |
| `index.php` | MODIFY | A4 (quitar `/rol` de $rutas) + A8 (eliminar `mostrarPaginaAnuncio`) |
| `rutas/RolRts.php` | DELETE | A4 — Archivo vacío, dominio inerte |
| `modelos/PersonaMdl.php` | MODIFY | A5 (error handling) + A13 (PASSWORD_BCRYPT) |
| `controladores/PersonaCtrl.php` | MODIFY | A5 — Manejar error como 500 |
| `controladores/ValidacionCtrl.php` | MODIFY | A6 (quitar código de respuesta) + A7 (claveActual) + A12 (usar validarIdEntero) |
| `modelos/ValidacionMdl.php` | MODIFY | A7 — Método obtenerHashClave |
| `rutas.txt` | DELETE | A9 — Documentación desactualizada |
| `controladores/BaseCtrl.php` | MODIFY | A10 (eliminar bloque comentado) + A12 (añadir validarIdEntero) |

## 3. Out-of-scope (qué NO entra)

- No se implementa JWT ni middleware de autenticación global.
- No se restringe el acceso de `obtenerPersonaPorCorreo` (D9); queda documentado como riesgo
  pendiente.
- No se resuelve el canal de entrega del código de recuperación (correo/SMS).
- No se toca `CategoriaRts.php`, `CategoriaCtrl.php`, `CategoriaMdl.php` (D5) — permanecen sin
  modificar, sin registrar, sin eliminar.
- No se completa `/rol` con lógica nueva (no hay Ctrl/Mdl que reutilizar).
- No se externalizan credenciales de BD a variables de entorno.
- No se migra a Composer/PSR-4 ni se introduce framework.
- No se toca `.htaccess` (cubierto por RF-001).
- No se lee ni modifica nada dentro de `rest_usuario/docs/` (salvo este propio HLT).
- No se realiza ninguna acción dentro de `rest_usuario/anexos/`.
- No se modifica `obtenerCodigoRecuperacion` — solo `generarCodigoRecuperacion` (A6).
- No se modifica `configuracion/global.php`, `configuracion/enlace.php`, `configuracion/CorsConfig.php`.
- No se modifican `modelos/CategoriaMdl.php`.

## 4. Impacto en contratos públicos

### 4.1. Endpoints preservados (sin cambios en contrato de datos de éxito)

| Método | Ruta | Éxito | Errores |
|--------|------|-------|---------|
| GET | `/persona` | 200 + health-check JSON (mismos campos que hoy) | 404/500 |
| GET | `/persona/obtener?id={id}` | 200 + datos persona | 400/404/500 |
| PUT | `/persona/actualizar` | 200 + `{id_usuario, nombres, apellidos, telefono}` | 400/500 |
| POST | `/persona/agregar` | 200 + `{idUsuario: int}` | 400/409/500 |
| DELETE | `/persona` | 501 (placeholder preservado) | — |
| GET | `/autenticacion` | 200 + health-check JSON (mismos campos que hoy) | 404/500 |
| GET | `/autenticacion/usRol?id={id}` | 200 + arreglo roles | 400/404/500 |
| POST | `/autenticacion/autenticar` | 200 + `{id, nombres, apellidos}` | 400/401/500 |
| POST | `/autenticacion/obtenerCodigo` | 200 + `{codigo_recuperacion: int}` | 400/404/500 |

### 4.2. Endpoints modificados (cambio de contrato declarado)

| Método | Ruta | Cambio | Éxito después | Errores |
|--------|------|--------|---------------|---------|
| POST | `/autenticacion/generarCodigo` | R5 — **BREAKING**: respuesta ya NO incluye `codigo_recuperacion` | 200 + `{"success":"ok"}` (o equivalente sin código) | 400/500 |
| PUT | `/autenticacion/actualizarClave` | R6 — **BREAKING**: requiere nuevo campo `claveActual`; verifica con `password_verify`; 401 si no coincide | 200 + `{"success":"ok"}` | 400/401/500 |

### 4.3. Endpoints nuevos

| Método | Ruta | Éxito | Errores |
|--------|------|-------|---------|
| GET | `/usuario` | 200 + health-check JSON del dominio Usuario | 404/500 |
| GET | `/usuario/lista` | 200 + arreglo de usuarios | 500 |
| GET | `/usuario/obtener?id={id}` | 200 + datos del usuario | 400/404/500 |
| POST | `/usuario/agregar` | 200 + `{idUsuario: int}` | 400/500 |
| DELETE | `/usuario/eliminar?id={id}` | 200 + confirmación | 400/500 |

### 4.4. Endpoints eliminados del enrutamiento

| Ruta | Cambio | Código después |
|------|--------|----------------|
| `/rol` | R3 — **BREAKING**: se retira del mapa `$rutas` | 404 "Endpoint no encontrado" |

## 5. Compatibilidad

| Cambio | Tipo | Impacto en SPA |
|--------|------|----------------|
| R3 — `/rol` ya no enruta | **BREAKING** | Clientes que consultaban `/rol` (respuesta vacía) ahora reciben 404. Se declara porque cualquier cliente que dependa de la existencia de la ruta verá código HTTP distinto. |
| R5 — `generarCodigo` sin código en respuesta | **BREAKING** | El frontend ya no recibe el código generado. Requiere coordinación: el código se genera y persiste en BD, pero su entrega al usuario legítimo debe resolverse por otro canal (correo/SMS), fuera del alcance de este RF. Se declara como deuda pendiente explícita. |
| R6 — `actualizarClave` requiere `claveActual` | **BREAKING** | El frontend debe enviar el campo `claveActual`. Sin él, el endpoint responde 400. Con `claveActual` incorrecta, responde 401. El cambio es necesario para evitar cambios de contraseña sin autorización. |

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Transporte (helper compartido) | `rutas/RtsHelper.php` | CREATE |
| Transporte | `rutas/PersonaRts.php` | MODIFY |
| Transporte | `rutas/ValidacionRts.php` | MODIFY |
| Transporte | `rutas/UsuarioRts.php` | CREATE (reescribir) |
| Transporte | `rutas/RolRts.php` | DELETE |
| Aplicación/Negocio | `controladores/UsuarioCtrl.php` | CREATE (reescribir) |
| Aplicación/Negocio | `controladores/BaseCtrl.php` | MODIFY |
| Aplicación/Negocio | `controladores/PersonaCtrl.php` | MODIFY |
| Aplicación/Negocio | `controladores/ValidacionCtrl.php` | MODIFY |
| Datos | `modelos/PersonaMdl.php` | MODIFY |
| Datos | `modelos/ValidacionMdl.php` | MODIFY |
| Front Controller | `index.php` | MODIFY |
| Documentación obsoleta | `rutas.txt` | DELETE |

## 7. Delta arquitectónico

### 7.1. Tabla de Delta

| Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
|------|---------------------------|--------|-----------------|
| Rts | `rest_usuario/rutas/RtsHelper.php` | CREATE | Clase con métodos estáticos: `parsearAccion(string $domainName): ?string` (extrae el segmento de URI tras el dominio), `leerBodyJson(): array` (lee `php://input`, decodifica, valida — 400 si vacío/inválido/ausente), `responderExito(mixed $data): never` (200 + JSON), `responderError(string $msg, int $httpCode): never` (error + exit), `responderNoPermitido(array $metodos): never` (405), `responderHealthCheck(array $data): never` (200 con datos). No extiende `BaseCtrl` ni requiere instancia. |
| Controlador | `rest_usuario/controladores/BaseCtrl.php` | MODIFY | (A10) Eliminar bloque comentado (líneas 31–57 inclusive: funciones `respuestaJson`, `respuestaExitosa`, `respuestaError`). (A12) Añadir método protegido `validarIdEntero(mixed $id, string $nombreCampo = 'ID'): void` — si `!filter_var($id, FILTER_VALIDATE_INT) \|\| $id <= 0` responde `respuestaErrorSimple("{$nombreCampo} inválido", 400)` y sale. |
| Modelo | `rest_usuario/modelos/PersonaMdl.php` | MODIFY | (A5) En el bloque `catch` (línea 102), reemplazar `return "Error al generar el registro: " . $e->getMessage();` por `return ['error' => 'Error interno en la inserción'];`. (A13) En línea 62, cambiar `PASSWORD_DEFAULT` por `PASSWORD_BCRYPT`. |
| Controlador | `rest_usuario/controladores/PersonaCtrl.php` | MODIFY | (A5) En `agregarPersona` (líneas 143–147): cambiar la condición de error a `is_string($resultado) \|\| (is_array($resultado) && isset($resultado['error']))` y responder `respuestaErrorSimple('Error interno del servidor', 500)` sin exponer el detalle. |
| Modelo | `rest_usuario/modelos/ValidacionMdl.php` | MODIFY | (A7) Añadir método `obtenerHashClave(int $id, string $usuario): ?string` — SELECT `usu_clave` FROM `sgen_usuario` WHERE `usu_idUsuario` = ? AND `usu_usuario` = ? AND `usu_estado` = '1'; devuelve el hash o null. |
| Controlador | `rest_usuario/controladores/ValidacionCtrl.php` | MODIFY | (A6) En `generarCodigoRecuperacion`: reemplazar `$this->respuestaExitosaSimple(['codigo_recuperacion' => $codigoRecuperacion])` por `$this->respuestaExitosaSimple(null)`. (A7) En `actualizarClave`: añadir `claveActual` a los campos requeridos; antes de actualizar, invocar `$this->validacionService->obtenerHashClave($id, $usuario)` y verificar con `password_verify($data['claveActual'], $hash)`, responder `respuestaErrorSimple('La clave actual no coincide', 401)` si falla. (A12) En `obtenerRolesUsuario`: reemplazar `if (!filter_var($id, FILTER_VALIDATE_INT) \|\| $id <= 0)` por `$this->validarIdEntero($id)`. |
| Rts | `rest_usuario/rutas/PersonaRts.php` | MODIFY | (A1+A2) Refactor completo: eliminar funciones redundantes (`manejarGet`, `manejarPut`, `manejarPost`, `manejarDelete`) y reemplazar la lógica de parseo de acción, lectura de body y respuestas por llamadas a `RtsHelper` estáticas. Cada response HTTP se hace vía `RtsHelper::responderExito()` o `::responderError()` en vez de `http_response_code()` + `echo json_encode()`. La estructura de datos del health-check se conserva idéntica. (A11) El comentario en línea 84 (`// $controller->obtenerPersonaPorUsuario($id)`) se corrige a `obtenerPersonaPorCorreo`. |
| Rts | `rest_usuario/rutas/ValidacionRts.php` | MODIFY | (A1+A2) Refactor completo equivalente al de PersonaRts: migrar a llamadas `RtsHelper`, eliminar funciones redundantes, reemplazar respuestas directas por helpers. Health-check y estructura de datos se conservan. |
| Rts | `rest_usuario/rutas/UsuarioRts.php` | CREATE (reescribir) | (A3) Implementar siguiendo el patrón de `PersonaRts` refactorizado (usa `RtsHelper`, llama a `UsuarioCtrl`). Acciones: GET /usuario (health check), GET /usuario/lista, GET /usuario/obtener?id=, POST /usuario/agregar, DELETE /usuario/eliminar?id=. |
| Controlador | `rest_usuario/controladores/UsuarioCtrl.php` | CREATE (reescribir) | (A3) Clase `UsuarioCtrl extends BaseCtrl`. Se conecta con `UsuarioMdl` (ya existente). Métodos públicos: `listaUsuarios()`, `obtenerUsuario($data)`, `agregarUsuario($data)`, `eliminarUsuario($data)`. Validaciones: campos requeridos, `validarIdEntero` para IDs, `limpiarDatos`. |
| Front Controller | `rest_usuario/index.php` | MODIFY | (A4) Eliminar la entrada `'/rol' => 'rutas/RolRts.php'` del mapa `$rutas`. (A8) Eliminar la función `mostrarPaginaAnuncio()` (líneas 64–444) y su invocación en líneas 18–26. |
| Rts | `rest_usuario/rutas/RolRts.php` | DELETE | (A4) Archivo vacío (0 bytes), dominio sin tripleta. |
| Documentación | `rest_usuario/rutas.txt` | DELETE | (A9) Documentación paralela desactualizada, no referenciada por ningún `require`/`include`. |

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción | Motivo |
|---------------|--------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/RtsHelper.php` | CREATE | Lógica común de rutas (A1). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/PersonaRts.php` | MODIFY | Refactor A1+A2+A11. |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/ValidacionRts.php` | MODIFY | Refactor A1+A2. |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/UsuarioRts.php` | CREATE (reescribir) | Completar dominio (A3). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/UsuarioCtrl.php` | CREATE (reescribir) | Completar dominio (A3). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/index.php` | MODIFY | Retirar /rol (A4), eliminar HTML (A8). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/RolRts.php` | DELETE | Dominio inerte (A4). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/modelos/PersonaMdl.php` | MODIFY | Bug error (A5) + hash (A13). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/PersonaCtrl.php` | MODIFY | Manejo error 500 (A5). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/ValidacionCtrl.php` | MODIFY | Quitar código (A6) + claveActual (A7) + validarIdEntero (A12). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/modelos/ValidacionMdl.php` | MODIFY | Método obtenerHashClave (A7). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas.txt` | DELETE | Doc obsoleta (A9). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/BaseCtrl.php` | MODIFY | Eliminar comentado (A10) + validarIdEntero (A12). |

## 9. Estrategia de validación

Cada validación se detalla en el checklist (Grupo J — Validaciones).
Se verifican 3 categorías:

- **Health checks y regresión**: los endpoints `/persona` y `/autenticacion` responden igual que antes
  (mismo health-check, mismos contratos de éxito). Comando: `curl -i http://localhost/rest_usuario/<prefijo>`.
- **Cambios de contrato BREAKING**: `/rol` → 404; `generarCodigo` → 200 sin `codigo_recuperacion`;
  `actualizarClave` → 400/401 según campo `claveActual`.
- **Limpieza de código**: `index.php` sin HTML, `BaseCtrl.php` sin bloque comentado, `rutas.txt` no existe.
- **Out-of-scope preservado**: `CategoriaRts/Ctrl/Mdl` sin modificar, `anexos/` sin cambios.
- **Plan de regresión P1–P11 de RF-002 §8**: se ejecutan contra el código refactorizado y se compara
  con el baseline (antes del refactor). Cada diferencia no declarada como BREAKING es regresión.

## 10. Riesgos

- **Regresión en contratos preservados.** Al refactorizar las rutas, algún mensaje de error o formato
  de health-check se altera inadvertidamente. *Mitigación:* T20–T22 verifican health-checks y
  T33 ejecuta el plan de regresión P1–P11, comparando antes/después.
- **ClaveActual incorrecta en actualizarClave.** Si `obtenerHashClave` retorna null por usuario no
  encontrado, no se puede verificar `claveActual`. El controlador debe responder 404 en ese caso
  antes de 401. *Mitigación:* validar que el hash exista antes de `password_verify`.
- **Ruptura de SPA por cambios BREAKING.** Si el frontend no se actualiza para enviar `claveActual`
  o si espera `codigo_recuperacion` en `generarCodigo`. *Mitigación:* cambios declarados como
  BREAKING en §5, con notificación al equipo frontend.
- **Olvidar require_once de UsuarioMdl en UsuarioCtrl.** *Mitigación:* tarea T5 incluye verificación
  de que `UsuarioCtrl` importa `UsuarioMdl` y `BaseCtrl`.

## 11. Rollback

- **Global:** restaurar los archivos modificados desde el control de versiones y recuperar `rutas.txt`
  y `RolRts.php` si fueron eliminados. Revertir `index.php` a su versión anterior. El servicio vuelve
  al estado previo sin efectos en BD (no hay cambios de esquema).
- **Por artefacto:** deshacer cada MODIFY individual revirtiendo el archivo; recuperar cada DELETE
  desde Git; eliminar cualquier CREATE.
- **Rollback de rutas:** si `/rol` debe restaurarse, re-agregar la entrada `'/rol' => 'rutas/RolRts.php'`
  en `index.php` y recrear `RolRts.php` (vacío). Si `RtsHelper.php` causa problemas, revertir
  `PersonaRts.php` y `ValidacionRts.php` a sus versiones previas (que no dependen de él) y eliminar
  `RtsHelper.php`.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` =
> realizado y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado, con razón. Un
> checkbox = una acción verificable. El agente implementador **actualiza cada checkbox al completar y
> verificar** la tarea, y solo entonces. Todos se entregan en `[ ]`.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_usuario` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/` |
| Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) |
| Capa de datos | `configuracion/enlace.php` (clase `Enlace`, `bind_param`) |
| Capa de respuesta | `controladores/BaseCtrl.php` (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`) |
| BD | MySQL/MariaDB — `DB_NAME=sist_criteriokelly` (ver `configuracion/global.php`) |
| Prefijo de tablas | `sgen_` (sist_generico) |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `curl http://localhost/rest_usuario/persona` |
| Estrategia de migraciones | No hay cambios de esquema en este RF |
| Logs | `logs/php_errors.log` del servicio |

### Grupo A — Infraestructura compartida de rutas (A1, A2)

- `[ ]` **T1** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/RtsHelper.php` | CREATE
    - Delta: Clase con métodos estáticos `parsearAccion`, `leerBodyJson`, `responderExito`, `responderError`, `responderNoPermitido`, `responderHealthCheck`. Ver §7.1 Delta Rts para detalle de cada método.
    - Note: No extiende `BaseCtrl`. Los métodos de respuesta (`responderExito`, `responderError`, `responderNoPermitido`) implementan el mismo patrón JSON_UNESCAPED_UNICODE + Content-Type + exit que BaseCtrl, pero son estáticos. PersonaRts y ValidacionRts dependen de este archivo — debe crearse primero.

- `[ ]` **T2** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/PersonaRts.php` | MODIFY
    - Delta: Refactor completo. Reemplazar el parseo manual de URI por `RtsHelper::parsearAccion('persona')`. Reemplazar cada `http_response_code()` + `echo json_encode()` por `RtsHelper::responderExito()`, `::responderError()`, `::responderNoPermitido()`. Reemplazar los bloques de lectura/validación de body por `RtsHelper::leerBodyJson()`. La estructura de datos de health-check se conserva textualmente. Corregir el comentario de línea 84 de `obtenerPersonaPorUsuario` a `obtenerPersonaPorCorreo`.
    - Note: Requiere T1 completado. El contrato de datos de éxito y health-check no cambia.

- `[ ]` **T3** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/ValidacionRts.php` | MODIFY
    - Delta: Refactor equivalente al de PersonaRts. Reemplazar parseo manual por `RtsHelper::parsearAccion('autenticacion')`. Reemplazar respuestas directas por `RtsHelper::responderExito()`, `::responderError()`, `::responderNoPermitido()`. Reemplazar bloques de lectura/validación de body por `RtsHelper::leerBodyJson()`. Health-check se conserva.
    - Note: Requiere T1 completado.

### Grupo B — Completar dominio Usuario (A3)

- `[ ]` **T4** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/UsuarioRts.php` | CREATE (reescribir)
    - Delta: Implementar siguiendo el patrón de PersonaRts refactorizado: `require_once` de `UsuarioCtrl.php` y `RtsHelper.php`; `RtsHelper::parsearAccion('usuario')`; switch por método HTTP con `RtsHelper::responderNoPermitido` en default; GET sin acción → health-check con datos del dominio Usuario; acciones: `lista` (GET) → `$controller->listaUsuarios()`, `obtener` (GET con `id` query) → `$controller->obtenerUsuario($data)`, `agregar` (POST) → body vía `RtsHelper::leerBodyJson()` y `$controller->agregarUsuario($data)`, `eliminar` (DELETE con `id` query) → `$controller->eliminarUsuario($data)`.
    - Note: Requiere T1 (RtsHelper) y T5 (UsuarioCtrl) completados.

- `[ ]` **T5** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/UsuarioCtrl.php` | CREATE (reescribir)
    - Delta: Clase `UsuarioCtrl extends BaseCtrl`. Propiedad privada `$usuarioService = new UsuarioMdl()`. Métodos: `listaUsuarios()` → llama a `$this->usuarioService->listaUsuarios()` y devuelve resultado con `$this->respuestaExitosaSimple($usuarios)`. `obtenerUsuario($data)` → valida `id` requerido, `$this->validarIdEntero($data['id'])`, llama al modelo, 404 si no existe. `agregarUsuario($data)` → valida campos `usu_perIdPerso`, `usu_usuario`, `usu_clave`, limpia, llama al modelo, devuelve `idUsuario`. `eliminarUsuario($data)` → valida `id`, llama al modelo. Todos los métodos envuelven en try/catch con `error_log()` + 500 genérico.
    - Note: `require_once(__DIR__ . '/BaseCtrl.php')` y `require_once(__DIR__ . '/../modelos/UsuarioMdl.php')`.

### Grupo C — Retirar /rol (A4)

- `[ ]` **T6** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/index.php` | MODIFY
    - Delta: Eliminar la línea `'/rol' => 'rutas/RolRts.php',` del mapa `$rutas` (línea 32).
    - Insert after: El mapa `$rutas` en línea 29.
    - Note: Solo eliminar la entrada de `/rol`; el resto del mapa permanece intacto.

- `[ ]` **T7** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas/RolRts.php` | DELETE
    - Delta: Eliminar el archivo (0 bytes). No hay Ctrl ni Mdl asociado que reutilizar.
    - Note: Requiere T6 completado (primero se desregistra, luego se elimina el archivo).

### Grupo D — Corregir bug de agregarPersona (A5)

- `[ ]` **T8** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/modelos/PersonaMdl.php` | MODIFY
    - Delta: En el bloque `catch` (línea 102), reemplazar `return "Error al generar el registro: " . $e->getMessage();` por `return ['error' => 'Error interno en la inserción'];`.
    - Insert after: El bloque `catch` existente después de `} catch (Exception $e) {`.
    - Note: El controlador (T9) depende de que el modelo retorne un array con clave `'error'` para detectar el fallo.

- `[ ]` **T9** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/PersonaCtrl.php` | MODIFY
    - Delta: En `agregarPersona`, cambiar la condición de la línea 143 de `if (!$resultado || (is_array($resultado) && isset($resultado['Error'])))` a `if (!$resultado || is_string($resultado) || (is_array($resultado) && isset($resultado['error'])))`. El mensaje de error debe ser genérico: `$this->respuestaErrorSimple('Error interno del servidor', 500)`.
    - Insert after: La línea `$resultado = $this->personaService->agregarPersona(...)`.
    - Note: El detalle de la excepción queda solo en `error_log()`, nunca en la respuesta HTTP.

### Grupo E — Remover código de recuperación de la respuesta (A6)

- `[ ]` **T10** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/ValidacionCtrl.php` | MODIFY
    - Delta: En `generarCodigoRecuperacion`, reemplazar `$this->respuestaExitosaSimple(['codigo_recuperacion' => $codigoRecuperacion])` por `$this->respuestaExitosaSimple(null)`.
    - Insert after: La línea `if ($resultado == false) { ... }` cerca de línea 98.
    - Note: El código se genera y persiste en BD (`usu_codiorecupe`), pero no se devuelve al cliente. La entrega al usuario legítimo queda pendiente de un canal externo (fuera de alcance).

### Grupo F — Exigir claveActual en actualizarClave (A7)

- `[ ]` **T11** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/modelos/ValidacionMdl.php` | MODIFY
    - Delta: Añadir método `obtenerHashClave(int $id, string $usuario): ?string`. SQL: `SELECT usu_clave FROM sgen_usuario WHERE usu_idUsuario = ? AND usu_usuario = ? AND usu_estado = '1'`. Devuelve el hash BCRYPT o null.
    - Insert after: Método `actualizarClaveUsuario` (después de línea 68).
    - Note: Necesario para que el controlador pueda verificar `claveActual` con `password_verify`.

- `[ ]` **T12** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/ValidacionCtrl.php` | MODIFY
    - Delta: En `actualizarClave`: (1) Añadir `'claveActual'` a `$this->validarDatos($data, ['claveActual', 'clave'])`. (2) Antes de la llamada a `actualizarClaveUsuario`, invocar `$this->validacionService->obtenerHashClave($id, $datosLimpios['usuario'])`. Si retorna null, responder 404 "Usuario no encontrado". Si `!password_verify($data['claveActual'], $hash)`, responder `$this->respuestaErrorSimple('La clave actual no coincide', 401)`. Si coincide, proceder con el cambio.
    - Insert after: La estructura completa de `actualizarClave` (líneas 132–164).
    - Note: Es BREAKING (R6) porque ahora requiere `claveActual` que antes no existía. Requiere T11.

### Grupo G — Limpieza de código muerto (A8, A9, A10, A11)

Nota: A11 se resuelve en T2 como parte del refactor de PersonaRts.

- `[ ]` **T13** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/index.php` | MODIFY
    - Delta: (1) Eliminar las líneas 14–26 que detectan la raíz y llaman a `mostrarPaginaAnuncio()`. (2) Eliminar la función `mostrarPaginaAnuncio()` completa (líneas 64–444), incluyendo el `<?php` de apertura (línea 64) y el cierre `<?php` (línea 443) que quedan, asegurando que no sobre `?>` fuera de contexto.
    - Insert after: La línea `$requestUri = parse_url(...)`. Y el resto del archivo existente (mapa de rutas, foreach).
    - Note: Debe ejecutarse después de T6 (ambas modifican index.php). Se puede hacer en una sola pasada combinando ambos cambios.

- `[ ]` **T14** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/rutas.txt` | DELETE
    - Delta: Eliminar el archivo (raíz del servicio, 103 líneas). No hay `require`/`include` que lo referencie.
    - Note: Sin dependencias.

- `[ ]` **T15** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/BaseCtrl.php` | MODIFY
    - Delta: Eliminar el bloque comentado (líneas 31–57 inclusive) que contiene las funciones previas `respuestaJson`, `respuestaExitosa`, `respuestaError`.
    - Insert after: Línea 29 (cierre de `limpiarDatos`). Debe quedar el método `respuestaExitosaSimple` inmediatamente después de `limpiarDatos`.
    - Note: Las versiones "Simple" de los métodos son las que se usan en todo el proyecto.

### Grupo H — Utilidad compartida de validación de ID (A12)

- `[ ]` **T16** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/BaseCtrl.php` | MODIFY
    - Delta: Añadir método protegido `validarIdEntero(mixed $id, string $nombreCampo = 'ID'): void`. Implementación: si `!filter_var($id, FILTER_VALIDATE_INT) || $id <= 0`, responder `$this->respuestaErrorSimple("{$nombreCampo} inválido", 400)`.
    - Insert after: Método `limpiarDatos` (después de su llave de cierre), antes del bloque comentado (ya eliminado en T15).
    - Note: Requiere T15 completado (el bloque comentado debe estar eliminado para insertar en la posición correcta). Ejecutar después de T15.

- `[ ]` **T17** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/controladores/ValidacionCtrl.php` | MODIFY
    - Delta: En `obtenerRolesUsuario`, reemplazar `if (!filter_var($id, FILTER_VALIDATE_INT) || $id <= 0) { ... }` (líneas 47–49) por `$this->validarIdEntero($id)`.
    - Insert after: Inicio del método `obtenerRolesUsuario` en línea 44.
    - Note: Requiere T16 completado. Es la única ocurrencia en scope de la validación repetida (las de CategoriaCtrl están fuera de alcance por D5).

### Grupo I — Unificar algoritmo de hash (A13)

- `[ ]` **T18** | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_usuario/modelos/PersonaMdl.php` | MODIFY
    - Delta: En línea 62, cambiar `PASSWORD_DEFAULT` por `PASSWORD_BCRYPT` (coincidiendo con `UsuarioMdl` y `ValidacionMdl`).
    - Insert after: Línea `$claveHasheada = password_hash($clave, PASSWORD_DEFAULT);`.
    - Note: `PASSWORD_DEFAULT` y `PASSWORD_BCRYPT` son equivalentes hoy, pero la convención del repo es usar `PASSWORD_BCRYPT` explícito.

### Grupo J — Validaciones

#### Health checks y endpoints existentes

- `[ ]` **T19** | Health check — `/persona`
    - Comando: `curl -i http://localhost/rest_usuario/persona`
    - Esperado: HTTP/1.1 200 OK, Content-Type application/json, body JSON con `servicio` → "Persona API" y `estado_servicio` → "activo". Mismos campos que antes del refactor.

- `[ ]` **T20** | Health check — `/autenticacion`
    - Comando: `curl -i http://localhost/rest_usuario/autenticacion`
    - Esperado: HTTP/1.1 200 OK, body JSON con `servicio` → "Autenticacion API" y `estado_servicio` → "activo". Mismos campos que antes del refactor.

- `[ ]` **T21** | Health check — `/usuario` (nuevo)
    - Comando: `curl -i http://localhost/rest_usuario/usuario`
    - Esperado: HTTP/1.1 200 OK, body JSON con estado del dominio Usuario (antes no respondía nada útil).

- `[ ]` **T22** | `/rol` retirado
    - Comando: `curl -i http://localhost/rest_usuario/rol`
    - Esperado: HTTP/1.1 404, body JSON con `error` → "Endpoint no encontrado".

#### Cambios de comportamiento

- `[ ]` **T23** | `agregarPersona` con fallo de inserción — error 500 genérico
    - Comando: Enviar POST a `/persona/agregar` con datos que provoquen fallo (p. ej. correo duplicado o datos que violen una restricción de BD).
    - Esperado: HTTP/1.1 500, body `{"error":"Error interno del servidor"}`. El cuerpo NO contiene texto de excepción PHP. El detalle real queda en `logs/php_errors.log`.

- `[ ]` **T24** | `generarCodigo` sin código en respuesta
    - Comando: `curl -i -X POST http://localhost/rest_usuario/autenticacion/generarCodigo -H "Content-Type: application/json" -d '{"id":1}'`
    - Esperado: HTTP/1.1 200, body JSON **sin** la clave `codigo_recuperacion`.

- `[ ]` **T25** | `actualizarClave` sin `claveActual` → 400
    - Comando: `curl -i -X PUT http://localhost/rest_usuario/autenticacion/actualizarClave -H "Content-Type: application/json" -d '{"id":1,"clave":"nueva123"}'`
    - Esperado: HTTP/1.1 400, body error indicando campo requerido faltante.

- `[ ]` **T26** | `actualizarClave` con `claveActual` incorrecta → 401
    - Comando: `curl -i -X PUT http://localhost/rest_usuario/autenticacion/actualizarClave -H "Content-Type: application/json" -d '{"id":1,"claveActual":"incorrecta","clave":"nueva123"}'`
    - Esperado: HTTP/1.1 401, body `{"error":"La clave actual no coincide"}`.

- `[ ]` **T27** | `actualizarClave` con `claveActual` correcta → 200
    - Comando: `curl -i -X PUT http://localhost/rest_usuario/autenticacion/actualizarClave -H "Content-Type: application/json" -d '{"id":1,"claveActual":"<clave_real>","clave":"nueva123"}'`
    - Esperado: HTTP/1.1 200, body confirmación. La clave queda actualizada.

#### Limpieza de código

- `[ ]` **T28** | `index.php` sin HTML de marketing
    - Comando: Inspeccionar `rest_usuario/index.php`. Buscar la cadena `mostrarPaginaAnuncio`.
    - Esperado: No existe la función `mostrarPaginaAnuncio`. No existe el HTML embebido de la página de anuncio (a partir de `<!DOCTYPE html>`). El `index.php` solo contiene lógica de enrutamiento.

- `[ ]` **T29** | `rutas.txt` eliminado
    - Comando: `ls -la rest_usuario/rutas.txt` o `test -f rest_usuario/rutas.txt && echo "existe" || echo "no existe"`
    - Esperado: El archivo `rutas.txt` no existe en la raíz del servicio.

- `[ ]` **T30** | `BaseCtrl.php` sin bloque comentado
    - Comando: Inspeccionar `controladores/BaseCtrl.php`. Buscar el bloque comentado de funciones previas (`respuestaJson`, `respuestaExitosa`, `respuestaError`).
    - Esperado: No existe el bloque comentado (líneas 31–57 de la versión original). El código pasa directamente de `limpiarDatos` a `respuestaExitosaSimple`.

#### Out-of-scope preservado

- `[ ]` **T31** | Categoria intacto
    - Comando: `md5sum rest_usuario/rutas/CategoriaRts.php rest_usuario/controladores/CategoriaCtrl.php rest_usuario/modelos/CategoriaMdl.php`
    - Esperado: Los tres archivos existen y no fueron modificados (checksum coincide con el baseline pre-refactor). Si no hay baseline, verificar que las rutas de `index.php` no incluyen `/categoria`.

- `[ ]` **T32** | `anexos/` intacto
    - Comando: `ls -la rest_usuario/anexos/`
    - Esperado: Los archivos `sist_generico.sql` y `sist_genericoDatos.sql` existen y no fueron creados, modificados ni eliminados archivos en el directorio.

#### Plan de regresión funcional (RF-002 §8)

El implementador debe ejecutar los comandos P1–P11 de RF-002 §8 contra el código refactorizado y documentar cada resultado. Toda diferencia no declarada como BREAKING en este HLT se considera regresión y debe reportarse.

- `[ ]` **T33** | Regresión — P1 a P7 (endpoints preservados)
    - Ejecutar los comandos P1 a P7 de RF-002 §8.
    - Esperado: Mismo contrato de éxito y códigos HTTP que antes del refactor. Sin regresiones.

- `[ ]` **T34** | Regresión — P8 a P11 (cambios declarados)
    - Ejecutar los comandos P8 a P11 de RF-002 §8.
    - Esperado: P8 → 200 (nuevo, antes vacío). P9 → 404 (BREAKING, declarado R3). P10 → 200 sin `codigo_recuperacion` (BREAKING, declarado R5). P11 → 400 sin `claveActual` (BREAKING, declarado R6).

#### Validaciones de integridad del código

- `[ ]` **T35** | RtsHelper existe y es funcional
    - Comando: `php -l rest_usuario/rutas/RtsHelper.php`
    - Esperado: `No syntax errors detected`.

- `[ ]` **T36** | Sintaxis PHP íntegra en todos los archivos modificados
    - Comando: `php -l rest_usuario/index.php && php -l rest_usuario/rutas/PersonaRts.php && php -l rest_usuario/rutas/ValidacionRts.php && php -l rest_usuario/rutas/UsuarioRts.php && php -l rest_usuario/controladores/UsuarioCtrl.php && php -l rest_usuario/controladores/PersonaCtrl.php && php -l rest_usuario/controladores/ValidacionCtrl.php && php -l rest_usuario/controladores/BaseCtrl.php && php -l rest_usuario/modelos/PersonaMdl.php && php -l rest_usuario/modelos/ValidacionMdl.php`
    - Esperado: Todos los archivos reportan `No syntax errors detected`.

- `[ ]` **T37** | No hay referencias a `/rol` en el mapa de rutas
    - Comando: `grep -n "'/rol'" rest_usuario/index.php`
    - Esperado: Sin coincidencias (cero ocurrencias de `'/rol'` en `index.php`).

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 37
- Completadas [X]: _(pendiente)_
- Bloqueadas [BLOCKED]: _(pendiente)_
- Omitidas: _(pendiente)_

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | rutas/RtsHelper.php |  |
| T2 |  | rutas/PersonaRts.php |  |
| T3 |  | rutas/ValidacionRts.php |  |
| T4 |  | rutas/UsuarioRts.php |  |
| T5 |  | controladores/UsuarioCtrl.php |  |
| T6 |  | index.php |  |
| T7 |  | rutas/RolRts.php |  |
| T8 |  | modelos/PersonaMdl.php |  |
| T9 |  | controladores/PersonaCtrl.php |  |
| T10 |  | controladores/ValidacionCtrl.php |  |
| T11 |  | modelos/ValidacionMdl.php |  |
| T12 |  | controladores/ValidacionCtrl.php |  |
| T13 |  | index.php |  |
| T14 |  | rutas.txt |  |
| T15 |  | controladores/BaseCtrl.php |  |
| T16 |  | controladores/BaseCtrl.php |  |
| T17 |  | controladores/ValidacionCtrl.php |  |
| T18 |  | modelos/PersonaMdl.php |  |
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
| T32 |  | (validación) |  |
| T33 |  | (validación) |  |
| T34 |  | (validación) |  |
| T35 |  | (validación) |  |
| T36 |  | (validación) |  |
| T37 |  | (validación) |  |

### Validaciones ejecutadas

| ID | Comando exacto ejecutado | Salida / HTTP observado | Esperado | ¿Coincide? |
|----|--------------------------|-------------------------|----------|------------|
| T19 |  |  |  |  |
| T20 |  |  |  |  |
| T21 |  |  |  |  |
| T22 |  |  |  |  |
| T23 |  |  |  |  |
| T24 |  |  |  |  |
| T25 |  |  |  |  |
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

### Blockers
- _(descripción del bloqueo, tarea afectada y qué se necesita para desbloquear)_

### Archivos cambiados
- _(path absoluto — CREATE|MODIFY|DELETE — resumen de una línea)_

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas se ejecutaron y su resultado quedó registrado.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T37 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
