import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { IonicComponentes } from '../../IonicComponentes';
import { ServicioInactividad } from '../../../configuracion/seguridad/servicio/ServicioInactividad';

@Component({
  selector: 'app-encabezado',
  templateUrl: './encabezado.component.html',
  styleUrls: ['./encabezado.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicComponentes],
})
export class EncabezadoComponent {
  readonly titulo = input<string>('GESTION DE RIESGO');

  private readonly authService = inject(ServicioInactividad);

  salir(): void {
    this.authService.salir();
  }
}
