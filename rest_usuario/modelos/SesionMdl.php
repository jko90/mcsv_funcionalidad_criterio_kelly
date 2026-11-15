<?php

declare(strict_types=1);

require_once __DIR__ . '/../configuracion/enlace.php';

class SesionMdl
{
    public function __construct(private Enlace $enlace)
    {
    }

    public function iniciarTransaccion(): void
    {
        $this->enlace->iniciarTransaccion();
    }

    public function confirmarTransaccion(): void
    {
        $this->enlace->confirmarTransaccion();
    }

    public function revertirTransaccion(): void
    {
        $this->enlace->revertirTransaccion();
    }

    public function crearSesion(
        int $idUsuario,
        string $familia,
        string $hashAcceso,
        string $hashRefresh,
        string $accesoExpira,
        string $refreshExpira,
        string $familiaExpira,
        string $ahora,
        string $ip,
        string $agente,
        string $navegador,
        string $cliente
    ): int {
        $sqlInsertarSesion = "INSERT INTO sgen_sesion
            (ses_familia, ses_usuId, ses_hashAcceso, ses_hashRefresh, ses_accesoExpira,
             ses_refreshExpira, ses_familiaExpira, ses_fechaCreacion, ses_ultimoUso,
             ses_ip, ses_agenteUsuario, ses_navegador, ses_cliente, ses_estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'A')";
        return $this->enlace->ejecutarInsercionRetornaID(
            $sqlInsertarSesion,
            'sisssssssssss',
            $familia,
            $idUsuario,
            $hashAcceso,
            $hashRefresh,
            $accesoExpira,
            $refreshExpira,
            $familiaExpira,
            $ahora,
            $ahora,
            $ip,
            $agente,
            $navegador,
            $cliente
        );
    }

    public function buscarPorRefreshParaActualizar(string $hashRefresh): ?array
    {
        $sqlBuscarSesion = 'SELECT ses_id, ses_familia, ses_usuId, ses_hashRefresh, ses_estado,
            ses_refreshExpira, ses_familiaExpira, ses_cliente, ses_navegador
            FROM sgen_sesion WHERE ses_hashRefresh = ? FOR UPDATE';
        return $this->enlace->ejecutarConsultaSimpleFila($sqlBuscarSesion, 's', $hashRefresh);
    }

    public function marcarRotada(int $idSesion, string $ahora): int
    {
        return $this->enlace->ejecutarActualizacion(
            "UPDATE sgen_sesion SET ses_estado = 'R', ses_fechaRevocacion = ?
             WHERE ses_id = ? AND ses_estado = 'A'",
            'si',
            $ahora,
            $idSesion
        );
    }

    public function revocarFamilia(string $familia, string $motivo, string $ahora): int
    {
        return $this->enlace->ejecutarActualizacion(
            "UPDATE sgen_sesion SET ses_estado = 'V', ses_motivoRevocacion = ?, ses_fechaRevocacion = ?
             WHERE ses_familia = ? AND ses_estado = 'A'",
            'sss',
            $motivo,
            $ahora,
            $familia
        );
    }

    public function revocarTodasDeUsuario(int $idUsuario, string $motivo, string $ahora): int
    {
        return $this->enlace->ejecutarActualizacion(
            "UPDATE sgen_sesion SET ses_estado = 'V', ses_motivoRevocacion = ?, ses_fechaRevocacion = ?
             WHERE ses_usuId = ? AND ses_estado = 'A'",
            'ssi',
            $motivo,
            $ahora,
            $idUsuario
        );
    }

    public static function clasificarNavegador(string $agente): string
    {
        if (str_contains($agente, 'Edg/')) {
            return 'EDGE';
        }
        if (str_contains($agente, 'OPR/')) {
            return 'OPERA';
        }
        if (str_contains($agente, 'Chrome/') || str_contains($agente, 'CriOS/')) {
            return 'CHROME';
        }
        if (str_contains($agente, 'Firefox/') || str_contains($agente, 'FxiOS/')) {
            return 'FIREFOX';
        }
        if (str_contains($agente, 'Safari/')) {
            return 'SAFARI';
        }
        return 'OTRO';
    }
}
