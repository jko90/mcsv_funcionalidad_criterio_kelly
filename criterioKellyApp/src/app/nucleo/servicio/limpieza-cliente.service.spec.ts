import { TestBed } from '@angular/core/testing';
import { LimpiezaClienteService } from './limpieza-cliente.service';

describe('LimpiezaClienteService', () => {
  let servicio: LimpiezaClienteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(LimpiezaClienteService);
  });

  it('LC-1 borra solo las cachés que no son de ngsw y devuelve cuántas borró', async () => {
    spyOn(caches, 'keys').and.resolveTo(['ngsw:/:1:assets', 'datos-x']);
    const borrar = spyOn(caches, 'delete').and.resolveTo(true);

    const cantidad = await servicio.limpiarCachesDeDatos();

    expect(cantidad).toBe(1);
    expect(borrar).toHaveBeenCalledTimes(1);
    expect(borrar).toHaveBeenCalledWith('datos-x');
  });

  it('LC-2 sin cachés distintas de ngsw devuelve 0 y no llama delete', async () => {
    spyOn(caches, 'keys').and.resolveTo(['ngsw:/:1:assets']);
    const borrar = spyOn(caches, 'delete').and.resolveTo(true);

    const cantidad = await servicio.limpiarCachesDeDatos();

    expect(cantidad).toBe(0);
    expect(borrar).not.toHaveBeenCalled();
  });
});
