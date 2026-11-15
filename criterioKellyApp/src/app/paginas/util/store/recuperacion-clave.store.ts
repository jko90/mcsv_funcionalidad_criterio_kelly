import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withState, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, finalize, of, pipe, switchMap, tap } from 'rxjs';
import {
  DatosRestablecimiento,
  PasoRecuperacion,
} from '../modelos/RecuperacionClave.modelo';
import { RecuperacionClaveService } from '../servicios/recuperacion-clave.service';

type RecuperacionClaveEstado = {
  paso: PasoRecuperacion;
  correo: string;
  mensajeSolicitud: string | null;
  loading: boolean;
  error: string | null;
};

const estadoInicial: RecuperacionClaveEstado = {
  paso: 'solicitar',
  correo: '',
  mensajeSolicitud: null,
  loading: false,
  error: null,
};

export const RecuperacionClaveStore = signalStore(
  { providedIn: 'root' },
  withState(estadoInicial),
  withComputed(({ loading, error }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
  })),
  withMethods((store, servicio = inject(RecuperacionClaveService)) => ({
    solicitarCodigo: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((correo) =>
          servicio.solicitarRecuperacion({ correo }).pipe(
            tap((respuesta) =>
              patchState(store, {
                correo,
                mensajeSolicitud: respuesta.mensaje,
                paso: 'restablecer',
              }),
            ),
            catchError((error: unknown) => {
              patchState(store, {
                error:
                  error instanceof Error
                    ? error.message
                    : 'No se pudo enviar la solicitud',
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    restablecerClave: rxMethod<DatosRestablecimiento>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((datos) =>
          servicio
            .restablecerClave({
              correo: store.correo(),
              ...datos,
            })
            .pipe(
              tap(() => patchState(store, { paso: 'completado' })),
              catchError((error: unknown) => {
                patchState(store, {
                  error:
                    error instanceof Error
                      ? error.message
                      : 'No se pudo restablecer la contraseña',
                });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
        ),
      ),
    ),
    volverASolicitar: () =>
      patchState(store, { paso: 'solicitar', error: null }),
    reiniciar: () => patchState(store, estadoInicial),
  })),
);
