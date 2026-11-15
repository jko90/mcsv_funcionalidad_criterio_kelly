import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { AdministracionPagosService } from './administracion-pagos.service';

const BASE = environment.apiUrlSuscripcion;

describe('AdministracionPagosService', () => {
  let servicio: AdministracionPagosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(AdministracionPagosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerPendientes envía limite y omite desde cuando no se indica', () => {
    servicio.obtenerPendientes(20).subscribe();
    const peticion = http.expectOne((p) => p.url === `${BASE}pagos/pendientes`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('limite')).toBe('20');
    expect(peticion.request.params.has('desde')).toBeFalse();
    peticion.flush([]);
  });

  it('obtenerPendientes envía desde cuando se indica', () => {
    servicio.obtenerPendientes(20, 55).subscribe();
    const peticion = http.expectOne((p) => p.url === `${BASE}pagos/pendientes`);
    expect(peticion.request.params.get('desde')).toBe('55');
    peticion.flush([]);
  });

  it('obtenerComprobante hace GET con pag_idPago', () => {
    servicio.obtenerComprobante(9).subscribe();
    const peticion = http.expectOne((p) => p.url === `${BASE}pagos/comprobante`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('pag_idPago')).toBe('9');
    peticion.flush({ pag_idPago: 9, comprobante: 'data:image/png;base64,AAAA' });
  });

  it('confirmar hace POST con pag_idPago', () => {
    servicio.confirmar(9).subscribe();
    const peticion = http.expectOne(`${BASE}pagos/confirmar`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ pag_idPago: 9 });
    peticion.flush({});
  });

  it('rechazar hace POST con pag_idPago y motivo', () => {
    servicio.rechazar(9, 'Ilegible').subscribe();
    const peticion = http.expectOne(`${BASE}pagos/rechazar`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ pag_idPago: 9, motivo: 'Ilegible' });
    peticion.flush({ pag_idPago: 9, pag_situacion: 'F' });
  });
});
