import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

function loadMap(name: string) {
  const bytes = readFileSync(
    new URL(`../public/maps/${name}`, import.meta.url),
  );
  const chunks = new Map<string, Buffer>();
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    const dataEnd = offset + 8 + size;
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (
      dataEnd + 4 > bytes.length ||
      chunks.has(type) ||
      crc32(bytes.subarray(offset + 4, dataEnd)) !== bytes.readUInt32BE(dataEnd)
    )
      throw new Error(`Chunk PNG no válido: ${name}/${type}`);
    chunks.set(type, bytes.subarray(offset + 8, dataEnd));
    offset = dataEnd + 4;
  }
  const header = chunks.get('IHDR')!;
  const palette = chunks.get('PLTE')!;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const stride = width + 1;
  const pixels = inflateSync(chunks.get('IDAT')!, {
    maxOutputLength: height * stride,
  });
  const rgb = (x: number, y: number) => {
    const index = pixels[y * stride + 1 + x]!;
    return {
      land: palette[index * 3]!,
      border: palette[index * 3 + 1]!,
      demo: palette[index * 3 + 2]!,
    };
  };
  const position = (longitude: number, latitude: number) =>
    [
      Math.floor((((((longitude + 180) % 360) + 360) % 360) * width) / 360),
      Math.max(
        0,
        Math.min(height - 1, Math.floor(((90 - latitude) * height) / 180)),
      ),
    ] as const;
  const sample = (longitude: number, latitude: number) => {
    const [x, y] = position(longitude, latitude);
    return rgb(x, y);
  };
  const peak = (
    longitude: number,
    latitude: number,
    channel: 'land' | 'border' | 'demo',
  ) => {
    const [centerX, centerY] = position(longitude, latitude);
    let maximum = 0;
    for (
      let y = Math.max(0, centerY - 2);
      y <= Math.min(height - 1, centerY + 2);
      y += 1
    ) {
      for (let x = centerX - 2; x <= centerX + 2; x += 1) {
        maximum = Math.max(maximum, rgb((x + width) % width, y)[channel]);
      }
    }
    return maximum;
  };
  return {
    name,
    bytes,
    chunks,
    header,
    palette,
    width,
    height,
    stride,
    pixels,
    sample,
    peak,
  };
}

const maps = [
  {
    map: loadMap('atlas-map.png'),
    width: 1024,
    height: 512,
    budget: 24 * 1024,
  },
  {
    map: loadMap('atlas-map-detail.png'),
    width: 2048,
    height: 1024,
    budget: 96 * 1024,
  },
];

describe('máscaras cartográficas de ATLAS', () => {
  it.each(maps)(
    '$map.name conserva canales independientes en un PNG pequeño y opaco',
    ({ map, width, height, budget }) => {
      expect([...map.bytes.subarray(0, 8)]).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
      ]);
      expect([...map.chunks.keys()]).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND']);
      expect(map.width).toBe(width);
      expect(map.height).toBe(height);
      expect([...map.header.subarray(8)]).toEqual([8, 3, 0, 0, 0]);
      expect(map.bytes.length).toBeLessThanOrEqual(budget);
      expect(map.pixels.length).toBe(map.stride * height);
      expect(map.palette.length % 3).toBe(0);
      const colorCount = map.palette.length / 3;
      expect(colorCount).toBeGreaterThan(2);
      expect(colorCount).toBeLessThanOrEqual(256);
      let invalid = 0;
      for (let y = 0; y < height; y += 1) {
        expect(map.pixels[y * map.stride]).toBe(0);
        for (let x = 0; x < width; x += 1) {
          const index = map.pixels[y * map.stride + x + 1]!;
          // Demo SDF must be contained within land SDF, never exceeding land into the sea.
          if (
            index >= colorCount ||
            map.palette[index * 3 + 2]! > map.palette[index * 3]!
          )
            invalid += 1;
        }
      }
      expect(invalid).toBe(0);
    },
  );

  it.each(maps)(
    '$map.name distingue tierra, frontera, demo y antimeridiano',
    ({ map }) => {
      for (const [longitude, latitude] of [
        [-3.7, 40.42],
        [-99.13, 19.43],
        [138.2, 36.3],
      ] as const) {
        expect(map.sample(longitude, latitude).land).toBeGreaterThanOrEqual(
          170,
        );
        expect(map.sample(longitude, latitude).demo).toBeGreaterThanOrEqual(
          170,
        );
      }
      for (const [longitude, latitude] of [
        [2.35, 48.85],
        [20, 0],
        [-60, -6],
        [135, -25],
        [-179.9, -89.9],
        [179.9, -89.9],
      ] as const)
        expect(map.sample(longitude, latitude)).toEqual({
          land: 255,
          border: 0,
          demo: 0,
        });
      for (const [longitude, latitude] of [
        [-35, 0],
        [-140, 0],
        [0, 89.9],
        [-179.9, 0],
        [179.9, 0],
      ] as const)
        expect(map.sample(longitude, latitude)).toEqual({
          land: 0,
          border: 0,
          demo: 0,
        });
      expect(map.sample(-6.28, 36.52).border).toBe(0); // Coast independent of border toggle.
      expect(map.peak(0.7, 42.7, 'border')).toBeGreaterThanOrEqual(170);
      expect(map.peak(-110, 49, 'border')).toBeGreaterThanOrEqual(170);
    },
  );

  it('el detalle conserva islas que quedan fuera del mapa mundial generalizado', () => {
    const base = maps[0]!.map;
    const detail = maps[1]!.map;
    expect(base.sample(-16.6, 28.3).land).toBe(0); // Tenerife omitted at 110m.
    expect(detail.peak(-16.6, 28.3, 'land')).toBeGreaterThanOrEqual(170);
    expect(detail.peak(-16.6, 28.3, 'demo')).toBeGreaterThanOrEqual(170);
  });

  it('se regeneran ambas imágenes byte a byte sin peticiones de red', () => {
    const script = fileURLToPath(new URL('./prepare-map.mjs', import.meta.url));
    const result = execFileSync(process.execPath, [script, '--check'], {
      encoding: 'utf8',
    });
    for (const { map, width, height } of maps)
      expect(result).toContain(`${width}×${height}, ${map.bytes.length} bytes`);
  }, 20_000);
});
