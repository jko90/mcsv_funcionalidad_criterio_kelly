import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, finalize, of, pipe, switchMap, tap } from 'rxjs';
import {
  ActivacionCuenta,
  PasoVerificacion,
  SEGUNDOS_ENTRE_REENVIOS,
} from '../modelo/VerificacionCorreo.modelo';
import { VerificacionCorreoService } from '../servicio/verificacion-correo.service';

type VerificacionCorreoEstado = {
  paso: PasoVerificacion;
  correo: string;
  mensajeReenvio: string | null;
  reenvioDisponibleEn: number;
  loading: boolean;
  error: string | null;
};

const estadoInicial: VerificacionCorreoEstado = {
  paso: 'codigo',
  correo: '',
  mensajeReenvio: null,
  reenvioDisponibleEn: 0,
  loading: false,
  error: null,
};

const MILISEGUNDOS_POR_SEGUNDO = 1000;

function instanteFinEnfriamiento(): number {
  return Date.now() + SEGUNDOS_ENTRE_REENVIOS * MILISEGUNDOS_POR_SEGUNDO;
}

function mensajeDeError(error: unknown, mensajePorDefecto: string): string {
  return error instanceof Error && error.message
    ? error.message
    : mensajePorDefecto;
}

export const VerificacionCorreoStore = signalStore(
  { providedIn: 'root' },
  withState(estadoInicial),
  withComputed(({ loading, error }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
  })),
  withMethods((store, servicio = inject(VerificacionCorreoService)) => ({
    iniciar: ({
      correo,
      codigoEnviado,
    }: {
      correo: string;
      codigoEnviado: boolean;
    }): void =>
      patchState(store, {
        paso: 'codigo',
        correo,
        mensajeReenvio: null,
        error: null,
        loading: false,
        reenvioDisponibleEn: codigoEnviado ? instanteFinEnfriamiento() : 0,
      }),
    activarCuenta: rxMethod<ActivacionCuenta>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((datos) =>
          servicio.activarCuenta(datos).pipe(
            tap(() => patchState(store, { paso: 'activada' })),
            catchError((error: unknown) => {
              patchState(store, {
                error: mensajeDeError(error, 'No se pudo activar la cuenta'),
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    reenviarCodigo: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((correo) =>
          servicio.reenviarCodigo({ correo }).pipe(
            tap((respuesta) =>
              patchState(store, {
                correo,
                mensajeReenvio: respuesta.mensaje,
                reenvioDisponibleEn: instanteFinEnfriamiento(),
              }),
            ),
            catchError((error: unknown) => {
              patchState(store, {
                error: mensajeDeError(error, 'No se pudo reenviar el código'),
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    reiniciar: (): void => patchState(store, estadoInicial),
  })),
);
