# HLT-19-v2 — App: concesión de la prueba en el primer inicio de sesión, aviso del tiempo restante, plan pendiente de pago y modelo con límites (HU-004 rev. 5: F-01…F-05, F-08 · decisión 4 del usuario del 2026-11-12)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; revisado el 2026-11-13 por DT-15, DT-16 y DT-17) |
| Historia | `docs/Historia_usuario/HU-004-plan-de-prueba-24-horas.md` (rev. 5). Cubre **F-01, F-02, F-03 (aviso de transición), F-04, F-05, F-08** y A-5 (se sustituye la creación del Libre) |
| Numeración | Vigentes: HLT-15-v2 · HLT-16-v4 · HLT-17-v4 · HLT-18 · **HLT-19-v2 (este)** · HLT-20-v2 · HLT-21-v2 · HLT-24-v2 · HLT-25-v2 · HLT-26-v2 · HLT-27-v2 · HLT-28-v2 |
| Proyecto y git | `criterioKellyApp` (git propio). El backend **no** se toca |
| Agente | `desarrollador-ionic` en todas las tareas (T-12 es una puerta humana) |
| Depende de | **HLT-16-v4 COMPLETADO** (contrato `planVigente`/`iniciarPrueba` con `limites`); recomendable HLT-17-v4 y HLT-18 completados para probar `PAGO` y `cancelado`. Se comprueba en T-01 con `curl` |
| Lo consume | HLT-20-v2 (amplía `PlanVigenteStore`, `AvisoPlanComponent` e `InicioPage`), HLT-25-v2 y HLT-27-v2 (usan `LimitesPlan`) |
| Entorno | Node/Angular 20/Ionic 8; `npm install --legacy-peer-deps` solo si hiciera falta (no se esperan dependencias nuevas); Karma con Edge: `CHROME_BIN="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless --include='**/<archivo>.spec.ts'` (README de la app); servicios en `http://localhost/criterio_kelly/rest_<nombre>/` |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 7) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) MySQL y Apache intocables (no iniciar, detener, reiniciar ni reparar; sin escribir en `mysql.*`); si el servidor falla, el agente se detiene. (2) Commits del usuario: sin `git add/commit/push/checkout/reset/stash/clean`; entrega de archivos y mensajes sugeridos; hash = `➖`. (3) Sin reportes `.md` en `docs/Planificacion/evidencias/` (solo `.txt`). (4) Cuentas de prueba `ck_prueba_hu4_*`. (5) El token no se guarda en ningún almacenamiento persistente (F-04). (6) Fechas: la app **no** usa el reloj del dispositivo para decidir nada de plan (F-02).

---

## H1 · Propósito

**Requerimiento literal (HU-004 rev. 5).** «**F-01** Tras el primer inicio de sesión de una cuenta nueva, la app pide la concesión (reemplaza la creación del plan Libre de A-5) y muestra el aviso del tiempo restante. Si la concesión falla o responde 409, el login no se bloquea, como hoy. **F-02** Mientras la prueba está en curso, la app muestra el tiempo restante, calculado a partir de los segundos que devuelve el servidor (no del reloj del dispositivo). **F-03** Cuando la prueba termina, la app lo informa una vez y refleja el plan Libre, con los días que le quedan (hasta 10) […] Cuando se mejora a un plan de pago, refleja el plan nuevo. **F-04** La lógica vive en el store (`rxMethod` con el pipeline estándar), los servicios solo hacen HTTP y los componentes presentacionales no inyectan nada. El token no se guarda en ningún almacenamiento persistente. **F-05** El aviso del tiempo restante […] se recalcula al volver a la app. **F-08** Al elegir un plan de pago, la app muestra que la cuenta tiene un **plan pendiente de pago** (nombre del plan y estado «se activará cuando el administrador valide tu comprobante»), tanto al terminar el registro como en la pantalla de planes.»

**Propósito.** Que la persona vea en la app, a partir del plan vigente que decide el servidor, cuánto le queda de prueba, cuándo cambia su plan y si tiene un plan de pago pendiente de validación, sin bloquear nunca el inicio de sesión.

**Resultado esperado (observable).**
1. En el primer inicio de sesión (sin la marca `suscripcion_inicial_verificada`): si el registro reservó un plan **de pago**, se crea primero la suscripción pendiente (`crearSinPago`) y después se pide `POST suscripcion/iniciarPrueba`; si se reservó el Libre o nada, solo se pide la prueba. 200 y 409 cuentan como resueltos; un 429 o un fallo dejan la marca sin poner y el login continúa.
2. La pantalla de inicio muestra, durante la prueba, «Tu prueba termina en 5 h 20 min» calculado con los `segundosRestantes` del servidor y un reloj monótono; se recalcula al volver a la app (`visibilitychange`) y al llegar a cero se vuelve a pedir el plan.
3. Cuando el estado cambia (prueba → Libre, Libre → sin plan, plan de pago activado o cortado) la app lo informa **una vez** («Tu prueba terminó; estás en el plan Libre y te quedan 10 días») usando la marca local `plan_vigente_avisado`.
4. Si hay `planPendiente`, la pantalla de inicio muestra «Tu plan <nombre> está pendiente de pago y se activará cuando el administrador valide tu comprobante. Tu plan corre desde la fecha de tu comprobante»; al terminar el registro con un plan de pago se muestra el mismo mensaje. Tras el corte de un plan de pago con renovación automática (DT-15), `planPendiente` es la renovación creada por el servidor y el aviso de transición dice «Tu plan <nombre> terminó. Tienes N días para pagarlo; si no, pasarás al plan Libre» (N = `diasRestantesPago`, DT-17); si la renovación se anula por falta de pago la app avisa «Tu renovación se anuló por falta de pago; estás en el plan Libre y te quedan N días»; con un periodo ya pagado por anticipado (`planProgramado`) muestra «Tu renovación ya está pagada, empieza el <fecha de inicio>» (DT-16).
5. `ng lint`, `ng test --watch=false` y `ng build` sin errores nuevos.

**Fuera de alcance.** Menú y guarda de rutas según el plan, elegir un plan desde la app, cancelar el plan y mostrar la fecha de fin (HLT-20); la pantalla para subir el comprobante de pago (HU-005, HLT-25-v2); aplicar los límites (HLT-24-v2 en el servidor, HLT-27-v2 en las pantallas); notificaciones push o correo; cambiar el backend; `ServicioInactividad` y la sesión.

**Feature(s) afectada(s).** `src/app/paginas/suscripcion/` (`modelos/`, `servicios/`, `store/`, nuevo `aviso-plan/`, `registro/`), `src/app/paginas/inicio/`. Lectura de `src/app/paginas/util/login/login.page.ts`, `compartidos/store/sesion.store.ts`, `compartidos/interceptors/`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Orden del primer inicio de sesión | `SuscripcionStore.asegurarSuscripcionInicial` (`SuscripcionStore.ts:92-126`): con reserva de pago (`pin_idPlanInterv > PLAN_LIBRE_ID_INTERVALO`) llama `crearSuscripcionInicial({sus_pinIdPlanin})` y **después** `iniciarPrueba()`; con reserva Libre o ausente solo `iniciarPrueba()`; spec con `toHaveBeenCalledBefore` | F-01, DT-07 |
| RN-02 | Resuelto = 200 o 409 | Se marca `suscripcion_inicial_verificada` y se borra la reserva solo si **ambas** llamadas (cuando corresponden) terminaron en 200 o 409; con 0, 401, 429 o 5xx no se marca y `isError` queda con texto | F-01 |
| RN-03 | El login no se bloquea | `login.page.ts:159-160` sigue esperando `isLoading` con el `try/catch` de `:166-179` y continúa pase lo que pase; sin toasts de error del interceptor (las llamadas llevan `OMITIR_MANEJO_ERROR`) | F-01 |
| RN-04 | El servidor decide | Ningún cálculo de plan, duración o fecha usa `Date`, `Date.now()` ni `new Date()` salvo el reloj monótono `performance.now()` para descontar el tiempo transcurrido desde que llegó la respuesta; `grep -nE "new Date\(|Date\.now\(" ` sobre los archivos nuevos vacío | F-02, B-04 |
| RN-05 | Tiempo restante | `segundosRestantes = max(0, plan.segundosRestantes − floor((ahoraMs − recibidoEnMs)/1000))`; formato: ≥ 1 h → «N h M min»; < 1 h → «M min»; < 1 min → «menos de 1 min» | F-02 |
| RN-06 | Se recalcula al volver | Evento `visibilitychange` con `document.visibilityState === 'visible'` y sesión activa → nueva petición de `planVigente`; el contador interno corre cada 30 s; con `segundosRestantes = 0` en prueba, Libre o plan de pago se pide el plan una vez | F-05 |
| RN-07 | Avisos de transición (una vez) | Con `plan_vigente_avisado = {usuarioId, estado, idSuscripcion}` guardado: si cambia `estado` o `idSuscripcion` → aviso por la tabla de H5 D-04 y se guarda el estado nuevo al pulsar «Entendido»; `PRUEBA` actualiza la marca sin aviso; sin marca previa avisan `LIBRE`, `PAGO` y `SIN_PLAN` (con cualquier `motivoSinPlan`, también `NUNCA_TUVO_PLAN`) | F-03 |
| RN-08 | Plan pendiente visible | `planPendiente !== null` → tarjeta con el nombre del plan, el intervalo y el texto exacto «se activará cuando el administrador valide tu comprobante» y la frase «Tu plan corre desde la fecha de tu comprobante»; con `esRenovacion` añade «Tienes <diasRestantesPago> días para pagarlo; si no, pasarás al plan Libre» (con 0, «Hoy es el último día para pagarlo; si no, pasarás al plan Libre»); con `estado = PAGO` y un `planPendiente` (pago anticipado en revisión) dice «Tu pago por anticipado está en revisión; el administrador lo validará» sin la frase de «corre desde»; si `comprobanteEnviado` es `false` añade «Sube tu comprobante de pago» | F-08 |
| RN-09 | Plan pendiente tras el registro | Con el registro exitoso (`registro.page.html:403`) y un plan de pago elegido, el formulario muestra «Tu plan <nombre> quedará pendiente de pago: se activará cuando el administrador valide tu comprobante» (dato de la selección local, no del servidor; aún no hay sesión) | F-08 |
| RN-10 | Arquitectura | Servicio solo HTTP; lógica en `plan-vigente.store.ts` y `SuscripcionStore`; `AvisoPlanComponent` presentacional sin `inject()`, sin `Router` ni stores; stores con `loading`/`error` y `rxMethod` (`loading → switchMap → patchState → catchError → finalize`) | F-04 |
| RN-11 | Sin persistencia de token ni de plan | La única clave nueva de `localStorage` es `plan_vigente_avisado` (usuario, estado, id de suscripción; sin tokens ni fechas); el plan completo vive solo en memoria | F-04 |
| RN-12 | Cuentas anteriores sin ningún plan | `motivoSinPlan: "NUNCA_TUVO_PLAN"` (estado `SIN_PLAN`): aviso «Debes activar un plan para usar todas las funciones» con acceso a la pantalla de planes, con la misma marca de RN-07; la app no pide la prueba a estas cuentas más allá del intento normal del primer inicio de sesión (el servidor responde 409 a las cuentas anteriores) | DT-02 actualizada, decisión 4 del usuario (2026-11-12) |
| RN-13 | Fallo de lectura no bloquea | Si `planVigente` falla (red, 5xx) el store deja `plan = null` y `error`, sin toast ni redirección; la pantalla de inicio funciona igual | F-01 |
| RN-14 | Renovación pendiente, anulación y periodo programado (DT-15, DT-16, DT-17) | Estado 6 de la HU descompuesto: con `estado = SIN_PLAN`, `motivoSinPlan = PLAN_PAGO_VENCIDO` y `planPendiente !== null` con `esRenovacion` (la renovación que creó el servidor, dentro de sus 30 días), el aviso de transición de D-04 usa el nombre del `planPendiente` y `diasRestantesPago`, y la tarjeta de RN-08 pide subir el comprobante (el botón lo añade HLT-25-v2); con `planPendiente === null` (renovación cancelada) el aviso es «Tu plan de pago terminó». Si el servidor la anula por falta de pago, el siguiente `planVigente` trae `estado = LIBRE` (la marca previa era `SIN_PLAN`) y el aviso es el de anulación; al terminar ese Libre, `SIN_PLAN`/`LIBRE_TERMINADO` («Terminó tu plan Libre»). Con `planProgramado` no nulo y `estado = PAGO`, el inicio muestra la tarjeta «Tu renovación ya está pagada, empieza el <fechaInicio>». El store no decide ni crea nada de esto: solo muestra lo que devuelve `planVigente`, sin calcular fechas con el reloj del dispositivo | DT-15, DT-16, DT-17 |

---

## H3 · Flujo principal de ejecución

**Contrato consumido (HLT-16-v4, campo por campo; añade `limites` de RN-25).** `GET {apiUrlSuscripcion}suscripcion/planVigente` → `PlanVigente {estado: 'PRUEBA'|'LIBRE'|'PAGO'|'SIN_PLAN', vigente, esPrueba, motivoSinPlan: null|'LIBRE_TERMINADO'|'PLAN_PAGO_VENCIDO'|'NUNCA_TUVO_PLAN', idSuscripcion, pin_idPlanInterv, plan: null|{pla_idPlan, pla_nombre, pla_numCuentas, pla_diasHistorial, pla_diasTotales, pla_bloqueoDias, pla_puedeDescargar, pla_descargaTodos, pla_rangoLibre}, fechaFinUtc, fechaCorte, segundosRestantes, cancelado, planSiguiente: null|{pla_idPlan, pla_nombre, pla_horasDuracion}, planPendiente: null|{sis_idSuscrip, pin_idPlanInterv, pla_nombre, ins_nombre, pin_precioFinal, comprobanteEnviado, esRenovacion, fechaLimitePago, diasRestantesPago}, planProgramado: null|{sis_idSuscrip, pin_idPlanInterv, pla_nombre, ins_nombre, fechaInicio, fechaFin}, limites: {numCuentas, diasReporte, diasAnalisis, maxOperacionesAnalisis, diasTotalesAnalisis, puedeGraficar, puedeDescargar, divisorEditable, maxOperacionesDiarias}}`. `POST …suscripcion/iniciarPrueba` (cuerpo `{}`) → mismo objeto o 409/429.

**Flujo A — primer inicio de sesión.**
```
[Login correcto] LoginPage.ejecutarValidacion (login.page.ts:131-164) → asegurarSuscripcionInicial (:166-179)
 → SuscripcionStore.asegurarSuscripcionInicial({usuarioId, usuario})   (filter !estaVerificada, SuscripcionStore.ts:94)
     isLoading = true
     ├─ reserva de pago → service.crearSuscripcionInicial → [200 | 409 → seguir | otro → error, sin marca]
     └─ service.iniciarPrueba() → [200 → PlanVigenteStore.establecer(plan) | 409 → seguir | 429/0/5xx → error, sin marca]
     200/409 en todo lo que corresponde → marcarVerificada + borrar reserva
     finalize → isLoading = false
 → LoginPage continúa: validarPIN → navegarAInicio
```
**Flujo B — pantalla de inicio.**
```
[InicioPage.ionViewWillEnter] → PlanVigenteStore.cargar({usuarioId}) → service.obtenerPlanVigente (OMITIR_MANEJO_ERROR)
   éxito → patchState(plan, recibidoEnMs = performance.now()) → evaluar aviso (RN-07)
   error → plan = null, error (RN-13)
 → PlanVigenteStore.vigilar(): timer 30 s + visibilitychange → recalcula; segundos 0 → cargar
 → plantilla: <app-aviso-plan> con (entendido)="store.marcarAvisoLeido()"
```
**Ramas de error.** 401 lo gestiona `autenticacionInterceptor` (renovación y salida; `autenticacion.interceptor.ts:55-…`); 429 en la concesión: sin marca, sin toast; 409: éxito; 0/5xx: sin marca. El interceptor `errorInterceptor` no muestra toasts porque las llamadas usan `OMITIR_MANEJO_ERROR` (`sesion-http.ts:9`, `error.interceptor.ts:13-18`); el 422 no interviene.

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Verificación |
|--------------------|--------|--------------|
| F-01 / RN-01, RN-02, RN-03 | T-03, T-07, T-10 | specs SI-1…SI-9 de `SuscripcionStore.spec.ts`; `ng test` |
| F-02 / RN-04, RN-05 | T-05, T-10 | specs PV-1…PV-6 (tiempo con reloj monótono simulado) |
| F-03 / RN-07 | T-04, T-05, T-10 | specs PA-1…PA-5 y PV-7…PV-10 |
| F-04 / RN-10, RN-11 | T-03, T-05, T-06, T-11 | `grep` de `inject(` en el componente; `ng lint` |
| F-05 / RN-06 | T-05, T-10 | specs PV-11, PV-12 (`visibilitychange`, tick) |
| F-08 / RN-08, RN-09 | T-06, T-08, T-09 | specs AC-1…AC-5 y RG-1; puerta T-12 |
| RN-12, RN-13 | T-05, T-10 | specs PV-13, PV-14 |
| RN-14 (DT-15, DT-16, DT-17) | T-05, T-10 | specs PV-15…PV-19 |
| Calidad G-03 | T-11 | `ng lint`, `ng test --watch=false`, `ng build` |
| Pantalla de subida del comprobante de pago | — | **Historia futura explícita, sin tareas** (el usuario la pedirá); fuera de alcance |

### Discrepancias HU ↔ código
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | F-08 «en la pantalla de planes» | `/planes` (`app.routes.ts:166-171`) es pública y solo lleva al registro; no hay compra con sesión | El aviso de plan pendiente va en el **inicio** (con sesión) y en el registro; la elección con sesión llega en HLT-20 |
| C-2 | «Comprobante subido» | Ninguna pantalla llama a `crearSuscripcionConPago` (`SuscripcionStore.ts:127-148` sin uso) | Fuera de alcance: historia futura explícita (respuesta 6) |
| C-3 | A-5: reserva Libre | `registro.page.ts:92-95` reserva `PLAN_LIBRE_ID_INTERVALO` cuando no hay plan | Una reserva Libre ya no crea suscripción (RN-01) |
| C-4 | `localStorage` solo con 3 claves (`CLAUDE.md` de la app) | Se añade `plan_vigente_avisado` | Se documenta en T-13 (RN-11); la reserva y las marcas ya existían |

### Checklist de calidad del HLT
- [x] 11 secciones completas · [x] sin marcadores · [x] cobertura 100 % · [x] criterios verificables · [x] respeta standalone, `inject()`, `signalStore`, `rxMethod` · [x] referencias leídas el 2026-11-11 · [x] decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Dónde vive el plan vigente | A) `SuscripcionStore`; B) store nuevo `plan-vigente.store.ts` | **B** | RD-2 con justificación: `SuscripcionStore` guarda listas de suscripciones; el plan vigente tiene reloj, avisos y (HLT-20) permisos | No |
| D-02 | Cómo contar el tiempo | A) reloj del dispositivo; B) `segundosRestantes` + `performance.now()` + recarga al volver | **B** | F-02; `performance.now()` no se ve afectado por cambios de hora | No |
| D-03 | Recarga al volver | A) plugin `@capacitor/app`; B) `visibilitychange` | **B** | Un solo mecanismo en web y nativo; sin dependencias nuevas | No |
| D-04 | Avisos de transición (clave: estado nuevo y marca previa) | tabla cerrada | `LIBRE` con marca previa `PRUEBA`→«Tu prueba terminó; estás en el plan Libre y te quedan N días» (N = `ceil(segundos/86400)`); `LIBRE` con marca previa `SIN_PLAN`→«Tu renovación se anuló por falta de pago; estás en el plan Libre y te quedan N días»; `SIN_PLAN` + `LIBRE_TERMINADO`→«Terminó tu plan Libre»; `SIN_PLAN` + `PLAN_PAGO_VENCIDO` con `planPendiente` de renovación→«Tu plan <nombre del planPendiente> terminó. Tienes <diasRestantesPago> días para pagarlo; si no, pasarás al plan Libre» (con 0 días, «…Hoy es el último día para pagarlo; si no, pasarás al plan Libre»), y sin `planPendiente`→«Tu plan de pago terminó»; `SIN_PLAN` + `NUNCA_TUVO_PLAN`→«Debes activar un plan para usar todas las funciones»; `PAGO`→«Tu plan <nombre> está activo hasta el <fechaCorte>»; `PAGO` con `planProgramado` (tarjeta permanente, no de transición)→«Tu renovación ya está pagada, empieza el <fechaInicio>»; el texto lo arma el store, el componente solo lo pinta | No |
| D-05 | Marca «avisado» | `localStorage['plan_vigente_avisado']` en servicio `plan-avisado.service.ts` con `try/catch`, como `plan-reservado.service.ts:1-108` | cerrada | Sin tokens; el aviso debe sobrevivir a recargas | No |
| D-06 | Reserva Libre | No crea suscripción | cerrada | Una `P` Libre no aporta nada (HLT-16) | No |
| D-07 | Fallo parcial | Reserva ok y prueba fallida: se mantiene la reserva y no hay marca; el reintento (siguiente login) recibe 409 en la reserva y vuelve a pedir la prueba | cerrada | Sin pérdida de la reserva | No |
| D-08 | Nombres de archivo | kebab-case nuevos (`plan-vigente.store.ts`, `plan-avisado.service.ts`, `aviso-plan.component.ts`); modelo `PlanVigente.modelo.ts` por AF-4 | cerrada | `verificacion-correo.store.ts` ya rompe el PascalCase heredado de `store/` | No |
| D-09 | Dónde se muestra | `InicioPage` (aterrizaje tras el login) | cerrada | Es la pantalla a la que navega `login.page.ts:207-209`; HLT-20 añade las demás | No |

**Preguntas no bloqueantes.** **PU-1.** ¿Se acepta un aviso por dispositivo nuevo cuando no hay marca previa (RN-07)? *Recomendación: sí (implementado así).*

**Preguntas del usuario (CERRADAS el 2026-11-11).** (1) «Sí» a reconstruir los scripts de pruebas: `docs/Planificacion/evidencias/` **ya no existe** y no hay copia; las líneas base antiguas de HU-001/HU-003 dejan de ser referencia comparativa y la nueva línea base se toma sobre el código actual (reconstrucción en HLT-15 T-02 y línea base en T-02b). (2) «Sí»: plan de pago cortado = Libre terminado sin plan (estado 6 = estado 4). (3) «No puede»: un administrador **no** confirma ni rechaza su propio pago, sin excepciones aunque sea el único administrador; las pruebas usan pagos fixture de otro usuario. (4) «Sí»: se acepta como riesgo que las cuentas registradas entre la aplicación del esquema y el despliegue de HLT-16 reciban la prueba. (5) «Sí»: la suscripción 28 puede pasar a `E` por la regla de corte. (6) «Sí, pero será después»: la pantalla para subir el comprobante de pago **no se planifica ahora**; es una historia futura explícita (el usuario la pedirá), sin tareas en estos HLT.

**Aplicación en este HLT:** la antigua PU-2 (pantalla de comprobante) queda **CERRADA**: historia futura explícita, sin tareas (respuesta 6).

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | F-01…F-05 y F-08 citados |
| 2 | Reglas | ✅ | RN-01…RN-13 |
| 3 | Impacto | ✅ | `SuscripcionStore.spec.ts` cambia |
| 4 | Arquitectura | ✅ | standalone, `inject()`, `signalStore`, `rxMethod`, presentacional sin DI |
| 5 | Riesgos | ✅ | tabla |
| 6 | Simplicidad | ✅ | un store, un servicio de marca, un componente |
| 7 | Seguridad | ✅ | sin tokens en almacenamiento; el servidor decide |
| 8 | Cobertura | ✅ | |
| 9 | Determinismo | ✅ | |
| 10 | Ejecutabilidad | ✅ | |

**Ataques considerados.** *Cambiar la hora del dispositivo para alargar la prueba:* la app solo muestra; el servidor decide y recalcula (RN-04, B-04). *Reclamar la prueba desde el cliente:* el cuerpo es `{}` y el servidor ignora planes. *Repetirla con la misma cuenta o reinstalando:* 409 y se trata como éxito (RN-02). *Carrera entre dos pestañas:* el servidor es idempotente. *Marca «avisado» manipulada:* solo afecta a un aviso, no a permisos. *Falla de red al conceder:* sin marca, se reintenta (RN-02). *Usuario con reserva de pago y prueba fallida:* D-07. *Cuenta anterior sin plan:* RN-12. *Reloj monótono pausado en suspensión:* RN-06 recalcula al volver.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | **El control de planes es solo de la app; los backends no limitan funciones** | **Alta** | Explícito en la HU; HLT-20 lo implementa en la app y la historia siguiente en el servidor |
| R-02 | Ventana de 30 s con un contador desfasado | Baja | Recarga al volver y al llegar a 0 |
| R-03 | `SuscripcionStore.spec.ts` existente falla por el cambio de contrato | Media | T-07 lo reescribe (SI-1…SI-9) |
| R-04 | Sin pantalla de comprobante, el pendiente no avanza desde la app | Media | Historia futura explícita (respuesta 6); mientras tanto el comprobante se sube por la API |

**Rondas.** *Ronda 1 — CON CAMBIOS:* el orden reserva → prueba y la marca parcial (RN-01, RN-02, D-07). *Ronda 2 — CON CAMBIOS:* rev. 4 añade F-08 y el `planPendiente` (RN-08, RN-09). *Ronda 3 — APROBADO:* rev. 5 solo cambia el menú, que se traslada a HLT-20; este HLT no cita la regla antigua «Libre = solo inicio y criterio Kelly». **Veredicto: APROBADO.**
*Ronda 4 (respuestas del usuario) — APROBADO.* La pantalla de comprobante pasa a historia futura explícita en «Fuera de alcance» y H4; sin tareas nuevas.
*Ronda 5 (v2, decisiones del usuario del 2026-11-12) — CON CAMBIOS → APROBADO.* (a) `NUNCA_TUVO_PLAN` deja de ser silencioso: aviso «Debes activar un plan» (RN-07, RN-12, D-04); ataque *cuenta nueva aún sin concesión ve el aviso* → la concesión se pide antes de leer el plan (RN-01), y el aviso solo sale si tras ella sigue `SIN_PLAN`. (b) El modelo incorpora `LimitesPlan` desde ya, para que HLT-25-v2 y HLT-27-v2 no vuelvan a tocarlo. (c) La pantalla de comprobante pasa a HLT-25-v2. **Veredicto: APROBADO.**
*Ronda 6 (DT-15 y DT-16, 2026-11-13) — APROBADO.* Se añade el aviso de la renovación pendiente tras el corte (RN-14, D-04, PV-15/16) y la frase «Tu plan corre desde la fecha de tu comprobante» (RN-08). Ataques: *el cliente crea o cancela la renovación* → no: solo lee `planVigente`; *aviso repetido al recargar* → la marca de RN-07; *renovación sin forma de pagar* → el botón «Subir comprobante» llega con HLT-25-v2 y, mientras tanto, el texto indica qué hacer.
*Ronda 7 (DT-12 ajustada, DT-16 con su alcance y DT-17, 2026-11-13) — APROBADO.* El estado 6 de la HU se descompone en la app: renovación dentro de los 30 días = estado 3 con «Tienes N días para pagarlo» (RN-14, D-04); renovación anulada = Libre (estado 2) con aviso propio, que depende de la marca previa (`SIN_PLAN`, no `PRUEBA`) para no confundirlo con el Libre de la prueba (D-04); Libre terminado = estado 4. El periodo pagado por anticipado se muestra como tarjeta permanente (PV-18). Ataques: *aviso de anulación repetido al recargar* → la marca de RN-07; *cálculo de los días con el reloj del dispositivo* → solo `diasRestantesPago` del servidor.

---

## H7 · Plan de tareas

Todas `desarrollador-ionic`, salvo la puerta T-12. Rutas relativas a `criterioKellyApp/src/app/` (`P` = `paginas/suscripcion/`), `EV` = `docs/Planificacion/evidencias` (raíz del workspace).

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | `EV/HLT-19/antes/lint.txt`, `test.txt`, `build.txt`, `contrato.txt` (nuevos) | — | `curl -s -o /dev/null -w "%{http_code}"` a `…/suscripcion/planVigente` sin token = `401`; contrato de HLT-16 verificado con un token de fixture (campos de H3 presentes); línea base de `npx ng lint`, `npx ng test --watch=false --browsers=ChromeHeadless` (con `CHROME_BIN` de Edge) y `npx ng build`, guardando salida y código | G-03 |
| T-02 | Modelo del plan vigente | `P/modelos/PlanVigente.modelo.ts` (nuevo) | T-01 | Interfaces `PlanVigente` (con `limites: LimitesPlan`), `LimitesPlan` (claves y tipos de RN-25 de HLT-16-v4: `number | null` y `boolean`), `PlanDelPlanVigente`, `PlanSiguiente`, `PlanPendiente` (con `esRenovacion`, `fechaLimitePago` y `diasRestantesPago`), `PlanProgramado`, tipo `EstadoPlan` y `MotivoSinPlan` con los nombres de campo del servidor tal cual; sin `any`; `npx ng lint` sin errores en el archivo | AR-3 |
| T-03 | Servicio HTTP | `P/servicios/suscripcion.service.ts` | T-02 | Métodos `obtenerPlanVigente()` (GET `suscripcion/planVigente`) y `iniciarPrueba()` (POST `suscripcion/iniciarPrueba` con cuerpo `{}`), ambos con `context: new HttpContext().set(OMITIR_MANEJO_ERROR, true)` como `crearSuscripcionInicial` (`:30-38`); solo HTTP; spec `suscripcion.service.spec.ts` (nuevo) con `HttpTestingController` verifica URL, método, cuerpo y contexto | F-01, F-04 |
| T-04 | Servicio de marca de aviso | `P/servicios/plan-avisado.service.ts`, `P/servicios/plan-avisado.service.spec.ts` (nuevos) | T-02 | `obtener(usuarioId)`, `guardar(usuarioId, estado, idSuscripcion)` y `borrar()` sobre `localStorage['plan_vigente_avisado']` con `try/catch` (patrón `plan-reservado.service.ts:279-317`); specs PA-1…PA-5 (sin marca, otro usuario, JSON corrupto, almacenamiento bloqueado, guardado) pasan | RN-07, RN-11 |
| T-05 | Store del plan vigente | `P/store/plan-vigente.store.ts`, `P/store/plan-vigente.store.spec.ts` (nuevos) | T-03, T-04 | `signalStore` con estado `{plan, usuarioId, recibidoEnMs, ahoraMs, aviso, cargado, loading, error}`; `withComputed`: `isLoading`, `errorMessage`, `estado`, `esPrueba`, `segundosRestantes`, `textoTiempoRestante`, `diasRestantes`, `planPendiente`, `mensajePendiente`, `aviso`; `withMethods`: `cargar` (rxMethod con el pipeline estándar), `establecer(usuarioId, plan)`, `vigilar` (rxMethod: `timer` de 30 s + `visibilitychange`), `marcarAvisoLeido`, `limpiar`; ningún `Date`/`Date.now`/`new Date` (`grep -nE "new Date\(|Date\.now\(" plan-vigente.store.ts` vacío); specs PV-1…PV-19 pasan (PV-15: `SIN_PLAN`/`PLAN_PAGO_VENCIDO` con `planPendiente` de renovación → «Tu plan <nombre> terminó. Tienes N días para pagarlo; si no, pasarás al plan Libre», incluido N = 0; PV-16: sin `planPendiente` → «Tu plan de pago terminó»; PV-17: `LIBRE` con marca previa `SIN_PLAN` → aviso de anulación y, después, `SIN_PLAN`/`LIBRE_TERMINADO` → «Terminó tu plan Libre»; PV-18: `PAGO` con `planProgramado` → «Tu renovación ya está pagada, empieza el <fecha>»; PV-19: `PAGO` con `planPendiente` → «Tu pago por anticipado está en revisión») (`ng test --include='**/plan-vigente.store.spec.ts'`) | F-02, F-03, F-05, RN-04…RN-07, RN-13 |
| T-06 | Componente presentacional del aviso | `P/aviso-plan/aviso-plan.component.ts`, `.html`, `.scss`, `aviso-plan.component.spec.ts` (nuevos) | T-05 | Standalone con `IonicComponentes`; `input()` de `textoTiempo`, `aviso`, `planPendiente`, `estado`; `output()` `entendido`; **sin** `inject(`, `Router` ni stores (`grep -c "inject(" aviso-plan.component.ts` = 0); pinta la prueba en curso, el aviso de transición y la tarjeta de plan pendiente con el texto exacto de RN-08; specs AC-1…AC-5 pasan; SCSS ≤ 14 KB | F-02, F-03, F-08, F-04 |
| T-07 | Concesión en el primer inicio de sesión | `P/store/SuscripcionStore.ts`, `P/store/SuscripcionStore.spec.ts` | T-03, T-05 | `asegurarSuscripcionInicial` (`:92-126`) implementa RN-01/RN-02 con `concatMap`; `PLAN_LIBRE_ID_INTERVALO` sigue importado; llama a `PlanVigenteStore.establecer` con la respuesta; los specs SI-1…SI-6 existentes se reescriben y se añaden SI-7 (reserva de pago antes de prueba), SI-8 (409 en la prueba = éxito), SI-9 (429/500/0 sin marca y con reserva intacta); `ng test --include='**/SuscripcionStore.spec.ts'` verde | F-01, RN-01…RN-03 |
| T-08 | Mostrar el aviso en el inicio | `inicio/inicio.page.ts`, `inicio/inicio.page.html` | T-06, T-07 | `InicioPage` inyecta `PlanVigenteStore` y `SesionStore`, implementa `ionViewWillEnter` (carga y `vigilar`), y la plantilla coloca `<app-aviso-plan …>` antes de la lista con `(entendido)="planVigenteStore.marcarAvisoLeido()"`; el resto del inicio (`refrescarPantalla`, `gruposMenu`) intacto; `ng lint` limpio en los archivos; spec `inicio.page.spec.ts` (nuevo) verifica que se llama a `cargar` | F-02, F-05 |
| T-09 | Plan pendiente al terminar el registro | `registro/registro.page.ts`, `registro/registro.page.html`, `registro/registro.page.spec.ts` | T-06 | Tras `registroExitoso()` (`registro.page.ts:90-95`) con un plan de pago elegido (`pin_precioFinal > 0`) se muestra en el bloque de `registro.page.html:403` el texto de RN-09 (señal `mensajePlanPendiente`); con plan Libre no se muestra; spec RG-1/RG-2 verde | F-08, RN-09 |
| T-10 | Ejecutar las pruebas de la app | `EV/HLT-19/despues/test.txt` | T-04…T-09 | `ng test --watch=false` completo en verde, sin pruebas omitidas por este HLT; cifras antes/después en el archivo | G-03 |
| T-11 | Lint y build | `EV/HLT-19/despues/lint.txt`, `build.txt` | T-10 | `npx ng lint` y `npx ng build` con código 0; sin avisos nuevos respecto a `antes/`; `grep -rn "console\.log" ` en los archivos nuevos vacío | G-03 |
| T-12 | **PUERTA humana:** prueba manual en la app | `EV/HLT-19/puerta_manual.txt` (nuevo) | T-11 | El agente deja el guion (H8 §RI-2) y se detiene; la tarea pasa a `HECHA` solo cuando el usuario responde por escrito «PRUEBA MANUAL HLT-19 OK» (o describe un fallo, entonces `BLOQUEADA`). El agente **no** inicia ni detiene Apache/MySQL | F-01…F-08 |
| T-13 | Documentar | `criterioKellyApp/CLAUDE.md`, `criterioKellyApp/README.md` | T-12 | La sección «Primer inicio de sesión» describe el nuevo orden y `plan_vigente_avisado`; se añade «Plan vigente» (store, aviso, marca); `grep -c "plan_vigente_avisado" CLAUDE.md` ≥ 2 | RN-11 |
| T-14 | Entregar archivos y mensajes de commit sugeridos | `EV/HLT-19/entrega.txt` (nuevo) | T-13 | `git status --short` (solo lectura) y lista de archivos; mensajes sugeridos (no se ejecutan): «HU-004: concesión de la prueba y aviso del tiempo restante en la app» y «Docs: CLAUDE.md de la app con el plan vigente»; hash `➖` | — |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11 → T-12 → T-13 → T-14. (T-03 y T-04 son paralelizables.)

---

## H8 · Reglas de implementación deterministas

- **RI-1 · Reglas del proyecto (H8 del contrato).** RI-1 standalone, RI-2 `inject()`, RI-3 `loading` y `error` en el estado y sin re-exportar un signal de `withState` con el mismo nombre en `withComputed` (error conocido de `@ngrx/signals`), RI-4 pipeline `rxMethod` (loading → `switchMap` → `patchState` → `catchError` → `finalize`), RI-7 idioma español y comillas simples, RI-8 errores por `errorInterceptor` salvo las llamadas con `OMITIR_MANEJO_ERROR`, RI-9 reutilizar `IonicComponentes`, RI-10 sin tocar archivos no declarados.
- **RI-2 · Guion de la puerta T-12.** (1) Con los servicios en marcha y `ionic serve --port=8100`, registrar una cuenta nueva `ck_prueba_hu4_m1` eligiendo un plan de pago: debe aparecer «quedará pendiente de pago…»; (2) activar la cuenta; (3) iniciar sesión: el inicio muestra «Tu prueba termina en 23 h 59 min» y la tarjeta de plan pendiente; (4) recargar la página y cambiar la hora del equipo: el tiempo no cambia; (5) en la base local (solo `UPDATE` de su fixture) poner `sus_fechaHoraFin` de su prueba en el pasado y volver a la pestaña: aparece el aviso «Tu prueba terminó; estás en el plan Libre y te quedan 10 días» una sola vez y no reaparece tras recargar; (6) cerrar sesión. El usuario ejecuta o autoriza; el agente no toca MySQL/Apache.
- **RI-3 · Specs.** Cada spec limpia `localStorage` en `beforeEach` y `afterEach`; el tiempo se simula inyectando una función de reloj monótono en el store (`const RELOJ_MONOTONICO = new InjectionToken<() => number>(…)` con valor por defecto `() => performance.now()`).
- **RI-4.** Sin `npm install` salvo que falte `node_modules`; entonces `npm install --legacy-peer-deps`. Sin commits ni reportes `.md`.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9. Ficha por tarea: `Estado`; **C1** cambios solo en archivos declarados; **C2** criterio de H7 con salida real; **C3** reglas de H8/H11; **C4** `ng lint`; **C5** `ng test --include=…`; **C6** sin efectos fuera de alcance; `Evidencia`; `Notas`.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ➖ | ⬜ | No |
| T-03…T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-10, T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-13, T-14 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

Estructura fija: 1 Resumen · 2 Estado global · 3 Tablero · 4 Cobertura (F-01…F-05, F-08; RN-01…RN-13) · 5 Cambios `ruta:línea` · 6 Verificaciones (salida de `ng lint`, `ng test`, `ng build` y de la puerta) · 7 Desviaciones · 8 Pendientes (PU-2) · 9 Próximos pasos (HLT-20). RR-1…RR-5; el coordinador guarda el `.md`.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

DDD ligero por feature: todo bajo `paginas/suscripcion/{modelos,servicios,store,aviso-plan}`; dependencia presentación → store → servicio → modelo (AR-2); `camelCase` para variables y métodos (`cargar`, `marcarAvisoLeido`), `PascalCase` para clases (`AvisoPlanComponent`, `PlanAvisadoService`), constantes `UPPER_SNAKE_CASE` (`INTERVALO_TICK_MS = 30_000`, `CLAVE_PLAN_AVISADO = 'plan_vigente_avisado'`, `SEGUNDOS_POR_DIA = 86_400`), sin números mágicos; archivos kebab-case con sufijo de rol (AF-1) y `PlanVigente.modelo.ts` por AF-4; selector `app-aviso-plan`; estilos SCSS ≤ 14 KB; comentarios y textos en español; commits por el usuario.
