import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonicComponentes } from '../../IonicComponentes';

@Component({
  selector: 'app-aviso-sin-conexion',
  templateUrl: './aviso-sin-conexion.component.html',
  styleUrls: ['./aviso-sin-conexion.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class AvisoSinConexionComponent {
  readonly estaSinConexion = input(false);
}
