# HU-004 · Plan de prueba de 24 horas, plan Libre de 10 días y mejora a un plan de pago

| Campo | Valor |
|-------|-------|
| ID | HU-004 |
| Fecha | 2026-11-11 (rev. 5) |
| Estado | Por planificar. Todas las decisiones de negocio están cerradas (DT-01 y DT-10 a DT-14); lista para el `planificador`. La rev. 5 incorpora las reglas aclaradas por el usuario el 2026-11-11: vigencia por periodo, comprobante validado por el administrador y menú por estado del plan (el menú mínimo llega cuando termina el Libre, no durante él). |
| Prioridad | Media |
| Proyectos | `rest_suscripcion` (esquema, lógica y API), `criterioKellyApp` (primer inicio de sesión y aviso del tiempo restante) |
| Origen | Archivo del usuario «hu-004 Historia de usuario para controlar la App segun el plan.txt»: el plan nuevo se pide para darlo a cada cuenta nueva y la caducidad debe resolverse **en el código**, porque la base de datos no puede ejecutar tareas programadas |
| Depende de | HU-001 y HU-003 cerradas (el primer inicio de sesión y la reserva del plan ya funcionan). **Continúa en HU-005** (subida del comprobante, ventana de administración y límites de cada plan en pantallas y servidor) |
| Siguiente paso | Ejecutar los HLT vigentes en orden (empezando por HLT-15-v2) |
| Planificación | **Vigentes (actualizado el 2026-11-13 con DT-12 ajustada, DT-15, DT-16 con su alcance y DT-17; un solo archivo por HLT; todos APROBADO), en orden de ejecución.** HU-004: `HLT-15-2026-11-11-esquema-plan-prueba-v2.md` (esquema y límites de HU-005; COMPLETADO; sin cambios de esquema por DT-15/16/17) · `HLT-16-2026-11-11-concesion-plan-vigente-api-v4.md` (LectorPlanVigente con cadena de pasos, `limites`, renovación con plazo de 30 días, anulación con Libre nuevo, activación del periodo programado) · `HLT-17-2026-11-11-pagos-validacion-fecha-corte-v4.md` (pagos: primer corte conserva las fechas de la subida, pago anticipado programa el periodo siguiente, plazo de la renovación, 409 comprobante antiguo, motivo, comprobante obligatorio, `miUltimoPago`) · `HLT-18-2026-11-11-cancelacion-plan-pago.md` · `HLT-19-2026-11-11-app-concesion-aviso-plan-pendiente-v2.md` · `HLT-20-2026-11-11-app-menu-por-plan-guarda-cancelar-v2.md` · `HLT-21-2026-11-11-no-regresion-cierre-v2.md`. HU-005: `HLT-24-2026-11-12-limites-servidor-criteriokelly-v2.md` · `HLT-25-2026-11-12-app-subida-comprobante-v2.md` · `HLT-26-2026-11-12-app-validacion-pagos-admin-v2.md` · `HLT-27-2026-11-12-app-limites-por-pantalla-v2.md` · `HLT-28-2026-11-12-no-regresion-cierre-hu005-v2.md` (puerta «PRUEBA MANUAL HU-005 OK»). Carpeta `docs/Planificacion/`. HLT-22 y HLT-23 eliminados (absorbidos por HLT-15-v2, HLT-16-v4 y HLT-17-v4). |
| Agentes de implementación | `desarrollador-php` (esquema, API) y `desarrollador-ionic` (aviso en la app) |

## Historia

**Como** persona que acaba de crear su cuenta en Criterio Kelly,
**quiero** disfrutar de acceso completo a todas las funciones durante 24 horas desde mi primer inicio de sesión y pasar después, sin hacer nada, al plan Libre, que dura 10 días y tiene la funcionalidad mínima,
**para** probar la aplicación en toda su extensión antes de decidir si pago un plan superior.

**Como** persona que elige un plan de pago al crear mi cuenta,
**quiero** ver que tengo un plan pendiente de pago y que entre en vigencia cuando el administrador valide el comprobante que subí,
**para** saber en qué estado está mi plan y empezar a usarlo en cuanto se confirme.

**Como** persona que ya agotó la prueba y el plan Libre sin tener un plan de pago vigente,
**quiero** que la aplicación me avise de que debo activar un plan, me muestre los planes disponibles para elegir y siga permitiéndome usar el criterio de Kelly,
**para** decidir qué plan contratar sin perder el acceso a lo básico.

**Como** responsable del producto,
**quiero** que la prueba se conceda una sola vez por cuenta, que no se pueda reclamar ni alargar desde el cliente y que su caducidad se aplique desde el código del servidor,
**para** que el plan de prueba no se convierta en acceso gratuito permanente ni dependa de un proceso programado en la base de datos.

## Análisis de la situación actual (verificado el 2026-11-11)

| # | Hallazgo | Evidencia |
|---|----------|-----------|
| A-1 | Hay **4 planes** (Libre, Básico, Premium, Enterprise) con 16 combinaciones plan × intervalo. Los intervalos son **en meses** (`ins_numMeses`: 1, 3, 6, 12, 24); no existe una duración en horas. | `spsu_planes`, `spsu_planintervalo`, `spsu_intervalosuscr` |
| A-2 | Las fechas de la suscripción son de tipo **`date`** (`sus_fechainicio`, `sus_fechaFin`): no guardan la hora. Una duración de 24 horas exacta no cabe en ellas. | `sist_suscripcion.sql:125-126` |
| A-3 | **Ningún código escribe la situación `A` (activa) ni `E` (expirada).** Todo lo que crea el backend queda en `P` (pendiente); la única `A` de la base se insertó a mano. Tampoco hay un proceso que apruebe los pagos en revisión (`R`). | `grep` de `sus_situacion` en `rest_suscripcion`; base local: 1 `A` y 22 `P` |
| A-4 | Los límites de cada plan (`pla_numCuentas`, `pla_diasHistorial`, `pla_puedeDescargar`, `pla_descargaTodos`, `pla_rangoLibre`…) **no se aplican en ningún sitio**: solo se leen para mostrarlos en la pantalla de planes. | `grep` de esas columnas: solo `PlanesCtrl`, `PlanesMdl` y `Planes.modelo.ts` |
| A-5 | Hoy el primer inicio de sesión de una cuenta nueva crea una suscripción `P` con el plan reservado en el registro o, si no hay, con el Libre (`PLAN_LIBRE_ID_INTERVALO = 1`), llamando a `suscripcion/crearSinPago`. | `SuscripcionStore.asegurarSuscripcionInicial`, `login.page.ts:159` |
| A-6 | `crearSinPago` recibe **del cliente** el id del plan (`sus_pinIdPlanin`). Si el plan de prueba existiera tal cual, cualquier usuario podría pedirlo cuando quisiera. | `SuscripcionCtrl.php` |
| A-7 | `planes/disponible` es **público** y lista todas las combinaciones activas; el plan de prueba aparecería como comprable. | `PlanesMdl.php` |
| A-8 | Las horas de la auditoría ya dieron un error de zona horaria (UTC en PHP frente a la hora local de MySQL, corregido en HLT-06 v2). Una prueba de 24 horas es muy sensible a ese mismo error. | HLT-06 v2, hallazgo F-01 |
| A-9 | El hosting de producción puede ofrecer cron del servidor (requisito R-05 de HU-001), pero el usuario indica que **la base de datos no puede programarlo** y pide resolverlo en el código. | Pedido del usuario |

**Consecuencia de A-3 y A-4:** hoy "el plan de un usuario" no tiene una definición ejecutable y los planes no limitan nada. Esta historia define cómo se calcula el **plan vigente** y cómo caduca la prueba, pero para que las 24 horas de "acceso total" se noten hace falta que la app **aplique** los límites de cada plan (sección «Fuera de alcance»).

## Propuesta

### Datos: un plan nuevo y dos columnas

Se añaden, mediante un script idempotente en `rest_suscripcion/anexos/` (y no editando los volcados de instalación existentes):

**1. Dos columnas en `spsu_planes`**, para que la duración y el plan siguiente sean datos y no reglas escritas en el código:

| Columna | Tipo | Significado |
|---------|------|-------------|
| `pla_horasDuracion` | `int(11) NULL` | Horas que dura el plan. `NULL` en los planes normales; `24` en el de prueba |
| `pla_planSiguienteId` | `int(11) NULL` | Plan al que pasa la cuenta cuando termina. `NULL` en los planes de pago; el Libre (1) en el de prueba |

Valores resultantes de la cadena de planes (cerrada por el usuario, DT-01):

| Plan | `pla_horasDuracion` | `pla_planSiguienteId` | Qué pasa al terminar |
|------|---------------------|-----------------------|----------------------|
| 5 · Prueba | 24 | 1 (Libre) | Pasa al plan Libre |
| 1 · Libre | **240** (10 días) | `NULL` | La cuenta queda **sin plan vigente** hasta que pague (DT-10) |
| 2, 3 y 4 · de pago | `NULL` | `NULL` | Siguen la duración del intervalo contratado, en meses |

El script también actualiza el plan Libre existente (`UPDATE spsu_planes SET pla_horasDuracion = 240 WHERE pla_idPlan = 1`). **Los valores de los límites de cada plan (cuentas, días, descargas…) no se definen aquí: los fija HU-005** (matriz definitiva), que también los aplica en las pantallas y en el servidor.

**2. Una columna en `spsu_suscripcion`:** `sus_fechaHoraFin DATETIME NULL` (en UTC), con el instante exacto en que termina una suscripción con duración en horas. Las columnas `date` existentes no se tocan; `sus_fechaFin` guarda solo el día.

**3. El plan nuevo**, con los mismos permisos que el Enterprise («acceso total»):

```sql
-- Borrador: el HLT lo fija con los valores definitivos y lo hace idempotente
INSERT INTO spsu_planes
  (pla_idPlan, pla_nombre, pla_descripcion, pla_precioBase, pla_moneda, pla_caracteris,
   pla_numCuentas, pla_diasHistorial, pla_diasTotales, pla_bloqueoDias,
   pla_puedeDescargar, pla_descargaTodos, pla_rangoLibre,
   pla_horasDuracion, pla_planSiguienteId, pla_estado)
VALUES
  (5, 'Prueba', 'Acceso completo durante 24 horas', 0.00, 'USD',
   'Acceso completo con filtros libres y descarga total durante 24 horas. Después pasa al plan Libre.',
   100, 30, 365, 30, 1, 1, 1,
   24, 1, '1');
```

**4. Un intervalo y una combinación plan × intervalo**, porque `spsu_suscripcion` apunta a `spsu_planintervalo` (clave foránea) y los intervalos están en meses (DT-05):

```sql
INSERT INTO spsu_intervalosuscr (ins_idInterSuscrip, ins_nombre, ins_numMeses, ins_x100descuen, ins_estado)
VALUES (6, 'Prueba (24 horas)', 0, 0.00, '1');
INSERT INTO spsu_planintervalo (pin_idPlanInterv, pin_plaIdPlan, pins_idInterSuscrip, pin_precioFinal, pin_estado)
VALUES (17, 5, 6, 0.00, '1');
```

El plan de prueba **no es comprable ni elegible**: ni aparece en `planes/disponible`, ni `crearSinPago` ni `crearConPago` lo aceptan.

### Regla del plan vigente

Para un usuario, el plan vigente se calcula así (siempre en el servidor, con la hora del servidor en UTC):

1. Si tiene una suscripción **de pago activa** (`A`) cuya **fecha de corte** (`sus_fechaFin`) no ha pasado, esa es la vigente. Si hay varias, la de mayor nivel de plan. **Un plan de pago activo siempre prevalece sobre la prueba y sobre el Libre.**
2. Si no, si tiene una **prueba en curso** (`A` con `sus_fechaHoraFin` futura), esa es la vigente.
3. Si la prueba **terminó**, se marca `E` y se crea la suscripción del **plan Libre de 10 días** (desde ese instante), que pasa a ser la vigente.
4. Si el **plan Libre de 10 días terminó**, se marca `E` y la cuenta queda **sin plan vigente** (DT-10).
5. Un plan de pago **pendiente** (`P`, con su comprobante en revisión) **no es vigente**: la cuenta usa la prueba o el Libre mientras el administrador valida el pago, y la app muestra que tiene un plan pendiente de pago.
6. **Un plan de pago se corta al terminar su periodo** (DT-12): llegada la fecha de corte pasa a `E` y la cuenta queda sin plan vigente. No vuelve a la prueba. Si tenía renovación automática se crea la renovación pendiente de pago y la persona dispone de **30 días** para pagarla (DT-15 y DT-17); si no la paga en ese plazo (**segundo corte consecutivo sin pago**), la renovación se anula y la cuenta pasa a un **plan Libre de 10 días** (DT-17), después del cual queda sin plan vigente (DT-10).

### Elección del plan al crear la cuenta

- Si la persona elige un **plan de pago** al registrarse (o después, desde la pantalla de planes), la suscripción queda **pendiente de pago** (`P`) hasta que suba el comprobante y el administrador lo valide (DT-07, DT-11). Mientras tanto **recibe igualmente la prueba de 24 horas y el plan Libre de 10 días**.
- Si elige el **Libre** o no elige nada, sigue la cadena establecida: prueba de 24 horas → Libre de 10 días.
- Al elegir un plan de pago, la app **muestra que tiene un plan pendiente de pago**, con el nombre del plan y el estado «se activará cuando el administrador valide tu comprobante».

### Validación del pago y fecha de corte

Cuando el administrador **verifica y valida** el comprobante de pago que subió la persona (DT-11), el plan entra en vigencia en ese momento y se **actualiza la fecha de corte**:

- La suscripción pasa a `A`. Su inicio (`sus_fechainicio`) es el **día en que la persona subió el comprobante** (UTC, la fecha del pago; no el día en que eligió el plan ni el día de la validación) y su fecha de corte (`sus_fechaFin`) es ese día más los meses del intervalo pagado (DT-16). El plan solo vale desde que el administrador lo valida. `sus_proximoPago` y el periodo del pago (`pag_pagoDesde` y `pag_pagoHasta`) se recalculan con las mismas fechas.
- La suscripción de prueba o Libre en curso se marca `C` (cancelada por mejora) y queda registrada en `spsu_historialsuscri`, con el motivo. El tiempo sobrante no se suma ni se descuenta.
- Una cuenta cuyo plan de pago se cortó **no vuelve a la prueba**. Al **segundo corte consecutivo sin pago** (30 días después del primero) pasa a un plan Libre de 10 días (DT-17).

### Cancelación por el usuario

La persona puede cancelar su plan de pago. La cancelación **no corta el plan en ese momento**: sigue vigente hasta el final del **periodo ya pagado** y después queda sin plan vigente (DT-13). No hay devolución de dinero. Se marca con `sus_renovAutomatica = 0` y la suscripción sigue en `A` hasta su fecha de corte.

### Concesión de la prueba

- Se concede **una sola vez por cuenta**, en el **primer inicio de sesión** de una cuenta activada (DT-03), sustituyendo la creación del plan Libre de A-5.
- La concesión la decide **solo el servidor**: un endpoint protegido por token, idempotente, que no recibe el plan ni la duración. Si la cuenta ya tuvo prueba responde 409, igual que `crearSinPago` hoy.
- Si en el registro se reservó un plan de pago, esa reserva **no se pierde**: se sigue creando como suscripción pendiente de pago (DT-07), y la prueba se concede igualmente (la cuenta usa la prueba y el Libre mientras se valida el pago).

### Caducidad sin cron: evaluación perezosa

La transición de la prueba al plan siguiente ocurre **cuando alguien necesita saber el plan vigente**, no por un proceso programado:

- Un servicio único de `rest_suscripcion` (`PlanVigente`) resuelve el plan y, si encuentra una prueba vencida, aplica la transición dentro de **una transacción con bloqueo `FOR UPDATE`**, de modo que dos peticiones simultáneas no creen dos suscripciones del plan siguiente.
- Se invoca desde un endpoint nuevo `GET suscripcion/planVigente` (toma el usuario del token), y desde los que ya consultan suscripciones.
- La app lo consulta al iniciar sesión, al restaurar la sesión y al abrir las pantallas que dependen del plan.
- **Complemento opcional (DT-06):** un script de mantenimiento ejecutable con el cron del hosting, que expire las pruebas vencidas de las cuentas inactivas para tener los informes al día. No es necesario para que la regla funcione.

### Menú según el estado del plan

El menú se decide en la app a partir del plan vigente que devuelve el servidor. Las opciones que no están habilitadas **siguen visibles** pero, al tocarlas, no abren su pantalla: muestran un aviso (el criterio de Kelly, `mostrar-criterio-kelly`, siempre abre).

| # | Estado de la cuenta | Menú | Al tocar una opción bloqueada |
|---|---------------------|------|-------------------------------|
| 1 | **Prueba** (24 h) | Completo | — |
| 2 | **Plan Libre** (10 días) | Completo, con los límites del Libre (matriz de HU-005) | — |
| 3 | **Libre terminado** y plan de pago elegido, **pendiente de validación** («menú mínimo») | Solo **Inicio** y **Mostrar criterio Kelly** habilitados | Aviso «tu plan <nombre> está pendiente de pago y se activará cuando el administrador valide tu comprobante», con el acceso a **subir o ver el comprobante** (pantalla de HU-005) |
| 4 | **Libre terminado y sin plan de pago elegido** (sin plan vigente) | Mismo menú, bloqueado salvo **Mostrar criterio Kelly** | Aviso «debes activar un plan» con la **lista de planes vigentes** para que elija uno |
| 5 | **Plan de pago vigente** | Completo | — |
| 6 | **Plan de pago cortado** (sin plan vigente) | Igual que el estado 4 | Igual que el estado 4 |

El usuario definió los seis estados (el 6 confirmado el 2026-11-11). Lo que se puede hacer **dentro** de cada pantalla habilitada lo limita el plan según la matriz de HU-005.

### Aviso en la app

Mientras dura la prueba, la app muestra el tiempo restante (por ejemplo, «Tu prueba termina en 5 h 20 min») y, al terminar, informa de que la cuenta pasó al plan Libre y cuántos días le quedan. Sigue la arquitectura del agente `desarrollador-ionic`: toda la lógica en el store, componente presentacional sin `inject()` y el servicio solo para HTTP.

## Criterios de aceptación

**Orden sugerido para el HLT:** A (datos) → B (concesión) → C (caducidad) → D (API) → C3 y C2 (confirmación y mejora) → E (seguridad) → F (app) → G (no regresión).

### A. Datos

- **A-01** Existe un script idempotente (`seguridad`/`planes` en `rest_suscripcion/anexos/`, con su reversión) que añade las columnas `pla_horasDuracion`, `pla_planSiguienteId` y `sus_fechaHoraFin`, el plan `Prueba` (id 5), el intervalo 6 y la combinación 17. Se puede ejecutar dos veces sin error y los volcados de instalación existentes no se editan.
- **A-02** Los planes 1 a 4 y sus 16 combinaciones quedan idénticos; las suscripciones existentes no cambian.
- **A-03** El plan `Prueba` tiene los mismos límites que el Enterprise, `pla_horasDuracion = 24` y `pla_planSiguienteId = 1`. El plan Libre queda con `pla_horasDuracion = 240` y los mismos límites que hoy.
- **A-04** Las claves foráneas y los índices existentes se conservan; una instalación nueva desde los scripts deja el mismo esquema que la base actualizada.

### B. Concesión

- **B-01** En el primer inicio de sesión de una cuenta activada y sin prueba previa, el servidor crea la suscripción de prueba: situación `A`, `sus_fechainicio` hoy, y `sus_fechaHoraFin` = ahora (UTC) + 24 horas.
- **B-02** Una cuenta que ya tuvo prueba (en cualquier estado) recibe 409 y no obtiene otra. La comprobación y la inserción van en la misma transacción con bloqueo; cinco peticiones simultáneas dan un 200 y cuatro 409.
- **B-03** El cliente **no puede** elegir la prueba ni su duración: `crearSinPago` y `crearConPago` rechazan el plan de prueba con 400, y el endpoint de concesión no acepta plan ni horas en el cuerpo.
- **B-04** La hora de inicio y fin sale únicamente del reloj del servidor, en UTC. Cambiar la hora del dispositivo no altera la prueba.
- **B-05** Una cuenta pendiente de activación (`P`) no recibe prueba.
- **B-06** Si en el registro se reservó un plan de pago, la suscripción pendiente de ese plan se sigue creando como hoy (DT-07), y los flujos G-1 a G-5 de HU-003 mantienen su resultado.

### C. Caducidad y transición

- **C-01** Con la prueba vencida, la siguiente consulta del plan vigente marca la suscripción de prueba como `E` y crea la suscripción del **plan Libre** con `sus_fechaHoraFin` = instante de la transición (UTC) + 10 días. Una consulta posterior no crea nada más.
- **C-02** Dos consultas simultáneas sobre una prueba vencida crean **una sola** suscripción Libre.
- **C-06** Con el plan Libre vencido, la siguiente consulta lo marca `E` y la cuenta queda sin plan vigente (DT-10). No se vuelve a conceder la prueba ni otro plan Libre.
- **C-07** Un plan Libre en curso no se toca: a los 9 días 23 h 59 min sigue vigente; pasados los 10 días, vencido.
- **C-03** Una prueba que no ha vencido no se toca. A los 23 h 59 min sigue en curso; a las 24 h 00 min 01 s ya está vencida.
- **C-04** La transición no depende de ningún proceso programado ni de la base de datos: se prueba con la prueba vencida y sin ningún cron en marcha.
- **C-05** Cada transición queda en `spsu_historialsuscri` con la fecha, la suscripción de origen y la de destino.

### C2. Mejora a un plan de pago

- **M-01** Cuando el administrador valida el pago (DT-11) de una cuenta con prueba o plan Libre en curso, esa suscripción pasa a `C`, la del plan pagado pasa a `A` con inicio el día en que la persona subió el comprobante (DT-16) y ambas quedan en `spsu_historialsuscri`.
- **M-02** El plan de pago activo prevalece en `planVigente`: la cuenta ve de inmediato los límites del plan pagado, aunque a la prueba o al Libre les quedara tiempo.
- **M-03** La mejora es atómica y no se duplica: un pago confirmado dos veces o dos peticiones simultáneas crean una sola suscripción de pago activa.
- **M-04** La mejora solo se hace sobre pagos propios de la cuenta, verificados en el servidor; el cliente no puede declarar que pagó. Se mantienen las comprobaciones de `crearConPago` (precio y meses del catálogo, `idTransaccion` único, suscripción propia).
- **M-05** Una cuenta cuyo plan de pago llegó a su fecha de corte no vuelve a la prueba. Si tras 30 días de renovación pendiente sigue sin pagar, la renovación se anula y recibe un plan Libre de 10 días (DT-17); si paga dentro de esos 30 días, se activa la renovación (DT-16).
- **M-06** Una cuenta que mejoró antes de usar su prueba **pierde** la prueba (no queda pendiente para usarla después).
- **M-07** Auditoría de `PLAN_MEJORADO` con la suscripción de origen y de destino, sin datos sensibles.

### C3. Confirmación de pagos (servidor, sin ventana de administración)

La mejora a un plan de pago ocurre al **confirmar** el pago (DT-11). Esta historia añade el mecanismo del servidor; la ventana de administración que lo usará se crea en una historia posterior.

- **P-01** Existe un endpoint protegido que **confirma** un pago en revisión (`R` → `C`) y otro que lo **rechaza** (`R` → `F`), con el id del pago en la ruta o el cuerpo. Solo cuentas con rol **Super Administrador (1) o Administrador (2)**.
- **P-02** La autorización se decide en el servidor con los roles de la sesión leídos de la base de datos (C-03 de HU-001), nunca con lo que mande el cliente ni con el rol que muestre la app. Sin token responde 401; con un rol sin permiso, 403.
- **P-03** Confirmar un pago es **atómico** con la mejora y con la actualización de la fecha de corte: en la misma transacción el pago pasa a `C`, la suscripción asociada pasa a `A` con `sus_fechainicio` = día en que se subió el comprobante (UTC, `pag_fechaPago`; DT-16) y `sus_fechaFin` = ese día + los meses del intervalo (si esa fecha de corte ya pasó, responde 409 «El comprobante es demasiado antiguo; suba uno nuevo» y nada cambia), se recalculan `sus_proximoPago`, `pag_pagoDesde` y `pag_pagoHasta`, y se cancela la prueba o el Libre en curso (M-01). Un pago ya confirmado o rechazado responde 409 y no repite nada.
- **P-04** Se verifica que el monto y los meses del pago coinciden con el catálogo (como hace `crearConPago`) antes de confirmar, y que la suscripción es de un usuario real.
- **P-05** Auditoría de `PAGO_CONFIRMADO` y `PAGO_RECHAZADO`, con el administrador que actuó y el pago afectado, sin datos sensibles.
- **P-06** Un pago confirmado o rechazado no se puede revertir desde la API. Corregir un error requiere una operación manual documentada.
- **P-07** Mientras no exista la ventana de administración, el README explica cómo confirmar un pago con el endpoint (`curl` con el token de un administrador).
- **P-08** Existe un endpoint de **consulta** para administradores (mismos roles y comprobaciones que P-01 y P-02) que lista los pagos en revisión con los datos necesarios para validarlos: usuario, plan, monto, método, `idTransaccion`, fecha y el **comprobante subido** (la imagen que hoy guarda `pag_imagen`). Hoy ese listado existe en el controlador sin ruta (`PagosCtrl::obtenerPagosPendientesVerificacion`); se expone con la protección de rol y sin devolver datos sensibles de otros pagos. Es la base de la ventana de administración futura.
- **P-09** El comprobante lo sube la persona al pagar (flujo `crearConPago` existente, con la validación de imágenes que ya aplica `BaseCtrl`); esta historia comprueba que el administrador puede verlo antes de validar. La **pantalla** de subida, el motivo de rechazo, la exigencia de comprobante para aprobar y «un solo pago en revisión por suscripción» son reglas de **HU-005**, que se implementan **en el mismo HLT de pagos** para no escribir dos veces los mismos endpoints.

### C4. Cancelación y corte del plan de pago

- **X-01** Existe un endpoint protegido, `suscripcion/cancelar`, que toma el usuario de la sesión (sin id en la petición) y marca `sus_renovAutomatica = 0` en su plan de pago activo. Responde 409 si no tiene plan de pago activo o ya está cancelado.
- **X-02** Cancelar **no cambia** la situación ni la fecha de corte: el plan sigue vigente hasta `sus_fechaFin` (DT-13). Una cuenta cancelada con plan vigente ve en la app «Tu plan termina el <fecha>».
- **X-03** Llegada la fecha de corte, la siguiente consulta del plan vigente marca la suscripción `E` (con o sin cancelación) y la cuenta queda sin plan vigente; si tenía renovación automática (no cancelada), además se crea la renovación pendiente de pago de DT-15. La transición es atómica y se prueba con fixtures en el pasado, el futuro y el límite exacto, sin esperar meses.
- **X-04** Auditoría de `PLAN_CANCELADO` y `PLAN_CORTADO`, y registro en `spsu_historialsuscri`.
- **X-05** Una cuenta no puede cancelar el plan de otra (403 uniforme) ni cancelar un plan que no es de pago.

### D. API

- **D-01** `GET suscripcion/planVigente` (con token, sin parámetros de usuario) devuelve el plan vigente con sus límites, `esPrueba`, el instante de fin y los segundos restantes, y el plan siguiente cuando es una prueba.
- **D-02** Sin token responde 401. Con un id de otro usuario en la petición responde 403, como el resto de endpoints.
- **D-03** `planes/disponible` no incluye el plan de prueba. `planes/suscritos` y `suscripcion/porUsuario` siguen devolviendo lo que devuelven hoy a las cuentas sin prueba.
- **D-04** Las respuestas mantienen el formato de siempre (dato directo o `{ "error": "..." }`) y el 422 sigue reservado para el límite de pérdida.

### E. Seguridad

- **E-01** Toda decisión (concesión, vigencia, transición) se toma en el servidor con la sesión del token; ningún dato de plan, fecha o duración se acepta del cliente.
- **E-02** Se mantienen las protecciones de HU-001: consultas preparadas, validación de entrada, 403 uniforme ante un recurso ajeno, límites por IP y por sesión, y respuestas sin detalles internos.
- **E-03** Auditoría de los eventos `PRUEBA_INICIADA`, `PRUEBA_RECHAZADA` (segundo intento) y `PRUEBA_EXPIRADA`, sin datos sensibles.
- **E-04** Una cuenta no puede encadenar pruebas creando otra con los mismos datos: se apoya en el correo, el teléfono y la cédula únicos de HU-003 (G-4 y G-6). Cuántas cuentas por persona es el máximo realista queda anotado como riesgo residual.
- **E-05** Todo valor de fecha se calcula y guarda en UTC; ninguna comparación usa `NOW()` de MySQL (lección de la corrección F-01 de HLT-06 v2).

### F. App

- **F-01** Tras el primer inicio de sesión de una cuenta nueva, la app pide la concesión (reemplaza la creación del plan Libre de A-5) y muestra el aviso del tiempo restante. Si la concesión falla o responde 409, el login no se bloquea, como hoy.
- **F-02** Mientras la prueba está en curso, la app muestra el tiempo restante, calculado a partir de los segundos que devuelve el servidor (no del reloj del dispositivo).
- **F-03** Cuando la prueba termina, la app lo informa una vez y refleja el plan Libre, con los días que le quedan (hasta 10). Cuando el Libre termina, lo informa una vez y lleva a la pantalla de planes (DT-10). Cuando se mejora a un plan de pago, refleja el plan nuevo.
- **F-04** La lógica vive en el store (`rxMethod` con el pipeline estándar), los servicios solo hacen HTTP y los componentes presentacionales no inyectan nada. El token no se guarda en ningún almacenamiento persistente.
- **F-05** El aviso del tiempo restante no depende de que la pantalla esté abierta durante 24 horas: se recalcula al volver a la app.
- **F-06** **Menú según el estado del plan** (DT-14, tabla de «Menú según el estado del plan»). Con la prueba, con el plan Libre en curso y con un plan de pago vigente, el menú está completo (en el Libre, con los límites del Libre). Con el **Libre terminado y un plan de pago pendiente** solo están habilitados el **inicio** y **Mostrar criterio Kelly**. Con el **Libre terminado y sin plan de pago elegido**, o con el plan de pago cortado, el menú sigue visible pero cada opción, salvo **Mostrar criterio Kelly**, muestra el aviso «debes activar un plan» con la lista de planes vigentes para elegir uno.
- **F-07** Las rutas no habilitadas por el plan no se pueden abrir escribiendo la dirección: un guarda de rutas lleva al aviso que corresponda al estado (pendiente de pago, o «debes activar un plan» con la lista de planes). La decisión sale del plan vigente que devuelve el servidor, no de un dato guardado en el dispositivo. **Mostrar criterio Kelly**, el inicio, la pantalla de planes (a la que llevan los avisos) y la pantalla del comprobante (HU-005) no se bloquean en ningún estado; el guarda por plan tampoco se aplica a la ventana de administración, que tiene su propio guarda por rol (HU-005).
- **F-08** Al elegir un plan de pago, la app muestra que la cuenta tiene un **plan pendiente de pago** (nombre del plan y estado «se activará cuando el administrador valide tu comprobante»), tanto al terminar el registro como en la pantalla de planes. Cuando el administrador valida el pago, el siguiente refresco del plan vigente lo refleja.
- **F-09** La app permite cancelar el plan de pago (X-01) con una confirmación, y muestra la fecha en que termina.
- **F-10** La configuración de qué opciones habilita cada plan vive en un solo lugar de la app (no repartida por las páginas) y los componentes presentacionales no deciden permisos.

### G. No regresión

- **G-01** Los flujos de cuenta de HU-003 (recuperación, activación, correo, usuario y teléfono repetidos, cédula única y plan reservado) dan el mismo resultado que antes; la batería `hu003_flujos_cuenta.sh` se repite con el cambio de concesión.
- **G-02** Las suscripciones y pagos existentes, y los flujos de `crearConPago`, no cambian.
- **G-03** `ng lint`, `ng test` y `ng build` de la app, y `php -l` en todo archivo PHP tocado, sin errores.
- **G-04** Se prueba con el reloj simulado: fixtures con `sus_fechaHoraFin` y `sus_fechaFin` en el pasado, en el futuro y en el límite exacto, sin esperar 24 horas, 10 días ni meses.

## Decisiones que el HLT debe cerrar

| ID | Decisión | Recomendación | Requiere usuario |
|----|----------|---------------|------------------|
| **DT-01** | **CERRADA por el usuario:** tras las 24 horas de acceso completo la cuenta pasa al **plan Libre, de 10 días de duración y funcionalidad mínima**. Si antes adquiere un plan de pago, pasa al plan que pagó. | Libre: `pla_horasDuracion = 240`; sus límites los fija HU-005 | No |
| **DT-10** | **CERRADA por el usuario (opción A, ajustada):** cuando termina el plan Libre de 10 días la cuenta queda **sin plan vigente**. Conserva su cuenta y sus datos; el menú sigue visible pero cada opción, salvo **Mostrar criterio Kelly**, muestra «debes activar un plan» y la lista de planes vigentes para elegir (estado 4 de la tabla de menú). | Mensaje claro y planes a un toque. HU-005 lo aplica también en el servidor (sin plan vigente, solo Mostrar criterio Kelly con los límites del Libre) | No |
| **DT-11** | **CERRADA por el usuario (opción A):** un plan de pago entra en vigencia cuando el **administrador verifica y valida el comprobante de pago** que sube la persona; al validarlo se **actualiza la fecha de corte**. La ventana de administración es de HU-005. | Esta historia incluye el **mecanismo del servidor** para listar, confirmar y rechazar pagos, protegido por rol (sección C3); la ventana que lo usa es de HU-005 | No |
| **DT-12** | **CERRADA por el usuario (ajustada por DT-17):** un plan de pago **se corta al terminar su periodo** contratado y la cuenta queda sin plan vigente (no vuelve a la prueba). Para continuar, paga la renovación pendiente (DT-15) subiendo un comprobante nuevo. Si no paga en 30 días, pasa al Libre de 10 días (DT-17) | Fecha de corte = día en que se subió el comprobante + meses del intervalo (DT-16) | No |
| **DT-13** | **CERRADA por el usuario:** cancelar un plan de pago tiene efecto **al terminar el periodo ya pagado**; no se devuelve dinero | `sus_renovAutomatica = 0`; el plan sigue `A` hasta la fecha de corte | No |
| **DT-14** | **CERRADA por el usuario:** el menú depende del estado del plan según la tabla «Menú según el estado del plan». El **menú mínimo** (inicio y Mostrar criterio Kelly) llega cuando el Libre termina y el plan elegido está pendiente de validación; durante los 10 días del Libre el menú es completo con los límites del Libre; sin plan elegido, el menú sigue visible pero pide activar un plan, salvo Mostrar criterio Kelly. | Estado 6 = estado 4 (confirmado por el usuario el 2026-11-11). El menú y las rutas son de la app; los límites del servidor llegan con HU-005 | No |
| **DT-15** | **CERRADA por el usuario el 2026-11-13 (renovación automática lista para una pasarela de pago):** al elegir un plan de pago la suscripción queda con renovación automática (`sus_renovAutomatica = 1`, valor por defecto). Cuando llega la fecha de corte de un plan de pago con renovación automática: (1) se corta como siempre (`E`, DT-12) y (2) se crea una **renovación pendiente de pago** (`P`, mismo plan e intervalo, sin duplicar si ya existe una pendiente de ese plan). La persona ve el estado 3 del menú («tu plan <nombre> está pendiente de pago»), debe pagar subiendo un comprobante nuevo y el administrador lo valida (DT-11); cuando exista una pasarela, será ella quien confirme el pago con ese mismo procedimiento. **Nunca se cobra, ni se registra un pago, ni se alargan fechas sin un pago validado.** Cancelar (`sus_renovAutomatica = 0`, DT-13) evita crear la renovación. | Es el efecto de `procesar_renovaciones` (rest_suscripcion/anexos); el PHP del corte (`PlanVigenteSrv`, HLT-16) debe hacer lo mismo para que haya un solo comportamiento | **Planificado el 2026-11-13:** HLT-16-v4 (corte con renovación pendiente), HLT-19-v2 y HLT-20-v2 (aviso de pago pendiente tras el corte), HLT-18 (cancelar evita la renovación) |
| **DT-16** | **CERRADA por el usuario el 2026-11-13 (desde cuándo corre el plan pagado):** el periodo de un plan de pago corre **desde el día en que la persona sube el comprobante**, siempre que el administrador lo valide; no desde el día en que creó o eligió el plan. Ejemplo: si eligió el plan hace 15 días y sube el comprobante hoy, el plan corre desde hoy y su fecha de corte es hoy + los meses del intervalo. Las fechas que se guardaron al elegir el plan (inicio, fin, próximo pago) son provisionales y se recalculan al subir el comprobante. El plan entra en vigencia cuando el administrador valida (DT-11), con esas fechas ya fijadas; si el administrador tarda, esos días cuentan contra el periodo. **Alcance de DT-16 (aclarado por el usuario el 2026-11-13): esto vale para el primer corte, es decir cuando no hay un periodo vigente** (primera contratación, o renovación pagada después de terminar el periodo anterior). **Si la persona sube el comprobante ANTES de que termine el periodo presente (pago anticipado)**, al validar el administrador **se mantienen la fecha de inicio y la fecha de fin del periodo presente**; el pago cubre el periodo siguiente, que empieza el día después de la fecha de fin presente y dura los meses del intervalo. Al llegar el corte del periodo presente, ese periodo ya pagado pasa a activo sin interrupción y sin crear renovación pendiente. | El PHP de crearConPago ya recalcula las fechas al subir el comprobante; la confirmación (HLT-17) debe **conservarlas** en vez de recalcularlas el día de la validación | **Planificado el 2026-11-13:** HLT-17-v4 (fechas conservadas y 409 de comprobante antiguo), HLT-25-v2 y HLT-26-v2 |
| **DT-17** | **CERRADA por el usuario el 2026-11-13 (segundo corte consecutivo sin pago):** la renovación pendiente de pago (DT-15) dispone de un **plazo fijo de 30 días** desde el primer corte (la fecha de corte del plan + 30 días). Si en ese plazo no hay un pago confirmado, la renovación se **anula** (suscripción `C`, historial `ANULADA`) y la cuenta pasa a un **plan Libre de 10 días nuevo** (240 h desde la anulación), al terminar el cual queda sin plan vigente (estado 4, DT-10). Mientras haya un pago en revisión (`R`) de esa renovación no se anula: se espera la decisión del administrador (si lo rechaza, se anula en la siguiente evaluación). Si paga dentro del plazo, rige DT-16 (el periodo corre desde el día de subida). Un pago anticipado (DT-16) evita el primer corte. Tras anularse, la renovación automática termina: para volver a un plan de pago la persona elige un plan nuevo. | La evaluación es perezosa (PlanVigenteSrv), sin cron. El Libre concedido por anulación se crea una vez por anulación (sin encadenar: la renovación ya anulada no se repite). El procedimiento `procesar_renovaciones` debe hacer lo mismo | **Planificado el 2026-11-13:** HLT-16-v4 (plazo, anulación, Libre nuevo y programada), HLT-17-v4, HLT-18, HLT-19-v2, HLT-20-v2, HLT-21-v2, HLT-25-v2, HLT-26-v2 y HLT-28-v2 |
| DT-02 | A quién se concede: solo cuentas **nuevas** o también a las existentes | Solo cuentas nuevas reciben la prueba. Las existentes conservan sus suscripciones; las que **nunca tuvieron plan** quedan sin plan vigente, con los límites del Libre (HU-005, decisión del usuario del 2026-11-12) |
| DT-03 | Cuándo empieza el reloj: al registrarse, al activar el correo o en el primer inicio de sesión | **Primer inicio de sesión** de una cuenta activada: así el tiempo se aprovecha y coincide con el flujo actual |
| DT-04 | Cómo se guarda una duración de horas si las fechas son `date` | Columna nueva `sus_fechaHoraFin DATETIME` en UTC; no se cambia el tipo de las columnas existentes, para no afectar al resto del código |
| DT-05 | Intervalo del plan de prueba (los intervalos están en meses) | Intervalo propio «Prueba (24 horas)» con `ins_numMeses = 0`, y validaciones que lo excluyan de la compra |
| DT-06 | Caducidad solo perezosa o también con cron del hosting | **Perezosa como mecanismo principal** (funciona sin cron); script de cron del hosting como complemento opcional |
| DT-07 | Qué pasa con el plan de pago elegido al crear la cuenta | Queda como suscripción pendiente (`P`) hasta que se suba el comprobante y el administrador lo valide; mientras tanto la persona usa la prueba y el Libre |
| DT-08 | Duración configurable | Se guarda en el plan (`pla_horasDuracion`), no en el código |
| DT-09 | Alcance del control de la app según el plan | **En esta historia:** el menú, los avisos y el guarda de rutas de la app según el estado del plan (F-06 a F-10). **Fuera:** valores y aplicación de los límites de cada plan (HU-005) |

## Fuera de alcance

- **Los valores y la aplicación de los límites de cada plan** (número de cuentas, días, descargas, gráficas, divisor, en la app y en los backends): **HU-005**. Esta historia solo controla en la app qué opciones del menú y qué rutas se habilitan según el estado del plan.
- **La pantalla para subir el comprobante y la ventana de administración** para validarlo: **HU-005**. Esta historia deja los endpoints del servidor.
- El **cobro automático** de la renovación (pasarela de pago) y los recordatorios de vencimiento por correo o push. La renovación en sí queda preparada: ver DT-15 (al terminar el periodo se crea una renovación pendiente de pago, que se paga subiendo un comprobante nuevo hasta que exista la pasarela).
- Cobros, pasarelas de pago y facturación.
- Pruebas más largas o múltiples tipos de prueba.
- Notificaciones por correo o push al terminar la prueba.

## Definición de terminado

- [ ] HLT **APROBADO** por el `planificador` (todas las decisiones de negocio ya están cerradas).
- [ ] Criterios A a G verificados con evidencia real: `curl`, `php -l`, `ng lint`, `ng test`, `ng build` y las baterías de no regresión.
- [ ] Pruebas con el reloj simulado: prueba en curso, en el límite y vencida; cinco peticiones simultáneas sobre una prueba vencida; segundo intento de concesión.
- [ ] Prueba manual en la app: registro → activación → primer inicio de sesión → aviso de prueba → (con la fecha adelantada en la base local) paso al plan siguiente.
- [ ] README de `rest_suscripcion` y de la app, `CLAUDE.md` y los agentes actualizados.

## Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| La prueba se puede repetir creando cuentas nuevas con otros datos | Media | Correo, teléfono y cédula únicos (HU-003); verificación del correo antes de la primera concesión; límite por IP; riesgo residual aceptado |
| Error de zona horaria que acorta o alarga la prueba | Alta | Todo en UTC con el reloj de PHP, ningún `NOW()` de MySQL (E-05), pruebas con fixtures en los límites |
| Dos peticiones simultáneas crean dos suscripciones del plan siguiente | Alta | Transacción con `FOR UPDATE` y prueba de concurrencia (C-02) |
| El plan de prueba se obtiene o se compra desde el cliente | Alta | Concesión solo en el servidor; rechazo en `crearSinPago`/`crearConPago`; excluido de `planes/disponible` (B-03, D-03) |
| «Acceso total» no se nota porque los límites no se aplican | Media | HU-005 aplica los límites; la prueba toma los del Enterprise |
| Un cambio de esquema en una base con datos reales | Baja | Script idempotente con reversión, columnas nuevas nulas que no alteran los datos existentes |
| Hoy ningún proceso confirma los pagos | Alta | Se añade el mecanismo del servidor (C3), protegido por rol de administrador, con auditoría; la ventana llega después |
| **El control del plan solo existe en la app (menú y rutas):** quien use las APIs directamente conserva las funciones de planes superiores, porque el servidor todavía no las limita | Alta | Lo cierra **HU-005** (límites en el servidor), que se ejecuta a continuación de esta |
| Un endpoint de confirmación mal protegido regalaría planes de pago | Alta | Rol leído de la base de datos, 401 y 403 probados, un administrador no confirma su propio pago salvo decisión expresa, y auditoría de cada acción |
| Un usuario que termina el Libre queda sin acceso a las funciones y abandona la app | Media | DT-10: la cuenta y los datos se conservan, y la app lleva a la pantalla de planes con un mensaje claro |
| Mejora duplicada o en carrera (dos confirmaciones del mismo pago) | Alta | Transacción con `FOR UPDATE`, `idTransaccion` único y prueba de concurrencia (M-03) |
