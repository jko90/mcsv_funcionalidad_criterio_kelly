import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { LIMITES_SIN_RESTRICCION } from '../../suscripcion/configuracion/permisos-plan.config';
import { LimitesPlan } from '../../suscripcion/modelos/PlanVigente.modelo';
import { PlanVigenteStore } from '../../suscripcion/store/plan-vigente.store';
import { ReportesStore } from '../store/reportesStore';
import { CuentaStore } from '../../../configuracion/cuentas/store/cuentaStore';
import { CuentasModelo } from '../../../configuracion/cuentas/modelos/Cuentas.modelo';
import { OperativasPage } from './operativas.page';

const BASICO: LimitesPlan = {
  ...LIMITES_SIN_RESTRICCION,
  diasReporte: 15,
  diasTotalesAnalisis: 30,
  puedeGraficar: false,
  puedeDescargar: true,
};

const CUENTA_A = { cue_idCuentas: 7, cue_nombre: 'A' } as CuentasModelo;
const CUENTA_B = { cue_idCuentas: 8, cue_nombre: 'B' } as CuentasModelo;

describe('OperativasPage · límites del plan', () => {
  const limites = signal<LimitesPlan>(BASICO);
  const cuentasCargadas = signal<CuentasModelo[]>([]);
  let llamadas: string[];
  let idUsuario: number;

  function crearPagina(): OperativasPage {
    llamadas = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlanVigenteStore, useValue: { limites } },
        {
          provide: ReportesStore,
          useValue: {
            listaDetallesOperaciones: signal([]),
            listaDOPorCuentas: signal([]),
            cargarDetalleOperaciones: () => llamadas.push('reportes.cargarDetalleOperaciones'),
            obtenerDetallePorCuentas: (id: number) => llamadas.push(`reportes.detalle(${id})`),
            loading: signal(false),
          },
        },
        {
          provide: CuentaStore,
          useValue: {
            listaCuentas: cuentasCargadas,
            isLoading: signal(false),
            cargarCuentas: () => llamadas.push('cuentas.cargar'),
          },
        },
        { provide: ServicioAutenticacion, useValue: { obtenerUsuarioActual: () => ({ id: idUsuario }) } },
        { provide: UtilitariosService, useValue: { esperarCargaDeStore: () => Promise.resolve() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new OperativasPage());
  }

  beforeEach(() => {
    limites.set(BASICO);
    idUsuario = 1;
    cuentasCargadas.set([CUENTA_A, CUENTA_B]);
  });

  describe('secuencia de llamadas a los stores', () => {
    it('al crearse carga el detalle general, las cuentas y el detalle de la primera, sin pasar por la selección', async () => {
      const pagina = crearPagina();

      await pagina.ngOnInit();

      expect(llamadas).toEqual([
        'reportes.cargarDetalleOperaciones',
        'cuentas.cargar',
        'reportes.detalle(7)',
      ]);
      expect(pagina.cuentaSeleccionada.cue_idCuentas).toBeUndefined();
    });

    it('al elegir una cuenta conserva la doble llamada de detalle (manejador y selector)', async () => {
      const pagina = crearPagina();

      await pagina.alElegirCuenta(CUENTA_B);

      expect(pagina.cuentaSeleccionada).toBe(CUENTA_B);
      expect(llamadas).toEqual(['reportes.detalle(8)', 'reportes.detalle(8)']);
    });

    it('sin usuario solo carga el detalle general', async () => {
      idUsuario = 0;
      const pagina = crearPagina();

      await pagina.ngOnInit();

      expect(llamadas).toEqual(['reportes.cargarDetalleOperaciones']);
    });

    it('sin cuentas no pide el detalle de la primera', async () => {
      cuentasCargadas.set([]);
      const pagina = crearPagina();

      await pagina.ngOnInit();

      expect(llamadas).toEqual(['reportes.cargarDetalleOperaciones', 'cuentas.cargar']);
    });
  });

  it('Básico no grafica: abre el modal y no cambia la gráfica', () => {
    const pagina = crearPagina();

    pagina.graficarOperacion();

    expect(pagina.mostrarModalPlan()).toBeTrue();
    expect(pagina.habilitarGrafica()).toBeFalse();
  });

  it('Básico sí exporta: no abre el modal', () => {
    const pagina = crearPagina();

    pagina.exportarAPDF();

    expect(pagina.mostrarModalPlan()).toBeFalse();
  });

  it('Libre no exporta: abre el modal', () => {
    limites.set({ ...BASICO, puedeDescargar: false });
    const pagina = crearPagina();

    pagina.exportarAPDF();

    expect(pagina.mostrarModalPlan()).toBeTrue();
  });

  it('con graficar permitido alterna la gráfica', () => {
    limites.set({ ...BASICO, puedeGraficar: true });
    const pagina = crearPagina();

    pagina.graficarOperacion();

    expect(pagina.habilitarGrafica()).toBeTrue();
    expect(pagina.mostrarModalPlan()).toBeFalse();
  });

  it('avisa los días recortados y Enterprise no ve aviso', () => {
    const pagina = crearPagina();
    expect(pagina.avisoDiasReporte()).toBe(
      'Tu plan muestra los últimos 15 días. Actualiza tu plan para ver más',
    );

    limites.set({ ...LIMITES_SIN_RESTRICCION, diasReporte: 365, diasTotalesAnalisis: 365 });
    expect(pagina.avisoDiasReporte()).toBeNull();
  });

  it('irAPlanes navega a /planes', () => {
    const pagina = crearPagina();
    const navegar = spyOn(TestBed.inject(Router), 'navigate');

    pagina.irAPlanes();

    expect(navegar).toHaveBeenCalledWith(['/planes']);
  });

  it('alVerPlanes cierra la alerta y después navega a /planes', () => {
    const pagina = crearPagina();
    pagina.mostrarModalPlan.set(true);
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.callFake(() => {
      expect(pagina.mostrarModalPlan()).toBeFalse();
      return Promise.resolve(true);
    });

    pagina.alVerPlanes();

    expect(navegar).toHaveBeenCalledWith(['/planes']);
  });
});
