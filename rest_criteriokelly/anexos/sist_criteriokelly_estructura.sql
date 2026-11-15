-- ============================================================================
-- rest_criteriokelly · ESTRUCTURA de la base sist_criteriokelly (tablas sckb, sckc, scko, sckp, sckr, sckt de este proyecto)
-- Generado desde la base viva el 2026-11-12. Es el único script de estructura de este proyecto.
-- Uso: importar desde el gestor de base de datos (phpMyAdmin > Importar) o
--      C:\xampp\mysql\bin\mysql.exe -u root < sist_criteriokelly_estructura.sql
-- No borra nada: cada tabla se crea solo si no existe. Los cambios futuros de la base
-- se entregan como un script de actualización aparte y este archivo se regenera.
-- ============================================================================
CREATE DATABASE IF NOT EXISTS `sist_criteriokelly` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `sist_criteriokelly`;
SET FOREIGN_KEY_CHECKS=0;


CREATE TABLE IF NOT EXISTS `sckb_bitacora` (
  `bit_idbitacora` int(11) NOT NULL AUTO_INCREMENT,
  `bit_usuarioId` int(11) NOT NULL DEFAULT 0,
  `bit_cueIdCuentas` int(11) NOT NULL DEFAULT 0,
  `bit_numeroBitac` int(11) NOT NULL DEFAULT 1,
  `bit_divisa` varchar(32) NOT NULL DEFAULT 'EURUSD',
  `bit_tipoOperaci` varchar(8) NOT NULL DEFAULT 'COMPRA',
  `bit_precioEntra` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `bit_precioSL` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `bit_precioTP` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `bit_pipTotal` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `bit_montoOpera` decimal(9,3) NOT NULL DEFAULT 0.000,
  `bit_montoResult` decimal(10,3) NOT NULL DEFAULT 0.000,
  `bit_resultado` varchar(16) DEFAULT NULL,
  `bit_balance` decimal(10,3) NOT NULL DEFAULT 0.000,
  `bit_situacion` char(1) NOT NULL DEFAULT 'O' COMMENT 'O Operación\r\nF Finalizado',
  `bit_fechaCrea` datetime NOT NULL DEFAULT current_timestamp(),
  `bit_fechaFin` datetime DEFAULT NULL,
  `bit_respeReglas` char(2) NOT NULL DEFAULT 'SI',
  `bit_estado` char(1) NOT NULL DEFAULT '1' COMMENT '1 Activo\r\n0 Eliminado',
  PRIMARY KEY (`bit_idbitacora`),
  KEY `sckc_cuentas_sckb_bitacora_fk` (`bit_cueIdCuentas`),
  CONSTRAINT `sckc_cuentas_sckb_bitacora_fk` FOREIGN KEY (`bit_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sckc_capital` (
  `cap_idCapital` int(11) NOT NULL AUTO_INCREMENT,
  `cap_usuarioId` int(11) NOT NULL,
  `cap_cueIdCuentas` int(11) NOT NULL,
  `cap_monto` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `cap_capital` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `cap_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `cap_tipoMovimie` char(1) NOT NULL DEFAULT 'D',
  PRIMARY KEY (`cap_idCapital`),
  KEY `sckc_cuentas_sckc_capital_fk` (`cap_cueIdCuentas`),
  CONSTRAINT `sckc_cuentas_sckc_capital_fk` FOREIGN KEY (`cap_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sckc_cuentas` (
  `cue_idCuentas` int(11) NOT NULL AUTO_INCREMENT,
  `cue_situacion` char(1) NOT NULL DEFAULT 'A' COMMENT 'Activa, Suspendido, Revisión',
  `cue_nombre` varchar(64) NOT NULL,
  `cue_usuarioId` int(11) NOT NULL DEFAULT 1,
  `cue_fechaCrea` date NOT NULL,
  `cue_fechaCambia` datetime NOT NULL DEFAULT current_timestamp(),
  `cue_estado` char(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`cue_idCuentas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `scko_cantoperacion` (
  `cop_idOperacion` int(11) NOT NULL AUTO_INCREMENT,
  `cop_cueIdCuentas` int(11) NOT NULL,
  `cop_cantidadOpe` int(11) NOT NULL DEFAULT 1,
  `cop_x100Opera` decimal(6,3) NOT NULL DEFAULT 0.000,
  `cop_montoOpera` decimal(8,3) NOT NULL DEFAULT 0.000,
  `cop_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`cop_idOperacion`),
  UNIQUE KEY `sckc_cuentas_scko_cantoperacion_fk` (`cop_cueIdCuentas`),
  CONSTRAINT `scko_cantoperacion_ibfk_1` FOREIGN KEY (`cop_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `scko_observacion` (
  `obs_idObserva` int(11) NOT NULL AUTO_INCREMENT,
  `obs_bitIdbitaco` int(11) NOT NULL,
  `obs_comentario` varchar(4096) NOT NULL,
  `obs_tipoObserva` varchar(8) NOT NULL DEFAULT 'I' COMMENT 'I: inicio\r\nE: Emosion psicológica\r\nP: Proceso\r\nL: Lecciones Aprendidas\r\nF: Final',
  `obs_imagen` longtext DEFAULT NULL,
  `obs_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`obs_idObserva`),
  KEY `sckb_bitacora_scko_observacion_fk` (`obs_bitIdbitaco`),
  CONSTRAINT `sckb_bitacora_scko_observacion_fk` FOREIGN KEY (`obs_bitIdbitaco`) REFERENCES `sckb_bitacora` (`bit_idbitacora`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sckp_criteriokelly` (
  `cke_idCritKelly` int(11) NOT NULL AUTO_INCREMENT,
  `cke_cueIdCuentas` int(11) NOT NULL,
  `cke_usuarioId` int(11) NOT NULL,
  `cke_x100Kelly` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `cke_numDivisor` int(11) NOT NULL DEFAULT 10,
  `cke_x100Operativo` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `cke_montoOperar` decimal(8,3) NOT NULL DEFAULT 0.000,
  `cke_identifica` varchar(32) NOT NULL,
  `cke_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`cke_idCritKelly`),
  KEY `sclc_cuentas_sckp_criterioKelly_fk` (`cke_cueIdCuentas`) USING BTREE,
  CONSTRAINT `sckp_criteriokelly_ibfk_1` FOREIGN KEY (`cke_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sckr_registrooperat` (
  `reo_idRegisOp` int(11) NOT NULL AUTO_INCREMENT,
  `reo_usuarioId` int(11) NOT NULL,
  `reo_cueIdCuentas` int(11) NOT NULL,
  `reo_cantCompra` int(11) NOT NULL DEFAULT 0,
  `reo_x100Compra` decimal(6,3) NOT NULL DEFAULT 0.000,
  `reo_cantVenta` int(11) NOT NULL DEFAULT 0,
  `reo_x100Venta` decimal(6,3) NOT NULL DEFAULT 0.000,
  `reo_TotalPips` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `reo_PipsProfit` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `reo_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`reo_idRegisOp`),
  KEY `sckc_cuentas_sckr_registroop_fk` (`reo_cueIdCuentas`),
  CONSTRAINT `sckc_cuentas_sckr_registroop_fk` FOREIGN KEY (`reo_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sckr_rentabilidad` (
  `ren_idRentabili` int(11) NOT NULL AUTO_INCREMENT,
  `ren_cueIdCuentas` int(11) NOT NULL,
  `ren_porcentaje` decimal(6,3) NOT NULL DEFAULT 0.000,
  `ren_montoNeto` decimal(8,3) NOT NULL DEFAULT 0.000,
  `ren_montoTotal` decimal(10,3) NOT NULL DEFAULT 0.000,
  `ren_identifica` varchar(32) NOT NULL,
  `ren_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`ren_idRentabili`),
  KEY `sckc_cuentas_sckr_rentabilidad_fk` (`ren_cueIdCuentas`),
  CONSTRAINT `sckr_rentabilidad_ibfk_1` FOREIGN KEY (`ren_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sckr_resultado` (
  `res_idResultado` int(11) NOT NULL AUTO_INCREMENT,
  `res_cueIdCuentas` int(11) NOT NULL,
  `res_opeGanador` int(11) NOT NULL DEFAULT 0,
  `res_x100Ganador` decimal(6,3) NOT NULL DEFAULT 0.000,
  `res_opePerdedor` int(11) NOT NULL DEFAULT 0,
  `res_x100Perdedor` decimal(6,3) NOT NULL DEFAULT 0.000,
  `res_opeBreakEven` int(11) NOT NULL DEFAULT 0,
  `res_x100BreakEven` decimal(6,3) NOT NULL DEFAULT 0.000,
  `res_operAbierta` int(11) NOT NULL,
  `res_x100Abierta` decimal(6,3) NOT NULL,
  `res_totalOperac` int(11) NOT NULL DEFAULT 0,
  `res_x100Total` decimal(6,3) NOT NULL DEFAULT 0.000,
  `res_identifica` varchar(32) NOT NULL,
  `res_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`res_idResultado`),
  KEY `sckc_ceuntas_sckr_resultado_fk` (`res_cueIdCuentas`),
  CONSTRAINT `sckr_resultado_ibfk_1` FOREIGN KEY (`res_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sckr_riesgobeneficio` (
  `rib_idRiesBenef` int(11) NOT NULL AUTO_INCREMENT,
  `rib_cueIdCuentas` int(11) NOT NULL,
  `rib_montoGanan` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rib_relacionGanan` decimal(6,3) NOT NULL DEFAULT 0.000,
  `rib_montoRiesgo` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rib_relacionRiesgo` decimal(6,3) NOT NULL DEFAULT 0.000,
  `rib_mtoEspeMatem` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rib_relaEspeMate` decimal(6,3) NOT NULL DEFAULT 0.000,
  `rib_identifica` varchar(32) NOT NULL,
  `rib_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`rib_idRiesBenef`),
  KEY `sckc_ceuntas_sckr_riesgobeneficio_fk` (`rib_cueIdCuentas`),
  CONSTRAINT `sckr_riesgobeneficio_ibfk_1` FOREIGN KEY (`rib_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `sckt_factortotal` (
  `fat_idFactotal` int(11) NOT NULL AUTO_INCREMENT,
  `fat_cueIdCuentas` int(11) NOT NULL,
  `fat_montoGanan` decimal(12,3) NOT NULL DEFAULT 0.000,
  `fat_montoPierde` decimal(12,3) NOT NULL DEFAULT 0.000,
  `fat_profitFactor` decimal(6,3) NOT NULL DEFAULT 0.000,
  `fat_identifica` varchar(32) NOT NULL,
  `fat_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`fat_idFactotal`),
  KEY `sckc_ceuntas_sckt_factortotal_fk` (`fat_cueIdCuentas`),
  CONSTRAINT `sckt_factortotal_ibfk_1` FOREIGN KEY (`fat_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


SET FOREIGN_KEY_CHECKS=1;
