import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ActivacionCuenta,
  RespuestaActivacion,
  RespuestaReenvioCodigo,
  SolicitudReenvioCodigo,
} from '../modelo/VerificacionCorreo.modelo';

@Injectable({ providedIn: 'root' })
export class VerificacionCorreoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlLoge;

  activarCuenta(datos: ActivacionCuenta): Observable<RespuestaActivacion> {
    return this.http.post<RespuestaActivacion>(
      `${this.apiUrl}persona/activar`,
      datos,
    );
  }

  reenviarCodigo(
    solicitud: SolicitudReenvioCodigo,
  ): Observable<RespuestaReenvioCodigo> {
    return this.http.post<RespuestaReenvioCodigo>(
      `${this.apiUrl}persona/reenviarCodigo`,
      solicitud,
    );
  }
}
