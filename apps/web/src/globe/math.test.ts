import { describe, expect, it } from 'vitest';
import { createEarthMesh } from './geometry';
import {
  cameraPose,
  degrees,
  describePosition,
  homeRange,
  lookAt,
  multiply,
  perspective,
  POLAR_RATIO,
  surfacePoint,
  sunDirection,
} from './math';

describe('geometría y cámara WGS84', () => {
  it('sitúa meridianos, polos y altura sobre el elipsoide', () => {
    expect(surfacePoint(0, 0)).toEqual([1, 0, -0]);
    expect(surfacePoint(90, 0)[2]).toBeCloseTo(-1, 10);
    expect(surfacePoint(0, 90)[1]).toBeCloseTo(POLAR_RATIO, 10);
    for (const [longitude, latitude] of [
      [0, 0],
      [-3.7, 40.4],
      [179, -70],
      [42, 89],
    ]) {
      const point = surfacePoint(longitude!, latitude!);
      const position = describePosition(point);
      expect(position.longitude).toBeCloseTo(longitude!, 8);
      expect(position.latitude).toBeCloseTo(latitude!, 8);
      expect(position.heightM).toBeCloseTo(0, 3);
    }
  });

  it('encuadra el planeta en pantallas verticales y horizontales', () => {
    const mesh = createEarthMesh();
    for (const aspect of [0.45, 1, 2]) {
      const pose = cameraPose({
        longitude: -15,
        latitude: 25,
        range: homeRange(aspect),
        tilt: 0,
      });
      const view = new Float32Array(16);
      const projection = new Float32Array(16);
      const mvp = new Float32Array(16);
      lookAt(view, pose.eye, pose.target, pose.up);
      perspective(projection, aspect, 0.001, 20);
      multiply(mvp, projection, view);
      for (let i = 0; i < mesh.vertices.length; i += 8) {
        const x = mesh.vertices[i]!;
        const y = mesh.vertices[i + 1]!;
        const z = mesh.vertices[i + 2]!;
        const w = mvp[3]! * x + mvp[7]! * y + mvp[11]! * z + mvp[15]!;
        const clipX = mvp[0]! * x + mvp[4]! * y + mvp[8]! * z + mvp[12]!;
        const clipY = mvp[1]! * x + mvp[5]! * y + mvp[9]! * z + mvp[13]!;
        expect(w).toBeGreaterThan(0);
        expect(Math.abs(clipX / w)).toBeLessThan(1);
        expect(Math.abs(clipY / w)).toBeLessThan(1);
      }
    }
  });

  it('inclina físicamente la cámara conservando el punto observado', () => {
    const orbit = { longitude: -15, latitude: 25, range: 2, tilt: 0 };
    const straight = cameraPose(orbit);
    const tilted = cameraPose({ ...orbit, tilt: Math.PI / 4 });
    expect(tilted.target).toEqual(straight.target);
    expect(tilted.eye).not.toEqual(straight.eye);
    const distance = (a: number[], b: number[]) =>
      Math.hypot(...a.map((n, index) => n - b[index]!));
    expect(distance(tilted.eye, tilted.target)).toBeCloseTo(2, 10);
    expect(distance(straight.eye, straight.target)).toBeCloseTo(2, 10);
  });

  it('aproxima el Sol real en ambos solsticios sin recursos externos', () => {
    const summer = sunDirection(new Date('2026-06-21T12:00:00Z'));
    const winter = sunDirection(new Date('2026-12-21T12:00:00Z'));
    expect(Math.hypot(...summer)).toBeCloseTo(1, 10);
    expect(degrees(Math.asin(summer[1]))).toBeGreaterThan(23);
    expect(degrees(Math.asin(winter[1]))).toBeLessThan(-23);
    expect(summer[0]).toBeGreaterThan(0.8);
    expect(sunDirection(new Date('2026-06-22T00:00:00Z'))[0]).toBeLessThan(
      -0.8,
    );
  });
});
