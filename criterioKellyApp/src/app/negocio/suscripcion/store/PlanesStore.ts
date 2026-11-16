import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, finalize, of, pipe, switchMap, tap } from 'rxjs';
import { PlanesService } from '../servicios/planes.service';
import { PlanesModelo } from '../modelos/Planes.modelo';

type PlanesState = {
  listaPlanes: PlanesModelo[];
  listaPlanesTitulo: PlanesModelo[];
  listaPlanesSuscritos: PlanesModelo[];
  objPlanSeleccionado: PlanesModelo | null;
  loading: boolean;
  error: string | null;
};

const initialState: PlanesState = {
  listaPlanes: [],
  listaPlanesTitulo: [],
  listaPlanesSuscritos: [],
  objPlanSeleccionado: null,
  loading: false,
  error: null,
};

export const PlanesStore = signalStore(
  { providedIn: 'root' },
  withState<PlanesState>(initialState),
  withComputed(({ loading, error, listaPlanes }) => ({
    isLoading: computed(() => loading()),
    isError: computed(() => error()),
    // Solo planes de pago (el Libre ya se usó); agrupados por nombre del plan,
    // del grupo más barato al más caro y, dentro de cada uno, por precio.
    planesParaElegir: computed(() => {
      const planesDePago = listaPlanes().filter((plan) => plan.pin_precioFinal > 0);
      const precioMinimoPorNombre = new Map<string, number>();
      for (const plan of planesDePago) {
        const actual = precioMinimoPorNombre.get(plan.pla_nombre);
        if (actual === undefined || plan.pin_precioFinal < actual) {
          precioMinimoPorNombre.set(plan.pla_nombre, plan.pin_precioFinal);
        }
      }
      return [...planesDePago].sort(
        (a, b) =>
          (precioMinimoPorNombre.get(a.pla_nombre) ?? 0) -
            (precioMinimoPorNombre.get(b.pla_nombre) ?? 0) ||
          a.pla_nombre.localeCompare(b.pla_nombre) ||
          a.pin_precioFinal - b.pin_precioFinal,
      );
    }),
  })),
  withMethods((store, service = inject(PlanesService)) => ({
    cargarPlanes: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          service.obtenerPlanesDisponibles().pipe(
            tap((planes: PlanesModelo[]) => {
              patchState(store, { listaPlanes: planes });
              const objPlanSeleccionado = planes.length > 0 ? planes[0] : null;
              patchState(store, { objPlanSeleccionado });
              const nombresUnicos = new Set<string>();
              const agrupados = planes.filter((plan) => {
                if (nombresUnicos.has(plan.pla_nombre)) {
                  return false;
                }
                nombresUnicos.add(plan.pla_nombre);
                return true;
              });
              patchState(store, { listaPlanesTitulo: agrupados });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al cargar planes',
                listaPlanes: [],
                objPlanSeleccionado: null,
              });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
    cargarPlanesSuscritos: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          service.obtenerPlanesSuscritos().pipe(
            tap((planes: PlanesModelo[]) => {
              patchState(store, { listaPlanesSuscritos: planes });
            }),
            catchError((err: Error) => {
              patchState(store, {
                error: err?.message || 'Error al cargar planes suscritos',
                listaPlanesSuscritos: [],
              });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),

    seleccionarPlanPorObjeto: (plan: PlanesModelo) => {
      patchState(store, { objPlanSeleccionado: plan });
    },
  })),
);
