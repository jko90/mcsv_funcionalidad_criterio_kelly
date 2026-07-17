DELIMITER //
CREATE PROCEDURE procesar_renovaciones()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_suscripcion_id INT;
    DECLARE v_usuario_id INT;
    DECLARE v_plan_intervalo_id INT;
    DECLARE v_fecha_fin_actual DATETIME;
    DECLARE v_intervalo_meses INT;
    DECLARE v_precio_final DECIMAL(10, 2);
    DECLARE v_nueva_fecha_fin DATETIME;
    
    -- Cursor para suscripciones que necesitan renovación
    DECLARE cur CURSOR FOR 
        SELECT s.suscripcion_id, s.usuario_id, s.plan_intervalo_id, s.fecha_fin
        FROM suscripciones s
        JOIN plan_intervalo pi ON s.plan_intervalo_id = pi.plan_intervalo_id
        JOIN intervalos_suscripcion i ON pi.intervalo_id = i.intervalo_id
        WHERE s.renovacion_automatica = TRUE 
        AND s.estado = 'activa'
        AND s.fecha_proximo_pago <= NOW();
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO v_suscripcion_id, v_usuario_id, v_plan_intervalo_id, v_fecha_fin_actual;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Obtener intervalo y precio
        SELECT i.meses, pi.precio_final INTO v_intervalo_meses, v_precio_final
        FROM plan_intervalo pi
        JOIN intervalos_suscripcion i ON pi.intervalo_id = i.intervalo_id
        WHERE pi.plan_intervalo_id = v_plan_intervalo_id;
        
        -- Calcular nueva fecha fin
        SET v_nueva_fecha_fin = DATE_ADD(v_fecha_fin_actual, INTERVAL v_intervalo_meses MONTH);
        
        -- Actualizar suscripción
        UPDATE suscripciones 
        SET fecha_fin = v_nueva_fecha_fin,
            fecha_proximo_pago = v_nueva_fecha_fin,
            updated_at = NOW()
        WHERE suscripcion_id = v_suscripcion_id;
        
        -- Registrar pago (simulado - en producción se integraría con pasarela de pago)
        INSERT INTO pagos (
            suscripcion_id, monto, moneda, fecha_pago, metodo_pago, 
            estado, periodo_cubierto_desde, periodo_cubierto_hasta
        ) VALUES (
            v_suscripcion_id, v_precio_final, 'USD', NOW(), 'Renovación automática',
            'completado', v_fecha_fin_actual, v_nueva_fecha_fin
        );
        
        -- Registrar en historial
        INSERT INTO historial_suscripciones (suscripcion_id, usuario_id, accion, detalle)
        VALUES (v_suscripcion_id, v_usuario_id, 'renovacion', CONCAT('Renovación automática por ', v_precio_final));
    END LOOP;
    
    CLOSE cur;
END //
DELIMITER ;