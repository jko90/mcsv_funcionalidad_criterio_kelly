<?php

require_once(__DIR__ . '/../modelos/SuscripcionMdl.php');
require_once(__DIR__ . '/../modelos/PagosMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class SuscripcionCtrl extends BaseCtrl
{
    private $suscripcionServicio;
    private $pagosServicio;

    public function __construct()
    {
        $this->suscripcionServicio = new SuscripcionMdl();
        $this->pagosServicio = new PagosMdl();
    }


    public function obtenerSuscripcionesPorUsuario($idUsuario)
    {
        try {
            $this->respuestaErrorSimple('Error interno del servidor'.$idUsuario, 500);

            if (empty(trim($idUsuario))) {
                $this->respuestaErrorSimple('El ID de usuario es requerido', 400);
            }

            $idUsuarioLimpio = htmlspecialchars(trim($idUsuario), ENT_QUOTES, 'UTF-8');

            $id = (int)$idUsuarioLimpio;
            if ($id <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }
            $this->respuestaErrorSimple('Error interno del servidor'.$id, 500);

            $resultado = $this->suscripcionServicio->obtenerSuscripcionPorUsuario($id);
            if (!$resultado || $resultado->num_rows === 0) {
                $this->respuestaErrorSimple('No se encontraron suscripciones para el usuario especificado', 404);
                return;
            }

            $datosSuscripciones = [];
            while ($objSuscripcion = $resultado->fetch_assoc()) {
                $datosSuscripciones[] = [
                    'sis_idSuscrip'      => (int)($objSuscripcion['sis_idSuscrip'] ?? 0),
                    'sus_usuarioId'      => (int)($objSuscripcion['sus_usuarioId'] ?? 0),
                    'sus_pinIdPlanin'    => (int)($objSuscripcion['sus_pinIdPlanin'] ?? 0),
                    'sus_fechainicio'    => $objSuscripcion['sus_fechainicio'] ?? '',
                    'sus_fechaFin'       => $objSuscripcion['sus_fechaFin'] ?? '',
                    'sus_situacion'      => $objSuscripcion['sus_situacion'] ?? '',
                    'sus_referenPago'    => $objSuscripcion['sus_referenPago'] ?? '',
                    'sus_renovAutomatica'=> (bool)($objSuscripcion['sus_renovAutomatica'] ?? false),
                    'sus_proximoPago'    => $objSuscripcion['sus_proximoPago'] ?? '',
                    'sus_fechaCrea'      => $objSuscripcion['sus_fechaCrea'] ?? ''
                ];
            }

            return $this->respuestaExitosaSimple($datosSuscripciones, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    /*
    Obtiene los planes disponibles.
    @return array
    */
    public function insertarSuscripcionSinPago($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['sus_pinIdPlanin', 'sus_usuarioId']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }
            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validaciones y asignaciones
            $usuarioId = (int)($datosLimpios['sus_usuarioId'] ?? 0);
            $planId = (int)($datosLimpios['sus_pinIdPlanin'] ?? 0);

            $fechaActual = date('Y-m-d H:i:s');
            $fechaFinPago = date('Y-m-d H:i:s', strtotime($fechaActual . ' +1 month'));

            $existeSuscripcion = $this->suscripcionServicio->obtenerSuscripcionPorIDUsuario($planId, $usuarioId, 0);
            $idSuscripcionDB = (int)($existeSuscripcion['sis_idSuscrip'] ?? 0);
            if ($existeSuscripcion) {
                $this->suscripcionServicio->actualizarSuscripcionSinPago($idSuscripcionDB, $fechaActual, $fechaFinPago);
            }

            $resultado = $this->suscripcionServicio->insertarSuscripcionSinPago($usuarioId, $planId, $fechaActual, $fechaFinPago);
            if (!is_numeric($resultado) || (int)$resultado <= 0) {
                $this->respuestaErrorSimple('No se pudo realizar la operación', 404);
                return;
            }

            $idSuscripcionDB = (int)($resultado ?? 0);
            $objSuscripcion = $this->suscripcionServicio->obtenerSuscripcionPorID($idSuscripcionDB);
            if (!$objSuscripcion) {
                $this->respuestaErrorSimple('No se encontraron detalles de la suscripción', 404);
                return;
            }

            $datosSuscripcion = [
                'sis_idSuscrip'      => (int)($objSuscripcion['sis_idSuscrip'] ?? 0),
                'sus_usuarioId'      => (int)($objSuscripcion['sus_usuarioId'] ?? 0),
                'sus_pinIdPlanin'    => (int)($objSuscripcion['sus_pinIdPlanin'] ?? 0),
                'sus_fechainicio'    => $objSuscripcion['sus_fechainicio'] ?? '',
                'sus_fechaFin'       => $objSuscripcion['sus_fechaFin'] ?? '',
                'sus_situacion'      => $objSuscripcion['sus_situacion'] ?? '',
                'sus_referenPago'    => $objSuscripcion['sus_referenPago'] ?? '',
                'sus_renovAutomatica'=> (bool)($objSuscripcion['sus_renovAutomatica'] ?? false),
                'sus_proximoPago'    => $objSuscripcion['sus_proximoPago'] ?? '',
                'sus_fechaCrea'      => $objSuscripcion['sus_fechaCrea'] ?? ''
            ];

            return $this->respuestaExitosaSimple($datosSuscripcion, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }


    public function insertarSuscripcionConPago($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, ['pin_idPlanInterv', 'iUsuario', 'idTransaccion', 'ins_numMeses']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }
            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            $usuarioId = (int)($datosLimpios['iUsuario'] ?? 0);
            $planId = (int)($datosLimpios['pin_idPlanInterv'] ?? 0);
            $numeroMeses = (int)($datosLimpios['ins_numMeses'] ?? 1);
            $montoPago = (float)($datosLimpios['pin_precioFinal'] ?? 0);
            $metodoPago = $datosLimpios['metodoPago'] ?? '';
            $idTransaccion = $datosLimpios['idTransaccion'] ?? '';
            $comprobante = $datosLimpios['comprobante'] ?? 'null';
            $correoTransaccion = $datosLimpios['correoTransaccion'] ?? 'null';
            $criptomoneda = $datosLimpios['criptomoneda'] ?? 'null';
            $sis_idSuscrip = (int)($datosLimpios['sis_idSuscrip'] ?? 0);

            if ($usuarioId <= 0 || $planId <= 0 || $numeroMeses <= 0 || $montoPago <= 0 || empty($idTransaccion)) {
                $this->respuestaErrorSimple('Datos de suscripción inválidos', 400);
            }

            $fechaActual = date('Y-m-d H:i:s');
            $fechaFinPago = date('Y-m-d H:i:s', strtotime($fechaActual . ' +'.$numeroMeses.' month'));
            $proximoPago = date('Y-m-d H:i:s', strtotime($fechaFinPago . ' -1 day'));

            $idSuscripcionDB = 0;
            if($sis_idSuscrip <= 0){
                $existeSuscripcion = $this->suscripcionServicio->obtenerSuscripcionPorIDUsuario($planId, $usuarioId, $sis_idSuscrip);
                $idSuscripcionDB = (int)($existeSuscripcion['sis_idSuscrip'] ?? 0);
            }
            $idSuscripcionDB = $sis_idSuscrip;
            if($idSuscripcionDB > 0){
                $this->suscripcionServicio->actualizarRangoFechaConPago($idSuscripcionDB, $fechaActual, $fechaFinPago, $idTransaccion, $proximoPago);
            }

            if($sis_idSuscrip <= 0){
                $resultado = $this->suscripcionServicio->insertarSuscripcionConPago($usuarioId, $planId, $fechaActual, $fechaFinPago, $idTransaccion, $proximoPago);
                if (!is_numeric($resultado) || (int)$resultado <= 0) {
                    $this->respuestaErrorSimple('No se pudo realizar la operación', 404);
                    return;
                }
                $idSuscripcionDB = (int)($resultado ?? 0);
            }

            $idInsertarPago = $this->pagosServicio->insertarPagoSuscripcion($idSuscripcionDB, $montoPago, $fechaActual, $metodoPago, $idTransaccion, $fechaActual, $fechaFinPago, $comprobante, $correoTransaccion, $criptomoneda);
            if (!is_numeric($idInsertarPago) || (int)$idInsertarPago <= 0) {
                $this->respuestaErrorSimple('No se pudo realizar la operación', 404);
                return;
            }

            $objSuscripcion = $this->suscripcionServicio->obtenerSuscripcionPorID($idSuscripcionDB);
            if (!$objSuscripcion) {
                $this->respuestaErrorSimple('No se encontraron detalles de la suscripción', 404);
                return;
            }

            $datosSuscripcion = [
                'sis_idSuscrip'      => (int)($objSuscripcion['sis_idSuscrip'] ?? 0),
                'sus_usuarioId'      => (int)($objSuscripcion['sus_usuarioId'] ?? 0),
                'sus_pinIdPlanin'    => (int)($objSuscripcion['sus_pinIdPlanin'] ?? 0),
                'sus_fechainicio'    => $objSuscripcion['sus_fechainicio'] ?? '',
                'sus_fechaFin'       => $objSuscripcion['sus_fechaFin'] ?? '',
                'sus_situacion'      => $objSuscripcion['sus_situacion'] ?? '',
                'sus_referenPago'    => $objSuscripcion['sus_referenPago'] ?? '',
                'sus_renovAutomatica'=> (bool)($objSuscripcion['sus_renovAutomatica'] ?? false),
                'sus_proximoPago'    => $objSuscripcion['sus_proximoPago'] ?? '',
                'sus_fechaCrea'      => $objSuscripcion['sus_fechaCrea'] ?? ''
            ];


            return $this->respuestaExitosaSimple($datosSuscripcion, 200);
        } catch (Exception $e) {
            $this->respuestaErrorSimple('Error interno del servidor desde el controlador', 500);
        }
    }

}
