import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import {
  ETIQUETAS_TIPO_CUENTA,
} from '../../configuracion/textos-datos-pago';
import {
  LONGITUD_MAXIMA_ENTIDAD,
  LONGITUD_MAXIMA_OBSERVACIONES,
  LONGITUD_MAXIMA_PLANTILLA,
  LONGITUD_MAXIMA_TITULAR,
  MENSAJE_CUENTA_SIN_TITULAR,
  mensajeErrorCuenta,
  mensajeErrorDocumento,
  mensajeErrorEntidad,
  mensajeErrorNumeroWhatsapp,
  mensajeErrorPaisMoneda,
  mensajeErrorTipoCuenta,
  mensajeErrorTitular,
  normalizarCuenta,
  normalizarNumeroWhatsapp,
  validadorDeFormato,
} from '../../configuracion/validadores-pago';
import {
  CuerpoGuardarBanco,
  MetodoPagoAdmin,
  TIPOS_CUENTA_BANCO,
} from '../../modelos/DatosPagoAdmin.modelo';

// Si se escribe la cuenta, el servidor exige también titular y banco.
function validadorCuentaCompleta(grupo: AbstractControl): ValidationErrors | null {
  const texto = (nombre: string): string => {
    const valor: unknown = grupo.get(nombre)?.value;
    return typeof valor === 'string' ? valor.trim() : '';
  };
  const faltaDato = texto('mep_bancoTitular') === '' || texto('mep_bancoEntidad') === '';
  return texto('mep_bancoCuenta') !== '' && faltaDato
    ? { cuentaSinTitular: MENSAJE_CUENTA_SIN_TITULAR }
    : null;
}

@Component({
  selector: 'app-formulario-banco',
  templateUrl: './formulario-banco.component.html',
  styleUrls: ['./formulario-banco.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes, ReactiveFormsModule],
})
export class FormularioBancoComponent {
  readonly metodo = input<MetodoPagoAdmin | null>(null);
  readonly estaGuardando = input(false);

  readonly bancoEnviado = output<CuerpoGuardarBanco>();
  readonly estadoMetodoCambiado = output<boolean>();

  readonly maximoPlantilla = LONGITUD_MAXIMA_PLANTILLA;
  readonly maximoTitular = LONGITUD_MAXIMA_TITULAR;
  readonly maximoEntidad = LONGITUD_MAXIMA_ENTIDAD;
  readonly maximoObservaciones = LONGITUD_MAXIMA_OBSERVACIONES;
  readonly ayudaPlantilla =
    'Puedes usar {plan} y {monto}. Si la dejas vacía se usa el texto estándar.';
  readonly tiposCuenta = TIPOS_CUENTA_BANCO.map((valor) => ({
    valor,
    etiqueta: ETIQUETAS_TIPO_CUENTA[valor],
  }));

  readonly formulario = new FormGroup(
    {
      mep_bancoNumero: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, validadorDeFormato(mensajeErrorNumeroWhatsapp)],
      }),
      mep_bancoPlantilla: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(LONGITUD_MAXIMA_PLANTILLA)],
      }),
      mep_bancoTitular: new FormControl('', {
        nonNullable: true,
        validators: [validadorDeFormato(mensajeErrorTitular)],
      }),
      mep_bancoDocumento: new FormControl('', {
        nonNullable: true,
        validators: [validadorDeFormato(mensajeErrorDocumento)],
      }),
      mep_bancoEntidad: new FormControl('', {
        nonNullable: true,
        validators: [validadorDeFormato(mensajeErrorEntidad)],
      }),
      mep_bancoTipoCuenta: new FormControl('', {
        nonNullable: true,
        validators: [validadorDeFormato(mensajeErrorTipoCuenta)],
      }),
      mep_bancoCuenta: new FormControl('', {
        nonNullable: true,
        validators: [validadorDeFormato(mensajeErrorCuenta)],
      }),
      mep_bancoPaisMoneda: new FormControl('', {
        nonNullable: true,
        validators: [validadorDeFormato(mensajeErrorPaisMoneda)],
      }),
      mep_bancoObservaciones: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(LONGITUD_MAXIMA_OBSERVACIONES)],
      }),
    },
    { validators: [validadorCuentaCompleta] },
  );

  readonly controles = this.formulario.controls;
  readonly estaMetodoActivo = computed(() => this.metodo()?.mep_activo === 1);

  private readonly valorFormulario = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });
  readonly mensajeCuentaSinTitular = computed<string | null>(() => {
    this.valorFormulario();
    const error: unknown = this.formulario.errors?.['cuentaSinTitular'];
    return typeof error === 'string' ? error : null;
  });
  readonly puedeEnviar = computed(() => {
    this.valorFormulario();
    return this.formulario.valid && !this.estaGuardando();
  });

  constructor() {
    effect(() => {
      const metodo = this.metodo();
      this.formulario.reset({
        mep_bancoNumero: metodo?.mep_bancoNumero ?? '',
        mep_bancoPlantilla: metodo?.mep_bancoPlantilla ?? '',
        mep_bancoTitular: metodo?.mep_bancoTitular ?? '',
        mep_bancoDocumento: metodo?.mep_bancoDocumento ?? '',
        mep_bancoEntidad: metodo?.mep_bancoEntidad ?? '',
        mep_bancoTipoCuenta: metodo?.mep_bancoTipoCuenta ?? '',
        mep_bancoCuenta: metodo?.mep_bancoCuenta ?? '',
        mep_bancoPaisMoneda: metodo?.mep_bancoPaisMoneda ?? '',
        mep_bancoObservaciones: metodo?.mep_bancoObservaciones ?? '',
      });
    });
  }

  alEnviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const valores = this.formulario.getRawValue();
    this.bancoEnviado.emit({
      mep_bancoNumero: normalizarNumeroWhatsapp(valores.mep_bancoNumero),
      mep_bancoPlantilla: valores.mep_bancoPlantilla.trim(),
      mep_bancoTitular: valores.mep_bancoTitular.trim(),
      mep_bancoDocumento: valores.mep_bancoDocumento.trim(),
      mep_bancoEntidad: valores.mep_bancoEntidad.trim(),
      mep_bancoTipoCuenta: valores.mep_bancoTipoCuenta,
      mep_bancoCuenta: normalizarCuenta(valores.mep_bancoCuenta),
      mep_bancoPaisMoneda: valores.mep_bancoPaisMoneda.trim(),
      mep_bancoObservaciones: valores.mep_bancoObservaciones.trim(),
    });
  }
}
