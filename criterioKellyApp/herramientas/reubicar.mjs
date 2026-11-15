// Herramienta de reubicación de la reorganización por dominios (HLT-41 / HU-002).
//
// QUÉ HACE
//   Lee un mapa JSON "origen -> destino", mueve los archivos con `fs.rename` y
//   reescribe todas las referencias a los archivos movidos. Pensada para que
//   HLT-42…HLT-46 no dependan de ediciones a mano.
//
// USO
//   node herramientas/reubicar.mjs herramientas/ejemplo-mapa.json --simular
//   node herramientas/reubicar.mjs mi-mapa.json --aplicar
//   node herramientas/reubicar.mjs --verificar
//
//   --simular         imprime el plan y los totales, sin escribir nada.
//   --aplicar         ejecuta los movimientos y las reescrituras (por defecto
//                     sin mapa solo informa; con mapa sin --aplicar simula).
//   --verificar       busca rutas colgantes (imports a archivos que no existen)
//                     y válida el mapa si se indica uno.
//   --limpiar-vacios  borra las carpetas vacías que queden bajo src/app.
//   --raiz <dir>      raíz del proyecto (por defecto, el directorio actual).
//
// FORMATO DEL MAPA
//   Objeto  { "origen": "destino", ... }
//   Lista   [ { "origen": "...", "destino": "..." }, ... ]
//   Rutas relativas a la raíz del proyecto, con "/" o "\". Las claves que
//   empiezan por "_" se ignoran (para notas). Si el origen es una carpeta se
//   mueve su contenido; si el destino termina en "/" se conserva el nombre.
//   El `*.spec.ts` de un archivo movido viaja con él sin necesidad de listarlo.
//
// QUÉ REESCRIBE (solo cadenas de ruta; nada más cambia)
//   - `import ... from`, `export ... from`, `import()` y `require()`: rutas
//     relativas y absolutas `src/app/...`.
//   - `templateUrl` y `styleUrls` de los componentes.
//   - `@use` / `@import` de SCSS con rutas relativas.
//   - `angular.json`, `tsconfig*.json` y `ngsw-config.json` si citan el archivo.
//   Conserva finales de línea, espacios y orden: el archivo se reescribe línea a
//   línea, cambiando únicamente las cadenas afectadas.
//
// GARANTÍAS
//   - El número de archivos no cambia (lo informa al terminar).
//   - `--verificar` comprueba que no queden rutas colgantes tras el movimiento.
//   - Se niega a ejecutar si un origen no existe, si dos archivos van al mismo
//     destino o si el destino ya está ocupado.

import fs from 'node:fs';
import path from 'node:path';

const RE_IMPORTACION = /(\bfrom\s*|\bimport\s*\(\s*|require\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\2/g;
const RE_COMPONENTE = /\b(templateUrl|styleUrls)\s*:\s*(\[[^\]]*\]|'[^'\n]*'|"[^"\n]*")/g;
const RE_SCSS = /@(?:use|import)\s+['"]([^'"\n]+)['"]/g;
const EXTENSIONES = ['.ts', '.js', '.mjs', '.html', '.scss', '.css', '.json'];
const CONFIGURACIONES = ['angular.json', 'ngsw-config.json'];
const IGNORAR = new Set(['node_modules', 'dist', 'www', '.angular', '.git', 'coverage', 'out-tsc']);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const aPosix = (ruta) => ruta.split(path.sep).join('/');
const existe = (ruta) => fs.existsSync(ruta);
const esArchivo = (ruta) => existe(ruta) && fs.statSync(ruta).isFile();

function recorrer(directorio, filtro = () => true, salida = []) {
  if (!existe(directorio)) return salida;
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) recorrer(ruta, filtro, salida);
    else if (filtro(ruta)) salida.push(ruta);
  }
  return salida;
}

// Escribe el archivo con el mismo contenido y, por tanto, con los mismos
// finales de línea que tenía el original.
function escribirArchivo(ruta, texto) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, texto, 'utf8');
}

// Quita comentarios de un .ts para no confundir ejemplos comentados con rutas
// reales; respeta cadenas simples, dobles y plantillas.
function sinComentarios(texto) {
  let salida = '';
  let i = 0;
  let comilla = null;
  while (i < texto.length) {
    const c = texto[i];
    const siguiente = texto[i + 1];
    if (comilla) {
      salida += c;
      if (c === '\\') {
        salida += siguiente ?? '';
        i += 2;
        continue;
      }
      if (c === comilla) comilla = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      comilla = c;
      salida += c;
      i += 1;
      continue;
    }
    if (c === '/' && siguiente === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && siguiente === '*') {
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) {
        if (texto[i] === '\n') salida += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }
    salida += c;
    i += 1;
  }
  return salida;
}

function numeroDeLinea(texto, indice) {
  let linea = 1;
  for (let i = 0; i < indice && i < texto.length; i += 1) if (texto[i] === '\n') linea += 1;
  return linea;
}

// Resuelve una cadena de ruta del proyecto (relativa o `src/...`) a archivo real.
function resolverEspecificador(especificador, archivo, raiz) {
  const esRelativa = especificador.startsWith('.');
  if (!esRelativa && !especificador.startsWith('src/')) return null;
  const base = esRelativa
    ? path.resolve(path.dirname(archivo), especificador)
    : path.resolve(raiz, especificador);
  const parcial = path.join(path.dirname(base), `_${path.basename(base)}.scss`);
  const candidatos = [base, ...EXTENSIONES.map((ext) => base + ext), parcial, path.join(base, 'index.ts')];
  return candidatos.find(esArchivo) ?? null;
}

// Devuelve la cadena de ruta equivalente desde el mismo archivo importador.
// `archivo` es la ubicación definitiva del importador (puede haberse movido).
function recomponerEspecificador(especificador, archivo, destino, raiz) {
  const llevaExtension = /\.(ts|js|mjs|html|scss|css|json)$/i.test(especificador);
  // Los parciales de SCSS se citan sin el guion bajo inicial (`tema`, no `_tema`).
  const baseOriginal = path.basename(especificador);
  const baseDestino = path.basename(destino);
  const destinoLogico =
    baseDestino.startsWith('_') && !baseOriginal.startsWith('_')
      ? path.join(path.dirname(destino), baseDestino.slice(1))
      : destino;

  let nuevo;
  if (especificador.startsWith('src/')) {
    nuevo = aPosix(path.relative(raiz, destinoLogico));
  } else {
    nuevo = aPosix(path.relative(path.dirname(archivo), destinoLogico));
    if (!nuevo.startsWith('.')) nuevo = `./${nuevo}`;
  }
  if (!llevaExtension) nuevo = nuevo.replace(/\.[^./]+$/, '');
  return nuevo;
}

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

function leerMapa(archivoMapa, raiz) {
  if (!esArchivo(archivoMapa)) {
    console.error(`No existe el mapa: ${archivoMapa}`);
    process.exit(1);
  }
  const contenido = JSON.parse(fs.readFileSync(archivoMapa, 'utf8'));
  const entradas = Array.isArray(contenido)
    ? contenido
    : Object.entries(contenido)
        .filter(([clave]) => !clave.startsWith('_'))
        .map(([origen, destino]) => ({ origen, destino }));

  const movimientos = new Map();
  const errores = [];

  const agregar = (origen, destino, motivo) => {
    const absoluto = path.resolve(raiz, origen);
    if (movimientos.has(absoluto)) return;
    movimientos.set(absoluto, { destino, motivo });
  };

  for (const entrada of entradas) {
    if (!entrada || typeof entrada.origen !== 'string' || typeof entrada.destino !== 'string') {
      errores.push(`Entrada inválida en el mapa: ${JSON.stringify(entrada)}`);
      continue;
    }
    const origen = path.resolve(raiz, entrada.origen);
    if (!existe(origen)) {
      errores.push(`No existe el origen: ${entrada.origen}`);
      continue;
    }

    if (fs.statSync(origen).isDirectory()) {
      const destinoCarpeta = path.resolve(raiz, entrada.destino);
      const archivos = recorrer(origen, () => true);
      for (const archivo of archivos) {
        const relativo = path.relative(origen, archivo);
        agregar(archivo, path.join(destinoCarpeta, relativo), entrada.origen);
      }
      if (archivos.length === 0) errores.push(`La carpeta de origen está vacía: ${entrada.origen}`);
      continue;
    }

    const destino = entrada.destino.endsWith('/') || entrada.destino.endsWith('\\')
      ? path.join(path.resolve(raiz, entrada.destino), path.basename(origen))
      : path.resolve(raiz, entrada.destino);
    agregar(origen, destino, entrada.origen);

    // RN-07: el spec viaja con su archivo.
    if (origen.endsWith('.ts') && !origen.endsWith('.spec.ts')) {
      const spec = `${origen.slice(0, -3)}.spec.ts`;
      if (esArchivo(spec)) {
        agregar(spec, path.join(path.dirname(destino), path.basename(spec)), entrada.origen);
      }
    }
  }

  const destinos = new Map();
  for (const [origen, { destino }] of movimientos) {
    if (origen === destino) {
      errores.push(`Origen y destino son iguales: ${aPosix(path.relative(raiz, origen))}`);
      continue;
    }
    if (destinos.has(destino)) {
      errores.push(
        `Dos archivos van al mismo destino: ${aPosix(path.relative(raiz, destino))} (${aPosix(path.relative(raiz, origen))} y ${aPosix(path.relative(raiz, destinos.get(destino)))})`,
      );
      continue;
    }
    destinos.set(destino, origen);
    if (existe(destino)) {
      errores.push(`El destino ya existe: ${aPosix(path.relative(raiz, destino))}`);
    }
  }

  return { movimientos, errores };
}

// ---------------------------------------------------------------------------
// Reescritura de referencias
// ---------------------------------------------------------------------------

function calcularReescrituras(raiz, movimientos) {
  const archivos = [
    ...recorrer(path.join(raiz, 'src'), (ruta) => ruta.endsWith('.ts') || ruta.endsWith('.scss')),
    ...CONFIGURACIONES.filter((nombre) => esArchivo(path.join(raiz, nombre))).map((nombre) => path.join(raiz, nombre)),
    ...recorrer(raiz, (ruta) => /(^|[\\/])tsconfig[^\\/]*\.json$/.test(ruta), []),
  ];

  const reescrituras = new Map(); // archivo -> { texto, reemplazos[] }

  for (const archivo of archivos) {
    const original = fs.readFileSync(archivo, 'utf8');
    const reemplazos = [];
    // Si el propio archivo se mueve, las rutas relativas se recalculan desde su
    // ubicación definitiva.
    const ubicacionFinal = movimientos.get(archivo)?.destino ?? archivo;

    const reescribir = (especificador) => {
      const destino = resolverEspecificador(especificador, archivo, raiz);
      if (!destino) return null;
      // El destino puede no moverse y la ruta relativa aun así cambiar, porque
      // quien importa sí se ha movido (p. ej. `compartidos/alerta-ck` pasa a
      // `compartidos/componentes/alerta-ck` y debe subir un nivel más).
      const destinoFinal = movimientos.get(destino)?.destino ?? destino;
      const nuevo = recomponerEspecificador(especificador, ubicacionFinal, destinoFinal, raiz);
      if (nuevo === especificador) return null;
      reemplazos.push({ de: especificador, a: nuevo, destino });
      return nuevo;
    };

    let texto = original;

    if (archivo.endsWith('.ts')) {
      texto = texto.replace(RE_IMPORTACION, (todo, prefijo, comilla, especificador) => {
        const nuevo = reescribir(especificador);
        return nuevo ? `${prefijo}${comilla}${nuevo}${comilla}` : todo;
      });
      texto = texto.replace(RE_COMPONENTE, (todo, clave, valor) => {
        const nuevoValor = valor.replace(/(['"])([^'"\n]+)\1/g, (cadena, comilla, especificador) => {
          const nuevo = reescribir(especificador);
          return nuevo ? `${comilla}${nuevo}${comilla}` : cadena;
        });
        return nuevoValor === valor ? todo : todo.replace(valor, () => nuevoValor);
      });
    } else if (archivo.endsWith('.scss')) {
      texto = texto.replace(RE_SCSS, (todo, especificador) => {
        const nuevo = reescribir(especificador);
        return nuevo ? todo.replace(especificador, nuevo) : todo;
      });
    } else {
      // Configuración JSON: se sustituye la ruta literal del proyecto si aparece.
      for (const [origen, { destino }] of movimientos) {
        const de = aPosix(path.relative(raiz, origen));
        const a = aPosix(path.relative(raiz, destino));
        if (texto.includes(de)) {
          const veces = texto.split(de).length - 1;
          texto = texto.split(de).join(a);
          reemplazos.push({ de, a, veces });
        }
      }
    }

    if (texto !== original) {
      const lineasOriginal = original.split(/\r?\n/);
      const lineasNuevas = texto.split(/\r?\n/);
      let lineasCambiadas = 0;
      for (let i = 0; i < Math.max(lineasOriginal.length, lineasNuevas.length); i += 1) {
        if (lineasOriginal[i] !== lineasNuevas[i]) lineasCambiadas += 1;
      }
      reescrituras.set(archivo, {
        texto,
        reemplazos,
        lineasCambiadas,
      });
    }
  }

  return reescrituras;
}

// ---------------------------------------------------------------------------
// Verificación de rutas colgantes
// ---------------------------------------------------------------------------

function especificadoresDe(archivo, texto) {
  const lista = [];
  const agregar = (especificador, indice) => {
    if (!especificador.startsWith('.') && !especificador.startsWith('src/')) return;
    lista.push({ especificador, linea: numeroDeLinea(texto, indice) });
  };

  if (archivo.endsWith('.ts')) {
    const limpio = sinComentarios(texto);
    for (const coincidencia of limpio.matchAll(RE_IMPORTACION)) {
      agregar(coincidencia[3], coincidencia.index);
    }
    for (const coincidencia of limpio.matchAll(RE_COMPONENTE)) {
      for (const cadena of coincidencia[2].matchAll(/(['"])([^'"\n]+)\1/g)) {
        agregar(cadena[2], coincidencia.index);
      }
    }
  } else if (archivo.endsWith('.scss')) {
    for (const coincidencia of texto.matchAll(RE_SCSS)) {
      agregar(coincidencia[1], coincidencia.index);
    }
  }

  return lista;
}

function verificar(raiz) {
  const archivos = recorrer(path.join(raiz, 'src'), (ruta) => ruta.endsWith('.ts') || ruta.endsWith('.scss'));
  const colgantes = [];
  let comprobadas = 0;

  for (const archivo of archivos) {
    const texto = fs.readFileSync(archivo, 'utf8');
    for (const { especificador, linea } of especificadoresDe(archivo, texto)) {
      comprobadas += 1;
      if (!resolverEspecificador(especificador, archivo, raiz)) {
        colgantes.push({ archivo: aPosix(path.relative(raiz, archivo)), linea, especificador });
      }
    }
  }

  console.log(`Rutas comprobadas: ${comprobadas}`);
  if (colgantes.length === 0) {
    console.log('Sin rutas colgantes.');
    return 0;
  }
  console.log(`Rutas colgantes: ${colgantes.length}`);
  for (const colgante of colgantes) {
    console.log(`  ${colgante.archivo}:${colgante.linea}  ${colgante.especificador}`);
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

function purgarCarpetasVacias(directorio, raiz, borradas = []) {
  if (!existe(directorio)) return borradas;
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    if (!entrada.isDirectory() || IGNORAR.has(entrada.name)) continue;
    purgarCarpetasVacias(path.join(directorio, entrada.name), raiz, borradas);
  }
  if (directorio !== raiz && fs.readdirSync(directorio).length === 0) {
    fs.rmdirSync(directorio);
    borradas.push(aPosix(path.relative(raiz, directorio)));
  }
  return borradas;
}

function contarArchivos(directorio) {
  return recorrer(directorio).length;
}

// Crea la carpeta del destino componente a componente. En sistemas de archivos
// que no distinguen mayúsculas (Windows, macOS) un directorio preexistente con
// otro uso de mayúsculas se reutiliza conservando su nombre; se renombra para
// que la ruta real coincida con la del mapa (si no, TypeScript falla con TS1149).
function asegurarDirectorio(directorio, raiz) {
  const relativo = path.relative(raiz, directorio);
  if (!relativo || relativo.startsWith('..')) {
    fs.mkdirSync(directorio, { recursive: true });
    return;
  }
  let actual = raiz;
  for (const parte of relativo.split(path.sep)) {
    const candidato = path.join(actual, parte);
    if (!existe(candidato)) {
      fs.mkdirSync(candidato);
    } else if (fs.readdirSync(actual).includes(parte) === false) {
      const previo = fs
        .readdirSync(actual)
        .find((nombre) => nombre.toLowerCase() === parte.toLowerCase());
      if (previo) fs.renameSync(path.join(actual, previo), candidato);
    }
    actual = candidato;
  }
}

function principal() {
  const argumentos = process.argv.slice(2);
  const banderas = new Set(argumentos.filter((a) => a.startsWith('--')));
  const conValor = argumentos.findIndex((a) => a === '--raiz');
  const raiz = path.resolve(conValor >= 0 ? argumentos[conValor + 1] : '.');
  const archivoMapa = argumentos.find((a, indice) => !a.startsWith('--') && argumentos[indice - 1] !== '--raiz');

  const aplicar = banderas.has('--aplicar');
  const simular = banderas.has('--simular') || !aplicar;

  console.log(`Raíz del proyecto: ${raiz}`);
  if (archivoMapa) console.log(`Mapa: ${aPosix(path.relative(raiz, path.resolve(raiz, archivoMapa)))}`);

  let codigo = 0;

  if (banderas.has('--verificar') && !archivoMapa) {
    codigo = verificar(raiz);
    if (codigo !== 0) process.exit(codigo);
    return;
  }

  if (!archivoMapa) {
    console.log('Nada que hacer: indica un mapa JSON o usa --verificar. Ver la cabecera del archivo para el uso.');
    process.exit(1);
  }

  const { movimientos, errores } = leerMapa(archivoMapa, raiz);
  if (errores.length > 0) {
    console.error(`\nEl mapa tiene ${errores.length} problema(s):`);
    errores.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  const reescrituras = calcularReescrituras(raiz, movimientos);
  const archivosAntes = contarArchivos(path.join(raiz, 'src'));

  console.log(`\nMovimientos: ${movimientos.size}`);
  for (const [origen, { destino }] of [...movimientos].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${aPosix(path.relative(raiz, origen))}`);
    console.log(`    -> ${aPosix(path.relative(raiz, destino))}`);
  }

  let lineasTotales = 0;
  let reemplazosTotales = 0;
  console.log(`\nArchivos con referencias a reescribir: ${reescrituras.size}`);
  for (const [archivo, { reemplazos, lineasCambiadas }] of [...reescrituras].sort(([a], [b]) => a.localeCompare(b))) {
    lineasTotales += lineasCambiadas;
    reemplazosTotales += reemplazos.length;
    console.log(`  ${aPosix(path.relative(raiz, archivo))} (${lineasCambiadas} línea(s))`);
    for (const reemplazo of new Set(reemplazos.map((r) => `${r.de} -> ${r.a}`))) {
      console.log(`      ${reemplazo}`);
    }
  }
  console.log(`\nTotal: ${movimientos.size} archivo(s) movido(s), ${lineasTotales} línea(s) reescrita(s) en ${reescrituras.size} archivo(s).`);

  if (simular) {
    console.log('Modo simulación: no se ha escrito nada. Usa --aplicar para ejecutar.');
  } else {
    for (const [origen, { destino }] of movimientos) {
      asegurarDirectorio(path.dirname(destino), raiz);
      try {
        fs.renameSync(origen, destino);
      } catch (error) {
        if (error.code !== 'EXDEV') throw error;
        fs.copyFileSync(origen, destino);
        fs.unlinkSync(origen);
      }
    }
    // Las reescrituras se guardan en memoria antes de mover: se escriben en su
    // ubicación definitiva.
    for (const [archivo, { texto }] of reescrituras) {
      const movimiento = movimientos.get(archivo);
      escribirArchivo(movimiento ? movimiento.destino : archivo, texto);
    }
    console.log('Movimientos y reescrituras aplicados.');
  }

  const archivosDespues = simular ? archivosAntes : contarArchivos(path.join(raiz, 'src'));
  console.log(`Archivos bajo src/: ${archivosAntes} antes, ${archivosDespues} después.`);

  if (banderas.has('--limpiar-vacios') && !simular) {
    const borradas = purgarCarpetasVacias(path.join(raiz, 'src', 'app'), path.join(raiz, 'src', 'app'));
    console.log(`Carpetas vacías eliminadas: ${borradas.length}`);
    borradas.forEach((carpeta) => console.log(`  ${carpeta}`));
  }

  if (banderas.has('--verificar')) {
    console.log('');
    codigo = verificar(raiz);
  }

  if (!simular && archivosAntes !== archivosDespues) {
    console.error('El número de archivos cambió: revisa el mapa.');
    codigo = 1;
  }

  process.exit(codigo);
}

principal();
