import {
  MENSAJE_IMAGEN_GRANDE,
  MENSAJE_IMAGEN_TIPO,
  TAMANO_MAXIMO_COMPROBANTE_BYTES,
  validarImagenComprobante,
} from './validacion-imagen';

function dataUrl(bytes: number, tipo = 'image/png'): string {
  // Múltiplo de 3 para que el base64 no lleve relleno y el tamaño sea exacto.
  return `data:${tipo};base64,${'A'.repeat((bytes / 3) * 4)}`;
}

describe('validarImagenComprobante', () => {
  it('acepta una imagen de hasta 512 KB', () => {
    expect(validarImagenComprobante(dataUrl(Math.floor(TAMANO_MAXIMO_COMPROBANTE_BYTES / 3) * 3))).toBeNull();
  });

  it('rechaza una imagen de más de 512 KB', () => {
    expect(validarImagenComprobante(dataUrl((Math.floor(TAMANO_MAXIMO_COMPROBANTE_BYTES / 3) + 1) * 3))).toBe(
      MENSAJE_IMAGEN_GRANDE,
    );
  });

  it('rechaza lo que no es jpeg, png, gif o webp', () => {
    expect(validarImagenComprobante(dataUrl(3, 'image/svg+xml'))).toBe(MENSAJE_IMAGEN_TIPO);
    expect(validarImagenComprobante('texto')).toBe(MENSAJE_IMAGEN_TIPO);
  });
});
