export interface ActualizarPerfilRequest {
  nombres: string;
  apellidos: string;
  telefono: string;
}

export interface ActualizarPerfilResponse {
  id_usuario?: number;
  nombres?: string;
  apellidos?: string;
  telefono?: string;
  error?: string;
}

export interface CambiarClaveRequest {
  claveActual: string;
  claveNueva: string;
}

export interface CambiarClaveResponse {
  success?: string;
  error?: string;
}

// Constantes para validación
export const VALIDACIONES = {
  TELEFONO_REGEX: /^[0-9]{10}$/,
  MIN_LENGTH_NOMBRES: 2,
  MIN_LENGTH_APELLIDOS: 2,
} as const;
