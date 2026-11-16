import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  RespuestaSolicitudRecuperacion,
  RespuestaRestablecimiento,
  RestablecimientoClave,
  SolicitudRecuperacion,
} from '../modelo/RecuperacionClave.modelo';

@Injectable({ providedIn: 'root' })
export class RecuperacionClaveService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlLoge;

  solicitarRecuperacion(
    solicitud: SolicitudRecuperacion,
  ): Observable<RespuestaSolicitudRecuperacion> {
    return this.http.post<RespuestaSolicitudRecuperacion>(
      `${this.apiUrl}autenticacion/solicitarRecuperacion`,
      solicitud,
    );
  }

  restablecerClave(
    solicitud: RestablecimientoClave,
  ): Observable<RespuestaRestablecimiento> {
    return this.http.post<RespuestaRestablecimiento>(
      `${this.apiUrl}autenticacion/restablecerClave`,
      solicitud,
    );
  }
}
