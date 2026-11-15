import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ActualizarPerfilRequest,
  ActualizarPerfilResponse,
  CambiarClaveRequest,
  CambiarClaveResponse,
} from '../modelos/Perfil.modelo';

@Injectable({
  providedIn: 'root',
})
export class PerfilService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlLoge;

  actualizarPerfil(
    request: ActualizarPerfilRequest,
  ): Observable<ActualizarPerfilResponse> {
    return this.http.put<ActualizarPerfilResponse>(
      `${this.apiUrl}persona/actualizarDeApp`,
      request,
    );
  }

  cambiarClave(request: CambiarClaveRequest): Observable<CambiarClaveResponse> {
    return this.http.put<CambiarClaveResponse>(
      `${this.apiUrl}autenticacion/actualizarClave`,
      request,
    );
  }
}
