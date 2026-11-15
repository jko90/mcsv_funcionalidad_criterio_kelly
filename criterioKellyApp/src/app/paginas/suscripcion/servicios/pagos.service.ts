import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UltimoPagoRespuesta } from '../modelos/EstadoPago.modelo';

@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly apiUrl = environment.apiUrlSuscripcion;
  private readonly http = inject(HttpClient);

  obtenerMiUltimoPago(): Observable<UltimoPagoRespuesta> {
    return this.http.get<UltimoPagoRespuesta>(`${this.apiUrl}pagos/miUltimoPago`);
  }
}
