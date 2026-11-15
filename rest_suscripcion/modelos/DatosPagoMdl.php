<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

/** Acceso a datos de pago administrables: métodos, redes USDT y QR (HLT-29). Devuelve datos crudos. */
class DatosPagoMdl
{
    private Enlace $enlace;

    public function __construct(?Enlace $enlace = null)
    {
        $this->enlace = $enlace ?? new Enlace();
    }

    /** @return array<int, array<string, mixed>> */
    public function listarMetodos(): array
    {
        $sqlListarMetodos = 'SELECT mep_idMetodo, mep_codigo, mep_nombre, mep_activo, mep_orden,
            mep_paypalCorreo, mep_paypalEnlace, mep_bancoNumero, mep_bancoPlantilla,
            mep_bancoTitular, mep_bancoDocumento, mep_bancoEntidad, mep_bancoTipoCuenta, mep_bancoCuenta,
            mep_bancoPaisMoneda, mep_bancoObservaciones,
            mep_creadoPor, mep_fechacrea, mep_actualizadoPor, mep_fechaact
            FROM spsu_metodopago ORDER BY mep_orden, mep_idMetodo';
        return $this->aFilas($this->enlace->ejecutarConsulta($sqlListarMetodos));
    }

    public function obtenerMetodoPorCodigo(string $codigoMetodo): ?array
    {
        $sqlObtenerMetodo = 'SELECT mep_idMetodo, mep_codigo, mep_nombre, mep_activo, mep_orden,
            mep_paypalCorreo, mep_paypalEnlace, mep_bancoNumero, mep_bancoPlantilla
            FROM spsu_metodopago WHERE mep_codigo = ? LIMIT 1';
        return $this->enlace->ejecutarConsultaSimpleFila($sqlObtenerMetodo, 's', $codigoMetodo);
    }

    /**
     * Redes con datos del QR pero sin su contenido (no se carga la imagen en listados).
     *
     * @return array<int, array<string, mixed>>
     */
    public function listarRedes(bool $soloActivas): array
    {
        $sqlListarRedes = 'SELECT r.red_idRed, r.red_clave, r.red_nombre, r.red_etiqueta, r.red_direccion,
            r.red_activo, r.red_orden, r.red_creadoPor, r.red_fechacrea, r.red_actualizadoPor, r.red_fechaact,
            q.qr_tipoMime, q.qr_tamano, q.qr_hash
            FROM spsu_redusdt r
            LEFT JOIN spsu_qrpago q ON q.qr_redId = r.red_idRed
            WHERE (? = 0 OR r.red_activo = 1)
            ORDER BY r.red_orden, r.red_idRed';
        return $this->aFilas($this->enlace->ejecutarConsulta($sqlListarRedes, 'i', $soloActivas ? 1 : 0));
    }

    public function obtenerRedPorId(int $idRed): ?array
    {
        $sqlObtenerRedPorId = 'SELECT red_idRed, red_clave, red_nombre, red_etiqueta, red_direccion, red_activo, red_orden
            FROM spsu_redusdt WHERE red_idRed = ? LIMIT 1';
        return $this->enlace->ejecutarConsultaSimpleFila($sqlObtenerRedPorId, 'i', $idRed);
    }

    public function obtenerRedPorClave(string $claveRed): ?array
    {
        $sqlObtenerRedPorClave = 'SELECT red_idRed, red_clave, red_activo
            FROM spsu_redusdt WHERE red_clave = ? LIMIT 1';
        return $this->enlace->ejecutarConsultaSimpleFila($sqlObtenerRedPorClave, 's', $claveRed);
    }

    public function crearRed(
        string $claveRed,
        string $nombre,
        string $etiqueta,
        string $direccion,
        int $esActiva,
        int $orden,
        int $idUsuario,
        string $fechaUtc
    ): int {
        $sqlCrearRed = 'INSERT INTO spsu_redusdt
            (red_clave, red_nombre, red_etiqueta, red_direccion, red_activo, red_orden,
            red_creadoPor, red_fechacrea, red_actualizadoPor, red_fechaact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        return $this->enlace->ejecutarInsercionRetornaID(
            $sqlCrearRed,
            'ssssiiisis',
            $claveRed,
            $nombre,
            $etiqueta,
            $direccion,
            $esActiva,
            $orden,
            $idUsuario,
            $fechaUtc,
            $idUsuario,
            $fechaUtc
        );
    }

    public function actualizarRed(
        int $idRed,
        string $nombre,
        string $etiqueta,
        string $direccion,
        int $esActiva,
        int $orden,
        int $idUsuario,
        string $fechaUtc
    ): void {
        $sqlActualizarRed = 'UPDATE spsu_redusdt
            SET red_nombre = ?, red_etiqueta = ?, red_direccion = ?, red_activo = ?, red_orden = ?,
            red_actualizadoPor = ?, red_fechaact = ?
            WHERE red_idRed = ?';
        $this->enlace->ejecutarActualizacion(
            $sqlActualizarRed,
            'sssiiisi',
            $nombre,
            $etiqueta,
            $direccion,
            $esActiva,
            $orden,
            $idUsuario,
            $fechaUtc,
            $idRed
        );
    }

    public function cambiarEstadoRed(int $idRed, int $esActiva, int $idUsuario, string $fechaUtc): void
    {
        $sqlCambiarEstadoRed = 'UPDATE spsu_redusdt SET red_activo = ?, red_actualizadoPor = ?, red_fechaact = ?
            WHERE red_idRed = ?';
        $this->enlace->ejecutarActualizacion($sqlCambiarEstadoRed, 'iisi', $esActiva, $idUsuario, $fechaUtc, $idRed);
    }

    /** El QR de la red se elimina por la FK ON DELETE CASCADE. */
    public function eliminarRed(int $idRed): void
    {
        $sqlEliminarRed = 'DELETE FROM spsu_redusdt WHERE red_idRed = ?';
        $this->enlace->ejecutarActualizacion($sqlEliminarRed, 'i', $idRed);
    }

    public function contarRedesActivas(): int
    {
        $sqlContarRedesActivas = 'SELECT COUNT(*) AS total FROM spsu_redusdt WHERE red_activo = 1';
        $fila = $this->enlace->ejecutarConsultaSimpleFila($sqlContarRedesActivas);
        return (int) ($fila['total'] ?? 0);
    }

    public function guardarPaypal(?string $correo, ?string $enlacePaypal, int $idUsuario, string $fechaUtc): void
    {
        $sqlGuardarPaypal = 'UPDATE spsu_metodopago
            SET mep_paypalCorreo = ?, mep_paypalEnlace = ?, mep_actualizadoPor = ?, mep_fechaact = ?
            WHERE mep_codigo = ?';
        $this->enlace->ejecutarActualizacion(
            $sqlGuardarPaypal,
            'ssiss',
            $correo,
            $enlacePaypal,
            $idUsuario,
            $fechaUtc,
            'PAYPAL'
        );
    }

    /**
     * Guarda el WhatsApp, la plantilla y los datos de la cuenta bancaria (estos últimos aún no se muestran al cliente).
     *
     * @param array{numero:string, plantilla:?string, titular:?string, documento:?string, entidad:?string,
     *     tipoCuenta:?string, cuenta:?string, paisMoneda:?string, observaciones:?string} $datosBanco
     */
    public function guardarBanco(array $datosBanco, int $idUsuario, string $fechaUtc): void
    {
        $sqlGuardarBanco = 'UPDATE spsu_metodopago
            SET mep_bancoNumero = ?, mep_bancoPlantilla = ?, mep_bancoTitular = ?, mep_bancoDocumento = ?,
            mep_bancoEntidad = ?, mep_bancoTipoCuenta = ?, mep_bancoCuenta = ?, mep_bancoPaisMoneda = ?,
            mep_bancoObservaciones = ?, mep_actualizadoPor = ?, mep_fechaact = ?
            WHERE mep_codigo = ?';
        $this->enlace->ejecutarActualizacion(
            $sqlGuardarBanco,
            'sssssssssiss',
            $datosBanco['numero'],
            $datosBanco['plantilla'],
            $datosBanco['titular'],
            $datosBanco['documento'],
            $datosBanco['entidad'],
            $datosBanco['tipoCuenta'],
            $datosBanco['cuenta'],
            $datosBanco['paisMoneda'],
            $datosBanco['observaciones'],
            $idUsuario,
            $fechaUtc,
            'BANCO'
        );
    }

    public function cambiarEstadoMetodo(
        string $codigoMetodo,
        int $esActivo,
        ?int $orden,
        int $idUsuario,
        string $fechaUtc
    ): void {
        $sqlCambiarEstadoMetodo = 'UPDATE spsu_metodopago
            SET mep_activo = ?, mep_orden = COALESCE(?, mep_orden), mep_actualizadoPor = ?, mep_fechaact = ?
            WHERE mep_codigo = ?';
        $this->enlace->ejecutarActualizacion(
            $sqlCambiarEstadoMetodo,
            'iiiss',
            $esActivo,
            $orden,
            $idUsuario,
            $fechaUtc,
            $codigoMetodo
        );
    }

    /** Inserta o reemplaza el QR de la red (una fila por red) dentro de una transacción. */
    public function guardarQr(
        int $idRed,
        string $tipoMime,
        int $tamano,
        string $hash,
        string $contenido,
        int $idUsuario,
        string $fechaUtc
    ): void {
        $sqlGuardarQr = 'INSERT INTO spsu_qrpago
            (qr_redId, qr_tipoMime, qr_tamano, qr_hash, qr_contenido,
            qr_creadoPor, qr_fechacrea, qr_actualizadoPor, qr_fechaact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE qr_tipoMime = VALUES(qr_tipoMime), qr_tamano = VALUES(qr_tamano),
            qr_hash = VALUES(qr_hash), qr_contenido = VALUES(qr_contenido),
            qr_actualizadoPor = VALUES(qr_actualizadoPor), qr_fechaact = VALUES(qr_fechaact)';
        $this->enlace->iniciarTransaccion();
        try {
            $this->enlace->ejecutarActualizacion(
                $sqlGuardarQr,
                'isissisis',
                $idRed,
                $tipoMime,
                $tamano,
                $hash,
                $contenido,
                $idUsuario,
                $fechaUtc,
                $idUsuario,
                $fechaUtc
            );
            $this->enlace->confirmarTransaccion();
        } catch (Throwable $error) {
            $this->enlace->revertirTransaccion();
            throw $error;
        }
    }

    public function quitarQr(int $idRed): int
    {
        $sqlQuitarQr = 'DELETE FROM spsu_qrpago WHERE qr_redId = ?';
        return $this->enlace->ejecutarActualizacion($sqlQuitarQr, 'i', $idRed);
    }

    /** Lee el QR de una red por clave, con el estado de la red y del método para decidir el acceso. */
    public function leerQr(string $claveRed): ?array
    {
        $sqlLeerQr = 'SELECT q.qr_tipoMime, q.qr_tamano, q.qr_hash, q.qr_contenido, r.red_activo,
            (SELECT m.mep_activo FROM spsu_metodopago m WHERE m.mep_codigo = ?) AS metodo_activo
            FROM spsu_qrpago q
            INNER JOIN spsu_redusdt r ON r.red_idRed = q.qr_redId
            WHERE r.red_clave = ? LIMIT 1';
        return $this->enlace->ejecutarConsultaSimpleFila($sqlLeerQr, 'ss', 'CRIPTOMONEDA', $claveRed);
    }

    /** @return array<int, array<string, mixed>> */
    private function aFilas(mysqli_result|bool|null $resultado): array
    {
        $filas = [];
        if ($resultado instanceof mysqli_result) {
            while ($fila = $resultado->fetch_assoc()) {
                $filas[] = $fila;
            }
        }
        return $filas;
    }
}
