<?php

declare(strict_types=1);

/**
 * Prueba con reloj simulado de LectorPlanVigente y PlanVigenteSrv (HLT-16-v4, casos R01 a R32).
 * Solo se ejecuta por línea de comandos: C:\xampp\php\php.exe anexos\pruebas\plan_vigente_reloj.php
 * Crea usuarios y suscripciones fixture con el prefijo ck_prueba_hu4_ y los borra al terminar.
 * Imprime PASS Rnn o FAIL Rnn y termina con código 0 solo si todos pasan.
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
require_once $raizServicio . '/modelos/PlanesMdl.php';
require_once $raizServicio . '/modelos/SuscripcionMdl.php';
require_once $raizServicio . '/servicios/PlanVigenteSrv.php';
require_once $raizServicio . '/servicios/PruebaGratuitaSrv.php';

const PREFIJO_FIXTURE = 'ck_prueba_hu4_';
const INSTANTE_BASE = '2026-06-01 12:00:00';
const ZONAS_HORARIAS = ['Europe/Berlin', 'America/Guayaquil', 'Pacific/Kiritimati'];
const PROCESOS_PARALELOS = 5;
const SEGUNDOS_ARRANQUE_PARALELO = 1.5;

$enlace = new Enlace();

function consultar(string $sql, string $tipos = '', mixed ...$parametros): array
{
    global $enlace;
    $resultado = $enlace->ejecutarConsulta($sql, $tipos, ...$parametros);
    return $resultado ? $resultado->fetch_all(MYSQLI_ASSOC) : [];
}

function escalar(string $sql, string $tipos = '', mixed ...$parametros): mixed
{
    $filas = consultar($sql, $tipos, ...$parametros);
    return $filas === [] ? null : array_values($filas[0])[0];
}

function instante(string $texto): DateTimeImmutable
{
    return new DateTimeImmutable($texto, new DateTimeZone('UTC'));
}

function servicioEn(string $texto): PlanVigenteSrv
{
    global $enlace;
    $momento = instante($texto);
    return new PlanVigenteSrv($enlace, function () use ($momento): DateTimeImmutable {
        return $momento;
    });
}

function lectorEn(string $texto): LectorPlanVigente
{
    global $enlace;
    $momento = instante($texto);
    return new LectorPlanVigente($enlace, function () use ($momento): DateTimeImmutable {
        return $momento;
    });
}

function limpiarFixtures(): void
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
}

function nuevoUsuario(string $fechaRegistro = '2026-01-01 00:00:00'): int
{
    global $enlace;
    static $contador = 0;
    $contador++;
    $nombre = PREFIJO_FIXTURE . 'r' . getmypid() . '_' . $contador;
    $idPersona = $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO sgen_persona (per_apellidos, per_correo, per_fechaRegis) VALUES (?, ?, ?)',
        'sss',
        'Hu4',
        $nombre . '@example.com',
        $fechaRegistro
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

function nuevaSuscripcion(
    int $idUsuario,
    int $combinacion,
    string $situacion,
    string $inicio,
    string $fin,
    ?string $horaFin = null,
    int $renovacion = 0
): int {
    global $enlace;
    return $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin,
         sus_fechaHoraFin, sus_situacion, sus_renovAutomatica, sus_fechaCrea, sus_fechaCambio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'iissssiss',
        $idUsuario,
        $combinacion,
        $inicio,
        $fin,
        $horaFin,
        $situacion,
        $renovacion,
        $inicio,
        INSTANTE_BASE
    );
}

function nuevoPago(int $idSuscripcion, string $situacion): int
{
    global $enlace;
    static $contador = 0;
    $contador++;
    return $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_pagos (pag_susIdSuscri, pag_monto, pag_fechaPago, pag_idTransac, pag_situacion)
         VALUES (?, 1.25, ?, ?, ?)',
        'isss',
        $idSuscripcion,
        INSTANTE_BASE,
        PREFIJO_FIXTURE . 'tx' . getmypid() . '_' . $contador,
        $situacion
    );
}

function marcarRenovacion(int $idSuscripcion, int $idUsuario): void
{
    global $enlace;
    $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_historialsuscri (his_usuarioId, his_sisIdSuscrip, his_accion, his_detalle, his_fechaCambio, his_direcionIP)
         VALUES (?, ?, \'renovacion\', \'fixture\', ?, \'0.0.0.0\')',
        'iis',
        $idUsuario,
        $idSuscripcion,
        INSTANTE_BASE
    );
}

function suscripcionesDe(int $idUsuario, ?string $situacion = null): array
{
    $sql = 'SELECT sis_idSuscrip, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaHoraFin,
        sus_situacion, sus_renovAutomatica, sus_referenPago, sus_proximoPago
        FROM spsu_suscripcion WHERE sus_usuarioId = ?';
    if ($situacion === null) {
        return consultar($sql . ' ORDER BY sis_idSuscrip', 'i', $idUsuario);
    }
    return consultar($sql . ' AND sus_situacion = ? ORDER BY sis_idSuscrip', 'is', $idUsuario, $situacion);
}

function accionesDeHistorial(int $idUsuario, string $accion): array
{
    return consultar(
        'SELECT his_sisIdSuscrip, his_detalle FROM spsu_historialsuscri WHERE his_usuarioId = ? AND his_accion = ?
         ORDER BY his_idHistorial',
        'is',
        $idUsuario,
        $accion
    );
}

function contarEventos(int $idUsuario, string $evento): int
{
    return (int) escalar(
        'SELECT COUNT(*) FROM sgen_auditoria WHERE aud_usuId = ? AND aud_evento = ?',
        'is',
        $idUsuario,
        $evento
    );
}

function contarPagosDe(int $idUsuario): int
{
    return (int) escalar(
        'SELECT COUNT(*) FROM spsu_pagos WHERE pag_susIdSuscri IN
         (SELECT sis_idSuscrip FROM spsu_suscripcion WHERE sus_usuarioId = ?)',
        'i',
        $idUsuario
    );
}

function contarInterbloqueos(): int
{
    $ruta = dirname(__DIR__, 2) . '/logs/php_errores.log';
    if (!is_file($ruta)) {
        return 0;
    }
    return preg_match_all('/1213|Deadlock/', (string) file_get_contents($ruta));
}

/** @return array<int, string> resultados de los procesos paralelos que llaman al servicio a la vez */
function lanzarParalelo(int $idUsuario, string $texto): array
{
    $arranque = microtime(true) + SEGUNDOS_ARRANQUE_PARALELO;
    $procesos = [];
    for ($indice = 0; $indice < PROCESOS_PARALELOS; $indice++) {
        $comando = [PHP_BINARY, __FILE__, '--trabajador', (string) $idUsuario, $texto, (string) $arranque];
        $procesos[] = proc_open($comando, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $tuberias);
        $tuberiasProcesos[] = $tuberias;
    }
    $salidas = [];
    foreach ($procesos as $indice => $proceso) {
        $salidas[] = trim((string) stream_get_contents($tuberiasProcesos[$indice][1]));
        proc_close($proceso);
    }
    return $salidas;
}

function esSalidaCorrecta(array $salidas): bool
{
    return count(array_filter($salidas, fn(string $salida): bool => $salida === 'OK')) === count($salidas);
}

function limitesEsperadosDePlan(int $idPlan): array
{
    $plan = consultar('SELECT * FROM spsu_planes WHERE pla_idPlan = ?', 'i', $idPlan)[0];
    $diasAnalisis = (int) $plan['pla_rangoLibre'] === 1 ? null : (int) $plan['pla_bloqueoDias'];
    return [
        'numCuentas' => (int) $plan['pla_numCuentas'],
        'diasReporte' => (int) $plan['pla_diasHistorial'],
        'diasAnalisis' => $diasAnalisis,
        'maxOperacionesAnalisis' => $diasAnalisis,
        'diasTotalesAnalisis' => (int) $plan['pla_diasTotales'],
        'puedeGraficar' => (int) $plan['pla_puedeGraficar'] === 1,
        'puedeDescargar' => (int) $plan['pla_puedeDescargar'] === 1,
        'divisorEditable' => (int) $plan['pla_divisorEditable'] === 1,
        'maxOperacionesDiarias' => $plan['pla_maxOperacionesDiarias'] === null ? null : (int) $plan['pla_maxOperacionesDiarias'],
    ];
}

// ------------------------------------------------------------------ modo trabajador (procesos paralelos)

if (($argv[1] ?? '') === '--trabajador') {
    try {
        $esperar = (float) $argv[4] - microtime(true);
        if ($esperar > 0) {
            usleep((int) ($esperar * 1000000));
        }
        servicioEn($argv[3])->resolver((int) $argv[2]);
        echo 'OK';
    } catch (Throwable $error) {
        echo 'ERROR ' . $error->getMessage();
    }
    exit(0);
}

// ------------------------------------------------------------------ datos de referencia

$planesModelo = new PlanesMdl($enlace);
$combinacionPrueba = (int) $planesModelo->obtenerCombinacionDePrueba()['pin_idPlanInterv'];
$planPrueba = (int) $planesModelo->obtenerCombinacionDePrueba()['pla_idPlan'];
$planLibre = $planesModelo->obtenerCombinacionDelPlanSiguiente(
    (int) $planesModelo->obtenerCombinacionDePrueba()['pla_planSiguienteId']
);
$combinacionLibre = (int) $planLibre['pin_idPlanInterv'];
$idPlanLibre = (int) $planLibre['pla_idPlan'];
$horasLibre = (int) $planLibre['pla_horasDuracion'];
$combinacionBasico = (int) escalar('SELECT MIN(pin_idPlanInterv) FROM spsu_planintervalo WHERE pin_plaIdPlan = 2');
$combinacionPremium = (int) escalar('SELECT MIN(pin_idPlanInterv) FROM spsu_planintervalo WHERE pin_plaIdPlan = 3');
$combinacionEnterprise = (int) escalar('SELECT MIN(pin_idPlanInterv) FROM spsu_planintervalo WHERE pin_plaIdPlan = 4');

$fallos = [];
$resultadosFinales = 0;

function caso(string $codigo, callable $cuerpo): void
{
    global $fallos, $resultadosFinales;
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
    $resultadosFinales++;
    if ($problemas === []) {
        echo "PASS $codigo\n";
        return;
    }
    $fallos[] = $codigo;
    echo "FAIL $codigo: " . implode(' | ', $problemas) . "\n";
}

function sumarHoras(string $texto, int $horas): string
{
    return instante($texto)->modify('+' . $horas . ' hour')->format('Y-m-d H:i:s');
}

limpiarFixtures();
$interbloqueosAntes = contarInterbloqueos();

// R01 prueba en curso a las 23:59:59
caso('R01', function (callable $verificar) use ($combinacionPrueba): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    $respuesta = servicioEn('2026-06-02 11:59:59')->resolver($usuario);
    $verificar($respuesta['estado'] === 'PRUEBA' && $respuesta['esPrueba'] === true, 'estado ' . $respuesta['estado']);
    $verificar($respuesta['segundosRestantes'] === 1, 'segundos ' . var_export($respuesta['segundosRestantes'], true));
    $verificar(count(suscripcionesDe($usuario)) === 1 && suscripcionesDe($usuario)[0]['sus_situacion'] === 'A', 'filas cambiadas');
});

// R02 prueba vencida a las 24:00:00 -> E y Libre
caso('R02', function (callable $verificar) use ($combinacionPrueba, $combinacionLibre, $horasLibre): void {
    $usuario = nuevoUsuario();
    $idPrueba = nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    $respuesta = servicioEn('2026-06-02 12:00:00')->resolver($usuario);
    $filas = suscripcionesDe($usuario);
    $verificar(count($filas) === 2, 'filas ' . count($filas));
    $verificar($filas[0]['sus_situacion'] === 'E', 'prueba no expirada');
    $verificar($filas[1]['sus_situacion'] === 'A' && (int) $filas[1]['sus_pinIdPlanin'] === $combinacionLibre, 'sin Libre');
    $verificar($filas[1]['sus_fechaHoraFin'] === sumarHoras('2026-06-02 12:00:00', $horasLibre), 'fin del Libre ' . $filas[1]['sus_fechaHoraFin']);
    $verificar($respuesta['estado'] === 'LIBRE', 'estado ' . $respuesta['estado']);
    $verificar(count(accionesDeHistorial($usuario, 'EXPIRADA')) === 1 && count(accionesDeHistorial($usuario, 'TRANSICION')) === 1, 'historial');
    $verificar(contarEventos($usuario, 'PRUEBA_EXPIRADA') === 1, 'auditoría PRUEBA_EXPIRADA');
    $verificar($idPrueba === (int) $filas[0]['sis_idSuscrip'], 'identificador');
});

// R03 mismo resultado con tres zonas horarias de PHP
caso('R03', function (callable $verificar) use ($combinacionPrueba, $horasLibre): void {
    $zonaOriginal = date_default_timezone_get();
    foreach (ZONAS_HORARIAS as $zona) {
        date_default_timezone_set($zona);
        $usuario = nuevoUsuario();
        nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
        $antes = servicioEn('2026-06-02 11:59:59')->resolver($usuario);
        $verificar($antes['estado'] === 'PRUEBA', "$zona: a las 23:59:59 no es PRUEBA");
        $despues = servicioEn('2026-06-02 12:00:00')->resolver($usuario);
        $filas = suscripcionesDe($usuario);
        $verificar($despues['estado'] === 'LIBRE' && count($filas) === 2, "$zona: a las 24:00:00 no pasó a LIBRE");
        $verificar($filas[1]['sus_fechaHoraFin'] === sumarHoras('2026-06-02 12:00:00', $horasLibre), "$zona: fin del Libre");
    }
    date_default_timezone_set($zonaOriginal);
});

// R04 una sola vez a las 24:00:01
caso('R04', function (callable $verificar) use ($combinacionPrueba): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    servicioEn('2026-06-02 12:00:01')->resolver($usuario);
    servicioEn('2026-06-02 12:00:02')->resolver($usuario);
    $verificar(count(suscripcionesDe($usuario)) === 2, 'filas ' . count(suscripcionesDe($usuario)));
});

// R05 plan de pago sin renovación: vigente hasta el final del día de corte
caso('R05', function (callable $verificar) use ($combinacionBasico): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'A', '2026-05-10', '2026-06-10', null, 0);
    $vigente = servicioEn('2026-06-10 23:59:59')->resolver($usuario);
    $verificar($vigente['estado'] === 'PAGO' && $vigente['fechaCorte'] === '2026-06-10', 'a las 23:59:59 no es PAGO');
    $cortado = servicioEn('2026-06-11 00:00:00')->resolver($usuario);
    $filas = suscripcionesDe($usuario);
    $verificar($cortado['estado'] === 'SIN_PLAN' && $cortado['motivoSinPlan'] === 'PLAN_PAGO_VENCIDO', 'estado ' . $cortado['estado']);
    $verificar(count($filas) === 1 && $filas[0]['sus_situacion'] === 'E', 'la suscripción no quedó en E sin otras filas');
    $verificar(contarEventos($usuario, 'PLAN_CORTADO') === 1 && contarEventos($usuario, 'PLAN_RENOVACION') === 0, 'auditoría');
    $verificar(count(accionesDeHistorial($usuario, 'CORTADA')) === 1, 'historial CORTADA');
});

// R06 Libre a 9 d 23:59:59 vigente y a 10 d 00:00:00 vencido
caso('R06', function (callable $verificar) use ($combinacionLibre, $horasLibre): void {
    $usuario = nuevoUsuario();
    $fin = sumarHoras(INSTANTE_BASE, $horasLibre);
    nuevaSuscripcion($usuario, $combinacionLibre, 'A', '2026-06-01', substr($fin, 0, 10), $fin);
    $antes = servicioEn(instante($fin)->modify('-1 second')->format('Y-m-d H:i:s'))->resolver($usuario);
    $verificar($antes['estado'] === 'LIBRE', 'antes del límite ' . $antes['estado']);
    $despues = servicioEn($fin)->resolver($usuario);
    $verificar($despues['estado'] === 'SIN_PLAN' && $despues['motivoSinPlan'] === 'LIBRE_TERMINADO', 'estado ' . $despues['estado']);
    $verificar(count(suscripcionesDe($usuario)) === 1 && suscripcionesDe($usuario)[0]['sus_situacion'] === 'E', 'filas');
});

// R07 las suscripciones pendientes no cuentan
caso('R07', function (callable $verificar) use ($combinacionBasico, $combinacionPremium, $combinacionPrueba): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'P', '2026-05-30', '2026-12-30');
    nuevaSuscripcion($usuario, $combinacionPremium, 'P', '2026-05-30', '2026-12-30');
    $sinPlan = servicioEn(INSTANTE_BASE)->resolver($usuario);
    $verificar($sinPlan['estado'] === 'SIN_PLAN' && $sinPlan['vigente'] === false, 'las P cuentan como vigentes');
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    $conPrueba = servicioEn(INSTANTE_BASE)->resolver($usuario);
    $verificar($conPrueba['estado'] === 'PRUEBA', 'con prueba y P: ' . $conPrueba['estado']);
});

// R08 cuenta anterior sin ningún plan
caso('R08', function (callable $verificar) use ($idPlanLibre): void {
    $usuario = nuevoUsuario();
    $respuesta = servicioEn(INSTANTE_BASE)->resolver($usuario);
    $verificar($respuesta['estado'] === 'SIN_PLAN' && $respuesta['motivoSinPlan'] === 'NUNCA_TUVO_PLAN', 'motivo ' . var_export($respuesta['motivoSinPlan'], true));
    $verificar($respuesta['limites'] === limitesEsperadosDePlan($idPlanLibre), 'límites distintos de los del Libre');
    $verificar(suscripcionesDe($usuario) === [], 'se crearon filas');
});

// R09 prueba vencida con un plan de pago ya cortado: no hay Libre
caso('R09', function (callable $verificar) use ($combinacionPrueba, $combinacionBasico): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'E', '2026-04-01', '2026-05-01', null, 0);
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    $respuesta = servicioEn('2026-06-02 12:00:00')->resolver($usuario);
    $verificar($respuesta['estado'] === 'SIN_PLAN', 'estado ' . $respuesta['estado']);
    $verificar(count(suscripcionesDe($usuario)) === 2, 'se creó un Libre');
});

// R10 cinco procesos con la prueba vencida: un solo Libre
caso('R10', function (callable $verificar) use ($combinacionPrueba, $combinacionLibre): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    $salidas = lanzarParalelo($usuario, '2026-06-02 12:00:01');
    $verificar(esSalidaCorrecta($salidas), implode(',', $salidas));
    $libres = array_filter(suscripcionesDe($usuario), fn(array $fila): bool => (int) $fila['sus_pinIdPlanin'] === $combinacionLibre);
    $verificar(count($libres) === 1, 'Libres ' . count($libres));
});

// R11 dos planes de pago activos: gana el de mayor nivel
caso('R11', function (callable $verificar) use ($combinacionBasico, $combinacionEnterprise): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionEnterprise, 'A', '2026-06-01', '2026-12-01', null, 1);
    nuevaSuscripcion($usuario, $combinacionBasico, 'A', '2026-06-01', '2026-12-01', null, 1);
    $respuesta = servicioEn(INSTANTE_BASE)->resolver($usuario);
    $verificar($respuesta['pin_idPlanInterv'] === $combinacionEnterprise, 'ganó ' . var_export($respuesta['pin_idPlanInterv'], true));
});

// R12 prueba vencida y plan de pago activo a la vez: la prueba pasa a E sin Libre
caso('R12', function (callable $verificar) use ($combinacionPrueba, $combinacionBasico): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'A', '2026-06-01', '2026-12-01', null, 1);
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    $respuesta = servicioEn('2026-06-02 12:00:00')->resolver($usuario);
    $verificar($respuesta['estado'] === 'PAGO', 'estado ' . $respuesta['estado']);
    $verificar(count(suscripcionesDe($usuario)) === 2 && count(suscripcionesDe($usuario, 'E')) === 1, 'filas');
});

// R13 límites por estado, contra las columnas del plan
caso('R13', function (callable $verificar) use ($combinacionPrueba, $planPrueba, $combinacionLibre, $idPlanLibre, $horasLibre, $combinacionBasico, $combinacionPremium): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    $verificar(servicioEn(INSTANTE_BASE)->resolver($usuario)['limites'] === limitesEsperadosDePlan($planPrueba), 'prueba');

    $usuario = nuevoUsuario();
    $fin = sumarHoras(INSTANTE_BASE, $horasLibre);
    nuevaSuscripcion($usuario, $combinacionLibre, 'A', '2026-06-01', substr($fin, 0, 10), $fin);
    $verificar(servicioEn(INSTANTE_BASE)->resolver($usuario)['limites'] === limitesEsperadosDePlan($idPlanLibre), 'libre');

    foreach ([[$combinacionBasico, 2], [$combinacionPremium, 3]] as [$combinacion, $idPlan]) {
        $usuario = nuevoUsuario();
        nuevaSuscripcion($usuario, $combinacion, 'A', '2026-06-01', '2026-12-01', null, 1);
        $verificar(servicioEn(INSTANTE_BASE)->resolver($usuario)['limites'] === limitesEsperadosDePlan($idPlan), "plan $idPlan");
    }

    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionLibre, 'E', '2026-05-01', '2026-05-11', '2026-05-11 12:00:00');
    $respuesta = servicioEn(INSTANTE_BASE)->resolver($usuario);
    $verificar($respuesta['motivoSinPlan'] === 'LIBRE_TERMINADO' && $respuesta['limites'] === limitesEsperadosDePlan($idPlanLibre), 'LIBRE_TERMINADO');

    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'E', '2026-04-01', '2026-05-01', null, 0);
    $respuesta = servicioEn(INSTANTE_BASE)->resolver($usuario);
    $verificar($respuesta['motivoSinPlan'] === 'PLAN_PAGO_VENCIDO' && $respuesta['limites'] === limitesEsperadosDePlan($idPlanLibre), 'PLAN_PAGO_VENCIDO');

    $usuario = nuevoUsuario();
    $respuesta = servicioEn(INSTANTE_BASE)->resolver($usuario);
    $verificar($respuesta['motivoSinPlan'] === 'NUNCA_TUVO_PLAN' && $respuesta['limites'] === limitesEsperadosDePlan($idPlanLibre), 'NUNCA_TUVO_PLAN');
});

// R14 leer (sin aplicar) y resolver coinciden con la prueba vencida
caso('R14', function (callable $verificar) use ($combinacionPrueba): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    $leido = lectorEn('2026-06-02 12:00:05')->leer($usuario);
    $verificar($leido['estado'] === 'LIBRE', 'leer: ' . $leido['estado']);
    $verificar(count(suscripcionesDe($usuario)) === 1, 'leer modificó la base');
    $resuelto = servicioEn('2026-06-02 12:00:05')->resolver($usuario);
    $verificar($resuelto['estado'] === $leido['estado'] && $resuelto['plan']['pla_idPlan'] === (int) $leido['filaVigente']['pla_idPlan'], 'estado o plan distinto');
    $verificar($resuelto['limites'] === $leido['limites'], 'límites distintos');
});

/** Prepara un plan de pago con corte el 2026-06-10 y devuelve [usuario, idSuscripcion]. */
function planConCorte(int $combinacion, int $renovacion): array
{
    $usuario = nuevoUsuario();
    $idSuscripcion = nuevaSuscripcion($usuario, $combinacion, 'A', '2026-05-10', '2026-06-10', null, $renovacion);
    return [$usuario, $idSuscripcion];
}

// R15 corte con renovación pendiente (tres zonas)
caso('R15', function (callable $verificar) use ($combinacionBasico): void {
    $zonaOriginal = date_default_timezone_get();
    foreach (ZONAS_HORARIAS as $zona) {
        date_default_timezone_set($zona);
        [$usuario, $idOrigen] = planConCorte($combinacionBasico, 1);
        $antes = servicioEn('2026-06-10 23:59:59')->resolver($usuario);
        $verificar($antes['estado'] === 'PAGO' && count(suscripcionesDe($usuario)) === 1, "$zona: a las 23:59:59 cambió");
        $respuesta = servicioEn('2026-06-11 00:00:00')->resolver($usuario);
        $filas = suscripcionesDe($usuario);
        $verificar(count($filas) === 2 && $filas[0]['sus_situacion'] === 'E', "$zona: filas");
        $renovacion = $filas[1] ?? [];
        $verificar(($renovacion['sus_situacion'] ?? '') === 'P' && (int) $renovacion['sus_pinIdPlanin'] === $combinacionBasico, "$zona: P");
        $verificar(($renovacion['sus_renovAutomatica'] ?? null) === 1 || ($renovacion['sus_renovAutomatica'] ?? null) === '1', "$zona: renovación");
        $verificar(($renovacion['sus_fechainicio'] ?? '') === '2026-06-11' && ($renovacion['sus_fechaFin'] ?? '') === '2026-07-10', "$zona: fechas de la P");
        $verificar(array_key_exists('sus_referenPago', $renovacion) && $renovacion['sus_referenPago'] === null, "$zona: referencia de pago");
        $verificar(count(accionesDeHistorial($usuario, 'CORTADA')) === 1, "$zona: CORTADA");
        $detalle = accionesDeHistorial($usuario, 'renovacion')[0]['his_detalle'] ?? '';
        $verificar($detalle === 'Renovación pendiente de pago de la suscripción ' . $idOrigen, "$zona: detalle $detalle");
        $verificar(contarEventos($usuario, 'PLAN_CORTADO') === 1 && contarEventos($usuario, 'PLAN_RENOVACION') === 1, "$zona: auditoría");
        $pendiente = $respuesta['planPendiente'];
        $verificar($pendiente !== null && $pendiente['esRenovacion'] === true && $pendiente['fechaLimitePago'] === '2026-07-10' && $pendiente['diasRestantesPago'] === 29, "$zona: planPendiente " . json_encode($pendiente));
        $verificar($respuesta['estado'] === 'SIN_PLAN' && $respuesta['motivoSinPlan'] === 'PLAN_PAGO_VENCIDO', "$zona: estado");
    }
    date_default_timezone_set($zonaOriginal);
});

// R16 sin renovación automática no se crea nada
caso('R16', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario] = planConCorte($combinacionBasico, 0);
    $respuesta = servicioEn('2026-06-11 00:00:00')->resolver($usuario);
    $verificar(count(suscripcionesDe($usuario)) === 1 && accionesDeHistorial($usuario, 'renovacion') === [], 'se creó una renovación');
    $verificar($respuesta['planPendiente'] === null && $respuesta['motivoSinPlan'] === 'PLAN_PAGO_VENCIDO', 'respuesta');
});

// R17 con una P de la misma combinación no se crea otra
caso('R17', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario] = planConCorte($combinacionBasico, 1);
    nuevaSuscripcion($usuario, $combinacionBasico, 'P', '2026-06-01', '2026-07-01');
    servicioEn('2026-06-11 00:00:00')->resolver($usuario);
    $verificar(count(suscripcionesDe($usuario, 'P')) === 1 && count(suscripcionesDe($usuario, 'E')) === 1, 'filas');
    $verificar(count(accionesDeHistorial($usuario, 'CORTADA')) === 1 && accionesDeHistorial($usuario, 'renovacion') === [], 'historial');
});

// R18 cinco procesos con el plan vencido: una renovación
caso('R18', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario] = planConCorte($combinacionBasico, 1);
    $salidas = lanzarParalelo($usuario, '2026-06-11 00:00:00');
    $verificar(esSalidaCorrecta($salidas), implode(',', $salidas));
    $verificar(count(suscripcionesDe($usuario, 'E')) === 1 && count(suscripcionesDe($usuario, 'P')) === 1, 'filas');
    $verificar(count(accionesDeHistorial($usuario, 'CORTADA')) === 1 && count(accionesDeHistorial($usuario, 'renovacion')) === 1, 'historial');
    $verificar(contarEventos($usuario, 'PLAN_CORTADO') === 1 && contarEventos($usuario, 'PLAN_RENOVACION') === 1, 'auditoría');
});

// R19 leer y resolver coinciden con el plan de pago vencido
caso('R19', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario] = planConCorte($combinacionBasico, 1);
    $leido = lectorEn('2026-06-11 00:00:00')->leer($usuario);
    $verificar($leido['estado'] === 'SIN_PLAN' && $leido['motivoSinPlan'] === 'PLAN_PAGO_VENCIDO', 'leer');
    $verificar(count(suscripcionesDe($usuario)) === 1, 'leer modificó la base');
    $resuelto = servicioEn('2026-06-11 00:00:00')->resolver($usuario);
    $verificar($resuelto['estado'] === $leido['estado'] && $resuelto['motivoSinPlan'] === $leido['motivoSinPlan'] && $resuelto['limites'] === $leido['limites'], 'diferencias');
    $verificar($resuelto['planPendiente']['esRenovacion'] === true && $leido['planPendiente']['esRenovacion'] === true, 'planPendiente');
});

// R20 la renovación no cuenta, no cobra y no cambia las fechas de la cortada
caso('R20', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario, $idOrigen] = planConCorte($combinacionBasico, 1);
    $pagosAntes = contarPagosDe($usuario);
    $respuesta = servicioEn('2026-06-11 00:00:00')->resolver($usuario);
    $verificar($respuesta['vigente'] === false && $respuesta['estado'] === 'SIN_PLAN', 'la renovación es vigente');
    $verificar(count(suscripcionesDe($usuario)) === 2, 'se crearon Libre o prueba');
    $verificar(contarPagosDe($usuario) === $pagosAntes, 'cambió spsu_pagos');
    $origen = suscripcionesDe($usuario)[0];
    $verificar((int) $origen['sis_idSuscrip'] === $idOrigen && $origen['sus_fechainicio'] === '2026-05-10' && $origen['sus_fechaFin'] === '2026-06-10' && $origen['sus_referenPago'] === null, 'cambió la cortada');
});

/** Origen cortado el 2026-06-10 con su renovación pendiente (plazo hasta el 2026-07-10). */
function renovacionPendiente(int $combinacion): array
{
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacion, 'E', '2026-05-10', '2026-06-10', null, 1);
    $idRenovacion = nuevaSuscripcion($usuario, $combinacion, 'P', '2026-06-11', '2026-07-10', null, 1);
    marcarRenovacion($idRenovacion, $usuario);
    return [$usuario, $idRenovacion];
}

// R21 límite del plazo: día 30 vale, día 31 se anula y concede un Libre (tres zonas)
caso('R21', function (callable $verificar) use ($combinacionBasico, $combinacionLibre, $horasLibre): void {
    $zonaOriginal = date_default_timezone_get();
    foreach (ZONAS_HORARIAS as $zona) {
        date_default_timezone_set($zona);
        [$usuario, $idRenovacion] = renovacionPendiente($combinacionBasico);
        $enPlazo = servicioEn('2026-07-10 23:59:59')->resolver($usuario);
        $verificar($enPlazo['planPendiente']['diasRestantesPago'] === 0 && count(suscripcionesDe($usuario, 'P')) === 1, "$zona: día 30");
        $leido = lectorEn('2026-07-11 00:00:00')->leer($usuario);
        $respuesta = servicioEn('2026-07-11 00:00:00')->resolver($usuario);
        $filas = suscripcionesDe($usuario);
        $renovacion = array_values(array_filter($filas, fn(array $fila): bool => (int) $fila['sis_idSuscrip'] === $idRenovacion))[0];
        $verificar($renovacion['sus_situacion'] === 'C' && (int) $renovacion['sus_renovAutomatica'] === 0, "$zona: la P no quedó anulada");
        $verificar(count(accionesDeHistorial($usuario, 'ANULADA')) === 1 && contarEventos($usuario, 'PLAN_RENOV_ANULADA') === 1, "$zona: historial o auditoría");
        $libre = array_values(array_filter($filas, fn(array $fila): bool => (int) $fila['sus_pinIdPlanin'] === $combinacionLibre))[0] ?? null;
        $verificar($libre !== null && $libre['sus_situacion'] === 'A' && $libre['sus_fechaHoraFin'] === sumarHoras('2026-07-11 00:00:00', $horasLibre), "$zona: Libre");
        $verificar(count(accionesDeHistorial($usuario, 'TRANSICION')) === 1, "$zona: TRANSICION");
        $verificar($respuesta['estado'] === 'LIBRE' && $respuesta['planPendiente'] === null, "$zona: estado " . $respuesta['estado']);
        $verificar($leido['estado'] === $respuesta['estado'] && $leido['limites'] === $respuesta['limites'], "$zona: leer y resolver");
    }
    date_default_timezone_set($zonaOriginal);
});

// R22 pago en revisión, rechazado o confirmado
caso('R22', function (callable $verificar) use ($combinacionBasico, $combinacionLibre): void {
    [$usuario, $idRenovacion] = renovacionPendiente($combinacionBasico);
    $idPago = nuevoPago($idRenovacion, 'R');
    $enRevision = servicioEn('2026-07-12 00:00:00')->resolver($usuario);
    $verificar($enRevision['estado'] === 'SIN_PLAN' && $enRevision['planPendiente']['comprobanteEnviado'] === true, 'con pago R no debe anularse');
    $verificar(count(suscripcionesDe($usuario, 'P')) === 1, 'se anuló con pago R');
    global $enlace;
    $enlace->ejecutarActualizacion('UPDATE spsu_pagos SET pag_situacion = \'F\' WHERE pag_idPago = ?', 'i', $idPago);
    $respuesta = servicioEn('2026-07-12 00:00:00')->resolver($usuario);
    $verificar($respuesta['estado'] === 'LIBRE' && count(suscripcionesDe($usuario, 'C')) === 1, 'rechazado: no se anuló');

    [$usuarioConfirmado, $idRenovacionConfirmada] = renovacionPendiente($combinacionBasico);
    nuevoPago($idRenovacionConfirmada, 'C');
    servicioEn('2026-07-12 00:00:00')->resolver($usuarioConfirmado);
    $verificar(count(suscripcionesDe($usuarioConfirmado, 'P')) === 1 && count(suscripcionesDe($usuarioConfirmado, 'C')) === 0, 'con pago C se anuló');
});

// R23 el plazo sale del origen aunque la P tenga fechas recalculadas por un comprobante rechazado
caso('R23', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario, $idRenovacion] = renovacionPendiente($combinacionBasico);
    global $enlace;
    $enlace->ejecutarActualizacion('UPDATE spsu_suscripcion SET sus_fechainicio = \'2026-06-20\', sus_fechaFin = \'2026-07-20\' WHERE sis_idSuscrip = ?', 'i', $idRenovacion);
    nuevoPago($idRenovacion, 'F');
    $respuesta = servicioEn('2026-07-11 00:00:00')->resolver($usuario);
    $verificar(count(suscripcionesDe($usuario, 'C')) === 1 && $respuesta['estado'] === 'LIBRE', 'no se anuló el día 31');
});

// R24 cinco procesos con el plazo vencido: una anulación y un Libre
caso('R24', function (callable $verificar) use ($combinacionBasico, $combinacionLibre): void {
    [$usuario] = renovacionPendiente($combinacionBasico);
    $salidas = lanzarParalelo($usuario, '2026-07-11 00:00:00');
    $verificar(esSalidaCorrecta($salidas), implode(',', $salidas));
    $libres = array_filter(suscripcionesDe($usuario), fn(array $fila): bool => (int) $fila['sus_pinIdPlanin'] === $combinacionLibre);
    $verificar(count($libres) === 1, 'Libres ' . count($libres));
    $verificar(count(accionesDeHistorial($usuario, 'ANULADA')) === 1 && contarEventos($usuario, 'PLAN_RENOV_ANULADA') === 1, 'anulaciones');
});

// R25 el Libre por anulación vence una vez y no encadena nada; no bloquea un plan de pago nuevo
caso('R25', function (callable $verificar) use ($combinacionBasico, $combinacionLibre, $horasLibre): void {
    global $enlace;
    [$usuario] = renovacionPendiente($combinacionBasico);
    servicioEn('2026-07-11 00:00:00')->resolver($usuario);
    $fin = sumarHoras('2026-07-11 00:00:00', $horasLibre);
    $vigente = servicioEn(instante($fin)->modify('-1 second')->format('Y-m-d H:i:s'))->resolver($usuario);
    $verificar($vigente['estado'] === 'LIBRE', 'a 9 d 23:59:59 ' . $vigente['estado']);
    $vencido = servicioEn($fin)->resolver($usuario);
    $verificar($vencido['estado'] === 'SIN_PLAN' && $vencido['motivoSinPlan'] === 'LIBRE_TERMINADO', 'a 10 d ' . $vencido['estado']);
    $verificar(count(suscripcionesDe($usuario)) === 3, 'filas ' . count(suscripcionesDe($usuario)) . ' (esperadas 3: origen, renovación anulada y Libre)');
    $conceder = (new PruebaGratuitaSrv($enlace, fn(): DateTimeImmutable => instante($fin)))->conceder($usuario);
    $verificar($conceder['resultado'] === PruebaGratuitaSrv::RESULTADO_RECHAZADA, 'la prueba se volvió a conceder');
    $verificar((new SuscripcionMdl($enlace))->existeSuscripcionVigente($usuario, '2026-07-21') === false, 'el Libre o lo anulado bloquea');
});

// R26 cuenta que no consulta durante 60 días: toda la cadena en una evaluación
caso('R26', function (callable $verificar) use ($combinacionBasico, $combinacionLibre, $horasLibre): void {
    [$usuario] = planConCorte($combinacionBasico, 1);
    $leido = lectorEn('2026-08-09 12:00:00')->leer($usuario);
    $respuesta = servicioEn('2026-08-09 12:00:00')->resolver($usuario);
    $filas = suscripcionesDe($usuario);
    $verificar(count($filas) === 3, 'filas ' . count($filas));
    $verificar($filas[0]['sus_situacion'] === 'E' && ($filas[1]['sus_situacion'] ?? '') === 'C', 'situaciones');
    $verificar((int) ($filas[2]['sus_pinIdPlanin'] ?? 0) === $combinacionLibre && $filas[2]['sus_fechaHoraFin'] === sumarHoras('2026-08-09 12:00:00', $horasLibre), 'Libre');
    $verificar($respuesta['estado'] === 'LIBRE' && $leido['estado'] === 'LIBRE', 'estado');
    $verificar(count(accionesDeHistorial($usuario, 'renovacion')) === 1 && count(accionesDeHistorial($usuario, 'ANULADA')) === 1, 'historial');
});

/** Plan presente con corte el 2026-06-10 y un periodo programado (pago confirmado) que empieza el día siguiente. */
function planConProgramada(int $combinacion, int $renovacionPresente, int $renovacionProgramada): array
{
    $usuario = nuevoUsuario();
    $idPresente = nuevaSuscripcion($usuario, $combinacion, 'A', '2026-05-10', '2026-06-10', null, $renovacionPresente);
    $idProgramada = nuevaSuscripcion($usuario, $combinacion, 'P', '2026-06-11', '2026-07-10', null, $renovacionProgramada);
    nuevoPago($idProgramada, 'C');
    return [$usuario, $idPresente, $idProgramada];
}

// R27 el periodo programado se activa al corte del presente sin renovación
caso('R27', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario, $idPresente, $idProgramada] = planConProgramada($combinacionBasico, 1, 1);
    $antes = servicioEn(INSTANTE_BASE)->resolver($usuario);
    $verificar($antes['estado'] === 'PAGO' && $antes['idSuscripcion'] === $idPresente && $antes['planProgramado'] !== null && $antes['planPendiente'] === null, 'antes del corte');
    $ultimo = servicioEn('2026-06-10 23:59:59')->resolver($usuario);
    $verificar($ultimo['idSuscripcion'] === $idPresente, 'último segundo');
    $leido = lectorEn('2026-06-11 00:00:00')->leer($usuario);
    $respuesta = servicioEn('2026-06-11 00:00:00')->resolver($usuario);
    $verificar($respuesta['estado'] === 'PAGO' && $respuesta['idSuscripcion'] === $idProgramada && $respuesta['planProgramado'] === null, 'activación ' . json_encode($respuesta['idSuscripcion']));
    $verificar(count(suscripcionesDe($usuario, 'P')) === 0 && count(suscripcionesDe($usuario, 'E')) === 1, 'filas');
    $verificar(count(accionesDeHistorial($usuario, 'ACTIVACION')) === 1 && contarEventos($usuario, 'PLAN_ACTIV_PROGRAM') === 1, 'historial o auditoría');
    $verificar($leido['estado'] === $respuesta['estado'] && $leido['limites'] === $respuesta['limites'] && (int) $leido['filaVigente']['pla_idPlan'] === $respuesta['plan']['pla_idPlan'], 'leer y resolver (R31)');
});

// R28 programada sin renovación automática termina sin renovación
caso('R28', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario] = planConProgramada($combinacionBasico, 0, 0);
    $respuesta = servicioEn('2026-07-11 00:00:00')->resolver($usuario);
    $verificar($respuesta['estado'] === 'SIN_PLAN' && count(suscripcionesDe($usuario, 'P')) === 0 && count(suscripcionesDe($usuario, 'E')) === 2, 'estado ' . $respuesta['estado']);
});

// R29 cadena cortar, activar, cortar y renovar
caso('R29', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario, $idPresente, $idProgramada] = planConProgramada($combinacionBasico, 1, 1);
    $respuesta = servicioEn('2026-07-15 00:00:00')->resolver($usuario);
    $filas = suscripcionesDe($usuario);
    $verificar(count($filas) === 3 && $filas[0]['sus_situacion'] === 'E' && $filas[1]['sus_situacion'] === 'E' && $filas[2]['sus_situacion'] === 'P', 'filas ' . json_encode(array_column($filas, 'sus_situacion')));
    $verificar(($filas[2]['sus_fechainicio'] ?? '') === '2026-07-11' && ($filas[2]['sus_fechaFin'] ?? '') === '2026-08-09', 'fechas de la renovación');
    $detalle = accionesDeHistorial($usuario, 'renovacion')[0]['his_detalle'] ?? '';
    $verificar($detalle === 'Renovación pendiente de pago de la suscripción ' . $idProgramada, 'origen ' . $detalle);
    $verificar($respuesta['motivoSinPlan'] === 'PLAN_PAGO_VENCIDO' && $respuesta['planPendiente']['diasRestantesPago'] === 25, 'respuesta');
    $verificar($idPresente !== $idProgramada, 'identificadores');
});

// R30 con programada nunca se crea renovación, antes ni después del corte
caso('R30', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario] = planConProgramada($combinacionBasico, 1, 1);
    servicioEn('2026-06-05 00:00:00')->resolver($usuario);
    $verificar(accionesDeHistorial($usuario, 'renovacion') === [] && count(suscripcionesDe($usuario)) === 2, 'antes del corte');
    servicioEn('2026-06-11 00:00:00')->resolver($usuario);
    $verificar(accionesDeHistorial($usuario, 'renovacion') === [] && count(suscripcionesDe($usuario, 'P')) === 0, 'después del corte');
});

// R31 leer y resolver coinciden en la anulación y en la programada
caso('R31', function (callable $verificar) use ($combinacionBasico): void {
    [$usuarioAnulacion] = renovacionPendiente($combinacionBasico);
    $leido = lectorEn('2026-07-11 00:00:00')->leer($usuarioAnulacion);
    $resuelto = servicioEn('2026-07-11 00:00:00')->resolver($usuarioAnulacion);
    $verificar($leido['estado'] === $resuelto['estado'] && $leido['limites'] === $resuelto['limites'] && (int) $leido['filaVigente']['pla_idPlan'] === $resuelto['plan']['pla_idPlan'], 'anulación');
    [$usuarioProgramada] = planConProgramada($combinacionBasico, 1, 1);
    $leido = lectorEn('2026-06-11 00:00:00')->leer($usuarioProgramada);
    $resuelto = servicioEn('2026-06-11 00:00:00')->resolver($usuarioProgramada);
    $verificar($leido['estado'] === $resuelto['estado'] && $leido['limites'] === $resuelto['limites'] && (int) $leido['filaVigente']['pla_idPlan'] === $resuelto['plan']['pla_idPlan'], 'programada');
});

// R32 cinco procesos con el corte de un plan con programada: una sola activación
caso('R32', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario] = planConProgramada($combinacionBasico, 1, 1);
    $salidas = lanzarParalelo($usuario, '2026-06-11 00:00:00');
    $verificar(esSalidaCorrecta($salidas), implode(',', $salidas));
    $verificar(count(accionesDeHistorial($usuario, 'ACTIVACION')) === 1 && contarEventos($usuario, 'PLAN_ACTIV_PROGRAM') === 1, 'activaciones');
    $verificar(count(suscripcionesDe($usuario, 'A')) === 1 && count(suscripcionesDe($usuario, 'E')) === 1, 'filas');
});

$interbloqueosNuevos = contarInterbloqueos() - $interbloqueosAntes;
limpiarFixtures();
$restantes = (int) escalar('SELECT COUNT(*) FROM sgen_usuario WHERE usu_usuario REGEXP ?', 's', '^' . PREFIJO_FIXTURE);
echo 'INTERBLOQUEOS nuevos en el registro: ' . $interbloqueosNuevos . "\n";
echo 'FIXTURES restantes: ' . $restantes . "\n";
echo 'RESUMEN casos=' . $resultadosFinales . ' fallos=' . count($fallos) . "\n";
exit($fallos === [] && $interbloqueosNuevos === 0 && $restantes === 0 ? 0 : 1);
