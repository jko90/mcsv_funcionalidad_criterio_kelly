-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 15-08-2025 a las 23:20:50
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
-- Estructura de tabla para la tabla `sgen_persona`
--

CREATE TABLE `sgen_persona` (
  `per_idPersona` int(11) NOT NULL,
  `per_cedula` varchar(13) DEFAULT NULL,
  `per_nombres` varchar(32) DEFAULT NULL,
  `per_apellidos` varchar(32) NOT NULL,
  `per_direccion` varchar(128) DEFAULT NULL,
  `per_correo` varchar(64) NOT NULL,
  `per_telefono` varchar(16) DEFAULT NULL,
  `per_tipoPersona` varchar(32) NOT NULL DEFAULT 'CLIENTE',
  `per_fechaRegis` datetime NOT NULL DEFAULT current_timestamp(),
  `per_situacion` char(1) NOT NULL DEFAULT 'A' COMMENT 'A Activo\r\nE Anulado\r\nP Pendiente\r\nS Suspendido',
  `per_estado` char(1) NOT NULL DEFAULT '1' COMMENT '1 Activo\r\n0 Elimnado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sgen_rol`
--

CREATE TABLE `sgen_rol` (
  `rol_id` int(11) NOT NULL,
  `rol_descripcion` varchar(32) NOT NULL,
  `rol_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `rol_estado` char(1) DEFAULT '1' COMMENT '1 Activo\r\n0 Elimnado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sgen_rolusuario`
--

CREATE TABLE `sgen_rolusuario` (
  `rus_idRolUs` int(11) NOT NULL,
  `rus_usuId` int(11) NOT NULL,
  `rus_rolId` int(11) NOT NULL,
  `rus_fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `rus_estado` char(1) DEFAULT '1' COMMENT '1 Activo\r\n0 Elimnado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sgen_usuario`
--

CREATE TABLE `sgen_usuario` (
  `usu_idUsuario` int(11) NOT NULL,
  `usu_perIdPerso` int(11) NOT NULL,
  `usu_usuario` varchar(32) NOT NULL,
  `usu_clave` varchar(1024) NOT NULL,
  `usu_codiorecupe` int(11) DEFAULT 0,
  `usu_situacion` char(1) DEFAULT 'P' COMMENT 'A ACTIVO\r\nS SUSPENDIDO\r\nE ELIMINADO\r\nP: Pendiente',
  `usu_estado` char(1) DEFAULT '1' COMMENT '1 Activo\r\n0 Elimnado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `sgen_persona`
--
ALTER TABLE `sgen_persona`
  ADD PRIMARY KEY (`per_idPersona`);

--
-- Indices de la tabla `sgen_rol`
--
ALTER TABLE `sgen_rol`
  ADD PRIMARY KEY (`rol_id`);

--
-- Indices de la tabla `sgen_rolusuario`
--
ALTER TABLE `sgen_rolusuario`
  ADD PRIMARY KEY (`rus_idRolUs`),
  ADD KEY `sgen_usuario_sgen_rolusuario_fk` (`rus_usuId`),
  ADD KEY `sgen_rol_sgen_rolusuario_fk` (`rus_rolId`);

--
-- Indices de la tabla `sgen_usuario`
--
ALTER TABLE `sgen_usuario`
  ADD PRIMARY KEY (`usu_idUsuario`),
  ADD UNIQUE KEY `sgen_usuario_idx` (`usu_usuario`),
  ADD KEY `sgen_persona_sgen_usuario_fk` (`usu_perIdPerso`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `sgen_persona`
--
ALTER TABLE `sgen_persona`
  MODIFY `per_idPersona` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sgen_rol`
--
ALTER TABLE `sgen_rol`
  MODIFY `rol_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sgen_rolusuario`
--
ALTER TABLE `sgen_rolusuario`
  MODIFY `rus_idRolUs` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sgen_usuario`
--
ALTER TABLE `sgen_usuario`
  MODIFY `usu_idUsuario` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `sgen_rolusuario`
--
ALTER TABLE `sgen_rolusuario`
  ADD CONSTRAINT `sgen_rol_sgen_rolusuario_fk` FOREIGN KEY (`rus_rolId`) REFERENCES `sgen_rol` (`rol_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `sgen_usuario_sgen_rolusuario_fk` FOREIGN KEY (`rus_usuId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `sgen_usuario`
--
ALTER TABLE `sgen_usuario`
  ADD CONSTRAINT `sgen_persona_sgen_usuario_fk` FOREIGN KEY (`usu_perIdPerso`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE NO ACTION ON UPDATE NO ACTION;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
