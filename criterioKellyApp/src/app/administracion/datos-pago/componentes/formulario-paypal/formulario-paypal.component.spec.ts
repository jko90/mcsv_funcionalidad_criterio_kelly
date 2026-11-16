import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CuerpoGuardarPaypal, MetodoPagoAdmin } from '../../modelos/DatosPagoAdmin.modelo';
import { FormularioPaypalComponent } from './formulario-paypal.component';

const METODO = {
  mep_codigo: 'PAYPAL',
  mep_activo: 1,
  mep_paypalCorreo: 'pagos@ejemplo.test',
  mep_paypalEnlace: null,
} as MetodoPagoAdmin;

describe('FormularioPaypalComponent', () => {
  let fixture: ComponentFixture<FormularioPaypalComponent>;
  let componente: FormularioPaypalComponent;
  let enviados: CuerpoGuardarPaypal[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormularioPaypalComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(FormularioPaypalComponent);
    componente = fixture.componentInstance;
    enviados = [];
    componente.paypalEnviado.subscribe((cuerpo) => enviados.push(cuerpo));
    fixture.componentRef.setInput('metodo', METODO);
    fixture.detectChanges();
  });

  it('carga los valores guardados en el formulario', () => {
    expect(componente.controles.mep_paypalCorreo.value).toBe('pagos@ejemplo.test');
    expect(componente.controles.mep_paypalEnlace.value).toBe('');
    expect(componente.estaMetodoActivo()).toBeTrue();
  });

  it('rechaza un correo y un enlace con formato inválido', () => {
    componente.formulario.patchValue({
      mep_paypalCorreo: 'no-es-correo',
      mep_paypalEnlace: 'http://paypal.me/test',
    });
    componente.alEnviar();
    expect(enviados).toEqual([]);
    expect(componente.controles.mep_paypalCorreo.errors?.['formato']).toBeDefined();
    expect(componente.controles.mep_paypalEnlace.errors?.['formato']).toBeDefined();
  });

  it('emite los valores recortados', () => {
    componente.formulario.patchValue({
      mep_paypalCorreo: '  otro@ejemplo.test ',
      mep_paypalEnlace: 'https://paypal.me/test',
    });
    componente.alEnviar();
    expect(enviados).toEqual([
      { mep_paypalCorreo: 'otro@ejemplo.test', mep_paypalEnlace: 'https://paypal.me/test' },
    ]);
  });
});
