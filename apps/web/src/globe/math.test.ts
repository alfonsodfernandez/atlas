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
  type CameraPose,
  type PositionDescription,
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

  it('reutiliza la pose y sus vectores conservando el objetivo y la distancia', () => {
    const pose: CameraPose = {
      eye: [0, 0, 0],
      target: [0, 0, 0],
      up: [0, 0, 0],
    };
    const { eye, target, up } = pose;
    for (const orbit of [
      { longitude: -15, latitude: 25, range: 2, tilt: 0 },
      { longitude: 122, latitude: -68, range: 0.001, tilt: Math.PI / 4 },
      { longitude: -179.9, latitude: 84, range: 9.4, tilt: 0.2 },
    ]) {
      expect(cameraPose(orbit, pose)).toBe(pose);
      expect(pose.eye).toBe(eye);
      expect(pose.target).toBe(target);
      expect(pose.up).toBe(up);
      expect(target).toEqual(surfacePoint(orbit.longitude, orbit.latitude));
      expect(
        Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]),
      ).toBeCloseTo(orbit.range, 10);
      expect(Math.hypot(...up)).toBeCloseTo(1, 10);
    }
  });

  it('mantiene resultados independientes cuando no se solicita reutilización', () => {
    const orbit = { longitude: -15, latitude: 25, range: 2, tilt: 0 };
    const first = cameraPose(orbit);
    const second = cameraPose(orbit);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.eye).not.toBe(second.eye);
    expect(first.target).not.toBe(second.target);
    expect(first.up).not.toBe(second.up);
    expect(describePosition(first.eye)).not.toBe(describePosition(first.eye));
  });

  it('actualiza la descripción geográfica en el objeto proporcionado', () => {
    const description: PositionDescription = {
      longitude: Number.NaN,
      latitude: Number.NaN,
      heightM: Number.NaN,
    };
    for (const [longitude, latitude] of [
      [-3.7, 40.4],
      [179, -70],
      [42, 89],
    ] as const) {
      expect(
        describePosition(surfacePoint(longitude, latitude), description),
      ).toBe(description);
      expect(description.longitude).toBeCloseTo(longitude, 8);
      expect(description.latitude).toBeCloseTo(latitude, 8);
      expect(description.heightM).toBeCloseTo(0, 3);
    }
  });

  it('transforma la cámara al origen y su objetivo al eje de profundidad', () => {
    const eye: [number, number, number] = [2, 3, 4];
    const target: [number, number, number] = [0.5, -0.5, 1];
    const view = new Float32Array(16).fill(Number.NaN);
    lookAt(view, eye, target, [0, 1, 0]);
    const transform = ([x, y, z]: [number, number, number]) => [
      view[0]! * x + view[4]! * y + view[8]! * z + view[12]!,
      view[1]! * x + view[5]! * y + view[9]! * z + view[13]!,
      view[2]! * x + view[6]! * y + view[10]! * z + view[14]!,
    ];
    for (const coordinate of transform(eye))
      expect(coordinate).toBeCloseTo(0, 6);
    const targetInView = transform(target);
    expect(targetInView[0]).toBeCloseTo(0, 6);
    expect(targetInView[1]).toBeCloseTo(0, 6);
    expect(targetInView[2]).toBeCloseTo(-Math.hypot(1.5, 3.5, 3), 6);
    expect([view[3], view[7], view[11], view[15]]).toEqual([0, 0, 0, 1]);
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
