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

    public function ejecutarConsulta($sql, $types = "", ...$params)
    {
        try {
            $stmt = $this->conexion->prepare($sql);
            if ($stmt === false) {
                throw new Exception('Error en prepare: ' . $this->conexion->error);
            }

            if ($types && $params) {
                $stmt->bind_param($types, ...$params);
            }

            $stmt->execute();
            $result = $stmt->get_result();
            $stmt->close();

            return $result;
        } catch (Exception $e) {
            error_log("Query execution error: " . $e->getMessage());
            throw $e;
        }
    }

    public function ejecutarConsultaSimpleFila($sql, $types = "", ...$params)
    {
        $result = $this->ejecutarConsulta($sql, $types, ...$params);
        return $result ? $result->fetch_assoc() : null;
    }

    public function ejecutarConsultaRetornarID($sql, $types = "", ...$params)
    {
        try {
            $stmt = $this->conexion->prepare($sql);
            if ($stmt === false) {
                throw new Exception('Error en prepare: ' . $this->conexion->error);
            }

            if ($types && $params) {
                $stmt->bind_param($types, ...$params);
            }

            $stmt->execute();
            $insertId = $this->conexion->insert_id;
            $stmt->close();

            return $insertId;
        } catch (Exception $e) {
            error_log("Insert query error: " . $e->getMessage());
            throw $e;
        }
    }

    public function ejecutarInsercionRetornaID($sql, $types = "", ...$params)
    {
        try {
            $stmt = $this->conexion->prepare($sql);
            if ($stmt === false) {
                throw new Exception('Error en prepare: ' . $this->conexion->error);
            }

            if ($types && $params) {
                $stmt->bind_param($types, ...$params);
            }

            $executeResult = $stmt->execute();
            if (!$executeResult) {
                $stmt->close();
                throw new Exception('Error en execute: ' . $stmt->error);
            }

            $insertId = $this->conexion->insert_id;
            $stmt->close();

            return $insertId;
        } catch (Exception $e) {
            error_log("Insert query error: " . $e->getMessage());
            throw $e;
        }
    }

    public function ejecutarActualizacion($sql, $types = "", ...$params)
    {
        try {
            $stmt = $this->conexion->prepare($sql);
            if ($stmt === false) {
                throw new Exception('Error en prepare: ' . $this->conexion->error);
            }

            if ($types && $params) {
                $stmt->bind_param($types, ...$params);
            }

            $executeResult = $stmt->execute();
            if (!$executeResult) {
                $stmt->close();
                throw new Exception('Error en execute: ' . $stmt->error);
            }

            $affectedRows = $stmt->affected_rows;
            $stmt->close();

            return $affectedRows;
        } catch (Exception $e) {
            error_log("Update query error: " . $e->getMessage());
            throw $e;
        }
    }


    public function limpiarCadena($str)
    {
        return htmlspecialchars(trim($str), ENT_QUOTES, 'UTF-8');
    }

    public function cerrarConexion()
    {
        if ($this->conexion) {
            $this->conexion->close();
        }
    }

    public function __destruct()
    {
        $this->cerrarConexion();
    }
}
