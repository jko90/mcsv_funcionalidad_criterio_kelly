import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertaCkComponent } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { ALERTA_OMITIR_PIN } from 'src/app/compartidos/textos-alertas';

const PATRON_PIN = /^\d{6}$/;
const LONGITUD_PIN = 6;

const crearControlPin = (): FormControl<string> =>
  new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(PATRON_PIN)],
  });

@Component({
  selector: 'app-modal-pin',
  templateUrl: './modal-pin.component.html',
  styleUrls: ['./modal-pin.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonicComponentes, AlertaCkComponent],
})
export class ModalPinComponent {
  /** Mientras guarda se muestra la imagen y no se aceptan más pulsaciones. */
  readonly guardando = input(false);

  readonly pinConfirmado = output<string>();
  readonly pinDistinto = output<void>();
  readonly omitido = output<void>();

  readonly titulo = 'Crear PIN';
  readonly alertaOmitirPin = ALERTA_OMITIR_PIN;
  readonly omitirPinPendiente = signal(false);

  readonly formularioPin = new FormGroup({
    ingPin: crearControlPin(),
    confPin: crearControlPin(),
  });

  alIngresarPin(): void {
    if (this.guardando()) return;
    const { ingPin, confPin } = this.formularioPin.getRawValue();
    if (ingPin.length !== LONGITUD_PIN || confPin.length !== LONGITUD_PIN) return;

    if (ingPin !== confPin) {
      this.formularioPin.reset();
      this.pinDistinto.emit();
      return;
    }
    this.pinConfirmado.emit(confPin);
    this.formularioPin.reset();
  }

  alSolicitarOmitirPin(): void {
    this.omitirPinPendiente.set(true);
  }

  alDescartarOmitirPin(): void {
    this.omitirPinPendiente.set(false);
  }

  alConfirmarOmitirPin(): void {
    this.omitirPinPendiente.set(false);
    this.omitido.emit();
  }
}
