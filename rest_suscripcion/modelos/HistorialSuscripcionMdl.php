<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class HistorialSuscripcionMdl
{
    public const ACCIONES_PERMITIDAS = [
        'PRUEBA_INICIADA', 'TRANSICION', 'EXPIRADA', 'CORTADA', 'ACTIVACION', 'CANCELADA_MEJORA',
        'CANCELACION', 'PAGO_RECHAZADO', 'renovacion', 'ANULADA', 'PROGRAMADA',
    ];

    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function registrar(
        int $idUsuario,
        int $idSuscripcion,
        string $accion,
        string $detalle,
        string $fechaUtc
    ): int {
        if (!in_array($accion, self::ACCIONES_PERMITIDAS, true)) {
            throw new InvalidArgumentException('Acción de historial no permitida');
        }
        $sqlRegistrarHistorial = 'INSERT INTO spsu_historialsuscri
            (his_usuarioId, his_sisIdSuscrip, his_accion, his_detalle, his_fechaCambio, his_direcionIP)
            VALUES (?, ?, ?, ?, ?, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlRegistrarHistorial,
            'iissss',
            $idUsuario,
            $idSuscripcion,
            $accion,
            $detalle,
            $fechaUtc,
            ClienteIp::obtener()
        );
    }

    /** Texto del último rechazo del pago (lo que sigue a «motivo=»), o null si no hay. */
    public function obtenerMotivoRechazo(int $idSuscripcion, int $idPago): ?string
    {
        $sqlMotivoRechazo = 'SELECT his_detalle FROM spsu_historialsuscri
            WHERE his_sisIdSuscrip = ? AND his_accion = \'PAGO_RECHAZADO\' AND his_detalle LIKE ?
            ORDER BY his_idHistorial DESC LIMIT 1';
        $fila = $this->conexion->ejecutarConsultaSimpleFila(
            $sqlMotivoRechazo,
            'is',
            $idSuscripcion,
            'pago=' . $idPago . ';%'
        );
        if ($fila === null) {
            return null;
        }
        $posicionMotivo = strpos((string) $fila['his_detalle'], 'motivo=');
        if ($posicionMotivo === false) {
            return null;
        }
        return substr((string) $fila['his_detalle'], $posicionMotivo + strlen('motivo='));
    }
}
