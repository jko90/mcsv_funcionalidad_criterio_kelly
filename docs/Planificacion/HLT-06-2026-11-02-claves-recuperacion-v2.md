# HLT-06 · Claves, recuperación y verificación de correo (`rest_usuario`) · v2 (delta)

| Campo | Valor |
|-------|-------|
| HLT | HLT-06 · versión **v2 (delta)** |
| Fecha | 2026-11-07 |
| Complementa a | [HLT-06-2026-11-02-claves-recuperacion.md](HLT-06-2026-11-02-claves-recuperacion.md) (v1, ejecutado con estado **PARCIAL**, [REPORTE](evidencias/HLT-06/REPORTE.md)). **Todo lo de la v1 sigue vigente**, salvo lo que esta versión cambia de forma explícita. La v1 no se sobrescribe ni se vuelve a ejecutar. |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4): B-02 a B-07, C-01, C-02 |
| Plan maestro | [PLAN-MAESTRO-HU-001-v2](PLAN-MAESTRO-HU-001-v2.md): D-17, **D-18 (verificación por correo, opción A)**, AJ-01, AJ-02, AJ-03 |
| Contrato de planificación | `criterioKellyApp/docs/doc_modo_planificacion.md` (H1…H11) + extensiones para backend de `docs/planificador.md` |
| Proyectos | `rest_usuario` (git propio) y las copias idénticas de `RegistroAuditoria.php` en `rest_criteriokelly` (git propio), `rest_suscripcion` (git propio) y `rest_divisas` (sin git) |
| Agente de implementación | `desarrollador-php` (todas las tareas). **No hay tarea de `desarrollador-ionic`**: la copia de scripts de seguridad a `criterioKellyApp/src/assets/anexos/` fue **descartada por el usuario** (T-04 de la v1 ya no aplica y esta versión no la planifica). |
| Depende de | HLT-01, HLT-02, HLT-03 y HLT-06 v1 ejecutados (código presente; verificado en T-26) |
| Lo consumen | HLT-05 v2 (pruebas con usuarios activados por el flujo real), HLT-07 v3, HLT-08 v2 (pantalla "verificar correo") |
| PHP | **8.2.35** (verificado con `C:\xampp\php\php.exe -v`) |
| Veredicto senior (H6) | **APROBADO** (ronda 3, ver H6) |

> **Referencias `ruta:línea`.** Todas se leyeron el 2026-11-07 sobre el código **posterior** a la ejecución de la v1 (rutas relativas a `rest_usuario/` salvo indicación). Si una tarea anterior de este mismo HLT desplaza líneas, el agente de implementación localiza el punto por el nombre del método o fragmento citado y anota la línea real en su ficha (H9).

---

## H1. Propósito

### Requerimiento literal

> Redactar las versiones nuevas de los HLT afectados, SIN sobrescribir los originales: `HLT-06-2026-11-02-claves-recuperacion-v2.md` (rest_usuario): `persona/agregar` deja al usuario en 'P', NO crea suscripción, y envía un código de verificación de un solo uso (reutiliza `EnviadorCorreo`, hashing de código, límites e infraestructura de recuperación de HLT-06; define si usa `sgen_recuperacion` con un campo de tipo o una tabla gemela y un script `seguridad_03_*.sql` idempotente + copia ya no se copia a la app: la copia a `criterioKellyApp/src/assets/anexos/` fue descartada por el usuario para scripts de seguridad, no la planifiques). Endpoint público `persona/activar { correo, codigo }` (pasa 'P'→'A', 5 intentos por código, 15 min, un solo uso, misma respuesta uniforme anti-enumeración, auditoría) y reenvío `persona/reenviarCodigo { correo }` con límite. Añade `persona/activar` y `persona/reenviarCodigo` a `RUTAS_PUBLICAS` de rest_usuario. Incorpora AJ-02 (`actualizarClave` con clave actual incorrecta → 400, nunca 401) y AJ-03 (misma normalización de clave que HLT-03).
>
> Decisión D-18 (plan maestro v2): *"`persona/agregar` envía un código de un solo uso al correo del usuario nuevo y un endpoint público `persona/activar { correo, codigo }` pasa el usuario de `P` a `A`. Reutiliza `EnviadorCorreo` y la infraestructura de HLT-06."*

### Propósito

Hoy ningún proceso saca a un usuario del estado `P` (pendiente): 15 de los 24 usuarios de la base local están en `P` y no pueden iniciar sesión (`ValidacionCtrl.php:59` exige `A`). Este HLT hace que el trader verifique que su correo es real con un código de un solo uso y se active solo, sin intervención del administrador, y cierra de paso los dos ajustes de claves (AJ-02, AJ-03) que el plan maestro pidió a HLT-06.

### Resultado esperado

- `persona/agregar` registra persona, usuario (`P`) y rol 4 y emite un código de verificación en la **misma transacción**; no escribe nada en tablas de suscripción.
- El código llega por correo (Mailpit o log en local), se guarda solo como hash Argon2id, vale 15 minutos, admite 5 intentos y un solo uso.
- `POST persona/activar { correo, codigo }` pasa el usuario de `P` a `A`; cualquier otro caso responde el mismo error. `POST persona/reenviarCodigo { correo }` emite un código nuevo con límites y respuesta uniforme.
- Ambas rutas son públicas (sin token) y quedan auditadas; el registro y el reenvío no permiten saber qué correos existen.
- Las cuentas que nunca se activan se depuran a los 7 días sin tocar a los usuarios `P` anteriores a este flujo.
- `actualizarClave` con la clave actual incorrecta responde 400 (nunca 401) y la normalización de la clave es idéntica en registro, cambio, restablecimiento y login (verificado con pruebas).
- Los contadores de fallos y de alertas comparan fechas de auditoría (UTC) con hora UTC (hallazgo F-01).

### Fuera de alcance

1. Crear la suscripción inicial: la crea la app tras el primer inicio de sesión (D-17, HLT-05 v2, HLT-07 v3). `rest_usuario` **no** escribe en `spsu_*`.
2. La pantalla "verificar correo", el reenvío desde la app y los mensajes al usuario: HLT-08 v2.
3. Copiar `seguridad_03_verificacion.sql` a `criterioKellyApp/src/assets/anexos/` (descartado por el usuario).
4. Cambiar el login para distinguir una cuenta `P` (el 401 genérico `Usuario o clave incorrectos` se mantiene, `ValidacionCtrl.php:59-61`; HLT-03).
5. Configurar el SMTP de producción (DH-10), el cron del servidor y el paquete de despliegue (HLT-11). **Sin SMTP real en producción nadie puede activarse**: HLT-11 no puede cerrarse sin DH-10 (riesgo R-02).
6. CAPTCHA o verificación humana en el registro.
7. Eliminar los usuarios semilla de `sist_genericoDatos.sql` (AJ-04, HLT-11).
8. Borrar físicamente cuentas, liberar nombres de usuario depurados o cambiar la unicidad del teléfono (Q-02 de la v1).
9. Cambiar `solicitarRecuperacion`, `restablecerClave` o `sgen_recuperacion` (D-23 de la v1 sigue: solo usuarios `A` recuperan clave).
10. Actualizar `rutas.txt` (desactualizado, bloqueado por E-02).

### Feature(s) afectada(s)

| Servicio | Recurso / artefacto |
|----------|---------------------|
| `rest_usuario` | `/persona` → `agregar` (cambia), `activar` (nuevo, público), `reenviarCodigo` (nuevo, público) |
| `rest_usuario` | `controladores/VerificacionCtrl.php` y `modelos/VerificacionMdl.php` (nuevos); `PersonaCtrl`, `PersonaMdl`, `PersonaRts`, `BaseCtrl`, `ClaveCtrl` (refactor de la espera), `ClaveMdl` y `AlertasSeguridadMdl` (F-01), `PlantillasCorreo`, `index.php` (`RUTAS_PUBLICAS`) |
| `rest_usuario` | `mantenimiento/limpiarSeguridad.php` (depuración) |
| `sist_criteriokelly` | Tabla nueva `sgen_verificacion` (script `anexos/seguridad_03_verificacion.sql`) |
| `rest_usuario`, `rest_criteriokelly`, `rest_suscripcion`, `rest_divisas` | `configuracion/RegistroAuditoria.php` (3 eventos nuevos, copias idénticas, §4.2) |

---

## H2. Reglas de negocio

Las RN-01…RN-27 de la v1 siguen vigentes. Esta versión **modifica** RN-17 (texto del registro, ver RN-32) y agrega las siguientes.

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-28 | El registro deja al usuario en `P` y sin suscripción | Tras un registro creado: `usu_situacion = 'P'`; `SELECT COUNT(*) FROM spsu_suscripcion WHERE sus_usuarioId = <id>` → 0; `grep -rn "spsu_" rest_usuario --include=*.php` → 0 líneas. | D-17, AJ-01 |
| RN-29 | El código nace con la cuenta | Persona, usuario, rol 4 y la fila `sgen_verificacion` (`ver_situacion = 'A'`, `ver_fechaExpira = NOW() + 15 min`) se insertan en **una** transacción; si falla cualquier inserción no queda ninguna fila de las cuatro. | D-18, C-05 |
| RN-30 | Código seguro | `sprintf('%06d', random_int(0, 999999))`; se guarda solo como Argon2id en `ver_codigoHash`; nunca aparece en respuestas HTTP, auditoría ni `error_log`. | RN-08 v1 |
| RN-31 | Envío después del commit | El correo se envía después de confirmar la transacción; un fallo de envío no revierte nada, se registra en `error_log` sin correo ni código y la respuesta HTTP no cambia. | D-39 |
| RN-32 | Registro uniforme | Para cuenta creada y para correo ya existente el cuerpo es exactamente `{"mensaje":"Registro recibido. Si los datos son válidos, recibirás un código en tu correo para activar tu cuenta."}` (200) y la respuesta tarda ≥ 2000 ms. Usuario o teléfono duplicado sigue siendo 409 (RN-17 v1). | RN-17 v1, D-40 |
| RN-33 | Activación | `persona/activar` pasa `usu_situacion` de `P` a `A` solo con un código `ver_situacion = 'A'`, `ver_fechaExpira > NOW()`, `ver_intentos < 5` y correcto, y lo marca `U` en la misma transacción. Cualquier otro caso → 400 `{"error":"Código inválido o vencido"}` con cuerpo idéntico: correo inexistente, usuario `A`/`S`/`E`, correo con más de una cuenta `P`, sin código vigente, incorrecto, vencido, usado o agotado. | D-18 |
| RN-34 | 5 intentos por código | Cada intento sobre un código vigente incrementa `ver_intentos` con un `UPDATE` condicional **antes** de comparar; con `ver_intentos = 5` el código correcto también falla. | RN-11 v1, D-20 v1 |
| RN-35 | Reenvío uniforme y limitado | `persona/reenviarCodigo` responde 200 `{"mensaje":"Si el correo está pendiente de verificación, recibirás un código en unos minutos."}` para cualquier correo con formato válido y tarda ≥ 2000 ms. Solo emite código si hay exactamente 1 usuario `P` activo con ese correo y se cumplen: ≤ 3 códigos en 1 hora, ≤ 10 en 24 h y ≥ 60 s desde el último; si no, misma respuesta sin código ni correo. | RN-10 v1 |
| RN-36 | Tope por IP | Con ≥ 10 filas de `sgen_verificacion` creadas desde la misma IP en la última hora, `persona/agregar` (tras validar la entrada y antes de tocar la base de duplicados) y `persona/reenviarCodigo` responden 429 `{"error":"Demasiados intentos, intente nuevamente más tarde"}` con `Retry-After: 3600`. El resultado depende solo de la IP, nunca del correo. | D-42 |
| RN-37 | Códigos no intercambiables | Un código de `sgen_verificacion` no restablece claves y uno de `sgen_recuperacion` no activa cuentas: tablas distintas y consultas sin mezcla; `solicitarRecuperacion` sigue sin enviar nada a usuarios `P` (D-23 v1). | D-35 |
| RN-38 | Cuentas que no se activan | El mantenimiento marca `usu_situacion = 'E'`, `usu_estado = '0'` y `per_estado = '0'` a los usuarios `P` con al menos una fila en `sgen_verificacion`, sin ninguna creada en los últimos 7 días y con `per_fechaRegis` de hace más de 7 días. Los usuarios `P` sin filas en `sgen_verificacion` (anteriores a este flujo) no se tocan. Las filas de `sgen_verificacion` de usuarios que ya no son `P` se borran a los 7 días. | D-46 |
| RN-39 | Auditoría | `persona/agregar` creado o con correo existente y `reenviarCodigo` auditan `ACTIVACION_SOLICITADA` (id de usuario o `null`); `activar` exitoso audita `CUENTA_ACTIVADA`; cada `activar` fallido audita `ACTIVACION_FALLIDA` (id o `null`). Ningún registro guarda códigos, hashes ni claves. Los 3 eventos están en `RegistroAuditoria::EVENTOS` de las 4 copias, que siguen siendo idénticas (`md5sum` igual). | RN-22 v1, D-45 |
| RN-40 | Rutas públicas | `RUTAS_PUBLICAS` de `rest_usuario/index.php` contiene `persona/activar` y `persona/reenviarCodigo` y el resto de `/persona` sigue exigiendo token (`persona/actualizarDeApp` sin token → 401). Ambas siguen sujetas al límite público de 60 peticiones/min por IP. | D-18 |
| RN-41 | Campos permitidos | `activar`: `[correo, codigo]`; `reenviarCodigo`: `[correo]`; ambos `string`; extra o ausente → 400 `Solicitud inválida`; correo con formato inválido o > 64 → 400 `El correo no es válido`; código que no cumple `^[0-9]{6}$` → 400 `El código debe tener 6 dígitos`. | RN-21 v1 |
| RN-42 | AJ-02 | En `ClaveCtrl::actualizarClave` la clave actual incorrecta responde **400** `{"error":"La clave actual no es correcta"}` y ningún camino del método devuelve 401; el 401 solo lo emite `ValidadorSesion`. | AJ-02, D-16 v1 |
| RN-43 | AJ-03 | Registro, restablecimiento y cambio hashean la clave **cruda** (`HashClaves::hashear`) y el login la verifica cruda (`ValidacionCtrl.php:52,58`); `htmlspecialchars(trim())` solo existe como respaldo de verificación para hashes anteriores (`HashClaves.php:25-30`). Una clave con espacios en los extremos y símbolos `& < > " '` se registra, se activa e inicia sesión con exactamente el mismo texto. | AJ-03, D-14 v1 |
| RN-44 | Ventanas de fechas de auditoría | `aud_fecha` se escribe en UTC (`RegistroAuditoria.php`: `gmdate`); toda comparación con ella usa `UTC_TIMESTAMP()`. La ventana de 15 min de `actualizarClave` y la de 60 min de la alerta cuentan solo eventos de esos 15 y 60 minutos. | F-01 |
| RN-45 | Espera uniforme compartida | `BaseCtrl::esperarTiempoMinimo` (2000 ms + `random_int(0, 250)` ms) la usan `ClaveCtrl`, `PersonaCtrl` y `VerificacionCtrl`; `ClaveCtrl` deja de tener su copia privada. | RD-2, D-52 |

---

## H3. Flujo principal de ejecución

Todas las peticiones siguen `.htaccess` → `index.php` (`Enrutador`, `ValidadorSesion::exigir()` salvo ruta pública, `LimitadorPeticiones::controlar()`, `index.php:73-76`) → `rutas/PersonaRts.php` → `Ctrl` → `Mdl` → `Enlace` → MySQL. Las ramas comunes (400 de `LectorSolicitud`, 401, 404 del `Enrutador`, 405, 429 general, 500 de `ManejadorErrores`) aplican a todos los flujos y no se repiten.

### Flujo D2 · `POST persona/agregar` (público) — reemplaza al Flujo D de la v1

```
[App: registro { cedula?, nombres, apellidos, correo, telefono, usuario, clave }]
 → index.php (pública; 60/min por IP) → PersonaRts case 'POST' → PersonaCtrl::agregarPersona($datos)
   1. $inicio = hrtime(true)
   2. Campos permitidos y validaciones de campo: SIN CAMBIOS (PersonaCtrl.php:62-96); PoliticaClaves::validar (:97-100) → 400
   3. VerificacionMdl::contarCodigosPorIp(ClienteIp::obtener()) >= 10
        └─ Retry-After: 3600 + 429 (sin espera mínima: no depende del correo)
   4. $hashClave = HashClaves::hashear($clave); $codigo = sprintf('%06d', random_int(0, 999999)); $hashCodigo = HashClaves::hashear($codigo)   ← en cada camino
   5. PersonaMdl::registrarPersona(..., $hashClave, $hashCodigo, ip, agente) → ['resultado', 'idUsuario']   ← transacción:
        a. usuario o teléfono existentes → rollback → USUARIO_O_TELEFONO_DUPLICADO
        b. correo existente (cualquier situación) → rollback → CORREO_EXISTENTE
        c. INSERT persona, usuario ('P' por defecto de la columna), rolusuario (rol 4), sgen_verificacion (código 'A') → commit → CREADO
        d. mysqli 1062 → rollback → USUARIO_O_TELEFONO_DUPLICADO
   6. ├─ USUARIO_O_TELEFONO_DUPLICADO → 409 {"error":"El nombre de usuario o el teléfono ya están registrados"} (sin espera mínima, como hoy)
      ├─ CREADO → try { EnviadorCorreo::enviar(correo, PlantillasCorreo::codigoVerificacion(nombres, $codigo)) } catch (Throwable) → error_log sin datos
      │           RegistroAuditoria ACTIVACION_SOLICITADA (idUsuario)
      └─ CORREO_EXISTENTE → sin correo; RegistroAuditoria ACTIVACION_SOLICITADA (null)
   7. esperarTiempoMinimo($inicio); 200 {"mensaje":"Registro recibido. Si los datos son válidos, recibirás un código en tu correo para activar tu cuenta."}
```

### Flujo G · `POST persona/activar` (público)

```
[App: pantalla "verificar correo" → { correo, codigo }]
 → index.php (pública) → PersonaRts case 'POST' accion 'activar' → VerificacionCtrl::activarCuenta($datos)
   1. exigirCamposPermitidos([correo, codigo]); ambos string
        ├─ correo > 64 o FILTER_VALIDATE_EMAIL falla → 400 "El correo no es válido"
        └─ codigo !~ ^[0-9]{6}$ → 400 "El código debe tener 6 dígitos"
   2. $correo = limpiarDatos (mismo formato con que se guardó per_correo)
   3. VerificacionMdl::buscarUsuarioPendientePorCorreo($correo) → count != 1
        └─ password_verify($codigo, HashClaves::HASH_FICTICIO); auditoría ACTIVACION_FALLIDA (null); 400 "Código inválido o vencido"
   4. $activo = buscarCodigoActivo(idUsuario); si null o !consumirIntento(idVerificacion)
        └─ password_verify(HASH_FICTICIO); auditoría ACTIVACION_FALLIDA (idUsuario); 400 "Código inválido o vencido"
   5. !password_verify($codigo, ver_codigoHash) → auditoría ACTIVACION_FALLIDA (idUsuario); 400 "Código inválido o vencido"
   6. VerificacionMdl::activarCuenta(idUsuario, idVerificacion, ip)   ← transacción:
        UPDATE ver → 'U' WHERE situacion='A' AND no vencido (0 filas → rollback → false)
        UPDATE sgen_usuario SET usu_situacion='A' WHERE usu_situacion='P' AND usu_estado='1' (0 filas → rollback → false)
        UPDATE otros códigos 'A' → 'R'
        └─ false → auditoría ACTIVACION_FALLIDA; 400 "Código inválido o vencido"
   7. RegistroAuditoria CUENTA_ACTIVADA (idUsuario); 200 {"success":"ok"}   ← no emite tokens: la app lleva al login
   └─ Throwable → error_log("[VerificacionCtrl::activarCuenta] …") + 500 "Error interno del servidor"
```

### Flujo H · `POST persona/reenviarCodigo` (público)

```
[App: botón "Reenviar código" → { correo }]
 → index.php (pública) → PersonaRts case 'POST' accion 'reenviarCodigo' → VerificacionCtrl::reenviarCodigo($datos)
   1. $inicio = hrtime(true); campos permitidos [correo]; correo inválido → 400 "El correo no es válido" (sin espera)
   2. contarCodigosPorIp(ClienteIp::obtener()) >= 10 → Retry-After: 3600 + 429 (sin espera; depende solo de la IP)
   3. $correo = limpiarDatos; $usuarios = buscarUsuarioPendientePorCorreo($correo); $codigo y $hashCodigo (Argon2id) en ambos caminos
   4. Si count == 1: try { if (emitirCodigoReenvio(idUsuario, $hashCodigo, ip, agente)) { EnviadorCorreo::enviar(...codigoVerificacion) } } catch (Throwable) → error_log sin datos
      Si count > 1: error_log('[VerificacionCtrl::reenviarCodigo] correo con varias cuentas pendientes'); nada
   5. RegistroAuditoria ACTIVACION_SOLICITADA (idUsuario o null)
   6. esperarTiempoMinimo($inicio); 200 {"mensaje":"Si el correo está pendiente de verificación, recibirás un código en unos minutos."}
```

### Flujo I · Mantenimiento (CLI, `mantenimiento/limpiarSeguridad.php`)

```
[cron / a mano: php rest_usuario/mantenimiento/limpiarSeguridad.php]
 → (limpiezas existentes) → VerificacionMdl::depurarCuentasSinVerificar()   (RN-38; primero las cuentas)
 → VerificacionMdl::depurarVerificacionesAntiguas()                          (después las filas)
 → línea de salida existente + " pendientes=<n> verificaciones=<n>"
```

### Flujo E2 · `PUT autenticacion/actualizarClave` (AJ-02) — sin cambio de código

Verificado en `ClaveCtrl.php:163-167`: `claveActual` incorrecta → auditoría `LOGIN_FALLIDO` + `respuestaErrorSimple('La clave actual no es correcta', 400)`. Con el límite de fallos (`:159-162`) responde 429. T-40 lo comprueba con `curl`.

### Ramas de error en la app

El `errorInterceptor` (`criterioKellyApp/src/app/compartidos/interceptors/error.interceptor.ts:26-27`) muestra `error.error.error`; 429 usa `Retry-After` (`:24-25`, `:65-84`); 409 sin mensaje cae en `:45-47`; el 422 no se usa (RN-27 v1). La adaptación de la app es HLT-08 v2.

---

## H4. Calidad del HLT y cobertura

### 4.1 Matriz de cobertura

| Requerimiento / RN | Tarea(s) | Prueba / verificación |
|--------------------|----------|-----------------------|
| `persona/agregar` deja usuario en `P`, sin suscripción · RN-28 | T-32, T-33, T-39 | P-22, P-37 |
| Código de verificación de un solo uso al registrarse · RN-29, RN-30, RN-31 | T-27, T-30, T-31, T-32, T-33 | P-22, P-24 |
| Reutiliza `EnviadorCorreo`, hashing, límites e infraestructura de recuperación · D-35…D-42 | T-29, T-30, T-31, T-33, T-34, T-35 | Revisión de código (H8 RI-14); P-22 |
| Tabla: campo de tipo o gemela + script `seguridad_03_*.sql` idempotente · D-35, D-36 | T-27 | Aplicar dos veces; `SHOW CREATE TABLE sgen_verificacion` |
| Sin copia del SQL a la app | — (descartado) | `git -C criterioKellyApp status` sin archivos nuevos de este HLT |
| `persona/activar` (5 intentos, 15 min, un solo uso, uniforme, auditoría) · RN-33, RN-34, RN-39, RN-41 | T-31, T-34, T-36, T-39 | P-24 a P-28, P-33 a P-35 |
| `persona/reenviarCodigo` con límite · RN-35, RN-36 | T-31, T-35, T-36, T-39 | P-29 a P-31 |
| Rutas en `RUTAS_PUBLICAS` · RN-40 | T-36 | P-42 |
| Anti-enumeración (registro, activar, reenvío) · RN-32, RN-33, RN-35, RN-36 | T-33, T-34, T-35 | P-23, P-27, P-29, P-31 |
| Códigos no intercambiables con recuperación · RN-37 | T-31, T-34 | P-32 |
| Cuentas que no se activan · RN-38 | T-31, T-38 | P-36 |
| Auditoría y eventos en 4 copias · RN-39 | T-28, T-33, T-34, T-35 | P-22, P-24, P-25; `md5sum` ×4 (T-41) |
| AJ-02 · RN-42 | T-26, T-40 | P-38 |
| AJ-03 · RN-43 | T-26, T-40 | P-39 |
| F-01 ventanas UTC · RN-44 | T-37, T-40 | P-40 |
| Espera uniforme compartida · RN-45 | T-29, T-33, T-35 | P-02 de la v1 (regresión) y P-23 |
| Regresión de la v1 | T-40 | P-01, P-02, P-06 de la v1 |
| Documentación | T-42 | Revisión del README |
| Precondiciones y estado real | T-26 | Fichas de T-26 |

### 4.2 Checklist de calidad del HLT

- ✅ Las 11 secciones existen y están completas.
- ✅ Sin marcadores pendientes.
- ✅ Cada RN mapea a ≥ 1 tarea (cobertura 100 %).
- ✅ Cada tarea tiene criterio de aceptación verificable y ficha de checks (H9).
- ✅ No contradice §0.5 del contrato (no toca Angular) ni el plan maestro v2 (D-17, D-18, AJ-01 a AJ-03).
- ✅ Referencias `ruta:línea` leídas el 2026-11-07 sobre el código ya ejecutado.
- ✅ Decisiones cerradas (H5) sin ambigüedad.

---

## H5. Reglas cerradas de decisión del HLT

### 5.1 Decisiones (continúan la numeración de la v1: D-01…D-34)

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | Irreversible? |
|----|----------|-----------------------|----------------|---------------|---------------|
| D-35 | Almacén del código de verificación | A `sgen_recuperacion` con columna `rec_tipo` · B tabla gemela `sgen_verificacion` | **B** | A obliga a tocar las 9 consultas existentes de recuperación (`ClaveMdl.php:43-44,58,80,90,99,101`, `AlertasSeguridadMdl.php:37`, `invalidarCodigosActivos`) para filtrar por tipo; olvidar un filtro permitiría usar un código de verificación para restablecer una clave o viceversa. B hace imposible el cruce por construcción, no altera código ya ejecutado y mantiene límites independientes (RD-7). Costo: una tabla y un modelo con estructura parecida. | No (esquema nuevo, sin borrar nada) |
| D-36 | Script SQL | A cambiar `seguridad_02` · B `anexos/seguridad_03_verificacion.sql` idempotente con `CREATE TABLE IF NOT EXISTS` | **B**, cabecera "aplicar después de `seguridad_02_recuperacion.sql`". Sin copia a `criterioKellyApp` (descartada por el usuario). Se aplica como `root` (el usuario `ck_aplicacion` no tiene `CREATE`, `anexos/seguridad_00_usuario_mysql.sql:24`); los privilegios del esquema ya cubren la tabla nueva. | No modifica el script ya aplicado; idempotente como pide la v1 (D-24). | No |
| D-37 | Ubicación de los endpoints | A `/autenticacion` · B `/persona` con controlador nuevo | **B**: `persona/activar` y `persona/reenviarCodigo` en `PersonaRts`, lógica en `VerificacionCtrl` + `VerificacionMdl` | Lo pide el plan maestro (D-18). Responsabilidad única (D-02 v1): `PersonaCtrl` registra, `VerificacionCtrl` verifica. | No |
| D-38 | Atomicidad registro + código | A registrar y luego insertar el código en otra operación · B insertar el código dentro de la transacción de `registrarPersona` | **B**: `PersonaMdl` crea un `VerificacionMdl` con **el mismo `Enlace`** y llama `insertarCodigoEnTransaccion` | Sin usuario huérfano sin código (RN-29). `registrarPersona` devuelve `['resultado', 'idUsuario']` (el controlador necesita el id para la auditoría). | No |
| D-39 | Momento del envío | A dentro de la transacción · B después del commit | **B** con `try/catch` | SMTP lento (hasta 5 s, `EnviadorCorreo.php` `Timeout`) dentro de una transacción retiene bloqueos de `sgen_persona`/`sgen_usuario`. Si el envío falla, el usuario usa `reenviarCodigo`. | No |
| D-40 | Igualar tiempos del registro | A sin igualar · B espera mínima en `CREADO` y `CORREO_EXISTENTE` + dos hashes Argon2id (clave y código) en ambos | **B** | Ahora `CREADO` envía correo y `CORREO_EXISTENTE` no: sin espera mínima la diferencia de tiempo confirma si un correo existe. El 409 de usuario/teléfono no se iguala (ya es distinguible por diseño, D-06 v1). Si el SMTP real supera 2 s se reabre la fuga (R-03). | No |
| D-41 | Textos | — | Los de 5.5 | Cerrados para que HLT-08 v2 los use y para las pruebas. | No (contrato) |
| D-42 | Límites contra spam de correo y fuerza bruta | A solo el límite público 60/min por IP · B por usuario (3/h, 10/24 h, 60 s entre envíos) + por IP (10 códigos/h → 429) | **B** | Por usuario acota el correo a la víctima (≤ 10/día) y los intentos a ≤ 50/día (≈ 5 × 10); con 10⁶ combinaciones es ≈ 0,005 %/día. Por IP acota el uso del servidor como relé de correo y el crecimiento de filas `P` a 10/h por IP. El 429 por IP no revela correos porque depende solo de la IP. | No |
| D-43 | Quién puede pedir un código de verificación | A cualquier usuario · B solo `P` | **B** (`buscarUsuarioPendientePorCorreo`: `usu_situacion = 'P'`, `usu_estado = '1'`, `per_estado = '1'`, `per_situacion = 'A'`) | Un usuario `A`, `S` (suspendido) o `E` nunca se reactiva por correo. Un usuario `P` anterior a este flujo también puede activarse (R-06). | No |
| D-44 | Camino sin código vigente | A responder rápido · B `password_verify` contra `HashClaves::HASH_FICTICIO` | **B** | Igual que `restablecerClave` (`ClaveCtrl.php:104,110`): un Argon2id en todos los caminos de fallo. | No |
| D-45 | Eventos de auditoría | A reutilizar `RECUPERACION_SOLICITADA` · B eventos propios | **B**: `ACTIVACION_SOLICITADA` (21 car.), `CUENTA_ACTIVADA` (15), `ACTIVACION_FALLIDA` (18), todos ≤ 24 (`aud_evento VARCHAR(24)`). Se agregan a `RegistroAuditoria::EVENTOS` en las **4 copias**, que hoy son idénticas (md5 `1d8933e00241ab3962cf3493e15f262e`) | Mezclar eventos ensuciaría la alerta y las consultas de recuperación. §4.2 exige copias idénticas. Se audita siempre (también con correo desconocido) para no crear una diferencia de tiempo. | No |
| D-46 | Cuentas que no se activan | A dejarlas · B borrado físico · C baja lógica a los 7 días | **C** (RN-38). Libera el correo (`per_estado = '0'`) y el teléfono, pero el nombre de usuario queda ocupado por el índice único `sgen_usuario_idx` (aceptado, Baja). Solo toca cuentas con filas de verificación: los `P` anteriores no se tocan | El borrado físico choca con claves foráneas sin cascada (`sgen_rolusuario`, `sgen_verificacion`: NO ACTION). Sin depuración, un atacante ocuparía correos ajenos para siempre (R-04). | No |
| D-47 | Login de una cuenta `P` | A mensaje distinto · B mantener el 401 genérico | **B** | Cambiar el login es de HLT-03 y el mensaje distinto revelaría estado a quien conozca la clave. La app ofrece el enlace "Verificar correo" (HLT-08 v2). | No |
| D-48 | Texto del error de AJ-02 | A `Clave actual incorrecta` (texto del plan maestro) · B conservar `La clave actual no es correcta` | **B** | Ya ejecutado, probado (P-09b de la v1) y consumido por el toast de la app; el plan maestro describe el efecto (400, nunca 401), no un texto literal. Sin cambio de código. | No |
| D-49 | Normalización de claves (AJ-03) | A cambiar el login · B dejarlo y comprobarlo | **B** | Verificado: login (`ValidacionCtrl.php:52,58`), registro (`PersonaCtrl.php:73,108`), restablecimiento (`ClaveCtrl.php:127`) y cambio (`ClaveCtrl.php:179`) usan la clave cruda con el mismo `HashClaves`. Cambiarlo exigiría migración (riesgo R-03 de HLT-03). | No |
| D-50 | F-01: ventana de fechas | A dejar `NOW()` · B `UTC_TIMESTAMP()` | **B** en `ClaveMdl.php:156` y `AlertasSeguridadMdl.php:17` | Hallazgo verificado: `aud_fecha` es UTC (12:34) y `NOW()` es hora local (07:34) → hoy ambas ventanas cuentan ≈ 5 h 15 min en vez de 15 y 60 min. Solo cambia la comparación; no hay datos que migrar. Las tablas nuevas usan `NOW()` en lectura y escritura (misma zona). | No |
| D-51 | Códigos HTTP | — | 200 en todo éxito; 400 de formato y de código inválido; 409 solo usuario/teléfono; 429 solo por IP (o el general); nunca 422 | `respuestaExitosaSimple` solo emite 200; 422 reservado (RN-27 v1). | No |
| D-52 | Espera uniforme | A duplicarla en cada controlador · B mover `esperarTiempoMinimo` y `obtenerAgente` a `BaseCtrl` | **B** (RD-2) | Tres controladores los usan; `ClaveCtrl` pierde sus copias privadas (`ClaveCtrl.php:17-18,190-197,208-212`). | No |
| D-53 | Activar no inicia sesión | A emitir tokens al activar · B solo `{"success":"ok"}` | **B** | El usuario inicia sesión con el login normal (límites, auditoría y rehash intactos). | No |
| D-54 | Código en el login | A exigirlo · B no | **B** | La verificación prueba control del correo; la clave sigue siendo el único factor de sesión. | No |

### 5.2 Interfaz requerida (IR) del código ya existente

Verificada en T-26 con `grep`; **no hay mapeo de nombres**: todo existe tal cual se cita.

| ID | Capacidad | Nombre y ubicación |
|----|-----------|--------------------|
| IR-v2-01 | Transacciones y filas afectadas | `Enlace::iniciarTransaccion/confirmarTransaccion/revertirTransaccion`, `ejecutarActualizacion` (filas afectadas), `ejecutarConsultaSimpleFila`, `ejecutarInsercionRetornaID` (`configuracion/enlace.php`) |
| IR-v2-02 | Auditoría | `RegistroAuditoria::registrar(string $evento, ?int $idUsuario = null, ?string $familia = null, string $detalle = '')` (`configuracion/RegistroAuditoria.php:15`), lista blanca `EVENTOS` (`:8-12`) |
| IR-v2-03 | IP y agente | `ClienteIp::obtener()` (`configuracion/ClienteIp.php:9`); `ClaveCtrl::obtenerAgente()` (`ClaveCtrl.php:208-212`, privado: T-29 lo mueve a `BaseCtrl` como `protected`, ver 5.4) |
| IR-v2-04 | Correo | `EnviadorCorreo::enviar(string, array): void` (`servicios/EnviadorCorreo.php:13`); `PlantillasCorreo` (`servicios/PlantillasCorreo.php`) |
| IR-v2-05 | Hash | `HashClaves::hashear`, `HASH_FICTICIO`, `verificar` (`servicios/HashClaves.php:13,15,25`) |
| IR-v2-06 | Rutas | `RUTAS_PUBLICAS` (`index.php:29-35`); `PersonaRts` despacha por `$metodo` y `$accion` (`rutas/PersonaRts.php:14-24`); el `Enrutador` no tiene lista de acciones (`configuracion/Enrutador.php:53-72`) |
| IR-v2-07 | Base de datos | `usu_situacion` por defecto `'P'` (`anexos/sist_generico.sql:83`), `per_situacion` por defecto `'A'` (`:40`), `per_fechaRegis` (`:38`); clave única `sgen_usuario_idx` sobre `usu_usuario`; FK `NO ACTION` de `sgen_rolusuario` y `sgen_recuperacion` hacia `sgen_usuario` |

### 5.3 Esquema de `sgen_verificacion` (cerrado)

```sql
-- HLT-06 v2 (D-18). Aplicar después de seguridad_02_recuperacion.sql sobre sist_criteriokelly, como root.
-- Idempotente y compatible con MariaDB 10.4 y MySQL 8.
CREATE TABLE IF NOT EXISTS `sgen_verificacion` (
  `ver_idVerificacion` int(11) NOT NULL AUTO_INCREMENT,
  `ver_usuId` int(11) NOT NULL COMMENT 'sgen_usuario.usu_idUsuario',
  `ver_codigoHash` varchar(255) NOT NULL COMMENT 'Argon2id del código de 6 dígitos; nunca el código',
  `ver_fechaCrea` datetime NOT NULL DEFAULT current_timestamp(),
  `ver_fechaExpira` datetime NOT NULL COMMENT 'ver_fechaCrea + 15 minutos',
  `ver_intentos` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Máximo 5',
  `ver_situacion` char(1) NOT NULL DEFAULT 'A' COMMENT 'A Activo; U Usado; R Reemplazado',
  `ver_fechaUso` datetime DEFAULT NULL,
  `ver_ipSolicitud` varchar(45) NOT NULL,
  `ver_agenteSolicitud` varchar(255) DEFAULT NULL,
  `ver_ipUso` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`ver_idVerificacion`),
  KEY `idx_ver_usuario_fecha` (`ver_usuId`, `ver_fechaCrea`),
  KEY `idx_ver_ip_fecha` (`ver_ipSolicitud`, `ver_fechaCrea`),
  KEY `idx_ver_expira` (`ver_fechaExpira`),
  CONSTRAINT `sgen_usuario_sgen_verificacion_fk` FOREIGN KEY (`ver_usuId`)
    REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

Todas las fechas se calculan en MySQL con `NOW()` (`ver_fechaExpira = NOW() + INTERVAL 15 MINUTE`), como `sgen_recuperacion` (RI-13 de la v1).

### 5.4 Firmas cerradas

| Archivo | Firma | Comportamiento |
|---------|-------|----------------|
| `modelos/VerificacionMdl.php` (nuevo) | `class VerificacionMdl` · `public const MAXIMO_SOLICITUDES_HORA = 3` · `MAXIMO_SOLICITUDES_DIA = 10` · `MAXIMO_INTENTOS = 5` · `MINUTOS_VIGENCIA = 15` · `SEGUNDOS_ENTRE_ENVIOS = 60` · `MAXIMO_CODIGOS_POR_IP_HORA = 10` · `DIAS_RETENCION_PENDIENTES = 7` · `__construct(private Enlace $conexion)` | Misma forma que `ClaveMdl`. Columnas explícitas, nunca `SELECT *`. |
| ↳ | `buscarUsuarioPendientePorCorreo(string $correo): array` | `SELECT u.usu_idUsuario, u.usu_usuario, p.per_nombres, p.per_correo FROM sgen_usuario u INNER JOIN sgen_persona p ON p.per_idPersona = u.usu_perIdPerso WHERE p.per_correo = ? AND p.per_estado = '1' AND p.per_situacion = 'A' AND u.usu_estado = '1' AND u.usu_situacion = 'P' LIMIT 2` |
| ↳ | `contarCodigosPorIp(string $ip): int` | `SELECT COUNT(*) AS total FROM sgen_verificacion WHERE ver_ipSolicitud = ? AND ver_fechaCrea >= NOW() - INTERVAL 1 HOUR` |
| ↳ | `insertarCodigoEnTransaccion(int $idUsuario, string $hashCodigo, string $ip, ?string $agente): void` | `INSERT INTO sgen_verificacion (ver_usuId, ver_codigoHash, ver_fechaExpira, ver_ipSolicitud, ver_agenteSolicitud) VALUES (?, ?, NOW() + INTERVAL 15 MINUTE, ?, ?)`. **No abre transacción**: la abre el llamador (`PersonaMdl`). |
| ↳ | `emitirCodigoReenvio(int $idUsuario, string $hashCodigo, string $ip, ?string $agente): bool` | Transacción con `try/catch (Throwable)` y relanzado: `SELECT usu_idUsuario FROM sgen_usuario WHERE usu_idUsuario = ? AND usu_situacion = 'P' AND usu_estado = '1' FOR UPDATE` (nulo → confirma y `false`); `SELECT SUM(ver_fechaCrea >= NOW() - INTERVAL 1 HOUR) AS solicitudesHora, SUM(ver_fechaCrea >= NOW() - INTERVAL 1 DAY) AS solicitudesDia, MAX(ver_fechaCrea >= NOW() - INTERVAL 60 SECOND) AS reciente FROM sgen_verificacion WHERE ver_usuId = ?`; si `solicitudesHora >= 3`, `solicitudesDia >= 10` o `reciente = 1` (los `NULL` cuentan 0) → confirma y `false`; `UPDATE … SET ver_situacion = 'R' WHERE ver_usuId = ? AND ver_situacion = 'A'`; inserta con `insertarCodigoEnTransaccion`; confirma y `true`. |
| ↳ | `buscarCodigoActivo(int $idUsuario): ?array` | `SELECT ver_idVerificacion, ver_codigoHash, ver_intentos FROM sgen_verificacion WHERE ver_usuId = ? AND ver_situacion = 'A' AND ver_fechaExpira > NOW() AND ver_intentos < 5 ORDER BY ver_idVerificacion DESC LIMIT 1` |
| ↳ | `consumirIntento(int $idVerificacion): bool` | `UPDATE sgen_verificacion SET ver_intentos = ver_intentos + 1 WHERE ver_idVerificacion = ? AND ver_situacion = 'A' AND ver_fechaExpira > NOW() AND ver_intentos < 5`; `true` si afectó exactamente 1 fila. |
| ↳ | `activarCuenta(int $idUsuario, int $idVerificacion, string $ip): bool` | Flujo G paso 6; `false` con rollback si algún `UPDATE` condicional no afecta exactamente 1 fila; excepción → rollback y relanzado. El `UPDATE` de uso lleva `AND ver_intentos <= 5` como `ClaveMdl::restablecerClave`. |
| ↳ | `depurarCuentasSinVerificar(): int` | `UPDATE sgen_usuario u INNER JOIN sgen_persona p ON p.per_idPersona = u.usu_perIdPerso SET u.usu_situacion = 'E', u.usu_estado = '0', p.per_estado = '0' WHERE u.usu_situacion = 'P' AND u.usu_estado = '1' AND p.per_fechaRegis < NOW() - INTERVAL 7 DAY AND EXISTS (SELECT 1 FROM sgen_verificacion v WHERE v.ver_usuId = u.usu_idUsuario) AND NOT EXISTS (SELECT 1 FROM sgen_verificacion w WHERE w.ver_usuId = u.usu_idUsuario AND w.ver_fechaCrea >= NOW() - INTERVAL 7 DAY)`; devuelve filas afectadas del usuario. |
| ↳ | `depurarVerificacionesAntiguas(): int` | `DELETE v FROM sgen_verificacion v INNER JOIN sgen_usuario u ON u.usu_idUsuario = v.ver_usuId WHERE v.ver_fechaCrea < NOW() - INTERVAL 7 DAY AND u.usu_situacion <> 'P'`; devuelve filas borradas. |
| `controladores/VerificacionCtrl.php` (nuevo) | `class VerificacionCtrl extends BaseCtrl` · `__construct()` crea `Enlace`, `VerificacionMdl`, `RegistroAuditoria(…, SERVICIO_ACTUAL)`, `EnviadorCorreo` · `activarCuenta(array $datos): void` · `reenviarCodigo(array $datos): void` (usa `obtenerAgente()` heredado de `BaseCtrl`) | Flujos G y H. Cada método público termina en `catch (Throwable)` con `error_log("[VerificacionCtrl::<metodo>] " . $e->getMessage())` y 500 `Error interno del servidor` (RI-6 de la v1). |
| `modelos/PersonaMdl.php` | `registrarPersona(?string $cedula, string $nombres, string $apellidos, string $correo, string $telefono, string $usuario, string $hashClave, string $hashCodigo, string $ip, ?string $agente): array` (devuelve `['resultado' => string, 'idUsuario' => ?int]`); el constructor conserva `private Enlace $conexion` y crea `$this->verificacionModelo = new VerificacionMdl($conexion)` | Flujo D2 paso 5c. Constantes `REGISTRO_*` sin cambios. |
| `controladores/PersonaCtrl.php` | `private VerificacionMdl $verificacionModelo`, `private EnviadorCorreo $enviador`, `private RegistroAuditoria $auditoria` creados en el constructor con un solo `Enlace` compartido con `PersonaMdl` (usa `obtenerAgente()` heredado de `BaseCtrl`) | Flujo D2. |
| `controladores/BaseCtrl.php` | `protected const TIEMPO_MINIMO_RESPUESTA_MS = 2000` · `protected const VARIACION_MAXIMA_MS = 250` · `protected function esperarTiempoMinimo(int $inicio): void` · `protected function obtenerAgente(): ?string` | Mueve sin cambiar la lógica de `ClaveCtrl.php:190-197` y `:208-212`. |
| `servicios/PlantillasCorreo.php` | `public static function codigoVerificacion(string $nombres, string $codigo): array` | Texto de 5.5; `$nombres` pasa por `html_entity_decode(..., ENT_QUOTES, 'UTF-8')`. |
| `configuracion/RegistroAuditoria.php` (×4) | `EVENTOS` + `'ACTIVACION_SOLICITADA', 'CUENTA_ACTIVADA', 'ACTIVACION_FALLIDA'` al final de la lista | Las 4 copias quedan con el mismo `md5sum`. |

### 5.5 Textos cerrados

| Uso | Texto |
|-----|-------|
| Registro (200, creado o correo existente) | `Registro recibido. Si los datos son válidos, recibirás un código en tu correo para activar tu cuenta.` |
| Reenvío (200) | `Si el correo está pendiente de verificación, recibirás un código en unos minutos.` |
| Activación correcta (200) | `{"success":"ok"}` |
| Código inválido o vencido (400) | `Código inválido o vencido` |
| Límite por IP (429, `Retry-After: 3600`) | `Demasiados intentos, intente nuevamente más tarde` |
| Asunto del correo | `Código para activar tu cuenta - Criterio Kelly` |
| Cuerpo del correo | `Hola {nombres}:\n\nTu código para activar tu cuenta es: {codigo}\n\nVence en 15 minutos y solo se puede usar una vez. Si no creaste una cuenta en Criterio Kelly, ignora este correo: nadie podrá usarla sin este código.\n\nEste es un mensaje automático, no respondas a este correo.` |

### 5.6 Cambios de contrato para HLT-08 v2 (app)

| # | Endpoint | Antes (verificado) | Después (este HLT) | Qué debe cambiar HLT-08 v2 |
|---|----------|--------------------|--------------------|----------------------------|
| CC-HLT08-7 | `POST persona/agregar` | 200 `{ mensaje: 'Registro recibido. Podrás iniciar sesión cuando tu cuenta esté activa.' }` (`PersonaCtrl.php:113-115`) | 200 `{ mensaje }` con el texto de 5.5 (cuenta creada **o** correo existente); 409 usuario/teléfono; 400 de política; **429** con `Retry-After: 3600` (tope por IP); tarda ≥ 2 s | La app no depende del texto; lleva a "verificar correo" y muestra el `mensaje`; 409 sugiere "¿Ya te registraste? Verifica tu correo". |
| CC-HLT08-8 | `POST persona/activar` (nuevo, público) | — | `{ correo, codigo }` → 200 `{ success: 'ok' }`; 400 `Código inválido o vencido`, `El código debe tener 6 dígitos`, `El correo no es válido`, `Solicitud inválida`; 429 general | Pantalla de verificación; tras 200 lleva al login (no hay sesión). |
| CC-HLT08-9 | `POST persona/reenviarCodigo` (nuevo, público) | — | `{ correo }` → 200 `{ mensaje }` siempre (≈ 2 s); 400 `El correo no es válido`; 429 con `Retry-After: 3600` (IP) | Botón "Reenviar código" con espera de 60 s en la interfaz. |
| CC-HLT08-10 | `POST autenticacion/autenticar` con cuenta `P` | 401 `Usuario o clave incorrectos` | **Sin cambio** (D-47) | Enlace "Verificar correo" en el login. |
| CC-HLT08-11 | `PUT autenticacion/actualizarClave` con clave actual incorrecta | 400 `La clave actual no es correcta` | **Sin cambio** (AJ-02 verificado) | Mostrar el mensaje; sin renovación (HLT-08 v2, AJ-02). |

---

## H6. Revisión del requerimiento por parte de un senior

### 6.1 Ronda 1 (adversarial) — veredicto: APROBADO CON CAMBIOS

| # | Ataque / hallazgo | Cambio obligatorio | Aplicado en |
|---|-------------------|--------------------|-------------|
| R1-1 | **Enumeración de correos por el registro**: ahora el camino `CREADO` envía un correo (lento) y `CORREO_EXISTENTE` no; el tiempo de respuesta delata si el correo existe. | Espera mínima de 2000 ms + variación en ambos caminos y dos hashes Argon2id en todos. | D-40, RN-32, P-23 |
| R1-2 | **Enumeración por `activar`**: mensajes distintos para "correo inexistente", "cuenta ya activa", "código malo". | Un solo 400 `Código inválido o vencido`; `password_verify` contra `HASH_FICTICIO` en los caminos sin código; auditoría siempre. | RN-33, D-44, P-27 |
| R1-3 | **Enumeración por `reenviarCodigo` y por el 429**: un 429 solo para correos existentes revelaría cuentas. | Respuesta 200 uniforme con límites silenciosos; el 429 depende solo de la IP (se evalúa antes de mirar el correo). | RN-35, RN-36, D-42, P-29, P-31 |
| R1-4 | **Fuerza bruta del código** (10⁶ combinaciones) pidiendo códigos nuevos sin parar. | 5 intentos atómicos por código, 3 códigos/h y 10/24 h por usuario, 60 s entre envíos: ≤ 50 intentos/día por cuenta (≈ 0,005 %/día), independiente de la IP. | RN-34, RN-35, P-25, P-30, P-34 |
| R1-5 | **Carrera**: dos `activar` simultáneos con el mismo código; 10 intentos simultáneos superan 5. | `UPDATE` condicional atómico (uso e intentos) como en la v1. | D-20 v1, `activarCuenta`, P-33, P-34 |
| R1-6 | **Spam de correo**: usar el registro o el reenvío para llenar el buzón de una víctima o usar el servidor como relé masivo. | Un correo ya registrado nunca recibe correo; reenvío ≤ 3/h y 10/día por cuenta con 60 s de enfriamiento; tope de 10 códigos/h por IP; límite público 60/min. Riesgo residual con muchas IP (R-05). | D-42, RN-35, RN-36 |
| R1-7 | **Reutilización de códigos entre recuperación y activación**. | Tablas separadas y sin consultas compartidas; la recuperación sigue ignorando a los `P`. Prueba cruzada. | D-35, RN-37, P-32 |
| R1-8 | **El estado `P` ya bloquea el login** (`ValidacionCtrl.php:59`) y el intento fallido cuenta hacia el bloqueo de 5 fallos; en la app 3 × 401 cierran la aplicación (`login.page.ts:136-143`). Un usuario que intenta entrar antes de verificar sufre una mala experiencia. | No se cambia el login (D-47); HLT-08 v2 lleva al registrado directamente a "verificar correo" y agrega el enlace en el login. | D-47, CC-HLT08-10 |
| R1-9 | **Cuentas que nunca se activan** ocupan correos y filas (un atacante registra correos ajenos y la víctima no puede registrarse: `CORREO_EXISTENTE` silencioso). | Baja lógica a los 7 días sin actividad (libera el correo y el teléfono), solo para cuentas con filas de verificación; tope por IP de 10 registros/h limita el volumen. | D-46, RN-38, P-36 |
| R1-10 | **Ocupación de la cuenta de otra persona**: un atacante registra el correo de la víctima con una clave que conoce; si la víctima introduce el código recibido, activa una cuenta que controla el atacante. | El correo dice "si no creaste una cuenta, ignora este correo"; la víctima recupera la cuenta con "olvidé mi clave" (`restablecerClave` cambia la clave y revoca sesiones). Riesgo Media aceptado (R-04). | 5.5, R-04 |
| R1-11 | **Activar a un usuario `S` o `E`** o a uno con varias cuentas con el mismo correo. | `buscarUsuarioPendientePorCorreo` solo `P`; `UPDATE … WHERE usu_situacion = 'P'`; si hay ≠ 1 cuentas `P` → error uniforme (falla cerrada). | D-43, RN-33, P-27 |
| R1-12 | **Código en claro en el correo y en `logs/correos.log`**. | Solo modo `log` con `APP_ENTORNO=local` (guarda de `EnviadorCorreo.php:22-36`); cuerpo sin URLs; el código nunca se audita ni se registra. | RN-30, RN-31 |
| R1-13 | **Argon2id como vector de agotamiento**: `agregar` ahora calcula 2 hashes de 64 MB por petición. | Límite público 60/min por IP; el tope de 10 códigos/h por IP corta los registros reales. Riesgo Media (R-07), mitigación completa en HLT-11 (límites del hosting). | R-07 |
| R1-14 | **F-01 (hallazgo propio)**: `aud_fecha` en UTC frente a `NOW()` local: el bloqueo de `actualizarClave` dura ≈ 5 h en vez de 15 min y la alerta cuenta 5 h. | Cambiar a `UTC_TIMESTAMP()` en esas dos consultas. | D-50, RN-44, P-40 |
| R1-15 | **Auditoría inflada**: `ACTIVACION_FALLIDA` por cada intento con correo desconocido. | Aceptado: el límite público (60/min) y la limpieza a 180 días (`limpiarSeguridad.php:41`); no auditar crearía una diferencia de tiempo. Riesgo Baja. | D-45, R-08 |

### 6.2 Ronda 2 — checklist senior

| # | Ítem | Estado | Nota |
|---|------|--------|------|
| 1 | Entendimiento | ✅ | H1 cubre cada punto del requerimiento literal (cobertura en H4). |
| 2 | Reglas de negocio | ✅ | RN-28…RN-45 son comprobables con `curl`, SQL, `grep` o `md5sum`; RN-32 modifica solo el texto de RN-17. |
| 3 | Impacto | ✅ | Archivos: `PersonaCtrl/Mdl/Rts`, `BaseCtrl`, `ClaveCtrl` (solo la espera), `ClaveMdl` y `AlertasSeguridadMdl` (una línea cada una), `PlantillasCorreo`, `index.php`, `limpiarSeguridad.php`, 2 archivos nuevos, 1 SQL, 4 copias de `RegistroAuditoria`, README. Efecto colateral: la app queda desajustada con el texto/contrato del registro hasta HLT-08 v2 (ventana aceptada). |
| 4 | Consistencia arquitectónica | ✅ | Rts → Ctrl → Mdl → `Enlace`; SQL solo en modelos; respuestas por `BaseCtrl`; servicios sin SQL. La clase compartida §4.2 (`RegistroAuditoria`) se modifica en las 4 copias a la vez. |
| 5 | Riesgos | ✅ | Tabla 6.3. |
| 6 | Simplicidad | ✅ | Sin tipo en la tabla de recuperación (menos regresión); sin cola de correos; sin CAPTCHA; sin borrado físico. |
| 7 | Seguridad | ✅ | R1-1…R1-15 cerradas; no toca sesión, PIN ni guardas. |
| 8 | Cobertura | ✅ | Matriz H4 al 100 %. |
| 9 | Determinismo | ✅ | Firmas, SQL, textos, límites y pruebas cerrados. Sin mapeos pendientes. |
| 10 | Ejecutabilidad por agente | ✅ | Cada tarea declara archivos, dependencias y un criterio con comando. |

### 6.3 Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-02 | Producción sin SMTP real (DH-10): el registro crea cuentas que nadie puede activar. | **Alta** | HLT-11 no cierra sin DH-10; en local Mailpit o log. Se registra en el README (T-42). |
| R-03 | SMTP real > 2 s reabre la enumeración por tiempo del registro y del reenvío. | Media | `Timeout` SMTP de 5 s; HLT-11 mide la latencia y, si supera 1,5 s, un HLT nuevo sube la espera mínima. |
| R-04 | Un atacante ocupa el correo de otra persona (registro sin su permiso). | Media | Depuración a 7 días, correo con aviso, recuperación de clave por la víctima; no hay forma de verificar sin que la víctima intervenga. |
| R-05 | Muchas IP distintas envían 1 correo cada una a víctimas distintas (relé de correo). | Media | Tope por IP + límite público; CAPTCHA fuera de alcance (pregunta Q-03). |
| R-06 | Usuarios `P` anteriores (15 en local) pueden activarse con `reenviarCodigo`, aunque su `P` significara "aprobación administrativa". | Media | Es la intención de D-18; AJ-04 (HLT-11) retira los usuarios semilla antes de producción. |
| R-07 | Argon2id (64 MB) × 2 por registro bajo concurrencia en hosting compartido. | Media | 60/min por IP; HLT-11 valida `memory_limit` y RAM (DH-11). |
| R-08 | `sgen_auditoria` crece con `ACTIVACION_FALLIDA`. | Baja | Límite público; limpieza a 180 días. |
| R-09 | Nombres de usuario de cuentas depuradas quedan ocupados (`sgen_usuario_idx`). | Baja | Aceptado (D-46); el usuario elige otro nombre. |
| R-10 | Un usuario `P` que intenta entrar 3 veces cierra la app (`login.page.ts:136-143`). | Baja | HLT-08 v2 lo lleva a "verificar correo" y agrega el enlace. |
| R-11 | Carrera por teléfono duplicado (sin índice), igual que en la v1. | Baja | Aceptado (v1). |

### 6.4 Preguntas al usuario (no bloquean este HLT)

| ID | Pregunta | Opciones e impacto | Recomendación |
|----|----------|--------------------|---------------|
| Q-03 | ¿Se agrega un CAPTCHA (o verificación humana) al registro antes de producción? | **Sí**: cierra R-05 y R-07; cambia app y backend (HLT nuevo). **No**: se acepta el tope por IP. | No ahora; evaluarlo en HLT-11 con datos reales de abuso. |
| Q-04 | ¿Deben los usuarios `P` anteriores a D-18 poder activarse por correo? | **Sí** (como está): auto-servicio. **No**: exigiría marcar esas cuentas (columna nueva). | Sí; se limpian con AJ-04. |

### 6.5 Contradicciones y observaciones

1. **AJ-02 ya estaba cumplido** en el código ejecutado (`ClaveCtrl.php:166`, 400). No hay cambio de código; se agrega verificación y regresión (T-26, T-40). El texto es `La clave actual no es correcta`, no `Clave actual incorrecta` (D-48).
2. **AJ-03**: la "normalización `htmlspecialchars(trim())`" de HLT-03 no existe como norma de escritura: el login y todos los hashes nuevos usan la clave **cruda**; `htmlspecialchars(trim())` queda solo como respaldo de verificación para hashes anteriores (`HashClaves.php:25-30`). Nada que migrar (D-49).
3. **El estado de HLT-06 v1 es PARCIAL**: T-22 y T-23 no se ejecutaron por falta de usuarios con clave conocida. Con D-18 se pueden crear usuarios por el flujo real; T-39 y T-40 los usan. Las pruebas P-xx de la v1 que quedaron sin ejecutar **no** se heredan salvo las de regresión de T-40.
4. **Efecto en HLT-05 v2**: sus pruebas necesitan usuarios activos; usan el flujo real de este HLT.

### 6.6 Veredicto final

**APROBADO.** Los 15 cambios de la ronda 1 están aplicados (secciones D-35…D-54, RN-28…RN-45, firmas 5.4). No quedan decisiones abiertas ni preguntas bloqueantes (Q-03 y Q-04 son de producción y no cambian el contrato).

---

## H7. Plan de tareas

Repositorio: `rest_usuario` (git propio) salvo T-28 (también `rest_criteriokelly`, `rest_suscripcion` y `rest_divisas`, esta sin git). Rutas relativas a `C:\xampp\htdocs\criterio_kelly\`. PHP: `C:\xampp\php\php.exe` (8.2.35). `B=http://localhost/criterio_kelly/rest_usuario`.

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|--------|
| T-26 | desarrollador-php | Verificar el estado real tras la v1 y registrar la línea base (solo lectura) | `rest_usuario/index.php:29-35`, `controladores/PersonaCtrl.php:59-120`, `modelos/PersonaMdl.php:39-111`, `controladores/ClaveCtrl.php:145-188`, `controladores/ValidacionCtrl.php:45-62`, `servicios/HashClaves.php:25-30`, `configuracion/RegistroAuditoria.php:8-12`, `anexos/seguridad_02_recuperacion.sql` | — | (1) `C:\xampp\php\php.exe -l` sin errores sobre los 8 archivos; (2) `SHOW CREATE TABLE sgen_recuperacion` existe y `SHOW TABLES LIKE 'sgen_verificacion'` → vacío; (3) `md5sum` de las 4 copias de `RegistroAuditoria.php` → un solo valor (`1d8933e00241ab3962cf3493e15f262e`); (4) `grep -n "respuestaErrorSimple('La clave actual no es correcta', 400)" rest_usuario/controladores/ClaveCtrl.php` → 1 línea y `grep -n "401" rest_usuario/controladores/ClaveCtrl.php` → 0 (AJ-02); (5) `grep -n "HashClaves::hashear\|HashClaves::verificar" controladores/PersonaCtrl.php controladores/ClaveCtrl.php controladores/ValidacionCtrl.php` anota las líneas de registro, restablecimiento, cambio y login (AJ-03); (6) `curl -s -o /dev/null -w "%{http_code}" $B/` → 200; (7) `.env`: `CORREO_MODO` y `RUTA_LOGS` anotados, Mailpit sí/no (`curl http://localhost:8025/`). | RN-42, RN-43 |
| T-27 | desarrollador-php | Crear y aplicar el script de la tabla `sgen_verificacion` | `rest_usuario/anexos/seguridad_03_verificacion.sql` (nuevo) | T-26 | Contenido de 5.3 con cabecera de orden de aplicación; `C:\xampp\mysql\bin\mysql.exe -u root sist_criteriokelly < rest_usuario/anexos/seguridad_03_verificacion.sql` dos veces seguidas sin error; `SHOW CREATE TABLE sgen_verificacion` coincide con 5.3 (3 índices y la FK); `git -C criterioKellyApp status --short` sin archivos nuevos de este HLT. | RN-29, D-35, D-36 |
| T-28 | desarrollador-php | Agregar los 3 eventos de auditoría a las 4 copias de `RegistroAuditoria` | `rest_usuario/configuracion/RegistroAuditoria.php:8-12`, `rest_criteriokelly/configuracion/RegistroAuditoria.php:8-12`, `rest_suscripcion/configuracion/RegistroAuditoria.php:8-12`, `rest_divisas/configuracion/RegistroAuditoria.php:8-12` | T-26 | `EVENTOS` termina con `'ACTIVACION_SOLICITADA', 'CUENTA_ACTIVADA', 'ACTIVACION_FALLIDA'`; `php -l` OK en las 4; `md5sum` de las 4 → un solo valor distinto del anterior; cada evento ≤ 24 caracteres (`awk`). | RN-39, D-45 |
| T-29 | desarrollador-php | Mover la espera uniforme y `obtenerAgente` a `BaseCtrl` y usarlos en `ClaveCtrl` | `rest_usuario/controladores/BaseCtrl.php:59` (constantes y método tras `exigirIdDeSesion`), `rest_usuario/controladores/ClaveCtrl.php:17-18`, `:72`, `:190-197`, `:208-212` | T-26 | `php -l` OK; `grep -n "esperarTiempoMinimo" rest_usuario/controladores/BaseCtrl.php rest_usuario/controladores/ClaveCtrl.php` → definición solo en `BaseCtrl`, llamada en `ClaveCtrl`; `grep -n "TIEMPO_MINIMO_SOLICITUD_MS\|VARIACION_MAXIMA_MS\|function obtenerAgente" rest_usuario/controladores/ClaveCtrl.php` → 0 (y `function obtenerAgente` solo en `BaseCtrl`); `POST $B/autenticacion/solicitarRecuperacion` con un correo inexistente tarda ≥ 2,0 s y responde 200 con el mensaje de RN-07 (v1). | RN-45, D-52 |
| T-30 | desarrollador-php | Agregar `PlantillasCorreo::codigoVerificacion` | `rest_usuario/servicios/PlantillasCorreo.php:19` (método nuevo tras `codigoRecuperacion`) | T-26 | `php -l` OK; `php -r "require 'rest_usuario/servicios/PlantillasCorreo.php'; print_r(PlantillasCorreo::codigoVerificacion('Ana &amp; Luis', '123456'));"` → asunto y cuerpo exactos de 5.5 con `Ana & Luis`; el cuerpo no contiene `http`. | RN-30, D-41 |
| T-31 | desarrollador-php | Crear `VerificacionMdl` con las 10 funciones y constantes de 5.4 | `rest_usuario/modelos/VerificacionMdl.php` (nuevo) | T-27 | `php -l` OK; `grep -n "SELECT \*" rest_usuario/modelos/VerificacionMdl.php` → 0; `grep -c "iniciarTransaccion" rest_usuario/modelos/VerificacionMdl.php` → 2 (`emitirCodigoReenvio`, `activarCuenta`); todas las consultas con `bind_param` (`?`), sin concatenar entrada; `grep -n "sgen_recuperacion" rest_usuario/modelos/VerificacionMdl.php` → 0. | RN-29, RN-33…RN-38, RN-37 |
| T-32 | desarrollador-php | Reescribir `PersonaMdl::registrarPersona` para insertar el código en la misma transacción y devolver el id | `rest_usuario/modelos/PersonaMdl.php:1-5` (`require_once` de `VerificacionMdl`), `:14-16` (constructor), `:39-111` | T-31 | `php -l` OK; firma exacta de 5.4; el `INSERT` del código ocurre entre `INSERT sgen_rolusuario` y `confirmarTransaccion` (`:94-102`); devuelve `['resultado' => REGISTRO_CREADO, 'idUsuario' => <int>]` y, en los otros casos, `idUsuario => null`; `grep -n "spsu_" rest_usuario/modelos/PersonaMdl.php` → 0. | RN-28, RN-29, D-38 |
| T-33 | desarrollador-php | Reescribir `PersonaCtrl::agregarPersona` (Flujo D2) | `rest_usuario/controladores/PersonaCtrl.php:1-18` (requires y constructor con `Enlace` compartido), `:59-120` | T-28, T-29, T-30, T-32 | `php -l` OK; orden de pasos de D2 (tope por IP antes de hashear y de `registrarPersona`; dos hashes siempre; correo tras `registrarPersona`; `esperarTiempoMinimo` solo en `CREADO` y `CORREO_EXISTENTE`); mensaje de 5.5; `grep -n "limpiarDatos" rest_usuario/controladores/PersonaCtrl.php` no incluye la clave (la clave se lee de `$datos['clave']` antes de limpiar, `:73`); verificado en P-22, P-23, P-31. | RN-28…RN-32, RN-36, RN-39 |
| T-34 | desarrollador-php | Crear `VerificacionCtrl` con `activarCuenta` (Flujo G) | `rest_usuario/controladores/VerificacionCtrl.php` (nuevo) | T-28, T-31 | `php -l` OK; `grep -n "password_verify" rest_usuario/controladores/VerificacionCtrl.php` → 2 (una con `HASH_FICTICIO`, una con el hash real); comportamiento verificado en P-24 a P-28, P-32 a P-35 (tras T-36). | RN-33, RN-34, RN-37, RN-39, RN-41 |
| T-35 | desarrollador-php | Agregar `VerificacionCtrl::reenviarCodigo` (Flujo H) | `rest_usuario/controladores/VerificacionCtrl.php` | T-29, T-30, T-34 | `php -l` OK; orden de pasos de H; verificado en P-29 a P-31 (tras T-36). | RN-35, RN-36, RN-39, RN-41 |
| T-36 | desarrollador-php | Despachar `activar` y `reenviarCodigo` en `PersonaRts` y declararlas públicas | `rest_usuario/rutas/PersonaRts.php:5` (require de `VerificacionCtrl`), `:11` (instancia `$verificacionControlador`), `:14-23` (cambiar `if ($accion !== 'agregar')` por `switch ($accion)` con `agregar`, `activar`, `reenviarCodigo`; otro valor → `responderRecursoPersonaNoEncontrado()`), `rest_usuario/index.php:29-35` | T-33, T-35 | `php -l` OK en ambos; `RUTAS_PUBLICAS` contiene exactamente `autenticacion/autenticar`, `autenticacion/renovar`, `autenticacion/solicitarRecuperacion`, `autenticacion/restablecerClave`, `persona/agregar`, `persona/activar`, `persona/reenviarCodigo`; `POST $B/persona/activar` sin token con cuerpo `{}` → 400 `Solicitud inválida` (no 401); `POST $B/persona/actualizarDeApp` sin token → 401; `POST $B/persona/inexistente` → 404. | RN-40 |
| T-37 | desarrollador-php | Corregir la ventana de fechas de auditoría a UTC (F-01) | `rest_usuario/modelos/ClaveMdl.php:151-159` (línea `:156`), `rest_usuario/modelos/AlertasSeguridadMdl.php:15-18` (línea `:17`) | T-26 | `php -l` OK en ambos; `grep -n "NOW()" rest_usuario/modelos/AlertasSeguridadMdl.php` solo en `:37` (limpieza de `sgen_recuperacion`); `grep -n "aud_fecha" rest_usuario/modelos/ClaveMdl.php rest_usuario/modelos/AlertasSeguridadMdl.php` → ambas líneas usan `UTC_TIMESTAMP()`; verificado en P-40. | RN-44, D-50 |
| T-38 | desarrollador-php | Integrar la depuración en el script de mantenimiento | `rest_usuario/mantenimiento/limpiarSeguridad.php:17-20` (require de `VerificacionMdl`), `:42-46` | T-31, T-36 | `php -l` OK; el script llama primero `depurarCuentasSinVerificar()` y después `depurarVerificacionesAntiguas()`; `C:\xampp\php\php.exe rest_usuario/mantenimiento/limpiarSeguridad.php` termina con código 0 e imprime `… pendientes=<n> verificaciones=<n>`; verificado en P-36. | RN-38 |
| T-39 | desarrollador-php | Ejecutar las pruebas de verificación de correo (P-22 a P-35, P-37, P-41, P-42) y pegar la salida real | Sin archivos de código; solo usuarios de prueba `prueba_hlt06v*` (se borran al final con el SQL de limpieza de 7.1) | T-36, T-38 | Cada prueba da exactamente el resultado esperado de 7.1. | D-18, RN-28…RN-41 |
| T-40 | desarrollador-php | Ejecutar las pruebas de AJ-02, AJ-03, F-01 y la regresión de la v1 (P-38, P-39, P-40 y P-01, P-02, P-06 de la v1) y pegar la salida real | Sin archivos de código | T-37, T-39 | Cada prueba da exactamente el resultado esperado; P-02 de la v1 sigue ≥ 2,0 s tras T-29. | RN-42…RN-45, AJ-02, AJ-03 |
| T-41 | desarrollador-php | Verificación global | Solo lectura | T-40 | `php -l` sin errores en todo `.php` tocado o creado; `md5sum` de las 4 copias de `RegistroAuditoria.php` → un solo valor; `grep -rn "spsu_" rest_usuario --include=*.php` → 0; `grep -rn "generarCodigo\|obtenerCodigo\|usu_codiorecupe\|rand(" rest_usuario --include=*.php` → 0 (invariante de la v1); `grep -n "persona/activar\|persona/reenviarCodigo" rest_usuario/index.php` → 2; `git -C criterioKellyApp status --short` sin archivos de este HLT; `composer audit --working-dir=rest_usuario` sin avisos. | RN-28, RN-39, RN-40 |
| T-42 | desarrollador-php | Actualizar el README de `rest_usuario` | `rest_usuario/README.md` (tabla de `/persona` `:142-165`, sección "Estado actual" `:228`, más una sección nueva "Verificación de correo") | T-41 | Documenta: `agregar` v2 (estado `P`, código por correo, 429 por IP, ≥ 2 s), `activar` y `reenviarCodigo` con cuerpos y errores de 5.6; tabla `sgen_verificacion` y orden de scripts (`seguridad_03`, sin copia a la app); límites (5 intentos, 15 min, 3/h, 10/día, 60 s, 10/h por IP); depuración a 7 días; nombres de usuario depurados ocupados; riesgo R-02 (sin SMTP en producción nadie se activa); AJ-02 y AJ-03 como verificados; F-01. `grep -n "activar" rest_usuario/README.md` ≥ 3 líneas. | J-08 |

Paralelizables (RS-3): T-27 con T-28, T-29, T-30 y T-37; T-34 y T-32 entre sí tras T-31.

### 7.1 Batería de pruebas `curl`

Variables comunes (Git Bash):

```bash
B=http://localhost/criterio_kelly/rest_usuario
H=(-H "Content-Type: application/json" -H "X-Requested-With: CriterioKelly" -H "Origin: http://localhost:8100")
M="/c/xampp/mysql/bin/mysql.exe -u root sist_criteriokelly -N -e"
# Código de verificación: último "activar tu cuenta es: NNNNNN" del log (modo log) o de Mailpit
codigoV() { if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8025/)" = 200 ]; then id=$(curl -s http://localhost:8025/api/v1/messages | /c/xampp/php/php.exe -r '$j=json_decode(stream_get_contents(STDIN),true); echo $j["messages"][0]["ID"];'); curl -s http://localhost:8025/api/v1/message/$id | grep -o 'es: [0-9]\{6\}' | tail -1 | cut -c5-; else grep -o 'activar tu cuenta es: [0-9]\{6\}' rest_usuario/logs/correos.log | tail -1 | grep -o '[0-9]\{6\}$'; fi; }
token() { curl -s "${H[@]}" -X POST $B/autenticacion/autenticar -d "{\"usuario\":\"$1\",\"clave\":\"$2\"}" | /c/xampp/php/php.exe -r 'echo json_decode(stream_get_contents(STDIN),true)["accessToken"] ?? "";'; }
reg() { curl -s -w "\n%{http_code}" "${H[@]}" -X POST $B/persona/agregar -d "{\"nombres\":\"Prueba\",\"apellidos\":\"Hlt06v\",\"correo\":\"$1\",\"telefono\":\"$2\",\"usuario\":\"$3\",\"clave\":\"${4:-Cielo-Rojo-Montaña-77}\"}"; }
regt() { curl -s -o /dev/null -w "%{time_total}\n" "${H[@]}" -X POST $B/persona/agregar -d "{\"nombres\":\"Prueba\",\"apellidos\":\"Hlt06v\",\"correo\":\"$1\",\"telefono\":\"$2\",\"usuario\":\"$3\",\"clave\":\"Cielo-Rojo-Montaña-77\"}"; }   # igual que reg, pero imprime solo el tiempo
act() { curl -s -w "\n%{http_code}" "${H[@]}" -X POST $B/persona/activar -d "{\"correo\":\"$1\",\"codigo\":\"$2\"}"; }
reen() { curl -s -w "\n%{http_code}" "${H[@]}" -X POST $B/persona/reenviarCodigo -d "{\"correo\":\"$1\"}"; }
# El tope de 10 códigos/h por IP (RN-36) se alcanzaría con esta batería: este fixture mueve las filas existentes a otra IP. Ejecutarlo antes de cada prueba (P-31 lo usa a propósito).
liberarIp() { $M "UPDATE sgen_verificacion SET ver_ipSolicitud = '10.0.0.1' WHERE ver_ipSolicitud <> '10.0.0.1'"; }
```

| ID | Prueba | Comando (resumen exacto) | Resultado esperado |
|----|--------|--------------------------|--------------------|
| P-22 | Registro: `P`, sin suscripción, código en la misma transacción | `reg prueba.hlt06v1@example.com 0990000111 prueba_hlt06v1`; luego `$M "SELECT usu_situacion FROM sgen_usuario WHERE usu_usuario='prueba_hlt06v1'"`, `$M "SELECT COUNT(*), MIN(LEFT(ver_codigoHash,9)), MIN(ver_situacion) FROM sgen_verificacion v JOIN sgen_usuario u ON u.usu_idUsuario=v.ver_usuId WHERE u.usu_usuario='prueba_hlt06v1'"`, `$M "SELECT COUNT(*) FROM spsu_suscripcion s JOIN sgen_usuario u ON u.usu_idUsuario=s.sus_usuarioId WHERE u.usu_usuario='prueba_hlt06v1'"`, `token prueba_hlt06v1 'Cielo-Rojo-Montaña-77'`, `grep -c "Código para activar tu cuenta" rest_usuario/logs/correos.log` antes y después | 200 con el cuerpo de RN-32; `P`; `1 $argon2id$ A`; `0`; token vacío (login 401); el log gana 1 correo; `SELECT aud_evento FROM sgen_auditoria ORDER BY aud_id DESC LIMIT 1` → `ACTIVACION_SOLICITADA`. |
| P-23 | Registro uniforme (correo existente) y tiempo | `liberarIp`; (a) correo existente con usuario y teléfono nuevos cada vez: `for i in 1 2 3 4 5; do regt prueba.hlt06v1@example.com 09900002$i prueba_hlt06v_x$i; done` y una vez `reg …` con los mismos datos para guardar el cuerpo; (b) correo nuevo cada vez: `for i in 1 2 3; do regt prueba.hlt06v_n$i@example.com 09900003$i prueba_hlt06v_n$i; done`; `diff` del cuerpo de (a) con el de P-22; conteo de `sgen_persona` y de correos del log antes y después de (a) | Cuerpos idénticos entre (a) y P-22 (ambos 200, `diff` vacío); (a) no cambia el conteo de `sgen_persona` ni agrega correos al log; todos los tiempos de (a) y (b) ≥ 2,0 s y la diferencia entre medianas < 0,3 s. |
| P-24 | Activación correcta, un solo uso | `C=$(codigoV)`; `act prueba.hlt06v1@example.com $C`; `$M "SELECT usu_situacion FROM sgen_usuario WHERE usu_usuario='prueba_hlt06v1'"`; `token prueba_hlt06v1 'Cielo-Rojo-Montaña-77'`; repetir `act` con el mismo `$C`; `$M "SELECT aud_evento FROM sgen_auditoria WHERE aud_evento='CUENTA_ACTIVADA' ORDER BY aud_id DESC LIMIT 1"` | 1ª: 200 `{"success":"ok"}`; `A`; token no vacío; 2ª: 400 `{"error":"Código inválido o vencido"}`; fila de auditoría `CUENTA_ACTIVADA`; fila `ver_situacion = 'U'`. |
| P-25 | Fuerza bruta del código | `reg prueba.hlt06v2@example.com 0990000121 prueba_hlt06v2`; `C=$(codigoV)`; 5 `act` con un código distinto de `$C`; 6º con `$C`; `$M "SELECT ver_intentos, ver_situacion FROM sgen_verificacion v JOIN sgen_usuario u ON u.usu_idUsuario=v.ver_usuId WHERE u.usu_usuario='prueba_hlt06v2'"`; `SELECT COUNT(*) FROM sgen_auditoria WHERE aud_evento='ACTIVACION_FALLIDA'` | 6 respuestas 400 `Código inválido o vencido`; `5 A`; `usu_situacion` sigue `P`; ≥ 5 filas nuevas `ACTIVACION_FALLIDA`. |
| P-26 | Código vencido | `reg prueba.hlt06v3@example.com 0990000131 prueba_hlt06v3`; `C=$(codigoV)`; `$M "UPDATE sgen_verificacion SET ver_fechaExpira = NOW() - INTERVAL 1 MINUTE WHERE ver_situacion='A' AND ver_usuId=(SELECT usu_idUsuario FROM sgen_usuario WHERE usu_usuario='prueba_hlt06v3')"`; `act … $C` | 400 `Código inválido o vencido`; usuario sigue `P`. |
| P-27 | Error uniforme y tiempo | Preparar `prueba_hlt06v4` (registrado, código pedido), `prueba_hlt06v1` (ya `A`) y un usuario `S` (`$M "UPDATE sgen_usuario SET usu_situacion='S' WHERE usu_usuario='prueba_hlt06v5'"` tras registrarlo). `act` con: (a) correo inexistente `no.existe.hlt06v@example.com`, (b) correo del usuario `A`, (c) correo del usuario `S`, (d) correo del `P` con código `000000`; 5 veces cada uno con `-o /dev/null -w "%{time_total}\n"` | Los 4 cuerpos idénticos `{"error":"Código inválido o vencido"}` y 400 (`diff` vacío); la diferencia entre medianas de tiempo < 0,3 s; ni (b) ni (c) cambian de situación. |
| P-28 | Validación de formato y de campos | `act prueba.hlt06v4@example.com 12345`; `act correo-invalido 123456`; `curl … -d '{"correo":"a@b.com","codigo":"123456","extra":"x"}'`; `curl … -d '{"correo":"a@b.com","codigo":123456}'`; `curl -s -o /dev/null -w "%{http_code}" $B/persona/activar` (GET) | 400 `El código debe tener 6 dígitos`; 400 `El correo no es válido`; 400 `Solicitud inválida`; 400 `Solicitud inválida`; 404. |
| P-29 | Reenvío uniforme, reemplazo del código y enfriamiento | `V4=$($M "SELECT usu_idUsuario FROM sgen_usuario WHERE usu_usuario='prueba_hlt06v4'")`; `$M "UPDATE sgen_verificacion SET ver_fechaCrea = NOW() - INTERVAL 2 MINUTE WHERE ver_usuId=$V4"`; `reen prueba.hlt06v4@example.com`; de inmediato `reen prueba.hlt06v4@example.com` otra vez; `reen no.existe.hlt06v@example.com`; `reen prueba.hlt06v1@example.com` (ya `A`); `diff` de los 4 cuerpos; `$M "SELECT ver_situacion, COUNT(*) FROM sgen_verificacion WHERE ver_usuId=$V4 GROUP BY 1"`; conteo de correos del log antes y después | Los 4 cuerpos idénticos con el mensaje de 5.5 (todos 200, `diff` vacío); filas de `V4`: `A 1` y `R 1` (la 1.ª llamada emitió; la 2.ª, a menos de 60 s, no emitió); el log gana exactamente 1 correo; el correo inexistente y el del usuario `A` no crean filas. |
| P-30 | Límites por usuario (3/hora) | Con `V4` de P-29 (2 filas en la última hora): repetir 4 veces `$M "UPDATE sgen_verificacion SET ver_fechaCrea = ver_fechaCrea - INTERVAL 2 MINUTE WHERE ver_usuId=$V4"` seguido de `reen prueba.hlt06v4@example.com`; luego `$M "SELECT COUNT(*) FROM sgen_verificacion WHERE ver_usuId=$V4 AND ver_fechaCrea >= NOW() - INTERVAL 1 HOUR"` | Las 4 respuestas son 200 con el mismo cuerpo; el conteo final es 3; la 1.ª llamada emite (3.ª fila) y las otras 3 no emiten ni envían correo (el log gana 1 correo en total). |
| P-31 | Tope por IP (RN-36) | `liberarIp`; `reg prueba.hlt06v12@example.com 0990000171 prueba_hlt06v12` (deja una fila con la IP real); `IPX=$($M "SELECT ver_ipSolicitud FROM sgen_verificacion ORDER BY ver_idVerificacion DESC LIMIT 1")`; insertar 10 filas con esa IP: `$M "INSERT INTO sgen_verificacion (ver_usuId, ver_codigoHash, ver_fechaExpira, ver_situacion, ver_ipSolicitud) SELECT usu_idUsuario, 'x', NOW() - INTERVAL 1 DAY, 'R', '$IPX' FROM sgen_usuario LIMIT 10"`; `reg prueba.hlt06v6@example.com 0990000161 prueba_hlt06v6`; `reen prueba.hlt06v4@example.com`; `reen no.existe.hlt06v@example.com` con `-D -` para ver cabeceras; luego borrar las filas con `ver_codigoHash = 'x'` y `liberarIp` | Las 3 respuestas son 429 `{"error":"Demasiados intentos, intente nuevamente más tarde"}` con `Retry-After: 3600`; el registro no crea persona ni usuario; los cuerpos de las dos de reenvío son idénticos; tras borrar las filas y `liberarIp`, `reen` vuelve a responder 200. |
| P-32 | Códigos no intercambiables | (a) Usuario `A` `prueba_hlt06v1`: `solicitarRecuperacion` → `CR` del log (`es: NNNNNN` de "restablecer"); con otro usuario `P` (`prueba_hlt06v4`) `act correo_v4 $CR` → 400; (b) `CV=$(codigoV)` del `P`: `POST autenticacion/restablecerClave` `{correo_v4, codigo:$CV, claveNueva:'Selva-Azul-Torrente-88'}` → 400 y `usu_clave` sin cambio (`SELECT MD5(usu_clave)` antes/después); (c) `POST solicitarRecuperacion` con el correo del `P` → 200 igual que uno inexistente; `SELECT COUNT(*) FROM sgen_recuperacion` sin cambios para ese usuario y sin correo nuevo | (a) y (b): 400 `Código inválido o vencido`; hash igual; (c) 200 uniforme, 0 filas, 0 correos. |
| P-33 | Carrera en el uso del código | `reg …v7`; `C=$(codigoV)`; dos `act` simultáneos con `$C` (`… & … & wait`) | Exactamente un 200 y un 400; `usu_situacion = 'A'`. |
| P-34 | Carrera en intentos | `reg …v8`; 10 `act` simultáneos con códigos erróneos | 10 respuestas 400; `ver_intentos` = 5. |
| P-35 | Inyección de cabeceras y de SQL | `reen` y `act` con `"correo":"prueba.hlt06v4@example.com\r\nBcc: x@example.com"` (JSON con `\r\n`); `act` con `"codigo":"1' OR '1'='1"` | 400 `El correo no es válido` (sin correo nuevo en el log); 400 `El código debe tener 6 dígitos`. |
| P-36 | Depuración de cuentas sin verificar | Crear `prueba_hlt06v9` (con fila de verificación) y `prueba_hlt06v10` (insertado por SQL como `P` **sin** filas de verificación): `$M "UPDATE sgen_persona p JOIN sgen_usuario u ON u.usu_perIdPerso=p.per_idPersona SET p.per_fechaRegis = NOW() - INTERVAL 8 DAY WHERE u.usu_usuario IN ('prueba_hlt06v9','prueba_hlt06v10')"` y `UPDATE sgen_verificacion … SET ver_fechaCrea = NOW() - INTERVAL 8 DAY` para v9; ejecutar `C:\xampp\php\php.exe rest_usuario/mantenimiento/limpiarSeguridad.php`; consultar ambos; luego `reg` de un usuario nuevo con el correo de v9 | Salida con `pendientes=1`; v9: `usu_situacion = 'E'`, `usu_estado = '0'`, `per_estado = '0'`; v10 sin cambios; filas de verificación de v9 (ya no `P`) borradas al ejecutar de nuevo; el registro con el correo de v9 responde 200 y crea persona nueva. |
| P-37 | Sin suscripción | Tras P-24: `$M "SELECT COUNT(*) FROM spsu_suscripcion WHERE sus_usuarioId=(SELECT usu_idUsuario FROM sgen_usuario WHERE usu_usuario='prueba_hlt06v1')"`; `grep -rn "spsu_" rest_usuario --include=*.php` | `0` y 0 líneas. |
| P-38 | AJ-02 | Con `T=$(token prueba_hlt06v1 'Cielo-Rojo-Montaña-77')`: (a) 3 veces `PUT autenticacion/actualizarClave` con `{"claveActual":"incorrecta-123456","claveNueva":"Selva-Azul-Torrente-88"}` y `-w "%{http_code}"`; (b) con token inválido (`Bearer xxx`); (c) con la `claveActual` correcta | (a) 3 × HTTP **400** `{"error":"La clave actual no es correcta"}` (ninguno 401); (b) 401 `Sesión no válida o expirada`; (c) 200 `{"success":"ok"}`. |
| P-39 | AJ-03 (misma normalización de clave) | Clave `K='  a&b<c>"d'"'"'efgh-12  '` (espacios en los extremos y símbolos): `reg …v11 … "$K"`, activar con `codigoV`, `token prueba_hlt06v11 "$K"`; `token` con la clave recortada; `actualizarClave` con `claveActual=$K`; además, hash heredado: `$M "UPDATE sgen_usuario SET usu_clave='$(/c/xampp/php/php.exe -r 'echo password_hash(htmlspecialchars(trim("a&b<c>\"d'"'"'efgh-12"), ENT_QUOTES, "UTF-8"), PASSWORD_BCRYPT);')' WHERE usu_usuario='prueba_hlt06v11'"` y `token prueba_hlt06v11 "a&b<c>\"d'efgh-12"`; `SELECT LEFT(usu_clave,9)` | Registro 200; activación 200; login con `$K` exacto → token; con la clave recortada → vacío (401); `actualizarClave` 200; con el hash heredado el login con la clave cruda → token y `usu_clave` pasa a `$argon2id$` (rehash). |
| P-40 | F-01 (ventana UTC) | Insertar 5 filas `LOGIN_FALLIDO` del usuario `prueba_hlt06v1` con `aud_fecha = UTC_TIMESTAMP() - INTERVAL 30 MINUTE` (`$M "INSERT INTO sgen_auditoria (aud_fecha, aud_evento, aud_servicio, aud_usuId, aud_ip, aud_agenteUsuario, aud_detalle) SELECT UTC_TIMESTAMP() - INTERVAL 30 MINUTE, 'LOGIN_FALLIDO', 'rest_usuario', usu_idUsuario, '127.0.0.1', 'prueba', 'prueba' FROM sgen_usuario WHERE usu_usuario='prueba_hlt06v1'"` ×5); `actualizarClave` con claveActual errónea; luego insertar 5 con `UTC_TIMESTAMP() - INTERVAL 5 MINUTE` y repetir; borrar las filas de prueba (`aud_agenteUsuario = 'prueba'`) | Con eventos de hace 30 min: 400 `La clave actual no es correcta` (no 429); con eventos de hace 5 min: 429 con `Retry-After: 900`. |
| P-41 | Auditoría sin datos sensibles | Tras P-22 a P-25: `$M "SELECT aud_evento, aud_detalle FROM sgen_auditoria WHERE aud_evento IN ('ACTIVACION_SOLICITADA','CUENTA_ACTIVADA','ACTIVACION_FALLIDA') ORDER BY aud_id DESC LIMIT 20"` | Los tres eventos existen; `aud_detalle` vacío y sin ningún grupo de 6 dígitos del código ni hashes. |
| P-42 | Rutas públicas y protegidas | Sin token: `POST persona/activar` con `{}`; `POST persona/reenviarCodigo` con `{"correo":"a@b.com"}`; `PUT persona/actualizarDeApp` con `{"nombres":"x","apellidos":"y","telefono":"123"}` | 400 `Solicitud inválida` (no 401); 200 mensaje; **401** `Sesión no válida o expirada`. |

#### 7.1.1 Limpieza al terminar (SQL, una sola vez)

```bash
$M "DELETE v FROM sgen_verificacion v JOIN sgen_usuario u ON u.usu_idUsuario=v.ver_usuId WHERE u.usu_usuario LIKE 'prueba\\_hlt06v%'"
$M "DELETE r FROM sgen_rolusuario r JOIN sgen_usuario u ON u.usu_idUsuario=r.rus_usuId WHERE u.usu_usuario LIKE 'prueba\\_hlt06v%'"
$M "DELETE r FROM sgen_recuperacion r JOIN sgen_usuario u ON u.usu_idUsuario=r.rec_usuId WHERE u.usu_usuario LIKE 'prueba\\_hlt06v%'"
$M "DELETE u, p FROM sgen_usuario u JOIN sgen_persona p ON p.per_idPersona=u.usu_perIdPerso WHERE u.usu_usuario LIKE 'prueba\\_hlt06v%'"
```

---

## H8. Reglas de implementación deterministas

Rigen **RI-1 a RI-13 del HLT-06 v1** y las de `.claude/agents/desarrollador-php.md`, con PHP 8.2.35. Se agregan:

| ID | Regla | Fuente |
|----|-------|--------|
| RI-14 | **Tablas separadas:** ninguna consulta de `VerificacionMdl` toca `sgen_recuperacion` ni la inversa; `ClaveMdl` no se modifica salvo `:156` (T-37). | D-35 |
| RI-15 | **Uniformidad:** en `agregarPersona` (caminos `CREADO` y `CORREO_EXISTENTE`), `activarCuenta` y `reenviarCodigo` se calcula siempre el mismo número de hashes Argon2id/`password_verify` que en el camino con datos, y los errores de existencia usan el mismo cuerpo. Toda respuesta que dependa de la existencia de un correo pasa por `esperarTiempoMinimo` o por un `password_verify` equivalente. | D-40, D-44 |
| RI-16 | **Código:** el código se genera con `random_int`; se guarda con `HashClaves::hashear`; se compara con `password_verify`; no se escribe en respuestas, auditoría, `error_log` ni en la base en claro. | RN-30 |
| RI-17 | **Fechas:** expiración, ventanas y limpieza de `sgen_verificacion` con `NOW()` en SQL; comparaciones con `aud_fecha` con `UTC_TIMESTAMP()`; `date()` solo para el texto de plantillas. | D-50, RI-13 v1 |
| RI-18 | **Clases compartidas §4.2:** `RegistroAuditoria.php` se modifica solo en T-28 y en las 4 copias a la vez; ningún otro archivo compartido (`Enlace`, `ContextoSesion`, `LimitadorPeticiones`, etc.) se toca. | §4.2 del plan maestro |
| RI-19 | **Sin escritura en otros servicios:** `rest_usuario` no consulta ni escribe `spsu_*` ni tablas de `rest_criteriokelly`. | D-17 |
| RI-20 | **Sin copia a la app:** no se crea ni modifica ningún archivo de `criterioKellyApp/`. | Decisión del usuario |

Situaciones no cubiertas: se imita el código circundante (`ClaveCtrl`, `ClaveMdl`); si contradice una RI, prevalece la RI y se registra.

---

## H9. Reglas de seguimiento de ejecución

Responsable: `desarrollador-php`. Símbolos: `⬜` no realizado, `✅` realizado y verificado, `❌` fallido, `➖` no aplica (justificar). Rigen RS-1 a RS-9 del contrato. Para backend, **C4** = `C:\xampp\php\php.exe -l` sin errores sobre cada archivo tocado; **C5** = prueba `curl` (caso feliz + al menos un error) con la respuesta real. Para tareas sin código (T-26, T-27, T-39, T-40, T-41) C4 y/o C5 se marcan `➖` con justificación.

### 9.1 Fichas

```
T-26 — Verificar el estado real tras la v1 y registrar la línea base
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-27 — Crear y aplicar seguridad_03_verificacion.sql
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-28 — Agregar los 3 eventos de auditoría a las 4 copias de RegistroAuditoria
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-29 — Mover la espera uniforme y obtenerAgente a BaseCtrl y usarlos en ClaveCtrl
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-30 — Agregar PlantillasCorreo::codigoVerificacion
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-31 — Crear VerificacionMdl
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-32 — Reescribir PersonaMdl::registrarPersona (código en la misma transacción)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-33 — Reescribir PersonaCtrl::agregarPersona (Flujo D2)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-34 — Crear VerificacionCtrl con activarCuenta (Flujo G)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-35 — Agregar VerificacionCtrl::reenviarCodigo (Flujo H)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-36 — Despachar activar y reenviarCodigo en PersonaRts y declararlas públicas
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-37 — Corregir la ventana de fechas de auditoría a UTC (F-01)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-38 — Integrar la depuración en el script de mantenimiento
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-39 — Ejecutar las pruebas de verificación de correo
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-40 — Ejecutar las pruebas de AJ-02, AJ-03, F-01 y la regresión de la v1
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-41 — Verificación global
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

```
T-42 — Actualizar el README de rest_usuario
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (H7) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (H8) y H11
    [⬜] C4. php -l sin errores sobre lo tocado
    [⬜] C5. Prueba curl (caso feliz + al menos un error) con respuesta real
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia: <salida real>
  Notas / desviaciones: <si las hubo>
```

### 9.2 Tablero de avance global

| Tarea | Agente | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|--------|----|----|----|----|----|----|-----------|
| T-26 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-27 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-28 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-29 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-30 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-31 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-32 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-33 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-34 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-35 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-36 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-37 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-38 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-39 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-40 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-41 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-42 | php | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

---

## H10. Diseño del reporte de ejecución

```
REPORTE DE EJECUCIÓN — HLT-06 v2 · Claves, recuperación y verificación de correo (rest_usuario)
  1. Resumen ejecutivo         (1–3 frases)
  2. Estado global             (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas         (copia de 9.2 con estado y C1…C6 de T-26…T-42)
  4. Cobertura vs. HLT         (RN-28…RN-45, D-18, AJ-02, AJ-03, F-01 → resultado; ¿100 %?)
  5. Cambios realizados        (archivo ruta:línea y tipo: creado / modificado; repositorio; las 4 copias de RegistroAuditoria)
  6. Verificaciones ejecutadas (cada comando de H7 y cada P-22…P-42 → OK/FALLO + salida real)
  7. Desviaciones y decisiones (estado real encontrado en T-26; cualquier desviación, con causa)
  8. Pendientes / bloqueos     (checks en ⬜/❌ con acción requerida; Q-03 y Q-04)
  9. Próximos pasos            (si el estado no es COMPLETADO; recordatorio: HLT-08 v2 aplica 5.6)
```

`COMPLETADO` solo si T-26…T-42 están `HECHA` con todos sus checks aplicables en `✅` y la sección 6 muestra la salida real de P-22…P-42. Si Mailpit no está instalado y `CORREO_MODO=log`, las pruebas usan el log (`codigoV`) y se anota en la sección 7.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

Convenciones de `.claude/agents/desarrollador-php.md` y de la v1 (H11), con PHP 8.2.35.

| Elemento | Convención | Ejemplos de este HLT |
|----------|-----------|----------------------|
| Ruta / controlador / modelo | `<Recurso>Rts.php`, `<Recurso>Ctrl` (extiende `BaseCtrl`), `<Recurso>Mdl` | `VerificacionCtrl`, `VerificacionMdl` |
| Métodos | verbo + objeto, camelCase | `activarCuenta`, `reenviarCodigo`, `emitirCodigoReenvio`, `depurarCuentasSinVerificar` |
| Variables | sustantivo descriptivo, camelCase | `$hashCodigo`, `$codigoActivo`, `$idVerificacion`, `$usuariosPendientes` |
| Booleanos | prefijo `es`, `esta`, `tiene`, `existe` | `$esCodigoValido`, `$existeCorreo` |
| Constantes | UPPER_SNAKE_CASE | `MAXIMO_CODIGOS_POR_IP_HORA`, `SEGUNDOS_ENTRE_ENVIOS`, `DIAS_RETENCION_PENDIENTES` |
| SQL | `$sql` + propósito | `$sqlBuscarPendiente`, `$sqlConsumirIntento`, `$sqlDepurarCuentas` |
| Tablas y columnas | prefijo del esquema | `sgen_verificacion.ver_*`, índices `idx_ver_*` |
| Scripts SQL | `anexos/seguridad_NN_<tema>.sql`, idempotentes, con orden de aplicación | `seguridad_03_verificacion.sql` |
| Mensajes al usuario | español, sin detalles internos | 5.5 |

Reglas de código limpio: una responsabilidad por clase y método; retornos tempranos; sin código comentado, depuración ni métodos sin uso; PHPDoc solo para formas de arreglo (`@return array<int, array{usu_idUsuario:int, usu_usuario:string, per_nombres:string, per_correo:string}>`) o para explicar una regla de seguridad (por qué el intento se consume antes de comparar). Prohibidos `$res`, `$obj`, `$aux`, `$tmp`, `$d` y números mágicos.
