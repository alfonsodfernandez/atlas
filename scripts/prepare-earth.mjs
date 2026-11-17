import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync, constants } from 'node:zlib';
import {
  continents,
  islands,
  islandOvals,
  inlandWaters,
} from './earth-shapes.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  throw new Error('Uso: node scripts/prepare-earth.mjs [--check]');
}

const WIDTH = 1024;
const HEIGHT = 512;
const land = new Uint8Array(WIDTH * HEIGHT);
const elevations = new Float32Array(WIDTH * HEIGHT);
const ridges = new Float32Array(WIDTH * HEIGHT);
const wrap = (value, size) => ((value % size) + size) % size;
const clamp = (value, low = 0, high = 1) =>
  Math.max(low, Math.min(high, value));
const smooth = (value) => value * value * (3 - 2 * value);

// Integer hashing and smooth, periodic value noise: no random or image inputs.
function hash(x, y, seed) {
  let value = Math.imul(x + seed, 0x45d9f3b) ^ Math.imul(y + 7919, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function noise(u, v, cells, seed) {
  const gx = u * cells * 2;
  const gy = v * cells;
  const x = Math.floor(gx);
  const y = Math.floor(gy);
  const tx = smooth(gx - x);
  const ty = smooth(gy - y);
  const a = hash(wrap(x, cells * 2), y, seed);
  const b = hash(wrap(x + 1, cells * 2), y, seed);
  const c = hash(wrap(x, cells * 2), y + 1, seed);
  const d = hash(wrap(x + 1, cells * 2), y + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function terrainNoise(u, v, seed) {
  return (
    noise(u, v, 4, seed) * 0.5 +
    noise(u, v, 11, seed + 47) * 0.3 +
    noise(u, v, 27, seed + 113) * 0.15 +
    noise(u, v, 59, seed + 211) * 0.05
  );
}

function fillPolygon(points, value) {
  const pixelPoints = points.map(([longitude, latitude]) => [
    ((longitude + 180) / 360) * WIDTH,
    ((90 - latitude) / 180) * HEIGHT,
  ]);
  const minimumY = Math.max(
    0,
    Math.floor(Math.min(...pixelPoints.map((point) => point[1]))),
  );
  const maximumY = Math.min(
    HEIGHT - 1,
    Math.ceil(Math.max(...pixelPoints.map((point) => point[1]))),
  );
  for (let y = minimumY; y <= maximumY; y += 1) {
    const intersections = [];
    const scan = y + 0.5;
    for (let index = 0; index < pixelPoints.length; index += 1) {
      const start = pixelPoints[index];
      const end = pixelPoints[(index + 1) % pixelPoints.length];
      if (
        (start[1] <= scan && end[1] > scan) ||
        (end[1] <= scan && start[1] > scan)
      ) {
        intersections.push(
          start[0] +
            ((scan - start[1]) / (end[1] - start[1])) * (end[0] - start[0]),
        );
      }
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const first = Math.ceil(intersections[index] - 0.5);
      const last = Math.floor(intersections[index + 1] - 0.5);
      for (let x = first; x <= last; x += 1)
        land[y * WIDTH + wrap(x, WIDTH)] = value;
    }
  }
}

for (const shape of [...continents, ...islands])
  fillPolygon(shape.points, shape.ice ? 2 : 1);
for (const [, longitude, latitude, radiusX, radiusY] of islandOvals) {
  const points = [];
  // A rational oval avoids platform-specific trigonometric differences.
  const circle = [
    [1, 0],
    [0.866, 0.5],
    [0.5, 0.866],
    [0, 1],
    [-0.5, 0.866],
    [-0.866, 0.5],
    [-1, 0],
    [-0.866, -0.5],
    [-0.5, -0.866],
    [0, -1],
    [0.5, -0.866],
    [0.866, -0.5],
  ];
  for (const [x, y] of circle)
    points.push([longitude + x * radiusX, latitude + y * radiusY]);
  fillPolygon(points, 1);
}
for (const water of inlandWaters) fillPolygon(water, 0);

function ellipse(longitude, latitude, centerX, centerY, radiusX, radiusY) {
  return smooth(
    clamp(
      1 -
        ((longitude - centerX) / radiusX) ** 2 -
        ((latitude - centerY) / radiusY) ** 2,
    ),
  );
}

function window(value, first, last, feather) {
  return (
    smooth(clamp((value - first) / feather)) *
    smooth(clamp((last - value) / feather))
  );
}

function rangeCenter(value, points) {
  for (let index = 1; index < points.length; index += 1) {
    if (value <= points[index][0]) {
      const [first, start] = points[index - 1];
      const [last, end] = points[index];
      return (
        start + (end - start) * smooth(clamp((value - first) / (last - first)))
      );
    }
  }
  return points.at(-1)[1];
}

const andesPath = [
  [-55, -72],
  [-42, -73],
  [-28, -69],
  [-16, -72],
  [-3, -77],
  [12, -75],
];
const rockiesPath = [
  [26, -106],
  [32, -109],
  [42, -112],
  [52, -119],
  [68, -127],
];
const himalayaPath = [
  [68, 36],
  [80, 31],
  [88, 28],
  [96, 29],
  [106, 32],
];

function mountain(longitude, latitude, u, v) {
  const broad = noise(u, v, 13, 419);
  const detail = noise(u, v, 43, 571);
  const strength = 0.48 + detail * 0.52;
  const andesX = rangeCenter(latitude, andesPath) + (broad - 0.5) * 3.2;
  const andes =
    smooth(clamp(1 - ((longitude - andesX) / (1.2 + detail * 2)) ** 2)) *
    window(latitude, -55, 12, 7);
  const rockies =
    smooth(
      clamp(
        1 -
          ((longitude -
            rangeCenter(latitude, rockiesPath) +
            (broad - 0.5) * 4) /
            (2 + detail * 3)) **
            2,
      ),
    ) * window(latitude, 26, 68, 7);
  const himalayaY = rangeCenter(longitude, himalayaPath) + (broad - 0.5) * 2;
  const himalaya =
    smooth(clamp(1 - ((latitude - himalayaY) / (1.1 + detail * 1.5)) ** 2)) *
    window(longitude, 68, 106, 8);
  const alps = ellipse(longitude, latitude, 11, 46, 7, 1.8) * 0.7;
  const eastAfrica = ellipse(longitude, latitude, 36, 1, 4, 16) * 0.5;
  return Math.max(andes, rockies, himalaya, alps, eastAfrica) * strength;
}

for (let y = 0; y < HEIGHT; y += 1) {
  const v = (y + 0.5) / HEIGHT;
  const latitude = 90 - v * 180;
  for (let x = 0; x < WIDTH; x += 1) {
    const u = (x + 0.5) / WIDTH;
    const longitude = u * 360 - 180;
    ridges[y * WIDTH + x] = mountain(longitude, latitude, u, v);
    elevations[y * WIDTH + x] =
      terrainNoise(u, v, 37) * 0.35 + ridges[y * WIDTH + x] * 0.8;
  }
}

const palette = [];
function ramp(first, last, count) {
  const parse = (hex) =>
    [0, 2, 4].map((offset) =>
      Number.parseInt(hex.slice(offset, offset + 2), 16),
    );
  const start = parse(first);
  const end = parse(last);
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    palette.push(
      ...start.map((value, axis) =>
        Math.round(value + (end[axis] - value) * t),
      ),
    );
  }
}
ramp('082d3c', '3b8380', 16); // Ocean: 0–15.
ramp('244b3e', '849862', 12); // Temperate/tropical land: 16–27.
ramp('86794e', 'd3bd82', 12); // Ochre dry terrain: 28–39.
ramp('7b8274', 'd7d6bb', 8); // Rock and high ground: 40–47.
ramp('adcbc5', 'eff0da', 8); // Polar snow: 48–55.
ramp('397263', '93ae80', 8); // Original coastal ink/highlights: 56–63.

const pixels = new Uint8Array(WIDTH * HEIGHT);
const at = (x, y) =>
  Math.max(0, Math.min(HEIGHT - 1, y)) * WIDTH + wrap(x, WIDTH);
for (let y = 0; y < HEIGHT; y += 1) {
  const v = (y + 0.5) / HEIGHT;
  const latitude = 90 - v * 180;
  for (let x = 0; x < WIDTH; x += 1) {
    const offset = y * WIDTH + x;
    const u = (x + 0.5) / WIDTH;
    const longitude = u * 360 - 180;
    const neighbors = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
    if (!land[offset]) {
      const shelf = neighbors.some((index) => land[index]);
      const sea = noise(u, v, 6, 127) * 0.7 + noise(u, v, 19, 239) * 0.3;
      pixels[offset] = shelf
        ? 14
        : Math.round(
            clamp(0.27 + sea * 0.32 + (1 - (latitude / 90) ** 2) * 0.13) * 15,
          );
      continue;
    }
    const dx = (elevations[at(x + 1, y)] - elevations[at(x - 1, y)]) * 18;
    const dy = (elevations[at(x, y + 1)] - elevations[at(x, y - 1)]) * 18;
    const light = clamp(
      (0.72 - dx * 0.46 - dy * 0.5) / Math.sqrt(1 + dx * dx + dy * dy) + 0.18,
    );
    if (neighbors.some((index) => !land[index])) {
      pixels[offset] = (land[offset] === 2 ? 48 : 56) + Math.round(light * 7);
      continue;
    }
    const ridge = ridges[offset];
    const grain = terrainNoise(u, v, 311);
    const snow =
      land[offset] === 2 ||
      Math.abs(latitude) > 73 ||
      (ridge > 0.89 && Math.abs(latitude) > 32 && grain > 0.62);
    if (snow) {
      pixels[offset] = 48 + Math.round(clamp(light * 0.72 + grain * 0.28) * 7);
    } else {
      const warpedLongitude =
        longitude +
        (noise(u, v, 9, 509) - 0.5) * 10 +
        (noise(u, v, 23, 521) - 0.5) * 3;
      const warpedLatitude =
        latitude +
        (noise(u, v, 9, 659) - 0.5) * 5 +
        (noise(u, v, 23, 677) - 0.5) * 2;
      const dry = clamp(
        Math.max(
          window(warpedLongitude, -22, 43, 12) *
            window(warpedLatitude, 11, 35, 8),
          window(warpedLongitude, 34, 59, 7) *
            window(warpedLatitude, 12, 32, 6),
          window(warpedLongitude, 114, 151, 10) *
            window(warpedLatitude, -35, -15, 8),
          window(warpedLongitude, 54, 112, 14) *
            window(warpedLatitude, 30, 49, 8) *
            0.8,
          window(warpedLongitude, -121, -99, 9) *
            window(warpedLatitude, 24, 42, 8) *
            0.75,
        ) *
          (0.65 + grain * 0.5),
      );
      const shade = clamp(
        grain * 0.44 + light * 0.5 + elevations[offset] * 0.15,
      );
      // Cross the continuous land ramp gradually; no hard ellipse or range edge.
      const base = 16 + shade * 10 + dry * 13;
      const mountainMix = smooth(clamp((ridge - 0.18) / 0.7));
      const rock = 38 + light * 5 + grain * 3;
      pixels[offset] = Math.round(
        base * (1 - mountainMix) + rock * mountainMix,
      );
    }
  }
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(data.byteLength + 12);
  output.writeUInt32BE(data.byteLength, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  let crc = 0xffffffff;
  for (const byte of output.subarray(4, -4))
    crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, output.byteLength - 4);
  return output;
}

const raw = Buffer.alloc((WIDTH + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y += 1) {
  raw[y * (WIDTH + 1)] = 0;
  raw.set(pixels.subarray(y * WIDTH, (y + 1) * WIDTH), y * (WIDTH + 1) + 1);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(WIDTH, 0);
header.writeUInt32BE(HEIGHT, 4);
header[8] = 8;
header[9] = 3;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('PLTE', Buffer.from(palette)),
  chunk('IDAT', deflateSync(raw, { level: 9, strategy: constants.Z_FILTERED })),
  chunk('IEND', Buffer.alloc(0)),
]);
const output = new URL('../public/maps/atlas-earth.png', import.meta.url);
if (png.byteLength > 80 * 1024)
  throw new Error('La textura supera el presupuesto de 80 KiB.');
if (args[0] === '--check') {
  if (!(await readFile(output)).equals(png))
    throw new Error('Regenera la textura con node scripts/prepare-earth.mjs.');
} else {
  await mkdir(new URL('../public/maps/', import.meta.url), { recursive: true });
  await writeFile(output, png);
}
process.stdout.write(
  `Atlas Earth: ${WIDTH}×${HEIGHT}, ${png.byteLength} bytes, SHA-256 ${createHash('sha256').update(png).digest('hex')}\n`,
);
