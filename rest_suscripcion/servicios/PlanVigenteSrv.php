<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';
require_once __DIR__ . '/../configuracion/ClienteIp.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../configuracion/LectorPlanVigente.php';
require_once __DIR__ . '/../modelos/SuscripcionMdl.php';
require_once __DIR__ . '/../modelos/HistorialSuscripcionMdl.php';

/**
 * Resuelve el plan vigente de un usuario y aplica las transiciones pendientes. No contiene reglas:
 * decide el LectorPlanVigente y este servicio solo ejecuta sus pasos, en orden, dentro de una transacción.
 */
class PlanVigenteSrv
{
    private const NOMBRE_SERVICIO_AUDITORIA = 'rest_suscripcion';
    private const FORMATO_FECHA_HORA = 'Y-m-d H:i:s';
    private const FORMATO_ISO_UTC = 'Y-m-d\TH:i:s\Z';
    private const SUFIJO_FIN_DE_DIA = 'T23:59:59Z';

    private Enlace $enlace;
    private LectorPlanVigente $lector;
    private SuscripcionMdl $suscripcionModelo;
    private HistorialSuscripcionMdl $historialModelo;

    public function __construct(Enlace $enlace, ?Closure $reloj = null)
    {
        $this->enlace = $enlace;
        $this->lector = new LectorPlanVigente($enlace, $reloj);
        $this->suscripcionModelo = new SuscripcionMdl($enlace);
        $this->historialModelo = new HistorialSuscripcionMdl($enlace);
    }

    /** @return array<string, mixed> objeto PlanVigente del contrato HTTP */
    public function resolver(int $idUsuario): array
    {
        $evaluacion = $this->lector->leer($idUsuario);
        if ($evaluacion['pasos'] !== []) {
            $this->aplicarTransiciones($idUsuario);
            $evaluacion = $this->lector->leer($idUsuario);
        }
        return $this->armarRespuesta($evaluacion, $this->lector->ahora());
    }

    private function aplicarTransiciones(int $idUsuario): void
    {
        $eventos = [];
        $transaccionIniciada = false;
        try {
            $this->enlace->iniciarTransaccion();
            $transaccionIniciada = true;
            if (!$this->suscripcionModelo->bloquearUsuarioActivo($idUsuario)) {
                $this->enlace->revertirTransaccion();
                return;
            }
            $filas = $this->suscripcionModelo->obtenerSuscripcionesConPlan($idUsuario, true);
            $ahora = $this->lector->ahora();
            $evaluacion = $this->lector->evaluar($filas, $ahora, $this->lector->leerPlanLibre());
            $eventos = $this->ejecutarPasos($idUsuario, $evaluacion['pasos'], $ahora);
            $this->enlace->confirmarTransaccion();
            $transaccionIniciada = false;
        } catch (Throwable $error) {
            if ($transaccionIniciada) {
                $this->enlace->revertirTransaccion();
            }
            error_log('[PlanVigenteSrv::resolver] ' . $error->getMessage());
            throw $error;
        }
        $this->registrarAuditoria($idUsuario, $eventos);
    }

    /**
     * @param array<int, array<string, mixed>> $pasos
     * @return array<int, array{evento:string, detalle:string}>
     */
    private function ejecutarPasos(int $idUsuario, array $pasos, DateTimeImmutable $ahora): array
    {
        $idsReales = [];
        $eventos = [];
        $momento = $ahora->format(self::FORMATO_FECHA_HORA);
        foreach ($pasos as $paso) {
            $eventoPaso = match ($paso['tipo']) {
                LectorPlanVigente::PASO_EXPIRAR_PRUEBA => $this->expirar($idUsuario, $paso, $momento, true),
                LectorPlanVigente::PASO_EXPIRAR_LIBRE => $this->expirar($idUsuario, $paso, $momento, false),
                LectorPlanVigente::PASO_CREAR_LIBRE => $this->crearLibre($idUsuario, $paso, $momento, $idsReales),
                LectorPlanVigente::PASO_CORTAR_PAGO => $this->cortarPago($idUsuario, $paso, $momento),
                LectorPlanVigente::PASO_ACTIVAR_PROGRAMADA => $this->activarProgramada($idUsuario, $paso, $momento),
                LectorPlanVigente::PASO_CREAR_RENOVACION => $this->crearRenovacion(
                    $idUsuario,
                    $paso,
                    $momento,
                    $idsReales
                ),
                LectorPlanVigente::PASO_ANULAR_RENOVACION => $this->anularRenovacion(
                    $idUsuario,
                    $paso,
                    $momento,
                    $idsReales
                ),
                default => throw new RuntimeException('Paso de plan desconocido'),
            };
            if ($eventoPaso !== null) {
                $eventos[] = $eventoPaso;
            }
        }
        return $eventos;
    }

    private function expirar(int $idUsuario, array $paso, string $momento, bool $esPrueba): ?array
    {
        $idSuscripcion = (int) $paso['idSuscripcion'];
        $this->suscripcionModelo->actualizarSituacion($idSuscripcion, 'E', $momento);
        $this->historialModelo->registrar(
            $idUsuario,
            $idSuscripcion,
            'EXPIRADA',
            $esPrueba ? 'Prueba expirada' : 'Plan Libre terminado',
            $momento
        );
        return $esPrueba
            ? ['evento' => 'PRUEBA_EXPIRADA', 'detalle' => 'suscripcion=' . $idSuscripcion]
            : null;
    }

    private function crearLibre(int $idUsuario, array $paso, string $momento, array &$idsReales): ?array
    {
        $idNuevo = $this->suscripcionModelo->insertarSuscripcionConHoraFin(
            $idUsuario,
            (int) $paso['idPlanInterv'],
            (string) $paso['fechaInicio'],
            (string) $paso['fechaFin'],
            (string) $paso['fechaHoraFin'],
            substr($momento, 0, 10),
            $momento
        );
        $idsReales[(int) $paso['idVirtual']] = $idNuevo;
        $idOrigen = $this->idReal((int) $paso['idOrigen'], $idsReales);
        $detalle = $paso['origen'] === LectorPlanVigente::ORIGEN_LIBRE_ANULACION
            ? 'Plan Libre por anulación de la renovación ' . $idOrigen
            : 'Plan Libre al terminar la prueba ' . $idOrigen . ', destino ' . $idNuevo;
        $this->historialModelo->registrar($idUsuario, $idNuevo, 'TRANSICION', $detalle, $momento);
        return null;
    }

    private function cortarPago(int $idUsuario, array $paso, string $momento): array
    {
        $idSuscripcion = (int) $paso['idSuscripcion'];
        $this->suscripcionModelo->actualizarSituacion($idSuscripcion, 'E', $momento);
        $this->historialModelo->registrar(
            $idUsuario,
            $idSuscripcion,
            'CORTADA',
            'Plan de pago cortado al terminar su periodo',
            $momento
        );
        return ['evento' => 'PLAN_CORTADO', 'detalle' => 'suscripcion=' . $idSuscripcion];
    }

    private function activarProgramada(int $idUsuario, array $paso, string $momento): array
    {
        $idSuscripcion = (int) $paso['idSuscripcion'];
        $this->suscripcionModelo->actualizarSituacion($idSuscripcion, 'A', $momento);
        $this->historialModelo->registrar(
            $idUsuario,
            $idSuscripcion,
            'ACTIVACION',
            'Periodo programado activado',
            $momento
        );
        return [
            'evento' => 'PLAN_ACTIV_PROGRAM',
            'detalle' => 'origen=' . (int) $paso['idOrigen'] . ' programada=' . $idSuscripcion,
        ];
    }

    private function crearRenovacion(int $idUsuario, array $paso, string $momento, array &$idsReales): array
    {
        $idOrigen = $this->idReal((int) $paso['idOrigen'], $idsReales);
        $idNuevo = $this->suscripcionModelo->insertarRenovacionPendiente(
            $idUsuario,
            (int) $paso['idPlanInterv'],
            (string) $paso['fechaInicio'],
            (string) $paso['fechaFin'],
            substr($momento, 0, 10),
            $momento
        );
        $idsReales[(int) $paso['idVirtual']] = $idNuevo;
        $this->historialModelo->registrar(
            $idUsuario,
            $idNuevo,
            'renovacion',
            'Renovación pendiente de pago de la suscripción ' . $idOrigen,
            $momento
        );
        return ['evento' => 'PLAN_RENOVACION', 'detalle' => 'origen=' . $idOrigen . ' renovacion=' . $idNuevo];
    }

    private function anularRenovacion(int $idUsuario, array $paso, string $momento, array $idsReales): array
    {
        $idRenovacion = $this->idReal((int) $paso['idSuscripcion'], $idsReales);
        $idOrigen = $this->idReal((int) $paso['idOrigen'], $idsReales);
        $this->suscripcionModelo->anularRenovacion($idRenovacion, $momento);
        $this->historialModelo->registrar(
            $idUsuario,
            $idRenovacion,
            'ANULADA',
            'Renovación anulada: plazo de pago vencido de la suscripción ' . $idOrigen,
            $momento
        );
        return [
            'evento' => 'PLAN_RENOV_ANULADA',
            'detalle' => 'origen=' . $idOrigen . ' renovacion=' . $idRenovacion,
        ];
    }

    /** Traduce un identificador virtual (negativo) de la simulación al identificador real creado. */
    private function idReal(int $id, array $idsReales): int
    {
        if ($id >= 0) {
            return $id;
        }
        if (!isset($idsReales[$id])) {
            throw new RuntimeException('Identificador virtual sin resolver');
        }
        return $idsReales[$id];
    }

    /** La auditoría va fuera de la transacción: si falla, solo se registra y la respuesta no cambia. */
    private function registrarAuditoria(int $idUsuario, array $eventos): void
    {
        foreach ($eventos as $evento) {
            try {
                (new RegistroAuditoria($this->enlace, self::NOMBRE_SERVICIO_AUDITORIA))
                    ->registrar($evento['evento'], $idUsuario, null, $evento['detalle']);
            } catch (Throwable $error) {
                error_log('[PlanVigenteSrv::registrarAuditoria] ' . $error->getMessage());
            }
        }
    }

    /** @return array<string, mixed> */
    private function armarRespuesta(array $evaluacion, DateTimeImmutable $ahora): array
    {
        $fila = $evaluacion['filaVigente'];
        $estado = $evaluacion['estado'];
        $esVigente = $fila !== null;
        $esPrueba = $estado === LectorPlanVigente::ESTADO_PRUEBA;
        $esPago = $estado === LectorPlanVigente::ESTADO_PAGO;
        $fechaFinUtc = $esVigente ? $this->fechaFinUtcDeFila($fila, $esPago) : null;

        return [
            'estado' => $estado,
            'vigente' => $esVigente,
            'esPrueba' => $esPrueba,
            'motivoSinPlan' => $evaluacion['motivoSinPlan'],
            'idSuscripcion' => $esVigente ? (int) $fila['sis_idSuscrip'] : null,
            'pin_idPlanInterv' => $esVigente ? (int) $fila['sus_pinIdPlanin'] : null,
            'plan' => $esVigente ? $this->formatearPlan($fila) : null,
            'fechaFinUtc' => $fechaFinUtc,
            'fechaCorte' => $esPago ? (string) $fila['sus_fechaFin'] : null,
            'segundosRestantes' => $fechaFinUtc === null ? null : $this->segundosHasta($fechaFinUtc, $ahora),
            'cancelado' => $esPago && (int) $fila['sus_renovAutomatica'] === 0,
            'planSiguiente' => $esPrueba ? $this->formatearPlanSiguiente($evaluacion['planLibre']) : null,
            'planPendiente' => $evaluacion['planPendiente'],
            'planProgramado' => $evaluacion['planProgramado'],
            'limites' => $evaluacion['limites'],
        ];
    }

    private function fechaFinUtcDeFila(array $fila, bool $esPago): string
    {
        if ($esPago || $fila['sus_fechaHoraFin'] === null) {
            return substr((string) $fila['sus_fechaFin'], 0, 10) . self::SUFIJO_FIN_DE_DIA;
        }
        return (new DateTimeImmutable((string) $fila['sus_fechaHoraFin'], LectorPlanVigente::zonaUtc()))
            ->format(self::FORMATO_ISO_UTC);
    }

    private function segundosHasta(string $fechaFinUtc, DateTimeImmutable $ahora): int
    {
        $instanteFin = new DateTimeImmutable($fechaFinUtc, LectorPlanVigente::zonaUtc());
        return max(0, $instanteFin->getTimestamp() - $ahora->getTimestamp());
    }

    private function formatearPlan(array $fila): array
    {
        return [
            'pla_idPlan' => (int) $fila['pla_idPlan'],
            'pla_nombre' => (string) $fila['pla_nombre'],
            'pla_numCuentas' => (int) $fila['pla_numCuentas'],
            'pla_diasHistorial' => (int) $fila['pla_diasHistorial'],
            'pla_diasTotales' => (int) $fila['pla_diasTotales'],
            'pla_bloqueoDias' => (int) $fila['pla_bloqueoDias'],
            'pla_puedeDescargar' => (int) $fila['pla_puedeDescargar'] === 1,
            'pla_descargaTodos' => (int) $fila['pla_descargaTodos'] === 1,
            'pla_rangoLibre' => (int) $fila['pla_rangoLibre'] === 1,
        ];
    }

    private function formatearPlanSiguiente(?array $planLibre): ?array
    {
        if ($planLibre === null) {
            return null;
        }
        return [
            'pla_idPlan' => (int) $planLibre['pla_idPlan'],
            'pla_nombre' => (string) $planLibre['pla_nombre'],
            'pla_horasDuracion' => (int) $planLibre['pla_horasDuracion'],
        ];
    }
}
