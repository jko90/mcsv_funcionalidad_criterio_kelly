import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { PersonaService } from '../servicios/persona.service';
import { DatosPersona, RespuestaRegistro } from '../modelos/Persona.modelo';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';

type PersonaStoreState = {
  loading: boolean;
  error: string | null;
  respuesta: RespuestaRegistro | null;
};

const initialState: PersonaStoreState = {
  loading: false,
  error: null,
  respuesta: null,
};

export const PersonaStore = signalStore(
  { providedIn: 'root' },
  withState<PersonaStoreState>(initialState),
  withComputed(({ loading, error, respuesta }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
    respuestaRegistro: computed(() => respuesta()),
    registroExitoso: computed(() => {
      const mensaje = respuesta()?.mensaje;
      return typeof mensaje === 'string' && mensaje.length > 0;
    }),
  })),
  withMethods((store, personaService = inject(PersonaService)) => ({
    registrarPersona: rxMethod<DatosPersona>(
      pipe(
        tap(() =>
          patchState(store, { loading: true, error: null, respuesta: null }),
        ),
        switchMap((datos: DatosPersona) =>
          personaService.registrarPersona(datos).pipe(
            tap((respuesta: RespuestaRegistro) => {
              patchState(store, { respuesta, error: null });
            }),
            catchError((err: unknown) => {
              patchState(store, {
                error:
                  err instanceof Error && err.message
                    ? err.message
                    : 'Error en el registro',
                respuesta: null,
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    limpiar: () => patchState(store, { ...initialState }),
  })),
);
