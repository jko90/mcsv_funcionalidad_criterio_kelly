<?php
require_once "global.php";

class Enlace
{
    private $conexion;

    public function __construct()
    {
        try {
            $this->conexion = new mysqli(DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME);
            $this->conexion->set_charset(DB_ENCODE);

            if ($this->conexion->connect_errno) {
                throw new Exception("Error de conexión: " . $this->conexion->connect_error);
            }
        } catch (Exception $e) {
            error_log("Database connection error: " . $e->getMessage());
            throw $e;
        }
    }

    public function ejecutarConsulta(string $sql, string $types = "", ...$params)
    {
        $stmt = $this->prepararYBind($sql, $types, ...$params);
        try {
            $stmt->execute();
            $result = $stmt->get_result();
            return $result;
        } catch (Exception $e) {
            error_log("Query execution error: " . $e->getMessage());
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

    public function ejecutarInsercionRetornaID(string $sql, string $types = "", ...$params): int
    {
        $stmt = $this->prepararYBind($sql, $types, ...$params);
        try {
            if (!$stmt->execute()) {
                throw new Exception('Error en execute: ' . $stmt->error);
            }
            return $this->conexion->insert_id;
        } catch (Exception $e) {
            error_log("Insert query error: " . $e->getMessage());
            throw $e;
        } finally {
            $stmt->close();
        }
    }

    public function ejecutarActualizacion(string $sql, string $types = "", ...$params): int
    {
        $stmt = $this->prepararYBind($sql, $types, ...$params);
        try {
            if (!$stmt->execute()) {
                throw new Exception('Error en execute: ' . $stmt->error);
            }
            return $stmt->affected_rows;
        } catch (Exception $e) {
            error_log("Update query error: " . $e->getMessage());
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
        if ($this->conexion) {
            $this->conexion->close();
        }
    }

    public function __destruct()
    {
        $this->cerrarConexion();
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