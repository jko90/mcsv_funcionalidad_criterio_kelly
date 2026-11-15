import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { ModalPinComponent } from './modal-pin.component';

// Valores de prueba obvios: ningún PIN real aparece en este archivo.
const PIN_UNO = '111111';
const PIN_DOS = '222222';

describe('ModalPinComponent', () => {
  let fixture: ComponentFixture<ModalPinComponent>;
  let componente: ModalPinComponent;
  let confirmados: string[];
  let distintos: number;
  let omitidos: number;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModalPinComponent],
      providers: [provideIonicAngular()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(ModalPinComponent);
    componente = fixture.componentInstance;
    confirmados = [];
    distintos = 0;
    omitidos = 0;
    componente.pinConfirmado.subscribe((pin) => confirmados.push(pin));
    componente.pinDistinto.subscribe(() => distintos++);
    componente.omitido.subscribe(() => omitidos++);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('ion-alert').forEach((alerta) => alerta.remove());
  });

  function escribir(ingPin: string, confPin: string): void {
    componente.formularioPin.setValue({ ingPin, confPin });
    componente.alIngresarPin();
  }

  it('valida que cada campo tenga exactamente 6 dígitos', () => {
    componente.formularioPin.setValue({ ingPin: '12345', confPin: 'abcdef' });
    expect(componente.formularioPin.controls.ingPin.valid).toBeFalse();
    expect(componente.formularioPin.controls.confPin.valid).toBeFalse();
    componente.formularioPin.setValue({ ingPin: PIN_UNO, confPin: PIN_UNO });
    expect(componente.formularioPin.valid).toBeTrue();
  });

  it('no emite nada mientras falten dígitos en algún campo', () => {
    escribir(PIN_UNO, '1111');
    expect(confirmados).toEqual([]);
    expect(distintos).toBe(0);
  });

  it('con valores distintos limpia el formulario y emite pinDistinto', () => {
    escribir(PIN_UNO, PIN_DOS);
    expect(distintos).toBe(1);
    expect(confirmados).toEqual([]);
    expect(componente.formularioPin.getRawValue()).toEqual({ ingPin: '', confPin: '' });
  });

  it('con valores iguales emite pinConfirmado con el PIN y limpia el formulario', () => {
    escribir(PIN_UNO, PIN_UNO);
    expect(confirmados).toEqual([PIN_UNO]);
    expect(distintos).toBe(0);
    expect(componente.formularioPin.getRawValue()).toEqual({ ingPin: '', confPin: '' });
  });

  it('mientras guarda no acepta otra pulsación (sin doble guardado)', () => {
    fixture.componentRef.setInput('guardando', true);
    escribir(PIN_UNO, PIN_UNO);
    expect(confirmados).toEqual([]);
  });

  it('muestra la imagen solo mientras guarda', () => {
    const imagen = () => fixture.nativeElement.querySelector('.image-overlay');
    expect(imagen()).toBeNull();
    fixture.componentRef.setInput('guardando', true);
    fixture.detectChanges();
    expect(imagen()).not.toBeNull();
  });

  it('«Omitir» abre el aviso y no emite hasta confirmar', () => {
    componente.alSolicitarOmitirPin();
    expect(componente.omitirPinPendiente()).toBeTrue();
    expect(omitidos).toBe(0);
  });

  it('cancelar el aviso lo cierra sin emitir omitido', () => {
    componente.alSolicitarOmitirPin();
    componente.alDescartarOmitirPin();
    expect(componente.omitirPinPendiente()).toBeFalse();
    expect(omitidos).toBe(0);
  });

  it('confirmar el aviso cierra el aviso y emite omitido una vez', () => {
    componente.alSolicitarOmitirPin();
    componente.alConfirmarOmitirPin();
    expect(componente.omitirPinPendiente()).toBeFalse();
    expect(omitidos).toBe(1);
  });
});
