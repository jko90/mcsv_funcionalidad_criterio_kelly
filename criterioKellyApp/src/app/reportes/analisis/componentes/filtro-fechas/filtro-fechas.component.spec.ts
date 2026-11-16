import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RangoFechas } from 'src/app/negocio/suscripcion/configuracion/permisos-plan.config';
import { FiltroFechasComponent } from './filtro-fechas.component';

describe('FiltroFechasComponent', () => {
  let fixture: ComponentFixture<FiltroFechasComponent>;
  let referencia: ComponentRef<FiltroFechasComponent>;
  let emitidos: RangoFechas[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FiltroFechasComponent] });
    fixture = TestBed.createComponent(FiltroFechasComponent);
    referencia = fixture.componentRef;
    referencia.setInput('desde', '2026-11-08');
    referencia.setInput('hasta', '2026-11-12');
    referencia.setInput('fechaMaxima', '2026-11-12');
    emitidos = [];
    fixture.componentInstance.rangoCambiado.subscribe((rango) => emitidos.push(rango));
  });

  it('emite el nuevo desde conservando el hasta y recorta la hora', () => {
    fixture.componentInstance.alElegirDesde('2026-11-10T00:00:00');
    expect(emitidos).toEqual([{ desde: '2026-11-10', hasta: '2026-11-12' }]);
  });

  it('emite el nuevo hasta conservando el desde', () => {
    fixture.componentInstance.alElegirHasta('2026-11-11');
    expect(emitidos).toEqual([{ desde: '2026-11-08', hasta: '2026-11-11' }]);
  });

  it('ignora valores que no son una fecha', () => {
    fixture.componentInstance.alElegirDesde(null);
    fixture.componentInstance.alElegirHasta(['2026-11-10']);
    expect(emitidos).toEqual([]);
  });
});
