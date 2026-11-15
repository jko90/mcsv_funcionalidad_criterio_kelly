import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UltimoPago } from '../../modelos/EstadoPago.modelo';
import { PlanVigente } from '../../modelos/PlanVigente.modelo';
import { EstadoPagoComponent } from './estado-pago.component';

function pago(cambios: Partial<UltimoPago>): UltimoPago {
  return {
    pag_situacion: 'R',
    pag_fechaPago: '2026-11-12',
    motivoRechazo: null,
    ...cambios,
  } as UltimoPago;
}

describe('EstadoPagoComponent', () => {
  let fixture: ComponentFixture<EstadoPagoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EstadoPagoComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(EstadoPagoComponent);
  });

  function texto(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('R: en revisión con la fecha de subida', () => {
    fixture.componentRef.setInput('pago', pago({}));
    expect(texto()).toContain('En revisión: el administrador validará tu comprobante');
    expect(texto()).toContain('Subido el 2026-11-12');
  });

  it('F: rechazado muestra el motivo como texto, no como HTML', () => {
    fixture.componentRef.setInput(
      'pago',
      pago({ pag_situacion: 'F', motivoRechazo: '<b>Ilegible</b>' }),
    );
    expect(texto()).toContain('Rechazado: <b>Ilegible</b>');
    expect((fixture.nativeElement as HTMLElement).querySelector('b')).toBeNull();
  });

  it('C o sin pago con plan de pago: plan activo hasta la fecha de corte', () => {
    fixture.componentRef.setInput('pago', pago({ pag_situacion: 'C' }));
    fixture.componentRef.setInput('planVigente', {
      estado: 'PAGO',
      fechaCorte: '2026-12-31',
      planProgramado: null,
      planPendiente: null,
    } as PlanVigente);
    expect(texto()).toContain('Plan activo hasta 2026-12-31');
  });

  it('sin pago ni plan pendiente: no tienes pagos pendientes', () => {
    expect(texto()).toContain('No tienes pagos pendientes');
  });

  it('sin pago con plan pendiente: aún no has subido tu comprobante', () => {
    fixture.componentRef.setInput('planVigente', {
      estado: 'SIN_PLAN',
      planProgramado: null,
      planPendiente: { comprobanteEnviado: false },
    } as PlanVigente);
    expect(texto()).toContain('Aún no has subido tu comprobante');
  });
});
