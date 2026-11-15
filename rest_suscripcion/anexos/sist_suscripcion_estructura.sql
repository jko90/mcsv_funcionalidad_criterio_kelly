-- ============================================================================
-- rest_suscripcion · ESTRUCTURA de la base sist_criteriokelly (tablas spsu de este proyecto)
-- Generado desde la base viva el 2026-11-14. Es el único script de estructura de este proyecto.
-- Uso: importar desde el gestor de base de datos (phpMyAdmin > Importar) o
--      C:\xampp\mysql\bin\mysql.exe -u root < sist_suscripcion_estructura.sql
-- No borra nada: cada tabla se crea solo si no existe. Los cambios futuros de la base
-- se entregan como un script de actualización aparte y este archivo se regenera.
-- ============================================================================
CREATE DATABASE IF NOT EXISTS `sist_criteriokelly` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `sist_criteriokelly`;
SET FOREIGN_KEY_CHECKS=0;


CREATE TABLE IF NOT EXISTS `spsu_historialsuscri` (
  `his_idHistorial` int(11) NOT NULL AUTO_INCREMENT,
  `his_usuarioId` int(11) NOT NULL,
  `his_sisIdSuscrip` int(11) NOT NULL,
  `his_accion` varchar(16) DEFAULT NULL COMMENT 'Creacion, actualizacion, cancelacion, renovacion, pausa, reactivacion',
  `his_detalle` varchar(4096) DEFAULT NULL,
  `his_fechaCambio` datetime NOT NULL,
  `his_direcionIP` varchar(64) NOT NULL,
  PRIMARY KEY (`his_idHistorial`),
  KEY `spsu_suscripcion_spsu_historialsuscri_fk` (`his_sisIdSuscrip`),
  CONSTRAINT `spsu_suscripcion_spsu_historialsuscri_fk` FOREIGN KEY (`his_sisIdSuscrip`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `spsu_intervalosuscr` (
  `ins_idInterSuscrip` int(11) NOT NULL AUTO_INCREMENT,
  `ins_nombre` varchar(64) NOT NULL,
  `ins_numMeses` int(11) NOT NULL DEFAULT 1,
  `ins_x100descuen` decimal(4,2) NOT NULL DEFAULT 0.00,
  `ins_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `ins_estado` char(1) DEFAULT NULL COMMENT '1 Activo\r\n0 Eliminado',
  PRIMARY KEY (`ins_idInterSuscrip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `spsu_metodopago` (
  `mep_idMetodo` int(11) NOT NULL AUTO_INCREMENT,
  `mep_codigo` varchar(16) NOT NULL COMMENT 'CRIPTOMONEDA, PAYPAL, BANCO',
  `mep_nombre` varchar(64) NOT NULL,
  `mep_activo` tinyint(1) NOT NULL DEFAULT 0,
  `mep_orden` int(11) NOT NULL DEFAULT 0,
  `mep_paypalCorreo` varchar(64) DEFAULT NULL,
  `mep_paypalEnlace` varchar(255) DEFAULT NULL,
  `mep_bancoNumero` varchar(15) DEFAULT NULL COMMENT 'BANCO: numero de WhatsApp',
  `mep_bancoPlantilla` varchar(500) DEFAULT NULL COMMENT 'BANCO: plantilla del mensaje de WhatsApp',
  `mep_bancoTitular` varchar(128) DEFAULT NULL COMMENT 'BANCO: titular de la cuenta',
  `mep_bancoDocumento` varchar(20) DEFAULT NULL COMMENT 'BANCO: documento del titular (opcional)',
  `mep_bancoEntidad` varchar(64) DEFAULT NULL COMMENT 'BANCO: banco o entidad',
  `mep_bancoTipoCuenta` varchar(32) DEFAULT NULL COMMENT 'BANCO: AHORROS, CORRIENTE, VIRTUAL, OTRO',
  `mep_bancoCuenta` varchar(34) DEFAULT NULL COMMENT 'BANCO: numero de cuenta',
  `mep_bancoPaisMoneda` varchar(32) DEFAULT NULL COMMENT 'BANCO: pais o moneda (opcional)',
  `mep_bancoObservaciones` varchar(255) DEFAULT NULL COMMENT 'BANCO: observaciones (opcional)',
  `mep_creadoPor` int(11) DEFAULT NULL,
  `mep_fechacrea` datetime NOT NULL DEFAULT current_timestamp(),
  `mep_actualizadoPor` int(11) DEFAULT NULL,
  `mep_fechaact` datetime DEFAULT NULL,
  PRIMARY KEY (`mep_idMetodo`),
  UNIQUE KEY `uq_mep_codigo` (`mep_codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `spsu_pagos` (
  `pag_idPago` int(11) NOT NULL AUTO_INCREMENT,
  `pag_susIdSuscri` int(11) NOT NULL,
  `pag_monto` decimal(6,2) NOT NULL DEFAULT 0.00,
  `pag_montoConfirmado` decimal(6,3) NOT NULL DEFAULT 0.000,
  `pag_moneda` varchar(8) NOT NULL DEFAULT 'USD',
  `pag_fechaPago` datetime NOT NULL,
  `pag_metodoPago` varchar(64) DEFAULT 'CRIPTO' COMMENT 'CRIPTOMONEDA,\r\nPAYPAL,\r\nBANCO',
  `pag_idTransac` varchar(256) NOT NULL DEFAULT '0',
  `pag_situacion` char(1) NOT NULL DEFAULT 'R' COMMENT 'R: Revisión,\r\nC: Completado,\r\nF: Fallido, \r\nX: Reenvolsado,\r\nD: Diferencia',
  `pag_pagoDesde` datetime DEFAULT NULL,
  `pag_pagoHasta` datetime DEFAULT NULL,
  `pag_imagen` longtext DEFAULT NULL,
  `pag_fechacrea` datetime NOT NULL DEFAULT current_timestamp(),
  `pag_correo` varchar(64) DEFAULT NULL,
  `pag_tipocripto` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`pag_idPago`),
  KEY `spsu_suscripcion_spsu_pagos_fk` (`pag_susIdSuscri`),
  CONSTRAINT `spsu_suscripcion_spsu_pagos_fk` FOREIGN KEY (`pag_susIdSuscri`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `spsu_planes` (
  `pla_idPlan` int(11) NOT NULL AUTO_INCREMENT,
  `pla_nombre` varchar(64) NOT NULL,
  `pla_descripcion` varchar(4096) DEFAULT NULL,
  `pla_precioBase` decimal(5,2) NOT NULL DEFAULT 0.00,
  `pla_moneda` varchar(8) NOT NULL DEFAULT 'USD',
  `pla_caracteris` text DEFAULT NULL,
  `pla_numCuentas` int(11) NOT NULL DEFAULT 1,
  `pla_diasHistorial` int(11) NOT NULL DEFAULT 10 COMMENT 'Dias de historial permitidos hacia atras',
  `pla_diasTotales` int(11) NOT NULL DEFAULT 30 COMMENT 'Total de dias de historial disponible',
  `pla_bloqueoDias` int(11) NOT NULL DEFAULT 10 COMMENT 'Dias por bloque de consulta',
  `pla_puedeDescargar` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=Puede descargar, 0=Solo visualizar',
  `pla_descargaTodos` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=Puede descargar todos, 0=Solo por filtros',
  `pla_rangoLibre` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=Puede filtrar rangos libres, 0=Solo bloques predefinidos',
  `pla_horasDuracion` int(11) DEFAULT NULL COMMENT 'Horas de duración del plan; NULL en los planes de pago',
  `pla_planSiguienteId` int(11) DEFAULT NULL COMMENT 'Plan al que pasa la cuenta al terminar; NULL en los planes de pago',
  `pla_puedeGraficar` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Puede graficar operaciones, 0=No',
  `pla_divisorEditable` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Puede cambiar el divisor de Kelly, 0=Fijo en 10',
  `pla_maxOperacionesDiarias` int(11) DEFAULT NULL COMMENT 'Máximo de operaciones diarias del criterio de Kelly; NULL = sin límite',
  `pla_fechacrea` date NOT NULL DEFAULT current_timestamp(),
  `pla_fechacambio` datetime NOT NULL DEFAULT current_timestamp(),
  `pla_estado` char(1) DEFAULT NULL COMMENT '1 Activo\r\n0 Eliminado',
  PRIMARY KEY (`pla_idPlan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `spsu_planintervalo` (
  `pin_idPlanInterv` int(11) NOT NULL AUTO_INCREMENT,
  `pin_plaIdPlan` int(11) NOT NULL,
  `pins_idInterSuscrip` int(11) NOT NULL,
  `pin_precioFinal` decimal(6,2) NOT NULL DEFAULT 0.00,
  `pin_estado` char(1) NOT NULL DEFAULT '1' COMMENT '1 Activo\r\n0 Eliminado',
  PRIMARY KEY (`pin_idPlanInterv`),
  KEY `spsu_intervalosuscr_spsu_planintervalo_fk` (`pins_idInterSuscrip`),
  KEY `spsu_planes_spsu_planintervalo_fk` (`pin_plaIdPlan`),
  CONSTRAINT `spsu_intervalosuscr_spsu_planintervalo_fk` FOREIGN KEY (`pins_idInterSuscrip`) REFERENCES `spsu_intervalosuscr` (`ins_idInterSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `spsu_planes_spsu_planintervalo_fk` FOREIGN KEY (`pin_plaIdPlan`) REFERENCES `spsu_planes` (`pla_idPlan`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `spsu_qrpago` (
  `qr_idQr` int(11) NOT NULL AUTO_INCREMENT,
  `qr_redId` int(11) NOT NULL,
  `qr_tipoMime` varchar(32) NOT NULL,
  `qr_tamano` int(11) NOT NULL,
  `qr_hash` char(64) NOT NULL,
  `qr_contenido` mediumblob NOT NULL,
  `qr_creadoPor` int(11) DEFAULT NULL,
  `qr_fechacrea` datetime NOT NULL DEFAULT current_timestamp(),
  `qr_actualizadoPor` int(11) DEFAULT NULL,
  `qr_fechaact` datetime DEFAULT NULL,
  PRIMARY KEY (`qr_idQr`),
  UNIQUE KEY `uq_qr_red` (`qr_redId`),
  CONSTRAINT `fk_qr_red` FOREIGN KEY (`qr_redId`) REFERENCES `spsu_redusdt` (`red_idRed`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `spsu_redusdt` (
  `red_idRed` int(11) NOT NULL AUTO_INCREMENT,
  `red_clave` varchar(16) NOT NULL,
  `red_nombre` varchar(64) NOT NULL,
  `red_etiqueta` varchar(16) NOT NULL,
  `red_direccion` varchar(128) NOT NULL,
  `red_activo` tinyint(1) NOT NULL DEFAULT 1,
  `red_orden` int(11) NOT NULL DEFAULT 0,
  `red_creadoPor` int(11) DEFAULT NULL,
  `red_fechacrea` datetime NOT NULL DEFAULT current_timestamp(),
  `red_actualizadoPor` int(11) DEFAULT NULL,
  `red_fechaact` datetime DEFAULT NULL,
  PRIMARY KEY (`red_idRed`),
  UNIQUE KEY `uq_red_clave` (`red_clave`),
  KEY `ix_red_activo_orden` (`red_activo`,`red_orden`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `spsu_suscripcion` (
  `sis_idSuscrip` int(11) NOT NULL AUTO_INCREMENT,
  `sus_usuarioId` int(11) NOT NULL,
  `sus_pinIdPlanin` int(11) NOT NULL,
  `sus_fechainicio` date NOT NULL,
  `sus_fechaFin` date NOT NULL,
  `sus_fechaHoraFin` datetime DEFAULT NULL COMMENT 'Fin exacto en UTC (planes con duración en horas y activaciones de HU-004)',
  `sus_situacion` char(1) DEFAULT 'P' COMMENT 'P: Pendiente,\r\nA: Activa,\r\nC: Cancelada,\r\nS: Pausada, \r\nE: Expirada,\r\nF: Finalizada',
  `sus_referenPago` varchar(254) DEFAULT NULL,
  `sus_renovAutomatica` tinyint(1) NOT NULL DEFAULT 1,
  `sus_proximoPago` date DEFAULT NULL,
  `sus_fechaCrea` date NOT NULL,
  `sus_fechaCambio` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`sis_idSuscrip`),
  KEY `spsu_planintervalo_spsu_suscripcion_fk` (`sus_pinIdPlanin`),
  KEY `spsu_suscripcion_usuario_idx` (`sus_usuarioId`,`sus_situacion`),
  CONSTRAINT `spsu_planintervalo_spsu_suscripcion_fk` FOREIGN KEY (`sus_pinIdPlanin`) REFERENCES `spsu_planintervalo` (`pin_idPlanInterv`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


SET FOREIGN_KEY_CHECKS=1;
