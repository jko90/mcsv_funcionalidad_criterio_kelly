import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PagoPendiente } from '../../modelos/PagoPendiente.modelo';
import { DetallePagoComponent } from './detalle-pago.component';

const IMAGEN = 'data:image/png;base64,AAAA';

function crearPago(cambios: Partial<PagoPendiente> = {}): PagoPendiente {
  return {
    pag_idPago: 3,
    usuario: 'ana',
    pla_nombre: 'Pro',
    ins_nombre: 'Mensual',
    pag_monto: 20,
    pag_moneda: 'USD',
    pag_metodoPago: 'BANCO',
    pag_idTransac: 'TX-1',
    pag_fechaPago: '2026-11-12 10:30:00',
    tieneComprobante: true,
    esPropio: false,
    esAnticipado: false,
    fechaInicioResultante: '2026-11-12',
    fechaCorteResultante: '2026-12-12',
    esAntiguo: false,
    ...cambios,
  } as PagoPendiente;
}

describe('DetallePagoComponent', () => {
  let fixture: ComponentFixture<DetallePagoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DetallePagoComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(DetallePagoComponent);
  });

  function mostrar(pago: PagoPendiente, comprobante: string | null = IMAGEN): HTMLElement {
    fixture.componentRef.setInput('pago', pago);
    fixture.componentRef.setInput('comprobante', comprobante);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function botones(raiz: HTMLElement): HTMLElement[] {
    return Array.from(raiz.querySelectorAll<HTMLElement>('.detalle-pago__acciones ion-button'));
  }

  // Con CUSTOM_ELEMENTS_SCHEMA [disabled] queda como propiedad del elemento, no como atributo.
  function estaDeshabilitado(boton: HTMLElement | undefined): boolean {
    return (boton as unknown as { disabled?: boolean } | undefined)?.disabled ?? true;
  }

  function aprobarDeshabilitado(raiz: HTMLElement): boolean {
    const aprobar = botones(raiz).find((boton) => boton.textContent?.includes('Aprobar'));
    return estaDeshabilitado(aprobar);
  }

  it('pago normal: periodo resultante, imagen y Aprobar habilitado', () => {
    const raiz = mostrar(crearPago());
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Subido el 12/11/2026 10:30');
    expect(texto).toContain('Si apruebas, el plan corre desde el 12/11/2026 hasta el 12/12/2026');
    expect(raiz.querySelector('img.detalle-pago__imagen')).not.toBeNull();
    expect(botones(raiz).length).toBe(2);
    expect(aprobarDeshabilitado(raiz)).toBeFalse();
  });

  it('VP-09 anticipado: texto de pago anticipado y Aprobar habilitado', () => {
    const raiz = mostrar(
      crearPago({
        esAnticipado: true,
        fechaInicioResultante: '2026-12-13',
        fechaCorteResultante: '2027-01-13',
      }),
    );
    expect(raiz.textContent).toContain(
      'Pago anticipado: el nuevo periodo empezará el 13/12/2026 y terminará el 13/01/2027; el plan actual no se toca',
    );
    expect(aprobarDeshabilitado(raiz)).toBeFalse();
  });

  it('VP-09 fechas null: avisa del otro plan y deshabilita Aprobar', () => {
    const raiz = mostrar(crearPago({ fechaInicioResultante: null, fechaCorteResultante: null }));
    expect(raiz.textContent).toContain(
      'El dueño tiene otro plan de pago activo; el servidor no permitirá aprobarlo',
    );
    expect(aprobarDeshabilitado(raiz)).toBeTrue();
  });

  it('VP-08 antiguo: aviso y Aprobar deshabilitado, Rechazar disponible', () => {
    const raiz = mostrar(crearPago({ esAntiguo: true }));
    expect(raiz.textContent).toContain(
      'Este comprobante es demasiado antiguo: su fecha de corte ya pasó',
    );
    expect(aprobarDeshabilitado(raiz)).toBeTrue();
    const rechazar = botones(raiz).find((boton) => boton.textContent?.includes('Rechazar'));
    expect(estaDeshabilitado(rechazar)).toBeFalse();
  });

  it('sin comprobante: texto y Aprobar deshabilitado', () => {
    const raiz = mostrar(crearPago({ tieneComprobante: false }), null);
    expect(raiz.textContent).toContain('Sin comprobante');
    expect(raiz.querySelector('img.detalle-pago__imagen')).toBeNull();
    expect(aprobarDeshabilitado(raiz)).toBeTrue();
  });

  it('pago propio: sin botones y con el aviso', () => {
    const raiz = mostrar(crearPago({ esPropio: true }));
    expect(botones(raiz).length).toBe(0);
    expect(raiz.textContent).toContain('No puedes validar tu propio pago');
  });

  it('emite aprobar y rechazar', () => {
    const raiz = mostrar(crearPago());
    let aprobados = 0;
    let rechazados = 0;
    fixture.componentInstance.aprobarSolicitado.subscribe(() => aprobados++);
    fixture.componentInstance.rechazarSolicitado.subscribe(() => rechazados++);
    botones(raiz).forEach((boton) => boton.click());
    expect(aprobados).toBe(1);
    expect(rechazados).toBe(1);
  });

  it('procesando deshabilita Aprobar y Rechazar', () => {
    fixture.componentRef.setInput('procesando', true);
    const raiz = mostrar(crearPago());
    expect(botones(raiz).every((boton) => estaDeshabilitado(boton))).toBeTrue();
  });
});
