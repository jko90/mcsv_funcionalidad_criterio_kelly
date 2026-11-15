import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { LIMITE_QR, RedUsdtConQr } from '../../modelos/DatosPagoAdmin.modelo';

const BYTES_POR_KILOBYTE = 1024;

@Component({
  selector: 'app-subida-qr',
  templateUrl: './subida-qr.component.html',
  styleUrls: ['./subida-qr.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class SubidaQrComponent {
  readonly red = input.required<RedUsdtConQr>();
  // Imagen elegida y aún sin confirmar (solo en memoria).
  readonly vistaPrevia = input<string | null>(null);
  readonly puedeConfirmar = input(false);
  readonly estaGuardando = input(false);

  readonly archivoElegido = output<Event>();
  readonly confirmarSolicitado = output<void>();
  readonly descartarSolicitado = output<void>();
  readonly quitarSolicitado = output<void>();

  readonly tiposAceptados = LIMITE_QR.tiposPermitidos.join(',');
  readonly maximoKilobytes = LIMITE_QR.tamanoMaximoBytes / BYTES_POR_KILOBYTE;

  alElegirArchivo(evento: Event): void {
    this.archivoElegido.emit(evento);
    // Permite volver a elegir el mismo archivo si fue rechazado.
    (evento.target as HTMLInputElement).value = '';
  }
}
