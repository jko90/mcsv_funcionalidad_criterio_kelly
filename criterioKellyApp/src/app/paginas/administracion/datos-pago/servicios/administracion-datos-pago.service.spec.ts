import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { AdministracionDatosPagoService } from './administracion-datos-pago.service';

const BASE = `${environment.apiUrlSuscripcion}datosPago/`;

describe('AdministracionDatosPagoService', () => {
  let servicio: AdministracionDatosPagoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(AdministracionDatosPagoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function esperarPost(accion: string, cuerpo: unknown): void {
    const peticion = http.expectOne(`${BASE}${accion}`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(cuerpo);
    peticion.flush({ success: 'ok' });
  }

  it('obtenerAdministracion hace GET a datosPago/administracion', () => {
    servicio.obtenerAdministracion().subscribe();
    const peticion = http.expectOne(`${BASE}administracion`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ metodos: [], redes: [] });
  });

  it('guardarRed envía el cuerpo tal cual', () => {
    const cuerpo = {
      red_clave: 'TRON',
      red_nombre: 'TRON',
      red_etiqueta: 'TRC20',
      red_direccion: 'TEST',
      red_activo: 1,
      red_orden: 0,
    };
    servicio.guardarRed(cuerpo).subscribe();
    esperarPost('guardarRed', cuerpo);
  });

  it('cambiarEstadoRed convierte el booleano a 0/1', () => {
    servicio.cambiarEstadoRed(4, true).subscribe();
    esperarPost('cambiarEstadoRed', { red_idRed: 4, red_activo: 1 });
  });

  it('eliminarRed, quitarQr y subirQr usan red_idRed', () => {
    servicio.eliminarRed(4).subscribe();
    esperarPost('eliminarRed', { red_idRed: 4 });
    servicio.quitarQr(4).subscribe();
    esperarPost('quitarQr', { red_idRed: 4 });
    servicio.subirQr({ idRed: 4, imagen: 'data:image/png;base64,AAAA' }).subscribe();
    esperarPost('subirQr', { red_idRed: 4, imagen: 'data:image/png;base64,AAAA' });
  });

  it('guardarPaypal y guardarBanco envían los campos mep_', () => {
    servicio.guardarPaypal({ mep_paypalCorreo: 'a@b.test', mep_paypalEnlace: '' }).subscribe();
    esperarPost('guardarPaypal', { mep_paypalCorreo: 'a@b.test', mep_paypalEnlace: '' });
    const banco = {
      mep_bancoNumero: '59300000000',
      mep_bancoPlantilla: '',
      mep_bancoTitular: '',
      mep_bancoDocumento: '',
      mep_bancoEntidad: '',
      mep_bancoTipoCuenta: '',
      mep_bancoCuenta: '',
      mep_bancoPaisMoneda: '',
      mep_bancoObservaciones: '',
    };
    servicio.guardarBanco(banco).subscribe();
    esperarPost('guardarBanco', banco);
  });

  it('cambiarEstadoMetodo envía código, activo y orden', () => {
    servicio.cambiarEstadoMetodo({ codigo: 'PAYPAL', activo: false, orden: 2 }).subscribe();
    esperarPost('cambiarEstadoMetodo', { mep_codigo: 'PAYPAL', mep_activo: 0, mep_orden: 2 });
  });
});
