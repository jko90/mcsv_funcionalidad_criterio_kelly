import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import type { IonModal } from '@ionic/angular/standalone';
import type { OverlayEventDetail } from '@ionic/core';
import { ServicioAutenticacion } from 'src/app/configuracion/seguridad/servicio/ServicioAutenticacion';
import { ServicioInactividad } from 'src/app/configuracion/seguridad/servicio/ServicioInactividad';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DbPINAppStore } from 'src/app/compartidos/store/dbPIN-app.store';
import { DbPINWebStore } from 'src/app/compartidos/store/dbPIN-web.store';
import { PinFormularioStore } from '../../store/pin-formulario.store';
import { CambiarPinPage } from './cambiar-pin.page';

// Valor de prueba obvio: ningún PIN real aparece en este archivo.
const PIN_DE_PRUEBA = '111111';

describe('CambiarPinPage · modal del PIN', () => {
  let llamadas: string[];
  let navegar: jasmine.Spy;
  let guardar: jasmine.Spy;
  let toast: jasmine.Spy;
  let cerrarModal: jasmine.Spy;
  let modal: IonModal;
  let pinCreado: ReturnType<typeof signal<boolean>>;
  let colorAviso: ReturnType<typeof signal<'success' | 'danger'>>;

  function crearPagina(): CambiarPinPage {
    llamadas = [];
    navegar = jasmine.createSpy('navigateForward').and.resolveTo(true);
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
    colorAviso = signal<'success' | 'danger'>('success');

    TestBed.configureTestingModule({
      providers: [
        { provide: NavController, useValue: { navigateForward: navegar } },
        {
          provide: ServicioAutenticacion,
          useValue: { obtenerUsuarioActual: () => ({ id: 1 }) },
        },
        { provide: ServicioInactividad, useValue: {} },
        {
          provide: UtilitariosService,
          useValue: {
            mostrarToast: toast,
            esperarCargaDeStore: () => Promise.resolve(),
          },
        },
        { provide: DbPINWebStore, useValue: {} },
        { provide: DbPINAppStore, useValue: {} },
        {
          provide: PinFormularioStore,
          useValue: {
            guardar,
            guardando: signal(false),
            isLoading: signal(false),
            mensajeResultado: signal('PIN creado correctamente.'),
            colorAviso,
            pinCreado,
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new CambiarPinPage());
  }

  const eventoCierre = (datos?: unknown) =>
    ({ detail: { data: datos } }) as CustomEvent<OverlayEventDetail>;

  it('crear el PIN: guarda, avisa y cierra con { pinCreado: true }', async () => {
    const pagina = crearPagina();
    await pagina.alConfirmarPin(PIN_DE_PRUEBA, modal);
    expect(toast).toHaveBeenCalledOnceWith(
      'PIN creado correctamente.',
      'success',
    );
    expect(cerrarModal).toHaveBeenCalledOnceWith({ pinCreado: true });
    expect(llamadas).toEqual(['guardar', 'toast', 'dismiss']);
  });

  it('error al guardar: cierra con { pinCreado: false }', async () => {
    const pagina = crearPagina();
    pinCreado.set(false);
    colorAviso.set('danger');
    await pagina.alConfirmarPin(PIN_DE_PRUEBA, modal);
    expect(toast).toHaveBeenCalledOnceWith(
      'PIN creado correctamente.',
      'danger',
    );
    expect(cerrarModal).toHaveBeenCalledOnceWith({ pinCreado: false });
  });

  it('valores distintos: aviso de peligro sin cerrar', async () => {
    const pagina = crearPagina();
    await pagina.alMostrarPinDistinto();
    expect(toast).toHaveBeenCalledOnceWith(
      'Digite el mismo valor en las dos opciones',
      'danger',
    );
    expect(cerrarModal).not.toHaveBeenCalled();
  });

  it('omitir: cierra con { omitido: true }', async () => {
    const pagina = crearPagina();
    await pagina.alOmitirPin(modal);
    expect(cerrarModal).toHaveBeenCalledOnceWith({ omitido: true });
  });

  for (const [descripcion, datos] of [
    ['omitido', { omitido: true }],
    ['pinCreado verdadero', { pinCreado: true }],
    ['pinCreado falso', { pinCreado: false }],
    ['arrastrar o tocar el fondo (sin datos)', undefined],
  ] as const) {
    it(`willDismiss con ${descripcion} navega a /inicio y cierra el estado`, async () => {
      const pagina = crearPagina();
      pagina.estaModalPinAbierto.set(true);
      await pagina.alCerrarModalPin(eventoCierre(datos));
      expect(pagina.estaModalPinAbierto()).toBeFalse();
      expect(navegar).toHaveBeenCalledOnceWith('/inicio');
    });
  }
});
