import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { LIMITES_SIN_RESTRICCION } from '../../suscripcion/configuracion/permisos-plan.config';
import { LimitesPlan } from '../../suscripcion/modelos/PlanVigente.modelo';
import { PlanVigenteStore } from '../../suscripcion/store/plan-vigente.store';
import { ExportarExcelService } from '../servicios/exportarExcel.service';
import { ReportesStore } from '../store/reportesStore';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridades/ServicioAutenticacion';
import { CuentaStore } from '../../configuracion/store/cuentaStore';
import { CuentasModelo } from '../../configuracion/modelos/Cuentas.modelo';
import { AnalisisPage } from './analisis.page';

const BASICO: LimitesPlan = {
  ...LIMITES_SIN_RESTRICCION,
  diasAnalisis: 5,
  maxOperacionesAnalisis: 5,
  diasTotalesAnalisis: 30,
  puedeDescargar: true,
};

const CUENTA_A = { cue_idCuentas: 7, cue_nombre: 'A' } as CuentasModelo;
const CUENTA_B = { cue_idCuentas: 8, cue_nombre: 'B' } as CuentasModelo;

describe('AnalisisPage · límites del plan', () => {
  const limites = signal<LimitesPlan>(BASICO);
  let cargarOperaciones: jasmine.Spy;
  let cargarObservaciones: jasmine.Spy;
  let exportador: jasmine.SpyObj<ExportarExcelService>;
  let utilitarios: jasmine.SpyObj<UtilitariosService>;
  let llamadas: string[];
  let idUsuario: number;
  const cuentasCargadas = signal<CuentasModelo[]>([]);

  function crearPagina(): AnalisisPage {
    llamadas = [];
    cargarOperaciones = jasmine.createSpy('cargarOperaciones');
    cargarObservaciones = jasmine.createSpy('cargarObservaciones');
    exportador = jasmine.createSpyObj('ExportarExcelService', ['exportarOperacionesConObservaciones']);
    utilitarios = jasmine.createSpyObj('UtilitariosService', ['mostrarToast', 'esperarCargaDeStore']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlanVigenteStore, useValue: { limites } },
        {
          provide: ReportesStore,
          useValue: {
            listaOperacionesPorCuentas: signal([{ id_bitacora: 1, cue_idCuentas: 9 }]),
            listaObservacionesPorBitacora: signal([]),
            listaOperacionesAnalisis: signal([]),
            listaObservacionesAnalisis: signal([]),
            cargarOperacionesParaAnalisis: cargarOperaciones,
            cargarObservacionesParaAnalisis: cargarObservaciones,
            obtenerListaOperacionesPorCuentas: (id: number) => llamadas.push(`reportes.listaOperaciones(${id})`),
            obtenerDetallePorCuentas: (id: number) => llamadas.push(`reportes.detalle(${id})`),
            obtenerListaObservacionesPorBitacora: jasmine.createSpy('porBitacora'),
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
        { provide: ExportarExcelService, useValue: exportador },
        { provide: UtilitariosService, useValue: utilitarios },
      ],
    });
    const pagina = TestBed.runInInjectionContext(() => new AnalisisPage());
    TestBed.tick();
    return pagina;
  }

  beforeEach(() => {
    limites.set(BASICO);
    idUsuario = 1;
    cuentasCargadas.set([CUENTA_A, CUENTA_B]);
  });

  describe('secuencia de llamadas a los stores', () => {
    it('al crearse carga las cuentas una vez y luego el detalle de la primera, sin pasar por la selección', async () => {
      const pagina = crearPagina();

      pagina.ngOnInit();
      await Promise.resolve();
      await Promise.resolve();

      expect(llamadas).toEqual(['cuentas.cargar', 'reportes.detalle(7)']);
      expect(pagina.cuentaSeleccionada.cue_idCuentas).toBeUndefined();
    });

    it('ionViewWillEnter no vuelve a cargar cuentas', async () => {
      const pagina = crearPagina();
      pagina.ngOnInit();

      pagina.ionViewWillEnter();
      pagina.ionViewWillEnter();

      expect(llamadas.filter((llamada) => llamada === 'cuentas.cargar').length).toBe(1);
    });

    it('al elegir una cuenta ejecuta primero el manejador y después el detalle', async () => {
      const pagina = crearPagina();
      llamadas.length = 0;

      await pagina.alElegirCuenta(CUENTA_B);

      expect(pagina.cuentaSeleccionada).toBe(CUENTA_B);
      expect(llamadas).toEqual(['reportes.listaOperaciones(8)', 'reportes.detalle(8)']);
    });

    it('sin usuario no carga nada', async () => {
      idUsuario = 0;
      const pagina = crearPagina();

      pagina.ngOnInit();
      await Promise.resolve();

      expect(llamadas).toEqual([]);
    });

    it('sin cuentas solo carga las cuentas', async () => {
      cuentasCargadas.set([]);
      const pagina = crearPagina();

      pagina.ngOnInit();
      await Promise.resolve();
      await Promise.resolve();

      expect(llamadas).toEqual(['cuentas.cargar']);
    });
  });

  it('al abrir consulta con el rango por defecto de diasAnalisis', () => {
    const pagina = crearPagina();

    const filtro = cargarOperaciones.calls.mostRecent().args[0];
    expect(filtro.fechaHasta).toBe(pagina.rangoFechas().hasta);
    expect(filtro.fechaDesde).toBe(pagina.rangoFechas().desde!);
    expect(pagina.avisoOperaciones()).toBe('Tu plan muestra hasta 5 operaciones por cuenta');
  });

  it('un rango mayor al permitido se ajusta, avisa y vuelve a consultar', () => {
    const pagina = crearPagina();
    const hasta = pagina.rangoFechas().hasta;

    pagina.alCambiarRango({ desde: '2000-01-01', hasta });

    expect(pagina.rangoFechas().desde).not.toBe('2000-01-01');
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith('Tu plan permite consultar hasta 5 días', 'warning');
    expect(cargarObservaciones).toHaveBeenCalledTimes(2);
  });

  it('análisis libre: sin fechaDesde y sin avisos', () => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, diasTotalesAnalisis: 365 });
    const pagina = crearPagina();

    expect(cargarOperaciones.calls.mostRecent().args[0].fechaDesde).toBeUndefined();
    expect(pagina.avisoOperaciones()).toBeNull();
  });

  it('sin puedeDescargar el Excel abre el modal y no exporta', () => {
    limites.set({ ...BASICO, puedeDescargar: false });
    const pagina = crearPagina();

    pagina.exportarAExcel();

    expect(pagina.mostrarModal()).toBeTrue();
    expect(exportador.exportarOperacionesConObservaciones).not.toHaveBeenCalled();
  });

  it('con puedeDescargar exporta las operaciones', () => {
    const pagina = crearPagina();

    pagina.exportarAExcel();

    expect(exportador.exportarOperacionesConObservaciones).toHaveBeenCalled();
    expect(pagina.mostrarModal()).toBeFalse();
  });

  it('alVerPlanes cierra la alerta y después navega a /planes', () => {
    const pagina = crearPagina();
    pagina.mostrarModal.set(true);
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.callFake(() => {
      expect(pagina.mostrarModal()).toBeFalse();
      return Promise.resolve(true);
    });

    pagina.alVerPlanes();

    expect(navegar).toHaveBeenCalledWith(['/planes']);
  });
});
