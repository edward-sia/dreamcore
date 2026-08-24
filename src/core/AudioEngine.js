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
  night:      { root: 41, chord: [1, 1.189, 2.0],         cutoff: 380, noise: 0.05, events: ['creak', 'clock', 'wind'] },
  stairwell:  { root: 36, chord: [1, 1.5, 2.0, 2.997],    cutoff: 300, noise: 0.08, events: ['hum', 'drip', 'rumble'] },
  school:     { root: 49, chord: [1, 1.26, 1.5],          cutoff: 520, noise: 0.06, events: ['hum', 'hum', 'clock', 'rattle'] },
  playground: { root: 38, chord: [1, 1.498, 2.244, 3.0],  cutoff: 360, noise: 0.15, events: ['wind', 'wind', 'creak'] },
  under:      { root: 33, chord: [1, 1.189, 1.782],       cutoff: 260, noise: 0.09, events: ['drip', 'rumble', 'clock'] },
  evening:    { root: 46, chord: [1, 1.498, 1.782, 2.0], cutoff: 560, noise: 0.06, events: ['clock', 'creak', 'hum'] },
  morning:    { root: 58, chord: [1, 1.5, 2.0, 2.52],    cutoff: 900, noise: 0.18, events: ['birds', 'birds', 'creak'] },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.8;
    this._amb = null;         // { gain, nodes, timers, mood }
    this._noiseBuf = null;
    this._started = false;
    this.listener = null;
    this._dread = 0;
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
    this.listener = this.ctx.listener;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  /** Move the WebAudio listener to the camera. Call once per frame. */
  updateListener(camera) {
    if (!this._started || !this.listener) return;
    const l = this.listener, t = this.ctx.currentTime;
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    // columns of matrixWorld: X axis e[0..2], Y axis e[4..6], Z axis e[8..10], position e[12..14]
    const px = e[12], py = e[13], pz = e[14];
    const fx = -e[8], fy = -e[9], fz = -e[10];   // a camera looks down its local -Z
    const ux = e[4], uy = e[5], uz = e[6];
    if (l.positionX) {
      l.positionX.setTargetAtTime(px, t, 0.02); l.positionY.setTargetAtTime(py, t, 0.02); l.positionZ.setTargetAtTime(pz, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02); l.forwardY.setTargetAtTime(fy, t, 0.02); l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.setTargetAtTime(ux, t, 0.02); l.upY.setTargetAtTime(uy, t, 0.02); l.upZ.setTargetAtTime(uz, t, 0.02);
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
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
    const voices = [];

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
      voices.push(osc);
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

    this._amb = { gain, nodes, timers, mood, lp, cfg, voices, sub: null };
    this._dread = 0;
  }

  _stopAmbience() {
    const amb = this._amb;
    if (!amb) return;
    this._amb = null;
    amb.timers.forEach(clearTimeout);
    const now = this.ctx.currentTime;
    // A hush() in flight has already scheduled the ramp back up to 0.5, and
    // these nodes stay connected for another 4 s — so drop anything still
    // queued before starting the fade, or the outgoing drone swells again in
    // the middle of it. Cancelling first leaves our own fade untouched.
    const g = amb.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(0, now, 1.2);
    setTimeout(() => {
      amb.nodes.forEach((n) => { try { n.stop?.(); } catch {} try { n.disconnect(); } catch {} });
      try { amb.gain.disconnect(); } catch {}
    }, 4000);
  }

  // ---------- dread & hush ----------

  /** 0..1 — darkens the drone, adds a slow sub pulse and detune drift. Reset by setAmbience. */
  setDread(d) {
    d = Math.max(0, Math.min(1, d || 0));
    this._dread = d;
    const amb = this._amb;
    if (!amb || !this._started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    amb.lp.frequency.setTargetAtTime(amb.cfg.cutoff * (1 - 0.6 * d), t, 0.8);
    if (!amb.sub) {
      const sub = ctx.createOscillator();
      sub.frequency.value = amb.cfg.root / 2;
      const sg = ctx.createGain();
      sg.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lg = ctx.createGain();
      lg.gain.value = 0;
      lfo.connect(lg); lg.connect(sg.gain);
      sub.connect(sg); sg.connect(amb.gain);
      sub.start(); lfo.start();
      amb.sub = { sub, sg, lfo, lg };
      amb.nodes.push(sub, lfo, sg, lg);
      // detune drift, re-randomised every 3 s while dread > 0
      const drift = setInterval(() => {
        if (this._amb !== amb) { clearInterval(drift); return; }
        if (this._dread <= 0) return;
        for (const v of amb.voices) {
          v.detune.setTargetAtTime((Math.random() - 0.5) * 40 * this._dread, this.ctx.currentTime, 1.5);
        }
      }, 3000);
      amb.timers.push(drift);   // _stopAmbience clears these (clearTimeout also clears intervals)
    }
    amb.sub.sg.gain.setTargetAtTime(0.06 * d, t, 0.8);
    amb.sub.lg.gain.setTargetAtTime(0.03 * d, t, 0.8);
  }

  /** Cut the ambience for `seconds`, then let it back in. Silence before a reveal. */
  hush(seconds = 2, depth = 1) {
    const amb = this._amb;
    if (!amb || !this._started) return;
    const t = this.ctx.currentTime, g = amb.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(0.5 * (1 - depth), t, 0.25);
    g.setTargetAtTime(0.5, t + seconds, 1.5);
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
      case 'creak': this._creak(out, 0.10); break;
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
      case 'birds': {
        for (let k = 0; k < 3; k++) {
          const r = Math.random();
          this._blip(out, 2600 + r * 900, 3400 + r * 600, 0.003, 0.06, 0.03, t + k * 0.09);
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
    this._synth(name, opts, this.master);
  }

  /** Play a one-shot from a world position (HRTF panner → master). */
  sfxAt(name, position, opts = {}) {
    if (!this._started) return;
    this.resume();
    const panner = this._panner(position);
    this._synth(name, opts, panner);
    setTimeout(() => { try { panner.disconnect(); } catch {} }, (opts.holdSeconds ?? 8) * 1000);
  }

  _panner(position) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1.2;
    p.maxDistance = 60;
    p.rolloffFactor = 1.4;
    this._setPannerPos(p, position);
    p.connect(this.master);
    return p;
  }

  _setPannerPos(p, pos) {
    const t = this.ctx.currentTime;
    if (p.positionX) {
      p.positionX.setValueAtTime(pos.x, t);
      p.positionY.setValueAtTime(pos.y, t);
      p.positionZ.setValueAtTime(pos.z, t);
    } else {
      p.setPosition(pos.x, pos.y, pos.z);
    }
  }

  _noiseSource(rate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    src.playbackRate.value = rate;
    return src;
  }

  /** A struck piano string: three partials with a fast attack. */
  _piano(out, freq, gain, when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
    for (const [h, gm, dec] of [[1, 1, 1.8], [2, 0.35, 1.2], [3.01, 0.15, 0.8]]) {
      const o = ctx.createOscillator();
      o.frequency.value = freq * h;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * gm, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dec + 0.05);
    }
  }

  /** The wood creak used by ambience events and the swing loop. */
  _creak(out, gainV = 0.10) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = this._noiseSource(0.18 + Math.random() * 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(160 + Math.random() * 120, t);
    bp.frequency.linearRampToValueAtTime(90, t + 1.4);
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainV, t + 0.5);
    g.gain.linearRampToValueAtTime(0, t + 1.6);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t); src.stop(t + 1.8);
  }

  /**
   * A sustained positional source. Returns { stop(fade), setPosition(pos), setGain(g) }.
   * kinds: tap radio boiler hum swing rain pianoKey birds idle fire simmer
   */
  loopAt(kind, position, opts = {}) {
    const noop = { stop() {}, setPosition() {}, setGain() {} };
    if (!this._started) return noop;
    this.resume();
    const ctx = this.ctx, t = ctx.currentTime;
    const panner = this._panner(position);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.8);   // fade in; recipes set their own inner gains
    gain.connect(panner);
    const nodes = [], timers = [];
    const every = (ms, fn) => { fn(); timers.push(setInterval(fn, ms)); };
    const randomly = (minMs, maxMs, fn) => {
      const arm = () => {
        const id = setTimeout(() => { if (stopped) return; fn(); arm(); }, minMs + Math.random() * (maxMs - minMs));
        timers.push(id);
      };
      arm();
    };
    const noise = (rate = 1) => { const s = this._noiseSource(rate); nodes.push(s); s.start(t, Math.random() * 2); return s; };
    const osc = (type, freq, detune = 0) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
      nodes.push(o); o.start(t); return o;
    };
    const filt = (type, freq, Q = 1) => {
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q; nodes.push(f); return f;
    };
    const g = (v) => { const gg = ctx.createGain(); gg.gain.value = v; nodes.push(gg); return gg; };
    const lfoOn = (param, hz, depth) => { const l = osc('sine', hz); const lg = g(depth); l.connect(lg); lg.connect(param); };
    let stopped = false;

    switch (kind) {
      case 'tap': {
        const s = noise(); const f = filt('bandpass', 1400, 1); const gg = g(0.05);
        lfoOn(gg.gain, 0.4, 0.015);
        s.connect(f); f.connect(gg); gg.connect(gain);
        break;
      }
      case 'radio': {
        const lp = filt('lowpass', 1200); const gg = g(0.025);
        [1, 1.5, 2.02].forEach((r, i) => osc('triangle', 220 * r, (i - 1) * 7).connect(lp));
        lp.connect(gg); gg.connect(gain);
        const s = noise(); const bp = filt('bandpass', 2200, 1); const ng = g(0.012);
        s.connect(bp); bp.connect(ng); ng.connect(gain);
        break;
      }
      case 'boiler': {
        const gg = g(0.03); osc('sine', 50).connect(gg); gg.connect(gain);
        every(1100, () => this._blip(gain, 1800, 1200, 0.001, 0.03, 0.05));
        break;
      }
      case 'hum': {
        const g1 = g(0.02), g2 = g(0.008);
        osc('sine', 119).connect(g1); osc('sine', 238).connect(g2);
        g1.connect(gain); g2.connect(gain);
        break;
      }
      case 'swing': every(1400, () => this._creak(gain, 0.10)); break;
      case 'rain': {
        const s = noise(); const f = filt('lowpass', 1500, 0.7); const gg = g(0.07);
        lfoOn(gg.gain, 0.3, 0.025);
        s.connect(f); f.connect(gg); gg.connect(gain);
        break;
      }
      case 'pianoKey': {
        const freq = opts.freq ?? 329.63;
        every((opts.every ?? 2.6) * 1000, () => this._piano(gain, freq, 0.05));
        break;
      }
      case 'birds': {
        randomly(500, 2200, () => {
          for (let k = 0; k < 3; k++) {
            const r = Math.random();
            this._blip(gain, 2600 + r * 900, 3400 + r * 600, 0.003, 0.06, 0.04, ctx.currentTime + k * 0.09);
          }
        });
        break;
      }
      case 'idle': {
        const lp = filt('lowpass', 180); const gg = g(0.035);
        osc('sawtooth', 37).connect(lp); lp.connect(gg); gg.connect(gain);
        lfoOn(gg.gain, 3.8, 0.014);
        const s = noise(); const nl = filt('lowpass', 300); const ng = g(0.01);
        s.connect(nl); nl.connect(ng); ng.connect(gain);
        break;
      }
      case 'fire': {
        const s = noise(); const f = filt('lowpass', 700); const gg = g(0.045);
        lfoOn(gg.gain, 0.6, 0.0135);
        s.connect(f); f.connect(gg); gg.connect(gain);
        randomly(150, 900, () => this._blip(gain, 1900, 1200, 0.001, 0.012, 0.05));
        break;
      }
      case 'simmer': {
        const s = noise(); const f = filt('bandpass', 2300, 0.8); const gg = g(0.02);
        s.connect(f); f.connect(gg); gg.connect(gain);
        randomly(200, 700, () => this._blip(gain, 520 + Math.random() * 400, 900, 0.002, 0.05, 0.03));
        break;
      }
      default: break;
    }

    return {
      stop: (fade = 0.6) => {
        if (stopped) return;
        stopped = true;
        timers.forEach(clearInterval);
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + fade);
        setTimeout(() => {
          for (const n of nodes) { try { n.stop?.(); } catch {} try { n.disconnect(); } catch {} }
          try { gain.disconnect(); } catch {}
          try { panner.disconnect(); } catch {}
        }, fade * 1000 + 100);
      },
      setPosition: (pos) => this._setPannerPos(panner, pos),
      setGain: (v) => gain.gain.setTargetAtTime(v, ctx.currentTime, 0.1),
    };
  }

  _synth(name, opts, out) {
    const ctx = this.ctx, t = ctx.currentTime;
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
      case 'knock': {
        const count = opts.count ?? 3, gap = opts.gap ?? 0.42, soft = !!opts.soft;
        for (let i = 0; i < count; i++) {
          const w = t + i * gap;
          this._noiseBurst(out, 180, 0.12, soft ? 0.14 : 0.26, 'lowpass', w);
          this._blip(out, 95, 60, 0.003, 0.16, soft ? 0.16 : 0.30, w);
        }
        break;
      }
      case 'stepOther': {
        const soft = !!opts.soft;
        this._noiseBurst(out, 90 + Math.random() * 30, 0.14, soft ? 0.05 : 0.10);
        this._blip(out, 72, 48, 0.004, 0.12, soft ? 0.06 : 0.12);
        break;
      }
      case 'breath': {
        const src = this._noiseSource();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(420, t);
        bp.frequency.linearRampToValueAtTime(900, t + 0.95);
        bp.frequency.linearRampToValueAtTime(420, t + 1.9);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.9);
        g.gain.linearRampToValueAtTime(0, t + 1.9);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(t); src.stop(t + 2.0);
        break;
      }
      case 'whisper': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.035, t + 0.2);
        g.gain.setValueAtTime(0.035, t + 1.1);
        g.gain.linearRampToValueAtTime(0, t + 1.6);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
        const lg = ctx.createGain(); lg.gain.value = 0.0175;
        lfo.connect(lg); lg.connect(g.gain);
        g.connect(out);
        for (const f of [700, 1200, 2600]) {
          const src = this._noiseSource();
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
          src.connect(bp); bp.connect(g);
          src.start(t); src.stop(t + 1.7);
        }
        lfo.start(t); lfo.stop(t + 1.7);
        break;
      }
      case 'phone': {
        const rings = opts.rings ?? 1;
        for (let i = 0; i < rings; i++) {
          const w = t + i * 3.0;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, w);
          g.gain.linearRampToValueAtTime(0.05, w + 0.03);
          g.gain.setValueAtTime(0.05, w + 0.97);
          g.gain.linearRampToValueAtTime(0, w + 1.0);
          const trem = ctx.createGain(); trem.gain.value = 0.5;
          const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 20;
          const lg = ctx.createGain(); lg.gain.value = 0.5;
          lfo.connect(lg); lg.connect(trem.gain);
          for (const f of [1100, 1180]) {
            const o = ctx.createOscillator(); o.frequency.value = f;
            o.connect(trem); o.start(w); o.stop(w + 1.05);
          }
          trem.connect(g); g.connect(out);
          lfo.start(w); lfo.stop(w + 1.05);
        }
        break;
      }
      case 'musicbox': {
        const notes = opts.notes ?? [329.63, 392, 440, 392];
        const step = opts.step ?? 0.34, gain = opts.gain ?? 0.05, slow = opts.slow ?? 0;
        let w = t;
        notes.forEach((f, i) => { this._bellTone(out, f * 2, gain, 1.3, w); w += step * (1 + slow * i); });
        break;
      }
      case 'chime': {
        this._noiseBurst(out, 4000, 0.15, 0.02, 'highpass');
        this._bellTone(out, 392, 0.045, 2.6, t + 0.15);
        this._bellTone(out, 329.63, 0.045, 2.8, t + 0.65);
        break;
      }
      case 'static': {
        const dur = opts.dur ?? 0.8;
        const src = this._noiseSource(2.5);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.06, t);
        g.gain.setValueAtTime(0.06, t + Math.max(0.01, dur - 0.005));
        g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(t); src.stop(t + dur + 0.02);
        break;
      }
      case 'slam':
        this._noiseBurst(out, 200, 0.5, 0.35);
        this._blip(out, 70, 35, 0.005, 0.5, 0.5);
        break;
      case 'tinnitus': {
        const o = ctx.createOscillator(); o.frequency.value = 8400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 2.5);
        g.gain.setValueAtTime(0.028, t + 4.5);
        g.gain.linearRampToValueAtTime(0, t + 4.55);
        o.connect(g); g.connect(out);
        o.start(t); o.stop(t + 4.6);
        this.hush(4.5);
        break;
      }
      case 'reverse': {
        const dur = opts.dur ?? 2.2;
        const src = this._noiseSource();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0005, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + dur);
        g.gain.setValueAtTime(0, t + dur + 0.001);
        src.connect(lp); lp.connect(g); g.connect(out);
        src.start(t); src.stop(t + dur + 0.05);
        break;
      }
      case 'toll':
        this._bellTone(out, 98, 0.06, 7);
        this._bellTone(out, 98.7, 0.03, 6.5);
        break;
      case 'heartbeat': {
        const beats = opts.beats ?? 2;
        for (let i = 0; i < beats; i++) {
          const w = t + i * 0.9;
          this._blip(out, 60, 40, 0.005, 0.18, 0.28, w);
          this._blip(out, 58, 40, 0.005, 0.16, 0.20, w + 0.32);
        }
        break;
      }
      case 'handle': {
        for (let i = 0; i < 4; i++) this._blip(out, 1400, 900, 0.002, 0.03, 0.05, t + i * 0.07);
        this._blip(out, 300, 200, 0.004, 0.12, 0.10, t + 0.3);
        break;
      }
      case 'clunk':
        this._blip(out, 260, 120, 0.002, 0.09, 0.14);
        this._noiseBurst(out, 2400, 0.08, 0.03, 'highpass');
        break;
      case 'piano':
        this._piano(out, opts.freq ?? 261.63, opts.gain ?? 0.06);
        break;
      case 'wind': {
        const clicks = opts.clicks ?? 9, gap = opts.gap ?? 0.07;
        for (let i = 0; i < clicks; i++) this._blip(out, 1500, 900, 0.002, 0.03, 0.05, t + i * gap);
        this._blip(out, 300, 180, 0.004, 0.12, 0.06, t + clicks * gap);
        break;
      }
      case 'smallStep': {
        this._noiseBurst(out, 1400, 0.05, opts.soft ? 0.025 : 0.045, 'bandpass');
        this._blip(out, 190, 120, 0.003, 0.07, opts.soft ? 0.03 : 0.05);
        break;
      }
      case 'tick': this._blip(out, 2400, 1700, 0.001, 0.02, opts.gain ?? 0.05); break;
      case 'gasp': {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 1.5;
        bp.frequency.setValueAtTime(600, t);
        bp.frequency.linearRampToValueAtTime(1500, t + 0.3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.12);
        g.gain.linearRampToValueAtTime(0, t + 0.37);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(t, Math.random() * 2); src.stop(t + 0.45);
        break;
      }
      case 'lock':
        this._blip(out, 900, 500, 0.002, 0.05, 0.08);
        this._blip(out, 220, 160, 0.004, 0.14, 0.12, t + 0.12);
        break;
      case 'hummed': {
        const notes = opts.notes ?? [329.63, 392, 440, 392];
        const small = !!opts.small;
        const step = opts.step ?? 0.55, gain = (opts.gain ?? 0.03) * (small ? 0.7 : 1);
        notes.forEach((f, i) => {
          const w = t + i * step;
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = small ? f : f / 2;
          const vib = ctx.createOscillator(); vib.frequency.value = small ? 6.5 : 5.5;
          const vg = ctx.createGain(); vg.gain.value = 6;
          vib.connect(vg); vg.connect(o.detune);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, w);
          g.gain.linearRampToValueAtTime(gain, w + 0.004);
          g.gain.setValueAtTime(gain, w + step * 0.85);
          g.gain.linearRampToValueAtTime(0, w + step * 0.85 + 0.06);
          o.connect(lp); lp.connect(g); g.connect(out);
          o.start(w); vib.start(w); o.stop(w + step + 0.1); vib.stop(w + step + 0.1);
        });
        break;
      }
    }
  }

  _toneSimple(out, freq, dur, gain, type = 'sine', when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  _bellTone(out, freq, gain, decay, when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
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

  _noiseBurst(out, freq, dur, gain, type = 'lowpass', when = null) {
    const ctx = this.ctx, t = when ?? ctx.currentTime;
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
