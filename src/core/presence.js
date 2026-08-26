import * as THREE from 'three';

// The figure that follows the player through rooms XI–XV: a dark shape from
// primitives, never lit, no face. Presence moves it between stations only
// while the player is not looking (see the scare contract in the spec, §1.2).

const _tmp = new THREE.Vector3();

/** A dark human silhouette, `height` metres tall. Local +Z is its front. */
export function makeFigure({ height = 1.95 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 1, metalness: 0 });
  const coatH = height * 0.62;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, height * 0.12, 8), mat);
  legs.position.y = height * 0.06;
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, coatH, 10), mat);
  coat.position.y = height * 0.06 + coatH / 2;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
  shoulders.scale.set(1, 0.45, 0.7);
  shoulders.position.y = height * 0.70;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, height * 0.08, 8), mat);
  neck.position.y = height * 0.76;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat);
  head.position.y = height * 0.885;
  g.add(legs, coat, shoulders, neck, head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.userData.isFigure = true;
  g.faceToward = (p) => { g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z); };
  g.setHeight = (h) => { g.scale.setScalar(h / height); };
  return g;
}

/**
 * Someone small: the figure's primitives at child height, but lit — a warm
 * grey, casting shadows, no face — with a torch on its brow that points
 * along its front (local +Z). Rooms animate it; update() is a no-op so
 * level.track(child) is harmless.
 */
export function makeChild({ height = 1.12 } = {}) {
  const g = new THREE.Group();
  const k = height / 1.12;
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a8c80, roughness: 0.9, metalness: 0 });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * k, 0.08 * k, height * 0.22, 8), mat);
  legs.position.y = height * 0.11;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * k, 0.13 * k, height * 0.42, 10), mat);
  body.position.y = height * 0.43;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.14 * k, 10, 8), mat);
  shoulders.scale.set(1, 0.45, 0.7);
  shoulders.position.y = height * 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085 * k, 12, 10), mat);
  head.position.y = height * 0.9;
  g.add(legs, body, shoulders, head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  const torch = new THREE.SpotLight(0xffe7b8, 0, 11, 0.36, 0.55, 1.4);
  torch.position.set(0, 0.78 * height, 0.12);
  const target = new THREE.Object3D();
  target.position.set(0, 0.6 * height, 4);
  g.add(target);
  torch.target = target;
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe7b8, emissiveIntensity: 0 })
  );
  lens.position.copy(torch.position);
  lens.castShadow = false;
  g.add(torch, lens);
  g._lens = lens;
  g.torch = torch;
  g.setTorch = (on) => { torch.intensity = on ? 6 : 0; lens.material.emissiveIntensity = on ? 2.5 : 0; };
  g.faceToward = (p) => { g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z); };
  g.setHeight = (h) => { g.scale.setScalar(h / height); };
  g.update = () => {};
  g.userData.isChild = true;
  return g;
}

/**
 * Moves a figure between fixed stations, one hop per `minUnseen` seconds of
 * not being looked at. Register with level.track(presence).
 */
export class Presence {
  constructor(level, figure, { stations = [], minUnseen = 0.6, angleDeg = 55, occluders = null, onArrive = null } = {}) {
    this.level = level;
    this.figure = figure;
    this.stations = stations.map((s) => new THREE.Vector3(s.x, s.y, s.z));
    this.minUnseen = minUnseen;
    this.angleDeg = angleDeg;
    this.occluders = occluders;
    this.onArrive = onArrive;
    this.index = -1;
    this.enabled = true;
    this._target = -1;
    this._acc = 0;
    this._walk = null;
  }

  placeAt(i) {
    const s = this.stations[i];
    if (!s) return;
    this.index = i;
    this.figure.position.copy(s);
    this.figure.visible = true;
  }

  hide() {
    this.figure.visible = false;
    this.enabled = false;
    this._target = -1;
    this._walk = null;
  }

  /** Arm: hop one station per unseen interval until index === i. */
  advanceTo(i) {
    this._target = Math.min(i, this.stations.length - 1);
    this._acc = 0;
  }

  isArmed() { return this._target > this.index && !this._walk; }

  /** Walk in the open at `speed` m/s (used once, in XIV's finale). Ignores the unseen rule. */
  walkTo(to, speed = 1.3, onDone = null) {
    this._walk = { to: new THREE.Vector3(to.x, to.y, to.z), speed, onDone };
    this._target = -1;
    this.figure.visible = true;
  }

  update(dt) {
    const f = this.figure;
    if (this._walk) {
      const w = this._walk;
      _tmp.subVectors(w.to, f.position);
      const d = _tmp.length();
      const step = w.speed * dt;
      if (d <= step) {
        f.position.copy(w.to);
        this._walk = null;
        w.onDone?.();
      } else {
        _tmp.divideScalar(d);
        f.rotation.y = Math.atan2(_tmp.x, _tmp.z);
        f.position.addScaledVector(_tmp, step);
      }
      return;
    }
    if (f.visible) f.faceToward(this.level.game.player.position);
    if (!this.enabled || !this.isArmed()) { this._acc = 0; return; }
    if (this.level.isSeen(f, { angleDeg: this.angleDeg, occluders: this.occluders })) { this._acc = 0; return; }
    this._acc += dt;
    if (this._acc >= this.minUnseen) {
      this._acc = 0;
      this.placeAt(this.index + 1);
      this.onArrive?.(this.index);
    }
  }
}
