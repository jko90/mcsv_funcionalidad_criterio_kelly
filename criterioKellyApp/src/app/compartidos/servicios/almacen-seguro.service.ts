import { Injectable, inject } from '@angular/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { ES_PLATAFORMA_NATIVA } from './plataforma';

const CLAVE_REFRESH = 'ck_refresh';
export const CLAVE_CIERRE_PENDIENTE = 'ck_cierre_pendiente';

@Injectable({ providedIn: 'root' })
export class AlmacenSeguroService {
  private sincronizacionConfigurada = false;

  private readonly esNativa = inject(ES_PLATAFORMA_NATIVA);

  async guardarRefresh(valor: string): Promise<void> {
    if (!this.esNativa) return;
    await this.configurarSincronizacion();
    await SecureStorage.setItem(CLAVE_REFRESH, valor);
  }

  async leerRefresh(): Promise<string | null> {
    if (!this.esNativa) return null;
    await this.configurarSincronizacion();
    return (await SecureStorage.getItem(CLAVE_REFRESH)) ?? null;
  }

  async eliminarRefresh(): Promise<void> {
    if (!this.esNativa) return;
    await this.configurarSincronizacion();
    await SecureStorage.removeItem(CLAVE_REFRESH);
  }

  marcarCierrePendiente(): void {
    localStorage.setItem(CLAVE_CIERRE_PENDIENTE, '1');
  }

  hayCierrePendiente(): boolean {
    return localStorage.getItem(CLAVE_CIERRE_PENDIENTE) === '1';
  }

  limpiarCierrePendiente(): void {
    localStorage.removeItem(CLAVE_CIERRE_PENDIENTE);
  }

  private async configurarSincronizacion(): Promise<void> {
    if (this.sincronizacionConfigurada) return;
    await SecureStorage.setSynchronize(false);
    this.sincronizacionConfigurada = true;
  }
}
