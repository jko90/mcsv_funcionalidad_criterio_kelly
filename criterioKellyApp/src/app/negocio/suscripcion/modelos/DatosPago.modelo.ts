// Respuesta de GET datosPago/disponibles: el servidor ya filtra lo activo y completo.
export interface RedUsdtDisponible {
  clave: string;
  nombre: string;
  etiqueta: string;
  direccion: string;
  tieneQr: boolean;
  qrHash: string | null;
}

export interface CriptoDisponible {
  nombre: string;
  redes: RedUsdtDisponible[];
}

export interface PaypalDisponible {
  nombre: string;
  correo: string | null;
  enlace: string | null;
}

// Por ahora el usuario solo recibe el WhatsApp y la plantilla; los datos de la cuenta no se muestran.
export interface BancoDisponible {
  nombre: string;
  numero: string;
  plantilla: string | null;
}

export interface DatosPagoDisponibles {
  cripto: CriptoDisponible | null;
  paypal: PaypalDisponible | null;
  banco: BancoDisponible | null;
}
