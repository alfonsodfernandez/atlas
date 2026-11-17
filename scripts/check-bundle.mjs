import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const build = new URL('../apps/web/dist/', import.meta.url);
const assets = new URL('assets/', build);
const javascript = [];
const styles = [];
for (const name of await readdir(assets)) {
  if (!/\.(?:js|css)$/.test(name)) continue;
  const bytes = await readFile(new URL(name, assets));
  const entry = {
    name,
    bytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes).byteLength,
  };
  if (name.endsWith('.js')) javascript.push(entry);
  else styles.push(entry);
}
const sum = (entries, key) =>
  entries.reduce((total, entry) => total + entry[key], 0);
const mapDirectory = new URL('maps/', build);
const mapFile = 'atlas-earth.png';
const mapFiles = await readdir(mapDirectory);
if (mapFiles.some((name) => name !== mapFile && name !== 'ATLAS-EARTH.md'))
  throw new Error('El build contiene cartografía distinta a la de ATLAS.');
const mapBytes = (await stat(new URL(mapFile, mapDirectory))).size;
const report = {
  javascript,
  styles,
  javascriptBytes: sum(javascript, 'bytes'),
  javascriptGzipBytes: sum(javascript, 'gzipBytes'),
  cssGzipBytes: sum(styles, 'gzipBytes'),
  maps: { [mapFile]: mapBytes },
  initialPayloadGzipEstimateBytes:
    sum(javascript, 'gzipBytes') + sum(styles, 'gzipBytes') + mapBytes,
  budgets: {
    javascriptBytes: 49_152,
    javascriptGzipBytes: 20_480,
    initialPayloadGzipEstimateBytes: 65_536,
  },
};
if (javascript.length === 0)
  throw new Error('El build no contiene JavaScript.');
for (const [metric, limit] of Object.entries(report.budgets)) {
  if (report[metric] > limit)
    throw new Error(
      `Presupuesto de ${metric} excedido: ${report[metric]} > ${limit}`,
    );
}
try {
  await stat(new URL('cesium/', build));
  throw new Error('El build conserva archivos de Cesium.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const args = process.argv.slice(2);
if (args.length > 0) {
  if (args[0] !== '--report' || args.length !== 2)
    throw new Error('Uso: node scripts/check-bundle.mjs [--report <archivo>]');
  await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(
  `${JSON.stringify({ ...report, directory: fileURLToPath(build) })}\n`,
);
