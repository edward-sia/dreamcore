import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeTable, makePictureFrame,
  makeDust, makeClockFace, applyFog,
} from '../core/props.js';
import { Hours } from '../core/hours.js';

// XVII — The Hall
// At the evening and the morning it is the house's hall; at 3:07 it is the
// corridor of I, thirty metres of doors. Leave the spare key where the
// flowers used to be, the note on the table, her slippers on the mat, then
// listen at the door at the end while the child's dream comes down and
// tries it.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.2

const HOUSE = { x0: -1.5, x1: 1.5, z0: -5.4, z1: 5.4, h: 2.7 };
const DREAM = { x0: -1.35, x1: 1.35, z0: -30.6, z1: 5.4, h: 3.0 };
const CLOCK_POS = { x: -1.32, y: 1.9, z: 3.2 };
const MAT = { x: 1.0, y: 0.026, z: -1.0 };
const TABLE = { x: -1.0, y: 0.78, z: -3.8 };
const PEDESTAL = { x: 1.0, y: 1.02, z: -17.7 };
const STAIR = { x0: 0.6, x1: 1.5, z0: -1.0, run: 0.27, rise: 0.18, steps: 10 };
const HOLE = { x0: 0.55, x1: 1.55, z0: 0.3, z1: 2.65 };      // the stairwell, out of the hall ceiling
const END_Z = -30.6;
const HUM = LevelBase.tune('EG');
const NOTE_I =
  'We moved the spare key when you stopped visiting.\n\n' +
  'It’s where the flowers used to be.\n' +
  'You watered them every Sunday. Remember?\n\n' +
  '— M.';
const FLAVOUR = [
  'Locked. Behind it, water is running into a tub that never fills.',
  'Locked. You can hear a television playing a show you almost remember.',
  'Locked. Someone inside is humming the song your mother hummed.',
];
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level17 extends LevelBase {
  static meta = {
    id: 17,
    numeral: 'XVII',
    title: 'The Hall',
    mood: 'night',
    grade: GRADE,
    intro: 'The hall. At night it is the corridor of the building you grew up in, and it is longer than the house.',
    outro:
      'You put the key where the flowers used to be,\n' +
      'and the note on the table, and her slippers on the mat,\n' +
      'and something small came down, and found them, and went on ahead.',
  };

  /**
   * How fast this room's own timers run. 1 for a player, always. debugSolve
   * turns it up while the rehearsal walks so the playtest does not spend
   * nineteen seconds listening to footsteps; every step, check and subtitle
   * still runs, in order, through the same handlers.
   */
  _speed = 1;

  /** Every timer of the room goes through here — footsteps() included. */
  after(seconds, fn) { return super.after(seconds / (this._speed || 1), fn); }

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    this._wound = false;
    this._clockLocked = false;
    this._placed = { note: null, key: null, slippers: false };   // null | 'table' | 'pedestal'
    this._rehearsing = false;
    this._walking = false;        // a walk is in the hall — the retreat after a failure included
    this._rehearsals = 0;
    this._exitOpen = false;
    this._frontOpen = false;
    this._frontBlocker = null;
    this._failKey = 0;
    this._dreamDoors = [];
    this._bindings = {
      night: { objects: [], colliders: [], interact: [] },
      evening: { objects: [], colliders: [], interact: [] },
      morning: { objects: [], colliders: [], interact: [] },
    };

    this._materials();
    this._buildShared();
    this._buildHouseHall();
    this._buildDreamHall();
    this._buildClock();
    this._bindLook({ x: 0, y: 1.4, z: -5.3 }, { x: 2, y: 6, z: -12 });
    this._wirePuzzle();
    for (const hour of ['night', 'evening', 'morning']) this.hours.bind(hour, this._bindings[hour]);

    this.spawn.position.set(0, 0, 4.6);
    this.spawn.yaw = 0;
    this.bounds = new THREE.Box3(new THREE.Vector3(-1.6, 0, -33), new THREE.Vector3(1.6, 3.5, 5.2));
    this.setObjective('slippers, she said. then the wireless.');

    this.hours.start();
    this.track(this.hours);
  }

  // ---------- shell helpers ----------

  _box(w, h, d, mat, x, y, z, { collide = false, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  _plane(w, d, mat, x, y, z, facing = 'up') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = facing === 'up' ? -Math.PI / 2 : Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = facing === 'up';
    this.add(m);
    return m;
  }

  /** Register an object with the hours it belongs to. Bound in one go at the end of build(). */
  _at(hours, obj, { collide = false, touch = false } = {}) {
    for (const h of hours) {
      const b = this._bindings[h];
      b.objects.push(obj);
      if (collide) b.colliders.push(obj);
      if (touch) b.interact.push(obj);
    }
    return obj;
  }

  /** A wall with a doorway 1.0 wide and 2.1 high cut out of it, as boxes. Returns them. */
  _wallWithDoorway(mat, { vertical, at, lo, hi, h, pos }) {
    const out = [];
    for (const [a, b] of [[lo, at - 0.5], [at + 0.5, hi]]) {
      const len = b - a, mid = (a + b) / 2;
      if (len <= 0.01) continue;
      out.push(vertical
        ? this._box(0.2, h, len, mat, pos, h / 2, mid)
        : this._box(len, h, 0.2, mat, mid, h / 2, pos));
    }
    const lintelH = h - 2.1;
    if (lintelH > 0.01) {
      out.push(vertical
        ? this._box(0.2, lintelH, 1.0, mat, pos, 2.1 + lintelH / 2, at)
        : this._box(1.0, lintelH, 0.2, mat, at, 2.1 + lintelH / 2, pos));
    }
    return out;
  }

  _materials() {
    this._houseWall = makeMat('wallpaper', { base: '#b7a48e', stripe: '#a8927a', repeat: [3, 1.2] });
    this._dreamWall = makeMat('wallpaper', { base: '#b7a48e', stripe: '#a8927a', repeat: [6, 1.4] });
    this._carpet = makeMat('carpet', { base: '#6d5a58', repeat: [2, 20] });
    this._boards = makeMat('wood', { base: '#6b5138', repeat: [2, 7] });
    this._runner = makeMat('carpet', { base: '#7a5f4f', repeat: [1, 6] });
    this._houseCeil = makeMat('plaster', { base: '#c3bba8', repeat: [2, 6] });
    this._dreamCeil = makeMat('plaster', { base: '#b3aa97', repeat: [2, 16] });
    this._skirt = new THREE.MeshStandardMaterial({ color: 0x4a3d30, roughness: 0.7 });
    this._dark = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 1 });
    this._plaster = makeMat('plaster', { base: '#9c937f', repeat: [1, 1] });
  }

  // ---------- always there ----------

  _buildShared() {
    // one floor under both halls — I's carpet, which is what the night shows
    const floor = this._plane(3.4, 39.6, this._carpet, 0, 0, -14.3, 'up');
    this.addGround(floor);

    // the dark landing past the door at the end
    const landing = this._plane(3.4, 3.5, this._dark, 0, 0.004, -32.35, 'up');
    this.addGround(landing);
    this.addBlocker([-1.75, 0, -34.2], [1.75, 3.2, -34.0]);
    this.addBlocker([-1.85, 0, -34.2], [-1.65, 3.2, -30.4]);
    this.addBlocker([1.65, 0, -34.2], [1.85, 3.2, -30.4]);

    // the kitchen door — the way you came, shut at every hour
    this._kitchenDoor = makeDoor({ color: '#ad9068' });
    this._kitchenDoor.position.set(0, 0, HOUSE.z1);
    this._kitchenDoor.rotation.y = Math.PI;
    this.add(this._kitchenDoor);
    this.addBlocker([-0.6, 0, HOUSE.z1 - 0.15], [0.6, 2.2, HOUSE.z1 + 0.15]);

    // the table by the door: the telephone table at her hours, I's note table at night
    this._table = makeTable({ w: 0.8, d: 0.42, h: 0.78 });
    this._table.position.set(TABLE.x, 0, TABLE.z);
    this.add(this._table);
    this.addCollider(this._table);

    // the mat at the stair foot — dark bristle on a lighter border, so that it
    // reads against I's carpet as well as against her floorboards
    const bristle = makeMat('carpet', { base: '#3b3128', repeat: [1, 1] });
    const border = this._box(0.68, 0.02, 0.48, new THREE.MeshStandardMaterial({ color: 0x8a7355, roughness: 0.95 }),
      MAT.x, 0.01, MAT.z);
    this._mat = this._box(0.6, 0.026, 0.4, bristle, MAT.x, 0.013, MAT.z);
    this._matBorder = border;

    // what you can leave for the night — hidden inside a group the hours turn off,
    // so that each piece keeps its own visible flag while it is not placed
    const placed = new THREE.Group();
    this.add(placed);
    this._at(['night'], placed);

    this._notePlaced = makeNoteProp();
    this._notePlaced.position.set(TABLE.x, 0.805, TABLE.z);
    this._keyOnTable = makeKeyProp();
    this._keyOnTable.position.set(-0.8, 0.805, -3.7);
    this._keyOnPedestal = makeKeyProp();
    this._keyOnPedestal.position.set(0.9, 1.03, -17.82);
    this._noteOnPedestal = makeNoteProp({ tilt: Math.PI / 2 });
    this._noteOnPedestal.position.set(0.95, 1.035, -17.6);
    this._slippersMesh = new THREE.Group();
    const slipMat = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.95 });
    for (const dx of [-0.06, 0.06]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.25), slipMat);
      s.position.set(MAT.x + dx, 0.052, MAT.z);
      s.castShadow = true;
      this._slippersMesh.add(s);
    }
    for (const o of [this._notePlaced, this._keyOnTable, this._keyOnPedestal, this._noteOnPedestal, this._slippersMesh]) {
      o.visible = false;
      placed.add(o);
    }
  }

  // ---------- the house's hall: her evening, and the morning after ----------

  _buildHouseHall() {
    const H = HOUSE.h, EM = ['evening', 'morning'];

    // floor: boards with a runner, laid over the carpet the night shows
    this._at(EM, this._plane(3.0, 10.8, this._boards, 0, 0.006, 0, 'up'));
    this._at(EM, this._plane(1.2, 10.0, this._runner, 0, 0.012, 0, 'up'));

    // ceiling, in three pieces around the stairwell
    this._at(EM, this._plane(2.05, 10.8, this._houseCeil, -0.475, H, 0, 'down'));
    this._at(EM, this._plane(0.95, 5.7, this._houseCeil, 1.025, H, -2.55, 'down'));
    this._at(EM, this._plane(0.95, 2.75, this._houseCeil, 1.025, H, 4.025, 'down'));

    // the stairwell above the hole: dark sides and a dark top, so it reads as "up"
    for (const [w, d, x, z] of [
      [0.06, HOLE.z1 - HOLE.z0, HOLE.x0, (HOLE.z0 + HOLE.z1) / 2],
      [0.06, HOLE.z1 - HOLE.z0, HOLE.x1, (HOLE.z0 + HOLE.z1) / 2],
    ]) this._at(EM, this._box(w, 1.0, d, this._dark, x, H + 0.5, z));
    for (const z of [HOLE.z0, HOLE.z1]) {
      this._at(EM, this._box(HOLE.x1 - HOLE.x0, 1.0, 0.06, this._dark, (HOLE.x0 + HOLE.x1) / 2, H + 0.5, z));
    }
    this._at(EM, this._plane(HOLE.x1 - HOLE.x0, HOLE.z1 - HOLE.z0, this._dark,
      (HOLE.x0 + HOLE.x1) / 2, H + 1.0, (HOLE.z0 + HOLE.z1) / 2, 'down'));

    // side walls (the doors sit against them; they are never opened)
    for (const side of [-1, 1]) {
      this._at(EM, this._box(0.2, H, 11.0, this._houseWall, side * 1.6, H / 2, 0), { collide: true });
      this._at(EM, this._box(0.04, 0.14, 10.8, this._skirt, side * 1.48, 0.07, 0));
    }
    // north wall, with the front doorway; south wall, with the kitchen doorway
    for (const seg of this._wallWithDoorway(this._houseWall,
      { vertical: false, at: 0, lo: -1.7, hi: 1.7, h: H, pos: HOUSE.z0 - 0.1 })) this._at(EM, seg, { collide: true });
    for (const seg of this._wallWithDoorway(this._houseWall,
      { vertical: false, at: 0, lo: -1.7, hi: 1.7, h: H, pos: HOUSE.z1 + 0.1 })) this._at(EM, seg, { collide: true });

    // ---- the front door, the porch, III's street beyond it ----
    this._frontDoor = makeDoor({ color: '#4f3d2e' });
    this._frontDoor.position.set(0, 0, HOUSE.z0);
    this.add(this._frontDoor);
    this.track(this._frontDoor);
    this._at(EM, this._frontDoor, { touch: true });

    // the hall's own light, falling out of the doorway while the door stands
    // open. The porch light is dead and the lamp post refuses, so without this
    // wedge the porch, the gate and the mailbox are a black rectangle with
    // prompts floating in it. It reaches the gate and no further: past that the
    // street is still another night.
    this._doorSpill = new THREE.SpotLight(0xffd2a0, 0, 6.5, 0.95, 0.85, 1.5);
    this._doorSpill.position.set(0, 2.1, -5.32);
    this._doorSpill.target.position.set(0, 0, -6.9);
    this.add(this._doorSpill, this._doorSpill.target);

    const porchMat = makeMat('wood', { base: '#5b4a38', repeat: [2, 1] });
    this._at(['evening'], this._plane(3.0, 1.6, porchMat, 0, 0.02, -6.2, 'up'));
    const asphalt = makeMat('asphalt', { base: '#2b2b2e', repeat: [8, 8] });
    this._at(['evening'], this._plane(40, 33, asphalt, 0, 0.01, -23.5, 'up'));
    // the gate at the end of the path
    this._gate = this._at(['evening'], this._box(3.0, 0.9, 0.06,
      new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.85 }), 0, 0.45, -7.0), { touch: true });
    // the mailbox
    const mailbox = new THREE.Group();
    const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.8 }));
    mbPost.position.y = 0.5;
    const mbBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x4c3f34, roughness: 0.7, metalness: 0.2 }));
    mbBody.position.y = 1.09;
    mbBody.castShadow = true;
    mailbox.add(mbPost, mbBody);
    mailbox.position.set(-1.2, 0, -6.8);
    this.add(mailbox);
    this._mailbox = this._at(['evening'], mailbox, { touch: true });
    // a lamp post that refuses
    const lamp = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.7, metalness: 0.4 }));
    post.position.y = 2.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1c1e21, emissive: 0xffe0a8, emissiveIntensity: 0.2 }));
    head.position.y = 4.45;
    lamp.add(post, head);
    lamp.position.set(3, 0, -10);
    this.add(lamp);
    this._at(['evening'], lamp);
    this._lampLight = new THREE.PointLight(0xffe0a8, 0, 12, 1.6);
    this._lampLight.position.set(3, 4.3, -10);
    this.add(this._lampLight);
    let lampNext = 0;
    this.tick((dt, t) => {
      if (!this.hours.is('evening') || this.hours.changing) { this._lampLight.intensity = 0; return; }
      if (t > lampNext) {
        const on = Math.random() < 0.05;            // it refuses; five times in a hundred it does not
        this._lampLight.intensity = on ? 1.0 : 0;
        head.material.emissiveIntensity = on ? 2.4 : 0.2;
        lampNext = t + (on ? 0.05 + Math.random() * 0.12 : 0.3 + Math.random() * 1.6);
      }
    });

    // the morning: the doorway is white and the house stops there
    const white = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 }));
    white.position.set(0, 1.3, -6.2);
    this.add(white);
    this._at(['morning'], white);

    // the porch light switch, inside, by the door
    this._porchSwitch = this._at(EM, this._box(0.09, 0.13, 0.03,
      new THREE.MeshStandardMaterial({ color: 0xd8cfbd, roughness: 0.6 }), 0.7, 1.3, -5.28), { touch: true });

    // ---- the sitting room, the cupboard ----
    this._sittingDoor = makeDoor({ color: '#ad9068' });
    this._sittingDoor.position.set(HOUSE.x0, 0, -3.0);
    this._sittingDoor.rotation.y = Math.PI / 2;
    this.add(this._sittingDoor);
    this._at(EM, this._sittingDoor, { touch: true });

    this._cupboardDoor = makeDoor({ width: 0.8, height: 1.95, color: '#ad9068' });
    this._cupboardDoor.position.set(HOUSE.x1, 0, 3.8);
    this._cupboardDoor.rotation.y = -Math.PI / 2;
    this.add(this._cupboardDoor);
    this._at(EM, this._cupboardDoor, { touch: true });

    // ---- the stairs, and the mat at their foot ----
    const stairs = new THREE.Group();
    const treadMat = makeMat('wood', { base: '#6b5138', repeat: [1, 1] });
    for (let i = 0; i < STAIR.steps; i++) {
      const h = STAIR.rise * (i + 1);
      const step = makeWall(STAIR.x1 - STAIR.x0, h, STAIR.run, treadMat);
      step.position.set((STAIR.x0 + STAIR.x1) / 2, h / 2, STAIR.z0 + i * STAIR.run + STAIR.run / 2);
      stairs.add(step);
    }
    const topZ = STAIR.z0 + STAIR.steps * STAIR.run;                  // 1.7
    const landing = makeWall(STAIR.x1 - STAIR.x0, 1.8, 2.65 - topZ, treadMat);
    landing.position.set((STAIR.x0 + STAIR.x1) / 2, 0.9, (topZ + 2.65) / 2);
    stairs.add(landing);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.6 });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.4), railMat);
    rail.position.set(STAIR.x0 + 0.04, 1.55, 0.35);
    rail.rotation.x = -Math.atan2(1.8, 2.7);
    stairs.add(rail);
    for (const [z, y] of [[STAIR.z0 + 0.05, 0.5], [topZ - 0.05, 1.4]]) {
      const newel = new THREE.Mesh(new THREE.BoxGeometry(0.08, y * 2, 0.08), railMat);
      newel.position.set(STAIR.x0 + 0.04, y, z);
      stairs.add(newel);
    }
    stairs.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.add(stairs);
    this._stairs = this._at(EM, stairs, { collide: true, touch: true });

    // the landing light, left on at the top of the stairs — the thing XX is about
    this._landing = new THREE.PointLight(0xffcc99, 0, 11, 1.6);
    this._landing.position.set(1.05, 2.25, 1.9);
    this.add(this._landing);

    // a bracket lamp by the kitchen door: without it the near end of the hall
    // is unreadable, since her two bulbs hang at z 0 and z −4
    const sconce = new THREE.Group();
    const brass = new THREE.MeshStandardMaterial({ color: 0x8a7340, roughness: 0.35, metalness: 0.85 });
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), brass);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-0.08, 0, 0);
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0xffd2a0, emissiveIntensity: 1.4, roughness: 0.6, side: THREE.DoubleSide }));
    shade.position.set(-0.17, 0.02, 0);
    sconce.add(arm, shade);
    sconce.position.set(1.49, 2.05, 3.6);
    this.add(sconce);
    this._at(EM, sconce);
    this._sconce = new THREE.PointLight(0xffd2a0, 0, 9, 1.7);
    this._sconce.position.set(1.28, 2.0, 3.6);
    this.add(this._sconce);

    // ---- the hall stand, and the sunflowers that used to be here ----
    const stand = new THREE.Group();
    const standBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.95, 0.35),
      new THREE.MeshStandardMaterial({ map: this._boards.map, roughness: 0.75 }));
    standBody.position.y = 0.475;
    standBody.castShadow = standBody.receiveShadow = true;
    stand.add(standBody);
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x7e8894, roughness: 0.3 }));
    vase.position.y = 1.05;
    stand.add(vase);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x6d8a4a, roughness: 1 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe8b933, roughness: 0.85, emissive: 0x8a6410, emissiveIntensity: 2.0 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const lean = 0.12 + (i % 2) * 0.06;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.46, 5), stemMat);
      stem.position.set(Math.sin(a) * 0.03, 1.34, Math.cos(a) * 0.03);
      stem.rotation.z = Math.sin(a) * lean;
      stem.rotation.x = -Math.cos(a) * lean;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), headMat);
      head.position.set(Math.sin(a) * 0.15, 1.56 + (i % 2) * 0.04, Math.cos(a) * 0.15);
      head.scale.set(1, 0.4, 1);
      head.rotation.z = Math.sin(a) * 0.5;
      head.rotation.x = -Math.cos(a) * 0.5;
      head.castShadow = true;
      stand.add(stem, head);
    }
    stand.position.set(-1.3, 0, 1.0);
    this.add(stand);
    this._stand = this._at(['evening'], stand, { collide: true, touch: true });
    this._standMark = this._at(['morning'], this._plane(0.42, 0.42,
      new THREE.MeshStandardMaterial({ color: 0xbfb5a2, roughness: 1 }), -1.3, 0.016, 1.0, 'up'));

    // ---- the hooks, and her coat ----
    const hookMat = new THREE.MeshStandardMaterial({ color: 0x3f3a33, roughness: 0.5, metalness: 0.6 });
    for (const z of [3.9, 4.2, 4.5]) {
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), hookMat);
      hook.rotation.z = Math.PI / 2;
      hook.position.set(-1.44, 1.6, z);
      this.add(hook);
      this._at(EM, hook);
    }
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3d, roughness: 0.95 });
    const coat = new THREE.Group();
    const skirtOfIt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.82, 0.30), coatMat);
    skirtOfIt.position.y = -0.09;
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.40), coatMat);
    shoulders.position.y = 0.40;
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.20), coatMat);
    collar.position.y = 0.51;
    coat.add(skirtOfIt, shoulders, collar);
    coat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    coat.position.set(-1.42, 1.05, 4.2);
    this.add(coat);
    this._coat = this._at(['evening'], coat, { touch: true });

    // ---- the telephone (hers, at the evening; boxed by the morning) ----
    const phone = new THREE.Group();
    const phoneMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.17), phoneMat);
    body.position.y = 0.045;
    const handset = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.05, 0.06), phoneMat);
    handset.position.y = 0.11;
    phone.add(body, handset);
    phone.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    phone.position.set(-1.02, 0.8, -3.72);
    this.add(phone);
    this._phone = this._at(['evening'], phone, { touch: true });

    // ---- the photographs on the east wall, and the pale squares they leave ----
    for (let i = 0; i < 4; i++) {
      const z = -1.8 - i * 0.95;
      const frame = makePictureFrame({ texture: blurredPhotoTexture({ figures: 2 + (i % 2) }), width: 0.34, height: 0.26 });
      frame.position.set(1.47, 1.62, z);
      frame.rotation.y = -Math.PI / 2;
      this.add(frame);
      this._at(['evening'], frame);
      const pale = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32),
        new THREE.MeshStandardMaterial({ color: 0xcfc3ac, roughness: 1 }));
      pale.position.set(1.489, 1.62, z);
      pale.rotation.y = -Math.PI / 2;
      this.add(pale);
      this._at(['morning'], pale);
    }

    // ---- the morning: a sheet over the table, three boxes by the door ----
    this._at(['morning'], this._box(0.9, 0.05, 0.5,
      new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 1 }), TABLE.x, 0.8, TABLE.z));

    this._slippersTaken = false;
    this._boxVan = this._morningBox('HALL — van', 0.8, -4.6, () => {
      if (this._slippersTaken) { this.subtitle('Empty now, but for a folded tea towel.', 3); return; }
      this._slippersTaken = true;
      this.giveItem({ id: 'slippers', name: 'her slippers' });
      this.subtitle('Her slippers, flattened at the heel. You take them.', 4);
      this.setObjective('leave them where it will look');
    });
    this._boxKeep = this._morningBox('HALL — keep', -0.7, -4.6, () => {
      this.subtitle('The telephone, its cord wound round it. Four photographs, face down.', 4);
    });
    this._boxMisc = this._morningBox('HALL — misc', 0.8, -3.9, () => {
      this.subtitle('A bulb for the porch light, still in its sleeve. It was never the bulb.', 5);
    });
    for (const b of [this._boxVan, this._boxKeep, this._boxMisc]) {
      this._at(['morning'], b, { collide: true, touch: true });
    }

    // ---- her light ----
    this._bulbE1 = makeBulbLight({ color: 0xffd2a0, intensity: 0, distance: 9, y: 2.45 });
    this._bulbE1.position.set(0, 0, 0);
    this.add(this._bulbE1);
    this._bulbE2 = makeBulbLight({ color: 0xffd2a0, intensity: 0, distance: 9, y: 2.45 });
    this._bulbE2.position.set(0, 0, -4);
    this.add(this._bulbE2);
    this._at(EM, this._bulbE1);
    this._at(EM, this._bulbE2);
    this._bulbE1.light.castShadow = true;

    this.hours.bind('evening', {
      lights: [{ light: this._bulbE1.light, intensity: 4.5 }, { light: this._bulbE2.light, intensity: 3.5 },
        { light: this._landing, intensity: 4.2 }, { light: this._sconce, intensity: 4.0 }],
      loops: [{ kind: 'radio', position: { x: -2.0, y: 1.2, z: -3.0 }, opts: {} }],
      blockers: [
        [[-1.7, 0, -7.1], [1.7, 2.6, -6.9]],                    // the gate
        [[-1.7, 0, -7.1], [-1.5, 2.6, -5.4]],                   // the sides of the porch
        [[1.5, 0, -7.1], [1.7, 2.6, -5.4]],
      ],
    });
    this.hours.bind('morning', {
      lights: [{ light: this._landing, intensity: 1.4 }],
      loops: [{ kind: 'idle', position: { x: 4, y: 0.5, z: -9 } }],
      blockers: [[[-1.7, 0, -6.25], [1.7, 2.6, -6.05]]],
    });
  }

  // ---------- the dream's hall: I's corridor, at 3:07 ----------

  _buildDreamHall() {
    const H = DREAM.h, N = ['night'];
    const len = DREAM.z1 - DREAM.z0 + 0.2;                       // 36.2
    const cz = (DREAM.z0 + DREAM.z1) / 2;                        // −12.6

    this._at(N, this._plane(2.7, len, this._dreamCeil, 0, H, cz, 'down'));
    for (const side of [-1, 1]) {
      this._at(N, this._box(0.2, H, len, this._dreamWall, side * 1.45, H / 2, cz), { collide: true });
      this._at(N, this._box(0.04, 0.14, len, this._skirt, side * 1.33, 0.07, cz));
    }
    for (const seg of this._wallWithDoorway(this._dreamWall,
      { vertical: false, at: 0, lo: -1.55, hi: 1.55, h: H, pos: DREAM.z1 + 0.1 })) this._at(N, seg, { collide: true });
    for (const seg of this._wallWithDoorway(this._dreamWall,
      { vertical: false, at: 0, lo: -1.55, hi: 1.55, h: H, pos: DREAM.z0 })) this._at(N, seg, { collide: true });

    // I's bulbs — and the fifth of them stutters, the way I's sixth did
    const bulbLights = [];
    for (let i = 0; i < 6; i++) {
      const bulb = makeBulbLight({ color: 0xffe2bc, intensity: 0, distance: 11, y: H - 0.35 });
      bulb.position.set(0, 0, 2.3 - 6 * i);
      this.add(bulb);
      this._at(N, bulb);
      if (i === 2) bulb.light.castShadow = true;
      bulbLights.push({ light: bulb.light, intensity: 5 });
      if (i === 4) {
        let tNext = 0;
        this.tick((dt, t) => {
          if (!this.hours.is('night') || this.hours.changing) return;
          if (t > tNext) {
            const on = Math.random() > 0.28;
            bulb.light.intensity = on ? 5 : 0.5;
            tNext = t + (on ? 0.15 + Math.random() * 1.8 : 0.04 + Math.random() * 0.14);
          }
        });
      }
    }

    const dust = makeDust({ count: 220, box: [2.4, 2.6, 36], center: [0, 1.5, -12.6] });
    this.add(dust);
    this.track(dust);
    this._at(N, dust);

    // ten doors, 203 to 212 — one of them is 207
    for (let i = 0; i < 5; i++) {
      const z = -0.7 - 7 * i;
      for (const side of [1, -1]) {
        const plate = side === 1 ? 203 + 2 * i : 204 + 2 * i;
        const door = makeDoor({ color: i % 2 ? '#7d6349' : '#846a4d' });
        door.position.set(side * 1.33, 0, z);
        door.rotation.y = -side * Math.PI / 2;
        door.userData.plate = plate;
        this.add(door);
        this._at(N, door, { touch: true });
        this._dreamDoors.push(door);
        const num = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.09),
          new THREE.MeshStandardMaterial({
            map: textTexture({ text: String(plate), width: 128, height: 96, font: '44px Georgia', bg: '#8d7a55', color: '#2e2618' }),
            roughness: 0.5, metalness: 0.4,
          }));
        num.position.set(side * 1.22, 1.7, z);
        num.rotation.y = -side * Math.PI / 2;
        this.add(num);
        this._at(N, num);
      }
    }

    // the photographs, too blurred to name
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      const frame = makePictureFrame({ texture: blurredPhotoTexture({ figures: 2 + (i % 2) }), width: 0.42, height: 0.32 });
      frame.position.set(side * 1.31, 1.62, -4.2 - i * 8);
      frame.rotation.y = -side * Math.PI / 2;
      this.add(frame);
      this._at(N, frame);
    }

    // where the flowers used to be
    const ped = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.98, 0.34), this._plaster);
    shaft.position.y = 0.49;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.44), this._plaster);
    cap.position.y = 1.0;
    ped.add(shaft, cap);
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: 0x7e8894, roughness: 0.3 }));
    vase.position.set(0.1, 1.1, -0.13);
    ped.add(vase);
    const dryMat = new THREE.MeshStandardMaterial({ color: 0x5c4f33, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.3, 5), dryMat);
      stem.position.set(0.1 + Math.sin(a) * 0.02, 1.31, -0.13 + Math.cos(a) * 0.02);
      stem.rotation.z = Math.sin(a) * 0.22;
      stem.rotation.x = -Math.cos(a) * 0.22;
      ped.add(stem);
    }
    ped.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    ped.position.set(PEDESTAL.x, 0, PEDESTAL.z);
    this.add(ped);
    this._pedestal = this._at(N, ped, { collide: true, touch: true });

    // the door at the end
    this._endDoor = makeDoor({ width: 1.0, color: '#4f3d2e', frameColor: '#3c2f24' });
    this._endDoor.position.set(0, 0, END_Z);
    this.add(this._endDoor);
    this.track(this._endDoor);
    this._at(N, this._endDoor, { touch: true });
    this._bindings.night.colliders.push(this._endDoor.panel);

    // a line of light under it: the wireless is on in the room beyond
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.035),
      new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xffd9a8, emissiveIntensity: 2.2 }));
    spill.position.set(0, 0.018, END_Z + 0.09);
    spill.rotation.x = -Math.PI / 2;
    this.add(spill);
    this._at(N, spill);
    this._endGlow = new THREE.PointLight(0xffd0a0, 0, 3.4, 2.0);
    this._endGlow.position.set(0, 0.22, END_Z + 0.35);
    this.add(this._endGlow);

    this.hours.bind('night', {
      lights: [...bulbLights, { light: this._endGlow, intensity: 1.6 }],
      loops: [{ kind: 'radio', position: { x: 0, y: 1.2, z: -31.5 }, opts: {} }],
    });
  }

  // ---------- the clock: the hours are turned by hand ----------

  _buildClock() {
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.6 });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 24), caseMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(CLOCK_POS.x - 0.02, CLOCK_POS.y, CLOCK_POS.z);
    this.add(drum);
    this._clockFace = makeClockFace({ radius: 0.16 });
    this._clockFace.position.set(CLOCK_POS.x + 0.025, CLOCK_POS.y, CLOCK_POS.z);
    this._clockFace.rotation.y = Math.PI / 2;                 // faces +X, into the hall
    this._clockFace.setTime(3, 7, 0);
    this.add(this._clockFace);
    this.track(this._clockFace);
    this.interact(drum, { prompt: 'the clock', distance: 3.0, onInteract: () => this._wind() });
    this._clockDrum = drum;
  }

  // ---------- the shared helpers of the five above ----------

  _wind() {
    if (this.hours.changing) return;
    // The hands are done: the door at the end is only there at 3:07, so the
    // clock says why it will not turn instead of answering with nothing.
    if (this._clockLocked) { this.subtitle('Let it be 3:07. The door at the end is only open at this hour.', 4); return; }
    // Not while something is walking the hall: another hour takes the corridor
    // away under it, and the door it opens is only there at 3:07.
    if (this._rehearsing || this._walking) { this.subtitle('Not now. Something small is out in the hall.', 4); return; }
    this.playSoundAt('wind', CLOCK_POS);
    const next = this.hours.order[(this.hours.order.indexOf(this.hours.current) + 1) % 3];
    const [h, m] = { night: [3, 7], morning: [7, 15], evening: [8, 30] }[next];
    this._clockFace.setTime(h, m, 1.6);
    this.hours.next();
    if (!this._wound) {
      this._wound = true;
      this.subtitle('The hands move. They never did, before.', 5);
      this.setObjective('the hall, at another hour');
    }
  }

  _bindLook(windowPos, sunFrom) {
    const hemiN = new THREE.HemisphereLight(0x2a2e44, 0x07070a, 0);
    const hemiE = new THREE.HemisphereLight(0x5a4a3a, 0x1a1410, 0);
    const hemiM = new THREE.HemisphereLight(0xffffff, 0xcfcac0, 0);
    this.add(hemiN, hemiE, hemiM);
    // No moon here: the hall has no window at any hour, so the night is I's
    // bulbs and nothing else (spec §5.2, the hours table).
    const sun = new THREE.DirectionalLight(0xfff2dc, 0);
    sun.position.set(sunFrom.x, sunFrom.y, sunFrom.z);
    sun.target.position.set(0, 1, 0);
    sun.castShadow = true;
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
    sun.shadow.camera.far = 40;
    this.add(sun, sun.target);
    const GRADE_N = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
    const GRADE_E = { vignette: 1.2, grain: 0.03, desat: 0.08, lift: 0.03, fringe: 0.0005 };
    const GRADE_M = { vignette: 0.9, grain: 0.045, desat: 0.35, lift: 0.09, fringe: 0.001 };
    this.hours.bind('night', { lights: [{ light: hemiN, intensity: 0.35 }], fog: { color: '#0a0a10', near: 1.5, far: 14 }, grade: GRADE_N, mood: this.constructor.meta.mood });
    this.hours.bind('evening', { lights: [{ light: hemiE, intensity: 0.45 }], fog: { color: '#1a140f', near: 2, far: 18 }, grade: GRADE_E, mood: 'evening' });
    this.hours.bind('morning', { lights: [{ light: hemiM, intensity: 1.5 }, { light: sun, intensity: 1.4 }], fog: { color: '#d8d5ce', near: 1, far: 9 }, grade: GRADE_M, mood: 'morning',
      loops: [{ kind: 'birds', position: windowPos }] });
  }

  _wrongHourPlacing() {
    if (this.hours.is('evening')) this.subtitle('She\'d only tidy it away. Leave it for the night.', 5);
    else this.subtitle('There is nothing here to leave it on, not any more.', 5);
  }

  _morningBox(label, x, z, onOpen) {
    const g = new THREE.Group();
    const card = new THREE.MeshStandardMaterial({ color: 0xa3896a, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), card);
    body.position.y = 0.2; body.castShadow = body.receiveShadow = true;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1),
      new THREE.MeshStandardMaterial({ map: textTexture({ text: label, font: '24px Georgia', color: '#3a332c', bg: '#d9cfbd', width: 384, height: 128 }), roughness: 0.9 }));
    lab.position.set(0, 0.26, 0.201);
    g.add(body, lab);
    g.position.set(x, 0, z);
    this.add(g);
    this.interact(g, { prompt: label.toLowerCase(), onInteract: () => onOpen(g) });
    return g;
  }

  async _waitFor(test, capSeconds) {
    const until = Date.now() + capSeconds * 1000;
    while (!test() && Date.now() < until) await this.debugWait(0.05);
  }

  // ---------- the puzzle ----------

  _wirePuzzle() {
    // ---- doors and flavour ----
    this.interact(this._kitchenDoor, { prompt: 'the kitchen door', onInteract: () => { this.playSound('locked'); this.subtitle('It shut behind you. They always do.', 4); } });
    this.interact(this._sittingDoor, { prompt: 'the sitting room', onInteract: () => {
      this.playSound('locked');
      this.subtitle(this.hours.is('evening') ? 'Not yet. She is still up.' : 'White. The house is gone from here on.', 4);
    } });
    this.interact(this._frontDoor, { prompt: 'the front door', onInteract: () => {
      if (this.hours.is('evening')) {
        if (this._frontOpen) return;
        this._frontOpen = true;
        this._frontDoor.setOpen(true, -1);
        if (this._frontBlocker) { this.removeBlocker(this._frontBlocker); this._frontBlocker = null; }
        this.playSound('door');
        this._doorSpill.intensity = 7;
        this.subtitle('The porch, and the street, and another night going on out there without her.', 5);
      } else {
        this.subtitle('White. The house is gone from here on.', 4);
      }
    } });
    // the doorway is shut at her hour and stands open onto the white at the morning
    this.hours.bind('evening', { onEnter: () => {
      this._frontOpen = false;
      this._frontDoor.setAngle(0);
      this._doorSpill.intensity = 0;
      if (!this._frontBlocker) this._frontBlocker = this.addBlocker([-0.55, 0, -5.5], [0.55, 2.2, -5.3]);
    } });
    this.hours.bind('evening', { onLeave: () => {
      this._frontOpen = false;
      this._frontDoor.setAngle(0);
      this._doorSpill.intensity = 0;
      if (this._frontBlocker) { this.removeBlocker(this._frontBlocker); this._frontBlocker = null; }
    } });
    this.hours.bind('morning', { onEnter: () => this._frontDoor.setAngle(Math.PI / 2) });
    this.hours.bind('morning', { onLeave: () => this._frontDoor.setAngle(0) });

    this.interact(this._porchSwitch, { prompt: 'the porch light', onInteract: () => {
      this.playSound('switch'); this.playSound('locked');
      this.subtitle(this._porchSaid ? 'Dead.' : 'Dead. It always was. She said it was the bulb. It was never the bulb.', this._porchSaid ? 3 : 6);
      this._porchSaid = true;
    } });
    this.interact(this._mailbox, { prompt: 'the mailbox', onInteract: () => this.subtitle('Empty. Nothing has been delivered yet.', 4) });
    this.interact(this._gate, { prompt: 'the gate', onInteract: () => this.subtitle('The street is another night.', 4) });
    this.interact(this._stairs, { prompt: 'the stairs', onInteract: () => this.subtitle(this.hours.is('evening') ? 'Not yet. The wireless first. Then up.' : 'The banister is wrapped. The carpet is rolled.', 4) });
    this.interact(this._cupboardDoor, { prompt: 'the cupboard', onInteract: () => { this.playSound('locked'); this.subtitle('Locked. Coats and a hoover and the smell of the dark.', 4); } });
    this.interact(this._phone, { prompt: 'the telephone', onInteract: () => this.subtitle('The dialling tone. Nobody to ring, at this hour.', 4) });
    this.interact(this._stand, { prompt: 'the sunflowers', onInteract: () => this.subtitle('Sunflowers, five of them. They have stood on this spot every Friday of your life.', 5) });
    let fl = 0;
    this._dreamDoors.forEach((door) => this.interact(door, { prompt: 'try the door', onInteract: () => {
      this.playSound('locked');
      if (door.userData.plate === 207) { this.subtitle('Locked. Behind it, somebody small is breathing, slowly, asleep.', 5); return; }
      this.subtitle(fl < FLAVOUR.length ? FLAVOUR[fl++] : 'Locked.', 5);
    } }));

    // the evening: her, one room ahead of you, every time
    this.hours.bind('evening', { onEnter: () => {
      if (this._eveningOnce) return;
      this._eveningOnce = true;
      this.after(15, () => { if (!this.hours.is('evening')) return; this.playSoundAt('handle', { x: -1.5, y: 1.0, z: -3.0 }); this.subtitle('She thought of something, and didn\'t.', 4); });
    } });
    this.hours.bind('evening', { onEnter: () => {
      let n = 0;
      const step = () => { if (!this.hours.is('evening') || n++ >= 9) return; this.playSoundAt('stepOther', { x: -2.2, y: 0, z: -3.0 }, { soft: true }); this.after(0.9, step); };
      step();
    } });

    // ---- her coat ----
    this.interact(this._coat, { prompt: 'her coat, on the hook', onInteract: () => {
      if (this._coatTaken) { this.subtitle('The pockets are empty now.', 3); return; }
      this._coatTaken = true;
      this.subtitle('Warm, still. In the pocket: the spare key, and a note, folded small, in her hand.', 6);
      this.giveItem({ id: 'spare-key', name: 'the spare key, warm' });
      this.giveItem({ id: 'note-i', name: 'a note, folded small' });
      this.giveNote({ id: 'l17-note', title: 'the note from her coat pocket', body: NOTE_I });
      this.setObjective('leave them where it will look');
    } });

    // ---- placing and taking back ----
    const place = (where) => {
      if (!this.hours.is('night')) { if (this.hasItem('note-i') || this.hasItem('spare-key')) this._wrongHourPlacing(); else this.subtitle(where === 'table' ? 'The telephone table.' : 'The stand.', 3); return; }
      const slots = where === 'table'
        ? { note: this._notePlaced, key: this._keyOnTable }
        : { note: this._noteOnPedestal, key: this._keyOnPedestal };
      if (this.hasItem('note-i') && this._placed.note === null) { this.removeItem('note-i'); slots.note.visible = true; this._placed.note = where; this.playSound('paper'); return; }
      if (this.hasItem('spare-key') && this._placed.key === null) { this.removeItem('spare-key'); slots.key.visible = true; this._placed.key = where; this.playSound('pickup'); return; }
      // Take back everything this surface holds, in one press. One at a time
      // strands the key: with the note and the key both down and empty hands,
      // the press that lifts the note is undone by the next one putting it
      // straight back, and the key under it never comes up.
      const tookNote = this._placed.note === where;
      const tookKey = this._placed.key === where;
      if (tookNote) { slots.note.visible = false; this._placed.note = null; this.giveItem({ id: 'note-i', name: 'a note, folded small' }); }
      if (tookKey) { slots.key.visible = false; this._placed.key = null; this.giveItem({ id: 'spare-key', name: 'the spare key, warm' }); }
      if (tookNote && tookKey) { this.subtitle('You take them both back.', 3); return; }
      if (tookNote || tookKey) return;
      this.subtitle(where === 'table' ? 'The table by the door. Nothing on it.' : 'Where the flowers used to be. Five dry stems.', 4);
    };
    this.interact(this._table, { prompt: 'the table', onInteract: () => place('table') });
    this.interact(this._pedestal, { prompt: 'where the flowers used to be', onInteract: () => place('pedestal') });
    this.interact(this._mat, { prompt: 'the mat', onInteract: () => {
      if (this.hours.is('evening')) { this.subtitle('The mat. Her slippers are not on it; she is wearing them.', 4); return; }
      if (this.hours.is('morning')) { this.subtitle('The mat. Dust, in the shape of two feet.', 4); return; }
      if (this.hasItem('slippers')) { this.removeItem('slippers'); this._slippersMesh.visible = true; this._placed.slippers = true; this.playSound('paper'); return; }
      if (this._placed.slippers) { this._slippersMesh.visible = false; this._placed.slippers = false; this.giveItem({ id: 'slippers', name: 'her slippers' }); return; }
      this.subtitle('The mat at the stair foot. Bare.', 3);
    } });

    // ---- the door at the end: the rehearsal ----
    this.interact(this._endDoor, { prompt: 'the door at the end. listen.', onInteract: () => {
      if (this._exitOpen || this._rehearsing) return;
      this._rehearsing = true;
      this.hush(1.5);
      this.setObjective('listen');
      this.after(1.5, () => this._rehearse());
    } });
    this.tick(() => {
      if (this._exitOpen && !this.isCompleted && this.game.player.position.z < END_Z - 1.2) this.complete();
    });
  }

  /** The child's dream walks the hall: mat → table → pedestal → the door; it stops at the first thing that is wrong. */
  _rehearse() {
    this._walking = true;
    const soft = this._placed.slippers;
    const opts = { soft };
    const w = { x: MAT.x, z: MAT.z };                                            // the walker's last position
    const hum = (pos) => { this.playSoundAt('hummed', { x: pos.x, y: 0.9, z: pos.z }, { notes: HUM, small: true }); this.cue('a small hum', new THREE.Vector3(pos.x, 0.9, pos.z)); };
    const back = (pos, n) => {                                                  // n steps back toward the mat, then nothing
      const dir = { x: MAT.x - pos.x, z: MAT.z - pos.z };
      const len = Math.hypot(dir.x, dir.z) || 1;
      const d = Math.min(len, n * 0.55);
      this.footsteps([{ x: pos.x, y: 0, z: pos.z }, { x: pos.x + dir.x / len * d, y: 0, z: pos.z + dir.z / len * d }],
        { stride: 0.55, every: 0.26, opts, onDone: () => { this._walking = false; } });
    };
    const fail = (line, secs) => { this._rehearsing = false; this._rehearsals++; this.subtitle(line, secs); this.setObjective('leave them where it will look');
      if (this._rehearsals >= 3) this.after(secs, () => this.subtitle('It comes down in her slippers, reads the note by the door, and looks where the flowers used to be. That is the whole of it.', 8)); };
    let cued = false;
    const walk = (to, onDone) => this.footsteps([{ x: w.x, y: 0, z: w.z }, { x: to.x, y: 0, z: to.z }], {
      stride: 0.55, every: 0.26, opts,
      onStep: (i, pos) => { w.x = pos.x; w.z = pos.z; if (!cued) { cued = true; this.cue('small footsteps', pos); } },
      onDone,
    });

    // leg 1 — bare feet stop after four steps
    if (!soft) {
      const cancel = walk({ x: -0.6, z: -3.4 }, () => {});
      this.after(0.26 * 4 + 0.05, () => {
        cancel();
        hum(w);
        this.after(0.8, () => back(w, 4));
        fail('Bare feet on the hall floor. It goes back up for its slippers, and there aren\'t any.', 6);
      });
      return;
    }
    walk({ x: -0.6, z: -3.4 }, () => {
      if (this._placed.note !== 'table') {
        this.after(1.5, () => { hum(w); this.after(0.8, () => back(w, 4)); fail('It came down, and there was nothing to read, and it went back up.', 6); });
        return;
      }
      this.playSoundAt('paper', { x: TABLE.x, y: TABLE.y, z: TABLE.z });
      this.after(1.5, () => walk({ x: 0.7, z: -17.3 }, () => {
        if (this._placed.key !== 'pedestal') {
          this.after(1.5, () => {
            hum(w); this.after(0.8, () => back(w, 6));
            this._failKey++;
            fail(this._failKey === 1
              ? 'It read the note. It looked where the note said, and found nothing, and went back.'
              : 'It looks where the flowers used to be. Nowhere else.', this._failKey === 1 ? 6 : 5);
          });
          return;
        }
        this.playSoundAt('pickup', { x: PEDESTAL.x, y: PEDESTAL.y, z: PEDESTAL.z });
        this.after(1.0, () => walk({ x: 0, z: -30.0 }, () => {
          this._rehearsing = false;
          this._walking = false;
          this._exitOpen = true;
          this._clockLocked = true;
          this.playSoundAt('unlock', { x: 0, y: 1.0, z: END_Z });
          this._endDoor.setOpen(true, -1);
          this.removeColliderOf(this._endDoor.panel);
          this.playSound('door');
          this.subtitle('It found everything. It goes on ahead of you, and the door stays open.', 6);
          this.setObjective('the wireless');
          this.after(3, () => { this.playSoundAt('phone', { x: TABLE.x, y: TABLE.y, z: TABLE.z }, { rings: 2, holdSeconds: 8 }); this.cue('a telephone, ringing', new THREE.Vector3(TABLE.x, TABLE.y, TABLE.z)); });
        }));
      }));
    });
  }

  /**
   * Wind the clock on to `to`, through the clock's own handler. The crossfade
   * runs on frame time and headless renders sit far below real time with the
   * engine clamping dt, so hurry the hour along — the handlers stay real.
   */
  async _windTo(to) {
    await this._waitFor(() => !this.hours.changing, 10);
    this.debugInteract(this._clockDrum);
    this.game.engine.timeScale = 12;
    await this._waitFor(() => this.hours.is(to) && !this.hours.changing, 10);
    this.game.engine.timeScale = 1;
  }

  async debugSolve() {
    const pl = this.game.player;
    try {
      await this._windTo('morning');
      this.debugInteract(this._boxVan); await this._waitFor(() => this.hasItem('slippers'), 3);
      await this._windTo('evening');
      this.debugInteract(this._coat); await this.debugWait(0.3); this.game.ui.closeModal();
      await this._windTo('night');
      this.debugInteract(this._mat); await this._waitFor(() => this._placed.slippers, 3);
      this.debugInteract(this._table); await this._waitFor(() => this._placed.note === 'table', 3);
      this.debugInteract(this._pedestal); await this._waitFor(() => this._placed.key === 'pedestal', 3);
      this._speed = 8;                       // the walk, at eight times its own pace
      this.debugInteract(this._endDoor);
      await this._waitFor(() => this._exitOpen, 32);
      this._speed = 1;
      pl.teleport(0, -32);
      await this._waitFor(() => this.isCompleted, 8);
    } finally {
      this.game.engine.timeScale = 1;
      this._speed = 1;
    }
  }
}
