import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { DBCriterioKellyAppStore } from 'src/app/compartidos/store/dbkelly-app.store';
import { DBCriterioKellyWebStore } from 'src/app/compartidos/store/dbkelly-web.store';
import { CuentaResponse } from '../../../cuentas/modelos/Cuentas.modelo';
import { LIMITES_SIN_RESTRICCION } from '../../../../negocio/suscripcion/configuracion/permisos-plan.config';
import { LimitesPlan } from '../../../../negocio/suscripcion/modelos/PlanVigente.modelo';
import { PlanVigenteStore } from '../../../../negocio/suscripcion/store/plan-vigente.store';
import { CuentaStore } from '../../../cuentas/store/cuentaStore';
import { OperativaKellyPage } from './operativa-kelly.page';

describe('OperativaKellyPage · divisor según el plan', () => {
  const limites = signal<LimitesPlan>({ ...LIMITES_SIN_RESTRICCION, divisorEditable: false });
  let toast: jasmine.Spy;
  const cuenta = { cue_idCuentas: 3, cue_nombre: 'Principal', multipKelly: 7 } as CuentaResponse;

  function crearPagina(): OperativaKellyPage {
    toast = jasmine.createSpy('mostrarToast');
    const doble = {
      cargarDividendosKelly: jasmine.createSpy('cargarDividendosKelly'),
      isLoading: signal(false),
      listaDividendos: signal([]),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlanVigenteStore, useValue: { limites } },
        {
          provide: CuentaStore,
          useValue: {
            listaCuentas: signal([]),
            isLoading: signal(false),
            cargarCuentas: jasmine.createSpy('cargarCuentas'),
            actualizarListaCuentas: jasmine.createSpy('actualizarListaCuentas'),
          },
        },
        {
          provide: UtilitariosService,
          useValue: {
            mostrarToast: toast,
            esperarCargaDeStore: () => Promise.resolve(),
          },
        },
        { provide: ServicioAutenticacion, useValue: { obtenerUsuarioActual: () => ({ id: 1 }) } },
        { provide: DBCriterioKellyWebStore, useValue: doble },
        { provide: DBCriterioKellyAppStore, useValue: doble },
      ],
    });
    return TestBed.runInInjectionContext(() => new OperativaKellyPage());
  }

  it('Básico muestra 10 y no abre la edición, sino el aviso', async () => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, divisorEditable: false });
    const pagina = crearPagina();

    pagina.abrirModalCuenta(cuenta);

    expect(pagina.divisorFijo).toBe(10);
    expect(pagina.textoDivisorFijo).toBe('Tu plan usa el divisor 10. Actualiza tu plan para cambiarlo');
    expect(pagina.mostrarModalPlan()).toBeTrue();
    expect(pagina.alertaActiva()).toBeNull();
  });

  it('Premium edita el divisor', async () => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, divisorEditable: true });
    const pagina = crearPagina();

    pagina.abrirModalCuenta(cuenta);

    expect(pagina.mostrarModalPlan()).toBeFalse();
    expect(pagina.alertaActiva()?.tipo).toBe('editar');
    expect(pagina.camposAlertaActiva()?.[0].value).toBe(7);
  });

  it('un valor no numérico no cierra la edición y avisa', () => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, divisorEditable: true });
    const pagina = crearPagina();
    pagina.abrirModalCuenta(cuenta);

    expect(pagina.validarDivisor({ agr_valor: 'abc' })).toBeFalse();
    expect(toast).toHaveBeenCalledWith('Valor inválido', 'danger');
    expect(pagina.validarDivisor({ agr_valor: '12' })).toBeTrue();
  });

  it('confirmar la edición abre la confirmación y cancelar no cambia nada', fakeAsync(() => {
    limites.set({ ...LIMITES_SIN_RESTRICCION, divisorEditable: true });
    const pagina = crearPagina();
    pagina.abrirModalCuenta(cuenta);

    pagina.alConfirmarAlerta({ agr_valor: '12' });
    tick();
    expect(pagina.alertaActiva()?.tipo).toBe('confirmar');
    expect(pagina.tituloAlertaActiva()).toBe('Confirmar cambio');

    pagina.alDescartarAlerta();
    expect(pagina.alertaActiva()).toBeNull();
    expect(toast).not.toHaveBeenCalledWith('Divisor Kelly actualizado', 'success');
  }));

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
