import { Injectable } from '@angular/core';

export const CLAVE_PLAN_RESERVADO = 'plan_reservado';
export const CLAVE_SUSCRIPCION_VERIFICADA = 'suscripcion_inicial_verificada';
export const MAXIMO_USUARIOS_VERIFICADOS = 20;

interface ReservaPlan {
  usuario: string;
  pin_idPlanInterv: number;
}

/**
 * Guarda en el dispositivo el plan elegido durante el registro (antes de que
 * exista una sesión) y la marca de "suscripción inicial verificada" por usuario.
 * No contiene tokens ni datos de sesión.
 */
@Injectable({ providedIn: 'root' })
export class PlanReservadoService {
  reservar(usuario: string, idPlanIntervalo: number): void {
    if (usuario.trim() === '' || !this.esEnteroPositivo(idPlanIntervalo))
      return;
    const reserva: ReservaPlan = {
      usuario: this.normalizar(usuario),
      pin_idPlanInterv: idPlanIntervalo,
    };
    this.escribir(CLAVE_PLAN_RESERVADO, JSON.stringify(reserva));
  }

  obtener(usuario: string): number | null {
    const reserva = this.leerReserva();
    if (!reserva || reserva.usuario !== this.normalizar(usuario)) return null;
    return reserva.pin_idPlanInterv;
  }

  borrar(usuario: string): void {
    const reserva = this.leerReserva();
    // Una reserva ajena pertenece a otro registro y no se toca.
    if (!reserva || reserva.usuario !== this.normalizar(usuario)) return;
    try {
      localStorage.removeItem(CLAVE_PLAN_RESERVADO);
    } catch {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
  }

  estaVerificada(idUsuario: number): boolean {
    return this.leerUsuariosVerificados().includes(idUsuario);
  }

  marcarVerificada(idUsuario: number): void {
    const usuarios = this.leerUsuariosVerificados().filter(
      (id) => id !== idUsuario,
    );
    usuarios.push(idUsuario);
    this.escribir(
      CLAVE_SUSCRIPCION_VERIFICADA,
      JSON.stringify(usuarios.slice(-MAXIMO_USUARIOS_VERIFICADOS)),
    );
  }

  private leerReserva(): ReservaPlan | null {
    try {
      const texto = localStorage.getItem(CLAVE_PLAN_RESERVADO);
      if (texto === null) return null;
      const valor: unknown = JSON.parse(texto);
      if (typeof valor !== 'object' || valor === null) return null;
      const { usuario, pin_idPlanInterv } = valor as Record<string, unknown>;
      if (
        typeof usuario !== 'string' ||
        !this.esEnteroPositivo(pin_idPlanInterv)
      ) {
        return null;
      }
      return { usuario, pin_idPlanInterv };
    } catch {
      return null;
    }
  }

  private leerUsuariosVerificados(): number[] {
    try {
      const texto = localStorage.getItem(CLAVE_SUSCRIPCION_VERIFICADA);
      if (texto === null) return [];
      const valor: unknown = JSON.parse(texto);
      if (!Array.isArray(valor) || !valor.every((id) => Number.isInteger(id)))
        return [];
      return valor as number[];
    } catch {
      return [];
    }
  }

  private escribir(clave: string, valor: string): void {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      // Modo privado o almacenamiento bloqueado: se ignora la escritura.
    }
  }

  private normalizar(usuario: string): string {
    return usuario.trim().toLowerCase();
  }

  private esEnteroPositivo(valor: unknown): valor is number {
    return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;
  }
}
