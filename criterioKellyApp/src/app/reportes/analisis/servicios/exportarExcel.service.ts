import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { BitacoraResultadoAnalisis, observacionResultadoAnalisis } from '../../compartido/modelos/DetalleOperacion.modelo';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root',
})
export class ExportarExcelService {

  async exportarOperacionesConObservaciones( operaciones: BitacoraResultadoAnalisis[], observaciones: observacionResultadoAnalisis[]): Promise<void> {
    // Crear un nuevo libro de Excel
    const workbook = XLSX.utils.book_new();

    // Crear hoja de operaciones
    const operacionesData = this.prepararDatosOperaciones(operaciones);
    const wsOperaciones = XLSX.utils.json_to_sheet(operacionesData);
    XLSX.utils.book_append_sheet(workbook, wsOperaciones, 'Operaciones');

    // Crear hoja de observaciones agrupadas por operación
    const observacionesData = this.prepararDatosObservaciones(operaciones, observaciones);
    const wsObservaciones = XLSX.utils.json_to_sheet(observacionesData);
    XLSX.utils.book_append_sheet(workbook, wsObservaciones, 'Observaciones');

    // Crear hoja de resumen detallado
    const resumenData = this.prepararDatosResumen(operaciones, observaciones);
    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen Detallado');

    // Generar el archivo Excel como Blob
    const fechaActual = new Date().toISOString().split('T')[0];
    const nombreArchivo = `bitacora_operaciones_${fechaActual}.xlsx`;
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const excelBlob = new Blob([wbout], { type: 'application/octet-stream' });

    // Recolectar imágenes base64
    const imagenes: { nombre: string; blob: Blob }[] = [];
    let imgIndex = 1;
    observaciones.forEach((obs) => {
      if (typeof obs.imagen === 'string' && obs.imagen.startsWith('data:image/')) {
        const nombreImg = `imagen_${obs.bitacora_id}_${imgIndex}.png`;
        imagenes.push({nombre: nombreImg, blob: this.base64ToBlob(obs.imagen),});
        imgIndex++;
      }
    });

    if (imagenes.length > 0) {
      // Crear ZIP solo si hay imágenes
      const zip = new JSZip();
      zip.file(nombreArchivo, excelBlob);
      imagenes.forEach((img) => {
        zip.file(img.nombre, img.blob);
      });

      // Generar y descargar ZIP
      zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
        saveAs(content, `bitacora_operaciones_${fechaActual}.zip`);
      });
    } else {
      // Si no hay imágenes, descargar solo el Excel
      saveAs(excelBlob, nombreArchivo);
    }
  }

  private base64ToBlob(base64: string): Blob {
    if (!base64 || typeof base64 !== 'string') {
      return new Blob();
    }
    const arr = base64.split(',');
    if (arr.length < 2 || !arr[1]) {
      // No hay datos base64 válidos
      return new Blob();
    }
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    try {
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      // Si atob falla, retorna un Blob vacío
      return new Blob();
    }
  }

  private prepararDatosOperaciones(operaciones: BitacoraResultadoAnalisis[]): any[] {
    return operaciones.map((op) => ({
      'ID Bitácora': op.id_bitacora,
      'ID Cuenta': op.cue_idCuentas,
      Divisa: op.divisa,
      'Tipo Operación': op.tipo_operacion,
      'Monto Resultado': op.monto_resultado,
      Resultado: op.resultado,
      'Precio Entrada': op.precio_entrada,
      'Precio SL': op.precio_sl,
      'Precio TP': op.precio_tp,
      Balance: op.balance,
      Situación: op.situacion === 'F' ? 'Finalizado' : op.situacion,
      'Fecha Creación': this.formatearFecha(op.fecha_creacion),
      'Fecha Fin': op.fecha_fin ? this.formatearFecha(op.fecha_fin) : 'N/A',
      'Respeta Reglas': op.respeta_reglas,
    }));
  }

  private prepararDatosObservaciones(operaciones: BitacoraResultadoAnalisis[], observaciones: observacionResultadoAnalisis[]): any[] {
    const datosObservaciones: any[] = [];

    operaciones.forEach((operacion) => {
      const observacionesOperacion = observaciones.filter(
        (obs) => obs.bitacora_id === operacion.id_bitacora
      );

      if (observacionesOperacion.length > 0) {
        observacionesOperacion.forEach((obs, index) => {
          datosObservaciones.push({
            'ID Bitácora': operacion.id_bitacora,
            'Divisa': operacion.divisa,
            //  'Tipo Operación': operacion.tipo_operacion,
            'Resultado': operacion.resultado,
            //  'Balance': operacion.balance,
            'Orden #': index + 1,
            'Tipo Observación': this.obtenerTipoObservacion(obs.tipo_observa),
            'Comentario': obs.comentario || 'Sin comentario',
            'Tiene Imagen': this.validarImagen(obs.imagen),
            'Fecha Observación': this.formatearFecha(obs.fecha),
          });
        });
      } else {
        // Agregar fila vacía para operaciones sin observaciones
        datosObservaciones.push({
          'ID Bitácora': operacion.id_bitacora,
          'Divisa': operacion.divisa,
          //  'Tipo Operación': operacion.tipo_operacion,
          'Resultado': operacion.resultado,
          //  'Balance': operacion.balance,
          'Observación #': 0,
          'Tipo Observación': 'Sin observaciones',
          'Comentario': 'No hay observaciones registradas',
          'Tiene Imagen': 'No',
          'Fecha Observación': 'N/A',
        });
      }
    });

    return datosObservaciones;
  }

  private prepararDatosResumen(operaciones: BitacoraResultadoAnalisis[], observaciones: observacionResultadoAnalisis[]): any[] {
    const datosResumen: any[] = [];

    operaciones.forEach((operacion) => {
      const observacionesOperacion = observaciones.filter(
        (obs) => obs.bitacora_id === operacion.id_bitacora
      );

      // Ordenar observaciones por tipo para consistencia
      const tiposOrden = ['I', 'P', 'L', 'F'];
      const observacionesOrdenadas = observacionesOperacion.sort((a, b) => {
        const indexA = tiposOrden.indexOf(a.tipo_observa);
        const indexB = tiposOrden.indexOf(b.tipo_observa);
        return indexA - indexB;
      });

      // Primera fila: datos de operación + tipos de observación
      const filaOperacion: any = {
        Tipo: 'OPERACIÓN',
        'ID Bitácora': operacion.id_bitacora,
        'Divisa': operacion.divisa,
        'Tipo Operación': operacion.tipo_operacion,
        'Resultado': operacion.resultado,
        'Monto': operacion.monto_resultado,
        'Balance': operacion.balance,
        'Fecha': this.formatearFecha(operacion.fecha_creacion),
        'Respeta Reglas': operacion.respeta_reglas,
      };

      // Segunda fila: comentarios de observaciones
      const filaComentarios: any = {
        'Tipo': '',
        'ID Bitácora': '',
        'Divisa': '',
        'Tipo Operación': '',
        'Resultado': '',
        'Monto': '',
        'Balance': '',
        'Fecha': '',
        'Respeta Reglas': '',
      };

      // Agregar las observaciones (máximo 4)
      for (let i = 1; i <= 4; i++) {
        if (i <= observacionesOrdenadas.length) {
          const obs = observacionesOrdenadas[i - 1];
          const tipoTexto = this.obtenerTipoObservacion(obs.tipo_observa);

          // Primera fila: tipos de observación
          filaOperacion[`Observación ${i}`] = tipoTexto;
          filaOperacion[`Imagen ${i}`] = '';
          filaOperacion[`Fecha ${i}`] = '';

          // Segunda fila: comentarios, imagen y fecha
          filaComentarios[`Observación ${i}`] = this.truncarTexto(
            obs.comentario || 'Sin comentario',
            1000
          );
          filaComentarios[`Imagen ${i}`] = this.validarImagen(obs.imagen);
          filaComentarios[`Fecha ${i}`] = this.formatearFecha(obs.fecha);
        } else {
          // Columnas vacías para observaciones faltantes
          filaOperacion[`Observación ${i}`] = '';
          filaOperacion[`Imagen ${i}`] = '';
          filaOperacion[`Fecha ${i}`] = '';

          filaComentarios[`Observación ${i}`] = '';
          filaComentarios[`Imagen ${i}`] = '';
          filaComentarios[`Fecha ${i}`] = '';
        }
      }

      // Agregar ambas filas
      datosResumen.push(filaOperacion);
      if (observacionesOrdenadas.length > 0) {
        datosResumen.push(filaComentarios);
      }
    });

    return datosResumen;
  }

  private obtenerTipoObservacion(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'I': 'Inicio',
      'P': 'Proceso',
      'L': 'Lecciones aprendidas',
      'F': 'Finalizado',
    };
    return tipos[tipo] || tipo;
  }

  private formatearFecha(fecha: string): string {
    if (!fecha) return 'N/A';
    try {
      const fechaObj = new Date(fecha);
      return fechaObj.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return fecha;
    }
  }

  private truncarTexto(texto: string, limite: number): string {
    if (!texto) return '';
    return texto.length > limite ? texto.substring(0, limite) + '...' : texto;
  }

  private validarImagen(imagen?: string | ArrayBuffer | null): string {
    if ( !imagen || imagen === null || imagen === undefined || imagen === '') {
      return 'Sin imagen';
    }
    if (typeof imagen === 'string') {
      // Si es URL
      if (imagen.startsWith('http://') || imagen.startsWith('https://')) {
        return imagen;
      }
      // Si es base64
      if (imagen.startsWith('data:image/')) {
        return 'Imagen en archivo adjunto';
      }
      // Si es otro string corto
      return imagen.length < 200 ? imagen : 'Imagen en archivo adjunto';
    }
    if (imagen instanceof ArrayBuffer) {
      return imagen.byteLength > 0 ? 'Imagen en archivo adjunto' : 'Sin imagen';
    }
    return 'Sin imagen';
  }
}
