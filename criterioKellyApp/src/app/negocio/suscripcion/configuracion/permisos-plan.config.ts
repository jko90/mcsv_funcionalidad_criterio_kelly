import { LimitesPlan, PlanPendiente, PlanVigente } from '../modelos/PlanVigente.modelo';
import { PlanesModelo } from '../modelos/Planes.modelo';

export type EstadoMenu = 'COMPLETO' | 'MINIMO_PENDIENTE' | 'SIN_PLAN';

export interface BloqueoPlan {
  estado: EstadoMenu;
  rutaIntentada: string;
}

export const RUTAS_SIEMPRE_HABILITADAS: readonly string[] = [
  '/inicio',
  '/mostrar-criterio-kelly',
  '/perfil',
  '/cambiar-pin',
  '/ayuda',
  '/acerca-d',
  '/comprobante',
];

export const RUTAS_CONTROLADAS: readonly string[] = [
  '/bitacora',
  '/bitacora-seguimiento',
  '/bitacora-fin',
  '/busca-divisa',
  '/operativas',
  '/analisis',
  '/grafico-stadistico',
  '/cuentas',
  '/operativa-kelly',
];

// Rutas privadas que el plan nunca bloquea (RN-03); se listan para que la
// spec de clasificación (R-04) distinga «abierta a propósito» de «olvidada».
export const RUTAS_PRIVADAS_ABIERTAS: readonly string[] = [
  '/bloqueo',
  '/modal-pin',
];

// Rutas que el plan nunca bloquea porque las protege el rol, no el plan (RN-03).
export const RUTAS_POR_ROL: readonly string[] = ['/validar-pagos', '/datos-pago'];

export const TEXTO_DEBES_ACTIVAR_PLAN = 'Debes activar un plan';

export function estadoMenuDesdePlan(plan: PlanVigente | null): EstadoMenu {
  if (plan === null || plan.estado !== 'SIN_PLAN') return 'COMPLETO';
  return plan.planPendiente !== null ? 'MINIMO_PENDIENTE' : 'SIN_PLAN';
}

export function normalizarRuta(ruta: string): string {
  const sinParametros = ruta.split(/[?#]/)[0];
  return sinParametros.length > 1 ? sinParametros.replace(/\/+$/, '') : sinParametros;
}

function coincideConRuta(ruta: string, base: string): boolean {
  return ruta === base || ruta.startsWith(`${base}/`);
}

export function esRutaControlada(ruta: string): boolean {
  const rutaNormalizada = normalizarRuta(ruta);
  if (RUTAS_SIEMPRE_HABILITADAS.some((base) => coincideConRuta(rutaNormalizada, base))) {
    return false;
  }
  return RUTAS_CONTROLADAS.some((base) => coincideConRuta(rutaNormalizada, base));
}

export function estaRutaPermitida(estado: EstadoMenu, ruta: string): boolean {
  return estado === 'COMPLETO' || !esRutaControlada(ruta);
}

function textoDias(cantidad: number): string {
  return cantidad === 1 ? '1 día' : `${cantidad} días`;
}

function textoRenovacionPendiente(pendiente: PlanPendiente): string | null {
  if (!pendiente.esRenovacion || pendiente.diasRestantesPago === null) return null;
  const plazo =
    pendiente.diasRestantesPago > 0
      ? `Tienes ${textoDias(pendiente.diasRestantesPago)} para pagarlo`
      : 'Hoy es el último día para pagarlo';
  return `Tu plan ${pendiente.pla_nombre} terminó. ${plazo}; si no, pasarás al plan Libre`;
}

export function textoBloqueo(
  estado: EstadoMenu,
  planPendiente: PlanPendiente | null,
): string {
  if (estado === 'COMPLETO') return '';
  if (estado === 'SIN_PLAN' || planPendiente === null) return TEXTO_DEBES_ACTIVAR_PLAN;
  if (planPendiente.comprobanteEnviado) {
    return `Tu comprobante de pago está en revisión; tu plan ${planPendiente.pla_nombre} se activará cuando el administrador lo valide`;
  }
  return (
    textoRenovacionPendiente(planPendiente) ??
    `Tu plan ${planPendiente.pla_nombre} está pendiente de pago y se activará cuando valide tu comprobante.`
  );
}

// ---------------------------------------------------------------- límites por pantalla (HLT-27)

/** Divisor que usa el servidor cuando el plan no deja editarlo (D-04). */
export const DIVISOR_KELLY_RECOMENDADO = 10;

export const RUTA_PLANES = '/planes';
export const TEXTO_FUNCION_NO_INCLUIDA = 'Actualiza su plan para poder visualizar';
export const TEXTO_DIVISOR_FIJO = `Tu plan usa el divisor ${DIVISOR_KELLY_RECOMENDADO}. Actualiza tu plan para cambiarlo`;

const MS_POR_DIA = 86_400_000;
const LONGITUD_FECHA_ISO = 10;

/** Sin plan cargado o sin dato: no se restringe (D-01); el servidor sí aplica los límites. */
export const LIMITES_SIN_RESTRICCION: LimitesPlan = {
  numCuentas: null,
  diasReporte: null,
  diasAnalisis: null,
  maxOperacionesAnalisis: null,
  diasTotalesAnalisis: null,
  puedeGraficar: true,
  puedeDescargar: true,
  divisorEditable: true,
  maxOperacionesDiarias: null,
};

export function limitesPantalla(plan: PlanVigente | null): LimitesPlan {
  return plan?.limites ?? LIMITES_SIN_RESTRICCION;
}

function textoPlural(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

export function textoAvisoDiasReporte(limites: LimitesPlan): string | null {
  const { diasReporte, diasTotalesAnalisis } = limites;
  if (diasReporte === null) return null;
  // Con la ventana total igual (Enterprise, Prueba) no se recorta nada y no se avisa.
  if (diasTotalesAnalisis !== null && diasReporte >= diasTotalesAnalisis) return null;
  return `Tu plan muestra los últimos ${diasReporte} días. Actualiza tu plan para ver más`;
}

export function textoAvisoOperacionesAnalisis(limites: LimitesPlan): string | null {
  if (limites.maxOperacionesAnalisis === null) return null;
  return `Tu plan muestra hasta ${limites.maxOperacionesAnalisis} operaciones por cuenta`;
}

export function textoAvisoRangoAnalisis(limites: LimitesPlan): string | null {
  if (limites.diasAnalisis === null) return null;
  return `Tu plan permite consultar hasta ${limites.diasAnalisis} días`;
}

export function haAlcanzadoTopeCuentas(limites: LimitesPlan, cuentasActuales: number): boolean {
  return limites.numCuentas !== null && cuentasActuales >= limites.numCuentas;
}

export function textoTopeCuentas(limites: LimitesPlan): string {
  const tope = limites.numCuentas ?? 0;
  return `Tu plan permite ${textoPlural(tope, 'cuenta', 'cuentas')}. Actualiza tu plan para crear más`;
}

export function textoTopeOperacionesDiarias(maximo: number): string {
  return `Tu plan permite ${textoPlural(maximo, 'operación', 'operaciones')} ${maximo === 1 ? 'diaria' : 'diarias'}`;
}

// ---------------------------------------------------------------- fechas del análisis (RI-2)

export interface RangoFechas {
  desde: string | null;
  hasta: string;
}

export interface RangoFechasAjustado extends RangoFechas {
  ajustado: boolean;
}

/** Fecha de hoy en UTC como `YYYY-MM-DD`, igual que calcula el servidor. */
export function fechaIsoDeHoy(ahora: Date): string {
  return ahora.toISOString().slice(0, LONGITUD_FECHA_ISO);
}

function sumarDias(fechaIso: string, dias: number): string {
  const instante = Date.parse(`${fechaIso}T00:00:00Z`) + dias * MS_POR_DIA;
  return new Date(instante).toISOString().slice(0, LONGITUD_FECHA_ISO);
}

function diasInclusivos(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA) + 1;
}

export function fechaMinimaAnalisis(limites: LimitesPlan, hoy: string): string | null {
  if (limites.diasTotalesAnalisis === null) return null;
  return sumarDias(hoy, -(limites.diasTotalesAnalisis - 1));
}

export function rangoAnalisisPorDefecto(limites: LimitesPlan, hoy: string): RangoFechas {
  if (limites.diasAnalisis === null) return { desde: null, hasta: hoy };
  return { desde: sumarDias(hoy, -(limites.diasAnalisis - 1)), hasta: hoy };
}

/** Deja el rango dentro de lo que el plan permite; `ajustado` indica que se movió `desde` por exceder los días. */
export function ajustarRangoAnalisis(
  rango: RangoFechas,
  limites: LimitesPlan,
  hoy: string,
): RangoFechasAjustado {
  const hasta = rango.hasta > hoy ? hoy : rango.hasta;
  const minimo = fechaMinimaAnalisis(limites, hoy);
  let desde = rango.desde;
  if (desde !== null && desde > hasta) desde = hasta;
  if (desde !== null && minimo !== null && desde < minimo) desde = minimo;
  const { diasAnalisis } = limites;
  if (diasAnalisis !== null && (desde === null || diasInclusivos(desde, hasta) > diasAnalisis)) {
    return { desde: sumarDias(hasta, -(diasAnalisis - 1)), hasta, ajustado: desde !== null };
  }
  return { desde, hasta, ajustado: false };
}

// ---------------------------------------------------------------- comparación en la pantalla de planes (A-03)

export interface FilaLimitePlan {
  etiqueta: string;
  valor: string;
}

const TEXTO_SIN_LIMITE = 'Sin límite';

function textoSiNo(valor: boolean, textoSi: string, textoNo: string): string {
  return valor ? textoSi : textoNo;
}

export function filasLimitesPlan(plan: PlanesModelo): FilaLimitePlan[] {
  const textoRango = plan.pla_rangoLibre
    ? TEXTO_SIN_LIMITE
    : textoPlural(plan.pla_bloqueoDias, 'día', 'días');
  return [
    { etiqueta: 'Cuentas', valor: String(plan.pla_numCuentas) },
    { etiqueta: 'Días de reporte', valor: textoPlural(plan.pla_diasHistorial, 'día', 'días') },
    { etiqueta: 'Rango de análisis', valor: textoRango },
    {
      etiqueta: 'Operaciones en análisis',
      valor: plan.pla_rangoLibre ? TEXTO_SIN_LIMITE : String(plan.pla_bloqueoDias),
    },
    { etiqueta: 'Graficar operaciones', valor: textoSiNo(plan.pla_puedeGraficar, 'Incluido', 'No incluido') },
    { etiqueta: 'Descargas (PDF y Excel)', valor: textoSiNo(plan.pla_puedeDescargar, 'Incluido', 'No incluido') },
    {
      etiqueta: 'Divisor editable',
      valor: textoSiNo(plan.pla_divisorEditable, 'Sí', `No (fijo en ${DIVISOR_KELLY_RECOMENDADO})`),
    },
    {
      etiqueta: 'Operaciones diarias',
      valor: plan.pla_maxOperacionesDiarias === null ? TEXTO_SIN_LIMITE : String(plan.pla_maxOperacionesDiarias),
    },
  ];
}
