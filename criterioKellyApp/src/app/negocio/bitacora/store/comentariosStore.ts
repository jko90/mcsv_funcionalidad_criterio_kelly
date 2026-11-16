import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { ComentariosService } from '../servicios/comentarios.service';
import { ComentarioModelo } from '../modelos/Comentario.modelo';
import { ActualizarTPSLBEComentarios } from '../modelos/Bitacora.modelo';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';

type ComentariosStoreState = {
  loading: boolean;
  error: string | null;
  comentarios: ComentarioModelo[];
  ultimaActualizacion: ActualizarTPSLBEComentarios | null;
  comentariosGuardados: ComentarioModelo[] | null;
};

const initialState: ComentariosStoreState = {
  loading: false,
  error: null,
  comentarios: [],
  ultimaActualizacion: null,
  comentariosGuardados: null,
};

export const ComentariosStore = signalStore(
  { providedIn: 'root' },
  withState<ComentariosStoreState>(initialState),
  withComputed(({ loading, error, comentarios }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
    listaComentarios: computed(() => comentarios()),
  })),
  withMethods((store, comentariosService = inject(ComentariosService)) => ({
    cargarComentarios: rxMethod<number>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((idBitacora: number) =>
          comentariosService.obtenerObservacionesPorBitacora(idBitacora).pipe(
            tap((comentarios: ComentarioModelo[]) => {
              patchState(store, { comentarios, error: null });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al cargar comentarios',
                comentarios: [],
              });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    guardarComentarios: rxMethod<ComentarioModelo[]>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((comentarios: ComentarioModelo[]) =>
          comentariosService.guardarObservacionesPorBitacora(comentarios).pipe(
            tap((guardados: ComentarioModelo[]) => {
              patchState(store, {
                comentariosGuardados: guardados,
                error: null,
              });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al guardar comentarios',
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    actualizarComentarioBitacora: rxMethod<ActualizarTPSLBEComentarios>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((req: ActualizarTPSLBEComentarios) =>
          comentariosService.actualizaBitacoraComentario(req).pipe(
            tap((actualizado: ActualizarTPSLBEComentarios) => {
              patchState(store, {
                ultimaActualizacion: actualizado,
                error: null,
              });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al actualizar comentario',
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
  })),
);
