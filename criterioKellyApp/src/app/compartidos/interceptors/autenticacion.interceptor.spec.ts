import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UtilitariosService } from '../servicios/utilitarios.service';
import { SesionStore } from '../store/sesion.store';
import { ES_PLATAFORMA_NATIVA } from '../servicios/plataforma';
import { autenticacionInterceptor } from './autenticacion.interceptor';

describe('autenticacionInterceptor', () => {
  let cliente: HttpClient;
  let controlador: HttpTestingController;
  const accessToken = signal<string | null>('access-inicial');
  const sesionStoreDoble = {
    accessToken,
    renovacionEnCurso: () => null,
    renovarSesion: () => of('access-renovado'),
    estaAutenticado: () => true,
    limpiarSesionLocal: jasmine.createSpy('limpiarSesionLocal'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([autenticacionInterceptor])),
        provideHttpClientTesting(),
        { provide: SesionStore, useValue: sesionStoreDoble },
        { provide: ES_PLATAFORMA_NATIVA, useValue: false },
        {
          provide: Router,
          useValue: { url: '/inicio', navigateByUrl: jasmine.createSpy() },
        },
        {
          provide: UtilitariosService,
          useValue: { mostrarToast: jasmine.createSpy() },
        },
      ],
    });
    cliente = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
    accessToken.set('access-inicial');
  });

  afterEach(() => controlador.verify());

  it('solo agrega cabeceras a una API y nunca a un tercero', () => {
    cliente.get(`${environment.apiUrlCritKell}cuentas/obtener`).subscribe();
    const api = controlador.expectOne(`${environment.apiUrlCritKell}cuentas/obtener`);
    expect(api.request.headers.get('Authorization')).toBe(
      ['Bearer', 'access-inicial'].join(' '),
    );
    expect(api.request.headers.get('X-Requested-With')).toBe('CriterioKelly');
    expect(api.request.withCredentials).toBeFalse();
    api.flush([]);

    cliente.get('https://tercero.example/recurso').subscribe();
    const tercero = controlador.expectOne('https://tercero.example/recurso');
    expect(tercero.request.headers.has('Authorization')).toBeFalse();
    expect(tercero.request.headers.has('X-Requested-With')).toBeFalse();
    tercero.flush({});
  });

  it('renueva y reintenta una sola vez cuando una petición protegida responde 401', () => {
    cliente.get(`${environment.apiUrlCritKell}cuentas/obtener`).subscribe();
    const primera = controlador.expectOne(`${environment.apiUrlCritKell}cuentas/obtener`);
    primera.flush({}, { status: 401, statusText: 'No autorizado' });

    const reintento = controlador.expectOne(`${environment.apiUrlCritKell}cuentas/obtener`);
    expect(reintento.request.headers.get('Authorization')).toBe(
      ['Bearer', 'access-renovado'].join(' '),
    );
    reintento.flush([]);
  });

  it('no agrega Authorization a autenticar', () => {
    cliente.post(
      `${environment.apiUrlLoge}autenticacion/autenticar`,
      { usuario: 'usuario', clave: 'clave' },
    ).subscribe();
    const solicitud = controlador.expectOne(
      `${environment.apiUrlLoge}autenticacion/autenticar`,
    );
    expect(solicitud.request.headers.has('Authorization')).toBeFalse();
    expect(solicitud.request.headers.get('X-Requested-With')).toBe('CriterioKelly');
    expect(solicitud.request.withCredentials).toBeTrue();
    solicitud.flush({});
  });

  it('AJ-2: un 400 por clave actual incorrecta no renueva ni reintenta', () => {
    const renovar = spyOn(sesionStoreDoble, 'renovarSesion').and.callThrough();
    const estadosRecibidos: number[] = [];

    cliente
      .put(`${environment.apiUrlLoge}autenticacion/actualizarClave`, {
        claveActual: 'incorrecta',
        claveNueva: 'NuevaClaveSegura1',
      })
      .subscribe({
        error: (error: { status: number }) => estadosRecibidos.push(error.status),
      });
    const solicitud = controlador.expectOne(
      `${environment.apiUrlLoge}autenticacion/actualizarClave`,
    );
    solicitud.flush(
      { error: 'La clave actual no es correcta' },
      { status: 400, statusText: 'Solicitud incorrecta' },
    );

    controlador.verify();
    expect(renovar).not.toHaveBeenCalled();
    expect(estadosRecibidos).toEqual([400]);
  });
});
