import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { textoEstadoPago } from '../../configuracion/textos-comprobante';
import { ClaveEstadoPago, UltimoPago } from '../../modelos/EstadoPago.modelo';
import { PlanVigente } from '../../modelos/PlanVigente.modelo';

const ICONOS: Record<ClaveEstadoPago, string> = {
  REVISION: 'hourglass-outline',
  RECHAZADO: 'close-circle-outline',
  PROGRAMADO: 'calendar-outline',
  ACTIVO: 'checkmark-circle-outline',
  SIN_COMPROBANTE: 'cloud-upload-outline',
  SIN_PAGOS: 'information-circle-outline',
};

@Component({
  selector: 'app-estado-pago',
  templateUrl: './estado-pago.component.html',
  styleUrls: ['./estado-pago.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class EstadoPagoComponent {
  readonly pago = input<UltimoPago | null>(null);
  readonly planVigente = input<PlanVigente | null>(null);

  readonly texto = computed(() => textoEstadoPago(this.pago(), this.planVigente()));
  readonly icono = computed(() => ICONOS[this.texto().clave]);
}
