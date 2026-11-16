import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RefresherCustomEvent, SelectChangeEventDetail } from '@ionic/angular';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { CuentaResponse } from '../../../../config/cuentas/modelos/Cuentas.modelo';
import { CuentaStore } from '../../../../config/cuentas/store/cuentaStore';
import { ServicioAutenticacion } from 'src/app/configuracion/seguridad/servicio/ServicioAutenticacion';
import { CriterioKellyStore } from '../../store/criterioKellyStore';
import { ResultadosStore } from '../../store/resultadosStore';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { PlanVigenteStore } from '../../../suscripcion/store/plan-vigente.store';
import { textoTopeOperacionesDiarias } from '../../../suscripcion/configuracion/permisos-plan.config';

type FilaResultado = {
  tipo: string;
  etiqueta: string;
  operaciones: number;
  porcentaje: string;
  promedio: number | string;
};

@Component({
  selector: 'app-mostrar-criterio-kelly',
  templateUrl: './mostrar-criterio-kelly.page.html',
  styleUrls: ['./mostrar-criterio-kelly.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    ReactiveFormsModule,
  ],
})
export class MostrarCriterioKellyPage {
  private readonly cuentaStore = inject(CuentaStore);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly criterioKellyStore = inject(CriterioKellyStore);
  private readonly resultadosStore = inject(ResultadosStore);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly planVigenteStore = inject(PlanVigenteStore);

  readonly cuentaSeleccionada = signal({} as CuentaResponse);
  readonly habilitaEdicion = signal(false);
  readonly usuarioActual = signal(
    this.authService.obtenerUsuarioActual()?.id || 0,
  );

  readonly listaObjCuentas = this.cuentaStore.listaCuentas;
  readonly listaObjCriterioKelly = this.criterioKellyStore.listaCriteriosKelly;
  readonly listaObjResultados = this.resultadosStore.listaResultados;
  readonly objCriterioKelly = this.criterioKellyStore.criterioKellyActual;
  readonly objResultadoFiltrado = this.resultadosStore.resultadoActual;
  readonly objCuentas = this.cuentaStore.cuentaSeleccionada;

  readonly numOperativasControl = new FormControl(1);
  readonly numOperativas = toSignal(this.numOperativasControl.valueChanges, {
    initialValue: 1,
  });

  readonly maximoOperacionesDiarias = computed(
    () => this.planVigenteStore.limites().maxOperacionesDiarias,
  );
  readonly avisoOperacionesDiarias = computed(() => {
    const maximo = this.maximoOperacionesDiarias();
    return maximo === null ? null : textoTopeOperacionesDiarias(maximo);
  });

  readonly kelly = computed(
    () => this.objCriterioKelly()?.cke_x100Operativo || 0,
  );
  readonly porcentajeOperativo = computed(() => {
    const kellyValue = this.kelly();
    const numOps = this.numOperativas() || 1;
    return kellyValue && numOps > 0 ? kellyValue / numOps : 0;
  });
  readonly montoPorOperativa = computed(() => {
    const montoTotal = this.objResultadoFiltrado()?.ren_montoTotal ?? 0;
    const porcentaje = this.porcentajeOperativo() ?? 0;
    return montoTotal * (porcentaje / 100);
  });

  readonly datosTablaResultados = computed<FilaResultado[]>(() => {
    const resultado = this.objResultadoFiltrado();
    if (!resultado) return [];

    return [
      {
        tipo: 'ganador',
        etiqueta: 'Ganador',
        operaciones: resultado.res_opeGanador || 0,
        porcentaje: (resultado.res_x100Ganador || 0).toFixed(2),
        promedio: 0,
      },
      {
        tipo: 'perdedor',
        etiqueta: 'Perdedor',
        operaciones: resultado.res_opePerdedor || 0,
        porcentaje: (resultado.res_x100Perdedor || 0).toFixed(2),
        promedio: 0,
      },
      {
        tipo: 'breakeven',
        etiqueta: 'Break Even',
        operaciones: resultado.res_opeBreakEven || 0,
        porcentaje: (resultado.res_x100BreakEven || 0).toFixed(2),
        promedio: 0,
      },
      {
        tipo: 'abierta',
        etiqueta: 'Abiertas',
        operaciones: resultado.res_operAbierta || 0,
        porcentaje: (resultado.res_x100Abierta || 0).toFixed(2),
        promedio: 0,
      },
      {
        tipo: 'total',
        etiqueta: 'TOTAL',
        operaciones: resultado.res_totalOperac || 0,
        porcentaje: (resultado.res_x100Total || 0).toFixed(2),
        promedio: '',
      },
    ];
  });

  constructor() {
    effect(() => {
      const maximo = this.maximoOperacionesDiarias();
      this.numOperativasControl.setValidators(
        maximo === null ? null : Validators.max(maximo),
      );
      this.numOperativasControl.updateValueAndValidity({ emitEvent: false });
    });

    // Un valor mayor al máximo del plan se ajusta al máximo y se avisa (RN-12).
    effect(() => {
      const maximo = this.maximoOperacionesDiarias();
      const valorEscrito = this.numOperativas();
      if (maximo === null || valorEscrito === null || valorEscrito <= maximo)
        return;
      untracked(() => {
        this.numOperativasControl.setValue(maximo);
        this.utilServicio.mostrarToast(
          textoTopeOperacionesDiarias(maximo),
          'warning',
        );
      });
    });

    if (this.usuarioActual() > 0) {
      this.cargarCuentas();
    }
  }

  async ionViewWillEnter(): Promise<void> {
    await this.refrescarPagina();
  }

  private async cargarCuentas(): Promise<void> {
    if (this.usuarioActual() === 0) return;

    this.cuentaStore.cargarCuentas();
    this.criterioKellyStore.cargarCriteriosKelly();
    this.resultadosStore.cargarResultados();

    await Promise.all([
      this.utilServicio.esperarCargaDeStore(() => this.cuentaStore.isLoading()),
      this.utilServicio.esperarCargaDeStore(() =>
        this.criterioKellyStore.isLoading(),
      ),
      this.utilServicio.esperarCargaDeStore(() =>
        this.resultadosStore.isLoading(),
      ),
    ]);

    this.cuentaStore.buscarCuentaPorId(
      this.objCriterioKelly()?.cke_cueIdCuentas || 0,
    );
    this.resultadosStore.seleccionarPorIdentificador(
      this.objCriterioKelly()?.cke_identifica || '',
    );
  }

  seleccionarCuenta(
    event: CustomEvent<SelectChangeEventDetail<CuentaResponse>>,
  ): void {
    this.cuentaSeleccionada.set(event.detail.value);
    this.criterioKellyStore.criterioKellyPorCuenta(
      this.cuentaSeleccionada().cue_idCuentas,
    );
    this.resultadosStore.seleccionarPorIdentificador(
      this.objCriterioKelly()?.cke_identifica || '',
    );
    this.cuentaStore.buscarCuentaPorId(
      this.cuentaSeleccionada().cue_idCuentas || 0,
    );
    this.habilitaEdicion.set(true);
  }

  async refrescarPagina(event?: RefresherCustomEvent): Promise<void> {
    const cuenta = this.cuentaSeleccionada();

    if (!cuenta || !cuenta.cue_idCuentas) {
      await this.cargarCuentas();
    } else {
      this.criterioKellyStore.criterioKellyPorCuenta(
        this.cuentaSeleccionada().cue_idCuentas,
      );
      this.resultadosStore.seleccionarPorIdentificador(
        this.objCriterioKelly()?.cke_identifica || '',
      );
      this.cuentaStore.buscarCuentaPorId(
        this.cuentaSeleccionada().cue_idCuentas || 0,
      );
      this.habilitaEdicion.set(true);
    }

    event?.target?.complete();
  }
}
