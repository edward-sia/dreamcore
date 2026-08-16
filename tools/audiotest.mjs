// Smoke test for the synthesized sounds: builds every one-shot, positional
// one-shot, loop and mood in a headless page and fails on any exception or
// console error. Audio is muted in the harness; we only check the graphs build.
//   node tools/audiotest.mjs [--port 5197]
import { launch, loadLevel } from './browser.mjs';

const args = process.argv.slice(2);
const port = parseInt(args.includes('--port') ? args[args.indexOf('--port') + 1] : '5197', 10);
const { page, errors, close, url } = await launch({ port });

let result;
try {
  await loadLevel(page, url, 1);
  result = await page.evaluate(async () => {
    const a = window.__game.audio;
    a.init();               // no gesture in headless: the context may stay suspended; graphs still build
    const failed = [];
    const names = ['step', 'paper', 'pickup', 'clue', 'unlock', 'locked', 'wrong', 'switch', 'door', 'splash',
      'complete', 'tone', 'knock', 'stepOther', 'breath', 'whisper', 'phone', 'musicbox', 'chime', 'static',
      'slam', 'tinnitus', 'reverse', 'toll', 'heartbeat', 'handle', 'clunk', 'piano', 'hummed'];
    for (const n of names) {
      try {
        a.sfx(n, { notes: [329.63, 392], count: 2, rings: 1, freq: 440 });
        a.sfxAt(n, { x: 1, y: 1, z: -2 }, { notes: [329.63], count: 1 });
      } catch (e) { failed.push(`${n}: ${e.message}`); }
    }
    for (const k of ['tap', 'radio', 'boiler', 'hum', 'swing', 'rain', 'pianoKey']) {
      try {
        const h = a.loopAt(k, { x: 0, y: 2, z: 0 }, { freq: 329.63, every: 1 });
        h.setPosition({ x: 1, y: 1, z: 1 }); h.setGain(0.5); h.stop(0.1);
      } catch (e) { failed.push(`loop ${k}: ${e.message}`); }
    }
    for (const m of ['night', 'stairwell', 'school', 'playground', 'under', 'hallway']) {
      try { a.setAmbience(m); a.setDread(0.7); a.hush(1); a.setDread(0); } catch (e) { failed.push(`mood ${m}: ${e.message}`); }
    }
    try { a.updateListener(window.__game.engine.camera); } catch (e) { failed.push(`listener: ${e.message}`); }
    a.setAmbience('menu');
    return { failed, started: a._started === true };
  });
  await page.waitForTimeout(800);
} catch (e) {
  result = { failed: [`harness: ${e.message}`], started: false };
}
await close();

if (!result.started) result.failed.push('AudioEngine did not start (init() failed)');
if (result.failed.length || errors.length) {
  console.error('audio smoke FAILED');
  for (const f of result.failed) console.error('  ' + f);
  for (const e of errors.slice(0, 10)) console.error('  ' + e);
  process.exit(1);
}
console.log('audio smoke OK');
