import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import {
  formatearFechaHora,
  puedeAprobarPago,
  textoMonto,
  textoPeriodoResultante,
  tieneFechasResultantes,
  TEXTO_COMPROBANTE_ANTIGUO,
  TEXTO_OTRO_PLAN_ACTIVO,
  TEXTO_PAGO_PROPIO,
  TEXTO_SIN_COMPROBANTE,
} from '../../configuracion/textos-validacion';
import { PagoPendiente } from '../../modelos/PagoPendiente.modelo';

@Component({
  selector: 'app-detalle-pago',
  templateUrl: './detalle-pago.component.html',
  styleUrls: ['./detalle-pago.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class DetallePagoComponent {
  readonly pago = input.required<PagoPendiente>();
  readonly comprobante = input<string | null>(null);
  readonly cargandoComprobante = input(false);
  readonly procesando = input(false);

  readonly aprobarSolicitado = output<void>();
  readonly rechazarSolicitado = output<void>();

  readonly textoPagoPropio = TEXTO_PAGO_PROPIO;
  readonly textoSinComprobante = TEXTO_SIN_COMPROBANTE;
  readonly textoComprobanteAntiguo = TEXTO_COMPROBANTE_ANTIGUO;
  readonly textoOtroPlanActivo = TEXTO_OTRO_PLAN_ACTIVO;

  // Estado local de UI: si la imagen se ve ampliada.
  readonly estaImagenAmpliada = signal(false);

  readonly monto = computed(() => textoMonto(this.pago()));
  readonly fechaSubida = computed(() => formatearFechaHora(this.pago().pag_fechaPago));
  readonly textoPeriodo = computed(() => textoPeriodoResultante(this.pago()));
  readonly faltanFechas = computed(() => !tieneFechasResultantes(this.pago()));
  readonly estaSinComprobante = computed(
    () => !this.cargandoComprobante() && this.comprobante() === null,
  );
  readonly puedeValidar = computed(() => !this.pago().esPropio);
  readonly puedeAprobar = computed(
    () => !this.procesando() && puedeAprobarPago(this.pago(), this.comprobante() !== null),
  );

  ampliarImagen(): void {
    this.estaImagenAmpliada.set(true);
  }

  cerrarImagen(): void {
    this.estaImagenAmpliada.set(false);
  }
}
