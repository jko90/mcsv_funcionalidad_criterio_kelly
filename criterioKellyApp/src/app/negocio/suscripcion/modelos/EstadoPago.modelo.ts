export type SituacionPago = 'R' | 'C' | 'F';

export type MetodoPago = 'CRIPTOMONEDA' | 'PAYPAL' | 'BANCO';

// Cómo entra la persona a la pantalla: define los textos y qué se envía.
export type ModoComprobante =
  | 'PRIMER_PAGO'
  | 'RENOVACION'
  | 'ANTICIPADO'
  | 'NINGUNO';

export interface UltimoPago {
  pag_idPago: number;
  sis_idSuscrip: number;
  pag_situacion: SituacionPago;
  pag_fechaPago: string;
  pag_monto: number | string;
  pag_moneda: string;
  pag_metodoPago: string;
  pla_nombre: string;
  ins_nombre: string;
  tieneComprobante: boolean;
  motivoRechazo: string | null;
}

export interface UltimoPagoRespuesta {
  pago: UltimoPago | null;
}

// Lo que emite el formulario: el comprobante es la imagen (data URL) ya reducida.
export interface SolicitudComprobante {
  metodoPago: MetodoPago;
  idTransaccion: string;
  comprobante: string;
  correoTransaccion?: string;
  criptomoneda?: string;
}

// Cuerpo de POST suscripcion/crearConPago (sin monto ni meses: los fija el servidor).
export interface SolicitudCrearConPago extends SolicitudComprobante {
  pin_idPlanInterv: number;
  sis_idSuscrip?: number;
}

export type ClaveEstadoPago =
  | 'REVISION'
  | 'RECHAZADO'
  | 'PROGRAMADO'
  | 'ACTIVO'
  | 'SIN_COMPROBANTE'
  | 'SIN_PAGOS';

export interface TextoEstadoPago {
  clave: ClaveEstadoPago;
  mensaje: string;
  detalle: string | null;
}
