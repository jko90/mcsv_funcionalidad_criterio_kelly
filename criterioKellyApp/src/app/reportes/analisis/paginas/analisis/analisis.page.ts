import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { CuentasModelo } from '../../../../configuracion/cuentas/modelos/Cuentas.modelo';
import { SeleccionarCuentasComponent } from 'src/app/configuracion/cuentas/componentes/seleccionar-cuentas/seleccionar-cuentas.component';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { CuentaStore } from '../../../../configuracion/cuentas/store/cuentaStore';
import { ReportesStore } from '../../../compartido/store/reportesStore';
import { AlertaLimitePlanComponent } from 'src/app/compartidos/componentes/alerta-limite-plan/alerta-limite-plan.component';
import { ExportarExcelService } from '../../servicios/exportarExcel.service';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { FiltroFechasComponent } from '../../componentes/filtro-fechas/filtro-fechas.component';
import { PlanVigenteStore } from '../../../../paginas/suscripcion/store/plan-vigente.store';
import {
  ajustarRangoAnalisis,
  fechaIsoDeHoy,
  fechaMinimaAnalisis,
  RangoFechas,
  rangoAnalisisPorDefecto,
  RUTA_PLANES,
  TEXTO_FUNCION_NO_INCLUIDA,
  textoAvisoOperacionesAnalisis,
  textoAvisoRangoAnalisis,
} from '../../../../paginas/suscripcion/configuracion/permisos-plan.config';

@Component({
  selector: 'app-analisis',
  templateUrl: './analisis.page.html',
  styleUrls: ['./analisis.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    SeleccionarCuentasComponent,
    AlertaLimitePlanComponent,
    FiltroFechasComponent,
  ],
})
export class AnalisisPage implements OnInit {
  titulo = 'REPORTES';

  private readonly reportesStore = inject(ReportesStore);
  private readonly cuentaStore = inject(CuentaStore);
  private readonly servicioAutenticacion = inject(ServicioAutenticacion);
  private readonly excelExportService = inject(ExportarExcelService);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly planVigenteStore = inject(PlanVigenteStore);
  private readonly router = inject(Router);

  // El store entrega CuentaResponse; el selector y los manejadores heredados trabajan con CuentasModelo.
  // Se pasa el mismo objeto (sin copiar) para no cambiar lo que recibe la página al elegir.
  readonly listaCuentas = computed(() => this.cuentaStore.listaCuentas() as unknown as CuentasModelo[]);
  listaOperacionesPorCuentas = this.reportesStore.listaOperacionesPorCuentas;
  listaObservacionesPorBitacora = this.reportesStore.listaObservacionesPorBitacora;
  cuentaSeleccionada = {} as CuentasModelo;

  readonly mostrarModal = signal(false);
  readonly textoFuncionNoIncluida = TEXTO_FUNCION_NO_INCLUIDA;

  private readonly hoy = signal(fechaIsoDeHoy(new Date()));
  private readonly limites = this.planVigenteStore.limites;
  readonly rangoFechas = signal<RangoFechas>({ desde: null, hasta: this.hoy() });
  readonly fechaMinima = computed(() => fechaMinimaAnalisis(this.limites(), this.hoy()));
  readonly avisoRangoPermitido = computed(() => textoAvisoRangoAnalisis(this.limites()));
  readonly avisoOperaciones = computed(() => textoAvisoOperacionesAnalisis(this.limites()));

  constructor() {
    // Al cambiar el plan (D-05) se vuelve al rango por defecto y se consulta de nuevo.
    effect(() => {
      const limitesVigentes = this.limites();
      untracked(() => {
        this.rangoFechas.set(rangoAnalisisPorDefecto(limitesVigentes, this.hoy()));
        this.consultarAnalisis();
      });
    });

    // Al llegar nuevos datos del servidor se vuelve a filtrar la cuenta ya elegida.
    effect(() => {
      this.reportesStore.listaOperacionesAnalisis();
      untracked(() => {
        const idCuenta = this.cuentaSeleccionada?.cue_idCuentas;
        if (idCuenta) this.reportesStore.obtenerListaOperacionesPorCuentas(idCuenta);
      });
    });
  }

  // La carga ocurre al crearse la página (no en ionViewWillEnter, que se repite en cada entrada).
  ngOnInit(): void {
    void this.cargarCuentasIniciales();
  }

  ionViewWillEnter(): void {
    this.hoy.set(fechaIsoDeHoy(new Date()));
  }

  alCambiarRango(rangoElegido: RangoFechas): void {
    const rangoAjustado = ajustarRangoAnalisis(rangoElegido, this.limites(), this.hoy());
    this.rangoFechas.set({ desde: rangoAjustado.desde, hasta: rangoAjustado.hasta });
    if (rangoAjustado.ajustado && this.avisoRangoPermitido()) {
      this.utilServicio.mostrarToast(this.avisoRangoPermitido()!, 'warning');
    }
    this.consultarAnalisis();
  }

  async alElegirCuenta(cuenta: CuentasModelo): Promise<void> {
    await this.recibeCuentaSeleccionada(cuenta);
    await this.cargarDetalleDeCuenta(cuenta?.cue_idCuentas || 0);
  }

  async recibeCuentaSeleccionada(event: CuentasModelo) {
    this.cuentaSeleccionada = event;
    this.reportesStore.obtenerListaOperacionesPorCuentas(
      this.cuentaSeleccionada?.cue_idCuentas || 0,
    );
    await this.utilServicio.esperarCargaDeStore(() => this.reportesStore.loading());
  }

  async bitacoraOperacionCapturada(item: { id_bitacora: number }) {
    this.reportesStore.obtenerListaObservacionesPorBitacora(item.id_bitacora);
    await this.utilServicio.esperarCargaDeStore(() => this.reportesStore.loading());
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
  }

  alVerPlanes(): void {
    this.cerrarModal();
    this.irAPlanes();
  }

  irAPlanes(): void {
    this.router.navigate([RUTA_PLANES]);
  }

  exportarAExcel() {
    if (!this.limites().puedeDescargar) {
      this.mostrarModal.set(true);
      return;
    }

    const operaciones = this.listaOperacionesPorCuentas();

    if (operaciones.length === 0) {
      return;
    }

    const todasLasObservaciones = this.reportesStore.listaObservacionesAnalisis();

    const observacionesFiltradas = todasLasObservaciones.filter((obs) =>
      operaciones.some((op) => op.id_bitacora === obs.bitacora_id),
    );

    this.excelExportService.exportarOperacionesConObservaciones(
      operaciones,
      observacionesFiltradas,
    );
  }

  private async cargarCuentasIniciales(): Promise<void> {
    const idUsuario = this.servicioAutenticacion.obtenerUsuarioActual()?.id || 0;
    if (idUsuario === 0) return;
    this.cuentaStore.cargarCuentas();
    await this.utilServicio.esperarCargaDeStore(() => this.cuentaStore.isLoading());

    const cuentas = this.listaCuentas();
    if (!cuentas?.length) return;
    await this.cargarDetalleDeCuenta(cuentas[0].cue_idCuentas ?? 0);
  }

  private async cargarDetalleDeCuenta(idCuenta: number): Promise<void> {
    this.reportesStore.obtenerDetallePorCuentas(idCuenta);
    await this.utilServicio.esperarCargaDeStore(() => this.reportesStore.loading());
  }

  private consultarAnalisis(): void {
    const { desde, hasta } = this.rangoFechas();
    const filtroFechas = desde === null ? { fechaHasta: hasta } : { fechaDesde: desde, fechaHasta: hasta };
    this.reportesStore.cargarOperacionesParaAnalisis(filtroFechas);
    this.reportesStore.cargarObservacionesParaAnalisis(filtroFechas);
  }
}
