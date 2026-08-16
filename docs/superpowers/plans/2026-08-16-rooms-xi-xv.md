# Rooms XI–XV ("the five beneath") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five new rooms (XI–XV) after the Shore, plus the engine features they need — positional audio, new synthesized sounds, unseen-change helpers, a figure that follows the player — without breaking rooms I–X.

**Architecture:** The engine work lands first in the shared files (`src/core/*`, `src/main.js`, `index.html`, tools, docs), one task per subsystem, each verified by `node --test` where the code is pure and by the headless harness where it isn't. Then each room is one new file `src/levels/LevelNN.js` that touches nothing shared, so the five room tasks can run in parallel (one agent each, distinct ports). The full playtest suite (15/15) is the final gate.

**Tech Stack:** Three.js 0.170 + Vite 5, vanilla ES modules, WebAudio (synthesized only, no assets), Playwright-core headless Chromium for verification, `node:test` for pure logic.

**Spec:** `docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md` — every task below cites its section. Read the spec's §1.2 (scare contract), §4 (engine APIs) and the room's own §5.x before starting a task. Also read `docs/LEVEL_API.md` and `src/levels/Level01.js` (canonical room) and `src/levels/Level10.js` (a multi-act room) once.

## Global Constraints

- Room files (`src/levels/Level11.js` … `Level15.js`) import only from `three`, `../core/LevelBase.js`, `../core/textures.js`, `../core/props.js`, `../core/presence.js`, and never edit shared files. (Spec §4, §4.7.)
- Rooms I–X are not modified. `Level10`'s outro stays as written. (Spec §1.3.)
- Scare contract, spec §1.2: no game-over, nothing chases, no jump-scares, the figure is never lit and never closer than about two metres, every hearing-dependent step has a sighted fallback, puzzles solvable from in-room clues.
- Writing: lowercase objectives, second person, restrained; notes signed `— M.`; wrong attempts play `wrong` (or the in-world equivalent the spec names) and give the quoted nudge. Use the spec's texts verbatim.
- All new audio APIs are no-ops before `AudioEngine.init()` (`_started === false`) and never throw. The headless harness runs with `--mute-audio` and no gesture, so every playtest exercises that path.
- `meta.grade` for all five rooms: `{ vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 }`.
- Every room's `debugSolve()` finishes inside 40 s of wall time and goes through the same handlers a player uses (no debug-only path through a puzzle).
- Verify loop per room, ports per room: `npx vite build` → `node tools/screenshot.mjs N --port 51NN` (exit 0, then LOOK at `shots/levelNN-*.png`) → `node tools/playtest.mjs N --port 52NN` (prints SOLVED).
- Commit after every task with the message given in the task. Do not push. Branch: current (`claude/dreamcore-levels-sounds-scares-0cf5f2`).

## Task map and parallelism

```
Task 0  tooling (Chromium discovery)                     ─┐
Task 1  AudioEngine: listener, sfxAt, loopAt, sounds,     │
        moods, dread, hush; audiotest tool                │  sequential
Task 2  Engine grade pulse; UI flash / cue voice / keypad │  (shared files)
Task 3  LevelBase helpers; textures + props helpers; tests│
Task 4  presence.js (figure + Presence); tests            │
Task 5  main.js / index.js / SaveSystem / index.html      │
Task 6  docs: LEVEL_API.md, DESIGN.md                    ─┘
Task 7  Room XI   ─┐
Task 8  Room XII   │  independent — may run in parallel,
Task 9  Room XIII  │  one agent per room, own file, own ports
Task 10 Room XIV   │
Task 11 Room XV   ─┘
Task 12 README, full-suite gate 15/15, final commit
```

---

### Task 0: Tooling — find Chromium without an env var

**Files:**
- Modify: `tools/browser.mjs`

**Interfaces:**
- Produces: `launch()` and `loadLevel()` unchanged in signature; the executable is found automatically.

- [ ] **Step 1: Confirm the current failure**

Run: `node tools/playtest.mjs 1 --port 5301`
Expected: fails with an error mentioning `/opt/pw-browsers/chromium` (does not exist on this machine).

- [ ] **Step 2: Add executable discovery**

Replace the top of `tools/browser.mjs` (the `EXECUTABLE` constant) with:

```js
// Shared headless-browser harness: boots a Vite dev server in-process and a
// headless Chromium with software WebGL. The browser is found in this order:
// $CHROMIUM_PATH, /opt/pw-browsers/chromium, then Playwright's own cache.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function listDir(p) {
  try { return readdirSync(p); } catch { return []; }
}

export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  const roots = [
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),   // macOS
    join(homedir(), '.cache', 'ms-playwright'),               // linux
  ];
  const candidates = [];
  for (const root of roots) {
    for (const d of listDir(root).sort().reverse()) {          // newest build first
      const base = join(root, d);
      if (d.startsWith('chromium_headless_shell-')) {
        for (const sub of listDir(base)) candidates.push(join(base, sub, 'chrome-headless-shell'));
      } else if (d.startsWith('chromium-')) {
        for (const sub of listDir(base)) {
          candidates.push(join(base, sub, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
          candidates.push(join(base, sub, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'));
          candidates.push(join(base, sub, 'chrome'));
        }
      }
    }
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

const EXECUTABLE = findChromium();
if (!EXECUTABLE) {
  throw new Error(
    'No Chromium found. Set CHROMIUM_PATH to a Chromium/Chrome binary ' +
    '(Playwright\'s chrome-headless-shell works: npx playwright install chromium).'
  );
}
```

Keep the rest of the file (`launch`, `loadLevel`) exactly as it is.

- [ ] **Step 3: Verify**

Run: `node tools/playtest.mjs 1 --port 5301`
Expected: `level 1: SOLVED in …s` and `1/1 levels solvable`.

- [ ] **Step 4: Commit**

```bash
git add tools/browser.mjs
git commit -m "tools: find Playwright's Chromium automatically for the headless harness"
```

---

### Task 1: AudioEngine — listener, positional one-shots, loops, new sounds, moods, dread, hush

**Files:**
- Modify: `src/core/AudioEngine.js`
- Modify: `src/main.js` (one line: call `audio.updateListener` each frame)
- Create: `tools/audiotest.mjs`

**Interfaces:**
- Produces (used by Task 3 and every room):
  - `audio.updateListener(camera)`
  - `audio.sfx(name, opts)` (unchanged) and `audio.sfxAt(name, position, opts)` where `position` is `{x,y,z}`
  - `audio.loopAt(kind, position, opts) → { stop(fadeSeconds=0.6), setPosition(pos), setGain(g) }`
  - `audio.setDread(d)`, `audio.hush(seconds=2, depth=1)`
  - new `sfx` names: `knock stepOther breath whisper phone musicbox chime static slam tinnitus reverse toll heartbeat handle clunk piano hummed` (opts per spec §4.1.2)
  - new `loopAt` kinds: `tap radio boiler hum swing rain pianoKey` (spec §4.1.3)
  - new moods: `night stairwell school playground under` (spec §4.1.4)

Spec: §4.1 (all of it). Read `src/core/AudioEngine.js` fully first — the new code reuses its private helpers.

- [ ] **Step 1: Add the moods and the listener**

In `MOODS`, after the `shore` line, add:

```js
  night:      { root: 41, chord: [1, 1.189, 2.0],         cutoff: 380, noise: 0.05, events: ['creak', 'clock', 'wind'] },
  stairwell:  { root: 36, chord: [1, 1.5, 2.0, 2.997],    cutoff: 300, noise: 0.08, events: ['hum', 'drip', 'rumble'] },
  school:     { root: 49, chord: [1, 1.26, 1.5],          cutoff: 520, noise: 0.06, events: ['hum', 'hum', 'clock', 'rattle'] },
  playground: { root: 38, chord: [1, 1.498, 2.244, 3.0],  cutoff: 360, noise: 0.15, events: ['wind', 'wind', 'creak'] },
  under:      { root: 33, chord: [1, 1.189, 1.782],       cutoff: 260, noise: 0.09, events: ['drip', 'rumble', 'clock'] },
```

In the constructor add `this.listener = null;` and `this._dread = 0;`. At the end of `init()` (after the noise buffer is filled) add `this.listener = this.ctx.listener;`.

Add this method after `setVolume`:

```js
  /** Move the WebAudio listener to the camera. Call once per frame. */
  updateListener(camera) {
    if (!this._started || !this.listener) return;
    const l = this.listener, t = this.ctx.currentTime;
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    // columns of matrixWorld: X axis e[0..2], Y axis e[4..6], Z axis e[8..10], position e[12..14]
    const px = e[12], py = e[13], pz = e[14];
    const fx = -e[8], fy = -e[9], fz = -e[10];   // a camera looks down its local -Z
    const ux = e[4], uy = e[5], uz = e[6];
    if (l.positionX) {
      l.positionX.setTargetAtTime(px, t, 0.02); l.positionY.setTargetAtTime(py, t, 0.02); l.positionZ.setTargetAtTime(pz, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02); l.forwardY.setTargetAtTime(fy, t, 0.02); l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.setTargetAtTime(ux, t, 0.02); l.upY.setTargetAtTime(uy, t, 0.02); l.upZ.setTargetAtTime(uz, t, 0.02);
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }
```

- [ ] **Step 2: Store what dread and hush need on the ambience; reset dread on mood change**

In `setAmbience`, collect the drone oscillators and keep the filter and config on `this._amb`. Change the drone-voices block so each `osc` is pushed to a `voices` array, and change the final assignment:

```js
    const nodes = [lp];
    const voices = [];

    // drone voices
    cfg.chord.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'triangle' : 'sine';
      osc.frequency.value = cfg.root * ratio;
      osc.detune.value = (Math.random() - 0.5) * 9;
      const g = ctx.createGain();
      g.gain.value = 0.09 / cfg.chord.length * (i === 0 ? 2.0 : 1.0);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + Math.random() * 0.06;
      const lfoG = ctx.createGain();
      lfoG.gain.value = g.gain.value * 0.55;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      osc.connect(g); g.connect(lp);
      osc.start(); lfo.start();
      nodes.push(osc, lfo, g);
      voices.push(osc);
    });
```

and at the end of `setAmbience`:

```js
    this._amb = { gain, nodes, timers, mood, lp, cfg, voices, sub: null };
    this._dread = 0;
```

Then add, after `_stopAmbience`:

```js
  // ---------- dread & hush ----------

  /** 0..1 — darkens the drone, adds a slow sub pulse and detune drift. Reset by setAmbience. */
  setDread(d) {
    d = Math.max(0, Math.min(1, d || 0));
    this._dread = d;
    const amb = this._amb;
    if (!amb || !this._started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    amb.lp.frequency.setTargetAtTime(amb.cfg.cutoff * (1 - 0.6 * d), t, 0.8);
    if (!amb.sub) {
      const sub = ctx.createOscillator();
      sub.frequency.value = amb.cfg.root / 2;
      const sg = ctx.createGain();
      sg.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lg = ctx.createGain();
      lg.gain.value = 0;
      lfo.connect(lg); lg.connect(sg.gain);
      sub.connect(sg); sg.connect(amb.gain);
      sub.start(); lfo.start();
      amb.sub = { sub, sg, lfo, lg };
      amb.nodes.push(sub, lfo, sg, lg);
      // detune drift, re-randomised every 3 s while dread > 0
      const drift = setInterval(() => {
        if (this._amb !== amb) { clearInterval(drift); return; }
        if (this._dread <= 0) return;
        for (const v of amb.voices) {
          v.detune.setTargetAtTime((Math.random() - 0.5) * 40 * this._dread, this.ctx.currentTime, 1.5);
        }
      }, 3000);
      amb.timers.push(drift);   // _stopAmbience clears these (clearTimeout also clears intervals)
    }
    amb.sub.sg.gain.setTargetAtTime(0.06 * d, t, 0.8);
    amb.sub.lg.gain.setTargetAtTime(0.03 * d, t, 0.8);
  }

  /** Cut the ambience for `seconds`, then let it back in. Silence before a reveal. */
  hush(seconds = 2, depth = 1) {
    const amb = this._amb;
    if (!amb || !this._started) return;
    const t = this.ctx.currentTime, g = amb.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(0.5 * (1 - depth), t, 0.25);
    g.setTargetAtTime(0.5, t + seconds, 1.5);
  }
```

- [ ] **Step 3: Split `sfx` into `sfx` + `_synth`, add `sfxAt`, `_panner`, `loopAt`, and the helpers**

Rename the existing `sfx(name, opts = {})` body into `_synth(name, opts, out)`: its first three lines (`if (!this._started) return; this.resume(); const out = this.master;`) go away and `out` becomes the parameter; the `switch` stays. Then add:

```js
  // ---------- one-shots ----------

  sfx(name, opts = {}) {
    if (!this._started) return;
    this.resume();
    this._synth(name, opts, this.master);
  }

  /** Play a one-shot from a world position (HRTF panner → master). */
  sfxAt(name, position, opts = {}) {
    if (!this._started) return;
    this.resume();
    const panner = this._panner(position);
    this._synth(name, opts, panner);
    setTimeout(() => { try { panner.disconnect(); } catch {} }, (opts.holdSeconds ?? 8) * 1000);
  }

  _panner(position) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1.2;
    p.maxDistance = 60;
    p.rolloffFactor = 1.4;
    this._setPannerPos(p, position);
    p.connect(this.master);
    return p;
  }

  _setPannerPos(p, pos) {
    const t = this.ctx.currentTime;
    if (p.positionX) {
      p.positionX.setValueAtTime(pos.x, t);
      p.positionY.setValueAtTime(pos.y, t);
      p.positionZ.setValueAtTime(pos.z, t);
    } else {
      p.setPosition(pos.x, pos.y, pos.z);
    }
  }

  _noiseSource(rate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    src.playbackRate.value = rate;
    return src;
  }

  /** A struck piano string: three partials with a fast attack. */
  _piano(out, freq, gain, when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
    for (const [h, gm, dec] of [[1, 1, 1.8], [2, 0.35, 1.2], [3.01, 0.15, 0.8]]) {
      const o = ctx.createOscillator();
      o.frequency.value = freq * h;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * gm, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dec + 0.05);
    }
  }

  /** The wood creak used by ambience events and the swing loop. */
  _creak(out, gainV = 0.10) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = this._noiseSource(0.18 + Math.random() * 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(160 + Math.random() * 120, t);
    bp.frequency.linearRampToValueAtTime(90, t + 1.4);
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainV, t + 0.5);
    g.gain.linearRampToValueAtTime(0, t + 1.6);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t); src.stop(t + 1.8);
  }

  /**
   * A sustained positional source. Returns { stop(fade), setPosition(pos), setGain(g) }.
   * kinds: tap radio boiler hum swing rain pianoKey
   */
  loopAt(kind, position, opts = {}) {
    const noop = { stop() {}, setPosition() {}, setGain() {} };
    if (!this._started) return noop;
    this.resume();
    const ctx = this.ctx, t = ctx.currentTime;
    const panner = this._panner(position);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.8);   // fade in; recipes set their own inner gains
    gain.connect(panner);
    const nodes = [], timers = [];
    const every = (ms, fn) => { fn(); timers.push(setInterval(fn, ms)); };
    const noise = (rate = 1) => { const s = this._noiseSource(rate); nodes.push(s); s.start(t, Math.random() * 2); return s; };
    const osc = (type, freq, detune = 0) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
      nodes.push(o); o.start(t); return o;
    };
    const filt = (type, freq, Q = 1) => {
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q; nodes.push(f); return f;
    };
    const g = (v) => { const gg = ctx.createGain(); gg.gain.value = v; nodes.push(gg); return gg; };
    const lfoOn = (param, hz, depth) => { const l = osc('sine', hz); const lg = g(depth); l.connect(lg); lg.connect(param); };

    switch (kind) {
      case 'tap': {
        const s = noise(); const f = filt('bandpass', 1400, 1); const gg = g(0.05);
        lfoOn(gg.gain, 0.4, 0.015);
        s.connect(f); f.connect(gg); gg.connect(gain);
        break;
      }
      case 'radio': {
        const lp = filt('lowpass', 1200); const gg = g(0.025);
        [1, 1.5, 2.02].forEach((r, i) => osc('triangle', 220 * r, (i - 1) * 7).connect(lp));
        lp.connect(gg); gg.connect(gain);
        const s = noise(); const bp = filt('bandpass', 2200, 1); const ng = g(0.012);
        s.connect(bp); bp.connect(ng); ng.connect(gain);
        break;
      }
      case 'boiler': {
        const gg = g(0.03); osc('sine', 50).connect(gg); gg.connect(gain);
        every(1100, () => this._blip(gain, 1800, 1200, 0.001, 0.03, 0.05));
        break;
      }
      case 'hum': {
        const g1 = g(0.02), g2 = g(0.008);
        osc('sine', 119).connect(g1); osc('sine', 238).connect(g2);
        g1.connect(gain); g2.connect(gain);
        break;
      }
      case 'swing': every(1400, () => this._creak(gain, 0.10)); break;
      case 'rain': {
        const s = noise(); const f = filt('lowpass', 1500, 0.7); const gg = g(0.07);
        lfoOn(gg.gain, 0.3, 0.025);
        s.connect(f); f.connect(gg); gg.connect(gain);
        break;
      }
      case 'pianoKey': {
        const freq = opts.freq ?? 329.63;
        every((opts.every ?? 2.6) * 1000, () => this._piano(gain, freq, 0.05));
        break;
      }
      default: break;
    }

    let stopped = false;
    return {
      stop: (fade = 0.6) => {
        if (stopped) return;
        stopped = true;
        timers.forEach(clearInterval);
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + fade);
        setTimeout(() => {
          for (const n of nodes) { try { n.stop?.(); } catch {} try { n.disconnect(); } catch {} }
          try { gain.disconnect(); } catch {}
          try { panner.disconnect(); } catch {}
        }, fade * 1000 + 100);
      },
      setPosition: (pos) => this._setPannerPos(panner, pos),
      setGain: (v) => gain.gain.setTargetAtTime(v, ctx.currentTime, 0.1),
    };
  }
```

In `_ambEvent`, replace the body of `case 'creak'` with `this._creak(out, 0.10); break;` (the code you moved into `_creak`).

- [ ] **Step 4: Give the private helpers a `when` parameter**

Change the three helper signatures so sequences can be scheduled (`_blip` already has `when`):

```js
  _toneSimple(out, freq, dur, gain, type = 'sine', when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
    // … body unchanged, using t …
  }

  _bellTone(out, freq, gain, decay, when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
    // … body unchanged, using t …
  }

  _noiseBurst(out, freq, dur, gain, type = 'lowpass', when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
    // … body unchanged, using t …
  }
```

Every existing call site passes fewer arguments and keeps working.

- [ ] **Step 5: Add the new one-shot recipes to `_synth`**

Start `_synth` with `const ctx = this.ctx, t = ctx.currentTime;` (the old `sfx` body had neither). Then, inside its `switch (name)`, before the closing brace, add these cases:

```js
      case 'knock': {
        const count = opts.count ?? 3, gap = opts.gap ?? 0.42, soft = !!opts.soft;
        for (let i = 0; i < count; i++) {
          const w = t + i * gap;
          this._noiseBurst(out, 180, 0.12, soft ? 0.14 : 0.26, 'lowpass', w);
          this._blip(out, 95, 60, 0.003, 0.16, soft ? 0.16 : 0.30, w);
        }
        break;
      }
      case 'stepOther': {
        const soft = !!opts.soft;
        this._noiseBurst(out, 90 + Math.random() * 30, 0.14, soft ? 0.05 : 0.10);
        this._blip(out, 72, 48, 0.004, 0.12, soft ? 0.06 : 0.12);
        break;
      }
      case 'breath': {
        const src = this._noiseSource();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(420, t);
        bp.frequency.linearRampToValueAtTime(900, t + 0.95);
        bp.frequency.linearRampToValueAtTime(420, t + 1.9);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.9);
        g.gain.linearRampToValueAtTime(0, t + 1.9);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(t); src.stop(t + 2.0);
        break;
      }
      case 'whisper': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.035, t + 0.2);
        g.gain.setValueAtTime(0.035, t + 1.1);
        g.gain.linearRampToValueAtTime(0, t + 1.6);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
        const lg = ctx.createGain(); lg.gain.value = 0.0175;
        lfo.connect(lg); lg.connect(g.gain);
        g.connect(out);
        for (const f of [700, 1200, 2600]) {
          const src = this._noiseSource();
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
          src.connect(bp); bp.connect(g);
          src.start(t); src.stop(t + 1.7);
        }
        lfo.start(t); lfo.stop(t + 1.7);
        break;
      }
      case 'phone': {
        const rings = opts.rings ?? 1;
        for (let i = 0; i < rings; i++) {
          const w = t + i * 3.0;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, w);
          g.gain.linearRampToValueAtTime(0.05, w + 0.03);
          g.gain.setValueAtTime(0.05, w + 0.97);
          g.gain.linearRampToValueAtTime(0, w + 1.0);
          const trem = ctx.createGain(); trem.gain.value = 0.5;
          const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 20;
          const lg = ctx.createGain(); lg.gain.value = 0.5;
          lfo.connect(lg); lg.connect(trem.gain);
          for (const f of [1100, 1180]) {
            const o = ctx.createOscillator(); o.frequency.value = f;
            o.connect(trem); o.start(w); o.stop(w + 1.05);
          }
          trem.connect(g); g.connect(out);
          lfo.start(w); lfo.stop(w + 1.05);
        }
        break;
      }
      case 'musicbox': {
        const notes = opts.notes ?? [329.63, 392, 440, 392];
        const step = opts.step ?? 0.34, gain = opts.gain ?? 0.05, slow = opts.slow ?? 0;
        let w = t;
        notes.forEach((f, i) => { this._bellTone(out, f * 2, gain, 1.3, w); w += step * (1 + slow * i); });
        break;
      }
      case 'chime': {
        this._noiseBurst(out, 4000, 0.15, 0.02, 'highpass');
        this._bellTone(out, 392, 0.045, 2.6, t + 0.15);
        this._bellTone(out, 329.63, 0.045, 2.8, t + 0.65);
        break;
      }
      case 'static': {
        const dur = opts.dur ?? 0.8;
        const src = this._noiseSource(2.5);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.06, t);
        g.gain.setValueAtTime(0.06, t + Math.max(0.01, dur - 0.005));
        g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(t); src.stop(t + dur + 0.02);
        break;
      }
      case 'slam':
        this._noiseBurst(out, 200, 0.5, 0.35);
        this._blip(out, 70, 35, 0.005, 0.5, 0.5);
        break;
      case 'tinnitus': {
        const o = ctx.createOscillator(); o.frequency.value = 8400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 2.5);
        g.gain.setValueAtTime(0.028, t + 4.5);
        g.gain.linearRampToValueAtTime(0, t + 4.55);
        o.connect(g); g.connect(out);
        o.start(t); o.stop(t + 4.6);
        this.hush(4.5);
        break;
      }
      case 'reverse': {
        const dur = opts.dur ?? 2.2;
        const src = this._noiseSource();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0005, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + dur);
        g.gain.setValueAtTime(0, t + dur + 0.001);
        src.connect(lp); lp.connect(g); g.connect(out);
        src.start(t); src.stop(t + dur + 0.05);
        break;
      }
      case 'toll':
        this._bellTone(out, 98, 0.06, 7);
        this._bellTone(out, 98.7, 0.03, 6.5);
        break;
      case 'heartbeat': {
        const beats = opts.beats ?? 2;
        for (let i = 0; i < beats; i++) {
          const w = t + i * 0.9;
          this._blip(out, 60, 40, 0.005, 0.18, 0.28, w);
          this._blip(out, 58, 40, 0.005, 0.16, 0.20, w + 0.32);
        }
        break;
      }
      case 'handle': {
        for (let i = 0; i < 4; i++) this._blip(out, 1400, 900, 0.002, 0.03, 0.05, t + i * 0.07);
        this._blip(out, 300, 200, 0.004, 0.12, 0.10, t + 0.3);
        break;
      }
      case 'clunk':
        this._blip(out, 260, 120, 0.002, 0.09, 0.14);
        this._noiseBurst(out, 2400, 0.08, 0.03, 'highpass');
        break;
      case 'piano':
        this._piano(out, opts.freq ?? 261.63, opts.gain ?? 0.06);
        break;
      case 'hummed': {
        const notes = opts.notes ?? [329.63, 392, 440, 392];
        const step = opts.step ?? 0.55, gain = opts.gain ?? 0.03;
        notes.forEach((f, i) => {
          const w = t + i * step;
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f / 2;
          const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
          const vg = ctx.createGain(); vg.gain.value = 6;
          vib.connect(vg); vg.connect(o.detune);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, w);
          g.gain.linearRampToValueAtTime(gain, w + 0.004);
          g.gain.setValueAtTime(gain, w + step * 0.85);
          g.gain.linearRampToValueAtTime(0, w + step * 0.85 + 0.06);
          o.connect(lp); lp.connect(g); g.connect(out);
          o.start(w); vib.start(w); o.stop(w + step + 0.1); vib.stop(w + step + 0.1);
        });
        break;
      }
```

- [ ] **Step 6: Hook the listener into the frame loop**

In `src/main.js`, change the main loop to:

```js
engine.onUpdate((dt, t) => {
  player.update(dt);
  audio.updateListener(engine.camera);
  interaction.update();
  currentLevel?.update(dt, t);
});
```

- [ ] **Step 7: Write the audio smoke tool**

Create `tools/audiotest.mjs`:

```js
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
```

- [ ] **Step 8: Verify**

Run: `npx vite build` — expected: build succeeds.
Run: `node tools/audiotest.mjs` — expected: `audio smoke OK`. If a recipe throws, the message names it; fix the recipe.
Run: `node tools/playtest.mjs 1 --port 5301` — expected: SOLVED (regression: rooms still play).

- [ ] **Step 9: Commit**

```bash
git add src/core/AudioEngine.js src/main.js tools/audiotest.mjs
git commit -m "audio: positional one-shots and loops, new synthesized sounds, five moods, dread and hush"
```

---

### Task 2: Engine grade pulse; UI flash, cue voice, keypad hooks

**Files:**
- Modify: `src/core/Engine.js`
- Modify: `src/core/UI.js`
- Modify: `index.html` (add `#flash`)
- Modify: `src/style.css` (add `#flash`, `#subtitle.cue`)

**Interfaces:**
- Produces (used by Task 3, Task 5, rooms):
  - `engine.setGrade(partial | null)`, `engine.pulseGrade({ grain, fringe, desat, duration })`
  - `ui.flash(color = '#000', ms = 110)`
  - `ui.subtitle(text, duration, { voice: 'inner' | 'cue' })`
  - `ui.showKeypad({ label, length, keys, onSubmit, onCancel, onKey })` — `onKey(k)` on each key press; letter keys on the keyboard press matching keypad keys

Spec: §4.4.

- [ ] **Step 1: Engine — base grade, `setGrade`, `pulseGrade`**

In `src/core/Engine.js`, add above the `Engine` class:

```js
const BASE_GRADE = { vignette: 1.15, grain: 0.026, desat: 0.16, lift: 0.025, fringe: 0.00045 };
```

In the constructor, after `this.gradePass = …; this.composer.addPass(this.gradePass);` add:

```js
    this._grade = { ...BASE_GRADE };
    this._pulse = null;
```

Add these methods after `setBloomEnabled`:

```js
  /** Per-level grade override (partial keys: vignette grain desat lift fringe). null → base. */
  setGrade(partial) {
    this._grade = { ...BASE_GRADE, ...(partial || {}) };
    this._applyGrade(this._grade);
  }

  _applyGrade(g) {
    const u = this.gradePass.uniforms;
    u.uVignette.value = g.vignette;
    u.uGrain.value = g.grain;
    u.uDesat.value = g.desat;
    u.uLift.value = g.lift;
    u.uFringe.value = g.fringe;
  }

  /** A one-blink spike of grain / fringe / desaturation that eases back over `duration` seconds. */
  pulseGrade({ grain = 0.3, fringe = 0.008, desat = 0.6, duration = 0.35 } = {}) {
    this._pulse = { t: 0, duration, grain, fringe, desat };
  }
```

In `_frame()`, after `const t = this._clock.elapsedTime;` add:

```js
    if (this._pulse) {
      const p = this._pulse;
      p.t += dt;
      const k = Math.min(1, p.t / p.duration);
      const e = 1 - Math.pow(1 - k, 3);          // ease-out cubic
      const u = this.gradePass.uniforms, g = this._grade;
      u.uGrain.value = p.grain + (g.grain - p.grain) * e;
      u.uFringe.value = p.fringe + (g.fringe - p.fringe) * e;
      u.uDesat.value = p.desat + (g.desat - p.desat) * e;
      if (k >= 1) { this._pulse = null; this._applyGrade(g); }
    }
```

- [ ] **Step 2: UI — flash, subtitle voice, keypad `onKey` and letter keys**

In `src/core/UI.js`:

In the constructor's `this.el` object add `flash: $('flash'),`. Add `this._flashTimer = null;`.

Replace `subtitle(text, duration = 4.5)` with:

```js
  subtitle(text, duration = 4.5, { voice = 'inner' } = {}) {
    clearTimeout(this._subTimer);
    const el = this.el.subtitle;
    el.textContent = text;
    el.classList.toggle('cue', voice === 'cue');
    el.classList.remove('hidden');
    el.style.opacity = '1';
    this._subTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.classList.add('hidden'), 900);
    }, duration * 1000);
  }

  /** A blink: the screen goes to `color` at once and clears over 0.25 s after `ms`. */
  flash(color = '#000', ms = 110) {
    const el = this.el.flash;
    if (!el) return;
    clearTimeout(this._flashTimer);
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = '1';
    this._flashTimer = setTimeout(() => {
      el.style.transition = 'opacity 0.25s ease';
      el.style.opacity = '0';
    }, ms);
  }
```

Change `showKeypad`'s signature and state to carry `keys` and `onKey`:

```js
  showKeypad({ label, length = 4, keys = '1234567890', onSubmit, onCancel, onKey }) {
    this._keypadState = { code: '', length, keys, onSubmit, onCancel, onKey };
```

In `_keypadPress`, change the append branch to call `onKey`:

```js
    if (k === null) st.code = st.code.slice(0, -1);
    else if (st.code.length < st.length) { st.code += k; st.onKey?.(k); }
```

In `_onKey`, add a branch for letter keys after the digit branch:

```js
    } else if (this._modal === 'keypad' && /^Key[A-Z]$/.test(e.code)) {
      const ch = e.code.slice(-1);
      if (this._keypadState?.keys?.includes(ch)) this._keypadPress(ch);
    }
```

- [ ] **Step 3: index.html and CSS**

In `index.html`, directly after `<div id="fade"></div>` add `<div id="flash"></div>`.

In `src/style.css`, after the `#fade.slow` rule add:

```css
#flash {
  position: fixed; inset: 0; z-index: 9;
  background: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
```

and after the `#subtitle { … }` rule add:

```css
#subtitle.cue {
  font-style: normal;
  font-size: 15px;
  letter-spacing: 0.08em;
  color: var(--ghost-dim);
}
```

- [ ] **Step 4: Verify**

Run: `npx vite build` — expected: succeeds.
Run: `node tools/playtest.mjs 4 --port 5304` — expected: SOLVED (level IV uses the keypad; nothing else changed for it).
Then, in a browser (`npm run dev`), open the console and run `__game.ui.flash('#fff', 200)`; `__game.ui.subtitle('[knocking]', 3, { voice: 'cue' })`; `__game.engine.pulseGrade()` while a level is loaded — each should be visible.

- [ ] **Step 5: Commit**

```bash
git add src/core/Engine.js src/core/UI.js index.html src/style.css
git commit -m "engine/ui: grade pulse, flash layer, cue subtitle voice, keypad onKey and letter keys"
```

---

### Task 3: LevelBase helpers, texture/prop helpers, first unit tests

**Files:**
- Modify: `src/core/LevelBase.js`
- Modify: `src/core/textures.js`
- Modify: `src/core/props.js`
- Modify: `package.json` (add `"test": "node --test tests/*.test.mjs"`)
- Create: `tests/levelbase.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`audio.sfxAt/loopAt/setDread/hush`), Task 2 (`engine.pulseGrade`, `ui.flash`, `ui.subtitle(voice)`).
- Produces (used by every room):
  - `LevelBase.NOTES` (`{C,D,E,F,G,A,B}` → Hz), `LevelBase.tune('EGAGEGE') → number[]`
  - `this.playSoundAt(name, position, opts)`, `this.loopAt(kind, position, opts) → handle`, `this.dread(v)`, `this.hush(seconds, depth)`, `this.flinch({grain, fringe, desat, duration, flash})`
  - `this.isSeen(obj, { angleDeg=55, maxDist=Infinity, occluders=null }) → boolean`
  - `this.whenUnseen(obj, fn, { minTime=0.4, angleDeg=55, maxDist, occluders, once=true }) → unregister`
  - `this.whenSeen(obj, fn, { minTime=0.15, angleDeg=40, maxDist=30, occluders, once=true }) → unregister`
  - `this.cue(text, worldPos=null)`, `this.directionWord(worldPos) → string`
  - `this.addBlocker(min, max) → THREE.Box3`, `this.removeBlocker(box)`
  - `chalkTexture({ tally, lines, size, base, chalk }) → CanvasTexture` with `.redraw({ tally, lines })`
  - `blurredPhotoTexture({ figures, width, height }) → CanvasTexture`
  - `door.setAngle(radians)` on doors from `makeDoor`

Spec: §4.2, §4.8.

- [ ] **Step 1: Write the failing tests**

Create `tests/levelbase.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LevelBase } from '../src/core/LevelBase.js';

function fakeGame() {
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.08, 600);
  camera.rotation.order = 'YXZ';
  const subs = [];
  return {
    engine: { camera, pulseGrade() {} },
    ui: {
      subtitle: (t, d, o) => subs.push({ t, d, o }),
      flash() {}, setObjective() {}, addClue() {}, showNote() {}, setItems() {},
    },
    audio: {
      sfx() {}, sfxAt() {}, setDread() {}, hush() {},
      loopAt: () => ({ stop() {}, setPosition() {}, setGain() {} }),
    },
    interaction: { add() {}, clear() {}, remove() {}, setEnabled() {} },
    player: { setColliders() {}, position: new THREE.Vector3(0, 1.62, 0) },
    save: { data: { captions: false } },
    subs,
  };
}
class L extends LevelBase { build() {} }
function lookAlong(camera, yaw) {
  camera.position.set(0, 1.62, 0);
  camera.rotation.set(0, yaw, 0);
  camera.updateMatrixWorld(true);
}
function objAt(x, y, z) {
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.updateMatrixWorld(true); return o;
}

test('tune() maps letters to frequencies', () => {
  assert.deepEqual(LevelBase.tune('EGA'), [329.63, 392.0, 440.0]);
});

test('isSeen: ahead is seen, behind is not, beyond maxDist is not', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const obj = objAt(0, 1.5, -5);
  lookAlong(g.engine.camera, 0);              // yaw 0 faces -Z
  assert.equal(lvl.isSeen(obj), true);
  assert.equal(lvl.isSeen(obj, { maxDist: 3 }), false);
  lookAlong(g.engine.camera, Math.PI);        // faces +Z
  assert.equal(lvl.isSeen(obj), false);
});

test('isSeen: an occluder between camera and object hides it', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const obj = objAt(0, 1.5, -5);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial());
  wall.position.set(0, 1.5, -2); wall.updateMatrixWorld(true);
  lookAlong(g.engine.camera, 0);
  assert.equal(lvl.isSeen(obj, { occluders: [wall] }), false);
  assert.equal(lvl.isSeen(obj), true);
});

test('whenUnseen fires once after minTime unseen; whenSeen mirrors it', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const obj = objAt(0, 1.5, -5);
  let unseen = 0, seen = 0;
  lvl.whenUnseen(obj, () => unseen++, { minTime: 0.4 });
  lvl.whenSeen(obj, () => seen++, { minTime: 0.15 });
  lookAlong(g.engine.camera, 0);
  for (let i = 0; i < 10; i++) lvl.update(0.1, i * 0.1);
  assert.equal(unseen, 0);
  assert.equal(seen, 1);
  lookAlong(g.engine.camera, Math.PI);
  for (let i = 0; i < 3; i++) lvl.update(0.1, 1 + i * 0.1);
  assert.equal(unseen, 0);                    // 0.3 s < 0.4 s
  for (let i = 0; i < 3; i++) lvl.update(0.1, 2 + i * 0.1);
  assert.equal(unseen, 1);
  for (let i = 0; i < 10; i++) lvl.update(0.1, 3 + i * 0.1);
  assert.equal(unseen, 1);                    // once
});

test('whenUnseen with once:false fires one time per look-away', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const obj = objAt(0, 1.5, -5);
  let n = 0;
  lvl.whenUnseen(obj, () => n++, { minTime: 0.2, once: false });
  lookAlong(g.engine.camera, Math.PI);
  for (let i = 0; i < 10; i++) lvl.update(0.1, i * 0.1);
  assert.equal(n, 1);
  lookAlong(g.engine.camera, 0);
  lvl.update(0.1, 2);
  lookAlong(g.engine.camera, Math.PI);
  for (let i = 0; i < 5; i++) lvl.update(0.1, 3 + i * 0.1);
  assert.equal(n, 2);
});

test('directionWord', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  lookAlong(g.engine.camera, 0);
  assert.equal(lvl.directionWord({ x: 0, y: 1.5, z: -3 }), 'ahead');
  assert.equal(lvl.directionWord({ x: 0, y: 1.5, z: 3 }), 'behind you');
  assert.equal(lvl.directionWord({ x: -3, y: 1.5, z: 0 }), 'to your left');
  assert.equal(lvl.directionWord({ x: 3, y: 1.5, z: 0 }), 'to your right');
  assert.equal(lvl.directionWord({ x: 0, y: 4, z: -1 }), 'above you');
});

test('cue appends a direction only when captions are on, in the cue voice', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  lookAlong(g.engine.camera, 0);
  lvl.cue('knocking', { x: 0, y: 1.5, z: -3 });
  assert.equal(g.subs.at(-1).t, '[knocking]');
  g.save.data.captions = true;
  lvl.cue('knocking', { x: 0, y: 1.5, z: -3 });
  assert.equal(g.subs.at(-1).t, '[knocking] — ahead');
  assert.equal(g.subs.at(-1).o.voice, 'cue');
});

test('addBlocker returns its box; removeBlocker removes it; loops stop on dispose', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const b = lvl.addBlocker([0, 0, 0], [1, 1, 1]);
  assert.equal(lvl.solids.length, 1);
  lvl.removeBlocker(b);
  assert.equal(lvl.solids.length, 0);
  let stopped = 0;
  g.audio.loopAt = () => ({ stop() { stopped++; }, setPosition() {}, setGain() {} });
  lvl.loopAt('tap', { x: 0, y: 0, z: 0 });
  lvl.dispose();
  assert.equal(stopped, 1);
});
```

Add to `package.json` scripts: `"test": "node --test tests/*.test.mjs"`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test`
Expected: failures such as `LevelBase.tune is not a function`, `lvl.isSeen is not a function`.

- [ ] **Step 3: Implement the LevelBase additions**

In `src/core/LevelBase.js`, add module-level scratch objects after the import:

```js
const _p = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3();
const _ray = new THREE.Raycaster();
```

Inside the class, after `static meta = {…};` add:

```js
  /** Note frequencies (C major, octave 4) and a helper: tune('EGAGEGE') → [329.63, …]. */
  static NOTES = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0, B: 493.88 };
  static tune(letters) { return [...letters].map((l) => LevelBase.NOTES[l]); }
```

In the constructor add `this._loops = new Set();`.

Replace `addBlocker` and add `removeBlocker`:

```js
  /** Register an invisible blocker without geometry. Returns the Box3 (see removeBlocker). */
  addBlocker(min, max) {
    const box = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
    this.solids.push(box);
    return box;
  }

  removeBlocker(box) {
    const i = this.solids.indexOf(box);
    if (i >= 0) this.solids.splice(i, 1);
  }
```

Extend `dispose()` — before `this.game.interaction.clear();` add:

```js
    for (const h of this._loops) { try { h.stop?.(0.3); } catch {} }
    this._loops.clear();
    this._tickers.clear();
    this._tracked.clear();
    this.game.audio.setDread?.(0);
```

After `playSound(name, opts) {…}` add:

```js
  // ---------- positional sound, dread, blink ----------

  playSoundAt(name, position, opts) { this.game.audio.sfxAt?.(name, position, opts); }

  /** A sustained positional sound; stopped automatically when the level is disposed. */
  loopAt(kind, position, opts) {
    const h = this.game.audio.loopAt(kind, position, opts);
    this._loops.add(h);
    return h;
  }

  dread(v) { this.game.audio.setDread?.(v); }

  hush(seconds, depth) { this.game.audio.hush?.(seconds, depth); }

  /** A one-blink post-process spike; `flash` > 0 also blacks the screen for that many ms. */
  flinch({ grain = 0.3, fringe = 0.008, desat = 0.6, duration = 0.35, flash = 0 } = {}) {
    this.game.engine.pulseGrade?.({ grain, fringe, desat, duration });
    if (flash > 0) this.game.ui.flash?.('#000', flash);
  }

  // ---------- seen / unseen ----------

  /** Is `obj` inside the player's view cone (and not behind an occluder)? */
  isSeen(obj, { angleDeg = 55, maxDist = Infinity, occluders = null } = {}) {
    const cam = this.game.engine.camera;
    obj.getWorldPosition(_p);
    cam.getWorldPosition(_c);
    _d.subVectors(_p, _c);
    const dist = _d.length();
    if (dist > maxDist) return false;
    if (dist < 1e-6) return true;
    _d.divideScalar(dist);
    cam.getWorldDirection(_f);
    if (_f.dot(_d) < Math.cos(angleDeg * Math.PI / 180)) return false;
    if (occluders && occluders.length) {
      _ray.set(_c, _d);
      _ray.far = Math.max(0, dist - 0.05);
      if (_ray.intersectObjects(occluders, true).length) return false;
    }
    return true;
  }

  /** Call fn(obj) once obj has been out of view for minTime seconds. Returns an unregister function. */
  whenUnseen(obj, fn, { minTime = 0.4, angleDeg = 55, maxDist = Infinity, occluders = null, once = true } = {}) {
    let acc = 0, wait = false;
    const off = this.tick((dt) => {
      if (this.isSeen(obj, { angleDeg, maxDist, occluders })) { acc = 0; wait = false; return; }
      if (wait) return;
      acc += dt;
      if (acc >= minTime) {
        if (once) off(); else { acc = 0; wait = true; }
        fn(obj);
      }
    });
    return off;
  }

  /** Call fn(obj) once obj has been in view for minTime seconds. Returns an unregister function. */
  whenSeen(obj, fn, { minTime = 0.15, angleDeg = 40, maxDist = 30, occluders = null, once = true } = {}) {
    let acc = 0, wait = false;
    const off = this.tick((dt) => {
      if (!this.isSeen(obj, { angleDeg, maxDist, occluders })) { acc = 0; wait = false; return; }
      if (wait) return;
      acc += dt;
      if (acc >= minTime) {
        if (once) off(); else { acc = 0; wait = true; }
        fn(obj);
      }
    });
    return off;
  }

  // ---------- captions ----------

  /** A bracketed subtitle for a sound: "[knocking]" — with a direction word if captions are on. */
  cue(text, worldPos = null) {
    let s = `[${text}]`;
    if (worldPos && this.game.save?.data?.captions) s += ` — ${this.directionWord(worldPos)}`;
    this.game.ui.subtitle(s, 3.2, { voice: 'cue' });
  }

  /** ahead / behind you / to your left / to your right / above you, relative to the camera. */
  directionWord(worldPos) {
    const cam = this.game.engine.camera;
    cam.getWorldPosition(_c);
    const dx = worldPos.x - _c.x, dy = worldPos.y - _c.y, dz = worldPos.z - _c.z;
    if (dy > 1.5 && Math.hypot(dx, dz) < 5) return 'above you';
    cam.getWorldDirection(_f);
    const fwd = Math.atan2(-_f.x, -_f.z);          // player yaw convention: forward = (-sin yaw, 0, -cos yaw)
    const to = Math.atan2(-dx, -dz);
    let a = to - fwd;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    const deg = Math.abs(a) * 180 / Math.PI;
    if (deg < 35) return 'ahead';
    if (deg > 145) return 'behind you';
    return a > 0 ? 'to your left' : 'to your right';
  }
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all tests in `tests/levelbase.test.mjs` pass.

- [ ] **Step 5: textures.js — `chalkTexture`, `blurredPhotoTexture`; props.js — `door.setAngle`**

Append to `src/core/textures.js` (before the `makeMat` section):

```js
// ---------- chalk & photographs (rooms XII, XV) ----------

/**
 * A chalk tally and a few chalk words on a concrete-coloured square.
 * The returned texture has .redraw({ tally, lines }) — planes sharing it change together.
 */
export function chalkTexture({ tally = 0, lines = [], size = 512, base = '#5a5852', chalk = '#e8e4d8' } = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size / 2;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const jitter = (i, k) => (((i * 31 + k * 17) % 11) - 5) * 0.6;   // deterministic wobble
  const draw = ({ tally: n = tally, lines: ls = lines } = {}) => {
    const w = c.width, h = c.height;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    stains(ctx, w, 6);
    ctx.strokeStyle = chalk;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const grp = Math.floor(i / 5), k = i % 5, sx = 30 + grp * 96;
      ctx.beginPath();
      if (k < 4) {
        ctx.moveTo(sx + k * 18 + jitter(i, 0), 34 + jitter(i, 1));
        ctx.lineTo(sx + k * 18 + jitter(i, 2), 92 + jitter(i, 3));
      } else {
        ctx.moveTo(sx - 8 + jitter(i, 0), 84 + jitter(i, 1));
        ctx.lineTo(sx + 66 + jitter(i, 2), 42 + jitter(i, 3));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = chalk;
    ctx.font = 'italic 44px Georgia';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ls.forEach((line, i) => ctx.fillText(line, 30, 150 + i * 56));
    ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  draw();
  tex.redraw = draw;
  return tex;
}

/** The photograph motif from rooms I and V: figures too blurred to name. */
export function blurredPhotoTexture({ figures = 2, width = 128, height = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, '#9b9184');
  g.addColorStop(1, '#6e675c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(60,55,48,0.55)';
  for (let f = 0; f < figures; f++) {
    const x = width * (0.5 + (f - (figures - 1) / 2) * 0.28);
    ctx.beginPath(); ctx.ellipse(x, height * 0.55, 9, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, height * 0.33, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.filter = 'blur(2px)';
  ctx.drawImage(c, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
```

In `src/core/props.js`, inside `makeDoor` after `door.setOpen = …;` add:

```js
  door.setAngle = (rad) => { target = rad; };
```

- [ ] **Step 6: Verify**

Run: `npm test` — expected: pass.
Run: `npx vite build` — expected: succeeds.
Run: `node tools/playtest.mjs 1 --port 5301` — expected: SOLVED.

- [ ] **Step 7: Commit**

```bash
git add src/core/LevelBase.js src/core/textures.js src/core/props.js package.json tests/levelbase.test.mjs
git commit -m "levels: positional sound, seen/unseen helpers, captions, blockers, chalk and photo textures"
```

---

### Task 4: `presence.js` — the figure and its behaviour

**Files:**
- Create: `src/core/presence.js`
- Create: `tests/presence.test.mjs`

**Interfaces:**
- Consumes: `level.isSeen(obj, opts)` (Task 3), `level.game.player.position`.
- Produces (rooms XIII, XIV, XV):
  - `makeFigure({ height = 1.95 }) → THREE.Group` with `.faceToward(vec3)`, `.setHeight(h)`, `userData.isFigure = true`
  - `class Presence(level, figure, { stations, minUnseen=0.6, angleDeg=55, occluders=null, onArrive })` with `.index`, `.enabled`, `.placeAt(i)`, `.hide()`, `.advanceTo(i)`, `.isArmed()`, `.walkTo(vec3, speed=1.3, onDone)`, `.update(dt)`

Spec: §4.3.

- [ ] **Step 1: Write the failing tests**

Create `tests/presence.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeFigure, Presence } from '../src/core/presence.js';

function fakeLevel(seenFn) {
  return { game: { player: { position: new THREE.Vector3(0, 1.62, 0) } }, isSeen: seenFn };
}

test('makeFigure builds a dark, shadowless group of the requested height', () => {
  const f = makeFigure({ height: 1.95 });
  const box = new THREE.Box3().setFromObject(f);
  assert.ok(box.max.y > 1.8 && box.max.y < 2.05, `height ${box.max.y}`);
  let meshes = 0;
  f.traverse((o) => { if (o.isMesh) { meshes++; assert.equal(o.castShadow, false); assert.ok(o.material.color.getHex() < 0x202020); } });
  assert.ok(meshes >= 3);
  assert.equal(f.userData.isFigure, true);
  f.faceToward({ x: 0, y: 0, z: 5 });
  assert.ok(Math.abs(f.rotation.y) < 1e-6);
});

test('Presence advances one station per unseen interval, only while unseen', () => {
  let seen = true;
  const lvl = fakeLevel(() => seen);
  const fig = makeFigure();
  const arrived = [];
  const p = new Presence(lvl, fig, {
    stations: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
    minUnseen: 0.6,
    onArrive: (i) => arrived.push(i),
  });
  p.placeAt(0);
  p.advanceTo(2);
  for (let i = 0; i < 20; i++) p.update(0.1);
  assert.equal(p.index, 0);                    // watched: never moves
  seen = false;
  for (let i = 0; i < 7; i++) p.update(0.1);   // 0.7 s unseen → one hop
  assert.equal(p.index, 1);
  assert.deepEqual(arrived, [1]);
  for (let i = 0; i < 7; i++) p.update(0.1);
  assert.equal(p.index, 2);
  for (let i = 0; i < 20; i++) p.update(0.1);
  assert.equal(p.index, 2);                    // target reached: stays
  assert.equal(p.isArmed(), false);
  assert.equal(fig.position.x, 2);
});

test('enabled=false freezes it; hide() hides; walkTo moves smoothly and calls onDone', () => {
  const lvl = fakeLevel(() => false);
  const fig = makeFigure();
  const p = new Presence(lvl, fig, { stations: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] });
  p.placeAt(0);
  p.advanceTo(1);
  p.enabled = false;
  for (let i = 0; i < 20; i++) p.update(0.1);
  assert.equal(p.index, 0);
  let done = false;
  p.walkTo({ x: 0, y: 0, z: -3 }, 1.5, () => { done = true; });
  for (let i = 0; i < 25; i++) p.update(0.1);   // 2.5 s at 1.5 m/s covers 3 m
  assert.ok(done);
  assert.ok(Math.abs(fig.position.z + 3) < 1e-6);
  p.hide();
  assert.equal(fig.visible, false);
  assert.equal(p.enabled, false);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test` — expected: `Cannot find module '../src/core/presence.js'`.

- [ ] **Step 3: Implement `src/core/presence.js`**

```js
import * as THREE from 'three';

// The figure that follows the player through rooms XI–XV: a dark shape from
// primitives, never lit, no face. Presence moves it between stations only
// while the player is not looking (see the scare contract in the spec, §1.2).

const _tmp = new THREE.Vector3();

/** A dark human silhouette, `height` metres tall. Local +Z is its front. */
export function makeFigure({ height = 1.95 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 1, metalness: 0 });
  const coatH = height * 0.62;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, height * 0.12, 8), mat);
  legs.position.y = height * 0.06;
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, coatH, 10), mat);
  coat.position.y = height * 0.06 + coatH / 2;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
  shoulders.scale.set(1, 0.45, 0.7);
  shoulders.position.y = height * 0.70;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, height * 0.08, 8), mat);
  neck.position.y = height * 0.76;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat);
  head.position.y = height * 0.885;
  g.add(legs, coat, shoulders, neck, head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.userData.isFigure = true;
  g.faceToward = (p) => { g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z); };
  g.setHeight = (h) => { g.scale.setScalar(h / height); };
  return g;
}

/**
 * Moves a figure between fixed stations, one hop per `minUnseen` seconds of
 * not being looked at. Register with level.track(presence).
 */
export class Presence {
  constructor(level, figure, { stations = [], minUnseen = 0.6, angleDeg = 55, occluders = null, onArrive = null } = {}) {
    this.level = level;
    this.figure = figure;
    this.stations = stations.map((s) => new THREE.Vector3(s.x, s.y, s.z));
    this.minUnseen = minUnseen;
    this.angleDeg = angleDeg;
    this.occluders = occluders;
    this.onArrive = onArrive;
    this.index = -1;
    this.enabled = true;
    this._target = -1;
    this._acc = 0;
    this._walk = null;
  }

  placeAt(i) {
    const s = this.stations[i];
    if (!s) return;
    this.index = i;
    this.figure.position.copy(s);
    this.figure.visible = true;
  }

  hide() {
    this.figure.visible = false;
    this.enabled = false;
    this._target = -1;
    this._walk = null;
  }

  /** Arm: hop one station per unseen interval until index === i. */
  advanceTo(i) {
    this._target = Math.min(i, this.stations.length - 1);
    this._acc = 0;
  }

  isArmed() { return this._target > this.index && !this._walk; }

  /** Walk in the open at `speed` m/s (used once, in XIV's finale). Ignores the unseen rule. */
  walkTo(to, speed = 1.3, onDone = null) {
    this._walk = { to: new THREE.Vector3(to.x, to.y, to.z), speed, onDone };
    this._target = -1;
    this.figure.visible = true;
  }

  update(dt) {
    const f = this.figure;
    if (this._walk) {
      const w = this._walk;
      _tmp.subVectors(w.to, f.position);
      const d = _tmp.length();
      const step = w.speed * dt;
      if (d <= step) {
        f.position.copy(w.to);
        this._walk = null;
        w.onDone?.();
      } else {
        _tmp.divideScalar(d);
        f.rotation.y = Math.atan2(_tmp.x, _tmp.z);
        f.position.addScaledVector(_tmp, step);
      }
      return;
    }
    if (f.visible) f.faceToward(this.level.game.player.position);
    if (!this.enabled || !this.isArmed()) { this._acc = 0; return; }
    if (this.level.isSeen(f, { angleDeg: this.angleDeg, occluders: this.occluders })) { this._acc = 0; return; }
    this._acc += dt;
    if (this._acc >= this.minUnseen) {
      this._acc = 0;
      this.placeAt(this.index + 1);
      this.onArrive?.(this.index);
    }
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test` — expected: all pass (levelbase + presence).

- [ ] **Step 5: Commit**

```bash
git add src/core/presence.js tests/presence.test.mjs
git commit -m "core: the figure (makeFigure) and Presence, which moves only while unseen"
```

---

### Task 5: main.js, levels/index.js, SaveSystem, index.html — prologue, grade, menu, captions, migration, ending

**Files:**
- Modify: `src/main.js`
- Modify: `src/levels/index.js`
- Modify: `src/core/SaveSystem.js`
- Modify: `index.html`
- Create: `tests/save.test.mjs`

**Interfaces:**
- Consumes: Task 2 (`engine.setGrade`), Task 1 (`audio.updateListener` — already wired).
- Produces: `save.migrate(totalLevels)`, `save.data.captions`, `save.data.seenPrologues`; a level's `static meta.prologue` (string) plays as an interlude before its title card the first time; `static meta.grade` (partial grade) applies on entry.

Spec: §2.2, §4.5.

- [ ] **Step 1: Write the failing save tests**

Create `tests/save.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveSystem } from '../src/core/SaveSystem.js';

test('migrate unlocks the level after the highest completed one', () => {
  const s = new SaveSystem();
  s.data.completed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  s.data.unlocked = 10;
  s.migrate(15);
  assert.equal(s.data.unlocked, 11);
});

test('migrate never lowers unlocked and never exceeds the level count', () => {
  const s = new SaveSystem();
  s.data.completed = [1, 2, 3]; s.data.unlocked = 6;
  s.migrate(15);
  assert.equal(s.data.unlocked, 6);
  s.data.completed = Array.from({ length: 15 }, (_, i) => i + 1);
  s.migrate(15);
  assert.equal(s.data.unlocked, 15);
});

test('defaults include captions and seenPrologues; reset keeps captions', () => {
  const s = new SaveSystem();
  assert.equal(s.data.captions, false);
  assert.deepEqual(s.data.seenPrologues, []);
  s.data.captions = true;
  s.reset();
  assert.equal(s.data.captions, true);
});
```

Run: `npm test` — expected: `s.migrate is not a function`.

- [ ] **Step 2: SaveSystem**

In `src/core/SaveSystem.js`, add to `DEFAULTS`: `captions: false,` and `seenPrologues: [],`. Add `captions: this.data.captions,` to the `keep` object in `reset()`. Add the method:

```js
  /** Bring an older save up to date with a longer level list. */
  migrate(totalLevels) {
    const maxDone = this.data.completed.length ? Math.max(...this.data.completed) : 0;
    const want = Math.max(this.data.unlocked, maxDone + 1);
    this.data.unlocked = Math.max(1, Math.min(want, totalLevels));
    if (!Array.isArray(this.data.seenPrologues)) this.data.seenPrologues = [];
    this.save();
  }
```

Run: `npm test` — expected: pass.

- [ ] **Step 3: levels/index.js**

Replace the header comment and `EPILOGUE`:

```js
// Level registry. Levels register themselves by filename — Level01.js …
// Level15.js — so rooms can be authored independently without ever touching
// a shared file.
```

```js
export const EPILOGUE =
  'You open your eyes.\n\n' +
  'The ceiling of your own room. Morning.\n' +
  'This time it stays.\n\n' +
  'Somewhere, in a house that is gone, someone turns off the last light —\n' +
  'the one that was left on for you —\n' +
  'and goes to bed.';
```

`PROLOGUE`, `LEVELS`, `levelClass` are unchanged.

- [ ] **Step 4: index.html**

- `<title>HIRAETH</title>`
- In `#menu-settings`, after the bloom checkbox label, add:
  `<label class="check"><input id="set-captions" type="checkbox" /> describe sounds</label>`
- (`#flash` was added in Task 2.)

- [ ] **Step 5: main.js**

After `const save = new SaveSystem();` add `save.migrate(LEVELS.length);`.

In `startLevel`, replace the block from `await ui.fadeToBlack();` through `const meta = LevelClass.meta;` with:

```js
  await ui.fadeToBlack();
  disposeLevel();
  ui.clearClues();
  ui.setItems([]);

  const meta = LevelClass.meta;
  engine.setGrade(meta.grade ?? null);
  if (meta.prologue && !skipCard && !window.__TEST_MODE__ && !save.data.seenPrologues.includes(id)) {
    save.data.seenPrologues.push(id);
    save.save();
    await ui.showInterlude(meta.prologue);
  }

  currentLevel = new LevelClass(game);
  currentLevel.init();
  engine.setScene(currentLevel.scene);
  player.spawnAt(currentLevel.spawn.position, currentLevel.spawn.yaw);
```

(and delete the later duplicate `const meta = LevelClass.meta;` line).

In `game.onLevelComplete`, change the ending card to `'H I R A E T H\n\na dream in fifteen rooms\n\nthank you for staying asleep with me'`.

In `buildMenu()`, add:

```js
  document.getElementById('menu-sub').textContent = save.data.completed.includes(10)
    ? 'a dream in ten rooms · and the five beneath'
    : 'a dream in ten rooms';
  document.getElementById('set-captions').checked = save.data.captions;
```

After the `set-quality` listener add:

```js
document.getElementById('set-captions').addEventListener('change', (e) => {
  save.data.captions = e.target.checked;
  save.save();
});
```

- [ ] **Step 6: Verify**

Run: `npm test` — pass.
Run: `npx vite build` — succeeds.
Run: `npm run playtest` — expected: `10/10 levels solvable`, no browser errors (regression over all engine tasks so far).
Manual (`npm run dev`): the menu shows "a dream in ten rooms"; settings has "describe sounds". In the console: `localStorage.setItem('hiraeth-save-v1', JSON.stringify({unlocked:10, completed:[1,2,3,4,5,6,7,8,9,10]}))`, reload → the menu subtitle reads "…and the five beneath" (room XI is not there yet, so `unlocked` stays 10 until Task 7 lands; that is expected).

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/levels/index.js src/core/SaveSystem.js index.html tests/save.test.mjs
git commit -m "flow: level prologues and grades, save migration, captions setting, menu subtitle, the true epilogue"
```

---

### Task 6: Docs — LEVEL_API.md and DESIGN.md

**Files:**
- Modify: `docs/LEVEL_API.md`
- Modify: `docs/DESIGN.md`

**Interfaces:** none in code. Room-authoring agents read these; they must match Tasks 1–5 exactly.

Spec: §4.7, §3.2.

- [ ] **Step 1: LEVEL_API.md**

Make these edits:

1. In "File & class shape", extend the `static meta` example with two optional fields:
   ```js
     prologue: 'Optional. Interlude text shown once, before this room’s title card.',
     grade: { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 }, // optional post grade
   ```
   and change the import sentence to: "Import only from `three`, `../core/LevelBase.js`, `../core/textures.js`, `../core/props.js`, `../core/presence.js`."
2. In "Geometry & collision", change the blocker line to: "`this.addBlocker([minX,minY,minZ],[maxX,maxY,maxZ])` returns the `Box3`; `this.removeBlocker(box)` removes it."
3. In "Narrative & puzzle plumbing", add:
   - `this.cue('knocking', worldPos)` — a bracketed caption for a sound; with the "describe sounds" setting on, a direction word is appended. Cue every scare sound that carries information; never ambience.
   - `this.game.ui.showKeypad({ …, onKey(k) })` — `onKey` fires on each key; `keys` may contain letters (`'CDEFGAB'`), which the keyboard also types.
4. Replace the "Audio" section with:

   ```
   ## Audio

   `mood` keys: `hallway pool dusk store home field train theater archive shore night stairwell school playground under`.

   One-shots: `this.playSound(name, opts)` (everywhere) or `this.playSoundAt(name, {x,y,z}, opts)` (from a place — HRTF panned, distance-attenuated).
   Names: `step paper pickup clue unlock locked wrong switch door splash complete tone`
   `knock {count=3,gap=0.42,soft} stepOther {soft} breath whisper phone {rings} musicbox {notes,step,gain,slow}
   chime static {dur} slam tinnitus reverse {dur} toll heartbeat {beats} handle clunk piano {freq,gain} hummed {notes,step,gain}`.
   `tone` takes `{freq, gain, decay}`. Note frequencies: `LevelBase.NOTES.E` etc.; `LevelBase.tune('EGAGEGE')` → an array of Hz.

   Loops: `const h = this.loopAt(kind, {x,y,z}, opts)` → `{ stop(fadeSeconds), setPosition(pos), setGain(g) }`; kinds `tap radio boiler hum swing rain pianoKey {freq, every}`. Loops stop by themselves when the room is disposed.

   Mood shaping: `this.dread(0..1)` darkens the drone and adds a sub pulse (reset on room change); `this.hush(seconds, depth=1)` cuts the ambience and lets it back in — silence before a reveal.
   ```
5. Add a new section before "Playtest hook":

   ```
   ## Seen / unseen, blinks, the figure (rooms XI–XV)

   - `this.isSeen(obj, { angleDeg = 55, maxDist, occluders })` — inside the view cone and not behind one of `occluders` (meshes)?
   - `this.whenUnseen(obj, fn, { minTime = 0.4, once = true, angleDeg, maxDist, occluders })` — fn once obj has been out of view for minTime. `once: false` fires once per look-away. Returns an unregister function. `whenSeen` is the mirror.
   - `this.flinch({ grain, fringe, desat, duration, flash })` — a one-blink post-process spike; `flash: 90` also blacks the frame for 90 ms.
   - `import { makeFigure, Presence } from '../core/presence.js'` — `makeFigure()` is the dark shape; `new Presence(this, figure, { stations, minUnseen, occluders, onArrive })`, then `this.track(presence)`; `placeAt(i)`, `advanceTo(i)` (hops one station per unseen interval), `enabled`, `hide()`, `walkTo(pos, speed, onDone)`.
   - `chalkTexture({ tally, lines })` (with `.redraw`) and `blurredPhotoTexture()` in `../core/textures.js`; `door.setAngle(rad)` on `makeDoor` doors.

   ### Rooms XI–XV: scares

   The five rooms beneath may unsettle; they may not harm. No game-over, no fail state that restarts a room. Nothing chases the player: the figure moves only while unseen or passes at a fixed distance, never touches the player, never blocks a path, never comes closer than about two metres. No jump-scares: no sudden loud sound paired with a face; loud things happen at a distance or behind you. The figure is never lit and has no face. Silence (`hush`) is the strongest cue. Every scare is followed by something that lets go. Every hearing-dependent step has a sighted fallback (a light, dust, a written redundancy) and a `cue()`.
   ```
6. In "Difficulty ladder", append: "11–15: the room misleads you — labels lie, things change when you look away — and listening is a mechanic; each room about N minutes."

- [ ] **Step 2: DESIGN.md**

1. Extend the arc table with:
   ```
   | 11 | XI | The Bedroom | `night` | 5 |
   | 12 | XII | The Stairwell | `stairwell` | 5 |
   | 13 | XIII | The School | `school` | 6 |
   | 14 | XIV | The Playground | `playground` | 6 |
   | 15 | XV | Under the House | `under` | 7 |
   ```
   and after the phase list add: "- **Phases 5–7 — doubt (XI–XV):** the room misleads you; listening is a mechanic. Full design: `docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md`."
2. In "Canon", append the arc-2 canon from the spec §3.2 (copy the bullets verbatim).
3. After the room X section add:
   ```
   ## Rooms XI–XV — the five beneath

   A false awakening after the Shore. Bedroom (3:07, the knock code), Stairwell (the loop; stand still), School (the plates lie; play the tune), Playground (hide so it can come), Under the House (the evening order by ear; the box; the meeting). Every layout, puzzle, text and cue is in the spec above; the same production notes apply (one file per room, ports 51NN/52NN, full-suite gate 15/15).
   ```

- [ ] **Step 3: Verify and commit**

Re-read both files once against Tasks 1–5's names (`playSoundAt`, `loopAt`, `cue`, `whenUnseen`, `flinch`, `Presence`, `chalkTexture`, `door.setAngle`, `meta.prologue`, `meta.grade`, `onKey`). Then:

```bash
git add docs/LEVEL_API.md docs/DESIGN.md
git commit -m "docs: level API for positional sound, unseen helpers, the figure; arc-2 canon"
```

---

## Room tasks — how to work them

Each room task follows the same loop; the steps below repeat it in full so a
task can be read alone. Rooms touch only their own file. Use the room's own
ports (`51NN` for screenshots, `52NN` for playtests) so five agents can run
at once. Read the spec's §5.N for the room before starting; the layout,
every text and every cue is there. Where a step says "per spec", it means
that section.

Common shape of a room file (all five follow it):

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture /*, chalkTexture, blurredPhotoTexture */ } from '../core/textures.js';
import { makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeChair, makeTable, makeShelf, makeSign, makeDust, makeFluorescent, makeSky, applyFog } from '../core/props.js';
// import { makeFigure, Presence } from '../core/presence.js';   // XIII, XIV, XV

const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class LevelNN extends LevelBase {
  static meta = { id: NN, numeral: '…', title: '…', mood: '…', grade: GRADE, intro: '…', outro: '…' };

  build() {
    applyFog(this.scene, '#…', near, far);
    this._buildShell();       // walls, floor, ceiling, lights
    this._buildProps();       // furniture, signs, interactables
    this._wirePuzzle();       // state, interact handlers, tickers, threshold
    this.spawn.position.set(…); this.spawn.yaw = …;
    this.bounds = new THREE.Box3(…);
    this.setObjective('…');
  }

  // a box helper every room uses: shadowed box, positioned, optionally solid / walkable
  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  async debugSolve() { … }
}
```

Yaw convention (Player.js): forward is `(−sin yaw, 0, −cos yaw)`; yaw 0 faces
−Z, π faces +Z, π/2 faces −X, −π/2 faces +X. `player.teleport(x, z, yaw, y)`
— pass `y` (foot height) only when the floor height changes.

Verify loop for room NN (repeat until all three pass, then LOOK at the shots):

```bash
npx vite build
node tools/screenshot.mjs NN --port 51NN      # exit 0; then open shots/levelNN-a-spawn.png … d-back.png
node tools/playtest.mjs NN --port 52NN        # prints "level NN: SOLVED"
```

Screenshot review criteria (spec §6.2): composed, lit, textured, atmospheric;
no floating props; no black void where a wall should be; no untextured
surface. Iterate on geometry until the four shots pass.

---

### Task 7: Room XI — The Bedroom

**Files:**
- Create: `src/levels/Level11.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`playSoundAt`, `loopAt`, `whenUnseen`, `whenSeen`, `cue`, `flinch`, `dread`, `door.setAngle`, `makeDust`, `meta.prologue`).
- Produces: `Level11` (auto-discovered by filename).

Spec: §5.1 — read all of it first.

- [ ] **Step 1: Scaffold the file with meta, shell, spawn, and a threshold**

Create `src/levels/Level11.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import { makeDoor, makeWall, makeBulbLight, makeNoteProp, makeChair, makeTable, makeDust, applyFog } from '../core/props.js';

// XI — The Bedroom
// False awakening. 3:07, the door locked from the other side, M.'s knock code,
// knocking that moves along the walls, and the back of the wardrobe.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.1

const W = 4.2, D = 3.6, H = 2.5;                       // interior; origin at the centre; +Z is the door wall
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
const HUM = LevelBase.tune('EGAG');
const DOOR_POS = { x: 1.2, y: 1.2, z: 1.8 };
const BEYOND_DOOR = { x: 1.2, y: 1.4, z: 2.8 };
const WB_POS = { x: -0.55, y: 1.2, z: 1.79 };          // the wardrobe's back panel
const LANDING_POS = { x: -0.05, y: 1.4, z: 2.8 };

export default class Level11 extends LevelBase {
  static meta = {
    id: 11,
    numeral: 'XI',
    title: 'The Bedroom',
    mood: 'night',
    grade: GRADE,
    prologue:
      'You open your eyes.\n\n' +
      'The ceiling of your own room. Morning, or nearly.\n\n' +
      'Except it is the old ceiling — the one with the stick-on stars —\n' +
      'and it is not morning, and the door is shut.\n\n' +
      'You never shut the door.',
    intro: 'It is 3:07. It has been 3:07 for as long as you can remember.',
    outro:
      'The door was never going to open.\n' +
      'You knew that. You knocked anyway,\n' +
      'the way you always did, and something knocked back.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1, 9);
    this._buildShell();
    this._buildFurniture();
    this._buildKnockSpots();
    this._wirePuzzle();
    this.spawn.position.set(-0.9, 0, 0.7);
    this.spawn.yaw = Math.PI;                              // facing the door wall (+Z)
    this.bounds = new THREE.Box3(new THREE.Vector3(-W / 2 + 0.3, 0, -D / 2 + 0.3), new THREE.Vector3(W / 2 - 0.3, 3, 3.6));
    this.setObjective('the door was open when you fell asleep');
  }

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  _buildShell() {
    const wallMat = makeMat('wallpaper', { base: '#8d8378', stripe: '#7f7468', repeat: [3, 1.2] });
    const floorMat = makeMat('carpet', { base: '#5a4e4c', repeat: [3, 3] });
    const ceilMat = makeMat('plaster', { base: '#9a9488', repeat: [2, 2] });
    const concrete = makeMat('concrete', { base: '#6e6a64', repeat: [1, 1] });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.add(floor); this.addGround(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
    this.add(ceil);

    // walls: west, east, north (window), south (door + wardrobe opening)
    this._box(0.2, H, D + 0.4, wallMat, -W / 2 - 0.1, H / 2, 0);
    this._box(0.2, H, D + 0.4, wallMat, W / 2 + 0.1, H / 2, 0);
    this._box(W + 0.4, H, 0.2, wallMat, 0, H / 2, -D / 2 - 0.1);
    // south wall in pieces: west of the wardrobe (x -2.1..-1.05), between wardrobe and door, east of the door, lintels
    this._box(1.05, H, 0.2, wallMat, -1.575, H / 2, D / 2 + 0.1);
    this._box(0.65, H, 0.2, wallMat, 0.275, H / 2, D / 2 + 0.1);          // x -0.05..0.6
    this._box(0.3, H, 0.2, wallMat, 1.95, H / 2, D / 2 + 0.1);            // x 1.8..2.1
    this._box(1.2, H - 2.1, 0.2, wallMat, 1.2, 2.1 + (H - 2.1) / 2, D / 2 + 0.1);   // door lintel
    this._box(1.0, H - 2.1, 0.2, wallMat, -0.55, 2.1 + (H - 2.1) / 2, D / 2 + 0.1); // wardrobe lintel

    // ceiling stars
    const starMat = new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x9fd6a8, emissiveIntensity: 1.6 });
    const starGeo = new THREE.SphereGeometry(0.012, 6, 5);
    for (let i = 0; i < 45; i++) {
      const s = new THREE.Mesh(starGeo, starMat);
      const cl = i % 3;
      s.position.set((cl - 1) * 1.1 + (Math.random() - 0.5) * 1.3, H - 0.012, (cl - 1) * 0.6 + (Math.random() - 0.5) * 1.6);
      this.add(s);
    }

    this.add(new THREE.HemisphereLight(0x3a3f55, 0x0b0b10, 0.25));

    // the door (south wall, x +1.2), never opens
    this._door = makeDoor({ color: '#5a4636' });
    this._door.position.set(1.2, 0, D / 2);
    this.add(this._door); this.track(this._door); this.addCollider(this._door.panel);

    // window (north wall): black glossy pane + curtains; rain outside
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x05060a, metalness: 0.9, roughness: 0.15 }));
    pane.position.set(-0.6, 1.5, -D / 2 + 0.005);
    this.add(pane);
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x6b6f7c, roughness: 1 });
    for (const sx of [-1, 1]) this._box(0.35, 1.5, 0.08, curtainMat, -0.6 + sx * 0.6, 1.5, -D / 2 + 0.06, { collide: false });
    this.loopAt('rain', { x: -0.6, y: 1.5, z: -2.6 });

    // beyond the wardrobe's back: a concrete landing, a caged bulb (off), the first steps down
    const landingFloor = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), concrete);
    landingFloor.rotation.x = -Math.PI / 2; landingFloor.position.set(-0.05, 0, 2.8);
    this.add(landingFloor); this.addGround(landingFloor);
    this._box(0.2, 2.6, 2.0, concrete, -1.15, 1.3, 2.8);
    this._box(0.2, 2.6, 2.0, concrete, 1.05, 1.3, 2.8);
    this._box(2.4, 2.6, 0.2, concrete, -0.05, 1.3, 3.9);
    const lc = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), concrete);
    lc.rotation.x = Math.PI / 2; lc.position.set(-0.05, 2.5, 2.8); this.add(lc);
    for (let i = 0; i < 4; i++) this._box(1.6, 0.17, 0.28, concrete, -0.05, 0.085 - i * 0.17, 3.2 + i * 0.28, { collide: false });
    this.addBlocker([-1.1, -2, 3.0], [1.0, 3, 3.9]);
    this._cagedBulb = makeBulbLight({ color: 0xd8dcd0, intensity: 0, distance: 5, y: 2.2 });
    this._cagedBulb.position.set(-0.05, 0, 2.8);
    this.add(this._cagedBulb);
  }

  _buildFurniture() {
    // fill in per spec §5.1 Layout: bed (west wall, head north), desk + lamp (the only light) +
    // drawer + clock + music box, chair, mirror + sheet, wardrobe (two doors, coats, back panel).
    // Keep these member names — _wirePuzzle uses them:
    //   this._drawer (mesh), this._clock (mesh, texture swappable via this._setClock),
    //   this._chair (group), this._sheet (mesh), this._mirror (mesh), this._musicBox (mesh),
    //   this._wardrobeDoors (group holding this._wdL and this._wdR, both makeDoor, tracked),
    //   this._coatMarker (Object3D inside the wardrobe), this._fallenCoat (mesh, visible=false),
    //   this._backPanel (makeDoor at (-0.55, 0, 1.79) — the wardrobe's back; tracked; its panel is a collider)
    // The desk lamp: a PointLight 0xffd9a8, intensity 3.2, distance 6 at (1.4, 1.05, -0.5), plus a small cone mesh.
  }

  _setClock(text) {
    const tex = textTexture({ text, font: 'bold 60px monospace', color: '#ff7a5a', bg: '#140c0a', width: 256, height: 96 });
    const old = this._clock.material.map;
    this._clock.material.map = tex;
    this._clock.material.emissiveMap = tex;
    this._clock.material.needsUpdate = true;
    old?.dispose?.();
  }

  _buildKnockSpots() {
    // faintly darker patches of wallpaper, 0.5 × 0.5 at y 1.3, 2 mm proud of the wall
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x1a1612, transparent: true, opacity: 0.12, roughness: 1 });
    const defs = [
      ['W1', -W / 2 + 0.002, -1.0, Math.PI / 2], ['W2', -W / 2 + 0.002, 0.6, Math.PI / 2],
      ['N1', -1.4, -D / 2 + 0.002, 0], ['N2', 1.2, -D / 2 + 0.002, 0],
      ['E1', W / 2 - 0.002, -1.4, -Math.PI / 2], ['E2', W / 2 - 0.002, 0.9, -Math.PI / 2],
    ];
    this._spots = defs.map(([name, x, z, ry]) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), spotMat);
      mesh.position.set(x, 1.3, z); mesh.rotation.y = ry;
      this.add(mesh);
      return { name, mesh, pos: new THREE.Vector3(x, 1.3, z) };
    });
    this._wbSpot = { name: 'WB', mesh: this._backPanel, pos: new THREE.Vector3(WB_POS.x, WB_POS.y, WB_POS.z) };
  }

  _spot(name) { return this._spots.find((s) => s.name === name); }
```

- [ ] **Step 2: Add the puzzle wiring, the rounds, and the threshold**

```js
  _wirePuzzle() {
    const s = this;
    this._round = 0; this._wrong = 0; this._noteRead = false; this._answered = false; this._panelOpen = false;

    // the door: locked from the other side; a knock answers; once, humming beyond it
    this.interact(this._door, {
      prompt: 'the door',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('Locked. From the other side.', 5);
        this.after(1.2, () => { this.playSoundAt('knock', DOOR_POS, { count: 1, soft: true }); this.cue('a knock', DOOR_POS); });
        if (!this._hummed) {
          this._hummed = true;
          this.after(4.0, () => { this.playSoundAt('hummed', BEYOND_DOOR, { notes: HUM }); this.cue('humming', BEYOND_DOOR); });
        }
      },
    });

    // the drawer: M.'s note → round 1
    this.interact(this._drawer, {
      prompt: 'the drawer', once: true,
      onInteract: () => {
        this.giveNote({
          id: 'l11-note',
          title: 'a note in the drawer, older than the others',
          body:
            'when you couldn’t sleep I knocked on the wall\n' +
            'and you knocked back.\n\n' +
            'two for "still there".\n' +
            'three for "come and find me".\n\n' +
            '— M.',
        });
        this._noteRead = true;
        this.setObjective('listen');
        this.whenUnseen(this._musicBox, () => this.playSoundAt('musicbox', this._musicBox.position, { notes: HUM, slow: 0.15 }));
        this._startRound(1);
      },
    });

    // knock spots (wall patches); the wardrobe back is registered when the doors open
    for (const spot of this._spots) this.interact(spot.mesh, { prompt: 'knock', onInteract: () => this._knockAt(spot) });

    // the wardrobe doors
    this.interact(this._wardrobeDoors, {
      prompt: 'the wardrobe', once: true,
      onInteract: () => {
        this._wardrobeOpened = true;
        this._wdL.setOpen(true, -1); this._wdR.setOpen(true, 1);       // pick the signs that swing them into the room
        this.playSound('door');
        this.whenUnseen(this._coatMarker, () => { this._fallenCoat.visible = true; });
        this.interact(this._backPanel, { prompt: 'knock', onInteract: () => this._knockAt(this._wbSpot) });
      },
    });

    // unseen change 0: the wardrobe stands ajar after 15 s (first look-away), unless you already opened it
    this.after(15, () => this.whenUnseen(this._wardrobeDoors, () => { if (!this._wardrobeOpened) this._wdL.setAngle(0.2); }));

    // the clock misreads, sometimes, while you aren't looking
    this._clockOdd = false;
    this.whenUnseen(this._clock, () => {
      if (this._clockOdd) { this._setClock('3:07'); this._clockOdd = false; return; }
      if (Math.random() < 0.3) { this._setClock(['3:O7', '7:03', '3:0 '][(Math.random() * 3) | 0]); this._clockOdd = true; }
    }, { once: false });
    this.interact(this._clock, { prompt: 'the clock', onInteract: () => this.subtitle('3:07. It was 3:07 when you fell asleep, too.', 5) });
    this.interact(this._mirror, { prompt: 'the mirror', onInteract: () => this.subtitle(this._sheetDown ? 'Dark glass. Nothing in it that should not be.' : 'A sheet over it. You always kept it covered.', 4) });

    // through the wardrobe: the handle turns behind you, and the room lets you go
    this.tick(() => {
      if (this._panelOpen && !this.isCompleted && s.game.player.position.z > 2.6) {
        this.playSoundAt('handle', DOOR_POS);
        this.cue('the handle turns', DOOR_POS);
        this.flinch({ flash: 90 });
        this.complete();
      }
    });
  }

  /** Round n: knocking (three) from a source spot every 6 s until answered at that spot. */
  _startRound(n) {
    this._round = n; this._wrong = 0; this._answered = false;
    this._source = n === 1 ? this._spot('E2') : n === 2 ? this._spot('W1') : this._wbSpot;
    const src = this._source;
    const burst = () => {
      if (this._round !== n || this._answered) return;
      this.playSoundAt('knock', src.pos, { count: 3 });
      this.cue('knocking', src.pos);
      this._puff(src.pos);
      this._burstTimer = this.after(6, burst);
    };
    burst();
  }

  _knockAt(spot) {
    if (!this._noteRead) { this.subtitle('The wall is cold.', 3); return; }
    this.playSoundAt('knock', spot.pos, { count: 2 });          // your two: still there
    if (this._answered) return;
    if (spot !== this._source) {
      this._wrong++;
      this.after(0.6, () => {
        this.playSoundAt('knock', spot.pos, { count: 1, soft: true });
        if (this._wrong >= 2) this.subtitle('Nothing there. Listen — it is coming from somewhere else.', 5);
      });
      return;
    }
    this._answered = true;
    clearTimeout(this._burstTimer);
    if (this._round === 3) { this.after(1.5, () => this._openPanel()); return; }
    this.after(0.6, () => {
      this.playSoundAt('knock', spot.pos, { count: 2, soft: true });   // her two: still there
      this.subtitle('Two. Still there.', 4);
      if (this._round === 1) {
        this.learnClue({ id: 'l11-code', title: 'the knocks', body: 'two — still there.\nthree — come and find me.' });
        this.whenUnseen(this._chair, () => this._turnChair());
        this.after(5, () => this._startRound(2));
      } else {
        this.whenUnseen(this._sheet, () => this._dropSheet());
        this.after(5, () => this._startRound(3));
      }
    });
  }

  _turnChair() {
    this._chair.rotation.y += Math.PI * 0.85;
    this._chair.position.x -= 0.15;
  }

  _dropSheet() {
    this._sheetDown = true;
    this._sheet.rotation.set(-Math.PI / 2, 0, 0.3);
    this._sheet.position.set(-1.75, 0.02, 0.95);
    this.whenSeen(this._mirror, () => this.subtitle('You always kept it covered. You were right to.', 5));
  }

  _openPanel() {
    this._panelOpen = true;
    this._backPanel.setOpen(true, -1);                             // swing INTO the landing (+Z); flip the sign if it swings into the wardrobe
    this.removeColliderOf(this._backPanel.panel);
    this.playSound('door');
    this._cagedBulb.light.intensity = 2.5;
    this.playSoundAt('reverse', LANDING_POS, { dur: 1.4 });
    this.dread(0.35);
    this.setObjective('down');
    this.subtitle('Cold air. Concrete. Stairs, going down, where the back of the wardrobe used to be.', 6);
  }

  /** The sighted fallback for a knock: a small fall of dust at the spot for 1.2 s. */
  _puff(pos) {
    const d = makeDust({ count: 12, box: [0.3, 0.35, 0.3], center: [pos.x, pos.y, pos.z], size: 0.012 });
    this.add(d); this.track(d);
    this.after(1.2, () => { this.root.remove(d); this._tracked.delete(d); });
  }

  async debugSolve() {
    this.debugInteract(this._drawer);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    await this.debugWait(0.4);
    this.debugInteract(this._spot('E2').mesh);     // round 1
    await this.debugWait(6.0);                     // reply at 0.6 s, round 2 at 5.6 s
    this.debugInteract(this._spot('W1').mesh);     // round 2
    await this.debugWait(6.0);
    this.debugInteract(this._wardrobeDoors);
    await this.debugWait(0.4);
    this.debugInteract(this._backPanel);           // round 3: the panel opens after 1.5 s
    await this.debugWait(2.0);
    this.game.player.teleport(-0.4, 3.0);
    await this.debugWait(0.6);
  }
}
```

- [ ] **Step 3: Build the furniture and the wardrobe (fill in `_buildFurniture`)**

Follow spec §5.1 Layout for positions and materials. Requirements the puzzle relies on:

- `this._drawer`: the desk drawer front, a box 0.4 × 0.12 × 0.02 on the desk's room-facing side, registered as its own mesh.
- `this._clock`: `new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), new THREE.MeshStandardMaterial({ emissive: 0xff6a4a, emissiveIntensity: 0.9 }))` at (1.6, 0.86, −0.05), `rotation.y = -Math.PI / 2` (facing −X into the room); then call `this._setClock('3:07')` once after creating it.
- `this._chair = makeChair()` at the desk facing the desk (`rotation.y = -Math.PI / 2`); `this.addCollider(this._chair)` (the collider is a snapshot; the later turn need not update it).
- `this._mirror`: plane 0.5 × 0.8, `MeshStandardMaterial({ color: 0x0a0b0e, metalness: 1, roughness: 0.05 })` at (−2.08, 1.4, 0.95), `rotation.y = Math.PI / 2`. `this._sheet`: box 0.62 × 0.95 × 0.03, `'#b9b1a2'`, at (−2.06, 1.4, 0.95) rotated to hang over the mirror.
- `this._musicBox`: box 0.14 × 0.08 × 0.1, `'#7a5a3a'`, on a shelf at (1.85, 1.75, −0.4).
- Wardrobe: carcass boxes (sides at x −1.05 and −0.05, top at 2.1, back wall NOT built — the back panel is the door). `this._wdL = makeDoor({ width: 0.5, height: 2.0, knob: false, color: '#5a4636' })` at (−0.8, 0, 1.18); `this._wdR = makeDoor({ width: 0.5, height: 2.0, knob: false, color: '#5a4636' })` at (−0.3, 0, 1.18) with `rotation.y = Math.PI` (so its hinge sits at the east edge). Track both; add both panels as colliders. `this._wardrobeDoors = new THREE.Group()` containing both (add the group with `this.add`, then add the two doors to the group). Five hanging coats (boxes 0.3 × 1.0 × 0.12) on a rail at y 1.9; `this._fallenCoat` (a coat rotated flat on the wardrobe floor at (−0.6, 0.06, 1.45)), `visible = false`; `this._coatMarker = new THREE.Object3D()` at (−0.55, 1.0, 1.5) added to the root.
- `this._backPanel = makeDoor({ width: 1.0, height: 2.0, knob: false, color: '#5a4636' })` at (−0.55, 0, 1.79); track it; `this.addCollider(this._backPanel.panel)`.
- Bed, blanket, pillow: boxes; add the bed frame as a collider.

Then run the verify loop and iterate on the shots until the room reads as a dark child's bedroom lit by one desk lamp with stars on the ceiling.

- [ ] **Step 4: Verify**

```bash
npx vite build
node tools/screenshot.mjs 11 --port 5111
node tools/playtest.mjs 11 --port 5211
```
Expected: build ok; screenshot exit 0 and the four shots pass review; `level 11: SOLVED`.

If the playtest fails at the wardrobe step, check that `_wbSpot.mesh === this._backPanel` and that the back-panel interact is registered inside the wardrobe-doors handler.

- [ ] **Step 5: Commit**

```bash
git add src/levels/Level11.js
git commit -m "Add room XI (The Bedroom) — false awakening, the knock code, the wardrobe's back"
```

---

### Task 8: Room XII — The Stairwell

**Files:**
- Create: `src/levels/Level12.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`playSoundAt`, `cue`, `dread`, `hush`, `flinch`, `whenSeen`, `chalkTexture`, `player.teleport(x, z, yaw, y)`).
- Produces: `Level12`.

Spec: §5.2 — read all of it first (the loop, the stillness rule, the approach).

- [ ] **Step 1: Scaffold with the shaft data table and the floor builder**

Create `src/levels/Level12.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, chalkTexture } from '../core/textures.js';
import { makeDoor, makeWall, makeBulbLight, makeSign, applyFog } from '../core/props.js';

// XII — The Stairwell
// A dog-leg fire stair that repeats −1, −2, −3. Footsteps one flight below
// that stop when you stop. Chalk: "wait for me". Stand still and it comes up,
// and a door opens.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.2

const FLOOR_H = 2.72, HALF_H = 1.36, RISE = 0.17, RUN = 0.28, STEPS = 8;
const X0 = -3.2, X1 = 3.2, MAIN_X1 = -1.0, HALF_X0 = 1.24, ZW = 1.3;   // shaft plan
const LANDINGS = [
  { label: '2', y: 0 }, { label: '1', y: -2.72 }, { label: 'G', y: -5.44 },
  { label: '-1', y: -8.16 }, { label: '-2', y: -10.88 }, { label: '-3', y: -13.6 },
  { label: '-1', y: -16.32 }, { label: '-2', y: -19.04 },
];
const LOOP_Y = -20.5;            // foot height that teleports you up 3 floors
const LOOP_DY = 3 * FLOOR_H;
const STUB_END_X = -7.7;         // threshold inside an opened stub
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level12 extends LevelBase {
  static meta = {
    id: 12,
    numeral: 'XII',
    title: 'The Stairwell',
    mood: 'stairwell',
    grade: GRADE,
    intro: 'The stairs go down further than the building does.',
    outro:
      'You stopped, and it caught up,\n' +
      'and nothing happened, except that a door opened.\n' +
      'That was all it ever wanted: for you to stop.',
  };

  build() {
    applyFog(this.scene, '#0c0c0f', 1, 12);
    this._concrete = makeMat('concrete', { base: '#7a766f', repeat: [2, 2] });
    this._floorMat = makeMat('concrete', { base: '#5e5b55', repeat: [1, 1] });
    this._loops = 0; this._pleaded = 0; this._doors = []; this._stubLights = []; this._bulbs = [];
    this._chalk = chalkTexture({ tally: 1, lines: ['wait for me'] });
    this.add(new THREE.HemisphereLight(0x5c6068, 0x0b0b0e, 0.3));

    LANDINGS.forEach((L, i) => this._buildFloor(i, L));
    // below L7: one more half-flight down and a closed shaft
    this._buildFlights(LANDINGS[7].y, false);
    this.addBlocker([X0 - 0.2, LANDINGS[7].y - 3.0, -ZW - 0.2], [X1 + 0.2, LANDINGS[7].y - 2.5, ZW + 0.2]);
    // shaft walls (east, north, south) and the west wall above the top landing
    const top = 3, bottom = LANDINGS[7].y - 3.0, height = top - bottom, midY = (top + bottom) / 2;
    this._box(0.2, height, ZW * 2 + 0.4, this._concrete, X1 + 0.1, midY, 0);
    this._box(X1 - X0 + 0.4, height, 0.2, this._concrete, 0, midY, ZW + 0.1);
    this._box(X1 - X0 + 0.4, height, 0.2, this._concrete, 0, midY, -ZW - 0.1);
    this._box(X1 - X0 + 0.4, 0.2, ZW * 2 + 0.4, this._concrete, 0, 3.0, 0, { collide: false });   // shaft ceiling
    this._updateWindowLights();
    this._wirePuzzle();

    this.spawn.position.set(-2.1, 0, 0);
    this.spawn.yaw = -Math.PI / 2;                       // facing +X, down the first flight
    this.bounds = new THREE.Box3(new THREE.Vector3(-8.4, -22, -1.5), new THREE.Vector3(3.4, 3, 1.5));
    this.setObjective('down');
  }

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  /** The two flights below a main landing at `y` (south flight east/down, north flight west/down). */
  _buildFlights(y, withLowerLanding = true) {
    // south flight: 8 steps from x MAIN_X1 eastward, tops at y - RISE*(k+1); each step is 0.6 m thick
    for (let k = 0; k < STEPS; k++) {
      const top = y - RISE * (k + 1);
      this._box(RUN, 0.6, ZW, this._floorMat, MAIN_X1 + RUN * (k + 0.5), top - 0.3, -ZW / 2, { ground: true });
    }
    // half-landing (east) at y - HALF_H
    this._box(X1 - HALF_X0, 0.2, ZW * 2, this._floorMat, (X1 + HALF_X0) / 2, y - HALF_H - 0.1, 0, { ground: true });
    // north flight: 8 steps from x HALF_X0 westward, tops at y - HALF_H - RISE*(k+1)
    for (let k = 0; k < STEPS; k++) {
      const top = y - HALF_H - RISE * (k + 1);
      this._box(RUN, 0.6, ZW, this._floorMat, HALF_X0 - RUN * (k + 0.5), top - 0.3, ZW / 2, { ground: true });
    }
    // handrails on the open (inner) edges of both flights
    const rail = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.7 });
    const railS = this._box(HALF_X0 - MAIN_X1, 0.04, 0.04, rail, (MAIN_X1 + HALF_X0) / 2, y - HALF_H / 2 + 0.95, -0.02, { collide: false });
    railS.rotation.z = -Math.atan2(HALF_H, HALF_X0 - MAIN_X1);
    const railN = this._box(HALF_X0 - MAIN_X1, 0.04, 0.04, rail, (MAIN_X1 + HALF_X0) / 2, y - HALF_H - HALF_H / 2 + 0.95, 0.02, { collide: false });
    railN.rotation.z = Math.atan2(HALF_H, HALF_X0 - MAIN_X1);
    if (withLowerLanding) return;   // the next main landing is built by _buildFloor(i+1)
  }

  _buildFloor(i, L) {
    const y = L.y;
    // main landing slab (west) — the top face is the landing floor
    this._box(MAIN_X1 - X0, 0.2, ZW * 2, this._floorMat, (X0 + MAIN_X1) / 2, y - 0.1, 0, { ground: true });
    if (i < LANDINGS.length - 1) this._buildFlights(y);
    // west wall pieces around a door opening 0.95 wide centred at z 0, 2.1 high
    const wallX = X0 - 0.1;
    this._box(0.2, FLOOR_H, ZW - 0.475, this._concrete, wallX, y + FLOOR_H / 2, -(0.475 + (ZW - 0.475) / 2));
    this._box(0.2, FLOOR_H, ZW - 0.475, this._concrete, wallX, y + FLOOR_H / 2, (0.475 + (ZW - 0.475) / 2));
    this._box(0.2, FLOOR_H - 2.1, 0.95, this._concrete, wallX, y + 2.1 + (FLOOR_H - 2.1) / 2, 0);
    // label on the north wall, fire plan beside the door, bulb over the landing
    const label = makeSign({ text: L.label, width: 0.5, height: 0.5, bg: '#4a4844', color: '#d9d4c8', font: 'bold 160px Georgia' });
    label.position.set(-2.1, y + 1.5, ZW - 0.005); label.rotation.y = Math.PI;
    this.add(label);
    const plan = makeSign({ text: 'IN THE EVENT OF FIRE\ndo not use the lifts\ndo not run\nassembly point: the playground', width: 0.4, height: 0.5, bg: '#d8cfba', color: '#33302a', font: 'italic 24px Georgia' });
    plan.position.set(X0 + 0.005, y + 1.6, -0.95); plan.rotation.y = Math.PI / 2;
    this.add(plan);
    this.interact(plan, { prompt: 'the fire plan', onInteract: () => this.subtitle('do not run.', 3) });
    const bulb = makeBulbLight({ color: 0xd8dcd0, intensity: 3.2, distance: 7, y: 2.45 });
    bulb.position.set(-2.1, y, 0);
    if (i === 3) bulb.light.castShadow = true;
    this.add(bulb); this._bulbs[i] = bulb;
    if (i === 2 || i === 6) this._stutter(bulb, 3.2);
    const half = makeBulbLight({ color: 0xd8dcd0, intensity: 1.4, distance: 5, y: 2.3 });
    half.position.set((X1 + HALF_X0) / 2, y - HALF_H, 0);
    this.add(half);

    // the door in the west wall
    if (i === 0) {
      // the wardrobe's back: a wooden panel that shut behind you
      const back = makeDoor({ width: 0.95, height: 2.1, color: '#5a4636', knob: false });
      back.position.set(X0, y, 0); back.rotation.y = Math.PI / 2;
      this.add(back); this.track(back); this.addCollider(back.panel);
      this.interact(back, { prompt: 'the way you came', onInteract: () => { this.playSound('locked'); this.subtitle('It shut behind you. Wood, from this side, and no handle.', 5); } });
      return;
    }
    const door = makeDoor({ width: 0.95, height: 2.1, color: '#4f5a5e', frameColor: '#3a4043' });
    door.position.set(X0, y, 0); door.rotation.y = Math.PI / 2;
    this.add(door); this.track(door); this.addCollider(door.panel);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a1d20, transparent: true, opacity: 0.55, roughness: 0.1 }));
    glass.position.set(0.5, 1.55, 0.03); door.panel.parent.add(glass);   // on the swinging panel
    this._doors[i] = door;
    if (i <= 2) {
      const line = i === 1 ? 'Locked. Through the glass, a corridor with every light off.' : 'Locked. Someone has stacked chairs against the other side.';
      this.interact(door, { prompt: 'the fire door', onInteract: () => { this.playSound('locked'); this.subtitle(line, 5); } });
      return;
    }
    // stub corridor behind the door (x -3.2 .. -8.2), dark, lockers, a light at the far end
    const sy = y;
    const sf = this._box(5.0, 0.2, 1.4, this._floorMat, -5.7, sy - 0.1, 0, { ground: true });
    this._box(5.0, 2.6, 0.2, this._concrete, -5.7, sy + 1.3, -0.8);
    this._box(5.0, 2.6, 0.2, this._concrete, -5.7, sy + 1.3, 0.8);
    this._box(0.2, 2.6, 1.8, this._concrete, -8.3, sy + 1.3, 0);
    const sc = this._box(5.0, 0.2, 1.8, this._concrete, -5.7, sy + 2.7, 0, { collide: false });
    const lockerMat = new THREE.MeshStandardMaterial({ color: 0x6b7276, roughness: 0.6, metalness: 0.4 });
    for (let k = 0; k < 4; k++) this._box(0.36, 1.7, 0.4, lockerMat, -4.2 - k * 0.4, sy + 0.85, -0.5);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff1d6, emissiveIntensity: 0 }));
    glow.position.set(-8.19, sy + 2.0, 0); glow.rotation.y = Math.PI / 2;      // on the stub's end wall, facing back up the corridor
    this.add(glow);
    const light = new THREE.PointLight(0xfff1d6, 0, 6, 1.8);
    light.position.set(-7.5, sy + 2.0, 0);
    this.add(light);
    this._stubLights[i] = { glow, light, label: L.label, seenOff: null };
    this.whenSeen(glass, () => {
      if (this._loops >= 1 && this._stubLights[i].light.intensity > 0 && !this._saidWindow) {
        this._saidWindow = true;
        this.subtitle('A light on in the corridor beyond. One door closer than it was.', 5);
      }
    }, { once: false, maxDist: 6 });
    this.interact(door, { prompt: 'the fire door', onInteract: () => {
      if (this._exitIdx === i) return;
      this.playSound('locked'); this.subtitle('Locked. Through the glass, lockers, and a light a long way down.', 5);
    } });
    // chalk on the south wall of the −2 landings
    if (L.label === '-2') {
      const chalk = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshStandardMaterial({ map: this._chalk, roughness: 1 }));
      chalk.position.set(-2.1, y + 1.2, -ZW + 0.005);
      this.add(chalk);
      this.interact(chalk, { prompt: 'chalk', onInteract: () => this.learnClue({ id: 'l12-chalk', title: 'chalk on the −2 landing', body: `${Math.min(this._loops + 1, 12)} strokes. and, underneath: wait for me.` }) });
    }
    void sf; void sc;
  }

  _stutter(bulb, base) {
    let tNext = 0;
    this.tick((dt, t) => {
      if (t > tNext) {
        const on = Math.random() > 0.28;
        bulb.light.intensity = on ? base : base * 0.1;
        tNext = t + (on ? 0.15 + Math.random() * 1.8 : 0.04 + Math.random() * 0.14);
      }
    });
  }

  /** One label's stubs are lit per loop count: −3, then −2, then −1. */
  _updateWindowLights() {
    const lit = this._loops === 0 ? '-3' : this._loops === 1 ? '-2' : '-1';
    for (const s of this._stubLights) {
      if (!s) continue;
      const on = s.label === lit;
      s.light.intensity = on ? 2.2 : 0;
      s.light.color.set(0xfff1d6);
      s.glow.material.emissiveIntensity = on ? 1.2 : 0;
    }
  }

  _redrawChalk() {
    const lines = ['wait for me'];
    if (this._pleaded >= 1) lines.push('please');
    if (this._pleaded >= 2) lines.push('you always did this');
    this._chalk.redraw({ tally: Math.min(this._loops + 1, 12), lines });
  }
```

- [ ] **Step 2: Add the loop, the footsteps, stillness, the approach, and the door**

```js
  _wirePuzzle() {
    const s = this;
    this._loopOn = true; this._still = 0; this._stepAcc = 0; this._wasMoving = false;
    this._approach = null; this._toldOnce = false; this._done = false; this._exitIdx = null;
    this.dread(0.15);

    this.tick((dt) => {
      const pl = s.game.player;
      const footY = pl.position.y - 1.62;
      const v = Math.hypot(pl.velocity.x, pl.velocity.z);

      // the loop: mid-flight below the last −2, back up three floors, same heading
      if (this._loopOn && footY < LOOP_Y) {
        pl.teleport(pl.position.x, pl.position.z, pl.yaw, footY + LOOP_DY);
        this._loops++;
        this._redrawChalk();
        this._updateWindowLights();
        this.dread(Math.min(0.75, 0.15 + 0.15 * this._loops));
        return;
      }
      if (this._done) {
        if (this._exitIdx !== null && !this.isCompleted && pl.position.x < STUB_END_X &&
            Math.abs(footY - LANDINGS[this._exitIdx].y) < 1.0) this.complete();
        return;
      }
      if (this._approach) { this._runApproach(dt, v); return; }

      // footsteps one flight below, while you move; one more when you stop
      if (v > 0.5) {
        this._wasMoving = true;
        this._stepAcc += dt;
        if (this._stepAcc > 0.62) { this._stepAcc = 0; this._stepBelow(); }
      } else if (this._wasMoving) {
        this._wasMoving = false;
        this.after(0.5, () => this._stepBelow());
      }

      // stillness
      if (v < 0.05 && !s.game.ui.modalOpen) this._still += dt; else this._still = 0;
      if (this._still >= 8) {
        this._still = 0;
        if (footY > -8.0) {
          if (!this._toldOnce) { this._toldOnce = true; this.subtitle('Below you, the footsteps stop too. They are waiting to see what you do.', 6); }
        } else {
          this._startApproach();
        }
      }
    });
  }

  _stepBelow() {
    const pl = this.game.player;
    const j = () => (Math.random() - 0.5) * 0.6;
    const pos = { x: pl.position.x + j(), y: pl.position.y - 1.62 - 2.9, z: pl.position.z + j() };
    this.playSoundAt('stepOther', pos);
    if (!this._cuedSteps) { this._cuedSteps = true; this.cue('footsteps, below', pos); }
  }

  /** k = 0 → 2.9 m below; k = 1 → 0.5 m behind the player, at floor level. */
  _approachPos(k) {
    const pl = this.game.player, yaw = pl.yaw;
    const bx = Math.sin(yaw) * 0.5, bz = Math.cos(yaw) * 0.5;      // behind = (sin yaw, 0, cos yaw)
    return { x: pl.position.x + bx * k, y: pl.position.y - 1.62 - 2.9 * (1 - k) + 0.2, z: pl.position.z + bz * k };
  }

  /** A point `offset` metres to the player's left (negative = right) at ear height. */
  _sidePos(offset) {
    const pl = this.game.player, yaw = pl.yaw;
    return { x: pl.position.x - Math.cos(yaw) * offset, y: pl.position.y, z: pl.position.z + Math.sin(yaw) * offset };
  }

  /** The main landing at or nearest below the player, among the ones with stubs (indices 3..7). */
  _nearestLandingBelow() {
    const footY = this.game.player.position.y - 1.62;
    let idx = 3, bestY = -Infinity;
    LANDINGS.forEach((L, i) => { if (i >= 3 && L.y <= footY + 0.3 && L.y > bestY) { bestY = L.y; idx = i; } });
    return idx;
  }

  _startApproach() {
    this._approach = { t: 0, i: 0, breath: false, done: false, landing: this._nearestLandingBelow() };
  }

  _runApproach(dt, v) {
    const a = this._approach;
    a.t += dt;
    if (v > 0.3 && a.t < 6.0) { this._retreat(); return; }
    while (a.i < 10 && a.t >= a.i * 0.6) {
      const k = a.i / 9;
      this.playSoundAt('stepOther', this._approachPos(k));
      this.dread(0.35 + 0.65 * k);
      a.i++;
    }
    const bulb = this._bulbs[a.landing];
    if (bulb) bulb.light.intensity = 3.2 * (1 - 0.8 * Math.min(1, a.t / 6));
    if (!a.breath && a.t >= 6.0) {
      a.breath = true;
      const p = this._sidePos(0.35);
      this.playSoundAt('breath', p);
      this.cue('a breath', p);
      this.hush(3);
      this.flinch();
    }
    if (!a.done && a.t >= 6.5) {
      a.done = true;
      this._openDoor(a.landing);
      this._approach = null;
      this._done = true;
    }
  }

  _retreat() {
    const a = this._approach;
    this._approach = null;
    this._pleaded++;
    this._still = 0;
    this.dread(0.4);
    const bulb = this._bulbs[a.landing];
    if (bulb) bulb.light.intensity = 3.2;
    for (let i = 0; i < 6; i++) this.after(i * 0.5, () => this.playSoundAt('stepOther', this._approachPos(Math.max(0, 1 - i / 5))));
    this.subtitle('It goes back down. It will wait as long as you make it.', 5);
  }

  _openDoor(idx) {
    const door = this._doors[idx];
    this._exitIdx = idx;
    this._loopOn = false;
    this.playSound('unlock');
    door.setOpen(true, 1);                                     // swing OUT into the stub (−X); flip the sign if it swings into the shaft
    this.removeColliderOf(door.panel);
    const s = this._stubLights[idx];
    s.light.intensity = 4; s.light.color.set(0xffd9a8); s.glow.material.emissiveIntensity = 1.4;
    this.dread(0.5);
    this.setObjective('through');
    this.subtitle('The door beside you clicks, and swings, and there is nobody on the stairs at all.', 6);
  }

  async debugSolve() {
    const pl = this.game.player;
    pl.teleport(-2.1, 0, pl.yaw, LANDINGS[3].y);   // onto the −1 landing
    await this.debugWait(8.6);                     // still → the approach
    await this.debugWait(6.8);                     // it arrives; the −1 door opens
    pl.teleport(-7.9, 0, pl.yaw);                  // into the stub, past the threshold
    await this.debugWait(0.6);
  }
}
```

- [ ] **Step 3: Verify, then look at the shots and fix the stair**

```bash
npx vite build
node tools/screenshot.mjs 12 --port 5112
node tools/playtest.mjs 12 --port 5212
```
Expected: SOLVED at about 16–17 s. Check the shots: the first flight should descend to your right-front from spawn (a-spawn), the label "2" on the north wall, a caged bulb overhead, concrete everywhere, no gaps between flights and walls. If the player falls at spawn, the main landing slab is not registered as ground; if they cannot walk down, a step box is taller than 0.55 above the previous one (check `RISE`, `top - 0.3`).

- [ ] **Step 4: Commit**

```bash
git add src/levels/Level12.js
git commit -m "Add room XII (The Stairwell) — the loop, footsteps below, stand still and a door opens"
```

---

### Task 9: Room XIII — The School

**Files:**
- Create: `src/levels/Level13.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`playSoundAt`, `loopAt`, `cue`, `whenSeen`, `isSeen`, `flinch`, `dread`, `hush`, keypad `onKey`, `LevelBase.NOTES/tune`, `makeFluorescent`, `makeFigure` from Task 4).
- Produces: `Level13`.

Spec: §5.3 — read all of it first.

- [ ] **Step 1: Scaffold: constants, meta, corridor shell, fluorescents, spawn**

Create `src/levels/Level13.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import { makeDoor, makeWall, makeBulbLight, makeFluorescent, makeNoteProp, makeSign, makeTable, makeChair, makeShelf, applyFog } from '../core/props.js';
import { makeFigure } from '../core/presence.js';

// XIII — The School
// The primary school at night. Your peg has a sunflower and no name. The door
// plates lie; the music room is the one with the single note. The board has
// five of the seven; the tannoy has been chiming the other two all night.
// Play it on the hall piano and the fire door to the playground opens.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.3

const CW = 2.6, CH = 3.0, CLEN = 30;                     // corridor: x −1.3..1.3, z 0..−30
const TUBE_Z = (i) => -1.5 - 3 * i;                     // ten tubes
const TUNE = 'EGAGEGE';
const PIANO_POS = { x: -4, y: 1.5, z: -38.5 };
const HALL_SPEAKER = { x: 0, y: 4.8, z: -34 };
const SPEAKERS = [{ x: 0, y: 2.95, z: -8 }, { x: 0, y: 2.95, z: -24 }, HALL_SPEAKER];
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
const NAMES = ['ada', 'tom', 'nell', 'ruth', 'sam', 'iris', 'joe', 'may', 'ben', 'lou', 'edie', '', 'kit', 'fay', 'ned', 'wren'];   // peg 12 (index 11) is yours

export default class Level13 extends LevelBase {
  static meta = {
    id: 13,
    numeral: 'XIII',
    title: 'The School',
    mood: 'school',
    grade: GRADE,
    intro: 'The school is dark, and the bell has not rung, and someone is playing one note.',
    outro:
      'You played it once for her and never again.\n' +
      'Tonight it played itself, all the way to the end,\n' +
      'with nobody at the keys.',
  };

  build() {
    applyFog(this.scene, '#0b0d10', 2, 26);
    this._wallMat = makeMat('plaster', { base: '#a9a597', repeat: [4, 1] });
    this._dadoMat = makeMat('plaster', { base: '#6f7a72', repeat: [4, 1] });
    this._floorMat = makeMat('checker', { a: '#c9c3b2', b: '#8b8f8a', cell: 128, repeat: [3, 34] });
    this._ceilMat = makeMat('ceiling', { base: '#d8d4c8', repeat: [2, 20] });
    this._tubes = [];
    this._buildCorridor();
    this._buildRooms();        // office, classrooms 1 & 3, cupboards 2 & 4, locked 5 & 6, hall + stage + piano + fire door
    this._wirePuzzle();
    this.spawn.position.set(0, 0, 1.2);
    this.spawn.yaw = 0;
    this.bounds = new THREE.Box3(new THREE.Vector3(-8, 0, -41), new THREE.Vector3(10.5, 5, 2.4));
    this.setObjective('your peg is somewhere along here');
  }

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  _buildCorridor() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(CW, CLEN + 3), this._floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -CLEN / 2 + 1); floor.receiveShadow = true;
    this.add(floor); this.addGround(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CW, CLEN + 3), this._ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CH, -CLEN / 2 + 1);
    this.add(ceil);
    // long walls in segments so doors can be cut: build a helper that adds wall between two z values on side ±1
    this._wallSeg = (side, z0, z1) => {
      const len = z0 - z1, zc = (z0 + z1) / 2;
      this._box(0.2, CH, len, this._wallMat, side * (CW / 2 + 0.1), CH / 2, zc);
      this._box(0.03, 1.1, len, this._dadoMat, side * (CW / 2 - 0.015), 0.55, zc, { collide: false });
    };
    // door z positions per side (each door 1.0 wide): west 1,2,3; east office,4,5,6
    const west = [-11, -17, -23], east = [-3, -15, -21, -27];
    for (const [side, doors] of [[-1, west], [1, east]]) {
      let z = 2;
      for (const dz of doors) { this._wallSeg(side, z, dz + 0.5); this._box(0.2, CH - 2.1, 1.0, this._wallMat, side * (CW / 2 + 0.1), 2.1 + (CH - 2.1) / 2, dz); z = dz - 0.5; }
      this._wallSeg(side, z, -CLEN);
    }
    // entrance end: the fire door you came through, locked, and a wet-floor sign
    this._box(CW + 0.4, CH, 0.2, this._wallMat, 0, CH / 2, 2.1);
    const entry = makeDoor({ width: 0.95, color: '#4f5a5e', frameColor: '#3a4043' });
    entry.position.set(0, 0, 2.0); this.add(entry); this.track(entry); this.addCollider(entry.panel);
    this.interact(entry, { prompt: 'the door you came through', onInteract: () => { this.playSound('locked'); this.subtitle('It shut behind you. They always do.', 4); } });
    this._entranceMarker = new THREE.Object3D(); this._entranceMarker.position.set(0, 1.5, 0); this.add(this._entranceMarker);
    // fluorescents
    for (let i = 0; i < 10; i++) {
      const fix = makeFluorescent({ length: 1.4, intensity: 4.5, flicker: i === 3 ? 0.35 : 0 });
      fix.position.set(0, CH - 0.05, TUBE_Z(i));
      this.add(fix); this.track(fix);
      this._tubes.push({ fix, light: fix.light, tubeMat: fix.children[0].material, z: TUBE_Z(i) });
    }
    this.add(new THREE.HemisphereLight(0x6f7580, 0x15171b, 0.35));
    // tannoy speakers: small boxes on the ceiling
    const spk = new THREE.MeshStandardMaterial({ color: 0x8b8f8c, roughness: 0.6 });
    for (const p of SPEAKERS.slice(0, 2)) this._box(0.25, 0.1, 0.25, spk, p.x, p.y, p.z, { collide: false });
    // pegs (west, z −2..−7) and lockers (east, z −6..−12)
    this._buildPegs();
    this._buildLockers();
  }

  _buildPegs() {
    const rail = this._box(0.06, 0.05, 5.0, new THREE.MeshStandardMaterial({ color: 0x5a4a3c }), -CW / 2 + 0.05, 1.5, -4.5, { collide: false });
    void rail;
    const hookMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.7, roughness: 0.4 });
    NAMES.forEach((name, i) => {
      const z = -2.2 - i * 0.3;
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 6), hookMat);
      hook.rotation.z = Math.PI / 2; hook.position.set(-CW / 2 + 0.1, 1.45, z);
      this.add(hook);
      let tex;
      if (i === 11) {
        // the sunflower card
        const c = document.createElement('canvas'); c.width = 128; c.height = 96;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#e8e0cf'; ctx.fillRect(0, 0, 128, 96);
        ctx.fillStyle = '#e2b53a';
        for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.ellipse(64 + Math.cos(k / 12 * Math.PI * 2) * 22, 40 + Math.sin(k / 12 * Math.PI * 2) * 22, 8, 5, k / 12 * Math.PI * 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#5a3d1e'; ctx.beginPath(); ctx.arc(64, 40, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#4c7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(64, 52); ctx.lineTo(62, 92); ctx.stroke();
        tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      } else {
        tex = textTexture({ text: name, width: 128, height: 96, font: 'italic 30px Georgia', bg: '#e8e0cf', color: '#3a3630' });
      }
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.09), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      card.position.set(-CW / 2 + 0.005, 1.65, z); card.rotation.y = Math.PI / 2;
      this.add(card);
      if (i === 11) {
        this._pegCard = card;
        const coat = this._box(0.14, 0.9, 0.34, new THREE.MeshStandardMaterial({ color: 0x5c4a3d, roughness: 1 }), -CW / 2 + 0.12, 1.0, z, { collide: false });
        void coat;
      }
    });
  }

  _buildLockers() {
    const lockerMat = new THREE.MeshStandardMaterial({ color: 0x7c8386, roughness: 0.6, metalness: 0.4 });
    const lines = ['Locked. Something inside shifts, and settles.', 'Locked. A drawing is taped inside — you can see its corner.', 'Locked.'];
    for (let n = 1; n <= 12; n++) {
      const z = -6.2 - (n - 1) * 0.5;
      const body = this._box(0.4, 1.7, 0.36, lockerMat, CW / 2 - 0.2, 0.85, z);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshStandardMaterial({ map: textTexture({ text: String(n), width: 96, height: 64, font: 'bold 40px Georgia', bg: '#d8cfba', color: '#2e2618' }) }));
      plate.position.set(CW / 2 - 0.405, 1.55, z); plate.rotation.y = -Math.PI / 2;
      this.add(plate);
      if (n === 12) {
        this._locker12 = body;
        const key = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), new THREE.MeshStandardMaterial({ color: 0xc9a54e, metalness: 0.9, roughness: 0.3 }));
        key.position.set(CW / 2 - 0.42, 1.0, z); key.visible = false; this.add(key); this._lockerKey = key;
      } else {
        this.interact(body, { prompt: 'locker ' + n, onInteract: () => { this.playSound('locked'); this.subtitle(lines[n % 3], 4); } });
      }
    }
  }
```

- [ ] **Step 2: Add the rooms, the hall, and the puzzle wiring**

```js
  _buildRooms() {
    // Interiors per spec §5.3 (Step 3 below lists each). Build each room as a box behind its door with its own
    // floor/ceiling/walls (west rooms extend to x −7.3; the east office to x +5.3; the hall spans x −7..7,
    // z −30..−40, height 5). Members _wirePuzzle needs: this._door3, this._door4, this._board, this._uprightPos,
    // this._register, this._tannoyPanel, this._hallDoors (a Group holding two makeDoor, left added first),
    // this._hallDoorPanels [panelL, panelR], this._piano (the grand: a Group), this._lid (mesh, rotation.x 0.9 raised),
    // this._stool (mesh), this._fireDoor (makeDoor at (7, 0, -37) rotated into the hall's east wall) plus its stub to x 10.
    // Every door: makeDoor + track + panel collider. Doors 1, 2 and the office: this._openable(door, dir) here.
    // Doors 3 and 4 are wired in _wirePuzzle. Doors 5 and 6: interact → locked + their lines.
    //
    // …build the interiors here, then the three lines below run last…

    // Piano key loop from the music room, audible in the corridor (this._uprightPos must be set above):
    this.loopAt('pianoKey', this._uprightPos, { freq: LevelBase.NOTES.E, every: 2.6 });
    // the tap behind door 5:
    this.loopAt('tap', { x: -3.5, y: 1.0, z: -21 }).setGain(0.4);
    // hall speaker box:
    this._box(0.3, 0.12, 0.3, new THREE.MeshStandardMaterial({ color: 0x8b8f8c }), HALL_SPEAKER.x, HALL_SPEAKER.y, HALL_SPEAKER.z, { collide: false });
    // the figure for the corridor set-piece, hidden until then
    this._figure = makeFigure(); this._figure.visible = false; this.add(this._figure);
  }

  _openable(door, dir, onOpen) {
    let open = false;
    this.interact(door, { prompt: 'the door', onInteract: () => {
      if (open) return;
      open = true; door.setOpen(true, dir); this.removeColliderOf(door.panel); this.playSound('door'); onOpen?.();
    } });
  }

  _wirePuzzle() {
    const s = this;
    this._hasNote = false; this._lightsDone = false; this._tuneDone = false; this._wrongTune = 0;

    // the peg with the sunflower → the timetable
    this.interact(this._pegCard, { prompt: 'the peg with the sunflower', once: true, onInteract: () => {
      this.subtitle('Your peg. No name — she drew a sunflower so you would know it.', 5);
      this.after(1.6, () => {
        this.giveNote({
          id: 'l13-timetable',
          title: 'a timetable, folded small, in the coat pocket',
          body:
            'MON — music, rm 4\nTUE — sums\nWED — reading\nTHU — nature\nFRI — hall\nSUN — home\n\n' +
            'the tune from the wireless. you played it for me\non the hall piano. once, then never again.\n\n— M.',
        });
        this._hasNote = true;
        this.setObjective('music. room 4.');
      });
    } });

    // locker 12: the hall key
    this.interact(this._locker12, { prompt: 'locker 12', once: true, onInteract: () => {
      this._lockerKey.visible = true;
      this.after(0.4, () => { this._lockerKey.visible = false; this.giveItem({ id: 'hall-key', name: 'a small key on a wool loop' }); this.subtitle('HALL, in her writing on the tag.', 4); });
    } });

    // doors: 4 lies, 3 is the music room, 1 and 2 open onto flavour, 5 and 6 are locked
    this._openable(this._door4, 1, () => this.after(0.8, () => this.subtitle('Mops. A bucket. Whoever numbered the doors did it in the dark.', 6)));
    this._openable(this._door3, 1);
    this.interact(this._board, { prompt: 'the board', once: true, onInteract: () => {
      this.learnClue({ id: 'l13-board', title: 'the board in the music room', body: 'our song — E G A G E, and two more, rubbed out.' });
      this.setObjective('the last two notes');
    } });
    this.interact(this._register, { prompt: 'the register', onInteract: () => this.subtitle('The register. A line for every child. Yours says "left early", every day but Sunday.', 6) });
    this.interact(this._tannoyPanel, { prompt: 'the tannoy panel', onInteract: () => this.learnClue({ id: 'l13-tannoy', title: 'the tannoy panel', body: 'chime: G, then E. do not adjust.' }) });

    // the hall doors want the wool-loop key
    this._hallOpen = false;
    this.interact(this._hallDoors, { prompt: 'the hall doors', onInteract: () => {
      if (this._hallOpen) return;
      if (!this.hasItem('hall-key')) { this.playSound('locked'); this.subtitle('Locked. HALL, stencilled on the glass. Your locker had a key.', 5); return; }
      this._hallOpen = true; this.playSound('unlock'); this.playSound('door');
      this._hallDoors.children[0].setOpen(true, -1); this._hallDoors.children[1].setOpen(true, 1);
      for (const p of this._hallDoorPanels) this.removeColliderOf(p);
    } });

    // the tannoy chime, every 24 s from the nearest speaker; first at 10 s
    const chime = () => {
      const p = s.game.player.position;
      const spk = SPEAKERS.reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b));
      this.playSoundAt('chime', spk); this.cue('the tannoy chime', spk);
      this.after(24, chime);
    };
    this.after(10, chime);

    // the corridor lights: once, when you are deep in and facing away from the entrance
    this.tick(() => {
      if (!this._lightsDone && this._hasNote && s.game.player.position.z < -14 && !this.isSeen(this._entranceMarker, { angleDeg: 60 })) {
        this._lightsDone = true;
        this._runLights();
      }
    });

    // the hall piano
    this.interact(this._piano, { prompt: 'the hall piano', onInteract: () => {
      if (this._tuneDone) { this.subtitle('It has already played. It does not need you now.', 4); return; }
      s.game.ui.showKeypad({
        label: 'the hall piano — seven notes', length: 7, keys: 'CDEFGAB',
        onKey: (k) => this.playSoundAt('piano', PIANO_POS, { freq: LevelBase.NOTES[k] }),
        onSubmit: (code) => (code === TUNE ? this._tuneRight() : this._tuneWrong()),
      });
    } });

    // the fire door by the stage
    this._fireOpen = false;
    this.interact(this._fireDoor, { prompt: 'PLAYGROUND', onInteract: () => {
      if (this._fireOpen) return;
      this.playSound('locked'); this.subtitle('Locked. PLAYGROUND, on the bar. It will open when the song does.', 5);
    } });
    this.tick(() => { if (this._fireOpen && !this.isCompleted && s.game.player.position.x > 9.5) this.complete(); });
  }

  _tubeOff(i) {
    const tb = this._tubes[i];
    this._tracked.delete(tb.fix);            // stop its own flicker, if any
    tb.light.intensity = 0;
    tb.tubeMat.emissiveIntensity = 0.05;
    const pos = { x: 0, y: 2.9, z: tb.z };
    this.playSoundAt('clunk', pos);
    return pos;
  }

  _runLights() {
    const pz = this.game.player.position.z;
    let p = 0, best = Infinity;
    this._tubes.forEach((tb, i) => { const d = Math.abs(tb.z - pz); if (d < best) { best = d; p = i; } });
    if (p < 3) return;                         // cannot happen (trigger needs z < −14) — guard anyway
    for (let i = 0; i <= p - 3; i++) {
      this.after(i * 0.9, () => { const pos = this._tubeOff(i); if (i === 0) this.cue('a light going out', pos); });
    }
    this.after(Math.max(0, p - 2) * 0.9, () => {
      this._figure.position.set(0, 0, this._tubes[p - 2].z);
      this._figure.faceToward(this.game.player.position);
      this._figure.visible = true;
      this.whenSeen(this._figure, () => {
        this._tubeOff(p - 2);
        this._figure.visible = false;
        this.flinch();
        this.after(1.0, () => this._tubeOff(p - 1));
        this.after(2.2, () => this._flickerHold(p));
        this.dread(0.55);
      }, { minTime: 1.0 });
    });
  }

  _flickerHold(p) {
    const tb = this._tubes[p];
    this._tracked.delete(tb.fix);
    let n = 0;
    const flick = () => {
      if (n++ > 10) {
        tb.light.intensity = 4.5; tb.tubeMat.emissiveIntensity = 2.6;
        this.subtitle('The corridor behind you is dark now. The office keeps its light. Nothing else does.', 6);
        return;
      }
      const on = Math.random() > 0.5;
      tb.light.intensity = on ? 4.5 : 0.4; tb.tubeMat.emissiveIntensity = on ? 2.6 : 0.3;
      this.after(0.08 + Math.random() * 0.25, flick);
    };
    flick();
  }

  _tuneWrong() {
    this.playSound('wrong');
    this._wrongTune++;
    if (this._wrongTune >= 3) this.subtitle('The board had five of them. The school has been chiming the other two all night.', 7);
    else this.subtitle('Not how it went. She would have said so, gently.', 5);
    this._lid.rotation.x = 0.15;
    this.after(2, () => { this._lid.rotation.x = 0.9; });
  }

  _tuneRight() {
    this._tuneDone = true;
    this.hush(2);
    const notes = LevelBase.tune(TUNE);
    this.after(0.8, () => {
      for (let r = 0; r < 2; r++) notes.forEach((f, i) => this.after(r * 4 + i * 0.5, () => this.playSoundAt('piano', PIANO_POS, { freq: f })));
    });
    this._stool.position.z += 0.4;
    this.playSound('door');
    this.playSound('unlock');
    this._fireDoor.setOpen(true, 1);                       // swing into the stub (+X); flip the sign if it swings into the hall
    this.removeColliderOf(this._fireDoor.panel);
    this._fireOpen = true;
    this.setObjective('the door by the stage');
    this.subtitle('It carries on without you. All the way to the end.', 6);
    this.after(6, () => { this.playSoundAt('breath', HALL_SPEAKER); this.cue('a breath, over the tannoy', HALL_SPEAKER); });
  }

  async debugSolve() {
    this.debugInteract(this._pegCard);
    await this.debugWait(2.0);                 // the note comes 1.6 s after the subtitle
    this.game.ui.closeModal();
    this.debugInteract(this._locker12);
    await this.debugWait(0.6);
    this.debugInteract(this._hallDoors);
    await this.debugWait(0.4);
    this.debugInteract(this._door3);
    await this.debugWait(0.3);
    this.debugInteract(this._board);
    await this.debugWait(0.3);
    this.debugInteract(this._piano);
    await this.debugWait(0.3);
    this.game.ui.submitKeypad(TUNE);
    await this.debugWait(1.5);
    this.game.player.teleport(9.8, -37);       // inside the stub, past x 9.5, on its floor
    await this.debugWait(0.6);
  }
}
```

- [ ] **Step 3: Build the interiors (fill in `_buildRooms`)**

Follow spec §5.3 Layout. Concretely:

- Office (east, behind the door at z −3): floor/ceiling/walls for x 1.3..5.3, z −1.5..−4.5; its own `makeBulbLight` (stays on); a desk (`makeTable`) with `this._register` (a thin box 0.3 × 0.04 × 0.22 on it); `this._tannoyPanel` (box 0.4 × 0.3 × 0.1 on the east wall with a `makeSign({ text: 'chime: G · E — do not adjust', width: 0.4, height: 0.12, font: 'italic 26px Georgia' })` below it). Door: `_openable(officeDoor, -1)`.
- Classroom 1 (west, door z −11): x −7.3..−1.3, z −8.5..−13.5; eight desks with chairs on them (`makeTable`, `makeChair` rotated upside down on top); a board (`makeSign({ text: '4 · 2 · 3 · 6 =', width: 2, height: 1, bg: '#2f3a34', color: '#e0dccf' })`) with an interact → `'Somebody's sum. The answer is rubbed out.'`.
- Cupboard 2 (west, z −17): x −2.7..−1.3, z −16.3..−17.7; shelves (`makeShelf`), a bucket; a `whenSeen`-free approach: an invisible marker inside with a `tick` that shows the subtitle once when the player's z is within the cupboard and x < −1.4.
- Music room 3 (west, z −23): x −7.3..−1.3, z −20.5..−25.5; desks with chairs upended; one chair down at the front desk; the upright piano box at (−6.6, 0.6, −23) against the far wall (`this._uprightPos` above it); interact → `this.playSoundAt('piano', this._uprightPos, { freq: LevelBase.NOTES.E })` + subtitle `'Only one key still sounds. E. The rest are dead.'`; `this._board = makeSign({ text: 'our song\nE  G  A  G  E  —  —', width: 2, height: 1, bg: '#2f3a34', color: '#e0dccf', font: 'italic 60px Georgia' })` on the room's north wall.
- Cupboard 4 (east, z −15): x 1.3..2.7, z −14.3..−15.7; mops (thin cylinders) and a bucket.
- Doors 5 (z −21) and 6 (z −27), east: `makeDoor` + panel collider + interact → `locked` + their lines.
- Hall (z −30..−40, x −7..7, height 5): floor wood (`makeMat('wood', { repeat: [6, 5] })`), walls `makeMat('plaster', { base: '#8f8a7c' })`, `HemisphereLight` 0.25, two `makeBulbLight({ y: 4.6, intensity: 6, distance: 16 })`; the double doors at z −30: two `makeDoor({ width: 0.9 })` at x −0.5 and +0.5 (the right one rotated π so its hinge is on the outside), both tracked, panels as colliders, grouped in `this._hallDoors` with `this._hallDoorPanels = [left.panel, right.panel]`; stacked chairs along the side walls; the stage (a box 14 × 0.6 × 2 at z −39, top at 0.6, `addCollider(stage, { alsoGround: true })`); the grand piano at (−4, 0.6, −38.5): body box 1.6 × 0.35 × 1.4 at y 0.6 + 0.85, three legs, `this._lid` (box 1.5 × 0.03 × 1.3, `rotation.x = 0.9`, hinged along the far edge — position it so it rises from the back of the body), a keys strip (box 1.2 × 0.02 × 0.2, `'#e6dfd0'`) on the near side, `this._stool` (`makeChair` without a back or a small box) at (−4, 0.6, −37.4); the whole grand grouped in `this._piano` (`addCollider` the body).
- Fire door: `this._fireDoor = makeDoor({ width: 1.0, color: '#4f5a5e', frameColor: '#3a4043' })` at (7, 0, −37), `rotation.y = -Math.PI / 2` (in the east wall); stub: floor x 7..10 at z −37.9..−36.1, walls, ceiling, one dim bulb; blocker at x 10.2.

Then run the verify loop and iterate on the shots: from spawn the corridor should recede under a row of tubes with the pegs to the left and lockers to the right; the fourth tube flickers.

- [ ] **Step 4: Verify**

```bash
npx vite build
node tools/screenshot.mjs 13 --port 5113
node tools/playtest.mjs 13 --port 5213
```
Expected: SOLVED in about 7 s. If the keypad submit does nothing, check that `showKeypad` received `keys: 'CDEFGAB'` and `length: 7` (the auto-submit fires at 7 keys; `submitKeypad` bypasses it).

- [ ] **Step 5: Commit**

```bash
git add src/levels/Level13.js
git commit -m "Add room XIII (The School) — the peg with the sunflower, the plates that lie, the tune on the hall piano"
```

---

### Task 10: Room XIV — The Playground

**Files:**
- Create: `src/levels/Level14.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`playSoundAt`, `loopAt`, `cue`, `whenUnseen`, `whenSeen`, `hush`, `dread`, `makeSky`, `makeBench`), Task 4 (`makeFigure`, `Presence`).
- Produces: `Level14`.

Spec: §5.4 — read all of it first, especially the station table and the per-tick enable rule.

- [ ] **Step 1: Scaffold: constants, meta, ground, sky, fence, gate, lamps, spawn**

Create `src/levels/Level14.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat } from '../core/textures.js';
import { makeSky, makeDoor, makeWall, makeSign, makeBench, applyFog } from '../core/props.js';
import { makeFigure, Presence } from '../core/presence.js';

// XIV — The Playground
// Hide-and-seek in the dark. The figure comes only while you hide and only
// while you are not looking; two knocks mean "still there — you can come out".
// After the third place it stands in the open, then walks to the gate and
// unlocks it, and goes ahead.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.4

const V = (x, y, z) => ({ x, y, z });
const STATIONS = [
  V(-1, 0, -11.5),                                          // 0  S0 start, by the gate
  V(4, 0, -8.5), V(8.5, 0, -7.5), V(12.6, 0, -6),           // 1..3  toward the pipe (3 = outside its east mouth)
  V(5, 0, -2),                                              // 4  R1 rest
  V(9, 0, -6), V(12, 0, -8), V(11.4, 0, -11.6),             // 5..7  toward the shed (7 = its south-west corner)
  V(7, 0, 1),                                               // 8  R2 rest
  V(-3, 0, 3), V(-8, 0, 5), V(-9.2, 0, 8.1),                // 9..11 toward the shelter (11 = the east end of the gap)
  V(-8.2, 0, 5.4),                                          // 12 R3 rest, in the open
];
const HIDES = {
  pipe:    new THREE.Box3(new THREE.Vector3(9.4, 0, -6.7), new THREE.Vector3(11.6, 2, -5.3)),
  shed:    new THREE.Box3(new THREE.Vector3(12, 0, -12.6), new THREE.Vector3(14.5, 2, -11.3)),
  shelter: new THREE.Box3(new THREE.Vector3(-12.5, 0, 7.6), new THREE.Vector3(-9.5, 2, 8.6)),
  frame:   new THREE.Box3(new THREE.Vector3(9, 0, 3), new THREE.Vector3(11, 2, 5)),          // decoy
  slide:   new THREE.Box3(new THREE.Vector3(7, 0, -5), new THREE.Vector3(9, 2, -3)),          // decoy
};
const PHASES = [
  { hide: 'pipe', hideStation: 3, rest: 4, objective: 'the second place' },
  { hide: 'shed', hideStation: 7, rest: 8, objective: 'the last place' },
  { hide: 'shelter', hideStation: 11, rest: 12, objective: '' },
];
const GATE = V(0, 0, -13);
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level14 extends LevelBase {
  static meta = {
    id: 14,
    numeral: 'XIV',
    title: 'The Playground',
    mood: 'playground',
    grade: GRADE,
    intro: 'Coming, ready or not.',
    outro:
      'You hid where you always hid,\n' +
      'and she found you where she always found you,\n' +
      'and pretended, again, to be surprised.',
  };

  build() {
    applyFog(this.scene, '#1c1e2a', 6, 60);
    this.add(makeSky({ top: '#0d1020', mid: '#232a3d', bottom: '#4a4256' }));
    this.add(new THREE.HemisphereLight(0x3d4660, 0x0d0e14, 0.55));
    const moon = new THREE.DirectionalLight(0x6d7aa0, 0.35);
    moon.position.set(-10, 20, 10); moon.castShadow = true;
    moon.shadow.camera.left = -20; moon.shadow.camera.right = 20; moon.shadow.camera.top = 20; moon.shadow.camera.bottom = -20;
    moon.shadow.mapSize.set(2048, 2048);
    this.add(moon);

    const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(36, 28), makeMat('asphalt', { base: '#3e3f44', repeat: [10, 8] }));
    tarmac.rotation.x = -Math.PI / 2; tarmac.receiveShadow = true;
    this.add(tarmac); this.addGround(tarmac);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3, 8), makeMat('asphalt', { base: '#33343a', repeat: [1, 3] }));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0, -17);
    this.add(path); this.addGround(path);

    this._occluders = [];
    this._buildEdges();       // school wall + exit stub, fence, gate + padlock, hedges beyond, the last house
    this._buildLamps();       // working lamp (2, 2) with hum, dead lamp (-3, -10) that barely flickers
    this._buildEquipment();   // swings, roundabout, slide + pipe, climbing frame, shelter + rhyme + hedge, shed
    this._buildFigure();
    this._wirePuzzle();

    this.spawn.position.set(-6, 0, 10.5);
    this.spawn.yaw = 0;
    this.bounds = new THREE.Box3(new THREE.Vector3(-16.5, 0, -20), new THREE.Vector3(16.5, 6, 11.5));
    this.setObjective('the rhyme on the shelter wall');
  }

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  _buildEdges() {
    const brick = makeMat('plaster', { base: '#6e5f57', repeat: [12, 2] });
    this._box(36, 6, 0.4, brick, 0, 3, 12.2);
    // the fire door stub you came out of, lit for 3 s then dark
    const stubLight = new THREE.PointLight(0xffe4b8, 3, 6, 1.8);
    stubLight.position.set(-6, 2.2, 11.6); this.add(stubLight);
    this.after(3, () => { stubLight.intensity = 0; this.playSoundAt('clunk', { x: -6, y: 2.2, z: 11.6 }); });
    // fence: posts + translucent mesh planes; blockers along all three sides, gap for the gate
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.6, roughness: 0.5 });
    const meshMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
    const fenceRun = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 3);
      for (let i = 0; i <= n; i++) {
        const t = i / n; const post = this._box(0.06, 2, 0.06, postMat, x0 + (x1 - x0) * t, 1, z0 + (z1 - z0) * t, { collide: false });
        void post;
      }
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, 2), meshMat);
      plane.position.set((x0 + x1) / 2, 1, (z0 + z1) / 2);
      plane.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      this.add(plane);
    };
    fenceRun(-17, 12, -17, -13); fenceRun(17, 12, 17, -13); fenceRun(-17, -13, -0.6, -13); fenceRun(0.6, -13, 17, -13);
    this.addBlocker([-17.2, 0, -13.2], [-16.8, 2.2, 12]); this.addBlocker([16.8, 0, -13.2], [17.2, 2.2, 12]);
    this.addBlocker([-17.2, 0, -13.2], [-0.6, 2.2, -12.8]); this.addBlocker([0.6, 0, -13.2], [17.2, 2.2, -12.8]);
    // the gate and its padlock
    this._gate = makeDoor({ width: 1.2, height: 2.0, color: '#3a3f45', frameColor: '#2c3035', knob: false });
    this._gate.position.set(GATE.x, 0, GATE.z);
    this.add(this._gate); this.track(this._gate); this.addCollider(this._gate.panel);
    this._padlock = this._box(0.08, 0.12, 0.05, new THREE.MeshStandardMaterial({ color: 0x8a7a55, metalness: 0.8, roughness: 0.3 }), 0.5, 1.05, -12.95, { collide: false });
    this.interact(this._gate, { prompt: 'the gate', onInteract: () => { if (this._gateOpen) return; this.playSound('locked'); this.subtitle('Chained. A padlock the size of your fist, and no key you have ever seen.', 5); } });
    // hedges beside the path beyond the gate; the end of the path
    const hedge = new THREE.MeshStandardMaterial({ color: 0x1e2a1e, roughness: 1 });
    this._box(1.2, 1.8, 8, hedge, -2.1, 0.9, -17); this._box(1.2, 1.8, 8, hedge, 2.1, 0.9, -17);
    this.addBlocker([-3, 0, -21], [3, 3, -20.5]);
    // the last house beyond the fence, one window lit
    this._box(8, 5, 6, new THREE.MeshStandardMaterial({ color: 0x0f1015, roughness: 1 }), -12, 2.5, -22, { collide: false });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a2, emissiveIntensity: 1.6 }));
    win.position.set(-10, 2.6, -18.99); this.add(win);
    const winLight = new THREE.PointLight(0xffd9a2, 2.5, 12, 1.5); winLight.position.set(-10, 2.6, -18.5); this.add(winLight);
  }

  _buildLamps() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.5, roughness: 0.6 });
    const post = (x, z) => { this._box(0.12, 4.5, 0.12, postMat, x, 2.25, z); this._box(0.5, 0.2, 0.3, postMat, x, 4.4, z, { collide: false }); };
    post(2, 2);
    this._lamp = new THREE.PointLight(0xffe4b8, 6, 18, 1.6); this._lamp.position.set(2, 4.2, 2); this._lamp.castShadow = false; this.add(this._lamp);
    this.loopAt('hum', { x: 2, y: 4.2, z: 2 });
    post(-3, -10);
    const dead = new THREE.PointLight(0xffe4b8, 0, 10, 1.6); dead.position.set(-3, 4.2, -10); this.add(dead);
    let tNext = 0;
    this.tick((dt, t) => { if (t > tNext) { const on = Math.random() < 0.05; dead.intensity = on ? 1.2 : 0; tNext = t + (on ? 0.06 + Math.random() * 0.1 : 0.4 + Math.random() * 2.5); } });
  }
```

- [ ] **Step 2: Add the equipment, the figure, and the puzzle wiring**

```js
  _buildEquipment() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x5c6066, metalness: 0.7, roughness: 0.4 });
    const wood = makeMat('wood', { base: '#4a3a2c', repeat: [1, 1] });
    const concrete = makeMat('concrete', { base: '#7a766f', repeat: [2, 2] });

    // swings at (-9, 0, -3): frame along x, five seats; seat 3 swings
    for (const sx of [-2, 2]) { this._box(0.08, 2.4, 0.08, steel, -9 + sx, 1.2, -3); }
    this._box(4.2, 0.08, 0.08, steel, -9, 2.4, -3, { collide: false });
    this._swingSeats = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group(); g.position.set(-9 - 1.6 + i * 0.8, 2.4, -3);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.9, 6), steel); chain.position.y = -0.95;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.2), wood); seat.position.y = -1.9;
      g.add(chain, seat); this.add(g); this._swingSeats.push(g);
      this.interact(seat, { prompt: 'a swing', onInteract: () => this.subtitle('The chains are cold. This one moves by itself, and always did.', 5) });
    }
    this._swingLoop = this.loopAt('swing', { x: -9, y: 2.4, z: -3 });
    this._swinging = true;
    this.tick((dt, t) => { if (this._swinging) this._swingSeats[2].rotation.x = 0.55 * Math.sin(t * 1.55); });

    // roundabout at (0, 0, -6): turns a little while unseen
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.35, 24), steel);
    disc.position.set(0, 0.175, -6); this.add(disc); this.addCollider(disc);
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), steel); r.position.set(Math.cos(i / 6 * Math.PI * 2) * 1.2, 0.65, -6 + Math.sin(i / 6 * Math.PI * 2) * 1.2); disc.add(r); }
    this.whenUnseen(disc, () => { disc.rotation.y += 0.6; }, { once: false, minTime: 1.2 });
    this.interact(disc, { prompt: 'the roundabout', onInteract: () => this.subtitle('It has turned since you looked. Only a little.', 4) });

    // slide at (8, 0, -4) and the pipe beside it
    const platform = this._box(1.2, 0.1, 1.2, steel, 8, 2.2, -4, { collide: false });
    this._box(0.08, 2.2, 0.08, steel, 7.5, 1.1, -3.5); this._box(0.08, 2.2, 0.08, steel, 8.5, 1.1, -3.5);
    this._box(0.08, 2.2, 0.08, steel, 7.5, 1.1, -4.5); this._box(0.08, 2.2, 0.08, steel, 8.5, 1.1, -4.5);
    const slope = this._box(0.9, 0.05, 3.2, steel, 8, 1.1, -6.2, { collide: false }); slope.rotation.x = -0.6;
    this._occluders.push(platform);
    // the pipe: a concrete tunnel you can walk into, standing on the tarmac (no earth over it — it would show inside)
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 16, 1, true), new THREE.MeshStandardMaterial({ map: concrete.map, roughness: 1, side: THREE.DoubleSide }));
    pipe.rotation.z = Math.PI / 2; pipe.position.set(10.5, 0.85, -6);
    this.add(pipe);                                             // NOT a collider — its AABB would block the opening
    this.addBlocker([9.2, 0, -7.2], [11.8, 2.2, -6.8]); this.addBlocker([9.2, 0, -5.2], [11.8, 2.2, -4.8]);
    for (const ex of [9.2, 11.8]) { const collar = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 20), pipe.material); collar.rotation.y = Math.PI / 2; collar.position.set(ex, 0.85, -6); this.add(collar); }
    this._occluders.push(pipe);

    // climbing frame at (10, 0, 4): a lattice, a decoy hiding place inside
    for (const x of [9, 10, 11]) for (const z of [3, 4, 5]) for (const y of [0.7, 1.4, 2.1]) {
      if (x !== 10 || z !== 4) this._box(0.05, 0.05, 0.05, steel, x, y, z, { collide: false });
    }
    for (const x of [9, 11]) for (const z of [3, 5]) this._box(0.05, 2.1, 0.05, steel, x, 1.05, z);
    for (const y of [0.7, 1.4, 2.1]) { this._box(2.05, 0.04, 0.04, steel, 10, y, 3, { collide: false }); this._box(2.05, 0.04, 0.04, steel, 10, y, 5, { collide: false }); this._box(0.04, 0.04, 2.05, steel, 9, y, 4, { collide: false }); this._box(0.04, 0.04, 2.05, steel, 11, y, 4, { collide: false }); }

    // shelter at (-11, 0, 6): three walls, a roof, a bench, the rhyme; a hedge behind; the gap between
    const shelterMat = makeMat('concrete', { base: '#5f6a6a', repeat: [2, 1] });
    const back = this._box(3.0, 2.4, 0.15, shelterMat, -11, 1.2, 7.5);
    const sideW = this._box(0.15, 2.4, 3.0, shelterMat, -12.5, 1.2, 6.0);
    const sideE = this._box(0.15, 2.4, 3.0, shelterMat, -9.5, 1.2, 6.0);
    this._box(3.3, 0.1, 3.3, shelterMat, -11, 2.45, 6.0, { collide: false });
    const bench = makeBench(); bench.position.set(-11, 0, 6.9); this.add(bench); this.addCollider(bench);
    this._rhyme = makeSign({
      text:
        'one, two — you’re in the pipe where the slide comes down.\n' +
        'three, four — you’re behind the shed at the edge of the ground.\n' +
        'five, six — you’re in the dark behind the bench where the big ones sat.\n' +
        'seven, eight — I’ve counted slow. nine — I’ve counted slower than that.\n' +
        'ten. coming, ready or not.',
      width: 2.4, height: 1.2, bg: '#5f6a6a', color: '#e2dccb', font: 'italic 34px Georgia',
    });
    this._rhyme.position.set(-11, 1.3, 7.42); this._rhyme.rotation.y = Math.PI;
    this.add(this._rhyme);
    const hedge = this._box(4.5, 1.8, 0.8, new THREE.MeshStandardMaterial({ color: 0x1e2a1e, roughness: 1 }), -10.75, 0.9, 9.1);
    this._occluders.push(back, sideW, sideE, hedge);

    // shed at (13, 0, -10)
    const shed = this._box(2.4, 2.6, 2.4, wood, 13, 1.3, -10);
    const shedRoof = this._box(2.8, 0.15, 2.8, wood, 13, 2.65, -10, { collide: false });
    this._occluders.push(shed, shedRoof);
    this.interact(shed, { prompt: 'the shed', onInteract: () => { this.playSound('locked'); this.subtitle('Locked. It always was. That was never the point of it.', 5); } });
  }

  _buildFigure() {
    this._figure = makeFigure();
    this.add(this._figure);
    this._presence = new Presence(this, this._figure, {
      stations: STATIONS, minUnseen: 0.6, occluders: this._occluders,
      onArrive: (i) => this._onArrive(i),
    });
    this._presence.placeAt(0);
    this.track(this._presence);
  }

  _foot() { const p = this.game.player.position; return new THREE.Vector3(p.x, p.y - 1.62, p.z); }

  _wirePuzzle() {
    const s = this;
    this._phase = -1; this._targetKind = null; this._gateOpen = false; this._wrongT = 0; this._wrongSaid = false;
    this._saidOpen = false; this._idleT = 0; this._idleSaid = false; this._fin = false;

    this.interact(this._rhyme, { prompt: 'the rhyme on the shelter wall', onInteract: () => {
      this.giveNote({
        id: 'l14-rhyme',
        title: 'the counting rhyme, painted on the shelter wall',
        body:
          'one, two — you’re in the pipe where the slide comes down.\n' +
          'three, four — you’re behind the shed at the edge of the ground.\n' +
          'five, six — you’re in the dark behind the bench where the big ones sat.\n' +
          'seven, eight — I’ve counted slow. nine — I’ve counted slower than that.\n' +
          'ten. coming, ready or not.\n\n' +
          'you always hid in the same three places, in the same order,\n' +
          'and I always pretended not to know.\n\n— M.',
      });
      if (this._phase < 0) { this.setObjective('hide, the way you used to'); this._startPhase(0); }
    } });

    this.tick((dt) => {
      if (this._fin) {
        if (this._dreadEase !== undefined) { this._dreadEase = Math.max(0.4, this._dreadEase - dt * 0.05); this.dread(this._dreadEase); }
        if (this._gateOpen && !this.isCompleted && s.game.player.position.z < -15) this.complete();
        return;
      }
      const ph = PHASES[this._phase];
      if (!ph) return;
      const foot = this._foot();
      const inHide = HIDES[ph.hide].containsPoint(foot);
      if (this._targetKind === 'hide') this._presence.enabled = inHide;
      else if (this._targetKind === 'rest') this._presence.enabled = !inHide;
      // nudges: a wrong hiding place, or never hiding
      const inWrong = Object.entries(HIDES).some(([k, b]) => k !== ph.hide && b.containsPoint(foot));
      if (inWrong) { this._wrongT += dt; if (this._wrongT > 8 && !this._wrongSaid) { this._wrongSaid = true; this.subtitle('Nothing comes. It was never this one — not first.', 5); } }
      else { this._wrongT = 0; this._wrongSaid = false; }
      if (this._phase === 0 && this._targetKind === 'hide' && !inHide) { this._idleT += dt; if (this._idleT > 60 && !this._idleSaid) { this._idleSaid = true; this.subtitle('You could hide. That was always your part.', 6); } }
    });
  }

  _startPhase(i) {
    this._phase = i;
    this._targetKind = 'hide';
    this._presence.advanceTo(PHASES[i].hideStation);
  }

  _onArrive(i) {
    const ph = PHASES[this._phase];
    if (i === 1 && this._swinging) { this._swinging = false; this._swingLoop.stop(0.3); this.cue('the swing stops', { x: -9, y: 2, z: -3 }); }
    if (i === 4 && !this._saidOpen) {
      this._saidOpen = true;
      this.whenSeen(this._figure, () => this.subtitle('It is standing in the open now. Closer. It does not move while you watch.', 6));
    }
    if (!ph) return;
    if (i === ph.hideStation) {
      const pos = STATIONS[i];
      this.playSoundAt('knock', pos, { count: 2 });
      this.cue('two knocks', pos);
      this.subtitle('Two. Still there. You can come out.', 5);
      if (ph.objective) this.setObjective(ph.objective);
      this._targetKind = 'rest';
      this._presence.advanceTo(ph.rest);
    } else if (i === ph.rest) {
      if (this._phase < PHASES.length - 1) this._startPhase(this._phase + 1);
      else this._finale();
    }
  }

  _finale() {
    this._fin = true;
    this._targetKind = null;
    this._presence.enabled = false;
    this.hush(4);
    this.dread(1.0);
    this.subtitle('It does not come any closer. It never did.', 5);
    this.after(4, () => {
      this._dreadEase = 1.0;
      this._swingLoop = this.loopAt('swing', { x: -9, y: 2.4, z: -3 }); this._swingLoop.setGain(0.4);
      this._presence.walkTo(V(0, 0, -12.2), 1.6, () => {
        this.playSound('unlock');
        this._padlock.visible = false;
        this._gate.setOpen(true, -1);                     // swing away from the playground; flip the sign if it swings in
        this.removeColliderOf(this._gate.panel);
        this._presence.walkTo(V(0, 0, -16), 1.6, () => {
          this._presence.hide();
          this._lamp.intensity = 0;
          this.playSoundAt('clunk', { x: 2, y: 4.2, z: 2 });
          this._gateOpen = true;
          this.setObjective('follow');
          this.subtitle('It had the key. Of course it had the key.', 5);
        });
      });
    });
  }

  async debugSolve() {
    const pl = this.game.player;
    this.debugInteract(this._rhyme);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    pl.teleport(10.5, -6, Math.PI);      // in the pipe, facing +Z (its wall): S1, S2, S3 all out of the cone
    await this.debugWait(2.6);           // three hops → two knocks
    pl.teleport(13.2, -12, 0);           // behind the shed, facing -Z: R1 hop, then S4, S5, S6
    await this.debugWait(3.2);
    pl.teleport(-11, 8.1, Math.PI);      // behind the shelter, facing +Z: R2 hop, then S7, S8, S9
    await this.debugWait(3.2);
    pl.teleport(-9.6, 5.5, 0);           // out of the gap, facing -Z: hop to R3 → finale
    await this.debugWait(20.5);          // hold 4 s + walk ≈ 12 s + gate + walk-through
    pl.teleport(0, -16);
    await this.debugWait(0.6);
  }
}
```

- [ ] **Step 3: Verify, then review the shots**

```bash
npx vite build
node tools/screenshot.mjs 14 --port 5114
node tools/playtest.mjs 14 --port 5214
```
Expected: SOLVED in about 32 s. If it stalls at a hop, log `this.isSeen(this._figure, { occluders: this._occluders })` from a temporary tick and adjust the teleport yaw for that step (the yaws above were checked against the station coordinates; if you move a station, re-check). If it stalls at the finale, confirm `_onArrive(12)` runs (`_targetKind === 'rest'` and the player is outside `HIDES.shelter` when teleported to (−9.6, 5.5)).

Shots: from spawn, tarmac under a low sky, the working lamp to the right, the swings left, the shelter's back wall catching light, the figure a dark shape far off by the gate against the last house's window.

- [ ] **Step 4: Commit**

```bash
git add src/levels/Level14.js
git commit -m "Add room XIV (The Playground) — hide so it can come; two knocks; it walks to the gate"
```

---

### Task 11: Room XV — Under the House

**Files:**
- Create: `src/levels/Level15.js`

**Interfaces:**
- Consumes: Tasks 1–5 (`playSoundAt`, `loopAt`, `cue`, `whenUnseen`, `hush`, `dread`, `flinch`, `chalkTexture`, `blurredPhotoTexture`, `addBlocker`/`removeBlocker`, `ui.flash`), Task 4 (`makeFigure`).
- Produces: `Level15` — the last room; `main.js` plays `EPILOGUE` after it.

Spec: §5.5 — read all of it first (four acts).

- [ ] **Step 1: Scaffold: constants, meta, the cellar shell, the corridor, the two rooms beyond, spawn**

Create `src/levels/Level15.js`:

```js
import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, chalkTexture, blurredPhotoTexture } from '../core/textures.js';
import { makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeTable, makeChair, makeShelf, makePictureFrame, applyFog } from '../core/props.js';
import { makeFigure } from '../core/presence.js';

// XV — Under the House
// The cellar of V. The fuse box has lost its labels and each switch wakes a
// sound above you; flip them in the order M. gave. A corridor that loops until
// you stand still. A box that fills while you aren't looking. The last room.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.5

const ORDER = ['kitchen', 'hall', 'sitting', 'yours'];                 // V's evening
const SWITCHES = ['porch', 'sitting', 'kitchen', 'yours', 'hall'];      // physical order, left → right, no labels
const OVERHEAD = {
  kitchen: { x: -4.5, y: 3.4, z: -2.5 }, sitting: { x: 4.5, y: 3.4, z: -0.5 },
  hall: { x: 0.5, y: 3.4, z: 3.5 }, yours: { x: -1, y: 3.4, z: -3.6 },
};
const DESC = { kitchen: 'A tap, running.', hall: 'Slippers on a mat, back and forth.', sitting: 'A wireless, tuning between stations.', yours: 'A music box, winding down.' };
const TUNE = LevelBase.tune('EGAGEGE');
const CX = -2;                                    // corridor / under-room / last room centre line
const LAST_DOOR = { x: CX, y: 1.2, z: -22 };
const DOORWAY = { x: CX, y: 1.4, z: -26 };
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level15 extends LevelBase {
  static meta = {
    id: 15,
    numeral: 'XV',
    title: 'Under the House',
    mood: 'under',
    grade: GRADE,
    intro: 'Under the house, where you never went, the house is still going on.',
    outro:
      'She was never behind you.\n' +
      'She was ahead the whole time,\n' +
      'leaving the doors open, going on to bed.',
  };

  build() {
    applyFog(this.scene, '#08080a', 1.5, 14);
    this._concrete = makeMat('concrete', { base: '#6b665e', repeat: [3, 1] });
    this._floorMat = makeMat('concrete', { base: '#4f4b45', repeat: [4, 3] });
    this._wood = makeMat('wood', { base: '#4a3a2c', repeat: [1, 1] });
    this.add(new THREE.HemisphereLight(0x453f3a, 0x0a0a0c, 0.3));
    this._buildCellar();       // 12 × 8 main room: steps up, boiler, jars, washer, chute, fuse box + note, bulb, corridor door
    this._buildCorridor();     // z −4..−16 at x −2, two identical frames, chalk, two dim bulbs
    this._buildUnderRoom();    // z −16..−22: table + box, last door
    this._buildLastRoom();     // z −22..−26: lamp, chair + note, the figure, the doorway of light
    this._wirePuzzle();
    this.spawn.position.set(4, 0, 2.6);
    this.spawn.yaw = Math.PI / 2;                          // facing −X, into the cellar
    this.bounds = new THREE.Box3(new THREE.Vector3(-6.5, -1, -28.5), new THREE.Vector3(6.5, 4, 4.5));
    this.setObjective('the fuse box has lost its labels');
  }

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  /** floor + ceiling with joists + four walls for a room; `openings` cut a doorway (1.0 wide, 2.1 high) in a wall: 'n'|'s'|'e'|'w' with an x or z centre. */
  _room(x0, x1, z0, z1, h, openings = []) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this._floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true;
    this.add(floor); this.addGround(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this._concrete);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, h, cz); this.add(ceil);
    for (let x = x0 + 0.25; x < x1; x += 0.5) this._box(0.08, 0.14, d, this._wood, x, h - 0.07, cz, { collide: false });
    const has = (side) => openings.find((o) => o.side === side);
    const wall = (side) => {
      const o = has(side);
      const vertical = side === 'e' || side === 'w';
      const wx = side === 'e' ? x1 + 0.1 : side === 'w' ? x0 - 0.1 : cx;
      const wz = side === 'n' ? z0 - 0.1 : side === 's' ? z1 + 0.1 : cz;
      if (!o) { vertical ? this._box(0.2, h, d + 0.4, this._concrete, wx, h / 2, wz) : this._box(w + 0.4, h, 0.2, this._concrete, wx, h / 2, wz); return; }
      const c = o.at, lo = vertical ? z0 - 0.2 : x0 - 0.2, hi = vertical ? z1 + 0.2 : x1 + 0.2;
      const segA = [lo, c - 0.5], segB = [c + 0.5, hi];
      for (const [a, b] of [segA, segB]) {
        const len = b - a, mid = (a + b) / 2;
        if (len <= 0) continue;
        vertical ? this._box(0.2, h, len, this._concrete, wx, h / 2, mid) : this._box(len, h, 0.2, this._concrete, mid, h / 2, wz);
      }
      vertical ? this._box(0.2, h - 2.1, 1.0, this._concrete, wx, 2.1 + (h - 2.1) / 2, c) : this._box(1.0, h - 2.1, 0.2, this._concrete, c, 2.1 + (h - 2.1) / 2, wz);
    };
    for (const sd of ['n', 's', 'e', 'w']) wall(sd);
  }

  _buildCellar() {
    this._room(-6, 6, -4, 4, 2.3, [{ side: 'n', at: CX }]);         // the corridor door in the north wall at x −2
    // steps up along the south wall at x +4, to a door that is shut from the other side
    for (let i = 0; i < 7; i++) this._box(1.2, 0.23, 0.3, this._floorMat, 4, 0.115 + i * 0.23, 3.85 - i * 0.3, { ground: true });
    const upDoor = makeDoor({ color: '#4c4038' }); upDoor.position.set(4, 1.61, 3.9); this.add(upDoor); this.track(upDoor); this.addCollider(upDoor.panel);
    this.interact(upDoor, { prompt: 'the door at the top', onInteract: () => { this.playSound('locked'); this.subtitle('Shut from that side. It always was.', 4); } });
    this.addBlocker([3.2, 0, 3.6], [4.8, 4, 4.2]);
    // boiler
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.9, 18), new THREE.MeshStandardMaterial({ color: 0x5a5651, metalness: 0.5, roughness: 0.6 }));
    boiler.position.set(-4, 0.95, -2.5); boiler.castShadow = true; this.add(boiler); this.addCollider(boiler);
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff9a4a, emissiveIntensity: 3 }));
    pilot.position.set(-4, 0.4, -1.78); this.add(pilot); this._pilot = pilot;
    const pl = new THREE.PointLight(0xff9a4a, 1.6, 4, 1.8); pl.position.set(-4, 0.4, -1.6); this.add(pl); this._pilotLight = pl;
    this.loopAt('boiler', { x: -4, y: 1, z: -2.5 });
    this.interact(boiler, { prompt: 'the boiler', onInteract: () => this.subtitle('It ticks like something counting.', 4) });
    // jars on shelves along the west wall
    const jarMat = new THREE.MeshStandardMaterial({ color: 0x8a7a55, transparent: true, opacity: 0.7, roughness: 0.2 });
    for (let s = 0; s < 3; s++) {
      const shelf = makeShelf({ w: 0.9, h: 1.6, d: 0.3, shelves: 3 }); shelf.position.set(-5.7, 0, 1.2 - s * 1.0); shelf.rotation.y = Math.PI / 2;
      this.add(shelf); this.addCollider(shelf);
      for (let k = 0; k < 9; k++) { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), jarMat); jar.position.set(-5.7, 0.13 + Math.floor(k / 3) * 0.5, 1.2 - s * 1.0 - 0.3 + (k % 3) * 0.3); this.add(jar); }
    }
    // washing machine, coal chute
    const washer = this._box(0.6, 0.85, 0.6, new THREE.MeshStandardMaterial({ color: 0xbfbdb5, roughness: 0.4 }), 2, 0.425, -3.5);
    const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0.8, roughness: 0.2 }));
    porthole.position.set(2, 0.5, -3.19); this.add(porthole); void washer;
    const chute = this._box(1.0, 0.1, 2.2, this._concrete, 5.5, 1.5, 2, { collide: false }); chute.rotation.z = 0.7;
    for (let k = 0; k < 14; k++) { const lump = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 6, 5), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1 })); lump.position.set(5.0 + (Math.random() - 0.5) * 0.9, 0.08, 2 + (Math.random() - 0.5) * 1.6); this.add(lump); }
    // the one bulb
    const bulb = makeBulbLight({ intensity: 3.5, distance: 9, y: 2.2 }); bulb.position.set(0, 0, 0); bulb.light.castShadow = true; this.add(bulb);
    // fuse box on the east wall at (5.9, 1.45, -1): five unlabelled switches, a pilot lamp, the note beside it
    const fuse = this._box(0.5, 0.7, 0.12, new THREE.MeshStandardMaterial({ color: 0x777b7a, metalness: 0.5, roughness: 0.5 }), 5.88, 1.45, -1, { collide: false });
    void fuse;
    this._switches = SWITCHES.map((k, i) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.05), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }));
      sw.position.set(5.8, 1.42, -1.16 + i * 0.08); sw.rotation.z = -0.35;
      this.add(sw);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0xd8cfba, roughness: 0.9 }));
      plate.position.set(5.815, 1.32, -1.16 + i * 0.08); plate.rotation.y = -Math.PI / 2; this.add(plate);   // blank
      return { key: k, mesh: sw };
    });
    const pilotLamp = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a2a, emissiveIntensity: 2 }));
    pilotLamp.position.set(5.8, 1.72, -1); this.add(pilotLamp);
    this._fuseNote = makeNoteProp(); this._fuseNote.position.set(5.86, 1.1, -0.6); this._fuseNote.rotation.z = Math.PI / 2;   // hung on the east wall
    this.add(this._fuseNote);
    // the corridor door in the north wall
    this._corridorDoor = makeDoor({ color: '#4c4038' }); this._corridorDoor.position.set(CX, 0, -4);
    this.add(this._corridorDoor); this.track(this._corridorDoor); this.addCollider(this._corridorDoor.panel);
    this._strip = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe0b0, emissiveIntensity: 0 }));
    this._strip.position.set(CX, 0.012, -3.9); this._strip.rotation.x = -Math.PI / 2; this.add(this._strip);
  }

  _buildCorridor() {
    this._room(CX - 0.7, CX + 0.7, -16, -4, 2.2, [{ side: 's', at: CX }, { side: 'n', at: CX }]);
    const frame = (z) => { this._box(0.1, 2.1, 0.1, this._wood, CX - 0.55, 1.05, z, { collide: false }); this._box(0.1, 2.1, 0.1, this._wood, CX + 0.55, 1.05, z, { collide: false }); this._box(1.2, 0.1, 0.1, this._wood, CX, 2.15, z, { collide: false }); };
    frame(-4.6); frame(-15.4);
    this._chalk = chalkTexture({ tally: 1, lines: ['wait for me'] });
    const chalk = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshStandardMaterial({ map: this._chalk, roughness: 1 }));
    chalk.position.set(CX + 0.695, 1.2, -10); chalk.rotation.y = -Math.PI / 2; this.add(chalk);
    for (const z of [-7, -13]) { const b = makeBulbLight({ color: 0xd8dcd0, intensity: 2.0, distance: 5, y: 2.1 }); b.position.set(CX, 0, z); this.add(b); }
  }

  _buildUnderRoom() {
    this._room(-5, 1, -22, -16, 2.3, [{ side: 's', at: CX }, { side: 'n', at: CX }]);
    const table = makeTable({ w: 1.0, d: 0.7 }); table.position.set(CX, 0, -19); this.add(table); this.addCollider(table);
    // the box: cardboard, lid flaps open, a label with a name written and crossed out
    const card = new THREE.MeshStandardMaterial({ color: 0xa3896a, roughness: 1 });
    this._boxMesh = this._box(0.5, 0.35, 0.4, card, CX, 0.76 + 0.175, -19, { collide: false });
    for (const sx of [-1, 1]) { const flap = this._box(0.25, 0.01, 0.4, card, CX + sx * 0.28, 0.76 + 0.36, -19, { collide: false }); flap.rotation.z = sx * 0.9; }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), new THREE.MeshStandardMaterial({ map: textTexture({ text: '~~~~~  ~~~', width: 256, height: 96, font: 'italic 40px Georgia', bg: '#e8e0cf', color: '#3a3630' }), roughness: 0.9 }));
    label.position.set(CX, 0.76 + 0.2, -18.79); this.add(label);
    // the three things that will appear inside, hidden for now
    this._photo = makePictureFrame({ texture: blurredPhotoTexture({ figures: 2 }), width: 0.18, height: 0.14 });
    this._photo.position.set(CX - 0.05, 0.76 + 0.2, -19); this._photo.rotation.x = -0.4; this._photo.visible = false; this.add(this._photo);
    this._ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), new THREE.MeshStandardMaterial({ color: 0x4f6a8a, roughness: 0.9 }));
    this._ribbon.position.set(CX + 0.05, 0.76 + 0.03, -19); this._ribbon.rotation.x = Math.PI / 2; this._ribbon.visible = false; this.add(this._ribbon);
    this._key = makeKeyProp(); this._key.position.set(CX, 0.76 + 0.03, -19.05); this._key.visible = false; this.add(this._key);
    const b = makeBulbLight({ intensity: 2.5, distance: 6, y: 2.2 }); b.position.set(CX, 0, -18); this.add(b);
    this._lastDoor = makeDoor({ color: '#5a4636' }); this._lastDoor.position.set(CX, 0, -22);
    this.add(this._lastDoor); this.track(this._lastDoor); this.addCollider(this._lastDoor.panel);
  }

  _buildLastRoom() {
    this._room(-4, 0, -26, -22, 2.3, [{ side: 's', at: CX }, { side: 'n', at: CX }]);
    // beyond the far doorway: a short stub and the light
    this._room(-3, -1, -28.5, -26, 2.3, [{ side: 's', at: CX }]);
    this._lamp = makeBulbLight({ color: 0xffdcb0, intensity: 3.5, distance: 7, y: 2.1 }); this._lamp.position.set(CX, 0, -24); this.add(this._lamp);
    this._chair = makeChair(); this._chair.position.set(CX + 0.4, 0, -24.5); this._chair.rotation.y = Math.PI; this.add(this._chair); this.addCollider(this._chair);
    const note = makeNoteProp(); note.position.set(CX + 0.4, 0.475, -24.5); this.add(note); this._lastNote = note;
    this._figure = makeFigure(); this._figure.position.set(CX - 0.5, 0, -24.6); this._figure.rotation.y = 0; this.add(this._figure);
    this._lastBlocker = this.addBlocker([-4, 0, -26], [0, 2.4, -23.4]);
    this._doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff1d6, emissiveIntensity: 0.4 }));
    this._doorGlow.position.set(CX, 1.05, -27.9); this.add(this._doorGlow);
    this._doorLight = new THREE.PointLight(0xfff1d6, 0, 8, 1.6); this._doorLight.position.set(CX, 1.6, -27); this.add(this._doorLight);
    this.addBlocker([-3.2, 0, -28.6], [-0.8, 3, -28.3]);
  }
```

- [ ] **Step 2: Add the four acts**

```js
  _wirePuzzle() {
    const s = this;
    this._on = []; this._wrongCount = 0; this._loops = []; this._timers = {}; this._loopActive = false; this._loopCount = 0;
    this._still = 0; this._approach = null; this._pleaded = 0; this._act = 1; this._entered4 = false;

    // ---- act 1: the fuse box ----
    this.interact(this._fuseNote, { prompt: 'the note by the pilot light', onInteract: () => {
      this.giveNote({
        id: 'l15-evening',
        title: 'the note by the pilot light — pinned again',
        body: 'supper before slippers.\nslippers before the wireless.\nand yours always last,\nso the dark never caught you.\n\n— M.',
      });
    } });
    for (const sw of this._switches) this.interact(sw.mesh, { prompt: 'a switch', onInteract: () => this._flip(sw.key) });

    // footsteps upstairs, now and then (flavour)
    const upstairs = () => {
      if (this._act !== 1) return;
      for (let i = 0; i < 4; i++) this.after(i * 0.7, () => this.playSoundAt('stepOther', { x: -3 + i * 2.3, y: 3.4, z: 2 + i * 0.3 }, { soft: true }));
      if (!this._cuedUp) { this._cuedUp = true; this.cue('footsteps, upstairs', { x: -3, y: 3.4, z: 2 }); }
      this.after(40, upstairs);
    };
    this.after(25, upstairs);

    // ---- act 2: the corridor ----
    this.tick((dt) => {
      const pl = s.game.player, p = pl.position, v = Math.hypot(pl.velocity.x, pl.velocity.z);
      const inCorridor = p.z < -4.6 && p.z > -15.4 && Math.abs(p.x - CX) < 0.7;
      if (this._loopActive && p.z < -15.6 && p.z > -17) {
        pl.teleport(p.x, p.z + 11.4);
        this._loopCount++;
        this._redrawChalk();
        if (this._loopCount >= 2 && !this._saidStop) { this._saidStop = true; this.subtitle('You know this one. Stop.', 5); }
        return;
      }
      if (this._act === 2 && this._loopActive) {
        if (this._approach) { this._runApproach(dt, v); return; }
        if (inCorridor && v < 0.05 && !s.game.ui.modalOpen) this._still += dt; else this._still = 0;
        if (this._still >= 6) { this._still = 0; this._approach = { t: 0, i: 0, breath: false, passed: 0 }; }
      }
      // ---- act 4: entering the last room; the threshold ----
      if (!this._entered4 && p.z < -22.4) { this._entered4 = true; this.hush(6); this.dread(0); }
      if (this._letGo && !this.isCompleted && p.z < -27) this.complete();
    });

    // ---- act 3: the box ----
    this._stage = -1;
    this.interact(this._boxMesh, { prompt: 'look inside', once: true, onInteract: () => {
      this.subtitle('Empty. It has been kept empty a long time.', 5);
      this._armStage(0);
    } });
    this.interact(this._photo, { prompt: 'the photograph', once: true, enabled: false, onInteract: () => {
      this.learnClue({ id: 'l15-photo', title: 'a photograph', body: 'two figures, faces gone soft. one of them is you.' });
      this._photo.visible = false;
      this._armStage(1);
    } });
    this.interact(this._ribbon, { prompt: 'the ribbon', once: true, enabled: false, onInteract: () => {
      this._ribbon.visible = false;
      this.giveItem({ id: 'ribbon', name: 'a ribbon, blue once' });
      this.subtitle('Hers. You wind it once around your finger, and this time you keep it.', 6);
      this._armStage(2);
    } });
    this.interact(this._key, { prompt: 'the brass key', once: true, enabled: false, onInteract: () => {
      this._key.visible = false;
      this.giveItem({ id: 'warm-key', name: 'a brass key, warm again' });
      this.subtitle('Warm. Someone has just put it down.', 5);
      this.after(1.5, () => { this.playSoundAt('knock', LAST_DOOR, { count: 3 }); this.cue('three knocks', LAST_DOOR); this.setObjective('come and find me'); });
    } });
    this._lastOpen = false;
    this.interact(this._lastDoor, { prompt: 'the last door', onInteract: () => {
      if (this._lastOpen) return;
      if (!this.hasItem('warm-key')) { this.playSound('locked'); this.subtitle('Locked. It wants the key it always wanted.', 5); return; }
      this._lastOpen = true; this.removeItem('warm-key');
      this.playSound('unlock'); this._lastDoor.setOpen(true, -1); this.removeColliderOf(this._lastDoor.panel); this.playSound('door');
    } });

    // ---- act 4: the note on the chair ----
    this.interact(this._chair, { prompt: 'the chair', once: true, onInteract: () => {
      this.giveNote({ id: 'l15-last', title: 'the last note', body: 'you can stop running now.\nI only ever wanted to say goodnight.\n\n— M.' }, () => this._letGoNow());
    } });
  }

  _flip(k) {
    this.playSound('switch');
    if (k === 'porch') { this.playSound('locked'); this.subtitle('Dead. It was dead upstairs, too.', 4); return; }
    if (this._on.includes(k)) return;
    this._on.push(k);
    const sw = this._switches.find((x) => x.key === k); sw.mesh.rotation.z = 0.35;
    const ok = this._on.every((v, i) => v === ORDER[i]);
    if (!ok) {
      this.playSound('wrong');
      this._wrongCount++;
      this._stopOverhead();
      this._on = [];
      for (const w of this._switches) w.mesh.rotation.z = -0.35;
      this.subtitle(this._wrongCount >= 3 ? 'Supper. Then slippers. Then the wireless. Then yours. Listen for them.' : 'That was not how the evening went.', this._wrongCount >= 3 ? 7 : 5);
      return;
    }
    this._startOverhead(k);
    this.subtitle(DESC[k], 4);
    if (this._on.length === 4) this._act1Done();
  }

  _startOverhead(k) {
    const pos = OVERHEAD[k];
    if (k === 'kitchen') this._loops.push(this.loopAt('tap', pos));
    else if (k === 'sitting') this._loops.push(this.loopAt('radio', pos));
    else if (k === 'hall') { const step = () => { this.playSoundAt('stepOther', pos, { soft: true }); this._timers.hall = this.after(0.9, step); }; step(); }
    else if (k === 'yours') { const mb = () => { this.playSoundAt('musicbox', pos, { notes: TUNE, step: 0.36, slow: 0.05 }); this._timers.yours = this.after(6, mb); }; mb(); }
  }

  _stopOverhead() {
    for (const h of this._loops) h.stop(0.4);
    this._loops = [];
    for (const id of Object.values(this._timers)) clearTimeout(id);
    this._timers = {};
  }

  _act1Done() {
    this.playSoundAt('musicbox', OVERHEAD.yours, { notes: TUNE, step: 0.36, gain: 0.08 });
    this._strip.material.emissiveIntensity = 1.4;
    this.playSound('unlock');
    this._corridorDoor.setOpen(true, -1);                  // swing INTO the corridor (−Z); flip the sign if it swings into the cellar
    this.removeColliderOf(this._corridorDoor.panel);
    this.setObjective('the door under the door');
    this._act = 2;
    this._loopActive = true;
  }

  _redrawChalk() {
    const lines = ['wait for me'];
    if (this._pleaded >= 1) lines.push('please');
    this._chalk.redraw({ tally: Math.min(this._loopCount + 1, 12), lines });
  }

  /** Six steps from behind over 4 s, a breath at the right ear, then three steps going on ahead. */
  _runApproach(dt, v) {
    const a = this._approach, pl = this.game.player, p = pl.position, footY = p.y - 1.62;
    a.t += dt;
    if (v > 0.3 && a.t < 4.0) {
      this._approach = null; this._pleaded++; this._still = 0; this._redrawChalk(); this.dread(0.4);
      for (let i = 0; i < 3; i++) this.after(i * 0.5, () => this.playSoundAt('stepOther', { x: CX, y: footY, z: p.z + 2 + i * 1.5 }));
      this.subtitle('It goes back. It will wait as long as you make it.', 5);
      return;
    }
    while (a.i < 6 && a.t >= a.i * (4 / 5)) {
      const k = a.i / 5;
      this.playSoundAt('stepOther', { x: CX, y: footY, z: p.z + 5 - 4.4 * k });
      this.dread(0.4 + 0.6 * k);
      a.i++;
    }
    if (!a.breath && a.t >= 4.0) {
      a.breath = true;
      const yaw = pl.yaw;
      const ear = { x: p.x + Math.cos(yaw) * 0.35, y: p.y, z: p.z - Math.sin(yaw) * 0.35 };   // right ear
      this.playSoundAt('breath', ear); this.cue('a breath', ear); this.hush(3); this.flinch();
    }
    if (a.breath && a.passed < 3 && a.t >= 4.5 + a.passed * 0.75) {
      this.playSoundAt('stepOther', { x: CX, y: footY, z: p.z - 1 - a.passed * 1.5 });
      a.passed++;
    }
    if (a.t >= 6.5) {
      this._approach = null;
      this._loopActive = false;
      this._act = 3;
      this.dread(0.5);
      this.subtitle('It goes past. It was only ever going past.', 5);
    }
  }

  _armStage(n) {
    this._stage = n;
    this.whenUnseen(this._boxMesh, () => {
      const item = [this._photo, this._ribbon, this._key][n];
      item.visible = true;
      this.game.interaction.setEnabled(item, true);
    });
  }

  _letGoNow() {
    this._letGo = true;
    this._lamp.light.intensity = 0;
    this.playSoundAt('clunk', { x: CX, y: 2.1, z: -24 });
    this.game.ui.flash('#000', 400);
    this._figure.visible = false;
    this.removeBlocker(this._lastBlocker);
    this.dread(0);
    let tt = 0;
    this.tick((dt) => { tt += dt; const k = Math.min(1, tt / 2); this._doorLight.intensity = 7 * k; this._doorGlow.material.emissiveIntensity = 0.4 + 1.0 * k; });
    this.after(0.8, () => { this.playSoundAt('hummed', DOORWAY, { notes: TUNE }); this.subtitle('Goodnight.', 4); });
    this.setObjective('');
  }

  async debugSolve() {
    const pl = this.game.player;
    this.debugInteract(this._fuseNote); await this.debugWait(0.3); this.game.ui.closeModal();
    for (const k of ORDER) { this.debugInteract(this._switches.find((s) => s.key === k).mesh); await this.debugWait(0.2); }
    await this.debugWait(0.8);
    pl.teleport(CX, -8, 0);               // into the corridor, facing −Z
    await this.debugWait(6.5);            // still → the approach starts at 6.0 s
    await this.debugWait(6.8);            // it passes at 6.5 s of the approach; the loop is off
    pl.teleport(CX, -17.5, 0);            // the under-room, facing the table
    this.debugInteract(this._boxMesh); await this.debugWait(0.3);
    for (const item of [this._photo, this._ribbon, this._key]) {
      pl.teleport(CX, -17.5, Math.PI); await this.debugWait(0.7);     // look away → it appears
      pl.teleport(CX, -17.5, 0); this.debugInteract(item); await this.debugWait(0.3);
    }
    await this.debugWait(1.6);
    this.debugInteract(this._lastDoor); await this.debugWait(0.5);
    pl.teleport(CX, -23.1, 0);
    this.debugInteract(this._chair); await this.debugWait(0.3); this.game.ui.closeModal();
    await this.debugWait(1.2);
    pl.teleport(CX, -27.5);
    await this.debugWait(0.6);
  }
}
```

- [ ] **Step 3: Verify, then review the shots**

```bash
npx vite build
node tools/screenshot.mjs 15 --port 5115
node tools/playtest.mjs 15 --port 5215
```
Expected: SOLVED in about 24 s. If act 2 never resolves, check that the player is inside the corridor bounds used by `inCorridor` at (−2, −8) and that `_act === 2` after the four switches. If an item never appears, `_armStage` needs the player to be looking away from the box (`teleport(…, Math.PI)` faces +Z, away from the table at z −19).

Shots: from spawn (foot of the steps, facing −X) the cellar under one bulb, the boiler's pilot glow at the left, jars along the far wall, the fuse box on the near wall to your left. Look for black gaps between the corridor and the cellar (the `_room` helper cuts a doorway; the door must sit in it).

- [ ] **Step 4: Commit**

```bash
git add src/levels/Level15.js
git commit -m "Add room XV (Under the House) — the evening by ear, the loop, the box, the last note"
```

---

### Task 12: README, the full-suite gate, final commit

**Files:**
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: README**

- Subtitle line under the title: `*a dream in ten rooms — and, once you’ve woken, five more*`.
- In the intro paragraph, after "toward waking." add: "And then, past the shore, the five rooms beneath: you open your eyes at 3:07 and the door is shut. Something follows you down. It never touches you."
- In "The ten rooms" (rename the heading to "The rooms"), append: "Rooms XI–XV misdirect you — plates lie, things move when you look away — and ask you to listen: sounds have places now. Headphones matter here. Turn on **describe sounds** in settings for captions with directions."
- In "Technical notes", the audio bullet becomes: "audio is synthesized WebAudio (drones, drips, chimes, footsteps, knocks, a music box, a piano), positional through HRTF panners".
- In "Testing", add: "The harness finds Playwright's Chromium by itself; set `CHROMIUM_PATH` to override. `npm test` runs the unit tests for the pure helpers; `node tools/audiotest.mjs` builds every synthesized sound headless."
- Levels bullet: `src/levels/Level01.js … Level15.js`.

- [ ] **Step 2: The gate**

```bash
npm test
node tools/audiotest.mjs
npx vite build
npm run playtest
```
Expected: tests pass; `audio smoke OK`; build ok; `15/15 levels solvable` and no browser errors. If any room fails, fix it in its own file and re-run that room's playtest, then the full suite again.

- [ ] **Step 3: Regenerate the shots for the five rooms and look at all twenty**

```bash
for n in 11 12 13 14 15; do node tools/screenshot.mjs $n --port 51$n; done
```
Open `shots/level11-*.png` … `shots/level15-*.png` and check each against the review criteria (composed, lit, textured, atmospheric).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Rooms XI–XV complete — the five beneath; 15/15 solvable"
```

---

## Plan self-review (done at writing time)

- Spec coverage: §2.2 texts → Task 5 (EPILOGUE, ending card, menu subtitle), Task 7 (XI prologue). §3.2 canon → Task 6. §4.1 → Task 1. §4.2 → Task 3. §4.3 → Task 4. §4.4 → Task 2. §4.5 → Task 5. §4.6 → Task 0. §4.7 → Task 6 and Task 12. §4.8 → Task 3. §5.1–5.5 → Tasks 7–11. §6 → each room's verify step and Task 12.
- Names used across tasks: `sfxAt/loopAt/setDread/hush/updateListener` (Task 1) ↔ `playSoundAt/loopAt/dread/hush` (Task 3) ↔ rooms; `pulseGrade/flash/subtitle(voice)/onKey` (Task 2) ↔ `flinch/cue` (Task 3) ↔ rooms; `makeFigure/Presence(placeAt, advanceTo, enabled, hide, walkTo)` (Task 4) ↔ Tasks 9, 10, 11; `chalkTexture(.redraw)/blurredPhotoTexture/door.setAngle` (Task 3) ↔ Tasks 7, 8, 11; `addBlocker → Box3 / removeBlocker` (Task 3) ↔ Task 11; `save.migrate/captions/seenPrologues, meta.prologue, meta.grade` (Task 5) ↔ Task 7.
