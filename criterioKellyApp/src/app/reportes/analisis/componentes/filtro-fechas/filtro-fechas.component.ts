import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { RangoFechas } from 'src/app/negocio/suscripcion/configuracion/permisos-plan.config';

const LONGITUD_FECHA_ISO = 10;

@Component({
  selector: 'app-filtro-fechas',
  templateUrl: './filtro-fechas.component.html',
  styleUrls: ['./filtro-fechas.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class FiltroFechasComponent {
  readonly desde = input<string | null>(null);
  readonly hasta = input.required<string>();
  readonly fechaMinima = input<string | null>(null);
  readonly fechaMaxima = input.required<string>();
  readonly textoAviso = input<string | null>(null);

  readonly rangoCambiado = output<RangoFechas>();

  alElegirDesde(valorElegido: string | string[] | null | undefined): void {
    const fechaElegida = this.leerFecha(valorElegido);
    if (fechaElegida === null) return;
    this.rangoCambiado.emit({ desde: fechaElegida, hasta: this.hasta() });
  }

  alElegirHasta(valorElegido: string | string[] | null | undefined): void {
    const fechaElegida = this.leerFecha(valorElegido);
    if (fechaElegida === null) return;
    this.rangoCambiado.emit({ desde: this.desde(), hasta: fechaElegida });
  }

  private leerFecha(valorElegido: string | string[] | null | undefined): string | null {
    if (typeof valorElegido !== 'string') return null;
    return valorElegido.slice(0, LONGITUD_FECHA_ISO);
  }
}
