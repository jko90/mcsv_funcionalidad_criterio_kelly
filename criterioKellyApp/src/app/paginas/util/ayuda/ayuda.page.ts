import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { EncabezadoComponent } from 'src/app/compartidos/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';

@Component({
  selector: 'app-ayuda',
  templateUrl: './ayuda.page.html',
  styleUrls: ['./ayuda.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicComponentes, EncabezadoComponent],
})
export class AyudaPage {
  readonly titulo = 'GUÍA DE USO';
}
