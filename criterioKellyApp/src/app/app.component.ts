import { Component, computed, effect, inject, signal } from '@angular/core';
import { IonicComponentes } from './compartidos/IonicComponentes';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MenuController, Platform } from '@ionic/angular';
import { ServicioInactividad } from './configuracion/seguridad/servicio/ServicioInactividad';
import { DataBaseWebService } from './configuracion/base-datos/data-base-web.service';
import { DataBaseService } from './configuracion/base-datos/data-base.service';
import { Capacitor } from '@capacitor/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AvisoSinConexionComponent } from './compartidos/componentes/aviso-sin-conexion/aviso-sin-conexion.component';
import { UtilitariosService } from './compartidos/servicios/utilitarios.service';
import { AlertaCkComponent } from './compartidos/componentes/alerta-ck/alerta-ck.component';
import {
  ALERTA_NUEVA_VERSION,
  TEXTO_MAS_TARDE,
} from './compartidos/textos-alertas';
import { SesionStore } from './configuracion/store/sesion.store';
import { MenuStore } from './configuracion/store/menu.store';
import { EstadoAplicacionStore } from './configuracion/store/estado-aplicacion.store';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    RouterModule,
    AvisoSinConexionComponent,
    AlertaCkComponent,
  ],
})
export class AppComponent {
  private readonly sesionStore = inject(SesionStore);
  private readonly servicioInactividad = inject(ServicioInactividad);
  private readonly menuStore = inject(MenuStore);
  private readonly router = inject(Router);
  private readonly platform = inject(Platform);
  private readonly dbWeb = inject(DataBaseWebService);
  private readonly database = inject(DataBaseService);
  private readonly menuCtrl = inject(MenuController);
  protected readonly estadoAplicacion = inject(EstadoAplicacionStore);
  private readonly utilServicio = inject(UtilitariosService);

  readonly alertaNuevaVersion = ALERTA_NUEVA_VERSION;
  readonly textoMasTarde = TEXTO_MAS_TARDE;
  readonly hayVersionNueva = this.estadoAplicacion.hayVersionNueva;

  autenticado = this.sesionStore.estaAutenticado;
  rutaActual = signal(this.router.url);

  listaMenu = this.menuStore.listaMenu;

  mostrarMenu = computed(() => {
    const rutasSinMenu = [
      '/login',
      '/registro',
      '/recuperar-clave',
      '/verificar-correo',
    ];
    return this.autenticado() && !rutasSinMenu.includes(this.rutaActual());
  });

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(() => {
      this.rutaActual.set(this.router.url);
    });

    effect(() => {
      if (this.sesionStore.estaAutenticado()) this.menuStore.cargarMenu();
    });

    effect(() => {
      if (this.sesionStore.cierreRemoto()) {
        this.sesionStore.confirmarCierreRemoto();
        this.servicioInactividad.finalizarSalida();
      }
    });

    effect(async () => {
      const mostrar = this.mostrarMenu();
      if (mostrar) {
        await this.menuCtrl.enable(mostrar, 'menuId');
      } else {
        await this.menuCtrl.enable(false, 'menuId');
        await this.menuCtrl.close('menuId');
      }
    });

    effect(() => {
      if (this.estadoAplicacion.requiereRecarga()) {
        void this.recargarPorErrorDeCache();
      }
    });

    this.estadoAplicacion.monitorearConexion();
    this.estadoAplicacion.monitorearActualizaciones();
    this.servicioInactividad.iniciar();
    if (this.sesionStore.estaAutenticado()) {
      this.menuStore.cargarMenu();
    }
    this.inicializarDB();
  }

  gruposMenu = this.menuStore.gruposMenu;

  private async inicializarDB() {
    if (Capacitor.getPlatform() === 'web') {
      await this.dbWeb.openDB();
    } else {
      await this.platform.ready();
      await this.database.crearBaseDatos();
    }
  }

  alActualizarVersion(): void {
    document.location.reload();
  }

  alPosponerActualizacion(): void {
    this.estadoAplicacion.marcarVersionAtendida();
  }

  private async recargarPorErrorDeCache(): Promise<void> {
    await this.utilServicio.mostrarToast(
      'La aplicación se actualizará para corregir un error de caché.',
      'warning',
    );
    document.location.reload();
  }

  async salir() {
    await this.servicioInactividad.salir();
  }
}
