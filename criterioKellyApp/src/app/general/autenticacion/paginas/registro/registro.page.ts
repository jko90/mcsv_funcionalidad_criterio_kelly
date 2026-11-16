import { Component, effect, inject, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { Router } from '@angular/router';
import { DatosPersona } from '../../modelos/Persona.modelo';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { PersonaStore } from '../../store/personaStore';
import { VerificacionCorreoStore } from '../../store/verificacion-correo.store';
import { PlanesStore } from '../../../../negocio/suscripcion/store/PlanesStore';
import { PLAN_LIBRE_ID_INTERVALO } from '../../../../negocio/suscripcion/modelos/Suscripcion.modelo';
import { PlanReservadoService } from '../../../../negocio/suscripcion/servicios/plan-reservado.service';
import {
  ErroresPoliticaClave,
  MENSAJES_POLITICA_CLAVE,
  politicaClaveValidator,
} from 'src/app/compartidos/validadores/politica-clave.validator';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicComponentes, ReactiveFormsModule],
})
export class RegistroPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly _personaStore = inject(PersonaStore);
  private readonly _router = inject(Router);
  private readonly _planesStore = inject(PlanesStore);
  private readonly _planReservado = inject(PlanReservadoService);
  private readonly _verificacionCorreoStore = inject(VerificacionCorreoStore);
  private ultimoUsuarioEnviado = '';
  private ultimoCorreoEnviado = '';

  registroForm: FormGroup = this._inicializarFormulario();
  // El formulario no es una señal: sin esto los computed de abajo nunca se recalculan.
  private readonly cambiosFormulario = toSignal(this.registroForm.valueChanges, {
    initialValue: this.registroForm.value,
  });
  mostrarContrasena = false;
  mostrarConfirmarContrasena = false;

  planSeleccionado = this._planesStore.objPlanSeleccionado;
  isLoading = this._personaStore.isLoading;
  errorRegistro = this._personaStore.errorMessage;
  registroExitoso = this._personaStore.registroExitoso;
  // Dato de la selección local: aún no hay sesión para consultar al servidor.
  readonly mensajePlanPendiente = computed(() => {
    const plan = this.planSeleccionado();
    if (!this.registroExitoso() || !plan || plan.pin_precioFinal <= 0) {
      return null;
    }
    return `Tu plan ${plan.pla_nombre} quedará pendiente de pago: se activará cuando el administrador valide tu comprobante`;
  });

  readonly pasos = ['Datos Personales', 'Datos de Acceso', 'Confirmación'];
  readonly pasoActual = signal(0);
  readonly mensajesPoliticaClave = MENSAJES_POLITICA_CLAVE;

  readonly pasoPersonalValido = computed(() => {
    this.cambiosFormulario();
    const c = this.registroForm;
    return (
      c.get('nombres')?.valid &&
      c.get('apellidos')?.valid &&
      c.get('telefono')?.valid &&
      c.get('correo')?.valid
    );
  });

  readonly pasoCuentaValido = computed(() => {
    this.cambiosFormulario();
    const c = this.registroForm;
    return (
      c.get('usuario')?.valid &&
      c.get('contrasena')?.valid &&
      c.get('confirmarContrasena')?.valid &&
      !c.hasError('noCoinciden')
    );
  });

  readonly fortalezaContrasena = computed(() => {
    this.cambiosFormulario();
    const valor = this.registroForm.get('contrasena')?.value || '';
    return this._calcularFortaleza(valor);
  });

  constructor() {
    effect(() => {
      if (this._personaStore.registroExitoso()) {
        const plan = this.planSeleccionado();
        this._planReservado.reservar(
          this.ultimoUsuarioEnviado,
          plan?.pin_idPlanInterv ?? PLAN_LIBRE_ID_INTERVALO,
        );
        this._utilServicio.mostrarToast(
          this._personaStore.respuestaRegistro()?.mensaje ??
            'Registro recibido',
          'success',
        );
        this.limpiarFormulario();
        this._personaStore.limpiar();
        this._verificacionCorreoStore.iniciar({
          correo: this.ultimoCorreoEnviado,
          codigoEnviado: true,
        });
        this._router.navigate(['/verificar-correo']);
      }
    });
  }

  private readonly _utilServicio = inject(UtilitariosService);

  siguientePaso(): void {
    if (this.pasoActual() < this.pasos.length - 1) {
      this.pasoActual.update((v) => v + 1);
    }
  }

  pasoAnterior(): void {
    if (this.pasoActual() > 0) {
      this.pasoActual.update((v) => v - 1);
    }
  }

  esCampoInvalido(campo: string): boolean {
    const control = this.registroForm.get(campo);
    return !!(control?.touched && control?.errors);
  }

  getError(campo: string, error: string): boolean {
    return !!this.registroForm.get(campo)?.errors?.[error];
  }

  getErrorPolitica(campo: string): ErroresPoliticaClave | null {
    const errores = this.registroForm.get(campo)?.errors?.['politicaClave'];
    return (errores as ErroresPoliticaClave | undefined) ?? null;
  }

  registrarUsuario(): void {
    this.registroForm.get('contrasena')?.updateValueAndValidity();
    if (this.registroForm.invalid) {
      this._marcarCamposComoTocados();
      return;
    }
    const cedula = this.registroForm.value.cedula?.trim();
    if (cedula && cedula.length !== 10) {
      this._utilServicio.mostrarToast(
        'La cédula debe tener exactamente 10 dígitos',
        'warning',
      );
      this.registroForm.get('cedula')?.setErrors({ invalidLength: true });
      this.registroForm.get('cedula')?.markAsTouched();
      return;
    }

    const datosPersona: DatosPersona = {
      nombres: this.registroForm.value.nombres.trim(),
      apellidos: this.registroForm.value.apellidos.trim(),
      cedula: cedula || undefined,
      telefono: this.registroForm.value.telefono.trim(),
      correo: this.registroForm.value.correo.trim(),
      usuario: this.registroForm.value.usuario.trim(),
      clave: this.registroForm.value.contrasena,
    };

    this.ultimoUsuarioEnviado = datosPersona.usuario;
    this.ultimoCorreoEnviado = datosPersona.correo;
    this._personaStore.registrarPersona(datosPersona);
  }

  alternarMostrarContrasena(): void {
    this.mostrarContrasena = !this.mostrarContrasena;
  }

  alternarMostrarConfirmarContrasena(): void {
    this.mostrarConfirmarContrasena = !this.mostrarConfirmarContrasena;
  }

  limpiarFormulario(): void {
    this.registroForm.reset();
    this.mostrarContrasena = false;
    this.mostrarConfirmarContrasena = false;
    this.pasoActual.set(0);
  }

  irAVerificarCorreo(): void {
    this._verificacionCorreoStore.iniciar({ correo: '', codigoEnviado: false });
    this._router.navigate(['/verificar-correo']);
  }

  irALogin(): void {
    this._router.navigate(['/login']);
  }

  private _inicializarFormulario(): FormGroup {
    return this.formBuilder.group(
      {
        nombres: ['', [Validators.required, Validators.minLength(2)]],
        apellidos: ['', [Validators.required, Validators.minLength(2)]],
        cedula: ['', [Validators.maxLength(13)]],
        telefono: [
          '',
          [Validators.required, Validators.pattern(/^[0-9+\-\s()]+$/)],
        ],
        correo: ['', [Validators.required, Validators.email]],
        usuario: ['', [Validators.required, Validators.minLength(4)]],
        contrasena: [
          '',
          [
            Validators.required,
            politicaClaveValidator({
              campoUsuario: 'usuario',
              campoCorreo: 'correo',
            }),
          ],
        ],
        confirmarContrasena: ['', [Validators.required]],
      },
      {
        validators: this._validarContrasenas,
      },
    );
  }

  private _validarContrasenas(
    formGroup: AbstractControl,
  ): { [key: string]: boolean } | null {
    const contrasena = formGroup.get('contrasena')?.value;
    const confirmarContrasena = formGroup.get('confirmarContrasena')?.value;

    if (
      contrasena &&
      confirmarContrasena &&
      contrasena !== confirmarContrasena
    ) {
      formGroup.get('confirmarContrasena')?.setErrors({ noCoinciden: true });
      return { noCoinciden: true };
    }

    const confirmControl = formGroup.get('confirmarContrasena');
    if (confirmControl?.hasError('noCoinciden')) {
      const errors = { ...confirmControl.errors };
      delete errors['noCoinciden'];
      confirmControl.setErrors(Object.keys(errors).length > 0 ? errors : null);
    }

    return null;
  }

  private _marcarCamposComoTocados(): void {
    Object.keys(this.registroForm.controls).forEach((key) => {
      this.registroForm.get(key)?.markAsTouched();
    });
  }

  private _calcularFortaleza(valor: string): {
    porcentaje: number;
    color: string;
    etiqueta: string;
  } {
    if (!valor)
      return { porcentaje: 0, color: 'var(--ion-color-medium)', etiqueta: '' };

    let puntuacion = 0;
    if (valor.length >= 6) puntuacion += 20;
    if (valor.length >= 10) puntuacion += 10;
    if (/[a-z]/.test(valor)) puntuacion += 15;
    if (/[A-Z]/.test(valor)) puntuacion += 15;
    if (/\d/.test(valor)) puntuacion += 15;
    if (/[^a-zA-Z0-9]/.test(valor)) puntuacion += 15;
    if (valor.length >= 14) puntuacion += 10;

    puntuacion = Math.min(100, puntuacion);

    if (puntuacion < 40)
      return { porcentaje: puntuacion, color: '#eb445a', etiqueta: 'Débil' };
    if (puntuacion < 70)
      return { porcentaje: puntuacion, color: '#ffc409', etiqueta: 'Media' };
    return { porcentaje: puntuacion, color: '#2dd36f', etiqueta: 'Fuerte' };
  }
}
