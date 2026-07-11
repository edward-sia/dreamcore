# HIRAETH — Level authoring contract

Read `src/levels/Level01.js` first; it is the canonical example of everything below.

## The game

First-person dreamcore puzzle game. Ten levels ("rooms"), each a distorted
memory: liminal, softly eerie, quietly sad — never horror, never jump-scares.
Nothing chases the player. The dread is ambient; the sadness is textual.
Visual style: realistic-leaning (PBR materials, fog, warm/cold light pools),
NOT cartoonish. Writing style: lowercase objectives, second person, restrained.

## File & class shape

Create exactly one file `src/levels/LevelNN.js` (two digits). It must
`export default class LevelNN extends LevelBase` with a `static meta`:

```js
static meta = {
  id: N,                    // level number, 1..10
  numeral: 'IV',            // roman numeral
  title: 'The Something',   // shown on the title card
  mood: 'pool',             // ambience key, see Audio below
  intro: 'One sentence whispered as the level fades in.',
  outro: 'Two or three lines shown after completion.\nSad, restrained.',
};
```

Levels are auto-discovered by filename — never edit `src/levels/index.js`
or any shared file. Import only from `three`, `../core/LevelBase.js`,
`../core/textures.js`, `../core/props.js`.

## Lifecycle

- `build()` — required. Construct everything, register everything, set spawn.
- `onUpdate(dt, t)` — optional per-frame hook (already wired; just define it).
- `debugSolve()` — REQUIRED, async. See Playtest below.
- Never override `init/update/dispose`.

## Geometry & collision

- Add visible objects with `this.add(obj)`.
- Walls/furniture that should block: `this.addCollider(mesh)` (AABB of the
  object at its CURRENT world position — position it first). Low obstacles
  (< 0.55 m) are stepped over automatically; openings taller than head height
  are walked under.
- Invisible blockers: `this.addBlocker([minX,minY,minZ],[maxX,maxY,maxZ])`.
- Every walkable surface needs `this.addGround(mesh)` — the player raycasts
  down onto grounds. A flat `PlaneGeometry` floor (rotation.x = -PI/2) is the
  usual case. Without a registered ground the player falls forever.
- `this.bounds = new THREE.Box3(min, max)` clamps roaming (optional).
- `this.spawn.position.set(x, 0, z)` (y = floor height) and `this.spawn.yaw`
  (radians; yaw 0 faces −Z, positive turns left).
- `this.removeColliderOf(mesh)` removes the collider nearest that mesh
  (e.g. an opened door panel).

## Interaction

```js
this.interact(object3d, {
  prompt: 'read the label',        // shown when looked at (≤ 3 m)
  onInteract: (obj) => { ... },
  once: true,                      // optional: disable after first use
  distance: 2.5,                   // optional custom reach
});
this.game.interaction.remove(obj); // unregister
this.game.interaction.setEnabled(obj, false); // temporarily disable
```

## Narrative & puzzle plumbing

- `this.setObjective('lowercase goal text')` — top-left hint. Update as the
  puzzle progresses. Objectives point at feelings and places, not mechanics.
- `this.subtitle('A thought.', seconds)` — inner monologue, italic serif.
- `this.giveNote({id, title, body})` — paper overlay + journal entry (clues
  the player picks up and keeps). Body supports `\n`.
- `this.learnClue({id, title, body})` — journal-only (something seen).
- `this.giveItem({id, name})` / `this.hasItem(id)` / `this.removeItem(id)` —
  inventory chips; names are lowercase, evocative: `'a brass key, still warm'`.
- Keypad/combination UI:
  `this.game.ui.showKeypad({label, length: 4, keys: '1234567890', onSubmit(code), onCancel()})`.
- `this.complete()` — call exactly ONCE when solved. Usually gated on walking
  through a final door/threshold via `this.tick(() => ...)` checking
  `this.game.player.position`.
- `this.after(seconds, fn)` — timeout tied to level lifetime.
- `this.tick(fn)` — per-frame callback `(dt, t)`.
- `this.track(obj)` — register a prop that has `.update(dt, t)` (doors,
  water, valves, dust, fluorescents).

## Textures & materials (`../core/textures.js`)

`makeMat(kind, opts)` → MeshStandardMaterial with generated map + bump.
Kinds: `concrete plaster wallpaper wood tile checker carpet grass ceiling asphalt`.
Common opts: `{ base: '#hex', repeat: [u, v], roughness, bumpScale }`.
Repeat should match world size (≈ 1 repeat per 1–2 m) or textures smear.
Also: `textTexture({text, font, color, bg, width, height})` for canvas text,
`noiseMap()` for bump/roughness, `skyGradientTexture()`.

## Props (`../core/props.js`)

- `applyFog(scene, '#color', near, far)` — REQUIRED; also sets background.
  Fog color must match the horizon or the scene looks cut out.
- `makeSky({top, mid, bottom, sun: {position, color, size}})` — outdoor dome
  (`this.add(...)`; it ignores fog). Indoors: skip sky, keep fog close.
- `makeDoor({width, height, color})` → door group; `door.setOpen(true, ±1)`,
  `door.panel` for colliders; `this.track(door)` to animate.
- `makeWall(w, h, d, material)` — shadowed box.
- `makeBulbLight({color, intensity, distance, y})` — hanging warm bulb (`.light`).
- `makeFluorescent({length, flicker: 0..1})` — humming office light; track it.
- `makeNoteProp()`, `makeKeyProp()`, `makeValve()`, `makeSign({text, width, height, bg, color})`,
  `makePictureFrame({texture})`, `makeTable/makeChair/makeShelf/makeBench`,
  `makeWater({width, depth, color})` (track it), `makeDust({count, box, center})` (track it).
- Build level-specific props from three.js primitives + these materials.

## Lighting rules

- 1 dim `HemisphereLight` (0.3–0.6) + a handful of point lights max.
- At most 1–2 shadow-casting lights (`light.castShadow = true`).
- Meshes that matter: `castShadow = receiveShadow = true` (props helpers
  mostly do this already).
- Darkness is atmosphere; don't over-light. Let fog eat the distance.

## Audio

`mood` keys: `hallway pool dusk store home field train theater archive shore`.
SFX via `this.playSound(name)`:
`step paper pickup clue unlock locked wrong switch door splash complete tone`
(`tone` takes `{freq, gain, decay}` — use for musical puzzle feedback).

## Playtest hook — debugSolve() (required, enforced by CI)

Async method that solves the level exactly the way a player would, through
the real handlers:

- `this.debugInteract(objRegisteredWithInteract)` — triggers its onInteract.
- `this.game.ui.closeModal()` — closes an open note/journal/keypad.
- `this.game.ui.submitKeypad('1937')` — enters a code (keypad must be open).
- `this.game.player.teleport(x, z)` — for walk-through-threshold checks.
- `await this.debugWait(0.4)` between steps for animations/ticks.

It must end with `this.complete()` having fired (the tick that checks the
threshold counts — teleport past it and wait). Test with:
`node tools/playtest.mjs N --port 52NN`.

## Verify loop (do this before you're done)

1. `npx vite build` — must pass.
2. `node tools/screenshot.mjs N --port 51NN` — must exit 0 (no console
   errors), then LOOK at `shots/levelNN-*.png` and iterate until the scene
   is composed, lit, and atmospheric. Floating props, black voids behind
   walls, unlit rooms and untextured surfaces are failures.
3. `node tools/playtest.mjs N --port 52NN` — must print SOLVED.

## Difficulty ladder

Level N should take roughly N minutes. 1–3: single clue → single lock.
4–6: several clues that must be combined; wrong answers cost a little time.
7–9: multi-stage, cross-referenced clues, spatial reasoning. 10: three acts
recombining earlier mechanics. Puzzles must always be solvable from clues
present in the level — no pixel hunts, no trial-and-error-only gates. On a
wrong attempt play `'wrong'` and give a gentle subtitle nudge.
