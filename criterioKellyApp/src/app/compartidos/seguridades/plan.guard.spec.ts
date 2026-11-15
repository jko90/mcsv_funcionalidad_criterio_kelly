import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { isObservable, Observable, of } from 'rxjs';
import {
  PlanPendiente,
  PlanVigente,
} from 'src/app/paginas/suscripcion/modelos/PlanVigente.modelo';
import { PlanVigenteStore } from 'src/app/paginas/suscripcion/store/plan-vigente.store';
import { SesionStore } from '../store/sesion.store';
import { planGuard } from './plan.guard';

const ID_USUARIO = 7;

function planSinPlan(pendiente: PlanPendiente | null): PlanVigente {
  return { estado: 'SIN_PLAN', planPendiente: pendiente } as PlanVigente;
}

const PENDIENTE = { pla_nombre: 'Pro' } as PlanPendiente;

describe('planGuard', () => {
  let planStoreDoble: {
    cargado: ReturnType<typeof signal<boolean>>;
    usuarioId: ReturnType<typeof signal<number | null>>;
    plan: ReturnType<typeof signal<PlanVigente | null>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    cargar: jasmine.Spy;
    esperarPlan: jasmine.Spy;
    registrarBloqueo: jasmine.Spy;
  };
  let autenticado: ReturnType<typeof signal<boolean>>;
  let usuario: ReturnType<typeof signal<{ id: number } | null>>;

  beforeEach(() => {
    planStoreDoble = {
      cargado: signal(true),
      usuarioId: signal<number | null>(ID_USUARIO),
      plan: signal<PlanVigente | null>(null),
      isLoading: signal(false),
      cargar: jasmine.createSpy('cargar'),
      esperarPlan: jasmine.createSpy('esperarPlan').and.returnValue(of(null)),
      registrarBloqueo: jasmine.createSpy('registrarBloqueo'),
    };
    autenticado = signal(true);
    usuario = signal<{ id: number } | null>({ id: ID_USUARIO });
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanVigenteStore, useValue: planStoreDoble },
        {
          provide: SesionStore,
          useValue: {
            estaAutenticado: autenticado,
            usuario,
            estadoRestauracion: signal('finalizada'),
            restaurarSesion: () => undefined,
          },
        },
      ],
    });
  });

  function ejecutar(url: string): boolean | UrlTree | Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      planGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree | Observable<boolean | UrlTree>;
  }

  function urlDeInicio(resultado: unknown): string {
    return TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  }

  it('G-1: sin sesión permite', () => {
    autenticado.set(false);
    expect(ejecutar('/cuentas')).toBeTrue();
  });

  it('G-2: ruta libre permite sin consultar el plan', () => {
    planStoreDoble.plan.set(planSinPlan(null));
    expect(ejecutar('/mostrar-criterio-kelly')).toBeTrue();
    expect(ejecutar('/inicio')).toBeTrue();
    expect(ejecutar('/planes')).toBeTrue();
  });

  it('G-3: estado COMPLETO permite', () => {
    planStoreDoble.plan.set({ estado: 'LIBRE' } as PlanVigente);
    expect(ejecutar('/cuentas')).toBeTrue();
    expect(planStoreDoble.registrarBloqueo).not.toHaveBeenCalled();
  });

  it('G-4: MINIMO_PENDIENTE lleva al inicio y registra el bloqueo', () => {
    planStoreDoble.plan.set(planSinPlan(PENDIENTE));
    const resultado = ejecutar('/cuentas?x=1');
    expect(urlDeInicio(resultado)).toBe('/inicio');
    expect(planStoreDoble.registrarBloqueo).toHaveBeenCalledWith(
      'MINIMO_PENDIENTE',
      '/cuentas',
    );
  });

  it('G-5: SIN_PLAN lleva al inicio y registra el bloqueo', () => {
    planStoreDoble.plan.set(planSinPlan(null));
    const resultado = ejecutar('/bitacora');
    expect(urlDeInicio(resultado)).toBe('/inicio');
    expect(planStoreDoble.registrarBloqueo).toHaveBeenCalledWith('SIN_PLAN', '/bitacora');
  });

  it('G-6: plan no cargado lo pide, espera y decide', (done) => {
    planStoreDoble.cargado.set(false);
    planStoreDoble.esperarPlan.and.returnValue(of(planSinPlan(null)));
    const resultado = ejecutar('/cuentas');
    expect(planStoreDoble.cargar).toHaveBeenCalledWith({ usuarioId: ID_USUARIO });
    expect(isObservable(resultado)).toBeTrue();
    (resultado as Observable<boolean | UrlTree>).subscribe((valor) => {
      expect(urlDeInicio(valor)).toBe('/inicio');
      done();
    });
  });

  it('G-7: plan de otro usuario se vuelve a pedir', () => {
    planStoreDoble.usuarioId.set(99);
    planStoreDoble.plan.set(planSinPlan(null));
    planStoreDoble.esperarPlan.and.returnValue(of(null));
    const resultado = ejecutar('/cuentas');
    expect(planStoreDoble.cargar).toHaveBeenCalledWith({ usuarioId: ID_USUARIO });
    (resultado as Observable<boolean | UrlTree>).subscribe((valor) => {
      expect(valor).toBeTrue();
    });
  });

  it('G-8: fallo al leer el plan (null) permite', (done) => {
    planStoreDoble.cargado.set(false);
    planStoreDoble.esperarPlan.and.returnValue(of(null));
    (ejecutar('/cuentas') as Observable<boolean | UrlTree>).subscribe((valor) => {
      expect(valor).toBeTrue();
      done();
    });
  });

  it('G-9: si el plan está cargándose no vuelve a pedirlo', () => {
    planStoreDoble.cargado.set(false);
    planStoreDoble.isLoading.set(true);
    ejecutar('/cuentas');
    expect(planStoreDoble.cargar).not.toHaveBeenCalled();
    expect(planStoreDoble.esperarPlan).toHaveBeenCalled();
  });
});
