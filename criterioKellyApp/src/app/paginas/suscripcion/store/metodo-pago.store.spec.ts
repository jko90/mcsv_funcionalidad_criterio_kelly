import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ErrorApi } from 'src/app/compartidos/modelos/error-api';
import { DatosPagoDisponibles } from '../modelos/DatosPago.modelo';
import { DatosPagoService } from '../servicios/datos-pago.service';
import { PlanVigente } from '../modelos/PlanVigente.modelo';
import { CLAVE_SOLICITUD_BANCO } from '../servicios/solicitud-banco.service';
import { MetodoPagoStore } from './metodo-pago.store';
import { PlanVigenteStore } from './plan-vigente.store';

const DATOS: DatosPagoDisponibles = {
  cripto: {
    nombre: 'Criptomoneda',
    redes: [
      { clave: 'TRON', nombre: 'TRON', etiqueta: 'TRC20', direccion: 'TESTTRON', tieneQr: true, qrHash: 'h1' },
      { clave: 'ETH', nombre: 'Ethereum', etiqueta: 'ERC20', direccion: 'TESTETH', tieneQr: false, qrHash: null },
    ],
  },
  paypal: { nombre: 'PayPal', correo: 'pagos@ejemplo.test', enlace: null },
  banco: { nombre: 'Banco', numero: '59399999', plantilla: null },
};

const SIN_DATOS: DatosPagoDisponibles = { cripto: null, paypal: null, banco: null };

function crearPlan(idPlanInterv: number, nombre = 'Pro'): PlanVigente {
  return {
    estado: 'SIN_PLAN',
    pin_idPlanInterv: null,
    plan: null,
    planPendiente: {
      sis_idSuscrip: 1,
      pin_idPlanInterv: idPlanInterv,
      pla_nombre: nombre,
      ins_nombre: 'Mensual',
      pin_precioFinal: 20,
    },
  } as unknown as PlanVigente;
}

describe('MetodoPagoStore', () => {
  let plan: WritableSignal<PlanVigente | null>;

  let servicio: jasmine.SpyObj<DatosPagoService>;

  function crearStore(
    datos: DatosPagoDisponibles | null = DATOS,
  ): InstanceType<typeof MetodoPagoStore> {
    servicio.obtenerDisponibles.and.returnValue(
      datos === null ? throwError(() => new ErrorApi('Sin conexión', 0)) : of(datos),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanVigenteStore, useValue: { plan, usuarioId: signal<number | null>(7) } },
        { provide: DatosPagoService, useValue: servicio },
      ],
    });
    const store = TestBed.inject(MetodoPagoStore);
    store.cargarDatos();
    return store;
  }

  beforeEach(() => {
    localStorage.removeItem(CLAVE_SOLICITUD_BANCO);
    plan = signal<PlanVigente | null>(crearPlan(5));
    servicio = jasmine.createSpyObj<DatosPagoService>('DatosPagoService', ['obtenerDisponibles', 'obtenerQr']);
    servicio.obtenerQr.and.callFake(() => of(new Blob(['x'])));
  });

  it('empieza en el paso METODO con las tres opciones disponibles', () => {
    const store = crearStore();
    expect(store.pasoActual()).toBe('METODO');
    expect(store.opcionesMetodo().map((opcion) => opcion.disponible)).toEqual([true, true, true]);
    expect(store.redesUsdt().map((red) => red.clave)).toEqual(['TRON', 'ETH']);
  });

  it('con datos vacíos los métodos no están disponibles y no se pueden elegir', () => {
    const store = crearStore(SIN_DATOS);
    expect(store.opcionesMetodo().every((opcion) => !opcion.disponible)).toBeTrue();
    store.elegirMetodo('PAYPAL');
    expect(store.pasoActual()).toBe('METODO');
  });

  it('elegir un método pasa a INSTRUCCIONES y cambiarMetodo vuelve', () => {
    const store = crearStore();
    store.elegirMetodo('CRIPTOMONEDA');
    expect(store.pasoActual()).toBe('INSTRUCCIONES');
    store.pasarAlComprobante();
    expect(store.pasoActual()).toBe('COMPROBANTE');
    store.cambiarMetodo();
    expect(store.pasoActual()).toBe('METODO');
  });

  it('en el mismo dispositivo recuerda que ya pidió los datos por WhatsApp', () => {
    const primero = crearStore();
    primero.elegirMetodo('BANCO');
    expect(primero.etapaBancoActiva()).toBe('PENDIENTE');
    primero.marcarWhatsappAbierto();
    primero.cambiarMetodo();

    primero.elegirMetodo('BANCO');
    expect(primero.etapaBancoActiva()).toBe('WHATSAPP_ABIERTO');

    primero.confirmarSolicitudEnviada();
    primero.cambiarMetodo();
    primero.elegirMetodo('BANCO');
    expect(primero.etapaBancoActiva()).toBe('SOLICITUD_CONFIRMADA');

    primero.olvidarSolicitudBanco();
    primero.cambiarMetodo();
    primero.elegirMetodo('BANCO');
    expect(primero.etapaBancoActiva()).toBe('PENDIENTE');
  });

  it('el resumen y el enlace de WhatsApp mencionan el plan elegido', () => {
    const store = crearStore();
    expect(store.descripcionPlanElegido()).toBe('Pro (Mensual)');
    expect(store.montoPlan()).toBe(20);
    const enlace = store.enlaceWhatsappBanco() ?? '';
    expect(enlace).toContain(['https://wa.me', '59399999?text='].join('/'));
    expect(decodeURIComponent(enlace)).toContain('Pro (Mensual)');
  });

  it('banco exige abrir WhatsApp y confirmar antes de ir al comprobante', () => {
    const store = crearStore();
    store.elegirMetodo('BANCO');
    store.pasarAlComprobante();
    expect(store.pasoActual()).toBe('INSTRUCCIONES');

    store.confirmarSolicitudEnviada();
    expect(store.etapaBancoActiva()).toBe('PENDIENTE');

    store.marcarWhatsappAbierto();
    expect(store.etapaBancoActiva()).toBe('WHATSAPP_ABIERTO');
    store.confirmarSolicitudEnviada();
    expect(store.etapaBancoActiva()).toBe('SOLICITUD_CONFIRMADA');

    store.pasarAlComprobante();
    expect(store.pasoActual()).toBe('COMPROBANTE');
  });

  it('si cambia el plan elegido, el recorrido y "ya envié la solicitud" se reinician', () => {
    const store = crearStore();
    store.elegirMetodo('BANCO');
    store.marcarWhatsappAbierto();
    store.confirmarSolicitudEnviada();
    expect(store.etapaBancoActiva()).toBe('SOLICITUD_CONFIRMADA');

    plan.set(crearPlan(8, 'Premium'));

    expect(store.pasoActual()).toBe('METODO');
    expect(store.etapaBancoActiva()).toBe('PENDIENTE');
    expect(store.metodoActivo()).toBeNull();
  });

  it('reiniciar limpia todo', () => {
    const store = crearStore();
    store.elegirMetodo('PAYPAL');
    store.reiniciar();
    expect(store.pasoActual()).toBe('METODO');
  });

  it('mientras carga no hay métodos disponibles y al llegar los datos se habilitan', () => {
    const respuesta = new Subject<DatosPagoDisponibles>();
    servicio.obtenerDisponibles.and.returnValue(respuesta);
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanVigenteStore, useValue: { plan, usuarioId: signal<number | null>(7) } },
        { provide: DatosPagoService, useValue: servicio },
      ],
    });
    const store = TestBed.inject(MetodoPagoStore);
    store.cargarDatos();
    expect(store.isLoading()).toBeTrue();
    expect(store.opcionesMetodo().every((opcion) => !opcion.disponible)).toBeTrue();
    respuesta.next(DATOS);
    respuesta.complete();
    expect(store.isLoading()).toBeFalse();
    expect(store.opcionesMetodo().every((opcion) => opcion.disponible)).toBeTrue();
  });

  it('un fallo de carga deja los métodos no disponibles con el mensaje y permite reintentar', () => {
    const store = crearStore(null);
    expect(store.hayErrorDeCarga()).toBeTrue();
    expect(store.errorMessage()).toBe('Sin conexión');
    expect(store.opcionesMetodo().every((opcion) => !opcion.disponible)).toBeTrue();
    servicio.obtenerDisponibles.and.returnValue(of(DATOS));
    store.cargarDatos();
    expect(store.hayErrorDeCarga()).toBeFalse();
    expect(store.opcionesMetodo().every((opcion) => opcion.disponible)).toBeTrue();
  });

  it('la respuesta del servidor decide la disponibilidad de cada método', () => {
    const store = crearStore({ ...SIN_DATOS, paypal: { nombre: 'PayPal', correo: null, enlace: 'https://paypal.me/test' } });
    expect(store.opcionesMetodo().map((opcion) => opcion.disponible)).toEqual([false, true, false]);
    expect(store.enlacePaypal()).toBe('https://paypal.me/test');
    expect(store.correoPaypal()).toBe('');
  });

  it('reiniciar el recorrido no borra los datos de pago cargados', () => {
    const store = crearStore();
    store.elegirMetodo('PAYPAL');
    store.reiniciar();
    expect(store.opcionesMetodo().every((opcion) => opcion.disponible)).toBeTrue();
  });

  it('el mensaje de WhatsApp usa la plantilla del servidor cuando existe', () => {
    const store = crearStore({
      ...DATOS,
      banco: { nombre: 'Banco', numero: '59399999', plantilla: 'Quiero {plan} por {monto}' },
    });
    expect(decodeURIComponent(store.enlaceWhatsappBanco() ?? '')).toContain('Quiero Pro (Mensual) por 20');
  });

  it('pide el QR solo de las redes que lo tienen al elegir cripto y lo libera al salir', () => {
    const urls: string[] = [];
    const revocadas: string[] = [];
    spyOn(URL, 'createObjectURL').and.callFake(() => {
      urls.push('blob:prueba-' + urls.length);
      return urls[urls.length - 1];
    });
    spyOn(URL, 'revokeObjectURL').and.callFake((url) => {
      revocadas.push(url);
    });
    const store = crearStore();
    store.elegirMetodo('CRIPTOMONEDA');
    expect(servicio.obtenerQr).toHaveBeenCalledOnceWith('TRON');
    expect(store.urlsQr()).toEqual({ TRON: 'blob:prueba-0' });
    store.liberarQr();
    expect(revocadas).toEqual(['blob:prueba-0']);
    expect(store.urlsQr()).toEqual({});
  });

  it('un QR que no se puede pedir no interrumpe el recorrido', () => {
    servicio.obtenerQr.and.returnValue(throwError(() => new ErrorApi('No encontrado', 404)));
    const store = crearStore();
    store.elegirMetodo('CRIPTOMONEDA');
    expect(store.pasoActual()).toBe('INSTRUCCIONES');
    expect(store.urlsQr()).toEqual({});
  });
});
