export interface OperacionCuentaModelo {
  cue_idCuentas: number;
  divisa: string;
  tipo_operacion: string;
  monto_resultado: number;
  resultado: string;
  balance: number;
  situacion: string;
  fecha_fin: string;
}

export interface observacionResultadoAnalisis {
  bitacora_id: number;
  comentario: string;
  tipo_observa: string;
  imagen?: string | ArrayBuffer | null;
  fecha: string;
}

export interface BitacoraResultadoAnalisis {
  id_bitacora: number;
  cue_idCuentas: number;
  divisa: string;
  tipo_operacion: 'COMPRA' | 'VENTA' | string;
  monto_resultado: number;
  resultado: 'GANADOR' | 'PERDEDOR' | 'BREAK EVEN' | string;
  precio_entrada: number;
  precio_sl: number;
  precio_tp: number;
  balance: number;
  situacion: 'I' | 'P' | 'L' | 'F' | string; // I=Iniciada, F=Finalizada, P=Proceso, L=Lecciones aprendidas
  fecha_creacion: string;
  fecha_fin: string | null;
  respeta_reglas: string;
}