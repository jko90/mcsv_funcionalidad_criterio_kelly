import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import {
  formatearFechaHora,
  textoMonto,
  TEXTO_SIN_COMPROBANTE,
} from '../../configuracion/textos-validacion';
import { PagoPendiente } from '../../modelos/PagoPendiente.modelo';

const TEXTO_CON_COMPROBANTE = 'Con comprobante';

interface FilaPagoPendiente {
  pago: PagoPendiente;
  monto: string;
  fechaSubida: string;
  textoComprobante: string;
}

@Component({
  selector: 'app-lista-pagos-pendientes',
  templateUrl: './lista-pagos-pendientes.component.html',
  styleUrls: ['./lista-pagos-pendientes.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class ListaPagosPendientesComponent {
  readonly pagos = input.required<PagoPendiente[]>();
  readonly hayMas = input(false);
  readonly estaCargando = input(false);

  readonly pagoSeleccionado = output<PagoPendiente>();
  readonly cargarMasSolicitado = output<void>();

  readonly filas = computed<FilaPagoPendiente[]>(() =>
    this.pagos().map((pago) => ({
      pago,
      monto: textoMonto(pago),
      fechaSubida: formatearFechaHora(pago.pag_fechaPago),
      textoComprobante: pago.tieneComprobante ? TEXTO_CON_COMPROBANTE : TEXTO_SIN_COMPROBANTE,
    })),
  );
}
