import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CuerpoGuardarBanco, MetodoPagoAdmin } from '../../modelos/DatosPagoAdmin.modelo';
import { FormularioBancoComponent } from './formulario-banco.component';

const METODO = {
  mep_codigo: 'BANCO',
  mep_activo: 0,
  mep_bancoNumero: '59300000000',
  mep_bancoPlantilla: null,
  mep_bancoTitular: 'Titular Prueba',
  mep_bancoEntidad: 'Banco Prueba',
  mep_bancoTipoCuenta: 'AHORROS',
  mep_bancoCuenta: '0000-1111',
} as MetodoPagoAdmin;

describe('FormularioBancoComponent', () => {
  let fixture: ComponentFixture<FormularioBancoComponent>;
  let componente: FormularioBancoComponent;
  let enviados: CuerpoGuardarBanco[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormularioBancoComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(FormularioBancoComponent);
    componente = fixture.componentInstance;
    enviados = [];
    componente.bancoEnviado.subscribe((cuerpo) => enviados.push(cuerpo));
    fixture.componentRef.setInput('metodo', METODO);
    fixture.detectChanges();
  });

  it('carga los datos guardados y los opcionales vacíos quedan como texto vacío', () => {
    expect(componente.controles.mep_bancoNumero.value).toBe('59300000000');
    expect(componente.controles.mep_bancoDocumento.value).toBe('');
    expect(componente.controles.mep_bancoTipoCuenta.value).toBe('AHORROS');
  });

  it('el número de WhatsApp es obligatorio y de 8 a 15 dígitos', () => {
    componente.formulario.patchValue({ mep_bancoNumero: '' });
    expect(componente.controles.mep_bancoNumero.invalid).toBeTrue();
    componente.formulario.patchValue({ mep_bancoNumero: '123' });
    expect(componente.controles.mep_bancoNumero.errors?.['formato']).toBeDefined();
    componente.alEnviar();
    expect(enviados).toEqual([]);
  });

  it('la cuenta exige titular y banco', () => {
    componente.formulario.patchValue({ mep_bancoTitular: '', mep_bancoEntidad: '' });
    fixture.detectChanges();
    expect(componente.mensajeCuentaSinTitular()).toContain('titular y el banco');
    expect(componente.puedeEnviar()).toBeFalse();
    componente.alEnviar();
    expect(enviados).toEqual([]);
  });

  it('sin cuenta basta con el WhatsApp y se envían los demás campos vacíos', () => {
    componente.formulario.patchValue({
      mep_bancoNumero: '+593 000-0000',
      mep_bancoTitular: '',
      mep_bancoEntidad: '',
      mep_bancoTipoCuenta: '',
      mep_bancoCuenta: '',
    });
    componente.alEnviar();
    expect(enviados.length).toBe(1);
    expect(enviados[0].mep_bancoNumero).toBe('5930000000');
    expect(enviados[0].mep_bancoCuenta).toBe('');
    expect(enviados[0].mep_bancoTipoCuenta).toBe('');
  });

  it('valida los formatos de documento y tipo de cuenta', () => {
    componente.formulario.patchValue({ mep_bancoDocumento: '1', mep_bancoTipoCuenta: 'PLAZO' });
    expect(componente.controles.mep_bancoDocumento.errors?.['formato']).toBeDefined();
    expect(componente.controles.mep_bancoTipoCuenta.errors?.['formato']).toBeDefined();
  });
});
