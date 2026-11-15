import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import {
  LONGITUD_MAXIMA_CORREO,
  LONGITUD_MAXIMA_ENLACE,
  mensajeErrorCorreo,
  mensajeErrorEnlacePaypal,
  validadorDeFormato,
} from '../../configuracion/validadores-pago';
import { CuerpoGuardarPaypal, MetodoPagoAdmin } from '../../modelos/DatosPagoAdmin.modelo';

@Component({
  selector: 'app-formulario-paypal',
  templateUrl: './formulario-paypal.component.html',
  styleUrls: ['./formulario-paypal.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes, ReactiveFormsModule],
})
export class FormularioPaypalComponent {
  readonly metodo = input<MetodoPagoAdmin | null>(null);
  readonly estaGuardando = input(false);

  readonly paypalEnviado = output<CuerpoGuardarPaypal>();
  readonly estadoMetodoCambiado = output<boolean>();

  readonly maximoCorreo = LONGITUD_MAXIMA_CORREO;
  readonly maximoEnlace = LONGITUD_MAXIMA_ENLACE;

  readonly formulario = new FormGroup({
    mep_paypalCorreo: new FormControl('', {
      nonNullable: true,
      validators: [validadorDeFormato(mensajeErrorCorreo)],
    }),
    mep_paypalEnlace: new FormControl('', {
      nonNullable: true,
      validators: [validadorDeFormato(mensajeErrorEnlacePaypal)],
    }),
  });

  readonly controles = this.formulario.controls;
  readonly estaMetodoActivo = computed(() => this.metodo()?.mep_activo === 1);

  private readonly valorFormulario = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });
  readonly puedeEnviar = computed(() => {
    this.valorFormulario();
    return this.formulario.valid && !this.estaGuardando();
  });

  constructor() {
    effect(() => {
      const metodo = this.metodo();
      this.formulario.reset({
        mep_paypalCorreo: metodo?.mep_paypalCorreo ?? '',
        mep_paypalEnlace: metodo?.mep_paypalEnlace ?? '',
      });
    });
  }

  alEnviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const { mep_paypalCorreo, mep_paypalEnlace } = this.formulario.getRawValue();
    this.paypalEnviado.emit({
      mep_paypalCorreo: mep_paypalCorreo.trim(),
      mep_paypalEnlace: mep_paypalEnlace.trim(),
    });
  }
}
