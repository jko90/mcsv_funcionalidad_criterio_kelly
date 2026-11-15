import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { RecuperacionClaveService } from '../servicios/recuperacion-clave.service';
import { RecuperacionClaveStore } from './recuperacion-clave.store';

describe('RecuperacionClaveStore', () => {
  let servicio: jasmine.SpyObj<RecuperacionClaveService>;
  let store: InstanceType<typeof RecuperacionClaveStore>;

  const esperarCarga = async (): Promise<void> => {
    const limite = Date.now() + 3000;
    while (store.isLoading() && Date.now() < limite) {
      await new Promise((resolver) => setTimeout(resolver, 10));
    }
    if (store.isLoading()) throw new Error('La operación no terminó');
  };

  beforeEach(() => {
    servicio = jasmine.createSpyObj<RecuperacionClaveService>(
      'RecuperacionClaveService',
      ['solicitarRecuperacion', 'restablecerClave'],
    );
    TestBed.configureTestingModule({
      providers: [{ provide: RecuperacionClaveService, useValue: servicio }],
    });
    store = TestBed.inject(RecuperacionClaveStore);
  });

  it('RC-1: solicitarCodigo guarda el mensaje y avanza al paso de código', async () => {
    servicio.solicitarRecuperacion.and.returnValue(
      of({ mensaje: 'Si el correo está registrado, recibirás un código.' }),
    );

    store.solicitarCodigo('trader@ejemplo.com');
    await esperarCarga();

    expect(store.paso()).toBe('restablecer');
    expect(store.correo()).toBe('trader@ejemplo.com');
    expect(store.mensajeSolicitud()).toBe(
      'Si el correo está registrado, recibirás un código.',
    );
    expect(store.errorMessage()).toBeNull();
  });

  it('RC-2: un error mantiene el paso de solicitud y guarda el mensaje', async () => {
    servicio.solicitarRecuperacion.and.returnValue(
      throwError(() => new Error('No se pudo enviar la solicitud')),
    );

    store.solicitarCodigo('trader@ejemplo.com');
    await esperarCarga();

    expect(store.paso()).toBe('solicitar');
    expect(store.errorMessage()).toBe('No se pudo enviar la solicitud');
  });

  it('RC-3: restablecerClave envía correo, código y clave nueva, y completa', async () => {
    servicio.solicitarRecuperacion.and.returnValue(of({ mensaje: 'Enviado' }));
    servicio.restablecerClave.and.returnValue(of({ success: 'ok' }));

    store.solicitarCodigo('trader@ejemplo.com');
    await esperarCarga();
    store.restablecerClave({
      codigo: '123456',
      claveNueva: 'ClaveDePrueba2026',
    });
    await esperarCarga();

    expect(servicio.restablecerClave).toHaveBeenCalledWith({
      correo: 'trader@ejemplo.com',
      codigo: '123456',
      claveNueva: 'ClaveDePrueba2026',
    });
    expect(store.paso()).toBe('completado');
  });

  it('RC-4: volverASolicitar conserva el correo y reiniciar limpia el estado', async () => {
    servicio.solicitarRecuperacion.and.returnValue(of({ mensaje: 'Enviado' }));

    store.solicitarCodigo('trader@ejemplo.com');
    await esperarCarga();
    store.volverASolicitar();

    expect(store.paso()).toBe('solicitar');
    expect(store.correo()).toBe('trader@ejemplo.com');

    store.reiniciar();
    expect(store.paso()).toBe('solicitar');
    expect(store.correo()).toBe('');
    expect(store.mensajeSolicitud()).toBeNull();
    expect(store.errorMessage()).toBeNull();
  });
});
