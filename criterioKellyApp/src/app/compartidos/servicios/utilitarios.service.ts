import { inject, Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { ToastController } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root',
})
export class UtilitariosService {
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);

  async mostrarToast(
    mensaje: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      color: color,
      position: 'bottom',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }

  async mostrarToastOperacion(
    store: { isLoading: () => boolean; errorMessage: () => string | null },
    mensajeExito: string,
    mensajeError?: string,
    tipo: 'success' | 'danger' | 'warning' = 'success',
  ): Promise<void> {
    await this.esperarCargaDeStore(() => store.isLoading());
    const error = store.errorMessage();
    if (error) {
      await this.mostrarToast(
        mensajeError || error,
        tipo === 'warning' ? 'warning' : 'danger',
      );
    } else {
      await this.mostrarToast(mensajeExito, 'success');
    }
  }

  async mostrarCargando(mensaje: string): Promise<HTMLIonLoadingElement> {
    const loading = await this.loadingController.create({
      message: mensaje,
    });
    await loading.present();
    return loading;
  }

  async esperarCargaDeStore(isLoadingFn: () => boolean): Promise<void> {
    const maxWaitTime = 5000;
    const checkInterval = 50;
    let waitedTime = 0;

    while (isLoadingFn() && waitedTime < maxWaitTime) {
      await new Promise((res) => setTimeout(res, checkInterval));
      waitedTime += checkInterval;
    }

    if (waitedTime >= maxWaitTime) {
      throw new Error('Timeout esperando carga de PIN');
    }
  }
}
