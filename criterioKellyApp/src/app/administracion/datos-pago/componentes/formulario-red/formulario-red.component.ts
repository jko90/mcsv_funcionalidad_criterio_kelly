import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import {
  LONGITUD_ETIQUETA_RED,
  LONGITUD_NOMBRE_RED,
  mensajeErrorClaveRed,
  normalizarClaveRed,
  validadorDeFormato,
  validadorDireccionDeRed,
} from '../../configuracion/validadores-pago';
import { CuerpoGuardarRed, RedUsdtAdmin } from '../../modelos/DatosPagoAdmin.modelo';

const ORDEN_INICIAL = 0;

@Component({
  selector: 'app-formulario-red',
  templateUrl: './formulario-red.component.html',
  styleUrls: ['./formulario-red.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes, ReactiveFormsModule],
})
export class FormularioRedComponent {
  // Con red se edita (la clave no cambia); sin red se crea una nueva.
  readonly red = input<RedUsdtAdmin | null>(null);
  readonly estaGuardando = input(false);

  readonly redEnviada = output<CuerpoGuardarRed>();
  readonly cancelado = output<void>();

  readonly maximoNombre = LONGITUD_NOMBRE_RED;
  readonly maximoEtiqueta = LONGITUD_ETIQUETA_RED;

  readonly formulario = new FormGroup({
    red_clave: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validadorDeFormato(mensajeErrorClaveRed)],
    }),
    red_nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LONGITUD_NOMBRE_RED)],
    }),
    red_etiqueta: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LONGITUD_ETIQUETA_RED)],
    }),
    red_direccion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validadorDireccionDeRed],
    }),
    red_activo: new FormControl(true, { nonNullable: true }),
    red_orden: new FormControl(ORDEN_INICIAL, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  });

  readonly controles = this.formulario.controls;
  readonly esEdicion = computed(() => this.red() !== null);

  private readonly valorFormulario = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });
  private readonly claveEscrita = toSignal(this.controles.red_clave.valueChanges, {
    initialValue: '',
  });

  readonly puedeEnviar = computed(() => {
    this.valorFormulario();
    return this.formulario.valid && !this.estaGuardando();
  });

  constructor() {
    effect(() => this.cargarRed(this.red()));
    // La dirección se valida según la red: al cambiar la clave se vuelve a evaluar.
    effect(() => {
      this.claveEscrita();
      untracked(() => this.controles.red_direccion.updateValueAndValidity());
    });
  }

  alEnviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const valores = this.formulario.getRawValue();
    const red = this.red();
    this.redEnviada.emit({
      ...(red === null ? {} : { red_idRed: red.red_idRed }),
      red_clave: normalizarClaveRed(valores.red_clave),
      red_nombre: valores.red_nombre.trim(),
      red_etiqueta: valores.red_etiqueta.trim(),
      red_direccion: valores.red_direccion.trim(),
      red_activo: valores.red_activo ? 1 : 0,
      red_orden: Number(valores.red_orden),
    });
  }

  private cargarRed(red: RedUsdtAdmin | null): void {
    const { red_clave } = this.controles;
    if (red === null) {
      this.formulario.reset({ red_activo: true, red_orden: ORDEN_INICIAL });
      red_clave.enable();
      return;
    }
    this.formulario.reset({
      red_clave: red.red_clave,
      red_nombre: red.red_nombre,
      red_etiqueta: red.red_etiqueta,
      red_direccion: red.red_direccion,
      red_activo: red.red_activo === 1,
      red_orden: red.red_orden,
    });
    red_clave.disable();
  }
}
