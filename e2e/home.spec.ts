import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });
test.setTimeout(90_000);

const globeEngine = (page: Page) => page.getByTestId('cesium-globe');
const globeStage = (page: Page) =>
  page.getByRole('region', { name: 'Globo terráqueo 3D', exact: true });

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
      timeout: 45_000,
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

test('el globo real carga mapas locales, fronteras y controles de cámara sin errores', async ({
  page,
}) => {
  const assertRuntime = observeRuntime(page);
  await page.goto('./');
  await expect(page).toHaveTitle('ATLAS — Cada lugar, una historia');
  await waitForGlobe(page);
  await expect
    .poll(
      async () =>
        Number(await globeEngine(page).getAttribute('data-country-count')),
      {
        timeout: 45_000,
      },
    )
    .toBeGreaterThan(170);

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

  const countries = page.getByRole('button', {
    name: 'Fronteras de países',
    exact: true,
  });
  await expect(countries).toHaveAttribute('aria-pressed', 'true');
  await countries.click();
  await expect(countries).toHaveAttribute('aria-pressed', 'false');
  await countries.click();
  await expect(countries).toHaveAttribute('aria-pressed', 'true');
  const lighting = page.getByRole('button', {
    name: 'Iluminación día y noche',
    exact: true,
  });
  await expect(lighting).toHaveAttribute('aria-pressed', 'true');
  await lighting.click();
  await expect(lighting).toHaveAttribute('aria-pressed', 'false');

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
  assertRuntime();
});

test('la interacción detiene la rotación automática', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  await waitForGlobe(page);
  const rotation = page.getByRole('button', {
    name: 'Rotación automática',
    exact: true,
  });
  await expect(rotation).toBeEnabled();
  await expect(rotation).toHaveAttribute('aria-pressed', 'true');
  await globeStage(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(rotation).toHaveAttribute('aria-pressed', 'false');
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
  // Only this failure-mode test disables WebGL. The other tests render Cesium.
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
    { timeout: 45_000 },
  );
  const retry = page.getByRole('button', {
    name: 'Volver a intentar',
    exact: true,
  });
  const failedEngine = await globeEngine(page).elementHandle();
  if (!failedEngine) throw new Error('No se ha montado el explorador.');
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
    .poll(() => failedEngine.evaluate((node) => node.isConnected))
    .toBe(false);
  await expect(page.getByTestId('globe-status')).toHaveAttribute(
    'data-state',
    'error',
    { timeout: 45_000 },
  );
  expect(uncaughtErrors).toEqual([]);
});
