import { TestBed } from '@angular/core/testing';
import {
  CoordinadorPestanasService,
  NOMBRE_BLOQUEO_RENOVACION,
} from './coordinador-pestanas.service';
import { ES_PLATAFORMA_NATIVA } from './plataforma';

describe('CoordinadorPestanasService', () => {
  const descriptorOriginal = Object.getOwnPropertyDescriptor(navigator, 'locks');

  afterEach(() => {
    if (descriptorOriginal) {
      Object.defineProperty(navigator, 'locks', descriptorOriginal);
    } else {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: undefined,
      });
    }
  });

  it('ejecuta la tarea directamente si Web Locks no está disponible', async () => {
    TestBed.configureTestingModule({
      providers: [
        CoordinadorPestanasService,
        { provide: ES_PLATAFORMA_NATIVA, useValue: false },
      ],
    });

    const servicio = TestBed.inject(CoordinadorPestanasService);
    const tarea = jasmine.createSpy('tarea').and.resolveTo('resultado');

    await expectAsync(
      servicio.ejecutarExclusivo(NOMBRE_BLOQUEO_RENOVACION, tarea),
    ).toBeResolvedTo('resultado');

    expect(tarea).toHaveBeenCalledOnceWith();
  });

  it('solicita un bloqueo exclusivo cuando Web Locks está disponible', async () => {
    const solicitar = jasmine
      .createSpy('request')
      .and.callFake(
        async <T>(
          _nombre: string,
          _opciones: LockOptions,
          tarea: () => Promise<T>,
        ) => tarea(),
      );
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: solicitar },
    });

    TestBed.configureTestingModule({
      providers: [
        CoordinadorPestanasService,
        { provide: ES_PLATAFORMA_NATIVA, useValue: false },
      ],
    });

    const servicio = TestBed.inject(CoordinadorPestanasService);
    await servicio.ejecutarExclusivo(
      NOMBRE_BLOQUEO_RENOVACION,
      async () => 'resultado',
    );

    expect(solicitar).toHaveBeenCalledWith(
      NOMBRE_BLOQUEO_RENOVACION,
      { mode: 'exclusive' },
      jasmine.any(Function),
    );
  });

  it('no usa Web Locks en plataforma nativa', async () => {
    const solicitar = jasmine.createSpy('request');
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: solicitar },
    });

    TestBed.configureTestingModule({
      providers: [
        CoordinadorPestanasService,
        { provide: ES_PLATAFORMA_NATIVA, useValue: true },
      ],
    });

    const servicio = TestBed.inject(CoordinadorPestanasService);
    await servicio.ejecutarExclusivo(
      NOMBRE_BLOQUEO_RENOVACION,
      async () => 'resultado',
    );

    expect(solicitar).not.toHaveBeenCalled();
  });
});
