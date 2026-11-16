import {
  ERROR_PIN_SIN_CRIPTOGRAFIA,
  esHashPin,
  generarHashPin,
  verificarPinContraHash,
} from './hash-pin';

const REGEX_HASH_PIN =
  /^pbkdf2-sha256\$310000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/;

const base64ABytes = (valor: string): Uint8Array =>
  Uint8Array.from(atob(valor), (caracter) => caracter.charCodeAt(0));

const bytesABase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

describe('hash-pin', () => {
  it('HP-1: genera el formato esperado con sal aleatoria distinta en cada guardado', async () => {
    const primero = await generarHashPin('123456');
    const segundo = await generarHashPin('123456');
    expect(esHashPin(primero)).toBeTrue();
    expect(primero).toMatch(REGEX_HASH_PIN);
    expect(segundo).toMatch(REGEX_HASH_PIN);
    expect(primero).not.toBe(segundo);
  });

  it('HP-2: verifica el PIN correcto y rechaza el incorrecto', async () => {
    const hash = await generarHashPin('123456');
    await expectAsync(
      verificarPinContraHash('123456', hash),
    ).toBeResolvedTo({ esCorrecto: true, requiereMigracion: false });
    await expectAsync(
      verificarPinContraHash('654321', hash),
    ).toBeResolvedTo({ esCorrecto: false, requiereMigracion: false });
  });

  it('HP-3: rechaza un hash alterado, con formato inválido o con iteraciones insuficientes', async () => {
    const hash = await generarHashPin('123456');
    const partes = hash.split('$');
    const hashAlterado = base64ABytes(partes[3]);
    hashAlterado[0] ^= 1;
    const valorAlterado = `${partes[0]}$${partes[1]}$${partes[2]}$${bytesABase64(hashAlterado)}`;

    await expectAsync(
      verificarPinContraHash('123456', valorAlterado),
    ).toBeResolvedTo({ esCorrecto: false, requiereMigracion: false });
    await expectAsync(
      verificarPinContraHash('123456', 'pbkdf2-sha256$310000$abc'),
    ).toBeResolvedTo({ esCorrecto: false, requiereMigracion: false });
    await expectAsync(
      verificarPinContraHash(
        '123456',
        `${partes[0]}$50000$${partes[2]}$${partes[3]}`,
      ),
    ).toBeResolvedTo({ esCorrecto: false, requiereMigracion: false });
  });

  it('HP-4: migra un PIN heredado únicamente cuando es correcto', async () => {
    await expectAsync(
      verificarPinContraHash('123456', '123456'),
    ).toBeResolvedTo({ esCorrecto: true, requiereMigracion: true });
    await expectAsync(
      verificarPinContraHash('123456', '12345'),
    ).toBeResolvedTo({ esCorrecto: false, requiereMigracion: false });
  });

  it('HP-5: falla cerrado cuando no existe crypto.subtle', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });
    try {
      await expectAsync(generarHashPin('123456')).toBeRejectedWithError(
        ERROR_PIN_SIN_CRIPTOGRAFIA,
      );
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'crypto', descriptor);
      } else {
        delete (globalThis as { crypto?: Crypto }).crypto;
      }
    }
  });
});
