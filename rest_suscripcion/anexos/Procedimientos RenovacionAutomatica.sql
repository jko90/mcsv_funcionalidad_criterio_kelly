-- ============================================================================
-- rest_suscripcion · PROCEDIMIENTO procesar_renovaciones (opcional)
-- Manual de uso, equivalencias con el PHP y qué dejar en PHP: procedimientos.md (misma carpeta).
--
-- QUÉ HACE ESTE SCRIPT
--   Crea el procedimiento `procesar_renovaciones` en la base `sist_criteriokelly`.
--   NO inserta ni modifica datos y NO lo llama: solo lo deja creado.
--   Se puede ejecutar varias veces (hace DROP PROCEDURE IF EXISTS del mismo nombre).
--
-- QUÉ HACE EL PROCEDIMIENTO AL LLAMARLO (HU-004: DT-12, DT-15, DT-16 y DT-17)
--   Hace lo mismo que el corte de PlanVigenteSrv en PHP, usuario por usuario y con las mismas reglas
--   (LectorPlanVigente), repitiendo los pasos hasta que no quede ninguno (máximo 12 por usuario):
--     1. CORTE. Un plan de pago ACTIVO cuya fecha de corte ya pasó (vale hasta el final de ese día, UTC)
--        pasa a Expirada (E) y se anota CORTADA en spsu_historialsuscri.
--     2. PERIODO PROGRAMADO (DT-16). Si la persona ya había pagado por anticipado el periodo siguiente
--        (una suscripción pendiente de plan de pago con un pago confirmado, sin historial `renovacion`),
--        ese periodo pasa a Activa (A) con sus fechas, se anota ACTIVACION y NO se crea renovación.
--     3. RENOVACIÓN PENDIENTE (DT-15). Si no hay periodo programado, el plan cortado tenía renovación
--        automática (sus_renovAutomatica = 1), la cuenta no tiene otro plan de pago vigente y no tiene
--        ya una pendiente de esa combinación plan × intervalo, se crea una suscripción PENDIENTE (P) del
--        mismo plan e intervalo con la renovación automática activada, que empieza el día siguiente al
--        corte y termina 30 días después del corte (ese es el PLAZO DE PAGO), y se anota `renovacion`.
--     4. ANULACIÓN (DT-17). Una renovación pendiente cuyo plazo terminó (fecha de corte de la suscripción
--        origen + 30 días ya pasó; el último día vale hasta las 23:59:59 UTC), sin un pago en revisión (R)
--        ni confirmado (C), se anula: pasa a Cancelada (C), su renovación automática termina y se anota
--        ANULADA. Si la cuenta queda sin ninguna suscripción vigente, se le concede un plan Libre nuevo
--        (la combinación activa de menor id del plan siguiente al de prueba) por las horas del propio plan
--        (240 h) desde ese instante, y se anota TRANSICION. Al terminar ese Libre la cuenta queda sin plan.
--   NO cobra, NO registra ningún pago, NO fija referencias de pago y NO cambia las fechas de la suscripción
--   cortada: el pago lo hace la persona subiendo el comprobante (flujo crearConPago) o, cuando se conecte
--   una pasarela de pago, la pasarela confirmándolo con el procedimiento normal de validación de pagos.
--   Solo procesa planes de pago (sin duración en horas). El vencimiento de la prueba y del Libre lo sigue
--   haciendo el PHP al consultar el plan vigente.
--   Diferencias deliberadas con el PHP: este procedimiento anota la IP como PROCEDIMIENTO y no emite
--   auditoría (sgen_auditoria); el PHP anota la IP real y emite PLAN_CORTADO, PLAN_RENOVACION,
--   PLAN_ACTIV_PROGRAM y PLAN_RENOV_ANULADA.
--
-- CÓMO EJECUTARLO (gestor de base de datos: phpMyAdmin, Workbench, HeidiSQL, DBeaver…)
--   1. Seleccione la base `sist_criteriokelly` y abra una pestaña SQL.
--   2. Pegue TODO el archivo (el gestor debe aceptar DELIMITER; en phpMyAdmin se escribe
--      $$ en el cuadro «Delimitador»).
--   3. Ejecute con un usuario que tenga CREATE ROUTINE y ALTER ROUTINE (root en local;
--      en el hosting, el administrador del panel). Para llamarlo basta EXECUTE.
--
-- LÍNEAS QUE SE DESACTIVAN SEGÚN EL SERVIDOR (anteponer `-- `)
--   - Sin permiso CREATE ROUTINE (hosting compartido): no ejecute este archivo.
--   - Gestor sin soporte de DELIMITER: ejecute el DROP y el CREATE por separado, como un
--     solo comando cada uno, y quite las líneas DELIMITER y los `$$`.
--   - Si no quiere recrearlo al repetir el script: comente la línea DROP PROCEDURE.
--   Sin DEFINER a propósito (evita el error 1227 en el hosting); SQL SECURITY INVOKER.
--   No lo llame dentro de una transacción abierta: abre y cierra una transacción por usuario.
--   Fechas en UTC (UTC_DATE() y UTC_TIMESTAMP()), como el resto del proyecto.
--   Nunca debe estar activo a la vez que el paso de corte de PlanVigenteSrv (ver procedimientos.md).
-- ============================================================================

USE `sist_criteriokelly`;

DELIMITER $$

DROP PROCEDURE IF EXISTS `procesar_renovaciones`$$
CREATE PROCEDURE `procesar_renovaciones`()
SQL SECURITY INVOKER
BEGIN
    DECLARE c_dias_plazo INT DEFAULT 30;
    DECLARE c_maximo_pasos INT DEFAULT 12;

    DECLARE done INT DEFAULT FALSE;
    DECLARE v_usuario_id INT;
    DECLARE v_hoy DATE;
    DECLARE v_ahora DATETIME;
    DECLARE v_bloqueado INT;
    DECLARE v_filas INT;
    DECLARE v_paso INT;
    DECLARE v_hay_paso INT;

    DECLARE v_corte_id INT;
    DECLARE v_corte_combinacion INT;
    DECLARE v_corte_fin DATE;
    DECLARE v_corte_renovacion INT;
    DECLARE v_programada_inicio DATE;
    DECLARE v_programada_id INT;
    DECLARE v_otro_pago INT;
    DECLARE v_pendiente_existente INT;
    DECLARE v_nueva_id INT;

    DECLARE v_renovacion_id INT;
    DECLARE v_origen_id INT;
    DECLARE v_vigentes INT;
    DECLARE v_libre_combinacion INT;
    DECLARE v_libre_horas INT;
    DECLARE v_libre_fin DATETIME;

    -- Cursor: usuarios con un plan de pago por cortar o con una renovación pendiente por revisar
    DECLARE cur CURSOR FOR
        SELECT DISTINCT s.sus_usuarioId
        FROM spsu_suscripcion s
        JOIN spsu_planintervalo pin ON s.sus_pinIdPlanin = pin.pin_idPlanInterv
        JOIN spsu_planes p ON p.pla_idPlan = pin.pin_plaIdPlan
        WHERE p.pla_horasDuracion IS NULL
          AND ((s.sus_situacion = 'A' AND s.sus_fechaFin < UTC_DATE())
            OR (s.sus_situacion = 'P' AND EXISTS (
                SELECT 1 FROM spsu_historialsuscri h
                WHERE h.his_sisIdSuscrip = s.sis_idSuscrip AND h.his_accion = 'renovacion')));

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET v_hoy = UTC_DATE();
    SET v_ahora = UTC_TIMESTAMP();

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_usuario_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        START TRANSACTION;

        -- Mismo orden de bloqueo que el PHP: primero la fila del usuario, después sus suscripciones.
        -- Todas las consultas de abajo son agregados (siempre devuelven una fila) para no activar el
        -- manejador NOT FOUND del cursor.
        SELECT COUNT(*) INTO v_bloqueado
        FROM sgen_usuario
        WHERE usu_idUsuario = v_usuario_id AND usu_estado = '1' AND usu_situacion = 'A'
        FOR UPDATE;

        IF v_bloqueado = 1 THEN
            SELECT COUNT(*) INTO v_filas
            FROM spsu_suscripcion
            WHERE sus_usuarioId = v_usuario_id
            FOR UPDATE;

            SET v_paso = 0;
            SET v_hay_paso = 1;

            paso_loop: WHILE v_hay_paso = 1 AND v_paso < c_maximo_pasos DO
                SET v_hay_paso = 0;
                SET v_paso = v_paso + 1;

                -- 1) Corte: el plan de pago activo de menor id cuya fecha de corte ya pasó
                SELECT MIN(s.sis_idSuscrip) INTO v_corte_id
                FROM spsu_suscripcion s
                JOIN spsu_planintervalo pin ON s.sus_pinIdPlanin = pin.pin_idPlanInterv
                JOIN spsu_planes p ON p.pla_idPlan = pin.pin_plaIdPlan
                WHERE s.sus_usuarioId = v_usuario_id AND s.sus_situacion = 'A'
                  AND p.pla_horasDuracion IS NULL AND s.sus_fechaFin < v_hoy;

                IF v_corte_id IS NOT NULL THEN
                    SET v_hay_paso = 1;

                    SELECT sus_pinIdPlanin, sus_fechaFin, sus_renovAutomatica
                    INTO v_corte_combinacion, v_corte_fin, v_corte_renovacion
                    FROM spsu_suscripcion
                    WHERE sis_idSuscrip = v_corte_id;

                    UPDATE spsu_suscripcion
                    SET sus_situacion = 'E', sus_fechaCambio = v_ahora
                    WHERE sis_idSuscrip = v_corte_id;

                    INSERT INTO spsu_historialsuscri (his_sisIdSuscrip, his_usuarioId, his_accion, his_detalle, his_fechaCambio, his_direcionIP)
                    VALUES (v_corte_id, v_usuario_id, 'CORTADA',
                            'Plan de pago cortado al terminar su periodo', v_ahora, 'PROCEDIMIENTO');

                    -- 2) Periodo programado (pagado por anticipado): el de menor fecha de inicio
                    SELECT MIN(s.sus_fechainicio) INTO v_programada_inicio
                    FROM spsu_suscripcion s
                    JOIN spsu_planintervalo pin ON s.sus_pinIdPlanin = pin.pin_idPlanInterv
                    JOIN spsu_planes p ON p.pla_idPlan = pin.pin_plaIdPlan
                    WHERE s.sus_usuarioId = v_usuario_id AND s.sus_situacion = 'P'
                      AND p.pla_horasDuracion IS NULL AND pin.pin_precioFinal > 0
                      AND EXISTS (SELECT 1 FROM spsu_pagos g
                                  WHERE g.pag_susIdSuscri = s.sis_idSuscrip AND g.pag_situacion = 'C')
                      AND NOT EXISTS (SELECT 1 FROM spsu_historialsuscri h
                                      WHERE h.his_sisIdSuscrip = s.sis_idSuscrip AND h.his_accion = 'renovacion');

                    SELECT MIN(s.sis_idSuscrip) INTO v_programada_id
                    FROM spsu_suscripcion s
                    JOIN spsu_planintervalo pin ON s.sus_pinIdPlanin = pin.pin_idPlanInterv
                    JOIN spsu_planes p ON p.pla_idPlan = pin.pin_plaIdPlan
                    WHERE s.sus_usuarioId = v_usuario_id AND s.sus_situacion = 'P'
                      AND p.pla_horasDuracion IS NULL AND pin.pin_precioFinal > 0
                      AND s.sus_fechainicio = v_programada_inicio
                      AND EXISTS (SELECT 1 FROM spsu_pagos g
                                  WHERE g.pag_susIdSuscri = s.sis_idSuscrip AND g.pag_situacion = 'C')
                      AND NOT EXISTS (SELECT 1 FROM spsu_historialsuscri h
                                      WHERE h.his_sisIdSuscrip = s.sis_idSuscrip AND h.his_accion = 'renovacion');

                    IF v_programada_id IS NOT NULL THEN
                        UPDATE spsu_suscripcion
                        SET sus_situacion = 'A', sus_fechaCambio = v_ahora
                        WHERE sis_idSuscrip = v_programada_id;

                        INSERT INTO spsu_historialsuscri (his_sisIdSuscrip, his_usuarioId, his_accion, his_detalle, his_fechaCambio, his_direcionIP)
                        VALUES (v_programada_id, v_usuario_id, 'ACTIVACION',
                                'Periodo programado activado', v_ahora, 'PROCEDIMIENTO');
                    ELSEIF v_corte_renovacion = 1 THEN
                        -- 3) Renovación pendiente de pago, con el plazo de 30 días desde el corte
                        SELECT COUNT(*) INTO v_otro_pago
                        FROM spsu_suscripcion s
                        JOIN spsu_planintervalo pin ON s.sus_pinIdPlanin = pin.pin_idPlanInterv
                        JOIN spsu_planes p ON p.pla_idPlan = pin.pin_plaIdPlan
                        WHERE s.sus_usuarioId = v_usuario_id AND s.sus_situacion = 'A'
                          AND p.pla_horasDuracion IS NULL AND s.sus_fechaFin >= v_hoy;

                        SELECT COUNT(*) INTO v_pendiente_existente
                        FROM spsu_suscripcion
                        WHERE sus_usuarioId = v_usuario_id AND sus_pinIdPlanin = v_corte_combinacion
                          AND sus_situacion = 'P';

                        IF v_otro_pago = 0 AND v_pendiente_existente = 0 THEN
                            INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin,
                                                          sus_situacion, sus_renovAutomatica, sus_fechaCrea, sus_fechaCambio)
                            VALUES (v_usuario_id, v_corte_combinacion,
                                    DATE_ADD(v_corte_fin, INTERVAL 1 DAY),
                                    DATE_ADD(v_corte_fin, INTERVAL c_dias_plazo DAY),
                                    'P', 1, v_hoy, v_ahora);
                            SET v_nueva_id = LAST_INSERT_ID();

                            INSERT INTO spsu_historialsuscri (his_sisIdSuscrip, his_usuarioId, his_accion, his_detalle, his_fechaCambio, his_direcionIP)
                            VALUES (v_nueva_id, v_usuario_id, 'renovacion',
                                    CONCAT('Renovación pendiente de pago de la suscripción ', v_corte_id),
                                    v_ahora, 'PROCEDIMIENTO');
                        END IF;
                    END IF;
                ELSE
                    -- 4) Anulación: renovación pendiente de menor id con el plazo vencido y sin pago R ni C.
                    --    El plazo sale de la suscripción origen (la última expirada de la misma combinación).
                    SELECT MIN(r.sis_idSuscrip) INTO v_renovacion_id
                    FROM spsu_suscripcion r
                    JOIN spsu_planintervalo pin ON r.sus_pinIdPlanin = pin.pin_idPlanInterv
                    JOIN spsu_planes p ON p.pla_idPlan = pin.pin_plaIdPlan
                    WHERE r.sus_usuarioId = v_usuario_id AND r.sus_situacion = 'P'
                      AND p.pla_horasDuracion IS NULL AND pin.pin_precioFinal > 0
                      AND EXISTS (SELECT 1 FROM spsu_historialsuscri h
                                  WHERE h.his_sisIdSuscrip = r.sis_idSuscrip AND h.his_accion = 'renovacion')
                      AND NOT EXISTS (SELECT 1 FROM spsu_pagos g
                                      WHERE g.pag_susIdSuscri = r.sis_idSuscrip AND g.pag_situacion IN ('R', 'C'))
                      AND DATE_ADD(
                              COALESCE((SELECT o.sus_fechaFin FROM spsu_suscripcion o
                                        WHERE o.sus_usuarioId = r.sus_usuarioId AND o.sus_pinIdPlanin = r.sus_pinIdPlanin
                                          AND o.sus_situacion = 'E' AND o.sis_idSuscrip < r.sis_idSuscrip
                                        ORDER BY o.sis_idSuscrip DESC LIMIT 1), r.sus_fechaFin),
                              INTERVAL c_dias_plazo DAY) < v_hoy;

                    IF v_renovacion_id IS NOT NULL THEN
                        SET v_hay_paso = 1;

                        SELECT COALESCE(MAX(o.sis_idSuscrip), 0) INTO v_origen_id
                        FROM spsu_suscripcion o
                        JOIN spsu_suscripcion r ON r.sis_idSuscrip = v_renovacion_id
                        WHERE o.sus_usuarioId = r.sus_usuarioId AND o.sus_pinIdPlanin = r.sus_pinIdPlanin
                          AND o.sus_situacion = 'E' AND o.sis_idSuscrip < r.sis_idSuscrip;

                        UPDATE spsu_suscripcion
                        SET sus_situacion = 'C', sus_renovAutomatica = 0, sus_fechaCambio = v_ahora
                        WHERE sis_idSuscrip = v_renovacion_id;

                        INSERT INTO spsu_historialsuscri (his_sisIdSuscrip, his_usuarioId, his_accion, his_detalle, his_fechaCambio, his_direcionIP)
                        VALUES (v_renovacion_id, v_usuario_id, 'ANULADA',
                                CONCAT('Renovación anulada: plazo de pago vencido de la suscripción ', v_origen_id),
                                v_ahora, 'PROCEDIMIENTO');

                        -- Libre nuevo solo si la cuenta queda sin ninguna suscripción vigente
                        SELECT COUNT(*) INTO v_vigentes
                        FROM spsu_suscripcion s
                        WHERE s.sus_usuarioId = v_usuario_id AND s.sus_situacion = 'A'
                          AND ((s.sus_fechaHoraFin IS NOT NULL AND s.sus_fechaHoraFin > v_ahora)
                            OR (s.sus_fechaHoraFin IS NULL AND s.sus_fechaFin >= v_hoy));

                        IF v_vigentes = 0 THEN
                            SELECT MIN(pin.pin_idPlanInterv) INTO v_libre_combinacion
                            FROM spsu_planes pru
                            JOIN spsu_planintervalo pin ON pin.pin_plaIdPlan = pru.pla_planSiguienteId AND pin.pin_estado = '1'
                            WHERE pru.pla_horasDuracion IS NOT NULL AND pru.pla_planSiguienteId IS NOT NULL
                              AND pru.pla_estado = '1';

                            SELECT MAX(p.pla_horasDuracion) INTO v_libre_horas
                            FROM spsu_planintervalo pin
                            JOIN spsu_planes p ON p.pla_idPlan = pin.pin_plaIdPlan
                            WHERE pin.pin_idPlanInterv = v_libre_combinacion;

                            IF v_libre_combinacion IS NOT NULL AND v_libre_horas IS NOT NULL THEN
                                SET v_libre_fin = DATE_ADD(v_ahora, INTERVAL v_libre_horas HOUR);

                                INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin,
                                                              sus_fechaHoraFin, sus_situacion, sus_renovAutomatica,
                                                              sus_fechaCrea, sus_fechaCambio)
                                VALUES (v_usuario_id, v_libre_combinacion, v_hoy, DATE(v_libre_fin),
                                        v_libre_fin, 'A', 0, v_hoy, v_ahora);
                                SET v_nueva_id = LAST_INSERT_ID();

                                INSERT INTO spsu_historialsuscri (his_sisIdSuscrip, his_usuarioId, his_accion, his_detalle, his_fechaCambio, his_direcionIP)
                                VALUES (v_nueva_id, v_usuario_id, 'TRANSICION',
                                        CONCAT('Plan Libre por anulación de la renovación ', v_renovacion_id),
                                        v_ahora, 'PROCEDIMIENTO');
                            END IF;
                        END IF;
                    END IF;
                END IF;
            END WHILE paso_loop;
        END IF;

        COMMIT;
    END LOOP;

    CLOSE cur;
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- EJEMPLO DE PRUEBA (comentado: MODIFICA suscripciones; úselo solo en una base de pruebas)
-- ----------------------------------------------------------------------------
-- CALL procesar_renovaciones();
