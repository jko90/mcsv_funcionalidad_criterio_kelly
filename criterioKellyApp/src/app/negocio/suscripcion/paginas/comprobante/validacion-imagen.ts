export const TAMANO_MAXIMO_COMPROBANTE_BYTES = 524_288;
export const MENSAJE_IMAGEN_GRANDE = 'La imagen no puede superar 512 KB';
export const MENSAJE_IMAGEN_TIPO = 'Usa una imagen jpeg, png, gif o webp';

const PATRON_DATA_URL = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
const BYTES_POR_GRUPO_BASE64 = 3;
const CARACTERES_POR_GRUPO_BASE64 = 4;

function bytesDecodificados(base64: string): number {
  const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / CARACTERES_POR_GRUPO_BASE64) * BYTES_POR_GRUPO_BASE64 - relleno;
}

// Devuelve el mensaje de error o null si la imagen sirve (mismos límites del servidor).
export function validarImagenComprobante(dataUrl: string): string | null {
  const coincidencia = PATRON_DATA_URL.exec(dataUrl);
  if (coincidencia === null) return MENSAJE_IMAGEN_TIPO;
  return bytesDecodificados(coincidencia[2]) > TAMANO_MAXIMO_COMPROBANTE_BYTES
    ? MENSAJE_IMAGEN_GRANDE
    : null;
}
