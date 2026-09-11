# Working on HIRAETH

- Preserve the quiet dreamcore art direction and established puzzle canon.
- Review changes through real browser interactions as well as `debugSolve()`; the solver bypasses aiming and walking.
- For wall-mounted props, check depth separation and mouse-look from several angles; coplanar surfaces can flicker despite a clean still image. `npm run test:platform` covers the departures board.
- Use TypeScript for new tooling/tests. Keep targeted fixes in the existing JavaScript modules rather than migrating unrelated code.
- Update README, CLAUDE.md, and relevant docs when behavior or verification changes.
- Run `npm test`, `npm run build`, and the affected browser tests. For shared gameplay changes, run all 20 rooms with `npm run playtest` and the touch suite.
