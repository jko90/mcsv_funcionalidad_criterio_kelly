import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DBCriterioKellyAppStore } from 'src/app/compartidos/store/dbkelly-app.store';
import { DBCriterioKellyWebStore } from 'src/app/compartidos/store/dbkelly-web.store';
import { LIMITES_SIN_RESTRICCION } from '../../suscripcion/configuracion/permisos-plan.config';
import { LimitesPlan } from '../../suscripcion/modelos/PlanVigente.modelo';
import { PlanVigenteStore } from '../../suscripcion/store/plan-vigente.store';
import { CuentaResponse } from '../modelos/Cuentas.modelo';
import { CuentaStore } from '../store/cuentaStore';
import { CuentasPage } from './cuentas.page';

describe('CuentasPage · tope de cuentas del plan', () => {
  const limites = signal<LimitesPlan>({ ...LIMITES_SIN_RESTRICCION, numCuentas: 1 });
  const listaCuentas = signal<unknown[]>([]);
  let toast: jasmine.Spy;
  let almacen: Record<string, jasmine.Spy>;

  function crearPagina(): CuentasPage {
    toast = jasmine.createSpy('mostrarToast');
    almacen = {
      crearCuenta: jasmine.createSpy('crearCuenta'),
      actualizarNombreCuenta: jasmine.createSpy('actualizarNombreCuenta'),
      eliminarCuenta: jasmine.createSpy('eliminarCuenta'),
      agregarCapital: jasmine.createSpy('agregarCapital'),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlanVigenteStore, useValue: { limites } },
        {
          provide: CuentaStore,
          useValue: {
            isLoading: signal(false),
            errorMessage: signal(null),
            listaCuentas,
            ultimaCuenta: signal(null),
            cuentaEliminada: signal(false),
            capitalActualizado: signal(false),
            cargarCuentas: jasmine.createSpy('cargarCuentas'),
            ...almacen,
          },
        },
        { provide: UtilitariosService, useValue: { mostrarToast: toast } },
        { provide: ServicioAutenticacion, useValue: { obtenerUsuarioActual: () => ({ id: 1 }) } },
        { provide: DBCriterioKellyWebStore, useValue: { eliminarDividendoKelly: jasmine.createSpy('eliminarWeb') } },
        { provide: DBCriterioKellyAppStore, useValue: { eliminarDividendoKelly: jasmine.createSpy('eliminarApp') } },
      ],
    });
    return TestBed.runInInjectionContext(() => new CuentasPage());
  }

  beforeEach(() => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, numCuentas: 1 });
    listaCuentas.set([]);
  });

  it('en el tope no abre la creación y muestra el modal con el mensaje', () => {
    listaCuentas.set([{ cue_idCuentas: 1 }]);
    const pagina = crearPagina();

    pagina.crearCuenta();

    expect(pagina.alertaActiva()).toBeNull();
    expect(pagina.mostrarModalPlan()).toBeTrue();
    expect(pagina.mensajeTopeCuentas()).toBe('Tu plan permite 1 cuenta. Actualiza tu plan para crear más');
  });

  it('con cupo disponible abre la creación de cuenta', () => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, numCuentas: 5 });
    listaCuentas.set([{}, {}, {}, {}]);
    const pagina = crearPagina();

    pagina.crearCuenta();

    expect(pagina.alertaActiva()?.tipo).toBe('crear');
    expect(pagina.mostrarModalPlan()).toBeFalse();
  });

  it('sin límite de cuentas siempre abre la creación', () => {
    limites.set(LIMITES_SIN_RESTRICCION);
    listaCuentas.set([{}, {}, {}]);
    const pagina = crearPagina();

    pagina.crearCuenta();

    expect(pagina.alertaActiva()?.tipo).toBe('crear');
  });

  describe('validaciones de cada diálogo', () => {
    const cuenta = { cue_idCuentas: 7, cue_nombre: 'Principal', valor_cuenta: 100 } as CuentaResponse;

    it('crear: sin nombre o con monto menor a 0.01 no es válido y avisa', () => {
      const pagina = crearPagina();
      pagina.crearCuenta();
      expect(pagina.validarAlertaActiva({ cue_nombre: '  ', monto: 5 })).toBeFalse();
      expect(pagina.validarAlertaActiva({ cue_nombre: 'A', monto: 0 })).toBeFalse();
      expect(pagina.validarAlertaActiva({ cue_nombre: 'A', monto: 'x' })).toBeFalse();
      expect(toast).toHaveBeenCalledWith('Datos inválidos', 'danger');
      expect(pagina.validarAlertaActiva({ cue_nombre: 'A', monto: 5 })).toBeTrue();
    });

    it('crear: al confirmar guarda la cuenta con nombre recortado', () => {
      const pagina = crearPagina();
      pagina.crearCuenta();
      pagina.alConfirmarAlerta({ cue_nombre: ' Nueva ', monto: 50 });
      expect(almacen['crearCuenta']).toHaveBeenCalledWith(
        jasmine.objectContaining({ cue_nombre: 'Nueva', valor_cuenta: 50 }),
      );
      expect(pagina.alertaActiva()).toBeNull();
    });

    it('editar: el nombre vacío no es válido', () => {
      const pagina = crearPagina();
      pagina.actualizarCuenta(cuenta);
      expect(pagina.validarAlertaActiva({ cue_nombre: ' ' })).toBeFalse();
      expect(toast).toHaveBeenCalledWith('El nombre no puede estar vacío', 'danger');
      pagina.alConfirmarAlerta({ cue_nombre: 'Otra' });
      expect(almacen['actualizarNombreCuenta']).toHaveBeenCalledWith({ cue_idCuenta: 7, cue_nombre: 'Otra' });
    });

    it('eliminar: cancelar no elimina y confirmar sí', () => {
      const pagina = crearPagina();
      pagina.eliminarCuenta(cuenta);
      expect(pagina.textosAlertaActiva().mensaje).toContain('Principal');
      pagina.alDescartarAlerta();
      expect(almacen['eliminarCuenta']).not.toHaveBeenCalled();
      pagina.eliminarCuenta(cuenta);
      pagina.alConfirmarAlerta();
      expect(almacen['eliminarCuenta']).toHaveBeenCalledWith({ cue_idCuenta: 7 });
    });

    it('capital: monto inválido y reducir por encima del saldo no cierran', () => {
      const pagina = crearPagina();
      pagina.abrirModalCapital(cuenta, 'reducir');
      expect(pagina.validarAlertaActiva({ monto: -1 })).toBeFalse();
      expect(toast).toHaveBeenCalledWith('Monto inválido', 'danger');
      expect(pagina.validarAlertaActiva({ monto: 150 })).toBeFalse();
      expect(toast).toHaveBeenCalledWith('El capital no puede ser negativo', 'danger');
      expect(pagina.validarAlertaActiva({ monto: 40 })).toBeTrue();
    });

    it('capital: aumentar suma y reducir resta registrando el tipo de movimiento', () => {
      const pagina = crearPagina();
      pagina.abrirModalCapital(cuenta, 'aumentar');
      pagina.alConfirmarAlerta({ monto: 10 });
      expect(almacen['agregarCapital']).toHaveBeenCalledWith(
        jasmine.objectContaining({ cap_capital: 110, cap_tipoMovimie: 'D' }),
      );
      pagina.abrirModalCapital(cuenta, 'reducir');
      pagina.alConfirmarAlerta({ monto: 30 });
      expect(almacen['agregarCapital']).toHaveBeenCalledWith(
        jasmine.objectContaining({ cap_capital: 70, cap_tipoMovimie: 'R' }),
      );
    });
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
