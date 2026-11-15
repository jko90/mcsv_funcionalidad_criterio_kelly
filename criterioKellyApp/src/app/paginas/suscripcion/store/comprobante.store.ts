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
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { textoPeriodoComprobante } from '../configuracion/textos-comprobante';
import {
  ModoComprobante,
  SolicitudComprobante,
  SolicitudCrearConPago,
  UltimoPago,
} from '../modelos/EstadoPago.modelo';
import { PagosService } from '../servicios/pagos.service';
import { SuscripcionService } from '../servicios/suscripcion.service';
import { PlanVigenteStore } from './plan-vigente.store';

const MENSAJE_ERROR_CARGA = 'No se pudo consultar el estado de tu pago';
const MENSAJE_ERROR_ENVIO = 'No se pudo enviar el comprobante';
const MENSAJE_SIN_PLAN_PARA_PAGAR = 'No hay un plan para el que puedas subir un comprobante';

type ComprobanteEstado = {
  ultimoPago: UltimoPago | null;
  enviando: boolean;
  envioExitoso: boolean;
  loading: boolean;
  error: string | null;
};

const estadoInicial: ComprobanteEstado = {
  ultimoPago: null,
  enviando: false,
  envioExitoso: false,
  loading: false,
  error: null,
};

// El interceptor ya muestra el mensaje del servidor; aquí solo se conserva para la pantalla.
function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo: unknown = error.error;
    if (typeof cuerpo === 'object' && cuerpo !== null && 'error' in cuerpo) {
      const mensaje = (cuerpo as { error: unknown }).error;
      if (typeof mensaje === 'string' && mensaje !== '') return mensaje;
    }
  }
  return MENSAJE_ERROR_ENVIO;
}

export const ComprobanteStore = signalStore(
  { providedIn: 'root' },
  withState<ComprobanteEstado>(estadoInicial),
  withComputed(({ loading, error, ultimoPago }, planVigenteStore = inject(PlanVigenteStore)) => {
    const plan = planVigenteStore.plan;
    const planPendiente = computed(() => plan()?.planPendiente ?? null);

    const modo = computed<ModoComprobante>(() => {
      const vigente = plan();
      if (vigente === null) return 'NINGUNO';
      const pendiente = vigente.planPendiente;
      if (pendiente !== null) {
        if (vigente.estado === 'PAGO') return 'ANTICIPADO';
        return pendiente.esRenovacion ? 'RENOVACION' : 'PRIMER_PAGO';
      }
      const puedeAnticipar =
        vigente.estado === 'PAGO' &&
        vigente.planProgramado === null &&
        vigente.pin_idPlanInterv !== null;
      return puedeAnticipar ? 'ANTICIPADO' : 'NINGUNO';
    });

    const estaEnRevision = computed(
      () => planPendiente()?.comprobanteEnviado === true || ultimoPago()?.pag_situacion === 'R',
    );

    return {
      isLoading: computed(() => loading()),
      errorMessage: computed(() => error()),
      plan,
      modo,
      estaEnRevision,
      // RN-01 y RN-12: solo con algo por pagar y sin un comprobante ya en revisión.
      puedeEnviar: computed(() => modo() !== 'NINGUNO' && !estaEnRevision()),
      textoPeriodo: computed(() => textoPeriodoComprobante(modo(), plan())),
      tituloFormulario: computed(() =>
        modo() === 'ANTICIPADO' ? 'Pagar mi renovación por anticipado' : 'Subir comprobante',
      ),
    };
  }),
  withMethods(
    (
      store,
      pagosService = inject(PagosService),
      suscripcionService = inject(SuscripcionService),
      planVigenteStore = inject(PlanVigenteStore),
      sesionStore = inject(SesionStore),
    ) => {
      const cargarUltimoPago = rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            pagosService.obtenerMiUltimoPago().pipe(
              tap((respuesta) => patchState(store, { ultimoPago: respuesta.pago })),
              catchError(() => {
                patchState(store, { error: MENSAJE_ERROR_CARGA });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
          ),
        ),
      );

      const recargarPlanVigente = (): void => {
        const usuarioId = planVigenteStore.usuarioId() ?? sesionStore.usuario()?.id;
        if (usuarioId !== undefined && usuarioId !== null) {
          planVigenteStore.cargar({ usuarioId });
        }
      };

      // Con un plan pendiente se reutiliza su suscripción; el pago anticipado no envía
      // sis_idSuscrip y usa la combinación del plan vigente (RN-04, RN-12).
      const armarCuerpo = (solicitud: SolicitudComprobante): SolicitudCrearConPago | null => {
        const pendiente = store.plan()?.planPendiente ?? null;
        if (pendiente !== null) {
          return {
            ...solicitud,
            pin_idPlanInterv: pendiente.pin_idPlanInterv,
            sis_idSuscrip: pendiente.sis_idSuscrip,
          };
        }
        const idPlanVigente = store.plan()?.pin_idPlanInterv ?? null;
        return idPlanVigente === null
          ? null
          : { ...solicitud, pin_idPlanInterv: idPlanVigente };
      };

      const enviarComprobante = rxMethod<SolicitudComprobante>(
        pipe(
          filter(() => !store.enviando()),
          tap(() => patchState(store, { enviando: true, envioExitoso: false, error: null })),
          switchMap((solicitud) => {
            const cuerpo = armarCuerpo(solicitud);
            if (cuerpo === null) {
              patchState(store, { enviando: false, error: MENSAJE_SIN_PLAN_PARA_PAGAR });
              return of(null);
            }
            return suscripcionService.crearSuscripcionConPago(cuerpo).pipe(
              tap(() => {
                patchState(store, { envioExitoso: true });
                recargarPlanVigente();
                cargarUltimoPago();
              }),
              catchError((error: unknown) => {
                patchState(store, { error: mensajeDeError(error) });
                return of(null);
              }),
              finalize(() => patchState(store, { enviando: false })),
            );
          }),
        ),
      );

      return {
        cargarUltimoPago,
        enviarComprobante,
        limpiar: (): void => patchState(store, { ...estadoInicial }),
      };
    },
  ),
);
