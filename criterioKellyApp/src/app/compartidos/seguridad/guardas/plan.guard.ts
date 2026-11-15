import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, isObservable, map, Observable, of, switchMap, take } from 'rxjs';
import {
  estadoMenuDesdePlan,
  esRutaControlada,
  estaRutaPermitida,
  normalizarRuta,
} from 'src/app/paginas/suscripcion/configuracion/permisos-plan.config';
import { PlanVigente } from 'src/app/paginas/suscripcion/modelos/PlanVigente.modelo';
import { PlanVigenteStore } from 'src/app/paginas/suscripcion/store/plan-vigente.store';
import { SesionStore } from '../../store/sesion.store';

const RUTA_INICIO = '/inicio';

type Decision = boolean | UrlTree | Observable<boolean | UrlTree>;

// Lleva al inicio con el aviso del estado cuando el plan no habilita la ruta.
// Es solo un control de la app (R-01): los backends aplican sus propias reglas.
// Fail-open (D-03): si el plan no se puede leer, se permite la navegación.
export const planGuard: CanActivateFn = (_ruta, estadoRuta): Decision => {
  const rutaIntentada = normalizarRuta(estadoRuta.url);
  if (!esRutaControlada(rutaIntentada)) return true;

  const sesionStore = inject(SesionStore);
  const planVigenteStore = inject(PlanVigenteStore);
  const router = inject(Router);

  const decidir = (plan: PlanVigente | null): boolean | UrlTree => {
    const estadoMenu = estadoMenuDesdePlan(plan);
    if (estaRutaPermitida(estadoMenu, rutaIntentada)) return true;
    planVigenteStore.registrarBloqueo(estadoMenu, rutaIntentada);
    return router.createUrlTree([RUTA_INICIO]);
  };

  const decidirConPlanDelServidor = (): Decision => {
    const usuarioId = sesionStore.usuario()?.id;
    if (!sesionStore.estaAutenticado() || usuarioId === undefined) return true;
    if (planVigenteStore.cargado() && planVigenteStore.usuarioId() === usuarioId) {
      return decidir(planVigenteStore.plan());
    }
    if (!planVigenteStore.isLoading()) planVigenteStore.cargar({ usuarioId });
    return planVigenteStore.esperarPlan().pipe(map(decidir));
  };

  // Las rutas sin GuardAutenticacion necesitan que la sesión ya esté restaurada.
  sesionStore.restaurarSesion();
  if (sesionStore.estadoRestauracion() === 'finalizada') {
    return decidirConPlanDelServidor();
  }
  return toObservable(sesionStore.estadoRestauracion).pipe(
    filter((estado) => estado === 'finalizada'),
    take(1),
    switchMap(() => {
      const decision = decidirConPlanDelServidor();
      return isObservable(decision) ? decision : of(decision);
    }),
  );
};
