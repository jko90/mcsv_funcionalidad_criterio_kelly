export interface TextoAlerta {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
}

export const TEXTO_ENTENDIDO = 'Entendido';
export const TEXTO_CANCELAR_POR_DEFECTO = 'No';
export const TEXTO_CONFIRMAR_POR_DEFECTO = 'Sí';
export const TEXTO_CONFIRMAR_DESTRUCTIVA_POR_DEFECTO = 'Sí, continuar';

/** El mensaje real del plan pendiente lo calcula el store; este es el de respaldo. */
export const ALERTA_PLAN_PENDIENTE: TextoAlerta = {
  titulo: 'Plan pendiente',
  mensaje: 'Tu plan está pendiente de pago y se activará cuando valides tu comprobante.',
};
export const TEXTO_SUBIR_COMPROBANTE = 'Subir comprobante';

/** Cada pantalla pasa su propio mensaje; este es el de respaldo. */
export const ALERTA_LIMITE_PLAN: TextoAlerta = {
  titulo: 'Mejora tu plan',
  mensaje: 'Tu plan actual no incluye esta función. Mejóralo para seguir adelante.',
  textoConfirmar: 'Ver planes',
};
export const TEXTO_AHORA_NO = 'Ahora no';

/** El mensaje real llega del servidor (409); este es el de respaldo. */
export const ALERTA_CONFLICTO_PLAN: TextoAlerta = {
  titulo: 'Plan no disponible',
  mensaje: 'Ya tienes un plan pendiente o activo, por eso no puedes elegir otro.',
};

export const ALERTA_CONFIRMAR_PLAN: TextoAlerta = {
  titulo: 'Confirmar plan',
  mensaje: '¿Seguro que quieres guardar este plan?',
};

export function mensajeConfirmarPlan(detallePlan: string): string {
  return `¿Seguro que quieres guardar el plan: ${detallePlan}?`;
}

export const ALERTA_NUEVA_VERSION: TextoAlerta = {
  titulo: 'Nueva versión disponible',
  mensaje: 'Hay una versión nueva de Criterio Kelly. ¿Desea actualizar ahora?',
  textoConfirmar: 'Actualizar',
};
export const TEXTO_MAS_TARDE = 'Más tarde';

/** El mensaje real lo calcula el store de plan; este es el de respaldo. */
export const ALERTA_CANCELAR_PLAN: TextoAlerta = {
  titulo: 'Cancelar plan',
  mensaje: '¿Seguro que quieres cancelar tu plan?',
  textoConfirmar: 'Sí, cancelar',
};

/** El mensaje real lo calcula el store de validación; este es el de respaldo. */
export const ALERTA_APROBAR_PAGO: TextoAlerta = {
  titulo: 'Aprobar pago',
  mensaje: '¿Seguro que quieres aprobar este pago?',
  textoConfirmar: 'Aprobar',
};

export const ALERTA_CERRAR_SESIONES: TextoAlerta = {
  titulo: 'Cerrar sesiones',
  mensaje: '¿Desea cerrar la sesión en todos los dispositivos?',
  textoConfirmar: 'Sí, cerrar',
};

export const ALERTA_OMITIR_PIN: TextoAlerta = {
  titulo: 'Confirmación',
  mensaje: '¿Estás seguro de que deseas continuar sin registrar PIN?',
  textoConfirmar: 'Aceptar',
};

export const ALERTA_OLVIDE_PIN: TextoAlerta = {
  titulo: 'Olvidé mi PIN',
  mensaje:
    'Se eliminará el PIN de este dispositivo y se cerrará la sesión. Al volver a iniciar sesión podrá crear uno nuevo.',
  textoConfirmar: 'Sí, continuar',
};

// Los textos de HLT-34 y HLT-35 se añaden aquí para mantener un solo tono.

export const ALERTA_RECHAZAR_PAGO: TextoAlerta = {
  titulo: 'Rechazar pago',
  mensaje: 'Escribe el motivo del rechazo.',
  textoConfirmar: 'Rechazar',
};
export const PLACEHOLDER_MOTIVO_RECHAZO = 'Motivo del rechazo';
export const TEXTO_CANCELAR_LARGO = 'Cancelar';

export const ALERTA_CREAR_CUENTA: TextoAlerta = {
  titulo: 'Crear cuenta',
  mensaje: 'Escribe el nombre y el monto inicial.',
  textoConfirmar: 'Guardar',
};
export const ALERTA_EDITAR_CUENTA: TextoAlerta = {
  titulo: 'Editar Cuenta',
  mensaje: 'Escribe el nuevo nombre de la cuenta.',
  textoConfirmar: 'Actualizar',
};
export const ALERTA_ELIMINAR_CUENTA: TextoAlerta = {
  titulo: 'Eliminar Cuenta',
  mensaje: '¿Seguro que desea eliminar esta cuenta?',
  textoConfirmar: 'Eliminar',
};
export const ALERTA_AUMENTAR_CAPITAL: TextoAlerta = {
  titulo: 'Aumentar Capital',
  mensaje: 'Escribe el monto que se suma al capital.',
  textoConfirmar: 'Guardar',
};
export const ALERTA_REDUCIR_CAPITAL: TextoAlerta = {
  titulo: 'Reducir Capital',
  mensaje: 'Escribe el monto que se resta del capital.',
  textoConfirmar: 'Guardar',
};
export function mensajeEliminarCuenta(nombreCuenta: string): string {
  return `¿Seguro que desea eliminar la cuenta "${nombreCuenta}"?`;
}

export const ALERTA_CONFIRMAR_DIVISOR: TextoAlerta = {
  titulo: 'Confirmar cambio',
  mensaje:
    '¿Está seguro de realizar el cambio? Esto afectará al porcentaje operativo diario. Lo recomendable es 10.',
  textoConfirmar: 'Sí, actualizar',
};
export const TEXTO_ACTUALIZAR = 'Actualizar';

export const ALERTA_BLOQUEO_SIN_PIN: TextoAlerta = {
  titulo: 'Sesión bloqueada',
  mensaje: 'No tienes PIN. Ingresa tu contraseña para continuar.',
  textoConfirmar: 'Continuar',
};
export const TEXTO_SALIR = 'Salir';

export const TEXTO_CONFIRMAR = 'Confirmar';
export const TEXTO_ELIMINAR = 'Eliminar';
export const TEXTO_QUITAR = 'Quitar';

export const ALERTA_ELIMINAR_REGISTRO: TextoAlerta = {
  titulo: 'Eliminar registro',
  mensaje: '¿Está seguro de eliminar el registro? Una vez eliminado no podrá recuperarlo.',
  textoConfirmar: 'Sí, eliminar',
};
