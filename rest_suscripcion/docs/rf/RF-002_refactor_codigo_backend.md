# RF-002 — Refactor del código backend de `rest_suscripcion`

> **Tipo:** Refactor / Deuda técnica (arquitectura, duplicación, manejo de errores, corrección de
> defectos críticos).
> **Servicio afectado:** `rest_suscripcion`.
> **Archivos objetivo:** `index.php`, `rutas/*.php` (+ `rutas/PagosRts.php` nuevo),
> `controladores/*.php`, `modelos/*.php`.
> **Prioridad:** Crítica (incluye un endpoint que hoy siempre falla en producción).
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `rest_suscripcion/docs/rf/RF-001_refactor_htaccess.md` (refactor de `.htaccess`,
> no de código PHP — este RF-002 no lo duplica).
>
> **Restricciones explícitas de esta auditoría y de este RF (instrucción del solicitante):**
> - No se leyó ni se modifica nada dentro de `rest_suscripcion/docs/` (salvo la creación de este
>   propio documento).
> - No se realiza ninguna acción dentro de `rest_suscripcion/anexos/` (contiene `Modelo.PNG`,
>   `Procedimientos NuevaSuscripcion.sql`, `Procedimientos RenovacionAutomatica.sql`,
>   `sist_suscripcion.sql`, `sist_suscripcionDatos.sql`, `sist_suscripcion_CRM.sql`); permanece
>   intocado. Ninguna tarea de este RF invoca procedimientos almacenados de renovación automática
>   ni de nueva suscripción.

---

## 1. Historia de usuario

> **Como** desarrollador backend del servicio `rest_suscripcion`,
> **quiero** que el código PHP elimine la duplicación entre rutas y controladores, corrija el
> endpoint de consulta de suscripciones que hoy siempre falla, retire el código de depuración
> activo en producción, complete el dominio de pagos sin punto de entrada, y responda al frontend
> con un contrato de error HTTP homogéneo,
> **para** que el servicio de suscripciones y pagos sea confiable y mantenible.

---

## 2. Contexto y problema actual (auditoría del código real)

`rest_suscripcion` gestiona planes, suscripciones y pagos. La auditoría del código real
(`index.php`, `rutas/`, `controladores/`, `modelos/`, `configuracion/`) — sin leer `docs/` ni tocar
`anexos/` — encontró los siguientes defectos verificados con archivo y línea:

| # | Defecto detectado | Evidencia en el código |
|---|-------------------|------------------------|
| D1 | **Duplicación entre `PlanesRts.php` y `SuscripcionRts.php`.** Parseo de acción, respuesta de "método no permitido" (405), y bloque de health-check casi idénticos. | `PlanesRts.php:13-27,34-39,44-55`; `SuscripcionRts.php:13-23,32-38,44-56`. |
| D2 | **Las rutas no usan `BaseCtrl`.** Ambas `*Rts.php` responden con `echo json_encode(...)` + `http_response_code(...)` manual, contradiciendo la propia regla del `README.md` ("usar exclusivamente los métodos de respuesta de `BaseCtrl`"). | `PlanesRts.php`, `SuscripcionRts.php` (ninguna hereda de `BaseCtrl`). |
| D3 | **Validación de ID repetida sin reutilizar `BaseCtrl`.** El patrón `empty(trim($id))` → `htmlspecialchars(trim(...))` → cast a `int` → `<= 0` se repite palabra por palabra en tres controladores, en vez de usar `limpiarDatos()`/`validarDatos()` ya disponibles en `BaseCtrl`. | `PagosCtrl.php:19-28`; `PlanesCtrl.php:60-69`; `SuscripcionCtrl.php:24-33`. |
| D4 | **Mapeo de fila a array de salida duplicado.** El mismo bloque de 10 campos de "plan" se repite en dos métodos de `PlanesCtrl`; el mismo bloque de 10 campos de "suscripción" se repite **tres veces** en `SuscripcionCtrl`. | `PlanesCtrl.php:33-47,78-98`; `SuscripcionCtrl.php:44-56,106-117,187-198`. |
| D5 | **Duplicación de SQL entre dos métodos de `PlanesMdl`.** `obtenerPlanesDisponibles` y `obtenerPlanesSuscriptosSinPagar` repiten el mismo `SELECT` de 10 campos base con los mismos `JOIN`. | `PlanesMdl.php:16-18,25-32`. |
| D6 | **Bug crítico: endpoint siempre responde 500.** `SuscripcionCtrl::obtenerSuscripcionesPorUsuario` ejecuta incondicionalmente, como primera línea del método, `respuestaErrorSimple('Error interno del servidor'.$idUsuario, 500)` — como esta función termina en `exit`, **el endpoint `GET /suscripcion/porUsuario` siempre responde 500 y la lógica real (líneas 24-61) nunca se ejecuta**. Además concatena `$idUsuario` crudo (sin sanear) en el mensaje de error devuelto al cliente. Hay una segunda línea de depuración idéntica en la línea 34, también inalcanzable. | `SuscripcionCtrl.php:22,34`. |
| D7 | **Remanente de depuración comentado con el mismo patrón.** Confirma que este patrón de debug (concatenar variables al mensaje de error) es una práctica repetida, aunque en este punto quedó comentado, no activo. | `PlanesCtrl.php:70`. |
| D8 | **`echo` de depuración contamina la respuesta JSON.** `rutas/SuscripcionRts.php` imprime un `echo` de texto plano con el body recibido **antes** de invocar al controlador, anteponiendo texto no-JSON a la respuesta real de `POST /suscripcion/crearConPago`, rompiendo el contrato "todas las respuestas son JSON" que exige el propio `README.md`. | `SuscripcionRts.php:117`. |
| D9 | **Dominio `Pagos` completo pero sin punto de entrada HTTP.** `PagosCtrl.php`/`PagosMdl.php` existen y tienen lógica funcional, pero no hay `rutas/PagosRts.php` ni registro en `index.php`; son inalcanzables desde la API pública. El `README.md` tampoco documenta `/pagos`. | `index.php:29-32` (solo `/planes`, `/suscripcion`); ausencia confirmada de `rutas/PagosRts.php`. |
| D10 | **Bug de precedencia de operadores en SQL.** `SuscripcionMdl::obtenerSuscripcionPorIDUsuario` tiene `WHERE sis_idSuscrip = ? OR (sus_usuarioId = ? AND ...) AND CURRENT_DATE BETWEEN ...`; por precedencia SQL (`AND` liga más fuerte que `OR`), el filtro de vigencia de fecha **solo aplica a la segunda rama del `OR`**, no a la búsqueda directa por `id`. Una suscripción vencida puede devolverse como válida si se consulta por su `id`. | `SuscripcionMdl.php:27-32`. |
| D11 | **Reasignación que descarta un resultado calculado.** En `insertarSuscripcionConPago`, `$idSuscripcionDB` se inicializa en `0`, se calcula una comprobación de existencia en un bloque `if`, pero la línea siguiente **siempre** sobrescribe la variable con `$sis_idSuscrip` sin importar el resultado de esa comprobación previa — el cálculo de "existe suscripción" queda sin efecto. | `SuscripcionCtrl.php:156-161`. |
| D12 | **Sin verificación de idempotencia en pagos.** `PagosMdl::insertarPagoSuscripcion` hace un `INSERT` directo sin comprobar antes si `idTransaccion` ya fue registrado — riesgo de duplicar el pago si el cliente reintenta la petición (timeout, doble clic, reintento de red). | `PagosMdl.php:14-18`. |
| D13 | **Sin autenticación/autorización.** Ningún endpoint valida que el `idUsuario`/`sus_usuarioId` recibido corresponda a quien hace la petición (no existe JWT/sesión en el servicio); el propio `README.md` ya lo documenta como pendiente. | Confirmado por búsqueda exhaustiva (`jwt`/`token`/`auth`/`bearer`/`session`: sin resultados relevantes en el árbol PHP). |
| D14 | **Código muerto comentado en `BaseCtrl`.** Bloque completo de una versión anterior de las funciones de respuesta, reemplazado por las versiones "Simple". | `controladores/BaseCtrl.php:30-56`. |
| D15 | **Inconsistencia de nomenclatura del parámetro "ID de usuario".** `insertarSuscripcionConPago` recibe `iUsuario`; `insertarSuscripcionSinPago` recibe `sus_usuarioId` para el mismo concepto, en el mismo controlador. | `SuscripcionCtrl.php:81,137`; `README.md:227`. |
| D16 | **Alias SQL con mayúsculas inconsistentes.** `PLIN.pins_idInterSuscrip` (mayúsculas) convive con `plin` (minúsculas) en el resto del mismo archivo. | `PlanesMdl.php:17,31`. |
| D17 | **Comentario/docstring copiado sin actualizar.** El bloque de documentación de `insertarSuscripcionSinPago` describe "Obtiene los planes disponibles", que no corresponde a ese método. | `SuscripcionCtrl.php:65-68`. |

> **Nota — no confundir con RF-001.** El `.htaccess` de este servicio ya tiene su propio RF y HLT.
> Este RF-002 cubre exclusivamente el código PHP del servicio, no la configuración de Apache.

---

## 3. Objetivo del refactor

Corregir el endpoint de consulta de suscripciones que hoy siempre falla, eliminar el código de
depuración activo en producción, completar el dominio `Pagos` sin punto de entrada, corregir el
bug de precedencia SQL y la reasignación que anula una comprobación de negocio, añadir
idempotencia al registro de pagos, y eliminar la duplicación entre rutas y controladores —
**manteniendo el contrato de datos de éxito vigente**, salvo los cambios de comportamiento
declarados explícitamente en §6 (todos ellos correcciones de bugs, no alteraciones arbitrarias).

---

## 4. Alcance (in-scope)

- **A1.** Consolidar la lógica común entre `PlanesRts.php`, `SuscripcionRts.php` y el
  `PagosRts.php` nuevo (A9): parseo de acción, respuesta 405, health-check (D1).
- **A2.** Migrar todas las respuestas de los `*Rts.php` a `BaseCtrl`
  (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`) con
  `JSON_UNESCAPED_UNICODE` (D2).
- **A3.** Sustituir la validación manual repetida de ID por el uso de `limpiarDatos()`/
  `validarDatos()` de `BaseCtrl` (o un método común de validación de ID positivo) en los tres
  controladores (D3).
- **A4.** Extraer el mapeo de fila "plan" y "suscripción" a métodos comunes reutilizados por los
  distintos endpoints de cada controlador (D4).
- **A5.** Eliminar la duplicación de SQL entre los dos métodos de `PlanesMdl`, reutilizando una
  base de consulta común (D5).
- **A6.** Corregir `SuscripcionCtrl::obtenerSuscripcionesPorUsuario`: eliminar las dos líneas de
  depuración (D6), restaurando la ejecución de la lógica real del método.
- **A7.** Eliminar el remanente de depuración comentado en `PlanesCtrl.php:70` (D7).
- **A8.** Eliminar el `echo` de depuración de `rutas/SuscripcionRts.php:117` (D8).
- **A9.** Crear `rutas/PagosRts.php` y registrar `/pagos` en el mapa `$rutas` de `index.php`,
  siguiendo el patrón de `Planes`/`Suscripcion`, dejando `PagosCtrl`/`PagosMdl` alcanzables (D9).
- **A10.** Corregir `SuscripcionMdl::obtenerSuscripcionPorIDUsuario` envolviendo la condición
  completa entre paréntesis para que `CURRENT_DATE BETWEEN` aplique uniformemente a ambas ramas
  del `OR` (D10).
- **A11.** Corregir la reasignación de `insertarSuscripcionConPago` para que el resultado real de
  la comprobación de existencia se use en el flujo, en vez de descartarse (D11).
- **A12.** Añadir verificación de idempotencia en `PagosMdl::insertarPagoSuscripcion`: consultar la
  existencia de `idTransaccion` antes del `INSERT`; si ya existe, el controlador responde **409**
  (D12).
- **A13.** Eliminar el bloque de código comentado en `BaseCtrl.php` (D14).
- **A14.** Unificar el nombre del parámetro de "ID de usuario" entre `insertarSuscripcionSinPago` e
  `insertarSuscripcionConPago`, usando `sus_usuarioId` en ambos (nombre ya vigente en el resto del
  dominio de suscripción) (D15).
- **A15.** Unificar los alias SQL de `PlanesMdl.php` en minúsculas (D16).
- **A16.** Corregir el comentario/docstring copiado incorrectamente en `SuscripcionCtrl.php` (D17).

---

## 5. Fuera de alcance (out-of-scope)

- **No** implementar JWT ni middleware de autenticación global (D13) — objetivo cross-servicio
  declarado en `CLAUDE.md`, corresponde a un RF separado.
- **No** externalizar credenciales de BD a variables de entorno (ya documentado como pendiente en
  `README.md`/`CLAUDE.md`; es otro RF).
- **No** invocar ni conectar los procedimientos almacenados de `anexos/Procedimientos
  NuevaSuscripcion.sql` ni `Procedimientos RenovacionAutomatica.sql`; la renovación automática
  permanece sin disparar lógica desde PHP, tal como está hoy.
- **No** se abre ni modifica ningún archivo de `anexos/`.
- **No** migrar a Composer/PSR-4 ni introducir un framework.
- **No** tocar `.htaccess` (cubierto por RF-001).
- **No** leer ni modificar nada dentro de `rest_suscripcion/docs/` (salvo la creación de este RF).
- **No** realizar ninguna acción dentro de `rest_suscripcion/anexos/`.

---

## 6. Reglas de negocio y restricciones

- **R1 — Funcionalidad preservada por defecto.** Los endpoints existentes conservan su contrato de
  datos de éxito, salvo los cambios de comportamiento declarados en R2–R6, todos ellos
  correcciones de bugs verificados, no alteraciones arbitrarias.
- **R2 — `GET /suscripcion/porUsuario` deja de responder siempre 500 (corrección declarada).**
  Tras A6, responde según su lógica real: **200** con los datos si existe la suscripción, o
  **404** si no. Se declara explícitamente porque el estado actual (siempre 500) es en sí mismo el
  defecto a corregir.
- **R3 — `POST /suscripcion/crearConPago` deja de anteponer texto de depuración al JSON
  (corrección declarada).** El cuerpo de la respuesta pasa a ser JSON puro, como exige el contrato
  documentado.
- **R4 — `/pagos` queda registrado y funcional (ADITIVO).** No existe hoy; su creación no rompe
  ningún cliente existente.
- **R5 — Filtro de vigencia uniforme (corrección declarada).** Tras A10,
  `obtenerSuscripcionPorIDUsuario` puede excluir de los resultados una suscripción vencida que
  antes se devolvía al consultar por `id` directo; se declara porque cambia qué registros se
  consideran "vigentes" en esa consulta específica.
- **R6 — Idempotencia en pagos (comportamiento nuevo declarado).** `POST` sobre el endpoint de
  registro de pago responde **409** si el `idTransaccion` ya fue registrado, en vez de crear un
  segundo registro duplicado.
- **R7 — Arquitectura y respuestas.** Toda ruta usa `BaseCtrl`; toda validación de ID reutiliza
  `limpiarDatos()`/`validarDatos()` o un método común, sin repetir `htmlspecialchars(trim(...))`
  inline.
- **R8 — Manejo de errores homogéneo.** Ningún `catch` expone `$e->getMessage()` ni concatena datos
  de entrada del cliente en el mensaje de error devuelto; el detalle real se registra con
  `error_log()`.
- **R9 — Convenciones de nomenclatura.** Clases en `PascalCase`; métodos y variables en
  `camelCase`; parámetro de "ID de usuario" unificado como `sus_usuarioId` en ambos endpoints de
  creación de suscripción (cambio de contrato **BREAKING** para `insertarSuscripcionConPago` si el
  frontend enviaba `iUsuario`: debe actualizarse a `sus_usuarioId`).
- **R10 — `anexos/` intocable.** Ninguna tarea de este RF crea, modifica ni elimina archivos dentro
  de `rest_suscripcion/anexos/`, ni invoca procedimientos almacenados de ese directorio.
- **R11 — `docs/` fuera de lectura y escritura**, salvo la creación de este propio documento.

---

## 7. Criterios de aceptación

```gherkin
Dado el servicio rest_suscripcion desplegado en Apache
Cuando ejecuto  GET http://localhost/rest_suscripcion/planes
 y  GET http://localhost/rest_suscripcion/suscripcion
Entonces ambos responden el mismo health-check (200, JSON) que antes del refactor

Dado el código refactorizado
Cuando ejecuto  GET http://localhost/rest_suscripcion/suscripcion/porUsuario?id=<id_valido>
Entonces recibo 200 con los datos de la suscripción (antes siempre respondía 500)
  Y el cuerpo NO contiene el texto "Error interno del servidor" concatenado con el id

Dado el código refactorizado
Cuando ejecuto  POST http://localhost/rest_suscripcion/suscripcion/crearConPago  con un body válido
Entonces la respuesta es JSON puro, sin texto plano antepuesto

Dado el código refactorizado
Cuando ejecuto  GET http://localhost/rest_suscripcion/pagos
Entonces recibo 200 con el health-check del nuevo dominio pagos (antes no existía esta ruta)

Dado una suscripción vencida consultada por su id
Cuando ejecuto  GET http://localhost/rest_suscripcion/suscripcion/porUsuario?id=<id_vencido>
Entonces la respuesta ya no incluye esa suscripción como vigente (cambio declarado en R5)

Dado un pago ya registrado con un idTransaccion específico
Cuando reintento  POST http://localhost/rest_suscripcion/pagos/insertar  con el mismo idTransaccion
Entonces recibo 409 y no se crea un segundo registro de pago

Dado el código refactorizado
Cuando reviso controladores/BaseCtrl.php
Entonces no existe el bloque de código comentado de las funciones de respuesta previas

Dado el código refactorizado
Cuando reviso SuscripcionCtrl::insertarSuscripcionSinPago e insertarSuscripcionConPago
Entonces ambos reciben el parámetro de usuario como sus_usuarioId

Dado el código refactorizado
Cuando reviso rest_suscripcion/anexos/
Entonces ninguno de sus 6 archivos fue creado, modificado ni eliminado
```

---

## 8. Plan de pruebas de regresión funcional (obligatorio antes de cerrar el RF)

Cada endpoint se prueba **antes y después** del refactor con el mismo comando, comparando la
salida:

| # | Comando `curl` | Resultado esperado (idéntico antes/después salvo cambios declarados) |
|---|----------------|------------------------------------------------------------------------|
| P1 | `curl -i http://localhost/rest_suscripcion/planes` | 200, health-check sin cambios |
| P2 | `curl -i http://localhost/rest_suscripcion/suscripcion` | 200, health-check sin cambios |
| P3 | `curl -i http://localhost/rest_suscripcion/planes/disponibles` | Mismo contrato de éxito que antes |
| P4 | `curl -i "http://localhost/rest_suscripcion/planes/suscritos/<id>"` | Mismo contrato de éxito que antes |
| P5 | `curl -i "http://localhost/rest_suscripcion/suscripcion/porUsuario?id=<id>"` | **Cambia:** 200/404 según corresponda (antes siempre 500, corrección declarada en R2) |
| P6 | `curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearSinPago -H "Content-Type: application/json" -d '{...}'` | Mismo contrato de éxito que antes, con campo `sus_usuarioId` (R9) |
| P7 | `curl -i -X POST http://localhost/rest_suscripcion/suscripcion/crearConPago -H "Content-Type: application/json" -d '{...con sus_usuarioId...}'` | **Cambia:** respuesta JSON pura sin texto de depuración antepuesto (R3); campo renombrado de `iUsuario` a `sus_usuarioId` (R9) |
| P8 | `curl -i http://localhost/rest_suscripcion/pagos` | **Nuevo:** 200, health-check (antes la ruta no existía) |
| P9 | `curl -i -X POST http://localhost/rest_suscripcion/pagos/insertar -H "Content-Type: application/json" -d '{...idTransaccion nuevo...}'` | **Nuevo:** 200/201 de éxito |
| P10 | Repetir P9 con el mismo `idTransaccion` | **Nuevo:** 409, sin duplicar el registro (R6) |

Cada fila se ejecuta contra el código **antes** del refactor (baseline, cuando aplique) y
**después**, adjuntando la comparación en el Execution Report del Task Brief. Toda diferencia no
listada como "cambia"/"nuevo" se considera regresión y bloquea el cierre del RF.

---

## 9. Tareas técnicas derivadas (alto nivel)

> Detalle línea-por-línea y anclas exactas corresponden al HLT / Task Brief del modo planificación
> (`docs/doc_modo_planificacion.md`). Aquí solo se enumeran las tareas del requerimiento.

- [ ] Consolidar la lógica común entre `PlanesRts`, `SuscripcionRts` y `PagosRts` (A1).
- [ ] Migrar las respuestas de los `*Rts.php` a `BaseCtrl` (A2).
- [ ] Sustituir la validación manual repetida de ID por `limpiarDatos()`/`validarDatos()` (A3).
- [ ] Extraer el mapeo de fila "plan"/"suscripción" a métodos comunes (A4).
- [ ] Eliminar la duplicación de SQL en `PlanesMdl` (A5).
- [ ] Corregir el bug de 500 siempre en `obtenerSuscripcionesPorUsuario` (A6).
- [ ] Eliminar el remanente de debug comentado en `PlanesCtrl.php` (A7).
- [ ] Eliminar el `echo` de depuración de `SuscripcionRts.php` (A8).
- [ ] Crear `rutas/PagosRts.php` y registrar `/pagos` en `index.php` (A9).
- [ ] Corregir el bug de precedencia SQL en `obtenerSuscripcionPorIDUsuario` (A10).
- [ ] Corregir la reasignación muerta en `insertarSuscripcionConPago` (A11).
- [ ] Añadir verificación de idempotencia en `insertarPagoSuscripcion` (A12).
- [ ] Eliminar el código comentado de `BaseCtrl.php` (A13).
- [ ] Unificar el parámetro `sus_usuarioId` en ambos endpoints de creación de suscripción (A14).
- [ ] Unificar alias SQL en minúsculas en `PlanesMdl.php` (A15).
- [ ] Corregir el comentario/docstring copiado en `SuscripcionCtrl.php` (A16).
- [ ] Ejecutar el plan de pruebas de regresión de §8 y adjuntar comparación antes/después.

---

## 10. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. `GET /suscripcion/porUsuario` ya no responde siempre 500; ejecuta su lógica real.
2. `POST /suscripcion/crearConPago` responde JSON puro, sin texto de depuración antepuesto.
3. `/pagos` está registrado y funcional.
4. La consulta de `obtenerSuscripcionPorIDUsuario` aplica el filtro de vigencia a ambas ramas de la condición.
5. `insertarSuscripcionConPago` usa el resultado real de la comprobación de existencia, sin descartarlo.
6. `insertarPagoSuscripcion` responde 409 ante un `idTransaccion` duplicado.
7. No existe duplicación de lógica entre `PlanesRts`/`SuscripcionRts`/`PagosRts`, ni entre los mapeos de fila de `PlanesCtrl`/`SuscripcionCtrl`.
8. No queda código comentado muerto en `BaseCtrl.php`.
9. El plan de pruebas de regresión de §8 se ejecutó completo, con las 10 comparaciones documentadas y sin regresiones no declaradas.
10. `rest_suscripcion/anexos/` permanece sin modificar.
11. Se respetan las restricciones R1–R11 y las convenciones del repo (`CLAUDE.md`).
