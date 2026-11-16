import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { Router } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { App } from '@capacitor/app';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { NombreUsuarioSesion } from 'src/app/compartidos/seguridad/NombreUsuarioSesion';
import { DbPINWebStore } from 'src/app/compartidos/store/dbPIN-web.store';
import { DbPINAppStore } from 'src/app/compartidos/store/dbPIN-app.store';
import { Capacitor } from '@capacitor/core';
import type { OverlayEventDetail } from '@ionic/core';
import { IonModal } from '@ionic/angular/standalone';
import { ModalPinComponent } from '../../../../configuracion/bloqueo-pin/componentes/modal-pin/modal-pin.component';
import { PinFormularioStore } from '../../../../configuracion/bloqueo-pin/store/pin-formulario.store';
import { LoginStore } from '../../store/login.store';
import { SuscripcionStore } from '../../../../negocio/suscripcion/store/SuscripcionStore';
import { VerificacionCorreoStore } from '../../../../general/autenticacion/store/verificacion-correo.store';

interface ModalPinResult {
  omitido?: boolean;
  pinCreado?: boolean;
}

const PUNTOS_RUPTURA_MODAL_PIN = [0, 0.5, 0.8, 1];
const PUNTO_INICIAL_MODAL_PIN = 0.5;

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    ReactiveFormsModule,
    ModalPinComponent,
  ],
})
export class LoginPage {
  private readonly router = inject(Router);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly sesionStore = inject(SesionStore);
  private readonly nombreUsuarioSesion = inject(NombreUsuarioSesion);
  private readonly dbWebStore = inject(DbPINWebStore);
  private readonly dbAppStore = inject(DbPINAppStore);
  private readonly loginStore = inject(LoginStore);
  private readonly suscripcionStore = inject(SuscripcionStore);
  private readonly verificacionCorreoStore = inject(VerificacionCorreoStore);
  private readonly pinFormularioStore = inject(PinFormularioStore);

  readonly isLoading = signal(false);
  readonly mostrarClave = signal(false);
  readonly estaModalPinAbierto = signal(false);
  readonly puntosRupturaModalPin = PUNTOS_RUPTURA_MODAL_PIN;
  readonly puntoInicialModalPin = PUNTO_INICIAL_MODAL_PIN;
  readonly guardandoPin = this.pinFormularioStore.guardando;

  private readonly isWeb = Capacitor.getPlatform() === 'web';

  readonly loginForm = new FormGroup({
    usuario: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    contrasenia: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  async ionViewWillEnter(): Promise<void> {
    this.limpiarFormulario();
    this.sesionStore.restaurarSesion();
    try {
      await this.utilServicio.esperarCargaDeStore(() =>
        this.sesionStore.estaRestaurando(),
      );
    } catch {
      return;
    }
    if (this.sesionStore.estaAutenticado()) {
      await this.router.navigate(['/bloqueo']);
    }
  }

  campoInvalido(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  marcarCampoTocado(fieldName: string): void {
    this.loginForm.get(fieldName)?.markAsTouched();
  }

  private marcarTodosLosCampos(): void {
    Object.keys(this.loginForm.controls).forEach((key) => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  alternarMostrarClave(): void {
    this.mostrarClave.update((value) => !value);
  }

  irACrearCuenta(): void {
    this.router.navigate(['/planes']);
  }

  irARecuperarClave(): void {
    this.router.navigate(['/recuperar-clave']);
  }

  irAVerificarCorreo(): void {
    this.verificacionCorreoStore.iniciar({ correo: '', codigoEnviado: false });
    this.router.navigate(['/verificar-correo']);
  }

  private limpiarFormulario(): void {
    this.loginForm.reset();
    this.isLoading.set(false);
    this.mostrarClave.set(false);
    this.loginForm.markAsPristine();
    this.loginForm.markAsUntouched();
  }

  iniciarValidacion(): void {
    if (this.loginForm.valid) {
      this.ejecutarValidacion();
    } else {
      this.marcarTodosLosCampos();
    }
  }

  private async ejecutarValidacion(): Promise<void> {
    this.isLoading.set(true);

    const { usuario, contrasenia } = this.loginForm.getRawValue();
    this.nombreUsuarioSesion.guardar(usuario);
    this.sesionStore.iniciarSesion({ usuario, clave: contrasenia });

    await this.utilServicio.esperarCargaDeStore(() =>
      this.sesionStore.isLoading(),
    );

    if (this.sesionStore.errorMessage()) {
      this.loginStore.registrarResultado(this.sesionStore.estadoUltimoError());
      this.limpiarFormulario();

      if (this.loginStore.intentosAgotados()) {
        await this.utilServicio.mostrarToast(
          'Máximo número de intentos alcanzado. La aplicación se cerrará.',
          'danger',
        );
        this.isLoading.set(false);
        App.exitApp();
        return;
      }
      this.isLoading.set(false);
      return;
    }

    this.loginStore.reiniciarIntentos();
    await this.asegurarSuscripcionInicial(usuario);
    await this.validarPIN();
    this.limpiarFormulario();
    this.isLoading.set(false);
    this.navegarAInicio();
  }

  private async asegurarSuscripcionInicial(usuario: string): Promise<void> {
    const usuarioId = this.sesionStore.usuario()?.id;
    if (!usuarioId) return;

    this.suscripcionStore.asegurarSuscripcionInicial({ usuarioId, usuario });
    try {
      await this.utilServicio.esperarCargaDeStore(() =>
        this.suscripcionStore.isLoading(),
      );
    } catch {
      // Si la espera de 5 s se agota, el inicio de sesión continúa: la
      // suscripción inicial se reintenta en el siguiente login.
    }
  }

  private async validarPIN(): Promise<void> {
    const usuarioId = this.sesionStore.usuario()?.id;
    if (!usuarioId) return;

    const store = this.isWeb ? this.dbWebStore : this.dbAppStore;
    store.cargarPinBloqueo(usuarioId);
    await this.utilServicio.esperarCargaDeStore(() => store.isLoading());

    if (!store.tienePin()) {
      this.estaModalPinAbierto.set(true);
    }
  }

  alCerrarModalPin(
    evento: CustomEvent<OverlayEventDetail<ModalPinResult>>,
  ): void {
    this.estaModalPinAbierto.set(false);
    const resultado = evento.detail.data;
    if (resultado?.omitido || resultado?.pinCreado) {
      this.navegarAInicio();
    }
  }

  async alConfirmarPin(pin: string, modalPin: IonModal): Promise<void> {
    this.pinFormularioStore.guardar(pin);
    await this.utilServicio.esperarCargaDeStore(() =>
      this.pinFormularioStore.isLoading(),
    );
    await this.utilServicio.mostrarToast(
      this.pinFormularioStore.mensajeResultado(),
      this.pinFormularioStore.colorAviso(),
    );
    await modalPin.dismiss({ pinCreado: this.pinFormularioStore.pinCreado() });
  }

  async alMostrarPinDistinto(): Promise<void> {
    await this.utilServicio.mostrarToast(
      'Digite el mismo valor en las dos opciones',
      'danger',
    );
  }

  async alOmitirPin(modalPin: IonModal): Promise<void> {
    await modalPin.dismiss({ omitido: true });
  }

  private navegarAInicio(): void {
    this.router.navigate(['/inicio']);
  }
}
