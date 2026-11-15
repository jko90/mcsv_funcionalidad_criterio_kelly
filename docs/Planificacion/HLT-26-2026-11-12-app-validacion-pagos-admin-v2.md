# HLT-26-v2 — App: opción de menú «Validar pagos» por rol y ventana de administración (HU-005 rev. 3: «Ventana de administración», C-01…C-07)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; revisado el 2026-11-13 por DT-16) |
| Historia | `docs/Historia_usuario/HU-005-control-por-plan-comprobante-y-administracion.md` (rev. 3), propuesta §2 y criterios **C-01…C-07**; DN-05 |
| Numeración | Vigentes: HLT-15-v2 · HLT-16-v4 · HLT-17-v4 · HLT-18 · HLT-19-v2 · HLT-20-v2 · HLT-21-v2 · HLT-24-v2 · HLT-25-v2 · **HLT-26-v2 (este)** · HLT-27-v2 · HLT-28-v2 |
| Proyecto y git | `criterioKellyApp` (git propio) y `docs/Planificacion/evidencias/` |
| Agente | `desarrollador-ionic` en todas las tareas |
| Depende de | **HLT-17-v4 COMPLETADO** (`pagos/pendientes`, `pagos/comprobante`, `pagos/confirmar`, `pagos/rechazar` con `motivo` guardado en el historial, 409 sin comprobante) y **HLT-20-v2 COMPLETADO** (`permisos-plan.config.ts`, `plan.guard.ts`, spec R-04). Se comprueba en T-01 |
| Lo consume | HLT-28-v2 (prueba manual) |
| Entorno | Ionic 8 / Angular 20 / NgRx Signals |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 5) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) MySQL/Apache intocables. (2) Commits del usuario; hash = `➖`. (3) Sin reportes `.md` en `evidencias/`. (4) Cuentas `ck_prueba_hu5_*` (dueños y administradores distintos). (5) La autorización real es la del servidor; la app solo oculta y redirige. (6) Un administrador **nunca** confirma ni rechaza su propio pago: la app no muestra los botones y el servidor lo rechaza. (7) Ni la cédula ni el correo se muestran (el listado no los trae; la app no los pide).

---

## H1 · Propósito

**Requerimiento literal (HU-005 rev. 2).** «Opción de menú **«Validar pagos»**, visible solo para roles 1 y 2. La app la muestra según los roles que devuelve el servidor, y la ruta tiene un guarda por rol; aun así, **la autorización real es la del servidor** (401/403 de HLT-17). Listado de pagos en revisión (`pagos/pendientes`, paginado) […]. La **cédula y el correo no se muestran completos**. Al abrir un pago se pide su comprobante (`pagos/comprobante`) y se muestra la imagen ampliable. Botones **Aprobar** y **Rechazar** con confirmación; rechazar pide un motivo (DN-05). En los pagos propios (`esPropio`) no aparecen los botones. Tras aprobar o rechazar, el pago desaparece del listado. Un 409 (ya procesado por otro administrador) se informa y se refresca la lista.» · **C-01…C-07**.

**Propósito.** Que los administradores validen comprobantes desde la app.

**Resultado esperado (observable).**
1. Con rol 1 o 2 el menú lateral y el del inicio muestran «Validar pagos»; con otros roles no aparece.
2. `/validar-pagos` con un rol sin permiso redirige a `/inicio`; con permiso lista los pagos `R` (20 por página, «Cargar más» con `desde`).
3. Al tocar un pago: detalle con la **fecha de subida**, si es **pago anticipado** y las **fechas resultantes** («Si apruebas, el plan corre desde el <inicio> hasta el <corte>»; anticipado: «Pago anticipado: el nuevo periodo empezará el <inicio> y terminará el <corte>; el plan actual no se toca»), comprobante ampliable (o «Sin comprobante» y Aprobar deshabilitado), y botones solo si `esPropio === false`. Con `esAntiguo`, aviso «Este comprobante es demasiado antiguo: su fecha de corte ya pasó», Aprobar deshabilitado y Rechazar con el motivo precargado «El comprobante es demasiado antiguo; suba uno nuevo».
4. Aprobar → confirmación → `pagos/confirmar` → sale de la lista y toast «Pago aprobado». Rechazar → alerta con motivo (5…256) → `pagos/rechazar` → sale de la lista.
5. 409 → toast con el mensaje del servidor y recarga de la lista; 403 → mensaje del interceptor.

**Fuera de alcance.** Gestión de usuarios y roles; búsqueda o filtros del listado; pagos ya resueltos; cambiar el backend; notificaciones.

**Feature(s) afectada(s).** `src/app/paginas/administracion/` (nueva: `validar-pagos/`, `componentes/`, `servicios/`, `store/`, `modelos/`), `src/app/compartidos/seguridades/GuardRoles.ts`, `src/app/compartidos/modelos/menu.ts`, `src/app/compartidos/store/menu.store.ts`, `src/assets/datos/menu.json`, `src/app/app.routes.ts`, `src/app/paginas/suscripcion/configuracion/permisos-plan.config.ts`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Menú por rol | `Menu` (`compartidos/modelos/menu.ts:1-5`) gana `roles?: number[]`; `menu.json` añade `{"icon":"shield-checkmark-outline","name":"Validar pagos","redirectTo":"/validar-pagos","roles":[1,2]}`; el computed `listaMenu` de `MenuStore` (`menu.store.ts:29`) filtra con `SesionStore.roles()` (`sesion.store.ts:48`); los elementos sin `roles` siguen visibles para todos; `app.component.html:24` e `inicio.page.html:10`, que pintan `gruposMenu()` a partir de `listaMenu`, no cambian | C-01 |
| RN-02 | Guarda por rol | Ruta `validar-pagos` con `GuardAutenticacion` y `GuardRoles` (`data: {roles: [1, 2], requireAll: false}`); `GuardRoles` (`GuardRoles.ts`) redirige a `/inicio` en lugar de `/acceso-denegado`, que no existe (ruta comentada en `app.routes.ts:173-197` y sin carpeta en `paginas/util/`) | C-01 |
| RN-03 | Fuera del control de plan | `'/validar-pagos'` va en una lista nueva `RUTAS_POR_ROL` de `permisos-plan.config.ts`, que el guarda de plan permite siempre; la spec R-04 de HLT-20 acepta las tres listas | Continuidad HU-004 |
| RN-04 | Listado | `GET pagos/pendientes?limite=20&desde=<menor id cargado>`; muestra `usuario`, `pla_nombre`, `ins_nombre`, `pag_monto pag_moneda`, `pag_metodoPago`, `pag_idTransac`, `pag_fechaPago`, «Con comprobante»/«Sin comprobante»; «Cargar más» solo si la última página trajo 20 | C-02 |
| RN-05 | Comprobante | Se pide al abrir el detalle (`GET pagos/comprobante?pag_idPago=N`), nunca en el listado; `<img [src]>` con el `data:image/…` (sin `bypassSecurityTrust*`); 404 → «Sin comprobante» | C-03 |
| RN-06 | Aprobar | Botón deshabilitado sin comprobante, con `esPropio` o con `esAntiguo`; `AlertController` «¿Aprobar el pago de <usuario> por <monto>? El plan correrá desde el <fechaInicioResultante> hasta el <fechaCorteResultante>» → `POST pagos/confirmar {"pag_idPago":N}` → quitar de la lista y toast «Pago aprobado» | C-04, C-06 |
| RN-07 | Rechazar | `AlertController` con `textarea` «Motivo del rechazo» (con `esAntiguo`, precargado con «El comprobante es demasiado antiguo; suba uno nuevo»); botón «Rechazar» valida 5…256 caracteres en la app → `POST pagos/rechazar {"pag_idPago":N,"motivo":"…"}` → quitar de la lista y toast «Pago rechazado» | C-05, DN-05 |
| RN-08 | Pagos propios | Con `esPropio === true` no se renderizan Aprobar ni Rechazar y se muestra «No puedes validar tu propio pago» | C-06 |
| RN-09 | Concurrencia | 409 → el interceptor muestra el mensaje del servidor y el store recarga la primera página; 403 → mensaje del interceptor, sin recargar | C-07 |
| RN-10 | Arquitectura | `ValidacionPagosStore` (`rxMethod`, pipeline estándar); `AdministracionPagosService` solo HTTP; `ListaPagosPendientesComponent` y `DetallePagoComponent` presentacionales (sin `inject`); la página orquesta y usa `AlertController` | desarrollador-ionic |
| RN-11 | Fechas del periodo (DT-16) | La ventana muestra `pag_fechaPago` (fecha de subida) y, tal como las entrega el servidor (RN-14 de HLT-17-v4), `esAnticipado`, `fechaInicioResultante` y `fechaCorteResultante`; con `esAnticipado` dice «Pago anticipado: el nuevo periodo empezará el <inicio> y terminará el <corte>» y Aprobar sigue habilitado; sin él, «Si apruebas, el plan corre desde el <inicio> hasta el <corte>»; con fechas `null` (el dueño tiene un plan presente de otra combinación) avisa «El dueño tiene otro plan de pago activo; el servidor no permitirá aprobarlo» y Aprobar queda deshabilitado; nunca calcula fechas con el reloj del dispositivo; `esAntiguo` lo decide el servidor; un 409 del servidor (`El comprobante es demasiado antiguo; suba uno nuevo`, `Ya tiene un periodo siguiente pagado y programado`, otra combinación) se muestra con su mensaje y la lista se recarga | DT-16 |

---

## H3 · Flujo principal de ejecución

```
Menú (MenuStore.listaMenu filtrado por rol) ── rol 1/2 ──▶ '/validar-pagos' (GuardAutenticacion → GuardRoles [1,2] → plan.guard: RUTAS_POR_ROL permite)
ValidarPagosPage
  ngOnInit → ValidacionPagosStore.cargarPendientes() ─▶ GET pagos/pendientes?limite=20
  ListaPagosPendientesComponent [pagos] (seleccionar) ─▶ store.seleccionar(pago) → cargarComprobante ─▶ GET pagos/comprobante
  DetallePagoComponent [pago] [comprobante] (aprobar) (rechazar)
     aprobar  → AlertController → store.aprobar(id)            ─▶ POST pagos/confirmar
     rechazar → AlertController(textarea) → store.rechazar(id, motivo) ─▶ POST pagos/rechazar
        200 → quitar de la lista + toast │ 409 → interceptor + recargar │ 403 → interceptor
```

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Prueba |
|--------------------|--------|--------|
| C-01 / RN-01…RN-03 | T-07, T-08, T-09 | `menu.store.spec.ts`, `GuardRoles.spec.ts`, `permisos-plan.config.spec.ts` |
| C-02 / RN-04 | T-03, T-04, T-05 | `validacion-pagos.store.spec.ts` (VP-01…VP-03) |
| C-03 / RN-05 | T-04, T-06 | VP-04, `detalle-pago.component.spec.ts` |
| C-04, C-05 / RN-06, RN-07 | T-04, T-06, T-07 | VP-05, VP-06, `validar-pagos.page.spec.ts` |
| C-06 / RN-08 | T-06 | `detalle-pago.component.spec.ts` |
| C-07 / RN-09 | T-04 | VP-07 |
| DT-16 / RN-11, RN-06, RN-07 | T-02, T-04, T-06, T-07 | VP-08, VP-09, `detalle-pago.component.spec.ts` |

### Discrepancias HU ↔ código
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | «La cédula y el correo no se muestran completos» | `pagos/pendientes` no devuelve cédula ni correo (RN-14 de HLT-17) | No se muestran en absoluto; se muestra `usuario` |
| C-2 | Guarda por rol | `GuardRoles` existe pero redirige a `/acceso-denegado`, ruta comentada | RN-02 |
| C-3 | Menú por rol | `menu.json` y `Menu` no tienen roles (`menu.service.ts:12`) | RN-01 |
| C-4 | El administrador también puede estar sin plan | El guarda de plan bloquearía `/validar-pagos` | RN-03 |

### Checklist de calidad del HLT
- [x] 11 secciones · [x] sin marcadores · [x] cobertura 100 % · [x] criterios verificables · [x] respeta `criterioKellyApp/CLAUDE.md` y `desarrollador-ionic.md` · [x] referencias leídas el 2026-11-12 · [x] decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Redirección de `GuardRoles` | A) crear `acceso-denegado`; B) `/inicio` | **B** | RD-7; ninguna ruta activa usa hoy `GuardRoles` | No |
| D-02 | Filtrar el menú | A) en el JSON servido; B) computed en `MenuStore` | **B** | `menu.json` es estático; la decisión sale de los roles de la sesión | No |
| D-03 | Ubicación | `paginas/administracion/` (nombre ya previsto en la ruta comentada) | cerrada | Coherente con el código existente | No |
| D-04 | Tamaño de página | 20 (defecto de RN-14 de HLT-17) | cerrada | | No |

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1…10 | Entendimiento, reglas, impacto, arquitectura, riesgos, simplicidad, seguridad, cobertura, determinismo, ejecutabilidad | ✅ | |

**Ataques considerados.** *Suscriptor que escribe `/validar-pagos`:* `GuardRoles` → `/inicio`; si llama a la API, 403 (HLT-17). *Rol manipulado en el dispositivo:* el servidor decide con los roles de la base (RN-01 de HLT-17). *Aprobar el pago propio desde la consola:* 403 del servidor. *Imagen con script:* solo `data:image/*` en `<img>`; Angular sanea la URL. *Doble clic en Aprobar:* el store marca `procesando` y el servidor responde 409 al segundo.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Colusión entre dos administradores | Media | Riesgo residual de HLT-17; auditoría `PAGO_CONFIRMADO` con el administrador |
| R-02 | Comprobantes grandes lentos en móvil | Baja | Uno por vez (RN-05) |

**Rondas.** *Ronda 1 — CON CAMBIOS:* `GuardRoles` redirigía a una ruta inexistente (C-2); el guarda de plan bloqueaba al administrador sin plan (C-4). *Ronda 2 — APROBADO.* *Ronda 3 (v2) — APROBADO:* solo cambian las dependencias (HLT-23 ANULADO → HLT-17-v4; HLT-20 → HLT-20-v2); el contrato que consume la ventana no cambia. **Veredicto: APROBADO.**
*Ronda 4 (DT-16, 2026-11-13) — APROBADO.* El listado trae `fechaCorteResultante` y `esAntiguo` (16 campos) para que el administrador vea desde cuándo corre el plan antes de aprobar y no apruebe un comprobante que el servidor rechazaría (RN-11, VP-08); el rechazo con motivo precargado libera a la persona para subir otro (HLT-17-v4 C-11). Ataque: *administrador aprueba a ciegas un comprobante viejo* → botón deshabilitado y 409 del servidor como respaldo.
*Ronda 5 (DT-16 con su alcance, 2026-11-13) — APROBADO.* El listado añade `esAnticipado` y `fechaInicioResultante` (18 campos) para que el administrador distinga el primer corte (corre desde la subida) del pago anticipado (empieza tras el corte presente) y vea el periodo exacto antes de aprobar (RN-11, VP-09). Ataque: *aprobar un anticipado creyendo que corre desde la subida* → el texto dice cuándo empieza.

---

## H7 · Plan de tareas

Todas `desarrollador-ionic`. `A` = `criterioKellyApp/src/app`, `AD` = `A/paginas/administracion`, `EV` = `docs/Planificacion/evidencias`.

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | `EV/HLT-26/antes/*.txt` | — | HLT-17-v4 y HLT-20-v2 `COMPLETADOS` (`curl` con token de un administrador fixture a `pagos/pendientes` → 200; `pagos/rechazar` sin `motivo` → 400); línea base de `ng lint`, `ng test`, `ng build` | — |
| T-02 | Modelos | `AD/modelos/PagoPendiente.modelo.ts` (nuevo) | T-01 | `PagoPendiente` con los 18 campos de RN-14 de HLT-17-v4 (incluye `esAnticipado`, `fechaInicioResultante`, `fechaCorteResultante` y `esAntiguo`); `ComprobantePago {pag_idPago, comprobante}`; `ConfirmacionPago` y `RechazoPago` con las respuestas de H3 de HLT-17-v4 | RN-04 |
| T-03 | Servicio | `AD/servicios/administracion-pagos.service.ts`, `…spec.ts` (nuevos) | T-02 | `obtenerPendientes(limite, desde?)`, `obtenerComprobante(id)`, `confirmar(id)`, `rechazar(id, motivo)` con URL, método y cuerpo exactos; spec verde | RN-04…RN-07 |
| T-04 | Store | `AD/store/validacion-pagos.store.ts`, `…spec.ts` (nuevos) | T-03 | Estado `pagos`, `seleccionado`, `comprobante`, `cargando`, `procesando`, `hayMas`; `rxMethod` `cargarPendientes`, `cargarMas`, `seleccionar`, `aprobar`, `rechazar`; specs VP-01…VP-09 verdes | RN-04…RN-09 |
| T-05 | Componente de lista | `AD/componentes/lista-pagos-pendientes/…{ts,html,scss,spec.ts}` (nuevos) | T-02 | Presentacional; `input` `pagos`, `hayMas`; `output` `seleccionar`, `cargarMas`; spec | RN-04 |
| T-06 | Componente de detalle | `AD/componentes/detalle-pago/…{ts,html,scss,spec.ts}` (nuevos) | T-02 | Presentacional; `input` `pago`, `comprobante`, `procesando`; `output` `aprobar`, `rechazar`; RN-05, RN-08 (botones ausentes con `esPropio`), RN-11 (fecha de subida, corte resultante, aviso y Aprobar deshabilitado con `esAntiguo`); imagen ampliable con `ion-modal`; spec cubre propio, sin comprobante, antiguo y normal | RN-05, RN-06, RN-08 |
| T-07 | Página | `AD/validar-pagos/validar-pagos.page.{ts,html,scss,spec.ts}` (nuevos) | T-04, T-05, T-06 | Orquesta store y componentes; alertas de RN-06 y RN-07 (validación del motivo antes de llamar; motivo precargado con `esAntiguo`); spec verde | RN-06, RN-07 |
| T-08 | Ruta y guardas | `A/app.routes.ts`, `A/compartidos/seguridades/GuardRoles.ts`, `GuardRoles.spec.ts` (nuevo), `A/paginas/suscripcion/configuracion/permisos-plan.config.ts`, `…spec.ts` | T-07 | Ruta `validar-pagos` (RN-02); `GuardRoles` → `/inicio`; `RUTAS_POR_ROL` (RN-03); spec R-04 y spec de `GuardRoles` (rol 1, rol 2, rol 3, sin sesión) verdes | RN-02, RN-03 |
| T-09 | Menú por rol | `A/compartidos/modelos/menu.ts`, `A/compartidos/store/menu.store.ts`, `menu.store.spec.ts` (nuevo), `src/assets/datos/menu.json` | T-08 | RN-01; spec: con roles `[3]` no aparece, con `[2]` sí; el resto del menú igual que la línea base | RN-01 |
| T-10 | Verificación | `EV/HLT-26/despues/{lint,test,build}.txt` | T-09 | `ng lint`, `ng test --watch=false`, `ng build` con código 0 | G-03 |
| T-11 | Documentar y entregar | `criterioKellyApp/README.md`, `EV/HLT-26/entrega.txt` | T-10 | README: «Validación de pagos (administradores)»; `git status --short`; mensaje sugerido «HU-005: menú y ventana de validación de pagos para administradores»; hash `➖` | — |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11.

---

## H8 · Reglas de implementación deterministas

Reglas de `desarrollador-ionic.md`.

- **RI-1 · Casos `VP-nn`.** VP-01 carga la primera página; VP-02 `cargarMas` envía `desde` = menor `pag_idPago`; VP-03 `hayMas=false` con menos de 20; VP-04 `seleccionar` pide el comprobante y lo guarda (404 → `null`); VP-05 `aprobar` 200 quita el pago; VP-06 `rechazar` envía `motivo` y quita el pago; VP-07 409 en aprobar → recarga la primera página; VP-08 con `esAntiguo` Aprobar queda deshabilitado, se muestra el aviso y el rechazo parte con el motivo precargado; VP-09 con `esAnticipado` el detalle muestra «Pago anticipado…» con inicio y fin resultantes y Aprobar queda habilitado; con fechas `null` Aprobar queda deshabilitado con el aviso.
- **RI-2.** Textos exactos de RN-06…RN-08; sin `innerHTML`; sin `bypassSecurityTrust*`.
- **RI-3.** Sin tocar MySQL/Apache, sin git de escritura, sin reportes `.md`.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9; checks como HLT-25.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-03…T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

1 Resumen · 2 Estado global · 3 Tablero · 4 Cobertura (C-01…C-07, RN-01…RN-10) · 5 Cambios `ruta:línea` · 6 Verificaciones · 7 Desviaciones · 8 Pendientes · 9 Próximos pasos (HLT-27). RR-1…RR-5.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

Kebab-case en archivos nuevos (`validar-pagos.page.ts`, `validacion-pagos.store.ts`, `administracion-pagos.service.ts`, `detalle-pago.component.ts`, `lista-pagos-pendientes.component.ts`); `GuardRoles.ts` conserva su nombre heredado (AF-4); clases y métodos en español (`aprobar`, `rechazar`, `cargarPendientes`); campos con los nombres de columna del backend.
