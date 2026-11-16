import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import Chart, {
  ChartConfiguration,
  ChartOptions,
  ScriptableLineSegmentContext,
  TooltipItem,
} from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import jsPDF from 'jspdf';
import { CuentasModelo } from '../../../../configuracion/cuentas/modelos/Cuentas.modelo';
import { OperacionCuentaModelo } from '../../../compartido/modelos/DetalleOperacion.modelo';

Chart.register(ChartDataLabels);

const CHART_COLORS = {
  profit: 'rgba(84, 235, 54, 1)',
  profitBg: 'rgba(84, 235, 54, 0.22)',
  loss: 'rgba(235, 54, 54, 1)',
  lossBg: 'rgba(235, 54, 54, 0.57)',
  warning: 'rgba(255, 140, 0, 1)',
  warningBg: 'rgba(255, 140, 0, 0.34)',
  negro: '#000000ff',
  blanco: '#ffffffff',
} as const;

const PDF_CONFIG = {
  canvas: { width: 1200, height: 800 },
  margin: { x: 40, y: 20 },
  header: { scale: 1.5, fontSize: 12 },
  fonts: { legend: 20, title: 18, ticks: 16 },
} as const;

// El PDF muestra el valor inicial solo si la cuenta recibida lo trae.
interface CuentaGrafico extends CuentasModelo {
  valor_cuenta?: number;
}

interface DatosGrafico {
  labels: string[];
  balances: number[];
  firstBalance: number;
}

@Component({
  selector: 'app-grafico-estadistico',
  templateUrl: './grafico-estadistico.component.html',
  styleUrls: ['./grafico-estadistico.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicComponentes],
})
export class GraficoEstadisticoComponent {
  readonly datos = input<OperacionCuentaModelo[]>([]);
  readonly cuentaSeleccionada = input<CuentaGrafico | null>(null);

  private readonly lienzoBalance =
    viewChild.required<ElementRef<HTMLCanvasElement>>('balanceChart');
  private instanciaGrafico: Chart | null = null;

  constructor() {
    // Igual que antes: cada cambio de datos destruye y vuelve a crear el gráfico.
    // El cleanup destruye la instancia al redibujar y al destruir el componente.
    effect((alLimpiar) => {
      const datos = this.datos() ?? [];
      const lienzo = this.lienzoBalance().nativeElement;
      this.crearGrafica(lienzo, datos);
      alLimpiar(() => this.destruirGrafica());
    });
  }

  private crearGrafica(
    lienzo: HTMLCanvasElement,
    datos: OperacionCuentaModelo[],
  ): void {
    this.destruirGrafica();
    const contexto = lienzo.getContext('2d');
    if (!contexto) return;
    const config = this.crearConfiguracionGrafico(
      this.prepararDatosGrafico(datos),
      false,
    );
    this.instanciaGrafico = new Chart(contexto, config);
  }

  private prepararDatosGrafico(datos: OperacionCuentaModelo[]): DatosGrafico {
    const labels = datos.map((operacion, indice) => {
      if (!operacion.fecha_fin) return `Op ${indice + 1}`;

      const fecha = new Date(operacion.fecha_fin);
      if (isNaN(fecha.getTime())) return `Op ${indice + 1}`;

      const yyyy = fecha.getFullYear();
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
      const dd = String(fecha.getDate()).padStart(2, '0');
      const hh = String(fecha.getHours()).padStart(2, '0');
      const min = String(fecha.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    });

    const balances = datos.map((operacion) => operacion.balance);
    const firstBalance = balances.length > 0 ? balances[0] : 0;

    return { labels, balances, firstBalance };
  }

  private crearConfiguracionGrafico(
    { labels, balances, firstBalance }: DatosGrafico,
    esPDF: boolean,
  ): ChartConfiguration<'line'> {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Balance',
            data: balances,
            borderColor: CHART_COLORS.profit,
            backgroundColor: CHART_COLORS.profitBg,
            fill: true,
            tension: 0.3,
            pointRadius: 3.5,
            pointHoverRadius: 2,
            pointBackgroundColor: CHART_COLORS.negro,
            pointBorderColor: CHART_COLORS.blanco,
            pointBorderWidth: 1,
            segment: {
              borderColor: (contexto) =>
                this.obtenerColorLinea(contexto, firstBalance, balances),
              backgroundColor: (contexto) =>
                this.obtenerColorFondo(contexto, firstBalance, balances),
            },
          },
        ],
      },
      options: this.crearOpcionesGrafico(esPDF),
    };
  }

  private obtenerColorLinea(
    contexto: ScriptableLineSegmentContext,
    firstBalance: number,
    datos: number[],
  ): string {
    const { yPrev, yNext } = this.obtenerValoresSegmento(contexto);
    const indice = contexto.p0DataIndex;

    if (yPrev < firstBalance && yNext < firstBalance) return CHART_COLORS.loss;
    if (
      this.esCambioSignificativo(yPrev, yNext, firstBalance) ||
      this.esDescenso(yNext, yPrev, indice, datos)
    )
      return CHART_COLORS.warning;
    return CHART_COLORS.profit;
  }

  private obtenerColorFondo(
    contexto: ScriptableLineSegmentContext,
    firstBalance: number,
    datos: number[],
  ): string | undefined {
    const { yPrev, yNext } = this.obtenerValoresSegmento(contexto);
    const indice = contexto.p0DataIndex;

    if (yPrev < firstBalance && yNext < firstBalance)
      return CHART_COLORS.lossBg;
    if (
      this.esCambioSignificativo(yPrev, yNext, firstBalance) ||
      this.esDescenso(yNext, yPrev, indice, datos)
    )
      return CHART_COLORS.warningBg;
    return undefined;
  }

  private obtenerValoresSegmento(contexto: ScriptableLineSegmentContext) {
    return {
      yPrev: contexto.p0.parsed.y,
      yNext: contexto.p1.parsed.y,
    };
  }

  private esCambioSignificativo(
    yPrev: number,
    yNext: number,
    firstBalance: number,
  ): boolean {
    return (
      (yPrev < firstBalance && yNext >= firstBalance) ||
      (yPrev >= firstBalance && yNext < firstBalance)
    );
  }

  private esDescenso(
    yNext: number,
    yPrev: number,
    indice: number,
    datos: number[],
  ): boolean {
    return yNext < yPrev && indice > 0 && datos[indice] < datos[indice - 1];
  }

  private crearOpcionesGrafico(esPDF: boolean): ChartOptions<'line'> {
    return {
      responsive: !esPDF,
      maintainAspectRatio: esPDF ? false : undefined,
      animation: esPDF ? false : undefined,
      plugins: {
        legend: {
          display: true,
          ...(esPDF && { labels: { font: { size: PDF_CONFIG.fonts.legend } } }),
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (contexto: TooltipItem<'line'>) => {
              return `Balance: ${contexto.parsed.y.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`;
            },
          },
        },
        // Valores sobre cada punto: solo en el PDF.
        datalabels: {
          display: esPDF,
          align: 'top',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderColor: CHART_COLORS.profit,
          borderWidth: 1,
          borderRadius: 4,
          padding: 4,
          font: {
            size: esPDF ? 10 : 8,
            weight: 'bold',
          },
          formatter: (valor: number) => {
            return valor.toLocaleString('es-ES', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          title: {
            display: true,
            text: 'Fecha',
            ...(esPDF && { font: { size: PDF_CONFIG.fonts.title } }),
          },
          ticks: {
            ...(esPDF && { font: { size: PDF_CONFIG.fonts.ticks } }),
            autoSkip: false,
            maxRotation: 90,
            minRotation: 45,
          },
        },
        y: {
          title: {
            display: true,
            text: 'Balance',
            ...(esPDF && { font: { size: PDF_CONFIG.fonts.title } }),
          },
          ...(esPDF && { ticks: { font: { size: PDF_CONFIG.fonts.ticks } } }),
        },
      },
    };
  }

  private destruirGrafica(): void {
    if (!this.instanciaGrafico) return;
    this.instanciaGrafico.destroy();
    this.instanciaGrafico = null;
  }

  exportarAPDF(): void {
    if (!this.instanciaGrafico) return;

    const datos = this.datos();
    if (datos.length === 0) return;

    this.crearCanvasTemporalYExportar(datos);
  }

  private crearCanvasTemporalYExportar(datos: OperacionCuentaModelo[]): void {
    const { canvas: canvasTemporal, ctx: contextoTemporal } =
      this.crearCanvasTemporal();
    if (!contextoTemporal) return;

    const config = this.crearConfiguracionGrafico(
      this.prepararDatosGrafico(datos),
      true,
    );
    const graficoTemporal = new Chart(contextoTemporal, config);

    setTimeout(() => {
      this.procesarExportacionPDF(canvasTemporal, graficoTemporal, datos);
    }, 500);
  }

  private crearCanvasTemporal(): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
  } {
    const canvas = document.createElement('canvas');
    canvas.width = PDF_CONFIG.canvas.width;
    canvas.height = PDF_CONFIG.canvas.height;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);

    return { canvas, ctx: canvas.getContext('2d') };
  }

  private procesarExportacionPDF(
    canvas: HTMLCanvasElement,
    grafico: Chart,
    datos: OperacionCuentaModelo[],
  ): void {
    try {
      const imagen = canvas.toDataURL('image/png', 1.0);
      grafico.destroy();
      document.body.removeChild(canvas);

      this.generarPDF(imagen, datos);
    } catch {
      grafico.destroy();
      document.body.removeChild(canvas);
    }
  }

  private generarPDF(imagen: string, datos: OperacionCuentaModelo[]): void {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    this.agregarEncabezadoPDF(pdf, datos);
    this.agregarGraficoPDF(pdf, imagen);

    const nombreArchivo = `balance-${this.cuentaSeleccionada()?.cue_nombre || 'cuenta'}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(nombreArchivo);
  }

  private agregarEncabezadoPDF(
    pdf: jsPDF,
    datos: OperacionCuentaModelo[],
  ): void {
    const { scale, fontSize } = PDF_CONFIG.header;
    const baseY = 30 * scale;
    const cuenta = this.cuentaSeleccionada();

    pdf.setFontSize(fontSize * scale);

    const informacion = [
      {
        label: 'Cuenta:',
        value: cuenta?.cue_nombre || 'Cuenta',
        labelX: 40,
        valueX: 90,
      },
      {
        label: 'Valor inicial:',
        value: cuenta?.valor_cuenta ?? '',
        labelX: 195,
        valueX: 270,
      },
      {
        label: 'Valor actual:',
        value: datos.length > 0 ? datos[datos.length - 1].balance : '',
        labelX: 320,
        valueX: 397,
      },
      {
        label: 'Fecha:',
        value: new Date().toLocaleDateString('es-ES'),
        labelX: 435,
        valueX: 477,
      },
    ];

    informacion.forEach(({ label, value, labelX, valueX }) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, labelX * scale, baseY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(String(value), valueX * scale, baseY);
    });
  }

  private agregarGraficoPDF(pdf: jsPDF, imagen: string): void {
    const anchoPagina = pdf.internal.pageSize.getWidth();
    const altoPagina = pdf.internal.pageSize.getHeight();

    const altoEncabezado =
      30 * PDF_CONFIG.header.scale + 20 * PDF_CONFIG.header.scale;
    const anchoDisponible = anchoPagina - PDF_CONFIG.margin.x * 2;
    const altoDisponible =
      altoPagina - altoEncabezado - PDF_CONFIG.margin.y * 2;

    const proporcion = Math.min(
      anchoDisponible / PDF_CONFIG.canvas.width,
      altoDisponible / PDF_CONFIG.canvas.height,
    );

    const anchoImagen = PDF_CONFIG.canvas.width * proporcion;
    const altoImagen = PDF_CONFIG.canvas.height * proporcion;
    const imagenX = PDF_CONFIG.margin.x + (anchoDisponible - anchoImagen) / 2;
    const imagenY = altoEncabezado + PDF_CONFIG.margin.y;

    pdf.addImage(imagen, 'PNG', imagenX, imagenY, anchoImagen, altoImagen, '', 'NONE');
  }
}
