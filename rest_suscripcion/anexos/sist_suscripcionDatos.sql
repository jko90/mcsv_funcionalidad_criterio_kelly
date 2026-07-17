-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 15-08-2025 a las 23:14:34
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
-- Volcado de datos para la tabla `spsu_intervalosuscr`
--

INSERT INTO `spsu_intervalosuscr` (`ins_idInterSuscrip`, `ins_nombre`, `ins_numMeses`, `ins_x100descuen`, `ins_fecha`, `ins_estado`) VALUES
(1, 'Mensual', 1, 0.00, '2025-08-15 16:12:07', '1'),
(2, 'Trimestral', 3, 10.00, '2025-08-15 16:12:07', '1'),
(3, 'Semestral', 6, 15.00, '2025-08-15 16:12:07', '1'),
(4, 'Anual', 12, 20.00, '2025-08-15 16:12:07', '1'),
(5, 'Bianual', 24, 25.00, '2025-08-15 16:12:07', '1');

--
-- Volcado de datos para la tabla `spsu_planes`
--

INSERT INTO `spsu_planes` (`pla_idPlan`, `pla_nombre`, `pla_descripcion`, `pla_precioBase`, `pla_moneda`, `pla_caracteris`, `pla_numCuentas`, `pla_diasHistorial`, `pla_diasTotales`, `pla_bloqueoDias`, `pla_puedeDescargar`, `pla_descargaTodos`, `pla_rangoLibre`, `pla_fechacrea`, `pla_fechacambio`, `pla_estado`) VALUES
(1, 'Libre', 'Plan gratuito con funcionalidades básicas', 0.00, 'USD', 'Solo visualización de resultados y gráficas de los últimos 10 días', 2, 10, 10, 10, 0, 0, 0, '2025-08-15', '2025-08-15 16:12:07', '1'),
(2, 'Básico', 'Plan básico con descarga y filtros limitados', 1.25, 'USD', 'Visualización y descarga de resultados con filtros de 15 días en bloques, hasta 45 días total', 3, 15, 45, 15, 1, 0, 0, '2025-08-15', '2025-08-15 16:12:07', '1'),
(3, 'Premium', 'Plan premium con mayor alcance temporal', 2.50, 'USD', 'Visualización y descarga de resultados con filtros de 30 días en bloques, hasta 90 días total', 5, 30, 90, 30, 1, 0, 0, '2025-08-15', '2025-08-15 16:12:07', '1'),
(4, 'Enterprise', 'Plan empresarial con acceso completo', 5.00, 'USD', 'Acceso completo con filtros libres, descarga total y cuentas ilimitadas', -1, 30, -1, 30, 1, 1, 1, '2025-08-15', '2025-08-15 16:12:07', '1');

--
-- Volcado de datos para la tabla `spsu_planintervalo`
--

INSERT INTO `spsu_planintervalo` (`pin_idPlanInterv`, `pin_plaIdPlan`, `pins_idInterSuscrip`, `pin_precioFinal`, `pin_estado`) VALUES
(1, 1, 1, 0.00, 'A'),
(2, 1, 2, 0.00, 'A'),
(3, 1, 3, 0.00, 'A'),
(4, 1, 4, 0.00, 'A'),
(5, 1, 5, 0.00, 'A'),
(6, 2, 1, 1.25, 'A'),
(7, 2, 2, 3.38, 'A'),
(8, 2, 3, 6.38, 'A'),
(9, 2, 4, 12.00, 'A'),
(10, 2, 5, 22.50, 'A'),
(11, 3, 1, 2.50, 'A'),
(12, 3, 2, 6.75, 'A'),
(13, 3, 3, 12.75, 'A'),
(14, 3, 4, 24.00, 'A'),
(15, 3, 5, 45.00, 'A'),
(16, 4, 1, 5.00, 'A'),
(17, 4, 2, 13.50, 'A'),
(18, 4, 3, 25.50, 'A'),
(19, 4, 4, 48.00, 'A'),
(20, 4, 5, 90.00, 'A');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
