# HLT-RF-001 — Contrato Técnico de Alto Nivel: Refactor del `.htaccess` de `rest_divisas`

> **Artefacto:** HLT (High-Level Technical Contract) + checklist ejecutable + Execution Report.
> **Requerimiento origen:** [`docs/rf/RF-001_refactor_htaccess.md`](../rf/RF-001_refactor_htaccess.md).
> **Referencia normativa:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Servicio afectado:** `rest_divisas` (autónomo, **sin base de datos**; no se replica en otros `rest_*`).
> **Versión HLT:** 1.0.0
> **Fecha:** 2026-07-17
>
> **Nota de formato:** este documento contiene **solo indicaciones** (descripciones y tablas). No
> incluye código, directivas Apache literales, HTML ni comandos de consola. El agente implementador
> traduce cada indicación a la sintaxis correspondiente respetando las convenciones del repo.

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
  1. **Todas** las tareas `T1`–`T20` están en `[X]` (ninguna en `[ ]` ni en `[BLOCKED]`).
  2. **Todas** las validaciones (`T12`–`T20`) se ejecutaron y su resultado observado **coincide** con
     el esperado, registrado en el Execution Report.
  3. La Declaración final del Execution Report es `RESUELTO`.
- Si cualquier tarea queda en `[BLOCKED]`, el `Estado` del HLT es **`BLOQUEADO`** (no `COMPLETADO`).
- Si hay tareas `[X]` y otras `[ ]`/`[BLOCKED]` sin resolución, el `Estado` es **`EN EJECUCIÓN`** o
  **`PARCIAL`**; **nunca** `COMPLETADO`.

---

## 1. Objetivo

Refactorizar el archivo `rest_divisas/.htaccess` para **eliminar redundancia, código muerto y
directivas heredadas por copia de otros servicios** (defectos D1–D7 del RF-001), y **crear las 5
páginas de error** que sus directivas `ErrorDocument` ya referencian, **sin alterar el comportamiento
observable de la API** (mismos endpoints, mismos códigos HTTP, mismas restricciones de acceso).

---

## 2. Scope (alcance)

Lista cerrada de artefactos afectados en el servicio `rest_divisas`:

- **Archivo `.htaccess`** (MODIFY): consolidación de bloques de reescritura, unificación del bloqueo de
  carpetas internas, eliminación de reglas de estáticos, corrección del redirect trailing-slash,
  eliminación del comentario placeholder y preservación sincronizada de los headers CORS.
- **`errors/400.html`** (CREATE).
- **`errors/401.html`** (CREATE).
- **`errors/403.html`** (CREATE).
- **`errors/404.html`** (CREATE).
- **`errors/500.html`** (CREATE).

No hay cambios en la tripleta PHP (`rutas/`, `controladores/`, `modelos/`), ni en `index.php`.
El servicio no tiene base de datos ni SQL.

---

## 3. Out-of-scope (qué NO entra)

- No se modifica el ruteo funcional de la API ni el mapa `$rutas` de `index.php`.
- No se corrige que `sinteticos` y `otros` mapeen a `rutas/MarketsRts.php`, archivo que **no existe**
  en `rutas/` (solo existen `CriptoRts.php`, `ForexRts.php`, `IndiceRts.php`). Se documenta aquí como
  observación cerrada; su solución es un requerimiento separado. La lista de exclusión del
  trailing-slash sí incluye `sinteticos` y `otros` porque están registrados en `$rutas`.
- No se elimina el manejo de CORS del `.htaccess` (los headers CORS y el manejo de preflight `OPTIONS`
  se **conservan**; ver §7, D1/A7).
- No se activa el forzado de HTTPS (la regla HTTPS comentada **permanece comentada**).
- No se mueve la lógica de CORS ni de errores fuera de PHP; `CorsConfig` y `BaseCtrl` siguen siendo la
  fuente primaria en PHP.
- No se externalizan credenciales ni el secreto JWT.
- No se toca `configuracion/global.php`, `configuracion/CorsConfig.php` ni ningún `*.php`.
- No se replican cambios en otros servicios `rest_*`.
- No se modifican: el bloque de compresión gzip, los headers de seguridad (X-Frame-Options, CSP,
  etc.), la desactivación de índices, la ocultación de firma del servidor, los límites de subida y
  configuración PHP, ni la protección de archivos sensibles individuales. No son parte de D1–D7.

---

## 4. Impacto en contratos públicos

**Sin cambios en contratos públicos de la API.** No se crea, modifica ni elimina ningún endpoint,
parámetro de entrada, forma de JSON de salida ni código HTTP de negocio. El único cambio observable a
nivel HTTP es que las respuestas de error de Apache (400/401/403/404/500) ahora sirven un cuerpo HTML
existente en lugar de un error interno de "documento de error no encontrado".

| Superficie | Antes | Después |
|-----------|-------|---------|
| `GET /rest_divisas/cripto` (health check) | 200 + JSON `{"status":"ok",...}` | **Idéntico** |
| Acceso directo a `configuracion/`, `rutas/`, `modelos/`, `controladores/`, `logs/` | Denegado (301/403 inconsistente) | Denegado **403** (unificado) |
| Error 400/401/403/404/500 de Apache | `ErrorDocument` apunta a archivo inexistente | Sirve `errors/<código>.html` existente |
| Preflight `OPTIONS` | 200 (reescritura + `CorsConfig::manejarPreflight`) | **Idéntico** |
| Headers CORS `Access-Control-*` | Emitidos por `.htaccess` (origen `http://localhost:8100`) | **Idénticos** (preservados) |

---

## 5. Compatibilidad

**NO-BREAKING.** El SPA Ionic/Angular en `http://localhost:8100` no percibe ningún cambio de contrato:
mismos endpoints, mismos códigos HTTP de negocio, mismos headers CORS (mismo origen, métodos y headers
permitidos). El cambio en el código de denegación de carpetas internas (301 → 403) no afecta al SPA
porque el SPA nunca solicita esas rutas internas.

---

## 6. Placement arquitectónico

| Capa | Ubicación | Cambio |
|------|-----------|--------|
| Configuración Apache (borde de infraestructura) | `rest_divisas/.htaccess` | MODIFY |
| Recursos estáticos de error (servidos por Apache vía `ErrorDocument`) | `rest_divisas/errors/*.html` | CREATE |

No se toca ninguna capa PHP (`index.php` / `rutas` / `controladores` / `modelos` / `configuracion`).
El servicio no tiene `anexos/*.sql` porque no usa base de datos. Servicio único: `rest_divisas`.

---

## 7. Delta arquitectónico

> **Hallazgo verificado sobre CORS:** `configuracion/CorsConfig.php` **no emite** los headers
> `Access-Control-*` (solo fija `Content-Type`, `Cache-Control` y `Expires`); su propio comentario
> declara que los headers CORS "están en el `.htaccess`". Por tanto el `.htaccess` es el **único
> emisor** real de CORS, y "sincronizar" (A7/R3) significa **preservar sin cambios** los valores
> actuales del `.htaccess`; no existe divergencia que reconciliar.
>
> **Hallazgo verificado sobre dominios (D4):** el mapa `$rutas` de `index.php` registra exactamente
> `cripto`, `forex`, `indice`, `sinteticos` y `otros` (`cripto`→`CriptoRts.php`, `forex`→`ForexRts.php`,
> `indice`→`IndiceRts.php`; `sinteticos` y `otros`→`MarketsRts.php`, **archivo inexistente**). La lista
> de exclusión del trailing-slash se fija a esos cinco dominios registrados y **elimina** todos los
> ajenos (`empresa`, `persona`, `usuario`, `categoria`, `producto`, `autenticacion`).
>
> **Nota sobre caché (R6):** por tratarse de precios volátiles de APIs externas, se **conserva** la
> entrada de expiración de JSON en cero segundos (no cachear).

### 7.1. Tabla de Delta (una indicación de cambio por fila)

| Capa | Artefacto | Acción | Indicación cerrada |
|------|-----------|--------|--------------------|
| Config | `errors/400.html` | CREATE | Crear la carpeta `errors/` y la página de error según §7.3, con código 400 y mensaje "Solicitud incorrecta". |
| Config | `errors/401.html` | CREATE | Página de error según §7.3, código 401, mensaje "No autorizado". |
| Config | `errors/403.html` | CREATE | Página de error según §7.3, código 403, mensaje "Acceso denegado". |
| Config | `errors/404.html` | CREATE | Página de error según §7.3, código 404, mensaje "Recurso no encontrado". |
| Config | `errors/500.html` | CREATE | Página de error según §7.3, código 500, mensaje "Error interno del servidor". |
| Config | `.htaccess` | MODIFY | Consolidar los dos bloques de reescritura (`mod_rewrite`) en uno solo y eliminar el segundo bloque, dedicado al anti-hotlinking (D5/A1). |
| Config | `.htaccess` | MODIFY | Reemplazar las cuatro reglas de bloqueo que hoy redirigen con 301 y la regla `RedirectMatch` que responde 403, por **una única** regla que deniegue con **403** el acceso directo a las carpetas `configuracion`, `rutas`, `modelos`, `controladores` y `logs`, bajo el prefijo del servicio (D6/A2/R4). |
| Config | `.htaccess` | MODIFY | Eliminar todas las reglas de estáticos: anti-hotlinking, declaración de tipos MIME para `.js` y `.css`, y las entradas de caché/expiración para imágenes, PDF, CSS, JS e íconos; además, quitar la condición que exceptúa la carpeta `assets/`. Conservar únicamente la declaración de tipo MIME para JSON y la entrada de expiración para JSON en cero segundos (D3/A3/R6). |
| Config | `.htaccess` | MODIFY | En el redirect de trailing-slash, sustituir la lista de dominios ajenos (`empresa`, `persona`, `usuario`, `categoria`, `producto`, `autenticacion`) por los dominios registrados del servicio: `cripto`, `forex`, `indice`, `sinteticos`, `otros` (D4/A4). |
| Config | `.htaccess` | MODIFY | Eliminar la sección de "prevención de ataques" que solo contiene el comentario placeholder muerto sin contenido asociado (D7/A5). |
| Config | `.htaccess` | MODIFY | Conservar **intactos** los headers CORS (origen `http://localhost:8100`; métodos GET, POST, PUT, DELETE, OPTIONS; headers permitidos Content-Type, Authorization, X-Requested-With; edad máxima 3600) y el manejo del preflight `OPTIONS`, reubicando este último dentro del bloque de reescritura único (D1/A7). |

### 7.2. Estado objetivo del `.htaccess` (indicación de bloques y orden)

Tras el refactor, el `.htaccess` debe contener **exactamente** estos bloques, en este orden:

1. Desactivación del listado de directorios y ocultación de la firma del servidor — **sin cambios**.
2. Bloque de headers de seguridad y CORS — **sin cambios** (D1/A7).
3. Bloque de compresión gzip — **sin cambios**.
4. Bloque de caché/expiración — **reducido**: debe quedar únicamente la entrada que fija la expiración
   de las respuestas JSON en cero segundos (A3/R6).
5. Protección de archivos sensibles individuales — **sin cambios**.
6. **Bloque único** de reescritura (`mod_rewrite`), que contenga en este orden: (a) activación del
   motor de reescritura; (b) manejo del preflight `OPTIONS` reenviando a `index.php` con respuesta 200
   (conservado, D1/A7); (c) la única regla que deniega con 403 el acceso a las cinco carpetas internas
   bajo el prefijo del servicio (A2/D6/R4); (d) la reescritura general de la API que reenvía a
   `index.php` toda petición que no corresponda a un archivo o directorio existente (sin la condición
   de exclusión de `assets/`, A3); (e) la regla de forzado de HTTPS que **permanece comentada**; (f) el
   redirect de trailing-slash con los dominios registrados `cripto`, `forex`, `indice`, `sinteticos` y
   `otros` (A4).
7. Directivas `ErrorDocument` para 400/401/403/404/500 apuntando a `errors/<código>.html` bajo el
   prefijo `/rest_divisas/` — **sin cambios** (los archivos referenciados ahora existen).
8. Límites de subida y configuración PHP (errores apagados, log de errores) — **sin cambios**.
9. Bloque de tipos MIME — **reducido**: debe quedar únicamente la declaración del tipo MIME para JSON
   (A3).
10. **Eliminados por completo**: la sección de "prevención de ataques" con el placeholder (A5); el
    segundo bloque de reescritura de anti-hotlinking (A1/A3); y la regla `RedirectMatch` de bloqueo
    inconsistente que cubría `configuracion`, `logs`, `backups` y `temp` (A2).

### 7.3. Indicación de contenido de las páginas de error

Cada `errors/<código>.html` debe ser una página HTML estática **autocontenida** (sin recursos ni
enlaces externos), con las siguientes características, idénticas entre las cinco salvo el código y el
mensaje:

- Idioma declarado en español.
- Título de la pestaña con el formato: `Error <código> — Divisas`.
- Un encabezado principal grande que muestre el **número de código**.
- Un párrafo con el **mensaje** correspondiente.
- Estilo sobrio e inline, acorde a la identidad del servicio (fondo azul institucional, texto claro,
  contenido centrado vertical y horizontalmente).

| Archivo | Código a mostrar | Mensaje |
|---------|------------------|---------|
| `errors/400.html` | 400 | Solicitud incorrecta |
| `errors/401.html` | 401 | No autorizado |
| `errors/403.html` | 403 | Acceso denegado |
| `errors/404.html` | 404 | Recurso no encontrado |
| `errors/500.html` | 500 | Error interno del servidor |

---

## 8. Inventario de artefactos (cerrado)

| Path absoluto | Acción | Motivo |
|---------------|--------|--------|
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/errors/400.html` | CREATE | Existencia para `ErrorDocument 400` (D2/A6). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/errors/401.html` | CREATE | Existencia para `ErrorDocument 401` (D2/A6). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/errors/403.html` | CREATE | Existencia para `ErrorDocument 403` (D2/A6). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/errors/404.html` | CREATE | Existencia para `ErrorDocument 404` (D2/A6). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/errors/500.html` | CREATE | Existencia para `ErrorDocument 500` (D2/A6). |
| `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/.htaccess` | MODIFY | Refactor D1–D7 conforme a §7.2. |

---

## 9. Estrategia de validación

Cada comprobación es una tarea con checkbox (T12–T20) en §12, con la indicación exacta de qué ejecutar
y qué resultado se espera. Las verificaciones sobre HTTP asumen Apache sirviendo el servicio en
`http://localhost/rest_divisas/`; las verificaciones sobre el contenido del archivo se hacen
inspeccionando `rest_divisas/.htaccess`.

- **Health check (R1):** solicitar por GET el endpoint `cripto` del servicio y confirmar respuesta 200
  con cuerpo JSON de estado `ok`.
- **Bloque único de reescritura (D5):** confirmar que en el `.htaccess` existe **una sola** apertura de
  bloque `mod_rewrite`.
- **Dominios del trailing-slash correctos (D4):** confirmar que la lista de exclusión del redirect de
  trailing-slash contiene exactamente `cripto`, `forex`, `indice`, `sinteticos` y `otros`, y que **no
  aparecen** `empresa`, `persona`, `usuario`, `categoria`, `producto` ni `autenticacion`.
- **Placeholder ausente (D7):** confirmar que **no aparece** el comentario placeholder de prevención de
  ataques.
- **Carpetas internas denegadas (R4):** solicitar el acceso directo a cada una de las carpetas
  `configuracion`, `rutas`, `modelos`, `controladores` y `logs` (incluyendo un archivo interno de
  `configuracion`) y confirmar respuesta **403** en todos los casos.
- **Páginas de error existen y se sirven (D2):** solicitar cada una de las cinco páginas
  `errors/<código>.html` y confirmar respuesta 200.
- **Sin reglas de estáticos, con JSON no cacheado (D3/R6):** confirmar que en el `.htaccess` **no
  aparecen** reglas de anti-hotlinking (referrer), declaraciones de tipo MIME para `.js`/`.css`, ni
  entradas de expiración para imágenes; y que **sí permanece** la entrada de expiración de JSON en cero
  segundos.
- **CORS preservado (D1/A7/R3):** enviar una petición con origen `http://localhost:8100` y confirmar
  que el header `Access-Control-Allow-Origin` devuelto vale exactamente `http://localhost:8100`.
- **Prefijo preservado (R2):** confirmar que todas las reglas de reescritura, bloqueos y directivas
  `ErrorDocument` usan el prefijo `/rest_divisas/`.

---

## 10. Riesgos

- **Regresión en la denegación de carpetas.** Cambiar 301→403 y unificar el mecanismo podría dejar
  alguna carpeta accesible si el patrón queda mal definido. *Mitigación:* T16 verifica las cinco
  carpetas explícitamente esperando 403.
- **Romper el ruteo al quitar la exclusión de `assets/`.** *Mitigación:* la carpeta `assets/` no existe
  (verificado); T12 (health check) confirma que el ruteo sigue intacto.
- **Divergencia de CORS.** *Mitigación:* los valores CORS se preservan sin cambios y `CorsConfig` no
  emite CORS, por lo que no hay fuente divergente; T19 confirma el header.
- **Endpoints `sinteticos`/`otros` apuntan a `MarketsRts.php` inexistente.** Este defecto preexiste al
  refactor y **no** se corrige aquí (out-of-scope, §3). El refactor no lo agrava: incluir esos dominios
  en la exclusión del trailing-slash preserva el comportamiento actual. *Mitigación:* documentado como
  observación; su corrección es un requerimiento separado.

---

## 11. Rollback

- **Global:** restaurar el `.htaccess` a su versión anterior desde el control de versiones y eliminar
  la carpeta `errors/` creada. El servicio vuelve al estado previo sin efectos en la tripleta PHP
  (cambios exclusivamente de configuración y estáticos; el servicio no tiene base de datos).
- **Por artefacto:** revertir cada regla o bloque del `.htaccess` a su estado anterior descrito en
  §7.2, o eliminar el archivo `errors/*.html` correspondiente.

---

## 12. Plan de tareas ejecutable (checklist)

> **Reglas de seguimiento (§9 de `doc_modo_planificacion.md`):** `[ ]` = no realizado; `[X]` =
> realizado y verificado (lo marca el agente implementador); `[BLOCKED]` = bloqueado, con razón. Un
> checkbox = una acción verificable. El agente implementador **actualiza cada checkbox al completar y
> verificar** la tarea, y solo entonces. Todos se entregan en `[ ]`.

### Execution Context

| Campo | Valor |
|-------|-------|
| Servicio afectado | `rest_divisas` |
| Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
| Path raíz del servicio | `/run/media/siperpc/SSD/2022 Chimborazo/Desarrollo/back criterio kelly/rest_divisas/` |
| Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) |
| Capa de datos | **Sin base de datos**: cURL a APIs externas (Binance, Frankfurter, Financial Modeling Prep) — **no tocada** |
| Capa de respuesta | `controladores/BaseCtrl.php` — **no tocada** |
| CORS (PHP) | `configuracion/CorsConfig.php` — **no emite `Access-Control-*`**; el `.htaccess` es el emisor |
| BD | No aplica (servicio sin base de datos) |
| Prefijo de tablas | No aplica |
| Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
| Health check | `GET http://localhost/rest_divisas/cripto` |
| Dominios registrados del servicio | `cripto`, `forex`, `indice`, `sinteticos`, `otros` |
| Observación (no se corrige aquí) | `sinteticos` y `otros` mapean a `rutas/MarketsRts.php`, archivo inexistente |
| Logs | `logs/php_errors.log` del servicio |

### Grupo A — Crear páginas de error (prerrequisito de `ErrorDocument`)

- `[ ]` **T1** | `errors/400.html` | CREATE — Crear la carpeta `errors/` y la página de error según la
  indicación de §7.3, con código 400 y mensaje "Solicitud incorrecta". *Nota:* HTML autocontenido, sin
  recursos externos.
- `[ ]` **T2** | `errors/401.html` | CREATE — Página de error según §7.3, código 401, mensaje "No
  autorizado".
- `[ ]` **T3** | `errors/403.html` | CREATE — Página de error según §7.3, código 403, mensaje "Acceso
  denegado".
- `[ ]` **T4** | `errors/404.html` | CREATE — Página de error según §7.3, código 404, mensaje "Recurso
  no encontrado".
- `[ ]` **T5** | `errors/500.html` | CREATE — Página de error según §7.3, código 500, mensaje "Error
  interno del servidor".

### Grupo B — Refactor del `.htaccess` (cada tarea es un cambio atómico sobre el mismo archivo)

- `[ ]` **T6** | `.htaccess` | MODIFY — Consolidar los dos bloques de reescritura en uno solo y
  eliminar el segundo bloque (anti-hotlinking). El bloque único resultante debe respetar el orden
  descrito en §7.2 punto 6 (A1/D5).
- `[ ]` **T7** | `.htaccess` | MODIFY — Reemplazar las cuatro reglas de bloqueo con redirección 301 y
  la regla `RedirectMatch` 403 por una única regla que deniegue con 403 el acceso a las carpetas
  `configuracion`, `rutas`, `modelos`, `controladores` y `logs` bajo el prefijo del servicio.
  Conservar intactos los bloques de protección de archivos sensibles individuales (A2/D6/R4).
- `[ ]` **T8** | `.htaccess` | MODIFY — Eliminar las reglas de estáticos: tipos MIME de `.js` y `.css`,
  entradas de expiración para imágenes/PDF/CSS/JS/íconos, y la condición de exclusión de `assets/`.
  Conservar únicamente el tipo MIME para JSON y la expiración de JSON en cero segundos (A3/D3/R6).
- `[ ]` **T9** | `.htaccess` | MODIFY — En el redirect de trailing-slash, sustituir la lista de
  dominios ajenos por los dominios registrados del servicio: `cripto`, `forex`, `indice`, `sinteticos`
  y `otros` (A4/D4).
- `[ ]` **T10** | `.htaccess` | MODIFY — Eliminar la sección de "prevención de ataques" que solo
  contiene el comentario placeholder muerto (A5/D7).
- `[ ]` **T11** | `.htaccess` | MODIFY — Verificar que el bloque de headers CORS queda intacto (origen
  `http://localhost:8100`; métodos GET, POST, PUT, DELETE, OPTIONS; headers Content-Type, Authorization,
  X-Requested-With; edad máxima 3600) y que el manejo del preflight `OPTIONS` quedó reubicado dentro
  del bloque de reescritura único. No modificar valores CORS: no hay divergencia con `CorsConfig`
  (A7/D1).

### Grupo C — Validaciones (cada una es una tarea con su resultado esperado)

- `[ ]` **T12** | Validación — health check — Solicitar por GET el endpoint `cripto` del servicio.
  **Esperado:** 200 y cuerpo JSON de estado `ok`, idéntico al previo.
- `[ ]` **T13** | Validación — bloque de reescritura único (D5) — Inspeccionar el `.htaccess`.
  **Esperado:** existe una sola apertura de bloque `mod_rewrite`.
- `[ ]` **T14** | Validación — dominios del trailing-slash correctos (D4) — Inspeccionar el `.htaccess`.
  **Esperado:** la lista de exclusión contiene exactamente `cripto`, `forex`, `indice`, `sinteticos` y
  `otros`; no aparecen `empresa`, `persona`, `usuario`, `categoria`, `producto` ni `autenticacion`.
- `[ ]` **T15** | Validación — placeholder ausente (D7) — Inspeccionar el `.htaccess`. **Esperado:** no
  aparece el comentario placeholder de prevención de ataques.
- `[ ]` **T16** | Validación — carpetas internas denegadas (R4) — Solicitar el acceso directo a
  `configuracion` (incluido un archivo interno como `global.php`), `rutas`, `modelos`, `controladores`
  y `logs`. **Esperado:** 403 en todos los casos.
- `[ ]` **T17** | Validación — páginas de error se sirven (D2) — Solicitar las cinco páginas
  `errors/400.html`, `errors/401.html`, `errors/403.html`, `errors/404.html`, `errors/500.html`.
  **Esperado:** 200 en las cinco.
- `[ ]` **T18** | Validación — sin estáticos y con JSON no cacheado (D3/R6) — Inspeccionar el
  `.htaccess`. **Esperado:** no aparecen reglas de anti-hotlinking (referrer), ni tipos MIME de
  `.js`/`.css`, ni entradas de expiración para imágenes; y **sí permanece** la expiración de JSON en
  cero segundos.
- `[ ]` **T19** | Validación — CORS preservado (D1/A7/R3) — Enviar una petición con origen
  `http://localhost:8100`. **Esperado:** el header `Access-Control-Allow-Origin` devuelto vale
  exactamente `http://localhost:8100`.
- `[ ]` **T20** | Validación — prefijo preservado (R2) — Inspeccionar el `.htaccess`. **Esperado:**
  todas las reglas de reescritura, bloqueos y directivas `ErrorDocument` usan el prefijo
  `/rest_divisas/`.

---

## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: 20
- Completadas [X]: _(pendiente)_
- Bloqueadas [BLOCKED]: _(pendiente)_
- Omitidas: _(pendiente)_

### Estado por tarea

| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |  | errors/400.html |  |
| T2 |  | errors/401.html |  |
| T3 |  | errors/403.html |  |
| T4 |  | errors/404.html |  |
| T5 |  | errors/500.html |  |
| T6 |  | .htaccess |  |
| T7 |  | .htaccess |  |
| T8 |  | .htaccess |  |
| T9 |  | .htaccess |  |
| T10 |  | .htaccess |  |
| T11 |  | .htaccess |  |
| T12 |  | (validación) |  |
| T13 |  | (validación) |  |
| T14 |  | (validación) |  |
| T15 |  | (validación) |  |
| T16 |  | (validación) |  |
| T17 |  | (validación) |  |
| T18 |  | (validación) |  |
| T19 |  | (validación) |  |
| T20 |  | (validación) |  |

### Validaciones ejecutadas

| ID | Qué se ejecutó | Resultado observado | Esperado | ¿Coincide? |
|----|----------------|---------------------|----------|------------|
|    |                |                     |          |            |

### Blockers
- _(descripción del bloqueo, tarea afectada y qué se necesita para desbloquear)_

### Archivos cambiados
- _(path absoluto — CREATE|MODIFY — resumen de una línea)_

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas se ejecutaron y su resultado quedó registrado.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- [ ] El estado del HLT se actualizó según §"Reglas de estado" (COMPLETADO solo si T1–T20 en [X]).
- Declaración: _(RESUELTO | PARCIAL | BLOQUEADO)_ — _(una frase de cierre)_
