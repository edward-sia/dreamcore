# HIRAETH contributor notes

See [AGENTS.md](AGENTS.md) for the development contract, [README.md](README.md) for commands, and [docs/LEVEL_API.md](docs/LEVEL_API.md) for room authoring.

The 20 procedural Three.js rooms share input, overlays, timers, and collision helpers. A successful debug solver alone does not prove that a player can reach or aim at a clue. Check rendered views and actual inputs, including modal and pause transitions.

The Platform board regression (`npm run test:platform`) checks wall/frame/display depth separation, captures mouse-look views, and reads the board with E. Keep mounted surfaces separated to avoid camera-dependent z-fighting.
