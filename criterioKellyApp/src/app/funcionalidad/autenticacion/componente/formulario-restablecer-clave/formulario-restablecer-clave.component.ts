import {
  ChangeDetectionStrategy,
  Component,
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
import {
  MENSAJES_POLITICA_CLAVE,
  politicaClaveValidator,
} from 'src/app/compartidos/validadores/politica-clave.validator';
import { DatosRestablecimiento } from '../../modelo/RecuperacionClave.modelo';

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
  selector: 'app-formulario-restablecer-clave',
  standalone: true,
  imports: [IonicComponentes, ReactiveFormsModule],
  templateUrl: './formulario-restablecer-clave.component.html',
  styleUrls: ['./formulario-restablecer-clave.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioRestablecerClaveComponent {
  readonly estaCargando = input(false);
  readonly correo = input.required<string>();
  readonly restablecimientoEnviado = output<DatosRestablecimiento>();
  readonly solicitarOtroCodigo = output<void>();
  readonly mensajes = MENSAJES_POLITICA_CLAVE;
  readonly formulario = new FormGroup(
    {
      codigo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
      }),
      claveNueva: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          politicaClaveValidator({ correo: '' }),
        ],
      }),
      confirmacion: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: clavesCoinciden },
  );

  enviar(): void {
    const clave = this.formulario.controls.claveNueva;
    clave.setValidators([
      Validators.required,
      politicaClaveValidator({ correo: this.correo() }),
    ]);
    clave.updateValueAndValidity();
    this.formulario.controls.confirmacion.updateValueAndValidity();
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.restablecimientoEnviado.emit({
      codigo: this.formulario.controls.codigo.value,
      claveNueva: clave.value,
    });
  }
}
