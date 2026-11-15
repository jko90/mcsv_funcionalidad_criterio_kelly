import { Injectable } from '@angular/core';
import { EstadoPlan } from '../modelos/PlanVigente.modelo';

export const CLAVE_PLAN_AVISADO = 'plan_vigente_avisado';

const ESTADOS_VALIDOS: readonly EstadoPlan[] = [
  'PRUEBA',
  'LIBRE',
  'PAGO',
  'SIN_PLAN',
];

export interface MarcaPlanAvisado {
  usuarioId: number;
  estado: EstadoPlan;
  idSuscripcion: number | null;
}

/**
 * Recuerda en el dispositivo el último estado de plan que ya se informó a la
 * persona, para no repetir el aviso al recargar. No guarda tokens ni fechas.
 */
@Injectable({ providedIn: 'root' })
export class PlanAvisadoService {
  obtener(usuarioId: number): MarcaPlanAvisado | null {
    try {
      const texto = localStorage.getItem(CLAVE_PLAN_AVISADO);
      if (texto === null) return null;
      const marca = this.convertirAMarca(JSON.parse(texto));
      return marca !== null && marca.usuarioId === usuarioId ? marca : null;
    } catch {
      return null;
    }
  }

  guardar(
    usuarioId: number,
    estado: EstadoPlan,
    idSuscripcion: number | null,
  ): void {
    const marca: MarcaPlanAvisado = { usuarioId, estado, idSuscripcion };
    try {
      localStorage.setItem(CLAVE_PLAN_AVISADO, JSON.stringify(marca));
    } catch {
      // Modo privado o almacenamiento bloqueado: se ignora la escritura.
    }
  }

  borrar(): void {
    try {
      localStorage.removeItem(CLAVE_PLAN_AVISADO);
    } catch {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
  }

  private convertirAMarca(valor: unknown): MarcaPlanAvisado | null {
    if (typeof valor !== 'object' || valor === null) return null;
    const { usuarioId, estado, idSuscripcion } = valor as Record<
      string,
      unknown
    >;
    const idValido = idSuscripcion === null || Number.isInteger(idSuscripcion);
    if (
      !Number.isInteger(usuarioId) ||
      !idValido ||
      !ESTADOS_VALIDOS.includes(estado as EstadoPlan)
    ) {
      return null;
    }
    return {
      usuarioId: usuarioId as number,
      estado: estado as EstadoPlan,
      idSuscripcion: idSuscripcion as number | null,
    };
  }
}
