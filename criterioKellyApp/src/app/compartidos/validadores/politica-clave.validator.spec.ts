import { FormControl, FormGroup } from '@angular/forms';
import {
  MENSAJES_POLITICA_CLAVE,
  evaluarPoliticaClave,
  politicaClaveValidator,
} from './politica-clave.validator';

describe('politicaClaveValidator', () => {
  it('PC-1: rechaza 9 caracteres y acepta 10', () => {
    expect(evaluarPoliticaClave('a'.repeat(9), {})).toEqual({
      longitudMinima: true,
    });
    expect(evaluarPoliticaClave('a'.repeat(10), {})).toBeNull();
  });

  it('PC-2: rechaza 129 caracteres y acepta 128', () => {
    expect(evaluarPoliticaClave('a'.repeat(129), {})).toEqual({
      longitudMaxima: true,
    });
    expect(evaluarPoliticaClave('a'.repeat(128), {})).toBeNull();
  });

  it('PC-3: cuenta puntos de código', () => {
    expect(evaluarPoliticaClave('😀'.repeat(10), {})).toBeNull();
  });

  it('PC-4: rechaza la clave igual al usuario sin distinguir mayúsculas ni espacios', () => {
    expect(
      evaluarPoliticaClave(' JuanPerez10 ', { usuario: 'juanperez10' }),
    ).toEqual({ igualAUsuario: true });
  });

  it('PC-5: rechaza la clave igual al correo y no compara un contexto vacío', () => {
    expect(
      evaluarPoliticaClave('correo@ejemplo.com', {
        correo: 'CORREO@ejemplo.com ',
      }),
    ).toEqual({ igualACorreo: true });
    expect(evaluarPoliticaClave('claveSegura10', { usuario: '  ', correo: '' })).toBeNull();
  });

  it('PC-6: lee los campos hermanos del formulario', () => {
    const grupo = new FormGroup({
      usuario: new FormControl('Usuario123'),
      correo: new FormControl('correo@ejemplo.com'),
      clave: new FormControl('Usuario123', [
        politicaClaveValidator({
          campoUsuario: 'usuario',
          campoCorreo: 'correo',
        }),
      ]),
    });
    grupo.controls.clave.updateValueAndValidity();
    expect(grupo.controls.clave.errors).toEqual({
      politicaClave: { igualAUsuario: true },
    });
  });

  it('publica los mensajes de la política B-02', () => {
    expect(MENSAJES_POLITICA_CLAVE.longitudMinima).toContain('al menos 10');
    expect(MENSAJES_POLITICA_CLAVE.longitudMaxima).toContain('128');
  });
});
