import * as THREE from 'three';

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

  update(dt, t) {
    for (const fn of this._tickers) fn(dt, t);
    for (const obj of this._tracked) obj.update?.(dt, t);
    this.onUpdate?.(dt, t);
  }

  dispose() {
    for (const id of this._timeouts) clearTimeout(id);
    this._timeouts.clear();
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

  /** Register an invisible blocker without geometry. */
  addBlocker(min, max) {
    this.solids.push(new THREE.Box3(
      new THREE.Vector3(...min), new THREE.Vector3(...max)
    ));
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
    const id = setTimeout(() => { this._timeouts.delete(id); fn(); }, seconds * 1000);
    this._timeouts.add(id);
    return id;
  }

  // ---------- interaction / narrative ----------

  interact(object, opts) {
    this.game.interaction.add(object, opts);
    return object;
  }

  setObjective(text) { this.game.ui.setObjective(text); }

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
