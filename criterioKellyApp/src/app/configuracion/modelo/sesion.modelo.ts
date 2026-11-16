import { Rol } from 'src/app/configuracion/modelo/Rol.modelo';
import {
  LoginRequest,
  UsuarioApp,
} from 'src/app/funcionalidad/autenticacion/modelo/Login.modelo';

export interface RespuestaSesion {
  id: number;
  nombres: string;
  apellidos: string;
  roles: Rol[];
  accessToken: string;
  accessExpira: string;
  refreshToken?: string;
}

export interface SolicitudRenovacion {
  refreshToken?: string;
}

export interface RespuestaExitosa {
  success: string;
}

export type EstadoRestauracion = 'pendiente' | 'en_curso' | 'finalizada';

export type CredencialesSesion = LoginRequest;

export function usuarioDesdeRespuesta(respuesta: RespuestaSesion): UsuarioApp {
  return {
    id: respuesta.id,
    nombres: respuesta.nombres,
    apellidos: respuesta.apellidos,
  };
}
