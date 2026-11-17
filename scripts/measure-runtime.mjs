import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
/* global window, document, MutationObserver */

const [url = 'http://127.0.0.1:4173/atlas/', output] = process.argv.slice(2);
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  await page.addInitScript(() => {
    const metrics = {
      globeReadyMs: null,
      countriesReadyMs: null,
      longTasks: [],
    };
    window.atlasMeasurement = metrics;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        metrics.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
    const observer = new MutationObserver(() => {
      const element = document.querySelector('[data-engine-state]');
      if (
        metrics.globeReadyMs === null &&
        element?.getAttribute('data-engine-state') === 'ready'
      ) {
        metrics.globeReadyMs = performance.now();
      }
      if (
        metrics.countriesReadyMs === null &&
        Number(element?.getAttribute('data-country-count')) > 170
      ) {
        metrics.countriesReadyMs = performance.now();
      }
      if (
        metrics.globeReadyMs !== null &&
        (!element?.hasAttribute('data-country-count') ||
          metrics.countriesReadyMs !== null)
      ) {
        observer.disconnect();
      }
    });
    observer.observe(document, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const element = document.querySelector('[data-engine-state]');
      return (
        window.atlasMeasurement.globeReadyMs !== null &&
        (!element?.hasAttribute('data-country-count') ||
          window.atlasMeasurement.countriesReadyMs !== null)
      );
    },
    null,
    { timeout: 90_000 },
  );
  const result = await page.evaluate(() => {
    const metrics = window.atlasMeasurement;
    const resources = performance.getEntriesByType('resource');
    const scripts = resources.filter((entry) =>
      new URL(entry.name).pathname.endsWith('.js'),
    );
    return {
      globeReadyMs: Math.round(metrics.globeReadyMs),
      ...(metrics.countriesReadyMs !== null && {
        countriesReadyMs: Math.round(metrics.countriesReadyMs),
      }),
      longTaskCount: metrics.longTasks.length,
      longTaskDurationMs: Math.round(
        metrics.longTasks.reduce((sum, value) => sum + value, 0),
      ),
      javascriptDecodedBytes: scripts.reduce(
        (sum, entry) => sum + entry.decodedBodySize,
        0,
      ),
      resourceDecodedBytes: resources.reduce(
        (sum, entry) => sum + entry.decodedBodySize,
        0,
      ),
      requestCount: resources.length,
    };
  });
  const report = {
    measuredAt: new Date().toISOString(),
    url,
    viewport: { width: 1280, height: 850, deviceScaleFactor: 1 },
    rendering:
      'Chromium + SwiftShader, cold browser, reduced motion, local static server',
    note: 'Readiness markers measure application initialization; this is not a physical-device FPS benchmark.',
    ...result,
  };
  if (output) {
    await mkdir(new URL('../docs/performance/', import.meta.url), {
      recursive: true,
    });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  await browser.close();
}
