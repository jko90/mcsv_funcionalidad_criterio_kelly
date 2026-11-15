import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CuerpoGuardarRed, RedUsdtAdmin } from '../../modelos/DatosPagoAdmin.modelo';
import { FormularioRedComponent } from './formulario-red.component';

const DIRECCION_TRON_FALSA = `T${'A'.repeat(33)}`;

const RED: RedUsdtAdmin = {
  red_idRed: 8,
  red_clave: 'TRON',
  red_nombre: 'TRON',
  red_etiqueta: 'TRC20',
  red_direccion: DIRECCION_TRON_FALSA,
  red_activo: 0,
  red_orden: 3,
  tieneQr: false,
  qrTamano: null,
  qrTipoMime: null,
  qrHash: null,
};

describe('FormularioRedComponent', () => {
  let fixture: ComponentFixture<FormularioRedComponent>;
  let componente: FormularioRedComponent;
  let enviados: CuerpoGuardarRed[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormularioRedComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(FormularioRedComponent);
    componente = fixture.componentInstance;
    enviados = [];
    componente.redEnviada.subscribe((cuerpo) => enviados.push(cuerpo));
    fixture.detectChanges();
  });

  function llenar(valores: Partial<Record<string, string | number | boolean>>): void {
    componente.formulario.patchValue(valores);
    fixture.detectChanges();
  }

  it('crear: no envía mientras falten datos y valida la dirección según la clave', () => {
    llenar({ red_clave: 'tron', red_nombre: 'TRON', red_etiqueta: 'TRC20', red_direccion: '0x1' });
    componente.alEnviar();
    expect(enviados).toEqual([]);
    expect(componente.controles.red_direccion.errors?.['formato']).toContain('TRON');
  });

  it('crear: normaliza la clave y emite el cuerpo sin id', () => {
    llenar({
      red_clave: ' tron ',
      red_nombre: ' TRON ',
      red_etiqueta: 'TRC20',
      red_direccion: ` ${DIRECCION_TRON_FALSA} `,
    });
    componente.alEnviar();
    expect(enviados).toEqual([
      {
        red_clave: 'TRON',
        red_nombre: 'TRON',
        red_etiqueta: 'TRC20',
        red_direccion: DIRECCION_TRON_FALSA,
        red_activo: 1,
        red_orden: 0,
      },
    ]);
  });

  it('cambiar la clave vuelve a validar la dirección', () => {
    llenar({ red_clave: 'ETH', red_direccion: DIRECCION_TRON_FALSA });
    expect(componente.controles.red_direccion.invalid).toBeTrue();
    llenar({ red_clave: 'TRON' });
    expect(componente.controles.red_direccion.valid).toBeTrue();
  });

  it('editar: carga la red, bloquea la clave y envía su id', () => {
    fixture.componentRef.setInput('red', RED);
    fixture.detectChanges();
    expect(componente.controles.red_clave.disabled).toBeTrue();
    expect(componente.controles.red_activo.value).toBeFalse();
    componente.alEnviar();
    expect(enviados[0].red_idRed).toBe(8);
    expect(enviados[0].red_clave).toBe('TRON');
    expect(enviados[0].red_activo).toBe(0);
    expect(enviados[0].red_orden).toBe(3);
  });
});
