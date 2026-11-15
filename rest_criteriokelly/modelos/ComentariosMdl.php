<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class ComentariosMdl
{
    private Enlace $conexion;

    public function __construct(?Enlace $enlace = null)
    {
        $this->conexion = $enlace ?? new Enlace();
    }

    public function validarObservacion(string $tipoObservacion, int $idBitacora): ?array
    {
        $sqlObservacionPorTipo = 'SELECT obs_idObserva, obs_bitIdbitaco,
                obs_comentario, obs_tipoObserva, obs_imagen, obs_fecha
            FROM scko_observacion
            WHERE obs_bitIdbitaco = ? AND obs_tipoObserva = ?';
        return $this->conexion->ejecutarConsultaSimpleFila(
            $sqlObservacionPorTipo,
            'is',
            $idBitacora,
            $tipoObservacion
        );
    }

    public function obtenerObservacionDeBitacora(
        int $idObservacion,
        int $idBitacora,
        bool $bloquear = false
    ): ?array {
        $sqlObservacionDeBitacora = 'SELECT obs_idObserva
            FROM scko_observacion
            WHERE obs_idObserva = ? AND obs_bitIdbitaco = ?';
        $sqlObservacionDeBitacoraBloqueo = $sqlObservacionDeBitacora . ' FOR UPDATE';
        return $this->conexion->ejecutarConsultaSimpleFila(
            $bloquear ? $sqlObservacionDeBitacoraBloqueo : $sqlObservacionDeBitacora,
            'ii',
            $idObservacion,
            $idBitacora
        );
    }

    public function sobreEscribirObservacion(
        int $idBitacora,
        string $tipoObservacion,
        string $comentario,
        ?string $imagen
    ): int {
        $sqlActualizarObservacionPorTipo = 'UPDATE scko_observacion
            SET obs_comentario = ?, obs_imagen = ?
            WHERE obs_bitIdbitaco = ? AND obs_tipoObserva = ?';
        return $this->conexion->ejecutarActualizacion(
            $sqlActualizarObservacionPorTipo,
            'ssis',
            $comentario,
            $imagen,
            $idBitacora,
            $tipoObservacion
        );
    }

    public function crearComentariosPorBitacora(
        int $idBitacora,
        string $comentario,
        string $tipoObservacion,
        ?string $imagen
    ): int {
        $sqlInsertarObservacion = 'INSERT INTO scko_observacion
            (obs_bitIdbitaco, obs_comentario, obs_tipoObserva, obs_imagen)
            VALUES (?, ?, ?, ?)';
        return $this->conexion->ejecutarInsercionRetornaID(
            $sqlInsertarObservacion,
            'isss',
            $idBitacora,
            $comentario,
            $tipoObservacion,
            $imagen
        );
    }

    public function actualizarBitacoraTPBESL(
        int $idBitacora,
        int $idUsuario,
        ?float $precioEntrada,
        ?float $precioStopLoss,
        ?float $precioTakeProfit
    ): int {
        $sqlActualizarPreciosPropios = 'UPDATE sckb_bitacora
            SET bit_precioEntra = COALESCE(?, bit_precioEntra),
                bit_precioSL = COALESCE(?, bit_precioSL),
                bit_precioTP = COALESCE(?, bit_precioTP)
            WHERE bit_idbitacora = ? AND bit_usuarioId = ?';
        return $this->conexion->ejecutarActualizacion(
            $sqlActualizarPreciosPropios,
            'dddii',
            $precioEntrada,
            $precioStopLoss,
            $precioTakeProfit,
            $idBitacora,
            $idUsuario
        );
    }

    public function actualizarObservacion(
        int $idObservacion,
        int $idBitacora,
        ?string $comentario,
        ?string $imagen
    ): int {
        $sqlActualizarObservacion = 'UPDATE scko_observacion
            SET obs_comentario = COALESCE(?, obs_comentario),
                obs_imagen = COALESCE(?, obs_imagen)
            WHERE obs_idObserva = ? AND obs_bitIdbitaco = ?';
        return $this->conexion->ejecutarActualizacion(
            $sqlActualizarObservacion,
            'ssii',
            $comentario,
            $imagen,
            $idObservacion,
            $idBitacora
        );
    }

    public function obtenerComentariosPorBitacora(int $idBitacora)
    {
        $sqlObservacionesDeBitacora = 'SELECT obs_idObserva, obs_bitIdbitaco,
                obs_comentario, obs_tipoObserva, obs_imagen, obs_fecha
            FROM scko_observacion WHERE obs_bitIdbitaco = ? ORDER BY obs_fecha DESC';
        return $this->conexion->ejecutarConsulta($sqlObservacionesDeBitacora, 'i', $idBitacora);
    }
}
