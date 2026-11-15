import * as textos from './textos-alertas';
import { TextoAlerta } from './textos-alertas';

describe('textos-alertas', () => {
  const alertas = Object.entries(textos).filter(
    (entrada): entrada is [string, TextoAlerta] =>
      entrada[0].startsWith('ALERTA_') && typeof entrada[1] === 'object',
  );

  it('TA-1: exporta al menos una alerta', () => {
    expect(alertas.length).toBeGreaterThan(0);
  });

  it('TA-2: cada título tiene entre 1 y 5 palabras y cada mensaje no está vacío', () => {
    for (const [nombre, alerta] of alertas) {
      const palabras = alerta.titulo.trim().split(/\s+/).filter(Boolean).length;
      expect(palabras).withContext(nombre).toBeGreaterThanOrEqual(1);
      expect(palabras).withContext(nombre).toBeLessThanOrEqual(5);
      expect(alerta.mensaje.trim().length).withContext(nombre).toBeGreaterThan(0);
    }
  });
});
