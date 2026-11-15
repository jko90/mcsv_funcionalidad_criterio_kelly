# HLT-25-v2 — App: subida del comprobante de pago y estado del pago (HU-005 rev. 3: «Subida del comprobante», B-01…B-05)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; revisado el 2026-11-13 por DT-15, DT-16 y DT-17) |
| Historia | `docs/Historia_usuario/HU-005-control-por-plan-comprobante-y-administracion.md` (rev. 3), propuesta §1 y criterios **B-01…B-05** |
| Numeración | Vigentes: HLT-15-v2 · HLT-16-v4 · HLT-17-v4 · HLT-18 · HLT-19-v2 · HLT-20-v2 · HLT-21-v2 · HLT-24-v2 · **HLT-25-v2 (este)** · HLT-26-v2 · HLT-27-v2 · HLT-28-v2 |
| Proyecto y git | `criterioKellyApp` (git propio) y `docs/Planificacion/evidencias/` |
| Agente | `desarrollador-ionic` en todas las tareas |
| Depende de | **HLT-17-v4 COMPLETADO** (`pagos/miUltimoPago` con `motivoRechazo` leído del historial, 409 de un pago en revisión) y **HLT-19-v2/HLT-20-v2 COMPLETADOS** (`PlanVigenteStore`, `PlanVigente.modelo.ts` con `planPendiente.comprobanteEnviado`, `AvisoPlanComponent`, `permisos-plan.config.ts` con `RUTAS_SIEMPRE_HABILITADAS`). Se comprueba en T-01 |
| Lo consume | HLT-27-v2 (spec R-04 de rutas), HLT-28-v2 (prueba manual) |
| Entorno | Ionic 8 / Angular 20 / NgRx Signals; `npm install --legacy-peer-deps`; `ionic serve --port=8100` |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 5) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) MySQL/Apache intocables. (2) Commits del usuario: sin `git add/commit/push/checkout/reset/stash/clean`; hash = `➖`. (3) Sin reportes `.md` en `evidencias/`. (4) Cuentas `ck_prueba_hu5_*`. (5) El token no se guarda en almacenamiento persistente; la imagen tampoco (solo en memoria hasta enviarla). (6) La decisión de qué mostrar sale de `planVigente` y `miUltimoPago` del servidor, nunca del dispositivo.

---

## H1 · Propósito

**Requerimiento literal (HU-005 rev. 2).** «Desde la **pantalla de planes**, en el plan pendiente de pago (F-08 de HU-004), aparece «Subir comprobante». Abre un formulario con: método de pago, número de transacción (`idTransaccion`), correo o criptomoneda si el método lo pide, y la **imagen del comprobante** (cámara o galería, con el servicio de imágenes existente). La app reduce la imagen antes de enviarla y avisa si sigue pasando de 512 KB. […] Se envía con `crearConPago` sobre la suscripción pendiente (`sis_idSuscrip`). […] Estados que ve la persona: **sin comprobante** → **en revisión** → **confirmado** […] o **rechazado** (con el motivo […]; puede subir otro comprobante con otro número de transacción). Solo puede haber **un pago en revisión** por suscripción a la vez.» · **B-01…B-05**.

**Propósito.** Que la persona active su plan de pago sin salir de la app.

**Resultado esperado (observable).**
1. En la pantalla de planes y en el aviso del inicio, con `planPendiente`, aparece «Subir comprobante» (si no hay pago en revisión) o «Ver estado del pago»; con un plan de pago vigente sin pago ni periodo programado, aparece «Pagar mi renovación por anticipado» (RN-12).
2. La ruta `/comprobante` muestra el estado del último pago (`miUltimoPago`) y, si no hay uno en revisión, el formulario.
3. La imagen se comprime con `ManejoImagenesService.comprimirImagen` y se rechaza en la app si sigue superando 512 KB o no es jpeg/png/gif/webp.
4. Al enviar: `crearConPago` con `pin_idPlanInterv` y `sis_idSuscrip` de `planPendiente`; éxito → estado «En revisión» y recarga de `PlanVigenteStore`; 409/400 → mensaje del servidor.
5. `/comprobante` nunca se bloquea por el plan (estado 3 «menú mínimo» de HU-004 incluido).

**Fuera de alcance.** La ventana del administrador (HLT-26); límites por pantalla (HLT-27); cambiar el backend; pasarelas de pago.

**Feature(s) afectada(s).** `src/app/paginas/suscripcion/` (`comprobante/` nueva, `componentes/` nueva, `servicios/`, `store/`, `modelos/`, `planes/`, `aviso-plan/`, `configuracion/permisos-plan.config.ts`), `src/app/app.routes.ts`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Cuándo se ofrece | Botón «Subir comprobante» solo con `planPendiente !== null` (incluida la renovación pendiente de pago que crea el servidor al cortar un plan de pago con renovación automática, DT-15) y `comprobanteEnviado === false`; con `comprobanteEnviado === true`, «Ver estado del pago»; sin `planPendiente`, ninguno | B-01 |
| RN-02 | Campos | `metodoPago` ∈ `CRIPTOMONEDA`, `PAYPAL`, `BANCO` (como `SuscripcionCtrl.php:13`); `idTransaccion` obligatorio, ≤ 254, patrón `^[A-Za-z0-9._:-]+$` (`SuscripcionCtrl.php:17`); `correoTransaccion` obligatorio con `PAYPAL` (validador de correo); `criptomoneda` obligatoria con `CRIPTOMONEDA` (≤ 16); `comprobante` obligatorio en la app | B-01 |
| RN-03 | Imagen | Selección con `ManejoImagenesService.seleccionarImagen` (`manejo-imagenes.service.ts:13`) y `comprimirImagen` (`:46`); tipo `image/jpeg|png|gif|webp`; tamaño decodificado ≤ 524 288 bytes (mismo límite que `BaseCtrl::TAMANO_MAXIMO_IMAGEN_BYTES`); si no cumple, mensaje «La imagen no puede superar 512 KB» y no se envía | B-02 |
| RN-04 | Envío | `SuscripcionService.crearSuscripcionConPago` (`suscripcion.service.ts:40-45`) con `{pin_idPlanInterv, sis_idSuscrip?, idTransaccion, metodoPago, comprobante, correoTransaccion?, criptomoneda?}`; `sis_idSuscrip` se envía solo con un `planPendiente` (primer pago o renovación); el pago anticipado lo omite (RN-12); sin monto ni meses | B-01, E-05 |
| RN-05 | Errores | 400/403/409 muestran el mensaje del servidor por el `errorInterceptor` (sin `OMITIR_MANEJO_ERROR`); el formulario conserva los datos salvo la imagen tras un 400 de imagen | B-02, B-03, B-04 |
| RN-06 | Estado | `GET pagos/miUltimoPago` → `R` «En revisión: el administrador validará tu comprobante», `F` «Rechazado: <motivoRechazo>» con el formulario visible, `C` o `pago:null` con `estado = PAGO` «Plan activo hasta <fechaCorte>»; `pago:null` sin plan pendiente «No tienes pagos pendientes» | B-05 |
| RN-07 | Tras enviar | Éxito → `PlanVigenteStore.cargar()` y `cargarUltimoPago()`; el formulario se oculta (RN-01) | B-05 |
| RN-08 | Ruta siempre habilitada | `'/comprobante'` añadido a `RUTAS_SIEMPRE_HABILITADAS` en `permisos-plan.config.ts`; la spec de estados × rutas de HLT-20 sigue verde con la ruta nueva | Continuidad HU-004 |
| RN-09 | Arquitectura | Lógica en `ComprobanteStore` (`rxMethod` con el pipeline estándar); servicios solo HTTP; componentes presentacionales `FormularioComprobanteComponent` y `EstadoPagoComponent` con `input()`/`output()` y sin `inject` | F-04 de HU-004 |
| RN-10 | Privacidad | La imagen solo vive en el estado del formulario hasta enviarla; `grep -n "localStorage\|sessionStorage\|Preferences" ` sobre los archivos nuevos vacío | entorno 5 |
| RN-11 | Textos de periodo (DT-16, DT-17) | Según el contexto, sin calcular fechas con el reloj del dispositivo: **primer pago o renovación** (hay `planPendiente`, estado distinto de `PAGO`): «Tu plan corre desde la fecha de tu comprobante: el día en que lo subes. Se activa cuando el administrador lo valide»; con `esRenovacion` añade «Tienes hasta el <fechaLimitePago> para pagarlo; si no, pasarás al plan Libre». **Pago anticipado** (`estado = PAGO`): «Tu plan actual termina el <fechaCorte>. Tu renovación empezará el <día siguiente a fechaCorte> y se activa cuando el administrador valide tu comprobante» (el «día siguiente» es una suma de un día sobre la cadena `YYYY-MM-DD` del servidor, función pura). «En revisión» muestra «Subido el <fecha de `pag_fechaPago`>»; si la persona tarda en subir, esos días no se cuentan; ningún texto promete una fecha de corte del primer pago antes de que el administrador valide; con un `planProgramado` el estado es «Tu renovación ya está pagada, empieza el <fechaInicio>» | DT-16, DT-17, B-05 |
| RN-12 | Pago anticipado (entrada) | El botón «Pagar mi renovación por anticipado» solo aparece con `estado = PAGO`, `planPendiente = null` y `planProgramado = null`; abre `/comprobante` en modo anticipado, con los textos de RN-11 y el mismo formulario; envía `crearConPago` con el `pin_idPlanInterv` del plan vigente (`planVigente.pin_idPlanInterv`) y **sin** `sis_idSuscrip` (RN-04); tras el 200 vuelve a leer el plan y ve «En revisión» (`planPendiente`); los 409 del servidor (`Ya tiene un pago pendiente o programado…`, `Ya tiene un plan de pago activo`) se muestran con su mensaje | DT-16 |
| RN-13 | Estados con un plan presente | Con `estado = PAGO` y un `planPendiente`: «Tu pago por anticipado está en revisión»; rechazado (`F`): «Rechazado: <motivoRechazo>» con el formulario anticipado visible; confirmado: `miUltimoPago` ya no trae pago pendiente y el estado es el de `planProgramado` (RN-11) | DT-16, B-05 |

---

## H3 · Flujo principal de ejecución

```
PlanesPage / AvisoPlanComponent ── «Subir comprobante» ──▶ router '/comprobante' (GuardAutenticacion + plan.guard: siempre permitida)
ComprobantePage (orquestadora)
  ngOnInit → ComprobanteStore.cargarUltimoPago() ─▶ PagosService.obtenerMiUltimoPago() ─▶ GET pagos/miUltimoPago
  EstadoPagoComponent [pago] [planVigente]
  FormularioComprobanteComponent (si RN-01) ─(imagenSeleccionada)▶ página → ManejoImagenesService (seleccionar + comprimir, RN-03)
                                          ─(enviar)▶ ComprobanteStore.enviarComprobante(datos)
       └▶ SuscripcionService.crearSuscripcionConPago ─▶ POST suscripcion/crearConPago
            200 → PlanVigenteStore.cargar() + cargarUltimoPago() → «En revisión»
            400/403/409 → errorInterceptor (toast con mensaje del servidor) → estado de error en el store
```

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Prueba |
|--------------------|--------|--------|
| B-01 / RN-01, RN-02, RN-04 | T-03, T-04, T-05, T-06, T-07 | specs `formulario-comprobante.component.spec.ts`, `comprobante.store.spec.ts` (CS-01…CS-06) |
| B-02 / RN-03 | T-06 | spec de la página (imagen > 512 KB) |
| B-03, B-04 / RN-05 | T-04 | CS-04, CS-05 |
| B-05 / RN-06, RN-07 | T-04, T-05 | `estado-pago.component.spec.ts` |
| RN-08 | T-08 | `permisos-plan.config.spec.ts` |
| RN-09, RN-10 | todas | `ng lint`, `grep` |
| RN-12, RN-13 (DT-16) | T-05, T-06, T-07, T-09 | specs del formulario, del estado y de la página con plan presente |
| RN-11, DT-15, DT-16 | T-05, T-06, T-07 | specs de los dos componentes y de la página (textos y botón con una renovación pendiente) |

### Discrepancias HU ↔ código
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | «en el plan pendiente de pago (F-08)» | El plan pendiente se muestra en `AvisoPlanComponent` y en `PlanesPage` (HLT-19/20) | Botón en ambos (RN-01) |
| C-2 | Estado 3 «menú mínimo» solo habilita inicio y criterio Kelly | El usuario en ese estado es justo quien debe subir el comprobante | `/comprobante` siempre habilitada (RN-08); no contradice la tabla de menú porque no es una opción del menú |
| C-3 | «con el servicio de imágenes existente» | `seleccionarImagen` usa un tamaño máximo propio (`MAX_IMAGE_SIZE`, `manejo-imagenes.service.ts:30`) | Se comprime siempre y se valida además el límite del servidor (RN-03) |

### Checklist de calidad del HLT
- [x] 11 secciones · [x] sin marcadores · [x] cobertura 100 % · [x] criterios verificables · [x] respeta `criterioKellyApp/CLAUDE.md` y `desarrollador-ionic.md` · [x] referencias leídas el 2026-11-12 · [x] decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Página propia o modal | A) modal en planes; B) página `/comprobante` | **B** | Accesible desde planes y desde el aviso; enlazable | No |
| D-02 | Store | `ComprobanteStore` nuevo en `paginas/suscripcion/store/` | cerrada | Responsabilidad única | No |
| D-03 | Servicio de `miUltimoPago` | `PagosService` nuevo en `paginas/suscripcion/servicios/` | cerrada | Recurso `/pagos` del lado del usuario; HLT-26 tendrá el suyo de administración | No |
| D-04 | Campos condicionales | Requeridos solo en la app según el método | cerrada | RD-7: el servidor los acepta opcionales; mejora la verificación del administrador | No |

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1…10 | Entendimiento, reglas, impacto, arquitectura, riesgos, simplicidad, seguridad, cobertura, determinismo, ejecutabilidad | ✅ | |

**Ataques considerados.** *Mandar otro monto:* la app no envía monto (RN-04). *Subir dos veces:* el botón se oculta y el servidor responde 409 (HLT-17-v4). *Imagen enorme o no imagen:* RN-03 y validación del servidor. *Bloqueo del usuario en el estado 3:* RN-08. *Ver el pago de otro:* el servicio no envía id.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Compresión insuficiente para fotos grandes en el móvil | Media | Reintento con menor calidad dentro de `comprimirImagen`; mensaje claro si aun así no cabe |
| R-02 | Nueva ruta privada sin clasificar | Baja | Spec R-04 de HLT-20 la detecta (RN-08) |

**Rondas.** *Ronda 1 — CON CAMBIOS:* `/comprobante` quedaba bloqueada en el estado 3 (C-2). *Ronda 2 — APROBADO.* *Ronda 3 (v2) — APROBADO:* solo cambian la dependencia (HLT-23 ANULADO → HLT-17-v4), el origen del motivo (historial, sin cambio para la app salvo el nombre `motivoRechazo`) y las versiones de HLT-19/20. **Veredicto: APROBADO.**
*Ronda 4 (DT-15 y DT-16, 2026-11-13) — APROBADO.* El botón y el estado ya sirven a la renovación pendiente porque es un `planPendiente` más (RN-01); se añade el texto de desde cuándo corre el plan (RN-11). Ataque: *prometer una fecha de corte antes de la validación* → ningún texto lo hace.
*Ronda 5 (DT-16 con su alcance y DT-17, 2026-11-13) — APROBADO.* Se añade el pago anticipado (RN-12: `crearConPago` sin `sis_idSuscrip`, mecanismo de HLT-17-v4 D-18), sus estados (RN-13) y los textos según contexto (RN-11), incluido el plazo de la renovación. Ataques: *anticipar con otro plan* → 409 del servidor, sin lógica en la app; *subir dos veces* → el botón desaparece con `planPendiente` y el servidor responde 409; *calcular el día siguiente con el reloj* → es una suma sobre la fecha del servidor.

---

## H7 · Plan de tareas

Todas `desarrollador-ionic`. `P` = `criterioKellyApp/src/app/paginas/suscripcion`, `EV` = `docs/Planificacion/evidencias`.

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | `EV/HLT-25/antes/*.txt` | — | HLT-17-v4, HLT-19-v2 y HLT-20-v2 `COMPLETADOS` (existen `P/store/plan-vigente.store.ts`, `P/configuracion/permisos-plan.config.ts`, `P/aviso-plan/aviso-plan.component.ts`; `curl` con token de fixture a `pagos/miUltimoPago` → 200 `{"pago":null}`); línea base de `ng lint`, `ng test --watch=false`, `ng build` | — |
| T-02 | Modelo | `P/modelos/EstadoPago.modelo.ts` (nuevo) | T-01 | Interfaces `UltimoPagoRespuesta {pago: UltimoPago | null}` y `UltimoPago` con los campos de RN-23 de HLT-17-v4 (columnas con su nombre tal cual; `motivoRechazo` en camelCase porque no es columna); `SolicitudComprobante` de RN-04 | RN-04, RN-06 |
| T-03 | Servicio | `P/servicios/pagos.service.ts`, `…spec.ts` (nuevos) | T-02 | `obtenerMiUltimoPago(): Observable<UltimoPagoRespuesta>` → `GET ${apiUrlSuscripcion}pagos/miUltimoPago`; spec verifica URL y método | RN-06 |
| T-04 | Store | `P/store/comprobante.store.ts`, `…spec.ts` (nuevos) | T-03 | `signalStore` con `ultimoPago`, `cargando`, `enviando`, `error`; `rxMethod` `cargarUltimoPago` y `enviarComprobante` (pipeline estándar `tap → switchMap → tapResponse → finalize`); éxito llama a `PlanVigenteStore.cargar()`; specs CS-01…CS-06 verdes | RN-04…RN-07, RN-09 |
| T-05 | Componente de estado | `P/componentes/estado-pago/estado-pago.component.{ts,html,scss,spec.ts}` (nuevos) | T-02 | Presentacional (`input` `pago`, `planVigente`; sin `inject`); textos de RN-06, RN-11 y RN-13; el motivo se muestra con interpolación (no `innerHTML`); spec cubre `R`, `F`, `C`/`PAGO`, `null` | RN-06, RN-09 |
| T-06 | Componente de formulario | `P/componentes/formulario-comprobante/formulario-comprobante.component.{ts,html,scss,spec.ts}` (nuevos) | T-02 | Formulario reactivo con RN-02 (validadores condicionales por método) y los textos de RN-11 (primer pago, renovación con plazo y anticipado); `input` `vistaPrevia`, `enviando`; `output` `seleccionarImagen`, `enviar(SolicitudComprobante)`; sin `inject`; spec de validaciones | RN-02, RN-09 |
| T-07 | Página | `P/comprobante/comprobante.page.{ts,html,scss,spec.ts}` (nuevos) | T-04, T-05, T-06 | Orquesta store, componentes e imagen (RN-03 con el límite de 524 288 bytes del dato base64 decodificado); spec: imagen > 512 KB no llama al store; con `R` no muestra el formulario | RN-01, RN-03 |
| T-08 | Ruta y permisos | `src/app/app.routes.ts`, `P/configuracion/permisos-plan.config.ts`, `…spec.ts` | T-07 | Ruta `comprobante` con `GuardAutenticacion` y el guarda de plan de HLT-20; `'/comprobante'` en `RUTAS_SIEMPRE_HABILITADAS`; spec de estados × rutas y spec R-04 verdes | RN-08 |
| T-09 | Accesos | `P/planes/planes.page.{ts,html}`, `P/aviso-plan/aviso-plan.component.{ts,html}` | T-08 | Botones de RN-01 y de RN-12 («Pagar mi renovación por anticipado» en `PlanesPage` y en el aviso del inicio); el componente de aviso emite `output` y la página navega (el componente no inyecta `Router`) | RN-01, RN-12 |
| T-10 | Verificación | `EV/HLT-25/despues/{lint,test,build}.txt` | T-09 | `ng lint`, `ng test --watch=false`, `ng build` con código 0 y sin fallos nuevos frente a `antes/`; `grep` de RN-10 vacío | G-03 |
| T-11 | Documentar y entregar | `criterioKellyApp/README.md`, `EV/HLT-25/entrega.txt` | T-10 | README: sección «Comprobante de pago» (flujo, límite de imagen, estados); `git status --short`; mensaje sugerido «HU-005: pantalla para subir el comprobante de pago y ver su estado»; hash `➖` | — |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11.

---

## H8 · Reglas de implementación deterministas

Reglas de `desarrollador-ionic.md` (página orquestadora + componentes presentacionales + lógica en `signalStore`, nombres en español).

- **RI-1 · Casos `CS-nn` (store).** CS-01 `cargarUltimoPago` guarda la respuesta; CS-02 `enviarComprobante` llama al servicio con el cuerpo exacto de RN-04 (sin monto); CS-03 éxito → `PlanVigenteStore.cargar` llamado y `cargarUltimoPago` repetido; CS-04 409 → `error` con el mensaje y `enviando=false`; CS-05 400 → igual; CS-06 `enviando` impide un segundo envío simultáneo.
- **RI-2.** Textos exactos de RN-06 y RN-03; sin `Date`/`new Date` en el store (las fechas se muestran como llegan).
- **RI-3.** Sin tocar MySQL/Apache, sin git de escritura, sin reportes `.md`.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9. Ficha: `Estado`; **C1** archivos; **C2** criterio de H7; **C3** H8 y entorno; **C4** `ng lint`; **C5** `ng test` del archivo; **C6** sin efectos fuera de alcance.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-03…T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

1 Resumen · 2 Estado global · 3 Tablero · 4 Cobertura (B-01…B-05, RN-01…RN-10) · 5 Cambios `ruta:línea` · 6 Verificaciones (salida de lint, test, build) · 7 Desviaciones · 8 Pendientes · 9 Próximos pasos (HLT-26). RR-1…RR-5.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

Archivos en kebab-case (`comprobante.page.ts`, `comprobante.store.ts`, `pagos.service.ts`, `estado-pago.component.ts`, `formulario-comprobante.component.ts`); clases `ComprobantePage`, `ComprobanteStore`, `PagosService`, `EstadoPagoComponent`, `FormularioComprobanteComponent`; métodos con verbo en español (`cargarUltimoPago`, `enviarComprobante`, `seleccionarImagen`); campos del modelo con los nombres de columna del backend.
