import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';

@Component({
  selector: 'app-aviso-plan',
  templateUrl: './aviso-plan.component.html',
  styleUrls: ['./aviso-plan.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class AvisoPlanComponent {
  readonly textoTiempo = input<string | null>(null);
  readonly aviso = input<string | null>(null);
  readonly tituloPendiente = input<string | null>(null);
  readonly mensajePendiente = input<string | null>(null);
  readonly mensajeProgramado = input<string | null>(null);
  readonly puedeVerPlanes = input<boolean>(false);
  readonly cancelado = input<boolean>(false);
  readonly fechaCorte = input<string | null>(null);
  readonly puedeCancelar = input<boolean>(false);
  readonly puedeSubirComprobante = input<boolean>(false);
  readonly puedeVerEstadoPago = input<boolean>(false);
  readonly puedePagarAnticipado = input<boolean>(false);

  readonly entendido = output<void>();
  readonly planesSolicitados = output<void>();
  readonly cancelar = output<void>();
  readonly comprobanteSolicitado = output<void>();
}
