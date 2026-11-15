import { ResumenPlanPago } from '../modelos/PasoPago.modelo';

export const MENSAJE_METODO_NO_DISPONIBLE = 'Este método aún no está disponible, elige otro';

const PATRON_NO_DIGITOS = /\D/g;
const MARCADOR_PLAN = '{plan}';
const MARCADOR_MONTO = '{monto}';

// El servidor guarda los textos con htmlspecialchars; se devuelven al texto original
// para mostrarlos o volver a guardarlos sin que se escapen dos veces.
const ENTIDADES_DEL_SERVIDOR: readonly (readonly [string, string])[] = [
  ['&#039;', "'"],
  ['&quot;', '"'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&amp;', '&'],
];

export function desescaparEntidades(texto: string): string {
  return ENTIDADES_DEL_SERVIDOR.reduce(
    (resultado, [entidad, caracter]) => resultado.split(entidad).join(caracter),
    texto,
  );
}

export function numeroWhatsapp(numero: string | null): string {
  return (numero ?? '').replace(PATRON_NO_DIGITOS, '');
}

export function descripcionPlan(resumen: ResumenPlanPago): string {
  return resumen.intervalo ? `${resumen.nombrePlan} (${resumen.intervalo})` : resumen.nombrePlan;
}

function mensajeDesdePlantilla(plantilla: string, resumen: ResumenPlanPago): string {
  const monto = resumen.monto !== null ? String(resumen.monto) : '';
  return desescaparEntidades(plantilla)
    .split(MARCADOR_PLAN)
    .join(descripcionPlan(resumen))
    .split(MARCADOR_MONTO)
    .join(monto)
    .trim();
}

// Solo menciona el plan elegido: sin nombre, correo ni otros datos personales.
export function mensajeSolicitudBanco(
  resumen: ResumenPlanPago,
  plantilla: string | null = null,
): string {
  if (plantilla !== null && plantilla.trim() !== '') return mensajeDesdePlantilla(plantilla, resumen);
  const monto = resumen.monto !== null ? ` por un monto de ${resumen.monto}` : '';
  return (
    `Hola, quiero pagar el plan ${descripcionPlan(resumen)}${monto} por transferencia bancaria. ` +
    'Por favor, envíenme los datos de la cuenta bancaria para realizar el pago.'
  );
}

export function enlaceWhatsapp(numero: string, mensaje: string): string | null {
  if (numero === '') return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
