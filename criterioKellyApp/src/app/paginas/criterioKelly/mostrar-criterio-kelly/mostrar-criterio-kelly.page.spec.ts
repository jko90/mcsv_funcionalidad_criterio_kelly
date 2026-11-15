import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { CuentaStore } from '../../../configuracion/cuentas/store/cuentaStore';
import { LIMITES_SIN_RESTRICCION } from '../../suscripcion/configuracion/permisos-plan.config';
import { LimitesPlan } from '../../suscripcion/modelos/PlanVigente.modelo';
import { PlanVigenteStore } from '../../suscripcion/store/plan-vigente.store';
import { CriterioKellyStore } from '../store/criterioKellyStore';
import { ResultadosStore } from '../store/resultadosStore';
import { MostrarCriterioKellyPage } from './mostrar-criterio-kelly.page';

describe('MostrarCriterioKellyPage · operaciones diarias según el plan', () => {
  const limites = signal<LimitesPlan>({ ...LIMITES_SIN_RESTRICCION, maxOperacionesDiarias: 1 });
  let mostrarToast: jasmine.Spy;

  function crearPagina(): MostrarCriterioKellyPage {
    mostrarToast = jasmine.createSpy('mostrarToast');
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanVigenteStore, useValue: { limites } },
        {
          provide: CuentaStore,
          useValue: { listaCuentas: signal([]), cuentaSeleccionada: signal(null) },
        },
        {
          provide: CriterioKellyStore,
          useValue: { listaCriteriosKelly: signal([]), criterioKellyActual: signal(null) },
        },
        {
          provide: ResultadosStore,
          useValue: { listaResultados: signal([]), resultadoActual: signal(null) },
        },
        { provide: ServicioAutenticacion, useValue: { obtenerUsuarioActual: () => null } },
        { provide: UtilitariosService, useValue: { mostrarToast } },
      ],
    });
    const pagina = TestBed.runInInjectionContext(() => new MostrarCriterioKellyPage());
    TestBed.tick();
    return pagina;
  }

  it('Libre con 3 se ajusta a 1 y avisa', () => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, maxOperacionesDiarias: 1 });
    const pagina = crearPagina();

    pagina.numOperativasControl.setValue(3);
    TestBed.tick();

    expect(pagina.numOperativasControl.value).toBe(1);
    expect(mostrarToast).toHaveBeenCalledWith('Tu plan permite 1 operación diaria', 'warning');
    expect(pagina.avisoOperacionesDiarias()).toBe('Tu plan permite 1 operación diaria');
  });

  it('un valor dentro del máximo no se toca', () => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, maxOperacionesDiarias: 5 });
    const pagina = crearPagina();

    pagina.numOperativasControl.setValue(4);
    TestBed.tick();

    expect(pagina.numOperativasControl.value).toBe(4);
    expect(mostrarToast).not.toHaveBeenCalled();
  });

  it('Enterprise sin máximo: acepta cualquier valor y no avisa', () => {
    limites.set(LIMITES_SIN_RESTRICCION);
    const pagina = crearPagina();

    pagina.numOperativasControl.setValue(40);
    TestBed.tick();

    expect(pagina.numOperativasControl.value).toBe(40);
    expect(pagina.avisoOperacionesDiarias()).toBeNull();
    expect(pagina.maximoOperacionesDiarias()).toBeNull();
  });
});
