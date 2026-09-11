# Level review — 11 September 2026

All 20 rooms were checked against their puzzle handlers and rendered from
four angles. Rooms XVI–XX were also rendered at morning and evening;
additional views cover the landing in XIX and the bedroom in XX. The
existing solver passed 20/20 before changes. The findings below concern
things that a direct-handler solver does not necessarily catch.

## Shared fixes

- **Inputs:** E no longer closes and reopens the same note on one keypress.
  Held E cannot repeatedly trigger objects. Overlays, menus, pause, and
  portrait hold prevent gameplay interaction.
- **Aiming:** authored ranges above three metres now work. Hidden children
  and objects inside hidden hour groups cannot become gaze/touch targets.
  A changing interaction label refreshes without having to look away.
- **Text:** old subtitle fade callbacks cannot hide a new clue. Objective
  updates cancel stale pending updates. Sound captions have their own space
  and cannot replace narrative text. Long notes and keypads scroll within
  the viewport; the room menu can scroll at desktop heights too.
- **Keypads/piano:** backspace during the confirmation delay cancels the old
  submission. A successful entry calls submit without also calling cancel.
  Empty keypads show the number of slots. Replacing an open keypad preserves
  the new handler.
- **Timing:** room callbacks use active room time, stop behind overlays,
  and are explicitly cancellable. Pause, portrait, and reading no longer
  advance a hidden puzzle. Tutorial controls start fading after entering
  a room rather than while the opening menu/prologue is still showing.
- **Graphics:** dust uses soft circular sprites rather than visible squares;
  its drift is scaled by elapsed time. The vignette uses a defined ascending
  smoothstep interval for consistent shader behavior.
- **Test reliability:** the touch walking check now holds for rendered frames.
  Its fixed 900 ms hold could fail on a busy software GPU even with working
  movement, because the game clamps simulation time per frame.

## Room findings

| Room | Findings and resolution |
| --- | --- |
| I — Hallway | The tutorial note was inside the tabletop. Raised it above the surface. Rereading it no longer sends a player holding the key back to the key objective. |
| II — Pool | Transparent water exposed the hidden 4 before draining. Deep markers now appear as the water falls below them. Hung the chair note facing the walkway instead of above the player's eyes on the high seat. Added “shallow to deep” to the revealed-padlock objective; rereading the note does not undo progress. |
| III — Street | Lifting the stone could still tell the player to find the stone. It now says to take the exposed key. The mailbox no longer overwrites the objective after taking the key or unlocking the house. House-number/lamp/key sequence checked. |
| IV — Supermarket | A delayed list hint could overwrite the objective after opening the staff door. It is now guarded. Replaced the inaccurate “first try” success line, which also appeared after wrong guesses. List/aisle order and both exits checked. |
| V — House | Taking the key after only the kitchen switch bypassed the rest of the evening sequence. The upstairs door now requires the full sequence and gives a specific reminder if the key is taken early. Correct-order solve and early-key rejection checked. |
| VI — Field | Clarified that the first fence post beyond the stile counts as one. Rereading the rhyme preserves later objectives. Landmarks, decoy mounds, key, and gate checked. |
| VII — Platform | The departures board's four-metre interaction range was silently capped at three; fixed in shared targeting. Follow-up mouse-look review reproduced flickering blocks around the board: its frame front and station wall were both at z=4.7. Moved the complete casing ahead of the wall and kept the display ahead of the casing. Added `test:platform` for depth separation, moving-camera captures, and real E interaction. Ticket/staff notice, underpass code, train arrival, and exit checked. |
| VIII — Theater | Rereading the stub after finding the booth key reset the objective to the seat; guarded it. Seat F8, film-year clue, reel selection, and fire exit checked. |
| IX — Archive | The rolling ladder left an invisible collision at its original location. Its collision now moves with it. The slipped card's extended viewing range now works. Misfiled cards, high shelves, and vault checked. |
| X — Shore | Looking sideways/back exposed the edge of the sand plane. Extended sand and sea beyond the visible fog while preserving the shoreline and playable bounds. Converted mound/fog animation from per-frame increments to elapsed-time changes. Relics, placement, and waterline finish checked. |
| XI — Bedroom | Knock callbacks now stop while paused or reading the note; cancellation uses room timer handles. Separate captions preserve spoken hints. Three response rounds and wardrobe exit checked. |
| XII — Stairwell | Shared pause/overlay gating prevents progression while the player is away. Stillness/approach/exit solver checked; no additional room-specific defect confirmed. |
| XIII — School | The seven-note piano benefits from reliable keyboard correction and submit behavior. Written tune/chime redundancy, locker key, hall piano, and exit checked; no additional room-specific defect confirmed. |
| XIV — Playground | Hiding/figure progression stops behind overlays through shared gating. Rhyme, three hiding places, approach/follow sequence, and exit checked; no additional room-specific defect confirmed. |
| XV — Under the House | Evening sounds and delayed cues now use cancellable room timers. Shared pause and independent captions protect the listening/stillness sequences. Fuses, loop, box revelations, and final threshold checked. |
| XVI — Kitchen | Clock/door ranges above three metres now work. Clock prompt names the action and its first turn records the three-hour rules. Hidden hour groups cannot receive gaze interaction. Plate identification, pan/key placement, and hall exit checked. |
| XVII — Hall | Added discoverable clock action and journal rules. Rehearsal footsteps/delays stop behind pause and overlays. Slippers, note/key placement, rehearsal, and exit checked. |
| XVIII — Sitting Room | The incorrect hint said 247 was “past the middle” of a 200–550 dial. It now points to the label in her evening. Added clock rules and updated hour-specific timer cancellation. Radio, distractions, child reset, and tuned exit checked. |
| XIX — Stairs | Added clock rules. Shared prompt refresh supports wall→chalk wording. Three-hour views, filing/box preparation, loop lights, approach, and wardrobe exit checked. |
| XX — Room | The wardrobe's solid, unopenable front doors and an oversized bed boundary trapped the player outside the bedroom, despite the direct-handler solver passing. Both leaves now open with the back panel, and the bed boundary leaves a walkable route around its foot. The panel waits until the player is fully inside before shutting. Added a normal E-and-walk regression that also turns into the room. Added clock rules and cancellable hum/knock timers. Shared hidden-object filtering prevents targeting discarded hour props; prompts update when the back panel becomes the way back. Bedroom arrangement, clock stop, landing door, response knocks, and final light checked. |

## Verification and limits

- `npm test`: 45 pure logic and targeted interaction/timer regressions.
- `npm run test:review`: 15 browser checks for overlay races, clue visibility, progression guards,
  ladder collision, the final wardrobe passage, pause/resume, portrait,
  journal, and quit/restart.
- `npm run playtest`: all 20 puzzle handlers complete in Chromium.
- `npm run test:touch`: existing 27 checks cover movement, look, touch
  interaction, pause, menus, orientation, and touch-mode entry.
- `npm run build`: production bundle.
- `npm run test:platform`: wall/frame/display separation and board interaction,
  with mouse-look screenshots in `shots/platform-frame/`. The original failure
  is captured in `shots/platform-before/`.
- `npm run review:shots` and `npm run review:sheets`: inspect the resulting
  PNGs in `shots/review/`; these generated files are git-ignored.

This is a Chromium/software-WebGL review with emulated touch, not a claim
of exhaustive real-device coverage or a complete unaided human walkthrough.
The puzzle solver uses teleports and direct handlers; targeting, rendering,
and input regression checks supplement that evidence.
