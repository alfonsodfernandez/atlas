import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

// This display asset is derived only from the pinned public Natural Earth data.
// It never reads a Timeline export or the user's private configuration.
const maps = new URL('../public/maps/', import.meta.url);
const sourceBytes = await readFile(new URL('countries.geojson', maps));
const sources = JSON.parse(
  await readFile(new URL('sources.json', maps), 'utf8'),
);
const source = JSON.parse(sourceBytes.toString('utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceHash = digest(sourceBytes);

if (sourceHash !== sources.countries.sha256) {
  throw new Error('La cartografía no coincide con su procedencia SHA-256.');
}
if (
  source.type !== 'FeatureCollection' ||
  !Array.isArray(source.features) ||
  source.features.length !== sources.countries.featureCount ||
  source.features.length === 0 ||
  source.features.length > 1024
) {
  throw new Error('La colección de países no coincide con la versión fijada.');
}

const rings = [];
let pointCount = 0;
for (const feature of source.features) {
  const geometry = feature.geometry;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw new Error('La cartografía debe contener únicamente polígonos.');
  }
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || ring.length > 1_000_000) {
        throw new Error('Se ha encontrado un anillo no válido.');
      }
      const first = ring[0];
      const last = ring.at(-1);
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error('La cartografía contiene un anillo abierto.');
      }
      const quantized = ring.map(([longitude, latitude]) => {
        if (
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude) ||
          Math.abs(longitude) > 180 ||
          Math.abs(latitude) > 90
        ) {
          throw new Error('La cartografía contiene una coordenada no válida.');
        }
        return [
          Math.round((longitude / 180) * 32767),
          Math.round((latitude / 90) * 32767),
        ];
      });
      if (new Set(quantized.map((point) => point.join(','))).size < 3) {
        throw new Error(
          'La cuantización ha hecho degenerar una isla o anillo.',
        );
      }
      let area = 0;
      for (let index = 1; index < quantized.length; index += 1) {
        const previous = quantized[index - 1];
        const current = quantized[index];
        area += previous[0] * current[1] - current[0] * previous[1];
      }
      if (area === 0) {
        throw new Error('La cuantización ha eliminado el área de un anillo.');
      }
      rings.push(quantized);
      pointCount += ring.length;
    }
  }
}
if (rings.length > 100_000 || pointCount > 2_000_000) {
  throw new Error(
    'La cartografía supera los límites del formato de visualización.',
  );
}

// ATLB v1, all integer fields little endian. Header 24 B, ring lengths, lon/lat.
const headerBytes = 24;
const borderBytes = Buffer.alloc(
  headerBytes + rings.length * 4 + pointCount * 4,
);
borderBytes.write('ATLB', 0, 4, 'ascii');
borderBytes.writeUInt16LE(1, 4);
borderBytes.writeUInt16LE(0, 6);
borderBytes.writeUInt32LE(source.features.length, 8);
borderBytes.writeUInt32LE(rings.length, 12);
borderBytes.writeUInt32LE(pointCount, 16);
borderBytes.writeUInt32LE(0, 20);
let coordinateOffset = headerBytes + rings.length * 4;
for (const [index, ring] of rings.entries()) {
  borderBytes.writeUInt32LE(ring.length, headerBytes + index * 4);
  for (const [longitude, latitude] of ring) {
    borderBytes.writeInt16LE(longitude, coordinateOffset);
    borderBytes.writeInt16LE(latitude, coordinateOffset + 2);
    coordinateOffset += 4;
  }
}

const metadata = {
  generatedBy: 'node scripts/prepare-borders.mjs',
  format: 'ATLB',
  version: 1,
  file: 'borders.bin',
  bytes: borderBytes.byteLength,
  sha256: digest(borderBytes),
  source: { file: 'countries.geojson', sha256: sourceHash },
  dataset: sources.countries.dataset,
  license: sources.countries.license,
  licenseUrl: sources.countries.licenseUrl,
  credit: sources.countries.credit,
  countryCount: source.features.length,
  ringCount: rings.length,
  pointCount,
  displayOnly: true,
  quantization: {
    integerMin: -32767,
    integerMax: 32767,
    longitudeMaxErrorDegrees: 180 / 32767 / 2,
    latitudeMaxErrorDegrees: 90 / 32767 / 2,
  },
};
const metadataBytes = await format(JSON.stringify(metadata), {
  parser: 'json',
});
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  throw new Error('Uso: node scripts/prepare-borders.mjs [--check]');
}
if (args[0] === '--check') {
  const [existingBorders, existingMetadata] = await Promise.all([
    readFile(new URL('borders.bin', maps)),
    readFile(new URL('borders-source.json', maps), 'utf8'),
  ]);
  if (
    !existingBorders.equals(borderBytes) ||
    existingMetadata !== metadataBytes
  ) {
    throw new Error(
      'Regenera las fronteras con node scripts/prepare-borders.mjs.',
    );
  }
} else {
  await Promise.all([
    writeFile(new URL('borders.bin', maps), borderBytes),
    writeFile(new URL('borders-source.json', maps), metadataBytes),
  ]);
}
process.stdout.write(
  `ATLB v1: ${source.features.length} entidades, ${rings.length} anillos, ${pointCount} puntos, ${borderBytes.byteLength} bytes.\n`,
);
