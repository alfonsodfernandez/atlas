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
const mapFile = 'atlas-map.png';
const detailMapFile = 'atlas-map-detail.png';
const mapFiles = await readdir(mapDirectory);
if (
  mapFiles.length !== 2 ||
  !mapFiles.includes(mapFile) ||
  !mapFiles.includes(detailMapFile)
)
  throw new Error('maps/ debe contener las máscaras general y de detalle.');
const [mapBytes, detailMapBytes] = await Promise.all(
  [mapFile, detailMapFile].map(async (name) => {
    const file = await stat(new URL(name, mapDirectory));
    if (!file.isFile() || file.size === 0)
      throw new Error(`Máscara no válida: ${name}`);
    return file.size;
  }),
);
const report = {
  javascript,
  styles,
  javascriptBytes: sum(javascript, 'bytes'),
  javascriptGzipBytes: sum(javascript, 'gzipBytes'),
  cssGzipBytes: sum(styles, 'gzipBytes'),
  maps: { [mapFile]: mapBytes, [detailMapFile]: detailMapBytes },
  detailMapBytes,
  initialPayloadGzipEstimateBytes:
    sum(javascript, 'gzipBytes') + sum(styles, 'gzipBytes') + mapBytes,
  budgets: {
    javascriptBytes: 40_960,
    javascriptGzipBytes: 15_360,
    initialPayloadGzipEstimateBytes: 45_056,
    detailMapBytes: 65_536,
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
