import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { PlanVigente } from '../modelos/PlanVigente.modelo';
import { PlanVigenteStore } from './plan-vigente.store';
import { SuscripcionModelo } from '../modelos/Suscripcion.modelo';
import {
  CLAVE_PLAN_RESERVADO,
  CLAVE_SUSCRIPCION_VERIFICADA,
  PlanReservadoService,
} from '../servicios/plan-reservado.service';
import { SuscripcionService } from '../servicios/suscripcion.service';
import { SuscripcionStore } from './SuscripcionStore';

const ID_USUARIO = 12;

const suscripcionCreada: SuscripcionModelo = {
  sis_idSuscrip: 70,
  sus_usuarioId: ID_USUARIO,
  sus_pinIdPlanin: 1,
  sus_fechainicio: '2026-11-07',
  sus_fechaFin: '2026-11-14',
  sus_situacion: 'A',
  sus_referenPago: '',
  sus_renovAutomatica: false,
  sus_proximoPago: '2026-11-14',
  sus_fechaCrea: '2026-11-07',
};


const planDePrueba = {
  estado: 'PRUEBA',
  vigente: true,
  esPrueba: true,
  idSuscripcion: 100,
  segundosRestantes: 86_399,
} as PlanVigente;

const ID_PLAN_DE_PAGO = 5;

describe('SuscripcionStore.asegurarSuscripcionInicial', () => {
  let servicioDoble: jasmine.SpyObj<SuscripcionService>;
  let planReservado: PlanReservadoService;

  function crearStore(): InstanceType<typeof SuscripcionStore> {
    TestBed.configureTestingModule({
      providers: [
        { provide: SuscripcionService, useValue: servicioDoble },
        { provide: SesionStore, useValue: { estaAutenticado: signal(true) } },
      ],
    });
    planReservado = TestBed.inject(PlanReservadoService);
    return TestBed.inject(SuscripcionStore);
  }

  function solicitar(
    store: InstanceType<typeof SuscripcionStore>,
    usuario = 'ana',
  ): void {
    store.asegurarSuscripcionInicial({ usuarioId: ID_USUARIO, usuario });
  }

  beforeEach(() => {
    localStorage.removeItem(CLAVE_PLAN_RESERVADO);
    localStorage.removeItem(CLAVE_SUSCRIPCION_VERIFICADA);
    servicioDoble = jasmine.createSpyObj<SuscripcionService>(
      'SuscripcionService',
      ['crearSuscripcionInicial', 'iniciarPrueba'],
    );
    servicioDoble.iniciarPrueba.and.returnValue(of(planDePrueba));
    servicioDoble.crearSuscripcionInicial.and.returnValue(
      of(suscripcionCreada),
    );
  });

  afterEach(() => {
    localStorage.removeItem(CLAVE_PLAN_RESERVADO);
    localStorage.removeItem(CLAVE_SUSCRIPCION_VERIFICADA);
  });

  it('SI-1: sin reserva solo pide la prueba y marca la verificación', () => {
    const store = crearStore();

    solicitar(store);

    expect(servicioDoble.crearSuscripcionInicial).not.toHaveBeenCalled();
    expect(servicioDoble.iniciarPrueba).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(PlanVigenteStore).plan()).toEqual(planDePrueba);
    expect(planReservado.estaVerificada(ID_USUARIO)).toBeTrue();
    expect(store.isError()).toBeNull();
  });

  it('SI-2: con reserva Libre no crea suscripción y borra la reserva', () => {
    const store = crearStore();
    planReservado.reservar('ana', 1);

    solicitar(store, 'Ana');

    expect(servicioDoble.crearSuscripcionInicial).not.toHaveBeenCalled();
    expect(servicioDoble.iniciarPrueba).toHaveBeenCalled();
    expect(localStorage.getItem(CLAVE_PLAN_RESERVADO)).toBeNull();
  });

  it('SI-2b: la reserva ajena no se usa ni se borra', () => {
    const store = crearStore();
    planReservado.reservar('ana', ID_PLAN_DE_PAGO);

    solicitar(store, 'luis');

    expect(servicioDoble.crearSuscripcionInicial).not.toHaveBeenCalled();
    expect(planReservado.obtener('ana')).toBe(ID_PLAN_DE_PAGO);
  });

  it('SI-3: con la marca previa no llama a ningún servicio', () => {
    const store = crearStore();
    planReservado.marcarVerificada(ID_USUARIO);

    solicitar(store);

    expect(servicioDoble.iniciarPrueba).not.toHaveBeenCalled();
    expect(servicioDoble.crearSuscripcionInicial).not.toHaveBeenCalled();
    expect(store.isLoading()).toBeFalse();
  });

  it('SI-4: limpiar restablece el estado y conserva la marca local', () => {
    const store = crearStore();
    planReservado.reservar('ana', ID_PLAN_DE_PAGO);
    solicitar(store);

    store.limpiar();

    expect(store.objSuscripcionSelec()).toBeNull();
    expect(store.listaSuscripciones()).toEqual([]);
    expect(planReservado.estaVerificada(ID_USUARIO)).toBeTrue();
  });

  it('SI-5: una prueba rechazada con 409 es éxito sin error', () => {
    servicioDoble.iniciarPrueba.and.returnValue(
      throwError(() => ({ status: 409 })),
    );
    const store = crearStore();

    solicitar(store);

    expect(store.isError()).toBeNull();
    expect(planReservado.estaVerificada(ID_USUARIO)).toBeTrue();
  });

  it('SI-6: sin sesión válida (401) no marca y deja error', () => {
    servicioDoble.iniciarPrueba.and.returnValue(
      throwError(() => ({ status: 401 })),
    );
    const store = crearStore();

    solicitar(store);

    expect(store.isError()).not.toBeNull();
    expect(planReservado.estaVerificada(ID_USUARIO)).toBeFalse();
  });

  it('SI-7: la reserva de pago se crea antes de pedir la prueba', () => {
    const store = crearStore();
    planReservado.reservar('ana', ID_PLAN_DE_PAGO);

    solicitar(store);

    expect(servicioDoble.crearSuscripcionInicial).toHaveBeenCalledWith({
      sus_pinIdPlanin: ID_PLAN_DE_PAGO,
    });
    expect(servicioDoble.crearSuscripcionInicial).toHaveBeenCalledBefore(
      servicioDoble.iniciarPrueba,
    );
    expect(store.objSuscripcionSelec()).toEqual(suscripcionCreada);
    expect(localStorage.getItem(CLAVE_PLAN_RESERVADO)).toBeNull();
    expect(planReservado.estaVerificada(ID_USUARIO)).toBeTrue();
  });

  it('SI-7b: un 409 en la reserva sigue con la prueba', () => {
    servicioDoble.crearSuscripcionInicial.and.returnValue(
      throwError(() => ({ status: 409 })),
    );
    const store = crearStore();
    planReservado.reservar('ana', ID_PLAN_DE_PAGO);

    solicitar(store);

    expect(servicioDoble.iniciarPrueba).toHaveBeenCalled();
    expect(planReservado.estaVerificada(ID_USUARIO)).toBeTrue();
  });

  it('SI-8: un 409 en la prueba tras la reserva marca y borra la reserva', () => {
    servicioDoble.iniciarPrueba.and.returnValue(
      throwError(() => ({ status: 409 })),
    );
    const store = crearStore();
    planReservado.reservar('ana', ID_PLAN_DE_PAGO);

    solicitar(store);

    expect(store.isError()).toBeNull();
    expect(planReservado.estaVerificada(ID_USUARIO)).toBeTrue();
    expect(localStorage.getItem(CLAVE_PLAN_RESERVADO)).toBeNull();
  });

  it('SI-9: 429, 500 o fallo de red dejan error, sin marca y con reserva', () => {
    for (const estado of [429, 500, 0]) {
      localStorage.removeItem(CLAVE_SUSCRIPCION_VERIFICADA);
      servicioDoble.iniciarPrueba.and.returnValue(
        throwError(() => ({ status: estado })),
      );
      TestBed.resetTestingModule();
      const store = crearStore();
      planReservado.reservar('ana', ID_PLAN_DE_PAGO);

      solicitar(store);

      expect(store.isError()).not.toBeNull();
      expect(planReservado.estaVerificada(ID_USUARIO)).toBeFalse();
      expect(planReservado.obtener('ana')).toBe(ID_PLAN_DE_PAGO);
    }
  });

  it('SI-9b: si falla la reserva (500) no pide la prueba ni marca', () => {
    servicioDoble.crearSuscripcionInicial.and.returnValue(
      throwError(() => ({ status: 500 })),
    );
    const store = crearStore();
    planReservado.reservar('ana', ID_PLAN_DE_PAGO);

    solicitar(store);

    expect(servicioDoble.iniciarPrueba).not.toHaveBeenCalled();
    expect(store.isError()).not.toBeNull();
    expect(planReservado.estaVerificada(ID_USUARIO)).toBeFalse();
  });
});

describe('SuscripcionStore · elegir plan y cancelar', () => {
  let servicioDoble: jasmine.SpyObj<SuscripcionService>;
  let planVigenteDoble: {
    usuarioId: ReturnType<typeof signal<number | null>>;
    cargar: jasmine.Spy;
    establecer: jasmine.Spy;
  };

  function crearStore(): InstanceType<typeof SuscripcionStore> {
    TestBed.configureTestingModule({
      providers: [
        { provide: SuscripcionService, useValue: servicioDoble },
        { provide: PlanVigenteStore, useValue: planVigenteDoble },
        { provide: SesionStore, useValue: { estaAutenticado: signal(true) } },
      ],
    });
    return TestBed.inject(SuscripcionStore);
  }

  beforeEach(() => {
    servicioDoble = jasmine.createSpyObj<SuscripcionService>('SuscripcionService', [
      'crearSuscripcionInicial',
      'cancelarPlan',
    ]);
    planVigenteDoble = {
      usuarioId: signal<number | null>(ID_USUARIO),
      cargar: jasmine.createSpy('cargar'),
      establecer: jasmine.createSpy('establecer'),
    };
  });

  it('EP-1: elegirPlan crea la suscripción pendiente y recarga el plan vigente', () => {
    servicioDoble.crearSuscripcionInicial.and.returnValue(of(suscripcionCreada));
    const store = crearStore();

    store.elegirPlan(ID_PLAN_DE_PAGO);

    expect(servicioDoble.crearSuscripcionInicial).toHaveBeenCalledWith({
      sus_pinIdPlanin: ID_PLAN_DE_PAGO,
    });
    expect(planVigenteDoble.cargar).toHaveBeenCalledWith({ usuarioId: ID_USUARIO });
    expect(store.errorElegirPlan()).toBeNull();
    expect(store.isLoading()).toBeFalse();
  });

  it('EP-2: un 409 se trata como éxito y recarga el plan', () => {
    servicioDoble.crearSuscripcionInicial.and.returnValue(
      throwError(() => ({ status: 409 })),
    );
    const store = crearStore();

    store.elegirPlan(ID_PLAN_DE_PAGO);

    expect(planVigenteDoble.cargar).toHaveBeenCalledWith({ usuarioId: ID_USUARIO });
    expect(store.errorElegirPlan()).toBeNull();
    expect(store.avisoConflictoPlan()).toContain('ya tienes uno');
  });

  it('EP-3: otro error deja un mensaje y no recarga', () => {
    servicioDoble.crearSuscripcionInicial.and.returnValue(
      throwError(() => ({ status: 500 })),
    );
    const store = crearStore();

    store.elegirPlan(ID_PLAN_DE_PAGO);

    expect(store.errorElegirPlan()).toContain('No se pudo elegir el plan');
    expect(planVigenteDoble.cargar).not.toHaveBeenCalled();
    expect(store.isLoading()).toBeFalse();
  });

  it('EP-4: un nuevo intento limpia el error anterior', () => {
    servicioDoble.crearSuscripcionInicial.and.returnValue(
      throwError(() => ({ status: 500 })),
    );
    const store = crearStore();
    store.elegirPlan(ID_PLAN_DE_PAGO);
    servicioDoble.crearSuscripcionInicial.and.returnValue(of(suscripcionCreada));

    store.elegirPlan(ID_PLAN_DE_PAGO);

    expect(store.errorElegirPlan()).toBeNull();
  });

  it('CA-1: cancelarPlan guarda el plan devuelto por el servidor', () => {
    const planCancelado = { estado: 'PAGO', cancelado: true } as PlanVigente;
    servicioDoble.cancelarPlan.and.returnValue(of(planCancelado));
    const store = crearStore();

    store.cancelarPlan();

    expect(servicioDoble.cancelarPlan).toHaveBeenCalledTimes(1);
    expect(planVigenteDoble.establecer).toHaveBeenCalledWith(ID_USUARIO, planCancelado);
    expect(store.isLoading()).toBeFalse();
  });

  it('CA-2: si el servidor rechaza (409) no cambia el plan y se apaga la carga', () => {
    servicioDoble.cancelarPlan.and.returnValue(throwError(() => ({ status: 409 })));
    const store = crearStore();

    store.cancelarPlan();

    expect(planVigenteDoble.establecer).not.toHaveBeenCalled();
    expect(store.isError()).toBe('No se pudo cancelar el plan');
    expect(store.isLoading()).toBeFalse();
  });

  it('CA-3: sin usuario cargado no intenta guardar el plan', () => {
    planVigenteDoble.usuarioId.set(null);
    servicioDoble.cancelarPlan.and.returnValue(of({ estado: 'PAGO' } as PlanVigente));
    const store = crearStore();

    store.cancelarPlan();

    expect(planVigenteDoble.establecer).not.toHaveBeenCalled();
  });

  it('CA-4: la petición no lleva id (lo decide el servidor por la sesión)', () => {
    servicioDoble.cancelarPlan.and.returnValue(of({ estado: 'PAGO' } as PlanVigente));
    const store = crearStore();

    store.cancelarPlan();

    expect(servicioDoble.cancelarPlan).toHaveBeenCalledWith();
  });
});
