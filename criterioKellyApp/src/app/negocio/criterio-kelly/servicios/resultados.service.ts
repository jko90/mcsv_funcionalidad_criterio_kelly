import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ResultadosModelo } from '../modelos/Resultados.modelo';

@Injectable({ providedIn: 'root' })
export class ResultadosService {
  private readonly apiUrl = environment.apiUrlCritKell;
  private readonly http = inject(HttpClient);

  obtenerListaResultados(): Observable<ResultadosModelo[]> {
    return this.http.post<ResultadosModelo[]>(
      `${this.apiUrl}criterioKelly/obtenerResultados`,
      {},
    );
  }
}
