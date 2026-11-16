import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { IonModal } from '@ionic/angular/standalone';
import type { OverlayEventDetail } from '@ionic/core';
import { NombreUsuarioSesion } from 'src/app/configuracion/seguridad/servicio/NombreUsuarioSesion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DbPINAppStore } from 'src/app/compartidos/store/dbPIN-app.store';
import { DbPINWebStore } from 'src/app/compartidos/store/dbPIN-web.store';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { PinFormularioStore } from '../../../../config/bloqueo-pin/store/pin-formulario.store';
import { SuscripcionStore } from '../../../../negocio/suscripcion/store/SuscripcionStore';
import { LoginStore } from '../../store/login.store';
import { VerificacionCorreoStore } from '../../store/verificacion-correo.store';
import { LoginPage } from './login.page';

// Valor de prueba obvio: ningún PIN real aparece en este archivo.
const PIN_DE_PRUEBA = '111111';

type ResultadoModalPin = { omitido?: boolean; pinCreado?: boolean };

describe('LoginPage · modal del PIN', () => {
  let llamadas: string[];
  let navegar: jasmine.Spy;
  let guardar: jasmine.Spy;
  let toast: jasmine.Spy;
  let cerrarModal: jasmine.Spy;
  let modal: IonModal;
  let pinCreado: ReturnType<typeof signal<boolean>>;
  let mensajeResultado: ReturnType<typeof signal<string>>;
  let colorAviso: ReturnType<typeof signal<'success' | 'danger'>>;

  function crearPagina(): LoginPage {
    llamadas = [];
    navegar = jasmine.createSpy('navigate').and.resolveTo(true);
    guardar = jasmine
      .createSpy('guardar')
      .and.callFake(() => llamadas.push('guardar'));
    toast = jasmine.createSpy('mostrarToast').and.callFake(async () => {
      llamadas.push('toast');
    });
    cerrarModal = jasmine.createSpy('dismiss').and.callFake(async () => {
      llamadas.push('dismiss');
      return true;
    });
    modal = { dismiss: cerrarModal } as unknown as IonModal;
    pinCreado = signal(true);
    mensajeResultado = signal('PIN creado correctamente.');
    colorAviso = signal<'success' | 'danger'>('success');

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: navegar } },
        {
          provide: UtilitariosService,
          useValue: {
            mostrarToast: toast,
            esperarCargaDeStore: () => Promise.resolve(),
          },
        },
        { provide: SesionStore, useValue: {} },
        { provide: NombreUsuarioSesion, useValue: {} },
        { provide: DbPINWebStore, useValue: {} },
        { provide: DbPINAppStore, useValue: {} },
        { provide: LoginStore, useValue: {} },
        { provide: SuscripcionStore, useValue: {} },
        { provide: VerificacionCorreoStore, useValue: {} },
        {
          provide: PinFormularioStore,
          useValue: {
            guardar,
            guardando: signal(false),
            isLoading: signal(false),
            mensajeResultado,
            colorAviso,
            pinCreado,
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new LoginPage());
  }

  const eventoCierre = (datos?: ResultadoModalPin) =>
    ({ detail: { data: datos } }) as CustomEvent<
      OverlayEventDetail<ResultadoModalPin>
    >;

  it('crear el PIN: guarda, avisa con éxito y cierra con { pinCreado: true }', async () => {
    const pagina = crearPagina();
    await pagina.alConfirmarPin(PIN_DE_PRUEBA, modal);
    expect(guardar).toHaveBeenCalledOnceWith(PIN_DE_PRUEBA);
    expect(toast).toHaveBeenCalledOnceWith(
      'PIN creado correctamente.',
      'success',
    );
    expect(cerrarModal).toHaveBeenCalledOnceWith({ pinCreado: true });
    expect(llamadas).toEqual(['guardar', 'toast', 'dismiss']);
  });

  it('error al guardar: aviso de peligro y cierra con { pinCreado: false }', async () => {
    const pagina = crearPagina();
    pinCreado.set(false);
    mensajeResultado.set('No se pudo guardar el PIN');
    colorAviso.set('danger');
    await pagina.alConfirmarPin(PIN_DE_PRUEBA, modal);
    expect(toast).toHaveBeenCalledOnceWith(
      'No se pudo guardar el PIN',
      'danger',
    );
    expect(cerrarModal).toHaveBeenCalledOnceWith({ pinCreado: false });
  });

  it('valores distintos: solo muestra el aviso y no cierra el modal', async () => {
    const pagina = crearPagina();
    await pagina.alMostrarPinDistinto();
    expect(toast).toHaveBeenCalledOnceWith(
      'Digite el mismo valor en las dos opciones',
      'danger',
    );
    expect(cerrarModal).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
  });

  it('omitir: cierra con { omitido: true }', async () => {
    const pagina = crearPagina();
    await pagina.alOmitirPin(modal);
    expect(cerrarModal).toHaveBeenCalledOnceWith({ omitido: true });
  });

  it('willDismiss con { omitido: true } navega a /inicio', () => {
    const pagina = crearPagina();
    pagina.estaModalPinAbierto.set(true);
    pagina.alCerrarModalPin(eventoCierre({ omitido: true }));
    expect(pagina.estaModalPinAbierto()).toBeFalse();
    expect(navegar).toHaveBeenCalledOnceWith(['/inicio']);
  });

  it('willDismiss con { pinCreado: true } navega a /inicio', () => {
    const pagina = crearPagina();
    pagina.alCerrarModalPin(eventoCierre({ pinCreado: true }));
    expect(navegar).toHaveBeenCalledOnceWith(['/inicio']);
  });

  it('willDismiss con { pinCreado: false } no navega', () => {
    const pagina = crearPagina();
    pagina.alCerrarModalPin(eventoCierre({ pinCreado: false }));
    expect(navegar).not.toHaveBeenCalled();
  });

  it('cerrar arrastrando o tocando el fondo (sin datos) no navega y cierra el estado', () => {
    const pagina = crearPagina();
    pagina.estaModalPinAbierto.set(true);
    pagina.alCerrarModalPin(eventoCierre(undefined));
    expect(pagina.estaModalPinAbierto()).toBeFalse();
    expect(navegar).not.toHaveBeenCalled();
  });
});
