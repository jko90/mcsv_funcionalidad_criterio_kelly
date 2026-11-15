import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import {
  ActualizarBitacoraFinalModelo,
  BitacoraModelo,
  RegistroBitacoraModelo,
} from '../modelos/Bitacora.modelo';
import { Observable } from 'rxjs';
import { cuentasRespuetaExitosa } from '../../configuracion/modelos/Cuentas.modelo';

export interface FiltroBitacora {
  bit_cueIdCuentas: number;
}

@Injectable({ providedIn: 'root' })
export class BitacoraService {
  private readonly apiUrl = environment.apiUrlCritKell;
  private readonly http = inject(HttpClient);

  obtenerListaBitacora(objDatos: FiltroBitacora): Observable<BitacoraModelo[]> {
    return this.http.post<BitacoraModelo[]>(
      `${this.apiUrl}bitacora/listBitacora`,
      objDatos,
    );
  }

  guardarBitacora(
    objDatos: RegistroBitacoraModelo,
  ): Observable<BitacoraModelo> {
    return this.http.post<BitacoraModelo>(
      `${this.apiUrl}bitacora/crear`,
      objDatos,
    );
  }

  eliminarBitacora(idBitacora: number): Observable<cuentasRespuetaExitosa> {
    return this.http.delete<cuentasRespuetaExitosa>(
      `${this.apiUrl}bitacora/eliminarBitacora?id=${idBitacora}`,
    );
  }

  finalizaOperacionBitacora(
    objActBitacora: ActualizarBitacoraFinalModelo,
  ): Observable<ActualizarBitacoraFinalModelo> {
    return this.http.put<ActualizarBitacoraFinalModelo>(
      `${this.apiUrl}bitacora/finalizaBitacora`,
      objActBitacora,
    );
  }
}
