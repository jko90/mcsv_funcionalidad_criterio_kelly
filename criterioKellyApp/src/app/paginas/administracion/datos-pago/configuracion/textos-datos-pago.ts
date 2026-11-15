import { TipoCuentaBanco } from '../modelos/DatosPagoAdmin.modelo';

export const ENCABEZADO_CONFIRMAR_CAMBIO = 'Confirmar cambio';
export const ENCABEZADO_CONFIRMAR_ELIMINAR = 'Eliminar red';
export const ENCABEZADO_CONFIRMAR_QUITAR_QR = 'Quitar código QR';

export const ETIQUETAS_TIPO_CUENTA: Readonly<Record<TipoCuentaBanco, string>> = {
  AHORROS: 'Ahorros',
  CORRIENTE: 'Corriente',
  VIRTUAL: 'Virtual',
  OTRO: 'Otro',
};

const CARACTERES_VISIBLES_CUENTA = 4;

// RN-04: se muestra el valor que se va a guardar para que se revise antes de confirmar.
export function mensajeConfirmarCambio(valor: string): string {
  return `Vas a cambiar los datos donde los usuarios envían su dinero. Revisa el valor: ${valor}`;
}

export function mensajeConfirmarEliminarRed(nombreRed: string): string {
  return `¿Eliminar la red ${nombreRed}? También se borrará su código QR.`;
}

export function mensajeConfirmarQuitarQr(nombreRed: string): string {
  return `¿Quitar el código QR de la red ${nombreRed}? Los usuarios verán solo la dirección.`;
}

// Resumen del cambio de datos bancarios: el WhatsApp y, si hay cuenta, solo sus últimos dígitos.
export function valorConfirmacionBanco(numeroWhatsapp: string, cuenta: string): string {
  const cuentaSinEspacios = cuenta.replace(/\s/g, '');
  if (cuentaSinEspacios === '') return `WhatsApp ${numeroWhatsapp}`;
  const final = cuentaSinEspacios.slice(-CARACTERES_VISIBLES_CUENTA);
  return `WhatsApp ${numeroWhatsapp}; cuenta terminada en ${final}`;
}

export function valorConfirmacionPaypal(correo: string, enlace: string): string {
  const partes = [correo, enlace].filter((parte) => parte !== '');
  return partes.length === 0 ? 'sin correo ni enlace (PayPal quedará sin datos)' : partes.join(' / ');
}
