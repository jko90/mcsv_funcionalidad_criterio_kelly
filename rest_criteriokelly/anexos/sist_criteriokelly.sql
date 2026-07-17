-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 15-08-2025 a las 23:15:34
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sist_criteriokelly`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckb_bitacora`
--

CREATE TABLE `sckb_bitacora` (
  `bit_idbitacora` int(11) NOT NULL,
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
  `bit_estado` char(1) NOT NULL DEFAULT '1' COMMENT '1 Activo\r\n0 Eliminado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckc_capital`
--

CREATE TABLE `sckc_capital` (
  `cap_idCapital` int(11) NOT NULL,
  `cap_usuarioId` int(11) NOT NULL,
  `cap_cueIdCuentas` int(11) NOT NULL,
  `cap_monto` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `cap_capital` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `cap_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `cap_tipoMovimie` char(1) NOT NULL DEFAULT 'D'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckc_cuentas`
--

CREATE TABLE `sckc_cuentas` (
  `cue_idCuentas` int(11) NOT NULL,
  `cue_situacion` char(1) NOT NULL DEFAULT 'A' COMMENT 'Activa, Suspendido, Revisión',
  `cue_nombre` varchar(64) NOT NULL,
  `cue_usuarioId` int(11) NOT NULL DEFAULT 1,
  `cue_fechaCrea` date NOT NULL,
  `cue_fechaCambia` datetime NOT NULL DEFAULT current_timestamp(),
  `cue_estado` char(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `scko_cantoperacion`
--

CREATE TABLE `scko_cantoperacion` (
  `cop_idOperacion` int(11) NOT NULL,
  `cop_cueIdCuentas` int(11) NOT NULL,
  `cop_cantidadOpe` int(11) NOT NULL DEFAULT 1,
  `cop_x100Opera` decimal(6,3) NOT NULL DEFAULT 0.000,
  `cop_montoOpera` decimal(8,3) NOT NULL DEFAULT 0.000,
  `cop_fecha` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `scko_observacion`
--

CREATE TABLE `scko_observacion` (
  `obs_idObserva` int(11) NOT NULL,
  `obs_bitIdbitaco` int(11) NOT NULL,
  `obs_comentario` varchar(4096) NOT NULL,
  `obs_tipoObserva` varchar(8) NOT NULL DEFAULT 'I' COMMENT 'I: inicio\r\nE: Emosion psicológica\r\nP: Proceso\r\nL: Lecciones Aprendidas\r\nF: Final',
  `obs_imagen` longtext DEFAULT NULL,
  `obs_fecha` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckp_criteriokelly`
--

CREATE TABLE `sckp_criteriokelly` (
  `cke_idCritKelly` int(11) NOT NULL,
  `cke_cueIdCuentas` int(11) NOT NULL,
  `cke_usuarioId` int(11) NOT NULL,
  `cke_x100Kelly` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `cke_numDivisor` int(11) NOT NULL DEFAULT 10,
  `cke_x100Operativo` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `cke_montoOperar` decimal(8,3) NOT NULL DEFAULT 0.000,
  `cke_identifica` varchar(32) NOT NULL,
  `cke_fecha` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckr_registrooperat`
--

CREATE TABLE `sckr_registrooperat` (
  `reo_idRegisOp` int(11) NOT NULL,
  `reo_usuarioId` int(11) NOT NULL,
  `reo_cueIdCuentas` int(11) NOT NULL,
  `reo_cantCompra` int(11) NOT NULL DEFAULT 0,
  `reo_x100Compra` decimal(6,3) NOT NULL DEFAULT 0.000,
  `reo_cantVenta` int(11) NOT NULL DEFAULT 0,
  `reo_x100Venta` decimal(6,3) NOT NULL DEFAULT 0.000,
  `reo_TotalPips` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `reo_PipsProfit` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `reo_fecha` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckr_rentabilidad`
--

CREATE TABLE `sckr_rentabilidad` (
  `ren_idRentabili` int(11) NOT NULL,
  `ren_cueIdCuentas` int(11) NOT NULL,
  `ren_porcentaje` decimal(6,3) NOT NULL DEFAULT 0.000,
  `ren_montoNeto` decimal(8,3) NOT NULL DEFAULT 0.000,
  `ren_montoTotal` decimal(10,3) NOT NULL DEFAULT 0.000,
  `ren_identifica` varchar(32) NOT NULL,
  `ren_fecha` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckr_resultado`
--

CREATE TABLE `sckr_resultado` (
  `res_idResultado` int(11) NOT NULL,
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
  `res_fecha` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckr_riesgobeneficio`
--

CREATE TABLE `sckr_riesgobeneficio` (
  `rib_idRiesBenef` int(11) NOT NULL,
  `rib_cueIdCuentas` int(11) NOT NULL,
  `rib_montoGanan` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rib_relacionGanan` decimal(6,3) NOT NULL DEFAULT 0.000,
  `rib_montoRiesgo` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rib_relacionRiesgo` decimal(6,3) NOT NULL DEFAULT 0.000,
  `rib_mtoEspeMatem` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rib_relaEspeMate` decimal(6,3) NOT NULL DEFAULT 0.000,
  `rib_identifica` varchar(32) NOT NULL,
  `rib_fecha` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sckt_factortotal`
--

CREATE TABLE `sckt_factortotal` (
  `fat_idFactotal` int(11) NOT NULL,
  `fat_cueIdCuentas` int(11) NOT NULL,
  `fat_montoGanan` decimal(12,3) NOT NULL DEFAULT 0.000,
  `fat_montoPierde` decimal(12,3) NOT NULL DEFAULT 0.000,
  `fat_profitFactor` decimal(6,3) NOT NULL DEFAULT 0.000,
  `fat_identifica` varchar(32) NOT NULL,
  `fat_fecha` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `sckb_bitacora`
--
ALTER TABLE `sckb_bitacora`
  ADD PRIMARY KEY (`bit_idbitacora`),
  ADD KEY `sckc_cuentas_sckb_bitacora_fk` (`bit_cueIdCuentas`);

--
-- Indices de la tabla `sckc_capital`
--
ALTER TABLE `sckc_capital`
  ADD PRIMARY KEY (`cap_idCapital`),
  ADD KEY `sckc_cuentas_sckc_capital_fk` (`cap_cueIdCuentas`);

--
-- Indices de la tabla `sckc_cuentas`
--
ALTER TABLE `sckc_cuentas`
  ADD PRIMARY KEY (`cue_idCuentas`);

--
-- Indices de la tabla `scko_cantoperacion`
--
ALTER TABLE `scko_cantoperacion`
  ADD PRIMARY KEY (`cop_idOperacion`),
  ADD UNIQUE KEY `sckc_cuentas_scko_cantoperacion_fk` (`cop_cueIdCuentas`);

--
-- Indices de la tabla `scko_observacion`
--
ALTER TABLE `scko_observacion`
  ADD PRIMARY KEY (`obs_idObserva`),
  ADD KEY `sckb_bitacora_scko_observacion_fk` (`obs_bitIdbitaco`);

--
-- Indices de la tabla `sckp_criteriokelly`
--
ALTER TABLE `sckp_criteriokelly`
  ADD PRIMARY KEY (`cke_idCritKelly`),
  ADD KEY `sclc_cuentas_sckp_criterioKelly_fk` (`cke_cueIdCuentas`) USING BTREE;

--
-- Indices de la tabla `sckr_registrooperat`
--
ALTER TABLE `sckr_registrooperat`
  ADD PRIMARY KEY (`reo_idRegisOp`),
  ADD KEY `sckc_cuentas_sckr_registroop_fk` (`reo_cueIdCuentas`);

--
-- Indices de la tabla `sckr_rentabilidad`
--
ALTER TABLE `sckr_rentabilidad`
  ADD PRIMARY KEY (`ren_idRentabili`),
  ADD KEY `sckc_cuentas_sckr_rentabilidad_fk` (`ren_cueIdCuentas`);

--
-- Indices de la tabla `sckr_resultado`
--
ALTER TABLE `sckr_resultado`
  ADD PRIMARY KEY (`res_idResultado`),
  ADD KEY `sckc_ceuntas_sckr_resultado_fk` (`res_cueIdCuentas`);

--
-- Indices de la tabla `sckr_riesgobeneficio`
--
ALTER TABLE `sckr_riesgobeneficio`
  ADD PRIMARY KEY (`rib_idRiesBenef`),
  ADD KEY `sckc_ceuntas_sckr_riesgobeneficio_fk` (`rib_cueIdCuentas`);

--
-- Indices de la tabla `sckt_factortotal`
--
ALTER TABLE `sckt_factortotal`
  ADD PRIMARY KEY (`fat_idFactotal`),
  ADD KEY `sckc_ceuntas_sckt_factortotal_fk` (`fat_cueIdCuentas`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `sckb_bitacora`
--
ALTER TABLE `sckb_bitacora`
  MODIFY `bit_idbitacora` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sckc_capital`
--
ALTER TABLE `sckc_capital`
  MODIFY `cap_idCapital` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sckc_cuentas`
--
ALTER TABLE `sckc_cuentas`
  MODIFY `cue_idCuentas` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `scko_cantoperacion`
--
ALTER TABLE `scko_cantoperacion`
  MODIFY `cop_idOperacion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `scko_observacion`
--
ALTER TABLE `scko_observacion`
  MODIFY `obs_idObserva` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sckp_criteriokelly`
--
ALTER TABLE `sckp_criteriokelly`
  MODIFY `cke_idCritKelly` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sckr_registrooperat`
--
ALTER TABLE `sckr_registrooperat`
  MODIFY `reo_idRegisOp` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sckr_rentabilidad`
--
ALTER TABLE `sckr_rentabilidad`
  MODIFY `ren_idRentabili` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sckr_resultado`
--
ALTER TABLE `sckr_resultado`
  MODIFY `res_idResultado` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sckr_riesgobeneficio`
--
ALTER TABLE `sckr_riesgobeneficio`
  MODIFY `rib_idRiesBenef` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sckt_factortotal`
--
ALTER TABLE `sckt_factortotal`
  MODIFY `fat_idFactotal` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `sckb_bitacora`
--
ALTER TABLE `sckb_bitacora`
  ADD CONSTRAINT `sckc_cuentas_sckb_bitacora_fk` FOREIGN KEY (`bit_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `sckc_capital`
--
ALTER TABLE `sckc_capital`
  ADD CONSTRAINT `sckc_cuentas_sckc_capital_fk` FOREIGN KEY (`cap_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `scko_cantoperacion`
--
ALTER TABLE `scko_cantoperacion`
  ADD CONSTRAINT `scko_cantoperacion_ibfk_1` FOREIGN KEY (`cop_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`);

--
-- Filtros para la tabla `scko_observacion`
--
ALTER TABLE `scko_observacion`
  ADD CONSTRAINT `sckb_bitacora_scko_observacion_fk` FOREIGN KEY (`obs_bitIdbitaco`) REFERENCES `sckb_bitacora` (`bit_idbitacora`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `sckp_criteriokelly`
--
ALTER TABLE `sckp_criteriokelly`
  ADD CONSTRAINT `sckp_criteriokelly_ibfk_1` FOREIGN KEY (`cke_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`);

--
-- Filtros para la tabla `sckr_registrooperat`
--
ALTER TABLE `sckr_registrooperat`
  ADD CONSTRAINT `sckc_cuentas_sckr_registroop_fk` FOREIGN KEY (`reo_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `sckr_rentabilidad`
--
ALTER TABLE `sckr_rentabilidad`
  ADD CONSTRAINT `sckr_rentabilidad_ibfk_1` FOREIGN KEY (`ren_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`);

--
-- Filtros para la tabla `sckr_resultado`
--
ALTER TABLE `sckr_resultado`
  ADD CONSTRAINT `sckr_resultado_ibfk_1` FOREIGN KEY (`res_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`);

--
-- Filtros para la tabla `sckr_riesgobeneficio`
--
ALTER TABLE `sckr_riesgobeneficio`
  ADD CONSTRAINT `sckr_riesgobeneficio_ibfk_1` FOREIGN KEY (`rib_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`);

--
-- Filtros para la tabla `sckt_factortotal`
--
ALTER TABLE `sckt_factortotal`
  ADD CONSTRAINT `sckt_factortotal_ibfk_1` FOREIGN KEY (`fat_cueIdCuentas`) REFERENCES `sckc_cuentas` (`cue_idCuentas`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
