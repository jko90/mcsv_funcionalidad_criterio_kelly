import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { SesionStore } from './sesion.store';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { finalize, pipe, switchMap, tap, catchError, of } from 'rxjs';
import { Menu } from 'src/app/compartidos/modelos/menu';
import { MenuService } from 'src/app/compartidos/servicios/menu.service';

type MenuStoreState = {
  loading: boolean;
  menu: Menu[];
};

const initialState: MenuStoreState = {
  loading: false,
  menu: [],
};

const GRUPOS_MENU: string[][] = [
  ['/bitacora', '/bitacora-seguimiento', '/bitacora-fin', '/mostrar-criterio-kelly'],
  ['/operativas', '/analisis'],
  ['/cuentas', '/operativa-kelly', '/perfil', '/validar-pagos', '/datos-pago'],
  ['/ayuda', '/acerca-d'],
];

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
  withComputed(({ listaMenu }) => ({
    // Se agrupa por ruta (redirectTo) y no por nombre: renombrar una opción en menu.json no la hace desaparecer.
    gruposMenu: computed(() => {
      const menu = listaMenu();
      return GRUPOS_MENU.map((rutas) => menu.filter((item) => rutas.includes(item.redirectTo)));
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
