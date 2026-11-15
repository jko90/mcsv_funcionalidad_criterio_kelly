import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import {
  SolicitudComprobante,
  UltimoPago,
  UltimoPagoRespuesta,
} from '../modelos/EstadoPago.modelo';
import { PlanPendiente, PlanVigente } from '../modelos/PlanVigente.modelo';
import { SuscripcionModelo } from '../modelos/Suscripcion.modelo';
import { PagosService } from '../servicios/pagos.service';
import { SuscripcionService } from '../servicios/suscripcion.service';
import { ComprobanteStore } from './comprobante.store';
import { PlanVigenteStore } from './plan-vigente.store';

const ID_USUARIO = 7;

const SOLICITUD: SolicitudComprobante = {
  metodoPago: 'BANCO',
  idTransaccion: 'TX-1',
  comprobante: 'data:image/png;base64,AAAA',
};

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

function crearPlan(cambios: Partial<PlanVigente> = {}): PlanVigente {
  return {
    estado: 'SIN_PLAN',
    pin_idPlanInterv: 9,
    fechaCorte: null,
    planPendiente: crearPendiente(),
    planProgramado: null,
    ...cambios,
  } as PlanVigente;
}

function crearPago(cambios: Partial<UltimoPago> = {}): UltimoPago {
  return {
    pag_idPago: 1,
    sis_idSuscrip: 200,
    pag_situacion: 'R',
    pag_fechaPago: '2026-11-12',
    pag_monto: 20,
    pag_moneda: 'USD',
    pag_metodoPago: 'BANCO',
    pla_nombre: 'Pro',
    ins_nombre: 'Mensual',
    tieneComprobante: true,
    motivoRechazo: null,
    ...cambios,
  };
}

describe('ComprobanteStore', () => {
  let pagos: jasmine.SpyObj<PagosService>;
  let suscripcion: jasmine.SpyObj<SuscripcionService>;
  let plan: WritableSignal<PlanVigente | null>;
  let cargarPlan: jasmine.Spy;

  function crearStore(): InstanceType<typeof ComprobanteStore> {
    TestBed.configureTestingModule({
      providers: [
        { provide: PagosService, useValue: pagos },
        { provide: SuscripcionService, useValue: suscripcion },
        {
          provide: PlanVigenteStore,
          useValue: { plan, usuarioId: signal(ID_USUARIO), cargar: cargarPlan },
        },
        { provide: SesionStore, useValue: { usuario: signal({ id: ID_USUARIO }) } },
      ],
    });
    return TestBed.inject(ComprobanteStore);
  }

  beforeEach(() => {
    pagos = jasmine.createSpyObj<PagosService>('PagosService', ['obtenerMiUltimoPago']);
    suscripcion = jasmine.createSpyObj<SuscripcionService>('SuscripcionService', [
      'crearSuscripcionConPago',
    ]);
    pagos.obtenerMiUltimoPago.and.returnValue(of({ pago: null }));
    plan = signal<PlanVigente | null>(crearPlan());
    cargarPlan = jasmine.createSpy('cargar');
  });

  it('CS-01: cargarUltimoPago guarda la respuesta del servidor', () => {
    const respuesta: UltimoPagoRespuesta = { pago: crearPago() };
    pagos.obtenerMiUltimoPago.and.returnValue(of(respuesta));
    const store = crearStore();

    store.cargarUltimoPago();

    expect(store.ultimoPago()).toEqual(respuesta.pago);
    expect(store.isLoading()).toBeFalse();
    expect(store.errorMessage()).toBeNull();
  });

  it('CS-01b: si la consulta falla deja un mensaje y apaga loading', () => {
    pagos.obtenerMiUltimoPago.and.returnValue(throwError(() => new Error('falla')));
    const store = crearStore();

    store.cargarUltimoPago();

    expect(store.errorMessage()).toBe('No se pudo consultar el estado de tu pago');
    expect(store.isLoading()).toBeFalse();
  });

  it('CS-02: enviarComprobante con plan pendiente usa su suscripción y no envía monto', () => {
    suscripcion.crearSuscripcionConPago.and.returnValue(of({} as SuscripcionModelo));
    const store = crearStore();

    store.enviarComprobante(SOLICITUD);

    expect(suscripcion.crearSuscripcionConPago).toHaveBeenCalledOnceWith({
      ...SOLICITUD,
      pin_idPlanInterv: 5,
      sis_idSuscrip: 200,
    });
  });

  it('CS-02b: el pago anticipado usa el plan vigente y omite sis_idSuscrip', () => {
    plan.set(crearPlan({ estado: 'PAGO', planPendiente: null }));
    suscripcion.crearSuscripcionConPago.and.returnValue(of({} as SuscripcionModelo));
    const store = crearStore();

    expect(store.modo()).toBe('ANTICIPADO');
    store.enviarComprobante(SOLICITUD);

    const cuerpo = suscripcion.crearSuscripcionConPago.calls.mostRecent().args[0];
    expect(cuerpo).toEqual({ ...SOLICITUD, pin_idPlanInterv: 9 });
    expect('sis_idSuscrip' in cuerpo).toBeFalse();
  });

  it('CS-03: el éxito recarga el plan vigente y el último pago', () => {
    suscripcion.crearSuscripcionConPago.and.returnValue(of({} as SuscripcionModelo));
    const store = crearStore();

    store.enviarComprobante(SOLICITUD);

    expect(cargarPlan).toHaveBeenCalledOnceWith({ usuarioId: ID_USUARIO });
    expect(pagos.obtenerMiUltimoPago).toHaveBeenCalledTimes(1);
    expect(store.envioExitoso()).toBeTrue();
    expect(store.enviando()).toBeFalse();
  });

  for (const estado of [409, 400]) {
    it(`CS-0${estado === 409 ? 4 : 5}: ${estado} deja el mensaje del servidor y enviando=false`, () => {
      suscripcion.crearSuscripcionConPago.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: estado,
              error: { error: 'Ya hay un comprobante en revisión para esta suscripción' },
            }),
        ),
      );
      const store = crearStore();

      store.enviarComprobante(SOLICITUD);

      expect(store.errorMessage()).toBe(
        'Ya hay un comprobante en revisión para esta suscripción',
      );
      expect(store.enviando()).toBeFalse();
      expect(store.envioExitoso()).toBeFalse();
      expect(cargarPlan).not.toHaveBeenCalled();
    });
  }

  it('CS-06: un segundo envío mientras se envía no llama al servicio', () => {
    const respuesta$ = new Subject<never>();
    suscripcion.crearSuscripcionConPago.and.returnValue(respuesta$);
    const store = crearStore();

    store.enviarComprobante(SOLICITUD);
    expect(store.enviando()).toBeTrue();
    store.enviarComprobante({ ...SOLICITUD, idTransaccion: 'TX-2' });

    expect(suscripcion.crearSuscripcionConPago).toHaveBeenCalledTimes(1);
  });

  it('sin plan pendiente ni plan de pago no envía y avisa', () => {
    plan.set(crearPlan({ estado: 'LIBRE', planPendiente: null, pin_idPlanInterv: null }));
    const store = crearStore();

    store.enviarComprobante(SOLICITUD);

    expect(suscripcion.crearSuscripcionConPago).not.toHaveBeenCalled();
    expect(store.errorMessage()).toBe('No hay un plan para el que puedas subir un comprobante');
    expect(store.enviando()).toBeFalse();
  });

  describe('modo y puedeEnviar', () => {
    it('primer pago y renovación con formulario; en revisión sin formulario', () => {
      const store = crearStore();
      expect(store.modo()).toBe('PRIMER_PAGO');
      expect(store.puedeEnviar()).toBeTrue();
      expect(store.tituloFormulario()).toBe('Subir comprobante');

      plan.set(crearPlan({ planPendiente: crearPendiente({ esRenovacion: true }) }));
      expect(store.modo()).toBe('RENOVACION');
      expect(store.puedeEnviar()).toBeTrue();

      plan.set(crearPlan({ planPendiente: crearPendiente({ comprobanteEnviado: true }) }));
      expect(store.estaEnRevision()).toBeTrue();
      expect(store.puedeEnviar()).toBeFalse();
    });

    it('anticipado solo sin pendiente ni programado; con pendiente en revisión no hay formulario', () => {
      const store = crearStore();
      plan.set(crearPlan({ estado: 'PAGO', planPendiente: null }));
      expect(store.modo()).toBe('ANTICIPADO');
      expect(store.puedeEnviar()).toBeTrue();
      expect(store.tituloFormulario()).toBe('Pagar mi renovación por anticipado');

      plan.set(
        crearPlan({
          estado: 'PAGO',
          planPendiente: null,
          planProgramado: { sis_idSuscrip: 3 } as never,
        }),
      );
      expect(store.modo()).toBe('NINGUNO');
      expect(store.puedeEnviar()).toBeFalse();

      plan.set(
        crearPlan({
          estado: 'PAGO',
          planPendiente: crearPendiente({ comprobanteEnviado: true }),
        }),
      );
      expect(store.modo()).toBe('ANTICIPADO');
      expect(store.puedeEnviar()).toBeFalse();
    });

    it('rechazado (F) con pendiente sin comprobante vuelve a mostrar el formulario', () => {
      pagos.obtenerMiUltimoPago.and.returnValue(
        of({ pago: crearPago({ pag_situacion: 'F', motivoRechazo: 'Ilegible' }) }),
      );
      const store = crearStore();
      store.cargarUltimoPago();
      expect(store.puedeEnviar()).toBeTrue();
    });

    it('sin plan cargado no hay modo', () => {
      plan.set(null);
      const store = crearStore();
      expect(store.modo()).toBe('NINGUNO');
      expect(store.textoPeriodo()).toBeNull();
    });
  });
});
