import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PasoPago } from '../../modelos/PasoPago.modelo';

const PASOS: readonly { clave: PasoPago; etiqueta: string }[] = [
  { clave: 'METODO', etiqueta: 'Cómo pagar' },
  { clave: 'INSTRUCCIONES', etiqueta: 'Datos de pago' },
  { clave: 'COMPROBANTE', etiqueta: 'Comprobante' },
];

@Component({
  selector: 'app-indicador-pasos-pago',
  templateUrl: './indicador-pasos-pago.component.html',
  styleUrls: ['./indicador-pasos-pago.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadorPasosPagoComponent {
  readonly pasoActual = input.required<PasoPago>();

  readonly pasos = computed(() => {
    const indiceActual = PASOS.findIndex((paso) => paso.clave === this.pasoActual());
    return PASOS.map((paso, indice) => ({
      numero: indice + 1,
      etiqueta: paso.etiqueta,
      esActual: indice === indiceActual,
      estaCompleto: indice < indiceActual,
    }));
  });
}
