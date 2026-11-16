import { inject, Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, Observable, take } from 'rxjs';
import { SesionStore } from 'src/app/nucleo/store/sesion.store';

@Injectable({
  providedIn: 'root',
})
export class GuardAutenticacion implements CanActivate {
  private readonly sesionStore = inject(SesionStore);
  private readonly ruta = inject(Router);
  private readonly estadoRestauracion$ = toObservable(this.sesionStore.estadoRestauracion);

  canActivate(): Observable<boolean | UrlTree> {
    this.sesionStore.restaurarSesion();
    return this.estadoRestauracion$.pipe(
      filter((estado) => estado === 'finalizada'),
      take(1),
      map(() => this.sesionStore.estaAutenticado() || this.ruta.createUrlTree(['/login'])),
    );
  }
}
