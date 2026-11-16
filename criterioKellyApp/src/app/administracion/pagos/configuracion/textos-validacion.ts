import { PagoPendiente } from '../modelos/PagoPendiente.modelo';

export const MOTIVO_MINIMO_CARACTERES = 5;
export const MOTIVO_MAXIMO_CARACTERES = 256;
export const MOTIVO_COMPROBANTE_ANTIGUO = 'El comprobante es demasiado antiguo; suba uno nuevo';
export const TEXTO_PAGO_PROPIO = 'No puedes validar tu propio pago';
export const TEXTO_SIN_COMPROBANTE = 'Sin comprobante';
export const TEXTO_COMPROBANTE_ANTIGUO =
  'Este comprobante es demasiado antiguo: su fecha de corte ya pasó';
export const TEXTO_OTRO_PLAN_ACTIVO =
  'El dueño tiene otro plan de pago activo; el servidor no permitirá aprobarlo';

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;
const PATRON_HORA = /[ T](\d{2}):(\d{2})/;

// Solo reordena el texto del servidor; nunca construye un Date ni usa el reloj del dispositivo.
export function formatearFecha(fecha: string | null): string {
  if (fecha === null) return '';
  const partes = PATRON_FECHA.exec(fecha);
  if (partes === null) return fecha;
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

export function formatearFechaHora(fecha: string): string {
  const hora = PATRON_HORA.exec(fecha);
  const soloFecha = formatearFecha(fecha);
  return hora === null ? soloFecha : `${soloFecha} ${hora[1]}:${hora[2]}`;
}

export function tieneFechasResultantes(pago: PagoPendiente): boolean {
  return pago.fechaInicioResultante !== null && pago.fechaCorteResultante !== null;
}

export function textoPeriodoResultante(pago: PagoPendiente): string | null {
  if (!tieneFechasResultantes(pago)) return null;
  const inicio = formatearFecha(pago.fechaInicioResultante);
  const corte = formatearFecha(pago.fechaCorteResultante);
  return pago.esAnticipado
    ? `Pago anticipado: el nuevo periodo empezará el ${inicio} y terminará el ${corte}; el plan actual no se toca`
    : `Si apruebas, el plan corre desde el ${inicio} hasta el ${corte}`;
}

export function textoMonto(pago: PagoPendiente): string {
  return `${pago.pag_monto} ${pago.pag_moneda}`;
}

export function mensajeConfirmarAprobacion(pago: PagoPendiente): string {
  const base = `¿Aprobar el pago de ${pago.usuario} por ${textoMonto(pago)}?`;
  if (!tieneFechasResultantes(pago)) return base;
  const inicio = formatearFecha(pago.fechaInicioResultante);
  const corte = formatearFecha(pago.fechaCorteResultante);
  return `${base} El plan correrá desde el ${inicio} hasta el ${corte}`;
}

export function esMotivoValido(motivo: string): boolean {
  const longitud = motivo.trim().length;
  return longitud >= MOTIVO_MINIMO_CARACTERES && longitud <= MOTIVO_MAXIMO_CARACTERES;
}

export function motivoSugerido(pago: PagoPendiente | null): string {
  return pago?.esAntiguo ? MOTIVO_COMPROBANTE_ANTIGUO : '';
}

// El servidor decide esAntiguo y las fechas; aquí solo se combinan para habilitar el botón.
export function puedeAprobarPago(pago: PagoPendiente, tieneImagen: boolean): boolean {
  return !pago.esPropio && !pago.esAntiguo && tieneFechasResultantes(pago) && tieneImagen;
}
