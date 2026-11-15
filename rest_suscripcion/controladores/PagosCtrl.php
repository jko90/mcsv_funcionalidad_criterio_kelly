<?php

require_once(__DIR__ . '/../modelos/PagosMdl.php');
require_once(__DIR__ . '/../modelos/SuscripcionMdl.php');
require_once(__DIR__ . '/../modelos/HistorialSuscripcionMdl.php');
require_once(__DIR__ . '/../configuracion/LectorPlanVigente.php');
require_once(__DIR__ . '/../servicios/MejoraPlanSrv.php');
require_once(__DIR__ . '/BaseCtrl.php');

class PagosCtrl extends BaseCtrl
{
    private const ROLES_ADMINISTRACION = [1, 2];
    private const LIMITE_LISTADO_POR_DEFECTO = 20;
    private const LIMITE_LISTADO_MAXIMO = 50;
    private const LONGITUD_MINIMA_MOTIVO = 5;
    private const LONGITUD_MAXIMA_MOTIVO = 256;
    private const LONGITUD_MAXIMA_DETALLE_HISTORIAL = 4096;
    private const MENSAJE_MOTIVO_INVALIDO = "El campo 'motivo' es obligatorio y debe tener entre 5 y 256 caracteres";
    private const MENSAJES_CONFLICTO = [
        MejoraPlanSrv::RESULTADO_CUENTA_INACTIVA => 'La cuenta del pago no está activa',
        MejoraPlanSrv::RESULTADO_PAGO_NO_PENDIENTE => 'El pago no está pendiente de revisión',
        MejoraPlanSrv::RESULTADO_SUSCRIPCION_NO_ADMITE => 'La suscripción ya no admite la confirmación',
        MejoraPlanSrv::RESULTADO_SIN_COMPROBANTE => 'El pago no tiene comprobante',
        MejoraPlanSrv::RESULTADO_MONTO_NO_COINCIDE => 'El monto del pago no coincide con el plan',
        MejoraPlanSrv::RESULTADO_OTRA_COMBINACION =>
            'Ya tiene un plan de pago activo; solo puede pagar por anticipado la misma combinación',
        MejoraPlanSrv::RESULTADO_YA_PROGRAMADA => 'Ya tiene un periodo siguiente pagado y programado',
        MejoraPlanSrv::RESULTADO_COMPROBANTE_ANTIGUO => 'El comprobante es demasiado antiguo; suba uno nuevo',
    ];

    private $pagosServicio;
    private Enlace $enlace;
    private SuscripcionMdl $suscripcionModelo;
    private HistorialSuscripcionMdl $historialModelo;
    private MejoraPlanSrv $mejoraPlanServicio;

    public function __construct()
    {
        $this->pagosServicio = new PagosMdl();
        $this->enlace = new Enlace();
        $this->suscripcionModelo = new SuscripcionMdl($this->enlace);
        $this->historialModelo = new HistorialSuscripcionMdl($this->enlace);
        $this->mejoraPlanServicio = new MejoraPlanSrv($this->enlace);
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

    /** Pagos en revisión para el administrador, con el periodo que resultaría al confirmar (RN-14). */
    public function listarPagosPendientes(mixed $limiteEnviado, mixed $desdeEnviado): void
    {
        try {
            $this->exigirRolAdministrador(self::ROLES_ADMINISTRACION, 'pagos/pendientes');
            $limite = $limiteEnviado === null || $limiteEnviado === ''
                ? self::LIMITE_LISTADO_POR_DEFECTO
                : $this->leerEntero($limiteEnviado, 'limite', 1, self::LIMITE_LISTADO_MAXIMO);
            $desde = $desdeEnviado === null || $desdeEnviado === ''
                ? self::ENTERO_MAXIMO
                : $this->leerEntero($desdeEnviado, 'desde');

            $ahora = $this->mejoraPlanServicio->ahora();
            $hoyUtc = $ahora->format('Y-m-d');
            $idAdministrador = $this->idUsuarioSesion();
            $pagosPendientes = [];
            foreach ($this->pagosServicio->listarPagosEnRevision($limite, $desde) as $fila) {
                $presente = $this->suscripcionModelo->obtenerPeriodoPresente((int) $fila['sus_usuarioId'], $hoyUtc);
                $periodo = $this->mejoraPlanServicio->calcularPeriodo($fila, $presente, $ahora);
                $pagosPendientes[] = [
                    'pag_idPago' => (int) $fila['pag_idPago'],
                    'pag_susIdSuscri' => (int) $fila['pag_susIdSuscri'],
                    'sus_usuarioId' => (int) $fila['sus_usuarioId'],
                    'usuario' => (string) $fila['usuario'],
                    'pla_nombre' => (string) $fila['pla_nombre'],
                    'ins_nombre' => (string) $fila['ins_nombre'],
                    'pag_monto' => (float) $fila['pag_monto'],
                    'pag_moneda' => (string) $fila['pag_moneda'],
                    'pag_metodoPago' => $fila['pag_metodoPago'],
                    'pag_idTransac' => (string) $fila['pag_idTransac'],
                    'pag_fechaPago' => (string) $fila['pag_fechaPago'],
                    'pag_tipocripto' => $fila['pag_tipocripto'],
                    'tieneComprobante' => (int) $fila['tieneComprobante'] === 1,
                    'esPropio' => (int) $fila['sus_usuarioId'] === $idAdministrador,
                    'esAnticipado' => $periodo['tipo'] === MejoraPlanSrv::TIPO_ANTICIPADO,
                    'fechaInicioResultante' => $periodo['inicio'],
                    'fechaCorteResultante' => $periodo['fin'],
                    'esAntiguo' => $periodo['esAntiguo'],
                ];
            }
            $this->respuestaExitosaSimple($pagosPendientes);
        } catch (Throwable $error) {
            error_log('[PagosCtrl::listarPagosPendientes] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerComprobante(mixed $idPagoEnviado): void
    {
        try {
            $this->exigirRolAdministrador(self::ROLES_ADMINISTRACION, 'pagos/comprobante');
            $idPago = $this->leerEntero($idPagoEnviado, 'pag_idPago');
            $comprobante = $this->pagosServicio->obtenerComprobante($idPago);
            if ($comprobante === null) {
                $this->respuestaErrorSimple('Comprobante no encontrado', 404);
            }
            $this->respuestaExitosaSimple(['pag_idPago' => $idPago, 'comprobante' => $comprobante]);
        } catch (Throwable $error) {
            error_log('[PagosCtrl::obtenerComprobante] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function confirmarPago(array $datos): void
    {
        try {
            $this->exigirCamposPermitidos($datos, ['pag_idPago']);
            $idPago = $this->leerEntero($datos['pag_idPago'] ?? null, 'pag_idPago');
            $this->exigirRolAdministrador(self::ROLES_ADMINISTRACION, 'pagos/confirmar');
            $respuesta = $this->mejoraPlanServicio->confirmar($idPago, $this->idUsuarioSesion());
            $this->responderResultadoValidacion($respuesta, 'pagos/confirmar');
        } catch (Throwable $error) {
            error_log('[PagosCtrl::confirmarPago] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function rechazarPago(array $datos): void
    {
        try {
            $this->exigirCamposPermitidos($datos, ['pag_idPago', 'motivo']);
            $idPago = $this->leerEntero($datos['pag_idPago'] ?? null, 'pag_idPago');
            $motivo = $this->leerMotivoRechazo($datos['motivo'] ?? null);
            $this->exigirRolAdministrador(self::ROLES_ADMINISTRACION, 'pagos/rechazar');
            $respuesta = $this->mejoraPlanServicio->rechazar($idPago, $motivo, $this->idUsuarioSesion());
            $this->responderResultadoValidacion($respuesta, 'pagos/rechazar');
        } catch (Throwable $error) {
            error_log('[PagosCtrl::rechazarPago] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /** Estado del último pago de la suscripción pendiente del propio usuario (HU-005 B-05). */
    public function obtenerMiUltimoPago(mixed $idQuery, mixed $idSegmento): void
    {
        try {
            $this->verificarUsuarioEnviado($idQuery, 'pagos/miUltimoPago');
            $this->verificarUsuarioEnviado($idSegmento, 'pagos/miUltimoPago');
            $idUsuario = $this->idUsuarioSesion();
            $planPendiente = (new LectorPlanVigente($this->enlace))->leer($idUsuario)['planPendiente'];
            $ultimoPago = $planPendiente === null
                ? null
                : $this->pagosServicio->obtenerUltimoPagoDeSuscripcion((int) $planPendiente['sis_idSuscrip'], $idUsuario);
            if ($ultimoPago === null) {
                $this->respuestaJsonSimple(['pago' => null], 200);
            }
            $idPago = (int) $ultimoPago['pag_idPago'];
            $idSuscripcion = (int) $ultimoPago['sis_idSuscrip'];
            $motivoRechazo = $ultimoPago['pag_situacion'] === 'F'
                ? $this->historialModelo->obtenerMotivoRechazo($idSuscripcion, $idPago)
                : null;
            $this->respuestaJsonSimple([
                'pago' => [
                    'pag_idPago' => $idPago,
                    'sis_idSuscrip' => $idSuscripcion,
                    'pag_situacion' => (string) $ultimoPago['pag_situacion'],
                    'pag_fechaPago' => (string) $ultimoPago['pag_fechaPago'],
                    'pag_monto' => (float) $ultimoPago['pag_monto'],
                    'pag_moneda' => (string) $ultimoPago['pag_moneda'],
                    'pag_metodoPago' => $ultimoPago['pag_metodoPago'],
                    'pla_nombre' => (string) $ultimoPago['pla_nombre'],
                    'ins_nombre' => (string) $ultimoPago['ins_nombre'],
                    'tieneComprobante' => (int) $ultimoPago['tieneComprobante'] === 1,
                    'motivoRechazo' => $motivoRechazo,
                ],
            ], 200);
        } catch (Throwable $error) {
            error_log('[PagosCtrl::obtenerMiUltimoPago] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /** Ninguna clave fuera de la lista puede llegar al servicio (rol, fechas y montos no vienen del cliente). */
    private function exigirCamposPermitidos(array $datos, array $camposPermitidos): void
    {
        if (array_diff_key($datos, array_flip($camposPermitidos)) !== []) {
            $this->respuestaErrorSimple('La solicitud contiene campos no permitidos', 400);
        }
    }

    private function leerMotivoRechazo(mixed $motivoEnviado): string
    {
        if (!is_string($motivoEnviado)) {
            $this->respuestaErrorSimple(self::MENSAJE_MOTIVO_INVALIDO, 400);
        }
        $longitudMotivo = mb_strlen(trim($motivoEnviado));
        if ($longitudMotivo < self::LONGITUD_MINIMA_MOTIVO || $longitudMotivo > self::LONGITUD_MAXIMA_MOTIVO) {
            $this->respuestaErrorSimple(self::MENSAJE_MOTIVO_INVALIDO, 400);
        }
        return $this->leerTexto($motivoEnviado, 'motivo', self::LONGITUD_MAXIMA_DETALLE_HISTORIAL, true);
    }

    /** @param array{resultado:string, datos:?array} $respuesta */
    private function responderResultadoValidacion(array $respuesta, string $origen): void
    {
        $resultado = $respuesta['resultado'];
        if ($resultado === MejoraPlanSrv::RESULTADO_OK) {
            $this->respuestaExitosaSimple($respuesta['datos']);
        }
        if ($resultado === MejoraPlanSrv::RESULTADO_NO_EXISTE) {
            $this->respuestaErrorSimple('Pago no encontrado', 404);
        }
        if ($resultado === MejoraPlanSrv::RESULTADO_PAGO_PROPIO) {
            $this->denegarAcceso('pago propio ' . $origen);
        }
        $mensajeConflicto = self::MENSAJES_CONFLICTO[$resultado] ?? null;
        if ($mensajeConflicto === null) {
            throw new LogicException('Resultado de validación desconocido: ' . $resultado);
        }
        $this->respuestaErrorSimple($mensajeConflicto, 409);
    }
}
