export const PREFIJO_HASH_PIN = 'pbkdf2-sha256';
export const ITERACIONES_PBKDF2_PIN = 310_000;
export const ITERACIONES_MINIMAS_PIN = 100_000;
export const BYTES_SAL_PIN = 16;
export const BITS_HASH_PIN = 256;
export const LONGITUD_PIN = 6;
export const ERROR_PIN_SIN_CRIPTOGRAFIA = 'PIN_SIN_CRIPTOGRAFIA';

export interface ResultadoComparacionPin {
  esCorrecto: boolean;
  requiereMigracion: boolean;
}

const obtenerSubtle = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error(ERROR_PIN_SIN_CRIPTOGRAFIA);
  return subtle;
};

const codificarBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

const decodificarBase64 = (valor: string): Uint8Array =>
  Uint8Array.from(atob(valor), (caracter) => caracter.charCodeAt(0));

const compararEnTiempoConstante = (
  primero: Uint8Array,
  segundo: Uint8Array,
): boolean => {
  let diferencia = primero.length ^ segundo.length;
  const longitud = Math.max(primero.length, segundo.length);
  for (let indice = 0; indice < longitud; indice += 1) {
    diferencia |= (primero[indice] ?? 0) ^ (segundo[indice] ?? 0);
  }
  return diferencia === 0;
};

const derivarHash = async (
  pin: string,
  sal: Uint8Array,
  iteraciones: number,
): Promise<Uint8Array> => {
  const clave = await obtenerSubtle().importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await obtenerSubtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    clave,
    BITS_HASH_PIN,
  );
  return new Uint8Array(bits);
};

export const esHashPin = (valor: string): boolean =>
  valor.startsWith(`${PREFIJO_HASH_PIN}$`);

export async function generarHashPin(pin: string): Promise<string> {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN_INVALIDO');
  const sal = globalThis.crypto?.getRandomValues(
    new Uint8Array(BYTES_SAL_PIN),
  );
  if (!sal) throw new Error(ERROR_PIN_SIN_CRIPTOGRAFIA);
  const hash = await derivarHash(pin, sal, ITERACIONES_PBKDF2_PIN);
  return `${PREFIJO_HASH_PIN}$${ITERACIONES_PBKDF2_PIN}$${codificarBase64(
    sal,
  )}$${codificarBase64(hash)}`;
}

export async function verificarPinContraHash(
  pinIngresado: string,
  valorAlmacenado: string,
): Promise<ResultadoComparacionPin> {
  if (!esHashPin(valorAlmacenado)) {
    const correcto = compararEnTiempoConstante(
      new TextEncoder().encode(pinIngresado),
      new TextEncoder().encode(valorAlmacenado),
    );
    return { esCorrecto: correcto, requiereMigracion: correcto };
  }

  const partes = valorAlmacenado.split('$');
  if (partes.length !== 4) return { esCorrecto: false, requiereMigracion: false };
  const iteraciones = Number(partes[1]);
  try {
    const sal = decodificarBase64(partes[2]);
    const hashEsperado = decodificarBase64(partes[3]);
    if (
      !Number.isInteger(iteraciones) ||
      iteraciones < ITERACIONES_MINIMAS_PIN ||
      sal.length !== BYTES_SAL_PIN ||
      hashEsperado.length !== BITS_HASH_PIN / 8
    ) {
      return { esCorrecto: false, requiereMigracion: false };
    }
    const hashObtenido = await derivarHash(pinIngresado, sal, iteraciones);
    const correcto = compararEnTiempoConstante(hashObtenido, hashEsperado);
    return {
      esCorrecto: correcto,
      requiereMigracion: correcto && iteraciones < ITERACIONES_PBKDF2_PIN,
    };
  } catch {
    return { esCorrecto: false, requiereMigracion: false };
  }
}
