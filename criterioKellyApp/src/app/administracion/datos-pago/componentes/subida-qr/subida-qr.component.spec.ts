import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RedUsdtConQr } from '../../modelos/DatosPagoAdmin.modelo';
import { SubidaQrComponent } from './subida-qr.component';

const RED: RedUsdtConQr = {
  red_idRed: 3,
  red_clave: 'TEST',
  red_nombre: 'Red de prueba',
  red_etiqueta: 'T20',
  red_direccion: 'TESTTESTTESTTEST',
  red_activo: 1,
  red_orden: 0,
  tieneQr: false,
  qrTamano: null,
  qrTipoMime: null,
  qrHash: null,
  urlQr: null,
};

describe('SubidaQrComponent', () => {
  let fixture: ComponentFixture<SubidaQrComponent>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SubidaQrComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(SubidaQrComponent);
    fixture.componentRef.setInput('red', RED);
    fixture.detectChanges();
    raiz = fixture.nativeElement as HTMLElement;
  });

  it('sin QR ofrece elegir imagen, indica el tope y no ofrece quitar', () => {
    expect(raiz.textContent).toContain('Esta red aún no tiene código QR');
    expect(raiz.textContent).toContain('hasta 256 KB');
    expect(raiz.querySelector('input[type=file]')?.getAttribute('accept')).toBe(
      'image/png,image/jpeg,image/webp',
    );
    expect(raiz.textContent).not.toContain('Quitar el QR');
  });

  it('con QR muestra la imagen con su texto alternativo y permite quitar', () => {
    fixture.componentRef.setInput('red', { ...RED, tieneQr: true, urlQr: 'blob:prueba' });
    fixture.detectChanges();
    const imagen = raiz.querySelector<HTMLImageElement>('img');
    expect(imagen?.getAttribute('src')).toBe('blob:prueba');
    expect(imagen?.alt).toBe('Código QR de la red Red de prueba');
    const quitados: number[] = [];
    fixture.componentInstance.quitarSolicitado.subscribe(() => quitados.push(1));
    raiz.querySelector<HTMLElement>('ion-button[color=danger]')?.click();
    expect(quitados.length).toBe(1);
  });

  it('con vista previa permite confirmar o descartar', () => {
    fixture.componentRef.setInput('vistaPrevia', 'data:image/png;base64,AAAA');
    fixture.componentRef.setInput('puedeConfirmar', true);
    fixture.detectChanges();
    const eventos: string[] = [];
    fixture.componentInstance.confirmarSolicitado.subscribe(() => eventos.push('confirmar'));
    fixture.componentInstance.descartarSolicitado.subscribe(() => eventos.push('descartar'));
    const botones = raiz.querySelectorAll<HTMLElement>('.subida-qr__acciones ion-button');
    botones[0].click();
    botones[1].click();
    expect(eventos).toEqual(['confirmar', 'descartar']);
  });

  it('elegir un archivo emite el evento original', () => {
    const recibidos: Event[] = [];
    fixture.componentInstance.archivoElegido.subscribe((evento) => recibidos.push(evento));
    const entrada = raiz.querySelector<HTMLInputElement>('input[type=file]');
    entrada?.dispatchEvent(new Event('change'));
    expect(recibidos.length).toBe(1);
  });
});
