import { Injectable } from '@angular/core';

export const PREFIJO_CACHE_SERVICE_WORKER = 'ngsw:';

@Injectable({ providedIn: 'root' })
export class LimpiezaClienteService {
  /** Borra las cachés que no son del service worker de Angular. Devuelve cuántas borró. */
  async limpiarCachesDeDatos(): Promise<number> {
    if (!('caches' in globalThis)) {
      return 0;
    }
    const nombresCaches = await caches.keys();
    const nombresDeDatos = nombresCaches.filter(
      (nombre) => !nombre.startsWith(PREFIJO_CACHE_SERVICE_WORKER),
    );
    const resultados = await Promise.all(nombresDeDatos.map((nombre) => caches.delete(nombre)));
    return resultados.filter(Boolean).length;
  }
}
