import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CredencialesSesion,
  RespuestaExitosa,
  RespuestaSesion,
  SolicitudRenovacion,
} from '../modelos/sesion.modelo';
import {
  OMITIR_MANEJO_ERROR,
  URL_AUTENTICAR,
  URL_CERRAR_SESION,
  URL_CERRAR_TODAS,
  URL_RENOVAR,
} from '../interceptors/sesion-http';

@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);

  autenticar(credenciales: CredencialesSesion): Observable<RespuestaSesion> {
    return this.http.post<RespuestaSesion>(URL_AUTENTICAR, credenciales);
  }

  renovar(solicitud: SolicitudRenovacion): Observable<RespuestaSesion> {
    return this.http.post<RespuestaSesion>(URL_RENOVAR, solicitud, {
      context: new HttpContext().set(OMITIR_MANEJO_ERROR, true),
    });
  }

  cerrarSesion(): Observable<RespuestaExitosa> {
    return this.http.post<RespuestaExitosa>(
      URL_CERRAR_SESION,
      {},
      {
        context: new HttpContext().set(OMITIR_MANEJO_ERROR, true),
      },
    );
  }

  cerrarTodas(): Observable<RespuestaExitosa> {
    return this.http.post<RespuestaExitosa>(
      URL_CERRAR_TODAS,
      {},
    );
  }
}
