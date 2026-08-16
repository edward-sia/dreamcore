# HIRAETH — rooms XI–XV, "the five beneath" — design spec

> **Spoilers.** This file specifies every puzzle, code, cue and scare in the
> five new rooms. Players should close it now.

Status: approved design, 2026-08-16. Decisions taken with the owner:
build all five rooms as described here; scare intensity **Shadow** (see
§1.2); the figure is **M., implied, never stated**; the owner hands this
spec and its implementation plan to build agents.

Companion documents: [`../../DESIGN.md`](../../DESIGN.md) (rooms I–X bible,
canon), [`../../LEVEL_API.md`](../../LEVEL_API.md) (authoring contract —
this spec extends it in §4). Read `src/levels/Level01.js` for the level
shape and `src/levels/Level10.js` for a multi-act room before building.

---

## 0. Summary

Rooms I–X end at the Shore. You walk into the sea and the epilogue says you
wake. The five new rooms follow that ending: **you didn't wake.** You open
your eyes in your childhood bedroom at 3:07, the door is shut, and the dream
has stopped leaving the lights on for you. Something is in it with you. It
follows you down through five rooms — bedroom, stairwell, school,
playground, under the house — and it never touches you. In the last room
you stop running and it turns out to have been M. all along, leaving doors
open ahead of you.

Two things change about how the game plays:

1. **Listening becomes a mechanic.** Every room has something you can only
   find by ear. Sounds now have positions (§4.1) — a knock can come from a
   specific patch of wall, footsteps from one flight below.
2. **The room misleads you.** Door plates lie, things change when you look
   away, and you must decide which of what you see and hear to trust. This
   is the fourth rung on the difficulty ladder after notice / combine /
   remember.

Ten short rules define the scares (§1.2). The engine additions that make
them possible are in §4. Each room's full design — layout with coordinates,
puzzle state machine, every text, sound cue, scare, and its `debugSolve()`
script — is in §5.

---

## 1. Goals, non-goals, and the scare contract

### 1.1 Goals

- Five rooms, ids 11–15, numerals XI–XV, each ~N minutes for room N,
  rising in difficulty on top of X.
- More of what dreamcore is made of: false awakenings, clocks that don't
  move, places from childhood at the wrong hour, being followed by
  something patient, sounds from where nothing is.
- Sound is load-bearing: positional audio, a dozen new synthesized sounds,
  five new ambience moods, silence as a cue.
- Everything stays procedural (no binary assets), stays on the existing
  stack, stays verifiable headless (screenshots + `debugSolve()`).

### 1.2 The scare contract ("Shadow")

The menu still says **nothing here will hurt you**, and it stays true.

1. No game-over, no death, no fail state that restarts a room. Wrong
   answers cost time and earn a nudge, exactly as before.
2. Nothing chases the player. The figure moves only when unseen (XIV) or
   passes at a fixed distance (XII, XV). It never touches the player, never
   blocks a path, and never comes closer than about two metres; in XIV's
   finale it stands still about 2.5 m away and then walks away.
3. No jump-scares in the horror sense: no sudden loud sound paired with a
   face filling the screen. Loud things (a slam, a fluorescent going out)
   happen at a distance or behind you.
4. The figure is always a dark shape, slightly too tall: its material is
   near-black so light reveals no detail, and it has no face. It is never
   seen closer than about two metres.
5. Silence is the strongest cue we have. `hush()` before a reveal, not a
   sting.
6. Every scare is followed by something that lets go: a door opens, the
   light holds, the knock means "still there".
7. Escalation across the arc: **heard** (XI) → **felt passing** (XII) →
   **seen at a distance** (XIII) → **approaches when unseen** (XIV) →
   **met** (XV).
8. Text stays lowercase, second person, restrained. Sad beats scary. The
   fear is the player's; the writing never tells them to be afraid.
9. Every hearing-dependent step has a sighted fallback: a proximity change
   (dust, a light, a plate that reads differently), a written redundancy
   (the tannoy label), or the "describe sounds" caption setting (§4.2
   `cue()`).
10. Puzzles remain solvable from clues inside the room, no pixel hunts, no
    trial-and-error gates.

### 1.3 Non-goals

- No new UI systems beyond a flash layer, a subtitle voice, a keypad
  per-key hook and one settings checkbox.
- No real mirrors (render targets). "Mirrors" are dark glossy planes.
- No speech synthesis. Voices are humming and breath, never words.
- No changes to rooms I–X. Level10's outro stays as written.

---

## 2. Narrative frame

### 2.1 Flow

```
… IX → X (Shore) → X outro (unchanged)
      → XI prologue interlude (new: meta.prologue, "You open your eyes…")
      → XI title card → XI … XV
      → XV outro → EPILOGUE (rewritten: the true waking) → ending card → menu
```

`main.js` already plays `EPILOGUE` after whichever level is last, so it
moves to after XV by itself. The false-wake text becomes XI's `prologue`,
shown once (tracked in the save) before XI's title card.

### 2.2 Texts

**XI `meta.prologue`** (interlude, shown before XI's title card):

```
You open your eyes.

The ceiling of your own room. Morning, or nearly.

Except it is the old ceiling — the one with the stick-on stars —
and it is not morning, and the door is shut.

You never shut the door.
```

**`EPILOGUE`** (`src/levels/index.js`, replaces the current text):

```
You open your eyes.

The ceiling of your own room. Morning.
This time it stays.

Somewhere, in a house that is gone, someone turns off the last light —
the one that was left on for you —
and goes to bed.
```

**Ending card** (`main.js`): `'H I R A E T H\n\na dream in fifteen rooms\n\nthank you for staying asleep with me'`.

**Menu subtitle** (`#menu-sub`): `a dream in ten rooms` until the save has
level 10 in `completed`; then `a dream in ten rooms · and the five beneath`.
The `<title>` in `index.html` becomes `HIRAETH`.

**`PROLOGUE`** is unchanged.

### 2.3 Who the figure is

Never stated. The evidence, in order: the knock code from her note (XI);
"wait for me" in an adult hand (XII); the piano finishing your song with
nobody at the keys (XIII); two knocks meaning "still there" when she finds
you (XIV); the key warm again, and the last note signed M. (XV). XV's
outro uses "she". Nothing else does.

---

## 3. The arc

| # | numeral | title | mood | minutes | where it goes | mechanic it adds |
|---|---|---|---|---|---|---|
| 11 | XI | The Bedroom | `night` | 11 | up (you're in bed) | things change when unseen; find a sound by ear |
| 12 | XII | The Stairwell | `stairwell` | 12 | down | the loop; standing still as the answer |
| 13 | XIII | The School | `school` | 13 | along | the room lies (plates vs sound); listen and play back |
| 14 | XIV | The Playground | `playground` | 14 | out | hide so it can come; two knocks means found |
| 15 | XV | Under the House | `under` | 15 | under | recombines all four + arc-1 canon; the meeting |

### 3.1 Difficulty ladder, continued

- 11: two clues, one lock, one new mechanic, one act of listening.
- 12: a spatial model to build (the loop), an inversion to discover
  (stop), a count to notice (the chalk).
- 13: three stages cross-referenced (peg → timetable → room → board +
  chime → piano); the labels lie; a seven-note input.
- 14: read a rhyme, map it onto five candidate hiding places, hide in the
  right three in order, endure three approaches; a finale you watch.
- 15: four acts, each a mechanic from XI–XIV, plus V's evening order heard
  through a ceiling; the box from IX; the meeting.

Room N should take about N minutes for a first-time adult player. Every
wrong attempt: `wrong` (or an in-world equivalent, e.g. one dull knock) and
a gentle nudge line.

### 3.2 Arc-2 canon (facts more than one room depends on)

Add these to DESIGN.md's Canon section.

- **3:07** — the bedroom clock. It never changes.
- **Knocks:** two = "still there" · three = "come and find me". (XI teaches
  it; XIV and XV pay it off.)
- **XII:** the stairs repeat −1, −2, −3. Chalk on the −2 landing: a tally,
  and "wait for me".
- **XIII:** your peg and locker are **12**. The tune is **E G A G E G E**;
  the board holds the first five, the tannoy chime is the last two
  (**G, E**).
- **XIV:** the hiding order is **the pipe → behind the shed → behind the
  shelter**.
- **XV:** V's evening order — **kitchen → hall → sitting room → your
  room** — flipped by ear. The box from IX gives up a photograph, the
  ribbon from VI, and the brass key from I, **warm again**.
- **Humming.** I and III mention "the song your mother hummed". It is this
  tune. It is heard, hummed, twice: faintly behind the bedroom door (XI)
  and from the doorway of light at the very end (XV).

---

## 4. Engine additions

Shared files may be edited for these tasks only. Room files (`Level11.js` …
`Level15.js`) must not touch shared files — same rule as before, so rooms
can be built in parallel once §4 is done.

All new APIs must be no-ops when audio hasn't started (`_started` false —
this is the case in the headless playtest, which runs with `--mute-audio`
and never fires the unlock gesture) and must never throw.

### 4.1 `src/core/AudioEngine.js`

#### 4.1.1 Listener and positional one-shots

- `init()` additionally records `this.listener = this.ctx.listener`.
- **`updateListener(camera)`** — called every frame from `main.js`
  (`engine.onUpdate`). Reads the camera's world position, forward and up
  vectors. If `listener.positionX` exists, use `setTargetAtTime(v, t, 0.02)`
  on positionX/Y/Z, forwardX/Y/Z, upX/Y/Z; otherwise fall back to
  `listener.setPosition` / `setOrientation`. No-op before `init()`.
- Refactor: move the body of `sfx(name, opts)` into
  **`_synth(name, opts, out)`** where `out` is the destination node.
  `sfx(name, opts)` becomes `this._synth(name, opts, this.master)`. All
  private helpers already take `out`. Add an optional `when` (absolute ctx
  time) parameter to `_noiseBurst`, `_toneSimple`, `_bellTone` so sequences
  (knocks, steps) can be scheduled; default `ctx.currentTime`.
- **`sfxAt(name, position, opts = {})`** — plays `name` from a world
  position. Creates a `PannerNode` with `panningModel: 'HRTF'`,
  `distanceModel: 'inverse'`, `refDistance: 1.2`, `maxDistance: 60`,
  `rolloffFactor: 1.4`; sets its position (`positionX.setValueAtTime` if
  available else `setPosition`); connects panner → `master`; calls
  `_synth(name, opts, panner)`; disconnects the panner after
  `opts.holdSeconds ?? 8` s. `position` is `{x,y,z}` (a `THREE.Vector3`
  works). Returns nothing.
- **`loopAt(kind, position, opts = {})`** — a sustained positional source.
  Returns a handle `{ stop(fadeSeconds = 0.6), setPosition(pos), setGain(g) }`.
  Kinds and recipes in §4.1.3. Handles must survive `setAmbience` changes
  (they connect to `master`, not the ambience gain). Levels must stop their
  loops on dispose (LevelBase does this, §4.2).

#### 4.1.2 New one-shots (`_synth` cases)

Note table (C major, octave 4): `C 261.63 · D 293.66 · E 329.63 · F 349.23 · G 392.00 · A 440.00 · B 493.88`. Levels reach it as `LevelBase.NOTES` (a static on LevelBase, §4.2), since room files may only import from `three` and the core modules listed in §4.7.

Every recipe below is built from the existing helpers (`_blip`,
`_noiseBurst`, `_bellTone`, `_toneSimple`) plus plain oscillators/filters.
Gains are relative to the existing sounds (`step` ≈ 0.06, `door` ≈ 0.09).
`t` is `ctx.currentTime` unless `opts.when` is given.

| name | opts | recipe |
|---|---|---|
| `knock` | `count = 3, gap = 0.42, soft = false` | for i in 0..count−1 at `t + i·gap`: `_noiseBurst(out, 180, 0.12, soft ? 0.14 : 0.26, 'lowpass', when)` + `_blip(out, 95, 60, 0.003, 0.16, soft ? 0.16 : 0.30, when)`. Wood thump. |
| `stepOther` | `soft = false` | `_noiseBurst(out, 90 + rand·30, 0.14, soft ? 0.05 : 0.10)` + `_blip(out, 72, 48, 0.004, 0.12, soft ? 0.06 : 0.12)`. Heavier and slower than `step`. |
| `breath` | — | noise → bandpass, freq ramps 420 → 900 → 420 Hz over 1.9 s, Q 1.2; gain 0 → 0.06 (0.9 s) → 0 (1.0 s). One breath in and out. |
| `whisper` | — | noise → three parallel bandpasses at 700, 1200, 2600 Hz (Q 6) → gain 0.035 with an LFO 7 Hz depth 0.5 on the gain; 1.6 s, linear fade in 0.2 s and out 0.5 s. Unintelligible. |
| `phone` | `rings = 1` | per ring at `t + i·3.0`: two sines 1100 & 1180 Hz → gain node driven by a 20 Hz square-ish tremolo (use an oscillator LFO into gain.gain, depth 1); on for 1.0 s, gain 0.05, 30 ms attack/release. Old bell telephone. |
| `musicbox` | `notes = [freq…], step = 0.34, gain = 0.05, slow = 0` | for each note i at `t + Σ step·(1 + slow·i)`: `_bellTone(out, freq·2, gain, 1.3, when)`. `slow > 0` makes it wind down. |
| `chime` | — | `_noiseBurst(out, 4000, 0.15, 0.02, 'highpass')` (PA opening) then `_bellTone(out, 392, 0.045, 2.6, t+0.15)` and `_bellTone(out, 329.63, 0.045, 2.8, t+0.65)`. The tannoy: G then E. |
| `static` | `dur = 0.8` | noise buffer at `playbackRate 2.5` → bandpass 1800 Hz Q 0.5 → gain 0.06; hard cut at `dur` (5 ms release). |
| `slam` | — | `_noiseBurst(out, 200, 0.5, 0.35)` + `_blip(out, 70, 35, 0.005, 0.5, 0.5)`. |
| `tinnitus` | — | sine 8400 Hz, gain 0 → 0.028 over 2.5 s, hold 2.0 s, cut to 0 in 50 ms. Also calls `this.hush(4.5)`. |
| `reverse` | `dur = 2.2` | noise → lowpass 900 Hz → gain rises exponentially from 0.0005 to 0.16 over `dur`, then instantly 0. Reverse-swell before a reveal. |
| `toll` | — | `_bellTone(out, 98, 0.06, 7)` + `_bellTone(out, 98.7, 0.03, 6.5)`. Distant bell. |
| `heartbeat` | `beats = 2` | per beat at `t + i·0.9`: `_blip(out, 60, 40, 0.005, 0.18, 0.28)` then `_blip(out, 58, 40, 0.005, 0.16, 0.20, +0.32)`. |
| `handle` | — | four `_blip(out, 1400, 900, 0.002, 0.03, 0.05, t + i·0.07)` + `_blip(out, 300, 200, 0.004, 0.12, 0.10, t + 0.3)`. A door handle tried once. |
| `clunk` | — | `_blip(out, 260, 120, 0.002, 0.09, 0.14)` + `_noiseBurst(out, 2400, 0.08, 0.03, 'highpass')`. A fluorescent going out. |
| `piano` | `freq = 261.63, gain = 0.06` | three partials (1, 2, 3.01) via `_toneSimple`-style oscillators, gains `gain`, `gain·0.35`, `gain·0.15`, exponential decay 1.8 / 1.2 / 0.8 s, 4 ms attack. |
| `hummed` | `notes = [freq…], step = 0.55, gain = 0.03` | per note: triangle oscillator at `freq/2` (an octave down) → lowpass 900 Hz → gain with 4 ms attack, hold `step·0.85`, 60 ms release; vibrato: LFO 5.5 Hz depth 6 cents on `detune`. Someone humming. |

Also keep every existing sound unchanged.

#### 4.1.3 Loops (`loopAt` kinds)

Each returns the handle described in §4.1.1. Fade in over 0.8 s.

| kind | recipe |
|---|---|
| `tap` | noise → bandpass 1400 Hz Q 1 → gain 0.05 with LFO 0.4 Hz depth 0.3. Water running. |
| `radio` | triangle chord (root 220 · 1, 1.5, 2.02, detune ±7) → lowpass 1200 Hz → gain 0.025, plus noise → bandpass 2200 Hz → gain 0.012. The wireless between stations. |
| `boiler` | sine 50 Hz gain 0.03, plus a `_blip(out, 1800, 1200, 0.001, 0.03, 0.05)` every 1.1 s (setInterval on the handle; cleared on stop). |
| `hum` | sine 119 Hz + 238 Hz, gains 0.02 / 0.008. Mains hum (a lamp, a fridge). |
| `swing` | every 1.4 s: the ambience `creak` recipe (bandpassed noise sweep 160→90 Hz) at gain 0.10. |
| `rain` | noise → lowpass 1500 Hz → gain 0.07 with LFO 0.3 Hz depth 0.35. |
| `pianoKey` | `opts.freq` (default 329.63): the `piano` recipe every `opts.every ?? 2.6` s. One key pressed over and over. |

#### 4.1.4 New moods

Add to `MOODS`:

```js
night:      { root: 41, chord: [1, 1.189, 2.0],         cutoff: 380, noise: 0.05, events: ['creak', 'clock', 'wind'] },
stairwell:  { root: 36, chord: [1, 1.5, 2.0, 2.997],    cutoff: 300, noise: 0.08, events: ['hum', 'drip', 'rumble'] },
school:     { root: 49, chord: [1, 1.26, 1.5],          cutoff: 520, noise: 0.06, events: ['hum', 'hum', 'clock', 'rattle'] },
playground: { root: 38, chord: [1, 1.498, 2.244, 3.0],  cutoff: 360, noise: 0.15, events: ['wind', 'wind', 'creak'] },
under:      { root: 33, chord: [1, 1.189, 1.782],       cutoff: 260, noise: 0.09, events: ['drip', 'rumble', 'clock'] },
```

#### 4.1.5 Dread and hush

- **`setDread(d)`** (`0..1`, default 0; reset to 0 on every `setAmbience`).
  While an ambience is playing: the ambience low-pass `frequency` →
  `cutoff · (1 − 0.6·d)` (`setTargetAtTime`, 0.8 s); a sub oscillator (sine
  at `root/2`, created lazily on the current ambience, connected to the
  ambience gain) with gain `0.06·d`, amplitude-modulated by an LFO at
  0.9 Hz depth 0.5; drone detune drift `±20·d` cents (set each voice's
  `detune` target to a random value in that range every 3 s while d > 0).
- **`hush(seconds = 2, depth = 1)`** — ambience gain to `0.5·(1 − depth)`
  over 0.25 s, back to 0.5 starting at `t + seconds` over ~1.5 s
  (`setTargetAtTime`). Cancels prior scheduled ambience gain changes.
  Silence before a reveal.

### 4.2 `src/core/LevelBase.js`

New methods. All are thin and safe.

```js
static NOTES = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0, B: 493.88 };
static tune(letters) { return [...letters].map((l) => LevelBase.NOTES[l]); }   // 'EGAGEGE' → freqs

playSoundAt(name, position, opts)      // → this.game.audio.sfxAt(...)
loopAt(kind, position, opts)           // → handle; remembered in this._loops; all stopped in dispose()
dread(v)                               // → this.game.audio.setDread(v)
hush(seconds, depth)                   // → this.game.audio.hush(...)
flinch({ grain = 0.3, fringe = 0.008, desat = 0.6, duration = 0.35, flash = 0 } = {})
                                       // → engine.pulseGrade(...) and, if flash > 0, ui.flash('#000', flash)
```

**Seen / unseen.** `isSeen(obj, opts)` answers "is this object inside the
player's view cone right now?"

```js
isSeen(obj, { angleDeg = 55, maxDist = Infinity, occluders = null } = {})
```

- Take `obj.getWorldPosition` and the camera's world position and forward
  (`camera.getWorldDirection`). If distance > `maxDist` → false. If the
  angle between forward and the direction to the object exceeds `angleDeg`
  → false.
- If `occluders` (an array of meshes) is given: raycast from the camera
  toward the object; if any occluder is hit closer than the object → false.
- Otherwise true. Ignores `obj.visible`.

```js
whenUnseen(obj, fn, { minTime = 0.4, angleDeg = 55, maxDist = Infinity, occluders = null, once = true } = {})
whenSeen(obj, fn,   { minTime = 0.15, angleDeg = 40, maxDist = 30, occluders = null, once = true } = {})
```

- Both register a ticker and return the unregister function.
- `whenUnseen`: accumulate time while `!isSeen(...)`; when it reaches
  `minTime`, call `fn(obj)`. If `once`, unregister; else reset the
  accumulator and require the object to be seen again before it can fire
  again (one call per look-away).
- `whenSeen`: the mirror image (accumulate while seen; one call per
  sighting when not `once`).
- These use the camera, so `player.teleport(x, z, yaw)` in `debugSolve()`
  can turn the player away and the callbacks fire on the next ticks.

**Captions.** `cue(text, worldPos = null)` shows a bracketed subtitle for a
sound — `[knocking]` — for 3.2 s in the `cue` voice (§4.4). If
`this.game.save.data.captions` is true and `worldPos` is given, append a
direction word computed from the camera: yaw difference |a| < 35° →
`ahead`; > 145° → `behind you`; a > 0 → `to your left`; else `to your
right`; if the point is more than 1.5 m above the camera and within 5 m
horizontally → `above you`. Example: `[knocking] — to your left`.

**Blockers.** `addBlocker(min, max)` now returns the `Box3` it pushed, and
`removeBlocker(box)` splices it out of `this.solids` (XV's last room uses
this).

**Disposal.** `dispose()` also stops every handle in `this._loops`, resets
dread (`audio.setDread(0)`), and clears any tickers.

### 4.3 `src/core/presence.js` (new)

```js
export function makeFigure({ height = 1.95 } = {}) → THREE.Group
```

A dark human shape from primitives, `height` tall: a tapered coat
(`CylinderGeometry(0.17, 0.24, height·0.62, 10)`), shoulders (a squashed
sphere), a head (`SphereGeometry(0.11)`), no arms needed. Material
`MeshStandardMaterial({ color: 0x07070a, roughness: 1, metalness: 0 })`,
`castShadow` false, `receiveShadow` false. It reads as a silhouette only
against lit backgrounds — that is the intent. Methods:
`figure.faceToward(vec3)` (rotate about y to face a point);
`figure.setHeight(h)`.

```js
export class Presence {
  constructor(level, figure, {
    stations = [],          // Vector3[] — where it can stand
    minUnseen = 0.6,        // seconds unseen before it may move
    angleDeg = 55, occluders = null,
    onArrive = null,        // (stationIndex) => void
  })
  index          // current station index (−1 = not placed)
  enabled        // master switch (default true)
  placeAt(i)     // instant move to stations[i]; figure.visible = true
  hide()         // figure.visible = false; enabled = false
  advanceTo(i)   // arm: move one station per unseen interval until index === i
  isArmed()
  walkTo(vec3, speed = 1.3, onDone)  // smooth walk (used once, XIV finale); disables unseen logic while walking
  update(dt)     // register with level.track(presence)
}
```

`update(dt)`: if walking, move toward the target at `speed`, face the
direction of travel, call `onDone` on arrival. Else if armed and
`index < target`: accumulate unseen time using
`level.isSeen(figure, { angleDeg, occluders })`; when it reaches
`minUnseen`, `placeAt(index + 1)`, reset the accumulator, call
`onArrive(index)`. Every frame when visible and not walking:
`figure.faceToward(playerPosition)` (it always faces you).

### 4.4 `src/core/Engine.js` and `src/core/UI.js`

Engine:

- `BASE_GRADE = { vignette: 1.15, grain: 0.026, desat: 0.16, lift: 0.025, fringe: 0.00045 }`.
- **`setGrade(partial | null)`** — merges `partial` over `BASE_GRADE` and
  writes the uniforms (`uVignette`, `uGrain`, `uDesat`, `uLift`,
  `uFringe`). `null` restores the base. Called by `main.js` on level start
  with `meta.grade`.
- **`pulseGrade({ grain = 0.3, fringe = 0.008, desat = 0.6, duration = 0.35 })`**
  — snap the three uniforms to these values, then in `_frame()` ease them
  back to the current grade over `duration` (ease-out cubic). A new pulse
  replaces a running one.

UI:

- **`flash(color = '#000', ms = 110)`** — a new `#flash` div (in
  `index.html`, `position: fixed; inset: 0; pointer-events: none;
  z-index: 8; opacity: 0; transition: opacity 0.25s`). Set background,
  opacity 1 with `transition: none`, then after `ms` restore the transition
  and set opacity 0. Never touches `#fade`.
- **`subtitle(text, duration, { voice = 'inner' } = {})`** — `voice: 'cue'`
  toggles class `cue` on `#subtitle`: upright (not italic), smaller
  (15 px), letter-spacing 0.08em, opacity 0.7. Existing callers keep the
  inner voice.
- **`showKeypad({ …, onKey })`** — call `onKey(k)` on every digit/key press
  (not on delete), before the auto-submit check. Also: when the keypad's
  `keys` string contains letters, a matching letter key on the keyboard
  (`KeyC` … `KeyB`) presses that key, the way digits already do.

`style.css`: `#flash` and `#subtitle.cue`.

### 4.5 `main.js`, `index.html`, `SaveSystem.js`, `levels/index.js`

- `engine.onUpdate`: add `audio.updateListener(engine.camera)`.
- `startLevel`: after `disposeLevel()`, `engine.setGrade(meta.grade ?? null)`.
  If `meta.prologue` and not `skipCard` and not test mode and
  `!save.data.seenPrologues.includes(id)`: push id, save, and
  `await ui.showInterlude(meta.prologue)` before the title card.
- Ending card text → "a dream in fifteen rooms".
- `buildMenu`: set `#menu-sub` text per §2.2.
- Settings: `<label class="check"><input id="set-captions" type="checkbox" /> describe sounds</label>`
  in `#menu-settings`; wire to `save.data.captions`.
- `SaveSystem`: `DEFAULTS.captions = false`, `DEFAULTS.seenPrologues = []`;
  add **`migrate(totalLevels)`**: `unlocked = clamp(max(unlocked, max(completed)+1), 1, totalLevels)`.
  `main.js` calls `save.migrate(LEVELS.length)` right after constructing
  the save. (Existing saves that finished X have `unlocked: 10`; without
  this XI stays locked.)
- `levels/index.js`: `EPILOGUE` per §2.2; comment updated to fifteen files.
- `index.html`: `<title>HIRAETH</title>`, `#flash`, the captions checkbox.

### 4.6 `tools/browser.mjs`

Resolve the executable: `process.env.CHROMIUM_PATH` → `/opt/pw-browsers/chromium`
→ the first existing match of
`~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell`
→ `~/Library/Caches/ms-playwright/chromium-*/chrome-*/Chromium.app/Contents/MacOS/Chromium`
→ `~/Library/Caches/ms-playwright/chromium-*/chrome-*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
(use `fs.readdirSync` on `~/Library/Caches/ms-playwright`; sort matches,
take the newest). Fail with a clear message naming `CHROMIUM_PATH` if none
exists. On this Mac the headless shell exists and level 1 solves in ~12 s.

### 4.7 Docs

- `docs/LEVEL_API.md`: new mood keys; new sfx names with their opts; loops;
  `playSoundAt / loopAt / dread / hush / flinch / isSeen / whenUnseen /
  whenSeen / cue`; `LevelBase.NOTES / tune()`; `presence.js` (and that
  rooms may now import from it — the allowed imports become `three`,
  `../core/LevelBase.js`, `../core/textures.js`, `../core/props.js`,
  `../core/presence.js`); `chalkTexture`, `blurredPhotoTexture`,
  `door.setAngle`; `meta.prologue` and `meta.grade`; keypad `onKey`; and a
  paragraph "Rooms XI–XV: scares" restating §1.2 rules 1–6.
- `docs/DESIGN.md`: arc table rows 11–15 (phase 5/6/7); §3.2 canon added
  to Canon; a "Rooms XI–XV" section pointing at this spec.
- `README.md`: "ten rooms — and, once you've woken, five more"; controls
  unchanged; note the captions setting; note `CHROMIUM_PATH` fallback.

### 4.8 `src/core/textures.js` and `src/core/props.js`

Small shared helpers two or more rooms need (rooms cannot share code with
each other).

- **`chalkTexture({ tally = 0, lines = [], size = 512, base = '#5a5852', chalk = '#e8e4d8' })`**
  in `textures.js` → a `CanvasTexture` (sRGB) of a concrete-coloured
  square with a child's tally of `tally` strokes (groups of five, the fifth
  struck through, slightly uneven, 6 px wide, alpha 0.85) across the top
  third, and each string in `lines` written below in a steadier italic
  hand (`'italic 44px Georgia'`). The returned texture has a method
  **`redraw({ tally, lines })`** that repaints the same canvas and sets
  `needsUpdate = true`, so several planes sharing the texture change
  together (XII's two −2 landings; XV's corridor).
- **`blurredPhotoTexture({ figures = 2, width = 128, height = 96 })`** in
  `textures.js` — the "figures too blurred to name" photograph used in I
  and V, as a shared helper: warm grey gradient, `figures` dark
  head-and-shoulders ellipses, `blur(2px)`. (Level05 keeps its local copy;
  do not refactor it.)
- **`door.setAngle(radians)`** on `makeDoor` in `props.js`: sets the swing
  target directly (so a door can stand ajar at 0.2 rad). `setOpen` keeps
  working as before.

---

## 5. The rooms

Conventions for every room:

- Coordinates in metres. Player spawns facing −Z unless stated
  (`spawn.yaw = 0`).
- `meta.grade` for all five: `{ vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 }`.
- "Cue" means `this.cue(text, pos)` — a captioned sound. Use it for every
  scare sound that carries information (knocks, footsteps, the chime, a
  door). Do not cue ambience.
- "Objective" means `setObjective`. Objectives point at feelings and
  places.
- All notes are signed `— M.` in the body's last line as in rooms I–X.
- Wrong attempts play `wrong` unless the room says otherwise and give the
  quoted nudge.
- `debugSolve()` must finish inside 40 s of wall time (the harness allows
  45). Every wait below is chosen to keep that.
- Threshold checks use `this.tick` and `player.position`, as in Level01.

### 5.1 XI — The Bedroom

```js
static meta = {
  id: 11, numeral: 'XI', title: 'The Bedroom', mood: 'night',
  prologue: /* §2.2 */,
  grade: { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 },
  intro: 'It is 3:07. It has been 3:07 for as long as you can remember.',
  outro:
    'The door was never going to open.\n' +
    'You knew that. You knocked anyway,\n' +
    'the way you always did, and something knocked back.',
};
```

**Layout.** Interior 4.2 (x) × 3.6 (z) × 2.5 (h). Origin at the room's
centre. +Z is the door wall (south). Fog `#0a0a10`, near 1, far 9.

- Walls: wallpaper (`base '#8d8378', stripe '#7f7468'`), floor carpet
  (`'#5a4e4c'`), ceiling plaster (`'#9a9488'`).
- **Ceiling stars:** ~45 tiny emissive spheres (`0x9fd6a8`, emissiveIntensity 1.6, radius 0.012) or `Points` on the ceiling, in three loose constellations. They are the only thing that reads as childhood.
- **Door** (south wall, x +1.2): `makeDoor({ color: '#5a4636' })`, never opens. Handle plate at 1.02.
- **Window** (north wall, x −0.6): 1.0 × 1.2, black glossy pane; curtains (two boxes, `'#6b6f7c'`); `loopAt('rain', (−0.6, 1.5, −2.6))`.
- **Bed:** along the west wall, head at north: frame 0.95 × 2.0 at x −1.55, z from −1.6 to +0.4; mattress, a pillow, a folded blanket.
- **Desk:** east wall, x +1.65, z −0.9..+0.1; a lamp (`makeBulbLight`-style bulb but a desk lamp: a small cone + `PointLight 0xffd9a8`, intensity 3.2, distance 6, at (1.4, 1.05, −0.5)) — **the only light** besides the stars and a `HemisphereLight(0x3a3f55, 0x0b0b10, 0.25)`. A drawer (front face interactable). The **clock**: a plane 0.22 × 0.09 at (1.6, 0.86, −0.05) facing −X, `textTexture({ text: '3:07', font: 'bold 60px monospace', color: '#ff7a5a', bg: '#140c0a' })`, material emissive `0xff6a4a` intensity 0.9. Interactable: "the clock". A **music box** on a shelf above the desk (small box 0.14 × 0.08 × 0.1, `'#7a5a3a'`).
- **Chair** at the desk (`makeChair`), facing the desk. Later turned to face the bed.
- **Wardrobe:** south wall, west of the door: x −1.05..−0.05, depth 0.62 (z +1.18..+1.8), height 2.1. Two doors hinged at the sides (each `makeDoor`-like panels or thin boxes rotated on a pivot; use `makeDoor({ width: 0.5, height: 2.0, knob: false })` ×2, tracked). Inside: a rail with five coats (boxes 0.3 × 1.0 × 0.12 in browns and greys) and one coat on the floor later. The **back panel**: a wood plane at z +1.79 filling the back, hinged on its west edge, `setOpen` swings it into the space beyond.
- **Beyond the back panel:** a concrete landing 2.0 × 2.0 (z +1.8..+3.8, x −1.05..+0.95, walls concrete `'#6e6a64'`), a caged bulb (`makeBulbLight({ color: 0xd8dcd0, intensity: 2.5, distance: 5, y: 2.2 })`, off until the panel opens), and the first four steps of a stair going down at the far side (boxes; not walkable — a blocker behind them). Threshold: `player.position.z > 2.6`.
- **Mirror:** west wall, x −2.08, z +0.95, 0.5 × 0.8 at y 1.4: `MeshStandardMaterial({ color: 0x0a0b0e, metalness: 1, roughness: 0.05 })`. A **sheet** over it: a box 0.62 × 0.95 × 0.03, `'#b9b1a2'`, at the same place; later on the floor at (−1.75, 0.02, 0.95) rotated flat.
- **Knock spots** (six): planes 0.5 × 0.5 at y 1.3, flush with the wall (2 mm proud of it), material `MeshStandardMaterial({ color: 0x1a1612, transparent: true, opacity: 0.12 })` — a faintly darker patch of wallpaper, so they read as places. Prompt `knock`. (The Interaction raycaster only tests registered objects, so the wall behind never blocks them.) Positions: `W1` west wall z −1.0 · `W2` west wall z +0.6 · `N1` north wall x −1.4 · `N2` north wall x +1.2 · `E1` east wall z −1.4 · `E2` east wall z +0.9. Plus the wardrobe back panel (`WB`), prompt `knock`, only reachable with the wardrobe doors open (they open on interact).
- Spawn (−0.9, 0, 0.7), yaw π (yaw 0 faces −Z and forward is `(−sin yaw, 0, −cos yaw)`, so π faces +Z — the door wall). Bounds: one box over the room and the landing (x −2.1..2.1, z −1.8..3.8); the south wall's colliders keep the player inside except through the wardrobe.
- Sighted fallback for each knock burst: at the sounding spot, a small `makeDust`-like puff (12 points, 0.35 m box, 1.2 s life) drifts down the wall.

**Sounds.** Ambience `night`; rain loop; a `clock` event is in the mood; the
music box plays four notes (`musicbox` with `tune('EGAG')`, `slow 0.15`)
the first time it is unseen after the note is read (`whenUnseen(musicBox, …, { once: true })`).

**State machine.**

```
S0  start
    objective: 'the door was open when you fell asleep'
    door.interact → locked + subtitle 'Locked. From the other side.' (5 s)
                  → after 1.2 s: playSoundAt('knock', doorPos, {count: 1, soft: true}); cue('a knock', doorPos)
                  → after 4.0 s (first time only): playSoundAt('hummed', (1.2, 1.4, 2.8) — a metre beyond the door, {notes: tune('EGAG')}); cue('humming', that pos)
    knock spots → subtitle 'The wall is cold.' (no sound) until S1
    drawer.interact → giveNote (below); → S1
    unseen change 0 (armed at start; fires the first time the wardrobe is unseen for 0.4 s once 15 s have passed in-level):
        wardrobe west door door.setAngle(0.2) — ajar, not swung

S1  note read
    objective: 'listen'
    ROUND 1: source = E2. Every 6 s: playSoundAt('knock', E2pos, {count: 3}); cue('knocking', E2pos); dust puff at E2.
    Interacting with any knock spot is YOUR two knocks: playSoundAt('knock', thatPos, {count: 2}) at once.
    knock at E2 → 0.6 s later her reply: playSoundAt('knock', E2pos, {count: 2, soft: true}); subtitle 'Two. Still there.' (4 s); → change 1; → after 5 s ROUND 2
    knock at any other spot → 0.6 s later one dull knock: playSoundAt('knock', thatPos, {count: 1, soft: true}); wrongCount++;
        if wrongCount ≥ 2: subtitle 'Nothing there. Listen — it is coming from somewhere else.' (5 s)
    change 1 (whenUnseen(chair)): chair rotates to face the bed (rotation.y += π·0.85, position nudged 0.15 toward the room)
    ROUND 2: source = W1 (above the bed head). Same loop; correct knock → 'Two. Still there.' → change 2 → after 5 s ROUND 3
    change 2 (whenUnseen(sheet)): sheet moves to the floor; the mirror is bare. subtitle on next sight of the mirror (whenSeen(mirror)): 'You always kept it covered. You were right to.' (5 s)
    ROUND 3: source = WB (inside the wardrobe). Every 6 s three knocks from (−0.55, 1.2, 1.79); cue('knocking', that pos)
        wardrobe doors: interact → both setOpen (sound 'door'); coats visible; a coat lies on the wardrobe floor from the FIRST look-away after opening (whenUnseen(a marker inside the wardrobe))
        WB.interact (only registered once the doors are open) → your two knocks: playSoundAt('knock', WBpos, {count: 2})
            → after 1.5 s: WB panel setOpen(true, −1); removeColliderOf(panel); 'door'; caged bulb on; playSoundAt('reverse', landingPos, {dur: 1.4}); dread 0.35
            → objective 'down'; subtitle 'Cold air. Concrete. Stairs, going down, where the back of the wardrobe used to be.' (6 s)
S2  panel open
    threshold z > 2.6 → playSoundAt('handle', doorPos); cue('the handle turns', doorPos); flinch({flash: 90}); complete()
```

The clock: `whenUnseen(clock, …, { once: false })` — on each look-away,
30 % chance to swap its texture to one of `'3:O7'`, `'7:03'`, `'3:07 '`
(trailing digit half-drawn) for the next look, then back to `3:07` on the
following look-away. Interact "the clock": subtitle `'3:07. It was 3:07 when you fell asleep, too.'` (5 s).

**Texts.**

- Note (`id 'l11-note'`, title `'a note in the drawer, older than the others'`):
  ```
  when you couldn't sleep I knocked on the wall
  and you knocked back.

  two for "still there".
  three for "come and find me".

  — M.
  ```
- Journal clue on the first correct knock (`learnClue`, `id 'l11-code'`, title `'the knocks'`, body `'two — still there.\nthree — come and find me.'`).

**debugSolve.**

```
interact drawer → wait 0.3 → closeModal
wait 0.4; interact E2 → wait 6.0 (round-2 arms after ~5.6 s)
interact W1 → wait 6.0
interact wardrobe doors → wait 0.4; interact WB → wait 2.0
teleport(−0.4, 3.0) → wait 0.6
```
(≈ 16 s.)

**Fairness.** The knocking source repeats every 6 s until answered; the
dust puff marks it; wrong spots answer with one dull knock; after two
wrong, the nudge. The wardrobe round says "from the wardrobe" nowhere in
text — the sound and the ajar door are the clue; captions add "behind you"
when facing the bed.

### 5.2 XII — The Stairwell

```js
static meta = {
  id: 12, numeral: 'XII', title: 'The Stairwell', mood: 'stairwell', grade: /* §5 */,
  intro: 'The stairs go down further than the building does.',
  outro:
    'You stopped, and it caught up,\n' +
    'and nothing happened, except that a door opened.\n' +
    'That was all it ever wanted: for you to stop.',
};
```

**Layout.** A switchback stair shaft, concrete throughout
(`makeMat('concrete', { base: '#7a766f' })`, floors `'#5e5b55'`), fog
`#0c0c0f`, near 1, far 12. Floor height **2.72 m**; each floor is two
half-flights of 8 steps (rise 0.17, run 0.28) around a half-landing.

The shaft is a dog-leg stair. In plan it spans **x −3.2..3.2, z −1.3..1.3**:

- the **main landing** on the west: x −3.2..−1.0, full z;
- the two flights side by side between x −1.0 and x +1.24 (8 steps × 0.28
  run): the **south flight** (z −1.3..0) descends **eastward** from the
  main landing to the half-landing, the **north flight** (z 0..1.3)
  descends **westward** from the half-landing to the next main landing;
- the **half-landing** on the east: x 1.24..3.2, full z, at the main
  landing's y − 1.36.

So every main landing is on the west, every half-landing on the east, and
one floor down is y − 2.72. Build with a helper `buildFloor(y, label, opts)`
from a data table. Steps are boxes; register each step as a collider
**and** ground (`addCollider(step, { alsoGround: true })`) so the player
climbs them (step height 0.17 < STEP_UP 0.55). Add a handrail (thin box)
on the open side of each flight and a solid stair-well wall between the
two flights' undersides where needed so the shaft has no holes.

Physical main landings, top to bottom (y):

| idx | label | y | door / feature |
|---|---|---|---|
| L0 | `2` | 0 | the wardrobe's back — a wooden panel in a doorframe on the west wall (x −3.2), "it shut behind you" (locked) |
| L1 | `1` | −2.72 | fire door, locked, window dark |
| L2 | `G` | −5.44 | fire door, locked, window dark |
| L3 | `−1` | −8.16 | fire door + **stub** (see below) |
| L4 | `−2` | −10.88 | fire door + stub; **chalk** on the south wall |
| L5 | `−3` | −13.60 | fire door + stub |
| L6 | `−1` | −16.32 | fire door + stub |
| L7 | `−2` | −19.04 | fire door + stub; **chalk** (same texture object as L4) |
| — | — | −20.40 / −21.76 | below L7: the south flight down to a half-landing at −20.40, then the north flight down toward where "L8" would be at −21.76; a blocker closes the shaft there |

**Loop:** `tick`: if `footY < −20.5` (`footY = player.position.y − 1.62`,
i.e. just below the half-landing under L7, on the north flight) →
`player.teleport(p.x, p.z, player.yaw, footY + 8.16)`, `_loops++`, redraw
the chalk. The player was heading from "−2" toward "−3"; after the teleport
they are on the north flight below L4's half-landing, still heading west
and down toward L5 ("−3"). Same geometry, same labels, same heading: no
seam. The −2 landing they just left is above and behind them, so the
chalk redraw is an unseen change.

**Per-landing features.** All on the main (west) landing unless said.

- Label: `makeSign({ text, width 0.5, height 0.5, bg '#4a4844', color '#d9d4c8', font 'bold 160px Georgia' })` on the north wall (z +1.3) at x −2.1, y 1.5.
- Caged bulb: `makeBulbLight({ color: 0xd8dcd0, intensity: 3.2, distance: 7, y: 2.45 })` over each main landing at (−2.1, y, 0); L2's and L6's flicker (Level01 stutter pattern). One shadow-caster only (L3). A dimmer bulb (1.4) over each half-landing.
- Fire door: `makeDoor({ width: 0.95, color: '#4f5a5e', frameColor: '#3a4043' })` in the **west wall** at (−3.2, y, 0), swinging outward (−X), with a wire-glass window (plane 0.25 × 0.5 at y 1.55, `MeshStandardMaterial({ color: 0x1a1d20, transparent: true, opacity: 0.55, roughness: 0.1 })`). Locked doors: interact → `locked` + a flavour line (L1: `'Locked. Through the glass, a corridor with every light off.'`; L2: `'Locked. Someone has stacked chairs against the other side.'`).
- **Stub** (L3–L7): behind the door, a corridor running −X from x −3.2 to x −8.2, 1.4 wide (z −0.7..0.7), height 2.6, dark, with four lockers (boxes) and, at x −7.7, a small emissive plane + `PointLight` (the "light in the corridor") that is **on for exactly one label per loop count**: loop 0 → the `−3` stub (L5); loop 1 → both `−2` stubs (L4, L7); loop ≥ 2 → both `−1` stubs (L3, L6). "One door closer each loop." When a door opens (below), its stub's light comes on warm (`0xffd9a8`, 4).
- Fire-plan sign on each main landing (`makeSign`, 0.4 × 0.5, `'#d8cfba'`) beside the door: `'IN THE EVENT OF FIRE\ndo not use the lifts\ndo not run\nassembly point: the playground'`. Interact → subtitle `'do not run.'` (3 s).
- **Chalk** (L4 and L7, one shared `chalkTexture`): a plane 0.7 × 0.35 at y 1.2 on the south wall (z −1.3) at x −2.1. `chalk.redraw({ tally: min(loops + 1, 12), lines })` with `lines = ['wait for me']`, plus `'please'` if `pleaded ≥ 1`, plus `'you always did this'` if `pleaded ≥ 2`. Interact → `learnClue({ id: 'l12-chalk', title: 'chalk on the −2 landing', body: '<n> strokes. and, underneath: wait for me.' })` (body updated on later reads).
- Spawn on L0's main landing at (−2.1, 0, 0) facing the first (south) flight, i.e. facing +X: `spawn.yaw = −π/2` (forward is `(−sin yaw, 0, −cos yaw)`; −π/2 → (1, 0, 0)).
- Bounds: x −8.4..3.4, z −1.5..1.5, y −22..3.

**Sounds.**

- Ambience `stairwell`. Dread starts 0.15, +0.15 per loop (cap 0.75 before the approach).
- **Footsteps below:** while the player's planar speed > 0.5: every 0.62 s `playSoundAt('stepOther', { x: p.x + jitter, y: p.y − 1.62 − 2.9, z: p.z + jitter })`; cue only the first time (`cue('footsteps, below', pos)`). When the player stops: one more step 0.5 s later, then nothing.
- The mood's `hum`/`drip` events do the rest.

**State machine.**

```
S0  descending. objective: 'down'
    still (planar speed < 0.05, no modal) for 8 s while footY > −8.0 (above −1):
        once: subtitle 'Below you, the footsteps stop too. They are waiting to see what you do.' (6 s); reset the still timer
    footY ≤ −8.0 (at or below −1) and still for 8 s → S1
S1  approach (6.5 s)
    steps 0..9 at t = i·0.6: playSoundAt('stepOther', pos_i) where pos_i moves from 2.9 m below the player to 0.5 m behind them (interpolate y and a small horizontal offset behind, using player yaw); dread ramps 0.35 → 1.0
    the bulb over the nearest landing dims to 20 % across the approach
    if the player moves (planar speed > 0.3) before t = 6.0 → RETREAT:
        6 steps receding over 3 s (positions back down the flight); dread → 0.4; pleaded++; chalk redraw on next loop pass;
        subtitle 'It goes back down. It will wait as long as you make it.' (5 s); → S0 (still timer reset)
    at t = 6.0: playSoundAt('breath', playerPos + 0.35 m to the left at ear height); cue('a breath', pos); hush(3); flinch({ flash: 0 })
    at t = 6.5: the fire door on the main landing at or nearest below the player (largest landing y ≤ footY + 0.3) unlocks: 'unlock', door.setOpen(true, +1), removeColliderOf(panel), its stub light warms; dread → 0.5; objective 'through'
        subtitle 'The door beside you clicks, and swings, and there is nobody on the stairs at all.' (6 s)
        loop teleport disabled; footsteps-below disabled
S2  threshold: inside that stub, x < −7.7 → complete()
```

Also: `whenSeen` on each stub window while its light is on → the first
time only, subtitle `'A light on in the corridor beyond. One door closer than it was.'` (5 s) — from loop 1 onward.

**debugSolve.**

```
teleport(−2.1, 0, player.yaw, −8.16)   // onto L3's main landing (−1); footY = −8.16
wait 8.6                                // still → S1
wait 6.8                                // approach completes; L3's door opens
teleport(−7.9, 0, player.yaw)           // into the L3 stub, past x −7.7
wait 0.6
```
(≈ 16.5 s.) `player.teleport(x, z, yaw, y)` sets foot height when `y` is
passed; without `y` the player keeps their height and the ground raycast
finds the stub floor.

**Fairness.** The chalk says it. The fire plan says it. The footsteps stop
when you stop. The pre-loop line at 8 s tells the player stillness is
noticed. Retreat costs a few seconds and adds a word.

### 5.3 XIII — The School

```js
static meta = {
  id: 13, numeral: 'XIII', title: 'The School', mood: 'school', grade: /* §5 */,
  intro: 'The school is dark, and the bell has not rung, and someone is playing one note.',
  outro:
    'You played it once for her and never again.\n' +
    'Tonight it played itself, all the way to the end,\n' +
    'with nobody at the keys.',
};
```

**Layout.** A corridor along −Z from z = 0 (entrance) to z = −30 (hall
doors), width 2.6, height 3.0; then the hall. Fog `#0b0d10`, near 2, far
26. Materials: corridor walls plaster `'#a9a597'` with a painted dado
(`'#6f7a72'`) below 1.1 m (a second thin box), floor checker
(`a '#c9c3b2', b '#8b8f8a', cell 128, repeat [3, 34]`), ceiling
`ceiling` texture. Ten `makeFluorescent({ length: 1.4, intensity: 4.5 })`
at z = −1.5 − 3i (i = 0..9), the fourth (i = 3) with `flicker 0.35`.
Corridor `HemisphereLight(0x6f7580, 0x15171b, 0.35)`.

- **Entrance** (z 0..+2): the fire door you came through (locked behind you: `'It shut behind you. They always do.'`), a wet-floor sign (a yellow A-frame from two boxes).
- **West wall (x −1.3):**
  - **Pegs** z −2..−7: a rail with 16 hooks (small cylinders); above each, a name card (`textTexture`, 0.12 × 0.08, `'#e8e0cf'`) with a made-up first name (never the player's); peg **12** (z ≈ −6.1) has a card with **a drawing of a sunflower** (canvas: yellow petals round a brown centre, a green stalk) and no name. A coat hangs on it (a box 0.34 × 0.9 × 0.14, `'#5c4a3d'`).
  - Doors (all `makeDoor`, plate = `makeSign` 0.14 × 0.1 with a bold numeral): **`1`** z −11 · **`2`** z −17 · **`3`** z −23.
- **East wall (x +1.3):**
  - **Office** door z −3 (label `OFFICE`), opens; the office 4 × 3 behind it (z −1.5..−4.5), its own bulb light (stays on through everything).
  - **Lockers** z −6..−12: 12 tall grey lockers (boxes 0.36 × 1.7 × 0.4, `'#7c8386'`, numbers on `textTexture` plates 1–12, **12** at z ≈ −11.6). Interact any locker but 12 → `locked` + one of three lines (`'Locked. Something inside shifts, and settles.'`, `'Locked. A drawing is taped inside — you can see its corner.'`, `'Locked.'`). Locker 12 → opens (its door pivots), inside: a small key on a wool loop.
  - Doors: **`4`** z −15 · **`5`** z −21 · **`6`** z −27.
- **Rooms behind the doors** (build only interiors that open):
  - `1` — a classroom 6 × 5: eight desks with chairs upended on them, a board with chalk `4 · 2 · 3 · 6 =` (canon nod), nothing else. Interact board → subtitle `'Somebody's sum. The answer is rubbed out.'`.
  - `2` — a cupboard 1.4 × 1.4: shelves, buckets. Enter → subtitle `'Buckets. Bleach. A mop with its head down.'`.
  - `3` — **the music room** 6 × 5: desks with chairs upended, **one chair down** at the front desk; an old upright piano (a box 1.4 × 1.2 × 0.6, `'#3a2c24'`, keys strip `'#e6dfd0'`) against the far wall — the source of the repeated note: `loopAt('pianoKey', pianoPos, { freq: NOTES.E, every: 2.6 })` from level start (audible through the door, louder inside). Interact → the recipe `piano` E once + subtitle `'Only one key still sounds. E. The rest are dead.'`. The **board**: `our song\nE  G  A  G  E  —  —` (the last two smudges drawn as chalk clouds). Interact → `learnClue({ id: 'l13-board', title: 'the board in the music room', body: 'our song — E G A G E, and two more, rubbed out.' })`; objective `'the last two notes'`.
  - `4` — a cupboard: mops. Enter → subtitle `'Mops. A bucket. Whoever numbered the doors did it in the dark.'` (6 s) — the plate lies.
  - `5`, `6` — locked. `5`: `'Locked. Behind it, a tap is running.'` (and `loopAt('tap')` faint behind the wall). `6`: `'Locked.'`.
- **Office interior:** a desk with the register (a book: interact → subtitle `'The register. A line for every child. Yours says "left early", every day but Sunday.'` (6 s)); the **tannoy panel** on the wall (box 0.4 × 0.3 with a grille) with a paper label: `chime: G · E — do not adjust`. Interact → `learnClue({ id: 'l13-tannoy', title: 'the tannoy panel', body: 'chime: G, then E. do not adjust.' })`. (Sighted redundancy for the chime.)
- **Hall doors** z −30 (double: two `makeDoor({ width: 0.9 })` mirrored), locked until the player has the wool-loop key: `'Locked. HALL, stencilled on the glass. Your locker had a key.'`.
- **The hall** 14 (x) × 10 (z), z −30..−40, height 5, darker plaster `'#8f8a7c'`, floor wood; a `HemisphereLight` 0.25 and two bulbs; rows of stacked chairs at the sides; the **stage** at z −38..−40, 0.6 high, full width; the **piano** on the stage at (−4, 0.6, −38.5) — a grand from boxes: body 1.6 × 0.35 × 1.4 on three legs, a raised lid (a box rotated 0.9 rad), a keys strip, a **stool** at (−4, 0.6, −37.4). Interact prompt `'the hall piano'`.
- **Fire door** `PLAYGROUND` on the hall's east wall at (7, 0, −37), locked until the tune is played; behind it a 3 m stub going +X. Threshold `x > 9.5`.
- **Tannoy speakers:** two small boxes on the corridor ceiling at z −8 and z −24, plus one in the hall at (0, 4.8, −34).
- Spawn (0, 0, +1.2), yaw 0.

**Sounds.**

- Ambience `school`; the flickering tube; the piano key loop from room 3;
  the tap behind door 5.
- **The chime:** every 24 s (`after` re-armed): `playSoundAt('chime', nearestSpeakerPos)`; `cue('the tannoy chime', pos)`. First one at 10 s.
- After the tune is played correctly: 6 s later, once, `playSoundAt('breath', hallSpeakerPos)`; `cue('a breath, over the tannoy', pos)`.

**State machine.**

```
S0  objective: 'your peg is somewhere along here'
    peg 12 card → interact 'the peg with the sunflower':
        subtitle 'Your peg. No name — she drew a sunflower so you would know it.' (5 s)
        then the coat pocket → giveNote TIMETABLE (below); objective 'music. room 4.' → S1
S1  door 4 → cupboard line (the lie). door 3 → the music room; board → clue; objective 'the last two notes'
    locker 12 → giveItem { id: 'hall-key', name: 'a small key on a wool loop' }; subtitle 'HALL, in her writing on the tag.'
    hall doors: with key → 'unlock', both swing, removeColliderOf; without → locked line
    LIGHTS (once; armed after the timetable note): trigger when player.z < −14 and !isSeen(entranceMarker at (0,1.5,0), {angleDeg: 60}):
        let p = index of the tube nearest the player (tubes sit at z = −1.5 − 3i). Tubes 0 .. p−3 go out one per 0.9 s, from the entrance toward the player:
            each: fixture.light.intensity = 0, tubeMat.emissiveIntensity = 0.05, playSoundAt('clunk', tubePos), cue on the first ('a light going out', pos)
        after the last: the FIGURE (makeFigure) placed under tube p−2 — about six metres behind the player — at (0, 0, z of tube p−2), facing the player
        whenSeen(figure, {minTime: 1.0}) → tube p−2 goes out ('clunk'), figure hidden, flinch(); 1 s later tube p−1 goes out; then the player's tube p flickers for 2 s and holds; dread 0.55
        subtitle (after the flicker settles) 'The corridor behind you is dark now. The office keeps its light. Nothing else does.' (6 s)
S2  hall piano → showKeypad({ label: 'the hall piano — seven notes', length: 7, keys: 'CDEFGAB',
        onKey: (k) => playSoundAt('piano', pianoPos, { freq: NOTES[k] }),
        onSubmit: (code) => code === 'EGAGEGE' ? SUCCESS : WRONG })
    WRONG: 'wrong'; subtitle 'Not how it went. She would have said so, gently.' (5 s); the lid lowers (rotate to 0.15 rad) and lifts again after 2 s
        wrongCount ≥ 3 → subtitle 'The board had five of them. The school has been chiming the other two all night.' (7 s)
    SUCCESS: after 0.8 s the piano plays the seven notes itself (playSoundAt('piano', pianoPos, {freq}) at 0.5 s steps, twice through), the stool slides out 0.4 m ('creak'-like: use 'door' softly), 'unlock' at the fire door, door.setOpen; objective 'the door by the stage'; hush(2) before the first note
        subtitle 'It carries on without you. All the way to the end.' (6 s)
S3  threshold x > 9.5 → complete()
```

**Texts.**

- TIMETABLE (`id 'l13-timetable'`, title `'a timetable, folded small, in the coat pocket'`):
  ```
  MON — music, rm 4
  TUE — sums
  WED — reading
  THU — nature
  FRI — hall
  SUN — home

  the tune from the wireless. you played it for me
  on the hall piano. once, then never again.

  — M.
  ```

**debugSolve.**

```
interact pegCard → wait 0.3 → closeModal
interact locker12 → wait 0.3
interact hallDoors → wait 0.4
interact musicRoomDoor (door 3) → wait 0.3; interact board → wait 0.3
interact hallPiano → wait 0.3; submitKeypad('EGAGEGE') → wait 1.5
teleport(10.0, −37) → wait 0.6
```
(≈ 5 s.) The lights set-piece is not needed for completion; keep it out of
the solve path.

**Fairness.** The peg is the only one without a name; the timetable names
room 4; room 4 is a cupboard and says so; the piano note leads to room 3;
the board gives five notes; the chime plays every 24 s and the office label
spells it; the piano sounds each key you press; wrong gets a nudge, and a
stronger one after three.

### 5.4 XIV — The Playground

```js
static meta = {
  id: 14, numeral: 'XIV', title: 'The Playground', mood: 'playground', grade: /* §5 */,
  intro: 'Coming, ready or not.',
  outro:
    'You hid where you always hid,\n' +
    'and she found you where she always found you,\n' +
    'and pretended, again, to be surprised.',
};
```

**Layout.** Outdoors, night. Origin at the playground's centre. Tarmac
`makeMat('asphalt', { base: '#3e3f44', repeat: [10, 8] })` 36 × 28
(x −18..18, z −14..14). `makeSky({ top: '#0d1020', mid: '#232a3d', bottom: '#4a4256' })`, fog `#1c1e2a`, near 6, far 60. `HemisphereLight(0x3d4660, 0x0d0e14, 0.55)`, a faint `DirectionalLight(0x6d7aa0, 0.35)` from (−10, 20, 10) casting the only shadows.

- **School wall** along z = +12 (x −18..18), height 6, brick-ish plaster `'#6e5f57'`; the fire door stub you exit at (−6, 0, +12) (a lit doorway behind you that goes dark 3 s after start: `clunk`).
- **Fence:** chain-link posts every 3 m along x = ±17 and z = −13 (thin boxes + a translucent mesh plane `opacity 0.35`), 2 m high; blockers along them. **Gate** at (0, 0, −13): a 1.2 m panel (`makeDoor({ width: 1.2, height: 2.0, color: '#3a3f45', knob: false })`), a padlock (small box) at its latch. Beyond the gate: a 6 m dark path (asphalt) between hedges (dark boxes) to z −20; a blocker at z −20.5. Threshold `z < −15`.
- **Lamps:** working lamp at (2, 0, +2): post 4.5 m, `PointLight(0xffe4b8, 6, 18)` at y 4.2, `loopAt('hum', top)`; **dead lamp** at (−3, 0, −10): same post, its light at intensity 0 with a 5 % duty flicker (Level01 stutter with `on` chance 0.05, intensity 1.2 when on).
- **The last house** beyond the fence at (−12, 0, −22): a dark box 8 × 6 × 5 with **one lit window** (emissive plane `0xffd9a2` + a small light) — canon (VI). It back-lights the figure's start position.
- **Swings** at (−9, 0, −3): a frame 4 m along x (two A-legs + top bar at y 2.4), five seats (boxes 0.45 × 0.05 × 0.2) on chains (thin cylinders). Seat 3 swings: rotate the chain+seat group about the top bar, `θ = 0.55·sin(t·1.55)`; `loopAt('swing', seatTop)`. Interact any seat → subtitle `'The chains are cold. This one moves by itself, and always did.'`.
- **Roundabout** at (0, 0, −6): disc r 1.5, 0.35 high, six handrails; `whenUnseen(disc, …, { once: false, minTime: 1.2 })` → rotate `+0.6 rad` (snap; it turned while you weren't looking). Interact → subtitle `'It has turned since you looked. Only a little.'`.
- **Slide** at (8, 0, −4): a ladder (blockers) up to a platform 2.2 m, a slope down toward −Z. Beside its foot: **the pipe** — a concrete tunnel big enough to walk into: `CylinderGeometry(1.0, 1.0, 2.6, 16, 1, true)`, `DoubleSide`, concrete mat, axis along X, centred at (10.5, 0.85, −6) so it sits 0.15 m into the ground and clears 1.85 m inside; open at both ends (x 9.2 and x 11.8); a low mound (a squashed sphere) over its middle. Do **not** `addCollider` the tube (its AABB would block the opening); instead add two blockers for its side walls: `[9.2, 0, −7.2]..[11.8, 2.2, −6.8]` and `[9.2, 0, −5.2]..[11.8, 2.2, −4.8]`. Its interior is hiding place **H_pipe**: `Box3 (9.4..11.6, 0..2, −6.7..−5.3)`. Occluders: the tube mesh and the mound.
- **Climbing frame** at (10, 0, +4): a 2 × 2 × 2 lattice of thin bars (a decoy hiding place inside it: `H_frame`).
- **Shelter** at (−11, 0, +6): three walls (back wall along x at z +7.5, sides at x −12.5 and −9.5), roof at 2.4, open toward −Z; a bench inside; the **rhyme** painted on the back wall (`makeSign` 2.4 × 1.2, `bg '#5f6a6a'`, `color '#e2dccb'`, font `'italic 34px Georgia'`). Behind it, a hedge (a dark green box x −13..−8.5, z 8.7..9.5, height 1.8; blocker). Hiding place **H_shelter** = the gap **behind** the shelter, between its back wall and the hedge: `Box3 (−12.5..−9.5, 0..2, 7.6..8.6)`; entered round the shelter's east side. Occluders: the shelter walls, the hedge.
- **Shed** at (13, 0, −10): a hut 2.4 × 2.4 × 2.6 (`wood '#4a3a2c'`), door shut (interact → `locked` + `'Locked. It always was. That was never the point of it.'`). Hiding place **H_shed** = behind it, toward the fence corner: `Box3 (12..14.5, 0..2, −12.6..−11.3)`. Occluder: the shed.
- Decoy hiding place: under the slide platform (`H_slide`, `Box3 (7..9, 0..2, −5..−3)`).
- Spawn (−6, 0, +10.5), yaw 0.
- Bounds: x ±16.5, z −20 (after the gate opens; before, the gate's collider holds) .. +11.5.

**The figure.** `makeFigure()`; a `Presence` with `occluders = [pipe, mound, shed, shelter walls, slide platform]`, `minUnseen 0.6`. Stations:

```
S0  (−1, 0, −11.5)     start — by the gate, in front of the lit window beyond the fence
// toward the pipe
S1  (4, 0, −8.5)   S2 (8.5, 0, −7.5)   S3 (12.6, 0, −6)      ← just outside the pipe's east mouth, ~2 m from the player inside
R1  (5, 0, −2)                                               ← rest, in the open, lamp-edge
// toward the shed
S4  (9, 0, −6)     S5 (12, 0, −8)      S6 (11.4, 0, −11.6)   ← the shed's south-west corner, ~1.9 m from the player behind it
R2  (7, 0, +1)                                               ← rest, mid-playground
// toward the shelter
S7  (−3, 0, +3)    S8 (−8, 0, +5)      S9 (−9.2, 0, +8.1)    ← the east end of the gap behind the shelter, ~1.8 m from the player
R3  (−8.2, 0, +5.4)                                          ← in the open, ~2.5 m from where the player steps out of the gap
```

Station indices in `Presence.stations`: S0..S3 = 0..3, R1 = 4, S4..S6 =
5..7, R2 = 8, S7..S9 = 9..11, R3 = 12.

Rule, applied every tick by the level:

```
if the presence's target is a hiding station (S3/S6/S9):
    presence.enabled = currentHidingVolume.containsPoint(playerFoot)   // it only comes while you are hidden
elif the presence's target is a rest station (R1/R2/R3):
    presence.enabled = !currentHidingVolume.containsPoint(playerFoot)  // it steps into the open only once you come out
```

The Presence itself only moves while unseen (angle + occluders). On
arriving at a hiding station: `playSoundAt('knock', stationPos, { count: 2 })`,
`cue('two knocks', pos)`, subtitle `'Two. Still there. You can come out.'`
(5 s), and the level sets the next target to the rest station. On arriving
at a rest station the level arms the next hiding place. Between phases it
stays at rest until the next correct hide.

**State machine.**

```
S0  objective 'the rhyme on the shelter wall' (the shelter is the only lit-ish thing: its back wall catches the lamp)
    figure at S0, visible, faces the player. Rhyme sign interact → giveNote RHYME; objective 'hide, the way you used to' → P1
    idle 60 s after the rhyme with no correct hide → subtitle 'You could hide. That was always your part.' (6 s)
    wrong hiding place (H_frame / H_slide / a correct one out of order) for 8 s → subtitle 'Nothing comes. It was never this one — not first.' (5 s)
    the moving swing: stops dead ('swing' loop stop) the first time the figure moves (S0→S1); cue('the swing stops', seatPos)
P1  target H_pipe: presence.advanceTo(3) (S1→S2→S3) while the player is hidden in the pipe; on arrive(3): knocks; objective 'the second place'
    then advanceTo(4) (R1) once the player has left H_pipe; on whenSeen(figure) — first time only — subtitle 'It is standing in the open now. Closer. It does not move while you watch.' (6 s)
P2  target H_shed: advanceTo(7) (S4→S5→S6) while hidden behind the shed; on arrive(7): knocks; objective 'the last place'; then advanceTo(8) (R2) once out
P3  target H_shelter: advanceTo(11) (S7→S8→S9) while hidden behind the shelter; on arrive(11): knocks; then advanceTo(12) (R3) once out
FIN when the presence reaches R3 (the player is out of the gap and about 2.5 m from it, and it faces them):
    hold 4 s: hush(4), dread 1.0. subtitle 'It does not come any closer. It never did.' (5 s)
    then presence.walkTo((0, 0, −12.2), 1.6) — ~19 m, ~12 s: dread eases 1.0 → 0.4; the swing's creak loop resumes faintly
    on arrival: 'unlock' at the padlock, padlock hidden, gate.setOpen(true, −1), removeColliderOf(gate.panel); then walkTo((0, 0, −16), 1.6) → presence.hide(); the working lamp: 'clunk' + light off; objective 'follow'
    subtitle 'It had the key. Of course it had the key.' (5 s)
END threshold z < −15 → complete()
```

**Texts.**

- RHYME (`id 'l14-rhyme'`, title `'the counting rhyme, painted on the shelter wall'`):
  ```
  one, two — you're in the pipe where the slide comes down.
  three, four — you're behind the shed at the edge of the ground.
  five, six — you're in the dark behind the bench where the big ones sat.
  seven, eight — I've counted slow. nine — I've counted slower than that.
  ten. coming, ready or not.

  you always hid in the same three places, in the same order,
  and I always pretended not to know.

  — M.
  ```

**debugSolve.**

Yaw convention: forward is `(−sin yaw, 0, −cos yaw)`; yaw 0 faces −Z, π
faces +Z, π/2 faces −X, −π/2 faces +X. Each yaw below keeps every station
the presence will hop through outside the 55° cone from that spot (checked
against the coordinates above; if a station moves, re-check).

```
interact rhymeSign → wait 0.3 → closeModal
teleport(10.5, −6, π)          // inside the pipe, facing +Z (the pipe wall). S1, S2 lie to −X/−Z, S3 to +X: all ≥ 90° off → unseen
wait 2.6                       // hops S1→S2→S3 (0.6 s each) → knocks
teleport(13.2, −12, 0)         // behind the shed, facing −Z (the fence). The hop to R1 happens now (player left H_pipe); then S4, S5 (+Z, behind), S6 (−X): all > 55° off
wait 3.2                       // R1 hop + S4→S5→S6 → knocks
teleport(−11, 8.1, π)          // behind the shelter, facing +Z (the school wall). R2 hop; S7, S8 (−Z, behind), S9 (+X) → unseen
wait 3.2                       // R2 hop + S7→S8→S9 → knocks
teleport(−9.6, 5.5, 0)         // out of the gap, facing −Z. R3 (−8.2, 5.4) is +X → unseen → hop to R3 → FIN
wait 4.5 (hold) + 12.5 (walk) + 3 (gate, walk-through, hide)   // ≈ 20 s
teleport(0, −16) → wait 0.6
```
(≈ 32 s.) The level must arm the next hiding target from `onArrive` of
the rest station, so the rest hop and the next approach chain without the
player doing anything else. Do not add a `debugSolve`-only path through
the puzzle; the solve must run the same handlers a player would.

**Fairness.** The rhyme lists the places and their order and M.'s line
underneath says so plainly; the difficulty is in doing it — finding the
gap behind the shelter, going into a pipe in the dark, staying hidden while
footsteps come, coming out to find it closer. Decoy places answer with a
nudge. Nothing is timed against the player.

### 5.5 XV — Under the House

```js
static meta = {
  id: 15, numeral: 'XV', title: 'Under the House', mood: 'under', grade: /* §5 */,
  intro: 'Under the house, where you never went, the house is still going on.',
  outro:
    'She was never behind you.\n' +
    'She was ahead the whole time,\n' +
    'leaving the doors open, going on to bed.',
};
```

**Layout.** Origin at the cellar's centre. Ceiling **2.3 m** everywhere
(joists: thin boxes every 0.5 m along x, `wood '#4a3a2c'`). Concrete walls
`'#6b665e'`, floor `'#4f4b45'`, fog `#08080a`, near 1.5, far 14.
`HemisphereLight(0x453f3a, 0x0a0a0c, 0.3)`.

- **Main cellar** 12 (x) × 8 (z): x −6..6, z −4..4.
  - Steps up along the +Z wall at x +4: seven concrete steps rising to a shut door at y 1.6 (blocker at the top; the door: `'Shut from that side. It always was.'`).
  - **Boiler** at (−4, 0, −2.5): cylinder r 0.7 h 1.9 (`0x5a5651`, metalness 0.5), a pilot flame (a small emissive orange sphere + `PointLight(0xff9a4a, 1.6, 4)`); `loopAt('boiler', pos)`. Interact → `'It ticks like something counting.'`.
  - Shelves of jars along the −X wall (`makeShelf` ×3, jars = small cylinders `MeshStandardMaterial({ color: 0x8a7a55, transparent: true, opacity: 0.7, roughness: 0.2 })`).
  - Washing machine at (2, 0, −3.5) (a box with a round dark glass door).
  - Coal chute: a slope in the +X wall at z +2 (a rotated plane), a heap of dark spheres below.
  - **Fuse box** on the +X wall at (5.9, 1.45, −1): a grey box 0.5 × 0.7 × 0.12; five toggle switches (small boxes on pivots, `interact` each), **no labels** (blank plates); a red pilot lamp; M.'s note pinned beside it (a `makeNoteProp` on a nail, at (5.88, 1.1, −0.6), rotated to the wall).
    Physical switch order left → right: `[porch (dead), sitting, kitchen, yours, hall]`.
  - The one light in the main cellar: a bare bulb `makeBulbLight({ intensity: 3.5, distance: 9, y: 2.2 })` at (0, 0, 0), casting shadow.
  - **Corridor door** on the −Z wall at (−2, 0, −4): `makeDoor({ color: '#4c4038' })`, locked until Act 1 is done; a light strip under it (`emissive plane 0.9 × 0.02` at floor level, off) that comes on when unlocked.
- **Corridor** (Act 2): from z −4 to z −16 at x −2, width 1.4, height 2.2, an identical open doorframe (jambs + lintel, no panel) at z −4.6 (near) and z −15.4 (far). Chalk plane on the +X wall at z −10, y 1.2 (same drawing function as XII: tally + `wait for me`, plus `please` after a retreat). One caged bulb at z −7 and one at z −13 (dim, 2.0). **Loop:** `tick`: if `player.z < −15.6 && loopActive` → `teleport(x, z + 11.4)` (lands at z −4.2, just inside the near frame), `loops++`, redraw chalk.
- **Under-room** (Act 3): z −16..−22, x −5..1: a table at (−2, 0, −19) (`makeTable`), the **box** on it (cardboard: `'#a3896a'`, 0.5 × 0.35 × 0.4, lid flaps open; a label plane with `textTexture` of a name written and crossed out twice — draw three overlapping scribbles); the **last door** at (−2, 0, −22) (`makeDoor({ color: '#5a4636' })`, locked); one bulb at (−2, 0, −18), dim (2.5).
- **Last room** (Act 4): z −22..−26, x −4..0: a lamp (bulb, `0xffdcb0`, 3.5) at (−2, 2.1, −24); a wooden **chair** at (−1.6, 0, −24.5) facing −Z; the **figure** standing at (−2.5, 0, −24.6) facing −Z (away from the player), visible; the far **doorway** at (−2, 0, −26): an open frame with an emissive plane `0xfff1d6` behind it (intensity 0.4 at first) and a `PointLight(0xfff1d6, 0, 8)` (off until the end). Threshold `z < −27` (a 2 m stub beyond the frame, blocker at z −28.5).
- Spawn (4, 0, 2.6) at the foot of the steps, yaw π/2 (forward `(−sin yaw, 0, −cos yaw)` → (−1, 0, 0): facing −X into the cellar).
- Bounds: the whole complex.

**Sounds.**

- Ambience `under`; boiler; drips.
- **Overhead sounds** (Act 1), one per switch, from a point 3.4 m up (above the ceiling — they play through it):
  - kitchen → `loopAt('tap', (−4.5, 3.4, −2.5))`
  - sitting room → `loopAt('radio', (4.5, 3.4, −0.5))`
  - hall → a slippers shuffle: `playSoundAt('stepOther', (0.5, 3.4, 3.5), { soft: true })` every 0.9 s (a soft loop implemented with `after` re-arming; keep the ids `after` returns and `clearTimeout` them when the sounds stop)
  - your room → `playSoundAt('musicbox', (−1, 3.4, −3.6), { notes: tune('EGAGEGE'), step: 0.36, slow: 0.05 })` re-armed every 6 s
  - porch → a dead `click` (`'switch'` at low gain: play `'locked'`) and nothing else.
- Footsteps upstairs (flavour, Act 1): every ~40 s, four `stepOther` overhead moving from (−3, 3.4, 2) toward (4, 3.4, 3) — someone crossing the hall above; `cue('footsteps, upstairs', pos)` first time.

**State machine.**

```
A1  objective: 'the fuse box has lost its labels'
    note by the box → giveNote EVENING (below) (V's text, verbatim)
    switch k → 'switch'; if k is porch: 'locked' + subtitle 'Dead. It was dead upstairs, too.' (4 s); ignore
        if k is already on: 'switch' only, no effect
        else start its overhead sound (and keep earlier correct ones going); subtitle describing the SOUND, not the room:
            kitchen 'A tap, running.'  hall 'Slippers on a mat, back and forth.'  sitting 'A wireless, tuning between stations.'  yours 'A music box, winding down.'
        sequence check: if the flipped list is a prefix of [kitchen, hall, sitting, yours] → continue
            else: 'wrong'; stop all overhead sounds; all switches snap back; subtitle 'That was not how the evening went.' (5 s)
        all four in order → the music box plays the whole tune once more, louder; the strip under the corridor door lights; 'unlock'; door.setOpen; objective 'the door under the door'
        wrongCount ≥ 3 → subtitle 'Supper. Then slippers. Then the wireless. Then yours. Listen for them.' (7 s)
A2  corridor. loopActive = true. still (speed < 0.05) for 6 s anywhere in the corridor → approach:
        6 'stepOther' from BEHIND over 4 s — positions from (−2, footY, playerZ + 5) to (−2, footY, playerZ + 0.6); dread → 1; 'breath' at the player's right ear (0.35 m to the right at eye height); hush(3); flinch()
        then 3 more steps going on AHEAD (playerZ − 1, − 2.5, − 4) over 2 s: it passes
        then loopActive = false; subtitle 'It goes past. It was only ever going past.' (5 s); the far frame now leads on
        move before it arrives → retreat (3 steps back), pleaded++, chalk gains 'please'
        no still after 2 loops → subtitle 'You know this one. Stop.' (5 s)
A3  the box. interact 'look inside' → subtitle 'Empty. It has been kept empty a long time.' (5 s); arms:
        whenUnseen(box, once) → the PHOTO appears in it (a small framed canvas using `blurredPhotoTexture({ figures: 2 })` from textures.js, §4.8); interact → learnClue { id: 'l15-photo', title: 'a photograph', body: 'two figures, faces gone soft. one of them is you.' }; then arms:
        whenUnseen(box, once) → the RIBBON appears; interact → giveItem { id: 'ribbon', name: 'a ribbon, blue once' }; subtitle 'Hers. You wind it once around your finger, and this time you keep it.' (6 s); arms:
        whenUnseen(box, once) → the KEY appears (makeKeyProp); interact → giveItem { id: 'warm-key', name: 'a brass key, warm again' }; subtitle 'Warm. Someone has just put it down.' (5 s)
            → after 1.5 s: playSoundAt('knock', lastDoorPos, { count: 3 }); cue('three knocks', pos); objective 'come and find me'
    last door: with warm-key → 'unlock', open, removeColliderOf; without → 'locked' + subtitle 'Locked. It wants the key it always wanted.' (5 s)
A4  the last room. entering (z < −22.4): hush(6); dread 0. The figure stands facing away and has no interact prompt.
    An invisible blocker `[−4, 0, −26]..[0, 2.4, −23.4]` keeps the player at least 2 m from the figure until the note is read; the chair's seat is inside interact reach (3 m) from z −23.3.
    chair (prompt 'the chair', note on the seat) → giveNote LAST (below); onClose:
        lamp 'clunk' → intensity 0; ui.flash('#000', 400); figure.visible = false; remove the blocker; the doorway light ramps 0 → 7 over 2 s and the emissive plane to 1.4;
        after 0.8 s: playSoundAt('hummed', doorwayPos, { notes: tune('EGAGEGE') }); cue nothing; subtitle 'Goodnight.' (4 s) — inner voice
        objective ''
END threshold z < −27 → complete()
```

**Texts.**

- EVENING (`id 'l15-evening'`, title `'the note by the pilot light — pinned again'`), body identical to V's note:
  ```
  supper before slippers.
  slippers before the wireless.
  and yours always last,
  so the dark never caught you.

  — M.
  ```
- LAST (`id 'l15-last'`, title `'the last note'`):
  ```
  you can stop running now.
  I only ever wanted to say goodnight.

  — M.
  ```

**debugSolve.**

```
interact fuseNote → wait 0.3 → closeModal
interact sw[kitchen] → wait 0.2; sw[hall] → 0.2; sw[sitting] → 0.2; sw[yours] → wait 0.8
teleport(−2, −8, yaw 0)  → wait 6.5 (still) → wait 4.5 (approach)
teleport(−2, −17.5, yaw 0)             // facing the table
interact box → wait 0.3
teleport(−2, −17.5, yaw π) → wait 0.7  // face away → photo appears
teleport(−2, −17.5, yaw 0) → interact photo → wait 0.3
teleport(−2, −17.5, yaw π) → wait 0.7 → teleport(back) → interact ribbon → wait 0.3
teleport(−2, −17.5, yaw π) → wait 0.7 → teleport(back) → interact key → wait 1.8
interact lastDoor → wait 0.5
teleport(−2, −23.1, yaw 0) → interact chair → wait 0.3 → closeModal → wait 1.2
teleport(−2, −27.5) → wait 0.6
```
(≈ 22 s.)

**Fairness.** The note gives the order; each switch says what it wakes; a
wrong prefix resets with V's own line; three wrongs spell it out. The
corridor's chalk repeats XII's answer. The box explains itself by
repetition. The key knocks three times.

---

## 6. Verification and acceptance

Per task, the plan gives exact commands. Globally:

1. `npx vite build` passes with no new warnings beyond the existing chunk
   size note.
2. `node tools/screenshot.mjs N --port 51NN` exits 0 for N = 11..15 and the
   four shots per room are composed, lit, textured, and atmospheric (no
   floating props, no black voids where a wall should be, no untextured
   surfaces).
3. `node tools/playtest.mjs N --port 52NN` prints `SOLVED` for N = 11..15
   inside 45 s each.
4. `npm run playtest` prints `15/15 levels solvable` with zero browser
   errors — the phase gate before the branch is called done. Rooms I–X
   must still solve after the engine changes (regression).
5. Manual, with headphones (the owner or an agent with a browser): each
   room once through; the knocks in XI localise; the footsteps in XII sit
   below you; the corridor lights in XIII die toward you; the figure in XIV
   never moves while watched; XV's overhead sounds sit above you. Captions
   toggle adds direction words.
6. Existing saves: a save with `completed: [1..10], unlocked: 10` shows XI
   unlocked after `migrate`; the menu subtitle reads "…and the five
   beneath".

---

## 7. Decisions log

- Rooms go after X (false awakening), not before it and not as a separate
  campaign. — owner, 2026-08-16.
- Scare intensity Shadow. — owner.
- The figure is M., implied, never stated. — owner.
- Menu subtitle reveals the five only after X is complete. — proposed,
  accepted with the design.
- Spec + plan are handed to other build agents; rooms may be built in
  parallel after the engine tasks land. — owner.
