# HIRAETH — mobile touch play — design spec

Status: approved design, 2026-08-26. Decisions taken with the owner:

1. **Touching things:** both paths — the prompt word doubles as a button by
   the right thumb, and a tap that lands on the current gaze target also
   fires it (§3.4).
2. **Hurry:** pushing the drift stick to its rim hurries; no extra button
   (§3.2).
3. **Performance:** cap the renderer pixel ratio at 1.5 on touch devices;
   bloom defaults stay as they are (§6).
4. **Orientation:** rooms are landscape-only; portrait during play shows an
   in-voice rotate card and holds the room. The menu stays usable in
   portrait (§5).

Mock design (visual reference for the HUD layout this spec describes):
the "hiraeth in hand" artifact from the 2026-08-26 design session.

Companion documents: [`../../LEVEL_API.md`](../../LEVEL_API.md) (authoring
contract — unchanged by this spec), [`../../DESIGN.md`](../../DESIGN.md).
Read `src/core/Player.js`, `src/core/Interaction.js`, `src/core/UI.js`,
`src/main.js` and `src/style.css` before building; every change below is a
small opening in one of those seams.

---

## 0. Summary

Nothing about the rooms changes. Every input already flows through three
seams — `Player` (walk, look), `Interaction` (the gaze ray and its
trigger), and `UI` (notes, journal, keypad, pause). Mobile is a fourth way
of feeding those seams: a touch layer that turns thumb gestures into the
same calls the keyboard and mouse make, plus a HUD that speaks in gestures
instead of keys.

The controls stay in the game's voice: faint ivory, dotted circles, italic
lowercase words, and they fade toward invisibility when idle. No gamepad
chrome.

## 1. The contract

1. **No room file changes.** `src/levels/*.js` are not touched. The level
   authoring contract (`LEVEL_API.md`) is unchanged.
2. **Desktop is unchanged.** With a fine pointer and no touch, every added
   code path is inert: same pointer lock, same keys, same HUD, same pause
   behavior, same strings.
3. **Playtests are unchanged.** `__TEST_MODE__` never enters touch mode;
   `debugSolve()` and the screenshot tool see the game they saw before.
   The full gate stays 20/20.
4. **The touch layer is one module.** All gesture recognition lives in
   `src/core/TouchControls.js`; its pure math lives in
   `src/core/touchmath.js` (unit-tested with `node:test`). Other files
   only gain the small openings §4 lists.
5. **Times stay comparable.** The touch player walks and hurries at the
   same speeds through the same rooms; nothing in this spec changes the
   room timer's meaning. Portrait holds (§5.3) stop the timer the way
   pause does.

## 2. Touch mode

- **Detection.** `matchMedia('(pointer: coarse)').matches` at boot turns
  touch mode on. As a belt-and-braces path, a first `touchstart` on the
  canvas also turns it on (a coarse-pointer laptop that lied about its
  primary pointer). Once on, it stays on for the session. `__TEST_MODE__`
  forces it off.
- **What turns on:** the touch HUD (§3), touch listeners, the corner
  words, hint-text swaps (§3.6), fullscreen/orientation handling (§5),
  and the pixel-ratio cap (§6).
- **What turns off:** pointer lock. `player.requestLock()` no-ops in
  touch mode, `player.isLocked` reports true so nothing waits on it, and
  the pause-on-pointer-lock-loss handler in `main.js` never fires (no
  lock is ever taken). Pausing on mobile happens only through the
  *surface* word (§3.5).

## 3. The touch HUD

All controls live inside `#hud`, which stays `pointer-events: none`; the
individual controls opt in with `pointer-events: auto`. The canvas and hud
get `touch-action: none`, and the page gets `overscroll-behavior: none`
so the browser never scrolls, zooms or rubber-bands during play. The
viewport meta gains `viewport-fit=cover, maximum-scale=1,
user-scalable=no`; HUD corners pad by `env(safe-area-inset-*)`.

Screen zones: the left 45% of the screen births the drift stick; the rest
is the look zone. One stick touch and one look touch may be active at
once, tracked by touch identifier. When a modal is open or the player is
frozen, the touch layer ignores everything except the modal itself.

### 3.1 Drift stick (walk)

- Touch down in the left zone births the stick where the thumb lands: a
  dotted ring (radius 56 CSS px) with an ivory pebble that follows the
  thumb, clamped to the ring.
- The clamped offset divided by the ring radius is the move vector; a
  dead zone of 8 px ignores tremor. Up on the thumb's axis is forward
  *relative to the camera*, exactly like W.
- The vector feeds `player.setMoveInput(fwd, strafe, hurry)` every frame
  the touch lives; touch end (or `blur`/`visibilitychange`) zeroes it.
- The ring and pebble render at the ghost-faint opacity the key hints
  use, brightening slightly while active.

### 3.2 Hurry

Magnitude ≥ 0.95 sustained for more than 150 ms sets `hurry` (Shift's
run speed); it releases below 0.85 (hysteresis, so the rim doesn't
flicker). No button, no UI.

### 3.3 Look

A drag in the look zone turns the head: yaw −= dx · L · sensitivity,
pitch −= dy · L · sensitivity, with L = 0.0035 rad per CSS px (a tuning
constant in `touchmath.js`) and the same ±1.45 pitch clamp the mouse has.
The existing *look sensitivity* setting applies. Nothing is drawn in the
look zone.

### 3.4 Touching things

Two ways, both firing the same trigger E fires:

- **The word.** In touch mode the `#prompt` element ("take the brass
  key") renders as a pill — bordered, dark-backed — positioned above the
  right thumb's rest (right ≈ 9%, bottom ≈ 26%) instead of under the
  crosshair. It exists only while the gaze ray has a target, exactly as
  today, and tapping it triggers the interaction.
- **The thing.** A tap (touch shorter than 250 ms that moved less than
  12 px) in the look zone raycasts from the tap point; if it hits the
  *current gaze target* within that item's distance, it triggers. A tap
  that hits anything else does nothing — it was just a look that didn't
  move. Gaze targeting itself is unchanged (center ray, crosshair).

### 3.5 The corner words

Top-right, two quiet words in lozenges, ghost-faint until pressed,
hit targets at least 44 px tall:

- **remember** — toggles the journal (what J does).
- **surface** — opens the pause overlay (what pointer-lock loss does on
  desktop): freezes the player, stops the room timer, shows *you surface
  for a moment*. *sink back* resumes without requesting pointer lock.

### 3.6 Words that change in touch mode

Touch mode swaps these strings (desktop keeps its own):

| where | desktop | touch |
|---|---|---|
| `#hint-keys` | `WASD — walk · E — touch · J — remember · Esc — pause` | `left thumb — walk · right thumb — look · the word — touch` |
| note overlay hint | `E or click to put it down` | `touch to put it down` |
| journal hint | `J to close` | `touch outside to close` |
| keypad hint | `Esc to step away` | `touch outside to step away` |
| interlude | `press any key` | `touch anywhere` |

The hint line fades after ~26 s exactly as today. In touch mode the
journal and keypad overlays also close/cancel on a tap on the backdrop
(outside their paper/panel), matching their new hints; the note already
closes on any press. Interludes advance on `touchstart` as well as the
existing key/mouse listeners.

### 3.7 Small layout moves in touch mode

- `#items` (carried things) moves from the bottom-left corner — where the
  stick zone is — to bottom-center-left (left ≈ 28%), clear of both
  thumbs.
- `#objective` (top-left) and `#subtitle` (bottom-center) stay put; the
  subtitle's bottom offset rises slightly (to ~16%) so the hint line and
  pill never collide with it.
- The crosshair stays.

## 4. Where the code bends

- **`src/core/Player.js`** — gains `touchMode` (skips pointer lock as
  §2), `setMoveInput(fwd, strafe, hurry)` (merged with the key state:
  whichever source wants more movement wins; hurry is key-shift OR
  touch-hurry), and `addLook(dyaw, dpitch)` (applies the same clamps as
  the mousemove handler and respects `enabled`/`frozen`).
- **`src/core/Interaction.js`** — `_trigger()` becomes public
  `trigger()` (the old name may stay as an alias); gains
  `triggerFromPoint(ndcX, ndcY)` implementing §3.4's tap rule. The
  desktop mousedown listener keeps its pointer-lock guard.
- **`src/core/TouchControls.js`** *(new)* — owns all touch listeners and
  the touch HUD elements; translates gestures into the `Player`,
  `Interaction` and `UI` calls above. Constructed in `main.js` only when
  touch mode is on.
- **`src/core/touchmath.js`** *(new, pure)* — stick vector (dead zone,
  clamp, normalization), hurry hysteresis state machine, tap
  classification (duration + slop), look-delta scaling. No DOM, no
  three.js; `node:test` covered.
- **`src/core/UI.js`** — the string swaps and backdrop-close behavior of
  §3.6, driven by a `ui.touchMode` flag; journal/pause wiring for the
  corner words.
- **`src/main.js`** — detection (§2); constructs `TouchControls`; audio
  unlock listens for `touchstart` alongside mousedown/keydown; the
  begin-from-menu path requests fullscreen + orientation lock (§5); the
  rotate-card watcher (§5.3); corner-word handlers.
- **`src/core/Engine.js`** — pixel ratio cap (§6).
- **`index.html` / `src/style.css`** — the touch HUD markup and styles,
  viewport meta, safe-area padding, `touch-action`/`overscroll` rules.

## 5. Fullscreen and orientation

### 5.1 Entering a room

On *continue* / *begin again* / picking a room, in touch mode:
`document.documentElement.requestFullscreen({ navigationUI: 'hide' })`
then `screen.orientation.lock('landscape')`, each in a `.catch(() => {})`
— Android gets both, iPhone Safari gets neither and relies on §5.3.
Leaving to the menu exits fullscreen quietly (also caught).

### 5.2 The menu

The menu works in portrait and landscape untouched; it is already a
column layout. No rotate card at the menu.

### 5.3 The rotate card

A fixed overlay (below the fade, above the HUD) shown whenever touch
mode is on, a room is active (`playing || transitioning`), and
`(orientation: portrait)` matches:

> *the dream lies on its side*
> `turn your phone`

— title line italic ghost, second line small letterspaced ghost-faint,
on the menu's radial night background. While shown it freezes the player
and stops the room timer (like pause, without the pause overlay); on
rotation back it releases, unless a modal or real pause is open.

## 6. Performance

In touch mode the renderer pixel ratio is capped at 1.5 (desktop stays
at 2): `Math.min(window.devicePixelRatio, coarse ? 1.5 : 2)` where
`coarse` is the same media query, evaluated in `Engine`'s constructor.
Bloom and the grade pass are untouched; the existing *soft light*
settings toggle remains the escape hatch on weak devices.

## 7. Testing

1. **Pure math** — `tests/touchmath.test.mjs` (`node:test`): stick dead
   zone / clamp / normalization edges, hurry hysteresis timing, tap
   classification (fast-small = tap; long or travelled = not), look
   scaling and pitch clamp.
2. **Headless touch run** — `tools/touchtest.mjs`, run as
   `npm run test:touch`: Playwright-core Chromium with touch emulation
   (`hasTouch: true`, viewport 850×390, `isMobile`), pointing at the
   built game with `?level=1`. It asserts: touch mode activated (touch
   HUD present, no pointer-lock request), a synthetic stick drag moves
   the player, a synthetic look drag turns the camera, and tapping the
   word pill fires the interaction under the crosshair (walk to the
   Level 1 note, tap, expect the note overlay). Uses the same Chromium
   discovery as the existing harness.
3. **Regression gate** — the existing `npm run playtest` (20/20),
   `npm test`, `npm run test:api` all pass unchanged; a desktop
   (fine-pointer) run shows no touch HUD.

## 8. Out of scope

Portrait room play, gamepads, haptics, PWA/installability, cloud saves,
and any change to rooms, puzzles, audio, or the leaderboard contract.
