# HU-006 · Alertas y modales unificados y amigables

| Campo | Valor |
|-------|-------|
| ID | HU-006 |
| Fecha | 2026-11-15 |
| Estado | Implementada (HLT-31…HLT-35); pendiente la prueba manual M-01 del usuario («PRUEBA MANUAL HU-006 OK») |
| Prioridad | Media (consistencia y claridad; no cambia reglas de negocio) |
| Proyectos | `criterioKellyApp` únicamente. Sin cambios en backend ni en la base de datos. |
| Origen | Petición del usuario del 2026-11-15: el aviso «Tu plan Básico está pendiente de pago y se activará cuando valide tu comprobante.» debe mostrarse con un `alert`; todos los modales y alertas deben seguir el mismo modelo, amigable, sin perder funcionalidad ni lógica actual. |
| Agente de implementación | `desarrollador-ionic` |

## Historia

**Como** persona que usa la app,
**quiero** que todos los avisos, confirmaciones y mensajes informativos se vean y se comporten igual (mismo diseño, mismo orden de botones, mismo lenguaje cercano),
**para** entender rápido qué pasó y qué debo hacer, sin sorpresas entre pantallas.

**Como** desarrollador,
**quiero** una única forma declarativa y ligera de pintar avisos,
**para** reducir código repetido, consumo de memoria y errores al mantener la app.

## Decisión de diseño (la opción más ligera y efectiva)

| Tipo de mensaje | Componente | Motivo |
|-----------------|-----------|--------|
| Aviso informativo corto («Tu plan Básico está pendiente de pago y se activará cuando valide tu comprobante.») | `<ion-alert>` declarativo con un solo botón «Entendido» | El `ion-alert` es el control nativo más liviano: no monta una hoja con contenido propio ni gestos como `ion-modal` y solo se crea al abrirse. |
| Confirmación («¿Seguro que quieres…?») | `<ion-alert>` declarativo con «No» / «Sí» | Mismo patrón que ya usa `bitacora.page.html` («¿Está seguro de eliminar el registro?»). |
| Captura de pocos datos (1 a 3 campos) | `<ion-alert [inputs]>` | Evita un modal completo para un campo. |
| Contenido largo o interactivo (lista de planes, formularios de red/PayPal/banco, detalle del pago, selector de divisa, selector de fecha, imagen ampliada) | `<ion-modal>` | Necesita desplazamiento, varios controles o vista previa. Se mantiene. |
| Resultado rápido de una acción (guardado, error de red) | `toast` | Ya existe `UtilitariosService.mostrarToast`; no se toca. |

Reglas de rendimiento:
- Declarativos y gobernados por `[isOpen]` (signal) o `[trigger]`; **no** `AlertController.create` en TypeScript, que crea y destruye el elemento en cada llamada y obliga a `await`.
- Sin `keepContentsMounted`. Los alerts se montan al abrirse y se liberan al cerrarse.
- Un solo estilo global (`cssClass="alerta-ck"`) en `src/global.scss`; nada de estilos por pantalla.
- Textos y botones desde constantes en un solo archivo (`compartidos/textos-alertas.ts`) para que el tono sea uno solo.

## Modelo de alerta amigable (criterios de forma)

1. **Título corto y cercano** (máximo 5 palabras): «Plan pendiente», «Confirmar plan», «Cerrar sesiones».
2. **Mensaje en una o dos frases**, en segunda persona y sin tecnicismos; dice qué pasó **y** qué hacer.
3. **Botones**: confirmaciones con «No» (`role="cancel"`) y «Sí» (`role="confirm"`); informativos con un solo «Entendido». Acciones destructivas con «Sí, eliminar» / «Sí, cancelar».
4. **No se cierra tocando fuera** cuando la acción sea destructiva o pida datos (`backdropDismiss="false"`).
5. Contraste, tamaño de texto y orden de botones iguales en todas las pantallas.

## Alcance: inventario actual (src/app, 2026-11-15)

**Alertas hoy (17)**
- 1 declarativa: eliminar registro (`bitacora.page.html`).
- 16 creadas por código (`alertController.create` / `alertCtrl.create`) a migrar:
  - `app.component.ts`: Nueva versión disponible.
  - `inicio.page.ts`: Confirmar plan, Cancelar plan.
  - `validar-pagos.page.ts`: Aprobar pago, Rechazar pago (con motivo).
  - `datos-pago-admin.page.ts`: confirmaciones de cambios de datos de pago.
  - `perfil.page.ts`: Cerrar sesiones.
  - `operativa-kelly.page.ts`: Editar divisor, Confirmar cambio.
  - `cuentas.page.ts`: Crear, Editar, Eliminar, Aumentar/Reducir capital.
  - `modal-pin.page.ts`: Omitir PIN.
  - `cambiar-pin.page.ts`: Olvidé mi PIN.
  - `bloqueo.page.ts`: pide la contraseña si la cuenta no tiene PIN.

**Modales hoy (12)**
- 2 por código (`modalCtrl.create`): `login.page.ts` (crear PIN) y `cambiar-pin.page.ts`. Se evalúan: si el contenido es un formulario corto, pasan a `ion-alert`/`ion-modal` declarativo; si no, quedan.
- 10 `<ion-modal>` declarativos: `aviso-bloqueo` (planes), `modal-actualiza-plan`, `detalle-pago`, `datos-pago-admin` (red y QR), `validar-pagos`, `bitacora` (divisa y otro), `filtro-fechas` (2 selectores de fecha).

**Avisos que hoy son modal o tarjeta y deben pasar a alert informativo**
- `aviso-bloqueo` cuando el estado es `MINIMO_PENDIENTE` («Tu plan … está pendiente de pago y se activará cuando valide tu comprobante.», «terminó… tienes N días para pagarlo»): pasa a `ion-alert` con «Entendido» y, si procede, botón «Subir comprobante». La **lista de planes** (estado `SIN_PLAN`) **sigue siendo modal**, porque es contenido largo y seleccionable.
- `modal-actualiza-plan` (límite del plan superado): pasa a `ion-alert` con «Ver planes» / «Ahora no».
- Alerta de conflicto al elegir plan en `inicio` (409): ya es `ion-alert`; adopta los textos y el estilo comunes.

## Qué no cambia (sin pérdida de funcionalidad)

- Las decisiones salen del servidor y de `permisos-plan.config.ts`; los componentes siguen sin decidir permisos.
- Textos de negocio, validaciones, llamadas a stores y orden de los flujos de cada diálogo.
- El comportamiento al tocar «Sí» / «No» / «Entendido» (qué store se invoca, adónde se navega).
- Reglas de suscripción: elegir plan, prueba, Libre y cancelación (HU-004 y HU-005).
- 422 reservado; mensajes del `errorInterceptor`.

## Criterios de aceptación

| # | Criterio |
|---|----------|
| CA-1 | Con un plan pendiente de pago, el aviso aparece en un `ion-alert` con el mensaje del plan y el botón «Entendido»; no se muestra la lista de planes. |
| CA-2 | No queda ninguna llamada a `AlertController.create` en `src/app` fuera de specs. Todo diálogo corto es `<ion-alert>` declarativo. |
| CA-3 | Todo alert tiene `cssClass="alerta-ck"`, título corto, botones con `role` y textos tomados de `textos-alertas.ts`. |
| CA-4 | La lista de planes, los formularios, el detalle del pago, el selector de divisa y los selectores de fecha siguen siendo `ion-modal`. |
| CA-5 | Cada diálogo migrado conserva su comportamiento: mismas llamadas al confirmar, nada al cancelar. Verificado con specs. |
| CA-6 | `backdropDismiss="false"` en los destructivos y en los que piden datos (rechazar pago, eliminar cuenta, contraseña de bloqueo). |
| CA-7 | `ng lint`, `ng build` y `ng test` sin fallos nuevos respecto a los 3 preexistentes conocidos. |
| CA-8 | Revisión manual en un dispositivo/navegador: modo claro y oscuro, teclado abierto con campos, textos sin cortes. |

## Riesgos y decisiones por confirmar

| # | Tema | Recomendación |
|---|------|---------------|
| R-1 | Los alerts con campos validan al pulsar el botón (`handler` devolviendo `false` los mantiene abiertos). Con declarativo la validación va en `(didDismiss)`, que cierra siempre. | Para crear/editar cuenta y editar divisor, usar `ion-alert` con `handler` que valide y devuelva `false` si hay error; si la validación es compleja, dejar esa captura en `ion-modal`. |
| R-2 | Varias alertas de un mismo componente (cuentas: 4) | Un único `ion-alert` con `header`, `message`, `inputs` y `buttons` en signals, abierto por una acción tipada; evita 4 elementos en el DOM. |
| R-3 | Componentes presentacionales no pueden inyectar | El alert declarativo vive en la página orquestadora; el presentacional emite el evento. |
| R-4 | Tono y textos | Revisar el listado de textos antes de implementar (DN-01). |

**DN-01** (a cerrar con el usuario): aprobar el título y el mensaje de cada alerta del inventario.

## Planificación sugerida (HLT a crear al aprobar)

1. HLT-31 · Base común: `textos-alertas.ts`, estilo global `alerta-ck`, patrón documentado en el `CLAUDE.md` de la app.
2. HLT-32 · Avisos de plan: `aviso-bloqueo` (pendiente → alert; lista de planes → modal), `modal-actualiza-plan`, alerta de conflicto.
3. HLT-33 · Confirmaciones simples (cancelar plan, confirmar plan, cerrar sesiones, omitir PIN, olvidé PIN, nueva versión, datos de pago, aprobar pago).
4. HLT-34 · Alerts con campos (rechazar pago, cuentas, operativa-kelly, bloqueo).
5. HLT-35 · Revisión de los 2 modales por código y cierre (lint, build, test, prueba manual).
