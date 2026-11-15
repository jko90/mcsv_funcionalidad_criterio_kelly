import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { EncabezadoComponent } from 'src/app/compartidos/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';

@Component({
  selector: 'app-acerca-d',
  templateUrl: './acerca-d.page.html',
  styleUrls: ['./acerca-d.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicComponentes, EncabezadoComponent],
})
export class AcercaDPage {
  readonly titulo = 'INFORMACIÓN DE APP';
}
