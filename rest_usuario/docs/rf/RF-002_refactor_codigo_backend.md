# RF-002 — Refactor del código backend de `rest_usuario`

> **Tipo:** Refactor / Deuda técnica (arquitectura, duplicación, manejo de errores, seguridad,
> corrección de defectos).
> **Servicio afectado:** `rest_usuario`.
> **Archivos objetivo:** `index.php`, `rutas/*.php`, `controladores/*.php`, `modelos/PersonaMdl.php`,
> `rutas.txt`.
> **Prioridad:** Alta (incluye corrección de un bug de fuga de error y mitigaciones de autorización).
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `rest_usuario/docs/rf/RF-001_refactor_htaccess.md` (refactor de `.htaccess`,
> alcance de infraestructura Apache, no de código PHP — este RF-002 no lo duplica).
>
> **Restricciones explícitas de esta auditoría y de este RF (instrucción del solicitante):**
> - No se leyó ni se modifica nada dentro de `rest_usuario/docs/` (salvo la creación de este
>   propio documento).
> - No se realiza ninguna acción dentro de `rest_usuario/anexos/` (contiene `sist_generico.sql`,
>   `sist_genericoDatos.sql`); permanece intocado.

---

## 1. Historia de usuario

> **Como** desarrollador backend del servicio `rest_usuario`,
> **quiero** que el código PHP elimine duplicación entre rutas, corrija los dominios registrados
> pero inertes, corrija el bug de manejo de errores en el alta de personas, y responda al
> frontend con un contrato de error HTTP homogéneo,
> **para** que el servicio de identidad sea confiable, mantenible, y no exponga información ni
> comportamientos inseguros por defectos de implementación heredados.

---

## 2. Contexto y problema actual (auditoría del código real)

`rest_usuario` es el servicio de personas, usuarios, roles y autenticación (contraseñas con
`password_hash`/BCRYPT). La auditoría del código real (`index.php`, `rutas/`, `controladores/`,
`modelos/`, `configuracion/`, y `rutas.txt`) — sin leer `docs/` ni tocar `anexos/` — encontró los
siguientes defectos verificados con archivo y línea:

| # | Defecto detectado | Evidencia en el código |
|---|-------------------|------------------------|
| D1 | **Duplicación entre los `*Rts.php` funcionales.** `PersonaRts.php` y `ValidacionRts.php` repiten casi línea por línea: parseo de acción, `switch` de método HTTP, health-check hardcodeado, y el bloque de lectura/validación de body (`file_get_contents` → `json_decode` → chequeo de error). | `PersonaRts.php:13-23,26-46,50-72,103-123,150-170`; `ValidacionRts.php:13-23,26-40,46-61,89-109,131-145`. |
| D2 | **Las rutas no usan `BaseCtrl`.** Cada `manejarX` en `*Rts.php` hace `http_response_code(...)` + `echo json_encode(...)` manual, en vez de `respuestaExitosaSimple`/`respuestaErrorSimple`. Convive con un formato de error distinto al de los controladores (que sí usan `BaseCtrl`). | `PersonaRts.php` (14 ocurrencias), `ValidacionRts.php` (equivalente); `controladores/BaseCtrl.php:5-77` sin usar desde las rutas. |
| D3 | **Dominios registrados pero inertes.** `index.php` registra `/usuario` → `rutas/UsuarioRts.php` y `/rol` → `rutas/RolRts.php`; **ambos archivos existen con 0 bytes**. Como `index.php` solo verifica `file_exists()` (no contenido), la petición se enruta a un archivo vacío y termina sin respuesta HTTP útil. | `index.php:29-34,40`; `rutas/UsuarioRts.php` (0 bytes); `rutas/RolRts.php` (0 bytes); `controladores/UsuarioCtrl.php` (0 bytes). |
| D4 | **`UsuarioMdl.php` completo pero huérfano.** Tiene lógica funcional (`listaUsuarios`, `obtenerUsuario`, `agregarUsuario`, `eliminarUsuario`, `existeUsuario`, `existeUsuarioPorNombre`) pero ningún archivo del proyecto lo instancia ni lo requiere. | `modelos/UsuarioMdl.php` (69 líneas, sin referencias entrantes). |
| D5 | **Dominio `Categoria` completo pero no registrado y ajeno al dominio de identidad.** `CategoriaRts.php`/`CategoriaCtrl.php`/`CategoriaMdl.php` (174+141+66 líneas, funcionales) no aparecen en el mapa `$rutas` de `index.php`, no están documentados en el `README.md`, y su tabla (`categoria`) no usa el prefijo de esquema del resto del servicio. Es código huérfano, aparente remanente de otro proyecto/plantilla. | `rutas/CategoriaRts.php`; sin referencias en `index.php`; `modelos/CategoriaMdl.php` (columnas sin prefijo). |
| D6 | **Bug de manejo de errores en `PersonaMdl::agregarPersona`.** Si el `INSERT` falla, el modelo captura la excepción y **retorna un string** con el mensaje crudo (`"Error al generar el registro: " . $e->getMessage()`). El controlador (`PersonaCtrl::agregarPersona`) solo comprueba `is_array($resultado) && isset($resultado['Error'])`, condición que **nunca se cumple** con un string — el flujo cae a `respuestaExitosaSimple(['idUsuario' => $resultado])`, devolviendo **código 200** con el mensaje de la excepción embebido en `idUsuario`. | `modelos/PersonaMdl.php:102`; `controladores/PersonaCtrl.php:143-147`. |
| D7 | **Código de recuperación devuelto directamente en la respuesta HTTP.** `generarCodigoRecuperacion` genera el código y lo incluye en el cuerpo JSON de la respuesta inmediata al solicitante, anulando su propósito como prueba de posesión de otro canal (correo/SMS). `obtenerCodigoRecuperacion` tiene el mismo problema dado solo un `usuario`. | `ValidacionCtrl.php:99-101,108-130`. |
| D8 | **`actualizarClave` sin verificación de la clave actual.** Permite cambiar la contraseña de cualquier usuario dado solo su `id`/`usuario`, sin exigir ni verificar la clave vigente. | `ValidacionCtrl.php:132-164`. |
| D9 | **`obtenerPersonaPorCorreo` expone PII completo sin control de acceso.** Dado cualquier correo, devuelve cédula, nombres, apellidos, dirección, teléfono, fecha de registro y situación, sin verificar identidad del solicitante. No existe hoy ningún mecanismo de JWT/token en el proyecto (confirmado, cero coincidencias de `jwt`/`bearer`/`token` en el código). | `controladores/PersonaCtrl.php:155-200` (`obtenerPersonaPorCorreo`); ausencia confirmada de middleware de auth en todo el árbol. |
| D10 | **HTML de marketing embebido en `index.php`.** ~380 líneas de una "página de anuncio" de la empresa (función `mostrarPaginaAnuncio()`), ajenas al enrutamiento de un microservicio REST, referenciando endpoints inexistentes (`/empresa`, `/categoria`, `/producto`). | `index.php:64-444`. |
| D11 | **`rutas.txt` desactualizado y no cargado por ningún código.** Documentación paralela en texto plano que solo cubre `/autenticacion`, no menciona `/persona` con el detalle actual ni `/usuario`/`/rol`; ningún `require`/`include` lo referencia. | `rutas.txt` (raíz del servicio, 103 líneas). |
| D12 | **Código muerto comentado en `BaseCtrl`.** Bloque completo de una versión anterior de las funciones de respuesta (`respuestaJson`, `respuestaExitosa`, `respuestaError`), reemplazado por las versiones "Simple" mas dejado como comentario. | `controladores/BaseCtrl.php:30-57`. |
| D13 | **Placeholder con referencia a un método inexistente.** El comentario de `PersonaRts.php` referencia `$controller->obtenerPersonaPorUsuario($id)`, método que **no existe** en `PersonaCtrl` (el real es `obtenerPersonaPorCorreo`). | `PersonaRts.php:83-91`. |
| D14 | **Validación de ID duplicada 4 veces de forma idéntica.** El patrón `filter_var($id, FILTER_VALIDATE_INT) || $id <= 0` se repite textualmente en 4 puntos distintos. | `ValidacionCtrl.php:47`; `CategoriaCtrl.php:34,76,107`. |
| D15 | **Inconsistencia en el algoritmo de hash declarado.** `PersonaMdl::agregarPersona` usa `PASSWORD_DEFAULT` mientras que `UsuarioMdl::agregarUsuario` y `ValidacionMdl::actualizarClaveUsuario` usan `PASSWORD_BCRYPT` explícito — hoy equivalentes, pero inconsistente como convención. | `PersonaMdl.php:62`; `UsuarioMdl.php:43`; `ValidacionMdl.php:58`. |

> **Nota — no confundir con RF-001.** El `.htaccess` de este servicio ya tiene su propio RF y HLT.
> Este RF-002 cubre exclusivamente el código PHP del servicio, no la configuración de Apache.

---

## 3. Objetivo del refactor

Eliminar la duplicación entre rutas, dejar `/usuario` funcional reutilizando el modelo ya
existente, retirar `/rol` del enrutamiento por estar inerte, corregir el bug de manejo de errores
de `agregarPersona`, aplicar mitigaciones puntuales de autorización que no requieren JWT completo,
y homogeneizar el contrato de error HTTP que recibe el frontend — **manteniendo el contrato de
datos de éxito ya vigente** para `/persona` y `/autenticacion`, salvo los cambios de contrato
declarados explícitamente en §6 (R5, R6).

---

## 4. Alcance (in-scope)

- **A1.** Consolidar la lógica común de rutas (parseo de acción, despacho por método HTTP, lectura
  y validación de body) en un mecanismo compartido entre `PersonaRts.php`, `ValidacionRts.php` y el
  `UsuarioRts.php` nuevo (A3), eliminando la duplicación (D1).
- **A2.** Migrar todas las respuestas de los `*Rts.php` a `BaseCtrl`
  (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`), reemplazando
  `echo json_encode(...)` manual, con `JSON_UNESCAPED_UNICODE` (D2).
- **A3.** Completar el dominio `Usuario`: crear `rutas/UsuarioRts.php` y
  `controladores/UsuarioCtrl.php` siguiendo el patrón de `PersonaRts`/`PersonaCtrl`, reutilizando
  íntegramente la lógica ya existente en `modelos/UsuarioMdl.php` (D3, D4).
- **A4.** Desregistrar `/rol` del mapa `$rutas` de `index.php` y **eliminar** el archivo vacío
  `rutas/RolRts.php` (no existe `Ctrl`/`Mdl` asociado que reutilizar) (D3).
- **A5.** Corregir `PersonaMdl::agregarPersona` para que, ante una excepción, retorne un valor que
  `PersonaCtrl` distinga inequívocamente como error (p. ej. un array con clave `'error'`), y que el
  controlador responda **500** genérico vía `respuestaErrorSimple`, sin exponer el mensaje crudo de
  la excepción (registrado solo con `error_log()`) (D6).
- **A6.** Modificar `generarCodigoRecuperacion` para que la respuesta de éxito **no** incluya el
  código de recuperación en el cuerpo JSON (D7, ver limitación declarada en R5).
- **A7.** Modificar `actualizarClave` para exigir un campo `claveActual` y verificarlo con
  `password_verify` contra la clave vigente antes de permitir el cambio; responder **401** si no
  coincide (D8).
- **A8.** Eliminar la función `mostrarPaginaAnuncio()` y su HTML embebido de `index.php`, dejando
  el front controller únicamente con lógica de enrutamiento (D10).
- **A9.** Eliminar `rutas.txt` (D11).
- **A10.** Eliminar el bloque de código comentado (funciones de respuesta previas) en
  `BaseCtrl.php` (D12).
- **A11.** Limpiar el comentario de `PersonaRts.php` que referencia el método inexistente
  `obtenerPersonaPorUsuario`, manteniendo el comportamiento actual (`DELETE /persona` sigue
  respondiendo **501**, sin cambio de código HTTP) (D13).
- **A12.** Extraer la validación repetida de ID (`filter_var(FILTER_VALIDATE_INT)` + `<= 0`) a un
  método común reutilizado por los controladores que la necesitan (D14).
- **A13.** Unificar el uso de `PASSWORD_BCRYPT` explícito en los tres lugares que generan hash de
  contraseña (D15).

---

## 5. Fuera de alcance (out-of-scope)

- **No** implementar JWT ni ningún middleware de autenticación global — es el objetivo declarado en
  `CLAUDE.md` pero es **cross-servicio** y corresponde a un RF separado.
- **No** restringir el acceso de `obtenerPersonaPorCorreo` (D9); queda documentado como riesgo
  pendiente hasta que exista JWT.
- **No** resolver el canal de entrega del código de recuperación (correo/SMS); tras A6 el código
  se genera y persiste, pero su entrega al usuario legítimo **no queda resuelta por este RF**
  (limitación declarada explícitamente en R5).
- **No** tocar `CategoriaRts.php`/`CategoriaCtrl.php`/`CategoriaMdl.php` (D5): no se registran, no
  se eliminan, no se modifican; quedan documentados como código huérfano para que el negocio decida
  en un RF aparte si pertenecen a este servicio o se eliminan.
- **No** completar `/rol` con lógica nueva (no hay `Ctrl`/`Mdl` que reutilizar; implementarlo desde
  cero es funcionalidad nueva, no refactor).
- **No** externalizar credenciales de BD a variables de entorno (ya documentado como pendiente en
  `README.md` y `CLAUDE.md`; es otro RF).
- **No** migrar a Composer/PSR-4 ni introducir un framework.
- **No** tocar `.htaccess` (cubierto por RF-001).
- **No** leer ni modificar nada dentro de `rest_usuario/docs/`.
- **No** realizar ninguna acción dentro de `rest_usuario/anexos/`.

---

## 6. Reglas de negocio y restricciones

- **R1 — Funcionalidad preservada por defecto.** Los endpoints `/persona` y `/autenticacion`
  conservan su contrato de datos de éxito y sus códigos HTTP vigentes, salvo los cambios
  explícitamente declarados en R5, R6 y R7.
- **R2 — `/usuario` pasa de inerte a funcional (ADITIVO).** Hoy no responde nada útil (archivo
  vacío); tras el refactor responde según el contrato de `UsuarioMdl` ya existente. No rompe
  ningún cliente porque hoy no hay comportamiento observable que preservar.
- **R3 — `/rol` se retira del enrutamiento (BREAKING declarado).** Hoy responde vacío/inútil; tras
  el cambio, `index.php` responderá **404** "Endpoint no encontrado" para `/rol` (comportamiento
  estándar de ruta no registrada). Se declara explícitamente porque cualquier cliente que dependa
  de la existencia de la ruta (aunque no funcione) verá un código HTTP distinto.
- **R4 — Arquitectura y respuestas.** Toda ruta usa `BaseCtrl` para responder; toda lógica de
  negocio permanece en los `Ctrl`; los `Mdl` siguen usando `Enlace` parametrizado
  (`bind_param`), sin concatenación de valores en SQL.
- **R5 — Cambio de contrato en `generarCodigoRecuperacion` (BREAKING declarado).** La respuesta de
  éxito ya no incluye `codigo_recuperacion` en el cuerpo. **Limitación conocida:** este RF no
  resuelve cómo el usuario legítimo recibe el código tras este cambio (requiere un canal de
  entrega, p. ej. correo, fuera de alcance); se declara como deuda pendiente explícita, no oculta.
- **R6 — Cambio de contrato en `actualizarClave` (BREAKING declarado).** Requiere nuevo campo
  obligatorio `claveActual` en el body; si no coincide con la clave vigente (`password_verify`),
  responde **401**. El frontend debe actualizarse para enviar este campo.
- **R7 — Corrección de `agregarPersona`.** Ante fallo de inserción, responde **500** genérico vía
  `BaseCtrl`; nunca **200** con el mensaje de la excepción embebido en el resultado.
- **R8 — Convenciones de nomenclatura.** Clases en `PascalCase`; métodos y variables en
  `camelCase`; sufijos fijos `*Rts`, `*Ctrl`, `*Mdl`; dominio y comentarios en español.
- **R9 — Hash de contraseña consistente.** `PASSWORD_BCRYPT` explícito en los tres puntos que
  generan hash.
- **R10 — `anexos/` intocable.** Ninguna tarea de este RF crea, modifica ni elimina archivos
  dentro de `rest_usuario/anexos/`.
- **R11 — `docs/` fuera de lectura y escritura**, salvo la creación de este propio documento.

---

## 7. Criterios de aceptación

```gherkin
Dado el servicio rest_usuario desplegado en Apache
Cuando ejecuto  GET http://localhost/rest_usuario/persona
 y  GET http://localhost/rest_usuario/autenticacion
Entonces ambos responden el mismo health-check (200, JSON) que antes del refactor

Dado el código refactorizado
Cuando ejecuto  GET http://localhost/rest_usuario/usuario
Entonces recibo 200 con el health-check del dominio usuario (antes no respondía nada útil)

Dado el código refactorizado
Cuando ejecuto  GET http://localhost/rest_usuario/rol
Entonces recibo 404 "Endpoint no encontrado" (antes no respondía nada útil por archivo vacío)

Dado un intento de agregarPersona que provoca un fallo de inserción en BD
Cuando ejecuto  POST http://localhost/rest_usuario/persona/agregar  con datos que violan una restricción de la tabla
Entonces recibo código HTTP 500 con mensaje genérico
  Y el cuerpo de la respuesta NO contiene el texto de una excepción PHP
  Y el detalle real queda registrado en logs/php_errors.log

Dado el endpoint de recuperación de clave
Cuando ejecuto  POST http://localhost/rest_usuario/autenticacion/generarCodigo  con un id válido
Entonces recibo 200 sin el campo codigo_recuperacion en el cuerpo de la respuesta

Dado el endpoint de actualización de clave
Cuando ejecuto  PUT http://localhost/rest_usuario/autenticacion/actualizarClave  sin el campo claveActual
Entonces recibo 400 (campo requerido faltante)
Cuando lo ejecuto con claveActual incorrecta
Entonces recibo 401
Cuando lo ejecuto con claveActual correcta y claveNueva válida
Entonces recibo 200 y la clave queda actualizada

Dado el código refactorizado
Cuando reviso index.php
Entonces no existe la función mostrarPaginaAnuncio ni su HTML embebido
  Y el archivo rutas.txt no existe

Dado el código refactorizado
Cuando reviso controladores/BaseCtrl.php
Entonces no existe el bloque de código comentado de las funciones de respuesta previas

Dado el código refactorizado
Cuando reviso rutas/CategoriaRts.php, controladores/CategoriaCtrl.php, modelos/CategoriaMdl.php
Entonces los tres archivos existen sin modificar (out-of-scope, D5)

Dado el código refactorizado
Cuando reviso rest_usuario/anexos/
Entonces sist_generico.sql y sist_genericoDatos.sql no fueron creados, modificados ni eliminados
```

---

## 8. Plan de pruebas de regresión funcional (obligatorio antes de cerrar el RF)

Para verificar que no existe alteración no declarada en el comportamiento existente, cada
endpoint preservado se prueba **antes y después** del refactor con el mismo comando y se compara
la salida:

| # | Comando `curl` | Resultado esperado (idéntico antes/después salvo cambios declarados) |
|---|----------------|------------------------------------------------------------------------|
| P1 | `curl -i http://localhost/rest_usuario/persona` | 200, JSON de health-check sin cambios |
| P2 | `curl -i http://localhost/rest_usuario/autenticacion` | 200, JSON de health-check sin cambios |
| P3 | `curl -i -X POST http://localhost/rest_usuario/autenticacion/autenticar -H "Content-Type: application/json" -d '{"usuario":"<u>","clave":"<c>"}'` | Mismo contrato de éxito (id, nombres, apellidos) y mismo 401 ante credenciales inválidas |
| P4 | `curl -i http://localhost/rest_usuario/autenticacion/roles?id=<id>` | Mismo contrato de éxito/404 que antes |
| P5 | `curl -i -X POST http://localhost/rest_usuario/persona/agregar -H "Content-Type: application/json" -d '{...datos válidos...}'` | 200 con `idUsuario` numérico real (caso de éxito sin cambios) |
| P6 | `curl -i -X PUT http://localhost/rest_usuario/persona/actualizar -H "Content-Type: application/json" -d '{...}'` | Mismo contrato que antes |
| P7 | `curl -i -X DELETE http://localhost/rest_usuario/persona` | 501 sin cambio (placeholder preservado, A11) |
| P8 | `curl -i http://localhost/rest_usuario/usuario` | **Nuevo:** 200 (antes vacío) |
| P9 | `curl -i http://localhost/rest_usuario/rol` | **Cambia:** 404 (antes vacío) — cambio declarado en R3 |
| P10 | `curl -i -X POST http://localhost/rest_usuario/autenticacion/generarCodigo -H "Content-Type: application/json" -d '{"id":<id>}'` | **Cambia:** 200 sin `codigo_recuperacion` en el cuerpo — cambio declarado en R5 |
| P11 | `curl -i -X PUT http://localhost/rest_usuario/autenticacion/actualizarClave -H "Content-Type: application/json" -d '{"id":<id>,"claveNueva":"<n>"}'` (sin `claveActual`) | **Cambia:** 400 — cambio declarado en R6 |

Cada fila P1–P11 se ejecuta contra el código **antes** del refactor (baseline) y **después**, y se
adjunta la comparación de las dos salidas en el Execution Report del Task Brief correspondiente.
Toda diferencia no listada en la tabla como "cambia" se considera una regresión y bloquea el cierre
del RF.

---

## 9. Tareas técnicas derivadas (alto nivel)

> Detalle línea-por-línea y anclas exactas corresponden al HLT / Task Brief del modo planificación
> (`docs/doc_modo_planificacion.md`). Aquí solo se enumeran las tareas del requerimiento.

- [ ] Consolidar la lógica común de rutas entre `PersonaRts`, `ValidacionRts` y `UsuarioRts` (A1).
- [ ] Migrar las respuestas de los `*Rts.php` a `BaseCtrl` (A2).
- [ ] Crear `rutas/UsuarioRts.php` y `controladores/UsuarioCtrl.php` reutilizando `UsuarioMdl.php` (A3).
- [ ] Desregistrar `/rol` de `index.php` y eliminar `rutas/RolRts.php` (A4).
- [ ] Corregir `PersonaMdl::agregarPersona` y `PersonaCtrl::agregarPersona` para responder 500 genérico ante fallo (A5).
- [ ] Quitar `codigo_recuperacion` de la respuesta de `generarCodigoRecuperacion` (A6).
- [ ] Exigir y verificar `claveActual` en `actualizarClave`, responder 401 si no coincide (A7).
- [ ] Eliminar `mostrarPaginaAnuncio()` y su HTML de `index.php` (A8).
- [ ] Eliminar `rutas.txt` (A9).
- [ ] Eliminar el bloque comentado de funciones previas en `BaseCtrl.php` (A10).
- [ ] Limpiar el comentario con referencia a método inexistente en `PersonaRts.php` (A11).
- [ ] Extraer la validación repetida de ID a un método común (A12).
- [ ] Unificar `PASSWORD_BCRYPT` explícito en los tres puntos de hash (A13).
- [ ] Ejecutar el plan de pruebas de regresión de §8 y adjuntar comparación antes/después.

---

## 10. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. No existe duplicación de lógica entre los `*Rts.php` restantes.
2. Toda respuesta (éxito y error) de rutas y controladores pasa por `BaseCtrl`.
3. `/usuario` responde funcionalmente; `/rol` fue retirado del enrutamiento y su archivo eliminado.
4. El bug de `agregarPersona` está corregido: ningún fallo de inserción responde 200.
5. `generarCodigoRecuperacion` no expone el código en la respuesta HTTP.
6. `actualizarClave` exige y valida `claveActual`.
7. `index.php` no contiene HTML de marketing; `rutas.txt` fue eliminado; `BaseCtrl.php` no tiene código comentado muerto.
8. `rutas/CategoriaRts.php`, `controladores/CategoriaCtrl.php`, `modelos/CategoriaMdl.php` permanecen sin modificar.
9. `rest_usuario/anexos/` permanece sin modificar.
10. El plan de pruebas de regresión de §8 se ejecutó completo, con las 11 comparaciones documentadas y sin regresiones no declaradas.
11. Se respetan las restricciones R1–R11 y las convenciones del repo (`CLAUDE.md`).
