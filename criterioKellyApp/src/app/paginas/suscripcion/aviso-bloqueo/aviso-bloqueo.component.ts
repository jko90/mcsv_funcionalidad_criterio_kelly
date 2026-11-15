import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AlertaCkComponent } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { ALERTA_PLAN_PENDIENTE, TEXTO_ENTENDIDO, TEXTO_SUBIR_COMPROBANTE } from 'src/app/compartidos/textos-alertas';
import { BloqueoPlan } from '../configuracion/permisos-plan.config';
import { PlanesModelo } from '../modelos/Planes.modelo';

@Component({
  selector: 'app-aviso-bloqueo',
  templateUrl: './aviso-bloqueo.component.html',
  styleUrls: ['./aviso-bloqueo.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes, AlertaCkComponent],
})
export class AvisoBloqueoComponent {
  readonly bloqueo = input<BloqueoPlan | null>(null);
  readonly texto = input<string | null>(null);
  readonly planes = input<PlanesModelo[]>([]);
  readonly estaCargando = input<boolean>(false);
  readonly puedeSubirComprobante = input<boolean>(false);

  readonly tituloPendiente = ALERTA_PLAN_PENDIENTE.titulo;
  readonly mensajePendienteRespaldo = ALERTA_PLAN_PENDIENTE.mensaje;
  readonly textoEntendido = TEXTO_ENTENDIDO;
  readonly textoSubirComprobante = TEXTO_SUBIR_COMPROBANTE;

  readonly esPendiente = computed(() => this.bloqueo()?.estado === 'MINIMO_PENDIENTE');
  readonly esSinPlan = computed(() => this.bloqueo()?.estado === 'SIN_PLAN');

  readonly planesAgrupados = computed(() => {
    const grupos = new Map<string, PlanesModelo[]>();
    for (const plan of this.planes()) {
      const opciones = grupos.get(plan.pla_nombre) ?? [];
      opciones.push(plan);
      grupos.set(plan.pla_nombre, opciones);
    }
    return Array.from(grupos, ([nombre, opciones]) => ({ nombre, opciones }));
  });

  readonly elegirPlan = output<number>();
  readonly cerrar = output<void>();
  readonly comprobanteSolicitado = output<void>();

  // Plan tocado por la persona: se muestra un resumen y solo se emite al confirmar.
  readonly planSeleccionado = signal<PlanesModelo | null>(null);

  readonly precioPorMes = computed(() => {
    const plan = this.planSeleccionado();
    if (plan === null || plan.ins_numMeses <= 1) return null;
    return Math.round((plan.pin_precioFinal / plan.ins_numMeses) * 100) / 100;
  });

  seleccionar(plan: PlanesModelo): void {
    this.planSeleccionado.set(plan);
  }

  cambiarSeleccion(): void {
    this.planSeleccionado.set(null);
  }

  confirmar(): void {
    const plan = this.planSeleccionado();
    if (plan === null) return;
    this.elegirPlan.emit(plan.pin_idPlanInterv);
    this.planSeleccionado.set(null);
  }

  alConfirmarPendiente(): void {
    this.comprobanteSolicitado.emit();
    this.cerrarAviso();
  }

  cerrarAviso(): void {
    this.planSeleccionado.set(null);
    this.cerrar.emit();
  }
}
