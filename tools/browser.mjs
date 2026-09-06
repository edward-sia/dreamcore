// Shared headless-browser harness: boots a Vite dev server in-process and a
// headless Chromium with software WebGL. The browser is found in this order:
// $CHROMIUM_PATH, /opt/pw-browsers/chromium, then Playwright's own cache.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function listDir(p) {
  try { return readdirSync(p); } catch { return []; }
}

export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  const roots = [
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),   // macOS
    join(homedir(), '.cache', 'ms-playwright'),               // linux
  ];
  const candidates = [];
  for (const root of roots) {
    for (const d of listDir(root).sort().reverse()) {          // newest build first
      const base = join(root, d);
      if (d.startsWith('chromium_headless_shell-')) {
        for (const sub of listDir(base)) candidates.push(join(base, sub, 'chrome-headless-shell'));
      } else if (d.startsWith('chromium-')) {
        for (const sub of listDir(base)) {
          candidates.push(join(base, sub, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
          candidates.push(join(base, sub, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'));
          candidates.push(join(base, sub, 'chrome'));
        }
      }
    }
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

const EXECUTABLE = findChromium();
if (!EXECUTABLE) {
  throw new Error(
    'No Chromium found. Set CHROMIUM_PATH to a Chromium/Chrome binary ' +
    '(Playwright\'s chrome-headless-shell works: npx playwright install chromium).'
  );
}

export async function launch({ port = 5199, context = {} } = {}) {
  // No HMR and no file watcher: a run must not reload the page because
  // something edited src/ while it was in flight (that reload destroys the
  // page context mid-test and reads as a room failure).
  const server = await createServer({
    server: { port, host: '127.0.0.1', strictPort: true, hmr: false, watch: null },
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
  // `context` lets a caller ask for touch emulation or a phone-sized viewport
  // (tools/touchtest.mjs); everything else gets the desktop page it always had.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, ...context });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  const close = async () => {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  };

  return { page, errors, close, browser, url: `http://127.0.0.1:${port}` };
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
