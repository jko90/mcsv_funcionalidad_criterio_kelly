<?php

require_once(__DIR__ . '/../modelos/BitacoraMdl.php');
require_once(__DIR__ . '/../modelos/ReglasKellyMdl.php');
require_once(__DIR__ . '/../modelos/CuentasMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class ReglasKellyCtrl extends BaseCtrl
{
    private $bitacoraService;
    private $reglasKellyService;
    private $cuentasService;

    public function __construct()
    {
        $this->bitacoraService = new BitacoraMdl();
        $this->reglasKellyService = new ReglasKellyMdl();
        $this->cuentasService = new CuentasMdl();
    }

    /**
     * Finaliza una operación en la bitácora y calcula los resultados relacionados.
     *
     * @param array $data Datos de la operación a finalizar.
     * @throws Exception Si ocurre un error durante el proceso.
     */
    public function finalizarOperacionBitacora($data)
    {
        try {
            // Validar campos requeridos
            $errores = $this->validarDatos($data, [
                'bit_idbitacora',
                'bit_resultado',
                'bit_situacion',
                'bit_respeReglas',
                'bit_montoResult',
                'bit_cueIdCuentas',
                'bit_usuarioId'
            ]);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores), 400);
            }

            // Limpiar datos de entrada
            $datosLimpios = $this->limpiarDatos($data);

            // Validaciones y asignaciones
            $montoOpera = isset($datosLimpios['bit_montoResult']) ? (float)$datosLimpios['bit_montoResult'] : 0;
            $resultadoOperacion = isset($datosLimpios['bit_resultado']) ? strtoupper(trim($datosLimpios['bit_resultado'])) : 'GANADOR';
            if (!in_array($resultadoOperacion, ['GANADOR', 'PERDEDOR'])) {
                $this->respuestaErrorSimple('Resultado inválido. Debe ser GANADOR o PERDEDOR', 400);
            }
            $situacion = isset($datosLimpios['bit_situacion']) ? strtoupper(trim($datosLimpios['bit_situacion'])) : 'A';
            if (!in_array($situacion, ['I', 'E', 'P', 'L', 'F'])) {
                $this->respuestaErrorSimple('Situación inválida. Debe ser L (Abierto) o F (Cerrado)', 400);
            }
            $respeReglas = isset($datosLimpios['bit_respeReglas']) ? strtoupper(trim($datosLimpios['bit_respeReglas'])) : 'SI';
            if (!in_array($respeReglas, ['SI', 'NO'])) {
                $this->respuestaErrorSimple('Respeto a reglas inválido. Debe ser SI o NO', 400);
            }
            $usuarioId = isset($datosLimpios['bit_usuarioId']) ? (int)$datosLimpios['bit_usuarioId'] : 0;
            if ($usuarioId <= 0) {
                $this->respuestaErrorSimple('ID de usuario inválido', 400);
            }
            $idCuenta = isset($datosLimpios['bit_cueIdCuentas']) ? (int)$datosLimpios['bit_cueIdCuentas'] : 0;
            if ($idCuenta <= 0) {
                $this->respuestaErrorSimple('ID de cuenta inválido', 400);
            }
            $divisor = isset($datosLimpios['cke_numDivisor']) ? (float)$datosLimpios['cke_numDivisor'] : 0;
            if ($divisor <= 0 || $divisor === '') {
                $divisor = 10;
            }

            // CUENTAS
            $cuentas = $this->cuentasService->obtenerCapitalPorIdUsuario($idCuenta, $usuarioId);
            if (!$cuentas) {
                $this->respuestaErrorSimple('No se encontraron cuentas para el usuario.', 404);
                return;
            }
            $montoCapital = (float)($cuentas['cap_capital'] ?? 0);

            // BALANCE INICIAL
            $balanceCuenta = $this->bitacoraService->obtenerBalancePorIdCuenta($idCuenta);
            if (is_array($balanceCuenta) && isset($balanceCuenta['bit_balance'])) {
                $montoBalanceInicial = (float)$balanceCuenta['bit_balance'];
                if ($montoBalanceInicial < $montoOpera) {
                    $montoOpera = $montoBalanceInicial;
                }
                if ($montoBalanceInicial <= 0) {
                    $capitalNulo = $this->cuentasService->quemarCapitalCuenta($idCuenta, $usuarioId, $montoCapital);
                    if (!$capitalNulo || !is_numeric($capitalNulo) || $capitalNulo <= 0) {
                        $this->respuestaErrorSimple('No se pudo actualizar el capital de la cuenta', 500);
                        return;
                    }
                    $this->respuestaErrorSimple('Has llegado al límite de pérdida, recargue la cuenta para seguir intentando', 422);
                    return;
                }
            } else {
                $montoBalanceInicial = 0;
                if ($montoBalanceInicial <= 0) {
                    $montoBalanceInicial = $montoCapital;
                }
            }

            $identificadorUnico = $datosLimpios['bit_idbitacora'] . uniqid();

            // BITACORA
                $resultado = $this->bitacoraService->finalizarOperacionBitacora(
                $datosLimpios['bit_idbitacora'],
                $resultadoOperacion,
                $respeReglas,
                $situacion,
                $montoOpera,
                date('Y-m-d H:i:s'),
                $idCuenta,
                $montoBalanceInicial
            );
            if (!$resultado || is_string($resultado)) {
                $mensaje = is_string($resultado) ? $resultado : 'No se pudo actualizar el registro';
                $this->respuestaErrorSimple($mensaje, 500);
                return;
            }

            // Operaciones
            $numeroOperaciones = $this->bitacoraService->obtenerCantidadOperacionesPorCuentaUsuario($idCuenta, $usuarioId);

            $operacionesGanadoras = (int)($numeroOperaciones['operaciones_ganadoras'] ?? 0);
            $operacionesPerdedoras = (int)($numeroOperaciones['operaciones_perdedoras'] ?? 0);
            $operacionesBreakEven = (int)($numeroOperaciones['operaciones_break_even'] ?? 0);
            $enOperacion = (int)($numeroOperaciones['en_operacion'] ?? 0);
            $totalOperaciones = (int)($numeroOperaciones['total_operaciones'] ?? 0);

            // RESULTADO
            $idResultadoOperativo = $this->reglasKellyService->insertarResultadoOperativas(
                $idCuenta,
                $usuarioId,
                $operacionesGanadoras,
                $operacionesPerdedoras,
                $operacionesBreakEven,
                $enOperacion,
                $totalOperaciones,
                $identificadorUnico
            );
            if (!is_numeric($idResultadoOperativo) || (int)$idResultadoOperativo <= 0) {
                $this->bitacoraService->anularFinalizarOperacionBitacora($datosLimpios['bit_idbitacora'], $montoBalanceInicial);
                $this->respuestaErrorSimple('No se pudo insertar el registro de operativa', 500);
                return;
            }

            $resultadoOperativo = $this->reglasKellyService->obtenerResultadoPorId($idResultadoOperativo);

            $res_opeGanador = (float)($resultadoOperativo['res_opeGanador'] ?? 0);
            $res_x100Ganador = (float)($resultadoOperativo['res_x100Ganador'] ?? 0);
            $res_opePerdedor = (float)($resultadoOperativo['res_opePerdedor'] ?? 0);
            $res_x100Perdedor = (float)($resultadoOperativo['res_x100Perdedor'] ?? 0);

            // RIESGO BENEFICIO
            $idRiesBeneficio = $this->reglasKellyService->insertarRiesgoBeneficio(
                $idCuenta,
                $usuarioId,
                $res_opeGanador,
                $res_opePerdedor,
                $res_x100Ganador,
                $res_x100Perdedor,
                $identificadorUnico
            );

            if (!is_numeric($idRiesBeneficio) || (int)$idRiesBeneficio <= 0) {
                $this->bitacoraService->anularFinalizarOperacionBitacora($datosLimpios['bit_idbitacora'], $montoBalanceInicial);
                $this->reglasKellyService->EliminarResultadoOperativas($idResultadoOperativo);
                $this->respuestaErrorSimple('No se pudo insertar el registro de riesgo-beneficio', 500);
                return;
            }

            $riesgoBeneficio = $this->reglasKellyService->obtenerRiesgoBeneficioPorId($idRiesBeneficio);

            $rib_relacionGanancia = (float)($riesgoBeneficio['rib_relacionGanan'] ?? 0);

            // FACTOR TOTAL
            $idFactorTotal = $this->reglasKellyService->insertarFactorTotal($idCuenta, $usuarioId, $identificadorUnico);
            if (!is_numeric($idFactorTotal) || (int)$idFactorTotal <= 0) {
                $this->bitacoraService->anularFinalizarOperacionBitacora($datosLimpios['bit_idbitacora'], $montoBalanceInicial);
                $this->reglasKellyService->EliminarResultadoOperativas($idResultadoOperativo);
                $this->reglasKellyService->eliminarRiesgoBeneficio($idRiesBeneficio);
                $this->respuestaErrorSimple('No se pudo insertar el registro de factor total', 500);
                return;
            }
            $valoresFoctorTotal = $this->reglasKellyService->obtenerFactorTotalPorId($idFactorTotal);

            $montoGanan = (float)($valoresFoctorTotal['fat_montoGanan'] ?? 0);
            $montoPierde = (float)($valoresFoctorTotal['fat_montoPierde'] ?? 0);

            // RENTABILIDAD //
            $rentMontoTotal = 0;
            $rentMontoTotal = ($resultadoOperacion === 'GANADOR') ? $montoBalanceInicial + $montoOpera : $montoBalanceInicial - $montoOpera;
            $idRentabilidad = $this->reglasKellyService->insertarRentabilidad($idCuenta, $montoGanan, $montoPierde, $montoCapital, $rentMontoTotal, $identificadorUnico);
            if (!is_numeric($idRentabilidad) || (int)$idRentabilidad <= 0) {
                $this->bitacoraService->anularFinalizarOperacionBitacora($datosLimpios['bit_idbitacora'], $montoBalanceInicial);
                $this->reglasKellyService->EliminarResultadoOperativas($idResultadoOperativo);
                $this->reglasKellyService->eliminarRiesgoBeneficio($idRiesBeneficio);
                $this->reglasKellyService->eliminarFactorTotal($idFactorTotal);
                $this->respuestaErrorSimple('No se pudo insertar el registro de rentabilidad', 500);
                return;
            }
            $respCapitalFinal = $this->reglasKellyService->obtenerRentabilidadPorId($idRentabilidad);

            $capitalFinal = (float)($respCapitalFinal['ren_montoTotal'] ?? 0);

            // CRITERIO KELLY
            $idCriterioKerrly = $this->reglasKellyService->insertarCriterioKelly(
                $idCuenta,
                $usuarioId,
                $res_x100Ganador,
                $divisor,
                $rib_relacionGanancia,
                $capitalFinal,
                $identificadorUnico
            );
            if (!is_numeric($idCriterioKerrly) || (int)$idCriterioKerrly <= 0) {
                $this->bitacoraService->anularFinalizarOperacionBitacora($datosLimpios['bit_idbitacora'], $montoBalanceInicial);
                $this->reglasKellyService->EliminarResultadoOperativas($idResultadoOperativo);
                $this->reglasKellyService->eliminarRiesgoBeneficio($idRiesBeneficio);
                $this->reglasKellyService->eliminarFactorTotal($idFactorTotal);
                $this->reglasKellyService->eliminarRentabilidad($idRentabilidad);
                $this->respuestaErrorSimple('No se pudo insertar el registro de criterio Kelly', 500);
                return;
            }

            $criterioKelly = $this->reglasKellyService->obtenerCriterioKellyPorId($idCriterioKerrly);
            if (!$criterioKelly) {
                $this->respuestaErrorSimple('No se encontraron datos de criterio Kelly para la operación.', 404);
                return;
            }

            $respuesta = [
                'bit_idbitacora' => $datosLimpios['bit_idbitacora'],
                'bit_resultado' => $resultadoOperacion,
                'bit_montoResult' => $montoOpera,
                'bit_respeReglas' => $respeReglas,
                'bit_situacion' => $situacion,
                'bit_fechaFin' => date('Y-m-d H:i:s'),
                'bit_cueIdCuentas' => $idCuenta,
                'bit_usuarioId' => $usuarioId,
                'cke_numDivisor' => $divisor,
            ];

            $this->respuestaExitosaSimple($respuesta);
        } catch (Exception $e) {
            $this->bitacoraService->anularFinalizarOperacionBitacora($datosLimpios['bit_idbitacora'], $montoBalanceInicial);
            $this->reglasKellyService->EliminarResultadoOperativas($idResultadoOperativo);
            $this->reglasKellyService->eliminarRiesgoBeneficio($idRiesBeneficio);
            $this->reglasKellyService->eliminarFactorTotal($idFactorTotal);
            $this->reglasKellyService->eliminarRentabilidad($idRentabilidad);
            //error_log("Error en actualizarBitacoraComentario: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor: ', 500);
        }
    }
}
