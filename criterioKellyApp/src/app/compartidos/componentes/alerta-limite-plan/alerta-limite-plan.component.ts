import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AlertaCkComponent } from '../alerta-ck/alerta-ck.component';
import { ALERTA_LIMITE_PLAN, TEXTO_AHORA_NO } from '../../textos-alertas';

@Component({
  selector: 'app-alerta-limite-plan',
  templateUrl: './alerta-limite-plan.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertaCkComponent],
})
export class AlertaLimitePlanComponent {
  readonly abierta = input<boolean>(false);
  readonly mensaje = input<string | null>(null);
  readonly titulo = input<string>(ALERTA_LIMITE_PLAN.titulo);

  readonly verPlanes = output<void>();
  readonly cerrado = output<void>();

  readonly mensajeAlerta = computed(() => this.mensaje() ?? ALERTA_LIMITE_PLAN.mensaje);
  readonly textoVerPlanes = ALERTA_LIMITE_PLAN.textoConfirmar;
  readonly textoAhoraNo = TEXTO_AHORA_NO;
}
