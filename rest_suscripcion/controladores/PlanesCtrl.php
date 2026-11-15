<?php

declare(strict_types=1);

require_once __DIR__ . '/../modelos/PlanesMdl.php';
require_once __DIR__ . '/BaseCtrl.php';

class PlanesCtrl extends BaseCtrl
{
    private PlanesMdl $planesServicio;

    public function __construct()
    {
        $this->planesServicio = new PlanesMdl();
    }

    public function obtenerPlanesDisponibles(): void
    {
        try {
            $resultado = $this->planesServicio->obtenerPlanesDisponibles();
            if (!$resultado || $resultado->num_rows === 0) {
                $this->respuestaErrorSimple('No se encontraron planes disponibles', 404);
            }

            $datosPlanes = [];
            foreach ($resultado as $plan) {
                $datosPlanes[] = [
                    'pin_idPlanInterv' => (int) ($plan['pin_idPlanInterv'] ?? 0),
                    'pin_precioFinal' => (float) ($plan['pin_precioFinal'] ?? 0),
                    'ins_nombre' => $plan['ins_nombre'] ?? '',
                    'ins_numMeses' => (int) ($plan['ins_numMeses'] ?? 0),
                    'ins_x100descuen' => (float) ($plan['ins_x100descuen'] ?? 0),
                    'pla_nombre' => $plan['pla_nombre'] ?? '',
                    'pla_descripcion' => $plan['pla_descripcion'] ?? '',
                    'pla_precioBase' => (float) ($plan['pla_precioBase'] ?? 0),
                    'pla_moneda' => $plan['pla_moneda'] ?? '',
                    'pla_numCuentas' => (int) ($plan['pla_numCuentas'] ?? 0),
                    'pla_diasHistorial' => (int) ($plan['pla_diasHistorial'] ?? 0),
                    'pla_diasTotales' => (int) ($plan['pla_diasTotales'] ?? 0),
                    'pla_bloqueoDias' => (int) ($plan['pla_bloqueoDias'] ?? 0),
                    'pla_puedeDescargar' => (bool) ($plan['pla_puedeDescargar'] ?? false),
                    'pla_rangoLibre' => (bool) ($plan['pla_rangoLibre'] ?? false),
                    'pla_puedeGraficar' => (bool) ($plan['pla_puedeGraficar'] ?? false),
                    'pla_divisorEditable' => (bool) ($plan['pla_divisorEditable'] ?? false),
                    'pla_maxOperacionesDiarias' => isset($plan['pla_maxOperacionesDiarias'])
                        ? (int) $plan['pla_maxOperacionesDiarias']
                        : null,
                ];
            }
            $this->respuestaExitosaSimple($datosPlanes);
        } catch (Throwable $error) {
            error_log('[PlanesCtrl::obtenerPlanesDisponibles] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerPlanesSuscritosSinPagar(mixed $idEnviado): void
    {
        try {
            $this->verificarUsuarioEnviado($idEnviado, 'planes/suscritos');
            $idUsuario = $this->idUsuarioSesion();
            $resultado = $this->planesServicio->obtenerPlanesSuscriptosSinPagar($idUsuario);
            if (!$resultado || $resultado->num_rows === 0) {
                $this->respuestaErrorSimple('No se encontraron suscripciones para el usuario especificado', 404);
            }

            $datosPlanes = [];
            foreach ($resultado as $plan) {
                $datosPlanes[] = [
                    'pin_idPlanInterv' => (int) ($plan['pin_idPlanInterv'] ?? 0),
                    'pin_precioFinal' => (float) ($plan['pin_precioFinal'] ?? 0),
                    'ins_nombre' => $plan['ins_nombre'] ?? '',
                    'ins_numMeses' => (int) ($plan['ins_numMeses'] ?? 0),
                    'ins_x100descuen' => (float) ($plan['ins_x100descuen'] ?? 0),
                    'pla_nombre' => $plan['pla_nombre'] ?? '',
                    'pla_descripcion' => $plan['pla_descripcion'] ?? '',
                    'pla_precioBase' => (float) ($plan['pla_precioBase'] ?? 0),
                    'pla_moneda' => $plan['pla_moneda'] ?? '',
                    'pla_numCuentas' => (int) ($plan['pla_numCuentas'] ?? 0),
                    'sis_idSuscrip' => (int) ($plan['sis_idSuscrip'] ?? 0),
                    'sus_fechaCrea' => $plan['sus_fechaCrea'] ?? '',
                    'sus_usuarioId' => (int) ($plan['sus_usuarioId'] ?? 0),
                    'pag_saldo' => (float) ($plan['pag_saldo'] ?? 0),
                    'pag_situacion' => $plan['pag_situacion'] ?? '',
                    'pag_montoConfirmado' => (float) ($plan['pag_montoConfirmado'] ?? 0),
                ];
            }
            $this->respuestaExitosaSimple($datosPlanes);
        } catch (Throwable $error) {
            error_log('[PlanesCtrl::obtenerPlanesSuscritosSinPagar] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
