import { PlanVigente } from '../modelos/PlanVigente.modelo';
import { UltimoPago } from '../modelos/EstadoPago.modelo';
import {
  sumarUnDia,
  textoEstadoPago,
  textoPeriodoComprobante,
} from './textos-comprobante';

function plan(cambios: Partial<PlanVigente>): PlanVigente {
  return {
    estado: 'SIN_PLAN',
    fechaCorte: null,
    planPendiente: null,
    planProgramado: null,
    ...cambios,
  } as PlanVigente;
}

function pago(cambios: Partial<UltimoPago>): UltimoPago {
  return {
    pag_situacion: 'R',
    pag_fechaPago: '2026-11-12 10:00:00',
    motivoRechazo: null,
    ...cambios,
  } as UltimoPago;
}

describe('textos-comprobante · sumarUnDia', () => {
  it('suma un día con cambio de mes, de año y bisiesto', () => {
    expect(sumarUnDia('2026-11-12')).toBe('2026-11-13');
    expect(sumarUnDia('2026-11-30')).toBe('2026-12-01');
    expect(sumarUnDia('2026-12-31')).toBe('2027-01-01');
    expect(sumarUnDia('2028-02-28')).toBe('2028-02-29');
    expect(sumarUnDia('2027-02-28')).toBe('2027-03-01');
  });

  it('devuelve null con una cadena inválida', () => {
    expect(sumarUnDia('hoy')).toBeNull();
    expect(sumarUnDia('2026-13-01')).toBeNull();
  });
});

describe('textos-comprobante · textoPeriodoComprobante', () => {
  it('primer pago', () => {
    expect(textoPeriodoComprobante('PRIMER_PAGO', plan({}))).toBe(
      'Tu plan corre desde la fecha de tu comprobante: el día en que lo subes. Se activa cuando el administrador lo valide.',
    );
  });

  it('renovación añade el plazo del servidor', () => {
    const texto = textoPeriodoComprobante(
      'RENOVACION',
      plan({ planPendiente: { fechaLimitePago: '2026-12-10' } as never }),
    );
    expect(texto).toContain(
      'Tienes hasta el 2026-12-10 para pagarlo; si no, pasarás al plan Libre.',
    );
  });

  it('anticipado usa fechaCorte y el día siguiente', () => {
    expect(
      textoPeriodoComprobante('ANTICIPADO', plan({ estado: 'PAGO', fechaCorte: '2026-12-31' })),
    ).toBe(
      'Tu plan actual termina el 2026-12-31. Tu renovación empezará el 2027-01-01 y se activa cuando el administrador valide tu comprobante.',
    );
  });

  it('sin plan o sin modo no hay texto', () => {
    expect(textoPeriodoComprobante('PRIMER_PAGO', null)).toBeNull();
    expect(textoPeriodoComprobante('NINGUNO', plan({}))).toBeNull();
  });
});

describe('textos-comprobante · textoEstadoPago', () => {
  it('R: en revisión con la fecha de subida', () => {
    const texto = textoEstadoPago(pago({}), plan({}));
    expect(texto.clave).toBe('REVISION');
    expect(texto.mensaje).toBe('En revisión: el administrador validará tu comprobante');
    expect(texto.detalle).toBe('Subido el 2026-11-12 10:00:00');
  });

  it('R con plan de pago: pago anticipado en revisión', () => {
    expect(textoEstadoPago(pago({}), plan({ estado: 'PAGO' })).mensaje).toContain(
      'Tu pago por anticipado está en revisión',
    );
  });

  it('F: rechazado con el motivo', () => {
    const texto = textoEstadoPago(
      pago({ pag_situacion: 'F', motivoRechazo: 'Ilegible' }),
      plan({}),
    );
    expect(texto.clave).toBe('RECHAZADO');
    expect(texto.mensaje).toBe('Rechazado: Ilegible');
  });

  it('C o sin pago con estado PAGO: plan activo hasta la fecha de corte', () => {
    expect(
      textoEstadoPago(
        pago({ pag_situacion: 'C' }),
        plan({ estado: 'PAGO', fechaCorte: '2026-12-31' }),
      ).mensaje,
    ).toBe('Plan activo hasta 2026-12-31');
    expect(
      textoEstadoPago(null, plan({ estado: 'PAGO', fechaCorte: '2026-12-31' })).clave,
    ).toBe('ACTIVO');
  });

  it('con periodo programado: renovación ya pagada', () => {
    expect(
      textoEstadoPago(
        null,
        plan({ estado: 'PAGO', planProgramado: { fechaInicio: '2027-01-01' } as never }),
      ).mensaje,
    ).toBe('Tu renovación ya está pagada, empieza el 2027-01-01');
  });

  it('sin pago y con plan pendiente: falta subir el comprobante', () => {
    const texto = textoEstadoPago(null, plan({ planPendiente: {} as never }));
    expect(texto.clave).toBe('SIN_COMPROBANTE');
    expect(texto.mensaje).toBe('Aún no has subido tu comprobante');
  });

  it('sin pago ni plan pendiente: no hay pagos pendientes', () => {
    expect(textoEstadoPago(null, plan({})).mensaje).toBe('No tienes pagos pendientes');
    expect(textoEstadoPago(null, null).clave).toBe('SIN_PAGOS');
  });
});
