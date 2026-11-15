import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ComentarioModelo } from '../modelos/Comentario.modelo';
import { Observable } from 'rxjs';
import { ActualizarTPSLBEComentarios } from '../modelos/Bitacora.modelo';

@Injectable({ providedIn: 'root' })
export class ComentariosService {
  private readonly apiUrl = environment.apiUrlCritKell;
  private readonly http = inject(HttpClient);

  guardarObservacionesPorBitacora(
    objDatos: ComentarioModelo[],
  ): Observable<ComentarioModelo[]> {
    return this.http.post<ComentarioModelo[]>(
      `${this.apiUrl}comentarios/crearComentario`,
      objDatos,
    );
  }

  obtenerObservacionesPorBitacora(
    idBitacora: number,
  ): Observable<ComentarioModelo[]> {
    return this.http.get<ComentarioModelo[]>(
      `${this.apiUrl}comentarios/observaciones?id=${idBitacora}`,
    );
  }

  actualizaBitacoraComentario(
    request: ActualizarTPSLBEComentarios,
  ): Observable<ActualizarTPSLBEComentarios> {
    return this.http.put<ActualizarTPSLBEComentarios>(
      `${this.apiUrl}comentarios/comentarioBitacora`,
      request,
    );
  }
}
