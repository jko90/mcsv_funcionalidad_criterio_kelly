<?php

declare(strict_types=1);

final class AlertasSeguridad
{
    public const EVENTOS_VIGILADOS = [
        'REFRESH_REUTILIZADO',
        'BLOQUEO_IP',
        'ACCESO_DENEGADO',
    ];
    public const UMBRAL = 10;
    public const SEGUNDOS_ENTRE_ALERTAS = 3600;

    public function __construct(
        private AlertasSeguridadMdl $modelo,
        private EnviadorCorreo $enviador
    ) {
    }

    public function evaluarYNotificar(): string
    {
        $conteos = $this->modelo->contarEventosUltimaHora(self::EVENTOS_VIGILADOS);
        $total = array_sum($conteos);
        $rutaMarca = Configuracion::obtener('RUTA_LOGS') . DIRECTORY_SEPARATOR . 'alerta_seguridad.marca';
        $ultimaAlerta = is_file($rutaMarca) ? (int) trim((string) file_get_contents($rutaMarca)) : 0;
        if ($total <= self::UMBRAL) {
            return "Alerta: no enviada (total {$total})";
        }
        if (time() - $ultimaAlerta < self::SEGUNDOS_ENTRE_ALERTAS) {
            return 'Alerta: ya enviada en la última hora';
        }

        $plantilla = PlantillasCorreo::alertaSeguridad($conteos, Configuracion::obtener('APP_ENTORNO'));
        $this->enviador->enviar(Configuracion::obtener('CORREO_ALERTAS'), $plantilla); // [CORREO] alertaSeguridad
        if (file_put_contents($rutaMarca, (string) time(), LOCK_EX) === false) {
            throw new RuntimeException('No se pudo actualizar la marca de alerta');
        }

        return "Alerta: enviada (total ≥ " . (self::UMBRAL + 1) . ')';
    }
}
