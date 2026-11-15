import { Injectable } from '@angular/core';
import { EtapaBanco } from '../modelos/PasoPago.modelo';

export const CLAVE_SOLICITUD_BANCO = 'solicitud_banco_whatsapp';

export interface MarcaSolicitudBanco {
  usuarioId: number;
  planId: number;
  etapa: Exclude<EtapaBanco, 'PENDIENTE'>;
}

/**
 * Recuerda en este dispositivo que la persona ya pidió por WhatsApp los datos
 * de la cuenta bancaria para un plan. Solo guarda ids y la etapa: sin datos
 * personales, bancarios ni tokens.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudBancoService {
  obtener(usuarioId: number, planId: number): EtapaBanco {
    try {
      const texto = localStorage.getItem(CLAVE_SOLICITUD_BANCO);
      if (texto === null) return 'PENDIENTE';
      const marca = JSON.parse(texto) as Partial<MarcaSolicitudBanco> | null;
      const etapaValida =
        marca?.etapa === 'WHATSAPP_ABIERTO' || marca?.etapa === 'SOLICITUD_CONFIRMADA';
      return marca?.usuarioId === usuarioId && marca.planId === planId && etapaValida
        ? marca.etapa!
        : 'PENDIENTE';
    } catch {
      return 'PENDIENTE';
    }
  }

  guardar(usuarioId: number, planId: number, etapa: MarcaSolicitudBanco['etapa']): void {
    try {
      const marca: MarcaSolicitudBanco = { usuarioId, planId, etapa };
      localStorage.setItem(CLAVE_SOLICITUD_BANCO, JSON.stringify(marca));
    } catch {
      // Modo privado o almacenamiento bloqueado: se ignora la escritura.
    }
  }

  borrar(): void {
    try {
      localStorage.removeItem(CLAVE_SOLICITUD_BANCO);
    } catch {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
  }
}
