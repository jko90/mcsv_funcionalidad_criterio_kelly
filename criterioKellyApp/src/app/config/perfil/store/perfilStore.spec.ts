import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { ErrorApi } from 'src/app/nucleo/modelo/error-api';
import { PerfilService } from '../servicios/perfil.service';
import { PerfilStore } from './perfilStore';

describe('PerfilStore', () => {
  it('AJ-1: con la clave actual incorrecta guarda el mensaje del servidor', () => {
    const perfilServicioDoble = jasmine.createSpyObj<PerfilService>(
      'PerfilService',
      ['cambiarClave'],
    );
    perfilServicioDoble.cambiarClave.and.returnValue(
      throwError(() => new ErrorApi('La clave actual no es correcta', 400)),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: PerfilService, useValue: perfilServicioDoble }],
    });
    const store = TestBed.inject(PerfilStore);

    store.cambiarClave({
      claveActual: 'incorrecta',
      claveNueva: 'NuevaClaveSegura1',
    });

    expect(store.errorCambioClave()).toBe('La clave actual no es correcta');
    expect(store.respuestaClave()).toBeNull();
    expect(store.cargandoCambioContrasena()).toBeFalse();
  });
});
