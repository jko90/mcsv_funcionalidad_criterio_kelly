import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CuentasModelo } from 'src/app/configuracion/cuentas/modelos/Cuentas.modelo';
import { SeleccionarCuentasComponent } from './seleccionar-cuentas.component';

const CUENTA_A = { cue_idCuentas: 1, cue_nombre: 'Cuenta A' } as CuentasModelo;
const CUENTA_B = { cue_idCuentas: 2, cue_nombre: 'Cuenta B' } as CuentasModelo;

@Component({
  standalone: true,
  imports: [SeleccionarCuentasComponent],
  template: `<app-seleccionar-cuentas [cuentas]="cuentas()" (cuentaElegida)="elegidas.push($event)" />`,
})
class AnfitrionPruebaComponent {
  readonly cuentas = signal<CuentasModelo[]>([CUENTA_A, CUENTA_B]);
  readonly elegidas: CuentasModelo[] = [];
}

describe('SeleccionarCuentasComponent', () => {
  let fixture: ComponentFixture<AnfitrionPruebaComponent>;
  let anfitrion: AnfitrionPruebaComponent;

  function selectorIonic(): HTMLElement {
    return fixture.nativeElement.querySelector('ion-select') as HTMLElement;
  }

  function simularCambio(valor: CuentasModelo | undefined): void {
    selectorIonic().dispatchEvent(new CustomEvent('ionChange', { detail: { value: valor } }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AnfitrionPruebaComponent] });
    fixture = TestBed.createComponent(AnfitrionPruebaComponent);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra una opción por cada cuenta recibida', () => {
    const opciones = fixture.nativeElement.querySelectorAll('ion-select-option');

    expect(opciones.length).toBe(2);
    expect((opciones[0] as HTMLElement).textContent).toContain('Cuenta A');
    expect((opciones[1] as HTMLElement).textContent).toContain('Cuenta B');
  });

  it('al elegir una cuenta la emite', () => {
    simularCambio(CUENTA_B);

    expect(anfitrion.elegidas).toEqual([CUENTA_B]);
  });

  it('sin cuentas no hay opciones y no emite nada', () => {
    anfitrion.cuentas.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('ion-select-option').length).toBe(0);
    expect(anfitrion.elegidas.length).toBe(0);
  });

  it('un cambio sin cuenta no emite', () => {
    simularCambio(undefined);

    expect(anfitrion.elegidas.length).toBe(0);
  });
});
