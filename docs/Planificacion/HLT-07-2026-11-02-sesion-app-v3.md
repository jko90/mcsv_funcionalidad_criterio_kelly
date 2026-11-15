# HLT-07 — Sesión en la app (criterioKellyApp) · v3 (delta): primer inicio de sesión y cierre de DE-01

| Campo | Valor |
|-------|-------|
| Versión | **v3 (delta)**. Complementa a [HLT-07-2026-11-02-sesion-app-v2.md](HLT-07-2026-11-02-sesion-app-v2.md) (ejecutado con estado **PARCIAL**, [REPORTE](evidencias/HLT-07/REPORTE.md)). **Todo lo de la v2 sigue vigente**, salvo lo que esta versión cambia de forma explícita (RN-11 y T-36 pasos 8 y 11, ver RN-24 y T-51). La v2 no se sobrescribe ni se vuelve a ejecutar. |
| Fecha | 2026-11-07 |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4): G-01 a G-11, DH-04 |
| Plan maestro | [PLAN-MAESTRO-HU-001-v2](PLAN-MAESTRO-HU-001-v2.md): **D-17 (cerrada)**, **D-18 (verificación por correo)**, AJ-01 |
| Proyecto | `criterioKellyApp` (git propio) |
| Agente de implementación | `desarrollador-ionic` (todas las tareas) |
| Depende de | **HLT-05 v2** (`crearSinPago` idempotente con 409) y **HLT-06 v2** (`persona/agregar` responde `{ mensaje }`) ejecutados, y HLT-07 v2 ya en el código (verificado en T-39) |
| Habilita | HLT-08 v2 (pantalla "verificar correo"; cambia el destino de navegación del registro) |
| Contrato de planificación | `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11) + `docs/planificador.md` |
| Veredicto senior (H6) | **APROBADO** (v3, ronda 3) |

> **Referencias `ruta:línea`.** Leídas el 2026-11-07 sobre el código ya ejecutado (rutas relativas a `criterioKellyApp/` salvo `rest_*` y `docs/`). Si una tarea de este HLT desplaza líneas, se localiza el punto por el nombre del método o fragmento citado y se anota la línea real en la ficha.

**Estado real verificado antes de redactar** (lectura del código y del REPORTE de la v2):

- `SesionStore`, interceptores, guards y `LoginStore` están implementados (`compartidos/store/sesion.store.ts`, `login.store.ts`).
- El registro **sigue intacto** (DE-01): `registro.page.ts:76-101` llama a `_registrarPlanSuscrito(idUsuario)` (`:241-265`) con `sus_usuarioId` y sin token; `SuscripcionStore.crearSuscripcion` (`SuscripcionStore.ts:69-90`) y `SuscripcionService.crearSuscripcion` (`suscripcion.service.ts:26-33`) envían un `SuscripcionModelo` completo.
- `RespuestaRegistro` sigue siendo `{ idUsuario }` (`Persona.modelo.ts:11-13`) y `PersonaStore.registroExitoso` depende de `idUsuario` (`personaStore.ts:33`): con HLT-06 operativo, `persona/agregar` responde `{ mensaje }`, así que **hoy la app nunca detecta un registro exitoso** (hallazgo F-02).
- La v2 eliminó `guardarPlanEnLocalStorage`; `ServicioAutenticacion` borra la clave heredada `planSeleccionado` al construirse (`ServicioAutenticacion.ts:6,49`). `PlanesStore.objPlanSeleccionado` (`PlanesStore.ts:18,93-95`) conserva el plan elegido solo en memoria.
- `LoginPage.ejecutarValidacion` (`login.page.ts:122-154`): login → contador 401 → `reiniciarIntentos()` (`:149`) → `validarPIN()` (`:150`) → `/inicio`.
- Karma corre con Edge: `CHROME_BIN="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless --include=…` (REPORTE de HLT-08).

---

## H1. Propósito

### Requerimiento literal

> `HLT-07-2026-11-02-sesion-app-v3.md` (criterioKellyApp): cierra DE-01; flujo de primer inicio de sesión (tras login exitoso, sin suscripción → `crearSinPago` con el plan reservado o el Libre, luego borrar la reserva; el registro deja de llamar a `crearSinPago`). Como HLT-07 ya fue ejecutado parcialmente (`evidencias/HLT-07/REPORTE.md`), la v3 es un **delta** sobre el código existente.
>
> D-17: *"El plan elegido durante el registro se guarda solo en el dispositivo, sin datos de sesión, como 'plan reservado'. En el primer inicio de sesión de un usuario activo sin suscripción, la app llama a `crearSinPago { sus_pinIdPlanin }` con Bearer, usando el plan reservado o el plan Libre si no hay ninguno, y después borra la reserva."* — AJ-01 (HLT-07): *"cerrar DE-01; el flujo de primer inicio de sesión vive en `SesionStore` o en el store de suscripción, tras un login exitoso; el registro deja de llamar a `crearSinPago`."*

### Propósito

Que el trader recién registrado y activado quede con su plan elegido (o el Libre) sin que el registro dependa de una sesión que aún no existe, sin crear suscripciones duplicadas y sin molestar al usuario si algo falla.

### Resultado esperado

- El registro envía solo `persona/agregar`, detecta el éxito con `{ mensaje }`, guarda el plan elegido como **reserva local** (plan y nombre de usuario, sin datos de sesión) y navega al login (destino interino: HLT-08 v2 lo cambia a "verificar correo").
- Tras un inicio de sesión correcto en el formulario, si el dispositivo no tiene la marca de "suscripción inicial verificada" de ese usuario, la app llama a `POST suscripcion/crearSinPago { sus_pinIdPlanin }` con el plan reservado para ese usuario o el Libre (`1`); con 200 o 409 deja la marca y borra la reserva; ante cualquier otro error no marca, no borra, no muestra toast y no bloquea el inicio de sesión.
- DE-01 queda cerrada; ya no hay envío de `sus_usuarioId` desde la app.

### Fuera de alcance

1. La pantalla "verificar correo", su ruta y el enlace en el login (HLT-08 v2).
2. Cambios en `rest_*` (HLT-05 v2 y HLT-06 v2).
3. Mostrar o gestionar la suscripción del usuario (pantallas de planes/pago), `crearSuscripcionConPago` y `SuscripcionStore.cargarListaSuscripcionPorId`.
4. Restaurar la reserva entre dispositivos o reinstalaciones (riesgo aceptado por el usuario en D-17).
5. Renombrar `Suscripcion.modelo.ts` o `PlanesStore` y limpiar el código legado de planes.
6. Instalar Chrome, resolver `npm audit` o los presupuestos de build (pendientes ya registrados en el REPORTE de la v2).

### Feature(s) afectada(s)

| Carpeta | Archivos |
|---------|----------|
| `src/app/paginas/suscripcion/` | `servicios/plan-reservado.service.ts` (nuevo), `servicios/suscripcion.service.ts`, `modelos/Suscripcion.modelo.ts`, `store/SuscripcionStore.ts`, `registro/registro.page.ts` |
| `src/app/paginas/util/` | `modelos/Persona.modelo.ts`, `store/personaStore.ts`, `login/login.page.ts` |
| Documentación | `README.md`, `CLAUDE.md` de `criterioKellyApp` |

---

## H2. Reglas de negocio

Las RN-01…RN-21 de la v2 siguen vigentes, salvo **RN-11** (ver RN-24). Se agregan:

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-22 | El registro no crea suscripción | `grep -rn "crearSuscripcion\b\|_registrarPlanSuscrito\|_calcularFechaFin" src/app/paginas/suscripcion/registro` → 0; en el registro, la red solo muestra `POST persona/agregar`. | D-17, AJ-01 |
| RN-23 | La reserva es solo un plan y un nombre de usuario | Clave `plan_reservado` de `localStorage` con `{"usuario":"<minúsculas, sin espacios>","pin_idPlanInterv":<entero ≥ 1>}`; nunca contiene tokens, ids de usuario ni datos de sesión; una sola reserva (la última). Se escribe al detectar el éxito del registro con el plan de `PlanesStore.objPlanSeleccionado` o, si no hay, `1`. | D-17, D-42 |
| RN-24 | Excepciones a los invariantes de `localStorage` de la v2 (RN-02, RN-11, T-36 paso 8) | `grep -rln "localStorage" src/app/paginas` → solo `paginas/suscripcion/servicios/plan-reservado.service.ts`; `grep -rln "localStorage" src/app/compartidos` → solo `almacen-seguro.service.ts` y `ServicioAutenticacion.ts`; `Object.keys(localStorage)` solo puede contener, entre claves de la app, `plan_reservado`, `suscripcion_inicial_verificada` y `ck_cierre_pendiente`; `grep -rnE "sus_usuarioId" src/app` solo aparece en interfaces de **respuesta** (`SuscripcionModelo`, `PlanesModelo`). | v2 RN-02/RN-11, D-42 |
| RN-25 | Una verificación por usuario y dispositivo | Si `suscripcion_inicial_verificada` contiene el id del usuario, el inicio de sesión no hace ninguna petición a `suscripcion/crearSinPago`. La marca se escribe solo tras 200 o 409; guarda a lo sumo 20 ids (los más recientes). | D-41 |
| RN-26 | La reserva solo se aplica a su dueño | La reserva se usa solo si su `usuario` coincide (sin distinguir mayúsculas ni espacios en los extremos) con el usuario escrito en el login; si no coincide se envía el Libre (`1`) y la reserva ajena **no** se borra. | D-42 |
| RN-27 | Solo en el inicio de sesión del formulario | La llamada solo ocurre desde `LoginPage` tras `iniciarSesion` correcto; la restauración de sesión (`restaurarSesion`), la renovación y el cierre no la disparan. | D-43, D-44 |
| RN-28 | Contrato de la llamada | `POST suscripcion/crearSinPago` con cuerpo exactamente `{ "sus_pinIdPlanin": <entero> }`, `Authorization: Bearer` (lo agrega el interceptor) y `OMITIR_MANEJO_ERROR`; sin `sus_usuarioId` ni campos calculados. | HLT-05 v2 H5.2 |
| RN-29 | Resultado | 200 → `objSuscripcionSelec` y `listaSuscripciones` actualizados, marca escrita, reserva del usuario borrada. 409 → marca escrita y reserva del usuario borrada, sin error. Otro estado, red o 5xx → `isError` con mensaje, sin marca, sin borrar, **sin toast**. | HLT-05 v2 H5.2 |
| RN-30 | El login nunca se bloquea ni se retrasa más de 5 s por esta llamada | El código espera la carga con `esperarCargaDeStore` dentro de `try/catch` (corta a 5 s) y continúa con `validarPIN()` y `/inicio` en todos los casos. | RN-16 v2 |
| RN-31 | El registro se detecta con `{ mensaje }` | `RespuestaRegistro = { mensaje: string }`; `registroExitoso` es `true` solo si `respuesta()?.mensaje` es una cadena no vacía; la app no usa `idUsuario`. | HLT-06 v2 5.6 CC-HLT08-7, F-02 |

---

## H3. Flujo principal de ejecución

### Flujo F2 · Registro (condición: usuario en `/registro`) — reemplaza al Flujo F de la v2

```
[Disparador: botón "Registrar" en /registro con formulario válido]
 → RegistroPage.registrarUsuario(): guarda en un campo privado el usuario escrito (sin espacios) y el plan de PlanesStore.objPlanSeleccionado()
 → PersonaStore.registrarPersona(datos) → PersonaService → POST persona/agregar (público)
   ├─ Éxito 200 { mensaje } → PersonaStore.respuesta = { mensaje } → registroExitoso() = true
   │     → RegistroPage (effect): PlanReservadoService.reservar(usuario, plan?.pin_idPlanInterv ?? 1)
   │       → toast 'success' con el mensaje del servidor → limpiarFormulario() → PersonaStore.limpiar() → navegar a '/login' (interino; HLT-08 v2 → '/verificar-correo')
   └─ Error 400 (política, formato) / 409 (usuario o teléfono) / 429 (tope por IP) → errorInterceptor muestra el toast del servidor; PersonaStore.errorMessage; la reserva NO se escribe
```

### Flujo H · Primer inicio de sesión (condición: login correcto en el formulario)

```
[Disparador: LoginPage.ejecutarValidacion() tras iniciarSesion sin error]
 → loginStore.reiniciarIntentos() (login.page.ts:149)
 → SuscripcionStore.asegurarSuscripcionInicial({ usuarioId: sesionStore.usuario().id, usuario: <texto del campo usuario> })
   1. Si PlanReservadoService.estaVerificada(usuarioId) → fin (0 peticiones)
   2. loading → idPlan = PlanReservadoService.obtener(usuario) ?? PLAN_LIBRE_ID_INTERVALO (1)
   3. SuscripcionService.crearSuscripcionInicial({ sus_pinIdPlanin: idPlan }) → POST suscripcion/crearSinPago (Bearer, OMITIR_MANEJO_ERROR)
        ├─ 200 → patchState(objSuscripcionSelec, listaSuscripciones) → marcarVerificada(usuarioId) → borrar la reserva del usuario
        ├─ 409 → marcarVerificada(usuarioId) → borrar la reserva del usuario (ya tenía suscripción)
        └─ otro (400, 401 tras renovación fallida, 403, 429, 5xx, red) → patchState(isError) ; sin marca ni borrado ; sin toast
   4. finalize → isLoading false
 → LoginPage: await esperarCargaDeStore(() => suscripcionStore.isLoading()) dentro de try/catch (máx. 5 s)
 → validarPIN() → limpiarFormulario() → navegar a '/inicio'   (siempre)
```

---

## H4. Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| Cierra DE-01; el registro deja de llamar a `crearSinPago` · RN-22 | T-46, T-47, T-49, T-50 | `grep` de RN-22; T-51 paso 1 |
| Plan reservado solo en el dispositivo · RN-23, RN-24, RN-26 | T-40, T-41, T-46, T-50 | PR-1…PR-6; `grep` de RN-24; T-51 pasos 1 y 6 |
| Primer inicio de sesión → `crearSinPago` con reserva o Libre · RN-25, RN-27, RN-28 | T-42, T-43, T-44, T-48 | SI-1…SI-6; T-51 pasos 3 a 5 |
| Luego borrar la reserva · RN-29 | T-43, T-44 | SI-2, SI-3 |
| 409 como "ya tiene" y errores silenciosos · RN-29, RN-30 | T-42, T-43, T-44, T-48 | SI-3, SI-4; T-51 paso 5 |
| Registro detecta éxito con `{ mensaje }` · RN-31 | T-45, T-46 | `grep` de T-50; T-51 paso 1 |
| Excepciones a invariantes de la v2 · RN-24 | T-50, T-51 | `grep` de RN-24; T-51 paso 8 |
| Línea base y contratos de HLT-05 v2 y HLT-06 v2 | T-39 | Fichas de T-39 |
| Lint, specs y builds | T-49, T-50 | Salidas reales |
| Documentación | T-52 | Revisión de README y CLAUDE.md |

### Checklist de calidad del HLT

- ✅ Las 11 secciones existen y están completas.
- ✅ Sin marcadores pendientes.
- ✅ Cada RN mapea a ≥ 1 tarea (cobertura 100 %).
- ✅ Cada tarea tiene criterio verificable y ficha de checks.
- ✅ No contradice §0.5 (standalone, `inject()`, `signalStore`, `rxMethod`; la persistencia dual no aplica: no hay base local nueva, ver D-42).
- ✅ Referencias `ruta:línea` leídas el 2026-11-07.
- ✅ Decisiones cerradas (H5) sin ambigüedad; DE-01 deja de estar abierta.

---

## H5. Reglas cerradas de decisión del HLT

Continúan la numeración de la v2 (D-01…D-39).

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-40 | **Cierre de DE-01** | A `crearSinPago` público · B crearla dentro de `persona/agregar` · C reservar el plan en el dispositivo y crearla en el primer inicio de sesión | **C** (decisión del usuario, D-17; backend en HLT-05 v2 y HLT-06 v2) | El registro ya no tiene sesión ni id de usuario. | No |
| D-41 | Cómo detecta la app el "primer inicio de sesión" | A endpoint nuevo `estado` · B llamar siempre a `crearSinPago` · C llamar a `crearSinPago` solo si el dispositivo no tiene una marca local del usuario y tomar el 409 como "ya tiene" | **C** | A no existe (HLT-05 v2 D-21). Con B cada inicio de sesión haría una petición y un 409 para siempre. C limita el costo a una petición por usuario y dispositivo; si la marca se pierde, el 409 es inofensivo. Ni `porUsuario` ni `planes/suscritos` sirven: un 404 no distingue "sin suscripción" de "tiene una activa o pagada". | No |
| D-42 | Dónde se guardan la reserva y la marca | A SQLite/IndexedDB (stores pares) · B `localStorage` en un servicio propio | **B**: `PlanReservadoService` en `paginas/suscripcion/servicios/`, claves `plan_reservado` y `suscripcion_inicial_verificada`, todo en `try/catch` y con validación al leer | No son datos de sesión ni secretos (un entero y un nombre de usuario), la reserva debe existir **antes** de que haya sesión ni id de usuario (las claves locales de la app dependen del id), y la v2 prohíbe `localStorage` para la sesión, no para esto. A exigiría ambos backends y un id que aún no existe (RI-6 no aplica: no es una base). Se evita la clave heredada `planSeleccionado`, que `ServicioAutenticacion` borra (`ServicioAutenticacion.ts:6,49`). Excepción declarada en RN-24. | No |
| D-43 | Dónde vive la lógica | A `SesionStore` · B `SuscripcionStore` invocado por `LoginPage` | **B** (`asegurarSuscripcionInicial`) | `SesionStore` es el núcleo de sesión (HLT-07 v2) y no debe conocer suscripciones (AR-1); `SuscripcionStore` es el store del dominio (RD-2, AR-4). La página solo orquesta. | No |
| D-44 | Cuándo se dispara | A en toda restauración de sesión · B solo tras el login del formulario | **B** (RN-27) | "Primer inicio de sesión" es una acción del usuario; la restauración ocurre en cada apertura. | No |
| D-45 | Errores de la llamada | A toast del `errorInterceptor` · B silenciosos con `OMITIR_MANEJO_ERROR` | **B** | El 409 es esperado y un toast de error tras un login correcto confundiría; los fallos reales se reintentan en el siguiente login. | No |
| D-46 | Modelo y servicio HTTP | A reutilizar `SuscripcionModelo` · B `CrearSuscripcionInicialRequest { sus_pinIdPlanin: number }` | **B**; `SuscripcionService.crearSuscripcion` pasa a `crearSuscripcionInicial(solicitud)` y el store reemplaza `crearSuscripcion` | `SuscripcionModelo` es de respuesta y obliga a enviar `sus_usuarioId` y fechas que el servidor ignora (HLT-05 v1 D-06). Contrato mínimo (AR-3). | No |
| D-47 | Plan Libre | A leerlo del catálogo · B constante `PLAN_LIBRE_ID_INTERVALO = 1` en `Suscripcion.modelo.ts` | **B** | HLT-05 v2 H5.1/D-24 lo fija (`pin_idPlanInterv` 1, precio 0.00); sin números mágicos (CC-4). | No |
| D-48 | Registro: qué se guarda como reserva | A el objeto de plan completo · B solo `pin_idPlanInterv` y `usuario` | **B** | Menor superficie (RN-23); el servidor valida el plan contra el catálogo. | No |
| D-49 | Respuesta del registro | A seguir leyendo `idUsuario` · B `{ mensaje }` | **B** (RN-31) | HLT-06 v2 5.6 (CC-HLT08-7) y hallazgo F-02: hoy el éxito nunca se detecta. | No |
| D-50 | Destino tras el registro en esta versión | A `/verificar-correo` · B `/login` | **B** (interino) | La ruta `/verificar-correo` la crea HLT-08 v2, que depende de este HLT; HLT-08 v2 cambia esa navegación. | No |
| D-51 | Textos | — | Toast del registro: el `mensaje` que devuelve el servidor | Sin textos duplicados en la app. | No |
| D-52 | Pruebas de componentes de página | A specs de `LoginPage` y `RegistroPage` · B specs del servicio y del store, y flujo manual de las páginas | **B** | Ninguna de las dos páginas tiene spec hoy; la lógica está en el store (AR-4). | No |

---

## H6. Revisión del requerimiento por parte de un senior

### Ronda 1 (adversarial) — veredicto: APROBADO CON CAMBIOS

| # | Hallazgo | Cambio obligatorio | Aplicado en |
|---|----------|--------------------|-------------|
| R1-1 | **La reserva viaja entre usuarios**: A se registra, otro usuario sin suscripción inicia sesión antes en el mismo dispositivo y recibe el plan de A. | La reserva guarda el usuario y solo se aplica a su dueño; si no coincide se usa el Libre y no se borra. | RN-26, SI-2b |
| R1-2 | **Valor manipulado en `localStorage`** (plan `-1`, texto, JSON roto). | Validación al leer (entero ≥ 1) y try/catch; si es inválido se ignora y se usa el Libre; el servidor valida el plan (HLT-05 v2 RN-17). | PR-3, RN-23 |
| R1-3 | **Una petición y un 409 en cada login** si no hay marca. | Marca local por usuario tras 200 o 409. | D-41, RN-25 |
| R1-4 | **Toast de error o login bloqueado** si `crearSinPago` falla o tarda. | `OMITIR_MANEJO_ERROR`, errores silenciosos y espera máxima de 5 s en `try/catch`. | D-45, RN-29, RN-30 |
| R1-5 | **Reintento del interceptor tras 401** podría duplicar la llamada. | Es seguro: el servidor es idempotente (409) y la marca se escribe tras el primer resultado. | HLT-05 v2 RN-18 |
| R1-6 | **Registro nunca detectado** con el backend nuevo (`idUsuario` ya no llega). | `RespuestaRegistro` y `registroExitoso` pasan a `{ mensaje }`. | D-49, RN-31, F-02 |
| R1-7 | **Pérdida de la reserva por la limpieza heredada**: `ServicioAutenticacion` borra `planSeleccionado`. | Clave nueva `plan_reservado`, fuera de `CLAVES_HEREDADAS`. | D-42 |
| R1-8 | **La reserva sobrevive al cierre de sesión** y podría aplicarse a quien inicie sesión después. | Cubierto por R1-1 (solo su dueño); no se borra al cerrar sesión porque la reserva pertenece a un registro, no a una sesión. | RN-26 |
| R1-9 | **`sus_usuarioId` y fechas enviados por la app** (contrato antiguo) siguen en el modelo. | Modelo de petición nuevo con un solo campo. | D-46, RN-28 |
| R1-10 | **Contradicción con la v2**: RN-02/RN-11 y T-36 paso 8 prohíben `localStorage` y exigen que no exista `planSeleccionado`. | Excepciones nominales, con `grep` ajustados. | RN-24, T-50, T-51 |
| R1-11 | **Doble edición de `registro.page.ts`** con HLT-08 v2 (navegación a `/verificar-correo`). | Esta versión deja el destino `/login` (interino) y HLT-08 v2 lo cambia en una tarea propia. | D-50 |
| R1-12 | **Usuario con suscripción vencida en otro dispositivo** recibe un plan nuevo. | Comportamiento deseado (queda con plan); marca local evita repetirlo (HLT-05 v2 R-S4). | D-41 |

### Checklist senior

| # | Ítem | Estado | Nota |
|---|------|--------|------|
| 1 | Entendimiento | ✅ | H1 cubre cierre de DE-01, reserva, primer login y retiro de la llamada del registro. |
| 2 | Reglas de negocio | ✅ | RN-22…RN-31 son comprobables; RN-24 declara las excepciones a la v2. |
| 3 | Impacto | ✅ | Archivos listados en H1; efecto: invariantes de la v2 (RN-24); dependencia de HLT-05 v2/HLT-06 v2 y orden con HLT-08 v2. |
| 4 | Consistencia arquitectónica | ✅ | Página → store → servicio → modelo; `signalStore` + `rxMethod` con el pipeline estándar; componentes standalone; `inject()`. |
| 5 | Riesgos | ✅ | Tabla siguiente. |
| 6 | Simplicidad | ✅ | Sin endpoint, sin store nuevo, sin base local; un servicio de 5 métodos. |
| 7 | Seguridad | ✅ | La reserva no contiene secretos ni ids; el servidor valida; sin tokens en `localStorage`; sin toasts con datos internos. |
| 8 | Cobertura | ✅ | Matriz al 100 %. |
| 9 | Determinismo | ✅ | Claves, formatos, constantes y mensajes cerrados. |
| 10 | Ejecutabilidad por agente | ✅ | Cada tarea declara archivos y criterio con comando. |

### Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-A1 | La reserva se pierde (reinstalar, limpiar datos, otro dispositivo): el usuario queda con el plan Libre. | Media | Aceptado por el usuario (D-17); puede cambiar de plan después. |
| R-A2 | El registro de la app queda desajustado hasta ejecutar HLT-06 v2 (texto de `mensaje`) o HLT-08 v2 (destino). | Media | Orden de ejecución del plan maestro: HLT-05 v2 ∥ HLT-06 v2 → HLT-07 v3 → HLT-08 v2. |
| R-A3 | `localStorage` no disponible (modo privado, política del navegador). | Baja | Todo en `try/catch`: sin reserva se usa el Libre; sin marca se repite una petición inofensiva. |
| R-A4 | Dos usuarios con el mismo nombre en minúsculas en un dispositivo. | Baja | Imposible: `usu_usuario` es único. |
| R-A5 | Un fallo persistente de `crearSinPago` deja al usuario sin suscripción. | Media | Se reintenta en cada inicio de sesión (no hay marca); el error queda en `isError`. |
| R-A6 | Un fallo del lint o de las specs por las excepciones nuevas de `localStorage`. | Baja | T-49 los ejecuta; `no-restricted-globals` no está activo (`ng lint` pasó en la v2). |

No hay riesgos de severidad Alta propios de este HLT.

### Preguntas al usuario

Ninguna bloqueante.

### Observaciones

1. **F-02**: el contrato de registro de HLT-08 (CC-HLT08-1) no llegó a la app; este HLT lo corrige porque sin él la reserva nunca se escribiría.
2. El REPORTE de la v2 deja pendientes T-36 (flujo manual, sin navegador) y las specs con Chrome; esta versión usa Edge para las specs y mantiene el flujo manual como T-51.

### Veredicto final

**APROBADO.** Los 12 cambios de la ronda 1 están aplicados.

---

## H7. Plan de tareas

Todas las tareas: **Agente = `desarrollador-ionic`**. Orden topológico. Rutas relativas a `criterioKellyApp/`. Paralelizables (RS-3): T-40 con T-42 y T-45; T-41 con T-43.

Comando de specs (Edge): `CHROME_BIN="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless --include='<ruta>.spec.ts'`.

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|--------|
| T-39 | desarrollador-ionic | Verificar precondiciones y registrar la línea base (solo lectura) | `src/app/paginas/suscripcion/registro/registro.page.ts:76-101,241-265`, `src/app/paginas/util/store/personaStore.ts:33`, `src/app/paginas/util/login/login.page.ts:122-154`, `src/app/compartidos/seguridades/ServicioAutenticacion.ts:6,49`; lee `docs/Planificacion/evidencias/HLT-05/REPORTE.md` y `HLT-06/REPORTE.md` | — | (1) Los reportes de HLT-05 v2 y HLT-06 v2 existen y dicen `COMPLETADO` (si no → `BLOQUEADA` con la diferencia); (2) con un usuario de prueba activo y sin suscripción: `crearSinPago` con Bearer → 200 y repetido → 409 `El usuario ya tiene una suscripción pendiente o activa`; sin token → 401; (3) `POST persona/agregar` con datos nuevos → 200 `{"mensaje":…}` sin `idUsuario`; (4) `ng lint`, `ng test` (Edge, los specs existentes) y `ng build --configuration development` como línea base; (5) `grep -rn "localStorage" src/app/paginas` → 0 (línea base de la v2). | D-40 |
| T-40 | desarrollador-ionic | Crear el servicio de reserva de plan y de marca de verificación | `src/app/paginas/suscripcion/servicios/plan-reservado.service.ts` (nuevo) | T-39 | `@Injectable({ providedIn: 'root' })` `PlanReservadoService` con `reservar(usuario: string, idPlanIntervalo: number): void`, `obtener(usuario: string): number \| null`, `borrar(usuario: string): void`, `estaVerificada(idUsuario: number): boolean`, `marcarVerificada(idUsuario: number): void`; claves `plan_reservado` y `suscripcion_inicial_verificada` como constantes `CLAVE_PLAN_RESERVADO` y `CLAVE_SUSCRIPCION_VERIFICADA`; máximo `MAXIMO_USUARIOS_VERIFICADOS = 20`; normalización `usuario.trim().toLowerCase()`; validación H8-3; todo acceso a `localStorage` dentro de `try/catch` (ninguna excepción sale); `ng build --configuration development` OK. | RN-23, RN-25, RN-26 |
| T-41 | desarrollador-ionic | Escribir las pruebas del servicio de reserva | `src/app/paginas/suscripcion/servicios/plan-reservado.service.spec.ts` (nuevo) | T-40 | Specs PR-1…PR-6 (H8-6) verdes con el comando de Edge. | RN-23, RN-25, RN-26 |
| T-42 | desarrollador-ionic | Agregar el modelo de petición y el método HTTP de la suscripción inicial (aditivo) | `src/app/paginas/suscripcion/modelos/Suscripcion.modelo.ts:1-12` (interfaz y constante nuevas), `src/app/paginas/suscripcion/servicios/suscripcion.service.ts:1-8,26-33` | T-39 | `Suscripcion.modelo.ts` exporta `CrearSuscripcionInicialRequest { sus_pinIdPlanin: number }` y `PLAN_LIBRE_ID_INTERVALO = 1`, y `SuscripcionModelo` queda igual; se **agrega** `crearSuscripcionInicial(solicitud: CrearSuscripcionInicialRequest): Observable<SuscripcionModelo>` sin quitar `crearSuscripcion` (se retira en T-47) con `POST ${apiUrl}suscripcion/crearSinPago` y `context: new HttpContext().set(OMITIR_MANEJO_ERROR, true)` (importa `HttpContext` y `OMITIR_MANEJO_ERROR` como `sesion.service.ts:2,10`); `grep -c "crearSuscripcionInicial(" src/app/paginas/suscripcion/servicios/suscripcion.service.ts` → 1; `ng build --configuration development` OK. | RN-28, D-46, D-47 |
| T-43 | desarrollador-ionic | Agregar `asegurarSuscripcionInicial` a `SuscripcionStore` (aditivo) | `src/app/paginas/suscripcion/store/SuscripcionStore.ts:1-6,69-90` (se agrega tras `crearSuscripcion`) | T-40, T-42 | `rxMethod<SolicitudSuscripcionInicial>` (tipo local `{ usuarioId: number; usuario: string }`) con el pipeline de H8-4: `filter` de verificada → `tap` loading → `switchMap` → éxito/409/otro → `finalize`; inyecta `PlanReservadoService` y `SuscripcionService`; `crearSuscripcion` se conserva hasta T-47; `crearSuscripcionConPago`, `cargarListaSuscripcion*`, `seleccionar` y `limpiar` sin cambios; `ng build --configuration development` OK. | RN-25…RN-29 |
| T-44 | desarrollador-ionic | Escribir las pruebas de `asegurarSuscripcionInicial` | `src/app/paginas/suscripcion/store/SuscripcionStore.spec.ts` (nuevo) | T-43 | Specs SI-1…SI-6 (H8-6) verdes con el comando de Edge. | RN-25…RN-29 |
| T-45 | desarrollador-ionic | Adaptar el modelo y el store del registro a `{ mensaje }` | `src/app/paginas/util/modelos/Persona.modelo.ts:11-13`, `src/app/paginas/util/store/personaStore.ts:33` | T-39 | `RespuestaRegistro { mensaje: string }`; `registroExitoso: computed(() => typeof respuesta()?.mensaje === 'string' && respuesta()!.mensaje.length > 0)` (sin `!`: usar una variable local); `grep -rn "idUsuario" src/app/paginas/util/modelos/Persona.modelo.ts src/app/paginas/util/store/personaStore.ts` → 0; el resto del store sin cambios. | RN-31, D-49 |
| T-46 | desarrollador-ionic | Quitar `crearSinPago` del registro y guardar la reserva | `src/app/paginas/suscripcion/registro/registro.page.ts:15-17` (imports de `SuscripcionModelo` y `SuscripcionStore`), `:36`, `:76-101`, `:131-159`, `:241-275` | T-41, T-45 | `grep -n "SuscripcionStore\|SuscripcionModelo\|_registrarPlanSuscrito\|_calcularFechaFin" src/app/paginas/suscripcion/registro/registro.page.ts` → 0; el `effect` de `registroExitoso` llama a `PlanReservadoService.reservar(usuario, plan?.pin_idPlanInterv ?? PLAN_LIBRE_ID_INTERVALO)` con el usuario guardado en un campo privado al enviar el formulario, muestra el `mensaje` del servidor con `mostrarToast(..., 'success')`, limpia el formulario y el store y navega a `/login`; el segundo `effect` (de `objSuscripcionSelec`) se elimina; `ng build --configuration development` OK. | RN-22, RN-23, RN-31 |
| T-47 | desarrollador-ionic | Retirar `crearSuscripcion` del store y del servicio (sin llamadores) | `src/app/paginas/suscripcion/store/SuscripcionStore.ts:69-90`, `src/app/paginas/suscripcion/servicios/suscripcion.service.ts:26-33` | T-43, T-46 | `grep -rn "crearSuscripcion(\|crearSuscripcion:" src/app` → 0; `grep -rn "crearSuscripcionConPago" src/app` sin cambios respecto a la línea base de T-39; `ng build --configuration development` OK; el store conserva `asegurarSuscripcionInicial`. | RN-22, D-46 |
| T-48 | desarrollador-ionic | Disparar la suscripción inicial tras el login correcto | `src/app/paginas/util/login/login.page.ts:19` (import), `:39-46` (inyección), `:122-154` (tras `reiniciarIntentos()` en `:149`) | T-43 | Tras `this.loginStore.reiniciarIntentos()` se captura `usuario` (del `getRawValue()` de `:125`), se llama `suscripcionStore.asegurarSuscripcionInicial({ usuarioId, usuario })` (el id de `sesionStore.usuario()?.id`; si no hay id no se llama) y se hace `await this.utilServicio.esperarCargaDeStore(() => this.suscripcionStore.isLoading())` dentro de `try { … } catch { }` con comentario del motivo; `validarPIN()` y `navegarAInicio()` siguen ejecutándose en todos los casos; `ng build --configuration development` OK. | RN-27, RN-30 |
| T-49 | desarrollador-ionic | Ejecutar lint y specs | — (sin cambios de código) | T-41, T-44, T-46, T-47, T-48 | `npx ng lint` → `All files pass linting.`; specs `plan-reservado.service.spec.ts`, `SuscripcionStore.spec.ts` y los de sesión (`sesion.store.spec.ts`, `autenticacion.interceptor.spec.ts`, `error.interceptor.spec.ts`) verdes con Edge (`TOTAL: N SUCCESS`, 0 `FAILED`). | RN-25…RN-31 |
| T-50 | desarrollador-ionic | Ejecutar las builds y los `grep` de invariantes | — (sin cambios de código) | T-49 | `ng build --configuration development` y `--configuration production` sin errores (el aviso de presupuesto inicial ya existente es aceptado); `grep -rn "crearSuscripcion(\|_registrarPlanSuscrito" src/app` → 0; `grep -rln "localStorage" src/app/paginas` → solo `plan-reservado.service.ts`; `grep -rnE "sus_usuarioId" src/app` solo en `Suscripcion.modelo.ts` (respuesta) y `Planes.modelo.ts`; `grep -rn "idUsuario" src/app/paginas/util/store/personaStore.ts` → 0; `grep -rn "console\.\|: any" ` en los archivos nuevos → 0; `git diff --stat` solo los archivos declarados. | RN-22, RN-24, RN-31 |
| T-51 | desarrollador-ionic | Probar el flujo manual en local | — (sin cambios de código) | T-50 | Con XAMPP activo (HLT-05 v2 y HLT-06 v2), `ionic serve --port=8100` y Chrome/Edge con DevTools, se registra método, URL, código y observación de cada paso de H8-7 (M-1…M-8). Si no hay navegador manejable → `BLOQUEADA` (RS-4) con la acción requerida, sin marcar `✅`. | RN-22…RN-31 |
| T-52 | desarrollador-ionic | Actualizar la documentación de la app | `README.md` (sección "Sesión y autenticación" `:3` y "Sesión y seguridad" `:198`), `CLAUDE.md` (sección de autenticación `:119-120,153` y fila de `suscripcion` `:66`) | T-51 | README y CLAUDE.md describen: reserva de plan local (`plan_reservado`) y marca (`suscripcion_inicial_verificada`) como únicas claves de `localStorage` de la app aparte del cierre pendiente; flujo de primer inicio de sesión; el registro ya no crea suscripción; Karma con Edge (`CHROME_BIN`); `grep -n "plan_reservado" README.md CLAUDE.md` ≥ 2 líneas. | D-40…D-47 |

---

## H8. Reglas de implementación deterministas

Rigen **RI-1…RI-11 del contrato** y las reglas H8 de la v2, con estas precisiones.

### H8-1. Reglas específicas

| ID | Regla |
|----|-------|
| RI-v3-1 | Standalone, `inject()`, `signalStore` + `rxMethod` con el pipeline estándar (loading → `switchMap` → `patchState` → `catchError` → `finalize`); `LoginPage` y `RegistroPage` no llaman servicios HTTP (AR-2). |
| RI-v3-2 | Los errores de `crearSinPago` no pasan por `errorInterceptor` (contexto `OMITIR_MANEJO_ERROR`); el 409 se reconoce por `status === 409` leyendo la propiedad con la comprobación de `sesion.store.ts:118-134` (`typeof error === 'object' && error !== null && 'status' in error`), sin `any`. |
| RI-v3-3 | Constantes con nombre para todo valor de negocio: `PLAN_LIBRE_ID_INTERVALO`, `ESTADO_CONFLICTO = 409`, `CLAVE_PLAN_RESERVADO`, `CLAVE_SUSCRIPCION_VERIFICADA`, `MAXIMO_USUARIOS_VERIFICADOS`. |
| RI-v3-4 | Comillas simples, TypeScript strict, sin `any`, nombres y comentarios en español. |
| RI-v3-5 | No se modifican `ServicioAutenticacion.ts`, `sesion.store.ts`, interceptores, guards ni el store de PIN. |
| RI-v3-6 | `npm install` no se usa en este HLT (sin dependencias nuevas). |

### H8-2. Formato de la reserva y de la marca (cerrado)

```
localStorage['plan_reservado']                 = '{"usuario":"juan_perez","pin_idPlanInterv":5}'
localStorage['suscripcion_inicial_verificada'] = '[12,31]'      // ids de usuario, los 20 más recientes
```

### H8-3. `PlanReservadoService` (cerrado)

- `reservar(usuario, id)`: ignora (sin escribir) si `usuario.trim() === ''` o `id` no es entero ≥ 1; si no, escribe `JSON.stringify({ usuario: usuario.trim().toLowerCase(), pin_idPlanInterv: id })` (sobrescribe la reserva anterior).
- `obtener(usuario)`: lee y parsea `plan_reservado`; devuelve `pin_idPlanInterv` solo si el JSON es un objeto con `usuario` string igual a `usuario.trim().toLowerCase()` y `pin_idPlanInterv` entero ≥ 1; en cualquier otro caso (ausente, JSON roto, otro usuario, valor inválido) devuelve `null`.
- `borrar(usuario)`: elimina `plan_reservado` **solo si** su `usuario` coincide; no toca una reserva ajena.
- `estaVerificada(idUsuario)`: `true` si el arreglo de `suscripcion_inicial_verificada` (validado como arreglo de enteros) contiene el id.
- `marcarVerificada(idUsuario)`: agrega el id (sin duplicar), conserva los 20 más recientes y escribe.
- Cualquier excepción de `localStorage` o de `JSON.parse` se captura: lectura → `null`/`false`; escritura → no hace nada.

### H8-4. `SuscripcionStore.asegurarSuscripcionInicial` (cerrado)

```ts
type SolicitudSuscripcionInicial = { usuarioId: number; usuario: string };

asegurarSuscripcionInicial: rxMethod<SolicitudSuscripcionInicial>(
  pipe(
    filter(({ usuarioId }) => !planReservado.estaVerificada(usuarioId)),
    tap(() => patchState(store, { isLoading: true, isError: null })),
    switchMap(({ usuarioId, usuario }) =>
      service
        .crearSuscripcionInicial({
          sus_pinIdPlanin: planReservado.obtener(usuario) ?? PLAN_LIBRE_ID_INTERVALO,
        })
        .pipe(
          tap((nueva) => {
            patchState(store, {
              listaSuscripciones: [...store.listaSuscripciones(), nueva],
              objSuscripcionSelec: nueva,
            });
            planReservado.marcarVerificada(usuarioId);
            planReservado.borrar(usuario);
          }),
          catchError((error: unknown) => {
            if (esConflicto(error)) {
              planReservado.marcarVerificada(usuarioId);
              planReservado.borrar(usuario);
              return of(null);
            }
            patchState(store, { isError: 'No se pudo crear la suscripción inicial' });
            return of(null);
          }),
          finalize(() => patchState(store, { isLoading: false })),
        ),
    ),
  ),
),
```

`esConflicto(error)` es una función local del archivo que devuelve `true` si el error es un objeto con `status === ESTADO_CONFLICTO`. El store no emite toasts.

### H8-5. Cambios del registro (cerrados)

- `RegistroPage` guarda `private ultimoUsuarioEnviado = ''` en `registrarUsuario()` justo antes de `this._personaStore.registrarPersona(datosPersona)` (con `datosPersona.usuario`).
- El `effect` de `registroExitoso()` ejecuta, en este orden: `reservar(this.ultimoUsuarioEnviado, plan?.pin_idPlanInterv ?? PLAN_LIBRE_ID_INTERVALO)`, `mostrarToast(this._personaStore.respuestaRegistro()?.mensaje ?? 'Registro recibido', 'success')`, `limpiarFormulario()`, `this._personaStore.limpiar()` y `this._router.navigate(['/login'])`. La lectura de `respuestaRegistro()` va **antes** de `limpiar()`.
- Se eliminan: la inyección y los imports de `SuscripcionStore` y `SuscripcionModelo`, `_registrarPlanSuscrito`, `_calcularFechaFin` y el segundo `effect`.
- `registro.page.html` no cambia en esta versión (HLT-08 v2 ajusta el texto de éxito).

### H8-6. Casos de prueba (specs)

| ID | Spec | Caso | Resultado esperado |
|----|------|------|--------------------|
| PR-1 | `plan-reservado.service.spec.ts` | `reservar('Juan_Perez ', 5)` y `obtener('juan_perez')` | `5`; la clave guardada es `{"usuario":"juan_perez","pin_idPlanInterv":5}` |
| PR-2 | ídem | `obtener('otro')` con la reserva de PR-1; `borrar('otro')`; `obtener('juan_perez')` | `null`; la reserva sigue (`5`) |
| PR-3 | ídem | Valores inválidos en la clave: `'basura'`, `'{"usuario":"x","pin_idPlanInterv":-1}'`, `'{"usuario":"x","pin_idPlanInterv":"5"}'`, `'{"usuario":1,"pin_idPlanInterv":5}'`; `reservar('x', 0)`, `reservar('', 3)` | `obtener` devuelve `null` en cada caso; `reservar` inválido no escribe |
| PR-4 | ídem | `borrar('juan_perez')` tras PR-1 | `localStorage.getItem('plan_reservado')` → `null` |
| PR-5 | ídem | `marcarVerificada(7)` dos veces y luego 21 ids distintos | `estaVerificada(7)` primero `true`; sin duplicados; tras 21 ids el arreglo guardado tiene 20 elementos y no contiene el más antiguo |
| PR-6 | ídem | `spyOn(localStorage, 'getItem').and.throwError('x')` y `spyOn(localStorage, 'setItem').and.throwError('x')` | `obtener` → `null`, `estaVerificada` → `false`, `reservar`/`marcarVerificada` no lanzan |
| SI-1 | `SuscripcionStore.spec.ts` | Sin reserva; servicio responde 200 | El servicio recibe `{ sus_pinIdPlanin: 1 }`; `objSuscripcionSelec` con la respuesta; `estaVerificada(id)` `true`; `isError` `null` |
| SI-2 | ídem | Reserva `{usuario:'ana', plan 5}`; login de `'Ana'`; 200 | El servicio recibe `{ sus_pinIdPlanin: 5 }`; la reserva se borra; marca escrita |
| SI-2b | ídem | Reserva de `'ana'`; login de `'luis'`; 200 | El servicio recibe `{ sus_pinIdPlanin: 1 }`; la reserva de `'ana'` **sigue** |
| SI-3 | ídem | El servicio falla con `{ status: 409 }` | `isError` `null`; marca escrita; reserva del usuario borrada |
| SI-4 | ídem | El servicio falla con `{ status: 500 }` y con `{ status: 0 }` | `isError` no nulo; sin marca; reserva intacta |
| SI-5 | ídem | `marcarVerificada(id)` previa | `crearSuscripcionInicial` no se llama (0 invocaciones) y `isLoading` `false` |
| SI-6 | ídem | `limpiar()` tras SI-1 | Estado inicial; la marca local no se borra |

### H8-7. Flujo manual (T-51)

Prerrequisitos: `ionic serve --port=8100`; Mailpit o `CORREO_MODO=log` (HLT-06 v2); `localStorage` limpio. El código de verificación se obtiene del log y se activa con `curl` (la pantalla es de HLT-08 v2).

| Paso | Acción | Observación esperada |
|------|--------|----------------------|
| M-1 | Elegir un plan de pago en `/planes` y registrar el usuario `prueba_hlt07v3a` en `/registro` | Network: solo `POST persona/agregar` (200 `{mensaje}`), ningún `crearSinPago`; toast con el mensaje del servidor; navega a `/login`; `localStorage.plan_reservado` = `{"usuario":"prueba_hlt07v3a","pin_idPlanInterv":<plan>}` |
| M-2 | Activar la cuenta: `curl` a `persona/activar` con el código del log | 200 `{success:'ok'}` |
| M-3 | Iniciar sesión como `prueba_hlt07v3a` | Network: `autenticar` 200 → `POST suscripcion/crearSinPago` con cuerpo `{"sus_pinIdPlanin":<plan>}` y `Authorization: Bearer` → 200; sin toast; llega a `/inicio` (tras el modal de PIN si aplica); `localStorage.plan_reservado` ausente y `suscripcion_inicial_verificada` contiene el id |
| M-4 | Cerrar sesión e iniciar de nuevo | Ninguna petición a `crearSinPago` |
| M-5 | `localStorage.removeItem('suscripcion_inicial_verificada')` y nuevo inicio de sesión | `crearSinPago` → 409 sin toast; llega a `/inicio`; la marca vuelve a existir; `SELECT COUNT(*) FROM spsu_suscripcion WHERE sus_usuarioId=<id>` = 1 |
| M-6 | Registrar `prueba_hlt07v3b` por `curl` (sin reserva), activarlo e iniciar sesión | `crearSinPago` con `{"sus_pinIdPlanin":1}` → 200 |
| M-7 | Con una reserva de `prueba_hlt07v3a` en `localStorage` y un usuario nuevo `prueba_hlt07v3c` (activado por `curl`) | El login de `prueba_hlt07v3c` envía `{"sus_pinIdPlanin":1}` y la reserva de `…v3a` sigue en `localStorage` |
| M-8 | Con el backend de suscripción detenido (o 500 simulado) iniciar sesión con un usuario sin marca | Sin toast; llega a `/inicio` en ≤ 5 s; sin marca; al volver el backend, el siguiente inicio de sesión crea la suscripción |

Limpieza: eliminar los usuarios `prueba_hlt07v3*` y sus filas de `spsu_suscripcion`, `sgen_verificacion` y `sgen_rolusuario` con SQL (como HLT-06 v2 7.1.1).

---

## H9. Reglas de seguimiento de ejecución

Responsable: `desarrollador-ionic`. Símbolos: `⬜` no realizado, `✅` realizado y verificado, `❌` fallido, `➖` no aplica (justificar). Rigen RS-1 a RS-9 del contrato. **C4** = `ng lint` OK; **C5** = `ng test --watch=false --include=…` (con Edge) cuando hay specs. Para tareas sin código (T-39, T-49, T-50, T-51) C1/C4/C5 se marcan `➖` con justificación.

### Fichas

```
T-39 — Verificar precondiciones y registrar la línea base
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-40 — Crear el servicio de reserva de plan y de marca de verificación
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-41 — Escribir las pruebas del servicio de reserva
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-42 — Agregar el modelo de petición y el método HTTP de la suscripción inicial
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-43 — Agregar asegurarSuscripcionInicial a SuscripcionStore
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-44 — Escribir las pruebas de asegurarSuscripcionInicial
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-45 — Adaptar el modelo y el store del registro a { mensaje }
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-46 — Quitar crearSinPago del registro y guardar la reserva
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-47 — Retirar crearSuscripcion del store y del servicio
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-48 — Disparar la suscripción inicial tras el login correcto
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-49 — Ejecutar lint y specs
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-50 — Ejecutar las builds y los grep de invariantes
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-51 — Probar el flujo manual en local
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-52 — Actualizar la documentación de la app
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=...) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

### Tablero de avance global

| Tarea | Agente | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|--------|----|----|----|----|----|----|-----------|
| T-39 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-40 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-41 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-42 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-43 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-44 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-45 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-46 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-47 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-48 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-49 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-50 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-51 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-52 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

---

## H10. Diseño del reporte de ejecución

```
REPORTE DE EJECUCIÓN — HLT-07 v3 · Primer inicio de sesión y cierre de DE-01
  1. Resumen ejecutivo         (1–3 frases)
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas         (copia del tablero con estado y C1…C6 de T-39…T-52)
  4. Cobertura vs. HLT         (RN-22…RN-31, D-40…D-52 y DE-01 → resultado; ¿100 %?)
  5. Cambios realizados        (archivos ruta:línea, tipo: creado / modificado; repositorio criterioKellyApp)
  6. Verificaciones ejecutadas (comando → resultado real: OK/FALLO + salida; pasos M-1…M-8 con método, URL, código y observación)
  7. Desviaciones y decisiones (respecto al HLT; con causa)
  8. Pendientes / bloqueos     (checks en ⬜/❌, con acción requerida)
  9. Próximos pasos            (si estado ≠ COMPLETADO; recordatorio: HLT-08 v2 cambia el destino del registro)
```

`COMPLETADO` solo si T-39…T-52 están `HECHA` con todos sus checks aplicables en `✅` (T-51 incluida) y la cobertura es 100 %. Si T-51 no se puede ejecutar por falta de navegador, el estado global es `PARCIAL` y se declara en las secciones 7 y 8.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

Se aplica íntegramente el contrato (§13) y la H11 de la v2, con estos ejemplos:

| Elemento | Convención | Ejemplos de este HLT |
|----------|-----------|----------------------|
| Archivos | kebab-case con sufijo de rol (AF-1) | `plan-reservado.service.ts`, `plan-reservado.service.spec.ts` |
| Excepción legado (AF-4) | La carpeta `store/` de la feature conserva PascalCase heredado | `SuscripcionStore.ts`, `SuscripcionStore.spec.ts` |
| Clases | PascalCase con sufijo | `PlanReservadoService` |
| Métodos | camelCase, verbo + objeto, en español | `reservar`, `obtener`, `marcarVerificada`, `asegurarSuscripcionInicial`, `crearSuscripcionInicial` |
| Constantes | UPPER_SNAKE_CASE | `PLAN_LIBRE_ID_INTERVALO`, `ESTADO_CONFLICTO`, `CLAVE_PLAN_RESERVADO` |
| Booleanos | prefijo `esta`/`es`/`hay` | `estaVerificada`, `esConflicto` |
| Arquitectura | Presentación → store → servicio → modelo (AR-2); la lógica de negocio en el store (AR-4) | `LoginPage` → `SuscripcionStore` → `SuscripcionService` / `PlanReservadoService` |
| Idioma | Español en nombres, comentarios y textos (CC-1) | comentarios que expliquen *por qué* la espera de 5 s no bloquea el login |

Reglas de código limpio: una responsabilidad por archivo y método; sin `any`; sin código comentado; sin `console.*`; sin duplicar la lógica de la marca en la página; comentarios solo para explicar decisiones no obvias (por qué el 409 es éxito, por qué la reserva ajena no se borra).
