import {
  mensajeErrorArchivoQr,
  mensajeErrorClaveRed,
  mensajeErrorCorreo,
  mensajeErrorCuenta,
  mensajeErrorDireccion,
  mensajeErrorDocumento,
  mensajeErrorEnlacePaypal,
  mensajeErrorEntidad,
  mensajeErrorNumeroWhatsapp,
  mensajeErrorPaisMoneda,
  mensajeErrorTipoCuenta,
  mensajeErrorTitular,
  MENSAJE_DIRECCION_TRON,
  MENSAJE_QR_TAMANO,
  MENSAJE_QR_TIPO,
  normalizarNumeroWhatsapp,
} from './validadores-pago';

// Valores obviamente falsos construidos para que cumplan el formato.
const TRON_VALIDA = `T${'A'.repeat(33)}`;
const EVM_VALIDA = `0x${'a'.repeat(40)}`;

describe('validadores-pago', () => {
  it('la clave de la red admite mayúsculas, números y guion bajo', () => {
    expect(mensajeErrorClaveRed('tron')).toBeNull();
    expect(mensajeErrorClaveRed('SOL_2')).toBeNull();
    expect(mensajeErrorClaveRed('T')).not.toBeNull();
    expect(mensajeErrorClaveRed('CLAVE-LARGA-QUE-NO')).not.toBeNull();
  });

  it('TRON exige T y 34 caracteres base58', () => {
    expect(mensajeErrorDireccion('TRON', TRON_VALIDA)).toBeNull();
    expect(mensajeErrorDireccion('TRON', `  ${TRON_VALIDA}  `)).toBeNull();
    expect(mensajeErrorDireccion('TRON', EVM_VALIDA)).toBe(MENSAJE_DIRECCION_TRON);
    expect(mensajeErrorDireccion('TRON', `T${'0'.repeat(33)}`)).toBe(MENSAJE_DIRECCION_TRON);
    expect(mensajeErrorDireccion('TRON', TRON_VALIDA.slice(1))).toBe(MENSAJE_DIRECCION_TRON);
  });

  it('ETH y BSC exigen 0x y 40 hexadecimales', () => {
    expect(mensajeErrorDireccion('ETH', EVM_VALIDA)).toBeNull();
    expect(mensajeErrorDireccion('BSC', EVM_VALIDA)).toBeNull();
    expect(mensajeErrorDireccion('ETH', `0x${'g'.repeat(40)}`)).not.toBeNull();
    expect(mensajeErrorDireccion('BSC', `0x${'a'.repeat(39)}`)).not.toBeNull();
    expect(mensajeErrorDireccion('ETH', TRON_VALIDA)).not.toBeNull();
  });

  it('otra clave admite de 16 a 128 letras y números', () => {
    expect(mensajeErrorDireccion('SOL', 'TESTTESTTESTTEST')).toBeNull();
    expect(mensajeErrorDireccion('SOL', 'CORTA')).not.toBeNull();
    expect(mensajeErrorDireccion('SOL', 'TEST TEST TEST TEST')).not.toBeNull();
    expect(mensajeErrorDireccion('SOL', 'A'.repeat(129))).not.toBeNull();
  });

  it('correo de PayPal', () => {
    expect(mensajeErrorCorreo('pagos@ejemplo.test')).toBeNull();
    expect(mensajeErrorCorreo('sin-arroba')).not.toBeNull();
    expect(mensajeErrorCorreo(`${'a'.repeat(60)}@ejemplo.test`)).not.toBeNull();
  });

  it('enlace de PayPal solo https y hosts permitidos', () => {
    expect(mensajeErrorEnlacePaypal('https://paypal.me/test')).toBeNull();
    expect(mensajeErrorEnlacePaypal('https://www.paypal.com/test')).toBeNull();
    expect(mensajeErrorEnlacePaypal('http://paypal.me/test')).not.toBeNull();
    expect(mensajeErrorEnlacePaypal('https://paypal.me.ejemplo.test/x')).not.toBeNull();
    expect(mensajeErrorEnlacePaypal('https://otro.test/paypal.me/x')).not.toBeNull();
    expect(mensajeErrorEnlacePaypal('javascript:alert(1)')).not.toBeNull();
  });

  it('WhatsApp de 8 a 15 dígitos y se quitan +, espacios y guiones', () => {
    expect(normalizarNumeroWhatsapp('+00 0000-0000')).toBe('0000000000');
    expect(mensajeErrorNumeroWhatsapp('+00 0000-0000')).toBeNull();
    expect(mensajeErrorNumeroWhatsapp('1234567')).not.toBeNull();
    expect(mensajeErrorNumeroWhatsapp('1'.repeat(16))).not.toBeNull();
    expect(mensajeErrorNumeroWhatsapp('12345678a')).not.toBeNull();
  });

  it('datos de la cuenta bancaria', () => {
    expect(mensajeErrorTitular('Titular Prueba')).toBeNull();
    expect(mensajeErrorTitular('<b>')).not.toBeNull();
    expect(mensajeErrorTitular('A')).not.toBeNull();
    expect(mensajeErrorEntidad('Banco Prueba')).toBeNull();
    expect(mensajeErrorEntidad('B'.repeat(65))).not.toBeNull();
    expect(mensajeErrorDocumento('TEST-123')).toBeNull();
    expect(mensajeErrorDocumento('12')).not.toBeNull();
    expect(mensajeErrorCuenta('TEST 0000 1111')).toBeNull();
    expect(mensajeErrorCuenta('123')).not.toBeNull();
    expect(mensajeErrorCuenta('1'.repeat(35))).not.toBeNull();
    expect(mensajeErrorPaisMoneda('Pais / USD')).toBeNull();
    expect(mensajeErrorPaisMoneda('x')).not.toBeNull();
    expect(mensajeErrorTipoCuenta('AHORROS')).toBeNull();
    expect(mensajeErrorTipoCuenta('OTRO')).toBeNull();
    expect(mensajeErrorTipoCuenta('PLAZO')).not.toBeNull();
  });

  it('el archivo del QR se rechaza por tipo o por tamaño', () => {
    expect(mensajeErrorArchivoQr('image/png', 1000)).toBeNull();
    expect(mensajeErrorArchivoQr('image/jpeg', 262144)).toBeNull();
    expect(mensajeErrorArchivoQr('image/webp', 1000)).toBeNull();
    expect(mensajeErrorArchivoQr('image/gif', 1000)).toBe(MENSAJE_QR_TIPO);
    expect(mensajeErrorArchivoQr('image/svg+xml', 1000)).toBe(MENSAJE_QR_TIPO);
    expect(mensajeErrorArchivoQr('image/png', 262145)).toBe(MENSAJE_QR_TAMANO);
  });
});
