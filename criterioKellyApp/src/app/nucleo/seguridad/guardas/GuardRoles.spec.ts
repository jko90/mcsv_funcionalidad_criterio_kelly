import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Rol } from 'src/app/nucleo/modelo/Rol.modelo';
import { SesionStore } from '../../store/sesion.store';
import { GuardRoles } from './GuardRoles';

function rol(id: number): Rol {
  return { rol_id: id, rol_descripcion: `Rol ${id}` };
}

describe('GuardRoles', () => {
  let roles: WritableSignal<Rol[]>;
  let autenticado: WritableSignal<boolean>;
  let router: Router;
  const ruta = {
    data: { roles: [1, 2], requireAll: false },
  } as unknown as ActivatedRouteSnapshot;

  beforeEach(() => {
    roles = signal<Rol[]>([]);
    autenticado = signal(true);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SesionStore,
          useValue: {
            roles,
            estaAutenticado: autenticado,
            estadoRestauracion: signal('finalizada'),
            restaurarSesion: () => undefined,
          },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  async function evaluar(): Promise<boolean | UrlTree> {
    return firstValueFrom(TestBed.inject(GuardRoles).canActivate(ruta));
  }

  it('rol 1 puede entrar', async () => {
    roles.set([rol(1)]);
    expect(await evaluar()).toBeTrue();
  });

  it('rol 2 puede entrar', async () => {
    roles.set([rol(2)]);
    expect(await evaluar()).toBeTrue();
  });

  it('rol 3 va a /inicio', async () => {
    roles.set([rol(3)]);
    const resultado = await evaluar();
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/inicio');
  });

  it('sin sesión va a /login', async () => {
    autenticado.set(false);
    const resultado = await evaluar();
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
  });
});
