# Rooms XVI–XX ("the five above") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five new rooms (XVI–XX) after the true waking — the house at three hours, the player on M.'s side of the door, leaving the clues — plus the small engine pieces they need, without breaking rooms I–XV.

**Architecture:** The engine work lands first in the shared files (`src/core/*`, `src/main.js`, `src/levels/index.js`, tools, server config, docs), one task per subsystem, each verified by `node --test` where the code is pure and by the headless harness where it isn't. Then each room is one new file `src/levels/LevelNN.js` that touches nothing shared, so the five room tasks can run in parallel (one agent each, distinct ports). The full playtest suite (20/20) is the final gate.

**Tech Stack:** Three.js 0.170 + Vite 5, vanilla ES modules, WebAudio (synthesized only, no assets), Playwright-core headless Chromium for verification, `node:test` for pure logic.

**Spec:** `docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md` — every task below cites its section. Read the spec's §1.2 (the contract), §4 (engine APIs) and the room's own §5.x before starting a task. Also read `docs/LEVEL_API.md`, `src/levels/Level01.js` (canonical room), `src/levels/Level11.js` (the bedroom XX rebuilds) and `src/levels/Level15.js` (the latest multi-act room; its `_waitFor` pattern) once. The XI–XV spec (`docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md`) holds the scare contract and the engine APIs these rooms build on.

## Global Constraints

- Room files (`src/levels/Level16.js` … `Level20.js`) import only from `three`, `../core/LevelBase.js`, `../core/textures.js`, `../core/props.js`, `../core/presence.js`, `../core/hours.js`, and never edit shared files. (Spec §4.)
- Rooms I–XV are not modified. (Spec §1.3.) The old `EPILOGUE` text moves into XVI's `meta.prologue`; nothing else in XI–XV changes.
- The contract, spec §1.2: rules 1–10 of the XI–XV spec (no game-over, nothing chases, no jump-scares, the figure never lit and never closer than about two metres, every hearing-dependent step with a sighted fallback and a `cue()`, puzzles solvable from in-room clues) plus rules 11–16 (the child never closer than about two metres either way; the child lit, small, faceless, silent but for hums/gasps/breath; the player shown as the figure only in XX's glass; being seen costs progress, never a room; the morning never frightening; she is never seen).
- Writing: lowercase objectives, second person, restrained; notes signed `— M.`; wrong attempts play `wrong` (or the in-world equivalent the spec names) and give the quoted nudge. Use the spec's texts verbatim.
- Every room starts at 3:07 (`Hours` initial `'night'`), cycles 3:07 → 7:15 → 8:30 → 3:07 by hand at its clock, and keeps the room's `Hours` instance at `this.hours` (public — `tools/screenshot.mjs --hour` uses it).
- Per-hour look (fog, grade, hemisphere light, mood) per spec §5 conventions. Doors onward open at night only; the wrong-hour placing lines are the spec's.
- All new audio APIs are no-ops before `AudioEngine.init()` (`_started === false`) and never throw. The headless harness runs with `--mute-audio` and no gesture, so every playtest exercises that path.
- Every room's `debugSolve()` finishes inside 40 s of wall time and goes through the same handlers a player uses (no debug-only path through a puzzle). Use `_waitFor(test, capSeconds)` (Level15's pattern) wherever a state is awaited.
- Verify loop per room, ports per room: `npx vite build` → `node tools/screenshot.mjs N --port 51NN` (exit 0, then LOOK at `shots/levelNN-*.png`) and `node tools/screenshot.mjs N --port 51NN --hour morning` / `--hour evening` → `node tools/playtest.mjs N --port 52NN` (prints SOLVED).
- Commit after every task with the message given in the task. Do not push. Branch: current (`claude/five-additional-game-levels-74a040`).

## Task map and parallelism

```
Task 0  leaderboard cap → 20 (server, worker, wrangler, test, docs)     ─┐
Task 1  AudioEngine: moods, birds, new one-shots, hummed small, loops;   │
        audiotest                                                        │  sequential
Task 2  LevelBase: setMood, isSeenBy, footsteps; tests                   │  (shared files)
Task 3  hours.js (Hours); tests                                          │
Task 4  presence.js makeChild; props.js makeClockFace; tests             │
Task 5  main.js / levels/index.js flow; screenshot --hour                 │
Task 6  docs: LEVEL_API.md, DESIGN.md                                   ─┘
Task 7  Room XVI   ─┐
Task 8  Room XVII   │  independent — may run in parallel,
Task 9  Room XVIII  │  one agent per room, own file, own ports
Task 10 Room XIX    │
Task 11 Room XX    ─┘
Task 12 README, full-suite gate 20/20, final commit
```

---

### Task 0: Leaderboard cap — rooms 11–20 can be submitted

**Files:**
- Modify: `server/server.mjs:20,38`
- Modify: `worker/index.mjs:39`
- Modify: `wrangler.jsonc:28`
- Modify: `docs/HOSTING.md:141`
- Modify: `tools/leaderboard-test.mjs` (the rejections block and one new acceptance check)

**Interfaces:**
- Produces: `MAX_LEVEL` default `20` everywhere; `sanitizeTimes(times, 20)` unchanged in signature.

Why: `sanitizeTimes(body.times, MAX_LEVEL)` returns `null` — the whole submission is rejected with 400 — if any room id exceeds `MAX_LEVEL`, and the default is still 10. A player who has finished room XI cannot submit at all. (Spec §4.6.)

- [ ] **Step 1: Add a failing check to the contract test**

In `tools/leaderboard-test.mjs`, just before the `// rejections` comment, add:

```js
  // rooms up to 20 are accepted (the cap was 10 until the five above)
  r = await (await post({ key: 'fay-6666-ffff', name: 'fay', times: { 20: 300 } })).json();
  check('room 20 accepted', r.ok === true && r.levels === 1, JSON.stringify(r));
```

and in the `bad` array add, after `'room out of range'`:

```js
    ['room 21', { key: 'eee-5555-eeee', name: 'e', times: { 21: 60 } }],
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm run test:api`
Expected: `FAIL — room 20 accepted` (the server still caps at 10); everything else passes.

- [ ] **Step 3: Raise the default to 20 in all three places and the docs**

`server/server.mjs` line 20 comment → `//   MAX_LEVEL=20  MAX_ENTRIES=5000`; line 38 →
```js
const MAX_LEVEL = parseInt(process.env.MAX_LEVEL ?? '20', 10);
```
`worker/index.mjs` line 39 →
```js
  maxLevel: parseInt(env.MAX_LEVEL ?? '20', 10),
```
`wrangler.jsonc` line 28 → `"MAX_LEVEL": "20",`
`docs/HOSTING.md` line 141 → `| \`MAX_LEVEL\` | \`20\` | highest accepted room id |`

- [ ] **Step 4: Run the test to see it pass**

Run: `npm run test:api`
Expected: `all leaderboard checks passed` (including `room 20 accepted` and `rejects room 21`).

- [ ] **Step 5: Commit**

```bash
git add server/server.mjs worker/index.mjs wrangler.jsonc docs/HOSTING.md tools/leaderboard-test.mjs
git commit -m "leaderboard: accept rooms up to 20 (the cap was still 10, so XI+ scores were rejected)"
```

---

### Task 1: AudioEngine — two moods, birds, five one-shots, a small hum, four loops

**Files:**
- Modify: `src/core/AudioEngine.js`
- Modify: `tools/audiotest.mjs`

**Interfaces:**
- Produces (used by Task 3 and every room):
  - moods `evening`, `morning` (`audio.setAmbience('evening')`)
  - `sfx` / `sfxAt` names: `wind {clicks=9, gap=0.07}`, `smallStep {soft}`, `tick`, `gasp`, `lock`; `hummed` gains `{ small }`
  - `loopAt` kinds: `birds`, `idle`, `fire`, `simmer`

Spec: §4.1.

- [ ] **Step 1: Add the moods and the `birds` ambience event**

In `MOODS` (top of `src/core/AudioEngine.js`), after the `under` line add:

```js
  evening:    { root: 46, chord: [1, 1.498, 1.782, 2.0], cutoff: 560, noise: 0.06, events: ['clock', 'creak', 'hum'] },
  morning:    { root: 58, chord: [1, 1.5, 2.0, 2.52],    cutoff: 900, noise: 0.18, events: ['birds', 'birds', 'creak'] },
```

In `_ambEvent(name, out)`, add a case before `case 'clock':`:

```js
      case 'birds': {
        for (let k = 0; k < 3; k++) {
          const r = Math.random();
          this._blip(out, 2600 + r * 900, 3400 + r * 600, 0.003, 0.06, 0.03, t + k * 0.09);
        }
        break;
      }
```

- [ ] **Step 2: Add the one-shots to `_synth`**

In `_synth(name, opts, out)`, before `case 'hummed':` add:

```js
      case 'wind': {
        const clicks = opts.clicks ?? 9, gap = opts.gap ?? 0.07;
        for (let i = 0; i < clicks; i++) this._blip(out, 1500, 900, 0.002, 0.03, 0.05, t + i * gap);
        this._blip(out, 300, 180, 0.004, 0.12, 0.06, t + clicks * gap);
        break;
      }
      case 'smallStep': {
        this._noiseBurst(out, 1400, 0.05, opts.soft ? 0.025 : 0.045, 'bandpass');
        this._blip(out, 190, 120, 0.003, 0.07, opts.soft ? 0.03 : 0.05);
        break;
      }
      case 'tick': this._blip(out, 2400, 1700, 0.001, 0.02, opts.gain ?? 0.05); break;
      case 'gasp': {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 1.5;
        bp.frequency.setValueAtTime(600, t);
        bp.frequency.linearRampToValueAtTime(1500, t + 0.3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.12);
        g.gain.linearRampToValueAtTime(0, t + 0.37);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(t, Math.random() * 2); src.stop(t + 0.45);
        break;
      }
      case 'lock':
        this._blip(out, 900, 500, 0.002, 0.05, 0.08);
        this._blip(out, 220, 160, 0.004, 0.14, 0.12, t + 0.12);
        break;
```

Then change `case 'hummed'` so a small voice is an octave up and a little quieter — replace its first three lines with:

```js
      case 'hummed': {
        const notes = opts.notes ?? [329.63, 392, 440, 392];
        const small = !!opts.small;
        const step = opts.step ?? 0.55, gain = (opts.gain ?? 0.03) * (small ? 0.7 : 1);
        notes.forEach((f, i) => {
          const w = t + i * step;
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = small ? f : f / 2;
          const vib = ctx.createOscillator(); vib.frequency.value = small ? 6.5 : 5.5;
```

(The rest of the case — `vg`, `lp`, the gain envelope, start/stop — stays exactly as it is.)

- [ ] **Step 3: Add the loops**

In `loopAt`, move `let stopped = false;` from below the `switch` to just above it (right after the `lfoOn` helper), and add a `randomly` helper next to `every`:

```js
    const every = (ms, fn) => { fn(); timers.push(setInterval(fn, ms)); };
    const randomly = (minMs, maxMs, fn) => {
      const arm = () => {
        const id = setTimeout(() => { if (stopped) return; fn(); arm(); }, minMs + Math.random() * (maxMs - minMs));
        timers.push(id);
      };
      arm();
    };
```

(`timers.forEach(clearInterval)` in `stop` clears timeouts too — the two clear functions are interchangeable by the HTML standard.) Then add cases before `default:`:

```js
      case 'birds': {
        randomly(500, 2200, () => {
          for (let k = 0; k < 3; k++) {
            const r = Math.random();
            this._blip(gain, 2600 + r * 900, 3400 + r * 600, 0.003, 0.06, 0.04, ctx.currentTime + k * 0.09);
          }
        });
        break;
      }
      case 'idle': {
        const lp = filt('lowpass', 180); const gg = g(0.035);
        osc('sawtooth', 37).connect(lp); lp.connect(gg); gg.connect(gain);
        lfoOn(gg.gain, 3.8, 0.014);
        const s = noise(); const nl = filt('lowpass', 300); const ng = g(0.01);
        s.connect(nl); nl.connect(ng); ng.connect(gain);
        break;
      }
      case 'fire': {
        const s = noise(); const f = filt('lowpass', 700); const gg = g(0.045);
        lfoOn(gg.gain, 0.6, 0.0135);
        s.connect(f); f.connect(gg); gg.connect(gain);
        randomly(150, 900, () => this._blip(gain, 1900, 1200, 0.001, 0.012, 0.05));
        break;
      }
      case 'simmer': {
        const s = noise(); const f = filt('bandpass', 2300, 0.8); const gg = g(0.02);
        s.connect(f); f.connect(gg); gg.connect(gain);
        randomly(200, 700, () => this._blip(gain, 520 + Math.random() * 400, 900, 0.002, 0.05, 0.03));
        break;
      }
```

- [ ] **Step 4: Extend the audio smoke test**

In `tools/audiotest.mjs`: add `'wind', 'smallStep', 'tick', 'gasp', 'lock'` to `names`; add `'birds', 'idle', 'fire', 'simmer'` to the loop kinds array; add `'evening', 'morning'` to the moods array; and after the `names` loop add one call that exercises the small hum:

```js
    try { a.sfxAt('hummed', { x: 0, y: 1, z: -1 }, { notes: [329.63, 392], small: true }); } catch (e) { failed.push(`hummed small: ${e.message}`); }
```

- [ ] **Step 5: Verify**

Run: `node --check src/core/AudioEngine.js && npx vite build 2>&1 | tail -3 && node tools/audiotest.mjs --port 5302`
Expected: the build passes; `audio smoke OK`.

Run: `node tools/playtest.mjs 11 --port 5303`
Expected: `level 11: SOLVED` (a regression check on a room that uses `hummed` and loops).

- [ ] **Step 6: Commit**

```bash
git add src/core/AudioEngine.js tools/audiotest.mjs
git commit -m "audio: evening and morning moods, birds, wind/smallStep/tick/gasp/lock, a small hum, idle/fire/simmer/birds loops"
```

---

### Task 2: LevelBase — `setMood`, `isSeenBy`, `footsteps`

**Files:**
- Modify: `src/core/LevelBase.js`
- Test: `tests/levelbase-arc3.test.mjs` (new)

**Interfaces:**
- Produces (used by Tasks 3, 7–11):
  - `level.setMood(key)` → `audio.setAmbience(key)`
  - `level.isSeenBy(obj, { angleDeg = 30, maxDist = 8, occluders = null, eye = null })` → boolean
  - `level.footsteps(points, { stride = 0.55, every = 0.5, sound = 'smallStep', opts = {}, onStep = null, onDone = null })` → `cancel()`

Spec: §4.2.

- [ ] **Step 1: Write the failing tests**

Create `tests/levelbase-arc3.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LevelBase } from '../src/core/LevelBase.js';

function fakeGame() {
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.08, 600);
  camera.rotation.order = 'YXZ';
  const calls = { moods: [], sfxAt: [] };
  return {
    engine: { camera, pulseGrade() {}, setGrade() {} },
    ui: { subtitle() {}, flash() {}, setObjective() {}, addClue() {}, showNote() {}, setItems() {} },
    audio: {
      sfx() {}, sfxAt: (name, pos, opts) => calls.sfxAt.push({ name, pos: { ...pos }, opts }),
      setDread() {}, hush() {}, setAmbience: (m) => calls.moods.push(m),
      loopAt: () => ({ stop() {}, setPosition() {}, setGain() {} }),
    },
    interaction: { add() {}, clear() {}, remove() {}, setEnabled() {} },
    player: { setColliders() {}, position: new THREE.Vector3(0, 1.62, 0) },
    save: { data: { captions: false } },
    calls,
  };
}
class L extends LevelBase { build() {} }
function camAt(camera, x, z, yaw) {
  camera.position.set(x, 1.62, z);
  camera.rotation.set(0, yaw, 0);
  camera.updateMatrixWorld(true);
}
function looker(x, z, yaw) {
  const o = new THREE.Object3D();
  o.position.set(x, 0, z);
  o.rotation.y = yaw;            // local +Z is its front; rotation.y = 0 faces +Z
  o.updateMatrixWorld(true);
  return o;
}

test('setMood forwards to audio.setAmbience', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  lvl.setMood('evening');
  assert.deepEqual(g.calls.moods, ['evening']);
});

test('isSeenBy: the camera inside the object\'s forward cone is seen; behind it is not', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const child = looker(0, 0, 0);             // faces +Z
  camAt(g.engine.camera, 0, 4, 0);           // 4 m in front of it
  assert.equal(lvl.isSeenBy(child, { eye: new THREE.Vector3(0, 0.95, 0) }), true);
  camAt(g.engine.camera, 0, -4, 0);          // behind it
  assert.equal(lvl.isSeenBy(child), false);
  camAt(g.engine.camera, 0, 12, 0);          // beyond maxDist
  assert.equal(lvl.isSeenBy(child, { maxDist: 8 }), false);
  camAt(g.engine.camera, 3, 4, 0);           // 37° off the axis: inside 45, outside 30
  assert.equal(lvl.isSeenBy(child, { angleDeg: 45 }), true);
  assert.equal(lvl.isSeenBy(child, { angleDeg: 30 }), false);
});

test('isSeenBy: an occluder between the object and the camera hides the camera', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const child = looker(0, 0, 0);
  camAt(g.engine.camera, 0, 4, 0);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2), new THREE.MeshBasicMaterial());
  wall.position.set(0, 1.5, 2); wall.updateMatrixWorld(true);
  assert.equal(lvl.isSeenBy(child, { occluders: [wall] }), false);
  wall.position.set(0, 1.5, 6); wall.updateMatrixWorld(true);   // beyond the camera
  assert.equal(lvl.isSeenBy(child, { occluders: [wall] }), true);
});

test('footsteps walks a polyline at a stride, one positional sound per step, then onDone', async () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  let done = false; const steps = [];
  lvl.footsteps([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }],
    { stride: 1, every: 0.01, sound: 'smallStep', opts: { soft: true }, onStep: (i, p) => steps.push([i, p.x, p.z]), onDone: () => { done = true; } });
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(done, true);
  assert.equal(g.calls.sfxAt.length, 4);                       // length 3 → floor(3/1)+1 = 4 steps
  assert.equal(g.calls.sfxAt[0].name, 'smallStep');
  assert.equal(g.calls.sfxAt[0].opts.soft, true);
  assert.deepEqual(steps.map((s) => s.slice(1)), [[0, 0], [1, 0], [2, 0], [2, 1]]);
});

test('footsteps: cancel() stops the remaining steps', async () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const cancel = lvl.footsteps([{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }], { stride: 1, every: 0.02 });
  await new Promise((r) => setTimeout(r, 30));
  cancel();
  const n = g.calls.sfxAt.length;
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(g.calls.sfxAt.length, n);
  assert.ok(n >= 1 && n < 6);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/levelbase-arc3.test.mjs`
Expected: failures — `lvl.setMood is not a function`, `lvl.isSeenBy is not a function`, `lvl.footsteps is not a function`.

- [ ] **Step 3: Implement**

In `src/core/LevelBase.js`, after `hush(seconds, depth) { ... }` add:

```js
  /** Change the ambience mid-room (the hours use it). */
  setMood(key) { this.game.audio.setAmbience?.(key); }
```

After `isSeen(...)` add:

```js
  /**
   * Is the camera inside `obj`'s forward cone (its local +Z — the front of a
   * figure or a child)? `eye` is a world-units offset added to obj's position
   * (a child's eyes are about 0.95 m up). The mirror of isSeen.
   */
  isSeenBy(obj, { angleDeg = 30, maxDist = 8, occluders = null, eye = null } = {}) {
    const cam = this.game.engine.camera;
    obj.getWorldPosition(_p);
    if (eye) _p.add(eye);
    cam.getWorldPosition(_c);
    _d.subVectors(_c, _p);
    const dist = _d.length();
    if (dist > maxDist) return false;
    if (dist < 1e-6) return true;
    _d.divideScalar(dist);
    obj.getWorldDirection(_f);
    if (_f.dot(_d) < Math.cos(angleDeg * Math.PI / 180)) return false;
    if (occluders && occluders.length) {
      _ray.set(_p, _d);
      _ray.far = Math.max(0, dist - 0.05);
      if (_ray.intersectObjects(occluders, true).length) return false;
    }
    return true;
  }
```

After `playSoundAt(...)` add:

```js
  /**
   * A walk you hear: one positional `sound` every `every` seconds, `stride`
   * metres apart along the polyline `points` ([{x,y,z}, …]). Steps are
   * `after()` timeouts, so dispose() clears them. Returns cancel().
   */
  footsteps(points, { stride = 0.55, every = 0.5, sound = 'smallStep', opts = {}, onStep = null, onDone = null } = {}) {
    const pts = points.map((p) => new THREE.Vector3(p.x, p.y ?? 0, p.z));
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); segs.push(l); total += l; }
    const at = (d) => {
      let acc = 0;
      for (let i = 0; i < segs.length; i++) {
        if (d <= acc + segs[i] || i === segs.length - 1) {
          const k = segs[i] > 0 ? Math.min(1, Math.max(0, (d - acc) / segs[i])) : 0;
          return new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], k);
        }
        acc += segs[i];
      }
      return pts[pts.length - 1].clone();
    };
    const n = Math.floor(total / stride) + 1;
    const ids = [];
    let cancelled = false;
    for (let i = 0; i < n; i++) {
      ids.push(this.after(i * every, () => {
        if (cancelled) return;
        const pos = at(Math.min(total, i * stride));
        this.playSoundAt(sound, pos, opts);
        onStep?.(i, pos);
        if (i === n - 1) onDone?.();
      }));
    }
    return () => {
      cancelled = true;
      for (const id of ids) { clearTimeout(id); this._timeouts.delete(id); }
    };
  }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/levelbase-arc3.test.mjs && npm test`
Expected: all pass (the older `tests/levelbase.test.mjs`, `presence`, `save` tests still pass).

- [ ] **Step 5: Commit**

```bash
git add src/core/LevelBase.js tests/levelbase-arc3.test.mjs
git commit -m "core: setMood, isSeenBy (the child's view cone) and footsteps (a walk you hear)"
```

---

### Task 3: `hours.js` — a room at three hours, swapped under a blink

**Files:**
- Create: `src/core/hours.js`
- Test: `tests/hours.test.mjs`

**Interfaces:**
- Consumes: `level.scene`, `level.solids`, `level.loopAt`, `level.setMood` (Task 2), `level.game.engine.setGrade`, `level.game.ui.flash`, `level.game.interaction.setEnabled`.
- Produces (used by Tasks 5, 7–11):
  ```js
  import { Hours } from '../core/hours.js';
  const hours = new Hours(level, { order, initial, fade, blink, onChange });   // defaults: ['night','morning','evening'], 'night', 1.6, 140, null
  hours.bind(hour, { objects, interact, lights: [{ light, intensity }], colliders, blockers: [[min],[max]], fog: { color, near, far }, grade, mood, loops: [{ kind, position, opts }], onEnter, onLeave });
  hours.start(); level.track(hours);
  hours.set(hour) → boolean; hours.next() → boolean; hours.current; hours.changing; hours.is(hour)
  ```

Spec: §4.3 — read it; the semantics below follow it exactly.

- [ ] **Step 1: Write the failing tests**

Create `tests/hours.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LevelBase } from '../src/core/LevelBase.js';
import { Hours } from '../src/core/hours.js';

function fakeGame() {
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.08, 600);
  const calls = { flashes: 0, grades: [], moods: [], enabled: [], loops: [] };
  return {
    engine: { camera, pulseGrade() {}, setGrade: (g) => calls.grades.push({ ...g }) },
    ui: { subtitle() {}, flash: () => { calls.flashes++; }, setObjective() {}, addClue() {}, showNote() {}, setItems() {} },
    audio: {
      sfx() {}, sfxAt() {}, setDread() {}, hush() {}, setAmbience: (m) => calls.moods.push(m),
      loopAt: (kind) => { const h = { kind, stopped: false, stop() { h.stopped = true; }, setPosition() {}, setGain() {} }; calls.loops.push(h); return h; },
    },
    interaction: { add() {}, clear() {}, remove() {}, setEnabled: (o, on) => calls.enabled.push([o.name, on]) },
    player: { setColliders() {}, position: new THREE.Vector3(0, 1.62, 0) },
    save: { data: { captions: false } },
    calls,
  };
}
class L extends LevelBase {
  build() { this.scene.fog = new THREE.Fog('#000000', 1, 10); this.scene.background = new THREE.Color('#000000'); }
}
const named = (n) => { const o = new THREE.Object3D(); o.name = n; return o; };

function setup() {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const hours = new Hours(lvl, { fade: 1.0, blink: 100 });
  const pan = named('pan'), box = named('box'), always = named('always');
  const lampE = new THREE.PointLight(0xffffff, 0), lampM = new THREE.PointLight(0xffffff, 0);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); wall.position.set(5, 0.5, 0); wall.updateMatrixWorld(true);
  hours.bind('night', { objects: [pan], interact: [pan], fog: { color: '#0a0a10', near: 1.5, far: 14 }, grade: { lift: 0.02 }, mood: 'night' });
  hours.bind('morning', { objects: [box], interact: [box], lights: [{ light: lampM, intensity: 2 }], colliders: [wall], fog: { color: '#d8d5ce', near: 1, far: 9 }, grade: { lift: 0.09 }, mood: 'morning', loops: [{ kind: 'birds', position: { x: 0, y: 1, z: 0 } }] });
  hours.bind('evening', { lights: [{ light: lampE, intensity: 4 }], mood: 'evening', blockers: [[[0, 0, 0], [1, 1, 1]]] });
  return { g, lvl, hours, pan, box, always, lampE, lampM, wall };
}

test('start applies the initial hour at once: visibility, interactables, lights, fog, grade, mood', () => {
  const { g, lvl, hours, pan, box, lampE, lampM } = setup();
  hours.start();
  assert.equal(hours.current, 'night');
  assert.equal(pan.visible, true); assert.equal(box.visible, false);
  assert.deepEqual(g.calls.enabled.sort(), [['box', false], ['pan', true]]);
  assert.equal(lampE.intensity, 0); assert.equal(lampM.intensity, 0);
  assert.equal(lvl.scene.fog.far, 14);
  assert.equal(g.calls.grades.at(-1).lift, 0.02);
  assert.deepEqual(g.calls.moods, ['night']);
  assert.equal(g.calls.flashes, 0);
});

test('next() cycles night → morning → evening → night and refuses while changing', () => {
  const { hours } = setup(); hours.start();
  assert.equal(hours.next(), true);
  assert.equal(hours.changing, true);
  assert.equal(hours.next(), false);                 // busy
  hours.update(2.0);
  assert.equal(hours.current, 'morning'); assert.equal(hours.changing, false);
  hours.next(); hours.update(2.0); assert.equal(hours.current, 'evening');
  hours.next(); hours.update(2.0); assert.equal(hours.current, 'night');
});

test('the swap happens under the blink at the midpoint; lights and fog lerp across the fade', () => {
  const { g, lvl, hours, pan, box, lampM, wall } = setup(); hours.start();
  hours.set('morning');
  hours.update(0.25);                                 // k = 0.25 — before the midpoint
  assert.equal(hours.current, 'night'); assert.equal(pan.visible, true); assert.equal(g.calls.flashes, 0);
  assert.ok(lampM.intensity > 0 && lampM.intensity < 2, `lerping: ${lampM.intensity}`);
  hours.update(0.3);                                  // k = 0.55 — past the midpoint
  assert.equal(hours.current, 'morning'); assert.equal(g.calls.flashes, 1);
  assert.equal(pan.visible, false); assert.equal(box.visible, true);
  assert.ok(lvl.solids.some((b) => b.min.x > 4), 'the morning collider is solid now');
  assert.equal(g.calls.loops.length, 1); assert.equal(g.calls.loops[0].kind, 'birds');
  assert.equal(g.calls.moods.at(-1), 'morning');
  hours.update(1.0);                                  // done
  assert.equal(hours.changing, false);
  assert.equal(lampM.intensity, 2);
  assert.equal(lvl.scene.fog.far, 9);
  assert.equal(g.calls.grades.at(-1).lift, 0.09);
});

test('leaving an hour stops its loops and removes its solids; onEnter/onLeave/onChange fire in order', () => {
  const { g, lvl, hours } = setup();
  hours.start();                                       // (start() also fires onChange, with prev null — so wire the log after it)
  const log = [];
  hours.bind('morning', { onEnter: (h) => log.push('enter ' + h), onLeave: (h) => log.push('leave ' + h) });
  hours.onChange = (h, prev) => log.push(`change ${prev}→${h}`);
  hours.set('morning'); hours.update(2.0);
  const solidsInMorning = lvl.solids.length;
  hours.set('evening'); hours.update(2.0);
  assert.equal(g.calls.loops[0].stopped, true);
  assert.equal(lvl.solids.length, solidsInMorning);    // one Box3 out (the wall), one in (the blocker)
  assert.ok(!lvl.solids.some((b) => b.min.x > 4));
  assert.deepEqual(log, ['enter morning', 'change night→morning', 'leave morning', 'change morning→evening']);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/hours.test.mjs`
Expected: fails — cannot find module `../src/core/hours.js`.

- [ ] **Step 3: Implement `src/core/hours.js`**

```js
import * as THREE from 'three';

// The hours: a room that exists at three times — her evening, 3:07, the
// morning the house is emptied — and a helper that crossfades lights, fog
// and grade between them and swaps everything else under a blink.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §4.3

const BASE = { vignette: 1.15, grain: 0.026, desat: 0.16, lift: 0.025, fringe: 0.00045 };
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const emptySpec = () => ({ objects: [], interact: [], lights: [], boxes: [], fog: null, grade: null, mood: null, loops: [], onEnter: [], onLeave: [] });

export class Hours {
  constructor(level, { order = ['night', 'morning', 'evening'], initial = 'night', fade = 1.6, blink = 140, onChange = null } = {}) {
    this.level = level;
    this.order = order.slice();
    this.fade = fade;
    this.blink = blink;
    this.onChange = onChange;
    this.current = null;
    this._initial = initial;
    this._specs = new Map(order.map((h) => [h, emptySpec()]));
    this._t = null;          // the running transition, or null
    this._loops = [];        // the current hour's loop handles
    this._boxes = [];        // the current hour's Box3s, pushed into level.solids
  }

  /** Register what belongs to an hour. May be called many times per hour; specs accumulate. */
  bind(hour, spec = {}) {
    const s = this._specs.get(hour) ?? emptySpec();
    this._specs.set(hour, s);
    for (const o of spec.objects ?? []) s.objects.push(o);
    for (const o of spec.interact ?? []) s.interact.push(o);
    for (const l of spec.lights ?? []) s.lights.push({ light: l.light, intensity: l.intensity ?? l.light.intensity });
    for (const o of spec.colliders ?? []) { o.updateWorldMatrix(true, true); s.boxes.push(new THREE.Box3().setFromObject(o)); }
    for (const [min, max] of spec.blockers ?? []) s.boxes.push(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
    if (spec.fog) s.fog = { ...spec.fog };
    if (spec.grade) s.grade = { ...spec.grade };
    if (spec.mood) s.mood = spec.mood;
    for (const l of spec.loops ?? []) s.loops.push(l);
    if (spec.onEnter) s.onEnter.push(spec.onEnter);
    if (spec.onLeave) s.onLeave.push(spec.onLeave);
    return this;
  }

  get changing() { return this._t !== null; }
  is(hour) { return this.current === hour; }

  /** Apply the initial hour at once — call at the end of build(), before track(). */
  start() {
    const spec = this._specs.get(this._initial);
    for (const s of this._specs.values()) for (const { light } of s.lights) light.intensity = 0;
    for (const { light, intensity } of spec.lights) light.intensity = intensity;
    const scene = this.level.scene;
    if (spec.fog && scene.fog) {
      scene.fog.color.set(spec.fog.color);
      scene.fog.near = spec.fog.near; scene.fog.far = spec.fog.far;
      scene.background?.set?.(spec.fog.color);
    }
    this.level.game.engine.setGrade?.({ ...BASE, ...(spec.grade ?? {}) });
    this._swap(null, this._initial);
  }

  /** Begin the crossfade to `hour`. False if unknown, current, or already changing. */
  set(hour) {
    if (!this._specs.has(hour) || hour === this.current || this._t) return false;
    const from = this.current;
    const fromSpec = from ? this._specs.get(from) : null;
    const toSpec = this._specs.get(hour);
    const lights = new Map();
    for (const s of this._specs.values()) {
      for (const { light } of s.lights) if (!lights.has(light)) lights.set(light, { from: light.intensity, to: 0 });
    }
    for (const { light, intensity } of toSpec.lights) lights.get(light).to = intensity;
    const scene = this.level.scene;
    const fogFrom = scene.fog ? { color: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far } : null;
    const fogTo = toSpec.fog ? { color: new THREE.Color(toSpec.fog.color), near: toSpec.fog.near, far: toSpec.fog.far } : null;
    const gradeFrom = { ...BASE, ...(fromSpec?.grade ?? {}) };
    const gradeTo = { ...BASE, ...(toSpec.grade ?? {}) };
    this._t = { hour, from, time: 0, swapped: false, lights, fogFrom, fogTo, gradeFrom, gradeTo };
    return true;
  }

  next() {
    const i = this.order.indexOf(this.current);
    return this.set(this.order[(i + 1) % this.order.length]);
  }

  /** Drive the fade. Register with level.track(hours). */
  update(dt) {
    const tr = this._t;
    if (!tr) return;
    tr.time += dt;
    const k = Math.min(1, tr.time / this.fade), e = ease(k);
    for (const [light, { from, to }] of tr.lights) light.intensity = from + (to - from) * e;
    const scene = this.level.scene;
    if (tr.fogFrom && tr.fogTo && scene.fog) {
      scene.fog.color.copy(tr.fogFrom.color).lerp(tr.fogTo.color, e);
      scene.fog.near = tr.fogFrom.near + (tr.fogTo.near - tr.fogFrom.near) * e;
      scene.fog.far = tr.fogFrom.far + (tr.fogTo.far - tr.fogFrom.far) * e;
      scene.background?.copy?.(scene.fog.color);
    }
    const g = {};
    for (const key of Object.keys(tr.gradeTo)) g[key] = tr.gradeFrom[key] + (tr.gradeTo[key] - tr.gradeFrom[key]) * e;
    this.level.game.engine.setGrade?.(g);
    if (!tr.swapped && k >= 0.5) {
      tr.swapped = true;
      this.level.game.ui.flash?.('#000', this.blink);
      this._swap(tr.from, tr.hour);
    }
    if (k >= 1) this._t = null;
  }

  // Everything that cannot lerp changes here, under the blink.
  _swap(from, hour) {
    const fromSpec = from ? this._specs.get(from) : null;
    const spec = this._specs.get(hour);
    const show = new Set(spec.objects);
    for (const s of this._specs.values()) for (const o of s.objects) o.visible = show.has(o);
    const touch = new Set(spec.interact);
    for (const s of this._specs.values()) for (const o of s.interact) this.level.game.interaction.setEnabled(o, touch.has(o));
    for (const b of this._boxes) { const i = this.level.solids.indexOf(b); if (i >= 0) this.level.solids.splice(i, 1); }
    this._boxes = spec.boxes.slice();
    this.level.solids.push(...this._boxes);
    for (const h of this._loops) h.stop?.(0.6);
    this._loops = spec.loops.map((l) => this.level.loopAt(l.kind, l.position, l.opts));
    if (spec.mood) this.level.setMood?.(spec.mood);
    const prev = this.current;
    this.current = hour;
    for (const fn of fromSpec?.onLeave ?? []) fn(from);
    for (const fn of spec.onEnter) fn(hour);
    this.onChange?.(hour, prev);
  }
}
```

Note on `interact`: `interaction.setEnabled(obj, on)` is a no-op for objects
that were never registered with `level.interact(...)`, so binding a thing
before registering it is harmless — but register (`this.interact`) before
`hours.start()` so the initial hour's enabling sticks.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/hours.test.mjs && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/hours.js tests/hours.test.mjs
git commit -m "core: Hours — a room at three hours, crossfaded and swapped under a blink"
```

---

### Task 4: `makeChild` (presence.js) and `makeClockFace` (props.js)

**Files:**
- Modify: `src/core/presence.js`
- Modify: `src/core/props.js`
- Test: `tests/arc3-props.test.mjs` (new)

**Interfaces:**
- Produces (used by Tasks 7–11):
  - `makeChild({ height = 1.12 })` → `THREE.Group` with `.torch` (SpotLight), `.setTorch(on)`, `.faceToward(p)`, `.setHeight(h)`, `.update(dt)` (no-op), `userData.isChild`
  - `makeClockFace({ radius = 0.16, face = '#e8e2d3', hands = '#2a2622' })` → `THREE.Group` with `.setTime(h, m, animate = 1.6)` and `.update(dt)`

Spec: §4.4, §4.5.

- [ ] **Step 1: Write the failing tests**

Create `tests/arc3-props.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeChild } from '../src/core/presence.js';
import { makeClockFace } from '../src/core/props.js';

test('makeChild is small, lit, shadow-casting, faceless, with a torch that switches', () => {
  const c = makeChild();
  const box = new THREE.Box3().setFromObject(c);
  assert.ok(box.max.y > 1.0 && box.max.y < 1.25, `height ${box.max.y}`);
  let meshes = 0;
  c.traverse((o) => { if (o.isMesh && o !== c._lens) { meshes++; } });
  assert.ok(meshes >= 4);
  const body = c.children.find((o) => o.isMesh);
  assert.equal(body.castShadow, true);
  assert.ok(body.material.color.getHex() > 0x404040, 'lit material, not the figure\'s black');
  assert.ok(c.torch.isSpotLight);
  assert.equal(c.torch.intensity, 0);
  c.setTorch(true);
  assert.equal(c.torch.intensity, 6);
  c.setTorch(false);
  assert.equal(c.torch.intensity, 0);
  assert.equal(c.userData.isChild, true);
  c.faceToward({ x: 0, y: 0, z: 5 });
  assert.ok(Math.abs(c.rotation.y) < 1e-6);
  c.faceToward({ x: 5, y: 0, z: 0 });
  assert.ok(Math.abs(c.rotation.y - Math.PI / 2) < 1e-6);
});

test('makeChild: the torch target sits in front of the child (local +Z)', () => {
  const c = makeChild();
  c.updateMatrixWorld(true);
  const p = new THREE.Vector3(); c.torch.target.getWorldPosition(p);
  assert.ok(p.z > 2, `target z ${p.z}`);
});

test('makeClockFace: setTime turns the hands; animate 0 is instant; update eases toward the target', () => {
  const clock = makeClockFace({ radius: 0.16 });
  clock.setTime(3, 0, 0);
  const hour = clock._hour, minute = clock._minute;
  assert.ok(Math.abs(hour.rotation.z + Math.PI / 2) < 1e-6, 'three o\'clock: the hour hand a quarter turn clockwise');
  assert.ok(Math.abs(minute.rotation.z) < 1e-6);
  clock.setTime(6, 30, 1.0);
  assert.ok(Math.abs(hour.rotation.z + Math.PI / 2) < 1e-6, 'not yet moved');
  clock.update(0.5);
  const mid = hour.rotation.z;
  assert.ok(mid < -Math.PI / 2 && mid > -Math.PI * 13 / 12, `moving clockwise: ${mid}`);
  clock.update(0.6);
  assert.ok(Math.abs(hour.rotation.z + Math.PI * 13 / 12) < 1e-6, 'half past six: 6.5/12 of a turn');
  assert.ok(Math.abs(minute.rotation.z + Math.PI) < 1e-6);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/arc3-props.test.mjs`
Expected: fails — `makeChild` / `makeClockFace` are not exported.

- [ ] **Step 3: Implement `makeChild`**

Append to `src/core/presence.js` (after `makeFigure`, before `Presence`):

```js
/**
 * Someone small: the figure's primitives at child height, but lit — a warm
 * grey, casting shadows, no face — with a torch on its brow that points
 * along its front (local +Z). Rooms animate it; update() is a no-op so
 * level.track(child) is harmless.
 */
export function makeChild({ height = 1.12 } = {}) {
  const g = new THREE.Group();
  const k = height / 1.12;
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a8c80, roughness: 0.9, metalness: 0 });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * k, 0.08 * k, height * 0.22, 8), mat);
  legs.position.y = height * 0.11;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * k, 0.13 * k, height * 0.42, 10), mat);
  body.position.y = height * 0.43;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.14 * k, 10, 8), mat);
  shoulders.scale.set(1, 0.45, 0.7);
  shoulders.position.y = height * 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085 * k, 12, 10), mat);
  head.position.y = height * 0.9;
  g.add(legs, body, shoulders, head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  const torch = new THREE.SpotLight(0xffe7b8, 0, 11, 0.36, 0.55, 1.4);
  torch.position.set(0, 0.78 * height, 0.12);
  const target = new THREE.Object3D();
  target.position.set(0, 0.6 * height, 4);
  g.add(target);
  torch.target = target;
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe7b8, emissiveIntensity: 0 })
  );
  lens.position.copy(torch.position);
  lens.castShadow = false;
  g.add(torch, lens);
  g._lens = lens;
  g.torch = torch;
  g.setTorch = (on) => { torch.intensity = on ? 6 : 0; lens.material.emissiveIntensity = on ? 2.5 : 0; };
  g.faceToward = (p) => { g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z); };
  g.setHeight = (h) => { g.scale.setScalar(h / height); };
  g.update = () => {};
  g.userData.isChild = true;
  return g;
}
```

- [ ] **Step 4: Implement `makeClockFace`**

Append to `src/core/props.js` (after `makeSign`):

```js
/**
 * A clock face: a disc with twelve ticks and two hands, facing +Z.
 * clock.setTime(h, m, animate) turns the hands (clockwise, the short way
 * forward) over `animate` seconds; register with level.track(clock).
 * Rooms wrap it in a case.
 */
export function makeClockFace({ radius = 0.16, face = '#e8e2d3', hands = '#2a2622' } = {}) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshStandardMaterial({ color: face, emissive: face, emissiveIntensity: 0.12, roughness: 0.6 })
  );
  g.add(disc);
  const dark = new THREE.MeshStandardMaterial({ color: hands, roughness: 0.6 });
  for (let i = 0; i < 12; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.04, radius * 0.12, 0.004), dark);
    const a = (i / 12) * Math.PI * 2;
    tick.position.set(Math.sin(a) * radius * 0.86, Math.cos(a) * radius * 0.86, 0.003);
    tick.rotation.z = -a;
    g.add(tick);
  }
  const hand = (len, w) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.004), dark);
    m.position.y = len / 2 - w;
    pivot.add(m);
    pivot.position.z = 0.006;
    g.add(pivot);
    return pivot;
  };
  const hour = hand(radius * 0.55, radius * 0.07);
  const minute = hand(radius * 0.85, radius * 0.05);
  g._hour = hour; g._minute = minute;

  let ah = 0, am = 0;                 // current angles, clockwise from 12
  let fh = 0, fm = 0, th = 0, tm = 0; // from / to
  let animT = 0, animDur = 0;
  const apply = () => { hour.rotation.z = -ah; minute.rotation.z = -am; };
  const forward = (a, b, e) => { let d = b - a; while (d < 0) d += Math.PI * 2; return a + d * e; };
  g.setTime = (h, m, animate = 1.6) => {
    fh = ah; fm = am;
    th = (((h % 12) + m / 60) / 12) * Math.PI * 2;
    tm = (m / 60) * Math.PI * 2;
    animDur = Math.max(0, animate); animT = 0;
    if (animDur === 0) { ah = th; am = tm; apply(); }
  };
  g.update = (dt) => {
    if (animT >= animDur) return;
    animT = Math.min(animDur, animT + dt);
    const k = animDur ? animT / animDur : 1;
    const e = 1 - Math.pow(1 - k, 3);
    ah = forward(fh, th, e);
    am = forward(fm, tm, e);
    if (k >= 1) { ah = th; am = tm; }
    apply();
  };
  apply();
  return g;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test tests/arc3-props.test.mjs && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/presence.js src/core/props.js tests/arc3-props.test.mjs
git commit -m "core: makeChild (someone small, lit, with a torch) and makeClockFace"
```

---

### Task 5: Flow — the new epilogue, the ending card, the menu subtitle; `screenshot --hour`

**Files:**
- Modify: `src/levels/index.js` (the `EPILOGUE` constant and the header comment)
- Modify: `src/main.js` (`game.onLevelComplete` ending card; `buildMenu` subtitle)
- Modify: `tools/screenshot.mjs`

**Interfaces:**
- Consumes: rooms expose `this.hours` (Tasks 7–11) — the screenshot tool calls `window.__game.level.hours.set(hour)`.
- Produces: `EPILOGUE` (spec §2.2), the ending card, the three-state subtitle, `node tools/screenshot.mjs N --hour morning|evening|night`.

Spec: §2.1, §2.2, §4.6, §6.3.

- [ ] **Step 1: The epilogue**

In `src/levels/index.js` change the header comment's "Level15.js" to "Level20.js" and replace the `EPILOGUE` constant with:

```js
export const EPILOGUE =
  'You open your eyes.\n\n' +
  'Morning. It stays.\n' +
  'Across the landing, a door you locked and a light you left on,\n' +
  'and somebody small behind it, not yet awake,\n' +
  'who will not remember any of this.\n\n' +
  'You go down, and put the kettle on, and leave the light on.';
```

(Until Task 7 lands, a save that finishes XV sees this new text after XV. That is fine on the branch; Task 7 moves the old text into XVI's prologue.)

- [ ] **Step 2: The ending card and the subtitle**

In `src/main.js`, in `game.onLevelComplete`, change the ending card line to:

```js
    await ui.showInterlude('H I R A E T H\n\na dream in twenty rooms\n\nthank you for leaving the light on');
```

In `buildMenu()`, replace the `#menu-sub` assignment with:

```js
  const done = save.data.completed;
  document.getElementById('menu-sub').textContent = done.includes(15)
    ? 'a dream in ten rooms · the five beneath · the five above'
    : done.includes(10)
      ? 'a dream in ten rooms · and the five beneath'
      : 'a dream in ten rooms';
```

- [ ] **Step 3: `--hour` in the screenshot tool**

In `tools/screenshot.mjs`, after the `out` line add:

```js
const hour = args.includes('--hour') ? args[args.indexOf('--hour') + 1] : null;
```

After `await loadLevel(page, url, level);` add:

```js
  if (hour) {
    const ok = await page.evaluate((h) => {
      const hrs = window.__game.level?.hours;
      if (!hrs) return false;
      hrs.set(h);
      return true;
    }, hour);
    if (!ok) throw new Error(`level ${level} has no hours (set --hour only on rooms XVI–XX)`);
    await page.waitForTimeout(2500);          // the 1.6 s crossfade, then a beat
  }
```

and change the file name to include the hour when given:

```js
      await page.screenshot({ path: `${out}/level${pad}-${hour ? hour + '-' : ''}${name}.png` });
```

and the final log line to `saved 4 screenshots to ${out}/level${pad}-${hour ? hour + '-' : ''}*.png`.

- [ ] **Step 4: Verify**

Run: `node --check src/main.js && node --check tools/screenshot.mjs && npx vite build 2>&1 | tail -2 && node tools/playtest.mjs 1 --port 5305`
Expected: the build passes; `level 1: SOLVED`.

Run: `node tools/screenshot.mjs 1 --port 5306 --hour morning`
Expected: exits non-zero with `level 1 has no hours` (the flag is guarded; rooms XVI–XX will satisfy it).

- [ ] **Step 5: Commit**

```bash
git add src/levels/index.js src/main.js tools/screenshot.mjs
git commit -m "flow: the new epilogue and ending card, the three-state menu subtitle, screenshot --hour"
```

---

### Task 6: Docs — LEVEL_API.md and DESIGN.md

**Files:**
- Modify: `docs/LEVEL_API.md`
- Modify: `docs/DESIGN.md`

Spec: §4.6 (docs bullets), §3, §3.2.

- [ ] **Step 1: LEVEL_API.md**

Change the opening paragraph's "Fifteen levels" to "Twenty levels". In the
"File & class shape" section change `id: N, // level number, 1..15` to
`1..20`, and add `'../core/hours.js'` to the allowed imports sentence. In
"Audio", extend the mood list with `evening morning`, the one-shot list with
`wind {clicks=9, gap=0.07} smallStep {soft} tick gasp lock`, note `hummed
{…, small}`, and the loop kinds with `birds idle fire simmer`. After the
"Seen / unseen, blinks, the figure" section add:

```markdown
## The hours, the child, a walk you hear (rooms XVI–XX)

- `import { Hours } from '../core/hours.js'` — a room that exists at three
  hours. `const hours = new Hours(this, { order: ['night','morning','evening'], initial: 'night', fade: 1.6, blink: 140, onChange })`;
  `hours.bind(hour, { objects, interact, lights: [{ light, intensity }], colliders, blockers, fog: { color, near, far }, grade, mood, loops: [{ kind, position, opts }], onEnter, onLeave })`
  (specs accumulate; an object bound anywhere is hidden at the hours it is
  not bound to; a light bound anywhere is driven to 0 at the others);
  `hours.start()` at the end of `build()`, then `this.track(hours)`;
  `hours.set(hour)` / `hours.next()` crossfade lights, fog and grade over
  `fade` seconds and swap everything else under a `flash()` blink at the
  midpoint; `hours.current`, `hours.changing`, `hours.is(hour)`. Keep the
  instance at `this.hours` (the screenshot tool's `--hour` flag uses it).
  The room plays the `wind` sound and turns its clock's hands itself.
- `makeClockFace({ radius, face, hands })` (props) → a face facing +Z with
  `.setTime(h, m, animate = 1.6)` and `.update(dt)` (track it). Wrap it in a
  case.
- `makeChild({ height = 1.12 })` (presence) → someone small: lit, warm grey,
  casts shadows, no face; `child.torch` (a SpotLight along its front),
  `child.setTorch(on)`, `child.faceToward(p)`, `child.setHeight(h)`.
- `this.isSeenBy(obj, { angleDeg = 30, maxDist = 8, occluders, eye })` — is
  the camera inside `obj`'s forward cone (its local +Z)? The mirror of
  `isSeen`. `eye` is a world-units offset for the object's eyes.
- `this.footsteps(points, { stride = 0.55, every = 0.5, sound = 'smallStep', opts, onStep, onDone })`
  — a walk you hear along a polyline; returns `cancel()`.
- `this.setMood(key)` — change the ambience mid-room (the hours do it).

### Rooms XVI–XX: the other side

The five above keep every rule of the five beneath and add six: the child
and the player are never closer than about two metres to each other; the
child is lit, small and faceless and never speaks (it hums, gasps,
breathes, turns over); the player is shown as the figure only once, in the
glass in XX; being seen by the child costs progress, never a room; the
morning hour is sad, never frightening; she is never seen at the evening
hour — warmth, sound and things just set down are all she is. Doors onward
open at 3:07 only; what you put down at another hour does not stay.
```

- [ ] **Step 2: DESIGN.md**

In the arc table add rows:

```markdown
| 16 | XVI | The Kitchen | `night` | 8 |
| 17 | XVII | The Hall | `night` | 8 |
| 18 | XVIII | The Sitting Room | `night` | 9 |
| 19 | XIX | The Stairs | `stairwell` | 9 |
| 20 | XX | The Room | `night` | 10 |
```

and after the "Phases 5–7 — doubt" bullet add:

```markdown
- **Phases 8–10 — leave (XVI–XX):** the room exists at three hours and you
  are on her side of it; you make the clue and the child's dream tests it.
  Full design: `docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md`.
```

In **Canon**, after the "Humming." bullet, add the arc-3 canon bullets from
the spec's §3.2 verbatim (the hours; XVI's fuse order, pan and key; XVII's
placements and the corridor; XVIII's 247 and the torch; XIX's boxes, the
box crossed twice, the stub lights and the chalk; XX's starting state and
the landing light; the child; M. at the evening hour).

After the "Rooms XI–XV — the five beneath" section add:

```markdown
## Rooms XVI–XX — the five above

Years after the true waking the house comes back for someone small asleep
upstairs, and you are on M.'s side of every door. Kitchen (the hours; the
fuses), Hall (I's corridor; the rehearsal), Sitting Room (the wireless; the
child with the torch), the Stairs (the filing; XII's shaft with the roles
swapped), the Room (XI set as she left it; the glass; the last light). Every
layout, hour, puzzle, text and cue is in the spec above; the same
production notes apply (one file per room, ports 51NN/52NN, full-suite gate
20/20).
```

and in **Production notes** change "15/15" to "20/20" and add "also screenshot
the other two hours with `--hour morning` and `--hour evening`."

- [ ] **Step 3: Commit**

```bash
git add docs/LEVEL_API.md docs/DESIGN.md
git commit -m "docs: level API for the hours, the child, footsteps; arc-3 canon"
```

---

## Room tasks — how to work them

Tasks 7–11 are independent: one agent each, one new file each, no shared
files. Each room task gives the skeleton (imports, meta, constants, the
`build()` outline with member names), the `Hours` bindings, the puzzle
wiring in full, and the `debugSolve()` in full. The furniture and shell are
described by position and member name; build them from `makeWall` boxes,
planes and the `props.js` helpers the way Level11/Level15 do (`_box`,
`_plane`, `_room`).

Per room, in this order:

1. Read the spec's §5.N completely, the §5 conventions, and §1.2.
2. Scaffold: meta, constants, the shell and lights for all three hours,
   `this.hours` with its bindings, spawn, bounds, a `debugSolve()` that only
   teleports to the threshold. Build (`npx vite build`) and screenshot
   (`node tools/screenshot.mjs N --port 51NN`, then `--hour morning`, then
   `--hour evening`). LOOK at the twelve images. Iterate until every hour is
   composed, lit and textured.
3. Wire the puzzle as given, then the real `debugSolve()`. Run
   `node tools/playtest.mjs N --port 52NN` until `SOLVED`.
4. Walk it once yourself in a browser if you can (`npm run dev`, then
   `?level=N`), at each hour, with sound.
5. Commit with the task's message.

Hour-binding rules of thumb:

- Bind the per-hour `HemisphereLight`s, the warm bulbs, the moon light and
  the morning `DirectionalLight` through `lights` so the crossfade carries
  the colour. Bind white window panes (emissive planes) through `objects`.
- Bind hour-only furniture through `objects` and, if it blocks, `colliders`
  — never `this.addCollider` it (that would be solid at every hour).
- Bind hour-only interactables through `interact` (register them with
  `this.interact` first). Things that are visible at every hour but touchable
  at one: `interact` only.
- Boxes at the morning: `objects` + `colliders` + `interact`.
- Doors that only open at one hour: the door is visible at every hour;
  its `onInteract` checks `this.hours.current`.
- Call `this.interact(...)` for everything, then `this.hours.start()`, then
  `this.track(this.hours)` — in that order, at the end of `build()`.

The `wind` and the clock, the same in every room:

```js
  _wind() {
    if (this._clockLocked || this.hours.changing) return;
    this.playSoundAt('wind', CLOCK_POS);
    const next = this.hours.order[(this.hours.order.indexOf(this.hours.current) + 1) % 3];
    const [h, m] = { night: [3, 7], morning: [7, 15], evening: [8, 30] }[next];
    this._clockFace.setTime(h, m, 1.6);
    this.hours.next();
    if (!this._wound) {
      this._wound = true;
      this.subtitle('The hands move. They never did, before.', 5);
    }
  }
```

The per-hour look (spec §5 conventions), the same in every room —
`_bindLook()`:

```js
  _bindLook(windowPos, sunFrom) {
    const hemiN = new THREE.HemisphereLight(0x2a2e44, 0x07070a, 0);
    const hemiE = new THREE.HemisphereLight(0x5a4a3a, 0x1a1410, 0);
    const hemiM = new THREE.HemisphereLight(0xffffff, 0xcfcac0, 0);
    this.add(hemiN, hemiE, hemiM);
    const moon = new THREE.PointLight(0x6c7ea8, 0, 8, 1.8);
    moon.position.set(windowPos.x, windowPos.y, windowPos.z);
    this.add(moon);
    const sun = new THREE.DirectionalLight(0xfff2dc, 0);
    sun.position.set(sunFrom.x, sunFrom.y, sunFrom.z);
    sun.target.position.set(0, 1, 0);
    sun.castShadow = true;
    this.add(sun, sun.target);
    const GRADE_N = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
    const GRADE_E = { vignette: 1.2, grain: 0.03, desat: 0.08, lift: 0.03, fringe: 0.0005 };
    const GRADE_M = { vignette: 0.9, grain: 0.045, desat: 0.35, lift: 0.09, fringe: 0.001 };
    this.hours.bind('night',   { lights: [{ light: hemiN, intensity: 0.35 }, { light: moon, intensity: 1.2 }], fog: { color: '#0a0a10', near: 1.5, far: 14 }, grade: GRADE_N, mood: this.constructor.meta.mood });
    this.hours.bind('evening', { lights: [{ light: hemiE, intensity: 0.45 }], fog: { color: '#1a140f', near: 2, far: 18 }, grade: GRADE_E, mood: 'evening' });
    this.hours.bind('morning', { lights: [{ light: hemiM, intensity: 1.5 }, { light: sun, intensity: 1.4 }], fog: { color: '#d8d5ce', near: 1, far: 9 }, grade: GRADE_M, mood: 'morning',
      loops: [{ kind: 'birds', position: windowPos }] });
  }
```

The wrong-hour lines, the same in every room — `_wrongHourPlacing()`:

```js
  _wrongHourPlacing() {
    if (this.hours.is('evening')) this.subtitle('She\'d only tidy it away. Leave it for the night.', 5);
    else this.subtitle('There is nothing here to leave it on, not any more.', 5);
  }
```

A morning box, the same in every room — `_morningBox(label, x, z, onOpen)`
returns the box group (bind it: `objects`, `colliders`, `interact`):

```js
  _morningBox(label, x, z, onOpen) {
    const g = new THREE.Group();
    const card = new THREE.MeshStandardMaterial({ color: 0xa3896a, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), card);
    body.position.y = 0.2; body.castShadow = body.receiveShadow = true;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1),
      new THREE.MeshStandardMaterial({ map: textTexture({ text: label, font: '24px Georgia', color: '#3a332c', bg: '#d9cfbd', width: 384, height: 128 }), roughness: 0.9 }));
    lab.position.set(0, 0.26, 0.201);
    g.add(body, lab);
    g.position.set(x, 0, z);
    this.add(g);
    this.interact(g, { prompt: label.toLowerCase(), onInteract: () => onOpen(g) });
    return g;
  }
```

The `_waitFor` helper (Level15's), in every room:

```js
  async _waitFor(test, capSeconds) {
    const until = Date.now() + capSeconds * 1000;
    while (!test() && Date.now() < until) await this.debugWait(0.05);
  }
```

---

### Task 7: Room XVI — The Kitchen

**Files:**
- Create: `src/levels/Level16.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`Hours`, `makeClockFace`, `setMood`, `footsteps`, `wind`/`smallStep`/`tick`, `simmer`/`birds`/`idle`/`hum`/`tap`/`radio` loops, `meta.prologue`).
- Produces: `Level16` (auto-discovered by filename).

Spec: §5.1 — read all of it first, and the §5 conventions.

- [ ] **Step 1: Scaffold — meta, constants, shell for three hours, the clock, spawn, a threshold**

Create `src/levels/Level16.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, skyGradientTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeTable, makeChair,
  makeShelf, makeSign, makeDust, makeClockFace, applyFog,
} from '../core/props.js';
import { Hours } from '../core/hours.js';

// XVI — The Kitchen
// The house comes back for someone small; you are on her side of the door.
// The stopped clock moves you between her evening, 3:07 and the morning the
// house is emptied. Put the pan back, the little key down, write the fuses
// up — at night, because only the night counts — and the hall door gives.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.1

const W = 6.0, D = 4.6, H = 2.6;                       // interior; origin at the centre; −Z is the hall wall
const CLOCK_POS = { x: -1.5, y: 2.32, z: -2.27 };
const HALL_DOOR = { x: -1.5, y: 1.2, z: -2.3 };
const FUSE = { x: 2.94, y: 1.5, z: -1.4 };             // on the east wall, facing −X
const SWITCH_ORDER = ['porch', 'sitting', 'kitchen', 'yours', 'hall'];     // left → right as you face the box
const LABELS = ['', 'kitchen', 'hall', 'sitting room', 'your room', 'porch'];  // the plate cycle
const LABEL_OF = { porch: 'porch', sitting: 'sitting room', kitchen: 'kitchen', yours: 'your room', hall: 'hall' };
const OVERHEAD_MUSIC = { x: 1, y: 3.4, z: 0.5 };
const TUNE = LevelBase.tune('EGAGEGE');
const HUM = LevelBase.tune('EGAG');
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level16 extends LevelBase {
  static meta = {
    id: 16,
    numeral: 'XVI',
    title: 'The Kitchen',
    mood: 'night',
    grade: GRADE,
    prologue:
      'You open your eyes.\n\n' +
      'The ceiling of your own room. Morning.\n' +
      'This time it stays.\n\n' +
      'Somewhere, in a house that is gone, someone turns off the last light —\n' +
      'the one that was left on for you —\n' +
      'and goes to bed.\n\n' +
      'Years.\n\n' +
      'Then one night the house comes back, and it is not waiting for you.\n' +
      'Someone small is asleep upstairs, and every light is off,\n' +
      'and you know what that is like.',
    intro: 'The kitchen, at the hour every clock in the house stopped.',
    outro:
      'You put the pan back and the key down and wrote the fuses up,\n' +
      'and the door to the hall gave, the way it gave for her,\n' +
      'onto a hall longer than the house.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    // state
    this._wound = false;
    this._panOnRange = false;
    this._keyPlaced = false;
    this._wrongCount = 0;
    this._on = {};                  // switch key -> bool (night)
    this._plate = [0, 0, 0, 0, 0];  // index into LABELS per plate
    this._timers = {};
    this._exitOpen = false;
    this._listRead = false;
    this._visitedEvening = false;
    this._tapPlayedAtNight = false;
    this._overheadArmed = false;

    this._buildShell();
    this._buildFurniture();
    this._buildFuseBox();
    this._buildClock();
    this._bindLook({ x: -2.9, y: 1.4, z: -0.6 }, { x: -9, y: 6, z: -2 });
    this._wirePuzzle();

    this.spawn.position.set(2.3, 0, 1.2);
    this.spawn.yaw = Math.PI / 2;                          // facing −X into the room
    this.bounds = new THREE.Box3(new THREE.Vector3(-2.9, 0, -4.4), new THREE.Vector3(2.9, 3, 2.2));
    this.setObjective('the clock stopped at 3:07. every clock did.');

    this.hours.start();
    this.track(this.hours);
  }

  // ---------- small builders (as Level15) ----------

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  _plane(w, d, mat, x, y, z, facing) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = facing === 'up' ? -Math.PI / 2 : Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = facing === 'up';
    this.add(m);
    return m;
  }

  // (paste _bindLook, _wind, _wrongHourPlacing, _morningBox and _waitFor from "Room tasks — how to work them")

  _buildShell() {
    // floor, ceiling, four walls (plaster '#b9ad96', checker floor, ceiling texture) — see spec §5.1 Layout.
    // North wall (z −2.3) in pieces around the hall door at x −1.5 (1.0 wide) and the hatch at x +0.3 (0.7 × 0.5 at y 1.2, a shutter box on the kitchen side);
    // east wall (z +2.3 is south: the range wall; +X is the east/back-door wall) — the back door at z +1.2 (makeDoor, never opens) with the key hook beside it.
    // West wall: the window at z −0.6 (1.4 × 1.0 at y 1.3): a hole in the wall box, a pane (night: dark glossy; morning: emissive white plane bound to 'morning');
    // beyond it at x −6 a backdrop plane 8 × 4: this._backE (skyGradientTexture dusk, bound 'evening'), this._backN (black + 12 firefly points, bound 'night'), this._backM (white, bound 'morning').
    // The hall stub beyond the hall door: floor/ceiling/walls x −2.3..−0.7, z −2.3..−4.5 with I's wallpaper '#b7a48e'/'#a8927a' and carpet; a blocker at z −4.5.
    // Members this file needs later: this._hallDoor (makeDoor at (−1.5, 0, −2.3), tracked; NO panel collider — a doorway blocker stands in for it:
    //   this._hallBlocker = this.addBlocker([-2.0, 0, -2.4], [-1.0, 2.2, -2.2]) — removed when the door opens),
    // this._strip (emissive plane 0.9 × 0.02 at the door's foot on the kitchen side, emissiveIntensity 0),
    // this._hallLight (PointLight 0xffd9a8, 0, 3 at (−1.5, 1.4, −3.0)), this._hatchGlow (emissive plane behind the shutter's edges, intensity 0),
    // this._windowPos = { x: -2.9, y: 1.4, z: -0.6 }.
    // Morning: the hall door stands open (setAngle(Math.PI / 2) applied in an onEnter) onto a white emissive plane at z −3.2 and a blocker [−2.3,0,−3.2]..[−0.7,3,−2.6]; the
    // blocker is bound to 'morning' (blockers) and a night/evening blocker is not needed (the door panel is the collider until it opens).
  }

  _buildFurniture() {
    // Build per spec §5.1 and bind to hours. Keep these member names — _wirePuzzle uses them:
    //   this._bulb     makeBulbLight({ color: 0xffd2a0, intensity: 0, distance: 9, y: 2.35 }) at (0, 0, 0.2), light.castShadow = true — bound: evening 4.5 (lights); at night it is the kitchen switch's light (set directly)
    //   this._rangeGlow PointLight(0xff9a4a, 0, 3) at (−1.6, 0.9, 1.9) — bound: evening 1.2
    //   this._range    the range box at (−1.6, 0.45, 2.0); this._panEvening (pan + steam makeDust, bound 'evening'); this._panSink (in the sink at (−2.6, 0.92, −0.6), bound 'night');
    //                  this._panRange (the placed pan on the range, visible=false until placed; bound 'night'); the range is gone at the morning (bind the range box to ['night','evening'] and a pale splashback plane to 'morning')
    //   this._sink     (all hours), this._tapPos { x: −2.6, y: 1.0, z: −0.6 }
    //   this._fridge   (all hours) + this._fridgeDoorShut (night, evening) / this._fridgeDoorOpen (morning) + this._drawing (the crayon sunflower plane on the door, evening + morning) + loopAt hum at the fridge (night, evening)
    //   this._dresser  makeShelf at the north wall x +1.5; this._cup (a small cylinder on it, all hours); this._cupKey (makeKeyProp in the cup, bound 'evening', hidden once taken)
    //   this._table    makeTable({ w: 1.6, d: 0.9 }) at (0, 0, 0.2) (all hours; collider); this._sheet (a box 1.7 × 0.05 × 1.0 '#cfc8bb' at y 0.77, bound 'morning');
    //                  this._list (makeNoteProp at (0.3, 0.77, 0.1), bound 'evening'); this._keyOnTable (makeKeyProp at (−0.3, 0.77, 0.15), visible=false until placed; bound 'night')
    //   this._chairs   four makeChair around the table; this._chairSouth at (0, 0, 0.95) facing the table: night pushed in (z 0.85), evening pulled out (z 1.15) — keep one chair per hour bound through objects: this._chairSouthN, this._chairSouthE
    //   this._calendar makeSign 0.3 × 0.4 on the east wall at (2.94, 1.5, 0.2) facing −X: a month grid with one Sunday ringed red and 'sunflowers' in italic under it (all hours); at the morning a second sign over it with every later day crossed (bound 'morning')
    //   this._boxMisc, this._boxKeep, this._boxVan  _morningBox('KITCHEN — misc' | 'KITCHEN — keep' | 'KITCHEN — van') at (0.9, 1.3), (1.5, 1.3), (1.5, 0.7); bound 'morning' (objects, colliders, interact)
    //   this._hatchShutter (all hours; a box 0.7 × 0.5 × 0.03 on the north wall at (0.3, 1.2, −2.285))
    // Bind: this.hours.bind('night', { objects: [...night things], interact: [...] }) etc. Loops: evening { kind: 'simmer', position: rangePos }, { kind: 'radio', position: { x: 0.3, y: 1.2, z: -3.2 }, opts: {} }; night { kind: 'hum', position: fridgePos }; morning { kind: 'idle', position: { x: 8, y: 0.5, z: 1 } } (birds come from _bindLook).
  }

  _buildFuseBox() {
    const grey = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.5, metalness: 0.4 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.5), grey);
    box.position.set(FUSE.x, FUSE.y, FUSE.z);
    this.add(box); this.addCollider(box);
    this._switches = []; this._plates = []; this._plateMats = [];
    const swMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const z = FUSE.z - 0.18 + 0.09 * i;                // i = 0 is the leftmost as you face the box (looking +X, left is −Z)
      const pivot = new THREE.Group();
      pivot.position.set(FUSE.x - 0.07, FUSE.y, z);
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), swMat);
      sw.position.y = 0.02;
      pivot.add(sw);
      pivot.rotation.z = -0.35;                          // off
      this.add(pivot);
      this._switches.push(pivot);
      const mat = new THREE.MeshStandardMaterial({ map: this._plateTexture(''), roughness: 0.8 });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.035), mat);
      plate.position.set(FUSE.x - 0.061, FUSE.y - 0.12, z);
      plate.rotation.y = -Math.PI / 2;
      this.add(plate);
      this._plates.push(plate); this._plateMats.push(mat);
    }
    // the morning: her labels, three of five, on a plane over the plates (bound 'morning')
    const herMat = new THREE.MeshStandardMaterial({ map: this._plateTexture('porch    sitting room    —    your room    —', 1024), roughness: 0.8, transparent: true, opacity: 0.95 });
    this._herPlates = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.04), herMat);
    this._herPlates.position.set(FUSE.x - 0.062, FUSE.y - 0.12, FUSE.z);
    this._herPlates.rotation.y = -Math.PI / 2;
    this.add(this._herPlates);
    this.hours.bind('morning', { objects: [this._herPlates], interact: [this._herPlates] });
    // the pilot lamp
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 2 }));
    pilot.position.set(FUSE.x - 0.065, FUSE.y + 0.3, FUSE.z);
    this.add(pilot);
  }

  _plateTexture(text, width = 256) {
    return textTexture({ text, font: 'italic 28px Georgia', color: '#3a332c', bg: '#cfc6b3', width, height: 96 });
  }

  _buildClock() {
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 8, 32), caseMat);
    ring.position.set(CLOCK_POS.x, CLOCK_POS.y, CLOCK_POS.z);
    this.add(ring);
    this._clockFace = makeClockFace({ radius: 0.16 });
    this._clockFace.position.set(CLOCK_POS.x, CLOCK_POS.y, CLOCK_POS.z + 0.004);   // faces +Z, into the kitchen
    this._clockFace.setTime(3, 7, 0);
    this.add(this._clockFace);
    this.track(this._clockFace);
    this.interact(ring, { prompt: 'the clock', distance: 3.4, onInteract: () => this._wind() });
    this._clockRing = ring;
  }

  _wirePuzzle() {
    // filled in in Step 3
  }

  async debugSolve() {
    this.game.player.teleport(-1.5, -3.6);
    await this.debugWait(0.6);
  }
}
```

Build the shell and furniture per the comments (positions and materials
are all in spec §5.1). For `_bindLook`, `_wind`, `_wrongHourPlacing`,
`_morningBox` and `_waitFor`, paste the versions from "Room tasks — how to
work them" into the class. Also add the window-pane bindings: the night
pane (`MeshStandardMaterial({ color: 0x05060a, metalness: 0.9, roughness: 0.15 })`)
bound to `'night'` and `'evening'`, the morning pane (emissive white,
`emissiveIntensity 1.6`) bound to `'morning'`.

- [ ] **Step 2: Build, screenshot at all three hours, iterate**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 16 --port 5116 && node tools/screenshot.mjs 16 --port 5116 --hour morning && node tools/screenshot.mjs 16 --port 5116 --hour evening`
Expected: exit 0 three times. LOOK at `shots/level16-*.png` — a dark blue kitchen with a faint clock; a white one with boxes; an amber one with the pan steaming. Fix what is wrong before going on.

- [ ] **Step 3: Wire the puzzle**

Replace `_wirePuzzle()` with:

```js
  _wirePuzzle() {
    const hallPos = new THREE.Vector3(HALL_DOOR.x, HALL_DOOR.y, HALL_DOOR.z);

    // ---- hours: what happens when an hour begins ----
    this.hours.bind('evening', { onEnter: () => this._enterEvening() });
    this.hours.bind('night', { onEnter: () => this._enterNight() });
    this.hours.bind('morning', { onEnter: () => { this._hallDoor.setAngle(Math.PI / 2); this.removeBlocker(this._hallBlocker); } });
    this.hours.bind('morning', { onLeave: () => { if (!this._exitOpen) { this._hallDoor.setAngle(0); this._hallBlocker = this.addBlocker([-2.0, 0, -2.4], [-1.0, 2.2, -2.2]); } } });
    this.hours.onChange = (hour) => {
      if (hour === 'morning' && !this._firstMorning) { this._firstMorning = true; this.setObjective('the house, at another hour'); }
    };

    // ---- the list, the cup, the calendar, the drawing, the boxes ----
    this.interact(this._list, {
      prompt: 'her list', once: true,
      onInteract: () => {
        this._listRead = true;
        this.giveNote({
          id: 'l16-list', title: 'her list, on the kitchen table',
          body:
            'before bed —\n\n' +
            'the pan stays on. supper was real,\n' +
            'and there should be something to show for it.\n' +
            'the little key on the table, where small hands can find it.\n' +
            'write the fuses up. I always forget which is which,\n' +
            'and the dark is no time to learn.\n' +
            'then slippers. then the wireless. then up, and yours last.\n\n' +
            '— M.',
        });
        this.setObjective('before bed — her list');
      },
    });
    this.interact(this._cup, {
      prompt: 'the cup on the dresser',
      onInteract: () => {
        if (this.hours.is('evening') && this._cupKey.visible) {
          this._cupKey.visible = false;
          this.giveItem({ id: 'little-key', name: 'the little key' });
          this.subtitle('A cup with no handle. In it, the little key for the door at the top of the stairs. She keeps it here. You take it.', 6);
        } else if (this.hours.is('morning')) {
          this.subtitle('The dresser is bare. The cup went in a box, or a bin.', 4);
        } else {
          this.subtitle('A cup with no handle. Empty.', 4);
        }
      },
    });
    this.interact(this._calendar, {
      prompt: 'the calendar',
      onInteract: () => this.subtitle(this.hours.is('morning')
        ? 'Sunday, ringed. sunflowers, in her hand. Every day after it is crossed off.'
        : 'Sunday, ringed. sunflowers.', 5),
    });
    this.interact(this._drawing, {
      prompt: 'the drawing on the fridge',
      onInteract: () => this.subtitle('A sunflower, in crayon. Someone drew it so that someone would know.', 5),
    });
    this.interact(this._herPlates, {
      prompt: 'the fuse box', once: true,
      onInteract: () => this.learnClue({
        id: 'l16-plates', title: 'the fuse box, in the morning',
        body: 'in her hand, left to right: porch · sitting room · (fallen) · your room · (fallen).',
      }),
    });
    // boxes (built in _buildFurniture with _morningBox; their onOpen:)
    //   misc → learnClue { id: 'l16-fallen', title: 'two plates from the fuse box', body: 'kitchen. hall. unscrewed and put in a box; which went where, nobody wrote down.' }
    //   keep → subtitle 'Plates. The good ones.'   van → subtitle 'Tea towels. The calendar, folded, with its Sunday still ringed.'

    // ---- the pan ----
    this.interact(this._panSink, {
      prompt: 'the pan, in the sink',
      onInteract: () => {
        this._panSink.visible = false;
        this.game.interaction.setEnabled(this._panSink, false);
        this.giveItem({ id: 'pan', name: 'the supper pan, cold' });
      },
    });
    this.interact(this._range, {
      prompt: 'the range',
      onInteract: () => {
        if (!this.hours.is('night')) { this.subtitle(this.hours.is('evening') ? 'Supper. Still warm. She has just turned it down.' : 'Gone. A paler rectangle on the wall where it stood.', 4); return; }
        if (this.hasItem('pan')) {
          this.removeItem('pan');
          this._panRange.visible = true;
          this._panOnRange = true;
          this.playSound('pickup');
          this.subtitle('You put it back. Supper was real.', 4);
        } else {
          this.subtitle(this._panOnRange ? 'The pan, back where it was.' : 'Cold. She washed up. She always washed up.', 4);
        }
      },
    });

    // ---- the table: the little key ----
    this.interact(this._table, {
      prompt: 'the table',
      onInteract: () => {
        if (!this.hasItem('little-key')) { this.subtitle(this.hours.is('evening') ? 'Her list is on it.' : 'The table. Bare.', 3); return; }
        if (!this.hours.is('night')) { this._wrongHourPlacing(); return; }
        this.removeItem('little-key');
        this._keyOnTable.visible = true;
        this._keyPlaced = true;
        this.playSound('pickup');
        this.subtitle('You put it down where small hands can find it. It will be warm for a while.', 5);
        this.whenUnseen(this._chairSouthN, () => {
          this._chairSouthN.position.z += 0.3;
          this.playSoundAt('door', { x: 0, y: 0.5, z: 1.0 }, { });
          this.whenSeen(this._chairSouthN, () => this.subtitle('The chair is out again. Somebody sat down to supper.', 5));
        });
      },
    });

    // ---- the fuse box ----
    this._switches.forEach((pivot, i) => this.interact(pivot, { prompt: 'the switch', onInteract: () => this._flip(i) }));
    this._plates.forEach((plate, i) => this.interact(plate, { prompt: 'the plate', onInteract: () => this._cyclePlate(i) }));

    // ---- the hall door ----
    this.interact(this._hallDoor, { prompt: 'the door to the hall', onInteract: () => this._tryHallDoor() });
    this.tick(() => {
      if (this._exitOpen && !this.isCompleted && this.game.player.position.z < -3.2) this.complete();
    });

    // ---- the child overhead (night) ----
    this.tick((dt) => {
      if (!this.hours.is('night')) { this._overheadT = 0; return; }
      this._overheadT = (this._overheadT ?? 20) + dt;
      if (this._overheadT > 45) {
        this._overheadT = 0;
        this.footsteps([{ x: 1, y: 3.4, z: -1 }, { x: 0.5, y: 3.4, z: 1.5 }], { stride: 0.6, every: 0.5, opts: { soft: true } });
        if (!this._overheadCued) { this._overheadCued = true; this.cue('something small, turning over, upstairs', new THREE.Vector3(0.8, 3.4, 0.2)); }
      }
    });
  }

  _enterEvening() {
    this._visitedEvening = true;
    if (this._eveningOnce) return;
    this._eveningOnce = true;
    const tap = this.loopAt('tap', this._tapPos);
    this.after(12, () => {
      tap.stop(0.8);
      this.after(5, () => {
        if (!this.hours.is('evening')) return;
        this.playSoundAt('hummed', { x: -1.5, y: 1.5, z: -2.8 }, { notes: HUM });
        this.cue('humming, beyond the door', new THREE.Vector3(-1.5, 1.5, -2.8));
        for (let i = 0; i < 3; i++) this.after(2.4 + i * 0.9, () => this.playSoundAt('stepOther', { x: -1.5, y: 0, z: -3.2 - i * 0.8 }, { soft: true }));
      });
    });
  }

  _enterNight() {
    if (this._visitedEvening && !this._tapPlayedAtNight) {
      this._tapPlayedAtNight = true;
      const tap = this.loopAt('tap', this._tapPos);
      this.cue('the tap', new THREE.Vector3(this._tapPos.x, this._tapPos.y, this._tapPos.z));
      this.after(10, () => tap.stop(1.0));
    }
  }

  _flip(i) {
    this.playSound('switch');
    const k = SWITCH_ORDER[i];
    if (!this.hours.is('night')) {
      this._switches[i].rotation.z = -this._switches[i].rotation.z;
      this.after(0.5, () => { this._switches[i].rotation.z = -0.35; });
      this.subtitle('She\'d only put it back. Leave them for the night.', 4);
      return;
    }
    const on = !this._on[k];
    this._on[k] = on;
    this._switches[i].rotation.z = on ? 0.35 : -0.35;
    const ordinal = ['first', 'second', 'third', 'fourth', 'fifth'][i];
    const note = (what) => this.learnClue({ id: 'l16-sw-' + i, title: `the ${ordinal} switch`, body: what });
    if (k === 'porch') {
      this.playSound('locked');
      if (!this._porchSaid) { this._porchSaid = true; this.subtitle('Dead. It always was.', 4); }
      note('a dead click. the porch.');
    } else if (k === 'kitchen') {
      this._bulb.light.intensity = on ? 4.5 : 0;
      if (on) { this.subtitle('The kitchen light. This one is the kitchen.', 4); note('lights the kitchen.'); }
    } else if (k === 'hall') {
      this._strip.material.emissiveIntensity = on ? 1.4 : 0;
      this._hallLight.intensity = on ? 1.5 : 0;
      if (on) { this.subtitle('A line of light under the hall door.', 4); note('a line of light under the hall door.'); }
    } else if (k === 'sitting') {
      this._hatchGlow.material.emissiveIntensity = on ? 1.2 : 0;
      if (on) {
        this._hatchRadio = this.loopAt('radio', { x: 0.3, y: 1.2, z: -2.4 }); this._hatchRadio.setGain(0.4);
        this.subtitle('Light at the edges of the hatch, and the wireless, faint.', 4);
        this.cue('the wireless, through the hatch', new THREE.Vector3(0.3, 1.2, -2.4));
        note('light at the hatch; the wireless. the sitting room.');
      } else { this._hatchRadio?.stop(0.5); this._hatchRadio = null; }
    } else if (k === 'yours') {
      if (on) {
        const wind = () => {
          this.playSoundAt('musicbox', OVERHEAD_MUSIC, { notes: TUNE, step: 0.36, slow: 0.05, holdSeconds: 6 });
          this._timers.yours = this.after(6, wind);
        };
        wind();
        this._crackGlow.visible = true;
        this.subtitle('A music box, upstairs. Winding down.', 4);
        this.cue('a music box, upstairs', new THREE.Vector3(OVERHEAD_MUSIC.x, OVERHEAD_MUSIC.y, OVERHEAD_MUSIC.z));
        note('a music box, upstairs. your room.');
      } else { clearTimeout(this._timers.yours); this._crackGlow.visible = false; }
    }
  }

  _cyclePlate(i) {
    if (!this.hours.is('night')) { this.subtitle('Blank. She keeps meaning to.', 3); return; }
    this.playSound('paper');
    this._plate[i] = (this._plate[i] + 1) % LABELS.length;
    this._plateMats[i].map?.dispose();
    this._plateMats[i].map = this._plateTexture(LABELS[this._plate[i]]);
    this._plateMats[i].needsUpdate = true;
  }

  _labelsRight() {
    return SWITCH_ORDER.every((k, i) => LABELS[this._plate[i]] === LABEL_OF[k]);
  }

  _tryHallDoor() {
    if (this._exitOpen) return;
    if (this.hours.is('evening')) { this.playSound('locked'); this.subtitle('Not yet. She is still up.', 4); return; }
    if (this.hours.is('morning')) { this.subtitle('White. The house is gone from here on.', 5); return; }
    let miss = null;
    if (!this._panOnRange) miss = 'Supper was real. Put it back where it can be seen.';
    else if (!this._keyPlaced) miss = 'The little key. On the table, where it can be found.';
    else if (!this._labelsRight()) miss = this._plate.every((p) => p === 0) ? 'The fuses. Write them up.' : 'The fuses. One of them is lying.';
    if (miss) {
      this.playSound('locked');
      this.subtitle(miss, 5);
      this._wrongCount++;
      if (this._wrongCount >= 3) {
        this.after(4, () => this.subtitle(this._listRead
          ? 'Porch. The wireless. Here. The small one\'s. The hall. Test them.'
          : 'Her list is on the table, at half past eight.', 6));
      }
      return;
    }
    this._exitOpen = true;
    this._clockLocked = true;
    this.playSound('unlock');
    this._hallDoor.setOpen(true, -1);
    this.removeBlocker(this._hallBlocker);
    this.playSound('door');
    this.playSoundAt('reverse', { x: -1.5, y: 1.3, z: -3.5 }, { dur: 1.4 });
    this.dread(0.2);
    this._strip.material.emissiveIntensity = 0;
    this.subtitle('It opens onto the hall, and the hall is longer than the house.', 6);
    this.setObjective('slippers');
  }
```

Also in `_buildFurniture` add `this._crackGlow` (an emissive plane
0.4 × 0.02 at (1, 2.59, 0.5), `0xffd9a8`, visible false) and make the
clock's `_wind()` say `'The clock has done what it was for.'` when
`this._clockLocked` (add that line at the top of the pasted `_wind`:
`if (this._clockLocked) { this.subtitle('The clock has done what it was for.', 3); return; }`).

- [ ] **Step 4: The real `debugSolve()`**

```js
  async debugSolve() {
    const pl = this.game.player;
    this.debugInteract(this._clockRing); await this.debugWait(1.9);          // → morning
    this.debugInteract(this._clockRing); await this.debugWait(1.9);          // → evening
    this.debugInteract(this._list); await this.debugWait(0.3); this.game.ui.closeModal();
    this.debugInteract(this._cup); await this.debugWait(0.3);                // the little key
    this.debugInteract(this._clockRing); await this.debugWait(1.9);          // → night
    this.debugInteract(this._panSink); await this.debugWait(0.3);
    this.debugInteract(this._range); await this.debugWait(0.3);
    this.debugInteract(this._table); await this.debugWait(0.3);
    const turns = [5, 3, 1, 4, 2];                                            // porch, sitting room, kitchen, your room, hall
    for (let i = 0; i < 5; i++) for (let k = 0; k < turns[i]; k++) { this.debugInteract(this._plates[i]); await this.debugWait(0.05); }
    this.debugInteract(this._hallDoor); await this.debugWait(0.8);
    pl.teleport(-1.5, -3.6); await this.debugWait(0.6);
  }
```

- [ ] **Step 5: Verify**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 16 --port 5116 && node tools/playtest.mjs 16 --port 5216`
Expected: exit 0; `level 16: SOLVED in …s`; no browser errors.

- [ ] **Step 6: Commit**

```bash
git add src/levels/Level16.js
git commit -m "Add room XVI (The Kitchen) — the hours, her list, the pan, the little key, the fuses written up"
```

---

### Task 8: Room XVII — The Hall

**Files:**
- Create: `src/levels/Level17.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`Hours` with `objects`/`colliders` swapping two halls, `footsteps`, `hummed {small}`, `smallStep`, `phone`, `handle`, `idle`).
- Produces: `Level17`.

Spec: §5.2 — read all of it first (two halls in one place; the rehearsal).

- [ ] **Step 1: Scaffold — two halls, the clock, the threshold**

Create `src/levels/Level17.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeTable, makePictureFrame,
  makeDust, makeClockFace, applyFog,
} from '../core/props.js';
import { Hours } from '../core/hours.js';

// XVII — The Hall
// At the evening and the morning it is the house's hall; at 3:07 it is the
// corridor of I, thirty metres of doors. Leave the spare key where the
// flowers used to be, the note on the table, her slippers on the mat, then
// listen at the door at the end while the child's dream comes down and
// tries it.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.2

const HOUSE = { x0: -1.5, x1: 1.5, z0: -5.4, z1: 5.4, h: 2.7 };
const DREAM = { x0: -1.35, x1: 1.35, z0: -30.6, z1: 5.4, h: 3.0 };
const CLOCK_POS = { x: -1.32, y: 1.9, z: 3.2 };
const MAT = { x: 1.0, y: 0.006, z: -1.0 };
const TABLE = { x: -1.0, y: 0.78, z: -3.8 };
const PEDESTAL = { x: 1.0, y: 0.98, z: -17.7 };
const END_Z = -30.6;
const HUM2 = LevelBase.tune('EGAG');
const NOTE_I =
  'We moved the spare key when you stopped visiting.\n\n' +
  'It’s where the flowers used to be.\n' +
  'You watered them every Sunday. Remember?\n\n' +
  '— M.';
const FLAVOUR = [
  'Locked. Behind it, water is running into a tub that never fills.',
  'Locked. You can hear a television playing a show you almost remember.',
  'Locked. Someone inside is humming the song your mother hummed.',
];
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level17 extends LevelBase {
  static meta = {
    id: 17,
    numeral: 'XVII',
    title: 'The Hall',
    mood: 'night',
    grade: GRADE,
    intro: 'The hall. At night it is the corridor of the building you grew up in, and it is longer than the house.',
    outro:
      'You put the key where the flowers used to be,\n' +
      'and the note on the table, and her slippers on the mat,\n' +
      'and something small came down, and found them, and went on ahead.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    this._wound = false;
    this._placed = { note: null, key: null, slippers: false };   // where the note/key are: null | 'table' | 'pedestal'
    this._rehearsing = false;
    this._rehearsals = 0;
    this._exitOpen = false;
    this._failKey = 0;

    this._buildHouseHall();
    this._buildDreamHall();
    this._buildShared();
    this._buildClock();
    this._bindLook({ x: 0, y: 1.4, z: -5.3 }, { x: 2, y: 6, z: -12 });
    this._wirePuzzle();

    this.spawn.position.set(0, 0, 4.6);
    this.spawn.yaw = 0;
    this.bounds = new THREE.Box3(new THREE.Vector3(-1.6, 0, -33), new THREE.Vector3(1.6, 3.5, 5.2));
    this.setObjective('slippers, she said. then the wireless.');

    this.hours.start();
    this.track(this.hours);
  }

  // (paste _box, _plane, _bindLook, _wind, _wrongHourPlacing, _morningBox, _waitFor)

  _buildHouseHall() {
    // Evening + morning geometry, every mesh bound through objects (and colliders where it blocks):
    //   walls x ±1.5 (wallpaper '#b7a48e'/'#a8927a'), ceiling at 2.7, the north wall (z −5.4) with the front door opening at x 0, the south wall (z +5.4) with the kitchen door;
    //   floor: the house hall's carpet runner (bound), over a full-length base floor built in _buildShared
    //   this._frontDoor   makeDoor({ color: '#4f3d2e' }) at (0, 0, −5.4) — no panel collider: a doorway blocker this._frontBlocker = this.addBlocker([-0.55, 0, -5.5], [0.55, 2.2, -5.3]) (removed while it stands open) — evening: opens onto the porch (a stub z −5.4..−7.0, asphalt beyond, a lamp post at (3, 0, −10) whose light flickers 5 %,
    //                     this._mailbox at (−1.2, 0, −6.8), a gate blocker at z −7.0); morning: stands open (setAngle) onto a white plane at z −6.2 behind a blocker; bound objects: the porch pieces to 'evening', the white plane to 'morning'
    //   this._porchSwitch a small box at (0.7, 1.3, −5.3) (evening + morning)
    //   this._sittingDoor makeDoor at (−1.5, 0, −3.0) rotated to face +X (evening + morning; never opens)
    //   this._stairs      treads x 0.6..1.5 from z −1.0 (y 0) to z +2.6 (y 1.8), a banister; bound to evening + morning (objects + colliders); this._stairBlockerPlane an invisible-ish plane at the foot for the line
    //   this._cupboardDoor makeDoor at (1.5, 0, 3.8) facing −X (evening + morning)
    //   this._phone       a black box + handset on the table (evening + morning)
    //   this._stand       the hall stand box at (−1.3, 0, 1.0) (evening); this._sunflowers (five stems, yellow heads) on it (evening); this._standMark a pale square on the floor at the same spot (morning)
    //   this._hooks       three small cylinders on the west wall at z 4.2, y 1.6 (evening + morning); this._coat a box 0.34 × 0.95 × 0.14 '#5a4a3d' hanging from the middle hook (evening)
    //   this._boxVan, this._boxKeep, this._boxMisc  _morningBox('HALL — van' | 'HALL — keep' | 'HALL — misc') at (0.8, −4.6), (−0.7, −4.6), (0.8, −3.9) (morning)
    //   this._tableSheet  a box 0.9 × 0.05 × 0.5 '#cfc8bb' over the table at y 0.8 (morning)
    //   lights: this._bulbE1 makeBulbLight({ color: 0xffd2a0, intensity: 0, distance: 9, y: 2.45 }) at (0, 0, 0), this._bulbE2 (3.5) at (0, 0, −4) — bound evening 4.5 / 3.5
    //   pale rectangles on the wallpaper where the photographs hung (morning)
    // Bind: this.hours.bind('evening', { objects, colliders, interact, lights, loops: [{ kind: 'radio', position: { x: -2.0, y: 1.2, z: -3.0 }, opts: {} }] })
    //       this.hours.bind('morning', { objects, colliders, interact, loops: [{ kind: 'idle', position: { x: 4, y: 0.5, z: -9 } }] })
  }

  _buildDreamHall() {
    // Night geometry — I's corridor rebuilt (Level01 is the reference; copy its materials), bound to 'night' through objects + colliders:
    //   walls x ±1.35 from z +5.4 to −30.6, ceiling at 3.0, skirting, the end wall at z −30.6 with the lintel and the end door opening,
    //   six bulbs at z = 2.3 − 6i (0xffe2bc, intensity 5; i = 4 stutters via a ticker that only runs while this.hours.is('night')),
    //   dust makeDust({ count: 220, box: [2.4, 2.6, 36], center: [0, 1.5, -12.6] }) (tracked; bound),
    //   ten doors at z = −0.7 − 7i, i = 0..4, even i on the east wall (x +1.33, rotation.y −π/2) with plates 203 + 2i, odd on the west (x −1.33, rotation.y +π/2) with plates 204 + 2i — registered interactables: this._dreamDoors[j], each with door.userData.plate = its number;
    //   four photographs (blurredPhotoTexture) between doors as in Level01,
    //   this._pedestal  plaster box 0.34 × 0.98 × 0.34 at (1.0, 0.49, −17.7) + the vase with five dry stems (night),
    //   this._endDoor   makeDoor({ width: 1.0, color: '#4f3d2e', frameColor: '#3c2f24' }) at (0, 0, −30.6) (tracked; panel collider bound to night); beyond it a dark landing 4 × 4 (ground) with a blocker at z −34 (night)
    // Bind: this.hours.bind('night', { objects, colliders, interact, lights: [...six bulbs at 5, the stutterer handled by its ticker], loops: [{ kind: 'radio', position: { x: 0, y: 1.2, z: -31.5 }, opts: {} }] })
  }

  _buildShared() {
    // Always there: a base floor plane x −1.5..1.5, z −34..5.4 (ground) with the carpet; the kitchen door (makeDoor at (0, 0, 5.4), shut — interact line);
    //   this._table  makeTable({ w: 0.8, d: 0.42, h: 0.78 }) at (−1.0, 0, −3.8) (collider);
    //   this._notePlaced  makeNoteProp at (−1.0, 0.795, −3.8), visible false;  this._keyOnTable makeKeyProp at (−0.8, 0.8, −3.7), visible false;
    //   this._keyOnPedestal makeKeyProp at (0.97, 1.0, −17.5), visible false;   this._noteOnPedestal makeNoteProp at (1.0, 1.0, −17.9), visible false (bound 'night' objects so they hide at other hours);
    //   this._mat  a plane 0.6 × 0.4 '#6b5a4a' at (1.0, 0.006, −1.0);  this._slippersMesh two boxes 0.1 × 0.05 × 0.25 '#6b4a3a' on the mat, visible false (bound 'night');
    //   this._kitchenDoor.
  }

  _buildClock() {
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.6 });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 24), caseMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(CLOCK_POS.x - 0.02, CLOCK_POS.y, CLOCK_POS.z);
    this.add(drum);
    this._clockFace = makeClockFace({ radius: 0.16 });
    this._clockFace.position.set(CLOCK_POS.x + 0.025, CLOCK_POS.y, CLOCK_POS.z);
    this._clockFace.rotation.y = Math.PI / 2;                 // faces +X, into the hall
    this._clockFace.setTime(3, 7, 0);
    this.add(this._clockFace);
    this.track(this._clockFace);
    this.interact(drum, { prompt: 'the clock', distance: 3.4, onInteract: () => this._wind() });
    this._clockDrum = drum;
  }

  _wirePuzzle() { /* Step 3 */ }

  async debugSolve() {
    this.game.player.teleport(0, -32);
    await this.debugWait(0.6);
  }
}
```

- [ ] **Step 2: Build, screenshot at all three hours, iterate**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 17 --port 5117 && node tools/screenshot.mjs 17 --port 5117 --hour morning && node tools/screenshot.mjs 17 --port 5117 --hour evening`
Expected: exit 0; the spawn shot at night shows the corridor running away into the fog with its doors; the evening an eight-metre hall with the front door ahead and sunflowers on the left; the morning white with boxes. Iterate.

- [ ] **Step 3: Wire the puzzle**

```js
  _wirePuzzle() {
    // ---- doors and flavour ----
    this.interact(this._kitchenDoor, { prompt: 'the kitchen door', onInteract: () => { this.playSound('locked'); this.subtitle('It shut behind you. They always do.', 4); } });
    this.interact(this._sittingDoor, { prompt: 'the sitting room', onInteract: () => {
      this.playSound('locked');
      this.subtitle(this.hours.is('evening') ? 'Not yet. She is still up.' : 'White. The house is gone from here on.', 4);
    } });
    this.interact(this._frontDoor, { prompt: 'the front door', onInteract: () => {
      if (this.hours.is('evening')) { if (!this._frontOpen) { this._frontOpen = true; this._frontDoor.setOpen(true, -1); this.removeBlocker(this._frontBlocker); this.playSound('door'); } }
      else this.subtitle('White. The house is gone from here on.', 4);
    } });
    this.hours.bind('evening', { onLeave: () => { if (this._frontOpen) { this._frontOpen = false; this._frontDoor.setOpen(false); this._frontBlocker = this.addBlocker([-0.55, 0, -5.5], [0.55, 2.2, -5.3]); } } });
    this.hours.bind('morning', { onEnter: () => { this._frontDoor.setAngle(Math.PI / 2); this.removeBlocker(this._frontBlocker); } });
    this.hours.bind('morning', { onLeave: () => { this._frontDoor.setAngle(0); this._frontBlocker = this.addBlocker([-0.55, 0, -5.5], [0.55, 2.2, -5.3]); } });
    this.interact(this._porchSwitch, { prompt: 'the porch light', onInteract: () => {
      this.playSound('switch'); this.playSound('locked');
      this.subtitle(this._porchSaid ? 'Dead.' : 'Dead. It always was. She said it was the bulb. It was never the bulb.', this._porchSaid ? 3 : 6);
      this._porchSaid = true;
    } });
    this.interact(this._mailbox, { prompt: 'the mailbox', onInteract: () => this.subtitle('Empty. Nothing has been delivered yet.', 4) });
    this.interact(this._stairBlockerPlane, { prompt: 'the stairs', onInteract: () => this.subtitle(this.hours.is('evening') ? 'Not yet. The wireless first. Then up.' : 'The banister is wrapped. The carpet is rolled.', 4) });
    this.interact(this._cupboardDoor, { prompt: 'the cupboard', onInteract: () => { this.playSound('locked'); this.subtitle('Locked. Coats and a hoover and the smell of the dark.', 4); } });
    this.interact(this._phone, { prompt: 'the telephone', onInteract: () => this.subtitle('The dialling tone. Nobody to ring, at this hour.', 4) });
    let fl = 0;
    this._dreamDoors.forEach((door, j) => this.interact(door, { prompt: 'try the door', onInteract: () => {
      this.playSound('locked');
      if (door.userData.plate === 207) { this.subtitle('Locked. Behind it, somebody small is breathing, slowly, asleep.', 5); return; }
      this.subtitle(fl < FLAVOUR.length ? FLAVOUR[fl++] : 'Locked.', 5);
    } }));
    // the evening: her
    this.hours.bind('evening', { onEnter: () => {
      if (this._eveningOnce) return;
      this._eveningOnce = true;
      this.after(15, () => { if (!this.hours.is('evening')) return; this.playSoundAt('handle', { x: -1.5, y: 1.0, z: -3.0 }); this.subtitle('She thought of something, and didn\'t.', 4); });
    } });
    this.hours.bind('evening', { onEnter: () => {
      let n = 0;
      const step = () => { if (!this.hours.is('evening') || n++ >= 9) return; this.playSoundAt('stepOther', { x: -2.2, y: 0, z: -3.0 }, { soft: true }); this.after(0.9, step); };
      step();
    } });

    // ---- her coat, the boxes ----
    this.interact(this._coat, { prompt: 'her coat, on the hook', once: true, onInteract: () => {
      this.subtitle('Warm, still. In the pocket: the spare key, and a note, folded small, in her hand.', 6);
      this.giveItem({ id: 'spare-key', name: 'the spare key, warm' });
      this.giveItem({ id: 'note-i', name: 'a note, folded small' });
      this.giveNote({ id: 'l17-note', title: 'the note from her coat pocket', body: NOTE_I });
      this.setObjective('leave them where it will look');
    } });
    // _morningBox onOpen handlers (set in _buildHouseHall):
    //   van  → once: giveItem { id: 'slippers', name: 'her slippers' }; subtitle 'Her slippers, flattened at the heel. You take them.' (4 s); objective 'leave them where it will look'
    //   keep → subtitle 'The telephone, its cord wound round it. Four photographs, face down.' (4 s)
    //   misc → subtitle 'A bulb for the porch light, still in its sleeve. It was never the bulb.' (5 s)

    // ---- placing and taking back ----
    const place = (where) => {
      if (!this.hours.is('night')) { if (this.hasItem('note-i') || this.hasItem('spare-key')) this._wrongHourPlacing(); else this.subtitle(where === 'table' ? 'The telephone table.' : 'The stand.', 3); return; }
      const slots = where === 'table'
        ? { note: this._notePlaced, key: this._keyOnTable }
        : { note: this._noteOnPedestal, key: this._keyOnPedestal };
      if (this.hasItem('note-i') && this._placed.note === null) { this.removeItem('note-i'); slots.note.visible = true; this._placed.note = where; this.playSound('paper'); return; }
      if (this.hasItem('spare-key') && this._placed.key === null) { this.removeItem('spare-key'); slots.key.visible = true; this._placed.key = where; this.playSound('pickup'); return; }
      // take back
      if (this._placed.note === where) { slots.note.visible = false; this._placed.note = null; this.giveItem({ id: 'note-i', name: 'a note, folded small' }); return; }
      if (this._placed.key === where) { slots.key.visible = false; this._placed.key = null; this.giveItem({ id: 'spare-key', name: 'the spare key, warm' }); return; }
      this.subtitle(where === 'table' ? 'The table by the door. Nothing on it.' : 'Where the flowers used to be. Five dry stems.', 4);
    };
    this.interact(this._table, { prompt: 'the table', onInteract: () => place('table') });
    this.interact(this._pedestal, { prompt: 'where the flowers used to be', onInteract: () => place('pedestal') });
    this.interact(this._mat, { prompt: 'the mat', onInteract: () => {
      if (this.hours.is('evening')) { this.subtitle('The mat. Her slippers are not on it; she is wearing them.', 4); return; }
      if (this.hours.is('morning')) { this.subtitle('The mat. Dust, in the shape of two feet.', 4); return; }
      if (this.hasItem('slippers')) { this.removeItem('slippers'); this._slippersMesh.visible = true; this._placed.slippers = true; this.playSound('paper'); return; }
      if (this._placed.slippers) { this._slippersMesh.visible = false; this._placed.slippers = false; this.giveItem({ id: 'slippers', name: 'her slippers' }); return; }
      this.subtitle('The mat at the stair foot. Bare.', 3);
    } });

    // ---- the door at the end: the rehearsal ----
    this.interact(this._endDoor, { prompt: 'the door at the end. listen.', onInteract: () => {
      if (this._exitOpen || this._rehearsing) return;
      this._rehearsing = true;
      this.hush(1.5);
      this.setObjective('listen');
      this.after(1.5, () => this._rehearse());
    } });
    this.tick(() => {
      if (this._exitOpen && !this.isCompleted && this.game.player.position.z < END_Z - 1.2) this.complete();
    });
  }

  /** The child's dream walks the hall: mat → table → pedestal → the door; it stops at the first thing that is wrong. */
  _rehearse() {
    const soft = this._placed.slippers;
    const opts = { soft };
    const w = { x: MAT.x, z: MAT.z };                                            // the walker's last position
    const hum = (pos) => { this.playSoundAt('hummed', { x: pos.x, y: 0.9, z: pos.z }, { notes: LevelBase.tune('EG'), small: true }); this.cue('a small hum', new THREE.Vector3(pos.x, 0.9, pos.z)); };
    const back = (pos, n) => {                                                  // n steps back toward the mat, then nothing
      const dir = { x: MAT.x - pos.x, z: MAT.z - pos.z };
      const len = Math.hypot(dir.x, dir.z) || 1;
      const d = Math.min(len, n * 0.55);
      this.footsteps([{ x: pos.x, y: 0, z: pos.z }, { x: pos.x + dir.x / len * d, y: 0, z: pos.z + dir.z / len * d }], { stride: 0.55, every: 0.26, opts });
    };
    const fail = (line, secs) => { this._rehearsing = false; this._rehearsals++; this.subtitle(line, secs); this.setObjective('leave them where it will look');
      if (this._rehearsals >= 3) this.after(secs, () => this.subtitle('It comes down in her slippers, reads the note by the door, and looks where the flowers used to be. That is the whole of it.', 8)); };
    let cued = false;
    const walk = (to, onDone) => this.footsteps([{ x: w.x, y: 0, z: w.z }, { x: to.x, y: 0, z: to.z }], {
      stride: 0.55, every: 0.26, opts,
      onStep: (i, pos) => { w.x = pos.x; w.z = pos.z; if (!cued) { cued = true; this.cue('small footsteps', pos); } },
      onDone,
    });

    // leg 1 — bare feet stop after four steps
    if (!soft) {
      const cancel = walk({ x: -0.6, z: -3.4 }, () => {});
      this.after(0.26 * 4 + 0.05, () => {
        cancel();
        hum(w);
        this.after(0.8, () => back(w, 4));
        fail('Bare feet on the hall floor. It goes back up for its slippers, and there aren\'t any.', 6);
      });
      return;
    }
    walk({ x: -0.6, z: -3.4 }, () => {
      if (this._placed.note !== 'table') {
        this.after(1.5, () => { hum(w); this.after(0.8, () => back(w, 4)); fail('It came down, and there was nothing to read, and it went back up.', 6); });
        return;
      }
      this.playSoundAt('paper', { x: TABLE.x, y: TABLE.y, z: TABLE.z });
      this.after(1.5, () => walk({ x: 0.7, z: -17.3 }, () => {
        if (this._placed.key !== 'pedestal') {
          this.after(1.5, () => {
            hum(w); this.after(0.8, () => back(w, 6));
            this._failKey++;
            fail(this._failKey === 1
              ? 'It read the note. It looked where the note said, and found nothing, and went back.'
              : 'It looks where the flowers used to be. Nowhere else.', this._failKey === 1 ? 6 : 5);
          });
          return;
        }
        this.playSoundAt('pickup', { x: PEDESTAL.x, y: PEDESTAL.y, z: PEDESTAL.z });
        this.after(1.0, () => walk({ x: 0, z: -30.0 }, () => {
          this._rehearsing = false;
          this._exitOpen = true;
          this._clockLocked = true;
          this.playSoundAt('unlock', { x: 0, y: 1.0, z: END_Z });
          this._endDoor.setOpen(true, -1);
          this.removeColliderOf(this._endDoor.panel);
          this.playSound('door');
          this.subtitle('It found everything. It goes on ahead of you, and the door stays open.', 6);
          this.setObjective('the wireless');
          this.after(3, () => { this.playSoundAt('phone', { x: TABLE.x, y: TABLE.y, z: TABLE.z }, { rings: 2, holdSeconds: 8 }); this.cue('a telephone, ringing', new THREE.Vector3(TABLE.x, TABLE.y, TABLE.z)); });
        }));
      }));
    });
  }
```

- [ ] **Step 4: The real `debugSolve()`**

```js
  async debugSolve() {
    const pl = this.game.player;
    this.debugInteract(this._clockDrum); await this.debugWait(1.9);          // → morning
    this.debugInteract(this._boxVan); await this.debugWait(0.3);              // slippers
    this.debugInteract(this._clockDrum); await this.debugWait(1.9);          // → evening
    this.debugInteract(this._coat); await this.debugWait(0.3); this.game.ui.closeModal();
    this.debugInteract(this._clockDrum); await this.debugWait(1.9);          // → night
    this.debugInteract(this._mat); await this.debugWait(0.3);
    this.debugInteract(this._table); await this.debugWait(0.3);              // the note (held first)
    this.debugInteract(this._pedestal); await this.debugWait(0.3);           // the key
    this.debugInteract(this._endDoor);
    await this._waitFor(() => this._exitOpen, 30);
    pl.teleport(0, -32); await this.debugWait(0.6);
  }
```

Note the order in `place()`: with both the note and the key in hand, the
table takes the note first; the pedestal then takes the key. A player
holding only the key and touching the table puts the key there — the
rehearsal will say so.

- [ ] **Step 5: Verify**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 17 --port 5117 && node tools/playtest.mjs 17 --port 5217`
Expected: exit 0; `level 17: SOLVED in …s` (about 30 s); no browser errors.

- [ ] **Step 6: Commit**

```bash
git add src/levels/Level17.js
git commit -m "Add room XVII (The Hall) — I's corridor at night, her coat, the mat, the rehearsal"
```

---

### Task 9: Room XVIII — The Sitting Room

**Files:**
- Create: `src/levels/Level18.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`Hours`, `makeChild` + `setTorch`, `isSeenBy`, `footsteps`, `gasp`, `tick`, `static`, `piano`, `hummed {small}`, `fire`/`radio` loops, `showKeypad` with `length: 1`).
- Produces: `Level18`.

Spec: §5.3 — read all of it first (the dial; the child's states; the sound events).

- [ ] **Step 1: Scaffold**

Create `src/levels/Level18.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeTable, makeShelf, makePictureFrame, makeDust,
  makeClockFace, applyFog,
} from '../core/props.js';
import { makeChild } from '../core/presence.js';
import { Hours } from '../core/hours.js';

// XVIII — The Sitting Room
// The wireless must be tuned to the one station, three clicks, and every
// click brings something small down the stairs with a torch. You are the
// thing in the dark now: keep out of its light, throw a sound, click, move.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.3

const W = 6.4, D = 5.2, H = 2.7;                       // origin at the centre; +X is the hall wall
const CLOCK_POS = { x: -2.7, y: 1.34, z: 0.5 };
const WIRELESS = { x: 2.0, y: 0.85, z: -2.3 };
const DOOR_POS = { x: 3.2, y: 1.2, z: 1.6 };
const D_SPOT = new THREE.Vector3(2.4, 0, 1.6);        // the child's place just inside the door
const OUT = new THREE.Vector3(3.8, 0, 1.6);           // through the door, out of sight
const STATION = '247';
const TUNE = LevelBase.tune('EGAGEGE');
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level18 extends LevelBase {
  static meta = {
    id: 18,
    numeral: 'XVIII',
    title: 'The Sitting Room',
    mood: 'night',
    grade: GRADE,
    intro: 'The wireless is on, between stations, and something small upstairs has heard you come in.',
    outro:
      'You were the one in the dark, for once,\n' +
      'keeping out of the light it carried,\n' +
      'and it went back up to bed humming your song. Her song.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    this._wound = false;
    this._digits = '';
    this._tuned = false;
    this._exitOpen = false;
    this._wrongCount = 0;
    this._seenCount = 0;
    this._torchTaken = false;
    this._cooldown = {};                                  // sound event name -> time until reusable
    this._child = null;                                   // built in _buildChild

    this._buildShell();
    this._buildFurniture();
    this._buildWireless();
    this._buildClock();
    this._buildChild();
    this._bindLook({ x: -1.2, y: 1.4, z: -2.55 }, { x: -2, y: 6, z: -10 });
    this._wirePuzzle();

    this.spawn.position.set(2.4, 0, 1.6);
    this.spawn.yaw = Math.PI / 2;                          // facing −X into the room
    this.bounds = new THREE.Box3(new THREE.Vector3(-3.0, 0, -2.4), new THREE.Vector3(5.2, 3, 2.4));
    this.setObjective('the wireless. she said the wireless.');

    this.hours.start();
    this.track(this.hours);
  }

  // (paste _box, _plane, _bindLook, _wind, _wrongHourPlacing, _morningBox, _waitFor)

  _buildShell() {
    // walls (wallpaper '#8d8378'/'#7f7468'), carpet '#5a4e4c', the rug plane at (−0.6, 0.005, 0), ceiling;
    // the hall door this._hallDoor makeDoor({ color: '#5a4636' }) at (3.2, 0, 1.6) rotated −π/2 (tracked; NO panel collider — a doorway blocker this._doorBlocker = this.addBlocker([3.15, 0, 1.1], [3.25, 2.2, 2.1]) stands in for it while it is shut);
    // the stub beyond: floor x 3.2..5.4, z 1.0..2.2, three treads rising east (collide + ground), this._landingLight makeBulbLight({ intensity: 1.6, y: 3.0 }) at (5.0, 0, 1.6);
    // the morning: a white emissive plane at x 3.45 across the doorway (bound 'morning' objects) and a morning blocker [[3.4, 0, 1.0], [3.5, 2.5, 2.2]] (bound 'morning' blockers) — the door stands open onto white;
    // the chimney breast (box x −3.2..−2.75, z −0.8..0.8, full height) this._breast (collider; occluder), the hearth opening (a dark box inset), the mantel (box at y 1.2);
    // the window at x −1.2 in the north wall (1.4 × 1.2 at y 1.4): this._windowPane the night/evening pane (dark glossy), a morning pane emissive white (bound); beyond it the lamp post at (−1.2, 0, −7) with a PointLight flickering 5 % (a ticker);
    // the serving hatch this._hatch on the east wall at (3.15, 1.2, −1.5) (a shutter box);
    // this._dust makeDust({ count: 160, box: [6, 2.6, 5], center: [0, 1.4, 0] }) (tracked) — gives the torch beam body.
  }

  _buildFurniture() {
    // this._chairN / this._chairS armchairs at (−1.4, 0, ±0.8) facing −X: seat 0.7 × 0.45 × 0.7, back 0.7 × 1.05 × 0.2 at the +X side (x −1.05), arms; colliders; this._chairBacks = [backN, backS] (occluders)
    //   the evening: the dent (a darker seat top on this._chairN), her knitting (a small ball + two needles), this._cupSteam makeDust on the cup; the morning: sheets over both (boxes; bound 'morning')
    // this._sofa against the south wall at (0.2, 0, 2.1) facing −Z (seat, back against the wall, arms); collider; this._sofaBack (occluder)
    // this._sideTable at (−0.95, 0, 2.2) (makeTable({ w: 0.45, d: 0.45, h: 0.72 })); this._cup on it (a small cylinder 0.04 r × 0.08 h)
    // this._bookcase makeShelf({ w: 1.2, h: 1.9, d: 0.3 }) at (−2.0, 0, 1.9), rotation.y = π/2 so it runs along z (x −2.15..−1.85, z 1.3..2.5); books as coloured boxes; collider; occluder
    // this._poker a thin cylinder leaning in the hearth at (−2.9, 0.3, 0.4)
    // this._lamp the standard lamp at (2.6, 0, −0.6): pole, shade, this._lampLight PointLight(0xffd2a0, 0, 6) at y 1.6 — bound evening 3.5
    // the fire: this._fireLight PointLight(0xff9a4a, 0, 6) at (−2.8, 0.5, 0) — bound evening 2.5, plus a ticker that flickers ±20 % while this.hours.is('evening'); an emissive ember box in the hearth (evening)
    // photographs: three makePictureFrame(blurredPhotoTexture) on the mantel (night + evening); pale squares (morning)
    // morning boxes: this._boxKeep _morningBox('SITTING ROOM — keep', −0.2, −1.6), this._boxToys _morningBox('SMALL — toys', 0.6, −1.6), this._boxVan _morningBox('SITTING ROOM — van', 1.4, −1.6)
    // Bind everything per hour; loops: evening [{ kind: 'fire', position: { x: -2.9, y: 0.5, z: 0 } }]
  }

  _buildWireless() {
    const table = makeTable({ w: 0.8, d: 0.5, h: 0.7 });
    table.position.set(WIRELESS.x, 0, WIRELESS.z);
    this.add(table); this.addCollider(table);
    const wood = makeMat('wood', { base: '#5a3f2e', repeat: [1, 1] });
    const set = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.22), wood);
    set.position.set(WIRELESS.x, 0.85, WIRELESS.z);
    set.castShadow = true;
    this.add(set);
    this._wireless = set;
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));
    grille.position.set(WIRELESS.x - 0.1, 0.85, WIRELESS.z + 0.111);
    this.add(grille);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.08), new THREE.MeshStandardMaterial({
      map: textTexture({ text: '200 · 250 · 300 · 350 · 400 · 450 · 500 · 550', font: '18px Georgia', color: '#3a332c', bg: '#e8e0cc', width: 512, height: 96 }),
      emissive: 0xffe7b8, emissiveIntensity: 0.25, roughness: 0.7,
    }));
    face.position.set(WIRELESS.x + 0.1, 0.88, WIRELESS.z + 0.111);
    this.add(face);
    this._needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.07, 0.002), new THREE.MeshStandardMaterial({ color: 0xaa2a1a }));
    this._needle.position.set(WIRELESS.x + 0.1, 0.88, WIRELESS.z + 0.113);
    this.add(this._needle);
    this._setNeedle(540);
    // the strip on the glass (evening)
    this._strip = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.018), new THREE.MeshStandardMaterial({
      map: textTexture({ text: '247 — ours', font: 'italic 22px Georgia', color: '#3a332c', bg: '#f1ead6', width: 256, height: 64 }), roughness: 0.8,
    }));
    this._strip.position.set(WIRELESS.x + 0.1, 0.835, WIRELESS.z + 0.114);
    this.add(this._strip);
    this.hours.bind('evening', { objects: [this._strip], interact: [this._strip] });
    // the wireless itself is gone at the morning: bind set/grille/face/needle/strip-table to night + evening, a pale square plane to morning
    this.hours.bind('night', { objects: [set, grille, face, this._needle] });
    this.hours.bind('evening', { objects: [set, grille, face, this._needle] });
  }

  _setNeedle(metres) {
    const k = (Math.min(550, Math.max(200, metres)) - 200) / 350;     // 0..1 across the face
    this._needle.position.x = WIRELESS.x + 0.1 - 0.09 + 0.18 * k;
  }

  _buildClock() {
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.26), caseMat);
    body.position.set(CLOCK_POS.x - 0.02, CLOCK_POS.y, CLOCK_POS.z);
    this.add(body);
    this._clockFace = makeClockFace({ radius: 0.1 });
    this._clockFace.position.set(CLOCK_POS.x + 0.022, CLOCK_POS.y, CLOCK_POS.z);
    this._clockFace.rotation.y = Math.PI / 2;
    this._clockFace.setTime(3, 7, 0);
    this.add(this._clockFace); this.track(this._clockFace);
    this.interact(body, { prompt: 'the clock', distance: 3, onInteract: () => this._wind() });
    this._clockBody = body;
  }

  _buildChild() {
    const c = makeChild();
    c.visible = false;
    c.position.copy(D_SPOT);
    c.rotation.y = -Math.PI / 2;                           // facing −X
    this.add(c);
    this._child = {
      mesh: c, state: 'off', phase: 0, target: null, t: 0, seenT: 0, nearT: 0, baseYaw: -Math.PI / 2, offT: 0, gone: false,
    };
    this._childOccluders = [this._breast, this._bookcase, ...this._chairBacks];
  }

  _wirePuzzle() { /* Step 3 */ }

  async debugSolve() {
    this.game.player.teleport(4.8, 1.6);
    await this.debugWait(0.6);
  }
}
```

- [ ] **Step 2: Build, screenshot at all three hours, iterate**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 18 --port 5118 && node tools/screenshot.mjs 18 --port 5118 --hour morning && node tools/screenshot.mjs 18 --port 5118 --hour evening`
Expected: exit 0; a dark room with a faint glow at the wireless dial; amber with the fire; white with sheets. Iterate.

- [ ] **Step 3: Wire the puzzle — the dial, the sound events, the child**

```js
  _wirePuzzle() {
    const wirelessPos = new THREE.Vector3(WIRELESS.x, WIRELESS.y, WIRELESS.z);

    // ---- hours ----
    this.hours.bind('evening', { onEnter: () => {
      this._setNeedle(247);
      const tune = () => { if (!this.hours.is('evening')) return; TUNE.forEach((f, i) => this.after(i * 0.5, () => this.playSoundAt('piano', WIRELESS, { freq: f, gain: 0.05 }))); this._timers.tune = this.after(14, tune); };
      this._timers = this._timers ?? {};
      tune();
      this._radio = this.loopAt('radio', WIRELESS); this._radio.setGain(0.3);
      if (!this._eveningOnce) { this._eveningOnce = true; this.after(15, () => { if (this.hours.is('evening')) { this.playSoundAt('handle', DOOR_POS); this.subtitle('She thought of something, and didn\'t.', 4); } }); }
    } });
    this.hours.bind('evening', { onLeave: () => { clearTimeout(this._timers?.tune); this._radio?.stop(0.5); this._radio = null; } });
    this.hours.bind('night', { onEnter: () => {
      if (!this._tuned) this._setNeedle(this._digits ? parseInt(this._digits.padEnd(3, '0'), 10) : 540);
      this._radio = this.loopAt('radio', WIRELESS); this._radio.setGain(this._tuned ? 0.2 : 0.25);
      const st = () => { if (!this.hours.is('night') || this._tuned) return; this.playSoundAt('static', WIRELESS, { dur: 0.6 }); this._timers.static = this.after(9, st); };
      this._timers = this._timers ?? {}; this._timers.static = this.after(4, st);
    } });
    this.hours.bind('night', { onLeave: () => { clearTimeout(this._timers?.static); this._radio?.stop(0.5); this._radio = null; } });
    this.hours.bind('morning', { onEnter: () => { if (!this._exitOpen) { this._hallDoor.setAngle(Math.PI / 2); this.removeBlocker(this._doorBlocker); } } });
    this.hours.bind('morning', { onLeave: () => { if (!this._exitOpen) { this._hallDoor.setAngle(0); this._doorBlocker = this.addBlocker([3.15, 0, 1.1], [3.25, 2.2, 2.1]); } } });

    // ---- the strip, the boxes, her things ----
    this.interact(this._strip, { prompt: 'a label on the glass', onInteract: () => this.learnClue({ id: 'l18-dial', title: 'the wireless, at half past eight', body: '247. a label on the glass, in her hand: "ours".' }) });
    this.interact(this._cup, { prompt: 'the cup', onInteract: () => this._soundEvent('cup') });
    this.interact(this._poker, { prompt: 'the poker', onInteract: () => this._soundEvent('poker') });
    this.interact(this._hatch, { prompt: 'the hatch', onInteract: () => this._soundEvent('hatch') });
    this.interact(this._windowPane, { prompt: 'the window', onInteract: () => this._soundEvent('window') });
    // _morningBox onOpen (set in _buildFurniture):
    //   keep → 'The wireless, its cord wound round it. It still gets the one station, she said.'
    //   toys → once: this._torchTaken = true; giveItem { id: 'torch', name: 'a torch' }; 'A torch. Its batteries are long dead, here. You take it anyway.'
    //   van  → 'Books. The rug, rolled.'

    // ---- the hall door ----
    this.interact(this._hallDoor, { prompt: 'the door to the hall', onInteract: () => {
      if (this._exitOpen) return;
      this.playSound('locked');
      this.subtitle(this.hours.is('evening') ? 'Not yet. She is still up.' : this.hours.is('morning') ? 'White. The house is gone from here on.' : 'It shut behind you. They always do.', 4);
    } });
    this.tick(() => { if (this._exitOpen && !this.isCompleted && this.game.player.position.x > 4.4) this.complete(); });

    // ---- the wireless: one digit per touch ----
    this.interact(this._wireless, { prompt: 'the wireless', onInteract: () => {
      if (!this.hours.is('night')) { this.subtitle(this.hours.is('evening') ? 'On the station. The needle rests where it always rests.' : 'A pale square where it stood.', 4); return; }
      if (this._tuned) { this.subtitle('On the station. Low. Leave it.', 3); return; }
      const shown = STATION.split('').map((_, i) => this._digits[i] ?? '·').join(' ');
      this.game.ui.showKeypad({ label: 'the wireless — ' + shown, length: 1, keys: '1234567890', onSubmit: (d) => this._click(d), onCancel: () => {} });
    } });

    // ---- the child ----
    this.tick((dt) => this._updateChild(dt));
  }

  _click(d) {
    this.playSoundAt('tick', WIRELESS, { gain: 0.08 });
    this.cue('a click, at the wireless', new THREE.Vector3(WIRELESS.x, WIRELESS.y, WIRELESS.z));
    this._digits += d;
    this._setNeedle(parseInt(this._digits.padEnd(3, '0'), 10));
    this._summon(new THREE.Vector3(WIRELESS.x, 0, WIRELESS.z));
    if (this._digits.length < 3) { this.setObjective('keep out of its light'); return; }
    if (this._digits === STATION) { this._tunedNow(); return; }
    this.playSoundAt('static', WIRELESS, { dur: 0.8 });
    this.subtitle('Between stations. The needle always rested a little past the middle.', 5);
    this._digits = ''; this._setNeedle(540);
    this._wrongCount++;
    if (this._wrongCount >= 2) this.after(4, () => this.subtitle('There is a label on the glass, at half past eight.', 5));
  }

  _soundEvent(name) {
    const now = performance.now() / 1000;
    if ((this._cooldown[name] ?? 0) > now) return;
    this._cooldown[name] = now + 8;
    const P = {
      poker: { pos: { x: -2.9, y: 0.3, z: 0.4 }, sound: ['clunk', {}], cue: 'the poker falls' },
      cup: { pos: { x: -0.95, y: 0.75, z: 2.2 }, sound: ['tone', { freq: 1800, gain: 0.05, decay: 0.8 }], cue: 'the cup, set down' },
      hatch: { pos: { x: 3.15, y: 1.2, z: -1.5 }, sound: ['knock', { count: 1, soft: true }], cue: 'a plate, in the hatch' },
      window: { pos: { x: -1.2, y: 1.4, z: -2.58 }, sound: ['knock', { count: 1, soft: true }], cue: 'the window, tapped' },
    }[name];
    this.playSoundAt(P.sound[0], P.pos, P.sound[1]);
    this.cue(P.cue, new THREE.Vector3(P.pos.x, P.pos.y, P.pos.z));
    if (this.hours.is('night')) this._summon(new THREE.Vector3(P.pos.x, 0, P.pos.z));
  }

  /** A sound at P: the child comes (if it is not here yet) or turns toward it. */
  _summon(P) {
    const c = this._child;
    if (c.gone || !this.hours.is('night')) return;
    if (c.state === 'off') {
      if (c.offT > 0) return;                                 // it is still upstairs, put off
      c.mesh.visible = true; c.mesh.position.copy(D_SPOT); c.mesh.rotation.y = c.baseYaw;
      c.mesh.setTorch(!this._torchTaken);
      this._hallDoor.setOpen(true, 1); this.removeBlocker(this._doorBlocker); this.playSound('door');
      this.cue('the door', new THREE.Vector3(DOOR_POS.x, DOOR_POS.y, DOOR_POS.z));
      if (this._torchTaken && !this._darkSaid) { this._darkSaid = true; this.subtitle('It stands in the doorway without a light, listening for you. You wish you hadn\'t.', 6); }
      c.state = 'wait'; c.t = 0;
    }
    if (c.state === 'flee') return;
    c.target = P.clone(); c.state = 'sound'; c.t = 0; c.turnFrom = c.mesh.rotation.y;
    c.turnTo = Math.atan2(P.x - c.mesh.position.x, P.z - c.mesh.position.z);
  }

  _updateChild(dt) {
    const c = this._child, m = c.mesh;
    if (c.offT > 0) { c.offT -= dt; if (c.offT <= 0 && !c.gone && this.hours.is('night')) { this._summon(D_SPOT.clone().add(new THREE.Vector3(-1, 0, 0))); c.state = 'wait'; c.target = null; } return; }
    if (c.state === 'off' || c.gone) return;
    if (!this.hours.is('night')) { m.visible = false; c.state = 'off'; return; }
    c.t += dt;
    const pl = this.game.player.position;
    const moveToward = (target, speed, stopAt) => {
      const dx = target.x - m.position.x, dz = target.z - m.position.z, d = Math.hypot(dx, dz);
      if (d <= stopAt) return true;
      const step = Math.min(d - stopAt, speed * dt);
      m.position.x += dx / d * step; m.position.z += dz / d * step;
      m.rotation.y = Math.atan2(dx, dz);
      return d - step <= stopAt + 0.01;
    };
    switch (c.state) {
      case 'wait':
        m.rotation.y = c.baseYaw + Math.sin(c.t * (2 * Math.PI / 7)) * (65 * Math.PI / 180);
        break;
      case 'sound': {
        if (c.t < 0.6) { let d = c.turnTo - c.turnFrom; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; m.rotation.y = c.turnFrom + d * (c.t / 0.6); }
        else if (moveToward(c.target, 1.1, 1.5)) { c.state = 'look'; c.t = 0; c.lookYaw = m.rotation.y; }
        break;
      }
      case 'look':
        if (c.t < 1.2) m.rotation.y = c.lookYaw;
        else if (c.t < 3.2) m.rotation.y = c.lookYaw + Math.sin((c.t - 1.2) * Math.PI) * (45 * Math.PI / 180);
        else { c.state = 'return'; c.t = 0; }
        break;
      case 'return':
        if (moveToward(D_SPOT, 1.1, 0.05)) { m.position.copy(D_SPOT); c.state = 'wait'; c.t = 0; }
        break;
      case 'flee': {                                          // to the door, then out; phase 0 → 1
        if (c.phase !== 1) { if (moveToward(D_SPOT, 2.2, 0.05)) c.phase = 1; }
        else if (moveToward(OUT, 2.2, 0.05)) {
          m.visible = false; c.state = 'off'; c.phase = 0; c.offT = 12;
          this._hallDoor.setOpen(false); this._doorBlocker = this.addBlocker([3.15, 0, 1.1], [3.25, 2.2, 2.1]); this.playSound('door');
        }
        return;
      }
      case 'leaving': {
        if (c.phase !== 1) { if (moveToward(D_SPOT, 1.0, 0.05)) c.phase = 1; }
        else if (moveToward(OUT, 1.0, 0.05)) {
          m.visible = false; c.gone = true;
          this.footsteps([{ x: 3.4, y: 0, z: 1.6 }, { x: 5.0, y: 1.8, z: 1.6 }], { every: 0.45, opts: { soft: true } });
        }
        return;
      }
      case 'still': break;
    }
    if (c.state === 'still') return;
    // the seen-test: inside its beam for 0.45 s, or within 1.6 m for 0.3 s
    const eye = new THREE.Vector3(0, 0.95, 0);
    const inBeam = !this._torchTaken && this.isSeenBy(m, { angleDeg: 22, maxDist: 9, occluders: this._childOccluders, eye });
    const near = Math.hypot(pl.x - m.position.x, pl.z - m.position.z) < 1.6;
    c.seenT = inBeam ? c.seenT + dt : 0;
    c.nearT = near ? c.nearT + dt : 0;
    if (c.seenT >= 0.45 || c.nearT >= 0.3) this._seen();
  }

  _seen() {
    const c = this._child;
    c.state = 'flee'; c.phase = 0; c.t = 0; c.seenT = 0; c.nearT = 0;
    this.playSoundAt('gasp', c.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
    this.cue('a gasp', c.mesh.position);
    c.mesh.setTorch(false);
    this.flinch({ flash: 0 });
    this._digits = ''; this._setNeedle(540);
    this.playSoundAt('static', WIRELESS, { dur: 0.6 });
    this.dread(0.5); this.after(6, () => this.dread(0));
    this._seenCount++;
    this.subtitle(this._seenCount === 1 ? 'It saw you. She never let it see her. You know why, now.' : 'It saw you. It will come down again. It always does.', this._seenCount === 1 ? 6 : 5);
    if (this._seenCount >= 3) this.after(4, () => this.subtitle('Give it something else to look at. The poker. The cup. The hatch. The window.', 7));
    if (this.game.ui.modalOpen) this.game.ui.closeModal();
  }

  _tunedNow() {
    this._tuned = true;
    this._clockLocked = true;
    const c = this._child;
    c.state = 'still'; c.t = 0;
    c.mesh.faceToward({ x: WIRELESS.x, y: 0, z: WIRELESS.z });
    c.mesh.setTorch(false);
    this.hush(2);
    this._radio?.setGain(0.2);
    const play = (offset, hum) => TUNE.forEach((f, i) => this.after(offset + i * 0.5, () => {
      this.playSoundAt('piano', WIRELESS, { freq: f, gain: 0.06 });
      if (hum && i === 0) { this.playSoundAt('hummed', c.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), { notes: TUNE, step: 0.5, small: true, holdSeconds: 6 }); this.cue('it hums along', c.mesh.position); }
    }));
    this.after(2, () => { this.cue('the tune, from the wireless', new THREE.Vector3(WIRELESS.x, WIRELESS.y, WIRELESS.z)); play(0, false); });
    this.after(6, () => play(0, true));
    this.after(10.5, () => {
      if (c.state !== 'still') return;
      c.state = 'leaving'; c.phase = 0; c.t = 0;
      this._exitOpen = true;
      if (!this._hallDoor.isOpen()) { this._hallDoor.setOpen(true, 1); this.removeBlocker(this._doorBlocker); }
      this.setObjective('up. two metres behind.');
      if (this._torchTaken) this.subtitle('It goes up humming, in the dark.', 5);
      const again = () => { if (!this.hours.is('night')) return; TUNE.forEach((f, i) => this.after(i * 0.5, () => this.playSoundAt('piano', WIRELESS, { freq: f, gain: 0.04 }))); this._timers.again = this.after(20, again); };
      this._timers.again = this.after(20, again);
    });
  }
```

- [ ] **Step 4: The real `debugSolve()`**

```js
  async debugSolve() {
    const pl = this.game.player, c = this._child;
    this.debugInteract(this._clockBody); await this.debugWait(1.9);           // → morning (the torch stays in its box)
    this.debugInteract(this._clockBody); await this.debugWait(1.9);           // → evening
    this.debugInteract(this._strip); await this.debugWait(0.2);
    this.debugInteract(this._clockBody); await this.debugWait(1.9);           // → night
    const yawTo = (p) => { const dx = p.x - c.mesh.position.x, dz = p.z - c.mesh.position.z; let d = Math.atan2(dx, dz) - c.mesh.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
    pl.teleport(1.6, -1.2, 0);
    this.debugInteract(this._wireless); this.game.ui.submitKeypad('2');       // the child comes
    pl.teleport(-2.7, 1.9, Math.PI / 2);                                     // the alcove
    await this._waitFor(() => c.state === 'wait', 16);
    this.debugInteract(this._cup);                                            // it turns to the cup
    await this._waitFor(() => c.state !== 'wait' && yawTo(WIRELESS) > 70 * Math.PI / 180, 6);
    pl.teleport(1.6, -1.2, 0);
    this.debugInteract(this._wireless); this.game.ui.submitKeypad('4'); await this.debugWait(0.3);
    this.debugInteract(this._wireless); this.game.ui.submitKeypad('7');
    pl.teleport(-2.7, 1.9, Math.PI / 2);
    await this._waitFor(() => this._tuned, 6);
    await this._waitFor(() => c.gone, 16);
    pl.teleport(4.8, 1.6); await this.debugWait(0.6);
  }
```

- [ ] **Step 5: Verify**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 18 --port 5118 && node tools/playtest.mjs 18 --port 5218`
Expected: exit 0; `level 18: SOLVED in …s` (about 35 s). If it runs over 40 s on this machine, shorten `'look'` (1.2 s hold + 2.0 s sweep → 1.0 + 1.6) — never the cooldowns or the near rule.

- [ ] **Step 6: Commit**

```bash
git add src/levels/Level18.js
git commit -m "Add room XVIII (The Sitting Room) — the wireless at 247, the child with the torch, sounds you can throw"
```

---

### Task 10: Room XIX — The Stairs

**Files:**
- Create: `src/levels/Level19.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`Hours`, `makeChild`, `chalkTexture`, `footsteps`, `smallStep`, `hummed {small}`, `breath`, `tick`, `boiler`/`tap` loops, `player.teleport(x, z, yaw, y)`).
- Produces: `Level19`.

Spec: §5.4 — read all of it first. It is the largest room; build it in the
order below and verify after each part.

One simplification of the spec's wording, decided here: W is *slaved* to
the player's position on the stair path — always exactly one floor (two
flights) above — so when you climb toward it, it climbs away from you. No
moving blocker is needed to keep the distance; the "it stops above you"
line plays when you climb for more than 2 s. During the approach W is
fixed on a landing and a blocker on the flight's top two steps keeps you
two metres short.

- [ ] **Step 1: Scaffold — the stairs up, the landing, the three rooms by hour, the clock**

Create `src/levels/Level19.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, chalkTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeTable, makeShelf, makeSign,
  makePictureFrame, makeClockFace, applyFog,
} from '../core/props.js';
import { makeChild } from '../core/presence.js';
import { Hours } from '../core/hours.js';

// XIX — The Stairs
// The landing at three hours: the archive in the airing cupboard at the
// morning, the bathroom and the box room at the evening, and at 3:07 the
// shaft of XII behind the cupboard door — with the roles swapped. You are
// the footsteps below. Light the doors one closer each time round, write
// the chalk, and when it stops, go up to it and stop two metres short.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.4

const LAND_Y = 1.8;
const FLOOR_H = 2.72, RISE = 0.17, RUN = 0.28, STEPS = 8;
const MAIN = { x0: -3.4, x1: -1.2 }, FLIGHT = { x0: -5.64, x1: -3.4 }, HALF = { x0: -7.8, x1: -5.64 };
const ZS = { s0: -0.4, s1: 0.9, n0: 0.9, n1: 2.2 };        // south flight z, north flight z
const LANDINGS = [                                            // idx → label, y
  ['2', LAND_Y], ['1', LAND_Y - FLOOR_H], ['G', LAND_Y - 2 * FLOOR_H],
  ['−1', LAND_Y - 3 * FLOOR_H], ['−2', LAND_Y - 4 * FLOOR_H], ['−3', LAND_Y - 5 * FLOOR_H],
];
const LOOP_FOOT = LAND_Y - 5 * FLOOR_H - 1.36 - 0.24;        // −13.4: below L5's half-landing, on the north flight
const LOOP_UP = 3 * FLOOR_H;                                  // 8.16
const CLOCK_POS = { x: 1.0, y: LAND_Y + 1.7, z: -0.5 };
const CARDS = [                                               // top of the tray first
  ['the street', 'three lamps came on, and the one outside your house never did. the key was under the stone that didn\'t match.'],
  ['the pool', 'nobody watched you swim but her. the deep end was four.'],
  ['the hallway', 'doors 203 to 212. the spare key where the flowers used to be; you watered them on Sundays.'],
  ['the field', 'from the tree that died the summer you were eight, thirteen posts along the wire, and look down. a tin. a ribbon.'],
  ['the theater', 'row F, seat 8. The Long Summer, 1974. you cannot remember it.'],
  ['the house', 'supper, then slippers, then the wireless, and yours always last. the porch was dead.'],
  ['the platform', 'the 23:47, carriage 3, seat 41. the train did not stop.'],
  ['the supermarket', 'milk, bread, apples, sunflowers, for Sunday. the office knew the aisles: 3 1 4 2.'],
];
const BOX_LINES = {
  'the street': 'A house key, and a stone that does not match.', 'the pool': 'A tile from the deep end.',
  'the field': 'A rusted tin, empty.', 'the theater': 'A ticket stub, row F.',
  'the platform': 'A ticket for the 23:47, smudged.', 'the supermarket': 'A list. You know the list.',
};
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level19 extends LevelBase {
  static meta = {
    id: 19,
    numeral: 'XIX',
    title: 'The Stairs',
    mood: 'stairwell',
    grade: GRADE,
    intro: 'Up, then. Two flights below it, always; she taught you that without meaning to.',
    outro:
      'You lit the doors one closer each time round,\n' +
      'and wrote wait for me in the only hand it could have been in,\n' +
      'and when it stopped, you stopped two metres short, and the door gave.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    this._wound = false;
    this._have = { photo: false, ribbon: false, key: false };   // in the box
    this._strikes = 0;
    this._ready = false;
    this._tray = 0;                                              // next card index
    this._holding = null;                                        // the card index in hand
    this._filed = 0;
    this._loops = 0; this._correct = 0; this._pleaded = 0;
    this._chalkWritten = false; this._tally = 0;
    this._still = 0; this._climb = 0;
    this._approach = null;                                       // null | 'armed' | 'fixed' | 'done'
    this._exitOpen = false;
    this._inShaft = false;
    this._stub = {};                                             // floor idx (3,4,5) → { light, plane, on, cord, door }

    this._buildLanding();
    this._buildRooms();          // bathroom (evening), airing cupboard (evening), box room (evening), the archive (morning)
    this._buildShaft();          // night
    this._buildClock();
    this._bindLook({ x: 0.3, y: LAND_Y + 1.4, z: -2.95 }, { x: 2, y: 8, z: -10 });
    this._wirePuzzle();

    this.spawn.position.set(0, 0, 6.2);
    this.spawn.yaw = 0;
    this.bounds = new THREE.Box3(new THREE.Vector3(-8.2, -16, -3.2), new THREE.Vector3(4.6, 4.8, 7.2));
    this.setObjective('up. then yours last.');

    this.hours.start();
    this.track(this.hours);
  }

  // (paste _box, _plane, _bindLook, _wind, _wrongHourPlacing, _morningBox, _waitFor)

  _buildLanding() {
    // the stair foot stub: floor x −0.9..0.9, z 5.4..7.0 at y 0 (ground), dark walls, a blocker at z 7.0;
    // treads: 10 boxes 0.9 wide × 0.18 × 0.27 from z 5.4 (y 0.09) to z 2.97 (y 1.71), each addCollider({ alsoGround: true }); a banister;
    // the landing floor x −1.2..1.2, z −3.0..2.7 at y LAND_Y (ground), ceiling at LAND_Y + 2.5, walls (plaster '#a9a597', dado, the bedroom's wallpaper above), with openings:
    //   west wall: this._bathDoor at z −1.5, this._airDoor at z +0.9 (both makeDoor, rotation.y = π/2, tracked; their panels are NOT colliders — doorway blockers: this._bathBlocker, this._airBlocker via addBlocker, removed when the door opens);
    //   east wall: this._boxDoor at z −1.5 (rotation.y = −π/2; blocker this._boxBlocker), this._childDoor at z +0.6 ('#5a4636', never opens; panel collider);
    //   north wall: the window at x +0.3 (night pane dark + firefly points beyond; evening dusk; morning emissive white — bound), this._herDoor at x −0.5 (never opens; panel collider);
    //   the fire-plan sign (makeSign 0.4 × 0.5 '#d8cfba') beside the airing cupboard door: 'IN THE EVENT OF FIRE\ndo not use the lifts\ndo not run\nassembly point: the playground'
    // lights: this._landBulb makeBulbLight({ color: 0xffd2a0, intensity: 0, distance: 8, y: LAND_Y + 2.4 }) at (0, 0, 0) — bound evening 3.5
    // morning: a box _morningBox('LANDING — van', 0.6, 1.8) (its onOpen: 'The lamp from the landing, its shade crushed.'); pale rectangles.
  }

  _buildRooms() {
    // BATHROOM (evening): x −3.6..−1.2, z −2.6..−0.4 at y LAND_Y: walls (tile '#c9c4b4'), floor, ceiling; the bath (a box 1.6 × 0.55 × 0.7 against the west wall), the basin, the mirror (a dark plane) with this._cloth over it,
    //   the towel rail with this._ribbon (a box 0.02 × 0.02 × 0.3, 0x4a6aa8) at (−3.3, LAND_Y + 1.0, −1.0); loop { kind: 'tap', position: { x: -3.3, y: LAND_Y + 0.6, z: -2.2 }, opts: {} } with setGain(0.15) in an onEnter
    //   bound 'evening' (objects, colliders, interact). At the morning the doorway shows white (a plane + a morning blocker behind the door opening).
    // AIRING CUPBOARD (evening): x −2.6..−1.2, z 0.3..1.5: this._boiler (a cylinder), slats, towels; loop { kind: 'boiler', position: { x: -2.0, y: LAND_Y + 0.8, z: 0.9 } } — bound 'evening'
    // BOX ROOM (evening): x 1.2..4.2, z −3.0..0.0: a cot frame, a trunk (box 0.9 × 0.5 × 0.5 at (2.7, LAND_Y + 0.25, −1.6)), this._theBox on it (cardboard 0.5 × 0.35 × 0.4, open flaps), this._label (a plane 0.3 × 0.1 on its front) with
    //   this._labelTex = a CanvasTexture of one scribbled cursive word; give it .redraw({ strikes }) that repaints and strikes through 0/1/2 times (model it on chalkTexture's redraw);
    //   inside the box, hidden until placed: this._photoIn (small makePictureFrame(blurredPhotoTexture)), this._ribbonIn (the ribbon box), this._keyIn (makeKeyProp) — bound 'evening'
    // THE ARCHIVE (morning): x −6.2..−1.2, z −1.0..3.0: shelves makeShelf ×4 (two on the north wall, two on the south), the table makeTable at (−3.7, 0, 1.0) + the green lamp (a cone, unlit) + this._trayMesh (a box 0.3 × 0.08 × 0.22 with a paper stack) at (−3.4, LAND_Y + 0.78, 1.1);
    //   eight boxes: this._boxes[label] = { mesh, lid, open: false } (cardboard, a label plane textTexture italic 30px lowercase) on the shelves — the lid a box that rotates up when opened; contents (hidden until opened): 'the hallway' → this._keyArch (makeKeyProp), 'the house' → this._photoArch (makePictureFrame, small)
    //   bound 'morning' (objects, colliders, interact)
  }

  _buildShaft() {
    const concrete = makeMat('concrete', { base: '#7a766f', repeat: [2, 1] });
    const floorMat = makeMat('concrete', { base: '#5e5b55', repeat: [2, 2] });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9 });
    const night = { objects: [], colliders: [], interact: [], lights: [] };
    const add = (m, { collide = true, ground = false } = {}) => { this.add(m); night.objects.push(m); if (collide) night.colliders.push(m); if (ground) this.addGround(m); return m; };
    const box = (w, h, d, mat, x, y, z, o) => { const m = makeWall(w, h, d, mat); m.position.set(x, y, z); return add(m, o); };
    const mainCx = (MAIN.x0 + MAIN.x1) / 2, halfCx = (HALF.x0 + HALF.x1) / 2;
    const zc = (ZS.s0 + ZS.n1) / 2, zd = ZS.n1 - ZS.s0;
    this._fireDoors = {}; this._labelSigns = [];
    this._path = [];                                                // the stair path, top to bottom
    for (let f = 0; f < 6; f++) {
      const y = LAND_Y - f * FLOOR_H, yh = y - 1.36;
      // main landing (east) and half-landing (west)
      box(MAIN.x1 - MAIN.x0, 0.2, zd, floorMat, mainCx, y - 0.1, zc, { ground: true });
      box(HALF.x1 - HALF.x0, 0.2, zd, floorMat, halfCx, yh - 0.1, zc, { ground: true });
      // the south flight descends westward from the main landing; the north flight descends eastward from the half-landing
      for (let s = 0; s < STEPS; s++) {
        const sy = y - RISE * (s + 1), sx = FLIGHT.x1 - RUN * (s + 0.5);
        box(RUN, RISE, ZS.s1 - ZS.s0, concrete, sx, sy + RISE / 2, (ZS.s0 + ZS.s1) / 2, { ground: true });   // south: tread s spans y − RISE·(s+1) .. y − RISE·s, descending westward
        const ny = yh - RISE * (s + 1), nx = FLIGHT.x0 + RUN * (s + 0.5);
        box(RUN, RISE, ZS.n1 - ZS.n0, concrete, nx, ny + RISE / 2, (ZS.n0 + ZS.n1) / 2, { ground: true });   // north: the same from the half-landing, descending eastward
      }
      // walls: east (the house side, with the door opening), west, north, south; a spine wall between the flights' undersides
      // east wall in pieces: an opening 1.0 wide × 2.1 high at zc for the door (every floor; L0's is the airing cupboard's)
      box(0.2, FLOOR_H + 0.4, zc - 0.5 - ZS.s0, concrete, MAIN.x1 + 0.1, y - FLOOR_H / 2 + 0.2, (ZS.s0 + zc - 0.5) / 2);
      box(0.2, FLOOR_H + 0.4, ZS.n1 - zc - 0.5, concrete, MAIN.x1 + 0.1, y - FLOOR_H / 2 + 0.2, (zc + 0.5 + ZS.n1) / 2);
      box(0.2, FLOOR_H + 0.4 - 2.1, 1.0, concrete, MAIN.x1 + 0.1, y + 2.1 + (FLOOR_H + 0.4 - 2.1) / 2, zc);   // lintel
      box(0.2, FLOOR_H + 0.4, zd, concrete, HALF.x0 - 0.1, yh - FLOOR_H / 2 + 0.2, zc);               // west
      box(MAIN.x1 - HALF.x0 + 0.4, FLOOR_H + 0.4, 0.2, concrete, (HALF.x0 + MAIN.x1) / 2, y - FLOOR_H / 2 + 0.2, ZS.s0 - 0.1);  // south wall
      box(MAIN.x1 - HALF.x0 + 0.4, FLOOR_H + 0.4, 0.2, concrete, (HALF.x0 + MAIN.x1) / 2, y - FLOOR_H / 2 + 0.2, ZS.n1 + 0.1);  // north wall
      box(FLIGHT.x1 - FLIGHT.x0, 1.2, 0.12, dark, (FLIGHT.x0 + FLIGHT.x1) / 2, y - 1.36 - 0.5, ZS.s1);                        // spine between flights (under the treads)
      // handrails (thin boxes along the open side of each flight, collide false)
      // label sign on the main landing's north wall, caged bulb over it
      const sign = makeSign({ text: LANDINGS[f][0], width: 0.5, height: 0.5, bg: '#4a4844', color: '#d9d4c8', font: 'bold 160px Georgia' });
      sign.position.set(mainCx, y + 1.5, ZS.n1 - 0.005); sign.rotation.y = Math.PI; add(sign, { collide: false });
      const bulb = makeBulbLight({ color: 0xd8dcd0, intensity: 0, distance: 7, y: y + 2.45 });
      bulb.position.set(mainCx, 0, zc); add(bulb, { collide: false }); night.lights.push({ light: bulb.light, intensity: 3.2 });
      if (f === 3) bulb.light.castShadow = true;
      const hb = makeBulbLight({ color: 0xd8dcd0, intensity: 0, distance: 6, y: yh + 2.45 });
      hb.position.set(halfCx, 0, zc); add(hb, { collide: false }); night.lights.push({ light: hb.light, intensity: 1.4 });
      // the fire door on the east wall (f ≥ 1); the airing cupboard door is L0's
      if (f >= 1) {
        const door = makeDoor({ width: 0.95, color: '#4f5a5e', frameColor: '#3a4043' });
        door.position.set(MAIN.x1, y, zc); door.rotation.y = -Math.PI / 2;     // in the east wall, swinging east
        add(door, { collide: false }); this.track(door);
        this._fireDoors[f] = door;
        night.objects.push(door); night.interact.push(door);
        // a doorway blocker stands in for the shut panel; L3–L5's are removed when their door opens
        const blk = this.addBlocker([MAIN.x1 - 0.1, y, zc - 0.5], [MAIN.x1 + 0.1, y + 2.2, zc + 0.5]);
        if (f >= 3) { this._stubBlockers = this._stubBlockers ?? {}; this._stubBlockers[f] = blk; this._buildStub(f, y, night); }
        else { this._shaftBlockers = (this._shaftBlockers ?? []).concat(blk); }
      }
      // the path: main landing centre → south flight top → half-landing (south side) → half-landing (north side) → north flight bottom → next main landing (north side) → its centre
      this._path.push(
        new THREE.Vector3(mainCx, y, (ZS.s0 + ZS.s1) / 2),
        new THREE.Vector3(FLIGHT.x1, y, (ZS.s0 + ZS.s1) / 2),
        new THREE.Vector3(FLIGHT.x0, yh, (ZS.s0 + ZS.s1) / 2),
        new THREE.Vector3(FLIGHT.x0, yh, (ZS.n0 + ZS.n1) / 2),
        new THREE.Vector3(FLIGHT.x1, y - FLOOR_H, (ZS.n0 + ZS.n1) / 2),
        new THREE.Vector3(mainCx, y - FLOOR_H, (ZS.n0 + ZS.n1) / 2),
      );
    }
    // below L5: the flights exist (f = 5 built them down to y −14.52); a blocker closes the shaft
    const yEnd = LAND_Y - 6 * FLOOR_H;
    const blk = this.addBlocker([HALF.x0, yEnd - 0.5, ZS.s0], [MAIN.x1, yEnd + 0.5, ZS.n1]);
    this._shaftBlockers = (this._shaftBlockers ?? []).concat(blk);
    // the chalk on L4's south wall
    this._chalk = chalkTexture({ tally: 0, lines: [] });
    const chalkPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshStandardMaterial({ map: this._chalk, roughness: 1 }));
    chalkPlane.position.set(mainCx, LANDINGS[4][1] + 1.2, ZS.s0 + 0.005); add(chalkPlane, { collide: false });
    this._chalkPlane = chalkPlane; night.interact.push(chalkPlane);
    // the wardrobe's back on L0's north wall
    this._wardrobeBack = makeDoor({ color: '#7a5a3a', knob: false });
    this._wardrobeBack.position.set(mainCx, LAND_Y, ZS.n1); this._wardrobeBack.rotation.y = Math.PI;
    add(this._wardrobeBack, { collide: false }); this.track(this._wardrobeBack);
    this._wbBlocker = this.addBlocker([mainCx - 0.55, LAND_Y, ZS.n1 - 0.1], [mainCx + 0.55, LAND_Y + 2.2, ZS.n1 + 0.1]);
    // the stub beyond it: concrete floor x −2.8..−1.8, z 2.2..3.8 (ground), walls, a dark doorway with a blocker at z 3.8
    // (all bound 'night'); threshold z > 3.3
    // the child (W): a makeChild, hidden, bound 'night'
    this._wMesh = makeChild(); this._wMesh.visible = false; this.add(this._wMesh); night.objects.push(this._wMesh);
    this.hours.bind('night', night);
    // compute the path's per-floor length for the slaving
    this._floorLen = 0;
    for (let i = 0; i < 6; i++) this._floorLen += this._path[i].distanceTo(this._path[i + 1]);
  }

  _buildStub(f, y, night) {
    // behind the fire door: a corridor x −1.2..3.8, z 0.2..1.6, height 2.6, concrete; four lockers; at x 3.5 the light fitting (emissive plane + PointLight 0xffd9a8, 0, 7) and the pull cord
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a8, emissiveIntensity: 0 }));
    plane.position.set(3.5, y + 2.55, 0.9); plane.rotation.x = Math.PI / 2; this.add(plane); night.objects.push(plane);
    const light = new THREE.PointLight(0xffd9a8, 0, 7, 1.8); light.position.set(3.5, y + 2.3, 0.9); this.add(light);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0xd9d4c8 }));
    cord.position.set(3.3, y + 1.6, 0.9); this.add(cord); night.objects.push(cord); night.interact.push(cord);
    this._stub[f] = { light, plane, cord, on: false, y };
    // (build the corridor's floor (ground), walls, ceiling and lockers here, pushing each into night.objects / night.colliders)
  }

  _buildClock() {
    const wood = makeMat('wood', { base: '#4a3a2c', repeat: [1, 2] });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.0, 0.45), wood);
    body.position.set(1.0, LAND_Y + 1.0, -0.5);
    this.add(body); this.addCollider(body);
    this._clockFace = makeClockFace({ radius: 0.12 });
    this._clockFace.position.set(0.845, CLOCK_POS.y, -0.5);
    this._clockFace.rotation.y = -Math.PI / 2;                 // faces −X, into the landing
    this._clockFace.setTime(3, 7, 0);
    this.add(this._clockFace); this.track(this._clockFace);
    this.interact(body, { prompt: 'the clock', distance: 3, onInteract: () => this._wind() });
    this._clockBody = body;
    this.tick((dt) => {                                         // it ticks at the evening and the morning
      if (this.hours.is('night')) return;
      this._tickT = (this._tickT ?? 0) + dt;
      if (this._tickT >= 1.0) { this._tickT = 0; this.playSoundAt('tick', CLOCK_POS, { gain: 0.035 }); }
    });
  }

  _wirePuzzle() { /* Step 3 */ }

  async debugSolve() {
    this.game.player.teleport(-2.3, 3.6, 0, LAND_Y);
    await this.debugWait(0.6);
  }
}
```

- [ ] **Step 2: Build, screenshot at all three hours, iterate**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 19 --port 5119 && node tools/screenshot.mjs 19 --port 5119 --hour morning && node tools/screenshot.mjs 19 --port 5119 --hour evening`
Expected: exit 0. From the stair foot: the stairs rise to a landing; at the evening warm; at the morning white. Also check the shaft: temporarily teleport in the browser (`__game.player.teleport(-2.3, 0.25, Math.PI/2, -6.36)`) at night and look around — no holes, treads readable, a sign and a bulb per landing.

- [ ] **Step 3: Wire the landing — doors, the archive, the box**

```js
  _wirePuzzle() {
    // ---- doors by hour ----
    const doorAt = (door, blockerName, hour, lockedLine) => this.interact(door, { prompt: 'the door', onInteract: () => {
      if (this.hours.is(hour)) { if (!door.isOpen()) { door.setOpen(true, 1); this.removeBlocker(this[blockerName]); this.playSound('door'); } return; }
      this.playSound('locked'); this.subtitle(lockedLine(this.hours.current), 5);
    } });
    doorAt(this._bathDoor, '_bathBlocker', 'evening', (h) => h === 'night' ? 'Locked. Behind it, water is running into a tub that never fills.' : 'White. The house is gone from here on.');
    doorAt(this._boxDoor, '_boxBlocker', 'evening', (h) => h === 'night' ? 'Locked.' : 'White. The house is gone from here on.');
    this.interact(this._airDoor, { prompt: 'the airing cupboard', onInteract: () => {
      if (this.hours.is('night') && !this._ready) { this.playSound('locked'); this.subtitle('Locked. Something on the other side is still going down.', 5); this.playSoundAt('stepOther', { x: -2.3, y: LAND_Y - 4, z: 0.9 }, { soft: true }); return; }
      if (!this._airDoor.isOpen()) { this._airDoor.setOpen(true, 1); this.removeBlocker(this._airBlocker); this.playSound('door'); }
    } });
    // every hour change shuts the three doors again and restores their blockers (the rooms behind them swap)
    this.hours.onChange = () => {
      for (const [door, name, box] of [[this._bathDoor, '_bathBlocker', [[-1.3, LAND_Y, -2.0], [-1.1, LAND_Y + 2.2, -1.0]]], [this._boxDoor, '_boxBlocker', [[1.1, LAND_Y, -2.0], [1.3, LAND_Y + 2.2, -1.0]]], [this._airDoor, '_airBlocker', [[-1.3, LAND_Y, 0.4], [-1.1, LAND_Y + 2.2, 1.4]]]]) {
        if (door.isOpen()) { door.setOpen(false); this[name] = this.addBlocker(box[0], box[1]); }
      }
      if (this.hours.is('night') && !this._inShaft) this.setObjective(this._ready ? 'down, two flights below' : 'up. then yours last.');
    };
    this.interact(this._childDoor, { prompt: 'the door', onInteract: () => { this.playSound('locked'); this.subtitle('Shut. Yours always last.', 4); } });
    this.interact(this._herDoor, { prompt: 'her door', onInteract: () => { this.playSound('locked'); this.subtitle(this.hours.is('evening') ? 'Her room. She is still up.' : 'Her room. You never went in.', 4); } });
    this.tick((dt) => {                                              // two knocks behind the child's door, every ~50 s
      this._knockT = (this._knockT ?? 30) + dt;
      if (this._knockT > 50) { this._knockT = 0; this.playSoundAt('knock', { x: 1.3, y: LAND_Y + 1.2, z: 0.6 }, { count: 2, soft: true }); this.cue('two knocks, behind the door', new THREE.Vector3(1.3, LAND_Y + 1.2, 0.6)); }
    });

    // ---- the bathroom ----
    this.interact(this._cloth, { prompt: 'the mirror', onInteract: () => this.subtitle('Covered. She keeps it covered. Leave it.', 4) });
    this.interact(this._ribbon, { prompt: 'the ribbon', once: true, onInteract: () => {
      this._ribbon.visible = false;
      this.giveItem({ id: 'ribbon', name: 'a ribbon, blue' });
      this.subtitle('Blue. Not blue once — blue. It is newer than you remember it.', 5);
      this.setObjective('the box, in the box room');
    } });
    this.interact(this._boiler, { prompt: 'the boiler', onInteract: () => this.subtitle('Warm. Towels, and the boiler ticking like something counting.', 4) });

    // ---- the archive: the tray and the boxes ----
    this.interact(this._trayMesh, { prompt: 'the in-tray', onInteract: () => {
      if (this._holding !== null) { this.subtitle('One at a time. You are the filer tonight.', 4); return; }
      if (this._tray >= CARDS.length) { this.subtitle('The tray is empty.', 3); return; }
      const k = this._tray++;
      this._holding = k;
      this.giveNote({ id: 'l19-card-' + k, title: 'an index card', body: CARDS[k][1] });
      this.giveItem({ id: 'card', name: 'an index card' });
    } });
    for (const [label, box] of Object.entries(this._boxes)) {
      this.interact(box.mesh, { prompt: label, onInteract: () => {
        if (box.open) { this.subtitle(BOX_LINES[label] ?? 'Open.', 4); return; }
        if (this._holding === null) { this.playSound('locked'); this.subtitle('The lid is down. The tray is on the table.', 4); return; }
        if (CARDS[this._holding][0] !== label) { this.playSound('locked'); this.subtitle(`The lid stays down. That was not ${label}.`, 4); return; }
        this._holding = null; this.removeItem('card'); this._filed++;
        this.playSound('paper');
        box.open = true; box.lid.rotation.x = -Math.PI / 2;            // (animate over 0.6 s with a small ticker if you like)
        if (label === 'the hallway') { this._keyArch.visible = true; this.game.interaction.setEnabled(this._keyArch, true); this.subtitle('The spare key. Cold now. It will be warm again by the time it is found.', 5); }
        else if (label === 'the house') { this._photoArch.visible = true; this.game.interaction.setEnabled(this._photoArch, true); this.subtitle('Two figures, faces gone soft. One of them is you.', 5); }
        else this.subtitle(BOX_LINES[label], 4);
        if (this._filed === CARDS.length) this.learnClue({ id: 'l19-records', title: 'the records', body: 'what the records agree on — how deep the water finally went, the aisle that faced the sun, the carriage you always chose, your row, counted on your fingers.' });
      } });
    }
    this.interact(this._keyArch, { prompt: 'the spare key', once: true, enabled: false, onInteract: () => { this._keyArch.visible = false; this.giveItem({ id: 'spare-key', name: 'the spare key, cold now' }); this.setObjective('the box, in the box room'); } });
    this.interact(this._photoArch, { prompt: 'the photograph', once: true, enabled: false, onInteract: () => { this._photoArch.visible = false; this.giveItem({ id: 'photo', name: 'a photograph, two figures' }); this.setObjective('the box, in the box room'); } });

    // ---- the box room: the label, the box ----
    this.interact(this._label, { prompt: 'the label', onInteract: () => {
      if (this._strikes >= 2) return;
      this._strikes++;
      this._labelTex.redraw({ strikes: this._strikes });
      this.playSound('paper');
      this.subtitle(this._strikes === 1 ? 'You cross it out. It was hers to give, not yours to keep.' : 'And once more, for whoever is small next.', 5);
      this._checkReady();
    } });
    this.interact(this._theBox, { prompt: 'the box', onInteract: () => {
      const put = (id, key, mesh) => { if (this.hasItem(id) && !this._have[key]) { this.removeItem(id); this._have[key] = true; mesh.visible = true; this.playSound('paper'); return true; } return false; };
      if (put('photo', 'photo', this._photoIn) || put('ribbon', 'ribbon', this._ribbonIn) || put('spare-key', 'key', this._keyIn)) { this._checkReady(); return; }
      this.subtitle(this._ready ? 'It is ready.' : 'Empty. It has been kept empty a long time. It is waiting for three things.', 5);
    } });

    // ---- the shaft ----
    this._wireShaft();
  }

  _checkReady() {
    if (this._ready || this._strikes < 2 || !(this._have.photo && this._have.ribbon && this._have.key)) return;
    this._ready = true;
    this.playSound('clue');
    this.subtitle('It is ready. It will be found under the house, in a room that does not exist yet.', 6);
    this.setObjective('down, two flights below');
  }
```

- [ ] **Step 4: Wire the shaft — the loop, W, the lights, the chalk, the approach, the way out**

```js
  _wireShaft() {
    // the stub cords
    for (const f of [3, 4, 5]) {
      const st = this._stub[f];
      this.interact(st.cord, { prompt: 'the cord', onInteract: () => {
        st.on = !st.on; this.playSound('switch');
        st.light.intensity = st.on ? 4 : 0; st.plane.material.emissiveIntensity = st.on ? 1.2 : 0;
      } });
      this.interact(this._fireDoors[f], { prompt: 'the fire door', onInteract: () => {
        if (this._fireDoors[f].isOpen()) return;
        this.playSound('unlock'); this._fireDoors[f].setOpen(true, 1); this.removeBlocker(this._stubBlockers[f]); this.playSound('door');
      } });
    }
    this.interact(this._fireDoors[1], { prompt: 'the fire door', onInteract: () => { this.playSound('locked'); this.subtitle('Locked. Through the glass, a corridor with every light off.', 5); } });
    this.interact(this._fireDoors[2], { prompt: 'the fire door', onInteract: () => { this.playSound('locked'); this.subtitle('Locked. Someone has stacked chairs against the other side.', 5); } });
    // the chalk
    this.interact(this._chalkPlane, { prompt: 'the wall', onInteract: () => {
      if (!this._chalkWritten) {
        this._chalkWritten = true; this._tally = 1;
        this._chalk.redraw({ tally: 1, lines: ['wait for me'] });
        this.playSound('clue');
        this.subtitle('You write it, in an adult hand. It is the only hand it could have been in.', 6);
        this.game.interaction.setPrompt(this._chalkPlane, 'the chalk');
        this.setObjective('wait for me');
      } else if (this._loops > this._tally - 1) {
        this._tally++; this._redrawChalk(); this.playSound('clue'); this.subtitle('One more. You keep count for it.', 4);
      } else this.subtitle('wait for me. and a count, so far.', 3);
    } });
    // the wardrobe's back
    this.interact(this._wardrobeBack, { prompt: 'the back of a wardrobe', onInteract: () => {
      if (this._approach !== 'done') { this.subtitle('The back of a wardrobe. It is not your way yet.', 4); return; }
      if (!this._exitOpen) { this._exitOpen = true; this._wardrobeBack.setOpen(true, -1); this.removeBlocker(this._wbBlocker); this.playSound('door'); }
    } });

    // the per-frame machinery
    this.tick((dt) => {
      const p = this.game.player.position, footY = p.y - 1.62;
      this._inShaft = this.hours.is('night') && p.x < -1.25 && p.z > ZS.s0 - 0.2 && p.z < ZS.n1 + 0.2;
      if (!this._inShaft) { this._wMesh.visible = false; return; }
      if (this._exitOpen && !this.isCompleted && p.z > 3.3 && p.y > LAND_Y) this.complete();
      // the loop
      if (this._approach !== 'done' && footY < LOOP_FOOT && p.x < FLIGHT.x1 && p.x > FLIGHT.x0 && p.z > ZS.n0) {
        this.game.player.teleport(p.x, p.z, this.game.player.yaw, footY + LOOP_UP);
        this._loops++;
        this._loopCheck();
        if (this._loops === 1) this.setObjective('one door closer each time round');
        return;
      }
      // W
      if (footY > LANDINGS[3][1] + 0.3 && this._approach !== 'fixed' && this._approach !== 'done') { this._wMesh.visible = false; return; }   // above −1: not yet
      this._updateW(dt);
      // stillness → the approach
      const v = this.game.player.velocity ? Math.hypot(this.game.player.velocity.x, this.game.player.velocity.z) : 0;
      if (this._approach === null && this._correct >= 2 && this._chalkWritten && footY <= -9.0) {
        this._still = v < 0.05 && !this.game.ui.modalOpen ? this._still + dt : 0;
        if (this._still >= 5) this._startApproach();
      }
      if (this._approach === 'fixed') this._runApproach(dt, v);
    });
  }

  _redrawChalk() {
    const lines = ['wait for me']; if (this._pleaded >= 1) lines.push('please');
    this._chalk.redraw({ tally: Math.min(this._tally, 12), lines });
  }

  _loopCheck() {
    const k = this._loops - 1;
    const lit = [3, 4, 5].filter((f) => this._stub[f].on);
    const want = k === 0 ? 5 : k === 1 ? 4 : 3;
    const right = lit.length === 1 && lit[0] === want;
    const wpos = this._wMesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    if (right && k < 2) {
      this._correct++;
      this.playSoundAt('hummed', wpos, { notes: LevelBase.tune('EG'), small: true }); this.cue('it hums', wpos);
    } else if (!right) {
      this._pleaded++; if (this._chalkWritten) this._redrawChalk();
      this._hurry = 3.0; this.cue('it hurries', wpos);
    }
  }

  // W: one floor above you on the stair path, always.
  _projectOnPath(p) {                                              // → { s, pos } nearest point along the polyline
    let best = { d: Infinity, s: 0, pos: this._path[0].clone() }, acc = 0;
    const a = new THREE.Vector3(), ab = new THREE.Vector3(), ap = new THREE.Vector3();
    for (let i = 0; i < this._path.length - 1; i++) {
      a.copy(this._path[i]); ab.subVectors(this._path[i + 1], a); ap.subVectors(p, a);
      const len = ab.length(), t = len > 0 ? Math.max(0, Math.min(1, ap.dot(ab) / (len * len))) : 0;
      const q = a.clone().addScaledVector(ab, t); const d = q.distanceTo(p);
      if (d < best.d) best = { d, s: acc + t * len, pos: q };
      acc += len;
    }
    return best;
  }
  _pointAt(s) {
    let acc = 0;
    for (let i = 0; i < this._path.length - 1; i++) {
      const len = this._path[i].distanceTo(this._path[i + 1]);
      if (s <= acc + len) return this._path[i].clone().lerp(this._path[i + 1], len > 0 ? (s - acc) / len : 0);
      acc += len;
    }
    return this._path[this._path.length - 1].clone();
  }
  _updateW(dt) {
    const pl = this.game.player, p = pl.position, foot = new THREE.Vector3(p.x, p.y - 1.62, p.z);
    if (this._approach === 'fixed' || this._approach === 'done') return;            // W stands; _runApproach moves it
    const here = this._projectOnPath(foot);
    const sW = Math.max(0, here.s - this._floorLen);
    const wp = this._pointAt(sW);
    const ahead = this._pointAt(Math.min(sW + 0.3, here.s));
    this._wMesh.position.copy(wp); this._wMesh.visible = true;
    this._wMesh.faceToward(ahead);
    const v = pl.velocity ? Math.hypot(pl.velocity.x, pl.velocity.z) : 0;
    const rate = this._hurry > 0 ? 0.3 : 0.5;
    if (this._hurry > 0) this._hurry -= dt;
    this._stepT = (this._stepT ?? 0) + dt;
    if (v > 0.5 || this._hurry > 0) {
      if (this._stepT >= rate) { this._stepT = 0; this.playSoundAt('smallStep', wp.clone().add(new THREE.Vector3(0, 0.1, 0))); if (!this._wCued) { this._wCued = true; this.cue('small footsteps, above you', wp); } }
      this._lastMoving = 0;
    } else if (this._lastMoving !== undefined && this._lastMoving < 0.5) {
      this._lastMoving += dt;                                                        // one more step after you stop
      if (this._lastMoving >= 0.5) this.playSoundAt('smallStep', wp.clone().add(new THREE.Vector3(0, 0.1, 0)));
    }
    // climbing toward it: it climbs away; say so now and then
    this._climb = (here.s < (this._lastS ?? here.s) - 0.01) ? this._climb + dt : 0;
    this._lastS = here.s;
    if (this._climb > 2 && !(this._climbSaidAt > performance.now() - 20000)) { this._climbSaidAt = performance.now(); this.subtitle('It stops, above you. It will come no closer than that.', 4); }
  }

  _startApproach() {
    this._approach = 'fixed';
    // the landing among L3–L5 nearest to W's height
    const wy = this._wMesh.position.y;
    let f = 3; for (const g of [4, 5]) if (Math.abs(LANDINGS[g][1] - wy) < Math.abs(LANDINGS[f][1] - wy)) f = g;
    this._approachFloor = f;
    const y = LANDINGS[f][1], mainCx = (MAIN.x0 + MAIN.x1) / 2;
    this._wTarget = new THREE.Vector3(mainCx, y, (ZS.s0 + ZS.s1) / 2);
    this._approachBlocker = this.addBlocker([FLIGHT.x1 - 0.56, y - 0.6, ZS.s0], [FLIGHT.x1, y + 2.2, ZS.s1]);   // the top two steps of the south flight below the landing
    this.hush(2);
    this.subtitle('It has stopped, above you, in front of a door. It is waiting to see what you do.', 6);
    this.setObjective('up to it. two metres short.');
    this._breathed = false; this._moved = 0;
  }

  _runApproach(dt, v) {
    const w = this._wMesh, p = this.game.player.position;
    // W walks to its landing centre and faces its door (+X)
    const d = w.position.distanceTo(this._wTarget);
    if (d > 0.05) { w.position.lerp(this._wTarget, Math.min(1, dt * 0.8 / Math.max(d, 0.01))); w.faceToward(this._wTarget); }
    else w.rotation.y = Math.PI / 2;                                  // facing +X
    if (v > 0.3 && !this._breathed) { this._moved += dt; if (this._moved > 1.0) { this._cancelApproach(); return; } } else this._moved = 0;
    const head = new THREE.Vector3(p.x, p.y, p.z), wHead = w.position.clone().add(new THREE.Vector3(0, 1.0, 0));
    if (!this._breathed && head.distanceTo(wHead) < 2.8 && head.y < wHead.y + 0.6) {
      this._breathed = true;
      this.playSound('breath'); this.hush(3); this.flinch({ flash: 0 });
      this.after(1, () => this._openForIt());
    }
  }

  _cancelApproach() {
    this._approach = null; this._still = 0;
    this.removeBlocker(this._approachBlocker);
    this.subtitle('It goes on. It will stop again when you do.', 4);
  }

  _openForIt() {
    const f = this._approachFloor, door = this._fireDoors[f], st = this._stub[f];
    this.playSound('unlock'); door.setOpen(true, 1); this.removeBlocker(this._stubBlockers[f]); this.playSound('door');
    st.on = true; st.light.intensity = 4; st.plane.material.emissiveIntensity = 1.2;
    const from = this._wMesh.position.clone(), to = new THREE.Vector3(3.5, st.y, 0.9);
    this.footsteps([from, to], { every: 0.45, opts: { soft: true }, onStep: (i, pos) => { this._wMesh.position.copy(pos); this._wMesh.faceToward(to); }, onDone: () => { this._wMesh.visible = false; } });
    this.subtitle('The door beside it gives, and it goes through, and does not look back. You did not want it to.', 6);
    this._approach = 'done';
    this.removeBlocker(this._approachBlocker);
    this.setObjective('up. the back of the wardrobe.');
  }
```

`this.game.player.velocity` is the Player's planar velocity vector
(`src/core/Player.js:16`); Level12 reads stillness exactly this way
(`Math.hypot(pl.velocity.x, pl.velocity.z)` — see `Level12.js`, its shaft
ticker).

- [ ] **Step 5: The real `debugSolve()`**

```js
  async debugSolve() {
    const pl = this.game.player;
    const t = (x, z, yaw, y) => pl.teleport(x, z, yaw, y);
    t(0, 0.5, 0, LAND_Y);
    this.debugInteract(this._clockBody); await this.debugWait(1.9);                 // → morning
    this.debugInteract(this._airDoor); await this.debugWait(0.3);
    for (let k = 0; k < 6; k++) {                                                   // cards 1–6, through 'the house'
      this.debugInteract(this._trayMesh); await this.debugWait(0.2); this.game.ui.closeModal();
      this.debugInteract(this._boxes[CARDS[k][0]].mesh); await this.debugWait(0.2);
    }
    this.debugInteract(this._keyArch); await this.debugWait(0.2);
    this.debugInteract(this._photoArch); await this.debugWait(0.2);
    this.debugInteract(this._clockBody); await this.debugWait(1.9);                 // → evening
    this.debugInteract(this._bathDoor); await this.debugWait(0.3);
    this.debugInteract(this._ribbon); await this.debugWait(0.2);
    this.debugInteract(this._boxDoor); await this.debugWait(0.3);
    this.debugInteract(this._label); await this.debugWait(0.2); this.debugInteract(this._label); await this.debugWait(0.2);
    for (let i = 0; i < 3; i++) { this.debugInteract(this._theBox); await this.debugWait(0.2); }
    this.debugInteract(this._clockBody); await this.debugWait(1.9);                 // → night
    this.debugInteract(this._airDoor); await this.debugWait(0.3);                   // the shaft
    const mainCx = (MAIN.x0 + MAIN.x1) / 2;
    t(mainCx, 0.25, Math.PI / 2, LANDINGS[3][1]);                                   // L3
    await this.debugWait(0.3);
    t(2.8, 0.9, 0, LANDINGS[5][1]); this.debugInteract(this._stub[5].cord); await this.debugWait(0.2);   // −3 lit
    t(-4.5, 1.55, -Math.PI / 2, LOOP_FOOT - 0.5); await this.debugWait(0.4);       // the loop point → up; correct 1
    t(2.8, 0.9, 0, LANDINGS[5][1]); this.debugInteract(this._stub[5].cord); await this.debugWait(0.2);   // off
    t(2.8, 0.9, 0, LANDINGS[4][1]); this.debugInteract(this._stub[4].cord); await this.debugWait(0.2);   // −2 lit
    t(-4.5, 1.55, -Math.PI / 2, LOOP_FOOT - 0.5); await this.debugWait(0.4);       // correct 2
    t(mainCx, 0.0, 0, LANDINGS[4][1]); this.debugInteract(this._chalkPlane); await this.debugWait(0.2);   // 'wait for me'
    t(mainCx, 0.9, Math.PI / 2, LANDINGS[4][1]);                                    // still on L4; W stops on L3
    await this._waitFor(() => this._approach === 'fixed', 8);
    t(-4.3, 0.25, -Math.PI / 2, LANDINGS[3][1] - 0.51);                             // three steps below L3 on the south flight
    await this._waitFor(() => this._approach === 'done', 6);
    t(mainCx, 1.55, 0, LAND_Y); this.debugInteract(this._wardrobeBack); await this.debugWait(0.3);
    t(mainCx, 3.6, 0, LAND_Y); await this.debugWait(0.6);
  }
```

- [ ] **Step 6: Verify**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 19 --port 5119 && node tools/playtest.mjs 19 --port 5219`
Expected: exit 0; `level 19: SOLVED in …s` (about 36 s). If the stillness
wait runs over, the still threshold is 5 s in `_wireShaft` — do not lower
it below 4.

- [ ] **Step 7: Commit**

```bash
git add src/levels/Level19.js
git commit -m "Add room XIX (The Stairs) — the archive filed, the box readied, XII's shaft with the roles swapped"
```

---

### Task 11: Room XX — The Room

**Files:**
- Create: `src/levels/Level20.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`Hours`, `makeFigure`, `makeChild`, `isSeen`/`whenSeen`, `hummed {small}`, `knock`, `lock`, `tick`, `wind`, `directionWord`).
- Produces: `Level20` (auto-discovered; the last room — after it `main.js` plays the EPILOGUE).

Spec: §5.5 — read all of it first, and Level11.js (this room rebuilds its
geometry; copy XI's shell numbers, not its wiring).

- [ ] **Step 1: Scaffold — XI's room, the stub, the landing, her room, the mirror room, the sleeper**

Create `src/levels/Level20.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeTable, makeChair,
  makePictureFrame, makeDust, applyFog,
} from '../core/props.js';
import { makeFigure, makeChild } from '../core/presence.js';
import { Hours } from '../core/hours.js';

// XX — The Room
// XI's bedroom from the other side: the child asleep two metres away, the
// evening showing how she left it, the morning's slip saying it in words.
// Set the room, stop the clock at 3:07, go out, lock the door, answer the
// knocks, and leave the last light on.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.5

const W = 4.2, D = 3.6, H = 2.5;                       // XI's interior; origin at the centre; +Z is the door wall
const DOOR_POS = { x: 1.2, y: 1.2, z: 1.8 };
const MIRROR = { x: -2.08, y: 1.4, z: 0.95 };
const CLOCK_POS = { x: 1.6, y: 0.86, z: -0.05 };
const KNOCK_IN = { x: 2.05, y: 1.3, z: 0.9 };          // inside the room (XI's E2)
const KNOCK_OUT = { x: 2.12, y: 1.3, z: 0.9 };         // its back, on the landing
const SWITCH = { x: 0.6, y: 1.3, z: 3.09 };
const HOOK = { x: 3.28, y: 1.3, z: -0.3 };
const HUM4 = LevelBase.tune('EGAG');
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level20 extends LevelBase {
  static meta = {
    id: 20,
    numeral: 'XX',
    title: 'The Room',
    mood: 'night',
    grade: GRADE,
    intro: 'Its room. Your room. It is asleep, and the door is shut, and you have come in the long way.',
    outro:
      'You left it how she left it, and shut the door, and knocked, and left the light on.\n' +
      'Then you went to bed, the way she did,\n' +
      'and slept, for once, without dreaming.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    this._wound = false;
    this._done = { chair: false, sheet: false, wound: false, note: false };
    this._stir = 0; this._stirNeed = 0; this._wakes = 0; this._waking = false;
    this._clockStopped = false; this._clockWrong = 0;
    this._out = false; this._doorShut = false; this._locked = false;
    this._answered = false; this._lightOn = true; this._lightStage = 0;
    this._holdStill = 0;

    this._buildRoom();          // XI's shell + stars + furniture, per hour
    this._buildStub();          // the concrete way in (night)
    this._buildLanding();       // the corridor + east leg + her room + the switch + the hook + the knock spots
    this._buildMirror();        // the pane, the mirror room, the figure
    this._buildSleeper();       // the mound, the head, the seated child (evening)
    this._buildClock();
    this._bindLook({ x: -0.6, y: 1.5, z: -1.79 }, { x: -3, y: 6, z: -8 });
    this._wirePuzzle();

    this.spawn.position.set(-0.55, 0, 3.0);
    this.spawn.yaw = 0;                                    // facing the back panel
    this.bounds = new THREE.Box3(new THREE.Vector3(-2.1, 0, -2.5), new THREE.Vector3(6.4, 3, 4.6));
    this.setObjective('yours always last');

    this.hours.start();
    this.track(this.hours);
  }

  // (paste _box, _plane, _bindLook, _wind — replaced below — _wrongHourPlacing, _morningBox, _waitFor)

  _buildRoom() {
    // XI's shell, copied from Level11.js: wallpaper '#8d8378'/'#7f7468', carpet '#5a4e4c', plaster ceiling, the ~45 stick-on stars
    //   (night + evening; at the morning most are gone — bind two star groups: this._starsFull (night+evening), this._starsFew (morning, ~6 of them));
    // the window (north, x −0.6) with curtains; panes per hour as before; rain? no — the arc's weather is still: skip the rain loop;
    // the door this._door (makeDoor '#5a4636') at (1.2, 0, 1.8) — a doorway blocker this._doorBlocker = addBlocker([0.6, 0, 1.7], [1.8, 2.2, 1.9]) while shut;
    // the wardrobe (south wall, x −1.05..−0.05): two front doors (shut, decorative), coats, and the back panel this._backPanel (makeDoor '#7a5a3a', knob: false) at (−0.55, 0, 1.79), tracked;
    //   a blocker this._wbBlocker = addBlocker([−1.0, 0, 1.7], [−0.1, 2.2, 1.9]) until it opens;
    // the bed along the west wall (frame, mattress, pillow at the north end); the desk (east) with the drawer front this._drawer, the lamp this._deskLamp (PointLight 0xffd9a8, 0, 6 — bound evening 3.2, and used by the WAKE state);
    // this._chairN (night: at the desk turned to face the bed) / this._chairE (evening: facing the desk) — two chair groups bound by hour;
    // this._musicBox (a small box 0.14 × 0.08 × 0.1 '#7a5a3a' on the shelf above the desk; all hours except morning);
    // this._sheetFold (a folded box 0.62 × 0.2 × 0.1 at the bed's foot, night, until used) and this._sheetOnMirror (XI's 0.62 × 0.95 × 0.03 over the mirror: evening always; night once placed);
    // this._drawerNoteEvening (a note prop half out of the drawer, evening);
    // the morning: bare bed (a stripped frame), the box this._keepBox = _morningBox('SMALL — keep', 0, −0.5, …) with this._noteInBox (interactable once the box is opened), pale walls.
  }

  _buildStub() {
    // night only (objects + colliders bound): concrete floor x −1.05..−0.05, z 1.8..3.3 (ground), concrete walls, ceiling at 2.3, a dark doorway at z 3.3 with a blocker;
    // the concrete wall at x −0.05..0.05, z 1.8..3.1 stands at EVERY hour (this._concreteWall, addCollider) — interact → 'Concrete, where the landing should go on.'
  }

  _buildLanding() {
    // all hours: floor x 0.15..3.0, z 1.8..3.1 (ground) + east leg x 2.1..3.3, z −1.8..1.8 (ground), ceiling 2.5, walls;
    // this._landBulb makeBulbLight({ color: 0xffd2a0, intensity: 3.5, distance: 8, y: 2.4 }) at (1.6, 0, 2.45) — NOT hour-bound: it is on at every hour (the light that is left on); the WAKE/dark states drive it directly;
    // this._switch a small box at SWITCH on the south wall;
    // the stairs down: three treads descending south from (2.6, 0, 3.1), a stub, a blocker at z 4.4; interact plane → 'Down. Not yet.';
    // her door this._herDoor (makeDoor '#4f3d2e') at (3.3, 0, −1.0), rotation.y = −π/2, blocker this._herBlocker; her room beyond: x 3.3..6.3, z −2.4..0.0 (floor ground, walls, a bed this._herBed, a chair, the window (fireflies at night), the photograph frame on the bedside);
    // the hook (a small cylinder at HOOK) with this._keyOnHook (makeKeyProp);
    // three knock spots this._k1/this._k2/this._k3: faint planes 0.5 × 0.5 (XI's material recipe: 0x1a1612, transparent, opacity 0.12) at (2.12, 1.3, −1.4 / −0.3 / +0.9) facing +X, prompt 'knock', enabled: false until the lock;
    // the morning: the room door stands open onto the landing and the landing beyond the east leg is white (a white plane + morning blocker at z 2.0 of the east leg? no — keep the landing walkable at every hour; only her door is white at the morning: a white plane behind it).
  }

  _buildMirror() {
    // the mirror room: a box cavity behind the west wall, x −4.3..−2.1, z 0.45..1.45, y 0.9..1.9: walls 0x1a1c24, a PointLight(0x6c7ea8, 0.5, 3) inside at (−3.2, 1.55, 0.95);
    // this._mirror: a plane 0.5 × 0.8 at MIRROR facing +X, MeshStandardMaterial({ color: 0x0a0b0e, metalness: 1, roughness: 0.05, transparent: true, opacity: 0.55 });
    // this._figure = makeFigure(); this._figure.visible = false; add it inside the mirror room.
  }

  _buildSleeper() {
    // night: this._mound (a box 0.8 × 0.22 × 1.3 '#8a7468' on the bed) + this._head (SphereGeometry(0.085), 0x9a8c80) on the pillow; a ticker breathes them (scale.y 1 ± 0.03 at 0.25 Hz) and a 'breath' at the head every 4 s (gain via opts? 'breath' has fixed gain — distance does the softening);
    // evening: this._childSeated = makeChild() posed sitting on the bed's edge (position (−1.35, 0.25, −0.2), facing the desk lamp) — bound 'evening'.
  }

  _buildClock() {
    this._clockMat = new THREE.MeshStandardMaterial({
      map: textTexture({ text: '3:07', font: 'bold 60px monospace', color: '#ff7a5a', bg: '#140c0a', width: 256, height: 128 }),
      emissive: 0xff6a4a, emissiveIntensity: 0.9,
    });
    this._clock = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), this._clockMat);
    this._clock.position.set(CLOCK_POS.x, CLOCK_POS.y, CLOCK_POS.z);
    this._clock.rotation.y = -Math.PI / 2;
    this.add(this._clock);
    this.interact(this._clock, { prompt: 'the clock', onInteract: () => this._flip() });
  }

  _setClock(text) {
    this._clockMat.map?.dispose();
    this._clockMat.map = textTexture({ text, font: 'bold 60px monospace', color: '#ff7a5a', bg: '#140c0a', width: 256, height: 128 });
    this._clockMat.needsUpdate = true;
  }

  _flip() {
    if (this._clockStopped || this.hours.changing || this._waking) return;
    if (this.hours.is('night')) {
      const ok = this._done.chair && this._done.sheet && this._done.wound && this._done.note;
      if (!ok) {
        this._clockWrong++;
        this.playSound('tick');
        this.subtitle(this._clockWrong >= 2 ? 'Half past eight shows you how she left it.' : 'Not yet. It isn\'t how she left it.', this._clockWrong >= 2 ? 5 : 4);
        // it still flips the hour — the player may need the other hours
        this._advance();
        return;
      }
      this._stop();
      return;
    }
    this._advance();
  }

  _advance() {
    this.playSound('tick'); this.playSound('tick'); this.playSound('tick');
    this._setClock({ night: '7:15', morning: '8:30', evening: '3:07' }[this.hours.current]);
    this.hours.next();
    if (!this._wound) { this._wound = true; this.subtitle('The digits flip. They never did, before.', 5); this.setObjective('how she left it, at another hour'); }
  }

  _stop() {
    this._clockStopped = true;
    this.playSound('tick');
    this.subtitle('It stops. 3:07. It will be 3:07 for as long as anyone remembers.', 6);
    this.setObjective('out. shut the door.');
  }

  _wirePuzzle() { /* Step 3 */ }

  async debugSolve() {
    this.game.player.teleport(4.8, -1.2);
    await this.debugWait(0.6);
  }
}
```

(The scaffold's `_flip`/`_advance` replace the shared `_wind` — XX's clock
is digital; there is no `makeClockFace` here and no `wind` ratchet, just
three `tick`s.)

- [ ] **Step 2: Build, screenshot at all three hours, iterate**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 20 --port 5120 && node tools/screenshot.mjs 20 --port 5120 --hour morning && node tools/screenshot.mjs 20 --port 5120 --hour evening`
Expected: exit 0. The spawn shot: the concrete stub with the panel ahead.
Note the spawn is in the night-only stub: check the other hours from inside
the room (in a browser, teleport to (0, 0.5) first). The evening: the child
reading, the lamp; the morning: the bare room and the box.

- [ ] **Step 3: Wire the puzzle**

```js
  _wirePuzzle() {
    const pl = this.game.player;

    // ---- the way in ----
    this.interact(this._backPanel, { prompt: 'through', once: true, onInteract: () => {
      this._backPanel.setOpen(true, 1);
      this.removeBlocker(this._wbBlocker);
      this.playSound('door');
      this.setObjective('how she left it');
      this.whenUnseen(this._backPanel, () => { this._backPanel.setOpen(false); this.playSoundAt('door', { x: -0.55, y: 1, z: 1.79 }); });
    } });
    this.interact(this._concreteWall, { prompt: 'the wall', onInteract: () => this.subtitle('Concrete, where the landing should go on.', 4) });

    // ---- the glass ----
    this.whenSeen(this._mirror, () => {
      if (!this.hours.is('night') || this._done.sheet) return;
      this._glassSeen = true;
      this.flinch(); this.hush(2);
      this.subtitle('In the glass, where you should be, something stands a little too tall, with no face. You always kept it covered. You were right to.', 7);
    }, { minTime: 0.5 });
    this.tick(() => {                                            // the reflection tracks you
      const p = pl.position;
      const show = this.hours.is('night') && !this._done.sheet
        && p.x > MIRROR.x && p.x < 0.6 && p.z > -0.2 && p.z < 2.1;
      this._figure.visible = show;
      if (show) {
        this._figure.position.set(2 * MIRROR.x - p.x, 0, p.z);
        this._figure.faceToward(p);
      }
    });
    this.interact(this._mirror, { prompt: 'cover it', onInteract: () => {
      if (!this.hours.is('night')) { this.subtitle('Hers. Leave it. Yours is on the bed, at 3:07.', 4); return; }
      if (this._done.sheet) return;
      if (!this._sheetHeld) { this.subtitle('The glass. You need the sheet from the bed\'s foot.', 4); return; }
      this._sheetHeld = false; this.removeItem('sheet');
      this._sheetOnMirror.visible = true; this._done.sheet = true;
      this.playSound('paper');
      this.subtitle('Covered. You were right to.', 4);
    } });
    this.interact(this._sheetFold, { prompt: 'the sheet', once: true, onInteract: () => {
      this._sheetFold.visible = false; this._sheetHeld = true;
      this.giveItem({ id: 'sheet', name: 'the sheet, folded' });
    } });

    // ---- the four settings ----
    this.interact(this._chairN, { prompt: 'the chair', onInteract: () => {
      if (this._done.chair) { this.subtitle('At the desk, facing the desk. As she left it.', 3); return; }
      this._done.chair = true;
      this._chairN.rotation.y += Math.PI * 0.85; this._chairN.position.z -= 0.15;
      this.playSoundAt('door', { x: 1.4, y: 0.4, z: -0.4 });
      this._noise(1);
    } });
    this.interact(this._musicBox, { prompt: 'wind it', onInteract: () => {
      if (!this.hours.is('night')) { this.subtitle('Hers. Leave it.', 3); return; }
      if (this._done.wound) { this.subtitle('Wound. It will play when nobody is looking. It always did.', 4); return; }
      this._done.wound = true;
      this.playSoundAt('wind', { x: 1.5, y: 1.6, z: -0.5 }, { clicks: 6, gap: 0.09 });
      this._noise(2);
      this.whenUnseen(this._musicBox, () => {
        this.playSoundAt('musicbox', { x: 1.5, y: 1.6, z: -0.5 }, { notes: HUM4, slow: 0.15, holdSeconds: 6 });
        this.cue('a music box', new THREE.Vector3(1.5, 1.6, -0.5));
      });
    } });
    this.interact(this._drawer, { prompt: 'the drawer', onInteract: () => {
      if (!this.hours.is('night')) { this.subtitle('Hers. Leave it.', 3); return; }
      if (this._done.note) { this.subtitle('The note is in it, older than the others.', 3); return; }
      if (!this.hasItem('note-xi')) { this.subtitle('Empty. Something is missing from it — something older than the others.', 5); return; }
      this.removeItem('note-xi');
      this._done.note = true;
      this.playSound('paper');
      this._noise(1);
    } });

    // ---- the morning box ----
    // _morningBox('SMALL — keep', 0, -0.5, …) built in _buildRoom; its onOpen:
    //   first time: learnClue { id: 'l20-slip', title: 'the slip in the box, in her hand', body: 'SMALL — keep. music box (wind it). the sheet — the mirror. the note — the drawer. the chair to the desk. don\'t let it see the glass.' }
    //   and make this._noteInBox visible + enabled; later times: subtitle 'Stick-on stars, in a bag. Forty-five. You count them without meaning to.' (5 s)
    this.interact(this._noteInBox, { prompt: 'a note, older than the others', once: true, enabled: false, onInteract: () => {
      this._noteInBox.visible = false;
      this.giveItem({ id: 'note-xi', name: 'a note, older than the others' });
      this.giveNote({
        id: 'l20-note', title: 'a note, older than the others',
        body:
          'when you couldn\'t sleep I knocked on the wall\n' +
          'and you knocked back.\n\n' +
          'two for "still there".\n' +
          'three for "come and find me".\n\n' +
          '— M.',
      });
    } });

    // ---- the sleeper and the stir ----
    this.tick((dt) => {
      if (!this.hours.is('night') || this._waking || this._out) { this._stirNeed = 0; return; }
      const v = Math.hypot(pl.velocity.x, pl.velocity.z);
      this._stir = Math.max(0, this._stir - dt / 10);
      if (this._stirNeed > 0) {
        if (v < 0.05) { this._holdStill += dt; if (this._holdStill >= 3) { this._stirNeed = 0; this._stir = 0; this.subtitle('It turns over, and settles.', 4); } }
        else if (v > 0.3) { this._wake(); }
      }
    });

    // ---- the door, out, the lock ----
    this.interact(this._door, { prompt: 'the door', onInteract: () => {
      if (this.hours.is('night') && !this._clockStopped) { this.playSound('locked'); this.subtitle('Shut. Leave it shut until the clock has stopped.', 4); return; }
      if (!this.hours.is('night')) { this.subtitle('Open, at this hour. Leave it.', 3); return; }
      if (!this._doorOpen && !this._doorShut) { this._doorOpen = true; this._door.setOpen(true, -1); this.removeBlocker(this._doorBlocker); this.playSound('door'); return; }
      if (this._doorOpen && pl.position.z > 1.9) {               // from outside: shut it
        this._doorOpen = false; this._doorShut = true;
        this._door.setOpen(false); this.playSound('door');
        this.after(0.8, () => { this._doorBlocker = this.addBlocker([0.6, 0, 1.7], [1.8, 2.2, 1.9]); });
        return;
      }
      if (this._doorShut && !this._locked) {
        if (!this.hasItem('little-key')) { this.playSound('locked'); this.subtitle('Shut. It wants locking, and the little key is not in your hand.', 4); return; }
        this.removeItem('little-key');
        this._locked = true;
        this.playSound('lock');
        this.subtitle('Locked, from the other side. You never shut the door. Tonight you do, so that it goes the long way round, the way you did, and finds the same things.', 7);
        this.setObjective('listen');
        this.hush(1.5);
        const hum = () => { if (this._answered) return; this.playSoundAt('hummed', KNOCK_IN, { notes: HUM4, small: true, holdSeconds: 6 }); this.cue('humming, through the wall', new THREE.Vector3(KNOCK_IN.x, KNOCK_IN.y, KNOCK_IN.z)); this._humT = this.after(8, hum); };
        this.after(1.5, hum);
        for (const k of [this._k1, this._k2, this._k3]) this.game.interaction.setEnabled(k, true);
      }
    } });
    this.interact(this._keyOnHook, { prompt: 'the little key', once: true, onInteract: () => {
      this._keyOnHook.visible = false;
      this.giveItem({ id: 'little-key', name: 'the little key' });
      this.subtitle('The little key. On its hook, where she kept it. You take it.', 5);
    } });

    // ---- the knocks ----
    const spot = (mesh, right) => this.interact(mesh, { prompt: 'knock', enabled: false, onInteract: () => {
      if (this._answered) return;
      const p = mesh.getWorldPosition(new THREE.Vector3());
      this.playSoundAt('knock', p, { count: 3 });
      if (!right) {
        this.after(3, () => { if (!this._answered) this.subtitle('Nothing. The humming goes on, ' + this.directionWord(new THREE.Vector3(KNOCK_OUT.x, KNOCK_OUT.y, KNOCK_OUT.z)) + '.', 5); });
        return;
      }
      this._answered = true;
      clearTimeout(this._humT);
      this.after(0.8, () => {
        this.playSoundAt('knock', KNOCK_IN, { count: 2, soft: true });
        this.cue('two knocks', new THREE.Vector3(KNOCK_IN.x, KNOCK_IN.y, KNOCK_IN.z));
        this.subtitle('Two. Still there.', 4);
      });
      this.after(2.0, () => {
        this.playSoundAt('knock', p, { count: 2 });
        this.subtitle('Still there. It will go on dreaming now.', 5);
        this.setObjective('the last light');
        this._lightStage = 1;
      });
    } });
    spot(this._k1, false); spot(this._k2, false); spot(this._k3, true);

    // ---- the last light, her room, the bed ----
    this.interact(this._switch, { prompt: 'the landing light', onInteract: () => {
      if (this._lightStage < 1) { this.subtitle('The landing light. On. It stays on until everything else is done.', 4); return; }
      if (this._lightOn) {
        this._lightOn = false;
        this.playSound('clunk');
        this._landBulb.light.intensity = 0;
        this.dread(0.3);
        this.playSoundAt('hummed', KNOCK_IN, { notes: [LevelBase.NOTES.E], small: true });
        this.subtitle('Dark. The whole house, dark, and something small in it. You know what that is like.', 6);
      } else {
        this._lightOn = true;
        this.playSound('switch');
        this._landBulb.light.intensity = 3.5;
        this.dread(0);
        this.subtitle('You leave it on. You know now why she did.', 5);
        this.setObjective('bed');
        this._lightStage = 2;
      }
    } });
    this.interact(this._herDoor, { prompt: 'her door', onInteract: () => {
      if (this._lightStage < 2) { this.playSound('locked'); this.subtitle(this._lightOn ? 'Her room. Not yet.' : 'Not in the dark. Not for them.', 4); return; }
      if (!this._herDoor.isOpen()) { this._herDoor.setOpen(true, 1); this.removeBlocker(this._herBlocker); this.playSound('door'); }
    } });
    this.interact(this._herBed, { prompt: 'lie down', once: true, onInteract: () => {
      this.subtitle('You lie down, the way she did, and the light stays on.', 4);
      this.after(2.2, () => this.complete());
    } });
  }

  /** A noisy act: the sleeper stirs at 2. */
  _noise(n) {
    if (!this.hours.is('night')) return;
    this._stir += n;
    if (this._stir >= 2 && this._stirNeed === 0) {
      this._stirNeed = 1; this._holdStill = 0;
      this.playSoundAt('door', { x: -1.55, y: 0.5, z: -0.6 }, {});           // the bed creaks
      this._mound.rotation.z += 0.17;
      this.cue('it turns over', new THREE.Vector3(-1.55, 0.6, -0.6));
    }
  }

  _wake() {
    this._waking = true; this._stirNeed = 0; this._stir = 0; this._wakes++;
    this.playSoundAt('hummed', { x: -1.55, y: 0.7, z: -0.6 }, { notes: [LevelBase.NOTES.E], small: true });
    this.subtitle('It sits up. It is awake, and the hour is wrong, and you are not here yet.'
      + (this._wakes >= 2 ? ' Do one thing, and stand still, and then the next.' : ''), 6);
    this.hours.set('evening');
    this.after(25, () => {
      this.subtitle('It lies down. The lamp goes out. 3:07.', 4);
      this.hours.set('night');
      this.after(2, () => { this._waking = false; });
    });
  }
```

Note on the door state machine: opening happens from inside (the blocker
is removed so you can walk out); the same interact from outside (z > 1.9)
shuts it; the next one locks it with the key. The blocker returns 0.8 s
after shutting so the panel has swung before it becomes solid.

- [ ] **Step 4: The real `debugSolve()`**

```js
  async debugSolve() {
    const pl = this.game.player;
    this.debugInteract(this._backPanel); await this.debugWait(0.4);
    pl.teleport(-0.6, 1.0, Math.PI / 2);                       // in, facing the mirror wall → the glass
    await this.debugWait(0.9);
    this.debugInteract(this._clock); await this.debugWait(1.9);   // → morning
    this.debugInteract(this._keepBox); await this.debugWait(0.3);
    this.debugInteract(this._noteInBox); await this.debugWait(0.3); this.game.ui.closeModal();
    this.debugInteract(this._clock); await this.debugWait(1.9);   // → evening
    this.debugInteract(this._clock); await this.debugWait(1.9);   // → night
    this.debugInteract(this._chairN); await this.debugWait(0.2);
    await this.debugWait(3.2);                                     // stand still for the stir
    this.debugInteract(this._sheetFold); await this.debugWait(0.2);
    this.debugInteract(this._mirror); await this.debugWait(0.2);
    this.debugInteract(this._musicBox); await this.debugWait(0.2);
    await this.debugWait(3.2);
    this.debugInteract(this._drawer); await this.debugWait(0.2);
    this.debugInteract(this._clock); await this.debugWait(0.7);   // STOP
    this.debugInteract(this._door); await this.debugWait(0.5);    // opens
    pl.teleport(1.2, 2.5, Math.PI);                                // out on the landing
    this.debugInteract(this._door); await this.debugWait(1.0);    // shut
    this.debugInteract(this._keyOnHook); await this.debugWait(0.2);
    this.debugInteract(this._door); await this.debugWait(1.8);    // locked; the humming starts
    this.debugInteract(this._k3); await this.debugWait(2.6);      // three knocks → two back → your two
    this.debugInteract(this._switch); await this.debugWait(0.5);  // off
    this.debugInteract(this._switch); await this.debugWait(0.5);  // on — you leave it on
    this.debugInteract(this._herDoor); await this.debugWait(0.4);
    pl.teleport(4.8, -1.2);
    this.debugInteract(this._herBed);
    await this._waitFor(() => this.isCompleted, 4);
  }
```

- [ ] **Step 5: Verify**

Run: `npx vite build 2>&1 | tail -2 && node tools/screenshot.mjs 20 --port 5120 && node tools/playtest.mjs 20 --port 5220`
Expected: exit 0; `level 20: SOLVED in …s` (about 26 s).

- [ ] **Step 6: Commit**

```bash
git add src/levels/Level20.js
git commit -m "Add room XX (The Room) — XI set as she left it, the glass, the lock, the knocks, the last light"
```

---

### Task 12: README, the full-suite gate, final commit

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

Update the subtitle line to `*a dream in ten rooms — and, once you've woken,
five more — and five after*`; in the opening paragraph add one sentence
after the five-beneath sentence: `Years later the house comes back once
more — not for you — and the last five rooms put you on the other side of
every door, at three hours of the same night.` In "The rooms" add a short
paragraph: `Rooms XVI–XX exist at three hours — her evening, 3:07, and the
morning the house is emptied — and this time you leave the clues instead of
finding them. The clock in each room moves you between hours; only the
night counts.` In the README's hosting/env mentions nothing changes (Task 0
already fixed `docs/HOSTING.md`); update the room-count phrase in the
`## The dreamers` section if it names ten or fifteen.

- [ ] **Step 2: The full gates**

Run, in order:

```
npm test
npm run test:api
node tools/audiotest.mjs --port 5307
npx vite build
npm run playtest
```

Expected: unit tests pass; `all leaderboard checks passed`; `audio smoke
OK`; the build passes; **`20/20 levels solvable`** with zero browser
errors. Rooms I–XV must all still solve — if any regressed, the engine
tasks broke something; fix before this task completes.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Rooms XVI–XX complete — the five above; 20/20 solvable"
```

---

## Plan self-review (done at writing time)

- **Spec coverage:** §2 texts → Tasks 5, 7 (prologue), 11 (outro/epilogue
  path); §4.1 → Task 1; §4.2 → Task 2; §4.3 → Task 3; §4.4/§4.5 → Task 4;
  §4.6 → Tasks 0, 5, 6, 12; §5.1–§5.5 → Tasks 7–11; §6 → the verify steps
  and Task 12.
- **Deviations from the spec, decided here:** XIX's W is slaved one floor
  above the player (no moving blocker; it retreats when you climb) — the
  spec's §5.4 "The child, above" paragraph describes the same audible
  behaviour; the approach's fixed-W stage matches the spec. XX's clock
  flips even when the settings are incomplete (with the nudge), so the
  player can reach the other hours after a wrong try.
- **Type consistency:** `Hours.bind` field names (`objects`, `interact`,
  `lights`, `colliders`, `blockers`, `fog`, `grade`, `mood`, `loops`,
  `onEnter`, `onLeave`) are used identically in Tasks 3 and 7–11;
  `footsteps(points, { stride, every, sound, opts, onStep, onDone })` in
  Tasks 2, 7, 8, 9, 10; `makeChild().setTorch/faceToward/torch` in Tasks 4,
  9, 10, 11; `makeClockFace().setTime/update` in Tasks 4, 7, 8, 9; the item
  ids (`little-key`, `pan`, `spare-key`, `note-i`, `slippers`, `torch`,
  `ribbon`, `photo`, `card`, `sheet`, `note-xi`) are each defined and
  consumed within one room.
- **Budgets:** debugSolve estimates — XVI ≈ 11 s, XVII ≈ 28 s, XVIII ≈ 34 s,
  XIX ≈ 36 s, XX ≈ 26 s — all under the 40 s target with the 45 s harness
  cap; XVIII and XIX name which knob to trim if a slow machine runs over,
  and which never to trim.
