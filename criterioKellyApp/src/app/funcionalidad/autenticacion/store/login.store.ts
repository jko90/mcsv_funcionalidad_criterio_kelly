import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

type LoginStoreState = {
  intentos: number;
  loading: boolean;
  error: string | null;
};

const MAX_INTENTOS = 3;

export const LoginStore = signalStore(
  { providedIn: 'root' },
  withState<LoginStoreState>({ intentos: 0, loading: false, error: null }),
  withComputed(({ intentos, loading, error }) => ({
    intentosAgotados: computed(() => intentos() >= MAX_INTENTOS),
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
  })),
  withMethods((store) => ({
    registrarResultado: (estado: number | null) =>
      patchState(store, {
        intentos: estado === 401 ? store.intentos() + 1 : store.intentos(),
        error: estado === 401 ? 'Credenciales inválidas' : null,
      }),
    reiniciarIntentos: () => patchState(store, { intentos: 0, error: null }),
  })),
);
