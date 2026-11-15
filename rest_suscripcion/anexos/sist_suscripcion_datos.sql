-- ============================================================================
-- rest_suscripcion · DATOS INICIALES de sist_criteriokelly
-- Generado desde la base viva el 2026-11-14. Es el único script de datos de este proyecto.
-- Contiene SOLO datos de catálogo (los que la aplicación necesita para funcionar).
-- No contiene usuarios, personas, contraseñas, sesiones, pagos ni movimientos reales.
-- Uso: importar DESPUÉS de sist_suscripcion_estructura.sql, desde el gestor de base de datos.
-- ============================================================================
USE `sist_criteriokelly`;



INSERT  IGNORE INTO `spsu_planes` (`pla_idPlan`, `pla_nombre`, `pla_descripcion`, `pla_precioBase`, `pla_moneda`, `pla_caracteris`, `pla_numCuentas`, `pla_diasHistorial`, `pla_diasTotales`, `pla_bloqueoDias`, `pla_puedeDescargar`, `pla_descargaTodos`, `pla_rangoLibre`, `pla_horasDuracion`, `pla_planSiguienteId`, `pla_puedeGraficar`, `pla_divisorEditable`, `pla_maxOperacionesDiarias`, `pla_fechacrea`, `pla_fechacambio`, `pla_estado`) VALUES (1,'Libre','Plan gratuito con funcionalidades básicas',0.00,'USD','Solo visualización de resultados y gráficas de los últimos 10 días',1,8,10,3,0,0,0,240,NULL,0,0,1,'2025-08-15','2025-08-15 16:12:07','1'),(2,'Básico','Plan básico con descarga y filtros limitados',1.25,'USD','Visualización y descarga de resultados con filtros de 15 días en bloques, hasta 45 días total',1,15,45,5,1,0,0,NULL,NULL,0,0,1,'2025-08-15','2025-08-15 16:12:07','1'),(3,'Premium','Plan premium con mayor alcance temporal',2.50,'USD','Visualización y descarga de resultados con filtros de 30 días en bloques, hasta 90 días total',5,30,90,30,1,0,0,NULL,NULL,1,1,5,'2025-08-15','2025-08-15 16:12:07','1'),(4,'Enterprise','Plan empresarial con acceso completo',5.00,'USD','Acceso completo con filtros libres, descarga total y cuentas ilimitadas',10,365,365,30,1,1,1,NULL,NULL,1,1,NULL,'2025-08-15','2025-08-15 16:12:07','1'),(5,'Prueba','Acceso completo durante 24 horas',0.00,'USD','Acceso completo con filtros libres y descarga total durante 24 horas. Después pasa al plan Libre.',10,365,365,30,1,1,1,24,1,1,1,NULL,'2026-11-12','2026-11-12 20:42:05','1');

INSERT  IGNORE INTO `spsu_intervalosuscr` (`ins_idInterSuscrip`, `ins_nombre`, `ins_numMeses`, `ins_x100descuen`, `ins_fecha`, `ins_estado`) VALUES (1,'Mensual',1,0.00,'2025-08-15 16:12:07','1'),(2,'Trimestral',3,10.00,'2025-08-15 16:12:07','1'),(3,'Semestral',6,15.00,'2025-08-15 16:12:07','1'),(4,'Anual',12,20.00,'2025-08-15 16:12:07','1'),(5,'Bianual',24,25.00,'2025-08-15 16:12:07','1'),(6,'Prueba (24 horas)',0,0.00,'2026-11-12 20:42:05','1');

INSERT  IGNORE INTO `spsu_planintervalo` (`pin_idPlanInterv`, `pin_plaIdPlan`, `pins_idInterSuscrip`, `pin_precioFinal`, `pin_estado`) VALUES (1,1,1,0.00,'1'),(2,2,1,1.25,'1'),(3,2,2,3.38,'1'),(4,2,3,6.38,'1'),(5,2,4,12.00,'1'),(6,2,5,22.50,'1'),(7,3,1,2.50,'1'),(8,3,2,6.75,'1'),(9,3,3,12.75,'1'),(10,3,4,24.00,'1'),(11,3,5,45.00,'1'),(12,4,1,5.00,'1'),(13,4,2,13.50,'1'),(14,4,3,25.50,'1'),(15,4,4,48.00,'1'),(16,4,5,90.00,'1'),(17,5,6,0.00,'1');

INSERT  IGNORE INTO `spsu_metodopago` (`mep_idMetodo`, `mep_codigo`, `mep_nombre`, `mep_activo`, `mep_orden`, `mep_paypalCorreo`, `mep_paypalEnlace`, `mep_bancoNumero`, `mep_bancoPlantilla`, `mep_bancoTitular`, `mep_bancoDocumento`, `mep_bancoEntidad`, `mep_bancoTipoCuenta`, `mep_bancoCuenta`, `mep_bancoPaisMoneda`, `mep_bancoObservaciones`, `mep_creadoPor`, `mep_fechacrea`, `mep_actualizadoPor`, `mep_fechaact`) VALUES (1,'CRIPTOMONEDA','Criptomoneda (USDT)',0,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-14 17:36:01',NULL,NULL),(2,'PAYPAL','PayPal',0,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-14 17:36:01',NULL,NULL),(3,'BANCO','Transferencia bancaria por WhatsApp',0,3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-14 17:36:01',NULL,NULL);


