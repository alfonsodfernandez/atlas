import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const bytes = readFileSync(
  new URL('../public/maps/atlas-map.png', import.meta.url),
);
const chunks = new Map<string, Buffer>();
for (let offset = 8; offset < bytes.length;) {
  const size = bytes.readUInt32BE(offset);
  const dataEnd = offset + 8 + size;
  const type = bytes.toString('ascii', offset + 4, offset + 8);
  const crc = bytes.readUInt32BE(dataEnd);
  if (crc32(bytes.subarray(offset + 4, dataEnd)) !== crc || chunks.has(type))
    throw new Error(`Chunk PNG no válido: ${type}`);
  chunks.set(type, bytes.subarray(offset + 8, dataEnd));
  offset = dataEnd + 4;
}
const header = chunks.get('IHDR')!;
const palette = chunks.get('PLTE')!;
const width = header.readUInt32BE(0);
const height = header.readUInt32BE(4);
const stride = width / 2 + 1;
const pixels = inflateSync(chunks.get('IDAT')!, {
  maxOutputLength: height * stride,
});

function sample(longitude: number, latitude: number) {
  const x = Math.floor(((longitude + 180) * width) / 360) % width;
  const y = Math.min(height - 1, Math.floor(((90 - latitude) * height) / 180));
  const packed = pixels[y * stride + 1 + (x >> 1)]!;
  const index = (packed >> (x % 2 === 0 ? 4 : 0)) & 15;
  return [...palette.subarray(index * 3, index * 3 + 3)];
}

describe('máscara cartográfica de ATLAS', () => {
  it('codifica solo dos canales en un PNG indexado pequeño y opaco', () => {
    expect([...bytes.subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect([...chunks.keys()]).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND']);
    expect(width).toBe(1024);
    expect(height).toBe(512);
    expect([...header.subarray(8)]).toEqual([4, 3, 0, 0, 0]);
    expect(bytes.length).toBeLessThan(26 * 1024);
    expect(pixels.length).toBe(stride * height);
    for (let y = 0; y < height; y += 1) expect(pixels[y * stride]).toBe(0);
    expect([...palette]).toEqual(
      Array.from({ length: 16 }, (_, index) => [
        (index >> 2) * 85,
        (index & 3) * 85,
        0,
      ]).flat(),
    );
  });

  it('distingue países, costas y océanos sin dibujar costuras en el antimeridiano', () => {
    for (const [longitude, latitude] of [
      [-3.7, 40.42],
      [20, 0],
      [-60, -6],
      [135, -25],
      [-179.9, -89.9],
      [179.9, -89.9],
    ] as const)
      expect(sample(longitude, latitude)).toEqual([255, 0, 0]);
    for (const [longitude, latitude] of [
      [-35, 0],
      [-140, 0],
      [0, 89.9],
    ] as const)
      expect(sample(longitude, latitude)).toEqual([0, 0, 0]);

    // Costa atlántica de Cádiz, frontera franco-española y paralelo EE. UU./Canadá.
    expect(sample(-6.28, 36.52)).toEqual([170, 0, 0]);
    expect(sample(0.7, 42.7)).toEqual([255, 255, 0]);
    expect(sample(-110, 49)).toEqual([255, 255, 0]);
  });

  it('se regenera byte a byte a partir de la fuente local', () => {
    const script = fileURLToPath(new URL('./prepare-map.mjs', import.meta.url));
    expect(
      execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' }),
    ).toContain(`1024×512, ${bytes.length} bytes`);
  });
});
