import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { RefresherCustomEvent } from '@ionic/angular';
import { AlertaCkComponent } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import {
  ALERTA_CANCELAR_PLAN,
  ALERTA_CONFIRMAR_PLAN,
  ALERTA_CONFLICTO_PLAN,
  mensajeConfirmarPlan,
} from 'src/app/compartidos/textos-alertas';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { MenuStore } from 'src/app/compartidos/store/menu.store';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { AvisoPlanComponent } from 'src/app/negocio/suscripcion/componentes/aviso-plan/aviso-plan.component';
import { AvisoBloqueoComponent } from 'src/app/negocio/suscripcion/componentes/aviso-bloqueo/aviso-bloqueo.component';
import { SuscripcionStore } from 'src/app/negocio/suscripcion/store/SuscripcionStore';
import { PlanesStore } from 'src/app/negocio/suscripcion/store/PlanesStore';
import { PlanVigenteStore } from 'src/app/negocio/suscripcion/store/plan-vigente.store';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    RouterModule,
    AvisoPlanComponent,
    AvisoBloqueoComponent,
    AlertaCkComponent,
  ],
})
export class InicioPage {
  private readonly menuStore = inject(MenuStore);
  private readonly sesionStore = inject(SesionStore);
  private readonly router = inject(Router);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly suscripcionStore = inject(SuscripcionStore);
  private readonly planesStore = inject(PlanesStore);
  readonly planVigenteStore = inject(PlanVigenteStore);
  readonly planesParaElegir = this.planesStore.planesParaElegir;
  readonly estaProcesando = this.suscripcionStore.isLoading;
  readonly avisoConflictoPlan = this.suscripcionStore.avisoConflictoPlan;
  readonly avisoPendienteAbierto = computed(() => this.avisoConflictoPlan() !== null);
  readonly tituloConflicto = ALERTA_CONFLICTO_PLAN.titulo;
  readonly tituloConfirmarPlan = ALERTA_CONFIRMAR_PLAN.titulo;
  readonly alertaCancelarPlan = ALERTA_CANCELAR_PLAN;
  readonly cancelarPlanPendiente = signal(false);
  readonly mensajeCancelarPlan = this.planVigenteStore.mensajeConfirmarCancelacion;
  readonly planAConfirmar = signal<number | null>(null);
  readonly mensajeConfirmarPlan = computed(() => {
    const idPlanIntervalo = this.planAConfirmar();
    const plan = this.planesParaElegir().find((p) => p.pin_idPlanInterv === idPlanIntervalo);
    const detalle = plan
      ? `${plan.pla_nombre} · ${plan.ins_nombre} (${plan.pin_precioFinal} ${plan.pla_moneda})`
      : 'este plan';
    return mensajeConfirmarPlan(detalle);
  });

  readonly titulo = '';
  readonly gruposMenu = this.menuStore.gruposMenu;

  constructor() {
    effect(() => {
      if (this.planVigenteStore.bloqueoVisible()?.estado === 'SIN_PLAN') {
        untracked(() => this.planesStore.cargarPlanes());
      }
    });
    effect(() => {
      const mensaje = this.suscripcionStore.errorElegirPlan();
      if (mensaje) untracked(() => this.utilServicio.mostrarToast(mensaje, 'danger'));
    });
  }

  ionViewWillEnter(): void {
    const usuarioId = this.sesionStore.usuario()?.id;
    if (!usuarioId) return;
    this.planVigenteStore.cargar({ usuarioId });
    this.planVigenteStore.vigilar(true);
  }

  ionViewWillLeave(): void {
    this.planVigenteStore.limpiarBloqueo();
  }

  alSolicitarPlanes(): void {
    this.router.navigate(['/planes']);
  }

  alSolicitarComprobante(): void {
    this.router.navigate(['/comprobante']);
  }

  alElegirPlan(idPlanIntervalo: number): void {
    this.planAConfirmar.set(idPlanIntervalo);
  }

  alConfirmarElegirPlan(): void {
    const idPlanIntervalo = this.planAConfirmar();
    this.planAConfirmar.set(null);
    if (idPlanIntervalo !== null) this.suscripcionStore.elegirPlan(idPlanIntervalo);
  }

  alCancelarElegirPlan(): void {
    this.planAConfirmar.set(null);
  }

  alCerrarAvisoPendiente(): void {
    this.suscripcionStore.cerrarAvisoPendiente();
    this.planVigenteStore.limpiarBloqueo();
  }

  alCerrarBloqueo(): void {
    this.planVigenteStore.limpiarBloqueo();
  }

  alSolicitarCancelarPlan(): void {
    this.cancelarPlanPendiente.set(true);
  }

  alConfirmarCancelarPlan(): void {
    this.cancelarPlanPendiente.set(false);
    this.suscripcionStore.cancelarPlan();
  }

  alDescartarCancelarPlan(): void {
    this.cancelarPlanPendiente.set(false);
  }

  refrescarPantalla(event: RefresherCustomEvent): void {
    this.menuStore.cargarMenu();
    setTimeout(() => {
      event.target.complete();
    }, 500);
  }
}
