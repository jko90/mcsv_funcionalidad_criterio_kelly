// Un elemento de GET pagos/pendientes (18 campos). No trae cédula, correo ni imagen.
export interface PagoPendiente {
  pag_idPago: number;
  pag_susIdSuscri: number;
  sus_usuarioId: number;
  usuario: string;
  pla_nombre: string;
  ins_nombre: string;
  pag_monto: number | string;
  pag_moneda: string;
  pag_metodoPago: string;
  pag_idTransac: string | null;
  pag_fechaPago: string;
  pag_tipocripto: string | null;
  tieneComprobante: boolean;
  esPropio: boolean;
  esAnticipado: boolean;
  fechaInicioResultante: string | null;
  fechaCorteResultante: string | null;
  esAntiguo: boolean;
}

export interface ComprobantePago {
  pag_idPago: number;
  comprobante: string;
}

export interface ConfirmacionPago {
  pag_idPago: number;
  pag_situacion: 'C';
  tipo: string;
  sis_idSuscrip: number;
  sus_usuarioId: number;
  sus_situacion: string;
  sus_fechainicio: string;
  sus_fechaFin: string;
  sus_proximoPago: string;
  suscripcionesCanceladas: number[];
}

export interface RechazoPago {
  pag_idPago: number;
  pag_situacion: 'F';
}

export type ResultadoValidacion = 'APROBADO' | 'RECHAZADO';
