import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { PerfilService } from '../servicios/perfil.service';
import {
  ActualizarPerfilRequest,
  ActualizarPerfilResponse,
  CambiarClaveRequest,
  CambiarClaveResponse,
} from '../modelos/Perfil.modelo';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';

type PerfilStoreState = {
  loadingPerfil: boolean;
  loadingClave: boolean;
  errorPerfil: string | null;
  errorClave: string | null;
  respuestaPerfil: ActualizarPerfilResponse | null;
  respuestaClave: CambiarClaveResponse | null;
};

const initialState: PerfilStoreState = {
  loadingPerfil: false,
  loadingClave: false,
  errorPerfil: null,
  errorClave: null,
  respuestaPerfil: null,
  respuestaClave: null,
};

export const PerfilStore = signalStore(
  { providedIn: 'root' },
  withState<PerfilStoreState>(initialState),
  withComputed(({ loadingPerfil, loadingClave, errorPerfil, errorClave }) => ({
    cargandoActualizacion: computed(() => loadingPerfil()),
    cargandoCambioContrasena: computed(() => loadingClave()),
    errorActualizacion: computed(() => errorPerfil()),
    errorCambioClave: computed(() => errorClave()),
  })),
  withMethods((store, perfilService = inject(PerfilService)) => ({
    actualizarPerfil: rxMethod<ActualizarPerfilRequest>(
      pipe(
        tap(() =>
          patchState(store, {
            loadingPerfil: true,
            errorPerfil: null,
            respuestaPerfil: null,
          }),
        ),
        switchMap((request: ActualizarPerfilRequest) =>
          perfilService.actualizarPerfil(request).pipe(
            tap((resp: ActualizarPerfilResponse) => {
              patchState(store, { respuestaPerfil: resp, errorPerfil: null });
            }),
            catchError((err) => {
              patchState(store, {
                errorPerfil:
                  (err as Error)?.message || 'Error al actualizar perfil',
                respuestaPerfil: null,
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loadingPerfil: false })),
          ),
        ),
      ),
    ),
    cambiarClave: rxMethod<CambiarClaveRequest>(
      pipe(
        tap(() =>
          patchState(store, {
            loadingClave: true,
            errorClave: null,
            respuestaClave: null,
          }),
        ),
        switchMap((request: CambiarClaveRequest) =>
          perfilService.cambiarClave(request).pipe(
            tap((resp: CambiarClaveResponse) => {
              patchState(store, { respuestaClave: resp, errorClave: null });
            }),
            catchError((err) => {
              patchState(store, {
                errorClave:
                  (err as Error)?.message || 'Error al cambiar contraseña',
                respuestaClave: null,
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loadingClave: false })),
          ),
        ),
      ),
    ),
    limpiarPerfil: () => patchState(store, { ...initialState }),
    limpiarErrorPerfil: () => patchState(store, { errorPerfil: null }),
    limpiarErrorClave: () => patchState(store, { errorClave: null }),
  })),
);
