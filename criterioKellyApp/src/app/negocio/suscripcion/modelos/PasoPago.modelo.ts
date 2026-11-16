import { MetodoPago } from './EstadoPago.modelo';

export type PasoPago = 'METODO' | 'INSTRUCCIONES' | 'COMPROBANTE';

// En la transferencia bancaria la persona abre WhatsApp, vuelve y confirma que envió el mensaje.
export type EtapaBanco = 'PENDIENTE' | 'WHATSAPP_ABIERTO' | 'SOLICITUD_CONFIRMADA';

export interface OpcionMetodoPago {
  metodo: MetodoPago;
  titulo: string;
  descripcion: string;
  icono: string;
  disponible: boolean;
}

export interface ResumenPlanPago {
  nombrePlan: string;
  intervalo: string | null;
  monto: number | null;
}
