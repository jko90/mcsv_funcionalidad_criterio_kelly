import { routes } from 'src/app/app.routes';
import { GuardAutenticacion } from 'src/app/configuracion/seguridad/guardas/GuardAutenticacion';
import { planGuard } from 'src/app/configuracion/seguridad/guardas/plan.guard';
import { PlanesModelo } from '../modelos/Planes.modelo';
import {
  EstadoPlan,
  LimitesPlan,
  MotivoSinPlan,
  PlanPendiente,
  PlanVigente,
} from '../modelos/PlanVigente.modelo';
import {
  ajustarRangoAnalisis,
  fechaIsoDeHoy,
  fechaMinimaAnalisis,
  filasLimitesPlan,
  haAlcanzadoTopeCuentas,
  LIMITES_SIN_RESTRICCION,
  limitesPantalla,
  rangoAnalisisPorDefecto,
  textoAvisoDiasReporte,
  textoAvisoOperacionesAnalisis,
  textoAvisoRangoAnalisis,
  textoTopeCuentas,
  textoTopeOperacionesDiarias,
  esRutaControlada,
  estadoMenuDesdePlan,
  estaRutaPermitida,
  RUTAS_CONTROLADAS,
  RUTAS_PRIVADAS_ABIERTAS,
  RUTAS_POR_ROL,
  RUTAS_SIEMPRE_HABILITADAS,
  textoBloqueo,
} from './permisos-plan.config';

function crearPendiente(cambios: Partial<PlanPendiente> = {}): PlanPendiente {
  return {
    sis_idSuscrip: 200,
    pin_idPlanInterv: 5,
    pla_nombre: 'Pro',
    ins_nombre: 'Mensual',
    pin_precioFinal: 20,
    comprobanteEnviado: false,
    esRenovacion: false,
    fechaLimitePago: null,
    diasRestantesPago: null,
    ...cambios,
  };
}

function crearPlan(
  estado: EstadoPlan,
  motivoSinPlan: MotivoSinPlan | null = null,
  cambios: Partial<PlanVigente> = {},
): PlanVigente {
  return {
    estado,
    motivoSinPlan,
    planPendiente: null,
    planProgramado: null,
    ...cambios,
  } as PlanVigente;
}

describe('permisos-plan.config · estadoMenuDesdePlan', () => {
  it('perfil, ayuda, acerca-d y cambiar-pin son libres sin plan', () => {
    for (const ruta of ['/perfil', '/ayuda', '/acerca-d', '/cambiar-pin']) {
      expect(estaRutaPermitida('SIN_PLAN', ruta)).toBe(true);
      expect(estaRutaPermitida('MINIMO_PENDIENTE', ruta)).toBe(true);
    }
  });

  it('/comprobante está siempre habilitada, también sin plan (RN-08)', () => {
    expect(RUTAS_SIEMPRE_HABILITADAS).toContain('/comprobante');
    for (const estado of ['MINIMO_PENDIENTE', 'SIN_PLAN'] as const) {
      expect(estaRutaPermitida(estado, '/comprobante')).toBeTrue();
    }
  });

  it('estado 1 (prueba) y estado 2 (Libre) son COMPLETO', () => {
    expect(estadoMenuDesdePlan(crearPlan('PRUEBA'))).toBe('COMPLETO');
    expect(estadoMenuDesdePlan(crearPlan('LIBRE'))).toBe('COMPLETO');
  });

  it('estado 5 (plan de pago) es COMPLETO, también con periodo programado o pago anticipado en revisión', () => {
    expect(estadoMenuDesdePlan(crearPlan('PAGO'))).toBe('COMPLETO');
    expect(
      estadoMenuDesdePlan(
        crearPlan('PAGO', null, {
          planProgramado: { sis_idSuscrip: 9 } as never,
        }),
      ),
    ).toBe('COMPLETO');
    expect(
      estadoMenuDesdePlan(
        crearPlan('PAGO', null, { planPendiente: crearPendiente() }),
      ),
    ).toBe('COMPLETO');
  });

  it('estado 3: Libre terminado con plan de pago pendiente es MINIMO_PENDIENTE', () => {
    expect(
      estadoMenuDesdePlan(
        crearPlan('SIN_PLAN', 'LIBRE_TERMINADO', {
          planPendiente: crearPendiente(),
        }),
      ),
    ).toBe('MINIMO_PENDIENTE');
  });

  it('estado 6 descompuesto: renovación pendiente dentro del plazo es estado 3', () => {
    const renovacion = crearPendiente({
      esRenovacion: true,
      diasRestantesPago: 20,
    });
    expect(
      estadoMenuDesdePlan(
        crearPlan('SIN_PLAN', 'PLAN_PAGO_VENCIDO', {
          planPendiente: renovacion,
        }),
      ),
    ).toBe('MINIMO_PENDIENTE');
  });

  it('estado 6 descompuesto: renovación anulada concede el Libre (estado 2) y luego estado 4', () => {
    expect(estadoMenuDesdePlan(crearPlan('LIBRE'))).toBe('COMPLETO');
    expect(estadoMenuDesdePlan(crearPlan('SIN_PLAN', 'LIBRE_TERMINADO'))).toBe(
      'SIN_PLAN',
    );
  });

  it('estado 4: Libre terminado sin plan pendiente y plan de pago vencido sin renovación son SIN_PLAN', () => {
    expect(estadoMenuDesdePlan(crearPlan('SIN_PLAN', 'LIBRE_TERMINADO'))).toBe(
      'SIN_PLAN',
    );
    expect(
      estadoMenuDesdePlan(crearPlan('SIN_PLAN', 'PLAN_PAGO_VENCIDO')),
    ).toBe('SIN_PLAN');
  });

  it('NUNCA_TUVO_PLAN: SIN_PLAN sin plan pendiente y MINIMO_PENDIENTE con plan pendiente', () => {
    expect(estadoMenuDesdePlan(crearPlan('SIN_PLAN', 'NUNCA_TUVO_PLAN'))).toBe(
      'SIN_PLAN',
    );
    expect(
      estadoMenuDesdePlan(
        crearPlan('SIN_PLAN', 'NUNCA_TUVO_PLAN', {
          planPendiente: crearPendiente(),
        }),
      ),
    ).toBe('MINIMO_PENDIENTE');
  });

  it('plan null (sin cargar o con error) es COMPLETO (D-03)', () => {
    expect(estadoMenuDesdePlan(null)).toBe('COMPLETO');
  });
});

describe('permisos-plan.config · rutas', () => {
  it('son 9 las rutas controladas', () => {
    expect(RUTAS_CONTROLADAS.length).toBe(9);
  });

  it('con COMPLETO todas las rutas están permitidas', () => {
    for (const ruta of RUTAS_CONTROLADAS) {
      expect(estaRutaPermitida('COMPLETO', ruta)).toBeTrue();
    }
  });

  for (const estado of ['MINIMO_PENDIENTE', 'SIN_PLAN'] as const) {
    it(`con ${estado} solo abren inicio y criterio Kelly, no las 13 controladas`, () => {
      for (const ruta of RUTAS_SIEMPRE_HABILITADAS) {
        expect(estaRutaPermitida(estado, ruta)).toBeTrue();
      }
      for (const ruta of RUTAS_CONTROLADAS) {
        expect(estaRutaPermitida(estado, ruta)).toBeFalse();
      }
    });
  }

  it('las rutas siempre abiertas no se bloquean aunque lleguen con parámetros', () => {
    for (const ruta of [
      '/planes',
      '/login',
      '/bloqueo',
      '/modal-pin',
      '/inicio?x=1',
    ]) {
      expect(estaRutaPermitida('SIN_PLAN', ruta)).toBeTrue();
    }
    expect(esRutaControlada('/bitacora?id=3#a')).toBeTrue();
    expect(esRutaControlada('/bitacora/')).toBeTrue();
  });
});

describe('permisos-plan.config · textoBloqueo', () => {
  it('plan pendiente normal', () => {
    expect(textoBloqueo('MINIMO_PENDIENTE', crearPendiente())).toBe(
      'Tu plan Pro está pendiente de pago y se activará cuando el administrador valide tu comprobante. Tu plan corre desde la fecha de tu comprobante',
    );
  });

  it('plan pendiente con comprobante en revisión', () => {
    expect(
      textoBloqueo(
        'MINIMO_PENDIENTE',
        crearPendiente({ comprobanteEnviado: true }),
      ),
    ).toBe(
      'Tu comprobante de pago está en revisión; tu plan Pro se activará cuando el administrador lo valide',
    );
  });

  it('renovación con días restantes y con 0 días', () => {
    expect(
      textoBloqueo(
        'MINIMO_PENDIENTE',
        crearPendiente({ esRenovacion: true, diasRestantesPago: 12 }),
      ),
    ).toBe(
      'Tu plan Pro terminó. Tienes 12 días para pagarlo; si no, pasarás al plan Libre',
    );
    expect(
      textoBloqueo(
        'MINIMO_PENDIENTE',
        crearPendiente({ esRenovacion: true, diasRestantesPago: 0 }),
      ),
    ).toBe(
      'Tu plan Pro terminó. Hoy es el último día para pagarlo; si no, pasarás al plan Libre',
    );
  });

  it('sin plan y completo', () => {
    expect(textoBloqueo('SIN_PLAN', null)).toBe('Debes activar un plan');
    expect(textoBloqueo('COMPLETO', null)).toBe('');
  });
});

describe('permisos-plan.config · R-04 clasificación de rutas de app.routes.ts', () => {
  const clasificadas = [
    ...RUTAS_SIEMPRE_HABILITADAS,
    ...RUTAS_CONTROLADAS,
    ...RUTAS_PRIVADAS_ABIERTAS,
    ...RUTAS_POR_ROL,
  ];

  it('toda ruta privada (con GuardAutenticacion) está clasificada', () => {
    const sinClasificar = routes
      .filter((ruta) => ruta.canActivate?.includes(GuardAutenticacion))
      .map((ruta) => `/${ruta.path}`)
      .filter((ruta) => !clasificadas.includes(ruta));
    expect(sinClasificar).toEqual([]);
  });

  it('las rutas controladas son exactamente las que llevan planGuard o redirigen al inicio (HLT-38)', () => {
    // Las rutas heredadas que solo redirigen no ejecutan guardas, pero siguen clasificadas
    // (las abiertas a propósito, como /modal-pin, no cuentan como controladas).
    const conGuarda = routes
      .filter(
        (ruta) =>
          ruta.canActivate?.includes(planGuard) ||
          (ruta.redirectTo === 'inicio' &&
            ruta.path !== '' &&
            !RUTAS_PRIVADAS_ABIERTAS.includes(`/${ruta.path}`)),
      )
      .map((ruta) => `/${ruta.path}`)
      .sort();
    expect(conGuarda).toEqual([...RUTAS_CONTROLADAS].sort());
  });
});

describe('permisos-plan.config · límites por pantalla (HLT-27)', () => {
  const LIBRE: LimitesPlan = {
    numCuentas: 1,
    diasReporte: 8,
    diasAnalisis: 5,
    maxOperacionesAnalisis: 5,
    diasTotalesAnalisis: 8,
    puedeGraficar: false,
    puedeDescargar: false,
    divisorEditable: false,
    maxOperacionesDiarias: 1,
  };
  const ENTERPRISE: LimitesPlan = {
    numCuentas: 10,
    diasReporte: 365,
    diasAnalisis: null,
    maxOperacionesAnalisis: null,
    diasTotalesAnalisis: 365,
    puedeGraficar: true,
    puedeDescargar: true,
    divisorEditable: true,
    maxOperacionesDiarias: null,
  };
  const HOY = '2026-11-12';

  it('LP-01: limitesPantalla devuelve los límites del Libre que manda el servidor', () => {
    expect(
      limitesPantalla(crearPlan('LIBRE', null, { limites: LIBRE })),
    ).toEqual(LIBRE);
  });

  it('LP-02: un plan Básico trae sus propios límites', () => {
    const basico = { ...LIBRE, puedeDescargar: true, diasReporte: 15 };
    expect(
      limitesPantalla(crearPlan('PAGO', null, { limites: basico }))
        .puedeDescargar,
    ).toBeTrue();
  });

  it('LP-03: sin plan cargado no se restringe', () => {
    expect(limitesPantalla(null)).toBe(LIMITES_SIN_RESTRICCION);
    expect(LIMITES_SIN_RESTRICCION.puedeGraficar).toBeTrue();
    expect(LIMITES_SIN_RESTRICCION.numCuentas).toBeNull();
  });

  it('LP-04: NUNCA_TUVO_PLAN usa los límites del Libre que manda el servidor', () => {
    const plan = crearPlan('SIN_PLAN', 'NUNCA_TUVO_PLAN', { limites: LIBRE });
    expect(limitesPantalla(plan).numCuentas).toBe(1);
  });

  it('aviso de días: aparece si recorta y no en Enterprise', () => {
    expect(textoAvisoDiasReporte({ ...LIBRE, diasTotalesAnalisis: 30 })).toBe(
      'Tu plan muestra los últimos 8 días. Actualiza tu plan para ver más',
    );
    expect(textoAvisoDiasReporte(ENTERPRISE)).toBeNull();
    expect(textoAvisoDiasReporte(LIMITES_SIN_RESTRICCION)).toBeNull();
  });

  it('avisos de análisis, cuentas y operaciones diarias', () => {
    expect(textoAvisoOperacionesAnalisis(LIBRE)).toBe(
      'Tu plan muestra hasta 5 operaciones por cuenta',
    );
    expect(textoAvisoOperacionesAnalisis(ENTERPRISE)).toBeNull();
    expect(textoAvisoRangoAnalisis(LIBRE)).toBe(
      'Tu plan permite consultar hasta 5 días',
    );
    expect(textoTopeCuentas(LIBRE)).toBe(
      'Tu plan permite 1 cuenta. Actualiza tu plan para crear más',
    );
    expect(textoTopeCuentas({ ...LIBRE, numCuentas: 5 })).toBe(
      'Tu plan permite 5 cuentas. Actualiza tu plan para crear más',
    );
    expect(textoTopeOperacionesDiarias(1)).toBe(
      'Tu plan permite 1 operación diaria',
    );
    expect(textoTopeOperacionesDiarias(5)).toBe(
      'Tu plan permite 5 operaciones diarias',
    );
  });

  it('tope de cuentas: se alcanza con la cantidad igual al límite', () => {
    expect(haAlcanzadoTopeCuentas(LIBRE, 1)).toBeTrue();
    expect(haAlcanzadoTopeCuentas({ ...LIBRE, numCuentas: 5 }, 4)).toBeFalse();
    expect(haAlcanzadoTopeCuentas(ENTERPRISE, 9)).toBeFalse();
    expect(haAlcanzadoTopeCuentas(LIMITES_SIN_RESTRICCION, 99)).toBeFalse();
  });

  it('rango por defecto: últimos diasAnalisis días o sin fechas si es libre', () => {
    expect(rangoAnalisisPorDefecto(LIBRE, HOY)).toEqual({
      desde: '2026-11-08',
      hasta: HOY,
    });
    expect(rangoAnalisisPorDefecto(ENTERPRISE, HOY)).toEqual({
      desde: null,
      hasta: HOY,
    });
  });

  it('fecha mínima: hoy menos (diasTotalesAnalisis - 1)', () => {
    expect(fechaMinimaAnalisis(LIBRE, HOY)).toBe('2026-11-05');
    expect(fechaMinimaAnalisis(LIMITES_SIN_RESTRICCION, HOY)).toBeNull();
  });

  it('ajuste: un rango mayor a diasAnalisis mueve desde y avisa', () => {
    expect(
      ajustarRangoAnalisis({ desde: '2026-11-05', hasta: HOY }, LIBRE, HOY),
    ).toEqual({
      desde: '2026-11-08',
      hasta: HOY,
      ajustado: true,
    });
  });

  it('ajuste: un rango válido no cambia y uno anterior a la ventana total se acota', () => {
    expect(
      ajustarRangoAnalisis({ desde: '2026-11-10', hasta: HOY }, LIBRE, HOY)
        .ajustado,
    ).toBeFalse();
    const acotado = ajustarRangoAnalisis(
      { desde: '2026-10-01', hasta: '2026-11-07' },
      LIBRE,
      HOY,
    );
    expect(acotado.desde).toBe('2026-11-05');
  });

  it('ajuste: con plan libre se respeta cualquier rango dentro de la ventana', () => {
    expect(
      ajustarRangoAnalisis(
        { desde: '2026-01-01', hasta: HOY },
        ENTERPRISE,
        HOY,
      ),
    ).toEqual({
      desde: '2026-01-01',
      hasta: HOY,
      ajustado: false,
    });
  });

  it('fechaIsoDeHoy usa el formato YYYY-MM-DD', () => {
    expect(fechaIsoDeHoy(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-12');
  });

  it('filasLimitesPlan: «Sin límite» para rango libre y operaciones diarias nulas', () => {
    const filas = filasLimitesPlan({
      pla_numCuentas: 10,
      pla_diasHistorial: 365,
      pla_bloqueoDias: 0,
      pla_rangoLibre: true,
      pla_puedeGraficar: true,
      pla_puedeDescargar: true,
      pla_divisorEditable: true,
      pla_maxOperacionesDiarias: null,
    } as PlanesModelo);
    const porEtiqueta = new Map(
      filas.map((fila) => [fila.etiqueta, fila.valor]),
    );
    expect(filas.length).toBe(8);
    expect(porEtiqueta.get('Rango de análisis')).toBe('Sin límite');
    expect(porEtiqueta.get('Operaciones en análisis')).toBe('Sin límite');
    expect(porEtiqueta.get('Operaciones diarias')).toBe('Sin límite');
    expect(porEtiqueta.get('Cuentas')).toBe('10');
  });

  it('filasLimitesPlan: plan con restricciones', () => {
    const filas = filasLimitesPlan({
      pla_numCuentas: 1,
      pla_diasHistorial: 8,
      pla_bloqueoDias: 5,
      pla_rangoLibre: false,
      pla_puedeGraficar: false,
      pla_puedeDescargar: false,
      pla_divisorEditable: false,
      pla_maxOperacionesDiarias: 1,
    } as PlanesModelo);
    const porEtiqueta = new Map(
      filas.map((fila) => [fila.etiqueta, fila.valor]),
    );
    expect(porEtiqueta.get('Rango de análisis')).toBe('5 días');
    expect(porEtiqueta.get('Graficar operaciones')).toBe('No incluido');
    expect(porEtiqueta.get('Divisor editable')).toBe('No (fijo en 10)');
    expect(porEtiqueta.get('Operaciones diarias')).toBe('1');
  });
});
