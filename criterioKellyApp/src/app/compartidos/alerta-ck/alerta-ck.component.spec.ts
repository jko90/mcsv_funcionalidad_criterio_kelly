import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AlertaCkComponent, TipoAlertaCk } from './alerta-ck.component';

describe('AlertaCkComponent', () => {
  let fixture: ComponentFixture<AlertaCkComponent>;
  let confirmadas: unknown[];
  let canceladas: number;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlertaCkComponent],
      providers: [provideIonicAngular()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(AlertaCkComponent);
    confirmadas = [];
    canceladas = 0;
    fixture.componentInstance.confirmada.subscribe((valor) => confirmadas.push(valor));
    fixture.componentInstance.cancelada.subscribe(() => canceladas++);
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('ion-alert').forEach((alerta) => alerta.remove());
  });

  async function abrir(tipo: TipoAlertaCk, extra: Record<string, unknown> = {}): Promise<void> {
    fixture.componentRef.setInput('abierta', true);
    fixture.componentRef.setInput('titulo', 'Título corto');
    fixture.componentRef.setInput('mensaje', 'Mensaje de prueba');
    fixture.componentRef.setInput('tipo', tipo);
    for (const [nombre, valor] of Object.entries(extra)) {
      fixture.componentRef.setInput(nombre, valor);
    }
    fixture.detectChanges();
    for (let i = 0; i < 60 && !document.querySelector('ion-alert .alert-button'); i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  function boton(texto: string): HTMLElement {
    const botones = Array.from(document.querySelectorAll<HTMLElement>('ion-alert .alert-button'));
    const encontrado = botones.find((b) => b.textContent?.trim() === texto);
    if (!encontrado) {
      throw new Error(`No existe el botón ${texto}`);
    }
    return encontrado;
  }

  async function esperar(): Promise<void> {
    await new Promise((r) => setTimeout(r, 600));
  }

  it('AK-1: informativa muestra «Entendido» y emite confirmada', async () => {
    await abrir('informativa');
    expect(document.querySelectorAll('ion-alert .alert-button').length).toBe(1);
    boton('Entendido').click();
    await esperar();
    expect(confirmadas.length).toBe(1);
    expect(canceladas).toBe(0);
  });

  it('AK-2: confirmación «No» emite solo cancelada', async () => {
    await abrir('confirmacion');
    boton('No').click();
    await esperar();
    expect(canceladas).toBe(1);
    expect(confirmadas.length).toBe(0);
  });

  it('AK-3: confirmación «Sí» emite solo confirmada', async () => {
    await abrir('confirmacion');
    boton('Sí').click();
    await esperar();
    expect(confirmadas.length).toBe(1);
    expect(canceladas).toBe(0);
  });

  it('AK-4: destructiva no se cierra al tocar fuera y usa el texto «Sí, continuar»', async () => {
    await abrir('destructiva');
    expect(fixture.componentInstance.cierraAlTocarFuera()).toBeFalse();
    expect(document.querySelector<HTMLIonAlertElement>('ion-alert')?.backdropDismiss).toBeFalse();
    expect(boton('Sí, continuar')).toBeTruthy();
  });

  it('AK-5: con campos inválidos el handler devuelve false y no cierra ni emite', async () => {
    await abrir('confirmacion', { campos: [{ name: 'monto', type: 'number' }], valido: false });
    const botonConfirmar = fixture.componentInstance.botones().find((b) => b.role === 'confirm');
    expect(typeof botonConfirmar?.handler).toBe('function');
    expect((botonConfirmar?.handler as () => boolean)()).toBeFalse();
    boton('Sí').click();
    await esperar();
    expect(document.querySelector('ion-alert')).not.toBeNull();
    expect(confirmadas.length).toBe(0);
    expect(canceladas).toBe(0);
  });

  it('AK-6: con campos válidos emite confirmada con los valores', async () => {
    await abrir('confirmacion', { campos: [{ name: 'monto', type: 'text', value: '5' }] });
    boton('Sí').click();
    await esperar();
    expect(confirmadas).toEqual([{ monto: '5' }]);
    expect(canceladas).toBe(0);
  });

  it('AK-7: respeta cerrarAlTocarFuera explícito y el texto de confirmar', async () => {
    await abrir('confirmacion', { cerrarAlTocarFuera: false, textoConfirmar: 'Sí, activar' });
    expect(fixture.componentInstance.cierraAlTocarFuera()).toBeFalse();
    expect(boton('Sí, activar')).toBeTruthy();
  });
});
