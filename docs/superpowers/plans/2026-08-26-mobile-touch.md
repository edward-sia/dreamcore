# Mobile Touch Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HIRAETH playable by touch on phones — a drift stick, drag-look, tap-to-touch and a touch HUD — without changing a single room or anything a desktop player sees.

**Architecture:** All gesture recognition lives in one new module (`src/core/TouchControls.js`) whose pure math is a second new module (`src/core/touchmath.js`, `node:test`-covered). Existing files gain only small openings: `Player` accepts an analog move vector and look deltas, `Interaction` exposes its trigger and a tap raycast, `UI` swaps strings and closes on backdrop taps, `main.js` detects touch mode and wires the corners, `Engine` caps pixel ratio. Tasks run in order; each ends verified and committed.

**Tech Stack:** Three.js 0.170 + Vite 5, vanilla ES modules, `node:test` for pure logic, Playwright-core headless Chromium (the existing `tools/browser.mjs` harness) for the touch end-to-end test.

**Spec:** `docs/superpowers/specs/2026-08-26-mobile-touch-design.md` — every task cites its section. Read the whole spec once before starting; read `src/core/Player.js`, `src/core/Interaction.js`, `src/core/UI.js`, `src/main.js`, `src/style.css` and `tools/playtest.mjs` before Task 1.

## Global Constraints

- `src/levels/*.js` are never modified. (Spec §1.1.)
- Desktop behavior is unchanged: with a fine pointer and no touch event, every added path is inert — same pointer lock, keys, HUD, pause, strings. (Spec §1.2.)
- `__TEST_MODE__` never enters touch mode; `npm run playtest` stays 20/20 and `tools/screenshot.mjs` output is unchanged. (Spec §1.3.)
- All gesture recognition lives in `src/core/TouchControls.js`; all its math in `src/core/touchmath.js` (pure: no DOM, no three.js). (Spec §1.4.)
- Touch-mode strings exactly as spec §3.6's table; rotate-card text exactly as §5.3 (`the dream lies on its side` / `turn your phone`).
- The room timer stops while the rotate card holds the room, as it does for pause. (Spec §1.5, §5.3.)
- Pixel ratio cap on coarse-pointer devices is 1.5; desktop stays 2. (Spec §6.)
- Commit after every task with the message given in the task. Do not push. Branch: current (`claude/mobile-game-design-ecd606`).
- Verify commands assume a built or dev-served game via the task's given port; never reuse a port another agent may hold.

## Task map

```
Task 0  touchmath.js — pure gesture math + tests          ─┐
Task 1  Player openings (analog move, addLook, touchMode)  │
Task 2  Interaction openings (trigger, triggerFromPoint)   │  sequential
Task 3  index.html + style.css — touch HUD, viewport,      │  (shared files)
        rotate card                                        │
Task 4  UI.js — touch strings, backdrop closes             │
Task 5  TouchControls.js — the gesture module              │
Task 6  main.js + Engine.js — detection, corners, pause,   │
        fullscreen/rotate, pixel-ratio cap                 │
Task 7  tools/touchtest.mjs — headless touch E2E          ─┘
Task 8  README + full gates + final commit
```

---

### Task 0: Pure gesture math (`touchmath.js`)

**Files:**
- Create: `src/core/touchmath.js`
- Test: `tests/touchmath.test.mjs`

**Interfaces:**
- Produces: `stickVector(dx, dy, radius?, dead?) -> {fwd, strafe, mag}`;
  `lookDelta(dx, dy, sensitivity?) -> {dyaw, dpitch}`;
  `isTap(durationMs, travelPx) -> boolean`;
  `class HurryGate { update(mag, nowMs) -> boolean; hurrying }`;
  constants `STICK_RADIUS = 56`, `STICK_DEADZONE = 8`, `LOOK_PER_PX = 0.0035`,
  `TAP_MAX_MS = 250`, `TAP_MAX_TRAVEL = 12`, `HURRY_ON = 0.95`,
  `HURRY_OFF = 0.85`, `HURRY_DELAY_MS = 150`. (Spec §3.1–§3.4.)

- [ ] **Step 1: Write the failing tests**

Create `tests/touchmath.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stickVector, lookDelta, isTap, HurryGate,
  STICK_RADIUS, STICK_DEADZONE,
} from '../src/core/touchmath.js';

test('stick: inside the dead zone is stillness', () => {
  assert.deepEqual(stickVector(4, -4), { fwd: 0, strafe: 0, mag: 0 });
});

test('stick: full push up is full forward', () => {
  const v = stickVector(0, -STICK_RADIUS);
  assert.equal(v.fwd, 1);
  assert.equal(v.strafe, 0);
  assert.equal(v.mag, 1);
});

test('stick: travel past the rim clamps to 1', () => {
  assert.equal(stickVector(0, -200).mag, 1);
});

test('stick: partial push scales from the dead zone edge', () => {
  // len 24 -> (24-8)/(56-8) = 1/3, all of it strafe
  const v = stickVector(24, 0);
  assert.ok(Math.abs(v.strafe - 1 / 3) < 1e-9);
  assert.equal(v.fwd, 0);
});

test('look: left drag turns left, sensitivity scales', () => {
  assert.ok(Math.abs(lookDelta(-100, 0, 1).dyaw - 0.35) < 1e-9);
  assert.ok(Math.abs(lookDelta(0, 50, 2).dpitch + 0.35) < 1e-9);
});

test('tap: quick and still is a tap; slow or travelled is not', () => {
  assert.equal(isTap(200, 5), true);
  assert.equal(isTap(300, 5), false);
  assert.equal(isTap(100, 20), false);
});

test('hurry: the rim must be held, and releases with hysteresis', () => {
  const g = new HurryGate();
  assert.equal(g.update(1.0, 0), false);    // just arrived at the rim
  assert.equal(g.update(1.0, 100), false);  // 100ms < 150ms
  assert.equal(g.update(1.0, 200), true);   // held long enough
  assert.equal(g.update(0.9, 300), true);   // 0.9 >= HURRY_OFF: still hurrying
  assert.equal(g.update(0.8, 400), false);  // below 0.85: released
  assert.equal(g.update(0.96, 500), false); // re-approach restarts the clock
  assert.equal(g.update(0.96, 700), true);
});

test('hurry: dipping off the rim before the delay restarts the clock', () => {
  const g = new HurryGate();
  g.update(1.0, 0);
  g.update(0.5, 100);                       // left the rim
  assert.equal(g.update(1.0, 200), false);  // clock restarted at 200
  assert.equal(g.update(1.0, 349), false);
  assert.equal(g.update(1.0, 350), true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/touchmath.test.mjs`
Expected: FAIL — cannot find module `../src/core/touchmath.js`.

- [ ] **Step 3: Implement**

Create `src/core/touchmath.js`:

```js
// Pure gesture math for the touch controls. No DOM, no three.js — every
// number a thumb produces is decided here, where node:test can reach it.

export const STICK_RADIUS = 56;     // CSS px: ring radius = max thumb travel
export const STICK_DEADZONE = 8;    // CSS px ignored around where the thumb landed
export const LOOK_PER_PX = 0.0035;  // radians of head-turn per CSS px of drag
export const TAP_MAX_MS = 250;      // a press longer than this is a drag
export const TAP_MAX_TRAVEL = 12;   // a press that moved further is a drag
export const HURRY_ON = 0.95;       // |v| at/above the rim (after the delay) hurries
export const HURRY_OFF = 0.85;      // |v| below this stops hurrying (hysteresis)
export const HURRY_DELAY_MS = 150;  // the rim must be held this long

/** Thumb offset from the stick origin (CSS px) -> {fwd, strafe, mag} in [-1, 1]. */
export function stickVector(dx, dy, radius = STICK_RADIUS, dead = STICK_DEADZONE) {
  const len = Math.hypot(dx, dy);
  if (len <= dead) return { fwd: 0, strafe: 0, mag: 0 };
  const mag = (Math.min(len, radius) - dead) / (radius - dead);
  return { fwd: (-dy / len) * mag, strafe: (dx / len) * mag, mag };
}

/** Look-drag delta (CSS px) -> {dyaw, dpitch} in radians, sensitivity applied. */
export function lookDelta(dx, dy, sensitivity = 1) {
  const s = LOOK_PER_PX * sensitivity;
  return { dyaw: -dx * s, dpitch: -dy * s };
}

/** A press is a tap if it was quick and did not travel. */
export function isTap(durationMs, travelPx) {
  return durationMs < TAP_MAX_MS && travelPx < TAP_MAX_TRAVEL;
}

/** Rim-hold state machine: feed it |v| and a clock, read back hurrying. */
export class HurryGate {
  constructor() { this.hurrying = false; this._since = null; }
  update(mag, nowMs) {
    if (this.hurrying) {
      if (mag < HURRY_OFF) this.hurrying = false;
    } else if (mag >= HURRY_ON) {
      if (this._since === null) this._since = nowMs;
      else if (nowMs - this._since >= HURRY_DELAY_MS) this.hurrying = true;
    } else {
      this._since = null;
    }
    if (!this.hurrying && mag < HURRY_ON) this._since = null;
    return this.hurrying;
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/touchmath.test.mjs`
Expected: all tests pass. Also run `npm test` — the existing suites still pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/touchmath.js tests/touchmath.test.mjs
git commit -m "Touch math: stick, look, tap, hurry — pure and tested"
```

---

### Task 1: Player openings — analog move, look deltas, touch mode

**Files:**
- Modify: `src/core/Player.js`

**Interfaces:**
- Produces: `player.touchMode` (boolean, default `false`);
  `player.setMoveInput(fwd, strafe, hurry)` (floats in [-1, 1], boolean);
  `player.addLook(dyaw, dpitch)` (radians). Movement from keys and touch is
  summed and the magnitude clamped to 1; hurry is Shift OR touch-hurry.
  In touch mode `requestLock()` no-ops and `isLocked` reports true. (Spec §4.)

- [ ] **Step 1: Add the state and methods**

In the constructor, after `this.noclip = false;` add:

```js
    this.touchMode = false;     // no pointer lock; TouchControls feeds inputs
    this._touchMove = { fwd: 0, strafe: 0, hurry: false };
```

After the `teleport(...)` method add:

```js
  /** Analog move from the touch stick; zeroed when the thumb lifts. */
  setMoveInput(fwd, strafe, hurry) {
    this._touchMove.fwd = fwd;
    this._touchMove.strafe = strafe;
    this._touchMove.hurry = hurry;
  }

  /** Look deltas from a touch drag — same clamps as the mouse. */
  addLook(dyaw, dpitch) {
    if (!this.enabled || this.frozen) return;
    this.yaw += dyaw;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dpitch));
  }
```

- [ ] **Step 2: Skip pointer lock in touch mode**

`requestLock()` first line becomes:

```js
    if (window.__TEST_MODE__ || this.touchMode) return;
```

`get isLocked()` becomes:

```js
    return window.__TEST_MODE__ || this.touchMode || document.pointerLockElement === this.dom;
```

- [ ] **Step 3: Merge touch into the move update**

In `update(dt)`, inside the `if (this.enabled && !this.frozen)` block, after
the four key checks add:

```js
      fwd += this._touchMove.fwd;
      str += this._touchMove.strafe;
```

Change the `running` line to:

```js
    const running = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight') || this._touchMove.hurry;
```

Replace the two `target` lines with an analog magnitude (keys produce
hypot 0, 1 or √2, so `min(1, …)` reproduces today's binary behavior
exactly; the stick produces the in-between values):

```js
    const mag = Math.min(1, Math.hypot(fwd, str));
    const targetX = (wishX / len) * speed * mag;
    const targetZ = (wishZ / len) * speed * mag;
```

- [ ] **Step 4: Verify desktop is unchanged**

Run: `node tools/playtest.mjs 1 --port 5301`
Expected: `level 1: SOLVED …`, `1/1 levels solvable` (the playtest drives the
same Player through `__TEST_MODE__`; a regression here means Step 3 broke
key movement).

- [ ] **Step 5: Commit**

```bash
git add src/core/Player.js
git commit -m "Player: analog move input, addLook, touch mode without pointer lock"
```

---

### Task 2: Interaction openings — public trigger, tap raycast

**Files:**
- Modify: `src/core/Interaction.js`

**Interfaces:**
- Consumes: `interaction.current`, `this._items`, `this._ray` (existing).
- Produces: `interaction.trigger()` (public; fires the current gaze target
  exactly as E does) and `interaction.triggerFromPoint(ndcX, ndcY) -> boolean`
  (spec §3.4: fires only when the tap ray hits the *current* gaze target
  within its distance). (Spec §4.)

- [ ] **Step 1: Make the trigger public**

Rename `_trigger()` to `trigger()` and update its two internal callers (the
`keydown` and `mousedown` listeners in the constructor) to `this.trigger()`.
Confirm nothing else called it: `grep -rn "_trigger" src tools` must return
nothing after the rename.

- [ ] **Step 2: Add the tap raycast**

After `triggerObject(...)` add:

```js
  /** A tap fires only when it lands on the current gaze target (touch mode). */
  triggerFromPoint(ndcX, ndcY) {
    if (!this.enabled || !this.current) return false;
    const it = this._items.get(this.current);
    if (!it || !it.enabled) return false;
    this._ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    this._ray.far = it.distance;
    if (!this._ray.intersectObject(this.current, true).length) return false;
    this.trigger();
    return true;
  }
```

(`update()` re-sets `this._ray` from the screen center every frame, so
borrowing it here leaves no lasting state.)

- [ ] **Step 3: Verify desktop is unchanged**

Run: `node tools/playtest.mjs 1 --port 5302`
Expected: SOLVED — the playtest exercises `triggerObject` and the real
handlers.

- [ ] **Step 4: Commit**

```bash
git add src/core/Interaction.js
git commit -m "Interaction: public trigger and tap-point raycast for touch"
```

---

### Task 3: Touch HUD markup and styles

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

**Interfaces:**
- Produces: elements `#touch-hud` (hidden by default), `#touch-corner` with
  buttons `#btn-remember` / `#btn-surface`, `#touch-stick` containing
  `#touch-stick-pebble`, overlay `#rotate`; ids `#note-hint`,
  `#journal-hint`, `#keypad-hint` on the existing overlay hints; a
  `body.touch` class that restyles `#prompt` as the word-pill and moves
  `#items`/`#subtitle`/`#hint-keys`. Tasks 4–6 rely on all of these names.
  (Spec §3, §5.3.)

- [ ] **Step 1: Viewport meta**

In `index.html`, replace the viewport meta with:

```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
```

- [ ] **Step 2: HUD markup**

Give the three existing overlay hints ids (texts unchanged):

```html
      <div class="overlay-hint" id="note-hint">E or click to put it down</div>
```
```html
      <div class="overlay-hint" id="journal-hint">J to close</div>
```
```html
      <div class="overlay-hint" id="keypad-hint">Esc to step away</div>
```

Inside `#hud`, after the `#hint-keys` line, add:

```html
    <div id="touch-hud" class="hidden">
      <div id="touch-corner">
        <button id="btn-remember">remember</button>
        <button id="btn-surface">surface</button>
      </div>
      <div id="touch-stick" class="hidden"><div id="touch-stick-pebble"></div></div>
    </div>
```

After the `#pause` overlay, add the rotate card (spec §5.3, text verbatim):

```html
  <!-- Portrait hold (touch mode only) -->
  <div id="rotate" class="overlay hidden">
    <div id="rotate-inner">
      <div class="rotate-line">the dream lies on its side</div>
      <div class="rotate-small">turn your phone</div>
    </div>
  </div>
```

- [ ] **Step 3: Styles**

Append to `src/style.css`:

```css
/* ---------- Touch ---------- */
#app { touch-action: none; }
html, body { overscroll-behavior: none; }

#touch-hud { position: absolute; inset: 0; pointer-events: none; }
#touch-corner {
  position: absolute;
  top: calc(14px + env(safe-area-inset-top));
  right: calc(18px + env(safe-area-inset-right));
  display: flex; gap: 12px; pointer-events: auto;
}
#touch-corner button {
  font-family: var(--serif); font-style: italic;
  font-size: 13px; letter-spacing: 0.12em;
  color: rgba(238, 233, 222, 0.4);
  background: rgba(10, 10, 14, 0.4);
  border: 1px solid rgba(238, 233, 222, 0.16);
  border-radius: 999px;
  padding: 10px 18px; min-height: 44px;
  cursor: pointer;
}
#touch-corner button:active { color: var(--ghost); border-color: rgba(238,233,222,0.4); }

#touch-stick {
  position: absolute; width: 112px; height: 112px;
  margin: -56px 0 0 -56px;             /* positioned by its center */
  border-radius: 50%;
  border: 1.5px dotted rgba(238, 233, 222, 0.3);
  pointer-events: none;
}
#touch-stick-pebble {
  position: absolute; left: 50%; top: 50%;
  width: 40px; height: 40px; margin: -20px 0 0 -20px;
  border-radius: 50%;
  background: rgba(238, 233, 222, 0.22);
  box-shadow: 0 0 14px rgba(238, 233, 222, 0.12);
}

/* the word becomes the touch button (spec §3.4) */
body.touch #prompt {
  left: auto; top: auto;
  right: max(9vw, env(safe-area-inset-right));
  bottom: 26%;
  transform: none;
  pointer-events: auto;
  border: 1px solid rgba(238, 233, 222, 0.35);
  border-radius: 999px;
  padding: 12px 24px;
  background: rgba(10, 10, 14, 0.45);
}
body.touch #items { left: 28%; bottom: 24px; }
body.touch #subtitle { bottom: 16%; }
body.touch #hint-keys {
  left: 50%; right: auto; transform: translateX(-50%);
  bottom: calc(10px + env(safe-area-inset-bottom));
  white-space: nowrap;
}
body.touch #objective {
  top: calc(18px + env(safe-area-inset-top));
  left: calc(20px + env(safe-area-inset-left));
}
body.touch .keypad-btn { height: 56px; }
body.touch #keypad-grid { grid-template-columns: repeat(3, 72px); }

#rotate {
  z-index: 55;   /* above pause (50), below the fade (60) */
  background: radial-gradient(120% 90% at 50% 10%, #1c1a26 0%, #100f16 55%, #08080c 100%);
}
#rotate-inner { text-align: center; display: flex; flex-direction: column; gap: 18px; }
#rotate .rotate-line { font-style: italic; font-size: 20px; letter-spacing: 0.1em; color: var(--ghost); }
#rotate .rotate-small { font-size: 12px; letter-spacing: 0.22em; color: rgba(238, 233, 222, 0.35); }
```

- [ ] **Step 4: Verify desktop is visually unchanged**

Run: `npx vite build` (must succeed), then
`node tools/screenshot.mjs 1 --port 5303` and LOOK at `shots/level01-*.png`:
no touch HUD, no pill, hint line bottom-right as before (`#touch-hud` and
`#rotate` are `.hidden`; `body` has no `touch` class).

- [ ] **Step 5: Commit**

```bash
git add index.html src/style.css
git commit -m "Touch HUD markup and styles, viewport, rotate card — all dormant"
```

---

### Task 4: UI — touch strings and backdrop closes

**Files:**
- Modify: `src/core/UI.js`

**Interfaces:**
- Consumes: the ids Task 3 created (`#note-hint`, `#journal-hint`, `#keypad-hint`).
- Produces: `ui.setTouchMode(true)` — swaps the §3.6 strings and enables
  backdrop-tap closes; `ui.touchMode` readable. Task 6 calls it once.

- [ ] **Step 1: Track the hint elements**

In the constructor's `this.el` map add:

```js
      noteHint: $('note-hint'), journalHint: $('journal-hint'), keypadHint: $('keypad-hint'),
```

and after `this._clues = [];` add `this.touchMode = false;`.

- [ ] **Step 2: The mode switch**

After the `closeModal()` method add (strings verbatim from spec §3.6):

```js
  /** Touch mode: gesture words instead of key words (spec §3.6). */
  setTouchMode(on) {
    this.touchMode = on;
    if (!on) return;
    this.el.hintKeys.innerHTML = 'left thumb — walk&ensp;·&ensp;right thumb — look&ensp;·&ensp;the word — touch';
    this.el.noteHint.textContent = 'touch to put it down';
    this.el.journalHint.textContent = 'touch outside to close';
    this.el.keypadHint.textContent = 'touch outside to step away';
    this.el.interludeContinue.textContent = 'touch anywhere';
  }
```

- [ ] **Step 3: Backdrop closes**

In the constructor, after the existing `noteOverlay` mousedown listener, add:

```js
    // touch mode: the journal and keypad step away on a backdrop tap
    this.el.journal.addEventListener('mousedown', (e) => {
      if (this.touchMode && this._modal === 'journal' && e.target === this.el.journal) this._closeModal();
    });
    this.el.keypad.addEventListener('mousedown', (e) => {
      if (this.touchMode && this._modal === 'keypad' && e.target === this.el.keypad) this._closeModal();
    });
```

(A tap synthesizes `mousedown`; `e.target` is the overlay itself only when
the tap missed the paper/panel. Closing the keypad this way fires
`onCancel`, exactly like Esc.)

- [ ] **Step 4: Interludes advance on touch**

In `showInterlude(...)`, extend the `done` wiring:

```js
      const done = () => {
        document.removeEventListener('keydown', done);
        document.removeEventListener('mousedown', done);
        document.removeEventListener('touchstart', done);
        res();
      };
      document.addEventListener('keydown', done);
      document.addEventListener('mousedown', done);
      document.addEventListener('touchstart', done);
```

- [ ] **Step 5: Verify desktop is unchanged**

Run: `node tools/playtest.mjs 1 --port 5304`
Expected: SOLVED. (`setTouchMode` is never called yet; all listeners guard
on `this.touchMode`.)

- [ ] **Step 6: Commit**

```bash
git add src/core/UI.js
git commit -m "UI: touch-mode strings and backdrop closes, dormant until enabled"
```

---

### Task 5: The gesture module (`TouchControls.js`)

**Files:**
- Create: `src/core/TouchControls.js`

**Interfaces:**
- Consumes: Task 0's `touchmath` exports; Task 1's `player.setMoveInput` /
  `player.addLook`; Task 2's `interaction.triggerFromPoint`; Task 3's
  `#touch-stick` / `#touch-stick-pebble`; `ui.modalOpen`.
- Produces: `new TouchControls({ player, interaction, ui, app })` and
  `touchControls.reset()` (zeroes all touches; Task 6 calls it when a modal
  opens). (Spec §3.1–§3.4.)

- [ ] **Step 1: Write the module**

Create `src/core/TouchControls.js`:

```js
import {
  stickVector, lookDelta, isTap, HurryGate, STICK_RADIUS,
} from './touchmath.js';

const STICK_ZONE = 0.45; // left fraction of the screen that births the stick

/**
 * Owns every touch gesture (spec §3): the drift stick, the look drag, and
 * tap-the-thing. One stick touch and one look touch may live at once,
 * tracked by identifier. The word-pill and corner words are plain buttons
 * wired in main.js — touches that start on them never reach #app.
 */
export class TouchControls {
  constructor({ player, interaction, ui, app }) {
    this.player = player;
    this.interaction = interaction;
    this.ui = ui;
    this._stick = null;   // { id, ox, oy } — where the thumb landed
    this._look = null;    // { id, x, y, startX, startY, startT, travel }
    this._gate = new HurryGate();
    this._ring = document.getElementById('touch-stick');
    this._pebble = document.getElementById('touch-stick-pebble');

    app.addEventListener('touchstart', (e) => this._start(e), { passive: false });
    app.addEventListener('touchmove', (e) => this._move(e), { passive: false });
    app.addEventListener('touchend', (e) => this._end(e));
    app.addEventListener('touchcancel', (e) => this._end(e));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  /** Drop every live touch (modal opened, tab hidden, level change). */
  reset() {
    this._stick = null;
    this._look = null;
    this._gate = new HurryGate();
    this.player.setMoveInput(0, 0, false);
    this._ring.classList.add('hidden');
  }

  _start(e) {
    if (this.ui.modalOpen || this.player.frozen) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * STICK_ZONE && !this._stick) {
        this._stick = { id: t.identifier, ox: t.clientX, oy: t.clientY };
        this._ring.style.left = `${t.clientX}px`;
        this._ring.style.top = `${t.clientY}px`;
        this._pebble.style.transform = 'translate(0px, 0px)';
        this._ring.classList.remove('hidden');
      } else if (!this._look) {
        this._look = {
          id: t.identifier, x: t.clientX, y: t.clientY,
          startX: t.clientX, startY: t.clientY,
          startT: performance.now(), travel: 0,
        };
      }
    }
  }

  _move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this._stick && t.identifier === this._stick.id) {
        const dx = t.clientX - this._stick.ox;
        const dy = t.clientY - this._stick.oy;
        const v = stickVector(dx, dy);
        const len = Math.hypot(dx, dy) || 1;
        const clamp = Math.min(len, STICK_RADIUS);
        this._pebble.style.transform =
          `translate(${(dx / len) * clamp}px, ${(dy / len) * clamp}px)`;
        this.player.setMoveInput(v.fwd, v.strafe, this._gate.update(v.mag, performance.now()));
      } else if (this._look && t.identifier === this._look.id) {
        const dx = t.clientX - this._look.x;
        const dy = t.clientY - this._look.y;
        this._look.travel += Math.hypot(dx, dy);
        this._look.x = t.clientX;
        this._look.y = t.clientY;
        const d = lookDelta(dx, dy, this.player.sensitivity);
        this.player.addLook(d.dyaw, d.dpitch);
      }
    }
  }

  _end(e) {
    for (const t of e.changedTouches) {
      if (this._stick && t.identifier === this._stick.id) {
        this._stick = null;
        this._gate = new HurryGate();
        this.player.setMoveInput(0, 0, false);
        this._ring.classList.add('hidden');
      } else if (this._look && t.identifier === this._look.id) {
        const l = this._look;
        this._look = null;
        if (isTap(performance.now() - l.startT, l.travel) && !this.ui.modalOpen) {
          // spec §3.4: a tap fires only when it lands on the current gaze target
          const ndcX = (t.clientX / window.innerWidth) * 2 - 1;
          const ndcY = -(t.clientY / window.innerHeight) * 2 + 1;
          this.interaction.triggerFromPoint(ndcX, ndcY);
        }
      }
    }
  }
}
```

- [ ] **Step 2: Verify it parses**

Run: `node --input-type=module -e "await import('./src/core/TouchControls.js'); console.log('ok')"`
Expected: `ok`. (Importing is safe — the module touches the DOM only when
constructed, which Task 6 does; this proves the syntax and the `touchmath`
import resolve.)

- [ ] **Step 3: Commit**

```bash
git add src/core/TouchControls.js
git commit -m "TouchControls: the drift stick, the look drag, tap-the-thing"
```

---

### Task 6: Wiring — detection, corners, pause, fullscreen, rotate, pixel ratio

**Files:**
- Modify: `src/main.js`
- Modify: `src/core/Engine.js:77`

**Interfaces:**
- Consumes: everything Tasks 1–5 produced.
- Produces: touch mode end-to-end (spec §2, §3.5, §5, §6): `body.touch`
  class, `#touch-hud` shown, corner words live, word-pill live, audio
  unlock on touch, fullscreen + orientation lock on begin, the rotate
  card holding the room and its timer, pixel ratio capped at 1.5.

- [ ] **Step 1: Pixel-ratio cap**

In `src/core/Engine.js`, replace the `setPixelRatio` line with:

```js
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
```

- [ ] **Step 2: The rotate card (spec §5.3)**

After the pause block (`btn-quit` listener), add:

```js
// ---------- portrait hold (spec §5.3) ----------
const rotateEl = document.getElementById('rotate');
const portraitMq = window.matchMedia('(orientation: portrait)');
let orientationHeld = false;
function updateRotateCard() {
  const hold = !!touch && portraitMq.matches && (playing || transitioning);
  if (hold === orientationHeld) return;
  orientationHeld = hold;
  rotateEl.classList.toggle('hidden', !hold);
  if (hold) {
    touch?.reset();
    player.frozen = true;
  } else if (!paused && !ui.modalOpen) {
    player.frozen = false;
  }
}
portraitMq.addEventListener?.('change', updateRotateCard);
```

(`touch` is declared by Step 3's block, which sits *below* this one — that
is fine: `updateRotateCard` only runs from calls made after the whole
module has evaluated, or from Step 3's `enterTouchMode`, which runs after
`let touch` exists.)

Gate the room timer on it — in the `engine.onUpdate` callback, change the
timer line to:

```js
  if (playing && !paused && !orientationHeld) levelElapsed += realDt;
```

Call `updateRotateCard();` in two more places: at the end of
`startLevel(...)` (right before the `hiraeth:levelstart` dispatch) and at
the end of `exitToMenu()`.

- [ ] **Step 3: Touch-mode entry in `main.js`**

Import at the top: `import { TouchControls } from './core/TouchControls.js';`

Directly AFTER the portrait-hold block from Step 2 (this placement
matters: `enterTouchMode` runs synchronously at module evaluation on a
coarse-pointer device, and it calls `updateRotateCard` and reads
`pauseEl` and `unlock` — everything it touches must already be
initialized above it), add:

```js
// ---------- touch mode (spec §2) ----------
let touch = null;
function enterTouchMode() {
  if (touch || window.__TEST_MODE__) return;
  document.body.classList.add('touch');
  document.getElementById('touch-hud').classList.remove('hidden');
  player.touchMode = true;
  ui.setTouchMode(true);
  touch = new TouchControls({ player, interaction, ui, app: container });
  document.getElementById('prompt').addEventListener('click', () => {
    if (playing && !paused) interaction.trigger();
  });
  document.getElementById('btn-remember').addEventListener('click', () => {
    if (playing && !paused) ui.toggleJournal();
  });
  document.getElementById('btn-surface').addEventListener('click', () => {
    if (!playing || paused || ui.modalOpen) return;
    pauseEl.classList.remove('hidden');
    player.frozen = true;
    paused = true;
  });
  updateRotateCard();
}
if (window.matchMedia?.('(pointer: coarse)').matches) enterTouchMode();
window.addEventListener('touchstart', enterTouchMode, { once: true });
document.addEventListener('touchstart', unlock);
```

Because `let touch` now exists before the portrait-hold block ever
*executes* a read of it, and `enterTouchMode` sits below everything it
calls, there is no temporal-dead-zone path.

- [ ] **Step 4: Modal changes drop live touches**

In the `ui.onModalChange` handler, add as the first line:

```js
  touch?.reset();
```

(The existing `player.requestLock()` call there is already a no-op in touch
mode after Task 1.)

- [ ] **Step 5: Fullscreen and orientation on begin (spec §5.1)**

In `beginFromMenu(...)`, after `audio.unlockFromGesture();` add:

```js
  if (touch) {
    const fs = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    fs?.then?.(() => screen.orientation?.lock?.('landscape'))?.catch?.(() => {});
  }
```

In `exitToMenu()`, after `audio.setAmbience('menu');` add:

```js
  if (touch && document.fullscreenElement) document.exitFullscreen()?.catch?.(() => {});
```

- [ ] **Step 6: Verify desktop is unchanged, end to end**

Run: `npm test` (all pure suites) and `node tools/playtest.mjs all --port 5306`
Expected: 20/20 SOLVED — test mode never calls `enterTouchMode` and the
media query is fine-pointer on desktop. Then
`node tools/screenshot.mjs 1 --port 5307` and LOOK at the shots: unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/core/Engine.js
git commit -m "Touch mode wired: detection, corner words, rotate hold, dpi cap"
```

---

### Task 7: Headless touch end-to-end (`touchtest.mjs`)

**Files:**
- Create: `tools/touchtest.mjs`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `launch` from `tools/browser.mjs`; the whole touch feature;
  Level 1 geometry (spawn `(0, 0, -1)` facing −z; the note on the table at
  `(-1.0, 0.795, -4)` prompting `read the note`; a side door at
  `(1.33, 0, -5)` prompting `try the door`).
- Produces: `npm run test:touch` — the mobile gate Task 8 runs.

- [ ] **Step 1: Write the test**

Create `tools/touchtest.mjs`:

```js
// Touch end-to-end: boots level 1 WITHOUT test mode (touch mode must
// engage), synthesizes real TouchEvents, and asserts the four gestures:
// mode entry, the stick, the look drag, tap-the-thing, and the word-pill.
//   node tools/touchtest.mjs [--port 5310]
import { launch } from './browser.mjs';

const args = process.argv.slice(2);
const port = parseInt(args.includes('--port') ? args[args.indexOf('--port') + 1] : '5310', 10);

const { page, errors, close, url } = await launch({ port });
await page.setViewportSize({ width: 850, height: 390 });

const checks = [];
function check(name, ok, detail = '') {
  checks.push(ok);
  console.log(`${ok ? 'ok' : 'FAIL'} — ${name}${ok || !detail ? '' : ` (${detail})`}`);
}

// One synthetic touch: start, optional drag in steps, optional hold, end.
async function gesture(from, to = from, { steps = 6, dragMs = 90, holdMs = 0 } = {}) {
  await page.evaluate(async ({ from, to, steps, dragMs, holdMs }) => {
    const app = document.getElementById('app');
    const fire = (type, x, y) => {
      const t = new Touch({ identifier: 7, target: app, clientX: x, clientY: y });
      app.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t],
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
    fire('touchend', to.x, to.y);
  }, { from, to, steps, dragMs, holdMs });
}

try {
  // Boot without ?test=1 — fades run for real, so allow time.
  await page.goto(`${url}/?level=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.playing === true, null, { timeout: 30000 });
  await page.waitForTimeout(800);

  // 1. First touch enters touch mode (spec §2 belt-and-braces path).
  await gesture({ x: 700, y: 200 });
  await page.waitForTimeout(100);
  check('touch mode engages on first touch', await page.evaluate(() =>
    document.body.classList.contains('touch')
    && !document.getElementById('touch-hud').classList.contains('hidden')
    && window.__game.player.touchMode === true
    && document.pointerLockElement === null));

  // 2. The stick walks the player down the hall (forward = -z).
  const z0 = await page.evaluate(() => window.__game.player.position.z);
  await gesture({ x: 170, y: 300 }, { x: 170, y: 244 }, { holdMs: 900 });
  const z1 = await page.evaluate(() => window.__game.player.position.z);
  check('stick moves the player forward', z1 < z0 - 0.5, `z ${z0.toFixed(2)} -> ${z1.toFixed(2)}`);

  // 3. A look drag turns the head (left drag = yaw increases).
  const yaw0 = await page.evaluate(() => window.__game.player.yaw);
  await gesture({ x: 620, y: 190 }, { x: 500, y: 190 });
  const yaw1 = await page.evaluate(() => window.__game.player.yaw);
  check('look drag turns the head', yaw1 - yaw0 > 0.2, `yaw ${yaw0.toFixed(2)} -> ${yaw1.toFixed(2)}`);

  // 4. Tap-the-thing: face the note (table at (-1.0, 0.795, -4)), tap the
  //    screen center — the ray from the tap lands on the current target.
  await page.evaluate(() => {
    const p = window.__game.player;
    p.teleport(-0.3, -3.2, 0.72);   // ~1m from the note, facing it
    p.pitch = -0.66;                // eyes down to the tabletop
  });
  await page.waitForTimeout(300);   // let Interaction.update() find it
  const prompt = await page.evaluate(() => window.__game.interaction.current
    ? document.getElementById('prompt').textContent : null);
  check('gaze finds the note', prompt === 'read the note', String(prompt));
  await gesture({ x: 425, y: 195 });
  await page.waitForTimeout(300);
  check('tap on the thing opens the note', await page.evaluate(() =>
    window.__game.ui.modalKind === 'note'));
  await page.evaluate(() => window.__game.ui.closeModal());
  await page.waitForTimeout(200);

  // 5. The word-pill: face the first right-hand door at (1.33, 0, -5),
  //    then tap the pill and watch the trigger fire.
  await page.evaluate(() => {
    const p = window.__game.player;
    p.teleport(0.2, -5, -Math.PI / 2);  // face +x
    p.pitch = 0;
  });
  await page.waitForTimeout(300);
  const fired = await page.evaluate(() => {
    const it = window.__game.interaction;
    if (!it.current) return 'no target';
    let hit = false;
    const real = it.trigger.bind(it);
    it.trigger = () => { hit = true; real(); };
    document.getElementById('prompt').click();
    it.trigger = real;
    return hit;
  });
  check('the word-pill fires the trigger', fired === true, String(fired));
} catch (e) {
  check('run completed', false, e.message.split('\n')[0]);
}

await close();
if (errors.length) {
  console.error(`\n${errors.length} browser error(s):`);
  for (const e of errors.slice(0, 12)) console.error('  ' + e);
}
const bad = checks.filter((c) => !c).length;
console.log(`\n${checks.length - bad}/${checks.length} touch checks passed`);
process.exit(bad || errors.length ? 1 : 0);
```

- [ ] **Step 2: Add the script**

In `package.json` scripts, next to `"playtest"`, add:

```json
    "test:touch": "node tools/touchtest.mjs",
```

- [ ] **Step 3: Run it**

Run: `npm run test:touch`
Expected: `5/5 touch checks passed`, exit 0. If check 4's gaze line fails,
re-derive the teleport numbers from `src/levels/Level01.js` (note at
`(-1.0, 0.795, -4)`; yaw faces `(-sin yaw, -cos yaw)`) rather than loosening
the assertion.

- [ ] **Step 4: Commit**

```bash
git add tools/touchtest.mjs package.json
git commit -m "Headless touch E2E: mode entry, stick, look, tap, the word"
```

---

### Task 8: README and the full gates

**Files:**
- Modify: `README.md` (the Play section)

- [ ] **Step 1: Document the touch controls**

In `README.md`, directly after the key table, add:

```markdown
On a phone (landscape): left thumb — walk (push to the rim to hurry) ·
right thumb — drag to look · tap a thing, or the floating word, to touch
it · **remember** and **surface** in the corner for the journal and pause.
```

- [ ] **Step 2: Run every gate**

Run, expecting every one green:

- `npm test` — all `node:test` suites, including `touchmath`.
- `npm run test:api` — leaderboard contract untouched.
- `node tools/playtest.mjs all --port 5308` — 20/20 SOLVED.
- `npm run test:touch` — 5/5.
- `node tools/screenshot.mjs 1 --port 5309` — LOOK: desktop HUD unchanged.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "README: how the dream is held"
```
