import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import {
  LimitesPlan,
  PlanPendiente,
  PlanVigente,
} from '../modelos/PlanVigente.modelo';
import { CLAVE_PLAN_AVISADO } from '../servicios/plan-avisado.service';
import { SuscripcionService } from '../servicios/suscripcion.service';
import { Subject } from 'rxjs';
import {
  ESPERA_MAXIMA_PLAN_MS,
  INTERVALO_TICK_MS,
  PlanVigenteStore,
  RELOJ_MONOTONICO,
} from './plan-vigente.store';

const ID_USUARIO = 7;
const MS_POR_SEGUNDO = 1_000;

const LIMITES: LimitesPlan = {
  numCuentas: 1,
  diasReporte: 10,
  diasAnalisis: 10,
  maxOperacionesAnalisis: 50,
  diasTotalesAnalisis: 10,
  puedeGraficar: false,
  puedeDescargar: false,
  divisorEditable: false,
  maxOperacionesDiarias: 5,
};

function crearPlan(cambios: Partial<PlanVigente> = {}): PlanVigente {
  return {
    estado: 'PRUEBA',
    vigente: true,
    esPrueba: true,
    motivoSinPlan: null,
    idSuscripcion: 100,
    pin_idPlanInterv: 2,
    plan: null,
    fechaFinUtc: null,
    fechaCorte: null,
    segundosRestantes: 86_399,
    cancelado: false,
    planSiguiente: null,
    planPendiente: null,
    planProgramado: null,
    limites: LIMITES,
    ...cambios,
  };
}

function crearPendiente(cambios: Partial<PlanPendiente> = {}): PlanPendiente {
  return {
    sis_idSuscrip: 200,
    pin_idPlanInterv: 5,
    pla_nombre: 'Pro',
    ins_nombre: 'Mensual',
    pin_precioFinal: 20,
    comprobanteEnviado: true,
    esRenovacion: false,
    fechaLimitePago: null,
    diasRestantesPago: null,
    ...cambios,
  };
}

describe('PlanVigenteStore', () => {
  let servicio: jasmine.SpyObj<SuscripcionService>;
  let relojMs: number;
  let autenticado: ReturnType<typeof signal<boolean>>;

  function crearStore(): InstanceType<typeof PlanVigenteStore> {
    TestBed.configureTestingModule({
      providers: [
        { provide: SuscripcionService, useValue: servicio },
        { provide: RELOJ_MONOTONICO, useValue: () => relojMs },
        { provide: SesionStore, useValue: { estaAutenticado: autenticado } },
      ],
    });
    return TestBed.inject(PlanVigenteStore);
  }

  function marcarComoAvisado(
    estado: string,
    idSuscripcion: number | null,
  ): void {
    localStorage.setItem(
      CLAVE_PLAN_AVISADO,
      JSON.stringify({ usuarioId: ID_USUARIO, estado, idSuscripcion }),
    );
  }

  beforeEach(() => {
    localStorage.removeItem(CLAVE_PLAN_AVISADO);
    relojMs = 1_000;
    autenticado = signal(true);
    servicio = jasmine.createSpyObj<SuscripcionService>('SuscripcionService', [
      'obtenerPlanVigente',
    ]);
  });

  afterEach(() => {
    localStorage.removeItem(CLAVE_PLAN_AVISADO);
  });

  it('PV-1: muestra el tiempo restante con los segundos del servidor', () => {
    servicio.obtenerPlanVigente.and.returnValue(of(crearPlan()));
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.textoTiempoRestante()).toBe('Tu prueba termina en 23 h 59 min');
    expect(store.isLoading()).toBeFalse();
  });

  it('PV-2: descuenta el tiempo transcurrido con el reloj monótono', fakeAsync(() => {
    servicio.obtenerPlanVigente.and.returnValue(
      of(crearPlan({ segundosRestantes: 3_700 })),
    );
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });
    expect(store.segundosRestantes()).toBe(3_700);

    store.vigilar(true);
    relojMs += 100 * MS_POR_SEGUNDO;
    tick(INTERVALO_TICK_MS);

    expect(store.segundosRestantes()).toBe(3_600);
    expect(store.textoTiempoRestante()).toBe('Tu prueba termina en 1 h 0 min');
    store.vigilar(false);
  }));

  it('PV-3: formatos de menos de una hora y de menos de un minuto', fakeAsync(() => {
    servicio.obtenerPlanVigente.and.returnValue(
      of(crearPlan({ segundosRestantes: 3_000 })),
    );
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });
    expect(store.textoTiempoRestante()).toBe('Tu prueba termina en 50 min');

    store.vigilar(true);
    relojMs += 2_970 * MS_POR_SEGUNDO;
    tick(INTERVALO_TICK_MS);
    expect(store.textoTiempoRestante()).toBe(
      'Tu prueba termina en menos de 1 min',
    );
    store.vigilar(false);
  }));

  it('PV-4: el contador nunca baja de cero', fakeAsync(() => {
    servicio.obtenerPlanVigente.and.returnValue(
      of(crearPlan({ segundosRestantes: 10 })),
    );
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });
    servicio.obtenerPlanVigente.and.returnValue(
      of(crearPlan({ segundosRestantes: 0 })),
    );
    store.vigilar(true);
    relojMs += 500 * MS_POR_SEGUNDO;

    tick(INTERVALO_TICK_MS);

    expect(store.segundosRestantes()).toBe(0);
    store.vigilar(false);
  }));

  it('PV-5: sin plan cargado no hay texto de tiempo ni aviso', () => {
    const store = crearStore();

    expect(store.textoTiempoRestante()).toBeNull();
    expect(store.aviso()).toBeNull();
    expect(store.segundosRestantes()).toBe(0);
  });

  it('PV-6: el código no usa el reloj del dispositivo', () => {
    spyOn(Date, 'now').and.callThrough();
    servicio.obtenerPlanVigente.and.returnValue(of(crearPlan()));
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(Date.now).not.toHaveBeenCalled();
  });

  it('PV-7: la prueba en curso no avisa y deja la marca', () => {
    servicio.obtenerPlanVigente.and.returnValue(of(crearPlan()));
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.aviso()).toBeNull();
    expect(JSON.parse(localStorage.getItem(CLAVE_PLAN_AVISADO) ?? '{}')).toEqual({
      usuarioId: ID_USUARIO,
      estado: 'PRUEBA',
      idSuscripcion: 100,
    });
  });

  it('PV-8: prueba terminada avisa del plan Libre una sola vez', () => {
    marcarComoAvisado('PRUEBA', 100);
    servicio.obtenerPlanVigente.and.returnValue(
      of(
        crearPlan({
          estado: 'LIBRE',
          esPrueba: false,
          idSuscripcion: 101,
          segundosRestantes: 10 * 86_400,
        }),
      ),
    );
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });
    expect(store.aviso()).toBe(
      'Tu prueba terminó; estás en el plan Libre y te quedan 10 días',
    );

    store.marcarAvisoLeido();
    expect(store.aviso()).toBeNull();

    TestBed.resetTestingModule();
    const otroStore = crearStore();
    otroStore.cargar({ usuarioId: ID_USUARIO });
    expect(otroStore.aviso()).toBeNull();
  });

  it('PV-9: un plan de pago activo avisa con su nombre y fecha de corte', () => {
    marcarComoAvisado('LIBRE', 101);
    servicio.obtenerPlanVigente.and.returnValue(
      of(
        crearPlan({
          estado: 'PAGO',
          esPrueba: false,
          idSuscripcion: 102,
          fechaCorte: '2026-12-10',
          plan: {
            pla_idPlan: 3,
            pla_nombre: 'Pro',
            pla_numCuentas: 3,
            pla_diasHistorial: null,
            pla_diasTotales: null,
            pla_bloqueoDias: null,
            pla_puedeDescargar: true,
            pla_descargaTodos: true,
            pla_rangoLibre: true,
          },
        }),
      ),
    );
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.aviso()).toBe('Tu plan Pro está activo hasta el 2026-12-10');
  });

  it('PV-10: otro id de suscripción con el mismo estado vuelve a avisar', () => {
    marcarComoAvisado('PAGO', 102);
    servicio.obtenerPlanVigente.and.returnValue(
      of(
        crearPlan({
          estado: 'PAGO',
          esPrueba: false,
          idSuscripcion: 150,
        }),
      ),
    );
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.aviso()).toContain('está activo');
  });

  it('PV-11: al volver a la app (visibilitychange) pide de nuevo el plan', fakeAsync(() => {
    servicio.obtenerPlanVigente.and.returnValue(of(crearPlan()));
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });
    store.vigilar(true);
    servicio.obtenerPlanVigente.calls.reset();

    spyOnProperty(document, 'visibilityState').and.returnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(servicio.obtenerPlanVigente).toHaveBeenCalledTimes(1);
    store.vigilar(false);
  }));

  it('PV-12: con segundos en cero el tick pide el plan una sola vez', fakeAsync(() => {
    servicio.obtenerPlanVigente.and.returnValue(
      of(crearPlan({ segundosRestantes: 20 })),
    );
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });
    store.vigilar(true);
    servicio.obtenerPlanVigente.calls.reset();
    relojMs += 60 * MS_POR_SEGUNDO;

    tick(INTERVALO_TICK_MS);
    tick(INTERVALO_TICK_MS);

    expect(servicio.obtenerPlanVigente).toHaveBeenCalledTimes(1);
    store.vigilar(false);
  }));

  it('PV-13: cuenta anterior sin plan avisa que debe activar uno', () => {
    servicio.obtenerPlanVigente.and.returnValue(
      of(
        crearPlan({
          estado: 'SIN_PLAN',
          vigente: false,
          esPrueba: false,
          motivoSinPlan: 'NUNCA_TUVO_PLAN',
          idSuscripcion: null,
          segundosRestantes: null,
        }),
      ),
    );
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.aviso()).toBe(
      'Debes activar un plan para usar todas las funciones',
    );
    expect(store.puedeVerPlanes()).toBeTrue();
  });

  it('PV-14: si planVigente falla deja plan nulo y error sin romper', () => {
    servicio.obtenerPlanVigente.and.returnValue(
      throwError(() => ({ status: 500 })),
    );
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.plan()).toBeNull();
    expect(store.errorMessage()).not.toBeNull();
    expect(store.isLoading()).toBeFalse();
  });

  it('PV-15: plan de pago vencido con renovación pendiente avisa los días', () => {
    marcarComoAvisado('PAGO', 102);
    const vencido = (dias: number): PlanVigente =>
      crearPlan({
        estado: 'SIN_PLAN',
        esPrueba: false,
        vigente: false,
        motivoSinPlan: 'PLAN_PAGO_VENCIDO',
        idSuscripcion: null,
        segundosRestantes: null,
        planPendiente: crearPendiente({
          comprobanteEnviado: false,
          esRenovacion: true,
          diasRestantesPago: dias,
        }),
      });
    servicio.obtenerPlanVigente.and.returnValue(of(vencido(12)));
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.aviso()).toBe(
      'Tu plan Pro terminó. Tienes 12 días para pagarlo; si no, pasarás al plan Libre',
    );
    expect(store.mensajePendiente()).toContain(
      'Tienes 12 días para pagarlo; si no, pasarás al plan Libre.',
    );

    store.establecer(ID_USUARIO, vencido(0));
    expect(store.aviso()).toBe(
      'Tu plan Pro terminó. Hoy es el último día para pagarlo; si no, pasarás al plan Libre',
    );
  });

  it('PV-16: sin renovación pendiente avisa que el plan de pago terminó', () => {
    marcarComoAvisado('PAGO', 102);
    servicio.obtenerPlanVigente.and.returnValue(
      of(
        crearPlan({
          estado: 'SIN_PLAN',
          esPrueba: false,
          vigente: false,
          motivoSinPlan: 'PLAN_PAGO_VENCIDO',
          idSuscripcion: null,
          segundosRestantes: null,
        }),
      ),
    );
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.aviso()).toBe('Tu plan de pago terminó');
  });

  it('PV-17: renovación anulada avisa y luego el Libre terminado', () => {
    marcarComoAvisado('SIN_PLAN', null);
    servicio.obtenerPlanVigente.and.returnValue(
      of(
        crearPlan({
          estado: 'LIBRE',
          esPrueba: false,
          idSuscripcion: 160,
          segundosRestantes: 10 * 86_400,
        }),
      ),
    );
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.aviso()).toBe(
      'Tu renovación se anuló por falta de pago; estás en el plan Libre y te quedan 10 días',
    );

    store.marcarAvisoLeido();
    store.establecer(
      ID_USUARIO,
      crearPlan({
        estado: 'SIN_PLAN',
        esPrueba: false,
        vigente: false,
        motivoSinPlan: 'LIBRE_TERMINADO',
        idSuscripcion: null,
        segundosRestantes: null,
      }),
    );
    expect(store.aviso()).toBe('Terminó tu plan Libre');
  });

  it('PV-18: periodo programado muestra la tarjeta de renovación pagada', () => {
    marcarComoAvisado('PAGO', 102);
    servicio.obtenerPlanVigente.and.returnValue(
      of(
        crearPlan({
          estado: 'PAGO',
          esPrueba: false,
          idSuscripcion: 102,
          planProgramado: {
            sis_idSuscrip: 300,
            pin_idPlanInterv: 5,
            pla_nombre: 'Pro',
            ins_nombre: 'Mensual',
            fechaInicio: '2026-12-11',
            fechaFin: '2027-01-10',
          },
        }),
      ),
    );
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.mensajeProgramado()).toBe(
      'Tu renovación ya está pagada, empieza el 2026-12-11',
    );
    expect(store.aviso()).toBeNull();
  });

  it('PV-19: pago anticipado en revisión y plan pendiente sin comprobante', () => {
    servicio.obtenerPlanVigente.and.returnValue(
      of(
        crearPlan({
          estado: 'PAGO',
          esPrueba: false,
          planPendiente: crearPendiente({ comprobanteEnviado: true }),
        }),
      ),
    );
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });

    expect(store.mensajePendiente()).toBe(
      'Tu pago por anticipado está en revisión; el administrador lo validará.',
    );
    expect(store.puedeVerEstadoPago()).toBeTrue();

    store.establecer(
      ID_USUARIO,
      crearPlan({
        planPendiente: crearPendiente({ comprobanteEnviado: false }),
      }),
    );
    expect(store.mensajePendiente()).toBe(
      'Tu plan Pro está pendiente de pago. Sube tu comprobante para activarlo: tu plan corre desde el día en que lo subes y se activa cuando el administrador lo valide.',
    );
    expect(store.puedeSubirComprobante()).toBeTrue();
    expect(store.puedeVerEstadoPago()).toBeFalse();

    store.establecer(
      ID_USUARIO,
      crearPlan({ estado: 'SIN_PLAN', planPendiente: crearPendiente({ comprobanteEnviado: true }) }),
    );
    expect(store.mensajePendiente()).toBe(
      'Recibimos tu comprobante. Está en revisión: el administrador lo validará y activará tu plan Pro.',
    );
    expect(store.puedeSubirComprobante()).toBeFalse();
    expect(store.puedeVerEstadoPago()).toBeTrue();
    expect(store.tituloPendiente()).toBe('Pro · Mensual');
  });

  it('PV-20: puedePagarAnticipado solo con plan de pago sin pendiente ni programado', () => {
    const store = crearStore();
    store.establecer(ID_USUARIO, crearPlan({ estado: 'PAGO' }));
    expect(store.puedePagarAnticipado()).toBeTrue();

    store.establecer(
      ID_USUARIO,
      crearPlan({ estado: 'PAGO', planProgramado: { sis_idSuscrip: 9 } as never }),
    );
    expect(store.puedePagarAnticipado()).toBeFalse();

    store.establecer(ID_USUARIO, crearPlan({ estado: 'PAGO', planPendiente: crearPendiente() }));
    expect(store.puedePagarAnticipado()).toBeFalse();

    store.establecer(ID_USUARIO, crearPlan({ estado: 'LIBRE' }));
    expect(store.puedePagarAnticipado()).toBeFalse();
    expect(store.puedeSubirComprobante()).toBeFalse();
    expect(store.puedeVerEstadoPago()).toBeFalse();
  });

  function sinPlan(pendiente: PlanPendiente | null): PlanVigente {
    return crearPlan({
      estado: 'SIN_PLAN',
      vigente: false,
      esPrueba: false,
      motivoSinPlan: 'LIBRE_TERMINADO',
      segundosRestantes: null,
      planPendiente: pendiente,
    });
  }

  it('PV-15: estadoMenu sigue la tabla de la HU', () => {
    servicio.obtenerPlanVigente.and.returnValue(of(sinPlan(crearPendiente())));
    const store = crearStore();
    expect(store.estadoMenu()).toBe('COMPLETO');

    store.cargar({ usuarioId: ID_USUARIO });
    expect(store.estadoMenu()).toBe('MINIMO_PENDIENTE');

    store.establecer(ID_USUARIO, sinPlan(null));
    expect(store.estadoMenu()).toBe('SIN_PLAN');
  });

  it('PV-16: registrarBloqueo y limpiarBloqueo guardan y borran el motivo', () => {
    const store = crearStore();
    store.establecer(ID_USUARIO, sinPlan(null));

    store.registrarBloqueo('SIN_PLAN', '/cuentas');
    expect(store.bloqueoVisible()).toEqual({ estado: 'SIN_PLAN', rutaIntentada: '/cuentas' });
    expect(store.textoBloqueo()).toBe('Debes activar un plan');

    store.limpiarBloqueo();
    expect(store.bloqueoVisible()).toBeNull();
    expect(store.textoBloqueo()).toBeNull();
  });

  it('PV-17: el bloqueo se evalúa con el plan actual (al elegir plan pasa a pendiente)', () => {
    const store = crearStore();
    store.establecer(ID_USUARIO, sinPlan(null));
    store.registrarBloqueo('SIN_PLAN', '/cuentas');

    store.establecer(
      ID_USUARIO,
      sinPlan(crearPendiente({ comprobanteEnviado: false })),
    );

    expect(store.bloqueoVisible()?.estado).toBe('MINIMO_PENDIENTE');
    expect(store.textoBloqueo()).toContain('está pendiente de pago');
  });

  it('PV-18: si el plan vuelve a ser completo ya no hay aviso de bloqueo', () => {
    const store = crearStore();
    store.registrarBloqueo('SIN_PLAN', '/cuentas');
    store.establecer(ID_USUARIO, crearPlan({ estado: 'LIBRE' }));
    expect(store.bloqueoVisible()).toBeNull();
  });

  it('PV-19: esperarPlan emite el plan cuando termina la carga', fakeAsync(() => {
    const respuesta = new Subject<PlanVigente>();
    servicio.obtenerPlanVigente.and.returnValue(respuesta);
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });
    let emitido: PlanVigente | null | undefined;
    store.esperarPlan().subscribe((plan) => (emitido = plan));

    tick(500);
    expect(emitido).toBeUndefined();

    respuesta.next(sinPlan(null));
    respuesta.complete();
    tick(100);

    expect(emitido?.estado).toBe('SIN_PLAN');
  }));

  it('PV-20: esperarPlan emite null a los 3 s si la carga no termina', fakeAsync(() => {
    servicio.obtenerPlanVigente.and.returnValue(new Subject<PlanVigente>());
    const store = crearStore();
    store.cargar({ usuarioId: ID_USUARIO });
    let emitido: PlanVigente | null | undefined;
    store.esperarPlan().subscribe((plan) => (emitido = plan));

    tick(ESPERA_MAXIMA_PLAN_MS - 1);
    expect(emitido).toBeUndefined();
    tick(1);

    expect(emitido).toBeNull();
  }));

  it('PV-21: puedeCancelar solo con plan de pago sin cancelar y fecha de término', () => {
    const store = crearStore();
    store.establecer(
      ID_USUARIO,
      crearPlan({ estado: 'PAGO', esPrueba: false, fechaCorte: '2026-12-01' }),
    );
    expect(store.puedeCancelar()).toBeTrue();
    expect(store.fechaTerminoPlan()).toBe('2026-12-01');
    expect(store.mensajeConfirmarCancelacion()).toContain('2026-12-01');

    store.establecer(
      ID_USUARIO,
      crearPlan({ estado: 'PAGO', esPrueba: false, cancelado: true, fechaCorte: '2026-12-01' }),
    );
    expect(store.puedeCancelar()).toBeFalse();
    expect(store.estaCancelado()).toBeTrue();

    store.establecer(ID_USUARIO, crearPlan({ estado: 'LIBRE' }));
    expect(store.puedeCancelar()).toBeFalse();
  });

  it('PV-22: con periodo programado el plan termina al final de ese periodo', () => {
    const store = crearStore();
    store.establecer(
      ID_USUARIO,
      crearPlan({
        estado: 'PAGO',
        cancelado: true,
        fechaCorte: '2026-12-01',
        planProgramado: {
          sis_idSuscrip: 3,
          pin_idPlanInterv: 5,
          pla_nombre: 'Pro',
          ins_nombre: 'Mensual',
          fechaInicio: '2026-12-01',
          fechaFin: '2027-01-01',
        },
      }),
    );
    expect(store.fechaTerminoPlan()).toBe('2027-01-01');
  });

  it('LP-03: sin plan cargado los límites no restringen', () => {
    const store = crearStore();

    expect(store.limites().numCuentas).toBeNull();
    expect(store.limites().puedeGraficar).toBeTrue();
  });

  it('LP-04: con el plan cargado los límites son los del servidor y cambian en caliente', () => {
    servicio.obtenerPlanVigente.and.returnValues(
      of(crearPlan({ estado: 'SIN_PLAN', motivoSinPlan: 'NUNCA_TUVO_PLAN' })),
      of(crearPlan({ limites: { ...LIMITES, numCuentas: 5 } })),
    );
    const store = crearStore();

    store.cargar({ usuarioId: ID_USUARIO });
    expect(store.limites().numCuentas).toBe(1);

    store.cargar({ usuarioId: ID_USUARIO });
    expect(store.limites().numCuentas).toBe(5);
  });
});
