// Reproduce the departures frame while looking around, and guard its depth
// separation from the station wall. A puzzle solver cannot catch z-fighting.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, loadLevel } from './browser.mjs';

const output = process.argv[2] ?? 'shots/platform-frame';
mkdirSync(output, { recursive: true });
const { page, errors, close, url } = await launch({ port: 5192 });
try {
  await loadLevel(page, url, 7);
  const depths = await page.evaluate(() => {
    const level = (window as any).__game.level;
    const meshes = level.root.children;
    const frame = meshes.find(o => o.geometry?.type === 'BoxGeometry' && o.geometry.parameters.width === 2.9 && o.geometry.parameters.height === 1.55);
    const wall = meshes.find(o => o.geometry?.type === 'BoxGeometry' && o.geometry.parameters.width === 7.05);
    return {
      wallFront: wall.position.z - wall.geometry.parameters.depth / 2,
      frameBack: frame.position.z + frame.geometry.parameters.depth / 2,
      frameFront: frame.position.z - frame.geometry.parameters.depth / 2,
      display: level._board.position.z,
    };
  });
  console.log('Depths:', depths);
  await page.mouse.move(640, 360);
  await page.evaluate(() => {
    const p = (window as any).__game.player;
    p.teleport(-3.4, 2.6, Math.PI);
    p.pitch = 0.14;
  });
  for (const [i, [x, y]] of [[640, 360], [690, 345], [590, 375], [650, 355]].entries()) {
    await page.mouse.move(x, y, { steps: 8 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${output}/view-${i}.png` });
  }
  // Check the real gaze/E path as well as geometry; all views face the board.
  await page.waitForFunction(() => (window as any).__game.interaction.current === (window as any).__game.level._board);
  await page.keyboard.press('e');
  assert.ok(await page.evaluate(() => (window as any).__game.ui._clues.some(c => c.id === 'l7-board')));
  assert.ok(depths.frameBack <= depths.wallFront - 0.005, 'frame must sit in front of the station wall');
  assert.ok(depths.frameFront < depths.wallFront - 0.05, 'visible frame must not be coplanar with the wall');
  assert.ok(depths.display < depths.frameFront - 0.005, 'display must sit in front of its frame');
  assert.deepEqual(errors, []);
  console.log('PASS Platform frame depth separation, mouse-look views, and board interaction');
} finally { await close(); }
