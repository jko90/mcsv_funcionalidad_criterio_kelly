import { TestBed } from '@angular/core/testing';
import {
  CLAVE_PLAN_AVISADO,
  PlanAvisadoService,
} from './plan-avisado.service';

describe('PlanAvisadoService', () => {
  let servicio: PlanAvisadoService;

  beforeEach(() => {
    localStorage.removeItem(CLAVE_PLAN_AVISADO);
    servicio = TestBed.inject(PlanAvisadoService);
  });

  afterEach(() => {
    localStorage.removeItem(CLAVE_PLAN_AVISADO);
  });

  it('PA-1: sin marca devuelve null', () => {
    expect(servicio.obtener(1)).toBeNull();
  });

  it('PA-2: la marca de otro usuario no se devuelve', () => {
    servicio.guardar(2, 'LIBRE', 9);
    expect(servicio.obtener(1)).toBeNull();
  });

  it('PA-3: un JSON corrupto o inválido devuelve null', () => {
    localStorage.setItem(CLAVE_PLAN_AVISADO, '{no es json');
    expect(servicio.obtener(1)).toBeNull();
    localStorage.setItem(
      CLAVE_PLAN_AVISADO,
      JSON.stringify({ usuarioId: 1, estado: 'OTRO', idSuscripcion: 1 }),
    );
    expect(servicio.obtener(1)).toBeNull();
  });

  it('PA-4: con el almacenamiento bloqueado no lanza errores', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('bloqueado');
    spyOn(Storage.prototype, 'setItem').and.throwError('bloqueado');
    const espiaBorrar = spyOn(Storage.prototype, 'removeItem').and.throwError('bloqueado');

    expect(servicio.obtener(1)).toBeNull();
    expect(() => servicio.guardar(1, 'PAGO', 3)).not.toThrow();
    expect(() => servicio.borrar()).not.toThrow();
    espiaBorrar.and.callThrough(); // el afterEach limpia el almacenamiento
  });

  it('PA-5: guarda y recupera usuario, estado e id de suscripción', () => {
    servicio.guardar(1, 'PAGO', null);
    expect(servicio.obtener(1)).toEqual({
      usuarioId: 1,
      estado: 'PAGO',
      idSuscripcion: null,
    });
    servicio.borrar();
    expect(servicio.obtener(1)).toBeNull();
  });
});
