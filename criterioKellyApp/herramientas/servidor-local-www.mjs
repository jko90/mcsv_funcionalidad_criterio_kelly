// Servidor estático local para probar la build web con las cabeceras del contrato (HLT-09).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUERTO_POR_DEFECTO = 4200;
const DIRECTORIO_HERRAMIENTAS = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = resolve(DIRECTORIO_HERRAMIENTAS, '..', 'www');

const TIPOS_CONTENIDO = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

const contrato = JSON.parse(
  await readFile(join(DIRECTORIO_HERRAMIENTAS, 'cabeceras-web.json'), 'utf8'),
);
const puerto = Number(process.env.PUERTO ?? PUERTO_POR_DEFECTO);
const origenApi = process.env.ORIGEN_API ?? contrato.origenApiPorDefecto;

function construirCabeceras() {
  const cabeceras = { ...contrato.cabeceras, 'Cache-Control': 'no-cache' };
  let politica = cabeceras['Content-Security-Policy'].replace('__ORIGEN_API__', origenApi);
  if (origenApi.startsWith('https://')) {
    politica += `; ${contrato.directivasSoloHttps}`;
  }
  cabeceras['Content-Security-Policy'] = politica;
  return cabeceras;
}

const CABECERAS = construirCabeceras();

async function leerArchivo(ruta) {
  try {
    return await readFile(ruta);
  } catch {
    return null;
  }
}

function responder(respuesta, estado, tipo, cuerpo, esHead) {
  respuesta.writeHead(estado, { ...CABECERAS, 'Content-Type': tipo });
  respuesta.end(esHead ? undefined : cuerpo);
}

const servidor = createServer(async (peticion, respuesta) => {
  const esHead = peticion.method === 'HEAD';
  if (peticion.method !== 'GET' && !esHead) {
    responder(respuesta, 405, 'text/plain', 'Método no permitido', false);
    return;
  }

  let rutaUrl;
  try {
    rutaUrl = decodeURIComponent(new URL(peticion.url, 'http://localhost').pathname);
  } catch {
    responder(respuesta, 404, 'text/plain', 'No encontrado', esHead);
    return;
  }

  const rutaArchivo = normalize(join(RAIZ, rutaUrl));
  if (rutaArchivo !== RAIZ && !rutaArchivo.startsWith(RAIZ + sep)) {
    responder(respuesta, 404, 'text/plain', 'No encontrado', esHead);
    return;
  }

  let contenido = rutaUrl.endsWith('/') ? null : await leerArchivo(rutaArchivo);
  let extension = extname(rutaArchivo);
  if (contenido === null && extname(rutaUrl) === '') {
    contenido = await leerArchivo(join(RAIZ, 'index.html'));
    extension = '.html';
  }
  if (contenido === null) {
    responder(respuesta, 404, 'text/plain', 'No encontrado', esHead);
    return;
  }
  responder(respuesta, 200, TIPOS_CONTENIDO[extension] ?? 'application/octet-stream', contenido, esHead);
});

servidor.listen(puerto, () => {
  console.log(`Servidor local de www/ en http://localhost:${puerto} (API permitida: ${origenApi})`);
});
