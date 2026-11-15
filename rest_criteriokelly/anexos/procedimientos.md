# Manual: procedimientos de Kelly en la base de datos

`procedimientos.sql` crea dos procedimientos en `sist_criteriokelly` que hacen los cálculos de resultados y de riesgo/beneficio. Hoy esos cálculos se ejecutan desde PHP (`modelos/ReglasKellyMdl.php`). Este manual dice qué hacer en la base y qué dejar en PHP en cada caso. **Los dos caminos dan los mismos resultados.**

| Procedimiento | Llena la tabla |
|---------------|----------------|
| `sp_resultado_operativas(cuenta, usuario, identificador, OUT idResultado)` | `sckr_resultado` |
| `sp_riesgo_beneficio(cuenta, usuario, identificador, OUT idRiesgo)` | `sckr_riesgobeneficio` |

## La regla: un solo lado trabaja

| Estado de los procedimientos en la base | Qué hace el PHP |
|-----------------------------------------|-----------------|
| **NO están creados** (o no tienes permiso) | El PHP calcula con su código actual (**modo PHP**, Caso A). No cambies nada |
| **SÍ están creados y los habilitas** | El PHP **llama a los procedimientos** y su código actual queda **comentado** (**modo base de datos**, Caso B) |

**Nunca dejes los dos activos:** cada operación guardaría sus resultados dos veces. Si dejas de usar los procedimientos (los borras o ya no tienes permiso), **descomenta el código original del PHP** y quita la llamada.

## Paso 1. ¿Tienes permiso en el servidor?

Hace falta un usuario con **CREATE ROUTINE y ALTER ROUTINE** (root en local, el administrador del panel en el hosting).

| Servidor | Qué hacer |
|----------|-----------|
| **Sí hay permiso** | Sigue en el Paso 2 |
| **No hay permiso** (hosting compartido) | No ejecutes el SQL. Deja el PHP como está (**Caso A**) |

## Paso 2. Ejecutar el SQL (solo si hay permiso)

1. En el gestor (phpMyAdmin, Workbench, HeidiSQL, DBeaver…) selecciona la base `sist_criteriokelly` y abre una pestaña SQL.
2. Pega todo `procedimientos.sql` y ejecútalo. El gestor debe aceptar `DELIMITER $$` (en phpMyAdmin escribe `$$` en el cuadro «Delimitador»).
3. Comprueba que existen:

   ```sql
   SHOW PROCEDURE STATUS WHERE Db = 'sist_criteriokelly';
   ```

   Deben salir `sp_resultado_operativas` y `sp_riesgo_beneficio`. El usuario de la aplicación (`ck_aplicacion`) ya tiene `EXECUTE`: no hay que dar más permisos.
4. Prueba opcional (inserta filas; usa una cuenta y un usuario reales y bórralas al terminar):

   ```sql
   SET @identifica = REPLACE(UUID(), '-', '');
   CALL sp_resultado_operativas(1, 1, @identifica, @idResultado);
   CALL sp_riesgo_beneficio(1, 1, @identifica, @idRiesgo);
   SELECT @idResultado, @idRiesgo;
   DELETE FROM sckr_riesgobeneficio WHERE rib_identifica = @identifica;
   DELETE FROM sckr_resultado WHERE res_identifica = @identifica;
   ```

### Líneas del SQL que se desactivan (anteponer `-- `)

| Situación | Qué hacer |
|-----------|-----------|
| El gestor no soporta `DELIMITER` | Ejecuta cada procedimiento por separado (su `DROP` y su `CREATE`) como un solo comando; quita las líneas `DELIMITER` y los `$$` |
| No quieres que se vuelvan a crear al repetir el script | Comenta las dos líneas `DROP PROCEDURE IF EXISTS` |
| Error 1227 («necesita SUPER») | El usuario no tiene CREATE ROUTINE: usa otro usuario o no ejecutes el script |

## Paso 3. Qué dejar en PHP

Solo se cambia el modelo. **El controlador `ReglasKellyCtrl.php` no se toca**: sigue llamando a los mismos métodos con los mismos parámetros (cuenta, usuario, identificador).

### Caso A. Los procedimientos NO están en la base (código actual)

Dejar `modelos/ReglasKellyMdl.php` como está: `insertarResultadoOperativas` e `insertarRiesgoBeneficio` ejecutan el SQL directamente (son las consultas que contienen los procedimientos).

### Caso B. Los procedimientos SÍ están en la base

En `modelos/ReglasKellyMdl.php`, **comenta** (no borres) el cuerpo actual de los dos métodos `insertarResultadoOperativas` e `insertarRiesgoBeneficio` y pon en su lugar esto (misma firma, mismo retorno: el id insertado, o 0 si la cuenta no tiene operaciones):

```php
    public function insertarResultadoOperativas($idCuenta, $usuarioId, $identificadorUnico)
    {
        $this->conexion->ejecutarActualizacion(
            'CALL sp_resultado_operativas(?, ?, ?, @id_resultado)',
            'iis',
            $idCuenta,
            $usuarioId,
            $identificadorUnico
        );
        $fila = $this->conexion->ejecutarConsultaSimpleFila('SELECT @id_resultado AS id');
        return (int) ($fila['id'] ?? 0);
    }

    public function insertarRiesgoBeneficio($idCuenta, $usuarioId, $identificadorUnico)
    {
        $this->conexion->ejecutarActualizacion(
            'CALL sp_riesgo_beneficio(?, ?, ?, @id_riesgo)',
            'iis',
            $idCuenta,
            $usuarioId,
            $identificadorUnico
        );
        $fila = $this->conexion->ejecutarConsultaSimpleFila('SELECT @id_riesgo AS id');
        return (int) ($fila['id'] ?? 0);
    }
```

Notas:

- La variable `@id_resultado` vive en la conexión; el modelo usa la misma conexión durante toda la operación, y todo ocurre dentro de la transacción de `finalizaBitacora`.
- El resto de métodos de `ReglasKellyMdl.php` (`obtenerResultadoPorId`, `obtenerRiesgoBeneficioPorId`, `insertarFactorTotal`, `insertarRentabilidad`, `insertarCriterioKelly`…) no cambian.
- No dejes los dos caminos activos a la vez: cada operación guardaría sus resultados dos veces.

### Después de pasar al Caso B

1. Prueba en la app: finaliza una operación en una cuenta de prueba y comprueba que se crea **una sola fila** en `sckr_resultado` y otra en `sckr_riesgobeneficio` con el mismo identificador.
2. Regenera `sist_criteriokelly_estructura.sql` con `mysqldump --no-data --routines` para que el archivo único de estructura incluya los procedimientos.

## Volver al Caso A

Restaura los dos métodos con el SQL directo (la versión del Caso A, de git) y, si quieres, elimina los procedimientos:

```sql
DROP PROCEDURE IF EXISTS sp_resultado_operativas;
DROP PROCEDURE IF EXISTS sp_riesgo_beneficio;
```
