import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { MenuService } from '../servicios/menu.service';
import { SesionStore } from './sesion.store';
import { Menu } from '../modelos/menu';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';

type MenuStoreState = {
  loading: boolean;
  menu: Menu[];
};

const initialState: MenuStoreState = {
  loading: false,
  menu: [],
};

export const MenuStore = signalStore(
  { providedIn: 'root' },
  withState<MenuStoreState>(initialState),
  withComputed(({ loading, menu }, sesionStore = inject(SesionStore)) => ({
    isLoading: computed(() => loading()),
    // Las opciones con roles solo se muestran a quien tenga alguno; la autorización real es del servidor.
    listaMenu: computed(() => {
      const idsRoles = sesionStore.roles().map((rol) => rol.rol_id);
      return menu().filter(
        (opcion) =>
          !opcion.roles?.length || opcion.roles.some((idRol) => idsRoles.includes(idRol)),
      );
    }),
  })),
  withMethods((store, menuService = inject(MenuService)) => ({
    cargarMenu: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap(() =>
          menuService.opcionMenu().pipe(
            tap((menu: Menu[]) => {
              patchState(store, { menu });
            }),
            catchError(() => {
              patchState(store, { menu: [] });
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          ),
        ),
      ),
    ),
  })),
);
