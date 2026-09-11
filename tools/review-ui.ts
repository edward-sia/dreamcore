import assert from 'node:assert/strict';
import { launch, loadLevel } from './browser.mjs';

const { page, errors, close, url } = await launch({ port: 5196 });
// tsx preserves callback names with this helper; Playwright serializes the
// callback alone, so install its name helper in this test page as well.
await page.addInitScript("globalThis.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
const failures: string[] = [];
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
try {
  await loadLevel(page, url, 1);
  await check('new subtitles survive the previous subtitle fade', async () => {
    await page.evaluate(() => (window as any).__game.ui.subtitle('old', 0.02));
    await page.waitForTimeout(100);
    await page.evaluate(() => (window as any).__game.ui.subtitle('new clue', 5));
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#subtitle').isVisible(), true);
  });
  await check('sound captions do not replace the clue being read', async () => {
    await page.evaluate(() => {
      const ui = (window as any).__game.ui;
      ui.subtitle('The door beside you is open.', 5);
      ui.subtitle('[three knocks] — to your left', 3, { voice: 'cue' });
    });
    assert.equal(await page.locator('#subtitle').textContent(), 'The door beside you is open.');
    assert.equal(await page.locator('#sound-cue').textContent(), '[three knocks] — to your left');
  });
  await check('backspace during keypad confirmation cancels the stale submission', async () => {
    await page.evaluate(() => {
      (window as any).__submitted = [];
      (window as any).__game.ui.showKeypad({ length: 3, onSubmit: code => (window as any).__submitted.push(code) });
    });
    await page.keyboard.press('1'); await page.keyboard.press('2'); await page.keyboard.press('3');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(350);
    assert.deepEqual(await page.evaluate(() => (window as any).__submitted), []);
    await page.keyboard.press('4');
    await page.waitForTimeout(350);
    assert.deepEqual(await page.evaluate(() => (window as any).__submitted), ['124']);
  });
  await check('successful keypad entry does not call cancellation', async () => {
    assert.deepEqual(await page.evaluate(() => {
      const calls: string[] = [];
      const ui = (window as any).__game.ui;
      ui.showKeypad({ onSubmit: () => calls.push('submit'), onCancel: () => calls.push('cancel') });
      ui.submitKeypad('1234');
      return calls;
    }), ['submit']);
  });
  await check('putting down a note with E does not immediately reopen it', async () => {
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.ui.showNote({ title: 'note', body: 'read me' });
      g.interaction.current = g.level._note;
    });
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(() => (window as any).__game.ui.modalOpen), false);
  });
  await check('long notes fit and scroll on a short desktop viewport', async () => {
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.evaluate(() => (window as any).__game.ui.showNote({ title: 'long note', body: 'A line of the clue.\n'.repeat(20) }));
    const rect = await page.locator('#note-paper').boundingBox();
    assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 600, JSON.stringify(rect));
  });
  await check('the Hallway note rests above the table', async () => {
    const bottom = await page.evaluate(() => (window as any).__game.level._note.position.y - 0.0025);
    assert.ok(bottom > 0.8, `paper bottom ${bottom}, table top 0.8`);
  });
  await loadLevel(page, url, 2);
  await check('the Pool hides its deep markers until drained', async () => {
    assert.equal(await page.evaluate(() => {
      const level = (window as any).__game.level;
      return level.root.children.filter(o => o.geometry?.type === 'PlaneGeometry' && [0.44, 0.66].includes(o.geometry.parameters.width) && o.position.y < -0.5).every(o => !o.visible);
    }), true);
  });
  await loadLevel(page, url, 5);
  await check('the House needs the full evening order even if the kitchen key is taken early', async () => {
    const open = await page.evaluate(() => {
      const l = (window as any).__game.level;
      l.debugInteract(l._fuse.units.kitchen.unit);
      l.debugInteract(l._keyProp);
      l.debugInteract(l._upDoor);
      return l._doorOpen;
    });
    assert.equal(open, false);
  });
  await loadLevel(page, url, 9);
  await check('the Archive ladder collision follows the moving ladder', async () => {
    const follows = await page.evaluate(() => {
      const l = (window as any).__game.level;
      const old = l._ladder.position.clone();
      l.debugInteract(l._ladder);
      for (let i = 0; i < 100; i++) l.update(0.05, i * 0.05);
      return l.solids.some(b => Math.abs((b.min.x + b.max.x) / 2 - l._ladder.position.x) < 0.02 && Math.abs((b.min.z + b.max.z) / 2 - l._ladder.position.z) < 0.3) && l._ladder.position.distanceTo(old) > 1;
    });
    assert.equal(follows, true);
  });
  await loadLevel(page, url, 20);
  await check('the final bedroom can be entered through the wardrobe with normal movement', async () => {
    await page.waitForFunction(() => !(window as any).__game.player.frozen);
    await page.waitForFunction(() => (window as any).__game.interaction.current === (window as any).__game.level._backPanel);
    await page.keyboard.press('e');
    await page.keyboard.down('w');
    try {
      await page.waitForFunction(() => (window as any).__game.player.position.z < 0.7, null, { timeout: 15000 });
    } finally { await page.keyboard.up('w'); }
    await page.keyboard.down('d');
    try {
      await page.waitForFunction(() => (window as any).__game.player.position.x > 0.85, null, { timeout: 15000 });
    } finally { await page.keyboard.up('d'); }
    assert.ok(await page.evaluate(() => (window as any).__game.level._wardrobeFronts.every(({ door }) => door.isOpen())));
  });
  if (errors.length) failures.push(...errors);
} finally { await close(); }
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
