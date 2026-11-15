import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OMITIR_MANEJO_ERROR } from 'src/app/compartidos/interceptors/sesion-http';
import { environment } from 'src/environments/environment';
import { DatosPagoService } from './datos-pago.service';

const BASE = `${environment.apiUrlSuscripcion}datosPago/`;

describe('DatosPagoService', () => {
  let servicio: DatosPagoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(DatosPagoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerDisponibles hace GET a datosPago/disponibles', () => {
    servicio.obtenerDisponibles().subscribe();
    const peticion = http.expectOne(`${BASE}disponibles`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ cripto: null, paypal: null, banco: null });
  });

  it('obtenerQr pide la imagen como blob con la clave y sin aviso de error', () => {
    servicio.obtenerQr('TRON').subscribe();
    const peticion = http.expectOne((p) => p.url === `${BASE}qr`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('clave')).toBe('TRON');
    expect(peticion.request.responseType).toBe('blob');
    expect(peticion.request.context.get(OMITIR_MANEJO_ERROR)).toBeTrue();
    peticion.flush(new Blob());
  });
});
