import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AlertInput } from '@ionic/angular';
import { AlertaCkComponent, ValoresCamposAlerta } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import {
  ALERTA_CONFIRMAR_DIVISOR,
  TEXTO_ACTUALIZAR,
  TEXTO_CANCELAR_LARGO,
} from 'src/app/compartidos/textos-alertas';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { CuentaResponse, CuentasModelo } from '../modelos/Cuentas.modelo';
import { Capacitor } from '@capacitor/core';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { CuentaStore } from '../store/cuentaStore';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { DBCriterioKellyWebStore } from 'src/app/compartidos/store/dbkelly-web.store';
import { DBCriterioKellyAppStore } from 'src/app/compartidos/store/dbkelly-app.store';
import { AlertaLimitePlanComponent } from 'src/app/compartidos/componentes/alerta-limite-plan/alerta-limite-plan.component';
import { RUTA_PLANES } from '../../suscripcion/configuracion/permisos-plan.config';
import { PlanVigenteStore } from '../../suscripcion/store/plan-vigente.store';
import {
  DIVISOR_KELLY_RECOMENDADO,
  TEXTO_DIVISOR_FIJO,
} from '../../suscripcion/configuracion/permisos-plan.config';

type AlertaDivisor =
  | { tipo: 'editar'; cuenta: CuentasModelo; valor: number }
  | { tipo: 'confirmar'; cuenta: CuentasModelo; nuevoValor: number };

@Component({
  selector: 'app-operativa-kelly',
  templateUrl: './operativa-kelly.page.html',
  styleUrls: ['./operativa-kelly.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    ReactiveFormsModule,
    AlertaLimitePlanComponent,
    AlertaCkComponent,
  ],
})
export class OperativaKellyPage {
  private readonly utilServicio = inject(UtilitariosService);
  private readonly cuentaStore = inject(CuentaStore);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly dbKellyWebStore = inject(DBCriterioKellyWebStore);
  private readonly dbKellyAppStore = inject(DBCriterioKellyAppStore);
  private readonly planVigenteStore = inject(PlanVigenteStore);
  private readonly router = inject(Router);

  titulo = 'CONFIGURACIÓN';
  usuarioActual = signal(0);
  private isWeb = Capacitor.getPlatform() === 'web';

  listaObjCuentas = this.cuentaStore.listaCuentas;
  divisoresKelly = signal<Record<number, number>>({});

  readonly divisorEditable = computed(
    () => this.planVigenteStore.limites().divisorEditable,
  );
  // Con el divisor fijo se muestra 10 sin borrar el valor guardado en el dispositivo.
  readonly divisorFijo = DIVISOR_KELLY_RECOMENDADO;
  readonly textoDivisorFijo = TEXTO_DIVISOR_FIJO;
  readonly mostrarModalPlan = signal(false);

  readonly alertaConfirmarDivisor = ALERTA_CONFIRMAR_DIVISOR;
  readonly textoActualizar = TEXTO_ACTUALIZAR;
  readonly textoCancelar = TEXTO_CANCELAR_LARGO;
  /** Una sola alerta por página: editar el valor y luego confirmar el cambio. */
  readonly alertaActiva = signal<AlertaDivisor | null>(null);
  readonly esEdicionActiva = computed(() => this.alertaActiva()?.tipo === 'editar');
  readonly tituloAlertaActiva = computed(() => {
    const alerta = this.alertaActiva();
    if (alerta?.tipo === 'editar') return 'Editar: ' + alerta.cuenta.cue_nombre;
    return ALERTA_CONFIRMAR_DIVISOR.titulo;
  });
  readonly camposAlertaActiva = computed<AlertInput[] | undefined>(() => {
    const alerta = this.alertaActiva();
    if (alerta?.tipo !== 'editar') return undefined;
    return [
      { name: 'agr_valor', type: 'number', placeholder: 'Valor divisor Kelly', value: alerta.valor },
    ];
  });

  constructor() {
    this.usuarioActual.set(this.authService.obtenerUsuarioActual()?.id || 0);
    this.cargarCuentas();
  }

  async cargarCuentas() {
    if (this.usuarioActual() === 0) return;
    this.cuentaStore.cargarCuentas();
    await this.utilServicio.esperarCargaDeStore(() =>
      this.cuentaStore.isLoading(),
    );

    const cuentasConKelly: CuentaResponse[] = [];
    for (const cuenta of this.listaObjCuentas()) {
      const valor = await this.obtenerDivisorKelly(
        cuenta.cue_idCuentas!,
      );
      cuentasConKelly.push({ ...cuenta, multipKelly: valor });
    }
    this.cuentaStore.actualizarListaCuentas(cuentasConKelly);
  }

  async obtenerDivisorKelly(
    cue_idCuentas: number,
  ): Promise<number> {
    if (this.isWeb) {
      this.dbKellyWebStore.cargarDividendosKelly(cue_idCuentas, this.usuarioActual());
      await this.utilServicio.esperarCargaDeStore(() =>
        this.dbKellyWebStore.isLoading(),
      );
      const dividendos = this.dbKellyWebStore.listaDividendos();
      if (Array.isArray(dividendos) && dividendos.length > 0) {
        return dividendos[0].agr_valor || 0;
      }
    } else {
      this.dbKellyAppStore.cargarDividendosKelly(cue_idCuentas, this.usuarioActual());
      await this.utilServicio.esperarCargaDeStore(() =>
        this.dbKellyAppStore.isLoading(),
      );
      const dividendos = this.dbKellyAppStore.listaDividendos();
      if (Array.isArray(dividendos) && dividendos.length > 0) {
        return dividendos[0].agr_valor || 0;
      }
    }
    return 0;
  }

  cerrarModalPlan(): void {
    this.mostrarModalPlan.set(false);
  }

  alVerPlanes(): void {
    this.cerrarModalPlan();
    this.router.navigate([RUTA_PLANES]);
  }

  abrirModalCuenta(cuentaCapt: CuentaResponse): void {
    if (!this.divisorEditable()) {
      this.mostrarModalPlan.set(true);
      return;
    }
    if (cuentaCapt.cue_idCuentas === undefined) {
      this.utilServicio.mostrarToast('Cuenta inválida', 'danger');
      return;
    }

    const cuenta: CuentasModelo = {
      cue_idCuentas: cuentaCapt.cue_idCuentas,
      cue_nombre: cuentaCapt.cue_nombre,
      cue_usuarioId: this.usuarioActual(),
      cue_situacion: '',
      cue_estado: '',
    };
    const valor = cuentaCapt.multipKelly !== undefined ? cuentaCapt.multipKelly : 0;
    this.alertaActiva.set({ tipo: 'editar', cuenta, valor });
  }

  /** Devolver false mantiene la alerta de edición abierta. */
  readonly validarDivisor = (valores: ValoresCamposAlerta): boolean => {
    if (this.alertaActiva()?.tipo !== 'editar') return true;
    if (!isNaN(Number(valores['agr_valor']))) return true;
    this.utilServicio.mostrarToast('Valor inválido', 'danger');
    return false;
  };

  alConfirmarAlerta(valores: ValoresCamposAlerta | void): void {
    const alerta = this.alertaActiva();
    this.alertaActiva.set(null);
    if (alerta === null) return;
    if (alerta.tipo === 'editar') {
      const nuevoValor = Number(valores?.['agr_valor']);
      // Se reabre en otro ciclo: la alerta actual aún se está cerrando.
      setTimeout(() => this.alertaActiva.set({ tipo: 'confirmar', cuenta: alerta.cuenta, nuevoValor }));
      return;
    }
    void this.aplicarNuevoDivisor(alerta.cuenta, alerta.nuevoValor);
  }

  alDescartarAlerta(): void {
    this.alertaActiva.set(null);
  }

  private async aplicarNuevoDivisor(cuenta: CuentasModelo, nuevoValor: number): Promise<void> {
    await this.actualizarDivisorKelly(cuenta, nuevoValor);
    this.divisoresKelly.set({
      ...this.divisoresKelly(),
      [cuenta.cue_idCuentas!]: nuevoValor,
    });
    this.utilServicio.mostrarToast('Divisor Kelly actualizado', 'success');
  }

  private async actualizarDivisorKelly(
    cuenta: CuentasModelo,
    nuevoValor: number,
  ) {
    if (this.isWeb) {
      this.dbKellyWebStore.cargarDividendosKelly(
        cuenta.cue_idCuentas!,
        this.usuarioActual(),
      );
      await this.utilServicio.esperarCargaDeStore(() =>
        this.dbKellyWebStore.isLoading(),
      );
      const dividendos = this.dbKellyWebStore.listaDividendos();
      if (
        Array.isArray(dividendos) &&
        dividendos.length > 0 &&
        dividendos[0].agr_idAgresiv
      ) {
        this.dbKellyWebStore.actualizarDividendoKelly(
          dividendos[0].agr_idAgresiv!,
          nuevoValor,
          cuenta.cue_idCuentas!,
          this.usuarioActual(),
        );
      } else {
        this.dbKellyWebStore.agregarDividendoKelly({
          agr_usuarioId: this.usuarioActual(),
          agr_cueIdCuentas: cuenta.cue_idCuentas!,
          agr_valor: nuevoValor,
        });
      }
    } else {
      this.dbKellyAppStore.cargarDividendosKelly(
        cuenta.cue_idCuentas!,
        this.usuarioActual(),
      );
      await this.utilServicio.esperarCargaDeStore(() =>
        this.dbKellyAppStore.isLoading(),
      );
      const dividendos = this.dbKellyAppStore.listaDividendos();
      if (
        Array.isArray(dividendos) &&
        dividendos.length > 0 &&
        dividendos[0].agr_idAgresiv
      ) {
        this.dbKellyAppStore.actualizarDividendoKelly(
          dividendos[0].agr_idAgresiv!,
          nuevoValor,
          cuenta.cue_idCuentas!,
          this.usuarioActual(),
        );
      } else {
        this.dbKellyAppStore.agregarDividendoKelly({
          agr_usuarioId: this.usuarioActual(),
          agr_cueIdCuentas: cuenta.cue_idCuentas!,
          agr_valor: nuevoValor,
        });
      }
    }
    await this.esperarRecargaDividendos(
      cuenta.cue_idCuentas!,
      this.usuarioActual(),
    );

    const cuentasActualizadas = this.listaObjCuentas().map((c) =>
      c.cue_idCuentas === cuenta.cue_idCuentas
        ? { ...c, multipKelly: nuevoValor }
        : c,
    );
    this.cuentaStore.actualizarListaCuentas(cuentasActualizadas);
  }

  private async esperarRecargaDividendos(
    cue_idCuentas: number,
    cue_usuarioId: number,
  ) {
    if (this.isWeb) {
      this.dbKellyWebStore.cargarDividendosKelly(cue_idCuentas, cue_usuarioId);
      await this.utilServicio.esperarCargaDeStore(() =>
        this.dbKellyWebStore.isLoading(),
      );
    } else {
      this.dbKellyAppStore.cargarDividendosKelly(cue_idCuentas, cue_usuarioId);
      await this.utilServicio.esperarCargaDeStore(() =>
        this.dbKellyAppStore.isLoading(),
      );
    }
  }
}
