<?php

declare(strict_types=1);

/**
 * Prueba con reloj simulado de MejoraPlanSrv (HLT-17-v4, casos M01 a M07).
 * Solo se ejecuta por línea de comandos: C:\xampp\php\php.exe anexos\pruebas\mejora_plan_reloj.php
 * Crea usuarios, suscripciones y pagos fixture con el prefijo ck_prueba_hu4_ y los borra al terminar.
 * Imprime PASS Mnn o FAIL Mnn y termina con código 0 solo si todos pasan.
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
require_once $raizServicio . '/servicios/MejoraPlanSrv.php';

const PREFIJO_FIXTURE = 'ck_prueba_hu4_';
const ZONAS_HORARIAS = ['Europe/Berlin', 'America/Guayaquil', 'Pacific/Kiritimati'];
const COMBINACION_PRUEBA = 17;
const COMBINACION_MENSUAL = 2;
const COMBINACION_TRIMESTRAL = 3;
const COMBINACION_ANUAL = 5;
const COMBINACION_OTRA_MENSUAL = 7;
const PNG_MINIMO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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

function instante(string $texto, string $zona = 'UTC'): DateTimeImmutable
{
    return (new DateTimeImmutable($texto, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone($zona));
}

function servicioEn(string $texto, string $zona = 'UTC'): MejoraPlanSrv
{
    global $enlace;
    $momento = instante($texto, $zona);
    return new MejoraPlanSrv($enlace, function () use ($momento): DateTimeImmutable {
        return $momento;
    });
}

function sumarMeses(string $fecha, int $meses): string
{
    return (new DateTimeImmutable($fecha, new DateTimeZone('UTC')))->modify('+' . $meses . ' month')->format('Y-m-d');
}

function sumarDias(string $fecha, int $dias): string
{
    return (new DateTimeImmutable($fecha, new DateTimeZone('UTC')))->modify(($dias >= 0 ? '+' : '') . $dias . ' day')->format('Y-m-d');
}

function mesesDe(int $combinacion): int
{
    return (int) fila(
        'SELECT ins.ins_numMeses AS meses FROM spsu_planintervalo plin
         INNER JOIN spsu_intervalosuscr ins ON ins.ins_idInterSuscrip = plin.pins_idInterSuscrip
         WHERE plin.pin_idPlanInterv = ?',
        'i',
        $combinacion
    )['meses'];
}

function precioDe(int $combinacion): float
{
    return (float) fila('SELECT pin_precioFinal AS precio FROM spsu_planintervalo WHERE pin_idPlanInterv = ?', 'i', $combinacion)['precio'];
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
    $nombre = PREFIJO_FIXTURE . 'm' . getmypid() . '_' . $contador;
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

/**
 * Suscripción P con su pago R como los deja crearConPago al subir el comprobante:
 * inicio = día de la subida, corte = inicio + meses del intervalo, próximo pago = corte - 1 día.
 *
 * @return array{suscripcion:int, pago:int, inicio:string, fin:string, proximo:string}
 */
function nuevoPagoSubido(int $idUsuario, int $combinacion, string $diaSubida, ?string $fechaFinForzada = null): array
{
    global $enlace;
    static $contador = 0;
    $contador++;
    $fin = $fechaFinForzada ?? sumarMeses($diaSubida, mesesDe($combinacion));
    $proximo = sumarDias($fin, -1);
    $transaccion = PREFIJO_FIXTURE . 'tx' . getmypid() . '_' . $contador;
    $idSuscripcion = $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion,
         sus_referenPago, sus_renovAutomatica, sus_proximoPago, sus_fechaCrea, sus_fechaCambio)
         VALUES (?, ?, ?, ?, \'P\', ?, 1, ?, ?, ?)',
        'iissssss',
        $idUsuario,
        $combinacion,
        $diaSubida,
        $fin,
        $transaccion,
        $proximo,
        $diaSubida,
        $diaSubida . ' 00:00:00'
    );
    $idPago = $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_pagos (pag_susIdSuscri, pag_monto, pag_fechaPago, pag_metodoPago, pag_idTransac,
         pag_situacion, pag_pagoDesde, pag_pagoHasta, pag_imagen)
         VALUES (?, ?, ?, \'CRIPTOMONEDA\', ?, \'R\', ?, ?, ?)',
        'idsssss',
        $idSuscripcion,
        precioDe($combinacion),
        $diaSubida . ' 10:00:00',
        $transaccion,
        $diaSubida . ' 00:00:00',
        $fin . ' 00:00:00',
        PNG_MINIMO
    );
    return ['suscripcion' => $idSuscripcion, 'pago' => $idPago, 'inicio' => $diaSubida, 'fin' => $fin, 'proximo' => $proximo];
}

function nuevoPresente(int $idUsuario, int $combinacion, string $fechaFin, int $renovacion): int
{
    global $enlace;
    $inicio = sumarMeses($fechaFin, -mesesDe($combinacion));
    return $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion,
         sus_referenPago, sus_renovAutomatica, sus_proximoPago, sus_fechaCrea, sus_fechaCambio)
         VALUES (?, ?, ?, ?, \'A\', \'fixture\', ?, ?, ?, ?)',
        'iississs',
        $idUsuario,
        $combinacion,
        $inicio,
        $fechaFin,
        $renovacion,
        sumarDias($fechaFin, -1),
        $inicio,
        $inicio . ' 00:00:00'
    );
}

function nuevaPrueba(int $idUsuario, string $horaFin): int
{
    global $enlace;
    return $enlace->ejecutarInsercionRetornaID(
        'INSERT INTO spsu_suscripcion (sus_usuarioId, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_fechaHoraFin,
         sus_situacion, sus_renovAutomatica, sus_fechaCrea, sus_fechaCambio)
         VALUES (?, ?, \'2026-06-09\', \'2026-06-11\', ?, \'A\', 0, \'2026-06-09\', \'2026-06-09 00:00:00\')',
        'iis',
        $idUsuario,
        COMBINACION_PRUEBA,
        $horaFin
    );
}

function suscripcion(int $id): array
{
    return fila(
        'SELECT sis_idSuscrip, sus_pinIdPlanin, sus_fechainicio, sus_fechaFin, sus_situacion, sus_renovAutomatica,
         sus_proximoPago FROM spsu_suscripcion WHERE sis_idSuscrip = ?',
        'i',
        $id
    );
}

function pagoDe(int $id): array
{
    return fila(
        'SELECT pag_situacion, pag_montoConfirmado, pag_monto, pag_pagoDesde, pag_pagoHasta FROM spsu_pagos WHERE pag_idPago = ?',
        'i',
        $id
    );
}

function huella(array $pagoSubido): string
{
    return md5(json_encode([suscripcion($pagoSubido['suscripcion']), pagoDe($pagoSubido['pago'])]));
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
$administrador = nuevoUsuario();

// M01 (DT-16, primer corte): plan mensual subido hace 3 días y validado hoy conserva las fechas de la subida.
caso('M01', function (callable $verificar) use ($administrador): void {
    $dueno = nuevoUsuario();
    $pago = nuevoPagoSubido($dueno, COMBINACION_MENSUAL, '2026-06-07');
    $respuesta = servicioEn('2026-06-10 12:00:00')->confirmar($pago['pago'], $administrador);
    $verificar($respuesta['resultado'] === MejoraPlanSrv::RESULTADO_OK, 'resultado ' . $respuesta['resultado']);
    $suscripcion = suscripcion($pago['suscripcion']);
    $verificar($suscripcion['sus_situacion'] === 'A', 'situación A');
    $verificar($suscripcion['sus_fechainicio'] === '2026-06-07' && $suscripcion['sus_fechaFin'] === '2026-07-07', 'inicio y corte de la subida');
    $verificar($suscripcion['sus_proximoPago'] === '2026-07-06', 'próximo pago = corte - 1 día');
    $pagoFila = pagoDe($pago['pago']);
    $verificar($pagoFila['pag_pagoDesde'] === '2026-06-07 00:00:00' && $pagoFila['pag_pagoHasta'] === '2026-07-07 00:00:00', 'desde/hasta sin cambio');
    $verificar($suscripcion['sus_fechaFin'] !== '2026-07-10', 'no es validación + 1 mes');
    $verificar($pagoFila['pag_situacion'] === 'C' && (float) $pagoFila['pag_montoConfirmado'] === (float) $pagoFila['pag_monto'], 'pago confirmado');
});

// M02: límite exacto de RN-24 en tres zonas horarias (el instante es el mismo UTC, la zona no cambia el resultado).
caso('M02', function (callable $verificar) use ($administrador): void {
    foreach (ZONAS_HORARIAS as $zona) {
        $dueno = nuevoUsuario();
        $pago = nuevoPagoSubido($dueno, COMBINACION_MENSUAL, '2026-05-10', '2026-06-10');
        $respuesta = servicioEn('2026-06-10 23:59:59', $zona)->confirmar($pago['pago'], $administrador);
        $verificar($respuesta['resultado'] === MejoraPlanSrv::RESULTADO_OK, "$zona: corte = hoy a las 23:59:59 confirma (" . $respuesta['resultado'] . ')');

        $otro = nuevoUsuario();
        $pagoTarde = nuevoPagoSubido($otro, COMBINACION_MENSUAL, '2026-05-10', '2026-06-10');
        $antes = huella($pagoTarde);
        $respuestaTarde = servicioEn('2026-06-11 00:00:00', $zona)->confirmar($pagoTarde['pago'], $administrador);
        $verificar($respuestaTarde['resultado'] === MejoraPlanSrv::RESULTADO_COMPROBANTE_ANTIGUO, "$zona: a las 00:00:00 del día siguiente 409 (" . $respuestaTarde['resultado'] . ')');
        $verificar($antes === huella($pagoTarde), "$zona: nada cambia");

        $ayer = nuevoUsuario();
        $pagoAyer = nuevoPagoSubido($ayer, COMBINACION_MENSUAL, '2026-05-09', '2026-06-09');
        $respuestaAyer = servicioEn('2026-06-10 00:00:00', $zona)->confirmar($pagoAyer['pago'], $administrador);
        $verificar($respuestaAyer['resultado'] === MejoraPlanSrv::RESULTADO_COMPROBANTE_ANTIGUO, "$zona: corte = ayer 409");
    }
});

// M03: comprobante mensual de hace 40 días falla; trimestral de hace 40 días confirma y conserva las fechas.
caso('M03', function (callable $verificar) use ($administrador): void {
    $duenoMensual = nuevoUsuario();
    $pagoMensual = nuevoPagoSubido($duenoMensual, COMBINACION_MENSUAL, '2026-05-01');
    $antes = huella($pagoMensual);
    $respuestaMensual = servicioEn('2026-06-10 12:00:00')->confirmar($pagoMensual['pago'], $administrador);
    $verificar($respuestaMensual['resultado'] === MejoraPlanSrv::RESULTADO_COMPROBANTE_ANTIGUO && $antes === huella($pagoMensual), 'mensual 409 sin cambios');

    $duenoTrimestral = nuevoUsuario();
    $pagoTrimestral = nuevoPagoSubido($duenoTrimestral, COMBINACION_TRIMESTRAL, '2026-05-01');
    $respuestaTrimestral = servicioEn('2026-06-10 12:00:00')->confirmar($pagoTrimestral['pago'], $administrador);
    $suscripcion = suscripcion($pagoTrimestral['suscripcion']);
    $verificar($respuestaTrimestral['resultado'] === MejoraPlanSrv::RESULTADO_OK, 'trimestral confirma');
    $verificar($suscripcion['sus_fechainicio'] === '2026-05-01' && $suscripcion['sus_fechaFin'] === '2026-08-01', 'fechas de la subida conservadas');
});

// M04: la prueba vigente pasa a C y la vencida a E (RN-10).
caso('M04', function (callable $verificar) use ($administrador): void {
    $duenoVigente = nuevoUsuario();
    $pruebaVigente = nuevaPrueba($duenoVigente, '2026-06-10 18:00:00');
    $pagoVigente = nuevoPagoSubido($duenoVigente, COMBINACION_MENSUAL, '2026-06-10');
    $respuesta = servicioEn('2026-06-10 12:00:00')->confirmar($pagoVigente['pago'], $administrador);
    $verificar($respuesta['resultado'] === MejoraPlanSrv::RESULTADO_OK && suscripcion($pruebaVigente)['sus_situacion'] === 'C', 'vigente a C');
    $verificar(($respuesta['datos']['suscripcionesCanceladas'] ?? []) === [$pruebaVigente], 'ids cancelados');

    $duenoVencido = nuevoUsuario();
    $pruebaVencida = nuevaPrueba($duenoVencido, '2026-06-10 06:00:00');
    $pagoVencido = nuevoPagoSubido($duenoVencido, COMBINACION_MENSUAL, '2026-06-10');
    servicioEn('2026-06-10 12:00:00')->confirmar($pagoVencido['pago'], $administrador);
    $verificar(suscripcion($pruebaVencida)['sus_situacion'] === 'E', 'vencida a E');
});

// M05: la hora de la validación no interviene en las fechas.
caso('M05', function (callable $verificar) use ($administrador): void {
    $fechasObtenidas = [];
    foreach (['2026-06-10 23:59:59', '2026-06-11 00:00:00'] as $momento) {
        $dueno = nuevoUsuario();
        $pago = nuevoPagoSubido($dueno, COMBINACION_TRIMESTRAL, '2026-06-09');
        $respuesta = servicioEn($momento)->confirmar($pago['pago'], $administrador);
        $verificar($respuesta['resultado'] === MejoraPlanSrv::RESULTADO_OK, "confirma a $momento");
        $suscripcion = suscripcion($pago['suscripcion']);
        $fechasObtenidas[] = [$suscripcion['sus_fechainicio'], $suscripcion['sus_fechaFin'], $suscripcion['sus_proximoPago']];
    }
    $verificar($fechasObtenidas[0] === $fechasObtenidas[1] && $fechasObtenidas[0][0] === '2026-06-09', 'mismas fechas');
});

// M06: pago anticipado, presente con corte a fin de mes; mensual, trimestral y anual; renovación heredada.
caso('M06', function (callable $verificar) use ($administrador): void {
    $esperados = [
        COMBINACION_MENSUAL => ['2026-02-01', '2026-03-01', '2026-02-28'],
        COMBINACION_TRIMESTRAL => ['2026-02-01', '2026-05-01', '2026-04-30'],
        COMBINACION_ANUAL => ['2026-02-01', '2027-02-01', '2027-01-31'],
    ];
    foreach ($esperados as $combinacion => [$inicio, $fin, $proximo]) {
        foreach ([0, 1] as $renovacion) {
            $dueno = nuevoUsuario();
            $presente = nuevoPresente($dueno, $combinacion, '2026-01-31', $renovacion);
            $antesPresente = suscripcion($presente);
            $pago = nuevoPagoSubido($dueno, $combinacion, '2026-01-20');
            $respuesta = servicioEn('2026-01-20 12:00:00')->confirmar($pago['pago'], $administrador);
            $etiqueta = "combinación $combinacion renov $renovacion";
            $verificar($respuesta['resultado'] === MejoraPlanSrv::RESULTADO_OK
                && ($respuesta['datos']['tipo'] ?? '') === MejoraPlanSrv::TIPO_ANTICIPADO, "$etiqueta: anticipado");
            $suscripcion = suscripcion($pago['suscripcion']);
            $verificar($suscripcion['sus_situacion'] === 'P' && $suscripcion['sus_fechainicio'] === $inicio
                && $suscripcion['sus_fechaFin'] === $fin && $suscripcion['sus_proximoPago'] === $proximo, "$etiqueta: fechas " . json_encode($suscripcion));
            $verificar((int) $suscripcion['sus_renovAutomatica'] === $renovacion, "$etiqueta: renovación heredada");
            $verificar($antesPresente === suscripcion($presente), "$etiqueta: la presente no cambia");
            $pagoFila = pagoDe($pago['pago']);
            $verificar($pagoFila['pag_situacion'] === 'C' && $pagoFila['pag_pagoDesde'] === $inicio . ' 00:00:00', "$etiqueta: pago con el periodo");
        }
    }
});

// M07: límite entre PRIMER_CORTE y ANTICIPADO en tres zonas; presente de otra combinación.
caso('M07', function (callable $verificar) use ($administrador): void {
    foreach (ZONAS_HORARIAS as $zona) {
        $dueno = nuevoUsuario();
        nuevoPresente($dueno, COMBINACION_MENSUAL, '2026-06-10', 1);
        $pago = nuevoPagoSubido($dueno, COMBINACION_MENSUAL, '2026-06-10');
        $respuesta = servicioEn('2026-06-10 23:59:59', $zona)->confirmar($pago['pago'], $administrador);
        $verificar(($respuesta['datos']['tipo'] ?? '') === MejoraPlanSrv::TIPO_ANTICIPADO, "$zona: corte presente = hoy 23:59:59 es anticipado");

        $otro = nuevoUsuario();
        nuevoPresente($otro, COMBINACION_MENSUAL, '2026-06-10', 1);
        $pagoOtro = nuevoPagoSubido($otro, COMBINACION_MENSUAL, '2026-06-10');
        $respuestaOtro = servicioEn('2026-06-11 00:00:00', $zona)->confirmar($pagoOtro['pago'], $administrador);
        $verificar(($respuestaOtro['datos']['tipo'] ?? '') === MejoraPlanSrv::TIPO_PRIMER_CORTE, "$zona: presente vencido pero A es primer corte (" . $respuestaOtro['resultado'] . ')');
    }
    $duenoOtra = nuevoUsuario();
    nuevoPresente($duenoOtra, COMBINACION_OTRA_MENSUAL, '2026-06-20', 1);
    $pagoOtra = nuevoPagoSubido($duenoOtra, COMBINACION_MENSUAL, '2026-06-10');
    $antes = huella($pagoOtra);
    $respuestaOtra = servicioEn('2026-06-10 12:00:00')->confirmar($pagoOtra['pago'], $administrador);
    $verificar($respuestaOtra['resultado'] === MejoraPlanSrv::RESULTADO_OTRA_COMBINACION && $antes === huella($pagoOtra), 'otra combinación 409 sin cambios');
});

$restantes = limpiarFixtures();
echo 'FIXTURES restantes: ' . $restantes . "\n";
echo 'RESUMEN casos=' . $totalCasos . ' fallos=' . count($fallos) . "\n";
exit($fallos === [] && $restantes === 0 ? 0 : 1);
