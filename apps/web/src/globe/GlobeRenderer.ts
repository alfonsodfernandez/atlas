import { createEarthMesh, MAX_TILT } from './geometry';
import {
  cameraPose,
  clamp,
  degrees,
  describePosition,
  homeRange,
  lookAt,
  multiply,
  perspective,
  wrapLongitude,
  type CameraPose,
  type PositionDescription,
  type Orbit,
} from './math';
import { earthFragment, earthVertex } from './shaders';
import type { GlobeHandle, GlobeProps, GlobeStatus } from './types';

interface Graphics {
  program: WebGLProgram;
  mvpUniform: WebGLUniformLocation | null;
  eyeUniform: WebGLUniformLocation | null;
  bordersUniform: WebGLUniformLocation | null;
  demoUniform: WebGLUniformLocation | null;
  sphereVao: WebGLVertexArrayObject;
  texture: WebGLTexture | null;
  indexCount: number;
}
type Pointer = { x: number; y: number; button: number };
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
}

// Regional overview: the approximate mask has no street-level detail.
const MIN_RANGE = 0.16;
const MAX_RANGE = 9.4;
const MAX_PIXELS = 850_000;
const AUTO_FRAME_INTERVAL = 1000 / 30;
const HOME_LONGITUDE = -3;
const HOME_LATITUDE = 34;
const DETAIL_RANGE = 1.15;

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
  private readonly onAnimationFrame = (time: number) => this.frame(time);
  private gl: WebGL2RenderingContext | null = null;
  private graphics: Graphics | null = null;
  private activeMap: MapSource | null = null;
  private pendingMap: MapSource | null = null;
  private uploading = false;
  private detailRequested = false;
  private entrancePending = true;
  private transition: Transition | null = null;
  private imageLoaded = false;
  private ready = false;
  private destroyed = false;
  private contextLost = false;
  private intersecting = true;
  private raf = 0;
  private lastFrame = 0;
  private dirty = true;
  private frames = 0;
  private pixelRatio = 1;
  private cssWidth = 1;
  private cssHeight = 1;
  private cameraTouched = false;
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
    if (this.destroyed) return;
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
    if (!shader) throw new Error('No se pudo crear un shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('No se pudo preparar el renderizado.');
    }
    return shader;
  }

  private program(vertex: string, fragment: string): WebGLProgram {
    const gl = this.gl!;
    const program = gl.createProgram();
    if (!program) throw new Error('No se pudo crear el programa gráfico.');
    this.gpuCleanup.push(() => gl.deleteProgram(program));
    let a: WebGLShader | undefined;
    let b: WebGLShader | undefined;
    try {
      a = this.shader(gl.VERTEX_SHADER, vertex);
      b = this.shader(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, a);
      gl.attachShader(program, b);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('No se pudo enlazar el programa gráfico.');
      }
    } finally {
      if (a) gl.deleteShader(a);
      if (b) gl.deleteShader(b);
    }
    return program;
  }

  private buffer(target: number, data: ArrayBufferView): WebGLBuffer {
    const gl = this.gl!;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('No se pudo reservar el buffer.');
    this.gpuCleanup.push(() => gl.deleteBuffer(buffer));
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buffer;
  }

  private vao(): WebGLVertexArrayObject {
    const gl = this.gl!;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('No se pudo preparar la geometría.');
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
      sphereVao,
      texture: null,
      indexCount: mesh.indices.length,
    };
    this.graphics = graphics;
    this.gpuCleanup.push(() => {
      if (graphics.texture) gl.deleteTexture(graphics.texture);
    });
    // This renderer exclusively owns one program and VAO for the context.
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uMap'), 0);
    gl.uniform1i(graphics.demoUniform, Number(this.options.demoVisible));
    gl.uniform1i(
      this.graphics.bordersUniform,
      Number(this.options.bordersVisible),
    );
    gl.clearColor(244 / 255, 241 / 255, 232 / 255, 1);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  private releaseGraphics(): void {
    for (const cleanup of this.gpuCleanup.splice(0)) cleanup();
    this.graphics = null;
  }

  private queueMap(source: MapSource): void {
    if (this.destroyed || (this.activeMap?.detail && !source.detail)) return;
    if (!this.pendingMap || source.detail || !this.pendingMap.detail)
      this.pendingMap = source;
    void this.uploadMaps();
  }

  private async uploadMaps(): Promise<void> {
    if (
      this.uploading ||
      this.contextLost ||
      !this.graphics ||
      this.destroyed ||
      this.gl?.isContextLost()
    )
      return;
    this.uploading = true;
    try {
      while (
        this.pendingMap &&
        !this.contextLost &&
        !this.destroyed &&
        this.graphics &&
        !this.gl?.isContextLost()
      ) {
        const source = this.pendingMap;
        const graphics = this.graphics;
        try {
          if (!(await this.uploadTexture(source, graphics))) break;
          if (this.pendingMap === source) this.pendingMap = null;
        } catch {
          if (this.pendingMap === source) this.pendingMap = null;
          if (this.abort.signal.aborted) break;
          if (source.detail && this.activeMap && !this.activeMap.detail) {
            if (!this.imageLoaded) this.pendingMap = this.activeMap;
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
      // A restored context may have replaced the one captured during decode.
      if (
        this.pendingMap &&
        !this.contextLost &&
        !this.destroyed &&
        this.graphics &&
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
    if (!gl || this.contextLost) return false;
    const bitmap = await createImageBitmap(source.blob, {
      imageOrientation: 'none',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    });
    try {
      if (
        this.abort.signal.aborted ||
        this.graphics !== graphics ||
        gl.isContextLost()
      )
        return false;
      const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      if (
        bitmap.width > limit ||
        bitmap.height > limit ||
        bitmap.width * bitmap.height > 8_388_608
      )
        throw new Error('Mapa demasiado grande para este dispositivo.');
      const texture = gl.createTexture();
      if (!texture) throw new Error('No se pudo crear la textura.');
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
        if (gl.getError() !== gl.NO_ERROR)
          throw new Error('No se pudo cargar la textura en la GPU.');
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
      this.imageLoaded = true;
      this.invalidate();
      return true;
    } finally {
      // Keep only the compressed PNG for recovery, not the decoded bitmap.
      bitmap.close();
    }
  }

  private async loadTexture(): Promise<void> {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}maps/atlas-map.png?v=3`,
        { signal: this.abort.signal },
      );
      if (!response.ok) throw new Error('Imagen no disponible.');
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
      !this.cameraTouched ||
      this.orbit.range > DETAIL_RANGE ||
      this.detailRequested
    )
      return;
    this.detailRequested = true;
    void fetch(`${import.meta.env.BASE_URL}maps/atlas-map-detail.png`, {
      signal: this.abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Detalle no disponible.');
        const blob = await response.blob();
        if (!this.abort.signal.aborted) this.queueMap({ blob, detail: true });
      })
      .catch(() => {
        if (!this.abort.signal.aborted && !this.contextLost && this.ready)
          this.report(
            'ready',
            'El detalle adicional no está disponible. Se mantiene el mapa base.',
          );
      });
  }

  private installEvents(): void {
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
      this.canvas.focus({ preventScroll: true });
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        button: event.button,
      });
    };
    const pointerMove = (event: PointerEvent): void => {
      const previous = this.pointers.get(event.pointerId);
      if (!previous) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (this.pointers.size >= 2) {
        // Use the moved pointer and its partner without cloning the pointer map.
        let partner: Pointer | undefined;
        for (const pointer of this.pointers.values()) {
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
        if (nextDistance > 1 && previousDistance > 1)
          this.orbit.range = clamp(
            (this.orbit.range * previousDistance) / nextDistance,
            MIN_RANGE,
            MAX_RANGE,
          );
        this.orbit.tilt = clamp(this.orbit.tilt + dy * 0.003, 0, MAX_TILT);
      } else if (previous.button === 1 || event.shiftKey) {
        this.orbit.tilt = clamp(this.orbit.tilt + dy * 0.006, 0, MAX_TILT);
      } else {
        const scale = Math.max(0.001, Math.min(1, this.orbit.range / 3));
        this.orbit.longitude = wrapLongitude(
          this.orbit.longitude - dx * 0.3 * scale,
        );
        this.orbit.latitude = clamp(
          this.orbit.latitude + dy * 0.25 * scale,
          -85,
          85,
        );
      }
      previous.x = event.clientX;
      previous.y = event.clientY;
      this.changed();
    };
    const pointerUp = (event: PointerEvent): void => {
      this.pointers.delete(event.pointerId);
      if (this.canvas.hasPointerCapture(event.pointerId))
        this.canvas.releasePointerCapture(event.pointerId);
    };
    listen(this.canvas, 'pointerdown', pointerDown as EventListener);
    listen(this.canvas, 'pointermove', pointerMove as EventListener);
    listen(this.canvas, 'pointerup', pointerUp as EventListener);
    listen(this.canvas, 'pointercancel', pointerUp as EventListener);
    listen(this.canvas, 'lostpointercapture', pointerUp as EventListener);
    listen(
      this.canvas,
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
        this.orbit.range = clamp(
          this.orbit.range * Math.exp(clamp(delta, -300, 300) * 0.0015),
          MIN_RANGE,
          MAX_RANGE,
        );
        this.changed();
      }) as EventListener,
      { passive: false },
    );
    listen(this.canvas, 'webglcontextlost', ((event: Event) => {
      event.preventDefault();
      this.contextLost = true;
      // The browser already released these objects. Do not delete handles
      // belonging to the lost context when a fresh context is restored.
      this.gpuCleanup.length = 0;
      this.graphics = null;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.ready = false;
      this.imageLoaded = false;
      this.report(
        'error',
        'Se ha interrumpido el renderizado. Puedes volver a intentarlo.',
      );
    }) as EventListener);
    listen(this.canvas, 'webglcontextrestored', (() => {
      if (this.destroyed) return;
      try {
        this.contextLost = false;
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
      } else this.invalidate();
    }) as EventListener);
    const resize = new ResizeObserver(() => this.resize());
    resize.observe(this.host);
    this.cleanup.push(() => resize.disconnect());
    const intersection = new IntersectionObserver(([entry]) => {
      this.intersecting = entry?.isIntersecting ?? true;
      this.lastFrame = 0;
      if (!this.intersecting) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else this.invalidate();
    });
    intersection.observe(this.host);
    this.cleanup.push(() => intersection.disconnect());
  }

  private resize(): void {
    if (this.destroyed) return;
    const size = this.host.getBoundingClientRect();
    this.cssWidth = Math.max(size.width, 1);
    this.cssHeight = Math.max(size.height, 1);
    this.pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      1.5,
      Math.sqrt(MAX_PIXELS / (this.cssWidth * this.cssHeight)),
    );
    const width = Math.max(1, Math.floor(this.cssWidth * this.pixelRatio));
    const height = Math.max(1, Math.floor(this.cssHeight * this.pixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (!this.contextLost) this.gl?.viewport(0, 0, width, height);
    // With no depth attachment, a fixed clip range works at every zoom.
    perspective(
      this.projection,
      this.cssWidth / this.cssHeight,
      0.000001,
      MAX_RANGE + 4,
    );
    if (!this.cameraTouched) {
      const range = homeRange(this.cssWidth / this.cssHeight);
      if (this.transition) this.transition.target.range = range;
      else
        this.orbit.range =
          range *
          (this.entrancePending && !this.options.reducedMotion ? 1.055 : 1);
    }
    this.describe();
    this.invalidate();
  }

  private interact(): void {
    this.transition = null;
    this.entrancePending = false;
    this.cameraTouched = true;
    this.options.autoRotate = false;
    this.options.onInteraction();
  }

  private changed(): void {
    this.orbit.longitude = wrapLongitude(this.orbit.longitude);
    this.describe();
    this.invalidate();
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

  private invalidate(): void {
    this.dirty = true;
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    if (
      !this.raf &&
      !this.destroyed &&
      !this.contextLost &&
      this.imageLoaded &&
      this.graphics &&
      this.intersecting &&
      !document.hidden
    )
      this.raf = requestAnimationFrame(this.onAnimationFrame);
  }

  private frame(time: number): void {
    this.raf = 0;
    if (
      this.destroyed ||
      this.contextLost ||
      !this.intersecting ||
      document.hidden
    )
      return;
    const animating = this.transition !== null;
    const rotating =
      this.ready &&
      this.options.autoRotate &&
      !this.options.reducedMotion &&
      !animating;
    // Auto rotation is slow. Keep interactive frames immediate and limit only
    // automatic frames, allowing a small tolerance for 60/120 Hz RAF jitter.
    if (
      !this.dirty &&
      !animating &&
      (!rotating || time - this.lastFrame < AUTO_FRAME_INTERVAL - 2)
    ) {
      if (rotating) this.scheduleFrame();
      return;
    }
    this.dirty = false;
    if (this.transition) {
      const transition = this.transition;
      if (!transition.started) transition.started = time;
      const progress = clamp(
        (time - transition.started) / transition.duration,
        0,
        1,
      );
      const remaining = 1 - progress;
      const ease = 1 - remaining * remaining * remaining;
      this.orbit.longitude = wrapLongitude(
        transition.longitude +
          wrapLongitude(transition.target.longitude - transition.longitude) *
            ease,
      );
      this.orbit.latitude =
        transition.latitude +
        (transition.target.latitude - transition.latitude) * ease;
      this.orbit.range =
        transition.range + (transition.target.range - transition.range) * ease;
      this.orbit.tilt =
        transition.tilt + (transition.target.tilt - transition.tilt) * ease;
      if (progress === 1) this.transition = null;
      this.describe();
      this.loadDetail();
    }
    if (rotating && this.lastFrame)
      this.orbit.longitude = wrapLongitude(
        this.orbit.longitude +
          Math.min((time - this.lastFrame) / 1_000, 0.1) * 0.3,
      );
    this.lastFrame = time;
    try {
      this.draw();
      if (rotating) {
        // A rotation about the polar axis only changes the camera's longitude.
        const [x, , z] = this.pose.eye;
        this.host.dataset.cameraLongitude = degrees(Math.atan2(-z, x)).toFixed(
          5,
        );
      }
      if (this.imageLoaded && !this.ready) {
        this.ready = true;
        this.report('ready');
        if (this.entrancePending) {
          this.entrancePending = false;
          if (!this.options.reducedMotion)
            this.moveTo(
              {
                longitude: HOME_LONGITUDE,
                latitude: HOME_LATITUDE,
                range: homeRange(this.cssWidth / this.cssHeight),
                tilt: 0,
              },
              1_100,
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
      this.transition ||
      (this.ready && this.options.autoRotate && !this.options.reducedMotion)
    )
      this.scheduleFrame();
  }

  private moveTo(target: Orbit, duration = 850): void {
    if (this.options.reducedMotion) {
      this.orbit.longitude = target.longitude;
      this.orbit.latitude = target.latitude;
      this.orbit.range = target.range;
      this.orbit.tilt = target.tilt;
      this.transition = null;
      this.changed();
      return;
    }
    this.transition = {
      longitude: this.orbit.longitude,
      latitude: this.orbit.latitude,
      range: this.orbit.range,
      tilt: this.orbit.tilt,
      target,
      started: 0,
      duration,
    };
    this.invalidate();
  }

  private draw(): void {
    const gl = this.gl;
    const gpu = this.graphics;
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
    this.cameraTouched = false;
    this.moveTo({
      longitude: HOME_LONGITUDE,
      latitude: HOME_LATITUDE,
      range: homeRange(this.cssWidth / this.cssHeight),
      tilt: 0,
    });
  }
  goTo(longitude: number, latitude: number, range = 0.48): void {
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(range)
    )
      return;
    this.interact();
    this.moveTo({
      longitude: wrapLongitude(longitude),
      latitude: clamp(latitude, -85, 85),
      range: clamp(range, MIN_RANGE, MAX_RANGE),
      tilt: 0,
    });
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
    this.invalidate();
  }
  setBordersVisible(value: boolean): void {
    this.options.bordersVisible = value;
    if (this.graphics && !this.contextLost)
      this.gl!.uniform1i(this.graphics.bordersUniform, Number(value));
    this.invalidate();
  }
  setDemoVisible(value: boolean): void {
    this.options.demoVisible = value;
    if (this.graphics && !this.contextLost)
      this.gl!.uniform1i(this.graphics.demoUniform, Number(value));
    this.invalidate();
  }
  setReducedMotion(value: boolean): void {
    this.options.reducedMotion = value;
    if (value) {
      this.entrancePending = false;
      if (this.transition) this.moveTo(this.transition.target);
    }
    this.lastFrame = 0;
    this.invalidate();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort.abort();
    cancelAnimationFrame(this.raf);
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.pointers.clear();
    this.releaseGraphics();
    this.activeMap = null;
    this.pendingMap = null;
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }
}
