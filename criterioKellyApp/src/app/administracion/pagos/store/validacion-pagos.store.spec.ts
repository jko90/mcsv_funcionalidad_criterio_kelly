import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ErrorApi } from 'src/app/configuracion/modelo/error-api';
import { MOTIVO_COMPROBANTE_ANTIGUO } from '../configuracion/textos-validacion';
import {
  ConfirmacionPago,
  PagoPendiente,
} from '../modelos/PagoPendiente.modelo';
import { AdministracionPagosService } from '../servicios/administracion-pagos.service';
import {
  TAMANO_PAGINA_PAGOS,
  ValidacionPagosStore,
} from './validacion-pagos.store';

function crearPago(
  id: number,
  cambios: Partial<PagoPendiente> = {},
): PagoPendiente {
  return {
    pag_idPago: id,
    pag_susIdSuscri: 100 + id,
    sus_usuarioId: 7,
    usuario: 'ana',
    pla_nombre: 'Pro',
    ins_nombre: 'Mensual',
    pag_monto: 20,
    pag_moneda: 'USD',
    pag_metodoPago: 'BANCO',
    pag_idTransac: 'TX',
    pag_fechaPago: '2026-11-12 10:30:00',
    pag_tipocripto: null,
    tieneComprobante: true,
    esPropio: false,
    esAnticipado: false,
    fechaInicioResultante: '2026-11-12',
    fechaCorteResultante: '2026-12-12',
    esAntiguo: false,
    ...cambios,
  };
}

function crearPagina(desdeId: number, cantidad: number): PagoPendiente[] {
  return Array.from({ length: cantidad }, (_, indice) =>
    crearPago(desdeId - indice),
  );
}

describe('ValidacionPagosStore', () => {
  let servicio: jasmine.SpyObj<AdministracionPagosService>;
  let store: InstanceType<typeof ValidacionPagosStore>;

  beforeEach(() => {
    servicio = jasmine.createSpyObj<AdministracionPagosService>(
      'AdministracionPagosService',
      ['obtenerPendientes', 'obtenerComprobante', 'confirmar', 'rechazar'],
    );
    TestBed.configureTestingModule({
      providers: [{ provide: AdministracionPagosService, useValue: servicio }],
    });
    store = TestBed.inject(ValidacionPagosStore);
  });

  it('VP-01 carga la primera página con el límite de 20', () => {
    servicio.obtenerPendientes.and.returnValue(
      of([crearPago(3), crearPago(2)]),
    );
    store.cargarPendientes();
    expect(servicio.obtenerPendientes).toHaveBeenCalledWith(
      TAMANO_PAGINA_PAGOS,
    );
    expect(store.pagos().length).toBe(2);
    expect(store.isLoading()).toBeFalse();
  });

  it('VP-02 cargarMas envía desde igual al menor pag_idPago y agrega la página', () => {
    servicio.obtenerPendientes.and.returnValue(of(crearPagina(100, 20)));
    store.cargarPendientes();
    servicio.obtenerPendientes.and.returnValue(of([crearPago(70)]));
    store.cargarMas();
    expect(servicio.obtenerPendientes).toHaveBeenCalledWith(
      TAMANO_PAGINA_PAGOS,
      81,
    );
    expect(store.pagos().length).toBe(21);
  });

  it('VP-03 hayMas es falso con menos de 20 y cargarMas no pide nada', () => {
    servicio.obtenerPendientes.and.returnValue(of(crearPagina(10, 5)));
    store.cargarPendientes();
    expect(store.hayMas()).toBeFalse();
    servicio.obtenerPendientes.calls.reset();
    store.cargarMas();
    expect(servicio.obtenerPendientes).not.toHaveBeenCalled();
  });

  it('VP-03 hayMas es verdadero con una página completa', () => {
    servicio.obtenerPendientes.and.returnValue(of(crearPagina(100, 20)));
    store.cargarPendientes();
    expect(store.hayMas()).toBeTrue();
  });

  it('VP-04 seleccionar pide el comprobante y lo guarda', () => {
    servicio.obtenerComprobante.and.returnValue(
      of({ pag_idPago: 3, comprobante: 'data:image/png;base64,AAAA' }),
    );
    store.seleccionar(crearPago(3));
    expect(servicio.obtenerComprobante).toHaveBeenCalledWith(3);
    expect(store.comprobante()).toBe('data:image/png;base64,AAAA');
    expect(store.cargandoComprobante()).toBeFalse();
  });

  it('VP-04 un 404 deja el comprobante en null sin error', () => {
    servicio.obtenerComprobante.and.returnValue(
      throwError(() => new ErrorApi('Comprobante no encontrado', 404)),
    );
    store.seleccionar(crearPago(3));
    expect(store.comprobante()).toBeNull();
    expect(store.errorMessage()).toBeNull();
  });

  it('seleccionar un pago sin comprobante no llama al servidor', () => {
    store.seleccionar(crearPago(3, { tieneComprobante: false }));
    expect(servicio.obtenerComprobante).not.toHaveBeenCalled();
    expect(store.seleccionado()?.pag_idPago).toBe(3);
  });

  it('VP-05 aprobar con 200 quita el pago y marca el resultado', () => {
    servicio.obtenerPendientes.and.returnValue(
      of([crearPago(3), crearPago(2)]),
    );
    store.cargarPendientes();
    servicio.confirmar.and.returnValue(of({} as ConfirmacionPago));
    store.aprobar(3);
    expect(servicio.confirmar).toHaveBeenCalledWith(3);
    expect(store.pagos().map((pago) => pago.pag_idPago)).toEqual([2]);
    expect(store.resultado()).toBe('APROBADO');
    expect(store.procesando()).toBeFalse();
  });

  it('VP-06 rechazar envía el motivo y quita el pago', () => {
    servicio.obtenerPendientes.and.returnValue(of([crearPago(3)]));
    store.cargarPendientes();
    servicio.rechazar.and.returnValue(
      of({ pag_idPago: 3, pag_situacion: 'F' }),
    );
    store.rechazar({ idPago: 3, motivo: '  Comprobante ilegible ' });
    expect(servicio.rechazar).toHaveBeenCalledWith(3, 'Comprobante ilegible');
    expect(store.pagos().length).toBe(0);
    expect(store.resultado()).toBe('RECHAZADO');
  });

  it('rechazar con un motivo corto no llama al servidor', () => {
    store.rechazar({ idPago: 3, motivo: 'no' });
    expect(servicio.rechazar).not.toHaveBeenCalled();
    expect(store.errorMessage()).toContain('entre 5 y 256');
    expect(store.procesando()).toBeFalse();
  });

  it('VP-07 un 409 al aprobar recarga la primera página', () => {
    servicio.obtenerPendientes.and.returnValue(of([crearPago(3)]));
    store.cargarPendientes();
    servicio.obtenerPendientes.calls.reset();
    servicio.obtenerPendientes.and.returnValue(of([]));
    servicio.confirmar.and.returnValue(
      throwError(
        () => new ErrorApi('El pago no está pendiente de revisión', 409),
      ),
    );
    store.aprobar(3);
    expect(servicio.obtenerPendientes).toHaveBeenCalledOnceWith(
      TAMANO_PAGINA_PAGOS,
    );
    expect(store.pagos().length).toBe(0);
    expect(store.resultado()).toBeNull();
  });

  it('un 403 al aprobar no recarga la lista', () => {
    servicio.obtenerPendientes.and.returnValue(of([crearPago(3)]));
    store.cargarPendientes();
    servicio.obtenerPendientes.calls.reset();
    servicio.confirmar.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    store.aprobar(3);
    expect(servicio.obtenerPendientes).not.toHaveBeenCalled();
    expect(store.pagos().length).toBe(1);
    expect(store.procesando()).toBeFalse();
  });

  it('VP-08 con esAntiguo el motivo sugerido es el del comprobante antiguo', () => {
    servicio.obtenerComprobante.and.returnValue(
      of({ pag_idPago: 3, comprobante: 'data:image/png;base64,A' }),
    );
    store.seleccionar(crearPago(3, { esAntiguo: true }));
    expect(store.motivoRechazoSugerido()).toBe(MOTIVO_COMPROBANTE_ANTIGUO);
  });

  it('el mensaje de confirmación incluye usuario, monto y fechas resultantes', () => {
    servicio.obtenerComprobante.and.returnValue(
      of({ pag_idPago: 3, comprobante: 'data:image/png;base64,A' }),
    );
    store.seleccionar(crearPago(3));
    expect(store.mensajeConfirmarAprobacion()).toBe(
      '¿Aprobar el pago de ana por 20 USD? El plan correrá desde el 12/11/2026 hasta el 12/12/2026',
    );
  });
});
