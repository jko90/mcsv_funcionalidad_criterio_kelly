import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { OMITIR_MANEJO_ERROR } from 'src/app/compartidos/interceptors/sesion-http';
import { SolicitudCrearConPago } from '../modelos/EstadoPago.modelo';
import { PlanVigente } from '../modelos/PlanVigente.modelo';
import {
  CrearSuscripcionInicialRequest,
  SuscripcionModelo,
} from '../modelos/Suscripcion.modelo';

@Injectable({ providedIn: 'root' })
export class SuscripcionService {
  private readonly apiUrl = environment.apiUrlSuscripcion;
  private readonly http = inject(HttpClient);

  obtenerSuscripcionPorId(
    idSuscripcion: number,
  ): Observable<SuscripcionModelo> {
    return this.http.get<SuscripcionModelo>(
      `${this.apiUrl}suscripcion/suscripcionPorID/${idSuscripcion}`,
    );
  }

  obtenerSuscripcionPorUsuario(): Observable<SuscripcionModelo[]> {
    return this.http.get<SuscripcionModelo[]>(
      `${this.apiUrl}suscripcion/porUsuario`,
    );
  }

  crearSuscripcionInicial(
    solicitud: CrearSuscripcionInicialRequest,
  ): Observable<SuscripcionModelo> {
    return this.http.post<SuscripcionModelo>(
      `${this.apiUrl}suscripcion/crearSinPago`,
      solicitud,
      { context: new HttpContext().set(OMITIR_MANEJO_ERROR, true) },
    );
  }

  obtenerPlanVigente(): Observable<PlanVigente> {
    return this.http.get<PlanVigente>(`${this.apiUrl}suscripcion/planVigente`, {
      context: new HttpContext().set(OMITIR_MANEJO_ERROR, true),
    });
  }

  iniciarPrueba(): Observable<PlanVigente> {
    return this.http.post<PlanVigente>(
      `${this.apiUrl}suscripcion/iniciarPrueba`,
      {},
      { context: new HttpContext().set(OMITIR_MANEJO_ERROR, true) },
    );
  }

  // Sin OMITIR_MANEJO_ERROR: el interceptor muestra el mensaje del servidor.
  cancelarPlan(): Observable<PlanVigente> {
    return this.http.post<PlanVigente>(`${this.apiUrl}suscripcion/cancelar`, {});
  }

  crearSuscripcionConPago(
    suscripcion: SolicitudCrearConPago,
  ): Observable<SuscripcionModelo> {
    return this.http.post<SuscripcionModelo>(
      `${this.apiUrl}suscripcion/crearConPago`,
      suscripcion,
    );
  }
}
