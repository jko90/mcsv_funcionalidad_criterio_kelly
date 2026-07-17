# RF-002 — Refactor del código backend de `rest_divisas`

> **Tipo:** Refactor / Deuda técnica (arquitectura, duplicación, manejo de errores, seguridad).
> **Servicio afectado:** `rest_divisas`.
> **Archivos objetivo:** `index.php`, `rutas/*.php`, `controladores/*.php`, `configuracion/*.php`
> (creación de capa `modelos/*Mdl.php`).
> **Prioridad:** Alta (incluye corrección de vulnerabilidad de secreto hardcodeado).
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `rest_divisas/docs/rf/RF-001_refactor_htaccess.md` (refactor de `.htaccess`,
> alcance de infraestructura Apache, no de código PHP — este RF-002 no lo duplica).

---

## 1. Historia de usuario

> **Como** desarrollador backend del servicio `rest_divisas`,
> **quiero** que el código PHP siga la arquitectura por capas del proyecto
> (`Rts → Ctrl → Mdl`), sin duplicación entre los tres dominios (cripto/forex/índice), sin
> secretos hardcodeados y con un manejo de errores homogéneo y seguro,
> **para** que el servicio sea mantenible, consistente con el resto del backend, y el frontend
> reciba errores claros y accionables sin exponer detalles internos de implementación.

---

## 2. Contexto y problema actual (auditoría del código real)

`rest_divisas` es el único servicio sin base de datos: consulta APIs externas (Binance,
Frankfurter, Financial Modeling Prep) vía HTTP. La auditoría del código real
(`index.php`, `rutas/`, `controladores/`, `configuracion/`) encontró los siguientes defectos
verificados con archivo y línea:

| # | Defecto detectado | Evidencia en el código |
|---|-------------------|------------------------|
| D1 | **Falta la capa `Mdl`.** `modelos/` está vacío (0 archivos); el flujo real hoy es `Rts → Ctrl → API externa` directo, sin repositorio que encapsule el acceso a datos externos, contradiciendo el patrón `Rts → Ctrl → Mdl` del resto del backend. | `modelos/` (directorio vacío). |
| D2 | **Duplicación casi total entre los tres `*Rts.php`.** `CriptoRts.php`, `ForexRts.php`, `IndiceRts.php` repiten línea a línea: parseo de URI, `switch` de método HTTP, función `manejarGet()`, bloque de health-check y bloque `try/catch`. | `CriptoRts.php:9-80`, `ForexRts.php:9-79`, `IndiceRts.php:9-80`. |
| D3 | **Health-check con nombre de servicio incorrecto.** Los tres `*Rts.php` responden `'service' => 'PlanesRTS'` en su health-check, nombre heredado de otro microservicio, no de `rest_divisas`. | `CriptoRts.php:49`, `ForexRts.php:48`, `IndiceRts.php:49`. |
| D4 | **Sin cliente HTTP centralizado.** `CriptoCtrl` usa cURL nativo con timeout explícito (30s); `ForexCtrl` e `IndiceCtrl` usan `@file_get_contents()` sin timeout configurado ni verificación de código HTTP homogénea. | `CriptoCtrl.php:14-24`, `ForexCtrl.php:39,84`, `IndiceCtrl.php:20`. |
| D5 | **Métodos de `BaseCtrl` definidos pero sin uso.** `respuestaExitosaSimple`, `respuestaErrorSimple`, `respuestaJsonSimple`, `validarDatos`, `limpiarDatos` existen en `BaseCtrl` pero ningún `Ctrl` los invoca; la respuesta real se arma con `echo json_encode(...)` duplicado en cada `Rts`. | `controladores/BaseCtrl.php:5-50`; `CriptoRts.php:47-77`, `ForexRts.php:46-76`, `IndiceRts.php:47-78`. |
| D6 | **Exposición de detalle interno de excepción al cliente.** El `catch` de cada `Rts` responde `'detalle' => $e->getMessage()` en el JSON de error 500, sin genericar el mensaje. | `CriptoRts.php:67`, `ForexRts.php:66`, `IndiceRts.php:67`. |
| D7 | **API key hardcodeada en texto plano.** La clave de Financial Modeling Prep está en el código fuente y repetida en comentarios de otros archivos. El propio `README.md` (líneas 299-300) ya reconoce este pendiente. | `IndiceCtrl.php:13` (valor real); comentarios en `ForexCtrl.php:7`, `CriptoCtrl.php:7`. |
| D8 | **Verificación TLS deshabilitada.** La llamada cURL a Binance deshabilita explícitamente la validación del certificado SSL. | `CriptoCtrl.php:19` (`CURLOPT_SSL_VERIFYPEER => false`). |
| D9 | **Código muerto de acceso a BD.** `configuracion/enlace.php` (mysqli, prepared statements) y `configuracion/global.php` (constantes `DB_*`) no son referenciados por ningún `Ctrl`/`Rts`/`index.php`; el servicio no usa base de datos. | `configuracion/enlace.php` (sin referencias entrantes); `configuracion/global.php:3,10,13`. |
| D10 | **Inconsistencia de nomenclatura.** Las propiedades `$base_url` y `$api_key` están en `snake_case`, contradiciendo la convención `camelCase` del proyecto (y del propio `README.md:267`). | `CriptoCtrl.php:8`, `ForexCtrl.php:8`, `IndiceCtrl.php:7-8`. |
| D11 | **Comentarios muertos / placeholder sin limpiar.** Comentario `"Fix: pass the correct controller instance"` duplicado igual en los tres `Rts`; comentarios de URLs alternativas no implementadas dejados como nota. | `CriptoRts.php:25`, `ForexRts.php:24`, `IndiceRts.php:25`; `CriptoCtrl.php:7`, `ForexCtrl.php:7`, `IndiceCtrl.php:9`. |
| D12 | **Llamada a constructor superflua e inconsistente.** `IndiceCtrl` llama `parent::__construct()` aunque `BaseCtrl` no define constructor propio; `CriptoCtrl`/`ForexCtrl` no hacen esa llamada. | `IndiceCtrl.php:12`. |

> **Nota — no confundir con RF-001.** El `.htaccess` de este servicio ya tiene su propio RF y HLT
> (`RF-001_refactor_htaccess.md`, `docs/hlt/HLT-RF-001_refactor_htaccess.md`). Este RF-002 cubre
> exclusivamente el código PHP (`index.php`, `rutas/`, `controladores/`, `configuracion/`,
> `modelos/`), no la configuración de Apache.

---

## 3. Objetivo del refactor

Reestructurar el código de `rest_divisas` aplicando la arquitectura por capas `Rts → Ctrl → Mdl`
del resto del backend, eliminar la duplicación entre los tres dominios, retirar el secreto
hardcodeado y el código muerto, y homogeneizar el manejo de errores para que el frontend reciba
un contrato de error consistente y sin detalles internos — **manteniendo el contrato de datos de
éxito ya documentado en el `README.md`** (`symbol`, `name`, `price`, `type`) para los endpoints
existentes.

---

## 4. Alcance (in-scope)

- **A1. Introducir capa `Mdl`.** Crear `modelos/CriptoMdl.php`, `modelos/ForexMdl.php`,
  `modelos/IndiceMdl.php`, cada uno encapsulando la llamada a su API externa respectiva y
  devolviendo los datos ya decodificados; los `Ctrl` dejan de llamar `curl_*`/`file_get_contents`
  directamente y delegan en su `Mdl` (D1).
- **A2. Cliente HTTP común.** Los tres `Mdl` reutilizan un mismo mecanismo de petición HTTP
  (misma función/clase, un solo lugar de configuración) con **verificación SSL activa** y
  **timeout explícito** en todos los casos, sustituyendo `CURLOPT_SSL_VERIFYPEER => false` y los
  `file_get_contents` sin timeout (D4, D8).
- **A3. Eliminar duplicación entre `*Rts.php`.** Extraer el parseo de acción y el despacho por
  método HTTP a una forma común (sin reescribir tres veces la misma lógica), corrigiendo el
  health-check para que reporte el nombre real del dominio (`CuentasRTS`→ *no aplica*; aquí
  `CriptoRTS`/`ForexRTS`/`IndiceRTS`, no `PlanesRTS`) (D2, D3).
- **A4. Migrar toda respuesta a `BaseCtrl`.** Sustituir los `echo json_encode(...)` directos por
  `respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`, con `JSON_UNESCAPED_UNICODE`
  (D5).
- **A5. Manejo de errores homogéneo y seguro para el frontend.** Ningún mensaje de excepción
  interno (`$e->getMessage()`) llega al cliente; el detalle real se registra con `error_log()` y
  el cliente recibe mensaje genérico + código HTTP explícito según el caso (§6, R5) (D6).
- **A6. Centralizar la API key.** Mover la clave de Financial Modeling Prep a una constante en un
  `configuracion/global.php` **nuevo y propio de este servicio** (p. ej. `FMP_API_KEY`); ningún
  `Ctrl`/`Mdl` la hardcodea ni la repite en comentarios (D7).
- **A7. Eliminar código muerto de BD.** Borrar `configuracion/enlace.php` y el `configuracion/global.php`
  actual (patrón mysqli); el `global.php` nuevo de A6 contiene únicamente las constantes que este
  servicio realmente usa (API key, URLs base de las APIs externas) (D9).
- **A8. Normalizar nomenclatura.** Renombrar `$base_url`/`$api_key` a `$baseUrl`/`$apiKey` en los
  tres controladores y en los `Mdl` nuevos (D10).
- **A9. Limpiar comentarios muertos.** Eliminar el comentario duplicado `"Fix: pass the correct
  controller instance"` y los comentarios de URLs alternativas no implementadas (D11).
- **A10. Eliminar la llamada superflua a `parent::__construct()`** en `IndiceCtrl`, dejando los
  tres controladores consistentes entre sí (D12).

---

## 5. Fuera de alcance (out-of-scope)

- **No** corregir el mapeo de `/sinteticos` y `/otros` a `rutas/MarketsRts.php` (archivo
  inexistente); es un defecto ya detectado, pero implementar esa ruta es una **funcionalidad
  nueva**, no un refactor. Se documenta como hallazgo, no como tarea de este RF.
- **No** migrar a Composer, autoloading PSR-4, ni introducir un framework.
- **No** implementar caché, rate limiting, autenticación, OpenAPI ni PHPUnit (roadmap ya listado
  en `README.md`, corresponde a RFs separados).
- **No** externalizar la API key a variable de entorno / `.env` (decisión cerrada: se centraliza
  como constante en `configuracion/global.php` de este servicio, no en variables de entorno).
- **No** tocar el `.htaccess` (cubierto por RF-001).
- **No** añadir nuevos endpoints ni cambiar el contrato de datos de éxito ya documentado.

---

## 6. Reglas de negocio y restricciones

- **R1 — Funcionalidad observable preservada.** Los endpoints existentes (`/cripto`,
  `/cripto/disponible`, `/forex`, `/forex/disponible`, `/indice`, `/indice/disponible`) devuelven,
  en el caso de éxito, el mismo contrato de datos (`symbol`, `name`, `price`, `type`) y código
  `200` que hoy.
- **R2 — Arquitectura en capas.** Todo dominio (`cripto`, `forex`, `indice`) sigue
  `Rts → Ctrl → Mdl`; el `Mdl` es el único punto de acceso a la API externa correspondiente.
- **R3 — Cliente HTTP común con TLS y timeout.** Todo `Mdl` usa el mismo mecanismo de petición
  HTTP, con verificación SSL activa (`CURLOPT_SSL_VERIFYPEER => true` o equivalente) y timeout
  explícito (mismo valor para los tres dominios).
- **R4 — Respuestas solo vía `BaseCtrl`.** Prohibido `echo`/`json_encode` directo en `Rts`/`Ctrl`;
  toda salida usa `respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple` con
  `JSON_UNESCAPED_UNICODE`.
- **R5 — Códigos HTTP diferenciados para el frontend.** Ante fallo de la API externa (timeout,
  código HTTP no-200, JSON inválido del proveedor), el endpoint responde **502** (Bad Gateway) con
  mensaje genérico (p. ej. `"El proveedor de datos no está disponible"`); ante un error interno no
  relacionado con el proveedor externo, responde **500** con mensaje genérico
  (`"Error interno del servidor"`); acción inexistente → **404**; método HTTP no soportado →
  **405**. El detalle real (excepción, código HTTP del proveedor, cuerpo de respuesta) se registra
  con `error_log()`, nunca en el JSON de respuesta.
  > **Compatibilidad:** esta regla introduce el código **502** donde hoy siempre se devuelve 500
  > genérico para cualquier fallo. Es un cambio **NO-BREAKING** para el caso de éxito (200 sin
  > cambios) y es la mejora de manejo de errores explícitamente solicitada para el frontend; el
  > frontend que ya trata cualquier código ≥400 como error no requiere cambios para seguir
  > funcionando, y puede opcionalmente distinguir 502 de 500 si lo desea.
- **R6 — Sin secretos en código ni comentarios.** Ninguna clave de API aparece hardcodeada en
  `Ctrl`/`Mdl`/`Rts` ni en comentarios; vive como constante en `configuracion/global.php` de este
  servicio.
- **R7 — Convenciones de nomenclatura.** Clases en `PascalCase`; métodos y variables en
  `camelCase` (incluye `$baseUrl`, `$apiKey`); sufijos fijos `*Rts`, `*Ctrl`, `*Mdl`; dominio y
  comentarios en español.
- **R8 — Sin código muerto.** No quedan archivos, métodos, comentarios placeholder ni referencias
  a BD sin uso tras el refactor.
- **R9 — Prefijo y rutas públicas sin cambios.** Las URIs públicas (`/rest_divisas/cripto`, etc.)
  no cambian.

---

## 7. Criterios de aceptación

```gherkin
Dado el servicio rest_divisas desplegado en Apache
Cuando ejecuto  GET http://localhost/rest_divisas/cripto
Entonces recibo 200 con un arreglo de objetos {symbol, name, price, type}, igual que antes del refactor

Dado el servicio rest_divisas desplegado
Cuando ejecuto  GET http://localhost/rest_divisas/forex/disponible
 y  GET http://localhost/rest_divisas/indice/disponible
Entonces ambos responden 200 con el mismo contrato de datos que antes del refactor

Dado el código refactorizado
Cuando reviso modelos/
Entonces existen CriptoMdl.php, ForexMdl.php, IndiceMdl.php
  Y ningún controlador contiene llamadas directas a curl_init o file_get_contents

Dado el código refactorizado
Cuando reviso los tres *Ctrl.php y *Mdl.php
Entonces no existe ninguna cadena literal de API key
  Y configuracion/global.php contiene la constante de la API key
  Y configuracion/enlace.php no existe

Dado que la API externa de un dominio (p. ej. Binance) no responde o responde con error
Cuando ejecuto  GET http://localhost/rest_divisas/cripto
Entonces recibo código HTTP 502 con un mensaje genérico en el JSON
  Y el mensaje no contiene el texto de una excepción PHP ni una traza
  Y el detalle real queda registrado en logs/php_errors.log

Dado que solicito una acción inexistente del dominio
Cuando ejecuto  GET http://localhost/rest_divisas/cripto/accionInexistente
Entonces recibo código HTTP 404 con mensaje genérico vía BaseCtrl

Dado que uso un método HTTP no soportado
Cuando ejecuto  PATCH http://localhost/rest_divisas/cripto
Entonces recibo código HTTP 405 con mensaje genérico vía BaseCtrl

Dado el código refactorizado
Cuando reviso los tres *Rts.php
Entonces el health-check de cada uno reporta el nombre de servicio correcto de su propio dominio, no "PlanesRTS"
  Y no existe el comentario duplicado "Fix: pass the correct controller instance"

Dado el código refactorizado
Cuando reviso los tres *Ctrl.php
Entonces las propiedades usan $baseUrl y $apiKey en camelCase, no snake_case
  Y las llamadas HTTP usan verificación SSL activa y timeout explícito
```

---

## 8. Tareas técnicas derivadas (alto nivel)

> Detalle línea-por-línea y anclas exactas corresponden al HLT / Task Brief del modo planificación
> (`docs/doc_modo_planificacion.md`). Aquí solo se enumeran las tareas del requerimiento.

- [ ] Crear `modelos/CriptoMdl.php`, `modelos/ForexMdl.php`, `modelos/IndiceMdl.php` (A1).
- [ ] Implementar cliente HTTP común reutilizado por los tres `Mdl`, con SSL activo y timeout explícito (A2).
- [ ] Refactorizar `rutas/CriptoRts.php`, `ForexRts.php`, `IndiceRts.php` eliminando la duplicación y corrigiendo el health-check (A3).
- [ ] Migrar las respuestas de los tres `Rts`/`Ctrl` a `BaseCtrl` (A4).
- [ ] Implementar manejo de errores homogéneo con códigos 502/500/404/405 y `error_log()` del detalle (A5).
- [ ] Mover la API key a una constante en `configuracion/global.php` nuevo (A6).
- [ ] Eliminar `configuracion/enlace.php` y el `global.php` actual (patrón mysqli) (A7).
- [ ] Renombrar `$base_url`/`$api_key` a `$baseUrl`/`$apiKey` (A8).
- [ ] Eliminar comentarios muertos duplicados (A9).
- [ ] Eliminar la llamada superflua a `parent::__construct()` en `IndiceCtrl` (A10).
- [ ] Verificar todos los criterios de aceptación con `curl` (§7).

---

## 9. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. El servicio sigue la arquitectura `Rts → Ctrl → Mdl` en los tres dominios.
2. No existe duplicación de lógica entre los tres `*Rts.php` ni entre los tres `*Ctrl.php`/`*Mdl.php`.
3. Ninguna API key aparece hardcodeada en código ni en comentarios; vive en `configuracion/global.php`.
4. `configuracion/enlace.php` y el `global.php` con patrón mysqli fueron eliminados.
5. Toda respuesta (éxito y error) pasa por `BaseCtrl`; ningún mensaje de excepción crudo llega al cliente.
6. Los criterios de aceptación de §7 se cumplieron y se verificaron con el comando exacto.
7. El contrato de datos de éxito de los endpoints existentes es idéntico al documentado en `README.md`.
8. Se respetan las restricciones R1–R9 y las convenciones del repo (`CLAUDE.md`).
