import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonicComponentes } from '../IonicComponentes';
import { CuentasModelo } from 'src/app/paginas/configuracion/modelos/Cuentas.modelo';

@Component({
  selector: 'app-seleccionar-cuentas',
  templateUrl: './seleccionar-cuentas.component.html',
  styleUrls: ['./seleccionar-cuentas.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class SeleccionarCuentasComponent {
  readonly cuentas = input.required<CuentasModelo[]>();
  readonly cuentaElegida = output<CuentasModelo>();

  alCambiarCuenta(evento: Event): void {
    const cuenta = (evento as CustomEvent<{ value: CuentasModelo }>).detail.value;
    if (!cuenta) return;
    this.cuentaElegida.emit(cuenta);
  }
}
