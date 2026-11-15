import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';
import {
  BitacoraResultadoAnalisis,
  observacionResultadoAnalisis,
  OperacionCuentaModelo,
} from '../modelos/DetalleOperacion.modelo';
import { FiltroFechasAnalisis, ReportesService } from '../servicios/reportes.service';

type ReportesStoreState = {
  loading: boolean;
  listaDetallesOperaciones: OperacionCuentaModelo[];
  listaDOPorCuentas: OperacionCuentaModelo[];
  listaOperacionesAnalisis: BitacoraResultadoAnalisis[];
  listaObservacionesAnalisis: observacionResultadoAnalisis[];
  listaOperacionesPorCuentas: BitacoraResultadoAnalisis[];
  listaObservacionesPorBitacora: observacionResultadoAnalisis[];
};

const initialState: ReportesStoreState = {
  loading: false,
  listaDetallesOperaciones: [],
  listaDOPorCuentas: [],
  listaOperacionesAnalisis: [],
  listaObservacionesAnalisis: [],
  listaOperacionesPorCuentas: [],
  listaObservacionesPorBitacora: [],
};

export const ReportesStore = signalStore(
  { providedIn: 'root' },
  withState<ReportesStoreState>(initialState),
  withMethods((store, reportesService = inject(ReportesService)) => ({
    cargarDetalleOperaciones: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap(() =>
          reportesService.obtenerDetalleOperaciones().pipe(
            tap((detallesOperaciones: OperacionCuentaModelo[]) => {
              patchState(store, {
                listaDetallesOperaciones: detallesOperaciones,
              });
            }),
            catchError(() => {
              patchState(store, { listaDetallesOperaciones: [] });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    cargarOperacionesParaAnalisis: rxMethod<FiltroFechasAnalisis>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap(() =>
          reportesService.obtenerOperacionesParaAnalisis().pipe(
            tap((operaciones: BitacoraResultadoAnalisis[]) => {
              patchState(store, { listaOperacionesAnalisis: operaciones });
            }),
            catchError(() => {
              patchState(store, { listaOperacionesAnalisis: [] });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    cargarObservacionesParaAnalisis: rxMethod<FiltroFechasAnalisis>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap(() =>
          reportesService.obtenerObservacionesParaAnalisis().pipe(
            tap((observaciones: observacionResultadoAnalisis[]) => {
              patchState(store, { listaObservacionesAnalisis: observaciones });
            }),
            catchError(() => {
              patchState(store, { listaObservacionesAnalisis: [] });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    obtenerListaOperacionesPorCuentas: (identificador: number) => {
      patchState(store, {
        listaOperacionesPorCuentas: store
          .listaOperacionesAnalisis()
          .filter((r) => r.cue_idCuentas === identificador),
      });
    },
    obtenerListaObservacionesPorBitacora: (identificador: number) => {
      patchState(store, {
        listaObservacionesPorBitacora: store
          .listaObservacionesAnalisis()
          .filter((r) => r.bitacora_id === identificador),
      });
    },
    obtenerDetallePorCuentas: (identificador: number) => {
      patchState(store, {
        listaDOPorCuentas: store
          .listaDetallesOperaciones()
          .filter((r) => r.cue_idCuentas === identificador),
      });
    },
  })),
);
