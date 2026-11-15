import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { ManejoImagenesService } from 'src/app/compartidos/servicios/manejo-imagenes.service';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { AccionesExternasService } from 'src/app/compartidos/servicios/acciones-externas.service';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { EstadoPagoComponent } from '../componentes/estado-pago/estado-pago.component';
import { FormularioComprobanteComponent } from '../componentes/formulario-comprobante/formulario-comprobante.component';
import { IndicadorPasosPagoComponent } from '../componentes/indicador-pasos-pago/indicador-pasos-pago.component';
import { InstruccionesPagoComponent } from '../componentes/instrucciones-pago/instrucciones-pago.component';
import { SelectorMetodoPagoComponent } from '../componentes/selector-metodo-pago/selector-metodo-pago.component';
import { MetodoPago, SolicitudComprobante } from '../modelos/EstadoPago.modelo';
import { ComprobanteStore } from '../store/comprobante.store';
import { MetodoPagoStore } from '../store/metodo-pago.store';
import { PlanVigenteStore } from '../store/plan-vigente.store';
import { validarImagenComprobante } from './validacion-imagen';

const MENSAJE_DIRECCION_COPIADA = 'Copiado. Ya puedes pegarlo en tu app de pago.';
const MENSAJE_COPIA_FALLIDA = 'No se pudo copiar, selecciona el texto y cópialo a mano.';
const MENSAJE_COMPROBANTE_ENVIADO =
  'Comprobante enviado. El administrador lo revisará y te avisaremos aquí.';

@Component({
  selector: 'app-comprobante',
  templateUrl: './comprobante.page.html',
  styleUrls: ['./comprobante.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonicComponentes,
    RouterLink,
    EncabezadoComponent,
    EstadoPagoComponent,
    FormularioComprobanteComponent,
    IndicadorPasosPagoComponent,
    InstruccionesPagoComponent,
    SelectorMetodoPagoComponent,
  ],
})
export class ComprobantePage {
  private readonly comprobanteStore = inject(ComprobanteStore);
  private readonly planVigenteStore = inject(PlanVigenteStore);
  private readonly sesionStore = inject(SesionStore);
  private readonly manejoImagenes = inject(ManejoImagenesService);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly metodoPagoStore = inject(MetodoPagoStore);
  private readonly accionesExternas = inject(AccionesExternasService);

  readonly tituloPagina = 'COMPROBANTE DE PAGO';
  readonly ultimoPago = this.comprobanteStore.ultimoPago;
  readonly planVigente = this.comprobanteStore.plan;
  readonly puedeEnviar = this.comprobanteStore.puedeEnviar;
  readonly enviando = this.comprobanteStore.enviando;
  readonly textoPeriodo = this.comprobanteStore.textoPeriodo;
  readonly tituloFormulario = this.comprobanteStore.tituloFormulario;
  readonly pasoActual = this.metodoPagoStore.pasoActual;
  readonly opcionesMetodo = this.metodoPagoStore.opcionesMetodo;
  readonly metodoActivo = this.metodoPagoStore.metodoActivo;
  readonly metodoActivoDisponible = this.metodoPagoStore.metodoActivoDisponible;
  readonly descripcionPlanElegido = this.metodoPagoStore.descripcionPlanElegido;
  readonly montoPlan = this.metodoPagoStore.montoPlan;
  readonly redesUsdt = this.metodoPagoStore.redesUsdt;
  readonly urlsQr = this.metodoPagoStore.urlsQr;
  readonly estaCargandoDatosPago = this.metodoPagoStore.isLoading;
  readonly hayErrorDeCargaDatosPago = this.metodoPagoStore.hayErrorDeCarga;
  readonly correoPaypal = this.metodoPagoStore.correoPaypal;
  readonly enlacePaypal = this.metodoPagoStore.enlacePaypal;
  readonly etapaBanco = this.metodoPagoStore.etapaBancoActiva;
  // La imagen solo vive aquí hasta enviarla (RN-10).
  readonly vistaPrevia = signal<string | null>(null);

  constructor() {
    // Las URLs de objeto del QR no deben sobrevivir a la pantalla.
    inject(DestroyRef).onDestroy(() => this.metodoPagoStore.liberarQr());
    effect(() => {
      if (!this.comprobanteStore.envioExitoso()) return;
      untracked(() => {
        this.vistaPrevia.set(null);
        this.metodoPagoStore.olvidarSolicitudBanco();
        this.metodoPagoStore.reiniciar();
        this.utilServicio.mostrarToast(MENSAJE_COMPROBANTE_ENVIADO, 'success');
      });
    });
  }

  ionViewWillEnter(): void {
    const usuarioId = this.sesionStore.usuario()?.id;
    if (usuarioId !== undefined) this.planVigenteStore.cargar({ usuarioId });
    this.comprobanteStore.cargarUltimoPago();
    this.metodoPagoStore.cargarDatos();
  }

  ionViewWillLeave(): void {
    this.vistaPrevia.set(null);
    this.comprobanteStore.limpiar();
    this.metodoPagoStore.reiniciar();
    this.metodoPagoStore.liberarQr();
  }

  alSeleccionarImagen(evento: Event): void {
    this.manejoImagenes.seleccionarImagen(
      evento,
      (_archivo, vista) => this.aceptarImagen(vista),
      (mensaje) => this.rechazarImagen(mensaje),
    );
  }

  alEnviarComprobante(solicitud: SolicitudComprobante): void {
    this.comprobanteStore.enviarComprobante(solicitud);
  }

  alReintentarCargaDatosPago(): void {
    this.metodoPagoStore.cargarDatos();
  }

  alElegirMetodo(metodo: MetodoPago): void {
    this.metodoPagoStore.elegirMetodo(metodo);
  }

  alCambiarMetodo(): void {
    this.vistaPrevia.set(null);
    this.metodoPagoStore.cambiarMetodo();
  }

  async alCopiar(texto: string): Promise<void> {
    const copiado = await this.accionesExternas.copiarTexto(texto);
    this.utilServicio.mostrarToast(
      copiado ? MENSAJE_DIRECCION_COPIADA : MENSAJE_COPIA_FALLIDA,
      copiado ? 'success' : 'warning',
    );
  }

  alPedirDatosPorWhatsapp(): void {
    const enlace = this.metodoPagoStore.enlaceWhatsappBanco();
    if (enlace === null) return;
    this.accionesExternas.abrirEnlaceExterno(enlace);
    this.metodoPagoStore.marcarWhatsappAbierto();
  }

  alConfirmarSolicitud(): void {
    this.metodoPagoStore.confirmarSolicitudEnviada();
  }

  alIrAlComprobante(): void {
    this.metodoPagoStore.pasarAlComprobante();
  }

  private aceptarImagen(vista: string): void {
    const mensajeError = validarImagenComprobante(vista);
    if (mensajeError !== null) {
      this.rechazarImagen(mensajeError);
      return;
    }
    this.vistaPrevia.set(vista);
  }

  private rechazarImagen(mensaje: string): void {
    this.vistaPrevia.set(null);
    this.utilServicio.mostrarToast(mensaje, 'danger');
  }
}
