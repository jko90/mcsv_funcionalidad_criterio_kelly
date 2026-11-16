import { MetodoPago } from 'src/app/negocio/suscripcion/modelos/EstadoPago.modelo';

// Mismo valor que HLT-29 (RN-10): el servidor vuelve a validar y responde 400.
export const LIMITE_QR = {
  tamanoMaximoBytes: 262144,
  tiposPermitidos: ['image/png', 'image/jpeg', 'image/webp'],
} as const;

export const TIPOS_CUENTA_BANCO = ['AHORROS', 'CORRIENTE', 'VIRTUAL', 'OTRO'] as const;
export type TipoCuentaBanco = (typeof TIPOS_CUENTA_BANCO)[number];

export interface MetodoPagoAdmin {
  mep_idMetodo: number;
  mep_codigo: MetodoPago;
  mep_nombre: string;
  mep_activo: number;
  mep_orden: number;
  mep_paypalCorreo: string | null;
  mep_paypalEnlace: string | null;
  mep_bancoNumero: string | null;
  mep_bancoPlantilla: string | null;
  mep_bancoTitular: string | null;
  mep_bancoDocumento: string | null;
  mep_bancoEntidad: string | null;
  mep_bancoTipoCuenta: TipoCuentaBanco | null;
  mep_bancoCuenta: string | null;
  mep_bancoPaisMoneda: string | null;
  mep_bancoObservaciones: string | null;
}

export interface RedUsdtAdmin {
  red_idRed: number;
  red_clave: string;
  red_nombre: string;
  red_etiqueta: string;
  red_direccion: string;
  red_activo: number;
  red_orden: number;
  tieneQr: boolean;
  qrTamano: number | null;
  qrTipoMime: string | null;
  qrHash: string | null;
}

export interface DatosPagoAdministracion {
  metodos: MetodoPagoAdmin[];
  redes: RedUsdtAdmin[];
}

// La red y la URL de objeto de su QR (solo en memoria) que ve la pantalla.
export interface RedUsdtConQr extends RedUsdtAdmin {
  urlQr: string | null;
}

export interface CuerpoGuardarRed {
  red_idRed?: number;
  red_clave: string;
  red_nombre: string;
  red_etiqueta: string;
  red_direccion: string;
  red_activo: number;
  red_orden: number;
}

export interface CuerpoGuardarPaypal {
  mep_paypalCorreo: string;
  mep_paypalEnlace: string;
}

export interface CuerpoGuardarBanco {
  mep_bancoNumero: string;
  mep_bancoPlantilla: string;
  mep_bancoTitular: string;
  mep_bancoDocumento: string;
  mep_bancoEntidad: string;
  mep_bancoTipoCuenta: string;
  mep_bancoCuenta: string;
  mep_bancoPaisMoneda: string;
  mep_bancoObservaciones: string;
}

export interface CambioEstadoRed {
  idRed: number;
  activo: boolean;
}

export interface CambioEstadoMetodo {
  codigo: MetodoPago;
  activo: boolean;
  orden: number;
}

export interface SubidaQr {
  idRed: number;
  imagen: string;
}

export interface RespuestaGuardarRed {
  success: string;
  red_idRed: number;
}
