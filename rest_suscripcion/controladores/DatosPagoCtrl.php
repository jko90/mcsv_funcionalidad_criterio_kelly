<?php

declare(strict_types=1);

require_once __DIR__ . '/BaseCtrl.php';
require_once __DIR__ . '/../modelos/DatosPagoMdl.php';
require_once __DIR__ . '/../configuracion/LimitadorPeticiones.php';
require_once __DIR__ . '/../servicios/ValidadorDatosPago.php';
require_once __DIR__ . '/../servicios/ProcesadorQrPago.php';

/** Datos de pago administrables y código QR de las redes USDT (HLT-29). */
class DatosPagoCtrl extends BaseCtrl
{
    private const ROLES_ADMINISTRACION = [1, 2];
    private const METODOS_PERMITIDOS = ['CRIPTOMONEDA', 'PAYPAL', 'BANCO'];
    private const MAXIMO_ESCRITURAS_POR_MINUTO = 20;
    private const VENTANA_SEGUNDOS = 60;
    private const CODIGO_MYSQL_DUPLICADO = 1062;
    private const LONGITUD_NOMBRE_RED = 64;
    private const LONGITUD_ETIQUETA_RED = 16;
    private const LONGITUD_PLANTILLA_BANCO = 500;
    private const MENSAJE_RED_INEXISTENTE = 'La red indicada no existe';
    private const MENSAJE_DATOS_INCOMPLETOS = 'Completa los datos antes de activarlo';
    private const CAMPOS_BANCO = [
        'mep_bancoNumero', 'mep_bancoPlantilla', 'mep_bancoTitular', 'mep_bancoDocumento', 'mep_bancoEntidad',
        'mep_bancoTipoCuenta', 'mep_bancoCuenta', 'mep_bancoPaisMoneda', 'mep_bancoObservaciones',
    ];
    private const CAMPOS_RED = [
        'red_idRed', 'red_clave', 'red_nombre', 'red_etiqueta', 'red_direccion', 'red_activo', 'red_orden',
    ];

    private DatosPagoMdl $datosPagoModelo;
    private Enlace $enlace;

    public function __construct()
    {
        $this->enlace = new Enlace();
        $this->datosPagoModelo = new DatosPagoMdl($this->enlace);
    }

    /** Solo lo disponible (RN-06) y solo los campos necesarios para pagar (RN-07). */
    public function obtenerDisponibles(): void
    {
        try {
            $metodos = [];
            foreach ($this->datosPagoModelo->listarMetodos() as $metodo) {
                $metodos[(string) $metodo['mep_codigo']] = $metodo;
            }
            $this->respuestaExitosaSimple([
                'cripto' => $this->armarCriptoDisponible($metodos['CRIPTOMONEDA'] ?? null),
                'paypal' => $this->armarPaypalDisponible($metodos['PAYPAL'] ?? null),
                'banco' => $this->armarBancoDisponible($metodos['BANCO'] ?? null),
            ]);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::obtenerDisponibles] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerAdministracion(): void
    {
        try {
            $this->exigirRolAdministrador(self::ROLES_ADMINISTRACION, 'datosPago/administracion');
            $metodos = [];
            foreach ($this->datosPagoModelo->listarMetodos() as $metodo) {
                $metodos[] = [
                    'mep_idMetodo' => (int) $metodo['mep_idMetodo'],
                    'mep_codigo' => (string) $metodo['mep_codigo'],
                    'mep_nombre' => (string) $metodo['mep_nombre'],
                    'mep_activo' => (int) $metodo['mep_activo'],
                    'mep_orden' => (int) $metodo['mep_orden'],
                    'mep_paypalCorreo' => $metodo['mep_paypalCorreo'],
                    'mep_paypalEnlace' => $metodo['mep_paypalEnlace'],
                    'mep_bancoNumero' => $metodo['mep_bancoNumero'],
                    'mep_bancoPlantilla' => $metodo['mep_bancoPlantilla'],
                    'mep_bancoTitular' => $metodo['mep_bancoTitular'],
                    'mep_bancoDocumento' => $metodo['mep_bancoDocumento'],
                    'mep_bancoEntidad' => $metodo['mep_bancoEntidad'],
                    'mep_bancoTipoCuenta' => $metodo['mep_bancoTipoCuenta'],
                    'mep_bancoCuenta' => $metodo['mep_bancoCuenta'],
                    'mep_bancoPaisMoneda' => $metodo['mep_bancoPaisMoneda'],
                    'mep_bancoObservaciones' => $metodo['mep_bancoObservaciones'],
                    'mep_creadoPor' => $metodo['mep_creadoPor'] === null ? null : (int) $metodo['mep_creadoPor'],
                    'mep_fechacrea' => $metodo['mep_fechacrea'],
                    'mep_actualizadoPor' => $metodo['mep_actualizadoPor'] === null ? null : (int) $metodo['mep_actualizadoPor'],
                    'mep_fechaact' => $metodo['mep_fechaact'],
                ];
            }
            $redes = [];
            foreach ($this->datosPagoModelo->listarRedes(false) as $red) {
                $redes[] = [
                    'red_idRed' => (int) $red['red_idRed'],
                    'red_clave' => (string) $red['red_clave'],
                    'red_nombre' => (string) $red['red_nombre'],
                    'red_etiqueta' => (string) $red['red_etiqueta'],
                    'red_direccion' => (string) $red['red_direccion'],
                    'red_activo' => (int) $red['red_activo'],
                    'red_orden' => (int) $red['red_orden'],
                    'tieneQr' => $red['qr_hash'] !== null,
                    'qrTamano' => $red['qr_tamano'] === null ? null : (int) $red['qr_tamano'],
                    'qrTipoMime' => $red['qr_tipoMime'],
                    'qrHash' => $red['qr_hash'],
                    'red_creadoPor' => $red['red_creadoPor'] === null ? null : (int) $red['red_creadoPor'],
                    'red_fechacrea' => $red['red_fechacrea'],
                    'red_actualizadoPor' => $red['red_actualizadoPor'] === null ? null : (int) $red['red_actualizadoPor'],
                    'red_fechaact' => $red['red_fechaact'],
                ];
            }
            $this->respuestaExitosaSimple(['metodos' => $metodos, 'redes' => $redes]);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::obtenerAdministracion] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function guardarRed(array $datos): void
    {
        try {
            $this->iniciarEscritura('datosPago/guardarRed');
            $this->exigirCamposDatosPago($datos, self::CAMPOS_RED);
            $esEdicion = array_key_exists('red_idRed', $datos) && $datos['red_idRed'] !== null && $datos['red_idRed'] !== '';
            $redActual = null;
            if ($esEdicion) {
                $redActual = $this->exigirRedExistente($this->leerEntero($datos['red_idRed'], 'red_idRed'));
            }
            $claveRed = $esEdicion
                ? $this->leerClaveRedEditada($datos['red_clave'] ?? null, (string) $redActual['red_clave'])
                : $this->leerClaveRed($datos['red_clave'] ?? null);
            $nombre = $this->leerTexto($datos['red_nombre'] ?? null, 'red_nombre', self::LONGITUD_NOMBRE_RED, true);
            $etiqueta = $this->leerTexto($datos['red_etiqueta'] ?? null, 'red_etiqueta', self::LONGITUD_ETIQUETA_RED, true);
            $direccion = $this->leerDireccion($claveRed, $datos['red_direccion'] ?? null);
            $esActiva = array_key_exists('red_activo', $datos)
                ? $this->leerEntero($datos['red_activo'], 'red_activo', 0, 1)
                : (int) ($redActual['red_activo'] ?? 1);
            $orden = array_key_exists('red_orden', $datos)
                ? $this->leerEntero($datos['red_orden'], 'red_orden', 0)
                : (int) ($redActual['red_orden'] ?? 0);
            $idUsuario = $this->idUsuarioSesion();
            $fechaUtc = gmdate('Y-m-d H:i:s');
            $detalle = 'red=' . $claveRed . ' dir=' . ValidadorDatosPago::enmascararDireccion($direccion);

            if ($esEdicion) {
                $idRed = (int) $redActual['red_idRed'];
                $this->datosPagoModelo->actualizarRed($idRed, $nombre, $etiqueta, $direccion, $esActiva, $orden, $idUsuario, $fechaUtc);
                $this->registrarAuditoria('DATOPAGO_EDITADO', $detalle);
                $this->respuestaExitosaSimple(['success' => 'ok', 'red_idRed' => $idRed]);
            }
            if ($this->datosPagoModelo->obtenerRedPorClave($claveRed) !== null) {
                $this->respuestaErrorSimple('Ya existe una red con esa clave', 409);
            }
            try {
                $idRed = $this->datosPagoModelo->crearRed($claveRed, $nombre, $etiqueta, $direccion, $esActiva, $orden, $idUsuario, $fechaUtc);
            } catch (mysqli_sql_exception $error) {
                if ($error->getCode() === self::CODIGO_MYSQL_DUPLICADO) {
                    $this->respuestaErrorSimple('Ya existe una red con esa clave', 409);
                }
                throw $error;
            }
            $this->registrarAuditoria('DATOPAGO_CREADO', $detalle);
            $this->respuestaExitosaSimple(['success' => 'ok', 'red_idRed' => $idRed]);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::guardarRed] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function cambiarEstadoRed(array $datos): void
    {
        try {
            $this->iniciarEscritura('datosPago/cambiarEstadoRed');
            $this->exigirCamposDatosPago($datos, ['red_idRed', 'red_activo']);
            $red = $this->exigirRedExistente($this->leerEntero($datos['red_idRed'] ?? null, 'red_idRed'));
            $esActiva = $this->leerEntero($datos['red_activo'] ?? null, 'red_activo', 0, 1);
            $this->datosPagoModelo->cambiarEstadoRed((int) $red['red_idRed'], $esActiva, $this->idUsuarioSesion(), gmdate('Y-m-d H:i:s'));
            $this->registrarAuditoria('DATOPAGO_ESTADO', 'red=' . $red['red_clave'] . ' activo=' . $esActiva);
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::cambiarEstadoRed] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function eliminarRed(array $datos): void
    {
        try {
            $this->iniciarEscritura('datosPago/eliminarRed');
            $this->exigirCamposDatosPago($datos, ['red_idRed']);
            $red = $this->exigirRedExistente($this->leerEntero($datos['red_idRed'] ?? null, 'red_idRed'));
            $metodoCripto = $this->datosPagoModelo->obtenerMetodoPorCodigo('CRIPTOMONEDA');
            $esUltimaActiva = (int) $red['red_activo'] === 1 && $this->datosPagoModelo->contarRedesActivas() === 1;
            if ($esUltimaActiva && (int) ($metodoCripto['mep_activo'] ?? 0) === 1) {
                $this->respuestaErrorSimple(
                    'No se puede eliminar la última red activa; desactiva primero el método de criptomonedas',
                    400
                );
            }
            $this->datosPagoModelo->eliminarRed((int) $red['red_idRed']);
            $this->registrarAuditoria('DATOPAGO_ELIMINA', 'red=' . $red['red_clave']);
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::eliminarRed] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function guardarPaypal(array $datos): void
    {
        try {
            $this->iniciarEscritura('datosPago/guardarPaypal');
            $this->exigirCamposDatosPago($datos, ['mep_paypalCorreo', 'mep_paypalEnlace']);
            $correo = $this->leerValorOpcional($datos['mep_paypalCorreo'] ?? null, 'mep_paypalCorreo', 'normalizarCorreoPaypal');
            $enlacePaypal = $this->leerValorOpcional($datos['mep_paypalEnlace'] ?? null, 'mep_paypalEnlace', 'normalizarEnlacePaypal');
            $metodo = $this->exigirMetodoExistente('PAYPAL');
            if ((int) $metodo['mep_activo'] === 1 && $correo === null && $enlacePaypal === null) {
                $this->respuestaErrorSimple(self::MENSAJE_DATOS_INCOMPLETOS, 400);
            }
            $this->datosPagoModelo->guardarPaypal($correo, $enlacePaypal, $this->idUsuarioSesion(), gmdate('Y-m-d H:i:s'));
            $this->registrarAuditoria('DATOPAGO_EDITADO', 'metodo=PAYPAL');
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::guardarPaypal] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function guardarBanco(array $datos): void
    {
        try {
            $this->iniciarEscritura('datosPago/guardarBanco');
            $this->exigirCamposDatosPago($datos, self::CAMPOS_BANCO);
            if (!is_string($datos['mep_bancoNumero'] ?? null)) {
                $this->respuestaErrorSimple("El campo 'mep_bancoNumero' es requerido", 400);
            }
            $numero = ValidadorDatosPago::normalizarNumeroBanco($datos['mep_bancoNumero']);
            if ($numero === null) {
                $this->respuestaErrorSimple("El campo 'mep_bancoNumero' debe tener entre 8 y 15 dígitos", 400);
            }
            $datosBanco = [
                'numero' => $numero,
                'plantilla' => $this->textoOpcionalONulo(
                    $this->leerTexto($datos['mep_bancoPlantilla'] ?? null, 'mep_bancoPlantilla', self::LONGITUD_PLANTILLA_BANCO, false)
                ),
                'titular' => $this->textoOpcionalONulo($this->leerTexto(
                    $datos['mep_bancoTitular'] ?? null, 'mep_bancoTitular', 128, false,
                    ValidadorDatosPago::PATRON_NOMBRE_PERSONA_O_ENTIDAD
                )),
                'documento' => $this->leerDocumentoOpcional($datos['mep_bancoDocumento'] ?? null),
                'entidad' => $this->textoOpcionalONulo($this->leerTexto(
                    $datos['mep_bancoEntidad'] ?? null, 'mep_bancoEntidad', 64, false,
                    ValidadorDatosPago::PATRON_NOMBRE_PERSONA_O_ENTIDAD
                )),
                'tipoCuenta' => $this->leerTipoCuentaOpcional($datos['mep_bancoTipoCuenta'] ?? null),
                'cuenta' => $this->leerCuentaOpcional($datos['mep_bancoCuenta'] ?? null),
                'paisMoneda' => $this->textoOpcionalONulo($this->leerTexto(
                    $datos['mep_bancoPaisMoneda'] ?? null, 'mep_bancoPaisMoneda', 32, false,
                    ValidadorDatosPago::PATRON_PAIS_MONEDA
                )),
                'observaciones' => $this->textoOpcionalONulo(
                    $this->leerTexto($datos['mep_bancoObservaciones'] ?? null, 'mep_bancoObservaciones', 255, false)
                ),
            ];
            if ($datosBanco['cuenta'] !== null && ($datosBanco['titular'] === null || $datosBanco['entidad'] === null)) {
                $this->respuestaErrorSimple('Para registrar la cuenta indica también el titular y el banco', 400);
            }
            $this->exigirMetodoExistente('BANCO');
            $this->datosPagoModelo->guardarBanco($datosBanco, $this->idUsuarioSesion(), gmdate('Y-m-d H:i:s'));
            // Datos personales y financieros: solo los últimos 4 dígitos, nunca el documento ni la cuenta completa.
            $detalleAuditoria = 'metodo=BANCO wa=' . ValidadorDatosPago::enmascararNumero($numero);
            if ($datosBanco['cuenta'] !== null) {
                $detalleAuditoria .= ' cuenta=' . ValidadorDatosPago::enmascararNumero($datosBanco['cuenta']);
            }
            $this->registrarAuditoria('DATOPAGO_EDITADO', $detalleAuditoria);
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::guardarBanco] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function cambiarEstadoMetodo(array $datos): void
    {
        try {
            $this->iniciarEscritura('datosPago/cambiarEstadoMetodo');
            $this->exigirCamposDatosPago($datos, ['mep_codigo', 'mep_activo', 'mep_orden']);
            $codigoMetodo = $this->leerOpcion($datos['mep_codigo'] ?? null, 'mep_codigo', self::METODOS_PERMITIDOS);
            $esActivo = $this->leerEntero($datos['mep_activo'] ?? null, 'mep_activo', 0, 1);
            $orden = array_key_exists('mep_orden', $datos) && $datos['mep_orden'] !== null
                ? $this->leerEntero($datos['mep_orden'], 'mep_orden', 0)
                : null;
            $metodo = $this->exigirMetodoExistente($codigoMetodo);
            if ($esActivo === 1 && !$this->estaMetodoCompleto($metodo)) {
                $this->respuestaErrorSimple(self::MENSAJE_DATOS_INCOMPLETOS, 400);
            }
            $this->datosPagoModelo->cambiarEstadoMetodo($codigoMetodo, $esActivo, $orden, $this->idUsuarioSesion(), gmdate('Y-m-d H:i:s'));
            $this->registrarAuditoria('DATOPAGO_ESTADO', 'metodo=' . $codigoMetodo . ' activo=' . $esActivo);
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::cambiarEstadoMetodo] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function subirQr(array $datos): void
    {
        try {
            $this->iniciarEscritura('datosPago/subirQr');
            $this->exigirCamposDatosPago($datos, ['red_idRed', 'imagen']);
            $red = $this->exigirRedExistente($this->leerEntero($datos['red_idRed'] ?? null, 'red_idRed'));
            $imagenValidada = $this->leerImagen(
                $datos['imagen'] ?? null,
                'imagen',
                ProcesadorQrPago::TAMANO_MAXIMO_BYTES,
                ProcesadorQrPago::TIPOS_PERMITIDOS
            );
            if ($imagenValidada === null) {
                $this->respuestaErrorSimple("El campo 'imagen' es requerido", 400);
            }
            try {
                $qrProcesado = ProcesadorQrPago::procesar($imagenValidada);
            } catch (InvalidArgumentException $error) {
                $this->respuestaErrorSimple($error->getMessage(), 400);
            }
            $this->datosPagoModelo->guardarQr(
                (int) $red['red_idRed'],
                $qrProcesado['tipoMime'],
                $qrProcesado['tamano'],
                $qrProcesado['hash'],
                $qrProcesado['contenido'],
                $this->idUsuarioSesion(),
                gmdate('Y-m-d H:i:s')
            );
            $this->registrarAuditoria('QRPAGO_SUBIDO', 'red=' . $red['red_clave']);
            $this->respuestaExitosaSimple(['success' => 'ok', 'qrHash' => $qrProcesado['hash']]);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::subirQr] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function quitarQr(array $datos): void
    {
        try {
            $this->iniciarEscritura('datosPago/quitarQr');
            $this->exigirCamposDatosPago($datos, ['red_idRed']);
            $red = $this->exigirRedExistente($this->leerEntero($datos['red_idRed'] ?? null, 'red_idRed'));
            $this->datosPagoModelo->quitarQr((int) $red['red_idRed']);
            $this->registrarAuditoria('QRPAGO_QUITADO', 'red=' . $red['red_clave']);
            $this->respuestaExitosaSimple(null);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::quitarQr] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    /** Sirve la imagen del QR (RN-11): al no administrador solo si la red y el método están activos. */
    public function servirQr(mixed $claveEnviada): void
    {
        try {
            $claveRed = $this->leerClaveRed($claveEnviada);
            $qr = $this->datosPagoModelo->leerQr($claveRed);
            $puedeVerla = $qr !== null && ($this->esAdministrador()
                || ((int) $qr['red_activo'] === 1 && (int) $qr['metodo_activo'] === 1));
            if (!$puedeVerla) {
                $this->respuestaErrorSimple('Código QR no encontrado', 404);
            }
            $etiquetaEntidad = '"' . $qr['qr_hash'] . '"';
            header('ETag: ' . $etiquetaEntidad);
            header('Cache-Control: private, no-cache');
            header('X-Content-Type-Options: nosniff');
            if ($this->coincideEtiquetaEntidad($etiquetaEntidad)) {
                http_response_code(304);
                exit;
            }
            header('Content-Type: ' . $qr['qr_tipoMime']);
            header("Content-Security-Policy: default-src 'none'");
            header('Content-Disposition: inline; filename="qr.' . ProcesadorQrPago::extensionDeTipo((string) $qr['qr_tipoMime']) . '"');
            header('Content-Length: ' . strlen((string) $qr['qr_contenido']));
            http_response_code(200);
            echo $qr['qr_contenido'];
            exit;
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::servirQr] ' . $error->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    private function coincideEtiquetaEntidad(string $etiquetaEntidad): bool
    {
        $enviada = (string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '');
        foreach (explode(',', $enviada) as $candidata) {
            if (preg_replace('/^\s*W\//', '', trim($candidata)) === $etiquetaEntidad) {
                return true;
            }
        }
        return false;
    }

    private function armarCriptoDisponible(?array $metodo): ?array
    {
        if ($metodo === null || (int) $metodo['mep_activo'] !== 1) {
            return null;
        }
        $redes = [];
        foreach ($this->datosPagoModelo->listarRedes(true) as $red) {
            $redes[] = [
                'clave' => (string) $red['red_clave'],
                'nombre' => (string) $red['red_nombre'],
                'etiqueta' => (string) $red['red_etiqueta'],
                'direccion' => (string) $red['red_direccion'],
                'tieneQr' => $red['qr_hash'] !== null,
                'qrHash' => $red['qr_hash'],
            ];
        }
        return $redes === [] ? null : ['nombre' => (string) $metodo['mep_nombre'], 'redes' => $redes];
    }

    private function armarPaypalDisponible(?array $metodo): ?array
    {
        if ($metodo === null || (int) $metodo['mep_activo'] !== 1 || !$this->estaMetodoCompleto($metodo)) {
            return null;
        }
        return [
            'nombre' => (string) $metodo['mep_nombre'],
            'correo' => $metodo['mep_paypalCorreo'],
            'enlace' => $metodo['mep_paypalEnlace'],
        ];
    }

    private function armarBancoDisponible(?array $metodo): ?array
    {
        if ($metodo === null || (int) $metodo['mep_activo'] !== 1 || !$this->estaMetodoCompleto($metodo)) {
            return null;
        }
        // Por ahora el cliente solo recibe el WhatsApp y la plantilla. Los datos de la cuenta (titular, documento,
        // entidad, tipo, cuenta, país/moneda y observaciones) se expondrán más adelante en un cambio aparte;
        // hasta entonces solo los devuelve datosPago/administracion a los roles 1 y 2.
        return [
            'nombre' => (string) $metodo['mep_nombre'],
            'numero' => (string) $metodo['mep_bancoNumero'],
            'plantilla' => $metodo['mep_bancoPlantilla'],
        ];
    }

    /** Datos completos de un método (RN-06), sin considerar su bandera de activo. */
    private function estaMetodoCompleto(array $metodo): bool
    {
        return match ((string) $metodo['mep_codigo']) {
            'CRIPTOMONEDA' => $this->datosPagoModelo->contarRedesActivas() > 0,
            'PAYPAL' => ($metodo['mep_paypalCorreo'] ?? '') !== '' || ($metodo['mep_paypalEnlace'] ?? '') !== '',
            'BANCO' => ($metodo['mep_bancoNumero'] ?? '') !== '',
            default => false,
        };
    }

    private function esAdministrador(): bool
    {
        foreach (ContextoSesion::roles() as $rol) {
            if (in_array((int) $rol['rol_id'], self::ROLES_ADMINISTRACION, true)) {
                return true;
            }
        }
        return false;
    }

    /** Rol administrador (403 uniforme) y tope de escrituras por minuto (RN-08, RN-16). */
    private function iniciarEscritura(string $origen): void
    {
        $this->exigirRolAdministrador(self::ROLES_ADMINISTRACION, $origen);
        $idUsuario = $this->idUsuarioSesion();
        $ventana = gmdate('Y-m-d H:i:00');
        $claveHash = hash('sha256', 'DATOSPAGO_ESCRITURA:' . $idUsuario);
        $sqlIncrementarEscrituras = 'INSERT INTO sgen_limitepeticion (lip_clave, lip_ventana, lip_contador)
            VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE lip_contador = lip_contador + 1';
        $this->enlace->ejecutarActualizacion($sqlIncrementarEscrituras, 'ss', $claveHash, $ventana);
        $sqlContarEscrituras = 'SELECT lip_contador FROM sgen_limitepeticion WHERE lip_clave = ? AND lip_ventana = ?';
        $fila = $this->enlace->ejecutarConsultaSimpleFila($sqlContarEscrituras, 'ss', $claveHash, $ventana);
        $contador = (int) ($fila['lip_contador'] ?? 0);
        if ($contador <= self::MAXIMO_ESCRITURAS_POR_MINUTO) {
            return;
        }
        if ($contador === self::MAXIMO_ESCRITURAS_POR_MINUTO + 1) {
            $this->registrarAuditoria('LIMITE_PETICIONES', 'datosPago escrituras=' . $contador);
        }
        header('Retry-After: ' . max(1, self::VENTANA_SEGUNDOS - (time() % self::VENTANA_SEGUNDOS)));
        $this->respuestaErrorSimple(LimitadorPeticiones::MENSAJE_LIMITE, 429);
    }

    private function registrarAuditoria(string $evento, string $detalle): void
    {
        try {
            $auditoria = new RegistroAuditoria($this->enlace, SERVICIO_ACTUAL);
            $auditoria->registrar($evento, $this->idUsuarioSesion(), ContextoSesion::familia(), $detalle);
        } catch (Throwable $error) {
            error_log('[DatosPagoCtrl::registrarAuditoria] ' . $error->getMessage());
        }
    }

    private function exigirCamposDatosPago(array $datos, array $camposPermitidos): void
    {
        if (array_diff_key($datos, array_flip($camposPermitidos)) !== []) {
            $this->respuestaErrorSimple('La solicitud contiene campos no permitidos', 400);
        }
    }

    private function exigirRedExistente(int $idRed): array
    {
        $red = $this->datosPagoModelo->obtenerRedPorId($idRed);
        if ($red === null) {
            $this->respuestaErrorSimple(self::MENSAJE_RED_INEXISTENTE, 400);
        }
        return $red;
    }

    private function exigirMetodoExistente(string $codigoMetodo): array
    {
        $metodo = $this->datosPagoModelo->obtenerMetodoPorCodigo($codigoMetodo);
        if ($metodo === null) {
            $this->respuestaErrorSimple('El método de pago no existe', 400);
        }
        return $metodo;
    }

    private function leerClaveRed(mixed $valor): string
    {
        if (!is_string($valor) || trim($valor) === '') {
            $this->respuestaErrorSimple("El campo 'red_clave' es requerido", 400);
        }
        $claveRed = strtoupper(trim($valor));
        if (preg_match(ValidadorDatosPago::PATRON_CLAVE_RED, $claveRed) !== 1) {
            $this->respuestaErrorSimple("El campo 'red_clave' es inválido", 400);
        }
        return $claveRed;
    }

    /** La clave no se edita: si se envía debe coincidir con la guardada. */
    private function leerClaveRedEditada(mixed $valorEnviado, string $claveGuardada): string
    {
        if ($valorEnviado !== null && $this->leerClaveRed($valorEnviado) !== $claveGuardada) {
            $this->respuestaErrorSimple('La clave de la red no se puede modificar', 400);
        }
        return $claveGuardada;
    }

    private function textoOpcionalONulo(string $texto): ?string
    {
        return $texto === '' ? null : $texto;
    }

    private function leerDocumentoOpcional(mixed $valor): ?string
    {
        if ($valor === null || (is_string($valor) && trim($valor) === '')) {
            return null;
        }
        $documento = is_string($valor) ? ValidadorDatosPago::normalizarDocumentoBanco($valor) : null;
        if ($documento === null) {
            $this->respuestaErrorSimple("El campo 'mep_bancoDocumento' es inválido", 400);
        }
        return $documento;
    }

    private function leerCuentaOpcional(mixed $valor): ?string
    {
        if ($valor === null || (is_string($valor) && trim($valor) === '')) {
            return null;
        }
        $cuenta = is_string($valor) ? ValidadorDatosPago::normalizarCuentaBanco($valor) : null;
        if ($cuenta === null) {
            $this->respuestaErrorSimple("El campo 'mep_bancoCuenta' es inválido", 400);
        }
        return $cuenta;
    }

    private function leerTipoCuentaOpcional(mixed $valor): ?string
    {
        if ($valor === null || (is_string($valor) && trim($valor) === '')) {
            return null;
        }
        return $this->leerOpcion($valor, 'mep_bancoTipoCuenta', ValidadorDatosPago::TIPOS_CUENTA_BANCO_PERMITIDOS);
    }

    private function leerDireccion(string $claveRed, mixed $valor): string
    {
        if (!is_string($valor) || trim($valor) === '') {
            $this->respuestaErrorSimple("El campo 'red_direccion' es requerido", 400);
        }
        $direccion = ValidadorDatosPago::normalizarDireccion($claveRed, $valor);
        if ($direccion === null) {
            $this->respuestaErrorSimple('La dirección no tiene un formato válido para la red', 400);
        }
        return $direccion;
    }

    /**
     * @param 'normalizarCorreoPaypal'|'normalizarEnlacePaypal' $normalizador
     */
    private function leerValorOpcional(mixed $valor, string $campo, string $normalizador): ?string
    {
        if ($valor === null || (is_string($valor) && trim($valor) === '')) {
            return null;
        }
        $valorNormalizado = is_string($valor) ? ValidadorDatosPago::$normalizador($valor) : null;
        if ($valorNormalizado === null) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        return $valorNormalizado;
    }
}
