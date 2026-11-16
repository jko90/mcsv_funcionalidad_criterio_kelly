export interface ComentarioModelo {
  obs_idObserva?: number;
  obs_bitIdbitaco: number;
  obs_comentario: string;
  obs_tipoObserva?: string;
  obs_imagen?: string | ArrayBuffer | null;
  obs_fecha?: string;
}