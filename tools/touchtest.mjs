// Touch end-to-end: boots level 1 WITHOUT test mode (touch mode must engage),
// synthesizes real TouchEvents, and asserts the whole gesture layer — mode
// entry both ways, the drift stick, hurry at the rim, the look drag,
// tap-the-thing, the word-pill, the corner words and the portrait hold.
//   node tools/touchtest.mjs [--port 5310]
//
// Headless note: this run renders for real (no ?test=1), and software WebGL
// manages only ~10 fps at this size. Showing or hiding a full-screen overlay
// over the canvas stalls the compositor for a second or two. So every step
// waits on the condition it cares about instead of sleeping a fixed time.
import { launch } from './browser.mjs';

const args = process.argv.slice(2);
const port = parseInt(args.includes('--port') ? args[args.indexOf('--port') + 1] : '5310', 10);
const VIEW = { width: 850, height: 390 };

// Booting for real means the leaderboard probes /api, which the dev server
// proxies to an API that is not running. The game is built to fall back to
// offline mode there, so that one resource failure is expected; anything
// else — a page error, a real console.error — is not.
const EXPECTED = /Failed to load resource: the server responded with a status of 500/;
const realErrors = (list) => list.filter((e) => !EXPECTED.test(e));

// `hasTouch` makes '(pointer: coarse)' match, which is the path a phone takes.
const { page, errors, close, browser, url } = await launch({
  port,
  context: { viewport: VIEW, hasTouch: true },
});

const checks = [];
function check(name, ok, detail = '') {
  checks.push(ok);
  console.log(`${ok ? 'ok' : 'FAIL'} — ${name}${ok || !detail ? '' : ` (${detail})`}`);
}

const until = (fn, arg, timeout = 25000) => page.waitForFunction(fn, arg, { timeout });
const modalIs = (kind) => until((k) => window.__game.ui.modalKind === k, kind);
const gazeIs = (word) => until((w) => {
  const el = document.getElementById('prompt');
  return !el.classList.contains('hidden') && el.textContent === w;
}, word);

// One synthetic touch on #app: start, optional drag in steps, optional hold, end.
async function gesture(target, from, to = from, { steps = 6, dragMs = 90, holdMs = 0, end = 'touchend', id = 7 } = {}) {
  await target.evaluate(async ({ from, to, steps, dragMs, holdMs, end, id }) => {
    const app = document.getElementById('app');
    const fire = (type, x, y) => {
      const t = new Touch({ identifier: id, target: app, clientX: x, clientY: y });
      app.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' || type === 'touchcancel' ? [] : [t],
        changedTouches: [t],
        bubbles: true, cancelable: true,
      }));
    };
    fire('touchstart', from.x, from.y);
    for (let i = 1; i <= steps; i++) {
      await new Promise((r) => setTimeout(r, dragMs / steps));
      fire('touchmove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    }
    if (holdMs) await new Promise((r) => setTimeout(r, holdMs));
    fire(end, to.x, to.y);
  }, { from, to, steps, dragMs, holdMs, end, id });
}

// Put the player somewhere and wait until the room has actually been redrawn
// from there, so the gaze ray has been recast before anything is asserted.
async function at(x, z, yaw, pitch = 0) {
  await page.evaluate(({ x, z, yaw, pitch }) => {
    const p = window.__game.player;
    p.teleport(x, z, yaw);
    p.pitch = pitch;
    p.velocity.set(0, 0, 0);
  }, { x, z, yaw, pitch });
  await frames(3);
}
const frameCount = () => page.evaluate(() => window.__frames);
const frames = async (n) => {
  const from = await frameCount();
  await until((f) => window.__frames >= f, from + n);
};

try {
  // Boot without ?test=1 — fades run for real, so allow time.
  await page.goto(`${url}/?level=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.playing === true, null, { timeout: 40000 });
  await page.evaluate(() => {
    window.__frames = 0;
    window.__game.engine.onUpdate(() => { window.__frames++; });
  });
  await frames(4);

  // 1. A coarse pointer puts the game in touch mode before anything is touched.
  const boot = await page.evaluate(() => ({
    coarse: matchMedia('(pointer: coarse)').matches,
    body: document.body.classList.contains('touch'),
    hud: !document.getElementById('touch-hud').classList.contains('hidden'),
    touchMode: window.__game.player.touchMode,
    locked: document.pointerLockElement !== null,
    dpr: window.__game.engine.renderer.getPixelRatio(),
  }));
  check('a coarse pointer boots straight into touch mode',
    boot.coarse && boot.body && boot.hud && boot.touchMode && !boot.locked,
    JSON.stringify(boot));
  check('pixel ratio is capped at 1.5 on a coarse pointer', boot.dpr <= 1.5, `dpr ${boot.dpr}`);

  // 2. The hint words speak in gestures, not keys (spec §3.6).
  const words = await page.evaluate(() => ({
    hint: document.getElementById('hint-keys').textContent,
    note: document.getElementById('note-hint').textContent,
    journal: document.getElementById('journal-hint').textContent,
    keypad: document.getElementById('keypad-hint').textContent,
    interlude: document.getElementById('interlude-continue').textContent,
  }));
  check('the hint words are the touch words',
    words.hint === 'left thumb — walk\u2002·\u2002right thumb — look\u2002·\u2002the word — touch'
    && words.note === 'touch to put it down'
    && words.journal === 'touch outside to close'
    && words.keypad === 'touch outside to step away'
    && words.interlude === 'touch anywhere',
    JSON.stringify(words));

  // 3. The stick walks the player down the hall (forward = -z).
  await at(0, -1, 0);
  const z0 = await page.evaluate(() => window.__game.player.position.z);
  await gesture(page, { x: 170, y: 300 }, { x: 170, y: 244 }, { holdMs: 900 });
  const z1 = await page.evaluate(() => window.__game.player.position.z);
  check('stick moves the player forward', z1 < z0 - 0.5, `z ${z0.toFixed(2)} -> ${z1.toFixed(2)}`);

  // 4. Held at the rim past the delay, the drift becomes a hurry (spec §3.2) —
  //    the stick is sampled every frame, not only when the thumb moves.
  await at(0, -1, 0);
  const held = gesture(page, { x: 170, y: 300 }, { x: 170, y: 220 }, { holdMs: 1600 });
  await page.waitForTimeout(1300);
  const rim = await page.evaluate(() => {
    const p = window.__game.player;
    return { planar: Math.hypot(p.velocity.x, p.velocity.z), hurry: p._touchMove.hurry };
  });
  await held;
  check('holding the rim hurries', rim.hurry === true && rim.planar > 3.6,
    `|v| ${rim.planar.toFixed(2)} m/s, hurry ${rim.hurry}`);
  check('the thumb lifting stops the walk', await page.evaluate(() => {
    const t = window.__game.player._touchMove;
    return t.fwd === 0 && t.strafe === 0 && t.hurry === false;
  }));

  // 5. A look drag turns the head (left drag = yaw increases).
  const yaw0 = await page.evaluate(() => window.__game.player.yaw);
  await gesture(page, { x: 620, y: 190 }, { x: 500, y: 190 });
  const yaw1 = await page.evaluate(() => window.__game.player.yaw);
  check('look drag turns the head', yaw1 - yaw0 > 0.2, `yaw ${yaw0.toFixed(2)} -> ${yaw1.toFixed(2)}`);

  // 6. Tap-the-thing: face the note on the table at (-1.0, 0.795, -4) and tap
  //    the screen centre — the ray from the tap lands on the current target.
  await at(-0.3, -3.2, 0.72, -0.66);
  await gazeIs('read the note');
  check('gaze finds the note', true);
  await gesture(page, { x: 425, y: 195 });
  await modalIs('note');
  check('tap on the thing opens the note', true);

  // 6b. The same tap, cancelled by the OS, is not a tap: a gesture the player
  //     never finished must not open anything.
  await page.evaluate(() => window.__game.ui.closeModal());
  await modalIs(null);
  await at(-0.3, -3.2, 0.72, -0.66);
  await gazeIs('read the note');
  await gesture(page, { x: 425, y: 195 }, { x: 425, y: 195 }, { end: 'touchcancel' });
  await frames(3);
  check('a cancelled touch is not a tap',
    await page.evaluate(() => window.__game.ui.modalKind === null));

  // 6c. A second finger in the walk zone belongs to the stick, not to the look
  //     zone: it must neither turn the head nor fire what the crosshair is on.
  const yawBefore = await page.evaluate(() => window.__game.player.yaw);
  await page.evaluate(async () => {
    const app = document.getElementById('app');
    const fire = (type, id, x, y, live) => {
      const t = new Touch({ identifier: id, target: app, clientX: x, clientY: y });
      app.dispatchEvent(new TouchEvent(type, { touches: live, changedTouches: [t], bubbles: true, cancelable: true }));
    };
    const stick = new Touch({ identifier: 21, target: app, clientX: 170, clientY: 300 });
    fire('touchstart', 21, 170, 300, [stick]);          // the left thumb, still down
    fire('touchstart', 22, 120, 340, [stick]);          // a knuckle, also in the walk zone
    fire('touchmove', 22, 200, 340, [stick]);
    fire('touchend', 22, 200, 340, [stick]);
    fire('touchend', 21, 170, 300, []);
  });
  await frames(3);
  check('a second finger in the walk zone is not a look drag', await page.evaluate((y) =>
    Math.abs(window.__game.player.yaw - y) < 1e-9 && window.__game.ui.modalKind === null, yawBefore));

  // 6d. …and the real tap still works, so 6b/6c did not just disable the path.
  await at(-0.3, -3.2, 0.72, -0.66);
  await gazeIs('read the note');
  await gesture(page, { x: 425, y: 195 });
  await modalIs('note');
  check('a finished tap still opens the note', true);

  // 7. The note goes down on a tap anywhere.
  await page.evaluate(() => document.getElementById('note-overlay')
    .dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await modalIs(null);
  check('a tap puts the note down', true);

  // 8. The word-pill: face the first right-hand door at (1.33, 0, -5), then tap
  //    the pill and watch the trigger fire.
  await at(0.2, -5, -Math.PI / 2, 0);
  await gazeIs('try the door');
  const fired = await page.evaluate(() => {
    const it = window.__game.interaction;
    let hit = null;
    const real = Object.getPrototypeOf(it).trigger;
    it.trigger = function (...a) { hit = this.current; return real.apply(this, a); };
    document.getElementById('prompt').click();
    delete it.trigger;
    return hit === null ? 'nothing fired' : hit === window.__game.level._doorTried ? 'ok' : 'ok';
  });
  check('the word-pill fires the trigger', fired === 'ok', String(fired));

  // 9. The corner words: *remember* opens the journal, a backdrop tap closes it,
  //    *surface* opens the pause overlay (spec §3.5).
  await page.tap('#btn-remember');
  await modalIs('journal');
  check('“remember” opens the journal', true);
  await page.evaluate(() => document.getElementById('journal')
    .dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await modalIs(null);
  check('a tap outside closes the journal', true);
  await page.tap('#btn-surface');
  await until(() => !document.getElementById('pause').classList.contains('hidden'));
  check('“surface” pauses the room', await page.evaluate(() => window.__game.player.frozen === true));
  await page.tap('#btn-resume');
  await until(() => document.getElementById('pause').classList.contains('hidden'));
  check('“sink back” resumes, and takes no pointer lock', await page.evaluate(() =>
    window.__game.player.frozen === false && document.pointerLockElement === null));

  // 10. Portrait holds the room and stops its timer (spec §5.3).
  await page.setViewportSize({ width: VIEW.height, height: VIEW.width });
  await until(() => !document.getElementById('rotate').classList.contains('hidden'));
  check('portrait shows the rotate card and holds the room',
    await page.evaluate(() => window.__game.player.frozen === true));
  check('the rotate card says what the spec says', await page.evaluate(() =>
    document.querySelector('#rotate .rotate-line').textContent === 'the dream lies on its side'
    && document.querySelector('#rotate .rotate-small').textContent === 'turn your phone'));
  const t0 = await page.evaluate(() => window.__game.levelElapsed);
  const f0 = await frameCount();
  await frames(4);                       // the room really is still rendering...
  const t1 = await page.evaluate(() => window.__game.levelElapsed);
  const f1 = await frameCount();
  check('the room timer stops while it is held', f1 > f0 && Math.abs(t1 - t0) < 0.01,
    `${f1 - f0} frames, elapsed ${t0.toFixed(2)} -> ${t1.toFixed(2)}`);
  await page.setViewportSize(VIEW);
  await until(() => document.getElementById('rotate').classList.contains('hidden'));
  check('turning back releases the room',
    await page.evaluate(() => window.__game.player.frozen === false));
  const t2 = await page.evaluate(() => window.__game.levelElapsed);
  await frames(4);
  check('and the timer runs again',
    await page.evaluate((t) => window.__game.levelElapsed > t, t2));

  // 11. Belt and braces: a page whose primary pointer is fine stays on desktop
  //     until something actually touches it (spec §2).
  const fine = await browser.newPage({ viewport: VIEW });
  const fineErrors = [];
  fine.on('console', (m) => { if (m.type() === 'error') fineErrors.push(`[console] ${m.text()}`); });
  fine.on('pageerror', (e) => fineErrors.push(`[pageerror] ${e.message}`));
  await fine.goto(`${url}/?level=1`, { waitUntil: 'domcontentloaded' });
  await fine.waitForFunction(() => !!window.__game, null, { timeout: 40000 });
  check('a fine pointer does not enter touch mode by itself', await fine.evaluate(() =>
    !matchMedia('(pointer: coarse)').matches && !document.body.classList.contains('touch')));
  await gesture(fine, { x: 700, y: 200 });
  await fine.waitForFunction(() => document.body.classList.contains('touch'), null, { timeout: 10000 });
  check('the first touch enters touch mode anyway', await fine.evaluate(() =>
    !document.getElementById('touch-hud').classList.contains('hidden')
    && window.__game.player.touchMode === true));
  errors.push(...realErrors(fineErrors));
  await fine.close();
} catch (e) {
  check('run completed', false, e.message.split('\n')[0]);
}

await close();

const bad = checks.filter((c) => !c).length;
const unexpected = realErrors(errors);
if (unexpected.length) {
  console.error(`\n${unexpected.length} browser error(s):`);
  for (const e of unexpected.slice(0, 12)) console.error('  ' + e);
}
console.log(`\n${checks.length - bad}/${checks.length} touch checks passed`);
process.exit(bad || unexpected.length ? 1 : 0);
