import { CUSTOM_ELEMENTS_SCHEMA, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ServicioInactividad } from 'src/app/compartidos/seguridad/ServicioInactividad';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { MOTIVO_COMPROBANTE_ANTIGUO } from '../configuracion/textos-validacion';
import { PagoPendiente, ResultadoValidacion } from '../modelos/PagoPendiente.modelo';
import { ValidacionPagosStore } from '../store/validacion-pagos.store';
import { ValidarPagosPage } from './validar-pagos.page';

const PAGO = { pag_idPago: 3, usuario: 'ana' } as PagoPendiente;

describe('ValidarPagosPage', () => {
  let fixture: ComponentFixture<ValidarPagosPage>;
  let pagina: ValidarPagosPage;
  let resultado: WritableSignal<ResultadoValidacion | null>;
  let motivoSugerido: WritableSignal<string>;
  let store: Record<string, unknown>;
  let utilitarios: jasmine.SpyObj<UtilitariosService>;

  beforeEach(() => {
    resultado = signal<ResultadoValidacion | null>(null);
    motivoSugerido = signal('');
    store = {
      pagos: signal([]),
      hayMas: signal(false),
      isLoading: signal(false),
      seleccionado: signal<PagoPendiente | null>(null),
      comprobante: signal<string | null>(null),
      cargandoComprobante: signal(false),
      procesando: signal(false),
      resultado,
      motivoRechazoSugerido: motivoSugerido,
      mensajeConfirmarAprobacion: signal('¿Aprobar el pago de ana por 20 USD?'),
      cargarPendientes: jasmine.createSpy('cargarPendientes'),
      cargarMas: jasmine.createSpy('cargarMas'),
      seleccionar: jasmine.createSpy('seleccionar'),
      deseleccionar: jasmine.createSpy('deseleccionar'),
      aprobar: jasmine.createSpy('aprobar'),
      rechazar: jasmine.createSpy('rechazar'),
      limpiarResultado: jasmine.createSpy('limpiarResultado').and.callFake(() => resultado.set(null)),
      limpiar: jasmine.createSpy('limpiar'),
      esMotivoValido: (motivo: string) => motivo.trim().length >= 5,
    };
    utilitarios = jasmine.createSpyObj<UtilitariosService>('UtilitariosService', ['mostrarToast']);

    TestBed.configureTestingModule({
      imports: [ValidarPagosPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideRouter([]),
        { provide: ValidacionPagosStore, useValue: store },
        { provide: UtilitariosService, useValue: utilitarios },
        { provide: ServicioInactividad, useValue: { salir: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(ValidarPagosPage);
    pagina = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('al entrar carga los pagos pendientes', () => {
    pagina.ionViewWillEnter();
    expect(store['cargarPendientes']).toHaveBeenCalled();
  });

  it('aprobar abre la confirmación del store y solo aprueba al confirmar', () => {
    pagina.alSolicitarAprobar(PAGO);
    expect(pagina.pagoPorAprobar()).toBe(PAGO);
    expect(pagina.mensajeAprobarPago()).toBe('¿Aprobar el pago de ana por 20 USD?');
    expect(store['aprobar']).not.toHaveBeenCalled();
    pagina.alConfirmarAprobar();
    expect(store['aprobar']).toHaveBeenCalledOnceWith(3);
    expect(pagina.pagoPorAprobar()).toBeNull();
  });

  it('descartar la confirmación de aprobar no llama al store', () => {
    pagina.alSolicitarAprobar(PAGO);
    pagina.alDescartarAprobar();
    expect(store['aprobar']).not.toHaveBeenCalled();
    expect(pagina.pagoPorAprobar()).toBeNull();
  });

  it('rechazar abre la alerta de rechazo y no llama al store aún', () => {
    pagina.alSolicitarRechazar(PAGO);
    expect(pagina.pagoPorRechazar()).toBe(PAGO);
    expect(store['rechazar']).not.toHaveBeenCalled();
  });

  it('un motivo corto no es válido: avisa con toast y mantiene la alerta', () => {
    expect(pagina.validarMotivoRechazo({ motivo: 'no' })).toBeFalse();
    expect(utilitarios.mostrarToast).toHaveBeenCalled();
    expect(store['rechazar']).not.toHaveBeenCalled();
  });

  it('un motivo válido se acepta y al confirmar llama al store', () => {
    pagina.alSolicitarRechazar(PAGO);
    expect(pagina.validarMotivoRechazo({ motivo: 'Comprobante ilegible' })).toBeTrue();
    pagina.alConfirmarRechazo({ motivo: 'Comprobante ilegible' });
    expect(store['rechazar']).toHaveBeenCalledWith({ idPago: 3, motivo: 'Comprobante ilegible' });
    expect(pagina.pagoPorRechazar()).toBeNull();
  });

  it('cancelar el rechazo no llama al store', () => {
    pagina.alSolicitarRechazar(PAGO);
    pagina.alDescartarRechazo();
    expect(store['rechazar']).not.toHaveBeenCalled();
    expect(pagina.pagoPorRechazar()).toBeNull();
  });

  it('VP-08 el motivo parte precargado cuando el comprobante es antiguo', () => {
    motivoSugerido.set(MOTIVO_COMPROBANTE_ANTIGUO);
    expect(pagina.camposRechazo()[0].value).toBe(MOTIVO_COMPROBANTE_ANTIGUO);
  });

  it('muestra el toast según el resultado y lo limpia', () => {
    resultado.set('APROBADO');
    fixture.detectChanges();
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith('Pago aprobado', 'success');
    expect(store['limpiarResultado']).toHaveBeenCalled();
    resultado.set('RECHAZADO');
    fixture.detectChanges();
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith('Pago rechazado', 'success');
  });
});
