-- ============================================================================
-- rest_suscripcion · PROCEDIMIENTOS de alta de suscripción (opcionales)
-- Manual de uso, equivalencias con el PHP y qué dejar en PHP: procedimientos.md (misma carpeta).
--
-- QUÉ HACE ESTE SCRIPT
--   Crea 2 procedimientos en la base `sist_criteriokelly`. NO inserta ni modifica datos
--   y NO los llama: solo los deja creados. Se puede ejecutar varias veces (hace
--   DROP PROCEDURE IF EXISTS de sus dos procedimientos).
--
-- COMPORTAMIENTO = EL DEL PHP (SuscripcionCtrl.php / SuscripcionMdl.php / PagosMdl.php)
--   crear_suscripcion       ≡ POST suscripcion/crearSinPago  (insertarSuscripcionSinPago)
--   crear_suscripcion_con_pago ≡ POST suscripcion/crearConPago (insertarSuscripcionConPago)
--   Mismas validaciones, mismos mensajes de error, mismos datos guardados y misma respuesta
--   (la fila de la suscripción con las columnas que devuelve el PHP). El plan se identifica
--   por la combinación plan × intervalo (spsu_planintervalo.pin_idPlanInterv), como en el PHP.
--   En ambos, la suscripción queda PENDIENTE (P): un plan de pago solo pasa a activo cuando
--   el administrador valida el comprobante (HU-004). Los errores se devuelven con
--   SIGNAL SQLSTATE '45000' y el mismo texto que el PHP.
--   Diferencias deliberadas con el PHP de hoy (ya previstas en HU-004/HLT-16/HLT-17):
--     · las fechas se calculan en UTC (el PHP actual usa la hora del servidor);
--     · crear_suscripcion rechaza el plan de prueba; crear_suscripcion_con_pago rechaza
--       (409) reutilizar una suscripción que no esté pendiente.
--   Si cambia el PHP de estos dos flujos, estos procedimientos deben actualizarse igual.
--
-- CÓMO EJECUTARLO (gestor de base de datos: phpMyAdmin, Workbench, HeidiSQL, DBeaver…)
--   1. Seleccione la base `sist_criteriokelly` y abra una pestaña SQL.
--   2. Pegue TODO el archivo (el gestor debe aceptar DELIMITER; en phpMyAdmin se escribe
--      $$ en el cuadro «Delimitador»).
--   3. Ejecute con un usuario que tenga CREATE ROUTINE y ALTER ROUTINE (root en local;
--      en el hosting, el administrador del panel). Para llamarlos basta EXECUTE.
--
-- LÍNEAS QUE SE DESACTIVAN SEGÚN EL SERVIDOR (anteponer `-- `)
--   - Sin permiso CREATE ROUTINE (hosting compartido): no ejecute este archivo.
--   - Gestor sin soporte de DELIMITER: ejecute cada DROP y cada CREATE por separado, como un
--     solo comando, y quite las líneas DELIMITER y los `$$`.
--   - Si no quiere recrearlos al repetir el script: comente las líneas DROP PROCEDURE.
--   Sin DEFINER a propósito (evita el error 1227 en el hosting); SQL SECURITY INVOKER.
--   No los llame dentro de una transacción abierta: cada uno abre y cierra la suya.
-- ============================================================================

USE `sist_criteriokelly`;

DELIMITER $$

-- ----------------------------------------------------------------------------
-- 1) crear_suscripcion ≡ crearSinPago
--    Crea una suscripción PENDIENTE (P) de 1 mes (MESES_SUSCRIPCION_SIN_PAGO) para el usuario.
--    Errores: plan inválido, ya tiene una suscripción pendiente o activa no vencida.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `crear_suscripcion`$$
CREATE PROCEDURE `crear_suscripcion`(
    IN p_usuario_id INT,
    IN p_plan_intervalo_id INT
)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_pin_id INT DEFAULT NULL;
    DECLARE v_horas_duracion INT DEFAULT NULL;
    DECLARE v_plan_siguiente INT DEFAULT NULL;
    DECLARE v_ahora DATETIME;
    DECLARE v_fecha_fin DATETIME;
    DECLARE v_existente INT DEFAULT NULL;
    DECLARE v_suscripcion_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- obtenerPlanIntervaloActivo: la combinación debe existir y estar activa
    SELECT pin.pin_idPlanInterv, p.pla_horasDuracion, p.pla_planSiguienteId
      INTO v_pin_id, v_horas_duracion, v_plan_siguiente
    FROM spsu_planintervalo pin
    JOIN spsu_planes p ON p.pla_idPlan = pin.pin_plaIdPlan
    WHERE pin.pin_idPlanInterv = p_plan_intervalo_id AND pin.pin_estado = '1';

    IF v_pin_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El plan seleccionado no es válido';
    END IF;

    -- El plan de prueba no se puede elegir (HU-004, B-03)
    IF v_horas_duracion IS NOT NULL AND v_plan_siguiente IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El plan seleccionado no es válido';
    END IF;

    SET v_ahora = UTC_TIMESTAMP();
    SET v_fecha_fin = DATE_ADD(v_ahora, INTERVAL 1 MONTH);

    START TRANSACTION;

    -- existeSuscripcionVigente (con bloqueo): pendiente o activa y no vencida
    SELECT sis_idSuscrip INTO v_existente
    FROM spsu_suscripcion
    WHERE sus_usuarioId = p_usuario_id AND sus_situacion IN ('P', 'A')
      AND (sus_fechaFin IS NULL OR sus_fechaFin >= v_ahora)
    LIMIT 1
    FOR UPDATE;

    IF v_existente IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El usuario ya tiene una suscripción pendiente o activa';
    END IF;

    -- insertarSuscripcionSinPago (situación 'P' y renovación automática por defecto de la tabla)
    INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaCrea)
    VALUES (p_usuario_id, v_pin_id, DATE(v_ahora), DATE(v_fecha_fin), DATE(v_ahora));
    SET v_suscripcion_id = LAST_INSERT_ID();

    COMMIT;

    -- Respuesta: la suscripción, con las columnas que devuelve el PHP
    SELECT sis_idSuscrip, sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion,
           sus_referenPago, sus_renovAutomatica, sus_proximoPago, sus_fechaCrea
    FROM spsu_suscripcion
    WHERE sis_idSuscrip = v_suscripcion_id AND sus_usuarioId = p_usuario_id;
END$$

-- ----------------------------------------------------------------------------
-- 2) crear_suscripcion_con_pago ≡ crearConPago
--    Registra el pago (en revisión, R) con su comprobante y deja la suscripción PENDIENTE (P)
--    con las fechas del periodo contratado. Reutiliza la suscripción indicada (p_suscripcion_id)
--    o, si es NULL, la pendiente más reciente de ese plan sin referencia de pago; si no hay,
--    crea una. El monto lo toma del catálogo (no se recibe).
--    Parámetros opcionales: p_metodo_pago (CRIPTOMONEDA, PAYPAL o BANCO; NULL = CRIPTOMONEDA),
--    p_comprobante (imagen «data:image/…;base64,…», máx. 512 KB), p_correo_transaccion,
--    p_criptomoneda, p_suscripcion_id.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `crear_suscripcion_con_pago`$$
CREATE PROCEDURE `crear_suscripcion_con_pago`(
    IN p_usuario_id INT,
    IN p_plan_intervalo_id INT,
    IN p_id_transaccion VARCHAR(254),
    IN p_metodo_pago VARCHAR(64),
    IN p_comprobante LONGTEXT,
    IN p_correo_transaccion VARCHAR(64),
    IN p_criptomoneda VARCHAR(16),
    IN p_suscripcion_id INT
)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_pin_id INT DEFAULT NULL;
    DECLARE v_precio DECIMAL(6, 2) DEFAULT 0;
    DECLARE v_meses INT DEFAULT 0;
    DECLARE v_metodo VARCHAR(64);
    DECLARE v_comprobante LONGTEXT;
    DECLARE v_correo VARCHAR(64);
    DECLARE v_cripto VARCHAR(16);
    DECLARE v_inicio DATETIME;
    DECLARE v_fin DATETIME;
    DECLARE v_proximo DATETIME;
    DECLARE v_suscripcion_id INT DEFAULT NULL;
    DECLARE v_suscripcion_pin INT DEFAULT NULL;
    DECLARE v_suscripcion_situacion CHAR(1) DEFAULT NULL;
    DECLARE v_transaccion_existe INT DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Validación de entradas (mismas reglas que SuscripcionCtrl / BaseCtrl)
    IF p_id_transaccion IS NULL OR CHAR_LENGTH(p_id_transaccion) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El campo idTransaccion es obligatorio';
    END IF;
    IF BINARY p_id_transaccion NOT REGEXP '^[A-Za-z0-9._:-]+$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El campo idTransaccion es inválido';
    END IF;

    SET v_metodo = UPPER(TRIM(COALESCE(NULLIF(p_metodo_pago, ''), 'CRIPTOMONEDA')));
    IF v_metodo NOT IN ('CRIPTOMONEDA', 'PAYPAL', 'BANCO') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El campo metodoPago debe ser uno de: CRIPTOMONEDA, PAYPAL, BANCO';
    END IF;

    SET v_comprobante = NULLIF(p_comprobante, '');
    IF v_comprobante IS NOT NULL THEN
        IF v_comprobante = '--'
           OR v_comprobante NOT REGEXP '^data:image/(jpeg|png|gif|webp);base64,.+'
           OR CHAR_LENGTH(v_comprobante) > 699052 THEN   -- 512 KB en base64
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La imagen de comprobante no es válida';
        END IF;
    END IF;

    SET v_correo = NULLIF(TRIM(p_correo_transaccion), '');
    IF v_correo IS NOT NULL AND v_correo NOT REGEXP '^[^@ ]+@[^@ ]+[.][^@ ]+$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El campo correoTransaccion es inválido';
    END IF;

    SET v_cripto = NULLIF(p_criptomoneda, '');
    IF v_cripto IS NOT NULL AND BINARY v_cripto NOT REGEXP '^[A-Z0-9]{2,16}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El campo criptomoneda es inválido';
    END IF;

    -- obtenerPlanIntervaloActivo + monto del catálogo
    SELECT pin.pin_idPlanInterv, pin.pin_precioFinal, i.ins_numMeses
      INTO v_pin_id, v_precio, v_meses
    FROM spsu_planintervalo pin
    JOIN spsu_intervalosuscr i ON i.ins_idInterSuscrip = pin.pins_idInterSuscrip
    WHERE pin.pin_idPlanInterv = p_plan_intervalo_id AND pin.pin_estado = '1';

    IF v_pin_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El plan seleccionado no es válido';
    END IF;
    IF v_precio <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El plan seleccionado no requiere pago';
    END IF;

    SET v_inicio = UTC_TIMESTAMP();
    SET v_fin = DATE_ADD(v_inicio, INTERVAL v_meses MONTH);
    SET v_proximo = DATE_SUB(v_fin, INTERVAL 1 DAY);

    START TRANSACTION;

    IF p_suscripcion_id IS NOT NULL AND p_suscripcion_id <> 0 THEN
        -- Suscripción indicada: debe ser del usuario
        SELECT sis_idSuscrip, sus_pinIdPlanin, sus_situacion
          INTO v_suscripcion_id, v_suscripcion_pin, v_suscripcion_situacion
        FROM spsu_suscripcion
        WHERE sis_idSuscrip = p_suscripcion_id AND sus_usuarioId = p_usuario_id
        FOR UPDATE;

        IF v_suscripcion_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Acceso denegado';
        END IF;
        IF v_suscripcion_pin <> v_pin_id THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La suscripción no corresponde al plan';
        END IF;
        -- Solo una suscripción pendiente admite un pago (HU-004, HLT-17 RN-16)
        IF v_suscripcion_situacion <> 'P' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La suscripción no admite pagos';
        END IF;
    ELSE
        -- obtenerSuscripcionPendientePorPlan: la pendiente más reciente de ese plan, sin referencia de pago
        SELECT sis_idSuscrip INTO v_suscripcion_id
        FROM spsu_suscripcion
        WHERE sus_usuarioId = p_usuario_id AND sus_pinIdPlanin = v_pin_id AND sus_situacion = 'P'
          AND (sus_referenPago IS NULL OR sus_referenPago = '')
        ORDER BY sis_idSuscrip DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    -- existeTransaccion (con bloqueo)
    SELECT 1 INTO v_transaccion_existe
    FROM spsu_pagos
    WHERE pag_idTransac = p_id_transaccion
    LIMIT 1
    FOR UPDATE;
    IF v_transaccion_existe IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La transacción ya fue registrada';
    END IF;

    IF v_suscripcion_id IS NOT NULL THEN
        -- actualizarRangoFechaConPago
        UPDATE spsu_suscripcion
        SET sus_fechainicio = DATE(v_inicio), sus_fechaFin = DATE(v_fin),
            sus_referenPago = p_id_transaccion, sus_proximoPago = DATE(v_proximo)
        WHERE sis_idSuscrip = v_suscripcion_id AND sus_usuarioId = p_usuario_id;
    ELSE
        -- insertarSuscripcionConPago
        INSERT INTO spsu_suscripcion
            (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaCrea,
             sus_referenPago, sus_proximoPago)
        VALUES (p_usuario_id, v_pin_id, DATE(v_inicio), DATE(v_fin), DATE(v_inicio),
                p_id_transaccion, DATE(v_proximo));
        SET v_suscripcion_id = LAST_INSERT_ID();
    END IF;

    -- insertarPagoSuscripcion (situación 'R' por defecto de la tabla)
    INSERT INTO spsu_pagos
        (pag_susIdSuscri, pag_monto, pag_fechaPago, pag_metodoPago, pag_idTransac,
         pag_pagoDesde, pag_pagoHasta, pag_imagen, pag_correo, pag_tipocripto)
    VALUES (v_suscripcion_id, v_precio, v_inicio, v_metodo, p_id_transaccion,
            v_inicio, v_fin, v_comprobante, v_correo, v_cripto);
    IF ROW_COUNT() <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pudo registrar el pago';
    END IF;

    COMMIT;

    -- Respuesta: la suscripción, con las columnas que devuelve el PHP
    SELECT sis_idSuscrip, sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion,
           sus_referenPago, sus_renovAutomatica, sus_proximoPago, sus_fechaCrea
    FROM spsu_suscripcion
    WHERE sis_idSuscrip = v_suscripcion_id AND sus_usuarioId = p_usuario_id;
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- EJEMPLOS DE PRUEBA (comentados: INSERTAN datos; úselos solo en una base de pruebas)
--   Usuario 1; combinación 2 = plan Básico mensual.
-- ----------------------------------------------------------------------------
-- CALL crear_suscripcion(1, 2);
-- CALL crear_suscripcion_con_pago(1, 2, 'PRUEBA-0001', 'BANCO', NULL, NULL, NULL, NULL);
