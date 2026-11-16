import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  finalize,
  from,
  mergeMap,
  of,
  pipe,
  switchMap,
  tap,
} from 'rxjs';
import { ErrorApi } from 'src/app/nucleo/modelo/error-api';
import {
  descripcionPlan,
  desescaparEntidades,
  enlaceWhatsapp,
  mensajeSolicitudBanco,
  numeroWhatsapp,
} from '../configuracion/textos-pago';
import {
  DatosPagoDisponibles,
  RedUsdtDisponible,
} from '../modelos/DatosPago.modelo';
import { MetodoPago } from '../modelos/EstadoPago.modelo';
import {
  EtapaBanco,
  OpcionMetodoPago,
  PasoPago,
  ResumenPlanPago,
} from '../modelos/PasoPago.modelo';
import { DatosPagoService } from '../servicios/datos-pago.service';
import { SolicitudBancoService } from '../servicios/solicitud-banco.service';
import { PlanVigenteStore } from './plan-vigente.store';

const MENSAJE_ERROR_CARGA_DATOS = 'No se pudieron cargar los métodos de pago';

type MetodoPagoEstado = {
  metodoElegido: MetodoPago | null;
  etapaBanco: EtapaBanco;
  irAlComprobante: boolean;
  // Plan con el que se eligió el método: si cambia, el recorrido vuelve a empezar.
  planDelRecorrido: number | null;
  // Lo que el servidor ofrece hoy (solo en memoria); null mientras no llega o si falló.
  datos: DatosPagoDisponibles | null;
  // Clave de la red → URL de objeto del QR; se revoca al salir de la pantalla.
  urlsQr: Record<string, string>;
  loading: boolean;
  error: string | null;
};

// Solo el recorrido: reiniciarlo no debe borrar los datos de pago ya cargados.
const recorridoInicial = {
  metodoElegido: null,
  etapaBanco: 'PENDIENTE',
  irAlComprobante: false,
  planDelRecorrido: null,
} satisfies Partial<MetodoPagoEstado>;

const estadoInicial: MetodoPagoEstado = {
  ...recorridoInicial,
  datos: null,
  urlsQr: {},
  loading: false,
  error: null,
};

function mensajeDeError(error: unknown): string {
  return error instanceof ErrorApi && error.message !== ''
    ? error.message
    : MENSAJE_ERROR_CARGA_DATOS;
}

export const MetodoPagoStore = signalStore(
  { providedIn: 'root' },
  withState<MetodoPagoEstado>(estadoInicial),
  withComputed(
    (
      {
        loading,
        error,
        metodoElegido,
        etapaBanco,
        irAlComprobante,
        planDelRecorrido,
        datos,
      },
      planVigenteStore = inject(PlanVigenteStore),
    ) => {
      const plan = planVigenteStore.plan;

      const planActualId = computed<number | null>(
        () =>
          plan()?.planPendiente?.pin_idPlanInterv ??
          plan()?.pin_idPlanInterv ??
          null,
      );

      // Si la persona cambia de plan, lo avanzado con el anterior no se arrastra.
      const recorridoVigente = computed(
        () =>
          planDelRecorrido() !== null && planDelRecorrido() === planActualId(),
      );

      const metodoActivo = computed(() =>
        recorridoVigente() ? metodoElegido() : null,
      );
      const etapaBancoActiva = computed<EtapaBanco>(() =>
        recorridoVigente() ? etapaBanco() : 'PENDIENTE',
      );

      const resumenPlan = computed<ResumenPlanPago | null>(() => {
        const vigente = plan();
        if (vigente === null) return null;
        const pendiente = vigente.planPendiente;
        if (pendiente !== null) {
          return {
            nombrePlan: pendiente.pla_nombre,
            intervalo: pendiente.ins_nombre,
            monto: pendiente.pin_precioFinal,
          };
        }
        return vigente.plan === null
          ? null
          : {
              nombrePlan: vigente.plan.pla_nombre,
              intervalo: null,
              monto: null,
            };
      });

      // El servidor ya entrega solo lo activo y completo; aquí solo se limpia el texto.
      const redesUsdt = computed<RedUsdtDisponible[]>(() =>
        (datos()?.cripto?.redes ?? []).map((red) => ({
          ...red,
          nombre: desescaparEntidades(red.nombre),
          etiqueta: desescaparEntidades(red.etiqueta),
        })),
      );
      const correoPaypal = computed(() =>
        (datos()?.paypal?.correo ?? '').trim(),
      );
      const enlacePaypal = computed(() =>
        (datos()?.paypal?.enlace ?? '').trim(),
      );
      const paypalDisponible = computed(
        () => correoPaypal() !== '' || enlacePaypal() !== '',
      );
      const enlaceWhatsappBanco = computed(() => {
        const resumen = resumenPlan();
        if (resumen === null) return null;
        return enlaceWhatsapp(
          numeroWhatsapp(datos()?.banco?.numero ?? null),
          mensajeSolicitudBanco(resumen, datos()?.banco?.plantilla ?? null),
        );
      });

      const disponible = (metodo: MetodoPago): boolean => {
        switch (metodo) {
          case 'CRIPTOMONEDA':
            return redesUsdt().length > 0;
          case 'PAYPAL':
            return paypalDisponible();
          default:
            return enlaceWhatsappBanco() !== null;
        }
      };

      const opcionesMetodo = computed<OpcionMetodoPago[]>(() => [
        {
          metodo: 'CRIPTOMONEDA',
          titulo: 'Criptomoneda (USDT)',
          descripcion: 'Envía USDT por la red TRON u otra red',
          icono: 'logo-bitcoin',
          disponible: disponible('CRIPTOMONEDA'),
        },
        {
          metodo: 'PAYPAL',
          titulo: 'PayPal',
          descripcion: 'Paga a nuestra cuenta de PayPal',
          icono: 'card-outline',
          disponible: disponible('PAYPAL'),
        },
        {
          metodo: 'BANCO',
          titulo: 'Transferencia bancaria',
          descripcion: 'Te enviamos los datos de la cuenta por WhatsApp',
          icono: 'business-outline',
          disponible: disponible('BANCO'),
        },
      ]);

      const pasoActual = computed<PasoPago>(() => {
        if (metodoActivo() === null) return 'METODO';
        return recorridoVigente() && irAlComprobante()
          ? 'COMPROBANTE'
          : 'INSTRUCCIONES';
      });

      return {
        isLoading: computed(() => loading()),
        errorMessage: computed(() => error()),
        metodoActivo,
        etapaBancoActiva,
        pasoActual,
        resumenPlan,
        descripcionPlanElegido: computed(() => {
          const resumen = resumenPlan();
          return resumen === null ? null : descripcionPlan(resumen);
        }),
        montoPlan: computed(() => resumenPlan()?.monto ?? null),
        redesUsdt,
        correoPaypal,
        enlacePaypal,
        paypalDisponible,
        hayErrorDeCarga: computed(() => error() !== null),
        enlaceWhatsappBanco,
        opcionesMetodo,
        metodoActivoDisponible: computed(() => {
          const metodo = metodoActivo();
          return metodo === null ? false : disponible(metodo);
        }),
        planActualId,
      };
    },
  ),
  withMethods(
    (
      store,
      solicitudBanco = inject(SolicitudBancoService),
      planVigenteStore = inject(PlanVigenteStore),
      datosPagoServicio = inject(DatosPagoService),
    ) => {
      const liberarQr = (): void => {
        Object.values(store.urlsQr()).forEach((url) =>
          URL.revokeObjectURL(url),
        );
        patchState(store, { urlsQr: {} });
      };

      const cargarQrFaltantes = rxMethod<readonly RedUsdtDisponible[]>(
        pipe(
          switchMap((redes) =>
            from(
              redes.filter(
                (red) => red.tieneQr && store.urlsQr()[red.clave] === undefined,
              ),
            ).pipe(
              mergeMap((red) =>
                datosPagoServicio.obtenerQr(red.clave).pipe(
                  tap((imagen) =>
                    patchState(store, {
                      urlsQr: {
                        ...store.urlsQr(),
                        [red.clave]: URL.createObjectURL(imagen),
                      },
                    }),
                  ),
                  // Sin imagen se muestra solo la dirección; el pago no se interrumpe.
                  catchError(() => of(null)),
                ),
              ),
            ),
          ),
        ),
      );

      const cargarDatos = rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            datosPagoServicio.obtenerDisponibles().pipe(
              tap((datos) => {
                liberarQr();
                patchState(store, { datos });
                if (store.metodoActivo() === 'CRIPTOMONEDA')
                  cargarQrFaltantes(store.redesUsdt());
              }),
              catchError((error: unknown) => {
                liberarQr();
                patchState(store, {
                  datos: null,
                  error: mensajeDeError(error),
                });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
          ),
        ),
      );

      const guardarEtapaBanco = (
        etapa: 'WHATSAPP_ABIERTO' | 'SOLICITUD_CONFIRMADA',
      ): void => {
        const usuarioId = planVigenteStore.usuarioId();
        const planId = store.planActualId();
        if (usuarioId !== null && planId !== null)
          solicitudBanco.guardar(usuarioId, planId, etapa);
      };
      return {
        cargarDatos,
        liberarQr,
        elegirMetodo(metodo: MetodoPago): void {
          const opcion = store
            .opcionesMetodo()
            .find((candidata) => candidata.metodo === metodo);
          if (!opcion?.disponible) return;
          const usuarioId = planVigenteStore.usuarioId();
          const planId = store.planActualId();
          // En el mismo dispositivo se recuerda que ya se pidieron los datos por WhatsApp.
          const etapaRecordada: EtapaBanco =
            metodo === 'BANCO' && usuarioId !== null && planId !== null
              ? solicitudBanco.obtener(usuarioId, planId)
              : 'PENDIENTE';
          patchState(store, {
            ...recorridoInicial,
            metodoElegido: metodo,
            etapaBanco: etapaRecordada,
            planDelRecorrido: planId,
          });
          if (metodo === 'CRIPTOMONEDA') cargarQrFaltantes(store.redesUsdt());
        },
        olvidarSolicitudBanco(): void {
          solicitudBanco.borrar();
        },
        cambiarMetodo(): void {
          patchState(store, { ...recorridoInicial });
        },
        marcarWhatsappAbierto(): void {
          if (
            store.metodoActivo() !== 'BANCO' ||
            store.etapaBancoActiva() !== 'PENDIENTE'
          )
            return;
          patchState(store, { etapaBanco: 'WHATSAPP_ABIERTO' });
          guardarEtapaBanco('WHATSAPP_ABIERTO');
        },
        confirmarSolicitudEnviada(): void {
          if (store.etapaBancoActiva() !== 'WHATSAPP_ABIERTO') return;
          patchState(store, { etapaBanco: 'SOLICITUD_CONFIRMADA' });
          guardarEtapaBanco('SOLICITUD_CONFIRMADA');
        },
        pasarAlComprobante(): void {
          if (store.pasoActual() !== 'INSTRUCCIONES') return;
          if (
            store.metodoActivo() === 'BANCO' &&
            store.etapaBancoActiva() !== 'SOLICITUD_CONFIRMADA'
          ) {
            return;
          }
          patchState(store, { irAlComprobante: true });
        },
        reiniciar(): void {
          patchState(store, { ...recorridoInicial });
        },
      };
    },
  ),
);
