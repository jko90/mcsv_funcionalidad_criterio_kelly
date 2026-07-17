# HLT-RF-003 — Contrato Técnico de Alto Nivel: Refactor del Front Controller `index.php` de `rest_divisas`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-003_refactor_index.md`](../rf/RF-003_refactor_index.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `docs/hlt/HLT-RF-002_refactor_codigo_backend.md` (refactor capas `Rts→Ctrl→Mdl`).
> **Servicio afectado:** `rest_divisas` (único archivo: `index.php`).
> **Versión HLT:** 1.0.0
> **Fecha:** 2026-07-17
>
> **Nota de formato:** este documento contiene **solo indicaciones** (descripciones y tablas). No
> incluye código PHP, cuerpos de método ni comandos de consola literales. El agente implementador
> traduce cada indicación a la sintaxis correspondiente respetando las convenciones del repo. Los
> nombres de clases, métodos, propiedades y constantes se citan como **valores cerrados** de decisión.

---

## Estado del HLT

| Campo | Valor |
|-------|-------|
| **Estado** | `BLOQUEADO` |
| Aprobación senior | `APROBADO` |
| Fecha de aprobación | 2026-07-17 |
| Fecha de cierre | — |

### Reglas de estado (mandatorias)

- El HLT nace en `PROPUESTO`. El agente planificador entrega **todos los checkboxes en `[ ]`**.
- Un senior debe aprobar el HLT (§6 de `doc_modo_planificacion.md`) antes de que el agente
  implementador ejecute tarea alguna. Al aprobar, cambiar `Aprobación senior` a `APROBADO` y el
  `Estado` a `EN EJECUCIÓN`.
- El agente implementador **solo** puede cambiar el `Estado` del HLT a **`COMPLETADO`** cuando se
  cumplan **todas** estas condiciones simultáneamente:
  1. **Todas** las tareas `T1`–`T14` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T10`–`T14`) se ejecutaron y su resultado observado **coincide** con
     el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`** (no `COMPLETADO`).
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`** o
  **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Refactorizar `index.php` de `rest_divisas` para convertirlo en un Front Controller mínimo, seguro
y eficiente: reemplazar el ruteo con `strpos` (que puede matchear rutas no intencionadas) por
coincidencia exacta de prefijo, externalizar la landing page corporativa (~380 líneas de HTML/CSS
que actualmente representa el 85% del archivo), eliminar la dependencia CDN externa sin verificación
SRI, normalizar las claves de respuesta de error (`fecha` → `timestamp`), y corregir el manejo de
las rutas rotas `/sinteticos` y `/otros` (hoy responden 500 por apuntar a `MarketsRts.php`
inexistente, deben responder 404).

---

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en `rest_divisas`:

- **MODIFY** `index.php` — ruteo con prefijo anclado, externalizar landing page, normalizar claves 404, corregir rutas rotas.
- **CREATE** `vistas/landing.php` — archivo separado con la función `mostrarPaginaAnuncio()` y todo su HTML/CSS.
- **MODIFY** `.htaccess` (si aplica) — solo si la nueva estructura de archivos requiere ajustar reglas de rewrite o bloqueo de carpetas para la carpeta `vistas/`.

---

## 3. Out-of-scope (qué NO entra)

- No se implementa la funcionalidad de `/sinteticos` ni `/otros` (crear `MarketsRts.php` es funcionalidad nueva).
- No se modifica `configuracion/CorsConfig.php`.
- No se cambia la lógica de `rutas/*Rts.php`, `controladores/*Ctrl.php` ni `modelos/*Mdl.php` (ya refactorizados en RF-002).
- No se migra a Composer, autoloading PSR-4 ni framework.
- No se implementa autenticación JWT, rate limiting, caché, OpenAPI ni PHPUnit.
- No se renombran ni eliminan los endpoints públicos existentes.

---

## 4. Impacto en contratos públicos

| Método | Ruta | Entrada | Éxito | Error |
|--------|------|---------|-------|-------|
| GET | `/rest_divisas/` (Accept: text/html) | ninguna | 200 HTML página corporativa (desde `vistas/landing.php`) | — |
| GET | `/rest_divisas/` (Accept: application/json) | ninguna | 200 JSON `{status:"ok",timestamp,version,service:"rest_divisas"}` | — |
| GET | `/rest_divisas/cripto` | ninguna | 200 health-check (sin cambios vs RF-002) | 405 si método ≠ GET |
| GET | `/rest_divisas/cripto/disponible` | ninguna | 200 datos (sin cambios vs RF-002) | 502/500 (sin cambios vs RF-002) |
| GET | `/rest_divisas/forex` | ninguna | 200 health-check (sin cambios vs RF-002) | 405 si método ≠ GET |
| GET | `/rest_divisas/forex/disponible` | ninguna | 200 datos (sin cambios vs RF-002) | 502/500 (sin cambios vs RF-002) |
| GET | `/rest_divisas/indice` | ninguna | 200 health-check (sin cambios vs RF-002) | 405 si método ≠ GET |
| GET | `/rest_divisas/indice/disponible` | ninguna | 200 datos (sin cambios vs RF-002) | 502/500 (sin cambios vs RF-002) |
| GET | `/rest_divisas/<dominio>/<acción-inexistente>` | ninguna | — | 404 (sin cambios vs RF-002) |
| GET | `/rest_divisas/cripto-extrano` (o similar) | ninguna | — | 404 `"Endpoint no encontrado"` (nuevo: antes matcheaba erróneamente) |
| GET | `/rest_divisas/sinteticos` | ninguna | — | 404 (cambio: antes 500 por `MarketsRts.php` inexistente) |
| GET | `/rest_divisas/otros` | ninguna | — | 404 (cambio: antes 500 por `MarketsRts.php` inexistente) |

**Mensajes de error genéricos exactos (cerrados):** 404 → `"Endpoint no encontrado"` (con `timestamp` en lugar de `fecha`).

---

## 5. Compatibilidad

**NO-BREAKING.** Los endpoints existentes (`/cripto`, `/forex`, `/indice` y sus acciones) mantienen
el mismo contrato de datos y códigos HTTP. La raíz (`/rest_divisas/`) continúa respondiendo la
página corporativa HTML para navegadores y ahora también responde un JSON mínimo para clientes
API. Las rutas rotas `/sinteticos` y `/otros` cambian de 500 a 404 — un frontend que trata
cualquier código ≥400 como error no nota la diferencia. El cambio de `fecha` a `timestamp` es una
normalización de clave que no afecta clientes existentes (ningún frontend documentado consume esa
respuesta).

---

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Front Controller | `index.php` | MODIFY — ruteo anclado, externalizar landing, normalizar claves, corregir rutas rotas |
| Vista / presentación | `vistas/landing.php` | CREATE — landing page corporativa extraída de `index.php` |

Servicio único: `rest_divisas`. No hay cambios en `configuracion/`, `controladores/`, `modelos/`,
`rutas/` ni `anexos/`.

---

## 7. Delta arquitectónico

### 7.0. Decisiones cerradas de diseño (trazables al RF)

1. **Ruteo con prefijo anclado (A1/D1).** Se reemplaza `strpos($requestUri, $patron) !== false`
   por `strncmp` o `str_starts_with` comparando el inicio de `$requestUri` contra `$patron`,
   seguido de verificación de que el siguiente carácter sea `/` o fin de cadena. Esto garantiza que
   `/cripto-extrano` no matchee `/cripto`, pero `/cripto` y `/cripto/disponible` sigan funcionando.
   El mapa `$rutas` se mantiene con los mismos patrones.

2. **Externalización de la landing page (A2/D2/D5).** Se extrae la función `mostrarPaginaAnuncio()`
   y todo su contenido a `vistas/landing.php`. En `index.php` se reemplaza la definición de
   `mostrarPaginaAnuncio()` por `require_once(__DIR__ . '/vistas/landing.php')`. El archivo
   `vistas/landing.php` contiene la misma función con idéntica firma y comportamiento.

3. **Eliminación de dependencia CDN sin SRI (A3/D3).** Se elimina la línea que carga Font Awesome
   desde cdnjs (`<link href="https://cdnjs.cloudflare.com/...">`). Los iconos `fas fa-*` se
   reemplazan por texto o emoji simple, o se eliminan. Esto aplica tanto si se mueve la landing a
   `vistas/landing.php` como si se decide eliminar la landing page.

4. **Normalización de clave en 404 (A4/D6).** En el bloque `if (!$rutaEncontrada)`, la clave
   `"fecha"` se reemplaza por `"timestamp"`, manteniendo el mismo valor (`date('c')`).

5. **Corrección de rutas rotas a 404 (A5/D4).** Se eliminan las entradas `'/sinteticos'` y
   `'/otros'` del mapa `$rutas`. Al no matchear ningún patrón, el flujo cae en el 404 genérico
   de línea 56 (`"Endpoint no encontrado"`).

6. **Respuesta JSON para la raíz (R4).** Cuando la raíz se solicita sin `Accept: text/html`
   (cliente API/curl), se responde un JSON mínimo:
   `{"status":"ok","timestamp":"...","version":"1.0.0","service":"rest_divisas"}`,
   usando `respuestaJsonSimple` (o su equivalente directo si no se requieren dependencias de
   `BaseCtrl` en `index.php`). La respuesta se emite con `http_response_code(200)` y `exit`.

### 7.1. Tabla de Delta (una indicación de cambio por fila)

| Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
|------|---------------------------|--------|-----------------|
| Vista | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/vistas/landing.php` | CREATE | Contiene la función `mostrarPaginaAnuncio()` con todo el HTML/CSS extraído de `index.php:65-448`, sin la línea CDN de Font Awesome. |
| Front Controller | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/index.php` | MODIFY | (a) Reemplazar `strpos` por `str_starts_with` + verificación de separador para ruteo exacto; (b) reemplazar definición de `mostrarPaginaAnuncio()` por `require_once(__DIR__ . '/vistas/landing.php')`; (c) eliminar la línea CDN de Font Awesome de la landing; (d) cambiar `"fecha"` a `"timestamp"` en la respuesta 404; (e) eliminar las entradas `'/sinteticos'` y `'/otros'` del mapa `$rutas`; (f) añadir respuesta JSON mínima para raíz sin `Accept: text/html`. |

### 7.2. Cadena de dependencias `require_once` (sin autoloading)

- `index.php` requiere `configuracion/CorsConfig.php` (sin cambios).
- `index.php` requiere `vistas/landing.php` (nuevo, condicional desde la raíz).
- `index.php` requiere `rutas/*Rts.php` (sin cambios).
- `vistas/landing.php` es autónomo (no requiere nada del proyecto).

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción |
|---------------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/vistas/landing.php` | CREATE |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/index.php` | MODIFY |

---

## 9. Estrategia de validación

Cada comprobación es una tarea con checkbox (T10–T14) en §12. Las verificaciones sobre HTTP asumen
Apache sirviendo el servicio en `http://localhost/rest_divisas/`; las verificaciones sobre el código
inspeccionan los archivos del servicio.

- **Ruteo exacto (A1/D1):** solicitar `GET /rest_divisas/cripto-extrano`; confirmar 404
  `"Endpoint no encontrado"` (no debe matchear `/cripto`). Verificar con `GET /rest_divisas/cripto`
  que el health-check sigue funcionando (200 con `service:"CriptoRTS"`).
- **Landing page externalizada (A2/D2/D5):** confirmar que `index.php` no contiene la función
  `mostrarPaginaAnuncio()` inline; que existe `vistas/landing.php` con esa función; que
  `GET /rest_divisas/` con `Accept: text/html` devuelve 200 HTML sin errores.
- **Sin CDN externa (A3/D3):** inspeccionar `vistas/landing.php`; no debe contener referencias a
  `cdnjs.cloudflare.com` ni a ningún CDN externo.
- **Clave normalizada (A4/D6):** inspeccionar `index.php`; confirmar que en el bloque 404 usa
  `"timestamp"` en lugar de `"fecha"`.
- **Rutas rotas → 404 (A5/D4):** solicitar `GET /rest_divisas/sinteticos` y
  `GET /rest_divisas/otros`; confirmar 404 `"Endpoint no encontrado"` (no 500).
- **Raíz con JSON (R4):** solicitar `GET /rest_divisas/` con `Accept: application/json`; confirmar
  200 con JSON de estado `ok` y `timestamp`.
- **Sin regresión en health-check y datos:** solicitar `GET /rest_divisas/indice` y
  `GET /rest_divisas/forex/disponible`; confirmar que funcionan igual que antes del refactor.

---

## 10. Riesgos

- **Regresión del ruteo al cambiar de `strpos` a prefijo anclado.** Una implementación
  incorrecta podría romper el enrutamiento de los endpoints existentes. *Mitigación:* T10 y T11
  verifican que los endpoints existentes (`/cripto`, `/forex`, `/indice`) sigan funcionando con
  health-check y datos, además de que rutas como `/cripto-extrano` den 404.
- **Landing page rota al externalizarla.** Si el `require_once` tiene una ruta relativa incorrecta,
  la raíz respondería 500. *Mitigación:* la ruta usa `__DIR__` absoluto; T12 verifica que la raíz
  con navegador devuelva 200 HTML sin errores.
- **Cambio de 500 a 404 en `/sinteticos` y `/otros`.** Un frontend que esperaba 500 podría
  interpretar 404 de forma distinta. *Mitigación:* declarado NO-BREAKING; T14 verifica que ahora
  responden 404.

---

## 11. Rollback

- **Global:** restaurar `index.php` desde el control de versiones y eliminar
  `vistas/landing.php` (creado en este refactor).
- **Por artefacto:** revertir `index.php` a su versión previa (el `strpos`, la función
  `mostrarPaginaAnuncio()` inline, el mapa `$rutas` con `sinteticos`/`otros`, y la clave
  `fecha`) y eliminar `vistas/landing.php`.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` =
> realizado y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado, con razón. Un
> checkbox = una acción verificable. El agente implementador **actualiza cada checkbox al completar y
> verificar** la tarea, y solo entonces. Todos se entregan en `[ ]`. Orden por capa:
> vistas → index.php → validaciones.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_divisas` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/` |
| Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) — **se modifica** |
| Capa de datos | APIs externas (Binance, Frankfurter, Financial Modeling Prep) vía `ClienteHttp` |
| Capa de respuesta | `controladores/BaseCtrl.php` (respuestas JSON) |
| Configuración | `configuracion/global.php` (constantes `FMP_API_KEY`, `BINANCE_BASE_URL`, `FRANKFURTER_BASE_URL`, `FMP_BASE_URL`) |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `GET http://localhost/rest_divisas/cripto` (200, `service:"CriptoRTS"`) |
| Logs | `logs/php_errors.log` del servicio |

### Grupo A — Vista / presentación

- `[X]` **T1** | `vistas/landing.php` | CREATE — Landing page sin CDN, iconos reemplazados por texto plano.

### Grupo B — Front Controller

- `[X]` **T2** | `index.php` | MODIFY — Definición de `mostrarPaginaAnuncio()` reemplazada por `require_once(__DIR__ . '/vistas/landing.php')`.

- `[X]` **T3** | `index.php` | MODIFY — `strpos` reemplazado por `str_starts_with` con verificación de separador (`$resto === '' || str_starts_with($resto, '/')`).

- `[X]` **T4** | `index.php` | MODIFY — Clave `"fecha"` reemplazada por `"timestamp"` en bloque 404.

- `[X]` **T5** | `index.php` | MODIFY — Entradas `'/sinteticos'` y `'/otros'` eliminadas del mapa `$rutas`.

- `[X]` **T6** | `index.php` | MODIFY — Respuesta JSON mínima para raíz sin `Accept: text/html` añadida.

### Grupo C — Validaciones (cada una es una tarea con su resultado esperado)

- `[BLOCKED]` **T7** | Validación — ruteo exacto (A1/D1) — **Requiere Apache.** Se verificó por inspección: `str_starts_with` implementado con separador.

- `[X]` **T8** | Validación — landing page externalizada (A2/D2/D5) — Inspeccionado. `index.php` no contiene la función `mostrarPaginaAnuncio()` (solo la invoca). Existe `vistas/landing.php` con la función. Parte HTTP bloqueada (Apache no disponible).

- `[X]` **T9** | Validación — sin CDN externa (A3/D3) — Inspeccionado. No hay `cdnjs.cloudflare.com` en ningún `.php` del proyecto.

- `[X]` **T10** | Validación — clave normalizada 404 (A4/D6) — Inspeccionado. `index.php` usa `"timestamp"` en lugar de `"fecha"`.

- `[BLOCKED]` **T11** | Validación — rutas rotas → 404 (A5/D4) — **Requiere Apache.** Se verificó por inspección: entradas `sinteticos`/`otros` eliminadas del mapa `$rutas`.

- `[BLOCKED]` **T12** | Validación — raíz JSON (R4) — **Requiere Apache.** Se verificó por inspección: código añadido en bloque raíz.

- `[BLOCKED]` **T13** | Validación — sin regresión health-check — **Requiere Apache.**

- `[BLOCKED]` **T14** | Validación — sin regresión datos — **Requiere Apache.**

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 14
- Completadas [X]: 9 (T1-T6, T8, T9, T10)
- Bloqueadas [BLOCKED]: 5 (T7, T11, T12, T13, T14)
- Omitidas: 0

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 | [X] | vistas/landing.php | Creado sin CDN |
| T2 | [X] | index.php | Landing externalizada vía require_once |
| T3 | [X] | index.php | str_starts_with + separador implementado |
| T4 | [X] | index.php | fecha→timestamp en 404 |
| T5 | [X] | index.php | sinteticos/otros eliminados del mapa |
| T6 | [X] | index.php | JSON raíz añadido |
| T7 | [BLOCKED] | (validación) | Apache no disponible en este entorno |
| T8 | [X] | (validación) | Código OK; parte HTTP bloqueada |
| T9 | [X] | (validación) | Sin CDN verificado |
| T10 | [X] | (validación) | timestamp verificado |
| T11 | [BLOCKED] | (validación) | Apache no disponible |
| T12 | [BLOCKED] | (validación) | Apache no disponible |
| T13 | [BLOCKED] | (validación) | Apache no disponible |
| T14 | [BLOCKED] | (validación) | Apache no disponible |

### Validaciones ejecutadas

| ID | Comando exacto ejecutado | Salida / HTTP observado | Esperado | ¿Coincide? |
|----|--------------------------|-------------------------|----------|------------|
| T8 | grep -c 'function mostrarPaginaAnuncio' vistas/landing.php | 1 (encontrada en landing.php) | Existe en vistas/landing.php | Sí |
| T8 | grep 'mostrarPaginaAnuncio' index.php | solo invocación, no definición | Sin definición inline | Sí |
| T9 | grep -r 'cdnjs.cloudflare.com' *.php | Sin resultados | Sin CDN externo | Sí |
| T10 | grep '"fecha"' index.php | Sin resultados | No usar "fecha" | Sí |
| T10 | grep '"timestamp"' index.php | Encontrado en líneas 54 y 67 | Usar "timestamp" | Sí |
| T11 | grep 'sinteticos\|otros' index.php | Sin resultados (solo en docs/) | No en mapa $rutas | Sí |

### Blockers
- Apache (httpd) no está instalado en este entorno. Las validaciones HTTP (T7, T11, T12, T13, T14) requieren el servicio sirviendo en `http://localhost/rest_divisas/`. Pendientes de ejecutar cuando el servicio esté desplegado.

### Archivos cambiados
- `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/vistas/landing.php` — CREATE — Landing page corporativa sin CDN.
- `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/index.php` — MODIFY — Ruteo anclado, landing externalizada, timestamp, rutas rotas corregidas, JSON raíz.

### Declaración final
- [X] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [X] Todas las validaciones ejecutables (sin Apache) se ejecutaron y su resultado quedó registrado.
- [X] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T14 en [X]).
- Declaración: **BLOQUEADO** — Las tareas de implementación (T1-T6) están completas y validadas por inspección de código, pero 5 validaciones HTTP (T7, T11-T14) no pudieron ejecutarse por falta de Apache en el entorno. Pendiente desplegar y verificar con curl.
