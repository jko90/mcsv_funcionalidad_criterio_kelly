import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { MENSAJE_METODO_NO_DISPONIBLE } from '../../configuracion/textos-pago';
import { RedUsdtDisponible } from '../../modelos/DatosPago.modelo';
import { MetodoPago } from '../../modelos/EstadoPago.modelo';
import { EtapaBanco } from '../../modelos/PasoPago.modelo';

@Component({
  selector: 'app-instrucciones-pago',
  templateUrl: './instrucciones-pago.component.html',
  styleUrls: ['./instrucciones-pago.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class InstruccionesPagoComponent {
  readonly metodo = input.required<MetodoPago>();
  readonly disponible = input<boolean>(true);
  readonly descripcionPlan = input<string | null>(null);
  readonly monto = input<number | null>(null);
  readonly redesUsdt = input<readonly RedUsdtDisponible[]>([]);
  // Clave de la red → URL de objeto de su QR, ya pedido por el contenedor.
  readonly urlsQr = input<Readonly<Record<string, string>>>({});
  readonly correoPaypal = input<string>('');
  readonly enlacePaypal = input<string>('');
  readonly etapaBanco = input<EtapaBanco>('PENDIENTE');

  readonly copiarSolicitado = output<string>();
  readonly whatsappSolicitado = output<void>();
  readonly solicitudConfirmada = output<void>();
  readonly comprobanteSolicitado = output<void>();
  readonly cambiarMetodoSolicitado = output<void>();

  // En la transferencia bancaria primero hay que confirmar que se envió la solicitud.
  readonly puedeContinuar = computed(
    () =>
      this.disponible() &&
      (this.metodo() !== 'BANCO' || this.etapaBanco() === 'SOLICITUD_CONFIRMADA'),
  );

  readonly mensajeNoDisponible = MENSAJE_METODO_NO_DISPONIBLE;

  // Estado local de UI: qué QR se ve ampliado.
  readonly claveQrAmpliado = signal<string | null>(null);

  alternarQrAmpliado(clave: string): void {
    this.claveQrAmpliado.update((actual) => (actual === clave ? null : clave));
  }
}
