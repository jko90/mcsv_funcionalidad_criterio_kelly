DELIMITER //
CREATE PROCEDURE crear_suscripcion(
    IN p_usuario_id INT,
    IN p_plan_id INT,
    IN p_intervalo_id INT,
    IN p_metodo_pago VARCHAR(50),
    IN p_renovacion_automatica BOOLEAN
)
BEGIN
    DECLARE v_precio_final DECIMAL(10, 2);
    DECLARE v_fecha_inicio DATETIME;
    DECLARE v_fecha_fin DATETIME;
    DECLARE v_plan_intervalo_id INT;
    
    -- Obtener precio final y plan_intervalo_id
    SELECT pi.precio_final, pi.plan_intervalo_id INTO v_precio_final, v_plan_intervalo_id
    FROM plan_intervalo pi
    WHERE pi.plan_id = p_plan_id AND pi.intervalo_id = p_intervalo_id AND pi.activo = TRUE;
    
    -- Calcular fechas
    SET v_fecha_inicio = NOW();
    SET v_fecha_fin = DATE_ADD(v_fecha_inicio, INTERVAL (SELECT meses FROM intervalos_suscripcion WHERE intervalo_id = p_intervalo_id) MONTH);
    
    -- Insertar suscripción
    INSERT INTO suscripciones (
        usuario_id, plan_intervalo_id, fecha_inicio, fecha_fin, estado, 
        metodo_pago, renovacion_automatica, fecha_proximo_pago
    ) VALUES (
        p_usuario_id, v_plan_intervalo_id, v_fecha_inicio, v_fecha_fin, 'activa',
        p_metodo_pago, p_renovacion_automatica, v_fecha_fin
    );
    
    -- Registrar en historial
    INSERT INTO historial_suscripciones (suscripcion_id, usuario_id, accion, detalle)
    VALUES (LAST_INSERT_ID(), p_usuario_id, 'creacion', CONCAT('Suscripción creada con precio ', v_precio_final));
    
    -- Retornar ID de la nueva suscripción
    SELECT LAST_INSERT_ID() AS nueva_suscripcion_id;
END //
DELIMITER ;