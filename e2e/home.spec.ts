import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });
test.setTimeout(30_000);

const globeEngine = (page: Page) => page.getByTestId('atlas-globe');
const globeStage = (page: Page) =>
  page.getByRole('region', { name: 'Globo terráqueo 3D', exact: true });

interface CanvasFrameMetrics {
  width: number;
  height: number;
  highlightedPixels: number;
  bounds: { left: number; right: number; bottom: number; top: number };
}

async function waitForScene(page: Page) {
  await expect(globeEngine(page)).toHaveAttribute('data-draw-calls', '1');
}

async function frameCount(page: Page) {
  return Number(await globeEngine(page).getAttribute('data-frame-count'));
}

async function expectIdleRenderer(page: Page) {
  await expect
    .poll(async () => {
      const before = await frameCount(page);
      // This is the measured idle interval, not a delay used to wait for loading.
      const after = await globeEngine(page).evaluate(
        (element) =>
          new Promise<number>((resolve) => {
            window.setTimeout(
              () =>
                resolve(Number((element as HTMLElement).dataset.frameCount)),
              400,
            );
          }),
      );
      return after - before;
    })
    .toBe(0);
}

async function installPixelProbe(page: Page) {
  await page.addInitScript(() => {
    const capture = new MutationObserver(() => {
      const element = document.querySelector('[data-testid="atlas-globe"]');
      if (element?.getAttribute('data-engine-state') !== 'ready') return;
      const canvas = element.querySelector('canvas');
      const gl = canvas?.getContext('webgl2');
      if (!canvas || !gl) return;
      // Read the real frame before the compositor discards its non-preserved buffer.
      const colors: number[][] = [];
      for (const x of [0.36, 0.5, 0.64]) {
        for (const y of [0.36, 0.5, 0.64]) {
          const pixel = new Uint8Array(4);
          gl.readPixels(
            Math.floor(canvas.width * x),
            Math.floor(canvas.height * y),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel,
          );
          colors.push(Array.from(pixel));
        }
      }
      (window as Window & { atlasPixelProbe?: number[][] }).atlasPixelProbe =
        colors;
      capture.disconnect();
    });
    capture.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-engine-state'],
    });
  });
}

async function captureNextCanvasFrame(page: Page, action: () => Promise<void>) {
  await globeEngine(page).evaluate((element) => {
    const canvas = element.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    if (!canvas || !gl) throw new Error('No se puede leer el fotograma WebGL.');
    const target = window as Window & {
      atlasFrameHash?: number;
      atlasFrameMetrics?: CanvasFrameMetrics;
    };
    delete target.atlasFrameHash;
    delete target.atlasFrameMetrics;
    const observer = new MutationObserver(() => {
      // Context restoration can draw a placeholder before its map is uploaded.
      if (element.getAttribute('data-engine-state') !== 'ready') return;
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(
        0,
        0,
        canvas.width,
        canvas.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      let hash = 2_166_136_261;
      let highlightedPixels = 0;
      const bounds = {
        left: canvas.width,
        right: -1,
        bottom: canvas.height,
        top: -1,
      };
      for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index]!;
        const g = pixels[index + 1]!;
        const b = pixels[index + 2]!;
        if (r > g * 1.08 && g > b * 1.1) highlightedPixels += 1;
        // The clear color at the corner distinguishes the actual sphere from canvas.
        if (
          Math.abs(r - pixels[0]!) +
            Math.abs(g - pixels[1]!) +
            Math.abs(b - pixels[2]!) >
          15
        ) {
          const pixel = index / 4;
          const x = pixel % canvas.width;
          const y = Math.floor(pixel / canvas.width);
          bounds.left = Math.min(bounds.left, x);
          bounds.right = Math.max(bounds.right, x);
          bounds.bottom = Math.min(bounds.bottom, y);
          bounds.top = Math.max(bounds.top, y);
        }
        for (let channel = 0; channel < 4; channel += 1) {
          hash = Math.imul(hash ^ pixels[index + channel]!, 16_777_619);
        }
      }
      target.atlasFrameMetrics = {
        width: canvas.width,
        height: canvas.height,
        highlightedPixels,
        bounds,
      };
      target.atlasFrameHash = hash >>> 0;
      observer.disconnect();
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['data-frame-count'],
    });
  });
  await action();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { atlasFrameHash?: number }).atlasFrameHash,
      ),
    )
    .not.toBeUndefined();
  return page.evaluate(
    () => (window as Window & { atlasFrameHash?: number }).atlasFrameHash,
  );
}

async function frameMetrics(page: Page) {
  const metrics = await page.evaluate(
    () =>
      (window as Window & { atlasFrameMetrics?: CanvasFrameMetrics })
        .atlasFrameMetrics,
  );
  if (!metrics) throw new Error('No se ha leído el fotograma WebGL.');
  return metrics;
}

function observeRuntime(page: Page) {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  const failedAssets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      /^https?:$/.test(url.protocol) &&
      url.origin !== 'http://127.0.0.1:4173'
    ) {
      externalRequests.push(request.url());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });

  return () => {
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
    expect(externalRequests).toEqual([]);
  };
}

async function waitForGlobe(page: Page) {
  await expect(globeEngine(page)).toHaveAttribute(
    'data-engine-state',
    /^(ready|error)$/,
    {
      timeout: 15_000,
    },
  );
  await expect(globeEngine(page)).toHaveAttribute('data-engine-state', 'ready');
  const canvas = globeEngine(page).locator('canvas');
  await expect(canvas).toBeVisible();
  expect(
    await canvas.evaluate(
      (element) =>
        element instanceof HTMLCanvasElement &&
        element.width > 0 &&
        element.height > 0,
    ),
  ).toBe(true);
}

async function cameraValue(page: Page, attribute: string) {
  const value = await globeEngine(page).getAttribute(attribute);
  if (value === null || !Number.isFinite(Number(value))) {
    throw new Error(`No se ha recibido la posición de cámara: ${attribute}`);
  }
  return Number(value);
}

test('el globo cartográfico carga su mapa y controles con una descarga pequeña', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name.startsWith('mobile')) {
    await page.setViewportSize({ width: 320, height: 700 });
  }
  const assertRuntime = observeRuntime(page);
  await installPixelProbe(page);
  await page.goto('./');
  await expect(page).toHaveTitle('ATLAS — Explora el mundo');
  await waitForGlobe(page);
  await waitForScene(page);
  await expect(globeEngine(page)).toHaveAttribute('data-map-detail', 'base');
  const pixels = await page.evaluate(
    () => (window as Window & { atlasPixelProbe?: number[][] }).atlasPixelProbe,
  );
  expect(pixels).toHaveLength(9);
  const visibleColors = new Set(
    pixels!
      .filter(([r, g, b]) => r! + g! + b! > 30)
      .map((rgba) =>
        rgba
          .slice(0, 3)
          .map((channel) => Math.floor(channel / 8))
          .join(','),
      ),
  );
  expect(visibleColors.size).toBeGreaterThan(1);

  const resources = await page.evaluate(() => {
    const entries = performance.getEntriesByType(
      'resource',
    ) as PerformanceResourceTiming[];
    const navigation = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    return {
      javascriptBytes: entries
        .filter((entry) => new URL(entry.name).pathname.endsWith('.js'))
        .reduce((bytes, entry) => bytes + entry.decodedBodySize, 0),
      decodedBytes:
        (navigation?.decodedBodySize ?? 0) +
        entries.reduce((bytes, entry) => bytes + entry.decodedBodySize, 0),
      mapBytes: entries.find(
        (entry) => new URL(entry.name).pathname === '/atlas/maps/atlas-map.png',
      )?.decodedBodySize,
      paths: entries.map((entry) => new URL(entry.name).pathname),
    };
  });
  expect(resources.javascriptBytes).toBeGreaterThan(0);
  expect(resources.javascriptBytes).toBeLessThanOrEqual(40 * 1_024);
  expect(resources.decodedBytes).toBeLessThanOrEqual(96 * 1_024);
  expect(resources.mapBytes).toBeGreaterThan(0);
  expect(resources.mapBytes).toBeLessThanOrEqual(44 * 1_024);
  expect(resources.paths.filter((path) => path.endsWith('.js'))).toHaveLength(
    1,
  );
  expect(resources.paths.some((path) => /cesium|\/Workers\//i.test(path))).toBe(
    false,
  );
  expect(
    resources.paths.filter((path) => path.startsWith('/atlas/maps/')),
  ).toEqual(['/atlas/maps/atlas-map.png']);
  const credits = page.locator('.credits');
  await expect(credits).toContainText('Cartografía simplificada');
  await expect(
    credits.getByRole('link', { name: 'Natural Earth', exact: true }),
  ).toBeVisible();
  await expect(credits).not.toContainText('NASA');

  const initialHeight = await cameraValue(page, 'data-camera-height');
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await expect
    .poll(() => cameraValue(page, 'data-camera-height'))
    .toBeLessThan(initialHeight);
  const closerHeight = await cameraValue(page, 'data-camera-height');
  await page.getByRole('button', { name: 'Alejar', exact: true }).click();
  await expect
    .poll(() => cameraValue(page, 'data-camera-height'))
    .toBeGreaterThan(closerHeight);
  const zoomButton = page.getByRole('button', { name: 'Acercar', exact: true });
  await zoomButton.focus();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Acercar');
  const tooltipBounds = await tooltip.boundingBox();
  expect(tooltipBounds?.width).toBeLessThan(220);
  expect(tooltipBounds?.height).toBeLessThan(90);
  await page.keyboard.press('Escape');
  await expect(tooltip).not.toBeVisible();

  const initialLongitude = await cameraValue(page, 'data-camera-longitude');
  await globeStage(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => cameraValue(page, 'data-camera-longitude'))
    .not.toBe(initialLongitude);
  await page.keyboard.press('Home');
  await expect
    .poll(async () =>
      Math.abs((await cameraValue(page, 'data-camera-height')) - initialHeight),
    )
    .toBeLessThan(1);
  const initialPitch = await cameraValue(page, 'data-camera-pitch');
  await page
    .getByRole('button', { name: 'Cambiar inclinación', exact: true })
    .click();
  await expect
    .poll(() => cameraValue(page, 'data-camera-pitch'))
    .not.toBe(initialPitch);

  const borders = page.getByRole('switch', {
    name: 'Fronteras',
    exact: true,
  });
  await expect(borders).toBeChecked();
  await expectIdleRenderer(page);
  const originalFrame = await captureNextCanvasFrame(page, () =>
    globeStage(page).press('Home'),
  );
  const scene = await frameMetrics(page);
  const shortSide = Math.min(scene.width, scene.height);
  expect(scene.bounds.right - scene.bounds.left).toBeGreaterThan(
    shortSide * 0.7,
  );
  expect(scene.bounds.top - scene.bounds.bottom).toBeGreaterThan(
    shortSide * 0.7,
  );
  expect(
    Math.abs((scene.bounds.left + scene.bounds.right) / 2 - scene.width / 2),
  ).toBeLessThan(scene.width * 0.04);
  expect(
    Math.abs((scene.bounds.bottom + scene.bounds.top) / 2 - scene.height / 2),
  ).toBeLessThan(scene.height * 0.04);
  const visibleHeadings = await page.locator('main h1').evaluateAll(
    (headings) =>
      headings.filter((heading) => {
        const bounds = heading.getBoundingClientRect();
        return bounds.width > 2 && bounds.height > 2;
      }).length,
  );
  expect(visibleHeadings).toBe(0);
  const focusStyle = await globeStage(page).evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, shadow: style.boxShadow };
  });
  expect(focusStyle).toEqual({ outline: 'none', shadow: 'none' });
  const borderlessFrame = await captureNextCanvasFrame(page, () =>
    borders.click(),
  );
  await expect(borders).not.toBeChecked();
  expect(borderlessFrame).not.toBe(originalFrame);
  await waitForScene(page);
  const restoredFrame = await captureNextCanvasFrame(page, () =>
    borders.click(),
  );
  await expect(borders).toBeChecked();
  expect(restoredFrame).toBe(originalFrame);
  await waitForScene(page);

  const rotation = page.getByRole('button', {
    name: 'Rotación automática',
    exact: true,
  });
  await expect(rotation).toBeDisabled();
  await expect(rotation).toHaveAttribute('aria-pressed', 'false');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const resolution = await globeEngine(page)
    .locator('canvas')
    .evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error('Lienzo no válido.');
      return {
        pixels: canvas.width * canvas.height,
        ratio: canvas.width / canvas.getBoundingClientRect().width,
      };
    });
  expect(resolution.pixels).toBeLessThanOrEqual(3_700_000);
  expect(resolution.ratio).toBeLessThanOrEqual(2.01);
  await expectIdleRenderer(page);
  assertRuntime();
});

test('los tres países de ejemplo se pueden visitar y ocultar en el globo real', async ({
  page,
}) => {
  const assertRuntime = observeRuntime(page);
  const detailRequests: string[] = [];
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname === '/atlas/maps/atlas-map-detail.png'
    ) {
      detailRequests.push(request.url());
    }
  });
  await page.goto('./');
  await waitForGlobe(page);
  await expect(globeEngine(page)).toHaveAttribute('data-map-detail', 'base');
  expect(detailRequests).toEqual([]);

  const trigger = page.getByRole('button', {
    name: '3 países · Ejemplo',
    exact: true,
  });
  const dialog = page.getByRole('dialog', {
    name: 'Un ejemplo de Atlas',
    exact: true,
  });
  const borders = page.getByRole('switch', { name: 'Fronteras', exact: true });
  let highlightedFrame: number | undefined;
  for (const country of [
    { name: 'España', longitude: [-10, 5], latitude: [35, 45] },
    { name: 'México', longitude: [-120, -85], latitude: [15, 32] },
    { name: 'Japón', longitude: [125, 150], latitude: [30, 46] },
  ]) {
    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('button', { name: `Ver ${country.name}`, exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(globeStage(page)).toBeFocused();
    const longitude = await cameraValue(page, 'data-camera-longitude');
    const latitude = await cameraValue(page, 'data-camera-latitude');
    expect(longitude).toBeGreaterThan(country.longitude[0]!);
    expect(longitude).toBeLessThan(country.longitude[1]!);
    expect(latitude).toBeGreaterThan(country.latitude[0]!);
    expect(latitude).toBeLessThan(country.latitude[1]!);
    await expect(globeEngine(page)).toHaveAttribute(
      'data-map-detail',
      'detail',
      {
        timeout: 15_000,
      },
    );
    await expectIdleRenderer(page);
    await captureNextCanvasFrame(page, () => borders.click());
    expect((await frameMetrics(page)).highlightedPixels).toBeGreaterThan(50);
    highlightedFrame = await captureNextCanvasFrame(page, () =>
      borders.click(),
    );
    await waitForScene(page);
  }

  await trigger.click();
  const demoSwitch = dialog.getByRole('switch', {
    name: 'Mostrar ejemplo',
    exact: true,
  });
  await expect(demoSwitch).toBeChecked();
  const hiddenFrame = await captureNextCanvasFrame(page, () =>
    demoSwitch.click(),
  );
  await expect(demoSwitch).not.toBeChecked();
  expect((await frameMetrics(page)).highlightedPixels).toBe(0);
  expect(hiddenFrame).not.toBe(highlightedFrame);
  const restoredFrame = await captureNextCanvasFrame(page, () =>
    demoSwitch.click(),
  );
  await expect(demoSwitch).toBeChecked();
  expect(restoredFrame).toBe(highlightedFrame);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(detailRequests).toHaveLength(1);
  await expectIdleRenderer(page);
  assertRuntime();
});

test('la interacción detiene la rotación automática', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  await waitForGlobe(page);
  await waitForScene(page);
  const rotation = page.getByRole('button', {
    name: 'Rotación automática',
    exact: true,
  });
  await expect(rotation).toBeEnabled();
  await expect(rotation).toHaveAttribute('aria-pressed', 'true');
  const initialFrames = await frameCount(page);
  await expect.poll(() => frameCount(page)).toBeGreaterThan(initialFrames);

  await globeEngine(page).evaluate((element) => {
    (element as HTMLElement).style.transform = 'translateY(-200vh)';
  });
  await expectIdleRenderer(page);
  await globeEngine(page).evaluate((element) => {
    (element as HTMLElement).style.transform = '';
  });
  const offscreenFrames = await frameCount(page);
  await expect.poll(() => frameCount(page)).toBeGreaterThan(offscreenFrames);
  await rotation.click();
  await expect(rotation).toHaveAttribute('aria-pressed', 'false');
  await expectIdleRenderer(page);
  await rotation.click();
  await expect(rotation).toHaveAttribute('aria-pressed', 'true');
  const resumedFrames = await frameCount(page);
  await expect.poll(() => frameCount(page)).toBeGreaterThan(resumedFrames);
  await globeStage(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(rotation).toHaveAttribute('aria-pressed', 'false');
  const manualLongitude = await cameraValue(page, 'data-camera-longitude');
  await expectIdleRenderer(page);
  expect(await cameraValue(page, 'data-camera-longitude')).toBe(
    manualLongitude,
  );

  await page
    .getByRole('button', { name: '3 países · Ejemplo', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ver Japón', exact: true }).click();
  await globeStage(page).press('ArrowLeft');
  const interruptedLongitude = await cameraValue(page, 'data-camera-longitude');
  await expectIdleRenderer(page);
  expect(await cameraValue(page, 'data-camera-longitude')).toBe(
    interruptedLongitude,
  );
});

test('el picking sobre España, el zoom con rueda y el modo horizontal funcionan sin solapamientos', async ({
  page,
}, testInfo) => {
  const assertRuntime = observeRuntime(page);
  await page.goto('./');
  await waitForGlobe(page);
  await waitForScene(page);

  const canvas = globeEngine(page).locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('El lienzo no tiene dimensiones visibles.');

  // Center on Spain first via dialog or index, then verify picking on canvas
  if (!testInfo.project.name.startsWith('mobile')) {
    const indexBtn = page.locator('[data-index-country="ES"]');
    await expect(indexBtn).toBeVisible();
    await indexBtn.click();
    await expect
      .poll(() => cameraValue(page, 'data-camera-longitude'))
      .toBeCloseTo(-3.7, 0);
    await expectIdleRenderer(page);

    // Hover directly over Spain at center of viewport
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await expect(globeEngine(page)).toHaveAttribute(
      'data-hovered-country',
      'ES',
    );
    await expect(page.getByTestId('hover-readout')).toContainText('España');

    // Wheel zoom anchored off-center shifts both height and camera target
    const beforeHeight = await cameraValue(page, 'data-camera-height');
    await page.mouse.move(
      bounds.x + bounds.width * 0.56,
      bounds.y + bounds.height * 0.46,
    );
    await page.mouse.wheel(0, -180);
    await expect
      .poll(() => cameraValue(page, 'data-camera-height'))
      .toBeLessThan(beforeHeight);
    await expectIdleRenderer(page);
  } else {
    // Mobile landscape check: no horizontal overflow and no header/controls overlap
    await page.setViewportSize({ width: 667, height: 375 });
    await expectIdleRenderer(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const headerBox = await page.locator('.app-header').boundingBox();
    const controlsBox = await page.locator('.stage-controls').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(headerBox!.y + headerBox!.height).toBeLessThan(controlsBox!.y);
  }

  assertRuntime();
});

test('el arrastre y el pellizco táctil mueven la cámara real', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  await waitForGlobe(page);
  const canvas = globeEngine(page).locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('El lienzo no tiene dimensiones visibles.');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height * 0.45;
  const previousLongitude = await cameraValue(page, 'data-camera-longitude');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 65, y + 15, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(() => cameraValue(page, 'data-camera-longitude'))
    .not.toBe(previousLongitude);
  await expect(
    page.getByRole('button', { name: 'Rotación automática', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expectIdleRenderer(page);

  if (testInfo.project.name.startsWith('mobile')) {
    const previousHeight = await cameraValue(page, 'data-camera-height');
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: x - 25, y, id: 1 },
        { x: x + 25, y, id: 2 },
      ],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: x - 40, y: y + 6, id: 1 },
        { x: x + 40, y: y + 6, id: 2 },
      ],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
    await expect
      .poll(() => cameraValue(page, 'data-camera-height'))
      .toBeLessThan(previousHeight);
  }
});

test('el contexto WebGL se recupera conservando el mapa y los controles', async ({
  page,
}) => {
  const uncaughtErrors: string[] = [];
  const mapRequests: string[] = [];
  page.on('pageerror', (error) => uncaughtErrors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/atlas/maps/')) {
      mapRequests.push(path);
    }
  });
  await page.goto('./');
  await waitForGlobe(page);
  await waitForScene(page);
  await expect(globeEngine(page)).toHaveAttribute('data-map-detail', 'base');
  for (let step = 0; step < 12; step += 1) {
    if ((await cameraValue(page, 'data-camera-height')) < 6_500_000) break;
    await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  }
  await expect(globeEngine(page)).toHaveAttribute('data-map-detail', 'detail', {
    timeout: 15_000,
  });
  await expectIdleRenderer(page);
  const canvas = globeEngine(page).locator('canvas');
  const originalCanvas = await canvas.elementHandle();
  const originalFrame = await captureNextCanvasFrame(page, () =>
    globeStage(page).press('Home'),
  );
  const initialFrames = await frameCount(page);
  const canLoseContext = await canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement))
      throw new Error('Lienzo no válido.');
    const extension = element
      .getContext('webgl2')
      ?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    (
      window as Window & { atlasRestoreContext?: () => void }
    ).atlasRestoreContext = () => extension.restoreContext();
    extension.loseContext();
    return true;
  });
  expect(canLoseContext).toBe(true);
  await expect(page.getByTestId('globe-status')).toHaveAttribute(
    'data-state',
    'error',
  );
  await page.evaluate(() =>
    (
      window as Window & { atlasRestoreContext?: () => void }
    ).atlasRestoreContext?.(),
  );
  await waitForGlobe(page);
  await waitForScene(page);
  await expect(globeEngine(page)).toHaveAttribute('data-map-detail', 'detail');
  // The mobile status message changes layout; compare after its final resize.
  await expectIdleRenderer(page);
  const restoredFrame = await captureNextCanvasFrame(page, () =>
    globeStage(page).press('Home'),
  );
  expect(restoredFrame).toBe(originalFrame);
  expect(await originalCanvas?.evaluate((node) => node.isConnected)).toBe(true);
  expect(await frameCount(page)).toBeGreaterThan(initialFrames);
  expect(mapRequests).toEqual([
    '/atlas/maps/atlas-map.png',
    '/atlas/maps/atlas-map-detail.png',
  ]);
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await expectIdleRenderer(page);
  expect(uncaughtErrors).toEqual([]);
});

test('la privacidad conserva el foco al cerrar y reabrir rápidamente', async ({
  page,
}) => {
  await page.goto('./');
  const trigger = page.getByRole('button', { name: 'Ayuda', exact: true });
  const dialog = page.getByRole('dialog', {
    name: 'Tu historial se queda contigo',
  });

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await test.step(`Abrir y cerrar con Escape, ciclo ${cycle}`, async () => {
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page
        .getByRole('button', { name: 'Privacidad', exact: true })
        .click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Timeline');
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });

    await test.step(`Reabrir y cerrar con el botón, ciclo ${cycle}`, async () => {
      await trigger.press('Enter');
      await page
        .getByRole('button', { name: 'Privacidad', exact: true })
        .click();
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole('button', { name: 'Cerrar ventana', exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }
});

test('la ayuda y la vista accesible se pueden consultar sin manipular el globo', async ({
  page,
}) => {
  await page.goto('./');
  const helpTrigger = page.getByRole('button', { name: 'Ayuda', exact: true });
  await helpTrigger.click();
  const help = page.getByRole('dialog', { name: 'Cómo explorar', exact: true });
  await expect(help).toBeVisible();
  await help
    .getByRole('button', { name: 'Vista accesible', exact: true })
    .click();
  const accessible = page.getByRole('dialog', {
    name: 'Otra forma de explorar',
  });
  await expect(accessible).toBeVisible();
  await accessible
    .getByRole('button', { name: 'Volver a Ayuda', exact: true })
    .click();
  await expect(help).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).not.toBeVisible();
  await expect(helpTrigger).toBeFocused();
});

test('sin WebGL se ofrece una alternativa accesible y la opción de reintentar', async ({
  page,
}) => {
  const uncaughtErrors: string[] = [];
  page.on('pageerror', (error) => uncaughtErrors.push(error.message));
  // Only this failure-mode test disables WebGL. Other cases use the real GPU API.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...options: unknown[]
    ) {
      if (/^(?:webgl2?|experimental-webgl)$/.test(contextId)) return null;
      return Reflect.apply(getContext, this, [contextId, ...options]);
    } as typeof getContext;
  });
  await page.goto('./');
  await expect(page.getByTestId('globe-status')).toHaveAttribute(
    'data-state',
    'error',
    { timeout: 15_000 },
  );
  const retry = page.getByRole('button', {
    name: 'Volver a intentar',
    exact: true,
  });
  const failedCanvas = await globeEngine(page)
    .locator('canvas')
    .elementHandle();
  if (!failedCanvas)
    throw new Error('No se ha creado el lienzo del explorador.');
  await expect(retry).toBeVisible();
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Cómo explorar', exact: true })
    .getByRole('button', { name: 'Vista accesible', exact: true })
    .click();
  const accessible = page.getByRole('dialog', {
    name: 'Otra forma de explorar',
  });
  await expect(accessible).toBeVisible();
  await page.keyboard.press('Escape');
  await retry.click();
  await expect
    .poll(() => failedCanvas.evaluate((node) => node.isConnected))
    .toBe(false);
  await expect(page.getByTestId('globe-status')).toHaveAttribute(
    'data-state',
    'error',
    { timeout: 15_000 },
  );
  expect(uncaughtErrors).toEqual([]);
});
