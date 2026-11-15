import { HttpErrorResponse, HttpHeaders, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { UtilitariosService } from '../../servicios/utilitarios.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  it('no muestra toast para un 401 con Authorization', () => {
    const mostrarToast = jasmine.createSpy('mostrarToast');
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UtilitariosService,
          useValue: { mostrarToast },
        },
      ],
    });
    const solicitud = new HttpRequest('GET', 'http://localhost/api', {
      headers: new HttpHeaders({ Authorization: 'Bearer token' }),
    });
    const error = new HttpErrorResponse({ status: 401, url: solicitud.url });

    TestBed.runInInjectionContext(() =>
      errorInterceptor(solicitud, () => throwError(() => error)).subscribe({
        error: (resultado: HttpErrorResponse) => expect(resultado.status).toBe(401),
      }),
    );

    expect(mostrarToast).not.toHaveBeenCalled();
  });
});
