import { describe, expect, it } from 'vitest';
import { createEarthMesh } from './geometry';
import { POLAR_RATIO } from './math';

describe('malla terrestre', () => {
  it('genera una malla cerrada sobre WGS84 con índices válidos', () => {
    const { vertices, indices } = createEarthMesh();
    expect(vertices.length / 8).toBeLessThan(2_200);
    expect(indices.length / 3).toBeLessThan(4_100);
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
});
