import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  concatMap,
  filter,
  finalize,
  of,
  pipe,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { PlanVigenteStore } from './plan-vigente.store';
import { SuscripcionService } from '../servicios/suscripcion.service';
import {
  PLAN_LIBRE_ID_INTERVALO,
  SuscripcionModelo,
} from '../modelos/Suscripcion.modelo';
import { PlanReservadoService } from '../servicios/plan-reservado.service';

const ESTADO_CONFLICTO = 409;

type SolicitudSuscripcionInicial = { usuarioId: number; usuario: string };

// Mensaje `{error}` del servidor (el cuerpo viene sin envoltorio), con un texto de respaldo.
function mensajeDelServidor(error: unknown): string {
  const cuerpo =
    typeof error === 'object' && error !== null && 'error' in error ? error.error : null;
  const mensaje =
    typeof cuerpo === 'object' && cuerpo !== null && 'error' in cuerpo ? cuerpo.error : null;
  return typeof mensaje === 'string' && mensaje !== ''
    ? mensaje
    : 'No puedes elegir este plan porque ya tienes uno pendiente o activo.';
}

// El 409 significa que el usuario ya tiene suscripción: se trata como éxito.
function esConflicto(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === ESTADO_CONFLICTO
  );
}

type SuscripcionState = {
  listaSuscripciones: SuscripcionModelo[];
  objSuscripcionSelec: SuscripcionModelo | null;
  isLoading: boolean;
  isError: string | null;
  errorElegirPlan: string | null;
  avisoConflictoPlan: string | null;
};

const initialState: SuscripcionState = {
  listaSuscripciones: [],
  objSuscripcionSelec: null,
  isLoading: false,
  isError: null,
  errorElegirPlan: null,
  avisoConflictoPlan: null,
};

export const SuscripcionStore = signalStore(
  { providedIn: 'root' },
  withState<SuscripcionState>(initialState),
  withMethods(
    (
      store,
      service = inject(SuscripcionService),
      planReservado = inject(PlanReservadoService),
      planVigenteStore = inject(PlanVigenteStore),
    ) => {
      const recargarPlanVigente = (): void => {
        const usuarioId = planVigenteStore.usuarioId();
        if (usuarioId !== null) planVigenteStore.cargar({ usuarioId });
      };
      return {
      cargarListaSuscripcionesPorUsuario: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, isError: null })),
          switchMap(() =>
            service.obtenerSuscripcionPorUsuario().pipe(
              tap((data: SuscripcionModelo[]) =>
                patchState(store, {
                  listaSuscripciones: data,
                  objSuscripcionSelec: data.length ? data[0] : null,
                }),
              ),
              catchError((err: Error) => {
                patchState(store, {
                  isError: err?.message || 'Error al cargar suscripciones',
                  listaSuscripciones: [],
                  objSuscripcionSelec: null,
                });
                return of([]);
              }),
              finalize(() => patchState(store, { isLoading: false })),
            ),
          ),
        ),
      ),
      cargarListaSuscripcionPorId: rxMethod<number>(
        pipe(
          tap(() => patchState(store, { isLoading: true, isError: null })),
          switchMap((id) =>
            service.obtenerSuscripcionPorId(id).pipe(
              tap((data: SuscripcionModelo) =>
                patchState(store, { objSuscripcionSelec: data }),
              ),
              catchError((err: Error) => {
                patchState(store, {
                  isError: err?.message || 'Error al cargar suscripción',
                });
                return of(null);
              }),
              finalize(() => patchState(store, { isLoading: false })),
            ),
          ),
        ),
      ),
      // Orden: primero la suscripción pendiente del plan de pago reservado (si
      // lo hay) y después la concesión de la prueba. Una reserva Libre o
      // ausente no crea suscripción: el servidor decide la prueba.
      asegurarSuscripcionInicial: rxMethod<SolicitudSuscripcionInicial>(
        pipe(
          filter(({ usuarioId }) => !planReservado.estaVerificada(usuarioId)),
          tap(() => patchState(store, { isLoading: true, isError: null })),
          switchMap(({ usuarioId, usuario }) => {
            const marcarResuelta = (): void => {
              planReservado.marcarVerificada(usuarioId);
              planReservado.borrar(usuario);
            };
            const reserva = planReservado.obtener(usuario);
            const reservaDePago$ =
              reserva !== null && reserva > PLAN_LIBRE_ID_INTERVALO
                ? service.crearSuscripcionInicial({ sus_pinIdPlanin: reserva }).pipe(
                    tap((nueva: SuscripcionModelo) =>
                      patchState(store, {
                        listaSuscripciones: [...store.listaSuscripciones(), nueva],
                        objSuscripcionSelec: nueva,
                      }),
                    ),
                    catchError((error: unknown) =>
                      esConflicto(error) ? of(null) : throwError(() => error),
                    ),
                  )
                : of(null);

            return reservaDePago$.pipe(
              concatMap(() => service.iniciarPrueba()),
              tap((plan) => {
                planVigenteStore.establecer(usuarioId, plan);
                marcarResuelta();
              }),
              catchError((error: unknown) => {
                if (esConflicto(error)) {
                  marcarResuelta();
                  return of(null);
                }
                patchState(store, {
                  isError: 'No se pudo completar la suscripción inicial',
                });
                return of(null);
              }),
              finalize(() => patchState(store, { isLoading: false })),
            );
          }),
        ),
      ),
      // El 409 (ya existe una suscripción pendiente) se trata como éxito. El error
      // propio no usa isError para que el login no lo arrastre hasta el inicio.
      elegirPlan: rxMethod<number>(
        pipe(
          tap(() =>
            patchState(store, { isLoading: true, errorElegirPlan: null }),
          ),
          switchMap((idPlanIntervalo) =>
            service.crearSuscripcionInicial({ sus_pinIdPlanin: idPlanIntervalo }).pipe(
              catchError((error: unknown) => {
                if (!esConflicto(error)) return throwError(() => error);
                // 409: el servidor ya tiene una suscripción pendiente o activa.
                patchState(store, { avisoConflictoPlan: mensajeDelServidor(error) });
                return of(null);
              }),
              tap(() => recargarPlanVigente()),
              catchError(() => {
                patchState(store, {
                  errorElegirPlan: 'No se pudo elegir el plan. Intenta de nuevo',
                });
                return of(null);
              }),
              finalize(() => patchState(store, { isLoading: false })),
            ),
          ),
        ),
      ),
      cerrarAvisoPendiente: () => patchState(store, { avisoConflictoPlan: null }),
      cancelarPlan: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, isError: null })),
          switchMap(() =>
            service.cancelarPlan().pipe(
              tap((plan) => {
                const usuarioId = planVigenteStore.usuarioId();
                if (usuarioId !== null) planVigenteStore.establecer(usuarioId, plan);
              }),
              // El interceptor ya muestra el mensaje del servidor (409, 403, 429).
              catchError(() => {
                patchState(store, { isError: 'No se pudo cancelar el plan' });
                return of(null);
              }),
              finalize(() => patchState(store, { isLoading: false })),
            ),
          ),
        ),
      ),
      crearSuscripcionConPago: rxMethod<any>(
        pipe(
          tap(() => patchState(store, { isLoading: true, isError: null })),
          switchMap((suscripcion) =>
            service.crearSuscripcionConPago(suscripcion).pipe(
              tap((nueva: SuscripcionModelo) => {
                patchState(store, {
                  listaSuscripciones: [...store.listaSuscripciones(), nueva],
                  objSuscripcionSelec: nueva,
                });
              }),
              catchError((err: Error) => {
                patchState(store, {
                  isError: err?.message || 'Error al crear suscripción',
                });
                return of(null);
              }),
              finalize(() => patchState(store, { isLoading: false })),
            ),
          ),
        ),
      ),
      seleccionar: (suscripcion: SuscripcionModelo | null) =>
        patchState(store, { objSuscripcionSelec: suscripcion }),
      limpiar: () => patchState(store, { ...initialState }),
      };
    },
  ),
);
