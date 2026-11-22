import { createEarthMesh, MAX_TILT } from './geometry';
import {
  angularDistance,
  cameraPose,
  clamp,
  degrees,
  describePosition,
  homeRange,
  lookAt,
  multiply,
  perspective,
  pickEllipsoid,
  wrapLongitude,
  type CameraPose,
  type GeoPoint,
  type Orbit,
  type PositionDescription,
} from './math';
import { earthFragment, earthVertex } from './shaders';
import type { GlobeHandle, GlobeProps, GlobeStatus } from './types';

interface Graphics {
  program: WebGLProgram;
  mvpUniform: WebGLUniformLocation | null;
  eyeUniform: WebGLUniformLocation | null;
  bordersUniform: WebGLUniformLocation | null;
  demoUniform: WebGLUniformLocation | null;
  hoverUniform: WebGLUniformLocation | null;
  sphereVao: WebGLVertexArrayObject;
  texture: WebGLTexture | null;
  indexCount: number;
}
type Pointer = {
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
  button: number;
};
interface MapSource {
  blob: Blob;
  detail: boolean;
}
interface Transition {
  longitude: number;
  latitude: number;
  range: number;
  tilt: number;
  target: Orbit;
  started: number;
  duration: number;
  arcLift: number;
}

// Regional overview: the SDF mask has no street-level detail.
const MIN_RANGE = 0.14;
const MAX_RANGE = 9.4;
const MAX_PIXELS = 3_686_400;
const AUTO_FRAME_INTERVAL = 1000 / 30;
const HOME_LONGITUDE = -3;
const HOME_LATITUDE = 34;
const DETAIL_RANGE = 1.15;
const PICK_W = 512;
const PICK_H = 256;

const HOVER_ID: Record<string, number> = { ES: 1, MX: 2, JP: 3 };

function classifyDemoCountry(
  longitude: number,
  latitude: number,
): string | null {
  if (longitude > -20 && longitude < 7 && latitude > 26 && latitude < 45)
    return 'ES';
  if (longitude > -120 && longitude < -85 && latitude > 13 && latitude < 34)
    return 'MX';
  if (longitude > 120 && longitude < 155 && latitude > 23 && latitude < 47)
    return 'JP';
  return null;
}

/** One opaque cartographic globe, drawn only when needed. */
export default class GlobeRenderer implements GlobeHandle {
  private readonly canvas = document.createElement('canvas');
  private readonly abort = new AbortController();
  private readonly cleanup: Array<() => void> = [];
  private readonly gpuCleanup: Array<() => void> = [];
  private readonly pointers = new Map<number, Pointer>();
  private readonly view = new Float32Array(16);
  private readonly projection = new Float32Array(16);
  private readonly mvp = new Float32Array(16);
  private readonly pose: CameraPose = {
    eye: [0, 0, 0],
    target: [0, 0, 0],
    up: [0, 0, 0],
  };
  private readonly position: PositionDescription = {
    longitude: 0,
    latitude: 0,
    heightM: 0,
  };
  private readonly pickA: GeoPoint = { longitude: 0, latitude: 0 };
  private readonly pickB: GeoPoint = { longitude: 0, latitude: 0 };
  private readonly onAnimationFrame = (time: number) => this.frame(time);
  private gl: WebGL2RenderingContext | null = null;
  private gpu: Graphics | null = null;
  private activeMap: MapSource | null = null;
  private pendingMap: MapSource | null = null;
  private pickMask: Uint8Array | null = null;
  private hover: string | null = null;
  private uploading = false;
  private detailAsked = false;
  private intro = true;
  private anim: Transition | null = null;
  private vx = 0;
  private vy = 0;
  private dragAt = 0;
  private loaded = false;
  private ready = false;
  private dead = false;
  private lost = false;
  private visible = true;
  private raf = 0;
  private lastFrame = 0;
  private dirty = true;
  private frames = 0;
  private dpr = 1;
  private cssWidth = 1;
  private cssHeight = 1;
  private moved = false;
  private status: GlobeStatus = { state: 'loading' };
  private orbit: Orbit = {
    longitude: HOME_LONGITUDE,
    latitude: HOME_LATITUDE,
    range: 2,
    tilt: 0,
  };

  constructor(
    private readonly host: HTMLElement,
    private options: GlobeProps,
  ) {
    host.dataset.testid = 'atlas-globe';
    host.dataset.engine = 'native-webgl2';
    host.dataset.frameCount = '0';
    host.dataset.drawCalls = '0';
    host.dataset.mapDetail = 'base';
    host.dataset.hoveredCountry = '';
    this.canvas.setAttribute('aria-label', 'Globo terráqueo 3D de Atlas');
    this.canvas.tabIndex = -1;
    Object.assign(this.canvas.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      touchAction: 'none',
    });
    host.append(this.canvas);
    this.report('loading');
    try {
      this.gl = this.canvas.getContext('webgl2', {
        alpha: false,
        antialias: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      });
      if (!this.gl) throw new Error('WebGL 2 no disponible.');
      void this.loadTexture();
      this.createGraphics();
      this.installEvents();
      this.resize();
    } catch {
      this.abort.abort();
      this.releaseGraphics();
      this.report(
        'error',
        'El globo necesita WebGL 2. Puedes reintentarlo o consultar la vista accesible.',
      );
    }
  }

  private report(state: GlobeStatus['state'], message?: string): void {
    if (this.dead) return;
    const next: GlobeStatus = {
      state,
      ...(message ? { message } : {}),
    };
    if (
      this.status.state === state &&
      this.status.message === next.message &&
      this.host.dataset.engineState === state
    )
      return;
    this.status = next;
    this.host.dataset.engineState = state;
    this.host.setAttribute('aria-busy', String(state === 'loading'));
    this.options.onStatus(next);
  }

  private shader(type: number, source: string): WebGLShader {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) throw new Error();
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error();
    }
    return shader;
  }

  private program(vertex: string, fragment: string): WebGLProgram {
    const gl = this.gl!;
    const program = gl.createProgram();
    if (!program) throw new Error();
    this.gpuCleanup.push(() => gl.deleteProgram(program));
    let a: WebGLShader | undefined;
    let b: WebGLShader | undefined;
    try {
      a = this.shader(gl.VERTEX_SHADER, vertex);
      b = this.shader(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, a);
      gl.attachShader(program, b);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error();
    } finally {
      if (a) gl.deleteShader(a);
      if (b) gl.deleteShader(b);
    }
    return program;
  }

  private buffer(target: number, data: ArrayBufferView): WebGLBuffer {
    const gl = this.gl!;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error();
    this.gpuCleanup.push(() => gl.deleteBuffer(buffer));
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buffer;
  }

  private vao(): WebGLVertexArrayObject {
    const gl = this.gl!;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error();
    this.gpuCleanup.push(() => gl.deleteVertexArray(vao));
    gl.bindVertexArray(vao);
    return vao;
  }

  private createGraphics(): void {
    const gl = this.gl!;
    this.releaseGraphics();
    const program = this.program(earthVertex, earthFragment);
    const mesh = createEarthMesh();
    const sphereVao = this.vao();
    this.buffer(gl.ARRAY_BUFFER, mesh.vertices);
    this.buffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    for (const [location, length, offset] of [
      [0, 3, 0],
      [1, 3, 12],
      [2, 2, 24],
    ]) {
      gl.enableVertexAttribArray(location!);
      gl.vertexAttribPointer(location!, length!, gl.FLOAT, false, 32, offset!);
    }
    const graphics: Graphics = {
      program,
      mvpUniform: gl.getUniformLocation(program, 'uMvp'),
      eyeUniform: gl.getUniformLocation(program, 'uEye'),
      bordersUniform: gl.getUniformLocation(program, 'uBorders'),
      demoUniform: gl.getUniformLocation(program, 'uDemo'),
      hoverUniform: gl.getUniformLocation(program, 'uHover'),
      sphereVao,
      texture: null,
      indexCount: mesh.indices.length,
    };
    this.gpu = graphics;
    this.gpuCleanup.push(() => {
      if (graphics.texture) gl.deleteTexture(graphics.texture);
    });
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uMap'), 0);
    gl.uniform1i(graphics.demoUniform, Number(this.options.demoVisible));
    gl.uniform1i(graphics.bordersUniform, Number(this.options.bordersVisible));
    gl.uniform1i(
      graphics.hoverUniform,
      this.hover ? (HOVER_ID[this.hover] ?? 0) : 0,
    );
    gl.clearColor(243 / 255, 239 / 255, 230 / 255, 1);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  private releaseGraphics(): void {
    for (const cleanup of this.gpuCleanup.splice(0)) cleanup();
    this.gpu = null;
  }

  private extractPickMask(bitmap: ImageBitmap): void {
    try {
      const c = document.createElement('canvas');
      c.width = PICK_W;
      c.height = PICK_H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, PICK_W, PICK_H);
      const rgba = ctx.getImageData(0, 0, PICK_W, PICK_H).data;
      const mask = this.pickMask ?? new Uint8Array(PICK_W * PICK_H);
      for (let i = 0; i < mask.length; i += 1)
        mask[i] = rgba[i * 4 + 2]! >= 120 ? 1 : 0;
      this.pickMask = mask;
    } catch {
      /* picking degrades gracefully */
    }
  }

  private pickAt(x: number, y: number, out: GeoPoint): GeoPoint | null {
    const r = this.canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return pickEllipsoid(
      cameraPose(this.orbit, this.pose),
      this.cssWidth / this.cssHeight,
      ((x - r.left) / r.width) * 2 - 1,
      1 - ((y - r.top) / r.height) * 2,
      out,
    );
  }

  private demoAt(p: GeoPoint | null): string | null {
    if (!p || !this.options.demoVisible || !this.pickMask) return null;
    const x =
      Math.floor(((((p.longitude + 180) % 360) + 360) % 360) * (PICK_W / 360)) %
      PICK_W;
    const y = clamp(
      Math.floor(((90 - p.latitude) * PICK_H) / 180),
      0,
      PICK_H - 1,
    );
    return this.pickMask[y * PICK_W + x]
      ? classifyDemoCountry(p.longitude, p.latitude)
      : null;
  }

  private setHover(code: string | null): void {
    if (this.hover === code) return;
    this.hover = code;
    this.host.dataset.hoveredCountry = code ?? '';
    if (this.gpu && !this.lost) {
      this.gl!.uniform1i(
        this.gpu.hoverUniform,
        code ? (HOVER_ID[code] ?? 0) : 0,
      );
      this.redraw();
    }
    this.options.onHoverCountry?.(code);
  }

  private updateCursor(x: number, y: number): void {
    if (this.pointers.size > 0) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    const hit = this.pickAt(x, y, this.pickA);
    const code = this.demoAt(hit);
    this.setHover(code);
    this.canvas.style.cursor = code ? 'pointer' : hit ? 'grab' : 'default';
  }

  private zoomAt(x: number, y: number, nextRange: number): void {
    const before = this.pickAt(x, y, this.pickA);
    this.orbit.range = clamp(nextRange, MIN_RANGE, MAX_RANGE);
    const after = before ? this.pickAt(x, y, this.pickB) : null;
    if (before && after) {
      this.orbit.longitude = wrapLongitude(
        this.orbit.longitude +
          wrapLongitude(before.longitude - after.longitude),
      );
      this.orbit.latitude = clamp(
        this.orbit.latitude + (before.latitude - after.latitude),
        -85,
        85,
      );
    }
  }

  private queueMap(source: MapSource): void {
    if (this.dead || (this.activeMap?.detail && !source.detail)) return;
    if (!this.pendingMap || source.detail || !this.pendingMap.detail)
      this.pendingMap = source;
    void this.uploadMaps();
  }

  private async uploadMaps(): Promise<void> {
    if (
      this.uploading ||
      this.lost ||
      !this.gpu ||
      this.dead ||
      this.gl?.isContextLost()
    )
      return;
    this.uploading = true;
    try {
      while (
        this.pendingMap &&
        !this.lost &&
        !this.dead &&
        this.gpu &&
        !this.gl?.isContextLost()
      ) {
        const source = this.pendingMap;
        const graphics = this.gpu;
        try {
          if (!(await this.uploadTexture(source, graphics))) break;
          if (this.pendingMap === source) this.pendingMap = null;
        } catch {
          if (this.pendingMap === source) this.pendingMap = null;
          if (this.abort.signal.aborted) break;
          if (source.detail && this.activeMap && !this.activeMap.detail) {
            if (!this.loaded) this.pendingMap = this.activeMap;
            else
              this.report(
                'ready',
                'El detalle adicional no está disponible. Se mantiene el mapa base.',
              );
          } else {
            this.report(
              'error',
              'No se pudo cargar el mapa. Puedes volver a intentarlo.',
            );
          }
        }
      }
    } finally {
      this.uploading = false;
      if (
        this.pendingMap &&
        !this.lost &&
        !this.dead &&
        this.gpu &&
        !this.gl?.isContextLost()
      )
        void this.uploadMaps();
    }
  }

  private async uploadTexture(
    source: MapSource,
    graphics: Graphics,
  ): Promise<boolean> {
    const gl = this.gl;
    if (!gl || this.lost) return false;
    const bitmap = await createImageBitmap(source.blob, {
      imageOrientation: 'none',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    });
    try {
      if (
        this.abort.signal.aborted ||
        this.gpu !== graphics ||
        gl.isContextLost()
      )
        return false;
      const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      if (
        bitmap.width > limit ||
        bitmap.height > limit ||
        bitmap.width * bitmap.height > 8_388_608
      )
        throw new Error();
      this.extractPickMask(bitmap);
      const texture = gl.createTexture();
      if (!texture) throw new Error();
      try {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGB8,
          gl.RGB,
          gl.UNSIGNED_BYTE,
          bitmap,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        if (gl.isContextLost()) return false;
        if (gl.getError() !== gl.NO_ERROR) throw new Error();
        const previous = graphics.texture;
        graphics.texture = texture;
        if (previous) gl.deleteTexture(previous);
      } finally {
        if (graphics.texture !== texture) {
          gl.deleteTexture(texture);
          gl.bindTexture(gl.TEXTURE_2D, graphics.texture);
        }
      }
      this.activeMap = source;
      this.host.dataset.mapDetail = source.detail ? 'detail' : 'base';
      this.loaded = true;
      this.redraw();
      return true;
    } finally {
      bitmap.close();
    }
  }

  private async loadTexture(): Promise<void> {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}maps/atlas-map.png?v=4`,
        { signal: this.abort.signal },
      );
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (this.abort.signal.aborted) return;
      this.queueMap({ blob, detail: false });
    } catch {
      if (!this.abort.signal.aborted)
        this.report(
          'error',
          'No se pudo cargar la imagen de la Tierra. Puedes volver a intentarlo.',
        );
    }
  }

  private loadDetail(): void {
    if (
      !this.ready ||
      !this.moved ||
      this.orbit.range > DETAIL_RANGE ||
      this.detailAsked
    )
      return;
    this.detailAsked = true;
    void fetch(`${import.meta.env.BASE_URL}maps/atlas-map-detail.png`, {
      signal: this.abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        if (!this.abort.signal.aborted) this.queueMap({ blob, detail: true });
      })
      .catch(() => {
        if (!this.abort.signal.aborted && !this.lost && this.ready)
          this.report(
            'ready',
            'El detalle adicional no está disponible. Se mantiene el mapa base.',
          );
      });
  }

  private coasting(): boolean {
    return (
      !this.options.reducedMotion &&
      this.pointers.size === 0 &&
      Math.hypot(this.vx, this.vy) > 0.8
    );
  }

  private installEvents(): void {
    const cv = this.canvas;
    const o = this.orbit;
    const pts = this.pointers;
    const listen = (
      target: EventTarget,
      name: string,
      handler: EventListener,
      options?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(name, handler, options);
      this.cleanup.push(() =>
        target.removeEventListener(name, handler, options),
      );
    };
    const pointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 && event.button !== 1) return;
      event.preventDefault();
      this.interact();
      cv.focus({ preventScroll: true });
      cv.setPointerCapture(event.pointerId);
      pts.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        button: event.button,
      });
      cv.style.cursor = 'grabbing';
    };
    const pointerMove = (event: PointerEvent): void => {
      const previous = pts.get(event.pointerId);
      if (!previous) {
        if (event.pointerType === 'mouse' && this.ready)
          this.updateCursor(event.clientX, event.clientY);
        return;
      }
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (
        !previous.moved &&
        Math.hypot(
          event.clientX - previous.startX,
          event.clientY - previous.startY,
        ) > 5
      )
        previous.moved = true;

      if (pts.size >= 2) {
        let partner: Pointer | undefined;
        for (const pointer of pts.values()) {
          if (pointer !== previous) {
            partner = pointer;
            break;
          }
        }
        if (!partner) return;
        const previousDistance = Math.hypot(
          previous.x - partner.x,
          previous.y - partner.y,
        );
        const nextDistance = Math.hypot(
          event.clientX - partner.x,
          event.clientY - partner.y,
        );
        if (nextDistance > 1 && previousDistance > 1) {
          this.zoomAt(
            (event.clientX + partner.x) * 0.5,
            (event.clientY + partner.y) * 0.5,
            (o.range * previousDistance) / nextDistance,
          );
        }
        o.tilt = clamp(o.tilt + dy * 0.003, 0, MAX_TILT);
        this.vx = 0;
        this.vy = 0;
      } else if (previous.button === 1 || event.shiftKey) {
        o.tilt = clamp(o.tilt + dy * 0.006, 0, MAX_TILT);
        this.vx = 0;
        this.vy = 0;
      } else {
        const scale = Math.max(0.001, Math.min(1, o.range / 3));
        const dLon = -dx * 0.3 * scale;
        const dLat = dy * 0.25 * scale;
        o.longitude = wrapLongitude(o.longitude + dLon);
        o.latitude = clamp(o.latitude + dLat, -85, 85);
        const now = performance.now();
        const dt = Math.max(0.008, (now - this.dragAt) / 1000);
        if (this.dragAt && dt < 0.12) {
          this.vx = clamp(this.vx * 0.45 + (dLon / dt) * 0.55, -120, 120);
          this.vy = clamp(this.vy * 0.45 + (dLat / dt) * 0.55, -120, 120);
        }
        this.dragAt = now;
      }
      previous.x = event.clientX;
      previous.y = event.clientY;
      this.changed();
    };
    const pointerUp = (event: PointerEvent): void => {
      const pointer = pts.get(event.pointerId);
      const wasSingleTap =
        pointer && !pointer.moved && pointer.button === 0 && pts.size === 1;
      pts.delete(event.pointerId);
      if (cv.hasPointerCapture(event.pointerId))
        cv.releasePointerCapture(event.pointerId);
      if (wasSingleTap && this.ready) {
        this.vx = 0;
        this.vy = 0;
        const country = this.demoAt(
          this.pickAt(event.clientX, event.clientY, this.pickA),
        );
        if (country) {
          this.setHover(country);
          this.options.onSelectCountry?.(country);
        }
      } else if (pts.size === 0 && performance.now() - this.dragAt > 80) {
        this.vx = 0;
        this.vy = 0;
      } else if (this.coasting()) {
        this.lastFrame = 0;
        this.scheduleFrame();
      }
      if (event.pointerType === 'mouse' && this.ready)
        this.updateCursor(event.clientX, event.clientY);
      else cv.style.cursor = 'default';
    };
    const pointerLeave = (): void => {
      if (pts.size === 0) {
        this.setHover(null);
        cv.style.cursor = 'default';
      }
    };
    listen(cv, 'pointerdown', pointerDown as EventListener);
    listen(cv, 'pointermove', pointerMove as EventListener);
    listen(cv, 'pointerup', pointerUp as EventListener);
    listen(cv, 'pointercancel', pointerUp as EventListener);
    listen(cv, 'lostpointercapture', pointerUp as EventListener);
    listen(cv, 'pointerleave', pointerLeave as EventListener);
    listen(
      cv,
      'wheel',
      ((event: WheelEvent) => {
        event.preventDefault();
        this.interact();
        const delta =
          event.deltaY *
          (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? this.cssHeight
              : 1);
        this.zoomAt(
          event.clientX,
          event.clientY,
          o.range * Math.exp(clamp(delta, -300, 300) * 0.0015),
        );
        this.changed();
      }) as EventListener,
      { passive: false },
    );
    listen(cv, 'webglcontextlost', ((event: Event) => {
      event.preventDefault();
      this.lost = true;
      this.gpuCleanup.length = 0;
      this.gpu = null;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.ready = false;
      this.loaded = false;
      this.report(
        'error',
        'Se ha interrumpido el renderizado. Puedes volver a intentarlo.',
      );
    }) as EventListener);
    listen(cv, 'webglcontextrestored', (() => {
      if (this.dead) return;
      try {
        this.lost = false;
        this.createGraphics();
        this.resize();
        if (this.activeMap) this.queueMap(this.activeMap);
        else void this.uploadMaps();
      } catch {
        this.releaseGraphics();
        this.report(
          'error',
          'No se pudo recuperar el renderizado. Puedes volver a intentarlo.',
        );
      }
    }) as EventListener);
    listen(document, 'visibilitychange', (() => {
      this.lastFrame = 0;
      if (document.hidden) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else this.redraw();
    }) as EventListener);
    const resize = new ResizeObserver(() => this.resize());
    resize.observe(this.host);
    this.cleanup.push(() => resize.disconnect());
    const intersection = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      this.visible = entry?.isIntersecting ?? true;
      this.lastFrame = 0;
      if (!this.visible) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else this.redraw();
    });
    intersection.observe(this.host);
    this.cleanup.push(() => intersection.disconnect());
  }

  private resize(): void {
    if (this.dead) return;
    const size = this.host.getBoundingClientRect();
    this.cssWidth = Math.max(size.width, 1);
    this.cssHeight = Math.max(size.height, 1);
    this.dpr = Math.min(
      window.devicePixelRatio || 1,
      2,
      Math.sqrt(MAX_PIXELS / (this.cssWidth * this.cssHeight)),
    );
    const width = Math.max(1, Math.floor(this.cssWidth * this.dpr));
    const height = Math.max(1, Math.floor(this.cssHeight * this.dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (!this.lost) this.gl?.viewport(0, 0, width, height);
    perspective(
      this.projection,
      this.cssWidth / this.cssHeight,
      0.000001,
      MAX_RANGE + 4,
    );
    if (!this.moved) {
      const range = homeRange(this.cssWidth / this.cssHeight);
      if (this.anim) this.anim.target.range = range;
      else
        this.orbit.range =
          range * (this.intro && !this.options.reducedMotion ? 1.055 : 1);
    }
    this.describe();
    this.redraw();
  }

  private interact(): void {
    this.anim = null;
    this.vx = 0;
    this.vy = 0;
    this.intro = false;
    this.moved = true;
    this.options.autoRotate = false;
    this.options.onInteraction();
  }

  private changed(): void {
    this.orbit.longitude = wrapLongitude(this.orbit.longitude);
    this.describe();
    this.redraw();
    this.loadDetail();
  }

  private describe(): void {
    const position = describePosition(
      cameraPose(this.orbit, this.pose).eye,
      this.position,
    );
    this.host.dataset.cameraHeight = position.heightM.toFixed(2);
    this.host.dataset.cameraLongitude = position.longitude.toFixed(5);
    this.host.dataset.cameraLatitude = position.latitude.toFixed(5);
    this.host.dataset.cameraPitch = (-90 + degrees(this.orbit.tilt)).toFixed(2);
  }

  private redraw(): void {
    this.dirty = true;
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    if (
      !this.raf &&
      !this.dead &&
      !this.lost &&
      this.loaded &&
      this.gpu &&
      this.visible &&
      !document.hidden
    )
      this.raf = requestAnimationFrame(this.onAnimationFrame);
  }

  private frame(time: number): void {
    this.raf = 0;
    if (this.dead || this.lost || !this.visible || document.hidden) return;
    const animating = this.anim !== null;
    const coast = this.coasting();
    const rotating =
      this.ready &&
      this.options.autoRotate &&
      !this.options.reducedMotion &&
      !animating &&
      !coast;
    if (
      !this.dirty &&
      !animating &&
      !coast &&
      (!rotating || time - this.lastFrame < AUTO_FRAME_INTERVAL - 2)
    ) {
      if (rotating) this.scheduleFrame();
      return;
    }
    this.dirty = false;
    const o = this.orbit;
    if (this.anim) {
      const tr = this.anim;
      if (!tr.started) tr.started = time;
      const p = clamp((time - tr.started) / tr.duration, 0, 1);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      o.longitude = wrapLongitude(
        tr.longitude + wrapLongitude(tr.target.longitude - tr.longitude) * ease,
      );
      o.latitude = tr.latitude + (tr.target.latitude - tr.latitude) * ease;
      const baseRange = tr.range + (tr.target.range - tr.range) * ease;
      o.range = clamp(
        baseRange + tr.arcLift * 4 * p * (1 - p),
        MIN_RANGE,
        MAX_RANGE,
      );
      o.tilt = tr.tilt + (tr.target.tilt - tr.tilt) * ease;
      if (p === 1) this.anim = null;
      this.describe();
      this.loadDetail();
    } else if (coast) {
      const dt = this.lastFrame
        ? Math.max(0.016, (time - this.lastFrame) / 1000)
        : 0.016;
      const step = Math.min(dt, 0.05);
      o.longitude = wrapLongitude(o.longitude + this.vx * step);
      o.latitude = clamp(o.latitude + this.vy * step, -85, 85);
      const decay = Math.exp(-dt * 8);
      this.vx *= decay;
      this.vy *= decay;
      if (Math.hypot(this.vx, this.vy) < 1) {
        this.vx = 0;
        this.vy = 0;
      }
      this.describe();
      this.loadDetail();
    }
    if (rotating && this.lastFrame)
      o.longitude = wrapLongitude(
        o.longitude + Math.min((time - this.lastFrame) / 1_000, 0.1) * 0.3,
      );
    this.lastFrame = time;
    try {
      this.draw();
      if (rotating) {
        const [x, , z] = this.pose.eye;
        this.host.dataset.cameraLongitude = degrees(Math.atan2(-z, x)).toFixed(
          5,
        );
      }
      if (this.loaded && !this.ready) {
        this.ready = true;
        this.report('ready');
        if (this.intro) {
          this.intro = false;
          if (!this.options.reducedMotion)
            this.moveTo(
              {
                longitude: HOME_LONGITUDE,
                latitude: HOME_LATITUDE,
                range: homeRange(this.cssWidth / this.cssHeight),
                tilt: 0,
              },
              1_100,
              0,
            );
        }
        this.loadDetail();
      }
    } catch {
      this.ready = false;
      this.report(
        'error',
        'No se pudo dibujar el planeta. Puedes volver a intentarlo.',
      );
      return;
    }
    if (
      this.anim ||
      this.coasting() ||
      (this.ready && this.options.autoRotate && !this.options.reducedMotion)
    )
      this.scheduleFrame();
  }

  private moveTo(target: Orbit, duration = 850, arcLift = 0): void {
    this.vx = 0;
    this.vy = 0;
    const o = this.orbit;
    if (this.options.reducedMotion) {
      o.longitude = target.longitude;
      o.latitude = target.latitude;
      o.range = target.range;
      o.tilt = target.tilt;
      this.anim = null;
      this.changed();
      return;
    }
    this.anim = {
      longitude: o.longitude,
      latitude: o.latitude,
      range: o.range,
      tilt: o.tilt,
      target,
      started: 0,
      duration,
      arcLift,
    };
    this.redraw();
  }

  private draw(): void {
    const gl = this.gl;
    const gpu = this.gpu;
    if (!gl || !gpu || gl.isContextLost()) return;
    const pose = cameraPose(this.orbit, this.pose);
    lookAt(this.view, pose.eye, pose.target, pose.up);
    multiply(this.mvp, this.projection, this.view);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(gpu.mvpUniform, false, this.mvp);
    gl.uniform3fv(gpu.eyeUniform, pose.eye);
    gl.drawElements(gl.TRIANGLES, gpu.indexCount, gl.UNSIGNED_SHORT, 0);
    if (this.frames === 0) this.host.dataset.drawCalls = '1';
    this.frames += 1;
    this.host.dataset.frameCount = String(this.frames);
  }

  home(): void {
    this.interact();
    this.moved = false;
    this.moveTo(
      {
        longitude: HOME_LONGITUDE,
        latitude: HOME_LATITUDE,
        range: homeRange(this.cssWidth / this.cssHeight),
        tilt: 0,
      },
      850,
      0,
    );
  }
  goTo(longitude: number, latitude: number, range = 0.46): void {
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(range)
    )
      return;
    this.interact();
    const targetLon = wrapLongitude(longitude);
    const targetLat = clamp(latitude, -85, 85);
    const dist = angularDistance(
      this.orbit.longitude,
      this.orbit.latitude,
      targetLon,
      targetLat,
    );
    const arcLift = Math.min(1.5, dist * 0.6);
    const duration = Math.round(700 + Math.min(dist, Math.PI) * 180);
    this.moveTo(
      {
        longitude: targetLon,
        latitude: targetLat,
        range: clamp(range, MIN_RANGE, MAX_RANGE),
        tilt: 0,
      },
      duration,
      arcLift,
    );
  }
  zoomIn(): void {
    this.interact();
    this.orbit.range = clamp(this.orbit.range * 0.78, MIN_RANGE, MAX_RANGE);
    this.changed();
  }
  zoomOut(): void {
    this.interact();
    this.orbit.range = clamp(this.orbit.range * 1.28, MIN_RANGE, MAX_RANGE);
    this.changed();
  }
  rotate(direction: number): void {
    this.interact();
    if (Math.abs(direction) === 2)
      this.orbit.latitude = clamp(
        this.orbit.latitude - Math.sign(direction) * 7,
        -85,
        85,
      );
    else this.orbit.longitude += Math.sign(direction) * 7;
    this.changed();
  }
  tilt(): void {
    this.interact();
    this.orbit.tilt = this.orbit.tilt > 0.01 ? 0 : MAX_TILT;
    this.changed();
  }
  setAutoRotate(value: boolean): void {
    this.options.autoRotate = value;
    this.lastFrame = 0;
    if (value) {
      this.redraw();
    } else if (!this.dirty && !this.anim && !this.coasting()) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }
  setBordersVisible(value: boolean): void {
    this.options.bordersVisible = value;
    if (this.gpu && !this.lost)
      this.gl!.uniform1i(this.gpu.bordersUniform, Number(value));
    this.redraw();
  }
  setDemoVisible(value: boolean): void {
    this.options.demoVisible = value;
    if (!value) this.setHover(null);
    if (this.gpu && !this.lost)
      this.gl!.uniform1i(this.gpu.demoUniform, Number(value));
    this.redraw();
  }
  setReducedMotion(value: boolean): void {
    this.options.reducedMotion = value;
    if (value) {
      this.intro = false;
      this.vx = 0;
      this.vy = 0;
      if (this.anim) this.moveTo(this.anim.target);
    }
    this.lastFrame = 0;
    this.redraw();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.abort.abort();
    cancelAnimationFrame(this.raf);
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.pointers.clear();
    this.releaseGraphics();
    this.activeMap = null;
    this.pendingMap = null;
    this.pickMask = null;
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }
}
