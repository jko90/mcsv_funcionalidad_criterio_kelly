import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { UtilitariosService } from '../../servicios/utilitarios.service';
import { catchError, throwError } from 'rxjs';
import { ErrorApi } from '../../modelos/error-api';
import { OMITIR_MANEJO_ERROR } from './sesion-http';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const utilServicio = inject(UtilitariosService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        req.context.get(OMITIR_MANEJO_ERROR) ||
        (error.status === 401 && req.headers.has('Authorization'))
      ) {
        return throwError(() => error);
      }

      let mensaje = 'Error desconocido';

      if (error.status === 403) {
        mensaje = 'Acceso denegado';
      } else if (error.status === 429) {
        mensaje = mensajePorReintento(error);
      } else if (error.error?.error) {
        mensaje = error.error.error;
      } else {
        switch (error.status) {
          case 0:
            mensaje = 'Error de conexión. Verifique su conexión a internet.';
            break;
          case 400:
            mensaje = 'Datos inválidos proporcionados';
            break;
          case 401:
            mensaje = 'No autorizado para realizar esta acción';
            break;
          case 404:
            mensaje = error.error?.error || 'Recurso no encontrado';
            break;
          case 408:
            mensaje = 'Tiempo de espera agotado. Intente nuevamente.';
            break;
          case 409:
            mensaje = 'Conflicto de datos. Verifique la información enviada.';
            break;
          case 422:
            mensaje = 'Has llegado al límite de pérdida, recargue la cuenta para seguir intentando.';
            break;
          default:
            if (error.status >= 500) {
              mensaje = 'Error del servidor. Intente más tarde.';
            }
            break;
        }
      }

      utilServicio.mostrarToast(mensaje, 'danger');
      return throwError(() => new ErrorApi(mensaje, error.status));
    }),
  );
};

function mensajePorReintento(error: HttpErrorResponse): string {
  const cabecera = error.headers.get('Retry-After');
  if (!cabecera) {
    return (
      error.error?.error ||
      'Demasiados intentos, intente nuevamente más tarde'
    );
  }
  const segundos = Number(cabecera);
  if (!Number.isInteger(segundos) || segundos <= 0) {
    return (
      error.error?.error ||
      'Demasiados intentos, intente nuevamente más tarde'
    );
  }
  if (segundos >= 60) {
    const minutos = Math.ceil(segundos / 60);
    return `Demasiados intentos. Intente nuevamente en ${minutos} minuto${minutos === 1 ? '' : 's'}.`;
  }
  return `Demasiados intentos. Intente nuevamente en ${segundos} segundos.`;
}
