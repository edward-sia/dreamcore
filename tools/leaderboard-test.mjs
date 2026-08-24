// Leaderboard contract test. By default boots server/server.mjs on a
// scratch port + data dir; set LB_TEST_URL to point at any other
// implementation of the same API (e.g. `wrangler dev` for the Worker)
// with a FRESH, empty store.
//   node tools/leaderboard-test.mjs
//   LB_TEST_URL=http://127.0.0.1:8787 node tools/leaderboard-test.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const external = process.env.LB_TEST_URL ?? null;
const PORT = 18000 + Math.floor(Math.random() * 2000);
const URL = external ? external.replace(/\/+$/, '') : `http://127.0.0.1:${PORT}`;
const dataDir = external ? null : mkdtempSync(path.join(tmpdir(), 'hiraeth-lb-'));

const child = external ? null : spawn(process.execPath, ['server/server.mjs'], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, STATIC_DIR: '' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok — ${name}`);
  else { failures++; console.error(`  FAIL — ${name} ${detail}`); }
};

const get = async (q = '') => (await fetch(`${URL}/api/leaderboard${q}`)).json();
const post = (body) => fetch(`${URL}/api/score`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// wait for boot
for (let i = 0; i < 50; i++) {
  try { await fetch(`${URL}/healthz`); break; }
  catch { await new Promise((r) => setTimeout(r, 100)); }
}

try {
  console.log('leaderboard api:');

  let r = await get();
  check('empty board', r.ok === true && r.entries.length === 0 && r.count === 0);

  // ada: 3 rooms
  r = await (await post({ key: 'ada-1111-aaaa', name: 'ada', times: { 1: 60, 2: 120, 3: 90 } })).json();
  check('first submit accepted', r.ok && r.rank === 1 && r.levels === 3 && r.total === 270);

  // brin: 3 rooms but faster -> takes rank 1
  r = await (await post({ key: 'brin-2222-bbbb', name: 'brin', times: { 1: 50, 2: 100, 3: 80 } })).json();
  check('faster equal-rooms run ranks first', r.ok && r.rank === 1);

  // cato: 4 rooms, slow -> more rooms beats faster time
  r = await (await post({ key: 'cato-3333-cccc', name: 'cato', times: { 1: 500, 2: 500, 3: 500, 4: 500 } })).json();
  check('more rooms outrank faster time', r.ok && r.rank === 1 && r.levels === 4);

  // ada improves room 2 and adds room 4
  r = await (await post({ key: 'ada-1111-aaaa', name: 'ada', times: { 2: 30, 4: 45 } })).json();
  check('merge keeps per-room best and adds rooms', r.ok && r.levels === 4 && r.total === 60 + 30 + 90 + 45);

  // a worse resubmission cannot hurt
  r = await (await post({ key: 'ada-1111-aaaa', name: 'ada', times: { 1: 9999 } })).json();
  check('worse time never downgrades', r.ok && r.total === 225);

  r = await get('?key=ada-1111-aaaa');
  check('you-rank returned', r.you && r.you.rank === 1 && r.you.levels === 4);
  check('entries omit keys', r.entries.every((e) => !('key' in e)));
  check('sorted rooms desc then time asc',
    r.entries[0].name === 'ada' && r.entries[1].name === 'cato' && r.entries[2].name === 'brin');

  // name sanitization
  await post({ key: 'dara-4444-dddd', name: '  dara​   the   quiet  ', times: { 1: 70 } });
  r = await get('?limit=500');
  const dara = r.entries.find((e) => e.name.startsWith('da'));
  check('name stripped and collapsed', dara && dara.name === 'dara the quiet', JSON.stringify(dara?.name));

  // rooms up to 20 are accepted (the cap was 10 until the five above)
  r = await (await post({ key: 'fay-6666-ffff', name: 'fay', times: { 20: 300 } })).json();
  check('room 20 accepted', r.ok === true && r.levels === 1, JSON.stringify(r));

  // rejections
  const bad = [
    ['short key', { key: 'x', name: 'x', times: { 1: 60 } }],
    ['empty name', { key: 'eee-5555-eeee', name: ' ​ ', times: { 1: 60 } }],
    ['room out of range', { key: 'eee-5555-eeee', name: 'e', times: { 99: 60 } }],
    ['room 21', { key: 'eee-5555-eeee', name: 'e', times: { 21: 60 } }],
    ['non-numeric time', { key: 'eee-5555-eeee', name: 'e', times: { 1: 'fast' } }],
    ['absurd time', { key: 'eee-5555-eeee', name: 'e', times: { 1: 1e9 } }],
    ['sub-second time', { key: 'eee-5555-eeee', name: 'e', times: { 1: 0.2 } }],
    ['no times', { key: 'eee-5555-eeee', name: 'e', times: {} }],
  ];
  for (const [label, body] of bad) {
    const res = await post(body);
    check(`rejects ${label}`, res.status === 400);
  }

  // CORS
  const pre = await fetch(`${URL}/api/score`, { method: 'OPTIONS' });
  check('preflight ok', pre.status === 204 && pre.headers.get('access-control-allow-origin') === '*');
  const g = await fetch(`${URL}/api/leaderboard`);
  check('cors on GET', g.headers.get('access-control-allow-origin') === '*');

  // rate limit: hammer POSTs (limit 30/min; we already used ~13)
  let limited = false;
  for (let i = 0; i < 30; i++) {
    const res = await post({ key: 'brin-2222-bbbb', name: 'brin', times: { 1: 50 } });
    if (res.status === 429) { limited = true; break; }
  }
  check('rate limit kicks in', limited);
} catch (err) {
  failures++;
  console.error('  FAIL — unexpected error:', err.message);
}

child?.kill('SIGTERM');
if (dataDir) rmSync(dataDir, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : '\nall leaderboard checks passed');
process.exit(failures ? 1 : 0);
