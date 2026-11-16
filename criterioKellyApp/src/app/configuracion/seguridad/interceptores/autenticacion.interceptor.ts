import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, of, Observable, switchMap, throwError } from 'rxjs';
import { UtilitariosService } from '../../../compartidos/servicios/utilitarios.service';
import { ES_PLATAFORMA_NATIVA } from '../../servicio/plataforma';
import {
  ES_REINTENTO_AUTENTICACION,
  URL_AUTENTICAR,
  URL_CERRAR_SESION,
  URL_RENOVAR,
  VALOR_X_CLIENTE_NATIVO,
  VALOR_X_REQUESTED_WITH,
  esUrlApi,
  esUrlSesion,
} from './sesion-http';
import { SesionStore } from 'src/app/configuracion/store/sesion.store';

const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró, vuelve a iniciar sesión';

export const autenticacionInterceptor: HttpInterceptorFn = (req, next) => {
  const sesionStore = inject(SesionStore);
  const router = inject(Router);
  const utilServicio = inject(UtilitariosService);
  const esNativa = inject(ES_PLATAFORMA_NATIVA);

  if (!esUrlApi(req.url)) return next(req);

  const esAutenticar = esUrlSesion(req.url, URL_AUTENTICAR);
  const esRenovar = esUrlSesion(req.url, URL_RENOVAR);
  const esCerrarSesion = esUrlSesion(req.url, URL_CERRAR_SESION);
  const accessToken = sesionStore.accessToken();
  const autorizada = !esAutenticar && !esRenovar && accessToken !== null;
  const esPeticionDeSesion = esAutenticar || esRenovar;

  const solicitudPreparada = prepararSolicitud(
    req,
    accessToken,
    esNativa,
    esAutenticar || esRenovar || esCerrarSesion,
  );

  const enviar = (
    solicitud: HttpRequest<unknown>,
  ): Observable<HttpEvent<unknown>> =>
    next(solicitud).pipe(
      catchError((error: HttpErrorResponse) => {
        const esReintento = solicitud.context.get(ES_REINTENTO_AUTENTICACION);
        const puedeRenovar =
          error.status === 401 &&
          autorizada &&
          !esPeticionDeSesion &&
          !esReintento;

        if (!puedeRenovar) return throwError(() => error);

        const tokenActual = sesionStore.accessToken();
        const tokenEnviado = solicitud.headers
          .get('Authorization')
          ?.replace('Bearer ', '');
        const renovar$ =
          tokenActual && tokenActual !== tokenEnviado
            ? of(tokenActual)
            : (sesionStore.renovacionEnCurso() ?? sesionStore.renovarSesion());

        return renovar$.pipe(
          switchMap((token) =>
            enviar(
              prepararSolicitud(
                solicitud.clone({
                  context: solicitud.context.set(
                    ES_REINTENTO_AUTENTICACION,
                    true,
                  ),
                }),
                token,
                esNativa,
                esCerrarSesion,
              ),
            ),
          ),
          catchError(() =>
            manejarExpiracion(sesionStore, router, utilServicio),
          ),
        );
      }),
    );

  const renovacionActual = sesionStore.renovacionEnCurso();
  if (!esPeticionDeSesion && renovacionActual) {
    return renovacionActual.pipe(
      switchMap((token) =>
        enviar(prepararSolicitud(solicitudPreparada, token, esNativa, false)),
      ),
      catchError(() => manejarExpiracion(sesionStore, router, utilServicio)),
    );
  }

  return enviar(solicitudPreparada);
};

function prepararSolicitud(
  solicitud: HttpRequest<unknown>,
  accessToken: string | null,
  esNativa: boolean,
  usaCredenciales: boolean,
): HttpRequest<unknown> {
  let headers = solicitud.headers.set(
    'X-Requested-With',
    VALOR_X_REQUESTED_WITH,
  );
  if (esNativa) headers = headers.set('X-Cliente', VALOR_X_CLIENTE_NATIVO);
  if (
    accessToken &&
    !esUrlSesion(solicitud.url, URL_AUTENTICAR) &&
    !esUrlSesion(solicitud.url, URL_RENOVAR)
  ) {
    headers = headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return solicitud.clone({
    headers,
    withCredentials: !esNativa && usaCredenciales,
  });
}

function manejarExpiracion(
  sesionStore: {
    estaAutenticado: () => boolean;
    limpiarSesionLocal: () => void;
  },
  router: Router,
  utilServicio: UtilitariosService,
) {
  const estabaAutenticada = sesionStore.estaAutenticado();
  sesionStore.limpiarSesionLocal();
  if (estabaAutenticada) {
    void utilServicio.mostrarToast(MENSAJE_SESION_EXPIRADA, 'warning');
    if (router.url !== '/login' && router.url !== '/registro') {
      void router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
  return EMPTY;
}
