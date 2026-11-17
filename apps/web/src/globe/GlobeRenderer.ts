import {
  createEarthMesh,
  createStars,
  decodeBorders,
  MAX_TILT,
} from './geometry';
import {
  cameraPose,
  clamp,
  degrees,
  describePosition,
  homeRange,
  lookAt,
  multiply,
  perspective,
  sunDirection,
  wrapLongitude,
  type Orbit,
  type Vec3,
} from './math';
import {
  atmosphereFragment,
  atmosphereVertex,
  earthFragment,
  earthVertex,
  lineFragment,
  lineVertex,
  starFragment,
  starVertex,
} from './shaders';
import type {
  GlobeHandle,
  GlobeProps,
  GlobeSnapshot,
  GlobeStatus,
} from './types';

interface Program {
  handle: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}
interface Graphics {
  earth: Program;
  atmosphere: Program;
  borders: Program;
  stars: Program;
  sphereVao: WebGLVertexArrayObject;
  starVao: WebGLVertexArrayObject;
  borderVao: WebGLVertexArrayObject;
  borderBuffer: WebGLBuffer;
  texture: WebGLTexture;
  indexCount: number;
}
type Pointer = { x: number; y: number; button: number };

const MIN_RANGE = 0.00005;
const MAX_RANGE = 9.4;
const MAX_PIXELS = 1_200_000;

/** Four batched draw calls, no scene graph, workers, framework, or idle render loop. */
export default class GlobeRenderer implements GlobeHandle {
  private readonly canvas = document.createElement('canvas');
  private readonly abort = new AbortController();
  private readonly cleanup: Array<() => void> = [];
  private readonly gpuCleanup: Array<() => void> = [];
  private readonly pointers = new Map<number, Pointer>();
  private readonly view = new Float32Array(16);
  private readonly projection = new Float32Array(16);
  private readonly mvp = new Float32Array(16);
  private gl: WebGL2RenderingContext | null = null;
  private graphics: Graphics | null = null;
  private bitmap: ImageBitmap | null = null;
  private borderPositions: Float32Array | null = null;
  private countryCount = 0;
  private borderLoading = false;
  private imageLoaded = false;
  private firstTextureDraw = false;
  private ready = false;
  private destroyed = false;
  private contextLost = false;
  private intersecting = true;
  private raf = 0;
  private lastFrame = 0;
  private frames = 0;
  private drawCalls = 0;
  private pixelRatio = 1;
  private cssWidth = 1;
  private cssHeight = 1;
  private cameraTouched = false;
  private status: GlobeStatus = { state: 'loading', countryCount: 0 };
  private sun: Vec3 = sunDirection();
  private orbit: Orbit = { longitude: -15, latitude: 25, range: 2, tilt: 0 };

  constructor(
    private readonly host: HTMLElement,
    private options: GlobeProps,
  ) {
    host.dataset.testid = 'atlas-globe';
    host.dataset.engine = 'native-webgl2';
    host.dataset.countryCount = '0';
    host.dataset.frameCount = '0';
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
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      });
      if (!this.gl) throw new Error('WebGL 2 no disponible.');
      this.createGraphics();
      this.installEvents();
      this.resize();
      void this.loadTexture();
    } catch {
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
      countryCount: this.countryCount,
      ...(message ? { message } : {}),
    };
    if (
      this.status.state === state &&
      this.status.countryCount === next.countryCount &&
      this.status.message === next.message &&
      this.host.dataset.engineState === state
    )
      return;
    this.status = next;
    this.host.dataset.engineState = state;
    this.host.dataset.countryCount = String(this.countryCount);
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

  private program(vertex: string, fragment: string, names: string[]): Program {
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
    return {
      handle: program,
      uniforms: new Map(
        names.map((name) => [name, gl.getUniformLocation(program, name)]),
      ),
    };
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
    const earth = this.program(earthVertex, earthFragment, [
      'uMvp',
      'uEarth',
      'uSun',
      'uEye',
      'uLighting',
    ]);
    const atmosphere = this.program(atmosphereVertex, atmosphereFragment, [
      'uMvp',
      'uSun',
      'uEye',
      'uLighting',
    ]);
    const borders = this.program(lineVertex, lineFragment, ['uMvp']);
    const stars = this.program(starVertex, starFragment, [
      'uView',
      'uProjection',
      'uPixelRatio',
    ]);
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
    const starVao = this.vao();
    this.buffer(gl.ARRAY_BUFFER, createStars());
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
    const borderVao = this.vao();
    const borderBuffer = this.buffer(
      gl.ARRAY_BUFFER,
      this.borderPositions ?? new Float32Array(),
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    const texture = gl.createTexture();
    if (!texture) throw new Error('No se pudo crear la textura.');
    this.gpuCleanup.push(() => gl.deleteTexture(texture));
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
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([13, 34, 45, 255]),
    );
    this.graphics = {
      earth,
      atmosphere,
      borders,
      stars,
      sphereVao,
      starVao,
      borderVao,
      borderBuffer,
      texture,
      indexCount: mesh.indices.length,
    };
    gl.useProgram(earth.handle);
    gl.uniform1i(earth.uniforms.get('uEarth') ?? null, 0);
    if (this.bitmap) this.uploadTexture();
    gl.bindVertexArray(null);
  }

  private releaseGraphics(): void {
    for (const cleanup of this.gpuCleanup.splice(0)) cleanup();
    this.graphics = null;
  }

  private uploadTexture(): void {
    const gl = this.gl!;
    if (!this.graphics || !this.bitmap) return;
    gl.bindTexture(gl.TEXTURE_2D, this.graphics.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.bitmap,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  private async loadTexture(): Promise<void> {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}maps/earth.jpg`,
        { signal: this.abort.signal },
      );
      if (!response.ok) throw new Error('Imagen no disponible.');
      const bitmap = await createImageBitmap(await response.blob(), {
        imageOrientation: 'none',
        premultiplyAlpha: 'none',
      });
      if (this.destroyed) {
        bitmap.close();
        return;
      }
      this.bitmap = bitmap;
      if (!this.contextLost) this.uploadTexture();
      this.imageLoaded = true;
      this.invalidate();
    } catch {
      if (!this.destroyed)
        this.report(
          'error',
          'No se pudo cargar la imagen de la Tierra. Puedes volver a intentarlo.',
        );
    }
  }

  private async loadBorders(): Promise<void> {
    if (this.borderLoading || this.borderPositions || this.destroyed) return;
    this.borderLoading = true;
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}maps/borders.bin`,
        { signal: this.abort.signal },
      );
      if (!response.ok) throw new Error('Fronteras no disponibles.');
      const borders = decodeBorders(await response.arrayBuffer());
      if (this.destroyed) return;
      this.borderPositions = borders.positions;
      this.countryCount = borders.countryCount;
      if (!this.contextLost && this.graphics) {
        const gl = this.gl!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.graphics.borderBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, borders.positions, gl.STATIC_DRAW);
      }
      if (!this.contextLost && this.ready) this.report('ready');
      this.invalidate();
    } catch {
      if (!this.destroyed && !this.contextLost && this.ready)
        this.report(
          'ready',
          'Las fronteras no están disponibles. Puedes seguir explorando la Tierra.',
        );
    } finally {
      this.borderLoading = false;
    }
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
      const before = [...this.pointers.values()];
      this.pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        button: previous.button,
      });
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (this.pointers.size >= 2) {
        const after = [...this.pointers.values()];
        const a = before[0]!;
        const b = before[1]!;
        const c = after[0]!;
        const d = after[1]!;
        const previousDistance = Math.hypot(a.x - b.x, a.y - b.y);
        const nextDistance = Math.hypot(c.x - d.x, c.y - d.y);
        if (nextDistance > 1 && previousDistance > 1)
          this.orbit.range = clamp(
            (this.orbit.range * previousDistance) / nextDistance,
            MIN_RANGE,
            MAX_RANGE,
          );
        this.orbit.tilt = clamp(
          this.orbit.tilt + ((c.y + d.y - a.y - b.y) / 2) * 0.006,
          0,
          MAX_TILT,
        );
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
        this.invalidate();
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
    const sunTimer = window.setInterval(() => {
      this.sun = sunDirection();
      if (this.options.lighting) this.invalidate();
    }, 60_000);
    this.cleanup.push(() => window.clearInterval(sunTimer));
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
    const width = Math.max(1, Math.round(this.cssWidth * this.pixelRatio));
    const height = Math.max(1, Math.round(this.cssHeight * this.pixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (!this.cameraTouched)
      this.orbit.range = homeRange(this.cssWidth / this.cssHeight);
    this.describe();
    this.invalidate();
  }

  private interact(): void {
    this.cameraTouched = true;
    this.options.autoRotate = false;
    this.options.onInteraction();
  }

  private changed(): void {
    this.orbit.longitude = wrapLongitude(this.orbit.longitude);
    this.describe();
    this.invalidate();
  }

  private describe(): void {
    const position = describePosition(cameraPose(this.orbit).eye);
    this.host.dataset.cameraHeight = position.heightM.toFixed(2);
    this.host.dataset.cameraLongitude = position.longitude.toFixed(5);
    this.host.dataset.cameraLatitude = position.latitude.toFixed(5);
    this.host.dataset.cameraPitch = (-90 + degrees(this.orbit.tilt)).toFixed(2);
  }

  private invalidate(): void {
    if (
      !this.raf &&
      !this.destroyed &&
      !this.contextLost &&
      this.intersecting &&
      !document.hidden
    )
      this.raf = requestAnimationFrame((time) => this.frame(time));
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
    const rotating =
      this.ready && this.options.autoRotate && !this.options.reducedMotion;
    if (rotating && this.lastFrame)
      this.orbit.longitude = wrapLongitude(
        this.orbit.longitude +
          Math.min((time - this.lastFrame) / 1_000, 0.1) * 0.65,
      );
    this.lastFrame = time;
    try {
      this.draw();
      if (this.imageLoaded && !this.firstTextureDraw) {
        this.firstTextureDraw = true;
        this.ready = true;
        this.report('ready');
        if (this.options.countriesVisible) void this.loadBorders();
      } else if (this.imageLoaded && !this.ready) {
        this.ready = true;
        this.report('ready');
      }
    } catch {
      this.ready = false;
      this.report(
        'error',
        'No se pudo dibujar el planeta. Puedes volver a intentarlo.',
      );
      return;
    }
    if (this.ready && this.options.autoRotate && !this.options.reducedMotion)
      this.invalidate();
  }

  private draw(): void {
    const gl = this.gl;
    const gpu = this.graphics;
    if (!gl || !gpu || gl.isContextLost()) return;
    const pose = cameraPose(this.orbit);
    lookAt(this.view, pose.eye, pose.target, pose.up);
    perspective(
      this.projection,
      this.cssWidth / this.cssHeight,
      Math.max(0.000001, this.orbit.range * 0.001),
      Math.hypot(...pose.eye) + 3,
    );
    multiply(this.mvp, this.projection, this.view);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(5 / 255, 10 / 255, 16 / 255, 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(gpu.stars.handle);
    gl.uniformMatrix4fv(
      gpu.stars.uniforms.get('uView') ?? null,
      false,
      this.view,
    );
    gl.uniformMatrix4fv(
      gpu.stars.uniforms.get('uProjection') ?? null,
      false,
      this.projection,
    );
    gl.uniform1f(
      gpu.stars.uniforms.get('uPixelRatio') ?? null,
      this.pixelRatio,
    );
    gl.bindVertexArray(gpu.starVao);
    gl.drawArrays(gl.POINTS, 0, 512);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.useProgram(gpu.earth.handle);
    gl.uniformMatrix4fv(
      gpu.earth.uniforms.get('uMvp') ?? null,
      false,
      this.mvp,
    );
    gl.uniform3fv(gpu.earth.uniforms.get('uEye') ?? null, pose.eye);
    gl.uniform3fv(gpu.earth.uniforms.get('uSun') ?? null, this.sun);
    gl.uniform1f(
      gpu.earth.uniforms.get('uLighting') ?? null,
      Number(this.options.lighting),
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
    gl.bindVertexArray(gpu.sphereVao);
    gl.drawElements(gl.TRIANGLES, gpu.indexCount, gl.UNSIGNED_SHORT, 0);
    this.drawCalls = 2;
    gl.depthMask(false);
    if (this.options.countriesVisible && this.borderPositions) {
      gl.useProgram(gpu.borders.handle);
      gl.uniformMatrix4fv(
        gpu.borders.uniforms.get('uMvp') ?? null,
        false,
        this.mvp,
      );
      gl.bindVertexArray(gpu.borderVao);
      gl.drawArrays(gl.LINES, 0, this.borderPositions.length / 3);
      this.drawCalls += 1;
    }
    gl.cullFace(gl.FRONT);
    gl.useProgram(gpu.atmosphere.handle);
    gl.uniformMatrix4fv(
      gpu.atmosphere.uniforms.get('uMvp') ?? null,
      false,
      this.mvp,
    );
    gl.uniform3fv(gpu.atmosphere.uniforms.get('uEye') ?? null, pose.eye);
    gl.uniform3fv(gpu.atmosphere.uniforms.get('uSun') ?? null, this.sun);
    gl.uniform1f(
      gpu.atmosphere.uniforms.get('uLighting') ?? null,
      Number(this.options.lighting),
    );
    gl.bindVertexArray(gpu.sphereVao);
    gl.drawElements(gl.TRIANGLES, gpu.indexCount, gl.UNSIGNED_SHORT, 0);
    this.drawCalls += 1;
    gl.depthMask(true);
    gl.bindVertexArray(null);
    this.frames += 1;
    this.host.dataset.frameCount = String(this.frames);
    this.host.dataset.drawCalls = String(this.drawCalls);
    this.describe();
  }

  home(): void {
    this.interact();
    this.cameraTouched = false;
    this.orbit = {
      longitude: -15,
      latitude: 25,
      range: homeRange(this.cssWidth / this.cssHeight),
      tilt: 0,
    };
    this.changed();
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
  setCountriesVisible(value: boolean): void {
    this.options.countriesVisible = value;
    if (value && this.imageLoaded) void this.loadBorders();
    this.invalidate();
  }
  setLighting(value: boolean): void {
    this.options.lighting = value;
    this.invalidate();
  }
  setReducedMotion(value: boolean): void {
    this.options.reducedMotion = value;
    this.lastFrame = 0;
    this.invalidate();
  }

  getSnapshot(): GlobeSnapshot {
    return {
      ...describePosition(cameraPose(this.orbit).eye),
      pitch: -90 + degrees(this.orbit.tilt),
      frameCount: this.frames,
      drawCalls: this.drawCalls,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      countryCount: this.countryCount,
      ready: this.ready,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort.abort();
    cancelAnimationFrame(this.raf);
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.pointers.clear();
    this.releaseGraphics();
    this.bitmap?.close();
    this.bitmap = null;
    this.borderPositions = null;
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }
}
