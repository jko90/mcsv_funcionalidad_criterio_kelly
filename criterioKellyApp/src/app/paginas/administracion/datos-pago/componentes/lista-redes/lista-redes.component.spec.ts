import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RedUsdtConQr } from '../../modelos/DatosPagoAdmin.modelo';
import { ListaRedesComponent } from './lista-redes.component';

const RED: RedUsdtConQr = {
  red_idRed: 3,
  red_clave: 'TEST',
  red_nombre: 'Red de prueba',
  red_etiqueta: 'T20',
  red_direccion: 'TESTTESTTESTTEST',
  red_activo: 1,
  red_orden: 2,
  tieneQr: true,
  qrTamano: 10,
  qrTipoMime: 'image/png',
  qrHash: 'hash',
  urlQr: null,
};

describe('ListaRedesComponent', () => {
  let fixture: ComponentFixture<ListaRedesComponent>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ListaRedesComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(ListaRedesComponent);
    fixture.componentRef.setInput('redes', [RED]);
    fixture.detectChanges();
    raiz = fixture.nativeElement as HTMLElement;
  });

  it('muestra la red con su dirección como texto y el estado del QR', () => {
    expect(raiz.textContent).toContain('Red de prueba');
    expect(raiz.querySelector('code')?.textContent).toBe('TESTTESTTESTTEST');
    expect(raiz.textContent).toContain('Con QR');
  });

  it('sin redes invita a agregar la primera', () => {
    fixture.componentRef.setInput('redes', []);
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Aún no hay redes');
  });

  it('emite edición, QR y eliminación de la red tocada', () => {
    const emitidos: string[] = [];
    const componente = fixture.componentInstance;
    componente.edicionSolicitada.subscribe((red) => emitidos.push(`editar ${red.red_idRed}`));
    componente.qrSolicitado.subscribe((red) => emitidos.push(`qr ${red.red_idRed}`));
    componente.eliminacionSolicitada.subscribe((red) => emitidos.push(`eliminar ${red.red_idRed}`));
    const botones = raiz.querySelectorAll<HTMLElement>('.lista-redes__acciones ion-button');
    botones.forEach((boton) => boton.click());
    expect(emitidos).toEqual(['qr 3', 'editar 3', 'eliminar 3']);
  });

  it('cambiar el interruptor de la red emite su id y el nuevo estado', () => {
    const emitidos: { idRed: number; activo: boolean }[] = [];
    fixture.componentInstance.estadoRedCambiado.subscribe((cambio) => emitidos.push(cambio));
    const interruptores = raiz.querySelectorAll<HTMLElement>('ion-toggle');
    interruptores[1].dispatchEvent(new CustomEvent('ionChange', { detail: { checked: false } }));
    expect(emitidos).toEqual([{ idRed: 3, activo: false }]);
  });

  it('el interruptor del método emite el nuevo estado', () => {
    const emitidos: boolean[] = [];
    fixture.componentInstance.estadoMetodoCambiado.subscribe((activo) => emitidos.push(activo));
    raiz
      .querySelector<HTMLElement>('ion-toggle')
      ?.dispatchEvent(new CustomEvent('ionChange', { detail: { checked: true } }));
    expect(emitidos).toEqual([true]);
  });
});
