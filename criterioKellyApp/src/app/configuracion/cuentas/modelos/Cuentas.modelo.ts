export interface CuentasModelo {
  cue_idCuentas?: number;
  cue_situacion: string;
  cue_nombre: string;
  cue_usuarioId?: number;
  cue_estado: string;
}

export interface CuentaResponse {
  cue_idCuentas: number;
  cap_idCapital: number;
  cue_nombre: string;
  valor_cuenta: number;
  cue_usuarioId?: number;
  fecha_valor: string;
  multipKelly?: number;
}

export interface CrearCuenta {
  cue_nombre: string;
  valor_cuenta: number;
  fecha_valor: string;
}

export interface ActualizarNombreCuenta {
  cue_idCuenta: number;
  cue_nombre: string;
}

export interface EliminarCuenta {
  cue_idCuenta: number;
}

export interface cuentasRespuetaExitosa {
  success: string;
}

export interface CuentaErrorResponse {
  error: string;
}
