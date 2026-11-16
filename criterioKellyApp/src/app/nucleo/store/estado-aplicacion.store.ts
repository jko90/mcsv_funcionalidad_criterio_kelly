import { computed, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, filter, from, fromEvent, map, merge, pipe, switchMap, tap, timer } from 'rxjs';

export const INTERVALO_COMPROBACION_ACTUALIZACION_MS = 21_600_000;

type EstadoAplicacionEstado = {
  estaEnLinea: boolean;
  hayVersionNueva: boolean;
  requiereRecarga: boolean;
  loading: boolean;
  error: string | null;
};

export const EstadoAplicacionStore = signalStore(
  { providedIn: 'root' },
  withState<EstadoAplicacionEstado>(() => ({
    estaEnLinea: navigator.onLine,
    hayVersionNueva: false,
    requiereRecarga: false,
    loading: false,
    error: null,
  })),
  withComputed(({ loading, error }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
  })),
  withMethods((store, actualizacionesSw = inject(SwUpdate)) => ({
    monitorearConexion: rxMethod<void>(
      pipe(
        switchMap(() =>
          merge(
            fromEvent(window, 'online').pipe(map(() => true)),
            fromEvent(window, 'offline').pipe(map(() => false)),
          ),
        ),
        tap((estaEnLinea) => patchState(store, { estaEnLinea })),
      ),
    ),
    monitorearActualizaciones: rxMethod<void>(
      pipe(
        switchMap(() => {
          if (!actualizacionesSw.isEnabled) {
            return EMPTY;
          }
          return merge(
            actualizacionesSw.versionUpdates.pipe(
              filter((evento): evento is VersionReadyEvent => evento.type === 'VERSION_READY'),
              tap(() => patchState(store, { hayVersionNueva: true })),
            ),
            actualizacionesSw.unrecoverable.pipe(
              tap(() => patchState(store, { requiereRecarga: true })),
            ),
            timer(0, INTERVALO_COMPROBACION_ACTUALIZACION_MS).pipe(
              switchMap(() => from(actualizacionesSw.checkForUpdate())),
            ),
          ).pipe(
            catchError(() => {
              patchState(store, { error: 'No se pudo comprobar si hay una versión nueva' });
              return EMPTY;
            }),
          );
        }),
      ),
    ),
    marcarVersionAtendida(): void {
      patchState(store, { hayVersionNueva: false });
    },
  })),
);
