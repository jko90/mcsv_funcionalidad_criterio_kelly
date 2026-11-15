<?php

declare(strict_types=1);

/**
 * Prueba con reloj simulado de la cancelación y el corte del plan de pago (HLT-18, casos X01 a X06).
 * Solo se ejecuta por línea de comandos: C:\xampp\php\php.exe anexos\pruebas\cancelacion_reloj.php
 * Crea usuarios, suscripciones y pagos fixture con el prefijo ck_prueba_hu4_ y los borra al terminar.
 * Imprime PASS Xnn o FAIL Xnn y termina con código 0 solo si todos pasan.
 */
if (PHP_SAPI !== 'cli') {
    exit;
}

$raizServicio = dirname(__DIR__, 2);
require_once $raizServicio . '/vendor/autoload.php';
require_once $raizServicio . '/configuracion/Configuracion.php';
Configuracion::cargar($raizServicio, 'rest_suscripcion');
require_once $raizServicio . '/configuracion/enlace.php';
require_once $raizServicio . '/configuracion/ClienteIp.php';
require_once $raizServicio . '/configuracion/RegistroAuditoria.php';
require_once $raizServicio . '/configuracion/LectorPlanVigente.php';
require_once $raizServicio . '/servicios/PlanVigenteSrv.php';
require_once $raizServicio . '/servicios/CancelacionPlanSrv.php';
require_once $raizServicio . '/servicios/PruebaGratuitaSrv.php';

const PREFIJO_FIXTURE = 'ck_prueba_hu4_';
const ZONAS_HORARIAS = ['Europe/Berlin', 'America/Guayaquil', 'Pacific/Kiritimati'];
const COMBINACION_MENSUAL = 2;

$enlace = new Enlace();

function consultar(string $sql, string $tipos = '', mixed ...$parametros): array
{
    global $enlace;
    $resultado = $enlace->ejecutarConsulta($sql, $tipos, ...$parametros);
    return $resultado ? $resultado->fetch_all(MYSQLI_ASSOC) : [];
}

function fila(string $sql, string $tipos = '', mixed ...$parametros): ?array
{
    return consultar($sql, $tipos, ...$parametros)[0] ?? null;
}

function relojEn(string $texto, string $zona): Closure
{
    $momento = (new DateTimeImmutable($texto, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone($zona));
    return function () use ($momento): DateTimeImmutable {
        return $momento;
    };
}

function planVigenteEn(int $idUsuario, string $texto, string $zona): array
{
    global $enlace;
    return (new PlanVigenteSrv($enlace, relojEn($texto, $zona)))->resolver($idUsuario);
}

function cancelarEn(int $idUsuario, string $texto, string $zona, ?int $idSuscripcion = null): string
{
    global $enlace;
    return (new CancelacionPlanSrv($enlace, relojEn($texto, $zona)))->cancelar($idUsuario, $idSuscripcion)['resultado'];
}

function sumarDias(string $fecha, int $dias): string
{
    return (new DateTimeImmutable($fecha, new DateTimeZone('UTC')))->modify(($dias >= 0 ? '+' : '') . $dias . ' day')->format('Y-m-d');
}

function limpiarFixtures(): int
{
    global $enlace;
    $patron = '^' . PREFIJO_FIXTURE;
    $idsUsuarios = 'SELECT usu_idUsuario FROM sgen_usuario WHERE usu_usuario REGEXP ?';
    $enlace->ejecutarActualizacion('DELETE FROM spsu_pagos WHERE pag_susIdSuscri IN
        (SELECT sis_idSuscrip FROM spsu_suscripcion WHERE sus_usuarioId IN (' . $idsUsuarios . '))', 's', $patron);
    $enlace->ejecutarActualizacion('DELETE FROM spsu_historialsuscri WHERE his_usuarioId IN (' . $idsUsuarios . ')', 's', $patron);
    $enlace->ejecutarActualizacion('DELETE FROM spsu_suscripcion WHERE sus_usuarioId IN (' . $idsUsuarios . ')', 's', $patron);
    $enlace->ejecutarActualizacion('DELETE FROM sgen_auditoria WHERE aud_usuId IN (' . $idsUsuarios . ')', 's', $patron);
    $personas = array_column(consultar('SELECT usu_perIdPerso FROM sgen_usuario WHERE usu_usuario REGEXP ?', 's', $patron), 'usu_perIdPerso');
    $enlace->ejecutarActualizacion('DELETE FROM sgen_usuario WHERE usu_usuario REGEXP ?', 's', $patron);
    foreach ($personas as $idPersona) {
        $enlace->ejecutarActualizacion('DELETE FROM sgen_persona WHERE per_idPersona = ?', 'i', (int) $idPersona);
    }
    return (int) fila('SELECT COUNT(*) AS total FROM sgen_usuario WHERE usu_usuario REGEXP ?', 's', $patron)['total'];
}

function nuevoUsuario(): int
{
    global $enlace;
    static $contador = 0;
    $contador++;
    $nombre = PREFIJO_FIXTURE . 'x' . getmypid() . '_' . $contador;
    $idPersona = $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO sgen_persona (per_apellidos, per_correo, per_fechaRegis) VALUES (?, ?, ?)',
        'sss',
        'Hu4',
        $nombre . '@example.com',
        '2026-01-01 00:00:00'
    );
    return $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO sgen_usuario (usu_perIdPerso, usu_usuario, usu_clave, usu_situacion, usu_estado)
         VALUES (?, ?, ?, \'A\', \'1\')',
        'iss',
        $idPersona,
        $nombre,
        'fixture-sin-clave'
    );
}

/** Plan de pago mensual activo con el corte indicado (inicio un mes antes). */
function nuevoPlanDePago(int $idUsuario, string $fechaFin, int $renovacion): int
{
    global $enlace;
    $inicio = (new DateTimeImmutable($fechaFin, new DateTimeZone('UTC')))->modify('-1 month')->format('Y-m-d');
    return $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion,
         sus_referenPago, sus_renovAutomatica, sus_proximoPago, sus_fechaCrea, sus_fechaCambio)
         VALUES (?, ?, ?, ?, \'A\', \'fixture\', ?, ?, ?, ?)',
        'iississs',
        $idUsuario,
        COMBINACION_MENSUAL,
        $inicio,
        $fechaFin,
        $renovacion,
        sumarDias($fechaFin, -1),
        $inicio,
        $inicio . ' 00:00:00'
    );
}

/** Periodo siguiente ya pagado: pendiente con pago confirmado. */
function nuevaProgramada(int $idUsuario, string $inicio, string $fin, int $renovacion): int
{
    global $enlace;
    $idSuscripcion = $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion,
         sus_referenPago, sus_renovAutomatica, sus_proximoPago, sus_fechaCrea, sus_fechaCambio)
         VALUES (?, ?, ?, ?, \'P\', \'fixture\', ?, ?, ?, ?)',
        'iississs',
        $idUsuario,
        COMBINACION_MENSUAL,
        $inicio,
        $fin,
        $renovacion,
        sumarDias($fin, -1),
        $inicio,
        $inicio . ' 00:00:00'
    );
    $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_pagos (pag_susIdSuscri, pag_monto, pag_montoConfirmado, pag_fechaPago, pag_metodoPago,
         pag_idTransac, pag_situacion, pag_pagoDesde, pag_pagoHasta)
         VALUES (?, 1.00, 1.000, ?, \'CRIPTOMONEDA\', ?, \'C\', ?, ?)',
        'issss',
        $idSuscripcion,
        $inicio . ' 10:00:00',
        PREFIJO_FIXTURE . 'txp' . $idSuscripcion,
        $inicio . ' 00:00:00',
        $fin . ' 00:00:00'
    );
    return $idSuscripcion;
}

function suscripcion(int $id): array
{
    return fila(
        'SELECT sis_idSuscrip, sus_fechainicio, sus_fechaFin, sus_situacion, sus_renovAutomatica, sus_proximoPago
         FROM spsu_suscripcion WHERE sis_idSuscrip = ?',
        'i',
        $id
    );
}

function suscripcionesDe(int $idUsuario, string $situacion): array
{
    return consultar(
        'SELECT sis_idSuscrip, sus_renovAutomatica FROM spsu_suscripcion WHERE sus_usuarioId = ? AND sus_situacion = ?
         ORDER BY sis_idSuscrip',
        'is',
        $idUsuario,
        $situacion
    );
}

function totalEventos(int $idUsuario, string $evento): int
{
    return (int) fila(
        'SELECT COUNT(*) AS total FROM sgen_auditoria WHERE aud_usuId = ? AND aud_evento = ?',
        'is',
        $idUsuario,
        $evento
    )['total'];
}

function totalHistorial(int $idUsuario, string $accion): int
{
    return (int) fila(
        'SELECT COUNT(*) AS total FROM spsu_historialsuscri WHERE his_usuarioId = ? AND his_accion = ?',
        'is',
        $idUsuario,
        $accion
    )['total'];
}

function huellaPagos(int $idUsuario): string
{
    return md5(json_encode(consultar(
        'SELECT pag.pag_idPago, pag.pag_monto, pag.pag_montoConfirmado, pag.pag_situacion, pag.pag_pagoDesde, pag.pag_pagoHasta
         FROM spsu_pagos pag INNER JOIN spsu_suscripcion sus ON sus.sis_idSuscrip = pag.pag_susIdSuscri
         WHERE sus.sus_usuarioId = ? ORDER BY pag.pag_idPago',
        'i',
        $idUsuario
    )));
}

$fallos = [];
$totalCasos = 0;

function caso(string $codigo, callable $cuerpo): void
{
    global $fallos, $totalCasos;
    $problemas = [];
    $verificar = function (bool $condicion, string $mensaje) use (&$problemas): void {
        if (!$condicion) {
            $problemas[] = $mensaje;
        }
    };
    try {
        $cuerpo($verificar);
    } catch (Throwable $error) {
        $problemas[] = 'excepción ' . get_class($error) . ': ' . $error->getMessage();
    }
    $totalCasos++;
    if ($problemas === []) {
        echo "PASS $codigo\n";
        return;
    }
    $fallos[] = $codigo;
    echo "FAIL $codigo: " . implode(' | ', $problemas) . "\n";
}

limpiarFixtures();

// X01: plan de pago con corte hoy sigue vigente hasta las 23:59:59 UTC, cancelado o no, en tres zonas.
caso('X01', function (callable $verificar): void {
    foreach (ZONAS_HORARIAS as $zona) {
        foreach ([0, 1] as $renovacion) {
            $idUsuario = nuevoUsuario();
            $id = nuevoPlanDePago($idUsuario, '2026-06-10', $renovacion);
            $plan = planVigenteEn($idUsuario, '2026-06-10 23:59:59', $zona);
            $verificar($plan['estado'] === 'PAGO' && $plan['idSuscripcion'] === $id, "$zona renov $renovacion: PAGO vigente (" . $plan['estado'] . ')');
            $verificar($plan['cancelado'] === ($renovacion === 0), "$zona renov $renovacion: cancelado");
            $verificar(suscripcion($id)['sus_situacion'] === 'A', "$zona renov $renovacion: sigue A");
        }
    }
});

// X02: corte sin cancelación: E, PLAN_CORTADO, CORTADA y una renovación P pendiente de pago.
caso('X02', function (callable $verificar): void {
    foreach (ZONAS_HORARIAS as $zona) {
        $idUsuario = nuevoUsuario();
        $id = nuevoPlanDePago($idUsuario, '2026-06-10', 1);
        $plan = planVigenteEn($idUsuario, '2026-06-11 00:00:00', $zona);
        $verificar(suscripcion($id)['sus_situacion'] === 'E', "$zona: E");
        $verificar($plan['estado'] === 'SIN_PLAN' && $plan['motivoSinPlan'] === 'PLAN_PAGO_VENCIDO', "$zona: SIN_PLAN/PLAN_PAGO_VENCIDO");
        $verificar(totalEventos($idUsuario, 'PLAN_CORTADO') === 1, "$zona: PLAN_CORTADO");
        $verificar(totalHistorial($idUsuario, 'CORTADA') === 1, "$zona: CORTADA");
        $pendientes = suscripcionesDe($idUsuario, 'P');
        $verificar(count($pendientes) === 1 && (int) $pendientes[0]['sus_renovAutomatica'] === 1, "$zona: una renovación P con renovación 1");
        $verificar(totalHistorial($idUsuario, 'renovacion') === 1 && totalEventos($idUsuario, 'PLAN_RENOVACION') === 1, "$zona: renovacion y PLAN_RENOVACION");
        $verificar($plan['planPendiente'] !== null, "$zona: planPendiente no nulo");
        $verificar(count(suscripcionesDe($idUsuario, 'A')) === 0, "$zona: sin prueba ni Libre");
    }
});

// X03: corte con cancelación previa: E sin renovación y planPendiente nulo.
caso('X03', function (callable $verificar): void {
    foreach (ZONAS_HORARIAS as $zona) {
        $idUsuario = nuevoUsuario();
        $id = nuevoPlanDePago($idUsuario, '2026-06-10', 1);
        $verificar(cancelarEn($idUsuario, '2026-06-05 12:00:00', $zona) === CancelacionPlanSrv::RESULTADO_OK, "$zona: cancelar OK");
        $plan = planVigenteEn($idUsuario, '2026-06-11 00:00:00', $zona);
        $verificar(suscripcion($id)['sus_situacion'] === 'E', "$zona: E");
        $verificar($plan['estado'] === 'SIN_PLAN' && $plan['planPendiente'] === null, "$zona: SIN_PLAN sin pendiente");
        $verificar(suscripcionesDe($idUsuario, 'P') === [], "$zona: ninguna renovación P");
        $verificar(totalEventos($idUsuario, 'PLAN_CORTADO') === 1 && totalEventos($idUsuario, 'PLAN_CANCELADO') === 1, "$zona: auditoría");
        $verificar(totalHistorial($idUsuario, 'CANCELACION') === 1, "$zona: CANCELACION");
    }
});

// X04: tras el corte no se crea prueba ni Libre y la prueba sigue rechazada.
caso('X04', function (callable $verificar): void {
    global $enlace;
    foreach ([0, 1] as $renovacion) {
        $idUsuario = nuevoUsuario();
        nuevoPlanDePago($idUsuario, '2026-06-10', $renovacion);
        $plan = planVigenteEn($idUsuario, '2026-06-11 00:00:00', 'UTC');
        $plan2 = planVigenteEn($idUsuario, '2026-06-12 00:00:00', 'UTC');
        $verificar($plan['estado'] === 'SIN_PLAN' && $plan2['estado'] === 'SIN_PLAN', "renov $renovacion: sigue sin plan");
        $verificar(count(suscripcionesDe($idUsuario, 'A')) === 0, "renov $renovacion: ni prueba ni Libre");
        $resultado = (new PruebaGratuitaSrv($enlace, relojEn('2026-06-12 00:00:00', 'UTC')))->conceder($idUsuario)['resultado'];
        $verificar($resultado === PruebaGratuitaSrv::RESULTADO_RECHAZADA, "renov $renovacion: iniciarPrueba rechazada ($resultado)");
    }
});

// X05: con la renovación P ya creada, cancelar responde sin plan de pago y la P no cambia.
caso('X05', function (callable $verificar): void {
    $idUsuario = nuevoUsuario();
    nuevoPlanDePago($idUsuario, '2026-06-10', 1);
    planVigenteEn($idUsuario, '2026-06-11 00:00:00', 'UTC');
    $antes = json_encode(suscripcionesDe($idUsuario, 'P'));
    $idRenovacion = (int) suscripcionesDe($idUsuario, 'P')[0]['sis_idSuscrip'];
    $antesFila = json_encode(suscripcion($idRenovacion));
    $verificar(cancelarEn($idUsuario, '2026-06-12 00:00:00', 'UTC') === CancelacionPlanSrv::RESULTADO_SIN_PLAN_DE_PAGO, 'sin plan de pago');
    $verificar(cancelarEn($idUsuario, '2026-06-12 00:00:00', 'UTC', $idRenovacion) === CancelacionPlanSrv::RESULTADO_SIN_PLAN_DE_PAGO, 'con id de la P: sin plan de pago');
    $verificar($antes === json_encode(suscripcionesDe($idUsuario, 'P')) && $antesFila === json_encode(suscripcion($idRenovacion)), 'la P no cambia');
    $verificar(totalEventos($idUsuario, 'PLAN_CANCELADO') === 0, 'sin PLAN_CANCELADO');
});

// X06: presente + programada pagada: cancelar deja ambas sin renovación; la programada se activa y termina sin renovar.
caso('X06', function (callable $verificar): void {
    foreach (ZONAS_HORARIAS as $zona) {
        $idUsuario = nuevoUsuario();
        $presente = nuevoPlanDePago($idUsuario, '2026-06-10', 1);
        $programada = nuevaProgramada($idUsuario, '2026-06-11', '2026-07-11', 1);
        $antesPagos = huellaPagos($idUsuario);
        $fechasAntes = [suscripcion($presente)['sus_fechaFin'], suscripcion($programada)['sus_fechainicio'], suscripcion($programada)['sus_fechaFin']];
        $verificar(cancelarEn($idUsuario, '2026-06-05 12:00:00', $zona) === CancelacionPlanSrv::RESULTADO_OK, "$zona: cancelar OK");
        $verificar((int) suscripcion($presente)['sus_renovAutomatica'] === 0 && (int) suscripcion($programada)['sus_renovAutomatica'] === 0, "$zona: ambas en 0");
        $verificar($antesPagos === huellaPagos($idUsuario), "$zona: pagos sin cambio");
        $verificar($fechasAntes === [suscripcion($presente)['sus_fechaFin'], suscripcion($programada)['sus_fechainicio'], suscripcion($programada)['sus_fechaFin']], "$zona: fechas sin cambio");
        $plan = planVigenteEn($idUsuario, '2026-06-06 00:00:00', $zona);
        $verificar($plan['cancelado'] === true && $plan['planProgramado'] !== null, "$zona: cancelado y planProgramado conservado");

        $plan = planVigenteEn($idUsuario, '2026-06-11 00:00:00', $zona);
        $verificar(suscripcion($presente)['sus_situacion'] === 'E' && suscripcion($programada)['sus_situacion'] === 'A', "$zona: presente E, programada A");
        $verificar($plan['estado'] === 'PAGO' && $plan['idSuscripcion'] === $programada, "$zona: vigente es la programada");
        $verificar(suscripcionesDe($idUsuario, 'P') === [], "$zona: sin renovación tras el primer corte");

        $plan = planVigenteEn($idUsuario, '2026-07-12 00:00:00', $zona);
        $verificar(suscripcion($programada)['sus_situacion'] === 'E' && $plan['estado'] === 'SIN_PLAN', "$zona: programada termina");
        $verificar(suscripcionesDe($idUsuario, 'P') === [] && $plan['planPendiente'] === null, "$zona: sin renovación al terminar");
    }
});

$restantes = limpiarFixtures();
echo 'FIXTURES restantes: ' . $restantes . "\n";
echo 'RESUMEN casos=' . $totalCasos . ' fallos=' . count($fallos) . "\n";
exit($fallos === [] && $restantes === 0 ? 0 : 1);
