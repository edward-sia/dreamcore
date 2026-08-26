// Render a level headless and save screenshots from several vantage points.
//   node tools/screenshot.mjs <level> [--port 5199] [--out shots]
// Exits non-zero on console/page errors so agents can gate on it.
import { mkdirSync } from 'node:fs';
import { launch, loadLevel } from './browser.mjs';

const args = process.argv.slice(2);
const level = parseInt(args.find((a) => !a.startsWith('--')) ?? '1', 10);
const port = parseInt(args.includes('--port') ? args[args.indexOf('--port') + 1] : '5199', 10);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'shots';
const hour = args.includes('--hour') ? args[args.indexOf('--hour') + 1] : null;

mkdirSync(out, { recursive: true });

const { page, errors, close, url } = await launch({ port });
let failed = false;
try {
  await loadLevel(page, url, level);

  if (hour) {
    const status = await page.evaluate((h) => {
      const hrs = window.__game.level?.hours;
      if (!hrs) return 'no-hours';
      if (hrs.current === h) return 'already';
      return hrs.set(h) ? 'set' : 'refused';
    }, hour);
    if (status === 'no-hours') throw new Error(`level ${level} has no hours (set --hour only on rooms XVI–XX)`);
    // A refused set would leave the room at the hour it was already at and
    // write a shot named for an hour it does not show — fail instead.
    if (status === 'refused') throw new Error(`level ${level} would not go to '${hour}' (hours: night, morning, evening)`);
    if (status === 'set') {
      await page.waitForFunction(
        (h) => window.__game.level?.hours?.current === h && !window.__game.level.hours.changing,
        hour,
        { timeout: 15000 },
      );
      await page.waitForTimeout(600);         // the lights finish arriving after the blink
    }
  }

  const pad = String(level).padStart(2, '0');
  // spawn view, then look left / right / behind
  const views = [
    ['a-spawn', 0],
    ['b-left', 1.9],
    ['c-right', -1.9],
    ['d-back', Math.PI],
  ];
  for (const [name, dyaw] of views) {
    await page.evaluate((d) => {
      const p = window.__game.player;
      p.yaw = (window.__spawnYaw ??= p.yaw) + d;
      p.pitch = 0;
    }, dyaw);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/level${pad}-${hour ? hour + '-' : ''}${name}.png` });
  }
  console.log(`saved 4 screenshots to ${out}/level${pad}-${hour ? hour + '-' : ''}*.png`);
} catch (e) {
  failed = true;
  console.error(`screenshot run failed: ${e.message}`);
} finally {
  await close();
}

if (errors.length) {
  console.error(`\n${errors.length} browser error(s):`);
  for (const e of errors.slice(0, 12)) console.error('  ' + e);
  failed = true;
}
process.exit(failed ? 1 : 0);
