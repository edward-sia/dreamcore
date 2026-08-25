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
Five more follow after a false wake — see Phases 5–7 (XI–XV), below —
and five after those, years later, on the other side of every door:
Phases 8–10 (XVI–XX).

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
| 11 | XI | The Bedroom | `night` | 5 |
| 12 | XII | The Stairwell | `stairwell` | 5 |
| 13 | XIII | The School | `school` | 6 |
| 14 | XIV | The Playground | `playground` | 6 |
| 15 | XV | Under the House | `under` | 7 |
| 16 | XVI | The Kitchen | `night` | 8 |
| 17 | XVII | The Hall | `night` | 8 |
| 18 | XVIII | The Sitting Room | `night` | 9 |
| 19 | XIX | The Stairs | `stairwell` | 9 |
| 20 | XX | The Room | `night` | 10 |

Phases group rooms by puzzle grammar, per the difficulty ladder:

- **Phase 2 — notice (II–IV):** one or two clues, one lock. The player
  learns to read rooms.
- **Phase 3 — combine (V–VII):** several clues that must be put
  together; wrong answers cost a little time and earn a gentle nudge.
- **Phase 4 — remember (VIII–X):** multi-stage chains, cross-referenced
  clues, and a finale that recombines the mechanics of everything
  before it.
- **Phases 5–7 — doubt (XI–XV):** the room misleads you; listening is a
  mechanic. Full design: `docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md`.
- **Phases 8–10 — leave (XVI–XX):** the room exists at three hours and you
  are on her side of it; you make the clue and the child's dream tests it.
  Full design: `docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md`.

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
- **3:07** — the bedroom clock. It never changes.
- **Knocks:** two = "still there" · three = "come and find me". (XI
  teaches it; XIV and XV pay it off.)
- **XII:** the stairs repeat −1, −2, −3. Chalk on the −2 landing: a
  tally, and "wait for me".
- **XIII:** your peg and locker are **12**. The tune is **E G A G E G
  E**; the board holds the first five, the tannoy chime is the last two
  (**G, E**).
- **XIV:** the hiding order is **the pipe → behind the shed → behind
  the shelter**.
- **XV:** V's evening order — **kitchen → hall → sitting room → your
  room** — flipped by ear. The box from IX gives up a photograph, the
  ribbon from VI, and the brass key from I, **warm again**.
- **Humming.** I and III mention "the song your mother hummed". It is
  this tune. It is heard, hummed, twice: faintly behind the bedroom
  door (XI) and from the doorway of light at the very end (XV).
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

**Difficulty note: from here on the puzzles are tuned for adults —
clues are indirect, and mapping them onto the world is the work.**

- The house is unlit; the fuse box in the kitchen has five labelled
  switches: kitchen, hall, sitting room, your room — and porch, which
  only ever answers with a dead click (the porch light died in III;
  players who notice will smile).
- M.'s note by the fuse box's pilot light does NOT name an order. It
  remembers an evening: "supper before slippers. slippers before the
  wireless. and yours always last, so the dark never caught you."
  The player must map supper → kitchen, slippers → the hall mat,
  the wireless → the sitting room radio; each association is
  physically present in its room (a burnt pan, slippers by the door,
  a humming radio set) for anyone who walks the dark house first.
- Flip the four live switches in that order; each lights its room in
  turn (the payoff is the house coming on room by room). A wrong order
  clicks everything back off: `wrong` + "that was not how the evening
  went." The porch switch never counts as wrong — it is simply dead.
- Only in the LIT kitchen does the small key on the table become
  findable (visible + interactable once powered); it opens the door at
  the top of the stairs. Light spills under it. Threshold completes.

### VI — The Field (`field`)

The field behind the last houses, at night. Grass to the knees, one
dead tree, a fence line running the far edge, a rusted bathtub the
horses drank from, wind. Fireflies. ~6 minutes.

- The scarecrow wears M.'s note in its coat pocket — a rhyme you two
  buried treasure by: "from the tree that died the summer you were
  eight, / toward the star that fell, / past where the horses drank, /
  then thirteen posts along the wire, / and look down."
- Executing it is the puzzle: sight the low horizon glow (the fallen
  star) from the dead tree, pass the bathtub, reach the fence, then
  COUNT thirteen fence posts along it. At the thirteenth post's foot
  is a bare mound. Nothing marks it but the counting.
- Decoys cost time, gently: two or three other bare patches in the
  field can be dug — "only earth, and the smell of rain" — and digging
  at the wrong post says "you counted wrong, or the field did."
- Dig at the right mound → a rusted tin → inside, a small key and a
  ribbon (keep the ribbon as flavour: "hers").
- The key opens the padlocked gate in the fence. "the gate never kept
  anything in." Walk through into the dark — threshold completes.

### VII — The Platform (`train`)

A rural station at night, fog swallowing the tracks both ways.
Departures board, shuttered ticket office, waiting room, underpass.
~7 minutes. Multi-stage.

1. In the waiting room, a torn ticket: time smudged to **23:4—**,
   destination smudged to **H——**, but **carriage 3, seat 41** legible
   — plus decoy numbers that fit a keypad just as well (ticket
   No. 1147, fare 2.35). The departures board lists five trains
   (23:12 ASHFELD · 23:31 HOLLOW BECK · 23:47 HARBECK · 23:58
   ASHFELD · 00:06 MOORCROFT), platforms 1 and 2 mixed. Only ONE
   departure matches both fragments — 23:4— **and** H—— → the 23:47
   HARBECK, platform 2. (23:31 HOLLOW BECK matches the H but not the
   time; 23:58 matches neither; the board says so to whoever reads
   carefully.)
2. The underpass to platform 2 is gated, keypad labelled only
   "staff gate". A weathered staff notice inside the waiting room:
   "gate code is carriage then seat of the last service you rode."
   The stub IS the last service → **341**. Wrong (e.g. 147 or 235 from
   the decoys): `wrong` + "that number never mattered."
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
   auditorium the row-end letter plates are mostly worn blank — only
   A, C, E and H survive — so finding F means counting the dark rows
   between E and H. Under F8's cushion, a key tagged "relief
   projectionist" opens the booth.
2. The lobby holds several posters with years (decoys: *Harvest
   Moon* 1962 · *The Tin Orchard* 1968 · *The Long Summer* 1974 ·
   *Winter Sisters* 1981), but only one is "the film you can't
   remember": the stub's torn edge carries the tail of its title
   ("—g summer"). In the booth, canisters are labelled by year only.
   Mounting the wrong reel: grey leader rattles through, `wrong` +
   "that wasn't the summer." Mounting **1974** starts the projector.
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
  facts in **Canon**). But the archive is imperfect: at least two
  cards are MISFILED (the pool's card rests in the theater's box, and
  vice versa — the filer was tired), some boxes sit on the high shelf
  (ladder), and one card has slipped behind the shelving (visible
  through a gap; retrieved at floor level nearby). Reading only the
  boxes you "need" is not enough; the room rewards reading everything.
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
   the level. It no longer ends the game — see **Rooms XI–XV**, below.

## Rooms XI–XV — the five beneath

A false awakening after the Shore. Bedroom (3:07, the knock code),
Stairwell (the loop; stand still), School (the plates lie; play the
tune), Playground (hide so it can come), Under the House (the evening
order by ear; the box; the meeting). Every layout, puzzle, text and cue
is in the spec above; the same production notes apply (one file per
room, ports 51NN/52NN, full-suite gate 15/15).

## Rooms XVI–XX — the five above

Years after the true waking the house comes back for someone small asleep
upstairs, and you are on M.'s side of every door. Kitchen (the hours; the
fuses), Hall (I's corridor; the rehearsal), Sitting Room (the wireless; the
child with the torch), the Stairs (the filing; XII's shaft with the roles
swapped), the Room (XI set as she left it; the glass; the last light). Every
layout, hour, puzzle, text and cue is in the spec above; the same
production notes apply (one file per room, ports 51NN/52NN, full-suite gate
20/20).

## Production notes

- One file per room: `src/levels/LevelNN.js`, auto-discovered. Never
  touch shared files.
- Verify loop per room, per `LEVEL_API.md`: `npx vite build` →
  `node tools/screenshot.mjs N --port 51NN` (look at the four shots,
  iterate until composed and atmospheric) →
  `node tools/playtest.mjs N --port 52NN` until SOLVED. For rooms XVI–XX
  also screenshot the other two hours with `--hour morning` and
  `--hour evening`.
- Ports are per-room (51NN / 52NN) so rooms can be verified in
  parallel.
- Phase gate: after each phase, the full suite (`npm run playtest`)
  must pass 20/20 (or all-shipped/all-shipped) before the next phase
  begins.
