<?php

require_once(__DIR__ . '/../modelos/PlanesMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class PlanesCtrl extends BaseCtrl
{
    private $planesServicio;

    public function __construct()
    {
        $this->planesServicio = new PlanesMdl();
    }



    /**
     * Obtiene los planes disponibles.
     * @return array
     */

    public function obtenerPlanesDisponibles()
    {
        try {

            $resultado = $this->planesServicio->obtenerPlanesDisponibles();

            if (!$resultado || empty($resultado)) {
                $this->respuestaErrorSimple('No se encontraron detalles de operaciones para el usuario especificado', 404);
                return;
            }

            $datosPlanes = [];
            foreach ($resultado as $plan) {
                $datosPlanes[] = [
                    'pin_idPlanInterv'   => (int)($plan['pin_idPlanInterv'] ?? 0),
                    'pin_precioFinal'        => (float)($plan['pin_precioFinal'] ?? 0),
                    'ins_nombre'    => $plan['ins_nombre'] ?? '',
                    'ins_numMeses'     => (int)($plan['ins_numMeses'] ?? 0),
                    'ins_x100descuen' => (float)($plan['ins_x100descuen'] ?? 0),
                    'pla_nombre'         => $plan['pla_nombre'] ?? '',
                    'pla_descripcion'    => $plan['pla_descripcion'] ?? '',
                    'pla_precioBase'    => (float)($plan['pla_precioBase'] ?? 0),
                    'pla_moneda'         => $plan['pla_moneda'] ?? '',
                    'pla_numCuentas'    => (int)($plan['pla_numCuentas'] ?? 0)
                ];
            }
            return $this->respuestaExitosaSimple($datosPlanes, 200);
        } catch (Exception $e) {
            error_log("Error en ObtenerObservacionesPorBitacora: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    
    public function obtenerPlanesSuscritosSinPagar($idUsuario)
    {
        try {

            if (empty(trim($idUsuario))) {
                $this->respuestaErrorSimple('El ID de usuario es requerido', 400);
            }

            $idUsuarioLimpio = htmlspecialchars(trim($idUsuario), ENT_QUOTES, 'UTF-8');

            $id = (int)$idUsuarioLimpio;
            if ($id <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }
          //  $this->respuestaErrorSimple('Error interno del servidor GGGGGGGGG'.$id, 500);

            $resultado = $this->planesServicio->obtenerPlanesSuscriptosSinPagar($id);
            if (!$resultado || $resultado->num_rows === 0) {
                $this->respuestaErrorSimple('No se encontraron suscripciones para el usuario especificado', 404);
                return;
            }

            $datosPlanes = [];
            foreach ($resultado as $plan) {
                $datosPlanes[] = [
                    'pin_idPlanInterv'   => (int)($plan['pin_idPlanInterv'] ?? 0),
                    'pin_precioFinal'        => (float)($plan['pin_precioFinal'] ?? 0),
                    'ins_nombre'    => $plan['ins_nombre'] ?? '',
                    'ins_numMeses'     => (int)($plan['ins_numMeses'] ?? 0),
                    'ins_x100descuen' => (float)($plan['ins_x100descuen'] ?? 0),
                    'pla_nombre'         => $plan['pla_nombre'] ?? '',
                    'pla_descripcion'    => $plan['pla_descripcion'] ?? '',
                    'pla_precioBase'    => (float)($plan['pla_precioBase'] ?? 0),
                    'pla_moneda'         => $plan['pla_moneda'] ?? '',
                    'pla_numCuentas'    => (int)($plan['pla_numCuentas'] ?? 0),
                    'sis_idSuscrip'      => (int)($plan['sis_idSuscrip'] ?? 0),
                    'sus_fechaCrea'      => $plan['sus_fechaCrea'] ?? '',
                    'sus_usuarioId'      => (int)($plan['sus_usuarioId'] ?? 0),
                    'pag_saldo'         => (float)($plan['pag_saldo'] ?? 0),
                    'pag_situacion'    => $plan['pag_situacion'] ?? '',
                    'pag_montoConfirmado'       => (float)($plan['pag_montoConfirmado'] ?? 0)
                ];
            }

            return $this->respuestaExitosaSimple($datosPlanes, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
