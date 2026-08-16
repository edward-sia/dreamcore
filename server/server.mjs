#!/usr/bin/env node
// hiraeth leaderboard + static host. Zero dependencies; Node 18+.
//
//   npm run build && npm start          # game + leaderboard on one port
//
// Endpoints:
//   GET  /api/leaderboard?limit=N[&key=K]   ranked entries (+ your rank)
//   POST /api/score  { key, name, times }   upsert a run (only ever improves)
//   GET  /healthz
//
// Ranking: rooms completed (desc), then total time across those rooms (asc),
// then who got there first. An entry is keyed by an anonymous client-generated
// id; re-submissions merge per-room best times, so a run can never get worse.
//
// Env:
//   PORT=8091  HOST=0.0.0.0
//   DATA_DIR=server/data      leaderboard.json lives here (mount a volume)
//   STATIC_DIR=dist           built game to serve ('' disables static serving)
//   ALLOWED_ORIGIN=*          CORS origin for /api (set your Pages URL to pin)
//   MAX_LEVEL=10  MAX_ENTRIES=5000
//   TRUST_PROXY=1             use x-forwarded-for for rate limiting (PaaS)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { sanitizeName, sanitizeTimes, validKey, mergeTimes, levelsOf as levelsOfTimes, totalOf as totalOfTimes, compareEntries } from './contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = parseInt(process.env.PORT ?? '8091', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR ?? 'server/data');
const STATIC_DIR = process.env.STATIC_DIR === ''
  ? null
  : path.resolve(ROOT, process.env.STATIC_DIR ?? 'dist');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';
const MAX_LEVEL = parseInt(process.env.MAX_LEVEL ?? '10', 10);
const MAX_ENTRIES = parseInt(process.env.MAX_ENTRIES ?? '5000', 10);
const TRUST_PROXY = (process.env.TRUST_PROXY ?? '1') === '1';

const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json');
const MAX_BODY = 8 * 1024;
const RATE = { GET: 120, POST: 30 }; // requests per minute per ip

// ---------- store ----------

const entries = new Map(); // key -> { key, name, times, updated }

function loadStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const e of raw.entries ?? []) {
      if (e && typeof e.key === 'string') entries.set(e.key, e);
    }
    console.log(`[store] loaded ${entries.size} entries from ${DATA_FILE}`);
  } catch {
    console.log(`[store] starting fresh (${DATA_FILE})`);
  }
}

let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, entries: [...entries.values()] }));
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('[store] save failed:', err.message);
  }
}

const levelsOf = (e) => levelsOfTimes(e.times);
const totalOf = (e) => totalOfTimes(e.times);

function ranked() {
  return [...entries.values()].sort(compareEntries);
}

// ---------- rate limiting ----------

const buckets = new Map(); // `${ip} ${method}` -> { n, reset }
function rateLimited(req) {
  const fwd = TRUST_PROXY ? req.headers['x-forwarded-for'] : null;
  const ip = (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket.remoteAddress || '?';
  const method = req.method === 'POST' ? 'POST' : 'GET';
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

// ---------- helpers ----------

function corsHeaders() {
  return {
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'origin',
  };
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders(),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------- api ----------

function handleGetLeaderboard(res, query) {
  const limit = Math.min(500, Math.max(1, parseInt(query.get('limit') ?? '100', 10) || 100));
  const sorted = ranked();
  const list = sorted.slice(0, limit).map((e) => ({
    name: e.name,
    levels: levelsOf(e),
    total: totalOf(e),
    times: e.times,
    updated: e.updated,
  }));
  let you = null;
  const key = query.get('key');
  if (key) {
    const i = sorted.findIndex((e) => e.key === key);
    if (i >= 0) {
      you = { rank: i + 1, levels: levelsOf(sorted[i]), total: totalOf(sorted[i]) };
    }
  }
  sendJson(res, 200, { ok: true, count: entries.size, entries: list, you });
}

async function handlePostScore(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { ok: false, error: 'bad json' });
  }
  if (!validKey(body.key)) return sendJson(res, 400, { ok: false, error: 'bad key' });
  const name = sanitizeName(body.name);
  if (!name) return sendJson(res, 400, { ok: false, error: 'bad name' });
  const times = sanitizeTimes(body.times, MAX_LEVEL);
  if (!times) return sendJson(res, 400, { ok: false, error: 'bad times' });

  const existing = entries.get(body.key);
  if (!existing && entries.size >= MAX_ENTRIES) {
    return sendJson(res, 403, { ok: false, error: 'leaderboard full' });
  }

  // Merge: per-room minimum against what we already have — runs only improve.
  const merged = mergeTimes(existing ? existing.times : {}, times);
  const entry = { key: body.key, name, times: merged, updated: Date.now() };
  entries.set(body.key, entry);
  saveSoon();

  const sorted = ranked();
  const rank = sorted.findIndex((e) => e.key === body.key) + 1;
  sendJson(res, 200, {
    ok: true,
    rank,
    levels: levelsOf(entry),
    total: totalOf(entry),
    count: entries.size,
  });
}

// ---------- static ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.map', '.txt']);

function serveStatic(req, res, pathname) {
  if (!STATIC_DIR || !fs.existsSync(STATIC_DIR)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('hiraeth leaderboard api is running.\nbuild the game (npm run build) to serve it from here too.\n');
    return;
  }
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.resolve(STATIC_DIR, '.' + path.posix.normalize(rel));
  if (!file.startsWith(STATIC_DIR + path.sep) && file !== STATIC_DIR) {
    res.writeHead(403); res.end(); return;
  }
  let stat;
  try { stat = fs.statSync(file); } catch { stat = null; }
  if (!stat || !stat.isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const headers = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': rel.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'   // vite content-hashed
      : 'no-cache',
  };
  let data = fs.readFileSync(file);
  const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (wantsGzip && COMPRESSIBLE.has(ext) && data.length > 1024) {
    data = zlib.gzipSync(data);
    headers['content-encoding'] = 'gzip';
  }
  headers['content-length'] = data.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : data);
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const p = u.pathname;

  try {
    if (p.startsWith('/api/') || p === '/healthz') {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
      }
      if (rateLimited(req)) {
        return sendJson(res, 429, { ok: false, error: 'slow down', retryAfter: 60 });
      }
      if (p === '/healthz') return sendJson(res, 200, { ok: true, entries: entries.size });
      if (p === '/api/leaderboard' && req.method === 'GET') return handleGetLeaderboard(res, u.searchParams);
      if (p === '/api/score' && req.method === 'POST') return await handlePostScore(req, res);
      return sendJson(res, 404, { ok: false, error: 'no such endpoint' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end(); return;
    }
    serveStatic(req, res, p);
  } catch (err) {
    console.error('[server]', err.message);
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'server error' });
  }
});

loadStore();
server.listen(PORT, HOST, () => {
  console.log(`hiraeth is listening on http://${HOST}:${PORT}`);
  console.log(`  static: ${STATIC_DIR && fs.existsSync(STATIC_DIR) ? STATIC_DIR : '(none — api only)'}`);
  console.log(`  data:   ${DATA_FILE}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    saveNow();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
