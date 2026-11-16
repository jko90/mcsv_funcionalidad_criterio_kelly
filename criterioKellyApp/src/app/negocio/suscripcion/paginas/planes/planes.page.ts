import { Component, computed, inject, signal } from '@angular/core';
import { PlanesStore } from '../../store/PlanesStore';
import { Router } from '@angular/router';
import { PlanesModelo } from '../../modelos/Planes.modelo';
import { CommonModule } from '@angular/common';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { ServicioAutenticacion } from 'src/app/configuracion/seguridad/servicio/ServicioAutenticacion';
import { AvisoPlanComponent } from '../../componentes/aviso-plan/aviso-plan.component';
import { PlanVigenteStore } from '../../store/plan-vigente.store';
import { filasLimitesPlan } from '../../configuracion/permisos-plan.config';
import { SesionStore } from 'src/app/configuracion/store/sesion.store';

@Component({
  selector: 'app-planes',
  templateUrl: './planes.page.html',
  styleUrls: ['./planes.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicComponentes, AvisoPlanComponent],
})
export class PlanesPage {
  private readonly _planesStore = inject(PlanesStore);
  private readonly _router = inject(Router);
  private readonly _authService = inject(ServicioAutenticacion);
  private readonly _sesionStore = inject(SesionStore);
  readonly planVigenteStore = inject(PlanVigenteStore);

  private readonly listaObjPlanes = this._planesStore.listaPlanes;
  readonly planesAgrupados = this._planesStore.listaPlanesTitulo;
  readonly isLoading = this._planesStore.isLoading;
  readonly isError = this._planesStore.isError;

  readonly listaPlanSeleccionado = signal<PlanesModelo[]>([]);
  readonly objPlanSeleccionado = this._planesStore.objPlanSeleccionado;

  // A-03: límites de cada plan del grupo elegido, listos para compararlos.
  readonly limitesPorPlan = computed(
    () =>
      new Map(
        this.listaPlanSeleccionado().map((plan) => [
          plan.pin_idPlanInterv,
          filasLimitesPlan(plan),
        ]),
      ),
  );

  grupoSeleccionado: string | null = null;

  constructor() {
    this._planesStore.cargarPlanes();
  }

  ionViewWillEnter(): void {
    const usuarioId = this._sesionStore.usuario()?.id;
    if (usuarioId !== undefined) this.planVigenteStore.cargar({ usuarioId });
  }

  alSolicitarComprobante(): void {
    this._router.navigate(['/comprobante']);
  }

  mostrarIcono(planId: number): string {
    const icons: Record<number, string> = {
      1: 'rocket-outline',
      2: 'diamond-outline',
      3: 'trophy-outline',
    };
    return icons[planId] || 'star-outline';
  }

  mostrarIconoGrupo(index: number): string {
    const iconos: Record<number, string> = {
      0: 'flash-outline',
      1: 'trending-up-outline',
      2: 'stats-chart-outline',
      3: 'layers-outline',
      4: 'bar-chart-outline',
      5: 'pulse-outline',
      6: 'analytics-outline',
      7: 'speedometer-outline',
    };
    return iconos[index] || 'layers-outline';
  }

  recargarPlanes(): void {
    this._planesStore.cargarPlanes();
  }

  desplazarPlanes(): void {
    document
      .querySelector('.plans-section')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  seleccionarTipoPlan(grupo: PlanesModelo): void {
    this.grupoSeleccionado = grupo.ins_nombre;
    this.listaPlanSeleccionado.set(
      this.listaObjPlanes().filter(
        (plan) => plan.pla_nombre === grupo.pla_nombre,
      ),
    );
    const planAlSeleccionar =
      this.listaPlanSeleccionado()[2] ||
      this.listaPlanSeleccionado()[0] ||
      null;
    this._planesStore.seleccionarPlanPorObjeto(planAlSeleccionar!);
  }

  volverAGrupos(): void {
    this.grupoSeleccionado = null;
    this.listaPlanSeleccionado.set([]);
  }

  seleccionarPlanEspecifico(plan: PlanesModelo): void {
    this._planesStore.seleccionarPlanPorObjeto(plan);
    this._navegarSegunSession('/comprobante', '/registro');
  }

  calcularPrecioMensual(plan: PlanesModelo): number {
    const divisores: Record<number, number> = {
      1: 1,
      3: 3,
      6: 6,
      12: 12,
      24: 24,
    };
    return plan.pin_precioFinal / (divisores[plan.ins_numMeses] || 1);
  }

  procederSuscripcion(): void {
    const planSeleccionado = this.objPlanSeleccionado();
    if (planSeleccionado) {
      this._planesStore.seleccionarPlanPorObjeto(planSeleccionado);
      this._navegarSegunSession('/comprobante', '/registro');
    }
  }

  irALogin(): void {
    this._navegarSegunSession('/inicio', '/login');
  }

  private _navegarSegunSession(rutaAuth: string, rutaNoAuth: string): void {
    this._router.navigate([
      this._authService.estaAutenticado() ? rutaAuth : rutaNoAuth,
    ]);
  }
}
