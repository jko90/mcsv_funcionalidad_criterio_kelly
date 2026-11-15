import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { AvisoPlanComponent } from './aviso-plan.component';

describe('AvisoPlanComponent', () => {
  let fixture: ComponentFixture<AvisoPlanComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AvisoPlanComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(AvisoPlanComponent);
  });

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('AC-1: sin datos no pinta nada', () => {
    fixture.detectChanges();
    expect(texto().trim()).toBe('');
  });

  it('AC-2: pinta el tiempo de la prueba en curso', () => {
    fixture.componentRef.setInput('textoTiempo', 'Tu prueba termina en 5 h 20 min');
    fixture.detectChanges();
    expect(texto()).toContain('Tu prueba termina en 5 h 20 min');
  });

  it('AC-3: el aviso emite entendido al pulsar el botón', () => {
    fixture.componentRef.setInput('aviso', 'Terminó tu plan Libre');
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.entendido.subscribe(() => (emitido = true));

    const boton = (fixture.nativeElement as HTMLElement).querySelector(
      'ion-button',
    ) as HTMLElement;
    boton.click();

    expect(texto()).toContain('Terminó tu plan Libre');
    expect(emitido).toBeTrue();
  });

  it('AC-4: pinta la tarjeta de plan pendiente con su texto', () => {
    fixture.componentRef.setInput('tituloPendiente', 'Pro · Mensual');
    fixture.componentRef.setInput(
      'mensajePendiente',
      'Tu plan Pro está pendiente de pago y se activará cuando el administrador valide tu comprobante.',
    );
    fixture.detectChanges();
    expect(texto()).toContain('Pro · Mensual');
    expect(texto()).toContain(
      'se activará cuando el administrador valide tu comprobante',
    );
  });

  it('AC-5: el acceso a planes solo aparece si se permite y emite el evento', () => {
    fixture.componentRef.setInput('aviso', 'Debes activar un plan');
    fixture.detectChanges();
    expect(texto()).not.toContain('Ver planes');

    fixture.componentRef.setInput('puedeVerPlanes', true);
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.planesSolicitados.subscribe(
      () => (emitido = true),
    );
    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll(
      'ion-button',
    );
    (botones[0] as HTMLElement).click();

    expect(texto()).toContain('Ver planes');
    expect(emitido).toBeTrue();
  });

  it('AC-6: con cancelado y fecha pinta «Tu plan termina el …»', () => {
    fixture.componentRef.setInput('cancelado', true);
    fixture.componentRef.setInput('fechaCorte', '2026-12-01');
    fixture.detectChanges();
    expect(texto()).toContain('Tu plan termina el 2026-12-01');
  });

  it('AC-7: sin cancelado no pinta la fecha de término', () => {
    fixture.componentRef.setInput('fechaCorte', '2026-12-01');
    fixture.detectChanges();
    expect(texto()).not.toContain('Tu plan termina el');
  });

  it('AC-8: el botón Cancelar plan solo aparece con puedeCancelar y emite cancelar', () => {
    fixture.detectChanges();
    expect(texto()).not.toContain('Cancelar plan');

    fixture.componentRef.setInput('puedeCancelar', true);
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.cancelar.subscribe(() => (emitido = true));
    const boton = (fixture.nativeElement as HTMLElement).querySelector(
      'ion-button',
    ) as HTMLElement;
    boton.click();

    expect(texto()).toContain('Cancelar plan');
    expect(emitido).toBeTrue();
  });

  it('AC-9: cancelado y puedeCancelar no se muestran juntos si el padre los excluye', () => {
    fixture.componentRef.setInput('cancelado', true);
    fixture.componentRef.setInput('fechaCorte', '2026-12-01');
    fixture.componentRef.setInput('puedeCancelar', false);
    fixture.detectChanges();
    expect(texto()).toContain('Tu plan termina el');
    expect(texto()).not.toContain('Cancelar plan');
  });

  describe('acciones del comprobante', () => {
    function botonesDeTexto(fragmento: string): HTMLElement[] {
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('ion-button'),
      ).filter((boton) => (boton.textContent ?? '').includes(fragmento)) as HTMLElement[];
    }

    beforeEach(() => {
      fixture.componentRef.setInput('mensajePendiente', 'Tu plan Pro está pendiente de pago.');
    });

    it('AC-10: sin comprobante ofrece «Subir comprobante» y emite la intención', () => {
      fixture.componentRef.setInput('puedeSubirComprobante', true);
      fixture.detectChanges();
      let emitido = false;
      fixture.componentInstance.comprobanteSolicitado.subscribe(() => (emitido = true));

      expect(texto()).toContain('Plan pendiente de pago');
      expect(botonesDeTexto('Ver estado del pago').length).toBe(0);
      botonesDeTexto('Subir comprobante')[0].click();
      expect(emitido).toBeTrue();
    });

    it('AC-11: con comprobante en revisión ofrece «Ver estado del pago»', () => {
      fixture.componentRef.setInput('puedeVerEstadoPago', true);
      fixture.detectChanges();
      let emitido = false;
      fixture.componentInstance.comprobanteSolicitado.subscribe(() => (emitido = true));

      expect(texto()).toContain('Pago en revisión');
      expect(botonesDeTexto('Subir comprobante').length).toBe(0);
      botonesDeTexto('Ver estado del pago')[0].click();
      expect(emitido).toBeTrue();
    });

    it('AC-12: el pago anticipado solo aparece con puedePagarAnticipado', () => {
      fixture.detectChanges();
      expect(botonesDeTexto('Pagar mi renovación por anticipado').length).toBe(0);

      fixture.componentRef.setInput('puedePagarAnticipado', true);
      fixture.detectChanges();
      let emitido = false;
      fixture.componentInstance.comprobanteSolicitado.subscribe(() => (emitido = true));
      botonesDeTexto('Pagar mi renovación por anticipado')[0].click();
      expect(emitido).toBeTrue();
    });
  });
});
