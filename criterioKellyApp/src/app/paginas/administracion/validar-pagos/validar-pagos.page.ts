import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AlertInput } from '@ionic/angular/standalone';
import { AlertaCkComponent, ValoresCamposAlerta } from 'src/app/compartidos/alerta-ck/alerta-ck.component';
import { ALERTA_APROBAR_PAGO, ALERTA_RECHAZAR_PAGO, PLACEHOLDER_MOTIVO_RECHAZO, TEXTO_CANCELAR_LARGO } from 'src/app/compartidos/textos-alertas';
import { EncabezadoComponent } from 'src/app/compartidos/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DetallePagoComponent } from '../componentes/detalle-pago/detalle-pago.component';
import { ListaPagosPendientesComponent } from '../componentes/lista-pagos-pendientes/lista-pagos-pendientes.component';
import { MOTIVO_MAXIMO_CARACTERES } from '../configuracion/textos-validacion';
import { PagoPendiente } from '../modelos/PagoPendiente.modelo';
import { ValidacionPagosStore } from '../store/validacion-pagos.store';

const MENSAJE_PAGO_APROBADO = 'Pago aprobado';
const MENSAJE_PAGO_RECHAZADO = 'Pago rechazado';
const MENSAJE_MOTIVO_INVALIDO = 'El motivo debe tener entre 5 y 256 caracteres';

@Component({
  selector: 'app-validar-pagos',
  templateUrl: './validar-pagos.page.html',
  styleUrls: ['./validar-pagos.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonicComponentes,
    EncabezadoComponent,
    ListaPagosPendientesComponent,
    DetallePagoComponent,
    AlertaCkComponent,
  ],
})
export class ValidarPagosPage {
  private readonly validacionPagosStore = inject(ValidacionPagosStore);
  private readonly utilServicio = inject(UtilitariosService);

  readonly alertaAprobarPago = ALERTA_APROBAR_PAGO;
  readonly pagoPorAprobar = signal<PagoPendiente | null>(null);
  readonly alertaRechazarPago = ALERTA_RECHAZAR_PAGO;
  readonly textoCancelarLargo = TEXTO_CANCELAR_LARGO;
  readonly pagoPorRechazar = signal<PagoPendiente | null>(null);
  readonly camposRechazo = computed<AlertInput[]>(() => [
    {
      type: 'textarea',
      name: 'motivo',
      placeholder: PLACEHOLDER_MOTIVO_RECHAZO,
      value: this.validacionPagosStore.motivoRechazoSugerido(),
      attributes: { maxlength: MOTIVO_MAXIMO_CARACTERES },
    },
  ]);
  readonly mensajeAprobarPago = this.validacionPagosStore.mensajeConfirmarAprobacion;

  readonly tituloPagina = 'VALIDAR PAGOS';
  readonly listaPagos = this.validacionPagosStore.pagos;
  readonly hayMasPagos = this.validacionPagosStore.hayMas;
  readonly estaCargando = this.validacionPagosStore.isLoading;
  readonly pagoSeleccionado = this.validacionPagosStore.seleccionado;
  readonly comprobante = this.validacionPagosStore.comprobante;
  readonly estaCargandoComprobante = this.validacionPagosStore.cargandoComprobante;
  readonly estaProcesando = this.validacionPagosStore.procesando;

  constructor() {
    effect(() => {
      const resultado = this.validacionPagosStore.resultado();
      if (resultado === null) return;
      untracked(() => {
        const aprobado = resultado === 'APROBADO';
        this.utilServicio.mostrarToast(
          aprobado ? MENSAJE_PAGO_APROBADO : MENSAJE_PAGO_RECHAZADO,
          'success',
        );
        this.validacionPagosStore.limpiarResultado();
      });
    });
  }

  ionViewWillEnter(): void {
    this.validacionPagosStore.cargarPendientes();
  }

  ionViewWillLeave(): void {
    this.validacionPagosStore.limpiar();
  }

  alSeleccionarPago(pago: PagoPendiente): void {
    this.validacionPagosStore.seleccionar(pago);
  }

  alCerrarDetalle(): void {
    this.validacionPagosStore.deseleccionar();
  }

  alCargarMas(): void {
    this.validacionPagosStore.cargarMas();
  }

  alSolicitarAprobar(pago: PagoPendiente): void {
    this.pagoPorAprobar.set(pago);
  }

  alConfirmarAprobar(): void {
    const pago = this.pagoPorAprobar();
    this.pagoPorAprobar.set(null);
    if (pago !== null) this.validacionPagosStore.aprobar(pago.pag_idPago);
  }

  alDescartarAprobar(): void {
    this.pagoPorAprobar.set(null);
  }

  alSolicitarRechazar(pago: PagoPendiente): void {
    this.pagoPorRechazar.set(pago);
  }

  // Devolver false mantiene la alerta abierta para que se corrija el motivo.
  readonly validarMotivoRechazo = (valores: ValoresCamposAlerta): boolean => {
    const motivoIngresado = String(valores['motivo'] ?? '');
    if (this.validacionPagosStore.esMotivoValido(motivoIngresado)) return true;
    this.utilServicio.mostrarToast(MENSAJE_MOTIVO_INVALIDO, 'warning');
    return false;
  };

  alConfirmarRechazo(valores: ValoresCamposAlerta | void): void {
    const pago = this.pagoPorRechazar();
    this.pagoPorRechazar.set(null);
    if (pago === null) return;
    const motivo = String(valores?.['motivo'] ?? '');
    this.validacionPagosStore.rechazar({ idPago: pago.pag_idPago, motivo });
  }

  alDescartarRechazo(): void {
    this.pagoPorRechazar.set(null);
  }
}
