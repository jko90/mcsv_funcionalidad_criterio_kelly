# HLT-08 — Claves y PIN en la app · v2 (delta): verificación de correo y ajuste AJ-02

| Campo | Valor |
|-------|-------|
| ID | HLT-08 · versión **v2 (delta)** |
| Fecha | 2026-11-07 |
| Complementa a | [HLT-08-2026-11-02-claves-pin-app.md](HLT-08-2026-11-02-claves-pin-app.md) (v1, ejecutado con estado **PARCIAL**: solo falta el flujo manual T-27; [REPORTE](evidencias/HLT-08/REPORTE.md)). **Todo lo de la v1 sigue vigente**, salvo lo que esta versión cambia de forma explícita. La v1 no se sobrescribe ni se vuelve a ejecutar. |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4): B-07, G-07 |
| Plan maestro | [PLAN-MAESTRO-HU-001-v2](PLAN-MAESTRO-HU-001-v2.md): **D-18 (verificación por correo)**, AJ-02 |
| Proyecto | `criterioKellyApp` (git propio) |
| Agente de implementación | `desarrollador-ionic` (todas las tareas) |
| Depende de | **HLT-06 v2** (`persona/activar`, `persona/reenviarCodigo`; contrato en su sección 5.6, CC-HLT08-7…11) y **HLT-07 v3** (el registro ya no llama a `crearSinPago`, responde `{ mensaje }` y guarda la reserva; deja el destino `/login` como interino) ejecutados; HLT-08 v1 ya en el código (verificado en T-29) |
| Paralelo con | HLT-09 (no comparten archivos con esta versión salvo `app.component.ts`, en líneas distintas) |
| Contrato de planificación | `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11) + `docs/planificador.md` |
| Veredicto senior (H6) | **APROBADO** (v2, ronda 3) |

> **Referencias `ruta:línea`.** Leídas el 2026-11-07 sobre el código ya ejecutado (rutas relativas a `criterioKellyApp/` salvo `rest_*` y `docs/`). `registro.page.ts` y `login.page.ts` serán modificados antes por HLT-07 v3: si desplazó líneas, se localiza el punto por el nombre del método o fragmento citado y se anota la línea real en la ficha.

**Estado real verificado antes de redactar**

- La recuperación de clave existe como patrón a imitar: página orquestadora `RecuperarClavePage` (`recuperar-clave.page.ts:19-57`), componentes `FormularioSolicitarCodigoComponent` (`formulario-solicitar-codigo.component.ts:70-85`) y `FormularioRestablecerClaveComponent`, `RecuperacionClaveStore`, `RecuperacionClaveService`, ruta pública sin guarda (`app.routes.ts:11-17`) y `rutasSinMenu` (`app.component.ts:43`).
- No existe nada de verificación de correo: `grep -rni "activar\|verificar" src/app/paginas` solo encuentra textos sueltos.
- AJ-02 **ya funciona en la app**: `PerfilStore.cambiarClave` guarda el mensaje del error en `errorClave` (`perfilStore.ts:74-95`); `errorInterceptor` muestra `error.error.error` en un toast y relanza `ErrorApi` con el estado (`error.interceptor.ts:26-27,59-60`); `autenticacionInterceptor` solo renueva ante un 401 (`autenticacion.interceptor.ts:56-62`); `PerfilPage` solo limpia el error, sin toast duplicado (`perfil.page.ts:91-106`), y `FormularioCambioClaveComponent` solo reinicia el formulario tras un éxito (`formulario-cambio-clave.component.ts:37-40`, `perfil.page.ts:96-101`). Falta **la prueba** que lo proteja.
- El login ofrece "¿Olvidaste tu contraseña?" (`login.page.html:99-104`, `login.page.ts:102-104`) y "Regístrate" (`:109-114`), pero no la verificación.
- El texto de éxito del registro dice "Serás redirigido al inicio de sesión" (`registro.page.html:399-407`).

---

## H1. Propósito

### Requerimiento literal

> `HLT-08-2026-11-02-claves-pin-app-v2.md` (criterioKellyApp): pantalla/flujo "verificar correo" tras el registro (página orquestadora + componente presentacional + store + servicio, ruta pública), reenvío de código, manejo del mensaje 400 de clave actual incorrecta (AJ-02). HLT-08 ya fue ejecutado (`evidencias/HLT-08/REPORTE.md`): la v2 es un **delta**.
>
> AJ-02 (plan maestro v2): *"Con la clave actual incorrecta, `actualizarClave` responde **400** `Clave actual incorrecta`, nunca 401 (un 401 dispararía la renovación de HLT-07). HLT-08 muestra ese mensaje en el formulario."* (El texto real que emite el servidor es `La clave actual no es correcta`, HLT-06 v2 D-48.)

### Propósito

Que el trader recién registrado active su cuenta con el código que recibe por correo sin salir de la app, pueda pedir otro código si no le llegó, y que el error de la clave actual al cambiar la contraseña se muestre sin cerrar la sesión.

### Resultado esperado

- Tras un registro exitoso la app abre la pantalla pública **Verificar correo** con el correo ya escrito; el usuario introduce el código de 6 dígitos y, si es correcto, la app confirma la activación y lo lleva al login.
- Desde esa pantalla (y desde un enlace del login y del error de duplicado del registro) se puede **reenviar** el código; el botón queda bloqueado 60 s tras cada envío.
- La pantalla no revela si un correo está registrado (muestra el mensaje uniforme del servidor).
- El cambio de contraseña con la clave actual incorrecta muestra el mensaje del servidor, conserva el formulario, no renueva ni cierra la sesión, y una prueba automatizada lo garantiza.

### Fuera de alcance

1. Cambios en `rest_*` (HLT-06 v2) y la creación de la suscripción inicial (HLT-05 v2, HLT-07 v3).
2. Distinguir en el login una cuenta pendiente (el 401 genérico se mantiene, HLT-06 v2 D-47) o evitar que 3 errores 401 cierren la app (`login.page.ts:136-143`).
3. Activación automática por enlace del correo (el correo no lleva enlaces: regla RN-24 de HLT-06 v1, vigente en HLT-06 v2).
4. Cambiar la validación del campo contraseña del login (`login.page.ts:58-61`, `minLength(6)`).
5. Persistir el correo o el estado de verificación entre sesiones de la app.
6. El flujo manual pendiente de la v1 (T-27: M-1…M-7), la observación O-08-1 (la pantalla de PIN se evita escribiendo otra URL) y el spec de componentes de página.

### Feature(s) afectada(s)

| Carpeta | Archivos |
|---------|----------|
| `src/app/paginas/util/` | `verificar-correo/` (página nueva), `componentes/formulario-verificar-correo/` (nuevo), `store/verificacion-correo.store.ts` y `.spec.ts` (nuevos), `servicios/verificacion-correo.service.ts` (nuevo), `modelos/VerificacionCorreo.modelo.ts` (nuevo), `login/login.page.ts` y `.html` |
| `src/app/paginas/suscripcion/` | `registro/registro.page.ts` y `.html` |
| `src/app/` | `app.routes.ts`, `app.component.ts` |
| `src/app/paginas/configuracion/` y `src/app/compartidos/` | `store/perfilStore.spec.ts` (nuevo), `interceptors/autenticacion.interceptor.spec.ts` (un caso nuevo) |
| Documentación | `README.md`, `CLAUDE.md` de `criterioKellyApp` |

---

## H2. Reglas de negocio

Las RN-01…RN-19 de la v1 siguen vigentes. Se agregan:

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-20 | La verificación es pública y sin menú | `grep -n "verificar-correo" src/app/app.routes.ts` → una ruta con `loadComponent` y **sin** `canActivate`; `app.component.ts` incluye `'/verificar-correo'` en `rutasSinMenu`. | RN-17 v1, D-18 |
| RN-21 | Activación | `POST persona/activar` con cuerpo exactamente `{ correo, codigo }`; el formulario solo emite si el correo es válido y el código cumple `^\d{6}$`; jamás se envía clave ni usuario. | HLT-06 v2 CC-HLT08-8 |
| RN-22 | Resultado de la activación | 200 → estado `activada`, toast `success` y navegación a `/login`; no hay sesión ni tokens. Error → el mensaje del servidor llega por `errorInterceptor` (sin toast propio) y la pantalla permanece. | HLT-06 v2 D-53, RI-8 |
| RN-23 | Reenvío | `POST persona/reenviarCodigo` con cuerpo exactamente `{ correo }`; el botón está deshabilitado mientras haya carga, el correo sea inválido o falten segundos del enfriamiento de `SEGUNDOS_ENTRE_REENVIOS = 60` (tras el registro o tras un reenvío exitoso); se muestra el `mensaje` del servidor en línea. | HLT-06 v2 CC-HLT08-9 |
| RN-24 | Anti-enumeración visible | La pantalla muestra siempre el `mensaje` que devuelve el servidor y no agrega texto que distinga "correo no registrado" de "correo pendiente" ni de "cuenta ya activa"; el texto de ayuda es fijo. | HLT-06 v2 RN-33, RN-35 |
| RN-25 | El registro lleva a verificar | Tras el éxito del registro la app inicia el store con el correo y el enfriamiento activo y navega a `/verificar-correo` (reemplaza el destino interino `/login` de HLT-07 v3). | D-18, HLT-07 v3 D-50 |
| RN-26 | Enlaces de entrada | El login muestra "¿Ya te registraste? Verifica tu correo" y el error de registro (cualquiera, p. ej. 409) ofrece el mismo enlace; ambos abren la pantalla con el correo vacío (el del registro lo conserva solo el registro exitoso). | HLT-06 v2 R-10, D-47 |
| RN-27 | El correo no se persiste | El correo vive solo en el estado en memoria de `VerificacionCorreoStore`; `grep -rn "localStorage\|sessionStorage" src/app/paginas/util` → 0. | HLT-07 v3 RN-24 |
| RN-28 | AJ-02 en la app | Con `PUT actualizarClave` → 400 `{"error":"La clave actual no es correcta"}`: `errorCambioClave()` contiene ese texto, no hay segunda petición (ni `renovar`), no se cierra la sesión y el formulario conserva los datos; solo un 401 dispara la renovación. | AJ-02, D-20 v1 |
| RN-29 | Sin toasts propios ni 422 | Los errores HTTP los muestra `errorInterceptor`; el 422 sigue reservado a límite de pérdida. | RN-18 v1, IO-6 |

---

## H3. Flujo principal de ejecución

### Flujo I · Registro → verificar correo (condición: registro exitoso)

```
[Disparador: effect de RegistroPage al detectar registroExitoso() (HLT-07 v3)]
 → RegistroPage: PlanReservadoService.reservar(...) (HLT-07 v3) ; toast con el mensaje del servidor
 → VerificacionCorreoStore.iniciar({ correo: <ultimoCorreoEnviado>, codigoEnviado: true })
     (estado: correo, paso 'codigo', error null, mensajeReenvio null, reenvioDisponibleEn = ahora + 60 s)
 → limpiarFormulario() → PersonaStore.limpiar() → navigate(['/verificar-correo'])
```

### Flujo J · Activar la cuenta (condición: usuario en `/verificar-correo`)

```
[Disparador: "Activar cuenta" con correo válido y código de 6 dígitos]
 → FormularioVerificarCorreoComponent emite activacionEnviada({ correo, codigo })
 → VerificarCorreoPage.alActivar(datos) → VerificacionCorreoStore.activarCuenta(datos)  (rxMethod)
   1. loading true, error null
   2. VerificacionCorreoService.activarCuenta → POST {apiUrlLoge}persona/activar  { correo, codigo }
        ├─ 200 { success } → paso 'activada'
        │      → effect de la página: toast 'success' "Cuenta activada. Inicia sesión con tu usuario y contraseña."
        │        → store.reiniciar() → navigate(['/login'])
        └─ 400 "Código inválido o vencido" / "El código debe tener 6 dígitos" / "El correo no es válido" / "Solicitud inválida"
           · 429 (límite general) · 5xx · red → errorInterceptor muestra el toast del servidor ; error en el store ; paso 'codigo'
   3. finalize → loading false
```

### Flujo K · Reenviar el código

```
[Disparador: "Reenviar código" habilitado]
 → componente emite reenvioSolicitado(correo) → VerificarCorreoPage → VerificacionCorreoStore.reenviarCodigo(correo)
   1. loading true, error null
   2. VerificacionCorreoService.reenviarCodigo → POST {apiUrlLoge}persona/reenviarCodigo  { correo }
        ├─ 200 { mensaje } → correo, mensajeReenvio = mensaje, reenvioDisponibleEn = ahora + 60 s
        └─ 400 "El correo no es válido" · 429 (tope por IP: "Demasiados intentos…" con Retry-After) · 5xx · red → toast del interceptor ; error en el store ; sin cambiar el enfriamiento
   3. finalize → loading false
```

### Flujo L · Entrada desde el login o desde el error de registro

```
[Disparador: botón "¿Ya te registraste? Verifica tu correo"]
 → VerificacionCorreoStore.iniciar({ correo: '', codigoEnviado: false })   (reenvioDisponibleEn = 0)
 → navigate(['/verificar-correo'])
```

### Flujo M · Cambio de contraseña con clave actual incorrecta (AJ-02; sin código nuevo)

```
[Disparador: "Cambiar contraseña" en /perfil]
 → FormularioCambioClaveComponent → PerfilPage → PerfilStore.cambiarClave → PerfilService → PUT autenticacion/actualizarClave { claveActual, claveNueva } (Bearer)
   └─ 400 {"error":"La clave actual no es correcta"} → errorInterceptor: toast 'danger' con ese texto, lanza ErrorApi(mensaje, 400)
        → autenticacionInterceptor: no renueva (solo 401) → PerfilStore.errorClave = mensaje → PerfilPage limpia el error (sin segundo toast)
        → el formulario conserva los campos (solo se reinicia tras un éxito)
```

---

## H4. Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| Pantalla "verificar correo" (orquestadora + presentacional + store + servicio + ruta pública) · RN-20, RN-21, RN-22 | T-30, T-31, T-32, T-33, T-34, T-35 | VC-1…VC-6; M-1, M-4 |
| Reenvío de código · RN-23 | T-31, T-32, T-33, T-34 | VC-3, VC-4; M-2, M-5 |
| Tras el registro · RN-25 | T-36 | M-2 |
| Enlaces desde login y registro · RN-26 | T-35, T-36 | M-6, M-7 |
| Anti-enumeración visible · RN-24 | T-33, T-34 | M-6 |
| Correo no persistido · RN-27 | T-31, T-39 | `grep` de T-39 |
| AJ-02: mensaje del 400 sin renovar ni cerrar sesión · RN-28 | T-37 | AJ-1, AJ-2; M-8, M-9 |
| Sin toasts propios, sin 422 · RN-29 | T-31, T-34, T-39 | `grep` de T-39 |
| Línea base y contratos de HLT-06 v2 y HLT-07 v3 | T-29 | Fichas de T-29 |
| Lint, specs y builds | T-38, T-39 | Salidas reales |
| Documentación | T-41 | Revisión de README y CLAUDE.md |

### Checklist de calidad del HLT

- ✅ Las 11 secciones existen y están completas.
- ✅ Sin marcadores pendientes.
- ✅ Cada RN mapea a ≥ 1 tarea (cobertura 100 %).
- ✅ Cada tarea tiene criterio verificable y ficha de checks.
- ✅ No contradice §0.5 (standalone, `inject()`, `signalStore`, `rxMethod`; no hay base local nueva).
- ✅ Referencias `ruta:línea` leídas el 2026-11-07.
- ✅ Decisiones cerradas (H5) sin ambigüedad.

---

## H5. Reglas cerradas de decisión del HLT

Continúan la numeración de la v1 (D-01…D-22).

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-23 | Ubicación de la verificación | A feature `util/` junto al login y la recuperación · B feature nueva · C dentro de `suscripcion/registro` | **A**: `paginas/util/verificar-correo/`, componente en `paginas/util/componentes/formulario-verificar-correo/`, store, servicio y modelos en las carpetas de `util/` | Es parte del dominio de acceso (D-01 de la v1); AR-1, RD-2. | No |
| D-24 | Ruta | `/verificar-correo` pública · `/login/verificar` | **`verificar-correo`** con `loadComponent`, sin `canActivate`, registrada justo después de `recuperar-clave` (`app.routes.ts:11-17`); se agrega `'/verificar-correo'` a `rutasSinMenu` (`app.component.ts:43`) | Endpoints públicos (HLT-06 v2 RN-40); mismo patrón que `recuperar-clave`. | No |
| D-25 | Servicio HTTP | A métodos en `PersonaService` · B servicio propio | **B** `VerificacionCorreoService` (`activarCuenta`, `reenviarCodigo`) | `PersonaService` queda para el registro; responsabilidad única (D-03 de la v1). | No |
| D-26 | Forma de la pantalla | A asistente de varios pasos · B una pantalla con correo y código | **B**, con estado `paso` `'codigo' \| 'activada'`; el campo correo aparece **editable solo si el store no trae correo** (entrada desde el login) y de solo lectura si viene del registro | Menor superficie (RD-7); el usuario que llega del login debe poder escribir su correo. | No |
| D-27 | Enfriamiento del reenvío | A sin control en la UI · B contador de 60 s en la UI, `SEGUNDOS_ENTRE_REENVIOS = 60` | **B** (coincide con `SEGUNDOS_ENTRE_ENVIOS` del backend, HLT-06 v2) | Evita pulsaciones inútiles (el servidor respondería 200 sin enviar); el servidor sigue siendo la autoridad. El instante se guarda en el store (`reenvioDisponibleEn`, ms epoch) y la página calcula los segundos con `toSignal(interval(1000))`. | No |
| D-28 | Dónde vive el correo | A `localStorage` · B memoria del store | **B** | RN-27: no se persisten datos personales ni estado de verificación. | No |
| D-29 | Destino tras activar | A login con sesión automática · B `/login` | **B** | No hay tokens al activar (HLT-06 v2 D-53); el login normal conserva límites, PIN y primer inicio de sesión (HLT-07 v3). | No |
| D-30 | AJ-02 | A cambiar código · B agregar pruebas | **B** | El comportamiento ya es correcto (H de verificación); falta protegerlo. Dos pruebas automatizadas: store y interceptor. | No |
| D-31 | Entrega del correo del registro a la pantalla | A parámetro de ruta · B estado en el store | **B** (`iniciar({ correo, codigoEnviado })`) | El correo no debe quedar en la URL ni en el historial del navegador. `RegistroPage` guarda el correo enviado en un campo privado `ultimoCorreoEnviado` al enviar el formulario (como `ultimoUsuarioEnviado` de HLT-07 v3). | No |
| D-32 | Textos de la pantalla | — | Título `VERIFICAR CORREO`; ayuda fija `Escribe el código de 6 dígitos que enviamos a tu correo. Si ya activaste tu cuenta, inicia sesión.`; botones `Activar cuenta` y `Reenviar código` (con `(NN s)` durante el enfriamiento); toast de éxito `Cuenta activada. Inicia sesión con tu usuario y contraseña.`; enlaces `¿Ya te registraste? Verifica tu correo` y `Volver al inicio de sesión` | Cerrados para que el agente no los invente; la ayuda no distingue estados de cuenta (RN-24). | No |
| D-33 | Campo del código | — | `ion-input` con `inputmode="numeric"`, `maxlength="6"`, `autocomplete="one-time-code"`, validador `^\d{6}$` | Teclado numérico y autocompletado del código en móviles. | No |
| D-34 | Pruebas | A specs de páginas y componentes · B specs del store, de `PerfilStore` y del interceptor, y flujo manual | **B** | La lógica está en el store (AR-4); las páginas no tienen spec en el proyecto (D-52 de HLT-07 v3). | No |
| D-35 | Texto de éxito del registro | A mantener "Serás redirigido al inicio de sesión" · B actualizarlo | **B**: `Tu cuenta fue creada. Te enviamos un código a tu correo para activarla.` en `registro.page.html:399-407` | El texto anterior sería falso. | No |
| D-36 | Observación O-08-2 de la v1 | — | **Cerrada**: el registro ya no llama a `crearSinPago` (HLT-07 v3) y la activación existe (D-18). | — | No |

---

## H6. Revisión del requerimiento por parte de un senior

### Ronda 1 (adversarial) — veredicto: APROBADO CON CAMBIOS

| # | Hallazgo | Cambio obligatorio | Aplicado en |
|---|----------|--------------------|-------------|
| R1-1 | **Enumeración desde la pantalla**: mensajes distintos para "correo no registrado" y "pendiente". | La UI muestra solo el `mensaje` del servidor y un texto de ayuda fijo; no interpreta códigos de error para insinuar estados. | RN-24, D-32, M-6 |
| R1-2 | **Fuerza bruta del código desde la UI**. | El servidor es la autoridad (5 intentos por código, límites por usuario e IP); la UI valida el formato y no ofrece "reintentar automático". | HLT-06 v2 RN-34…RN-36 |
| R1-3 | **Spam de correo** pulsando "Reenviar". | Enfriamiento de 60 s en la UI + límites del servidor; el botón se deshabilita con carga. | D-27, RN-23 |
| R1-4 | **El correo en la URL o en `localStorage`**. | Solo en el store en memoria. | D-28, D-31, RN-27 |
| R1-5 | **Usuario cuenta `P` intenta entrar 3 veces y la app se cierra** (`login.page.ts:136-143`). | Al registrarse va directo a verificar; el login ofrece el enlace de verificación. No se cambia el contador (fuera de alcance). | RN-25, RN-26 |
| R1-6 | **Confusión entre el código de recuperación y el de activación**. | Pantallas y rutas distintas con títulos y ayudas propias; los correos tienen asuntos distintos (HLT-06 v2 5.5). | D-23, D-32 |
| R1-7 | **Sesión inesperada tras activar** (se esperaría login automático). | Va a `/login` con un toast claro; sin tokens. | D-29 |
| R1-8 | **AJ-02 sin prueba**: una regresión (por ejemplo un 401 en el backend) cerraría la sesión sin que se note. | Dos pruebas: el store muestra el mensaje y el interceptor no renueva ante un 400. | D-30, T-37 |
| R1-9 | **Doble edición de `registro.page.ts`** con HLT-07 v3. | HLT-07 v3 deja `/login` como destino interino; aquí una sola tarea (T-36) lo cambia, localizando el punto por nombre. | T-36 |
| R1-10 | **La página reinicia el store al entrar** (como `recuperar-clave`) y borraría el correo del registro. | La página **no** reinicia en `ionViewWillEnter`; los llamadores (`registro`, `login`) inician el store antes de navegar. | D-26, H8-3 |

### Checklist senior

| # | Ítem | Estado | Nota |
|---|------|--------|------|
| 1 | Entendimiento | ✅ | H1 refleja el requerimiento literal (pantalla, reenvío, AJ-02). |
| 2 | Reglas de negocio | ✅ | RN-20…RN-29 son comprobables con `grep`, specs o flujo manual; no contradicen a la v1. |
| 3 | Impacto | ✅ | Archivos en H1; efectos: destino del registro (HLT-07 v3), enlace en el login, rutas y `rutasSinMenu`. |
| 4 | Consistencia arquitectónica | ✅ | Página → store → servicio → modelo; standalone, `inject()`, `signalStore` + `rxMethod`; presentacional sin servicios. |
| 5 | Riesgos | ✅ | Tabla siguiente. |
| 6 | Simplicidad | ✅ | Una pantalla, un store, un servicio, un componente; sin base local. |
| 7 | Seguridad | ✅ | Sin PII persistente, sin enlaces en correos, sin distinguir estados de cuenta, servidor como autoridad de los límites. |
| 8 | Cobertura | ✅ | Matriz al 100 %. |
| 9 | Determinismo | ✅ | Rutas, textos, constantes y casos de prueba cerrados. |
| 10 | Ejecutabilidad por agente | ✅ | Cada tarea declara archivos y criterio con comando. |

### Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-V1 | Sin SMTP real en producción nadie recibe el código y la pantalla no sirve (HLT-06 v2 R-02). | **Alta** | HLT-11 no cierra sin DH-10; en local se usa Mailpit o el log. Se documenta en el README (T-41). |
| R-V2 | El usuario cambia de dispositivo o cierra la app tras registrarse: pierde el correo precargado y la reserva del plan. | Media | El enlace del login reabre la pantalla con el correo vacío; la reserva se pierde (aceptado en D-17). |
| R-V3 | El usuario con cuenta `P` anterior a D-18 usa la pantalla y recibe un código (HLT-06 v2 R-06). | Baja | Comportamiento esperado. |
| R-V4 | Código incorrecto repetido bloquea el código (5 intentos) y hay que reenviar. | Baja | El mensaje del servidor lo dice; el botón de reenvío está a la vista. |
| R-V5 | El contador de 60 s se desincroniza si el dispositivo cambia la hora. | Baja | El servidor no depende del contador; solo afecta a la comodidad. |
| R-V6 | Hasta ejecutar T-36 el registro navega a `/login` sin activar (ventana entre HLT-07 v3 y esta versión). | Media | Orden del plan: HLT-07 v3 → HLT-08 v2; no se libera entre ambos. |

### Preguntas al usuario

Ninguna bloqueante.

### Observaciones

1. **AJ-02**: el servidor emite `La clave actual no es correcta`, no `Clave actual incorrecta` (HLT-06 v2 D-48); la app muestra el texto del servidor sin copiarlo.
2. La v1 queda `PARCIAL` solo por el flujo manual (T-27); esta versión incorpora el suyo (T-40) pero **no** reemplaza T-27: ambos se pueden ejecutar juntos.

### Veredicto final

**APROBADO.** Los 10 cambios de la ronda 1 están aplicados. Sin preguntas bloqueantes.

---

## H7. Plan de tareas

Todas las tareas: **Agente = `desarrollador-ionic`**. Orden topológico. Rutas relativas a `criterioKellyApp/`. Paralelizables (RS-3): T-30 con T-37; T-32 con T-33.

Comando de specs (Edge): `CHROME_BIN="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless --include='<ruta>.spec.ts'`.

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|--------|
| T-29 | desarrollador-ionic | Verificar precondiciones y registrar la línea base (solo lectura) | `src/app/app.routes.ts:11-17`, `src/app/app.component.ts:43`, `src/app/paginas/util/login/login.page.html:99-114`, `src/app/paginas/suscripcion/registro/registro.page.ts` (efecto de `registroExitoso`), `src/app/paginas/configuracion/store/perfilStore.ts:74-95`; lee `docs/Planificacion/evidencias/HLT-06/REPORTE.md` y `HLT-07/REPORTE.md` | — | (1) Los reportes de HLT-06 v2 y HLT-07 v3 existen y dicen `COMPLETADO` (si no → `BLOQUEADA`); (2) `curl -s -X POST http://localhost/criterio_kelly/rest_usuario/persona/activar -H "Content-Type: application/json" -H "X-Requested-With: CriterioKelly" -d '{"correo":"no.existe@example.com","codigo":"123456"}'` → 400 `{"error":"Código inválido o vencido"}` y el mismo con `/persona/reenviarCodigo` y `{"correo":"no.existe@example.com"}` → 200 con `mensaje`; (3) `grep -n "navigate(\['/login'\])" src/app/paginas/suscripcion/registro/registro.page.ts` anota la línea real del destino interino; (4) `ng lint`, specs con Edge y `ng build --configuration development` como línea base; (5) `grep -rn "localStorage\|sessionStorage" src/app/paginas/util` → 0. | D-36 |
| T-30 | desarrollador-ionic | Crear los modelos y el servicio HTTP de verificación de correo | `src/app/paginas/util/modelos/VerificacionCorreo.modelo.ts` (nuevo), `src/app/paginas/util/servicios/verificacion-correo.service.ts` (nuevo) | T-29 | Modelos y métodos exactamente como H8-1; URL base `environment.apiUrlLoge`; sin estado ni `subscribe`; `ng build --configuration development` OK. | RN-21, RN-23 |
| T-31 | desarrollador-ionic | Crear el store de verificación de correo | `src/app/paginas/util/store/verificacion-correo.store.ts` (nuevo) | T-30 | `VerificacionCorreoStore` según H8-2 (estado, `iniciar`, `activarCuenta`, `reenviarCodigo`, `reiniciar`); sin toasts ni `console`; sin `localStorage`; `ng build --configuration development` OK. | RN-21…RN-23, RN-27, RN-29 |
| T-32 | desarrollador-ionic | Escribir las pruebas del store | `src/app/paginas/util/store/verificacion-correo.store.spec.ts` (nuevo) | T-31 | Specs VC-1…VC-6 (H8-5) verdes con el comando de Edge. | RN-21…RN-23 |
| T-33 | desarrollador-ionic | Crear el componente presentacional del formulario | `src/app/paginas/util/componentes/formulario-verificar-correo/formulario-verificar-correo.component.ts\|html\|scss` (nuevos) | T-30 | Según H8-3: inputs `correo`, `estaCargando`, `segundosRestantes`, `mensajeReenvio`; outputs `activacionEnviada`, `reenvioSolicitado`, `volverAlLogin`; `ChangeDetectionStrategy.OnPush`; importa solo `IonicComponentes` y `ReactiveFormsModule`; sin `inject(`; textos de D-32; el correo es de solo lectura si el input `correo` no está vacío; `ng build --configuration development` OK. | RN-21, RN-23, RN-24 |
| T-34 | desarrollador-ionic | Crear la página orquestadora | `src/app/paginas/util/verificar-correo/verificar-correo.page.ts\|html\|scss` (nuevos) | T-31, T-33 | Según H8-4: inyecta solo `VerificacionCorreoStore`, `Router`, `UtilitariosService`; plantilla con `app-encabezado` y el componente; efecto de `activada` (toast, `reiniciar`, `/login`); **sin** `ionViewWillEnter` que reinicie el store; `segundosRestantes` con `toSignal(interval(1000))`; `ng build --configuration development` OK. | RN-20, RN-22, RN-23 |
| T-35 | desarrollador-ionic | Registrar la ruta pública, ocultar el menú y enlazar desde el login | `src/app/app.routes.ts:11-17`, `src/app/app.component.ts:43`, `src/app/paginas/util/login/login.page.ts:19` (import de `VerificacionCorreoStore`), `:39-46`, `:102-104`, `src/app/paginas/util/login/login.page.html:99-104` | T-34 | Ruta `verificar-correo` con `loadComponent` sin `canActivate` tras `recuperar-clave`; `rutasSinMenu` incluye `'/verificar-correo'`; método `irAVerificarCorreo()` en `LoginPage` (llama `store.iniciar({ correo: '', codigoEnviado: false })` y `router.navigate(['/verificar-correo'])`); botón `fill="clear"` con el texto de D-32 en el bloque de opciones del login; `ng build --configuration development` OK. | RN-20, RN-26 |
| T-36 | desarrollador-ionic | Llevar al usuario registrado a la verificación y ofrecer el enlace | `src/app/paginas/suscripcion/registro/registro.page.ts` (imports, inyección, `registrarUsuario()`, efecto de `registroExitoso`, `irAVerificarCorreo()`), `src/app/paginas/suscripcion/registro/registro.page.html:360-366` (error) y `:399-407` (éxito) | T-31, T-35 | `ultimoCorreoEnviado` se guarda en `registrarUsuario()` junto a `ultimoUsuarioEnviado`; el efecto de éxito, tras `reservar(...)` y el toast de HLT-07 v3, llama `store.iniciar({ correo: this.ultimoCorreoEnviado, codigoEnviado: true })` y navega a `/verificar-correo` en lugar de `/login` (`grep -n "navigate(\['/login'\])" registro.page.ts` solo queda en `irALogin()`); el bloque de error muestra un botón `fill="clear"` con el enlace de D-32 que llama `irAVerificarCorreo()`; texto de éxito de D-35; `ng build --configuration development` OK. | RN-25, RN-26 |
| T-37 | desarrollador-ionic | Escribir las pruebas de AJ-02 (store e interceptor) | `src/app/paginas/configuracion/store/perfilStore.spec.ts` (nuevo), `src/app/compartidos/interceptors/autenticacion.interceptor.spec.ts:85-98` (caso nuevo antes del cierre del `describe`) | T-29 | Specs AJ-1 y AJ-2 (H8-5) verdes con el comando de Edge; los 3 casos existentes del interceptor siguen verdes. | RN-28 |
| T-38 | desarrollador-ionic | Ejecutar lint y specs | — (sin cambios de código) | T-32, T-36, T-37 | `npx ng lint` → `All files pass linting.`; specs `verificacion-correo.store.spec.ts`, `perfilStore.spec.ts`, `autenticacion.interceptor.spec.ts`, `recuperacion-clave.store.spec.ts`, `politica-clave.validator.spec.ts`, `hash-pin.spec.ts` y `pin-bloqueo.feature.spec.ts` verdes con Edge (`TOTAL: N SUCCESS`, 0 `FAILED`). | RN-20…RN-28 |
| T-39 | desarrollador-ionic | Ejecutar las builds y los `grep` de invariantes | — (sin cambios de código) | T-38 | `ng build --configuration development` y `--configuration production` sin errores (el aviso de presupuesto inicial ya existente se acepta); `grep -rn "localStorage\|sessionStorage" src/app/paginas/util` → 0; `grep -rn "422" src/app/paginas/util` → 0; `grep -rn "mostrarToast" src/app/paginas/util/store src/app/paginas/util/servicios src/app/paginas/util/componentes` → 0; `grep -rn "console\.\|: any" ` en los archivos nuevos → 0; `grep -rn "inject(" src/app/paginas/util/componentes/formulario-verificar-correo` → 0; `grep -n "verificar-correo" src/app/app.routes.ts` sin `canActivate`; `git diff --stat` solo los archivos declarados. | RN-20, RN-27, RN-29 |
| T-40 | desarrollador-ionic | Probar el flujo manual en local | — (sin cambios de código) | T-39 | Con XAMPP activo (HLT-06 v2 y HLT-07 v3, Mailpit `http://localhost:8025` o `CORREO_MODO=log`) y `ionic serve --port=8100`, se registra método, URL, código y observación de cada paso de H8-6 (M-1…M-9). Si no hay navegador manejable → `BLOQUEADA` (RS-4) con la acción requerida, sin marcar `✅`. | RN-20…RN-28 |
| T-41 | desarrollador-ionic | Actualizar la documentación de la app | `README.md` (sección "Sesión y seguridad" `:198`), `CLAUDE.md` (fila de `util` y sección de autenticación) | T-40 | README y CLAUDE.md describen la ruta pública `/verificar-correo`, el flujo registro → verificar → login → primer inicio de sesión, el reenvío con enfriamiento de 60 s, que AJ-02 está cubierto por pruebas, y el riesgo R-V1 (sin SMTP no hay código); `grep -n "verificar-correo" README.md CLAUDE.md` ≥ 2 líneas. | D-18 |

---

## H8. Reglas de implementación deterministas

Rigen **RI-1…RI-11 del contrato** y las reglas H8 de la v1, con estas precisiones: standalone puro; `inject()`; `signalStore` con `loading` y `error`; `rxMethod` con el pipeline estándar (loading → `switchMap` → `patchState` → `catchError` → `finalize`); las páginas no llaman servicios (AR-2); sin toasts ad-hoc en stores, servicios ni componentes (IO-6); comillas simples; strict; sin `any`; español; `ChangeDetectionStrategy.OnPush` en la página nueva y en el componente nuevo, como `recuperar-clave`.

### H8-1. Modelos y servicio (cerrado)

```ts
// VerificacionCorreo.modelo.ts
export interface ActivacionCuenta { correo: string; codigo: string; }
export interface RespuestaActivacion { success: string; }
export interface SolicitudReenvioCodigo { correo: string; }
export interface RespuestaReenvioCodigo { mensaje: string; }
export type PasoVerificacion = 'codigo' | 'activada';
export const SEGUNDOS_ENTRE_REENVIOS = 60;

// verificacion-correo.service.ts  (@Injectable({ providedIn: 'root' }), HttpClient por inject, apiUrl = environment.apiUrlLoge)
activarCuenta(datos: ActivacionCuenta): Observable<RespuestaActivacion>              // POST `${apiUrl}persona/activar`
reenviarCodigo(solicitud: SolicitudReenvioCodigo): Observable<RespuestaReenvioCodigo> // POST `${apiUrl}persona/reenviarCodigo`
```

### H8-2. `VerificacionCorreoStore` (cerrado)

- Estado: `{ paso: PasoVerificacion; correo: string; mensajeReenvio: string | null; reenvioDisponibleEn: number; loading: boolean; error: string | null }`, inicial `{ 'codigo', '', null, 0, false, null }`.
- Computed: `isLoading`, `errorMessage` (sin re-exportar un signal de `withState` con el mismo nombre: `loading`/`error` son las claves de estado).
- `iniciar({ correo, codigoEnviado }: { correo: string; codigoEnviado: boolean })` (método síncrono): `paso: 'codigo'`, `correo`, `mensajeReenvio: null`, `error: null`, `loading: false`, `reenvioDisponibleEn: codigoEnviado ? Date.now() + SEGUNDOS_ENTRE_REENVIOS * 1000 : 0`.
- `activarCuenta: rxMethod<ActivacionCuenta>`: `loading: true, error: null` → `servicio.activarCuenta(datos)` → éxito `paso: 'activada'`; error `{ error: error instanceof Error && error.message ? error.message : 'No se pudo activar la cuenta' }` y `of(null)` → `finalize` `loading: false`.
- `reenviarCodigo: rxMethod<string>`: `loading: true, error: null` → `servicio.reenviarCodigo({ correo })` → éxito `{ correo, mensajeReenvio: respuesta.mensaje, reenvioDisponibleEn: Date.now() + SEGUNDOS_ENTRE_REENVIOS * 1000 }`; error `{ error: … 'No se pudo reenviar el código' }` sin tocar `reenvioDisponibleEn` → `finalize`.
- `reiniciar()` → estado inicial.

### H8-3. `FormularioVerificarCorreoComponent` (cerrado)

| Entrada / salida | Tipo |
|------------------|------|
| `correo = input('')` | correo precargado desde el store |
| `estaCargando = input(false)` | |
| `segundosRestantes = input(0)` | segundos del enfriamiento (0 = disponible) |
| `mensajeReenvio = input<string \| null>(null)` | texto del servidor, se muestra en `ion-note color="success"` |
| `activacionEnviada = output<ActivacionCuenta>()` | `{ correo, codigo }` |
| `reenvioSolicitado = output<string>()` | correo |
| `volverAlLogin = output<void>()` | |

- Formulario `new FormGroup({ correo: FormControl('', required + email), codigo: FormControl('', required + pattern(/^\d{6}$/)) })`; un `effect` copia `correo()` al control cuando cambia; `esCorreoFijo = computed(() => this.correo() !== '')` marca el `ion-input` de correo como `readonly`.
- `activar()`: si `formulario.invalid` → `markAllAsTouched()` y no emite; si es válido emite `{ correo: correo.trim(), codigo }`.
- `reenviar()`: si el control correo es inválido o `segundosRestantes() > 0` o `estaCargando()` → no emite; si no, emite el correo recortado.
- Botón reenviar: `[disabled]="estaCargando() || segundosRestantes() > 0 || formulario.controls.correo.invalid"` y texto `Reenviar código` o `Reenviar código ({{ segundosRestantes() }} s)`.
- Plantilla con `@if`/`@for`; textos de D-32; campo del código según D-33; sin botón de ojo.

### H8-4. `VerificarCorreoPage` (cerrado)

- `selector: 'app-verificar-correo'`, `standalone: true`, imports `IonicComponentes`, `EncabezadoComponent`, `FormularioVerificarCorreoComponent`; `OnPush`.
- Señales: `correo = store.correo`, `estaCargando = store.isLoading`, `mensajeReenvio = store.mensajeReenvio`, `paso = store.paso`; `ahora = toSignal(interval(1000).pipe(map(() => Date.now())), { initialValue: Date.now() })`; `segundosRestantes = computed(() => Math.max(0, Math.ceil((store.reenvioDisponibleEn() - ahora()) / 1000)))`; `titulo = 'VERIFICAR CORREO'`.
- `constructor`: `effect` — si `paso() === 'activada'` → `mostrarToast('Cuenta activada. Inicia sesión con tu usuario y contraseña.', 'success')`, `store.reiniciar()`, `router.navigate(['/login'])`.
- Métodos: `alActivar(datos)` → `store.activarCuenta(datos)`; `alReenviar(correo)` → `store.reenviarCodigo(correo)`; `alVolverAlLogin()` → `router.navigate(['/login'])`.
- **Sin `ionViewWillEnter`** (R1-10).

### H8-5. Casos de prueba (specs)

| ID | Spec | Caso | Resultado esperado |
|----|------|------|--------------------|
| VC-1 | `verificacion-correo.store.spec.ts` | `activarCuenta({correo, codigo})` con el servicio respondiendo `{ success: 'ok' }` | El servicio recibe exactamente `{ correo, codigo }`; `paso()` = `'activada'`; `errorMessage()` `null`; `isLoading()` `false` |
| VC-2 | ídem | El servicio falla con `new Error('Código inválido o vencido')` | `paso()` sigue `'codigo'`; `errorMessage()` = `'Código inválido o vencido'`; `isLoading()` `false` |
| VC-3 | ídem | `reenviarCodigo('a@b.com')` con respuesta `{ mensaje: 'texto' }` | `mensajeReenvio()` = `'texto'`; `correo()` = `'a@b.com'`; `reenvioDisponibleEn()` ≥ `Date.now() + 59 000` |
| VC-4 | ídem | `reenviarCodigo` falla con `new Error('Demasiados intentos…')` tras `iniciar` con `codigoEnviado: false` | `errorMessage()` con el texto; `reenvioDisponibleEn()` sigue `0`; `mensajeReenvio()` `null` |
| VC-5 | ídem | `iniciar({ correo: 'x@y.com', codigoEnviado: true })` y luego `iniciar({ correo: '', codigoEnviado: false })` | 1.º: `correo` `'x@y.com'`, `paso` `'codigo'`, `reenvioDisponibleEn` ≈ ahora + 60 s; 2.º: `correo` `''`, `reenvioDisponibleEn` `0` |
| VC-6 | ídem | `reiniciar()` tras VC-3 | Estado inicial completo |
| AJ-1 | `perfilStore.spec.ts` | `PerfilService.cambiarClave` falla con `new ErrorApi('La clave actual no es correcta', 400)` (doble de `PerfilService` con `jasmine.createSpyObj`) | `errorCambioClave()` = `'La clave actual no es correcta'`; `respuestaClave()` `null`; `cargandoCambioContrasena()` `false` |
| AJ-2 | `autenticacion.interceptor.spec.ts` | `PUT ${apiUrlLoge}autenticacion/actualizarClave` con token; `flush({ error: 'La clave actual no es correcta' }, { status: 400, statusText: 'Solicitud incorrecta' })`; `spyOn(sesionStoreDoble, 'renovarSesion')` | La petición no se reintenta (`controlador.verify()` sin pendientes), `renovarSesion` no se llama y el error recibido tiene `status` 400 |

### H8-6. Flujo manual (T-40)

| Paso | Acción | Observación esperada |
|------|--------|----------------------|
| M-1 | Abrir `http://localhost:8100/verificar-correo` sin sesión | Pantalla sin menú; correo editable y vacío; "Reenviar código" deshabilitado hasta escribir un correo válido |
| M-2 | Registrar un usuario nuevo (`prueba_hlt08v2a`) desde `/planes` → `/registro` | `persona/agregar` 200; navega a `/verificar-correo` con el correo en solo lectura; "Reenviar código (NN s)" deshabilitado y descontando desde 60; llega el correo (Mailpit o `logs/correos.log`) |
| M-3 | Escribir un código erróneo de 6 dígitos y pulsar "Activar cuenta" | Toast `Código inválido o vencido`; permanece en la pantalla |
| M-4 | Escribir el código correcto | `persona/activar` 200; toast de éxito; navega a `/login`; el login con ese usuario entra (y, con HLT-07 v3, crea la suscripción) |
| M-5 | Repetir con otro usuario: tras 60 s pulsar "Reenviar código" | `persona/reenviarCodigo` 200; mensaje del servidor en línea; llega un correo nuevo; el botón vuelve a bloquearse 60 s; el código anterior ya no sirve |
| M-6 | Desde `/login` pulsar "¿Ya te registraste? Verifica tu correo"; pedir reenvío con un correo inexistente y con uno pendiente | Pantalla con el correo vacío y editable; ambas respuestas muestran el mismo mensaje (200) sin pistas |
| M-7 | Registrar un usuario con un nombre ya existente | Toast del servidor (409); en el formulario aparece el enlace "¿Ya te registraste? Verifica tu correo" que abre la pantalla |
| M-8 | Con sesión activa, `/perfil` → cambiar contraseña con la clave actual **incorrecta** | Toast `La clave actual no es correcta`; sigue en `/perfil`; en Network `PUT actualizarClave` 400 y **ningún** `POST renovar`; el formulario conserva los campos |
| M-9 | Repetir con la clave actual correcta y una nueva válida | 200; toast de éxito; el formulario se reinicia; la sesión sigue viva |

Limpieza: eliminar los usuarios `prueba_hlt08v2*` con SQL (como HLT-06 v2 7.1.1).

---

## H9. Reglas de seguimiento de ejecución

Responsable: `desarrollador-ionic`. Símbolos: `⬜` no realizado, `✅` realizado y verificado, `❌` fallido, `➖` no aplica (justificar). Rigen RS-1 a RS-9 del contrato. **C4** = `ng lint` OK; **C5** = `ng test --watch=false --include=…` (con Edge) cuando hay specs. Para tareas sin código (T-29, T-38, T-39, T-40) C1/C4/C5 se marcan `➖` con justificación.

### Fichas

```
T-29 — Verificar precondiciones y registrar la línea base
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
T-30 — Crear los modelos y el servicio HTTP de verificación de correo
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
T-31 — Crear el store de verificación de correo
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
T-32 — Escribir las pruebas del store
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
T-33 — Crear el componente presentacional del formulario
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
T-34 — Crear la página orquestadora
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
T-35 — Registrar la ruta pública, ocultar el menú y enlazar desde el login
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
T-36 — Llevar al usuario registrado a la verificación y ofrecer el enlace
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
T-37 — Escribir las pruebas de AJ-02 (store e interceptor)
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
T-38 — Ejecutar lint y specs
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
T-39 — Ejecutar las builds y los grep de invariantes
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
T-40 — Probar el flujo manual en local
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
T-41 — Actualizar la documentación de la app
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
| T-29 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-30 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-31 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-32 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-33 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-34 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-35 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-36 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-37 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-38 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-39 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-40 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-41 | ionic | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

---

## H10. Diseño del reporte de ejecución

```
REPORTE DE EJECUCIÓN — HLT-08 v2 · Verificación de correo y AJ-02
  1. Resumen ejecutivo         (1–3 frases)
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas         (copia del tablero con estado y C1…C6 de T-29…T-41)
  4. Cobertura vs. HLT         (RN-20…RN-29 y D-23…D-36 → resultado; ¿100 %?)
  5. Cambios realizados        (archivos ruta:línea, tipo: creado / modificado; repositorio criterioKellyApp)
  6. Verificaciones ejecutadas (comando → resultado real: OK/FALLO + salida; pasos M-1…M-9 con método, URL, código y observación)
  7. Desviaciones y decisiones (respecto al HLT; con causa)
  8. Pendientes / bloqueos     (checks en ⬜/❌, con acción requerida; T-27 de la v1 si sigue pendiente)
  9. Próximos pasos            (si estado ≠ COMPLETADO)
```

`COMPLETADO` solo si T-29…T-41 están `HECHA` con todos sus checks aplicables en `✅` (T-40 incluida) y la cobertura es 100 %. Si T-40 no se puede ejecutar por falta de navegador, el estado global es `PARCIAL` y se declara en las secciones 7 y 8.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

Se aplica íntegramente el contrato (§13) y la H11 de la v1, con estos ejemplos:

| Elemento | Convención | Ejemplos de este HLT |
|----------|-----------|----------------------|
| Archivos y carpetas | kebab-case con sufijo de rol (AF-1) | `verificar-correo.page.ts`, `formulario-verificar-correo.component.ts`, `verificacion-correo.store.ts`, `verificacion-correo.service.ts` |
| Excepción legado (AF-4) | Modelos en PascalCase con sufijo `.modelo.ts` | `VerificacionCorreo.modelo.ts` |
| Clases | PascalCase con sufijo | `VerificarCorreoPage`, `FormularioVerificarCorreoComponent`, `VerificacionCorreoService`, `VerificacionCorreoStore` |
| Selectores | prefijo `app-` + kebab-case | `app-verificar-correo`, `app-formulario-verificar-correo` |
| Métodos | camelCase, verbo + objeto, en español | `activarCuenta`, `reenviarCodigo`, `iniciar`, `reiniciar`, `alActivar`, `alReenviar`, `irAVerificarCorreo` |
| Constantes | UPPER_SNAKE_CASE | `SEGUNDOS_ENTRE_REENVIOS` |
| Signals y booleanos | camelCase; booleanos con `esta`/`es`/`hay` | `estaCargando`, `esCorreoFijo`, `segundosRestantes` |
| Arquitectura | Presentación → store → servicio → modelo (AR-2); lógica en el store (AR-4); presentacionales sin servicios | `VerificarCorreoPage` → `VerificacionCorreoStore` → `VerificacionCorreoService` |
| Idioma | Español en nombres, comentarios y textos (CC-1) | textos de D-32 |

Reglas de código limpio: una responsabilidad por archivo y método; sin `any`; sin código comentado; sin `console.*`; sin duplicar el patrón de la recuperación (se imita su estructura, no se copia lógica compartida: el único valor compartido es `IonicComponentes`); comentarios solo para decisiones no obvias (por qué la página no reinicia el store al entrar).
