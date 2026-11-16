import { TestBed } from '@angular/core/testing';
import {
  CLAVE_PLAN_RESERVADO,
  CLAVE_SUSCRIPCION_VERIFICADA,
  PlanReservadoService,
} from './plan-reservado.service';

describe('PlanReservadoService', () => {
  let servicio: PlanReservadoService;

  beforeEach(() => {
    localStorage.removeItem(CLAVE_PLAN_RESERVADO);
    localStorage.removeItem(CLAVE_SUSCRIPCION_VERIFICADA);
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(PlanReservadoService);
  });

  afterEach(() => {
    localStorage.removeItem(CLAVE_PLAN_RESERVADO);
    localStorage.removeItem(CLAVE_SUSCRIPCION_VERIFICADA);
  });

  it('PR-1: reserva normalizada y recuperable', () => {
    servicio.reservar('Juan_Perez ', 5);
    expect(servicio.obtener('juan_perez')).toBe(5);
    expect(localStorage.getItem(CLAVE_PLAN_RESERVADO)).toBe(
      '{"usuario":"juan_perez","pin_idPlanInterv":5}',
    );
  });

  it('PR-2: otro usuario no la obtiene ni la borra', () => {
    servicio.reservar('juan_perez', 5);
    expect(servicio.obtener('otro')).toBeNull();
    servicio.borrar('otro');
    expect(servicio.obtener('juan_perez')).toBe(5);
  });

  it('PR-3: valores inválidos se ignoran', () => {
    const invalidos = [
      'basura',
      '{"usuario":"x","pin_idPlanInterv":-1}',
      '{"usuario":"x","pin_idPlanInterv":"5"}',
      '{"usuario":1,"pin_idPlanInterv":5}',
    ];
    for (const valor of invalidos) {
      localStorage.setItem(CLAVE_PLAN_RESERVADO, valor);
      expect(servicio.obtener('x')).toBeNull();
    }
    localStorage.removeItem(CLAVE_PLAN_RESERVADO);
    servicio.reservar('x', 0);
    servicio.reservar('', 3);
    expect(localStorage.getItem(CLAVE_PLAN_RESERVADO)).toBeNull();
  });

  it('PR-4: borrar elimina la reserva propia', () => {
    servicio.reservar('juan_perez', 5);
    servicio.borrar('juan_perez');
    expect(localStorage.getItem(CLAVE_PLAN_RESERVADO)).toBeNull();
  });

  it('PR-5: la marca no se duplica y conserva los 20 más recientes', () => {
    servicio.marcarVerificada(7);
    servicio.marcarVerificada(7);
    expect(servicio.estaVerificada(7)).toBeTrue();
    expect(
      JSON.parse(localStorage.getItem(CLAVE_SUSCRIPCION_VERIFICADA)!),
    ).toEqual([7]);

    for (let id = 100; id < 121; id++) servicio.marcarVerificada(id);
    const guardados: number[] = JSON.parse(
      localStorage.getItem(CLAVE_SUSCRIPCION_VERIFICADA)!,
    );
    expect(guardados.length).toBe(20);
    expect(guardados).not.toContain(7);
    expect(guardados).not.toContain(100);
  });

  it('PR-6: un localStorage que falla no lanza excepciones', () => {
    spyOn(localStorage, 'getItem').and.throwError('x');
    spyOn(localStorage, 'setItem').and.throwError('x');
    expect(servicio.obtener('x')).toBeNull();
    expect(servicio.estaVerificada(1)).toBeFalse();
    expect(() => servicio.reservar('x', 2)).not.toThrow();
    expect(() => servicio.marcarVerificada(1)).not.toThrow();
  });
});
