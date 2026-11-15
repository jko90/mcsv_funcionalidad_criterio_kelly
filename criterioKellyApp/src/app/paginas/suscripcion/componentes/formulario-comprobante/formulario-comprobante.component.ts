import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { MetodoPago, SolicitudComprobante } from '../../modelos/EstadoPago.modelo';

const MAX_LONGITUD_TRANSACCION = 254;
const MAX_LONGITUD_CRIPTOMONEDA = 16;
const PATRON_TRANSACCION = /^[A-Za-z0-9._:-]+$/;

@Component({
  selector: 'app-formulario-comprobante',
  templateUrl: './formulario-comprobante.component.html',
  styleUrls: ['./formulario-comprobante.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes, ReactiveFormsModule],
})
export class FormularioComprobanteComponent {
  readonly vistaPrevia = input<string | null>(null);
  readonly enviando = input<boolean>(false);
  readonly textoPeriodo = input<string | null>(null);
  readonly tituloEnvio = input<string>('Enviar comprobante');

  // Método ya elegido en el paso anterior: no se vuelve a preguntar.
  readonly metodoElegido = input<MetodoPago | null>(null);

  readonly seleccionarImagen = output<Event>();
  readonly enviar = output<SolicitudComprobante>();

  readonly metodosPago: readonly { valor: MetodoPago; etiqueta: string }[] = [
    { valor: 'BANCO', etiqueta: 'Transferencia bancaria' },
    { valor: 'PAYPAL', etiqueta: 'PayPal' },
    { valor: 'CRIPTOMONEDA', etiqueta: 'Criptomoneda' },
  ];

  readonly formulario = new FormGroup({
    metodoPago: new FormControl<MetodoPago | null>(null, [Validators.required]),
    idTransaccion: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(MAX_LONGITUD_TRANSACCION),
        Validators.pattern(PATRON_TRANSACCION),
      ],
    }),
    correoTransaccion: new FormControl('', { nonNullable: true }),
    criptomoneda: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const metodo = this.metodoElegido();
      if (metodo === null) return;
      this.formulario.controls.metodoPago.setValue(metodo);
      this.alCambiarMetodoPago(metodo);
      if (metodo === 'CRIPTOMONEDA' && this.formulario.controls.criptomoneda.value === '') {
        this.formulario.controls.criptomoneda.setValue('USDT');
      }
    });
  }

  etiquetaMetodo(metodo: MetodoPago | null): string {
    return this.metodosPago.find((opcion) => opcion.valor === metodo)?.etiqueta ?? '';
  }

  alCambiarMetodoPago(metodo: MetodoPago | null): void {
    const { correoTransaccion, criptomoneda } = this.formulario.controls;
    correoTransaccion.setValidators(
      metodo === 'PAYPAL' ? [Validators.required, Validators.email] : [],
    );
    criptomoneda.setValidators(
      metodo === 'CRIPTOMONEDA'
        ? [Validators.required, Validators.maxLength(MAX_LONGITUD_CRIPTOMONEDA)]
        : [],
    );
    correoTransaccion.updateValueAndValidity();
    criptomoneda.updateValueAndValidity();
  }

  alElegirImagen(evento: Event): void {
    this.seleccionarImagen.emit(evento);
    // Permite volver a elegir el mismo archivo si la imagen fue rechazada.
    (evento.target as HTMLInputElement).value = '';
  }

  alEnviar(): void {
    const imagen = this.vistaPrevia();
    if (this.formulario.invalid || imagen === null) {
      this.formulario.markAllAsTouched();
      return;
    }
    const { metodoPago, idTransaccion, correoTransaccion, criptomoneda } =
      this.formulario.getRawValue();
    if (metodoPago === null) return;
    this.enviar.emit({
      metodoPago,
      idTransaccion: idTransaccion.trim(),
      comprobante: imagen,
      ...(metodoPago === 'PAYPAL' ? { correoTransaccion: correoTransaccion.trim() } : {}),
      ...(metodoPago === 'CRIPTOMONEDA' ? { criptomoneda: criptomoneda.trim() } : {}),
    });
  }
}
