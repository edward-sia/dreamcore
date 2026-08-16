const KEY = 'hiraeth-save-v1';

const DEFAULTS = {
  unlocked: 1,          // highest level available
  completed: [],        // level ids finished
  times: {},            // level id -> best completion time (seconds)
  playerKey: '',        // anonymous leaderboard identity
  playerName: '',       // empty until the player joins the leaderboard
  sensitivity: 1.0,
  volume: 0.8,
  bloom: true,
  sawPrologue: false,
  captions: false,
  seenPrologues: [],
};

export class SaveSystem {
  constructor() {
    this.data = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* private mode etc. */ }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {}
  }

  completeLevel(id, totalLevels) {
    if (!this.data.completed.includes(id)) this.data.completed.push(id);
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(id + 1, totalLevels));
    this.save();
  }

  /** Record a completion time, keeping the best (lowest) per level. */
  recordTime(id, seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const prev = this.data.times[id];
    if (!Number.isFinite(prev) || seconds < prev) {
      this.data.times = { ...this.data.times, [id]: Math.round(seconds * 10) / 10 };
      this.save();
    }
  }

  bestTime(id) {
    const t = this.data.times[id];
    return Number.isFinite(t) ? t : null;
  }

  /** Bring an older save up to date with a longer level list. */
  migrate(totalLevels) {
    const maxDone = this.data.completed.length ? Math.max(...this.data.completed) : 0;
    const want = Math.max(this.data.unlocked, maxDone + 1);
    this.data.unlocked = Math.max(1, Math.min(want, totalLevels));
    if (!Array.isArray(this.data.seenPrologues)) this.data.seenPrologues = [];
    this.save();
  }

  reset() {
    // "begin again" restarts the dream but keeps settings, best times
    // (they are records, like speedrun PBs) and the leaderboard identity.
    const keep = {
      times: this.data.times,
      playerKey: this.data.playerKey,
      playerName: this.data.playerName,
      sensitivity: this.data.sensitivity,
      volume: this.data.volume,
      bloom: this.data.bloom,
      captions: this.data.captions,
    };
    this.data = { ...DEFAULTS, ...keep };
    this.save();
  }
}
