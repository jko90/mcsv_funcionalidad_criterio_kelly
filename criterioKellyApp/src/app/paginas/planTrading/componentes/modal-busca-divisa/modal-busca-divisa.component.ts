import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { DivisasModelo } from '../../modelos/Divisas.modelo';

@Component({
  selector: 'app-modal-busca-divisa',
  templateUrl: './modal-busca-divisa.component.html',
  styleUrls: ['./modal-busca-divisa.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IonicComponentes],
})
export class ModalBuscaDivisaComponent implements OnInit {
  readonly listaObjeto = input<DivisasModelo[]>([]);
  readonly objSeleccionado = input<DivisasModelo | null>(null);
  readonly titulo = input('Seleccionar Divisa');

  readonly divisaElegida = output<DivisasModelo>();
  readonly cerrar = output<void>();

  readonly busqueda = signal('');
  readonly divisaProvisional = signal<DivisasModelo | null>(null);

  // La lista se copia al abrirse el modal (como antes), no se vuelve a leer del padre.
  private readonly listaInicial = signal<DivisasModelo[]>([]);

  readonly listaFiltrada = computed(() => {
    const texto = this.busqueda().toLowerCase();
    if (!texto.trim()) return this.listaInicial();
    return this.listaInicial().filter((divisa) =>
      divisa.text.toLowerCase().includes(texto),
    );
  });

  ngOnInit(): void {
    const lista = this.listaObjeto();
    const seleccionada = this.objSeleccionado();
    this.listaInicial.set([...lista]);
    this.divisaProvisional.set(
      seleccionada
        ? (lista.find((divisa) => divisa.value === seleccionada.value) ?? null)
        : null,
    );
  }

  cancelarCambio(): void {
    this.cerrar.emit();
  }

  confirmarCambio(): void {
    const divisa = this.divisaProvisional();
    if (!divisa) return;
    this.divisaElegida.emit(divisa);
    this.cerrar.emit();
  }

  parametroBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }
}
