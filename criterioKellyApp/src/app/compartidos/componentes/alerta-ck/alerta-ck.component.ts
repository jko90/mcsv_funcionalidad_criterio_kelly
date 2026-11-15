import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AlertButton, AlertInput } from '@ionic/angular/standalone';
import { IonicComponentes } from '../../IonicComponentes';
import {
  TEXTO_CANCELAR_POR_DEFECTO,
  TEXTO_CONFIRMAR_DESTRUCTIVA_POR_DEFECTO,
  TEXTO_CONFIRMAR_POR_DEFECTO,
  TEXTO_ENTENDIDO,
} from '../../textos-alertas';

export type TipoAlertaCk = 'informativa' | 'confirmacion' | 'destructiva';
export type ValoresCamposAlerta = Record<string, string | number | boolean | undefined>;

const ROL_CONFIRMAR = 'confirm';
const ROL_CANCELAR = 'cancel';

@Component({
  selector: 'app-alerta-ck',
  templateUrl: './alerta-ck.component.html',
  styleUrls: ['./alerta-ck.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class AlertaCkComponent {
  readonly abierta = input.required<boolean>();
  readonly titulo = input.required<string>();
  readonly mensaje = input<string | null>(null);
  readonly tipo = input<TipoAlertaCk>('confirmacion');
  readonly textoConfirmar = input<string | undefined>(undefined);
  readonly textoCancelar = input<string | undefined>(undefined);
  readonly campos = input<AlertInput[] | undefined>(undefined);
  readonly cerrarAlTocarFuera = input<boolean | undefined>(undefined);
  /** El padre lo pone en false mientras los campos no sean válidos: el alert no se cierra. */
  readonly valido = input<boolean>(true);
  /**
   * Valida los valores digitados al pulsar confirmar (el padre no los conoce antes).
   * Si devuelve false el alert sigue abierto; tiene prioridad sobre `valido`.
   */
  readonly validador = input<((valores: ValoresCamposAlerta) => boolean) | undefined>(undefined);

  readonly confirmada = output<ValoresCamposAlerta | void>();
  readonly cancelada = output<void>();

  readonly botones = computed<AlertButton[]>(() => {
    const tipo = this.tipo();
    if (tipo === 'informativa') {
      return [{ text: this.textoConfirmar() ?? TEXTO_ENTENDIDO, role: ROL_CONFIRMAR }];
    }
    const textoPorDefecto =
      tipo === 'destructiva' ? TEXTO_CONFIRMAR_DESTRUCTIVA_POR_DEFECTO : TEXTO_CONFIRMAR_POR_DEFECTO;
    return [
      { text: this.textoCancelar() ?? TEXTO_CANCELAR_POR_DEFECTO, role: ROL_CANCELAR },
      {
        text: this.textoConfirmar() ?? textoPorDefecto,
        role: ROL_CONFIRMAR,
        // Devolver false mantiene el alert abierto con datos inválidos.
        handler: (valores?: ValoresCamposAlerta) => {
          const validador = this.validador();
          return validador ? validador(valores ?? {}) : this.valido();
        },
      },
    ];
  });

  readonly cierraAlTocarFuera = computed<boolean>(() => {
    if (this.tipo() === 'destructiva' || (this.campos()?.length ?? 0) > 0) {
      return this.cerrarAlTocarFuera() ?? false;
    }
    return this.cerrarAlTocarFuera() ?? true;
  });

  alCerrar(evento: CustomEvent<{ role?: string; data?: { values?: ValoresCamposAlerta } }>): void {
    if (evento.detail.role === ROL_CONFIRMAR) {
      this.confirmada.emit(evento.detail.data?.values);
      return;
    }
    this.cancelada.emit();
  }
}
