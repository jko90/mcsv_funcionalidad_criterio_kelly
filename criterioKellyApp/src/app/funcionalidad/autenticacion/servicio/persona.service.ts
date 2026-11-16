import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  DatosPersona,
  RespuestaRegistro,
} from '../../../funcionalidad/autenticacion/modelo/Persona.modelo';

@Injectable({
  providedIn: 'root',
})
export class PersonaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrlLoge;

  registrarPersona(datosPersona: DatosPersona): Observable<RespuestaRegistro> {
    return this.http.post<RespuestaRegistro>(
      `${this.apiUrl}persona/agregar`,
      datosPersona,
    );
  }
}
