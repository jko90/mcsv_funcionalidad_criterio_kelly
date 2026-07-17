# RF-002 — Refactor del código backend de `rest_criteriokelly`

> **Tipo:** Refactor / Deuda técnica (arquitectura, duplicación, manejo de errores, corrección de defectos).
> **Servicio afectado:** `rest_criteriokelly`.
> **Archivos objetivo:** `index.php`, `rutas/*.php` (+ `rutas/ReglasKellyRts.php` nuevo),
> `controladores/*.php`, `modelos/*.php`, `rutas.txt`, `README.md` (solo la referencia a `rutas.txt`).
> **Prioridad:** Alta (incluye corrección de fuga de mensajes de excepción al cliente).
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `rest_criteriokelly/docs/rf/RF-001_refactor_htaccess.md` (refactor de `.htaccess`,
> no de código PHP — este RF-002 no lo duplica).
>
> **Restricciones explícitas de esta auditoría y de este RF (instrucción del solicitante):**
> - No se leyó ni se modifica nada dentro de `rest_criteriokelly/docs/` (salvo la creación de este
>   propio documento).
> - No se realiza ninguna acción dentro de `rest_criteriokelly/anexos/` (contiene `procedimientos.sql`,
>   `sist_criteriokelly.sql`); permanece intocado. Ninguna tarea de este RF invoca ni modifica
>   procedimientos almacenados.

---

## 1. Historia de usuario

> **Como** desarrollador backend del servicio `rest_criteriokelly`,
> **quiero** que el código PHP siga la arquitectura por capas de forma simétrica en los cinco
> dominios (cuentas, bitácora, comentarios, criterioKelly, reglasKelly), sin duplicación entre
> rutas, sin fuga de mensajes internos de excepción al cliente, y sin código muerto,
> **para** que el servicio de cálculo del Criterio de Kelly sea mantenible, consistente, y el
> frontend reciba errores HTTP homogéneos y seguros.

---

## 2. Contexto y problema actual (auditoría del código real)

`rest_criteriokelly` gestiona cuentas/capital, bitácora de operaciones, comentarios y el cálculo
del Criterio de Kelly. La auditoría del código real (`index.php`, `rutas/`, `controladores/`,
`modelos/`, `configuracion/`, `errors/`, `rutas.txt`) — sin leer `docs/` ni tocar `anexos/` —
encontró los siguientes defectos verificados con archivo y línea:

| # | Defecto detectado | Evidencia en el código |
|---|-------------------|------------------------|
| D1 | **Asimetría arquitectónica: `ReglasKelly` sin tripleta propia.** `ReglasKellyCtrl`/`ReglasKellyMdl` existen completos, pero no tienen `Rts` propio; se instancian dentro de `rutas/BitacoraRts.php` y se invocan solo vía `PUT /bitacora/finalizaBitacora` → `ReglasKellyCtrl::finalizarOperacionBitacora`. Contradice la convención "un dominio = una tripleta" que el propio `README.md` proclama. | `rutas/BitacoraRts.php:4,12,35,157-154` (require, instancia, dispatch, `case 'finalizaBitacora'`). |
| D2 | **Duplicación entre los 4 `*Rts.php`.** Parseo de acción, lectura/validación de body, y bloque de health-check repetidos casi idénticos en `CuentasRts.php`, `BitacoraRts.php`, `ComentariosRts.php`, `CriterioKellyRts.php`. | `CuentasRts.php:13-23,51-63,99-119`; `BitacoraRts.php:15-25,53-65,78-98`; `ComentariosRts.php:13-23,48-60,96-116`; `CriterioKellyRts.php:13-23,43-55`. |
| D3 | **Bug de copy-paste en health-check.** `ComentariosRts.php` responde `'service' => 'BitacoraRTs'` en vez de `'ComentariosRTs'`. | `ComentariosRts.php:54`. |
| D4 | **Comentario incorrecto, resto de plantilla copiada.** `CuentasRts.php` línea 17 dice `// Buscar posición de 'persona'...` pero el código busca `'cuentas'`. | `CuentasRts.php:17`. |
| D5 | **Las rutas no usan `BaseCtrl`.** Cada `manejarX` de `*Rts.php` hace `http_response_code(...)` + `echo json_encode(...)` manual; convive con el patrón correcto de los controladores (que sí usan `BaseCtrl`) y con un tercer patrón paralelo en `index.php`. | `CuentasRts.php`, `BitacoraRts.php`, `ComentariosRts.php`, `CriterioKellyRts.php` (todas); `controladores/BaseCtrl.php:5-52` sin usar desde rutas; `index.php:46-49,57-61`. |
| D6 | **Exposición de mensaje crudo de excepción al cliente.** Los 5 `catch` de `CriterioKellyCtrl.php` responden `respuestaErrorSimple($e->getMessage(), 500)`, exponiendo el mensaje interno. Contradice explícitamente lo que el propio `README.md` afirma sobre no exponer detalles sensibles. | `controladores/CriterioKellyCtrl.php:55,101,143,189,225`. |
| D7 | **Mensaje de excepción reenviado al cliente desde el modelo.** `CuentasMdl` y `BitacoraMdl` capturan la excepción y **retornan un string** con el mensaje crudo (`"Error al generar el registro: " . $e->getMessage()`); `BitacoraCtrl::crearBitacora` y `ComentariosCtrl::actualizarBitacoraComentario` reenvían ese string tal cual al cliente vía `respuestaErrorSimple(...)`. | `modelos/CuentasMdl.php:52`; `modelos/BitacoraMdl.php:42`; `controladores/BitacoraCtrl.php:108-111`; `controladores/ComentariosCtrl.php:192-201`. |
| D8 | **Sin autenticación/autorización.** Ningún endpoint valida que el `usuarioId` recibido corresponda a quien hace la petición (no existe JWT/sesión en todo el servicio); el filtro `WHERE ... AND usuarioId = ?` es cosmético si ese mismo ID también lo controla el cliente. | Confirmado por búsqueda exhaustiva (`jwt`/`token`/`auth`/`session`/`bearer`: 0 resultados en todo el árbol PHP); `README.md` ya lo documenta como pendiente. |
| D9 | **Eliminación física inconsistente con la convención del proyecto.** `BitacoraCtrl::eliminarBitacoraBitacora` (endpoint `DELETE /bitacora/eliminarBitacora`) ejecuta `DELETE FROM sckb_bitacora` y `DELETE FROM scko_observacion` (borrado físico real), mientras `CuentasMdl::eliminarCuenta` usa eliminación lógica (`estado='0'`), consistente con `CLAUDE.md`. La tabla `sckb_bitacora` **ya tiene** la columna `bit_estado`, usada en otra consulta del mismo modelo. | `modelos/BitacoraMdl.php:48,116,54` (uso de `bit_estado='1'` en otra query confirma que la columna existe). |
| D10 | **Código muerto comentado.** Método completo comentado `actualizarBitacoraTPBESL` en `BitacoraMdl.php`; bloque SQL comentado de ~78 líneas (versión antigua de `obtenerOperacionesParaAnalisis` con `ROW_NUMBER() OVER`) en `CriterioKellyMdl.php`. | `modelos/BitacoraMdl.php:63-69`; `modelos/CriterioKellyMdl.php:37-114`. |
| D11 | **`rutas.txt` documenta un servicio distinto e incorrecto.** Su contenido describe endpoints de `autenticacion` (`/autenticacion/autenticar`, `/autenticacion/roles`, etc.), no los dominios reales de este servicio (cuentas/bitácora/comentarios/criterioKelly). El propio `README.md` lo cita como fuente de "ejemplos de payloads" reales, lo cual es engañoso. Ningún código PHP lo carga. | `rutas.txt` (raíz, 103 líneas); `README.md` (línea que remite a `rutas.txt`). |
| D12 | **Duplicación exacta entre modelos de dominios distintos.** `ComentariosMdl::crearComentariosPorBitacora` y `BitacoraMdl::crearComentariosPorBitacora` son el mismo SQL con el mismo bind, copiado en dos archivos. | `modelos/ComentariosMdl.php:26-30`; `modelos/BitacoraMdl.php:108-112`. |
| D13 | **Validación de "ID numérico positivo" duplicada** en múltiples rutas y controladores con el mismo patrón (`is_numeric`, `(int)$id <= 0`). | `CuentasRts.php:73-77`, `BitacoraRts.php:174-178`, `ComentariosRts.php:70-74`, y equivalentes en varios `*Ctrl.php`. |
| D14 | **Inconsistencias de nomenclatura.** `ComentariosCtrl::ObtenerObservacionesPorBitacora` (PascalCase, debería ser camelCase); llamadas `$this->reglasKellyService->EliminarResultadoOperativas(...)` con "E" mayúscula contra la definición real `eliminarResultadoOperativas` (minúscula); columna referenciada como `bit_idBitacora` en un punto y `bit_idbitacora` en el resto del mismo archivo. | `controladores/ComentariosCtrl.php:228`; `controladores/ReglasKellyCtrl.php:170,183,199,221` vs `modelos/ReglasKellyMdl.php:33`; `modelos/BitacoraMdl.php:48` vs `60,61,70,84`. |
| D15 | **Riesgo dentro del propio manejo de errores.** El bloque `catch` de un método de `ReglasKellyCtrl.php` referencia variables (`$montoBalanceInicial`, `$idResultadoOperativo`, etc.) que solo existen si la ejecución avanzó más allá de donde se definen en el `try`; si la excepción ocurre antes, el propio `catch` puede fallar por variables indefinidas. | `controladores/ReglasKellyCtrl.php:248-256`. |
| D16 | **Patrón de compensación manual repetido 4 veces.** El mismo patrón `DELETE FROM sck*_... WHERE ...id = ?` para deshacer inserciones ante fallo posterior se repite en `ReglasKellyMdl.php` en 4 puntos distintos, sin una función común. | `modelos/ReglasKellyMdl.php:35-37,76-78,101-103,123-125`. |
| D17 | **Código HTTP 422 no documentado.** Se usa en un único punto del proyecto sin que el `README.md` lo liste entre los códigos posibles. | `controladores/ReglasKellyCtrl.php:95`. |

> **Nota — no confundir con RF-001.** El `.htaccess` de este servicio ya tiene su propio RF y HLT.
> Este RF-002 cubre exclusivamente el código PHP del servicio, no la configuración de Apache.

---

## 3. Objetivo del refactor

Dar a `ReglasKelly` su tripleta arquitectónica propia, eliminar la duplicación entre rutas y
modelos, unificar el manejo de errores para que ningún mensaje interno de excepción llegue al
cliente, y retirar el código muerto y la documentación incorrecta (`rutas.txt`) —
**manteniendo el contrato de datos de éxito vigente** para todos los endpoints existentes, salvo
el cambio de contrato declarado explícitamente en §6 (R2).

---

## 4. Alcance (in-scope)

- **A1. Extraer `ReglasKelly` a su propia tripleta.** Crear `rutas/ReglasKellyRts.php`, registrar
  `/reglasKelly` en el mapa `$rutas` de `index.php`, y exponer
  `PUT /reglasKelly/finalizaBitacora` (mismo nombre de acción, mismo contrato de body y de
  respuesta que hoy) invocando `ReglasKellyCtrl::finalizarOperacionBitacora`. Retirar el caso `PUT`
  de `rutas/BitacoraRts.php` (que a partir de ahora responde **405** para `PUT /bitacora/*`, al no
  tener ninguna acción propia de ese método) (D1).
- **A2.** Consolidar la lógica común de rutas (parseo de acción, lectura/validación de body,
  health-check) en un mecanismo compartido entre los 5 `*Rts.php` (los 4 existentes + el nuevo
  `ReglasKellyRts.php`) (D2).
- **A3.** Corregir el health-check de `ComentariosRts.php` para que reporte `'ComentariosRTs'`
  (D3).
- **A4.** Corregir el comentario incorrecto de `CuentasRts.php:17` (D4).
- **A5.** Migrar todas las respuestas de los `*Rts.php` a `BaseCtrl`
  (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`), con
  `JSON_UNESCAPED_UNICODE` (D5).
- **A6.** Unificar el manejo de errores de `CriterioKellyCtrl.php`: los 5 `catch` responden mensaje
  genérico + **500** vía `BaseCtrl`, sin exponer `$e->getMessage()`; el detalle real se registra
  con `error_log()` (D6).
- **A7.** Corregir `CuentasMdl`/`BitacoraMdl` para que, ante una excepción, retornen un valor que el
  controlador distinga inequívocamente como error (no un string con el mensaje crudo); los
  controladores (`BitacoraCtrl::crearBitacora`, `ComentariosCtrl::actualizarBitacoraComentario`)
  responden **500** genérico vía `BaseCtrl` (D7).
- **A8.** Eliminar el código muerto: método comentado `actualizarBitacoraTPBESL` en `BitacoraMdl.php`
  y el bloque SQL comentado en `CriterioKellyMdl.php` (D10).
- **A9.** Eliminar `rutas.txt` y quitar la referencia a él en `README.md` (D11).
- **A10.** Eliminar la duplicación exacta entre `ComentariosMdl::crearComentariosPorBitacora` y
  `BitacoraMdl::crearComentariosPorBitacora`, dejando una única implementación reutilizada (D12).
- **A11.** Extraer la validación repetida de "ID numérico positivo" a un método común reutilizado
  por rutas/controladores (D13).
- **A12.** Corregir las inconsistencias de nomenclatura: `ObtenerObservacionesPorBitacora` →
  `obtenerObservacionesPorBitacora`; llamadas a `EliminarResultadoOperativas` →
  `eliminarResultadoOperativas`; unificar `bit_idBitacora`/`bit_idbitacora` a una sola grafía
  (`bit_idbitacora`, consistente con el resto del archivo) (D14).
- **A13.** Corregir el bloque `catch` de `ReglasKellyCtrl.php` para no depender de variables que
  puedan estar indefinidas si la excepción ocurre antes de su asignación (D15).
- **A14.** Consolidar el patrón de compensación repetido en `ReglasKellyMdl.php` en un único método
  reutilizado por los 4 puntos que lo necesitan, sin cambiar su comportamiento (D16).
- **A15.** Documentar el código **422** ya usado en el contrato de error homogéneo que este RF deja
  vigente para el frontend (D17).

---

## 5. Fuera de alcance (out-of-scope)

- **No** implementar JWT ni middleware de autenticación global (D8) — objetivo cross-servicio
  declarado en `CLAUDE.md`, corresponde a un RF separado.
- **No** convertir el `DELETE` físico de `BitacoraCtrl::eliminarBitacoraBitacora` a eliminación
  lógica (D9) — decisión explícita: se documenta como hallazgo pendiente, no se corrige en este RF.
- **No** externalizar credenciales de BD a variables de entorno (ya documentado como pendiente en
  `README.md`/`CLAUDE.md`; es otro RF).
- **No** introducir transacciones SQL (mysqli) para el patrón de compensación de `ReglasKellyMdl`;
  A14 solo elimina la duplicación de código, no cambia la estrategia de "deshacer manualmente" por
  una transaccional.
- **No** invocar ni modificar procedimientos almacenados; **no** se abre ni modifica ningún archivo
  de `anexos/`.
- **No** migrar a Composer/PSR-4 ni introducir un framework.
- **No** tocar `.htaccess` (cubierto por RF-001).
- **No** leer ni modificar nada dentro de `rest_criteriokelly/docs/` (salvo la creación de este RF).
- **No** realizar ninguna acción dentro de `rest_criteriokelly/anexos/`.

---

## 6. Reglas de negocio y restricciones

- **R1 — Funcionalidad preservada por defecto.** Todos los endpoints existentes de `/cuentas`,
  `/bitacora` (GET/POST/DELETE), `/comentarios` y `/criterioKelly` conservan su contrato de datos
  de éxito y sus códigos HTTP vigentes, salvo el cambio declarado en R2.
- **R2 — Reubicación de `finalizaBitacora` (BREAKING declarado).** `PUT /bitacora/finalizaBitacora`
  deja de existir; el mismo comportamiento (mismo body, misma respuesta) pasa a
  `PUT /reglasKelly/finalizaBitacora`. `PUT /bitacora/*` responde **405** tras el cambio. El
  frontend debe actualizar la URL que invoca.
- **R3 — Arquitectura simétrica.** Los 5 dominios (`cuentas`, `bitacora`, `comentarios`,
  `criterioKelly`, `reglasKelly`) siguen la tripleta `Rts → Ctrl → Mdl` completa.
- **R4 — Respuestas solo vía `BaseCtrl`.** Prohibido `echo`/`json_encode` directo en `Rts`/`Ctrl`;
  toda salida usa `respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple` con
  `JSON_UNESCAPED_UNICODE`.
- **R5 — Manejo de errores homogéneo para el frontend.** Ningún mensaje de excepción interno llega
  al cliente en ningún dominio; el detalle real se registra con `error_log()`. Los códigos HTTP
  vigentes que el frontend puede recibir son: **200** (éxito), **400** (validación/JSON
  inválido/acción no reconocida), **404** (recurso no encontrado), **405** (método no soportado),
  **422** (regla de negocio de riesgo excedido, ya en uso en `ReglasKellyCtrl`), **500** (error
  interno, mensaje genérico).
- **R6 — Convenciones de nomenclatura.** Clases en `PascalCase`; métodos y variables en
  `camelCase` (incluye las correcciones de A12); sufijos fijos `*Rts`, `*Ctrl`, `*Mdl`; dominio y
  comentarios en español.
- **R7 — Sin código muerto ni documentación incorrecta.** No quedan bloques de código comentado
  como código muerto, ni `rutas.txt` describiendo un servicio distinto al real.
- **R8 — `anexos/` intocable.** Ninguna tarea de este RF crea, modifica ni elimina archivos dentro
  de `rest_criteriokelly/anexos/`, ni invoca procedimientos almacenados.
- **R9 — `docs/` fuera de lectura y escritura**, salvo la creación de este propio documento.
- **R10 — Eliminaciones lógicas donde ya son la convención vigente.** `CuentasMdl::eliminarCuenta`
  sigue usando `estado='0'`, sin cambios. La inconsistencia de `BitacoraCtrl` (D9) queda solo
  documentada, no corregida (R2 de la sección "fuera de alcance").

---

## 7. Criterios de aceptación

```gherkin
Dado el servicio rest_criteriokelly desplegado en Apache
Cuando ejecuto  GET http://localhost/rest_criteriokelly/cuentas
 y  GET http://localhost/rest_criteriokelly/bitacora
 y  GET http://localhost/rest_criteriokelly/comentarios
 y  GET http://localhost/rest_criteriokelly/criterioKelly
Entonces los cuatro responden el mismo health-check (200, JSON) que antes del refactor
  Y el health-check de /comentarios reporta 'service' => 'ComentariosRTs' (antes 'BitacoraRTs')

Dado el código refactorizado
Cuando ejecuto  GET http://localhost/rest_criteriokelly/reglasKelly
Entonces recibo 200 con un health-check propio del nuevo dominio reglasKelly

Dado el código refactorizado
Cuando ejecuto  PUT http://localhost/rest_criteriokelly/bitacora/finalizaBitacora  con un body válido
Entonces recibo 405 (la acción se movió de dominio, cambio declarado en R2)
Cuando ejecuto  PUT http://localhost/rest_criteriokelly/reglasKelly/finalizaBitacora  con el mismo body
Entonces recibo la misma respuesta de éxito que antes producía PUT /bitacora/finalizaBitacora

Dado un escenario que provoca una excepción dentro de CriterioKellyCtrl
Cuando ejecuto cualquiera de sus 5 endpoints en condición de fallo
Entonces recibo 500 con mensaje genérico
  Y el cuerpo de la respuesta NO contiene el texto de una excepción PHP
  Y el detalle real queda registrado en logs/php_errors.log

Dado un fallo de inserción en crearBitacora o en actualizarBitacoraComentario
Cuando ejecuto esos endpoints en condición de fallo
Entonces recibo 500 con mensaje genérico, sin el mensaje crudo de la excepción en el cuerpo

Dado el código refactorizado
Cuando reviso rutas.txt
Entonces el archivo no existe
  Y README.md ya no lo referencia

Dado el código refactorizado
Cuando reviso modelos/BitacoraMdl.php y modelos/CriterioKellyMdl.php
Entonces no existe ningún bloque de código comentado como código muerto

Dado el código refactorizado
Cuando reviso controladores/ComentariosCtrl.php y controladores/ReglasKellyCtrl.php
Entonces los métodos y sus invocaciones usan camelCase consistente
  (obtenerObservacionesPorBitacora, eliminarResultadoOperativas)

Dado el código refactorizado
Cuando reviso rest_criteriokelly/anexos/
Entonces procedimientos.sql y sist_criteriokelly.sql no fueron creados, modificados ni eliminados
```

---

## 8. Plan de pruebas de regresión funcional (obligatorio antes de cerrar el RF)

Cada endpoint preservado se prueba **antes y después** del refactor con el mismo comando,
comparando la salida:

| # | Comando `curl` | Resultado esperado (idéntico antes/después salvo cambios declarados) |
|---|----------------|------------------------------------------------------------------------|
| P1 | `curl -i http://localhost/rest_criteriokelly/cuentas` | 200, health-check sin cambios |
| P2 | `curl -i http://localhost/rest_criteriokelly/bitacora` | 200, health-check sin cambios |
| P3 | `curl -i http://localhost/rest_criteriokelly/comentarios` | 200; **cambia** el campo `service` a `ComentariosRTs` (antes `BitacoraRTs`, corrección declarada) |
| P4 | `curl -i http://localhost/rest_criteriokelly/criterioKelly` | 200, health-check sin cambios |
| P5 | `curl -i -X POST http://localhost/rest_criteriokelly/cuentas/nueva -H "Content-Type: application/json" -d '{...datos válidos...}'` | Mismo contrato de éxito que antes |
| P6 | `curl -i -X DELETE "http://localhost/rest_criteriokelly/cuentas/eliminar?id=<id>"` | Mismo contrato (eliminación lógica) que antes |
| P7 | `curl -i -X POST http://localhost/rest_criteriokelly/bitacora/crear -H "Content-Type: application/json" -d '{...}'` | Mismo contrato de éxito que antes |
| P8 | `curl -i -X DELETE "http://localhost/rest_criteriokelly/bitacora/eliminarBitacora?id=<id>"` | Mismo comportamiento (borrado físico, sin cambio — D9 fuera de alcance) |
| P9 | `curl -i -X PUT http://localhost/rest_criteriokelly/bitacora/finalizaBitacora -H "Content-Type: application/json" -d '{...}'` | **Cambia:** 405 (endpoint reubicado, R2) |
| P10 | `curl -i -X PUT http://localhost/rest_criteriokelly/reglasKelly/finalizaBitacora -H "Content-Type: application/json" -d '{...mismo body que P9...}'` | **Nuevo:** misma respuesta de éxito que antes daba P9 |
| P11 | `curl -i -X POST http://localhost/rest_criteriokelly/comentarios/crear -H "Content-Type: application/json" -d '{...}'` | Mismo contrato de éxito que antes |
| P12 | `curl -i -X POST http://localhost/rest_criteriokelly/criterioKelly/<accion> -H "Content-Type: application/json" -d '{...caso de fallo...}'` | **Cambia:** 500 con mensaje genérico (antes exponía `$e->getMessage()`, corrección declarada en A6) |

Cada fila se ejecuta contra el código **antes** del refactor (baseline) y **después**, adjuntando
la comparación en el Execution Report del Task Brief. Toda diferencia no listada como "cambia" se
considera regresión y bloquea el cierre del RF.

---

## 9. Tareas técnicas derivadas (alto nivel)

> Detalle línea-por-línea y anclas exactas corresponden al HLT / Task Brief del modo planificación
> (`docs/doc_modo_planificacion.md`). Aquí solo se enumeran las tareas del requerimiento.

- [ ] Crear `rutas/ReglasKellyRts.php` y registrar `/reglasKelly` en `index.php`; retirar el caso PUT de `BitacoraRts.php` (A1).
- [ ] Consolidar la lógica común entre los 5 `*Rts.php` (A2).
- [ ] Corregir el health-check de `ComentariosRts.php` (A3).
- [ ] Corregir el comentario incorrecto de `CuentasRts.php` (A4).
- [ ] Migrar las respuestas de los `*Rts.php` a `BaseCtrl` (A5).
- [ ] Unificar el manejo de errores de `CriterioKellyCtrl.php` (A6).
- [ ] Corregir `CuentasMdl`/`BitacoraMdl` y sus controladores para no reenviar mensajes crudos (A7).
- [ ] Eliminar el código muerto comentado en `BitacoraMdl.php` y `CriterioKellyMdl.php` (A8).
- [ ] Eliminar `rutas.txt` y su referencia en `README.md` (A9).
- [ ] Unificar `crearComentariosPorBitacora` en una sola implementación (A10).
- [ ] Extraer la validación de ID numérico positivo a un método común (A11).
- [ ] Corregir las inconsistencias de nomenclatura (A12).
- [ ] Corregir el bloque `catch` de `ReglasKellyCtrl.php` (A13).
- [ ] Consolidar el patrón de compensación de `ReglasKellyMdl.php` (A14).
- [ ] Documentar el código 422 en el contrato de error (A15).
- [ ] Ejecutar el plan de pruebas de regresión de §8 y adjuntar comparación antes/después.

---

## 10. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. `reglasKelly` es una tripleta completa (`Rts → Ctrl → Mdl`), registrada en `index.php`.
2. No existe duplicación de lógica entre los 5 `*Rts.php` ni entre los modelos de dominios distintos.
3. Ningún `catch` de ningún controlador expone `$e->getMessage()` ni un mensaje de excepción crudo al cliente.
4. `rutas.txt` fue eliminado y `README.md` ya no lo referencia.
5. No queda código muerto comentado en `BitacoraMdl.php` ni `CriterioKellyMdl.php`.
6. Las inconsistencias de nomenclatura (D14) fueron corregidas.
7. El plan de pruebas de regresión de §8 se ejecutó completo, con las 12 comparaciones documentadas y sin regresiones no declaradas.
8. `rest_criteriokelly/anexos/` permanece sin modificar; ninguna tarea invocó procedimientos almacenados.
9. Se respetan las restricciones R1–R10 y las convenciones del repo (`CLAUDE.md`).
