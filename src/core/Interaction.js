import * as THREE from 'three';

const MAX_DIST = 3.0;

export class Interaction {
  constructor(camera, ui) {
    this.camera = camera;
    this.ui = ui;
    this.enabled = false;
    this._items = new Map(); // object3d -> {prompt, onInteract, once, enabled, distance}
    this._ray = new THREE.Raycaster();
    this._center = new THREE.Vector2(0, 0);
    this.current = null;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.enabled && this.current) this._trigger();
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.enabled && this.current && document.pointerLockElement) this._trigger();
    });
  }

  add(object, opts) {
    object.traverse((o) => { o.userData.__interactRoot = object; });
    this._items.set(object, {
      prompt: opts.prompt ?? 'touch',
      onInteract: opts.onInteract,
      once: opts.once ?? false,
      enabled: opts.enabled ?? true,
      distance: opts.distance ?? MAX_DIST,
    });
  }

  setEnabled(object, on) {
    const it = this._items.get(object);
    if (it) it.enabled = on;
  }

  setPrompt(object, prompt) {
    const it = this._items.get(object);
    if (it) it.prompt = prompt;
  }

  remove(object) {
    this._items.delete(object);
    if (this.current === object) this.current = null;
  }

  clear() {
    this._items.clear();
    this.current = null;
  }

  /** Programmatic trigger for automated playtests. */
  triggerObject(object) {
    const it = this._items.get(object);
    if (!it || !it.enabled) return false;
    if (it.once) it.enabled = false;
    it.onInteract?.(object);
    return true;
  }

  update() {
    if (!this.enabled) {
      if (this.current) { this.current = null; this.ui.setPrompt(null); }
      return;
    }
    this._ray.setFromCamera(this._center, this.camera);
    this._ray.far = MAX_DIST;

    let best = null, bestDist = Infinity, bestItem = null;
    const targets = [];
    for (const [obj, it] of this._items) {
      if (it.enabled && obj.visible) targets.push(obj);
    }
    const hits = this._ray.intersectObjects(targets, true);
    for (const h of hits) {
      const root = h.object.userData.__interactRoot;
      if (!root) continue;
      const it = this._items.get(root);
      if (!it || !it.enabled) continue;
      if (h.distance <= it.distance && h.distance < bestDist) {
        best = root; bestDist = h.distance; bestItem = it;
      }
    }

    if (best !== this.current) {
      this.current = best;
      this.ui.setPrompt(best ? bestItem.prompt : null);
    }
  }

  _trigger() {
    const obj = this.current;
    const it = this._items.get(obj);
    if (!it || !it.enabled) return;
    if (it.once) it.enabled = false;
    this.ui.setPrompt(null);
    this.current = null;
    it.onInteract?.(obj);
  }
}
