import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { ResultadosService } from '../servicios/resultados.service';
import { ResultadosModelo } from '../modelos/Resultados.modelo';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';

type ResultadosStoreState = {
  loading: boolean;
  error: string | null;
  resultados: ResultadosModelo[];
  resultadoSeleccionado: ResultadosModelo | null;
};

const initialState: ResultadosStoreState = {
  loading: false,
  error: null,
  resultados: [],
  resultadoSeleccionado: null,
};

export const ResultadosStore = signalStore(
  { providedIn: 'root' },
  withState<ResultadosStoreState>(initialState),
  withComputed(({ loading, resultados, resultadoSeleccionado }) => ({
    isLoading: computed(() => loading()),
    listaResultados: computed(() => resultados()),
    resultadoActual: computed(() => resultadoSeleccionado()),
  })),
  withMethods((store, resultadosService = inject(ResultadosService)) => ({
    cargarResultados: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          resultadosService.obtenerListaResultados().pipe(
            tap((resultados: ResultadosModelo[]) => {
              patchState(store, { resultados, error: null });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al cargar resultados',
                resultados: [],
              });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    seleccionarPorIdentificador: (identificador: string) => {
      const resultadoFiltrado = store
        .listaResultados()
        .find((r) => r.res_identifica === identificador);
      patchState(store, {
        resultadoSeleccionado: resultadoFiltrado || null,
      });
    },
  })),
);
