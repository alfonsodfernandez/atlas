import { describe, expect, it } from 'vitest';
import { createEarthMesh, decodeBorders } from './geometry';
import { POLAR_RATIO } from './math';

function fixture(
  points: [number, number][] = [
    [0, 0],
    [10, 0],
    [0, 10],
    [0, 0],
  ],
): ArrayBuffer {
  const bytes = new ArrayBuffer(28 + points.length * 4);
  const view = new DataView(bytes);
  view.setUint32(0, 0x41544c42, false);
  view.setUint16(4, 1, true);
  view.setUint32(8, 1, true);
  view.setUint32(12, 1, true);
  view.setUint32(16, points.length, true);
  view.setUint32(24, points.length, true);
  points.forEach(([lon, lat], i) => {
    view.setInt16(28 + i * 4, Math.round((lon / 180) * 32767), true);
    view.setInt16(30 + i * 4, Math.round((lat / 90) * 32767), true);
  });
  return bytes;
}

describe('malla y fronteras compactas', () => {
  it('genera una malla cerrada sobre WGS84 con índices válidos', () => {
    const { vertices, indices } = createEarthMesh();
    expect(vertices.length / 8).toBeLessThan(5_000);
    expect(indices.length / 3).toBeLessThan(10_000);
    for (const index of indices)
      expect(index).toBeLessThan(vertices.length / 8);
    for (let i = 0; i < vertices.length; i += 8) {
      const x = vertices[i]!;
      const y = vertices[i + 1]!;
      const z = vertices[i + 2]!;
      expect(x * x + z * z + (y / POLAR_RATIO) ** 2).toBeCloseTo(1, 5);
      expect(
        Math.hypot(vertices[i + 3]!, vertices[i + 4]!, vertices[i + 5]!),
      ).toBeCloseTo(1, 5);
      expect(vertices[i + 6]).toBeGreaterThanOrEqual(0);
      expect(vertices[i + 6]).toBeLessThanOrEqual(1);
      expect(vertices[i + 7]).toBeGreaterThanOrEqual(0);
      expect(vertices[i + 7]).toBeLessThanOrEqual(1);
    }
  });

  it('subdivide fronteras largas y evita hundirlas bajo la Tierra', () => {
    const { positions, countryCount } = decodeBorders(fixture());
    expect(countryCount).toBe(1);
    expect(positions.length).toBeGreaterThan(18);
    for (let i = 0; i < positions.length; i += 3) {
      const radius = Math.hypot(
        positions[i]!,
        positions[i + 1]! / POLAR_RATIO,
        positions[i + 2]!,
      );
      expect(radius).toBeGreaterThan(1.0001);
      expect(radius).toBeLessThan(1.0002);
    }
  });

  it('cruza el antimeridiano por el tramo corto', () => {
    const { positions } = decodeBorders(
      fixture([
        [179, 1],
        [-179, 1],
        [179, 0],
        [179, 1],
      ]),
    );
    for (let i = 0; i < positions.length; i += 3)
      expect(positions[i]).toBeLessThan(-0.99);
  });

  it('rechaza tamaños falsos, anillos abiertos y coordenadas fuera de rango', () => {
    expect(() => decodeBorders(new ArrayBuffer(4))).toThrow();
    const huge = fixture();
    new DataView(huge).setUint32(16, 0xffffffff, true);
    expect(() => decodeBorders(huge)).toThrow();
    const open = fixture();
    new DataView(open).setInt16(open.byteLength - 2, 30, true);
    expect(() => decodeBorders(open)).toThrow();
    const invalid = fixture();
    new DataView(invalid).setInt16(32, -32768, true);
    expect(() => decodeBorders(invalid)).toThrow();
    expect(() => decodeBorders(fixture().slice(0, -1))).toThrow();
  });
});
