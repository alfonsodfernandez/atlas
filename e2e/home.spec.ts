import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });
test.setTimeout(30_000);

const globeEngine = (page: Page) => page.getByTestId('atlas-globe');
const globeStage = (page: Page) =>
  page.getByRole('region', { name: 'Globo terráqueo 3D', exact: true });

async function waitForScene(page: Page) {
  await expect(globeEngine(page)).toHaveAttribute('data-draw-calls', '2');
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
    const target = window as Window & { atlasFrameHash?: number };
    delete target.atlasFrameHash;
    const observer = new MutationObserver(() => {
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
      for (let index = 0; index < pixels.length; index += 1) {
        hash = Math.imul(hash ^ pixels[index]!, 16_777_619);
      }
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

test('el globo original carga su textura y controles de cámara con una descarga pequeña', async ({
  page,
}) => {
  const assertRuntime = observeRuntime(page);
  await installPixelProbe(page);
  await page.goto('./');
  await expect(page).toHaveTitle('ATLAS — Cada lugar, una historia');
  await waitForGlobe(page);
  await waitForScene(page);
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
      textureBytes: entries.find(
        (entry) =>
          new URL(entry.name).pathname === '/atlas/maps/atlas-earth.png',
      )?.decodedBodySize,
      paths: entries.map((entry) => new URL(entry.name).pathname),
    };
  });
  expect(resources.javascriptBytes).toBeGreaterThan(0);
  expect(resources.javascriptBytes).toBeLessThanOrEqual(65_536);
  expect(resources.decodedBytes).toBeLessThanOrEqual(144 * 1_024);
  expect(resources.textureBytes).toBeGreaterThan(0);
  expect(resources.textureBytes).toBeLessThanOrEqual(80 * 1_024);
  expect(resources.paths.some((path) => /cesium|\/Workers\//i.test(path))).toBe(
    false,
  );
  expect(resources.paths).toContain('/atlas/maps/atlas-earth.png');
  expect(resources.paths).not.toContain('/atlas/maps/borders.bin');
  expect(resources.paths).not.toContain('/atlas/maps/earth.jpg');
  expect(resources.paths).not.toContain('/atlas/maps/countries.geojson');
  const credits = page.locator('footer.credits');
  await expect(credits).toContainText('Cartografía original de ATLAS');
  await expect(credits).not.toContainText(/NASA|Natural Earth/);

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

  const grid = page.getByRole('button', {
    name: 'Cuadrícula geográfica',
    exact: true,
  });
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
  const lighting = page.getByRole('button', {
    name: 'Iluminación día y noche',
    exact: true,
  });
  await expect(lighting).toHaveAttribute('aria-pressed', 'true');
  await expectIdleRenderer(page);
  const originalFrame = await captureNextCanvasFrame(page, () =>
    lighting.click(),
  );
  await expect(lighting).toHaveAttribute('aria-pressed', 'false');
  const gridFrame = await captureNextCanvasFrame(page, () => grid.click());
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  expect(gridFrame).not.toBe(originalFrame);
  await waitForScene(page);
  const restoredFrame = await captureNextCanvasFrame(page, () => grid.click());
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
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
  expect(resolution.pixels).toBeLessThanOrEqual(1_202_000);
  expect(resolution.ratio).toBeLessThanOrEqual(1.51);
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
  await globeStage(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(rotation).toHaveAttribute('aria-pressed', 'false');
  await expectIdleRenderer(page);
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
  page.on('pageerror', (error) => uncaughtErrors.push(error.message));
  await page.goto('./');
  await waitForGlobe(page);
  await waitForScene(page);
  const canvas = globeEngine(page).locator('canvas');
  const originalCanvas = await canvas.elementHandle();
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
  expect(await originalCanvas?.evaluate((node) => node.isConnected)).toBe(true);
  expect(await frameCount(page)).toBeGreaterThan(initialFrames);
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await expectIdleRenderer(page);
  expect(uncaughtErrors).toEqual([]);
});

test('la privacidad conserva el foco al cerrar y reabrir rápidamente', async ({
  page,
}) => {
  await page.goto('./');
  const trigger = page.getByRole('button', { name: 'Privacidad', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Explorar sin exponerte.' });

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await test.step(`Abrir y cerrar con Escape, ciclo ${cycle}`, async () => {
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Timeline');
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });

    await test.step(`Reabrir y cerrar con el botón, ciclo ${cycle}`, async () => {
      await trigger.press('Enter');
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole('button', { name: 'Entendido', exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }
});

test('la vista accesible y el proyecto se pueden consultar sin manipular el globo', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('button', { name: 'Vista accesible', exact: true })
    .click();
  const accessible = page.getByRole('dialog', { name: 'Atlas, sin barreras.' });
  await expect(accessible).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(accessible).not.toBeVisible();

  await page.getByRole('button', { name: 'El proyecto', exact: true }).click();
  const project = page.getByRole('dialog', {
    name: 'Estamos construyendo Atlas.',
  });
  await expect(project).toBeVisible();
  const dataPhase = project.getByRole('button', {
    name: '02 Datos Por construir',
  });
  await dataPhase.click();
  await expect(dataPhase).toHaveAttribute('aria-pressed', 'true');
  await expect(project.locator('#phase-detail')).toContainText(
    'Tu historia, en local',
  );
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
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('button', { name: 'Vista accesible', exact: true })
    .click();
  const accessible = page.getByRole('dialog', { name: 'Atlas, sin barreras.' });
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
