import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';

@Component({
  selector: 'app-formulario-solicitar-codigo',
  standalone: true,
  imports: [IonicComponentes, ReactiveFormsModule],
  templateUrl: './formulario-solicitar-codigo.component.html',
  styleUrls: ['./formulario-solicitar-codigo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioSolicitarCodigoComponent {
  readonly estaCargando = input(false);
  readonly correoInicial = input('');
  readonly solicitudEnviada = output<string>();
  readonly formulario = new FormGroup({
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.solicitudEnviada.emit(this.formulario.controls.correo.value.trim());
  }
}
