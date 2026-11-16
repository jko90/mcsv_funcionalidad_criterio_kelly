import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SesionStore } from './sesion.store';
import { AlmacenSeguroService } from '../servicios/almacen-seguro.service';
import { SesionService } from '../servicios/sesion.service';
import { CoordinadorPestanasService } from '../servicios/coordinador-pestanas.service';
import { ES_PLATAFORMA_NATIVA } from '../servicios/plataforma';

describe('SesionStore', () => {
  it('inicia sin access persistido y sin renovación en curso', () => {
    TestBed.configureTestingModule({
      providers: [
        SesionStore,
        {
          provide: AlmacenSeguroService,
          useValue: {
            hayCierrePendiente: () => false,
            leerRefresh: () => Promise.resolve(null),
            eliminarRefresh: () => Promise.resolve(),
            guardarRefresh: () => Promise.resolve(),
            limpiarCierrePendiente: () => undefined,
          },
        },
        {
          provide: SesionService,
          useValue: {
            autenticar: () => of(),
            renovar: () => of(),
            cerrarSesion: () => of({ success: 'ok' }),
            cerrarTodas: () => of({ success: 'ok' }),
          },
        },
        {
          provide: CoordinadorPestanasService,
          useValue: {
            mensajes$: of(),
            ejecutarExclusivo: async <T>(_: string, operacion: () => Promise<T>) =>
              operacion(),
            publicar: () => undefined,
          },
        },
        { provide: ES_PLATAFORMA_NATIVA, useValue: false },
      ],
    });

    const store = TestBed.inject(SesionStore);
    expect(store.accessToken()).toBeNull();
    expect(store.estaAutenticado()).toBeFalse();
    expect(store.renovacionEnCurso()).toBeNull();
  });
});
