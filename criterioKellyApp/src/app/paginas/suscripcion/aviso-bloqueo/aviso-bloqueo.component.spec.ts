import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanesModelo } from '../modelos/Planes.modelo';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AvisoBloqueoComponent } from './aviso-bloqueo.component';

const PLAN_PRO: PlanesModelo = {
  pin_idPlanInterv: 5,
  pin_precioFinal: 20,
  ins_nombre: 'Mensual',
  ins_numMeses: 1,
  ins_x100descuen: 0,
  pla_nombre: 'Pro',
  pla_descripcion: '',
  pla_precioBase: 20,
  pla_moneda: 'USD',
  pla_numCuentas: 3,
  pla_diasHistorial: 8,
  pla_diasTotales: 8,
  pla_bloqueoDias: 5,
  pla_puedeDescargar: false,
  pla_rangoLibre: false,
  pla_puedeGraficar: false,
  pla_divisorEditable: false,
  pla_maxOperacionesDiarias: 1,
};

describe('AvisoBloqueoComponent', () => {
  let fixture: ComponentFixture<AvisoBloqueoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AvisoBloqueoComponent],
      providers: [provideIonicAngular()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(AvisoBloqueoComponent);
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('ion-modal, ion-alert').forEach((m) => m.remove());
  });

  function texto(): string {
    return document.querySelector('ion-modal')?.textContent ?? '';
  }

  async function esperarContenido(): Promise<void> {
    fixture.detectChanges();
    for (let i = 0; i < 40 && !document.querySelector('ion-modal ion-content'); i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  it('AB-1: sin bloqueo no pinta nada', () => {
    fixture.detectChanges();
    expect(texto().trim()).toBe('');
  });

  it('AB-2: con plan pendiente pinta un alert con el texto y sin lista de planes ni modal', async () => {
    fixture.componentRef.setInput('bloqueo', { estado: 'MINIMO_PENDIENTE', rutaIntentada: '/cuentas' });
    fixture.componentRef.setInput('texto', 'Tu plan Pro está pendiente de pago');
    fixture.componentRef.setInput('planes', [PLAN_PRO]);
    fixture.detectChanges();

    const alerta = fixture.nativeElement.querySelector('app-alerta-ck ion-alert') as HTMLElement | null;
    expect(alerta).not.toBeNull();
    expect(fixture.nativeElement.querySelector('ion-modal')).toBeNull();
    expect(fixture.nativeElement.querySelector('.aviso-bloqueo__tarjeta')).toBeNull();
    expect((alerta as unknown as { message: string }).message).toBe('Tu plan Pro está pendiente de pago');
  });

  it('AB-2b: el botón «Subir comprobante» solo existe si puedeSubirComprobante', () => {
    fixture.componentRef.setInput('bloqueo', { estado: 'MINIMO_PENDIENTE', rutaIntentada: '/cuentas' });
    fixture.detectChanges();
    let botones = (fixture.nativeElement.querySelector('ion-alert') as unknown as { buttons: { text: string }[] }).buttons;
    expect(botones.map((b) => b.text)).toEqual(['Entendido']);

    fixture.componentRef.setInput('puedeSubirComprobante', true);
    fixture.detectChanges();
    botones = (fixture.nativeElement.querySelector('ion-alert') as unknown as { buttons: { text: string }[] }).buttons;
    expect(botones.map((b) => b.text)).toEqual(['Entendido', 'Subir comprobante']);
  });

  it('AB-3: sin plan pinta la lista (nombre, intervalo y precio) y emite el plan elegido', async () => {
    fixture.componentRef.setInput('bloqueo', {
      estado: 'SIN_PLAN',
      rutaIntentada: '/cuentas',
    });
    fixture.componentRef.setInput('texto', 'Debes activar un plan');
    fixture.componentRef.setInput('planes', [PLAN_PRO]);
    await esperarContenido();
    let elegido: number | null = null;
    fixture.componentInstance.elegirPlan.subscribe((id) => (elegido = id));

    (document.body.querySelector('.aviso-bloqueo__tarjeta') as HTMLElement).click();
    fixture.detectChanges();
    await esperarContenido();
    expect(texto()).toContain('¿Quieres elegir este plan?');
    expect(elegido as number | null).toBeNull();
    (document.body.querySelector('.aviso-bloqueo__resumen ion-button') as HTMLElement).click();

    expect(texto()).toContain('Pro');
    expect(texto()).toContain('Mensual');
    expect(texto()).toContain('20 USD');
    expect(elegido as number | null).toBe(5);
  });

  it('AB-3b: agrupa las opciones por nombre de plan', async () => {
    fixture.componentRef.setInput('bloqueo', { estado: 'SIN_PLAN', rutaIntentada: '/cuentas' });
    fixture.componentRef.setInput('planes', [
      PLAN_PRO,
      { ...PLAN_PRO, pin_idPlanInterv: 6, ins_nombre: 'Anual' },
      { ...PLAN_PRO, pin_idPlanInterv: 7, pla_nombre: 'Max' },
    ]);
    fixture.detectChanges();

    const grupos = fixture.componentInstance.planesAgrupados();
    expect(grupos.map((g) => g.nombre)).toEqual(['Pro', 'Max']);
    expect(grupos[0].opciones.length).toBe(2);
  });

  it('AB-4: «Entendido» emite cerrar y «Subir comprobante» emite comprobanteSolicitado y cerrar', () => {
    fixture.componentRef.setInput('bloqueo', { estado: 'MINIMO_PENDIENTE', rutaIntentada: '/cuentas' });
    fixture.detectChanges();
    let cerrado = 0;
    let comprobante = 0;
    fixture.componentInstance.cerrar.subscribe(() => cerrado++);
    fixture.componentInstance.comprobanteSolicitado.subscribe(() => comprobante++);

    fixture.componentInstance.cerrarAviso();
    expect(cerrado).toBe(1);
    expect(comprobante).toBe(0);

    fixture.componentInstance.alConfirmarPendiente();
    expect(comprobante).toBe(1);
    expect(cerrado).toBe(2);
  });
});
