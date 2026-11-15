# HLT-44-v1 — App: oleada 3, dominios `administracion` y `reportes` (HU-002)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-15 (v1) |
| Historia | `docs/Historia_usuario/HU-002-estructura-por-dominios-app.md` (rev. 2) |
| Numeración | HLT-41 → HLT-42 → HLT-43 → **HLT-44-v1 (este)** → HLT-45 → HLT-46 → HLT-47 |
| Proyecto y git | `criterioKellyApp`. Sin backend ni BD. Sin evidencias |
| Agente | `desarrollador-ionic` |
| Depende de | **HLT-43 COMPLETADO**; árbol limpio |
| Entorno | Igual que HLT-41 |
| Estado | Pendiente de ejecución |

> **Reglas de entorno.** Las de HLT-41.

---

## H1 · Propósito

Mover `paginas/administracion/` a `src/app/administracion/` (subdominios `pagos` y `datos-pago`) y `paginas/reportes/` a `src/app/reportes/` (subdominios `analisis`, `operativas` y `compartido`), **sin tocar código**.

---

## H2 · Asignación (se ajusta al mapa aprobado en HLT-41)

| Origen | Destino |
|--------|---------|
| `paginas/administracion/validar-pagos/`, `componentes/{detalle-pago,lista-pagos-pendientes}`, `servicios/administracion-pagos.service.*`, `store/validacion-pagos.store.*`, `modelos/PagoPendiente.modelo.ts`, `configuracion/textos-validacion.ts` | `administracion/pagos/{paginas/validar-pagos,componentes,servicios,store,modelos,configuracion}/` |
| `paginas/administracion/datos-pago/` (página, `componentes/`, `modelos/`, `servicios/`, `store/`, `configuracion/`) | `administracion/datos-pago/{paginas/datos-pago,componentes,modelos,servicios,store,configuracion}/` |
| `paginas/reportes/analisis/`, `componentes/filtro-fechas/`, `servicios/exportarExcel.service.ts` | `reportes/analisis/{paginas/analisis,componentes,servicios}/` (el filtro y la exportación solo los usa `analisis`) |
| `paginas/reportes/operativas/`, `componentes/grafico-estadistico/` | `reportes/operativas/{paginas/operativas,componentes}/` |
| `paginas/reportes/modelos/DetalleOperacion.modelo.ts`, `servicios/reportes.service.ts`, `store/reportesStore.ts` | `reportes/compartido/{modelos,servicios,store}/` |

---

## H3 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Solo reubicar | `git diff` por archivo movido: solo importaciones y rutas |
| RN-02 | Sin pérdida | Mismo nº de archivos; specs movidos con su archivo |
| RN-03 | URLs y guardas | `/validar-pagos`, `/datos-pago`, `/analisis`, `/operativas` y sus guardas (`GuardRoles` [1, 2] para administración, `planGuard` para reportes) sin cambio; clasificación de `permisos-plan.config.ts` y spec R-04 iguales |
| RN-04 | Resultados idénticos | `ng test` igual a la línea base; bundle sin cambio |
| RN-05 | Dependencias | `reportes` solo importa de `configuracion/cuentas` (cuentas y su store) además de `compartidos/`; `administracion` solo de `compartidos/` y de `negocio/suscripcion` si el mapa lo muestra (servicio de pagos), documentado |

---

## H4 · Plan de tareas

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones | solo lectura | — | HLT-43 `COMPLETADO`; `git status` limpio | — |
| T-02 | Mapa y simulación (administración) | JSON temporal, `--simular` | T-01 | Informe sin ambigüedades | RN-01 |
| T-03 | Movimiento y compilación (administración) | `reubicar.mjs`, `tsc` app y spec | T-02 | `--verificar` sin colgantes; `tsc` código 0 | RN-02 |
| T-04 | Mapa y simulación (reportes) | JSON temporal, `--simular` | T-03 | Informe sin ambigüedades | RN-01 |
| T-05 | Movimiento y compilación (reportes) | `reubicar.mjs`, `tsc` app y spec | T-04 | `--verificar` sin colgantes; `tsc` código 0 | RN-02 |
| T-06 | Verificación | `ng lint`, `ng build` (desarrollo y producción), `ng test` | T-05 | RN-03, RN-04 | RN-03, RN-04 |
| T-07 | Dependencias y carpetas | grep, `find` | T-06 | RN-05; sin carpetas vacías | RN-05 |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07.

**Compuerta manual del usuario.** M-01: validar pagos (listar, ver detalle, aprobar y rechazar), datos de pago (redes, QR, PayPal, WhatsApp), `/analisis` (cuenta, rango de fechas) y `/operativas` (lista, gráfico, exportar). Respuesta esperada: «PRUEBA MANUAL HLT-44 OK».

## H5 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Romper la exportación (PDF/Excel) o el gráfico | Media | Solo se mueve; specs existentes; M-01 |
| R-02 | Rutas del menú o de `RUTAS_POR_ROL` | Baja | No cambian las URLs; la spec R-04 las cubre |

## H6 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha C1…C5 como en HLT-41.
