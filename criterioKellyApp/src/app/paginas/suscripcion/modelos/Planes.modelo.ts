export interface PlanesModelo {
  pin_idPlanInterv: number;
  pin_precioFinal: number;
  ins_nombre: string;
  ins_numMeses: number;
  ins_x100descuen: number;
  pla_nombre: string;
  pla_descripcion: string;
  pla_precioBase: number;
  pla_moneda: string;
  pla_numCuentas: number;
  pla_diasHistorial: number;
  pla_diasTotales: number;
  pla_bloqueoDias: number;
  pla_puedeDescargar: boolean;
  pla_rangoLibre: boolean;
  pla_puedeGraficar: boolean;
  pla_divisorEditable: boolean;
  pla_maxOperacionesDiarias: number | null;

  sis_idSuscrip?: number;
  sus_fechaCrea?: string;
  sus_usuarioId?: number;

  pag_saldo?: number;
  pag_situacion?: string;
  pag_montoConfirmado?: number;
}
