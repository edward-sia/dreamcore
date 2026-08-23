# HIRAETH — rooms XVI–XX, "the five above" — design spec

> **Spoilers.** This file specifies every puzzle, hour, text and cue in the
> five new rooms. Players should close it now.

Status: approved design, 2026-08-23. Decisions taken with the owner: build
all five rooms as described here; the arc is **"the five above"** (§0); the
someone small upstairs is **never identified** (§2.3); the game ends on
**the light** (§5.5, §2.2); the owner hands this spec and its
implementation plan to build agents.

Companion documents: [`../../DESIGN.md`](../../DESIGN.md) (rooms I–X
bible, canon), [`2026-08-16-rooms-xi-xv-design.md`](2026-08-16-rooms-xi-xv-design.md)
(rooms XI–XV; the scare contract this spec inherits, §1.2 there; the engine
APIs it builds on, §4 there), [`../../LEVEL_API.md`](../../LEVEL_API.md)
(authoring contract — this spec extends it in §4). Read
`src/levels/Level01.js` (canonical room), `src/levels/Level11.js` (the
bedroom XX rebuilds) and `src/levels/Level15.js` (the latest multi-act room,
and the `_waitFor` pattern its `debugSolve()` uses) before building.

---

## 0. Summary

Rooms I–X end at the Shore. Rooms XI–XV are the false awakening: something
follows you down through five rooms, never touches you, and turns out to
have been M. all along, leaving the doors open ahead of you. The epilogue
is the true waking: morning, and it stays, and somewhere in a house that is
gone someone turns off the last light and goes to bed.

The five new rooms come years after that. **The house comes back, and it is
not waiting for you.** Someone small is asleep upstairs, every light is
off, and you are on the other side of every door — her side. You do what
she did: leave the lights, the notes, the key, the knocks. The arc climbs
the house along V's evening order — kitchen, hall, sitting room, the stairs,
the room — and ends with you leaving the last light on and going to bed.

Two things change about how the game plays:

1. **Every room exists at three hours, and you move between them.** Half
   past eight is her evening (she has always just left). 3:07 is the
   night, when the child's dream is forming; it is the only hour at which
   doors onward open, and the only hour at which what you put down stays.
   A quarter past seven is the morning, years later, the house being
   emptied into boxes. Each hour holds something the others need (§3.2).
2. **You leave the clues instead of finding them.** The fifth rung on the
   difficulty ladder, after notice / combine / remember / doubt, is
   **leave**: the room gives you the lock and you must produce the key —
   put the pan back, label the fuses, hide the key where the flowers used
   to be, tune the wireless, file the cards, set the bedroom exactly as she
   left it — and the room tests your work by letting the child's dream try
   it (XVII's rehearsal), or by the child itself (XVIII, XX).

The contract from rooms XI–XV holds unchanged (§1.2). Two engine additions
make the new rooms possible — an `Hours` helper that crossfades a room
between its three states, and a small lit child figure with a few helpers
(§4). Each room's full design — layout with coordinates, what differs per
hour, puzzle state machine, texts, sounds, `debugSolve()` — is in §5.

---

## 1. Goals, non-goals, the contract

### 1.1 Goals

- Five rooms, ids 16–20, numerals XVI–XX, each about N minutes for room N,
  rising in difficulty on top of XV.
- One new mechanic that is the arc's signature (the hours), one new rung on
  the ladder (leave), and one room-specific trick per room (§3.1).
- The story closes: the player understands M. by doing what she did, and
  the game's last text is the first warm one.
- Everything stays procedural, on the existing stack, verifiable headless.
- The leaderboard accepts rooms 11–20 (it currently rejects anything above
  10 — §4.6).

### 1.2 The contract ("Shadow", continued — and the other side)

Rules 1–10 of the XI–XV spec §1.2 apply unchanged: no game-over, nothing
chases, no jump-scares, the figure never lit and never closer than about
two metres, silence as the strongest cue, every scare followed by
something that lets go, every hearing-dependent step with a sighted
fallback and a `cue()`, puzzles solvable from inside the room. Added for
this arc:

11. **The child is never closer than about two metres to you, and you are
    never closer than that to it.** Rooms enforce it with blockers and by
    having the child keep its distance; the child never touches the
    player and the player cannot reach it.
12. **The child is lit, small, and has no face.** It is the opposite of the
    figure: warm grey, `castShadow` on, a torch in XVIII. It never speaks.
    It hums, gasps, breathes, turns over.
13. **You are shown as the figure exactly once** — in the glass, in XX.
    Nowhere else is the player's body shown or described.
14. **Being seen by the child costs progress, never a room.** In XVIII it
    spins the dial off again; in XX it costs about half a minute. Neither
    restarts anything.
15. **The morning is sad, never frightening.** White light, boxes, birds, a
    van idling. Nothing moves in the morning except dust.
16. **She is never seen at the evening hour.** Warmth, sound, and things
    just set down are all she is.

### 1.3 Non-goals

- No new UI. The hours, the child, the rehearsal are all made of existing
  pieces plus the `#flash` blink.
- No render-target mirror. XX's "reflection" is a second figure behind a
  half-transparent dark pane (§5.5).
- No speech. No text entry. Notes are placed, never written by the player.
- No changes to rooms I–XV beyond moving the true-waking text into XVI's
  prologue (§2.1).

---

## 2. Narrative frame

### 2.1 Flow

```
… XIV → XV → XV outro (unchanged)
      → XVI prologue interlude (the true waking — the old EPILOGUE text — then "Years.")
      → XVI title card → XVI … XX
      → XX outro → EPILOGUE (new text, §2.2) → ending card → menu
```

`main.js` plays `EPILOGUE` after whichever level is last, so it moves to
after XX by itself. The old `EPILOGUE` text becomes the first half of XVI's
`meta.prologue` (shown once, tracked in `seenPrologues` as before), exactly
as the false-wake text became XI's prologue.

### 2.2 Texts

**XVI `meta.prologue`**:

```
You open your eyes.

The ceiling of your own room. Morning.
This time it stays.

Somewhere, in a house that is gone, someone turns off the last light —
the one that was left on for you —
and goes to bed.

Years.

Then one night the house comes back, and it is not waiting for you.
Someone small is asleep upstairs, and every light is off,
and you know what that is like.
```

**`EPILOGUE`** (`src/levels/index.js`, replaces the current text):

```
You open your eyes.

Morning. It stays.
Across the landing, a door you locked and a light you left on,
and somebody small behind it, not yet awake,
who will not remember any of this.

You go down, and put the kettle on, and leave the light on.
```

**Ending card** (`main.js`):
`'H I R A E T H\n\na dream in twenty rooms\n\nthank you for leaving the light on'`.

**Menu subtitle** (`#menu-sub`): `a dream in ten rooms` until the save has
10 in `completed`; `a dream in ten rooms · and the five beneath` until it
has 15; then `a dream in ten rooms · the five beneath · the five above`.

`PROLOGUE` and every XI–XV text are unchanged.

### 2.3 Who the child is

Never stated. The prologue says "someone small". Rooms say "it" and
"something small". Its face is never drawn; it has your height at six, or
anyone's. The only answer the game gives is the glass in XX: what stands
in the mirror where you stand is the dark shape the child would be afraid
of — so you cover it, as she did. Readers may take the child for the one
you were, or for yours. Nothing contradicts either.

### 2.4 Who you are, at the evening hour

You are on her side of the evening. Her lists tell you what she did; you
do it. Her coat is warm because she has just hung it up. You never meet
her — the evening hour is the house with her just out of every room — and
nothing says you are her. By XX you have done everything she did, and the
glass shows you what that looked like from the bed.

---

## 3. The arc

| # | numeral | title | mood at 3:07 | minutes | the line of her list | what the room adds |
|---|---|---|---|---|---|---|
| 16 | XVI | The Kitchen | `night` | 16 | supper | the hours; test-and-label; "only the night counts" |
| 17 | XVII | The Hall | `night` | 17 | slippers | the rehearsal — the child's dream walks your setup |
| 18 | XVIII | The Sitting Room | `night` | 18 | the wireless | attention by sound — the child with the torch |
| 19 | XIX | The Stairs | `stairwell` | 19 | then up | the filing; following by ear, roles swapped |
| 20 | XX | The Room | `night` | 20 | and yours always last | everything, around a sleeper; the glass; the last light |

At the evening hour every room uses mood `evening`; at the morning hour
`morning` (§4.1). The "mood at 3:07" column is `meta.mood`, the mood the
room starts in.

### 3.1 Difficulty ladder, continued

- 16: discover the hours; read her list; two things to place and five to
  label; one rule to learn (the night counts). Two sources for the labels
  (test the switches, or read the morning).
- 17: three things to source from three hours and place in the right three
  spots of a corridor that has ten doors and two tables; a rehearsal that
  tells you *where* it failed, never what to do.
- 18: a number to read at one hour and enter at another, three clicks, each
  a sound that brings the child; four sounds you can throw; a torch beam
  to stay out of; a cheaper, sadder path.
- 19: eight cards to match to eight boxes by their facts; three things from
  three hours into a box; then the shaft, where you must light the stubs in
  the order the child will see them, keep two flights below, write the
  chalk, and approach only when it is still.
- 20: XI's whole starting state to reproduce from the evening's model (or
  the morning's slip), around a sleeper who stirs at noise; the glass; the
  clock stopped last; out, the lock, the knocks by ear, the light, bed.

Room N should take about N minutes for a first-time adult player. Wrong
attempts cost time and earn a nudge in her words.

### 3.2 Arc-3 canon (facts more than one room depends on)

Add these to DESIGN.md's Canon section.

- **The hours:** half past eight (her evening), **3:07** (the night), a
  quarter past seven (the morning). Clocks are pushed forward by hand and
  rest only at those three. Doors onward open at 3:07 only. What you put
  down at another hour does not stay. The morning's doorways are white.
- **XVI:** the fuse box, left to right: **porch · sitting room · kitchen ·
  your room · hall** (XV's order). The pan stays on the range. The little
  key on the table.
- **XVII:** the spare key where the flowers used to be; the note on the
  table by the door; her slippers on the mat at the stair foot. The hall
  at 3:07 is the corridor of I, doors 203–212.
- **XVIII:** the wireless is tuned to **247** metres. It plays the tune
  (E G A G E G E). The child carries a torch.
- **XIX:** eight boxes, eight cards (IX's facts). The box is crossed out
  **twice**. The stub lights go **−3, then −2, then −1** — one door closer
  each loop. The chalk says **wait for me**.
- **XX:** XI's starting state: the chair to the desk, the sheet over the
  mirror, the music box wound, the note in the drawer, the clock stopped at
  3:07, the door locked from the other side. The landing light is left on.
- **The child:** never named. It hums the tune. It is heard in XVI (turning
  over), rehearsed in XVII, seen with a torch in XVIII, followed in XIX,
  asleep in XX.
- **M.:** at the evening hour she has always just left. Her lists. Her coat
  is warm. Never seen.

---

## 4. Engine additions

Shared files may be edited for these tasks only. Room files (`Level16.js`
… `Level20.js`) must not touch shared files, so rooms can be built in
parallel once §4 is done. All new APIs must be no-ops when audio has not
started and must never throw; the headless harness runs with
`--mute-audio` and no gesture.

### 4.1 `src/core/AudioEngine.js`

#### 4.1.1 New moods

Add to `MOODS`:

```js
evening: { root: 46, chord: [1, 1.498, 1.782, 2.0], cutoff: 560, noise: 0.06, events: ['clock', 'creak', 'hum'] },
morning: { root: 58, chord: [1, 1.5, 2.0, 2.52],    cutoff: 900, noise: 0.18, events: ['birds', 'birds', 'creak'] },
```

New ambience event `birds` in `_ambEvent`: a chirp triplet — three
`_blip(out, 2600 + r·900, 3400 + r·600, 0.003, 0.06, 0.03, t + k·0.09)`
(`r` random per chirp, k = 0..2). The rest of `setAmbience` is unchanged.

#### 4.1.2 New one-shots (`_synth` cases)

| name | opts | recipe |
|---|---|---|
| `wind` | `clicks = 9, gap = 0.07` | for i in 0..clicks−1: `_blip(out, 1500, 900, 0.002, 0.03, 0.05, t + i·gap)`; then `_blip(out, 300, 180, 0.004, 0.12, 0.06, t + clicks·gap)`. A clock being wound: a ratchet, then the hands settle. |
| `smallStep` | `soft = false` | `_noiseBurst(out, 1400, 0.05, soft ? 0.025 : 0.045, 'bandpass')` + `_blip(out, 190, 120, 0.003, 0.07, soft ? 0.03 : 0.05)`. A child's foot: lighter and quicker than `step`. |
| `tick` | — | `_blip(out, 2400, 1700, 0.001, 0.02, 0.05)`. One clock tick; also a dial click. |
| `gasp` | — | noise → bandpass, freq ramps 600 → 1500 Hz over 0.3 s, Q 1.5; gain 0 → 0.06 over 0.12 s → 0 over 0.25 s. A small breath in. |
| `lock` | — | `_blip(out, 900, 500, 0.002, 0.05, 0.08)` then `_blip(out, 220, 160, 0.004, 0.14, 0.12, t + 0.12)`. A key turned in a door. |

Change one existing one-shot: `hummed` gains `opts.small` (default false).
When `small` is true the triangle oscillator runs at `freq` (not `freq/2`),
gain is `0.7·gain`, vibrato 6.5 Hz. A child humming. Every other existing
sound is unchanged.

#### 4.1.3 New loops (`loopAt` kinds)

| kind | recipe |
|---|---|
| `birds` | every 0.5–2.2 s (random, re-armed with `setTimeout` on the handle, cleared on stop): the `birds` chirp triplet above at gain 0.04. |
| `idle` | sawtooth 37 Hz → lowpass 180 Hz → gain 0.035 with LFO 3.8 Hz depth 0.4, plus noise → lowpass 300 Hz → gain 0.01. A van idling outside. |
| `fire` | noise → lowpass 700 Hz → gain 0.045 with LFO 0.6 Hz depth 0.3; every 0.15–0.9 s a crackle `_blip(out, 1900, 1200, 0.001, 0.012, 0.05)`. A hearth. |
| `simmer` | noise → bandpass 2300 Hz Q 0.8 → gain 0.02; every 0.2–0.7 s a bubble `_blip(out, 520 + r·400, 900, 0.002, 0.05, 0.03)`. A pan on the range. |

Handles have the same shape as before: `{ stop(fadeSeconds = 0.6), setPosition(pos), setGain(g) }`.

### 4.2 `src/core/LevelBase.js`

New methods. All thin and safe.

```js
setMood(key)                      // → this.game.audio.setAmbience(key); no-op if the key is unknown or unchanged
isSeenBy(obj, { angleDeg = 30, maxDist = 8, occluders = null, eye = null } = {})
footsteps(points, { stride = 0.55, every = 0.5, sound = 'smallStep', opts = {}, onStep = null, onDone = null } = {})
```

**`isSeenBy(obj, opts)`** answers "is the camera inside `obj`'s forward
cone right now?" — the mirror of `isSeen`. `obj`'s forward is its local +Z
(`obj.getWorldDirection`), which is the front of `makeFigure` /
`makeChild`. Origin of the cone: `obj`'s world position plus `eye` (a
`Vector3` offset in world units, e.g. `(0, 1.0, 0)` for a child's eyes;
default none). If the camera is farther than `maxDist` → false. If the
angle between the forward and the direction to the camera exceeds
`angleDeg` → false. If `occluders` is given: raycast from the origin toward
the camera; any occluder hit nearer than the camera → false. Otherwise
true. `angleDeg` is the half-angle, as in `isSeen`.

**`footsteps(points, opts)`** plays a walk: `points` is a polyline
(`[{x,y,z}, …]`, two or more). The walk has `floor(length / stride) + 1`
steps; step i is at the point `i · stride` metres along the polyline
(interpolated), played with `playSoundAt(sound, pos, opts)` at time
`i · every` seconds via `this.after(...)` (so `dispose()` clears it).
`onStep(i, pos)` fires with each step; `onDone()` after the last. Returns
a `cancel()` function that clears the remaining steps. Sighted fallback
is the room's job (a cue on the first step, a light where it stops).

### 4.3 `src/core/hours.js` (new)

```js
import { Hours } from '../core/hours.js';

const hours = new Hours(this, {
  order: ['night', 'morning', 'evening'],   // next() cycles in this order — the hands go forward round the dial
  initial: 'night',
  fade: 1.6,                                 // seconds of crossfade
  blink: 140,                                // ms of black at the midpoint
  onChange: (hour, prev) => {},              // after the swap
});
hours.bind('evening', { ...spec });         // may be called several times per hour; specs accumulate
hours.start();                              // apply `initial` at once, no fade — call at the end of build()
this.track(hours);                          // drives the fade
hours.set('morning'); hours.next(); hours.current; hours.changing; hours.is('night');
```

A **spec** (every field optional):

| field | meaning |
|---|---|
| `objects: Object3D[]` | visible only at this hour. Roots are toggled (`visible`), so whole groups swap. An object bound to several hours is visible at each. An object bound anywhere is hidden at the hours it is not bound to. Unbound objects are untouched. |
| `interact: Object3D[]` | interactables enabled only at this hour (`interaction.setEnabled`); usually the same list as `objects`, but a thing can be visible at every hour and touchable at one. |
| `lights: [{ light, intensity }]` | intensity at this hour. A light bound in any hour is driven to `0` at the hours it is not bound to; the fade lerps intensities. Unbound lights are untouched. |
| `colliders: Object3D[]` | solid only at this hour (`Box3` from the object's current world position, computed at `bind`). The helper splices these `Box3`s into / out of `level.solids` at the swap. |
| `blockers: [[min], [max]][]` | invisible solids only at this hour, same mechanics. |
| `fog: { color, near, far }` | lerped over the fade (`scene.fog` and `scene.background`). |
| `grade: partial` | `engine.setGrade` lerped over the fade between the previous hour's grade and this one's (missing fields use `BASE_GRADE`). |
| `mood: key` | `level.setMood(key)` at the swap. |
| `loops: [{ kind, position, opts }]` | started (`level.loopAt`) when the hour begins, stopped (`handle.stop(0.6)`) when it ends. |
| `onEnter(hour)`, `onLeave(hour)` | called at the swap, leave before enter. |

Semantics of `set(hour)`: ignored while `changing` or if `hour` is
current. Otherwise over `fade` seconds: lights, fog and grade lerp
(ease in-out); at `fade/2` the helper calls `ui.flash('#000', blink)`
and, under the blink, swaps objects, interactables, colliders, blockers,
loops, mood, fires `onLeave`/`onEnter`/`onChange`, and sets `current`. The
room plays the `wind` sound and moves its clock's hands itself when it
calls `next()` — the helper makes no sound. `start()` applies `initial`
instantly (no blink, no fade) and must be called once before `set`.

Why a blink: everything that cannot lerp (a pan that is on the range or in
the sink, a box that is there or not, a corridor that is eight metres or
thirty) swaps under 140 ms of black, and the lights finish arriving after
it. The room blinks and it is another hour. It is also the arc's visual
signature, so every room changes hour the same way.

### 4.4 `src/core/presence.js` — the child

```js
export function makeChild({ height = 1.12 } = {}) → THREE.Group
```

The same primitives as `makeFigure`, scaled to `height`, but lit: material
`MeshStandardMaterial({ color: 0x9a8c80, roughness: 0.9, metalness: 0 })`
(a warm grey — pyjamas), `castShadow` true, head radius `0.085·height/1.12`,
no face. `child.faceToward(p)` and `child.setHeight(h)` as on the figure.
Plus a torch: `child.torch` is a `SpotLight(0xffe7b8, 0, 11, 0.36, 0.55, 1.4)`
at `(0, 0.78·height, 0.12)` whose `.target` is a child of the group at
`(0, 0.6·height, 4)` (so the beam points along the group's +Z, its front);
a small lens sphere (`emissive 0xffe7b8`, intensity 0 until on) sits at the
light; `child.setTorch(on)` sets the light's intensity to `on ? 6 : 0` and
the lens's emissive intensity to `on ? 2.5 : 0`. `child.userData.isChild = true`.
The group's `update(dt)` does nothing (rooms animate it); it exists so
`level.track(child)` is harmless.

`makeFigure` and `Presence` are unchanged.

### 4.5 `src/core/props.js` — a clock face

```js
export function makeClockFace({ radius = 0.16, face = '#e8e2d3', hands = '#2a2622' } = {}) → THREE.Group
```

A disc (`CircleGeometry(radius, 32)`, `MeshStandardMaterial({ color: face, emissive: face, emissiveIntensity: 0.12 })`)
facing +Z with twelve tick boxes and two hand boxes (hour `0.55·radius` long,
minute `0.85·radius`), pivoted at the centre. `clock.setTime(h, m, animate = 1.6)`
turns the hands to `h:m` over `animate` seconds (shortest way round is
fine; the wind sound covers it); `clock.update(dt)` animates — register
with `level.track(clock)`. Rooms wrap it in a case (a wall clock, a mantel
clock, a long-case clock). Hours and hands: 3:07 → hour hand at
`(3 + 7/60)/12` of a turn, minute at `7/60`; 7:15 → `(7.25)/12`, `15/60`;
8:30 → `(8.5)/12`, `30/60`.

### 4.6 Flow, save, server, docs

- `src/levels/index.js`: `EPILOGUE` per §2.2; comment says twenty files.
- `src/main.js`: ending card text per §2.2; `#menu-sub` per §2.2.
- `src/levels/Level16.js`: `meta.prologue` per §2.2 (the old `EPILOGUE`
  text, then "Years." and the three new lines).
- `SaveSystem`: nothing — `migrate(LEVELS.length)` already unlocks XVI for
  a save that finished XV.
- **Leaderboard cap (bug):** `MAX_LEVEL` defaults to `10` in
  `server/server.mjs`, `worker/index.mjs` and `wrangler.jsonc`, and
  `sanitizeTimes()` returns `null` — the whole submission is rejected — if
  any room id exceeds it. Anyone who has finished XI cannot submit at all.
  Set the default to `20` in all three places and the README's env
  comment; add a check to `tools/leaderboard-test.mjs` that a submission
  with room `20` is accepted and one with room `21` is rejected.
- `docs/LEVEL_API.md`: `Hours` (§4.3), `makeChild`, `makeClockFace`,
  `isSeenBy`, `footsteps`, `setMood`, the new sounds / loops / moods, and a
  paragraph "Rooms XVI–XX: the other side" restating §1.2 rules 11–16.
- `docs/DESIGN.md`: arc table rows 16–20 (phase 8: XVI–XVII; phase 9:
  XVIII–XIX; phase 10: XX), §3.2 canon added to Canon, a "Rooms XVI–XX"
  section pointing at this spec.
- `README.md`: "a dream in ten rooms — and, once you've woken, five more —
  and five after"; the rooms paragraph gains one sentence on the hours;
  `MAX_LEVEL=20`.

---

## 5. The rooms

Conventions for every room:

- Coordinates in metres. Player spawns facing −Z unless stated. Yaw: forward
  is `(−sin yaw, 0, −cos yaw)`; yaw 0 faces −Z, π faces +Z, π/2 faces −X,
  −π/2 faces +X.
- Every room starts at **3:07** (`hours.initial = 'night'`, `meta.mood` as
  in the §3 table). The room's clock is the hours device: interact →
  `wind` sound, `clock.setTime(...)`, `hours.next()`; the first time, a
  subtitle says the hands moved. Order: 3:07 → 7:15 → 8:30 → 3:07.
- **Per-hour look** (bind these in every room unless the room says
  otherwise):
  - *night:* fog `#0a0a10` near 1.5 far 14; grade `{ vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 }`;
    `HemisphereLight(0x2a2e44, 0x07070a, 0.35)`; one cold source (moon
    through a window: `PointLight(0x6c7ea8, 1.2, 8)` by the window);
    mood `meta.mood`.
  - *evening:* fog `#1a140f` near 2 far 18; grade `{ vignette: 1.2, grain: 0.03, desat: 0.08, lift: 0.03, fringe: 0.0005 }`;
    warm bulbs (`0xffd2a0`); `HemisphereLight(0x5a4a3a, 0x1a1410, 0.45)`; mood `evening`.
  - *morning:* fog `#d8d5ce` near 1 far 9; grade `{ vignette: 0.9, grain: 0.045, desat: 0.35, lift: 0.09, fringe: 0.001 }`;
    `HemisphereLight(0xffffff, 0xcfcac0, 1.5)` + a `DirectionalLight(0xfff2dc, 1.4)`
    from the window side (the one shadow caster at this hour); window
    panes emissive white `1.6`; mood `morning`; `loopAt('birds')` at the
    window; boxes (`'#a3896a'`, 0.5 × 0.4 × 0.4, a label plane with
    `textTexture` in an upright hand: `'24px Georgia'`, `'#3a332c'` on
    `'#d9cfbd'`); dust sheets (`'#cfc8bb'`) over furniture that stays.
  Every HemisphereLight is bound per hour through `lights` (intensity 0 at
  the other hours) so the crossfade carries the colour of the hour.
- **Doors onward** open at 3:07 only. At the evening hour they answer
  `locked` + `'Not yet. She is still up.'`; at the morning hour the door
  stands open onto a white emissive plane behind an invisible blocker, and
  stepping to it says `'White. The house is gone from here on.'` (once per
  visit, 5 s). The door you came in by is shut: `'It shut behind you. They
  always do.'`
- **Placing at the wrong hour:** a thing that must be left for the night,
  put down at the evening, answers `'She'd only tidy it away. Leave it for
  the night.'` (no sound, nothing placed); at the morning `'There is
  nothing here to leave it on, not any more.'`
- "Cue" means `this.cue(text, pos)`. Cue every child sound that carries
  information (steps, a gasp, a hum, knocks) and every thrown sound; do not
  cue ambience.
- Notes are signed `— M.` as before. Wrong attempts play `wrong` unless the
  room says otherwise and give the quoted nudge.
- `debugSolve()` must finish inside 40 s of wall time and go through the
  same handlers a player uses. Waits below are chosen to keep that; use
  Level15's `_waitFor(test, cap)` pattern wherever a state is awaited.
- Threshold checks use `this.tick` and `player.position`, as in Level01.

### 5.1 XVI — The Kitchen

```js
static meta = {
  id: 16, numeral: 'XVI', title: 'The Kitchen', mood: 'night',
  prologue: /* §2.2 */,
  grade: { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 },
  intro: 'The kitchen, at the hour every clock in the house stopped.',
  outro:
    'You put the pan back and the key down and wrote the fuses up,\n' +
    'and the door to the hall gave, the way it gave for her,\n' +
    'onto a hall longer than the house.',
};
```

**Layout.** Interior 6.0 (x) × 4.6 (z) × 2.6 (h). Origin at the room's
centre. −Z is the hall wall (north); +X the back-door wall (east); −X the
window wall (west); +Z the range wall (south).

- Walls plaster (`base '#b9ad96'`), a tiled splashback strip (`tile`,
  `'#c9c4b4'`) 0.6 high behind the sink and range, floor `checker`
  (`a '#b8b09c', b '#6f6a60', cell 128, repeat [6, 5]`), ceiling `ceiling`.
- **Hall door** (exit): `makeDoor({ color: '#5a4636' })` in the north wall at
  x −1.5; beyond it a 2.2 m stub of hall (x −2.3..−0.7, z −2.3..−4.5) with
  I's wallpaper (`'#b7a48e'`, stripe `'#a8927a'`) and carpet, a blocker at
  z −4.5. Threshold `z < −3.2`. A light strip (emissive plane 0.9 × 0.02
  `0xffd9a8`, off) lies at the door's foot on the kitchen side.
- **Back door** in the east wall at z +1.2 (never opens; `'The garden is
  another night.'`), a key on a hook beside it (`makeKeyProp`, `'The back
  door key. Not tonight.'`), the **fuse box** on the east wall at
  (2.94, 1.5, −1.4) facing −X: grey box 0.5 × 0.7 × 0.12; five switches
  (boxes 0.05 × 0.12 × 0.04 on pivots at x 2.87, y 1.5, z −1.58 + 0.09·i,
  i = 0..4 — i = 0 is the leftmost as you face the box); below each a
  **plate** (plane 0.08 × 0.035 at y 1.38) that shows a label texture
  (`textTexture`, `'italic 28px Georgia'`, `'#3a332c'` on `'#cfc6b3'`) or
  blank. Physical order left → right: **porch · sitting room · kitchen ·
  your room · hall** (XV's canon).
- **Window** over the sink in the west wall at z −0.6 (1.4 × 1.0, y 1.3);
  a backdrop plane 3 m beyond (`x −6`): a dusk gradient at the evening
  (`skyGradientTexture({ top: '#2e3550', mid: '#6f5a6a', bottom: '#b98a6e' })`),
  black with a dozen firefly points at night, white at the morning. The
  **sink** under it (a box with a basin cut by two boxes; a tap cylinder)
  at (−2.6, 0, −0.6). The **range** against the south wall at x −1.6 (a box
  1.0 × 0.9 × 0.6, `0x3a3a3c` metal, four rings); the **fridge** against
  the south wall at x +1.8 (box 0.7 × 1.7 × 0.7, `'#d9d4c8'`); the
  **dresser** against the north wall at x +1.5 (a `makeShelf` 1.2 wide
  with plates and a cup); the **serving hatch** in the north wall at
  x +0.3, y 1.2 (0.7 × 0.5, a shutter box 2 mm proud, an emissive plane
  behind its edges); the **table** at centre (`makeTable({ w: 1.6, d: 0.9 })`
  at (0, 0, 0.2)) with four `makeChair`s; the **calendar** on the east
  wall at z +0.2 (a `makeSign` 0.3 × 0.4: a month grid, one Sunday ringed
  in red, `sunflowers` under it in her italic).
- **The clock:** `makeClockFace({ radius: 0.16 })` in a dark case on the
  north wall above the hall door at (−1.5, 2.32, −2.27), facing +Z.
  Interact (distance 3.4): `wind`, `setTime`, `hours.next()`. First time:
  subtitle `'The hands move. They never did, before.'` (5 s).
- Spawn (2.3, 0, 1.2), yaw π/2 (facing −X into the room; the clock is
  ahead and to the right, over the hall door). Bounds x −2.9..2.9, z −4.4..2.2.

**Hours.**

| | night (3:07) | evening (8:30) | morning (7:15) |
|---|---|---|---|
| light | per-hour look; the fridge's hum `loopAt('hum')` | bulb over the table (`makeBulbLight({ color: 0xffd2a0, intensity: 4.5, distance: 9, y: 2.35 })`, shadow caster); range glow `PointLight(0xff9a4a, 1.2, 3)` | per-hour look; `DirectionalLight` from the window (−X) |
| the pan | in the sink (a box 0.3 × 0.12 × 0.3, `0x2e2e30`) — interact `'the pan, in the sink'` → `giveItem { id: 'pan', name: 'the supper pan, cold' }` | on the range, steaming (`makeDust({ count: 40, box: [0.3, 0.8, 0.3], center: [−1.6, 1.3, 2.0] })`), `loopAt('simmer', rangePos)` | gone; a paler rectangle on the splashback |
| the range | cold: interact without the pan → `'Cold. She washed up. She always washed up.'`; with the pan → places it (a pan mesh appears on the range; `removeItem('pan')`; `'You put it back. Supper was real.'`) | `'Supper. Still warm. She has just turned it down.'` | gone |
| the table | bare. Interact with `little-key` → places the key (a `makeKeyProp` at (−0.3, 0.77, 0.15)); `'You put it down where small hands can find it. It will be warm for a while.'`; `removeItem` | her **list** (`makeNoteProp` at (0.3, 0.77, 0.1)) → `giveNote` LIST; placing the key here → the wrong-hour line | under a dust sheet; placing → the morning line |
| the chair (south side) | pushed in. After the key is placed: `whenUnseen(chair)` → it slides out 0.3 m (`door` soft) and the next `whenSeen` says `'The chair is out again. Somebody sat down to supper.'` | pulled out 0.3 m; `'Warm. She has just got up.'` | under the sheet |
| the cup on the dresser | empty: `'A cup with no handle. Empty.'` | holds the **little key**: `'A cup with no handle. In it, the little key for the door at the top of the stairs. She keeps it here. You take it.'` → `giveItem { id: 'little-key', name: 'the little key' }` | gone |
| fuse box | live: switches flip (below); plates editable (below) | switches all up, plates blank; a switch → `switch` + `'She'd only put it back. Leave them for the night.'` | three plates read, in her italic: `porch · sitting room · — · your room · —` (the 3rd and 5th fell off); interact a plate → `learnClue { id: 'l16-plates', title: 'the fuse box, in the morning', body: 'in her hand, left to right: porch · sitting room · (fallen) · your room · (fallen).' }` |
| boxes | — | — | three by the table: `KITCHEN — misc` (interact → `learnClue { id: 'l16-fallen', title: 'two plates from the fuse box', body: 'kitchen. hall. unscrewed and put in a box; which went where, nobody wrote down.' }`), `KITCHEN — keep`, `KITCHEN — van` (flavour lines: `'Plates. The good ones.'`, `'Tea towels. The calendar, folded, with its Sunday still ringed.'`) |
| the fridge | hums; shut | hums; a drawing on its door | open, empty; the **drawing** still on the door: a crayon sunflower (canvas: yellow petals, brown centre, green stalk, 96 × 128) → `'A sunflower, in crayon. Someone drew it so that someone would know.'` |
| the tap | runs by itself for 10 s the first time you return to the night after the evening (`loopAt('tap')`, then stop); cue `'the tap'` | runs for the first 12 s of the first evening, then stops (she has just turned it off) | dry |
| sounds | the child overhead every ~45 s: `footsteps` of three soft `smallStep`s from (1, 3.4, −1) to (0.5, 3.4, 1.5) then the mood's `creak`; cue (first) `'something small, turning over, upstairs'` | 5 s after the tap stops: her humming beyond the hall door, `playSoundAt('hummed', (−1.5, 1.5, −2.8), { notes: tune('EGAG') })`, cue `'humming, beyond the door'`; then three soft `stepOther` going away down the hall; the wireless faint through the hatch `loopAt('radio', (0.3, 1.2, −3.2))` at gain 0.5 | `loopAt('birds', windowPos)`, `loopAt('idle', (8, 0.5, 1))` (the van) |
| hall door | the gate (below) | `'Not yet. She is still up.'` | open onto white; blocker |
| hatch | shutter down; glows at the edges when the sitting-room switch is on | light at the edges; the wireless | boarded |

**The switches at night.** Interact switch `i` → `switch`; it toggles
(rotation.z ±0.35). Effects (on; off reverses them), each with a sighted
sign and a sound, first time cued and recorded in the journal
(`learnClue { id: 'l16-sw-'+i, title: 'the <ordinal> switch', body: <what it lights> }`):

- porch: `locked` (a dead click) + `'Dead. It always was.'` (first time).
- sitting room: the hatch's edge glow on (`emissiveIntensity 1.2`) +
  `loopAt('radio', hatchPos)` at gain 0.4; subtitle `'Light at the edges of
  the hatch, and the wireless, faint.'`; cue `'the wireless, through the hatch'`.
- kitchen: the bulb over the table comes on (4.5) — the night kitchen can
  be lit; subtitle `'The kitchen light. This one is the kitchen.'`
- your room: `playSoundAt('musicbox', (1, 3.4, 0.5), { notes: tune('EGAGEGE'), step: 0.36, slow: 0.05 })`
  re-armed every 6 s (`after`; keep the id and clear it when off); a faint
  warm glow at a ceiling crack (emissive plane 0.4 × 0.02 at (1, 2.59, 0.5));
  subtitle `'A music box, upstairs. Winding down.'`; cue `'a music box, upstairs'`.
- hall: the light strip under the hall door on (1.4) + `PointLight(0xffd9a8, 1.5, 3)`
  beyond the door; subtitle `'A line of light under the hall door.'`

**The plates at night.** Interact plate `i` → `paper`; its label cycles:
blank → `kitchen` → `hall` → `sitting room` → `your room` → `porch` → blank.
Labels are free text on the plate; nothing checks them until the door is
tried. Correct: `[porch, sitting room, kitchen, your room, hall]`.

**State machine.**

```
S0  night. objective 'the clock stopped at 3:07. every clock did.'
    clock → morning (first wind): subtitle 'The hands move. They never did, before.'; objective 'the house, at another hour'
    LIST read (evening) → objective 'before bed — her list'
S1  the three conditions, checked only when the hall door is tried at night:
      A  pan on the range        (placed at night; the evening's pan does not count — it is hers)
      B  little key on the table (placed at night)
      C  plates read [porch, sitting room, kitchen, your room, hall]
    hall door (night) → if !A: 'locked' + 'Supper was real. Put it back where it can be seen.'
                        elif !B: 'locked' + 'The little key. On the table, where it can be found.'
                        elif !C: 'locked' + (all blank ? 'The fuses. Write them up.' : 'The fuses. One of them is lying.')
                        wrongCount++ each time; wrongCount ≥ 3 → append, 4 s later:
                          'Her list is on the table, at half past eight.' (if LIST unread) else
                          'Porch. The wireless. Here. The small one's. The hall. Test them.'
                        else → S2
S2  'unlock'; door.setOpen(true, −1); removeColliderOf(panel); 'door'; playSoundAt('reverse', (−1.5, 1.3, −3.5), { dur: 1.4 }); dread 0.2;
    the light strip off; subtitle 'It opens onto the hall, and the hall is longer than the house.' (6 s); objective 'slippers'
    clock disabled ('The clock has done what it was for.' if tried)
END threshold z < −3.2 → complete()
```

**Texts.**

- LIST (`id 'l16-list'`, title `'her list, on the kitchen table'`):
  ```
  before bed —

  the pan stays on. supper was real,
  and there should be something to show for it.
  the little key on the table, where small hands can find it.
  write the fuses up. I always forget which is which,
  and the dark is no time to learn.
  then slippers. then the wireless. then up, and yours last.

  — M.
  ```
- Calendar: `'Sunday, ringed. sunflowers, in her hand. Every day after it is crossed off.'` (morning) / `'Sunday, ringed. sunflowers.'` (evening, night).

**debugSolve.**

```
interact clock → wait 1.9            // → morning
interact clock → wait 1.9            // → evening
interact list → wait 0.3 → closeModal
interact cup → wait 0.3              // the little key
interact clock → wait 1.9            // → night
interact pan → 0.3; interact range → 0.3
interact table → 0.3
plates: interact plate 0 ×5, plate 1 ×3, plate 2 ×1, plate 3 ×4, plate 4 ×2 (0.05 s apart)
interact hallDoor → wait 0.8
teleport(−1.5, −3.6) → wait 0.6
```
(≈ 11 s.)

**Fairness.** The clock is the only thing that moves when touched; the
first wind shows a white kitchen full of boxes — the player knows at once
that hours are the mechanic. Her list names the three things. The little
key is where her list implies (a cup; the evening is hers). Labels can be
got two ways. The wrong-hour line teaches the rule the first time it is
broken. The door names what is missing, one thing at a time.

### 5.2 XVII — The Hall

```js
static meta = {
  id: 17, numeral: 'XVII', title: 'The Hall', mood: 'night', grade: /* §5 night */,
  intro: 'The hall. At night it is the corridor of the building you grew up in, and it is longer than the house.',
  outro:
    'You put the key where the flowers used to be,\n' +
    'and the note on the table, and her slippers on the mat,\n' +
    'and something small came down, and found them, and went on ahead.',
};
```

**Two halls in one place.** The house's hall (evening, morning) and the
dream's hall (night) are both built, overlapping, and the `Hours` helper
swaps their `objects` and `colliders` under the blink. The kitchen door is
where both begin.

**The house's hall** (evening, morning): x −1.5..1.5, z −5.4..+5.4,
height 2.7. Wallpaper (`'#b7a48e'`, stripe `'#a8927a'`), carpet runner,
plaster ceiling.

- **Kitchen door** in the south wall (z +5.4, x 0): shut; `'It shut behind
  you. They always do.'` (at every hour; at night it is the dream-hall's
  back wall).
- **Front door** in the north wall (z −5.4, x 0): `makeDoor({ color: '#4f3d2e' })`.
  Evening: opens onto the **porch** — a 1.6 m stub (z −5.4..−7.0) with a
  low gate at −7.0 (blocker, `'The street is another night.'`) and III's
  street beyond it in fog: asphalt, a lamp post at (3, 0, −10) whose light
  refuses (intensity 0 with a 5 % duty flicker to 1.0), the mailbox at
  (−1.2, 0, −6.8) (`'Empty. Nothing has been delivered yet.'`). The porch
  light switch inside by the door (a small box at (0.7, 1.3, −5.3)):
  `switch` + `locked` + `'Dead. It always was. She said it was the bulb.
  It was never the bulb.'` (6 s, first time; then `'Dead.'`). Morning:
  open onto white; `loopAt('idle', (4, 0.5, −9))`. Night: absent.
- **Sitting-room door** in the west wall at z −3.0: evening `'Not yet. She
  is still up.'`; morning white. At night this spot is mid-corridor; the
  way on is the door at the end.
- **Stairs** along the east wall: treads 0.9 wide (x 0.6..1.5) rising from
  the foot at z −1.0 toward +Z to a landing at z +2.6, y 1.8 (10 × 0.27 run,
  0.18 rise), a banister; a blocker at the foot; interact a plane there →
  evening `'Not yet. The wireless first. Then up.'`, morning `'The banister
  is wrapped. The carpet is rolled.'` The **mat** at the stair foot: a
  plane 0.6 × 0.4 (`'#6b5a4a'`) at (1.0, 0.006, −1.0) — visible at every
  hour (it is also in the dream-hall). **Understairs cupboard** door in the
  east wall at z +3.8: `'Locked. Coats and a hoover and the smell of the dark.'`
- **Telephone table** against the west wall at (−1.0, 0, −3.8): `makeTable({ w: 0.8, d: 0.42, h: 0.78 })`
  — visible at every hour; at night it is I's note table. The **telephone**
  on it (a black box, a handset) at the evening and morning only: evening
  `'The dialling tone. Nobody to ring, at this hour.'`; morning it is in a box.
- **Hall stand** against the west wall at (−1.3, 0, +1.0): a box 0.35 × 0.95 × 0.35
  with a vase of **sunflowers** (five stems + yellow heads) at the evening;
  at the morning gone — a pale square on the floor; at night absent.
- **Coat hooks** on the west wall at z +4.2, y 1.6: three hooks; **her
  coat** (box 0.34 × 0.95 × 0.14, `'#5a4a3d'`) at the evening only: interact
  → `'Warm, still. In the pocket: the spare key, and a note, folded small, in
  her hand.'` → `giveItem { id: 'spare-key', name: 'the spare key, warm' }`,
  `giveItem { id: 'note-i', name: 'a note, folded small' }` and
  `giveNote({ id: 'l17-note', title: 'the note from her coat pocket', body: I's note, verbatim })`.
- **The clock:** `makeClockFace` in a drum case on a bracket on the west
  wall at (−1.32, 1.9, 3.2) facing +X — visible and touchable at every hour
  (it is 3 mm proud of the dream-hall's wall, 0.18 m proud of the house's).
- **Morning boxes** by the front door: `HALL — van` (the **slippers**:
  `'Her slippers, flattened at the heel. You take them.'` → `giveItem { id: 'slippers', name: 'her slippers' }`),
  `HALL — keep` (`'The telephone, its cord wound round it. Four photographs, face down.'`),
  `HALL — misc` (`'A bulb for the porch light, still in its sleeve. It was never the bulb.'`).
  Pale rectangles on the wallpaper where the photographs hung; the
  telephone table under a sheet.
- Spawn (0, 0, +4.6), yaw 0 (facing down the hall). Bounds x −1.6..1.6,
  z −33..+5.2 (the dream-hall's far end included).

**The dream's hall** (night): I's corridor, rebuilt: x −1.35..1.35
(width 2.7), from the back wall at z +5.4 to the end wall at z −30.6,
height 3.0. I's materials (wallpaper `'#b7a48e'`/`'#a8927a'`, carpet
`'#6d5a58'`, plaster ceiling `'#b3aa97'`, skirting). Six bulbs at z = 2.3 − 6i
(i = 0..5; the fifth, i = 4, stutters as I's sixth did); dust
(`makeDust({ count: 220, box: [2.4, 2.6, 36], center: [0, 1.5, −12.6] })`).
Ten doors at z = −0.7 − 7i (i = 0..4), alternating sides as in I (east for
even i), plates `203 + 2i` on the east and `204 + 2i` on the west; `'try
the door'` → `locked` + I's three flavour lines in order, then `'Locked.'`
— except **207** (i = 2, east): `'Locked. Behind it, somebody small is
breathing, slowly, asleep.'` Four faded photographs between the doors as in
I. The **table** at (−1.0, 0, −3.8) (the same mesh as the telephone table —
bound to every hour). The **pedestal** at (1.0, 0, −17.7): I's plaster
pedestal 0.34 × 0.98 × 0.34, the vase with five dry stems. The **end door**
at (0, 0, −30.6): `makeDoor({ width: 1.0, color: '#4f3d2e', frameColor: '#3c2f24' })`
in a wall with I's lintel; beyond it a dark landing 4 × 4 with a blocker at
−34; `loopAt('radio', (0, 1.2, −31.5))` at gain 0.3 (the sitting room is
through there). Threshold `z < −31.8`.

**Hours.**

| | night | evening | morning |
|---|---|---|---|
| light | per-hour look; I's bulbs (warm `0xffe2bc`, intensity 5, the stutterer); no moon (no window) | a bulb at (0, 0, 0) (`0xffd2a0`, 4.5, y 2.45) and one at (0, 0, −4) (3.5); the wireless beyond the sitting-room door `loopAt('radio', (−2.0, 1.2, −3.0))` at gain 0.5 | per-hour look; the `DirectionalLight` from the front door |
| her | — | her coat, warm; the sunflowers; the telephone; 15 s after the first evening begins: `playSoundAt('handle', sittingDoorPos)` + `'She thought of something, and didn't.'` (4 s); her slippers: `stepOther {soft}` every 0.9 s beyond the sitting-room door for the first 8 s of each evening | the boxes; the van |
| the table | I's table: accepts the note, then the key | the telephone table: placing → the wrong-hour line | under a sheet: the morning line |
| the pedestal | I's pedestal: accepts the key, then the note | — | — |
| the mat | accepts the slippers | `'The mat. Her slippers are not on it; she is wearing them.'` | `'The mat. Dust, in the shape of two feet.'` |

**Placing and taking back (night).** Interact the table: holding the note
→ the note prop appears at (−1.0, 0.795, −3.8), `removeItem('note-i')`,
`paper`; else holding the key → `makeKeyProp` at (−0.8, 0.8, −3.7),
`removeItem`. Interact a placed thing → take it back (`pickup`). The
pedestal the same way (the key at (0.97, 1.0, −17.5), the note at
(1.0, 1.0, −17.9)). The mat: the slippers (two small boxes) at
(1.0, 0.03, −1.0); take back the same way. So four arrangements of note and
key are possible and only one is right; the rehearsal says which.

**The rehearsal.** Interact the end door at night (prompt `'the door at the
end. listen.'`). If nothing is running: `hush(1.5)`, objective `'listen'`,
and after 1.5 s the walk begins. The child's dream-self is never shown;
it is footsteps: `footsteps(points, { stride: 0.55, every: 0.26, sound: 'smallStep', opts: { soft: slippersOnMat } })`
in legs, with a check at the end of each leg:

```
leg 1  mat (1.0, 0, −1.0) → the table, stopping at (−0.6, 0, −3.4)        cue (first step) 'small footsteps' with direction
       check SLIPPERS: if none on the mat → after 4 steps the walk stops: 'hummed' {small, notes: tune('EG')} at the walker; 4 steps back toward the mat; FAIL
           subtitle 'Bare feet on the hall floor. It goes back up for its slippers, and there aren't any.' (6 s)
       at the table: if the note is there → 'paper' at the table; pause 1.5 s
                     else → pause 1.5 s; 'hummed' {small, 'EG'}; 4 steps back; FAIL
           subtitle 'It came down, and there was nothing to read, and it went back up.' (6 s)
leg 2  the table → the pedestal, stopping at (0.7, 0, −17.3)
       at the pedestal: if the key is there → 'pickup' at the pedestal; pause 1.0 s
                        else → pause 1.5 s; 'hummed'; 6 steps back; FAIL
           subtitle (1st) 'It read the note. It looked where the note said, and found nothing, and went back.' (6 s)
                    (2nd+) 'It looks where the flowers used to be. Nowhere else.' (5 s)
leg 3  the pedestal → the end door, stopping at (0, 0, −30.0)
       SUCCESS: 'unlock' at the door; door.setOpen(true, −1); removeColliderOf(panel); 'door'; the placed note, key and slippers stay where they are
           subtitle 'It found everything. It goes on ahead of you, and the door stays open.' (6 s); objective 'the wireless'
           3 s later: 'phone' {rings: 2} at the telephone table's position (the table has no telephone at night); cue 'a telephone, ringing'
```

FAIL ends the rehearsal (the end door can be tried again at once); the
things placed stay. `rehearsals++`; after the third failure: `'It comes
down in her slippers, reads the note by the door, and looks where the
flowers used to be. That is the whole of it.'` (8 s).

**State machine.**

```
S0  night. objective 'slippers, she said. then the wireless.'
    the first wind → objective 'the hall, at another hour'
S1  have any of slippers / note / key → objective 'leave them where it will look'
S2  success → objective 'the wireless'
END threshold z < −31.8 → complete()
```

**Texts.** The note is I's (`'We moved the spare key when you stopped
visiting.\n\nIt's where the flowers used to be.\nYou watered them every
Sunday. Remember?\n\n— M.'`). The coat line, the boxes and the mat lines are
in the tables above.

**debugSolve.**

```
interact clock → wait 1.9          // → morning
interact box 'HALL — van' → 0.3    // slippers
interact clock → 1.9               // → evening
interact coat → 0.3 → closeModal   // key + note
interact clock → 1.9               // → night
interact mat → 0.3; interact table → 0.3 (the note); interact pedestal → 0.3 (the key)
interact endDoor; _waitFor(() => this._exitOpen, 30)   // the rehearsal, ≈ 19 s
teleport(0, −32) → wait 0.6
```
(≈ 28 s.)

**Fairness.** The coat is warm and says what is in it. The morning box
says whose slippers. The dream-hall has exactly two surfaces to leave
things on and one mat; the rehearsal stops at the first wrong one and says
so in her terms. Three failures spell it out.

### 5.3 XVIII — The Sitting Room

```js
static meta = {
  id: 18, numeral: 'XVIII', title: 'The Sitting Room', mood: 'night', grade: /* §5 night */,
  intro: 'The wireless is on, between stations, and something small upstairs has heard you come in.',
  outro:
    'You were the one in the dark, for once,\n' +
    'keeping out of the light it carried,\n' +
    'and it went back up to bed humming your song. Her song.',
};
```

**Layout.** Interior 6.4 (x) × 5.2 (z) × 2.7 (h). Origin at the centre.
+X is the hall wall (east); −X the chimney wall (west); −Z the window wall
(north); +Z the sofa wall (south). Wallpaper (`'#8d8378'` stripe `'#7f7468'`),
carpet `'#5a4e4c'`, a rug (plane 3.2 × 2.4, `carpet '#6b4a48'`) at (−0.6, 0.005, 0).

- **Hall door** in the east wall at z +1.6 (`makeDoor({ color: '#5a4636' })`),
  the way in and the way out. Beyond it a stub (x 3.2..5.4, z 1.0..2.2)
  with the first three treads of the stairs rising east (boxes; collide and
  ground) and a dim landing light above (`makeBulbLight({ intensity: 1.6, y: 3.0 })`
  at (5.0, 0, 1.6)). Threshold `x > 4.4`. Shut and locked until the tune
  plays (`'It shut behind you. They always do.'`); the child opens it.
- **Chimney breast** on the west wall, z −0.8..0.8, protruding to x −2.75;
  the hearth opening 0.8 × 0.7; a mantel at y 1.2 with three photographs
  (`makePictureFrame` with `blurredPhotoTexture`) and the **mantel clock**
  (`makeClockFace({ radius: 0.1 })` in a small case at (−2.7, 1.34, 0.5),
  facing +X — the hours device, interact distance 3). The **poker** leaning
  in the hearth at (−2.9, 0.3, 0.4).
- **Armchairs** at (−1.4, 0, 0.8) and (−1.4, 0, −0.8), facing the fire
  (backs toward +X): seat 0.7 × 0.45 × 0.7, back 0.7 × 1.05 × 0.2, arms;
  colliders. The north one has the dent and, at the evening, her knitting.
- **Sofa** against the south wall at (0.2, 0, 2.1), facing −Z (back 1.9 × 0.9 × 0.2
  against the wall). **Side table** at its west end (−0.95, 0, 2.2) with the
  **cup**.
- **Bookcase** (`makeShelf({ w: 1.2, h: 1.9, d: 0.3 })`) at (−2.0, 0, 1.9),
  rotated to run along z (x −2.15..−1.85, z 1.3..2.5), books as coloured
  boxes: with the west wall it forms an **alcove** (x −3.2..−2.15,
  z 1.3..2.6) open to −Z. Collider; occluder.
- **Window** in the north wall at x −1.2 (1.4 × 1.2, y 1.4); beyond it
  III's lamp post at (−1.2, 0, −7), its light refusing (as XVII's).
- **Wireless** on a table (`makeTable({ w: 0.8, d: 0.5, h: 0.7 })`) against the
  north wall at (2.0, 0, −2.3): a wood box 0.45 × 0.3 × 0.22 (`'#5a3f2e'`), a
  cloth grille, a **dial face** (plane 0.2 × 0.08 at its front, `textTexture`
  of `200 · 250 · 300 · 350 · 400 · 450 · 500 · 550` in `'18px Georgia'`) and a
  **needle** (a thin box) whose x across the face maps 200..550; a knob.
  At the evening a paper strip on the glass (plane 0.07 × 0.018, `textTexture('247 — ours', 'italic 22px Georgia')`).
- **Serving hatch** in the east wall at (3.15, 1.2, −1.5): a shutter.
- **Standard lamp** at (2.6, 0, −0.6): pole, shade, a `PointLight(0xffd2a0, 0, 6)`
  at y 1.6 (evening 3.5, else 0).
- Spawn (2.4, 0, 1.6), yaw π/2 (facing −X into the room, the door at your
  back). Bounds x −3.0..5.2, z −2.4..2.4.

**Hours.**

| | night | evening | morning |
|---|---|---|---|
| light | per-hour look; moon at the window | fire: `loopAt('fire', hearthPos)` + `PointLight(0xff9a4a, 2.5, 6)` at (−2.8, 0.5, 0) flickering ±20 % (a ticker); the standard lamp; `HemisphereLight` warm | per-hour look; `DirectionalLight` from the window |
| the wireless | on, between stations: `loopAt('radio', wirelessPos)` gain 0.25, `static {dur: 0.6}` every 9 s; the needle at 540 | on and tuned: `radio` gain 0.3 and the tune (`piano` E G A G E G E at 0.5 s steps, gain 0.05) every 14 s; the needle at 247; the paper strip: interact → `learnClue { id: 'l18-dial', title: 'the wireless, at half past eight', body: '247. a label on the glass, in her hand: "ours".' }` | gone; a pale square on the table |
| her | — | the dent; the cup steaming (`'Tea. She has just put it down.'`); the knitting; 15 s into the first evening: `handle` at the hall door + `'She thought of something, and didn't.'` | — |
| the child | the torch game (below) | — | — |
| boxes | — | — | `SITTING ROOM — keep` (`'The wireless, its cord wound round it. It still gets the one station, she said.'`), `SMALL — toys` (the **torch**: `'A torch. Its batteries are long dead, here. You take it anyway.'` → `giveItem { id: 'torch', name: 'a torch' }`), `SITTING ROOM — van`; the armchairs under sheets; the photographs gone (pale squares on the breast) |
| hall door | locked until the tune; the child opens it | `'Not yet. She is still up.'` | open onto white |

**The dial.** Interact the wireless at night → `showKeypad({ label: 'the wireless — ' + shown, length: 1, keys: '1234567890', onSubmit: (d) => this._click(d) })`
where `shown` is the digits so far as `'2 · ·'`. One digit per interaction;
the keypad closes itself. `_click(d)`: `tick` at the wireless (gain 0.08 —
a sound event, §below); `digits += d`; the needle moves to
`parseInt(digits.padEnd(3, '0'))` clamped to 200..550 (so `'2'` → 200,
`'24'` → 240, `'247'` → 247); if three digits: `'247'` → TUNED; else
`static {dur: 0.8}` + `'Between stations. The needle always rested a little
past the middle.'` (5 s), `digits = ''`, the needle spins to 540,
`wrongCount++`; `wrongCount ≥ 2` → 4 s later `'There is a label on the glass,
at half past eight.'` (5 s).

**The child (night).** `makeChild()` with the torch; `occluders = [bookcase, chimney breast, armchair backs]`;
eye offset `(0, 0.95, 0)`. `D = (2.4, 0, 1.6)` just inside the hall door,
base facing −X.

```
OFF      not in the room. The first dial click → the hall door opens (setOpen, 'door', cue 'the door'); the child walks in to D, torch on; → WAIT
         (if the torch was taken at the morning: torch off, and `angleDeg` for the seen-test is 0 — only the near rule applies; subtitle once:
          'It stands in the doorway without a light, listening for you. You wish you hadn't.' (6 s))
WAIT     at D; yaw sweeps ±65° about −X, period 7 s
SOUND(P) any sound event: target P; turn to face P over 0.6 s; walk toward P at 1.1 m/s until 1.5 m from P (stop early at colliders); → LOOK
LOOK     face P 1.2 s; sweep ±45° over 2.0 s; → RETURN.   A new sound during SOUND/LOOK/RETURN replaces the target (latest wins).
RETURN   walk to D at 1.1 m/s; face −X; → WAIT
SEEN     in WAIT/SOUND/LOOK/RETURN: isSeenBy(child, { angleDeg: 22, maxDist: 9, occluders, eye }) for 0.45 s continuous, or planar distance < 1.6 m for 0.3 s
         → 'gasp' at the child; cue 'a gasp'; torch off; flinch({ flash: 0 }); the child runs (2.2 m/s) to D and out; the door shuts ('door');
           digits = ''; the needle spins to 540 ('static' 0.6); dread 0.5 easing to 0 over 6 s; seenCount++
           subtitle (1st) 'It saw you. She never let it see her. You know why, now.' (6 s); (2nd+) 'It saw you. It will come down again. It always does.' (5 s)
           seenCount ≥ 3 → 4 s later 'Give it something else to look at. The poker. The cup. The hatch. The window.' (7 s)
         → OFF for 12 s; then the door opens by itself and it returns to D → WAIT (no click needed)
TUNED    the third digit is right: the child stops where it is, faces the wireless, torch off; hush(2); then the wireless plays the tune twice
         (playSoundAt('piano', wirelessPos, { freq }) at 0.5 s steps, gain 0.06; cue 'the tune, from the wireless'); on the second pass the child hums along
         ('hummed' {small, notes: tune('EGAGEGE'), step: 0.5} at the child; cue 'it hums along');
         then it walks to D and out through the door (which stays open) and up: footsteps((3.4, 0, 1.6) → (5.0, 1.8, 1.6), { every: 0.45, opts: { soft: true } })
         objective 'up. two metres behind.'; the wireless stays on: 'radio' gain 0.2 and the tune every 20 s
         (torch taken: 'It goes up humming, in the dark.' (5 s))
END      threshold x > 4.4 → complete()
```

The child always faces its target; its torch beam is the sighted form of
the seen-test (the beam is a real `SpotLight`; `makeDust({ count: 160 })`
in the room gives it body). The near rule keeps §1.2 rule 11: it turns when
you are within 1.6 m, so you are never closer than that, and it never
comes closer than 1.5 m to a sound.

**Sound events** (each cued, each with an 8 s cooldown, each a `SOUND(P)`
for the child):

| interact | P | sound | cue |
|---|---|---|---|
| the poker | (−2.9, 0.3, 0.4) | `clunk` | `'the poker falls'` |
| the cup | (−0.95, 0.75, 2.2) | `tone {freq: 1800, gain: 0.05, decay: 0.8}` | `'the cup, set down'` |
| the hatch | (3.15, 1.2, −1.5) | `knock {count: 1, soft: true}` | `'a plate, in the hatch'` |
| the window | (−1.2, 1.4, −2.58) | `knock {count: 1, soft: true}` | `'the window, tapped'` |
| the wireless (a click) | (2.0, 0.85, −2.3) | `tick` | `'a click, at the wireless'` |

**State machine.**

```
S0  night. objective 'the wireless. she said the wireless.'
    first wind → objective 'the wireless, at another hour'
S1  first click → objective 'keep out of its light'
S2  TUNED → objective 'up. two metres behind.'
END threshold → complete()
```

**debugSolve** (the torch is left in its box — the harder path is the one
that is proved):

```
interact clock → 1.9 (morning) — do not touch SMALL — toys
interact clock → 1.9 (evening); interact dialStrip → 0.2
interact clock → 1.9 (night)
teleport(1.6, −1.2, 0)                              // at the wireless, facing −Z
interact wireless; submitKeypad('2')                // the child comes; it walks to the wireless
teleport(−2.7, 1.9, π/2)                            // the alcove, facing the west wall — behind the bookcase, outside the beam
_waitFor(child.state === 'wait', 16)                // it looks, and goes back to the door
interact cup                                        // it turns and walks to the cup (it faces +Z/−X there: the wireless is behind it)
_waitFor(child.state !== 'wait' && |yaw to wireless| > 70°, 6)
teleport(1.6, −1.2, 0); interact wireless; submitKeypad('4'); wait 0.3; interact wireless; submitKeypad('7')
teleport(−2.7, 1.9, π/2)
_waitFor(() => this._tuned, 6); _waitFor(child.state === 'gone', 16)
teleport(4.8, 1.6) → wait 0.6
```
(≈ 34 s. If it runs long on a slow machine, trim LOOK's sweep to 1.6 s —
never the cooldowns or the near rule.)

**Fairness.** The strip on the glass gives the number at the hour you are
told to look (the intro says the wireless; the evening is hers). The beam
is the seen-test made visible. The first sighting says why. Three sightings
name the four things you can throw. The cheaper path is a real path and
costs only a line.

### 5.4 XIX — The Stairs

```js
static meta = {
  id: 19, numeral: 'XIX', title: 'The Stairs', mood: 'stairwell', grade: /* §5 night */,
  intro: 'Up, then. Two flights below it, always; she taught you that without meaning to.',
  outro:
    'You lit the doors one closer each time round,\n' +
    'and wrote wait for me in the only hand it could have been in,\n' +
    'and when it stopped, you stopped two metres short, and the door gave.',
};
```

**Layout.** Three parts: the house's stairs and landing (all hours); three
rooms off the landing that differ by hour; the shaft (night).

**Stairs and landing.** The player spawns at the stair foot in a dark
stub of hall (x −0.9..0.9, z +5.4..+7.0, y 0; a blocker at +7.0) at
(0, 0, +6.2), yaw 0. Treads rise from z +5.4 to z +2.7 (10 × 0.27, rise
0.18; colliders + grounds) to the **landing** at y 1.8: x −1.2..1.2,
z −3.0..+2.7, height 2.5, plaster `'#a9a597'` with the bedroom's wallpaper
above a dado, carpet `'#5a4e4c'`. A banister along the stairwell opening.

- West wall (x −1.2): the **bathroom door** at z −1.5; the **airing
  cupboard door** at z +0.9.
- East wall (x +1.2): the **box room door** at z −1.5; the **child's door**
  at z +0.6 (`'#5a4636'`, XI's): `locked` + `'Shut. Yours always last.'`;
  every ~50 s `knock {count: 2, soft: true}` from behind it, cue `'two
  knocks, behind the door'`. The **long-case clock** against the east wall
  at (1.0, 1.8, −0.5): a case 0.45 × 2.0 × 0.3 (`wood '#4a3a2c'`), the
  `makeClockFace({ radius: 0.12 })` at y 3.5 (1.7 above the landing floor)
  facing −X — the hours device; it ticks (`tick` at the face every 1.0 s)
  at the evening and the morning and is silent at night.
- North wall (z −3.0): a **window** at x +0.3 (the field: fireflies at
  night; dusk; white); **her door** at x −0.5: `locked` + `'Her room. You
  never went in.'` (every hour, in this room).
- A fire-plan sign (XII's words) beside the airing cupboard door at every
  hour: `'IN THE EVENT OF FIRE\ndo not use the lifts\ndo not run\nassembly point: the playground'`.
- Bounds: x −8.2..4.6, y −16..4.8, z −3.2..7.2.

**Behind the doors** (each room built in place, bound to its hour by
`objects` + `colliders`; its door opens at that hour and is `locked` with
a line at the others).

- **Bathroom** (evening): x −3.6..−1.2, z −2.6..−0.4: a bath (box), basin,
  the mirror over the basin under a cloth (`'Covered. She keeps it covered.
  Leave it.'`), the towel rail with the **ribbon** (a thin box, `0x4a6aa8`):
  `'Blue. Not blue once — blue. It is newer than you remember it.'` →
  `giveItem { id: 'ribbon', name: 'a ribbon, blue' }`; `loopAt('tap', bathPos)`
  at gain 0.15. Night: `'Locked. Behind it, water is running into a tub that
  never fills.'` Morning: open onto white.
- **Airing cupboard** (evening): x −2.6..−1.2, z +0.3..+1.5: the boiler
  (`loopAt('boiler')`), towels on slats; `'Warm. Towels, and the boiler
  ticking like something counting.'` **Morning: the archive** (below).
  **Night: the shaft** (below) — locked until the box is ready: `'Locked.
  Something on the other side is still going down.'` + faint `stepOther`
  below.
- **Box room** (evening): x +1.2..+4.2, z −3.0..0.0: a cot frame, a trunk,
  and **the box** on the trunk at (2.7, 0.6, −1.6): cardboard 0.5 × 0.35 × 0.4,
  lid flaps open, a label plane with one scribbled word (a canvas: a single
  illegible cursive word; the texture has `redraw({ strikes })` like the chalk).
  Interact `'the label'` → strikes 1: `'You cross it out. It was hers to give,
  not yours to keep.'`; strikes 2: `'And once more, for whoever is small next.'`;
  then nothing. Interact `'the box'` holding the photograph / ribbon / key →
  it goes in (visible inside; `removeItem`; `paper`); holding nothing →
  `'Empty. It has been kept empty a long time. It is waiting for three things.'`
  READY when all three are in and strikes = 2: `clue` + `'It is ready. It
  will be found under the house, in a room that does not exist yet.'` (6 s);
  objective `'down, two flights below'`. Night: `'Locked.'` Morning: white.

**The archive** (morning, behind the airing cupboard door): x −6.2..−1.2,
z −1.0..+3.0, height 2.5; IX's look in morning light (shelves
`makeShelf` ×4 along the north and south walls, the reading table at
(−3.7, 0, 1.0) with the green lamp unlit). **Eight boxes** on the shelves,
lids down, labels (`textTexture`, `'italic 30px Georgia'`, lowercase):
`the hallway · the pool · the street · the supermarket · the house · the
field · the platform · the theater`. The **in-tray** on the table holds
eight **cards** in this order, top first:

| # | card (body) | box |
|---|---|---|
| 1 | three lamps came on, and the one outside your house never did. the key was under the stone that didn't match. | the street |
| 2 | nobody watched you swim but her. the deep end was four. | the pool |
| 3 | doors 203 to 212. the spare key where the flowers used to be; you watered them on Sundays. | the hallway |
| 4 | from the tree that died the summer you were eight, thirteen posts along the wire, and look down. a tin. a ribbon. | the field |
| 5 | row F, seat 8. The Long Summer, 1974. you cannot remember it. | the theater |
| 6 | supper, then slippers, then the wireless, and yours always last. the porch was dead. | the house |
| 7 | the 23:47, carriage 3, seat 41. the train did not stop. | the platform |
| 8 | milk, bread, apples, sunflowers, for Sunday. the office knew the aisles: 3 1 4 2. | the supermarket |

Interact the tray → take the top card: `giveNote({ id: 'l19-card-'+k, title: 'an index card', body })`
and `giveItem({ id: 'card', name: 'an index card' })`; holding one already
→ `'One at a time. You are the filer tonight.'` Interact a box holding a
card → right box: the lid opens (flaps rotate up over 0.6 s), `paper`,
`removeItem('card')`, `filed++`, and the box's contents appear: **the
hallway** → `makeKeyProp` inside: `'The spare key. Cold now. It will be warm
again by the time it is found.'` → `giveItem { id: 'spare-key', name: 'the spare key, cold now' }`;
**the house** → a small `makePictureFrame` with `blurredPhotoTexture({ figures: 2 })`:
`'Two figures, faces gone soft. One of them is you.'` → `giveItem { id: 'photo', name: 'a photograph, two figures' }`;
the others a line on opening (the street `'A house key, and a stone that
does not match.'`, the pool `'A tile from the deep end.'`, the field `'A
rusted tin, empty.'`, the theater `'A ticket stub, row F.'`, the platform
`'A ticket for the 23:47, smudged.'`, the supermarket `'A list. You know the
list.'`). Wrong box → `locked` + `'The lid stays down. That was not <label>.'`
(the card stays in your hand). All eight filed →
`learnClue { id: 'l19-records', title: 'the records', body: 'what the records agree on — how deep the water finally went, the aisle that faced the sun, the carriage you always chose, your row, counted on your fingers.' }`.

**The shaft** (night, behind the airing cupboard door, once the box is
ready). XII's dog-leg, mirrored: main landings on the **east** (directly
behind the cupboard door), half-landings on the **west**; floor height 2.72;
flights of 8 steps (rise 0.17, run 0.28 — 2.24 m): main landing x −3.4..−1.2,
z −0.4..+2.2; the two flights side by side between x −5.64 and −3.4; the
**south flight** (z −0.4..+0.9) descends westward from the main landing to
the half-landing at x −7.8..−5.64 (y − 1.36); the **north flight**
(z +0.9..+2.2) descends eastward from the half-landing to the next main
landing (y − 2.72). Build from a data table with a
`buildFloor(y, label, opts)` helper as Level12 does (copy the approach; do
not import it). Steps: colliders + grounds; handrails; a solid wall between
the flights' undersides. Concrete throughout; caged bulbs over each main
landing (`0xd8dcd0`, 3.2, y + 2.45; L2's flickers; L3's casts the one
shadow) and dimmer ones over half-landings. XII's label signs on the
landings' north walls (`2 · 1 · G · −1 · −2 · −3`) and the fire-plan sign on
each.

| idx | label | y | door / feature |
|---|---|---|---|
| L0 | `2` | 1.8 | the airing cupboard door (east wall — the way in) and, on the **north** wall (z +2.2) at x −2.3, the **wardrobe's back**: a wood panel (`makeDoor({ color: '#7a5a3a', knob: false })`), shut; `'The back of a wardrobe. It is not your way yet.'` until the end |
| L1 | `1` | −0.92 | fire door, locked: `'Locked. Through the glass, a corridor with every light off.'` |
| L2 | `G` | −3.64 | fire door, locked: `'Locked. Someone has stacked chairs against the other side.'` |
| L3 | `−1` | −6.36 | fire door, **unlocked for you** + stub |
| L4 | `−2` | −9.08 | fire door + stub; the **chalk** on the south wall (z −0.4) at x −2.3, y 1.2 |
| L5 | `−3` | −11.80 | fire door + stub |
| — | — | −13.16 / −14.52 | below L5: the south flight to a half-landing at −13.16, the north flight toward where L6 would be; a blocker at −14.9 |

**Loop:** `footY < −13.4` on the north flight → `teleport(p.x, p.z, yaw, footY + 8.16)`
(you arrive below L2's half-landing heading down toward L3), `loops++`, the
loop check (below). Disabled after the approach.

**Stubs** (L3–L5): behind the fire door, a corridor running **east** from
x −1.2 to x +3.8 (z 0.2..1.6, height 2.6 — under the house; nothing
conflicts), four lockers, and at x +3.5 a light fitting (emissive plane +
`PointLight(0xffd9a8, 0, 7)`) with a **pull cord** (a thin cylinder; interact
`'the cord'` → `switch`; the stub light toggles: the plane's emissive 0 / 1.2,
the light 0 / 4). The fire doors on L3–L5 open for you (`unlock` the first
time each; they swing and stay).

**The child, above.** Once the box is ready and the player is in the shaft
at or below L3, a walker **W** is placed on the shaft's path **two flights
above the player** — one floor, 2.72 m higher, at the same point of the
stair path one storey up — and slaved to you: as you go down, W goes down
above you, always exactly two flights; `smallStep` at W's position every 0.5 s while your planar
speed > 0.5 (cue the first: `'small footsteps, above you'`); when you stop,
one more step 0.5 s later, then nothing. W never comes closer than two
flights: it is slaved to your place on the path, so climbing toward it
moves it up and away, and `'It stops, above you. It will come no closer
than that.'` plays (once per 20 s) while you keep climbing. W is shown — a `makeChild()` at W's position, lit by the
landing bulbs, facing down the flight — seen only from below, at a
distance, through the banisters.

**Loop check** (at each loop teleport; `k = loops − 1`): exactly one stub
light must be on, and it must be the one the child's dream will see this
time round: **k = 0 → L5 (−3); k = 1 → L4 (−2)**. Right → W hums
(`hummed {small, tune('EG')}` at W; cue `'it hums'`), `correct++`. Wrong (none,
another, or two) → W's steps quicken for 3 s (every 0.3 s; cue `'it hurries'`),
`pleaded++`, and the chalk gains `'please'` if written. A third loop with the
light on L3 (−1) is not wrong (it is what the dream sees from loop 2 on)
but does not count.

**The chalk** (L4): blank. Interact → `clue`; `chalk.redraw({ tally: 1, lines: ['wait for me'] })`;
`'You write it, in an adult hand. It is the only hand it could have been in.'` (6 s).
Later passes when `loops > tally` → interact adds a stroke: `'One more. You
keep count for it.'`

**The approach.** When `correct ≥ 2` and the chalk is written: the next
time you are still (planar speed < 0.05, no modal) for 5 s anywhere at or
below the −2 landing (footY ≤ −8.9, so that W is on L3, L4 or L5 — landings
with a door that opens), W stops on the nearest main landing at or above
its position — two flights above you — facing its fire door; `hush(2)`; subtitle `'It has stopped, above you, in
front of a door. It is waiting to see what you do.'` (6 s); objective `'up
to it. two metres short.'`; W's flight blocker is removed; a blocker is
placed on the top two steps of the north flight below W's landing (you
stop about two metres short, on the flight, looking up at it). When your
head is within 2.8 m of W: `breath` (unpositioned — your own), `hush(3)`,
`flinch({ flash: 0 })`; 1 s later the fire door on W's landing: `unlock`,
`setOpen(true, +1)`, `removeColliderOf`, its stub light warms (4); W's steps
go into the stub (`footsteps` from W to (3.5, y, 0.9), `every 0.45`, fading)
and the child figure walks with them and is hidden at the end; subtitle
`'The door beside it gives, and it goes through, and does not look back. You
did not want it to.'` (6 s); loop disabled; all flight blockers removed;
objective `'up. the back of the wardrobe.'` If you move before it is reached
(speed > 0.3 for 1 s) → W goes on (`'It goes on. It will stop again when you
do.'`), the still timer resets.

**The wardrobe's back** (L0, north wall): after the approach, interact →
`door`, it swings away; a stub beyond (x −2.8..−1.8, z 2.2..3.8, concrete,
a dark doorway at the end with a blocker). Threshold `z > 3.3` → complete().

**Hours on the landing.**

| | night | evening | morning |
|---|---|---|---|
| light | per-hour look; fireflies at the window | landing bulb (`0xffd2a0`, 3.5 at y 4.2); her humming from below once a minute (`hummed` EGAG at (0, 0.5, 6)) and the wireless faint below | per-hour look; the `DirectionalLight` from the window |
| doors | bathroom locked (the tub line); airing → the shaft (locked until READY); box room locked | bathroom, airing cupboard, box room open; her door: `'Her room. She is still up.'` | bathroom white; airing → the archive; box room white; a box `LANDING — van` |
| the clock | silent, stopped | ticks | ticks |

**State machine.**

```
S0  night. objective 'up. then yours last.'
    first wind → objective 'the landing, at another hour'
S1  any of photo / ribbon / key held → objective 'the box, in the box room'
S2  READY → objective 'down, two flights below'; the shaft opens at night
S3  in the shaft: after the first loop, objective 'one door closer each time round'; after the chalk, 'wait for me'
S4  approach → 'up to it. two metres short.' → the door → 'up. the back of the wardrobe.'
END threshold → complete()
```

**debugSolve.**

```
teleport(0, 0.5, 0, 1.8)                                  // onto the landing
interact clock → 1.9 (morning); interact airingDoor → 0.3
for k in 1..6: interact tray → 0.2 → closeModal; interact box[card k's box] → 0.2     // cards 1–6 (through 'the house')
interact keyInHallwayBox → 0.2; interact photoInHouseBox → 0.2
interact clock → 1.9 (evening); interact bathroomDoor → 0.3; interact ribbon → 0.2
interact boxRoomDoor → 0.3; interact label → 0.2; interact label → 0.2; interact box ×3 (0.2 each)    // READY
interact clock → 1.9 (night); interact airingDoor → 0.3                               // the shaft
teleport(−2.3, 0.25, π/2, −6.36)                          // L3 main landing; W appears two flights above
teleport(2.8, 0.9, 0, −11.8); interact cord5 → 0.2        // loop 0: −3 lit
teleport(−4.5, 1.55, −π/2, −13.9) → 0.4                   // on the north flight below L5's half-landing: the loop point → teleported up; check passes (correct 1)
teleport(2.8, 0.9, 0, −11.8); interact cord5 → 0.2        // off
teleport(2.8, 0.9, 0, −9.08); interact cord4 → 0.2         // loop 1: −2 lit
teleport(−4.5, 1.55, −π/2, −13.9) → 0.4                   // correct 2
teleport(−2.3, 0.0, 0, −9.08); interact chalk → 0.2        // 'wait for me'
teleport(−2.3, 0.9, π/2, −9.08); _waitFor(approachArmed, 8)      // still 5 s on L4; W stops on L3
teleport(−4.3, 0.25, −π/2, −6.9); _waitFor(doorOpened, 6)         // three steps below L3 on the south flight, inside 2.8 m of W: breath; the door
teleport(−2.3, 1.55, 0, 1.8); interact wardrobeBack → 0.3; teleport(−2.3, 3.6, 0, 1.8) → 0.6
```
(≈ 36 s. `teleport(x, z, yaw, y)` sets foot height when `y` is passed.)

**Fairness.** Each card names its room in its own words. The box says
what it waits for. The fire plan's words are the child's (`'do not run'`).
The first loop teaches the light rule by W's hurry or hum; the chalk is the
only blank thing on a landing that repeats. Stillness is the answer XII
taught; the subtitle says so when it stops.

### 5.5 XX — The Room

```js
static meta = {
  id: 20, numeral: 'XX', title: 'The Room', mood: 'night', grade: /* §5 night */,
  intro: 'Its room. Your room. It is asleep, and the door is shut, and you have come in the long way.',
  outro:
    'You left it how she left it, and shut the door, and knocked, and left the light on.\n' +
    'Then you went to bed, the way she did,\n' +
    'and slept, for once, without dreaming.',
};
```

**Layout.** XI's bedroom, rebuilt to XI's coordinates (interior 4.2 × 3.6 × 2.5,
origin at the centre, +Z the door wall, the wardrobe on the south wall west
of the door, its back panel at z +1.79, the bed along the west wall, the
desk east, the mirror on the west wall at z +0.95, the window north, the
stars on the ceiling), plus:

- **The concrete stub** (night only) behind the wardrobe: x −1.05..−0.05,
  z +1.8..+3.3; concrete; a dark doorway at z +3.3 (blocker) — the shaft's
  L0 is behind you. Spawn (−0.55, 0, 3.0), yaw 0, facing the **back panel**
  (shut; interact `'through'` → it swings into the room (`door`); it shuts
  by itself the first time it is unseen after you are inside — XII's "it
  shut behind you"). At the other hours the stub is hidden and its colliders
  gone; a concrete wall at x −0.05..0.05, z 1.8..3.1 stands at every hour
  (`'Concrete, where the landing should go on.'`).
- **The landing** (all hours): a corridor along the south wall,
  x +0.15..+3.0, z +1.8..+3.1, and an east leg x +2.1..+3.3, z −1.8..+1.8
  (along the room's east wall); height 2.5; the landing bulb at
  (1.6, 0, 2.45) (`makeBulbLight({ color: 0xffd2a0, intensity: 3.5, distance: 8, y: 2.4 })`)
  **on at every hour** — the light that is left on; its **switch** on the
  south wall at (0.6, 1.3, 3.09). The **room's door** (XI's, x +1.2 on the
  south wall) opens onto the corridor. The **stairs down** at the corridor's
  east end: three treads descending south from (2.6, 0, 3.1) into a stub,
  blocker at z +4.4 (`'Down. Not yet.'`). **Her door** on the east leg's
  east wall (x +3.3) at z −1.0, facing −X; **her room** beyond: x 3.3..6.3,
  z −2.4..0.0: a bed (head at the east wall), a chair, a window in the north
  wall (the field: fireflies), the photograph (blurred) on the bedside.
  The **little key** on a hook by her door at (3.28, 1.3, −0.3).
- **Three knock spots** on the west wall of the landing's east leg
  (x +2.12, y 1.3): K1 z −1.4, K2 z −0.3, K3 z +0.9 (the back of XI's E2):
  faint planes as XI's, prompt `'knock'`, enabled at night after the lock.
- **The mirror room** behind the west wall: x −4.3..−2.1, z 0.45..1.45,
  y 0.9..1.9, walls `0x1a1c24`, a faint `PointLight(0x6c7ea8, 0.5, 3)` in
  it. The **mirror** (0.5 × 0.8 at (−2.08, 1.4, 0.95)) is
  `MeshStandardMaterial({ color: 0x0a0b0e, metalness: 1, roughness: 0.05, transparent: true, opacity: 0.55 })`
  — the room behind shows through, dimly. In it a `makeFigure()` (the dark
  shape, 1.95 tall) whose position is the player's mirrored in the plane
  `x = −2.08`: `(−4.16 − p.x, 0, p.z)`, facing the player, visible only at
  night while the mirror is uncovered and the player stands within
  x −2.08..0.6, z −0.2..2.1. The **sheet** (XI's box 0.62 × 0.95 × 0.03)
  lies folded at the bed's foot at night; `'cover it'` on the mirror places
  it over the glass (the figure hides; the mirror room is never seen again).
- **The child** in the bed at night: a blanket mound (box 0.8 × 0.22 × 1.3,
  `'#8a7468'`) and a head (`SphereGeometry(0.085)`, `0x9a8c80`) on the
  pillow at the north end; breathing (the mound's scale.y 1 ± 0.03 at
  0.25 Hz); a soft `breath` at the head every 4 s. At the evening: a seated
  `makeChild()` on the bed's edge facing the desk lamp (reading); at the
  morning: gone.
- **The clock** (XI's desk clock, `textTexture '3:07'` on a plane at
  (1.6, 0.86, −0.05) facing −X): the hours device here — interact → `tick`
  ×3, the digits flip (`'7:15'`, `'8:30'`, `'3:07'`), `hours.next()`.
- Bounds x −2.1..6.4, z −2.5..4.5.

**Hours.**

| | night | evening (her setup — the model) | morning |
|---|---|---|---|
| light | per-hour look (the stars glow); the landing bulb through the door's crack | the desk lamp on (3.2); the landing bulb; the door **open** | per-hour look; the landing bulb; the door open onto the white landing (blocker) |
| the child | asleep (above) | awake, sitting up, reading: the room is hers and you are not here yet — nothing reacts to you | gone |
| the chair | at the desk, turned to face the **bed** (wrong) | at the desk, facing the desk | gone |
| the sheet | folded at the bed's foot; the mirror bare; the figure in the glass | over the mirror (hers: `'Hers. Leave it. Yours is on the bed, at 3:07.'`) | in the box |
| the music box | on the shelf, unwound: interact `'wind it'` → `wind` soft (noise 2) — it plays `musicbox EGAG` once the next time it is unseen (XI's behaviour) | playing faintly when unseen (hers) | gone |
| the drawer | empty: interact with `note-xi` → `paper`; the note goes in; `removeItem` | ajar, her note visible (`'Hers. Leave it.'`) | gone |
| the clock | `'3:07'` | `'8:30'` | `'7:15'` |
| the door | shut; `'Shut. Leave it shut until the clock has stopped.'` until the clock is stopped, then opens from inside | open; the landing warm; her door `'Not yet. She is still up.'`; the stairs `'Not yet.'` | open onto white |
| boxes | — | — | `SMALL — keep` at the room's centre: the **slip** (`learnClue { id: 'l20-slip', title: 'the slip in the box, in her hand', body: 'SMALL — keep. music box (wind it). the sheet — the mirror. the note — the drawer. the chair to the desk. don't let it see the glass.' }`), the **note** (XI's: `giveItem { id: 'note-xi', name: 'a note, older than the others' }` + `giveNote` with XI's text, title `'a note, older than the others'`), stars in a bag (`'Stick-on stars, in a bag. Forty-five. You count them without meaning to.'`) |

**The stir.** At night each noisy act adds to a meter (chair 1, wind 2,
drawer 1, the wardrobe doors 1; placing the sheet 0); it decays 1 per 10 s.
At ≥ 2: the child turns over (`creak` + the mound rolls 10°; cue `'it turns
over'`); you must be still (planar speed < 0.05) for 3 s. Still → `'It turns
over, and settles.'` (4 s), meter 0. Moving (speed > 0.3) before 3 s → WAKE:
`hummed {small, [E]}`, the child sits up, the desk lamp comes on,
`hours.set('evening')` is forced (the only automatic hour change in the
arc): `'It sits up. It is awake, and the hour is wrong, and you are not
here yet.'` (6 s); after 25 s the child lies down, the lamp goes out,
`hours.set('night')`: `'It lies down. The lamp goes out. 3:07.'` (4 s);
meter 0; everything you placed stays. `wakes++`; `wakes ≥ 2` → the
evening's line adds `'Do one thing, and stand still, and then the next.'`

**The glass.** `whenSeen(mirror, { minTime: 0.5 })` at night while uncovered
→ the figure appears (it tracks you every frame while the conditions hold);
`flinch()`, `hush(2)`, subtitle `'In the glass, where you should be, something
stands a little too tall, with no face. You always kept it covered. You were
right to.'` (7 s). Covering it ends it for good.

**State machine.**

```
S0  night, in the stub. objective 'yours always last'
    through the panel → objective 'how she left it'
    first wind → objective 'how she left it, at another hour'
S1  the four: A chair to the desk · B sheet over the mirror · C music box wound · D note in the drawer
    the clock (night) → if !(A∧B∧C∧D): 'Not yet. It isn't how she left it.' (4 s); clockWrong++; ≥ 2 → 'Half past eight shows you how she left it.' (5 s)
                        else → STOP: 'tick' ×3; 'It stops. 3:07. It will be 3:07 for as long as anyone remembers.' (6 s); hours locked; objective 'out. shut the door.'
S2  the door (inside, after STOP) → opens ('door'); go out; the door (outside) → shuts ('door'); the hook → 'The little key. On its hook, where she kept it. You take it.' → giveItem { id: 'little-key', name: 'the little key' }
    the shut door with the key → 'lock'; 'Locked, from the other side. You never shut the door. Tonight you do, so that it goes the long way round, the way you did, and finds the same things.' (7 s); objective 'listen'
    → hush(1.5); then every 8 s 'hummed' {small, tune('EGAG')} at (2.1, 1.3, 0.9) (through the wall); cue 'humming, through the wall'
S3  knock spots: interact → your three knocks ('knock' {count: 3} at the spot)
      K3 → 0.8 s later 'knock' {count: 2, soft} from inside at (2.05, 1.3, 0.9); 'Two. Still there.' (4 s); 1.2 s later your two ('knock' {count: 2}); 'Still there. It will go on dreaming now.' (5 s); the humming stops; objective 'the last light'
      K1/K2 → silence 3 s, then the humming again: 'Nothing. The humming goes on, ' + directionWord + '.' (5 s)
S4  the switch → 1st: 'clunk'; the landing bulb off; dread 0.3; a soft 'hummed' {small, [E]} from the room; 'Dark. The whole house, dark, and something small in it. You know what that is like.' (6 s)
                 2nd: 'switch'; bulb on; dread 0; 'You leave it on. You know now why she did.' (5 s); objective 'bed'
    her door → if the bulb is off: 'Not in the dark. Not for them.'; else opens ('door')
    the bed → 'lie down': 'You lie down, the way she did, and the light stays on.' (4 s); after 2.2 s complete()
```

**debugSolve.**

```
interact backPanel → 0.4; teleport(−0.6, 1.0, π/2)       // in, facing the mirror wall → the glass; wait 0.8
interact clock → 1.9 (morning); interact box → 0.3; interact noteInBox → 0.3 → closeModal
interact clock → 1.9 (evening); interact clock → 1.9 (night)
interact chair → 0.2; wait 3.2; interact sheet → 0.2; interact mirror → 0.2; interact musicBox → 0.2; wait 3.2; interact drawer → 0.2
interact clock → 0.6                                       // STOP
interact door → 0.4; teleport(1.2, 2.5, π)                 // out
interact door → 0.3 (shut); interact hook → 0.2; interact door → 0.3 (lock); wait 1.8
interact K3 → 2.6
interact switch → 0.5; interact switch → 0.5
interact herDoor → 0.3; teleport(4.8, −1.2); interact bed; _waitFor(completed, 4)
```
(≈ 24 s.)

**Fairness.** The evening is the answer in three dimensions; the morning's
slip is the answer in words. The stir is visible (it turns over) and cued.
The clock says when it isn't ready and, after two tries, where to look. The
lock needs the key on the hook by her door, the only key on the landing.
The knocks are by ear with a direction word. The light says why.

---

## 6. Verification and acceptance

Per task, the plan gives exact commands. Globally:

1. `npm test` passes, including the new unit tests for `Hours`,
   `isSeenBy`, `footsteps`, `makeChild`, `makeClockFace` and the leaderboard
   contract at `MAX_LEVEL 20`.
2. `npx vite build` passes with no new warnings beyond the existing chunk
   size note.
3. `node tools/screenshot.mjs N --port 51NN` exits 0 for N = 16..20 and the
   four shots per room are composed, lit, textured and atmospheric. For
   these rooms also screenshot the other two hours: the plan adds an
   `--hour` flag to `tools/screenshot.mjs` that calls
   `window.__game.level.hours.set(hour)` and waits 2.5 s before shooting.
   No floating props, no black voids where a wall should be, no untextured
   surfaces, at any hour.
4. `node tools/playtest.mjs N --port 52NN` prints `SOLVED` for N = 16..20
   inside 45 s each.
5. `npm run playtest` prints `20/20 levels solvable` with zero browser
   errors — the gate before the branch is called done. Rooms I–XV must still
   solve after the engine changes (regression).
6. `npm run test:api` passes with rooms up to 20 accepted and 21 rejected.
7. Manual, with headphones: each room once through; the hour change blinks
   and arrives; XVI's switches wake the right rooms; XVII's rehearsal stops
   at the right thing; XVIII's torch beam is the thing you dodge and the
   near rule turns it; XIX's W keeps two flights and stops when you do;
   XX's glass shows the shape once and the light stays on. Captions add
   direction words to every cue.
8. Existing saves: a save with `completed: [1..15]` shows XVI unlocked; the
   menu subtitle reads "…· the five beneath · the five above"; the ending
   card says twenty rooms.

---

## 7. Decisions log

- Rooms go after XV, years after the true waking; the old epilogue becomes
  XVI's prologue. — owner, 2026-08-23 (arc A of three offered).
- The someone small is never identified. — owner.
- The game ends on the light (you leave it on and go to bed), with the new
  epilogue in §2.2. — owner.
- Spec + plan are handed to other build agents; rooms may be built in
  parallel after the engine tasks land. — owner.
- The hours cycle forward only (3:07 → 7:15 → 8:30 → 3:07), by hand, at a
  clock in every room; the swap happens under a blink. — proposed, accepted
  with the design.
- XVIII keeps a cheaper, sadder path (take the torch at the morning). —
  proposed, accepted with the design.
- The leaderboard cap goes to 20 as part of this work. — proposed, accepted.
