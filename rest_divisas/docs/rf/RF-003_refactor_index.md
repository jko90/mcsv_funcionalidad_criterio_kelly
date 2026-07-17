# RF-003 — Refactor del Front Controller `index.php` de `rest_divisas`

> **Tipo:** Refactor / Seguridad / Deuda técnica.
> **Servicio afectado:** `rest_divisas` (único archivo: `index.php`).
> **Archivo objetivo:** `index.php` (Front Controller).
> **Prioridad:** Media.
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `RF-002_refactor_codigo_backend.md` (refactor de capas `Rts→Ctrl→Mdl`).

---

## 1. Historia de usuario

> **Como** desarrollador backend del servicio `rest_divisas`,
> **quiero** que el Front Controller `index.php` sea un punto de entrada mínimo, seguro y
> eficiente, sin código ajeno a su función de enrutamiento,
> **para** reducir la superficie de ataque, eliminar la exposición de información corporativa en
> un endpoint de API, y evitar el ruteo impreciso que podría matchear rutas no intencionadas.

---

## 2. Contexto y problema actual

`index.php` es el Front Controller del microservicio: toda petición HTTP entra por él. Tras el
refactor RF-002 (capa `Mdl`, despacho común en `BaseCtrl`), los `Rts` quedaron reducidos a una
línea y los controladores delegan en modelos. Sin embargo, `index.php` no se modificó y presenta
los siguientes defectos verificados:

| # | Defecto detectado | Evidencia en el código |
|---|-------------------|------------------------|
| D1 | **Ruteo con `strpos` no exacto.** `strpos($requestUri, $patron)` matchea el patrón en cualquier posición de la URI. Una ruta como `/cripto-extrano`, `/criptoadicional` o `/api/cripto` también matchearía `/cripto`, pudiendo enrutar peticiones no intencionadas al handler incorrecto. | `index.php:40` (`strpos($requestUri, $patron) !== false`). |
| D2 | **Landing page corporativa dentro del Front Controller.** El 85% del archivo (~380 líneas) es la función `mostrarPaginaAnuncio()` con HTML, CSS y enlaces a CDN. No aporta a la funcionalidad de la API, incrementa el peso del archivo y expone datos corporativos (nombre, email, teléfono) en un endpoint de backend. | `index.php:65-448`. |
| D3 | **Carga de recurso CDN externo.** La landing page incluye `font-awesome` desde cdnjs sin integridad SRI (`integrity` hash), lo que introduce una dependencia externa sin verificar. | `index.php:76` (`<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"`). |
| D4 | **Rutas a `MarketsRts.php` inexistente.** Los prefijos `/sinteticos` y `/otros` apuntan a un archivo que no existe, provocando una respuesta 500 en lugar de 404. Defecto preexistente, documentado en RF-002 §5 como fuera de alcance. | `index.php:33-34`. |
| D5 | **Información corporativa servida desde un microservicio API.** Un GET a la raíz con `Accept: text/html` devuelve nombre de empresa, email de contacto, teléfono y lista de tecnologías. Esta información no debería estar disponible desde un endpoint de API backend. | `index.php:338-443`. |
| D6 | **Manejo inconsistente del 404.** Si no hay ruta encontrada, la respuesta incluye `"fecha"` como clave, mientras que otros endpoints del servicio usan `"timestamp"`. | `index.php:61-62` vs `index.php:49`. |

---

## 3. Objetivo del refactor

Transformar `index.php` en un Front Controller mínimo, seguro y eficiente que:

1. Use ruteo exacto (prefijo anclado) en lugar de `strpos` para evitar matcheos no intencionados.
2. Elimine o externalice la landing page corporativa, separando la responsabilidad de presentación del enrutamiento de la API.
3. Elimine dependencias CDN externas sin verificación SRI.
4. Normalice las claves de las respuestas de error (`timestamp` consistente).
5. Documente apropiadamente las rutas rotas (`/sinteticos`, `/otros`) como hallazgo.

---

## 4. Alcance (in-scope)

- **A1. Reemplazar `strpos` por ruteo con prefijo anclado.** Usar `preg_match` con patrón anclado al inicio (`#^/cripto(/|$)#`) o `strncmp`/`str_starts_with` para garantizar que solo rutas que comienzan con el prefijo matcheen.
- **A2. Extraer la landing page a un archivo separado.** Mover `mostrarPaginaAnuncio()` y todo su HTML/CSS a un archivo independiente (p. ej. `vistas/landing.php` o `landing.php`), manteniendo en `index.php` solo el `require_once` condicional.
- **A3. Eliminar o reemplazar la dependencia CDN.** Si la landing page se conserva, cargar Font Awesome localmente o añadir atributo `integrity` con SRI. Si se elimina, eliminar también la dependencia CDN.
- **A4. Normalizar claves en respuesta 404.** Usar `timestamp` en lugar de `fecha` para consistencia con el resto del servicio.
- **A5. Manejar `/sinteticos` y `/otros` con 404 en lugar de 500.** Si `MarketsRts.php` no existe, responder 404 en lugar de 500, o eliminar las entradas del mapa de rutas (el 404 genérico de línea 56 las capturaría).

---

## 5. Fuera de alcance (out-of-scope)

- **No** se implementa la funcionalidad de `/sinteticos` ni `/otros` (crear `MarketsRts.php` es funcionalidad nueva).
- **No** se implementa autenticación JWT, rate limiting ni caché.
- **No** se modifica el `CorsConfig.php` ni el `.htaccess`.
- **No** se cambia la lógica de los `Rts`, `Ctrl` ni `Mdl` (ya refactorizados en RF-002).
- **No** se migra a Composer, autoloading PSR-4 ni framework.

---

## 6. Reglas de negocio y restricciones

- **R1 — Funcionalidad observable preservada.** Los endpoints existentes (`/cripto`, `/forex`, `/indice` y sus acciones) funcionan exactamente igual que antes. El health-check y los datos de cada dominio no se ven afectados.
- **R2 — Ruteo exacto hacia adelante.** El nuevo mecanismo de ruteo debe seguir soportando acciones como `/cripto/disponible` (el segmento posterior al prefijo se parsea en el `Rts`/`Ctrl`).
- **R3 — CORS y OPTIONS intactos.** Las llamadas `CorsConfig::configurar()` y `CorsConfig::manejarPreflight()` deben ejecutarse antes del ruteo, como hoy.
- **R4 — La raíz sigue siendo accesible.** Un GET a la raíz del servicio debe responder algo útil (sea la landing page externalizada o un JSON de estado mínimo), sin romper el comportamiento esperado.
- **R5 — Sin dependencias externas no verificadas.** Cualquier recurso CDN debe incluir verificación SRI o ser servido localmente.
- **R6 — Consistencia en claves de respuesta.** Todas las respuestas de error usan `timestamp` como clave de fecha (no `fecha`).

---

## 7. Criterios de aceptación

```gherkin
Dado index.php refactorizado
Cuando solicito GET /rest_divisas/cripto
Entonces recibo 200 con el health-check de CriptoRTS
  Y funciona igual que antes del refactor

Dado index.php refactorizado
Cuando solicito GET /rest_divisas/cripto/disponible
Entonces recibo 200 con datos de criptomonedas
  Y funciona igual que antes del refactor

Dado index.php refactorizado
Cuando solicito GET /rest_divisas/cripto-extrano
Entonces NO matchea la ruta /cripto
  Y recibo 404 "Endpoint no encontrado"

Dado index.php refactorizado
Cuando solicito GET /rest_divisas/forex/disponible
Entonces recibo 200 con datos forex
  Y funciona igual que antes del refactor

Dado index.php refactorizado
Cuando solicito GET /rest_divisas/indice/disponible
Entonces recibo 200 con datos de índices
  Y funciona igual que antes del refactor

Dado index.php refactorizado
Cuando reviso index.php
Entonces no contiene la función mostrarPaginaAnuncio() inline
  Y el ruteo usa coincidencia exacta de prefijo (no strpos)
  Y las claves de error usan "timestamp" (no "fecha")

Dado index.php refactorizado
Cuando solicito GET /rest_divisas/
Entonces recibo una respuesta (HTML o JSON) sin errores
  Y no falla por archivos faltantes

Dado index.php refactorizado
Cuando solicito GET /rest_divisas/sinteticos
Entonces recibo 404 (no 500)
```

---

## 8. Tareas técnicas derivadas (alto nivel)

- [ ] Reemplazar `strpos` por ruteo con prefijo anclado (`preg_match`, `str_starts_with` o `strncmp`) (A1).
- [ ] Extraer `mostrarPaginaAnuncio()` a archivo separado (p. ej. `vistas/landing.php`) (A2).
- [ ] Eliminar dependencia CDN sin SRI o añadir `integrity` hash (A3).
- [ ] Normalizar clave `fecha` → `timestamp` en la respuesta 404 genérica (A4).
- [ ] Manejar rutas a `MarketsRts.php` inexistente con 404 en lugar de 500 (A5).
- [ ] Verificar todos los criterios de aceptación con `curl` (§7).

---

## 9. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. `index.php` usa ruteo exacto de prefijo; rutas como `/cripto-extrano` no matchean `/cripto`.
2. La landing page no está inline en `index.php`; está externalizada a su propio archivo.
3. No hay dependencias CDN externas sin verificación SRI.
4. Todas las respuestas de error usan `timestamp` consistente.
5. Las rutas rotas (`/sinteticos`, `/otros`) responden 404 en lugar de 500.
6. Los criterios de aceptación de §7 se cumplieron y verificaron con `curl`.
7. Los endpoints existentes (`/cripto`, `/forex`, `/indice`) funcionan idéntico a antes del refactor.
8. Se respetan las restricciones R1–R6 y las convenciones del repo (`CLAUDE.md`).
