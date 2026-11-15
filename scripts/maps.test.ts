import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Ring = [number, number][];
interface CountryFeature {
  type: 'Feature';
  id: string;
  properties: { name: string; iso2: string | null; iso3: string | null };
  geometry:
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] };
}

const file = (name: string) =>
  readFileSync(new URL(`../public/maps/${name}`, import.meta.url));
const countries = JSON.parse(file('countries.geojson').toString('utf8')) as {
  type: string;
  features: CountryFeature[];
};
const sources = JSON.parse(file('sources.json').toString('utf8')) as {
  countries: { sha256: string; featureCount: number };
  earth: { sha256: string; bytes: number };
};

describe('cartografía pública versionada', () => {
  it('coincide con los hashes de procedencia de ambos mapas', () => {
    for (const [name, expected] of [
      ['countries.geojson', sources.countries.sha256],
      ['earth.jpg', sources.earth.sha256],
    ] as const) {
      expect(createHash('sha256').update(file(name)).digest('hex')).toBe(
        expected,
      );
    }
    expect(file('earth.jpg').subarray(0, 3)).toEqual(
      Buffer.from([0xff, 0xd8, 0xff]),
    );
    expect(file('earth.jpg').byteLength).toBe(sources.earth.bytes);
  });

  it('conserva identidades y nombres de países conocidos', () => {
    expect(countries.type).toBe('FeatureCollection');
    expect(countries.features).toHaveLength(sources.countries.featureCount);
    expect(countries.features.length).toBeGreaterThan(170);
    expect(new Set(countries.features.map((feature) => feature.id)).size).toBe(
      countries.features.length,
    );
    expect(
      countries.features.find((feature) => feature.properties.iso2 === 'ES')
        ?.properties,
    ).toMatchObject({ name: 'España', iso3: 'ESP' });
    expect(
      countries.features.find((feature) => feature.properties.iso2 === 'GB')
        ?.properties.iso3,
    ).toBe('GBR');
  });

  it('no produce anillos abiertos ni coordenadas inválidas al simplificar', () => {
    for (const feature of countries.features) {
      expect(feature.type).toBe('Feature');
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
      const polygons =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      for (const polygon of polygons) {
        expect(polygon.length).toBeGreaterThan(0);
        for (const ring of polygon) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring.at(-1)).toEqual(ring[0]);
          for (const [longitude, latitude] of ring) {
            expect(Number.isFinite(longitude)).toBe(true);
            expect(Number.isFinite(latitude)).toBe(true);
            expect(Math.abs(longitude)).toBeLessThanOrEqual(180);
            expect(Math.abs(latitude)).toBeLessThanOrEqual(90);
          }
        }
      }
    }
  });
});
