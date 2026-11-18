import { ECCENTRICITY_SQUARED, POLAR_RATIO, radians } from './math';

export function createEarthMesh(
  longitudes = 64,
  latitudes = 32,
): { vertices: Float32Array; indices: Uint16Array } {
  if (
    !Number.isInteger(longitudes) ||
    !Number.isInteger(latitudes) ||
    longitudes < 3 ||
    latitudes < 2 ||
    (longitudes + 1) * (latitudes + 1) > 65_535
  ) {
    throw new Error('Resolución de malla no válida.');
  }
  const vertices = new Float32Array((longitudes + 1) * (latitudes + 1) * 8);
  const indices = new Uint16Array(longitudes * latitudes * 6);
  let offset = 0;
  for (let row = 0; row <= latitudes; row += 1) {
    const lat = Math.PI * (0.5 - row / latitudes);
    const sin = Math.sin(lat);
    const radius = 1 / Math.sqrt(1 - ECCENTRICITY_SQUARED * sin * sin);
    for (let column = 0; column <= longitudes; column += 1) {
      const lon = -Math.PI + (column / longitudes) * Math.PI * 2;
      const nx = Math.cos(lat) * Math.cos(lon);
      const nz = -Math.cos(lat) * Math.sin(lon);
      vertices.set(
        [
          radius * nx,
          radius * POLAR_RATIO * POLAR_RATIO * sin,
          radius * nz,
          nx,
          sin,
          nz,
          column / longitudes,
          row / latitudes,
        ],
        offset,
      );
      offset += 8;
    }
  }
  offset = 0;
  for (let row = 0; row < latitudes; row += 1) {
    for (let column = 0; column < longitudes; column += 1) {
      const a = row * (longitudes + 1) + column;
      const b = a + longitudes + 1;
      indices.set([a, b, a + 1, a + 1, b, b + 1], offset);
      offset += 6;
    }
  }
  return { vertices, indices };
}

export const MAX_TILT = radians(45);
