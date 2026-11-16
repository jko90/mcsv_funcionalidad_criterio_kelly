import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { NombreUsuarioSesion } from 'src/app/configuracion/seguridad/servicio/NombreUsuarioSesion';
import { ServicioAutenticacion } from 'src/app/configuracion/seguridad/servicio/ServicioAutenticacion';
import { ServicioInactividad } from 'src/app/configuracion/seguridad/servicio/ServicioInactividad';
import { SesionService } from 'src/app/configuracion/servicio/sesion.service';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DbPINAppStore } from 'src/app/compartidos/store/dbPIN-app.store';
import { DbPINWebStore } from 'src/app/compartidos/store/dbPIN-web.store';
import { BloqueoPage } from './bloqueo.page';

describe('BloqueoPage · contraseña sin PIN', () => {
  let autenticar: jasmine.Spy;
  let navegar: jasmine.Spy;
  let salir: jasmine.Spy;
  let toast: jasmine.Spy;

  function crearPagina(): BloqueoPage {
    navegar = jasmine.createSpy('navigateForward').and.resolveTo(true);
    salir = jasmine.createSpy('salir').and.resolveTo();
    toast = jasmine.createSpy('mostrarToast').and.resolveTo();
    autenticar = jasmine.createSpy('autenticar');
    const almacenPin = {
      cargarPinBloqueo: () => undefined,
      isLoading: signal(false),
      tienePin: signal(false),
      errorMessage: signal(null),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: NavController, useValue: { navigateForward: navegar } },
        { provide: ServicioInactividad, useValue: { salir } },
        {
          provide: ServicioAutenticacion,
          useValue: { obtenerUsuarioActual: () => ({ id: 1 }) },
        },
        {
          provide: UtilitariosService,
          useValue: {
            mostrarToast: toast,
            esperarCargaDeStore: () => Promise.resolve(),
          },
        },
        { provide: DbPINWebStore, useValue: almacenPin },
        { provide: DbPINAppStore, useValue: almacenPin },
        { provide: NombreUsuarioSesion, useValue: { obtener: () => 'ana' } },
        { provide: SesionService, useValue: { autenticar } },
      ],
    });
    return TestBed.runInInjectionContext(() => new BloqueoPage());
  }

  it('sin PIN al entrar abre la alerta de contraseña', async () => {
    const pagina = crearPagina();
    await pagina.ionViewWillEnter();
    expect(pagina.alertaClaveAbierta()).toBeTrue();
  });

  it('contraseña correcta navega a /inicio', async () => {
    const pagina = crearPagina();
    await pagina.ionViewWillEnter();
    autenticar.and.returnValue(of({ id: 1 }));
    await pagina.alConfirmarClave({ clave: 'buena' });
    expect(navegar).toHaveBeenCalledWith('/inicio');
    expect(salir).not.toHaveBeenCalled();
  });

  it('tres contraseñas incorrectas cierran la sesión; antes reabre la alerta', async () => {
    const pagina = crearPagina();
    await pagina.ionViewWillEnter();
    autenticar.and.returnValue(throwError(() => new Error('401')));
    await pagina.alConfirmarClave({ clave: 'mala' });
    expect(pagina.alertaClaveAbierta()).toBeTrue();
    await pagina.alConfirmarClave({ clave: 'mala' });
    expect(pagina.alertaClaveAbierta()).toBeTrue();
    expect(salir).not.toHaveBeenCalled();
    await pagina.alConfirmarClave({ clave: 'mala' });
    expect(pagina.alertaClaveAbierta()).toBeFalse();
    expect(toast).toHaveBeenCalledWith(
      'Demasiados intentos fallidos',
      'danger',
    );
    expect(salir).toHaveBeenCalled();
  });

  it('pulsar Salir cierra la sesión', async () => {
    const pagina = crearPagina();
    await pagina.ionViewWillEnter();
    await pagina.alSalirDeClave();
    expect(salir).toHaveBeenCalled();
    expect(pagina.alertaClaveAbierta()).toBeFalse();
  });

  it('una contraseña vacía cuenta como intento fallido', async () => {
    const pagina = crearPagina();
    await pagina.ionViewWillEnter();
    await pagina.alConfirmarClave({ clave: '' });
    expect(autenticar).not.toHaveBeenCalled();
    expect(pagina.passcodeAttempts()).toBe(1);
  });
});
