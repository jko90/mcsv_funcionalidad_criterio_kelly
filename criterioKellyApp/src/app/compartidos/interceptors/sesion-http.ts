import { HttpContextToken } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export const URL_AUTENTICAR = `${environment.apiUrlLoge}autenticacion/autenticar`;
export const URL_RENOVAR = `${environment.apiUrlLoge}autenticacion/renovar`;
export const URL_CERRAR_SESION = `${environment.apiUrlLoge}autenticacion/cerrarSesion`;
export const URL_CERRAR_TODAS = `${environment.apiUrlLoge}autenticacion/cerrarTodas`;

export const OMITIR_MANEJO_ERROR = new HttpContextToken<boolean>(() => false);
export const ES_REINTENTO_AUTENTICACION = new HttpContextToken<boolean>(() => false);
export const VALOR_X_REQUESTED_WITH = 'CriterioKelly';
export const VALOR_X_CLIENTE_NATIVO = 'nativo';

export const URLS_API = [
  environment.apiUrlLoge,
  environment.apiUrlCritKell,
  environment.apiUrlSuscripcion,
];

export function esUrlApi(url: string): boolean {
  return URLS_API.some((base) => url.startsWith(base));
}

export function esUrlSesion(url: string, urlSesion: string): boolean {
  return url.split('?')[0] === urlSesion;
}
