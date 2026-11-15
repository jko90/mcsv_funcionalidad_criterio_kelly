import { computed } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  finalize,
  from,
  map,
  of,
  pipe,
  switchMap,
  tap,
} from 'rxjs';
import {
  AccesoPinBloqueo,
  PinBloqueo,
  ResultadoVerificacionPin,
  SolicitudPin,
} from '../modelos/pin-bloqueo.modelo';
import {
  ERROR_PIN_SIN_CRIPTOGRAFIA,
  generarHashPin,
  verificarPinContraHash,
} from '../seguridades/hash-pin';

type EstadoPinBloqueo = {
  pin: PinBloqueo | null;
  resultadoVerificacion: ResultadoVerificacionPin | null;
  loading: boolean;
  error: string | null;
  mensaje: string | null;
};

const estadoInicial: EstadoPinBloqueo = {
  pin: null,
  resultadoVerificacion: null,
  loading: false,
  error: null,
  mensaje: null,
};

const mensajeError = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message === ERROR_PIN_SIN_CRIPTOGRAFIA
    ? 'Este dispositivo no permite proteger el PIN. Puede continuar sin PIN.'
    : fallback;

export function conPinBloqueo(obtenerAcceso: () => AccesoPinBloqueo) {
  return signalStoreFeature(
    withState<EstadoPinBloqueo>(estadoInicial),
    withComputed(({ pin, loading, error, mensaje }) => ({
      isLoading: computed(() => loading()),
      errorMessage: computed(() => error()),
      mensajeOperacion: computed(() => mensaje()),
      tienePin: computed(() => !!pin()),
    })),
    withMethods((store, acceso = obtenerAcceso()) => ({
      cargarPinBloqueo: rxMethod<number>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((idUsuario) =>
            from(acceso.obtenerPinBloqueo(idUsuario)).pipe(
              tap((pin) => patchState(store, { pin })),
              catchError(() => {
                patchState(store, { pin: null, error: 'No se pudo consultar el PIN' });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
          ),
        ),
      ),
      guardarPin: rxMethod<SolicitudPin>(
        pipe(
          tap(() =>
            patchState(store, {
              loading: true,
              error: null,
              mensaje: null,
            }),
          ),
          switchMap(({ pin, idUsuario }) =>
            from(generarHashPin(pin)).pipe(
              switchMap((hash) =>
                from(acceso.obtenerPinBloqueo(idUsuario)).pipe(
                  switchMap((existente) =>
                    existente
                      ? from(
                          acceso.editarPinBloqueo(
                            hash,
                            existente.pin_idPin,
                            idUsuario,
                          ),
                        ).pipe(
                          tap((mensaje) =>
                            patchState(store, {
                              mensaje,
                              pin: { ...existente, pin_codigo: hash },
                            }),
                          ),
                        )
                      : from(acceso.agregarPinBloqueo(hash, idUsuario)).pipe(
                          tap((mensaje) =>
                            patchState(store, {
                              mensaje,
                              pin: {
                                pin_idPin: 0,
                                pin_codigo: hash,
                                pin_idUsuario: idUsuario,
                              },
                            }),
                          ),
                        ),
                  ),
                ),
              ),
              catchError((error: unknown) => {
                patchState(store, {
                  error: mensajeError(error, 'No se pudo guardar el PIN'),
                });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
          ),
        ),
      ),
      verificarPin: rxMethod<SolicitudPin>(
        pipe(
          tap(() =>
            patchState(store, {
              loading: true,
              error: null,
              resultadoVerificacion: null,
            }),
          ),
          switchMap(({ pin, idUsuario }) =>
            from(acceso.obtenerPinBloqueo(idUsuario)).pipe(
              switchMap((existente) =>
                !existente
                  ? of('sin-pin' as ResultadoVerificacionPin)
                  : from(verificarPinContraHash(pin, existente.pin_codigo)).pipe(
                      switchMap((resultado) =>
                        resultado.esCorrecto && resultado.requiereMigracion
                          ? from(generarHashPin(pin)).pipe(
                              switchMap((hash) =>
                                from(
                                  acceso.editarPinBloqueo(
                                    hash,
                                    existente.pin_idPin,
                                    idUsuario,
                                  ),
                                ).pipe(
                                  tap(() =>
                                    patchState(store, {
                                      pin: { ...existente, pin_codigo: hash },
                                    }),
                                  ),
                                  map(
                                    () =>
                                      'correcto' as ResultadoVerificacionPin,
                                  ),
                                  catchError(() => {
                                    patchState(store, {
                                      error:
                                        'No se pudo actualizar la protección del PIN',
                                    });
                                    return of('correcto' as ResultadoVerificacionPin);
                                  }),
                                ),
                              ),
                            )
                          : of(
                              resultado.esCorrecto
                                ? ('correcto' as ResultadoVerificacionPin)
                                : ('incorrecto' as ResultadoVerificacionPin),
                            ),
                      ),
                    ),
              ),
              tap((resultadoVerificacion) =>
                patchState(store, {
                  resultadoVerificacion:
                    resultadoVerificacion as ResultadoVerificacionPin,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  error: 'No se pudo verificar el PIN',
                });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
          ),
        ),
      ),
      eliminarPinBloqueo: rxMethod<number>(
        pipe(
          tap(() =>
            patchState(store, { loading: true, error: null, mensaje: null }),
          ),
          switchMap((idUsuario) =>
            from(acceso.eliminarPinBloqueo(idUsuario)).pipe(
              tap((mensaje) => patchState(store, { mensaje, pin: null })),
              catchError(() => {
                patchState(store, { error: 'No se pudo eliminar el PIN' });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
          ),
        ),
      ),
      limpiarVerificacion: () =>
        patchState(store, { resultadoVerificacion: null, error: null }),
    })),
  );
}
