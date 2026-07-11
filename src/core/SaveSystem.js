const KEY = 'hiraeth-save-v1';

const DEFAULTS = {
  unlocked: 1,          // highest level available
  completed: [],        // level ids finished
  sensitivity: 1.0,
  volume: 0.8,
  bloom: true,
  sawPrologue: false,
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

  reset() {
    const keep = {
      sensitivity: this.data.sensitivity,
      volume: this.data.volume,
      bloom: this.data.bloom,
    };
    this.data = { ...DEFAULTS, ...keep };
    this.save();
  }
}
