import { TestBed } from '@angular/core/testing';
import { ES_PLATAFORMA_NATIVA } from './plataforma';
import { AlmacenSeguroService } from './almacen-seguro.service';

describe('AlmacenSeguroService', () => {
  it('no usa el plugin en web', async () => {
    TestBed.configureTestingModule({
      providers: [
        AlmacenSeguroService,
        { provide: ES_PLATAFORMA_NATIVA, useValue: false },
      ],
    });

    const servicio = TestBed.inject(AlmacenSeguroService);
    await servicio.guardarRefresh('no-debe-guardarse');
    expect(await servicio.leerRefresh()).toBeNull();
    await servicio.eliminarRefresh();
  });
});
