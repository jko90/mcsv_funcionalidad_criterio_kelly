-- ============================================================================
-- rest_usuario · ESTRUCTURA de la base sist_criteriokelly (tablas sgen de este proyecto)
-- Generado desde la base viva el 2026-11-12. Es el único script de estructura de este proyecto.
-- Uso: importar desde el gestor de base de datos (phpMyAdmin > Importar) o
--      C:\xampp\mysql\bin\mysql.exe -u root < sist_usuario_estructura.sql
-- No borra nada: cada tabla se crea solo si no existe. Los cambios futuros de la base
-- se entregan como un script de actualización aparte y este archivo se regenera.
-- ============================================================================
CREATE DATABASE IF NOT EXISTS `sist_criteriokelly` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `sist_criteriokelly`;
SET FOREIGN_KEY_CHECKS=0;


CREATE TABLE IF NOT EXISTS `sgen_auditoria` (
  `aud_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `aud_fecha` datetime NOT NULL,
  `aud_evento` varchar(24) NOT NULL,
  `aud_servicio` varchar(24) NOT NULL,
  `aud_usuId` int(11) DEFAULT NULL,
  `aud_sesFamilia` char(32) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `aud_ip` varchar(45) NOT NULL,
  `aud_agenteUsuario` varchar(255) NOT NULL,
  `aud_detalle` varchar(255) NOT NULL,
  PRIMARY KEY (`aud_id`),
  KEY `sgen_auditoria_fecha_idx` (`aud_fecha`),
  KEY `sgen_auditoria_evento_fecha_idx` (`aud_evento`,`aud_fecha`),
  KEY `sgen_auditoria_usuario_fecha_idx` (`aud_usuId`,`aud_fecha`),
  CONSTRAINT `sgen_usuario_sgen_auditoria_fk` FOREIGN KEY (`aud_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_intentoacceso` (
  `ina_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ina_usuarioHash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `ina_ip` varchar(45) NOT NULL,
  `ina_fecha` datetime NOT NULL,
  PRIMARY KEY (`ina_id`),
  KEY `sgen_intentoacceso_usuario_fecha_idx` (`ina_usuarioHash`,`ina_fecha`),
  KEY `sgen_intentoacceso_ip_fecha_idx` (`ina_ip`,`ina_fecha`),
  KEY `sgen_intentoacceso_fecha_idx` (`ina_fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_limitepeticion` (
  `lip_clave` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `lip_ventana` datetime NOT NULL,
  `lip_contador` int(10) unsigned NOT NULL,
  PRIMARY KEY (`lip_clave`,`lip_ventana`),
  KEY `sgen_limitepeticion_ventana_idx` (`lip_ventana`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_persona` (
  `per_idPersona` int(11) NOT NULL AUTO_INCREMENT,
  `per_cedula` varchar(13) DEFAULT NULL,
  `per_nombres` varchar(32) DEFAULT NULL,
  `per_apellidos` varchar(32) NOT NULL,
  `per_direccion` varchar(128) DEFAULT NULL,
  `per_correo` varchar(64) NOT NULL,
  `per_telefono` varchar(16) DEFAULT NULL,
  `per_tipoPersona` varchar(32) NOT NULL DEFAULT 'CLIENTE',
  `per_fechaRegis` datetime NOT NULL DEFAULT current_timestamp(),
  `per_situacion` char(1) NOT NULL DEFAULT 'A' COMMENT 'A Activo\r\nE Anulado\r\nP Pendiente\r\nS Suspendido',
  `per_estado` char(1) NOT NULL DEFAULT '1' COMMENT '1 Activo\r\n0 Elimnado',
  PRIMARY KEY (`per_idPersona`),
  KEY `idx_per_correo` (`per_correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_recuperacion` (
  `rec_idRecuperacion` int(11) NOT NULL AUTO_INCREMENT,
  `rec_usuId` int(11) NOT NULL COMMENT 'sgen_usuario.usu_idUsuario',
  `rec_codigoHash` varchar(255) NOT NULL COMMENT 'Argon2id del c├│digo de 6 d├¡gitos; nunca el c├│digo',
  `rec_fechaCrea` datetime NOT NULL DEFAULT current_timestamp(),
  `rec_fechaExpira` datetime NOT NULL,
  `rec_intentos` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'M├íximo 5',
  `rec_situacion` char(1) NOT NULL DEFAULT 'A' COMMENT 'A Activo; U Usado; R Reemplazado',
  `rec_fechaUso` datetime DEFAULT NULL,
  `rec_ipSolicitud` varchar(45) NOT NULL,
  `rec_agenteSolicitud` varchar(255) DEFAULT NULL,
  `rec_ipUso` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`rec_idRecuperacion`),
  KEY `idx_rec_usuario_fecha` (`rec_usuId`,`rec_fechaCrea`),
  KEY `idx_rec_expira` (`rec_fechaExpira`),
  CONSTRAINT `sgen_usuario_sgen_recuperacion_fk` FOREIGN KEY (`rec_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_rol` (
  `rol_id` int(11) NOT NULL AUTO_INCREMENT,
  `rol_descripcion` varchar(32) NOT NULL,
  `rol_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `rol_estado` char(1) DEFAULT '1' COMMENT '1 Activo\r\n0 Elimnado',
  PRIMARY KEY (`rol_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_rolusuario` (
  `rus_idRolUs` int(11) NOT NULL AUTO_INCREMENT,
  `rus_usuId` int(11) NOT NULL,
  `rus_rolId` int(11) NOT NULL,
  `rus_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `rus_estado` char(1) DEFAULT '1' COMMENT '1 Activo\r\n0 Elimnado',
  PRIMARY KEY (`rus_idRolUs`),
  KEY `sgen_usuario_sgen_rolusuario_fk` (`rus_usuId`),
  KEY `sgen_rol_sgen_rolusuario_fk` (`rus_rolId`),
  CONSTRAINT `sgen_rol_sgen_rolusuario_fk` FOREIGN KEY (`rus_rolId`) REFERENCES `sgen_rol` (`rol_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `sgen_usuario_sgen_rolusuario_fk` FOREIGN KEY (`rus_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_sesion` (
  `ses_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ses_familia` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `ses_usuId` int(11) NOT NULL,
  `ses_hashAcceso` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `ses_hashRefresh` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `ses_accesoExpira` datetime NOT NULL,
  `ses_refreshExpira` datetime NOT NULL,
  `ses_familiaExpira` datetime NOT NULL,
  `ses_fechaCreacion` datetime NOT NULL,
  `ses_ultimoUso` datetime NOT NULL,
  `ses_ip` varchar(45) NOT NULL,
  `ses_agenteUsuario` varchar(255) NOT NULL,
  `ses_navegador` varchar(16) NOT NULL,
  `ses_cliente` char(1) NOT NULL,
  `ses_estado` char(1) NOT NULL,
  `ses_motivoRevocacion` varchar(24) DEFAULT NULL,
  `ses_fechaRevocacion` datetime DEFAULT NULL,
  PRIMARY KEY (`ses_id`),
  UNIQUE KEY `sgen_sesion_hashacceso_uq` (`ses_hashAcceso`),
  UNIQUE KEY `sgen_sesion_hashrefresh_uq` (`ses_hashRefresh`),
  KEY `sgen_sesion_familia_idx` (`ses_familia`),
  KEY `sgen_sesion_usuario_idx` (`ses_usuId`),
  CONSTRAINT `sgen_usuario_sgen_sesion_fk` FOREIGN KEY (`ses_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `sgen_sesion_cliente_ck` CHECK (`ses_cliente` in ('W','N')),
  CONSTRAINT `sgen_sesion_estado_ck` CHECK (`ses_estado` in ('A','R','V'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_usuario` (
  `usu_idUsuario` int(11) NOT NULL AUTO_INCREMENT,
  `usu_perIdPerso` int(11) NOT NULL,
  `usu_usuario` varchar(32) NOT NULL,
  `usu_clave` varchar(1024) NOT NULL,
  `usu_situacion` char(1) DEFAULT 'P' COMMENT 'A ACTIVO\r\nS SUSPENDIDO\r\nE ELIMINADO\r\nP: Pendiente',
  `usu_estado` char(1) DEFAULT '1' COMMENT '1 Activo\r\n0 Elimnado',
  PRIMARY KEY (`usu_idUsuario`),
  UNIQUE KEY `sgen_usuario_idx` (`usu_usuario`),
  KEY `sgen_persona_sgen_usuario_fk` (`usu_perIdPerso`),
  CONSTRAINT `sgen_persona_sgen_usuario_fk` FOREIGN KEY (`usu_perIdPerso`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sgen_verificacion` (
  `ver_idVerificacion` int(11) NOT NULL AUTO_INCREMENT,
  `ver_usuId` int(11) NOT NULL COMMENT 'sgen_usuario.usu_idUsuario',
  `ver_codigoHash` varchar(255) NOT NULL COMMENT 'Argon2id del c├│digo de 6 d├¡gitos; nunca el c├│digo',
  `ver_fechaCrea` datetime NOT NULL DEFAULT current_timestamp(),
  `ver_fechaExpira` datetime NOT NULL COMMENT 'ver_fechaCrea + 15 minutos',
  `ver_intentos` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'M├íximo 5',
  `ver_situacion` char(1) NOT NULL DEFAULT 'A' COMMENT 'A Activo; U Usado; R Reemplazado',
  `ver_fechaUso` datetime DEFAULT NULL,
  `ver_ipSolicitud` varchar(45) NOT NULL,
  `ver_agenteSolicitud` varchar(255) DEFAULT NULL,
  `ver_ipUso` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`ver_idVerificacion`),
  KEY `idx_ver_usuario_fecha` (`ver_usuId`,`ver_fechaCrea`),
  KEY `idx_ver_ip_fecha` (`ver_ipSolicitud`,`ver_fechaCrea`),
  KEY `idx_ver_expira` (`ver_fechaExpira`),
  CONSTRAINT `sgen_usuario_sgen_verificacion_fk` FOREIGN KEY (`ver_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


SET FOREIGN_KEY_CHECKS=1;
