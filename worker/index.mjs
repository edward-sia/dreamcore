// hiraeth on Cloudflare: one Worker serves the built game (static assets)
// and the leaderboard API backed by a D1 database. Same contract as the
// Node server (server/server.mjs); the game client needs no changes because
// game and API share an origin.
//
// Deploy (see docs/HOSTING.md):
//   npm run build
//   npx wrangler d1 create hiraeth-leaderboard    # paste id into wrangler.jsonc
//   npx wrangler deploy
//
// The schema is created automatically on first use.

import {
  sanitizeName, sanitizeTimes, validKey, mergeTimes, levelsOf, totalOf,
} from '../server/contract.mjs';

const RATE = { GET: 240, POST: 30 }; // per minute; best-effort (per isolate)
const buckets = new Map();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS entries (
     key TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     times TEXT NOT NULL,
     levels INTEGER NOT NULL,
     total REAL NOT NULL,
     updated INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS idx_rank ON entries (levels DESC, total ASC, updated ASC)',
];

let schemaReady = null;
function ensureSchema(env) {
  schemaReady ??= env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  return schemaReady;
}

const cfg = (env) => ({
  maxLevel: parseInt(env.MAX_LEVEL ?? '10', 10),
  maxEntries: parseInt(env.MAX_ENTRIES ?? '5000', 10),
  origin: env.ALLOWED_ORIGIN ?? '*',
});

const corsHeaders = (origin) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'vary': 'origin',
});

const json = (code, obj, origin) => new Response(JSON.stringify(obj), {
  status: code,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders(origin),
  },
});

function rateLimited(request) {
  const ip = request.headers.get('cf-connecting-ip') ?? '?';
  const method = request.method === 'POST' ? 'POST' : 'GET';
  const id = `${ip} ${method}`;
  const now = Date.now();
  let b = buckets.get(id);
  if (!b || b.reset < now) { b = { n: 0, reset: now + 60_000 }; buckets.set(id, b); }
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  b.n += 1;
  return b.n > RATE[method];
}

/** Players ranked ahead of (levels, total, updated) — rank is that + 1. */
async function rankOf(env, levels, total, updated) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM entries
     WHERE levels > ?1 OR (levels = ?1 AND total < ?2)
        OR (levels = ?1 AND total = ?2 AND updated < ?3)`
  ).bind(levels, total, updated).first();
  return (row?.n ?? 0) + 1;
}

async function getLeaderboard(env, url, origin) {
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') ?? '100', 10) || 100));
  const { results } = await env.DB.prepare(
    `SELECT name, times, levels, total, updated FROM entries
     ORDER BY levels DESC, total ASC, updated ASC LIMIT ?1`
  ).bind(limit).all();
  const list = results.map((r) => ({
    name: r.name,
    levels: r.levels,
    total: r.total,
    times: JSON.parse(r.times),
    updated: r.updated,
  }));
  const count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM entries').first())?.n ?? 0;

  let you = null;
  const key = url.searchParams.get('key');
  if (key && validKey(key)) {
    const row = await env.DB.prepare(
      'SELECT levels, total, updated FROM entries WHERE key = ?1'
    ).bind(key).first();
    if (row) {
      you = {
        rank: await rankOf(env, row.levels, row.total, row.updated),
        levels: row.levels,
        total: row.total,
      };
    }
  }
  return json(200, { ok: true, count, entries: list, you }, origin);
}

async function postScore(env, request, origin) {
  const { maxLevel, maxEntries } = cfg(env);
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'bad json' }, origin);
  }
  if (!validKey(body.key)) return json(400, { ok: false, error: 'bad key' }, origin);
  const name = sanitizeName(body.name);
  if (!name) return json(400, { ok: false, error: 'bad name' }, origin);
  const times = sanitizeTimes(body.times, maxLevel);
  if (!times) return json(400, { ok: false, error: 'bad times' }, origin);

  const existing = await env.DB.prepare(
    'SELECT times FROM entries WHERE key = ?1'
  ).bind(body.key).first();

  let count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM entries').first())?.n ?? 0;
  if (!existing && count >= maxEntries) {
    return json(403, { ok: false, error: 'leaderboard full' }, origin);
  }

  const merged = mergeTimes(existing ? JSON.parse(existing.times) : {}, times);
  const levels = levelsOf(merged);
  const total = totalOf(merged);
  const updated = Date.now();

  await env.DB.prepare(
    `INSERT INTO entries (key, name, times, levels, total, updated)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(key) DO UPDATE SET
       name = excluded.name, times = excluded.times, levels = excluded.levels,
       total = excluded.total, updated = excluded.updated`
  ).bind(body.key, name, JSON.stringify(merged), levels, total, updated).run();

  if (!existing) count += 1;
  const rank = await rankOf(env, levels, total, updated);
  return json(200, { ok: true, rank, levels, total, count }, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const { origin } = cfg(env);

    // Static assets are served before the Worker runs; only API paths
    // (and true 404s) reach this handler.
    if (p.startsWith('/api/') || p === '/healthz') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      if (rateLimited(request)) {
        return json(429, { ok: false, error: 'slow down', retryAfter: 60 }, origin);
      }
      try {
        await ensureSchema(env);
        if (p === '/healthz') {
          const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM entries').first())?.n ?? 0;
          return json(200, { ok: true, entries: n }, origin);
        }
        if (p === '/api/leaderboard' && request.method === 'GET') {
          return await getLeaderboard(env, url, origin);
        }
        if (p === '/api/score' && request.method === 'POST') {
          return await postScore(env, request, origin);
        }
        return json(404, { ok: false, error: 'no such endpoint' }, origin);
      } catch (err) {
        console.error('api error:', err.message);
        return json(500, { ok: false, error: 'server error' }, origin);
      }
    }

    return new Response('not found\n', { status: 404, headers: { 'content-type': 'text/plain' } });
  },
};
