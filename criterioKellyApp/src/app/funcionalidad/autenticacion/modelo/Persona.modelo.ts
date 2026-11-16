export interface DatosPersona {
  nombres: string;
  apellidos: string;
  telefono: string;
  correo: string;
  cedula?: string;
  usuario: string;
  clave: string;
}

export interface RespuestaRegistro {
  mensaje: string;
}
