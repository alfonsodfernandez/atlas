import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

test('la pantalla carga sin errores ni conexiones externas y permite explorar las fases', async ({
  page,
}) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(request.url());
    }
  });

  await page.goto('./');
  await expect(page).toHaveTitle('ATLAS — Cada lugar, una historia');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'El mundo,tu historia.',
  );
  await expect(page.getByText('Fase 0 · Base preparada')).toBeVisible();
  await expect(
    page.getByText(
      'Ilustración del proyecto · El globo interactivo llega en la fase 1',
    ),
  ).toBeVisible();

  const dataPhase = page.getByRole('button', {
    name: '02 Datos Por construir',
  });
  await dataPhase.click();
  await expect(dataPhase).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#phase-detail')).toContainText(
    'Tu historia, en local',
  );
  await expect(page.locator('#phase-detail')).toContainText(
    'zonas de exclusión',
  );

  const globePhase = page.getByRole('button', { name: '01 Globo Siguiente' });
  await globePhase.click();
  await expect(globePhase).toHaveAttribute('aria-pressed', 'true');
  await expect(dataPhase).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#phase-detail')).toContainText(
    'Dar vida al planeta',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('la privacidad se consulta con teclado y devuelve el foco al cerrar', async ({
  page,
}) => {
  await page.goto('./');
  const trigger = page.getByRole('button', { name: 'Privacidad', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Explorar sin exponerte.' });

  // Rapid reopen must survive the previous native dialog close event.
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await test.step(`Abrir y cerrar con Escape, ciclo ${cycle}`, async () => {
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('todavía no permite importar datos');
      await expect(dialog).toContainText(
        'Nunca subas un archivo original de Timeline',
      );
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
