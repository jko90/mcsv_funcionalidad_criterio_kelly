import { ModoComprobante, TextoEstadoPago, UltimoPago } from '../modelos/EstadoPago.modelo';
import { PlanVigente } from '../modelos/PlanVigente.modelo';

const TEXTO_PERIODO_PRIMER_PAGO =
  'Tu plan corre desde la fecha de tu comprobante, se activa cuando valide su pago.';
const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const FEBRERO = 2;
const DIAS_FEBRERO_BISIESTO = 29;
const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function dosDigitos(numero: number): string {
  return String(numero).padStart(2, '0');
}

// Suma un día sobre la cadena YYYY-MM-DD del servidor; no usa el reloj del dispositivo.
export function sumarUnDia(fecha: string): string | null {
  const partes = PATRON_FECHA.exec(fecha);
  if (partes === null) return null;
  let anio = Number(partes[1]);
  let mes = Number(partes[2]);
  let dia = Number(partes[3]) + 1;
  const diasDelMes =
    mes === FEBRERO && esBisiesto(anio) ? DIAS_FEBRERO_BISIESTO : (DIAS_POR_MES[mes - 1] ?? 0);
  if (diasDelMes === 0) return null;
  if (dia > diasDelMes) {
    dia = 1;
    mes += 1;
    if (mes > DIAS_POR_MES.length) {
      mes = 1;
      anio += 1;
    }
  }
  return `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

export function textoPeriodoComprobante(
  modo: ModoComprobante,
  plan: PlanVigente | null,
): string | null {
  if (plan === null) return null;
  switch (modo) {
    case 'PRIMER_PAGO':
      return TEXTO_PERIODO_PRIMER_PAGO;
    case 'RENOVACION': {
      const limite = plan.planPendiente?.fechaLimitePago;
      return limite
        ? `${TEXTO_PERIODO_PRIMER_PAGO} Tienes hasta el ${limite} para pagarlo; si no, pasarás al plan Libre.`
        : TEXTO_PERIODO_PRIMER_PAGO;
    }
    case 'ANTICIPADO': {
      if (plan.fechaCorte === null) {
        return 'Tu renovación se activa cuando el administrador valide tu comprobante.';
      }
      const inicio = sumarUnDia(plan.fechaCorte);
      const empezara = inicio ? ` Tu renovación empezará el ${inicio} y` : ' Tu renovación';
      return `Tu plan actual termina el ${plan.fechaCorte}.${empezara} se activa cuando el administrador valide tu comprobante.`;
    }
    default:
      return null;
  }
}

function textoPagoEnRevision(pago: UltimoPago, plan: PlanVigente | null): TextoEstadoPago {
  return {
    clave: 'REVISION',
    mensaje:
      plan?.estado === 'PAGO'
        ? 'Tu pago por anticipado está en revisión: el administrador validará tu comprobante'
        : 'En revisión: el administrador validará tu comprobante',
    detalle: `Subido el ${pago.pag_fechaPago}`,
  };
}

export function textoEstadoPago(
  pago: UltimoPago | null,
  plan: PlanVigente | null,
): TextoEstadoPago {
  if (pago?.pag_situacion === 'R') return textoPagoEnRevision(pago, plan);
  if (pago?.pag_situacion === 'F') {
    return {
      clave: 'RECHAZADO',
      mensaje: pago.motivoRechazo ? `Rechazado: ${pago.motivoRechazo}` : 'Rechazado',
      detalle: 'Puedes subir otro comprobante con otro número de transacción.',
    };
  }
  if (plan?.planProgramado) {
    return {
      clave: 'PROGRAMADO',
      mensaje: `Tu renovación ya está pagada, empieza el ${plan.planProgramado.fechaInicio}`,
      detalle: null,
    };
  }
  if (plan?.estado === 'PAGO') {
    return {
      clave: 'ACTIVO',
      mensaje: plan.fechaCorte ? `Plan activo hasta ${plan.fechaCorte}` : 'Tu plan está activo',
      detalle: null,
    };
  }
  if (plan?.planPendiente) {
    return {
      clave: 'SIN_COMPROBANTE',
      mensaje: 'Aún no has subido tu comprobante',
      detalle: 'Súbelo para que el administrador pueda activar tu plan.',
    };
  }
  return { clave: 'SIN_PAGOS', mensaje: 'No tienes pagos pendientes', detalle: null };
}
