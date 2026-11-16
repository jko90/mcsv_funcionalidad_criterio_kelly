import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DivisasModelo } from '../../modelos/Divisas.modelo';
import { ModalBuscaDivisaComponent } from './modal-busca-divisa.component';

const LISTA: DivisasModelo[] = [
  { value: 'EURUSD', text: 'EUR/USD' } as DivisasModelo,
  { value: 'GBPUSD', text: 'GBP/USD' } as DivisasModelo,
  { value: 'USDJPY', text: 'USD/JPY' } as DivisasModelo,
];

describe('ModalBuscaDivisaComponent', () => {
  let fixture: ComponentFixture<ModalBuscaDivisaComponent>;
  let componente: ModalBuscaDivisaComponent;
  let elegidas: DivisasModelo[];
  let cierres: number;

  function abrir(seleccionada: DivisasModelo | null = null): void {
    fixture.componentRef.setInput('listaObjeto', LISTA);
    fixture.componentRef.setInput('objSeleccionado', seleccionada);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ModalBuscaDivisaComponent] });
    fixture = TestBed.createComponent(ModalBuscaDivisaComponent);
    componente = fixture.componentInstance;
    elegidas = [];
    cierres = 0;
    componente.divisaElegida.subscribe((d) => elegidas.push(d));
    componente.cerrar.subscribe(() => cierres++);
  });

  it('filtra sin distinguir mayusculas y sin filtro con texto en blanco', () => {
    abrir();
    componente.busqueda.set('eur');
    expect(componente.listaFiltrada().map((d) => d.value)).toEqual(['EURUSD']);
    componente.busqueda.set('EUR');
    expect(componente.listaFiltrada().length).toBe(1);
    componente.busqueda.set('   ');
    expect(componente.listaFiltrada().length).toBe(3);
  });

  it('confirmar sin seleccion no emite ni cierra', () => {
    abrir();
    componente.confirmarCambio();
    expect(elegidas).toEqual([]);
    expect(cierres).toBe(0);
  });

  it('confirmar con seleccion emite y cierra', () => {
    abrir();
    componente.divisaProvisional.set(LISTA[1]);
    componente.confirmarCambio();
    expect(elegidas).toEqual([LISTA[1]]);
    expect(cierres).toBe(1);
  });

  it('cancelar solo cierra', () => {
    abrir();
    componente.cancelarCambio();
    expect(elegidas).toEqual([]);
    expect(cierres).toBe(1);
  });

  it('resuelve la seleccion inicial contra la lista recibida por value', () => {
    abrir({ value: 'GBPUSD', text: 'otro texto' } as DivisasModelo);
    expect(componente.divisaProvisional()).toBe(LISTA[1]);
  });

  it('una seleccion inicial ausente de la lista queda sin seleccion', () => {
    abrir({ value: 'XXXYYY', text: 'x' } as DivisasModelo);
    expect(componente.divisaProvisional()).toBeNull();
  });
});
