import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { MenuStore } from 'src/app/compartidos/store/menu.store';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { PlanesStore } from '../../../../negocio/suscripcion/store/PlanesStore';
import { PlanVigenteStore } from '../../../../negocio/suscripcion/store/plan-vigente.store';
import { SuscripcionStore } from '../../../../negocio/suscripcion/store/SuscripcionStore';
import { InicioPage } from './inicio.page';

describe('InicioPage · plan vigente', () => {
  const planVigenteDoble = {
    cargar: jasmine.createSpy('cargar'),
    vigilar: jasmine.createSpy('vigilar'),
    limpiarBloqueo: jasmine.createSpy('limpiarBloqueo'),
    bloqueoVisible: signal(null as { estado: string } | null),
    mensajeConfirmarCancelacion: signal('¿Cancelar?'),
  };
  const suscripcionDoble = {
    elegirPlan: jasmine.createSpy('elegirPlan'),
    cancelarPlan: jasmine.createSpy('cancelarPlan'),
    isLoading: signal(false),
    errorElegirPlan: signal<string | null>(null),
    avisoConflictoPlan: signal<string | null>(null),
  };
  const planesDoble = {
    cargarPlanes: jasmine.createSpy('cargarPlanes'),
    planesParaElegir: signal([]),
  };
  const utilDoble = jasmine.createSpyObj('UtilitariosService', ['mostrarToast']);

  function crearPagina(usuario: { id: number } | null): InicioPage {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlanVigenteStore, useValue: planVigenteDoble },
        { provide: SuscripcionStore, useValue: suscripcionDoble },
        { provide: PlanesStore, useValue: planesDoble },
        { provide: UtilitariosService, useValue: utilDoble },
        { provide: SesionStore, useValue: { usuario: signal(usuario) } },
        {
          provide: MenuStore,
          useValue: { listaMenu: signal([]), gruposMenu: signal([]), cargarMenu: () => undefined },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new InicioPage());
  }

  beforeEach(() => {
    for (const espia of [
      planVigenteDoble.cargar,
      planVigenteDoble.vigilar,
      planVigenteDoble.limpiarBloqueo,
      suscripcionDoble.elegirPlan,
      suscripcionDoble.cancelarPlan,
      planesDoble.cargarPlanes,
      utilDoble.mostrarToast,
    ]) {
      espia.calls.reset();
    }
    planVigenteDoble.bloqueoVisible.set(null);
    suscripcionDoble.errorElegirPlan.set(null);
    suscripcionDoble.avisoConflictoPlan.set(null);
  });

  it('al entrar carga el plan vigente del usuario y empieza a vigilar', () => {
    const pagina = crearPagina({ id: 7 });

    pagina.ionViewWillEnter();

    expect(planVigenteDoble.cargar).toHaveBeenCalledWith({ usuarioId: 7 });
    expect(planVigenteDoble.vigilar).toHaveBeenCalledWith(true);
  });

  it('sin usuario en sesión no pide el plan', () => {
    const pagina = crearPagina(null);

    pagina.ionViewWillEnter();

    expect(planVigenteDoble.cargar).not.toHaveBeenCalled();
  });

  it('IP-1: al salir de la pantalla se limpia el aviso de bloqueo', () => {
    const pagina = crearPagina({ id: 7 });
    pagina.ionViewWillLeave();
    expect(planVigenteDoble.limpiarBloqueo).toHaveBeenCalled();
  });

  it('IP-2: elegir un plan pide confirmación y solo al confirmar lo delega en el store', () => {
    const pagina = crearPagina({ id: 7 });
    pagina.alElegirPlan(5);
    expect(pagina.planAConfirmar()).toBe(5);
    expect(suscripcionDoble.elegirPlan).not.toHaveBeenCalled();

    pagina.alCancelarElegirPlan();
    expect(pagina.planAConfirmar()).toBeNull();
    expect(suscripcionDoble.elegirPlan).not.toHaveBeenCalled();

    pagina.alElegirPlan(5);
    pagina.alConfirmarElegirPlan();
    expect(suscripcionDoble.elegirPlan).toHaveBeenCalledOnceWith(5);
    expect(pagina.planAConfirmar()).toBeNull();
  });

  it('IP-2b: el mensaje de confirmación conserva el texto de negocio', () => {
    const pagina = crearPagina({ id: 7 });
    pagina.alElegirPlan(5);
    expect(pagina.mensajeConfirmarPlan()).toBe('¿Seguro que quieres guardar el plan: este plan?');
  });

  it('IP-3: cancelar pide confirmación y solo con «Sí, cancelar» llama al store', () => {
    const pagina = crearPagina({ id: 7 });

    pagina.alSolicitarCancelarPlan();
    expect(pagina.cancelarPlanPendiente()).toBeTrue();
    expect(pagina.mensajeCancelarPlan()).toBe('¿Cancelar?');
    pagina.alDescartarCancelarPlan();
    expect(suscripcionDoble.cancelarPlan).not.toHaveBeenCalled();
    expect(pagina.cancelarPlanPendiente()).toBeFalse();

    pagina.alSolicitarCancelarPlan();
    pagina.alConfirmarCancelarPlan();
    expect(suscripcionDoble.cancelarPlan).toHaveBeenCalledTimes(1);
    expect(pagina.cancelarPlanPendiente()).toBeFalse();
  });

  it('IP-4: la lista de planes se carga solo con el bloqueo SIN_PLAN', () => {
    crearPagina({ id: 7 });
    TestBed.tick();
    expect(planesDoble.cargarPlanes).not.toHaveBeenCalled();

    planVigenteDoble.bloqueoVisible.set({ estado: 'MINIMO_PENDIENTE' });
    TestBed.tick();
    expect(planesDoble.cargarPlanes).not.toHaveBeenCalled();

    planVigenteDoble.bloqueoVisible.set({ estado: 'SIN_PLAN' });
    TestBed.tick();
    expect(planesDoble.cargarPlanes).toHaveBeenCalledTimes(1);
  });

  it('IP-5: el error de elegir plan se muestra en un toast', () => {
    crearPagina({ id: 7 });
    suscripcionDoble.errorElegirPlan.set('No se pudo elegir el plan');
    TestBed.tick();
    expect(utilDoble.mostrarToast).toHaveBeenCalledWith(
      'No se pudo elegir el plan',
      'danger',
    );
  });
});
