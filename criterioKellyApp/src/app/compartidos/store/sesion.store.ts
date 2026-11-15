import { computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  defer,
  EMPTY,
  filter,
  finalize,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  pipe,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { Rol } from 'src/app/paginas/util/modelos/Rol.modelo';
import { UsuarioApp } from 'src/app/paginas/util/modelos/Login.modelo';
import { AlmacenSeguroService } from '../servicios/almacen-seguro.service';
import {
  CoordinadorPestanasService,
  MensajeSesion,
  NOMBRE_BLOQUEO_RENOVACION,
} from '../servicios/coordinador-pestanas.service';
import { SesionService } from '../servicios/sesion.service';
import {
  CredencialesSesion,
  EstadoRestauracion,
  RespuestaSesion,
  usuarioDesdeRespuesta,
} from '../modelos/sesion.modelo';
import { ES_PLATAFORMA_NATIVA } from '../servicios/plataforma';

type SesionEstado = {
  usuario: UsuarioApp | null;
  roles: Rol[];
  accessToken: string | null;
  accessExpira: string | null;
  estadoRestauracion: EstadoRestauracion;
  renovando: boolean;
  cerrandoSesion: boolean;
  cierreRemoto: boolean;
  estadoUltimoError: number | null;
  loading: boolean;
  error: string | null;
};

const initialState: SesionEstado = {
  usuario: null,
  roles: [],
  accessToken: null,
  accessExpira: null,
  estadoRestauracion: 'pendiente',
  renovando: false,
  cerrandoSesion: false,
  cierreRemoto: false,
  estadoUltimoError: null,
  loading: false,
  error: null,
};

export const SesionStore = signalStore(
  { providedIn: 'root' },
  withState<SesionEstado>(initialState),
  withComputed(({ loading, error, usuario, accessToken, cerrandoSesion, estadoRestauracion }) => ({
    isLoading: computed(() => loading()),
    errorMessage: computed(() => error()),
    estaAutenticado: computed(
      () => usuario() !== null && accessToken() !== null && !cerrandoSesion(),
    ),
    restauracionFinalizada: computed(() => estadoRestauracion() === 'finalizada'),
    estaRestaurando: computed(() => estadoRestauracion() === 'en_curso'),
  })),
  withMethods(
    (
      store,
      sesionServicio = inject(SesionService),
      almacenSeguro = inject(AlmacenSeguroService),
      coordinador = inject(CoordinadorPestanasService),
      esNativa = inject(ES_PLATAFORMA_NATIVA),
    ) => {
      let renovacion$: Observable<string> | null = null;
      let restauracionEnCurso = false;

      const aplicarRespuesta = (respuesta: RespuestaSesion): Observable<string> =>
        defer(() =>
          from(
            esNativa && respuesta.refreshToken
              ? almacenSeguro.guardarRefresh(respuesta.refreshToken)
              : Promise.resolve(),
          ),
        ).pipe(
          tap(() =>
            patchState(store, {
              usuario: usuarioDesdeRespuesta(respuesta),
              roles: respuesta.roles,
              accessToken: respuesta.accessToken,
              accessExpira: respuesta.accessExpira,
              estadoUltimoError: null,
              error: null,
            }),
          ),
          map(() => respuesta.accessToken),
        );

      const limpiarTrasErrorRenovacion = (error: unknown): Observable<never> => {
        const estado =
          typeof error === 'object' && error !== null && 'status' in error
            ? Number(error.status)
            : null;
        if (esNativa && (estado === 401 || estado === 403)) {
          void almacenSeguro.eliminarRefresh();
        }
        patchState(store, {
          estadoUltimoError: estado,
          error: null,
          usuario: null,
          roles: [],
          accessToken: null,
          accessExpira: null,
        });
        return throwError(() => error);
      };

      const renovarInternamente = (): Observable<string> => {
        if (renovacion$) return renovacion$;
        patchState(store, { renovando: true, error: null });
        renovacion$ = defer(() => from(esNativa ? almacenSeguro.leerRefresh() : Promise.resolve(null))).pipe(
          switchMap((refreshToken) =>
            esNativa && !refreshToken
              ? throwError(() => new Error('No hay refresh disponible'))
              : sesionServicio.renovar(esNativa ? { refreshToken: refreshToken ?? undefined } : {}),
          ),
          switchMap(aplicarRespuesta),
          finalize(() => {
            renovacion$ = null;
            patchState(store, { renovando: false });
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
        return renovacion$;
      };

      const renovarConCoordinacion = (): Observable<string> => {
        if (!esNativa) {
          const tokenAlPedir = store.accessToken();
          return defer(() =>
            coordinador.ejecutarExclusivo(NOMBRE_BLOQUEO_RENOVACION, async () => {
              const tokenExistente = store.accessToken();
              if (tokenExistente && tokenExistente !== tokenAlPedir) {
                return tokenExistente;
              }
              const tokenActual = await firstValueFrom(renovarInternamente());
              if (tokenActual !== tokenAlPedir) {
                coordinador.publicar(crearMensajeRenovada(store));
              }
              return tokenActual;
            }),
          ).pipe(
            switchMap((token) => of(token)),
            catchError(limpiarTrasErrorRenovacion),
          );
        }
        return renovarInternamente().pipe(catchError(limpiarTrasErrorRenovacion));
      };

      const restaurar = rxMethod<void>(
        pipe(
          filter(() => !restauracionEnCurso && store.estadoRestauracion() === 'pendiente'),
          tap(() => {
            restauracionEnCurso = true;
            patchState(store, { estadoRestauracion: 'en_curso', loading: true });
          }),
          switchMap(() =>
            from(restaurarSesionPendiente(almacenSeguro, esNativa)).pipe(
              switchMap((hayPendiente) =>
                hayPendiente
                  ? renovarConCoordinacion().pipe(
                      switchMap(() => sesionServicio.cerrarSesion()),
                      tap(() => almacenSeguro.limpiarCierrePendiente()),
                      map(() => null),
                      catchError(() => of(null)),
                    )
                  : renovarConCoordinacion().pipe(
                      catchError(() => of(null)),
                      map(() => null),
                    ),
              ),
              catchError(() => of(null)),
              finalize(() => {
                restauracionEnCurso = false;
                patchState(store, { estadoRestauracion: 'finalizada', loading: false });
              }),
            ),
          ),
        ),
      );

      return {
        iniciarSesion: rxMethod<CredencialesSesion>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null, estadoUltimoError: null })),
            switchMap((credenciales) =>
              sesionServicio.autenticar(credenciales).pipe(
                switchMap(aplicarRespuesta),
                tap(() => almacenSeguro.limpiarCierrePendiente()),
                catchError((error: unknown) => {
                  const estado =
                    typeof error === 'object' && error !== null && 'status' in error
                      ? Number(error.status)
                      : null;
                  patchState(store, {
                    usuario: null,
                    roles: [],
                    accessToken: null,
                    accessExpira: null,
                    estadoUltimoError: estado,
                    error: error instanceof Error ? error.message : 'Error en la autenticación',
                  });
                  return EMPTY;
                }),
                finalize(() => patchState(store, { loading: false })),
              ),
            ),
          ),
        ),
        restaurarSesion: restaurar,
        renovarSesion: renovarConCoordinacion,
        renovacionEnCurso: () => renovacion$,
        cerrarSesion: rxMethod<void>(
          pipe(
            tap(() => patchState(store, { cerrandoSesion: true, loading: true })),
            switchMap(() =>
              defer(() => {
                let cierreExitoso = false;
                return sesionServicio.cerrarSesion().pipe(
                  tap(() => {
                    cierreExitoso = true;
                  }),
                  catchError(() => of(null)),
                  finalize(() => {
                    void almacenSeguro.eliminarRefresh();
                    if (!esNativa && !cierreExitoso) {
                      almacenSeguro.marcarCierrePendiente();
                    }
                    patchState(store, {
                      ...initialState,
                      estadoRestauracion: 'finalizada',
                    });
                    if (!esNativa) coordinador.publicar({ tipo: 'sesion-cerrada' });
                  }),
                );
              }),
            ),
          ),
        ),
        cerrarTodasLasSesiones: rxMethod<void>(
          pipe(
            tap(() => patchState(store, { cerrandoSesion: true, loading: true })),
            switchMap(() =>
              defer(() => {
                let cierreExitoso = false;
                return sesionServicio.cerrarTodas().pipe(
                  tap(() => {
                    cierreExitoso = true;
                  }),
                  catchError(() => of(null)),
                  finalize(() => {
                    void almacenSeguro.eliminarRefresh();
                    if (!esNativa && !cierreExitoso) {
                      almacenSeguro.marcarCierrePendiente();
                    }
                    patchState(store, {
                      ...initialState,
                      estadoRestauracion: 'finalizada',
                    });
                    if (!esNativa) coordinador.publicar({ tipo: 'sesion-cerrada' });
                  }),
                );
              }),
            ),
          ),
        ),
        limpiarSesionLocal: () =>
          patchState(store, {
            usuario: null,
            roles: [],
            accessToken: null,
            accessExpira: null,
            cerrandoSesion: false,
            loading: false,
          }),
        actualizarDatosUsuario: (usuario: UsuarioApp) => patchState(store, { usuario }),
        confirmarCierreRemoto: () => patchState(store, { cierreRemoto: false }),
      };

      function crearMensajeRenovada(estado: typeof store): MensajeSesion {
        const usuario = estado.usuario();
        return {
          tipo: 'sesion-renovada',
          sesion: {
            id: usuario?.id ?? 0,
            nombres: usuario?.nombres ?? '',
            apellidos: usuario?.apellidos ?? '',
            roles: estado.roles(),
            accessToken: estado.accessToken() ?? '',
            accessExpira: estado.accessExpira() ?? '',
          },
        };
      }

      async function restaurarSesionPendiente(
        almacen: AlmacenSeguroService,
        nativa: boolean,
      ): Promise<boolean> {
        return !nativa && almacen.hayCierrePendiente();
      }
    },
  ),
  withHooks({
    onInit(store) {
      const coordinador = inject(CoordinadorPestanasService);
      const destruir = inject(DestroyRef);
      coordinador.mensajes$
        .pipe(takeUntilDestroyed(destruir))
        .subscribe((mensaje) => {
        if (mensaje.tipo === 'sesion-cerrada') {
          if (store.estaAutenticado()) {
            store.limpiarSesionLocal();
            patchState(store, { cierreRemoto: true });
          }
          return;
        }
        const sesion = mensaje.sesion;
        const usuario = store.usuario();
        const puedeAdoptar =
          (store.estaAutenticado() && usuario?.id === sesion.id) ||
          store.estadoRestauracion() !== 'finalizada';
        if (!puedeAdoptar) return;
        patchState(store, {
          usuario: {
            id: sesion.id,
            nombres: sesion.nombres,
            apellidos: sesion.apellidos,
          },
          roles: sesion.roles,
          accessToken: sesion.accessToken,
          accessExpira: sesion.accessExpira,
        });
        });
    },
  }),
);
