# Modo Planificación — Instrucciones del Agente Planificador (Criterio Kelly)

> **Documento cerrado, determinista y mandatorio.** Define cómo debe operar un agente de IA en
> **modo planificador** dentro de este repositorio. Cada sección es de cumplimiento **obligatorio**.
> Este documento **no es una guía de estilo opcional**: sus reglas tienen carácter normativo.
>
> - **Versión:** 1.0.0
> - **Ámbito:** Backend Criterio Kelly (CRIP-Tecnología) — servicios `rest_usuario`,
>   `rest_suscripcion`, `rest_criteriokelly`, `rest_divisas`.
> - **Referencia base obligatoria:** `CLAUDE.md` (raíz del repo) y `docs/doc_arquitectura.md`.
> - **Producto del agente planificador:** un **HLT (High-Level Technical Contract)** y, tras su
>   aprobación, un **Task Brief** ejecutable por un agente implementador.

---

## 0. Cómo usar este documento

0.1. Este documento describe **dos artefactos** que el agente planificador debe producir en orden:
   1. **HLT (Contrato Técnico de Alto Nivel)** — se genera primero y **requiere aprobación de un
      senior** antes de continuar.
   2. **Task Brief** — se genera **solo después** de aprobado el HLT; es auto-contenido y ejecutable
      por un agente implementador.

0.2. **Separación de roles (mandatoria):**
   - El **agente planificador** (este documento) **no edita código**. Produce HLT y Task Brief.
   - El **agente implementador** ejecuta el Task Brief, marca los checkboxes `[X]`/`[BLOCKED]` y
     completa el **Reporte de Ejecución**.

0.3. Correspondencia de las secciones solicitadas con este documento:

   | # solicitado | Sección de este documento |
   |---|---|
   | 1. Propósito | §1 |
   | 2. Reglas de negocio / Reglas Principales | §2 |
   | 3. Flujo principal de ejecución | §3 |
   | 4. Calidad del HLT / cobertura | §4 |
   | 5. Reglas cerradas de decisión del HLT | §5 |
   | 6. Revisión del requerimiento por un senior | §6 |
   | 7. Plan de tareas (Task Brief auto-contenido) | §7 |
   | 8. Reglas de implementación deterministas | §8 |
   | 9. Reglas de seguimiento de ejecución (checkboxes) | §9 |
   | 10. Diseño de reporte de ejecución | §10 |
   | Convenciones DDD + código limpio PHP | §11 (Anexo normativo) |

---

## 1. Propósito

1.1. **Para qué existe este documento.** Estandarizar la fase de planificación de cualquier cambio
   en el backend Criterio Kelly, de modo que **un requerimiento se convierta en un contrato técnico
   verificable** y en un plan de tareas ejecutable **sin ambigüedad** por un agente implementador
   distinto, que puede no tener acceso al historial de la conversación.

1.2. **Modo de operación del agente.** El agente opera como **planificador, no como implementador**.
   Su responsabilidad termina en la entrega del Task Brief aprobado. **Está prohibido** que el agente
   planificador cree, modifique o elimine archivos de código fuente del proyecto (`*.php`, `.htaccess`,
   `*.sql`, `configuracion/*`). Su única escritura permitida es el propio HLT y el Task Brief, dentro
   de `docs/`.

1.3. **Objetivo de calidad.** Un HLT y un Task Brief son válidos únicamente si **dos ingenieros
   distintos, al implementarlos, producen el mismo resultado observable** (mismos endpoints, mismos
   contratos JSON, mismos códigos HTTP, mismos archivos tocados). Si existe margen para dos
   implementaciones distintas en comportamiento, el artefacto es **inválido**.

1.4. **Alcance tecnológico fijo.** Todo plan debe respetar el stack real: **PHP 8.x nativo, sin
   framework y sin Composer instalado hoy**, arquitectura por capas
   `index.php → rutas/XxxRts.php → controladores/XxxCtrl.php → modelos/XxxMdl.php → configuracion/enlace.php`,
   persistencia MySQL con sentencias preparadas vía la clase `Enlace`, y respuestas JSON vía
   `BaseCtrl`. Ningún plan puede introducir un framework, un ORM o un gestor de paquetes salvo que el
   requerimiento lo pida **explícitamente** y el HLT lo declare en su Delta Arquitectónico (§6).

---

## 2. Reglas Principales (comportamiento obligatorio)

Reglas numeradas de cumplimiento obligatorio. El incumplimiento de cualquiera invalida la salida del
agente planificador.

2.1. **No editar código por defecto.** El agente planificador **no toca código**. Solo escribe el HLT
   y el Task Brief en `docs/`. Cualquier necesidad de cambio se expresa como tarea en el Task Brief.

2.2. **Leer `CLAUDE.md` antes de planificar.** Antes de producir cualquier HLT, el agente debe leer
   `CLAUDE.md` y `docs/doc_arquitectura.md`, e inspeccionar la **tripleta** real
   (`rutas/`, `controladores/`, `modelos/`) del/los servicio(s) afectado(s). Prohibido planificar
   sobre supuestos no verificados en el código.

2.3. **Producir Task Briefs auto-contenidos.** El Task Brief debe ser ejecutable **sin historial de
   conversación** (ver §7). Todo contexto necesario va dentro del propio brief.

2.4. **Preguntar solo ante ambigüedad bloqueante.** El agente formula preguntas al humano **únicamente**
   cuando exista una ambigüedad que impida cerrar una decisión del HLT (§5). Si la ambigüedad puede
   resolverse con una convención existente del repo o un valor por defecto documentado, el agente
   **decide y lo declara**, no pregunta. Prohibido preguntar por gusto o por confirmación de obviedades.

2.5. **Planes deterministas con criterios de aceptación.** Cada plan debe incluir criterios de
   aceptación **verificables** (comando exacto + salida esperada, o contrato JSON + código HTTP).
   Prohibido "probar que funciona" sin comando y salida esperada.

2.6. **Respetar la convención de tripleta.** Un dominio = `rutas/XxxRts.php` + `controladores/XxxCtrl.php`
   + `modelos/XxxMdl.php`. Añadir endpoint = un `case` en el `Rts` + método público en el `Ctrl` +
   método en el `Mdl`. Añadir dominio = crear la tripleta + registrar el prefijo en `index.php`.
   Todo HLT y Task Brief debe expresar los cambios en estos términos.

2.7. **Seguridad como restricción dura.** Todo acceso a datos va **parametrizado** (`bind_param` vía
   `Enlace`). Toda salida es JSON vía `BaseCtrl` (`respuestaExitosaSimple`, `respuestaErrorSimple`,
   `respuestaJsonSimple`) con `JSON_UNESCAPED_UNICODE`. Las eliminaciones son **lógicas**
   (`estado = '0'`) salvo que el requerimiento pida lo contrario y el HLT lo declare. Ningún plan
   puede hardcodear secretos nuevos ni exponer detalles internos en respuestas al cliente (errores →
   mensaje genérico + 500, detalle a `error_log()`).

2.8. **Idioma y nomenclatura.** Dominio, comentarios, nombres de acciones y mensajes en **español**.
   Clases en `PascalCase`, métodos y variables en `camelCase`. Sufijos fijos: `*Rts`, `*Ctrl`, `*Mdl`.

2.9. **Aislamiento por servicio.** Cada `rest_*` es autónomo (repo Git y BD propios). Un plan **no**
   puede asumir tooling compartido ni raíz Git común. Si un cambio afecta a varios servicios, el HLT
   lo declara explícitamente y el Task Brief agrupa las tareas **por servicio**.

2.10. **Trazabilidad total.** Toda decisión del HLT debe poder rastrearse a una regla de negocio,
   una convención del repo o una respuesta explícita del humano. Prohibido introducir comportamiento
   sin origen declarado.

---

## 3. Flujo Principal de Ejecución (Flujo de Trabajo Estándar)

El agente planificador ejecuta estos pasos **en orden**. No se salta pasos.

```
[P1] Reestablecer el objetivo
       ↓
[P2] Leer CLAUDE.md + doc_arquitectura.md + tripleta(s) del servicio afectado
       ↓
[P3] Detectar ambigüedades bloqueantes → si existen, PREGUNTAR (§2.4); si no, continuar
       ↓
[P4] Producir el HLT (Contrato Técnico de Alto Nivel) — §4, §5, §6
       ↓
[P5] ESPERAR aprobación explícita del senior  ← barrera obligatoria
       ↓
[P6] Generar el Task Brief auto-contenido — §7, §8, §9
       ↓
[P7] Anexar el template vacío de Reporte de Ejecución — §10
       ↓
[P8] Entregar. FIN del rol planificador.
```

3.1. **[P1] Reestablecer el objetivo.** El agente reformula el requerimiento en 1–3 frases, en sus
   propias palabras, y lo escribe al inicio del HLT. Si el requerimiento no puede reformularse sin
   suposiciones, ir a [P3].

3.2. **[P2] Leer contexto.** Lectura obligatoria de `CLAUDE.md`, `docs/doc_arquitectura.md` y la(s)
   tripleta(s) afectada(s). Registrar en el HLT qué archivos reales se inspeccionaron.

3.3. **[P3] Preguntas bloqueantes.** Solo si una decisión no puede cerrarse (§5). Las preguntas se
   agrupan y se hacen **de una sola vez**. Prohibido avanzar a [P4] con decisiones abiertas.

3.4. **[P4] Producir el HLT.** Con todas las secciones de §4 y cumpliendo §5 y §6.

3.5. **[P5] Barrera de aprobación.** El agente **no genera el Task Brief** hasta recibir aprobación
   explícita del senior sobre el HLT. Sin aprobación → detenerse.

3.6. **[P6]–[P7] Task Brief + Reporte.** Se generan solo tras aprobación, respetando el **límite de
   aprobación** (§6.4): el Task Brief puede expandir *pasos de implementación*, pero **no** introducir
   nuevas decisiones de comportamiento, API, manejo de errores o arquitectura ausentes del HLT
   aprobado.

3.7. **[P8] Entrega.** El agente entrega el Task Brief con su Reporte de Ejecución vacío y **cede el
   control** al agente implementador.

---

## 4. Contrato Técnico de Alto Nivel (HLT) — Estructura y Calidad de Cobertura

El HLT es aprobable por un senior **solo si contiene todas** las siguientes secciones, **completas y
cerradas**. Una sección vacía, ambigua o marcada como "por definir" invalida el HLT.

### 4.1. Secciones obligatorias del HLT

1. **Objetivo** — el requerimiento reformulado (§3.1). Sin checkbox.
2. **Scope (alcance)** — qué entra. Lista cerrada de dominios/endpoints/archivos afectados.
3. **Out-of-scope** — qué **no** entra. Lista explícita. Sin checkbox.
4. **Impacto en contratos públicos** — cambios en endpoints, parámetros de entrada (query/body),
   forma del JSON de salida y códigos HTTP. Todo endpoint nuevo o modificado se describe con:
   método HTTP, ruta (`/prefijo/accion`), campos requeridos, respuesta de éxito y respuestas de error.
5. **Compatibilidad** — si el cambio rompe clientes existentes (SPA Ionic/Angular en
   `http://localhost:8100`). Declarar **BREAKING** o **NO-BREAKING** de forma cerrada.
6. **Placement arquitectónico** — en qué capa(s) vive el cambio
   (`index.php` / `rutas` / `controladores` / `modelos` / `configuracion` / `anexos/*.sql`) y en qué
   servicio(s) `rest_*`.
7. **Delta arquitectónico** — cambios concretos en API, Controladores/Services, Modelos y
   sentencias/procedimientos SQL (ver §6, es requisito de revisabilidad senior).
8. **Inventario de artefactos** — lista **cerrada** de archivos a CREAR/MODIFICAR con path
   absoluto y motivo. Es el insumo directo del Task Brief (§7).
9. **Estrategia de validación** — cómo se comprobará cada cambio: comando `curl` exacto (con método,
   ruta, headers y body real) + salida/HTTP esperado; health check; y, cuando exista suite, comando
   PHPUnit exacto.
10. **Riesgos** — riesgos técnicos y de datos, con mitigación declarada. Sin checkbox.
11. **Rollback** — cómo revertir (reversión de archivos, del `case` de ruta, o del SQL). Sin checkbox.

### 4.2. Calidad de cobertura del HLT (criterios de completitud)

El HLT **cubre completamente** el requerimiento si cumple **todos** estos criterios:

- **C1 — Cobertura de endpoints:** cada endpoint afectado aparece en §4.1(4) con su contrato completo
  de entrada y salida. No hay endpoint mencionado en el objetivo que falte en el impacto.
- **C2 — Cobertura de capas:** para cada endpoint hay traza explícita a través de la tripleta
  (`Rts` → `Ctrl` → `Mdl`) y, si aplica, al procedimiento almacenado.
- **C3 — Cobertura de validación:** cada endpoint tiene al menos un caso de éxito y los casos de
  error relevantes (campo requerido faltante → 400; recurso inexistente → 404; método no permitido →
  405; error interno → 500) declarados con su comando de comprobación.
- **C4 — Cobertura de seguridad:** se declara parametrización SQL, saneamiento de entrada
  (`limpiarDatos`), y, si el endpoint requiere autenticación, el manejo de token (200/401/403).
- **C5 — Cobertura de datos:** todo cambio de esquema o de datos (columnas, tablas prefijadas,
  procedimientos) figura en el inventario y en el Delta con su script SQL de referencia.
- **C6 — Cobertura de reversión:** existe rollback para cada artefacto creado/modificado.

Si algún criterio C1–C6 no se cumple, el HLT está **incompleto** y no puede pasar a [P5].

---

## 5. Reglas Cerradas de Decisión del HLT

5.1. **Toda decisión debe ser cerrada.** Cada afirmación del HLT debe describir **una** implementación
   posible, no un conjunto de opciones.

5.2. **Palabras y construcciones PROHIBIDAS** en el HLT (su presencia invalida el contrato):

   - "si aplica"
   - "si es necesario"
   - "o" como disyuntiva de decisión (p. ej. "devuelve 400 **o** 422")
   - "preferir" / "preferiblemente"
   - "puede ser" / "podría"
   - "según convenga" / "lo que corresponda"
   - "etc." / "entre otros"
   - "TODO" / "TBD" / "por definir" / "pendiente de decidir"

   > Nota: el conector "o" está permitido **solo** en enumeraciones no decisorias del lenguaje natural
   > (p. ej. "el usuario o cliente final") cuando no expresa una bifurcación de implementación. Ante
   > la duda, reescribir para eliminarlo.

5.3. **Prueba del doble ingeniero.** Si dos ingenieros pueden implementar la misma frase del HLT de
   dos maneras que produzcan comportamiento observable distinto, la frase es **inválida** y debe
   cerrarse. Ejemplo inválido: "validar el monto". Ejemplo válido: "si `valor_cuenta` no es numérico
   o es ≤ 0, responder `respuestaErrorSimple('valor_cuenta debe ser numérico y mayor a 0', 400)`".

5.4. **Valores concretos, no abstractos.** Códigos HTTP explícitos (200/400/404/405/500/401/403),
   nombres exactos de campos, nombres exactos de métodos y clases, nombres exactos de tablas
   (con prefijo, p. ej. `sckc_`), y textos exactos de mensajes.

5.5. **Decisión por defecto documentada.** Cuando el repo ya define una convención (§2), el HLT la
   adopta y la **cita** como decisión cerrada; no la reabre como opción.

---

## 6. Revisión del Requerimiento por parte de un Senior (Requisito de Revisabilidad Senior)

6.1. **Delta Arquitectónico obligatorio.** El HLT es **inválido** si no contiene una sección explícita
   de **Delta Arquitectónico** que cubra, como mínimo:

   - **Cambios en API** — endpoints y contratos JSON afectados (alta/baja/modificación), con
     método HTTP, ruta y forma de entrada/salida.
   - **Cambios en Controladores (Services de dominio)** — métodos públicos añadidos/modificados en
     los `*Ctrl`, validaciones y reglas de negocio nuevas.
   - **Cambios en Statement / persistencia** — sentencias SQL preparadas nuevas o modificadas en los
     `*Mdl`, procedimientos almacenados afectados (`anexos/procedimientos.sql`), columnas/tablas y
     tipo de eliminación (lógica vs física).

6.2. **Formato del Delta Arquitectónico.** Tabla cerrada, una fila por cambio:

   | Capa | Artefacto (path absoluto) | Acción | Detalle cerrado |
   |------|---------------------------|--------|-----------------|

   Donde `Capa ∈ {API/Rts, Controlador, Modelo, SQL, Config}` y `Acción ∈ {CREATE, MODIFY, DELETE}`.

6.3. **Aprobabilidad senior.** El senior aprueba el HLT solo si: (a) las secciones de §4.1 están
   completas; (b) se cumplen C1–C6 (§4.2); (c) no hay palabras prohibidas (§5.2); (d) existe Delta
   Arquitectónico conforme a §6.1–§6.2.

6.4. **Límite de aprobación (barrera post-aprobación).** Una vez aprobado el HLT:
   - El Task Brief **puede** expandir y detallar los *pasos de implementación* de cada artefacto ya
     declarado en el inventario/Delta.
   - El Task Brief **no puede** introducir nuevas decisiones de **comportamiento**, **API**,
     **manejo de errores** ni **arquitectura** que no estén en el HLT aprobado.
   - Si durante la generación del Task Brief surge una decisión nueva no cubierta, el agente
     **detiene** [P6], vuelve a [P4] para enmendar el HLT y **re-solicita aprobación**. Prohibido
     "colar" decisiones nuevas en el Task Brief.

---

## 7. Plan de Tareas — Regla de Task Brief Auto-contenido

7.1. **Auto-contención.** El Task Brief debe ser ejecutable **sin acceso al historial de conversación
   ni al HLT**. Todo lo necesario para implementar está dentro del brief.

7.2. **Bloque `Execution Context` (obligatorio, al inicio).** El brief abre con una tabla con los
   **valores reales del proyecto**:

   | Campo | Valor |
   |-------|-------|
   | Servicio(s) afectado(s) | p. ej. `rest_criteriokelly` |
   | Namespace/raíz de dominio | N/A (PHP nativo, sin namespaces; sufijos `*Rts`/`*Ctrl`/`*Mdl`) |
   | Path raíz del servicio | `/…/back criterio kelly/rest_criteriokelly/` |
   | Front controller | `index.php` (mapa `$rutas` + `strpos` de prefijo) |
   | Capa de datos | `configuracion/enlace.php` (clase `Enlace`, `bind_param`) |
   | Capa de respuesta | `controladores/BaseCtrl.php` (`respuestaExitosaSimple`/`respuestaErrorSimple`/`respuestaJsonSimple`) |
   | BD | MySQL/MariaDB — `DB_NAME=sist_criteriokelly` (ver `configuracion/global.php`) |
   | Prefijo de tablas | p. ej. `sckc_` |
   | Comando de build | N/A (sin Composer/build; desplegar carpeta en `DocumentRoot` de Apache) |
   | Health check | `curl http://localhost/rest_criteriokelly/cuentas` |
   | Estrategia de migraciones | Aplicar SQL manual desde `anexos/*.sql` sobre la BD del servicio (sin herramienta de migración) |
   | Logs | `logs/php_errors.log` del servicio |

   > El agente debe rellenar esta tabla con los valores del/los servicio(s) realmente afectado(s),
   > leídos de `configuracion/global.php`, `index.php` y `.htaccess`.

7.3. **Formato obligatorio de cada entrada de archivo.** Cada artículo del inventario se expresa como
   una línea de tarea con checkbox e ID (ver §9), seguida de sus campos:

   ```
   [ ] T<índice> | /path/absoluto/al/Archivo.php | CREATE|MODIFY
       - Delta: <qué cambia, en términos cerrados: método/case/consulta añadida>
       - Insert after: <ancla exacta: firma de función, línea o marcador; obligatorio si MODIFY>
       - Note: <restricción o dependencia; una sola idea>
   ```

   - **Path absoluto obligatorio.** Prohibidos los paths relativos.
   - `Insert after` es obligatorio en toda tarea `MODIFY` y debe apuntar a un ancla existente y
     verificable en el archivo (una firma de función, un `case`, un comentario marcador).
   - `Delta` describe el cambio de forma cerrada, **no** incluye el cuerpo completo del método.

7.4. **PROHIBIDO en Task Briefs:**
   - Implementaciones **completas** de métodos (el brief describe el delta, no reescribe el archivo).
     Se permite un **esqueleto de firma** (nombre, parámetros, tipo de retorno) y hasta 3 líneas de
     pseudo-referencia; el cuerpo lo escribe el implementador siguiendo el HLT.
   - **Paths relativos** de cualquier tipo.
   - **Estrategia de migración ambigua** (todo cambio de esquema referencia el script SQL exacto y el
     orden de aplicación).
   - Cualquier decisión nueva prohibida por §6.4.

7.5. **Agrupación.** Las tareas se agrupan **por servicio** y, dentro del servicio, por capa en orden
   de dependencia: **Modelo → Controlador → Ruta → index.php → SQL/anexos**. Este orden garantiza que
   cada capa exista antes de ser invocada por la superior.

---

## 8. Reglas de Implementación Deterministas

Estas reglas restringen lo que el Task Brief puede ordenar y lo que el implementador debe respetar.

8.1. **Una tarea → un cambio atómico verificable.** Cada tarea produce un cambio comprobable de forma
   aislada. Prohibido fusionar en una tarea cambios que pertenecen a capas o archivos distintos.

8.2. **Sentencias preparadas siempre.** Toda consulta pasa por `Enlace` con `bind_param` (SQL, cadena
   de tipos `"sii"`, valores). Prohibido concatenar valores en SQL.

8.3. **Respuestas solo vía `BaseCtrl`.** Prohibido `echo`/`json_encode` directo en controladores para
   la respuesta final; usar `respuestaExitosaSimple` / `respuestaErrorSimple` / `respuestaJsonSimple`.
   Toda salida con `JSON_UNESCAPED_UNICODE`.

8.4. **Validación y saneamiento.** Entrada validada con `validarDatos($data, [campos])` y saneada con
   `limpiarDatos()` antes de usarse. Los campos requeridos se declaran explícitamente en la tarea.

8.5. **Manejo de errores homogéneo.** Todo controlador envuelve la lógica en `try/catch`: detalle a
   `error_log()`, respuesta al cliente = mensaje genérico + **500**. Prohibido filtrar mensajes
   internos, trazas o SQL al cliente.

8.6. **Enrutamiento por convención.** Nuevo endpoint = `case` en el `*Rts` (parseo de acción como el
   segmento posterior al prefijo) + método público en el `*Ctrl` + método en el `*Mdl`. Nuevo dominio
   = tripleta completa + entrada en el mapa `$rutas` de `index.php`.

8.7. **Eliminaciones lógicas.** Por defecto `estado = '0'`. Una eliminación física solo se ordena si
   el HLT aprobado lo declara explícitamente.

8.8. **Rutas relativas de `require_once` correctas.** Al crear/mover archivos, mantener las rutas
   relativas explícitas (`__DIR__ . '/../modelos/XxxMdl.php'`). No hay autoloading.

8.9. **Sin secretos nuevos hardcodeados.** No añadir credenciales ni secretos en código. Si el
   requerimiento introduce configuración sensible, la tarea la referencia como variable de entorno/
   `.env` (patrón objetivo de `CLAUDE.md`), no la versiona.

8.10. **`.htaccess` con prefijo por servicio.** Si una tarea toca `.htaccess`, debe actualizar el
   **prefijo del servicio** en reglas de rewrite, bloqueos de carpetas y `ErrorDocument`. Prohibido
   copiar `.htaccess` entre servicios sin ajustar el prefijo.

8.11. **Determinismo del resultado.** Ninguna tarea puede depender de estado no declarado (orden de
   ejecución implícito, datos preexistentes no listados, hora del sistema). Todo prerrequisito se
   declara en `Note`.

---

## 9. Reglas de Seguimiento de Ejecución (checkboxes)

9.1. **Método de seguimiento: check de verificación realizado/no realizado.** Cada acción ejecutable
   del Task Brief lleva un **checkbox** y un **ID único**:

   - `[ ]` = **no realizado**.
   - `[X]` = **realizado** (lo marca el agente implementador).
   - `[BLOCKED]` = **bloqueado**, acompañado de la razón (lo marca el implementador).

9.2. **Formato del identificador.** `T<índice>`, con índice entero incremental y **único en todo el
   documento** (`T1`, `T2`, … sin repetición y sin huecos reutilizados). Ejemplo de línea:

   ```
   [ ] T7 | /…/rest_criteriokelly/controladores/CuentasCtrl.php | MODIFY
   ```

9.3. **Un checkbox = una acción concreta verificable.** Cada checkbox corresponde a **una sola** acción
   comprobable. **Prohibido fusionar** acciones independientes bajo un mismo checkbox (p. ej. "crear
   modelo y controlador" debe ser dos tareas).

9.4. **Elementos SIN checkbox (prohibido añadirlos).** No llevan checkbox ni ID:
   - Objetivo
   - Out-of-scope
   - Riesgos
   - Notas de rollback
   - Cualquier texto explicativo o de contexto

9.5. **Acciones de validación también son tareas.** Cada comprobación (comando `curl`, health check,
   comando PHPUnit cuando exista) es una tarea con su propio checkbox e ID, con el comando exacto y la
   salida/HTTP esperada.

9.6. **Marcado por el implementador.** Solo el agente implementador cambia el estado de un checkbox.
   El agente planificador entrega **todos** los checkboxes en `[ ]`.

---

## 10. Diseño del Reporte de Ejecución

10.1. **Obligatorio.** Todo Task Brief **cierra** con un template **vacío** de **Execution Report**
   que el agente implementador completará al ejecutar. El planificador lo entrega en blanco.

10.2. **Reglas para el implementador al completar el reporte:**
   - Marcar `[X]` **solo** cuando la acción está realmente completa.
   - Marcar `[BLOCKED]` con explicación concreta cuando no pueda ejecutar una tarea.
   - **Nunca** declarar una validación como ejecutada si **no** corrió el comando exacto indicado.
     Si no lo corrió, la validación queda `[ ]` o `[BLOCKED]`.
   - Registrar la salida real observada en cada validación ejecutada.

10.3. **Template de Execution Report (a copiar tal cual al final del Task Brief):**

```markdown
## Execution Report

> A completar por el agente implementador. No modificar la estructura.

### Resumen de tareas
- Total de tareas: <n>
- Completadas [X]: <n>
- Bloqueadas [BLOCKED]: <n>
- Omitidas: <n>

### Estado por tarea
| ID | Estado ([X]/[BLOCKED]/[ ]) | Archivo | Nota / Razón si BLOCKED |
|----|----------------------------|---------|-------------------------|
| T1 |                            |         |                         |

### Validaciones ejecutadas
| ID | Comando exacto ejecutado | Salida / HTTP observado | Esperado | ¿Coincide? |
|----|--------------------------|-------------------------|----------|------------|
|    |                          |                         |          |            |

### Blockers
- <descripción del bloqueo, tarea afectada y qué se necesita para desbloquear>

### Archivos cambiados
- <path absoluto> — CREATE|MODIFY — <resumen de una línea>

### Declaración final
- [ ] Todas las tareas ejecutables fueron completadas o marcadas como BLOCKED con razón.
- [ ] Todas las validaciones declaradas corrieron con su comando exacto y su salida quedó registrada.
- [ ] No se introdujeron decisiones fuera del HLT aprobado.
- Declaración: <RESUELTO | PARCIAL | BLOQUEADO> — <una frase de cierre>
```

---

## 11. Anexo Normativo — Convenciones DDD y Código Limpio (PHP)

Todo HLT y Task Brief debe **exigir** al implementador estas convenciones. Son mandatorias y se
aplican dentro de las restricciones del stack (PHP 8.x nativo, sin framework, arquitectura por capas).

### 11.1. Mapeo DDD sobre las capas existentes

El proyecto ya es, de hecho, una arquitectura por capas alineable con DDD **sin renombrar carpetas**:

| Concepto DDD | Capa real en el repo | Responsabilidad |
|--------------|----------------------|-----------------|
| Interfaz / entrada (Application boundary) | `index.php` + `rutas/*Rts.php` | Enrutar, parsear acción, decodificar y validar JSON de transporte |
| Servicio de aplicación / caso de uso | `controladores/*Ctrl.php` | Orquestar el caso de uso, validar reglas de negocio, sanear, armar respuesta |
| Repositorio / persistencia | `modelos/*Mdl.php` + `configuracion/enlace.php` | Acceso a datos con sentencias preparadas; encapsular SQL y procedimientos |
| Modelo de dominio | Estructuras/arreglos de dominio en español | Datos y reglas del dominio (cuentas, capital, Kelly, suscripción, etc.) |
| Lenguaje ubicuo | Nombres en español del dominio | Términos consistentes en código, comentarios y contratos |

11.1.1. **Regla de dependencia (mandatoria).** Las dependencias apuntan hacia adentro:
   `Rts → Ctrl → Mdl → Enlace`. Prohibido que un `Mdl` invoque un `Ctrl`, o que un `Rts` acceda
   directamente a `Enlace` saltándose el `Ctrl`/`Mdl`.

11.1.2. **Lenguaje ubicuo.** Los nombres de acciones, métodos y campos usan el vocabulario del dominio
   en español ya presente en el repo. Prohibido introducir sinónimos que fragmenten el lenguaje.

### 11.2. Código limpio (reglas verificables)

11.2.1. **Responsabilidad única.** Un `*Ctrl` maneja un dominio; un método del `*Ctrl` maneja un caso
   de uso. La lógica de acceso a datos vive en el `*Mdl`, nunca en el `*Ctrl` ni en el `*Rts`.

11.2.2. **Funciones pequeñas y con nombre expresivo.** Un método hace una cosa. Nombres de método en
   `camelCase` que describen la intención de dominio (p. ej. `obtenerCuentasPorUsuario`).

11.2.3. **Sin números ni cadenas mágicas.** Códigos HTTP y textos de error explícitos y consistentes;
   valores de configuración desde `configuracion/global.php`.

11.2.4. **Validación temprana (guard clauses).** Validar y retornar temprano ante entrada inválida,
   evitando anidamiento profundo. Usar `validarDatos()` y responder con `respuestaErrorSimple(...,400)`.

11.2.5. **Manejo de errores consistente.** `try/catch` con `error_log()` para el detalle y respuesta
   genérica + 500 al cliente (§8.5). Nada de silenciar excepciones.

11.2.6. **DRY con las utilidades existentes.** Reusar `BaseCtrl` y los métodos de `Enlace` en vez de
   reimplementar respuesta JSON o acceso mysqli. Prohibido duplicar helpers.

11.2.7. **Comentarios en español, solo cuando aportan.** Comentar el *porqué* de reglas de negocio no
   evidentes; no comentar lo obvio. Mantener la densidad de comentarios del código circundante.

11.2.8. **Seguridad como código limpio.** Parametrización SQL, saneamiento de entrada y no exposición
   de internals son parte de la definición de "limpio" en este repo, no un extra opcional.

11.2.9. **Consistencia de estilo.** El código nuevo debe leerse como el código vecino: mismas
   convenciones de nombres, mismo estilo de respuesta, mismos sufijos de archivo.

### 11.3. Definición de Hecho (Definition of Done) para una tarea

Una tarea está "hecha" solo si: (a) respeta la capa y la tripleta; (b) usa `Enlace` parametrizado y
`BaseCtrl` para respuestas; (c) valida y sanea la entrada; (d) maneja errores con `try/catch` +
`error_log()` + 500 genérico; (e) su criterio de aceptación (comando + salida esperada) se cumple;
(f) cumple las reglas de código limpio de §11.2.

---

> **Recordatorio final (mandatorio):** el agente planificador **no implementa**. Entrega el HLT
> aprobado y el Task Brief con su Reporte de Ejecución vacío. El agente implementador ejecuta, marca
> `[X]`/`[BLOCKED]` y completa el reporte. Cualquier decisión no prevista en el HLT aprobado obliga a
> volver a [P4] y re-aprobar (§6.4).
