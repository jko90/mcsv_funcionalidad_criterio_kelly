# RF-001 — Refactor del archivo `.htaccess` de `rest_divisas`

> **Tipo:** Refactor / Deuda técnica (configuración de infraestructura Apache).
> **Servicio afectado:** `rest_divisas`.
> **Archivo objetivo:** `rest_divisas/.htaccess`.
> **Prioridad:** Media.
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.

---

## 1. Historia de usuario

> **Como** desarrollador backend del servicio `rest_divisas`,
> **quiero** un archivo `.htaccess` limpio, sin reglas redundantes ni configuración heredada
> por copia de otros servicios,
> **para** que la configuración de Apache sea mantenible, refleje únicamente lo que este
> servicio realmente usa y no diverja de la lógica ya implementada en PHP (CORS, respuestas JSON).

---

## 2. Contexto y problema actual

`rest_divisas` es un servicio **sin base de datos**: expone un catálogo de activos (cripto/forex/
índices) consultando APIs externas vía cURL. Su `.htaccess`, sin embargo, es una copia del de los
demás servicios y arrastra reglas redundantes, código muerto y directivas ajenas. Defectos concretos
verificados contra el código real del servicio:

| # | Defecto detectado | Evidencia en el código |
|---|-------------------|------------------------|
| D1 | **CORS duplicado** entre `.htaccess` y PHP, con riesgo de divergencia. | `index.php` ejecuta `CorsConfig::configurar()` y `CorsConfig::manejarPreflight()`; el `.htaccess` repite headers `Access-Control-*` y un rewrite propio de `OPTIONS`. |
| D2 | **`ErrorDocument` apuntando a archivos inexistentes.** | 5 directivas `ErrorDocument` referencian `errors/400.html … 500.html`; la carpeta `errors/` **no existe** en el servicio. |
| D3 | **Reglas para `assets/` que no existen.** | No hay carpeta `assets/`; sin embargo hay `RewriteCond` que la excluye, protección anti-hotlinking sobre `jpg/png/css/js`, `AddType` de MIME para css/js y reglas de `mod_expires` para imágenes/pdf. Este servicio es una **API REST que responde JSON**, no sirve estáticos. |
| D4 | **Dominios heredados por copia de otro servicio.** | El redirect de trailing-slash excluye `empresa\|persona\|usuario\|categoria\|producto\|autenticacion`; los dominios **realmente registrados** en el mapa `$rutas` de `index.php` son `cripto`, `forex`, `indice`, `sinteticos`, `otros`. Ninguno de los excluidos actuales corresponde a este servicio. |
| D5 | **Dos bloques `<IfModule mod_rewrite.c>` separados.** | Uno para API REST (l. ~96) y otro para hotlinking (l. ~172); deben consolidarse en un único bloque. |
| D6 | **Bloqueo de carpetas internas triplicado e inconsistente.** | Las carpetas internas se bloquean por `RewriteRule` con redirect `301`, por `RedirectMatch 403` y por `<Files>`/`<FilesMatch>`, con códigos de respuesta distintos (301 vs 403) para el mismo fin. |
| D7 | **Comentario placeholder muerto.** | Línea con `# ...resto del código de prevención de ataques existente...` sin contenido asociado. |

---

## 3. Objetivo del refactor

Eliminar redundancia y código muerto del `.htaccess`, **sin alterar el comportamiento observable
de la API**: los mismos endpoints, los mismos códigos HTTP y las mismas restricciones de acceso
que hoy deben seguir vigentes tras el refactor.

---

## 4. Alcance (in-scope)

- **A1.** Consolidar los dos bloques `<IfModule mod_rewrite.c>` en uno solo (D5).
- **A2.** Unificar el bloqueo de carpetas internas (`configuracion`, `rutas`, `modelos`,
  `controladores`, `logs`) en un mecanismo único y coherente, conservando que el acceso directo
  siga quedando **denegado** (D6).
- **A3.** Eliminar reglas de estáticos que no aplican a una API JSON: anti-hotlinking, `AddType`
  de MIME para css/js, y las entradas de `mod_expires`/cache de imágenes/pdf. **Conservar**
  `ExpiresByType application/json "access plus 0 seconds"`, relevante porque las respuestas provienen
  de precios volátiles de APIs externas y no deben cachearse (D3).
- **A4.** Corregir el redirect de trailing-slash para que use los dominios **realmente registrados**
  del servicio (`cripto`, `forex`, `indice`, `sinteticos`, `otros`) y eliminar los ajenos (D4).
- **A5.** Eliminar el comentario placeholder muerto (D7).
- **A6.** **Crear las páginas `errors/400.html`, `401.html`, `403.html`, `404.html`, `500.html`**
  para que las directivas `ErrorDocument` dejen de apuntar a archivos inexistentes (D2).
- **A7.** Mantener los headers CORS en el `.htaccess` como *fallback*, pero **sincronizados** con
  `CorsConfig` (mismo origen, métodos y headers permitidos) para no divergir (D1).

---

## 5. Fuera de alcance (out-of-scope)

- **No** modificar el ruteo funcional de la API ni el mapa `$rutas` de `index.php`.
- **No** corregir el hecho de que `/sinteticos` y `/otros` mapean a `rutas/MarketsRts.php`, archivo
  que **no existe** en `rutas/` (solo hay `CriptoRts.php`, `ForexRts.php`, `IndiceRts.php`). Se
  documenta aquí como observación; su solución es un requerimiento separado.
- **No** eliminar el manejo de CORS del `.htaccess` (se mantiene en ambos lados por decisión de negocio).
- **No** activar forzado de HTTPS ni añadir hardening nuevo (la regla HTTPS comentada permanece comentada).
- **No** mover la lógica CORS ni de errores fuera de PHP; `CorsConfig` y `BaseCtrl` siguen siendo la fuente primaria.
- **No** replicar cambios en otros servicios `rest_*` (cada servicio es autónomo).

---

## 6. Reglas de negocio y restricciones

- **R1 — Comportamiento preservado.** Tras el refactor, el health check y cada endpoint responden
  igual que antes (mismo JSON, mismo código HTTP).
- **R2 — Prefijo del servicio.** Se conserva el prefijo `/rest_divisas/` en todas las reglas
  de rewrite, bloqueos y `ErrorDocument` (no copiar reglas de otro servicio sin ajustar el prefijo,
  conforme a `CLAUDE.md` §.htaccess y `doc_modo_planificacion.md` §8.10).
- **R3 — CORS sincronizado.** El origen permitido, métodos y headers del `.htaccess` deben coincidir
  con los de `configuracion/CorsConfig.php` (hoy origen `http://localhost:8100`).
- **R4 — Denegación de carpetas internas.** El acceso directo a `configuracion/`, `rutas/`,
  `modelos/`, `controladores/` y `logs/` sigue bloqueado tras el refactor.
- **R5 — Convenciones de nomenclatura del repo.** Cualquier identificador PHP que se cree o toque
  respeta las convenciones del proyecto: **clases en `PascalCase`, métodos y variables en `camelCase`**,
  dominio y comentarios en **español**. Las páginas de error siguen la convención numérica existente
  (`400.html`, `401.html`, `403.html`, `404.html`, `500.html`).
  > Nota: las directivas del `.htaccess` son sintaxis de Apache (no PHP), por lo que camelCase aplica
  > a código PHP tocado, no a las directivas del propio archivo.
- **R6 — No cachear datos volátiles.** Las respuestas JSON de precios/activos no se cachean
  (`application/json "access plus 0 seconds"`), por provenir de APIs externas en tiempo casi real.

---

## 7. Criterios de aceptación

```gherkin
Dado el servicio rest_divisas desplegado en Apache
Cuando ejecuto  GET http://localhost/rest_divisas/cripto
Entonces recibo la misma respuesta de health check (200, JSON {"status":"ok",...}) que antes del refactor

Dado el .htaccess refactorizado
Cuando reviso el archivo
Entonces existe un único bloque <IfModule mod_rewrite.c>
  Y el redirect de trailing-slash excluye exactamente cripto, forex, indice, sinteticos, otros
  Y no existen las palabras empresa, persona, usuario, categoria, producto, autenticacion en ese redirect
  Y no existe el comentario placeholder "...resto del código de prevención de ataques existente..."
  Y todas las reglas de rewrite, bloqueos y ErrorDocument usan el prefijo /rest_divisas/

Dado el .htaccess refactorizado
Cuando intento acceder directamente a  http://localhost/rest_divisas/configuracion/global.php
Entonces el acceso queda denegado (no se sirve el contenido del archivo)
  Y lo mismo ocurre para rutas/, modelos/, controladores/ y logs/

Dado que se dispara un error HTTP manejado por Apache (400, 401, 403, 404, 500)
Cuando Apache aplica la directiva ErrorDocument correspondiente
Entonces el archivo errors/<codigo>.html existe y se sirve sin error de "archivo no encontrado"

Dado el manejo de CORS
Cuando el SPA (http://localhost:8100) envía una petición
Entonces los headers Access-Control-* del .htaccess coinciden con los emitidos por CorsConfig
  Y una petición OPTIONS de preflight responde correctamente (sin headers CORS contradictorios)

Dado que este servicio no sirve archivos estáticos y sus datos son volátiles
Cuando reviso el .htaccess
Entonces no existen reglas de anti-hotlinking, ni AddType de css/js, ni entradas de mod_expires para imágenes/pdf
  Y se conserva ExpiresByType application/json "access plus 0 seconds"
```

---

## 8. Tareas técnicas derivadas (alto nivel)

> Detalle línea-por-línea y anclas exactas corresponden al HLT / Task Brief del modo planificación
> (`docs/doc_modo_planificacion.md`). Aquí solo se enumeran las tareas del requerimiento.

- [ ] Consolidar los dos bloques `mod_rewrite` en uno (A1).
- [ ] Unificar el bloqueo de carpetas internas en un mecanismo coherente conservando la denegación (A2, R4).
- [ ] Eliminar reglas de estáticos no aplicables: hotlinking, MIME css/js, expires de imágenes/pdf; conservar expires de JSON (A3, R6).
- [ ] Corregir el redirect de trailing-slash con los dominios reales registrados (`cripto`, `forex`, `indice`, `sinteticos`, `otros`) (A4).
- [ ] Eliminar el comentario placeholder muerto (A5).
- [ ] Crear `errors/400.html`, `401.html`, `403.html`, `404.html`, `500.html` (A6).
- [ ] Sincronizar headers CORS del `.htaccess` con `CorsConfig` (A7, R3).
- [ ] Verificar los criterios de aceptación con `curl` + health check (§7).

---

## 9. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. El `.htaccess` no contiene ninguno de los defectos D1–D7 (salvo el CORS, que se conserva
   sincronizado por decisión de negocio).
2. Todos los criterios de aceptación de §7 se cumplen y se verificaron con el comando exacto.
3. El comportamiento observable de la API (endpoints, códigos HTTP, JSON) es idéntico al previo.
4. Las 5 páginas `errors/*.html` existen.
5. Se respetan las restricciones R1–R6 y las convenciones del repo (`CLAUDE.md`).
