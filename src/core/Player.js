import * as THREE from 'three';

const EYE_HEIGHT = 1.62;
const RADIUS = 0.34;
const WALK_SPEED = 2.7;
const RUN_SPEED = 4.6;
const ACCEL = 14;
const STEP_UP = 0.55;

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;

    this.position = new THREE.Vector3(0, EYE_HEIGHT, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 1.0;
    this.enabled = false;       // input processed?
    this.frozen = false;        // overlay open — look/move suspended, physics still settles
    this.noclip = false;
    this.touchMode = false;     // no pointer lock; TouchControls feeds inputs
    this._touchMove = { fwd: 0, strafe: 0, hurry: false };

    this.solids = [];           // THREE.Box3 — walls, furniture
    this.groundMeshes = [];     // meshes raycast downward for floor height
    this.bounds = null;         // optional Box3 clamp so you can't walk off the dream

    this._keys = new Set();
    this._bobPhase = 0;
    this._bobAmp = 0;
    this._grounded = false;
    this._vy = 0;
    this._ray = new THREE.Raycaster();
    this._down = new THREE.Vector3(0, -1, 0);
    this._stepDistance = 0;
    this.onFootstep = null;

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this._keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => this._keys.delete(e.code));
    window.addEventListener('blur', () => this._keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || this.frozen) return;
      if (document.pointerLockElement !== this.dom && !window.__TEST_MODE__) return;
      const s = 0.0021 * this.sensitivity;
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
  }

  /** Analog move from the touch stick; zeroed when the thumb lifts. */
  setMoveInput(fwd, strafe, hurry) {
    this._touchMove.fwd = fwd;
    this._touchMove.strafe = strafe;
    this._touchMove.hurry = hurry;
  }

  /** Look deltas from a touch drag — same clamps as the mouse. */
  addLook(dyaw, dpitch) {
    if (!this.enabled || this.frozen) return;
    this.yaw += dyaw;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dpitch));
  }

  requestLock() {
    if (window.__TEST_MODE__ || this.touchMode) return;
    this.dom.requestPointerLock({ unadjustedMovement: true }).catch?.(() => {
      try { this.dom.requestPointerLock()?.catch?.(() => {}); } catch { /* headless */ }
    });
  }

  get isLocked() {
    return window.__TEST_MODE__ || this.touchMode || document.pointerLockElement === this.dom;
  }

  spawnAt(pos, yaw = 0) {
    this.position.set(pos.x, (pos.y ?? 0) + EYE_HEIGHT, pos.z);
    this.yaw = yaw;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this._vy = 0;
    this._syncCamera(0);
  }

  teleport(x, z, yaw = this.yaw, y = null) {
    this.position.x = x;
    this.position.z = z;
    if (y !== null) this.position.y = y + EYE_HEIGHT;
    this.yaw = yaw;
    this._syncCamera(0);
  }

  setColliders({ solids = [], grounds = [], bounds = null }) {
    this.solids = solids;
    this.groundMeshes = grounds;
    this.bounds = bounds;
  }

  update(dt) {
    if (dt <= 0) return;

    // desired planar velocity from keys
    let fwd = 0, str = 0;
    if (this.enabled && !this.frozen) {
      if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) fwd += 1;
      if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) fwd -= 1;
      if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) str -= 1;
      if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) str += 1;
      fwd += this._touchMove.fwd;
      str += this._touchMove.strafe;
    }
    const running = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight') || this._touchMove.hurry;
    const speed = running ? RUN_SPEED : WALK_SPEED;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = (-sin * fwd + cos * str);
    const wishZ = (-cos * fwd - sin * str);
    const len = Math.hypot(wishX, wishZ) || 1;

    // Analog magnitude: keys give hypot 0, 1 or √2, so min(1, …) reproduces
    // the old binary behavior exactly; the stick gives the values between.
    const mag = Math.min(1, Math.hypot(fwd, str));
    const targetX = (wishX / len) * speed * mag;
    const targetZ = (wishZ / len) * speed * mag;

    const k = 1 - Math.exp(-ACCEL * dt);
    this.velocity.x += (targetX - this.velocity.x) * k;
    this.velocity.z += (targetZ - this.velocity.z) * k;

    // integrate horizontal
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    if (!this.noclip) this._collideXZ();

    // ground: raycast down from chest height
    const footY = this.position.y - EYE_HEIGHT;
    let groundY = null;
    if (this.groundMeshes.length) {
      this._ray.set(
        new THREE.Vector3(this.position.x, footY + 1.2, this.position.z),
        this._down
      );
      this._ray.far = 30;
      const hits = this._ray.intersectObjects(this.groundMeshes, true);
      if (hits.length) groundY = hits[0].point.y;
    } else {
      groundY = 0;
    }

    if (groundY !== null && footY - groundY <= STEP_UP + 0.01) {
      // snap / smooth to ground
      this._vy = 0;
      this._grounded = true;
      const targetFoot = groundY;
      const ky = 1 - Math.exp(-18 * dt);
      this.position.y += (targetFoot + EYE_HEIGHT - this.position.y) * ky;
    } else {
      this._grounded = false;
      this._vy -= 12 * dt;
      this.position.y += this._vy * dt;
      if (groundY !== null && this.position.y - EYE_HEIGHT < groundY) {
        this.position.y = groundY + EYE_HEIGHT;
        this._vy = 0;
        this._grounded = true;
      }
    }

    if (this.bounds) {
      this.position.x = Math.max(this.bounds.min.x, Math.min(this.bounds.max.x, this.position.x));
      this.position.z = Math.max(this.bounds.min.z, Math.min(this.bounds.max.z, this.position.z));
    }

    // head bob + footsteps, scaled by actual planar speed
    const planar = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = planar > 0.4 && this._grounded;
    const targetAmp = moving ? Math.min(planar / WALK_SPEED, 1.6) : 0;
    this._bobAmp += (targetAmp - this._bobAmp) * Math.min(1, 8 * dt);
    if (moving) {
      this._bobPhase += dt * (running ? 9.4 : 6.8);
      this._stepDistance += planar * dt;
      if (this._stepDistance > (running ? 2.1 : 1.55)) {
        this._stepDistance = 0;
        this.onFootstep?.(running);
      }
    }

    this._syncCamera(dt);
  }

  _collideXZ() {
    const p = this.position;
    for (const box of this.solids) {
      const footY = p.y - EYE_HEIGHT;
      const headY = p.y + 0.15;
      if (box.max.y < footY + STEP_UP || box.min.y > headY) continue; // step over low / walk under high
      const cx = Math.max(box.min.x, Math.min(box.max.x, p.x));
      const cz = Math.max(box.min.z, Math.min(box.max.z, p.z));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          const push = (RADIUS - d) / d;
          p.x += dx * push;
          p.z += dz * push;
        } else {
          // center inside the box: push out along smallest penetration axis
          const outL = p.x - box.min.x + RADIUS, outR = box.max.x - p.x + RADIUS;
          const outB = p.z - box.min.z + RADIUS, outF = box.max.z - p.z + RADIUS;
          const m = Math.min(outL, outR, outB, outF);
          if (m === outL) p.x = box.min.x - RADIUS;
          else if (m === outR) p.x = box.max.x + RADIUS;
          else if (m === outB) p.z = box.min.z - RADIUS;
          else p.z = box.max.z + RADIUS;
        }
      }
    }
  }

  _syncCamera(dt) {
    const bobY = Math.sin(this._bobPhase * 2) * 0.028 * this._bobAmp;
    const bobX = Math.cos(this._bobPhase) * 0.012 * this._bobAmp;
    this.camera.position.set(
      this.position.x + Math.cos(this.yaw) * bobX,
      this.position.y + bobY,
      this.position.z - Math.sin(this.yaw) * bobX
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this._bobPhase) * 0.0035 * this._bobAmp);
  }
}
