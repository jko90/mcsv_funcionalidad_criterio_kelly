# HLT-20-v2 — App: menú y guarda de rutas según el estado del plan, elegir un plan y cancelar el plan de pago (HU-004 rev. 5: F-06, F-07, F-09, F-10, DT-10, DT-14 · decisión 4 del usuario del 2026-11-12)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-12 (v2; revisado el 2026-11-13 por DT-15, DT-16 y DT-17) |
| Historia | `docs/Historia_usuario/HU-004-plan-de-prueba-24-horas.md` (rev. 5), sección «Menú según el estado del plan» y criterios **F-06, F-07, F-09, F-10**; DT-09, DT-10, DT-14. **Regla vigente (rev. 5):** prueba y Libre → menú completo; la regla anterior «Libre = solo inicio y criterio Kelly» **ya no aplica** y no se implementa |
| Numeración | Vigentes: HLT-15-v2 · HLT-16-v4 · HLT-17-v4 · HLT-18 · HLT-19-v2 · **HLT-20-v2 (este)** · HLT-21-v2 · HLT-24-v2 · HLT-25-v2 · HLT-26-v2 · HLT-27-v2 · HLT-28-v2 |
| Proyecto y git | `criterioKellyApp` (git propio). El backend no se toca |
| Agente | `desarrollador-ionic` en todas las tareas (T-13 es una puerta humana) |
| Depende de | **HLT-19-v2 COMPLETADO** (`PlanVigenteStore`, `AvisoPlanComponent`, `InicioPage` con aviso) y **HLT-16-v4, HLT-17-v4, HLT-18 COMPLETADOS** (`planVigente` con `estado`, `motivoSinPlan`, `planPendiente`, `cancelado`; `suscripcion/cancelar`; `crearSinPago` que ya no choca con la prueba). Se comprueba en T-01 |
| Lo consume | HLT-21-v2, HLT-25-v2, HLT-26-v2 y HLT-27-v2 (amplían `permisos-plan.config.ts`) |
| Entorno | Node/Angular 20/Ionic 8; Karma con Edge (`CHROME_BIN`, README de la app); servicios en `http://localhost/criterio_kelly/rest_<nombre>/` |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 7) |
| Estado | Pendiente de ejecución |

> **Reglas de entorno (obligatorias).** (1) MySQL/Apache intocables (sin iniciar, detener, reiniciar ni reparar; sin escribir en `mysql.*`); si falla, el agente se detiene. (2) Commits del usuario: sin `git add/commit/push/checkout/reset/stash/clean`; entrega de archivos y mensajes sugeridos; hash = `➖`. (3) Sin reportes `.md` en `evidencias/` (solo `.txt`). (4) Cuentas `ck_prueba_hu4_*`. (5) La decisión de menú sale **siempre** del plan vigente del servidor; nunca de un dato guardado en el dispositivo (F-07). (6) El token no se guarda en almacenamiento persistente.

---

## H1 · Propósito

**Requerimiento literal (HU-004 rev. 5).** «**F-06** Menú según el estado del plan […] Con la prueba, con el plan Libre en curso y con un plan de pago vigente, el menú está completo (en el Libre, con los límites del Libre). Con el **Libre terminado y un plan de pago pendiente** solo están habilitados el **inicio** y **Mostrar criterio Kelly**. Con el **Libre terminado y sin plan de pago elegido**, o con el plan de pago cortado, el menú sigue visible pero cada opción, salvo **Mostrar criterio Kelly**, muestra el aviso «debes activar un plan» con la lista de planes vigentes para elegir uno. **F-07** Las rutas no habilitadas por el plan no se pueden abrir escribiendo la dirección: un guarda de rutas lleva al aviso que corresponda al estado […] **Mostrar criterio Kelly** y el inicio no se bloquean en ningún estado. **F-09** La app permite cancelar el plan de pago (X-01) con una confirmación, y muestra la fecha en que termina. **F-10** La configuración de qué opciones habilita cada plan vive en un solo lugar de la app (no repartida por las páginas) y los componentes presentacionales no deciden permisos.» Tabla de la HU: estados 1 Prueba y 2 Libre → completo; 3 Libre terminado + plan de pago pendiente → solo Inicio y Mostrar criterio Kelly, con el aviso «tu plan <nombre> está pendiente de pago y se activará cuando el administrador valide tu comprobante»; 4 Libre terminado sin plan de pago elegido → mismo menú, bloqueado salvo Mostrar criterio Kelly, con «debes activar un plan» y la lista de planes; 5 plan de pago vigente → completo; 6 plan de pago cortado → igual que el 4 (suposición a confirmar, PU-1).

**Propósito.** Que la app muestre y habilite las opciones que corresponden al estado del plan, aunque la persona escriba la dirección a mano, y le dé una salida clara (elegir un plan, ver que está pendiente, cancelar), sabiendo que el control es solo de la app.

**Resultado esperado (observable).**
1. Con prueba, Libre o plan de pago vigente, todas las opciones del menú abren su pantalla.
2. Con el Libre terminado (o el plan de pago cortado, cuya renovación pendiente de pago dura 30 días, DT-15 y DT-17) y **plan de pago pendiente**: solo el inicio y `/mostrar-criterio-kelly` abren; tocar otra opción (en el menú lateral, en el inicio o escribiendo la ruta) lleva al inicio con el aviso «Tu plan <nombre> está pendiente de pago y se activará cuando el administrador valide tu comprobante. Tu plan corre desde la fecha de tu comprobante». La persona debe pagar para volver a usar el plan; el botón «Subir comprobante» llega con HLT-25-v2.
3. Con el Libre terminado (o el plan de pago cortado sin renovación, o cuando una renovación se anuló y el Libre nuevo terminó) **sin plan pendiente**: el menú se ve igual y cada opción salvo `/mostrar-criterio-kelly` lleva al inicio con «Debes activar un plan» y la lista de los planes de `planes/disponible` (sin el de prueba y solo los de pago) para elegir uno; al elegir se crea la suscripción pendiente (`crearSinPago`), el plan vigente se vuelve a leer y el estado pasa al punto 2.
3b. Si la renovación pendiente no se paga en 30 días, el servidor la anula y concede un Libre de 10 días: el menú vuelve a estar completo con los límites del Libre (estado 2) y, al terminar ese Libre, pasa al estado 4 (punto 3). El estado 6 de la tabla de la HU queda así descompuesto: renovación dentro del plazo = estado 3; tras la anulación = estado 2 y luego estado 4; sin renovación (plan cancelado) = estado 4.
4. Las cuentas anteriores sin ningún plan (`NUNCA_TUVO_PLAN`) se tratan como sin plan vigente (estado 4, o 3 si tienen un plan pendiente; decisión 4 del usuario); un fallo al leer el plan **no** restringe (D-03).
5. Con un plan de pago vigente, el inicio ofrece «Cancelar plan» con confirmación; tras cancelar muestra «Tu plan termina el <fecha>» (la `fechaCorte` del servidor o, si hay un periodo ya pagado por anticipado, `planProgramado.fechaFin`). Con un plan de pago vigente y un periodo programado, el menú sigue completo (estado 5) y el inicio muestra «Tu renovación ya está pagada, empieza el <fecha>» (HLT-19-v2).
6. Toda la tabla de permisos está en un único archivo; ningún componente presentacional decide permisos.

**Fuera de alcance.** Aplicar límites de plan en los backends (riesgo Alta R-01: quien llame a las APIs a mano conserva todas las funciones); mostrar los límites numéricos del Libre dentro de cada pantalla (A-4); **la pantalla para subir el comprobante de pago: historia futura explícita que pedirá el usuario más adelante, sin tareas aquí**; ventana de administración; renovar planes; correo o push; cambiar `menu.json`.

**Feature(s) afectada(s).** `src/app/paginas/suscripcion/` (`configuracion/` nueva, `store/`, `servicios/`, `aviso-plan/`, nuevo `aviso-bloqueo/`), `src/app/compartidos/seguridades/` (guarda), `src/app/paginas/inicio/`, `src/app/app.routes.ts`. Lectura: `assets/datos/menu.json`, `compartidos/store/menu.store.ts`, `compartidos/servicios/menu.service.ts`, `app.component.ts`, `GuardAutenticacion.ts`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable | Fuente |
|----|-------|------------------------|--------|
| RN-01 | Una sola configuración de permisos por estado | `paginas/suscripcion/configuracion/permisos-plan.config.ts` exporta `RUTAS_SIEMPRE_HABILITADAS = ['/inicio', '/mostrar-criterio-kelly']`, `RUTAS_CONTROLADAS` y la función `estadoMenuDesdePlan`; `grep -rnE "'/(bitacora|cuentas|perfil|operativas|analisis)'" src/app --include=*.ts -l` fuera de ese archivo, `app.routes.ts` y los specs no lista ningún archivo que decida permisos | F-10 |
| RN-02 | Estados del menú (decisión cerrada, D-01) | `COMPLETO` si `plan` es `null` (sin cargar o error) o `estado ∈ {PRUEBA, LIBRE, PAGO}`; `MINIMO_PENDIENTE` si `estado = SIN_PLAN` (cualquier `motivoSinPlan`, también `NUNCA_TUVO_PLAN`) y `planPendiente ≠ null`; `SIN_PLAN` si `estado = SIN_PLAN` y `planPendiente = null` | Tabla de la HU, estados 1-6; decisión 4 del usuario |
| RN-03 | Rutas siempre abiertas | `/inicio` y `/mostrar-criterio-kelly` nunca se bloquean; tampoco `/planes`, `/login`, `/registro`, `/recuperar-clave`, `/verificar-correo`, `/bloqueo`, `/modal-pin` | F-07 |
| RN-04 | Rutas controladas | `/bitacora`, `/bitacora-seguimiento`, `/bitacora-fin`, `/busca-divisa`, `/operativas`, `/analisis`, `/grafico-stadistico`, `/cuentas`, `/operativa-kelly`, `/perfil`, `/cambiar-pin`, `/ayuda`, `/acerca-d` (las 11 opciones de `menu.json` salvo el criterio Kelly y el inicio, más sus pantallas hijas) | F-06, F-07 |
| RN-05 | La decisión sale del servidor | El guarda y el menú leen `PlanVigenteStore.plan()` (viene de `planVigente`); no existe lectura de `localStorage`/`sessionStorage` para decidir; `grep -n "localStorage" plan.guard.ts permisos-plan.config.ts` vacío | F-07 |
| RN-06 | El guarda no depende de que la pantalla ya haya cargado | Si el plan no se ha cargado, el guarda lo pide y espera (con un máximo de 3 s); si falla o se agota, **permite** (decisión D-03) | F-07, RN-13 de HLT-19 |
| RN-07 | Qué pasa al bloquear | El guarda devuelve `UrlTree('/inicio')` y registra el motivo en `PlanVigenteStore` (`bloqueo = {estado, rutaIntentada}`); `InicioPage` muestra `AvisoBloqueoComponent` con el texto del estado: `MINIMO_PENDIENTE` → «Tu plan <nombre> está pendiente de pago y se activará cuando el administrador valide tu comprobante. Tu plan corre desde la fecha de tu comprobante»; si el `planPendiente` es la renovación creada por el servidor tras el corte (`esRenovacion`, DT-15), el texto es «Tu plan <nombre> terminó. Tienes <diasRestantesPago> días para pagarlo; si no, pasarás al plan Libre» (con 0 días, «Hoy es el último día para pagarlo…»); `SIN_PLAN` → «Debes activar un plan» y la lista de planes | F-07 |
| RN-08 | Lista de planes para elegir | `PlanesStore.cargarPlanes` (`GET planes/disponible`, ya sin el plan de prueba por HLT-16) y `planesParaElegir` = combinaciones con `pin_precioFinal > 0`, agrupadas por nombre y ordenadas por `pin_precioFinal` | DT-10, DT-14 |
| RN-09 | Elegir un plan | `SuscripcionStore.elegirPlan(pin_idPlanInterv)` → `POST suscripcion/crearSinPago {sus_pinIdPlanin}` → éxito o 409 → recargar `planVigente`; el estado pasa a `MINIMO_PENDIENTE`; otros errores muestran el toast del interceptor | DT-10 |
| RN-10 | Cancelar | Solo con `estado = PAGO` y `cancelado = false`: botón «Cancelar plan» → `AlertController` de confirmación en la página → `POST suscripcion/cancelar` (cuerpo `{}`) → `PlanVigenteStore.establecer(plan)`; con `cancelado = true` se muestra «Tu plan termina el <fechaCorte>» y no el botón | F-09 |
| RN-11 | Presentación sin permisos | `AvisoPlanComponent` y `AvisoBloqueoComponent` no tienen `inject(`, `Router` ni stores; reciben datos por `input()` y emiten `output()` | F-10, F-04 |
| RN-12 | Menú visible | `menu.json`, `MenuStore` y `MenuService` no cambian; los elementos del menú lateral y del inicio siguen visibles; el bloqueo ocurre al navegar (guarda) | F-06 |
| RN-13 | Rutas sin sesión | `/ayuda` y `/acerca-d` hoy no tienen `GuardAutenticacion` (`app.routes.ts:53-63`): el guarda de plan permite si no hay sesión, de modo que su acceso previo no cambia | RD-7 |
| RN-14 | Sin tocar el 422 ni los toasts ajenos | Las lecturas de plan usan `OMITIR_MANEJO_ERROR`; el 422 sigue reservado | `error.interceptor.ts:13-18,48-50` |

---

## H3 · Flujo principal de ejecución

**Contrato consumido (campo por campo, de HLT-16/HLT-18).** `GET suscripcion/planVigente` → `PlanVigente` (ver HLT-19 H3): se usan `estado`, `motivoSinPlan`, `planPendiente {pla_nombre, ins_nombre, comprobanteEnviado, pin_idPlanInterv}`, `cancelado`, `fechaCorte`. `POST suscripcion/crearSinPago {sus_pinIdPlanin}` → `SuscripcionModelo` (200) o 409. `POST suscripcion/cancelar {}` → `PlanVigente` o 409/403. `GET planes/disponible` → `PlanesModelo[]`.

**Flujo A — navegar a una opción controlada.**
```
[Toque en el menú lateral / en el inicio / ruta escrita] Router → plan.guard (CanActivateFn)
  ├─ sin sesión → permitir (RN-13)
  ├─ ruta ∈ RUTAS_SIEMPRE_HABILITADAS o ∉ RUTAS_CONTROLADAS → permitir
  ├─ plan no cargado → PlanVigenteStore.cargar y esperar ≤ 3 s → (falla/tiempo) permitir
  └─ estadoMenuDesdePlan(plan) = COMPLETO → permitir
                              = MINIMO_PENDIENTE | SIN_PLAN → registrarBloqueo → UrlTree('/inicio')
InicioPage: <app-aviso-bloqueo [bloqueo] [planes] (elegirPlan) (cerrar)>
  ├─ MINIMO_PENDIENTE → texto de RN-07
  └─ SIN_PLAN → «Debes activar un plan» + lista → elegirPlan → SuscripcionStore.elegirPlan → crearSinPago → cargar plan → MINIMO_PENDIENTE
```
**Flujo B — cancelar.** `InicioPage` (botón) → `AlertController` (Cancelar / Sí, cancelar) → `SuscripcionStore.cancelarPlan` (rxMethod) → `suscripcion/cancelar` → `PlanVigenteStore.establecer` → `AvisoPlanComponent` muestra «Tu plan termina el <fecha>». Errores: 409 → toast del interceptor con el mensaje del servidor; 401 → renovación de sesión por `autenticacionInterceptor`.

**Ramas de error.** 0/5xx al leer el plan → permitir y sin toast (RN-06); 409 en `crearSinPago` → recargar y seguir; 429 → toast del interceptor; el 422 no interviene.

---

## H4 · Calidad del HLT y cobertura

| Requerimiento / RN | Tareas | Verificación |
|--------------------|--------|--------------|
| F-06 / RN-02, RN-12 | T-02, T-03, T-11 | spec `permisos-plan.config.spec.ts` (tabla completa de estados × rutas) |
| F-07 / RN-03…RN-07, RN-13 | T-03, T-06, T-07, T-11 | spec `plan.guard.spec.ts` (permitir/bloquear/sin sesión/fallo/tiempo) |
| F-10 / RN-01, RN-11 | T-02, T-08, T-09, T-12 | `grep` de RN-01 y de `inject(` en los componentes |
| F-09 / RN-10 | T-04, T-05, T-09, T-10 | specs `SuscripcionStore.spec.ts` (CA-1…CA-4), `inicio.page.spec.ts` |
| DT-10 lista de planes / RN-08, RN-09 | T-03, T-05, T-08, T-10 | specs EP-1…EP-4 |
| DT-14 estado 6 (descompuesto por DT-17) | T-02 | casos de la tabla descompuesta (estados 3, 2 y 4) y `PAGO` con `planProgramado` |
| RN-14 | T-04 | spec del servicio (contexto) |
| Calidad G-03 | T-12 | `ng lint`, `ng test --watch=false`, `ng build` |
| Pantalla de subida del comprobante de pago | — | **Historia futura explícita, sin tareas**; fuera de alcance |

### Discrepancias HU ↔ código
| # | HU | Realidad | Resolución |
|---|----|----------|------------|
| C-1 | «Menú» con opciones habilitadas/bloqueadas | El menú es un JSON estático y no tiene concepto de permiso (`menu.json`, `menu.service.ts:12-14`); se renderiza igual en `app.component.html` y en `inicio.page.html` | El bloqueo va en las rutas (guarda), no en el menú: así también cubre la ruta escrita (F-07) |
| C-2 | «Opciones del menú» | Hay rutas hijas fuera del menú (`busca-divisa`, `grafico-stadistico`, `cambiar-pin`) | RN-04 las incluye en las controladas |
| C-3 | Cuentas anteriores sin plan | Las cuentas anteriores (22 con solo suscripciones `P` y las que no tienen ninguna) quedan restringidas | Decisión 4 del usuario (2026-11-12): se restringen como cualquier cuenta sin plan; las que tienen un plan `P` ven el estado 3 con el acceso al comprobante (HLT-25-v2) |
| C-4 | «Elegir plan» desde la app | No existe pantalla de compra con sesión ni de subida de comprobante | La lista de planes crea la suscripción pendiente con `crearSinPago`; el comprobante queda para una historia futura explícita (respuesta 6) |
| C-5 | `ayuda` y `acerca-d` | Rutas sin guarda de sesión | RN-13 |

### Checklist de calidad del HLT
- [x] 11 secciones completas · [x] sin marcadores · [x] cobertura 100 % · [x] criterios verificables · [x] respeta standalone, `inject()`, `signalStore`, `rxMethod`, `IonicComponentes` · [x] referencias leídas el 2026-11-11 · [x] decisiones cerradas.

---

## H5 · Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones | Elegida | Justificación | ¿Irreversible? |
|----|----------|----------|---------|---------------|----------------|
| D-01 | Estados de menú | tabla de RN-02 | cerrada | Sigue la tabla de la HU; `NUNCA_TUVO_PLAN` = sin plan vigente (decisión 4 del usuario, sustituye a «completo» de la v1) | No |
| D-02 | Dónde bloquear | A) ocultar opciones del menú; B) guarda de rutas + aviso | **B** | F-07: no basta con ocultar; el menú debe seguir visible (rev. 5) | No |
| D-03 | Qué hacer si no se puede leer el plan | A) bloquear (fail-closed); B) permitir (fail-open) | **B** | El control es solo de la app (R-01) y un fallo de red no debe dejar a nadie fuera; el reintento ocurre al volver a la app | No |
| D-04 | Estado 6 (plan de pago cortado) | A) igual que el 4; B) descompuesto | **B — CERRADA por el usuario (DT-17, 2026-11-13; antes «A»)** | Con renovación pendiente dentro de los 30 días = estado 3; tras anularse = Libre (estado 2) y luego estado 4; sin renovación (cancelado) = estado 4. La app no cambia de regla: lo decide el servidor con `estado` y `planPendiente` (RN-02) | No |
| D-05 | Qué planes se ofrecen | Combinaciones de pago (`pin_precioFinal > 0`) de `planes/disponible` | cerrada | El Libre ya se usó (RN-08) y el de prueba no sale del servidor | No |
| D-06 | Archivo del guarda | `compartidos/seguridades/plan.guard.ts` funcional (`CanActivateFn`) | cerrada | Transversal a varias features; kebab-case por AF-1 (los guardas heredados son PascalCase, AF-4) | No |
| D-07 | Dónde se muestra el aviso de bloqueo | `InicioPage` (destino de la redirección) | cerrada | Una sola pantalla; el inicio nunca se bloquea | No |
| D-08 | Confirmación de cancelar | `AlertController` en `InicioPage` (la página puede inyectar controladores de UI, como `app.component.ts:34`) | cerrada | Los componentes presentacionales no inyectan | No |
| D-09 | Textos | Los arma el store/configuración; los componentes los pintan | cerrada | F-10 | No |
| D-10 | Tiempo máximo de espera del guarda | 3 000 ms | cerrada | Evita bloquear la navegación | No |

**Preguntas no bloqueantes.** Ninguna abierta.

**Preguntas del usuario (CERRADAS el 2026-11-11).** (1) «Sí» a reconstruir los scripts de pruebas: `docs/Planificacion/evidencias/` **ya no existe** y no hay copia; las líneas base antiguas de HU-001/HU-003 dejan de ser referencia comparativa y la nueva línea base se toma sobre el código actual (reconstrucción en HLT-15 T-02 y línea base en T-02b). (2) «Sí»: plan de pago cortado = Libre terminado sin plan (estado 6 = estado 4). (3) «No puede»: un administrador **no** confirma ni rechaza su propio pago, sin excepciones aunque sea el único administrador; las pruebas usan pagos fixture de otro usuario. (4) «Sí»: se acepta como riesgo que las cuentas registradas entre la aplicación del esquema y el despliegue de HLT-16 reciban la prueba. (5) «Sí»: la suscripción 28 puede pasar a `E` por la regla de corte. (6) «Sí, pero será después»: la pantalla para subir el comprobante de pago **no se planifica ahora**; es una historia futura explícita (el usuario la pedirá), sin tareas en estos HLT.

**Aplicación en este HLT:** PU-1 (estado 6) y PU-2 (pantalla de comprobante) quedan **CERRADAS** (respuestas 2 y 6).

---

## H6 · Revisión del requerimiento por parte de un senior (adversarial)

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | Implementa la tabla de la rev. 5; la regla anterior del Libre está descartada |
| 2 | Reglas | ✅ | RN-01…RN-14 |
| 3 | Impacto | ✅ | `app.routes.ts` (13 rutas), `InicioPage`, stores de suscripción |
| 4 | Arquitectura | ✅ | guarda funcional, config única, componentes presentacionales |
| 5 | Riesgos | ✅ | tabla |
| 6 | Simplicidad | ✅ | sin tocar el menú ni el backend |
| 7 | Seguridad | ✅ | el control es solo de la app; ver R-01 |
| 8 | Cobertura | ✅ | |
| 9 | Determinismo | ✅ | |
| 10 | Ejecutabilidad | ✅ | |

**Ataques considerados.** *Escribir la ruta a mano:* el guarda la intercepta (RN-04). *Abrir la pantalla mientras el plan carga:* el guarda espera (RN-06). *Manipular `localStorage` para saltar el bloqueo:* la decisión no lee almacenamiento (RN-05). *Cuenta anterior con plan pendiente antiguo (p. ej. usuario 14):* `NUNCA_TUVO_PLAN` con `planPendiente` → `MINIMO_PENDIENTE` (RN-02), con acceso al comprobante. *Elegir dos veces el mismo plan:* 409 → se trata como éxito. *Cancelar el plan de otro:* el endpoint no recibe id desde la app. *Usar las APIs directamente:* lo cierra HLT-24-v2 (puerta sin plan en `rest_criteriokelly`). *Dejar al usuario sin salida:* inicio, criterio Kelly y `/planes` nunca se bloquean.

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | **El control es solo de la app: los backends no aplican límites ni rechazan llamadas de funciones fuera del plan** | **Alta** | Reconocido por la HU; HLT-20 no lo resuelve; historia siguiente en el servidor |
| R-02 | Fail-open permite navegar si el plan no carga | Media | D-03; recarga al volver (HLT-19) |
| R-03 | Elegir plan crea una `P` sin pantalla de comprobante | Media | Historia futura explícita (respuesta 6) |
| R-04 | Rutas nuevas sin añadir a `RUTAS_CONTROLADAS` quedan abiertas | Media | Spec que compara `app.routes.ts` con `RUTAS_CONTROLADAS` + `RUTAS_SIEMPRE_HABILITADAS` y falla si hay una ruta privada sin clasificar |

**Rondas.** *Ronda 1 — CON CAMBIOS:* regla antigua del Libre (rev. 4) con menú mínimo. *Ronda 2 — CON CAMBIOS:* la rev. 5 la sustituye por la tabla de 6 estados; se reescribe RN-02 y se añaden `NUNCA_TUVO_PLAN` (C-3) y la spec de clasificación de rutas (R-04). *Ronda 3 — APROBADO:* ya no aparece en ningún HLT la regla «Libre = solo inicio y criterio Kelly». **Veredicto: APROBADO.**
*Ronda 4 (respuestas del usuario) — APROBADO.* Estado 6 confirmado igual al 4 (D-04 cerrada) y pantalla de comprobante fuera de alcance como historia futura; la tabla de seis estados y las tareas no cambian.
*Ronda 5 (v2, decisiones del usuario del 2026-11-12) — CON CAMBIOS → APROBADO.* `NUNCA_TUVO_PLAN` deja de ser «completo» (RN-02, C-3, D-01); la spec de T-02 lo cubre con y sin plan pendiente. Ataque *cuenta antigua bloqueada sin salida* → inicio, criterio Kelly, `/planes` y (desde HLT-25-v2) `/comprobante` nunca se bloquean. **Veredicto: APROBADO.**
*Ronda 7 (DT-12 ajustada, DT-16 y DT-17, 2026-11-13) — APROBADO.* La decisión D-04 («estado 6 = estado 4») queda sustituida: el estado 6 se descompone en 3, 2 y 4, y RN-02 ya lo resuelve sin cambios porque depende de `estado` y `planPendiente`; se ajustan los textos, la spec de estados, el guion (pasos 7 y 8) y la fecha de «Tu plan termina el …». Ataque: *quedarse en el estado 3 para siempre* → el servidor anula a los 30 días y concede el Libre (HLT-16-v4).
*Ronda 6 (DT-15 y DT-16, 2026-11-13) — APROBADO.* Los estados del menú no cambian: la renovación creada al cortar el plan llega como `planPendiente`, lo que ya produce el estado 3 (RN-02); se completan el texto («Tu plan corre desde la fecha de tu comprobante»), la spec de estados, el paso 5 del guion (que contradecía la decisión 4: `NUNCA_TUVO_PLAN` ya no es «sin restricciones») y el paso 6 de la renovación. Ataque: *ocultar la renovación para seguir usando el plan* → la decisión sale de `planVigente` (RN-05) y el servidor aplica la puerta (HLT-24-v2).

---

## H7 · Plan de tareas

Todas `desarrollador-ionic`, salvo la puerta T-13. Rutas relativas a `criterioKellyApp/src/app/` (`P` = `paginas/suscripcion/`), `EV` = `docs/Planificacion/evidencias`.

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | `EV/HLT-20/antes/*.txt` (nuevos) | — | HLT-19 `COMPLETADO` (existen `P/store/plan-vigente.store.ts`, `P/aviso-plan/aviso-plan.component.ts`); `curl` con token de fixture: `planVigente` devuelve `motivoSinPlan` y `planPendiente`; `POST suscripcion/cancelar` sin token = 401; línea base de `ng lint`, `ng test --watch=false`, `ng build` guardada | G-03 |
| T-02 | Configuración única de permisos | `P/configuracion/permisos-plan.config.ts`, `P/configuracion/permisos-plan.config.spec.ts` (nuevos) | T-01 | Exporta `RUTAS_SIEMPRE_HABILITADAS`, `RUTAS_CONTROLADAS` (RN-04), `type EstadoMenu = 'COMPLETO' | 'MINIMO_PENDIENTE' | 'SIN_PLAN'`, `estadoMenuDesdePlan(plan: PlanVigente | null): EstadoMenu` (RN-02), `estaRutaPermitida(estado, ruta)` y `textoBloqueo(estado, planPendiente)`; spec cubre los 6 estados de la HU (el 6 descompuesto: `PLAN_PAGO_VENCIDO` con `planPendiente` = renovación → `MINIMO_PENDIENTE` (estado 3); renovación anulada → `LIBRE` (estado 2, `COMPLETO`); `LIBRE_TERMINADO` tras la anulación y `PLAN_PAGO_VENCIDO` con renovación cancelada, sin `planPendiente` → `SIN_PLAN` (estado 4); `PAGO` con `planProgramado` o con `planPendiente` de un pago anticipado → `COMPLETO`) + `NUNCA_TUVO_PLAN` con y sin plan pendiente + `null` y las 13 rutas; **spec R-04**: lee `routes` de `app.routes.ts` y falla si una ruta con `GuardAutenticacion` no está en una de las dos listas; `ng test --include='**/permisos-plan.config.spec.ts'` verde | F-06, F-10, RN-01…RN-04 |
| T-03 | Ampliar `PlanVigenteStore` | `P/store/plan-vigente.store.ts`, `P/store/plan-vigente.store.spec.ts` | T-02 | Estado `bloqueo: {estado, rutaIntentada} | null`; computed `estadoMenu` (usa `estadoMenuDesdePlan`), métodos `registrarBloqueo`, `limpiarBloqueo` y `esperarPlan()` (observable que emite al terminar `cargar` o a los 3 000 ms); specs PV-15…PV-20 verdes; sin `Date`/`new Date` | RN-05…RN-07 |
| T-04 | Servicio: cancelar | `P/servicios/suscripcion.service.ts`, `P/servicios/suscripcion.service.spec.ts` | T-01 | `cancelarPlan()` → `POST suscripcion/cancelar` con cuerpo `{}` (sin id; sin `OMITIR_MANEJO_ERROR` para que el interceptor muestre el mensaje del servidor); spec verifica URL, método y cuerpo | F-09 |
| T-05 | `SuscripcionStore`: elegir plan y cancelar; `PlanesStore`: planes para elegir | `P/store/SuscripcionStore.ts`, `P/store/SuscripcionStore.spec.ts`, `P/store/PlanesStore.ts` | T-03, T-04 | `elegirPlan` (rxMethod<number>: `crearSuscripcionInicial` → éxito o 409 → `PlanVigenteStore.cargar`) y `cancelarPlan` (rxMethod<void>: `cancelarPlan` → `PlanVigenteStore.establecer`) con el pipeline estándar; specs EP-1…EP-4 y CA-1…CA-4 verdes; `PlanesStore` gana el computed `planesParaElegir` (RN-08: `pin_precioFinal > 0`, agrupadas por nombre, orden por precio); `asegurarSuscripcionInicial` intacto | RN-09, RN-10 |
| T-06 | Guarda de rutas | `compartidos/seguridades/plan.guard.ts`, `compartidos/seguridades/plan.guard.spec.ts` (nuevos) | T-03 | `planGuard: CanActivateFn` según el Flujo A de H3 y D-03/D-10; sin lectura de `localStorage`/`sessionStorage` (`grep` vacío); spec: sin sesión → true; ruta libre → true; estado COMPLETO → true; MINIMO_PENDIENTE y SIN_PLAN → `UrlTree` a `/inicio` y bloqueo registrado; plan no cargado y error → true; tiempo agotado → true | F-07, RN-05…RN-07 |
| T-07 | Aplicar el guarda a las rutas controladas | `app.routes.ts` | T-06 | Las 13 rutas de RN-04 pasan a `canActivate: [GuardAutenticacion, planGuard]` (`ayuda` y `acerca-d`: solo `[planGuard]`, RN-13); `inicio`, `mostrar-criterio-kelly`, `planes`, `login`, `registro`, `recuperar-clave`, `verificar-correo`, `bloqueo` y `modal-pin` sin cambios; `git diff --stat app.routes.ts` solo toca `canActivate` y el import; la spec R-04 de T-02 sigue verde | F-07 |
| T-08 | Componente del aviso de bloqueo | `P/aviso-bloqueo/aviso-bloqueo.component.ts`, `.html`, `.scss`, `aviso-bloqueo.component.spec.ts` (nuevos) | T-02 | Standalone con `IonicComponentes`; `input()` `bloqueo`, `texto`, `planes`; `output()` `elegirPlan` y `cerrar`; **sin** `inject(` (`grep -c "inject(" …component.ts` = 0); lista cada plan con nombre, intervalo y precio; specs AB-1…AB-4 verdes; SCSS ≤ 14 KB | F-06, F-10, DT-10 |
| T-09 | Actualizar el aviso del plan | `P/aviso-plan/aviso-plan.component.ts`, `.html`, `aviso-plan.component.spec.ts` | T-08 | Nuevos `input()` `cancelado`, `fechaCorte`, `puedeCancelar` y `output()` `cancelar`; muestra «Tu plan termina el <fecha>» si `cancelado` y el botón «Cancelar plan» si `puedeCancelar`; sigue sin `inject(`; specs AC-6…AC-9 verdes | F-09 |
| T-10 | Integrar en el inicio | `inicio/inicio.page.ts`, `inicio/inicio.page.html`, `inicio/inicio.page.spec.ts` | T-05, T-08, T-09 | `InicioPage` muestra `<app-aviso-bloqueo>` cuando `PlanVigenteStore.bloqueo()` existe (cargando `PlanesStore.cargarPlanes()` solo en estado `SIN_PLAN`), conecta `(elegirPlan)` → `SuscripcionStore.elegirPlan`, y `(cancelar)` → `AlertController` (encabezado «Cancelar plan», mensaje con la fecha de corte, botones «No» y «Sí, cancelar») → `SuscripcionStore.cancelarPlan`; el resto de la página intacto; specs verdes | F-07, F-09, DT-10 |
| T-11 | Ejecutar las pruebas | `EV/HLT-20/despues/test.txt` | T-02…T-10 | `ng test --watch=false` completo en verde con el número de pruebas antes/después | G-03 |
| T-12 | Lint y build | `EV/HLT-20/despues/lint.txt`, `build.txt` | T-11 | `npx ng lint` y `npx ng build` código 0; sin avisos nuevos; `grep -rn "console\.log"` en los archivos nuevos vacío | G-03 |
| T-13 | **PUERTA humana:** prueba manual del menú y de cancelar | `EV/HLT-20/puerta_manual.txt` (nuevo) | T-12 | El agente deja el guion (H8 §RI-2) y se detiene; `HECHA` solo con la respuesta escrita del usuario «PRUEBA MANUAL HLT-20 OK» (o descripción del fallo → `BLOQUEADA`) | F-06, F-07, F-09 |
| T-14 | Documentar | `criterioKellyApp/CLAUDE.md`, `criterioKellyApp/README.md` | T-13 | Sección «Menú según el plan»: tabla de estados, archivo único de permisos, guarda, fail-open (D-03) y riesgo R-01; `grep -c "permisos-plan.config" CLAUDE.md` ≥ 2 | F-10 |
| T-15 | Entregar archivos y mensajes de commit sugeridos | `EV/HLT-20/entrega.txt` (nuevo) | T-14 | `git status --short` (solo lectura) y lista de archivos; mensajes sugeridos (no se ejecutan): «HU-004: menú y guarda de rutas según el estado del plan» y «HU-004: elegir plan y cancelar el plan de pago desde el inicio»; hash `➖` | — |

**Orden:** T-01 → T-02 → T-03 → (T-04, T-06 paralelizables) → T-05 → T-07 → T-08 → T-09 → T-10 → T-11 → T-12 → T-13 → T-14 → T-15.

---

## H8 · Reglas de implementación deterministas

- **RI-1 · Reglas del proyecto.** Standalone, `inject()`, `signalStore` con `loading`/`error` y sin re-exportar un signal de `withState` en `withComputed`, `rxMethod` con el pipeline estándar, español y comillas simples, errores por `errorInterceptor`, reutilizar `IonicComponentes` (`IonCard`, `IonButton`, `IonList`, `IonItem` ya re-exportados), sin tocar archivos no declarados, `npm install --legacy-peer-deps` si hiciera falta.
- **RI-2 · Guion de la puerta T-13.** (1) Cuenta nueva con prueba activa: todo el menú abre. (2) En la base local, solo con `UPDATE` de su fixture: dejar la prueba y el Libre en el pasado **y** crear (con la propia app, eligiendo plan) el plan pendiente: tocar «Cuentas» lleva al inicio con «Tu plan … está pendiente de pago…» y «Mostrar criterio Kelly» abre; escribir `/bitacora` en la barra hace lo mismo. (3) Cuenta sin plan pendiente: el menú se ve y cada opción salvo el criterio Kelly muestra «Debes activar un plan» con la lista; elegir uno cambia al estado pendiente. (4) Cuenta con un plan de pago activado (fixture con `sus_situacion='A'`, `sus_fechaFin` futura): menú completo, «Cancelar plan» pide confirmación y después muestra «Tu plan termina el …». (5) Cuenta anterior sin ningún plan (`NUNCA_TUVO_PLAN`): se comporta como una cuenta sin plan (paso 3), con el aviso «Debes activar un plan». (6) Cuenta con un plan de pago activo con renovación automática (fixture `A`, `sus_renovAutomatica = 1`): con `UPDATE` de su fixture poner `sus_fechaFin` en el pasado y abrir la app: aparece «Tu plan … terminó. La renovación está pendiente de pago…», el menú pasa al mínimo (estado 3) y solo abren inicio y criterio Kelly; con `sus_renovAutomatica = 0` en lugar de eso aparece «Debes activar un plan» (estado 4). (7) En la cuenta del paso 6, con `UPDATE` de su fixture dejar el corte hace 30 días: sigue «Hoy es el último día para pagarlo…»; hace 31 días: aparece una sola vez «Tu renovación se anuló por falta de pago; estás en el plan Libre y te quedan 10 días» y el menú está completo con los límites del Libre; poner ese Libre en el pasado: «Debes activar un plan» (estado 4). (8) Cuenta con plan de pago activo y un periodo programado (fixture: `P` con pago `C`): menú completo y el inicio dice «Tu renovación ya está pagada, empieza el …»; al adelantar el corte del plan presente no aparece ningún aviso de renovación pendiente y el plan sigue vigente. El agente no toca MySQL/Apache.
- **RI-3 · Specs.** Los specs de guarda usan `TestBed` con dobles de `SesionStore` y `PlanVigenteStore`; el tiempo de espera se simula con `fakeAsync`/`tick`; cada spec limpia `localStorage`.
- **RI-4.** Sin commits ni reportes `.md`; solo cuentas `ck_prueba_hu4_`.

## H9 · Reglas de seguimiento de ejecución

Semántica `⬜ ✅ ❌ ➖`, RS-1…RS-9. Ficha por tarea: `Estado`; **C1** archivos declarados; **C2** criterio de H7 con salida real; **C3** H8/H11; **C4** `ng lint`; **C5** `ng test --include=…`; **C6** sin efectos fuera de alcance; `Evidencia`; `Notas`.

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-02…T-06, T-08…T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11, T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-13 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |
| T-14, T-15 | PENDIENTE | ⬜ | ⬜ | ⬜ | ➖ | ➖ | ⬜ | No |

## H10 · Diseño del reporte de ejecución

Estructura fija: 1 Resumen · 2 Estado global · 3 Tablero · 4 Cobertura (F-06, F-07, F-09, F-10; RN-01…RN-14) · 5 Cambios `ruta:línea` · 6 Verificaciones (`ng lint`, `ng test`, `ng build`, puerta) · 7 Desviaciones · 8 Pendientes (PU-1, PU-2) · 9 Próximos pasos (HLT-21). RR-1…RR-5; el coordinador guarda el `.md`.

## H11 · Convenciones de desarrollo y arquitectura de código limpio

DDD ligero: configuración de permisos en `paginas/suscripcion/configuracion/` (dominio), guarda en `compartidos/seguridades/` (transversal); dependencia presentación → store → servicio → modelo; `camelCase` (`estadoMenuDesdePlan`, `registrarBloqueo`), `PascalCase` (`AvisoBloqueoComponent`), constantes `UPPER_SNAKE_CASE` (`RUTAS_SIEMPRE_HABILITADAS`, `RUTAS_CONTROLADAS`, `ESPERA_MAXIMA_PLAN_MS = 3_000`); archivos kebab-case con sufijo de rol (`plan.guard.ts`, `permisos-plan.config.ts`, `aviso-bloqueo.component.ts`); selector `app-aviso-bloqueo`; SCSS ≤ 14 KB; sin números ni cadenas mágicas; textos y comentarios en español; commits por el usuario.
