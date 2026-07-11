// Shared headless-browser harness: boots a Vite dev server in-process and a
// headless Chromium (preinstalled at /opt/pw-browsers) with software WebGL.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

export async function launch({ port = 5199 } = {}) {
  const server = await createServer({
    server: { port, host: '127.0.0.1', strictPort: true },
    logLevel: 'silent',
  });
  await server.listen();

  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--mute-audio',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  const close = async () => {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  };

  return { page, errors, close, url: `http://127.0.0.1:${port}` };
}

export async function loadLevel(page, url, level, { timeout = 30000 } = {}) {
  await page.goto(`${url}/?level=${level}&test=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__game && window.__game.playing === true,
    null,
    { timeout }
  );
  // let textures/shaders settle and a few frames render
  await page.waitForTimeout(1200);
}
