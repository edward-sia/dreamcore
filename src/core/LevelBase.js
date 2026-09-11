import * as THREE from 'three';

const _p = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3();
const _ray = new THREE.Raycaster();

/**
 * Base class for all levels. Subclasses implement build() and may override
 * onUpdate(dt, t) and debugSolve().
 *
 * Contract highlights (full docs in docs/LEVEL_API.md):
 *  - build(): construct geometry into this.root, register colliders/grounds/
 *    interactables, set this.spawn, objective, ambience.
 *  - this.complete(): call exactly once when the level is solved.
 *  - debugSolve(): async; solve the level programmatically through the same
 *    interact handlers a player would trigger (used by automated playtests).
 */
export class LevelBase {
  static meta = {
    id: 0,
    numeral: '0',
    title: 'untitled',
    mood: 'hallway',        // AudioEngine ambience key
    intro: '',              // subtitle whispered on entry
    outro: '',              // interlude text after completion
  };

  /** Note frequencies (C major, octave 4) and a helper: tune('EGAGEGE') → [329.63, …]. */
  static NOTES = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0, B: 493.88 };
  static tune(letters) { return [...letters].map((l) => LevelBase.NOTES[l]); }

  constructor(game) {
    this.game = game;                 // { engine, player, ui, audio, interaction, save }
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.spawn = { position: new THREE.Vector3(0, 0, 0), yaw: 0 };
    this.solids = [];                 // Box3
    this.grounds = [];                // meshes for downward raycast
    this.bounds = null;               // optional Box3 play-area clamp
    this._tickers = new Set();
    this._tracked = new Set();
    this._items = [];
    this._completed = false;
    this._timeouts = new Set();
    this._loops = new Set();
  }

  // ---------- lifecycle (called by main) ----------

  init() {
    this.build();
    this.game.player.setColliders({
      solids: this.solids,
      grounds: this.grounds,
      bounds: this.bounds,
    });
  }

  build() { throw new Error('level must implement build()'); }

  update(dt, t, timerDt = dt) {
    // Snapshot: callbacks created by a callback start counting next frame.
    for (const timer of [...this._timeouts]) {
      if (!this._timeouts.has(timer)) continue;
      timer.remaining -= timerDt;
      if (timer.remaining <= 0) {
        this._timeouts.delete(timer);
        timer.fn();
      }
    }
    for (const fn of this._tickers) fn(dt, t);
    for (const obj of this._tracked) obj.update?.(dt, t);
    this.onUpdate?.(dt, t);
  }

  dispose() {
    this._timeouts.clear();
    for (const h of this._loops) { try { h.stop?.(0.3); } catch {} }
    this._loops.clear();
    this._tickers.clear();
    this._tracked.clear();
    this.game.audio.setDread?.(0);
    this.game.interaction.clear();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap']) {
          m[k]?.dispose?.();
        }
        m.dispose?.();
      }
    });
    this.scene.clear();
  }

  // ---------- scene helpers ----------

  add(...objects) {
    this.root.add(...objects);
    return objects[0];
  }

  /** Register a mesh (or group) as a solid obstacle. Returns the object. */
  addCollider(object, { alsoGround = false } = {}) {
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    this.solids.push(box);
    if (alsoGround) this.grounds.push(object);
    return object;
  }

  /** Register an invisible blocker without geometry. Returns the Box3 (see removeBlocker). */
  addBlocker(min, max) {
    const box = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
    this.solids.push(box);
    return box;
  }

  removeBlocker(box) {
    const i = this.solids.indexOf(box);
    if (i >= 0) this.solids.splice(i, 1);
  }

  /** Remove the collider that was created for an object (e.g. an opened door). */
  removeColliderOf(object) {
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    const c = box.getCenter(new THREE.Vector3());
    let bestIdx = -1, bestD = Infinity;
    this.solids.forEach((b, i) => {
      const d = b.getCenter(new THREE.Vector3()).distanceToSquared(c);
      if (d < bestD) { bestD = d; bestIdx = i; }
    });
    if (bestIdx >= 0 && bestD < 4) this.solids.splice(bestIdx, 1);
  }

  /** Register a mesh as walkable ground (raycast target). */
  addGround(object) {
    this.grounds.push(object);
    return object;
  }

  /** Objects with an .update(dt, t) method (doors, water, dust, valves…). */
  track(object) {
    this._tracked.add(object);
    return object;
  }

  tick(fn) {
    this._tickers.add(fn);
    return () => this._tickers.delete(fn);
  }

  after(seconds, fn) {
    const timer = { remaining: seconds, fn };
    this._timeouts.add(timer);
    return timer;
  }

  /** Cancel a room-time callback returned by after(). */
  cancelAfter(timer) { this._timeouts.delete(timer); }

  // ---------- interaction / narrative ----------

  interact(object, opts) {
    this.game.interaction.add(object, opts);
    return object;
  }

  setObjective(text) { this.game.ui.setObjective(text); }

  rememberHours() {
    this.learnClue({
      id: `l${this.constructor.meta.id}-hours`,
      title: 'the three hours',
      body: 'Turn the clock to move between 3:07, the morning, and her evening.\n' +
        'Look in every hour. Things you carry travel with you.\n' +
        'Leave things for the child at 3:07; the other hours show you what belongs where.',
    });
  }

  subtitle(text, duration) { this.game.ui.subtitle(text, duration); }

  /** Pick up a clue: journal entry + paper overlay + sound. */
  giveNote({ id, title, body }, onClose) {
    this.game.audio.sfx('paper');
    this.game.ui.addClue({ id, title, body });
    this.game.ui.showNote({ title, body }, onClose);
  }

  /** Journal-only clue (something seen, not held). */
  learnClue({ id, title, body }) {
    this.game.audio.sfx('clue');
    this.game.ui.addClue({ id, title, body });
  }

  giveItem(item) {
    this.game.audio.sfx('pickup');
    this._items.push(item);
    this.game.ui.setItems(this._items);
  }

  hasItem(id) { return this._items.some((i) => i.id === id); }

  removeItem(id) {
    this._items = this._items.filter((i) => i.id !== id);
    this.game.ui.setItems(this._items);
  }

  playSound(name, opts) { this.game.audio.sfx(name, opts); }

  // ---------- positional sound, dread, blink ----------

  playSoundAt(name, position, opts) { this.game.audio.sfxAt?.(name, position, opts); }

  /**
   * A walk you hear: one positional `sound` every `every` seconds, `stride`
   * metres apart along the polyline `points` ([{x,y,z}, …]). Steps are
   * `after()` timeouts, so dispose() clears them. Returns cancel().
   */
  footsteps(points, { stride = 0.55, every = 0.5, sound = 'smallStep', opts = {}, onStep = null, onDone = null } = {}) {
    const pts = points.map((p) => new THREE.Vector3(p.x, p.y ?? 0, p.z));
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); segs.push(l); total += l; }
    const at = (d) => {
      let acc = 0;
      for (let i = 0; i < segs.length; i++) {
        if (d <= acc + segs[i] || i === segs.length - 1) {
          const k = segs[i] > 0 ? Math.min(1, Math.max(0, (d - acc) / segs[i])) : 0;
          return new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], k);
        }
        acc += segs[i];
      }
      return pts[pts.length - 1].clone();
    };
    const n = Math.floor(total / stride) + 1;
    const ids = [];
    let cancelled = false;
    for (let i = 0; i < n; i++) {
      ids.push(this.after(i * every, () => {
        if (cancelled) return;
        const pos = at(Math.min(total, i * stride));
        this.playSoundAt(sound, pos, opts);
        onStep?.(i, pos);
        if (i === n - 1) onDone?.();
      }));
    }
    return () => {
      cancelled = true;
      for (const id of ids) this.cancelAfter(id);
    };
  }

  /** A sustained positional sound; stopped automatically when the level is disposed. */
  loopAt(kind, position, opts) {
    const h = this.game.audio.loopAt(kind, position, opts);
    this._loops.add(h);
    return h;
  }

  dread(v) { this.game.audio.setDread?.(v); }

  hush(seconds, depth) { this.game.audio.hush?.(seconds, depth); }

  /** Change the ambience mid-room (the hours use it). */
  setMood(key) { this.game.audio.setAmbience?.(key); }

  /** A one-blink post-process spike; `flash` > 0 also blacks the screen for that many ms. */
  flinch({ grain = 0.3, fringe = 0.008, desat = 0.6, duration = 0.35, flash = 0 } = {}) {
    this.game.engine.pulseGrade?.({ grain, fringe, desat, duration });
    if (flash > 0) this.game.ui.flash?.('#000', flash);
  }

  // ---------- seen / unseen ----------

  /** Is `obj` inside the player's view cone (and not behind an occluder)? */
  isSeen(obj, { angleDeg = 55, maxDist = Infinity, occluders = null } = {}) {
    const cam = this.game.engine.camera;
    obj.getWorldPosition(_p);
    cam.getWorldPosition(_c);
    _d.subVectors(_p, _c);
    const dist = _d.length();
    if (dist > maxDist) return false;
    if (dist < 1e-6) return true;
    _d.divideScalar(dist);
    cam.getWorldDirection(_f);
    if (_f.dot(_d) < Math.cos(angleDeg * Math.PI / 180)) return false;
    if (occluders && occluders.length) {
      _ray.set(_c, _d);
      _ray.far = Math.max(0, dist - 0.05);
      if (_ray.intersectObjects(occluders, true).length) return false;
    }
    return true;
  }

  /**
   * Is the camera inside `obj`'s forward cone (its local +Z — the front of a
   * figure or a child)? `eye` is a world-units offset added to obj's position
   * (a child's eyes are about 0.95 m up). The mirror of isSeen.
   */
  isSeenBy(obj, { angleDeg = 30, maxDist = 8, occluders = null, eye = null } = {}) {
    const cam = this.game.engine.camera;
    obj.getWorldPosition(_p);
    if (eye) _p.add(eye);
    cam.getWorldPosition(_c);
    _d.subVectors(_c, _p);
    const dist = _d.length();
    if (dist > maxDist) return false;
    if (dist < 1e-6) return true;
    _d.divideScalar(dist);
    obj.getWorldDirection(_f);
    if (_f.dot(_d) < Math.cos(angleDeg * Math.PI / 180)) return false;
    if (occluders && occluders.length) {
      _ray.set(_p, _d);
      _ray.far = Math.max(0, dist - 0.05);
      if (_ray.intersectObjects(occluders, true).length) return false;
    }
    return true;
  }

  /** Call fn(obj) once obj has been out of view for minTime seconds. Returns an unregister function. */
  whenUnseen(obj, fn, { minTime = 0.4, angleDeg = 55, maxDist = Infinity, occluders = null, once = true } = {}) {
    let acc = 0, wait = false;
    const off = this.tick((dt) => {
      if (this.isSeen(obj, { angleDeg, maxDist, occluders })) { acc = 0; wait = false; return; }
      if (wait) return;
      acc += dt;
      if (acc >= minTime) {
        if (once) off(); else { acc = 0; wait = true; }
        fn(obj);
      }
    });
    return off;
  }

  /** Call fn(obj) once obj has been in view for minTime seconds. Returns an unregister function. */
  whenSeen(obj, fn, { minTime = 0.15, angleDeg = 40, maxDist = 30, occluders = null, once = true } = {}) {
    let acc = 0, wait = false;
    const off = this.tick((dt) => {
      if (!this.isSeen(obj, { angleDeg, maxDist, occluders })) { acc = 0; wait = false; return; }
      if (wait) return;
      acc += dt;
      if (acc >= minTime) {
        if (once) off(); else { acc = 0; wait = true; }
        fn(obj);
      }
    });
    return off;
  }

  // ---------- captions ----------

  /** A bracketed subtitle for a sound: "[knocking]" — with a direction word if captions are on. */
  cue(text, worldPos = null) {
    let s = `[${text}]`;
    if (worldPos && this.game.save?.data?.captions) s += ` — ${this.directionWord(worldPos)}`;
    this.game.ui.subtitle(s, 3.2, { voice: 'cue' });
  }

  /** ahead / behind you / to your left / to your right / above you, relative to the camera. */
  directionWord(worldPos) {
    const cam = this.game.engine.camera;
    cam.getWorldPosition(_c);
    const dx = worldPos.x - _c.x, dy = worldPos.y - _c.y, dz = worldPos.z - _c.z;
    if (dy > 1.5 && Math.hypot(dx, dz) < 5) return 'above you';
    cam.getWorldDirection(_f);
    const fwd = Math.atan2(-_f.x, -_f.z);          // player yaw convention: forward = (-sin yaw, 0, -cos yaw)
    const to = Math.atan2(-dx, -dz);
    let a = to - fwd;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    const deg = Math.abs(a) * 180 / Math.PI;
    if (deg < 35) return 'ahead';
    if (deg > 145) return 'behind you';
    return a > 0 ? 'to your left' : 'to your right';
  }

  /** Mark the level solved. Fades out and advances — call exactly once. */
  complete() {
    if (this._completed) return;
    this._completed = true;
    this.game.onLevelComplete?.();
  }

  get isCompleted() { return this._completed; }

  // ---------- automated playtest hook ----------

  /** Override: solve the level through its real handlers. */
  async debugSolve() {
    throw new Error(`level ${this.constructor.meta.id} has no debugSolve()`);
  }

  /** Helper for debugSolve: trigger an interactable as the player would. */
  debugInteract(object) {
    return this.game.interaction.triggerObject(object);
  }

  debugWait(s) {
    return new Promise((r) => setTimeout(r, s * 1000));
  }
}
