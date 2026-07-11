// All audio is synthesized — drones, wind, drips, chimes — so the game ships
// with zero audio assets and everything stays slightly unreal, like sound
// remembered rather than heard.

const MOODS = {
  menu:    { root: 55,  chord: [1, 1.5, 2.0, 3.02], cutoff: 620,  noise: 0.05, events: ['bell'] },
  hallway: { root: 49,  chord: [1, 2.0, 2.997],     cutoff: 500,  noise: 0.09, events: ['creak', 'hum'] },
  pool:    { root: 41,  chord: [1, 1.498, 2.0],     cutoff: 420,  noise: 0.11, events: ['drip', 'drip', 'swell'] },
  dusk:    { root: 62,  chord: [1, 1.189, 1.5, 2.378], cutoff: 700, noise: 0.07, events: ['bell', 'creak', 'wind'] },
  store:   { root: 55,  chord: [1, 1.335, 2.0],     cutoff: 800,  noise: 0.06, events: ['hum', 'hum', 'rattle'] },
  home:    { root: 46,  chord: [1, 1.498, 1.782, 2.0], cutoff: 540, noise: 0.07, events: ['creak', 'clock', 'bell'] },
  field:   { root: 38,  chord: [1, 1.5, 2.244],     cutoff: 380,  noise: 0.13, events: ['wind', 'wind', 'bell'] },
  train:   { root: 44,  chord: [1, 1.335, 1.782],   cutoff: 460,  noise: 0.10, events: ['rumble', 'rattle'] },
  theater: { root: 52,  chord: [1, 1.189, 1.782],   cutoff: 520,  noise: 0.06, events: ['creak', 'swell'] },
  archive: { root: 43,  chord: [1, 1.26, 1.498, 2.0], cutoff: 440, noise: 0.08, events: ['clock', 'creak', 'bell'] },
  shore:   { root: 49,  chord: [1, 1.5, 2.0, 2.52], cutoff: 620,  noise: 0.16, events: ['waves', 'waves', 'bell'] },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.8;
    this._amb = null;         // { gain, nodes, timers, mood }
    this._noiseBuf = null;
    this._started = false;
  }

  init() {
    if (this._started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    this._started = true;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);

    // gentle master compression keeps drones + sfx from clipping
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    this.master.disconnect();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 3;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this._noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish
      data[i] = last * 3.2;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  // ---------- ambience ----------

  setAmbience(mood) {
    if (!this._started) { this._pendingMood = mood; return; }
    if (this._amb?.mood === mood) return;
    this._stopAmbience();
    if (!mood || !MOODS[mood]) return;
    const cfg = MOODS[mood];
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.5, ctx.currentTime, 4.0);
    gain.connect(this.master);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cfg.cutoff;
    lp.Q.value = 0.4;
    lp.connect(gain);

    const nodes = [lp];

    // drone voices
    cfg.chord.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'triangle' : 'sine';
      osc.frequency.value = cfg.root * ratio;
      osc.detune.value = (Math.random() - 0.5) * 9;
      const g = ctx.createGain();
      g.gain.value = 0.09 / cfg.chord.length * (i === 0 ? 2.0 : 1.0);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + Math.random() * 0.06;
      const lfoG = ctx.createGain();
      lfoG.gain.value = g.gain.value * 0.55;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      osc.connect(g); g.connect(lp);
      osc.start(); lfo.start();
      nodes.push(osc, lfo, g);
    });

    // noise bed (wind / room tone)
    if (cfg.noise > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      src.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.value = 300;
      const ng = ctx.createGain();
      ng.gain.value = cfg.noise;
      const nlfo = ctx.createOscillator();
      nlfo.frequency.value = 0.07;
      const nlfoG = ctx.createGain();
      nlfoG.gain.value = cfg.noise * 0.5;
      nlfo.connect(nlfoG); nlfoG.connect(ng.gain);
      src.connect(nf); nf.connect(ng); ng.connect(gain);
      src.start(); nlfo.start();
      nodes.push(src, nlfo, ng);
    }

    // sparse random events
    const timers = [];
    const scheduleEvent = (name) => {
      const delay = 6 + Math.random() * 18;
      const t = setTimeout(() => {
        if (this._amb?.mood !== mood) return;
        this._ambEvent(name, gain);
        scheduleEvent(name);
      }, delay * 1000);
      timers.push(t);
    };
    cfg.events.forEach(scheduleEvent);

    this._amb = { gain, nodes, timers, mood };
  }

  _stopAmbience() {
    const amb = this._amb;
    if (!amb) return;
    this._amb = null;
    amb.timers.forEach(clearTimeout);
    const ctx = this.ctx;
    amb.gain.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
    setTimeout(() => {
      amb.nodes.forEach((n) => { try { n.stop?.(); } catch {} try { n.disconnect(); } catch {} });
      try { amb.gain.disconnect(); } catch {}
    }, 4000);
  }

  _ambEvent(name, out) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (name) {
      case 'drip': {
        const f = 900 + Math.random() * 1400;
        this._blip(out, f, f * 0.45, 0.005, 0.14, 0.05 + Math.random() * 0.05);
        break;
      }
      case 'bell': {
        const notes = [220, 261.6, 293.7, 329.6, 392];
        const f = notes[(Math.random() * notes.length) | 0] * (Math.random() < 0.5 ? 0.5 : 1);
        this._bellTone(out, f, 0.035, 4.5);
        break;
      }
      case 'creak': {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuf;
        src.playbackRate.value = 0.18 + Math.random() * 0.1;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(160 + Math.random() * 120, t);
        bp.frequency.linearRampToValueAtTime(90, t + 1.4);
        bp.Q.value = 9;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.10, t + 0.5);
        g.gain.linearRampToValueAtTime(0, t + 1.6);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(t); src.stop(t + 1.8);
        break;
      }
      case 'hum': {
        const osc = ctx.createOscillator();
        osc.frequency.value = 119 + Math.random() * 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.02, t + 0.3);
        g.gain.setValueAtTime(0.02, t + 2.2);
        g.gain.linearRampToValueAtTime(0, t + 2.6);
        osc.connect(g); g.connect(out);
        osc.start(t); osc.stop(t + 2.7);
        break;
      }
      case 'wind': case 'swell': case 'waves': {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuf;
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = name === 'waves' ? 700 : 420;
        const g = ctx.createGain();
        const dur = 4 + Math.random() * 3;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(name === 'waves' ? 0.16 : 0.09, t + dur * 0.45);
        g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(lp); lp.connect(g); g.connect(out);
        src.start(t); src.stop(t + dur + 0.2);
        break;
      }
      case 'rumble': {
        const osc = ctx.createOscillator();
        osc.frequency.value = 32 + Math.random() * 10;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.14, t + 1.2);
        g.gain.linearRampToValueAtTime(0, t + 3.4);
        osc.connect(g); g.connect(out);
        osc.start(t); osc.stop(t + 3.5);
        break;
      }
      case 'rattle': {
        for (let i = 0; i < 3; i++) {
          this._blip(out, 2400 + Math.random() * 800, 1800, 0.002, 0.03, 0.02, t + i * 0.07);
        }
        break;
      }
      case 'clock': {
        this._blip(out, 1100, 900, 0.001, 0.04, 0.035);
        setTimeout(() => this._amb && this._blip(out, 950, 800, 0.001, 0.04, 0.03), 900);
        break;
      }
    }
  }

  // ---------- one-shots ----------

  sfx(name, opts = {}) {
    if (!this._started) return;
    this.resume();
    const out = this.master;
    switch (name) {
      case 'step': {
        const g = 0.05 + Math.random() * 0.02;
        this._noiseBurst(out, 120 + Math.random() * 60, 0.09, g * (opts.run ? 1.5 : 1));
        break;
      }
      case 'paper': this._noiseBurst(out, 3200, 0.16, 0.06, 'highpass'); break;
      case 'pickup': this._bellTone(out, 587.3, 0.06, 1.6); break;
      case 'clue': {
        this._bellTone(out, 440, 0.05, 2.2);
        setTimeout(() => this._bellTone(out, 659.2, 0.04, 2.6), 140);
        break;
      }
      case 'unlock': {
        this._blip(out, 180, 70, 0.004, 0.28, 0.22);
        setTimeout(() => this._bellTone(out, 1174.7, 0.03, 1.2), 120);
        break;
      }
      case 'locked': this._blip(out, 130, 110, 0.004, 0.16, 0.14); break;
      case 'wrong': {
        this._toneSimple(out, 138.6, 0.5, 0.06, 'triangle');
        this._toneSimple(out, 146.8, 0.5, 0.06, 'triangle');
        break;
      }
      case 'switch': this._blip(out, 420, 300, 0.002, 0.08, 0.10); break;
      case 'door': {
        this._noiseBurst(out, 240, 0.5, 0.09);
        this._blip(out, 90, 60, 0.01, 0.4, 0.16);
        break;
      }
      case 'splash': this._noiseBurst(out, 900, 0.4, 0.12, 'bandpass'); break;
      case 'complete': {
        const seq = [220, 261.6, 329.6, 440, 523.2];
        seq.forEach((f, i) => setTimeout(() => this._bellTone(out, f, 0.05, 5), i * 320));
        break;
      }
      case 'tone': this._bellTone(out, opts.freq || 440, opts.gain ?? 0.06, opts.decay ?? 2.0); break;
    }
  }

  _toneSimple(out, freq, dur, gain, type = 'sine') {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  _bellTone(out, freq, gain, decay) {
    const ctx = this.ctx, t = ctx.currentTime;
    [1, 2.76, 5.4].forEach((h, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * h;
      const g = ctx.createGain();
      const gg = gain / (i * 2 + 1);
      g.gain.setValueAtTime(gg, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay / (i + 1));
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + decay + 0.1);
    });
  }

  _blip(out, f0, f1, attack, dur, gain, when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  _noiseBurst(out, freq, dur, gain, type = 'lowpass') {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = type === 'bandpass' ? 1.4 : 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
  }

  /** Called on the first user gesture. */
  unlockFromGesture() {
    this.init();
    this.resume();
    if (this._pendingMood) {
      const m = this._pendingMood;
      this._pendingMood = null;
      this.setAmbience(m);
    }
  }
}
