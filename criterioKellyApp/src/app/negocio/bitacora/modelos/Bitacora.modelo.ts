export interface BitacoraModelo {
  bit_idbitacora?: number;
  bit_cueIdCuentas: number;
  bit_numeroBitac: number;
  bit_divisa: string;
  bit_tipoOperaci: string;
  bit_precioEntra?: number;
  bit_precioSL?: number;
  bit_precioTP?: number;
  bit_pipTotal?: number;
  bit_montoOpera?: number;
  bit_montoResult?: number;
  bit_resultado?: string;
  bit_balance?: number;
  bit_situacion?: string;
  bit_fechaCrea?: string;
  bit_fechaFin?: string | null;
  bit_respeReglas?: string;
  bit_estado?: string;
}

export interface RegistroBitacoraModelo {
  bit_cueIdCuentas: number;
  bit_numeroBitac: number;
  bit_divisa: string;
  bit_tipoOperaci: string;
  bit_precioEntra?: number;
  bit_precioSL?: number;
  bit_precioTP?: number;
  bit_fechaCrea?: string;

  obs_comentario: string;
  obs_imagen?: string | ArrayBuffer | null;
  obs_tipoObserva?: string;
}

export interface ActualizarTPSLBEComentarios {
  bit_idbitacora: number;
  bit_precioEntra: number;
  bit_precioSL: number;
  bit_precioTP: number;
  obs_idObserva: number;
  obs_imagen?: string | ArrayBuffer | null;
  obs_comentario: string;
}

export interface ActualizarBitacoraFinalModelo {
  bit_idbitacora: number;
  bit_resultado: string;
  bit_montoResult: number;
  bit_respeReglas: string;
  bit_situacion: string;
  bit_cueIdCuentas: number;
  cke_numDivisor?: number;
}
