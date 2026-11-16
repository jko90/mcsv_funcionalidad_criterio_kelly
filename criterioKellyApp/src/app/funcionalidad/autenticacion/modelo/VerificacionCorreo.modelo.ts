export interface ActivacionCuenta {
  correo: string;
  codigo: string;
}

export interface RespuestaActivacion {
  success: string;
}

export interface SolicitudReenvioCodigo {
  correo: string;
}

export interface RespuestaReenvioCodigo {
  mensaje: string;
}

export type PasoVerificacion = 'codigo' | 'activada';

export const SEGUNDOS_ENTRE_REENVIOS = 60;
