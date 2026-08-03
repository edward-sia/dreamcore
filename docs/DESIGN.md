# HIRAETH — design bible for rooms II–X

> **Spoilers.** This file specifies every puzzle and code in the game.
> Players should close it now. (The codes are in the source anyway; the
> repo is code all the way down. But still.)

Room I (The Hallway) shipped with the engine. This document plans the
remaining nine rooms and the order they are built in. The authoring
contract every room must obey is [`LEVEL_API.md`](LEVEL_API.md); the
canonical implementation example is `src/levels/Level01.js`.

## The arc

Ten half-remembered places, one per ambience mood, difficulty rising
roughly one minute per room. The dream starts indoors and close
(hallway, pool), breathes outward (street, field), passes through
in-between places (supermarket, platform, theater), turns inward to
memory itself (house, archive), and ends at the edge of waking (shore).

| # | numeral | title | mood | phase |
|---|---|---|---|---|
| 1 | I | The Hallway | `hallway` | shipped |
| 2 | II | The Pool | `pool` | 2 |
| 3 | III | The Street | `dusk` | 2 |
| 4 | IV | The Supermarket | `store` | 2 |
| 5 | V | The House | `home` | 3 |
| 6 | VI | The Field | `field` | 3 |
| 7 | VII | The Platform | `train` | 3 |
| 8 | VIII | The Theater | `theater` | 4 |
| 9 | IX | The Archive | `archive` | 4 |
| 10 | X | The Shore | `shore` | 4 |

Phases group rooms by puzzle grammar, per the difficulty ladder:

- **Phase 2 — notice (II–IV):** one or two clues, one lock. The player
  learns to read rooms.
- **Phase 3 — combine (V–VII):** several clues that must be put
  together; wrong answers cost a little time and earn a gentle nudge.
- **Phase 4 — remember (VIII–X):** multi-stage chains, cross-referenced
  clues, and a finale that recombines the mechanics of everything
  before it.

## Canon — facts more than one room depends on

These numbers and motifs are load-bearing. Rooms must not contradict
them; room IX quotes four of them back.

- **M.** signs every note. She is never named. Second person, lowercase,
  restrained. Nothing in the dream will hurt the player.
- **Sundays** are when things were watered, bought, visited.
- **Warmth** is presence: the brass key in I is "still warm." When
  something is cold, someone is gone.
- **I:** hallway doors are numbered 203–212; the spare key waited where
  the flowers used to be.
- **II:** the pool's depth markers read **1**, **2**, **4** — the deep
  end is **4**.
- **IV:** M.'s list, in order: milk, bread, apples, sunflowers. Aisles:
  milk **3**, bread **1**, apples **4**, sunflowers **2** → office door
  code **3142**. The sunflowers were for Sunday.
- **VII:** the ticket is for the **23:47**, **carriage 3, seat 41** →
  underpass gate code **341**. The destination is smudged; it began
  with an H.
- **VIII:** the ticket stub is **row F, seat 8**; the film is *The Long
  Summer*, **1974**.
- **IX:** the vault code is assembled from four earlier facts:
  deep end **4** · sunflower aisle **2** · carriage **3** · row F
  counted on your fingers **6** → **4236**.
- **X:** three tokens come home: a brass key (I, cold now), a tile from
  the deep end (II), a ticket stub (VIII).

## The rooms

### II — The Pool (`pool`)

The pool under the house. Tiled walls sweating, water half-drained,
one row of lights out. ~2 minutes.

- The far door is chained; its padlock takes a 3-digit code.
- Depth markers are painted on the pool wall: 1 and 2 legible, the deep
  end's marker drowned below the waterline.
- A note on the lifeguard's chair (M.: nobody ever watched you swim but
  her) points at the filter room; the valve there drains the pool —
  the water sinks (animate the `makeWater` mesh down), the deep-end
  marker **4** surfaces.
- Code **124**, shallow to deep. Wrong entry: `wrong` + "shallow end
  first. you always started at the shallow end."

### III — The Street (`dusk`)

The cul-de-sac at the hour the streetlights come on. Outdoor: `makeSky`
with a low dropped sun, asphalt, lawns, four near-identical house
facades. ~3 minutes.

- House numbers 7, 9, 11, 13. Three streetlamps hum on; the one outside
  your house refuses (dark or dying flicker — it marks the target).
- Wrong front doors are locked, each with one line of flavour (a
  television, a bath running, someone humming).
- The mailbox of the dark-lamp house holds M.'s note: the key is under
  the stone that doesn't match. The path has a run of stones, one
  paler; under it, the house key.
- Unlock the door, step into the dark hall — threshold completes.

### IV — The Supermarket (`store`)

An hour after closing. Fluorescents (one flickering), five aisles of
shelves, freezers still humming, checkout lane 3 lit. ~4 minutes.

- M.'s shopping list is at a checkout: milk, bread, apples, sunflowers
  — "for Sunday. don't forget again."
- Each item stands somewhere in aisles 1–4 under hanging aisle signs;
  finding each one interacts to a journal clue holding its aisle
  number.
- The staff/office door keypad takes the aisle numbers **in list
  order**: 3142. Wrong: `wrong` + "the list knows the order."
- Through the office (a desk, a cold cup of coffee, a rota with every
  shift crossed out) to the delivery door — threshold completes.

### V — The House (`home`)

The house itself, rebuilt: dark hallway, sitting room, kitchen. Rain
against the windows, a stopped clock. ~5 minutes.

- The house is unlit; the fuse box in the kitchen has four labelled
  switches (kitchen, hall, sitting room, your room).
- M.'s note (visible by the fuse box's pilot light): she turned the
  lights on the same way every evening — kitchen first, then the hall,
  then the sitting room, and yours last, so you'd come down to a house
  already warm.
- Flip the switches in that order; each one lights its room in turn
  (the payoff is watching the house come on room by room). A wrong
  order clicks everything off again: `wrong` + a nudge.
- The lit kitchen reveals a small key on the table; it opens the door
  at the top of the stairs. Light spills under it. Threshold completes.

### VI — The Field (`field`)

The field behind the last houses, at night. Grass to the knees, one
dead tree, a fence line, wind. Fireflies. ~6 minutes.

- A scarecrow wears M.'s note in its coat pocket: the tin was buried
  "past the tree, toward the fallen star, where the grass gives up."
- A low glow sits on the horizon (the fallen star). Walking the line
  from the dead tree toward it finds a bare mound (a subtle circle of
  dirt among grass; fireflies cluster over it).
- Dig (interact) → a rusted tin → inside, a small key and a ribbon.
- The key opens the padlocked gate in the fence. "the gate never kept
  anything in." Walk through into the dark — threshold completes.

### VII — The Platform (`train`)

A rural station at night, fog swallowing the tracks both ways.
Departures board, shuttered ticket office, waiting room, underpass.
~7 minutes. Multi-stage.

1. In the waiting room, a torn ticket: the **23:47**, destination
   smudged ("H——"), carriage 3, seat 41. The departures board lists
   four trains — three DELAYED, the 23:47 marked platform 2.
2. The underpass to platform 2 is gated; its keypad takes carriage +
   seat: **341**. Wrong: `wrong` + "carriage, then seat. you memorised
   it so you wouldn't have to look."
3. On platform 2, wait at the marked line. The rails begin to sing, a
   light grows in the fog, and the train passes without stopping — a
   wall of light and rumble and wind. When it has gone, the board
   flips: CANCELLED, CANCELLED, CANCELLED, and the exit gate at the
   platform's far end stands open. Walking through completes.

### VIII — The Theater (`theater`)

The cinema where you saw the film you can't remember. Lobby with
poster frames, dark auditorium, projection booth. ~8 minutes.
Multi-stage.

1. The ticket booth holds a stub: **row F, seat 8**. In the
   auditorium, rows A–H of seats; finding F8 (letters on row-ends)
   yields the booth key left on the cushion.
2. The lobby poster: *The Long Summer* — **1974** — "one week only."
   In the booth, film canisters are labelled by year (1962, 1968,
   1974, 1981); mounting the wrong one: `wrong` + "that wasn't the
   summer." Mounting 1974 starts the projector.
3. The screen fills with silver light (emissive plane brightens; the
   auditorium warms). The fire-exit door beside the screen — locked
   until now — clicks open. Walking into the light behind it completes.

### IX — The Archive (`archive`)

A records basement that has been keeping files on the dream itself.
Shelves of boxes, a card catalogue, one green reading lamp. ~9
minutes. The cross-reference summit.

- Eight boxes, labelled: the hallway, the pool, the street, the
  supermarket, the house, the field, the platform, the theater. Each
  holds an index card — a short sad memory plus one hard fact (the
  facts in **Canon**). Some boxes are misfiled or on the high shelf
  (ladder), one card has slipped behind the shelving (visible through
  a gap; retrieved at floor level nearby).
- On the reading table, the master card:
  "what the records agree on — / how deep the water finally went /
  the aisle that faced the sun / the carriage you always chose /
  your row, counted on your fingers."
- The vault door keypad: **4236**. Wrong: `wrong` + "the records
  don't lie. read them again."
- Through the vault: a small bare room containing a single cardboard
  box marked with your name, and the exit. Threshold completes.

### X — The Shore (`shore`)

First light on a grey beach. The sea. Half-buried in the sand,
impossible things: a stretch of hallway wallpaper, a pool ladder, two
theater seats. ~10 minutes. Three acts, recombining earlier
mechanics.

1. **find** — three relics among the wreckage, each behind its old
   mechanic: the hallway fragment (read the note pinned where the
   flowers used to be → take **a brass key, cold now**); the pool
   ladder (turn a small valve half-buried beside it, sand slides →
   **a tile from the deep end**); the theater seats (check the seat
   the stub named → **a ticket for a film you can't remember**).
2. **return** — a door stands alone in the sand, no wall around it,
   with three worn hollows at its threshold stone. Placing each token
   (interact three times) settles it into its hollow. When all three
   are home, the door swings open by itself onto the sea-light.
3. **wake** — through the door, the beach continues but brighter; the
   fog lifts as you walk the last stretch to the waterline while
   subtitles let go, one line at a time. Reaching the water completes
   the level — and the game (the epilogue in `levels/index.js` plays).

## Production notes

- One file per room: `src/levels/LevelNN.js`, auto-discovered. Never
  touch shared files.
- Verify loop per room, per `LEVEL_API.md`: `npx vite build` →
  `node tools/screenshot.mjs N --port 51NN` (look at the four shots,
  iterate until composed and atmospheric) →
  `node tools/playtest.mjs N --port 52NN` until SOLVED.
- Ports are per-room (51NN / 52NN) so rooms can be verified in
  parallel.
- Phase gate: after each phase, the full suite (`npm run playtest`)
  must pass 10/10 (or all-shipped/all-shipped) before the next phase
  begins.
