import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ComprobantePago,
  ConfirmacionPago,
  PagoPendiente,
  RechazoPago,
} from '../modelos/PagoPendiente.modelo';

@Injectable({ providedIn: 'root' })
export class AdministracionPagosService {
  private readonly apiUrl = environment.apiUrlSuscripcion;
  private readonly http = inject(HttpClient);

  obtenerPendientes(limite: number, desde?: number): Observable<PagoPendiente[]> {
    let parametros = new HttpParams().set('limite', limite);
    if (desde !== undefined) parametros = parametros.set('desde', desde);
    return this.http.get<PagoPendiente[]>(`${this.apiUrl}pagos/pendientes`, {
      params: parametros,
    });
  }

  obtenerComprobante(idPago: number): Observable<ComprobantePago> {
    return this.http.get<ComprobantePago>(`${this.apiUrl}pagos/comprobante`, {
      params: new HttpParams().set('pag_idPago', idPago),
    });
  }

  confirmar(idPago: number): Observable<ConfirmacionPago> {
    return this.http.post<ConfirmacionPago>(`${this.apiUrl}pagos/confirmar`, {
      pag_idPago: idPago,
    });
  }

  rechazar(idPago: number, motivo: string): Observable<RechazoPago> {
    return this.http.post<RechazoPago>(`${this.apiUrl}pagos/rechazar`, {
      pag_idPago: idPago,
      motivo,
    });
  }
}
