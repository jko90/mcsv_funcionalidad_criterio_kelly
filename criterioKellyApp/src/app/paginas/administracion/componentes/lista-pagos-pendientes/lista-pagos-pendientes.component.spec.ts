import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PagoPendiente } from '../../modelos/PagoPendiente.modelo';
import { ListaPagosPendientesComponent } from './lista-pagos-pendientes.component';

function crearPago(id: number, cambios: Partial<PagoPendiente> = {}): PagoPendiente {
  return {
    pag_idPago: id,
    usuario: 'ana',
    pla_nombre: 'Pro',
    ins_nombre: 'Mensual',
    pag_monto: 20,
    pag_moneda: 'USD',
    pag_metodoPago: 'BANCO',
    pag_idTransac: 'TX-1',
    pag_fechaPago: '2026-11-12 10:30:00',
    tieneComprobante: true,
    ...cambios,
  } as PagoPendiente;
}

describe('ListaPagosPendientesComponent', () => {
  let fixture: ComponentFixture<ListaPagosPendientesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ListaPagosPendientesComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(ListaPagosPendientesComponent);
  });

  function texto(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('muestra usuario, plan, monto, fecha y estado del comprobante', () => {
    fixture.componentRef.setInput('pagos', [
      crearPago(1),
      crearPago(2, { usuario: 'luis', tieneComprobante: false }),
    ]);
    const contenido = texto();
    expect(contenido).toContain('ana');
    expect(contenido).toContain('20 USD');
    expect(contenido).toContain('Subido el 12/11/2026 10:30');
    expect(contenido).toContain('Con comprobante');
    expect(contenido).toContain('Sin comprobante');
  });

  it('muestra el mensaje de lista vacía', () => {
    fixture.componentRef.setInput('pagos', []);
    expect(texto()).toContain('No hay pagos en revisión');
  });

  it('solo muestra Cargar más con hayMas', () => {
    fixture.componentRef.setInput('pagos', [crearPago(1)]);
    expect(texto()).not.toContain('Cargar más');
    fixture.componentRef.setInput('hayMas', true);
    expect(texto()).toContain('Cargar más');
  });

  it('emite el pago al tocar una fila', () => {
    const pago = crearPago(1);
    fixture.componentRef.setInput('pagos', [pago]);
    fixture.detectChanges();
    let emitido: PagoPendiente | null = null;
    fixture.componentInstance.pagoSeleccionado.subscribe((p) => (emitido = p));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ion-item')?.click();
    expect(emitido as PagoPendiente | null).toBe(pago);
  });
});
