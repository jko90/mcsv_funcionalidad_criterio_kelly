import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ServicioAutenticacion } from 'src/app/configuracion/seguridad/servicio/ServicioAutenticacion';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { PlanesModelo } from '../../modelos/Planes.modelo';
import { PlanesStore } from '../../store/PlanesStore';
import { PlanVigenteStore } from '../../store/plan-vigente.store';
import { PlanesPage } from './planes.page';

function crearPlan(cambios: Partial<PlanesModelo>): PlanesModelo {
  return {
    pin_idPlanInterv: 1,
    pla_nombre: 'Premium',
    pla_numCuentas: 10,
    pla_diasHistorial: 365,
    pla_bloqueoDias: 0,
    pla_rangoLibre: true,
    pla_puedeGraficar: true,
    pla_puedeDescargar: true,
    pla_divisorEditable: true,
    pla_maxOperacionesDiarias: null,
    ...cambios,
  } as PlanesModelo;
}

describe('PlanesPage · comparación de límites (A-03)', () => {
  const planes = signal<PlanesModelo[]>([]);

  function crearPagina(): PlanesPage {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: PlanesStore,
          useValue: {
            cargarPlanes: jasmine.createSpy('cargarPlanes'),
            listaPlanes: planes,
            listaPlanesTitulo: signal([]),
            isLoading: signal(false),
            isError: signal(null),
            objPlanSeleccionado: signal(null),
            seleccionarPlanPorObjeto: jasmine.createSpy(
              'seleccionarPlanPorObjeto',
            ),
          },
        },
        {
          provide: ServicioAutenticacion,
          useValue: { estaAutenticado: () => true },
        },
        { provide: SesionStore, useValue: { usuario: signal(null) } },
        {
          provide: PlanVigenteStore,
          useValue: { cargar: jasmine.createSpy('cargar') },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new PlanesPage());
  }

  it('muestra «Sin límite» para rango libre y operaciones diarias nulas', () => {
    planes.set([crearPlan({ pin_idPlanInterv: 7 })]);
    const pagina = crearPagina();
    pagina.listaPlanSeleccionado.set(planes());

    const filas = pagina.limitesPorPlan().get(7) ?? [];

    expect(filas.length).toBe(8);
    expect(
      filas.find((fila) => fila.etiqueta === 'Rango de análisis')?.valor,
    ).toBe('Sin límite');
    expect(
      filas.find((fila) => fila.etiqueta === 'Operaciones diarias')?.valor,
    ).toBe('Sin límite');
  });

  it('muestra los números de un plan con restricciones', () => {
    planes.set([
      crearPlan({
        pin_idPlanInterv: 2,
        pla_numCuentas: 1,
        pla_rangoLibre: false,
        pla_bloqueoDias: 5,
        pla_maxOperacionesDiarias: 1,
      }),
    ]);
    const pagina = crearPagina();
    pagina.listaPlanSeleccionado.set(planes());

    const filas = pagina.limitesPorPlan().get(2) ?? [];

    expect(filas.find((fila) => fila.etiqueta === 'Cuentas')?.valor).toBe('1');
    expect(
      filas.find((fila) => fila.etiqueta === 'Rango de análisis')?.valor,
    ).toBe('5 días');
    expect(
      filas.find((fila) => fila.etiqueta === 'Operaciones diarias')?.valor,
    ).toBe('1');
  });
});
