<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/ContextoSesion.php';
require_once __DIR__ . '/../configuracion/RegistroAuditoria.php';
require_once __DIR__ . '/../configuracion/enlace.php';

abstract class BaseCtrl
{
    protected const ENTERO_MAXIMO = 2147483647;
    protected const MENSAJE_ACCESO_DENEGADO = 'Acceso denegado';
    protected const TAMANO_MAXIMO_IMAGEN_BYTES = 524288;
    protected const VALORES_SIN_IMAGEN = ['', '--'];

    protected const TIPOS_IMAGEN_PERMITIDOS = [
        'image/jpeg' => 'jpeg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    protected function validarDatos(array $datos, array $camposRequeridos = []): array
    {
        $errores = [];
        foreach ($camposRequeridos as $campo) {
            if (!array_key_exists($campo, $datos) || $datos[$campo] === null || $datos[$campo] === '') {
                $errores[] = "El campo '$campo' es requerido";
            }
        }
        return $errores;
    }

    protected function limpiarDatos(array $datos): array
    {
        $datosLimpios = [];
        foreach ($datos as $clave => $valor) {
            $datosLimpios[$clave] = is_string($valor)
                ? htmlspecialchars(trim($valor), ENT_QUOTES, 'UTF-8')
                : $valor;
        }
        return $datosLimpios;
    }

    protected function idUsuarioSesion(): int
    {
        return ContextoSesion::idUsuario();
    }

    protected function verificarUsuarioEnviado(mixed $idEnviado, string $origen): void
    {
        if ($idEnviado === null || $idEnviado === '') {
            return;
        }
        $idValidado = filter_var($idEnviado, FILTER_VALIDATE_INT);
        if ($idValidado === false || (int) $idValidado !== $this->idUsuarioSesion()) {
            $this->denegarAcceso("usuario enviado en $origen");
        }
    }

    protected function denegarAcceso(string $motivo): void
    {
        $idUsuario = $this->idUsuarioSesion();
        error_log('[ACCESO_DENEGADO] usuario=' . $idUsuario . ' ' . $motivo);
        try {
            $auditoria = new RegistroAuditoria(new Enlace(), SERVICIO_ACTUAL);
            $auditoria->registrar('ACCESO_DENEGADO', $idUsuario, ContextoSesion::familia(), $motivo);
        } catch (Throwable $error) {
            error_log('[BaseCtrl::denegarAcceso] ' . $error->getMessage());
        }
        $this->respuestaErrorSimple(self::MENSAJE_ACCESO_DENEGADO, 403);
    }

    protected function leerEntero(mixed $valor, string $campo, int $minimo = 1, int $maximo = self::ENTERO_MAXIMO): int
    {
        if ($valor === null || $valor === '') {
            $this->respuestaErrorSimple("El campo '$campo' es requerido", 400);
        }
        $entero = filter_var($valor, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => $minimo, 'max_range' => $maximo],
        ]);
        if ($entero === false) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        return (int) $entero;
    }

    protected function leerDecimal(mixed $valor, string $campo, float $minimo, float $maximo): float
    {
        if ($valor === null || $valor === '') {
            $this->respuestaErrorSimple("El campo '$campo' es requerido", 400);
        }
        if (!is_int($valor) && !is_float($valor) && !is_string($valor)) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        $decimal = filter_var($valor, FILTER_VALIDATE_FLOAT);
        if ($decimal === false || !is_finite((float) $decimal)
            || (float) $decimal < $minimo || (float) $decimal > $maximo) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        return (float) $decimal;
    }

    protected function leerTexto(
        mixed $valor,
        string $campo,
        int $longitudMaxima,
        bool $esRequerido,
        ?string $patron = null
    ): string {
        if (!is_string($valor)) {
            if ($esRequerido || $valor !== null) {
                $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
            }
            return '';
        }
        $valorRecortado = trim($valor);
        if ($esRequerido && $valorRecortado === '') {
            $this->respuestaErrorSimple("El campo '$campo' es requerido", 400);
        }
        if ($patron !== null && $valorRecortado !== '' && preg_match($patron, $valorRecortado) !== 1) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        $valorEscapado = htmlspecialchars($valorRecortado, ENT_QUOTES, 'UTF-8');
        if (mb_strlen($valorEscapado) > $longitudMaxima) {
            $this->respuestaErrorSimple("El campo '$campo' excede la longitud permitida", 400);
        }
        return $valorEscapado;
    }

    protected function leerOpcion(mixed $valor, string $campo, array $permitidos): string
    {
        if (!is_string($valor)) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        $opcion = strtoupper(trim($valor));
        if (!in_array($opcion, $permitidos, true)) {
            $this->respuestaErrorSimple(
                "El campo '$campo' debe ser uno de: " . implode(', ', $permitidos),
                400
            );
        }
        return $opcion;
    }

    protected function leerFecha(mixed $valor, string $campo): string
    {
        if (!is_string($valor)) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        $fecha = DateTimeImmutable::createFromFormat('!Y-m-d', $valor);
        $errores = DateTimeImmutable::getLastErrors();
        if (!$fecha || ($errores !== false && ($errores['warning_count'] > 0 || $errores['error_count'] > 0))
            || $fecha->format('Y-m-d') !== $valor) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        return $fecha->format('Y-m-d');
    }

    protected function leerFechaHora(mixed $valor, string $campo): string
    {
        if (!is_string($valor)
            || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $valor) !== 1) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
        try {
            return (new DateTimeImmutable($valor))->format('Y-m-d H:i:s');
        } catch (Throwable $error) {
            $this->respuestaErrorSimple("El campo '$campo' es inválido", 400);
        }
    }

    protected function leerImagen(mixed $valor, string $campo): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        if (!is_string($valor)) {
            $this->respuestaErrorSimple("La imagen de '$campo' no es válida", 400);
        }
        if (in_array($valor, self::VALORES_SIN_IMAGEN, true)) {
            return $valor;
        }
        if (!preg_match('/^data:([^;]+);base64,(.+)$/s', $valor, $partes)) {
            $this->respuestaErrorSimple("La imagen de '$campo' no es válida", 400);
        }
        $contenido = base64_decode($partes[2], true);
        if ($contenido === false || strlen($contenido) > self::TAMANO_MAXIMO_IMAGEN_BYTES
            || !function_exists('finfo_open')) {
            $this->respuestaErrorSimple("La imagen de '$campo' no es válida", 400);
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $tipoMime = $finfo ? finfo_buffer($finfo, $contenido) : false;
        if ($finfo) {
            finfo_close($finfo);
        }
        if (!is_string($tipoMime) || !array_key_exists($tipoMime, self::TIPOS_IMAGEN_PERMITIDOS)
            || strtolower($partes[1]) !== $tipoMime) {
            $this->respuestaErrorSimple("La imagen de '$campo' no es válida", 400);
        }
        return $valor;
    }

    protected function respuestaExitosaSimple(mixed $dato): void
    {
        if ($dato === null) {
            $dato = ['success' => 'ok'];
        }
        $this->respuestaJsonSimple($dato, 200);
    }

    protected function respuestaJsonSimple(mixed $dato = null, int $codigoHttp = 200): void
    {
        http_response_code($codigoHttp);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($dato, JSON_UNESCAPED_UNICODE);
        exit;
    }

    protected function respuestaErrorSimple(string $mensaje, int $codigoHttp = 400): void
    {
        $this->respuestaJsonSimple(['error' => $mensaje], $codigoHttp);
    }
}
