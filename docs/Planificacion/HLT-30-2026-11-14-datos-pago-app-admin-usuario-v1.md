# HLT-30-v1 — App: administración de datos de pago, QR de criptomonedas y flujo del usuario leyendo del backend (HU-005, ampliación «Datos de pago»)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-11-14 (v1) |
| Historia | `docs/Historia_usuario/HU-005-…md` (sección «Ampliación: datos de pago administrables») · pedido literal en HLT-29-v1 |
| Numeración | HLT-29-v1 (backend + BD; **dependencia obligatoria**) · **HLT-30-v1 (este)** |
| Proyecto y git | `criterioKellyApp` (git propio). Sin carpeta de evidencias |
| Agente | `desarrollador-ionic` en todas las tareas |
| Depende de | **HLT-29-v1 COMPLETADO** (endpoints `datosPago/*`, tablas aplicadas por el usuario), HLT-26-v2 (`GuardRoles`, menú por rol, carpeta `paginas/administracion/`), HLT-25-v2 (comprobante), HLT-20-v2. Se comprueba en T-01 |
| Entorno | Ionic 8 / Angular 20 / NgRx Signals; `npm install --legacy-peer-deps`; `ionic serve --port=8100`; tests con Edge: `CHROME_BIN` |
| Estado | Pendiente de ejecución. Decisiones abiertas DD-01…DD-04 con recomendación por defecto |

> **Reglas de entorno.** MySQL/Apache intocables; sin git de escritura; **sin archivos de evidencias ni reportes `.md`**; el token no se guarda en almacenamiento persistente; la imagen del QR tampoco (solo URL de objeto en memoria, revocada al salir); ningún dato de pago queda escrito en el código ni en `localStorage`/`Preferences`; no se inventan direcciones ni números (los specs usan valores obviamente falsos como `TEST…`).

---

## H1 · Propósito

1. Pantalla de **administración de datos de pago** (solo roles 1 y 2): redes USDT (alta, edición, orden, activar/desactivar, eliminar), QR por red (subir, previsualizar, reemplazar, quitar), PayPal, número de WhatsApp y plantilla opcional.
2. El flujo del usuario final (selector → datos → copiar → WhatsApp → «ya envié» → comprobante) **lee del backend** y muestra el **QR** junto a la dirección cripto.
3. **Se elimina del front** todo dato de pago (`datos-pago.config.ts`, `DATOS_PAGO_TOKEN`).

**Fuera de alcance.** Cambios de backend; QR de PayPal/banco; pasarelas; cambiar el comprobante, `SolicitudBancoService` ni la persistencia del «ya envié».

**Feature(s) afectada(s).** `src/app/paginas/suscripcion/{configuracion,store,componentes/instrucciones-pago,componentes/selector-metodo-pago,modelos,servicios}`, nueva `src/app/paginas/administracion/datos-pago/`, `src/app/app.routes.ts`, `src/assets/datos/menu.json`, `compartidos/store/menu.store.ts`.

---

## H2 · Reglas de negocio

| ID | Regla | Invariante verificable |
|----|-------|------------------------|
| RN-01 | Menú y ruta | Opción «Datos de pago» (ruta `datos-pago`, p. ej. `/administracion/datos-pago` según lo que ya use HLT-26) visible solo con roles 1 o 2 en `MenuStore`; ruta con `GuardAutenticacion` + `GuardRoles` `[1, 2]`; redirige a `/inicio`; la autorización real es la del servidor (403) |
| RN-02 | Clasificación de ruta | La ruta nueva entra en `permisos-plan.config.ts` como siempre habilitada (no depende del plan); la spec R-04 de HLT-20 sigue verde |
| RN-03 | Formulario de red | Campos: clave (solo al crear; mayúsculas), nombre, etiqueta, dirección, activa, orden. Validación en la app **igual a la del servidor** (RN-03 de HLT-29): TRON `^T[1-9A-HJ-NP-Za-km-z]{33}$`; ETH/BSC `^0x[0-9a-fA-F]{40}$`; otra clave `^[A-Za-z0-9]{16,128}$`; `trim`; mensajes claros («Una dirección TRON empieza con T y tiene 34 caracteres») |
| RN-04 | Confirmación | Antes de guardar o cambiar una dirección, PayPal o WhatsApp, se muestra la alerta «Vas a cambiar los datos donde los usuarios envían su dinero. Revisa el valor: <valor mostrado>»; eliminar/quitar QR pide confirmación |
| RN-05 | QR en la app | Selección con `ManejoImagenesService` (galería/archivo); tipos png, jpeg, webp; la app rechaza antes de enviar lo que pase de 256 KB o no sea de esos tipos (tope y tipos **leídos de una sola constante** `LIMITE_QR` con el valor de HLT-29-v1 RN-10); vista previa antes de confirmar; el servidor valida de nuevo (400) |
| RN-06 | QR protegido | La imagen se pide con `HttpClient` (`responseType: 'blob'`, con el `Authorization` del interceptor) y se muestra con una URL de objeto; se revoca al destruir el componente y al reemplazar; **no** se usa `innerHTML` ni se persiste |
| RN-07 | Lectura del usuario | `DatosPagoService.obtenerDisponibles()` (`GET datosPago/disponibles`) se llama al abrir el flujo de pago; el resultado vive en `MetodoPagoStore` (memoria); un fallo de red o 403 deja los métodos como no disponibles con el texto de RN-09 y un botón «Reintentar» |
| RN-08 | Disponibilidad | Cripto disponible si llegan redes; PayPal si llega `correo` o `enlace`; banco si llega `numero`. Misma lógica visible que hoy, ahora sobre la respuesta del servidor |
| RN-08b | Datos bancarios: administración sí, usuario todavía no | La pantalla de **administración** (`formulario-banco`) permite registrar, además del WhatsApp y la plantilla, los datos de la cuenta del propietario: titular, documento (opcional), banco/entidad, tipo de cuenta (lista: Ahorros, Corriente, Virtual, Otro → `AHORROS`, `CORRIENTE`, `VIRTUAL`, `OTRO`), número de cuenta, país/moneda (opcional) y observaciones (opcional), con los límites y patrones de RN-05b de HLT-29 (`mep_bancoTitular`, `mep_bancoDocumento`, `mep_bancoEntidad`, `mep_bancoTipoCuenta`, `mep_bancoCuenta`, `mep_bancoPaisMoneda`, `mep_bancoObservaciones`; si se escribe la cuenta, titular y banco son obligatorios). La pantalla del **usuario NO muestra** estos datos todavía: `disponibles` no los envía y el recorrido de banco sigue siendo solo el mensaje de WhatsApp. No se agrega ningún campo de cuenta al modelo `DatosPagoDisponibles`; mostrarlos será un cambio aparte. La app no escribe estos datos en consola ni en almacenamiento local |
| RN-09 | Fallback | Método sin datos: `MENSAJE_METODO_NO_DISPONIBLE = 'Este método aún no está disponible, elige otro'` (texto actual, sin cambios); mientras carga, el selector muestra el estado de carga y no permite elegir |
| RN-10 | WhatsApp | El mensaje se sigue **armando en el front** (`mensajeSolicitudBanco`: plan, intervalo, monto) y el número viene del backend (`enlaceWhatsapp(numero, mensaje)`). Si el backend envía `plantilla`, se usa reemplazando `{plan}` y `{monto}` con el resumen; si es `null`, el texto actual. El mensaje no lleva datos personales |
| RN-11 | Recorrido intacto | Método → datos → copiar (portapapeles) → WhatsApp con mensaje → «ya envié» persistido en el dispositivo (`SolicitudBancoService`, sin tocar) → comprobante. `IndicadorPasosPago`, `PasoPago.modelo` y la ruta `/comprobante` no cambian de comportamiento |
| RN-12 | QR junto a la dirección | `InstruccionesPagoComponent` muestra, por red con `tieneQr`, la imagen (alt «Código QR de la red <nombre>») junto a la dirección y su botón de copiar; sin QR, igual que hoy |
| RN-13 | XSS | Todo texto del backend se muestra con interpolación; prohibido `innerHTML`/`bypassSecurityTrustHtml`. Solo la URL de objeto del QR (creada por la app) puede pasar por `bypassSecurityTrustUrl` si el sanitizador la rechaza (se verifica en spec) |
| RN-14 | Arquitectura | Página orquestadora + componentes presentacionales (`input()`/`output()`, sin `inject`) + lógica en `signalStore` con `rxMethod` (`tap → switchMap → tapResponse → finalize`); servicios solo HTTP; nombres en español |
| RN-15 | Errores | 400/403/409/429 con el mensaje del servidor (interceptor); el 422 no se usa; tras un 403 en administración la app vuelve a `/inicio` |
| RN-16 | Privacidad en el dispositivo | `grep -n "localStorage\|sessionStorage\|Preferences"` sobre los archivos nuevos sin coincidencias nuevas (el «ya envió» existente queda fuera) |

---

## H3 · Flujo

```
Administrador → menú «Datos de pago» → DatosPagoAdminPage
  ngOnInit → DatosPagoAdminStore.cargar() → GET datosPago/administracion
  Redes (lista) ─▶ formulario de red ─▶ alerta de confirmación ─▶ POST guardarRed / cambiarEstadoRed / eliminarRed
  QR por red ─▶ seleccionar + validar + vista previa ─▶ POST subirQr / quitarQr ; vista = GET datosPago/qr (blob)
  PayPal, WhatsApp ─▶ POST guardarPaypal / guardarBanco ; método ─▶ POST cambiarEstadoMetodo

Usuario → PlanesPage / AvisoPlan → … → pantalla de métodos (selector-metodo-pago)
  MetodoPagoStore.cargarDatos() → GET datosPago/disponibles → opciones, redes, paypal, número
  elegir método → InstruccionesPago (dirección + QR blob, copiar | PayPal | enlace WhatsApp)
  «ya envié» (SolicitudBancoService, dispositivo) → /comprobante (sin cambios)
```

---

## H4 · Migración sin pérdida de funcionalidad

**Qué se BORRA.**
- `paginas/suscripcion/configuracion/datos-pago.config.ts` (archivo completo: constante `DATOS_PAGO`, token `DATOS_PAGO_TOKEN`).

**Qué se MUEVE/ADAPTA.**
- Las interfaces `RedUsdt` y `DatosPago` dejan de vivir en la config y pasan a `modelos/DatosPago.modelo.ts` como **tipos de la respuesta de la API** (`DatosPagoDisponibles`, `RedUsdtDisponible`, `DatosPagoAdministracion`, `RedUsdtAdmin`, con nombres de campo del backend: `red_clave`, `red_direccion`, `mep_…` en administración; en `disponibles` los nombres de H4 de HLT-29).
- `configuracion/textos-pago.ts`: se conserva (`MENSAJE_METODO_NO_DISPONIBLE`, `descripcionPlan`, `mensajeSolicitudBanco`, `enlaceWhatsapp`); `redesUsdtConfiguradas`, `paypalConfigurado` y `numeroWhatsapp` pasan a recibir `DatosPagoDisponibles | null` (o se eliminan si la respuesta ya viene filtrada, DD-03); el import de `./datos-pago.config` se reemplaza por el del modelo; se añade el soporte de `plantilla` (RN-10).
- `store/metodo-pago.store.ts`: se quita `inject(DATOS_PAGO_TOKEN)`; se inyecta `DatosPagoService`; nuevo estado `datos`, `loading`, `error`; `rxMethod` `cargarDatos`; los `computed` `redesUsdt`, `paypalDisponible`, `enlaceWhatsappBanco`, `opcionesMetodo` se calculan sobre `datos()`; la lógica de recorrido (`planDelRecorrido`, etapas del banco, `irAlComprobante`) **no cambia**.
- `componentes/instrucciones-pago/…ts`: el import de `RedUsdt` apunta al modelo; añade `input` `urlsQr` (mapa clave → URL de objeto) y se muestra el QR (RN-12). La página/contenedor que lo usa pide los blobs al store.
- `componentes/selector-metodo-pago`: estado de carga y «Reintentar» (RN-07, RN-09).
- Specs: `textos-pago.spec.ts` y `metodo-pago.store.spec.ts` dejan de importar `datos-pago.config` y de proveer `DATOS_PAGO_TOKEN`; proveen un `DatosPagoService` simulado con datos `TEST…`.

**Qué se CREA.** `servicios/datos-pago.service.ts` (usuario), `paginas/administracion/datos-pago/…` (página, store, servicio de administración, componentes), `modelos/DatosPago.modelo.ts`.

**Verificación con grep (todas deben cumplirse).**
```
grep -rn "datos-pago.config\|DATOS_PAGO_TOKEN\|DATOS_PAGO\b" criterioKellyApp/src      -> sin resultados
test ! -f criterioKellyApp/src/app/paginas/suscripcion/configuracion/datos-pago.config.ts
grep -rnE "T[1-9A-HJ-NP-Za-km-z]{33}|0x[0-9a-fA-F]{40}" criterioKellyApp/src --include=*.ts --include=*.html  -> solo specs con valores TEST obvios, ninguno en código de producción
grep -rn "wa\.me/[0-9]" criterioKellyApp/src                -> sin resultados (el número nunca va escrito)
grep -rn "paypal\.me\|@paypal" criterioKellyApp/src         -> sin resultados fuera de specs
```

---

## H5 · Calidad y cobertura

| Requerimiento | Reglas | Tareas | Prueba |
|---------------|--------|--------|--------|
| Persistir y administrar desde la interfaz | RN-01…RN-04 | T-03…T-09 | specs de store/componentes/página |
| Subir QR | RN-05, RN-06 | T-06, T-09 | spec de validación de QR y del componente |
| Sin perder funcionalidad | RN-07…RN-11 | T-10…T-12 | specs de store de método y de textos; manual M-02 |
| Pasar archivos del front al backend | H4 | T-13 | greps de H4 |

---

## H6 · Decisiones abiertas (recomendación por defecto; el usuario acepta o cambia)

| ID | Decisión | Recomendación |
|----|----------|---------------|
| DD-01 | Ubicación de la pantalla | `paginas/administracion/datos-pago/` con ruta `datos-pago`, junto a `validar-pagos` |
| DD-02 | Plantilla de mensaje de WhatsApp editable | Sí, opcional (campo en la pantalla); si se deja vacío se usa el texto actual |
| DD-03 | Filtros de `textos-pago.ts` | Eliminar `redesUsdtConfiguradas`/`paypalConfigurado` porque el servidor ya filtra; conservar `numeroWhatsapp` normalizando dígitos |
| DD-04 | Vista previa del QR del usuario | Mostrar el QR a tamaño fijo (220 px) con toque para ampliar |

---

## H7 · Plan de tareas

`S` = `src/app/paginas/suscripcion`, `AD` = `src/app/paginas/administracion/datos-pago`, `A` = `src/app`.

| ID | Tarea | Archivos | Depende | Criterio de aceptación | Cubre |
|----|-------|----------|---------|------------------------|-------|
| T-01 | Precondiciones y línea base | solo lectura | — | HLT-29-v1 `COMPLETADO`; con un token de administrador fixture, `GET datosPago/administracion` → 200 y con suscriptor → 403; existen `GuardRoles`, `menu.store.ts` con filtro por rol y `AD`-hermano `validar-pagos`; línea base de `ng lint`, `ng test --watch=false`, `ng build` (guardada en el informe, no en archivo) | — |
| T-02 | Modelos | `S/modelos/DatosPago.modelo.ts` (nuevo); `AD/modelos/DatosPagoAdmin.modelo.ts` (nuevo) | T-01 | Tipos de H4 de HLT-29 con nombres de campo del backend; `MetodoPago` reutilizado de `EstadoPago.modelo.ts`; constante `LIMITE_QR` | RN-03, RN-05 |
| T-03 | Servicios | `S/servicios/datos-pago.service.ts` (`obtenerDisponibles`, `obtenerQr(clave): Observable<Blob>`), `AD/servicios/administracion-datos-pago.service.ts` (todas las rutas de escritura), specs | T-02 | URL, método y cuerpo exactos; `obtenerQr` con `responseType: 'blob'`; specs verdes | RN-06, RN-07 |
| T-04 | Validadores | `AD/configuracion/validadores-pago.ts` (nuevo) + spec | T-02 | Patrones de RN-03 por clave, correo, enlace PayPal (`https` y host permitido), WhatsApp (dígitos 8–15), datos de la cuenta bancaria (RN-08b: documento, cuenta, tipo en lista, longitudes); mismos casos válidos/inválidos que la batería B del backend | RN-03 |
| T-05 | Store de administración | `AD/store/datos-pago-admin.store.ts` + spec | T-03 | `signalStore` con `redes`, `metodos`, `cargando`, `guardando`, `error`; `rxMethod` `cargar`, `guardarRed`, `cambiarEstadoRed`, `eliminarRed`, `guardarPaypal`, `guardarBanco`, `cambiarEstadoMetodo`, `subirQr`, `quitarQr`; recarga tras cada éxito; 403 → navega a `/inicio`; sin `Date` ni almacenamiento persistente | RN-14, RN-15 |
| T-06 | Componentes de administración | `AD/componentes/lista-redes`, `formulario-red`, `subida-qr`, `formulario-paypal`, `formulario-banco` (`ts, html, scss, spec`) | T-04 | Presentacionales sin `inject`; formularios reactivos con validadores de T-04 y mensajes claros; `subida-qr`: elegir, validar (`LIMITE_QR`), previsualizar, confirmar, reemplazar, quitar; activar/desactivar y orden; interpolación sin `innerHTML`; specs de validación | RN-03, RN-05, RN-13 |
| T-07 | Página de administración | `AD/datos-pago-admin.page.{ts,html,scss,spec.ts}` | T-05, T-06 | Orquesta store y componentes; alertas de confirmación de RN-04 con el valor a guardar; muestra el estado «sin datos cargados» cuando no hay nada | RN-04 |
| T-08 | Ruta, guarda y permisos | `A/app.routes.ts`, `S/configuracion/permisos-plan.config.ts` (+spec) | T-07 | Ruta `datos-pago` con `GuardAutenticacion` y `GuardRoles` `[1, 2]`; clasificada en permisos de plan; spec R-04 y estados × rutas verdes | RN-01, RN-02 |
| T-09 | Menú por rol | `src/assets/datos/menu.json`, `A/compartidos/modelos/menu.ts`, `menu.store.ts` + spec | T-08 | «Datos de pago» solo con roles `[1]`/`[2]`; con `[3]` no aparece; resto del menú igual | RN-01 |
| T-10 | Store del usuario | `S/store/metodo-pago.store.ts` + spec | T-03 | Cambios de H4; casos: carga correcta → opciones; vacío → no disponible; error → mensaje y reintentar; plan que cambia reinicia recorrido (igual que hoy); mensaje de WhatsApp con/sin `plantilla`; las specs existentes del recorrido siguen verdes | RN-07…RN-11 |
| T-11 | Textos | `S/configuracion/textos-pago.ts` + spec | T-02 | Según H4 y DD-03; spec actualizada sin token | RN-08…RN-10 |
| T-12 | Instrucciones, selector y QR del usuario | `S/componentes/instrucciones-pago/*`, `S/componentes/selector-metodo-pago/*`, contenedor que los usa | T-10, T-11 | QR junto a la dirección (RN-12) con URL de objeto revocada al destruir; estado de carga y «Reintentar»; copiar dirección igual que hoy; spec con y sin QR | RN-06, RN-09, RN-12 |
| T-13 | **Eliminar lo migrado** | borrar `S/configuracion/datos-pago.config.ts` | T-10…T-12 | Greps de H4 cumplidos; ningún import roto | H4 |
| T-14 | Verificación | `ng lint`, `ng test --watch=false` (Edge con `CHROME_BIN`), `ng build` | T-13 | Código 0 y sin fallos nuevos frente a la línea base; grep de RN-16 sin coincidencias nuevas | G-03 |
| T-15 | Documentar y entregar | `criterioKellyApp/README.md`, `criterioKellyApp/CLAUDE.md` | T-14 | README y CLAUDE: «Datos de pago» (se administran en la BD vía la pantalla; el front no los contiene); `git status --short` en el informe; mensaje sugerido «HU-005: datos de pago administrables y QR de criptomonedas»; sin commit | — |

**Orden:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11 → T-12 → T-13 → T-14 → T-15.

**Compuertas manuales del usuario.**
- **M-01 (antes de publicar):** con rol 1 o 2, abrir «Datos de pago», cargar sus redes (con QR), PayPal y WhatsApp **reales** y activar los métodos. Hasta entonces los usuarios verán «Este método aún no está disponible».
- **M-02 (usuario):** con un suscriptor con plan pendiente: elegir cripto, ver dirección y QR, copiar; PayPal; banco → abre WhatsApp con el mensaje (plan, intervalo, monto) → «ya envié» → cerrar y reabrir la app (persiste) → subir comprobante. Debe verse igual que antes.
- **M-03 (negativa):** un suscriptor no ve la opción de menú ni entra a la ruta; desactivar una red la oculta al usuario.
- Respuesta esperada del usuario: «PRUEBA MANUAL DATOS DE PAGO OK».

---

## H8 · Pruebas y seguridad

`ng lint`, `ng test --watch=false` con `CHROME_BIN` apuntando a Edge, `ng build`. Specs listadas en H7. Seguridad: control de acceso doble (guarda + servidor), validación de formato y de QR en cliente y servidor, sin `innerHTML`, blob con revocación, sin persistencia de datos de pago ni de imagen, confirmación antes de cambiar dónde se cobra, auditoría en el servidor (HLT-29).

## H9 · Riesgos

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| R-01 | Publicar sin cargar datos y dejar los pagos «no disponibles» | Alta | Compuerta M-01 |
| R-02 | Regresión del recorrido de pago | Alta | RN-11, specs existentes del store intactas, M-02 |
| R-03 | Fuga de URLs de objeto | Baja | Revocación en `ngOnDestroy` y al reemplazar; spec |
| R-04 | Validación de dirección distinta entre app y servidor | Media | Mismos patrones y casos en T-04 y en la batería B de HLT-29 |
| R-05 | Error de red deja el pago sin datos | Media | «Reintentar» y mensaje; el usuario puede pedirlos por otro medio |

## H10 · Seguimiento

Semántica `⬜ ✅ ❌ ➖`; ficha **C1** archivos, **C2** criterio, **C3** reglas de entorno, **C4** `ng lint`, **C5** `ng test` del archivo, **C6** sin efectos fuera de alcance. T-01…T-15 `PENDIENTE`. Informe final con salidas en el propio informe (sin archivos de evidencias).

## H11 · Convenciones

Archivos en kebab-case; `DatosPagoService`, `AdministracionDatosPagoService`, `DatosPagoAdminStore`, `DatosPagoAdminPage`; métodos con verbo en español; campos con los nombres de columna del backend.
