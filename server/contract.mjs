// The leaderboard contract, shared by the Node server (server/server.mjs)
// and the Cloudflare Worker (worker/index.mjs). Pure functions only —
// no filesystem, no globals — so it runs anywhere.

export const MIN_ROOM_SECONDS = 1;
export const MAX_ROOM_SECONDS = 86400;
export const NAME_MAX = 24;

/** Strip control/format characters, collapse whitespace, cap length. */
export function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const clean = name.normalize('NFC').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return clean.length ? clean : null;
}

/** Validate a { roomId: seconds } map. Returns a clean copy or null. */
export function sanitizeTimes(times, maxLevel) {
  if (typeof times !== 'object' || times === null || Array.isArray(times)) return null;
  const out = {};
  const keys = Object.keys(times);
  if (keys.length === 0 || keys.length > maxLevel) return null;
  for (const k of keys) {
    if (!/^\d{1,3}$/.test(k)) return null;
    const id = Number(k);
    if (id < 1 || id > maxLevel) return null;
    const v = times[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    if (v < MIN_ROOM_SECONDS || v > MAX_ROOM_SECONDS) return null;
    out[id] = Math.round(v * 10) / 10;
  }
  return out;
}

export const validKey = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(k);

/** Per-room minimum of an existing and an incoming map — runs only improve. */
export function mergeTimes(existing, incoming) {
  const merged = { ...existing };
  for (const [id, t] of Object.entries(incoming)) {
    if (!(id in merged) || t < merged[id]) merged[id] = t;
  }
  return merged;
}

export const levelsOf = (times) => Object.keys(times).length;
export const totalOf = (times) =>
  Math.round(Object.values(times).reduce((a, b) => a + b, 0) * 10) / 10;

/** Ranking: rooms desc, then total time asc, then who got there first. */
export function compareEntries(a, b) {
  return levelsOf(b.times) - levelsOf(a.times)
    || totalOf(a.times) - totalOf(b.times)
    || a.updated - b.updated;
}
