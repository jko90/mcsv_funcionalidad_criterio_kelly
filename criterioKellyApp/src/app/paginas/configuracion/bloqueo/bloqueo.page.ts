import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { NavController } from '@ionic/angular';
import { AlertInput } from '@ionic/angular/standalone';
import { AlertaCkComponent, ValoresCamposAlerta } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import { ALERTA_BLOQUEO_SIN_PIN, TEXTO_SALIR } from 'src/app/compartidos/textos-alertas';
import { firstValueFrom } from 'rxjs';
import { NombreUsuarioSesion } from 'src/app/compartidos/seguridad/NombreUsuarioSesion';
import { SesionService } from 'src/app/compartidos/servicios/sesion.service';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DbPINWebStore } from 'src/app/compartidos/store/dbPIN-web.store';
import { DbPINAppStore } from 'src/app/compartidos/store/dbPIN-app.store';
import { Capacitor } from '@capacitor/core';
import { ServicioInactividad } from 'src/app/compartidos/seguridad/ServicioInactividad';

const MAX_INTENTOS_CLAVE = 3;

@Component({
  selector: 'app-bloqueo',
  templateUrl: './bloqueo.page.html',
  styleUrls: ['./bloqueo.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicComponentes, EncabezadoComponent, AlertaCkComponent],
})
export class BloqueoPage {
  private readonly navCtrl = inject(NavController);
  private readonly servicioInactividad = inject(ServicioInactividad);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly dbWebStore = inject(DbPINWebStore);
  private readonly dbAppStore = inject(DbPINAppStore);
  private readonly nombreUsuario = inject(NombreUsuarioSesion);
  private readonly sesionServicio = inject(SesionService);
  private readonly esWeb =Capacitor.getPlatform() === 'web';

  readonly alertaClave = ALERTA_BLOQUEO_SIN_PIN;
  readonly textoSalir = TEXTO_SALIR;
  readonly camposClave: AlertInput[] = [{ name: 'clave', type: 'password', placeholder: 'Contraseña' }];
  readonly alertaClaveAbierta = signal(false);

  titulo = 'CRITERIO KELLY';
  loading = signal(false);
  passcodeWrong = signal(false);
  passcodeAttempts = signal(0);
  enteredPasscode = signal('');
  passcodeLabel = signal('PIN de acceso');
  usuarioActual = 0;

  // La página se reutiliza entre sesiones: el usuario se lee al entrar, no al construir.
  async ionViewWillEnter(): Promise<void> {
    this.usuarioActual = this.authService.obtenerUsuarioActual()?.id ?? 0;
    this.enteredPasscode.set('');
    this.passcodeAttempts.set(0);
    this.passcodeWrong.set(false);
    if (!this.usuarioActual) {
      await this.servicioInactividad.salir();
      return;
    }
    const store = this.esWeb ? this.dbWebStore : this.dbAppStore;
    store.cargarPinBloqueo(this.usuarioActual);
    await this.utilServicio.esperarCargaDeStore(() => store.isLoading());
    if (!store.tienePin() && !store.errorMessage()) this.exigirClave();
  }

  // Sin PIN registrado no hay con qué desbloquear: se pide la contraseña con una alerta.
  private exigirClave(): void {
    if (!this.nombreUsuario.obtener()) {
      void this.servicioInactividad.salir();
      return;
    }
    this.alertaClaveAbierta.set(true);
  }

  async alConfirmarClave(valores: ValoresCamposAlerta | void): Promise<void> {
    this.alertaClaveAbierta.set(false);
    const nombre = this.nombreUsuario.obtener();
    if (!nombre) {
      await this.servicioInactividad.salir();
      return;
    }
    // La contraseña solo vive en esta variable: no se guarda ni se registra.
    const clave = String(valores?.['clave'] ?? '');
    if (await this.claveCorrecta(nombre, clave)) {
      await this.navCtrl.navigateForward('/inicio');
      return;
    }
    this.passcodeAttempts.update((n) => n + 1);
    if (this.passcodeAttempts() >= MAX_INTENTOS_CLAVE) {
      await this.utilServicio.mostrarToast('Demasiados intentos fallidos', 'danger');
      await this.servicioInactividad.salir();
      return;
    }
    // Otro ciclo para que la alerta cerrada se refleje antes de reabrirla.
    await new Promise<void>((continuar) => setTimeout(continuar));
    this.exigirClave();
  }

  async alSalirDeClave(): Promise<void> {
    this.alertaClaveAbierta.set(false);
    await this.servicioInactividad.salir();
  }

  private async claveCorrecta(usuario: string, clave: string): Promise<boolean> {
    if (!clave) return false;
    try {
      const respuesta = await firstValueFrom(this.sesionServicio.autenticar({ usuario, clave }));
      return respuesta.id === this.usuarioActual;
    } catch {
      return false;
    }
  }

  borrarPin(): void { this.enteredPasscode.set(''); }
  borrarUltimo(): void { this.enteredPasscode.update((pin) => pin.slice(0, -1)); }

  capturarPin(digito: number): void {
    if (this.passcodeWrong() || this.enteredPasscode().length >= 6) return;
    this.enteredPasscode.update((pin) => pin + digito.toString());
    if (this.enteredPasscode().length === 6) void this.validarPin();
  }

  private async validarPin(): Promise<void> {
    if (!this.authService.estaAutenticado()) {
      await this.servicioInactividad.salir();
      return;
    }
    const store = this.esWeb ? this.dbWebStore : this.dbAppStore;
    store.verificarPin({ pin: this.enteredPasscode(), idUsuario: this.usuarioActual });
    await this.utilServicio.esperarCargaDeStore(() => store.isLoading());
    const resultado = store.resultadoVerificacion();
    if (resultado === 'sin-pin') {
      this.exigirClave();
      return;
    }
    if (resultado === 'correcto') {
      this.passcodeAttempts.set(0);
      this.enteredPasscode.set('');
      await this.utilServicio.mostrarToast('Bienvenido', 'success');
      await this.navCtrl.navigateForward('/inicio');
      return;
    }
    if (store.errorMessage()) {
      await this.utilServicio.mostrarToast(store.errorMessage() ?? 'No se pudo verificar el PIN', 'danger');
      return;
    }
    this.passcodeAttempts.update((intentos) => intentos + 1);
    this.passcodeWrong.set(true);
    await this.utilServicio.mostrarToast('PIN erróneo', 'warning');
    if (this.passcodeAttempts() > 3) {
      await this.utilServicio.mostrarToast('Demasiados intentos fallidos', 'danger');
      await this.servicioInactividad.salir();
      return;
    }
    setTimeout(() => {
      this.passcodeWrong.set(false);
      this.enteredPasscode.set('');
      this.passcodeLabel.set('PIN de acceso');
    }, 800);
  }

  refrescarPantalla(event: { target: { complete: () => void } }): void {
    event.target.complete();
  }
}
