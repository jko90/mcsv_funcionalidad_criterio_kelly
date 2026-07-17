-- phpMyAdmin SQL Dump - CRM Integrado con Sistema de Suscripciones
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 01-08-2025 a las 20:53:39
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
-- SISTEMA DE USUARIOS EXISTENTE (Referencia)
-- --------------------------------------------------------

-- Tablas existentes: sgen_persona, sgen_usuario, sgen_rol, sgen_rolusuario

-- --------------------------------------------------------
-- SISTEMA DE SUSCRIPCIONES EXISTENTE
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

--
-- Estructura de tabla para la tabla `spsu_pagos`
--

CREATE TABLE `spsu_pagos` (
`pag_idPago` int(11) NOT NULL,
`pag_susIdSuscri` int(11) NOT NULL,
`pag_monto` decimal(6,2) NOT NULL DEFAULT 0.00,
`pag_moneda` varchar(8) NOT NULL DEFAULT 'USD',
`pag_fechaPago` datetime NOT NULL,
`pag_metodoPago` varchar(64) DEFAULT NULL,
`pag_idTransac` varchar(256) NOT NULL DEFAULT '0',
`pag_situacion` char(1) DEFAULT NULL COMMENT '''pendiente'', ''completado'', ''fallido'', ''reembolsado''',
`pag_pagoDesde` datetime DEFAULT NULL,
`pag_pagoHasta` datetime DEFAULT NULL,
`pag_DatosAdicio` varchar(4096) DEFAULT NULL,
`pag_fechacrea` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
`pla_estado` char(1) DEFAULT NULL COMMENT '1 Activo\r\n0 Elimnado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `spsu_planintervalo`
--

CREATE TABLE `spsu_planintervalo` (
`pin_idPlanInterv` int(11) NOT NULL,
`pin_plaIdPlan` int(11) NOT NULL,
`pins_idInterSuscrip` int(11) NOT NULL,
`pin_precioFinal` decimal(6,2) NOT NULL DEFAULT 0.00,
`pin_estado` char(1) NOT NULL DEFAULT 'A'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `spsu_suscripcion`
--

CREATE TABLE `spsu_suscripcion` (
`sis_idSuscrip` int(11) NOT NULL,
`sus_usuarioId` int(11) NOT NULL,
`sus_pinIdPlanin` int(11) NOT NULL,
`sus_fechainicio` date NOT NULL,
`sus_fechaFin` date NOT NULL,
`sus_situacion` char(1) DEFAULT NULL COMMENT '''activa'', ''cancelada'', ''pausada'', ''expirada''',
`sus_metodoPago` varchar(64) DEFAULT NULL,
`sus_referenPago` varchar(254) DEFAULT NULL,
`sus_renovAutomatica` tinyint(1) NOT NULL DEFAULT 1,
`sus_proximoPago` date DEFAULT NULL,
`sus_fechaCrea` date NOT NULL,
`sus_fechaCambio` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- SISTEMA CRM INTEGRADO
-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `crm_perfil_cliente`
-- Extiende información CRM para personas existentes
--

CREATE TABLE `crm_perfil_cliente` (
  `cpc_idPerfil` int(11) NOT NULL,
  `cpc_personaId` int(11) NOT NULL COMMENT 'Referencia a sgen_persona',
  `cpc_tipoCliente` varchar(32) DEFAULT 'prospecto' COMMENT 'prospecto, cliente_activo, cliente_inactivo, ex_cliente',
  `cpc_empresa` varchar(256) DEFAULT NULL,
  `cpc_cargo` varchar(128) DEFAULT NULL,
  `cpc_industry` varchar(128) DEFAULT NULL COMMENT 'Industria o sector',
  `cpc_tamanioEmpresa` varchar(32) DEFAULT NULL COMMENT 'pequena, mediana, grande, enterprise',
  `cpc_fuenteCaptura` varchar(64) DEFAULT NULL COMMENT 'web, referido, publicidad, evento, llamada_fria',
  `cpc_valorEstimado` decimal(10,2) DEFAULT 0.00 COMMENT 'Valor potencial del cliente',
  `cpc_nivelInteres` int(1) DEFAULT 1 COMMENT '1=Bajo, 2=Medio, 3=Alto, 4=Muy Alto, 5=Inmediato',
  `cpc_fechaUltimaInteraccion` datetime DEFAULT NULL,
  `cpc_proximaAccion` varchar(256) DEFAULT NULL,
  `cpc_fechaProximaAccion` datetime DEFAULT NULL,
  `cpc_observaciones` text DEFAULT NULL,
  `cpc_puntuacionLead` int(3) DEFAULT 0 COMMENT 'Lead scoring 0-100',
  `cpc_preferenciasContacto` varchar(64) DEFAULT 'email' COMMENT 'email, telefono, whatsapp, mixto',
  `cpc_horarioPreferido` varchar(64) DEFAULT NULL COMMENT 'manana, tarde, noche, fin_semana',
  `cpc_fechaRegistroCRM` datetime NOT NULL DEFAULT current_timestamp(),
  `cpc_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cpc_estado` char(1) DEFAULT '1' COMMENT '1=Activo, 0=Inactivo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_leads`
-- Para prospectos que aún no son usuarios del sistema
--

CREATE TABLE `crm_leads` (
  `lea_idLead` int(11) NOT NULL,
  `lea_nombres` varchar(64) NOT NULL,
  `lea_apellidos` varchar(64) DEFAULT NULL,
  `lea_email` varchar(256) NOT NULL,
  `lea_telefono` varchar(32) DEFAULT NULL,
  `lea_empresa` varchar(256) DEFAULT NULL,
  `lea_cargo` varchar(128) DEFAULT NULL,
  `lea_personaId` int(11) DEFAULT NULL COMMENT 'Se llena cuando se convierte en persona/usuario',
  `lea_vendedorId` int(11) DEFAULT NULL COMMENT 'Referencia a sgen_usuario (vendedor)',
  `lea_estado` varchar(32) DEFAULT 'nuevo' COMMENT 'nuevo, contactado, calificado, oportunidad, convertido, descartado',
  `lea_prioridad` int(1) DEFAULT 2 COMMENT '1=Baja, 2=Media, 3=Alta, 4=Urgente',
  `lea_fuenteOrigen` varchar(64) DEFAULT NULL,
  `lea_campaniaId` int(11) DEFAULT NULL,
  `lea_puntuacion` int(3) DEFAULT 0 COMMENT 'Lead scoring 0-100',
  `lea_presupuestoEstimado` decimal(10,2) DEFAULT 0.00,
  `lea_fechaCierreEstimada` date DEFAULT NULL,
  `lea_probabilidad` int(3) DEFAULT 10 COMMENT 'Probabilidad de conversión 0-100%',
  `lea_motivoRechazo` varchar(512) DEFAULT NULL,
  `lea_notas` text DEFAULT NULL,
  `lea_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `lea_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `lea_fechaConversion` datetime DEFAULT NULL,
  `lea_estado_crm` char(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_oportunidades`
--

CREATE TABLE `crm_oportunidades` (
  `opr_idOportunidad` int(11) NOT NULL,
  `opr_leadId` int(11) DEFAULT NULL COMMENT 'Referencia opcional a lead',
  `opr_personaId` int(11) DEFAULT NULL COMMENT 'Referencia a sgen_persona',
  `opr_vendedorId` int(11) DEFAULT NULL COMMENT 'Referencia a sgen_usuario (vendedor)',
  `opr_nombre` varchar(256) NOT NULL,
  `opr_descripcion` text DEFAULT NULL,
  `opr_etapa` varchar(32) DEFAULT 'prospecto' COMMENT 'prospecto, calificacion, propuesta, negociacion, cierre, ganado, perdido',
  `opr_valor` decimal(10,2) NOT NULL DEFAULT 0.00,
  `opr_moneda` varchar(8) DEFAULT 'USD',
  `opr_probabilidad` int(3) DEFAULT 10,
  `opr_fechaCierreEstimada` date DEFAULT NULL,
  `opr_fechaCierreReal` date DEFAULT NULL,
  `opr_planIntervaloId` int(11) DEFAULT NULL COMMENT 'Plan y intervalo propuesto - Referencia a spsu_planintervalo',
  `opr_suscripcionGenerada` int(11) DEFAULT NULL COMMENT 'ID de suscripción creada al ganar',
  `opr_motivoPerdida` varchar(512) DEFAULT NULL,
  `opr_competidor` varchar(256) DEFAULT NULL,
  `opr_proximaAccion` varchar(256) DEFAULT NULL,
  `opr_fechaProximaAccion` datetime DEFAULT NULL,
  `opr_notas` text DEFAULT NULL,
  `opr_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `opr_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `opr_estado` char(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_actividades`
--

CREATE TABLE `crm_actividades` (
  `act_idActividad` int(11) NOT NULL,
  `act_tipo` varchar(32) NOT NULL COMMENT 'llamada, email, reunion, tarea, nota, whatsapp, sms',
  `act_personaId` int(11) DEFAULT NULL COMMENT 'Referencia a sgen_persona',
  `act_leadId` int(11) DEFAULT NULL COMMENT 'Referencia a crm_leads',
  `act_oportunidadId` int(11) DEFAULT NULL COMMENT 'Referencia a crm_oportunidades',
  `act_suscripcionId` int(11) DEFAULT NULL COMMENT 'Referencia a spsu_suscripcion',
  `act_usuarioId` int(11) NOT NULL COMMENT 'Usuario que realiza la actividad - sgen_usuario',
  `act_asunto` varchar(256) NOT NULL,
  `act_descripcion` text DEFAULT NULL,
  `act_fechaProgramada` datetime DEFAULT NULL,
  `act_fechaRealizada` datetime DEFAULT NULL,
  `act_duracion` int(11) DEFAULT NULL COMMENT 'Duración en minutos',
  `act_estado` varchar(16) DEFAULT 'pendiente' COMMENT 'pendiente, realizada, cancelada',
  `act_resultado` varchar(32) DEFAULT NULL COMMENT 'exitoso, sin_respuesta, reagendar, no_interesado, interesado',
  `act_prioridad` int(1) DEFAULT 2,
  `act_recordatorio` datetime DEFAULT NULL,
  `act_ubicacion` varchar(256) DEFAULT NULL,
  `act_participantes` text DEFAULT NULL COMMENT 'JSON con lista de participantes',
  `act_adjuntos` text DEFAULT NULL COMMENT 'JSON con rutas de archivos',
  `act_notas` text DEFAULT NULL,
  `act_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `act_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_comunicaciones`
--

CREATE TABLE `crm_comunicaciones` (
  `com_idComunicacion` int(11) NOT NULL,
  `com_tipo` varchar(16) NOT NULL COMMENT 'email, sms, whatsapp, llamada',
  `com_personaId` int(11) DEFAULT NULL COMMENT 'Referencia a sgen_persona',
  `com_leadId` int(11) DEFAULT NULL COMMENT 'Referencia a crm_leads',
  `com_actividadId` int(11) DEFAULT NULL,
  `com_campaniaId` int(11) DEFAULT NULL,
  `com_asunto` varchar(256) DEFAULT NULL,
  `com_contenido` text DEFAULT NULL,
  `com_destinatario` varchar(256) NOT NULL COMMENT 'Email, teléfono, etc.',
  `com_adjuntos` text DEFAULT NULL COMMENT 'JSON con rutas de archivos',
  `com_direccion` varchar(8) DEFAULT 'saliente' COMMENT 'entrante, saliente',
  `com_estado` varchar(16) DEFAULT 'enviado' COMMENT 'borrador, enviado, entregado, leido, fallido',
  `com_fechaEnvio` datetime DEFAULT NULL,
  `com_fechaEntrega` datetime DEFAULT NULL,
  `com_fechaLectura` datetime DEFAULT NULL,
  `com_fechaRespuesta` datetime DEFAULT NULL,
  `com_usuarioId` int(11) DEFAULT NULL COMMENT 'Usuario que envía - sgen_usuario',
  `com_metadatos` text DEFAULT NULL COMMENT 'JSON con metadata del proveedor',
  `com_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_tickets`
--

CREATE TABLE `crm_tickets` (
  `tic_idTicket` int(11) NOT NULL,
  `tic_numero` varchar(32) NOT NULL,
  `tic_personaId` int(11) NOT NULL COMMENT 'Cliente - sgen_persona',
  `tic_usuarioId` int(11) DEFAULT NULL COMMENT 'Usuario del sistema - sgen_usuario',
  `tic_suscripcionId` int(11) DEFAULT NULL COMMENT 'Suscripción relacionada',
  `tic_tipo` varchar(32) DEFAULT 'soporte' COMMENT 'soporte, tecnico, comercial, reclamo, sugerencia, cancelacion',
  `tic_prioridad` varchar(16) DEFAULT 'media' COMMENT 'baja, media, alta, critica',
  `tic_estado` varchar(16) DEFAULT 'abierto' COMMENT 'abierto, en_proceso, esperando_cliente, resuelto, cerrado',
  `tic_asunto` varchar(256) NOT NULL,
  `tic_descripcion` text NOT NULL,
  `tic_categoria` varchar(64) DEFAULT NULL,
  `tic_subcategoria` varchar(64) DEFAULT NULL,
  `tic_asignadoA` int(11) DEFAULT NULL COMMENT 'Agente asignado - sgen_usuario',
  `tic_fechaVencimiento` datetime DEFAULT NULL,
  `tic_tiempoRespuesta` int(11) DEFAULT NULL COMMENT 'Minutos para primera respuesta',
  `tic_tiempoResolucion` int(11) DEFAULT NULL COMMENT 'Minutos para resolución',
  `tic_satisfaccion` int(1) DEFAULT NULL COMMENT '1-5 estrellas',
  `tic_comentarioSatisfaccion` text DEFAULT NULL,
  `tic_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `tic_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `tic_fechaCierre` datetime DEFAULT NULL,
  `tic_creadoPor` int(11) DEFAULT NULL COMMENT 'Usuario que creó el ticket'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_ticket_respuestas`
--

CREATE TABLE `crm_ticket_respuestas` (
  `tre_idRespuesta` int(11) NOT NULL,
  `tre_ticketId` int(11) NOT NULL,
  `tre_usuarioId` int(11) NOT NULL COMMENT 'Usuario que responde - sgen_usuario',
  `tre_tipo` varchar(16) DEFAULT 'respuesta' COMMENT 'respuesta, nota_interna, solucion, escalacion',
  `tre_contenido` text NOT NULL,
  `tre_adjuntos` text DEFAULT NULL COMMENT 'JSON con archivos adjuntos',
  `tre_esPublica` tinyint(1) DEFAULT 1 COMMENT '1=Visible al cliente, 0=Nota interna',
  `tre_tiempoTrabajo` int(11) DEFAULT NULL COMMENT 'Minutos invertidos',
  `tre_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_campanias`
--

CREATE TABLE `crm_campanias` (
  `cam_idCampania` int(11) NOT NULL,
  `cam_nombre` varchar(128) NOT NULL,
  `cam_descripcion` text DEFAULT NULL,
  `cam_tipo` varchar(32) DEFAULT 'email' COMMENT 'email, sms, whatsapp, social, publicidad, evento',
  `cam_estado` varchar(16) DEFAULT 'borrador' COMMENT 'borrador, activa, pausada, completada, cancelada',
  `cam_fechaInicio` datetime DEFAULT NULL,
  `cam_fechaFin` datetime DEFAULT NULL,
  `cam_presupuesto` decimal(10,2) DEFAULT 0.00,
  `cam_objetivo` varchar(64) DEFAULT NULL COMMENT 'leads, ventas, engagement, retencion, reactivacion',
  `cam_metricaObjetivo` int(11) DEFAULT NULL,
  `cam_audienciaObjetivo` text DEFAULT NULL COMMENT 'Descripción de la audiencia target',
  `cam_segmentacion` text DEFAULT NULL COMMENT 'JSON con criterios de segmentación',
  `cam_mensaje` text DEFAULT NULL,
  `cam_plantillaId` int(11) DEFAULT NULL,
  `cam_responsableId` int(11) DEFAULT NULL COMMENT 'Responsable - sgen_usuario',
  `cam_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `cam_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_campania_participantes`
--

CREATE TABLE `crm_campania_participantes` (
  `cap_idParticipante` int(11) NOT NULL,
  `cap_campaniaId` int(11) NOT NULL,
  `cap_personaId` int(11) DEFAULT NULL COMMENT 'sgen_persona',
  `cap_leadId` int(11) DEFAULT NULL COMMENT 'crm_leads',
  `cap_estado` varchar(16) DEFAULT 'pendiente' COMMENT 'pendiente, enviado, entregado, abierto, clicked, respondido, rebote, cancelado',
  `cap_fechaEnvio` datetime DEFAULT NULL,
  `cap_fechaApertura` datetime DEFAULT NULL,
  `cap_fechaClick` datetime DEFAULT NULL,
  `cap_fechaRespuesta` datetime DEFAULT NULL,
  `cap_leadGenerado` tinyint(1) DEFAULT 0,
  `cap_oportunidadGenerada` int(11) DEFAULT NULL COMMENT 'ID de oportunidad generada',
  `cap_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_vendedores`
--

CREATE TABLE `crm_vendedores` (
  `ven_idVendedor` int(11) NOT NULL,
  `ven_usuarioId` int(11) NOT NULL COMMENT 'Referencia a sgen_usuario',
  `ven_codigoVendedor` varchar(32) DEFAULT NULL,
  `ven_region` varchar(128) DEFAULT NULL,
  `ven_territorio` varchar(128) DEFAULT NULL,
  `ven_especialidad` varchar(128) DEFAULT NULL COMMENT 'pymes, enterprise, retail, etc',
  `ven_metaMensual` decimal(10,2) DEFAULT 0.00,
  `ven_metaTrimestral` decimal(10,2) DEFAULT 0.00,
  `ven_metaAnual` decimal(10,2) DEFAULT 0.00,
  `ven_comision` decimal(5,2) DEFAULT 0.00 COMMENT 'Porcentaje de comisión',
  `ven_fechaIngreso` date DEFAULT NULL,
  `ven_estado` char(1) DEFAULT '1',
  `ven_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `ven_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_metricas_vendedor`
--

CREATE TABLE `crm_metricas_vendedor` (
  `mev_idMetrica` int(11) NOT NULL,
  `mev_vendedorId` int(11) NOT NULL,
  `mev_periodo` varchar(16) NOT NULL COMMENT 'semanal, mensual, trimestral, anual',
  `mev_fechaPeriodo` date NOT NULL,
  `mev_leadsAsignados` int(11) DEFAULT 0,
  `mev_leadsContactados` int(11) DEFAULT 0,
  `mev_leadsConvertidos` int(11) DEFAULT 0,
  `mev_oportunidadesCreadas` int(11) DEFAULT 0,
  `mev_oportunidadesGanadas` int(11) DEFAULT 0,
  `mev_oportunidadesPerdidas` int(11) DEFAULT 0,
  `mev_ventasCerradas` int(11) DEFAULT 0,
  `mev_valorVendido` decimal(10,2) DEFAULT 0.00,
  `mev_comisionGanada` decimal(10,2) DEFAULT 0.00,
  `mev_tasaConversion` decimal(5,2) DEFAULT 0.00,
  `mev_tiempoMedioCierre` int(11) DEFAULT 0 COMMENT 'Días promedio para cerrar',
  `mev_actividadesRealizadas` int(11) DEFAULT 0,
  `mev_llamadasRealizadas` int(11) DEFAULT 0,
  `mev_emailsEnviados` int(11) DEFAULT 0,
  `mev_reunionesRealizadas` int(11) DEFAULT 0,
  `mev_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `mev_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_dashboards`
--

CREATE TABLE `crm_dashboards` (
  `das_idDashboard` int(11) NOT NULL,
  `das_nombre` varchar(128) NOT NULL,
  `das_descripcion` text DEFAULT NULL,
  `das_tipo` varchar(32) DEFAULT 'ventas' COMMENT 'ventas, marketing, soporte, ejecutivo, personal',
  `das_configuracion` text DEFAULT NULL COMMENT 'JSON con configuración de widgets',
  `das_usuarioId` int(11) DEFAULT NULL COMMENT 'Usuario propietario - sgen_usuario',
  `das_esPublico` tinyint(1) DEFAULT 0,
  `das_orden` int(3) DEFAULT 0,
  `das_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `das_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `das_estado` char(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Estructura de tabla para la tabla `crm_reportes`
--

CREATE TABLE `crm_reportes` (
  `rep_idReporte` int(11) NOT NULL,
  `rep_nombre` varchar(128) NOT NULL,
  `rep_descripcion` text DEFAULT NULL,
  `rep_tipo` varchar(32) DEFAULT 'ventas' COMMENT 'ventas, marketing, soporte, clientes, financiero, suscripciones',
  `rep_consulta` text DEFAULT NULL COMMENT 'Query SQL del reporte o configuración',
  `rep_parametros` text DEFAULT NULL COMMENT 'JSON con parámetros configurables',
  `rep_frecuencia` varchar(16) DEFAULT 'manual' COMMENT 'manual, diario, semanal, mensual',
  `rep_destinatarios` text DEFAULT NULL COMMENT 'JSON con emails para envío automático',
  `rep_ultimaEjecucion` datetime DEFAULT NULL,
  `rep_proximaEjecucion` datetime DEFAULT NULL,
  `rep_usuarioCreador` int(11) NOT NULL COMMENT 'sgen_usuario',
  `rep_esPublico` tinyint(1) DEFAULT 0,
  `rep_fechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `rep_fechaActualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `rep_estado` char(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- DATOS INICIALES DEL SISTEMA DE SUSCRIPCIONES
-- --------------------------------------------------------

--
-- Volcado de datos para la tabla `spsu_intervalosuscr`
--

INSERT INTO `spsu_intervalosuscr` (`ins_idInterSuscrip`, `ins_nombre`, `ins_numMeses`, `ins_x100descuen`, `ins_fecha`, `ins_estado`) VALUES
(1, 'Mensual', 1, 0.00, NOW(), '1'),
(2, 'Trimestral', 3, 10.00, NOW(), '1'),
(3, 'Semestral', 6, 15.00, NOW(), '1'),
(4, 'Anual', 12, 20.00, NOW(), '1'),
(5, 'Bianual', 24, 25.00, NOW(), '1');

--
-- Volcado de datos para la tabla `spsu_planes`
--

INSERT INTO `spsu_planes` (`pla_idPlan`, `pla_nombre`, `pla_descripcion`, `pla_precioBase`, `pla_moneda`, `pla_caracteris`, `pla_numCuentas`, `pla_diasHistorial`, `pla_diasTotales`, `pla_bloqueoDias`, `pla_puedeDescargar`, `pla_descargaTodos`, `pla_rangoLibre`, `pla_fechacrea`, `pla_fechacambio`, `pla_estado`) VALUES
(1, 'Libre', 'Plan gratuito con funcionalidades básicas', 0.00, 'USD', 'Solo visualización de resultados y gráficas de los últimos 10 días', 2, 10, 10, 10, 0, 0, 0, CURDATE(), NOW(), '1'),
(2, 'Básico', 'Plan básico con descarga y filtros limitados', 1.25, 'USD', 'Visualización y descarga de resultados con filtros de 15 días en bloques, hasta 45 días total', 3, 15, 45, 15, 1, 0, 0, CURDATE(), NOW(), '1'),
(3, 'Premium', 'Plan premium con mayor alcance temporal', 2.50, 'USD', 'Visualización y descarga de resultados con filtros de 30 días en bloques, hasta 90 días total', 5, 30, 90, 30, 1, 0, 0, CURDATE(), NOW(), '1'),
(4, 'Enterprise', 'Plan empresarial con acceso completo', 5.00, 'USD', 'Acceso completo con filtros libres, descarga total y cuentas ilimitadas', -1, 30, -1, 30, 1, 1, 1, CURDATE(), NOW(), '1');

--
-- Volcado de datos para la tabla `spsu_planintervalo`
--

INSERT INTO `spsu_planintervalo` (`pin_idPlanInterv`, `pin_plaIdPlan`, `pins_idInterSuscrip`, `pin_precioFinal`, `pin_estado`) VALUES
-- Plan Libre (Gratuito)
(1, 1, 1, 0.00, 'A'),
(2, 1, 2, 0.00, 'A'),
(3, 1, 3, 0.00, 'A'),
(4, 1, 4, 0.00, 'A'),
(5, 1, 5, 0.00, 'A'),
-- Plan Básico
(6, 2, 1, 1.25, 'A'),
(7, 2, 2, 3.38, 'A'),
(8, 2, 3, 6.38, 'A'),
(9, 2, 4, 12.00, 'A'),
(10, 2, 5, 22.50, 'A'),
-- Plan Premium
(11, 3, 1, 2.50, 'A'),
(12, 3, 2, 6.75, 'A'),
(13, 3, 3, 12.75, 'A'),
(14, 3, 4, 24.00, 'A'),
(15, 3, 5, 45.00, 'A'),
-- Plan Enterprise
(16, 4, 1, 5.00, 'A'),
(17, 4, 2, 13.50, 'A'),
(18, 4, 3, 25.50, 'A'),
(19, 4, 4, 48.00, 'A'),
(20, 4, 5, 90.00, 'A');

-- --------------------------------------------------------
-- ÍNDICES Y CLAVES PRIMARIAS
-- --------------------------------------------------------

--
-- Indices del sistema de suscripciones existente
--
ALTER TABLE `spsu_historialsuscri`
ADD PRIMARY KEY (`his_idHistorial`),
ADD KEY `spsu_suscripcion_spsu_historialsuscri_fk` (`his_sisIdSuscrip`);

ALTER TABLE `spsu_intervalosuscr`
ADD PRIMARY KEY (`ins_idInterSuscrip`);

ALTER TABLE `spsu_pagos`
ADD PRIMARY KEY (`pag_idPago`),
ADD KEY `spsu_suscripcion_spsu_pagos_fk` (`pag_susIdSuscri`);

ALTER TABLE `spsu_planes`
ADD PRIMARY KEY (`pla_idPlan`);

ALTER TABLE `spsu_planintervalo`
ADD PRIMARY KEY (`pin_idPlanInterv`),
ADD KEY `spsu_intervalosuscr_spsu_planintervalo_fk` (`pins_idInterSuscrip`),
ADD KEY `spsu_planes_spsu_planintervalo_fk` (`pin_plaIdPlan`);

ALTER TABLE `spsu_suscripcion`
ADD PRIMARY KEY (`sis_idSuscrip`),
ADD KEY `spsu_planintervalo_spsu_suscripcion_fk` (`sus_pinIdPlanin`),
ADD KEY `idx_sus_usuarioId` (`sus_usuarioId`);

--
-- Indices del sistema CRM
--
ALTER TABLE `crm_perfil_cliente`
  ADD PRIMARY KEY (`cpc_idPerfil`),
  ADD UNIQUE KEY `unique_persona_crm` (`cpc_personaId`),
  ADD KEY `idx_cpc_tipoCliente` (`cpc_tipoCliente`),
  ADD KEY `idx_cpc_fechaUltimaInteraccion` (`cpc_fechaUltimaInteraccion`),
  ADD KEY `idx_cpc_nivelInteres` (`cpc_nivelInteres`);

ALTER TABLE `crm_leads`
  ADD PRIMARY KEY (`lea_idLead`),
  ADD UNIQUE KEY `lea_email` (`lea_email`),
  ADD KEY `idx_lea_personaId` (`lea_personaId`),
  ADD KEY `idx_lea_vendedorId` (`lea_vendedorId`),
  ADD KEY `idx_lea_estado` (`lea_estado`),
  ADD KEY `idx_lea_fechaCreacion` (`lea_fechaCreacion`);

ALTER TABLE `crm_oportunidades`
  ADD PRIMARY KEY (`opr_idOportunidad`),
  ADD KEY `idx_opr_leadId` (`opr_leadId`),
  ADD KEY `idx_opr_personaId` (`opr_personaId`),
  ADD KEY `idx_opr_vendedorId` (`opr_vendedorId`),
  ADD KEY `idx_opr_etapa` (`opr_etapa`),
  ADD KEY `idx_opr_fechaCierreEstimada` (`opr_fechaCierreEstimada`),
  ADD KEY `idx_opr_planIntervaloId` (`opr_planIntervaloId`),
  ADD KEY `idx_opr_suscripcionGenerada` (`opr_suscripcionGenerada`);

ALTER TABLE `crm_actividades`
  ADD PRIMARY KEY (`act_idActividad`),
  ADD KEY `idx_act_personaId` (`act_personaId`),
  ADD KEY `idx_act_leadId` (`act_leadId`),
  ADD KEY `idx_act_oportunidadId` (`act_oportunidadId`),
  ADD KEY `idx_act_suscripcionId` (`act_suscripcionId`),
  ADD KEY `idx_act_usuarioId` (`act_usuarioId`),
  ADD KEY `idx_act_fechaProgramada` (`act_fechaProgramada`),
  ADD KEY `idx_act_estado` (`act_estado`),
  ADD KEY `idx_act_tipo` (`act_tipo`);

ALTER TABLE `crm_comunicaciones`
  ADD PRIMARY KEY (`com_idComunicacion`),
  ADD KEY `idx_com_personaId` (`com_personaId`),
  ADD KEY `idx_com_leadId` (`com_leadId`),
  ADD KEY `idx_com_actividadId` (`com_actividadId`),
  ADD KEY `idx_com_campaniaId` (`com_campaniaId`),
  ADD KEY `idx_com_fechaEnvio` (`com_fechaEnvio`),
  ADD KEY `idx_com_tipo` (`com_tipo`);

ALTER TABLE `crm_tickets`
  ADD PRIMARY KEY (`tic_idTicket`),
  ADD UNIQUE KEY `tic_numero` (`tic_numero`),
  ADD KEY `idx_tic_personaId` (`tic_personaId`),
  ADD KEY `idx_tic_usuarioId` (`tic_usuarioId`),
  ADD KEY `idx_tic_suscripcionId` (`tic_suscripcionId`),
  ADD KEY `idx_tic_estado` (`tic_estado`),
  ADD KEY `idx_tic_asignadoA` (`tic_asignadoA`),
  ADD KEY `idx_tic_fechaVencimiento` (`tic_fechaVencimiento`),
  ADD KEY `idx_tic_tipo` (`tic_tipo`);

ALTER TABLE `crm_ticket_respuestas`
  ADD PRIMARY KEY (`tre_idRespuesta`),
  ADD KEY `idx_tre_ticketId` (`tre_ticketId`),
  ADD KEY `idx_tre_usuarioId` (`tre_usuarioId`);

ALTER TABLE `crm_campanias`
  ADD PRIMARY KEY (`cam_idCampania`),
  ADD KEY `idx_cam_estado` (`cam_estado`),
  ADD KEY `idx_cam_fechaInicio` (`cam_fechaInicio`),
  ADD KEY `idx_cam_responsableId` (`cam_responsableId`),
  ADD KEY `idx_cam_tipo` (`cam_tipo`);

ALTER TABLE `crm_campania_participantes`
  ADD PRIMARY KEY (`cap_idParticipante`),
  ADD KEY `idx_cap_campaniaId` (`cap_campaniaId`),
  ADD KEY `idx_cap_personaId` (`cap_personaId`),
  ADD KEY `idx_cap_leadId` (`cap_leadId`),
  ADD KEY `idx_cap_estado` (`cap_estado`);

ALTER TABLE `crm_vendedores`
  ADD PRIMARY KEY (`ven_idVendedor`),
  ADD UNIQUE KEY `ven_usuarioId` (`ven_usuarioId`),
  ADD KEY `idx_ven_estado` (`ven_estado`);

ALTER TABLE `crm_metricas_vendedor`
  ADD PRIMARY KEY (`mev_idMetrica`),
  ADD UNIQUE KEY `unique_vendedor_periodo` (`mev_vendedorId`,`mev_periodo`,`mev_fechaPeriodo`);

ALTER TABLE `crm_dashboards`
  ADD PRIMARY KEY (`das_idDashboard`),
  ADD KEY `idx_das_usuarioId` (`das_usuarioId`),
  ADD KEY `idx_das_tipo` (`das_tipo`);

ALTER TABLE `crm_reportes`
  ADD PRIMARY KEY (`rep_idReporte`),
  ADD KEY `idx_rep_tipo` (`rep_tipo`),
  ADD KEY `idx_rep_usuarioCreador` (`rep_usuarioCreador`);

-- --------------------------------------------------------
-- AUTO_INCREMENT
-- --------------------------------------------------------

--
-- AUTO_INCREMENT del sistema de suscripciones
--
ALTER TABLE `spsu_historialsuscri`
MODIFY `his_idHistorial` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `spsu_intervalosuscr`
MODIFY `ins_idInterSuscrip` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

ALTER TABLE `spsu_pagos`
MODIFY `pag_idPago` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `spsu_planes`
MODIFY `pla_idPlan` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

ALTER TABLE `spsu_planintervalo`
MODIFY `pin_idPlanInterv` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

ALTER TABLE `spsu_suscripcion`
MODIFY `sis_idSuscrip` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT del sistema CRM
--
ALTER TABLE `crm_perfil_cliente`
  MODIFY `cpc_idPerfil` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_leads`
  MODIFY `lea_idLead` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_oportunidades`
  MODIFY `opr_idOportunidad` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_actividades`
  MODIFY `act_idActividad` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_comunicaciones`
  MODIFY `com_idComunicacion` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_tickets`
  MODIFY `tic_idTicket` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_ticket_respuestas`
  MODIFY `tre_idRespuesta` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_campanias`
  MODIFY `cam_idCampania` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_campania_participantes`
  MODIFY `cap_idParticipante` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_vendedores`
  MODIFY `ven_idVendedor` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_metricas_vendedor`
  MODIFY `mev_idMetrica` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_dashboards`
  MODIFY `das_idDashboard` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `crm_reportes`
  MODIFY `rep_idReporte` int(11) NOT NULL AUTO_INCREMENT;

-- --------------------------------------------------------
-- FOREIGN KEYS Y RESTRICCIONES
-- --------------------------------------------------------

--
-- Restricciones del sistema de suscripciones existente
--
ALTER TABLE `spsu_historialsuscri`
ADD CONSTRAINT `spsu_suscripcion_spsu_historialsuscri_fk` FOREIGN KEY (`his_sisIdSuscrip`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE `spsu_pagos`
ADD CONSTRAINT `spsu_suscripcion_spsu_pagos_fk` FOREIGN KEY (`pag_susIdSuscri`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE `spsu_planintervalo`
ADD CONSTRAINT `spsu_intervalosuscr_spsu_planintervalo_fk` FOREIGN KEY (`pins_idInterSuscrip`) REFERENCES `spsu_intervalosuscr` (`ins_idInterSuscrip`) ON DELETE NO ACTION ON UPDATE NO ACTION,
ADD CONSTRAINT `spsu_planes_spsu_planintervalo_fk` FOREIGN KEY (`pin_plaIdPlan`) REFERENCES `spsu_planes` (`pla_idPlan`) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE `spsu_suscripcion`
ADD CONSTRAINT `spsu_planintervalo_spsu_suscripcion_fk` FOREIGN KEY (`sus_pinIdPlanin`) REFERENCES `spsu_planintervalo` (`pin_idPlanInterv`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Restricciones del sistema CRM integrado
--
ALTER TABLE `crm_perfil_cliente`
  ADD CONSTRAINT `crm_perfil_cliente_persona_fk` FOREIGN KEY (`cpc_personaId`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE CASCADE;

ALTER TABLE `crm_leads`
  ADD CONSTRAINT `crm_leads_persona_fk` FOREIGN KEY (`lea_personaId`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_leads_vendedor_fk` FOREIGN KEY (`lea_vendedorId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL;

ALTER TABLE `crm_oportunidades`
  ADD CONSTRAINT `crm_oportunidades_lead_fk` FOREIGN KEY (`opr_leadId`) REFERENCES `crm_leads` (`lea_idLead`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_oportunidades_persona_fk` FOREIGN KEY (`opr_personaId`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_oportunidades_vendedor_fk` FOREIGN KEY (`opr_vendedorId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_oportunidades_planintervalo_fk` FOREIGN KEY (`opr_planIntervaloId`) REFERENCES `spsu_planintervalo` (`pin_idPlanInterv`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_oportunidades_suscripcion_fk` FOREIGN KEY (`opr_suscripcionGenerada`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE SET NULL;

ALTER TABLE `crm_actividades`
  ADD CONSTRAINT `crm_actividades_persona_fk` FOREIGN KEY (`act_personaId`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_actividades_lead_fk` FOREIGN KEY (`act_leadId`) REFERENCES `crm_leads` (`lea_idLead`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_actividades_oportunidad_fk` FOREIGN KEY (`act_oportunidadId`) REFERENCES `crm_oportunidades` (`opr_idOportunidad`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_actividades_suscripcion_fk` FOREIGN KEY (`act_suscripcionId`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_actividades_usuario_fk` FOREIGN KEY (`act_usuarioId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE CASCADE;

ALTER TABLE `crm_comunicaciones`
  ADD CONSTRAINT `crm_comunicaciones_persona_fk` FOREIGN KEY (`com_personaId`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_comunicaciones_lead_fk` FOREIGN KEY (`com_leadId`) REFERENCES `crm_leads` (`lea_idLead`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_comunicaciones_actividad_fk` FOREIGN KEY (`com_actividadId`) REFERENCES `crm_actividades` (`act_idActividad`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_comunicaciones_campania_fk` FOREIGN KEY (`com_campaniaId`) REFERENCES `crm_campanias` (`cam_idCampania`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_comunicaciones_usuario_fk` FOREIGN KEY (`com_usuarioId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL;

ALTER TABLE `crm_tickets`
  ADD CONSTRAINT `crm_tickets_persona_fk` FOREIGN KEY (`tic_personaId`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_tickets_usuario_fk` FOREIGN KEY (`tic_usuarioId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_tickets_suscripcion_fk` FOREIGN KEY (`tic_suscripcionId`) REFERENCES `spsu_suscripcion` (`sis_idSuscrip`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_tickets_asignado_fk` FOREIGN KEY (`tic_asignadoA`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL,
  ADD CONSTRAINT `crm_tickets_creador_fk` FOREIGN KEY (`tic_creadoPor`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL;

ALTER TABLE `crm_ticket_respuestas`
  ADD CONSTRAINT `crm_ticket_respuestas_ticket_fk` FOREIGN KEY (`tre_ticketId`) REFERENCES `crm_tickets` (`tic_idTicket`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_ticket_respuestas_usuario_fk` FOREIGN KEY (`tre_usuarioId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE CASCADE;

ALTER TABLE `crm_campanias`
  ADD CONSTRAINT `crm_campanias_responsable_fk` FOREIGN KEY (`cam_responsableId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL;

ALTER TABLE `crm_campania_participantes`
  ADD CONSTRAINT `crm_campania_participantes_campania_fk` FOREIGN KEY (`cap_campaniaId`) REFERENCES `crm_campanias` (`cam_idCampania`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_campania_participantes_persona_fk` FOREIGN KEY (`cap_personaId`) REFERENCES `sgen_persona` (`per_idPersona`) ON DELETE CASCADE,
  ADD CONSTRAINT `crm_campania_participantes_lead_fk` FOREIGN KEY (`cap_leadId`) REFERENCES `crm_leads` (`lea_idLead`) ON DELETE CASCADE;

ALTER TABLE `crm_vendedores`
  ADD CONSTRAINT `crm_vendedores_usuario_fk` FOREIGN KEY (`ven_usuarioId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE CASCADE;

ALTER TABLE `crm_metricas_vendedor`
  ADD CONSTRAINT `crm_metricas_vendedor_fk` FOREIGN KEY (`mev_vendedorId`) REFERENCES `crm_vendedores` (`ven_idVendedor`) ON DELETE CASCADE;

ALTER TABLE `crm_dashboards`
  ADD CONSTRAINT `crm_dashboards_usuario_fk` FOREIGN KEY (`das_usuarioId`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE SET NULL;

ALTER TABLE `crm_reportes`
  ADD CONSTRAINT `crm_reportes_usuario_fk` FOREIGN KEY (`rep_usuarioCreador`) REFERENCES `sgen_usuario` (`usu_idUsuario`) ON DELETE CASCADE;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;