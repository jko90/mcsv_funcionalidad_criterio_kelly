import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { PagosService } from './pagos.service';

describe('PagosService', () => {
  it('obtenerMiUltimoPago hace GET a pagos/miUltimoPago', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    let respuesta: unknown;
    TestBed.inject(PagosService)
      .obtenerMiUltimoPago()
      .subscribe((resultado) => (respuesta = resultado));

    const peticion = http.expectOne(`${environment.apiUrlSuscripcion}pagos/miUltimoPago`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ pago: null });
    expect(respuesta).toEqual({ pago: null });
    http.verify();
  });
});
