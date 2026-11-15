<?php

declare(strict_types=1);

/**
 * Prueba de equivalencia del LectorPlanVigente (HLT-24-v2, casos L01 a L18): la lectura previa del lector,
 * la resolución de PlanVigenteSrv y la lectura posterior dan el mismo estado, plan y límites, con reloj simulado.
 * Comprueba además que la copia de rest_criteriokelly es idéntica (sha256) y de solo lectura.
 * Solo CLI: C:\xampp\php\php.exe anexos\pruebas\lector_plan_vigente.php
 * Crea usuarios fixture con el prefijo ck_prueba_hu5_ y los borra al terminar.
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

const PREFIJO_FIXTURE = 'ck_prueba_hu5_';
const INSTANTE_BASE = '2026-06-01 12:00:00';
const ZONAS_HORARIAS = ['Europe/Berlin', 'America/Guayaquil', 'Pacific/Kiritimati'];

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
        'Hu5',
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


$planesModelo = new PlanesMdl($enlace);
$planLibre = $planesModelo->obtenerCombinacionDelPlanSiguiente(
    (int) $planesModelo->obtenerCombinacionDePrueba()['pla_planSiguienteId']
);
$combinacionPrueba = (int) $planesModelo->obtenerCombinacionDePrueba()['pin_idPlanInterv'];
$combinacionLibre = (int) $planLibre['pin_idPlanInterv'];
$horasLibre = (int) $planLibre['pla_horasDuracion'];
$combinacionBasico = (int) escalar('SELECT MIN(pin_idPlanInterv) FROM spsu_planintervalo WHERE pin_plaIdPlan = 2');
$combinacionPremium = (int) escalar('SELECT MIN(pin_idPlanInterv) FROM spsu_planintervalo WHERE pin_plaIdPlan = 3');
$cuentasDelLibre = (int) escalar('SELECT pla_numCuentas FROM spsu_planes WHERE pla_idPlan = ?', 'i', (int) $planLibre['pla_idPlan']);

$fallos = [];
$totalCasos = 0;

function sumarHoras(string $texto, int $horas): string
{
    return instante($texto)->modify('+' . $horas . ' hour')->format('Y-m-d H:i:s');
}

function idPlanDe(array $evaluacion): ?int
{
    return $evaluacion['filaVigente'] === null ? null : (int) $evaluacion['filaVigente']['pla_idPlan'];
}

/**
 * Comprueba el estado esperado y que la lectura previa, la resolución del servicio y la lectura posterior
 * coinciden en estado, plan y límites (la regla vive solo en el lector).
 */
function verificarEquivalencia(callable $verificar, int $usuario, string $instante, string $estado, ?string $motivo, string $etiqueta = ''): void
{
    $antes = lectorEn($instante)->leer($usuario);
    $resuelto = servicioEn($instante)->resolver($usuario);
    $despues = lectorEn($instante)->leer($usuario);
    $verificar($antes['estado'] === $estado, "$etiqueta estado previo {$antes['estado']} (esperado $estado)");
    $verificar($antes['motivoSinPlan'] === $motivo, "$etiqueta motivo previo " . var_export($antes['motivoSinPlan'], true));
    $verificar($resuelto['estado'] === $antes['estado'], "$etiqueta resolver {$resuelto['estado']}");
    $verificar($resuelto['limites'] === $antes['limites'], "$etiqueta límites de resolver");
    $idPlanResuelto = $resuelto['plan'] === null ? null : (int) $resuelto['plan']['pla_idPlan'];
    $verificar($idPlanResuelto === idPlanDe($antes), "$etiqueta plan de resolver");
    $verificar($despues['estado'] === $antes['estado'] && $despues['limites'] === $antes['limites'], "$etiqueta lectura posterior");
    $verificar(idPlanDe($despues) === idPlanDe($antes), "$etiqueta plan posterior");
}

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

/** Origen cortado el 2026-06-10 con su renovación pendiente (plazo hasta el 2026-07-10). */
function renovacionPendiente(int $combinacion): array
{
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacion, 'E', '2026-05-10', '2026-06-10', null, 1);
    $idRenovacion = nuevaSuscripcion($usuario, $combinacion, 'P', '2026-06-11', '2026-07-10', null, 1);
    marcarRenovacion($idRenovacion, $usuario);
    return [$usuario, $idRenovacion];
}

limpiarFixtures();

$rutaCopia = dirname($raizServicio) . '/rest_criteriokelly/configuracion/LectorPlanVigente.php';
$rutaOriginal = $raizServicio . '/configuracion/LectorPlanVigente.php';
caso('COPIA', function (callable $verificar) use ($rutaCopia, $rutaOriginal): void {
    $verificar(is_file($rutaCopia), 'no existe la copia');
    $verificar(hash_file('sha256', $rutaCopia) === hash_file('sha256', $rutaOriginal), 'sha256 distinto');
    $verificar(preg_match('/insert|update|delete|for update/i', (string) file_get_contents($rutaCopia)) !== 1, 'la copia escribe');
});

caso('L01', function (callable $verificar) use ($combinacionPrueba): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    verificarEquivalencia($verificar, $usuario, '2026-06-02 11:59:59', 'PRUEBA', null);
});

caso('L02', function (callable $verificar) use ($combinacionPrueba): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    verificarEquivalencia($verificar, $usuario, '2026-06-02 12:00:00', 'LIBRE', null);
});

caso('L03', function (callable $verificar) use ($combinacionPrueba): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    verificarEquivalencia($verificar, $usuario, '2026-06-02 18:00:00', 'LIBRE', null);
});

caso('L04', function (callable $verificar) use ($combinacionPrueba, $combinacionBasico): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'A', '2026-06-01', '2026-12-01', null, 1);
    nuevaSuscripcion($usuario, $combinacionPrueba, 'A', '2026-06-01', '2026-06-02', '2026-06-02 12:00:00');
    verificarEquivalencia($verificar, $usuario, '2026-06-02 12:00:00', 'PAGO', null);
});

caso('L05', function (callable $verificar) use ($combinacionLibre, $horasLibre): void {
    $usuario = nuevoUsuario();
    $fin = sumarHoras(INSTANTE_BASE, $horasLibre);
    nuevaSuscripcion($usuario, $combinacionLibre, 'A', '2026-06-01', substr($fin, 0, 10), $fin);
    verificarEquivalencia($verificar, $usuario, INSTANTE_BASE, 'LIBRE', null);
});

caso('L06', function (callable $verificar) use ($combinacionLibre, $horasLibre): void {
    $usuario = nuevoUsuario();
    $fin = sumarHoras(INSTANTE_BASE, $horasLibre);
    nuevaSuscripcion($usuario, $combinacionLibre, 'A', '2026-06-01', substr($fin, 0, 10), $fin);
    verificarEquivalencia($verificar, $usuario, $fin, 'SIN_PLAN', 'LIBRE_TERMINADO');
});

caso('L07', function (callable $verificar) use ($combinacionBasico): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'A', '2026-05-10', '2026-06-10', null, 0);
    verificarEquivalencia($verificar, $usuario, '2026-06-10 23:59:59', 'PAGO', null);
});

caso('L08', function (callable $verificar) use ($combinacionBasico): void {
    $sinRenovacion = nuevoUsuario();
    nuevaSuscripcion($sinRenovacion, $combinacionBasico, 'A', '2026-05-10', '2026-06-10', null, 0);
    verificarEquivalencia($verificar, $sinRenovacion, '2026-06-11 00:00:00', 'SIN_PLAN', 'PLAN_PAGO_VENCIDO', 'sin renovación:');
    $conRenovacion = nuevoUsuario();
    nuevaSuscripcion($conRenovacion, $combinacionBasico, 'A', '2026-05-10', '2026-06-10', null, 1);
    verificarEquivalencia($verificar, $conRenovacion, '2026-06-11 00:00:00', 'SIN_PLAN', 'PLAN_PAGO_VENCIDO', 'con renovación:');
});

caso('L09', function (callable $verificar) use ($combinacionBasico): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'A', '2026-05-10', '2026-06-10', null, 0);
    verificarEquivalencia($verificar, $usuario, '2026-06-05 08:00:00', 'PAGO', null);
});

caso('L10', function (callable $verificar) use ($cuentasDelLibre): void {
    $usuario = nuevoUsuario();
    verificarEquivalencia($verificar, $usuario, INSTANTE_BASE, 'SIN_PLAN', 'NUNCA_TUVO_PLAN');
    $verificar(lectorEn(INSTANTE_BASE)->leer($usuario)['limites']['numCuentas'] === $cuentasDelLibre, 'límites del Libre');
});

caso('L11', function (callable $verificar) use ($combinacionBasico, $cuentasDelLibre): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'P', '2026-05-30', '2026-12-30');
    verificarEquivalencia($verificar, $usuario, INSTANTE_BASE, 'SIN_PLAN', 'NUNCA_TUVO_PLAN');
    $verificar(lectorEn(INSTANTE_BASE)->leer($usuario)['limites']['numCuentas'] === $cuentasDelLibre, 'límites del Libre');
});

caso('L12', function (callable $verificar) use ($combinacionLibre, $combinacionBasico, $horasLibre): void {
    $usuario = nuevoUsuario();
    $fin = sumarHoras(INSTANTE_BASE, $horasLibre);
    nuevaSuscripcion($usuario, $combinacionLibre, 'A', '2026-06-01', substr($fin, 0, 10), $fin);
    nuevaSuscripcion($usuario, $combinacionBasico, 'P', '2026-05-30', '2026-12-30');
    verificarEquivalencia($verificar, $usuario, INSTANTE_BASE, 'LIBRE', null);
});

caso('L13', function (callable $verificar) use ($combinacionBasico): void {
    foreach (ZONAS_HORARIAS as $zona) {
        date_default_timezone_set($zona);
        [$usuario] = renovacionPendiente($combinacionBasico);
        verificarEquivalencia($verificar, $usuario, '2026-07-10 23:59:59', 'SIN_PLAN', 'PLAN_PAGO_VENCIDO', "$zona:");
    }
});

caso('L14', function (callable $verificar) use ($combinacionBasico, $cuentasDelLibre): void {
    foreach (ZONAS_HORARIAS as $zona) {
        date_default_timezone_set($zona);
        [$usuario] = renovacionPendiente($combinacionBasico);
        $lectura = lectorEn('2026-07-11 00:00:00')->leer($usuario);
        $verificar($lectura['estado'] === 'LIBRE' && $lectura['pasos'] !== [], "$zona: la lectura no anticipa el Libre");
        $verificar($lectura['limites']['numCuentas'] === $cuentasDelLibre, "$zona: límites del Libre");
        verificarEquivalencia($verificar, $usuario, '2026-07-11 00:00:00', 'LIBRE', null, "$zona:");
    }
});

caso('L15', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario, $idRenovacion] = renovacionPendiente($combinacionBasico);
    nuevoPago($idRenovacion, 'R');
    verificarEquivalencia($verificar, $usuario, '2026-07-11 00:00:00', 'SIN_PLAN', 'PLAN_PAGO_VENCIDO');
});

caso('L16', function (callable $verificar) use ($combinacionBasico, $combinacionPremium): void {
    $usuario = nuevoUsuario();
    nuevaSuscripcion($usuario, $combinacionBasico, 'A', '2026-05-10', '2026-06-10', null, 1);
    $idProgramada = nuevaSuscripcion($usuario, $combinacionPremium, 'P', '2026-06-11', '2026-07-10', null, 1);
    nuevoPago($idProgramada, 'C');
    $antes = lectorEn('2026-06-05 00:00:00')->leer($usuario);
    $verificar($antes['estado'] === 'PAGO' && idPlanDe($antes) === 2, 'presente');
    verificarEquivalencia($verificar, $usuario, '2026-06-11 00:00:00', 'PAGO', null, 'programada:');
    $despues = lectorEn('2026-06-11 00:00:00')->leer($usuario);
    $verificar(idPlanDe($despues) === 3, 'plan programado ' . var_export(idPlanDe($despues), true));
    $verificar($despues['limites']['numCuentas'] === (int) escalar('SELECT pla_numCuentas FROM spsu_planes WHERE pla_idPlan = 3'), 'límites del programado');
});

caso('L17', function (callable $verificar) use ($combinacionBasico): void {
    [$usuario] = renovacionPendiente($combinacionBasico);
    verificarEquivalencia($verificar, $usuario, '2026-08-09 12:00:00', 'LIBRE', null);
});

caso('L18', function (callable $verificar) use ($combinacionBasico, $horasLibre): void {
    [$usuario] = renovacionPendiente($combinacionBasico);
    servicioEn('2026-07-11 00:00:00')->resolver($usuario);
    $filasAntes = (int) escalar('SELECT COUNT(*) FROM spsu_suscripcion WHERE sus_usuarioId = ?', 'i', $usuario);
    $vencido = sumarHoras('2026-07-11 00:00:00', $horasLibre);
    verificarEquivalencia($verificar, $usuario, $vencido, 'SIN_PLAN', 'LIBRE_TERMINADO');
    $filasDespues = (int) escalar('SELECT COUNT(*) FROM spsu_suscripcion WHERE sus_usuarioId = ?', 'i', $usuario);
    $verificar($filasAntes === $filasDespues, 'se creó otra fila al vencer el Libre por anulación');
});

limpiarFixtures();
$restantes = (int) escalar('SELECT COUNT(*) FROM sgen_usuario WHERE usu_usuario REGEXP ?', 's', '^' . PREFIJO_FIXTURE);
echo 'FIXTURES restantes: ' . $restantes . "\n";
echo 'RESUMEN casos=' . $totalCasos . ' fallos=' . count($fallos) . "\n";
exit($fallos === [] && $restantes === 0 ? 0 : 1);
