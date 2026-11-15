# Módulo de correo de `rest_usuario`

## 1. Qué es

Todo lo que envía correo en `rest_usuario` vive en esta carpeta, con nombre propio, para encontrar, revisar y cambiar el envío sin recorrer controladores, servicios y scripts sueltos. Es una reorganización: no cambia la funcionalidad, la lógica ni la seguridad (HU-003).

Convención para cualquier proyecto del workspace que envíe correo (hoy solo `rest_usuario`):

- Una carpeta `correo/` en la raíz del proyecto con `README.md`, `EnviadorCorreo.php`, `PlantillasCorreo.php`, `cargarCorreo.php` y `probarCorreo.php`.
- Cada línea que envía correo lleva el comentario `// [CORREO] <plantilla>`; `grep -rn "\[CORREO\]" . --include=*.php --exclude-dir=vendor` los lista.
- Los registros de local (modo `log`) van en `logs/correos/`.
- Las claves de correo van juntas en el bloque `# ===== Correo =====` de `.env` y `.env.ejemplo`.

## 2. Archivos

| Archivo | Responsabilidad |
|---------|-----------------|
| `EnviadorCorreo.php` | Envía (o, en modo `log`, archiva) un correo ya armado. Valida el destinatario y conoce su carpeta de registros. Es el único archivo que usa PHPMailer. |
| `PlantillasCorreo.php` | Solo produce el texto (asunto y cuerpo) de las 4 plantillas. |
| `cargarCorreo.php` | Solo carga las dos clases con `require_once`. Es el único `require` que hacen los 5 archivos que envían correo. |
| `probarCorreo.php` | Prueba manual por consola. No es un punto de producción y no lleva marca. |
| `README.md` | Este documento. |

## 3. Modos

`CORREO_MODO` admite tres valores (reglas en `configuracion/Configuracion.php`):

- `log`: solo con `APP_ENTORNO=local`. No envía nada: escribe `logs/correos/correos.log` y un `correo-*.txt` por correo. En producción lanza error.
- `smtp`: cuenta SMTP real con `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE` y `SMTP_CIFRADO` (`tls`, `ssl` o `ninguno`; `ninguno` solo en local).
- `mail`: función `mail()` de PHP; solo en un hosting con servicio de correo propio. Se ignoran los `SMTP_*`, pero `SMTP_HOST` y `SMTP_PUERTO` deben tener un valor válido.

El destinatario no puede contener saltos de línea y debe ser una dirección válida.

## 4. Plantillas

| Plantilla | Quién la usa |
|-----------|--------------|
| `codigoVerificacion` | Registro (`PersonaCtrl`) y reenvío del código (`VerificacionCtrl`) |
| `codigoRecuperacion` | Solicitud de recuperación de clave (`ClaveCtrl::solicitarRecuperacion`) |
| `avisoCambioClave` | Aviso tras restablecer o cambiar la clave (`ClaveCtrl`) |
| `alertaSeguridad` | Mantenimiento de seguridad (`AlertasSeguridad`) |

## 5. Mapa de puntos de llamada

Los números de línea salen de `grep -rn "\[CORREO\]"` (estado tras HLT-12).

| Archivo | Línea | Plantilla | Si el envío falla |
|---------|-------|-----------|-------------------|
| `controladores/PersonaCtrl.php` | 160 | `codigoVerificacion` | Se registra en `error_log` y el registro no se revierte; la respuesta sigue siendo 200 uniforme |
| `controladores/ClaveCtrl.php` | 57 | `codigoRecuperacion` | Se registra en `error_log`; respuesta 200 uniforme y misma auditoría |
| `controladores/ClaveCtrl.php` | 190 | `avisoCambioClave` | Se registra en `error_log`; la respuesta de éxito no cambia. Dos disparadores: `ClaveCtrl::restablecerClave` y `ClaveCtrl::actualizarClave` |
| `controladores/VerificacionCtrl.php` | 104 | `codigoVerificacion` | Se registra en `error_log`; respuesta 200 uniforme |
| `servicios/AlertasSeguridad.php` | 35 | `alertaSeguridad` | Sin captura local: la excepción llega a `mantenimiento/limpiarSeguridad.php`, que registra y termina con error; no se escribe la marca de alerta |

Fila aparte, no es punto de producción: `correo/probarCorreo.php` (prueba por consola; error por `STDERR` y `exit(1)`).

## 6. Registros de local

Solo en modo `log`, en `logs/correos/` (se crea bajo demanda):

- `logs/correos/correos.log`: todos los correos, acumulados.
- `correo-AAAAMMDD-HHMMSS-xxxxxx.txt`: un archivo por correo, con cabeceras de correo real.
- `registro-omitido-AAAAMMDD-HHMMSS-xxxxxx.txt`: aviso de que un registro con correo ya existente no creó cuenta (solo con `APP_ENTORNO=local`).

La carpeta no se versiona (`.gitignore` ya excluye `/logs/*`) ni es accesible por web (la lista blanca de `.htaccess` solo deja pasar `index.php`). Los códigos nunca se escriben en `php_errores.log`.

## 7. Configuración

Las 9 claves: `CORREO_MODO`, `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_CIFRADO`, `CORREO_REMITENTE`, `CORREO_REMITENTE_NOMBRE` y `CORREO_ALERTAS`. Están agrupadas en `.env.ejemplo` bajo `# ===== Correo =====`.

Para tu `.env` local: si quieres, mueve a mano tus 9 claves de correo juntas bajo un encabezado `# ===== Correo =====`; el orden no afecta porque `Configuracion` las lee por nombre. Nadie debe pegar valores de `.env` en este archivo ni en el repositorio.

## 8. Cómo probar

Desde la raíz de `rest_usuario`:

```
C:\xampp\php\php.exe correo/probarCorreo.php destino@correo.com
```

En modo `log` el resultado queda en `logs/correos/`.

## 9. Seguridad

- La lista blanca de `.htaccess` impide acceder a esta carpeta por web.
- `AlertasSeguridad.php` y `AlertasSeguridadMdl.php` no se mueven aquí por ser lógica de seguridad; solo llevan la marca.
- Los tiempos uniformes de respuesta (`BaseCtrl`) no cambian.
- El módulo no carga `vendor/autoload.php` ni `Configuracion.php`: los carga el arranque (`index.php` o el script de consola).

## 10. Lo que se conserva y por qué

- Las validaciones de las claves de correo en la copia compartida de `Configuracion.php` de los backends que no envían correo se conservan para mantener la copia compartida.
- El modo `mail` se conserva hasta HLT-11.

## 11. Alternativa aplazada

Un microservicio `rest_correo` aparte quedó descartado por ahora (HU-003 rev. 2): añadiría superficie de ataque y una llamada de red en rutas con tiempos uniformes. Solo se retomaría con una historia nueva si más de un servicio necesitara enviar correo.
