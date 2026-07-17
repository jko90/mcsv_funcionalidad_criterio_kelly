-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 01-08-2025 a las 20:57:23
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

--
-- Volcado de datos para la tabla `sgen_persona`
--

INSERT INTO `sgen_persona` (`per_idPersona`, `per_cedula`, `per_nombres`, `per_apellidos`, `per_direccion`, `per_correo`, `per_telefono`, `per_tipoPersona`, `per_fechaRegis`, `per_situacion`, `per_estado`) VALUES
(1, '0000000000', 'Juan Sander San', 'Pérez Perez', 'Pruebas', 'pruebas@gmail.com', '9874563210', 'USUARIO', '2025-07-17 18:03:33', 'A', '1'),
(2, '999999999', 'Prueba', 'PruebaAp', NULL, 'prueba@gmail.com', '987654', 'CLIENTE', '2025-07-19 12:50:50', 'A', '1'),
(3, '', 'edfsdfsd', 'sdfsdfsd', NULL, 'dfghfghfgh@dfg.com', '56567', 'CLIENTE', '2025-07-25 08:55:41', 'A', '1'),
(4, '9874563210', 'Prueba', 'Pruebba nombre', NULL, 'sdfsdf@gmail.com', '0147852369', 'CLIENTE', '2025-07-30 19:56:52', 'A', '1');

--
-- Volcado de datos para la tabla `sgen_rol`
--

INSERT INTO `sgen_rol` (`rol_id`, `rol_descripcion`, `rol_fecha`, `rol_estado`) VALUES
(1, 'Super Administrador', '2025-07-17 18:45:43', '1'),
(2, 'Administrador', '2025-07-17 18:45:43', '1'),
(3, 'Suscriptor', '2025-07-19 13:00:37', '1'),
(4, 'Visitante', '2025-07-19 13:00:37', '1');

--
-- Volcado de datos para la tabla `sgen_usuario`
--

INSERT INTO `sgen_usuario` (`usu_idUsuario`, `usu_perIdPerso`, `usu_usuario`, `usu_clave`, `usu_codiorecupe`, `usu_situacion`, `usu_estado`) VALUES
(1, 1, 'wills', '$2y$10$442fIrVBpaJAGOUWXla3RuZWbqDa78b/3fzuMAC6OCnyzfvME/PcO', 199127, 'A', '1'),
(2, 2, 'juanperez', '$2y$10$CWrsHKGppDkd6/NSuoepXegemNKJ/2YVilojJiS6p3hybY9U0amt2', 0, 'A', '1'),
(3, 3, 'unos', '$2y$10$TP7aB0iUnivWXdzAudARQuoEgG4YYwILhjQ5v6QBShVTurrOceTUi', 0, 'P', '1'),
(4, 4, 'same', '$2y$10$5WZBF.oIV.1JJD33t5Qx2OOw2AMX8AfulDXKyN9UhE.diW9lMKrwu', 0, 'P', '1');

--
-- Volcado de datos para la tabla `sgen_rolusuario`
--

INSERT INTO `sgen_rolusuario` (`rus_idRolUs`, `rus_usuId`, `rus_rolId`, `rus_fecha`, `rus_estado`) VALUES
(1, 1, 1, '2025-07-17 18:46:15', '1'),
(2, 1, 2, '2025-07-17 18:46:15', '1'),
(3, 3, 4, '2025-07-25 08:55:41', '1'),
(4, 4, 4, '2025-07-30 19:56:52', '1');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
