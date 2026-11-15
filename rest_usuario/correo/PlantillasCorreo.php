<?php

declare(strict_types=1);

final class PlantillasCorreo
{
    public static function codigoRecuperacion(string $nombres, string $codigo): array
    {
        $nombrePlano = html_entity_decode($nombres, ENT_QUOTES, 'UTF-8');

        return [
            'asunto' => 'Código para restablecer tu clave - Criterio Kelly',
            'cuerpo' => "Hola {$nombrePlano}:\n\n"
                . "Tu código para restablecer la clave es: {$codigo}\n\n"
                . "Vence en 15 minutos y solo se puede usar una vez. "
                . "Si no lo solicitaste, ignora este correo: tu clave no ha cambiado.\n\n"
                . "Este es un mensaje automático, no respondas a este correo.",
        ];
    }

    public static function codigoVerificacion(string $nombres, string $codigo): array
    {
        $nombrePlano = html_entity_decode($nombres, ENT_QUOTES, 'UTF-8');

        return [
            'asunto' => 'Código para activar tu cuenta - Criterio Kelly',
            'cuerpo' => "Hola {$nombrePlano}:\n\n"
                . "Tu código para activar tu cuenta es: {$codigo}\n\n"
                . "Vence en 15 minutos y solo se puede usar una vez. "
                . "Si no creaste una cuenta en Criterio Kelly, ignora este correo: "
                . "nadie podrá usarla sin este código.\n\n"
                . "Este es un mensaje automático, no respondas a este correo.",
        ];
    }

    public static function avisoCambioClave(string $nombres, string $fechaHora): array
    {
        $nombrePlano = html_entity_decode($nombres, ENT_QUOTES, 'UTF-8');

        return [
            'asunto' => 'Tu clave fue cambiada - Criterio Kelly',
            'cuerpo' => "Hola {$nombrePlano}:\n\n"
                . "La clave de tu cuenta se cambió el {$fechaHora} (hora del servidor) "
                . "y se cerraron tus otras sesiones abiertas.\n\n"
                . "Si no fuiste tú, solicita de inmediato un código de recuperación desde la app "
                . "y avisa al administrador.\n\n"
                . "Este es un mensaje automático, no respondas a este correo.",
        ];
    }

    public static function alertaSeguridad(array $conteos, string $entorno): array
    {
        $total = array_sum($conteos);

        return [
            'asunto' => "Alerta de seguridad ({$entorno}) - Criterio Kelly",
            'cuerpo' => "En los últimos 60 minutos se registraron {$total} eventos de seguridad "
                . "(umbral: más de 10):\n\n"
                . '- REFRESH_REUTILIZADO: ' . ($conteos['REFRESH_REUTILIZADO'] ?? 0) . "\n"
                . '- BLOQUEO_IP: ' . ($conteos['BLOQUEO_IP'] ?? 0) . "\n"
                . '- ACCESO_DENEGADO: ' . ($conteos['ACCESO_DENEGADO'] ?? 0) . "\n\n"
                . "Revisa la tabla sgen_auditoria y los logs del servidor.",
        ];
    }
}
