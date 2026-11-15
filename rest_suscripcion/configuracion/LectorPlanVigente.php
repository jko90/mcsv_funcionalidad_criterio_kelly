<?php

declare(strict_types=1);

/**
 * Regla única del plan vigente (HU-004 / HU-005). Es de solo lectura: lee las suscripciones del usuario y
 * simula en memoria la cadena completa de transiciones, devolviendo los pasos que habría que aplicar.
 * Solo depende de Enlace y de DateTimeImmutable (reloj UTC inyectable), para copiarse sin cambios a otros servicios.
 *
 * Reglas: la prueba vencida pasa a Libre; el Libre vencido termina; el plan de pago se corta al llegar su fecha
 * de corte y, con renovación automática, deja una renovación pendiente con plazo de 30 días; la renovación sin
 * pago al terminar el plazo se anula y concede un Libre nuevo; un periodo pagado por anticipado se activa al corte.
 */
final class LectorPlanVigente
{
    public const DIAS_PLAZO_RENOVACION = 30;
    public const MAXIMO_PASOS = 12;

    public const ESTADO_PRUEBA = 'PRUEBA';
    public const ESTADO_LIBRE = 'LIBRE';
    public const ESTADO_PAGO = 'PAGO';
    public const ESTADO_SIN_PLAN = 'SIN_PLAN';

    public const MOTIVO_PLAN_PAGO_VENCIDO = 'PLAN_PAGO_VENCIDO';
    public const MOTIVO_LIBRE_TERMINADO = 'LIBRE_TERMINADO';
    public const MOTIVO_NUNCA_TUVO_PLAN = 'NUNCA_TUVO_PLAN';

    public const PASO_EXPIRAR_PRUEBA = 'EXPIRAR_PRUEBA';
    public const PASO_EXPIRAR_LIBRE = 'EXPIRAR_LIBRE';
    public const PASO_CREAR_LIBRE = 'CREAR_LIBRE';
    public const PASO_CORTAR_PAGO = 'CORTAR_PAGO';
    public const PASO_ACTIVAR_PROGRAMADA = 'ACTIVAR_PROGRAMADA';
    public const PASO_CREAR_RENOVACION = 'CREAR_RENOVACION';
    public const PASO_ANULAR_RENOVACION = 'ANULAR_RENOVACION';

    public const ORIGEN_LIBRE_PRUEBA = 'PRUEBA';
    public const ORIGEN_LIBRE_ANULACION = 'ANULACION';

    private const ACCION_HISTORIAL_RENOVACION = 'renovacion';
    private const FORMATO_FECHA = 'Y-m-d';
    private const FORMATO_FECHA_HORA = 'Y-m-d H:i:s';

    private const COLUMNAS_PLAN = 'pla.pla_idPlan, pla.pla_nombre, pla.pla_precioBase, pla.pla_horasDuracion,
        pla.pla_planSiguienteId, pla.pla_numCuentas, pla.pla_diasHistorial, pla.pla_diasTotales,
        pla.pla_bloqueoDias, pla.pla_puedeDescargar, pla.pla_descargaTodos, pla.pla_rangoLibre,
        pla.pla_puedeGraficar, pla.pla_divisorEditable, pla.pla_maxOperacionesDiarias';

    /** Todas las suscripciones del usuario con su plan, incluidas las pendientes. Sin bloqueo propio. */
    public const SQL_FILAS_USUARIO = "SELECT sus.sis_idSuscrip, sus.sus_usuarioId, sus.sus_pinIdPlanin,
        sus.sus_fechainicio, sus.sus_fechaFin, sus.sus_fechaHoraFin, sus.sus_situacion,
        sus.sus_renovAutomatica, plin.pin_precioFinal, ins.ins_nombre, ins.ins_numMeses,
        pla.pla_idPlan, pla.pla_nombre, pla.pla_precioBase, pla.pla_horasDuracion,
        pla.pla_planSiguienteId, pla.pla_numCuentas, pla.pla_diasHistorial, pla.pla_diasTotales,
        pla.pla_bloqueoDias, pla.pla_puedeDescargar, pla.pla_descargaTodos, pla.pla_rangoLibre,
        pla.pla_puedeGraficar, pla.pla_divisorEditable, pla.pla_maxOperacionesDiarias,
        EXISTS (SELECT 1 FROM spsu_historialsuscri his
            WHERE his.his_sisIdSuscrip = sus.sis_idSuscrip AND his.his_accion = 'renovacion') AS esRenovacion,
        (SELECT ori.sis_idSuscrip FROM spsu_suscripcion ori
            WHERE ori.sus_usuarioId = sus.sus_usuarioId AND ori.sus_pinIdPlanin = sus.sus_pinIdPlanin
            AND ori.sus_situacion = 'E' AND ori.sis_idSuscrip < sus.sis_idSuscrip
            ORDER BY ori.sis_idSuscrip DESC LIMIT 1) AS idOrigen,
        (SELECT ori.sus_fechaFin FROM spsu_suscripcion ori
            WHERE ori.sus_usuarioId = sus.sus_usuarioId AND ori.sus_pinIdPlanin = sus.sus_pinIdPlanin
            AND ori.sus_situacion = 'E' AND ori.sis_idSuscrip < sus.sis_idSuscrip
            ORDER BY ori.sis_idSuscrip DESC LIMIT 1) AS fechaCorteOrigen,
        EXISTS (SELECT 1 FROM spsu_pagos pag
            WHERE pag.pag_susIdSuscri = sus.sis_idSuscrip AND pag.pag_situacion = 'C') AS tienePagoConfirmado,
        EXISTS (SELECT 1 FROM spsu_pagos pag
            WHERE pag.pag_susIdSuscri = sus.sis_idSuscrip AND pag.pag_situacion = 'R') AS tienePagoEnRevision
        FROM spsu_suscripcion sus
        INNER JOIN spsu_planintervalo plin ON plin.pin_idPlanInterv = sus.sus_pinIdPlanin
        INNER JOIN spsu_intervalosuscr ins ON ins.ins_idInterSuscrip = plin.pins_idInterSuscrip
        INNER JOIN spsu_planes pla ON pla.pla_idPlan = plin.pin_plaIdPlan
        WHERE sus.sus_usuarioId = ?
        ORDER BY sus.sis_idSuscrip ASC";

    /** Plan Libre hallado por datos: el plan siguiente del plan de prueba, con su combinación activa de menor id. */
    public const SQL_PLAN_LIBRE = "SELECT pla.pla_idPlan, pla.pla_nombre, pla.pla_precioBase, pla.pla_horasDuracion,
        pla.pla_planSiguienteId, pla.pla_numCuentas, pla.pla_diasHistorial, pla.pla_diasTotales,
        pla.pla_bloqueoDias, pla.pla_puedeDescargar, pla.pla_descargaTodos, pla.pla_rangoLibre,
        pla.pla_puedeGraficar, pla.pla_divisorEditable, pla.pla_maxOperacionesDiarias,
        plin.pin_idPlanInterv, plin.pin_precioFinal, ins.ins_nombre, ins.ins_numMeses
        FROM spsu_planes prueba
        INNER JOIN spsu_planes pla ON pla.pla_idPlan = prueba.pla_planSiguienteId
        INNER JOIN spsu_planintervalo plin ON plin.pin_plaIdPlan = pla.pla_idPlan AND plin.pin_estado = '1'
        INNER JOIN spsu_intervalosuscr ins ON ins.ins_idInterSuscrip = plin.pins_idInterSuscrip
        WHERE prueba.pla_horasDuracion IS NOT NULL AND prueba.pla_planSiguienteId IS NOT NULL
        AND prueba.pla_estado = '1'
        ORDER BY prueba.pla_idPlan ASC, plin.pin_idPlanInterv ASC
        LIMIT 1";

    private Enlace $enlace;
    private ?Closure $reloj;

    public function __construct(Enlace $enlace, ?Closure $reloj = null)
    {
        $this->enlace = $enlace;
        $this->reloj = $reloj;
    }

    public function ahora(): DateTimeImmutable
    {
        $instante = $this->reloj !== null ? ($this->reloj)() : new DateTimeImmutable('now', self::zonaUtc());
        return $instante->setTimezone(self::zonaUtc());
    }

    /** Lee sin bloqueo y evalúa con el reloj del lector. */
    public function leer(int $idUsuario): array
    {
        $resultadoFilas = $this->enlace->ejecutarConsulta(self::SQL_FILAS_USUARIO, 'i', $idUsuario);
        $filas = $resultadoFilas ? $resultadoFilas->fetch_all(MYSQLI_ASSOC) : [];
        return $this->evaluar($filas, $this->ahora(), $this->leerPlanLibre());
    }

    public function leerPlanLibre(): ?array
    {
        return $this->enlace->ejecutarConsultaSimpleFila(self::SQL_PLAN_LIBRE);
    }

    /**
     * Función pura: simula la cadena de transiciones sobre una copia de las filas (con identificadores
     * virtuales negativos para lo que se crea) hasta que no queda ningún paso.
     *
     * @param array<int, array<string, mixed>> $filas
     * @return array{estado:string, motivoSinPlan:?string, filaVigente:?array, pasos:array, limites:array,
     *     planPendiente:?array, planProgramado:?array, planLibre:?array}
     */
    public function evaluar(array $filas, DateTimeImmutable $ahora, ?array $planLibre): array
    {
        $ahora = $ahora->setTimezone(self::zonaUtc());
        $trabajo = $this->normalizarFilas($filas);
        $secuencia = ['virtual' => 0, 'orden' => $this->mayorOrden($trabajo)];
        $pasos = [];

        while ($this->aplicarSiguienteRegla($trabajo, $ahora, $planLibre, $secuencia, $pasos)) {
            if (count($pasos) > self::MAXIMO_PASOS) {
                throw new RuntimeException('La evaluación del plan superó el máximo de pasos');
            }
        }

        $filaVigente = $this->elegirFilaVigente($trabajo, $ahora);
        $estado = $this->estadoDeFila($filaVigente);
        $limites = $this->limitesDeFila($filaVigente ?? $this->exigirPlanLibre($planLibre));

        return [
            'estado' => $estado,
            'motivoSinPlan' => $estado === self::ESTADO_SIN_PLAN ? $this->motivoSinPlan($trabajo) : null,
            'filaVigente' => $filaVigente,
            'pasos' => $pasos,
            'limites' => $limites,
            'planPendiente' => $this->construirPlanPendiente($trabajo, $ahora),
            'planProgramado' => $this->construirPlanProgramado($trabajo),
            'planLibre' => $planLibre,
        ];
    }

    /** @return array{numCuentas:int, diasReporte:int, diasAnalisis:?int, maxOperacionesAnalisis:?int,
     *     diasTotalesAnalisis:int, puedeGraficar:bool, puedeDescargar:bool, divisorEditable:bool,
     *     maxOperacionesDiarias:?int} */
    public function limitesDeFila(array $fila): array
    {
        $diasAnalisis = (int) $fila['pla_rangoLibre'] === 1 ? null : (int) $fila['pla_bloqueoDias'];
        return [
            'numCuentas' => (int) $fila['pla_numCuentas'],
            'diasReporte' => (int) $fila['pla_diasHistorial'],
            'diasAnalisis' => $diasAnalisis,
            'maxOperacionesAnalisis' => $diasAnalisis,
            'diasTotalesAnalisis' => (int) $fila['pla_diasTotales'],
            'puedeGraficar' => (int) $fila['pla_puedeGraficar'] === 1,
            'puedeDescargar' => (int) $fila['pla_puedeDescargar'] === 1,
            'divisorEditable' => (int) $fila['pla_divisorEditable'] === 1,
            'maxOperacionesDiarias' => $fila['pla_maxOperacionesDiarias'] === null
                ? null
                : (int) $fila['pla_maxOperacionesDiarias'],
        ];
    }

    /** Último día para pagar una renovación: fecha de corte de la suscripción origen + el plazo fijo. */
    public static function fechaLimiteRenovacion(array $fila): string
    {
        $fechaBase = $fila['fechaCorteOrigen'] ?? $fila['sus_fechaFin'];
        return self::fechaDeTexto((string) $fechaBase)
            ->modify('+' . self::DIAS_PLAZO_RENOVACION . ' day')
            ->format(self::FORMATO_FECHA);
    }

    public static function zonaUtc(): DateTimeZone
    {
        return new DateTimeZone('UTC');
    }

    // ---------------------------------------------------------------- clasificación de filas

    private function esPrueba(array $fila): bool
    {
        return $fila['pla_horasDuracion'] !== null && $fila['pla_planSiguienteId'] !== null;
    }

    private function esLibre(array $fila): bool
    {
        return $fila['pla_horasDuracion'] !== null && $fila['pla_planSiguienteId'] === null;
    }

    private function esDePago(array $fila): bool
    {
        return $fila['pla_horasDuracion'] === null;
    }

    private function esDePagoConPrecio(array $fila): bool
    {
        return $this->esDePago($fila) && (float) $fila['pin_precioFinal'] > 0.0;
    }

    /** Con hora de fin, vence en el instante exacto; sin ella vale hasta el final del día de la fecha de corte. */
    private function estaVencida(array $fila, DateTimeImmutable $ahora): bool
    {
        if ($fila['sus_fechaHoraFin'] !== null) {
            return $ahora >= new DateTimeImmutable((string) $fila['sus_fechaHoraFin'], self::zonaUtc());
        }
        return $ahora->format(self::FORMATO_FECHA) > (string) $fila['sus_fechaFin'];
    }

    private function estaActivaVigente(array $fila, DateTimeImmutable $ahora): bool
    {
        return $fila['sus_situacion'] === 'A' && !$this->estaVencida($fila, $ahora);
    }

    // ---------------------------------------------------------------- reglas de la cadena

    private function aplicarSiguienteRegla(
        array &$filas,
        DateTimeImmutable $ahora,
        ?array $planLibre,
        array &$secuencia,
        array &$pasos
    ): bool {
        return $this->reglaExpirarPrueba($filas, $ahora, $planLibre, $secuencia, $pasos)
            || $this->reglaExpirarLibre($filas, $ahora, $pasos)
            || $this->reglaCortarPago($filas, $ahora, $secuencia, $pasos)
            || $this->reglaAnularRenovacion($filas, $ahora, $planLibre, $secuencia, $pasos);
    }

    private function reglaExpirarPrueba(
        array &$filas,
        DateTimeImmutable $ahora,
        ?array $planLibre,
        array &$secuencia,
        array &$pasos
    ): bool {
        foreach ($filas as $clave => $fila) {
            if ($fila['sus_situacion'] !== 'A' || !$this->esPrueba($fila) || !$this->estaVencida($fila, $ahora)) {
                continue;
            }
            $filas[$clave]['sus_situacion'] = 'E';
            $pasos[] = [
                'tipo' => self::PASO_EXPIRAR_PRUEBA,
                'idSuscripcion' => $fila['sis_idSuscrip'],
            ];
            if (!$this->tieneSuscripcionDePagoActivaOExpirada($filas)) {
                $this->crearLibre(
                    $filas,
                    $ahora,
                    $planLibre,
                    $secuencia,
                    $pasos,
                    self::ORIGEN_LIBRE_PRUEBA,
                    $fila['sis_idSuscrip']
                );
            }
            return true;
        }
        return false;
    }

    private function reglaExpirarLibre(array &$filas, DateTimeImmutable $ahora, array &$pasos): bool
    {
        foreach ($filas as $clave => $fila) {
            if ($fila['sus_situacion'] === 'A' && $this->esLibre($fila) && $this->estaVencida($fila, $ahora)) {
                $filas[$clave]['sus_situacion'] = 'E';
                $pasos[] = [
                    'tipo' => self::PASO_EXPIRAR_LIBRE,
                    'idSuscripcion' => $fila['sis_idSuscrip'],
                ];
                return true;
            }
        }
        return false;
    }

    private function reglaCortarPago(
        array &$filas,
        DateTimeImmutable $ahora,
        array &$secuencia,
        array &$pasos
    ): bool {
        foreach ($filas as $clave => $fila) {
            if ($fila['sus_situacion'] !== 'A' || !$this->esDePago($fila) || !$this->estaVencida($fila, $ahora)) {
                continue;
            }
            $filas[$clave]['sus_situacion'] = 'E';
            $pasos[] = [
                'tipo' => self::PASO_CORTAR_PAGO,
                'idSuscripcion' => $fila['sis_idSuscrip'],
                'cancelado' => (int) $fila['sus_renovAutomatica'] === 0,
            ];
            $this->activarProgramadaOCrearRenovacion($filas, $filas[$clave], $ahora, $secuencia, $pasos);
            return true;
        }
        return false;
    }

    private function activarProgramadaOCrearRenovacion(
        array &$filas,
        array $filaCortada,
        DateTimeImmutable $ahora,
        array &$secuencia,
        array &$pasos
    ): void {
        $claveProgramada = $this->buscarClaveProgramada($filas);
        if ($claveProgramada !== null) {
            $filas[$claveProgramada]['sus_situacion'] = 'A';
            $pasos[] = [
                'tipo' => self::PASO_ACTIVAR_PROGRAMADA,
                'idSuscripcion' => $filas[$claveProgramada]['sis_idSuscrip'],
                'idOrigen' => $filaCortada['sis_idSuscrip'],
            ];
            return;
        }

        $esRenovable = (int) $filaCortada['sus_renovAutomatica'] === 1
            && !$this->existeOtroPagoVigente($filas, $ahora)
            && !$this->existeSuscripcionPendienteDeCombinacion($filas, (int) $filaCortada['sus_pinIdPlanin']);
        if (!$esRenovable) {
            return;
        }

        $fechaCorte = self::fechaDeTexto((string) $filaCortada['sus_fechaFin']);
        $inicio = $fechaCorte->modify('+1 day')->format(self::FORMATO_FECHA);
        $fin = $fechaCorte->modify('+' . self::DIAS_PLAZO_RENOVACION . ' day')->format(self::FORMATO_FECHA);
        $idVirtual = $this->siguienteIdVirtual($secuencia);
        $filaRenovacion = $filaCortada;
        $filaRenovacion['sis_idSuscrip'] = $idVirtual;
        $filaRenovacion['_orden'] = ++$secuencia['orden'];
        $filaRenovacion['sus_situacion'] = 'P';
        $filaRenovacion['sus_fechainicio'] = $inicio;
        $filaRenovacion['sus_fechaFin'] = $fin;
        $filaRenovacion['sus_fechaHoraFin'] = null;
        $filaRenovacion['sus_renovAutomatica'] = 1;
        $filaRenovacion['esRenovacion'] = 1;
        $filaRenovacion['idOrigen'] = $filaCortada['sis_idSuscrip'];
        $filaRenovacion['fechaCorteOrigen'] = $filaCortada['sus_fechaFin'];
        $filaRenovacion['tienePagoConfirmado'] = 0;
        $filaRenovacion['tienePagoEnRevision'] = 0;
        $filas[] = $filaRenovacion;
        $pasos[] = [
            'tipo' => self::PASO_CREAR_RENOVACION,
            'idVirtual' => $idVirtual,
            'idOrigen' => $filaCortada['sis_idSuscrip'],
            'idPlanInterv' => (int) $filaCortada['sus_pinIdPlanin'],
            'fechaInicio' => $inicio,
            'fechaFin' => $fin,
        ];
    }

    private function reglaAnularRenovacion(
        array &$filas,
        DateTimeImmutable $ahora,
        ?array $planLibre,
        array &$secuencia,
        array &$pasos
    ): bool {
        $hoy = $ahora->format(self::FORMATO_FECHA);
        foreach ($filas as $clave => $fila) {
            if (!$this->esRenovacionAnulable($fila, $hoy)) {
                continue;
            }
            $filas[$clave]['sus_situacion'] = 'C';
            $filas[$clave]['sus_renovAutomatica'] = 0;
            $pasos[] = [
                'tipo' => self::PASO_ANULAR_RENOVACION,
                'idSuscripcion' => $fila['sis_idSuscrip'],
                'idOrigen' => $fila['idOrigen'],
            ];
            if (!$this->existeSuscripcionVigente($filas, $ahora)) {
                $this->crearLibre(
                    $filas,
                    $ahora,
                    $planLibre,
                    $secuencia,
                    $pasos,
                    self::ORIGEN_LIBRE_ANULACION,
                    $fila['sis_idSuscrip']
                );
            }
            return true;
        }
        return false;
    }

    private function esRenovacionAnulable(array $fila, string $hoy): bool
    {
        return $fila['sus_situacion'] === 'P'
            && (int) $fila['esRenovacion'] === 1
            && $this->esDePagoConPrecio($fila)
            && (int) $fila['tienePagoEnRevision'] === 0
            && (int) $fila['tienePagoConfirmado'] === 0
            && self::fechaLimiteRenovacion($fila) < $hoy;
    }

    private function crearLibre(
        array &$filas,
        DateTimeImmutable $ahora,
        ?array $planLibre,
        array &$secuencia,
        array &$pasos,
        string $origen,
        int $idOrigen
    ): void {
        $planLibre = $this->exigirPlanLibre($planLibre);
        $instanteFin = $ahora->modify('+' . (int) $planLibre['pla_horasDuracion'] . ' hour');
        $idVirtual = $this->siguienteIdVirtual($secuencia);
        $filaLibre = $planLibre;
        $filaLibre['sis_idSuscrip'] = $idVirtual;
        $filaLibre['_orden'] = ++$secuencia['orden'];
        $filaLibre['sus_usuarioId'] = $filas[0]['sus_usuarioId'] ?? 0;
        $filaLibre['sus_pinIdPlanin'] = (int) $planLibre['pin_idPlanInterv'];
        $filaLibre['sus_fechainicio'] = $ahora->format(self::FORMATO_FECHA);
        $filaLibre['sus_fechaFin'] = $instanteFin->format(self::FORMATO_FECHA);
        $filaLibre['sus_fechaHoraFin'] = $instanteFin->format(self::FORMATO_FECHA_HORA);
        $filaLibre['sus_situacion'] = 'A';
        $filaLibre['sus_renovAutomatica'] = 0;
        $filaLibre['esRenovacion'] = 0;
        $filaLibre['idOrigen'] = null;
        $filaLibre['fechaCorteOrigen'] = null;
        $filaLibre['tienePagoConfirmado'] = 0;
        $filaLibre['tienePagoEnRevision'] = 0;
        $filas[] = $filaLibre;
        $pasos[] = [
            'tipo' => self::PASO_CREAR_LIBRE,
            'origen' => $origen,
            'idOrigen' => $idOrigen,
            'idVirtual' => $idVirtual,
            'idPlanInterv' => (int) $planLibre['pin_idPlanInterv'],
            'fechaInicio' => $ahora->format(self::FORMATO_FECHA),
            'fechaFin' => $instanteFin->format(self::FORMATO_FECHA),
            'fechaHoraFin' => $instanteFin->format(self::FORMATO_FECHA_HORA),
        ];
    }

    // ---------------------------------------------------------------- consultas sobre las filas de trabajo

    private function tieneSuscripcionDePagoActivaOExpirada(array $filas): bool
    {
        foreach ($filas as $fila) {
            if ($this->esDePago($fila) && in_array($fila['sus_situacion'], ['A', 'E'], true)) {
                return true;
            }
        }
        return false;
    }

    private function existeOtroPagoVigente(array $filas, DateTimeImmutable $ahora): bool
    {
        foreach ($filas as $fila) {
            if ($this->esDePago($fila) && $this->estaActivaVigente($fila, $ahora)) {
                return true;
            }
        }
        return false;
    }

    private function existeSuscripcionVigente(array $filas, DateTimeImmutable $ahora): bool
    {
        foreach ($filas as $fila) {
            if ($this->estaActivaVigente($fila, $ahora)) {
                return true;
            }
        }
        return false;
    }

    private function existeSuscripcionPendienteDeCombinacion(array $filas, int $idPlanInterv): bool
    {
        foreach ($filas as $fila) {
            if ($fila['sus_situacion'] === 'P' && (int) $fila['sus_pinIdPlanin'] === $idPlanInterv) {
                return true;
            }
        }
        return false;
    }

    private function esProgramada(array $fila): bool
    {
        return $fila['sus_situacion'] === 'P'
            && $this->esDePagoConPrecio($fila)
            && (int) $fila['tienePagoConfirmado'] === 1
            && (int) $fila['esRenovacion'] === 0;
    }

    /** La programada de menor fecha de inicio (a igual fecha, la de menor orden). */
    private function buscarClaveProgramada(array $filas): ?int
    {
        $claveElegida = null;
        foreach ($filas as $clave => $fila) {
            if (!$this->esProgramada($fila)) {
                continue;
            }
            if ($claveElegida === null
                || (string) $fila['sus_fechainicio'] < (string) $filas[$claveElegida]['sus_fechainicio']) {
                $claveElegida = $clave;
            }
        }
        return $claveElegida;
    }

    // ---------------------------------------------------------------- resultado final

    /** Plan de pago de mayor nivel; si no hay, la prueba; si no, el Libre. */
    private function elegirFilaVigente(array $filas, DateTimeImmutable $ahora): ?array
    {
        $mejorPago = null;
        $mejorPrueba = null;
        $mejorLibre = null;
        foreach ($filas as $fila) {
            if (!$this->estaActivaVigente($fila, $ahora)) {
                continue;
            }
            if ($this->esDePago($fila)) {
                $mejorPago = $this->mejorPlanDePago($mejorPago, $fila);
            } elseif ($this->esPrueba($fila)) {
                $mejorPrueba = $this->masReciente($mejorPrueba, $fila);
            } else {
                $mejorLibre = $this->masReciente($mejorLibre, $fila);
            }
        }
        return $mejorPago ?? $mejorPrueba ?? $mejorLibre;
    }

    private function mejorPlanDePago(?array $actual, array $candidata): array
    {
        if ($actual === null) {
            return $candidata;
        }
        $claveActual = [(float) $actual['pla_precioBase'], (int) $actual['pla_idPlan'], (int) $actual['_orden']];
        $claveCandidata = [(float) $candidata['pla_precioBase'], (int) $candidata['pla_idPlan'], (int) $candidata['_orden']];
        return $claveCandidata > $claveActual ? $candidata : $actual;
    }

    private function masReciente(?array $actual, array $candidata): array
    {
        return $actual === null || (int) $candidata['_orden'] > (int) $actual['_orden'] ? $candidata : $actual;
    }

    private function estadoDeFila(?array $fila): string
    {
        if ($fila === null) {
            return self::ESTADO_SIN_PLAN;
        }
        if ($this->esDePago($fila)) {
            return self::ESTADO_PAGO;
        }
        return $this->esPrueba($fila) ? self::ESTADO_PRUEBA : self::ESTADO_LIBRE;
    }

    /** Se decide por la suscripción expirada más reciente de la cuenta. */
    private function motivoSinPlan(array $filas): string
    {
        $expiradaReciente = null;
        foreach ($filas as $fila) {
            if ($fila['sus_situacion'] === 'E') {
                $expiradaReciente = $this->masReciente($expiradaReciente, $fila);
            }
        }
        if ($expiradaReciente === null) {
            return self::MOTIVO_NUNCA_TUVO_PLAN;
        }
        return $this->esDePago($expiradaReciente)
            ? self::MOTIVO_PLAN_PAGO_VENCIDO
            : self::MOTIVO_LIBRE_TERMINADO;
    }

    private function construirPlanPendiente(array $filas, DateTimeImmutable $ahora): ?array
    {
        $pendiente = null;
        foreach ($filas as $fila) {
            if ($fila['sus_situacion'] === 'P'
                && $this->esDePagoConPrecio($fila)
                && (int) $fila['tienePagoConfirmado'] === 0) {
                $pendiente = $this->masReciente($pendiente, $fila);
            }
        }
        if ($pendiente === null) {
            return null;
        }

        $esRenovacion = (int) $pendiente['esRenovacion'] === 1;
        $fechaLimite = $esRenovacion ? self::fechaLimiteRenovacion($pendiente) : null;
        return [
            'sis_idSuscrip' => (int) $pendiente['sis_idSuscrip'],
            'pin_idPlanInterv' => (int) $pendiente['sus_pinIdPlanin'],
            'pla_nombre' => (string) $pendiente['pla_nombre'],
            'ins_nombre' => (string) $pendiente['ins_nombre'],
            'pin_precioFinal' => (float) $pendiente['pin_precioFinal'],
            'comprobanteEnviado' => (int) $pendiente['tienePagoEnRevision'] === 1,
            'esRenovacion' => $esRenovacion,
            'fechaLimitePago' => $fechaLimite,
            'diasRestantesPago' => $fechaLimite === null ? null : $this->diasHasta($fechaLimite, $ahora),
        ];
    }

    private function construirPlanProgramado(array $filas): ?array
    {
        $clave = $this->buscarClaveProgramada($filas);
        if ($clave === null) {
            return null;
        }
        $fila = $filas[$clave];
        return [
            'sis_idSuscrip' => (int) $fila['sis_idSuscrip'],
            'pin_idPlanInterv' => (int) $fila['sus_pinIdPlanin'],
            'pla_nombre' => (string) $fila['pla_nombre'],
            'ins_nombre' => (string) $fila['ins_nombre'],
            'fechaInicio' => (string) $fila['sus_fechainicio'],
            'fechaFin' => (string) $fila['sus_fechaFin'],
        ];
    }

    private function diasHasta(string $fechaLimite, DateTimeImmutable $ahora): int
    {
        $hoy = self::fechaDeTexto($ahora->format(self::FORMATO_FECHA));
        $diferencia = $hoy->diff(self::fechaDeTexto($fechaLimite));
        return (int) $diferencia->format('%r%a');
    }

    // ---------------------------------------------------------------- utilidades

    private function exigirPlanLibre(?array $planLibre): array
    {
        if ($planLibre === null) {
            throw new RuntimeException('No existe un plan Libre configurado');
        }
        return $planLibre;
    }

    private function siguienteIdVirtual(array &$secuencia): int
    {
        $secuencia['virtual']--;
        return $secuencia['virtual'];
    }

    private static function fechaDeTexto(string $fecha): DateTimeImmutable
    {
        return new DateTimeImmutable(substr($fecha, 0, 10) . ' 00:00:00', self::zonaUtc());
    }

    private function mayorOrden(array $filas): int
    {
        $mayor = 0;
        foreach ($filas as $fila) {
            $mayor = max($mayor, (int) $fila['_orden']);
        }
        return $mayor;
    }

    /** Convierte tipos y fija la clave de orden (el identificador real; los virtuales siguen al mayor). */
    private function normalizarFilas(array $filas): array
    {
        $normalizadas = [];
        foreach ($filas as $fila) {
            $fila['sis_idSuscrip'] = (int) $fila['sis_idSuscrip'];
            $fila['_orden'] = $fila['sis_idSuscrip'];
            $fila['pla_horasDuracion'] = $fila['pla_horasDuracion'] === null ? null : (int) $fila['pla_horasDuracion'];
            $fila['pla_planSiguienteId'] = $fila['pla_planSiguienteId'] === null
                ? null
                : (int) $fila['pla_planSiguienteId'];
            $fila['idOrigen'] = isset($fila['idOrigen']) ? (int) $fila['idOrigen'] : null;
            $fila['sus_fechainicio'] = (string) $fila['sus_fechainicio'];
            $fila['sus_fechaFin'] = (string) $fila['sus_fechaFin'];
            $normalizadas[] = $fila;
        }
        return $normalizadas;
    }
}
