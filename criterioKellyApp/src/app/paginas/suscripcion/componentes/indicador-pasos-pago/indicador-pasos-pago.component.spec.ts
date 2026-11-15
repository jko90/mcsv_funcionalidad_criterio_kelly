import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IndicadorPasosPagoComponent } from './indicador-pasos-pago.component';

describe('IndicadorPasosPagoComponent', () => {
  let fixture: ComponentFixture<IndicadorPasosPagoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IndicadorPasosPagoComponent] });
    fixture = TestBed.createComponent(IndicadorPasosPagoComponent);
  });

  it('marca el paso actual y completa los anteriores', () => {
    fixture.componentRef.setInput('pasoActual', 'INSTRUCCIONES');
    fixture.detectChanges();
    const pasos = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(pasos.length).toBe(3);
    expect(pasos[0].classList).toContain('pasos-pago__paso--completo');
    expect(pasos[1].getAttribute('aria-current')).toBe('step');
    expect(pasos[2].getAttribute('aria-current')).toBeNull();
  });
});
