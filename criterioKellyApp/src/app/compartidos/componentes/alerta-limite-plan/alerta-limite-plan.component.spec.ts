import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { ALERTA_LIMITE_PLAN } from '../../textos-alertas';
import { AlertaLimitePlanComponent } from './alerta-limite-plan.component';

describe('AlertaLimitePlanComponent', () => {
  let fixture: ComponentFixture<AlertaLimitePlanComponent>;
  let verPlanesEmitidos: number;
  let cerradosEmitidos: number;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlertaLimitePlanComponent],
      providers: [provideIonicAngular()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(AlertaLimitePlanComponent);
    verPlanesEmitidos = 0;
    cerradosEmitidos = 0;
    fixture.componentInstance.verPlanes.subscribe(() => verPlanesEmitidos++);
    fixture.componentInstance.cerrado.subscribe(() => cerradosEmitidos++);
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('ion-alert').forEach((alerta) => alerta.remove());
  });

  async function abrir(mensaje: string | null): Promise<void> {
    fixture.componentRef.setInput('abierta', true);
    fixture.componentRef.setInput('mensaje', mensaje);
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

  it('abierta con mensaje muestra ese mensaje y el título por defecto', async () => {
    await abrir('Tu plan permite 1 cuenta');
    const alerta = document.querySelector('ion-alert');
    expect(alerta?.textContent).toContain('Tu plan permite 1 cuenta');
    expect(alerta?.textContent).toContain(ALERTA_LIMITE_PLAN.titulo);
  });

  it('sin mensaje (null) usa el texto de respaldo', async () => {
    await abrir(null);
    expect(fixture.componentInstance.mensajeAlerta()).toBe(ALERTA_LIMITE_PLAN.mensaje);
    expect(document.querySelector('ion-alert')?.textContent).toContain(ALERTA_LIMITE_PLAN.mensaje);
  });

  it('«Ver planes» emite solo verPlanes', async () => {
    await abrir(null);
    boton('Ver planes').click();
    await esperar();
    expect(verPlanesEmitidos).toBe(1);
    expect(cerradosEmitidos).toBe(0);
  });

  it('«Ahora no» emite solo cerrado', async () => {
    await abrir(null);
    boton('Ahora no').click();
    await esperar();
    expect(cerradosEmitidos).toBe(1);
    expect(verPlanesEmitidos).toBe(0);
  });
});
