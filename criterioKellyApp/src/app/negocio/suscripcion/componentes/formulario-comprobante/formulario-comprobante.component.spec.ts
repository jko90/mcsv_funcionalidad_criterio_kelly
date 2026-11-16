import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SolicitudComprobante } from '../../modelos/EstadoPago.modelo';
import { FormularioComprobanteComponent } from './formulario-comprobante.component';

const IMAGEN = 'data:image/png;base64,AAAA';

describe('FormularioComprobanteComponent', () => {
  let fixture: ComponentFixture<FormularioComprobanteComponent>;
  let componente: FormularioComprobanteComponent;
  let emitidos: SolicitudComprobante[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormularioComprobanteComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(FormularioComprobanteComponent);
    componente = fixture.componentInstance;
    emitidos = [];
    componente.enviar.subscribe((solicitud) => emitidos.push(solicitud));
    fixture.detectChanges();
  });

  function llenar(metodo: 'BANCO' | 'PAYPAL' | 'CRIPTOMONEDA', transaccion = 'TX-1'): void {
    componente.formulario.controls.metodoPago.setValue(metodo);
    componente.alCambiarMetodoPago(metodo);
    componente.formulario.controls.idTransaccion.setValue(transaccion);
  }

  it('sin datos no emite y marca los campos', () => {
    fixture.componentRef.setInput('vistaPrevia', IMAGEN);
    componente.alEnviar();
    expect(emitidos).toEqual([]);
    expect(componente.formulario.controls.idTransaccion.touched).toBeTrue();
  });

  it('sin imagen no emite aunque el formulario sea válido', () => {
    llenar('BANCO');
    componente.alEnviar();
    expect(emitidos).toEqual([]);
  });

  it('BANCO válido emite sin correo ni criptomoneda', () => {
    fixture.componentRef.setInput('vistaPrevia', IMAGEN);
    llenar('BANCO');
    componente.alEnviar();
    expect(emitidos).toEqual([
      { metodoPago: 'BANCO', idTransaccion: 'TX-1', comprobante: IMAGEN },
    ]);
  });

  it('PAYPAL exige un correo válido', () => {
    fixture.componentRef.setInput('vistaPrevia', IMAGEN);
    llenar('PAYPAL');
    componente.alEnviar();
    expect(emitidos).toEqual([]);

    componente.formulario.controls.correoTransaccion.setValue('no-es-correo');
    expect(componente.formulario.controls.correoTransaccion.invalid).toBeTrue();

    componente.formulario.controls.correoTransaccion.setValue('persona@correo.com');
    componente.alEnviar();
    expect(emitidos[0].correoTransaccion).toBe('persona@correo.com');
  });

  it('CRIPTOMONEDA exige la moneda y limita su longitud a 16', () => {
    fixture.componentRef.setInput('vistaPrevia', IMAGEN);
    llenar('CRIPTOMONEDA');
    componente.alEnviar();
    expect(emitidos).toEqual([]);

    componente.formulario.controls.criptomoneda.setValue('A'.repeat(17));
    expect(componente.formulario.controls.criptomoneda.invalid).toBeTrue();

    componente.formulario.controls.criptomoneda.setValue('USDT');
    componente.alEnviar();
    expect(emitidos[0].criptomoneda).toBe('USDT');
  });

  it('el número de transacción rechaza caracteres no permitidos y más de 254', () => {
    const control = componente.formulario.controls.idTransaccion;
    control.setValue('tx 1');
    expect(control.invalid).toBeTrue();
    control.setValue('A'.repeat(255));
    expect(control.invalid).toBeTrue();
    control.setValue('AB-12_3.4:5');
    expect(control.valid).toBeTrue();
  });

  it('al cambiar de PAYPAL a BANCO el correo deja de ser obligatorio', () => {
    llenar('PAYPAL');
    expect(componente.formulario.controls.correoTransaccion.invalid).toBeTrue();
    componente.alCambiarMetodoPago('BANCO');
    expect(componente.formulario.controls.correoTransaccion.valid).toBeTrue();
  });

  it('muestra el texto del periodo recibido del padre', () => {
    fixture.componentRef.setInput('textoPeriodo', 'Tu plan corre desde la fecha de tu comprobante');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Tu plan corre desde la fecha de tu comprobante',
    );
  });
});
