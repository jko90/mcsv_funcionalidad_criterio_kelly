import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OMITIR_MANEJO_ERROR } from 'src/app/compartidos/interceptors/sesion-http';
import { environment } from 'src/environments/environment';
import { DatosPagoDisponibles } from '../modelos/DatosPago.modelo';

@Injectable({ providedIn: 'root' })
export class DatosPagoService {
  private readonly apiUrl = environment.apiUrlSuscripcion;
  private readonly http = inject(HttpClient);

  obtenerDisponibles(): Observable<DatosPagoDisponibles> {
    return this.http.get<DatosPagoDisponibles>(`${this.apiUrl}datosPago/disponibles`);
  }

  // Una imagen no envía Authorization: se pide como blob con el token del interceptor.
  // Un fallo del QR no debe alarmar con un aviso: la dirección sigue siendo utilizable.
  obtenerQr(clave: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}datosPago/qr`, {
      params: new HttpParams().set('clave', clave),
      responseType: 'blob',
      context: new HttpContext().set(OMITIR_MANEJO_ERROR, true),
    });
  }
}
