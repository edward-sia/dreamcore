Original prompt: I'd like you to review each level, identify any issue and addressing them. Graphic, unclear message, flakiness, etc.

## Review completed

- Scope: all 20 rooms, their puzzle clues, rendered views, interaction reliability, and shared overlays.
- Baseline was clean; the existing direct-handler solver passed all 20 rooms before changes.
- Reviewed four rendered angles per room, plus morning/evening in XVI–XX and interior viewpoints for XIX/XX. Generated evidence lives in ignored `shots/review/`.
- Fixed shared targeting, subtitle/objective races, keypad correction/cancellation, overlay input, active room timers, captions, scrolling, and soft dust/vignette rendering.
- Fixed room-specific clues/progression in I–VI, VIII, and XVIII; moving ladder collision in IX; shore geometry in X; discoverable clock rules in XVI–XX.
- Actual E/W/D input exposed XX's blocked wardrobe passage (closed front doors plus oversized bed boundary). Both blockers are fixed and covered by a real movement regression.
- `npm test`: 45/45. `npm run test:review`: 15/15. `npm run playtest`: 20/20, with XX separately rerun after its passage fix. Production build passes.
- The skill browser client also exercised actual forward movement and exported screenshots/text state. Chromium reported no unexpected errors in room captures or review tests.
- Touch movement's fixed wall-clock hold was flaky under software GPU load; changed it to a rendered-frame hold. Final touch run: 27/27 passed.
- See `docs/LEVEL_REVIEW.md` for all 20 findings and verification limits. No production deployment or commit was requested.

## Platform frame follow-up

- User reported the departures-board frame flickering during mouse-look. Reproduced the same blocky edges at opposing mouse-look angles; the casing's visible front and station wall both occupied z=4.7.
- Moved the full casing forward of the wall, preserving a separate display plane. The matching after views have continuous borders.
- Added `tools/review-platform.ts` / `npm run test:platform`: captures four actual mouse-look views, reads the board using E, and checks wall/frame/display separation. Confirmed failure before the fix and pass afterward.
- Fresh checks: Platform regression passed, room 7 solver passed, 45/45 unit tests passed, build passed. Images: `shots/platform-before/` and `shots/platform-frame/` (ignored).
