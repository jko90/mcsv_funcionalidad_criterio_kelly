import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Capacitor } from '@capacitor/core';
import { catchError, finalize, from, of, pipe, switchMap, tap } from 'rxjs';
import { ServicioAutenticacion } from 'src/app/configuracion/seguridad/servicio/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DbPINWebStore } from 'src/app/configuracion/store/dbPIN-web.store';
import { DbPINAppStore } from 'src/app/configuracion/store/dbPIN-app.store';

export type ResultadoGuardadoPin = 'creado' | 'error';

type PinFormularioEstado = {
  guardando: boolean;
  error: string | null;
  mensaje: string | null;
  resultado: ResultadoGuardadoPin | null;
};

const estadoInicial: PinFormularioEstado = {
  guardando: false,
  error: null,
  mensaje: null,
  resultado: null,
};

const ID_USUARIO_SIN_SESION = 0;
const MENSAJE_ERROR_POR_DEFECTO = 'No se pudo guardar el PIN';

export const PinFormularioStore = signalStore(
  { providedIn: 'root' },
  withState<PinFormularioEstado>(estadoInicial),
  withComputed(({ guardando, error, mensaje, resultado }) => ({
    isLoading: computed(() => guardando()),
    errorMessage: computed(() => error()),
    /** Texto del aviso: el error si lo hubo y, si no, el mensaje de la operación. */
    mensajeResultado: computed(() => error() ?? mensaje() ?? ''),
    colorAviso: computed<'success' | 'danger'>(() =>
      error() ? 'danger' : 'success',
    ),
    pinCreado: computed(() => resultado() === 'creado'),
  })),
  withMethods((store) => {
    const servicioAutenticacion = inject(ServicioAutenticacion);
    const utilServicio = inject(UtilitariosService);
    const almacenWeb = inject(DbPINWebStore);
    const almacenNativo = inject(DbPINAppStore);

    // La plataforma se resuelve al guardar, igual que antes en la página.
    const guardarEnAlmacenLocal = async (
      pin: string,
    ): Promise<{ error: string | null; mensaje: string }> => {
      const almacen =
        Capacitor.getPlatform() === 'web' ? almacenWeb : almacenNativo;
      const idUsuario =
        servicioAutenticacion.obtenerUsuarioActual()?.id ||
        ID_USUARIO_SIN_SESION;
      almacen.guardarPin({ pin, idUsuario });
      await utilServicio.esperarCargaDeStore(() => almacen.isLoading());
      return {
        error: almacen.errorMessage(),
        mensaje: almacen.mensajeOperacion() ?? '',
      };
    };

    return {
      guardar: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              guardando: true,
              error: null,
              mensaje: null,
              resultado: null,
            }),
          ),
          switchMap((pin) =>
            from(guardarEnAlmacenLocal(pin)).pipe(
              tap(({ error, mensaje }) =>
                patchState(store, {
                  error,
                  mensaje,
                  resultado: error ? 'error' : 'creado',
                }),
              ),
              catchError(() => {
                patchState(store, {
                  error: MENSAJE_ERROR_POR_DEFECTO,
                  resultado: 'error',
                });
                return of(null);
              }),
              finalize(() => patchState(store, { guardando: false })),
            ),
          ),
        ),
      ),
    };
  }),
);
