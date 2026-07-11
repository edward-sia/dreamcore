// Automated solvability test: loads each level headless and runs its
// debugSolve(), asserting the level reports completion.
//   node tools/playtest.mjs [level|all] [--port 5198]
import { launch, loadLevel } from './browser.mjs';

const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith('--')) ?? 'all';
const port = parseInt(args.includes('--port') ? args[args.indexOf('--port') + 1] : '5198', 10);

const { page, errors, close, url } = await launch({ port });

let ids;
try {
  await page.goto(`${url}/?test=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.levels?.length > 0, null, { timeout: 20000 });
  const metas = await page.evaluate(() => window.__game.levels.map((m) => m.id));
  ids = which === 'all' ? metas : [parseInt(which, 10)];
} catch (e) {
  console.error('boot failed:', e.message);
  await close();
  process.exit(1);
}

const results = [];
for (const id of ids) {
  const t0 = Date.now();
  try {
    await loadLevel(page, url, id);
    await page.evaluate(() => {
      window.__done = false;
      window.addEventListener('hiraeth:levelcomplete', () => { window.__done = true; }, { once: true });
    });
    await page.evaluate(() => window.__game.solve());
    await page.waitForFunction(() => window.__done === true, null, { timeout: 45000 });
    results.push({ id, ok: true, ms: Date.now() - t0 });
    console.log(`level ${id}: SOLVED in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    results.push({ id, ok: false, err: e.message });
    console.error(`level ${id}: FAILED — ${e.message.split('\n')[0]}`);
  }
}

await close();

if (errors.length) {
  console.error(`\n${errors.length} browser error(s):`);
  for (const e of errors.slice(0, 12)) console.error('  ' + e);
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} levels solvable`);
process.exit(bad.length || errors.length ? 1 : 0);
