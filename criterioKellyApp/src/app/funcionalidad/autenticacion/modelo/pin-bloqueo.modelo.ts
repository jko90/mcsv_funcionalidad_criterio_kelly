export interface PinBloqueo {
  pin_idPin: number;
  pin_codigo: string;
  pin_idUsuario: number;
}

export interface AccesoPinBloqueo {
  obtenerPinBloqueo(pin_idUsuario: number): Promise<PinBloqueo | null>;
  agregarPinBloqueo(pin_codigo: string, pin_idUsuario: number): Promise<string>;
  editarPinBloqueo(
    pin_codigo: string,
    pin_idPin: number,
    pin_idUsuario: number,
  ): Promise<string>;
  eliminarPinBloqueo(pin_idUsuario: number): Promise<string>;
}

export type ResultadoVerificacionPin = 'correcto' | 'incorrecto' | 'sin-pin';

export interface SolicitudPin {
  pin: string;
  idUsuario: number;
}
