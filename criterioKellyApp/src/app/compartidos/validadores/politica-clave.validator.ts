import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

export const LONGITUD_MINIMA_CLAVE = 10;
export const LONGITUD_MAXIMA_CLAVE = 128;

export type ErroresPoliticaClave = {
  longitudMinima?: true;
  longitudMaxima?: true;
  igualAUsuario?: true;
  igualACorreo?: true;
};

export const MENSAJES_POLITICA_CLAVE: Readonly<
  Record<keyof ErroresPoliticaClave, string>
> = {
  longitudMinima: `La contraseña debe tener al menos ${LONGITUD_MINIMA_CLAVE} caracteres`,
  longitudMaxima: `La contraseña no puede superar ${LONGITUD_MAXIMA_CLAVE} caracteres`,
  igualAUsuario: 'La contraseña no puede ser igual al usuario',
  igualACorreo: 'La contraseña no puede ser igual al correo',
};

export interface ContextoPoliticaClave {
  usuario?: string | null;
  correo?: string | null;
}

export interface OpcionesPoliticaClave {
  campoUsuario?: string;
  campoCorreo?: string;
  usuario?: string | null;
  correo?: string | null;
}

const normalizar = (valor: string): string => valor.trim().toLowerCase();

export function evaluarPoliticaClave(
  clave: string,
  contexto: ContextoPoliticaClave,
): ErroresPoliticaClave | null {
  const longitud = Array.from(clave).length;
  if (longitud < LONGITUD_MINIMA_CLAVE) return { longitudMinima: true };
  if (longitud > LONGITUD_MAXIMA_CLAVE) return { longitudMaxima: true };

  const claveNormalizada = normalizar(clave);
  if (
    contexto.usuario &&
    normalizar(contexto.usuario) &&
    claveNormalizada === normalizar(contexto.usuario)
  ) {
    return { igualAUsuario: true };
  }
  if (
    contexto.correo &&
    normalizar(contexto.correo) &&
    claveNormalizada === normalizar(contexto.correo)
  ) {
    return { igualACorreo: true };
  }
  return null;
}

export function politicaClaveValidator(
  opciones: OpcionesPoliticaClave = {},
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const grupo = control.parent;
    const usuario =
      opciones.usuario ??
      (opciones.campoUsuario
        ? String(grupo?.get(opciones.campoUsuario)?.value ?? '')
        : '');
    const correo =
      opciones.correo ??
      (opciones.campoCorreo
        ? String(grupo?.get(opciones.campoCorreo)?.value ?? '')
        : '');
    const error = evaluarPoliticaClave(String(control.value), {
      usuario,
      correo,
    });
    return error ? { politicaClave: error } : null;
  };
}
