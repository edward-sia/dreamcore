# Hosting HIRAETH & its leaderboard

The game is a static site. The leaderboard needs one small backend with
one persistent store — there are two interchangeable implementations of
the same API in this repo, so pick the setup you want:

| setup | game | leaderboard | scores live in |
|---|---|---|---|
| **⭐ Cloudflare** | one Worker, free | same Worker | D1 (Cloudflare's free SQLite) |
| **A. GitHub Pages only** | free, automatic | offline (each player sees their own local times) | each player's browser |
| **B. One small server** | served by the server | on the same server | a JSON file on disk |
| **C. Pages + server** | free on Pages | on your server, via one repo variable | a JSON file on disk |

## ⭐ Cloudflare — one link, everything included

One Worker serves the game *and* the score API (`worker/index.mjs`),
backed by **D1**, Cloudflare's free SQLite database — needed because
Workers have no disk for the JSON file the Node server uses. Static
asset requests (the game itself) are free and unmetered; the free plan's
100k requests/day only meter the score API. The schema creates itself on
first use.

For this repository the D1 database is **already created and wired into
`wrangler.jsonc`** (schema initialized), so going live is:

```bash
npm install && npm run build
npx wrangler login       # opens browser, free account is fine
npx wrangler deploy      # prints https://hiraeth.<you>.workers.dev
```

If you fork this repo you need your own database — create it and swap the
id in `wrangler.jsonc`:

```bash
npx wrangler d1 create hiraeth-leaderboard    # prints a database_id
```

That printed URL is the shareable link — game and leaderboard together,
playable by anyone. Preview locally first with `npx wrangler dev` (no
account needed; uses a local D1). Redeploys keep all scores — they live
in D1, not in the Worker. Useful extras:

```bash
npx wrangler d1 export hiraeth-leaderboard --remote --output backup.sql   # back up scores
npx wrangler d1 execute hiraeth-leaderboard --remote \
  --command "DELETE FROM entries WHERE name = 'somebody'"                 # moderate an entry
```

A custom domain can be attached later in the Cloudflare dashboard
(Workers → your worker → Domains & Routes); no config change needed.
The Worker's rate limiting is best-effort (per isolate) — for a popular
deployment add a WAF rate-limiting rule on `/api/*` in the dashboard.

## A. GitHub Pages (game only)

The deploy workflow ships at [`docs/workflows/deploy.yml`](workflows/deploy.yml)
— GitHub doesn't allow automation to install workflows, so move it into
place once yourself:

```bash
mkdir -p .github/workflows
git mv docs/workflows/deploy.yml .github/workflows/deploy.yml
git commit -m "Enable Pages deploy" && git push
```

(Equivalently: create `.github/workflows/deploy.yml` in the GitHub web UI
and paste the file's contents.) If the first run complains about Pages,
enable it once in **Settings → Pages → Source: GitHub Actions** and re-run
the workflow. From then on every push to `main` publishes
`https://<user>.github.io/<repo>/`.

Without a leaderboard server the *dreamers* menu still works — it shows
each player their own best times, stored in their browser.

## B. One server for everything

Anything that runs Node 18+ works — a $4 VPS, a free-tier PaaS, a spare
machine:

```bash
npm ci && npm run build     # static site in dist/
npm start                   # serves dist/ + the API on :8091
```

Or with Docker (bakes the build in, keeps scores in a volume):

```bash
docker build -t hiraeth .
docker run -d -p 8091:8091 -v hiraeth-data:/data --restart unless-stopped hiraeth
```

On a PaaS (Render, Railway, Fly.io…): build command
`npm ci && npm run build`, start command `npm start`, and set `DATA_DIR`
to a persisted disk if the platform offers one. Scores live in a single
JSON file — `${DATA_DIR}/leaderboard.json` — back it up by copying it.

## C. GitHub Pages + your leaderboard server

1. Deploy the server as in **B** (it happily runs API-only, before/without
   `dist/`).
2. In the repo: **Settings → Secrets and variables → Actions → Variables**,
   add `LEADERBOARD_URL = https://your-server.example.com`.
3. Push (or re-run the deploy workflow). The Pages build now reads and
   submits scores cross-origin.

To pin CORS to your Pages origin instead of `*`, set
`ALLOWED_ORIGIN=https://<user>.github.io` on the server.

## How ranking works

- An entry is one player: **rooms completed** (descending), then **total
  time across those rooms** (ascending), then whoever got there first.
- Each room's time is the *active* time from stepping into the room to
  unlocking the way onward — the pause screen doesn't count, reading notes
  does. Replaying a room keeps your best (lowest) time, and re-submissions
  only ever improve an entry, so *begin again* can't hurt your standing.
- The *room by room* tab shows the single fastest crossing of each room.
- Nothing is submitted until the player chooses a name in the *dreamers*
  menu. Identity is an anonymous random key in the browser's localStorage —
  no accounts, no emails. Clearing site data orphans the old entry.

## Server reference

Endpoints:

```
GET  /api/leaderboard?limit=N[&key=K]   → { ok, count, entries, you }
POST /api/score  { key, name, times }   → { ok, rank, levels, total, count }
GET  /healthz
```

Environment:

| var | default | |
|---|---|---|
| `PORT` / `HOST` | `8091` / `0.0.0.0` | |
| `DATA_DIR` | `server/data` | where `leaderboard.json` lives |
| `STATIC_DIR` | `dist` | built game to serve; `''` for API-only |
| `ALLOWED_ORIGIN` | `*` | CORS origin for `/api` |
| `MAX_LEVEL` | `20` | highest accepted room id |
| `MAX_ENTRIES` | `5000` | new players rejected beyond this |
| `TRUST_PROXY` | `1` | rate-limit by `x-forwarded-for` |

Notes on abuse: submissions are validated (name is stripped of control
characters and capped at 24 chars, times must be 1s–24h, rooms 1–20) and
rate-limited per IP, but times are ultimately client-reported — this is an
honor-system leaderboard for a cozy puzzle game, not an anti-cheat fortress.
If an entry needs removing, delete its line from `leaderboard.json` and
restart.

The validation, merging and ranking rules live in `server/contract.mjs`,
shared by both implementations, so the Node server and the Worker behave
identically.

Testing: `npm run test:api` boots a scratch Node server and checks the
whole contract (ranking, merging, validation, CORS, rate limits). The
same suite runs against the Worker:

```bash
npx wrangler dev &   # fresh local D1
LB_TEST_URL=http://127.0.0.1:8787 node tools/leaderboard-test.mjs
```
