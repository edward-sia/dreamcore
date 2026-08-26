import * as THREE from 'three';

// The hours: a room that exists at three times — her evening, 3:07, the
// morning the house is emptied — and a helper that crossfades lights, fog
// and grade between them and swaps everything else under a blink.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §4.3

const BASE = { vignette: 1.15, grain: 0.026, desat: 0.16, lift: 0.025, fringe: 0.00045 };
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const emptySpec = () => ({ objects: [], interact: [], lights: [], boxes: [], fog: null, grade: null, mood: null, loops: [], onEnter: [], onLeave: [] });

export class Hours {
  constructor(level, { order = ['night', 'morning', 'evening'], initial = 'night', fade = 1.6, blink = 140, onChange = null } = {}) {
    this.level = level;
    this.order = order.slice();
    this.fade = fade;
    this.blink = blink;
    this.onChange = onChange;
    this.current = null;
    this._initial = initial;
    this._specs = new Map(order.map((h) => [h, emptySpec()]));
    this._t = null;          // the running transition, or null
    this._loops = [];        // the current hour's loop handles
    this._boxes = [];        // the current hour's Box3s, pushed into level.solids
  }

  /** Register what belongs to an hour. May be called many times per hour; specs accumulate. */
  bind(hour, spec = {}) {
    const s = this._specs.get(hour) ?? emptySpec();
    this._specs.set(hour, s);
    for (const o of spec.objects ?? []) s.objects.push(o);
    for (const o of spec.interact ?? []) s.interact.push(o);
    for (const l of spec.lights ?? []) s.lights.push({ light: l.light, intensity: l.intensity ?? l.light.intensity });
    for (const o of spec.colliders ?? []) { o.updateWorldMatrix(true, true); s.boxes.push(new THREE.Box3().setFromObject(o)); }
    for (const [min, max] of spec.blockers ?? []) s.boxes.push(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
    if (spec.fog) s.fog = { ...spec.fog };
    if (spec.grade) s.grade = { ...spec.grade };
    if (spec.mood) s.mood = spec.mood;
    for (const l of spec.loops ?? []) s.loops.push(l);
    if (spec.onEnter) s.onEnter.push(spec.onEnter);
    if (spec.onLeave) s.onLeave.push(spec.onLeave);
    return this;
  }

  get changing() { return this._t !== null; }
  is(hour) { return this.current === hour; }

  /** Apply the initial hour at once — call at the end of build(), before track(). */
  start() {
    const spec = this._specs.get(this._initial);
    for (const s of this._specs.values()) for (const { light } of s.lights) light.intensity = 0;
    for (const { light, intensity } of spec.lights) light.intensity = intensity;
    const scene = this.level.scene;
    if (spec.fog && scene.fog) {
      scene.fog.color.set(spec.fog.color);
      scene.fog.near = spec.fog.near; scene.fog.far = spec.fog.far;
      scene.background?.set?.(spec.fog.color);
    }
    this.level.game.engine.setGrade?.({ ...BASE, ...(spec.grade ?? {}) });
    this._swap(null, this._initial);
  }

  /** Begin the crossfade to `hour`. False if unknown, current, or already changing. */
  set(hour) {
    if (!this._specs.has(hour) || hour === this.current || this._t) return false;
    const from = this.current;
    const fromSpec = from ? this._specs.get(from) : null;
    const toSpec = this._specs.get(hour);
    const lights = new Map();
    for (const s of this._specs.values()) {
      for (const { light } of s.lights) if (!lights.has(light)) lights.set(light, { from: light.intensity, to: 0 });
    }
    for (const { light, intensity } of toSpec.lights) lights.get(light).to = intensity;
    const scene = this.level.scene;
    const fogFrom = scene.fog ? { color: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far } : null;
    const fogTo = toSpec.fog ? { color: new THREE.Color(toSpec.fog.color), near: toSpec.fog.near, far: toSpec.fog.far } : null;
    const gradeFrom = { ...BASE, ...(fromSpec?.grade ?? {}) };
    const gradeTo = { ...BASE, ...(toSpec.grade ?? {}) };
    this._t = { hour, from, time: 0, swapped: false, lights, fogFrom, fogTo, gradeFrom, gradeTo };
    return true;
  }

  next() {
    const i = this.order.indexOf(this.current);
    return this.set(this.order[(i + 1) % this.order.length]);
  }

  /** Drive the fade. Register with level.track(hours). */
  update(dt) {
    const tr = this._t;
    if (!tr) return;
    tr.time += dt;
    const k = Math.min(1, tr.time / this.fade), e = ease(k);
    for (const [light, { from, to }] of tr.lights) light.intensity = from + (to - from) * e;
    const scene = this.level.scene;
    if (tr.fogFrom && tr.fogTo && scene.fog) {
      scene.fog.color.copy(tr.fogFrom.color).lerp(tr.fogTo.color, e);
      scene.fog.near = tr.fogFrom.near + (tr.fogTo.near - tr.fogFrom.near) * e;
      scene.fog.far = tr.fogFrom.far + (tr.fogTo.far - tr.fogFrom.far) * e;
      scene.background?.copy?.(scene.fog.color);
    }
    const g = {};
    for (const key of Object.keys(tr.gradeTo)) g[key] = tr.gradeFrom[key] + (tr.gradeTo[key] - tr.gradeFrom[key]) * e;
    this.level.game.engine.setGrade?.(g);
    if (!tr.swapped && k >= 0.5) {
      tr.swapped = true;
      this.level.game.ui.flash?.('#000', this.blink);
      this._swap(tr.from, tr.hour);
    }
    if (k >= 1) this._t = null;
  }

  // Everything that cannot lerp changes here, under the blink.
  _swap(from, hour) {
    const fromSpec = from ? this._specs.get(from) : null;
    const spec = this._specs.get(hour);
    const show = new Set(spec.objects);
    for (const s of this._specs.values()) for (const o of s.objects) o.visible = show.has(o);
    const touch = new Set(spec.interact);
    for (const s of this._specs.values()) for (const o of s.interact) this.level.game.interaction.setEnabled(o, touch.has(o));
    for (const b of this._boxes) { const i = this.level.solids.indexOf(b); if (i >= 0) this.level.solids.splice(i, 1); }
    this._boxes = spec.boxes.slice();
    this.level.solids.push(...this._boxes);
    for (const h of this._loops) h.stop?.(0.6);
    this._loops = spec.loops.map((l) => this.level.loopAt(l.kind, l.position, l.opts));
    if (spec.mood) this.level.setMood?.(spec.mood);
    const prev = this.current;
    this.current = hour;
    for (const fn of fromSpec?.onLeave ?? []) fn(from);
    for (const fn of spec.onEnter) fn(hour);
    this.onChange?.(hour, prev);
  }
}
