import { inject, Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { UtilitariosService } from '../../../compartidos/servicios/utilitarios.service';
import { Location } from '@angular/common';
import { LimpiezaClienteService } from '../../servicio/limpieza-cliente.service';
import { SesionStore } from 'src/app/nucleo/store/sesion.store';

@Injectable({
  providedIn: 'root',
})
export class ServicioInactividad implements OnDestroy {
  private timeoutId: ReturnType<typeof setTimeout> | undefined;
  private readonly tiempoInactividad = 5 * 60 * 1000;

  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly sesionStore = inject(SesionStore);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly menuCtrl = inject(MenuController);
  private readonly ubicacion = inject(Location);
  private readonly limpiezaCliente = inject(LimpiezaClienteService);

  private readonly EVENTOS = ['mousemove', 'keydown', 'touchstart'] as const;
  private readonly manejadorEvento: () => void;

  constructor() {
    this.manejadorEvento = () => this.resetearTemporizador();
  }

  iniciar(): void {
    this.resetearTemporizador();
    this.EVENTOS.forEach((evento) => {
      window.addEventListener(evento, this.manejadorEvento);
    });
  }

  ngOnDestroy(): void {
    this.EVENTOS.forEach((evento) => {
      window.removeEventListener(evento, this.manejadorEvento);
    });
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
  }

  private resetearTemporizador(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        this.router.navigate(['/bloqueo']);
      });
    }, this.tiempoInactividad);
  }

  async salir(): Promise<void> {
    this.sesionStore.cerrarSesion();
    try {
      await this.utilServicio.esperarCargaDeStore(() =>
        this.sesionStore.isLoading(),
      );
    } catch {
      // La limpieza local se ejecuta en el finalize del store aunque la red falle.
    }
    await this.finalizarSalida();
  }

  async finalizarSalida(): Promise<void> {
    sessionStorage.clear();
    void this.menuCtrl.close('menuId');
    void this.menuCtrl.enable(false, 'menuId');
    try {
      await this.limpiezaCliente.limpiarCachesDeDatos();
    } catch {
      // La recarga que sigue borra el resto del estado en memoria.
    }
    window.location.replace(this.ubicacion.prepareExternalUrl('/login'));
  }
}
