-- ============================================================================
-- rest_criteriokelly · PROCEDIMIENTOS ALMACENADOS de los resultados de Kelly (opcionales)
-- Manual de uso y del código PHP a dejar: procedimientos.md (misma carpeta).
--
-- QUÉ HACE ESTE SCRIPT
--   Crea 2 procedimientos en la base `sist_criteriokelly`. NO inserta ni modifica datos
--   y NO llama a los procedimientos: solo los deja creados. Se puede ejecutar varias veces
--   (hace DROP PROCEDURE IF EXISTS de sus dos procedimientos y los vuelve a crear).
--
-- CÓMO EJECUTARLO (gestor de base de datos: phpMyAdmin, Workbench, HeidiSQL, DBeaver…)
--   1. Seleccione la base `sist_criteriokelly` y abra una pestaña SQL.
--   2. Pegue TODO el archivo (el gestor debe aceptar DELIMITER; en phpMyAdmin se pone
--      en el cuadro «Delimitador» el valor $$ o se deja el del archivo).
--   3. Ejecute con un usuario que tenga CREATE ROUTINE y ALTER ROUTINE (root en local;
--      en el hosting, el usuario administrador del panel). `ck_aplicacion` solo necesita
--      EXECUTE (ya lo tiene) para llamarlos, no para crearlos.
--
-- LÍNEAS QUE SE DESACTIVAN SEGÚN EL SERVIDOR (anteponer `-- `)
--   - Servidor SIN permiso CREATE ROUTINE (hosting compartido): no se puede crear nada;
--     no ejecute este archivo, la aplicación sigue funcionando con su PHP actual.
--   - Si el gestor NO soporta DELIMITER: ejecute cada procedimiento por separado
--     (bloque DROP + bloque CREATE) usando la opción «ejecutar como un solo comando».
--   - Si no quiere que se vuelvan a crear: comente las 2 líneas `DROP PROCEDURE IF EXISTS`.
--   - Los ejemplos `CALL` del final están comentados; se activan solo para probar.
--   Los procedimientos no llevan DEFINER a propósito (evita el error 1227 en el hosting)
--   y usan SQL SECURITY INVOKER: se ejecutan con los permisos de quien los llama.
--
-- SI PASAN A SER PARTE DE LA BASE: regenerar sist_criteriokelly_estructura.sql con
--   `mysqldump --no-data --routines` y, para que la aplicación los use, DESACTIVAR las
--   llamadas PHP equivalentes (ver procedimientos.md, Paso 3, Caso B);
--   si no, cada operación guardaría los resultados dos veces.
-- ============================================================================

USE `sist_criteriokelly`;

DELIMITER $$

-- ----------------------------------------------------------------------------
-- 1) Resultados de las operaciones de una cuenta (tabla sckr_resultado)
--    Es EXACTAMENTE la misma consulta que ejecuta hoy el PHP
--    (ReglasKellyMdl::insertarResultadoOperativas): cuenta las operaciones activas
--    (bit_estado = '1') y calcula cada porcentaje en escala 0-100.
--    Una operación sin resultado (NULL o '') cuenta como abierta.
--    p_idResultado = id insertado, o 0 si la cuenta no tiene operaciones.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_resultado_operativas`$$
CREATE PROCEDURE `sp_resultado_operativas`(
    IN  p_idCuenta     INT,
    IN  p_idUsuario    INT,
    IN  p_identifica   VARCHAR(32),
    OUT p_idResultado  INT
)
SQL SECURITY INVOKER
BEGIN
    SET p_idResultado = 0;

    INSERT INTO sckr_resultado(res_cueIdCuentas, res_opeGanador, res_x100Ganador, res_opePerdedor, res_x100Perdedor, res_opeBreakEven, res_x100BreakEven, res_operAbierta, res_x100Abierta, res_totalOperac, res_x100Total, res_identifica)
    SELECT bta.bit_cueIdCuentas AS cuenta_id,
        SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) AS operaciones_ganadoras,
        ROUND((SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_ganador,
        SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) AS operaciones_perdedoras,
        ROUND((SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_perdedor,
        SUM(CASE WHEN bta.bit_resultado = 'BREAK EVEN' THEN 1 ELSE 0 END) AS operaciones_break_even,
        ROUND((SUM(CASE WHEN bta.bit_resultado = 'BREAK EVEN' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_break_even,
        SUM(CASE WHEN bta.bit_resultado IS NULL OR bta.bit_resultado = '' THEN 1 ELSE 0 END) AS en_operacion,
        ROUND((SUM(CASE WHEN bta.bit_resultado IS NULL OR bta.bit_resultado = '' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 3) AS porcentaje_en_operacion,
        COUNT(*) AS total_operaciones, 100 AS x100total, p_identifica
    FROM sckb_bitacora bta
    WHERE bta.bit_cueIdCuentas = p_idCuenta AND bta.bit_usuarioId = p_idUsuario AND bta.bit_estado = '1'
    GROUP BY bta.bit_cueIdCuentas;

    IF ROW_COUNT() > 0 THEN
        SET p_idResultado = LAST_INSERT_ID();
    END IF;
END$$

-- ----------------------------------------------------------------------------
-- 2) Riesgo / beneficio de una cuenta (tabla sckr_riesgobeneficio)
--    Es EXACTAMENTE la misma consulta que ejecuta hoy el PHP
--    (ReglasKellyMdl::insertarRiesgoBeneficio). Calcula desde la bitácora (operaciones
--    activas): monto promedio ganado y perdido (1 si no hay operaciones de ese tipo),
--    su relación (0 si el promedio perdido no es mayor que 0) y la esperanza matemática
--    con los porcentajes como FRACCIÓN (0 a 1).
--    p_idRiesgo = id insertado, o 0 si la cuenta no tiene operaciones.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_riesgo_beneficio`$$
CREATE PROCEDURE `sp_riesgo_beneficio`(
    IN  p_idCuenta    INT,
    IN  p_idUsuario   INT,
    IN  p_identifica  VARCHAR(32),
    OUT p_idRiesgo    INT
)
SQL SECURITY INVOKER
BEGIN
    SET p_idRiesgo = 0;

    INSERT INTO sckr_riesgobeneficio(rib_cueIdCuentas, rib_montoGanan, rib_relacionGanan, rib_montoRiesgo, rib_relacionRiesgo, rib_mtoEspeMatem, rib_relaEspeMate, rib_identifica)
    WITH estadisticas_base AS (
        SELECT  bta.bit_cueIdCuentas AS idCuenta, bta.bit_usuarioId,
            SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN 1 ELSE 0 END) AS ops_ganadoras,
            SUM(CASE WHEN bta.bit_resultado = 'GANADOR' THEN bta.bit_montoResult ELSE 0 END) AS monto_ganado_total,
            SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN 1 ELSE 0 END) AS ops_perdedoras,
            SUM(CASE WHEN bta.bit_resultado = 'PERDEDOR' THEN bta.bit_montoResult ELSE 0 END) AS monto_perdido_total,
            COUNT(*) AS total_operaciones
        FROM sckb_bitacora bta
        WHERE bta.bit_cueIdCuentas = p_idCuenta AND bta.bit_usuarioId = p_idUsuario AND bta.bit_estado = '1'
        GROUP BY bta.bit_cueIdCuentas, bta.bit_usuarioId
    ),
    metricas_calculadas AS (
        SELECT *,
            CASE WHEN ops_ganadoras > 0 THEN monto_ganado_total / ops_ganadoras ELSE 1 END AS monto_ganador,
            CASE WHEN ops_perdedoras > 0 THEN monto_perdido_total / ops_perdedoras ELSE 1 END AS monto_perdedor,
            CASE WHEN total_operaciones > 0 THEN ROUND((ops_ganadoras) / total_operaciones, 3) ELSE 0 END AS porcentaje_ganador,
            CASE WHEN total_operaciones > 0 THEN ROUND((ops_perdedoras) / total_operaciones, 3) ELSE 0 END AS porcentaje_perdedor
        FROM estadisticas_base
    )
    SELECT idCuenta, monto_ganador AS monto_promedio_ganador,
        CASE WHEN monto_perdedor > 0 THEN monto_ganador / monto_perdedor ELSE 0 END AS ratio_ganador_perdedor,
        monto_perdedor AS monto_promedio_perdedor, 1,
        (monto_ganador * porcentaje_ganador) - (monto_perdedor * porcentaje_perdedor) AS monto_espe_matematica,
        CASE WHEN monto_perdedor > 0 THEN ((monto_ganador / monto_perdedor) * porcentaje_ganador) - (1 * (porcentaje_perdedor)) ELSE 0 END AS relacion_espe_matematica,
        p_identifica
    FROM metricas_calculadas;

    IF ROW_COUNT() > 0 THEN
        SET p_idRiesgo = LAST_INSERT_ID();
    END IF;
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- EJEMPLO DE PRUEBA (comentado: activar solo en una base de pruebas; INSERTA filas)
--   Sustituya 1 y 1 por una cuenta y un usuario reales de la misma cuenta.
-- ----------------------------------------------------------------------------
-- SET @identifica = REPLACE(UUID(), '-', '');
-- CALL sp_resultado_operativas(1, 1, @identifica, @idResultado);
-- CALL sp_riesgo_beneficio(1, 1, @identifica, @idRiesgo);
-- SELECT @idResultado, @idRiesgo;
-- SELECT * FROM sckr_resultado WHERE res_idResultado = @idResultado;
-- SELECT * FROM sckr_riesgobeneficio WHERE rib_idRiesBenef = @idRiesgo;
-- -- Limpieza de la prueba:
-- -- DELETE FROM sckr_riesgobeneficio WHERE rib_identifica = @identifica;
-- -- DELETE FROM sckr_resultado WHERE res_identifica = @identifica;
