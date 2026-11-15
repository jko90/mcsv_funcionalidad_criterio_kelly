export interface SuscripcionModelo {
  sis_idSuscrip: number;
  sus_usuarioId: number;
  sus_pinIdPlanin: number;
  sus_fechainicio: string;
  sus_fechaFin: string;
  sus_situacion: string;
  sus_referenPago: string;
  sus_renovAutomatica: boolean;
  sus_proximoPago: string;
  sus_fechaCrea: string;
}

export interface CrearSuscripcionInicialRequest {
  sus_pinIdPlanin: number;
}

export const PLAN_LIBRE_ID_INTERVALO = 1;
