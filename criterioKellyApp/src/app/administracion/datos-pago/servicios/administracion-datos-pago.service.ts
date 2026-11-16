import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  CambioEstadoMetodo,
  CuerpoGuardarBanco,
  CuerpoGuardarPaypal,
  CuerpoGuardarRed,
  DatosPagoAdministracion,
  RespuestaGuardarRed,
  SubidaQr,
} from '../modelos/DatosPagoAdmin.modelo';

interface RespuestaExito {
  success: string;
}

@Injectable({ providedIn: 'root' })
export class AdministracionDatosPagoService {
  private readonly apiUrl = `${environment.apiUrlSuscripcion}datosPago/`;
  private readonly http = inject(HttpClient);

  obtenerAdministracion(): Observable<DatosPagoAdministracion> {
    return this.http.get<DatosPagoAdministracion>(`${this.apiUrl}administracion`);
  }

  guardarRed(cuerpo: CuerpoGuardarRed): Observable<RespuestaGuardarRed> {
    return this.http.post<RespuestaGuardarRed>(`${this.apiUrl}guardarRed`, cuerpo);
  }

  cambiarEstadoRed(idRed: number, activo: boolean): Observable<RespuestaExito> {
    return this.http.post<RespuestaExito>(`${this.apiUrl}cambiarEstadoRed`, {
      red_idRed: idRed,
      red_activo: activo ? 1 : 0,
    });
  }

  eliminarRed(idRed: number): Observable<RespuestaExito> {
    return this.http.post<RespuestaExito>(`${this.apiUrl}eliminarRed`, { red_idRed: idRed });
  }

  guardarPaypal(cuerpo: CuerpoGuardarPaypal): Observable<RespuestaExito> {
    return this.http.post<RespuestaExito>(`${this.apiUrl}guardarPaypal`, cuerpo);
  }

  guardarBanco(cuerpo: CuerpoGuardarBanco): Observable<RespuestaExito> {
    return this.http.post<RespuestaExito>(`${this.apiUrl}guardarBanco`, cuerpo);
  }

  cambiarEstadoMetodo(cambio: CambioEstadoMetodo): Observable<RespuestaExito> {
    return this.http.post<RespuestaExito>(`${this.apiUrl}cambiarEstadoMetodo`, {
      mep_codigo: cambio.codigo,
      mep_activo: cambio.activo ? 1 : 0,
      mep_orden: cambio.orden,
    });
  }

  subirQr(subida: SubidaQr): Observable<RespuestaExito & { qrHash: string }> {
    return this.http.post<RespuestaExito & { qrHash: string }>(`${this.apiUrl}subirQr`, {
      red_idRed: subida.idRed,
      imagen: subida.imagen,
    });
  }

  quitarQr(idRed: number): Observable<RespuestaExito> {
    return this.http.post<RespuestaExito>(`${this.apiUrl}quitarQr`, { red_idRed: idRed });
  }
}
