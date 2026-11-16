import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ErrorApi } from 'src/app/configuracion/modelo/error-api';
import { DatosPagoService } from 'src/app/negocio/suscripcion/servicios/datos-pago.service';
import {
  DatosPagoAdministracion,
  MetodoPagoAdmin,
  RedUsdtAdmin,
} from '../modelos/DatosPagoAdmin.modelo';
import { AdministracionDatosPagoService } from '../servicios/administracion-datos-pago.service';
import { DatosPagoAdminStore } from './datos-pago-admin.store';

function crearRed(id: number, conQr: boolean): RedUsdtAdmin {
  return {
    red_idRed: id,
    red_clave: `TEST${id}`,
    red_nombre: `Red ${id}`,
    red_etiqueta: 'T20',
    red_direccion: 'TESTTESTTESTTEST',
    red_activo: 1,
    red_orden: id,
    tieneQr: conQr,
    qrTamano: conQr ? 10 : null,
    qrTipoMime: conQr ? 'image/png' : null,
    qrHash: conQr ? `hash${id}` : null,
  };
}

function crearMetodo(
  codigo: 'CRIPTOMONEDA' | 'PAYPAL' | 'BANCO',
  orden: number,
): MetodoPagoAdmin {
  return {
    mep_codigo: codigo,
    mep_activo: 0,
    mep_orden: orden,
  } as MetodoPagoAdmin;
}

const DATOS: DatosPagoAdministracion = {
  metodos: [
    crearMetodo('CRIPTOMONEDA', 1),
    crearMetodo('PAYPAL', 2),
    crearMetodo('BANCO', 3),
  ],
  redes: [crearRed(1, true), crearRed(2, false)],
};

describe('DatosPagoAdminStore', () => {
  let servicio: jasmine.SpyObj<AdministracionDatosPagoService>;
  let servicioQr: jasmine.SpyObj<DatosPagoService>;
  let store: InstanceType<typeof DatosPagoAdminStore>;
  let urlsCreadas: string[];
  let urlsRevocadas: string[];

  beforeEach(() => {
    servicio = jasmine.createSpyObj<AdministracionDatosPagoService>(
      'AdministracionDatosPagoService',
      [
        'obtenerAdministracion',
        'guardarRed',
        'cambiarEstadoRed',
        'eliminarRed',
        'guardarPaypal',
        'guardarBanco',
        'cambiarEstadoMetodo',
        'subirQr',
        'quitarQr',
      ],
    );
    servicioQr = jasmine.createSpyObj<DatosPagoService>('DatosPagoService', [
      'obtenerQr',
    ]);
    servicio.obtenerAdministracion.and.returnValue(of(DATOS));
    servicioQr.obtenerQr.and.callFake(() => of(new Blob(['x'])));
    urlsCreadas = [];
    urlsRevocadas = [];
    spyOn(URL, 'createObjectURL').and.callFake(() => {
      const url = `blob:prueba-${urlsCreadas.length}`;
      urlsCreadas.push(url);
      return url;
    });
    spyOn(URL, 'revokeObjectURL').and.callFake((url) => {
      urlsRevocadas.push(url);
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AdministracionDatosPagoService, useValue: servicio },
        { provide: DatosPagoService, useValue: servicioQr },
      ],
    });
    store = TestBed.inject(DatosPagoAdminStore);
  });

  it('cargar guarda métodos y redes, y pide el QR solo de las redes que lo tienen', () => {
    store.cargar();
    expect(store.listaRedes().length).toBe(2);
    expect(store.isLoading()).toBeFalse();
    expect(servicioQr.obtenerQr).toHaveBeenCalledOnceWith('TEST1');
    expect(store.listaRedes()[0].urlQr).toBe('blob:prueba-0');
    expect(store.listaRedes()[1].urlQr).toBeNull();
    expect(store.metodoPaypal()?.mep_codigo).toBe('PAYPAL');
  });

  it('una segunda carga con el mismo hash no vuelve a pedir la imagen', () => {
    store.cargar();
    store.cargar();
    expect(servicioQr.obtenerQr).toHaveBeenCalledTimes(1);
  });

  it('si el hash cambia, revoca la URL anterior y pide la nueva imagen', () => {
    store.cargar();
    const cambiada: DatosPagoAdministracion = {
      ...DATOS,
      redes: [{ ...crearRed(1, true), qrHash: 'otro' }, crearRed(2, false)],
    };
    servicio.obtenerAdministracion.and.returnValue(of(cambiada));
    store.cargar();
    expect(urlsRevocadas).toEqual(['blob:prueba-0']);
    expect(servicioQr.obtenerQr).toHaveBeenCalledTimes(2);
    expect(store.listaRedes()[0].urlQr).toBe('blob:prueba-1');
  });

  it('limpiar revoca todas las URLs de objeto y vacía el estado', () => {
    store.cargar();
    store.limpiar();
    expect(urlsRevocadas).toEqual(['blob:prueba-0']);
    expect(store.listaRedes()).toEqual([]);
  });

  it('un fallo de carga deja el mensaje y no marca acceso denegado', () => {
    servicio.obtenerAdministracion.and.returnValue(
      throwError(() => new ErrorApi('Error del servidor', 500)),
    );
    store.cargar();
    expect(store.errorMessage()).toBe('Error del servidor');
    expect(store.accesoDenegado()).toBeFalse();
    expect(store.isLoading()).toBeFalse();
  });

  it('un 403 marca acceso denegado para que la página vuelva al inicio', () => {
    servicio.obtenerAdministracion.and.returnValue(
      throwError(() => new ErrorApi('Acceso denegado', 403)),
    );
    store.cargar();
    expect(store.accesoDenegado()).toBeTrue();
  });

  it('guardar una red avisa el éxito, recarga y libera guardando', () => {
    servicio.guardarRed.and.returnValue(of({ success: 'ok', red_idRed: 5 }));
    store.cargar();
    servicio.obtenerAdministracion.calls.reset();
    store.guardarRed({
      red_clave: 'TEST3',
      red_nombre: 'Red 3',
      red_etiqueta: 'T20',
      red_direccion: 'TESTTESTTESTTEST',
      red_activo: 1,
      red_orden: 0,
    });
    expect(store.resultado()).toBe('Red guardada');
    expect(store.guardando()).toBeFalse();
    expect(servicio.obtenerAdministracion).toHaveBeenCalledTimes(1);
  });

  it('un error al guardar conserva el mensaje, no recarga y no avisa éxito', () => {
    servicio.eliminarRed.and.returnValue(
      throwError(() => new ErrorApi('Es la última red activa', 400)),
    );
    store.cargar();
    servicio.obtenerAdministracion.calls.reset();
    store.eliminarRed(1);
    expect(store.errorMessage()).toBe('Es la última red activa');
    expect(store.resultado()).toBeNull();
    expect(store.guardando()).toBeFalse();
    expect(servicio.obtenerAdministracion).not.toHaveBeenCalled();
  });

  it('cambiar el estado de un método conserva su orden guardado', () => {
    servicio.cambiarEstadoMetodo.and.returnValue(of({ success: 'ok' }));
    store.cargar();
    store.cambiarEstadoMetodo({ codigo: 'PAYPAL', activo: true });
    expect(servicio.cambiarEstadoMetodo).toHaveBeenCalledOnceWith({
      codigo: 'PAYPAL',
      activo: true,
      orden: 2,
    });
  });

  it('el archivo del QR se valida por tipo y tamaño antes de enviarlo', () => {
    expect(
      store.validarArchivoQr({ type: 'image/gif', size: 10 }),
    ).not.toBeNull();
    expect(
      store.validarArchivoQr({ type: 'image/png', size: 262145 }),
    ).not.toBeNull();
    expect(store.validarArchivoQr({ type: 'image/png', size: 100 })).toBeNull();
  });

  it('confirmar la subida envía la imagen de la vista previa y limpia la selección', () => {
    servicio.subirQr.and.returnValue(of({ success: 'ok', qrHash: 'h' }));
    store.cargar();
    store.confirmarSubidaQr();
    expect(servicio.subirQr).not.toHaveBeenCalled();

    store.seleccionarRedQr(2);
    store.establecerVistaPreviaQr('data:image/png;base64,AAAA');
    expect(store.puedeConfirmarQr()).toBeTrue();
    store.confirmarSubidaQr();
    expect(servicio.subirQr).toHaveBeenCalledOnceWith({
      idRed: 2,
      imagen: 'data:image/png;base64,AAAA',
    });
    expect(store.redQrSeleccionada()).toBeNull();
    expect(store.vistaPreviaQr()).toBeNull();
    expect(store.resultado()).toBe('Código QR guardado');
  });

  it('seleccionar otra red descarta la vista previa pendiente', () => {
    store.cargar();
    store.seleccionarRedQr(1);
    store.establecerVistaPreviaQr('data:image/png;base64,AAAA');
    store.seleccionarRedQr(2);
    expect(store.vistaPreviaQr()).toBeNull();
  });

  it('sin redes ni datos de PayPal o banco avisa que no hay nada cargado', () => {
    servicio.obtenerAdministracion.and.returnValue(
      of({ metodos: DATOS.metodos, redes: [] }),
    );
    store.cargar();
    expect(store.estaSinDatos()).toBeTrue();
  });

  it('con redes cargadas ya no está sin datos', () => {
    store.cargar();
    expect(store.estaSinDatos()).toBeFalse();
  });
});
