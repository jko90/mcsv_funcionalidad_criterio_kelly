import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { AlertaCkComponent } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { ManejoImagenesService } from 'src/app/compartidos/servicios/manejo-imagenes.service';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { FormularioBancoComponent } from './componentes/formulario-banco/formulario-banco.component';
import { FormularioPaypalComponent } from './componentes/formulario-paypal/formulario-paypal.component';
import { FormularioRedComponent } from './componentes/formulario-red/formulario-red.component';
import { ListaRedesComponent } from './componentes/lista-redes/lista-redes.component';
import { SubidaQrComponent } from './componentes/subida-qr/subida-qr.component';
import {
  ENCABEZADO_CONFIRMAR_CAMBIO,
  ENCABEZADO_CONFIRMAR_ELIMINAR,
  ENCABEZADO_CONFIRMAR_QUITAR_QR,
  mensajeConfirmarCambio,
  mensajeConfirmarEliminarRed,
  mensajeConfirmarQuitarQr,
  valorConfirmacionBanco,
  valorConfirmacionPaypal,
} from './configuracion/textos-datos-pago';
import {
  CambioEstadoRed,
  CuerpoGuardarBanco,
  CuerpoGuardarPaypal,
  CuerpoGuardarRed,
  RedUsdtConQr,
} from './modelos/DatosPagoAdmin.modelo';
import { DatosPagoAdminStore } from './store/datos-pago-admin.store';
import { TEXTO_CONFIRMAR, TEXTO_ELIMINAR, TEXTO_QUITAR } from 'src/app/compartidos/textos-alertas';

const RUTA_INICIO = '/inicio';

interface SolicitudConfirmacion {
  encabezado: string;
  mensaje: string;
  textoConfirmar: string;
  alConfirmar: () => void;
}

@Component({
  selector: 'app-datos-pago-admin',
  templateUrl: './datos-pago-admin.page.html',
  styleUrls: ['./datos-pago-admin.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonicComponentes,
    EncabezadoComponent,
    ListaRedesComponent,
    FormularioRedComponent,
    SubidaQrComponent,
    FormularioPaypalComponent,
    FormularioBancoComponent,
    AlertaCkComponent,
  ],
})
export class DatosPagoAdminPage {
  private readonly datosPagoAdminStore = inject(DatosPagoAdminStore);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly manejoImagenes = inject(ManejoImagenesService);
  private readonly router = inject(Router);

  readonly confirmacionPendiente = signal<SolicitudConfirmacion | null>(null);
  readonly tituloPagina = 'DATOS DE PAGO';
  readonly listaRedes = this.datosPagoAdminStore.listaRedes;
  readonly metodoCripto = this.datosPagoAdminStore.metodoCripto;
  readonly metodoPaypal = this.datosPagoAdminStore.metodoPaypal;
  readonly metodoBanco = this.datosPagoAdminStore.metodoBanco;
  readonly redEnEdicion = this.datosPagoAdminStore.redEnEdicion;
  readonly redQrSeleccionada = this.datosPagoAdminStore.redQrSeleccionada;
  readonly vistaPreviaQr = this.datosPagoAdminStore.vistaPreviaQr;
  readonly puedeConfirmarQr = this.datosPagoAdminStore.puedeConfirmarQr;
  readonly estaSinDatos = this.datosPagoAdminStore.estaSinDatos;
  readonly estaCargando = this.datosPagoAdminStore.isLoading;
  readonly estaGuardando = this.datosPagoAdminStore.guardando;
  readonly mensajeError = this.datosPagoAdminStore.errorMessage;
  readonly haCargado = this.datosPagoAdminStore.haCargado;

  // Estado local de UI: qué ventanas están abiertas.
  readonly estaFormularioRedAbierto = signal(false);
  readonly estaQrAbierto = computed(() => this.redQrSeleccionada() !== null);

  constructor() {
    effect(() => {
      const resultado = this.datosPagoAdminStore.resultado();
      if (resultado === null) return;
      untracked(() => {
        this.utilServicio.mostrarToast(resultado, 'success');
        this.alCerrarFormularioRed();
        this.datosPagoAdminStore.limpiarResultado();
      });
    });
    effect(() => {
      if (!this.datosPagoAdminStore.accesoDenegado()) return;
      untracked(() => void this.router.navigateByUrl(RUTA_INICIO));
    });
  }

  ionViewWillEnter(): void {
    this.datosPagoAdminStore.cargar();
  }

  ionViewWillLeave(): void {
    this.estaFormularioRedAbierto.set(false);
    this.datosPagoAdminStore.limpiar();
  }

  alReintentarCarga(): void {
    this.datosPagoAdminStore.cargar();
  }

  alSolicitarNuevaRed(): void {
    this.datosPagoAdminStore.seleccionarRedEnEdicion(null);
    this.estaFormularioRedAbierto.set(true);
  }

  alSolicitarEditarRed(red: RedUsdtConQr): void {
    this.datosPagoAdminStore.seleccionarRedEnEdicion(red.red_idRed);
    this.estaFormularioRedAbierto.set(true);
  }

  alCerrarFormularioRed(): void {
    this.estaFormularioRedAbierto.set(false);
    this.datosPagoAdminStore.seleccionarRedEnEdicion(null);
  }

  alEnviarRed(cuerpo: CuerpoGuardarRed): void {
    this.pedirConfirmacion({
      encabezado: ENCABEZADO_CONFIRMAR_CAMBIO,
      mensaje: mensajeConfirmarCambio(`${cuerpo.red_direccion} (red ${cuerpo.red_clave})`),
      textoConfirmar: TEXTO_CONFIRMAR,
      alConfirmar: () => this.datosPagoAdminStore.guardarRed(cuerpo),
    });
  }

  alCambiarEstadoRed(cambio: CambioEstadoRed): void {
    this.datosPagoAdminStore.cambiarEstadoRed(cambio);
  }

  alSolicitarEliminarRed(red: RedUsdtConQr): void {
    this.pedirConfirmacion({
      encabezado: ENCABEZADO_CONFIRMAR_ELIMINAR,
      mensaje: mensajeConfirmarEliminarRed(red.red_nombre),
      textoConfirmar: TEXTO_ELIMINAR,
      alConfirmar: () => this.datosPagoAdminStore.eliminarRed(red.red_idRed),
    });
  }

  alSolicitarQr(red: RedUsdtConQr): void {
    this.datosPagoAdminStore.seleccionarRedQr(red.red_idRed);
  }

  alCerrarQr(): void {
    this.datosPagoAdminStore.seleccionarRedQr(null);
  }

  // Se valida el archivo antes de leerlo: así una imagen grande no pasa por la compresión
  // de ManejoImagenesService, que deformaría el código QR.
  alSeleccionarArchivoQr(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (archivo === undefined) return;
    const mensajeError = this.datosPagoAdminStore.validarArchivoQr(archivo);
    if (mensajeError !== null) {
      this.utilServicio.mostrarToast(mensajeError, 'danger');
      return;
    }
    this.manejoImagenes.seleccionarImagen(
      evento,
      (_archivo, vistaPrevia) => this.datosPagoAdminStore.establecerVistaPreviaQr(vistaPrevia),
      (mensaje) => this.utilServicio.mostrarToast(mensaje, 'danger'),
    );
  }

  alDescartarVistaPreviaQr(): void {
    this.datosPagoAdminStore.descartarVistaPreviaQr();
  }

  alConfirmarSubidaQr(): void {
    this.datosPagoAdminStore.confirmarSubidaQr();
  }

  alSolicitarQuitarQr(red: RedUsdtConQr): void {
    this.pedirConfirmacion({
      encabezado: ENCABEZADO_CONFIRMAR_QUITAR_QR,
      mensaje: mensajeConfirmarQuitarQr(red.red_nombre),
      textoConfirmar: TEXTO_QUITAR,
      alConfirmar: () => this.datosPagoAdminStore.quitarQr(red.red_idRed),
    });
  }

  alGuardarPaypal(cuerpo: CuerpoGuardarPaypal): void {
    this.pedirConfirmacion({
      encabezado: ENCABEZADO_CONFIRMAR_CAMBIO,
      mensaje: mensajeConfirmarCambio(
        valorConfirmacionPaypal(cuerpo.mep_paypalCorreo, cuerpo.mep_paypalEnlace),
      ),
      textoConfirmar: TEXTO_CONFIRMAR,
      alConfirmar: () => this.datosPagoAdminStore.guardarPaypal(cuerpo),
    });
  }

  alGuardarBanco(cuerpo: CuerpoGuardarBanco): void {
    this.pedirConfirmacion({
      encabezado: ENCABEZADO_CONFIRMAR_CAMBIO,
      mensaje: mensajeConfirmarCambio(
        valorConfirmacionBanco(cuerpo.mep_bancoNumero, cuerpo.mep_bancoCuenta),
      ),
      textoConfirmar: TEXTO_CONFIRMAR,
      alConfirmar: () => this.datosPagoAdminStore.guardarBanco(cuerpo),
    });
  }

  alCambiarEstadoCripto(activo: boolean): void {
    this.datosPagoAdminStore.cambiarEstadoMetodo({ codigo: 'CRIPTOMONEDA', activo });
  }

  alCambiarEstadoPaypal(activo: boolean): void {
    this.datosPagoAdminStore.cambiarEstadoMetodo({ codigo: 'PAYPAL', activo });
  }

  alCambiarEstadoBanco(activo: boolean): void {
    this.datosPagoAdminStore.cambiarEstadoMetodo({ codigo: 'BANCO', activo });
  }

  private pedirConfirmacion(solicitud: SolicitudConfirmacion): void {
    this.confirmacionPendiente.set(solicitud);
  }

  alConfirmarCambioPendiente(): void {
    const solicitud = this.confirmacionPendiente();
    this.confirmacionPendiente.set(null);
    solicitud?.alConfirmar();
  }

  alDescartarCambioPendiente(): void {
    this.confirmacionPendiente.set(null);
  }
}
