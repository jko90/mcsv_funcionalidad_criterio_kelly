<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as ExcepcionCorreo;
use PHPMailer\PHPMailer\PHPMailer;

final class EnviadorCorreo
{
    public const TIEMPO_ESPERA_SMTP_SEGUNDOS = 5;
    public const SUBCARPETA_REGISTROS = 'correos';

    /**
     * Carpeta de los registros de correo de local (logs/correos/). Se crea bajo demanda: solo se
     * invoca en modo log, que está prohibido fuera de local.
     */
    public static function carpetaRegistros(): string
    {
        $carpeta = Configuracion::obtener('RUTA_LOGS') . DIRECTORY_SEPARATOR . self::SUBCARPETA_REGISTROS;
        if (!is_dir($carpeta) && !@mkdir($carpeta, 0750, true) && !is_dir($carpeta)) {
            throw new RuntimeException('No se pudo crear la carpeta de registros de correo');
        }

        return $carpeta;
    }

    /**
     * Solo para pruebas locales (modo log): deja el correo en un .txt propio dentro de RUTA_LOGS,
     * con las cabeceras de un correo real, para revisarlo sin abrir el log acumulado.
     */
    private function guardarComoArchivo(string $destinatario, array $plantilla): void
    {
        $nombreArchivo = 'correo-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.txt';
        $ruta = self::carpetaRegistros() . DIRECTORY_SEPARATOR . $nombreArchivo;
        $contenido = 'From: ' . Configuracion::obtener('CORREO_REMITENTE_NOMBRE')
            . ' <' . Configuracion::obtener('CORREO_REMITENTE') . ">\n"
            . "To: {$destinatario}\n"
            . 'Subject: ' . (string) $plantilla['asunto'] . "\n"
            . 'Date: ' . date(DATE_RFC2822) . "\n"
            . "MIME-Version: 1.0\n"
            . "Content-Type: text/plain; charset=UTF-8\n\n"
            . (string) $plantilla['cuerpo'] . "\n";
        if (file_put_contents($ruta, $contenido, LOCK_EX) === false) {
            throw new RuntimeException('No se pudo guardar el correo como archivo');
        }
    }

    public function enviar(string $destinatario, array $plantilla): void
    {
        $destinatario = html_entity_decode($destinatario, ENT_QUOTES, 'UTF-8');
        if (str_contains($destinatario, "\r") || str_contains($destinatario, "\n")
            || !PHPMailer::validateAddress($destinatario)) {
            throw new InvalidArgumentException('Destinatario de correo inválido');
        }

        $modo = Configuracion::obtener('CORREO_MODO');
        if ($modo === 'log') {
            if (!Configuracion::esProduccion()) {
                $ruta = self::carpetaRegistros() . DIRECTORY_SEPARATOR . 'correos.log';
                $contenido = '=== ' . date(DATE_ATOM) . " ===\n"
                    . "Para: {$destinatario}\n"
                    . 'Asunto: ' . (string) $plantilla['asunto'] . "\n\n"
                    . (string) $plantilla['cuerpo'] . "\n";
                if (file_put_contents($ruta, $contenido, FILE_APPEND | LOCK_EX) === false) {
                    throw new RuntimeException('No se pudo registrar el correo');
                }
                $this->guardarComoArchivo($destinatario, $plantilla);
                return;
            }

            throw new RuntimeException('El modo de correo log no está permitido');
        }

        $correo = new PHPMailer(true);
        try {
            if ($modo === 'mail') {
                // Igual que el proyecto investmentsdigital: función mail() de PHP, que usa el
                // servicio de correo del hosting. Solo envía si el servidor tiene uno configurado.
                $correo->isMail();
            } else {
                $correo->isSMTP();
                $correo->Host = Configuracion::obtener('SMTP_HOST');
                $correo->Port = Configuracion::obtenerEntero('SMTP_PUERTO');
                $correo->SMTPAuth = Configuracion::obtener('SMTP_USUARIO') !== '';
                $correo->Username = Configuracion::obtener('SMTP_USUARIO');
                $correo->Password = Configuracion::obtener('SMTP_CLAVE');
                $correo->Timeout = self::TIEMPO_ESPERA_SMTP_SEGUNDOS;
                $cifrado = Configuracion::obtener('SMTP_CIFRADO');
                if ($cifrado === 'tls') {
                    $correo->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                } elseif ($cifrado === 'ssl') {
                    $correo->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                } else {
                    $correo->SMTPSecure = '';
                    $correo->SMTPAutoTLS = false;
                }
            }
            $correo->CharSet = 'UTF-8';
            $correo->isHTML(false);
            $correo->XMailer = ' ';
            $correo->setFrom(
                Configuracion::obtener('CORREO_REMITENTE'),
                Configuracion::obtener('CORREO_REMITENTE_NOMBRE')
            );
            $correo->addAddress($destinatario);
            $correo->Subject = (string) $plantilla['asunto'];
            $correo->Body = (string) $plantilla['cuerpo'];
            $correo->send();
        } catch (ExcepcionCorreo $error) {
            throw new RuntimeException('No se pudo enviar el correo', 0, $error);
        }
    }
}
