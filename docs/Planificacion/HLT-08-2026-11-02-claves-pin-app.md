# HLT-08 — Claves y PIN en la app: recuperación, cambio de clave, política B-02 y PIN con PBKDF2

| Campo | Valor |
|-------|-------|
| ID | HLT-08 |
| Fecha | 2026-11-02 |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Plan maestro | [PLAN-MAESTRO-HU-001](PLAN-MAESTRO-HU-001.md) (§2, §3, §4.5, §4.6, §5) |
| Proyecto | `criterioKellyApp` (repositorio git propio) |
| Agente de implementación | `desarrollador-ionic` (todas las tareas) |
| Depende de | **HLT-06** (endpoints `solicitarRecuperacion`, `restablecerClave`, `actualizarClave`, política B-02 y mensaje de duplicados B-07 en `rest_usuario`) y **HLT-07** (`SesionStore`, `autenticacionInterceptor`, fachada `ServicioAutenticacion`, cierre de sesión G-06) |
| Paralelo con | HLT-09 (solo comparten `src/app/app.component.ts`, en líneas distintas; ver D-17) |
| Estado | Redactado · veredicto H6: **APROBADO** |

> **Referencias `ruta:línea`.** Todas las referencias se leyeron en el repositorio el 2026-11-02, **antes** de HLT-06 y HLT-07. Si HLT-07 desplazó líneas, el agente de implementación localiza el punto por el fragmento de código o el nombre del método citado (que se mantiene) y registra la línea real en la evidencia de la ficha. Rutas relativas a `criterioKellyApp/` salvo que empiecen por `rest_` o `docs/`.

---

## H1. Propósito

### Requerimiento literal

> **HLT-08 · Claves y PIN en la app** (plan maestro, §2): "Claves y PIN en la app: recuperación, cambio de clave, política, PIN con PBKDF2".
>
> Criterios HU-001 asignados (plan maestro, §3): **G-07** "Se agregan las pantallas de recuperación de clave y se actualiza el cambio de clave, que pide la clave actual. Ambas aplican la política B-02." · **G-09** "Se mantienen el bloqueo por inactividad de 5 minutos con PIN y el cierre de la app tras 3 intentos fallidos de login. El PIN se guarda como hash con sal (PBKDF2 con Web Crypto, 100 000 iteraciones o más), no en claro, y los PIN existentes se migran (S-17). Los roles en la app son solo para la interfaz." · **I-07** "La base local (SQLite/IndexedDB) no guarda tokens ni claves. El PIN se guarda como hash (G-09)." · **B-02** (en la app) "La app repite la validación para dar retroalimentación inmediata, pero la que cuenta es la del servidor." · **B-07** (en la app: registro con el mensaje de duplicados del servidor) · **DH-15** "El PIN local se guarda como hash PBKDF2 con sal." · **S-17** "El PIN de bloqueo se guarda en claro en la base local (SQLite/IndexedDB)."
>
> Encargo del coordinador: pantallas de recuperación (solicitar código → código + clave nueva) con la arquitectura del agente ionic, ruta pública; cambio de clave en el perfil con clave actual + nueva; validador `src/app/compartidos/validadores/politica-clave.validator.ts` aplicado en registro, cambio y restablecimiento (solo longitud y distinta de usuario/correo; la lista de claves comunes no se descarga); registro adaptado al contrato de duplicados; PIN con PBKDF2-SHA256 (Web Crypto, ≥ 100 000 iteraciones, sal aleatoria de 16 bytes, comparación en tiempo constante, migración transparente en el primer desbloqueo correcto) en SQLite e IndexedDB con API pública idéntica y elección web/nativo en el llamador; pruebas (lint, specs, build, flujo manual).

### Propósito

Que el trader pueda recuperar y cambiar su clave de forma segura desde la app, con retroalimentación inmediata de la política de claves, y que el PIN de bloqueo local deje de existir en claro en el dispositivo, sin perder los PIN que ya tienen los usuarios.

### Resultado esperado

1. Desde `/login` hay un enlace "¿Olvidaste tu contraseña?" que lleva a `/recuperar-clave` (pública): el usuario pide un código por correo y luego ingresa código + clave nueva; la UI muestra siempre el mismo mensaje tras la solicitud, exista o no el correo.
2. En `/perfil`, "Cambiar contraseña" pide **clave actual**, clave nueva y confirmación, y envía `{ claveActual, claveNueva }`.
3. Registro, cambio y restablecimiento validan en la app: 10 a 128 caracteres y distinta del usuario y del correo cuando la app los conoce.
4. En SQLite y en IndexedDB, `pin_codigo` guarda `pbkdf2-sha256$<iteraciones>$<sal>$<hash>`; ningún flujo nuevo escribe un PIN en claro; un PIN en claro existente se reemplaza por su hash en el primer desbloqueo correcto.
5. Ninguna página compara PIN: lo hace el store; las páginas solo leen el resultado.

### Fuera de alcance

- Endpoints, política del servidor, lista de 10 000 claves comunes, límites, correo y Mailpit: **HLT-06**.
- `SesionStore`, interceptor de autenticación, renovación, guardas, entornos, cierre de sesión y "cerrar en todos los dispositivos": **HLT-07**.
- Almacenamiento seguro nativo, proyectos `android/`/`ios/` y verificación de Web Crypto en iOS: **HLT-10**.
- Bloqueo por PIN aplicado por guarda de ruta (hoy el bloqueo se evita escribiendo otra URL o recargando en web). Se registra como observación O-08-1 (H6); no lo pide G-09 ("se mantienen") y cambia el comportamiento del producto.
- La creación de la suscripción tras el registro (`registro.page.ts:227-251` llama a `suscripcion/crearSinPago`, que tras HLT-03/HLT-05 exige token y no está en la lista pública §4.5). Se registra como observación O-08-2 para HLT-05/HLT-07; HLT-08 no la toca.
- Refactor completo a arquitectura orquestadora de las pantallas `bloqueo`, `cambiar-pin`, `modal-pin`, `login` y `registro`: solo se cambian los métodos de PIN, clave y política que este HLT declara (regla "Código existente" de `desarrollador-ionic.md`).
- Cambiar la longitud del PIN (sigue en 6 dígitos, `modal-pin.page.ts:39-40`).

### Feature(s) afectada(s)

`src/app/paginas/util/` (recuperación, login), `src/app/paginas/configuracion/` (perfil, bloqueo, cambiar-pin, modal-pin), `src/app/paginas/suscripcion/registro/`, `src/app/compartidos/` (validadores, seguridades, modelos, servicios de BD local, stores `dbPIN-*`).

---

## H2. Reglas de negocio

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-01 | La política B-02 en la app exige entre 10 y 128 caracteres, contados en puntos de código (como `mb_strlen` del servidor). | `evaluarPoliticaClave('a'.repeat(9), {})` devuelve `longitudMinima`; con 10 devuelve `null`; con 129 devuelve `longitudMaxima`; `'😀'.repeat(10)` es válida. | HU B-02 (HU:152); encargo |
| RN-02 | La clave no puede ser igual al usuario ni al correo cuando la app los conoce (comparación sin distinguir mayúsculas y sin espacios en los extremos). | `evaluarPoliticaClave('JuanPerez10', { usuario: 'juanperez10' })` devuelve `igualAUsuario`; ídem `igualACorreo`. | HU B-02 |
| RN-03 | La app **no** descarga ni contiene la lista de claves comunes; la validación que cuenta es la del servidor y su mensaje se muestra tal cual. | `grep -rni "claves_comunes\|clavesComunes" src/` = 0 resultados; el error del servidor llega por `errorInterceptor` (`error.interceptor.ts:13-14`). | HU B-02; plan §4.1 `RUTA_CLAVES_COMUNES` |
| RN-04 | El mismo validador se aplica en registro, cambio de clave y restablecimiento. | `grep -rln "politicaClaveValidator" src/app/paginas` lista exactamente los 3 formularios (registro, formulario-cambio-clave, formulario-restablecer-clave). | HU G-07; plan §4.6 |
| RN-05 | Tras pedir un código, la UI muestra **siempre** el mensaje que devuelve el servidor y avanza al paso de código, sin ninguna rama que dependa de si el correo existe. | `recuperacion-clave.store.ts` no contiene ninguna condición sobre el contenido de la respuesta de `solicitarRecuperacion`; spec RC-1. | HU B-04; plan §4.5 |
| RN-06 | El cambio de clave envía `{ claveActual, claveNueva }` y ningún id ni usuario. | `CambiarClaveRequest` tiene exactamente esas dos propiedades; `grep -n "id:" src/app/paginas/configuracion/modelos/Perfil.modelo.ts` no muestra `id` en `CambiarClaveRequest`. | Plan §4.5; HU B-06, G-08 |
| RN-07 | El registro muestra el mensaje de error del servidor tal cual, sin distinguir si el duplicado es usuario, correo o teléfono. | `personaStore.ts` guarda `(err as Error).message`; la página no contiene la palabra "correo" ni "usuario" en ninguna rama de error. | HU B-07; `PersonaCtrl.php:128-129` |
| RN-08 | El PIN se guarda como `pbkdf2-sha256$<iteraciones>$<sal Base64>$<hash Base64>` con PBKDF2-HMAC-SHA256 de Web Crypto, **310 000** iteraciones, sal aleatoria de **16 bytes** generada con `crypto.getRandomValues` en cada guardado y salida de 256 bits. | Spec HP-1: el valor generado cumple `/^pbkdf2-sha256\$310000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/`; dos hashes del mismo PIN son distintos. | HU G-09, DH-15; encargo |
| RN-09 | La verificación compara los 32 bytes derivados en tiempo constante (sin salida temprana). | `hash-pin.ts` contiene `compararEnTiempoConstante` con acumulación XOR sobre toda la longitud y no usa `===` entre cadenas de hash; spec HP-3. | Encargo |
| RN-10 | Ningún flujo escribe un PIN en claro en SQLite ni en IndexedDB. | Las únicas llamadas a `agregarPinBloqueo`/`editarPinBloqueo` están en `pin-bloqueo.feature.ts` y reciben el resultado de `generarHashPin`; spec PB-1. | HU S-17, I-07 |
| RN-11 | Un PIN existente en claro se acepta una vez y, si es correcto, se reemplaza por su hash en la misma operación (migración transparente); si es incorrecto, no se toca. | Spec PB-3 (correcto → el valor guardado pasa a `pbkdf2-sha256$…`) y PB-4 (incorrecto → el valor guardado sigue igual). | HU G-09, riesgo "PIN en claro" (HU:406) |
| RN-12 | SQLite e IndexedDB exponen la **misma** API pública de PIN; la elección web/nativo la hace la página llamadora con `Capacitor.getPlatform() === 'web'`. | Ambos servicios declaran `implements AccesoPinBloqueo`; `DbPINAppStore` y `DbPINWebStore` se construyen con la misma `conPinBloqueo(...)`; las páginas mantienen `isWeb ? dbWebStore : dbAppStore`. | `doc_modo_planificacion.md` §0.5, RI-6; encargo |
| RN-13 | Las páginas no reciben `pin_codigo` ni comparan PIN. | `grep -rn "pin_codigo" src/app/paginas` = 0 resultados. | HU G-11; `desarrollador-ionic.md` |
| RN-14 | Se mantienen: bloqueo a los 5 minutos de inactividad (`ServicioInactividad.ts:11`), PIN de 6 dígitos y cierre de la app tras 3 intentos fallidos de login (`login.page.ts:119-127`). | Las líneas citadas no cambian de comportamiento; flujo manual M-6. | HU G-09 |
| RN-15 | Tras más de 3 PIN erróneos en `/bloqueo` se cierra la sesión completa (no solo se navega a `/login`). | Flujo manual M-5: tras el 4.º error, `/inicio` escrito a mano redirige a `/login`. | HU G-09 (endurece `bloqueo.page.ts:108-114`, línea que este HLT ya modifica; plan §5.7) |
| RN-16 | Si el dispositivo no ofrece `crypto.subtle`, el PIN **no** se guarda (falla cerrado) y se informa; nunca se cae a texto plano. | Spec HP-5 (sin `crypto.subtle` → `generarHashPin` rechaza con `PIN_SIN_CRIPTOGRAFIA`). | HU I-07 |
| RN-17 | La recuperación y el registro son rutas públicas (sin `GuardAutenticacion`); el resto de rutas privadas no cambia. | `app.routes.ts`: la ruta `recuperar-clave` no tiene `canActivate`; el número de rutas con `GuardAutenticacion` es el mismo antes y después. | Plan §4.5 lista pública; IO-4 |
| RN-18 | HTTP 422 sigue reservado al límite de pérdida; este HLT no lo usa ni lo interpreta. | `grep -rn "422" src/app/paginas/util src/app/paginas/configuracion src/app/compartidos/validadores` = 0. | CLAUDE.md; plan §4.5 |
| RN-19 | El cálculo Kelly sigue en el backend; este HLT no toca `criterioKelly/`, `dividendoKelly` ni el divisor por defecto 10. | `git diff --stat` no incluye `paginas/criterioKelly/` ni métodos `*DividendoKelly`. | `doc_modo_planificacion.md` §4.2 |

---

## H3. Flujo principal de ejecución

### Flujo A — Solicitar código de recuperación (pública)

```
[Clic "¿Olvidaste tu contraseña?" en /login] → LoginPage.irARecuperarClave() → router '/recuperar-clave'
 → RecuperarClavePage.ionViewWillEnter → recuperacionClaveStore.reiniciar()  (paso = 'solicitar')
 → FormularioSolicitarCodigoComponent (correo: required + email) emite solicitudEnviada(correo)
 → RecuperarClavePage.alSolicitarCodigo(correo) → recuperacionClaveStore.solicitarCodigo(correo)
 → rxMethod: tap(loading=true, error=null) → switchMap(RecuperacionClaveService.solicitarRecuperacion({ correo }))
 → POST apiUrlLoge + 'autenticacion/solicitarRecuperacion'  (pública, sin Authorization; X-Requested-With la pone HLT-07)
 → 200 { mensaje } → patchState({ correo, mensajeSolicitud: mensaje, paso: 'restablecer' }) → finalize(loading=false)
 → página: toast 'success' con mensajeSolicitud() y muestra FormularioRestablecerClaveComponent con [correo]
   ├─ Éxito: siempre el mismo mensaje del servidor (B-04); no hay rama "correo no existe".
   ├─ Error 400 (correo con formato inválido o cuerpo inválido): errorInterceptor muestra el mensaje del servidor; store.error = mensaje; paso sigue 'solicitar'.
   ├─ Error 429 (más de 3 solicitudes/hora): toast con el tiempo de Retry-After (G-05, HLT-07); paso sigue 'solicitar'.
   ├─ Error 0 / 5xx: toast genérico del errorInterceptor; paso sigue 'solicitar'.
   └─ 422: no aplica (reservado; RN-18).
```

### Flujo B — Restablecer clave con código

```
[Paso 'restablecer'] → FormularioRestablecerClaveComponent (codigo: required + /^\d{6}$/; claveNueva: politicaClaveValidator({ correo }); confirmacion igual)
 → emite restablecimientoEnviado({ codigo, claveNueva }) → RecuperarClavePage.alRestablecerClave(datos)
 → recuperacionClaveStore.restablecerClave(datos) → tap(loading) → switchMap(service.restablecerClave({ correo: store.correo(), codigo, claveNueva }))
 → POST 'autenticacion/restablecerClave' → 200 { success: 'ok' } → patchState({ paso: 'completado' }) → finalize
 → página (effect sobre paso() === 'completado'): toast 'success' 'Contraseña restablecida. Inicie sesión con su nueva contraseña.' → store.reiniciar() → router '/login'
   ├─ Error 400 (código inválido/vencido/agotado o política B-02 del servidor): toast con el mensaje del servidor; paso sigue 'restablecer'; el formulario conserva el código.
   ├─ Error 429: toast Retry-After (HLT-07).
   ├─ "Pedir otro código" (output solicitarOtroCodigo) → store.volverASolicitar() → paso 'solicitar' (correo precargado).
   └─ Error 0 / 5xx: toast genérico.
```

### Flujo C — Cambio de clave en el perfil (privada)

```
[/perfil] → FormularioCambioClaveComponent (claveActual: required; claveNueva: politicaClaveValidator({}); confirmacion igual)
 → emite cambioClaveEnviado({ claveActual, claveNueva }) → PerfilPage.alCambiarClave(datos) → perfilStore.cambiarClave(datos)
 → rxMethod existente (perfilStore.ts:108-134): tap(loadingClave) → switchMap(PerfilService.cambiarClave) → PUT 'autenticacion/actualizarClave' { claveActual, claveNueva } con Bearer (HLT-07)
 → 200 { success: 'ok' } → patchState({ respuestaClave }) → finalize
 → PerfilPage effect (perfil.page.ts:94-116): toast 'Contraseña actualizada exitosamente' → incrementa reinicioFormularioClave → el componente limpia sus campos
   ├─ Error 400 (clave actual incorrecta o política del servidor): toast con el mensaje del servidor (errorInterceptor); errorClave = mensaje; el effect limpia errorClave sin segundo toast.
   ├─ Error 401: lo gestiona autenticacionInterceptor de HLT-07 (una renovación y reintento; si falla, cierra sesión).
   ├─ Error 429: toast Retry-After.
   └─ Error 0 / 5xx: toast genérico.
```

### Flujo D — Registro con política y duplicados

```
[/registro paso 2] → contrasena con [Validators.required, politicaClaveValidator({ campoUsuario: 'usuario', campoCorreo: 'correo' })]
 → registrarUsuario(): contrasena.updateValueAndValidity() → si inválido, marca tocados y sale → personaStore.registrarPersona(datos)
 → POST 'persona/agregar' → 200 { idUsuario } → flujo existente (registro.page.ts:80-101)
   ├─ Error 409/400 (duplicado o política del servidor): errorInterceptor muestra el mensaje del servidor; personaStore.error = ese mismo mensaje; la caja de error (registro.page.html:357-362) lo muestra; sin segundo toast.
   └─ Error 429 (límite A-06): toast Retry-After.
```

### Flujo E — Guardar PIN (crear o cambiar) — persistencia dual

```
[ModalPinPage: 6 dígitos + confirmación iguales] → store = isWeb ? DbPINWebStore : DbPINAppStore   (elección en el llamador)
 → store.guardarPin({ pin, idUsuario }) → rxMethod: tap(loading, error=null, mensaje=null)
 → switchMap(from(generarHashPin(pin)))            (PBKDF2-SHA256, 310 000 it., sal 16 B)
 → switchMap(hash → from(acceso.obtenerPinBloqueo(idUsuario)))
 → existe ? acceso.editarPinBloqueo(hash, pin_idPin, idUsuario) : acceso.agregarPinBloqueo(hash, idUsuario)
       acceso = DataBaseService (SQLite 'critKelly', tabla pinBloqueo) | DataBaseWebService (IndexedDB 'CriterioKellyDB', store pinBloqueo)
 → patchState({ mensaje, pin: { pin_idPin, pin_idUsuario, pin_codigo: hash } }) → finalize(loading=false)
 → página: esperarCargaDeStore → toast (success | danger según errorMessage()) → modal.dismiss({ pinCreado: true })
   ├─ Error PIN_SIN_CRIPTOGRAFIA: error = 'Este dispositivo no permite proteger el PIN. Puede continuar sin PIN.'; no se escribe nada.
   └─ Error de BD: error = 'No se pudo guardar el PIN'; no se escribe nada en claro.
```

### Flujo F — Desbloqueo con PIN y migración transparente

```
[ServicioInactividad (5 min) → /bloqueo] → BloqueoPage: 6.º dígito → store = isWeb ? DbPINWebStore : DbPINAppStore
 → store.verificarPin({ pin, idUsuario }) → rxMethod: tap(loading, resultadoVerificacion=null)
 → from(acceso.obtenerPinBloqueo(idUsuario))
     ├─ null → resultadoVerificacion = 'sin-pin'
     └─ registro → from(verificarPinContraHash(pin, registro.pin_codigo))
          ├─ formato pbkdf2 → deriveBits + compararEnTiempoConstante
          └─ formato heredado (texto plano) → comparación en tiempo constante de bytes UTF-8
 → si esCorrecto && requiereMigracion → generarHashPin(pin) → acceso.editarPinBloqueo(hash, pin_idPin, idUsuario)
 → patchState({ resultadoVerificacion: esCorrecto ? 'correcto' : 'incorrecto' }) → finalize
 → página: 'correcto' → toast 'Bienvenido …' → '/inicio'
           'incorrecto' → contador +1 → si contador > 3 → toast 'Demasiados intentos fallidos' → ServicioInactividad.salir() (cierre de sesión completo, HLT-07)
           'sin-pin' → '/inicio' (comportamiento actual: sin PIN no hay bloqueo, bloqueo.page.ts:95 con passcodeDB '' nunca coincide; se corrige a "sin PIN = sin bloqueo", ver D-12)
   └─ Error de BD / cripto: error = 'No se pudo verificar el PIN'; resultado 'incorrecto' NO se cuenta como intento; toast danger.
```

### Flujo G — Cambiar PIN y "Olvidé mi PIN"

```
[/cambiar-pin opción 'PIN'] → 6 dígitos → store.verificarPin(...) → 'correcto' → ModalPinPage (Flujo E) → '/inicio'
                                                                  → 'incorrecto' → redireccionError('pin', …) (cambiar-pin.page.ts:192-236, sin cambios)
[/cambiar-pin opción 'OLVIDÉ MI PIN'] → AlertController confirmación →
   store.eliminarPinBloqueo(idUsuario) → esperarCargaDeStore → ServicioInactividad.salir() → '/login'
   → tras login, LoginPage.validarPIN ve tienePin() === false → ModalPinPage (login.page.ts:145-157)
```

### Flujo H — Login: comprobación de PIN existente

```
[LoginPage tras autenticar] → store = isWeb ? dbWebStore : dbAppStore → store.cargarPinBloqueo(idUsuario) → esperarCargaDeStore
 → !store.tienePin() → mostrarModalPIN (login.page.ts:159-170, sin cambios)
```

**Persistencia (Flujos E–H):** la selección web/nativo está **en la página llamadora** (`bloqueo.page.ts:39`, `cambiar-pin.page.ts:49`, `modal-pin.page.ts` campo `isWeb`, `login.page.ts:52`) y usa el par `DbPINAppStore` (`compartidos/store/dbPIN-app.store.ts`) / `DbPINWebStore` (`compartidos/store/dbPIN-web.store.ts`). Los stores comparten la lógica mediante `conPinBloqueo(...)` (D-05).

---

## H4. Calidad del HLT y cobertura

### Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| G-07 recuperación (pantallas) | T-14, T-15, T-16, T-17, T-18, T-19 | Spec RC-1…RC-4; flujo manual M-1, M-2 |
| G-07 cambio de clave con clave actual | T-20, T-21, T-22 | Flujo manual M-3; `grep` RN-06 |
| B-02 en la app (RN-01, RN-02, RN-03, RN-04) | T-02, T-03, T-17, T-21, T-23 | Spec PC-1…PC-6; `grep` RN-03, RN-04 |
| B-07 en la app (RN-07) | T-23 | Flujo manual M-4 |
| G-09 / DH-15 / S-17 / I-07 (RN-08…RN-11, RN-16) | T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11 | Spec HP-1…HP-5, PB-1…PB-5; flujo manual M-5, M-7 |
| RN-12 persistencia dual idéntica | T-06, T-07, T-08, T-09, T-10 | `grep "implements AccesoPinBloqueo"` = 2; build |
| RN-13 páginas sin `pin_codigo` | T-11, T-12, T-13, T-24 | `grep -rn "pin_codigo" src/app/paginas` = 0 |
| RN-14 se mantienen inactividad, 6 dígitos, 3 intentos de login | T-11, T-12, T-24 | Flujo manual M-6 |
| RN-15 cierre de sesión tras PIN erróneos | T-12 | Flujo manual M-5 |
| RN-17 rutas públicas | T-19 | Revisión de `app.routes.ts` + M-1 sin sesión |
| RN-18 422 reservado | T-26 | `grep` RN-18 |
| RN-19 Kelly intacto | T-26 | `git diff --stat` |
| Precondiciones HLT-06/HLT-07 | T-01 | Evidencia curl/grep |
| Pruebas (lint, test, build) | T-25, T-26 | Salida real de `ng lint`, `ng test`, `ng build` |
| Flujo manual en local | T-27 | Evidencia M-1…M-7 |
| Documentación | T-28 | Diff de README/CLAUDE.md/doc_arquitectura |

### Checklist de calidad del HLT

- ✅ Las 11 secciones existen y están completas.
- ✅ Sin marcadores pendientes.
- ✅ Cada RN mapea a ≥ 1 tarea (cobertura 100 %).
- ✅ Cada tarea tiene criterio de aceptación verificable y ficha de checks (H9).
- ✅ No contradice §0.5 (standalone, `inject()`, signalStore, `rxMethod`, persistencia dual con elección en el llamador, `--legacy-peer-deps`, strict, español). No agrega dependencias.
- ✅ Referencias `ruta:línea` verificadas contra el repositorio del 2026-11-02 (ver nota inicial).
- ✅ Decisiones cerradas en H5 sin ambigüedad.

---

## H5. Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Ubicación de la recuperación | A) feature `util/` junto al login · B) feature nueva `recuperacion/` · C) dentro de `configuracion/` | **A**: página `paginas/util/recuperar-clave/`, componentes en `paginas/util/componentes/`, store `paginas/util/store/recuperacion-clave.store.ts`, servicio `paginas/util/servicios/recuperacion-clave.service.ts`, modelos `paginas/util/modelos/RecuperacionClave.modelo.ts` | Es parte del dominio de acceso (login ya vive en `util/`); RD-2 y AR-1. | No |
| D-02 | Ruta | `/recuperar-clave` pública · `/login/recuperar` | **`recuperar-clave`** con `loadComponent`, **sin** `canActivate`, registrada justo después de la ruta `login` (`app.routes.ts:6-10`); se agrega `'/recuperar-clave'` a `rutasSinMenu` (`app.component.ts:37`) | Endpoints públicos §4.5; mismo patrón que `registro` (`app.routes.ts:122-128`). | No |
| D-03 | Servicio HTTP de recuperación | A) métodos nuevos en `SesionService` (HLT-07) · B) servicio propio de la feature | **B** `RecuperacionClaveService` (`solicitarRecuperacion`, `restablecerClave`). `actualizarClave` se queda en `PerfilService.cambiarClave` (`perfil.service.ts:28-33`) | `SesionService` es el núcleo de sesión de HLT-07 (§4.6); no se edita un archivo de otro HLT. RD-2 reutiliza `PerfilService`. | No |
| D-04 | Formato del hash del PIN | A) columnas nuevas (`pin_sal`, `pin_iteraciones`) con migración de esquema · B) cadena autodescriptiva en `pin_codigo` | **B** `pbkdf2-sha256$310000$<sal Base64 de 16 B>$<hash Base64 de 32 B>` (≈ 85 caracteres) en `pin_codigo` | SQLite no aplica la longitud de `VARCHAR(8)` (`data-base.service.ts:68`, afinidad TEXT) e IndexedDB no tiene esquema de columnas (`data-base-web.service.ts:24-29`). Sin `ALTER TABLE` ni subir `dbVersion`/versión SQLite (riesgo cero de migración de esquema). El prefijo distingue hash de texto plano para la migración y permite subir iteraciones a futuro. RD-7. | No |
| D-05 | Lógica común de los stores PIN | A) duplicar en `dbPIN-app` y `dbPIN-web` · B) un solo store que elige plataforma dentro · C) `signalStoreFeature` compartida | **C** `conPinBloqueo(obtenerAcceso: () => AccesoPinBloqueo)` en `compartidos/store/pin-bloqueo.feature.ts`; `DbPINAppStore = signalStore({ providedIn: 'root' }, conPinBloqueo(() => inject(DataBaseService)))` y `DbPINWebStore` con `DataBaseWebService` | Mantiene los stores pareados y la elección en el llamador (RI-6, §0.5, encargo) sin duplicar lógica (AR-6). Se descarta B porque contradice RI-6 aunque `desarrollador-ionic.md` lo sugiera: prevalece el contrato de planificación y el encargo. Excepción de nombre de archivo `.feature.ts` registrada aquí (AF-1 no lista el sufijo). | No |
| D-06 | Iteraciones PBKDF2 | 100 000 · 310 000 · 600 000 | **310 000** (constante `ITERACIONES_PBKDF2_PIN`) | Cumple "≥ 100 000" (G-09) con margen ×3,1 (referencia OWASP 2021). El espacio del PIN es 10^6, así que 600 000 solo duplica un ataque offline que de todas formas termina en segundos-minutos con GPU (ver H6, riesgo R-01), mientras duplica la espera en el desbloqueo de móviles de gama baja (`esperarCargaDeStore` corta a 5 s, `utilitarios.service.ts:58`). Las iteraciones quedan dentro del hash: subirlas después provoca re-hash en el siguiente desbloqueo (`requiereMigracion`). | No |
| D-07 | Sal | Por usuario fija · por guardado | **Aleatoria de 16 bytes en cada guardado** (`crypto.getRandomValues`) | Encargo; evita tablas precomputadas y que dos usuarios con el mismo PIN tengan el mismo valor. | No |
| D-08 | Comparación | `===` de cadenas · tiempo constante | **Tiempo constante** sobre `Uint8Array` de 32 bytes (XOR acumulado, sin salida temprana); para PIN heredados, sobre bytes UTF-8 rellenados a la misma longitud | Encargo; evita filtrar coincidencias parciales por tiempo. | No |
| D-09 | Migración de PIN existentes | Masiva al arrancar · en el primer desbloqueo correcto · forzar a crear PIN nuevo | **En el primer desbloqueo correcto** (`/bloqueo` y verificación de `/cambiar-pin`), en la misma operación del store; si el PIN heredado es incorrecto no se toca | HU G-09 y riesgo HU:406 ("el PIN se migra en el primer desbloqueo"). La migración masiva es imposible: hashear exige conocer el PIN y no se quiere leer el texto plano fuera de una verificación. | No |
| D-10 | Validación de iteraciones al leer | Aceptar cualquier valor · mínimo | Hash con iteraciones `< 100 000` o formato inválido → **incorrecto**; `< 310 000` y correcto → `requiereMigracion` | Evita degradar el coste por manipulación del registro y permite subir iteraciones. | No |
| D-11 | Sin `crypto.subtle` | Guardar en claro · fallar cerrado | **Fallar cerrado** (`PIN_SIN_CRIPTOGRAFIA`): no se guarda ni migra; mensaje 'Este dispositivo no permite proteger el PIN. Puede continuar sin PIN.'; el usuario puede usar "omitir PIN" (`modal-pin.page.ts:66-83`) | I-07 prohíbe texto plano. En web local (`localhost`) y Android (`androidScheme: 'https'`, `capacitor.config.ts`) hay contexto seguro; iOS se verifica en HLT-10. | No |
| D-12 | Desbloqueo cuando el usuario no tiene PIN | Bloquear siempre (comportamiento actual de facto) · dejar pasar | **`'sin-pin'` → navegar a `/inicio`** | Hoy `bloqueo.page.ts:95` compara contra `''` y el usuario que omitió el PIN queda encerrado hasta 4 errores. Sin PIN registrado no hay nada que verificar; el modal de login ya ofrece crear PIN. Cambio en una línea que este HLT reescribe (plan §5.7). | No |
| D-13 | Re-autenticación por contraseña en `cambiar-pin` (opción 'CONTRASEÑA', `cambiar-pin.page.ts:91-129`) | A) mantener `LoginServicio.autenticar` · B) nuevo endpoint de verificación · C) "Olvidé mi PIN" = eliminar PIN local + cerrar sesión + login | **C** | Tras HLT-03/07, `autenticar` crea una sesión nueva en el servidor (y en web reemplaza la cookie de refresh) desde una pantalla que no es el login: deja sesiones huérfanas y desincroniza `SesionStore`. B no existe en el contrato §4.5. C exige la clave real en el login normal y reutiliza el modal de PIN (`login.page.ts:145-157`). Se elimina el `subscribe` manual en la página. | No |
| D-14 | Acción tras más de 3 PIN erróneos en `/bloqueo` | Navegar a `/login` (actual, `bloqueo.page.ts:108-114`) · cerrar sesión | **`ServicioInactividad.salir()`** (cierre completo vía HLT-07) | Hoy la sesión sigue viva y basta escribir `/inicio`. Línea que este HLT ya modifica (plan §5.7). Umbral sin cambios (`> 3`). | No |
| D-15 | Comparación usuario/correo en la política | Exacta · sin mayúsculas ni espacios | **`trim().toLowerCase()`** en ambos lados | Más estricta que una exacta; si el servidor es más laxo, la app solo rechaza antes un caso que el servidor también debería rechazar. Nunca acepta algo que B-02 prohíbe. | No |
| D-16 | Datos de contexto para la política por pantalla | — | Registro: usuario y correo · Restablecer: correo · Cambio en perfil: ninguno (la sesión no tiene usuario ni correo, §4.5 `autenticar`) | La app solo valida lo que conoce; el servidor completa (B-02). | No |
| D-17 | Choque con HLT-09 (ejecución en paralelo) | — | HLT-08 solo toca `app.component.ts:37` (`rutasSinMenu`); HLT-09 toca otras líneas del mismo archivo y `app.component.html`. Quien ejecute segundo integra sobre el estado del primero sin revertirlo | Plan §2 permite paralelo. | No |
| D-18 | Doble toast de error en registro y perfil | Mantener · quitar | Se elimina el `effect` de toast de error de `registro.page.ts:73-78`; en perfil el `effect` de `errorCambioClave` solo limpia el error, sin toast | RI-8 / IO-6: el `errorInterceptor` ya muestra el mensaje del servidor (`error.interceptor.ts:13-14, 52`). | No |
| D-19 | Mensaje del store de registro ante error | 'Error en el registro' fijo (`personaStore.ts:48`) · mensaje del servidor | **`(err as Error).message`** con respaldo 'Error en el registro' | `errorInterceptor` relanza `new Error(mensaje)` con el mensaje del servidor (`error.interceptor.ts:53`); B-07 lo hace uniforme en el servidor. | No |
| D-20 | Contrato de error de `actualizarClave` con clave actual incorrecta | 400 · 401 · 403 | La app **asume 400** con `{ error }` (mensaje del servidor) y no tiene rama propia para el código | Un 401 dispararía la renovación de HLT-07 (G-03) sin sentido. Se registra como punto de coordinación C-1 para HLT-06 (H6). No bloquea: con cualquier código ≠ 422 la UI muestra el mensaje del servidor. | No |
| D-21 | Iconos/controles de mostrar clave en los formularios nuevos | `IonInputPasswordToggle` (no está en `IonicComponentes`) · botón ojo existente | **Botón con `ion-icon` `eye-outline`/`eye-off-outline`** como en `login.page.html:60-69` | RI-9, sin tocar el barril `IonicComponentes.ts`. | No |
| D-22 | Esquema de `pinBloqueo` | Cambiar DDL a `TEXT` · dejar `VARCHAR(8)` | **Dejar el DDL** (`data-base.service.ts:66-70`) y agregar encima un comentario: "pin_codigo guarda el hash pbkdf2-sha256 (≈ 85 caracteres); SQLite no limita la longitud de VARCHAR". | Cambiar el DDL solo afectaría instalaciones nuevas y crearía dos esquemas distintos sin ganancia. RD-7. | No |

---

## H6. Revisión del requerimiento por parte de un senior

### Checklist senior

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H1 cubre G-07, G-09, I-07, B-02 (app), B-07 (app), DH-15 y S-17 tal como los asigna el plan §3. |
| 2 | Reglas de negocio | ✅ | RN-01…RN-19 son invariantes con comando o spec; RN-15 y D-12 cambian comportamiento solo en líneas que el HLT reescribe (plan §5.7). |
| 3 | Impacto | ✅ | Archivos listados en H7. Efectos colaterales: `app.component.ts` compartido con HLT-09 (D-17); `perfil.page.*` también lo toca HLT-07 (G-06 "cerrar en todos los dispositivos") pero HLT-08 corre después y solo cambia la sección de clave. |
| 4 | Consistencia arquitectónica | ✅ | Página orquestadora + componentes presentacionales sin `inject()` + store con `rxMethod` en la recuperación y el cambio de clave; persistencia dual con elección en el llamador y API idéntica (D-05). |
| 5 | Riesgos | ✅ | Ver tabla de riesgos. |
| 6 | Simplicidad | ✅ | Sin migración de esquema (D-04), sin dependencias nuevas, sin endpoint nuevo (D-13), lógica PIN en un solo lugar (D-05). |
| 7 | Seguridad | ✅ | Sin PIN en claro (RN-10), comparación en tiempo constante (RN-09), falla cerrado (RN-16), sin enumeración en la UI (RN-05, RN-07), cierre real tras PIN erróneos (RN-15), sin re-login lateral (D-13). Riesgo residual R-01 aceptado y justificado. |
| 8 | Cobertura | ✅ | Matriz H4 al 100 %. |
| 9 | Determinismo | ✅ | Puntos de integración con HLT-06/07 fijados por nombre (`SesionStore`, `ServicioInactividad.salir()`, endpoints §4.5) y verificados en T-01 con salida BLOQUEADA si no existen. |
| 10 | Ejecutabilidad | ✅ | Cada tarea declara archivos, dependencia y criterio con comando u observación. |

### Revisión adversarial

**1. PIN de 6 dígitos → fuerza bruta offline del hash (R-01).** Quien copie `pin_codigo` y la sal (acceso al sandbox de la app o al perfil del navegador) prueba los 10^6 PIN: a 310 000 iteraciones son ≈ 3,1·10^11 iteraciones HMAC-SHA256; una GPU actual (≈ 10^10 iteraciones PBKDF2-SHA256/s) termina en **≈ 30 s**; con 600 000 serían ≈ 60 s. **Ningún número de iteraciones razonable protege un PIN de 6 dígitos frente a un atacante offline.** Por qué es aceptable en local:
- El PIN es un **bloqueo de interfaz local**, no un factor de autenticación ante el servidor: no da acceso a la API (que exige el access token en memoria y el refresh en cookie HttpOnly o almacén seguro nativo, HLT-07/HLT-10).
- Quien ya lee el almacenamiento de la app (dispositivo desbloqueado con root/jailbreak o perfil del navegador) ya tiene acceso a la sesión de esa app; el PIN no añade una barrera real en ese escenario.
- La base local solo contiene el divisor Kelly y el PIN (I-07): no hay tokens ni claves que el PIN proteja.
- El objetivo de S-17/DH-15 es que el PIN **no se lea a simple vista** (copias de seguridad, inspección casual, reutilización del mismo PIN en otros servicios); el hash con sal por guardado cumple ese objetivo.
- Mitigación adicional ya existente: más de 3 errores en línea cierran la sesión (RN-15).
Se registra como **riesgo residual aceptado**. Endurecerlo (PIN alfanumérico, clave envuelta en Keystore/Keychain) es de HLT-10 o de una historia aparte.

**2. Enumeración en la UI.** Recuperación: el store no tiene rama por contenido de la respuesta y siempre avanza a "ingresar código" (RN-05, spec RC-1); el error de `restablecerClave` es el mensaje genérico del servidor (HLT-06). Registro: se muestra el mensaje uniforme del servidor (RN-07). Login: no cambia. Cambio de clave: requiere sesión. ✅ No hay mensajes distintos que dependan de la existencia del correo en ningún texto propio de la app.

**3. Timing por el lado del cliente.** La comparación del hash es en tiempo constante; la derivación PBKDF2 tarda lo mismo para PIN correctos e incorrectos. La migración (segunda derivación + escritura) solo ocurre si el PIN es correcto, lo que no filtra nada que el resultado no diga ya. ✅

**4. Migración interrumpida.** Si la app se cierra entre verificar y escribir el hash, el registro sigue en texto plano y se migra en el siguiente desbloqueo correcto (idempotente). Si la escritura falla, el desbloqueo sigue siendo correcto y el store registra `error` sin bloquear al usuario. ✅

**5. Manipulación del registro local.** Un atacante con escritura en la BD local puede poner su propio hash: mismo nivel de acceso que el punto 1; fuera del modelo de amenazas. D-10 impide degradar iteraciones a valores triviales. ✅

**6. `crypto.subtle` en iOS (`capacitor://localhost`).** No verificable aún (no existe `ios/`, HLT-10 bloqueado). D-11 falla cerrado y HLT-10 lo verifica. Riesgo Media (R-04).

**7. Bloqueo evitable por URL o recarga en web (O-08-1).** `/bloqueo` es una ruta más: escribir `/inicio` o recargar (con la renovación de HLT-07) entra sin PIN. HU G-09 dice "se mantienen" y no pide endurecerlo; hacerlo exige decidir si la app pide PIN en cada arranque. **Observación O-08-1** para el plan maestro / historia aparte. No bloquea HLT-08.

**8. Registro → suscripción sin token (O-08-2).** `registro.page.ts:250` crea la suscripción con `suscripcion/crearSinPago`, que no está en la lista pública §4.5. Tras HLT-03/05 el registro quedaría a medias. Pertenece a HLT-05/HLT-07 (contrato de suscripción y sesión); **observación O-08-2**. No bloquea HLT-08 porque este HLT no cambia esa llamada.

**9. Contrato de error de `actualizarClave` (C-1).** Si HLT-06 respondiera 401 con clave actual incorrecta, el interceptor de HLT-07 intentaría renovar. D-20 fija la expectativa (400) como punto de coordinación; la app funciona con cualquier código ≠ 422.

### Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-01 | Fuerza bruta offline del hash de un PIN de 6 dígitos | Media (aceptado) | Justificación arriba; sal por guardado; 310 000 it.; cierre de sesión tras errores en línea; el PIN no da acceso al servidor. |
| R-02 | HLT-06/HLT-07 dejan nombres o contratos distintos de los fijados en el plan §4.5/§4.6 | Alta | T-01 verifica con `curl`/`grep` antes de tocar código; si no coinciden, T-01 queda BLOQUEADA (RS-4) y se pregunta, sin adaptar a ciegas. |
| R-03 | Espera perceptible al desbloquear en móviles de gama baja (dos derivaciones si migra) | Media | 310 000 it. (D-06); la migración ocurre una sola vez; `esperarCargaDeStore` tolera 5 s; M-7 mide en web. |
| R-04 | `crypto.subtle` no disponible en iOS | Media | Falla cerrado (D-11); verificación en HLT-10. |
| R-05 | Usuarios con PIN en claro que nunca desbloquean | Baja | Persisten en claro hasta su primer desbloqueo; aceptado por HU:406. |
| R-06 | Conflicto de edición con HLT-09 en `app.component.ts` | Baja | D-17. |

### Veredicto

**APROBADO.** El HLT cubre al 100 % los criterios asignados con decisiones cerradas, sin dependencias nuevas ni migraciones de esquema; las dependencias externas (HLT-06/07) se verifican en T-01 con salida bloqueante, y el riesgo residual del PIN de 6 dígitos está documentado y es aceptable para un bloqueo local. Las observaciones O-08-1 y O-08-2 y el punto C-1 no bloquean este HLT y se elevan al plan maestro.

---

## H7. Plan de tareas

Todas las tareas: **Agente = `desarrollador-ionic`**. Orden topológico. Paralelizables (RS-3): T-02/T-04/T-06 entre sí; T-14/T-20 entre sí.

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|--------|
| T-01 | desarrollador-ionic | Verificar precondiciones de HLT-06 y HLT-07 (solo lectura) | `src/app/compartidos/store/sesion.store.ts`, `src/app/compartidos/seguridades/ServicioInactividad.ts:53-59`, `src/app/compartidos/interceptors/autenticacion.interceptor.ts`, `src/environments/environment.ts:7-9` | — | (a) `curl -s -X POST -H "Content-Type: application/json" -H "X-Requested-With: CriterioKelly" -d '{"correo":"noexiste@ejemplo.com"}' http://localhost/criterio_kelly/rest_usuario/autenticacion/solicitarRecuperacion` → 200 `{"mensaje":…}`; (b) `curl … /autenticacion/restablecerClave -d '{"correo":"noexiste@ejemplo.com","codigo":"000000","claveNueva":"ClaveDePrueba2026"}'` → 400 `{"error":…}`; (c) `curl -X PUT … /autenticacion/actualizarClave` sin token → 401; (d) `grep -n "cerrarSesion" src/app/compartidos/store/sesion.store.ts` ≥ 1; (e) `grep -n "SesionStore\|cerrarSesion" src/app/compartidos/seguridades/ServicioInactividad.ts` ≥ 1 (salir() cierra la sesión de HLT-07); (f) `grep -n "obtenerUsuarioActual" src/app/compartidos/seguridades/ServicioAutenticacion.ts` ≥ 1. Si alguno falla → BLOQUEADA con la salida y la pregunta al usuario. | R-02; RN-17 |
| T-02 | desarrollador-ionic | Crear el validador de política B-02 | `src/app/compartidos/validadores/politica-clave.validator.ts` (nuevo) | T-01 | Exporta `LONGITUD_MINIMA_CLAVE = 10`, `LONGITUD_MAXIMA_CLAVE = 128`, `MENSAJES_POLITICA_CLAVE`, `evaluarPoliticaClave(clave, contexto)`, `politicaClaveValidator(opciones)` según H8-2; `ng lint` sin errores en el archivo. | RN-01, RN-02, RN-03 |
| T-03 | desarrollador-ionic | Escribir las pruebas del validador | `src/app/compartidos/validadores/politica-clave.validator.spec.ts` (nuevo) | T-02 | `ng test --watch=false --include='**/politica-clave.validator.spec.ts'` verde con PC-1…PC-6 (H8-9). | RN-01, RN-02 |
| T-04 | desarrollador-ionic | Crear las funciones de hash y verificación del PIN | `src/app/compartidos/seguridades/hash-pin.ts` (nuevo) | T-01 | Exporta `PREFIJO_HASH_PIN`, `ITERACIONES_PBKDF2_PIN = 310_000`, `ITERACIONES_MINIMAS_PIN = 100_000`, `BYTES_SAL_PIN = 16`, `BITS_HASH_PIN = 256`, `LONGITUD_PIN = 6`, `generarHashPin`, `verificarPinContraHash`, `esHashPin` según H8-3; sin `any`; `ng lint` OK. | RN-08, RN-09, RN-16 |
| T-05 | desarrollador-ionic | Escribir las pruebas de hash del PIN | `src/app/compartidos/seguridades/hash-pin.spec.ts` (nuevo) | T-04 | `ng test --watch=false --include='**/hash-pin.spec.ts'` verde con HP-1…HP-5. | RN-08, RN-09, RN-11, RN-16 |
| T-06 | desarrollador-ionic | Crear el modelo y la interfaz de acceso al PIN | `src/app/compartidos/modelos/pin-bloqueo.modelo.ts` (nuevo) | T-01 | Exporta `PinBloqueo`, `AccesoPinBloqueo`, `ResultadoVerificacionPin`, `SolicitudPin` según H8-4. | RN-12 |
| T-07 | desarrollador-ionic | Unificar la API de PIN de SQLite | `src/app/compartidos/servicios/data-base.service.ts:11` (clase), `:66-70` (comentario D-22), `:153-211` (métodos PIN) | T-06 | La clase declara `implements AccesoPinBloqueo`; firmas exactas de H8-4; `obtenerPinBloqueo` devuelve `PinBloqueo \| null` (primer elemento de `values` o `null`); `eliminarPinBloqueo` devuelve `Promise<string>`; sin `any` en los métodos PIN; métodos de `dividendoKelly` sin cambios (`git diff` de `:76-150` vacío). | RN-10, RN-12, RN-19 |
| T-08 | desarrollador-ionic | Unificar la API de PIN de IndexedDB | `src/app/compartidos/servicios/data-base-web.service.ts:4` (clase), `:166-290` (métodos PIN) | T-06 | `implements AccesoPinBloqueo`; mismas firmas que T-07; `obtenerPinBloqueo` devuelve `PinBloqueo \| null` y ante error rechaza (no resuelve un string, hoy `:224-225`); `dbVersion` sigue en 1 (`:6`); métodos `dividendoKelly` sin cambios. | RN-10, RN-12, RN-19 |
| T-09 | desarrollador-ionic | Crear la feature de store compartida del PIN | `src/app/compartidos/store/pin-bloqueo.feature.ts` (nuevo) | T-04, T-06 | Exporta `conPinBloqueo(obtenerAcceso)` con estado, computed y métodos de H8-5 (`cargarPinBloqueo`, `guardarPin`, `verificarPin`, `eliminarPinBloqueo`, `limpiarVerificacion`), todos `rxMethod` con el pipeline estándar; no expone `pin_codigo` en computed. | RN-08, RN-10, RN-11, RN-13 |
| T-10 | desarrollador-ionic | Componer los stores pareados con la feature | `src/app/compartidos/store/dbPIN-app.store.ts:1-121`, `src/app/compartidos/store/dbPIN-web.store.ts:1-116` | T-07, T-08, T-09 | Cada archivo queda en `export const DbPINAppStore = signalStore({ providedIn: 'root' }, conPinBloqueo(() => inject(DataBaseService)));` (web: `DbPINWebStore`, `DataBaseWebService`); `ng build --configuration development` compila tras T-11…T-13 y T-24. | RN-12 |
| T-11 | desarrollador-ionic | Escribir las pruebas de la feature PIN con un acceso en memoria | `src/app/compartidos/store/pin-bloqueo.feature.spec.ts` (nuevo) | T-09 | `ng test --watch=false --include='**/pin-bloqueo.feature.spec.ts'` verde con PB-1…PB-5 (H8-9). | RN-10, RN-11, RN-13 |
| T-12 | desarrollador-ionic | Adaptar el desbloqueo a `verificarPin` y cerrar sesión tras errores | `src/app/paginas/configuracion/bloqueo/bloqueo.page.ts:31-143` | T-10 | Se eliminan `passcodeDB` (`:47`) y `consultarPIN` (`:124-143`) y su llamada (`:65`); `validarPin` (`:86-122`) usa `store.verificarPin` + `resultadoVerificacion()`; `'sin-pin'` → `/inicio` (D-12); `> 3` errores → toast + `ServicioInactividad.salir()` (D-14); error de store no cuenta intento; `grep -n "pin_codigo" ` en el archivo = 0. | RN-13, RN-14, RN-15 |
| T-13 | desarrollador-ionic | Adaptar el guardado del PIN en el modal | `src/app/paginas/configuracion/modal-pin/modal-pin.page.ts:85-146` | T-10 | `guardarPin` privado llama a `store.guardarPin({ pin, idUsuario })`, espera con `esperarCargaDeStore`, muestra toast `success` con `mensajeOperacion()` o `danger` con `errorMessage()` (sin heurística de texto `:130-133`) y cierra con `{ pinCreado: !errorMessage() }`; sin lecturas de `pin_idPin` ni `pinBloqueo()`. | RN-10, RN-13, RN-16 |
| T-14 | desarrollador-ionic | Crear modelos y servicio HTTP de recuperación | `src/app/paginas/util/modelos/RecuperacionClave.modelo.ts` (nuevo), `src/app/paginas/util/servicios/recuperacion-clave.service.ts` (nuevo) | T-01 | Modelos y métodos exactamente como H8-6; URL base `environment.apiUrlLoge`; sin estado ni `subscribe`. | G-07 |
| T-15 | desarrollador-ionic | Crear el store de recuperación | `src/app/paginas/util/store/recuperacion-clave.store.ts` (nuevo) | T-14 | `RecuperacionClaveStore` según H8-7 (estado `paso`, `correo`, `mensajeSolicitud`, `loading`, `error`; `solicitarCodigo`, `restablecerClave`, `volverASolicitar`, `reiniciar`); sin condiciones sobre el contenido de la respuesta de `solicitarRecuperacion`. | RN-05 |
| T-16 | desarrollador-ionic | Escribir las pruebas del store de recuperación | `src/app/paginas/util/store/recuperacion-clave.store.spec.ts` (nuevo) | T-15 | `ng test --watch=false --include='**/recuperacion-clave.store.spec.ts'` verde con RC-1…RC-4. | RN-05 |
| T-17 | desarrollador-ionic | Crear los dos componentes presentacionales de recuperación | `src/app/paginas/util/componentes/formulario-solicitar-codigo/formulario-solicitar-codigo.component.ts\|html\|scss` (nuevos), `src/app/paginas/util/componentes/formulario-restablecer-clave/formulario-restablecer-clave.component.ts\|html\|scss` (nuevos) | T-02, T-15 | Inputs/outputs exactos de H8-8; sin `inject()`; `OnPush`; restablecer usa `politicaClaveValidator({ correo: correo() })`; mensajes de política con `MENSAJES_POLITICA_CLAVE`; `grep -n "inject(" ` en ambos = 0. | RN-04, G-07, G-11 |
| T-18 | desarrollador-ionic | Crear la página orquestadora de recuperación | `src/app/paginas/util/recuperar-clave/recuperar-clave.page.ts\|html\|scss` (nuevos) | T-17 | Inyecta solo `RecuperacionClaveStore`, `Router`, `UtilitariosService`; plantilla compone encabezado propio (como `login.page.html:1-5`, sin menú) y `@switch (paso())` con los dos componentes; toasts y navegación según H3 Flujos A/B; sin lógica de dominio. | G-07, G-11 |
| T-19 | desarrollador-ionic | Registrar la ruta pública y el enlace desde el login | `src/app/app.routes.ts:6-10`, `src/app/app.component.ts:37`, `src/app/paginas/util/login/login.page.ts:82-84`, `src/app/paginas/util/login/login.page.html:99-100` | T-18 | Ruta `recuperar-clave` con `loadComponent` sin `canActivate` tras `login`; `rutasSinMenu` = `['/login', '/registro', '/recuperar-clave']`; método `irARecuperarClave()` y botón `fill="clear"` "¿Olvidaste tu contraseña?" en el lugar del comentario `<!-- Additional Options -->`; en navegador sin sesión `/recuperar-clave` carga. | RN-17, G-07 |
| T-20 | desarrollador-ionic | Cambiar el contrato de cambio de clave | `src/app/paginas/configuracion/modelos/Perfil.modelo.ts:16-20`, `:27-33` | T-01 | `CambiarClaveRequest { claveActual: string; claveNueva: string; }`; se elimina `MIN_LENGTH_CLAVE` de `VALIDACIONES`; `perfil.service.ts:28-33` compila sin cambios. | RN-06, B-06 |
| T-21 | desarrollador-ionic | Crear el componente presentacional de cambio de clave | `src/app/paginas/configuracion/componentes/formulario-cambio-clave/formulario-cambio-clave.component.ts\|html\|scss` (nuevos) | T-02, T-20 | Inputs `estaCargando`, `reinicioSolicitado`; output `cambioClaveEnviado: CambiarClaveRequest`; campos `claveActual` (required), `claveNueva` (`politicaClaveValidator({})`), `confirmacion` (igual a `claveNueva`); sin `inject()`; `OnPush`. | RN-04, RN-06, G-07 |
| T-22 | desarrollador-ionic | Integrar el componente en el perfil | `src/app/paginas/configuracion/perfil/perfil.page.ts:46`, `:94-116`, `:146-178`, `:187-189`, `:205-214`; `src/app/paginas/configuracion/perfil/perfil.page.html:291-354` | T-21 | Se eliminan `contrasenaForm`, `validarContrasenas`, `cambiarContrasena` y el `patchValue` de `usuario`; nuevo `alCambiarClave(datos)` → `perfilStore.cambiarClave(datos)`; señal `reinicioFormularioClave` (+1 en éxito); el effect de clave no muestra toast de error (D-18); la sección HTML usa `<app-formulario-cambio-clave>`. | RN-06, G-07 |
| T-23 | desarrollador-ionic | Aplicar política y mensaje de duplicados en el registro | `src/app/paginas/suscripcion/registro/registro.page.ts:73-78`, `:127-131`, `:187`; `src/app/paginas/suscripcion/registro/registro.page.html:239-245`; `src/app/paginas/util/store/personaStore.ts:46-52` | T-02 | `contrasena: ['', [Validators.required, politicaClaveValidator({ campoUsuario: 'usuario', campoCorreo: 'correo' })]]`; `registrarUsuario` llama `this.registroForm.get('contrasena')?.updateValueAndValidity()` antes de `invalid`; se elimina el effect `:73-78`; el `ion-note` muestra `MENSAJES_POLITICA_CLAVE` según la clave de error; `personaStore` guarda `(err as Error)?.message \|\| 'Error en el registro'`. | RN-04, RN-07, B-07 |
| T-24 | desarrollador-ionic | Adaptar cambiar-pin y login al nuevo store de PIN | `src/app/paginas/configuracion/cambiar-pin/cambiar-pin.page.ts:13`, `:38-39`, `:46`, `:66-75`, `:91-129`, `:131-169`; `src/app/paginas/configuracion/cambiar-pin/cambiar-pin.page.html:12-17`, `:85-111`; `src/app/paginas/util/login/login.page.ts:145-157` | T-10 | cambiar-pin: `objFormaMostrar = ['PIN', 'OLVIDÉ MI PIN']`; `capturarPin` usa `verificarPin` (correcto → `mostrarModal`, incorrecto → `redireccionError` sin cambios); opción 'OLVIDÉ MI PIN' → `AlertController` → `eliminarPinBloqueo` → `ServicioInactividad.salir()` (D-13); se eliminan `claveForm`, `validarClave`, `LoginServicio`, `DataBaseService` y el `subscribe`; texto de ayuda actualizado. login: `validarPIN` usa `store.tienePin()`. `grep -rn "pin_codigo\|loginServicio.autenticar" src/app/paginas/configuracion src/app/paginas/util/login` = 0. | RN-13, RN-14, D-13 |
| T-25 | desarrollador-ionic | Ejecutar lint y pruebas | — (sin cambios de código) | T-03, T-05, T-11, T-12, T-13, T-16, T-19, T-22, T-23, T-24 | `ng lint` 0 errores; `ng test --watch=false --include='**/politica-clave.validator.spec.ts' --include='**/hash-pin.spec.ts' --include='**/pin-bloqueo.feature.spec.ts' --include='**/recuperacion-clave.store.spec.ts'` verde (salida real). | Pruebas |
| T-26 | desarrollador-ionic | Ejecutar las builds y los grep de invariantes | — (sin cambios de código) | T-25 | `ng build --configuration development` y `ng build --configuration production` sin errores ni violación de presupuestos; `grep -rn "pin_codigo" src/app/paginas` = 0; `grep -rni "claves_comunes\|clavesComunes" src/` = 0; `grep -rn "422" src/app/paginas/util src/app/paginas/configuracion src/app/compartidos/validadores` = 0; `grep -c "implements AccesoPinBloqueo" src/app/compartidos/servicios/data-base*.ts` suma 2; `git diff --stat` sin `paginas/criterioKelly/`. | RN-03, RN-12, RN-13, RN-18, RN-19 |
| T-27 | desarrollador-ionic | Probar el flujo manual en local | — (sin cambios de código) | T-26 | Evidencia (capturas o texto) de M-1…M-7 de H8-10 con `ionic serve --port=8100` contra los backends locales (HLT-06 con Mailpit `http://localhost:8025` o `CORREO_MODO=log`). | G-07, G-09, B-07, RN-05, RN-11, RN-14, RN-15 |
| T-28 | desarrollador-ionic | Actualizar la documentación de la app | `README.md` (sección "Sesión y seguridad", línea 190; "Persistencia local", línea 181), `CLAUDE.md` (sección "Dual Persistence", tabla `pinBloqueo`), `docs/doc_arquitectura.md` (§3.4 stores, §4.1 endpoints, §5.6) | T-27 | README describe recuperación (`/recuperar-clave`), cambio de clave con clave actual, política B-02 en la app y el formato `pbkdf2-sha256$…` del PIN con su migración; `doc_arquitectura.md` §4.1 lista `recuperacion-clave.service.ts` y `actualizarClave { claveActual, claveNueva }`; CLAUDE.md indica que `pinBloqueo.pin_codigo` guarda un hash. | Plan §5.5 |

---

## H8. Reglas de implementación deterministas

Rigen RI-1…RI-11 de `doc_modo_planificacion.md` §10 y `.claude/agents/desarrollador-ionic.md` (componentes presentacionales sin `inject()`, página orquestadora, lógica en el store, servicios solo de acceso a datos, sin `subscribe` manual, sin `console.*`, sin números mágicos). Excepciones registradas: D-05 (sufijo `.feature.ts`), D-01 (`RecuperacionClave.modelo.ts` en PascalCase por coherencia con `util/modelos/Login.modelo.ts`, AF-4).

### H8-1. Reglas específicas

- **RI-08-1** Ningún archivo nuevo usa `any`. Los callbacks de IndexedDB tipan `event.target` como `IDBRequest<…>` (patrón: `(cursorReq.result as IDBCursorWithValue \| null)`).
- **RI-08-2** Ningún archivo nuevo usa `localStorage`/`sessionStorage`.
- **RI-08-3** Las páginas solo leen del store de PIN: `isLoading`, `errorMessage`, `mensajeOperacion`, `tienePin`, `resultadoVerificacion`. Nunca `pin`.
- **RI-08-4** La página que espera un `rxMethod` usa `utilServicio.esperarCargaDeStore(() => store.isLoading())`.
- **RI-08-5** Textos de UI nuevos (literal, en español): botón login "¿Olvidaste tu contraseña?"; título de la página "Recuperar contraseña"; botón paso 1 "Enviar código"; botón paso 2 "Restablecer contraseña"; enlace "Pedir otro código"; botón "Volver al inicio de sesión"; éxito final 'Contraseña restablecida. Inicie sesión con su nueva contraseña.'; opción PIN 'OLVIDÉ MI PIN'; alerta: header 'Olvidé mi PIN', message 'Se eliminará el PIN de este dispositivo y se cerrará la sesión. Al volver a iniciar sesión podrá crear uno nuevo.', botones 'Cancelar' / 'Continuar'.

### H8-2. `politica-clave.validator.ts`

```ts
export const LONGITUD_MINIMA_CLAVE = 10;
export const LONGITUD_MAXIMA_CLAVE = 128;

export interface ErroresPoliticaClave {
  longitudMinima?: true;
  longitudMaxima?: true;
  igualAUsuario?: true;
  igualACorreo?: true;
}
export interface ContextoPoliticaClave { usuario?: string | null; correo?: string | null; }
export interface OpcionesPoliticaClave {
  campoUsuario?: string;   // nombre del control hermano en el mismo FormGroup
  campoCorreo?: string;
  correo?: string | null;  // valor fijo (restablecimiento)
}
export const MENSAJES_POLITICA_CLAVE: Readonly<Record<keyof ErroresPoliticaClave, string>> = {
  longitudMinima: 'La contraseña debe tener al menos 10 caracteres',
  longitudMaxima: 'La contraseña no puede superar 128 caracteres',
  igualAUsuario: 'La contraseña no puede ser igual al usuario',
  igualACorreo: 'La contraseña no puede ser igual al correo',
};
export function evaluarPoliticaClave(clave: string, contexto: ContextoPoliticaClave): ErroresPoliticaClave | null;
export function politicaClaveValidator(opciones: OpcionesPoliticaClave): ValidatorFn; // devuelve { politicaClave: ErroresPoliticaClave } | null
```

- Longitud: `Array.from(clave).length` (puntos de código). Valor vacío → `null` (lo cubre `Validators.required`).
- Igualdad: `normalizar = (v) => v.trim().toLowerCase()`; solo se compara si el valor de contexto, normalizado, no está vacío.
- `politicaClaveValidator` lee los hermanos con `control.parent?.get(nombre)?.value`; si `opciones.correo` viene, prevalece sobre `campoCorreo`.
- Los mensajes son constantes con nombre (sin literales en plantillas).

### H8-3. `hash-pin.ts`

```ts
export const PREFIJO_HASH_PIN = 'pbkdf2-sha256';
export const ITERACIONES_PBKDF2_PIN = 310_000;
export const ITERACIONES_MINIMAS_PIN = 100_000;
export const BYTES_SAL_PIN = 16;
export const BITS_HASH_PIN = 256;
export const LONGITUD_PIN = 6;
export const ERROR_PIN_SIN_CRIPTOGRAFIA = 'PIN_SIN_CRIPTOGRAFIA';

export interface ResultadoComparacionPin { esCorrecto: boolean; requiereMigracion: boolean; }
export function esHashPin(valor: string): boolean;                      // empieza por `${PREFIJO_HASH_PIN}$`
export async function generarHashPin(pin: string): Promise<string>;
export async function verificarPinContraHash(pinIngresado: string, valorAlmacenado: string): Promise<ResultadoComparacionPin>;
```

- `obtenerSubtle()`: `globalThis.crypto?.subtle`; si no existe → `throw new Error(ERROR_PIN_SIN_CRIPTOGRAFIA)`.
- Derivación: `importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])` → `deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, clave, BITS_HASH_PIN)`.
- `generarHashPin`: valida `/^\d{6}$/` (si no, `throw new Error('PIN_INVALIDO')`); sal `crypto.getRandomValues(new Uint8Array(BYTES_SAL_PIN))`; devuelve `` `${PREFIJO_HASH_PIN}$${ITERACIONES_PBKDF2_PIN}$${base64(sal)}$${base64(hash)}` ``. Base64 con `btoa(String.fromCharCode(...bytes))`; decodificación con `atob`.
- `verificarPinContraHash`:
  - Si `esHashPin(valorAlmacenado)`: separa por `$` en 4 partes; iteraciones entero; si formato inválido, iteraciones `< ITERACIONES_MINIMAS_PIN`, sal ≠ 16 bytes o hash ≠ 32 bytes → `{ esCorrecto: false, requiereMigracion: false }`. Deriva con la sal e iteraciones guardadas y compara con `compararEnTiempoConstante`. `requiereMigracion = esCorrecto && iteraciones < ITERACIONES_PBKDF2_PIN`.
  - Si no (PIN heredado en claro): `a = TextEncoder(pinIngresado)`, `b = TextEncoder(valorAlmacenado)`; compara en tiempo constante sobre `max(a.length, b.length)` rellenando con 0 y acumulando además la diferencia de longitudes; `requiereMigracion = esCorrecto`.
- `compararEnTiempoConstante(a, b)`: `let diferencia = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diferencia |= (a[i] ?? 0) ^ (b[i] ?? 0); return diferencia === 0;` (sin `return` dentro del bucle).
- Sin `console.*`. Sin dependencias externas.

### H8-4. `pin-bloqueo.modelo.ts` y firmas de los servicios

```ts
export interface PinBloqueo { pin_idPin: number; pin_codigo: string; pin_idUsuario: number; }
export interface AccesoPinBloqueo {
  obtenerPinBloqueo(pin_idUsuario: number): Promise<PinBloqueo | null>;
  agregarPinBloqueo(pin_codigo: string, pin_idUsuario: number): Promise<string>;
  editarPinBloqueo(pin_codigo: string, pin_idPin: number, pin_idUsuario: number): Promise<string>;
  eliminarPinBloqueo(pin_idUsuario: number): Promise<string>;
}
export type ResultadoVerificacionPin = 'correcto' | 'incorrecto' | 'sin-pin';
export interface SolicitudPin { pin: string; idUsuario: number; }
```

- Se conservan los nombres de columna `pin_*` (contrato local existente).
- Mensajes de retorno de `agregar`/`editar`/`eliminar`: 'PIN creado correctamente.', 'PIN actualizado correctamente.', 'PIN eliminado correctamente.'; ante error **rechazan** la promesa con `new Error('No se pudo guardar el PIN')` / `'No se pudo eliminar el PIN'` (ya no resuelven strings con `JSON.stringify(e)`, que hoy pueden filtrar detalles: `data-base.service.ts:167`, `data-base-web.service.ts:194`).
- `pin_idUsuario` deja de aceptar `null` (hoy `number | null`, `data-base.service.ts:155`).

### H8-5. `pin-bloqueo.feature.ts`

```ts
type EstadoPinBloqueo = {
  pin: PinBloqueo | null;
  resultadoVerificacion: ResultadoVerificacionPin | null;
  loading: boolean;
  error: string | null;
  mensaje: string | null;
};
export function conPinBloqueo(obtenerAcceso: () => AccesoPinBloqueo) {
  return signalStoreFeature(
    withState<EstadoPinBloqueo>(estadoInicial),
    withComputed(({ pin, loading, error, mensaje }) => ({
      isLoading: computed(() => loading()),
      errorMessage: computed(() => error()),
      mensajeOperacion: computed(() => mensaje()),
      tienePin: computed(() => !!pin()),
    })),
    withMethods((store, acceso = obtenerAcceso()) => ({ /* rxMethods */ })),
  );
}
```

- `withComputed` **no** reexporta `resultadoVerificacion` (ya es señal de estado; quirk de `@ngrx/signals`).
- `cargarPinBloqueo: rxMethod<number>` → `pin`.
- `guardarPin: rxMethod<SolicitudPin>`: `from(generarHashPin(pin))` → `from(acceso.obtenerPinBloqueo(idUsuario))` → `editar` o `agregar` → `patchState({ mensaje, pin: { … pin_codigo: hash } })`.
- `verificarPin: rxMethod<SolicitudPin>`: H3 Flujo F. Si la escritura de la migración falla: `resultadoVerificacion` sigue `'correcto'` y `error = 'No se pudo actualizar la protección del PIN'`.
- `eliminarPinBloqueo: rxMethod<number>` → `pin: null`, `mensaje`.
- `limpiarVerificacion()`: `resultadoVerificacion: null, error: null`.
- Mensajes de error del store: `ERROR_PIN_SIN_CRIPTOGRAFIA` → 'Este dispositivo no permite proteger el PIN. Puede continuar sin PIN.'; otros → 'No se pudo guardar el PIN' / 'No se pudo verificar el PIN' / 'No se pudo eliminar el PIN'.
- Pipeline: `tap(loading=true, error=null, mensaje=null)` → `switchMap` → `tap(patchState)` → `catchError(→ patchState({ error }), of(null))` → `finalize(loading=false)`.

### H8-6. Recuperación: modelos y servicio

```ts
// RecuperacionClave.modelo.ts
export interface SolicitudRecuperacion { correo: string; }
export interface RespuestaSolicitudRecuperacion { mensaje: string; }
export interface RestablecimientoClave { correo: string; codigo: string; claveNueva: string; }
export interface DatosRestablecimiento { codigo: string; claveNueva: string; }   // lo que emite el componente
export interface RespuestaRestablecimiento { success: string; }
export type PasoRecuperacion = 'solicitar' | 'restablecer' | 'completado';

// recuperacion-clave.service.ts
solicitarRecuperacion(s: SolicitudRecuperacion): Observable<RespuestaSolicitudRecuperacion>  // POST `${apiUrlLoge}autenticacion/solicitarRecuperacion`
restablecerClave(r: RestablecimientoClave): Observable<RespuestaRestablecimiento>             // POST `${apiUrlLoge}autenticacion/restablecerClave`
```

### H8-7. `RecuperacionClaveStore`

- Estado: `{ paso: PasoRecuperacion; correo: string; mensajeSolicitud: string | null; loading: boolean; error: string | null }`, inicial `{ 'solicitar', '', null, false, null }`.
- Computed: `isLoading`, `errorMessage`.
- `solicitarCodigo: rxMethod<string>`: éxito → `{ correo, mensajeSolicitud: respuesta.mensaje, paso: 'restablecer' }`; error → `{ error: (err as Error)?.message || 'No se pudo enviar la solicitud' }`.
- `restablecerClave: rxMethod<DatosRestablecimiento>`: arma `{ correo: store.correo(), ...datos }`; éxito → `paso: 'completado'`; error → `error` con el mensaje.
- `volverASolicitar()` → `paso: 'solicitar', error: null` (conserva `correo`). `reiniciar()` → estado inicial.

### H8-8. Componentes presentacionales

| Componente | Selector | Inputs | Outputs |
|------------|----------|--------|---------|
| `FormularioSolicitarCodigoComponent` | `app-formulario-solicitar-codigo` | `estaCargando = input(false)`, `correoInicial = input('')` | `solicitudEnviada = output<string>()` |
| `FormularioRestablecerClaveComponent` | `app-formulario-restablecer-clave` | `estaCargando = input(false)`, `correo = input.required<string>()` | `restablecimientoEnviado = output<DatosRestablecimiento>()`, `solicitarOtroCodigo = output<void>()` |
| `FormularioCambioClaveComponent` | `app-formulario-cambio-clave` | `estaCargando = input(false)`, `reinicioSolicitado = input(0)` | `cambioClaveEnviado = output<CambiarClaveRequest>()` |

- Formularios con `new FormGroup({...})`; confirmación con validador de grupo `clavesCoinciden` local al componente; `effect(() => { reinicioSolicitado(); formulario.reset(); })` en el de cambio de clave.
- Los componentes importan `IonicComponentes` y `ReactiveFormsModule`; `changeDetection: ChangeDetectionStrategy.OnPush`; plantillas con `@if`/`@for`.

### H8-9. Casos de prueba (specs)

| ID | Spec | Caso |
|----|------|------|
| PC-1 | politica-clave | 9 caracteres → `longitudMinima`; 10 → `null` |
| PC-2 | politica-clave | 129 → `longitudMaxima`; 128 → `null` |
| PC-3 | politica-clave | `'😀'.repeat(10)` → `null` (puntos de código) |
| PC-4 | politica-clave | Igual al usuario con otras mayúsculas y espacios → `igualAUsuario` |
| PC-5 | politica-clave | Igual al correo → `igualACorreo`; contexto vacío no compara |
| PC-6 | politica-clave | `politicaClaveValidator` en un `FormGroup` con `usuario` y `correo` hermanos devuelve `{ politicaClave: {...} }` |
| HP-1 | hash-pin | `generarHashPin('123456')` cumple la regex de RN-08; dos llamadas devuelven valores distintos |
| HP-2 | hash-pin | `verificarPinContraHash('123456', hash)` → `{ true, false }`; `'654321'` → `{ false, false }` |
| HP-3 | hash-pin | Hash con 1 byte alterado → `false`; formato con 3 partes o iteraciones `50000` → `false` |
| HP-4 | hash-pin | Heredado: `('123456', '123456')` → `{ true, true }`; `('123456', '12345')` → `{ false, false }` |
| HP-5 | hash-pin | Con `spyOnProperty(globalThis, 'crypto')` devolviendo un objeto sin `subtle` → `generarHashPin` rechaza con `PIN_SIN_CRIPTOGRAFIA` |
| PB-1 | pin-bloqueo.feature | `guardarPin` sin registro → el acceso en memoria recibe `agregarPinBloqueo` con un valor que `esHashPin` |
| PB-2 | pin-bloqueo.feature | `verificarPin` correcto/incorrecto/sin registro → `'correcto'`/`'incorrecto'`/`'sin-pin'` |
| PB-3 | pin-bloqueo.feature | Registro heredado `'123456'` + `verificarPin('123456')` → `'correcto'` y el valor guardado pasa a `pbkdf2-sha256$…` |
| PB-4 | pin-bloqueo.feature | Registro heredado + PIN incorrecto → `'incorrecto'` y el valor guardado sigue `'123456'` |
| PB-5 | pin-bloqueo.feature | `tienePin()` refleja `cargarPinBloqueo`; ningún computed expone `pin_codigo` |
| RC-1 | recuperacion-clave.store | `solicitarCodigo` con respuesta `{ mensaje: 'X' }` → `paso 'restablecer'`, `mensajeSolicitud 'X'` |
| RC-2 | recuperacion-clave.store | Error en `solicitarCodigo` → `paso 'solicitar'`, `error` con el mensaje |
| RC-3 | recuperacion-clave.store | `restablecerClave` envía `{ correo, codigo, claveNueva }` y pasa a `'completado'` |
| RC-4 | recuperacion-clave.store | `volverASolicitar` conserva `correo`; `reiniciar` vuelve al estado inicial |

Las specs de stores usan `TestBed.configureTestingModule({ providers: [...] })` con dobles: un `AccesoPinBloqueo` en memoria (clase de prueba en el mismo spec, construyendo el store con `signalStore(conPinBloqueo(() => acceso))`) y `{ provide: RecuperacionClaveService, useValue: jasmine.createSpyObj(...) }`. Las specs esperan los `rxMethod` asíncronos con `await new Promise(r => setTimeout(r))` hasta que `isLoading()` sea `false` (máximo 3 s por la derivación PBKDF2).

### H8-10. Flujo manual (T-27)

| ID | Pasos | Resultado esperado |
|----|-------|--------------------|
| M-1 | Sin sesión, `/login` → "¿Olvidaste tu contraseña?" → correo existente → "Enviar código" | Toast con el mensaje del servidor; paso 2; correo en Mailpit (o en el log de HLT-06) con un código de 6 dígitos |
| M-2 | Repetir con un correo inexistente | Mismo mensaje y mismo paso 2 (sin diferencia visible); con el código real del M-1 y clave nueva válida → toast de éxito y `/login`; login con la clave nueva funciona |
| M-3 | Con sesión, `/perfil` → clave actual errónea + nueva válida | Toast con el mensaje del servidor; con la actual correcta → 'Contraseña actualizada exitosamente' y la sesión sigue activa |
| M-4 | `/registro` con usuario o correo ya usados | La caja de error muestra el mensaje uniforme del servidor; con clave de 9 caracteres o igual al usuario, el botón no avanza y se ve el mensaje de política |
| M-5 | En `/bloqueo`, 4 PIN erróneos | Toast 'Demasiados intentos fallidos', `/login`; escribir `/inicio` redirige a `/login` |
| M-6 | Login con clave errónea 3 veces | Comportamiento actual (toast y `App.exitApp()`); inactividad de 5 minutos lleva a `/bloqueo` |
| M-7 | En Chrome DevTools > Application > IndexedDB > `CriterioKellyDB` > `pinBloqueo`, editar el registro del usuario y poner `pin_codigo: "123456"`; forzar `/bloqueo`; ingresar `123456` | Desbloquea; al refrescar la vista de IndexedDB, `pin_codigo` empieza por `pbkdf2-sha256$310000$`; un nuevo desbloqueo con `123456` funciona; anotar el tiempo aproximado de desbloqueo |

---

## H9. Reglas de seguimiento de ejecución

El agente de implementación mantiene una ficha por tarea y el tablero global (RS-1…RS-9). Para T-01, T-25, T-26 y T-27 (tareas sin cambios de código) C1 y C6 se marcan `➖` con la justificación "tarea de verificación".

### Fichas

```
T-01 — Verificar precondiciones de HLT-06 y HLT-07
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-02 — Crear el validador de política B-02
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-03 — Escribir las pruebas del validador
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-04 — Crear las funciones de hash y verificación del PIN
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-05 — Escribir las pruebas de hash del PIN
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-06 — Crear el modelo y la interfaz de acceso al PIN
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-07 — Unificar la API de PIN de SQLite
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-08 — Unificar la API de PIN de IndexedDB
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-09 — Crear la feature de store compartida del PIN
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-10 — Componer los stores pareados con la feature
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-11 — Escribir las pruebas de la feature PIN
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-12 — Adaptar el desbloqueo a verificarPin y cerrar sesión
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-13 — Adaptar el guardado del PIN en el modal
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-14 — Crear modelos y servicio HTTP de recuperación
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-15 — Crear el store de recuperación
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-16 — Escribir las pruebas del store de recuperación
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-17 — Crear los componentes presentacionales de recuperación
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-18 — Crear la página orquestadora de recuperación
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-19 — Registrar la ruta pública y el enlace desde el login
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-20 — Cambiar el contrato de cambio de clave
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-21 — Crear el componente presentacional de cambio de clave
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-22 — Integrar el componente en el perfil
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-23 — Aplicar política y mensaje de duplicados en el registro
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-24 — Adaptar cambiar-pin y login al nuevo store de PIN
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-25 — Ejecutar lint y pruebas
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-26 — Ejecutar las builds y los grep de invariantes
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-27 — Probar el flujo manual en local
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-28 — Actualizar la documentación de la app
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

### Tablero global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-13 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-14 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-15 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-16 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-17 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-18 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-19 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-20 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-21 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-22 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-23 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-24 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-25 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-26 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-27 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-28 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

Reglas adicionales: si T-01 queda BLOQUEADA, ninguna otra tarea pasa a EN_CURSO (RS-6). Si T-27 M-7 mide más de 3 s de desbloqueo en web, se registra como desviación con la medida real (no se cambian iteraciones sin re-revisión H6, RS-7).

---

## H10. Diseño del reporte de ejecución

El agente de implementación entrega el reporte con la estructura fija de `doc_modo_planificacion.md` §12.1:

```
REPORTE DE EJECUCIÓN — HLT-08 Claves y PIN en la app
  1. Resumen ejecutivo
  2. Estado global            (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas        (copia de H9: T-01…T-28 con C1…C6)
  4. Cobertura vs. HLT        (RN-01…RN-19, G-07, G-09, I-07, B-02, B-07, DH-15, S-17 → resultado)
  5. Cambios realizados       (ruta:línea y tipo de cambio)
  6. Verificaciones ejecutadas (curl de T-01, ng lint, ng test con los 4 specs, ng build dev/prod, greps de T-26, M-1…M-7 con resultado real)
  7. Desviaciones y decisiones (incluye las líneas reales si HLT-07 las desplazó)
  8. Pendientes / bloqueos
  9. Próximos pasos           (incluye O-08-1, O-08-2 y C-1 si siguen abiertos)
```

RR-1…RR-5 aplican sin excepciones. Además, la sección 6 incluye el tiempo de desbloqueo medido en M-7 y el valor real de `pin_codigo` (truncado tras el segundo `$`) antes y después de la migración.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

Rige `doc_modo_planificacion.md` §13 completo (AR-1…AR-6, CC-1…CC-5, AF-1…AF-4, IO-1…IO-9) y `.claude/agents/desarrollador-ionic.md`. Aplicación concreta:

| Artefacto | Archivo | Capa |
|-----------|---------|------|
| `RecuperarClavePage` | `paginas/util/recuperar-clave/recuperar-clave.page.ts` | Página orquestadora (única con `inject()`) |
| `FormularioSolicitarCodigoComponent`, `FormularioRestablecerClaveComponent` | `paginas/util/componentes/<nombre>/<nombre>.component.ts` | Presentacional (sin `inject()`) |
| `FormularioCambioClaveComponent` | `paginas/configuracion/componentes/formulario-cambio-clave/…` | Presentacional |
| `RecuperacionClaveStore` | `paginas/util/store/recuperacion-clave.store.ts` | Store (toda la lógica) |
| `RecuperacionClaveService` | `paginas/util/servicios/recuperacion-clave.service.ts` | Acceso a datos HTTP |
| Modelos de recuperación | `paginas/util/modelos/RecuperacionClave.modelo.ts` | Modelo (AF-4) |
| `politicaClaveValidator`, `evaluarPoliticaClave` | `compartidos/validadores/politica-clave.validator.ts` | Transversal (registro, perfil, recuperación) |
| `generarHashPin`, `verificarPinContraHash` | `compartidos/seguridades/hash-pin.ts` | Transversal de seguridad (funciones puras) |
| `conPinBloqueo` | `compartidos/store/pin-bloqueo.feature.ts` | Lógica compartida de los stores pareados |
| `PinBloqueo`, `AccesoPinBloqueo` | `compartidos/modelos/pin-bloqueo.modelo.ts` | Contrato de la BD local |

- Nombres: verbos + objeto en español (`solicitarCodigo`, `restablecerClave`, `guardarPin`, `verificarPin`); booleanos con `es/esta/tiene/hay` (`tienePin`, `estaCargando`); manejadores `al…` en páginas (`alSolicitarCodigo`, `alRestablecerClave`, `alCambiarClave`); constantes `UPPER_SNAKE_CASE` (`LONGITUD_MINIMA_CLAVE`, `ITERACIONES_PBKDF2_PIN`).
- Archivos nuevos en kebab-case con sufijo de rol; excepciones D-01 y D-05.
- Estilos SCSS por componente < 14 KB (IO-9); no se agregan estilos globales.
- Sin `NgModule`, sin `FormBuilder` inyectado en componentes nuevos, sin `any`, sin `console.*`, sin números mágicos (10, 128, 6, 16, 256, 310 000 y 100 000 son constantes con nombre).
