import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  CuentaResponse,
  ActualizarNombreCuenta,
  EliminarCuenta,
  cuentasRespuetaExitosa,
  CrearCuenta,
} from '../modelos/Cuentas.modelo';
import { CapitalModelo } from '../modelos/Capital.modelo';

@Injectable({
  providedIn: 'root',
})
export class CuentasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlCritKell;

  crearNuevaCuenta(objCuenta: CrearCuenta): Observable<CrearCuenta> {
    return this.http.post<CrearCuenta>(
      `${this.apiUrl}cuentas/nueva`,
      objCuenta,
    );
  }

  obtenerCuentas(): Observable<CuentaResponse[]> {
    return this.http.get<CuentaResponse[]>(`${this.apiUrl}cuentas/obtener`);
  }

  agregarCapital(objCapital: CapitalModelo): Observable<CapitalModelo> {
    return this.http.post<CapitalModelo>(
      `${this.apiUrl}cuentas/movCapital`,
      objCapital,
    );
  }

  actualizarNombreCuenta(
    objNombreC: ActualizarNombreCuenta,
  ): Observable<ActualizarNombreCuenta> {
    return this.http.put<ActualizarNombreCuenta>(
      `${this.apiUrl}cuentas/nombre`,
      objNombreC,
    );
  }

  eliminarCuenta(
    objElimimarC: EliminarCuenta,
  ): Observable<cuentasRespuetaExitosa> {
    return this.http.delete<cuentasRespuetaExitosa>(
      `${this.apiUrl}cuentas/eliminar`,
      { body: objElimimarC },
    );
  }
}
