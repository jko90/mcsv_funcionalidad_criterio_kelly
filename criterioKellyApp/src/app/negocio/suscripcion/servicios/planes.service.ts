import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PlanesModelo } from '../modelos/Planes.modelo';

@Injectable({ providedIn: 'root' })
export class PlanesService {
  private readonly apiUrl = environment.apiUrlSuscripcion;
  private readonly http = inject(HttpClient);

  obtenerPlanesDisponibles(): Observable<PlanesModelo[]> {
    return this.http.get<PlanesModelo[]>(
      `${this.apiUrl}planes/disponible`,
    );
  }

  obtenerPlanesSuscritos(): Observable<PlanesModelo[]> {
    return this.http.get<PlanesModelo[]>(`${this.apiUrl}planes/suscritos`);
  }
}
