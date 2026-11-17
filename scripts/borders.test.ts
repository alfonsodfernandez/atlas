import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Point = [number, number];
interface Feature {
  geometry:
    | { type: 'Polygon'; coordinates: Point[][] }
    | { type: 'MultiPolygon'; coordinates: Point[][][] };
}

const maps = new URL('../public/maps/', import.meta.url);
const bytes = readFileSync(new URL('borders.bin', maps));
const sourceBytes = readFileSync(new URL('countries.geojson', maps));
const source = JSON.parse(sourceBytes.toString('utf8')) as {
  features: Feature[];
};
const metadata = JSON.parse(
  readFileSync(new URL('borders-source.json', maps), 'utf8'),
) as {
  bytes: number;
  sha256: string;
  source: { sha256: string };
  countryCount: number;
  ringCount: number;
  pointCount: number;
};
const sourceRings = source.features.flatMap((feature) =>
  feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates
    : feature.geometry.coordinates.flat(),
);
const digest = (value: Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

describe('fronteras binarias nativas', () => {
  it('identifica el formato y conserva todos los países, anillos y puntos', () => {
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('ATLB');
    expect(bytes.readUInt16LE(4)).toBe(1);
    expect(bytes.readUInt16LE(6)).toBe(0);
    expect(bytes.readUInt32LE(20)).toBe(0);
    expect(bytes.readUInt32LE(8)).toBe(source.features.length);
    expect(bytes.readUInt32LE(12)).toBe(sourceRings.length);
    expect(bytes.readUInt32LE(16)).toBe(
      sourceRings.reduce((sum, ring) => sum + ring.length, 0),
    );
    expect(bytes.readUInt32LE(8)).toBe(metadata.countryCount);
    expect(bytes.readUInt32LE(12)).toBe(metadata.ringCount);
    expect(bytes.readUInt32LE(16)).toBe(metadata.pointCount);
    expect(bytes.byteLength).toBe(
      24 + sourceRings.length * 4 + metadata.pointCount * 4,
    );
    expect(bytes.byteLength).toBeLessThan(220_000);
  });

  it('coincide con su procedencia y se reproduce sin peticiones de red', () => {
    expect(digest(bytes)).toBe(metadata.sha256);
    expect(digest(sourceBytes)).toBe(metadata.source.sha256);
    expect(bytes.byteLength).toBe(metadata.bytes);
    expect(
      execFileSync(
        process.execPath,
        [
          fileURLToPath(new URL('./prepare-borders.mjs', import.meta.url)),
          '--check',
        ],
        { encoding: 'utf8' },
      ),
    ).toContain('ATLB v1:');
  });

  it('mantiene anillos cerrados no degenerados con error de cuantización acotado', () => {
    let offset = 24 + sourceRings.length * 4;
    for (const [index, sourceRing] of sourceRings.entries()) {
      const length = bytes.readUInt32LE(24 + index * 4);
      expect(length).toBe(sourceRing.length);
      expect(length).toBeGreaterThanOrEqual(4);
      const points: Point[] = [];
      for (const original of sourceRing) {
        const longitude = bytes.readInt16LE(offset);
        const latitude = bytes.readInt16LE(offset + 2);
        expect(longitude).toBeGreaterThanOrEqual(-32767);
        expect(latitude).toBeGreaterThanOrEqual(-32767);
        expect(
          Math.abs((longitude / 32767) * 180 - original[0]),
        ).toBeLessThanOrEqual(180 / 32767 / 2 + 1e-10);
        expect(
          Math.abs((latitude / 32767) * 90 - original[1]),
        ).toBeLessThanOrEqual(90 / 32767 / 2 + 1e-10);
        points.push([longitude, latitude]);
        offset += 4;
      }
      expect(points.at(-1)).toEqual(points[0]);
      expect(
        new Set(points.map((point) => point.join(','))).size,
      ).toBeGreaterThanOrEqual(3);
      let area = 0;
      for (let vertex = 1; vertex < points.length; vertex += 1) {
        const previous = points[vertex - 1]!;
        const current = points[vertex]!;
        area += previous[0] * current[1] - current[0] * previous[1];
      }
      expect(area).not.toBe(0);
    }
    expect(offset).toBe(bytes.byteLength);
  });
});
