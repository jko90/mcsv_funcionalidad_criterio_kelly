import { ComponentFixture, TestBed } from '@angular/core/testing';
import Chart from 'chart.js/auto';
import { OperacionCuentaModelo } from '../../../compartido/modelos/DetalleOperacion.modelo';
import { GraficoEstadisticoComponent } from './grafico-estadistico.component';

function operacion(fechaFin: string, balance: number): OperacionCuentaModelo {
  return { fecha_fin: fechaFin, balance } as OperacionCuentaModelo;
}

describe('GraficoEstadisticoComponent', () => {
  let fixture: ComponentFixture<GraficoEstadisticoComponent>;

  function lienzo(): HTMLCanvasElement {
    return fixture.nativeElement.querySelector('canvas');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [GraficoEstadisticoComponent] });
    fixture = TestBed.createComponent(GraficoEstadisticoComponent);
  });

  it('sin datos no falla y crea un gráfico vacío', () => {
    fixture.detectChanges();
    const grafico = Chart.getChart(lienzo());
    expect(grafico).toBeTruthy();
    expect(grafico?.data.labels?.length).toBe(0);
  });

  it('con datos crea el gráfico con la serie Balance y las etiquetas con fecha', () => {
    fixture.componentRef.setInput('datos', [
      operacion('2026-11-10 08:30:00', 100),
      operacion('2026-11-11 09:05:00', 120),
    ]);
    fixture.detectChanges();
    const grafico = Chart.getChart(lienzo());
    expect(grafico?.data.datasets[0].label).toBe('Balance');
    expect(grafico?.data.datasets[0].data).toEqual([100, 120]);
    expect(grafico?.data.labels).toEqual(['2026-11-10 08:30', '2026-11-11 09:05']);
  });

  it('al cambiar datos redibuja sin duplicar instancias', () => {
    fixture.componentRef.setInput('datos', [operacion('2026-11-10 08:30:00', 100)]);
    fixture.detectChanges();
    const primero = Chart.getChart(lienzo());
    fixture.componentRef.setInput('datos', [
      operacion('2026-11-10 08:30:00', 100),
      operacion('2026-11-11 09:05:00', 150),
    ]);
    fixture.detectChanges();
    const segundo = Chart.getChart(lienzo());
    expect(segundo).not.toBe(primero);
    expect(segundo?.data.datasets[0].data).toEqual([100, 150]);
  });

  it('usa «Op N» cuando la fecha falta o es inválida', () => {
    fixture.componentRef.setInput('datos', [operacion('', 10), operacion('no es fecha', 20)]);
    fixture.detectChanges();
    expect(Chart.getChart(lienzo())?.data.labels).toEqual(['Op 1', 'Op 2']);
  });

  it('destruye el gráfico al destruir el componente', () => {
    fixture.detectChanges();
    const elemento = lienzo();
    expect(Chart.getChart(elemento)).toBeTruthy();
    fixture.destroy();
    expect(Chart.getChart(elemento)).toBeUndefined();
  });
});
