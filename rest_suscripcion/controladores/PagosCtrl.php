<?php

require_once(__DIR__ . '/../modelos/PagosMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class PagosCtrl extends BaseCtrl
{
    private $pagosServicio;

    public function __construct()
    {
        $this->pagosServicio = new PagosMdl();
    }


    public function obtenerPagosPendientesVerificacion($idUsuario)
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

            $resultado = $this->pagosServicio->obtenerPagosPendientesVerificacion($id);
            if (!$resultado || $resultado->num_rows === 0) {
                $this->respuestaErrorSimple('No se encontraron pagos pendientes de verificación para el usuario especificado', 404);
                return;
            }

            $datosPagos = [];
            while ($objPago = $resultado->fetch_assoc()) {
                $datosPagos[] = [
                    'pag_id'          => (int)($objPago['pag_id'] ?? 0),
                    'pag_usuarioId'   => (int)($objPago['pag_usuarioId'] ?? 0),
                    'pag_monto'      => (float)($objPago['pag_monto'] ?? 0),
                    'pag_fecha'       => $objPago['pag_fecha'] ?? '',
                    'pag_estado'      => $objPago['pag_estado'] ?? '',
                    'pag_metodoPago'  => $objPago['pag_metodoPago'] ?? '',
                    'pag_referencia'  => $objPago['pag_referencia'] ?? '',
                ];
            }

            return $this->respuestaExitosaSimple($datosPagos, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
