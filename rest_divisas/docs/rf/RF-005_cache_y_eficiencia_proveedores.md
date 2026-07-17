# RF-005 — Caché y eficiencia en llamadas a proveedores externos de `rest_divisas`

> **Tipo:** Refactor / Rendimiento / Resiliencia.
> **Servicio afectado:** `rest_divisas`.
> **Archivos objetivo:** `modelos/ForexMdl.php`, `modelos/CriptoMdl.php`, `modelos/IndiceMdl.php`,
> `controladores/ForexCtrl.php`, `controladores/CriptoCtrl.php`, `configuracion/ClienteHttp.php`,
> `configuracion/global.php`, `.htaccess`.
> **Prioridad:** Alta (riesgo de indisponibilidad propia y de terceros).
> **Estado:** Propuesto.
> **Fecha:** 2026-07-17.
> **Referencia base obligatoria:** `CLAUDE.md`, `docs/doc_arquitectura.md`, `docs/doc_modo_planificacion.md`.
> **Relacionado:** `RF-004_seguridad_duplicidad.md` (ítems S5 y M5, documentados ahí como deuda
> técnica fuera de alcance; este RF los desarrolla y los lleva a implementación).

---

## 1. Historia de usuario

> **Como** desarrollador backend responsable de la disponibilidad de `rest_divisas`,
> **quiero** que el servicio cachee las respuestas de los proveedores externos (Binance,
> Frankfurter, Financial Modeling Prep) y evite patrones de llamadas combinatorias e innecesarias,
> **para** que una petición a `/forex/disponible` no dispare decenas de llamadas salientes ni
> bloquee el worker de PHP varios segundos, que el servicio no agote la cuota diaria de FMP, y que
> el sistema siga respondiendo con datos válidos aunque un proveedor externo esté lento o caído.

---

## 2. Contexto y problema actual

La auditoría de código de `rest_divisas` (fuera de RF-001/002/003/004) detectó que **ninguno de
los tres modelos cachea resultados**: cada request de un cliente al servicio genera peticiones
HTTP frescas y sincrónicas a los proveedores externos. En el caso de Forex esto se agrava por un
patrón combinatorio de llamadas. Defectos verificados:

| # | Defecto detectado | Evidencia | Riesgo |
|---|-------------------|-----------|--------|
| P1 | **Explosión combinatoria de llamadas en Forex.** `getAllMajorForex()` itera cada divisa base contra todas las demás divisas destino, en chunks de 20, con `usleep` entre cada llamada (150 ms por base + 50 ms por chunk). Con ~30 divisas esto genera decenas de peticiones HTTP salientes a Frankfurter y varios segundos de bloqueo **por cada hit** a `/forex/disponible`. | `controladores/ForexCtrl.php:18-78` | ALTO — un worker de PHP queda retenido varios segundos por request; tráfico normal (no necesariamente malicioso) puede agotar el pool de workers y provocar caída del servicio propio |
| P2 | **Amplificación hacia el proveedor externo.** Cada hit a `/forex/disponible` se traduce en decenas de requests a Frankfurter. Sin límite propio, esto puede provocar que Frankfurter aplique rate-limit o bloqueo temporal a la IP del servidor, afectando a todos los consumidores del servicio. | `controladores/ForexCtrl.php:44-45` | ALTO — indisponibilidad del proveedor para todo el servicio, no solo para el cliente que abusó |
| P3 | **Sin caché en ningún modelo.** `CriptoMdl`, `ForexMdl` e `IndiceMdl` llaman siempre en vivo, sin TTL. FMP (plan gratuito) tiene cuota diaria de llamadas; sin caché, tráfico moderado puede agotarla y dejar `/indice` respondiendo 502 (`ProveedorNoDisponibleException`) el resto del día. | `modelos/CriptoMdl.php`, `modelos/ForexMdl.php`, `modelos/IndiceMdl.php` | ALTO — indisponibilidad de `/indice` por agotamiento de cuota, no por error real |
| P4 | **Descarga completa del ticker de Binance sin filtrar en origen.** `CriptoCtrl::getCryptos()` pide el ticker de **todos** los pares de Binance (miles de símbolos) y filtra en PHP solo los que terminan en `USDT`/`BUSD`. Se transfiere y decodifica en memoria un payload varias veces más grande de lo necesario en cada request. | `controladores/CriptoCtrl.php:17-32` | MEDIO — desperdicio de ancho de banda y memoria por request, mayor latencia |
| P5 | **Sin degradación controlada ante fallo de proveedor.** Si un proveedor falla, el endpoint responde 502 sin dato alguno, aunque exista una respuesta previa reciente que podría servirse como último recurso (`stale-while-error`). | `configuracion/ClienteHttp.php:23-35`, todos los `Ctrl` | MEDIO — menor disponibilidad percibida por el frontend |

Estos hallazgos corresponden a los ítems **S5** (sin autenticación ni rate limiting) y **M5** (sin
capa de caché) que `RF-004` documentó explícitamente como deuda técnica fuera de su alcance. Este
RF los toma como base y los lleva a diseño e implementación.

---

## 3. Objetivo del refactor

1. Introducir una capa de caché con TTL corto para las tres fuentes de datos (cripto, forex,
   índices), reduciendo drásticamente las llamadas salientes por request de cliente.
2. Eliminar el patrón combinatorio de llamadas en `ForexCtrl`, sustituyéndolo por una estrategia
   que obtenga las tasas necesarias con el menor número de requests posible.
3. Reducir el payload solicitado a Binance a los símbolos relevantes (`USDT`/`BUSD`) cuando la API
   lo permita, o cachear el resultado completo para evitar refetch constante.
4. Definir un comportamiento de degradación controlada: si el proveedor falla y existe una copia
   en caché (aunque expirada), servirla en vez de devolver 502 directo.
5. Documentar (sin implementar en este RF) autenticación/rate-limiting propio como deuda futura.

---

## 4. Alcance (in-scope)

- **A1. Capa de caché basada en archivo o APCu.** Crear un mecanismo simple (`CacheProveedor` o
  similar) con `obtener($clave)`, `guardar($clave, $valor, $ttlSegundos)`, usado por los tres `Mdl`.
  TTL configurable por variable de entorno (`CACHE_TTL_CRIPTO`, `CACHE_TTL_FOREX`,
  `CACHE_TTL_INDICE`), con valores por defecto razonables (p. ej. 30–60 s).
- **A2. Cachear `CriptoMdl::obtenerTicker24h()`, `ForexMdl::obtenerDivisas()`/`obtenerTasas()` e
  `IndiceMdl::obtenerIndices()`.** Cada llamada primero consulta la caché; solo golpea el
  proveedor externo si expiró o no existe.
- **A3. Rediseñar `ForexCtrl::getAllMajorForex()`.** Evaluar y aplicar la alternativa de menor
  costo: (a) una sola llamada a `/latest` sin `from`/`to` para obtener tasas base-EUR y derivar
  cruces matemáticamente en PHP, o (b) cachear el resultado combinatorio completo con TTL propio
  para que el costo de N×M solo se pague una vez por ventana de tiempo, no por request.
- **A4. Filtrar el payload de Binance.** Si la API de Binance soporta parámetro de símbolos,
  usarlo; si no, mantener la descarga completa pero servida desde caché (A2) en vez de en vivo.
- **A5. Degradación ante fallo de proveedor (`stale-if-error`).** Si `ClienteHttp::obtenerJson()`
  lanza `ProveedorNoDisponibleException` y existe una entrada en caché (aunque expirada), el
  modelo la retorna en vez de propagar la excepción; solo se responde 502 si no hay ninguna copia
  utilizable.
- **A6. Eliminar números mágicos de `usleep` si el rediseño de A3 los vuelve innecesarios**, o
  documentarlos con constante y comentario si se conservan.

---

## 5. Fuera de alcance (out-of-scope)

- **No** se implementa autenticación JWT ni autorización por rol (ver `CLAUDE.md`, sección JWT).
- **No** se implementa rate-limiting por IP/consumidor sobre los endpoints propios del servicio.
- **No** se cambia el contrato de datos de respuesta de ningún endpoint (mismos campos, mismo
  formato).
- **No** se introduce Redis, Memcached ni infraestructura externa de caché; se usa archivo local o
  APCu, disponibles sin dependencias adicionales.
- **No** se modifica `RF-001`, `RF-002`, `RF-003` ni `RF-004`; este RF es posterior y acumulativo.

---

## 6. Reglas de negocio y restricciones

- **R1 — Funcionalidad observable preservada.** Los endpoints `/cripto/disponible`,
  `/forex/disponible`, `/forex` (health/listado de divisas) e `/indice/disponible` devuelven el
  mismo contrato de datos que antes de este refactor.
- **R2 — TTL configurable, nunca hardcodeado sin constante.** Todo TTL de caché se define como
  constante en `global.php`, con posibilidad de override por variable de entorno.
- **R3 — Ningún endpoint depende de sincronizar más de una llamada externa por combinación de
  divisas en tiempo real de request.** El costo combinatorio de Forex se paga como máximo una vez
  por ventana de TTL, no una vez por request de cliente.
- **R4 — Degradación explícita y registrada.** Cuando se sirve una copia de caché expirada por
  fallo del proveedor (`stale-if-error`), se registra con `error_log()` para trazabilidad, sin
  exponer detalles internos al cliente.
- **R5 — Sin secretos ni URLs completas en logs de caché.** Las claves de caché no incluyen la
  API key de FMP ni URLs completas (reutilizar el criterio ya aplicado en `ClienteHttp`).

---

## 7. Criterios de aceptación

```gherkin
Dado el código refactorizado
Cuando solicito GET /rest_divisas/indice/disponible dos veces dentro del TTL configurado
Entonces la segunda respuesta se sirve desde caché
  Y no se realiza una segunda llamada HTTP a Financial Modeling Prep

Dado el código refactorizado
Cuando solicito GET /rest_divisas/cripto/disponible dos veces dentro del TTL configurado
Entonces la segunda respuesta se sirve desde caché
  Y no se realiza una segunda llamada HTTP a Binance

Dado el código refactorizado
Cuando solicito GET /rest_divisas/forex/disponible
Entonces el número de llamadas HTTP salientes a Frankfurter para atender ese request
  es sensiblemente menor al patrón combinatorio original (N bases x M destinos)

Dado el código refactorizado
Cuando solicito GET /rest_divisas/forex/disponible dos veces dentro del TTL configurado
Entonces la segunda respuesta se sirve desde caché
  Y no se repite el costo combinatorio de la primera llamada

Dado el código refactorizado
Cuando el proveedor externo de un dominio falla (simulado) y existe una copia previa en caché
Entonces el endpoint correspondiente responde 200 con los últimos datos válidos conocidos
  Y se registra en logs que se sirvió una copia stale por fallo de proveedor

Dado el código refactorizado
Cuando el proveedor externo falla y no existe ninguna copia en caché
Entonces el endpoint responde 502 con el mensaje genérico existente
  (comportamiento actual preservado como último recurso)

Dado el código refactorizado
Cuando reviso configuracion/global.php
Entonces existen constantes de TTL de caché para cripto, forex e índices
  Y son configurables vía variable de entorno con valor por defecto

Dado el código refactorizado
Cuando reviso los tres endpoints de datos
Entonces el contrato de respuesta (campos, formato de precio, tipo) es idéntico al actual
```

---

## 8. Tareas técnicas derivadas (alto nivel)

- [ ] Diseñar e implementar una clase/módulo de caché simple (archivo o APCu) reutilizable por los
      tres `Mdl` (A1).
- [ ] Integrar caché en `CriptoMdl::obtenerTicker24h()` (A2, A4).
- [ ] Integrar caché en `ForexMdl::obtenerDivisas()` y `obtenerTasas()` (A2).
- [ ] Integrar caché en `IndiceMdl::obtenerIndices()` (A2).
- [ ] Rediseñar `ForexCtrl::getAllMajorForex()` para eliminar o amortiguar el patrón combinatorio
      N×M (A3).
- [ ] Implementar degradación `stale-if-error` en los modelos ante
      `ProveedorNoDisponibleException` (A5).
- [ ] Definir constantes de TTL en `global.php`, configurables por entorno (R2).
- [ ] Revisar y, si aplica, eliminar/renombrar los `usleep` de `ForexCtrl` según el rediseño (A6).
- [ ] Verificar todos los criterios de aceptación con `curl` y mediciones de número de llamadas
      salientes (§7).

---

## 9. Definición de Hecho (Definition of Done)

El requerimiento está "hecho" solo si:

1. Los tres modelos (`CriptoMdl`, `ForexMdl`, `IndiceMdl`) sirven datos desde caché cuando el TTL
   configurado no ha expirado.
2. El endpoint `/forex/disponible` ya no ejecuta el patrón combinatorio completo de llamadas en
   cada request de cliente; el costo se amortigua entre ventanas de TTL.
3. Existe degradación `stale-if-error`: ante fallo del proveedor, se sirve la última copia válida
   en caché en lugar de un 502 inmediato, siempre que exista dicha copia.
4. Los TTL de caché son configurables desde `global.php` / variables de entorno, sin valores
   mágicos sueltos en el código.
5. El contrato de datos de los tres endpoints (`/cripto`, `/forex`, `/indice`) permanece idéntico
   al estado previo a este refactor.
6. Los criterios de aceptación de §7 se cumplieron y verificaron.
7. Se respetan las restricciones R1–R5 y las convenciones del repo (`CLAUDE.md`).
8. Queda documentado como deuda técnica pendiente (no resuelta en este RF) la implementación de
   autenticación JWT y rate-limiting propio sobre los endpoints del servicio.
