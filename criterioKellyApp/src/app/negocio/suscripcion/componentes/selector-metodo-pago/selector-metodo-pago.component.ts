import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { MENSAJE_METODO_NO_DISPONIBLE } from '../../configuracion/textos-pago';
import { MetodoPago } from '../../modelos/EstadoPago.modelo';
import { OpcionMetodoPago } from '../../modelos/PasoPago.modelo';

@Component({
  selector: 'app-selector-metodo-pago',
  templateUrl: './selector-metodo-pago.component.html',
  styleUrls: ['./selector-metodo-pago.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class SelectorMetodoPagoComponent {
  readonly opciones = input.required<readonly OpcionMetodoPago[]>();
  readonly resumenPlan = input<string | null>(null);
  readonly estaCargando = input(false);
  readonly hayErrorDeCarga = input(false);

  readonly metodoSeleccionado = output<MetodoPago>();
  readonly reintentarSolicitado = output<void>();

  readonly mensajeNoDisponible = MENSAJE_METODO_NO_DISPONIBLE;
}
