import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OpcionMetodoPago } from '../../modelos/PasoPago.modelo';
import { SelectorMetodoPagoComponent } from './selector-metodo-pago.component';

const OPCIONES: OpcionMetodoPago[] = [
  { metodo: 'CRIPTOMONEDA', titulo: 'Criptomoneda (USDT)', descripcion: 'd', icono: 'x', disponible: true },
  { metodo: 'PAYPAL', titulo: 'PayPal', descripcion: 'd', icono: 'x', disponible: false },
  { metodo: 'BANCO', titulo: 'Transferencia bancaria', descripcion: 'd', icono: 'x', disponible: true },
];

describe('SelectorMetodoPagoComponent', () => {
  let fixture: ComponentFixture<SelectorMetodoPagoComponent>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SelectorMetodoPagoComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(SelectorMetodoPagoComponent);
    fixture.componentRef.setInput('opciones', OPCIONES);
    fixture.detectChanges();
    raiz = fixture.nativeElement as HTMLElement;
  });

  it('muestra las tres tarjetas y deshabilita la no disponible', () => {
    const botones = raiz.querySelectorAll<HTMLButtonElement>('button');
    expect(botones.length).toBe(3);
    expect(raiz.textContent).toContain('Elige cómo pagar');
    expect(botones[1].disabled).toBeTrue();
    expect(botones[1].textContent).toContain('Aún no está disponible, elige otro');
  });

  it('emite el método tocado', () => {
    const emitido: string[] = [];
    fixture.componentInstance.metodoSeleccionado.subscribe((metodo) => emitido.push(metodo));
    raiz.querySelectorAll<HTMLButtonElement>('button')[2].click();
    expect(emitido).toEqual(['BANCO']);
  });

  it('mientras carga muestra el estado y no deja elegir ninguna tarjeta', () => {
    fixture.componentRef.setInput('estaCargando', true);
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Cargando los métodos de pago');
    raiz.querySelectorAll<HTMLButtonElement>('button').forEach((boton) => {
      expect(boton.disabled).toBeTrue();
    });
  });

  it('si falló la carga muestra el aviso y Reintentar emite la solicitud', () => {
    fixture.componentRef.setInput('hayErrorDeCarga', true);
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Este método aún no está disponible, elige otro');
    const emitidos: number[] = [];
    fixture.componentInstance.reintentarSolicitado.subscribe(() => emitidos.push(1));
    raiz.querySelector<HTMLElement>('.selector-metodo__error ion-button')?.click();
    expect(emitidos.length).toBe(1);
  });
});
