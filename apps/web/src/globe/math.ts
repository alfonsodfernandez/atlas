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

export function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(...v);
  return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Column-major view matrix. The target is a genuine point on the ellipsoid. */
export function lookAt(
  out: Float32Array,
  eye: Vec3,
  target: Vec3,
  up: Vec3,
): void {
  const z = normalize([
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  out.set([
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -dot(x, eye),
    -dot(y, eye),
    -dot(z, eye),
    1,
  ]);
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

export function cameraPose(orbit: Orbit): {
  eye: Vec3;
  target: Vec3;
  up: Vec3;
} {
  const lon = radians(orbit.longitude);
  const lat = radians(orbit.latitude);
  const target = surfacePoint(orbit.longitude, orbit.latitude);
  const normal: Vec3 = [
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  ];
  const north: Vec3 = [
    -Math.sin(lat) * Math.cos(lon),
    Math.cos(lat),
    Math.sin(lat) * Math.sin(lon),
  ];
  const cosine = Math.cos(orbit.tilt);
  const sine = Math.sin(orbit.tilt);
  return {
    target,
    eye: [
      target[0] + orbit.range * (normal[0] * cosine + north[0] * sine),
      target[1] + orbit.range * (normal[1] * cosine + north[1] * sine),
      target[2] + orbit.range * (normal[2] * cosine + north[2] * sine),
    ],
    up: [
      north[0] * cosine - normal[0] * sine,
      north[1] * cosine - normal[1] * sine,
      north[2] * cosine - normal[2] * sine,
    ],
  };
}

export function describePosition(eye: Vec3): {
  longitude: number;
  latitude: number;
  heightM: number;
} {
  const p = Math.hypot(eye[0], eye[2]);
  const theta = Math.atan2(eye[1], p * POLAR_RATIO);
  const ePrime2 = ECCENTRICITY_SQUARED / (POLAR_RATIO * POLAR_RATIO);
  const lat = Math.atan2(
    eye[1] + ePrime2 * POLAR_RATIO * Math.sin(theta) ** 3,
    p - ECCENTRICITY_SQUARED * Math.cos(theta) ** 3,
  );
  const n = 1 / Math.sqrt(1 - ECCENTRICITY_SQUARED * Math.sin(lat) ** 2);
  return {
    longitude: degrees(Math.atan2(-eye[2], eye[0])),
    latitude: degrees(lat),
    heightM:
      (Math.abs(Math.cos(lat)) > 1e-8
        ? p / Math.cos(lat) - n
        : Math.abs(eye[1]) - POLAR_RATIO) * RADIUS_M,
  };
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

/** Approximate solar ephemeris, in Earth-fixed coordinates; refreshed once a minute. */
export function sunDirection(date = new Date()): Vec3 {
  const d = date.getTime() / 86_400_000 - 10_957.5;
  const anomaly = radians(357.528 + 0.9856003 * d);
  const lambda = radians(
    280.46 +
      0.9856474 * d +
      1.915 * Math.sin(anomaly) +
      0.02 * Math.sin(2 * anomaly),
  );
  const obliquity = radians(23.439 - 0.0000004 * d);
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(lambda),
    Math.cos(lambda),
  );
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(lambda));
  const lon = rightAscension - radians(280.46061837 + 360.98564736629 * d);
  return [
    Math.cos(declination) * Math.cos(lon),
    Math.sin(declination),
    -Math.cos(declination) * Math.sin(lon),
  ];
}
