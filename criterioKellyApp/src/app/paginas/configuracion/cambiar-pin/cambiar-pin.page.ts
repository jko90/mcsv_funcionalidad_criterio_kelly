import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { NavController } from '@ionic/angular';
import { AlertaCkComponent } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import { ALERTA_OLVIDE_PIN } from 'src/app/compartidos/textos-alertas';
import { ModalPinComponent } from '../componentes/modal-pin/modal-pin.component';
import { PinFormularioStore } from '../store/pin-formulario.store';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { ServicioInactividad } from 'src/app/compartidos/seguridad/ServicioInactividad';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DbPINWebStore } from 'src/app/compartidos/store/dbPIN-web.store';
import { DbPINAppStore } from 'src/app/compartidos/store/dbPIN-app.store';
import { Capacitor } from '@capacitor/core';
import type { OverlayEventDetail } from '@ionic/core';
import { IonModal } from '@ionic/angular/standalone';

@Component({
  selector: 'app-cambiar-pin',
  templateUrl: './cambiar-pin.page.html',
  styleUrls: ['./cambiar-pin.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicComponentes, EncabezadoComponent, AlertaCkComponent, ModalPinComponent],
})
export class CambiarPinPage {
  private readonly navCtrl = inject(NavController);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly servicioInactividad = inject(ServicioInactividad);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly dbWebStore = inject(DbPINWebStore);
  private readonly dbAppStore = inject(DbPINAppStore);
  private readonly pinFormularioStore = inject(PinFormularioStore);
  private readonly esWeb = Capacitor.getPlatform() === 'web';

  readonly alertaOlvidePin = ALERTA_OLVIDE_PIN;
  readonly olvidoPinPendiente = signal(false);
  readonly estaModalPinAbierto = signal(false);
  readonly puntosRupturaModalPin = [0, 0.5, 0.8, 1];
  readonly puntoInicialModalPin = 0.5;
  readonly guardandoPin = this.pinFormularioStore.guardando;

  titulo = 'CRITERIO KELLY';
  objFormaMostrar = ['PIN', 'OLVIDÉ MI PIN'];
  activar = '';
  marcarItem: string | null = null;
  usuarioActual = this.authService.obtenerUsuarioActual()?.id ?? 0;
  enteredPasscode = '';
  passcodeWrong = false;
  passcodeLabel = 'PIN de acceso';
  contador = 0;
  mostrarImagen = false;

  tipoSeguridad(tipo: string): void {
    this.marcarItem = tipo;
    this.activar = tipo === 'PIN' ? 'P' : 'O';
    this.enteredPasscode = '';
    this.passcodeWrong = false;
  }

  async capturarPin(digito: number): Promise<void> {
    if (this.passcodeWrong || this.enteredPasscode.length >= 6) return;
    this.enteredPasscode += digito.toString();
    if (this.enteredPasscode.length !== 6) return;
    const store = this.esWeb ? this.dbWebStore : this.dbAppStore;
    store.verificarPin({ pin: this.enteredPasscode, idUsuario: this.usuarioActual });
    await this.utilServicio.esperarCargaDeStore(() => store.isLoading());
    if (store.errorMessage()) {
      await this.utilServicio.mostrarToast(store.errorMessage() ?? 'No se pudo verificar el PIN', 'danger');
      this.enteredPasscode = '';
      return;
    }
    if (store.resultadoVerificacion() === 'correcto') {
      this.enteredPasscode = '';
      this.estaModalPinAbierto.set(true);
    } else {
      await this.redireccionError('pin', 'PIN incorrecto, ingrese nuevamente');
    }
  }

  alSolicitarOlvidoPin(): void {
    this.olvidoPinPendiente.set(true);
  }

  alDescartarOlvidoPin(): void {
    this.olvidoPinPendiente.set(false);
  }

  async alConfirmarOlvidoPin(): Promise<void> {
    this.olvidoPinPendiente.set(false);
    const store = this.esWeb ? this.dbWebStore : this.dbAppStore;
    store.eliminarPinBloqueo(this.usuarioActual);
    await this.utilServicio.esperarCargaDeStore(() => store.isLoading());
    if (store.errorMessage()) {
      await this.utilServicio.mostrarToast(store.errorMessage() ?? 'No se pudo eliminar el PIN', 'danger');
      return;
    }
    await this.servicioInactividad.salir();
  }

  async alCerrarModalPin(_evento: CustomEvent<OverlayEventDetail>): Promise<void> {
    this.estaModalPinAbierto.set(false);
    await this.navCtrl.navigateForward('/inicio');
  }

  async alConfirmarPin(pin: string, modalPin: IonModal): Promise<void> {
    this.pinFormularioStore.guardar(pin);
    await this.utilServicio.esperarCargaDeStore(() => this.pinFormularioStore.isLoading());
    await this.utilServicio.mostrarToast(
      this.pinFormularioStore.mensajeResultado(),
      this.pinFormularioStore.colorAviso(),
    );
    await modalPin.dismiss({ pinCreado: this.pinFormularioStore.pinCreado() });
  }

  async alMostrarPinDistinto(): Promise<void> {
    await this.utilServicio.mostrarToast('Digite el mismo valor en las dos opciones', 'danger');
  }

  async alOmitirPin(modalPin: IonModal): Promise<void> {
    await modalPin.dismiss({ omitido: true });
  }

  async redireccionError(_tipo: string, mensaje: string): Promise<void> {
    this.contador += 1;
    this.passcodeWrong = true;
    await this.utilServicio.mostrarToast(mensaje, 'danger');
    setTimeout(() => {
      this.passcodeWrong = false;
      this.enteredPasscode = '';
    }, 800);
  }

  borrarUltimo(): void { this.enteredPasscode = this.enteredPasscode.slice(0, -1); }
  borrarPin(): void { this.enteredPasscode = ''; this.passcodeWrong = false; }
}
