import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { EstadoAplicacionStore } from './estado-aplicacion.store';

describe('EstadoAplicacionStore', () => {
  let versionUpdates: Subject<unknown>;
  let unrecoverable: Subject<unknown>;
  let comprobarActualizacion: jasmine.Spy;

  function crearStore(isEnabled: boolean) {
    versionUpdates = new Subject<unknown>();
    unrecoverable = new Subject<unknown>();
    comprobarActualizacion = jasmine.createSpy('checkForUpdate').and.resolveTo(false);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: { isEnabled, versionUpdates, unrecoverable, checkForUpdate: comprobarActualizacion },
        },
      ],
    });
    return TestBed.inject(EstadoAplicacionStore);
  }

  it('EA-1 el evento offline pone estaEnLinea en false', () => {
    const store = crearStore(true);
    store.monitorearConexion();
    window.dispatchEvent(new Event('offline'));
    expect(store.estaEnLinea()).toBeFalse();
  });

  it('EA-2 el evento online pone estaEnLinea en true', () => {
    const store = crearStore(true);
    store.monitorearConexion();
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(store.estaEnLinea()).toBeTrue();
  });

  it('EA-3 VERSION_READY marca hayVersionNueva', () => {
    const store = crearStore(true);
    store.monitorearActualizaciones();
    versionUpdates.next({ type: 'VERSION_READY' });
    expect(store.hayVersionNueva()).toBeTrue();
    store.marcarVersionAtendida();
    expect(store.hayVersionNueva()).toBeFalse();
  });

  it('EA-4 unrecoverable marca requiereRecarga y sin SW no comprueba versiones', () => {
    const store = crearStore(true);
    store.monitorearActualizaciones();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE' });
    expect(store.requiereRecarga()).toBeTrue();

    TestBed.resetTestingModule();
    const storeSinSw = crearStore(false);
    storeSinSw.monitorearActualizaciones();
    expect(comprobarActualizacion).not.toHaveBeenCalled();
  });
});
