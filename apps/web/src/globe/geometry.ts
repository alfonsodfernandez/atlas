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

export function createStars(count = 512): Float32Array {
  const stars = new Float32Array(count * 4);
  let seed = 731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4_294_967_296;
  };
  for (let i = 0; i < count; i += 1) {
    const y = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - y * y);
    stars.set(
      [
        radius * Math.cos(angle),
        y,
        radius * Math.sin(angle),
        0.7 + random() * 1.3,
      ],
      i * 4,
    );
  }
  return stars;
}

export const MAX_TILT = radians(45);
