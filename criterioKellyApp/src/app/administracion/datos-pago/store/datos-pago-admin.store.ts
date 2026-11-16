import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  finalize,
  from,
  mergeMap,
  Observable,
  of,
  pipe,
  switchMap,
  tap,
} from 'rxjs';
import { ErrorApi } from 'src/app/compartidos/modelos/error-api';
import { desescaparEntidades } from 'src/app/paginas/suscripcion/configuracion/textos-pago';
import { DatosPagoService } from 'src/app/paginas/suscripcion/servicios/datos-pago.service';
import { mensajeErrorArchivoQr } from '../configuracion/validadores-pago';
import {
  CambioEstadoMetodo,
  CambioEstadoRed,
  CuerpoGuardarBanco,
  CuerpoGuardarPaypal,
  CuerpoGuardarRed,
  DatosPagoAdministracion,
  MetodoPagoAdmin,
  RedUsdtAdmin,
  RedUsdtConQr,
  SubidaQr,
} from '../modelos/DatosPagoAdmin.modelo';
import { AdministracionDatosPagoService } from '../servicios/administracion-datos-pago.service';

const ESTADO_ACCESO_DENEGADO = 403;
const MENSAJE_ERROR_CARGA = 'No se pudieron cargar los datos de pago';
const MENSAJE_ERROR_GUARDADO = 'No se pudo guardar el cambio';

const MENSAJE_RED_GUARDADA = 'Red guardada';
const MENSAJE_RED_ACTUALIZADA = 'Estado de la red actualizado';
const MENSAJE_RED_ELIMINADA = 'Red eliminada';
const MENSAJE_PAYPAL_GUARDADO = 'Datos de PayPal guardados';
const MENSAJE_BANCO_GUARDADO = 'Datos de transferencia guardados';
const MENSAJE_METODO_ACTUALIZADO = 'Método actualizado';
const MENSAJE_QR_GUARDADO = 'Código QR guardado';
const MENSAJE_QR_QUITADO = 'Código QR quitado';

// La URL de objeto vive solo en memoria y se revoca al reemplazarla o salir de la pantalla.
interface QrCargado {
  hash: string;
  url: string;
}

type DatosPagoAdminEstado = {
  metodos: MetodoPagoAdmin[];
  redes: RedUsdtAdmin[];
  qrCargados: Record<string, QrCargado>;
  idRedEnEdicion: number | null;
  idRedQr: number | null;
  vistaPreviaQr: string | null;
  haCargado: boolean;
  guardando: boolean;
  accesoDenegado: boolean;
  resultado: string | null;
  loading: boolean;
  error: string | null;
};

const estadoInicial: DatosPagoAdminEstado = {
  metodos: [],
  redes: [],
  qrCargados: {},
  idRedEnEdicion: null,
  idRedQr: null,
  vistaPreviaQr: null,
  haCargado: false,
  guardando: false,
  accesoDenegado: false,
  resultado: null,
  loading: false,
  error: null,
};

interface OpcionesEscritura {
  mensajeExito: string;
  alExito?: () => void;
}

function estadoHttpDeError(error: unknown): number | null {
  if (error instanceof ErrorApi) return error.estado;
  if (error instanceof HttpErrorResponse) return error.status;
  return null;
}

// El interceptor ya mostró el mensaje del servidor; aquí se conserva para la pantalla.
function mensajeDeError(error: unknown, mensajePorDefecto: string): string {
  return error instanceof Error && error.message !== '' ? error.message : mensajePorDefecto;
}

function buscarMetodo(metodos: MetodoPagoAdmin[], codigo: string): MetodoPagoAdmin | null {
  return metodos.find((metodo) => metodo.mep_codigo === codigo) ?? null;
}

function desescaparOpcional(texto: string | null): string | null {
  return typeof texto === 'string' ? desescaparEntidades(texto) : null;
}

function desescaparTextosBanco(metodo: MetodoPagoAdmin): MetodoPagoAdmin {
  return {
    ...metodo,
    mep_bancoPlantilla: desescaparOpcional(metodo.mep_bancoPlantilla),
    mep_bancoTitular: desescaparOpcional(metodo.mep_bancoTitular),
    mep_bancoEntidad: desescaparOpcional(metodo.mep_bancoEntidad),
    mep_bancoPaisMoneda: desescaparOpcional(metodo.mep_bancoPaisMoneda),
    mep_bancoObservaciones: desescaparOpcional(metodo.mep_bancoObservaciones),
  };
}

function revocarUrls(qrCargados: Record<string, QrCargado>): void {
  Object.values(qrCargados).forEach((qr) => URL.revokeObjectURL(qr.url));
}

export const DatosPagoAdminStore = signalStore(
  { providedIn: 'root' },
  withState<DatosPagoAdminEstado>(estadoInicial),
  withComputed(
    ({
      loading,
      error,
      redes,
      metodos,
      qrCargados,
      idRedEnEdicion,
      idRedQr,
      vistaPreviaQr,
      guardando,
      haCargado,
    }) => {
      const listaRedes = computed<RedUsdtConQr[]>(() =>
        redes().map((red) => ({
          ...red,
          // El servidor guarda los textos escapados: se desescapan para no escaparlos dos veces al editar.
          red_nombre: desescaparEntidades(red.red_nombre),
          red_etiqueta: desescaparEntidades(red.red_etiqueta),
          urlQr: qrCargados()[red.red_clave]?.url ?? null,
        })),
      );
      const metodoPaypal = computed(() => buscarMetodo(metodos(), 'PAYPAL'));
      const metodoBanco = computed(() => {
        const metodo = buscarMetodo(metodos(), 'BANCO');
        return metodo === null ? null : desescaparTextosBanco(metodo);
      });

      return {
        isLoading: computed(() => loading()),
        errorMessage: computed(() => error()),
        listaRedes,
        metodoCripto: computed(() => buscarMetodo(metodos(), 'CRIPTOMONEDA')),
        metodoPaypal,
        metodoBanco,
        redEnEdicion: computed(
          () => listaRedes().find((red) => red.red_idRed === idRedEnEdicion()) ?? null,
        ),
        redQrSeleccionada: computed(
          () => listaRedes().find((red) => red.red_idRed === idRedQr()) ?? null,
        ),
        puedeConfirmarQr: computed(
          () => vistaPreviaQr() !== null && idRedQr() !== null && !guardando(),
        ),
        // Nada cargado todavía: se avisa que los usuarios verán los métodos como no disponibles.
        estaSinDatos: computed(
          () =>
            haCargado() &&
            redes().length === 0 &&
            (metodoPaypal()?.mep_paypalCorreo ?? '') === '' &&
            (metodoPaypal()?.mep_paypalEnlace ?? '') === '' &&
            (metodoBanco()?.mep_bancoNumero ?? '') === '',
        ),
      };
    },
  ),
  withMethods(
    (
      store,
      servicio = inject(AdministracionDatosPagoService),
      servicioQr = inject(DatosPagoService),
    ) => {
      const registrarError = (error: unknown, mensajePorDefecto: string): null => {
        patchState(store, {
          error: mensajeDeError(error, mensajePorDefecto),
          accesoDenegado: estadoHttpDeError(error) === ESTADO_ACCESO_DENEGADO,
        });
        return null;
      };

      const necesitaQr = (red: RedUsdtAdmin): boolean =>
        red.tieneQr &&
        red.qrHash !== null &&
        store.qrCargados()[red.red_clave]?.hash !== red.qrHash;

      // Quita las imágenes de redes que ya no tienen QR, cambiaron de hash o desaparecieron.
      const descartarQrObsoletos = (redes: RedUsdtAdmin[]): void => {
        const vigentes: Record<string, QrCargado> = {};
        const obsoletos: Record<string, QrCargado> = {};
        for (const [clave, qr] of Object.entries(store.qrCargados())) {
          const red = redes.find((candidata) => candidata.red_clave === clave);
          if (red?.qrHash === qr.hash) vigentes[clave] = qr;
          else obsoletos[clave] = qr;
        }
        revocarUrls(obsoletos);
        patchState(store, { qrCargados: vigentes });
      };

      const guardarQrCargado = (red: RedUsdtAdmin, imagen: Blob): void => {
        if (red.qrHash === null) return;
        const anterior = store.qrCargados()[red.red_clave];
        if (anterior) URL.revokeObjectURL(anterior.url);
        patchState(store, {
          qrCargados: {
            ...store.qrCargados(),
            [red.red_clave]: { hash: red.qrHash, url: URL.createObjectURL(imagen) },
          },
        });
      };

      const cargarQrFaltantes = rxMethod<RedUsdtAdmin[]>(
        pipe(
          switchMap((redes) =>
            from(redes.filter(necesitaQr)).pipe(
              mergeMap((red) =>
                servicioQr.obtenerQr(red.red_clave).pipe(
                  tap((imagen) => guardarQrCargado(red, imagen)),
                  // Sin imagen se ve «Sin QR»; no se interrumpe la pantalla.
                  catchError(() => of(null)),
                ),
              ),
            ),
          ),
        ),
      );

      const aplicarAdministracion = (datos: DatosPagoAdministracion): void => {
        descartarQrObsoletos(datos.redes);
        patchState(store, { metodos: datos.metodos, redes: datos.redes, haCargado: true });
        cargarQrFaltantes(datos.redes);
      };

      const cargar = rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            servicio.obtenerAdministracion().pipe(
              tap(aplicarAdministracion),
              catchError((error: unknown) => of(registrarError(error, MENSAJE_ERROR_CARGA))),
              finalize(() => patchState(store, { loading: false })),
            ),
          ),
        ),
      );

      // Toda escritura: guardando → petición → aviso de éxito → recarga; el 403 se avisa a la página.
      const crearEscritura = <Entrada>(
        peticion: (entrada: Entrada) => Observable<unknown>,
        opciones: OpcionesEscritura,
      ) =>
        rxMethod<Entrada>(
          pipe(
            tap(() => patchState(store, { guardando: true, error: null })),
            switchMap((entrada) =>
              peticion(entrada).pipe(
                tap(() => {
                  opciones.alExito?.();
                  patchState(store, { resultado: opciones.mensajeExito });
                  cargar();
                }),
                catchError((error: unknown) => of(registrarError(error, MENSAJE_ERROR_GUARDADO))),
                finalize(() => patchState(store, { guardando: false })),
              ),
            ),
          ),
        );

      const cambiarEstadoMetodoConOrden = crearEscritura<CambioEstadoMetodo>(
        (cambio) => servicio.cambiarEstadoMetodo(cambio),
        { mensajeExito: MENSAJE_METODO_ACTUALIZADO },
      );
      const subirQr = crearEscritura<SubidaQr>((subida) => servicio.subirQr(subida), {
        mensajeExito: MENSAJE_QR_GUARDADO,
        alExito: () => patchState(store, { vistaPreviaQr: null, idRedQr: null }),
      });

      return {
        cargar,
        guardarRed: crearEscritura<CuerpoGuardarRed>((cuerpo) => servicio.guardarRed(cuerpo), {
          mensajeExito: MENSAJE_RED_GUARDADA,
        }),
        cambiarEstadoRed: crearEscritura<CambioEstadoRed>(
          (cambio) => servicio.cambiarEstadoRed(cambio.idRed, cambio.activo),
          { mensajeExito: MENSAJE_RED_ACTUALIZADA },
        ),
        eliminarRed: crearEscritura<number>((idRed) => servicio.eliminarRed(idRed), {
          mensajeExito: MENSAJE_RED_ELIMINADA,
        }),
        guardarPaypal: crearEscritura<CuerpoGuardarPaypal>(
          (cuerpo) => servicio.guardarPaypal(cuerpo),
          { mensajeExito: MENSAJE_PAYPAL_GUARDADO },
        ),
        guardarBanco: crearEscritura<CuerpoGuardarBanco>(
          (cuerpo) => servicio.guardarBanco(cuerpo),
          { mensajeExito: MENSAJE_BANCO_GUARDADO },
        ),
        // El orden del método no se edita en pantalla: se conserva el guardado.
        cambiarEstadoMetodo: (solicitud: Omit<CambioEstadoMetodo, 'orden'>): void => {
          const metodo = store.metodos().find((candidato) => candidato.mep_codigo === solicitud.codigo);
          cambiarEstadoMetodoConOrden({ ...solicitud, orden: metodo?.mep_orden ?? 0 });
        },
        confirmarSubidaQr: (): void => {
          const idRed = store.idRedQr();
          const imagen = store.vistaPreviaQr();
          if (idRed === null || imagen === null) return;
          subirQr({ idRed, imagen });
        },
        quitarQr: crearEscritura<number>((idRed) => servicio.quitarQr(idRed), {
          mensajeExito: MENSAJE_QR_QUITADO,
          alExito: () => patchState(store, { vistaPreviaQr: null, idRedQr: null }),
        }),
        validarArchivoQr: (archivo: { type: string; size: number }): string | null =>
          mensajeErrorArchivoQr(archivo.type, archivo.size),
        establecerVistaPreviaQr: (vistaPrevia: string): void =>
          patchState(store, { vistaPreviaQr: vistaPrevia }),
        descartarVistaPreviaQr: (): void => patchState(store, { vistaPreviaQr: null }),
        seleccionarRedEnEdicion: (idRed: number | null): void =>
          patchState(store, { idRedEnEdicion: idRed }),
        seleccionarRedQr: (idRed: number | null): void =>
          patchState(store, { idRedQr: idRed, vistaPreviaQr: null }),
        limpiarResultado: (): void => patchState(store, { resultado: null }),
        limpiar: (): void => {
          revocarUrls(store.qrCargados());
          patchState(store, { ...estadoInicial });
        },
      };
    },
  ),
);
