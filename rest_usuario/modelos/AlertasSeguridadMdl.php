<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class AlertasSeguridadMdl
{
    public function __construct(private Enlace $conexion)
    {
    }

    public function contarEventosUltimaHora(array $tipos): array
    {
        $sqlContarEventos = "SELECT aud_evento, COUNT(*) AS total
            FROM sgen_auditoria
            WHERE aud_evento IN (?, ?, ?) AND aud_fecha >= UTC_TIMESTAMP() - INTERVAL 60 MINUTE
            GROUP BY aud_evento";
        $resultado = $this->conexion->ejecutarConsulta(
            $sqlContarEventos,
            'sss',
            $tipos[0],
            $tipos[1],
            $tipos[2]
        );
        $conteos = array_fill_keys($tipos, 0);
        while ($fila = $resultado->fetch_assoc()) {
            $conteos[(string) $fila['aud_evento']] = (int) $fila['total'];
        }

        return $conteos;
    }

    public function eliminarRecuperacionesAntiguas(): int
    {
        $sqlEliminarRecuperaciones = 'DELETE FROM sgen_recuperacion
            WHERE rec_fechaCrea < NOW() - INTERVAL 7 DAY LIMIT 5000';
        $total = 0;
        do {
            $afectadas = $this->conexion->ejecutarActualizacion($sqlEliminarRecuperaciones);
            $total += $afectadas;
        } while ($afectadas > 0);

        return $total;
    }
}
