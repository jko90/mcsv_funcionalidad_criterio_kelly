# HU-005 · Subida del comprobante, validación por el administrador y límites de cada plan en las pantallas

| Campo | Valor |
|-------|-------|
| ID | HU-005 |
| Fecha | 2026-11-12 (rev. 3: reutiliza las columnas existentes de la base, guarda el motivo de rechazo en `spsu_historialsuscri`, aplica límites del Libre a las cuentas antiguas sin plan y fusiona con los HLT de HU-004 para no escribir dos veces el mismo código) |
| Estado | Por planificar. **DN-01 a DN-08 cerradas por el usuario el 2026-11-12** (todas con la recomendación); la matriz propuesta es la definitiva. |
| Prioridad | Alta (cierra el riesgo Alta R-01 de HU-004: hoy el control del plan solo existe en la app) |
| Proyectos | `rest_suscripcion` (subida y validación del comprobante, límites en `spsu_planes`), `rest_criteriokelly` (aplica los límites en el servidor), `criterioKellyApp` (pantalla del comprobante, ventana de administración y límites en las pantallas) |
| Origen | Petición del usuario del 2026-11-12: «crear para subir el comprobante, así como también el menú con el rol de administrador para aprobar el comprobante, además controlar los planes» en `/operativas`, `/analisis`, `/cuentas`, `/operativa-kelly` y `/mostrar-criterio-kelly`, y «un plan con acceso total por 24 horas de forma gratuita sin restricciones». **Da continuidad a HU-004 sin contradecirla.** |
| Depende de | **HU-004 ejecutada** (HLT-15 a HLT-21): plan vigente (`GET suscripcion/planVigente`), plan de prueba de 24 h, Libre de 10 días, endpoints de administrador `pagos/pendientes`, `pagos/comprobante`, confirmar y rechazar (HLT-17), y menú por estado del plan (HLT-20). |
| Siguiente paso | Ejecutar HU-004 (HLT-15-v2…HLT-21-v2, que ya incluyen el esquema, el lector, los límites y las reglas de pago de esta historia) y después HLT-24-v2…HLT-28-v2 |
| Planificación | **Vigentes (actualizado el 2026-11-13 con DT-12 ajustada, DT-15, DT-16 con su alcance y DT-17; un solo archivo por HLT; todos APROBADO), en orden de ejecución.** HU-004: `HLT-15-2026-11-11-esquema-plan-prueba-v2.md` (esquema y límites de HU-005; COMPLETADO; sin cambios de esquema por DT-15/16/17) · `HLT-16-2026-11-11-concesion-plan-vigente-api-v4.md` (LectorPlanVigente con cadena de pasos, `limites`, renovación con plazo de 30 días, anulación con Libre nuevo, activación del periodo programado) · `HLT-17-2026-11-11-pagos-validacion-fecha-corte-v4.md` (pagos: primer corte conserva las fechas de la subida, pago anticipado programa el periodo siguiente, plazo de la renovación, 409 comprobante antiguo, motivo, comprobante obligatorio, `miUltimoPago`) · `HLT-18-2026-11-11-cancelacion-plan-pago.md` · `HLT-19-2026-11-11-app-concesion-aviso-plan-pendiente-v2.md` · `HLT-20-2026-11-11-app-menu-por-plan-guarda-cancelar-v2.md` · `HLT-21-2026-11-11-no-regresion-cierre-v2.md`. HU-005: `HLT-24-2026-11-12-limites-servidor-criteriokelly-v2.md` · `HLT-25-2026-11-12-app-subida-comprobante-v2.md` · `HLT-26-2026-11-12-app-validacion-pagos-admin-v2.md` · `HLT-27-2026-11-12-app-limites-por-pantalla-v2.md` · `HLT-28-2026-11-12-no-regresion-cierre-hu005-v2.md` (puerta «PRUEBA MANUAL HU-005 OK»). Carpeta `docs/Planificacion/`. HLT-22 y HLT-23 eliminados (absorbidos por HLT-15-v2, HLT-16-v4 y HLT-17-v4). |
| Agentes de implementación | `desarrollador-php` y `desarrollador-ionic` |

## Historia

**Como** persona que eligió un plan de pago,
**quiero** subir desde la app el comprobante de mi pago y ver en qué estado está (en revisión, rechazado o confirmado),
**para** que el administrador lo valide y mi plan entre en vigencia.

**Como** administrador (rol Super Administrador o Administrador),
**quiero** una opción de menú que solo vea yo, donde listar los pagos en revisión, ver cada comprobante y aprobarlo o rechazarlo,
**para** activar los planes pagados sin usar `curl`.

**Como** responsable del producto,
**quiero** que cada plan limite lo que se puede ver y hacer en las pantallas de operativas, análisis, cuentas, divisor de Kelly y criterio de Kelly, y que el servidor lo haga cumplir,
**para** que los planes superiores tengan valor y nadie obtenga sus funciones llamando a las APIs directamente.

## Continuidad con HU-004 (lo que esta historia no cambia)

| Regla de HU-004 | En HU-005 |
|-----------------|-----------|
| Plan **Prueba** (id 5), 24 h desde el primer inicio de sesión, con los **límites del Enterprise** | Es el «plan con acceso total por 24 horas gratis y sin restricciones» que pide el usuario: **ya existe en HU-004, no se crea otro**. Aquí solo se garantiza que la prueba aplica la columna Enterprise de la matriz de límites. |
| Prueba → **Libre de 10 días** → sin plan vigente (DT-01, DT-10) | Sin cambios. El Libre aplica la columna Libre de la matriz. |
| Un plan de pago entra en vigencia cuando el **administrador valida el comprobante**; al validarlo se actualiza la fecha de corte (DT-11, P-03) | Sin cambios. Esta historia añade la **pantalla** para subirlo y la **ventana** para validarlo, que HU-004 dejó fuera de alcance; usa los endpoints de HLT-17, no crea otros para confirmar o rechazar. |
| Corte al terminar el periodo; cancelación con efecto al final del periodo (DT-12, DT-13) | Sin cambios. |
| Menú por estado del plan (tabla de 6 estados, DT-14) y guarda de rutas (F-06, F-07) | Sin cambios. Los límites de esta historia actúan **dentro** de las pantallas que el estado ya habilita. En los estados 3, 4 y 6 solo abre **Mostrar criterio Kelly**, que aplica los límites del Libre (DN-07). |
| Configuración de permisos en un solo lugar (`permisos-plan.config.ts`, F-10) | Se amplía ese mismo archivo con los límites por pantalla; no se reparten por las páginas. |
| 422 reservado para el límite de pérdida (D-04) | Sin cambios; los límites de plan usan otro código (DN-06). |
| Un administrador **nunca** confirma ni rechaza su propio pago (HLT-17) | Sin cambios; la ventana ni siquiera muestra los botones en los pagos propios (`esPropio`). |

## Análisis de la situación actual (verificado el 2026-11-12)

| # | Hecho | Dónde |
|---|-------|-------|
| S-1 | `crearConPago` ya acepta `comprobante` (imagen `data:image/…;base64`, máximo 512 KB, jpeg/png/gif/webp, validada en `BaseCtrl`) y deja el pago en revisión (`R`). **No existe ninguna pantalla en la app que lo llame.** 0 de los 14 pagos de la base tienen imagen. | `rest_suscripcion/README.md:154`, `BaseCtrl.php` (`TAMANO_MAXIMO_IMAGEN_BYTES`) |
| S-2 | La app ya tiene un servicio de imágenes (`compartidos/servicios/manejo-imagenes.service.ts`), usado en la bitácora. | app |
| S-3 | El menú lateral es una lista fija en `assets/datos/menu.json`; no hay ninguna opción por rol. | app |
| S-4 | Roles: 1 Super Administrador, 2 Administrador, 3 Suscriptor, 4 Visitante. El servidor lee los roles de la base de datos en cada petición (`ContextoSesion`, HU-001). | `sgen_*` |
| S-5 | `/operativas` y `/analisis` piden **todas** las operaciones sin filtro: `criterioKelly/detalleOperacion` y `criterioKelly/operacionAnalisis` se llaman con cuerpo `{}`. Cualquier límite por días o por cantidad tiene que aplicarse en el servidor; filtrar solo en la app no protege nada. | `reportes/servicios/reportes.service.ts:20,27` |
| S-6 | `/cuentas` crea con `cuentas/nueva`; hoy no hay tope de cuentas. | `configuracion/servicios/cuentas.service.ts:23`, `CuentasRts.php:96` |
| S-7 | El divisor de Kelly lo manda el cliente (`cke_numDivisor`) y el servidor solo pone 10 por defecto si no viene. | `ReglasKellyCtrl.php:53-57` |
| S-8 | `rest_criteriokelly` no consulta ninguna tabla `spsu_*`: hoy no sabe qué plan tiene el usuario. Las tres bases comparten la misma base de datos `sist_criteriokelly`. | `rest_criteriokelly/modelos/` |
| S-9 | Botones de las pantallas: `/operativas` → «Exportar a PDF» (`exportarAPDF`) y «Graficar operaciones» (`graficarOperacion`); `/analisis` → **no tiene filtro de fechas** (`abrirModal` es el botón «Ver más» del modal de mejora; el filtro se crea en HLT-27), «Exportar a Excel» (`exportarAExcel`) y el listado de operaciones; `/cuentas` → «Crear cuenta» (`crearCuentaBtn`), PDF, capital, editar, eliminar; `/operativa-kelly` → modal del divisor por cuenta (`abrirModalCuenta`); `/mostrar-criterio-kelly` → selector de cuenta y campo «número de operaciones». | páginas de la app |
| S-10 | Los límites guardados hoy en `spsu_planes` no coinciden con los que pide el usuario (ver DN-01). | tabla siguiente |

Valores actuales de `spsu_planes`:

| Plan | numCuentas | diasHistorial | diasTotales | bloqueoDias | puedeDescargar | descargaTodos | rangoLibre |
|------|-----------|---------------|-------------|-------------|----------------|---------------|------------|
| 1 Libre | 1 | 10 | 10 | 10 | 0 | 0 | 0 |
| 2 Básico | 3 | 15 | 45 | 15 | 1 | 0 | 0 |
| 3 Premium | 6 | 30 | 90 | 30 | 1 | 0 | 0 |
| 4 Enterprise | 100 | 30 | 365 | 30 | 1 | 1 | 1 |
| 5 Prueba (HU-004) | igual que Enterprise | | | | | | |

## Propuesta

### 1. Subida del comprobante (persona)

- Desde la **pantalla de planes**, en el plan pendiente de pago (F-08 de HU-004), aparece «Subir comprobante». Abre un formulario con: método de pago, número de transacción (`idTransaccion`), correo o criptomoneda si el método lo pide, y la **imagen del comprobante** (cámara o galería, con el servicio de imágenes existente).
- La app reduce la imagen antes de enviarla y avisa si sigue pasando de 512 KB. El servidor vuelve a validar tipo y tamaño (no cambia la validación de `BaseCtrl`).
- Se envía con `crearConPago` sobre la suscripción pendiente (`sis_idSuscrip`). El monto y los meses los toma el servidor del catálogo; la app no los manda como verdad.
- Estados que ve la persona: **sin comprobante** → **en revisión** → **confirmado** (el plan pasa a vigente con su fecha de corte) o **rechazado** (con el motivo, si el administrador lo escribió; puede subir otro comprobante con otro número de transacción).
- Solo puede haber **un pago en revisión** por suscripción a la vez.

### 2. Ventana de administración

- Opción de menú **«Validar pagos»**, visible solo para roles 1 y 2. La app la muestra según los roles que devuelve el servidor, y la ruta tiene un guarda por rol; aun así, **la autorización real es la del servidor** (401/403 de HLT-17).
- Listado de pagos en revisión (`pagos/pendientes`, paginado): usuario, plan, intervalo, monto, método, número de transacción, fecha y si tiene comprobante. La **cédula y el correo no se muestran completos**.
- Al abrir un pago se pide su comprobante (`pagos/comprobante`) y se muestra la imagen ampliable.
- Botones **Aprobar** y **Rechazar** con confirmación; rechazar pide un motivo (DN-05), que se guarda en la tabla de historial que ya existe (`spsu_historialsuscri`: `his_accion = 'PAGO_RECHAZADO'`, el motivo en `his_detalle`). No se añade ninguna columna a `spsu_pagos`. En los pagos propios (`esPropio`) no aparecen los botones.
- Tras aprobar o rechazar, el pago desaparece del listado. Un 409 (ya procesado por otro administrador) se informa y se refresca la lista.

### 3. Límites por plan en las pantallas

**Fuente única de los límites:** las columnas de `spsu_planes`, devueltas por `planVigente`. La app las usa para mostrar avisos; el servidor las usa para recortar o rechazar. Ningún número queda escrito en el código.

**La base de datos ya está diseñada: se reutilizan sus columnas** (decisión del usuario del 2026-11-12) y solo se añaden las tres que no tienen equivalente:

| Límite de la matriz | Columna | Libre | Básico | Premium | Enterprise / Prueba |
|---------------------|---------|-------|--------|---------|---------------------|
| Cuentas | `pla_numCuentas` (existe) | 1 | 1 | 5 | 10 |
| `/operativas`: días de reporte | `pla_diasHistorial` (existe, «días hacia atrás») | 8 | 15 | 30 | 365 |
| `/analisis`: rango del filtro y máximo de operaciones | `pla_bloqueoDias` (existe, «días por bloque de consulta») | 5 | 5 | 30 | 30, sin tope por `pla_rangoLibre = 1` |
| `/analisis`: rango libre | `pla_rangoLibre` (existe) | 0 | 0 | 0 | 1 |
| Ventana total del análisis | `pla_diasTotales` (existe, sin cambios) | 10 | 45 | 90 | 365 |
| Exportar PDF / Excel | `pla_puedeDescargar` (existe, sin cambios) | 0 | 1 | 1 | 1 |
| «Graficar operaciones» | `pla_puedeGraficar` (**nueva**) | 0 | 0 | 1 | 1 |
| Cambiar el divisor | `pla_divisorEditable` (**nueva**) | 0 | 0 | 1 | 1 |
| Operaciones diarias del criterio de Kelly | `pla_maxOperacionesDiarias` (**nueva**, `NULL` = sin límite) | 1 | 1 | 5 | `NULL` |

El «sin límite» de Enterprise en los reportes queda en **365 días**, que es el historial total que la base ya define (`pla_diasTotales`). Los nuevos valores y las tres columnas van en el **mismo script de esquema de HU-004** (una sola confirmación).

**Matriz definitiva** (DN-01 cerrada: los valores en **negrita** los dio el usuario y el resto los aceptó el 2026-11-12):

| Pantalla · límite | Libre | Básico | Premium | Enterprise y Prueba 24 h |
|-------------------|-------|--------|---------|--------------------------|
| `/operativas` · días de reporte hacia atrás | **8** | 15 | 30 | sin límite |
| `/operativas` · «Graficar operaciones» | no | **no: «Actualiza su plan para poder visualizar»** | sí | sí |
| `/operativas` · «Exportar a PDF» | no | sí | sí | sí |
| `/analisis` · rango máximo del filtro de fechas | **5 días** | **5 días** | 30 días | libre |
| `/analisis` · operaciones del listado | 5 | **5** | 30 | sin límite |
| `/analisis` · «Exportar a Excel» | no | sí | sí | sí |
| `/cuentas` · cuentas que puede tener | 1 | **1** | 5 | **10** |
| `/operativa-kelly` · cambiar el divisor | no (fijo en 10) | **no (fijo en 10)** | sí | sí |
| `/mostrar-criterio-kelly` · operaciones diarias | 1 | **1** | 5 | sin límite |

Comportamiento común:

- Una función **no incluida** sigue visible; al tocarla muestra «Actualiza su plan para poder visualizar» con un botón a la pantalla de planes (mismo estilo que los avisos de HU-004).
- Un límite **por cantidad o por días** recorta lo que se muestra y lo dice: «Tu plan muestra los últimos 8 días. Actualiza tu plan para ver más».
- Al alcanzar el **tope de cuentas**, «Crear cuenta» muestra «Tu plan permite N cuentas». Si la persona baja de plan y ya tiene más cuentas que su nuevo tope, **no se borra nada**: conserva todas, pero no puede crear nuevas (DN-08).
- Con el **divisor fijo**, el modal del divisor muestra 10 sin poder editarlo; el servidor ignora cualquier `cke_numDivisor` distinto y calcula con 10.

### 4. Aplicación en el servidor

- `rest_criteriokelly` necesita conocer el plan vigente. El cálculo del plan vigente de HU-004 se escribe **desde el principio** como un lector de solo lectura (`LectorPlanVigente`) que usa el servicio que aplica las transiciones en `rest_suscripcion`; `rest_criteriokelly` lleva una **copia idéntica** de ese lector (verificada con `sha256`, como `RegistroAuditoria`). Así la regla existe una sola vez y no se duplica la lógica. No se llama por HTTP de un backend a otro.
- **Cuentas antiguas sin ningún plan** (anteriores a HU-004): se tratan como **sin plan vigente**, con los límites del Libre y el aviso para activar un plan (decisión del usuario del 2026-11-12). No reciben la prueba (DT-02 de HU-004).
- Puntos de control:
  - `cuentas/nueva`: rechaza si el usuario ya tiene el máximo de cuentas activas de su plan.
  - `criterioKelly/detalleOperacion` y `operacionAnalisis`: devuelven solo el rango y la cantidad que permite el plan, y aceptan un rango de fechas que el servidor recorta al máximo del plan.
  - `bitacora/finalizaBitacora` (donde entra `cke_numDivisor`): si el plan no permite cambiar el divisor, se usa 10 aunque el cliente mande otro.
  - Exportar PDF/Excel y graficar se hacen en la app con datos que ya llegaron recortados; su bloqueo es de la app y no da acceso a más datos de los que el plan permite.
  - `mostrar-criterio-kelly` (DN-03): el «número de operaciones» es un cálculo local de la app, sin llamada al servidor, así que el máximo de 1 se aplica **solo en la app**.
- Sin plan vigente (estados 3, 4 y 6 de HU-004) solo se aceptan las llamadas de **Mostrar criterio Kelly**, con los límites del Libre (DN-07); el resto responde con el código de DN-06.

## Criterios de aceptación

### A. Datos

- **A-01** El script de esquema de HU-004 (uno solo, idempotente y con reversión) añade a `spsu_planes` **solo** `pla_puedeGraficar`, `pla_divisorEditable` y `pla_maxOperacionesDiarias`, y actualiza las columnas existentes con los valores de la tabla de «Fuente única». No añade columnas a `spsu_pagos`. Se ejecuta dos veces sin error y no edita los volcados de instalación.
- **A-02** La Prueba (id 5) tiene los mismos límites que Enterprise (sin límite en todo); cambiar Enterprise en el futuro debe reflejarse en la Prueba (o el HLT documenta por qué se copian).
- **A-03** El catálogo que devuelve `planes/disponible` incluye los límites para que la pantalla de planes los muestre al comparar.

### B. Comprobante (persona)

- **B-01** La persona con un plan pendiente sube método, número de transacción e imagen; queda un pago en revisión asociado a su suscripción pendiente.
- **B-02** Imagen de más de 512 KB o de otro tipo: la app avisa antes de enviar y el servidor responde 400 si llega igual.
- **B-03** No puede subir un comprobante para una suscripción ajena (403 uniforme), para un plan gratuito (400) ni con un número de transacción repetido (409). Son las comprobaciones de `crearConPago` (RN-16, RN-17 de HLT-17), sin cambiarlas.
- **B-04** Con un pago ya en revisión no puede subir otro sobre la misma suscripción (409) hasta que se resuelva.
- **B-05** La app muestra el estado del pago: en revisión, rechazado con su motivo y opción de subir otro, o confirmado con el plan vigente y su fecha de corte.

### C. Ventana de administración

- **C-01** «Validar pagos» aparece en el menú solo para roles 1 y 2; un suscriptor que escribe la ruta es redirigido, y si llama al endpoint recibe 403.
- **C-02** El listado muestra los pagos en revisión, paginado, sin la imagen dentro del listado y con los datos personales enmascarados.
- **C-03** Al abrir un pago se ve su comprobante; si no tiene, se indica «sin comprobante» y no se puede aprobar (DN-05).
- **C-04** Aprobar activa el plan con la fecha de corte de HU-004 (P-03) y el pago sale del listado; la persona lo ve en su siguiente refresco del plan vigente.
- **C-05** Rechazar pide un motivo, deja el pago rechazado y la suscripción sigue pendiente para un comprobante nuevo.
- **C-06** En un pago propio no hay botones, y el servidor lo rechaza igualmente (403).
- **C-07** Si dos administradores actúan sobre el mismo pago, el segundo recibe 409, ve el aviso y la lista se refresca.

### D. Límites en las pantallas (app)

- **D-01** Cada celda de la matriz acordada se comprueba en la app con un usuario de cada plan (Libre, Básico, Premium, Enterprise y Prueba).
- **D-02** Las funciones no incluidas siguen visibles y muestran «Actualiza su plan para poder visualizar» con acceso a la pantalla de planes.
- **D-03** Los recortes por días o por cantidad muestran un aviso con el límite del plan.
- **D-04** Los límites se leen del plan vigente que devuelve el servidor y están en `permisos-plan.config.ts` (F-10 de HU-004); ningún componente presentacional decide permisos.
- **D-05** Al cambiar de plan (prueba → Libre, Libre → pago, corte), las pantallas aplican los límites nuevos en el siguiente refresco, sin cerrar sesión.

### E. Límites en el servidor

- **E-01** `cuentas/nueva` por encima del tope responde con el código de DN-06 y un mensaje en español; no se crea la cuenta.
- **E-02** `detalleOperacion` y `operacionAnalisis` nunca devuelven más días ni más operaciones que los del plan, aunque el cliente pida más.
- **E-03** Con el divisor fijo, `finalizaBitacora` con `cke_numDivisor` distinto de 10 guarda y calcula igual que con 10.
- **E-04** Sin plan vigente (incluidas las cuentas antiguas que nunca tuvieron plan) solo responden las llamadas de Mostrar criterio Kelly.
- **E-05** El plan se lee de la base con la sesión del token; ningún dato de plan o límite se acepta del cliente.
- **E-06** La copia del lector de plan vigente en `rest_criteriokelly` es idéntica a la de `rest_suscripcion` (`sha256`) y da el mismo plan para los mismos fixtures.
- **E-07** El 422 sigue reservado al límite de pérdida y el formato de error sigue siendo `{ "error": "..." }`.
- **E-08** Auditoría de `LIMITE_PLAN_RECHAZADO` (usuario, recurso, plan) sin datos sensibles, con límite para no llenar la tabla.

### F. No regresión

- **F-01** Los criterios de HU-004 siguen cumpliéndose; se repiten sus baterías.
- **F-02** Un usuario Enterprise o en Prueba ve exactamente lo mismo que hoy en todas las pantallas.
- **F-03** Los datos existentes no se borran ni se modifican al aplicar topes (cuentas de más, operaciones antiguas).
- **F-04** `ng lint`, `ng test`, `ng build` y `php -l` sin errores.

## Decisiones (todas CERRADAS por el usuario el 2026-11-12 con la recomendación)

| ID | Pregunta | Decisión |
|----|----------|---------------|
| **DN-01** | Los números pedidos no coinciden con `spsu_planes` y faltan los de algunos planes. Libre en `/operativas`: 8 días (la BD dice 10). Básico: 1 cuenta (la BD dice 3) y 5 días o 5 operaciones (la BD dice 15 días). Enterprise: 10 cuentas (la BD dice 100). Premium no tiene ningún valor. ¿Confirmas la matriz propuesta? | Actualizar `spsu_planes` con los números del usuario y completar Premium como en la matriz. La pantalla de planes mostrará los valores nuevos. |
| **DN-02** | En `/operativas`, ¿qué botón muestra «Actualiza su plan para poder visualizar» al Básico: «Graficar operaciones» o «Exportar a PDF»? ¿Y qué ve el Libre en ese botón? | «Graficar operaciones» bloqueado para Libre y Básico; PDF solo bloqueado en Libre (`pla_puedeDescargar = 0`, como ya dice la BD). |
| **DN-03** | En `/mostrar-criterio-kelly`, «las operativas diarias permita para 1»: ¿significa 1 cálculo por día, que el campo «número de operaciones» admite como máximo 1, o 1 operación abierta por día en la bitácora? ¿Para qué planes? | Que el campo «número de operaciones» admita como máximo 1 en Libre y Básico, y el servidor lo recorte. Es lo que menos afecta al registro de operaciones. |
| **DN-04** | En `/analisis`, ¿el límite del Básico es **5 días o 5 operaciones** (lo que llegue primero), o elige uno? ¿El Libre tiene el mismo límite que el Básico? | Rango de 5 días y como máximo 5 operaciones para los dos; diferenciarlos por la exportación a Excel. |
| **DN-05** | ¿El rechazo exige un motivo visible para la persona? ¿Se puede aprobar un pago sin imagen (p. ej. transferencia verificada por otro medio)? | Motivo obligatorio y visible; no aprobar sin comprobante. |
| **DN-06** | Código HTTP para «tu plan no lo permite». El 422 está reservado y el 403 la app lo muestra como «Acceso denegado». | **403 con mensaje propio** («Tu plan no incluye esta función. Actualiza tu plan»): el interceptor ya prefiere el mensaje del servidor, así que no hace falta otro código. |
| **DN-07** | Sin plan vigente (estados 3, 4 y 6 de HU-004), Mostrar criterio Kelly ¿con qué límites? | Con los del Libre (1 cuenta, 1 operación diaria, divisor 10). |
| **DN-08** | Si una persona baja de plan y tiene más cuentas que su nuevo tope, ¿qué pasa con las de más? | Se conservan y se pueden consultar, pero no se crean nuevas hasta quedar por debajo del tope. |

## Ampliación: datos de pago administrables (2026-11-14)

Petición del usuario: los datos para pagar (redes USDT con dirección, PayPal, número de WhatsApp de la transferencia bancaria) deben guardarse en la base de datos y administrarse desde la interfaz, con **código QR** para criptomonedas, sin perder el recorrido actual y retirando del front lo que pase al backend. No cambia ningún criterio A a F anterior. Planificación:

- **Aclaración (datos bancarios):** los datos de transferencia bancaria (titular, documento, banco, tipo y número de cuenta, país/moneda, observaciones) también se registran y administran, pero **se mostrarán al cliente más adelante**; por ahora el flujo de banco solo envía el mensaje de WhatsApp (número y plantilla) y `datosPago/disponibles` no devuelve los datos de la cuenta.
- `HLT-29-2026-11-14-datos-pago-backend-bd-v1.md`: tablas `spsu_metodopago`, `spsu_redusdt` y `spsu_qrpago`, script de actualización entregado al usuario, endpoints `datosPago/*` (lectura para sesiones y administración solo roles 1 y 2) y auditoría.
- `HLT-30-2026-11-14-datos-pago-app-admin-usuario-v1.md`: pantalla de administración, QR en el flujo del usuario y eliminación de `datos-pago.config.ts` y `DATOS_PAGO_TOKEN` del front. Depende de HLT-29-v1.

## Fuera de alcance

- Pasarelas de pago, cobros automáticos y facturación (el pago se hace fuera de la app y se demuestra con el comprobante).
- Renovación automática y recordatorios (igual que en HU-004).
- Gestión de usuarios y roles desde la ventana de administración (solo pagos).
- Notificaciones por correo o push al aprobar o rechazar (posible historia posterior; usaría el módulo `correo/` de HU-003).
- Revertir un pago aprobado o rechazado desde la app (P-06 de HU-004).
- `rest_divisas` y la lista estática de divisas.

## Definición de terminado

- [ ] DN-01 a DN-08 cerradas por el usuario.
- [ ] HLT **APROBADO** por el `planificador`.
- [ ] Criterios A a F verificados con evidencia real: `curl` por plan y por rol, `php -l`, `ng lint`, `ng test`, `ng build` y las baterías de no regresión de HU-004.
- [ ] Prueba manual: elegir un plan → subir el comprobante → aprobarlo con otra cuenta administradora → el plan aparece vigente; rechazo y nueva subida; un recorrido por las cinco pantallas con cada plan.
- [ ] READMEs de `rest_suscripcion`, `rest_criteriokelly` y la app, `CLAUDE.md` y los agentes actualizados.

## Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Límites solo en la app: quien llama a las APIs obtiene más datos (R-01 de HU-004) | Alta | Criterios E: el servidor recorta y rechaza; pruebas con `curl` por plan |
| La copia del lector de plan vigente en `rest_criteriokelly` se desincroniza de la de `rest_suscripcion` | Media | Copia idéntica verificada con `sha256`, fixtures comunes (E-06) |
| Comprobantes de 512 KB en base64 cargan la base y la red | Media | La app reduce la imagen; el listado no incluye imágenes; se piden de una en una |
| Un comprobante falso aprobado por error | Media | Validación humana con número de transacción; auditoría de cada aprobación; no se aprueba sin imagen (DN-05) |
| Un administrador aprueba su propio pago | Alta | Bloqueado en el servidor (HLT-17) y sin botones en la app (C-06) |
| Bajar de plan deja a la persona con más cuentas o historial del permitido | Baja | No se borra nada (F-03, DN-08) |
| Cambiar los números de `spsu_planes` altera lo que ven los suscriptores actuales | Media | Script con reversión; los valores los confirma el usuario (DN-01) |
