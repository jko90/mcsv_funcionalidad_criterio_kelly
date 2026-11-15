import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Rol } from 'src/app/compartidos/modelos/Rol.modelo';
import { Menu } from '../modelos/menu';
import { MenuService } from '../servicios/menu.service';
import { MenuStore } from './menu.store';
import { SesionStore } from './sesion.store';

const OPCIONES: Menu[] = [
  { icon: 'a', name: 'Cuentas', redirectTo: '/cuentas' },
  { icon: 'b', name: 'Validar pagos', redirectTo: '/validar-pagos', roles: [1, 2] },
  { icon: 'd', name: 'Datos de pago', redirectTo: '/datos-pago', roles: [1, 2] },
  { icon: 'c', name: 'Perfil', redirectTo: '/perfil' },
];

function rol(id: number): Rol {
  return { rol_id: id, rol_descripcion: `Rol ${id}` };
}

describe('MenuStore', () => {
  let roles: WritableSignal<Rol[]>;
  let store: InstanceType<typeof MenuStore>;

  beforeEach(() => {
    roles = signal<Rol[]>([]);
    TestBed.configureTestingModule({
      providers: [
        { provide: SesionStore, useValue: { roles } },
        { provide: MenuService, useValue: { opcionMenu: () => of(OPCIONES) } },
      ],
    });
    store = TestBed.inject(MenuStore);
    store.cargarMenu();
  });

  function nombres(): string[] {
    return store.listaMenu().map((opcion) => opcion.name);
  }

  it('con roles [3] no aparecen Validar pagos ni Datos de pago y el resto queda igual', () => {
    roles.set([rol(3)]);
    expect(nombres()).toEqual(['Cuentas', 'Perfil']);
  });

  it('con rol 2 aparece Validar pagos', () => {
    roles.set([rol(2)]);
    expect(nombres()).toEqual(['Cuentas', 'Validar pagos', 'Datos de pago', 'Perfil']);
  });

  it('con rol 1 aparece Validar pagos', () => {
    roles.set([rol(1)]);
    expect(nombres()).toContain('Validar pagos');
    expect(nombres()).toContain('Datos de pago');
  });

  it('sin roles solo se ven las opciones abiertas a todos', () => {
    expect(nombres()).toEqual(['Cuentas', 'Perfil']);
  });
});
