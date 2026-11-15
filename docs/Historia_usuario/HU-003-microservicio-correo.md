# HU-003 · Módulo de correo identificable en cada proyecto (sin microservicio)

| Campo | Valor |
|-------|-------|
| ID | HU-003 |
| Fecha | 2026-11-11 (rev. 2) |
| Estado | Por planificar |
| Prioridad | Baja-media. Es una reorganización interna sin cambio de comportamiento. Conviene ejecutarla después de cerrar las pruebas manuales de HU-001 (verificación de correo y recuperación de clave), porque toca los mismos archivos. |
| Proyectos | Los del workspace `C:\xampp\htdocs\criterio_kelly`. Hoy **solo `rest_usuario` envía correo**; la convención se aplica a cualquier proyecto que lo haga en el futuro. |
| Planificación | `docs/Planificacion/HLT-12-2026-11-11-modulo-correo-v2.md` (A–E y G-01/G-02) · `HLT-13-2026-11-11-eliminacion-codigo-correo.md` (F) · `HLT-14-2026-11-11-cedula-unica.md` (G-6) |
| Ejecución | HLT-12 ejecutado (pendiente solo la prueba manual T-40) · HLT-13 ejecutado: la columna `usu_codiorecupe` se eliminó (en la base por el usuario y en el código) · HLT-14 ejecutado (pendiente solo la prueba manual T-17). Reportes en `docs/Planificacion/evidencias/{correo-A,correo-B,cedula-unica}/REPORTE.md` |
| Agente de implementación | `desarrollador-php` (y `desarrollador-ionic` solo para la tarea de identificación en la app, sección D) |

## Cambio respecto a la revisión 1

**Se anula el microservicio `rest_correo`.** La revisión 1 proponía sacar el correo a un servicio aparte. Se descarta porque hoy un solo servicio envía correo, porque un endpoint que envía correo y un secreto compartido añadirían superficie de ataque en un hosting alquilado, y porque una llamada de red pondría en juego la protección de tiempos uniformes de HU-001 (anti-enumeración), que ya funciona y está probada. **No se crea la carpeta `rest_correo`.**

En su lugar, el correo se queda dentro de cada proyecto que lo use, pero **agrupado en un módulo con nombre propio**, para que cualquier desarrollador encuentre todo lo relacionado con el correo sin buscar.

La idea del microservicio queda registrada como alternativa futura, con sus condiciones (sección "Alternativa aplazada").

## Historia

**Como** desarrollador que mantiene Criterio Kelly,
**quiero** que en cada proyecto todo el código, la configuración, los registros y las pruebas del correo estén en un lugar con nombre propio y fácil de reconocer,
**para** encontrar, revisar y cambiar el envío de correo sin recorrer controladores, servicios y scripts sueltos, y sin poner en riesgo la seguridad que ya está implementada.

**Restricción principal:** la funcionalidad, la lógica y la seguridad actuales **no cambian**. Los usuarios y la app ven exactamente las mismas respuestas, los mismos correos, los mismos tiempos y los mismos límites. La **única excepción** es la regla nueva de cédula única (G-6), pedida por el usuario.

## Situación actual (verificada el 2026-11-11)

### Qué proyectos usan correo

| Proyecto | ¿Envía correo? | Evidencia |
|----------|----------------|-----------|
| `rest_usuario` | **Sí** | `servicios/EnviadorCorreo.php`, `servicios/PlantillasCorreo.php`, `phpmailer/phpmailer` en `composer.json`, 9 claves de correo en `.env` |
| `rest_criteriokelly` | No | Solo aparecen los nombres de las claves en la copia compartida de `configuracion/Configuracion.php`; no se le exigen ni las tiene en su `.env` |
| `rest_suscripcion` | No | Igual que `rest_criteriokelly` |
| `rest_divisas` | No | Igual que `rest_criteriokelly` |
| `criterioKellyApp` | No envía | Tiene pantallas y servicios que **disparan** correos del backend: verificación de correo y recuperación de clave |

`Configuracion.php` ya exige las claves de correo **solo** a `rest_usuario` (constante `CLAVES_USUARIO`), así que los otros backends no necesitan cambios de configuración.

### Dónde está hoy el correo en `rest_usuario` (repartido en 4 carpetas)

| Pieza | Ubicación actual |
|-------|------------------|
| Envío (modos `log`, `smtp`, `mail`, archivos `.txt` de local) | `servicios/EnviadorCorreo.php` |
| Textos de los correos (4 plantillas) | `servicios/PlantillasCorreo.php` |
| Prueba de envío por consola | `mantenimiento/probarCorreo.php` |
| Registros de local | `logs/correos.log`, `logs/correo-….txt`, `logs/registro-omitido-….txt` |
| Configuración | `.env` / `.env.ejemplo`, mezclada con las demás claves |
| Quién envía | `PersonaCtrl.php:161` (registro), `ClaveCtrl.php:58-61` (recuperación), `ClaveCtrl.php:191` (aviso de cambio de clave), `VerificacionCtrl.php:105-108` (reenvío del código) y `servicios/AlertasSeguridad.php:35` (alerta del mantenimiento) |
| Carga de las clases | `require_once` repetidos en `ClaveCtrl.php:11-12`, `PersonaCtrl.php:9-10`, `VerificacionCtrl.php:9-10`, `limpiarSeguridad.php:19-20`, `probarCorreo.php:21-22` |

Para saber "qué hace el correo" hoy hay que abrir al menos 9 archivos en 4 carpetas.

## Convención propuesta: módulo `correo/`

Todo proyecto que envíe correo tiene **una carpeta `correo/` en la raíz del proyecto**, con este contenido fijo:

```
rest_<proyecto>/
└── correo/
    ├── README.md               # mapa del correo: modos, plantillas, quién envía, configuración, cómo probar
    ├── EnviadorCorreo.php      # único punto que envía (log / smtp / mail)
    ├── PlantillasCorreo.php    # únicos textos de correo
    ├── cargarCorreo.php        # un solo require que carga el módulo
    └── probarCorreo.php        # prueba de envío por consola
```

Y además:

- **Registros de local en `logs/correos/`**: `correos.log`, `correo-….txt` y `registro-omitido-….txt` dejan de mezclarse con los logs de errores de PHP.
- **Configuración agrupada:** en `.env` y `.env.ejemplo`, las 9 claves de correo van juntas bajo un encabezado `# ===== Correo =====` con su explicación.
- **Marca en cada punto de llamada:** cada línea que envía correo lleva el comentario `// [CORREO] <plantilla>`, de modo que `grep -rn "\[CORREO\]"` lista todos los envíos del proyecto.
- **Mapa en el README del módulo:** una tabla con cada punto de llamada (`archivo:línea`), su plantilla y qué pasa si el envío falla.

En `rest_usuario` el resultado es:

| Antes | Después |
|-------|---------|
| `servicios/EnviadorCorreo.php` | `correo/EnviadorCorreo.php` |
| `servicios/PlantillasCorreo.php` | `correo/PlantillasCorreo.php` |
| `mantenimiento/probarCorreo.php` | `correo/probarCorreo.php` |
| 10 `require` de las dos clases en 5 archivos | 1 `require` de `correo/cargarCorreo.php` en cada archivo |
| `logs/correos.log`, `logs/correo-*.txt`, `logs/registro-omitido-*.txt` | `logs/correos/…` (mismos nombres de archivo) |
| Claves de correo mezcladas en `.env` | Bloque `# ===== Correo =====` |

**Lo que no se mueve, con motivo:**

- `servicios/AlertasSeguridad.php` y `modelos/AlertasSeguridadMdl.php`: deciden **cuándo** alertar a partir de `sgen_auditoria`, que es lógica de seguridad. Solo llevan la marca `[CORREO]` en su línea de envío y figuran en el mapa.
- Los controladores (`PersonaCtrl`, `ClaveCtrl`, `VerificacionCtrl`): contienen la lógica de negocio. Solo cambian sus `require` y llevan la marca.

## Criterios de aceptación

Cada criterio debe poder comprobarse con un comando (`grep`, `curl`, `php -l`, las baterías de HU-001) o con una observación concreta.

### A. Módulo de correo en `rest_usuario`

- **A-01** Existe `rest_usuario/correo/` con `README.md`, `EnviadorCorreo.php`, `PlantillasCorreo.php`, `cargarCorreo.php` y `probarCorreo.php`.
- **A-02** No queda ningún archivo de correo fuera del módulo: `servicios/EnviadorCorreo.php`, `servicios/PlantillasCorreo.php` y `mantenimiento/probarCorreo.php` ya no existen.
- **A-03** `grep -rn "PHPMailer" rest_usuario --include=*.php --exclude-dir=vendor` solo devuelve líneas de `correo/EnviadorCorreo.php`.
- **A-04** Todos los archivos que envían correo cargan el módulo con un único `require` de `correo/cargarCorreo.php`.
- **A-05** `grep -rn "\[CORREO\]" rest_usuario --include=*.php --exclude-dir=vendor` lista exactamente los 5 puntos de llamada, y coincide con la tabla del `README.md` del módulo.
- **A-06** `C:\xampp\php\php.exe rest_usuario/correo/probarCorreo.php destino@correo` funciona igual que hoy.
- **A-07** Los archivos se mueven con `git mv` para conservar su historial.

### B. Comportamiento sin cambios

- **B-01** Las 4 plantillas no cambian de texto. Una prueba compara, byte a byte, el asunto y el cuerpo generados antes y después de la reorganización para los mismos datos.
- **B-02** Los tres modos (`log`, `smtp`, `mail`) y todas sus validaciones se mantienen: `log` solo en local, cifrado `ninguno` solo en local y el mismo control del destinatario (sin saltos de línea y con dirección válida).
- **B-03** En modo `log` se siguen escribiendo `correos.log`, un `correo-AAAAMMDD-HHMMSS-xxxxxx.txt` por correo y, en local, el `registro-omitido-….txt`, ahora todos en `rest_usuario/logs/correos/`.
- **B-04** Los 5 puntos de llamada conservan el orden de las operaciones, sus `try/catch`, sus mensajes de `error_log` y su semántica de fallo:
  - el código de verificación se envía después del `commit` y un fallo no revierte el registro;
  - un fallo en la recuperación, el reenvío o el aviso de cambio de clave se registra y no cambia la respuesta HTTP;
  - un fallo en la alerta hace terminar el mantenimiento con error.
- **B-05** Las respuestas HTTP, los códigos de estado y los mensajes de todos los endpoints de `rest_usuario` no cambian.

### C. Seguridad sin cambios

- **C-01** El módulo `correo/` no es accesible por web: `curl` a `rest_usuario/correo/`, `correo/EnviadorCorreo.php`, `correo/README.md` y `logs/correos/correos.log` responde 403 o 404 en local, igual que el resto de archivos internos (lista blanca de HU-001, E-02).
- **C-02** Se mantienen los tiempos uniformes de los endpoints sensibles: las pruebas P-02 y P-23 de HU-001 (mínimo de 2,0 s y diferencia de medianas < 0,3 s entre correo existente e inexistente) siguen pasando.
- **C-03** Se mantienen los límites de registro, recuperación, reenvío y verificación, la auditoría (`RECUPERACION_SOLICITADA`, `ACTIVACION_SOLICITADA`, `CLAVE_CAMBIADA`, etc.) y la respuesta uniforme cuando el correo ya existe.
- **C-04** Ningún código de verificación o recuperación aparece en respuestas HTTP ni en los logs de errores. El contenido completo solo se archiva en modo `log`, que sigue prohibido fuera de local.
- **C-05** `logs/correos/` queda excluido del control de versiones (`.gitignore`) y fuera de la raíz pública en producción, como el resto de `logs/`.
- **C-06** No se añaden servicios, endpoints, secretos, tablas ni dependencias nuevas.

### D. Identificación en el resto de proyectos

- **D-01** El `README.md` de `rest_criteriokelly`, `rest_suscripcion` y `rest_divisas` indica en una línea que el proyecto **no envía correo** y remite a la convención del módulo `correo/` si algún día lo necesita.
- **D-02** En `criterioKellyApp`, que no envía correo, el `README.md` lista las pantallas, stores y servicios que **disparan** correos del backend (verificación de correo, reenvío del código y recuperación de clave), con el endpoint que llama cada uno y una referencia al módulo `rest_usuario/correo/`. El código de la app no se mueve: su reorganización es parte de HU-002.
- **D-03** El `CLAUDE.md` de la raíz y `.claude/agents/desarrollador-php.md` describen la convención: dónde vive el correo, la marca `[CORREO]`, los registros en `logs/correos/` y que un proyecto nuevo que envíe correo debe seguir la misma estructura.

### E. No regresión

- **E-01** Se actualizan los scripts de verificación que leen los correos (`docs/Planificacion/evidencias/*.sh` y `lib/`) a la nueva ruta `logs/correos/`, y se repiten con el mismo resultado que antes las baterías de HU-001 que tocan correo: `hlt06_bateria.sh`, `hlt06v2_bateria.sh` y los casos de envío de `hlt03_matriz.sh`.
- **E-02** El flujo completo de registro → código en el `.txt` → `/verificar-correo` → activación → login funciona en local igual que hoy.
- **E-03** Los flujos de recuperación de clave y de aviso de cambio de clave funcionan igual.
- **E-04** `php -l` sin errores en todo archivo PHP tocado. `ng lint` y `ng build` de la app sin cambios (la app no se modifica salvo su README).

### F. Eliminación del código de correo innecesario

En cualquier proyecto del workspace, todo código, configuración, documentación o dato creado para el correo que ya no se use **se elimina**, siempre que su eliminación no cambie la funcionalidad, la lógica ni la seguridad actuales. Lo que no cumpla esa condición se conserva y se justifica.

Inventario verificado el 2026-11-11 (el HLT lo vuelve a comprobar con `grep` antes de eliminar nada):

| # | Elemento | Dónde | Situación | Acción propuesta |
|---|----------|-------|-----------|------------------|
| F-1 | Documentación de los endpoints eliminados `generarCodigo` y `obtenerCodigo` (y su respuesta `codigo_recuperacion`) | `rest_usuario/rutas.txt:12-13, 48-74` y `rest_criteriokelly/rutas.txt:12-13, 48-74` | Esos endpoints se eliminaron en HLT-06 (responden 404). `rutas.txt` además está desactualizado y en `rest_criteriokelly` describe otro servicio | **Eliminar** esas entradas |
| F-2 | Columna `sgen_usuario.usu_codiorecupe` del flujo antiguo de recuperación | Base `sist_criteriokelly`, definida en `rest_usuario/anexos/sist_generico.sql` | Ningún archivo PHP ni TypeScript la usa desde HLT-06; la recuperación usa `sgen_recuperacion` | **Eliminar** con un script `ALTER TABLE … DROP COLUMN` idempotente en `rest_usuario/anexos/`, previo respaldo de la tabla (ver DC-08) |
| F-3 | Validaciones de las claves de correo en la copia compartida de `Configuracion.php` de `rest_criteriokelly`, `rest_suscripcion` y `rest_divisas` | `configuracion/Configuracion.php` | Solo se ejecutan para `rest_usuario` (`CLAVES_USUARIO`, línea 131), pero la regla de HU-001 exige que la copia sea idéntica en los backends | **Conservar**: quitarlas rompería la copia idéntica. Se documenta el motivo en el `README.md` del módulo |
| F-4 | Modo de envío `mail` (función `mail()` de PHP) | `EnviadorCorreo.php` y la validación de `CORREO_MODO` en `Configuracion.php` | Ningún `.env` lo usa hoy; se añadió como alternativa para un hosting sin SMTP | Decidir en DC-09 |
| F-5 | Restos de pruebas de correo fuera del proyecto: descarga de Mailpit sin usar y caché de `mailtodisk` | `C:\xampp\mailpit\descarga\`, `C:\xampp\mailtodisk\support\gen_py\` | No forman parte del workspace ni los usa nada | Fuera del alcance del código; se deja anotado para que el usuario los borre si quiere |

Criterios:

- **F-01** Se eliminan F-1 y F-2 (y F-4 si DC-09 lo decide), con un commit dedicado y separado de los movimientos de archivos.
- **F-02** Antes de eliminar cada elemento, `grep -rn` en los 5 proyectos (`--exclude-dir=vendor --exclude-dir=node_modules`) demuestra que no tiene referencias de uso. Si aparece una referencia no prevista, el elemento **no** se elimina y se registra el hallazgo.
- **F-03** Tras eliminar, se repiten las comprobaciones de B, C y E con el mismo resultado: ningún endpoint, respuesta, tiempo, límite ni correo cambia.
- **F-04** El script de F-2 deja un respaldo de la columna antes de borrarla, se puede ejecutar dos veces sin error, y se documenta cómo revertirlo.
- **F-05** No se elimina nada de lo que la historia marca como "Conservar" (F-3, `AlertasSeguridad`, el aviso `registro-omitido` de local, los modos `log` y `smtp`).

### G. Flujos de cuenta y correo que deben conservarse (y cédula única)

La reorganización no puede tocar ninguno de estos flujos, que hoy funcionan y dependen del correo. Cada uno se prueba antes y después con evidencia real.

| # | Flujo | Comportamiento que se conserva |
|---|-------|--------------------------------|
| G-1 | **Recuperar la contraseña por correo** | `autenticacion/solicitarRecuperacion` envía un código de 6 dígitos al correo (plantilla `codigoRecuperacion`) y responde siempre lo mismo, exista o no el correo. `autenticacion/restablecerClave` cambia la clave con ese código, revoca las sesiones y envía el aviso de cambio de clave |
| G-2 | **Habilitar la cuenta por correo** (comprueba que el correo es real y de quien se registra) | El registro deja el usuario en situación `P` y envía el código de verificación (plantilla `codigoVerificacion`). `persona/activar` con el código pasa la cuenta a `A`. `persona/reenviarCodigo` envía uno nuevo. Sin activar, el usuario no puede iniciar sesión |
| G-3 | **No crear otra cuenta con el mismo correo** | Si el correo ya está registrado, no se crea ninguna cuenta ni se envía correo, y el cliente recibe la misma respuesta que un registro nuevo (anti-enumeración). En local se escribe el aviso `registro-omitido-….txt` |
| G-4 | **No crear otra cuenta con el mismo usuario o teléfono** | El registro responde 409 y no crea nada. Hasta HLT-14 el mensaje es `El nombre de usuario o el teléfono ya están registrados`; desde HLT-14 pasa a ser el mensaje único de DC-10 |
| G-5 | **Crear el usuario con el plan seleccionado** | El plan elegido en `/planes` se reserva en el dispositivo durante el registro (`plan_reservado`). En el primer inicio de sesión, ya con la cuenta activada, la app llama a `suscripcion/crearSinPago` con ese plan (o el plan Libre si no hay reserva); un 409 se toma como "ya tiene suscripción" |
| G-6 | **No crear otra cuenta con la misma cédula** (**regla nueva**, ver abajo) | Si se envía una cédula que ya pertenece a una persona activa, el registro responde 409 y no crea nada |

**Sobre G-6:** hoy el registro **no** comprueba la cédula (`PersonaMdl.php:57-62` solo compara usuario y teléfono) y `per_cedula` no tiene índice único en el esquema (`sist_generico.sql:32`). Comprobarla es un **cambio de comportamiento deliberado**, la única excepción a la restricción principal de esta historia, pedida por el usuario:

- La cédula es opcional: solo se comprueba cuando el registro la envía.
- La comprobación va en la misma transacción y con el mismo bloqueo (`FOR UPDATE`) que la de usuario y teléfono, para que dos registros simultáneos con la misma cédula no pasen ambos.
- Respuesta: 409 con el mensaje único de DC-10, que nombra la cédula entre los campos posibles pero nunca su valor ni cuál de los tres está repetido. La cédula se comprueba después del correo, para que un correo repetido siga recibiendo la respuesta uniforme (G-3) aunque traiga una cédula repetida.
- Antes de cualquier índice único se comprueba con una consulta si la base ya tiene cédulas repetidas; si las hay, se listan y se pide al usuario qué hacer, sin borrar nada (DC-11).
- La app muestra el mensaje del servidor como ya hace con el 409 de usuario o teléfono (`error.interceptor.ts` y `registro.page.html`); se verifica que el texto se vea bien.

Criterios:

- **G-01** Antes de reorganizar (línea base) y después de cada fase se prueban G-1 a G-5 con `curl` contra el backend local, con usuarios de prueba que luego se eliminan, y el resultado es idéntico: mismos códigos HTTP, mismos mensajes, mismos correos archivados y mismas filas en `sgen_usuario`, `sgen_verificacion`, `sgen_recuperacion` y `spsu_suscripcion`.
- **G-02** G-5 se prueba de punta a punta en la app (registro con un plan de pago → activación → primer login → `crearSinPago` con ese plan) como parte de las pruebas manuales.
- **G-03** G-6: con una cédula ya registrada el registro responde 409 y el conteo de `sgen_persona` no cambia; con una cédula nueva o sin cédula el registro sigue funcionando igual; dos registros simultáneos con la misma cédula producen un 200 y un 409.
- **G-04** Las pruebas de tiempos de HU-001 (P-02, P-23) siguen pasando después de añadir G-6.

## Decisiones que el HLT debe cerrar

| ID | Decisión | Recomendación |
|----|----------|---------------|
| DC-01 | Microservicio aparte o módulo dentro de cada proyecto | **Módulo `correo/` dentro de cada proyecto** (cerrada por el usuario en esta revisión) |
| DC-02 | Nombre y ubicación del módulo | **`correo/` en la raíz del proyecto**, para que se vea junto a `controladores/`, `modelos/` y `servicios/` sin entrar en ninguna |
| DC-03 | Mover también `AlertasSeguridad` | **No**: es lógica de seguridad. Solo la marca `[CORREO]` y el mapa en el README |
| DC-04 | Ubicación de los registros de local | **`logs/correos/`**, separados de los logs de errores de PHP |
| DC-05 | Cargar el módulo con un archivo único o con `require` individuales | **Un único `correo/cargarCorreo.php`**: un solo lugar que muestra de qué depende el módulo |
| DC-06 | Introducir el autoload de Composer para las clases propias | **No en esta historia**: cambiaría la carga de todo el proyecto. Se mantiene el estilo actual con `require` |
| DC-07 | Qué hacer con `rutas.txt` (F-1) | **Eliminar solo las entradas de `generarCodigo` y `obtenerCodigo`**. Borrar o rehacer el archivo completo, que está desactualizado en más puntos, queda fuera de esta historia |
| DC-08 | Eliminar la columna `usu_codiorecupe` (F-2) | **Sí, con respaldo previo y script reversible**. Es un cambio de esquema: el usuario debe confirmarlo al aprobar el HLT (RD-6) |
| DC-10 | Mensaje del 409 cuando la cédula ya existe (G-6) | **Un solo mensaje para los tres casos:** `El nombre de usuario, el teléfono o la cédula ya están registrados`. Así no se revela cuál de los tres está repetido |
| DC-11 | Índice único sobre `per_cedula` | **No en esta historia**: la comprobación en la transacción con `FOR UPDATE` basta para evitar duplicados nuevos. Si la base ya tiene cédulas repetidas, se informan al usuario sin tocarlas |
| DC-09 | Conservar o eliminar el modo `mail` (F-4) | **Conservar**: es la única opción de envío en un hosting que no dé acceso SMTP (DH-10/DH-11 de HU-001 siguen pendientes). Se elimina en HLT-11 si el hosting elegido ofrece SMTP |

## Alternativa aplazada: microservicio `rest_correo`

Queda descartada por ahora. Tendría sentido retomarla, en una historia nueva, si se da alguna de estas condiciones:

- un segundo proyecto necesita enviar correo (por ejemplo, recibos de pago desde `rest_suscripcion`);
- el volumen exige una cola con reintentos;
- se quiere que una sola máquina tenga acceso al SMTP.

En ese caso el módulo `correo/` de esta historia es justamente lo que se trasladaría, sin buscar el código por el proyecto. La versión 1 de esta historia (en el historial de este documento) describe el contrato, la firma HMAC y las pruebas de tiempos que habría que cumplir.

## Fuera de alcance

- Crear `rest_correo` o cualquier otro servicio.
- Cambiar textos de los correos, añadir plantillas o pasar a correos HTML.
- Elegir el proveedor SMTP de producción (DH-10 de HU-001), que sigue pendiente y se configura en el bloque de correo del `.env` de `rest_usuario`.
- Reorganizar el código de la app (HU-002).
- Composer autoload para las clases propias (DC-06).

## Definición de terminado

- [ ] HLT de esta historia **APROBADO** por el `planificador`.
- [ ] Criterios A a F verificados con evidencia real: `grep`, `curl`, `php -l` y las baterías.
- [ ] Inventario de código innecesario (F) revisado: cada elemento eliminado tiene su `grep` sin referencias y cada elemento conservado su justificación.
- [ ] Comparación byte a byte de los 4 correos, antes y después.
- [ ] Flujos de registro y activación, recuperación de clave y aviso de cambio de clave probados en local, con el `.txt` generado en `rest_usuario/logs/correos/`.
- [ ] `README.md` del módulo `correo/` con el mapa de los 5 puntos de llamada.
- [ ] Documentación actualizada: README de los 4 backends y de la app, `CLAUDE.md` de la raíz y el agente `desarrollador-php`.

## Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Romper un `require` al mover los archivos y que un endpoint dé 500 | Media | `php -l` y `curl` de cada endpoint que envía correo tras el cambio; las baterías de HU-001 (E-01) |
| Exponer por web la carpeta nueva `correo/` o `logs/correos/` | Media | La lista blanca de `.htaccess` ya bloquea todo salvo `index.php`; se comprueba con `curl` (C-01) |
| Scripts de prueba que siguen leyendo `logs/correos.log` | Baja | Actualizarlos en E-01 |
| Conflicto con las pruebas manuales pendientes de HU-001 | Baja | Ejecutar esta historia después de cerrarlas |
| Perder el historial de git de los archivos movidos | Baja | `git mv` y un commit dedicado al movimiento, sin cambios de contenido (A-07) |
| Eliminar algo que sí se usaba y romper un flujo | Media | `grep` previo en los 5 proyectos (F-02), un commit por eliminación y repetir las baterías (F-03) |
| Perder datos al eliminar la columna `usu_codiorecupe` | Baja | No tiene uso desde HLT-06; respaldo previo y script reversible (F-04), con confirmación del usuario (DC-08) |
