import { computed, inject, InjectionToken } from '@angular/core';
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
  EMPTY,
  filter,
  finalize,
  fromEvent,
  map,
  merge,
  Observable,
  of,
  pipe,
  race,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import {
  LimitesPlan,
  PlanProgramado,
  PlanPendiente,
  PlanVigente,
} from '../modelos/PlanVigente.modelo';
import {
  MarcaPlanAvisado,
  PlanAvisadoService,
} from '../servicios/plan-avisado.service';
import {
  BloqueoPlan,
  EstadoMenu,
  estadoMenuDesdePlan,
  limitesPantalla,
  textoBloqueo,
} from '../configuracion/permisos-plan.config';
import { SuscripcionService } from '../servicios/suscripcion.service';
import { SesionStore } from 'src/app/configuracion/store/sesion.store';

export const INTERVALO_TICK_MS = 30_000;
export const SEGUNDOS_POR_DIA = 86_400;
const SEGUNDOS_POR_HORA = 3_600;
const SEGUNDOS_POR_MINUTO = 60;
const MS_POR_SEGUNDO = 1_000;
export const ESPERA_MAXIMA_PLAN_MS = 3_000;
const INTERVALO_SONDEO_PLAN_MS = 50;

// Reloj monótono: no cambia si la persona modifica la hora del dispositivo.
export const RELOJ_MONOTONICO = new InjectionToken<() => number>(
  'RELOJ_MONOTONICO',
  { providedIn: 'root', factory: () => () => performance.now() },
);

type PlanVigenteEstado = {
  plan: PlanVigente | null;
  usuarioId: number | null;
  recibidoEnMs: number;
  ahoraMs: number;
  marcaAvisada: MarcaPlanAvisado | null;
  bloqueo: BloqueoPlan | null;
  cargado: boolean;
  loading: boolean;
  error: string | null;
};

const estadoInicial: PlanVigenteEstado = {
  plan: null,
  usuarioId: null,
  recibidoEnMs: 0,
  ahoraMs: 0,
  marcaAvisada: null,
  bloqueo: null,
  cargado: false,
  loading: false,
  error: null,
};

function textoDias(cantidad: number): string {
  return cantidad === 1 ? '1 día' : `${cantidad} días`;
}

function formatearTiempo(segundos: number): string {
  if (segundos < SEGUNDOS_POR_MINUTO) return 'menos de 1 min';
  const horas = Math.floor(segundos / SEGUNDOS_POR_HORA);
  const minutos = Math.floor(
    (segundos % SEGUNDOS_POR_HORA) / SEGUNDOS_POR_MINUTO,
  );
  return horas >= 1 ? `${horas} h ${minutos} min` : `${minutos} min`;
}

function textoPlazoPago(diasRestantesPago: number | null): string | null {
  if (diasRestantesPago === null) return null;
  if (diasRestantesPago <= 0) {
    return 'Hoy es el último día para pagarlo; si no, pasarás al plan Libre.';
  }
  return `Tienes ${textoDias(diasRestantesPago)} para pagarlo; si no, pasarás al plan Libre.`;
}

function armarMensajePendiente(
  estado: PlanVigente['estado'],
  pendiente: PlanPendiente,
): string {
  if (estado === 'PAGO') {
    return 'Tu pago por anticipado está en revisión; el administrador lo validará.';
  }
  if (pendiente.comprobanteEnviado) {
    return `Recibimos tu comprobante. Está en revisión: el administrador lo validará y activará tu plan ${pendiente.pla_nombre}.`;
  }
  const partes = [`Tu plan ${pendiente.pla_nombre} está pendiente de pago.`];
  const plazo = pendiente.esRenovacion
    ? textoPlazoPago(pendiente.diasRestantesPago)
    : null;
  if (plazo) partes.push(plazo);
  partes.push(
    'Sube tu comprobante para activarlo y se activa cuando lo valide.',
  );
  return partes.join(' ');
}

function avisoPlanVencido(plan: PlanVigente): string {
  const pendiente = plan.planPendiente;
  if (pendiente === null || !pendiente.esRenovacion) {
    return 'Tu plan de pago terminó';
  }
  const plazo =
    pendiente.diasRestantesPago !== null && pendiente.diasRestantesPago > 0
      ? `Tienes ${textoDias(pendiente.diasRestantesPago)} para pagarlo; si no, pasarás al plan Libre`
      : 'Hoy es el último día para pagarlo; si no, pasarás al plan Libre';
  return `Tu plan ${pendiente.pla_nombre} terminó. ${plazo}`;
}

function avisoSinPlan(plan: PlanVigente): string {
  switch (plan.motivoSinPlan) {
    case 'LIBRE_TERMINADO':
      return 'Terminó tu plan Libre';
    case 'PLAN_PAGO_VENCIDO':
      return avisoPlanVencido(plan);
    default:
      return 'Debes activar un plan para usar todas las funciones';
  }
}

function avisoPlanLibre(dias: number, marca: MarcaPlanAvisado | null): string {
  const restante = `te quedan ${textoDias(dias)}`;
  if (marca?.estado === 'SIN_PLAN') {
    return `Tu renovación se anuló por falta de pago; estás en el plan Libre y ${restante}`;
  }
  if (marca === null || marca.estado === 'PRUEBA') {
    return `Tu prueba terminó; estás en el plan Libre y ${restante}`;
  }
  return `Estás en el plan Libre y ${restante}`;
}

function avisoPlanPagado(plan: PlanVigente): string {
  const nombre = plan.plan?.pla_nombre ?? '';
  const hasta = plan.fechaCorte ? ` hasta el ${plan.fechaCorte}` : '';
  return `Tu plan ${nombre} está activo${hasta}`;
}

function esMismaMarca(
  marca: MarcaPlanAvisado | null,
  plan: PlanVigente,
): boolean {
  return (
    marca !== null &&
    marca.estado === plan.estado &&
    marca.idSuscripcion === plan.idSuscripcion
  );
}

export const PlanVigenteStore = signalStore(
  { providedIn: 'root' },
  withState<PlanVigenteEstado>(estadoInicial),
  withComputed(
    ({
      plan,
      loading,
      error,
      recibidoEnMs,
      ahoraMs,
      marcaAvisada,
      bloqueo,
    }) => {
      const segundosRestantes = computed(() => {
        const segundosServidor = plan()?.segundosRestantes ?? 0;
        const transcurridos = Math.floor(
          (ahoraMs() - recibidoEnMs()) / MS_POR_SEGUNDO,
        );
        return Math.max(0, segundosServidor - Math.max(0, transcurridos));
      });
      const estado = computed(() => plan()?.estado ?? null);
      const esPrueba = computed(() => estado() === 'PRUEBA');
      const diasRestantes = computed(() =>
        Math.ceil(segundosRestantes() / SEGUNDOS_POR_DIA),
      );
      const estadoMenu = computed<EstadoMenu>(() =>
        estadoMenuDesdePlan(plan()),
      );
      const estaCancelado = computed(() => plan()?.cancelado === true);
      // Con un periodo ya pagado por anticipado el plan termina al final de ese periodo.
      const fechaTerminoPlan = computed(
        () => plan()?.planProgramado?.fechaFin ?? plan()?.fechaCorte ?? null,
      );

      return {
        isLoading: computed(() => loading()),
        errorMessage: computed(() => error()),
        estado,
        limites: computed<LimitesPlan>(() => limitesPantalla(plan())),
        esPrueba,
        segundosRestantes,
        diasRestantes,
        textoTiempoRestante: computed(() =>
          esPrueba()
            ? `Tu prueba termina en ${formatearTiempo(segundosRestantes())}`
            : null,
        ),
        planPendiente: computed<PlanPendiente | null>(
          () => plan()?.planPendiente ?? null,
        ),
        planProgramado: computed<PlanProgramado | null>(
          () => plan()?.planProgramado ?? null,
        ),
        tituloPendiente: computed(() => {
          const pendiente = plan()?.planPendiente;
          return pendiente
            ? `${pendiente.pla_nombre} · ${pendiente.ins_nombre}`
            : null;
        }),
        mensajePendiente: computed(() => {
          const vigente = plan();
          return vigente?.planPendiente
            ? armarMensajePendiente(vigente.estado, vigente.planPendiente)
            : null;
        }),
        mensajeProgramado: computed(() => {
          const vigente = plan();
          if (vigente?.estado !== 'PAGO' || !vigente.planProgramado)
            return null;
          return `Tu renovación ya está pagada, empieza el ${vigente.planProgramado.fechaInicio}`;
        }),
        aviso: computed(() => {
          const vigente = plan();
          if (vigente === null || vigente.estado === 'PRUEBA') return null;
          if (esMismaMarca(marcaAvisada(), vigente)) return null;
          switch (vigente.estado) {
            case 'LIBRE':
              return avisoPlanLibre(diasRestantes(), marcaAvisada());
            case 'PAGO':
              return avisoPlanPagado(vigente);
            default:
              return avisoSinPlan(vigente);
          }
        }),
        puedeVerPlanes: computed(() => estado() === 'SIN_PLAN'),
        // RN-01: la acción depende de si el servidor ya tiene un comprobante en revisión.
        puedeSubirComprobante: computed(
          () => plan()?.planPendiente?.comprobanteEnviado === false,
        ),
        puedeVerEstadoPago: computed(
          () => plan()?.planPendiente?.comprobanteEnviado === true,
        ),
        // RN-12: plan de pago vigente sin pago pendiente ni periodo ya programado.
        puedePagarAnticipado: computed(() => {
          const vigente = plan();
          return (
            vigente?.estado === 'PAGO' &&
            vigente.planPendiente === null &&
            vigente.planProgramado === null
          );
        }),
        estadoMenu,
        estaCancelado,
        fechaTerminoPlan,
        puedeCancelar: computed(() => estado() === 'PAGO' && !estaCancelado()),
        mensajeConfirmarCancelacion: computed(() => {
          const fecha = fechaTerminoPlan();
          return fecha
            ? `Tu plan seguirá activo hasta el ${fecha} y no se renovará. ¿Quieres cancelarlo?`
            : 'Tu plan no se renovará. ¿Quieres cancelarlo?';
        }),
        // Se evalúa con el plan actual: si ya no hay restricción, no hay aviso.
        bloqueoVisible: computed<BloqueoPlan | null>(() => {
          const registrado = bloqueo();
          if (registrado === null || estadoMenu() === 'COMPLETO') return null;
          return { ...registrado, estado: estadoMenu() };
        }),
        textoBloqueo: computed(() => {
          if (bloqueo() === null || estadoMenu() === 'COMPLETO') return null;
          return textoBloqueo(estadoMenu(), plan()?.planPendiente ?? null);
        }),
      };
    },
  ),
  withMethods(
    (
      store,
      servicio = inject(SuscripcionService),
      planAvisado = inject(PlanAvisadoService),
      sesionStore = inject(SesionStore),
      reloj = inject(RELOJ_MONOTONICO),
    ) => {
      // Evita pedir el plan en cada tick cuando el servidor sigue devolviendo 0.
      let recargadoPorCero = false;

      const establecer = (usuarioId: number, plan: PlanVigente): void => {
        const ahora = reloj();
        const marcaGuardada =
          planAvisado.obtener(usuarioId) ??
          (store.usuarioId() === usuarioId ? store.marcaAvisada() : null);
        let marcaAvisada = marcaGuardada;
        // La prueba en curso no se avisa: solo se recuerda para detectar su fin.
        if (plan.estado === 'PRUEBA' && !esMismaMarca(marcaGuardada, plan)) {
          planAvisado.guardar(usuarioId, plan.estado, plan.idSuscripcion);
          marcaAvisada = {
            usuarioId,
            estado: plan.estado,
            idSuscripcion: plan.idSuscripcion,
          };
        }
        if ((plan.segundosRestantes ?? 0) > 0) recargadoPorCero = false;
        patchState(store, {
          plan,
          usuarioId,
          recibidoEnMs: ahora,
          ahoraMs: ahora,
          marcaAvisada,
          cargado: true,
        });
      };

      const cargar = rxMethod<{ usuarioId: number }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ usuarioId }) =>
            servicio.obtenerPlanVigente().pipe(
              tap((plan) => establecer(usuarioId, plan)),
              catchError(() => {
                patchState(store, {
                  plan: null,
                  cargado: true,
                  error: 'No se pudo consultar tu plan vigente',
                });
                return of(null);
              }),
              finalize(() => patchState(store, { loading: false })),
            ),
          ),
        ),
      );

      const refrescarReloj = (): void => {
        patchState(store, { ahoraMs: reloj() });
      };

      const pedirPlanSiVencioElTiempo = (): void => {
        const usuarioId = store.usuarioId();
        if (usuarioId === null || recargadoPorCero) return;
        const sinTiempo =
          store.plan()?.segundosRestantes != null &&
          store.segundosRestantes() === 0;
        if (!sinTiempo) return;
        recargadoPorCero = true;
        cargar({ usuarioId });
      };

      const volvioALaApp$ = fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible'),
        map(() => 'visible' as const),
      );

      const vigilar = rxMethod<boolean>(
        pipe(
          switchMap((activo) =>
            activo
              ? merge(
                  timer(INTERVALO_TICK_MS, INTERVALO_TICK_MS).pipe(
                    map(() => 'tick' as const),
                  ),
                  volvioALaApp$,
                )
              : EMPTY,
          ),
          filter(() => sesionStore.estaAutenticado()),
          tap((origen) => {
            refrescarReloj();
            const usuarioId = store.usuarioId();
            if (origen === 'visible' && usuarioId !== null) {
              cargar({ usuarioId });
              return;
            }
            pedirPlanSiVencioElTiempo();
          }),
        ),
      );

      // Emite el plan al terminar la carga en curso; a los 3 s emite null para que
      // el guarda permita (D-03: un fallo de red no deja a nadie fuera).
      const esperarPlan = (): Observable<PlanVigente | null> =>
        race(
          timer(0, INTERVALO_SONDEO_PLAN_MS).pipe(
            filter(() => !store.loading()),
            take(1),
            map(() => store.plan()),
          ),
          timer(ESPERA_MAXIMA_PLAN_MS).pipe(map(() => null)),
        );

      return {
        cargar,
        establecer,
        vigilar,
        esperarPlan,
        registrarBloqueo: (estado: EstadoMenu, rutaIntentada: string): void =>
          patchState(store, { bloqueo: { estado, rutaIntentada } }),
        limpiarBloqueo: (): void => patchState(store, { bloqueo: null }),
        marcarAvisoLeido: (): void => {
          const plan = store.plan();
          const usuarioId = store.usuarioId();
          if (plan === null || usuarioId === null) return;
          planAvisado.guardar(usuarioId, plan.estado, plan.idSuscripcion);
          patchState(store, {
            marcaAvisada: {
              usuarioId,
              estado: plan.estado,
              idSuscripcion: plan.idSuscripcion,
            },
          });
        },
        limpiar: (): void => {
          recargadoPorCero = false;
          patchState(store, { ...estadoInicial });
        },
      };
    },
  ),
);
