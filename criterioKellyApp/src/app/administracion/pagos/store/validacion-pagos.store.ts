import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, filter, finalize, of, pipe, switchMap, tap } from 'rxjs';
import { ErrorApi } from 'src/app/configuracion/modelo/error-api';
import {
  esMotivoValido,
  mensajeConfirmarAprobacion,
  motivoSugerido,
} from '../configuracion/textos-validacion';
import {
  PagoPendiente,
  ResultadoValidacion,
} from '../modelos/PagoPendiente.modelo';
import { AdministracionPagosService } from '../servicios/administracion-pagos.service';

export const TAMANO_PAGINA_PAGOS = 20;
const ESTADO_CONFLICTO = 409;
const ESTADO_NO_ENCONTRADO = 404;
const MENSAJE_ERROR_CARGA = 'No se pudo cargar la lista de pagos';
const MENSAJE_ERROR_VALIDACION = 'No se pudo procesar el pago';
const MENSAJE_MOTIVO_INVALIDO = 'El motivo debe tener entre 5 y 256 caracteres';

type ValidacionPagosEstado = {
  pagos: PagoPendiente[];
  seleccionado: PagoPendiente | null;
  comprobante: string | null;
  cargandoComprobante: boolean;
  procesando: boolean;
  hayMas: boolean;
  resultado: ResultadoValidacion | null;
  loading: boolean;
  error: string | null;
};

const estadoInicial: ValidacionPagosEstado = {
  pagos: [],
  seleccionado: null,
  comprobante: null,
  cargandoComprobante: false,
  procesando: false,
  hayMas: false,
  resultado: null,
  loading: false,
  error: null,
};

function estadoHttpDeError(error: unknown): number | null {
  if (error instanceof ErrorApi) return error.estado;
  if (error instanceof HttpErrorResponse) return error.status;
  return null;
}

// El interceptor ya mostró el mensaje del servidor; aquí se conserva para la pantalla.
function mensajeDeError(error: unknown, mensajePorDefecto: string): string {
  return error instanceof Error && error.message !== ''
    ? error.message
    : mensajePorDefecto;
}

function menorIdPago(pagos: PagoPendiente[]): number | undefined {
  return pagos.length === 0
    ? undefined
    : Math.min(...pagos.map((pago) => pago.pag_idPago));
}

export const ValidacionPagosStore = signalStore(
  { providedIn: 'root' },
  withState<ValidacionPagosEstado>(estadoInicial),
  withComputed(({ loading, error, seleccionado, comprobante }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
    tieneComprobanteCargado: computed(() => comprobante() !== null),
    motivoRechazoSugerido: computed(() => motivoSugerido(seleccionado())),
    mensajeConfirmarAprobacion: computed(() => {
      const pago = seleccionado();
      return pago === null ? '' : mensajeConfirmarAprobacion(pago);
    }),
  })),
  withMethods((store, servicio = inject(AdministracionPagosService)) => {
    const cargarPendientes = rxMethod<void>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: true,
            error: null,
            seleccionado: null,
            comprobante: null,
          }),
        ),
        switchMap(() =>
          servicio.obtenerPendientes(TAMANO_PAGINA_PAGOS).pipe(
            tap((pagos) =>
              patchState(store, {
                pagos,
                hayMas: pagos.length === TAMANO_PAGINA_PAGOS,
              }),
            ),
            catchError((error: unknown) => {
              patchState(store, {
                pagos: [],
                hayMas: false,
                error: mensajeDeError(error, MENSAJE_ERROR_CARGA),
              });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    );

    const cargarMas = rxMethod<void>(
      pipe(
        filter(() => store.hayMas() && !store.loading()),
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          servicio
            .obtenerPendientes(TAMANO_PAGINA_PAGOS, menorIdPago(store.pagos()))
            .pipe(
              tap((pagina) =>
                patchState(store, {
                  pagos: [...store.pagos(), ...pagina],
                  hayMas: pagina.length === TAMANO_PAGINA_PAGOS,
                }),
              ),
              catchError((error: unknown) => {
                patchState(store, {
                  error: mensajeDeError(error, MENSAJE_ERROR_CARGA),
                });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
        ),
      ),
    );

    const seleccionar = rxMethod<PagoPendiente>(
      pipe(
        tap((pago) =>
          patchState(store, {
            seleccionado: pago,
            comprobante: null,
            cargandoComprobante: pago.tieneComprobante,
          }),
        ),
        switchMap((pago) => {
          if (!pago.tieneComprobante) return of(null);
          return servicio.obtenerComprobante(pago.pag_idPago).pipe(
            tap((respuesta) =>
              patchState(store, { comprobante: respuesta.comprobante }),
            ),
            catchError((error: unknown) => {
              // 404: el pago no tiene imagen; la ventana muestra «Sin comprobante».
              const sinImagen =
                estadoHttpDeError(error) === ESTADO_NO_ENCONTRADO;
              patchState(store, {
                comprobante: null,
                error: sinImagen
                  ? null
                  : mensajeDeError(error, MENSAJE_ERROR_CARGA),
              });
              return of(null);
            }),
            finalize(() => patchState(store, { cargandoComprobante: false })),
          );
        }),
      ),
    );

    const quitarPago = (idPago: number, resultado: ResultadoValidacion): void =>
      patchState(store, {
        pagos: store.pagos().filter((pago) => pago.pag_idPago !== idPago),
        seleccionado: null,
        comprobante: null,
        resultado,
      });

    // Un 409 indica que el pago cambió (otro administrador, comprobante antiguo...):
    // se vuelve a pedir la primera página para mostrar lo vigente.
    const alFallarValidacion = (error: unknown): null => {
      patchState(store, {
        error: mensajeDeError(error, MENSAJE_ERROR_VALIDACION),
      });
      if (estadoHttpDeError(error) === ESTADO_CONFLICTO) cargarPendientes();
      return null;
    };

    const aprobar = rxMethod<number>(
      pipe(
        filter(() => !store.procesando()),
        tap(() => patchState(store, { procesando: true, error: null })),
        switchMap((idPago) =>
          servicio.confirmar(idPago).pipe(
            tap(() => quitarPago(idPago, 'APROBADO')),
            catchError((error: unknown) => of(alFallarValidacion(error))),
            finalize(() => patchState(store, { procesando: false })),
          ),
        ),
      ),
    );

    const rechazar = rxMethod<{ idPago: number; motivo: string }>(
      pipe(
        filter(() => !store.procesando()),
        tap(() => patchState(store, { procesando: true, error: null })),
        switchMap(({ idPago, motivo }) => {
          if (!esMotivoValido(motivo)) {
            patchState(store, {
              procesando: false,
              error: MENSAJE_MOTIVO_INVALIDO,
            });
            return of(null);
          }
          return servicio.rechazar(idPago, motivo.trim()).pipe(
            tap(() => quitarPago(idPago, 'RECHAZADO')),
            catchError((error: unknown) => of(alFallarValidacion(error))),
            finalize(() => patchState(store, { procesando: false })),
          );
        }),
      ),
    );

    return {
      cargarPendientes,
      cargarMas,
      seleccionar,
      aprobar,
      rechazar,
      esMotivoValido,
      deseleccionar: (): void =>
        patchState(store, {
          seleccionado: null,
          comprobante: null,
          cargandoComprobante: false,
        }),
      limpiarResultado: (): void => patchState(store, { resultado: null }),
      limpiar: (): void => patchState(store, { ...estadoInicial }),
    };
  }),
);
