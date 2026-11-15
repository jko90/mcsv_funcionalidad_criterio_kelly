import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { ActivacionCuenta } from '../../modelos/VerificacionCorreo.modelo';

const PATRON_CODIGO_SEIS_DIGITOS = /^\d{6}$/;

@Component({
  selector: 'app-formulario-verificar-correo',
  standalone: true,
  imports: [IonicComponentes, ReactiveFormsModule],
  templateUrl: './formulario-verificar-correo.component.html',
  styleUrls: ['./formulario-verificar-correo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioVerificarCorreoComponent {
  readonly correo = input('');
  readonly estaCargando = input(false);
  readonly segundosRestantes = input(0);
  readonly mensajeReenvio = input<string | null>(null);

  readonly activacionEnviada = output<ActivacionCuenta>();
  readonly reenvioSolicitado = output<string>();
  readonly volverAlLogin = output<void>();

  readonly esCorreoFijo = computed(() => this.correo() !== '');

  readonly formulario = new FormGroup({
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(PATRON_CODIGO_SEIS_DIGITOS),
      ],
    }),
  });

  constructor() {
    effect(() => {
      this.formulario.controls.correo.setValue(this.correo());
    });
  }

  activar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const { correo, codigo } = this.formulario.getRawValue();
    this.activacionEnviada.emit({ correo: correo.trim(), codigo });
  }

  reenviar(): void {
    const controlCorreo = this.formulario.controls.correo;
    if (
      controlCorreo.invalid ||
      this.segundosRestantes() > 0 ||
      this.estaCargando()
    ) {
      return;
    }
    this.reenvioSolicitado.emit(controlCorreo.value.trim());
  }
}
