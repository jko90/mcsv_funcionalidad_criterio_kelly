<?php

declare(strict_types=1);

require_once __DIR__ . '/../modelos/BitacoraMdl.php';
require_once __DIR__ . '/../modelos/ReglasKellyMdl.php';
require_once __DIR__ . '/../modelos/CuentasMdl.php';
require_once __DIR__ . '/BaseCtrl.php';

class ReglasKellyCtrl extends BaseCtrl
{
    private BitacoraMdl $bitacoraModelo;
    private ReglasKellyMdl $reglasKellyModelo;
    private CuentasMdl $cuentasModelo;
    private Enlace $enlace;

    private const RESULTADOS_PERMITIDOS = ['GANADOR', 'PERDEDOR'];
    private const RESPETO_REGLAS_PERMITIDO = ['SI', 'NO'];
    private const DIVISOR_KELLY_POR_DEFECTO = 10;
    private const DIVISOR_KELLY_MAXIMO = 1000;
    private const MONTO_MAXIMO_RESULTADO = 9999999.999;

    public function __construct()
    {
        $this->enlace = new Enlace();
        $this->bitacoraModelo = new BitacoraMdl($this->enlace);
        $this->reglasKellyModelo = new ReglasKellyMdl($this->enlace);
        $this->cuentasModelo = new CuentasMdl($this->enlace);
    }

    public function finalizarOperacionBitacora(array $datos): void
    {
        try {
            $idBitacora = $this->leerEntero($datos['bit_idbitacora'] ?? null, 'bit_idbitacora');
            $idCuenta = $this->leerEntero($datos['bit_cueIdCuentas'] ?? null, 'bit_cueIdCuentas');
            $resultadoOperacion = $this->leerOpcion(
                $datos['bit_resultado'] ?? null,
                'bit_resultado',
                self::RESULTADOS_PERMITIDOS
            );
            $situacion = $this->leerOpcion($datos['bit_situacion'] ?? null, 'bit_situacion', ['F']);
            $respetaReglas = $this->leerOpcion(
                $datos['bit_respeReglas'] ?? null,
                'bit_respeReglas',
                self::RESPETO_REGLAS_PERMITIDO
            );
            $montoResultado = $this->leerDecimal(
                $datos['bit_montoResult'] ?? null,
                'bit_montoResult',
                0,
                self::MONTO_MAXIMO_RESULTADO
            );
            $divisor = self::DIVISOR_KELLY_POR_DEFECTO;
            if (array_key_exists('cke_numDivisor', $datos) && $datos['cke_numDivisor'] !== null && $datos['cke_numDivisor'] !== '') {
                $divisorLeido = $this->leerDecimal(
                    $datos['cke_numDivisor'],
                    'cke_numDivisor',
                    0,
                    self::DIVISOR_KELLY_MAXIMO
                );
                if ($divisorLeido > 0) {
                    $divisor = $divisorLeido;
                }
            }
            if (!(ControlPlan::limites()['divisorEditable'] ?? false)) {
                // El plan no permite cambiar el divisor: se ignora el valor del cliente
                $divisor = self::DIVISOR_KELLY_POR_DEFECTO;
            }
            $this->verificarUsuarioEnviado($datos['bit_usuarioId'] ?? null, 'bitacora/finalizaBitacora');
            $idUsuario = $this->idUsuarioSesion();

            $this->enlace->iniciarTransaccion();
            try {
                if ($this->cuentasModelo->obtenerCuentaActivaDeUsuario($idCuenta, $idUsuario, true) === null) {
                    $this->enlace->revertirTransaccion();
                    $this->denegarAcceso("cuenta=$idCuenta bitacora/finalizaBitacora");
                }
                $bitacora = $this->bitacoraModelo->obtenerBitacoraDeUsuario($idBitacora, $idUsuario, true);
                if ($bitacora === null || (int) $bitacora['bit_cueIdCuentas'] !== $idCuenta) {
                    $this->enlace->revertirTransaccion();
                    $this->denegarAcceso("bitacora=$idBitacora bitacora/finalizaBitacora");
                }
                if ($bitacora['bit_situacion'] !== 'O') {
                    $this->enlace->revertirTransaccion();
                    $this->respuestaErrorSimple('La operación ya está finalizada', 409);
                }

                $capitalActual = $this->cuentasModelo->obtenerCapitalPorIdUsuario($idCuenta, $idUsuario);
                if ($capitalActual === null) {
                    $this->enlace->revertirTransaccion();
                    $this->denegarAcceso("cuenta=$idCuenta bitacora/finalizaBitacora");
                }
                $montoCapital = (float) $capitalActual['cap_capital'];
                $balanceAnterior = $this->bitacoraModelo->obtenerBalancePorIdCuenta($idCuenta);
                $montoBalanceInicial = $balanceAnterior === null
                    ? $montoCapital
                    : (float) $balanceAnterior['bit_balance'];

                if ($montoBalanceInicial <= 0) {
                    $idCapitalQuemado = $this->cuentasModelo->quemarCapitalCuenta(
                        $idCuenta,
                        $idUsuario,
                        $montoCapital
                    );
                    if ($idCapitalQuemado <= 0) {
                        throw new RuntimeException('No se pudo actualizar el capital de la cuenta');
                    }
                    $this->enlace->confirmarTransaccion();
                    $this->respuestaErrorSimple(
                        'Has llegado al límite de pérdida, recargue la cuenta para seguir intentando',
                        422
                    );
                }

                if ($montoBalanceInicial < $montoResultado) {
                    $montoResultado = $montoBalanceInicial;
                }
                if ($this->bitacoraModelo->finalizarOperacionBitacora(
                    $idBitacora,
                    $resultadoOperacion,
                    $respetaReglas,
                    $situacion,
                    $montoResultado,
                    date('Y-m-d H:i:s'),
                    $montoBalanceInicial
                ) <= 0) {
                    $this->enlace->revertirTransaccion();
                    $this->respuestaErrorSimple('La operación ya está finalizada', 409);
                }

                $identificador = bin2hex(random_bytes(16));
                // Resultados y riesgo/beneficio se calculan en SQL (consultas originales de anexos/procedimientos.sql)
                $idResultado = $this->reglasKellyModelo->insertarResultadoOperativas($idCuenta, $idUsuario, $identificador);
                $resultado = $this->reglasKellyModelo->obtenerResultadoPorId($idResultado);
                $idRiesgo = $this->reglasKellyModelo->insertarRiesgoBeneficio($idCuenta, $idUsuario, $identificador);
                $riesgo = $this->reglasKellyModelo->obtenerRiesgoBeneficioPorId($idRiesgo);
                $idFactor = $this->reglasKellyModelo->insertarFactorTotal($idCuenta, $idUsuario, $identificador);
                $factor = $this->reglasKellyModelo->obtenerFactorTotalPorId($idFactor);
                $montoTotal = $resultadoOperacion === 'GANADOR'
                    ? $montoBalanceInicial + $montoResultado
                    : $montoBalanceInicial - $montoResultado;
                $idRentabilidad = $this->reglasKellyModelo->insertarRentabilidad(
                    $idCuenta,
                    (float) ($factor['fat_montoGanan'] ?? 0),
                    (float) ($factor['fat_montoPierde'] ?? 0),
                    $montoCapital,
                    $montoTotal,
                    $identificador
                );
                $rentabilidad = $this->reglasKellyModelo->obtenerRentabilidadPorId($idRentabilidad);
                $idCriterio = $this->reglasKellyModelo->insertarCriterioKelly(
                    $idCuenta,
                    $idUsuario,
                    (float) ($resultado['res_x100Ganador'] ?? 0),
                    $divisor,
                    (float) ($riesgo['rib_relacionGanan'] ?? 0),
                    (float) ($rentabilidad['ren_montoTotal'] ?? 0),
                    $identificador
                );
                if ($idResultado <= 0 || $idRiesgo <= 0 || $idFactor <= 0 || $idRentabilidad <= 0 || $idCriterio <= 0) {
                    throw new RuntimeException('No se pudieron guardar los resultados de la operación');
                }
                $this->enlace->confirmarTransaccion();
            } catch (Throwable $error) {
                $this->enlace->revertirTransaccion();
                throw $error;
            }

            $this->respuestaExitosaSimple([
                'bit_idbitacora' => $idBitacora,
                'bit_resultado' => $resultadoOperacion,
                'bit_montoResult' => $montoResultado,
                'bit_respeReglas' => $respetaReglas,
                'bit_situacion' => $situacion,
                'bit_fechaFin' => date('Y-m-d H:i:s'),
                'bit_cueIdCuentas' => $idCuenta,
                'bit_usuarioId' => $idUsuario,
                'cke_numDivisor' => $divisor,
            ]);
        } catch (Throwable $error) {
            error_log('[ReglasKellyCtrl::finalizarOperacionBitacora] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }
}
