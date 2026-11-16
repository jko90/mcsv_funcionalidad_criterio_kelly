import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  BitacoraResultadoAnalisis,
  observacionResultadoAnalisis,
  OperacionCuentaModelo,
} from '../modelos/DetalleOperacion.modelo';

export interface FiltroFechasAnalisis {
  fechaDesde?: string;
  fechaHasta?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ReportesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlCritKell;

  obtenerDetalleOperaciones(): Observable<OperacionCuentaModelo[]> {
    return this.http.post<OperacionCuentaModelo[]>(
      `${this.apiUrl}criterioKelly/detalleOperacion`,
      {},
    );
  }

  obtenerOperacionesParaAnalisis(
    filtroFechas: FiltroFechasAnalisis = {},
  ): Observable<BitacoraResultadoAnalisis[]> {
    return this.http.post<BitacoraResultadoAnalisis[]>(
      `${this.apiUrl}criterioKelly/operacionAnalisis`,
      filtroFechas,
    );
  }

  obtenerObservacionesParaAnalisis(
    filtroFechas: FiltroFechasAnalisis = {},
  ): Observable<observacionResultadoAnalisis[]> {
    return this.http.post<observacionResultadoAnalisis[]>(
      `${this.apiUrl}criterioKelly/observacionAnalisis`,
      filtroFechas,
    );
  }
}
