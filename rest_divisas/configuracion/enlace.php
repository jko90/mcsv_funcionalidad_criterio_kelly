<?php
require_once __DIR__ . '/Configuracion.php';

class Enlace
{
    private static ?mysqli $conexionCompartida = null;
    private mysqli $conexion;

    public function __construct()
    {
        try {
            if (self::$conexionCompartida === null) {
                mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
                self::$conexionCompartida = new mysqli(
                    Configuracion::obtener('DB_HOST'),
                    Configuracion::obtener('DB_USUARIO'),
                    Configuracion::obtener('DB_CLAVE'),
                    Configuracion::obtener('DB_NOMBRE'),
                    Configuracion::obtenerEntero('DB_PUERTO')
                );
                self::$conexionCompartida->set_charset(Configuracion::obtener('DB_CHARSET'));
            }

            $this->conexion = self::$conexionCompartida;
        } catch (mysqli_sql_exception $error) {
            error_log('[Enlace::__construct] Error de conexión: ' . $error->getMessage());
            throw $error;
        }
    }

    public function ejecutarConsulta(string $sql, string $types = "", ...$params)
    {
        $stmt = $this->prepararYBind($sql, $types, ...$params);
        try {
            $stmt->execute();
            return $stmt->get_result();
        } catch (Exception $e) {
            error_log("[Enlace::ejecutarConsulta] " . $e->getMessage());
            throw $e;
        } finally {
            $stmt->close();
        }
    }

    public function ejecutarConsultaSimpleFila(string $sql, string $types = "", ...$params): ?array
    {
        $result = $this->ejecutarConsulta($sql, $types, ...$params);
        return $result ? $result->fetch_assoc() : null;
    }

    public function ejecutarConsultaRetornarID(string $sql, string $types = "", ...$params): int
    {
        return $this->ejecutarInsercionRetornaID($sql, $types, ...$params);
    }

    public function ejecutarInsercionRetornaID(string $sql, string $types = "", ...$params): int
    {
        $stmt = $this->prepararYBind($sql, $types, ...$params);
        try {
            $stmt->execute();
            return $this->conexion->insert_id;
        } catch (Exception $e) {
            error_log("[Enlace::ejecutarInsercionRetornaID] " . $e->getMessage());
            throw $e;
        } finally {
            $stmt->close();
        }
    }

    public function ejecutarActualizacion(string $sql, string $types = "", ...$params): int
    {
        $stmt = $this->prepararYBind($sql, $types, ...$params);
        try {
            $stmt->execute();
            return $stmt->affected_rows;
        } catch (Exception $e) {
            error_log("[Enlace::ejecutarActualizacion] " . $e->getMessage());
            throw $e;
        } finally {
            $stmt->close();
        }
    }

    public function limpiarCadena(string $str): string
    {
        return htmlspecialchars(trim($str), ENT_QUOTES, 'UTF-8');
    }

    public function cerrarConexion(): void
    {
        if (self::$conexionCompartida !== null) {
            self::$conexionCompartida->close();
            self::$conexionCompartida = null;
        }
    }

    public function iniciarTransaccion(): void
    {
        $this->conexion->begin_transaction();
    }

    public function confirmarTransaccion(): void
    {
        $this->conexion->commit();
    }

    public function revertirTransaccion(): void
    {
        $this->conexion->rollback();
    }

    private function prepararYBind(string $sql, string $types = "", ...$params): mysqli_stmt
    {
        $stmt = $this->conexion->prepare($sql);
        if ($stmt === false) {
            throw new Exception('Error en prepare: ' . $this->conexion->error);
        }
        if ($types && $params) {
            $stmt->bind_param($types, ...$params);
        }
        return $stmt;
    }
}
