import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, noiseMap } from '../core/textures.js';
import { makeSky, makeDoor, makeWall, makeBench, applyFog } from '../core/props.js';
import { makeFigure, Presence } from '../core/presence.js';

// XIV — The Playground
// Hide-and-seek in the dark. The figure comes only while you are hidden and
// only while you are not looking; two knocks mean "still there — you can come
// out". After the third place it stands in the open, then walks to the gate,
// unlocks it, and goes on ahead.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.4

const V = (x, y, z) => ({ x, y, z });

// Where the figure stands. Nothing here is ever nearer than about two metres
// to a place the player can be while the figure is allowed to move — Presence
// does no distance checking of its own, so this table plus _presenceStep()'s
// SAFE guard is the whole of the two-metre promise (spec §1.2 clause 2).
const STATIONS = [
  V(-1, 0, -11.5),                                   // 0   S0  start, by the gate
  V(4, 0, -8.5), V(8.5, 0, -9.2), V(13.9, 0, -6),    // 1-3 S1..S3, S3 outside the pipe's east mouth
  V(5, 0, -2),                                       // 4   R1  rest, in the open
  V(9, 0, -6), V(12, 0, -8), V(10.1, 0, -12.1),      // 5-7 S4..S6, S6 west of the shed
  V(7, 0, 1),                                        // 8   R2  rest, mid-playground
  V(-3, 0, 3), V(-6.5, 0, 6.5), V(-7.4, 0, 8.15),    // 9-11 S7..S9, S9 at the east end of the gap
  V(-7.6, 0, 4.6),                                   // 12  R3  rest, in the open
];

// The three hiding places, and two decoys that answer with a nudge.
const HIDES = {
  pipe:    new THREE.Box3(new THREE.Vector3(9.4, 0, -6.7), new THREE.Vector3(11.6, 2, -5.3)),
  shed:    new THREE.Box3(new THREE.Vector3(12.2, 0, -12.6), new THREE.Vector3(14.4, 2, -11.3)),
  shelter: new THREE.Box3(new THREE.Vector3(-12.5, 0, 7.6), new THREE.Vector3(-9.5, 2, 8.6)),
  frame:   new THREE.Box3(new THREE.Vector3(9, 0, 3), new THREE.Vector3(11, 2, 5)),
  slide:   new THREE.Box3(new THREE.Vector3(7, 0, -5), new THREE.Vector3(9, 2, -3)),
};

const PHASES = [
  { hide: 'pipe', hideStation: 3, rest: 4, objective: 'the second place' },
  { hide: 'shed', hideStation: 7, rest: 8, objective: 'the last place' },
  { hide: 'shelter', hideStation: 11, rest: 12, objective: '' },
];

const GATE = V(0, 0, -13);
const PADLOCK = V(0.5, 1.05, -12.95);
const LAMP = V(2, 4.2, 2);
const SWING = V(-9, 2.4, -3);
const SAFE = 2.1;              // metres the figure keeps between itself and the player

const RHYME = [
  'one, two — you’re in the pipe where the slide comes down.',
  'three, four — you’re behind the shed at the edge of the ground.',
  'five, six — you’re in the dark behind the bench where the big ones sat.',
  'seven, eight — I’ve counted slow. nine — I’ve counted slower than that.',
  'ten. coming, ready or not.',
];

// The same words, broken to fit the painted panel on the shelter wall.
const PAINTED = [
  'one, two — you’re in the pipe',
  'where the slide comes down.',
  'three, four — you’re behind the shed',
  'at the edge of the ground.',
  'five, six — you’re in the dark behind',
  'the bench where the big ones sat.',
  'seven, eight — I’ve counted slow.',
  'nine — I’ve counted slower than that.',
  'ten. coming, ready or not.',
].join('\n');

const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level14 extends LevelBase {
  static meta = {
    id: 14,
    numeral: 'XIV',
    title: 'The Playground',
    mood: 'playground',
    grade: GRADE,
    intro: 'Coming, ready or not.',
    outro:
      'You hid where you always hid,\n' +
      'and she found you where she always found you,\n' +
      'and pretended, again, to be surprised.',
  };

  build() {
    applyFog(this.scene, '#1c1e2a', 6, 60);
    this.add(makeSky({ top: '#0d1020', mid: '#232a3d', bottom: '#4a4256' }));

    // The spec's 0.55 / 0.35 rendered as a black frame under this renderer's
    // ACES tone mapping, and its moon at (-10, 20, 10) is so near overhead
    // that every upright surface stayed black (see the report). Same colours,
    // same "one faint moon, one hemisphere" shape, lower and stronger.
    this.add(new THREE.HemisphereLight(0x3d4660, 0x0d0e14, 5.5));
    const moon = new THREE.DirectionalLight(0x6d7aa0, 3.2);
    moon.position.set(-12, 13, 15);
    moon.castShadow = true;
    moon.shadow.camera.left = -20; moon.shadow.camera.right = 20;
    moon.shadow.camera.top = 20; moon.shadow.camera.bottom = -20;
    moon.shadow.camera.far = 60;
    moon.shadow.mapSize.set(1024, 1024);
    this.add(moon);
    // The moon comes from +Z, so every face turned toward the playground —
    // the school wall, the shelter's painted back — takes none of it. A dim
    // cold fill off the estate keeps those faces dark rather than black.
    const glow = new THREE.DirectionalLight(0x39456b, 2.6);
    glow.position.set(4, 9, -26);
    this.add(glow);

    this._steel = new THREE.MeshStandardMaterial({
      color: 0x5c6066, metalness: 0.65, roughness: 0.45,
      bumpMap: noiseMap({ size: 128, strength: 26, repeat: [3, 3] }), bumpScale: 0.4,
    });
    this._wood = makeMat('wood', { base: '#4a3a2c', repeat: [1, 1] });
    this._hedgeMat = makeMat('grass', { base: '#22301f', repeat: [4, 2] });

    const tarmac = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 28),
      makeMat('asphalt', { base: '#3e3f44', repeat: [10, 8] })
    );
    tarmac.rotation.x = -Math.PI / 2;
    tarmac.receiveShadow = true;
    this.add(tarmac);
    this.addGround(tarmac);

    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 8),
      makeMat('asphalt', { base: '#33343a', repeat: [1, 3] })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0, -17);
    this.add(path);
    this.addGround(path);

    this._occluders = [];
    this._paintCourt();
    this._buildSchoolWall();
    this._buildFence();
    this._buildBeyond();
    this._buildLamps();
    this._buildSwings();
    this._buildRoundabout();
    this._buildSlideAndPipe();
    this._buildClimbingFrame();
    this._buildShelter();
    this._buildShed();
    this._buildFigure();
    this._wirePuzzle();

    this.spawn.position.set(-6, 0, 10.5);
    this.spawn.yaw = 0;
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-16.5, 0, -20),
      new THREE.Vector3(16.5, 6, 11.5)
    );
    this.setObjective('the rhyme on the shelter wall');
  }

  // ---------- small builders ----------

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false, cast = true } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  /** A pipe/bar between two points — swing legs, ladder rails, handrails. */
  _strut(a, b, r, mat) {
    const A = new THREE.Vector3(a[0], a[1], a[2]);
    const B = new THREE.Vector3(b[0], b[1], b[2]);
    const d = new THREE.Vector3().subVectors(B, A);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), mat);
    m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.castShadow = true;
    this.add(m);
    return m;
  }

  /** Worn court paint on the tarmac. */
  _paint(w, d, x, z) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: 0x9a9384, roughness: 1, transparent: true, opacity: 0.42,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, z);
    this.add(m);
    return m;
  }

  _paintCourt() {
    const L = 0.09;
    for (const z of [-8, 4]) this._paint(20, L, 0, z);            // ends
    for (const x of [-10, 10]) this._paint(L, 12, x, -2);          // sides
    this._paint(20, L, 0, -2);                                     // halfway
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.72, 1.81, 44),
      new THREE.MeshStandardMaterial({
        color: 0x9a9384, roughness: 1, transparent: true, opacity: 0.42, side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.012, -2);
    this.add(ring);
    // hopscotch, gone soft at the edges
    for (let i = 0; i < 6; i++) {
      this._paint(0.62, L, -4.6, 5.4 + i * 0.66);
      this._paint(L, 0.66, -4.9, 5.4 + i * 0.66 + 0.33);
      this._paint(L, 0.66, -4.3, 5.4 + i * 0.66 + 0.33);
    }
    this._paint(0.62, L, -4.6, 5.4 + 6 * 0.66);
  }

  // ---------- the edges of the ground ----------

  _buildSchoolWall() {
    const brick = makeMat('plaster', { base: '#6e5f57', repeat: [12, 2] });
    const stone = makeMat('concrete', { base: '#8c8578', repeat: [12, 1] });
    // two segments with the fire-door opening between them. The wall never
    // casts: at this moon angle its shadow would lie across half the ground.
    const flat = { collide: false, cast: false };
    this._box(11.3, 6, 0.4, brick, -12.35, 3, 12.2, flat);
    this._box(23.3, 6, 0.4, brick, 6.35, 3, 12.2, flat);
    this._box(1.4, 3.7, 0.4, brick, -6, 4.15, 12.2, flat);
    this._box(36, 0.55, 0.5, stone, 0, 0.27, 12.15, flat);
    this._box(1.7, 0.16, 0.5, stone, -6, 2.38, 12.1, flat);
    this.addBlocker([-18, 0, 11.95], [18, 3.2, 12.45]);

    // dark windows with pale surrounds, so the wall is a building at night
    const glass = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.15, metalness: 0.5 });
    for (const x of [-15.5, -10.2, -2.2, 2.6, 7.4, 12.2, 16]) {
      this._box(1.62, 2.32, 0.12, stone, x, 3.3, 12.08, flat);      // surround, set back
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.1), glass);
      pane.position.set(x, 3.3, 11.98);
      this.add(pane);
      this._box(0.05, 2.1, 0.03, stone, x, 3.3, 11.955, flat);      // mullions, proud of the glass
      this._box(1.4, 0.05, 0.03, stone, x, 3.3, 11.955, flat);
    }

    // the corridor you came out of: a lit box that goes dark after 3 s
    const inner = makeMat('plaster', { base: '#8d8574', repeat: [1, 1] });
    this._box(1.7, 2.4, 0.15, inner, -6, 1.2, 13.75, flat);
    this._box(0.15, 2.4, 1.7, inner, -6.78, 1.2, 12.95, flat);
    this._box(0.15, 2.4, 1.7, inner, -5.22, 1.2, 12.95, flat);
    this._box(1.7, 0.12, 1.7, inner, -6, 2.36, 12.95, flat);
    this._box(1.7, 0.06, 1.7, inner, -6, 0.03, 12.95, flat);

    const fireDoor = makeDoor({
      width: 1.3, height: 2.2, color: '#3f4348', frameColor: '#2e3236', knob: false,
    });
    fireDoor.position.set(-6, 0, 12.15);
    this.add(fireDoor);
    this.track(fireDoor);
    fireDoor.setAngle(-0.8);

    const stub = new THREE.PointLight(0xffe4b8, 3, 6.5, 1.8);
    stub.position.set(-6, 2.1, 13.1);
    this.add(stub);
    this.after(3, () => {
      stub.intensity = 0;
      this.playSoundAt('clunk', { x: -6, y: 2.1, z: 12.6 });
    });
  }

  _buildFence() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.6, roughness: 0.5 });
    const mesh = this._chainLink();
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 3));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        this._box(0.09, 2.05, 0.09, postMat, x0 + (x1 - x0) * t, 1.02, z0 + (z1 - z0) * t, { collide: false });
      }
      const yaw = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      const tex = mesh.clone();
      tex.needsUpdate = true;
      tex.repeat.set(len / 1.1, 1.9);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 2),
        new THREE.MeshStandardMaterial({
          map: tex, alphaMap: tex, transparent: true, alphaTest: 0.42,
          color: 0x9aa0a8, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.4,
        })
      );
      plane.position.set((x0 + x1) / 2, 1, (z0 + z1) / 2);
      plane.rotation.y = yaw;
      plane.castShadow = false;
      this.add(plane);
      // top rail
      this._box(
        Math.abs(x1 - x0) + 0.06, 0.06, Math.abs(z1 - z0) + 0.06, postMat,
        (x0 + x1) / 2, 2.03, (z0 + z1) / 2, { collide: false }
      );
    };
    run(-17, 12, -17, -13);
    run(17, 12, 17, -13);
    run(-17, -13, -0.6, -13);
    run(0.6, -13, 17, -13);
    this.addBlocker([-17.2, 0, -13.2], [-16.8, 2.2, 12]);
    this.addBlocker([16.8, 0, -13.2], [17.2, 2.2, 12]);
    this.addBlocker([-17.2, 0, -13.2], [-0.6, 2.2, -12.8]);
    this.addBlocker([0.6, 0, -13.2], [17.2, 2.2, -12.8]);

    // the gate, and the padlock the size of your fist
    this._gate = makeDoor({ width: 1.2, height: 2.0, color: '#3a3f45', frameColor: '#2c3035', knob: false });
    this._gate.position.set(GATE.x, 0, GATE.z);
    this.add(this._gate);
    this.track(this._gate);
    this.addCollider(this._gate.panel);

    const brass = new THREE.MeshStandardMaterial({ color: 0x8a7a55, metalness: 0.8, roughness: 0.35 });
    this._padlock = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.05), brass);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI), brass);
    shackle.position.y = 0.065;
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 16), brass);
    link.position.set(-0.06, 0.08, 0);
    link.rotation.y = Math.PI / 2;
    this._padlock.add(body, shackle, link);
    this._padlock.position.set(PADLOCK.x, PADLOCK.y, PADLOCK.z);
    this.add(this._padlock);

    this.interact(this._gate, {
      prompt: 'the gate',
      onInteract: () => {
        if (this._gateOpen) return;
        this.playSound('locked');
        this.subtitle('Chained. A padlock the size of your fist, and no key you have ever seen.', 5);
      },
    });
  }

  /** A diagonal wire grid, used as both map and alpha for the fence panels. */
  _chainLink() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#cdd3da';
    ctx.lineWidth = 4;
    ctx.lineCap = 'square';
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildBeyond() {
    // hedges either side of the path out, and the end of it
    for (const x of [-2.1, 2.1]) this._box(1.2, 1.8, 8, this._hedgeMat, x, 0.9, -17);
    this.addBlocker([-3, 0, -21], [3, 3, -20.5]);

    const dark = makeMat('plaster', { base: '#14161d', repeat: [3, 2] });
    const lit = (x, y, z) => {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x2a2419, emissive: 0xffd9a2, emissiveIntensity: 1.7 })
      );
      win.position.set(x, y, z);
      this.add(win);
      const l = new THREE.PointLight(0xffd9a2, 2.2, 13, 1.5);
      l.position.set(x, y, z + 0.5);
      this.add(l);
    };
    const house = { collide: false, cast: false };
    // the last house — one window still on (canon, VI)
    this._box(8, 5, 6, dark, -12, 2.5, -22, house);
    this._box(8.6, 0.5, 6.6, dark, -12, 5.1, -22, house);
    lit(-10, 2.6, -18.97);
    // the rest of the estate, further off; the path out dead-ends into one
    this._box(9, 5.5, 7, dark, 4, 2.75, -24, house);
    this._box(7, 4.4, 6, dark, -24, 2.2, -19, house);
    this._box(11, 6.5, 7, dark, 20, 3.25, -21, house);
    this._box(9, 5, 6, dark, 24, 2.5, 6, house);
    lit(1.2, 3.4, -20.47);
  }

  _buildLamps() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.5, roughness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a24, emissive: 0xffe4b8, emissiveIntensity: 2.2,
    });
    const post = (x, z, on) => {
      this._box(0.13, 4.5, 0.13, postMat, x, 2.25, z);
      this._box(0.52, 0.16, 0.34, postMat, x, 4.42, z, { collide: false });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.26), glassMat.clone());
      glass.position.set(x, 4.3, z);
      this.add(glass);
      if (!on) glass.material.emissiveIntensity = 0;
      return glass;
    };

    post(LAMP.x, LAMP.z, true);
    this._lamp = new THREE.PointLight(0xffe4b8, 16, 26, 1.6);
    this._lamp.position.set(LAMP.x, LAMP.y, LAMP.z);
    this.add(this._lamp);
    this.loopAt('hum', LAMP);

    const deadGlass = post(-3, -10, false);
    const dead = new THREE.PointLight(0xffe4b8, 0, 10, 1.6);
    dead.position.set(-3, 4.2, -10);
    this.add(dead);
    let tNext = 0;
    this.tick((dt, t) => {
      if (t < tNext) return;
      const on = Math.random() < 0.05;
      dead.intensity = on ? 1.2 : 0;
      deadGlass.material.emissiveIntensity = on ? 1.6 : 0;
      tNext = t + (on ? 0.06 + Math.random() * 0.1 : 0.4 + Math.random() * 2.5);
    });
  }

  // ---------- the equipment ----------

  _buildSwings() {
    const steel = this._steel;
    for (const sx of [-2.1, 2.1]) {
      const topX = SWING.x + sx;
      for (const sz of [-0.85, 0.85]) {
        this._strut([topX + sx * 0.06, 0, SWING.z + sz], [topX, SWING.y, SWING.z], 0.055, steel);
      }
      this._strut([topX - 0.5, 0.9, SWING.z - 0.5], [topX + 0.5, 0.9, SWING.z + 0.5], 0.03, steel);
      this.addBlocker([topX - 0.5, 0, SWING.z - 1.0], [topX + 0.5, 2.2, SWING.z + 1.0]);
    }
    this._strut([SWING.x - 2.25, SWING.y, SWING.z], [SWING.x + 2.25, SWING.y, SWING.z], 0.06, steel);

    this._swingSeats = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      g.position.set(SWING.x - 1.6 + i * 0.8, SWING.y, SWING.z);
      for (const cx of [-0.19, 0.19]) {
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.85, 6), steel);
        chain.position.set(cx, -0.925, 0);
        g.add(chain);
      }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.21), this._wood);
      seat.position.y = -1.85;
      seat.castShadow = true;
      g.add(seat);
      this.add(g);
      this._swingSeats.push(g);
      this.interact(seat, {
        prompt: 'a swing',
        onInteract: () => this.subtitle('The chains are cold. This one moves by itself, and always did.', 5),
      });
    }
    this._swingLoop = this.loopAt('swing', SWING);
    this._swinging = true;
    this.tick((dt, t) => {
      if (this._swinging) this._swingSeats[2].rotation.x = 0.55 * Math.sin(t * 1.55);
    });
  }

  _buildRoundabout() {
    const steel = this._steel;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.42, 0.34, 26), steel);
    disc.position.set(0, 0.17, -6);
    disc.castShadow = disc.receiveShadow = true;
    this.add(disc);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.62, 6), steel);
      rail.position.set(Math.cos(a) * 1.24, 0.48, Math.sin(a) * 1.24);
      disc.add(rail);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), steel);
      cap.position.set(Math.cos(a) * 1.24, 0.79, Math.sin(a) * 1.24);
      disc.add(cap);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), steel);
    hub.position.y = 0.42;
    disc.add(hub);
    this.addCollider(disc);
    this.whenUnseen(disc, () => { disc.rotation.y += 0.6; }, { once: false, minTime: 1.2 });
    this.interact(disc, {
      prompt: 'the roundabout',
      onInteract: () => this.subtitle('It has turned since you looked. Only a little.', 4),
    });
  }

  _buildSlideAndPipe() {
    const steel = this._steel;
    const concrete = makeMat('concrete', { base: '#7a766f', repeat: [3, 2] });

    // slide: a platform on four legs, a ladder up the north side, a slope down
    const platform = this._box(1.4, 0.1, 1.4, steel, 8, 2.2, -4, { collide: false });
    for (const lx of [7.4, 8.6]) for (const lz of [-4.6, -3.4]) {
      this._box(0.09, 2.2, 0.09, steel, lx, 1.1, lz);
    }
    for (const lx of [7.4, 8.6]) {
      this._strut([lx, 0.1, -3.4], [lx, 2.35, -3.28], 0.035, steel);
      this._strut([lx, 2.25, -4.5], [lx, 2.9, -4.36], 0.032, steel);
    }
    for (let i = 1; i <= 5; i++) {
      this._strut([7.4, i * 0.42, -3.38], [8.6, i * 0.42, -3.38], 0.022, steel);
    }
    const slope = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 3.6), steel);
    slope.position.set(8, 1.15, -6.05);
    slope.rotation.x = -0.62;
    slope.castShadow = true;
    this.add(slope);
    for (const rx of [-0.5, 0.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 3.6), steel);
      rail.position.set(8 + rx, 1.24, -6.05);
      rail.rotation.x = -0.62;
      this.add(rail);
    }
    this.addBlocker([7.3, 0, -3.5], [8.7, 2.3, -3.2]);        // the ladder
    this._occluders.push(platform);

    // the pipe: concrete, open at both ends, big enough to sit inside
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 2.6, 20, 1, true),
      new THREE.MeshStandardMaterial({
        map: concrete.map, bumpMap: concrete.map, bumpScale: 0.8,
        roughness: 1, side: THREE.DoubleSide,
      })
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(10.5, 0.85, -6);
    pipe.castShadow = pipe.receiveShadow = true;
    this.add(pipe);                                            // never a collider: its AABB would seal the mouth
    this.addBlocker([9.2, 0, -7.2], [11.8, 2.2, -6.8]);
    this.addBlocker([9.2, 0, -5.2], [11.8, 2.2, -4.8]);
    for (const ex of [9.2, 11.8]) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 8, 22), pipe.material);
      collar.rotation.y = Math.PI / 2;
      collar.position.set(ex, 0.85, -6);
      this.add(collar);
    }
    this._occluders.push(pipe);
  }

  _buildClimbingFrame() {
    const steel = this._steel;
    for (const x of [9, 11]) for (const z of [3, 5]) {
      this._box(0.07, 2.24, 0.07, steel, x, 1.12, z);
    }
    for (const y of [0.75, 1.5, 2.24]) {
      // the south face is left open at knee and waist height — a way in
      if (y > 1.6) this._box(2.07, 0.05, 0.05, steel, 10, y, 3, { collide: false });
      this._box(2.07, 0.05, 0.05, steel, 10, y, 5, { collide: y < 1.6 });
      for (const x of [9, 11]) this._box(0.05, 0.05, 2.07, steel, x, y, 4, { collide: y < 1.6 });
    }
    for (const z of [3, 5]) this._strut([9, 0.75, z], [11, 2.24, z], 0.025, steel);
  }

  _buildShelter() {
    const shelterMat = makeMat('concrete', { base: '#5f6a6a', repeat: [2, 1] });
    const back = this._box(3.0, 2.4, 0.15, shelterMat, -11, 1.2, 7.5);
    const sideW = this._box(0.15, 2.4, 3.0, shelterMat, -12.5, 1.2, 6.0);
    const sideE = this._box(0.15, 2.4, 3.0, shelterMat, -9.5, 1.2, 6.0);
    this._box(3.4, 0.12, 3.4, shelterMat, -11, 2.46, 6.0, { collide: false });

    const bench = makeBench();
    bench.position.set(-11, 0, 6.9);
    bench.rotation.y = Math.PI;                                // its back to the painted wall
    this.add(bench);
    this.addCollider(bench);

    // the shelter light still works, just about — the one lit thing out here
    const shade = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.08, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2a2a24, emissive: 0xd8dcc4, emissiveIntensity: 1.4 })
    );
    shade.position.set(-11, 2.34, 6.5);
    this.add(shade);
    const shelterLight = new THREE.PointLight(0xd6dcc8, 3.6, 11, 1.5);
    shelterLight.position.set(-11, 2.26, 6.5);
    this.add(shelterLight);

    // the rhyme, painted on the back wall
    const tex = textTexture({
      text: PAINTED, width: 1024, height: 512,
      font: 'italic 34px Georgia', color: '#e2dccb', bg: '#5f6a6a',
    });
    this._rhyme = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.2),
      new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.16, roughness: 0.9,
      })
    );
    this._rhyme.position.set(-11, 1.32, 7.42);
    this._rhyme.rotation.y = Math.PI;
    this.add(this._rhyme);

    const hedge = this._box(4.5, 1.8, 0.8, this._hedgeMat, -10.75, 0.9, 9.1);
    this._occluders.push(back, sideW, sideE, hedge);
  }

  _buildShed() {
    const shed = this._box(2.4, 2.6, 2.4, this._wood, 13, 1.3, -10);
    const roof = this._box(2.9, 0.16, 2.9, this._wood, 13, 2.68, -10, { collide: false });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x33281e, roughness: 0.9 });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.9), doorMat);
    door.position.set(13, 0.98, -8.79);
    this.add(door);
    const hasp = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.05, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x6e6455, metalness: 0.7, roughness: 0.5 })
    );
    hasp.position.set(13.4, 1.0, -8.77);
    this.add(hasp);
    this._occluders.push(shed, roof);
    this.interact(shed, {
      prompt: 'the shed',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('Locked. It always was. That was never the point of it.', 5);
      },
    });
  }

  // ---------- the figure ----------

  _buildFigure() {
    this._figure = makeFigure();
    this.add(this._figure);
    this._presence = new Presence(this, this._figure, {
      stations: STATIONS,
      minUnseen: 0.6,
      occluders: this._occluders,
      onArrive: (i) => this._onArrive(i),
    });
    this._presence.placeAt(0);        // before a frame renders, or it shows at the origin
    // deliberately NOT this.track(...): _presenceStep() drives it, so the level
    // can hold it still whenever the player is inside SAFE metres of it or of
    // the station it is about to appear at.
  }

  /**
   * Where the player is standing. The ground snap eases, so p.y settles a
   * hair under eye height and a raw p.y - 1.62 goes very slightly negative —
   * enough to fall out of a hiding volume that starts at y 0 and leave the
   * figure frozen. Clamp it to the ground.
   */
  _foot() {
    const p = this.game.player.position;
    return new THREE.Vector3(p.x, Math.max(0, p.y - 1.62), p.z);
  }

  // ---------- the puzzle ----------

  _wirePuzzle() {
    this._phase = -1;
    this._targetKind = null;
    this._allow = false;
    this._walking = false;
    this._gateOpen = false;
    this._knocked = 0;
    this._wrongT = 0;
    this._wrongSaid = false;
    this._idleT = 0;
    this._idleSaid = false;
    this._heldT = 0;
    this._heldSaid = false;
    this._saidOpen = false;
    this._fin = false;
    this._dreadEase = null;
    this._lastT = performance.now();

    this.interact(this._rhyme, {
      prompt: 'the rhyme on the shelter wall',
      distance: 2.6,
      onInteract: () => {
        this.giveNote({
          id: 'l14-rhyme',
          title: 'the counting rhyme, painted on the shelter wall',
          body:
            RHYME.join('\n') + '\n\n' +
            'you always hid in the same three places, in the same order,\n' +
            'and I always pretended not to know.\n\n— M.',
        });
        if (this._phase < 0) {
          this.setObjective('hide, the way you used to');
          this._startPhase(0);
        }
      },
    });

    // Everything this room counts — how long it waits unseen, how fast it
    // walks, how long you have been in the wrong place — is measured in real
    // seconds, not in the engine's clamped frame delta. Below about 20 fps
    // that delta runs slow, and a figure that takes half a minute to cross
    // the tarmac because the renderer is struggling is not the beat.
    this.tick(() => {
      const now = performance.now();
      const rdt = Math.min((now - this._lastT) / 1000, 0.1);
      this._lastT = now;
      this._puzzleStep(rdt);
      this._presenceStep(rdt);
    });
  }

  _puzzleStep(dt) {
    const pl = this.game.player.position;

    if (this._dreadEase !== null) {
      this._dreadEase = Math.max(0.4, this._dreadEase - dt * 0.05);
      this.dread(this._dreadEase);
    }

    if (this._fin) {
      this._allow = false;
      if (this._gateOpen && !this.isCompleted && pl.z < -15) this.complete();
      return;
    }

    const ph = PHASES[this._phase];
    if (!ph) { this._allow = false; return; }

    const foot = this._foot();
    const inHide = HIDES[ph.hide].containsPoint(foot);
    this._allow = this._targetKind === 'hide' ? inHide
      : this._targetKind === 'rest' ? !inHide
        : false;

    // the wrong place: one dull knock and a nudge (§3.1's in-world "wrong")
    let wrong = null;
    for (const [k, b] of Object.entries(HIDES)) {
      if (k !== ph.hide && b.containsPoint(foot)) { wrong = b; break; }
    }
    if (wrong) {
      this._wrongT += dt;
      if (this._wrongT > 8 && !this._wrongSaid) {
        this._wrongSaid = true;
        const c = wrong.getCenter(new THREE.Vector3());
        this.playSoundAt('knock', c, { count: 1, soft: true });
        this.cue('one knock', c);
        this.subtitle('Nothing comes. It was never this one — not first.', 5);
      }
    } else {
      this._wrongT = 0;
      this._wrongSaid = false;
    }

    // never hiding at all
    if (this._phase === 0 && this._targetKind === 'hide' && !inHide) {
      this._idleT += dt;
      if (this._idleT > 60 && !this._idleSaid) {
        this._idleSaid = true;
        this.subtitle('You could hide. That was always your part.', 6);
      }
    }
  }

  /**
   * Moves the figure, and is the only thing that keeps the two-metre promise:
   * Presence hops to whatever station it is given and walks straight through
   * anything in its way, so the level withholds both while the player is near.
   */
  _presenceStep(dt) {
    const pres = this._presence;
    const pl = this.game.player.position;
    const near = (v) => Math.hypot(pl.x - v.x, pl.z - v.z);

    if (this._walking) {
      if (near(pres.figure.position) < SAFE) {
        this._heldT += dt;
        if (this._heldT > 7 && !this._heldSaid) {
          this._heldSaid = true;
          this.subtitle('It waits. It will not walk through you.', 5);
        }
        return;                                   // it stops rather than pass you
      }
      this._heldT = 0;
      pres.update(dt);
      return;
    }

    const next = pres.stations[pres.index + 1];
    pres.enabled = this._allow && (!next || near(next) >= SAFE);
    pres.update(dt);
  }

  _startPhase(i) {
    this._phase = i;
    this._targetKind = 'hide';
    this._presence.advanceTo(PHASES[i].hideStation);
  }

  _onArrive(i) {
    // the swing stops dead the first time it moves
    if (i === 1 && this._swinging) {
      this._swinging = false;
      this._swingLoop.stop(0.3);
      this.cue('the swing stops', SWING);
    }
    // the first time it stands in the open where you can see it
    if (i === 4 && !this._saidOpen) {
      this._saidOpen = true;
      this.whenSeen(
        this._figure,
        () => this.subtitle('It is standing in the open now. Closer. It does not move while you watch.', 6),
        { occluders: this._occluders }
      );
    }

    const ph = PHASES[this._phase];
    if (!ph) return;

    if (i === ph.hideStation) {
      const pos = STATIONS[i];
      this.playSoundAt('knock', pos, { count: 2 });
      this.cue('two knocks', pos);
      this.subtitle('Two. Still there. You can come out.', 5);
      this._knocked++;
      if (ph.objective) this.setObjective(ph.objective);
      this._targetKind = 'rest';
      this._presence.advanceTo(ph.rest);
    } else if (i === ph.rest) {
      if (this._phase < PHASES.length - 1) this._startPhase(this._phase + 1);
      else this._finale();
    }
  }

  _finale() {
    this._fin = true;
    this._targetKind = null;
    this._allow = false;
    this._presence.enabled = false;
    this.hush(4);
    this.dread(1.0);
    this.subtitle('It does not come any closer. It never did.', 5);

    this.after(4, () => {
      this._dreadEase = 1.0;
      this._swingLoop = this.loopAt('swing', SWING);
      this._swingLoop.setGain(0.4);
      this._walking = true;
      this._presence.walkTo(V(0, 0, -12.2), 1.6, () => {
        this.playSoundAt('unlock', PADLOCK);
        this._padlock.visible = false;
        this._gate.setOpen(true, -1);
        this.removeColliderOf(this._gate.panel);
        this._gateOpen = true;
        this._presence.walkTo(V(0, 0, -16), 1.6, () => {
          this._presence.hide();
          this._walking = false;
          this._lamp.intensity = 0;
          this.playSoundAt('clunk', LAMP);
          this.setObjective('follow');
          this.subtitle('It had the key. Of course it had the key.', 5);
        });
      });
    });
  }

  // ---------- playtest ----------

  /** Poll the level's own state, the way a player waits for the knocks. */
  async _waitFor(cond, limit = 12) {
    for (let t = 0; t < limit && !cond(); t += 0.1) await this.debugWait(0.1);
    return cond();
  }

  async debugSolve() {
    const pl = this.game.player;

    this.debugInteract(this._rhyme);
    await this.debugWait(0.35);
    this.game.ui.closeModal();

    // in the pipe, facing its far wall: S1, S2, S3 all fall outside the cone
    pl.teleport(10.5, -6, Math.PI);
    await this._waitFor(() => this._knocked >= 1, 10);

    // behind the shed, facing the fence: R1, then S4, S5, S6
    pl.teleport(13.3, -12.0, 0);
    await this._waitFor(() => this._knocked >= 2, 10);

    // in the gap behind the shelter, facing the hedge: R2, then S7, S8, S9
    pl.teleport(-11, 8.1, Math.PI);
    await this._waitFor(() => this._knocked >= 3, 10);

    // out of the gap, under the shelter roof, facing the ground: R3 → the finale
    pl.teleport(-12, 5.0, 0);
    await this._waitFor(() => this._gateOpen, 26);

    pl.teleport(0, -16);
    await this._waitFor(() => this.isCompleted, 3);
  }
}
