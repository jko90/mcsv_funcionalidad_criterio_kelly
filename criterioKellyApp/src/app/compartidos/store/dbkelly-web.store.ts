import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { DataBaseWebService } from '../servicios/data-base-web.service';
import { finalize, from, of, tap, catchError } from 'rxjs';

type DividendosKelly = { agr_idAgresiv?: number; agr_valor: number };

type DBCriterioKellyWebStoreState = {
  dividendos: DividendosKelly[];
  loading: boolean;
};

const initialState: DBCriterioKellyWebStoreState = {
  dividendos: [],
  loading: false,
};

export const DBCriterioKellyWebStore = signalStore(
  { providedIn: 'root' },
  withState<DBCriterioKellyWebStoreState>(initialState),
  withComputed(({ dividendos, loading }) => ({
    isLoading: computed(() => loading()),
    listaDividendos: computed(() => dividendos()),
  })),
  withMethods((store, dbWeb = inject(DataBaseWebService)) => {
    const methods = {
      cargarDividendosKelly: (cueId: number, usuarioId: number) => {
        patchState(store, { loading: true });
        from(dbWeb.obtenerDividendosKellyPorUsuario(cueId, usuarioId))
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
        from(dbWeb.agregarDividendoKelly(dividendo))
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
        from(dbWeb.actualizarDividendoKelly(agr_idAgresiv, agr_valor))
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
        from(dbWeb.eliminarDividendoKelly(cueId, usuarioId))
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
