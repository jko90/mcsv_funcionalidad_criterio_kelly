import { TestBed } from '@angular/core/testing';
import { signalStore } from '@ngrx/signals';
import { AccesoPinBloqueo, PinBloqueo } from '../modelos/pin-bloqueo.modelo';
import { generarHashPin, esHashPin } from '../seguridades/hash-pin';
import { conPinBloqueo } from './pin-bloqueo.feature';

class AccesoPinEnMemoria implements AccesoPinBloqueo {
  readonly registros: PinBloqueo[] = [];
  private siguienteId = 1;

  sembrar(pin_idUsuario: number, pin_codigo: string): void {
    this.registros.push({
      pin_idPin: this.siguienteId++,
      pin_codigo,
      pin_idUsuario,
    });
  }

  async obtenerPinBloqueo(pin_idUsuario: number): Promise<PinBloqueo | null> {
    return (
      this.registros.find(
        (registro) => registro.pin_idUsuario === pin_idUsuario,
      ) ?? null
    );
  }

  async agregarPinBloqueo(
    pin_codigo: string,
    pin_idUsuario: number,
  ): Promise<string> {
    this.sembrar(pin_idUsuario, pin_codigo);
    return 'PIN creado correctamente.';
  }

  async editarPinBloqueo(
    pin_codigo: string,
    pin_idPin: number,
    pin_idUsuario: number,
  ): Promise<string> {
    const registro = this.registros.find(
      (item) => item.pin_idPin === pin_idPin && item.pin_idUsuario === pin_idUsuario,
    );
    if (registro) registro.pin_codigo = pin_codigo;
    return 'PIN actualizado correctamente.';
  }

  async eliminarPinBloqueo(pin_idUsuario: number): Promise<string> {
    const indice = this.registros.findIndex(
      (registro) => registro.pin_idUsuario === pin_idUsuario,
    );
    if (indice >= 0) this.registros.splice(indice, 1);
    return 'PIN eliminado correctamente.';
  }
}

interface StorePin {
  isLoading: () => boolean;
  tienePin: () => boolean;
}

const esperarCarga = async (store: StorePin): Promise<void> => {
  const limite = Date.now() + 8000;
  while (store.isLoading() && Date.now() < limite) {
    await new Promise((resolver) => setTimeout(resolver, 20));
  }
  if (store.isLoading()) throw new Error('La operación del PIN no terminó');
};

describe('conPinBloqueo', () => {
  let acceso: AccesoPinEnMemoria;
  let store: ReturnType<typeof crearStore>;

  const crearStore = () => {
    const Store = signalStore(conPinBloqueo(() => acceso));
    TestBed.configureTestingModule({ providers: [Store] });
    return TestBed.inject(Store);
  };

  beforeEach(() => {
    acceso = new AccesoPinEnMemoria();
    store = crearStore();
  });

  it('PB-1: guardarPin persiste un hash y devuelve el mensaje', async () => {
    store.guardarPin({ pin: '123456', idUsuario: 7 });
    await esperarCarga(store);

    expect(acceso.registros.length).toBe(1);
    expect(acceso.registros[0].pin_idUsuario).toBe(7);
    expect(esHashPin(acceso.registros[0].pin_codigo)).toBeTrue();
    expect(store.mensajeOperacion()).toBe('PIN creado correctamente.');
  });

  it('PB-2: verificarPin distingue correcto, incorrecto y sin registro', async () => {
    acceso.sembrar(3, await generarHashPin('123456'));

    store.verificarPin({ pin: '123456', idUsuario: 3 });
    await esperarCarga(store);
    expect(store.resultadoVerificacion()).toBe('correcto');

    store.verificarPin({ pin: '654321', idUsuario: 3 });
    await esperarCarga(store);
    expect(store.resultadoVerificacion()).toBe('incorrecto');

    store.verificarPin({ pin: '123456', idUsuario: 99 });
    await esperarCarga(store);
    expect(store.resultadoVerificacion()).toBe('sin-pin');
  });

  it('PB-3: migra un PIN heredado correcto al hash PBKDF2', async () => {
    acceso.sembrar(4, '123456');

    store.verificarPin({ pin: '123456', idUsuario: 4 });
    await esperarCarga(store);

    expect(store.resultadoVerificacion()).toBe('correcto');
    expect(esHashPin(acceso.registros[0].pin_codigo)).toBeTrue();
    expect(acceso.registros[0].pin_codigo).toMatch(/^pbkdf2-sha256\$310000\$/);
  });

  it('PB-4: no toca un PIN heredado cuando el intento es incorrecto', async () => {
    acceso.sembrar(5, '123456');

    store.verificarPin({ pin: '654321', idUsuario: 5 });
    await esperarCarga(store);

    expect(store.resultadoVerificacion()).toBe('incorrecto');
    expect(acceso.registros[0].pin_codigo).toBe('123456');
  });

  it('PB-5: tienePin refleja el registro cargado y no se expone pin_codigo', async () => {
    acceso.sembrar(6, await generarHashPin('123456'));

    store.cargarPinBloqueo(6);
    await esperarCarga(store);
    expect(store.tienePin()).toBeTrue();
    expect(
      (store as unknown as Record<string, unknown>)['pin_codigo'],
    ).toBeUndefined();

    store.eliminarPinBloqueo(6);
    await esperarCarga(store);
    expect(store.tienePin()).toBeFalse();
    expect(acceso.registros.length).toBe(0);
  });
});
