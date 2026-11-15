import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { BitacoraService } from '../servicios/bitacora.service';
import {
  ActualizarBitacoraFinalModelo,
  BitacoraModelo,
  RegistroBitacoraModelo,
} from '../modelos/Bitacora.modelo';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';
import { cuentasRespuetaExitosa } from '../../configuracion/modelos/Cuentas.modelo';
import { FiltroBitacora } from '../servicios/bitacora.service';

type BitacoraStoreState = {
  loading: boolean;
  error: string | null;
  bitacoras: BitacoraModelo[];
  ultimaBitacora: BitacoraModelo | null;
  eliminacionExitosa: boolean;
};

const initialState: BitacoraStoreState = {
  loading: false,
  error: null,
  bitacoras: [],
  ultimaBitacora: null,
  eliminacionExitosa: false,
};

export const BitacoraStore = signalStore(
  { providedIn: 'root' },
  withState<BitacoraStoreState>(initialState),
  withComputed(({ loading, error, bitacoras }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
    listaBitacoras: computed(() => bitacoras()),
    listaBitacoraEnOperacion: computed(() =>
      (bitacoras() ?? []).filter(
        (b: BitacoraModelo) => b?.bit_situacion !== 'F',
      ),
    ),
  })),
  withMethods((store, bitacoraService = inject(BitacoraService)) => ({
    cargarBitacoras: rxMethod<FiltroBitacora>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((params: FiltroBitacora) =>
          bitacoraService.obtenerListaBitacora(params).pipe(
            tap((bitacoras: BitacoraModelo[]) => {
              patchState(store, { bitacoras, error: null });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al cargar bitácoras',
                bitacoras: [],
              });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    guardarBitacora: rxMethod<RegistroBitacoraModelo>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: true,
            error: null,
            ultimaBitacora: null,
          }),
        ),
        switchMap((registro: RegistroBitacoraModelo) =>
          bitacoraService.guardarBitacora(registro).pipe(
            tap((bitacora: BitacoraModelo) => {
              patchState(store, {
                ultimaBitacora: bitacora,
                bitacoras: [...store.bitacoras(), bitacora],
                error: null,
              });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al guardar bitácora',
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    eliminarBitacora: rxMethod<number>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: true,
            error: null,
            eliminacionExitosa: false,
          }),
        ),
        switchMap((id: number) =>
          bitacoraService.eliminarBitacora(id).pipe(
            tap((resp: cuentasRespuetaExitosa) => {
              patchState(store, {
                bitacoras: store
                  .bitacoras()
                  .filter((b) => b.bit_idbitacora !== id),
                eliminacionExitosa: true,
                error: null,
              });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al eliminar bitácora',
                eliminacionExitosa: false,
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    finalizaOperacionBitacora: rxMethod<ActualizarBitacoraFinalModelo>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((objActBitacora: ActualizarBitacoraFinalModelo) =>
          bitacoraService.finalizaOperacionBitacora(objActBitacora).pipe(
            tap((actualizada: ActualizarBitacoraFinalModelo) => {
              patchState(store, {
                bitacoras: store
                  .bitacoras()
                  .filter(
                    (b) => b.bit_idbitacora !== actualizada.bit_idbitacora,
                  ),
                error: null,
              });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al finalizar bitácora',
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    setBitacoras: (nuevaLista: BitacoraModelo[]) =>
      patchState(store, { bitacoras: nuevaLista }),
  })),
);
