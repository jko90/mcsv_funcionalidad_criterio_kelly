import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { CambiarClaveRequest } from '../../modelos/Perfil.modelo';
import {
  MENSAJES_POLITICA_CLAVE,
  politicaClaveValidator,
} from 'src/app/compartidos/validadores/politica-clave.validator';

const clavesCoinciden = (
  control: AbstractControl,
): { clavesNoCoinciden: true } | null => {
  const grupo = control as FormGroup;
  return grupo.controls['claveNueva'].value ===
    grupo.controls['confirmacion'].value
    ? null
    : { clavesNoCoinciden: true };
};

@Component({
  selector: 'app-formulario-cambio-clave',
  standalone: true,
  imports: [IonicComponentes, ReactiveFormsModule],
  templateUrl: './formulario-cambio-clave.component.html',
  styleUrls: ['./formulario-cambio-clave.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioCambioClaveComponent {
  readonly estaCargando = input(false);
  readonly reinicioSolicitado = input(0);
  readonly cambioClaveEnviado = output<CambiarClaveRequest>();
  readonly mensajes = MENSAJES_POLITICA_CLAVE;
  readonly formulario = new FormGroup(
    {
      claveActual: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      claveNueva: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, politicaClaveValidator({})],
      }),
      confirmacion: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: clavesCoinciden },
  );

  constructor() {
    effect(() => {
      this.reinicioSolicitado();
      this.formulario.reset();
    });
  }

  enviar(): void {
    this.formulario.controls.claveNueva.updateValueAndValidity();
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cambioClaveEnviado.emit({
      claveActual: this.formulario.controls.claveActual.value,
      claveNueva: this.formulario.controls.claveNueva.value,
    });
  }
}
