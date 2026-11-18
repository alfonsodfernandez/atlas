import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check'))
  throw new Error('Uso: node scripts/prepare-map.mjs [--check]');

const WIDTH = 1024;
const HEIGHT = 512;
const SAMPLES = 4;
const SCAN_WIDTH = WIDTH * SAMPLES;
const SCAN_HEIGHT = HEIGHT * SAMPLES;
const countries = new Uint8Array(SCAN_WIDTH * SCAN_HEIGHT);

const geometry = new URL('./geo/ne-110m-countries.json', import.meta.url);
const output = new URL('../public/maps/atlas-map.png', import.meta.url);
const { format, version, scale, features } = JSON.parse(
  await readFile(geometry, 'utf8'),
);
if (
  format !== 'ATLAS-NE110M' ||
  version !== 1 ||
  scale !== 10_000 ||
  features.length !== 177
)
  throw new Error('Fuente Natural Earth incompatible.');

function rasterize(polygon, country) {
  // Natural Earth already splits polygons along the antimeridian. The
  // Antarctic ring uses both sides of the projection along the south pole.
  const edges = [];
  let top = SCAN_HEIGHT;
  let bottom = 0;
  for (const ring of polygon) {
    let longitude = 0;
    let latitude = 0;
    const points = [];
    for (let index = 0; index < ring.length; index += 2) {
      longitude += ring[index];
      latitude += ring[index + 1];
      points.push([
        (longitude / scale + 180) * (SCAN_WIDTH / 360),
        (90 - latitude / scale) * (SCAN_HEIGHT / 180),
      ]);
    }
    for (let index = 0; index < points.length; index += 1) {
      let [x, y] = points[index];
      let [endX, endY] = points[(index + 1) % points.length];
      if (y === endY) continue;
      if (y > endY) {
        [x, endX] = [endX, x];
        [y, endY] = [endY, y];
      }
      top = Math.min(top, Math.ceil(y - 0.5));
      bottom = Math.max(bottom, Math.ceil(endY - 0.5));
      edges.push({ x, y, endY, slope: (endX - x) / (endY - y) });
    }
  }

  const crossings = [];
  for (let row = top; row < bottom; row += 1) {
    const center = row + 0.5;
    crossings.length = 0;
    for (const edge of edges) {
      if (edge.y <= center && center < edge.endY)
        crossings.push(edge.x + (center - edge.y) * edge.slope);
    }
    crossings.sort((a, b) => a - b);
    const offset = row * SCAN_WIDTH;
    // Even–odd fill counts interior rings as holes.
    for (let index = 0; index < crossings.length; index += 2) {
      const start = Math.max(0, Math.ceil(crossings[index] - 0.5));
      const end = Math.min(SCAN_WIDTH, Math.ceil(crossings[index + 1] - 0.5));
      countries.fill(country, offset + start, offset + end);
    }
  }
}

for (const [index, feature] of features.entries()) {
  for (const polygon of feature.polygons) rasterize(polygon, index + 1);
}

const landCoverage = new Uint8Array(WIDTH * HEIGHT);
const borderCoverage = new Uint8Array(WIDTH * HEIGHT);
const differs = (other, country) => other !== 0 && other !== country;
for (let y = 0; y < SCAN_HEIGHT; y += 1) {
  const row = y * SCAN_WIDTH;
  const above = Math.max(y - 1, 0) * SCAN_WIDTH;
  const below = Math.min(y + 1, SCAN_HEIGHT - 1) * SCAN_WIDTH;
  const target = Math.floor(y / SAMPLES) * WIDTH;

  for (let x = 0; x < SCAN_WIDTH; x += 1) {
    const country = countries[row + x];
    if (!country) continue;
    const pixel = target + Math.floor(x / SAMPLES);
    landCoverage[pixel] += 1;

    const left = x === 0 ? SCAN_WIDTH - 1 : x - 1;
    const right = x === SCAN_WIDTH - 1 ? 0 : x + 1;
    // A coast only contributes to land coverage. Borders require land from
    // two different countries, including where the map wraps horizontally.
    if (
      differs(countries[row + left], country) ||
      differs(countries[row + right], country) ||
      differs(countries[above + x], country) ||
      differs(countries[below + x], country)
    ) {
      borderCoverage[pixel] += 1;
    }
  }
}

const palette = Buffer.alloc(16 * 3);
for (let index = 0; index < 16; index += 1) {
  palette[index * 3] = (index >> 2) * 85;
  palette[index * 3 + 1] = (index & 3) * 85;
}

const stride = WIDTH / 2 + 1;
const rows = Buffer.alloc(stride * HEIGHT);
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const pixel = y * WIDTH + x;
    const land = Math.round((landCoverage[pixel] * 3) / (SAMPLES * SAMPLES));
    // Two subpixel sides form a short, soft stroke at world scale.
    const border = Math.min(
      3,
      Math.round((borderCoverage[pixel] * 6) / (SAMPLES * SAMPLES)),
    );
    const index = (land << 2) | border;
    rows[y * stride + 1 + (x >> 1)] |= index << (x % 2 === 0 ? 4 : 0);
  }
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(type, data) {
  const result = Buffer.alloc(data.byteLength + 12);
  result.writeUInt32BE(data.byteLength, 0);
  result.write(type, 4, 'ascii');
  data.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, -4))
    crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.byteLength - 4);
  return result;
}

const header = Buffer.alloc(13);
header.writeUInt32BE(WIDTH, 0);
header.writeUInt32BE(HEIGHT, 4);
header[8] = 4;
header[9] = 3;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('PLTE', palette),
  chunk('IDAT', deflateSync(rows, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
if (png.byteLength > 26 * 1024)
  throw new Error('La máscara supera los 26 KiB.');
if (args[0] === '--check') {
  if (!(await readFile(output)).equals(png))
    throw new Error('Regenera el PNG con node scripts/prepare-map.mjs.');
} else {
  await writeFile(output, png);
}
process.stdout.write(
  `ATLAS: ${WIDTH}×${HEIGHT}, ${png.byteLength} bytes, SHA-256 ${createHash('sha256').update(png).digest('hex')}\n`,
);
