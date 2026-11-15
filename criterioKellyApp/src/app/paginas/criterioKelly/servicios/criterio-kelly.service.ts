import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CriterioKellyModelo } from '../modelos/CriterioKelly.modelo';

@Injectable({ providedIn: 'root' })
export class CriterioKellyService {
  private readonly apiUrl = environment.apiUrlCritKell;
  private readonly http = inject(HttpClient);

  obtenerListaCriterioKelly(): Observable<CriterioKellyModelo[]> {
    return this.http.post<CriterioKellyModelo[]>(
      `${this.apiUrl}criterioKelly/obtenerPorcentaje`,
      {},
    );
  }
}
