import { CUSTOM_ELEMENTS_SCHEMA, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ServicioInactividad } from 'src/app/compartidos/seguridad/ServicioInactividad';
import { ManejoImagenesService } from 'src/app/compartidos/servicios/manejo-imagenes.service';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { RedUsdtConQr } from './modelos/DatosPagoAdmin.modelo';
import { DatosPagoAdminStore } from './store/datos-pago-admin.store';
import { DatosPagoAdminPage } from './datos-pago-admin.page';

const RED = { red_idRed: 4, red_nombre: 'Red de prueba' } as RedUsdtConQr;

describe('DatosPagoAdminPage', () => {
  let fixture: ComponentFixture<DatosPagoAdminPage>;
  let pagina: DatosPagoAdminPage;
  let resultado: WritableSignal<string | null>;
  let accesoDenegado: WritableSignal<boolean>;
  let store: Record<string, unknown>;
  let utilitarios: jasmine.SpyObj<UtilitariosService>;
  let router: Router;

  beforeEach(() => {
    resultado = signal<string | null>(null);
    accesoDenegado = signal(false);
    store = {
      listaRedes: signal([]),
      metodoCripto: signal(null),
      metodoPaypal: signal(null),
      metodoBanco: signal(null),
      redEnEdicion: signal(null),
      redQrSeleccionada: signal(null),
      vistaPreviaQr: signal(null),
      puedeConfirmarQr: signal(false),
      estaSinDatos: signal(true),
      isLoading: signal(false),
      guardando: signal(false),
      errorMessage: signal<string | null>(null),
      haCargado: signal(true),
      resultado,
      accesoDenegado,
      cargar: jasmine.createSpy('cargar'),
      limpiar: jasmine.createSpy('limpiar'),
      limpiarResultado: jasmine.createSpy('limpiarResultado').and.callFake(() => resultado.set(null)),
      guardarRed: jasmine.createSpy('guardarRed'),
      eliminarRed: jasmine.createSpy('eliminarRed'),
      guardarPaypal: jasmine.createSpy('guardarPaypal'),
      guardarBanco: jasmine.createSpy('guardarBanco'),
      cambiarEstadoRed: jasmine.createSpy('cambiarEstadoRed'),
      cambiarEstadoMetodo: jasmine.createSpy('cambiarEstadoMetodo'),
      seleccionarRedEnEdicion: jasmine.createSpy('seleccionarRedEnEdicion'),
      seleccionarRedQr: jasmine.createSpy('seleccionarRedQr'),
      validarArchivoQr: jasmine.createSpy('validarArchivoQr').and.returnValue('Tipo no permitido'),
      establecerVistaPreviaQr: jasmine.createSpy('establecerVistaPreviaQr'),
      descartarVistaPreviaQr: jasmine.createSpy('descartarVistaPreviaQr'),
      confirmarSubidaQr: jasmine.createSpy('confirmarSubidaQr'),
      quitarQr: jasmine.createSpy('quitarQr'),
    };
    utilitarios = jasmine.createSpyObj<UtilitariosService>('UtilitariosService', ['mostrarToast']);

    TestBed.configureTestingModule({
      imports: [DatosPagoAdminPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideRouter([]),
        { provide: DatosPagoAdminStore, useValue: store },
        { provide: UtilitariosService, useValue: utilitarios },
        { provide: ManejoImagenesService, useValue: jasmine.createSpyObj('ManejoImagenesService', ['seleccionarImagen']) },
        { provide: ServicioInactividad, useValue: { salir: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(DatosPagoAdminPage);
    pagina = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  function confirmarAlerta(): void {
    pagina.alConfirmarCambioPendiente();
  }

  it('carga al entrar y limpia al salir', () => {
    pagina.ionViewWillEnter();
    expect(store['cargar']).toHaveBeenCalled();
    pagina.ionViewWillLeave();
    expect(store['limpiar']).toHaveBeenCalled();
  });

  it('sin datos cargados avisa que los usuarios verán los métodos como no disponibles', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Este método aún no está disponible',
    );
  });

  it('guardar PayPal pide confirmar con el valor y solo guarda al aceptar', () => {
    const cuerpo = { mep_paypalCorreo: 'pagos@ejemplo.test', mep_paypalEnlace: '' };
    pagina.alGuardarPaypal(cuerpo);
    expect(pagina.confirmacionPendiente()?.mensaje).toBe(
      'Vas a cambiar los datos donde los usuarios envían su dinero. Revisa el valor: pagos@ejemplo.test',
    );
    expect(store['guardarPaypal']).not.toHaveBeenCalled();
    confirmarAlerta();
    expect(store['guardarPaypal']).toHaveBeenCalledOnceWith(cuerpo);
  });

  it('guardar la red muestra la dirección y la clave antes de guardar', () => {
    const cuerpo = {
      red_clave: 'TEST',
      red_nombre: 'Red de prueba',
      red_etiqueta: 'T20',
      red_direccion: 'TESTTESTTESTTEST',
      red_activo: 1,
      red_orden: 0,
    };
    pagina.alEnviarRed(cuerpo);
    expect(pagina.confirmacionPendiente()?.mensaje).toContain('TESTTESTTESTTEST (red TEST)');
    confirmarAlerta();
    expect(store['guardarRed']).toHaveBeenCalledOnceWith(cuerpo);
  });

  it('guardar el banco muestra el WhatsApp y solo el final de la cuenta', () => {
    pagina.alGuardarBanco({
      mep_bancoNumero: '59300000000',
      mep_bancoPlantilla: '',
      mep_bancoTitular: 'Titular Prueba',
      mep_bancoDocumento: '',
      mep_bancoEntidad: 'Banco Prueba',
      mep_bancoTipoCuenta: 'AHORROS',
      mep_bancoCuenta: '1234567890',
      mep_bancoPaisMoneda: '',
      mep_bancoObservaciones: '',
    });
    expect(pagina.confirmacionPendiente()?.mensaje).toContain('WhatsApp 59300000000; cuenta terminada en 7890');
    expect(pagina.confirmacionPendiente()?.mensaje).not.toContain('1234567890');
  });

  it('eliminar una red y quitar su QR piden confirmación', () => {
    pagina.alSolicitarEliminarRed(RED);
    expect(pagina.confirmacionPendiente()?.encabezado).toBe('Eliminar red');
    expect(store['eliminarRed']).not.toHaveBeenCalled();
    confirmarAlerta();
    expect(store['eliminarRed']).toHaveBeenCalledOnceWith(4);

    pagina.alSolicitarQuitarQr(RED);
    expect(pagina.confirmacionPendiente()?.encabezado).toBe('Quitar código QR');
    confirmarAlerta();
    expect(store['quitarQr']).toHaveBeenCalledOnceWith(4);
  });

  it('un archivo de QR rechazado muestra el mensaje y no genera vista previa', () => {
    const evento = { target: { files: [new File(['x'], 'qr.gif', { type: 'image/gif' })] } } as unknown as Event;
    pagina.alSeleccionarArchivoQr(evento);
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith('Tipo no permitido', 'danger');
    expect(store['establecerVistaPreviaQr']).not.toHaveBeenCalled();
  });

  it('un guardado correcto muestra el aviso y limpia el resultado', () => {
    resultado.set('Red guardada');
    fixture.detectChanges();
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith('Red guardada', 'success');
    expect(store['limpiarResultado']).toHaveBeenCalled();
  });

  it('con acceso denegado vuelve al inicio', () => {
    const navegar = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    accesoDenegado.set(true);
    fixture.detectChanges();
    expect(navegar).toHaveBeenCalledWith('/inicio');
  });

  it('cambiar el estado de un método lo pide con su código', () => {
    pagina.alCambiarEstadoPaypal(true);
    expect(store['cambiarEstadoMetodo']).toHaveBeenCalledWith({ codigo: 'PAYPAL', activo: true });
  });
});
