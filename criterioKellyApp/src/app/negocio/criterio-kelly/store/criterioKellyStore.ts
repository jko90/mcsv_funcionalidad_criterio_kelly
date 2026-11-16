import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { CriterioKellyService } from '../servicios/criterio-kelly.service';
import { CriterioKellyModelo } from '../modelos/CriterioKelly.modelo';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';

type CriterioKellyStoreState = {
  loading: boolean;
  error: string | null;
  criteriosKelly: CriterioKellyModelo[];
  cuentaSeleccionadaId: number | null;
  criterioKellySeleccionado: CriterioKellyModelo | null;
};

const initialState: CriterioKellyStoreState = {
  loading: false,
  error: null,
  criteriosKelly: [],
  cuentaSeleccionadaId: null,
  criterioKellySeleccionado: null,
};

export const CriterioKellyStore = signalStore(
  { providedIn: 'root' },
  withState<CriterioKellyStoreState>(initialState),
  withComputed(
    ({ loading, error, criteriosKelly, criterioKellySeleccionado }) => ({
      isLoading: computed(() => loading()),
      errorMessage: computed(() => error()),
      listaCriteriosKelly: computed(() => criteriosKelly()),
      criterioKellyActual: computed(() => criterioKellySeleccionado()),
    }),
  ),
  withMethods((store, criterioKellyService = inject(CriterioKellyService)) => ({
    cargarCriteriosKelly: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          criterioKellyService.obtenerListaCriterioKelly().pipe(
            tap((criteriosKelly: CriterioKellyModelo[]) => {
              patchState(store, { criteriosKelly, error: null });
              const cuentaId = criteriosKelly[0]?.cke_cueIdCuentas;
              if (cuentaId) {
                const criterioFiltrado = criteriosKelly.find(
                  (c) => c.cke_cueIdCuentas == cuentaId,
                );
                patchState(store, {
                  criterioKellySeleccionado: criterioFiltrado || null,
                });
              }
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al cargar criterios Kelly',
                criteriosKelly: [],
              });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    criterioKellyPorCuenta: (cuentaId: number) => {
      const criterioFiltrado = store
        .listaCriteriosKelly()
        .find((c) => c.cke_cueIdCuentas === cuentaId);
      patchState(store, {
        cuentaSeleccionadaId: cuentaId,
        criterioKellySeleccionado: criterioFiltrado || null,
      });
    },
  })),
);
