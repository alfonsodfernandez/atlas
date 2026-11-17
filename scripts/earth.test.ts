import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';

interface Chunk {
  name: string;
  data: Buffer;
  crc: number;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left: number, above: number, upperLeft: number): number {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance)
    return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function parseEarth() {
  const bytes = readFileSync(
    new URL('../public/maps/atlas-earth.png', import.meta.url),
  );
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset < bytes.byteLength) {
    if (offset + 12 > bytes.byteLength)
      throw new Error('Cabecera de chunk truncada.');
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.byteLength) throw new Error('Contenido de chunk truncado.');
    chunks.push({
      name: bytes.subarray(offset + 4, offset + 8).toString('ascii'),
      data: bytes.subarray(offset + 8, offset + 8 + length),
      crc: bytes.readUInt32BE(end - 4),
    });
    offset = end;
  }

  const header = chunks.find((chunk) => chunk.name === 'IHDR')?.data;
  const palette = chunks.find((chunk) => chunk.name === 'PLTE')?.data;
  if (!header || header.byteLength !== 13 || !palette) {
    throw new Error('Faltan dimensiones o paleta PNG.');
  }
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  if (width > 2048 || height > 1024 || width === 0 || height === 0) {
    throw new Error('Dimensiones PNG fuera del presupuesto.');
  }
  const filtered = inflateSync(
    Buffer.concat(
      chunks
        .filter((chunk) => chunk.name === 'IDAT')
        .map((chunk) => chunk.data),
    ),
    { maxOutputLength: height * (width + 1) },
  );
  if (filtered.byteLength !== height * (width + 1)) {
    throw new Error('Longitud de filas PNG no válida.');
  }
  const pixels = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const rowOffset = row * (width + 1);
    const filter = filtered[rowOffset]!;
    if (filter > 4) throw new Error('Filtro PNG no válido.');
    for (let column = 0; column < width; column += 1) {
      const pixelOffset = row * width + column;
      const left = column === 0 ? 0 : pixels[pixelOffset - 1]!;
      const above = row === 0 ? 0 : pixels[pixelOffset - width]!;
      const upperLeft =
        row === 0 || column === 0 ? 0 : pixels[pixelOffset - width - 1]!;
      const predictor =
        filter === 1
          ? left
          : filter === 2
            ? above
            : filter === 3
              ? Math.floor((left + above) / 2)
              : filter === 4
                ? paeth(left, above, upperLeft)
                : 0;
      pixels[pixelOffset] =
        (filtered[rowOffset + column + 1]! + predictor) & 0xff;
    }
  }
  return { bytes, chunks, header, palette, width, height, pixels };
}

let earth: ReturnType<typeof parseEarth>;
beforeAll(() => {
  earth = parseEarth();
});

describe('textura original de ATLAS', () => {
  it('es un PNG indexado válido y pequeño, con CRC correcto en todos sus chunks', () => {
    expect(earth.bytes.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(earth.width).toBe(1024);
    expect(earth.height).toBe(512);
    expect(earth.header.subarray(8)).toEqual(Buffer.from([8, 3, 0, 0, 0]));
    expect(earth.palette.byteLength).toBe(64 * 3);
    expect(earth.bytes.byteLength).toBeLessThanOrEqual(80 * 1024);
    expect(earth.chunks[0]?.name).toBe('IHDR');
    expect(earth.chunks.at(-1)?.name).toBe('IEND');
    for (const name of ['IHDR', 'PLTE', 'IEND']) {
      expect(earth.chunks.filter((chunk) => chunk.name === name)).toHaveLength(
        1,
      );
    }
    expect(
      earth.chunks.findIndex((chunk) => chunk.name === 'PLTE'),
    ).toBeLessThan(earth.chunks.findIndex((chunk) => chunk.name === 'IDAT'));
    expect(earth.chunks.some((chunk) => chunk.name === 'tRNS')).toBe(false);
    for (const chunk of earth.chunks) {
      expect(
        crc32(Buffer.concat([Buffer.from(chunk.name, 'ascii'), chunk.data])),
      ).toBe(chunk.crc);
    }
    expect(
      earth.pixels.every((value) => value < earth.palette.byteLength / 3),
    ).toBe(true);
  });

  it('sitúa los continentes y océanos aproximados con el norte en la primera fila', () => {
    const sample = (longitude: number, latitude: number) => {
      const column = Math.floor(
        (((((longitude + 180) % 360) + 360) % 360) / 360) * earth.width,
      );
      const row = Math.min(
        earth.height - 1,
        Math.max(0, Math.floor(((90 - latitude) / 180) * earth.height)),
      );
      return earth.pixels[row * earth.width + column]!;
    };
    for (const [longitude, latitude] of [
      [-3.7, 40.4],
      [20, 0],
      [-60, -6],
      [-100, 40],
      [100, 40],
      [135, -25],
      [-42, 72],
      [0, -85],
    ] as const) {
      expect(
        sample(longitude, latitude),
        `Tierra en ${longitude}, ${latitude}`,
      ).toBeGreaterThanOrEqual(16);
    }
    for (const [longitude, latitude] of [
      [-140, 0],
      [-35, 0],
      [80, -20],
    ] as const) {
      expect(
        sample(longitude, latitude),
        `Océano en ${longitude}, ${latitude}`,
      ).toBeLessThan(16);
    }
  });

  it('se regenera byte a byte sin descargar archivos', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          fileURLToPath(new URL('./prepare-earth.mjs', import.meta.url)),
          '--check',
        ],
        { encoding: 'utf8' },
      ),
    ).not.toThrow();
  });
});
