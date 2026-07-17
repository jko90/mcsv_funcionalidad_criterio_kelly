-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-09-2025 a las 10:59:58
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
-- Estructura de tabla para la tabla `spsu_historialsuscri`
--

CREATE TABLE `spsu_historialsuscri` (
  `his_idHistorial` int(11) NOT NULL,
  `his_usuarioId` int(11) NOT NULL,
  `his_sisIdSuscrip` int(11) NOT NULL,
  `his_accion` varchar(16) DEFAULT NULL COMMENT 'Creacion, actualizacion, cancelacion, renovacion, pausa, reactivacion',
  `his_detalle` varchar(4096) DEFAULT NULL,
  `his_fechaCambio` datetime NOT NULL,
  `his_direcionIP` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `spsu_intervalosuscr`
--

CREATE TABLE `spsu_intervalosuscr` (
  `ins_idInterSuscrip` int(11) NOT NULL,
  `ins_nombre` varchar(64) NOT NULL,
  `ins_numMeses` int(11) NOT NULL DEFAULT 1,
  `ins_x100descuen` decimal(4,2) NOT NULL DEFAULT 0.00,
  `ins_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `ins_estado` char(1) DEFAULT NULL COMMENT '1 Activo\r\n0 Eliminado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `spsu_pagos`
--

CREATE TABLE `spsu_pagos` (
  `pag_idPago` int(11) NOT NULL,
  `pag_susIdSuscri` int(11) NOT NULL,
  `pag_monto` decimal(6,2) NOT NULL DEFAULT 0.00,
  `pag_moneda` varchar(8) NOT NULL DEFAULT 'USD',
  `pag_fechaPago` datetime NOT NULL,
  `pag_metodoPago` varchar(64) DEFAULT 'CRIPTOMONEDA' COMMENT 'CRIPTOMONEDA,\r\nPAYPAL,\r\nBANCO',
  `pag_idTransac` varchar(256) NOT NULL DEFAULT '0',
  `pag_situacion` char(1) NOT NULL DEFAULT 'R' COMMENT 'R: revisión,\r\nC: Completado,\r\nF: Fallido, \r\nR: Reembolsado',
  `pag_pagoDesde` datetime DEFAULT NULL,
  `pag_pagoHasta` datetime DEFAULT NULL,
  `pag_imagen` longtext DEFAULT NULL,
  `pag_fechacrea` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `spsu_planes`
--

CREATE TABLE `spsu_planes` (
  `pla_idPlan` int(11) NOT NULL,
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
  `pla_fechacrea` date NOT NULL DEFAULT current_timestamp(),
  `pla_fechacambio` datetime NOT NULL DEFAULT current_timestamp(),
  `pla_estado` char(1) DEFAULT NULL COMMENT '1 Activo\r\n0 Eliminado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `spsu_planintervalo`
--

CREATE TABLE `spsu_planintervalo` (
  `pin_idPlanInterv` int(11) NOT NULL,
  `pin_plaIdPlan` int(11) NOT NULL,
  `pins_idInterSuscrip` int(11) NOT NULL,
  `pin_precioFinal` decimal(6,2) NOT NULL DEFAULT 0.00,
  `pin_estado` char(1) NOT NULL DEFAULT '1' COMMENT '1 Activo\r\n0 Eliminado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `spsu_suscripcion`
--

CREATE TABLE `spsu_suscripcion` (
  `sis_idSuscrip` int(11) NOT NULL,
  `sus_usuarioId` int(11) NOT NULL,
  `sus_pinIdPlanin` int(11) NOT NULL,
  `sus_fechainicio` date NOT NULL,
  `sus_fechaFin` date NOT NULL,
  `sus_situacion` char(1) DEFAULT 'P' COMMENT 'P: Pendiente,\r\nA: Activa,\r\nC: Cancelada,\r\nS: Pausada, \r\nE: Expirada',
  `sus_referenPago` varchar(254) DEFAULT NULL,
  `sus_renovAutomatica` tinyint(1) NOT NULL DEFAULT 1,
  `sus_proximoPago` date DEFAULT NULL,
  `sus_fechaCrea` date NOT NULL,
  `sus_fechaCambio` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `spsu_historialsuscri`
--
ALTER TABLE `spsu_historialsuscri`
  ADD PRIMARY KEY (`his_idHistorial`),
  ADD KEY `spsu_suscripcion_spsu_historialsuscri_fk` (`his_sisIdSuscrip`);

--
-- Indices de la tabla `spsu_intervalosuscr`
--
ALTER TABLE `spsu_intervalosuscr`
  ADD PRIMARY KEY (`ins_idInterSuscrip`);

--
-- Indices de la tabla `spsu_pagos`
--
ALTER TABLE `spsu_pagos`
  ADD PRIMARY KEY (`pag_idPago`),
  ADD KEY `spsu_suscripcion_spsu_pagos_fk` (`pag_susIdSuscri`);

--
-- Indices de la tabla `spsu_planes`
--
ALTER TABLE `spsu_planes`
  ADD PRIMARY KEY (`pla_idPlan`);

--
-- Indices de la tabla `spsu_planintervalo`
--
ALTER TABLE `spsu_planintervalo`
  ADD PRIMARY KEY (`pin_idPlanInterv`),
  ADD KEY `spsu_intervalosuscr_spsu_planintervalo_fk` (`pins_idInterSuscrip`),
  ADD KEY `spsu_planes_spsu_planintervalo_fk` (`pin_plaIdPlan`);

--
-- Indices de la tabla `spsu_suscripcion`
--
ALTER TABLE `spsu_suscripcion`
  ADD PRIMARY KEY (`sis_idSuscrip`),
  ADD KEY `spsu_planintervalo_spsu_suscripcion_fk` (`sus_pinIdPlanin`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `spsu_historialsuscri`
--
ALTER TABLE `spsu_historialsuscri`
  MODIFY `his_idHistorial` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `spsu_intervalosuscr`
--
ALTER TABLE `spsu_intervalosuscr`
  MODIFY `ins_idInterSuscrip` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `spsu_pagos`
--
ALTER TABLE `spsu_pagos`
  MODIFY `pag_idPago` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `spsu_planes`
--
ALTER TABLE `spsu_planes`
  MODIFY `pla_idPlan` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `spsu_planintervalo`
--
ALTER TABLE `spsu_planintervalo`
  MODIFY `pin_idPlanInterv` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `spsu_suscripcion`
--
ALTER TABLE `spsu_suscripcion`
  MODIFY `sis_idSuscrip` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `spsu_historialsuscri`
--
ALTER TABLE `spsu_historialsuscri`
  ADD CONSTRAINT `spsu_suscripcion_spsu_historialsuscri_fk` FOREIGN KEY (`his_sisIdSuscrip`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `spsu_pagos`
--
ALTER TABLE `spsu_pagos`
  ADD CONSTRAINT `spsu_suscripcion_spsu_pagos_fk` FOREIGN KEY (`pag_susIdSuscri`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `spsu_planintervalo`
--
ALTER TABLE `spsu_planintervalo`
  ADD CONSTRAINT `spsu_intervalosuscr_spsu_planintervalo_fk` FOREIGN KEY (`pins_idInterSuscrip`) REFERENCES `spsu_intervalosuscr` (`ins_idInterSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `spsu_planes_spsu_planintervalo_fk` FOREIGN KEY (`pin_plaIdPlan`) REFERENCES `spsu_planes` (`pla_idPlan`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `spsu_suscripcion`
--
ALTER TABLE `spsu_suscripcion`
  ADD CONSTRAINT `spsu_planintervalo_spsu_suscripcion_fk` FOREIGN KEY (`sus_pinIdPlanin`) REFERENCES `spsu_planintervalo` (`pin_idPlanInterv`) ON DELETE NO ACTION ON UPDATE NO ACTION;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
