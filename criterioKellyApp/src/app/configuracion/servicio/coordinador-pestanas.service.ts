import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ES_PLATAFORMA_NATIVA } from './plataforma';

export const NOMBRE_BLOQUEO_RENOVACION = 'ck-renovar-sesion';
export const NOMBRE_CANAL_SESION = 'ck-sesion';

export type MensajeSesion =
  | {
      tipo: 'sesion-renovada';
      sesion: Omit<
        import('../modelo/sesion.modelo').RespuestaSesion,
        'refreshToken'
      >;
    }
  | { tipo: 'sesion-cerrada' };

@Injectable({ providedIn: 'root' })
export class CoordinadorPestanasService {
  private readonly esNativa = inject(ES_PLATAFORMA_NATIVA);
  private readonly mensajes = new Subject<MensajeSesion>();
  private readonly canal: BroadcastChannel | null =
    this.esNativa || typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(NOMBRE_CANAL_SESION);

  readonly mensajes$: Observable<MensajeSesion> = this.mensajes.asObservable();

  constructor() {
    this.canal?.addEventListener(
      'message',
      (evento: MessageEvent<MensajeSesion>) => this.mensajes.next(evento.data),
    );
  }

  publicar(mensaje: MensajeSesion): void {
    this.canal?.postMessage(mensaje);
  }

  async ejecutarExclusivo<T>(
    nombre: string,
    operacion: () => Promise<T>,
  ): Promise<T> {
    const bloqueos =
      this.esNativa || typeof navigator === 'undefined'
        ? undefined
        : navigator.locks;
    if (typeof bloqueos?.request === 'function') {
      return bloqueos.request(nombre, { mode: 'exclusive' }, operacion);
    }
    return operacion();
  }
}
