import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InstruccionesPagoComponent } from './instrucciones-pago.component';

const RED_TRON = {
  clave: 'TRON',
  nombre: 'TRON',
  etiqueta: 'TRC20',
  direccion: 'TXYZ123',
  tieneQr: true,
  qrHash: 'hash',
};

describe('InstruccionesPagoComponent', () => {
  let fixture: ComponentFixture<InstruccionesPagoComponent>;

  function texto(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InstruccionesPagoComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(InstruccionesPagoComponent);
  });

  it('cripto muestra la red, la dirección y la advertencia de enviar solo USDT', () => {
    fixture.componentRef.setInput('metodo', 'CRIPTOMONEDA');
    fixture.componentRef.setInput('monto', 20);
    fixture.componentRef.setInput('redesUsdt', [RED_TRON]);
    const contenido = texto();
    expect(contenido).toContain('Red TRON (TRC20)');
    expect(contenido).toContain('TXYZ123');
    expect(contenido).toContain('Envía solo USDT');
    expect(contenido).toContain('Ahora necesito subir el comprobante');
  });

  it('copiar emite la dirección', () => {
    fixture.componentRef.setInput('metodo', 'CRIPTOMONEDA');
    fixture.componentRef.setInput('redesUsdt', [RED_TRON]);
    fixture.detectChanges();
    const emitido: string[] = [];
    fixture.componentInstance.copiarSolicitado.subscribe((valor) => emitido.push(valor));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ion-button')?.click();
    expect(emitido).toEqual(['TXYZ123']);
  });

  it('paypal muestra el correo configurado', () => {
    fixture.componentRef.setInput('metodo', 'PAYPAL');
    fixture.componentRef.setInput('correoPaypal', 'pagos@ejemplo.test');
    expect(texto()).toContain('pagos@ejemplo.test');
  });

  it('no disponible muestra el mensaje amable y no ofrece continuar', () => {
    fixture.componentRef.setInput('metodo', 'PAYPAL');
    fixture.componentRef.setInput('disponible', false);
    const contenido = texto();
    expect(contenido).toContain('Este método aún no está disponible, elige otro');
    expect(contenido).not.toContain('Ahora necesito subir el comprobante');
    expect(contenido).toContain('Cambiar método');
  });

  it('banco recorre las tres etapas', () => {
    fixture.componentRef.setInput('metodo', 'BANCO');
    expect(texto()).toContain('Pedir datos por WhatsApp');
    expect(texto()).not.toContain('Ahora necesito subir el comprobante');

    fixture.componentRef.setInput('etapaBanco', 'WHATSAPP_ABIERTO');
    expect(texto()).toContain('Ya enviaste la solicitud');
    expect(texto()).toContain('Ya envié la solicitud');
    expect(texto()).not.toContain('Ahora necesito subir el comprobante');

    fixture.componentRef.setInput('etapaBanco', 'SOLICITUD_CONFIRMADA');
    expect(texto()).toContain('Ahora necesito subir el comprobante');
  });

  it('con QR muestra la imagen junto a la dirección con su texto alternativo', () => {
    fixture.componentRef.setInput('metodo', 'CRIPTOMONEDA');
    fixture.componentRef.setInput('redesUsdt', [RED_TRON]);
    fixture.componentRef.setInput('urlsQr', { TRON: 'blob:prueba' });
    fixture.detectChanges();
    const imagen = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('img');
    expect(imagen?.getAttribute('src')).toBe('blob:prueba');
    expect(imagen?.alt).toBe('Código QR de la red TRON');
    expect(texto()).toContain('TXYZ123');
  });

  it('sin QR no muestra imagen y deja solo la dirección', () => {
    fixture.componentRef.setInput('metodo', 'CRIPTOMONEDA');
    fixture.componentRef.setInput('redesUsdt', [{ ...RED_TRON, tieneQr: false, qrHash: null }]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect(texto()).toContain('Copiar dirección');
  });

  it('tocar el QR lo amplía y volver a tocarlo lo reduce', () => {
    fixture.componentRef.setInput('metodo', 'CRIPTOMONEDA');
    fixture.componentRef.setInput('redesUsdt', [RED_TRON]);
    fixture.componentRef.setInput('urlsQr', { TRON: 'blob:prueba' });
    fixture.detectChanges();
    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.instrucciones__qr');
    boton?.click();
    fixture.detectChanges();
    expect(boton?.classList).toContain('instrucciones__qr--ampliado');
    boton?.click();
    fixture.detectChanges();
    expect(boton?.classList).not.toContain('instrucciones__qr--ampliado');
  });
});
