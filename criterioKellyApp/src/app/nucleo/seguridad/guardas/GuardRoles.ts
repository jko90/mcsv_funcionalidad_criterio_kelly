import { inject, Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, Observable, take } from 'rxjs';
import { SesionStore } from 'src/app/nucleo/store/sesion.store';

@Injectable({
  providedIn: 'root',
})
export class GuardRoles implements CanActivate {
  private readonly sesionStore = inject(SesionStore);
  private readonly ruta = inject(Router);
  private readonly estadoRestauracion$ = toObservable(this.sesionStore.estadoRestauracion);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    this.sesionStore.restaurarSesion();
    return this.estadoRestauracion$.pipe(
      filter((estado) => estado === 'finalizada'),
      take(1),
      map(() => this.evaluarAcceso(route)),
    );
  }

  private evaluarAcceso(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.sesionStore.estaAutenticado()) return this.ruta.createUrlTree(['/login']);
    const requiredRoles = route.data['roles'] as number[] | undefined;
    const requireAll = (route.data['requireAll'] as boolean | undefined) ?? false;
    if (!requiredRoles?.length) return true;
    const roles = this.sesionStore.roles();
    const tieneRol = (id: number) => roles.some((rol) => rol.rol_id === id);
    const tieneAcceso = requireAll
      ? requiredRoles.every(tieneRol)
      : requiredRoles.some(tieneRol);
    return tieneAcceso ? true : this.ruta.createUrlTree(['/inicio']);
  }
}
