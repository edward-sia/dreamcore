import assert from 'node:assert/strict';
import { launch } from './browser.mjs';

const { page, errors, close, url } = await launch({ port: 5194, context: { hasTouch: true, viewport: { width: 850, height: 390 } } });
try {
  await page.goto(`${url}/?level=11`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__game?.playing);
  await page.locator('#btn-surface').click();
  await page.waitForFunction(() => (window as any).__game.paused);
  const before = await page.evaluate(() => {
    const g = (window as any).__game;
    (window as any).__reviewCallbacks = 0;
    g.level.after(0.3, () => (window as any).__reviewCallbacks++);
    return { position: g.player.position.toArray(), elapsed: g.levelElapsed };
  });
  await page.keyboard.press('j');
  await page.keyboard.press('e');
  await page.waitForTimeout(900);
  const held = await page.evaluate(() => {
    const g = (window as any).__game;
    return { callbacks: (window as any).__reviewCallbacks, position: g.player.position.toArray(), elapsed: g.levelElapsed, modal: g.ui.modalOpen, input: g.interaction.enabled };
  });
  assert.deepEqual(held, { callbacks: 0, ...before, modal: false, input: false });
  await page.locator('#btn-resume').click();
  await page.waitForFunction(() => (window as any).__reviewCallbacks === 1);
  console.log('PASS pause holds room timers, player, score, and interaction; resume runs the pending callback');

  await page.setViewportSize({ width: 390, height: 850 });
  await page.waitForFunction(() => !(document.getElementById('rotate') as HTMLElement).classList.contains('hidden'));
  await page.evaluate(() => (window as any).__game.level.after(0.3, () => (window as any).__reviewCallbacks++));
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => (window as any).__reviewCallbacks), 1);
  await page.setViewportSize({ width: 850, height: 390 });
  await page.waitForFunction(() => (window as any).__reviewCallbacks === 2);
  console.log('PASS portrait holds room callbacks and landscape resumes them');

  await page.locator('#btn-remember').click();
  await page.evaluate(() => (window as any).__game.level.after(0.3, () => (window as any).__reviewCallbacks++));
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => (window as any).__reviewCallbacks), 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__reviewCallbacks === 3);
  console.log('PASS reading the journal holds the room and closing it resumes');

  await page.locator('#btn-surface').click();
  await page.locator('#btn-quit').click();
  await page.waitForSelector('#menu:not(.hidden)');
  await page.keyboard.press('j');
  assert.equal(await page.evaluate(() => (window as any).__game.ui.modalOpen), false);
  await page.evaluate(() => (window as any).__game.loadLevel(1));
  await page.evaluate(() => document.getElementById('menu')!.classList.add('hidden'));
  await page.waitForFunction(() => (window as any).__game.playing && !(window as any).__game.player.frozen);
  console.log('PASS quit and restart restore playable input without a hidden journal');
  const unexpected = errors.filter(e => !e.includes('status of 500'));
  assert.deepEqual(unexpected, []);
} finally { await close(); }
