import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { CuentasService } from '../servicios/cuentas.service';
import {
  CuentaResponse,
  CrearCuenta,
  ActualizarNombreCuenta,
  EliminarCuenta,
  cuentasRespuetaExitosa,
} from '../modelos/Cuentas.modelo';
import { CapitalModelo } from '../modelos/Capital.modelo';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';

type CuentaStoreState = {
  loading: boolean;
  error: string | null;
  cuentas: CuentaResponse[];
  ultimaCuenta: CuentaResponse | null;
  cuentaEliminada: boolean;
  capitalActualizado: boolean;
  cuentaSeleccionada: CuentaResponse | null;
};

const initialState: CuentaStoreState = {
  loading: false,
  error: null,
  cuentas: [],
  ultimaCuenta: null,
  cuentaEliminada: false,
  capitalActualizado: false,
  cuentaSeleccionada: null,
};

export const CuentaStore = signalStore(
  { providedIn: 'root' },
  withState<CuentaStoreState>(initialState),
  withComputed(({ loading, error, cuentas }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
    listaCuentas: computed(() => cuentas()),
  })),
  withMethods((store, cuentasService = inject(CuentasService)) => ({
    cargarCuentas: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          cuentasService.obtenerCuentas().pipe(
            tap((cuentas: CuentaResponse[]) => {
              patchState(store, { cuentas, error: null });
            }),
            catchError((err) => {
              patchState(store, {
                error: (err as Error)?.message || 'Error al cargar cuentas',
                cuentas: [],
              });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    crearCuenta: rxMethod<CrearCuenta>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((nuevaCuenta: CrearCuenta) =>
          cuentasService.crearNuevaCuenta(nuevaCuenta).pipe(
            tap((cuenta: CrearCuenta) => {
              const maxId = store
                .cuentas()
                .reduce(
                  (max, c) => (c.cue_idCuentas > max ? c.cue_idCuentas : max),
                  0,
                );
              const cuentaResponse: CuentaResponse = {
                cue_idCuentas: maxId + 1,
                cap_idCapital: 0,
                cue_nombre: cuenta.cue_nombre,
                valor_cuenta: cuenta.valor_cuenta,
                fecha_valor: cuenta.fecha_valor,
              };
              patchState(store, {
                ultimaCuenta: cuentaResponse,
                cuentas: [...store.cuentas(), cuentaResponse],
                error: null,
              });
            }),
            catchError((err) => {
              patchState(store, {
                error: (err as Error)?.message || 'Error al crear cuenta',
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    actualizarNombreCuenta: rxMethod<ActualizarNombreCuenta>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((req: ActualizarNombreCuenta) =>
          cuentasService.actualizarNombreCuenta(req).pipe(
            tap((cuentaActualizada: ActualizarNombreCuenta) => {
              const cuentas = store
                .cuentas()
                .map((c) =>
                  c.cue_idCuentas === cuentaActualizada.cue_idCuenta
                    ? { ...c, cue_nombre: cuentaActualizada.cue_nombre }
                    : c,
                );
              patchState(store, { cuentas, error: null });
            }),
            catchError((err) => {
              patchState(store, {
                error: (err as Error)?.message || 'Error al actualizar cuenta',
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    eliminarCuenta: rxMethod<EliminarCuenta>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: true,
            error: null,
            cuentaEliminada: false,
          }),
        ),
        switchMap((req: EliminarCuenta) =>
          cuentasService.eliminarCuenta(req).pipe(
            tap((resp: cuentasRespuetaExitosa) => {
              patchState(store, {
                cuentas: store
                  .cuentas()
                  .filter((c) => c.cue_idCuentas !== req.cue_idCuenta),
                cuentaEliminada: true,
                error: null,
              });
            }),
            catchError((err) => {
              patchState(store, {
                error: (err as Error)?.message || 'Error al eliminar cuenta',
                cuentaEliminada: false,
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    agregarCapital: rxMethod<CapitalModelo>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: true,
            error: null,
            capitalActualizado: false,
          }),
        ),
        switchMap((capital: CapitalModelo) =>
          cuentasService.agregarCapital(capital).pipe(
            tap((resp: CapitalModelo) => {
              const cuentas = store
                .cuentas()
                .map((c) =>
                  c.cue_idCuentas === resp.cap_cueIdCuentas
                    ? { ...c, valor_cuenta: resp.cap_capital }
                    : c,
                );
              patchState(store, {
                cuentas,
                capitalActualizado: true,
                error: null,
              });
            }),
            catchError((err) => {
              patchState(store, {
                error: (err as Error)?.message || 'Error al actualizar capital',
                capitalActualizado: false,
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    buscarCuentaPorId: (id: number) => {
      const cuenta =
        store.cuentas().find((c) => c.cue_idCuentas === id) || null;
      patchState(store, { cuentaSeleccionada: cuenta });
    },
    actualizarListaCuentas: (cuentas: CuentaResponse[]) =>
      patchState(store, { cuentas }),
  })),
);
