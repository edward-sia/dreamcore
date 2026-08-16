# HIRAETH

*a dream in ten rooms*

A first-person dreamcore puzzle game. You drift through ten half-remembered
places — a corridor that grew too long, a pool under the house, a supermarket
an hour after closing — looking for the clues each room hides, unlocking your
way deeper toward waking. Slightly eerie, slightly sad. Nothing here will
hurt you.

> **hiraeth** *(Welsh)* — homesickness for a home you cannot return to,
> or that never was.

![screenshot](docs/screenshot.png)

## Play

```bash
npm install
npm run dev        # then open the printed URL
```

Headphones recommended. Progress saves automatically (localStorage).

| key | |
|---|---|
| WASD / arrows | walk |
| mouse | look |
| shift | hurry (you won't want to) |
| E / click | touch, read, take |
| J | journal — everything you've remembered so far |
| esc | pause / put things down |

## The ten rooms

Each room is a puzzle that gets a little harder than the last: find the
clues, work out what they mean, unlock the way onward. Early rooms ask you
to notice; later rooms ask you to cross-reference, deduce, and remember the
rooms that came before.

## The dreamers — leaderboard

The game times every room (active play only — pausing stops the clock) and
keeps your best per room. The **dreamers** entry in the menu is the
leaderboard: everyone ranked by **rooms completed**, ties broken by **total
time across those rooms**, plus a *room by room* view of the single fastest
crossing of each room. Choose a name there to join — until you do, nothing
leaves your browser, and offline copies simply show your own times.

Scores are held by a tiny zero-dependency server (`server/server.mjs`) that
can also host the game itself:

```bash
npm run build && npm start   # game + leaderboard on http://localhost:8091
```

In dev (`npm run dev`), the vite proxy forwards `/api` to that server if
it's running.

## Hosting

A ready-made **GitHub Pages** workflow ships in
[`docs/workflows/deploy.yml`](docs/workflows/deploy.yml) — move it to
`.github/workflows/` once (automation isn't allowed to install workflows)
and every push to `main` deploys the game. For a live leaderboard, run the
server anywhere Node 18+ or Docker runs and point the Pages build at it
with one repo variable. All three setups are described in
[`docs/HOSTING.md`](docs/HOSTING.md).

## Technical notes

- **Everything is procedural.** No binary assets: textures are generated on
  canvas (wallpaper, pool tile, wood grain, grass), audio is synthesized
  WebAudio (drones, drips, chimes, footsteps), geometry is built from
  primitives. The repo is code all the way down.
- **Stack:** [Three.js](https://threejs.org) + Vite, vanilla JS. ACES
  tonemapping, soft shadows, bloom, and a film-grade post pass (grain,
  vignette, faded lift) do the dreamcore heavy lifting.
- **Engine:** `src/core/` — first-person controller with pointer lock and
  AABB collision, raycast interaction, notes/journal/keypad UI, ambience
  engine, save system.
- **Levels:** `src/levels/Level01.js … Level10.js`, auto-discovered. The
  authoring contract lives in [`docs/LEVEL_API.md`](docs/LEVEL_API.md);
  the room-by-room design bible (all puzzles spoiled) is
  [`docs/DESIGN.md`](docs/DESIGN.md).

## Testing

Levels are verified headless (Chromium + software WebGL):

```bash
npm run shot -- 3          # screenshot level 3 from four angles → shots/
npm run playtest           # prove every level is solvable end-to-end
npm run playtest -- 7      # just level 7
npm run test:api           # leaderboard server contract tests
```

Every level implements `debugSolve()`, which plays the level through its
real interaction handlers — the playtest fails if a puzzle can't actually
be completed.

## Build

```bash
npm run build              # static site in dist/, host anywhere
npm start                  # serve dist/ + leaderboard API from one process
```
