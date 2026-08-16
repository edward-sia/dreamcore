// Leaderboard client. Talks to the hiraeth leaderboard server (server/server.mjs
// or anything implementing the same two endpoints):
//
//   GET  {api}/api/leaderboard?limit=N[&key=K]  -> { ok, count, entries, you }
//   POST {api}/api/score  { key, name, times }  -> { ok, rank, levels, total, count }
//
// The API base is resolved at boot from `leaderboard.json` beside the site
// (written at deploy time; empty string means "same origin"). If no server
// answers, the game quietly falls back to a local-only view of your own runs.
//
// Ranking: rooms completed (desc), then total time across those rooms (asc).
// Nothing is ever sent until the player chooses a name.

import { LEVELS } from '../levels/index.js';

const CONFIG_URL = './leaderboard.json';
const FETCH_LIMIT = 100;

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

function randomKey() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class Leaderboard {
  constructor(save) {
    this.save = save;
    this.api = null;          // '' = same origin, 'https://…' = remote, null = offline
    this.online = false;
    this.lastRank = null;
    this.ready = this._resolve();
  }

  get joined() { return !!this.save.data.playerName; }

  get key() {
    if (!this.save.data.playerKey) {
      this.save.data.playerKey = randomKey();
      this.save.save();
    }
    return this.save.data.playerKey;
  }

  async _resolve() {
    if (window.__TEST_MODE__) return false; // playtests stay offline & quiet
    let base = '';
    try {
      const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
      if (res.ok) {
        const cfg = await res.json();
        if (typeof cfg.api === 'string') base = cfg.api.replace(/\/+$/, '');
      }
    } catch { /* no config file — try same origin */ }
    try {
      const res = await fetch(`${base}/api/leaderboard?limit=1`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(7000),
      });
      const body = res.ok ? await res.json() : null;
      if (body?.ok) {
        this.api = base;
        this.online = true;
      }
    } catch { /* offline — local-only mode */ }
    return this.online;
  }

  /** Set (or change) the player's name and push their run. */
  async join(name) {
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!clean) return false;
    this.save.data.playerName = clean;
    this.save.save();
    return this.submit();
  }

  /** Push the current save to the server. No-op until joined & online. */
  async submit() {
    await this.ready;
    if (!this.online || !this.joined) return false;
    const times = this.save.data.times;
    if (!times || Object.keys(times).length === 0) return false;
    try {
      const res = await fetch(`${this.api}/api/score`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: this.key, name: this.save.data.playerName, times }),
        signal: AbortSignal.timeout(7000),
      });
      const body = await res.json();
      if (body?.ok) {
        this.lastRank = { rank: body.rank, levels: body.levels, total: body.total, count: body.count };
        return true;
      }
    } catch { /* keep dreaming; we'll retry on the next completion */ }
    return false;
  }

  async top(limit = FETCH_LIMIT) {
    await this.ready;
    if (!this.online) return null;
    try {
      const key = this.joined ? `&key=${encodeURIComponent(this.key)}` : '';
      const res = await fetch(`${this.api}/api/leaderboard?limit=${limit}${key}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(7000),
      });
      const body = await res.json();
      return body?.ok ? body : null;
    } catch {
      return null;
    }
  }

  // ---------- menu panel ----------

  attach() {
    this.el = {
      panel: document.getElementById('menu-dreamers'),
      sub: document.getElementById('lb-sub'),
      tabs: Array.from(document.querySelectorAll('.lb-tab')),
      body: document.getElementById('lb-body'),
      join: document.getElementById('lb-join'),
      name: document.getElementById('lb-name'),
      joinBtn: document.getElementById('lb-join-btn'),
      foot: document.getElementById('lb-foot'),
    };
    this.view = 'dream';
    for (const tab of this.el.tabs) {
      tab.addEventListener('click', () => {
        this.view = tab.dataset.view;
        for (const t of this.el.tabs) t.classList.toggle('on', t === tab);
        this.refresh();
      });
    }
    const doJoin = async () => {
      const name = this.el.name.value;
      if (!name.trim()) return;
      this.el.joinBtn.disabled = true;
      await this.join(name);
      this.el.joinBtn.disabled = false;
      this.refresh();
    };
    this.el.joinBtn.addEventListener('click', doJoin);
    this.el.name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doJoin();
      e.stopPropagation(); // typing must not trigger game hotkeys
    });
  }

  /** Re-render the panel (called whenever it is opened or state changes). */
  async refresh() {
    const { body, join, foot, name } = this.el;
    body.innerHTML = '<div class="lb-empty">reaching for the others…</div>';
    join.classList.add('hidden');
    foot.textContent = '';

    await this.ready;

    if (!this.online) {
      this._renderLocal();
      return;
    }

    // Sync our run first so the table includes it, then fetch.
    if (this.joined) await this.submit();
    const data = await this.top();
    if (!data) {
      this.online = false;
      this._renderLocal();
      return;
    }

    if (this.view === 'rooms') this._renderRooms(data);
    else this._renderDream(data);

    if (this.joined) {
      name.value = this.save.data.playerName;
      join.classList.remove('hidden');
      const you = data.you;
      foot.textContent = you
        ? `you are nº ${you.rank} of ${data.count} — ${you.levels} ${you.levels === 1 ? 'room' : 'rooms'} · ${formatTime(you.total)}`
        : 'finish a room and your name will appear.';
    } else {
      join.classList.remove('hidden');
      foot.textContent = Object.keys(this.save.data.times).length
        ? 'choose a name to let the others see you.'
        : 'choose a name — your times will follow you from the first room on.';
    }
  }

  _renderDream(data) {
    const { body } = this.el;
    body.innerHTML = '';
    if (!data.entries.length) {
      body.innerHTML = '<div class="lb-empty">no one has dreamt here yet. be the first.</div>';
      return;
    }
    const table = document.createElement('div');
    table.className = 'lb-table';
    table.appendChild(this._row(['', 'dreamer', 'rooms', 'time'], 'lb-head'));
    data.entries.forEach((e, i) => {
      const row = this._row(
        [`${i + 1}`, e.name, `${e.levels}`, formatTime(e.total)],
        data.you && data.you.rank === i + 1 ? 'lb-you' : ''
      );
      table.appendChild(row);
    });
    body.appendChild(table);
  }

  _renderRooms(data) {
    const { body } = this.el;
    body.innerHTML = '';
    // Fastest single time per room across everyone who has finished it.
    const best = new Map(); // id -> { name, t }
    for (const e of data.entries) {
      for (const [id, t] of Object.entries(e.times || {})) {
        const n = Number(id);
        if (!Number.isFinite(t)) continue;
        if (!best.has(n) || t < best.get(n).t) best.set(n, { name: e.name, t });
      }
    }
    const table = document.createElement('div');
    table.className = 'lb-table rooms';
    table.appendChild(this._row(['room', '', 'fastest', 'time'], 'lb-head'));
    for (const L of LEVELS) {
      const m = L.meta;
      const unlocked = m.id <= this.save.data.unlocked;
      const b = best.get(m.id);
      const mine = this.save.bestTime(m.id);
      const cells = [
        m.numeral,
        unlocked ? m.title : '· · ·',
        b ? b.name : '—',
        b ? formatTime(b.t) : '—',
      ];
      const row = this._row(cells, '');
      if (mine !== null) {
        const chip = document.createElement('span');
        chip.className = 'lb-mine';
        chip.textContent = ` · you ${formatTime(mine)}`;
        row.lastChild.appendChild(chip);
      }
      table.appendChild(row);
    }
    body.appendChild(table);
  }

  /** Offline: show your own recorded times so the panel still means something. */
  _renderLocal() {
    const { body, join, foot } = this.el;
    join.classList.add('hidden');
    body.innerHTML = '';
    const table = document.createElement('div');
    table.className = 'lb-table rooms';
    table.appendChild(this._row(['room', '', '', 'your best'], 'lb-head'));
    let any = false;
    for (const L of LEVELS) {
      const m = L.meta;
      const unlocked = m.id <= this.save.data.unlocked;
      const mine = this.save.bestTime(m.id);
      if (mine !== null) any = true;
      table.appendChild(this._row([
        m.numeral,
        unlocked ? m.title : '· · ·',
        '',
        mine !== null ? formatTime(mine) : '—',
      ], ''));
    }
    if (!any) {
      body.innerHTML = '<div class="lb-empty">finish a room and your time will be remembered here.</div>';
    } else {
      body.appendChild(table);
    }
    foot.textContent = 'the other dreamers are out of reach — no leaderboard server answered.';
  }

  _row(cells, cls) {
    const row = document.createElement('div');
    row.className = `lb-row ${cls}`.trim();
    for (const c of cells) {
      const div = document.createElement('div');
      div.textContent = c;
      row.appendChild(div);
    }
    return row;
  }
}
