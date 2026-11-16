import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { ServicioAutenticacion } from 'src/app/configuracion/seguridad/servicio/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DbPINAppStore } from 'src/app/compartidos/store/dbPIN-app.store';
import { DbPINWebStore } from 'src/app/compartidos/store/dbPIN-web.store';
import { SolicitudPin } from 'src/app/funcionalidad/autenticacion/modelo/pin-bloqueo.modelo';
import { PinFormularioStore } from './pin-formulario.store';

// Valores de prueba obvios: ningún PIN real aparece en este archivo.
const PIN_DE_PRUEBA = '111111';
const ID_USUARIO_DE_PRUEBA = 7;

function crearAlmacenSimulado() {
  const cargando = signal(false);
  const error = signal<string | null>(null);
  const mensaje = signal<string | null>(null);
  const guardarPin = jasmine
    .createSpy('guardarPin')
    .and.callFake((_: SolicitudPin) => {
      cargando.set(true);
      setTimeout(() => cargando.set(false), 0);
    });
  return {
    guardarPin,
    isLoading: cargando,
    errorMessage: error,
    mensajeOperacion: mensaje,
    definirResultado(
      textoError: string | null,
      textoMensaje: string | null,
    ): void {
      error.set(textoError);
      mensaje.set(textoMensaje);
    },
  };
}

describe('PinFormularioStore', () => {
  let almacenWeb: ReturnType<typeof crearAlmacenSimulado>;
  let almacenNativo: ReturnType<typeof crearAlmacenSimulado>;
  let usuario: { id: number } | null;

  function crearStore(plataforma: string) {
    spyOn(Capacitor, 'getPlatform').and.returnValue(plataforma);
    TestBed.configureTestingModule({
      providers: [
        { provide: DbPINWebStore, useValue: almacenWeb },
        { provide: DbPINAppStore, useValue: almacenNativo },
        {
          provide: ServicioAutenticacion,
          useValue: { obtenerUsuarioActual: () => usuario },
        },
        {
          provide: UtilitariosService,
          useValue: {
            esperarCargaDeStore: async (estaCargando: () => boolean) => {
              while (estaCargando()) await new Promise((r) => setTimeout(r, 1));
            },
          },
        },
      ],
    });
    return TestBed.inject(PinFormularioStore);
  }

  async function esperarFin(store: {
    guardando: () => boolean;
  }): Promise<void> {
    for (let i = 0; i < 200 && store.guardando(); i++)
      await new Promise((r) => setTimeout(r, 1));
  }

  beforeEach(() => {
    almacenWeb = crearAlmacenSimulado();
    almacenNativo = crearAlmacenSimulado();
    usuario = { id: ID_USUARIO_DE_PRUEBA };
  });

  it('en web guarda por el almacén web y termina en creado', async () => {
    const store = crearStore('web');
    almacenWeb.definirResultado(null, 'PIN creado correctamente.');
    store.guardar(PIN_DE_PRUEBA);
    expect(store.guardando()).toBeTrue();
    await esperarFin(store);

    expect(almacenWeb.guardarPin).toHaveBeenCalledOnceWith({
      pin: PIN_DE_PRUEBA,
      idUsuario: ID_USUARIO_DE_PRUEBA,
    });
    expect(almacenNativo.guardarPin).not.toHaveBeenCalled();
    expect(store.resultado()).toBe('creado');
    expect(store.pinCreado()).toBeTrue();
    expect(store.mensajeResultado()).toBe('PIN creado correctamente.');
    expect(store.colorAviso()).toBe('success');
    expect(store.guardando()).toBeFalse();
  });

  it('en nativo guarda por el almacén nativo', async () => {
    const store = crearStore('android');
    store.guardar(PIN_DE_PRUEBA);
    await esperarFin(store);

    expect(almacenNativo.guardarPin).toHaveBeenCalledTimes(1);
    expect(almacenWeb.guardarPin).not.toHaveBeenCalled();
    expect(store.resultado()).toBe('creado');
  });

  it('si el almacén informa error el resultado es error con aviso de peligro', async () => {
    const store = crearStore('web');
    almacenWeb.definirResultado('No se pudo guardar el PIN', null);
    store.guardar(PIN_DE_PRUEBA);
    await esperarFin(store);

    expect(store.resultado()).toBe('error');
    expect(store.pinCreado()).toBeFalse();
    expect(store.errorMessage()).toBe('No se pudo guardar el PIN');
    expect(store.mensajeResultado()).toBe('No se pudo guardar el PIN');
    expect(store.colorAviso()).toBe('danger');
    expect(store.guardando()).toBeFalse();
  });

  it('sin sesión usa el usuario 0, como antes', async () => {
    usuario = null;
    const store = crearStore('web');
    store.guardar(PIN_DE_PRUEBA);
    await esperarFin(store);
    expect(almacenWeb.guardarPin).toHaveBeenCalledWith({
      pin: PIN_DE_PRUEBA,
      idUsuario: 0,
    });
  });

  it('un guardado nuevo limpia el resultado anterior', async () => {
    const store = crearStore('web');
    almacenWeb.definirResultado('fallo', null);
    store.guardar(PIN_DE_PRUEBA);
    await esperarFin(store);
    almacenWeb.definirResultado(null, 'ok');
    store.guardar(PIN_DE_PRUEBA);
    expect(store.resultado()).toBeNull();
    await esperarFin(store);
    expect(store.resultado()).toBe('creado');
  });
});
