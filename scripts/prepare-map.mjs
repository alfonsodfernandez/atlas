import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check'))
  throw new Error('Uso: node scripts/prepare-map.mjs [--check]');

const SAMPLES = 2;
const LAND_SPREAD = 0.85;
const BORDER_SPREAD = 0.8;
const PAD = 6;
const INF = 1e12;
const DEMO_COUNTRIES = new Set(['ESP', 'MEX', 'JPN']);
const variants = [
  {
    source: 'ne-110m-countries.json',
    sourceHash:
      '575780ac48578f66f4eefe661b6b7dd3ae1166c8e7e7984239a9835f0c261206',
    format: 'ATLAS-NE110M',
    featureCount: 177,
    file: 'atlas-map.png',
    width: 1024,
    height: 512,
    budget: 24 * 1024,
    levels: 4,
  },
  {
    source: 'ne-50m-countries.json',
    sourceHash:
      '4e7768a3f63f471573274f44acb48bf0e0cdccfa108adac79b8094690e03ace7',
    format: 'ATLAS-NE50M',
    featureCount: 242,
    file: 'atlas-map-detail.png',
    width: 2048,
    height: 1024,
    budget: 64 * 1024,
    levels: 4,
  },
];

function edt1d(f, d, v, z, n) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q += 1) {
    const fq = f[q];
    if (fq >= INF) continue;
    let s;
    for (;;) {
      const vk = v[k];
      s = (fq + q * q - (f[vk] + vk * vk)) / (2 * q - 2 * vk);
      if (s <= z[k] && k > 0) {
        k -= 1;
      } else {
        break;
      }
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const dx = q - v[k];
    d[q] = dx * dx + f[v[k]];
  }
}

/**
 * Exact 2D Euclidean Distance Transform with horizontal wrap-around across the
 * antimeridian (±180°). Returns squared distance to the nearest pixel where
 * `mask[i] === target`.
 */
function edt2dWrapped(mask, width, height, target) {
  const grid = new Float32Array(width * height);
  const maxDim = Math.max(width + PAD * 2, height);
  const f = new Float64Array(maxDim);
  const d = new Float64Array(maxDim);
  const v = new Int32Array(maxDim);
  const z = new Float64Array(maxDim + 1);

  for (let x = 0; x < width; x += 1) {
    let any = false;
    for (let y = 0; y < height; y += 1) {
      const hit = mask[y * width + x] === target;
      f[y] = hit ? 0 : INF;
      if (hit) any = true;
    }
    if (!any) {
      for (let y = 0; y < height; y += 1) grid[y * width + x] = INF;
      continue;
    }
    edt1d(f, d, v, z, height);
    for (let y = 0; y < height; y += 1) grid[y * width + x] = d[y];
  }

  const paddedWidth = width + PAD * 2;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let any = false;
    for (let p = 0; p < PAD; p += 1) {
      const leftVal = grid[row + width - PAD + p];
      const rightVal = grid[row + p];
      f[p] = leftVal;
      f[PAD + width + p] = rightVal;
      if (leftVal < INF || rightVal < INF) any = true;
    }
    for (let x = 0; x < width; x += 1) {
      const val = grid[row + x];
      f[PAD + x] = val;
      if (val < INF) any = true;
    }
    if (!any) continue;
    edt1d(f, d, v, z, paddedWidth);
    for (let x = 0; x < width; x += 1) grid[row + x] = d[PAD + x];
  }
  return grid;
}

function render(
  { width: WIDTH, height: HEIGHT, levels: MAX_LEVEL },
  { scale, features },
) {
  const SCAN_WIDTH = WIDTH * SAMPLES;
  const SCAN_HEIGHT = HEIGHT * SAMPLES;
  const countries = new Uint16Array(SCAN_WIDTH * SCAN_HEIGHT);

  function rasterize(polygon, country) {
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

  const demoIds = new Uint8Array(features.length + 1);
  for (const [index, feature] of features.entries()) {
    if (DEMO_COUNTRIES.has(feature.id)) demoIds[index + 1] = 1;
  }
  if (demoIds.reduce((sum, value) => sum + value, 0) !== DEMO_COUNTRIES.size)
    throw new Error(
      'La fuente debe contener las tres entidades de demostración.',
    );

  const totalScan = SCAN_WIDTH * SCAN_HEIGHT;
  const landMask = new Uint8Array(totalScan);
  const demoMask = new Uint8Array(totalScan);
  const borderMask = new Uint8Array(totalScan);
  const differs = (other, country) => other !== 0 && other !== country;

  for (let y = 0; y < SCAN_HEIGHT; y += 1) {
    const row = y * SCAN_WIDTH;
    const above = Math.max(y - 1, 0) * SCAN_WIDTH;
    const below = Math.min(y + 1, SCAN_HEIGHT - 1) * SCAN_WIDTH;
    for (let x = 0; x < SCAN_WIDTH; x += 1) {
      const country = countries[row + x];
      if (!country) continue;
      landMask[row + x] = 1;
      if (demoIds[country]) demoMask[row + x] = 1;
      const left = x === 0 ? SCAN_WIDTH - 1 : x - 1;
      const right = x === SCAN_WIDTH - 1 ? 0 : x + 1;
      if (
        differs(countries[row + left], country) ||
        differs(countries[row + right], country) ||
        differs(countries[above + x], country) ||
        differs(countries[below + x], country)
      ) {
        borderMask[row + x] = 1;
      }
    }
  }

  const landDistIn = edt2dWrapped(landMask, SCAN_WIDTH, SCAN_HEIGHT, 0);
  const landDistOut = edt2dWrapped(landMask, SCAN_WIDTH, SCAN_HEIGHT, 1);
  const demoDistIn = edt2dWrapped(demoMask, SCAN_WIDTH, SCAN_HEIGHT, 0);
  const demoDistOut = edt2dWrapped(demoMask, SCAN_WIDTH, SCAN_HEIGHT, 1);
  const borderDist = edt2dWrapped(borderMask, SCAN_WIDTH, SCAN_HEIGHT, 1);

  const invSamples = 1 / SAMPLES;
  const invSamplesSq = 1 / (SAMPLES * SAMPLES);
  const stride = WIDTH + 1;
  const rows = Buffer.alloc(stride * HEIGHT);

  // Build compact indexed palette (<= 256 entries) for all quantized SDF triples
  const paletteMap = new Map();
  const paletteEntries = [];
  const getColorIndex = (l, b, d) => {
    const key = (l << 8) | (b << 4) | d;
    let idx = paletteMap.get(key);
    if (idx === undefined) {
      if (paletteEntries.length >= 256) {
        // Fallback: snap border to nearest even level if palette fills
        const snappedKey = (l << 8) | ((b & ~1) << 4) | d;
        idx = paletteMap.get(snappedKey);
        if (idx !== undefined) return idx;
        return 0;
      }
      idx = paletteEntries.length;
      paletteMap.set(key, idx);
      paletteEntries.push([
        Math.round((l * 255) / MAX_LEVEL),
        Math.round((b * 255) / MAX_LEVEL),
        Math.round((d * 255) / MAX_LEVEL),
      ]);
    }
    return idx;
  };
  // Reserve 0 for deep ocean (0,0,0) and 1 for deep land (255,0,0)
  getColorIndex(0, 0, 0);
  getColorIndex(MAX_LEVEL, 0, 0);

  for (let y = 0; y < HEIGHT; y += 1) {
    const rowOut = y * stride + 1;
    for (let x = 0; x < WIDTH; x += 1) {
      let landSdSum = 0;
      let demoSdSum = 0;
      let borderMinDist = INF;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        const scanRow = (y * SAMPLES + sy) * SCAN_WIDTH + x * SAMPLES;
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const i = scanRow + sx;
          landSdSum += landMask[i]
            ? Math.sqrt(landDistIn[i]) - 0.5
            : -(Math.sqrt(landDistOut[i]) - 0.5);
          demoSdSum += demoMask[i]
            ? Math.sqrt(demoDistIn[i]) - 0.5
            : -(Math.sqrt(demoDistOut[i]) - 0.5);
          if (borderDist[i] < borderMinDist) borderMinDist = borderDist[i];
        }
      }

      const landSd = landSdSum * invSamplesSq * invSamples;
      const demoSd = demoSdSum * invSamplesSq * invSamples;
      const bDist = Math.sqrt(borderMinDist) * invSamples;

      const l = Math.max(
        0,
        Math.min(
          MAX_LEVEL,
          Math.round((0.5 + (landSd / LAND_SPREAD) * 0.5) * MAX_LEVEL),
        ),
      );
      const b = Math.max(
        0,
        Math.min(
          MAX_LEVEL,
          Math.round((1 - bDist / BORDER_SPREAD) * MAX_LEVEL),
        ),
      );
      const dRaw = Math.max(
        0,
        Math.min(
          MAX_LEVEL,
          Math.round((0.5 + (demoSd / LAND_SPREAD) * 0.5) * MAX_LEVEL),
        ),
      );
      // Keep demo SDF strictly within land SDF so visited coastlines align seamlessly.
      const d = Math.min(l, dRaw);

      rows[rowOut + x] = getColorIndex(l, b, d);
    }
  }

  const palette = Buffer.alloc(paletteEntries.length * 3);
  for (let i = 0; i < paletteEntries.length; i += 1) {
    palette[i * 3] = paletteEntries[i][0];
    palette[i * 3 + 1] = paletteEntries[i][1];
    palette[i * 3 + 2] = paletteEntries[i][2];
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 3;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('PLTE', palette),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
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

for (const variant of variants) {
  const source = await readFile(
    new URL(`./geo/${variant.source}`, import.meta.url),
  );
  if (createHash('sha256').update(source).digest('hex') !== variant.sourceHash)
    throw new Error(`La fuente ${variant.source} no coincide con su SHA-256.`);
  const geometry = JSON.parse(source.toString('utf8'));
  if (
    geometry.format !== variant.format ||
    geometry.version !== 1 ||
    geometry.scale !== 10_000 ||
    geometry.features?.length !== variant.featureCount ||
    geometry.features.length >= 65_535
  )
    throw new Error('Fuente Natural Earth incompatible.');
  const png = render(variant, geometry);
  process.stdout.write(
    `ATLAS ${variant.file}: ${variant.width}×${variant.height}, ${png.byteLength} bytes, SHA-256 ${createHash('sha256').update(png).digest('hex')}\n`,
  );
  if (png.byteLength > variant.budget)
    throw new Error(
      `La máscara ${variant.file} supera su presupuesto (${png.byteLength} > ${variant.budget}).`,
    );
  const output = new URL(`../public/maps/${variant.file}`, import.meta.url);
  if (args[0] === '--check') {
    if (!(await readFile(output)).equals(png))
      throw new Error('Regenera los PNG con node scripts/prepare-map.mjs.');
  } else {
    await writeFile(output, png);
  }
}
