import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { CuentasModelo } from '../../../configuracion/cuentas/modelos/Cuentas.modelo';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { GraficoEstadisticoComponent } from '../componentes/grafico-estadistico/grafico-estadistico.component';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportesStore } from '../store/reportesStore';
import { AlertaLimitePlanComponent } from 'src/app/compartidos/componentes/alerta-limite-plan/alerta-limite-plan.component';
import { PlanVigenteStore } from '../../suscripcion/store/plan-vigente.store';
import {
  RUTA_PLANES,
  TEXTO_FUNCION_NO_INCLUIDA,
  textoAvisoDiasReporte,
} from '../../suscripcion/configuracion/permisos-plan.config';
import { SeleccionarCuentasComponent } from 'src/app/configuracion/cuentas/componentes/seleccionar-cuentas/seleccionar-cuentas.component';
import { CuentaStore } from '../../../configuracion/cuentas/store/cuentaStore';

@Component({
  selector: 'app-operativas',
  templateUrl: './operativas.page.html',
  styleUrls: ['./operativas.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    ReactiveFormsModule,
    GraficoEstadisticoComponent,
    SeleccionarCuentasComponent,
    AlertaLimitePlanComponent
  ],
})
export class OperativasPage implements OnInit {
  titulo = 'REPORTES';

  private readonly authService = inject(ServicioAutenticacion);
  private readonly reportesStore = inject(ReportesStore);
  private readonly cuentaStore = inject(CuentaStore);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly planVigenteStore = inject(PlanVigenteStore);
  private readonly router = inject(Router);

  // El store entrega CuentaResponse; el selector y los manejadores heredados trabajan con CuentasModelo.
  // Se pasa el mismo objeto (sin copiar) para no cambiar lo que recibe la página al elegir.
  readonly listaCuentas = computed(() => this.cuentaStore.listaCuentas() as unknown as CuentasModelo[]);
  listaDetalleOperativas = this.reportesStore.listaDetallesOperaciones;
  listaDOPorCuentas = this.reportesStore.listaDOPorCuentas;

  cuentaSeleccionada = {} as CuentasModelo;
  usuarioActual = signal(0);
  habilitarGrafica = signal(false);
  readonly mostrarModalPlan = signal(false);
  readonly avisoDiasReporte = computed(() =>
    textoAvisoDiasReporte(this.planVigenteStore.limites()),
  );
  readonly textoFuncionNoIncluida = TEXTO_FUNCION_NO_INCLUIDA;

  async ngOnInit() {
    this.usuarioActual.set(this.authService.obtenerUsuarioActual()?.id || 0);
    this.reportesStore.cargarDetalleOperaciones();
    await this.cargarCuentasIniciales();
  }

  async alElegirCuenta(cuenta: CuentasModelo): Promise<void> {
    await this.recibeCuentaSeleccionada(cuenta);
    await this.cargarDetalleDeCuenta(cuenta?.cue_idCuentas || 0);
  }

  async recibeCuentaSeleccionada(event: CuentasModelo) {
    this.cuentaSeleccionada = event;
    this.reportesStore.obtenerDetallePorCuentas(
      this.cuentaSeleccionada?.cue_idCuentas || 0,
    );
    await this.utilServicio.esperarCargaDeStore(() =>
      this.reportesStore.loading(),
    );
  }

  private async cargarCuentasIniciales(): Promise<void> {
    if (this.usuarioActual() === 0) return;
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

  graficarOperacion() {
    if (!this.planVigenteStore.limites().puedeGraficar) {
      this.mostrarModalPlan.set(true);
      return;
    }
    this.habilitarGrafica.set(!this.habilitarGrafica());
  }

  cerrarModalPlan(): void {
    this.mostrarModalPlan.set(false);
  }

  alVerPlanes(): void {
    this.cerrarModalPlan();
    this.irAPlanes();
  }

  irAPlanes(): void {
    this.router.navigate([RUTA_PLANES]);
  }

  exportarAPDF(): void {
    if (!this.planVigenteStore.limites().puedeDescargar) {
      this.mostrarModalPlan.set(true);
      return;
    }
    const datos = this.listaDOPorCuentas();
    if (!datos || datos.length === 0) {
      return;
    }

    const pdf = new jsPDF();
    this.configurarEncabezadoPDF(pdf);
    const datosTabla = this.prepararDatosTabla(datos);
    this.crearTablaPDF(pdf, datosTabla);

    const nombreArchivo = `operaciones-${this.cuentaSeleccionada?.cue_nombre || 'cuenta'}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(nombreArchivo);
  }

  private configurarEncabezadoPDF(pdf: jsPDF): void {
    // Título del documento
    const fontSizeTitle = 16;
    const fontSizeInfo = 12;
    const lineHeightTitle = fontSizeTitle * 0.45;
    const lineHeightInfo = fontSizeInfo * 0.45;

    let y = 20;
    pdf.setFontSize(fontSizeTitle);
    pdf.setFont('helvetica', 'bold');
    pdf.text('REPORTE DE OPERACIONES', 20, y);

    y += lineHeightTitle;
    pdf.setFontSize(fontSizeInfo);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Cuenta: ${this.cuentaSeleccionada?.cue_nombre || '---'}`, 20, y);

    y += lineHeightInfo;
    pdf.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 20, y);

    y += lineHeightInfo / 2;
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y);
  }

  private prepararDatosTabla(datos: any[]): any[] {
    return datos.map((item, index) => [
      index + 1, // Orden
      item.fecha_fin || '---', // Fecha
      item.divisa || '---', // Divisa
      item.tipo_operacion || '---', // Tipo de operación
      item.resultado || '---', // Resultado
      `$ ${this.formatearBalance(item.balance)}`, // Balance formateado
    ]);
  }

  private formatearBalance(balance: number): string {
    if (balance == null) return '---';
    return balance.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private crearTablaPDF(pdf: jsPDF, datos: any[]): void {
    // Usar autoTable directamente como función importada
    autoTable(pdf, {
      startY: 40,
      head: [['Ord.', 'Fecha', 'Divisa', 'Tipo', 'Resultado', 'Balance']],
      body: datos,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185], // Color azul
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 }, // Ord.
        1: { halign: 'left', cellWidth: 35 }, // Fecha
        2: { halign: 'left', cellWidth: 30 }, // Divisa
        3: { halign: 'center', cellWidth: 30 }, // Tipo
        4: { halign: 'center', cellWidth: 30 }, // Resultado
        5: { halign: 'right', cellWidth: 30 }, // Balance
      },
      didParseCell: (data: any) => {
        // Colorear las filas según el resultado
        if (data.section === 'body' && data.column.index === 4) {
          const resultado = data.cell.text[0];
          if (resultado === 'GANADOR') {
            data.row.cells[data.column.index].styles.textColor = [34, 139, 34]; // Verde
            data.row.cells[data.column.index].styles.fontStyle = 'bold';
          } else if (resultado === 'PERDEDOR') {
            data.row.cells[data.column.index].styles.textColor = [220, 20, 60]; // Rojo
            data.row.cells[data.column.index].styles.fontStyle = 'bold';
          }
        }
      },
    });

    this.agregarResumenPDF(pdf, datos);
  }

  private agregarResumenPDF(pdf: jsPDF, datos: any[]): void {
    const finalY = (pdf as any).lastAutoTable?.finalY || 150;

    // Calcular estadísticas
    const totalOperaciones = datos.length;
    const ganadores = datos.filter((fila) => fila[4] === 'GANADOR').length;
    const perdedores = datos.filter((fila) => fila[4] === 'PERDEDOR').length;
    const balanceFinal = datos.length > 0 ? datos[datos.length - 1][5] : '0.00';

    const fontSize = 12;
    const lineHeight = fontSize * 0.45;

    let y = finalY + 10;
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RESUMEN:', 20, y);

    pdf.setFont('helvetica', 'normal');
    y += lineHeight;
    pdf.text(`Total de operaciones: ${totalOperaciones}`, 20, y);
    y += lineHeight;
    pdf.text(`Operaciones ganadoras: ${ganadores}`, 20, y);
    y += lineHeight;
    pdf.text(`Operaciones perdedoras: ${perdedores}`, 20, y);
    y += lineHeight;
    pdf.text(`Balance final:  ${balanceFinal}`, 20, y);
  }
}
