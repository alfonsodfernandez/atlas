export type Vec3 = [number, number, number];
export const RADIUS_M = 6_378_137;
export const POLAR_RATIO = 6_356_752.314245 / RADIUS_M;
export const ECCENTRICITY_SQUARED = 1 - POLAR_RATIO * POLAR_RATIO;
export const radians = (degrees: number): number => (degrees * Math.PI) / 180;
export const degrees = (angle: number): number => (angle * 180) / Math.PI;
export const clamp = (n: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, n));
export const wrapLongitude = (longitude: number): number =>
  ((((longitude + 180) % 360) + 360) % 360) - 180;

export function surfacePoint(
  longitude: number,
  latitude: number,
  lift = 1,
): Vec3 {
  const lon = radians(longitude);
  const lat = radians(latitude);
  const sin = Math.sin(lat);
  const radius = lift / Math.sqrt(1 - ECCENTRICITY_SQUARED * sin * sin);
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * (1 - ECCENTRICITY_SQUARED) * sin,
    -radius * Math.cos(lat) * Math.sin(lon),
  ];
}

/** Column-major view matrix. The target is a genuine point on the ellipsoid. */
export function lookAt(
  out: Float32Array,
  eye: Vec3,
  target: Vec3,
  up: Vec3,
): void {
  let z0 = eye[0] - target[0];
  let z1 = eye[1] - target[1];
  let z2 = eye[2] - target[2];
  const zLength = Math.hypot(z0, z1, z2);
  if (zLength > 0) {
    z0 /= zLength;
    z1 /= zLength;
    z2 /= zLength;
  } else {
    z0 = 0;
    z1 = 0;
    z2 = 0;
  }
  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  const xLength = Math.hypot(x0, x1, x2);
  if (xLength > 0) {
    x0 /= xLength;
    x1 /= xLength;
    x2 /= xLength;
  } else {
    x0 = 0;
    x1 = 0;
    x2 = 0;
  }
  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;
  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
}

export function perspective(
  out: Float32Array,
  aspect: number,
  near: number,
  far: number,
): void {
  const f = 1 / Math.tan(radians(45) / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
}

export function multiply(
  out: Float32Array,
  a: Float32Array,
  b: Float32Array,
): void {
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let k = 0; k < 4; k += 1)
        value += a[k * 4 + row]! * b[column * 4 + k]!;
      out[column * 4 + row] = value;
    }
  }
}

export interface Orbit {
  longitude: number;
  latitude: number;
  range: number;
  tilt: number;
}

export interface CameraPose {
  eye: Vec3;
  target: Vec3;
  up: Vec3;
}

/** Reuse the output and its three vectors to avoid allocations in the render loop. */
export function cameraPose(
  orbit: Orbit,
  out: CameraPose = { eye: [0, 0, 0], target: [0, 0, 0], up: [0, 0, 0] },
): CameraPose {
  const lon = radians(orbit.longitude);
  const lat = radians(orbit.latitude);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const radius = 1 / Math.sqrt(1 - ECCENTRICITY_SQUARED * sinLat * sinLat);
  const targetX = radius * cosLat * cosLon;
  const targetY = radius * (1 - ECCENTRICITY_SQUARED) * sinLat;
  const targetZ = -radius * cosLat * sinLon;
  const normalX = cosLat * cosLon;
  const normalY = sinLat;
  const normalZ = -cosLat * sinLon;
  const northX = -sinLat * cosLon;
  const northY = cosLat;
  const northZ = sinLat * sinLon;
  const cosine = Math.cos(orbit.tilt);
  const sine = Math.sin(orbit.tilt);
  out.target[0] = targetX;
  out.target[1] = targetY;
  out.target[2] = targetZ;
  out.eye[0] = targetX + orbit.range * (normalX * cosine + northX * sine);
  out.eye[1] = targetY + orbit.range * (normalY * cosine + northY * sine);
  out.eye[2] = targetZ + orbit.range * (normalZ * cosine + northZ * sine);
  out.up[0] = northX * cosine - normalX * sine;
  out.up[1] = northY * cosine - normalY * sine;
  out.up[2] = northZ * cosine - normalZ * sine;
  return out;
}

export interface PositionDescription {
  longitude: number;
  latitude: number;
  heightM: number;
}

/** Without an output argument, retain the original independently allocated result. */
export function describePosition(
  eye: Vec3,
  out: PositionDescription = { longitude: 0, latitude: 0, heightM: 0 },
): PositionDescription {
  const p = Math.hypot(eye[0], eye[2]);
  const theta = Math.atan2(eye[1], p * POLAR_RATIO);
  const ePrime2 = ECCENTRICITY_SQUARED / (POLAR_RATIO * POLAR_RATIO);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const lat = Math.atan2(
    eye[1] + ePrime2 * POLAR_RATIO * sinTheta * sinTheta * sinTheta,
    p - ECCENTRICITY_SQUARED * cosTheta * cosTheta * cosTheta,
  );
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const n = 1 / Math.sqrt(1 - ECCENTRICITY_SQUARED * sinLat * sinLat);
  out.longitude = degrees(Math.atan2(-eye[2], eye[0]));
  out.latitude = degrees(lat);
  out.heightM =
    (Math.abs(cosLat) > 1e-8
      ? p / cosLat - n
      : Math.abs(eye[1]) - POLAR_RATIO) * RADIUS_M;
  return out;
}

export function homeRange(aspect: number): number {
  const vertical = radians(45);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  return clamp(
    1.08 / Math.sin(Math.min(vertical, horizontal) / 2) - 1,
    0.2,
    9.4,
  );
}

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

const INV_POLAR_SQ = 1 / (POLAR_RATIO * POLAR_RATIO);
const TAN_HALF_FOV = Math.tan(radians(45) / 2);

/**
 * Intersect a screen ray (ndcX, ndcY in [-1, 1]) with the WGS84 ellipsoid.
 * Returns null if the ray misses the globe. Reuses `out` when provided.
 */
export function pickEllipsoid(
  pose: CameraPose,
  aspect: number,
  ndcX: number,
  ndcY: number,
  out: GeoPoint = { longitude: 0, latitude: 0 },
): GeoPoint | null {
  const [ex, ey, ez] = pose.eye;
  const [tx, ty, tz] = pose.target;
  const [ux, uy, uz] = pose.up;
  let fx = tx - ex;
  let fy = ty - ey;
  let fz = tz - ez;
  const fLen = Math.hypot(fx, fy, fz);
  if (fLen <= 0) return null;
  fx /= fLen;
  fy /= fLen;
  fz /= fLen;

  let rx = fy * uz - fz * uy;
  let ry = fz * ux - fx * uz;
  let rz = fx * uy - fy * ux;
  const rLen = Math.hypot(rx, ry, rz);
  if (rLen <= 0) return null;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  const cuX = ry * fz - rz * fy;
  const cuY = rz * fx - rx * fz;
  const cuZ = rx * fy - ry * fx;

  const sx = ndcX * aspect * TAN_HALF_FOV;
  const sy = ndcY * TAN_HALF_FOV;
  let dx = fx + rx * sx + cuX * sy;
  let dy = fy + ry * sx + cuY * sy;
  let dz = fz + rz * sx + cuZ * sy;
  const dLen = Math.hypot(dx, dy, dz);
  if (dLen <= 0) return null;
  dx /= dLen;
  dy /= dLen;
  dz /= dLen;

  const a = dx * dx + dy * dy * INV_POLAR_SQ + dz * dz;
  const halfB = ex * dx + ey * dy * INV_POLAR_SQ + ez * dz;
  const c = ex * ex + ey * ey * INV_POLAR_SQ + ez * ez - 1;
  const disc = halfB * halfB - a * c;
  if (disc < 0) return null;
  const t = (-halfB - Math.sqrt(disc)) / a;
  if (t <= 0) return null;

  const hx = ex + dx * t;
  const hy = ey + dy * t;
  const hz = ez + dz * t;
  const p = Math.hypot(hx, hz);
  out.longitude = degrees(Math.atan2(-hz, hx));
  out.latitude = degrees(Math.atan2(hy, p * POLAR_RATIO * POLAR_RATIO));
  return out;
}

/** Great-circle angular distance in radians between two geographic coordinates. */
export function angularDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const phi1 = radians(lat1);
  const phi2 = radians(lat2);
  const dPhi = phi2 - phi1;
  const dLam = radians(wrapLongitude(lon2 - lon1));
  const sinDPhi = Math.sin(dPhi * 0.5);
  const sinDLam = Math.sin(dLam * 0.5);
  const h =
    sinDPhi * sinDPhi + Math.cos(phi1) * Math.cos(phi2) * sinDLam * sinDLam;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
