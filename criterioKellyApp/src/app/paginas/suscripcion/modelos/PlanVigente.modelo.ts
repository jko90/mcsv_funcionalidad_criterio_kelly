export type EstadoPlan = 'PRUEBA' | 'LIBRE' | 'PAGO' | 'SIN_PLAN';

export type MotivoSinPlan =
  | 'LIBRE_TERMINADO'
  | 'PLAN_PAGO_VENCIDO'
  | 'NUNCA_TUVO_PLAN';

export interface PlanDelPlanVigente {
  pla_idPlan: number;
  pla_nombre: string;
  pla_numCuentas: number | null;
  pla_diasHistorial: number | null;
  pla_diasTotales: number | null;
  pla_bloqueoDias: number | null;
  pla_puedeDescargar: boolean;
  pla_descargaTodos: boolean;
  pla_rangoLibre: boolean;
}

export interface PlanSiguiente {
  pla_idPlan: number;
  pla_nombre: string;
  pla_horasDuracion: number | null;
}

export interface PlanPendiente {
  sis_idSuscrip: number;
  pin_idPlanInterv: number;
  pla_nombre: string;
  ins_nombre: string;
  pin_precioFinal: number;
  comprobanteEnviado: boolean;
  esRenovacion: boolean;
  fechaLimitePago: string | null;
  diasRestantesPago: number | null;
}

export interface PlanProgramado {
  sis_idSuscrip: number;
  pin_idPlanInterv: number;
  pla_nombre: string;
  ins_nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface LimitesPlan {
  numCuentas: number | null;
  diasReporte: number | null;
  diasAnalisis: number | null;
  maxOperacionesAnalisis: number | null;
  diasTotalesAnalisis: number | null;
  puedeGraficar: boolean;
  puedeDescargar: boolean;
  divisorEditable: boolean;
  maxOperacionesDiarias: number | null;
}

export interface PlanVigente {
  estado: EstadoPlan;
  vigente: boolean;
  esPrueba: boolean;
  motivoSinPlan: MotivoSinPlan | null;
  idSuscripcion: number | null;
  pin_idPlanInterv: number | null;
  plan: PlanDelPlanVigente | null;
  fechaFinUtc: string | null;
  fechaCorte: string | null;
  segundosRestantes: number | null;
  cancelado: boolean;
  planSiguiente: PlanSiguiente | null;
  planPendiente: PlanPendiente | null;
  planProgramado: PlanProgramado | null;
  limites: LimitesPlan;
}
