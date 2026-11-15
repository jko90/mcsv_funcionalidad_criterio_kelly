import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { LIMITE_QR, TIPOS_CUENTA_BANCO } from '../modelos/DatosPagoAdmin.modelo';

// Los patrones y límites son los mismos que aplica el servidor (ValidadorDatosPago.php, HLT-29).
export const PATRON_CLAVE_RED = /^[A-Z0-9_]{2,16}$/;
const PATRON_DIRECCION_TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const PATRON_DIRECCION_EVM = /^0x[0-9a-fA-F]{40}$/;
const PATRON_DIRECCION_GENERICA = /^[A-Za-z0-9]{16,128}$/;
const PATRON_CORREO = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const PATRON_ENLACE_PAYPAL = /^https:\/\/(?:paypal\.me|www\.paypal\.com)\/[A-Za-z0-9_./\-]*$/;
const PATRON_NUMERO_WHATSAPP = /^[0-9]{8,15}$/;
const PATRON_NOMBRE_PERSONA_O_ENTIDAD = /^[\p{L}\p{N} .,&'\-]{2,128}$/u;
const PATRON_PAIS_MONEDA = /^[\p{L}\p{N} /\-]{2,32}$/u;
const PATRON_DOCUMENTO = /^[A-Za-z0-9.\-]{3,20}$/;
const PATRON_CUENTA = /^[A-Za-z0-9\-]{4,34}$/;

export const LONGITUD_NOMBRE_RED = 64;
export const LONGITUD_ETIQUETA_RED = 16;
export const LONGITUD_MAXIMA_CORREO = 64;
export const LONGITUD_MAXIMA_ENLACE = 255;
export const LONGITUD_MAXIMA_PLANTILLA = 500;
export const LONGITUD_MAXIMA_OBSERVACIONES = 255;
export const LONGITUD_MAXIMA_TITULAR = 128;
export const LONGITUD_MAXIMA_ENTIDAD = 64;
const PATRON_SEPARADORES_NUMERO = /[+\s-]/g;
const PATRON_ESPACIOS = /\s/g;
const BYTES_POR_KILOBYTE = 1024;

export const MENSAJE_CLAVE_RED = 'La clave son de 2 a 16 letras mayúsculas, números o guion bajo';
export const MENSAJE_DIRECCION_TRON = 'Una dirección TRON empieza con T y tiene 34 caracteres';
export const MENSAJE_DIRECCION_EVM = 'Una dirección de esta red empieza con 0x y tiene 42 caracteres';
export const MENSAJE_DIRECCION_GENERICA =
  'La dirección debe tener entre 16 y 128 letras y números, sin espacios';
export const MENSAJE_CORREO = 'Escribe un correo válido de hasta 64 caracteres';
export const MENSAJE_ENLACE_PAYPAL = 'El enlace debe ser de PayPal y empezar con https://';
export const MENSAJE_NUMERO_WHATSAPP = 'El número debe tener de 8 a 15 dígitos, con el código del país';
export const MENSAJE_TITULAR = 'Usa de 2 a 128 letras, números o . , & - y espacios';
export const MENSAJE_ENTIDAD = 'Usa de 2 a 64 letras, números o . , & - y espacios';
export const MENSAJE_DOCUMENTO = 'El documento tiene de 3 a 20 letras, números, puntos o guiones';
export const MENSAJE_CUENTA = 'La cuenta tiene de 4 a 34 letras, números o guiones';
export const MENSAJE_PAIS_MONEDA = 'Usa de 2 a 32 letras, números, / o guion';
export const MENSAJE_TIPO_CUENTA = 'Elige un tipo de cuenta de la lista';
export const MENSAJE_CUENTA_SIN_TITULAR = 'Para registrar la cuenta indica también el titular y el banco';
export const MENSAJE_QR_TIPO = 'El código QR debe ser una imagen PNG, JPEG o WEBP';
export const MENSAJE_QR_TAMANO = `El código QR no puede pesar más de ${LIMITE_QR.tamanoMaximoBytes / BYTES_POR_KILOBYTE} KB`;

export function normalizarClaveRed(clave: string): string {
  return clave.trim().toUpperCase();
}

export function normalizarNumeroWhatsapp(numero: string): string {
  return numero.trim().replace(PATRON_SEPARADORES_NUMERO, '');
}

export function normalizarCuenta(cuenta: string): string {
  return cuenta.trim().replace(PATRON_ESPACIOS, '');
}

export function mensajeErrorClaveRed(clave: string): string | null {
  return PATRON_CLAVE_RED.test(normalizarClaveRed(clave)) ? null : MENSAJE_CLAVE_RED;
}

export function mensajeErrorDireccion(claveRed: string, direccion: string): string | null {
  const valor = direccion.trim();
  const clave = normalizarClaveRed(claveRed);
  if (clave === 'TRON') return PATRON_DIRECCION_TRON.test(valor) ? null : MENSAJE_DIRECCION_TRON;
  if (clave === 'ETH' || clave === 'BSC') {
    return PATRON_DIRECCION_EVM.test(valor) ? null : MENSAJE_DIRECCION_EVM;
  }
  return PATRON_DIRECCION_GENERICA.test(valor) ? null : MENSAJE_DIRECCION_GENERICA;
}

export function mensajeErrorCorreo(correo: string): string | null {
  const valor = correo.trim();
  return valor.length <= LONGITUD_MAXIMA_CORREO && PATRON_CORREO.test(valor) ? null : MENSAJE_CORREO;
}

export function mensajeErrorEnlacePaypal(enlace: string): string | null {
  const valor = enlace.trim();
  return valor.length <= LONGITUD_MAXIMA_ENLACE && PATRON_ENLACE_PAYPAL.test(valor)
    ? null
    : MENSAJE_ENLACE_PAYPAL;
}

export function mensajeErrorNumeroWhatsapp(numero: string): string | null {
  return PATRON_NUMERO_WHATSAPP.test(normalizarNumeroWhatsapp(numero)) ? null : MENSAJE_NUMERO_WHATSAPP;
}

export function mensajeErrorTitular(titular: string): string | null {
  const valor = titular.trim();
  return valor.length <= LONGITUD_MAXIMA_TITULAR && PATRON_NOMBRE_PERSONA_O_ENTIDAD.test(valor)
    ? null
    : MENSAJE_TITULAR;
}

export function mensajeErrorEntidad(entidad: string): string | null {
  const valor = entidad.trim();
  return valor.length <= LONGITUD_MAXIMA_ENTIDAD && PATRON_NOMBRE_PERSONA_O_ENTIDAD.test(valor)
    ? null
    : MENSAJE_ENTIDAD;
}

export function mensajeErrorDocumento(documento: string): string | null {
  return PATRON_DOCUMENTO.test(documento.trim()) ? null : MENSAJE_DOCUMENTO;
}

export function mensajeErrorCuenta(cuenta: string): string | null {
  return PATRON_CUENTA.test(normalizarCuenta(cuenta)) ? null : MENSAJE_CUENTA;
}

export function mensajeErrorPaisMoneda(paisMoneda: string): string | null {
  return PATRON_PAIS_MONEDA.test(paisMoneda.trim()) ? null : MENSAJE_PAIS_MONEDA;
}

export function mensajeErrorTipoCuenta(tipo: string): string | null {
  return (TIPOS_CUENTA_BANCO as readonly string[]).includes(tipo) ? null : MENSAJE_TIPO_CUENTA;
}

// Se valida el archivo elegido antes de leerlo y enviarlo (RN-05); el servidor repite la comprobación.
export function mensajeErrorArchivoQr(tipo: string, tamanoBytes: number): string | null {
  if (!(LIMITE_QR.tiposPermitidos as readonly string[]).includes(tipo)) return MENSAJE_QR_TIPO;
  return tamanoBytes > LIMITE_QR.tamanoMaximoBytes ? MENSAJE_QR_TAMANO : null;
}

function valorTexto(control: AbstractControl): string {
  const valor: unknown = control.value;
  return typeof valor === 'string' ? valor : '';
}

// Convierte una función de mensaje en validador de formulario; un campo vacío lo resuelve «required».
export function validadorDeFormato(
  obtenerMensaje: (valor: string) => string | null,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = valorTexto(control);
    if (valor.trim() === '') return null;
    const mensaje = obtenerMensaje(valor);
    return mensaje === null ? null : { formato: mensaje };
  };
}

// La dirección depende de la clave de la red, que vive en el control hermano.
export const validadorDireccionDeRed: ValidatorFn = (control: AbstractControl) => {
  const valor = valorTexto(control);
  if (valor.trim() === '') return null;
  const clave = control.parent?.get('red_clave')?.value;
  const mensaje = mensajeErrorDireccion(typeof clave === 'string' ? clave : '', valor);
  return mensaje === null ? null : { formato: mensaje };
};
