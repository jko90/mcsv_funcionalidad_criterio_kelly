import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { VerificacionCorreoService } from '../servicio/verificacion-correo.service';
import { VerificacionCorreoStore } from './verificacion-correo.store';

describe('VerificacionCorreoStore', () => {
  let servicioDoble: jasmine.SpyObj<VerificacionCorreoService>;

  function crearStore(): InstanceType<typeof VerificacionCorreoStore> {
    TestBed.configureTestingModule({
      providers: [
        { provide: VerificacionCorreoService, useValue: servicioDoble },
      ],
    });
    return TestBed.inject(VerificacionCorreoStore);
  }

  beforeEach(() => {
    servicioDoble = jasmine.createSpyObj<VerificacionCorreoService>(
      'VerificacionCorreoService',
      ['activarCuenta', 'reenviarCodigo'],
    );
  });

  it('VC-1: activa la cuenta con exactamente correo y código', () => {
    servicioDoble.activarCuenta.and.returnValue(of({ success: 'ok' }));
    const store = crearStore();

    store.activarCuenta({ correo: 'a@b.com', codigo: '123456' });

    expect(servicioDoble.activarCuenta).toHaveBeenCalledWith({
      correo: 'a@b.com',
      codigo: '123456',
    });
    expect(store.paso()).toBe('activada');
    expect(store.errorMessage()).toBeNull();
    expect(store.isLoading()).toBeFalse();
  });

  it('VC-2: un error de activación conserva el paso y guarda el mensaje', () => {
    servicioDoble.activarCuenta.and.returnValue(
      throwError(() => new Error('Código inválido o vencido')),
    );
    const store = crearStore();

    store.activarCuenta({ correo: 'a@b.com', codigo: '000000' });

    expect(store.paso()).toBe('codigo');
    expect(store.errorMessage()).toBe('Código inválido o vencido');
    expect(store.isLoading()).toBeFalse();
  });

  it('VC-3: el reenvío guarda mensaje, correo y enfriamiento de 60 s', () => {
    servicioDoble.reenviarCodigo.and.returnValue(of({ mensaje: 'texto' }));
    const store = crearStore();

    store.reenviarCodigo('a@b.com');

    expect(store.mensajeReenvio()).toBe('texto');
    expect(store.correo()).toBe('a@b.com');
    expect(store.reenvioDisponibleEn()).toBeGreaterThanOrEqual(
      Date.now() + 59000,
    );
  });

  it('VC-4: un error de reenvío no cambia el enfriamiento', () => {
    servicioDoble.reenviarCodigo.and.returnValue(
      throwError(() => new Error('Demasiados intentos, intente más tarde')),
    );
    const store = crearStore();
    store.iniciar({ correo: '', codigoEnviado: false });

    store.reenviarCodigo('a@b.com');

    expect(store.errorMessage()).toBe('Demasiados intentos, intente más tarde');
    expect(store.reenvioDisponibleEn()).toBe(0);
    expect(store.mensajeReenvio()).toBeNull();
  });

  it('VC-5: iniciar fija correo y enfriamiento según el código enviado', () => {
    const store = crearStore();

    store.iniciar({ correo: 'x@y.com', codigoEnviado: true });
    expect(store.correo()).toBe('x@y.com');
    expect(store.paso()).toBe('codigo');
    expect(store.reenvioDisponibleEn()).toBeGreaterThanOrEqual(
      Date.now() + 59000,
    );

    store.iniciar({ correo: '', codigoEnviado: false });
    expect(store.correo()).toBe('');
    expect(store.reenvioDisponibleEn()).toBe(0);
  });

  it('VC-6: reiniciar devuelve el estado inicial completo', () => {
    servicioDoble.reenviarCodigo.and.returnValue(of({ mensaje: 'texto' }));
    const store = crearStore();
    store.reenviarCodigo('a@b.com');

    store.reiniciar();

    expect(store.paso()).toBe('codigo');
    expect(store.correo()).toBe('');
    expect(store.mensajeReenvio()).toBeNull();
    expect(store.reenvioDisponibleEn()).toBe(0);
    expect(store.isLoading()).toBeFalse();
    expect(store.errorMessage()).toBeNull();
  });
});
