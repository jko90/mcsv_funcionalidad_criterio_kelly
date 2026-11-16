import { CUSTOM_ELEMENTS_SCHEMA, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManejoImagenesService } from 'src/app/compartidos/servicios/manejo-imagenes.service';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { ServicioInactividad } from 'src/app/compartidos/seguridad/ServicioInactividad';
import { SesionStore } from 'src/app/compartidos/store/sesion.store';
import { UltimoPago } from '../../modelos/EstadoPago.modelo';
import { PlanVigente } from '../../modelos/PlanVigente.modelo';
import { ComprobanteStore } from '../../store/comprobante.store';
import { MetodoPagoStore } from '../../store/metodo-pago.store';
import { AccionesExternasService } from 'src/app/negocio/suscripcion/servicios/acciones-externas.service';
import { PlanVigenteStore } from '../../store/plan-vigente.store';
import { ComprobantePage } from './comprobante.page';
import { MENSAJE_IMAGEN_GRANDE } from './validacion-imagen';

const BYTES_SOBRE_EL_LIMITE = (Math.floor(524_288 / 3) + 1) * 3;
const IMAGEN_GRANDE = `data:image/png;base64,${'A'.repeat((BYTES_SOBRE_EL_LIMITE / 3) * 4)}`;
const ENLACE_WHATSAPP_PRUEBA = ['https://wa.me', '1?text=x'].join('/');
const IMAGEN_VALIDA = 'data:image/png;base64,AAAA';

describe('ComprobantePage', () => {
  let fixture: ComponentFixture<ComprobantePage>;
  let pagina: ComprobantePage;
  let puedeEnviar: WritableSignal<boolean>;
  let ultimoPago: WritableSignal<UltimoPago | null>;
  let store: Record<string, unknown>;
  let imagenes: jasmine.SpyObj<ManejoImagenesService>;
  let utilitarios: jasmine.SpyObj<UtilitariosService>;
  let cargarPlan: jasmine.Spy;
  let metodoPago: Record<string, unknown>;
  let externas: jasmine.SpyObj<AccionesExternasService>;

  beforeEach(() => {
    puedeEnviar = signal(true);
    ultimoPago = signal<UltimoPago | null>(null);
    store = {
      ultimoPago,
      plan: signal<PlanVigente | null>(null),
      puedeEnviar,
      enviando: signal(false),
      envioExitoso: signal(false),
      textoPeriodo: signal<string | null>(null),
      tituloFormulario: signal('Subir comprobante'),
      cargarUltimoPago: jasmine.createSpy('cargarUltimoPago'),
      enviarComprobante: jasmine.createSpy('enviarComprobante'),
      limpiar: jasmine.createSpy('limpiar'),
    };
    imagenes = jasmine.createSpyObj<ManejoImagenesService>('ManejoImagenesService', [
      'seleccionarImagen',
    ]);
    utilitarios = jasmine.createSpyObj<UtilitariosService>('UtilitariosService', ['mostrarToast']);
    cargarPlan = jasmine.createSpy('cargar');
    metodoPago = {
      pasoActual: signal('COMPROBANTE'),
      opcionesMetodo: signal([]),
      metodoActivo: signal('BANCO'),
      metodoActivoDisponible: signal(true),
      descripcionPlanElegido: signal<string | null>(null),
      montoPlan: signal<number | null>(null),
      redesUsdt: signal([]),
      urlsQr: signal({}),
      isLoading: signal(false),
      hayErrorDeCarga: signal(false),
      cargarDatos: jasmine.createSpy('cargarDatos'),
      liberarQr: jasmine.createSpy('liberarQr'),
      correoPaypal: signal(''),
      enlacePaypal: signal(''),
      etapaBancoActiva: signal('PENDIENTE'),
      enlaceWhatsappBanco: signal<string | null>(ENLACE_WHATSAPP_PRUEBA),
      elegirMetodo: jasmine.createSpy('elegirMetodo'),
      cambiarMetodo: jasmine.createSpy('cambiarMetodo'),
      marcarWhatsappAbierto: jasmine.createSpy('marcarWhatsappAbierto'),
      confirmarSolicitudEnviada: jasmine.createSpy('confirmarSolicitudEnviada'),
      pasarAlComprobante: jasmine.createSpy('pasarAlComprobante'),
      reiniciar: jasmine.createSpy('reiniciar'),
    };
    externas = jasmine.createSpyObj<AccionesExternasService>('AccionesExternasService', ['copiarTexto', 'abrirEnlaceExterno']);

    TestBed.configureTestingModule({
      imports: [ComprobantePage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideRouter([]),
        { provide: ComprobanteStore, useValue: store },
        { provide: MetodoPagoStore, useValue: metodoPago },
        { provide: AccionesExternasService, useValue: externas },
        { provide: PlanVigenteStore, useValue: { cargar: cargarPlan } },
        { provide: SesionStore, useValue: { usuario: signal({ id: 7 }) } },
        { provide: ManejoImagenesService, useValue: imagenes },
        { provide: UtilitariosService, useValue: utilitarios },
        { provide: ServicioInactividad, useValue: { salir: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(ComprobantePage);
    pagina = fixture.componentInstance;
    fixture.detectChanges();
  });

  function elegirImagen(dataUrl: string): void {
    imagenes.seleccionarImagen.and.callFake((_evento, alExito) =>
      alExito({} as File, dataUrl),
    );
    pagina.alSeleccionarImagen({} as Event);
  }

  it('al entrar carga el plan vigente y el último pago', () => {
    pagina.ionViewWillEnter();
    expect(cargarPlan).toHaveBeenCalledOnceWith({ usuarioId: 7 });
    expect(store['cargarUltimoPago']).toHaveBeenCalled();
  });

  it('al entrar pide los datos de pago al servidor y al salir libera los QR', () => {
    pagina.ionViewWillEnter();
    expect(metodoPago['cargarDatos']).toHaveBeenCalled();
    pagina.ionViewWillLeave();
    expect(metodoPago['liberarQr']).toHaveBeenCalled();
  });

  it('reintentar la carga vuelve a pedir los datos de pago', () => {
    pagina.alReintentarCargaDatosPago();
    expect(metodoPago['cargarDatos']).toHaveBeenCalled();
  });

  it('una imagen de más de 512 KB se rechaza con aviso y no queda para enviar', () => {
    elegirImagen(IMAGEN_GRANDE);
    expect(pagina.vistaPrevia()).toBeNull();
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith(MENSAJE_IMAGEN_GRANDE, 'danger');
    expect(store['enviarComprobante']).not.toHaveBeenCalled();
  });

  it('una imagen válida queda como vista previa', () => {
    elegirImagen(IMAGEN_VALIDA);
    expect(pagina.vistaPrevia()).toBe(IMAGEN_VALIDA);
  });

  it('un error del servicio de imágenes se avisa y limpia la vista previa', () => {
    imagenes.seleccionarImagen.and.callFake((_evento, _alExito, alError) =>
      alError?.('No se pudo procesar la imagen'),
    );
    pagina.alSeleccionarImagen({} as Event);
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith('No se pudo procesar la imagen', 'danger');
  });

  it('al enviar delega la solicitud en el store', () => {
    const solicitud = { metodoPago: 'BANCO', idTransaccion: 'TX', comprobante: IMAGEN_VALIDA } as const;
    pagina.alEnviarComprobante(solicitud);
    expect(store['enviarComprobante']).toHaveBeenCalledOnceWith(solicitud);
  });

  it('con un pago en revisión (puedeEnviar=false) no muestra el formulario', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('app-formulario-comprobante')).not.toBeNull();

    puedeEnviar.set(false);
    ultimoPago.set({ pag_situacion: 'R', pag_fechaPago: '2026-11-12' } as UltimoPago);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-formulario-comprobante')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'En revisión: el administrador validará tu comprobante',
    );
  });

  it('en el paso METODO muestra el selector y no el formulario', () => {
    (metodoPago['pasoActual'] as WritableSignal<string>).set('METODO');
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('app-selector-metodo-pago')).not.toBeNull();
    expect(raiz.querySelector('app-formulario-comprobante')).toBeNull();
  });

  it('pedir datos por WhatsApp abre el enlace y marca la etapa', () => {
    pagina.alPedirDatosPorWhatsapp();
    expect(externas.abrirEnlaceExterno).toHaveBeenCalledOnceWith(ENLACE_WHATSAPP_PRUEBA);
    expect(metodoPago['marcarWhatsappAbierto']).toHaveBeenCalled();
  });

  it('copiar avisa con un toast según el resultado', async () => {
    externas.copiarTexto.and.resolveTo(true);
    await pagina.alCopiar('abc');
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith(jasmine.any(String), 'success');
    externas.copiarTexto.and.resolveTo(false);
    await pagina.alCopiar('abc');
    expect(utilitarios.mostrarToast).toHaveBeenCalledWith(jasmine.any(String), 'warning');
  });

  it('al salir descarta la imagen y limpia el store', () => {
    elegirImagen(IMAGEN_VALIDA);
    pagina.ionViewWillLeave();
    expect(pagina.vistaPrevia()).toBeNull();
    expect(store['limpiar']).toHaveBeenCalled();
  });
});
