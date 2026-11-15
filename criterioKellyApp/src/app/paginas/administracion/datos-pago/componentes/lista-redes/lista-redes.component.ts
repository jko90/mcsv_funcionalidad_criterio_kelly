import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import {
  CambioEstadoRed,
  MetodoPagoAdmin,
  RedUsdtConQr,
} from '../../modelos/DatosPagoAdmin.modelo';

@Component({
  selector: 'app-lista-redes',
  templateUrl: './lista-redes.component.html',
  styleUrls: ['./lista-redes.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class ListaRedesComponent {
  readonly redes = input.required<readonly RedUsdtConQr[]>();
  readonly metodo = input<MetodoPagoAdmin | null>(null);
  readonly estaGuardando = input(false);

  readonly nuevaRedSolicitada = output<void>();
  readonly edicionSolicitada = output<RedUsdtConQr>();
  readonly eliminacionSolicitada = output<RedUsdtConQr>();
  readonly qrSolicitado = output<RedUsdtConQr>();
  readonly estadoRedCambiado = output<CambioEstadoRed>();
  readonly estadoMetodoCambiado = output<boolean>();

  readonly estaMetodoActivo = computed(() => this.metodo()?.mep_activo === 1);

  alCambiarEstadoRed(red: RedUsdtConQr, activo: boolean): void {
    this.estadoRedCambiado.emit({ idRed: red.red_idRed, activo });
  }
}
