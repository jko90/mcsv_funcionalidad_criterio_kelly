# Manual de los procedimientos de suscripción

Cubre los dos archivos de esta carpeta:

1. [`Procedimientos NuevaSuscripcion.sql`](#archivo-1-procedimientos-nuevasuscripcionsql): crea `crear_suscripcion` y `crear_suscripcion_con_pago`.
2. [`Procedimientos RenovacionAutomatica.sql`](#archivo-2-procedimientos-renovacionautomaticasql): crea `procesar_renovaciones`.

Los procedimientos hacen **exactamente lo mismo que el PHP** (mismos controles, mismos mensajes, mismos datos). Por eso **solo uno de los dos debe trabajar a la vez**.

## La regla: un solo lado trabaja

| Estado del procedimiento en la base | Qué hace el PHP |
|-------------------------------------|-----------------|
| **NO está creado** (o no tienes permiso) | El PHP hace el trabajo con su código actual (**modo PHP**). No cambies nada |
| **SÍ está creado y lo habilitas** | El PHP **llama al procedimiento** y su código actual queda **comentado** (**modo base de datos**) |

Nunca dejes los dos activos: cada alta se haría dos veces. Y al revés, si dejas de usar el procedimiento (lo borras o ya no tienes permiso), **descomenta el código del PHP y quita la llamada**.

## Antes de empezar: ¿tienes permiso en la base de datos?

Para **crear** un procedimiento hace falta un usuario con `CREATE ROUTINE` y `ALTER ROUTINE`:

- **En tu equipo (XAMPP):** `root` los tiene.
- **En el hosting:** el administrador del panel suele tenerlos; en hosting compartido a veces no.

Para **llamarlos** basta `EXECUTE`, que `ck_aplicacion` ya tiene. Ejecutar un archivo **solo crea** los procedimientos; no cambia ningún dato.

**Cómo ejecutar un archivo** (cuando tienes permiso):

1. Abre tu gestor (phpMyAdmin, Workbench, HeidiSQL, DBeaver…), elige la base `sist_criteriokelly` y abre la pestaña SQL.
2. Pega el contenido del archivo y ejecútalo. El gestor debe aceptar `DELIMITER $$` (en phpMyAdmin escribe `$$` en el cuadro «Delimitador»).
3. Comprueba: `SHOW PROCEDURE STATUS WHERE Db = 'sist_criteriokelly';`

**Si algo falla**, líneas que se desactivan (poniendo `-- ` al inicio):

| Problema | Qué hacer |
|----------|-----------|
| El gestor no entiende `DELIMITER` | Ejecuta cada `DROP` y cada `CREATE` por separado, como un solo comando, y borra las líneas `DELIMITER` y los `$$` |
| No quieres recrearlos al repetir el archivo | Comenta las líneas `DROP PROCEDURE IF EXISTS` |
| Error 1227 («necesita SUPER») | El usuario no tiene `CREATE ROUTINE`: usa otro usuario |

---

## Archivo 1: `Procedimientos NuevaSuscripcion.sql`

| Procedimiento | Qué hace | Es lo mismo que (PHP) |
|---------------|----------|-----------------------|
| `crear_suscripcion(usuario, plan)` | Crea una suscripción **pendiente** de 1 mes | `SuscripcionCtrl::insertarSuscripcionSinPago` (`crearSinPago`) |
| `crear_suscripcion_con_pago(usuario, plan, transacción, método, comprobante, correo, criptomoneda, suscripción)` | Registra el pago **en revisión** con su comprobante y deja la suscripción pendiente | `SuscripcionCtrl::insertarSuscripcionConPago` (`crearConPago`) |

El plan se indica con el número de la combinación plan × intervalo (2 = Básico mensual). Un plan de pago **nunca queda activo** desde estos procedimientos: queda pendiente hasta que el administrador valida el comprobante.

### Si NO tienes permiso en la base de datos (modo PHP)

- **Base de datos:** nada. No ejecutes el archivo.
- **PHP:** nada. Es lo que funciona hoy.

### Si TIENES permiso y habilitas los procedimientos (modo base de datos)

**1. En la base de datos:** ejecuta el archivo y comprueba que aparecen los dos procedimientos.

**2. En PHP**, en tres archivos. Antes de cambiar algo, **comenta** (no borres) el código actual.

**a) `configuracion/enlace.php`:** agrega este método a la clase `Enlace` (lee la fila que devuelve el procedimiento y limpia lo que sobra de la llamada):

```php
    public function ejecutarProcedimientoUnaFila(string $sql, string $types = "", ...$params): ?array
    {
        $stmt = $this->prepararYBind($sql, $types, ...$params);
        try {
            $stmt->execute();
            $resultado = $stmt->get_result();
            $fila = $resultado ? $resultado->fetch_assoc() : null;
            if ($resultado) {
                $resultado->free();
            }
            while ($stmt->more_results()) {
                $stmt->next_result();
            }
            return $fila;
        } catch (Exception $e) {
            error_log("[Enlace::ejecutarProcedimientoUnaFila] " . $e->getMessage());
            throw $e;
        } finally {
            $stmt->close();
        }
    }
```

**b) `modelos/SuscripcionMdl.php`:** agrega estos dos métodos a la clase (los métodos que ya existen se quedan, simplemente dejan de usarse):

```php
    public function crearSuscripcionPorProcedimiento(int $idUsuario, int $idPlan): ?array
    {
        return $this->conexion->ejecutarProcedimientoUnaFila(
            'CALL crear_suscripcion(?, ?)',
            'ii',
            $idUsuario,
            $idPlan
        );
    }

    public function crearSuscripcionConPagoPorProcedimiento(
        int $idUsuario,
        int $idPlan,
        string $idTransaccion,
        string $metodoPago,
        ?string $comprobante,
        ?string $correoTransaccion,
        ?string $criptomoneda,
        ?int $idSuscripcion
    ): ?array {
        return $this->conexion->ejecutarProcedimientoUnaFila(
            'CALL crear_suscripcion_con_pago(?, ?, ?, ?, ?, ?, ?, ?)',
            'iisssssi',
            $idUsuario,
            $idPlan,
            $idTransaccion,
            $metodoPago,
            $comprobante,
            $correoTransaccion,
            $criptomoneda,
            $idSuscripcion
        );
    }
```

**c) `controladores/SuscripcionCtrl.php`:**

1. Agrega esta constante y este método a la clase. Traducen los errores del procedimiento a los mismos códigos HTTP que devuelve hoy el PHP:

```php
    private const ERRORES_PROCEDIMIENTO = [
        'El plan seleccionado no es válido' => 400,
        'El plan seleccionado no requiere pago' => 400,
        'La suscripción no corresponde al plan' => 400,
        'El usuario ya tiene una suscripción pendiente o activa' => 409,
        'La transacción ya fue registrada' => 409,
        'La suscripción no admite pagos' => 409,
    ];

    private function responderErrorProcedimiento(mysqli_sql_exception $error, string $origen): void
    {
        $mensaje = $error->getMessage();
        if ($mensaje === 'Acceso denegado') {
            $this->denegarAcceso($origen);
        }
        if (isset(self::ERRORES_PROCEDIMIENTO[$mensaje])) {
            $this->respuestaErrorSimple($mensaje, self::ERRORES_PROCEDIMIENTO[$mensaje]);
        }
        error_log('[' . $origen . '] ' . $mensaje);
        $this->respuestaErrorSimple('Error interno del servidor', 500);
    }
```

2. **Comenta** el método `insertarSuscripcionSinPago` actual completo y pega este en su lugar:

```php
    public function insertarSuscripcionSinPago(array $datos): void
    {
        try {
            $this->verificarUsuarioEnviado($datos['sus_usuarioId'] ?? null, 'suscripcion/crearSinPago');
            $idPlan = $this->leerEntero($datos['sus_pinIdPlanin'] ?? null, 'sus_pinIdPlanin');
            $idUsuario = $this->idUsuarioSesion();
            // Modo base de datos: el procedimiento valida, abre su transacción y crea la suscripción
            $suscripcion = $this->suscripcionServicio->crearSuscripcionPorProcedimiento($idUsuario, $idPlan);
            if ($suscripcion === null) {
                $this->respuestaErrorSimple('No se encontraron detalles de la suscripción', 404);
            }
            $this->respuestaExitosaSimple($this->formatearSuscripcion($suscripcion));
        } catch (mysqli_sql_exception $error) {
            $this->responderErrorProcedimiento($error, 'SuscripcionCtrl::insertarSuscripcionSinPago');
        } catch (Throwable $error) {
            error_log('[SuscripcionCtrl::insertarSuscripcionSinPago] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
```

3. En `insertarSuscripcionConPago`, **deja** las lecturas y validaciones de los datos (desde `verificarUsuarioEnviado` hasta `$idSuscripcionEnviada`) y **comenta todo lo que viene después** (desde `$plan = ...` hasta el final del `try`). Debajo de las validaciones pon:

```php
            // Modo base de datos: el procedimiento valida el plan, la transacción, el pago y guarda todo
            $suscripcionFinal = $this->suscripcionServicio->crearSuscripcionConPagoPorProcedimiento(
                $idUsuario,
                $idPlan,
                $idTransaccion,
                $metodoPago,
                $comprobante,
                $correoTransaccion,
                $criptomoneda === '' ? null : $criptomoneda,
                $idSuscripcionEnviada
            );
            if ($suscripcionFinal === null) {
                $this->respuestaErrorSimple('No se encontraron detalles de la suscripción', 404);
            }
            $this->respuestaExitosaSimple($this->formatearSuscripcion($suscripcionFinal));
```

y cambia el `catch` final por:

```php
        } catch (mysqli_sql_exception $error) {
            $this->responderErrorProcedimiento($error, 'SuscripcionCtrl::insertarSuscripcionConPago');
        } catch (Throwable $error) {
            error_log('[SuscripcionCtrl::insertarSuscripcionConPago] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
```

(en este método ya no se usa `$transaccionIniciada` ni `$this->enlace->iniciarTransaccion()`: la transacción la abre el procedimiento).

**3. Probar:** crea una suscripción desde la app y comprueba que el resultado es el mismo que antes. Si el procedimiento da un error nuevo, aparece en `php_errores.log`.

### Para volver al modo PHP

Borra los procedimientos (`DROP PROCEDURE IF EXISTS crear_suscripcion;` y `DROP PROCEDURE IF EXISTS crear_suscripcion_con_pago;`) y **descomenta** los métodos originales del controlador, quitando los de modo base de datos. Si no lo haces, la app fallará porque el procedimiento ya no existe.

### Probarlo a mano (solo en una base de pruebas: crea datos)

```sql
CALL crear_suscripcion(1, 2);
CALL crear_suscripcion_con_pago(1, 2, 'PRUEBA-0001', 'BANCO', NULL, NULL, NULL, NULL);
```

---

## Archivo 2: `Procedimientos RenovacionAutomatica.sql`

| Procedimiento | Qué hace |
|---------------|----------|
| `procesar_renovaciones()` | Revisa, cuenta por cuenta, los planes de pago cuyo periodo terminó y las renovaciones pendientes de pago, y aplica las mismas reglas que el PHP (`PlanVigenteSrv` y `LectorPlanVigente`) |

**Qué hace, en palabras sencillas:**

1. **Corta el plan que terminó.** Un plan de pago activo cuya fecha de corte ya pasó (vale hasta el final de ese día) se da por terminado y se anota en el historial.
2. **Activa el periodo ya pagado por anticipado.** Si la persona había pagado antes el periodo siguiente, ese periodo pasa a activo sin interrupción y no se crea ninguna renovación.
3. **Crea la renovación pendiente de pago.** Si no hay periodo pagado por anticipado, el plan tenía renovación automática, no hay otro plan de pago vigente y no existe ya una pendiente del mismo plan, se crea una renovación pendiente. Empieza el día siguiente al corte y termina **30 días después del corte**: ese es el plazo que tiene la persona para pagar.
4. **Anula la renovación que no se pagó.** Cuando pasan los 30 días y no hay un comprobante en revisión ni un pago confirmado, la renovación se anula y, si la cuenta queda sin ningún plan vigente, recibe un **plan Libre nuevo de 10 días** (240 horas) desde ese momento. Al terminar ese Libre la cuenta queda sin plan. Mientras haya un comprobante en revisión no se anula: se espera la decisión del administrador (si lo rechaza, se anula en la siguiente revisión).

**No cobra, no registra ningún pago y no cambia las fechas del plan que terminó.** La persona paga subiendo un comprobante nuevo, que valida el administrador. Cuando exista una pasarela de pago, será ella quien confirme el pago. Si la persona cancela su plan (renovación automática desactivada), no se crea la renovación. La prueba y el Libre no se renuevan; su vencimiento lo sigue resolviendo el PHP al consultar el plan.

**Diferencias deliberadas con el PHP:** el procedimiento anota `PROCEDIMIENTO` como IP en el historial y no escribe la auditoría (`sgen_auditoria`); el PHP anota la IP real y emite `PLAN_CORTADO`, `PLAN_RENOVACION`, `PLAN_ACTIV_PROGRAM` y `PLAN_RENOV_ANULADA`. El resto de los datos que dejan son iguales (acciones del historial `CORTADA`, `ACTIVACION`, `renovacion`, `ANULADA` y `TRANSICION`).

**El PHP ya hace este trabajo por sí mismo.** Desde HLT-16, `PlanVigenteSrv` aplica estos pasos cuando alguien consulta su plan vigente (sin cron). El procedimiento es una alternativa equivalente para hostings que prefieran programarlo en la base de datos.

### La regla de oro de este procedimiento

**Nunca deben estar activos los dos a la vez.** Si el procedimiento está creado y habilitado en la base de datos, el PHP debe llamarlo y **no** ejecutar su propia lógica de corte, renovación, anulación y activación. Si el procedimiento no está creado, el PHP trabaja solo, como viene hoy.

Si conviven por descuido no se rompe nada: ambos solo actúan sobre filas bloqueadas con `FOR UPDATE` y quien llega segundo las encuentra ya cambiadas y no hace nada. Aun así, el modo oficial es uno solo.

### Si NO tienes permiso en la base de datos (modo PHP)

- **Base de datos:** nada. No ejecutes el archivo.
- **PHP:** nada. `PlanVigenteSrv` ya hace el corte, la renovación, la anulación y la activación.

### Si TIENES permiso y habilitas el procedimiento (modo procedimiento)

**1. En la base de datos:** ejecuta el archivo y comprueba que aparece `procesar_renovaciones` con `SHOW PROCEDURE STATUS WHERE Db = 'sist_criteriokelly';`.

**2. En PHP:** edita `servicios/PlanVigenteSrv.php`. **Comenta** (no borres) el código actual del paso de corte y renovación y agrega la llamada al procedimiento.

**a)** En `resolver()`, antes de decidir si hay transiciones, agrega este bloque (llama al procedimiento solo cuando la cuenta tiene un paso de corte, activación, renovación o anulación pendiente, y lo hace **fuera** de cualquier transacción porque el procedimiento abre las suyas):

```php
    public function resolver(int $idUsuario): array
    {
        $evaluacion = $this->lector->leer($idUsuario);

        // Modo procedimiento: la base de datos aplica el corte, la activación, la renovación y la anulación
        if ($this->tienePasosDeRenovacion($evaluacion['pasos'])) {
            $this->enlace->ejecutarActualizacion('CALL procesar_renovaciones()');
            $evaluacion = $this->lector->leer($idUsuario);
        }

        if ($evaluacion['pasos'] !== []) {
            $this->aplicarTransiciones($idUsuario);
            $evaluacion = $this->lector->leer($idUsuario);
        }
        return $this->armarRespuesta($evaluacion, $this->lector->ahora());
    }

    /** @param array<int, array<string, mixed>> $pasos */
    private function tienePasosDeRenovacion(array $pasos): bool
    {
        $tiposDelProcedimiento = [
            LectorPlanVigente::PASO_CORTAR_PAGO,
            LectorPlanVigente::PASO_ACTIVAR_PROGRAMADA,
            LectorPlanVigente::PASO_CREAR_RENOVACION,
            LectorPlanVigente::PASO_ANULAR_RENOVACION,
        ];
        foreach ($pasos as $paso) {
            if (in_array($paso['tipo'], $tiposDelProcedimiento, true)) {
                return true;
            }
        }
        return false;
    }
```

**b)** En `ejecutarPasos()`, **comenta** las cuatro ramas que ahora hace el procedimiento (quedan solo `EXPIRAR_PRUEBA`, `EXPIRAR_LIBRE` y `CREAR_LIBRE` por vencimiento de la prueba):

```php
                // Modo procedimiento: estos pasos los aplica procesar_renovaciones()
                // LectorPlanVigente::PASO_CORTAR_PAGO => $this->cortarPago($idUsuario, $paso, $momento),
                // LectorPlanVigente::PASO_ACTIVAR_PROGRAMADA => $this->activarProgramada($idUsuario, $paso, $momento),
                // LectorPlanVigente::PASO_CREAR_RENOVACION => $this->crearRenovacion($idUsuario, $paso, $momento, $idsReales),
                // LectorPlanVigente::PASO_ANULAR_RENOVACION => $this->anularRenovacion($idUsuario, $paso, $momento, $idsReales),
```

y deja en su lugar esta rama para que un paso inesperado no se aplique dos veces:

```php
                LectorPlanVigente::PASO_CORTAR_PAGO,
                LectorPlanVigente::PASO_ACTIVAR_PROGRAMADA,
                LectorPlanVigente::PASO_CREAR_RENOVACION,
                LectorPlanVigente::PASO_ANULAR_RENOVACION => null,
```

**c)** Un detalle: el Libre que concede la anulación (`CREAR_LIBRE` de tipo `ANULACION`) lo crea el procedimiento. En `crearLibre()`, si el paso es de origen `LectorPlanVigente::ORIGEN_LIBRE_ANULACION`, devuelve `null` sin escribir nada en modo procedimiento.

**3. Probar:** consulta `suscripcion/planVigente` con una cuenta de prueba cuyo plan de pago terminó y comprueba que el historial muestra `PROCEDIMIENTO` como IP y que el resultado es el mismo que en modo PHP.

**Cuidado con el costo:** el procedimiento revisa **todas** las cuentas con pasos pendientes, no solo la de quien consulta. Por eso el código de arriba lo llama únicamente cuando la cuenta que consulta tiene un paso pendiente. Si prefieres programarlo (cron del hosting, una vez al día), llama `CALL procesar_renovaciones()` desde un script de línea de comandos y deja el PHP en modo procedimiento.

### Para volver al modo PHP

Borra el procedimiento (`DROP PROCEDURE IF EXISTS procesar_renovaciones;`), quita la tarea programada si la creaste y **descomenta** las ramas de `ejecutarPasos()`, quitando el bloque del procedimiento en `resolver()`. Si no lo haces, la app fallará porque el procedimiento ya no existe.

### Probarlo (solo en una base de pruebas: modifica datos)

```sql
CALL procesar_renovaciones();
```

Con los datos actuales de la base viva procesaría a la cuenta 1: la suscripción 28 (Enterprise semestral con corte el 2026-03-04) se daría por terminada y, como esa cuenta tiene un periodo ya pagado (la pendiente 30, con un pago confirmado), ese periodo pasaría a activo y no se crearía renovación. No toca ningún otro dato.

---

## Resumen

| | Modo PHP (sin procedimientos) | Modo base de datos (con procedimientos) |
|--|-------------------------------|------------------------------------------|
| **Base de datos** | No ejecutar nada | Ejecutar los archivos y comprobar con `SHOW PROCEDURE STATUS` |
| **PHP: altas de suscripción** | Código actual | Comentar el código actual y llamar al procedimiento (código del Archivo 1) |
| **PHP: renovación** | `PlanVigenteSrv` corta, renueva, anula y activa | Comentar esos pasos y llamar a `procesar_renovaciones()` (código del Archivo 2) |
| **Los dos a la vez** | **Nunca** | **Nunca** |

## Si los procedimientos pasan a ser parte de la base

Regenera `sist_suscripcion_estructura.sql` (`mysqldump --no-data --routines`) para que los incluya. Si se actualiza un procedimiento, vuelve a ejecutar su archivo. Si cambia el PHP de alguno de estos flujos, el procedimiento y el código del modo base de datos deben actualizarse igual.

## Para quitarlos

```sql
DROP PROCEDURE IF EXISTS crear_suscripcion;
DROP PROCEDURE IF EXISTS crear_suscripcion_con_pago;
DROP PROCEDURE IF EXISTS procesar_renovaciones;
```
