<?php

declare(strict_types=1);

final class RegistroAuditoria
{
    public const EVENTOS = [
        'LOGIN_OK', 'LOGIN_FALLIDO', 'BLOQUEO_USUARIO', 'BLOQUEO_IP',
        'LIMITE_PETICIONES', 'RENOVAR', 'REFRESH_REUTILIZADO', 'SESION_ANOMALA',
        'CIERRE_SESION', 'CIERRE_TODAS', 'RECUPERACION_SOLICITADA',
        'CLAVE_RESTABLECIDA', 'CLAVE_CAMBIADA', 'ACCESO_DENEGADO',
        'ACTIVACION_SOLICITADA', 'CUENTA_ACTIVADA', 'ACTIVACION_FALLIDA',
        'PRUEBA_INICIADA', 'PRUEBA_RECHAZADA', 'PRUEBA_EXPIRADA', 'PLAN_MEJORADO',
        'PAGO_CONFIRMADO', 'PAGO_RECHAZADO', 'PLAN_CANCELADO', 'PLAN_CORTADO',
        'LIMITE_PLAN_RECHAZADO', 'PLAN_RENOVACION', 'PLAN_RENOV_ANULADA',
        'PLAN_ACTIV_PROGRAM', 'PLAN_PROGRAMADO',
        'DATOPAGO_CREADO', 'DATOPAGO_EDITADO', 'DATOPAGO_ESTADO', 'DATOPAGO_ELIMINA',
        'QRPAGO_SUBIDO', 'QRPAGO_QUITADO',
    ];

    public function __construct(private Enlace $enlace, private string $servicio)
    {
    }

    public function registrar(string $evento, ?int $idUsuario = null, ?string $familia = null, string $detalle = ''): void
    {
        if (!in_array($evento, self::EVENTOS, true)
            || preg_match('/[A-Za-z0-9_-]{32,}/', $detalle) === 1) {
            throw new InvalidArgumentException('Evento de auditoría inválido');
        }
        $agente = preg_replace('/[\x00-\x1F\x7F]/', '', (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        $agente = mb_substr((string) $agente, 0, 255);
        $sqlInsertarAuditoria = 'INSERT INTO sgen_auditoria
            (aud_fecha, aud_evento, aud_servicio, aud_usuId, aud_sesFamilia, aud_ip, aud_agenteUsuario, aud_detalle)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        $this->enlace->ejecutarInsercionRetornaID(
            $sqlInsertarAuditoria,
            'sssissss',
            gmdate('Y-m-d H:i:s'),
            $evento,
            $this->servicio,
            $idUsuario,
            $familia,
            ClienteIp::obtener(),
            $agente,
            mb_substr($detalle, 0, 255)
        );
    }
}
