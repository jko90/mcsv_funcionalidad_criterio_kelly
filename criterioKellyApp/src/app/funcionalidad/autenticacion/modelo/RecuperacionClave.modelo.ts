export interface SolicitudRecuperacion {
  correo: string;
}
export interface RespuestaSolicitudRecuperacion {
  mensaje: string;
}
export interface RestablecimientoClave {
  correo: string;
  codigo: string;
  claveNueva: string;
}
export interface DatosRestablecimiento {
  codigo: string;
  claveNueva: string;
}
export interface RespuestaRestablecimiento {
  success: string;
}
export type PasoRecuperacion = 'solicitar' | 'restablecer' | 'completado';
