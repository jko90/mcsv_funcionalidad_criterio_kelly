import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { OMITIR_MANEJO_ERROR } from 'src/app/nucleo/seguridad/interceptores/sesion-http';
import { SuscripcionService } from './suscripcion.service';

describe('SuscripcionService · plan vigente', () => {
  let servicio: SuscripcionService;
  let http: HttpTestingController;
  const base = environment.apiUrlSuscripcion;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(SuscripcionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerPlanVigente hace GET y omite el manejo de error', () => {
    servicio.obtenerPlanVigente().subscribe();
    const peticion = http.expectOne(`${base}suscripcion/planVigente`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.context.get(OMITIR_MANEJO_ERROR)).toBeTrue();
    peticion.flush({});
  });

  it('iniciarPrueba hace POST con cuerpo vacío y omite el manejo de error', () => {
    servicio.iniciarPrueba().subscribe();
    const peticion = http.expectOne(`${base}suscripcion/iniciarPrueba`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({});
    expect(peticion.request.context.get(OMITIR_MANEJO_ERROR)).toBeTrue();
    peticion.flush({});
  });

  it('cancelarPlan hace POST con cuerpo vacío y deja actuar al interceptor de errores', () => {
    servicio.cancelarPlan().subscribe();
    const peticion = http.expectOne(`${base}suscripcion/cancelar`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({});
    expect(peticion.request.context.get(OMITIR_MANEJO_ERROR)).toBeFalse();
    peticion.flush({});
  });
});
