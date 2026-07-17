<?php

require_once(__DIR__ . '/../modelos/CategoriaMdl.php');
require_once(__DIR__ . '/BaseCtrl.php');

class CategoriaCtrl extends BaseCtrl
{
    private $categoriaService;

    public function __construct()
    {
        $this->categoriaService = new CategoriaMdl();
    }

    public function listaCategorias()
    {
        try {
            $rspta = $this->categoriaService->listaCategorias();
            if ($rspta === false) {
                $this->respuestaErrorSimple('Error al recuperar categorías', 500);
            }

            $data = $this->mapearObjetoCategoria($rspta);
            $this->respuestaExitosaSimple($data);
        } catch (Exception $e) {
            error_log("Error en listaCategorias: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function obtenerCategoria($id)
    {
        try {
            if (!filter_var($id, FILTER_VALIDATE_INT) || $id <= 0) {
                $this->respuestaErrorSimple('ID inválido');
            }

            $categoriaData = $this->categoriaService->obtenerCategoria($id);
            if (!$categoriaData) {
                $this->respuestaErrorSimple('Categoría no encontrada', 404);
            }

            $this->respuestaExitosaSimple($categoriaData,);
        } catch (Exception $e) {
            error_log("Error en obtenerCategoria: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function agregarCategoria($data)
    {
        try {
            $errores = $this->validarDatos($data, ['nombre', 'descripcion']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores));
            }

            $datosLimpios = $this->limpiarDatos($data);
            $datosLimpios['estado'] = isset($data['estado']) ? (int)$data['estado'] : 1;

            $categoriaId = $this->categoriaService->agregarCategoria($datosLimpios);
            if (!$categoriaId) {
                $this->respuestaErrorSimple('Error al crear la categoría', 500);
            }

            $this->respuestaExitosaSimple(['id' => $categoriaId],);
        } catch (Exception $e) {
            error_log("Error en agregarCategoria: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function actualizarCategoria($id, $data)
    {
        try {
            if (!filter_var($id, FILTER_VALIDATE_INT) || $id <= 0) {
                $this->respuestaErrorSimple('ID inválido');
            }

            if (!$this->categoriaService->existeCategoria($id)) {
                $this->respuestaErrorSimple('Categoría no encontrada', 404);
            }

            $errores = $this->validarDatos($data, ['nombre', 'descripcion']);
            if (!empty($errores)) {
                $this->respuestaErrorSimple(implode(', ', $errores));
            }

            $datosLimpios = $this->limpiarDatos($data);
            $datosLimpios['estado'] = isset($data['estado']) ? (int)$data['estado'] : 1;

            $resultado = $this->categoriaService->actualizarCategoria($id, $datosLimpios);
            if (!$resultado) {
                $this->respuestaErrorSimple('Error al actualizar la categoría', 500);
            }

            $this->respuestaExitosaSimple(['id' => $id]);
        } catch (Exception $e) {
            error_log("Error en actualizarCategoria: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    public function eliminarCategoria($id)
    {
        try {
            if (!filter_var($id, FILTER_VALIDATE_INT) || $id <= 0) {
                $this->respuestaErrorSimple('ID inválido');
            }

            if (!$this->categoriaService->existeCategoria($id)) {
                $this->respuestaErrorSimple('Categoría no encontrada', 404);
            }

            $resultado = $this->categoriaService->eliminarCategoria($id);
            if (!$resultado) {
                $this->respuestaErrorSimple('Error al eliminar la categoría', 500);
            }

            $this->respuestaExitosaSimple(null);
        } catch (Exception $e) {
            error_log("Error en eliminarCategoria: " . $e->getMessage());
            $this->respuestaErrorSimple('Error interno del servidor', 500);
        }
    }

    private function mapearObjetoCategoria($categoriaResponse)
    {
        $data = [];
        while ($reg = $categoriaResponse->fetch_object()) {
            $data[] = [
                "id" => (int)$reg->id,
                "nombre" => $reg->nombre ?? '',
                "descripcion" => $reg->descripcion ?? '',
                "estado" => (int)$reg->estado
            ];
        }
        return $data;
    }
}
