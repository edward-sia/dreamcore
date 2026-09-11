// Capture all room views and their live interaction inventories for review.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, loadLevel } from './browser.mjs';

const out = 'shots/review';
mkdirSync(out, { recursive: true });
const { page, errors, close, url } = await launch({ port: 5197 });
try {
  const requested = process.argv.slice(2).map(Number).filter(Number.isInteger);
  for (const id of requested.length ? requested : Array.from({ length: 20 }, (_, i) => i + 1)) {
    await loadLevel(page, url, id);
    if (id === 20) {
      await page.evaluate(() => {
        const g = (window as any).__game;
        g.level.debugInteract(g.level._backPanel);
        g.player.teleport(0.95, 0.95, Math.PI / 2);
      });
    }
    if (id === 19) await page.evaluate(() => (window as any).__game.player.teleport(0, -0.5, Math.PI / 2, 1.8));
    const inventory = await page.evaluate(() => {
      const g = (window as any).__game;
      return [...g.interaction._items].map(([object, item]) => {
        const box = new object.position.constructor();
        object.getWorldPosition(box);
        return { prompt: item.prompt, distance: item.distance, enabled: item.enabled, position: box.toArray() };
      });
    });
    writeFileSync(`${out}/level${id}-items.json`, JSON.stringify(inventory, null, 2));
    for (const hour of id >= 16 ? ['night', 'morning', 'evening'] : ['night']) {
      if (id >= 16) {
        await page.evaluate(h => {
          const hrs = (window as any).__game.level.hours;
          if (hrs.current !== h) {
            const g = (window as any).__game;
            const clock = [...g.interaction._items].find(([, item]) => item.prompt === 'turn the clock');
            if (!clock || !g.interaction.triggerObject(clock[0])) throw new Error(`Clock refused: ${h}`);
          }
        }, hour);
        await page.waitForFunction(h => {
          const hrs = (window as any).__game.level.hours;
          return hrs.current === h && !hrs.changing;
        }, hour);
        await page.waitForTimeout(700);
      }
      const yaw = await page.evaluate(() => (window as any).__game.level.spawn.yaw);
      for (const [view, offset] of [['front', 0], ['left', 1.9], ['right', -1.9], ['back', Math.PI]] as const) {
        await page.evaluate(({ yaw, offset }) => {
          const p = (window as any).__game.player;
          p.yaw = yaw + offset;
          p.pitch = 0;
        }, { yaw, offset });
        await page.waitForTimeout(150);
        await page.screenshot({ path: `${out}/${String(id).padStart(2, '0')}-${hour}-${view}.png` });
      }
    }
    console.log(`Room ${id}: captured`);
  }
  writeFileSync(`${out}/errors.json`, JSON.stringify(errors, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await close(); }
