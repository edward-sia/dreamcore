import * as THREE from 'three';

const MAX_DIST = 3.0;

function visibleInScene(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

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
      if (e.code === 'KeyE' && !e.repeat && !e.defaultPrevented && this.enabled && this.current) this.trigger();
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.enabled && this.current && document.pointerLockElement) this.trigger();
    });
  }

  add(object, opts) {
    object.traverse((o) => { o.userData.__interactRoot = object; });
    this._items.set(object, {
      prompt: opts.prompt ?? 'touch',
      onInteract: opts.onInteract,
      once: opts.once ?? false,
      enabled: opts.enabled ?? true,
      spent: false,
      distance: opts.distance ?? MAX_DIST,
    });
  }

  setEnabled(object, on) {
    // `once` means once per room: something that enables a whole list at a
    // time (the hours) must not hand a spent one-shot back to the player.
    const it = this._items.get(object);
    if (it) it.enabled = on && !it.spent;
  }

  setPrompt(object, prompt) {
    const it = this._items.get(object);
    if (it) {
      it.prompt = prompt;
      if (this.current === object) this.ui.setPrompt(prompt);
    }
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
    if (it.once) { it.enabled = false; it.spent = true; }
    it.onInteract?.(object);
    return true;
  }

  update() {
    if (!this.enabled || this.ui.modalOpen) {
      this.current = null;
      this.ui.setPrompt(null);
      return;
    }
    this._ray.setFromCamera(this._center, this.camera);
    this._ray.far = MAX_DIST;

    let best = null, bestDist = Infinity, bestItem = null;
    const targets = [];
    for (const [obj, it] of this._items) {
      if (it.enabled && visibleInScene(obj)) {
        targets.push(obj);
        this._ray.far = Math.max(this._ray.far, it.distance);
      }
    }
    const hits = this._ray.intersectObjects(targets, true);
    for (const h of hits) {
      if (!visibleInScene(h.object)) continue;
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

  /** A tap fires only when it lands on the current gaze target (touch mode). */
  triggerFromPoint(ndcX, ndcY) {
    if (!this.enabled || this.ui.modalOpen || !this.current || !visibleInScene(this.current)) return false;
    const it = this._items.get(this.current);
    if (!it || !it.enabled) return false;
    this._ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    this._ray.far = it.distance;
    if (!this._ray.intersectObject(this.current, true).some(h => visibleInScene(h.object))) return false;
    this.trigger();
    return true;
  }

  /** Fire the current gaze target — exactly what E does. */
  trigger() {
    if (!this.enabled || this.ui.modalOpen || !this.current || !visibleInScene(this.current)) return;
    const obj = this.current;
    const it = this._items.get(obj);
    if (!it || !it.enabled) return;
    if (it.once) { it.enabled = false; it.spent = true; }
    this.ui.setPrompt(null);
    this.current = null;
    it.onInteract?.(obj);
  }
}
