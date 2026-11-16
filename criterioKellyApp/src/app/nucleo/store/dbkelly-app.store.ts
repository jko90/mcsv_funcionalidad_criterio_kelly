import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { finalize, from, of, tap, catchError } from 'rxjs';
import { DataBaseService } from 'src/app/nucleo/base-datos/data-base.service';

type DividendosKelly = { agr_idAgresiv?: number; agr_valor: number };

type DBCriterioKellyAppStoreState = {
  dividendos: DividendosKelly[];
  loading: boolean;
};

const initialState: DBCriterioKellyAppStoreState = {
  dividendos: [],
  loading: false,
};

export const DBCriterioKellyAppStore = signalStore(
  { providedIn: 'root' },
  withState<DBCriterioKellyAppStoreState>(initialState),
  withComputed(({ dividendos, loading }) => ({
    isLoading: computed(() => loading()),
    listaDividendos: computed(() => dividendos()),
  })),
  withMethods((store, dbApp = inject(DataBaseService)) => {
    const methods = {
      cargarDividendosKelly: (cueId: number, usuarioId: number) => {
        patchState(store, { loading: true });
        from(dbApp.obtenerDividendosKellyPorUsuario(cueId, usuarioId))
          .pipe(
            tap((data: any) => {
              const dividendos: DividendosKelly[] =
                data && 'values' in data && Array.isArray(data.values)
                  ? data.values
                  : [{ agr_valor: 10 }];
              patchState(store, { dividendos });
            }),
            catchError(() => {
              patchState(store, { dividendos: [] });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();
      },
      agregarDividendoKelly: (
        dividendo: DividendosKelly & {
          agr_usuarioId: number;
          agr_cueIdCuentas: number;
        },
      ) => {
        patchState(store, { loading: true });
        from(dbApp.agregarDividendoKelly(dividendo))
          .pipe(
            tap(() => {
              methods.cargarDividendosKelly(
                dividendo.agr_cueIdCuentas,
                dividendo.agr_usuarioId,
              );
            }),
            catchError(() => {
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();
      },
      actualizarDividendoKelly: (
        agr_idAgresiv: number,
        agr_valor: number,
        cueId: number,
        usuarioId: number,
      ) => {
        patchState(store, { loading: true });
        from(dbApp.actualizarDividendoKelly(agr_idAgresiv, agr_valor))
          .pipe(
            tap(() => {
              methods.cargarDividendosKelly(cueId, usuarioId);
            }),
            catchError(() => {
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();
      },
      eliminarDividendoKelly: (cueId: number, usuarioId: number) => {
        patchState(store, { loading: true });
        from(dbApp.eliminarDividendoKelly(cueId, usuarioId))
          .pipe(
            tap(() => {
              methods.cargarDividendosKelly(cueId, usuarioId);
            }),
            catchError(() => {
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();
      },
    };
    return methods;
  }),
);
