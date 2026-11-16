import {
  ECCENTRICITY_SQUARED,
  POLAR_RATIO,
  radians,
  surfacePoint,
  wrapLongitude,
} from './math';

export function createEarthMesh(
  longitudes = 96,
  latitudes = 48,
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

/** Decode only the public, bounded ATLB format. Expansion happens once, off the render path. */
export function decodeBorders(bytes: ArrayBuffer): {
  positions: Float32Array;
  countryCount: number;
} {
  const view = new DataView(bytes);
  if (
    bytes.byteLength < 24 ||
    view.getUint32(0, false) !== 0x41544c42 ||
    view.getUint16(4, true) !== 1 ||
    view.getUint16(6, true) !== 0 ||
    view.getUint32(20, true) !== 0
  )
    throw new Error('Cartografía no válida.');
  const countryCount = view.getUint32(8, true);
  const ringCount = view.getUint32(12, true);
  const pointCount = view.getUint32(16, true);
  if (
    countryCount < 1 ||
    countryCount > 1_024 ||
    ringCount < 1 ||
    ringCount > 25_000 ||
    pointCount < 4 ||
    pointCount > 250_000 ||
    bytes.byteLength !== 24 + ringCount * 4 + pointCount * 4
  )
    throw new Error('Cartografía fuera de los límites admitidos.');
  const pointsOffset = 24 + ringCount * 4;
  const coordinate = (index: number, axis: number): number => {
    const value = view.getInt16(pointsOffset + index * 4 + axis * 2, true);
    if (value === -32768) throw new Error('Coordenada no válida.');
    return (value / 32767) * (axis === 0 ? 180 : 90);
  };
  let point = 0;
  let segmentCount = 0;
  for (let ring = 0; ring < ringCount; ring += 1) {
    const length = view.getUint32(24 + ring * 4, true);
    if (length < 4 || point + length > pointCount)
      throw new Error('Anillo no válido.');
    if (
      coordinate(point, 0) !== coordinate(point + length - 1, 0) ||
      coordinate(point, 1) !== coordinate(point + length - 1, 1)
    )
      throw new Error('Anillo abierto.');
    for (let i = point; i < point + length - 1; i += 1) {
      segmentCount += Math.max(
        1,
        Math.ceil(
          Math.max(
            Math.abs(wrapLongitude(coordinate(i + 1, 0) - coordinate(i, 0))),
            Math.abs(coordinate(i + 1, 1) - coordinate(i, 1)),
          ),
        ),
      );
      if (segmentCount > 500_000)
        throw new Error('Geometría demasiado grande.');
    }
    point += length;
  }
  if (point !== pointCount) throw new Error('El número de puntos no coincide.');
  const positions = new Float32Array(segmentCount * 6);
  let output = 0;
  point = 0;
  for (let ring = 0; ring < ringCount; ring += 1) {
    const length = view.getUint32(24 + ring * 4, true);
    for (let i = point; i < point + length - 1; i += 1) {
      const lon = coordinate(i, 0);
      const lat = coordinate(i, 1);
      const deltaLon = wrapLongitude(coordinate(i + 1, 0) - lon);
      const deltaLat = coordinate(i + 1, 1) - lat;
      const steps = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(deltaLon), Math.abs(deltaLat))),
      );
      for (let step = 0; step < steps; step += 1) {
        for (const fraction of [step / steps, (step + 1) / steps]) {
          const position = surfacePoint(
            lon + deltaLon * fraction,
            lat + deltaLat * fraction,
            1.00015,
          );
          positions.set(position, output);
          output += 3;
        }
      }
    }
    point += length;
  }
  return { positions, countryCount };
}

export const MAX_TILT = radians(45);
