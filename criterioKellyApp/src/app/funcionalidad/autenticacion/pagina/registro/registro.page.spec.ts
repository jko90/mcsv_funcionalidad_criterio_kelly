import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { PersonaStore } from '../../store/personaStore';
import { PlanesModelo } from '../../../../negocio/suscripcion/modelos/Planes.modelo';
import { PlanesStore } from '../../../../negocio/suscripcion/store/PlanesStore';
import { RegistroPage } from './registro.page';

describe('RegistroPage · habilitación de pasos', () => {
  let pagina: RegistroPage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    pagina = TestBed.runInInjectionContext(() => new RegistroPage());
  });

  it('deshabilita el paso personal con el formulario vacío', () => {
    expect(pagina.pasoPersonalValido()).toBeFalsy();
  });

  it('habilita el paso personal al llenar los datos personales', () => {
    pagina.registroForm.patchValue({
      nombres: 'Ana',
      apellidos: 'Pérez',
      telefono: '0999000111',
      correo: 'ana@ejemplo.com',
    });

    expect(pagina.pasoPersonalValido()).toBeTruthy();
  });

  it('vuelve a deshabilitar el paso personal si un dato deja de ser válido', () => {
    pagina.registroForm.patchValue({
      nombres: 'Ana',
      apellidos: 'Pérez',
      telefono: '0999000111',
      correo: 'ana@ejemplo.com',
    });
    expect(pagina.pasoPersonalValido()).toBeTruthy();

    pagina.registroForm.patchValue({ correo: 'no-es-correo' });

    expect(pagina.pasoPersonalValido()).toBeFalsy();
  });

  it('habilita el paso de cuenta con usuario y clave válidos que coinciden', () => {
    expect(pagina.pasoCuentaValido()).toBeFalsy();

    pagina.registroForm.patchValue({
      usuario: 'ana_perez',
      contrasena: 'Cielo-Rojo-Montana-77',
      confirmarContrasena: 'Cielo-Rojo-Montana-77',
    });

    expect(pagina.pasoCuentaValido()).toBeTruthy();
  });

  it('mantiene deshabilitado el paso de cuenta si las claves no coinciden', () => {
    pagina.registroForm.patchValue({
      usuario: 'ana_perez',
      contrasena: 'Cielo-Rojo-Montana-77',
      confirmarContrasena: 'otra-clave-distinta',
    });

    expect(pagina.pasoCuentaValido()).toBeFalsy();
  });
});

describe('RegistroPage · plan pendiente tras el registro', () => {
  function crearPagina(precioFinal: number): RegistroPage {
    const personaDoble = {
      registroExitoso: signal(true),
      isLoading: signal(false),
      errorMessage: signal<string | null>(null),
      respuestaRegistro: signal(null),
      limpiar: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PersonaStore, useValue: personaDoble },
      ],
    });
    TestBed.inject(PlanesStore).seleccionarPlanPorObjeto({
      pin_idPlanInterv: 5,
      pin_precioFinal: precioFinal,
      pla_nombre: 'Pro',
      ins_nombre: 'Mensual',
    } as PlanesModelo);
    return TestBed.runInInjectionContext(() => new RegistroPage());
  }

  it('RG-1: con un plan de pago muestra que quedará pendiente de pago', () => {
    const pagina = crearPagina(20);

    expect(pagina.mensajePlanPendiente()).toBe(
      'Tu plan Pro quedará pendiente de pago: se activará cuando el administrador valide tu comprobante',
    );
  });

  it('RG-2: con plan Libre no muestra el mensaje', () => {
    const pagina = crearPagina(0);

    expect(pagina.mensajePlanPendiente()).toBeNull();
  });
});
