import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PlanesModelo } from '../modelos/Planes.modelo';
import { PlanesService } from '../servicios/planes.service';
import { PlanesStore } from './PlanesStore';

function crearPlan(
  idIntervalo: number,
  nombre: string,
  intervalo: string,
  precio: number,
): PlanesModelo {
  return {
    pin_idPlanInterv: idIntervalo,
    pin_precioFinal: precio,
    ins_nombre: intervalo,
    ins_numMeses: 1,
    ins_x100descuen: 0,
    pla_nombre: nombre,
    pla_descripcion: '',
    pla_precioBase: precio,
    pla_moneda: 'USD',
    pla_numCuentas: 1,
    pla_diasHistorial: 8,
    pla_diasTotales: 8,
    pla_bloqueoDias: 5,
    pla_puedeDescargar: false,
    pla_rangoLibre: false,
    pla_puedeGraficar: false,
    pla_divisorEditable: false,
    pla_maxOperacionesDiarias: 1,
  };
}

describe('PlanesStore.planesParaElegir', () => {
  it('EP-5: excluye los gratuitos y agrupa por nombre ordenado por precio', () => {
    const servicio = jasmine.createSpyObj<PlanesService>('PlanesService', [
      'obtenerPlanesDisponibles',
    ]);
    servicio.obtenerPlanesDisponibles.and.returnValue(
      of([
        crearPlan(1, 'Libre', 'Semanal', 0),
        crearPlan(6, 'Elite', 'Mensual', 50),
        crearPlan(5, 'Pro', 'Anual', 200),
        crearPlan(4, 'Pro', 'Mensual', 20),
        crearPlan(7, 'Elite', 'Anual', 480),
      ]),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: PlanesService, useValue: servicio }],
    });
    const store = TestBed.inject(PlanesStore);

    store.cargarPlanes();

    expect(store.planesParaElegir().map((plan) => plan.pin_idPlanInterv)).toEqual([
      4, 5, 6, 7,
    ]);
  });
});
